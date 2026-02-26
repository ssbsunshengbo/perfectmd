import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// ICNS file format constants
const ICNS_HEADER_SIZE = 8;

// ICNS type codes for different sizes
const ICNS_TYPES = {
  'ic04': { size: 16, format: 'ARGB' },
  'ic05': { size: 32, format: 'ARGB' },
  'ic07': { size: 128, format: 'PNG' },
  'ic08': { size: 256, format: 'PNG' },
  'ic09': { size: 512, format: 'PNG' },
  'ic10': { size: 1024, format: 'PNG' },
  'ic11': { size: 32, format: 'PNG@2x' },
  'ic12': { size: 64, format: 'PNG@2x' },
  'ic13': { size: 256, format: 'PNG@2x' },
  'ic14': { size: 512, format: 'PNG@2x' },
};

async function createIcns(sourceImage: string, outputPath: string) {
  const chunks: Array<{ type: string; data: Buffer }> = [];

  // Generate PNG images for each type
  const pngSizes = [16, 32, 64, 128, 256, 512, 1024];
  const pngBuffers: Record<number, Buffer> = {};

  for (const size of pngSizes) {
    pngBuffers[size] = await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    console.log(`Generated PNG ${size}x${size}`);
  }

  // Add ICNS chunks
  const typesToAdd = [
    { type: 'ic07', size: 128 },
    { type: 'ic08', size: 256 },
    { type: 'ic09', size: 512 },
    { type: 'ic10', size: 1024 },
    { type: 'ic11', size: 32 },   // 16@2x
    { type: 'ic12', size: 64 },   // 32@2x
    { type: 'ic13', size: 256 },  // 128@2x
    { type: 'ic14', size: 512 },  // 256@2x
  ];

  for (const { type, size } of typesToAdd) {
    const data = pngBuffers[size];
    chunks.push({ type, data });
  }

  // Calculate total size
  let totalSize = ICNS_HEADER_SIZE;
  for (const chunk of chunks) {
    totalSize += 8 + chunk.data.length; // type(4) + size(4) + data
  }

  // Create ICNS buffer
  const icns = Buffer.alloc(totalSize);
  let offset = 0;

  // Write header
  icns.write('icns', offset); offset += 4;
  icns.writeUInt32BE(totalSize, offset); offset += 4;

  // Write chunks
  for (const chunk of chunks) {
    icns.write(chunk.type, offset); offset += 4;
    icns.writeUInt32BE(8 + chunk.data.length, offset); offset += 4;
    chunk.data.copy(icns, offset); offset += chunk.data.length;
  }

  fs.writeFileSync(outputPath, icns);
  console.log(`Created ICNS file: ${outputPath} (${icns.length} bytes)`);
}

createIcns('./upload/PerfectMD图标设计.png', './src-tauri/icons/icon.icns').catch(console.error);
