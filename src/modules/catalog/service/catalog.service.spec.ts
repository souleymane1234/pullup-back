import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../../../common/http/app.error.js';
import { resetCatalogLive } from '../../../common/catalog-live.js';
import { CatalogService } from './catalog.service.js';

const admin = { userId: 'ua', role: 'admin' as const, profileId: 'admin' };

describe('CatalogService', () => {
  afterEach(() => {
    resetCatalogLive();
  });

  it('crée une catégorie et l’audite', async () => {
    const { service, repo, audit } = harness();
    const result = await service.create(
      {
        kind: 'category',
        key: 'cinema',
        label: 'Cinéma & séries',
        related: ['beaute'],
      },
      admin,
      '1.1.1.1',
    );
    expect(result.message).toBe('Catégorie créée.');
    expect(result.item.key).toBe('cinema');
    expect(repo.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_create',
        targetId: 'category:cinema',
      }),
    );
  });

  it('refuse une clé déjà prise', async () => {
    const { service } = harness({
      find: {
        kind: 'category',
        key: 'beaute',
        label: 'Mode & beauté',
        meta: { related: [] },
        sortOrder: 0,
        active: true,
      },
    });
    const error = await service
      .create({ kind: 'category', key: 'beaute', label: 'Mode' }, admin)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getResponse()).toEqual({ message: 'Cette clé existe déjà.' });
  });

  it('refuse de masquer le dernier élément actif', async () => {
    const { service } = harness({
      find: {
        kind: 'city',
        key: 'Abidjan',
        label: 'Abidjan',
        meta: {},
        sortOrder: 0,
        active: true,
      },
      listKind: [
        {
          kind: 'city',
          key: 'Abidjan',
          label: 'Abidjan',
          meta: {},
          sortOrder: 0,
          active: true,
        },
      ],
    });
    const error = await service
      .hide('city', 'Abidjan', admin)
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getResponse()).toEqual({
      message: 'Gardez au moins un élément actif.',
    });
  });
});

function harness(
  overrides: {
    find?: unknown;
    listKind?: unknown[];
  } = {},
) {
  const beaute = {
    kind: 'category' as const,
    key: 'beaute',
    label: 'Mode & beauté',
    meta: { related: ['societe'] },
    sortOrder: 0,
    active: true,
  };
  const repo = {
    count: vi.fn().mockResolvedValue(1),
    list: vi.fn().mockResolvedValue([beaute]),
    listKind: vi.fn().mockResolvedValue(overrides.listKind ?? [beaute]),
    find: vi.fn().mockResolvedValue(overrides.find ?? null),
    create: vi.fn().mockImplementation(async (data: typeof beaute) => data),
    createMany: vi.fn(),
    update: vi.fn().mockImplementation(async (_kind, _key, data) => ({
      ...beaute,
      ...data,
    })),
  };
  const audit = { record: vi.fn() };
  const service = new CatalogService(repo as never, audit as never);
  return { service, repo, audit };
}
