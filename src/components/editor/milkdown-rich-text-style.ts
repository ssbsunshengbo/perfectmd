import { $command, $markSchema, $remark } from '@milkdown/kit/utils'
import type { MarkType } from '@milkdown/kit/prose/model'
import type { EditorState } from '@milkdown/kit/prose/state'

export interface RichTextStylePatch {
  backgroundColor?: string | null
  color?: string | null
  fontSize?: string | null
  adjustFontSize?: number
  toggleUnderline?: boolean
}

interface RichTextStyleAttrs {
  backgroundColor: string | null
  color: string | null
  fontSize: string | null
  underline: boolean
}

const RICH_STYLE_NODE = 'perfectmdTextStyle'

const defaultAttrs = (): RichTextStyleAttrs => ({
  backgroundColor: null,
  color: null,
  fontSize: null,
  underline: false,
})

function isSafeStyleValue(value: string): boolean {
  return /^[#(),.%\w\s-]+$/i.test(value) && !/url|expression|javascript/i.test(value)
}

function normalizeStyleValue(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  return normalized && isSafeStyleValue(normalized) ? normalized : null
}

function attrsFromStyle(style: CSSStyleDeclaration): RichTextStyleAttrs {
  return {
    color: normalizeStyleValue(style.color),
    backgroundColor: normalizeStyleValue(style.backgroundColor),
    fontSize: normalizeStyleValue(style.fontSize),
    underline: style.textDecorationLine.includes('underline'),
  }
}

function attrsFromRawStyle(rawStyle: string, underline = false): RichTextStyleAttrs {
  const style = defaultAttrs()
  rawStyle.split(';').forEach((declaration) => {
    const [property, ...valueParts] = declaration.split(':')
    const value = normalizeStyleValue(valueParts.join(':'))
    if (!value) return
    switch (property.trim().toLowerCase()) {
      case 'color':
        style.color = value
        break
      case 'background':
      case 'background-color':
        style.backgroundColor = value
        break
      case 'font-size':
        style.fontSize = value
        break
      case 'text-decoration':
      case 'text-decoration-line':
        style.underline = underline || value.includes('underline')
        break
    }
  })
  return style
}

function hasStyle(attrs: RichTextStyleAttrs): boolean {
  return Boolean(attrs.color || attrs.backgroundColor || attrs.fontSize || attrs.underline)
}

function styleAttribute(attrs: RichTextStyleAttrs): string {
  const declarations: string[] = []
  if (attrs.color) declarations.push(`color:${attrs.color}`)
  if (attrs.backgroundColor) declarations.push(`background-color:${attrs.backgroundColor}`)
  if (attrs.fontSize) declarations.push(`font-size:${attrs.fontSize}`)
  if (attrs.underline) declarations.push('text-decoration:underline')
  return declarations.join(';')
}

function transformHtmlStyles(parent: { children?: Array<Record<string, unknown>> }) {
  const children = parent.children
  if (!children?.length) return

  const nextChildren: Array<Record<string, unknown>> = []
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const rawValue = child.type === 'html' && typeof child.value === 'string' ? child.value.trim() : ''
    const spanMatch = rawValue.match(/^<span\s+[^>]*style\s*=\s*["']([^"']+)["'][^>]*>$/i)
    const underlineMatch = /^<u>$/i.test(rawValue)
    if (!spanMatch && !underlineMatch) {
      transformHtmlStyles(child as { children?: Array<Record<string, unknown>> })
      nextChildren.push(child)
      continue
    }

    const closingTag = underlineMatch ? /^<\/u>$/i : /^<\/span>$/i
    let endIndex = index + 1
    while (endIndex < children.length) {
      const candidate = children[endIndex]
      if (candidate.type === 'html' && typeof candidate.value === 'string' && closingTag.test(candidate.value.trim())) {
        break
      }
      endIndex += 1
    }

    if (endIndex === children.length) {
      nextChildren.push(child)
      continue
    }

    const attrs = spanMatch ? attrsFromRawStyle(spanMatch[1], false) : attrsFromRawStyle('', true)
    const styledChildren = children.slice(index + 1, endIndex)
    transformHtmlStyles({ children: styledChildren })
    if (hasStyle(attrs)) {
      nextChildren.push({
        type: RICH_STYLE_NODE,
        data: attrs,
        children: styledChildren,
      })
    } else {
      nextChildren.push(...styledChildren)
    }
    index = endIndex
  }
  parent.children = nextChildren
}

