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

// ═══════════════════════════════════════════════════════════════════════════
// JAHRESVERTRAG ODER ALTVERTRAG — EINE RECHNUNG (E-265 Nachbesserung, 29.09.2026)
//
// Seit dem 03.09.2026 (agb_stand) laufen neue Verträge zwölf Monate (AGB § 6);
// ältere sind monatlich zum Monatsende kündbar (§ 6 Abs. 8 der alten Fassung).
// Davon hängt ab, ob Mara „aus Kulanz" sagen darf (nur beim Jahresvertrag —
// beim Altvertrag wäre es eine Irreführung über ein bestehendes Recht, § 5 UWG).
//
// Der Anlass: WhatsApp verglich `String(agb_stand) >= "2026-09-03"`. postgres.js
// liefert die Spalte (Typ date) aber als Date — String() ergibt „Sat Aug 15 2026
// …", und das ist als Text IMMER größer: Jeder ältere agb_stand hätte als
// Jahresvertrag gegolten (Gegenprobe wand.mts, Teil 5). Hier einmal, für Text
// und Date, über den Berliner Kalendertag.
// ═══════════════════════════════════════════════════════════════════════════
export const JAHRESVERTRAG_AB = "2026-09-03";

/** Der Kalendertag (YYYY-MM-DD, Berlin) eines agb_stand — Text oder Date. Ohne Angabe: null. Rein. */
export function agbTag(agbStand: unknown): string | null {
  if (agbStand == null || agbStand === "") return null;
  if (agbStand instanceof Date) {
    return Number.isNaN(agbStand.getTime()) ? null : agbStand.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  }
  const m = String(agbStand).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(String(agbStand));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

/** Vertrag ab dem 03.09.2026 = Jahresvertrag. Ohne agb_stand: Altvertrag (false). Rein. */
export function istJahresvertrag(agbStand: unknown): boolean {
  const t = agbTag(agbStand);
  return !!t && t >= JAHRESVERTRAG_AB;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ABRECHNUNGSMONAT — das Vertragsende beim Altvertrag (E-265 (01.10.2026), Paket Recht)
//
// Für Verträge vor dem 03.09.2026 gilt die AGB-Fassung vom 04.07.2026, § 6: Kündigung „mit einer Frist von
// 24 Stunden zum Ende des jeweiligen ABRECHNUNGSMONATS". Ein Abrechnungsmonat läuft von einer Fälligkeit bis zum
// Tag vor der nächsten (§ 5 „monatlich im Voraus") — also von Fälligkeitstag zu Fälligkeitstag, NICHT vom 1. bis
// zum Letzten des Kalendermonats (bis zum 01.10. rechnete der Bau mit dem Kalendermonat: monatsEnde).
//
// Die Regel: Der Zeitpunkt „Kündigungserklärung + 24 Stunden" liegt in genau einem Abrechnungsmonat. Dessen
// letzter Tag ist das Vertragsende; die Rate, die ihn eröffnet hat, ist die letzte geschuldete; alles, was später
// fällig wird, entfällt.
//   · Raten jeweils am 28.; Kündigung am 28.09. → 29.09. liegt im Abrechnungsmonat 28.09.–27.10. → die Rate vom
//     28.09. ist geschuldet, Vertragsende 27.10., die Rate vom 28.10. entfällt.
//   · Kündigung am 26.09. → 27.09. liegt noch im Abrechnungsmonat 28.08.–27.09. → Vertragsende 27.09., die Rate
//     vom 28.09. entfällt.
//   · Kündigung am Fälligkeitstag (12665): die Rate dieses Tages ist geschuldet (wie das erste Beispiel).
//
// Die Fälligkeitstage kommen aus der Ratenkette (jede Rate, auch bezahlte und stornierte — sie bezeugen den
// Rhythmus). Fehlt nach dem letzten bekannten Tag eine Fälligkeit, wird monatlich weitergezählt, so wie der
// Tageslauf die nächste Rate anlegt (Monatstag der letzten Rate; liegt sie gekappt auf dem Monatsletzten, bleibt
// der Tag der ersten Rate maßgeblich — 31.01. → 28.02. → 31.03.). Ohne Ratenkette zählt der Anker (Tag der ersten
// Zahlung bzw. der Bestellung) in Monatsschritten. Ohne beides bleibt als letzter Halt der Kalendermonat.
// Rein: keine Datenbank, keine Uhr. Der Jahresvertrag (ab 03.09.2026) hat kein solches Ende (istJahresvertrag).
// ═══════════════════════════════════════════════════════════════════════════
export type AbrechnungsmonatQuelle = "raten" | "anker" | "kalendermonat";
export interface Abrechnungsmonat {
  /** Erster Tag (die Fälligkeit, die ihn eröffnet) — YYYY-MM-DD, Berlin. */
  von: string;
  /** Letzter Tag = das Vertragsende — YYYY-MM-DD, Berlin. */
  bis: string;
  /** Der Tag, an dem die 24-Stunden-Frist abläuft (Kündigung + 24 h) — YYYY-MM-DD, Berlin. */
  wirkTag: string;
  quelle: AbrechnungsmonatQuelle;
}

/** YYYY-MM-DD (Berlin) eines Zeitpunkts; ein reiner Tag („2026-09-28") bleibt, wie er ist. Ungültig: null. */
export function berlinKalendertag(v: Date | string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}
function tagBauen(jahr: number, monat: number, tag: number): string {
  return `${String(jahr).padStart(4, "0")}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}
/** Derselbe Monatstag einen Monat später — im kürzeren Monat gekappt (31.01. + 1 = 28.02.). */
function plusEinMonat(tag: string, monatstag: number): string {
  const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7));
  const gesamt = j * 12 + (m - 1) + 1;
  const jahr = Math.floor(gesamt / 12), monat = (gesamt % 12) + 1;
  return tagBauen(jahr, monat, Math.min(monatstag, tageImMonat(jahr, monat)));
}
function tagMinusEins(tag: string): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
/**
 * Die nächste Fälligkeit nach `tag`, wenn keine bekannte folgt — wie der Tageslauf (naechsteRateAnlegen, E-175):
 * der Monatstag der letzten Rate; liegt sie gekappt auf dem Monatsletzten und der Anker nennt einen späteren Tag,
 * zählt der Anker (31.01. → 28.02. → 31.03.).
 */
function naechsteFaelligkeitNach(tag: string, ankerTag: number): string {
  const letzterTag = Number(tag.slice(8, 10));
  const amMonatsende = letzterTag === tageImMonat(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)));
  return plusEinMonat(tag, amMonatsende && ankerTag > letzterTag ? ankerTag : letzterTag);
}

/**
 * DER ABRECHNUNGSMONAT, in dem eine Kündigung wirksam wird (E-265 (01.10.2026), Paket Recht) — rein.
 * `kuendigungAm` ist der Zeitpunkt der Erklärung; `faelligkeiten` sind die Fälligkeitstage der Ratenkette (jede Rate,
 * beliebige Reihenfolge, null wird übergangen); `anker` ist der Tag der ersten Zahlung bzw. Bestellung (Rückfall ohne
 * Ratenkette); `fristStunden` ist die Frist aus § 6 (24).
 */
export function abrechnungsmonat(
  kuendigungAm: Date | string | number,
  faelligkeiten: readonly (Date | string | number | null | undefined)[],
  opt: { anker?: Date | string | number | null; fristStunden?: number } = {},
): Abrechnungsmonat {
  const erklaert = new Date(kuendigungAm);
  const basis = Number.isNaN(erklaert.getTime()) ? new Date() : erklaert;
  const wirkTag = berlinKalendertag(new Date(basis.getTime() + (opt.fristStunden ?? 24) * 3_600_000))!;
  const tage = Array.from(new Set(faelligkeiten.map(berlinKalendertag).filter((t): t is string => !!t))).sort();
  const ankerTag = berlinKalendertag(opt.anker ?? null);
  let starts: string[] = tage;
  let quelle: AbrechnungsmonatQuelle = "raten";
  if (!starts.length) {
    if (!ankerTag) {
      // Letzter Halt: der Kalendermonat, in dem die Frist abläuft (die Logik vor dem 01.10.2026).
      const j = Number(wirkTag.slice(0, 4)), m = Number(wirkTag.slice(5, 7));
      return { von: tagBauen(j, m, 1), bis: tagBauen(j, m, tageImMonat(j, m)), wirkTag, quelle: "kalendermonat" };
    }
    starts = [ankerTag];
    quelle = "anker";
  }
  // Der Monatstag des Ankers für die Kappungs-Ausnahme: die erste bekannte Fälligkeit (bzw. der Anker selbst).
  const ankerMonatstag = Number((ankerTag && ankerTag < starts[0] ? ankerTag : starts[0]).slice(8, 10));
  // Bis hinter den Wirktag weiterzählen, falls die Kette dort noch nicht angekommen ist.
  while (starts[starts.length - 1] <= wirkTag) starts = [...starts, naechsteFaelligkeitNach(starts[starts.length - 1], ankerMonatstag)];
  // Der Abrechnungsmonat, der den Wirktag enthält — vor der ersten Fälligkeit ist es der erste.
  let i = 0;
  for (let k = 0; k < starts.length; k++) if (starts[k] <= wirkTag) i = k;
  return { von: starts[i], bis: tagMinusEins(starts[i + 1]), wirkTag, quelle };
}

/** Das Vertragsende (letzter Tag des Abrechnungsmonats, YYYY-MM-DD) — die Kurzform von `abrechnungsmonat`. Rein. */
export function abrechnungsmonatEnde(
  kuendigungAm: Date | string | number,
  faelligkeiten: readonly (Date | string | number | null | undefined)[],
  opt: { anker?: Date | string | number | null; fristStunden?: number } = {},
): string {
  return abrechnungsmonat(kuendigungAm, faelligkeiten, opt).bis;
}

/** „27.10.2026" aus „2026-10-27" — so steht das Vertragsende beim Kunden. Rein. */
export function tagDeutsch(iso: string | null | undefined): string | null {
  return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : null;
}

/**
 * Der eine Kundensatz zum Vertragsende beim Altvertrag (E-265 (01.10.2026)): „… gilt zum Ende Ihres laufenden
 * Abrechnungsmonats, dem 27.10.2026". Ohne Datum (nicht berechenbar) ohne den Nebensatz. Rein.
 */
export function giltZumSatz(endeTag: string | null | undefined): string {
  const de = tagDeutsch(endeTag);
  return `gilt zum Ende Ihres laufenden Abrechnungsmonats${de ? `, dem ${de}` : ""}`;
}
