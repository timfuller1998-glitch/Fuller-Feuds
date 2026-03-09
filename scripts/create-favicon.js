#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = 'C:\\Users\\Timothy\\Fuller-Fueds\\website icon.png';
const publicDir = path.resolve(__dirname, '..', 'public');
const outputPath = path.join(publicDir, 'favicon.ico');

async function createFavicon() {
  try {
    console.log(`Reading source image from: ${sourcePath}`);
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Create favicon.ico - ICO format typically contains multiple sizes
    // We'll create a 32x32 version which is the most common favicon size
    console.log(`Creating favicon.ico (32x32)...`);
    
    await sharp(sourcePath)
      .resize(32, 32, {
        fit: 'contain',
        position: 'center',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Created favicon.ico at ${outputPath}`);
    console.log(`Note: Modern browsers accept PNG format with .ico extension`);
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFavicon();

