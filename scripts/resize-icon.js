#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = 'C:\\Users\\Timothy\\Fuller-Fueds\\website icon.png';
const publicDir = path.resolve(__dirname, '..', 'public');

// Icon sizes needed
const iconSizes = [
  { name: 'apple-touch-icon-180x180.png', size: 180 },
  { name: 'pwa-64x64.png', size: 64 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-icon-512x512.png', size: 512 }, // Same size but will be used for maskable
];

async function resizeIcons() {
  try {
    console.log(`Reading source image from: ${sourcePath}`);
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Resize to each required size
    for (const icon of iconSizes) {
      const outputPath = path.join(publicDir, icon.name);
      console.log(`Creating ${icon.name} (${icon.size}x${icon.size})...`);
      
      await sharp(sourcePath)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          position: 'center',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created ${icon.name}`);
    }

    console.log('\n✓ All icons created successfully!');
  } catch (error) {
    console.error('Error resizing icons:', error);
    process.exit(1);
  }
}

resizeIcons();

