export function maskEmail(value: string | null | undefined): string {
  const email = String(value ?? '');
  const at = email.indexOf('@');
  if (at < 1) {
    return '••@••';
  }
  return `${email[0]}••@${email.slice(at + 1)}`;
}

export function maskSecrets(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (match) =>
      maskEmail(match),
    )
    .replace(/\+?225[\s.-]?\d[\d\s.-]{6,}/g, '•• •• •• ••')
    .replace(/\b0[157]\d[\d\s.-]{6,}\b/g, '•• •• •• ••');
}
