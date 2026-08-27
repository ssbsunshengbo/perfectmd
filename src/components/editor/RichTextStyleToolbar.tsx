'use client'

import { useState } from 'react'
import { Highlighter, Minus, Palette, Plus, Type, Underline } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import type { RichTextStylePatch } from './milkdown-rich-text-style'

interface RichTextStyleToolbarProps {
  onApply: (patch: RichTextStylePatch) => void
}

const TEXT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7', '#ec4899', '#6b7280']
const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff']
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px']

function preventFocusLoss(event: React.MouseEvent) {
  event.preventDefault()
}

function rgbToCss(value: string): string | null {
  const parts = value.match(/\d+/g)
  if (!parts || parts.length !== 3) return null
  const channels = parts.map((part) => Math.max(0, Math.min(255, Number(part))))
  if (channels.some(Number.isNaN)) return null
  return `rgb(${channels.join(', ')})`
}

function hexToRgb(value: string): string {
  const hex = value.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return value
  return `${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}`
}

export function RichTextStyleToolbar({ onApply }: RichTextStyleToolbarProps) {
  const [customTextColor, setCustomTextColor] = useState('#3b82f6')
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a')
  const [textRgb, setTextRgb] = useState('59, 130, 246')
  const [highlightRgb, setHighlightRgb] = useState('254, 240, 138')

  return (
    <div className="perfectmd-rich-style-toolbar" aria-label="文字样式">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="下划线"
        onMouseDown={preventFocusLoss}
        onClick={() => onApply({ toggleUnderline: true })}
      >
        <Underline className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="文字颜色" onMouseDown={preventFocusLoss}>
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            <button type="button" className="h-7 w-7 border text-xs" title="恢复默认文字颜色" onMouseDown={preventFocusLoss} onClick={() => onApply({ color: null })}>x</button>
            {TEXT_COLORS.map((color) => (
              <button key={color} type="button" className="h-7 w-7 border" style={{ backgroundColor: color }} title={`文字颜色 ${color}`} onMouseDown={preventFocusLoss} onClick={() => onApply({ color })} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t pt-2">
            <Input
              type="color"
              value={customTextColor}
              className="h-8 w-10 cursor-pointer p-1"
              onMouseDown={preventFocusLoss}
              onInput={(event) => {
                const value = (event.target as HTMLInputElement).value
                setCustomTextColor(value)
                setTextRgb(hexToRgb(value))
                onApply({ color: value })
              }}
              onChange={(event) => setCustomTextColor(event.target.value)}
              aria-label="自定义文字颜色"
            />
            <Input value={textRgb} className="h-8 min-w-0 text-xs" onMouseDown={preventFocusLoss} onChange={(event) => setTextRgb(event.target.value)} aria-label="文字颜色 RGB" />
            <Button size="sm" variant="outline" onMouseDown={preventFocusLoss} onClick={() => {
              const color = rgbToCss(textRgb)
              if (color) onApply({ color })
            }}>应用</Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="背景高亮" onMouseDown={preventFocusLoss}>
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            <button type="button" className="h-7 w-7 border text-xs" title="清除背景高亮" onMouseDown={preventFocusLoss} onClick={() => onApply({ backgroundColor: null })}>x</button>
            {HIGHLIGHT_COLORS.map((color) => (
              <button key={color} type="button" className="h-7 w-7 border" style={{ backgroundColor: color }} title={`高亮颜色 ${color}`} onMouseDown={preventFocusLoss} onClick={() => onApply({ backgroundColor: color })} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t pt-2">
            <Input
              type="color"
              value={customHighlightColor}
              className="h-8 w-10 cursor-pointer p-1"
              onMouseDown={preventFocusLoss}
              onInput={(event) => {
                const value = (event.target as HTMLInputElement).value
                setCustomHighlightColor(value)
                setHighlightRgb(hexToRgb(value))
                onApply({ backgroundColor: value })
              }}
              onChange={(event) => setCustomHighlightColor(event.target.value)}
              aria-label="自定义高亮颜色"
            />
            <Input value={highlightRgb} className="h-8 min-w-0 text-xs" onMouseDown={preventFocusLoss} onChange={(event) => setHighlightRgb(event.target.value)} aria-label="高亮颜色 RGB" />
            <Button size="sm" variant="outline" onMouseDown={preventFocusLoss} onClick={() => {
              const color = rgbToCss(highlightRgb)
              if (color) onApply({ backgroundColor: color })
            }}>应用</Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="减小字号" onMouseDown={preventFocusLoss} onClick={() => onApply({ adjustFontSize: -4 })}>
        <Minus className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="字号" onMouseDown={preventFocusLoss}>
            <Type className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-24 p-1" align="start">
          <button type="button" className="block w-full px-2 py-1 text-left text-sm hover:bg-accent" onMouseDown={preventFocusLoss} onClick={() => onApply({ fontSize: null })}>默认</button>
          {FONT_SIZES.map((fontSize) => (
            <button key={fontSize} type="button" className="block w-full px-2 py-1 text-left text-sm hover:bg-accent" onMouseDown={preventFocusLoss} onClick={() => onApply({ fontSize })}>{fontSize}</button>
          ))}
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="增大字号" onMouseDown={preventFocusLoss} onClick={() => onApply({ adjustFontSize: 4 })}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
