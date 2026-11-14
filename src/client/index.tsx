// dsh-git-panel — 分支 chip（v3.16 极简化：只读 Git chip + 账号与授权配置）。
// 设计拍板：所有 git 动作（提交/推送/切换分支…）交给 AI 通过 7 个 Agent 工具执行；
// chip 弹层只展示「账号与授权」配置（GitHub PAT/OAuth、npm 多账号、写开关）。
// 不内置任何第三方应用凭据（见 providers.ts）。

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { NS, api, useStyles, Dot, type AccountView, type Dict, type PanelState, type RepoStatusView } from './shared.js'

export const inject = ['slots', 'sessions', 'locale']

const BUILD = 'dgp-v3.16'

// ─── 文案（zh / en）───

const ZH: Dict = {
  entry: 'Git',
  navLabel: 'Git',
  panelTitle: 'Git 面板',
  refresh: '刷新',
  close: '关闭',
  notRepo: '当前会话目录不是 Git 仓库',
  notRepoHint: '打开或切换到一个 Git 仓库目录后再查看。',
  retry: '重新检测',
  detectFailed: '无法检测仓库状态',
  gear: '账号与授权',
  account: 'GitHub 账号',
  noAccount: '未连接账号（不影响本地 git 操作）',
  acctConnected: '已连接',
  acctExpired: '已失效',
  acctError: '凭据异常',
  connectAccount: '连接账号',
  methodPat: 'PAT 令牌',
  methodOauth: 'OAuth 设备码',
  tokenLabel: '访问令牌',
  tokenPlaceholder: '粘贴 PAT（保存后不再回显）',
  labelLabel: '备注名（可选）',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: '本插件不内置任何应用凭据：需你自建 GitHub OAuth App 并填入 Client ID。',
  userCode: '浏览器打开下面的地址并输入代码完成授权',
  waiting: '等待授权…',
  connect: '连接',
  cancel: '取消',
  disconnect: '断开',
  recheck: '校验',
  injectFailed: '注入失败',
  allowWrite: '允许 Agent 修改仓库',
  requireConfirm: '写操作前需要我确认',
  npmAccount: 'npm 发布账号',
  npmNoAccount: '未配置 npm 凭据。',
  npmConnect: '连接 npm',
  npmAdd: '添加凭据',
  npmSwitch: '切换',
  npmActive: '当前',
  npmError: '凭据校验失败',
  npmTokenLabel: 'npm token',
  npmTokenHint: '在 npmjs.com → Access Tokens 生成；验证通过后写入 ~/.npmrc（等同 npm login），保存后不再回显。',
  npmTokenPlaceholder: '粘贴 npm token（npm_ 或旧式长 hex 均可）',
}

const EN: Dict = {
  entry: 'Git',
  navLabel: 'Git',
  panelTitle: 'Git Panel',
  refresh: 'Refresh',
  close: 'Close',
  notRepo: 'This session directory is not a Git repository',
  notRepoHint: 'Open or switch to a Git repository directory to inspect it.',
  retry: 'Check again',
  detectFailed: 'Cannot detect repository status',
  gear: 'Accounts & Access',
  account: 'GitHub account',
  noAccount: 'No account connected (local git still works)',
  acctConnected: 'Connected',
  acctExpired: 'Expired',
  acctError: 'Credential error',
  connectAccount: 'Connect account',
  methodPat: 'PAT token',
  methodOauth: 'OAuth device flow',
  tokenLabel: 'Access token',
  tokenPlaceholder: 'Paste PAT (never shown again after save)',
  labelLabel: 'Label (optional)',
  clientIdLabel: 'OAuth App Client ID',
  clientIdHint: 'No third-party app credential is bundled: create your own GitHub OAuth App and paste its Client ID.',
  userCode: 'Open the URL below in a browser and enter the code',
  waiting: 'Waiting for authorization…',
  connect: 'Connect',
  cancel: 'Cancel',
  disconnect: 'Disconnect',
  recheck: 'Recheck',
  injectFailed: 'Injection failed',
  allowWrite: 'Allow the agent to modify repositories',
  requireConfirm: 'Ask me before every write',
  npmAccount: 'npm publishing accounts',
  npmNoAccount: 'No npm credential configured.',
  npmConnect: 'Connect npm',
  npmAdd: 'Add credential',
  npmSwitch: 'Switch',
  npmActive: 'Active',
  npmError: 'Credential check failed',
  npmTokenLabel: 'npm token',
  npmTokenHint: 'Create one at npmjs.com → Access Tokens; after verification it is written to ~/.npmrc (same as npm login) and never shown again.',
  npmTokenPlaceholder: 'Paste npm token (npm_ or legacy long hex)',
}

