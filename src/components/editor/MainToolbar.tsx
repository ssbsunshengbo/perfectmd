'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Palette,
  Highlighter,
  Link,
  Code,
  Table,
  FunctionSquare,
  Minus,
  List,
  ListOrdered,
  Quote,
  ChevronDown,
  Pilcrow,
} from 'lucide-react'
import { useState, useCallback } from 'react'

interface MainToolbarProps {
  onApplyStyle: (style: string, value?: string) => void
}

const COLORS = [
  { name: '默认', value: 'inherit' },
  { name: '黑色', value: '#000000' },
  { name: '灰色', value: '#6b7280' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
]

const HIGHLIGHT_COLORS = [
  { name: '无', value: 'transparent' },
  { name: '黄色', value: '#fef08a' },
  { name: '绿色', value: '#bbf7d0' },
  { name: '蓝色', value: '#bfdbfe' },
  { name: '粉色', value: '#fbcfe8' },
  { name: '橙色', value: '#fed7aa' },
  { name: '紫色', value: '#ddd6fe' },
]

const FONT_SIZES = [
  '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'
]

export function MainToolbar({ onApplyStyle }: MainToolbarProps) {
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [fontSizeOpen, setFontSizeOpen] = useState(false)

  const handleHeading = useCallback((level: string) => {
    onApplyStyle('heading', level)
  }, [onApplyStyle])

  const handleNormal = useCallback(() => {
    onApplyStyle('normal')
  }, [onApplyStyle])

  const insertTable = useCallback(() => {
    const selection = window.getSelection()
    if (!selection) return
    
    const table = document.createElement('table')
    const thead = document.createElement('thead')
    const tbody = document.createElement('tbody')
    
    // Create header row
    const headerRow = document.createElement('tr')
    for (let i = 0; i < 3; i++) {
      const th = document.createElement('th')
      th.textContent = '标题'
      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)
    
    // Create data row
    const dataRow = document.createElement('tr')
    for (let i = 0; i < 3; i++) {
      const td = document.createElement('td')
      td.textContent = '内容'
      dataRow.appendChild(td)
    }
    tbody.appendChild(dataRow)
    
    table.appendChild(thead)
    table.appendChild(tbody)
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(table)
    
    // Move cursor to first cell
    const firstTh = table.querySelector('th')
    if (firstTh) {
      const newRange = document.createRange()
      newRange.selectNodeContents(firstTh)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
    
    onApplyStyle('table')
  }, [onApplyStyle])

  const insertCodeBlock = useCallback(() => {
    const selection = window.getSelection()
    if (!selection) return
    
    const pre = document.createElement('pre')
    pre.className = 'code-block'
    const code = document.createElement('code')
    code.textContent = '// 在此处输入代码\n'
    pre.appendChild(code)
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(pre)
    
    // Move cursor inside code block
    const newRange = document.createRange()
    newRange.setStart(code, 0)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
    
    onApplyStyle('codeblock')
  }, [onApplyStyle])

  const insertFormula = useCallback(() => {
    const selection = window.getSelection()
    if (!selection) return
    
    const formula = prompt('请输入LaTeX公式：', 'E = mc^2')
    if (!formula) return
    
    const span = document.createElement('span')
    span.className = 'math-inline'
    span.setAttribute('data-formula', formula)
    span.textContent = `$${formula}$`
    span.style.fontFamily = 'serif'
    span.style.fontStyle = 'italic'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(span)
    
    onApplyStyle('formula')
  }, [onApplyStyle])

  const insertLink = useCallback(() => {
    const url = prompt('请输入链接URL：', 'https://')
    if (!url) return
    
    const text = prompt('请输入链接文本：', '链接')
    if (!text) return
    
    const selection = window.getSelection()
    if (!selection) return
    
    const a = document.createElement('a')
    a.href = url
    a.textContent = text
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(a)
    
    onApplyStyle('link')
  }, [onApplyStyle])

  return (
    <div className="flex items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur">
      {/* 标题选择 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">标题</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleNormal}>
            <Pilcrow className="mr-2 h-4 w-4" />
            正文
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleHeading('1')}>
            <Heading1 className="mr-2 h-4 w-4" />
            一级标题
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleHeading('2')}>
            <Heading2 className="mr-2 h-4 w-4" />
            二级标题
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleHeading('3')}>
            <Heading3 className="mr-2 h-4 w-4" />
            三级标题
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-6 w-px bg-border mx-1" />

      {/* 基本格式 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('bold')}
        title="加粗 (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('italic')}
        title="斜体 (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('underline')}
        title="下划线 (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('strikethrough')}
        title="删除线"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <div className="h-6 w-px bg-border mx-1" />

      {/* 字体大小 */}
      <Popover open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            <span className="text-sm font-medium">字号</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-2" align="start">
          <div className="grid grid-cols-2 gap-1">
            {FONT_SIZES.map((size) => (
              <Button
                key={size}
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onApplyStyle('fontSize', size)
                  setFontSizeOpen(false)
                }}
              >
                {size}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 文字颜色 */}
      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            <Palette className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map((color) => (
              <Button
                key={color.value}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                style={{ 
                  backgroundColor: color.value === 'inherit' ? 'transparent' : color.value,
                  border: color.value === 'inherit' ? '1px dashed #ccc' : 'none'
                }}
                onClick={() => {
                  onApplyStyle('color', color.value)
                  setColorOpen(false)
                }}
                title={color.name}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 高亮颜色 */}
      <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 h-8">
            <Highlighter className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <Button
                key={color.value}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                style={{ 
                  backgroundColor: color.value,
                  border: color.value === 'transparent' ? '1px dashed #ccc' : 'none'
                }}
                onClick={() => {
                  onApplyStyle('highlight', color.value)
                  setHighlightOpen(false)
                }}
                title={color.name}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border mx-1" />

      {/* 插入功能 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={insertLink}
        title="插入链接"
      >
        <Link className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={insertCodeBlock}
        title="插入代码块"
      >
        <Code className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={insertTable}
        title="插入表格"
      >
        <Table className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={insertFormula}
        title="插入公式"
      >
        <FunctionSquare className="h-4 w-4" />
      </Button>

      <div className="h-6 w-px bg-border mx-1" />

      {/* 列表和引用 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('list', 'bullet')}
        title="无序列表"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('list', 'ordered')}
        title="有序列表"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('quote')}
        title="引用块"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('hr')}
        title="分割线"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  )
}
