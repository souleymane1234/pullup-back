import { z } from 'zod';
import { CATALOG_KINDS } from '../../../common/catalog-live.js';

export const catalogKindParamDto = z.object({
  kind: z.enum(CATALOG_KINDS, {
    errorMap: () => ({ message: "Type d'élément inconnu." }),
  }),
  key: z.string().min(1, 'Indiquez la clé.'),
});

export const createCatalogDto = z.object({
  kind: z.enum(CATALOG_KINDS, {
    errorMap: () => ({ message: "Type d'élément inconnu." }),
  }),
  key: z.string().optional(),
  label: z.string().trim().min(2, 'Indiquez un libellé.'),
  related: z.array(z.string()).optional(),
  reco: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const updateCatalogDto = z.object({
  label: z.string().trim().min(2, 'Indiquez un libellé.').optional(),
  related: z.array(z.string()).optional(),
  reco: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export type CreateCatalogDto = z.infer<typeof createCatalogDto>;
export type UpdateCatalogDto = z.infer<typeof updateCatalogDto>;
export type CatalogKindParamDto = z.infer<typeof catalogKindParamDto>;
