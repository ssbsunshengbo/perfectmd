'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  FileText,
  Trash2,
  Pin,
  PinOff,
  Search,
  ChevronLeft,
  Download,
  Upload,
  MoreHorizontal,
  Database,
  ListTree,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { toast } from 'sonner'

function markdownTextToBasicHtml(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeLang = ''
  let codeLines: string[] = []
  let inList: 'ul' | 'ol' | null = null

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const processInline = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  }

  const closeList = () => {
    if (inList) {
      htmlParts.push(inList === 'ul' ? '</ul>' : '</ol>')
      inList = null
    }
  }

  for (const line of lines) {
    if (inCodeBlock) {
      if (line.startsWith('```')) {
        const codeContent = escapeHtml(codeLines.join('\n'))
        htmlParts.push(
          `<div class="code-block-wrapper" data-code-language="${codeLang || 'plaintext'}"><pre class="editor-code-block"><code data-language="${codeLang || 'plaintext'}">${codeContent}</code></pre></div>`
        )
        inCodeBlock = false
        codeLines = []
        codeLang = ''
      } else {
        codeLines.push(line)
      }
      continue
    }

    if (line.startsWith('```')) {
      closeList()
      inCodeBlock = true
      codeLang = line.slice(3).trim()
      continue
    }

    if (line.startsWith('# ')) { closeList(); htmlParts.push(`<h1>${processInline(line.slice(2))}</h1>`); continue }
    if (line.startsWith('## ')) { closeList(); htmlParts.push(`<h2>${processInline(line.slice(3))}</h2>`); continue }
    if (line.startsWith('### ')) { closeList(); htmlParts.push(`<h3>${processInline(line.slice(4))}</h3>`); continue }
    if (line.startsWith('---') || line.startsWith('***')) { closeList(); htmlParts.push('<hr>'); continue }
    if (line.startsWith('> ')) { closeList(); htmlParts.push(`<blockquote><p>${processInline(line.slice(2))}</p></blockquote>`); continue }

    const ulMatch = line.match(/^[-*+]\s+(.*)/)
    if (ulMatch) {
      if (inList !== 'ul') { closeList(); htmlParts.push('<ul>'); inList = 'ul' }
      htmlParts.push(`<li>${processInline(ulMatch[1])}</li>`)
      continue
    }

    const olMatch = line.match(/^\d+[.．]\s+(.*)/)
    if (olMatch) {
      if (inList !== 'ol') { closeList(); htmlParts.push('<ol>'); inList = 'ol' }
      htmlParts.push(`<li>${processInline(olMatch[1])}</li>`)
      continue
    }

    closeList()
    const trimmed = line.trim()
    if (trimmed === '') {
      htmlParts.push('<p><br></p>')
    } else {
      htmlParts.push(`<p>${processInline(trimmed)}</p>`)
    }
  }
  closeList()
  return htmlParts.join('')
}

interface SidebarProps {
  onExport: () => void
}

