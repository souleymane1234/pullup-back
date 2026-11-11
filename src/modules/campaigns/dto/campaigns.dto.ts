import { z } from 'zod';

export const briefUploadDto = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  size: z.coerce.number().int().nonnegative(),
});

export const createCampaignDto = z.object({
  infId: z.string().min(1),
  rateId: z.string().min(1),
  pay: z.enum(['om', 'mtn', 'moov', 'wave', 'card']),
  phone: z.string().optional(),
  otp: z.string().optional(),
  brief: z.object({
    title: z.string(),
    objective: z.string(),
    theme: z.string(),
    text: z.string(),
    link: z.string().optional(),
    date: z.string().optional(),
    file: z.string().optional(),
  }),
});

export const campaignMessageDto = z.object({
  text: z.string(),
});

export const campaignReviewDto = z.object({
  stars: z.coerce.number().int().min(1).max(5),
  text: z.string().optional().default(''),
});

export type BriefUploadDto = z.infer<typeof briefUploadDto>;
export type CreateCampaignDto = z.infer<typeof createCampaignDto>;
export type CampaignMessageDto = z.infer<typeof campaignMessageDto>;
export type CampaignReviewDto = z.infer<typeof campaignReviewDto>;
