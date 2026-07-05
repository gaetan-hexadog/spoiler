// Génère les assets de l'app (icône iOS, adaptive Android, monochrome, splash,
// favicon, logo UI) à partir du logo PopcornLog : seau de pop-corn rayé +
// coche « vu ». Usage : node scripts/generate-assets.mjs
//
// Méthode : on rend le logo, on le détoure (trim) pour obtenir sa vraie boîte
// englobante, puis on le recompose CENTRÉ sur chaque tuile avec la marge
// voulue (« le logo respire »). Le centrage est donc exact par construction.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const ICON_BG = '#26203C'; // fond des icônes (prune ; cf. app.json adaptiveIcon.backgroundColor)

// Version couleur (seau rayé + pop-corn + coche), en coordonnées natives.
const LOGO_COLOR = `
  <defs>
    <clipPath id="bucket">
      <path d="M72 112 L168 112 L156 196 Q120 204 84 196 Z"/>
    </clipPath>
  </defs>
  <g>
    <circle cx="120" cy="80"  r="19" fill="#FFC94D"/>
    <circle cx="94"  cy="92"  r="16" fill="#FFE9B8"/>
    <circle cx="146" cy="92"  r="16" fill="#FFE9B8"/>
    <circle cx="107" cy="99"  r="13" fill="#FFC94D"/>
    <circle cx="133" cy="99"  r="13" fill="#FFC94D"/>
  </g>
  <g clip-path="url(#bucket)">
    <rect x="60" y="106" width="120" height="104" fill="#FFF6E3"/>
    <path d="M72 106 L91.2 106 L98.4 210 L84 210 Z" fill="#E6484D"/>
    <path d="M110.4 106 L129.6 106 L127.2 210 L112.8 210 Z" fill="#E6484D"/>
    <path d="M148.8 106 L168 106 L156 210 L141.6 210 Z" fill="#E6484D"/>
  </g>
  <path d="M72 112 L168 112 L156 196 Q120 204 84 196 Z" fill="none" stroke="#1E1B33" stroke-width="4"/>
  <rect x="64" y="100" width="112" height="16" rx="8" fill="#FFF6E3" stroke="#1E1B33" stroke-width="4"/>
  <path d="M97 152 L116 172 L149 130" fill="none" stroke="#1E1B33" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M97 152 L116 172 L149 130" fill="none" stroke="#FFC94D" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;

// Version monochrome (icône thématique Android) : silhouette blanche pleine,
// avec la coche « vu » évidée pour rester lisible.
const LOGO_MONO = `
  <defs>
    <mask id="cut">
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="white"/>
      <path d="M97 152 L116 172 L149 130" fill="none" stroke="black" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g fill="#FFFFFF" mask="url(#cut)">
    <circle cx="120" cy="80"  r="19"/>
    <circle cx="94"  cy="92"  r="16"/>
    <circle cx="146" cy="92"  r="16"/>
    <circle cx="107" cy="99"  r="13"/>
    <circle cx="133" cy="99"  r="13"/>
    <path d="M72 112 L168 112 L156 196 Q120 204 84 196 Z"/>
    <rect x="64" y="100" width="112" height="16" rx="8"/>
  </g>`;

// Rend le logo puis le détoure → PNG serré sur son contenu réel.
function trimmedLogo(markup) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="1440" height="1680">${markup}</svg>`;
  return sharp(Buffer.from(svg)).trim().png().toBuffer();
}

/** Recompose le logo détouré, centré sur une tuile carrée, occupant `p` (0–1). */
async function makeTile(logoBuf, { p, bg, size }) {
  const meta = await sharp(logoBuf).metadata();
  const scale = (p * size) / Math.max(meta.width, meta.height);
  const resized = await sharp(logoBuf)
    .resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
    })
    .toBuffer();
  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  return base.composite([{ input: resized, gravity: 'center' }]).png().toBuffer();
}

mkdirSync('assets', { recursive: true });

const color = await trimmedLogo(LOGO_COLOR);
const mono = await trimmedLogo(LOGO_MONO);

const jobs = [
  // iOS + fallback : plein cadre opaque, le logo respire (~62 %).
  ['assets/icon.png', color, { p: 0.62, bg: ICON_BG, size: 1024 }],
  // Android adaptive foreground : transparent, ~46 % (dans la safe zone).
  ['assets/android-icon-foreground.png', color, { p: 0.46, bg: null, size: 1024 }],
  // Android monochrome (icône thématique) : silhouette + coche évidée.
  ['assets/android-icon-monochrome.png', mono, { p: 0.46, bg: null, size: 1024 }],
  // Splash : logo transparent (le fond #0D1321 vient d'expo-splash-screen).
  ['assets/splash-icon.png', color, { p: 0.8, bg: null, size: 1024 }],
  // Favicon web : petit → fond + logo un peu plus grand (~68 %).
  ['assets/favicon.png', color, { p: 0.68, bg: ICON_BG, size: 64 }],
  // Logo UI in-app (sidebar / écrans d'auth) : transparent, resserré.
  ['assets/logo.png', color, { p: 0.92, bg: null, size: 512 }],
];

for (const [file, buf, opts] of jobs) {
  await sharp(await makeTile(buf, opts)).toFile(file);
  console.log('✓', file);
}

// Fond uni pour l'adaptive icon Android (au cas où le backgroundImage est utilisé).
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ICON_BG },
})
  .png()
  .toFile('assets/android-icon-background.png');
console.log('✓ assets/android-icon-background.png');
