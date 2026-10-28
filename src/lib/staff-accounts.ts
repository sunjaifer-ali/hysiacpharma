import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

const COOKIE = "hysiac_staff";
const TWO_WEEKS = 60 * 60 * 24 * 14;

export type StaffRole = "admin" | "billing";
export type StaffPublic = { id: string; username: string; role: StaffRole; mustChange?: boolean };

type AccountRow = StaffPublic & { password_hash: string; must_change?: boolean };

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.trim().toLowerCase() === "admin") return "Choose a password that is not admin";
  return null;
}

function cleanName(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
}

function clientIp(): string {
  try {
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
    return ip.slice(0, 64) || "unknown";
  } catch {
    return "unknown";
  }
}

async function ready() {
  const sql = await getSql();
  await sql`
    create table if not exists staff_account (
      id text primary key,
      username text not null unique,
      password_hash text not null,
      role text not null check (role in ('admin', 'billing')),
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table staff_account add column if not exists must_change boolean not null default false`;
  await sql`
    create table if not exists staff_session (
      token text primary key,
      user_id text not null references staff_account(id) on delete cascade,
      expires_at timestamptz not null
    )
  `;
  await sql`
    create table if not exists staff_login_attempt (
      id bigserial primary key,
      username text not null,
      ip text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists shop_books (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      updated_by text not null default ''
    )
  `;
  const count = await sql<{ n: number }>`select count(*)::int as n from staff_account`;
  if ((count[0]?.n ?? 0) === 0) {
    await sql`
      insert into staff_account (id, username, password_hash, role, must_change)
      values (${"admin"}, ${"admin"}, ${hashPassword("admin")}, ${"admin"}, ${true})
    `;
  }
  return sql;
}

function writeSession(token: string, maxAge: number) {
  setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
  });
}

async function current(): Promise<StaffPublic | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const sql = await ready();
  const rows = await sql<{ id: string; username: string; role: StaffRole; must_change: boolean }>`
    select a.id, a.username, a.role, a.must_change
    from staff_session s
    join staff_account a on a.id = s.user_id
    where s.token = ${token} and s.expires_at > now()
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, mustChange: Boolean(row.must_change) };
}

async function loginBlocked(sql: Awaited<ReturnType<typeof ready>>, name: string, ip: string): Promise<boolean> {
  await sql`delete from staff_login_attempt where created_at < now() - interval '1 day'`;
  const byName = await sql<{ n: number }>`
    select count(*)::int as n from staff_login_attempt
    where username = ${name} and created_at > now() - interval '15 minutes'
  `;
  const byIp = await sql<{ n: number }>`
    select count(*)::int as n from staff_login_attempt
    where ip = ${ip} and created_at > now() - interval '15 minutes'
  `;
  return (byName[0]?.n ?? 0) >= 8 || (byIp[0]?.n ?? 0) >= 20;
}

export const staffMe = createServerFn({ method: "GET" }).handler(async () => current());

export const staffSignIn = createServerFn({ method: "POST" })
  .validator((data: { username?: string; password?: string }) => ({
    username: String(data?.username ?? ""),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: true; user: StaffPublic } | { ok: false; error: string }> => {
    const sql = await ready();
    const name = cleanName(data.username);
    const ip = clientIp();
    if (await loginBlocked(sql, name, ip)) {
      return { ok: false, error: "Too many tries. Wait 15 minutes." };
    }
    const rows = await sql<AccountRow>`
      select id, username, role, password_hash, must_change from staff_account where username = ${name} limit 1
    `;
    const account = rows[0];
    if (!account || !passwordMatches(data.password, account.password_hash)) {
      await sql`insert into staff_login_attempt (username, ip) values (${name || "unknown"}, ${ip})`;
      return { ok: false, error: "Wrong user name or password" };
    }
    const mustChange = Boolean(account.must_change) || data.password.trim().toLowerCase() === "admin";
    if (mustChange && !account.must_change) {
      await sql`update staff_account set must_change = ${true} where id = ${account.id}`;
    }
    await sql`delete from staff_login_attempt where username = ${name}`;
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + TWO_WEEKS * 1000);
    await sql`
      insert into staff_session (token, user_id, expires_at)
      values (${token}, ${account.id}, ${expires})
    `;
    writeSession(token, TWO_WEEKS);
    return {
      ok: true,
      user: { id: account.id, username: account.username, role: account.role, mustChange },
    };
  });

export const staffSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(COOKIE);
  if (token) {
    const sql = await ready();
    await sql`delete from staff_session where token = ${token}`;
  }
  writeSession("", 0);
  return { ok: true as const };
});

export const staffList = createServerFn({ method: "GET" }).handler(async () => {
  const me = await current();
  if (!me || me.role !== "admin") return [] as StaffPublic[];
  const sql = await ready();
  return sql<StaffPublic>`select id, username, role from staff_account order by username`;
});

export const staffAdd = createServerFn({ method: "POST" })
  .validator((data: { username?: string; password?: string; role?: string }) => ({
    username: String(data?.username ?? ""),
    password: String(data?.password ?? ""),
    role: data?.role === "admin" ? "admin" : "billing",
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await current();
    if (!me || me.role !== "admin") return { ok: false, error: "Only a full-access user can add accounts" };
    const name = cleanName(data.username);
    if (name.length < 3) return { ok: false, error: "User name must be at least 3 letters" };
    const weak = passwordProblem(data.password);
    if (weak) return { ok: false, error: weak };
    const sql = await ready();
    const existing = await sql<{ id: string }>`select id from staff_account where username = ${name} limit 1`;
    if (existing[0]) return { ok: false, error: "That user name is already used" };
    await sql`
      insert into staff_account (id, username, password_hash, role)
      values (${crypto.randomUUID()}, ${name}, ${hashPassword(data.password)}, ${data.role})
    `;
    return { ok: true };
  });

export const staffRemove = createServerFn({ method: "POST" })
  .validator((data: { id?: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await current();
    if (!me || me.role !== "admin") return { ok: false, error: "Only a full-access user can remove accounts" };
    if (data.id === me.id) return { ok: false, error: "You cannot remove the account you are using" };
    const sql = await ready();
    const target = await sql<StaffPublic>`select id, username, role from staff_account where id = ${data.id} limit 1`;
    if (!target[0]) return { ok: false, error: "User was not found" };
    if (target[0].role === "admin") {
      const admins = await sql<{ n: number }>`select count(*)::int as n from staff_account where role = ${"admin"}`;
      if ((admins[0]?.n ?? 0) <= 1) return { ok: false, error: "Keep at least one full-access user" };
    }
    await sql`delete from staff_account where id = ${data.id}`;
    return { ok: true };
  });

export const staffSetPassword = createServerFn({ method: "POST" })
  .validator((data: { id?: string; password?: string; currentPassword?: string }) => ({
    id: String(data?.id ?? ""),
    password: String(data?.password ?? ""),
    currentPassword: String(data?.currentPassword ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const me = await current();
    if (!me) return { ok: false, error: "Sign in again" };
    if (me.role !== "admin" && data.id !== me.id) return { ok: false, error: "Only an admin can change another password" };
    const weak = passwordProblem(data.password);
    if (weak) return { ok: false, error: weak };
    const sql = await ready();
    if (data.id === me.id) {
      const rows = await sql<{ password_hash: string }>`
        select password_hash from staff_account where id = ${me.id} limit 1
      `;
      if (!rows[0] || !passwordMatches(data.currentPassword, rows[0].password_hash)) {
        return { ok: false, error: "Current password is wrong" };
      }
    }
    const updated = await sql<{ id: string }>`
      update staff_account set password_hash = ${hashPassword(data.password)}, must_change = ${false} where id = ${data.id} returning id
    `;
    if (!updated[0]) return { ok: false, error: "User was not found" };
    const token = getCookie(COOKIE) ?? "";
    await sql`delete from staff_session where user_id = ${data.id} and token <> ${token}`;
    return { ok: true };
  });

export const booksLoad = createServerFn({ method: "GET" }).handler(async () => {
  const me = await current();
  if (!me) return { ok: false as const, error: "Sign in again" };
  if (me.mustChange) return { ok: false as const, error: "Change the password before opening the books" };
  const sql = await ready();
  const rows = await sql<{ data: unknown; updated_at: string }>`
    select data, updated_at::text as updated_at from shop_books where id = ${"shop"} limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: true as const, books: null, updatedAt: null };
  const books = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  return { ok: true as const, books, updatedAt: row.updated_at };
});

