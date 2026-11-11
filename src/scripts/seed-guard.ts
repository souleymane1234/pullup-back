export function assertSeedAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Le seed de démonstration est refusé en production.');
  }
}
