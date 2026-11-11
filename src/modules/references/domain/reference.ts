export function campaignSequenceName(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `campaign:${year}-${month}`;
}

export function formatCampaignRef(date: Date, value: number): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nnn = String(value).padStart(3, '0');
  return `PU-${yy}${mm}-${nnn}`;
}
