import sharp from 'sharp';

/**
 * Generates flat-lay style product illustrations for seed garments, so the
 * development closet looks like a closet without shipping third-party photos.
 * Output matches the production upload pipeline: WebP, 1200x1500 + 400x500 thumb.
 */

export type GarmentShape =
  | 'tshirt'
  | 'shirt'
  | 'sweater'
  | 'blazer'
  | 'coat'
  | 'pants'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'sneaker'
  | 'shoe'
  | 'heel'
  | 'bag'
  | 'watch'
  | 'robe';

export type GarmentPattern = 'solid' | 'wax' | 'stripes' | 'denim';

export interface GarmentArt {
  shape: GarmentShape;
  colorHex: string;
  pattern?: GarmentPattern;
  /** Secondary color for patterns and trims. */
  accentHex?: string;
}

const LONG_SLEEVE_BODY =
  'M128 86 L170 66 Q200 96 230 66 L272 86 Q300 120 318 200 L344 382 L306 390 L286 228 L284 436 L116 436 L114 228 L94 390 L56 382 L82 200 Q100 120 128 86 Z';

/** Side-view shoes are drawn small; scale them up around the canvas center. */
const SCALED_UP: ReadonlySet<GarmentShape> = new Set(['sneaker', 'shoe', 'heel']);

const SHAPES: Record<GarmentShape, { body: string; details?: string }> = {
  tshirt: {
    body: 'M126 92 L170 70 Q200 98 230 70 L274 92 L340 150 L304 190 L280 168 L280 424 L120 424 L120 168 L96 190 L60 150 Z',
    details: '<path d="M170 70 Q200 112 230 70" class="line"/>',
  },
  shirt: {
    body: LONG_SLEEVE_BODY,
    details:
      '<path d="M170 66 L186 104 L200 92 L214 104 L230 66" class="line"/><path d="M200 96 L200 436" class="line"/>' +
      [140, 200, 260, 320, 380]
        .map((y) => `<circle cx="207" cy="${y}" r="3.5" class="dot"/>`)
        .join(''),
  },
  sweater: {
    body: LONG_SLEEVE_BODY,
    details:
      '<path d="M166 68 Q200 108 234 68" class="line"/><path d="M118 410 L282 410" class="line"/>' +
      '<path d="M60 360 L98 366 M302 366 L340 360" class="line"/>',
  },
  blazer: {
    body: LONG_SLEEVE_BODY,
    details:
      '<path d="M170 66 L200 250 L230 66" class="line"/><path d="M170 66 L150 150 L190 190 M230 66 L250 150 L210 190" class="line"/>' +
      '<circle cx="200" cy="290" r="5" class="dot"/><circle cx="200" cy="340" r="5" class="dot"/>' +
      '<path d="M134 320 L176 320 M224 320 L266 320" class="line"/>',
  },
  coat: {
    body: 'M128 76 L170 58 Q200 90 230 58 L272 76 Q302 112 320 196 L346 400 L308 408 L288 226 L294 472 L106 472 L112 226 L92 408 L54 400 L80 196 Q98 112 128 76 Z',
    details:
      '<path d="M170 58 L200 230 L230 58" class="line"/><path d="M200 230 L200 472" class="line"/>' +
      [270, 330, 390]
        .map(
          (y) =>
            `<circle cx="186" cy="${y}" r="5" class="dot"/><circle cx="214" cy="${y}" r="5" class="dot"/>`,
        )
        .join(''),
  },
  pants: {
    body: 'M132 66 L268 66 L292 446 L222 446 L200 168 L178 446 L108 446 Z',
    details:
      '<path d="M132 92 L268 92" class="line"/><path d="M200 92 L200 168" class="line"/>' +
      '<path d="M146 92 Q150 130 176 132 M254 92 Q250 130 224 132" class="line"/>',
  },
  shorts: {
    body: 'M128 126 L272 126 L294 306 L216 318 L200 210 L184 318 L106 306 Z',
    details: '<path d="M128 152 L272 152" class="line"/><path d="M200 152 L200 210" class="line"/>',
  },
  skirt: {
    body: 'M150 112 L250 112 L304 404 Q200 428 96 404 Z',
    details:
      '<path d="M150 136 L250 136" class="line"/><path d="M178 136 L160 410 M222 136 L240 410" class="line"/>',
  },
  dress: {
    body: 'M166 58 L184 58 Q200 82 216 58 L234 58 L246 152 L230 204 L304 446 Q200 468 96 446 L170 204 L154 152 Z',
    details:
      '<path d="M158 204 L242 204" class="line"/><path d="M184 58 Q200 96 216 58" class="line"/>',
  },
  sneaker: {
    body: 'M62 336 Q66 278 132 266 L196 236 Q226 228 248 252 L328 290 Q362 304 358 344 L358 352 L62 352 Z',
    details:
      '<path d="M62 352 L358 352 L358 372 Q210 384 62 372 Z" class="sole"/>' +
      '<path d="M170 262 L196 300 M190 252 L216 290 M210 244 L236 282" class="line"/><path d="M96 316 Q200 300 320 312" class="line"/>',
  },
  shoe: {
    body: 'M66 320 Q84 270 158 268 Q222 270 262 292 L338 314 Q366 324 360 350 L66 350 Z',
    details:
      '<path d="M66 350 L360 350 L360 366 L66 366 Z" class="sole"/><path d="M168 276 Q206 300 250 296" class="line"/>',
  },
  heel: {
    body: 'M84 330 Q120 244 168 262 Q214 282 252 310 L330 330 Q356 338 348 356 L250 356 L236 346 L132 346 Q120 346 116 360 L84 360 Z',
    details:
      '<path d="M106 346 L118 346 L126 420 L112 420 Z" class="sole"/><path d="M150 268 Q190 300 236 316" class="line"/>',
  },
  bag: {
    body: 'M96 196 L304 196 Q322 196 324 214 L338 404 Q338 424 318 424 L82 424 Q62 424 62 404 L76 214 Q78 196 96 196 Z',
    details:
      '<path d="M140 196 Q140 108 200 108 Q260 108 260 196" fill="none" class="strap"/><path d="M70 262 L330 262" class="line"/>' +
      '<rect x="186" y="250" width="28" height="22" rx="4" class="dot"/>',
  },
  watch: {
    body: 'M164 60 L236 60 L242 170 L158 170 Z M158 330 L242 330 L236 440 L164 440 Z',
    details:
      '<circle cx="200" cy="250" r="92" class="sole"/><circle cx="200" cy="250" r="76" class="face"/>' +
      '<path d="M200 250 L200 196 M200 250 L238 268" class="hand"/><rect x="290" y="240" width="14" height="22" rx="3" class="sole"/>',
  },
  robe: {
    body: 'M140 58 L176 52 Q200 84 224 52 L260 58 L372 172 L360 264 L282 234 L292 466 L108 466 L118 234 L40 264 L28 172 Z',
    details:
      '<path d="M176 52 Q200 120 224 52" class="trim"/><path d="M182 110 Q200 190 218 110" class="trim"/>' +
      '<path d="M200 150 L200 260" class="trim"/><path d="M150 236 Q200 262 250 236" class="trim"/>',
  },
};

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 0xff;
    const next = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

