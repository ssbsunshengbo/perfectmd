import type { BundledLanguage, BundledTheme, Highlighter } from 'shiki'
import { CODE_LANGUAGES, normalizeCodeLanguage } from './code-languages'

const SHIKI_THEMES: BundledTheme[] = ['github-light-default', 'github-dark-default']
const SHIKI_LANGUAGES = CODE_LANGUAGES
  .filter((language) => language !== 'plaintext')
  .map((language) => language as BundledLanguage)

const highlightCache = new Map<string, string>()
let highlighterPromise: Promise<Highlighter> | null = null

function escapeHtml(code: string) {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function resolveCssColor(color: string): string {
  if (typeof document === 'undefined' || !document.body) return color
  const probe = document.createElement('span')
  probe.style.color = color
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color || color
  document.body.removeChild(probe)
  return resolved
}

function normalizeLanguage(language: string): BundledLanguage | null {
  const normalized = normalizeCodeLanguage(language)
  if (!normalized || normalized === 'plaintext') return null
  return SHIKI_LANGUAGES.includes(normalized as BundledLanguage)
    ? normalized as BundledLanguage
    : null
}

function parseRgbChannels(color: string): [number, number, number] | null {
  const normalized = resolveCssColor(color)
  const matched = normalized.match(/[\d.]+/g)
  if (!matched || matched.length < 3) return null
  const channels = matched.slice(0, 3).map((value) => Math.max(0, Math.min(255, Number(value))))
  if (channels.some(Number.isNaN)) return null
  return [channels[0], channels[1], channels[2]]
}

function isDarkBackground(color: string): boolean {
  const rgb = parseRgbChannels(color)
  if (!rgb) return false

  const [r, g, b] = rgb.map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
  return luminance < 0.45
}

function resolveTheme(backgroundColor: string): BundledTheme {
  return isDarkBackground(backgroundColor) ? 'github-dark-default' : 'github-light-default'
}

function extractCodeInnerHtml(highlightedHtml: string): string {
  if (typeof document === 'undefined') {
    const matched = highlightedHtml.match(/<code[^>]*>([\s\S]*)<\/code>/i)
    return matched?.[1] || ''
  }

  const template = document.createElement('template')
  template.innerHTML = highlightedHtml.trim()
  return template.content.querySelector('code')?.innerHTML || ''
}

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) => createHighlighter({
      themes: SHIKI_THEMES,
      langs: SHIKI_LANGUAGES,
    }))
  }

  return highlighterPromise
}

export async function warmupCodeHighlighter() {
  await getHighlighter()
}

function rememberHighlight(cacheKey: string, html: string) {
  highlightCache.set(cacheKey, html)
  if (highlightCache.size <= 120) return

  const oldestKey = highlightCache.keys().next().value
  if (oldestKey) {
    highlightCache.delete(oldestKey)
  }
}

export function escapeCodeHtml(code: string) {
  return escapeHtml(code)
}

export async function highlightCodeToInlineHtml(code: string, language: string, backgroundColor: string) {
  const theme = resolveTheme(backgroundColor)
  const normalizedLanguage = normalizeLanguage(language)

  if (!code.trim() || !normalizedLanguage) {
    return {
      html: escapeHtml(code),
      highlighted: false,
      theme,
      language: 'plaintext',
    }
  }

  const cacheKey = `${theme}\u0000${normalizedLanguage}\u0000${code}`
  const cached = highlightCache.get(cacheKey)
  if (cached) {
    return {
      html: cached,
      highlighted: true,
      theme,
      language: normalizedLanguage,
    }
  }

  const highlighter = await getHighlighter()
  const html = extractCodeInnerHtml(highlighter.codeToHtml(code, {
    lang: normalizedLanguage,
    theme,
  }))

  rememberHighlight(cacheKey, html)

  return {
    html,
    highlighted: true,
    theme,
    language: normalizedLanguage,
  }
}
