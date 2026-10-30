/**
 * 轻量 Markdown 渲染（dgp-v20）。
 *
 * 为什么自己写而不是引 marked/markdown-it：这两个库各自 30KB+ 且默认输出不带转义策略，
 * 而这里只需要「仓库里的 README 看得懂」这一档能力。所以先整体转义 HTML，
 * 再在转义后的文本上做替换——任何 `<script>` 都会被转成实体，不存在注入面。
 *
 * 支持：标题、段落、粗斜体、行内代码、围栏代码块、无序/有序列表、引用、分隔线、链接、任务列表。
 * 不支持（有意为之）：内嵌 HTML、mermaid 图、脚注、数学公式。
 */

/** HTML 实体转义：所有替换都在转义后的文本上做。 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}

/** 行内元素：代码 → 粗体 → 斜体 → 链接。顺序不能换，否则链接里的下划线会被当斜体。 */
function inline(text: string): string {
  let out = text
  out = out.replace(/`([^`]+)`/gu, (_all, code: string) => `<code>${code}</code>`)
  out = out.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/gu, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, (_all, label: string, href: string) => {
    // 只放行 http(s)/mailto/相对路径，其它协议（javascript: 等）降级成纯文本。
    const safe = /^(https?:\/\/|mailto:|\/|\.{0,2}\/|#)/iu.test(href)
    return safe ? `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>` : label
  })
  return out
}

/** 把 Markdown 源码渲染成 HTML 片段（已转义，可直接 innerHTML）。 */
export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).replace(/\r\n/gu, '\n').split('\n')
  const out: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    // 围栏代码块：```lang … ```
    const fence = /^```([\w-]*)\s*$/u.exec(line)
    if (fence) {
      const lang = fence[1]
      const body: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/u.test(lines[index])) {
        body.push(lines[index])
        index += 1
      }
      index += 1
      const attr = lang === '' ? '' : ` data-lang="${lang}"`
      out.push(`<pre class="dgp-md-code"${attr}><code>${body.join('\n')}</code></pre>`)
      continue
    }
    // 标题
    const heading = /^(#{1,6})\s+(.*)$/u.exec(line)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      index += 1
      continue
    }
    // 分隔线
    if (/^\s*([-*_])\1{2,}\s*$/u.test(line)) {
      out.push('<hr />')
      index += 1
      continue
    }
    // 引用：连续 > 行合成一段
    if (/^\s*>\s?/u.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^\s*>\s?/u.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/u, ''))
        index += 1
      }
      out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`)
      continue
    }
    // 列表：连续同类行合成一个 ul/ol
    const bullet = /^\s*[-*+]\s+(.*)$/u.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.*)$/u.exec(line)
    if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol'
      const items: string[] = []
      while (index < lines.length) {
        const next = bullet ? /^\s*[-*+]\s+(.*)$/u.exec(lines[index]) : /^\s*\d+[.)]\s+(.*)$/u.exec(lines[index])
        if (!next) break
        const raw = next[1]
        // 任务列表：[ ] / [x]
        const task = /^\[([ xX])\]\s+(.*)$/u.exec(raw)
        if (task) {
          const done = task[1].toLowerCase() === 'x'
          items.push(`<li class="dgp-md-task" data-done="${done ? '1' : '0'}">${done ? '☑' : '☐'} ${inline(task[2])}</li>`)
        } else {
          items.push(`<li>${inline(raw)}</li>`)
        }
        index += 1
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }
    // 空行
    if (/^\s*$/u.test(line)) {
      index += 1
      continue
    }
    // 段落：连续非空行合成一段
    const para: string[] = []
    while (index < lines.length && !/^\s*$/u.test(lines[index]) && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/u.test(lines[index])) {
      para.push(lines[index])
      index += 1
    }
    if (para.length === 0) {
      // 兜底：这一行被上面的规则漏掉时按段落处理，防止死循环。
      para.push(lines[index])
      index += 1
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}
