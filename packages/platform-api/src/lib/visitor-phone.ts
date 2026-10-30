export function normalizeVisitorPhone(
  dialCode: string,
  phoneNumber: string,
): { dialCode: string; phone: string; e164: string } | null {
  const dial = dialCode.trim().replace(/\s/g, "");
  const num = phoneNumber.trim().replace(/\D/g, "");
  if (!/^\+\d{1,4}$/.test(dial)) return null;
  if (num.length < 6 || num.length > 15) return null;
  return { dialCode: dial, phone: num, e164: `${dial}${num}` };
}
