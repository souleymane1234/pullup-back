import { z } from 'zod';
import { NET } from '../../../common/catalog.js';
import { catalogLive } from '../../../common/catalog-live.js';

export const matchingBriefDto = z.object({
  theme: z.string().refine((value) => value in catalogLive().cats, {
    message: 'Thématique inconnue.',
  }),
  objective: z.string().refine((value) => value in catalogLive().obj, {
    message: 'Objectif inconnu.',
  }),
  net: z.enum(['any', ...(Object.keys(NET) as Array<keyof typeof NET>)]),
  budget: z.coerce.number(),
  age: z.enum(['', '0', '1', '2', '3']).optional().default(''),
  gender: z.enum(['all', 'f', 'm']).optional().default('all'),
  city: z.string().optional().default(''),
  desc: z.string().optional(),
});

export type MatchingBriefDto = z.infer<typeof matchingBriefDto>;
