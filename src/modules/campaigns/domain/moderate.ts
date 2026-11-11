const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?225[\s.-]*)?(?:0?\d[\s.-]*){8,}/g;

export function moderateMessage(text: string, status: string): string {
  if (status !== 'awaiting_payment' && status !== 'paid') {
    return text;
  }
  return text.replace(EMAIL, '[email]').replace(PHONE, '[téléphone]');
}
