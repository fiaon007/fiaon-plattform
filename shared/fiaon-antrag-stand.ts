// ═══════════════════════════════════════════════════════════════════════════
// „ANTRAG ABGESCHICKT" — EINE REGEL FÜR SERVER, SQL UND OBERFLÄCHE
// (29.09.2026, E-264)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// 29.09.2026, 11:29–11:32: Die Automatik schickte einem Menschen korrekt die
// Abbrecher-Vorlage („Sie waren fast durch"). Er schrieb zurück: „Hab nix
// beantragt" mit fünf wütenden Emojis. Mara antwortete 22 Sekunden später:
// „Sehr gern — nach der Zahlung ist Ihr Account aktiv … Ihre Zahlungsseite …".
// Justin: „les dir mal durch was MARA fürn Kack macht".
//
// Sein einziger Antrag: status 'approved', Schritt 5, payment_status
// 'pending_payment', submitted_at leer. Der Antragsweg setzt die
// Zufalls-„Genehmigung" (status approved + Bestellung pending_payment) schon
// bei Schritt 3–5 — lange bevor der Mensch den Vertrag sieht und
// „zahlungspflichtig annehmen" klickt (E-244, Schritt 8). Gemessen (nur
// lesend, 29.09.): ALLE 90 Anträge mit approved + pending_payment stehen vor
// Schritt 8; mit finances/verifying/processing sind es 99. E-248 hatte
// pending_payment als „Antrag fertig, Zahlung offen" gewertet — seitdem bekamen
// solche Menschen Zahlungsseiten (WhatsApp und Mara-Aktion per Mail).
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Abgeschickt ist ein Antrag, wenn
//   · Schritt 8 erreicht ist (current_step >= 8), ODER
//   · submitted_at gesetzt ist, ODER
//   · sein Status außerhalb des Antragswegs liegt (nicht in ANTRAG_UNFERTIG —
//     submitted, completed, payment_pending, pending_payment, documents_submitted,
//     payment_completed …).
// Das ist die Hausregel aus dem Wiedereinstieg (fiaon-antrag.ts, E-210) und der
// WA-Zentrale (fiaon-wa-zentrale.ts, abgeschickt()) — hier EINMAL, dazu
// submitted_at (gemessen 29.09.: kein Antrag, bei dem das allein den Ausschlag
// gibt; es gehört trotzdem dazu).
//
// NICHT maßgeblich: payment_status und payment_reference. Ein Trigger füllt den
// Verwendungszweck schon beim ersten Speichern (08.08.2026), und pending_payment
// setzt der Antragsweg vor dem Vertrag. Stufe B („Antrag fertig, nicht bezahlt")
// heißt abgeschickt — nie „hat eine Bestellung pending_payment".
//
// Rein, ohne Datenbank: Server (Mara auf WhatsApp, Postmeister, Mara-Aktion,
// Lead-Kette, WhatsApp-Raum) und Oberfläche lesen dieselbe Datei.
//
// OFFEN (Entscheidung Justin, Gegenlesen E-264): Die Betreuer-Anlage
// (routes/fiaon-agent-anlage.ts) legt Bestellungen mit status 'payment_pending',
// Schritt 5 und pending_payment an — ohne „zahlungspflichtig annehmen", ohne
// consent_contract (gemessen 29.09.: 44 solche Bestellungen). Nach dieser Regel
// sind sie abgeschickt (B): Zahlungsseite, Mara-Aktion und Mahnkette laufen.
// Ob eine Betreuer-Anlage ohne Zustimmung des Kunden B ist, entscheidet Justin;
// bis dahin bleibt die Regel, wie sie ist. Bestreitet so ein Mensch („Für was
// muss ich zahlen, ich weiß nix", „keine Kredit gemacht"), erkennt Mara das
// (abstreitenArt: rueckfrage/bestreitet) und schickt keine Zahlungsseite.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Status des Antragswegs VOR dem Abschicken (Reihenfolge wie im Formular). */
export const ANTRAG_UNFERTIG = ["started", "personal_data", "finances", "config", "verifying", "approved", "contract", "processing"] as const;

/** Dieselbe Liste als SQL-Klammer — für `status NOT IN …`. */
export const ANTRAG_UNFERTIG_SQL = `(${ANTRAG_UNFERTIG.map((s) => `'${s}'`).join(", ")})`;

export interface AntragStand {
  current_step?: number | string | null;
  status?: string | null;
  submitted_at?: unknown;
}

/**
 * Ist dieser Antrag abgeschickt? Rein. Ohne Antrag: false.
 * Dieselbe Regel wie abgeschicktSql() — der Prüfstand hält beide nebeneinander.
 */
export function antragAbgeschickt(a: AntragStand | null | undefined): boolean {
  if (!a) return false;
  if (Number(a.current_step ?? 0) >= 8) return true;
  if (a.submitted_at != null && String(a.submitted_at) !== "") return true;
  return !(ANTRAG_UNFERTIG as readonly string[]).includes(String(a.status ?? ""));
}

/**
 * Dieselbe Regel als SQL-Bedingung für die Tabelle `t` (fiaon_applications);
 * ohne Alias (`""`) für Abfragen ohne Tabellennamen.
 * Beispiel: `AND ${abgeschicktSql("a")}` bzw. `AND NOT ${abgeschicktSql("a")}`.
 */
export function abgeschicktSql(t = "a"): string {
  const p = t ? `${t}.` : "";
  return `(COALESCE(${p}current_step, 0) >= 8 OR ${p}submitted_at IS NOT NULL OR COALESCE(${p}status, '') NOT IN ${ANTRAG_UNFERTIG_SQL})`;
}
