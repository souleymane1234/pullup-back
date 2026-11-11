import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_MATRIX } from '../../../common/http/role-matrix.js';

describe('OpenAPI', () => {
  const spec = JSON.parse(
    readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
  ) as {
    tags: Array<{ name: string }>;
    paths: Record<
      string,
      Record<
        string,
        {
          tags?: string[];
          summary?: string;
          security?: unknown[];
          'x-updated'?: boolean;
        }
      >
    >;
  };

  it('place le tag Admin en premier', () => {
    expect(spec.tags[0]?.name).toBe('Admin');
  });

  it('étiquette toutes les routes /admin avec Admin', () => {
    const adminPaths = Object.entries(spec.paths).filter(([path]) =>
      path.startsWith('/admin/'),
    );
    expect(adminPaths.length).toBeGreaterThan(10);
    for (const [, methods] of adminPaths) {
      for (const operation of Object.values(methods)) {
        expect(operation.tags).toEqual(['Admin']);
        expect(operation.summary).toMatch(/^\[Admin\]/);
        expect(operation.security).toEqual([{ cookieAuth: [] }]);
      }
    }
  });

  it('marque les routes mises à jour (point vert Swagger)', () => {
    const marked = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([, operation]) => operation['x-updated'])
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );
    expect(marked).toEqual(
      expect.arrayContaining([
        'GET /influencers/{handle}',
        'GET /influencers',
        'GET /catalog',
        'GET /admin/catalog',
        'POST /payments/callback',
      ]),
    );
    expect(marked.length).toBeGreaterThanOrEqual(10);
  });

  it('documente chaque route admin de la matrice des rôles', () => {
    const adminRoutes = ROLE_MATRIX.filter((route) =>
      route.path.startsWith('/api/admin/'),
    );
    for (const route of adminRoutes) {
      const path = route.path
        .replace(/^\/api/, '')
        .replace(/:([A-Za-z]+)/g, '{$1}');
      const method = route.method.toLowerCase();
      expect(
        spec.paths[path]?.[method],
        `${route.method} ${path}`,
      ).toBeTruthy();
      expect(spec.paths[path]?.[method]?.tags).toEqual(['Admin']);
    }
  });
});
