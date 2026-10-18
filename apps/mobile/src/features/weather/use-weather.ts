import { useQuery } from '@tanstack/react-query';
import { weatherApi, weatherKeys } from './weather-api';

/** Weather in the user's city for a day (today when `date` is null). */
export function useWeather(date: string | null = null) {
  return useQuery({
    queryKey: weatherKeys.day(date),
    queryFn: () => weatherApi.get(date),
    // The API caches for 30 minutes; the app does not need fresher.
    staleTime: 15 * 60_000,
  });
}
