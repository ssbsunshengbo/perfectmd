export { CODE_LANGUAGE_OPTIONS, CODE_LANGUAGES } from '@/lib/code-languages'

export interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

export interface FormatState {
  heading: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  bulletList: boolean
  orderedList: boolean
}

export const DEFAULT_FORMAT_STATE: FormatState = {
  heading: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  bulletList: false,
  orderedList: false,
}

export const FONT_SIZE_STEP = 4
export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 72
export const DEFAULT_FONT_SIZE = 16

export interface EditingLink {
  element: HTMLAnchorElement | null
  text: string
  href: string
  range: Range | null
  position: { top: number; left: number }
}

export interface ImageOverlayRect {
  top: number
  left: number
  width: number
  height: number
}

export interface EditorRefs {
  editorRef: React.RefObject<HTMLDivElement | null>
  savedRangeRef: React.MutableRefObject<Range | null>
  isInternalChange: React.MutableRefObject<boolean>
  shouldResetInlineTypingRef: React.MutableRefObject<boolean>
  isComposingRef: React.MutableRefObject<boolean>
}
