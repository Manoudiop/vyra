import { toggleWithLimit } from '@/features/profile/pickers';
import {
  isStepComplete,
  type OnboardingDraft,
  toOnboardingInput,
  useOnboarding,
} from './onboarding-store';

const complete: OnboardingDraft = {
  firstName: ' Awa ',
  genderPreference: 'WOMEN',
  preferredStyles: ['ELEGANT'],
  preferredColors: ['gold'],
  preferredOccasions: ['WEDDING'],
  city: 'Dakar',
  countryCode: 'SN',
  timezone: 'Africa/Dakar',
};

describe('onboarding draft', () => {
  beforeEach(() => useOnboarding.getState().reset());

  it('only lets each question continue once answered', () => {
    const empty = useOnboarding.getState().draft;
    expect(isStepComplete('welcome', empty)).toBe(true);
    for (const step of ['name', 'gender', 'styles', 'colors', 'occasions', 'city'] as const) {
      expect(isStepComplete(step, empty)).toBe(false);
      expect(isStepComplete(step, complete)).toBe(true);
    }
    expect(isStepComplete('name', { ...complete, firstName: '   ' })).toBe(false);
  });

  it('builds a valid API payload only from a complete draft', () => {
    expect(toOnboardingInput(complete)).toMatchObject({ firstName: 'Awa', countryCode: 'SN' });
    expect(toOnboardingInput({ ...complete, preferredColors: [] })).toBeNull();
    // Free-text city without a known country is fine.
    expect(
      toOnboardingInput({ ...complete, city: 'Ziguinchor', countryCode: null }),
    ).not.toBeNull();
  });

  it('pre-fills the first name once and keeps edits', () => {
    useOnboarding.getState().start('Amina');
    useOnboarding.getState().update({ firstName: 'Mina' });
    useOnboarding.getState().start('Amina');
    expect(useOnboarding.getState().draft.firstName).toBe('Mina');
  });

  it('moves between steps within bounds and remembers the direction', () => {
    const { back, next } = useOnboarding.getState();
    back();
    expect(useOnboarding.getState().step).toBe(0);
    for (let i = 0; i < 20; i += 1) next();
    expect(useOnboarding.getState()).toMatchObject({ step: 7, direction: 1 });
    back();
    expect(useOnboarding.getState()).toMatchObject({ step: 6, direction: -1 });
  });
});

describe('toggleWithLimit', () => {
  it('adds, removes and refuses additions beyond the limit', () => {
    expect(toggleWithLimit(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleWithLimit(['a', 'b'], 'a', 2)).toEqual(['b']);
    expect(toggleWithLimit(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
  });
});
