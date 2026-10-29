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

export interface Context {
  logger?: Logger
  effect?: (fn: () => (() => void) | void, label?: string) => void
  get?: (name: string) => any
  webServer?: {
    register?: (options: WebServerRegisterOptions) => (() => void) | void
  }
}
