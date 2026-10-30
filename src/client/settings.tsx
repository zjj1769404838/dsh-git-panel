/**
 * 设置 → Git 分节（完全重写版，BUILD dgp-v16）。
 *
 * 信息架构只有三层，从上到下就是用户的三个问题：
 *   1. 概览带 —— 现在授到什么程度？（一行数字，不再是四格大卡）
 *   2. 账号卡 —— 每个账号能碰哪些仓库？（仓库权限直接内联在卡里，不再折叠）
 *   3. 高级设置 —— 本地目录 / 全局兜底 / 写策略（默认收起，日常不用看）
 *
 * 与旧版的差别（不是微调，是换结构）：
 *   - 没有 tab。账号、仓库、说明同屏，靠层级而不是切页组织。
 *   - 没有「查看仓库」折叠按钮：账号卡里直接就是仓库清单 + 三档分段控件。
 *   - 没有常驻连接长表单：连接/编辑账号走弹窗，主界面不再被表单撑长。
 *   - 权限三档从 <select> 换成三段式按钮：三档同时可见，点一下即改。
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  api,
  useStyles,
  Dot,
  RefreshIcon,
  EmptyState,
  Skeleton,
  Toast,
  fmt,
  readPref,
  writePref,
  subscribePref,
  PREF_DIFF_LAYOUT,
  PREF_HIGHLIGHT,
  PREF_CHIP_HIDDEN,
  PREF_GRAPH_LIMIT,
  PREF_GRAPH_LANES,
  PREF_AI_MODEL,
  REPO_PERMISSIONS,
  type DiffLayout,
  type AccountRepoView,
  type AccountView,
  type PanelState,
  type ProviderView,
  type RepoPermission,
  type SettingsView,
} from './shared.js'
import { Modal } from './workbench.js'

interface SectionProps {
  t: (key: string) => string
  close?: () => void
}

/** 仓库筛选档：全部 + 三档权限。 */
type PermFilter = 'all' | RepoPermission

const PERM_FILTERS: PermFilter[] = ['all', 'full', 'read', 'none']

/** 权限档位 → 字典键。 */
function permKey(perm: RepoPermission): string {
  return perm === 'full' ? 'permFull' : perm === 'read' ? 'permRead' : 'permNone'
}

function permFilterKey(filter: PermFilter): string {
  return filter === 'all' ? 'filterAll' : permKey(filter)
}

/**
 * 单仓库一行：仓库标识 + 元信息 + 三档分段控件。
 * 分段控件三档同时可见（旧版下拉要展开才知道有哪些档位），点一下即提交。
 */
function RepoRow({
  t,
  repo,
  permission,
  saving,
  onPermission,
}: {
  t: (key: string) => string
  repo: AccountRepoView
  permission: RepoPermission
  saving: boolean
  onPermission: (perm: RepoPermission) => void
}) {
  return (
    <div className="dgp-repo" data-saving={saving ? '1' : '0'} data-perm={permission}>
      <div className="dgp-repo-main">
        <span className="dgp-repo-name" title={repo.fullName}>
          {repo.fullName}
        </span>
        <span className="dgp-repo-meta">
          <span>{repo.private ? t('repoPrivate') : t('repoPublic')}</span>
          {repo.defaultBranch ? <span>· {fmt(t('repoDefaultBranch'), { branch: repo.defaultBranch })}</span> : null}
        </span>
      </div>
      <div className="dgp-perm-seg" role="group" aria-label={`${t('permLabel')} ${repo.fullName}`} data-saving={saving ? '1' : '0'}>
        {REPO_PERMISSIONS.map((item) => (
          <button
            key={item}
            type="button"
            data-on={permission === item ? '1' : '0'}
            data-perm={item}
            disabled={saving}
            aria-pressed={permission === item}
            onClick={() => onPermission(item)}
          >
            {t(permKey(item))}
          </button>
        ))}
      </div>
      {saving ? <span className="dgp-perm-saving">{t('permSaving')}</span> : null}
    </div>
  )
}

/**
 * 账号卡：身份 + 状态 + 操作条 + 内联仓库权限。
 * 仓库清单直接内联展开（旧版要额外点「查看仓库」），所以这里自带工具行：
 * 搜索框 / 权限筛选 / 计数 / 刷新。
 */
