/**
 * Tolkar värden för en byggnadsnivå. Stöder intervall ("A-M", "1–5") och
 * kommaseparerade listor ("A, B, Gård"), även blandat.
 */
export function parseLevelValues(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\w+)\s*[-–]\s*(\w+)$/u);
    if (m) {
      const [, a, b] = m;
      if (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(b) >= Number(a) && Number(b) - Number(a) < 500) {
        for (let i = Number(a); i <= Number(b); i++) out.push(String(i));
        continue;
      }
      if (/^[A-Za-zÅÄÖåäö]$/.test(a) && /^[A-Za-zÅÄÖåäö]$/.test(b)) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
        const upper = a === a.toUpperCase();
        const ia = alphabet.indexOf(a.toUpperCase());
        const ib = alphabet.indexOf(b.toUpperCase());
        if (ia >= 0 && ib >= ia) {
          for (let i = ia; i <= ib; i++) out.push(upper ? alphabet[i] : alphabet[i].toLowerCase());
          continue;
        }
      }
    }
    out.push(part);
  }
  return [...new Set(out)];
}

export function formatLevelValues(values: string[]): string {
  return values.join(", ");
}
