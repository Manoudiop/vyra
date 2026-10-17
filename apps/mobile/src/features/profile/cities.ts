/** Quick picks for the city step; free text is always allowed. */
export interface CitySuggestion {
  name: string;
  countryCode: string;
  timezone: string;
}

export const CITY_SUGGESTIONS: CitySuggestion[] = [
  { name: 'Dakar', countryCode: 'SN', timezone: 'Africa/Dakar' },
  { name: 'Abidjan', countryCode: 'CI', timezone: 'Africa/Abidjan' },
  { name: 'Paris', countryCode: 'FR', timezone: 'Europe/Paris' },
  { name: 'Casablanca', countryCode: 'MA', timezone: 'Africa/Casablanca' },
  { name: 'Douala', countryCode: 'CM', timezone: 'Africa/Douala' },
  { name: 'Lomé', countryCode: 'TG', timezone: 'Africa/Lome' },
  { name: 'Cotonou', countryCode: 'BJ', timezone: 'Africa/Porto-Novo' },
  { name: 'Bamako', countryCode: 'ML', timezone: 'Africa/Bamako' },
  { name: 'Bruxelles', countryCode: 'BE', timezone: 'Europe/Brussels' },
  { name: 'Montréal', countryCode: 'CA', timezone: 'America/Toronto' },
];

export function findCitySuggestion(name: string): CitySuggestion | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return CITY_SUGGESTIONS.find((city) => city.name.toLocaleLowerCase() === normalized);
}
