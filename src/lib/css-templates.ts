// Predefined CSS templates for custom themes

export interface CssTemplate {
  id: string
  name: string
  description: string
  preview: {
    bgColor: string
    textColor: string
    accentColor: string
  }
  css: string
}

export const cssTemplates: CssTemplate[] = [
  {
    id: 'sky-gradient',
    name: '天空渐变',
    description: '清爽的蓝白渐变，如晴朗天空般舒适',
    preview: {
      bgColor: 'linear-gradient(180deg, #e0f4ff 0%, #b8e4ff 50%, #87ceeb 100%)',
      textColor: '#1e3a5f',
      accentColor: '#0066cc'
    },
    css: `/* 天空渐变主题 - 蓝白渐变背景 */
.prose-editor {
  background: linear-gradient(180deg, #e0f4ff 0%, #b8e4ff 50%, #87ceeb 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
  position: relative;
}

.prose-editor {
  color: #1e3a5f;
  font-family: 'SF Pro Display', -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #0a2540;
  font-size: 2.25em;
  font-weight: 700;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 3px solid #0066cc;
  position: relative;
}

.prose-editor h1::after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  width: 60px;
  height: 3px;
  background: #00a3ff;
}

.prose-editor h2 {
  color: #0d4f8b;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-left: 16px;
  border-left: 4px solid #00a3ff;
}

.prose-editor h3 {
  color: #1565a8;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.prose-editor p {
  margin: 1.2em 0;
  text-align: justify;
}

.prose-editor a {
  color: #0066cc;
  text-decoration: none;
  border-bottom: 1px dashed #00a3ff;
  transition: all 0.2s ease;
}

.prose-editor a:hover {
  color: #00a3ff;
  border-bottom-style: solid;
}

.prose-editor blockquote {
  border-left: 4px solid #00a3ff;
  background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%);
  backdrop-filter: blur(8px);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #2d5a87;
  font-style: italic;
}

.prose-editor code {
  background: linear-gradient(135deg, #e6f3ff 0%, #cce7ff 100%);
  color: #0066cc;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: linear-gradient(180deg, #0d253f 0%, #1a365d 100%);
  color: #e0f0ff;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 8px 32px rgba(0, 102, 204, 0.15);
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: 0.95em;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
  position: relative;
}

.prose-editor ul li::marker {
  color: #00a3ff;
}

.prose-editor ol li::marker {
  color: #0066cc;
  font-weight: 600;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #00a3ff 50%, transparent 100%);
  margin: 40px 0;
}

.prose-editor strong {
  color: #0a2540;
  font-weight: 600;
}

.prose-editor em {
  color: #1565a8;
}

/* 选中文本样式 */
::selection {
  background: rgba(0, 163, 255, 0.3);
  color: #0a2540;
}`
  },
  {
    id: 'sunset-amber',
    name: '琥珀黄昏',
    description: '温暖的琥珀色调，如夕阳般温馨舒适',
    preview: {
      bgColor: 'linear-gradient(180deg, #fff8e7 0%, #ffefc7 50%, #ffe4b5 100%)',
      textColor: '#4a3728',
      accentColor: '#d97706'
    },
    css: `/* 琥珀黄昏主题 - 温暖琥珀色调 */
.prose-editor {
  background: linear-gradient(180deg, #fff8e7 0%, #ffefc7 50%, #ffe4b5 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
}

.prose-editor {
  color: #4a3728;
  font-family: 'Crimson Pro', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 17px;
  line-height: 1.9;
}

.prose-editor h1 {
  color: #78350f;
  font-size: 2.25em;
  font-weight: 700;
  text-align: center;
  margin-bottom: 36px;
  padding-bottom: 20px;
  position: relative;
}

.prose-editor h1::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 3px;
  background: linear-gradient(90deg, #d97706, #f59e0b, #d97706);
  border-radius: 2px;
}

.prose-editor h2 {
  color: #92400e;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #fbbf24;
}

.prose-editor h3 {
  color: #a16207;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
  padding-left: 12px;
  border-left: 3px solid #f59e0b;
}

.prose-editor p {
  margin: 1.2em 0;
  text-indent: 2em;
  text-align: justify;
}

.prose-editor a {
  color: #b45309;
  text-decoration: underline;
  text-decoration-color: #fbbf24;
  text-underline-offset: 3px;
  transition: all 0.2s ease;
}

.prose-editor a:hover {
  color: #92400e;
  text-decoration-color: #d97706;
}

.prose-editor blockquote {
  border-left: 4px solid #f59e0b;
  background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(251,191,36,0.15) 100%);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #78350f;
  font-style: italic;
}

.prose-editor code {
  background: rgba(251, 191, 36, 0.25);
  color: #92400e;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: linear-gradient(180deg, #292524 0%, #44403c 100%);
  color: #fef3c7;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 8px 32px rgba(120, 53, 15, 0.15);
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
}

.prose-editor ul li::marker {
  color: #f59e0b;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #fbbf24, transparent);
  margin: 40px 0;
}

.prose-editor strong {
  color: #78350f;
  font-weight: 700;
}

/* 选中文本样式 */
::selection {
  background: rgba(251, 191, 36, 0.4);
  color: #4a3728;
}`
  },
  {
    id: 'forest-mint',
    name: '森林薄荷',
    description: '清新的薄荷绿色调，自然护眼',
    preview: {
      bgColor: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)',
      textColor: '#14532d',
      accentColor: '#16a34a'
    },
    css: `/* 森林薄荷主题 - 清新绿色调 */
.prose-editor {
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
}

.prose-editor {
  color: #14532d;
  font-family: 'Merriweather', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.85;
}

.prose-editor h1 {
  color: #052e16;
  font-size: 2.25em;
  font-weight: 700;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 3px solid #16a34a;
  position: relative;
}

.prose-editor h1::after {
  content: '🌿';
  position: absolute;
  right: 0;
  bottom: 16px;
  font-size: 0.5em;
}

.prose-editor h2 {
  color: #166534;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-left: 16px;
  border-left: 4px solid #22c55e;
}

.prose-editor h3 {
  color: #15803d;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.prose-editor p {
  margin: 1.2em 0;
}

.prose-editor a {
  color: #16a34a;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: border-color 0.2s ease;
}

.prose-editor a:hover {
  border-bottom-color: #22c55e;
}

.prose-editor blockquote {
  border-left: 4px solid #22c55e;
  background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(187,247,208,0.4) 100%);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #166534;
}

.prose-editor code {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: linear-gradient(180deg, #052e16 0%, #14532d 100%);
  color: #dcfce7;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 8px 32px rgba(22, 163, 74, 0.15);
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
}

.prose-editor ul li::marker {
  color: #22c55e;
}

.prose-editor ol li::marker {
  color: #16a34a;
  font-weight: 600;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #22c55e, transparent);
  margin: 40px 0;
}

.prose-editor strong {
  color: #052e16;
  font-weight: 700;
}

/* 表格样式 */
.prose-editor table {
  border-collapse: collapse;
  width: 100%;
  margin: 24px 0;
}

.prose-editor th, .prose-editor td {
  border: 1px solid #86efac;
  padding: 12px 16px;
}

.prose-editor th {
  background: rgba(34, 197, 94, 0.15);
  color: #166534;
  font-weight: 600;
}

.prose-editor tr:nth-child(even) {
  background: rgba(187, 247, 208, 0.3);
}

/* 选中文本样式 */
::selection {
  background: rgba(34, 197, 94, 0.35);
  color: #052e16;
}`
  },
  {
    id: 'ocean-deep',
    name: '深海夜话',
    description: '深邃的海洋深色调，适合夜间专注写作',
    preview: {
      bgColor: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      textColor: '#cbd5e1',
      accentColor: '#38bdf8'
    },
    css: `/* 深海夜话主题 - 深色调护眼 */
.prose-editor {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
}

.prose-editor {
  color: #cbd5e1;
  font-family: 'Inter', 'SF Pro Display', -apple-system, 'PingFang SC', sans-serif;
  font-size: 16px;
  line-height: 1.85;
}

.prose-editor h1 {
  color: #f1f5f9;
  font-size: 2.25em;
  font-weight: 700;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 2px solid #38bdf8;
  position: relative;
}

.prose-editor h1::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100px;
  height: 2px;
  background: linear-gradient(90deg, #38bdf8, #06b6d4, #0891b2);
}

.prose-editor h2 {
  color: #e2e8f0;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #334155;
}

.prose-editor h3 {
  color: #94a3b8;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.prose-editor p {
  margin: 1.2em 0;
}

.prose-editor a {
  color: #38bdf8;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.prose-editor a:hover {
  color: #7dd3fc;
  border-bottom-color: #38bdf8;
}

.prose-editor blockquote {
  border-left: 4px solid #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #94a3b8;
}

.prose-editor code {
  background: rgba(56, 189, 248, 0.12);
  color: #7dd3fc;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: #020617;
  border: 1px solid #1e293b;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.prose-editor pre code {
  background: transparent;
  color: #e2e8f0;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
}

.prose-editor ul li::marker {
  color: #38bdf8;
}

.prose-editor ol li::marker {
  color: #06b6d4;
  font-weight: 600;
}

.prose-editor hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #38bdf8, transparent);
  margin: 40px 0;
}

.prose-editor strong {
  color: #f1f5f9;
  font-weight: 600;
}

.prose-editor em {
  color: #a5b4fc;
}

/* 表格样式 */
.prose-editor table {
  border-collapse: collapse;
  width: 100%;
  margin: 24px 0;
}

.prose-editor th, .prose-editor td {
  border: 1px solid #334155;
  padding: 12px 16px;
}

.prose-editor th {
  background: rgba(56, 189, 248, 0.1);
  color: #e2e8f0;
  font-weight: 600;
}

.prose-editor tr:nth-child(even) {
  background: rgba(30, 41, 59, 0.5);
}

/* 选中文本样式 */
::selection {
  background: rgba(56, 189, 248, 0.3);
  color: #f1f5f9;
}`
  },
  {
    id: 'rose-garden',
    name: '玫瑰花园',
    description: '优雅的玫瑰粉色调，浪漫文艺',
    preview: {
      bgColor: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)',
      textColor: '#4c0519',
      accentColor: '#e11d48'
    },
    css: `/* 玫瑰花园主题 - 浪漫粉色调 */
.prose-editor {
  background: linear-gradient(180deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
}

.prose-editor {
  color: #4c0519;
  font-family: 'Playfair Display', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.9;
}

.prose-editor h1 {
  color: #881337;
  font-size: 2.25em;
  font-weight: 700;
  text-align: center;
  margin-bottom: 36px;
  padding-bottom: 20px;
  position: relative;
}

.prose-editor h1::before,
.prose-editor h1::after {
  content: '❀';
  position: absolute;
  bottom: 20px;
  font-size: 0.5em;
  color: #e11d48;
}

.prose-editor h1::before {
  left: calc(50% - 80px);
}

.prose-editor h1::after {
  right: calc(50% - 80px);
}

.prose-editor h2 {
  color: #9f1239;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #fda4af;
}

.prose-editor h3 {
  color: #be123c;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.prose-editor p {
  margin: 1.2em 0;
  text-indent: 2em;
}

.prose-editor a {
  color: #be123c;
  text-decoration: underline;
  text-decoration-color: #fda4af;
  text-underline-offset: 3px;
  transition: all 0.2s ease;
}

.prose-editor a:hover {
  color: #881337;
  text-decoration-color: #e11d48;
}

.prose-editor blockquote {
  border-left: 4px solid #e11d48;
  background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(254,205,211,0.4) 100%);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #881337;
  font-style: italic;
}

.prose-editor code {
  background: rgba(225, 29, 72, 0.12);
  color: #be123c;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: linear-gradient(180deg, #4c0519 0%, #881337 100%);
  color: #ffe4e6;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 8px 32px rgba(136, 19, 55, 0.15);
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
}

.prose-editor ul li::marker {
  color: #e11d48;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #fda4af, transparent);
  margin: 40px 0;
}

.prose-editor strong {
  color: #881337;
  font-weight: 700;
}

/* 选中文本样式 */
::selection {
  background: rgba(225, 29, 72, 0.25);
  color: #4c0519;
}`
  },
  {
    id: 'lavender-dream',
    name: '薰衣草梦境',
    description: '宁静的紫色薰衣草色调，梦幻优雅',
    preview: {
      bgColor: 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)',
      textColor: '#3b0764',
      accentColor: '#9333ea'
    },
    css: `/* 薰衣草梦境主题 - 梦幻紫色调 */
.prose-editor {
  background: linear-gradient(180deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%);
  min-height: 100%;
  padding: 48px 56px;
  border-radius: 12px;
}

.prose-editor {
  color: #3b0764;
  font-family: 'Crimson Text', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.85;
}

.prose-editor h1 {
  color: #581c87;
  font-size: 2.25em;
  font-weight: 700;
  text-align: center;
  margin-bottom: 36px;
  padding-bottom: 20px;
  position: relative;
}

.prose-editor h1::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 3px;
  background: linear-gradient(90deg, #a855f7, #c084fc, #a855f7);
  border-radius: 2px;
}

.prose-editor h2 {
  color: #6b21a8;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 36px;
  margin-bottom: 16px;
  padding-left: 16px;
  border-left: 4px solid #a855f7;
}

.prose-editor h3 {
  color: #7e22ce;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.prose-editor p {
  margin: 1.2em 0;
}

.prose-editor a {
  color: #7e22ce;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: border-color 0.2s ease;
}

.prose-editor a:hover {
  border-bottom-color: #a855f7;
}

.prose-editor blockquote {
  border-left: 4px solid #a855f7;
  background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(233,213,255,0.4) 100%);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 12px 12px 0;
  color: #6b21a8;
}

.prose-editor code {
  background: rgba(168, 85, 247, 0.15);
  color: #7e22ce;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: linear-gradient(180deg, #2e1065 0%, #581c87 100%);
  color: #f3e8ff;
  padding: 24px;
  margin: 24px 0;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 8px 32px rgba(88, 28, 135, 0.15);
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 28px;
  margin: 16px 0;
}

.prose-editor li {
  margin: 10px 0;
}

.prose-editor ul li::marker {
  color: #a855f7;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #c084fc, transparent);
  margin: 40px 0;
}

.prose-editor strong {
  color: #581c87;
  font-weight: 700;
}

/* 选中文本样式 */
::selection {
  background: rgba(168, 85, 247, 0.3);
  color: #3b0764;
}`
  },
  {
    id: 'custom-bg-image',
    name: '自定义背景图',
    description: '添加自定义背景图片模板',
    preview: {
      bgColor: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(your-image-url)',
      textColor: '#ffffff',
      accentColor: '#00bcd4'
    },
    css: `/* 自定义背景图主题 - 将下面的URL替换为你的图片地址 */
/* 支持：本地文件路径、网络图片URL */
.prose-editor {
  /* 方法1：使用网络图片URL */
  /* background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://example.com/your-image.jpg'); */
  
  /* 方法2：使用Base64编码的本地图片 */
  /* background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('data:image/jpeg;base64,your-base64-code'); */
  
  /* 演示：使用渐变作为背景 */
  background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), 
              linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #ffffff;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 1.8;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.prose-editor h1 {
  color: #ffffff;
  font-size: 2.2em;
  font-weight: 700;
  margin-bottom: 30px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.4);
}

.prose-editor h2 {
  color: #e0e0e0;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 35px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.3);
}

.prose-editor h3 {
  color: #f0f0f0;
  font-size: 1.3em;
  font-weight: 600;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #4fc3f7;
  text-decoration: underline;
  text-decoration-color: rgba(79, 195, 247, 0.5);
}

.prose-editor blockquote {
  border-left: 3px solid rgba(255,255,255,0.5);
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(5px);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #e0e0e0;
}

.prose-editor code {
  background: rgba(255,255,255,0.15);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
}

.prose-editor pre {
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(5px);
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: #e0e0e0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #4fc3f7;
}

/* 选中文本样式 */
::selection {
  background: rgba(79, 195, 247, 0.5);
  color: #ffffff;
}

/* 
 * 使用说明：
 * 1. 网络图片：将 url() 中的内容替换为图片URL
 * 2. 本地图片：先转换为Base64，然后填入 url('data:image/jpeg;base64,...')
 * 3. 调整透明度：修改 linear-gradient 中的 rgba 值
 *    - rgba(0,0,0,0.4) 表示40%的黑色遮罩
 *    - 改为 rgba(0,0,0,0.6) 会更暗
 *    - 改为 rgba(255,255,255,0.3) 会是白色遮罩
 */`
  }
]

