// Script to generate placeholder icons for the Chrome extension
const fs = require('fs');
const path = require('path');

// Define the icon sizes
const sizes = [16, 48, 128];

// Create the assets/icons directory if it doesn't exist
const iconDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
  console.log('Created directory:', iconDir);
}

// Generate an SVG placeholder for each size
sizes.forEach(size => {
  const iconPath = path.join(iconDir, `icon${size}.png`);
  
  // Simple SVG square with size dimensions
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1976d2" />
    <text x="${size/2}" y="${size/2}" font-family="Arial" font-size="${size/3}" fill="white" text-anchor="middle" dominant-baseline="middle">
      ${size}
    </text>
  </svg>`;
  
  // Save as SVG file instead of PNG (easier to create programmatically)
  const svgPath = iconPath.replace('.png', '.svg');
  fs.writeFileSync(svgPath, svgContent);
  
  console.log(`Created icon: ${svgPath}`);
});

console.log('\nIcon files have been generated.');
console.log('NOTE: These are SVG placeholders. For production, you should replace these with proper PNG icons.');