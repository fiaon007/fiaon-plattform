// ═══════════════════════════════════════════════════════════════════════════
// DER JAHRESVERTRAG NACH DER KÜNDIGUNG — ZWÖLF MONATE, KULANZ NUR NACH ZAHLUNG (19.10.2026, E-396)
//
// Justin, 19.10.2026, wörtlich: „JEDER Kunde, der bei uns einen Antrag akzeptiert, Vertrag akzeptiert hat, egal ob
// vorher durch Klick oder jetzt durch Unterschrift, hat mit uns einen 12 Monats VERTRAG, AUSSER die Kunden, die wir
// aus Kulanz kündigen. Die Kunden müssen dann noch die letzte offene Rechnung einbezahlen; sobald sie das getan haben
// = gekündigt. Auch MARA muss das wissen, und das ganz genau!“
//
// DER BEFUND: Die Kündigung beendete einen Jahresvertrag SOFORT — 6 von 6 gekündigten Jahresverträgen trugen
// „Kündigung (Kulanz, sofort)“ (alle über das Telefon, Häkchen „Kulanz: sofort beenden“), ohne Bestätigungsmail.
// Ein Jahresvertrag brachte so im Schnitt 1,4–1,5 von 12 Raten (Messung 19.10.).
//
// DAS RECHT (Prüfung 19.10.2026, Akte 02_Finanzen/2026-10-19_Liquiditaet-Recherche, Themen 5a–6):
//   · Jahresvertrag (agb_stand ab 03.09.2026, AGB § 6 Abs. 1/2): Die ordentliche Kündigung wirkt mit einer Frist von
//     einem Monat zum Ende der zwölf Monate; danach läuft er unbefristet und ist mit einem Monat Frist kündbar. Die
//     Vergütung der Erstlaufzeit ist eine Gesamtvergütung in zwölf Raten (§ 5 Abs. 2) — die Raten laufen weiter.
//   · Vorzeitig raus kommt er nur aus Kulanz (AGB § 6 Abs. 4, Aufhebungsvertrag): Die darf an die Zahlung der
//     offenen, schon gestellten Rechnung geknüpft werden — mit dem Satz, dass seine gesetzlichen Rechte bleiben.
//   · Die Kündigung selbst wird sofort gebucht und mit dem Enddatum bestätigt; sie hängt nie an einer Zahlung (E-393).
//   · Altvertrag (vor dem 03.09.2026): NICHTS hiervon — monatlich kündbar, die Kündigung wirkt mit Zugang (E-393/E-394).
//   · Widerruf (14 Tage), Kündigung aus wichtigem Grund und der Kündigungsknopf (§ 312k) bleiben immer unberührt.
//
// DER NACHWEIS: Die volle Zwölf-Monats-Wirkung nur, wo die Annahme belegt ist — der neue Antrag (/antrag-neu) mit
// Vertrags-PDF oder der alte Weg mit dem Knopf „Zahlungspflichtig annehmen“ (consent_contract). Ohne jede Annahme
// (gemessen 19.10.: 8 aktive) bleibt das bisherige Verhalten, und die Leitung entscheidet über eine Karte.
//
// Diese Datei ist rein (keine Datenbank, keine Uhr) — dieselben Regeln für Server, Mara (Mail und WhatsApp),
// Kundenbereich und Prüfstand. Die SQL-Bausteine sind Text.
// ═══════════════════════════════════════════════════════════════════════════

/** Zwölf Monate Erstlaufzeit (AGB § 6 Abs. 1). */
export const ERSTLAUFZEIT_MONATE = 12;
/** Die Raten der Erstlaufzeit (AGB § 5 Abs. 2) — dieselbe Zahl wie ABO_LAUFZEIT_RATEN im Abo-Motor. */
export const ERSTLAUFZEIT_RATEN = 12;
/** Gesetzliche Widerrufsfrist — in ihr bleibt die Kündigung beim bisherigen Weg (der Widerruf bleibt unberührt). */
export const WIDERRUFSFRIST_TAGE = 14;