export const richTextStyleRemark = $remark('perfectmdRichTextStyle', () => function richTextStyleRemark(this: {
  data: () => { toMarkdownExtensions?: Array<Record<string, unknown>> }
}) {
  const data = this.data() as {
    toMarkdownExtensions?: Array<Record<string, unknown>>
  }
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])
  toMarkdownExtensions.push({
    handlers: {
      [RICH_STYLE_NODE](node: { data?: RichTextStyleAttrs; children?: unknown[] }, _parent: unknown, state: {
        containerPhrasing: (node: unknown, info: unknown) => string
        enter: (name: string) => () => void
      }, info: unknown) {
        const exit = state.enter(RICH_STYLE_NODE)
        const attrs = { ...defaultAttrs(), ...node.data }
        const content = state.containerPhrasing(node, info)
        exit()
        return `<span style="${styleAttribute(attrs)}">${content}</span>`
      },
    },
  })

  return (tree: { children?: Array<Record<string, unknown>> }) => {
    transformHtmlStyles(tree)
  }
})

export const richTextStyleSchema = $markSchema('perfectmd_text_style', () => ({
  attrs: {
    backgroundColor: { default: null },
    color: { default: null },
    fontSize: { default: null },
    underline: { default: false },
  },
  parseDOM: [{
    tag: 'span[data-perfectmd-text-style="true"]',
    getAttrs: (dom) => attrsFromStyle((dom as HTMLElement).style),
  }],
  toDOM: (mark) => [
    'span',
    {
      'data-perfectmd-text-style': 'true',
      style: styleAttribute(mark.attrs as RichTextStyleAttrs),
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === RICH_STYLE_NODE,
    runner: (state, node, markType) => {
      state.openMark(markType, { ...defaultAttrs(), ...(node.data as RichTextStyleAttrs) })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'perfectmd_text_style',
    runner: (state, mark) => {
      state.withMark(mark, RICH_STYLE_NODE, undefined, { data: mark.attrs })
    },
  },
}))

function selectedRichTextStyleAttrs(
  state: EditorState,
  markType: MarkType,
): Partial<RichTextStyleAttrs> | undefined {
  const cursorMark = (state.storedMarks || state.selection.$from.marks())
    .find((mark) => mark.type === markType)
  if (cursorMark) return cursorMark.attrs as Partial<RichTextStyleAttrs>

  if (state.selection.empty) {
    return state.selection.$from.nodeBefore?.marks
      .find((mark) => mark.type === markType)?.attrs as Partial<RichTextStyleAttrs> | undefined
  }

  let attrs: Partial<RichTextStyleAttrs> | undefined
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    const mark = node.marks.find((candidate) => candidate.type === markType)
    if (mark) attrs = mark.attrs as Partial<RichTextStyleAttrs>
  })
  return attrs
}

export const applyRichTextStyleCommand = $command('ApplyPerfectmdRichTextStyle', (ctx) => (patch: RichTextStylePatch) => (state, dispatch) => {
  const markType = richTextStyleSchema.type(ctx)
  const previous = selectedRichTextStyleAttrs(state, markType)
  const attrs: RichTextStyleAttrs = {
    ...defaultAttrs(),
    ...previous,
    ...patch,
  }
  if (typeof patch.adjustFontSize === 'number') {
    const currentSize = Number.parseInt(previous?.fontSize || '16px', 10) || 16
    attrs.fontSize = `${Math.max(10, Math.min(72, currentSize + patch.adjustFontSize))}px`
  }
  if (patch.toggleUnderline) attrs.underline = !previous?.underline
  delete (attrs as Partial<RichTextStyleAttrs>).toggleUnderline
  delete (attrs as Partial<RichTextStyleAttrs>).adjustFontSize

  if (!dispatch) return true
  if (state.selection.empty) {
    let transaction = state.tr.removeStoredMark(markType)
    if (hasStyle(attrs)) transaction = transaction.addStoredMark(markType.create(attrs))
    dispatch(transaction)
    return true
  }

  const { from, to } = state.selection
  const transaction = hasStyle(attrs)
    ? state.tr.addMark(from, to, markType.create(attrs))
    : state.tr.removeMark(from, to, markType)
  dispatch(transaction.scrollIntoView())
  return true
})

export const richTextStylePlugin = [
  ...richTextStyleRemark,
  richTextStyleSchema,
  applyRichTextStyleCommand,
]
