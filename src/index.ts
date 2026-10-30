import type { Context } from './types.js'
import { PanelStore } from './node/store.js'
import { createHandler, ROUTE_PREFIX } from './node/handler.js'
import { registerGitTools } from './node/tools.js'
import { redact } from './node/vault.js'

export const name = '@zjj/dsh-git-panel'
export const inject = ['webServer']
export const PLUGIN_VERSION = '0.1.0'

/**
 * node 半边：注册 HTTP 接口（供输入框入口的面板调用）+ 把 Git 操作注册成 Agent 工具。
 * 工具服务可能不存在（例如 web 层禁用了 agent 平面），因此用 ctx.get 软取并容错。
 */
export function apply(ctx: Context): void {
  const store = new PanelStore()
  const log = (level: string, message: string) => {
    const text = redact(message)
    if (level === 'error') ctx.logger?.error?.(text)
    else if (level === 'warn') ctx.logger?.warn?.(text)
    else ctx.logger?.info?.(text)
  }

  const handler = createHandler({ store, version: PLUGIN_VERSION, log })

  ctx.effect(() => {
    const disposer = ctx.webServer?.register?.({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler,
    })
    log('info', `已注册接口 ${ROUTE_PREFIX}/*`)
    return () => {
      if (typeof disposer === 'function') disposer()
    }
  }, '@zjj/dsh-git-panel:http')

  ctx.effect(() => {
    const dispose = registerGitTools({
      store,
      tools: ctx.get?.('tools'),
      log,
    })
    return dispose
  }, '@zjj/dsh-git-panel:tools')
}
