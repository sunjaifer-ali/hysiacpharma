/** Map a user name or email to the Better Auth email identifier. */
export function loginEmail(user: string): string {
  const raw = user.trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const local = raw.replace(/[^a-z0-9._+-]+/g, "");
  return local ? `${local}@hysiac.local` : "";
}

export const DEFAULT_LOGIN = {
  username: "admin",
  password: "admin",
  email: loginEmail("admin"),
} as const;
