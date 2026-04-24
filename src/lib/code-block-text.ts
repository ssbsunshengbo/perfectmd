function normalizeLineText(text: string): string {
  return text.replace(/\u200B/g, '').replace(/\u00a0/g, ' ')
}

export function normalizeCodeBlockText(text: string): string {
  return normalizeLineText(text).replace(/\r\n?/g, '\n').replace(/\n$/, '')
}

export function extractCodeBlockText(source: Element | null): string {
  if (!source) return ''

  const codeEl = (source.matches?.('code') ? source : source.querySelector('code')) as HTMLElement | null
  if (!codeEl) return ''

  const directLineNodes = Array.from(codeEl.children).filter((child): child is HTMLElement => {
    return child instanceof HTMLElement && child.classList.contains('line')
  })

  if (directLineNodes.length > 0) {
    return normalizeCodeBlockText(
      directLineNodes.map((line) => normalizeLineText(line.textContent || '')).join('\n')
    )
  }

  return normalizeCodeBlockText(codeEl.textContent || '')
}
