const numberFormat = new Intl.NumberFormat('fr-FR');

export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(Number(value) || 0));
}

/** Identique au front : séparateur de milliers fine insécable + « FCFA ». */
export function formatFcfa(value: number): string {
  return `${formatNumber(value)} FCFA`;
}
