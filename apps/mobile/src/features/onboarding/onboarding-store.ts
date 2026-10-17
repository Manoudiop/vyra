import {
  type CompleteOnboardingInput,
  completeOnboardingSchema,
  type GenderPreference,
  type Occasion,
  type Style,
  type StyleColor,
} from '@vyra/shared';
import { getCalendars } from 'expo-localization';
import { create } from 'zustand';

export const ONBOARDING_STEPS = [
  'welcome',
  'name',
  'gender',
  'styles',
  'colors',
  'occasions',
  'city',
  'finish',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingDraft {
  firstName: string;
  genderPreference: GenderPreference | null;
  preferredStyles: Style[];
  preferredColors: StyleColor[];
  preferredOccasions: Exclude<Occasion, 'SURPRISE'>[];
  city: string;
  countryCode: string | null;
  timezone: string | null;
}

interface OnboardingState {
  step: number;
  direction: 1 | -1;
  draft: OnboardingDraft;
  start(firstName: string): void;
  next(): void;
  back(): void;
  update(patch: Partial<OnboardingDraft>): void;
  reset(): void;
}

function deviceTimezone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

const emptyDraft = (): OnboardingDraft => ({
  firstName: '',
  genderPreference: null,
  preferredStyles: [],
  preferredColors: [],
  preferredOccasions: [],
  city: '',
  countryCode: null,
  timezone: deviceTimezone(),
});

/**
 * In-memory draft: answers survive moving back and forth between steps (and
 * leaving the screen) until the onboarding is submitted or the user signs out.
 */
export const useOnboarding = create<OnboardingState>()((set) => ({
  step: 0,
  direction: 1,
  draft: emptyDraft(),
  start(firstName) {
    set((state) => (state.draft.firstName ? state : { draft: { ...state.draft, firstName } }));
  },
  next() {
    set((state) => ({ step: Math.min(state.step + 1, ONBOARDING_STEPS.length - 1), direction: 1 }));
  },
  back() {
    set((state) => ({ step: Math.max(state.step - 1, 0), direction: -1 }));
  },
  update(patch) {
    set((state) => ({ draft: { ...state.draft, ...patch } }));
  },
  reset() {
    set({ step: 0, direction: 1, draft: emptyDraft() });
  },
}));

/** Whether the current step's answer is enough to continue. */
export function isStepComplete(step: OnboardingStep, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'name':
      return draft.firstName.trim().length > 0;
    case 'gender':
      return draft.genderPreference !== null;
    case 'styles':
      return draft.preferredStyles.length > 0;
    case 'colors':
      return draft.preferredColors.length > 0;
    case 'occasions':
      return draft.preferredOccasions.length > 0;
    case 'city':
      return draft.city.trim().length > 0;
    default:
      return true;
  }
}

/** Builds the API payload; returns null if the draft is not valid yet. */
export function toOnboardingInput(draft: OnboardingDraft): CompleteOnboardingInput | null {
  const parsed = completeOnboardingSchema.safeParse({
    firstName: draft.firstName,
    genderPreference: draft.genderPreference,
    preferredStyles: draft.preferredStyles,
    preferredColors: draft.preferredColors,
    preferredOccasions: draft.preferredOccasions,
    city: draft.city,
    countryCode: draft.countryCode ?? undefined,
    timezone: draft.timezone ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}
