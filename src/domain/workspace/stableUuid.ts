/** Deterministic UUID v4-shaped id from a seed (stable dual-write keys). */
export function stableUuidFromSeed(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const parts: string[] = [];
  let x = h >>> 0;
  for (let i = 0; i < 4; i++) {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    parts.push(x.toString(16).padStart(8, "0"));
  }
  const hex = parts.join("").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
