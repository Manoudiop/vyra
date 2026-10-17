import { z } from 'zod';

// Public, non-secret configuration only: everything here ships inside the app bundle.
const publicEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url().default('http://localhost:4100/api'),
});

// Expo inlines EXPO_PUBLIC_* only when accessed as literal `process.env.X` expressions.
export const publicEnv = publicEnvSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});

export const API_URL = publicEnv.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
