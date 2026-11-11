import { z } from 'zod';

export const loginDto = z.object({
  email: z.string().trim().min(1, 'Saisissez un e-mail valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});

export const signupBrandDto = z.object({
  company: z.string().trim().min(1, "Indiquez l'entreprise ou la marque."),
  contact: z.string().trim().min(1, 'Indiquez votre nom.'),
  email: z.string().trim().email('Saisissez un e-mail valide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
});

export const handleQueryDto = z.object({
  handle: z.string().default(''),
});

export const signupInfluencerDto = z.object({
  name: z.string().trim().min(1, 'Nom affiché requis.'),
  handle: z.string().min(1, "Nom d'utilisateur requis."),
  email: z.string().trim().email('Saisissez un e-mail valide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  phone: z.string().trim().default(''),
  city: z.string().trim().min(1, 'Indiquez une ville.'),
  bio: z.string().default(''),
  photo: z.string().nullable().optional(),
  nets: z.record(z.union([z.number(), z.string()])),
  cats: z.array(z.string()),
  accepts: z.object({
    pub: z.boolean(),
    partenariat: z.boolean(),
    dedicace: z.boolean(),
  }),
  price: z.number({ invalid_type_error: 'Prix minimum 5 000 FCFA.' }),
});

export const demoDto = z.object({
  role: z.enum(['brand', 'influencer', 'admin']),
  id: z.string().min(1),
});

export const forgotDto = z.object({
  email: z.string().trim().email('Saisissez un e-mail valide.'),
});

export const resetDto = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
});

export const deleteMeDto = z.object({
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});

export type LoginDto = z.infer<typeof loginDto>;
export type SignupBrandDto = z.infer<typeof signupBrandDto>;
export type SignupInfluencerDto = z.infer<typeof signupInfluencerDto>;
export type DemoDto = z.infer<typeof demoDto>;
