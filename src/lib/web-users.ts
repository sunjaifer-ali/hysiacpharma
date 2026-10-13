import { useSyncExternalStore } from "react";
import { hashPassword } from "@/lib/app-lock";

/** Website accounts. Not part of the books file, so a JSON backup does not copy passwords. */
const USERS_KEY = "hysiac-web-users-v1";
const SESSION_KEY = "hysiac-web-session-v1";

export type WebRole = "admin" | "billing";

export type WebAccount = {
  id: string;
  username: string;
  passwordHash: string;
  role: WebRole;
};

export type WebSession = {
  id: string;
  username: string;
  role: WebRole;
};

const BILLING_PREFIXES = ["/", "/invoices", "/quotes", "/returns", "/credits", "/products", "/parties"];

export function canOpen(role: WebRole, pathname: string): boolean {
  if (role === "admin") return true;
  if (pathname === "/") return true;
  return BILLING_PREFIXES.some((prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

function readUsers(): WebAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is WebAccount => {
      if (!row || typeof row !== "object") return false;
      const user = row as Partial<WebAccount>;
      return (
        typeof user.id === "string" &&
        typeof user.username === "string" &&
        typeof user.passwordHash === "string" &&
        (user.role === "admin" || user.role === "billing")
      );
    });
  } catch {
    return [];
  }
}

function writeUsers(users: WebAccount[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event("hysiac-web-users"));
}

export function listWebUsers(): WebAccount[] {
  return readUsers();
}

export async function ensureDefaultAdmin(): Promise<void> {
  const users = readUsers();
  if (users.some((user) => user.username === "admin")) return;
  writeUsers([
    {
      id: "admin",
      username: "admin",
      passwordHash: await hashPassword("admin"),
      role: "admin",
    },
    ...users,
  ]);
}

export async function signInWeb(username: string, password: string): Promise<WebSession | null> {
  await ensureDefaultAdmin();
  const name = username.trim().toLowerCase();
  const hash = await hashPassword(password);
  const user = readUsers().find((row) => row.username === name && row.passwordHash === hash);
  if (!user) return null;
  const session: WebSession = { id: user.id, username: user.username, role: user.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("hysiac-web-session"));
  return session;
}

export function signOutWeb(): void {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("hysiac-web-session"));
}

export function readWebSession(): WebSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebSession>;
    if (!parsed.id || !parsed.username || (parsed.role !== "admin" && parsed.role !== "billing")) return null;
    const still = readUsers().some((user) => user.id === parsed.id);
    if (!still && parsed.id !== "admin") return null;
    return { id: parsed.id, username: parsed.username, role: parsed.role };
  } catch {
    return null;
  }
}

export async function addWebUser(username: string, password: string, role: WebRole): Promise<string | null> {
  const name = username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  if (name.length < 3) return "User name must be at least 3 letters";
  if (password.length < 4) return "Password must be at least 4 characters";
  await ensureDefaultAdmin();
  const users = readUsers();
  if (users.some((user) => user.username === name)) return "That user name is already used";
  writeUsers([...users, { id: crypto.randomUUID(), username: name, passwordHash: await hashPassword(password), role }]);
  return null;
}

export async function setWebPassword(id: string, password: string): Promise<string | null> {
  if (password.length < 4) return "Password must be at least 4 characters";
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return "User was not found";
  users[index] = { ...users[index], passwordHash: await hashPassword(password) };
  writeUsers(users);
  return null;
}

export function removeWebUser(id: string): void {
  if (id === "admin") return;
  writeUsers(readUsers().filter((user) => user.id !== id));
  const session = readWebSession();
  if (session?.id === id) signOutWeb();
}

function subscribe(event: string, onStore: () => void): () => void {
  const notify = () => onStore();
  window.addEventListener(event, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(event, notify);
    window.removeEventListener("storage", notify);
  };
}

export function useWebSession(): WebSession | null {
  return useSyncExternalStore(
    (onStore) => subscribe("hysiac-web-session", onStore),
    readWebSession,
    () => null,
  );
}

export function useWebUsers(): WebAccount[] {
  return useSyncExternalStore(
    (onStore) => subscribe("hysiac-web-users", onStore),
    readUsers,
    () => [],
  );
}
