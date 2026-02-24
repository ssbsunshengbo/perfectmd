#!/usr/bin/env bun
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'upload')
const ICONS_DIR = join(process.cwd(), 'src-tauri', 'icons')

// Find the icon file to use
const iconFiles = [
  'PerfectMD图标设计.png',
  'PerfectMD图标设计 (2).png',
  'c5db5cc478daa65f57c1824ff5701c14.png'
]

let sourceIcon: string | null = null
for (const file of iconFiles) {
  const path = join(UPLOAD_DIR, file)
  if (existsSync(path)) {
    sourceIcon = path
    console.log(`Found icon: ${file}`)
    break
  }
}

if (!sourceIcon) {
  console.error('No icon file found in upload directory')
  process.exit(1)
}

// Ensure icons directory exists
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true })
}

// Generate different sizes
const sizes = [32, 128, 256, 512]

async function generateIcons() {
  console.log('Generating icons from:', sourceIcon)
  
  // Load source image
  const image = sharp(sourceIcon)
  
  // Generate PNG files for each size
  for (const size of sizes) {
    const outputPath = join(ICONS_DIR, size === 256 ? '128x128@2x.png' : `${size}x${size}.png`)
    await image
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath)
    console.log(`Generated: ${outputPath}`)
  }
  
  // Generate icon.png (512x512)
  await image
    .clone()
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(join(ICONS_DIR, 'icon.png'))
  console.log('Generated: icon.png')
  
  // Generate ICO file for Windows (proper format)
  try {
    // Generate ICO from multiple PNG sizes
    const icoBuffer = await pngToIco([
      await image.clone().resize(16, 16).png().toBuffer(),
      await image.clone().resize(32, 32).png().toBuffer(),
      await image.clone().resize(48, 48).png().toBuffer(),
      await image.clone().resize(64, 64).png().toBuffer(),
      await image.clone().resize(128, 128).png().toBuffer(),
      await image.clone().resize(256, 256).png().toBuffer(),
    ])
    
    writeFileSync(join(ICONS_DIR, 'icon.ico'), icoBuffer)
    console.log('Generated: icon.ico (proper Windows ICO format)')
  } catch (error) {
    console.error('Failed to generate ICO:', error)
    throw error
  }
  
  // Generate ICNS for macOS (simplified - just copy 512x512 PNG)
  // For proper ICNS, we would need a specialized tool
  await image
    .clone()
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(join(ICONS_DIR, 'icon.icns'))
  console.log('Generated: icon.icns (placeholder - needs proper conversion for macOS)')
  
  console.log('\n✅ All icons generated successfully!')
}

generateIcons().catch(console.error)
