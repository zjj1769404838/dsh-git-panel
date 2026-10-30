/**
 * 语法高亮适配层（dgp-v19）。
 *
 * 只用 Prism 的字符串高亮 API（`Prism.highlight(text, grammar, lang)`），
 * 不做 DOM 全量扫描、不接管页面里别的代码块；产物内联，不发任何网络请求。
 *
 * 语言清单刻意收窄到代码仓库里最常见的十几种：每种语法都会进 client 产物，
 * 全量引入（含 200+ 语言）会让 bundle 膨胀好几倍，而收益只在极少数文件上。
 */
import './prism-env.js'
import Prism from 'prismjs'
// 依赖顺序不能乱：markup/clike 是其它语言的前置。
import 'prismjs/components/prism-markup.js'
import 'prismjs/components/prism-css.js'
import 'prismjs/components/prism-clike.js'
import 'prismjs/components/prism-javascript.js'
import 'prismjs/components/prism-typescript.js'
import 'prismjs/components/prism-jsx.js'
import 'prismjs/components/prism-tsx.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-markdown.js'
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-go.js'
import 'prismjs/components/prism-rust.js'
import 'prismjs/components/prism-java.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-diff.js'

/** node 侧 langOf() 的标识 → Prism 语言键（缺省回退纯文本）。 */
const ALIAS: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  xml: 'markup',
  markdown: 'markdown',
  yaml: 'yaml',
  bash: 'bash',
  shell: 'bash',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  sql: 'sql',
  diff: 'diff',
}

/** 该语言是否有可用 grammar（没有就让调用方走纯文本，避免 Prism 抛错）。 */
export function hasGrammar(lang: string): boolean {
  const key = ALIAS[lang] ?? lang
  return typeof Prism.languages[key] === 'object' && Prism.languages[key] !== null
}

/**
 * 高亮一段代码，返回 HTML 片段（Prism 输出的是 `<span class="token ...">`）。
 * 调用方负责把它放进 `dangerouslySetInnerHTML`；文本本身来自本地仓库文件，
 * 且 Prism 会对 `&<>` 做转义，不会引入可执行标记。
 */
export function highlight(code: string, lang: string): string {
  const key = ALIAS[lang] ?? lang
  const grammar = Prism.languages[key]
  if (!grammar) return ''
  try {
    return Prism.highlight(code, grammar, key)
  } catch {
    return ''
  }
}

/** Prism 的 token 类名映射到本插件 CSS 变量（避免与宿主 token 样式打架）。 */
export const TOKEN_CSS = `
.dgp-dv-code .token.keyword,.dgp-fb-code .token.keyword{color:#a626a4}
.dgp-dv-code .token.string,.dgp-fb-code .token.string{color:#50a14f}
.dgp-dv-code .token.number,.dgp-fb-code .token.number{color:#986801}
.dgp-dv-code .token.comment,.dgp-fb-code .token.comment{color:var(--dgp-faint);font-style:italic}
.dgp-dv-code .token.function,.dgp-fb-code .token.function{color:#4078f2}
.dgp-dv-code .token.operator,.dgp-fb-code .token.operator{color:var(--dgp-muted)}
.dgp-dv-code .token.punctuation,.dgp-fb-code .token.punctuation{color:var(--dgp-muted)}
.dgp-dv-code .token.class-name,.dgp-fb-code .token.class-name{color:#c18401}
.dgp-dv-code .token.tag,.dgp-fb-code .token.tag{color:#e45649}
.dgp-dv-code .token.attr-name,.dgp-fb-code .token.attr-name{color:#986801}
.dgp-dv-code .token.property,.dgp-fb-code .token.property{color:#4078f2}
`
