export function isConnectorTokenReady() {
  return false;
}

export async function callTool() {
  return { ok: false as const, error: "Connectors are not in the Windows app." };
}
