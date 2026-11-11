import { z } from 'zod';
import { catalogLive } from '../../../common/catalog-live.js';

export const listQueryDto = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  s: z.string().optional().default(''),
  cat: z.string().optional().default(''),
  net: z.string().optional().default(''),
  badge: z.string().optional().default(''),
  budget: z.union([z.string(), z.coerce.number()]).optional().default(''),
  sort: z
    .enum(['score', 'plus', 'moins', 'prix', 'eng'])
    .optional()
    .default('score'),
});

export const carouselQueryDto = z.object({
  filter: z.string().optional().default('reco'),
});

export const contactRequestDto = z.object({
  infId: z.string().optional(),
  from: z.string().trim().min(1, 'Indiquez votre nom.'),
  contact: z.string().trim().min(1, 'Indiquez un moyen de contact.'),
  msg: z
    .string()
    .trim()
    .min(10, 'Le message doit contenir entre 10 et 1 000 caractères.')
    .max(1000, 'Le message doit contenir entre 10 et 1 000 caractères.'),
  type: z
    .string()
    .refine((value) => catalogLive().contactTypes.includes(value), {
      message: 'Type de demande inconnu.',
    }),
  turnstileToken: z.string().optional(),
});

export const vitrineDto = z.object({
  bio: z.string().optional().default(''),
  cats: z.array(z.string()),
  days: z.array(z.string()),
  rates: z.array(
    z.object({
      id: z.string().optional(),
      net: z.string(),
      fmt: z.string(),
      price: z.number(),
    }),
  ),
});

export const photoDto = z.object({
  photo: z.string().nullable(),
  consent: z.boolean().optional(),
});

export type ListQueryDto = z.infer<typeof listQueryDto>;
export type ContactRequestDto = z.infer<typeof contactRequestDto>;
export type VitrineDto = z.infer<typeof vitrineDto>;
export type PhotoDto = z.infer<typeof photoDto>;
