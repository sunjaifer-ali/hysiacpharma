import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { freshFinancialYear, inferYearId } from "@/lib/financial-year";
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
  if (password.length > 200) return "Password is too long";
  if (password.trim().toLowerCase() === "admin") return "Choose a password that is not admin";
  return null;
}

const DUMMY_HASH = hashPassword("not-a-real-password");

function sessionKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cleanName(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
}

function clientIp(): string {
  try {
    const request = getRequest();
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
    const forwarded = request.headers.get("x-forwarded-for") ?? "";
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const ip = parts[parts.length - 1] ?? "";
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
  await sql`
    create table if not exists shop_backup (
      day text primary key,
      data jsonb not null,
      saved_at timestamptz not null default now(),
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
    where s.token = ${sessionKey(token)} and s.expires_at > now()
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
    const name = cleanName(data.username).slice(0, 64);
    const ip = clientIp();
    if (await loginBlocked(sql, name, ip)) {
      return { ok: false, error: "Too many tries. Wait 15 minutes." };
    }
    if (data.password.length === 0 || data.password.length > 200) {
      await sql`insert into staff_login_attempt (username, ip) values (${name || "unknown"}, ${ip})`;
      return { ok: false, error: "Wrong user name or password" };
    }
    const rows = await sql<AccountRow>`
      select id, username, role, password_hash, must_change from staff_account where username = ${name} limit 1
    `;
    const account = rows[0];
    const matches = passwordMatches(data.password, account?.password_hash ?? DUMMY_HASH);
    if (!account || !matches) {
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
      values (${sessionKey(token)}, ${account.id}, ${expires})
    `;
    writeSession(token, TWO_WEEKS);
    return {
      ok: true,
      user: { id: account.id, username: account.username, role: account.role, mustChange },
    };
  });

function recoveryReady(): boolean {
  return (process.env.PASSWORD_RECOVERY_CODE?.trim().length ?? 0) >= 8;
}

