/**
 * chip 后置的两个页面（BUILD dgp-v17 引入，dgp-v18 沿用；完全重写）。
 *
 * 1) 初始化向导：旧版是「账号 → 仓库 → 分支 → 确认 → 结果」五步 stepper，
 *    每步都要点一次「下一步」。新版改成**单页表单 + 右侧实时计划预览**：
 *    左边一次填完，右边随时看到「点下去会执行什么」，只有执行与结果两个状态。
 * 2) 当前分支详情：旧版是平铺的提交行列表。新版改成**时间线**：
 *    左侧竖线串起节点，每行「主题 → 短哈希 · 作者 · 时间」，更接近看历史的心智。
 *
 * 数据契约不变：GET /account/repos、POST /repo/bootstrap、POST /repo/init、GET /repo/commits?ref=
 */
import { useEffect, useState } from 'react'
import {
  api,
  fmt,
  EmptyState,
  Skeleton,
  type AccountView,
  type AccountRepoView,
} from './shared.js'
import { Modal } from './workbench.js'

interface InitWizardProps {
  t: (key: string) => string
  cwd: string
  accounts: AccountView[]
  /** 账号 → 已授权仓库（owner/repo）列表，用于在列举失败时仍可选择。 */
  authorizedRepos: (accountId: string) => string[]
  /** 宿主快捷键服务：无账号时用它直接打开设置页去连接账号。 */
  shortcuts?: { registry?: { invoke?: (id: string, context: any) => void } }
  /** 没有可用账号时的兜底：只做本地初始化（POST /repo/init）。 */
  onQuickInit: () => void
  onClose: () => void
  onDone: () => void
}

/**
 * 初始化向导（单页版）。
 * 左列是表单，右列是实时计划：用户不用点五步就能看清会发生什么。
 */
