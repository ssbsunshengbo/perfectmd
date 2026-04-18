'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Palette,
  Type,
  Code,
  Quote,
  List,
  ListOrdered,
  Link2,
  Minus,
  Pilcrow,
  Plus,
  Minus as MinusIcon,
  Table,
  Sigma,
  Braces,
  Rows3,
  Columns3,
} from 'lucide-react'

interface FormatState {
  heading: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  bulletList: boolean
  orderedList: boolean
}

interface TopToolbarProps {
  onApplyStyle: (style: string, value?: string) => void
  formatState: FormatState
}

const TEXT_COLORS = [
  { name: '恢复默认文字颜色', value: 'inherit' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '青色', value: '#14b8a6' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#a855f7' },
  { name: '粉色', value: '#ec4899' },
  { name: '灰色', value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { name: '清除高亮', value: 'transparent' },
  { name: '黄色高亮', value: '#fef08a' },
  { name: '绿色高亮', value: '#bbf7d0' },
  { name: '蓝色高亮', value: '#bfdbfe' },
  { name: '粉色高亮', value: '#fbcfe8' },
  { name: '橙色高亮', value: '#fed7aa' },
  { name: '紫色高亮', value: '#e9d5ff' },
]

const FONT_SIZES = [
  { name: '12px', value: '12px' },
  { name: '14px', value: '14px' },
  { name: '16px', value: '16px' },
  { name: '18px', value: '18px' },
  { name: '20px', value: '20px' },
  { name: '24px', value: '24px' },
  { name: '28px', value: '28px' },
  { name: '32px', value: '32px' },
  { name: '36px', value: '36px' },
  { name: '48px', value: '48px' },
]

const shortcutTitle = (label: string, shortcut?: string) => (
  shortcut ? `${label}（${shortcut}）` : label
)

export function TopToolbar({ onApplyStyle, formatState }: TopToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)
  const [customTextColor, setCustomTextColor] = useState('#3b82f6')
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a')
  const [textRgbInput, setTextRgbInput] = useState('59, 130, 246')
  const [highlightRgbInput, setHighlightRgbInput] = useState('254, 240, 138')

  const toolbarButtons = [
    { icon: Bold, title: shortcutTitle('加粗', '⌘B / Ctrl+B'), style: 'bold', active: formatState.bold },
    { icon: Italic, title: shortcutTitle('斜体', '⌘I / Ctrl+I'), style: 'italic', active: formatState.italic },
    { icon: Underline, title: shortcutTitle('下划线', '⌘U / Ctrl+U'), style: 'underline', active: formatState.underline },
    { icon: Strikethrough, title: shortcutTitle('删除线', '⌥⇧5 / Alt+Shift+5'), style: 'strikethrough', active: formatState.strikethrough },
    { icon: Code, title: '行内代码', style: 'code', active: false },
  ]

  const preventToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const parseRgbInput = (value: string): string | null => {
    const matched = value.match(/\d+/g)
    if (!matched || matched.length !== 3) return null
    const [r, g, b] = matched.map((n) => Math.max(0, Math.min(255, Number(n))))
    if ([r, g, b].some(Number.isNaN)) return null
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b bg-background/95 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {toolbarButtons.map((btn) => (
        <Button
          key={btn.style}
          variant={btn.active ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 ${btn.active ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
          onMouseDown={preventToolbarMouseDown}
          onClick={() => onApplyStyle(btn.style)}
          title={btn.title}
        >
          <btn.icon className="h-4 w-4" />
        </Button>
      ))}

      <div className="mx-1 h-5 w-px bg-border" />

      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="文字颜色" onMouseDown={preventToolbarMouseDown}>
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                className="flex h-6 w-6 items-center justify-center rounded border transition-transform hover:scale-110"
                style={{ backgroundColor: color.value === 'inherit' ? 'transparent' : color.value }}
                title={color.name}
                onMouseDown={preventToolbarMouseDown}
                onClick={() => {
                  onApplyStyle('color', color.value)
                  setShowColorPicker(false)
                }}
              >
                {color.value === 'inherit' && (
                  <span className="text-xs font-bold text-muted-foreground">x</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-2 border-t pt-2">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customTextColor}
                onMouseDown={preventToolbarMouseDown}
                onChange={(e) => {
                  const hex = e.target.value
                  setCustomTextColor(hex)
                  onApplyStyle('color', hex)
                }}
                className="h-8 w-12 cursor-pointer p-1"
              />
              <Input
                value={textRgbInput}
                onMouseDown={preventToolbarMouseDown}
                onChange={(e) => setTextRgbInput(e.target.value)}
                placeholder="R, G, B"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onMouseDown={preventToolbarMouseDown}
                onClick={() => {
                  const rgb = parseRgbInput(textRgbInput)
                  if (!rgb) return
                  onApplyStyle('color', rgb)
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={showHighlightPicker} onOpenChange={setShowHighlightPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="背景高亮" onMouseDown={preventToolbarMouseDown}>
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="grid grid-cols-7 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className="flex h-6 w-6 items-center justify-center rounded border transition-transform hover:scale-110"
                style={{ backgroundColor: color.value === 'transparent' ? undefined : color.value }}
                title={color.name}
                onMouseDown={preventToolbarMouseDown}
                onClick={() => {
                  onApplyStyle('highlight', color.value)
                  setShowHighlightPicker(false)
                }}
              >
                {color.value === 'transparent' && (
                  <span className="text-xs font-bold text-muted-foreground">x</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-2 border-t pt-2">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={customHighlightColor}
                onMouseDown={preventToolbarMouseDown}
                onChange={(e) => {
                  const hex = e.target.value
                  setCustomHighlightColor(hex)
                  onApplyStyle('highlight', hex)
                }}
                className="h-8 w-12 cursor-pointer p-1"
              />
              <Input
                value={highlightRgbInput}
                onMouseDown={preventToolbarMouseDown}
                onChange={(e) => setHighlightRgbInput(e.target.value)}
                placeholder="R, G, B"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onMouseDown={preventToolbarMouseDown}
                onClick={() => {
                  const rgb = parseRgbInput(highlightRgbInput)
                  if (!rgb) return
                  onApplyStyle('highlight', rgb)
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={preventToolbarMouseDown}
          onClick={() => onApplyStyle('fontSizeDecrease')}
          title="减小字号"
        >
          <MinusIcon className="h-4 w-4" />
        </Button>

        <Popover open={showFontSizePicker} onOpenChange={setShowFontSizePicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="字号" onMouseDown={preventToolbarMouseDown}>
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            <div className="flex flex-col gap-0.5">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  className="rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  onMouseDown={preventToolbarMouseDown}
                  onClick={() => {
                    onApplyStyle('fontSize', size.value)
                    setShowFontSizePicker(false)
                  }}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onMouseDown={preventToolbarMouseDown}
          onClick={() => onApplyStyle('fontSizeIncrease')}
          title="增大字号"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        variant={formatState.heading === null ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('normal')}
        title="正文段落"
      >
        <Pilcrow className="h-4 w-4" />
      </Button>
      <Button
        variant={formatState.heading === 'h1' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h1' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('heading', '1')}
        title="一级标题"
      >
        H1
      </Button>
      <Button
        variant={formatState.heading === 'h2' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h2' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('heading', '2')}
        title="二级标题"
      >
        H2
      </Button>
      <Button
        variant={formatState.heading === 'h3' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h3' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('heading', '3')}
        title="三级标题"
      >
        H3
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        variant={formatState.bulletList ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 ${formatState.bulletList ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('list', 'bullet')}
        title={shortcutTitle('无序列表', '⌘⇧8 / Ctrl+Shift+8')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={formatState.orderedList ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 ${formatState.orderedList ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onMouseDown={preventToolbarMouseDown}
        onClick={() => onApplyStyle('list', 'ordered')}
        title={shortcutTitle('有序列表', '⌘⇧7 / Ctrl+Shift+7')}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('quote')} title="引用">
        <Quote className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('link')} title={shortcutTitle('链接', '⌘K / Ctrl+K')}>
        <Link2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('hr')} title="分割线">
        <Minus className="h-4 w-4" />
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('table')} title="插入表格">
        <Table className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('codeBlock')} title="插入代码块">
        <Braces className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('formula')} title="插入公式">
        <Sigma className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[10px]" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('tableAddRow')} title="表格加一行">
        <Rows3 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[10px]" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('tableRemoveRow')} title="表格删一行">
        R-
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[10px]" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('tableAddColumn')} title="表格加一列">
        <Columns3 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[10px]" onMouseDown={preventToolbarMouseDown} onClick={() => onApplyStyle('tableRemoveColumn')} title="表格删一列">
        C-
      </Button>
    </div>
  )
}
