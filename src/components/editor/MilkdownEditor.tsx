'use client'

import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import { languages } from '@codemirror/language-data'
import { commandsCtx } from '@milkdown/kit/core'

import { contentToMarkdown } from '@/lib/content-format'
import { getImageBlob, IMAGE_PROTOCOL, saveImageBlob } from '@/store/editor-store'

import { RichTextStyleToolbar } from './RichTextStyleToolbar'
import { applyRichTextStyleCommand, richTextStylePlugin, type RichTextStylePatch } from './milkdown-rich-text-style'
import './milkdown-editor.css'

interface MilkdownEditorProps {
  documentId: string
  content: string
  title: string
  onChange: (content: string) => void
}

function createImageId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16)
        return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
      })
}

const TOP_BAR_LABELS = [
  '加粗',
  '斜体',
  '删除线',
  '行内代码',
  '无序列表',
  '有序列表',
  '任务列表',
  '插入链接',
  '插入图片',
  '插入表格',
  '插入代码块',
  '插入公式块',
  '引用',
  '分割线',
]

const RICH_TEXT_STYLE_EVENT = 'perfectmd-apply-rich-text-style'

function requestRichTextStyle(patch: RichTextStylePatch) {
  window.dispatchEvent(new CustomEvent<RichTextStylePatch>(RICH_TEXT_STYLE_EVENT, { detail: patch }))
}

function labelTopBarControls(root: HTMLElement) {
  const headingControl = root.querySelector<HTMLButtonElement>('.top-bar-heading-button')
  if (headingControl) {
    headingControl.title = '段落与标题'
    headingControl.setAttribute('aria-label', '段落与标题')
  }

  root.querySelectorAll<HTMLButtonElement>('.top-bar-item').forEach((button, index) => {
    const label = TOP_BAR_LABELS[index]
    if (!label) return
    button.title = label
    button.setAttribute('aria-label', label)
  })
}

export function MilkdownEditor({ documentId, content, title, onChange }: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const [initialContent] = useState(() => {
    const markdown = contentToMarkdown(content, title)
    return { markdown, shouldMigrate: markdown !== content }
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let disposed = false
    const objectUrls: string[] = []
    const mount = document.createElement('div')
    // Preserve the legacy class so user-created themes continue to target the
    // document surface after the editor-engine migration.
    mount.className = 'perfectmd-milkdown-instance prose-editor'
    root.replaceChildren(mount)
    const initialMarkdown = initialContent.markdown
    const crepe = new Crepe({
      root: mount,
      defaultValue: initialMarkdown,
      features: {
        // Crepe keeps this feature off by default. PerfectMD is a desktop
        // writing app, so the persistent controls are essential for
        // discoverability and preserve the old editor's feature surface.
        [Crepe.Feature.TopBar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: '开始写作…',
          mode: 'block',
        },
        [Crepe.Feature.CodeMirror]: {
          languages,
          copyText: '复制',
          searchPlaceholder: '搜索语言',
          noResultText: '未找到语言',
        },
        [Crepe.Feature.ImageBlock]: {
          inlineUploadButton: '上传图片',
          blockUploadButton: '上传图片',
          inlineUploadPlaceholderText: '或粘贴图片链接',
          blockUploadPlaceholderText: '或粘贴图片链接',
          onUpload: async (file) => {
            const id = createImageId()
            await saveImageBlob(id, file, file.type || 'image/png')
            return `${IMAGE_PROTOCOL}${id}`
          },
          proxyDomURL: async (url) => {
            if (!url.startsWith(IMAGE_PROTOCOL)) return url
            const imageId = url.slice(IMAGE_PROTOCOL.length)
            const stored = await getImageBlob(imageId)
            if (!stored) return url
            const objectUrl = URL.createObjectURL(stored.blob)
            objectUrls.push(objectUrl)
            return objectUrl
          },
        },
      },
    })
    crepe.editor.use(richTextStylePlugin)

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown, previousMarkdown) => {
        if (!disposed && markdown !== previousMarkdown) {
          onChangeRef.current(markdown)
        }
      })
    })

    const handleScrollToHeading = (event: Event) => {
      const index = (event as CustomEvent<{ index?: number }>).detail?.index
      if (typeof index !== 'number') return
      mount.querySelectorAll<HTMLElement>('h1, h2, h3')[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
    const handleRichTextStyle = (event: Event) => {
      const patch = (event as CustomEvent<RichTextStylePatch>).detail
      if (!patch) return
      crepe.editor.action((ctx) => ctx.get(commandsCtx).call(applyRichTextStyleCommand.key, patch))
    }
    window.addEventListener('editor-scroll-to-heading', handleScrollToHeading)
    window.addEventListener(RICH_TEXT_STYLE_EVENT, handleRichTextStyle)

    void crepe.create().then(() => {
      if (disposed) return
      labelTopBarControls(mount)
      if (!disposed && initialContent.shouldMigrate) {
        // Persist the one-time HTML-to-Markdown migration after the editor is ready.
        onChangeRef.current(initialMarkdown)
      }
    })

    return () => {
      disposed = true
      void crepe.destroy()
      window.removeEventListener('editor-scroll-to-heading', handleScrollToHeading)
      window.removeEventListener(RICH_TEXT_STYLE_EVENT, handleRichTextStyle)
      mount.remove()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documentId, initialContent])

  return (
    <div className="perfectmd-milkdown-shell">
      <RichTextStyleToolbar onApply={requestRichTextStyle} />
      <div ref={rootRef} className="perfectmd-milkdown" />
    </div>
  )
}