function recoveryMatches(given: string): boolean {
  const expected = process.env.PASSWORD_RECOVERY_CODE?.trim() ?? "";
  if (expected.length < 8) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const staffRecover = createServerFn({ method: "POST" })
  .validator((data: { username?: string; recoveryCode?: string; password?: string }) => ({
    username: String(data?.username ?? ""),
    recoveryCode: String(data?.recoveryCode ?? ""),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!recoveryReady()) return { ok: false, error: "Password recovery is not set up yet" };
    const sql = await ready();
    const name = cleanName(data.username).slice(0, 64);
    const ip = clientIp();
    if (await loginBlocked(sql, name || "recover", ip)) {
      return { ok: false, error: "Too many tries. Wait 15 minutes." };
    }
    const weak = passwordProblem(data.password);
    if (!name || !recoveryMatches(data.recoveryCode) || weak) {
      await sql`insert into staff_login_attempt (username, ip) values (${name || "recover"}, ${ip})`;
      return { ok: false, error: weak && recoveryMatches(data.recoveryCode) ? weak : "Wrong recovery code or user name" };
    }
    const updated = await sql<{ id: string }>`
      update staff_account set password_hash = ${hashPassword(data.password)}, must_change = ${false} where username = ${name} returning id
    `;
    if (!updated[0]) {
      await sql`insert into staff_login_attempt (username, ip) values (${name}, ${ip})`;
      return { ok: false, error: "Wrong recovery code or user name" };
    }
    await sql`delete from staff_session where user_id = ${updated[0].id}`;
    await sql`delete from staff_login_attempt where username = ${name}`;
    return { ok: true };
  });

export const staffSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(COOKIE);
  if (token) {
    const sql = await ready();
    await sql`delete from staff_session where token = ${sessionKey(token)}`;
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
    const own = data.id === me.id;
    const sql = await ready();
    if (own) {
      const rows = await sql<{ password_hash: string }>`
        select password_hash from staff_account where id = ${me.id} limit 1
      `;
      if (!rows[0] || !passwordMatches(data.currentPassword, rows[0].password_hash)) {
        return { ok: false, error: "Current password is wrong" };
      }
    }
    const updated = await sql<{ id: string }>`
      update staff_account set password_hash = ${hashPassword(data.password)}, must_change = ${!own} where id = ${data.id} returning id
    `;
    if (!updated[0]) return { ok: false, error: "User was not found" };
    if (own) {
      const token = sessionKey(getCookie(COOKIE) ?? "");
      await sql`delete from staff_session where user_id = ${data.id} and token <> ${token}`;
    } else {
      await sql`delete from staff_session where user_id = ${data.id}`;
    }
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

const MERGE_KEYS = ["invoices", "purchases", "purchaseOrders", "quotes", "creditNotes", "payments", "products", "parties", "adjustments", "openingDues", "bin"];
const NEXT_KEYS = ["nextNumber", "nextPurchaseNumber", "nextPurchaseOrderNumber", "nextReturnNumber", "nextCreditNoteNumber", "nextQuoteNumber", "nextReceiptNumber", "nextPaymentVoucherNumber"];

function mergeBooks(stored: Record<string, unknown>, incoming: Record<string, unknown>, role: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...stored, ...incoming };
  for (const key of MERGE_KEYS) out[key] = mergeList(stored[key], incoming[key]);
  if (stored.company && incoming.company && typeof stored.company === "object" && typeof incoming.company === "object") {
    const server = stored.company as Record<string, unknown>;
    const client = incoming.company as Record<string, unknown>;
    const company: Record<string, unknown> = role === "admin" ? { ...server, ...client } : { ...client, ...server };
    for (const key of NEXT_KEYS) company[key] = Math.max(Number(server[key]) || 0, Number(client[key]) || 0);
    out.company = company;
  }
  return out;
}

function mergeList(server: unknown, client: unknown): unknown[] {
  const map = new Map<string, unknown>();
  for (const row of Array.isArray(server) ? server : []) {
    const id = rowId(row);
    if (id) map.set(id, row);
  }
  for (const row of Array.isArray(client) ? client : []) {
    const id = rowId(row);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    const nextTime = rowTime(row);
    const prevTime = rowTime(prev);
    map.set(id, nextTime >= prevTime ? row : prev);
  }
  return [...map.values()];
}

function rowId(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

function rowTime(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const time = (row as { updatedAt?: unknown }).updatedAt;
  return typeof time === "string" ? time : "";
}

export const booksSave = createServerFn({ method: "POST" })
  .validator((data: { json?: string; backup?: boolean; baseUpdatedAt?: string }) => {
    const json = String(data?.json ?? "");
    if (json.length < 2 || json.length > 4_000_000) throw new Error("Books are empty or too large");
    return { json, backup: data?.backup === true, baseUpdatedAt: String(data?.baseUpdatedAt ?? "") };
  })
  .handler(async ({ data }): Promise<{ ok: true; updatedAt: string; merged?: string } | { ok: false; error: string }> => {
    const me = await current();
    if (!me) return { ok: false, error: "Sign in again" };
    if (me.mustChange) return { ok: false, error: "Change the password before opening the books" };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.json) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Books are not valid" };
    }
    if (!parsed.company || !Array.isArray(parsed.invoices)) return { ok: false, error: "Books are not valid" };
    const sql = await ready();
    const existing = await sql<{ data: unknown; updated_at: string }>`
      select data, updated_at::text as updated_at from shop_books where id = ${"shop"} limit 1
    `;
    const previous = existing[0]?.data;
    const stored = (typeof previous === "string" ? JSON.parse(previous) : previous) as Record<string, unknown> | null;
    let payload = parsed;
    let merged = false;
    if (stored && data.baseUpdatedAt !== (existing[0]?.updated_at ?? "")) {
      payload = mergeBooks(stored, parsed, me.role);
      merged = true;
    }
    if (me.role !== "admin" && stored) {
      const storedCompany = stored.company as Record<string, unknown> | undefined;
      const nextCompany = payload.company as Record<string, unknown> | undefined;
      if (storedCompany && nextCompany) {
        const locked = [
          "legalName", "tradeName", "gstin", "cin", "email", "phone",
          "addressLine1", "addressLine2", "city", "pincode", "stateCode",
          "bankName", "bankBranch", "bankAccount", "bankIfsc",
          "drugLicense20", "drugLicense21", "drugLicenseValidUpto",
          "terms", "signatory", "salesman",
        ];
        for (const key of locked) {
          if (String(storedCompany[key] ?? "") !== String(nextCompany[key] ?? "")) {
            return { ok: false, error: "Only a full-access user can change company details" };
          }
        }
      }
      const shrunk = (before: unknown, after: unknown) =>
        Array.isArray(before) && Array.isArray(after) && after.length < before.length;
      const keys = ["invoices", "purchases", "products", "parties", "quotes", "creditNotes", "payments", "purchaseOrders", "openingDues", "adjustments"];
      if (keys.some((key) => shrunk(stored[key], payload[key]))) {
        return { ok: false, error: "Only a full-access user can delete records" };
      }
    }
    const json = JSON.stringify(payload);
    if (json.length > 4_000_000) return { ok: false, error: "Books are too large" };
    const storedYear = stored ? inferYearId(stored.company as { invoicePrefix?: string; financialYear?: string }) : "";
    const nextYear = inferYearId(payload.company as { invoicePrefix?: string; financialYear?: string });
    if (stored && storedYear !== nextYear) {
      return { ok: false, error: "These books are for a different financial year. Refresh the page." };
    }
    const rows = await sql<{ updated_at: string }>`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${"shop"}, ${json}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
      returning updated_at::text as updated_at
    `;
    await sql`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${`year:${nextYear}`}, ${json}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
    `;
    if (data.backup) {
      await sql`
        insert into shop_backup (day, data, saved_at, updated_by)
        select to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') || '#earlier', data, saved_at, updated_by
        from shop_backup
        where day = to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM-DD')
        on conflict (day) do update
        set data = excluded.data, saved_at = excluded.saved_at, updated_by = excluded.updated_by
      `;
      await sql`
        insert into shop_backup (day, data, saved_at, updated_by)
        values (
          to_char((now() at time zone 'Asia/Kolkata'), 'YYYY-MM-DD'),
          ${json}::jsonb,
          now(),
          ${me.username}
        )
        on conflict (day) do update
        set data = excluded.data, saved_at = excluded.saved_at, updated_by = excluded.updated_by
      `;
    }
    await sql`
      delete from shop_backup
      where split_part(day, '#', 1) < to_char(((now() at time zone 'Asia/Kolkata') - interval '2 days'), 'YYYY-MM-DD')
    `;
    return { ok: true, updatedAt: rows[0]?.updated_at ?? new Date().toISOString(), ...(merged ? { merged: json } : {}) };
  });

