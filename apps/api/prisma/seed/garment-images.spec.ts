import sharp from 'sharp';
import { type GarmentShape, garmentSvg, renderGarment } from './garment-images';

const SHAPES: GarmentShape[] = [
  'tshirt',
  'shirt',
  'sweater',
  'blazer',
  'coat',
  'pants',
  'shorts',
  'skirt',
  'dress',
  'sneaker',
  'shoe',
  'heel',
  'bag',
  'watch',
  'robe',
];

describe('seed garment images', () => {
  it('renders every shape at production sizes', async () => {
    for (const shape of SHAPES) {
      const { image, thumbnail } = await renderGarment({ shape, colorHex: '#B79B72' });
      await expect(sharp(image).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 1200,
        height: 1500,
      });
      await expect(sharp(thumbnail).metadata()).resolves.toMatchObject({
        width: 400,
        height: 500,
      });
    }
  }, 60_000);

  it('applies patterns through an SVG pattern fill', () => {
    expect(garmentSvg({ shape: 'dress', colorHex: '#1E3F8A', pattern: 'wax' })).toContain(
      'fill="url(#p)"',
    );
    expect(garmentSvg({ shape: 'dress', colorHex: '#1E3F8A' })).not.toContain('url(#p)');
  });
});
