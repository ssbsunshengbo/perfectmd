import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImage = './upload/PerfectMD图标设计.png';
const iconsDir = './src-tauri/icons';

async function convertIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Load source image and ensure RGBA format
  const source = sharp(sourceImage);
  const metadata = await source.metadata();
  console.log('Source image metadata:', metadata);

  // Generate different sizes
  const sizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    { name: '512x512.png', size: 512 },
    { name: 'icon.png', size: 1024 },
  ];

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await source
      .clone()
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath}`);
  }

  // Generate ICO for Windows
  const icoBuffer = await source
    .clone()
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
  
  // For ICO, we'll use the PNG directly as Tauri supports PNG for ICO
  await source
    .clone()
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toFile(path.join(iconsDir, 'icon.ico'));
  console.log('Generated: icon.ico');

  // Generate ICNS for macOS - Tauri uses png2icns internally
  // We'll create a 1024x1024 icon and let Tauri handle the rest
  await source
    .clone()
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toFile(path.join(iconsDir, 'icon.icns'));
  console.log('Generated: icon.icns (placeholder, Tauri will convert)');

  console.log('All icons generated successfully!');
}

convertIcons().catch(console.error);