export const booksHistory = createServerFn({ method: "GET" }).handler(async () => {
  const me = await current();
  if (!me || me.role !== "admin") return { ok: false as const, error: "Only a full-access user can view backups" };
  if (me.mustChange) return { ok: false as const, error: "Change the password before opening the books" };
  const sql = await ready();
  const live = await sql<{ updated_at: string; updated_by: string }>`
    select updated_at::text as updated_at, updated_by from shop_books where id = ${"shop"} limit 1
  `;
  const days = await sql<{ day: string; saved_at: string; updated_by: string }>`
    select day, saved_at::text as saved_at, updated_by from shop_backup order by day desc limit 3
  `;
  return {
    ok: true as const,
    latest: live[0] ? { savedAt: live[0].updated_at, by: live[0].updated_by } : null,
    days: days.map((row) => ({ day: row.day, savedAt: row.saved_at, by: row.updated_by })),
  };
});

export const booksRestore = createServerFn({ method: "POST" })
  .validator((data: { day?: string }) => ({ day: String(data?.day ?? "latest") }))
  .handler(async ({ data }) => {
    const me = await current();
    if (!me || me.role !== "admin") return { ok: false as const, error: "Only a full-access user can restore a backup" };
    if (me.mustChange) return { ok: false as const, error: "Change the password before opening the books" };
    const sql = await ready();
    const asJson = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));
    if (data.day === "latest") {
      const rows = await sql<{ data: unknown; updated_at: string }>`
        select data, updated_at::text as updated_at from shop_books where id = ${"shop"} limit 1
      `;
      if (!rows[0]) return { ok: false as const, error: "Neon has no backup yet" };
      return { ok: true as const, json: asJson(rows[0].data), updatedAt: rows[0].updated_at };
    }
    if (!/^\d{4}-\d{2}-\d{2}(#earlier)?$/.test(data.day)) return { ok: false as const, error: "Choose a backup date" };
    const rows = await sql<{ data: unknown; saved_at: string }>`
      select data, saved_at::text as saved_at from shop_backup where day = ${data.day} limit 1
    `;
    if (!rows[0]) return { ok: false as const, error: "That backup date was not found" };
    return { ok: true as const, json: asJson(rows[0].data), updatedAt: rows[0].saved_at };
  });

