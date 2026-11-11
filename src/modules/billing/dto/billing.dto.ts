import { z } from 'zod';

export const withdrawDto = z.object({
  amount: z.unknown(),
  operator: z.unknown(),
  phone: z.unknown(),
  code: z.string().optional(),
});

export const planDto = z.object({
  plan: z.unknown(),
  pay: z.string().optional(),
  phone: z.string().optional(),
  otp: z.string().optional(),
});

export const boostDto = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  pay: z.string().optional(),
  phone: z.string().optional(),
  otp: z.string().optional(),
});

export type WithdrawDto = z.infer<typeof withdrawDto>;
export type PlanDto = z.infer<typeof planDto>;
export type BoostDto = z.infer<typeof boostDto>;