// ─── 会话 cwd 订阅（宿主 sessions 服务）───

interface SessionsService {
  list?: {
    subscribe?: (listener: () => void) => () => void
    getSnapshot?: () => { byId?: Record<string, { cwd?: string }> }
  }
}

interface ClientContext {
  slots?: {
    inject?: (name: string, factory: () => any) => void
    register?: (options: any, component: any) => any
  }
  locale?: {
    register?: (namespace: string, dicts: Record<string, Dict>) => void
    bind?: (namespace: string) => (key: string) => string
  }
  sessions?: SessionsService
  get?: (name: string) => any
  logger?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void }
  effect?: (fn: () => void, label?: string) => void
}

function useSessionCwd(sessions: SessionsService | undefined, sessionId: string): string {
  const subscribe = useMemo(
    () => (listener: () => void) => {
      try {
        const list = sessions?.list
        return typeof list?.subscribe === 'function' ? list.subscribe(listener) : () => {}
      } catch {
        return () => {}
      }
    },
    [sessions],
  )
  const get = useCallback(() => {
    try {
      if (!sessionId || !sessions) return ''
      const value = sessions.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd
      return typeof value === 'string' ? value : ''
    } catch {
      return ''
    }
  }, [sessionId, sessions])
  return useSyncExternalStore(subscribe, get, () => '')
}

// ─── 折叠区：账号与授权（原设置页分节全部内容并入面板）───

