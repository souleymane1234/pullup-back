import { normalizeHandle } from './handle.js';

describe('normalizeHandle', () => {
  it('garde minuscules, chiffres, point et tiret bas', () => {
    expect(normalizeHandle('Ama Kouassi!')).toBe('amakouassi');
    expect(normalizeHandle('Yao.Tech_225')).toBe('yao.tech_225');
  });
});
