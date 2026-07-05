// Génère les assets de l'app (icône iOS, adaptive Android, monochrome, splash,
// favicon, logo UI) à partir du logo PopcornLog : seau de pop-corn rayé +
// coche « vu ». Usage : node scripts/generate-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const ICON_BG = '#26203C'; // fond des icônes (prune ; cf. app.json adaptiveIcon.backgroundColor)

// --- Logo en coordonnées natives (repère du SVG source) --------------------
// Boîte englobante réelle du dessin : x ∈ [62,178], y ∈ [61,206].
const CX = 120; // centre horizontal du contenu
const CY = 133.5; // centre vertical du contenu
const MAX_DIM = 145; // plus grande dimension (hauteur) → sert au cadrage

// Version couleur (seau rayé + pop-corn + coche).
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

/**
 * Compose une tuile carrée : le logo centré occupe `p` (0–1) de la tuile,
 * le reste est de la marge (le logo « respire »). `bg` = fond (ou null pour
 * transparent).
 */
function tile(content, p, bg) {
  const side = MAX_DIM / p;
  const vx = CX - side / 2;
  const vy = CY - side / 2;
  return `<svg width="1024" height="1024" viewBox="${vx} ${vy} ${side} ${side}" xmlns="http://www.w3.org/2000/svg">
    ${bg ? `<rect x="${vx}" y="${vy}" width="${side}" height="${side}" fill="${bg}"/>` : ''}
    ${content}
  </svg>`;
}

mkdirSync('assets', { recursive: true });

const jobs = [
  // iOS + fallback : plein cadre opaque, le logo respire (~62 %).
  ['assets/icon.png', tile(LOGO_COLOR, 0.62, ICON_BG), 1024],
  // Android adaptive foreground : transparent, ~46 % (dans la safe zone).
  ['assets/android-icon-foreground.png', tile(LOGO_COLOR, 0.46, null), 1024],
  // Android monochrome (icône thématique) : silhouette + coche évidée.
  ['assets/android-icon-monochrome.png', tile(LOGO_MONO, 0.46, null), 1024],
  // Splash : logo transparent (le fond #0D1321 vient d'expo-splash-screen).
  ['assets/splash-icon.png', tile(LOGO_COLOR, 0.8, null), 1024],
  // Favicon web : petit → fond + logo un peu plus grand (~68 %).
  ['assets/favicon.png', tile(LOGO_COLOR, 0.68, ICON_BG), 64],
  // Logo UI in-app (sidebar / écrans d'auth) : transparent, resserré.
  ['assets/logo.png', tile(LOGO_COLOR, 0.92, null), 512],
];

for (const [file, source, size] of jobs) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  console.log('✓', file);
}

// Fond uni pour l'adaptive icon Android (au cas où le backgroundImage est utilisé).
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ICON_BG },
})
  .png()
  .toFile('assets/android-icon-background.png');
console.log('✓ assets/android-icon-background.png');
