import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import WelcomeScreen from '../../../app/index';

jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiRequest: jest.fn(async () => ({
    status: 'ok',
    service: 'vyra-api',
    version: '0.1.0',
    uptimeSeconds: 3,
    timestamp: '2026-10-17T10:00:00.000Z',
  })),
}));

// RNTL 14 renders asynchronously; gcTime: Infinity avoids lingering cache timers.
async function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('WelcomeScreen', () => {
  it('shows the brand and the API connection state', async () => {
    await renderWithQuery(<WelcomeScreen />);
    expect(screen.getByText('VYRA')).toBeTruthy();
    expect(screen.getByText('Ton dressing. Ton style. Ton IA.')).toBeTruthy();
    expect(await screen.findByText('API connectée · v0.1.0')).toBeTruthy();
  });
});
