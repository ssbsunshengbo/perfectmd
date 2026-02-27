import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// ICO file format constants
const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;

// PNG signature
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

async function createIco(sources: Array<{ size: number; buffer: Buffer }>): Promise<Buffer> {
  // Calculate total size
  const headerSize = ICONDIR_SIZE + (ICONDIRENTRY_SIZE * sources.length);
  let dataOffset = headerSize;
  let totalSize = headerSize;

  // Calculate sizes
  const entries = sources.map(({ size, buffer }) => {
    const entry = {
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      sizeInBytes: buffer.length,
      fileOffset: dataOffset,
      buffer
    };
    dataOffset += buffer.length;
    totalSize += buffer.length;
    return entry;
  });

  // Create buffer
  const ico = Buffer.alloc(totalSize);
  let offset = 0;

  // Write ICONDIR header
  ico.writeUInt16LE(0, offset); offset += 2; // Reserved, must be 0
  ico.writeUInt16LE(1, offset); offset += 2; // Type, 1 for ICO
  ico.writeUInt16LE(sources.length, offset); offset += 2; // Number of images

  // Write ICONDIRENTRY for each image
  for (const entry of entries) {
    ico.writeUInt8(entry.width, offset); offset += 1;
    ico.writeUInt8(entry.height, offset); offset += 1;
    ico.writeUInt8(entry.colorCount, offset); offset += 1;
    ico.writeUInt8(entry.reserved, offset); offset += 1;
    ico.writeUInt16LE(entry.planes, offset); offset += 2;
    ico.writeUInt16LE(entry.bitCount, offset); offset += 2;
    ico.writeUInt32LE(entry.sizeInBytes, offset); offset += 4;
    ico.writeUInt32LE(entry.fileOffset, offset); offset += 4;
  }

  // Write image data
  for (const entry of entries) {
    entry.buffer.copy(ico, offset);
    offset += entry.buffer.length;
  }

  return ico;
}

async function generateIcoFile() {
  const sourceImage = './upload/PerfectMD图标设计.png';
  const outputPath = './src-tauri/icons/icon.ico';

  // Generate PNG images of different sizes for ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const images: Array<{ size: number; buffer: Buffer }> = [];

  for (const size of sizes) {
    const buffer = await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    images.push({ size, buffer });
    console.log(`Generated PNG for size ${size}x${size}`);
  }

  // Create ICO file
  const icoBuffer = await createIco(images);
  fs.writeFileSync(outputPath, icoBuffer);
  console.log(`Created ICO file: ${outputPath} (${icoBuffer.length} bytes)`);
}

generateIcoFile().catch(console.error);
