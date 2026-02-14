# PerfectMD

A modern Markdown editor combining Typora's simplicity with Word's rich formatting capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ✨ Features

- **Rich Text Formatting**: Bold, italic, underline, strikethrough, inline code
- **Text Styling**: Text color, highlight color, font size adjustment
- **Headings**: H1, H2, H3 with visual detection
- **Lists**: Bullet lists and ordered lists
- **Block Elements**: Blockquotes, horizontal rules
- **Links**: Easy link insertion
- **Dark Mode**: Full dark/light theme support
- **Auto-save**: Automatic saving with debounce
- **Document Management**: Create, delete, pin documents
- **Search**: Quick document search
- **Export**: Export to Markdown format
- **Backup/Restore**: Full data backup and restore functionality
- **Local Storage**: All data stored locally in your browser (IndexedDB)

## 📥 Download & Install

### Download Desktop App

Go to [Releases](https://github.com/ssbsunshengbo/perfectmd/releases) page and download the installer for your platform:

| Platform | Download |
|----------|----------|
| Windows | `.msi` or `.exe` installer |
| macOS | `.dmg` installer |
| Linux | `.deb` or `.AppImage` |

### Run from Source

```bash
# Clone the repository
git clone https://github.com/ssbsunshengbo/perfectmd.git
cd perfectmd

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

## 🚀 Deploy Your Own

### Deploy to Vercel (Online Version)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ssbsunshengbo/perfectmd)

### Build Desktop App Locally

**Prerequisites:**
- Node.js 18+
- Rust (install from https://rustup.rs)

```bash
# Install dependencies
npm install

# Build desktop app
npm run tauri:build
```

The installers will be in `src-tauri/target/release/bundle/`.

## 🔧 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Storage**: IndexedDB (browser local storage)
- **Desktop**: [Tauri 2.0](https://tauri.app/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 💾 Data Storage

This application uses **IndexedDB** for local storage:
- All data stored in your browser/device
- No server required
- Works offline
- Export/backup feature available

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + U` | Underline |
| `Ctrl/Cmd + S` | Save document |
| `Tab` | Insert indentation |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License.

---

Made with ❤️
