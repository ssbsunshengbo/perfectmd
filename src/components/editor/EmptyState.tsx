'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'

export function EmptyState() {
  const { createDocument } = useEditorStore()

  const handleCreate = async () => {
    await createDocument()
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="rounded-full bg-muted p-6">
        <FileText className="h-16 w-16 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold">未选择文档</h2>
        <p className="mt-2 text-muted-foreground">
          新建一篇文档，或从侧边栏选择已有文档
        </p>
      </div>
      <Button size="lg" onClick={handleCreate} className="gap-2">
        <Plus className="h-5 w-5" />
        新建文档
      </Button>
    </div>
  )
}
