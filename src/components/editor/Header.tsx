'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Save, Palette, Download, FileDown } from 'lucide-react'
import { saveAsMarkdown, exportAsPdf } from '@/lib/document-export'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const CUSTOM_THEME_KEY = 'perfectmd-custom-theme-css'
const CUSTOM_THEME_STYLE_ID = 'perfectmd-custom-theme-style'
const TYPOGRAPHY_PARAMS_KEY = 'perfectmd-typography-params'
const TYPOGRAPHY_PARAMS_STYLE_ID = 'perfectmd-typography-params-style'

interface TypographyParams {
  fontSize: number       // px
  lineHeight: number     // ratio
  paragraphSpacing: number // em, margin between paragraphs
  letterSpacing: number  // em
  h1Size: number         // em relative to base
  h2Size: number
  h3Size: number
}

const DEFAULT_TYPOGRAPHY: TypographyParams = {
  fontSize: 17,
  lineHeight: 1.68,
  paragraphSpacing: 0.55,
  letterSpacing: 0,
  h1Size: 2.0,
  h2Size: 1.5,
  h3Size: 1.25,
}

const loadTypographyParams = (): TypographyParams => {
  if (typeof window === 'undefined') return DEFAULT_TYPOGRAPHY
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_PARAMS_KEY)
    if (!raw) return DEFAULT_TYPOGRAPHY
    const parsed = JSON.parse(raw) as Partial<TypographyParams>
    return { ...DEFAULT_TYPOGRAPHY, ...parsed }
  } catch {
    return DEFAULT_TYPOGRAPHY
  }
}

const buildTypographyCss = (p: TypographyParams) => `
.prose-editor {
  font-size: ${p.fontSize}px;
  line-height: ${p.lineHeight};
  letter-spacing: ${p.letterSpacing}em;
}
.prose-editor p {
  line-height: ${p.lineHeight};
  min-height: ${p.lineHeight}em;
  margin-top: ${p.paragraphSpacing}em;
  margin-bottom: ${p.paragraphSpacing}em;
}
.prose-editor h1 { font-size: ${p.h1Size}em; }
.prose-editor h2 { font-size: ${p.h2Size}em; }
.prose-editor h3 { font-size: ${p.h3Size}em; }
`.trim()
const FALLBACK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'
const RELEASE_API_URL = 'https://api.github.com/repos/ssbsunshengbo/perfectmd/releases/latest'

const normalizeVersion = (input: string) => input.replace(/^v/i, '').trim()
const isSemanticVersion = (input: string) => /^\d+(\.\d+){1,3}$/.test(input)
type ReleaseAsset = { name?: string; browser_download_url?: string }

const parseVersionTuple = (input: string): [number, number, number, number] => {
  const normalized = normalizeVersion(input)
  const match = normalized.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return [0, 0, 0, 0]
  return [
    Number(match[1] || 0),
    Number(match[2] || 0),
    Number(match[3] || 0),
    Number(match[4] || 0),
  ]
}

const getRuntimeClientInfo = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  const platform = typeof navigator !== 'undefined' ? (navigator.platform || '').toLowerCase() : ''
  const os = /win/i.test(platform) || ua.includes('windows')
    ? 'windows'
    : /mac/i.test(platform) || ua.includes('mac os')
      ? 'macos'
      : /linux/i.test(platform) || ua.includes('linux')
        ? 'linux'
        : 'unknown'
  const arch = /(arm64|aarch64)/i.test(ua) ? 'arm64' : 'x64'
  return { os, arch }
}

