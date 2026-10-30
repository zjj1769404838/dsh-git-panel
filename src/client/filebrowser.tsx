/**
 * 文件浏览（dgp-v19）。
 *
 * 懒加载目录树 + 只读预览。为什么不是一次拉全量：仓库动辄几千个文件，
 * 全量列出来既慢又浪费——用户真正会点开的通常只有当前目录那几层。
 *
 * 边界：
 *   - 只读。这里没有任何写盘动作（改文件请在编辑器里做，那是编辑器的活）。
 *   - 路径安全由 node 侧 `src/node/files.ts` 保证（realpath 包含检查、软链外指拒绝、
 *     `.git` 不可浏览），前端只负责把用户点出来的相对路径原样回传，不做二次拼接。
 *   - 二进制文件不预览内容，只给大小；大文件按 512KB 截断并明确提示。
 *   - 图片走单独的 /repo/image 通道拿 base64；点图切换原尺寸/适宽，超过 4MB 只报体积。
 *   - Markdown 走渲染视图（标题/列表/链接/代码块/表格），HTML 只做源码高亮不执行脚本。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api, useStyles, EmptyState, Skeleton, BranchIcon, fmt,
  type FileEntryView, type FileReadView, type ImageReadView,
} from './shared.js'
import { hasGrammar, highlight } from './highlight.js'
import { renderMarkdown } from './markdown.js'

/** 树节点：`loaded` 区分「没展开过」和「展开过但确实为空」。 */
interface TreeNode {
  entry: FileEntryView
  depth: number
  open: boolean
  loading: boolean
  loaded: boolean
  error: string
  children: TreeNode[]
}

/** 把接口返回的条目列表转成树节点。 */
function toNodes(entries: FileEntryView[], depth: number): TreeNode[] {
  return entries.map((entry) => ({
    entry, depth, open: false, loading: false, loaded: false, error: '', children: [],
  }))
}

