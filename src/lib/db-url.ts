/**
 * Normalize connection string ของ Supabase
 *
 * รหัสผ่านที่สุ่มมามักมีอักขระ $ * ! % ซึ่งต้อง percent-encode ก่อนใช้เป็น URI
 * (ถ้าไม่ encode จะได้ error "URI malformed" หรือ auth ไม่ผ่าน)
 *
 * encode เมื่อไม่ใช่ URI ที่ encode ไว้แล้วเท่านั้น — ตรวจว่ามี %XX อยู่จริง
 * เพื่อไม่ให้ encode ซ้ํา (which would turn %20 into %2520)
 */
export function normalizeDbUrl(raw: string): string {
  const m = raw.match(/^(postgresql:\/\/)([^:]+):(.*)@([^/]+)(\/.*)$/);
  if (!m) return raw;
  const [, scheme, user, pass, hostPort, rest] = m;

  const hasPercentEscape = /%[0-9A-Fa-f]{2}/.test(pass);
  if (hasPercentEscape) return raw;

  const enc = encodeURIComponent(pass);
  if (enc === pass) return raw;
  return `${scheme}${user}:${enc}@${hostPort}${rest}`;
}