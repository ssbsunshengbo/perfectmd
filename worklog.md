# PerfectMD - Development Worklog

## Project Overview
PerfectMD 是一款现代 Markdown 编辑器，融合了 Typora 的简洁性与 Word 的富文本格式化能力。
- **技术栈**: Next.js 16 (App Router, 静态导出) + Tauri 2 (桌面端) + React 19 + Tailwind CSS 4
- **数据存储**: IndexedDB（文档）、localStorage（排版/主题偏好）
- **编辑器**: contentEditable 原生实现，支持 Markdown 快捷输入 + 所见即所得编辑

---

## Phase 1: 基础架构搭建
**Status**: ✅ Completed

- IndexedDB 存储层实现（单例连接模式）
- Zustand 全局状态管理 (`editor-store.ts`)
- 文档 CRUD 操作：创建、删除、更新、置顶
- 自动保存（2 秒防抖）+ 手动 Ctrl+S 保存

---

## Phase 2: 编辑器核心
**Status**: ✅ Completed

- contentEditable 富文本编辑器，支持：
  - 标题（H1-H3）、段落
  - 粗体/斜体/下划线/删除线
  - 有序列表/无序列表
  - 引用块（blockquote）
  - 行内代码、代码块（带语法高亮 + 语言选择）
  - 表格（插入/增删行列）
  - 链接（内联编辑气泡）
  - 图片（粘贴插入 + 拖拽缩放）
  - 数学公式（KaTeX，行内 `$...$` 快捷输入 + 弹窗编辑）
  - 水平线
- Markdown 快捷输入：`# `, `## `, `### `, `- `, `1. `, `> `, `---`, `***`, `` ` ``, `**bold**`, `*italic*`, `~~strike~~`, `++underline++`, `[text](url)`, `$formula$`
- 字号调整、文字颜色、高亮色

---

## Phase 3: 界面与主题
**Status**: ✅ Completed

- next-themes 明暗主题切换
- Tailwind CSS 4 + shadcn/ui 风格组件
- 固定顶部工具栏 (`TopToolbar`)
- 侧边栏：文档列表 + 搜索（标题 + 全文） + 字数统计
- 响应式布局

---

## Phase 4: 代码质量与重构
**Status**: ✅ Completed

### 修复的问题
1. **自动保存闭包陷阱** — `useState` 改为 `useRef` 管理 debounce timeout
2. **IndexedDB 连接复用** — 实现单例模式，避免反复打开连接
3. **删除确认对话框** — 替代直接删除，防止误操作
4. **表格插入 Dialog** — 替代 `prompt()` 弹窗
5. **Tailwind 配置修复** — content 路径修正为 `./src/**/*.{js,ts,jsx,tsx,mdx}`

### 新增功能
6. **明暗主题切换按钮** — Header 区域一键切换
7. **界面文本统一** — 全面中文化
8. **Markdown 文件导入** — 支持 `.md` 文件导入并转为 HTML
9. **字数/字符统计** — 侧边栏底部实时显示
10. **全文搜索** — 同时搜索标题和内容
11. **文档标题输入优化** — 扩展宽度提升可用性

### 工程优化
12. **CSS 提取** — 编辑器内联样式提取到独立 `prose-editor.css`
13. **组件清理** — 删除约 30 个未使用的 shadcn/ui 组件和死代码
14. **MarkdownEditor 拆分** — 3400+ 行单文件拆分为 7 个模块：
    - `editor-types.ts` — 类型定义与常量
    - `use-editor-selection.ts` — 光标/选区/DOM 操作
    - `use-code-blocks.ts` — 代码块高亮与控件
    - `use-markdown-shortcuts.ts` — 块级 & 行内 Markdown 快捷输入
    - `use-block-operations.ts` — 段落拆分/列表/标题退出
    - `use-image-handling.ts` — 图片选择/缩放/粘贴
    - `MarkdownEditor.tsx` — 主编辑器组件（~1600 行）

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout + ThemeProvider
│   ├── page.tsx                      # 主页面（文档加载/保存/导出）
│   └── globals.css                   # 全局样式
├── components/
│   ├── editor/
│   │   ├── MarkdownEditor.tsx        # 主编辑器组件
│   │   ├── editor-types.ts           # 类型定义与常量
│   │   ├── use-editor-selection.ts   # 光标/选区管理 hook
│   │   ├── use-code-blocks.ts        # 代码块高亮/控件 hook
│   │   ├── use-markdown-shortcuts.ts # Markdown 快捷输入 hook
│   │   ├── use-block-operations.ts   # 段落操作 hook
│   │   ├── use-image-handling.ts     # 图片处理 hook
│   │   ├── prose-editor.css          # 编辑器样式
│   │   ├── TopToolbar.tsx            # 固定工具栏
│   │   ├── Sidebar.tsx               # 文档侧边栏
│   │   ├── Header.tsx                # 应用头部
│   │   └── EmptyState.tsx            # 空状态占位
│   └── ui/                           # shadcn/ui 组件
├── store/
│   └── editor-store.ts               # Zustand 状态管理 + IndexedDB
└── lib/
    └── utils.ts                      # 工具函数
```

---

## Pending Items

- **图片存储优化**: 将 Base64 data URL 替换为 IndexedDB Blob 存储（需数据库版本升级 + 迁移逻辑）
- **撤销/重做**: 基于操作历史的 Undo/Redo 系统
- **性能优化**: 大文档虚拟化渲染
- **国际化**: 正式 i18n 方案
