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

// Generate different sizes - RGBA format required for Tauri
const sizes = [32, 128, 256, 512]

async function generateIcons() {
  console.log('Generating icons from:', sourceIcon)
  
  // Load source image and ensure it has alpha channel
  const image = sharp(sourceIcon)
  
  // Helper function to generate RGBA PNG
  const generateRgbaPng = async (size: number): Promise<Buffer> => {
    return image
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .ensureAlpha() // Ensure alpha channel exists
      .png({ 
        compressionLevel: 6,
        force: true // Force PNG output
      })
      .toBuffer()
  }

  // Generate PNG files for each size
  for (const size of sizes) {
    const outputPath = join(ICONS_DIR, size === 256 ? '128x128@2x.png' : `${size}x${size}.png`)
    const buffer = await generateRgbaPng(size)
    writeFileSync(outputPath, buffer)
    console.log(`Generated: ${outputPath}`)
  }
  
  // Generate icon.png (512x512)
  const iconPngBuffer = await generateRgbaPng(512)
  writeFileSync(join(ICONS_DIR, 'icon.png'), iconPngBuffer)
  console.log('Generated: icon.png')
  
  // Generate ICO file for Windows (proper format)
  try {
    // Generate ICO from multiple PNG sizes - all in RGBA
    const icoBuffer = await pngToIco([
      await generateRgbaPng(16),
      await generateRgbaPng(32),
      await generateRgbaPng(48),
      await generateRgbaPng(64),
      await generateRgbaPng(128),
      await generateRgbaPng(256),
    ])
    
    writeFileSync(join(ICONS_DIR, 'icon.ico'), icoBuffer)
    console.log('Generated: icon.ico (proper Windows ICO format)')
  } catch (error) {
    console.error('Failed to generate ICO:', error)
    throw error
  }
  
  // Generate ICNS for macOS - using 512x512 RGBA PNG
  const icnsBuffer = await generateRgbaPng(512)
  writeFileSync(join(ICONS_DIR, 'icon.icns'), icnsBuffer)
  console.log('Generated: icon.icns (placeholder - needs proper conversion for macOS)')
  
  console.log('\n✅ All icons generated successfully!')
}

generateIcons().catch(console.error)
