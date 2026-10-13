/** A purchase charge, not a medicine lot. */
export function isInsuranceText(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return false;
  return n === "insurance" || n.startsWith("insurance ") || n.includes("insurance charge");
}

export function isInsuranceLine(line: { name?: string; kind?: string }): boolean {
  return line.kind === "insurance" || isInsuranceText(line.name ?? "");
}

export function isInsuranceProduct(product: { name: string; genericName?: string }): boolean {
  return isInsuranceText(product.name) || isInsuranceText(product.genericName ?? "");
}
