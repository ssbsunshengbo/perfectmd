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
    id: 'blue-gradient',
    name: '蓝白渐变背景',
    description: '清爽的蓝色渐变背景，适合长时间阅读',
    preview: {
      bgColor: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)',
      textColor: '#1e3a5f',
      accentColor: '#0284c7'
    },
    css: `/* 蓝白渐变背景主题 */
.prose-editor {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #1e3a5f;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #0c4a6e;
  font-size: 2em;
  font-weight: 700;
  border-bottom: 2px solid #0284c7;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.prose-editor h2 {
  color: #075985;
  font-size: 1.5em;
  border-bottom: 1px solid #38bdf8;
  padding-bottom: 8px;
}

.prose-editor h3 {
  color: #0369a1;
  font-size: 1.25em;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #0284c7;
  text-decoration: underline;
}

.prose-editor blockquote {
  border-left: 4px solid #0284c7;
  background: rgba(255, 255, 255, 0.5);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #334155;
}

.prose-editor code {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
}

.prose-editor pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li {
  margin: 8px 0;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #0284c7, transparent);
  margin: 30px 0;
}

/* 选中文本样式 */
::selection {
  background: #0284c7;
  color: white;
}`
  },
  {
    id: 'paper-style',
    name: '纸张风格',
    description: '模拟真实纸张效果，柔和护眼',
    preview: {
      bgColor: '#f5f5dc',
      textColor: '#3d3d3d',
      accentColor: '#8b4513'
    },
    css: `/* 纸张风格主题 - 模拟真实纸张 */
.prose-editor {
  background: #faf8f0;
  min-height: 100%;
  padding: 50px 60px;
  box-shadow: 
    0 0 10px rgba(0,0,0,0.05),
    inset 0 0 80px rgba(0,0,0,0.02);
  border-radius: 4px;
  position: relative;
}

/* 添加纸张线条效果 */
.prose-editor::before {
  content: '';
  position: absolute;
  left: 50px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 100, 100, 0.3);
}

.prose-editor {
  color: #2d2d2d;
  font-family: 'Times New Roman', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 2;
}

.prose-editor h1 {
  color: #8b4513;
  font-size: 2em;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 3px double #8b4513;
}

.prose-editor h2 {
  color: #5d3a1a;
  font-size: 1.5em;
  margin-top: 30px;
  border-bottom: 1px solid #ccc;
  padding-bottom: 8px;
}

.prose-editor h3 {
  color: #4a3520;
  font-size: 1.25em;
}

.prose-editor p {
  text-indent: 2em;
  margin: 1em 0;
}

.prose-editor a {
  color: #8b4513;
  text-decoration: underline;
}

.prose-editor blockquote {
  border-left: 4px solid #8b4513;
  background: #fffef5;
  padding: 15px 25px;
  margin: 20px 30px;
  font-style: italic;
  color: #555;
}

.prose-editor code {
  background: #f0ebe0;
  color: #8b4513;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.prose-editor pre {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 20px 25px;
  margin: 20px 30px;
  border-radius: 4px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 30px;
  text-indent: 0;
}

.prose-editor li {
  margin: 5px 0;
}

/* 选中文本样式 */
::selection {
  background: #d4a574;
  color: white;
}`
  },
  {
    id: 'dark-elegant',
    name: '暗黑优雅',
    description: '深色背景，适合夜间写作',
    preview: {
      bgColor: '#1a1a2e',
      textColor: '#eaeaea',
      accentColor: '#e94560'
    },
    css: `/* 暗黑优雅主题 - 深色背景 */
.prose-editor {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #eaeaea;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #ffffff;
  font-size: 2.2em;
  font-weight: 600;
  background: linear-gradient(90deg, #e94560, #0f3460);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 25px;
}

.prose-editor h2 {
  color: #e94560;
  font-size: 1.6em;
  padding-bottom: 8px;
  border-bottom: 1px solid #e94560;
}

.prose-editor h3 {
  color: #f1f1f1;
  font-size: 1.3em;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #4fc3f7;
  text-decoration: none;
  border-bottom: 1px dashed #4fc3f7;
}

.prose-editor a:hover {
  color: #81d4fa;
  border-bottom-style: solid;
}

.prose-editor blockquote {
  border-left: 4px solid #e94560;
  background: rgba(233, 69, 96, 0.1);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #b0b0b0;
}

.prose-editor code {
  background: rgba(79, 195, 247, 0.15);
  color: #4fc3f7;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
}

.prose-editor pre {
  background: #0d0d1a;
  border: 1px solid #333;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: #eaeaea;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #e94560;
}

.prose-editor hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #e94560, transparent);
  margin: 30px 0;
}

/* 选中文本样式 */
::selection {
  background: #e94560;
  color: white;
}`
  },
  {
    id: 'nature-green',
    name: '自然绿意',
    description: '清新的绿色调，回归自然',
    preview: {
      bgColor: '#e8f5e9',
      textColor: '#1b5e20',
      accentColor: '#4caf50'
    },
    css: `/* 自然绿意主题 - 清新绿色调 */
.prose-editor {
  background: linear-gradient(to bottom, #e8f5e9 0%, #c8e6c9 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #1b5e20;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.9;
}

.prose-editor h1 {
  color: #1b5e20;
  font-size: 2em;
  text-align: center;
  margin-bottom: 25px;
  position: relative;
  padding-bottom: 15px;
}

.prose-editor h1::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, #4caf50, #81c784);
  border-radius: 2px;
}

.prose-editor h2 {
  color: #2e7d32;
  font-size: 1.5em;
  margin-top: 30px;
  padding-left: 15px;
  border-left: 4px solid #4caf50;
}

.prose-editor h3 {
  color: #388e3c;
  font-size: 1.25em;
  padding-left: 10px;
  border-left: 3px solid #81c784;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #2e7d32;
  text-decoration: underline;
  text-decoration-color: #81c784;
}

.prose-editor blockquote {
  border-left: 4px solid #4caf50;
  background: rgba(255, 255, 255, 0.6);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #2e7d32;
}

.prose-editor code {
  background: rgba(76, 175, 80, 0.15);
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
}

.prose-editor pre {
  background: #1b5e20;
  color: #e8f5e9;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #4caf50;
}

/* 选中文本样式 */
::selection {
  background: #4caf50;
  color: white;
}`
  },
  {
    id: 'sunset-warm',
    name: '暖阳黄昏',
    description: '温暖的橙黄调，舒适惬意',
    preview: {
      bgColor: '#fff3e0',
      textColor: '#5d4037',
      accentColor: '#ff9800'
    },
    css: `/* 暖阳黄昏主题 - 温暖橙黄色调 */
.prose-editor {
  background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 50%, #ffe0b2 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #5d4037;
  font-family: 'Georgia', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #e65100;
  font-size: 2em;
  font-weight: bold;
  text-align: center;
  margin-bottom: 25px;
  text-shadow: 1px 1px 2px rgba(230, 81, 0, 0.2);
}

.prose-editor h2 {
  color: #ef6c00;
  font-size: 1.5em;
  border-bottom: 2px solid #ffcc80;
  padding-bottom: 8px;
}

.prose-editor h3 {
  color: #f57c00;
  font-size: 1.25em;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #e65100;
  text-decoration: underline;
  text-decoration-color: #ffb74d;
}

.prose-editor a:hover {
  color: #bf360c;
}

.prose-editor blockquote {
  border-left: 4px solid #ff9800;
  background: rgba(255, 255, 255, 0.5);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #6d4c41;
  font-style: italic;
}

.prose-editor code {
  background: rgba(255, 152, 0, 0.2);
  color: #e65100;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
}

.prose-editor pre {
  background: #3e2723;
  color: #fff8e1;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: inherit;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #ff9800;
}

.prose-editor hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ff9800, transparent);
  margin: 30px 0;
}

/* 选中文本样式 */
::selection {
  background: #ff9800;
  color: white;
}`
  },
  {
    id: 'minimalist',
    name: '极简纯净',
    description: '极简设计，专注内容',
    preview: {
      bgColor: '#ffffff',
      textColor: '#333333',
      accentColor: '#666666'
    },
    css: `/* 极简纯净主题 - 简约设计 */
.prose-editor {
  background: #ffffff;
  min-height: 100%;
  padding: 50px 60px;
}

.prose-editor {
  color: #333333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: 16px;
  line-height: 1.7;
  font-weight: 400;
}

.prose-editor h1 {
  color: #111111;
  font-size: 2.2em;
  font-weight: 600;
  margin-bottom: 30px;
  letter-spacing: -0.02em;
}

.prose-editor h2 {
  color: #222222;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 35px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.prose-editor h3 {
  color: #333333;
  font-size: 1.3em;
  font-weight: 600;
  margin-top: 25px;
}

.prose-editor p {
  margin: 1.2em 0;
}

.prose-editor a {
  color: #333333;
  text-decoration: underline;
  text-decoration-color: #999;
  text-underline-offset: 3px;
}

.prose-editor a:hover {
  text-decoration-color: #333;
}

.prose-editor blockquote {
  border-left: 3px solid #ddd;
  padding: 10px 0 10px 20px;
  margin: 20px 0;
  color: #666;
}

.prose-editor code {
  background: #f5f5f5;
  color: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.9em;
}

.prose-editor pre {
  background: #fafafa;
  border: 1px solid #eee;
  padding: 20px;
  border-radius: 4px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li {
  margin: 6px 0;
}

.prose-editor hr {
  border: none;
  height: 1px;
  background: #e0e0e0;
  margin: 40px 0;
}

/* 选中文本样式 */
::selection {
  background: #b3d9ff;
  color: #000;
}`
  },
  {
    id: 'ocean-deep',
    name: '深海幽蓝',
    description: '深邃的海洋蓝色，宁静致远',
    preview: {
      bgColor: '#0a192f',
      textColor: '#8892b0',
      accentColor: '#64ffda'
    },
    css: `/* 深海幽蓝主题 - 深蓝色调 */
.prose-editor {
  background: linear-gradient(180deg, #0a192f 0%, #112240 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #8892b0;
  font-family: 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #ccd6f6;
  font-size: 2.2em;
  font-weight: 700;
  margin-bottom: 30px;
}

.prose-editor h2 {
  color: #a8b2d1;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 35px;
  padding-bottom: 10px;
  border-bottom: 1px solid #233554;
}

.prose-editor h3 {
  color: #ccd6f6;
  font-size: 1.3em;
  font-weight: 600;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #64ffda;
  text-decoration: none;
  position: relative;
}

.prose-editor a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: #64ffda;
  transition: width 0.3s;
}

.prose-editor a:hover::after {
  width: 100%;
}

.prose-editor blockquote {
  border-left: 3px solid #64ffda;
  background: rgba(100, 255, 218, 0.05);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 4px 4px 0;
  color: #a8b2d1;
}

.prose-editor code {
  background: rgba(100, 255, 218, 0.1);
  color: #64ffda;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.prose-editor pre {
  background: #112240;
  border: 1px solid #233554;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: #8892b0;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #64ffda;
}

.prose-editor hr {
  border: none;
  height: 1px;
  background: #233554;
  margin: 40px 0;
}

/* 选中文本样式 */
::selection {
  background: rgba(100, 255, 218, 0.3);
  color: #ccd6f6;
}`
  },
  {
    id: 'purple-dream',
    name: '梦幻紫罗兰',
    description: '优雅的紫色调，浪漫梦幻',
    preview: {
      bgColor: '#2d1b4e',
      textColor: '#e1d5f0',
      accentColor: '#a855f7'
    },
    css: `/* 梦幻紫罗兰主题 - 浪漫紫色 */
.prose-editor {
  background: linear-gradient(135deg, #1e1133 0%, #2d1b4e 50%, #3d1f6d 100%);
  min-height: 100%;
  padding: 40px;
  border-radius: 8px;
}

.prose-editor {
  color: #e1d5f0;
  font-family: 'Crimson Text', 'Noto Serif SC', serif;
  font-size: 16px;
  line-height: 1.8;
}

.prose-editor h1 {
  color: #f3e8ff;
  font-size: 2.2em;
  font-weight: 700;
  text-align: center;
  margin-bottom: 30px;
  background: linear-gradient(90deg, #c084fc, #a855f7, #9333ea);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.prose-editor h2 {
  color: #e9d5ff;
  font-size: 1.6em;
  font-weight: 600;
  margin-top: 35px;
  padding-bottom: 10px;
  border-bottom: 1px solid #7c3aed;
}

.prose-editor h3 {
  color: #f3e8ff;
  font-size: 1.3em;
  font-weight: 600;
}

.prose-editor p {
  margin: 1em 0;
}

.prose-editor a {
  color: #c084fc;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s;
}

.prose-editor a:hover {
  border-bottom-color: #c084fc;
}

.prose-editor blockquote {
  border-left: 3px solid #a855f7;
  background: rgba(168, 85, 247, 0.1);
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
  color: #d8b4fe;
}

.prose-editor code {
  background: rgba(192, 132, 252, 0.2);
  color: #e9d5ff;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
}

.prose-editor pre {
  background: #1e1133;
  border: 1px solid #581c87;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.prose-editor pre code {
  background: transparent;
  color: #e1d5f0;
  padding: 0;
}

.prose-editor ul, .prose-editor ol {
  padding-left: 25px;
}

.prose-editor li::marker {
  color: #c084fc;
}

.prose-editor hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #a855f7, transparent);
  margin: 40px 0;
}

/* 选中文本样式 */
::selection {
  background: rgba(168, 85, 247, 0.4);
  color: #f3e8ff;
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
\`\`\`

### 实用技巧

**1. 背景渐变**
\`\`\`css
background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
\`\`\`

**2. 毛玻璃效果**
\`\`\`css
background: rgba(255,255,255,0.7);
backdrop-filter: blur(10px);
\`\`\`

**3. 标题下划线装饰**
\`\`\`css
border-bottom: 2px solid #007bff;
padding-bottom: 10px;
\`\`\`

**4. 引用块样式**
\`\`\`css
border-left: 4px solid #007bff;
padding: 15px 20px;
background: #f5f5f5;
border-radius: 0 8px 8px 0;
\`\`\`

**5. 代码块样式**
\`\`\`css
background: #2d2d2d;
color: #f8f8f2;
padding: 20px;
border-radius: 8px;
\`\`\`
`
