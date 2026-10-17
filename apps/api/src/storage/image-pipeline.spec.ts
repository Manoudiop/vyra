import sharp from 'sharp';
import { ImagePipeline } from './image-pipeline';

describe('ImagePipeline', () => {
  const pipeline = new ImagePipeline();

  it('detects the garment color, not the plain background around it', async () => {
    // A navy garment in the middle of a large off-white backdrop.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
      <rect width="800" height="1000" fill="#F2EFEA"/>
      <rect x="250" y="250" width="300" height="500" fill="#1F2A44"/>
    </svg>`;
    const photo = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const result = await pipeline.process(photo);
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(result.dominantColorHex.slice(i, i + 2), 16),
    );
    // Dark blue, not off-white.
    expect(r! + g! + b!).toBeLessThan(250);
    expect(b!).toBeGreaterThan(r!);
  });
});
