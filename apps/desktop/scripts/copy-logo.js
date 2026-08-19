import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(projectRoot, 'Identité Visuelle', 'LOGO', 'Version Colorée', 'SVG', 'Horizontal Logo.svg');
const destPath = path.join(projectRoot, 'public', 'brand', 'logo-horizontal.svg');

try {
  // Ensure public directory exists
  const publicDir = path.dirname(destPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy the file
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ Logo copied successfully to public/logo-horizontal.svg');
} catch (error) {
  console.error('❌ Error copying logo:', error.message);
  console.log('Please manually copy:');
  console.log(`  From: ${sourcePath}`);
  console.log(`  To: ${destPath}`);
  process.exit(1);
}

