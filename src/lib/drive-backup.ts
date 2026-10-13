import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  classifyCallToolError,
  isConnectorPending,
  isLoginRequired,
  type CallToolErrorKind,
} from "@/lib/app-data";
import { BACKUP_FOLDER_NAME } from "./backup";
import {
  isDriveFolder,
  looksLikeBadArgs,
  looksLikeUnknownTool,
  parseDriveFile,
  parseDriveFiles,
  parseDriveText,
  type DriveFile,
} from "./drive-shape";

export type DriveBackupResult = {
  ok: boolean;
  pending?: boolean;
  loginRequired?: boolean;
  loginUrl?: string;
  error?: string;
  errorKind?: CallToolErrorKind;
  fileId?: string;
  fileName?: string;
  folderId?: string;
  folderName?: string;
};

export type DriveBackupListItem = {
  id: string;
  name: string;
};

type ToolCall = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  data: unknown;
  errorMessage?: string;
  loginRequired?: boolean;
  loginUrl?: string;
  pending?: boolean;
}>;

function failFrom(result: {
  ok: boolean;
  errorMessage?: string;
  loginRequired?: boolean;
  loginUrl?: string;
  pending?: boolean;
}): DriveBackupResult {
  const classified = classifyCallToolError({
    ok: false,
    data: null,
    errorMessage: result.errorMessage,
    loginRequired: result.loginRequired,
    loginUrl: result.loginUrl,
    pending: result.pending,
  });
  return {
    ok: false,
    pending: isConnectorPending({
      ok: false,
      data: null,
      pending: result.pending,
      loginRequired: result.loginRequired,
      errorMessage: result.errorMessage,
    }),
    loginRequired: isLoginRequired({
      ok: false,
      data: null,
      loginRequired: result.loginRequired,
      loginUrl: result.loginUrl,
      errorMessage: result.errorMessage,
    }),
    loginUrl: result.loginUrl,
    error: classified?.message ?? result.errorMessage ?? "Google Drive backup failed",
    errorKind: classified?.kind,
  };
}

async function callDrive(toolName: string, args: Record<string, unknown>) {
  const { callTool, ConnectorType } = await import("@/lib/app-data/client.server");
  return callTool(toolName, args, { connectorType: ConnectorType.GoogleDrive });
}

async function ensureBackupFolder(
  call: ToolCall,
  knownId?: string | null,
): Promise<{ folder: DriveFile } | DriveBackupResult> {
  if (knownId) {
    return { folder: { id: knownId, name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" } };
  }

  const search = await call("google_drive_search", { q: BACKUP_FOLDER_NAME });
  if (!search.ok) return failFrom(search);
  const found = parseDriveFiles(search.data).find(
    (f) => isDriveFolder(f) && f.name.toLowerCase() === BACKUP_FOLDER_NAME.toLowerCase(),
  );
  if (found) return { folder: found };

  const created = await call("google_drive_create_folder", { name: BACKUP_FOLDER_NAME });
  if (!created.ok) return failFrom(created);
  const folder = parseDriveFile(created.data);
  if (!folder) {
    return { ok: false, error: "Could not create the Hysiac GST Backups folder on Google Drive." };
  }
  return { folder };
}

const WRITE_TOOLS = ["google_drive_create_file", "google_drive_upload_file", "google_drive_write_file"] as const;

function writeArgSets(fileName: string, json: string, parentId: string): Record<string, unknown>[] {
  return [
    { name: fileName, content: json, mimeType: "application/json", parentId },
    { title: fileName, textContent: json, mimeType: "application/json", parentId },
    { name: fileName, text: json, mimeType: "application/json", folderId: parentId },
  ];
}

async function writeDriveFile(call: ToolCall, fileName: string, json: string, parentId: string) {
  let last: Awaited<ReturnType<ToolCall>> | null = null;
  for (const tool of WRITE_TOOLS) {
    let unknown = false;
    for (const args of writeArgSets(fileName, json, parentId)) {
      const result = await call(tool, args);
      last = result;
      if (result.ok) return result;
      if (result.loginRequired || result.pending) return result;
      const msg = result.errorMessage ?? "";
      const classified = classifyCallToolError({
        ok: false,
        data: null,
        errorMessage: msg,
        loginRequired: result.loginRequired,
        pending: result.pending,
      });
      if (classified?.kind === "not_connected" || classified?.kind === "scope_denied" || classified?.kind === "login") {
        return result;
      }
      if (looksLikeUnknownTool(msg)) {
        unknown = true;
        break;
      }
      if (!looksLikeBadArgs(msg)) return result;
    }
    if (unknown) continue;
  }
  return (
    last ?? {
      ok: false as const,
      data: null,
      errorMessage: "Google Drive cannot receive files from this app window.",
    }
  );
}

export const uploadDriveBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { json: string; fileName: string; folderId?: string | null }) => {
    if (!data || typeof data.json !== "string" || typeof data.fileName !== "string") {
      throw new Error("Missing backup");
    }
    if (data.json.length > 8_000_000) throw new Error("Backup is too large to send to Drive");
    return {
      json: data.json,
      fileName: data.fileName,
      folderId: data.folderId ?? null,
    };
  })
  .handler(async ({ data }): Promise<DriveBackupResult> => {
    const call: ToolCall = callDrive;
    const folderRes = await ensureBackupFolder(call, data.folderId);
    if ("ok" in folderRes && folderRes.ok === false) return folderRes;
    const folder = "folder" in folderRes ? folderRes.folder : null;
    if (!folder) return { ok: false, error: "Could not open the backup folder on Google Drive." };

    const written = await writeDriveFile(call, data.fileName, data.json, folder.id);
    if (!written.ok) return failFrom(written);
    const file = parseDriveFile(written.data);
    return {
      ok: true,
      fileId: file?.id,
      fileName: file?.name || data.fileName,
      folderId: folder.id,
      folderName: folder.name || BACKUP_FOLDER_NAME,
    };
  });

export const listDriveBackups = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { folderId?: string | null } | undefined) => ({
    folderId: data?.folderId ?? null,
  }))
  .handler(async ({ data }): Promise<DriveBackupResult & { files?: DriveBackupListItem[] }> => {
    const call: ToolCall = callDrive;
    const folderRes = await ensureBackupFolder(call, data.folderId);
    if ("ok" in folderRes && folderRes.ok === false) return folderRes;
    const folder = "folder" in folderRes ? folderRes.folder : null;
    if (!folder) return { ok: false, error: "Could not open the backup folder on Google Drive." };

    const listed = await call("google_drive_list_folder", { folderId: folder.id, id: folder.id });
    if (!listed.ok) return failFrom(listed);
    const files = parseDriveFiles(listed.data)
      .filter((f) => f.name.toLowerCase().endsWith(".json") && f.name.toLowerCase().startsWith("hysiac-gst"))
      .map((f) => ({ id: f.id, name: f.name }));
    return { ok: true, folderId: folder.id, folderName: folder.name || BACKUP_FOLDER_NAME, files };
  });

export const readDriveBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { fileId: string }) => {
    if (!data?.fileId) throw new Error("Missing file");
    return { fileId: data.fileId };
  })
  .handler(async ({ data }): Promise<DriveBackupResult & { json?: string }> => {
    const call: ToolCall = callDrive;
    const read = await call("google_drive_read_file", { fileId: data.fileId, id: data.fileId });
    if (!read.ok) return failFrom(read);
    const text = parseDriveText(read.data);
    if (!text) return { ok: false, error: "That Drive file could not be read as a Hysiac backup." };
    return { ok: true, json: text, fileId: data.fileId };
  });
