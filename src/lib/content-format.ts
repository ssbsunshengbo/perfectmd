import { marked } from 'marked'

import { htmlToMarkdown } from './html-to-markdown'

const LEGACY_HTML_ROOT_PATTERN = /^\s*<\/?(?:!doctype|html|body|p|h[1-6]|div|ul|ol|li|table|thead|tbody|tr|td|th|pre|blockquote|img|hr|font|span)\b/i

export function isLegacyHtmlContent(content: string): boolean {
  return LEGACY_HTML_ROOT_PATTERN.test(content)
}

/**
 * Documents created before the editor migration are HTML fragments. Keep that
 * compatibility at the storage boundary while the editor itself uses Markdown.
 */
export function contentToMarkdown(content: string, title = ''): string {
  if (!content) return ''
  return isLegacyHtmlContent(content)
    ? htmlToMarkdown(content, title, { includeTitleHeading: false }).trim()
    : content
}

/** Convert persisted Markdown to the HTML shape expected by the export layer. */
export function contentToExportHtml(content: string): string {
  if (!content) return ''
  if (isLegacyHtmlContent(content)) return content
  return marked.parse(content, {
    async: false,
    breaks: false,
    gfm: true,
  }) as string
}