const chooseBestAssetUrl = (assets: ReleaseAsset[], fallbackUrl: string) => {
  if (!assets.length) return fallbackUrl
  const { os, arch } = getRuntimeClientInfo()
  const normalized = assets.map((asset) => ({
    name: String(asset.name || '').toLowerCase(),
    url: String(asset.browser_download_url || ''),
  }))

  const pick = (predicates: Array<(name: string) => boolean>) => {
    for (const predicate of predicates) {
      const found = normalized.find((asset) => asset.url && predicate(asset.name))
      if (found) return found.url
    }
    return ''
  }

  if (os === 'macos') {
    const macUrl = pick([
      (name) =>
        name.endsWith('.dmg') &&
        (arch === 'arm64' ? /(arm64|aarch64)/.test(name) : /(x64|x86_64)/.test(name)),
      (name) => name.endsWith('.dmg') && arch === 'arm64' && !/(x64|x86_64)/.test(name),
      (name) => name.endsWith('.dmg') && arch !== 'arm64' && !/(arm64|aarch64)/.test(name),
      (name) => name.endsWith('.dmg'),
    ])
    if (macUrl) return macUrl
  }

  if (os === 'windows') {
    const windowsUrl = pick([
      (name) => name.endsWith('.msi') && /(x64|x86_64)/.test(name),
      (name) => name.endsWith('.msi'),
      (name) => name.endsWith('.exe'),
    ])
    if (windowsUrl) return windowsUrl
  }

  if (os === 'linux') {
    const linuxUrl = pick([
      (name) => name.endsWith('.deb'),
      (name) => name.endsWith('.appimage'),
      (name) => name.endsWith('.rpm'),
    ])
    if (linuxUrl) return linuxUrl
  }

  return normalized.find((asset) => asset.url)?.url || fallbackUrl
}