function AccountCard({
  t,
  account,
  isDefault,
  busy,
  reposState,
  search,
  filter,
  permissionOf,
  savingOf,
  onSearch,
  onFilter,
  onPermission,
  onReload,
  onEdit,
  onRecheck,
  onDisconnect,
  onSetDefault,
}: {
  t: (key: string) => string
  account: AccountView
  isDefault: boolean
  busy: boolean
  reposState?: { loading: boolean; error: string; repos: AccountRepoView[]; truncated?: boolean }
  search: string
  filter: PermFilter
  permissionOf: (repoFullName: string) => RepoPermission
  savingOf: (repoFullName: string) => boolean
  onSearch: (value: string) => void
  onFilter: (value: PermFilter) => void
  onPermission: (repoFullName: string, perm: RepoPermission) => void
  onReload: () => void
  onEdit: () => void
  onRecheck: () => void
  onDisconnect: () => void
  onSetDefault: () => void
}) {
  const all = reposState?.repos ?? []
  const needle = search.trim().toLowerCase()
  const shown = all.filter((repo) => {
    if (needle && !repo.fullName.toLowerCase().includes(needle)) return false
    if (filter === 'all') return true
    return permissionOf(repo.fullName) === filter
  })

  const statusText =
    account.status === 'connected' ? t('connected') : account.status === 'expired' ? t('expired') : t('errored')

  return (
    <div className="dgp-acct" data-status={account.status}>
      <div className="dgp-acct-head">
        <Dot state={account.status} />
        <span className="dgp-acct-name" title={account.login}>
          {account.login || account.displayName || '(unknown)'}
        </span>
        <span className="dgp-badge">{account.provider}</span>
        <span className="dgp-badge" data-tone="mono">
          {account.kind === 'oauth' ? 'OAuth' : 'PAT'}
        </span>
        <span className="dgp-badge" data-state={account.status}>
          {statusText}
        </span>
        {isDefault ? (
          <span className="dgp-badge" data-tone="accent">
            {t('isDefault')}
          </span>
        ) : (
          <button type="button" className="dgp-btn ghost" disabled={busy} onClick={onSetDefault}>
            {t('setDefault')}
          </button>
        )}
        <span className="dgp-acct-gap" />
        <button type="button" className="dgp-btn ghost" disabled={busy} title={t('editHint')} onClick={onEdit}>
          {t('accountEdit')}
        </button>
        <button type="button" className="dgp-btn ghost" disabled={busy} onClick={onRecheck}>
          {t('recheck')}
        </button>
        <span className="dgp-line-sep" aria-hidden="true" />
        <button type="button" className="dgp-btn danger" disabled={busy} onClick={onDisconnect}>
          {t('disconnect')}
        </button>
      </div>

      {account.host || account.scopes.length > 0 ? (
        <div className="dgp-acct-meta">
          {account.host ? <span>{account.host}</span> : null}
          {account.scopes.length > 0 ? <code>{account.scopes.join(' ')}</code> : null}
        </div>
      ) : null}

      {account.lastError ? <div className="dgp-err">{account.lastError}</div> : null}

      <div className="dgp-repos-toolbar">
        <input
          className="dgp-input dgp-search"
          value={search}
          placeholder={t('repoSearch')}
          aria-label={t('repoSearch')}
          onChange={(event) => onSearch(event.target.value)}
        />
        <div className="dgp-seg dgp-filter" role="group" aria-label={t('repoFilter')}>
          {PERM_FILTERS.map((item) => (
            <button key={item} type="button" data-on={filter === item ? '1' : '0'} onClick={() => onFilter(item)}>
              {t(permFilterKey(item))}
            </button>
          ))}
        </div>
        <span className="dgp-repos-count" aria-live="polite">
          {fmt(t('reposCount'), { n: shown.length, m: all.length })}
        </span>
        <button
          type="button"
          className="dgp-btn ghost"
          onClick={onReload}
          aria-label={t('reposReload')}
          title={t('reposReload')}
        >
          <RefreshIcon />
        </button>
      </div>

      {reposState?.loading && all.length === 0 ? <Skeleton rows={3} /> : null}

      {!reposState?.loading && reposState?.error ? (
        <div className="dgp-err">
          {t('reposFailed')}：{reposState.error}
        </div>
      ) : null}

      {!reposState?.loading && !reposState?.error && all.length === 0 ? (
        <EmptyState title={t('reposEmpty')} hint={t('reposEmptyHint')} />
      ) : null}

      {all.length > 0 && shown.length === 0 ? <div className="dgp-hint">{t('reposNoMatch')}</div> : null}

      {shown.map((repo) => (
        <RepoRow
          key={`${account.id}:${repo.fullName}`}
          t={t}
          repo={repo}
          permission={permissionOf(repo.fullName)}
          saving={savingOf(repo.fullName)}
          onPermission={(perm) => onPermission(repo.fullName, perm)}
        />
      ))}

      {!reposState?.loading && !reposState?.error && reposState?.truncated ? (
        <div className="dgp-hint">{t('reposTruncated')}</div>
      ) : null}
    </div>
  )
}

