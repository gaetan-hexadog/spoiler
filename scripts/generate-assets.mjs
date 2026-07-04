// Génère les assets de l'app (icône, adaptive, monochrome, splash, favicon)
// à partir du logo PopcornLog : un seau de pop-corn jaune avec un triangle
// « lecture » creusé dans le seau (pop-corn = film/série + play = visionnage).
// Usage : node scripts/generate-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const NAVY = '#0D1321';
const ACCENT = '#FFD449';

// Pop-corn dessiné dans un repère 120×120 (mêmes coordonnées que le logo de l'UI).
// `pop` = couleur du seau + pop-corn ; `play` = couleur du triangle lecture
// (null pour l'omettre, ex. icône monochrome → silhouette pleine).
function popcornRaw(pop, play) {
  return `
    <g fill="${pop}">
      <circle cx="50" cy="39" r="8"/>
      <circle cx="60" cy="36.5" r="8.5"/>
      <circle cx="70" cy="39" r="8"/>
      <circle cx="43" cy="45" r="7.5"/>
      <circle cx="60" cy="44" r="7"/>
      <circle cx="77" cy="45" r="7.5"/>
      <circle cx="49" cy="50" r="7"/>
      <circle cx="60" cy="50.5" r="7"/>
      <circle cx="71" cy="50" r="7"/>
      <rect x="26" y="53" width="68" height="11" rx="5.5"/>
      <path d="M31 64 L89 64 L82 101 Q81 105 76 105 L44 105 Q39 105 38 101 Z"/>
    </g>
    ${play ? `<path d="M53 74 L53 95 L72 84.5 Z" fill="${play}"/>` : ''}`;
}

// Version centrée dans un canvas 1024, avec ~62 % d'occupation.
const svg = (pop, play, background = 'none') => `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${background !== 'none' ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  <g transform="translate(32,-20) scale(8)">
    ${popcornRaw(pop, play)}
  </g>
</svg>`;

const iconSvg = svg(ACCENT, NAVY, NAVY);
const foregroundSvg = svg(ACCENT, NAVY);
const monochromeSvg = svg('#FFFFFF', null);
const splashSvg = svg(ACCENT, NAVY);

mkdirSync('assets', { recursive: true });

// Logo resserré (fond transparent) pour l'UI de l'app.
const logoSvg = `
<svg width="360" height="410" viewBox="24 26 72 82" xmlns="http://www.w3.org/2000/svg">
  ${popcornRaw(ACCENT, NAVY)}
</svg>`;

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

await sharp(Buffer.from(logoSvg)).resize(512).png().toFile('assets/logo.png');
console.log('✓ assets/logo.png');

// Fond uni pour l'adaptive icon Android.
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: NAVY },
})
  .png()
  .toFile('assets/android-icon-background.png');
console.log('✓ assets/android-icon-background.png');
