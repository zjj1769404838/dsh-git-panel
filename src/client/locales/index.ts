import type { Dict } from '../shared.js'
import { ja } from './ja.js'
import { es } from './es.js'
import { fr } from './fr.js'
import { de } from './de.js'
import { ru } from './ru.js'
import { pt } from './pt.js'

/** 除 zh / en 之外的语言字典；键集合与 ZH 完全一致（gates 有断言）。 */
export const EXTRA_LOCALES: Record<string, Dict> = {
  ja,
  es,
  fr,
  de,
  ru,
  pt,
}

/** 宿主 locale 服务的 addLanguage 入参：fallback 必须能落到 en。 */
export const EXTRA_LANGUAGES: Array<{ id: string; label: string; fallback: string }> = [
  { id: 'ja', label: '日本語', fallback: 'en' },
  { id: 'es', label: 'Español', fallback: 'en' },
  { id: 'fr', label: 'Français', fallback: 'en' },
  { id: 'de', label: 'Deutsch', fallback: 'en' },
  { id: 'ru', label: 'Русский', fallback: 'en' },
  { id: 'pt', label: 'Português', fallback: 'en' },
]
