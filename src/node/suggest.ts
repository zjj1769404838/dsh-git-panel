/**
 * 提交信息生成（dgp-v19）。
 *
 * 走宿主已连接的模型（`ctx.llm`），不自己拿 API Key：插件只负责把「暂存区改动 +
 * 近期提交风格」拼成一次最小请求，模型选择跟随会话默认（`ctx.agentDefaultModel`），
 * 与 DSH 里其它 AI 能力同一套账号与配额。
 *
 * 三条硬约束：
 *   1. 只读仓库内容，不落盘、不暂存、不提交——生成结果是给用户编辑的草稿；
 *   2. 模型不可用时明确回「未接入」而不是编一条假信息（宁可不生成）；
 *   3. 发给模型的内容做长度上限裁剪，避免大仓库把整份 diff 送出去。
 */
import { readCommits, readDiff } from './git-ops.js'

/** 送给模型的 diff 上限：够看清改了什么，又不至于把整仓塞进上下文。 */
const MAX_PROMPT_DIFF = 6_000
/** 参考风格的近期提交条数。 */
const STYLE_SAMPLES = 8
/** 生成上限：一条提交信息不该长到需要滚动的程度。 */
const MAX_TOKENS = 200

export interface SuggestResult {
  ok: boolean
  message: string
  error: string
  /** 'model' 表示真由模型生成；'none' 表示未生成。 */
  source: 'model' | 'none'
  provider: string
  model: string
}

/** 宿主 llm 服务的最小面（避免静态 import @deepseek-ai/*，profile 里不可见）。 */
export interface LlmLike {
  prepareCall: (config: Record<string, unknown>, signal?: unknown, configure?: unknown) => Promise<any>
}

export interface DefaultModelLike {
  currentSelection: () => { provider: string; model: string }
}

export interface SuggestDeps {
  llm?: LlmLike
  defaultModel?: DefaultModelLike
  log?: (level: string, message: string) => void
}

/** 从模型流里取纯文本（忽略 reasoning / tool-call 块）。 */
function textOfBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  const parts: string[] = []
  for (const block of blocks) {
    const item = block as { type?: string; text?: string }
    if (item?.type === 'text' && typeof item.text === 'string') parts.push(item.text)
  }
  return parts.join('')
}

/** 模型偶尔会带引号、代码块或「提交信息：」前缀，这里只留第一行正文。 */
function cleanMessage(raw: string): string {
  let text = raw.trim()
  // 去掉 ``` 包裹
  text = text.replace(/^```[a-zA-Z]*\s*/u, '').replace(/```$/u, '').trim()
  // 去掉常见前缀
  text = text.replace(/^(提交信息|commit message|message)\s*[:：]\s*/iu, '')
  // 只保留第一行非空内容
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? ''
  return firstLine.replace(/^["'「『]|["'」』]$/gu, '').trim()
}

/**
 * 生成一条提交信息草稿。
 *
 * @param deps 宿主注入的 llm / agentDefaultModel（都可能不存在）
 * @param cwd 仓库目录（已过 requireWrite 闸门）
 * @param hint 用户补充的说明（可为空）
 */
export async function suggestCommitMessage(
  deps: SuggestDeps,
  cwd: string,
  hint: string,
): Promise<SuggestResult> {
  const none = (error: string): SuggestResult => ({
    ok: false, message: '', error, source: 'none', provider: '', model: '',
  })

  const llm = deps.llm
  if (!llm || typeof llm.prepareCall !== 'function') {
    return none('当前 DSH 未提供模型服务，无法生成提交信息')
  }

  // 模型跟随会话默认；取不到就明确说，不猜一个 provider 去试。
  let route: { provider: string; model: string } | null = null
  try {
    const selection = deps.defaultModel?.currentSelection?.()
    if (selection && typeof selection.provider === 'string' && typeof selection.model === 'string'
      && selection.provider.length > 0 && selection.model.length > 0) {
      route = { provider: selection.provider, model: selection.model }
    }
  } catch {
    route = null
  }
  if (!route) return none('未读取到当前会话的默认模型，请先在 DSH 里选择模型')

  // 改动内容以暂存区为准；没有暂存就退回工作区，让「还没 stage 也想写信息」也能用。
  const staged = await readDiff(cwd, 'staged', '', '')
  if (!staged.ok) return none(staged.error || '读取暂存区失败')
  let diff = staged.diff
  if (diff.trim().length === 0) {
    const worktree = await readDiff(cwd, 'worktree', '', '')
    if (worktree.ok) diff = worktree.diff
  }
  if (diff.trim().length === 0) return none('当前没有可描述的改动')

  // 近期提交只作风格参考，取不到不算失败。
  const recent = await readCommits(cwd, STYLE_SAMPLES, 0)
  const samples = recent.ok
    ? recent.commits.map((commit) => `- ${commit.subject}`).filter((line) => line.length > 3)
    : []

  const clipped = diff.length > MAX_PROMPT_DIFF ? `${diff.slice(0, MAX_PROMPT_DIFF)}\n…（diff 已截断）` : diff
  const prompt = [
    '根据下面的 git 改动，写一条提交信息。',
    '',
    '要求：',
    '1. 只输出提交信息本身，一行，不要解释、不要引号、不要代码块；',
    '2. 中文，动宾结构，说明「做了什么」而不是「改了哪些文件」；',
    '3. 不超过 60 个字，结尾不加句号；',
    samples.length > 0 ? '4. 语气与下面这些既有提交保持一致：' : '',
    ...(samples.length > 0 ? ['', '既有提交风格：', ...samples] : []),
    hint.trim().length > 0 ? `\n补充说明（优先采纳）：${hint.trim()}` : '',
    '',
    '改动内容：',
    clipped,
  ]
    .filter((line) => line !== '')
    .join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    // prepareCall 的 config 必须与 stream 的 options 逐字段一致（宿主会校验），
    // 所以 options 用 call.config 展开后再补 messages/system 等字段。
    const call = await llm.prepareCall(
      { provider: route.provider, model: route.model, maxTokens: MAX_TOKENS },
      controller.signal,
      (controls: Record<string, unknown>) => ({ ...controls }),
    )
    const options = {
      ...call.config,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      purpose: 'dsh-git-panel:commit-message',
      signal: controller.signal,
    }
    // BlockAssembler 由宿主 llm 包导出；这里只按 chunk 类型自建等价装配，
    // 避免为一个文本场景静态依赖 @deepseek-ai/dsh-llm。
    let text = ''
    for await (const chunk of call.stream(options)) {
      const item = chunk as { type?: string; text?: string; block?: { type?: string; text?: string } }
      if (item?.type === 'text-delta' && typeof item.text === 'string') text += item.text
      else if (item?.type === 'block-end' && item.block?.type === 'text' && typeof item.block.text === 'string') {
        // 部分适配器只给 block-end 汇总文本；delta 已累积时以 delta 为准。
        if (text.length === 0) text = item.block.text
      }
    }
    const message = cleanMessage(text)
    if (message.length === 0) return none('模型没有返回可用的提交信息')
    return {
      ok: true, message, error: '', source: 'model', provider: route.provider, model: route.model,
    }
  } catch (error) {
    const detail = (error as Error)?.message ?? String(error)
    deps.log?.('warn', `生成提交信息失败：${detail}`)
    const aborted = controller.signal.aborted
    return none(aborted ? '生成超时（45 秒），请重试' : `生成失败：${detail}`)
  } finally {
    clearTimeout(timer)
  }
}

/** 供门禁断言：文本块拼接（不依赖宿主 BlockAssembler）。 */
export const __testTextOfBlocks = textOfBlocks
