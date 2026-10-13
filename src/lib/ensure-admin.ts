import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { DEFAULT_LOGIN } from "@/lib/login-id";

/**
 * Idempotent: creates the default admin / admin login if it is missing.
 * Password is hashed with Better Auth's hasher so sign-in verifies it.
 */
export const ensureAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  const email = DEFAULT_LOGIN.email;
  const existing = await sql<{ id: string }>`
    select id from "user" where email = ${email} limit 1
  `;
  const userId = existing[0]?.id ?? "admin-user";
  if (!existing[0]) {
    const now = new Date();
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${DEFAULT_LOGIN.username}, ${email}, ${true}, ${now}, ${now})
    `;
  }
  const account = await sql<{ id: string }>`
    select id from "account" where "userId" = ${userId} and "providerId" = ${"credential"} limit 1
  `;
  if (!account[0]) {
    const now = new Date();
    const password = await hashPassword(DEFAULT_LOGIN.password);
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${"admin-account"}, ${userId}, ${"credential"}, ${userId}, ${password}, ${now}, ${now})
    `;
  }
  return { ok: true as const };
});
