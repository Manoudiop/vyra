import { analyticsApi } from '@/features/analytics/analytics-api';
import { authApi } from '@/features/auth/auth-api';
import { calendarApi } from '@/features/calendar/calendar-api';
import { closetApi } from '@/features/closet/closet-api';
import { profileApi } from '@/features/profile/profile-api';
import { styleApi } from '@/features/style/style-api';
import { stylistApi } from '@/features/stylist/stylist-api';
import { subscriptionsApi } from '@/features/subscriptions/subscriptions-api';
import { usageApi } from '@/features/usage/usage-api';
import { weatherApi } from '@/features/weather/weather-api';
import apiRoutes from '../../../api/contract/routes.json';

/**
 * Every API call the app can make must hit a route the API really serves.
 * The routes come from the API's OpenAPI document (apps/api/contract/routes.json,
 * kept up to date by the API's own contract test).
 */
const calls: { method: string; path: string }[] = [];
const record = (path: string, options: { method?: string } = {}) => {
  calls.push({ method: options.method ?? 'GET', path });
  return Promise.resolve(undefined);
};

jest.mock('@/lib/authorized-request', () => ({
  authorizedRequest: (path: string, options?: { method?: string }) => record(path, options),
}));
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiRequest: (path: string, options?: { method?: string }) => record(path, options),
}));

const ROUTES = (apiRoutes as string[]).map((route) => {
  const [method, template] = route.split(' ') as [string, string];
  const pattern = template.replace(/^\/api/, '').replace(/\{[^}]+\}/g, '[^/]+');
  return { route, method, regex: new RegExp(`^${pattern}$`) };
});

const ID = '01a14c05-977e-77fd-8b06-55e7c6898fb1';
const DATE = '2026-10-21';

/** One sample call per client function; adding a function without a call here fails. */
const SAMPLES: Record<string, Record<string, () => unknown>> = {
  authApi: {
    register: () => authApi.register({ firstName: 'A', email: 'a@b.c', password: 'letters123' }),
    login: () => authApi.login({ email: 'a@b.c', password: 'letters123' }),
    refresh: () => authApi.refresh('token'),
    logout: () => authApi.logout('token'),
    forgotPassword: () => authApi.forgotPassword({ email: 'a@b.c' }),
    resetPassword: () =>
      authApi.resetPassword({ email: 'a@b.c', code: '123456', newPassword: 'letters123' }),
    me: () => authApi.me('access'),
  },
  closetApi: {
    list: () => closetApi.list({ search: 'lin', category: 'TOPS', favorite: true }, ID),
    summary: () => closetApi.summary(),
    get: () => closetApi.get(ID),
    update: () => closetApi.update(ID, { name: 'x' }),
    remove: () => closetApi.remove(ID),
    create: () =>
      closetApi.create({ name: 'x', category: 'TOPS', color: 'white', imageKey: 'k.webp' }),
    uploadImage: () => closetApi.uploadImage(new FormData()),
    analyze: () => closetApi.analyze('k.webp'),
    discardImage: () => closetApi.discardImage({ imageKey: 'k.webp' }),
  },
  stylistApi: {
    generate: () => stylistApi.generate({ occasion: 'WORK', style: 'SMART_CASUAL' }),
    getOutfit: () => stylistApi.getOutfit(ID),
    list: () => stylistApi.list(ID),
    listSaved: () => stylistApi.listSaved(null),
    setSaved: () => stylistApi.setSaved(ID, true),
    wear: () => stylistApi.wear(ID),
    unwear: () => stylistApi.unwear(ID),
    rate: () => stylistApi.rate(ID, { rating: 'LOVE' }),
    clearRating: () => stylistApi.clearRating(ID),
  },
  calendarApi: {
    month: () => calendarApi.month('2026-10'),
    plan: () => calendarApi.plan(DATE, { outfitId: ID }),
    unplan: () => calendarApi.unplan(DATE),
    wearHistory: () => calendarApi.wearHistory(ID),
  },
  profileApi: {
    get: () => profileApi.get(),
    completeOnboarding: () =>
      profileApi.completeOnboarding({
        firstName: 'A',
        genderPreference: 'WOMEN',
        preferredStyles: ['ELEGANT'],
        preferredColors: ['gold'],
        preferredOccasions: ['WORK'],
        city: 'Dakar',
      }),
    update: () => profileApi.update({ analyticsEnabled: false }),
  },
  styleApi: { profile: () => styleApi.profile(), analyze: () => styleApi.analyze() },
  subscriptionsApi: {
    plans: () => subscriptionsApi.plans(),
    me: () => subscriptionsApi.me(),
    checkout: () => subscriptionsApi.checkout('PRO'),
    cancel: () => subscriptionsApi.cancel(),
    resume: () => subscriptionsApi.resume(),
  },
  usageApi: { get: () => usageApi.get() },
  weatherApi: { get: () => weatherApi.get(DATE) },
  analyticsApi: {
    track: () => analyticsApi.track({ name: 'paywall_viewed', properties: { reason: null } }),
  },
};

const CLIENTS: Record<string, object> = {
  authApi,
  closetApi,
  stylistApi,
  calendarApi,
  profileApi,
  styleApi,
  subscriptionsApi,
  usageApi,
  weatherApi,
  analyticsApi,
};

const matchRoute = (method: string, pathname: string) =>
  ROUTES.find((route) => route.method === method && route.regex.test(pathname));

describe('API contract', () => {
  it('rejects what the API does not serve', () => {
    expect(matchRoute('GET', `/outfits/${ID}`)).toBeDefined();
    expect(matchRoute('DELETE', `/outfits/${ID}`)).toBeUndefined();
    expect(matchRoute('GET', `/outfits/${ID}/extra`)).toBeUndefined();
    expect(matchRoute('GET', '/closets')).toBeUndefined();
  });

  it('has a sample call for every client function', () => {
    for (const [name, client] of Object.entries(CLIENTS)) {
      expect(Object.keys(SAMPLES[name] ?? {}).sort()).toEqual(Object.keys(client).sort());
    }
  });

  it.each(
    Object.entries(SAMPLES).flatMap(([client, fns]) => Object.keys(fns).map((fn) => [client, fn])),
  )('%s.%s calls a route the API serves', async (client, fn) => {
    calls.length = 0;
    await SAMPLES[client]![fn]!();
    expect(calls).toHaveLength(1);
    const { method, path } = calls[0]!;
    const pathname = path.split('?')[0]!;
    const match = ROUTES.find((route) => route.method === method && route.regex.test(pathname));
    expect(match ? match.route : `${method} ${pathname} (no such route)`).toMatch(
      new RegExp(`^${method} `),
    );
    expect(match).toBeDefined();
  });
});