export function Sidebar({ onExport }: SidebarProps) {
  const {
    documents,
    currentDocument,
    isSidebarOpen,
    setSidebarOpen,
    createDocument,
    setCurrentDocument,
    deleteDocument,
    togglePin,
    exportAllDocuments,
    importDocumentsFromJson,
  } = useEditorStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [viewMode, setViewMode] = useState<'documents' | 'outline'>('documents')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mdFileInputRef = useRef<HTMLInputElement>(null)

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    if (doc.title.toLowerCase().includes(query)) return true
    const plainText = (doc.content || '').replace(/<[^>]*>/g, '').toLowerCase()
    return plainText.includes(query)
  })

  const outlineHeadings = useMemo(() => {
    if (!currentDocument?.content) return []
    const parser = new DOMParser()
    const doc = parser.parseFromString(currentDocument.content, 'text/html')
    const headingElements = Array.from(doc.querySelectorAll('h1, h2, h3'))
    return headingElements.map((heading, index) => {
      const level = Number(heading.tagName.toLowerCase().replace('h', '')) || 1
      const text = heading.textContent?.trim() || `Heading ${index + 1}`
      return { level, text, index }
    })
  }, [currentDocument?.content])

  const handleCreateDocument = async () => {
    setIsCreating(true)
    await createDocument()
    setIsCreating(false)
  }

  const handleDeleteDocument = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTarget({ id, title })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteDocument(deleteTarget.id)
    toast.success('文档已删除')
    setDeleteTarget(null)
  }

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await togglePin(id)
  }

  const handleBackup = async () => {
    try {
      const jsonData = await exportAllDocuments()
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `markdown-editor-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('备份创建成功')
    } catch (error) {
      console.error('Backup error:', error)
      toast.error('备份创建失败')
    }
  }

  const handleRestore = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const count = await importDocumentsFromJson(text)
      toast.success(`已恢复 ${count} 篇文档`)
    } catch (error) {
      console.error('Restore error:', error)
      toast.error('恢复备份失败，请确保文件格式正确')
    }

    e.target.value = ''
  }

  const handleImportMarkdown = () => {
    mdFileInputRef.current?.click()
  }

  const handleMdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    let imported = 0
    for (const file of Array.from(files)) {
      try {
        const text = await file.text()
        const title = file.name.replace(/\.(md|txt|markdown)$/i, '') || '未命名'
        const htmlContent = markdownTextToBasicHtml(text)
        const doc = await createDocument()
        if (doc) {
          await useEditorStore.getState().updateCurrentTitle(title)
          await useEditorStore.getState().updateCurrentContent(htmlContent)
          await useEditorStore.getState().saveDocument()
          imported++
        }
      } catch (error) {
        console.error('Import markdown error:', error)
      }
    }
    if (imported > 0) {
      await useEditorStore.getState().fetchDocuments()
      toast.success(`已导入 ${imported} 篇 Markdown 文档`)
    } else {
      toast.error('导入失败')
    }
    e.target.value = ''
  }

  const handleOutlineClick = (headingIndex: number) => {
    window.dispatchEvent(
      new CustomEvent('editor-scroll-to-heading', {
        detail: { index: headingIndex },
      })
    )
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isSidebarOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r bg-muted/30 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="mb-4"
          title="Open sidebar"
        >
          <FileText className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateDocument}
          disabled={isCreating}
          title="New document"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackup}
          title="Backup data"
          className="mt-2"
        >
          <Database className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
      <input
        type="file"
        ref={mdFileInputRef}
        onChange={handleMdFileChange}
        accept=".md,.txt,.markdown"
        multiple
        className="hidden"
      />

      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">
          {viewMode === 'documents' ? '文档' : '目录'}
        </h2>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Data options">
                <Database className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBackup}>
                <Download className="mr-2 h-4 w-4" />
                备份全部数据
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRestore}>
                <Upload className="mr-2 h-4 w-4" />
                从备份恢复
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportMarkdown}>
                <Upload className="mr-2 h-4 w-4" />
                导入 Markdown 文件
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                导出当前文档
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Button
            variant={viewMode === 'documents' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('documents')}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            文档
          </Button>
          <Button
            variant={viewMode === 'outline' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('outline')}
          >
            <ListTree className="mr-1 h-3.5 w-3.5" />
            目录
          </Button>
        </div>
      </div>

      {viewMode === 'documents' ? (
        <>
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索标题和内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="px-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleCreateDocument}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
              新建文档
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="space-y-1 py-2">
              {filteredDocuments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? '未找到匹配文档' : '暂无文档'}
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors ${
                      doc.isPinned
                        ? 'border-amber-300/80 bg-amber-50/80 dark:border-amber-500/70 dark:bg-amber-950/30'
                        : 'border-transparent'
                    } ${
                      currentDocument?.id === doc.id ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                    onClick={() => setCurrentDocument(doc)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {doc.isPinned && (
                          <>
                            <Pin className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span className="rounded bg-amber-200/80 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 dark:bg-amber-700/40 dark:text-amber-200">
                              置顶
                            </span>
                          </>
                        )}
                        <span className="truncate text-sm font-medium">{doc.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleTogglePin(doc.id, e as unknown as React.MouseEvent)
                          }
                        >
                          {doc.isPinned ? (
                            <>
                              <PinOff className="mr-2 h-4 w-4" />
                              取消置顶
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-4 w-4" />
                              置顶
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) =>
                            handleDeleteDocument(doc.id, doc.title, e as unknown as React.MouseEvent)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="space-y-1 py-2">
            {!currentDocument ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                请先选择一篇文档
              </div>
            ) : outlineHeadings.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                未找到标题（H1/H2/H3）
              </div>
            ) : (
              outlineHeadings.map((heading) => (
                <button
                  key={`${heading.index}-${heading.text}`}
                  type="button"
                  onClick={() => handleOutlineClick(heading.index)}
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  style={{ paddingLeft: `${heading.level * 12}px` }}
                  title={heading.text}
                >
                  <span className="mr-2 shrink-0 text-[10px] text-muted-foreground">
                    {heading.level === 1 ? '•' : heading.level === 2 ? '◦' : '▪'}
                  </span>
                  <span className="truncate">{heading.text}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="border-t p-2 text-xs text-muted-foreground">
        <div>共 {documents.length} 篇文档</div>
        {currentDocument && (() => {
          const text = (currentDocument.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
          const charCount = text.length
          const wordCount = text ? text.split(/\s+/).length : 0
          return <div>{charCount} 字符 · {wordCount} 词</div>
        })()}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteTarget?.title || '未命名'}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
