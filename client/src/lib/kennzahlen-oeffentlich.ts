// ═══════════════════════════════════════════════════════════════════════════
// Öffentliche Kennzahlen (03.09.2026, E-091) — eine Quelle für /transparenz und
// /fiaon-erfahrungen: GET /api/fiaon/oeffentlich/kennzahlen (TFO, 1 h Cache),
// Definition wie das Chefbüro (ECHT, bezahlt, nicht zusammengeführt).
// Die Stand-Werte sind der Rückfall, wenn der Endpunkt nicht antwortet —
// Stand 03.09.2026 laut Endpunkt: 440 Kunden, 440 Raten, DE 277 · AT 157 · CH 4.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export interface Kennzahlen { kunden: number; raten: number; laender: { DE: number; AT: number; CH: number; weitere: number }; werkzeuge: number; ratgeber: number; stand: string; veraltet?: boolean }
export const KENNZAHLEN_STAND: Kennzahlen = { kunden: 440, raten: 440, laender: { DE: 277, AT: 157, CH: 4, weitere: 5 }, werkzeuge: 20, ratgeber: 57, stand: "2026-09-03" };

let zwischenspeicher: Kennzahlen | null = null;
export function useKennzahlen(): Kennzahlen {
  const [k, setK] = useState<Kennzahlen>(zwischenspeicher ?? KENNZAHLEN_STAND);
  useEffect(() => {
    if (zwischenspeicher) return;
    fetch("/api/fiaon/oeffentlich/kennzahlen", { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !j.ok || typeof j.kunden !== "number") return;
        zwischenspeicher = { kunden: j.kunden, raten: j.raten, laender: j.laender ?? KENNZAHLEN_STAND.laender, werkzeuge: j.werkzeuge ?? KENNZAHLEN_STAND.werkzeuge, ratgeber: j.ratgeber ?? KENNZAHLEN_STAND.ratgeber, stand: j.stand ?? KENNZAHLEN_STAND.stand, veraltet: j.veraltet };
        setK(zwischenspeicher);
      })
      .catch(() => { /* Rückfall bleibt */ });
  }, []);
  return k;
}