export const booksYears = createServerFn({ method: "GET" }).handler(async () => {
  const me = await current();
  if (!me) return { ok: false as const, error: "Sign in again", years: [] as string[] };
  const sql = await ready();
  const rows = await sql<{ id: string }>`select id from shop_books where id like ${"year:%"} order by id`;
  const live = await sql<{ data: unknown }>`select data from shop_books where id = ${"shop"} limit 1`;
  const currentYear = live[0] ? inferYearId(yearCompany(live[0].data)) : "";
  const years: string[] = [...new Set([...rows.map((row) => String(row.id).slice(5)), ...(currentYear ? [currentYear] : [])])].sort();
  return { ok: true as const, years, current: currentYear };
});

export const booksUseYear = createServerFn({ method: "POST" })
  .validator((data: { json?: string; year?: string; start?: boolean }) => {
    const json = String(data?.json ?? "");
    const year = String(data?.year ?? "");
    if (!/^\d{4}-\d{2}$/.test(year)) throw new Error("Choose a financial year");
    if (json.length < 2 || json.length > 4_000_000) throw new Error("Books are empty or too large");
    return { json, year, start: data?.start === true };
  })
  .handler(async ({ data }) => {
    const me = await current();
    if (!me || me.role !== "admin") return { ok: false as const, error: "Only a full-access user can change the financial year" };
    if (me.mustChange) return { ok: false as const, error: "Change the password before opening the books" };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.json) as Record<string, unknown>;
    } catch {
      return { ok: false as const, error: "Books are not valid" };
    }
    if (!parsed.company || !Array.isArray(parsed.invoices)) return { ok: false as const, error: "Books are not valid" };
    const sql = await ready();
    const currentYear = inferYearId(parsed.company as { invoicePrefix?: string; financialYear?: string });
    const currentJson = JSON.stringify({ ...parsed, company: { ...(parsed.company as object), financialYear: currentYear } });
    await sql`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${`year:${currentYear}`}, ${currentJson}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
    `;
    const existing = await sql<{ data: unknown }>`select data from shop_books where id = ${`year:${data.year}`} limit 1`;
    let nextJson = "";
    if (data.start) {
      if (data.year === currentYear) return { ok: false as const, error: "This financial year is already open" };
      if (existing[0]) return { ok: false as const, error: "That year already exists. Open it from the year list." };
      if (data.year < currentYear) return { ok: false as const, error: "Open the earlier year from the list" };
      nextJson = JSON.stringify(freshFinancialYear(JSON.parse(currentJson), data.year));
    } else if (data.year === currentYear) {
      nextJson = currentJson;
    } else if (!existing[0]) {
      return { ok: false as const, error: "That financial year has not been started" };
    } else {
      nextJson = typeof existing[0].data === "string" ? existing[0].data : JSON.stringify(existing[0].data);
    }
    const rows = await sql<{ updated_at: string }>`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${"shop"}, ${nextJson}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
      returning updated_at::text as updated_at
    `;
    await sql`
      insert into shop_books (id, data, updated_at, updated_by)
      values (${`year:${data.year}`}, ${nextJson}::jsonb, now(), ${me.username})
      on conflict (id) do update
      set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by
    `;
    return { ok: true as const, json: nextJson, updatedAt: rows[0]?.updated_at ?? new Date().toISOString() };
  });

function yearCompany(data: unknown): { invoicePrefix?: string; financialYear?: string } {
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== "object") return {};
  return ((parsed as { company?: { invoicePrefix?: string; financialYear?: string } }).company ?? {});
}
