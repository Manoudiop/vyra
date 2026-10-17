import {
  CLOTHING_CATEGORIES,
  GENDER_PREFERENCES,
  OCCASIONS,
  PLANS,
  SEASONS,
  STYLES,
  USAGE_METRICS,
} from '@vyra/shared';
import {
  ClothingCategory,
  GenderPreference,
  Occasion,
  Plan,
  Season,
  Style,
  UsageMetric,
} from '../generated/prisma/enums';

// The database enums and the shared vocabulary (used by mobile, admin and Zod
// validation) must never drift apart.
describe('Prisma enums mirror @vyra/shared', () => {
  it.each([
    ['ClothingCategory', ClothingCategory, CLOTHING_CATEGORIES],
    ['GenderPreference', GenderPreference, GENDER_PREFERENCES],
    ['Occasion', Occasion, OCCASIONS],
    ['Plan', Plan, PLANS],
    ['Season', Season, SEASONS],
    ['Style', Style, STYLES],
    ['UsageMetric', UsageMetric, USAGE_METRICS],
  ])('%s', (_name, prismaEnum, shared) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...shared].sort());
  });
});