function patternDefs(art: GarmentArt): string {
  const accent = art.accentHex ?? shade(art.colorHex, 0.45);
  switch (art.pattern) {
    case 'wax':
      return `<pattern id="p" width="56" height="56" patternUnits="userSpaceOnUse">
        <rect width="56" height="56" fill="${art.colorHex}"/>
        <circle cx="28" cy="28" r="17" fill="none" stroke="${accent}" stroke-width="6"/>
        <circle cx="28" cy="28" r="6" fill="${accent}"/>
        <circle cx="0" cy="0" r="8" fill="${shade(art.colorHex, -0.25)}"/>
        <circle cx="56" cy="56" r="8" fill="${shade(art.colorHex, -0.25)}"/>
      </pattern>`;
    case 'stripes':
      return `<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="${art.colorHex}"/><rect width="24" height="7" fill="${accent}"/>
      </pattern>`;
    case 'denim':
      return `<pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="8" height="8" fill="${art.colorHex}"/><rect width="2" height="8" fill="${shade(art.colorHex, 0.12)}"/>
      </pattern>`;
    default:
      return '';
  }
}

export function garmentSvg(art: GarmentArt): string {
  const { body, details = '' } = SHAPES[art.shape];
  const hasPattern = art.pattern !== undefined && art.pattern !== 'solid';
  const fill = hasPattern ? 'url(#p)' : art.colorHex;
  const lineColor = shade(art.colorHex, art.colorHex.toLowerCase() === '#111111' ? 0.25 : -0.22);
  const accent = art.accentHex ?? '#B79B72';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F8F7F4"/><stop offset="1" stop-color="#EDEAE4"/>
    </linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#111111" flood-opacity="0.16"/>
    </filter>
    ${patternDefs(art)}
    <style>
      .line{fill:none;stroke:${lineColor};stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:.75}
      .dot{fill:${lineColor}}
      .sole{fill:#F4F1EC;stroke:${lineColor};stroke-width:2}
      .strap{stroke:${art.colorHex};stroke-width:14;stroke-linecap:round}
      .face{fill:${accent}}
      .hand{stroke:#111111;stroke-width:5;stroke-linecap:round}
      .trim{fill:none;stroke:${accent};stroke-width:6;stroke-linecap:round}
    </style>
  </defs>
  <rect width="400" height="500" fill="url(#bg)"/>
  <ellipse cx="200" cy="478" rx="150" ry="10" fill="#111111" opacity="0.05"/>
  <g filter="url(#shadow)"${SCALED_UP.has(art.shape) ? ' transform="translate(-40 -50) scale(1.2)"' : ''}>
    <path d="${body}" fill="${fill}" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/>
    <path d="${body}" fill="url(#light)"/>
    ${details}
  </g>
</svg>`;
}

export interface RenderedGarment {
  image: Buffer;
  thumbnail: Buffer;
}

export async function renderGarment(art: GarmentArt): Promise<RenderedGarment> {
  const svg = Buffer.from(garmentSvg(art));
  const [image, thumbnail] = await Promise.all([
    sharp(svg, { density: 300 }).resize(1200, 1500).webp({ quality: 82 }).toBuffer(),
    sharp(svg, { density: 120 }).resize(400, 500).webp({ quality: 78 }).toBuffer(),
  ]);
  return { image, thumbnail };
}
