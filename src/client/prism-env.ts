/**
 * Prism 运行环境预置：必须在 prismjs 之前求值。
 *
 * prismjs 的核心脚本在 `window` 上注册 DOMContentLoaded 自动高亮，
 * 这里把 `Prism.manual` 先置为 true，避免它在宿主页面加载时全量扫 DOM
 * （我们只对差异/文件预览里的小片段按需高亮）。
 */
const scope = globalThis as unknown as { Prism?: { manual?: boolean } }
scope.Prism = scope.Prism ?? {}
scope.Prism.manual = true

export {}
