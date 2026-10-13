export type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(rec: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function asFile(value: unknown): DriveFile | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const nested = rec.file ? asRecord(rec.file) : rec.item ? asRecord(rec.item) : rec;
  if (!nested) return null;
  const id = pickString(nested, ["id", "fileId", "file_id"]);
  const name = pickString(nested, ["name", "title", "fileName", "file_name"]) ?? "";
  if (!id) return null;
  const mimeType = pickString(nested, ["mimeType", "mime_type", "mime"]);
  return { id, name, mimeType };
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (!rec) return [];
  for (const key of ["files", "items", "results", "nodes", "data"]) {
    const inner = rec[key];
    if (Array.isArray(inner)) return inner;
    const nested = asRecord(inner);
    if (nested) {
      for (const nkey of ["files", "items", "results"]) {
        if (Array.isArray(nested[nkey])) return nested[nkey] as unknown[];
      }
    }
  }
  const single = asFile(rec);
  return single ? [rec] : [];
}

export function parseDriveFiles(data: unknown): DriveFile[] {
  return asArray(data)
    .map(asFile)
    .filter((f): f is DriveFile => f !== null);
}

export function parseDriveFile(data: unknown): DriveFile | null {
  return asFile(data) ?? parseDriveFiles(data)[0] ?? null;
}

export function parseDriveText(data: unknown): string | null {
  if (typeof data === "string") return data;
  const rec = asRecord(data);
  if (!rec) return null;
  for (const key of ["content", "text", "textContent", "text_content", "body", "data"]) {
    const value = rec[key];
    if (typeof value === "string") return value;
  }
  return null;
}

export function isDriveFolder(file: DriveFile): boolean {
  return (file.mimeType ?? "").includes("folder") || file.mimeType === "application/vnd.google-apps.folder";
}

export function looksLikeUnknownTool(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("unknown tool") ||
    m.includes("tool not found") ||
    m.includes("not found: google_drive") ||
    m.includes("does not exist") ||
    m.includes("unsupported tool") ||
    m.includes("invalid tool")
  );
}

export function looksLikeBadArgs(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("required") ||
    m.includes("invalid argument") ||
    m.includes("missing") ||
    m.includes("unexpected") ||
    m.includes("schema")
  );
}
