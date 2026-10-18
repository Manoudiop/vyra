import {
  addDays,
  type CalendarAccess,
  type CalendarDay,
  type CalendarMonth,
  type ClothingItem,
  type Outfit,
  type OutfitSummary,
} from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { closetApi } from '@/features/closet/closet-api';
import { stylistApi } from '@/features/stylist/stylist-api';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { calendarApi } from './calendar-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('@/features/closet/closet-api', () => ({
  ...jest.requireActual('@/features/closet/closet-api'),
  closetApi: { list: jest.fn(), summary: jest.fn(), get: jest.fn() },
}));
jest.mock('@/features/stylist/stylist-api', () => ({
  ...jest.requireActual('@/features/stylist/stylist-api'),
  stylistApi: {
    generate: jest.fn(),
    getOutfit: jest.fn(),
    list: jest.fn(),
    listSaved: jest.fn(),
    setSaved: jest.fn(),
    wear: jest.fn(),
    unwear: jest.fn(),
    rate: jest.fn(),
    clearRating: jest.fn(),
  },
}));
jest.mock('./calendar-api', () => ({
  ...jest.requireActual('./calendar-api'),
  calendarApi: { month: jest.fn(), plan: jest.fn(), unplan: jest.fn(), wearHistory: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const closet = closetApi as jest.Mocked<typeof closetApi>;
const stylist = stylistApi as jest.Mocked<typeof stylistApi>;
const calendar = calendarApi as jest.Mocked<typeof calendarApi>;

const piece = (id: string, name: string, category: ClothingItem['category']): ClothingItem => ({
  id,
  name,
  category,
  subcategory: null,
  color: 'navy',
  colorHex: null,
  style: 'SMART_CASUAL',
  season: 'ALL_SEASON',
  isFavorite: false,
  imageUrl: `https://img.test/${id}.webp`,
  thumbnailUrl: `https://img.test/${id}_thumb.webp`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});
const SHIRT = piece('22222222-2222-4222-8222-222222222222', 'Chemise oxford', 'TOPS');
const CHINOS = piece('33333333-3333-4333-8333-333333333333', 'Chino beige', 'BOTTOMS');
const DERBIES = piece('44444444-4444-4444-8444-444444444444', 'Derbies', 'SHOES');

const outfit = (id: string, name: string, extra: Partial<Outfit> = {}): Outfit => ({
  id,
  name,
  occasion: 'WORK',
  style: 'SMART_CASUAL',
  reason: 'Une base nette pour le bureau.',
  score: 0.8,
  isSaved: false,
  constraints: null,
  items: [SHIRT, CHINOS, DERBIES],
  feedback: null,
  wornToday: false,
  weather: null,
  lastWornAt: null,
  createdAt: '2026-10-10T09:00:00.000Z',
  ...extra,
});
const OFFICE = outfit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bureau impeccable', {
  isSaved: true,
});
const DINNER = outfit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Dîner en lin');
const summary = (look: Outfit): OutfitSummary => ({
  id: look.id,
  name: look.name,
  occasion: look.occasion,
  style: look.style,
  thumbnails: look.items.map((item) => item.thumbnailUrl),
});

/**
 * The calendar always asks for the device's month; answers are built from the
 * requested month so the tests do not depend on the date they run.
 */
function serveCalendar({
  access = null,
  days = (today: string): CalendarDay[] => [
    { date: addDays(today, -2), planned: null, worn: [summary(DINNER)] },
    {
      date: addDays(today, 1),
      planned: {
        id: 'event-1',
        date: addDays(today, 1),
        occasion: null,
        notes: 'Présentation client',
        outfit: summary(OFFICE),
      },
      worn: [],
    },
  ],
}: {
  access?: ((today: string) => CalendarAccess) | null;
  days?: (today: string) => CalendarDay[];
} = {}) {
  let today: string | null = null;
  calendar.month.mockImplementation(async (month): Promise<CalendarMonth> => {
    today ??= `${month}-15`;
    return {
      month,
      today,
      days: days(today).filter((day) => day.date.startsWith(month)),
      access: access ? access(today) : null,
    };
  });
  return () => today!;
}

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await tokenStorage.clear();
  useSession.setState({
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
  await tokenStorage.setRefreshToken('refresh-saved');
  auth.refresh.mockResolvedValue({
    tokens: {
      accessToken: 'access',
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken: 'refresh-next',
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  });
  auth.me.mockResolvedValue({
    id: 'u1',
    email: 'karim@vyra.dev',
    firstName: 'Karim',
    lastName: null,
    avatarUrl: null,
    role: 'USER',
    onboardingCompleted: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  closet.list.mockResolvedValue({ items: [SHIRT, CHINOS, DERBIES], nextCursor: null });
  stylist.list.mockResolvedValue({ items: [DINNER, OFFICE], nextCursor: null });
  stylist.getOutfit.mockImplementation(async (id) => (id === DINNER.id ? DINNER : OFFICE));
});

describe('Calendar', () => {
  it('marks planned and worn days and opens on today', async () => {
    const today = serveCalendar();
    await renderRouter('./app', { initialUrl: '/calendar' });
    expect(await screen.findByTestId('day-panel')).toBeTruthy();

    expect(screen.getByTestId(`day-${today()}`)).toBeSelected();
    expect(screen.getByTestId(`day-${addDays(today(), 1)}-planned`)).toBeTruthy();
    expect(screen.getByTestId(`day-${addDays(today(), -2)}-worn`)).toBeTruthy();
    expect(screen.getByTestId('day-empty')).toHaveTextContent(/Rien de prévu aujourd’hui/);

    await fireEvent.press(screen.getByTestId(`day-${addDays(today(), 1)}`));
    expect(await screen.findByTestId('day-planned')).toHaveTextContent(/Bureau impeccable/);
    expect(screen.getByTestId('day-planned')).toHaveTextContent(/Présentation client/);
    expect(screen.getByText('Demain')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`day-${addDays(today(), -2)}`));
    expect(await screen.findByTestId('day-worn')).toHaveTextContent(/Dîner en lin/);
    expect(screen.queryByTestId('day-choose')).toBeNull();
  });

  it('moves between months', async () => {
    const today = serveCalendar();
    await renderRouter('./app', { initialUrl: '/calendar' });
    await screen.findByTestId('day-panel');
    const current = today().slice(0, 7);

    await fireEvent.press(screen.getByTestId('calendar-next'));
    await waitFor(() => expect(calendar.month).toHaveBeenLastCalledWith(nextMonth(current)));
    expect(await screen.findByTestId('calendar-today')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('calendar-today'));
    // Back on the current month (served from cache) with today selected.
    await waitFor(() => expect(screen.queryByTestId('calendar-today')).toBeNull());
    expect(screen.getByTestId(`day-${today()}`)).toBeSelected();
  });

  it('removes the planned look of a day', async () => {
    const today = serveCalendar();
    calendar.unplan.mockResolvedValue(undefined);
    await renderRouter('./app', { initialUrl: '/calendar' });
    await screen.findByTestId('day-panel');
    await fireEvent.press(screen.getByTestId(`day-${addDays(today(), 1)}`));
    await fireEvent.press(await screen.findByTestId('day-remove'));
    await waitFor(() => expect(calendar.unplan).toHaveBeenCalledWith(addDays(today(), 1)));
  });

  it('shows days outside the FREE week as locked', async () => {
    const today = serveCalendar({ access: (day) => ({ from: day, to: addDays(day, 2) }) });
    await renderRouter('./app', { initialUrl: '/calendar' });
    await screen.findByTestId('day-panel');
    await fireEvent.press(screen.getByTestId(`day-${addDays(today(), 5)}`));
    expect(await screen.findByTestId('day-locked')).toHaveTextContent(/semaine en cours/);
    expect(screen.queryByTestId('day-choose')).toBeNull();
  });

  it('plans one of your looks for a day, with a note', async () => {
    const today = serveCalendar();
    calendar.plan.mockResolvedValue({
      id: 'event-2',
      date: today(),
      occasion: null,
      notes: 'Réunion',
      outfit: summary(DINNER),
    });
    await renderRouter('./app', { initialUrl: '/calendar' });
    await fireEvent.press(await screen.findByTestId('day-choose'));

    expect(await screen.findByTestId('plan-day-screen')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('plan-notes'), '  Réunion ');
    await fireEvent.press(await screen.findByTestId(`plan-pick-${DINNER.id}`));
    await waitFor(() =>
      expect(calendar.plan).toHaveBeenCalledWith(today(), {
        outfitId: DINNER.id,
        notes: 'Réunion',
      }),
    );
    expect(await screen.findByTestId('calendar-screen')).toBeTruthy();
  });

  it('explains when planning is refused by the plan', async () => {
    serveCalendar();
    calendar.plan.mockRejectedValue(
      new ApiError('LIMIT_REACHED', 'Planning beyond the current week is part of VYRA Pro.', 402, {
        feature: 'CALENDAR_FULL',
      }),
    );
    await renderRouter('./app', { initialUrl: '/calendar' });
    await fireEvent.press(await screen.findByTestId('day-choose'));
    await fireEvent.press(await screen.findByTestId(`plan-pick-${OFFICE.id}`));
    expect(await screen.findByText(/En gratuit, l’agenda couvre la semaine en cours/)).toBeTruthy();
    expect(screen.getByTestId('plan-day-screen')).toBeTruthy();
  });

  it('creates a look for a day and plans it from the outfit screen', async () => {
    const today = serveCalendar();
    await renderRouter('./app', { initialUrl: '/calendar' });
    await screen.findByTestId('day-panel');
    const day = addDays(today(), 3);
    stylist.generate.mockResolvedValue({ outfit: DINNER, provider: 'mock', candidateCount: 3 });
    calendar.plan.mockResolvedValue({
      id: 'event-3',
      date: day,
      occasion: null,
      notes: null,
      outfit: summary(DINNER),
    });
    await fireEvent.press(screen.getByTestId(`day-${day}`));
    await fireEvent.press(await screen.findByTestId('day-create'));

    expect(await screen.findByTestId('stylist-for-day')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('occasion-DINNER'));
    await fireEvent.press(screen.getByTestId('stylist-generate'));
    await waitFor(() =>
      expect(stylist.generate).toHaveBeenCalledWith(expect.objectContaining({ date: day })),
    );

    await fireEvent.press(await screen.findByTestId('outfit-plan-for', {}, { timeout: 5000 }));
    await waitFor(() => expect(calendar.plan).toHaveBeenCalledWith(day, { outfitId: DINNER.id }));
    expect(await screen.findByTestId('calendar-screen')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId(`day-${day}`)).toBeSelected());
  });

  it('plans a look for one of the next days from the outfit screen', async () => {
    const today = serveCalendar({ access: (day) => ({ from: day, to: addDays(day, 2) }) });
    calendar.plan.mockResolvedValue({
      id: 'event-4',
      date: '',
      occasion: null,
      notes: null,
      outfit: summary(OFFICE),
    });
    await renderRouter('./app', { initialUrl: `/outfit/${OFFICE.id}` });
    await fireEvent.press(await screen.findByTestId('outfit-plan'));
    expect(await screen.findByTestId('plan-outfit-screen')).toBeTruthy();
    await waitFor(() => expect(calendar.month).toHaveBeenCalled());

    // FREE: days after the current week cannot be picked.
    expect(await screen.findByTestId('plan-free-note')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId(`plan-day-${addDays(today(), 5)}`)).toBeDisabled(),
    );

    await fireEvent.press(screen.getByTestId(`plan-day-${addDays(today(), 1)}`));
    // Tomorrow already holds this very look: nothing to warn about.
    expect(screen.queryByTestId('plan-replaces')).toBeNull();
    await fireEvent.press(screen.getByTestId('plan-confirm'));
    await waitFor(() =>
      expect(calendar.plan).toHaveBeenCalledWith(addDays(today(), 1), { outfitId: OFFICE.id }),
    );
  });

  it('warns before replacing the look already planned that day', async () => {
    const today = serveCalendar();
    await renderRouter('./app', { initialUrl: `/outfit/${DINNER.id}` });
    await fireEvent.press(await screen.findByTestId('outfit-plan'));
    await waitFor(() => expect(calendar.month).toHaveBeenCalled());
    await fireEvent.press(await screen.findByTestId(`plan-day-${addDays(today(), 1)}`));
    expect(await screen.findByTestId('plan-replaces')).toHaveTextContent(/Bureau impeccable/);
  });
});

describe('Wear history', () => {
  it('lists worn looks by day and explains the FREE limit', async () => {
    serveCalendar();
    calendar.wearHistory.mockResolvedValue({
      items: [
        {
          id: 'w1',
          wornAt: '2026-10-15T08:00:00.000Z',
          date: '2026-10-15',
          outfit: summary(OFFICE),
        },
        {
          id: 'w2',
          wornAt: '2026-10-13T08:00:00.000Z',
          date: '2026-10-13',
          outfit: summary(DINNER),
        },
      ],
      nextCursor: null,
      visibleFrom: '2026-10-09',
    });
    await renderRouter('./app', { initialUrl: '/calendar' });
    await fireEvent.press(await screen.findByTestId('calendar-history'));
    expect(await screen.findByText('jeudi 15 octobre')).toBeTruthy();
    expect(screen.getByText('mardi 13 octobre')).toBeTruthy();
    expect(screen.getByText('Dîner en lin')).toBeTruthy();
    expect(screen.getByTestId('history-limited')).toBeTruthy();
  });

  it('guides to the stylist when nothing was worn', async () => {
    calendar.wearHistory.mockResolvedValue({ items: [], nextCursor: null, visibleFrom: null });
    await renderRouter('./app', { initialUrl: '/wear-history' });
    expect(await screen.findByTestId('history-empty')).toBeTruthy();
    expect(screen.queryByTestId('history-limited')).toBeNull();
  });
});

function nextMonth(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`;
}
