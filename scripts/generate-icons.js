const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcons() {
  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    const pngPath = path.join(iconsDir, `icon${size}.png`);
    
    if (fs.existsSync(svgPath)) {
      // Convert existing SVG to PNG
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      
      console.log(`Generated icon${size}.png from SVG`);
    } else {
      // Generate a simple icon if SVG doesn't exist
      const svg = generateSimpleSvg(size);
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(pngPath);
      
      console.log(`Generated icon${size}.png from template`);
    }
  }
  
  console.log('All icons generated successfully!');
}

function generateSimpleSvg(size) {
  const radius = size * 0.45;
  const center = size / 2;
  const eyeRadius = size * 0.06;
  const eyeY = center - size * 0.08;
  const eyeOffset = size * 0.18;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${center}" cy="${center}" r="${radius}" fill="#FF6B6B"/>
    <circle cx="${center - eyeOffset}" cy="${eyeY}" r="${eyeRadius}" fill="white"/>
    <circle cx="${center + eyeOffset}" cy="${eyeY}" r="${eyeRadius}" fill="white"/>
    <path d="M${center - eyeOffset} ${center + size * 0.1} Q${center} ${center + size * 0.22} ${center + eyeOffset} ${center + size * 0.1}" 
          stroke="white" stroke-width="${size * 0.06}" stroke-linecap="round" fill="none"/>
  </svg>`;
}

generateIcons().catch(console.error);

