import { homedir } from 'node:os'
import { join } from 'node:path'

/** DSH 用户目录（与宿主其它插件保持一致）。 */
export function dshHome(): string {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/** 插件私有数据目录：账号密文、密钥、设置。 */
export function pluginDir(): string {
  return join(dshHome(), 'git-panel')
}

export function stateFile(): string {
  return join(pluginDir(), 'state.json')
}

export function keyFile(): string {
  return join(pluginDir(), 'key.bin')
}