export function InitWizard({ t, cwd, accounts, authorizedRepos, onQuickInit, onClose, onDone }: InitWizardProps) {
  const [accountId, setAccountId] = useState('')
  const [repos, setRepos] = useState<AccountRepoView[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState('')
  const [remoteMode, setRemoteMode] = useState<'existing' | 'new'>('existing')
  const [repoFullName, setRepoFullName] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [branchName, setBranchName] = useState('main')
  const [commitMessage, setCommitMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ root: string; branch: string; remoteName: string; remoteUrl: string; steps: string[] } | null>(null)
  /** 就地新建远程仓库：省掉「先去网页建、再回来刷新」这一跳。 */
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPrivate, setCreatePrivate] = useState(true)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')

  /** 默认选第一个账号，少一次点击。 */
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  /** 拉该账号的远程仓库（失败降级为手填 owner/repo 或直接填地址）。 */
  useEffect(() => {
    if (!accountId) {
      setRepos([])
      return
    }
    let alive = true
    setReposLoading(true)
    setReposError('')
    api<{ ok: boolean; repos?: AccountRepoView[]; error?: string }>(`/account/repos?accountId=${encodeURIComponent(accountId)}`)
      .then((data) => {
        if (!alive) return
        if (!data.ok) {
          setRepos([])
          setReposError(data.error || t('reposFailed'))
          return
        }
        setRepos(Array.isArray(data.repos) ? data.repos : [])
      })
      .catch((err: Error) => {
        if (!alive) return
        setRepos([])
        setReposError(err.message || t('reposFailed'))
      })
      .finally(() => {
        if (alive) setReposLoading(false)
      })
    return () => {
      alive = false
    }
  }, [accountId, t])

  const selectedRepo = repos.find((item) => item.fullName === repoFullName)
  const manualRepos = accountId ? authorizedRepos(accountId) : []
  const defaultBranch = selectedRepo?.defaultBranch || 'main'

  /** 分支名跟随选中仓库的默认分支（用户没手改过就跟，改了就不动）。 */
  useEffect(() => {
    if (branchName === '' || branchName === 'main' || branchName === defaultBranch) setBranchName(defaultBranch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBranch])

  const remoteReady = remoteMode === 'existing' ? repoFullName.trim() !== '' : remoteUrl.trim() !== ''
  const canSubmit = accountId !== '' && remoteReady && branchName.trim() !== '' && !busy && !result

  const runBootstrap = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api<{
        ok: boolean
        error?: string
        root?: string
        branch?: string
        remoteName?: string
        remoteUrl?: string
        steps?: string[]
      }>('/repo/bootstrap', {
        cwd,
        accountId,
        remoteMode,
        ...(remoteMode === 'existing' ? { repoFullName: repoFullName.trim() } : { remoteUrl: remoteUrl.trim() }),
        branchMode: 'new',
        branchName: branchName.trim(),
        ...(commitMessage.trim() ? { initialCommitMessage: commitMessage.trim() } : {}),
      })
      if (!data.ok) {
        setError(data.error || t('initFailed'))
        return
      }
      setResult({
        root: data.root ?? cwd,
        branch: data.branch ?? branchName.trim(),
        remoteName: data.remoteName ?? 'origin',
        remoteUrl: data.remoteUrl ?? (remoteMode === 'new' ? remoteUrl.trim() : ''),
        steps: Array.isArray(data.steps) ? data.steps : [],
      })
      onDone()
    } catch (err) {
      setError((err as Error).message || t('initFailed'))
    } finally {
      setBusy(false)
    }
  }

  /** 在当前账号下就地新建远程仓库，建完自动选中它（node 侧会顺手授 full）。 */
  const runCreateRepo = async () => {
    setCreateBusy(true)
    setCreateError('')
    try {
      const data = await api<{
        ok: boolean
        error?: string
        repo?: { fullName: string; name: string; url: string; defaultBranch: string; private: boolean }
      }>('/repo/create', {
        cwd,
        accountId,
        name: createName.trim(),
        private: createPrivate,
      })
      if (!data.ok || !data.repo) {
        setCreateError(data.error || t('repoCreateFailed'))
        return
      }
      const created: AccountRepoView = {
        fullName: data.repo.fullName,
        name: data.repo.name,
        owner: data.repo.fullName.split('/').slice(0, -1).join('/'),
        url: data.repo.url,
        private: data.repo.private,
        defaultBranch: data.repo.defaultBranch,
        permission: 'full',
      }
      setRepos((prev) => (prev.some((item) => item.fullName === created.fullName) ? prev : [created, ...prev]))
      setRemoteMode('existing')
      setRepoFullName(created.fullName)
      setRemoteUrl(created.url)
      setCreateOpen(false)
      setCreateName('')
    } catch (err) {
      setCreateError((err as Error).message || t('repoCreateFailed'))
    } finally {
      setCreateBusy(false)
    }
  }

  // 没有账号：只能本地初始化，直接给最省事的出口。
  if (accounts.length === 0) {
    return (
      <Modal title={t('initTitle')} onClose={onClose} width={480}
        footer={
          <>
            <button type="button" className="dgp-btn" onClick={onClose}>{t('initCancel')}</button>
            <button type="button" className="dgp-btn primary" disabled={busy} onClick={onQuickInit}>{t('initQuickLocal')}</button>
          </>
        }
      >
        <EmptyState title={t('initNoAccount')} hint={t('initManualRepoHint')} />
      </Modal>
    )
  }

  return (
    <Modal
      title={t('initTitle')}
      onClose={onClose}
      width={860}
      footer={
        <>
          <button type="button" className="dgp-btn" onClick={onClose}>{t('initCancel')}</button>
          {result ? (
            <button type="button" className="dgp-btn primary" onClick={onClose}>{t('initClose')}</button>
          ) : (
            <button type="button" className="dgp-btn primary" disabled={!canSubmit} onClick={() => void runBootstrap()}>
              {busy ? t('initRunning') : t('initStart')}
            </button>
          )}
        </>
      }
    >
      <div className="dgp-iw">
        {/* 左：一次填完 */}
        <div className="dgp-iw-left">
          <section className="dgp-iw-sect">
            <div className="dgp-iw-secthead">{t('initStepAccount')}</div>
            <ul className="dgp-options">
              {accounts.map((account) => (
                <li key={account.id}>
                  <label className="dgp-option" data-on={accountId === account.id ? '1' : '0'}>
                    <input
                      type="radio"
                      name="dgp-iw-account"
                      checked={accountId === account.id}
                      onChange={() => {
                        setAccountId(account.id)
                        setRepoFullName('')
                        setRemoteMode('existing')
                      }}
                    />
                    <span className="dgp-option-main">
                      <span className="dgp-option-title">{account.login || account.displayName || account.id}</span>
                      <span className="dgp-option-hint">{account.provider} · {account.kind === 'oauth' ? 'OAuth' : 'PAT'} · {account.status}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="dgp-iw-sect">
            <div className="dgp-iw-secthead">{t('initStepRemote')}</div>
            {reposLoading ? <Skeleton rows={2} /> : null}
            {!reposLoading && reposError ? <div className="dgp-err">{fmt(t('initRepoListFailed'), { reason: reposError })}</div> : null}
            {!reposLoading && !reposError && repos.length === 0 ? <div className="dgp-hint">{t('initRepoListEmpty')}</div> : null}
            {!reposLoading && repos.length > 0 ? (
              <ul className="dgp-options">
                {repos.slice(0, 30).map((repo) => (
                  <li key={repo.fullName}>
                    <label className="dgp-option" data-on={remoteMode === 'existing' && repoFullName === repo.fullName ? '1' : '0'}>
                      <input
                        type="radio"
                        name="dgp-iw-repo"
                        checked={remoteMode === 'existing' && repoFullName === repo.fullName}
                        onChange={() => {
                          setRemoteMode('existing')
                          setRepoFullName(repo.fullName)
                        }}
                      />
                      <span className="dgp-option-main">
                        <span className="dgp-option-title">{repo.fullName}</span>
                        <span className="dgp-option-hint">
                          {repo.private ? t('repoPrivate') : t('repoPublic')} ·{' '}
                          {fmt(t('repoDefaultBranch'), { branch: repo.defaultBranch || '-' })}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            {!reposLoading && manualRepos.length > 0 && repos.length === 0 ? (
              <ul className="dgp-options">
                {manualRepos.map((fullName) => (
                  <li key={fullName}>
                    <label className="dgp-option" data-on={remoteMode === 'existing' && repoFullName === fullName ? '1' : '0'}>
                      <input
                        type="radio"
                        name="dgp-iw-repo-manual"
                        checked={remoteMode === 'existing' && repoFullName === fullName}
                        onChange={() => {
                          setRemoteMode('existing')
                          setRepoFullName(fullName)
                        }}
                      />
                      <span className="dgp-option-main">
                        <span className="dgp-option-title">{fullName}</span>
                        <span className="dgp-option-hint">{t('initAuthorizedRepos')}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="dgp-iw-actions">
              <button
                type="button"
                className="dgp-gw-textbtn"
                data-on={remoteMode === 'new' ? '1' : '0'}
                onClick={() => setRemoteMode(remoteMode === 'new' ? 'existing' : 'new')}
              >
                {remoteMode === 'new' ? '✓ ' : '+ '}
                {t('initNewRemote')}
              </button>
              <button
                type="button"
                className="dgp-gw-textbtn"
                data-on={createOpen ? '1' : '0'}
                onClick={() => {
                  setCreateOpen(!createOpen)
                  setCreateError('')
                  if (!createOpen && !createName) {
                    // 用目录名做默认仓库名：多数情况下就是想把这个项目推上去。
                    const guess = cwd.split(/[\\/]/).filter(Boolean).pop() || ''
                    setCreateName(guess)
                  }
                }}
              >
                {createOpen ? '✓ ' : '+ '}
                {t('repoCreateOpen')}
              </button>
            </div>
            {createOpen ? (
              <div className="dgp-iw-create">
                <input
                  className="dgp-input"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder={t('repoCreateName')}
                  aria-label={t('repoCreateName')}
                />
                <label className="dgp-check">
                  <input type="checkbox" checked={createPrivate} onChange={(event) => setCreatePrivate(event.target.checked)} />
                  <span>{t('repoCreatePrivate')}</span>
                </label>
                <button
                  type="button"
                  className="dgp-btn primary"
                  disabled={createBusy || createName.trim() === '' || accountId === ''}
                  onClick={() => void runCreateRepo()}
                >
                  {createBusy ? t('repoCreating') : t('repoCreateSubmit')}
                </button>
              </div>
            ) : null}
            {createOpen ? (
              <div className="dgp-hint">{fmt(t('repoCreateHint'), { account: accounts.find((item) => item.id === accountId)?.login || '-' })}</div>
            ) : null}
            {createOpen && createError ? <div className="dgp-err">{createError}</div> : null}
            {remoteMode === 'new' ? (
              <label className="dgp-field">
                <span className="dgp-label">{t('initRemoteUrl')}</span>
                <input className="dgp-input" value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://github.com/user/repo.git" />
                <span className="dgp-hint">{t('initRemoteUrlHint')}</span>
              </label>
            ) : null}
          </section>

          <section className="dgp-iw-sect">
            <div className="dgp-iw-secthead">{t('initStepBranch')}</div>
            <div className="dgp-iw-grid2">
              <label className="dgp-field">
                <span className="dgp-label">{t('initBranchName')}</span>
                <input className="dgp-input" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder={defaultBranch} />
              </label>
              <label className="dgp-field">
                <span className="dgp-label">{t('initCommitMessage')}</span>
                <input className="dgp-input" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="chore: init" />
              </label>
            </div>
            <div className="dgp-hint">{t('initNoBranches')}</div>
          </section>
        </div>

        {/* 右：实时计划 + 结果 */}
        <aside className="dgp-iw-right">
          {error ? (
            <>
              <div className="dgp-iw-secthead" data-tone="error">{t('initFailed')}</div>
              <div className="dgp-err">{error}</div>
            </>
          ) : null}

          {result ? (
            <>
              <div className="dgp-iw-secthead" data-tone="ok">{t('initSuccess')}</div>
              <dl className="dgp-kv">
                <dt>{t('initResultRoot')}</dt>
                <dd>{result.root}</dd>
                <dt>{t('initResultBranch')}</dt>
                <dd>{result.branch}</dd>
                <dt>{t('initResultRemote')}</dt>
                <dd>{result.remoteUrl || '-'}</dd>
              </dl>
              {result.steps.length > 0 ? (
                <>
                  <div className="dgp-iw-secthead">{t('initStepsTitle')}</div>
                  <ul className="dgp-plan">
                    {result.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="dgp-iw-secthead">{t('initConfirmTitle')}</div>
              <ul className="dgp-plan">
                <li>{t('initPlanInit')}</li>
                <li>
                  {t('initPlanRemote')}
                  {remoteMode === 'existing'
                    ? repoFullName.trim() ? ` · ${repoFullName.trim()}` : ''
                    : remoteUrl.trim() ? ` · ${remoteUrl.trim()}` : ''}
                </li>
                <li>{fmt(t('initPlanBranch'), { branch: branchName.trim() || defaultBranch })}</li>
                {commitMessage.trim() ? <li>{t('initPlanCommit')}</li> : null}
              </ul>
              {!remoteReady ? <div className="dgp-hint">{t('initRepoRequired')}</div> : null}
            </>
          )}
        </aside>
      </div>
    </Modal>
  )
}

interface BranchCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  subject: string
  refs: string
  parents: string[]
}

/** 当前分支详情：时间线（竖线 + 节点 + 紧凑行）。 */
export function BranchDetailModal({ t, cwd, branch, onClose }: { t: (key: string) => string; cwd: string; branch: string; onClose: () => void }) {
  const [commits, setCommits] = useState<BranchCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api<{ ok: boolean; commits?: BranchCommit[]; truncated?: boolean; error?: string }>(
      `/repo/commits?cwd=${encodeURIComponent(cwd)}&ref=${encodeURIComponent(branch)}`,
    )
      .then((data) => {
        if (!alive) return
        if (!data.ok) {
          setError(data.error || t('branchDetailFailed'))
          setCommits([])
          return
        }
        setCommits(Array.isArray(data.commits) ? data.commits : [])
        setTruncated(data.truncated === true)
      })
      .catch((err: Error) => {
        if (!alive) return
        setError(err.message || t('branchDetailFailed'))
        setCommits([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [cwd, branch, t])

  return (
    <Modal
      title={`${t('branchDetailTitle')} · ${branch}`}
      onClose={onClose}
      width={620}
      footer={<button type="button" className="dgp-btn" onClick={onClose}>{t('branchDetailClose')}</button>}
    >
      {loading ? <Skeleton rows={5} /> : null}
      {!loading && error ? <div className="dgp-err">{t('branchDetailFailed')}：{error}</div> : null}
      {!loading && !error && commits.length === 0 ? <EmptyState title={t('branchDetailEmpty')} hint={t('branchDetailEmptyHint')} /> : null}
      {!loading && !error && commits.length > 0 ? (
        <>
          <ol className="dgp-tl">
            {commits.map((commit, index) => (
              <li className="dgp-tl-item" key={commit.hash || commit.shortHash} data-first={index === 0 ? '1' : '0'}>
                <span className="dgp-tl-node" aria-hidden="true" />
                <div className="dgp-tl-main">
                  <div className="dgp-tl-subject" title={commit.subject}>{commit.subject || '(no subject)'}</div>
                  <div className="dgp-tl-meta">
                    <code className="dgp-tl-hash">{commit.shortHash || commit.hash.slice(0, 7)}</code>
                    <span className="dgp-tl-author">{commit.author}</span>
                    <time className="dgp-tl-date">{commit.date}</time>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {truncated ? <div className="dgp-hint">{fmt(t('branchDetailTruncated'), { n: commits.length })}</div> : null}
        </>
      ) : null}
    </Modal>
  )
}
