// Génère les assets de l'app (icône, adaptive, monochrome, splash, favicon)
// à partir du logo « texte censuré » : trois barres, celle du milieu en jaune.
// Usage : node scripts/generate-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const NAVY = '#0D1321';
const MUTED = '#242F49';
const ACCENT = '#FFD449';

// Trois barres arrondies façon texte spoiler masqué.
function bars(color1, color2, color3) {
  return `
    <rect x="232" y="330" width="560" height="96" rx="48" fill="${color1}"/>
    <rect x="232" y="464" width="430" height="96" rx="48" fill="${color2}"/>
    <rect x="232" y="598" width="510" height="96" rx="48" fill="${color3}"/>
  `;
}

const svg = (content, background = 'none') => `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${background !== 'none' ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  ${content}
</svg>`;

const iconSvg = svg(bars(MUTED, ACCENT, MUTED), NAVY);
const foregroundSvg = svg(bars(MUTED, ACCENT, MUTED));
const monochromeSvg = svg(bars('#FFFFFF', '#FFFFFF', '#FFFFFF'));
const splashSvg = svg(bars(MUTED, ACCENT, MUTED));

mkdirSync('assets', { recursive: true });

const jobs = [
  ['assets/icon.png', iconSvg, 1024],
  ['assets/android-icon-foreground.png', foregroundSvg, 1024],
  ['assets/android-icon-monochrome.png', monochromeSvg, 1024],
  ['assets/splash-icon.png', splashSvg, 1024],
  ['assets/favicon.png', iconSvg, 48],
];

for (const [file, source, size] of jobs) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  console.log('✓', file);
}

// Fond uni pour l'adaptive icon Android.
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: NAVY },
})
  .png()
  .toFile('assets/android-icon-background.png');
console.log('✓ assets/android-icon-background.png');
