// ═══════════════════════════════════════════════════════════════════════════
// fiaon_applications.utm — EINE Erlaubnisliste (25.09.2026, E-242)
//
// Die Spalte heißt „utm", war aber vom 16.04. bis 06.09.2026 der Ablageort der
// Kundenpasswörter im Klartext (Commit 8518e421 „WORKAROUND: Store password in
// utm JSON field"). Über die JSONB-Falle landete das Objekt als JSON-TEXT in der
// Spalte (jsonb_typeof = string), ab 29.07. hängte „utm || …" weitere Texte an
// (→ Array). E-152 hat am 06.09. das Schreiben beendet und nur echte Objekte
// geputzt — Text und Array blieben liegen, und die Kundenakte im Agentenportal
// gab die Spalte ungefiltert als „herkunft" aus. Zahlen und Bewertung stehen im
// internen Entscheidungsregister (E-242), nicht im Quelltext.
//
// Seither gilt: In utm stehen NUR diese Schlüssel, immer als Objekt. Die
// Datenbank erzwingt dasselbe mit dem CHECK fiaon_applications_utm_erlaubt, den
// scripts/passwort-klartext-raus.ts aus GENAU dieser Liste baut (eine Quelle;
// Prüfstand scripts/pruef-utm-erlaubnisliste.ts). Kommt ein Schlüssel hinzu,
// muss der CHECK in der Datenbank neu angelegt werden — sonst lehnt sie ihn ab.
// ═══════════════════════════════════════════════════════════════════════════

export const UTM_SCHLUESSEL = [
  "utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term",
  "gclid", "fbclid", "landing", "ref",
] as const;

export type UtmSchluessel = (typeof UTM_SCHLUESSEL)[number];
export type UtmObjekt = Partial<Record<UtmSchluessel, string>>;

/** Als Parameter für `k = ANY(${UTM_SCHLUESSEL_LISTE}::text[])` in SQL-Schreibwegen. */
export const UTM_SCHLUESSEL_LISTE: string[] = [...UTM_SCHLUESSEL];

const MAX_LAENGE = 500;

/**
 * utm in JEDER historischen Form lesen — Objekt, JSON-Text (auch doppelt
 * verpackt), Array aus Texten und Objekten — und nur die erlaubten Schlüssel
 * zurückgeben. Alles andere (vor allem `password`) fällt weg.
 * Ergebnis: ein flaches Objekt oder null, wenn nichts Erlaubtes übrig bleibt.
 * Bei mehreren Schichten gewinnt die spätere (Arrays wuchsen durch Anhängen).
 */
export function utmErlaubt(roh: unknown): UtmObjekt | null {
  const aus: UtmObjekt = {};
  const lies = (wert: unknown, tiefe: number): void => {
    if (wert == null || tiefe > 4) return;
    if (typeof wert === "string") {
      const t = wert.trim();
      if (!/^[[{"]/.test(t)) return;
      try { lies(JSON.parse(t), tiefe + 1); } catch { /* kein JSON — kein utm */ }
      return;
    }
    if (Array.isArray(wert)) { for (const e of wert) lies(e, tiefe + 1); return; }
    if (typeof wert !== "object") return;
    for (const k of UTM_SCHLUESSEL) {
      const w = (wert as Record<string, unknown>)[k];
      if (typeof w !== "string" && typeof w !== "number") continue;
      const s = String(w).trim().slice(0, MAX_LAENGE);
      if (s) aus[k] = s;
    }
  };
  lies(roh, 0);
  return Object.keys(aus).length > 0 ? aus : null;
}
