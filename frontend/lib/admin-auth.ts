import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "inchka_admin";

function token(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(pw).digest("hex");
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function verifyPassword(password: string): boolean {
  const expected = token();
  if (!expected) return false;
  const got = createHash("sha256").update(password).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

export function adminCookieValue(): string | null {
  return token();
}

export function isAdminSession(): boolean {
  const expected = token();
  if (!expected) return false;
  const jar = cookies();
  return jar.get(COOKIE)?.value === expected;
}

export { COOKIE as ADMIN_COOKIE };
