import { z } from 'zod';

export const reasonDto = z
  .object({
    reason: z.string().optional(),
  })
  .optional()
  .transform((value) => value ?? {});

export const suspendDto = z.object({
  reason: z.string().min(1, 'Indiquez le motif de la suspension.'),
});

export const scoresDto = z.object({
  auth: z.number().int().min(0).max(100).optional(),
  creat: z.number().min(0).max(5).optional(),
  brief: z.number().int().min(0).max(100).optional(),
  onTime: z.number().int().min(0).max(100).optional(),
  aud: z
    .object({
      f: z.number(),
      ages: z.array(z.number()),
      cities: z.array(z.tuple([z.string(), z.number()])),
    })
    .optional(),
  net: z.record(z.string(), z.tuple([z.number(), z.number()])).optional(),
});

export const creditDto = z.object({
  amount: z
    .number()
    .int()
    .positive({ message: 'Le montant doit être un entier en FCFA.' }),
  reason: z.string().min(1, 'Indiquez le motif du geste commercial.'),
});

export const auditQueryDto = z.object({
  actor: z.string().optional(),
  target: z.string().optional(),
});

export const withdrawalsQueryDto = z.object({
  status: z.enum(['pending', 'sent', 'failed']).optional(),
});

export const ledgerQueryDto = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ReasonDto = z.infer<typeof reasonDto>;
export type SuspendDto = z.infer<typeof suspendDto>;
export type ScoresDto = z.infer<typeof scoresDto>;
export type CreditDto = z.infer<typeof creditDto>;
