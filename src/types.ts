/** node 半边只依赖宿主注入的最小面，避免静态 import @deepseek-ai/* （profile 里不可见）。 */
export interface Logger {
  info?: (message: string) => void
  warn?: (message: string) => void
  error?: (message: string) => void
}

export interface WebServerRegisterOptions {
  kind: 'prefix' | 'exact'
  path: string
  handler: (req: any, res: any) => void | Promise<void>
}

/** 宿主 llm 服务的最小面：只用到「准备一次调用 + 拿回流的入口」。 */
export interface LlmServiceLike {
  prepareCall: (config: Record<string, unknown>, signal?: unknown, configure?: unknown) => Promise<any>
}

/** 宿主默认模型选择服务的最小面（跟随会话默认模型）。 */
export interface DefaultModelServiceLike {
  currentSelection: () => { provider: string; model: string }
}

export interface Context {
  logger?: Logger
  effect?: (fn: () => (() => void) | void, label?: string) => void
  get?: (name: string) => any
  webServer?: {
    register?: (options: WebServerRegisterOptions) => (() => void) | void
  }
  /** 宿主模型服务（软取：ctx.get('llm')）。缺失时「生成提交信息」降级为不可用。 */
  llm?: LlmServiceLike
  /** 宿主默认模型选择（软取：ctx.get('agentDefaultModel')）。 */
  agentDefaultModel?: DefaultModelServiceLike
}