/** 连接 / 编辑账号弹窗：主界面不再常驻长表单，日常只留一个「连接账号」按钮。 */
function ConnectModal({
  t,
  providers,
  initial,
  onClose,
  onConnected,
}: {
  t: (key: string) => string
  providers: ProviderView[]
  initial?: { provider: string; host: string; apiBase: string; method: 'oauth' | 'pat'; login: string } | null
  onClose: () => void
  onConnected: (state?: PanelState) => void
}) {
  const [provider, setProvider] = useState(initial?.provider || 'github')
  const [accountLabel, setAccountLabel] = useState('')
  const [method, setMethod] = useState<'oauth' | 'pat'>(initial?.method ?? 'pat')
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [host, setHost] = useState(initial?.host || '')
  const [apiBase, setApiBase] = useState(initial?.apiBase || '')
  const [flow, setFlow] = useState<{ pollKey: string; userCode: string; verificationUri: string; interval: number } | null>(null)
  const [flowMsg, setFlowMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const timerRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const pollOnce = useCallback(
    async (pollKey: string, interval: number) => {
      try {
        const data = await api<any>('/oauth/poll', { pollKey })
        if (data.status === 'authorized') {
          stopPolling()
          setFlow(null)
          onConnected(data.state)
          return
        }
        if (data.status === 'denied' || data.status === 'expired' || data.status === 'error') {
          stopPolling()
          setFlow(null)
          setFlowMsg((data.error as string) || t('authFailed'))
          return
        }
        const wait = (data.retryAfter as number) > 0 ? (data.retryAfter as number) : interval
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, interval), Math.max(wait, 3) * 1000)
      } catch (err) {
        stopPolling()
        setFlowMsg(err instanceof Error ? err.message : String(err))
      }
    },
    [onConnected, stopPolling, t],
  )

  const startOAuth = async () => {
    setBusy(true)
    setError('')
    setFlowMsg('')
    try {
      const data = await api<any>('/oauth/start', { provider, clientId, host, apiBase })
      if (!data.ok) {
        setError(data.error ?? t('authFailed'))
        return
      }
      const pollKey = String(data.pollKey ?? '')
      setFlow({ pollKey, userCode: data.flow.userCode, verificationUri: data.flow.verificationUri, interval: data.flow.interval })
      setFlowMsg(t('waiting'))
      if (pollKey) {
        timerRef.current = window.setTimeout(() => void pollOnce(pollKey, data.flow.interval), Math.max(data.flow.interval, 3) * 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const connectPat = async () => {
    if (token.trim().length === 0) {
      setError(t('tokenRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await api<any>('/pat/connect', { provider, token, host, apiBase, label: accountLabel.trim() })
      if (!data.ok) {
        setError(data.error ?? t('connectFailed'))
        return
      }
      setToken('')
      onConnected(data.state)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const currentProvider = useMemo(() => providers.find((item) => item.id === provider), [providers, provider])

  return (
    <Modal
      title={initial ? t('accountEdit') : t('connectAccount')}
      onClose={() => {
        stopPolling()
        onClose()
      }}
      width={520}
    >
      {initial ? <div className="dgp-hint" style={{ marginTop: 0 }}>{t('editHint')}</div> : null}

      <div className="dgp-field">
        <label className="dgp-label">{t('provider')}</label>
        <select className="dgp-select" value={provider} onChange={(event) => setProvider(event.target.value)}>
          {(providers.length > 0 ? providers : [{ id: 'github', label: 'GitHub' } as ProviderView]).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="dgp-field">
        <label className="dgp-label">{t('accountLabel')}</label>
        <input
          className="dgp-input"
          value={accountLabel}
          onChange={(event) => setAccountLabel(event.target.value)}
          placeholder={t('accountLabelHint')}
        />
      </div>

      <div className="dgp-field">
        <label className="dgp-label">{t('method')}</label>
        <div className="dgp-seg" role="group">
          <button type="button" data-on={method === 'pat' ? '1' : '0'} onClick={() => setMethod('pat')}>
            {t('pat')}
          </button>
          <button type="button" data-on={method === 'oauth' ? '1' : '0'} onClick={() => setMethod('oauth')}>
            {t('oauth')}
          </button>
        </div>
        <div className="dgp-hint">{method === 'pat' ? currentProvider?.patHint ?? t('patPro') : currentProvider?.oauthHint ?? t('oauthPro')}</div>
      </div>

      {provider === 'gitea' ? (
        <>
          <div className="dgp-field">
            <label className="dgp-label">{t('hostLabel')}</label>
            <input className="dgp-input" value={host} placeholder={t('hostPlaceholder')} onChange={(event) => setHost(event.target.value)} />
          </div>
          <div className="dgp-field">
            <label className="dgp-label">{t('apiBaseLabel')}</label>
            <input className="dgp-input" value={apiBase} placeholder={t('apiBasePlaceholder')} onChange={(event) => setApiBase(event.target.value)} />
          </div>
        </>
      ) : null}

      {method === 'pat' ? (
        <div className="dgp-field">
          <label className="dgp-label">{t('tokenLabel')}</label>
          <input
            className="dgp-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            placeholder={t('tokenPlaceholder')}
            onChange={(event) => setToken(event.target.value)}
          />
          {currentProvider?.patUrl ? (
            <div className="dgp-hint">
              <a className="dgp-link" href={currentProvider.patUrl} target="_blank" rel="noreferrer noopener">
                {currentProvider.patUrl}
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="dgp-field">
          <label className="dgp-label">{t('clientIdLabel')}</label>
          <input className="dgp-input" value={clientId} placeholder="Iv1.xxxxxxxxxxxx" onChange={(event) => setClientId(event.target.value)} />
          <div className="dgp-hint">{t('clientIdHint')}</div>
        </div>
      )}

      {flow ? (
        <div className="dgp-card">
          <div className="dgp-hint" style={{ marginTop: 0 }}>
            {t('userCode')}
          </div>
          <div className="dgp-code">{flow.userCode}</div>
          <div className="dgp-row">
            <a className="dgp-btn" href={flow.verificationUri} target="_blank" rel="noreferrer noopener">
              {flow.verificationUri || 'open'}
            </a>
            <button
              type="button"
              className="dgp-btn"
              onClick={() => {
                void navigator.clipboard?.writeText(flow.userCode)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? t('copied') : t('copy')}
            </button>
            <button
              type="button"
              className="dgp-btn ghost"
              onClick={() => {
                stopPolling()
                setFlow(null)
                setFlowMsg('')
              }}
            >
              {t('cancel')}
            </button>
          </div>
          {flowMsg ? <div className="dgp-hint">{flowMsg}</div> : null}
        </div>
      ) : null}

      {error ? <div className="dgp-err">{error}</div> : null}
      {!flow && flowMsg ? <div className="dgp-ok">{flowMsg}</div> : null}

      <div className="dgp-row" style={{ justifyContent: 'flex-end', paddingTop: 14 }}>
        <button
          type="button"
          className="dgp-btn ghost"
          onClick={() => {
            stopPolling()
            onClose()
          }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="dgp-btn primary"
          disabled={busy || (method === 'pat' && token.trim().length === 0) || (method === 'oauth' && Boolean(flow))}
          onClick={() => void (method === 'pat' ? connectPat() : startOAuth())}
        >
          {busy ? t('connecting') : t('connect')}
        </button>
      </div>
    </Modal>
  )
}

/** 高级设置：本地目录白名单、全局兜底仓库、写策略。默认收起。 */
function AdvancedPanel({
  t,
  reposText,
  rootsText,
  allowWrite,
  requireConfirm,
  busy,
  savedTick,
  discovered,
  discovering,
  onReposText,
  onRootsText,
  onAllowWrite,
  onRequireConfirm,
  onSave,
  onDiscover,
  onUseRoot,
}: {
  t: (key: string) => string
  reposText: string
  rootsText: string
  allowWrite: boolean
  requireConfirm: boolean
  busy: boolean
  savedTick: number
  discovered: Array<{ root: string; name: string; branch: string; remotes: string[] }>
  discovering: boolean
  onReposText: (value: string) => void
  onRootsText: (value: string) => void
  onAllowWrite: (value: boolean) => void
  onRequireConfirm: (value: boolean) => void
  onSave: () => void
  onDiscover: () => void
  onUseRoot: (root: string) => void
}) {
  return (
    <div className="dgp-adv" data-panel="advanced">
      <div className="dgp-group">
        <div className="dgp-group-title">{t('groupScopeRoots')}</div>
        <div className="dgp-field">
          <label className="dgp-label">{t('scopeRoots')}</label>
          <textarea
            className="dgp-area"
            value={rootsText}
            onChange={(event) => onRootsText(event.target.value)}
            placeholder={'D:\\work\\my-repo'}
          />
          <div className="dgp-hint">{t('scopeRootsHint')}</div>
        </div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('scopeDiscoverTitle')}</div>
        {discovering ? (
          <Skeleton rows={2} />
        ) : discovered.length === 0 ? (
          <div className="dgp-hint" style={{ padding: '2px 0 6px' }}>
            {t('scopeDiscoverEmpty')}
          </div>
        ) : (
          discovered.map((repo) => (
            <div key={repo.root} className="dgp-line" style={{ padding: '9px 0' }}>
              <div className="dgp-line-main">
                <span className="dgp-name">{repo.name}</span>
                <span className="dgp-meta">
                  <code>{repo.root}</code>
                  {repo.branch ? <span>· {repo.branch}</span> : null}
                  {repo.remotes.length > 0 ? <span>· {repo.remotes.join(', ')}</span> : <span>· {t('scopeDiscoverNoRemote')}</span>}
                </span>
              </div>
              <div className="dgp-line-side">
                <button type="button" className="dgp-btn" onClick={() => onUseRoot(repo.root)}>
                  {t('scopeDiscoverUse')}
                </button>
              </div>
            </div>
          ))
        )}
        <div className="dgp-line-side" style={{ paddingTop: 6 }}>
          <button type="button" className="dgp-btn ghost" onClick={onDiscover}>
            <RefreshIcon />
            {t('scopeDiscoverReload')}
          </button>
        </div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('groupScopeRepos')}</div>
        <div className="dgp-field">
          <label className="dgp-label">{t('scopeRepos')}</label>
          <textarea
            className="dgp-area"
            value={reposText}
            onChange={(event) => onReposText(event.target.value)}
            placeholder={'owner/repo\nanother-owner/another-repo'}
          />
          <div className="dgp-hint">{t('scopeReposHint')}</div>
          <div className="dgp-hint">{t('scopeReposNote')}</div>
        </div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('groupPolicy')}</div>
        <label className="dgp-check">
          <input type="checkbox" checked={allowWrite} onChange={(event) => onAllowWrite(event.target.checked)} />
          <span className="dgp-check-body">
            <span className="dgp-check-title">{t('allowWrite')}</span>
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('allowWriteHint')}
            </span>
          </span>
        </label>
        <label className="dgp-check">
          <input type="checkbox" checked={requireConfirm} onChange={(event) => onRequireConfirm(event.target.checked)} />
          <span className="dgp-check-body">
            <span className="dgp-check-title">{t('requireConfirm')}</span>
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('requireConfirmHint')}
            </span>
          </span>
        </label>
        <div className="dgp-row" style={{ paddingTop: 12 }}>
          <button type="button" className="dgp-btn primary" disabled={busy} onClick={onSave}>
            {t('save')}
          </button>
          {savedTick > 0 ? <span className="dgp-ok" style={{ marginTop: 0 }}>{t('saved')}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** 差异视图四档，顺序即分段控件的显示顺序。 */
const LAYOUT_KEYS: DiffLayout[] = ['split', 'unified', 'before', 'after']

/** 把 localStorage 里的裸字符串收敛成合法档位，脏值回落到并排。 */
function asLayout(raw: string): DiffLayout {
  return LAYOUT_KEYS.includes(raw as DiffLayout) ? (raw as DiffLayout) : 'split'
}

/** 档位 → 字典键（与差异视图内的按钮同一套键）。 */
function layoutKeyOf(layout: DiffLayout): string {
  return layout === 'split' ? 'diffSplit' : layout === 'unified' ? 'diffUnified' : layout === 'before' ? 'diffBefore' : 'diffAfter'
}

/** 分支图行数收敛到 20~200，非法值回落到 60。 */
function clampLimit(raw: string): string {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) return '60'
  return String(Math.min(200, Math.max(20, value)))
}

/**
 * 界面分节：差异视图默认呈现、语法高亮、输入框旁的 Git 按钮、历史泳道、分支图行数。
 *
 * 与「高级设置」的区别：这一节全部存在本机浏览器（localStorage），不进服务端设置，
 * 也不影响 Agent 能做什么——换台机器就要重新选。所以单独一节，不塞进权限那一堆里。
 * 读写走 subscribePref，工作台里改了同一份偏好的控件会跟着更新，不需要刷新页面。
 */
function InterfacePanel({ t }: { t: (key: string) => string }) {
  const layout = asLayout(useSyncExternalStore(subscribePref, () => readPref(PREF_DIFF_LAYOUT, 'split'), () => 'split'))
  const highlightOn = useSyncExternalStore(subscribePref, () => readPref(PREF_HIGHLIGHT, '1') !== '0', () => true)
  const chipShown = useSyncExternalStore(subscribePref, () => readPref(PREF_CHIP_HIDDEN, '0') !== '1', () => true)
  const laneOn = useSyncExternalStore(subscribePref, () => readPref(PREF_GRAPH_LANES, '1') !== '0', () => true)
  const savedLimit = clampLimit(useSyncExternalStore(subscribePref, () => readPref(PREF_GRAPH_LIMIT, '60'), () => '60'))

  /** 输入框允许中途是空串或半截数字，失焦时才收敛写盘。 */
  const [limitText, setLimitText] = useState(savedLimit)
  useEffect(() => {
    setLimitText(savedLimit)
  }, [savedLimit])

  // 模型目录：进面板才拉一次，拉不到就退回「跟随会话默认」，不挡住其余偏好。
  const aiModel = useSyncExternalStore(subscribePref, () => readPref(PREF_AI_MODEL, ''), () => '')
  const [catalog, setCatalog] = useState<Array<{ provider: string; id: string; name: string; value: string }>>([])
  const [catalogError, setCatalogError] = useState('')
  const [modelsLoading, setModelsLoading] = useState(true)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const data = await api<{ ok: boolean; error?: string; models?: Array<{ provider: string; id: string; name: string; value: string }> }>('/llm/models')
        if (!alive) return
        if (data.ok) setCatalog(data.models ?? [])
        else setCatalogError(data.error || t('prefAiUnavailable'))
      } catch (error) {
        if (alive) setCatalogError(`${t('prefAiUnavailable')}：${(error as Error).message}`)
      } finally {
        if (alive) setModelsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  return (
    <div className="dgp-adv" data-panel="interface">
      <div className="dgp-group">
        <div className="dgp-group-title">{t('groupInterface')}</div>
        <div className="dgp-hint" style={{ marginTop: 0 }}>
          {t('interfaceHint')}
        </div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('prefDiffLayout')}</div>
        <div className="dgp-seg" role="group" aria-label={t('prefDiffLayout')}>
          {LAYOUT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              data-on={layout === key ? '1' : '0'}
              onClick={() => writePref(PREF_DIFF_LAYOUT, key)}
            >
              {t(layoutKeyOf(key))}
            </button>
          ))}
        </div>
        <div className="dgp-hint">{t('prefDiffLayoutHint')}</div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('prefBehavior')}</div>
        <label className="dgp-check">
          <input type="checkbox" checked={highlightOn} onChange={(event) => writePref(PREF_HIGHLIGHT, event.target.checked ? '1' : '0')} />
          <span className="dgp-check-body">
            <span className="dgp-check-title">{t('prefHighlight')}</span>
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('prefHighlightHint')}
            </span>
          </span>
        </label>
        <label className="dgp-check">
          <input type="checkbox" checked={chipShown} onChange={(event) => writePref(PREF_CHIP_HIDDEN, event.target.checked ? '0' : '1')} />
          <span className="dgp-check-body">
            <span className="dgp-check-title">{t('prefChip')}</span>
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('prefChipHint')}
            </span>
          </span>
        </label>
        <label className="dgp-check">
          <input type="checkbox" checked={laneOn} onChange={(event) => writePref(PREF_GRAPH_LANES, event.target.checked ? '1' : '0')} />
          <span className="dgp-check-body">
            <span className="dgp-check-title">{t('prefLanes')}</span>
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('prefLanesHint')}
            </span>
          </span>
        </label>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('prefAiModel')}</div>
        <div className="dgp-field">
          <select
            className="dgp-input"
            value={aiModel}
            disabled={modelsLoading}
            onChange={(event) => writePref(PREF_AI_MODEL, event.target.value)}
          >
            <option value="">{t('prefAiDefault')}</option>
            {catalog.map((item) => (
              <option key={item.value} value={item.value}>
                {item.provider} / {item.name}
              </option>
            ))}
            {aiModel !== '' && !catalog.some((item) => item.value === aiModel) ? (
              <option value={aiModel}>{aiModel}</option>
            ) : null}
          </select>
          <div className="dgp-hint">
            {catalogError !== '' ? catalogError : modelsLoading ? t('prefAiLoading') : t('prefAiModelHint')}
          </div>
        </div>
      </div>

      <div className="dgp-group">
        <div className="dgp-group-title">{t('prefGraphLimit')}</div>
        <div className="dgp-field">
          <div className="dgp-row">
            <input
              className="dgp-input dgp-num"
              type="number"
              min={20}
              max={200}
              step={10}
              value={limitText}
              onChange={(event) => setLimitText(event.target.value)}
              onBlur={() => {
                const next = clampLimit(limitText)
                setLimitText(next)
                writePref(PREF_GRAPH_LIMIT, next)
              }}
            />
            <span className="dgp-hint" style={{ marginTop: 0 }}>
              {t('prefGraphLimitHint')}
            </span>
          </div>
        </div>
        <div className="dgp-row" style={{ paddingTop: 10 }}>
          <button
            type="button"
            className="dgp-btn ghost"
            onClick={() => {
              writePref(PREF_DIFF_LAYOUT, 'split')
              writePref(PREF_HIGHLIGHT, '1')
              writePref(PREF_CHIP_HIDDEN, '0')
              writePref(PREF_GRAPH_LANES, '1')
              writePref(PREF_GRAPH_LIMIT, '60')
              writePref(PREF_AI_MODEL, '')
              setLimitText('60')
            }}
          >
            {t('prefReset')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GitSection({ t }: SectionProps) {
  useStyles()
  const [state, setState] = useState<PanelState | null>(null)
  const [providers, setProviders] = useState<ProviderView[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  /** 界面偏好分节（只影响本机显示，与服务端权限设置无关）。 */
  const [interfaceOpen, setInterfaceOpen] = useState(false)

  // 概览带在页面顶部、面板在下方：展开后把面板滚进视口，避免「点了没反应」的错觉。
  function revealPanel(name: string) {
    window.setTimeout(() => {
      const node = document.querySelector(`[data-panel="${name}"]`)
      if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 60)
  }
  const [connectOpen, setConnectOpen] = useState(false)
  /** 正在编辑的账号（非空时弹窗以「编辑账号」模式打开，回填平台与主机）。 */
  const [editTarget, setEditTarget] = useState<{ provider: string; host: string; apiBase: string; method: 'oauth' | 'pat'; login: string } | null>(null)

  const [reposText, setReposText] = useState('')
  const [rootsText, setRootsText] = useState('')
  const [allowWrite, setAllowWrite] = useState(false)
  const [requireConfirm, setRequireConfirm] = useState(true)
  const [savedTick, setSavedTick] = useState(0)
  const [toast, setToast] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)

  const [discovered, setDiscovered] = useState<Array<{ root: string; name: string; branch: string; remotes: string[] }>>([])
  const [discovering, setDiscovering] = useState(false)

  /** 账号 → 远程仓库列表（内联在账号卡里，进入页面即拉，不再需要展开动作）。 */
  const [accountRepos, setAccountRepos] = useState<
    Record<string, { loading: boolean; error: string; repos: AccountRepoView[]; truncated?: boolean }>
  >({})
  /** 正在保存的「账号:仓库」组合：保存期间禁用该行分段控件，避免连点互相覆盖。 */
  const [permSaving, setPermSaving] = useState<Record<string, boolean>>({})
  /** 乐观更新的权限值（key = `账号:仓库`），请求失败时回滚。 */
  const [permOverride, setPermOverride] = useState<Record<string, RepoPermission>>({})
  /** 账号 → 上次拉到仓库列表的时间戳（手动刷新用；自动拉只在无缓存时发生）。 */
  const [reposFetchedAt, setReposFetchedAt] = useState<Record<string, number>>({})
  /** 账号 → 仓库搜索词。 */
  const [search, setSearch] = useState<Record<string, string>>({})
  /** 账号 → 权限筛选档。 */
  const [filter, setFilter] = useState<Record<string, PermFilter>>({})

  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((tone: 'ok' | 'error' | 'info', text: string) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ tone, text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const applyState = useCallback((next: PanelState) => {
    setState(next)
    setReposText(next.settings.allowedRepos.join('\n'))
    setRootsText(next.settings.allowedRoots.join('\n'))
    setAllowWrite(next.settings.allowWrite)
    setRequireConfirm(next.settings.requireConfirm)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: boolean; state: PanelState; providers: ProviderView[]; error?: string }>('/state')
      if (!data.ok) {
        setError(data.error ?? t('errLoad'))
        return
      }
      setError('')
      setProviders(data.providers ?? [])
      applyState(data.state)
    } catch (err) {
      setError(t('errLoad') + '：' + (err instanceof Error ? err.message : String(err)))
    }
  }, [applyState, t])

  useEffect(() => {
    void load()
  }, [load])

  /** 拉某账号下的远程仓库列表：GET /account/repos?accountId=<id>。 */
  const loadAccountRepos = useCallback(
    async (accountId: string) => {
      setAccountRepos((prev) => ({
        ...prev,
        [accountId]: { loading: true, error: '', repos: prev[accountId]?.repos ?? [], truncated: prev[accountId]?.truncated },
      }))
      try {
        const data = await api<{ ok: boolean; repos?: AccountRepoView[]; error?: string; truncated?: boolean }>(
          `/account/repos?accountId=${encodeURIComponent(accountId)}`,
        )
        if (!data.ok) {
          setAccountRepos((prev) => ({
            ...prev,
            [accountId]: { loading: false, error: data.error || t('reposFailed'), repos: [] },
          }))
          return
        }
        setAccountRepos((prev) => ({
          ...prev,
          [accountId]: {
            loading: false,
            error: '',
            repos: Array.isArray(data.repos) ? data.repos : [],
            truncated: data.truncated === true,
          },
        }))
        setReposFetchedAt((prev) => ({ ...prev, [accountId]: Date.now() }))
      } catch (err) {
        setAccountRepos((prev) => ({
          ...prev,
          [accountId]: { loading: false, error: err instanceof Error ? err.message : t('reposFailed'), repos: [] },
        }))
      }
    },
    [t],
  )

  const accounts = state?.accounts ?? []

  /**
   * 进入页面 / 账号列表变化时，为每个账号自动拉一次仓库列表（内联展示的前提）。
   * 只补没有缓存的账号：已有结果就不重复打平台 API，用户想刷新用行内刷新按钮。
   */
  useEffect(() => {
    for (const account of accounts) {
      const cached = accountRepos[account.id]
      if (!cached) void loadAccountRepos(account.id)
    }
  }, [accounts, accountRepos, loadAccountRepos])

  /** 账号被断开后清掉它的仓库缓存与乐观值，避免下次同名账号复用旧列表。 */
  const dropAccountCache = useCallback((accountId: string) => {
    setAccountRepos((prev) => {
      const next = { ...prev }
      delete next[accountId]
      return next
    })
    setReposFetchedAt((prev) => {
      const next = { ...prev }
      delete next[accountId]
      return next
    })
    setPermOverride((prev) => {
      const next: Record<string, RepoPermission> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`${accountId}:`)) next[key] = value
      }
      return next
    })
  }, [])

  /**
   * 取某账号对某仓库的当前权限。
   * 优先用本地乐观值（刚点完、请求还在路上），其次用 node 在 /account/repos 里算好的档位——
   * 判定逻辑只在 node 侧一份（store.repoPermission），client 不再自己推导一遍。
   */
  const currentPermission = useCallback(
    (accountId: string, repoFullName: string): RepoPermission => {
      const override = permOverride[`${accountId}:${repoFullName}`]
      if (override) return override
      const hit = (accountRepos[accountId]?.repos ?? []).find((item) => item.fullName === repoFullName)
      return hit?.permission ?? 'full'
    },
    [permOverride, accountRepos],
  )

  const permissionSaving = useCallback(
    (accountId: string, repoFullName: string): boolean => permSaving[`${accountId}:${repoFullName}`] === true,
    [permSaving],
  )

  /**
   * 改某账号对某仓库的权限：只提交这一格（POST /repo/permission）。
   * 乐观更新 → 失败回滚到旧档位并提示，不整表覆盖 settings（并发/连点会丢更新）。
   */
  const saveRepoPermission = useCallback(
    async (accountId: string, repoFullName: string, perm: RepoPermission) => {
      const key = `${accountId}:${repoFullName}`
      const previous = currentPermission(accountId, repoFullName)
      if (previous === perm) return
      setPermOverride((prev) => ({ ...prev, [key]: perm }))
      setPermSaving((prev) => ({ ...prev, [key]: true }))
      try {
        const data = await api<{ ok: boolean; state?: PanelState; error?: string }>('/repo/permission', {
          accountId,
          repo: repoFullName,
          permission: perm,
        })
        if (data.state) setState(data.state)
        if (data.ok) {
          showToast('ok', t('permSaved'))
        } else {
          setPermOverride((prev) => ({ ...prev, [key]: previous }))
          showToast('error', data.error || t('permSaveFailed'))
        }
      } catch (err) {
        setPermOverride((prev) => ({ ...prev, [key]: previous }))
        showToast('error', `${t('permSaveFailed')}：${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setPermSaving((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    },
    [currentPermission, showToast, t],
  )

  /** 拉取「检测到的仓库」：/repo/discover 扫描授权根（远程 remotes 一并返回）。 */
  const loadDiscovered = useCallback(async () => {
    setDiscovering(true)
    try {
      const data = await api<{ ok: boolean; repos?: Array<{ root: string; name: string; branch: string; remotes: string[] }> }>(
        '/repo/discover',
      )
      setDiscovered(data.ok && Array.isArray(data.repos) ? data.repos : [])
    } catch {
      setDiscovered([])
    } finally {
      setDiscovering(false)
    }
  }, [])

  // 高级设置展开时扫描一次本地仓库。
  useEffect(() => {
    if (!advanced) return
    void loadDiscovered()
  }, [advanced, loadDiscovered])

  /** 把检测到的仓库根加入授权目录文本框（去重，追加一行）。 */
  const addRoot = useCallback((root: string) => {
    setRootsText((prev) => {
      const lines = prev
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      if (lines.includes(root)) return prev
      lines.push(root)
      return lines.join('\n')
    })
  }, [])

  const disconnect = async (id: string) => {
    if (!window.confirm(t('removeConfirm'))) return
    setBusy(true)
    try {
      const data = await api<any>('/accounts/remove', { id })
      if (data.state) applyState(data.state)
      if (!data.ok && data.error) {
        showToast('error', data.error)
      } else {
        dropAccountCache(id)
        showToast('ok', t('toastSaved'))
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const recheck = async (id: string) => {
    setBusy(true)
    try {
      const data = await api<any>('/accounts/recheck', { id })
      if (data.state) applyState(data.state)
      if (!data.ok && data.error) {
        showToast('error', data.error)
      } else {
        showToast('ok', t('toastRecheck'))
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  /** 设为默认账号：Agent 侧多账号时优先使用它。 */
  const setDefaultAccount = async (id: string) => {
    setBusy(true)
    try {
      const data = await api<any>('/settings', { defaultAccountId: id })
      if (data.state) applyState(data.state)
      if (data.ok) {
        showToast('ok', t('toastDefault'))
      } else {
        showToast('error', data.error ?? t('errLoad'))
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const saveScope = async () => {
    setBusy(true)
    try {
      const data = await api<any>('/settings', {
        allowedRepos: reposText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        allowedRoots: rootsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        allowWrite,
        requireConfirm,
      })
      if (data.state) applyState(data.state)
      if (data.ok) {
        setSavedTick((value) => value + 1)
        showToast('ok', t('toastSaved'))
      } else {
        showToast('error', data.error ?? t('errLoad'))
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const settings: SettingsView | undefined = state?.settings
  const connectedCount = accounts.filter((item) => item.status === 'connected').length
  const unhealthyCount = accounts.filter((item) => item.status !== 'connected').length
  const roots = settings?.allowedRoots ?? []
  const allowAllRoots = roots.includes('*')
  const allowAllRepos = (settings?.allowedRepos ?? []).includes('*')
  const defaultAccountId = settings?.defaultAccountId ?? ''
  // 概览的「授权仓库」= 全局兜底名单 + 各账号权限表里**真正可访问**（full/read）的条目。
  // 只数条目会把 'none' 也算成授权；而未单独设过的仓库按 store 语义默认 full，
  // 这层「默认全开」用 statsReposHintDefault 明说，不硬凑进数字。
  const permTables = Object.values(settings?.repoPermissions ?? {})
  const perAccountGrants = permTables.reduce(
    (sum, table) => sum + Object.values(table ?? {}).filter((perm) => perm !== 'none').length,
    0,
  )
  const hasPermTable = permTables.some((table) => Object.keys(table ?? {}).length > 0)
  const repoGrantCount = allowAllRepos ? Infinity : (settings?.allowedRepos ?? []).length + perAccountGrants

  const primaryState = accounts.find((item) => item.status === 'connected')?.status ?? accounts[0]?.status

  return (
    <div className="dgp-root dgp-section">
      <div className="dgp-head">
        <div>
          <div className="dgp-title">
            <Dot state={primaryState} />
            {t('panelTitle')}
          </div>
          <div className="dgp-sub">{t('panelSubtitle')}</div>
        </div>
        <div className="dgp-line-side">
          <button
            type="button"
            className="dgp-btn primary"
            onClick={() => {
              setEditTarget(null)
              setConnectOpen(true)
            }}
          >
            {t('connectAccount')}
          </button>
        </div>
      </div>

      {error ? <div className="dgp-err">{error}</div> : null}

      {/* 概览带：一行数字说清授到什么程度，替代旧版四格统计卡。 */}
      <div className="dgp-overview" role="group" aria-label={t('statsTitle')}>
        <span className="dgp-overview-item" data-tone={unhealthyCount > 0 ? 'warn' : connectedCount > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-overview-label">{t('statsAccounts')}</span>
          <span className="dgp-overview-num">{accounts.length}</span>
          {unhealthyCount > 0 ? <span className="dgp-overview-hint">{fmt(t('statsAccountsHintMixed'), { n: connectedCount, m: unhealthyCount })}</span> : null}
        </span>
        <span className="dgp-overview-sep" aria-hidden="true" />
        <span className="dgp-overview-item" data-tone={allowAllRoots ? 'warn' : roots.length > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-overview-label">{t('statsRoots')}</span>
          <span className="dgp-overview-num">{allowAllRoots ? '∞' : roots.length}</span>
        </span>
        <span className="dgp-overview-sep" aria-hidden="true" />
        <span className="dgp-overview-item" data-tone={allowAllRepos ? 'warn' : repoGrantCount > 0 ? 'ok' : 'neutral'}>
          <span className="dgp-overview-label">{t('statsRepos')}</span>
          <span className="dgp-overview-num">{allowAllRepos ? '∞' : repoGrantCount}</span>
          {hasPermTable && !allowAllRepos ? <span className="dgp-overview-hint">{t('statsReposHintDefault')}</span> : null}
        </span>
        <span className="dgp-overview-sep" aria-hidden="true" />
        <span className="dgp-overview-item" data-tone={settings?.allowWrite ? 'warn' : 'ok'}>
          <span className="dgp-overview-label">{t('statsWrite')}</span>
          <span className="dgp-overview-num">{settings?.allowWrite ? t('statsWriteOn') : t('statsWriteOff')}</span>
        </span>
        <span className="dgp-acct-gap" />
        <button
          type="button"
          className="dgp-btn ghost"
          aria-expanded={interfaceOpen}
          onClick={() => {
            const next = !interfaceOpen
            setInterfaceOpen(next)
            if (next) revealPanel('interface')
          }}
        >
          {interfaceOpen ? t('interfaceHide') : t('interfaceShow')}
        </button>
        <button
          type="button"
          className="dgp-btn ghost"
          aria-expanded={advanced}
          onClick={() => {
            const next = !advanced
            setAdvanced(next)
            if (next) revealPanel('advanced')
          }}
        >
          {advanced ? t('advancedHide') : t('advancedShow')}
        </button>
      </div>

      {/* 界面偏好与账号无关：紧跟概览带，点开即时可见。 */}
      {interfaceOpen ? <InterfacePanel t={t} /> : null}

      {accounts.length === 0 ? (
        <EmptyState title={t('noAccount')} hint={t('noAccountHint')} />
      ) : (
        accounts.map((account) => (
          <AccountCard
            key={account.id}
            t={t}
            account={account}
            isDefault={defaultAccountId === account.id}
            busy={busy}
            reposState={accountRepos[account.id]}
            search={search[account.id] ?? ''}
            filter={filter[account.id] ?? 'all'}
            permissionOf={(repoFullName) => currentPermission(account.id, repoFullName)}
            savingOf={(repoFullName) => permissionSaving(account.id, repoFullName)}
            onSearch={(value) => setSearch((prev) => ({ ...prev, [account.id]: value }))}
            onFilter={(value) => setFilter((prev) => ({ ...prev, [account.id]: value }))}
            onPermission={(repoFullName, perm) => void saveRepoPermission(account.id, repoFullName, perm)}
            onReload={() => void loadAccountRepos(account.id)}
            onEdit={() => {
              setEditTarget({
                provider: account.provider,
                host: account.host || '',
                apiBase: account.apiBase || '',
                method: account.kind === 'oauth' ? 'oauth' : 'pat',
                login: account.login || '',
              })
              setConnectOpen(true)
            }}
            onRecheck={() => void recheck(account.id)}
            onDisconnect={() => void disconnect(account.id)}
            onSetDefault={() => void setDefaultAccount(account.id)}
          />
        ))
      )}

      {advanced ? (
        <AdvancedPanel
          t={t}
          reposText={reposText}
          rootsText={rootsText}
          allowWrite={allowWrite}
          requireConfirm={requireConfirm}
          busy={busy}
          savedTick={savedTick}
          discovered={discovered}
          discovering={discovering}
          onReposText={setReposText}
          onRootsText={setRootsText}
          onAllowWrite={setAllowWrite}
          onRequireConfirm={setRequireConfirm}
          onSave={() => void saveScope()}
          onDiscover={() => void loadDiscovered()}
          onUseRoot={addRoot}
        />
      ) : null}

      <div className="dgp-adv">
        <div className="dgp-card">
          <div className="dgp-hint" style={{ marginTop: 0, lineHeight: '20px' }}>
            {t('helpText')}
          </div>
          <div className="dgp-sep" />
          <dl className="dgp-kv">
            <dt>{t('oauth')}</dt>
            <dd>{t('oauthPro')}</dd>
            <dt>{t('pat')}</dt>
            <dd>{t('patPro')}</dd>
          </dl>
        </div>
      </div>

      {connectOpen ? (
        <ConnectModal
          t={t}
          providers={providers}
          initial={editTarget}
          onClose={() => {
            setConnectOpen(false)
            setEditTarget(null)
          }}
          onConnected={(next) => {
            if (next) applyState(next)
            else void load()
            setConnectOpen(false)
            setEditTarget(null)
            // 新账号要拉仓库列表：清空缓存让自动拉取 effect 重新跑。
            setAccountRepos({})
            showToast('ok', t('toastSaved'))
          }}
        />
      ) : null}

      {toast ? <Toast tone={toast.tone} text={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  )
}
