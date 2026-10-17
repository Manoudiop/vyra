import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('vyra-api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
