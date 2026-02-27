import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const iconsDir = path.join(process.cwd(), 'src-tauri', 'icons');
const sourceIcon = path.join(process.cwd(), 'icon-generated.png');

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
      .png()
      .toFile(path.join(iconsDir, name));
    console.log(`Created ${name}`);
  }

  // Create ICO for Windows (multi-resolution)
  const sizes32 = await sharp(sourceIcon).resize(32, 32).png().toBuffer();
  const sizes64 = await sharp(sourceIcon).resize(64, 64).png().toBuffer();
  const sizes128 = await sharp(sourceIcon).resize(128, 128).png().toBuffer();
  const sizes256 = await sharp(sourceIcon).resize(256, 256).png().toBuffer();

  // Create ICO with multiple images
  const ico = createIco([sizes32, sizes64, sizes128, sizes256]);
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
  console.log('Created icon.ico');

  // For ICNS, we just use the PNG (macOS will handle it)
  await sharp(sourceIcon)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon.icns'));
  console.log('Created icon.icns');

  console.log('All icons created successfully!');
  console.log('Files:', fs.readdirSync(iconsDir));
}

function createIco(pngBuffers: Buffer[]): Buffer {
  const numImages = pngBuffers.length;
  
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

  const sizes = [32, 64, 128, 256];

  for (let i = 0; i < numImages; i++) {
    const png = pngBuffers[i];
    const size = sizes[i];

    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);  // Width
    entry.writeUInt8(size >= 256 ? 0 : size, 1);  // Height
    entry.writeUInt8(0, 2);       // Color palette
    entry.writeUInt8(0, 3);       // Reserved
    entry.writeUInt16LE(1, 4);    // Color planes
    entry.writeUInt16LE(32, 6);   // Bits per pixel
    entry.writeUInt32LE(png.length, 8);  // Image size
    entry.writeUInt32LE(offset, 12);     // Offset

    entries.push(entry);
    imageData.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...imageData]);
}

createIcons().catch(console.error);
