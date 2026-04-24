import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

import { prepareMarkdownExportPayload } from './html-to-markdown'

export type DocxExportResult =
  | 'saved'
  | 'cancelled'
  | 'unsupported'
  | 'missing_dependency'
  | 'failed'

interface ExportDocxCommandPayload {
  outputPath: string
  markdown: string
  assets: Array<{
    relativePath: string
    mimeType: string
    base64Data: string
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

export async function exportAsDocx(content: string, title: string): Promise<DocxExportResult> {
  if (!isTauriRuntime()) return 'unsupported'

  const safeTitle = sanitizeFileBaseName(title)
  const outputPath = await save({
    defaultPath: `${safeTitle}.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })

  if (!outputPath) return 'cancelled'

  try {
    const payload = await prepareMarkdownExportPayload(content, title)
    await invoke('export_docx', {
      payload: {
        outputPath,
        markdown: payload.markdown,
        assets: payload.assets,
      } satisfies ExportDocxCommandPayload,
    })
    return 'saved'
  } catch (error) {
    const message = extractErrorMessage(error)
    if (message.includes('PANDOC_NOT_FOUND')) return 'missing_dependency'
    return 'failed'
  }
}
