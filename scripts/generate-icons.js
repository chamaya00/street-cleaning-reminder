// Simple script to generate placeholder app icons
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple 1x1 blue PNG as base64, then we'll note to replace later
// For now, create a simple SVG that browsers can use

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#3b82f6"/>
  <g fill="white">
    <!-- Car icon -->
    <path d="M128 320c0-17.7 14.3-32 32-32h192c17.7 0 32 14.3 32 32v32c0 17.7-14.3 32-32 32H160c-17.7 0-32-14.3-32-32v-32z"/>
    <path d="M144 256l24-64c4-10.7 14.3-18 26-18h124c11.7 0 22 7.3 26 18l24 64"/>
    <circle cx="176" cy="336" r="24"/>
    <circle cx="336" cy="336" r="24"/>
    <!-- Broom/cleaning icon above car -->
    <path d="M256 100v80M220 120h72M236 140h40" stroke="white" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`;

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write SVG version (can be used directly in some contexts)
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), iconSvg);

console.log('Created icon.svg');
console.log('');
console.log('To create PNG icons, you can:');
console.log('1. Use an online converter (e.g., svgtopng.com)');
console.log('2. Install ImageMagick: brew install imagemagick');
console.log('   Then run: convert public/icons/icon.svg -resize 192x192 public/icons/icon-192.png');
console.log('            convert public/icons/icon.svg -resize 512x512 public/icons/icon-512.png');
console.log('');
console.log('For now, the app will work without icons (just show a default).');
