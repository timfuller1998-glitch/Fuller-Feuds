#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = 'C:\\Users\\Timothy\\Fuller-Fueds\\website icon.png';
const publicDir = path.resolve(__dirname, '..', 'public');
const outputPath = path.join(publicDir, 'logo.png');

async function createLogo() {
  try {
    console.log(`Reading source image from: ${sourcePath}`);
    
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Create logo.png - using 512x512 for good quality
    console.log(`Creating logo.png (512x512)...`);
    
    await sharp(sourcePath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Created logo.png at ${outputPath}`);
  } catch (error) {
    console.error('Error creating logo:', error);
    process.exit(1);
  }
}

createLogo();

