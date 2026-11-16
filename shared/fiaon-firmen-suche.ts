// ═══════════════════════════════════════════════════════════════════════════
// DIE SUCHE IM FIRMEN-COCKPIT (E-516, 16.11.2026) — reine Regeln, ohne DB
//
// ── DER ANLASS ──────────────────────────────────────────────────────────────
// Florentine (16.11.): „Aktuell funktioniert die Suche allerdings nur über
// Nummern. Wenn ich beispielsweise einen Ansprechpartner oder Firmennamen
// eingebe, wird dieser nicht gefunden."
//
// ── DIE URSACHE ─────────────────────────────────────────────────────────────
// Die Liste prüfte die Telefonnummer mit
//   regexp_replace(telefon, '[^0-9]', '') LIKE '%' || regexp_replace(q, '[^0-9]', '') || '%'
// Bei „Muster" bleibt von q keine Ziffer übrig → LIKE '%%' → JEDE Zeile
// passt. Die Namenssuche filterte also nichts, die Liste blieb wie sie war.
// Dazu suchte sie nur im offenen Reiter („Jetzt dran").
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// · Die Nummer zählt erst ab DREI Ziffern (darunter trifft sie zu vieles).
// · Führende Nullen fallen weg: „0152 …" findet „+49 152 …", „0041 …" findet „+41 …".
// · Wer etwas eintippt, sucht in ALLEN Firmen — der Reiter gilt nur ohne Suche.
// · Platzhalter im Suchtext (% und _) werden entschärft: „50%" sucht „50%".
// ═══════════════════════════════════════════════════════════════════════════

export const FIRMEN_SUCHE_MIN_ZIFFERN = 3;
export const FIRMEN_SUCHE_MAX_LAENGE = 80;

export interface FirmenSuche {
  /** Der Text für ILIKE — getrimmt, gekürzt, mit entschärften Platzhaltern ('' = keine Suche). */
  text: string;
  /** Nur die Ziffern — '' wenn weniger als drei (dann wird die Nummer NICHT geprüft). */
  ziffern: string;
  /** true = es wird gesucht → in allen Firmen, unabhängig vom Reiter. */
  aktiv: boolean;
}

/** Entschärft die LIKE-Platzhalter (\, %, _) — Postgres nimmt den Backslash als Standard-Escape. */
export function likeEntschaerfen(s: string): string {
  return s.replace(/[\\%_]/g, (z) => `\\${z}`);
}

export function firmenSucheLesen(roh: unknown): FirmenSuche {
  const t = String(roh ?? "").replace(/\s+/g, " ").trim().slice(0, FIRMEN_SUCHE_MAX_LAENGE);
  if (!t) return { text: "", ziffern: "", aktiv: false };
  const ziffern = t.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return {
    text: likeEntschaerfen(t),
    ziffern: ziffern.length >= FIRMEN_SUCHE_MIN_ZIFFERN ? ziffern : "",
    aktiv: true,
  };
}

// ── DER ECHTE NAME UNTER DER KARTE ──────────────────────────────────────────
// Karten aus Anfragen heißen manchmal „Privatperson · Name", „GmbH",
// „Selbständig" oder „Mehrere" (die Antwort im Formular). Den echten Namen
// kennt oft die Lead-Mappe (fiaon_lead_dossier, basis.firma.anzeige). Die Liste
// zeigt ihn klein darunter — aber nur, wenn er wirklich etwas Neues sagt.
export function zweiterName(karte: unknown, mappe: unknown): string | null {
  const k = String(karte ?? "").trim().toLowerCase();
  const m = String(mappe ?? "").trim();
  if (!m) return null;
  const ml = m.toLowerCase();
  if (ml === k) return null;
  // Steht der Name schon vollständig auf der Karte („Privatperson · Erika Beispiel" ↔ „Erika Beispiel"), sagt er nichts Neues.
  if (k.includes(ml)) return null;
  return m.slice(0, 120);
}