// CSS字段说明文档
export const cssDocumentation = `
## CSS 自定义指南

### 基础选择器

\`\`\`css
/* 编辑器主容器 */
.prose-editor {
  /* 这里定义编辑器的整体样式 */
}

/* 所有标题 */
.prose-editor h1, .prose-editor h2, .prose-editor h3 { }

/* 一级标题 */
.prose-editor h1 { }

/* 二级标题 */
.prose-editor h2 { }

/* 三级标题 */
.prose-editor h3 { }

/* 段落 */
.prose-editor p { }

/* 链接 */
.prose-editor a { }

/* 引用块 */
.prose-editor blockquote { }

/* 行内代码 */
.prose-editor code { }

/* 代码块 */
.prose-editor pre { }
.prose-editor pre code { }

/* 列表 */
.prose-editor ul { }  /* 无序列表 */
.prose-editor ol { }  /* 有序列表 */
.prose-editor li { }  /* 列表项 */

/* 分割线 */
.prose-editor hr { }

/* 加粗/斜体 */
.prose-editor strong { }
.prose-editor em { }

/* 表格 */
.prose-editor table { }
.prose-editor th { }
.prose-editor td { }

/* 文本选中样式 */
::selection { }
\`\`\`

### 常用样式属性

\`\`\`css
/* 背景颜色/图片 */
background: #ffffff;
background: linear-gradient(135deg, #color1, #color2);
background: url('图片地址');
background-size: cover;
background-position: center;

/* 文字颜色 */
color: #333333;

/* 字体 */
font-family: 'Georgia', 'Noto Serif SC', serif;
font-size: 16px;
font-weight: 400;
line-height: 1.8;

/* 边框 */
border: 1px solid #ccc;
border-left: 4px solid #007bff;
border-bottom: 2px dashed #ccc;

/* 圆角 */
border-radius: 8px;

/* 内边距 */
padding: 20px;
padding: 10px 20px;  /* 上下 左右 */

/* 外边距 */
margin: 20px 0;

/* 阴影 */
box-shadow: 0 2px 8px rgba(0,0,0,0.1);

/* 文字阴影 */
text-shadow: 1px 1px 2px rgba(0,0,0,0.3);

/* 毛玻璃效果 */
backdrop-filter: blur(10px);
\`\`\`

### 实用技巧

**1. 背景渐变**
\`\`\`css
background: linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%);
\`\`\`

**2. 标题装饰线**
\`\`\`css
border-bottom: 2px solid #007bff;
padding-bottom: 10px;
\`\`\`

**3. 引用块样式**
\`\`\`css
border-left: 4px solid #007bff;
padding: 15px 20px;
background: #f5f5f5;
border-radius: 0 8px 8px 0;
\`\`\`

**4. 代码块样式**
\`\`\`css
background: #2d2d2d;
color: #f8f8f2;
padding: 20px;
border-radius: 8px;
\`\`\`
`
