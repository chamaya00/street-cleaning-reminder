// Create simple placeholder PNG icons
// These are minimal valid PNGs with a blue color

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // Create a simple solid color PNG

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);  // width
  ihdrData.writeUInt32BE(height, 4); // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(2, 9);         // color type (RGB)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk - image data
  // Create raw image data (filter byte + RGB for each pixel per row)
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawData[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      rawData[pixelStart] = r;     // R
      rawData[pixelStart + 1] = g; // G
      rawData[pixelStart + 2] = b; // B
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xffffffff;
  const table = makeCrcTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return crc ^ 0xffffffff;
}

function makeCrcTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

// Create icons (blue color: #3b82f6 = RGB 59, 130, 246)
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

const png192 = createPNG(192, 192, 59, 130, 246);
const png512 = createPNG(512, 512, 59, 130, 246);

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);

console.log('Created placeholder icons:');
console.log('  - public/icons/icon-192.png');
console.log('  - public/icons/icon-512.png');
console.log('');
console.log('These are simple blue squares. Replace with proper icons later.');
