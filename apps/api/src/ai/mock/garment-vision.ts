import sharp from 'sharp';

/**
 * Lightweight "computer vision" for the mock AI provider: it segments the
 * garment from a plain backdrop and measures its silhouette and colors. No
 * model, no network — deterministic and fast, good enough to pre-fill a form
 * that the user always reviews.
 */

export interface SilhouetteFeatures {
  /** Garment pixels / image pixels. */
  coverage: number;
  /** Bounding box height / width (in real proportions). */
  aspect: number;
  /** Share of the bounding box covered by the garment. */
  fill: number;
  /** Garment width (fraction of the box width) at 12%, 35%, 50%, 75% and 90% of its height. */
  widths: { top: number; upper: number; mid: number; lower: number; bottom: number };
  /** Share of lower rows with a background gap between two garment parts (legs). */
  legGap: number;
  /** Share of upper rows with a background hole in the middle (bag handle). */
  topHole: number;
  /** Dominant garment color (most frequent quantized bin, averaged). */
  colorHex: string;
  /** Distinct colors covering ≥ 12% of the garment each. */
  colorCount: number;
  /** Luminance standard deviation inside the garment (0–255). */
  textureContrast: number;
  /** Share of garment pixels far from its main color: prints, wax, stripes. */
  patternShare: number;
}

const WIDTH = 96;

interface Pixel {
  r: number;
  g: number;
  b: number;
}

const distance = (a: Pixel, b: Pixel) =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const toHex = ({ r, g, b }: Pixel) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export async function extractFeatures(image: Buffer): Promise<SilhouetteFeatures> {
  const { data, info } = await sharp(image)
    .rotate()
    .resize({ width: WIDTH, height: Math.round(WIDTH * 1.6), fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x: number, y: number): Pixel => {
    const i = (y * width + x) * 3;
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
  };

  // Backdrop = median color of the outer frame (users shoot on a plain background).
  const border: Pixel[] = [];
  for (let x = 0; x < width; x += 1)
    border.push(at(x, 0), at(x, 1), at(x, height - 1), at(x, height - 2));
  for (let y = 0; y < height; y += 1)
    border.push(at(0, y), at(1, y), at(width - 1, y), at(width - 2, y));
  const background = {
    r: median(border.map((p) => p.r)),
    g: median(border.map((p) => p.g)),
    b: median(border.map((p) => p.b)),
  };

  // Background = everything reachable from the frame by small color steps (the
  // backdrop may be a soft gradient), staying close to the backdrop color. The
  // garment edge stops the flood, so light pieces on light backdrops still segment.
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  const seed = (x: number, y: number) => {
    const index = y * width + x;
    if (!reached[index] && distance(at(x, y), background) < 40) {
      reached[index] = 1;
      queue.push(index);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (queue.length > 0) {
    const index = queue.pop()!;
    const x = index % width;
    const y = (index - x) / width;
    const here = at(x, y);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (reached[next]) continue;
      const pixel = at(nx, ny);
      if (distance(pixel, here) <= 7 && distance(pixel, background) < 40) {
        reached[next] = 1;
        queue.push(next);
      }
    }
  }

  const mask = new Uint8Array(width * height);
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let area = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!reached[y * width + x]) {
        mask[y * width + x] = 1;
        area += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const coverage = area / (width * height);
  if (area === 0 || maxX <= minX || maxY <= minY) {
    return {
      coverage: 0,
      aspect: 1,
      fill: 0,
      widths: { top: 0, upper: 0, mid: 0, lower: 0, bottom: 0 },
      legGap: 0,
      topHole: 0,
      colorHex: toHex(background),
      colorCount: 1,
      textureContrast: 0,
      patternShare: 0,
    };
  }

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const inBox = (fraction: number) =>
    minY + Math.min(boxHeight - 1, Math.floor(fraction * boxHeight));
  const rowWidth = (y: number) => {
    let first = -1;
    let last = -1;
    for (let x = minX; x <= maxX; x += 1) {
      if (mask[y * width + x]) {
        if (first < 0) first = x;
        last = x;
      }
    }
    return first < 0 ? 0 : (last - first + 1) / boxWidth;
  };
  const bandWidth = (fraction: number) => {
    const rows = [-0.03, 0, 0.03].map((offset) =>
      rowWidth(inBox(Math.max(0, Math.min(0.999, fraction + offset)))),
    );
    return median(rows);
  };

  /** Row has garment on both sides of a background gap around the box center. */
  const hasCentralGap = (y: number) => {
    const center = minX + Math.floor(boxWidth / 2);
    const half = Math.max(1, Math.floor(boxWidth * 0.06));
    let centerEmpty = true;
    for (let x = center - half; x <= center + half; x += 1) {
      if (mask[y * width + x]) centerEmpty = false;
    }
    if (!centerEmpty) return false;
    let left = false;
    let right = false;
    for (let x = minX; x < center - half; x += 1) if (mask[y * width + x]) left = true;
    for (let x = center + half + 1; x <= maxX; x += 1) if (mask[y * width + x]) right = true;
    return left && right;
  };
  const gapShare = (from: number, to: number) => {
    let rows = 0;
    let gaps = 0;
    for (let y = inBox(from); y <= inBox(to); y += 1) {
      rows += 1;
      if (hasCentralGap(y)) gaps += 1;
    }
    return rows ? gaps / rows : 0;
  };

  // Colors: quantize garment pixels into 4×4×4 bins, keep the dominant bin's mean.
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  const luminances: number[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!mask[y * width + x]) continue;
      const p = at(x, y);
      luminances.push(0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
      const key = ((p.r >> 6) << 4) | ((p.g >> 6) << 2) | (p.b >> 6);
      const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bin.count += 1;
      bin.r += p.r;
      bin.g += p.g;
      bin.b += p.b;
      bins.set(key, bin);
    }
  }
  const ranked = [...bins.values()].sort((a, b) => b.count - a.count);
  const dominant = ranked[0]!;
  const main = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
  };
  let farPixels = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      // Shading and seams stay close to the main color; a print does not.
      if (mask[y * width + x] && distance(at(x, y), main) > 70) farPixels += 1;
    }
  }
  const patternShare = farPixels / area;
  const meanLuminance = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const textureContrast = Math.sqrt(
    luminances.reduce((sum, value) => sum + (value - meanLuminance) ** 2, 0) / luminances.length,
  );

  return {
    coverage,
    aspect: boxHeight / boxWidth,
    fill: area / (boxWidth * boxHeight),
    widths: {
      top: bandWidth(0.12),
      upper: bandWidth(0.35),
      mid: bandWidth(0.5),
      lower: bandWidth(0.75),
      bottom: bandWidth(0.9),
    },
    legGap: gapShare(0.6, 0.95),
    topHole: gapShare(0.05, 0.3),
    colorHex: toHex({
      r: dominant.r / dominant.count,
      g: dominant.g / dominant.count,
      b: dominant.b / dominant.count,
    }),
    colorCount: ranked.filter((bin) => bin.count / area >= 0.12).length,
    textureContrast,
    patternShare,
  };
}