const isRemoteVersionNewer = (remote: string, local: string) => {
  const a = parseVersionTuple(remote)
  const b = parseVersionTuple(local)
  const maxLength = Math.max(a.length, b.length)
  for (let i = 0; i < maxLength; i += 1) {
    const av = a[i] || 0
    const bv = b[i] || 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}
const AURORA_TEMPLATE_CSS = `:root {
  --background: #0a0616;
  --foreground: #f5f3ff;
  --card: rgba(20, 16, 34, 0.72);
  --card-foreground: #f8f7ff;
  --border: rgba(196, 181, 253, 0.28);
  --muted: rgba(139, 92, 246, 0.12);
  --muted-foreground: #c4b5fd;
  --accent: rgba(244, 114, 182, 0.16);
  --accent-foreground: #ffd6ef;
  --primary: #a78bfa;
  --primary-foreground: #140f24;

  --pmd-link-color: #7dd3fc;
  --pmd-code-bg: rgba(5, 10, 26, 0.9);
  --pmd-code-fg: #dbeafe;
  --pmd-code-border: rgba(125, 211, 252, 0.35);
  --pmd-table-border: rgba(196, 181, 253, 0.4);
  --pmd-table-header-bg: rgba(167, 139, 250, 0.22);
  --pmd-table-cell-bg: rgba(255, 255, 255, 0.02);
  --pmd-formula-bg: rgba(34, 211, 238, 0.1);
  --pmd-formula-fg: #cffafe;
  --pmd-formula-border: rgba(34, 211, 238, 0.45);
}

body {
  background:
    radial-gradient(1200px 700px at 15% -10%, rgba(217, 70, 239, 0.28), transparent 55%),
    radial-gradient(1200px 700px at 90% 0%, rgba(56, 189, 248, 0.2), transparent 50%),
    linear-gradient(180deg, #090412 0%, #0e1327 55%, #100a1c 100%);
}

.prose-editor p {
  border: 1px solid rgba(196, 181, 253, 0.16);
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
  margin: 0.55rem 0;
  background: rgba(255, 255, 255, 0.015);
}

.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  position: relative;
  padding-left: 0.8rem;
  border-left: 3px solid rgba(244, 114, 182, 0.65);
}

.prose-editor h1 {
  color: #e9d5ff;
  text-shadow: 0 0 12px rgba(167, 139, 250, 0.35);
}

.prose-editor .formula-inline {
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.35), 0 0 10px rgba(34, 211, 238, 0.22);
}
`

const PAPER_SERIF_TEMPLATE_CSS = `:root {
  --background: #f7f2e7;
  --foreground: #2b2a28;
  --card: #fffaf1;
  --card-foreground: #2b2a28;
  --border: #d7c7ab;
  --muted: #efe3ce;
  --muted-foreground: #6d5f4a;
  --accent: #ead0b0;
  --accent-foreground: #3a2f25;
  --primary: #8b5a2b;
  --primary-foreground: #fffaf0;
  --pmd-link-color: #8a3b12;
  --pmd-code-bg: #f4ead9;
  --pmd-code-fg: #2e2a26;
  --pmd-code-border: #cdb898;
  --pmd-table-border: #cdb898;
  --pmd-table-header-bg: #eadcc5;
  --pmd-formula-bg: #f2e6d2;
  --pmd-formula-fg: #3f3327;
  --pmd-formula-border: #c8b292;
}
.prose-editor { font-family: 'Iowan Old Style', 'Times New Roman', serif; }
.prose-editor p {
  border-left: 3px solid rgba(139, 90, 43, 0.28);
  background: rgba(255, 250, 242, 0.55);
  padding: 0.45rem 0.9rem;
  border-radius: 0 10px 10px 0;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  color: #5e3f1b;
  letter-spacing: 0.01em;
}
`

const CYBER_GRID_TEMPLATE_CSS = `:root {
  --background: #06070d;
  --foreground: #d9f8ff;
  --card: rgba(11, 15, 30, 0.78);
  --card-foreground: #d9f8ff;
  --border: rgba(72, 224, 255, 0.3);
  --muted: rgba(44, 111, 255, 0.14);
  --muted-foreground: #9ee7ff;
  --accent: rgba(255, 74, 216, 0.18);
  --accent-foreground: #ffe7fb;
  --primary: #46d8ff;
  --primary-foreground: #021014;
  --pmd-link-color: #4dedff;
  --pmd-code-bg: #020513;
  --pmd-code-fg: #c3f8ff;
  --pmd-code-border: rgba(70, 216, 255, 0.45);
  --pmd-table-border: rgba(70, 216, 255, 0.45);
  --pmd-table-header-bg: rgba(255, 74, 216, 0.16);
  --pmd-formula-bg: rgba(70, 216, 255, 0.1);
  --pmd-formula-fg: #9cf4ff;
  --pmd-formula-border: rgba(70, 216, 255, 0.5);
}
body {
  background:
    linear-gradient(rgba(70,216,255,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70,216,255,0.08) 1px, transparent 1px),
    radial-gradient(circle at 80% -10%, rgba(255, 74, 216, 0.2), transparent 45%),
    #04050b;
  background-size: 26px 26px, 26px 26px, auto, auto;
}
.prose-editor p {
  border: 1px solid rgba(70, 216, 255, 0.3);
  box-shadow: inset 0 0 0 1px rgba(255, 74, 216, 0.12);
  border-radius: 6px;
  padding: 0.45rem 0.65rem;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  text-shadow: 0 0 10px rgba(70, 216, 255, 0.45);
}
`

const NOIR_GLASS_TEMPLATE_CSS = `:root {
  --background: #0b0e14;
  --foreground: #e7ecf4;
  --card: rgba(18, 24, 38, 0.8);
  --card-foreground: #e7ecf4;
  --border: rgba(146, 163, 190, 0.26);
  --muted: rgba(120, 141, 173, 0.12);
  --muted-foreground: #aec0dd;
  --accent: rgba(99, 102, 241, 0.2);
  --accent-foreground: #e5e7ff;
  --primary: #8b9bff;
  --primary-foreground: #0e1220;
  --pmd-link-color: #8ec5ff;
  --pmd-code-bg: #121a2a;
  --pmd-code-fg: #d7e2ff;
  --pmd-code-border: rgba(151, 170, 211, 0.35);
  --pmd-table-border: rgba(151, 170, 211, 0.35);
  --pmd-table-header-bg: rgba(84, 103, 151, 0.26);
  --pmd-formula-bg: rgba(120, 144, 206, 0.12);
  --pmd-formula-fg: #d5e3ff;
  --pmd-formula-border: rgba(146, 167, 222, 0.44);
}
body {
  background:
    radial-gradient(circle at 8% -20%, rgba(114, 142, 255, 0.25), transparent 44%),
    radial-gradient(circle at 92% 0%, rgba(76, 105, 180, 0.18), transparent 40%),
    linear-gradient(180deg, #090c13 0%, #101826 100%);
}
.prose-editor p {
  border: 1px solid rgba(146, 163, 190, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(2px);
  padding: 0.48rem 0.75rem;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  letter-spacing: 0.012em;
  text-shadow: 0 8px 26px rgba(124, 148, 255, 0.2);
}
`

const OCEAN_PASTEL_TEMPLATE_CSS = `:root {
  --background: #eef7fb;
  --foreground: #153447;
  --card: rgba(255, 255, 255, 0.84);
  --card-foreground: #153447;
  --border: #bcd9e6;
  --muted: #dbedf4;
  --muted-foreground: #4e7282;
  --accent: #d2eefe;
  --accent-foreground: #20485d;
  --primary: #2e8fb8;
  --primary-foreground: #ecf8ff;
  --pmd-link-color: #116d9b;
  --pmd-code-bg: #e8f6fb;
  --pmd-code-fg: #1c3f51;
  --pmd-code-border: #a7cfdf;
  --pmd-table-border: #a7cfdf;
  --pmd-table-header-bg: #d3edf7;
  --pmd-formula-bg: #e0f2fa;
  --pmd-formula-fg: #1d4258;
  --pmd-formula-border: #9fc7d9;
}
body {
  background:
    radial-gradient(circle at 12% -16%, rgba(163, 219, 246, 0.65), transparent 42%),
    radial-gradient(circle at 95% 0%, rgba(211, 236, 249, 0.75), transparent 38%),
    #eff8fc;
}
.prose-editor p {
  border-left: 4px solid rgba(46, 143, 184, 0.42);
  border-radius: 0 12px 12px 0;
  background: rgba(255, 255, 255, 0.65);
  padding: 0.48rem 0.8rem;
}
.prose-editor h1, .prose-editor h2, .prose-editor h3 {
  color: #16577a;
  letter-spacing: 0.008em;
}
`

export function Header() {
  const { currentDocument, updateCurrentTitle, saveDocument } = useEditorStore()
  const shownUpdateTagRef = useRef<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [appVersion, setAppVersion] = useState(`v${normalizeVersion(FALLBACK_VERSION)}`)
  const [customCssDraft, setCustomCssDraft] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_THEME_KEY) || '' : ''
  )
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)
  const [themeDialogTab, setThemeDialogTab] = useState<'theme' | 'typography'>('theme')
  const [typographyParams, setTypographyParams] = useState<TypographyParams>(() => loadTypographyParams())
  const [typographyDraft, setTypographyDraft] = useState<TypographyParams>(() => loadTypographyParams())

  const applyTypographyParams = useCallback((p: TypographyParams) => {
    let styleEl = document.getElementById(TYPOGRAPHY_PARAMS_STYLE_ID) as HTMLStyleElement | null
    const css = buildTypographyCss(p)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = TYPOGRAPHY_PARAMS_STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = css
  }, [])

  const selectedTemplate: 'none' | 'aurora' | 'paper' | 'cyber' | 'noir' | 'ocean' =
    customCssDraft.trim() === AURORA_TEMPLATE_CSS.trim()
      ? 'aurora'
      : customCssDraft.trim() === PAPER_SERIF_TEMPLATE_CSS.trim()
        ? 'paper'
        : customCssDraft.trim() === CYBER_GRID_TEMPLATE_CSS.trim()
          ? 'cyber'
          : customCssDraft.trim() === NOIR_GLASS_TEMPLATE_CSS.trim()
            ? 'noir'
            : customCssDraft.trim() === OCEAN_PASTEL_TEMPLATE_CSS.trim()
              ? 'ocean'
            : 'none'

  const applyCustomThemeCss = useCallback((cssText: string) => {
    let styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID) as HTMLStyleElement | null
    const trimmed = cssText.trim()
    if (!trimmed) {
      if (styleEl) {
        styleEl.remove()
      }
      return
    }
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CUSTOM_THEME_STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = trimmed
  }, [])

  // Track mounted state for hydration
  useEffect(() => {
    // Using a microtask to avoid synchronous setState warning
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    applyCustomThemeCss(customCssDraft)
  }, [applyCustomThemeCss, customCssDraft])

  useEffect(() => {
    applyTypographyParams(typographyParams)
  }, [applyTypographyParams, typographyParams])

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (openedWindow) return
    } catch {
      // Continue to shell fallback.
    }
    try {
      await openExternal(url)
      return
    } catch {
      // Fallback for non-Tauri environments.
    }
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  useEffect(() => {
    let active = true
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((version) => {
        if (!active) return
        setAppVersion(`v${normalizeVersion(version)}`)
      })
      .catch(() => {
        // Keep fallback version on web environment.
      })
    return () => {
      active = false
    }
  }, [])

  const checkForUpdates = useCallback(() => {
    if (!mounted || !appVersion) return
    const localVersion = normalizeVersion(appVersion)
    const localTuple = parseVersionTuple(localVersion)
    if (!isSemanticVersion(localVersion) && !localTuple.some(Boolean)) return
    fetch(RELEASE_API_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.tag_name || !data?.html_url) return
        const latestTag = String(data.tag_name)
        const remoteVersion = normalizeVersion(latestTag)
        if (!isSemanticVersion(remoteVersion) && !parseVersionTuple(remoteVersion).some(Boolean)) return
        if (remoteVersion === localVersion) return
        if (!isRemoteVersionNewer(remoteVersion, localVersion)) return
        if (shownUpdateTagRef.current === latestTag) return
        const assets = Array.isArray(data.assets) ? data.assets : []
        const downloadUrl = chooseBestAssetUrl(assets, String(data.html_url))
        shownUpdateTagRef.current = latestTag
        toast.info(`发现新版本 ${latestTag}`, {
          action: {
            label: '下载更新',
            onClick: () => {
              openExternalUrl(downloadUrl)
            },
          },
          duration: 12000,
        })
      })
      .catch(() => {
        // Ignore transient network issues and retry later.
      })
  }, [appVersion, mounted, openExternalUrl])

  useEffect(() => {
    if (!mounted) return
    const intervalId = window.setInterval(checkForUpdates, 5 * 60 * 1000)
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkForUpdates()
    }
    checkForUpdates()
    window.setTimeout(checkForUpdates, 3000)
    document.addEventListener('visibilitychange', visibilityHandler)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [checkForUpdates, mounted])

  const handleSaveDocument = useCallback(async () => {
    if (!currentDocument) return
    setIsSaving(true)
    await saveDocument()
    toast.success('Document saved')
    setTimeout(() => setIsSaving(false), 500)
  }, [currentDocument, saveDocument])

  const handleSaveAs = useCallback(async () => {
    if (!currentDocument) return
    const result = await saveAsMarkdown(currentDocument.content, currentDocument.title)
    if (result === 'saved') toast.success('文件已保存')
    else if (result === 'fallback') toast.success('文件已下载')
    // 'cancelled' → user dismissed dialog, no notification needed
  }, [currentDocument])

  const handleExportPdf = useCallback(async () => {
    if (!currentDocument) return
    toast.info('正在导出 PDF…')
    const result = await exportAsPdf(currentDocument.content, currentDocument.title)
    if (result === 'saved') toast.success('PDF 导出成功')
    else if (result === 'cancelled') toast.info('已取消导出')
    else if (result === 'fallback') toast.error('PDF 导出失败，请重试')
  }, [currentDocument])

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handleSave = () => {
      handleSaveDocument()
    }
    window.addEventListener('save-document', handleSave)
    return () => window.removeEventListener('save-document', handleSave)
  }, [handleSaveDocument])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCurrentTitle(e.target.value)
  }

  // Auto-save on blur (silent)
  const handleTitleBlur = () => {
    if (currentDocument) {
      saveDocument()
    }
  }

  const handleSaveCustomTheme = () => {
    localStorage.setItem(CUSTOM_THEME_KEY, customCssDraft)
    applyCustomThemeCss(customCssDraft)
    setIsThemeDialogOpen(false)
    toast.success('Custom theme CSS saved')
  }

  const handleResetCustomTheme = () => {
    localStorage.removeItem(CUSTOM_THEME_KEY)
    setCustomCssDraft('')
    applyCustomThemeCss('')
    toast.success('Custom theme CSS reset')
  }

  const handleSaveTypography = () => {
    localStorage.setItem(TYPOGRAPHY_PARAMS_KEY, JSON.stringify(typographyDraft))
    setTypographyParams(typographyDraft)
    applyTypographyParams(typographyDraft)
    setIsThemeDialogOpen(false)
    toast.success('排版参数已保存')
  }

  const handleResetTypography = () => {
    localStorage.removeItem(TYPOGRAPHY_PARAMS_KEY)
    setTypographyDraft(DEFAULT_TYPOGRAPHY)
    setTypographyParams(DEFAULT_TYPOGRAPHY)
    applyTypographyParams(DEFAULT_TYPOGRAPHY)
    toast.success('排版参数已重置为默认值')
  }

  const updateTypoDraft = (key: keyof TypographyParams, value: number) => {
    setTypographyDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleApplyTemplate = (template: 'none' | 'aurora' | 'paper' | 'cyber' | 'noir' | 'ocean') => {
    if (template === 'none') {
      setCustomCssDraft('')
      localStorage.removeItem(CUSTOM_THEME_KEY)
      applyCustomThemeCss('')
      toast.success('Template cleared')
      return
    }
    const templates: Record<'aurora' | 'paper' | 'cyber' | 'noir' | 'ocean', { css: string; name: string }> = {
      aurora: { css: AURORA_TEMPLATE_CSS, name: 'Aurora' },
      paper: { css: PAPER_SERIF_TEMPLATE_CSS, name: 'Paper Serif' },
      cyber: { css: CYBER_GRID_TEMPLATE_CSS, name: 'Cyber Grid' },
      noir: { css: NOIR_GLASS_TEMPLATE_CSS, name: 'Noir Glass' },
      ocean: { css: OCEAN_PASTEL_TEMPLATE_CSS, name: 'Ocean Pastel' },
    }
    const selected = templates[template]
    if (!selected) return
    setCustomCssDraft(selected.css)
    localStorage.setItem(CUSTOM_THEME_KEY, selected.css)
    applyCustomThemeCss(selected.css)
    toast.success(`${selected.name} template applied`)
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Markdown Editor</h1>
        <span className="rounded border px-2 py-0.5 text-[11px] text-muted-foreground">
          {appVersion}
        </span>
        {currentDocument && (
          <span className="text-xs text-muted-foreground">
            • {isSaving ? 'Saving...' : 'Auto-saved'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {currentDocument && (
          <>
            <Input
              value={currentDocument.title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              className="h-8 w-48 text-sm"
              placeholder="Document title"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDocument}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAs}
              title="另存为 Markdown 文件"
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              另存为
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              title="导出为 PDF"
              className="gap-1"
            >
              <FileDown className="h-4 w-4" />
              导出PDF
            </Button>
          </>
        )}
        
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Palette className="h-4 w-4" />
                Theme
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => { setThemeDialogTab('theme'); setIsThemeDialogOpen(true) }}
                className="text-black data-[highlighted]:bg-black data-[highlighted]:text-white focus:bg-black focus:text-white"
              >
                外观主题
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setThemeDialogTab('typography'); setTypographyDraft(typographyParams); setIsThemeDialogOpen(true) }}
                className="text-black data-[highlighted]:bg-black data-[highlighted]:text-white focus:bg-black focus:text-white"
              >
                排版参数
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={isThemeDialogOpen} onOpenChange={(open) => {
        setIsThemeDialogOpen(open)
        if (!open) setThemeDialogTab('theme')
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>外观与排版</DialogTitle>
            <DialogDescription>
              选择主题模板、自定义 CSS，或调整排版参数。
            </DialogDescription>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg border bg-muted p-1 w-fit">
            <button
              type="button"
              onClick={() => setThemeDialogTab('theme')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${themeDialogTab === 'theme' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              外观主题
            </button>
            <button
              type="button"
              onClick={() => { setThemeDialogTab('typography'); setTypographyDraft(typographyParams) }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${themeDialogTab === 'typography' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              排版参数
            </button>
          </div>

          {/* ── 外观主题 Tab ── */}
          {themeDialogTab === 'theme' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('aurora')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'aurora' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div
                    className="h-20 w-full rounded-md border"
                    style={{
                      background:
                        'radial-gradient(circle at 20% 10%, rgba(217,70,239,0.6), transparent 45%), radial-gradient(circle at 85% 15%, rgba(56,189,248,0.45), transparent 45%), linear-gradient(180deg, #0a0616 0%, #0e1327 50%, #100a1c 100%)',
                    }}
                  />
                  <div className="mt-2 text-sm font-medium">Aurora Elegant</div>
                  <div className="text-xs text-muted-foreground">High contrast + glow style</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('paper')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'paper' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#fff8eb 0%,#f3e5cb 100%)' }} />
                  <div className="mt-2 text-sm font-medium">Paper Serif</div>
                  <div className="text-xs text-muted-foreground">Classic print / journal look</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('cyber')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'cyber' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#05070f 0%,#0b1432 100%)' }} />
                  <div className="mt-2 text-sm font-medium">Cyber Grid</div>
                  <div className="text-xs text-muted-foreground">Neon contrast + futuristic lines</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('noir')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'noir' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#0b0f18 0%,#1a2438 100%)' }} />
                  <div className="mt-2 text-sm font-medium">Noir Glass</div>
                  <div className="text-xs text-muted-foreground">Deep blue-black + glassy cards</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('ocean')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'ocean' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div className="h-20 w-full rounded-md border" style={{ background: 'linear-gradient(180deg,#ddf3fb 0%,#f6fbfe 100%)' }} />
                  <div className="mt-2 text-sm font-medium">Ocean Pastel</div>
                  <div className="text-xs text-muted-foreground">Soft blue paper + calm reading mood</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('none')}
                  className={`rounded-lg border p-2 text-left transition ${selectedTemplate === 'none' ? 'border-primary ring-1 ring-primary/40' : 'hover:border-primary/50'}`}
                >
                  <div className="h-20 w-full rounded-md border bg-background" />
                  <div className="mt-2 text-sm font-medium">Default</div>
                  <div className="text-xs text-muted-foreground">Use built-in app theme only</div>
                </button>
              </div>
              <Textarea
                value={customCssDraft}
                onChange={(e) => setCustomCssDraft(e.target.value)}
                className="h-52 font-mono text-xs"
                placeholder=":root { --pmd-code-bg: #0f172a; }"
              />
              <DialogFooter>
                <Button variant="outline" onClick={handleResetCustomTheme}>重置</Button>
                <Button variant="outline" onClick={() => setIsThemeDialogOpen(false)}>取消</Button>
                <Button onClick={handleSaveCustomTheme}>保存主题</Button>
              </DialogFooter>
            </>
          )}

          {/* ── 排版参数 Tab ── */}
          {themeDialogTab === 'typography' && (
            <>
              <div className="space-y-5 py-1">
                {/* Font Size */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-sm font-medium">正文字号</div>
                    <div className="text-xs text-muted-foreground">编辑区基础字体大小（px）</div>
                    <input
                      type="range"
                      min={12}
                      max={28}
                      step={0.5}
                      value={typographyDraft.fontSize}
                      onChange={(e) => updateTypoDraft('fontSize', Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                  </div>
                  <input
                    type="number"
                    min={12}
                    max={28}
                    step={0.5}
                    value={typographyDraft.fontSize}
                    onChange={(e) => updateTypoDraft('fontSize', Number(e.target.value))}
                    className="w-16 rounded border bg-background px-2 py-1 text-sm text-center"
                  />
                </div>

                {/* Line Height */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-sm font-medium">行高</div>
                    <div className="text-xs text-muted-foreground">正文行间距倍数</div>
                    <input
                      type="range"
                      min={1.2}
                      max={2.4}
                      step={0.02}
                      value={typographyDraft.lineHeight}
                      onChange={(e) => updateTypoDraft('lineHeight', Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                  </div>
                  <input
                    type="number"
                    min={1.2}
                    max={2.4}
                    step={0.02}
                    value={typographyDraft.lineHeight}
                    onChange={(e) => updateTypoDraft('lineHeight', Number(e.target.value))}
                    className="w-16 rounded border bg-background px-2 py-1 text-sm text-center"
                  />
                </div>

                {/* Paragraph Spacing */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-sm font-medium">段落间距</div>
                    <div className="text-xs text-muted-foreground">段落上下外边距（em）</div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={typographyDraft.paragraphSpacing}
                      onChange={(e) => updateTypoDraft('paragraphSpacing', Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={typographyDraft.paragraphSpacing}
                    onChange={(e) => updateTypoDraft('paragraphSpacing', Number(e.target.value))}
                    className="w-16 rounded border bg-background px-2 py-1 text-sm text-center"
                  />
                </div>

                {/* Letter Spacing */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-sm font-medium">字符间距</div>
                    <div className="text-xs text-muted-foreground">字母/汉字间距（em）</div>
                    <input
                      type="range"
                      min={-0.02}
                      max={0.2}
                      step={0.005}
                      value={typographyDraft.letterSpacing}
                      onChange={(e) => updateTypoDraft('letterSpacing', Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                  </div>
                  <input
                    type="number"
                    min={-0.02}
                    max={0.2}
                    step={0.005}
                    value={typographyDraft.letterSpacing}
                    onChange={(e) => updateTypoDraft('letterSpacing', Number(e.target.value))}
                    className="w-16 rounded border bg-background px-2 py-1 text-sm text-center"
                  />
                </div>

                {/* Heading sizes */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">标题字号（相对正文 em）</div>
                  {(
                    [
                      { key: 'h1Size' as const, label: 'H1' },
                      { key: 'h2Size' as const, label: 'H2' },
                      { key: 'h3Size' as const, label: 'H3' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="grid grid-cols-[40px_1fr_auto] items-center gap-3">
                      <span className="text-sm font-medium">{label}</span>
                      <input
                        type="range"
                        min={1.0}
                        max={3.0}
                        step={0.05}
                        value={typographyDraft[key]}
                        onChange={(e) => updateTypoDraft(key, Number(e.target.value))}
                        className="accent-primary"
                      />
                      <input
                        type="number"
                        min={1.0}
                        max={3.0}
                        step={0.05}
                        value={typographyDraft[key]}
                        onChange={(e) => updateTypoDraft(key, Number(e.target.value))}
                        className="w-14 rounded border bg-background px-2 py-1 text-sm text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleResetTypography}>重置默认</Button>
                <Button variant="outline" onClick={() => setIsThemeDialogOpen(false)}>取消</Button>
                <Button onClick={handleSaveTypography}>保存参数</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </header>
  )
}
