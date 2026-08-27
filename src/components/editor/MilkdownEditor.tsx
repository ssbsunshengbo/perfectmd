'use client'

import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import { languages } from '@codemirror/language-data'

import { contentToMarkdown } from '@/lib/content-format'
import { getImageBlob, IMAGE_PROTOCOL, saveImageBlob } from '@/store/editor-store'

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
        [Crepe.Feature.TopBar]: false,
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

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown, previousMarkdown) => {
        if (!disposed && markdown !== previousMarkdown) {
          onChangeRef.current(markdown)
        }
      })
    })

    void crepe.create().then(() => {
      if (!disposed && initialContent.shouldMigrate) {
        // Persist the one-time HTML-to-Markdown migration after the editor is ready.
        onChangeRef.current(initialMarkdown)
      }
    })

    return () => {
      disposed = true
      void crepe.destroy()
      mount.remove()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [documentId, initialContent])

  return (
    <div className="perfectmd-milkdown-shell">
      <div ref={rootRef} className="perfectmd-milkdown" />
    </div>
  )
}
