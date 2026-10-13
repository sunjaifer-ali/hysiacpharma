const unavailable = {
  ok: false as const,
  error: "Google Drive is not in the Windows app. Use Settings → Export JSON.",
};

export async function uploadDriveBackup(_args?: unknown) {
  return unavailable;
}

export async function listDriveBackups(_args?: unknown) {
  return { ...unavailable, files: [] as { id: string; name: string }[], folderId: null, folderName: null };
}

export async function readDriveBackup(_args?: unknown) {
  return { ...unavailable, json: null };
}
