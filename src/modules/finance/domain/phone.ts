/** Masque un numéro ivoirien pour les journaux : `07 •• •• 12`. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) {
    return '•• ••';
  }
  const local = digits.slice(-10);
  return `${local.slice(0, 2)} •• •• ${local.slice(-2)}`;
}
