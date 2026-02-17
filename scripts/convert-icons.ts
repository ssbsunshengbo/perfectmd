import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceIcon = path.join(process.cwd(), 'app-icon-new.png');
const iconsDir = path.join(process.cwd(), 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function createIcons() {
  console.log('Creating icons from', sourceIcon);

  // Create PNG icons of various sizes
  const sizes = [
    [32, '32x32.png'],
    [128, '128x128.png'],
    [256, '128x128@2x.png'],
    [512, '512x512.png'],
    [1024, 'icon.png']
  ];

  for (const [size, name] of sizes) {
    await sharp(sourceIcon)
      .resize(size as number, size as number)
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconsDir, name));
    console.log(`Created ${name}`);
  }

  // Create ICO for Windows (multi-resolution) - ensure RGBA format
  const size16 = await sharp(sourceIcon).resize(16, 16).ensureAlpha().png().toBuffer();
  const size32 = await sharp(sourceIcon).resize(32, 32).ensureAlpha().png().toBuffer();
  const size48 = await sharp(sourceIcon).resize(48, 48).ensureAlpha().png().toBuffer();
  const size64 = await sharp(sourceIcon).resize(64, 64).ensureAlpha().png().toBuffer();
  const size128 = await sharp(sourceIcon).resize(128, 128).ensureAlpha().png().toBuffer();
  const size256 = await sharp(sourceIcon).resize(256, 256).ensureAlpha().png().toBuffer();

  // Create ICO with multiple images (PNG format inside ICO)
  const ico = createIco([
    { width: 16, height: 16, data: size16 },
    { width: 32, height: 32, data: size32 },
    { width: 48, height: 48, data: size48 },
    { width: 64, height: 64, data: size64 },
    { width: 128, height: 128, data: size128 },
    { width: 256, height: 256, data: size256 },
  ]);
  
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
  console.log('Created icon.ico');

  // For ICNS, we use PNG (macOS handles this)
  await sharp(sourceIcon)
    .resize(512, 512)
    .ensureAlpha()
    .png()
    .toFile(path.join(iconsDir, 'icon.icns'));
  console.log('Created icon.icns');

  console.log('All icons created successfully!');
  console.log('Files:', fs.readdirSync(iconsDir));
}

function createIco(images: { width: number; height: number; data: Buffer }[]): Buffer {
  const numImages = images.length;
  
  // ICO header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  // Calculate offsets
  const headerSize = 6;
  const dirSize = 16 * numImages;
  let offset = headerSize + dirSize;

  const entries: Buffer[] = [];
  const imageData: Buffer[] = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);   // Width (0 = 256)
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2);       // Color palette
    entry.writeUInt8(0, 3);       // Reserved
    entry.writeUInt16LE(1, 4);    // Color planes
    entry.writeUInt16LE(32, 6);   // Bits per pixel
    entry.writeUInt32LE(img.data.length, 8);  // Image data size
    entry.writeUInt32LE(offset, 12);     // Offset to image data

    entries.push(entry);
    imageData.push(img.data);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...entries, ...imageData]);
}

createIcons().catch(console.error);
