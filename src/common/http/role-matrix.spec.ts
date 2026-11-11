import { generatedMatrix, ROLE_MATRIX } from './role-matrix.js';

describe('matrice rôles × routes', () => {
  it('génère une cellule pour chaque rôle et chaque route', () => {
    expect(ROLE_MATRIX.length).toBeGreaterThan(10);
    expect(generatedMatrix()).toHaveLength(ROLE_MATRIX.length * 4);
  });

  it('refuse un visiteur sur les routes authentifiées et un influenceur sur le back-office', () => {
    const cells = generatedMatrix();
    expect(
      cells.find((cell) => cell.path === '/api/campaigns' && cell.role === null)
        ?.status,
    ).toBe(401);
    expect(
      cells.find(
        (cell) =>
          cell.path === '/api/admin/dashboard' && cell.role === 'influencer',
      )?.status,
    ).toBe(403);
    expect(
      cells.find(
        (cell) => cell.path === '/api/billing/boosts' && cell.role === 'brand',
      )?.status,
    ).toBe(403);
    expect(
      cells.find(
        (cell) => cell.path === '/api/uploads/brief' && cell.role === 'brand',
      )?.status,
    ).toBe(200);
    expect(
      cells.find((cell) => cell.path === '/api/health' && cell.role === null)
        ?.status,
    ).toBe(200);
  });
});
