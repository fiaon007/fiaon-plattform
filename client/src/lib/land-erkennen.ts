// Woher kommt der Besucher? Server (IP) zuerst, dann Sprache und Zeitzone des
// Geräts. Ergebnis ist ein VORSCHLAG für Land, Vorwahl und Mail-Endungen —
// nie eine Entscheidung über den Kopf des Kunden hinweg.
export type Land = "DE" | "AT" | "CH" | string;
const KEY = "fiaon_land";

export const VORWAHL: Record<string, string> = { DE: "+49", AT: "+43", CH: "+41", LI: "+423", LU: "+352", IT: "+39", FR: "+33", NL: "+31", BE: "+32", PL: "+48" };
export const LANDNAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", LI: "Liechtenstein", LU: "Luxemburg" };

function ausGeraet(): Land | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Europe/Vienna") return "AT";
    if (tz === "Europe/Zurich") return "CH";
    if (tz === "Europe/Vaduz") return "LI";
    const sprache = (navigator.language || "").toUpperCase();
    const m = sprache.match(/-([A-Z]{2})$/);
    if (m) return m[1];
    if (tz === "Europe/Berlin") return "DE";
  } catch { /* kein Fenster */ }
  return null;
}

export async function landErkennen(): Promise<Land | null> {
  try { const g = sessionStorage.getItem(KEY); if (g) return g; } catch { /* egal */ }
  let land: Land | null = null;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch("/api/fiaon/geo", { signal: ctrl.signal }); clearTimeout(t);
    const j = await r.json().catch(() => null);
    if (j?.ok && j.land) land = String(j.land);
  } catch { /* offline oder langsam — dann das Gerät */ }
  if (!land) land = ausGeraet();
  try { if (land) sessionStorage.setItem(KEY, land); } catch { /* egal */ }
  return land;
}
