import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'models', 'textures');
await mkdir(output, { recursive: true });

const width = 2048;
const height = 1024;
const regions = {};
const layers = [];
const journeyNotes = [
  ['androbox', 'FOUNDATIONS · FORMACIÓN', 'SMR · DAM · SPRING'],
  ['komea', 'BACKEND · EQUIPO', 'REWIRE · JAVA · SPRING BOOT'],
  ['avisia', 'FREELANCE · DESARROLLO', 'INTEGRATIONS · AUTOMATION'],
  ['vantagesystems', 'AEROSPACE · AEROESPACIAL', 'DHV TECHNOLOGY · PRECISION'],
];
for (const [index, [slug, title, detail]] of journeyNotes.entries()) {
  const x = (index % 2) * 512;
  const y = Math.floor(index / 2) * 352;
  layers.push({
    input: Buffer.from(`<svg width="512" height="352" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="352" fill="#eee9dc"/>
      <path d="M18 18h476v316H18z" fill="#f4f0e5" stroke="#b7a987" stroke-width="3"/>
      <circle cx="44" cy="48" r="9" fill="#bd9560"/>
      <text x="38" y="132" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#354246">${title}</text>
      <path d="M38 157h436" stroke="#c9c0ae" stroke-width="2"/>
      <text x="38" y="207" font-family="Arial,sans-serif" font-size="22" fill="#59615a">${detail}</text>
      <text x="38" y="292" font-family="Arial,sans-serif" font-size="15" letter-spacing="2" fill="#8b806d">ADRROOM · NOTES</text>
    </svg>`),
    left: x, top: y,
  });
  regions[slug] = [x, y, 512, 352];
}
const panorama = await sharp(path.join(root, 'public', 'malaga-panorama.webp'))
  .resize(1024, 640, { fit: 'cover' }).png().toBuffer();
layers.push({ input: panorama, left: 1024, top: 0 });
regions.malaga = [1024, 0, 1024, 640];

for (const [index, text] of [
  'MY JOURNEY / MI TRAYECTORIA',
  'SKILLS / HABILIDADES',
  'EXPERIENCE / EXPERIENCIA',
].entries()) {
  const x = index * 640;
  layers.push({
    input: Buffer.from(`<svg width="640" height="128" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="128" fill="${index === 1 ? '#ded6b2' : '#ebe7d8'}"/>
      <text x="28" y="79" font-family="Arial,sans-serif" font-size="38" fill="#3a4541">${text}</text>
    </svg>`),
    left: x, top: 832,
  });
  regions[`note${index}`] = [x, 832, 640, 128];
}

const atlasPath = path.join(output, 'room-prints.png');
await sharp({ create: { width, height, channels: 3, background: '#ded9cb' } })
  .composite(layers).png({ compressionLevel: 9 }).toFile(atlasPath);
// Keep lossless authoring sources; embed compact opaque photographs in glTF.
await sharp(atlasPath).jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
  .toFile(path.join(output, 'room-prints.jpg'));
await sharp(path.join(root, 'models', 'MalagaTardePanoramica.png'))
  .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
  .toFile(path.join(output, 'malaga-panorama.jpg'));
await writeFile(path.join(output, 'room-prints.json'), JSON.stringify({
  width, height, regions,
   sources: ['career-note-atlas', 'public/malaga-panorama.webp'],
}, null, 2) + '\n');
console.log(`Created ${atlasPath} (${width}×${height}, ${Object.keys(regions).length} regions)`);