/** 按 path 递归找节点并原地替换（不可变更新，React 才能感知）。 */
function patchNode(nodes: TreeNode[], path: string, patch: (node: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((node) => {
    if (node.entry.path === path) return patch(node)
    if (node.children.length === 0) return node
    return { ...node, children: patchNode(node.children, path, patch) }
  })
}

/** 字节数转人话。 */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 文件浏览器面板。
 * `cwd` 变化时整棵树重置（换仓库 = 换根），并自动展开根目录。
 */
export function FileBrowser({ t, cwd }: { t: (key: string) => string; cwd: string }) {
  useStyles()
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [rootLoading, setRootLoading] = useState(false)
  const [rootError, setRootError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [picked, setPicked] = useState('')
  const [file, setFile] = useState<FileReadView | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [wrap, setWrap] = useState(false)
  /** 图片预览：非空表示当前文件是图片，存 data URL。 */
  const [image, setImage] = useState<ImageReadView | null>(null)
  /** 点一下原尺寸、再点一下适宽；大图看细节离不开这个。 */
  const [zoom, setZoom] = useState(false)
  // 窄屏钻取：null = 看树，非 null = 看某个文件（配合 CSS 的 [data-focus]）。
  const [focus, setFocus] = useState<'tree' | 'view'>('tree')
  const pickedRef = useRef('')

  const loadDir = useCallback(async (path: string): Promise<{ entries: FileEntryView[]; truncated: boolean; error: string }> => {
    try {
      const data = await api<{ ok: boolean; entries?: FileEntryView[]; truncated?: boolean; error?: string }>(
        `/repo/tree?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(path)}`,
      )
      if (!data.ok) return { entries: [], truncated: false, error: data.error ?? t('fbLoadFailed') }
      return { entries: data.entries ?? [], truncated: data.truncated === true, error: '' }
    } catch (error) {
      return { entries: [], truncated: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, [cwd, t])

  // 换根：重置整棵树并拉第一层。
  useEffect(() => {
    let alive = true
    setNodes([])
    setRootError('')
    setTruncated(false)
    setPicked('')
    pickedRef.current = ''
    setFile(null)
    setImage(null)
    setZoom(false)
    setFileError('')
    setFocus('tree')
    if (cwd === '') return () => { alive = false }
    setRootLoading(true)
    void loadDir('').then((result) => {
      if (!alive) return
      setRootLoading(false)
      setRootError(result.error)
      setTruncated(result.truncated)
      setNodes(toNodes(result.entries, 0))
    })
    return () => { alive = false }
  }, [cwd, loadDir])

  /** 展开/收起一个目录；首次展开才发请求（懒加载）。 */
  const toggleDir = async (node: TreeNode) => {
    if (node.loading) return
    if (node.open) {
      setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: false })))
      return
    }
    if (node.loaded) {
      setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: true })))
      return
    }
    setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({ ...item, open: true, loading: true })))
    const result = await loadDir(node.entry.path)
    setNodes((prev) => patchNode(prev, node.entry.path, (item) => ({
      ...item,
      loading: false,
      loaded: true,
      error: result.error,
      children: toNodes(result.entries, item.depth + 1),
    })))
  }

  /** 打开一个文件。同一个文件重复点击直接复用已有内容，不重复请求。 */
  const openFile = async (entry: FileEntryView) => {
    if (pickedRef.current === entry.path && file !== null) { setFocus('view'); return }
    pickedRef.current = entry.path
    setPicked(entry.path)
    setFocus('view')
    setFileLoading(true)
    setFileError('')
    setFile(null)
    setImage(null)
    setZoom(false)
    try {
      const data = await api<FileReadView>(`/repo/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(entry.path)}`)
      if (!data.ok) {
        setFileError(data.error ?? t('fbReadFailed'))
        return
      }
      setFile(data)
      // node 判定为图片：再走一次图片通道拿 base64（文本通道对二进制只报 binary）。
      if (data.image) {
        const pic = await api<ImageReadView>(`/repo/image?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(entry.path)}`)
        if (pic.ok) setImage(pic)
        else setFileError(pic.error || t('fbImageFailed'))
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error))
    } finally {
      setFileLoading(false)
    }
  }

  /** 递归渲染树。深度用 padding 表达，不额外传 style 对象。 */
  const renderNodes = (list: TreeNode[]): JSX.Element[] => list.flatMap((node) => {
    const isDir = node.entry.kind === 'dir'
    const ignored = node.entry.name === 'node_modules' || node.entry.name === '.git' || node.entry.name === 'dist' || node.entry.name === 'lib'
    const row = (
      <button
        key={node.entry.path}
        type="button"
        className="dgp-fb-row"
        data-on={picked === node.entry.path ? '1' : '0'}
        data-ignored={ignored ? '1' : '0'}
        title={node.entry.path}
        onClick={() => { if (isDir) void toggleDir(node); else void openFile(node.entry) }}
      >
        <span className="dgp-fb-caret" data-open={node.open ? '1' : '0'} data-dir={isDir ? '1' : '0'}>
          {isDir ? (node.loading ? '…' : node.open ? '▾' : '▸') : ''}
        </span>
        <span className="dgp-fb-name" style={{ paddingLeft: `${node.depth * 12}px` }}>{node.entry.name}</span>
        {isDir ? null : <span className="dgp-fb-size">{humanSize(node.entry.size)}</span>}
      </button>
    )
    const children = node.open
      ? node.error !== ''
        ? [<div key={`${node.entry.path}-err`} className="dgp-hint" style={{ paddingLeft: `${(node.depth + 1) * 12}px` }}>{node.error}</div>]
        : renderNodes(node.children)
      : []
    return [row, ...children]
  })

  const lang = file?.lang ?? ''
  const canHighlight = lang !== '' && hasGrammar(lang)
  // Markdown 默认渲染，可切回源码；HTML 永远走源码高亮（渲染等于在本机开一个网页）。
  const isMarkdown = lang === 'markdown'
  const [mdPreview, setMdPreview] = useState(true)
  const body = useMemo(() => {
    if (file === null || !file.ok) return ''
    if (file.binary) return ''
    return file.content
  }, [file])

  return (
    <div className="dgp-fb" data-focus={focus}>
      <div className="dgp-fb-tree">
        <div className="dgp-fb-head">
          <BranchIcon />
          <span className="dgp-fb-path" title={cwd}>{cwd}</span>
        </div>
        {rootLoading ? <Skeleton rows={6} /> : null}
        {rootError !== '' ? <div className="dgp-hint">{rootError}</div> : null}
        {!rootLoading && rootError === '' && nodes.length === 0 ? (
          <EmptyState title={t('fbEmpty')} hint={t('fbEmptyHint')} />
        ) : null}
        {truncated ? <div className="dgp-hint">{t('fbTruncated')}</div> : null}
        <div className="dgp-fb-list">{renderNodes(nodes)}</div>
      </div>

      <div className="dgp-fb-view">
        {picked === '' ? (
          <EmptyState title={t('fbPick')} hint={t('fbPickHint')} />
        ) : (
          <>
            <div className="dgp-fb-head">
              <button type="button" className="dgp-btn ghost dgp-fb-back" onClick={() => setFocus('tree')}>{t('fbBack')}</button>
              <span className="dgp-fb-path" title={picked}>{picked}</span>
              {file !== null && !file.binary ? <span className="dgp-fb-size">{humanSize(file.size)}</span> : null}
              {isMarkdown && file !== null && !file.binary ? (
                <button type="button" className="dgp-btn ghost" data-on={mdPreview ? '1' : '0'} onClick={() => setMdPreview(!mdPreview)}>
                  {t('fbRendered')}
                </button>
              ) : null}
              {file !== null && !file.binary && !(isMarkdown && mdPreview) ? (
                <button type="button" className="dgp-btn ghost" data-on={wrap ? '1' : '0'} onClick={() => setWrap(!wrap)}>
                  {t('fbWrap')}
                </button>
              ) : null}
            </div>
            {fileLoading ? <Skeleton rows={8} /> : null}
            {fileError !== '' ? <div className="dgp-hint">{fileError}</div> : null}
            {image !== null && image.dataUrl !== '' ? (
              <>
                <div className="dgp-fb-imgbox">
                  <img
                    className="dgp-fb-img"
                    data-zoom={zoom ? '1' : '0'}
                    src={image.dataUrl}
                    alt={image.path}
                    onClick={() => setZoom(!zoom)}
                  />
                </div>
                <div className="dgp-fb-imgmeta">
                  <span>{image.mime}</span>
                  <span>{humanSize(image.size)}</span>
                  <span>{t('fbImageZoomHint')}</span>
                </div>
              </>
            ) : null}
            {image !== null && image.truncated ? <div className="dgp-hint">{fmt(t('fbImageTooBig'), { n: humanSize(image.size) })}</div> : null}
            {file !== null && file.binary && image === null ? <div className="dgp-hint">{t('fbBinary')}</div> : null}
            {file !== null && !file.binary && file.truncated ? <div className="dgp-hint">{t('fbTruncatedFile')}</div> : null}
            {file !== null && !file.binary && isMarkdown && mdPreview ? (
              <div className="dgp-fb-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
            ) : null}
            {file !== null && !file.binary && !(isMarkdown && mdPreview) ? (
              <pre className="dgp-fb-code" data-wrap={wrap ? '1' : '0'}>
                {canHighlight
                  ? <code dangerouslySetInnerHTML={{ __html: highlight(body, lang) }} />
                  : <code>{body}</code>}
              </pre>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
