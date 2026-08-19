
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const inputPath = path.join(projectRoot, 'Identité Visuelle', 'LOGO', 'Version Colorée', 'PNG', 'LogoIcon.png');
const outputPath = path.join(projectRoot, 'public', 'app-icon-square.png');

async function generateIcon() {
    try {
        const size = 1024;
        const padding = 150; // Increased padding for better visual balance in a rounded shape
        const radius = 200; // Radius for rounded corners

        // Create a rounded rectangle SVG background
        const roundedBg = Buffer.from(
            `<svg width="${size}" height="${size}">
        <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/>
      </svg>`
        );

        // Load logo
        const logo = sharp(inputPath);

        // Resize logo to fit inside with padding
        const logoBuffer = await logo
            .resize({
                width: size - (padding * 2),
                height: size - (padding * 2),
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Composite logo onto rounded white background
        await sharp(roundedBg)
            .composite([{ input: logoBuffer, gravity: 'center' }])
            .toFile(outputPath);

        console.log(`Generated rounded icon at ${outputPath}`);
    } catch (err) {
        console.error('Error generating icon:', err);
        process.exit(1);
    }
}

generateIcon();