/** Die Art der Kündigung (fiaon_applications.kuendigung_art). */
export type KuendigungArt =
  /** Jahresvertrag, ordentlich gekündigt: läuft bis zum Laufzeitende, Kulanz-Angebot steht. */
  | "laufzeit"
  /** Jahresvertrag, aus Kulanz vorzeitig beendet — nach Zahlung der offenen Rechnung. */
  | "kulanz"
  /** Sofort beendet wegen Widerruf oder wichtigem Grund (Leitung, mit Grund). */
  | "sofort_recht";

/** Der eine Satz, der in jedes Kulanz-Angebot gehört (Rechtsprüfung 19.10.2026, Thema 6). */
export const RECHTE_SATZ = "Ihr gesetzliches Widerrufs- und Kündigungsrecht bleibt unberührt.";

// ── Kalender (Berliner Kalendertage als JJJJ-MM-TT) ─────────────────────────
function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}
const IST_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Derselbe Monatstag n Monate später (oder früher) — im kürzeren Monat gekappt (31.01. + 1 = 28.02.). Rein. */
export function plusMonate(tag: string, n: number): string {
  const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)), d = Number(tag.slice(8, 10));
  const gesamt = j * 12 + (m - 1) + n;
  const jahr = Math.floor(gesamt / 12), monat = (gesamt % 12 + 12) % 12 + 1;
  return `${String(jahr).padStart(4, "0")}-${String(monat).padStart(2, "0")}-${String(Math.min(d, tageImMonat(jahr, monat))).padStart(2, "0")}`;
}
/** Der Kalendertag davor. Rein. */
export function tagDavor(tag: string): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
/** n Tage später. Rein. */
export function plusTage(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** „27.10.2026“ aus „2026-10-27“. Rein. */
export function tagDe(tag: string | null | undefined): string | null {
  return tag && IST_TAG.test(tag.slice(0, 10)) ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}` : null;
}

/**
 * Das Ende der Erstlaufzeit: zwölf Monate ab Vertragsschluss, der Tag vor dem Jahrestag (Beginn 06.10.2026 → Ende
 * 05.10.2027) — dieselbe Zählweise wie der Abrechnungsmonat (Fälligkeit bis zum Tag vor der nächsten). Rein.
 */
export function erstlaufzeitEnde(beginn: string): string {
  return tagDavor(plusMonate(beginn, ERSTLAUFZEIT_MONATE));
}

/**
 * DAS VERTRAGSENDE NACH EINER ORDENTLICHEN KÜNDIGUNG (AGB § 6 Abs. 2). `beginn` = Tag des Vertragsschlusses,
 * `zugang` = Tag, an dem die Kündigung einging (beides JJJJ-MM-TT, Berlin).
 *   · Die Monatsfrist reicht bis zum Ende der Erstlaufzeit (Zugang + 1 Monat ≤ Ende) → Ende der Erstlaufzeit.
 *   · Sonst (im letzten Monat oder danach): Der Vertrag ist unbefristet weitergelaufen und endet einen Monat nach
 *     dem Zugang (Zugang 15.08. → 15.09.).
 * Rein.
 */
export function jahresvertragEnde(opt: { beginn: string; zugang: string }): { erstEnde: string; ende: string; fristgerecht: boolean } {
  const erstEnde = erstlaufzeitEnde(opt.beginn);
  const fristEnde = plusMonate(opt.zugang, 1);
  const fristgerecht = fristEnde <= erstEnde;
  return { erstEnde, ende: fristgerecht ? erstEnde : fristEnde, fristgerecht };
}

/** Liegt der Zugang der Kündigung in den ersten 14 Tagen nach Vertragsschluss? Dann bleibt der bisherige Weg. Rein. */
export function imWiderrufsfenster(beginn: string, zugang: string): boolean {
  return zugang <= plusTage(beginn, WIDERRUFSFRIST_TAGE);
}

/** Was der Weg bei einer Kündigung braucht (aus der Bestellung und den Optionen des Aufrufers). */
export interface LaufzeitLage {
  jahresvertrag: boolean;
  bezahlt: boolean;
  /** Annahme belegt: Vertrags-PDF (/antrag-neu) oder Knopf (consent_contract). */
  annahmeBelegt: boolean;
  /** Tag des Vertragsschlusses (JJJJ-MM-TT) — null, wenn nicht bestimmbar. */
  beginn: string | null;
  /** Tag des Zugangs der Kündigung (JJJJ-MM-TT). */
  zugang: string;
  /** Der Kunde erwähnt einen Widerruf — dann entscheidet wie bisher die Leitung (nicht die Wirkung des Widerrufs selbst). */
  widerrufErwaehnt?: boolean;
}

/**
 * Welcher Weg gilt? „laufzeit“ = Jahresvertrag läuft bis zum Laufzeitende, Kulanz-Angebot; „bisher“ = der Weg vor
 * E-396 (Altvertrag, Jahresvertrag ohne Annahme, Widerruf, Kündigung in den ersten 14 Tagen). `warum` steht im
 * Verlauf, wenn ein Jahresvertrag den bisherigen Weg nimmt. Rein.
 */
export function kuendigungsWeg(l: LaufzeitLage): { weg: "laufzeit" | "bisher"; warum: string | null } {
  if (!l.jahresvertrag) return { weg: "bisher", warum: null };
  if (!l.bezahlt) return { weg: "bisher", warum: null };
  if (!l.annahmeBelegt) return { weg: "bisher", warum: "Jahresvertrag ohne belegte Annahme (kein Vertrags-PDF, kein Knopf) — bisheriger Weg, die Leitung entscheidet (Karte)." };
  if (!l.beginn) return { weg: "bisher", warum: "Vertragsschluss nicht bestimmbar — bisheriger Weg." };
  if (l.widerrufErwaehnt) return { weg: "bisher", warum: "Der Kunde spricht von Widerruf — der Widerruf bleibt unberührt, die Leitung entscheidet." };
  if (imWiderrufsfenster(l.beginn, l.zugang)) return { weg: "bisher", warum: `Kündigung in den ersten ${WIDERRUFSFRIST_TAGE} Tagen nach Vertragsschluss — der Widerruf bleibt unberührt, bisheriger Weg.` };
  return { weg: "laufzeit", warum: null };
}

/** Eine offene Rate, wie die Kulanz-Rechnung sie braucht. */
export interface KulanzRate {
  nr: number;
  cents: number;
  /** JJJJ-MM-TT oder null. */
  faellig: string | null;
  referenz?: string | null;
}

/**
 * DIE KULANZ-RECHNUNG: alle offenen, schon gestellten Raten zum Zeitpunkt der Kündigung (AGB § 6 Abs. 4: „sämtliche …
 * fälligen oder in Rechnung gestellten Raten“). Sind sie bezahlt, endet der Vertrag aus Kulanz. null ohne offene Rate
 * (dann legt der Server die nächste Rate an, bevor er das Angebot macht). Rein.
 */
export function kulanzRechnung(offene: readonly KulanzRate[]): { raten: KulanzRate[]; summeCents: number; bisNr: number } | null {
  const raten = offene.filter((r) => Number(r.cents) > 0).sort((a, b) => a.nr - b.nr);
  if (!raten.length) return null;
  return { raten, summeCents: raten.reduce((s, r) => s + Number(r.cents), 0), bisNr: Math.max(...raten.map((r) => r.nr)) };
}

/**
 * Die letzte geschuldete Rate nach einer ordentlichen Kündigung: fristgerecht zum Ende der Erstlaufzeit sind es alle
 * zwölf (Gesamtvergütung, § 5 Abs. 2); nach einer Verlängerung zusätzlich jede Rate, die bis zum Ende fällig ist.
 * Nie weniger als die höchste schon bezahlte. Rein.
 */
export function letzteGeschuldeteRate(opt: { fristgerecht: boolean; ende: string; kette: readonly { nr: number; faellig: string | null; bezahlt?: boolean }[] }): number {
  const bezahltBis = opt.kette.filter((r) => r.bezahlt).reduce((m, r) => Math.max(m, r.nr), 0);
  if (opt.fristgerecht) return Math.max(ERSTLAUFZEIT_RATEN, bezahltBis);
  const bisEnde = opt.kette.filter((r) => r.faellig && r.faellig <= opt.ende).reduce((m, r) => Math.max(m, r.nr), 0);
  return Math.max(ERSTLAUFZEIT_RATEN, bisEnde, bezahltBis);
}

/** „59,99 €“ aus Cent. */
export function euro(cents: number): string {
  return `${(Number(cents) / 100).toFixed(2).replace(".", ",")} €`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE FASSUNG — für Bestätigungsmail, Mail-Mara, WhatsApp-Mara, Kundenbereich und Hauswissen.
// Vorher gab es drei leicht verschiedene: „ab der Kündigung keine Raten mehr“ (Hauswissen), „wirksam, sobald die
// gestellte Rate bezahlt ist“ (Dossier, Werkzeug) und „Bitte begleichen Sie …, dann lasse ich Sie aus Kulanz gerne
// aus dem Vertrag“ (Mara) — und keine nannte das Laufzeitende (Analyse intern_mara-widmer.md, Abschnitt 3).
// ═══════════════════════════════════════════════════════════════════════════

/** „Ihr Vertrag hat eine feste Laufzeit von zwölf Monaten und endet deshalb zum 05.10.2027.“ */
export function laufzeitSatz(endeTag: string | null, opt: { fristgerecht?: boolean } = {}): string {
  const de = tagDe(endeTag);
  if (opt.fristgerecht === false) return `Ihr Vertrag läuft nach den zwölf Monaten unbefristet und endet mit einem Monat Frist${de ? ` zum ${de}` : ""}.`;
  return `Ihr Vertrag hat eine feste Laufzeit von zwölf Monaten und endet deshalb${de ? ` zum ${de}` : " zum Ende der zwölf Monate"}.`;
}

/**
 * DER KULANZ-SATZ — wörtlich überall gleich: „Wenn Sie die offene Rechnung über 59,99 € bezahlen, entlassen wir Sie
 * aus Kulanz vorzeitig aus dem Vertrag — dann endet er mit dem Zahlungseingang, und es kommen keine weiteren Raten.“
 * `betrag` fertig formatiert („59,99 €“); bei mehreren Raten „die offenen Rechnungen über zusammen 119,98 €“.
 */
export function kulanzSatz(betrag: string, opt: { mehrere?: boolean } = {}): string {
  const was = opt.mehrere ? `die offenen Rechnungen über zusammen ${betrag}` : `die offene Rechnung über ${betrag}`;
  return `Wenn Sie ${was} bezahlen, entlassen wir Sie aus Kulanz vorzeitig aus dem Vertrag — dann endet er mit dem Zahlungseingang, und es kommen keine weiteren Raten.`;
}

/** Kulanz-Satz + Rechte-Satz aus der Kulanz-Rechnung. Rein. */
export function kulanzAngebot(r: { summeCents: number; raten: readonly unknown[] }): string {
  return `${kulanzSatz(euro(r.summeCents), { mehrere: r.raten.length > 1 })} ${RECHTE_SATZ}`;
}

/**
 * Die Regel für Mara (Mail und WhatsApp) — EIN Text an allen Stellen des Auftrags, damit sie es „ganz genau“ weiß.
 * Ohne Kundendaten; die Daten (Ende, offene Rechnung) stehen in der Akte bzw. kommen aus dem Werkzeug.
 */
export const MARA_JAHRESVERTRAG_REGEL =
  "JAHRESVERTRAG (Vertrag ab dem 03.09.2026, AGB § 6): Zwölf Monate Mindestlaufzeit; für jeden Monat der Mindestlaufzeit ist das Monatsentgelt geschuldet (AGB-Fassung ab 19.10.2026; bei Abschluss vom 03.09. bis 18.10.2026: Gesamtvergütung in zwölf Monatsraten). "
  + "Eine Kündigung nimmst du sofort entgegen — sie ist damit gebucht und gilt, unabhängig von jeder Zahlung. Sie wirkt mit einem Monat Frist zum Ende der zwölf Monate "
  + "(danach läuft der Vertrag unbefristet und ist mit einem Monat Frist kündbar); bis dahin laufen die Monatsraten weiter, und sein Bereich bleibt für ihn da. "
  + "Das Enddatum steht in der Akte (kuendigung.giltZum) bzw. kommt aus dem Werkzeug. "
  + "VORZEITIG RAUS kommt er NUR aus Kulanz, und die Kulanz gibt es NUR nach Zahlung der offenen Rechnung — dein Satz dafür, wörtlich: "
  + `„${kulanzSatz("X €")} ${RECHTE_SATZ}“ `
  + "Mit dem Zahlungseingang beendet das Haus den Vertrag automatisch und schickt die Abschlussmail. "
  + "Nie: „ab sofort keine Raten mehr“, „Ihr Vertrag ist beendet“ (solange er läuft), „ohne Zahlung können wir nicht kündigen“, eine Kulanz ohne Zahlung, eine Drohung. "
  + "VERTRAG VOR DEM 03.09.2026: NICHTS davon — monatlich kündbar, die Kündigung gilt zum Ende seines Abrechnungsmonats, KEIN „Kulanz“. "
  + "WIDERRUF: nie ein Kulanz-Angebot und nie eine Zahlungsbitte — die Geschäftsführung prüft ihn.";

// ═══════════════════════════════════════════════════════════════════════════
// SQL-BAUSTEINE (Text) — `a` ist der Alias einer fiaon_applications-Zeile. Die Unterabfragen tragen eigene Aliase
// (jv_…), sie stoßen mit keinem Aufrufer zusammen.
// ═══════════════════════════════════════════════════════════════════════════
function alias(a: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(a)) throw new Error(`[JAHRESVERTRAG] Ungültiger Tabellenalias: ${a}`);
  return a;
}

/**
 * Ist die Annahme belegt? Der neue Antrag schreibt eine Vertragsannahme mit PDF (fiaon_vertragsannahmen), der alte Weg
 * setzt consent_contract nur mit dem Knopf „Zahlungspflichtig annehmen“ (E-244) bzw. über /zustimmung. boolean.
 */
export const ANNAHME_BELEGT_SQL = (a: string): string =>
  `(COALESCE(${alias(a)}.consent_contract, FALSE)
    OR EXISTS (SELECT 1 FROM fiaon_vertragsannahmen jv_va WHERE jv_va.ref = ${a}.ref AND jv_va.vertrag_pdf IS NOT NULL))`;

/**
 * Der Tag des Vertragsschlusses (date, Berlin) — so früh, wie er belegt ist, nie vor der AGB-Fassung, die er annahm:
 * die Vertragsannahme (/antrag-neu, sekundengenau), sonst der Verlaufseintrag des Knopfs („Erste Rechnung gestellt
 * (automatisch beim Antragsabschluss)“, „Zustimmung vom Kunden erteilt: … consent_contract“), sonst Rate 1, die erste
 * Zahlung, der Abschluss. Der früheste Beleg gewinnt (das Laufzeitende fällt nie zu spät); die AGB-Fassung (agb_stand)
 * ist die Untergrenze — wer die Fassung vom 26.09. annahm, schloss nicht am 22.08. ab (gemessen: 1 von 20 Knopf-Verträgen).
 */
export const VERTRAGSBEGINN_SQL = (a: string): string => `GREATEST(${alias(a)}.agb_stand, LEAST(
    ((SELECT MIN(jv_v.angenommen_am) FROM fiaon_vertragsannahmen jv_v WHERE jv_v.ref = ${a}.ref) AT TIME ZONE 'Europe/Berlin')::date,
    ((SELECT MIN(jv_c.created_at) FROM fiaon_contact_log jv_c WHERE jv_c.ref = ${a}.ref
        AND (jv_c.note LIKE 'Erste Rechnung gestellt (automatisch beim Antragsabschluss)%'
          OR (jv_c.note LIKE 'Zustimmung vom Kunden erteilt:%' AND jv_c.note LIKE '%consent_contract%'))) AT TIME ZONE 'Europe/Berlin')::date,
    (SELECT MIN(jv_r.faellig_am) FROM fiaon_abo_raten jv_r WHERE jv_r.ref = ${a}.ref AND jv_r.rate_nr = 1),
    (${a}.paid_at AT TIME ZONE 'Europe/Berlin')::date,
    ${a}.completed_at::date))`;

/** Läuft dieser gekündigte Jahresvertrag noch bis zu seinem Laufzeitende (Kulanz noch nicht erfolgt)? boolean. */
export const LAEUFT_BIS_LAUFZEITENDE_SQL = (a: string): string =>
  `(${alias(a)}.gekuendigt_am IS NOT NULL AND ${a}.kuendigung_art = 'laufzeit' AND ${a}.vertrag_ende_am IS NOT NULL AND ${a}.vertrag_ende_am > NOW())`;