function GearSection({ t, accounts, onAccounts }: { t: (key: string) => string; accounts: AccountView[]; onAccounts: (next: AccountView[]) => void }) {
  const [flags, setFlags] = useState<{ allowWrite: boolean; requireConfirm: boolean } | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [method, setMethod] = useState<'pat' | 'oauth'>('pat')
  const [token, setToken] = useState('')
  const [label, setLabel] = useState('')
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [oauthFlow, setOauthFlow] = useState<{ verificationUri: string; userCode: string } | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
    }
  }, [])

  // 首次展开时拉一次 state；之后账号变更由父级同步进来。
  const ensureLoaded = useCallback(async () => {
    if (flags !== null) return
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>('/state')
      if (data.ok && data.state) {
        setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm })
        onAccounts(data.state.accounts)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [flags, onAccounts])

  const applySettings = async (patch: Record<string, unknown>) => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState; error?: string }>('/settings', patch)
      if (data.ok && data.state) {
        onAccounts(data.state.accounts)
        if (data.state.settings) setFlags({ allowWrite: data.state.settings.allowWrite, requireConfirm: data.state.settings.requireConfirm })
        return data.state
      }
      setError(data.error ?? t('detectFailed'))
    } catch (err) {
      setError((err as Error).message)
    }
    return null
  }

  const toggleFlag = async (key: 'allowWrite' | 'requireConfirm', value: boolean) => {
    await applySettings({ [key]: value })
  }

  const connectPat = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string; state?: PanelState }>('/pat/connect', { token, label })
      if (data.ok && data.state) {
        onAccounts(data.state.accounts)
        setConnectOpen(false)
        setToken('')
      } else {
        setError(data.error ?? t('injectFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startOauth = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{
        ok: boolean
        error?: string
        pollKey?: string
        flow?: { userCode: string; verificationUri: string }
      }>('/oauth/start', { clientId })
      if (!data.ok || !data.pollKey || !data.flow) {
        setError(data.error ?? t('detectFailed'))
        return
      }
      setOauthFlow({ userCode: data.flow.userCode, verificationUri: data.flow.verificationUri })
      const pollKey = data.pollKey
      pollRef.current = window.setInterval(async () => {
        try {
          const res = await api<{ ok: boolean; status?: string; state?: PanelState; error?: string }>('/oauth/poll', { pollKey })
          if (res.status === 'authorized' && res.state) {
            if (pollRef.current !== null) window.clearInterval(pollRef.current)
            onAccounts(res.state.accounts)
            setConnectOpen(false)
            setOauthFlow(null)
          } else if (res.status === 'denied' || res.status === 'expired' || res.status === 'error') {
            if (pollRef.current !== null) window.clearInterval(pollRef.current)
            setError(res.error ?? t('injectFailed'))
            setOauthFlow(null)
          }
        } catch {
          /* 网络抖动：下一轮再试 */
        }
      }, 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const accountAction = async (action: 'remove' | 'recheck', id: string) => {
    try {
      const data = await api<{ ok: boolean; state?: PanelState }>(`/accounts/${action}`, { id })
      if (data.state) onAccounts(data.state.accounts)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="dgp-sect" onPointerEnter={() => void ensureLoaded()}>
      <details
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) void ensureLoaded()
        }}
      >
        <summary className="dgp-sect-title" style={{ cursor: 'pointer' }}>{t('gear')}</summary>
        {error && <div className="dgp-empty" role="alert">{error} <button type="button" className="dgp-iconbtn" aria-label={t('close')} onClick={() => setError('')}><CloseGlyph /></button></div>}

        <div className="dgp-sect-title" style={{ marginTop: 6 }}>{t('account')}</div>
        {accounts.map((account) => (
          <div key={account.id} className="dgp-account">
            <Dot state={account.status} />
            <span className="dgp-acct-login" title={account.login}>{account.login}</span>
            <span className="dgp-muted">{account.kind === 'oauth' ? 'OAuth' : 'PAT'} · {t(account.status === 'expired' ? 'acctExpired' : account.status === 'error' ? 'acctError' : 'acctConnected')}</span>
            <span className="dgp-spacer" />
            <button type="button" className="dgp-btn" onClick={() => void accountAction('recheck', account.id)}>{t('recheck')}</button>
            <button type="button" className="dgp-btn" onClick={() => void accountAction('remove', account.id)}>{t('disconnect')}</button>
          </div>
        ))}
        {accounts.length === 0 && <div className="dgp-empty">{t('noAccount')}</div>}
        <button type="button" className="dgp-btn" style={{ marginTop: 6 }} onClick={() => setConnectOpen(!connectOpen)}>{t('connectAccount')}</button>
        {connectOpen && (
          <div className="dgp-card">
            <div className="dgp-btnrow" style={{ marginBottom: 8 }}>
              <button type="button" className="dgp-btn" onClick={() => setMethod('pat')} style={method === 'pat' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodPat')}</button>
              <button type="button" className="dgp-btn" onClick={() => setMethod('oauth')} style={method === 'oauth' ? { borderColor: 'var(--dsh-accent, #4a9eff)' } : undefined}>{t('methodOauth')}</button>
            </div>
            {method === 'pat' ? (
              <>
                <div className="dgp-sect-title">{t('tokenLabel')}</div>
                <input className="dgp-input" type="password" autoComplete="off" aria-label={t('tokenLabel')} placeholder={t('tokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
                <div className="dgp-sect-title" style={{ marginTop: 6 }}>{t('labelLabel')}</div>
                <input className="dgp-input" aria-label={t('labelLabel')} value={label} onChange={(e) => setLabel(e.target.value)} />
                <div className="dgp-btnrow" style={{ marginTop: 8 }}>
                  <button type="button" className="dgp-btn" disabled={busy || token.trim().length === 0} onClick={() => void connectPat()}>{t('connect')}</button>
                  <button type="button" className="dgp-btn" onClick={() => setConnectOpen(false)}>{t('cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <div className="dgp-sect-title">{t('clientIdLabel')}</div>
                <div className="dgp-muted">{t('clientIdHint')}</div>
                <input className="dgp-input" aria-label={t('clientIdLabel')} value={clientId} onChange={(e) => setClientId(e.target.value)} />
                {oauthFlow ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="dgp-muted">{t('userCode')}</div>
                    <div className="dgp-file"><a href={oauthFlow.verificationUri} target="_blank" rel="noreferrer">{oauthFlow.verificationUri}</a></div>
                    <div className="dgp-code">{oauthFlow.userCode}</div>
                    <div className="dgp-muted">{t('waiting')}</div>
                  </div>
                ) : (
                  <div className="dgp-btnrow" style={{ marginTop: 8 }}>
                    <button type="button" className="dgp-btn" disabled={busy || clientId.trim().length === 0} onClick={() => void startOauth()}>{t('connect')}</button>
                    <button type="button" className="dgp-btn" onClick={() => setConnectOpen(false)}>{t('cancel')}</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <NpmCard t={t} />

        <div style={{ marginTop: 8 }}>
          <label className="dgp-toggle">
            <input type="checkbox" checked={flags?.allowWrite === true} disabled={flags === null} onChange={(e) => void toggleFlag('allowWrite', e.target.checked)} />
            {t('allowWrite')}
          </label>
          <label className="dgp-toggle" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={flags?.requireConfirm !== false} disabled={flags === null} onChange={(e) => void toggleFlag('requireConfirm', e.target.checked)} />
            {t('requireConfirm')}
          </label>
        </div>
      </details>
    </div>
  )
}

// ─── npm 凭据卡（v3.10 多账号 + 切换）：像连 GitHub 账号一样连 npm ───
// 表里可存多个 npm token（node 侧密文），active 账号由 node 同步写入 ~/.npmrc 供 AI 调 npm 工具使用。
// 首次读状态时 node 会把 ~/.npmrc 里既有的官方源 token 惰性收编为首个账号（v3.9/手动 npm login 不断档）。

interface NpmAccountRow {
  id: string
  login: string
  masked: string
  active: boolean
  state: 'connected' | 'error' | 'saved'
  error: string
}

interface NpmStatusView {
  accounts: NpmAccountRow[]
  activeState: 'connected' | 'error'
  activeError: string
  npmrcConfigured: boolean
}

function NpmCard({ t }: { t: (key: string) => string }) {
  const [view, setView] = useState<NpmStatusView | null>(null)
  const [token, setToken] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: boolean; npm?: NpmStatusView }>('/npm/status', {})
      if (data.ok && data.npm) setView(data.npm)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; login?: string; error?: string }>('/npm/connect', { token })
      if (data.ok) {
        setOpen(false)
        setToken('')
        await load()
      } else {
        setError(data.error ?? t('injectFailed'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const switchTo = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string }>('/npm/switch', { id })
      if (!data.ok) setError(data.error ?? t('injectFailed'))
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ ok: boolean; error?: string }>('/npm/remove', { id })
      if (!data.ok) setError(data.error ?? t('injectFailed'))
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const rows = view?.accounts ?? []

  return (
    <div className="dgp-sect">
      <div className="dgp-sect-title">{t('npmAccount')}</div>
      {error && <div className="dgp-empty" role="alert">{error}</div>}
      {rows.map((row) => (
        <div key={row.id} className="dgp-account">
          <Dot state={row.active ? row.state === 'error' ? 'error' : 'connected' : 'connected'} />
          <span className="dgp-acct-login" title={row.login}>{row.login}</span>
          <span className="dgp-muted">{row.active ? t('npmActive') : row.state === 'error' && row.error ? row.error : row.masked}</span>
          <span className="dgp-spacer" />
          {!row.active && (
            <button type="button" className="dgp-btn" disabled={busy} onClick={() => void switchTo(row.id)}>{t('npmSwitch')}</button>
          )}
          <button type="button" className="dgp-btn dgp-btn-danger" disabled={busy} onClick={() => void remove(row.id)}>{t('disconnect')}</button>
        </div>
      ))}
      {rows.length === 0 && <div className="dgp-empty">{t('npmNoAccount')}</div>}
      {rows.length > 0 && view?.activeState === 'error' && (
        <div className="dgp-muted">{t('npmError')}: {view.activeError}</div>
      )}
      {!open && (
        <button type="button" className="dgp-btn" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
          {rows.length === 0 ? t('npmConnect') : t('npmAdd')}
        </button>
      )}
      {open && (
        <div className="dgp-card">
          <div className="dgp-sect-title">{t('npmTokenLabel')}</div>
          <div className="dgp-muted">{t('npmTokenHint')}</div>
          <input className="dgp-input" type="password" autoComplete="off" aria-label={t('npmTokenLabel')} placeholder={t('npmTokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} />
          <div className="dgp-btnrow" style={{ marginTop: 8 }}>
            <button type="button" className="dgp-btn" disabled={busy || token.trim().length === 0} onClick={() => void connect()}>{t('connect')}</button>
            <button type="button" className="dgp-btn" onClick={() => setOpen(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 面板头图标（同一 stroke/weight 的绘制 SVG，替代 Unicode 字符）───

function RefreshGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 1.5v3h-3" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

// ─── 分支 chip：输入框左侧恒显「Git · 分支」，弹层只读状态 + 账号与授权配置 ───

function BranchChip({ t, sessionId, sessions }: { t: (key: string) => string; sessionId: string; sessions?: SessionsService }) {
  useStyles()
  const [status, setStatus] = useState<RepoStatusView | null>(null)
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [detectError, setDetectError] = useState('')
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const chipRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState({ left: 0, bottom: 0 })

  const cwd = useSessionCwd(sessions, sessionId)

  // Escape 关面板（键盘可达性）。
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const reload = useCallback(async () => {
    if (!cwd) {
      setStatus(null)
      setDetectError('')
      return
    }
    setChecking(true)
    try {
      const data = await api<{ ok: boolean; status?: RepoStatusView; error?: string }>(
        `/repo/status?cwd=${encodeURIComponent(cwd)}`,
      )
      if (data.ok && data.status) {
        setStatus(data.status)
        setDetectError('')
        if (data.status.isRepo) {
          const state = await api<{ ok: boolean; state?: PanelState }>('/state').catch(() => null)
          if (state?.state?.accounts) setAccounts(state.state.accounts)
        }
      } else {
        setStatus(null)
        setDetectError(data.error || t('detectFailed'))
      }
    } catch (error) {
      setStatus(null)
      setDetectError((error as Error).message || t('detectFailed'))
    } finally {
      setChecking(false)
    }
  }, [cwd, t])

  // 策略同旧版：cwd 变化 / 窗口聚焦 / 打开面板时刷新，不做轮询。
  useEffect(() => {
    setStatus(null)
    setDetectError('')
    if (!cwd) return
    let alive = true
    const load = () => {
      if (alive && document.visibilityState !== 'hidden') void reload()
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
    }
  }, [cwd, reload])

  const toggle = () => {
    const next = !open
    if (next && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setAnchor({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 392)), bottom: window.innerHeight - rect.top + 6 })
    }
    setOpen(next)
    if (next) {
      void reload()
      // 面板 portal 在 body 末尾：打开即把焦点移入，Tab 顺序才不绕全页（P1-5 审计）。
      requestAnimationFrame(() => panelRef.current?.focus())
    } else {
      chipRef.current?.focus()
    }
  }

  const isRepo = status?.isRepo === true
  const branchLabel = isRepo
    ? status!.detached
      ? `HEAD @ ${status!.head.slice(0, 7)}`
      : status!.branch || '—'
    : '—'

  return (
    <span className="dgp-root" ref={chipRef}>
      <button
        type="button"
        className="dgp-chip"
        title={isRepo ? `Git · ${branchLabel}` : detectError || t('entry')}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? 'dgp-panel' : undefined}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="5" cy="4" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="11" cy="7" r="2" />
          <path d="M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" />
        </svg>
        <span className="dgp-chip-label">Git</span>
        <span className="dgp-chip-sep" aria-hidden="true">·</span>
        <span className="dgp-chip-branch">
          {checking && !status ? '…' : branchLabel}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id="dgp-panel"
            tabIndex={-1}
            role="dialog"
            aria-label={t('panelTitle')}
            className="dgp-panel"
            style={{ left: anchor.left, bottom: anchor.bottom }}
            onMouseLeave={() => {
              // 折叠区里有输入焦点时不因鼠标离开关闭（避免填一半令牌就掉面板）。
              const active = document.activeElement
              if (active && panelRef.current?.contains(active)) return
              setOpen(false)
            }}
          >
            <div className="dgp-head">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="5" cy="4" r="2" /><circle cx="5" cy="12" r="2" /><circle cx="11" cy="7" r="2" />
                <path d="M5 6v4M7 7h2M11 9v1a3 3 0 0 1-3 3H7" />
              </svg>
              <span className="dgp-title">{t('panelTitle')}</span>
              <span className="dgp-spacer" />
              <button type="button" className="dgp-iconbtn" title={t('refresh')} aria-label={t('refresh')} onClick={() => void reload()}><RefreshGlyph /></button>
              <button type="button" className="dgp-iconbtn" title={t('close')} aria-label={t('close')} onClick={() => setOpen(false)}><CloseGlyph /></button>
            </div>

            {detectError && !isRepo && (
              <div className="dgp-sect">
                <div className="dgp-empty">{detectError} <button type="button" className="dgp-btn" onClick={() => void reload()}>{t('retry')}</button></div>
              </div>
            )}

            {!isRepo && !detectError && cwd && (
              <div className="dgp-sect">
                <div className="dgp-empty">{t('notRepo')}</div>
                <div className="dgp-muted">{t('notRepoHint')}</div>
              </div>
            )}

            <GearSection t={t} accounts={accounts} onAccounts={setAccounts} />
          </div>,
          document.body,
        )}
    </span>
  )
}

export function apply(ctx: ClientContext): void {
  let t: (key: string) => string = (key: string) => ZH[key] ?? EN[key] ?? key
  try {
    ctx.locale?.register?.(NS, { zh: ZH, en: EN })
    const bound = ctx.locale?.bind?.(NS)
    if (typeof bound === 'function') {
      t = (key: string) => {
        const value = bound(key)
        return typeof value === 'string' && value.length > 0 && value !== key ? value : ZH[key] ?? key
      }
    }
  } catch (error) {
    ctx.logger?.warn?.(`[${NS}] locale 注册失败：${String(error)}`)
  }

  const sessions = ctx.sessions

  // v3.2 拍板：不注册 settings.section —— 全部设置并入 chip 弹层的「账号与授权」折叠区。
  // 输入框左侧 chip。
  try {
    ctx.slots?.inject?.('conversation.input.left', () => {
      try {
        return ctx.slots?.register?.(
          {
            name: 'conversation.input.left',
            id: 'dsh-git-panel-branch',
            order: 30,
            locale: NS,
            inject: (sessionId: string) => ({ t, sessionId, sessions }),
          },
          BranchChip,
        )
      } catch (error) {
        ctx.logger?.error?.(`[${NS}] 入口注册失败：${String(error)}`)
        return undefined
      }
    })
    ctx.logger?.info?.(`[${NS}] 分支 chip 已注册（${BUILD}）`)
  } catch (error) {
    ctx.logger?.error?.(`[${NS}] conversation.input.left 注入失败：${String(error)}`)
  }
}