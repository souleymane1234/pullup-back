export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