export const booksSave = createServerFn({ method: "POST" })
  .validator((data: { json?: string }) => {
    const json = String(data?.json ?? "");
    if (json.length < 2 || json.length > 4_000_000) throw new Error("Books are empty or too large");
    return { json };
  })
  .handler(async ({ data }): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> => {
    const me = await current();
    if (!me) return { ok: false, error: "Sign in again" };
    if (me.mustChange) return { ok: false, error: "Change the password before opening the books" };
    let parsed: { company?: Record<string, unknown>; invoices?: unknown; purchases?: unknown; products?: unknown };
    try {
      parsed = JSON.parse(data.json) as { company?: Record<string, unknown>; invoices?: unknown; purchases?: unknown; products?: unknown };
    } catch {
      return { ok: false, error: "Books are not valid" };
    }
    if (!parsed.company || !Array.isArray(parsed.invoices)) return { ok: false, error: "Books are not valid" };
    const sql = await ready();
    if (me.role !== "admin") {
      const existing = await sql<{ data: unknown }>`select data from shop_books where id = ${"shop"} limit 1`;
      const previous = existing[0]?.data;
      const stored = (typeof previous === "string" ? JSON.parse(previous) : previous) as
        | { company?: Record<string, unknown>; invoices?: unknown[]; purchases?: unknown[]; products?: unknown[] }
        | null;
      if (stored?.company) {
        const locked = ["legalName", "tradeName", "gstin", "cin", "email", "phone", "bankName", "bankAccount", "bankIfsc", "drugLicense"];
        for (const key of locked) {
          if (String(stored.company[key] ?? "") !== String(parsed.company[key] ?? "")) {
            return { ok: false, error: "Only a full-access user can change company details" };
          }
        }
      }
      const shrunk = (before: unknown, after: unknown) =>
        Array.isArray(before) && Array.isArray(after) && after.length + 3 < before.length;
      if (shrunk(stored?.invoices, parsed.invoices) || shrunk(stored?.purchases, parsed.purchases) || shrunk(stored?.products, parsed.products)) {
        return { ok: false, error: "Only a full-access user can remove many records at once" };
      }
    }
    const rows = await sql<{ updated_at: string }>`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${"shop"}, ${data.json}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
      returning updated_at::text as updated_at
    `;
    return { ok: true, updatedAt: rows[0]?.updated_at ?? new Date().toISOString() };
  });
