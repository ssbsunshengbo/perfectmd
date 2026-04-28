import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

import { prepareDocxExportPayload } from './html-to-markdown'

export interface DocxExportResult {
  status: 'saved' | 'cancelled' | 'unsupported' | 'missing_dependency' | 'failed'
  message?: string
  outputPath?: string
}

interface ExportDocxCommandPayload {
  outputPath: string
  title: string
  html: string
  assets: Array<{
    relativePath: string
    mimeType: string
    base64Data: string
  }>
  inlineStyles: Array<{
    styleId: string
    color?: string
    backgroundColor?: string
    fontSizeHalfPoints?: number
  }>
}

function sanitizeFileBaseName(name: string): string {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/^PANDOC_[A-Z_]+:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function exportAsDocx(content: string, title: string): Promise<DocxExportResult> {
  if (!isTauriRuntime()) return { status: 'unsupported' }

  const safeTitle = sanitizeFileBaseName(title)
  const outputPath = await save({
    defaultPath: `${safeTitle}.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })

  if (!outputPath) return { status: 'cancelled' }

  try {
    const payload = await prepareDocxExportPayload(content, title)
    await invoke('export_docx', {
      payload: {
        outputPath,
        title: payload.title,
        html: payload.html,
        assets: payload.assets,
        inlineStyles: payload.inlineStyles,
      } satisfies ExportDocxCommandPayload,
    })
    return { status: 'saved', outputPath }
  } catch (error) {
    const message = extractErrorMessage(error)
    if (message.includes('PANDOC_NOT_FOUND')) {
      return {
        status: 'missing_dependency',
        message: '当前安装包未包含可用的 Pandoc，或系统环境里也没有找到 Pandoc。',
      }
    }
    return {
      status: 'failed',
      message: sanitizeErrorMessage(message),
    }
  }
}
