// ═══════════════════════════════════════════════════════════════════════════
// DER NEUE PRIVATANTRAG — VERTRAG ALS PDF UND BESTÄTIGUNG PER MAIL
// (05.10.2026, E-282)
//
// Nach „Zahlungspflichtig annehmen“ auf /antrag-neu schreibt die Route
// POST /api/fiaon/antrag-neu/:ref/annehmen eine Zeile in fiaon_vertragsannahmen
// (Vertragstext, Prüfsumme, Unterschrift, Haken, Zeit, Gerät) und ruft danach
// vertragBestaetigungSenden(ref) — ohne darauf zu warten.
//
// ── WAS HIER ENTSTEHT ─────────────────────────────────────────────────────
//   1. Das Vertrags-PDF (vertragPdfErzeugen): der gespeicherte Vertragstext
//      WÖRTLICH (vertrag_html, dieselbe Fassung, über die die Prüfsumme läuft),
//      die Unterschrift als Bild und am Ende der „Nachweis der Annahme“. Es wird
//      EINMAL gedruckt und in der Zeile abgelegt (vertrag_pdf) — jede spätere
//      Auslieferung (Mail, Nachholen, Download) gibt dieselbe Ausfertigung aus.
//   2. Die Bestätigungsmail mit diesem PDF als Anhang — der dauerhafte
//      Datenträger nach § 312f Abs. 2 BGB. Make trägt keine Anhänge; deshalb
//      geht sie direkt über den Motor und protokolliert selbst (Muster:
//      globalMailSenden in fiaon-global-auftrag.ts).
//   3. Der Nachhol-Lauf für Bestätigungen, die nicht rausgingen.
//
// ── WARUM KEIN ERSATZDRUCK ────────────────────────────────────────────────
// Druckt Chromium nicht, liefert htmlZuPdfMitFusszeile sonst einen pdfkit-
// Notbehelf ohne Fußzeile, Seitenzahlen und Unterschriftsbild. Für eine
// Abrechnung ist das besser als nichts; für die Ausfertigung eines Vertrags
// nicht — sie läge für immer so in der Akte (dieselbe Entscheidung wie beim
// Individualangebot, 01.10.2026). Hier gilt deshalb keinNotbehelf: Ohne
// Chromium kein PDF, keine Mail, und der Nachhol-Lauf versucht es wieder.
// Gesetzlich genügt eine Bestätigung „in angemessener Frist, spätestens vor
// Beginn der Leistung“ — und die beginnt frühestens mit der ersten Rate.
//
// ── WER DARF GERADE SENDEN? ───────────────────────────────────────────────
// Route und Nachhol-Lauf (und auf Render ggf. eine zweite Instanz) können
// dieselbe Zeile gleichzeitig anfassen. Wer sendet, BELEGT die Zeile zuerst:
// bestaetigung_fehler wird zu „<n>|läuft seit <Zeitpunkt>“ — mit einem
// UPDATE, das nur greift, wenn der Text seit dem Lesen unverändert ist. Wer
// verliert, tut nichts. bestaetigung_gesendet_am bleibt dabei bis zum Erfolg
// leer: Wer die Spalte liest, liest die Wahrheit („gesendet“ heißt gesendet).
// Hängt eine Belegung länger als 15 Minuten (Neustart mitten im Versand),
// zählt sie als gescheiterter Versuch und darf neu belegt werden.
//
// ── DER FEHLERZÄHLER STEHT IM TEXT ────────────────────────────────────────
// bestaetigung_fehler = „<Versuche>|<Grund>“, z. B. „3|Brevo hat abgelehnt …“.
// Beim fünften Fehlversuch steht ein Verlaufseintrag an der Akte („bitte von
// Hand schicken“), und der Nachhol-Lauf nimmt die Zeile nicht mehr — ein Mensch
// muss nachsehen. Ein Fall, der sich durch Warten nicht löst (Daten DSGVO-
// gelöscht), springt sofort auf fünf. Ein Aufruf von Hand (vertragBestaetigung-
// Senden) versucht es auch danach noch.
//
// ── PRÜFSTÄNDE ────────────────────────────────────────────────────────────
// Jede Abfrage läuft über `lauf` (Vorgabe sqlPool) — auch Empfänger-Auflösung
// und Versandprotokoll. Der Versand selbst geht über Brevo: Ein Prüfstand
// leert BREVO_API_KEY oder ersetzt fetch, sonst geht eine echte Mail raus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { escapeHtml, wrapFiaonDocument, htmlZuPdfMitFusszeile, docHash } from "./fiaon-html-pdf";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { antragNeuPaket } from "@shared/fiaon-antrag-neu";
import { euroCent } from "@shared/fiaon-antrag-neu-vertrag";
import { anredeLesen } from "@shared/fiaon-mitarbeiter-name";
import { VERTRAG_BEGINN_SATZ } from "../mail/vorlagen/vertrag";

/** Der Datenbankweg — Vorgabe der Pool, im Prüfstand eine Transaktion (jede Abfrage hier läuft darüber). */
type Lauf = typeof sqlPool;

/** Das Ereignis im Mailwerk, im Protokoll und in der Frequenzregel (PFLICHTMAILS). */
export const VERTRAG_EREIGNIS = "vertrag_bestaetigung";
/** Ab so vielen Fehlversuchen versucht der Nachhol-Lauf es nicht mehr. */
export const BESTAETIGUNG_MAX_VERSUCHE = 5;
/** So lange darf eine Belegung („läuft seit …“) dauern, bevor sie als hängend gilt. */
const BELEGUNG_HAENGT_MINUTEN = 15;
const LAEUFT = "läuft seit ";
const PROTOKOLL_VON = "System (Vertragsbestätigung /antrag-neu)";

// ── Die Zeile ───────────────────────────────────────────────────────────────

/** Ein Haken aus der Annahme — so, wie die Route ihn speichert. */
export interface AnnahmeHaken { id: string; text: string; gesetzt: boolean }

/** Eine Zeile aus fiaon_vertragsannahmen, dazu der Name aus der Bestellung (für die Unterschriftszeile). */
export interface AnnahmeZeile {
  ref: string;
  person_id?: number | null;
  angenommen_am: Date | string;
  ip?: string | null;
  user_agent?: string | null;
  paket: string;
  rate_cents: number;
  gesamt_cents: number;
  ziel_limit?: number | null;
  vertrag_fassung: string;
  leistung_fassung: string;
  agb_fassung: string;
  knopf_text: string;
  /** JSONB [{id, text, gesetzt}] — postgres.js liefert ein Array, ältere Treiber einen Text. */
  haken: unknown;
  sofort_beginn: boolean;
  unterschrift_png?: Buffer | Uint8Array | string | null;
  unterschrift_getippt?: boolean | null;
  vertrag_html: string;
  vertrag_sha256: string;
  vorname?: string | null;
  nachname?: string | null;
}

/**
 * Alle Spalten außer vertrag_pdf (das kann einige Hundert KB groß sein und wird
 * nur gelesen, wo es gebraucht wird) — plus der Name aus der Bestellung.
 */
async function annahmeLesen(ref: string, lauf: Lauf): Promise<(AnnahmeZeile & {
  bestaetigung_gesendet_am: Date | null; bestaetigung_fehler: string | null; hat_pdf: boolean;
}) | null> {
  const [z] = (await lauf`
    SELECT v.ref, v.person_id, v.angenommen_am, v.ip, v.user_agent, v.paket, v.rate_cents, v.gesamt_cents, v.ziel_limit,
           v.vertrag_fassung, v.leistung_fassung, v.agb_fassung, v.knopf_text, v.haken, v.sofort_beginn,
           v.unterschrift_png, v.unterschrift_getippt, v.vertrag_html, v.vertrag_sha256,
           v.bestaetigung_gesendet_am, v.bestaetigung_fehler, (v.vertrag_pdf IS NOT NULL) AS hat_pdf,
           a.first_name AS vorname, a.last_name AS nachname
      FROM fiaon_vertragsannahmen v
      LEFT JOIN fiaon_applications a ON a.ref = v.ref
     WHERE v.ref = ${ref}
     LIMIT 1`) as any[];
  return z ?? null;
}

// ── Kleine, reine Helfer ────────────────────────────────────────────────────

/**
 * Datum und Uhrzeit in Berlin als Text: „05.10.2026“ und „14:32“.
 * Über formatToParts und NUR als Text — nie Number(Intl.format()): das liefert
 * in Node „14 Uhr“ und daraus NaN (die Nachtruhe-Falle vom 02.09.2026).
 */
export function berlinDatumUhrzeit(wann: Date | string): { datum: string; uhrzeit: string } {
  const d = wann instanceof Date ? wann : new Date(String(wann));
  if (Number.isNaN(d.getTime())) return { datum: "—", uhrzeit: "—" };
  const teile = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const t = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  return { datum: `${t("day")}.${t("month")}.${t("year")}`, uhrzeit: `${t("hour")}:${t("minute")}` };
}

/** „2026-09-26“ → „26.09.2026“; alles andere bleibt, wie es gespeichert ist. */
export function fassungsDatum(f: unknown): string {
  const s = String(f ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

/**
 * Die IP für den Nachweis, gekürzt: IPv4 → letztes Oktett „xxx“, IPv6 → letzte
 * Gruppe „xxx“. Steht eine Kette aus X-Forwarded-For darin, zählt der erste
 * Eintrag (der Mensch, nicht der Proxy).
 */
export function ipFuerNachweis(roh: unknown): string {
  const ip = String(roh ?? "").split(",")[0].trim();
  if (!ip) return "nicht erfasst";
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    return `${ip.slice(0, ip.length - v4.length)}${v4.split(".").slice(0, 3).join(".")}.xxx`;
  }
  if (ip.includes(":") && /^[0-9a-f:]+$/i.test(ip)) {
    const gruppen = ip.split(":");
    for (let i = gruppen.length - 1; i >= 0; i--) {
      if (gruppen[i] !== "") { gruppen[i] = "xxx"; return gruppen.join(":"); }
    }
  }
  return "nicht lesbar";
}

/** Die Haken der Annahme — robust gegen Text-JSON und fremde Einträge. */
export function hakenLesen(roh: unknown): AnnahmeHaken[] {
  let liste: unknown = roh;
  if (typeof roh === "string") {
    try { liste = JSON.parse(roh); } catch (e) {
      console.error("[ANTRAG-NEU-BESTAETIGUNG] Haken sind kein gültiges JSON:", e instanceof Error ? e.message : e);
      liste = [];
    }
  }
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
    .map((h) => ({ id: String(h.id ?? ""), text: String(h.text ?? "").trim(), gesetzt: h.gesetzt === true }))
    .filter((h) => h.text !== "");
}

/**
 * Die Unterschrift als data:-Adresse — nur, wenn es wirklich ein PNG ist.
 * Gespeichert wird BYTEA; manche Wege legen den data:-Text selbst als Bytes ab.
 * Alles andere kommt nicht ins Dokument (kein fremder Inhalt im src-Attribut).
 */
export function unterschriftDataUrl(roh: unknown): string | null {
  if (!roh) return null;
  const VORSPANN = "data:image/png;base64,";
  const ausText = (s: string): string | null => {
    const rest = s.slice(VORSPANN.length).trim();
    return s.startsWith(VORSPANN) && rest.length > 0 && /^[A-Za-z0-9+/=]+$/.test(rest) ? VORSPANN + rest : null;
  };
  if (typeof roh === "string") return ausText(roh.trim());
  const b = Buffer.isBuffer(roh) ? roh : roh instanceof Uint8Array ? Buffer.from(roh) : null;
  if (!b || b.length < 8) return null;
  const istPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (istPng) return VORSPANN + b.toString("base64");
  return ausText(b.subarray(0, Math.min(b.length, 2_000_000)).toString("latin1").trim());
}

/** „Guten Tag Frau Müller“ — ohne Anrede „Guten Tag Maria Müller“, ohne Namen „Guten Tag“. */
export function anredeZeileKunde(anrede: unknown, vorname: unknown, nachname: unknown): string {
  const a = anredeLesen(anrede);
  const nach = String(nachname ?? "").trim();
  if (a && nach) return `Guten Tag ${a} ${nach}`;
  const voll = [vorname, nachname].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
  return voll ? `Guten Tag ${voll}` : "Guten Tag";
}

/** Stimmt die gespeicherte Prüfsumme mit dem gespeicherten Vertragstext überein? */
export function pruefsummeStimmt(z: Pick<AnnahmeZeile, "vertrag_html" | "vertrag_sha256">): boolean {
  return docHash(String(z.vertrag_html ?? "")) === String(z.vertrag_sha256 ?? "").trim().toLowerCase();
}

/** Dateiname des PDFs — für Anhang und Download derselbe. */
export function vertragDateiname(ref: string): string {
  return `FIAON-Vertrag-${String(ref).replace(/[^A-Za-z0-9-]/g, "-")}.pdf`;
}

/** „<n>|…“ → n. Ohne Zähler 0. */
export function fehlerZaehler(text: unknown): number {
  const m = String(text ?? "").match(/^(\d+)\|/);
  return m ? Number(m[1]) : 0;
}

/** Die Belegung „<n>|läuft seit <ISO>“ lesen: Zeitpunkt der Belegung, sonst null. */
function belegtSeit(text: unknown): Date | null {
  const s = String(text ?? "");
  const i = s.indexOf(`|${LAEUFT}`);
  if (i < 0) return null;
  const d = new Date(s.slice(i + 1 + LAEUFT.length).trim());
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

// ── Das PDF ─────────────────────────────────────────────────────────────────

/** Das ruhige Bild des neuen Antrags (Tinte, Tiefblau, Haarlinien) — nur innerhalb des Dokuments. */
const PDF_CSS = `
  body { font-weight: 400; color: #0B1220; font-size: 9.6pt; line-height: 1.55; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  .brandline { color: #66758A; }
  header.doc { border-bottom: 1px solid #0f2044; margin-bottom: 14px; }
  h1.doc-title { font-weight: 300; font-size: 16pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; margin-top: 14px; }
  .doc-subtitle { color: #66758A; font-size: 8.8pt; margin-bottom: 16px; }
  footer.doc { display: none; }

  .vt p { margin: 0 0 6px; text-align: left; orphans: 3; widows: 3; }
  .vt .vt-fassung { font-size: 7.8pt; color: #66758A; letter-spacing: .02em; margin: 0 0 10px; }
  .vt h3 { font-size: 12pt; font-weight: 500; color: #0f2044; margin: 18px 0 8px; break-after: avoid; page-break-after: avoid; }
  .vt h4 { font-size: 10pt; font-weight: 600; color: #0f2044; margin: 14px 0 4px; break-after: avoid; page-break-after: avoid; }
  .vt ol { margin: 4px 0 8px; padding-left: 1.4em; }
  .vt li { margin: 2px 0; }
  .vt b { font-weight: 600; }
  .vt .vt-kasten { display: flex; flex-wrap: wrap; gap: 8px 24px; border: 1px solid rgba(15,32,72,.15); border-radius: 6px;
    padding: 10px 12px; background: #F5F8FE; margin: 12px 0; break-inside: avoid; page-break-inside: avoid; }
  .vt .vt-kasten > div { flex: 1 1 0; min-width: 0; }
  .vt .vt-kasten > p { flex: 1 1 100%; margin: 0 0 4px; }
  .vt .vt-klein { font-size: 7.2pt; text-transform: uppercase; letter-spacing: .08em; color: #66758A; }
  /* Die Anlagen beginnen auf eigener Seite — die Belehrung lässt sich so für sich ablegen. */
  .vt #vt-widerruf { break-before: page; page-break-before: always; margin-top: 0; }

  .vn-unterschrift { width: 52%; margin: 4px 0 0 auto; break-inside: avoid; page-break-inside: avoid; }
  .vn-kopf { font-size: 7.2pt; text-transform: uppercase; letter-spacing: .08em; color: #66758A; }
  .vn-feld { min-height: 64px; display: flex; align-items: flex-end; padding: 4px 0 2px; }
  .vn-sig { max-height: 70px; max-width: 250px; }
  .vn-linie { border-top: 1px solid #0f2044; padding-top: 4px; font-size: 8.2pt; color: #4A5568; }
  .vn-hinweis { font-size: 8pt; color: #4A5568; margin-top: 3px; }
  .vn-leer { font-size: 8.4pt; color: #66758A; }

  .vn-nachweis { margin-top: 26px; padding-top: 14px; border-top: 1px solid rgba(15,32,72,.15); break-inside: avoid; page-break-inside: avoid; }
  .vn-nachweis h3 { font-size: 12pt; font-weight: 500; color: #0f2044; margin: 0 0 4px; }
  .vn-leise { color: #66758A; font-size: 8.2pt; margin: 0 0 10px; text-align: left; }
  table.vn-tabelle { width: 100%; border-collapse: collapse; margin: 0; font-size: 8.6pt; }
  table.vn-tabelle th, table.vn-tabelle td { text-align: left; vertical-align: top; padding: 5px 6px; border-bottom: 1px solid rgba(15,32,72,.08); }
  table.vn-tabelle th { width: 31%; background: none; text-transform: none; letter-spacing: 0; font-size: 8.2pt; font-weight: 500; color: #4A5568; }
  table.vn-tabelle td { color: #0B1220; }
  .vn-haken { list-style: none; margin: 0; padding: 0; }
  .vn-haken li { display: flex; gap: 6px; margin: 0 0 4px; }
  .vn-haken li svg { flex: 0 0 auto; margin-top: 2px; color: #1D4ED8; }
  .vn-haken li.vn-aus { color: #66758A; }
  .vn-haken li.vn-aus svg { color: #94a3b8; }
  .vn-mono { font-family: "JetBrains Mono", "SF Mono", Menlo, "Courier New", monospace; font-size: 7.6pt; word-break: break-all; }
`;

/** Ein Haken, selbst gezeichnet: 1,5 px Strich, currentColor. */
const ZEICHEN_HAKEN = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2.5"/><path d="M3.4 6.2 5.2 8l3.4-4"/></svg>`;
const ZEICHEN_LEER = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2.5"/></svg>`;

/** Der Block unter dem Vertrag: das Bild der Unterschrift und wer wann unterschrieben hat. */
function unterschriftHtml(z: AnnahmeZeile): string {
  const bild = unterschriftDataUrl(z.unterschrift_png);
  const name = [z.vorname, z.nachname].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
  const { datum, uhrzeit } = berlinDatumUhrzeit(z.angenommen_am);
  const feld = bild
    ? `<img class="vn-sig" src="${escapeHtml(bild)}" alt="Unterschrift" />`
    : `<span class="vn-leer">${z.unterschrift_getippt ? "Unterschrift elektronisch gezeichnet" : "Kein Unterschriftsbild gespeichert"}</span>`;
  return `
<section class="vn-unterschrift">
  <div class="vn-kopf">Unterschrift des Kunden</div>
  <div class="vn-feld">${feld}</div>
  <div class="vn-linie">${name ? `${escapeHtml(name)} · ` : ""}angenommen am ${escapeHtml(datum)} um ${escapeHtml(uhrzeit)} Uhr</div>
  ${bild && z.unterschrift_getippt ? `<div class="vn-hinweis">Unterschrift elektronisch gezeichnet</div>` : ""}
</section>`;
}

/**
 * Der „Nachweis der Annahme“ — alles, was festhält, WANN und WIE angenommen wurde.
 * `geraet` kommt von außen (geraetAus), damit diese Funktion rein bleibt.
 */
export function nachweisHtml(z: AnnahmeZeile, geraet: string): string {
  const { datum, uhrzeit } = berlinDatumUhrzeit(z.angenommen_am);
  const p = antragNeuPaket(z.paket);
  const haken = hakenLesen(z.haken);
  const gesetzt = haken.filter((h) => h.gesetzt);
  const offen = haken.filter((h) => !h.gesetzt);
  const bestellung = [
    p?.name ?? z.paket,
    z.ziel_limit != null && Number(z.ziel_limit) > 0 ? `Ziel-Limit ${euroCent(Number(z.ziel_limit) * 100)}` : null,
    `12 Monatsraten zu je ${euroCent(Number(z.rate_cents))}`,
    `gesamt ${euroCent(Number(z.gesamt_cents))}`,
  ].filter(Boolean).join(" · ");
  const unterschrift = unterschriftDataUrl(z.unterschrift_png)
    ? (z.unterschrift_getippt ? "elektronisch gezeichnet (Name eingegeben), als Bild gespeichert" : "auf dem Bildschirm gezeichnet, als Bild gespeichert")
    : (z.unterschrift_getippt ? "elektronisch gezeichnet (Name eingegeben)" : "kein Bild gespeichert");
  const zeile = (k: string, v: string) => `<tr><th>${escapeHtml(k)}</th><td>${v}</td></tr>`;
  const hakenListe = [
    ...gesetzt.map((h) => `<li>${ZEICHEN_HAKEN}<span>${escapeHtml(h.text)}</span></li>`),
    ...offen.map((h) => `<li class="vn-aus">${ZEICHEN_LEER}<span>${escapeHtml(h.text)} <i>(nicht gesetzt)</i></span></li>`),
  ].join("");
  return `
<section class="vn-nachweis">
  <h3>Nachweis der Annahme</h3>
  <p class="vn-leise">Dieser Abschnitt hält fest, wann und wie der Vertrag angenommen wurde. Die Prüfsumme wurde bei der Annahme über den gespeicherten Vertragstext gebildet (HTML-Fassung, wie oben wiedergegeben); Unterschrift und dieser Nachweis sind nicht eingerechnet.</p>
  <table class="vn-tabelle">
    ${zeile("Zeitpunkt der Annahme", `${escapeHtml(datum)} ${escapeHtml(uhrzeit)} Uhr (Europe/Berlin)`)}
    ${zeile("Vorgang", escapeHtml(z.ref))}
    ${zeile("Bestellung", escapeHtml(bestellung))}
    ${zeile("Vertragsfassung", escapeHtml(z.vertrag_fassung))}
    ${zeile("Leistungsfassung", escapeHtml(z.leistung_fassung))}
    ${zeile("AGB-Fassung", `vom ${escapeHtml(fassungsDatum(z.agb_fassung))}`)}
    ${zeile("Schaltfläche", `„${escapeHtml(z.knopf_text)}“`)}
    ${zeile("Bestätigungen", hakenListe ? `<ul class="vn-haken">${hakenListe}</ul>` : "keine gespeichert")}
    ${zeile("Beginn vor Ablauf der Widerrufsfrist verlangt", z.sofort_beginn ? "Ja" : "Nein")}
    ${zeile("Unterschrift", escapeHtml(unterschrift))}
    ${zeile("Prüfsumme des Vertragstextes (SHA-256)", `<span class="vn-mono">${escapeHtml(String(z.vertrag_sha256 ?? "").trim() || "—")}</span>`)}
    ${zeile("IP-Adresse (gekürzt)", escapeHtml(ipFuerNachweis(z.ip)))}
    ${zeile("Gerät", escapeHtml(geraet))}
  </table>
</section>`;
}

/** Gerät grob aus der Browserkennung — die eine Lesart des Hauses (geraetAus, E-268). */
async function geraetFuer(ua: unknown): Promise<string> {
  try {
    const { geraetAus } = await import("./fiaon-global-angebot-aufrufe");
    return geraetAus(ua);
  } catch (e) {
    console.error("[ANTRAG-NEU-BESTAETIGUNG] Geräteerkennung nicht ladbar — im Nachweis steht die Kennung gekürzt:", e instanceof Error ? e.message : e);
    const roh = String(ua ?? "").trim();
    return roh ? `Browserkennung: ${roh.slice(0, 80)}` : "Unbekanntes Gerät (keine Browserkennung)";
  }
}

/** Der Seitenrand des Dokuments — derselbe wie beim Auftrag über FIAON Global. */
export const VERTRAG_PDF_RAND = { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" } as const;

/**
 * Das fertige Dokument (HTML) und die laufende Fußzeile — REIN bis auf das
 * Nachladen der Geräteerkennung, damit der Prüfstand das PDF ohne Datenbank
 * bauen kann. Der Vertragstext wird nicht angefasst: Die Unterschrift steht
 * zwischen Vertrag und Anlagen (vor „Anlage 1“), der Nachweis am Ende.
 */
export async function vertragDokument(z: AnnahmeZeile): Promise<{ html: string; fusszeile: string; titel: string }> {
  const { datum, uhrzeit } = berlinDatumUhrzeit(z.angenommen_am);
  const vertrag = String(z.vertrag_html ?? "");
  const unterschrift = unterschriftHtml(z);
  const marke = `<h3 id="vt-widerruf">`;
  const stelle = vertrag.indexOf(marke);
  const rumpf = stelle >= 0
    ? `<div class="vt">${vertrag.slice(0, stelle)}${unterschrift}${vertrag.slice(stelle)}</div>`
    : `<div class="vt">${vertrag}</div>${unterschrift}`;
  const titel = "Vertragsausfertigung";
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: `Vorgang ${z.ref} · angenommen am ${datum} um ${uhrzeit} Uhr`,
    bodyHtml: `${rumpf}\n${nachweisHtml(z, await geraetFuer(z.user_agent))}`,
    markenzeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`,
    zusatzCss: PDF_CSS,
  });
  const fusszeile = `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · Vertragsfassung ${z.vertrag_fassung} · Vorgang ${z.ref}`;
  return { html, fusszeile, titel };
}

/** Das PDF aus einer Zeile — ohne Datenbank. Wirft, wenn Chromium nicht druckt (kein Ersatzdruck, siehe Kopf). */
export async function pdfAusZeile(z: AnnahmeZeile): Promise<Buffer> {
  const { html, fusszeile, titel } = await vertragDokument(z);
  return htmlZuPdfMitFusszeile({ html, fusszeile, titel, rand: { ...VERTRAG_PDF_RAND }, keinNotbehelf: true });
}

// ── Verlauf an der Akte ─────────────────────────────────────────────────────
async function verlauf(ref: string, note: string, lauf: Lauf): Promise<void> {
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    SELECT ${ref}, a.person_id, NULL, 'System', 'system', ${note} FROM fiaon_applications a WHERE a.ref = ${ref}
  `.catch((e) => console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ref}: Verlaufseintrag nicht geschrieben:`, e));
}

// ── 1. Das PDF erzeugen und ablegen ─────────────────────────────────────────

/**
 * Die Ausfertigung holen oder EINMAL drucken und ablegen — mit dem Grund, wenn es nicht geht.
 * Liegt sie schon in der Zeile, kommt genau diese zurück; sonst wird gedruckt und nur abgelegt,
 * wenn vertrag_pdf noch leer ist (druckt ein zweiter Aufrufer gleichzeitig, gewinnt der erste,
 * und beide geben dieselbe Ausfertigung aus). Datenbankfehler werfen.
 */
async function ausfertigung(ref: string, lauf: Lauf): Promise<{ pdf: Buffer } | { pdf: null; keineAnnahme: boolean; grund: string }> {
  const [vorhanden] = (await lauf`SELECT vertrag_pdf FROM fiaon_vertragsannahmen WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!vorhanden) return { pdf: null, keineAnnahme: true, grund: `Keine Vertragsannahme zu ${ref}.` };
  if (vorhanden.vertrag_pdf) return { pdf: Buffer.from(vorhanden.vertrag_pdf) };
  const z = await annahmeLesen(ref, lauf);
  if (!z) return { pdf: null, keineAnnahme: true, grund: `Keine Vertragsannahme zu ${ref}.` };
  let pdf: Buffer;
  try {
    pdf = await pdfAusZeile(z);
    if (!pdf || pdf.length < 1000) throw new Error(`PDF zu klein (${pdf?.length ?? 0} Byte)`);
  } catch (e) {
    const grund = e instanceof Error ? e.message.split("\n")[0] : String(e);
    console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ref}: Vertrags-PDF nicht erzeugt:`, grund);
    return { pdf: null, keineAnnahme: false, grund: `Das Vertrags-PDF ließ sich nicht erzeugen (Chromium): ${grund.slice(0, 200)}` };
  }
  const [abgelegt] = (await lauf`
    UPDATE fiaon_vertragsannahmen SET vertrag_pdf = ${pdf}, pdf_erstellt_am = NOW()
     WHERE ref = ${ref} AND vertrag_pdf IS NULL
    RETURNING id`) as any[];
  if (abgelegt) {
    if (!pruefsummeStimmt(z)) {
      // Nicht still: Ein Vertragstext, der nicht zu seiner Prüfsumme passt, ist ein Fall für einen Menschen.
      // Das PDF trägt die GESPEICHERTE Prüfsumme, so wie sie bei der Annahme festgehalten wurde. Einmal je
      // Annahme gemeldet — beim Ablegen der Ausfertigung.
      console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ref}: Prüfsumme passt NICHT zum gespeicherten Vertragstext (gespeichert ${z.vertrag_sha256}, berechnet ${docHash(z.vertrag_html)}).`);
      await verlauf(ref, `Vertragsannahme: Die gespeicherte Prüfsumme passt nicht zum gespeicherten Vertragstext. Das PDF trägt die Prüfsumme vom Zeitpunkt der Annahme — bitte prüfen (fiaon_vertragsannahmen, ${ref}).`, lauf);
    }
    return { pdf };
  }
  const [anderer] = (await lauf`SELECT vertrag_pdf FROM fiaon_vertragsannahmen WHERE ref = ${ref} LIMIT 1`) as any[];
  return { pdf: anderer?.vertrag_pdf ? Buffer.from(anderer.vertrag_pdf) : pdf };
}

/**
 * 1. Die Ausfertigung zur Vertragsannahme (abgelegt oder jetzt gedruckt und abgelegt).
 * null: keine Annahme zu dieser Nummer, oder Chromium druckt gerade nicht (steht im Serverprotokoll).
 */
export async function vertragPdfErzeugen(ref: string, lauf: Lauf = sqlPool): Promise<Buffer | null> {
  return (await ausfertigung(ref, lauf)).pdf;
}

/**
 * 4. Für GET /antrag-neu/:ref/vertrag.pdf. null = es gibt keine Annahme zu dieser Nummer (404).
 * WIRFT, wenn die Annahme da ist, das PDF aber gerade nicht entsteht (Chromium) — das ist unser
 * Fehler, kein „nicht gefunden“; die Route antwortet dann mit 503 und „bitte gleich noch einmal“.
 */
/**
 * Der angenommene Vertrag eines angemeldeten Kunden (Vertrag § 13 Abs. 2: „jederzeit im
 * Kundenbereich abrufen"). Die Sitzung trägt eine Referenz — der Vertrag kann an einer
 * anderen Zeile derselben Person hängen. Der jüngste zählt. null = kein Vertrag aus dem neuen Weg.
 */
export async function vertragsRefFuerKunde(ref: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const [z] = (await lauf`
    SELECT v.ref FROM fiaon_vertragsannahmen v
     WHERE v.ref = ${ref}
        OR v.ref IN (SELECT a.ref FROM fiaon_applications a
                      WHERE a.person_id IS NOT NULL AND a.gdpr_deleted_at IS NULL
                        AND a.person_id = (SELECT b.person_id FROM fiaon_applications b WHERE b.ref = ${ref} LIMIT 1))
     ORDER BY v.angenommen_am DESC LIMIT 1`) as any[];
  return z?.ref ? String(z.ref) : null;
}

export async function vertragPdfFuerKunde(ref: string, lauf: Lauf = sqlPool): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const a = await ausfertigung(ref, lauf);
  if (a.pdf) return { pdf: a.pdf, dateiname: vertragDateiname(ref) };
  if (a.keineAnnahme) return null;
  throw new Error(a.grund);
}

// ── 2. Die Bestätigungsmail ─────────────────────────────────────────────────

/**
 * Die Nutzlast der Mail — REIN. Der Motor setzt Werte ungeprüft ins HTML,
 * deshalb ist hier alles entschärft. Beträge über den Formatierer des Vertrags
 * (euroCent), damit Mail und PDF dieselben Zahlen zeigen.
 */
export function bestaetigungNutzlast(
  z: AnnahmeZeile,
  kunde: { email: string; anrede?: unknown; vorname?: unknown; nachname?: unknown },
): Record<string, string> {
  const { datum, uhrzeit } = berlinDatumUhrzeit(z.angenommen_am);
  const p = antragNeuPaket(z.paket);
  return {
    email: String(kunde.email || "").trim(),
    anrede_zeile: escapeHtml(anredeZeileKunde(kunde.anrede, kunde.vorname, kunde.nachname)),
    paket: escapeHtml(p?.name ?? z.paket),
    antrag_id: escapeHtml(z.ref),
    angenommen_datum: datum,
    angenommen_uhrzeit: uhrzeit,
    agb_fassung_text: escapeHtml(fassungsDatum(z.agb_fassung)),
    widerruf_email: escapeHtml(FIAON_FIRMA.email),
    // Eine fehlende Angabe wird angezeigt, nicht gefüllt (AGENTS.md).
    ziel_limit_text: z.ziel_limit != null && Number(z.ziel_limit) > 0 ? euroCent(Number(z.ziel_limit) * 100) : "nicht angegeben",
    rate_text: euroCent(Number(z.rate_cents)),
    gesamt_text: euroCent(Number(z.gesamt_cents)),
    beginn_satz: z.sofort_beginn ? VERTRAG_BEGINN_SATZ.sofort : VERTRAG_BEGINN_SATZ.nachFrist,
  };
}

/** Die Anrede: Angabe im neuen Antrag, sonst die im Vertrag, sonst die gepflegte an der Person. */
function anredeAus(neuDaten: unknown, vertragHtml: string, personAnrede: unknown): string | null {
  let d: any = neuDaten;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch (e) {
      console.error("[ANTRAG-NEU-BESTAETIGUNG] antrag_neu_daten ist kein gültiges JSON — Anrede aus dem Vertrag:", e instanceof Error ? e.message : e);
      d = null;
    }
  }
  const ausAntrag = anredeLesen(d?.anrede);
  if (ausAntrag) return ausAntrag;
  // Der Vertragstext nennt den Kunden in § 1 Abs. 2 („(2) Frau Maria Müller, …“) — unser eigener Satz
  // (kundeZeile in shared/fiaon-antrag-neu-vertrag.ts), kein fremder Text.
  const m = String(vertragHtml || "").match(/<p>\(2\) (Frau|Herr) /);
  if (m) return m[1];
  return anredeLesen(personAnrede);
}

type SendeErgebnis = { ok: boolean; uebersprungen?: boolean; fehler?: string };

/**
 * Schickt die Bestätigung mit dem Vertrags-PDF — höchstens einmal je Annahme.
 * Wirft nie. `uebersprungen`: schon gesendet, oder ein anderer Aufruf sendet gerade.
 */
export async function vertragBestaetigungSenden(ref: string, lauf: Lauf = sqlPool): Promise<SendeErgebnis> {
  const ziel = String(ref || "").trim();
  if (!ziel) return { ok: false, fehler: "Keine Vorgangsnummer." };
  let z: Awaited<ReturnType<typeof annahmeLesen>>;
  try {
    z = await annahmeLesen(ziel, lauf);
  } catch (e) {
    console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Annahme nicht lesbar:`, e);
    return { ok: false, fehler: `Annahme nicht lesbar: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!z) return { ok: false, fehler: `Keine Vertragsannahme zu ${ziel}.` };
  if (z.bestaetigung_gesendet_am) return { ok: true, uebersprungen: true };

  // ── Belegen ─────────────────────────────────────────────────────────────
  const vorher = z.bestaetigung_fehler ?? null;
  const seit = belegtSeit(vorher);
  if (seit && Date.now() - seit.getTime() < BELEGUNG_HAENGT_MINUTEN * 60_000) return { ok: true, uebersprungen: true };
  // Eine hängende Belegung war ein Versuch — sie zählt mit.
  const versuche = fehlerZaehler(vorher) + (seit ? 1 : 0);
  const belegung = `${versuche}|${LAEUFT}${new Date().toISOString()}`;
  let belegt: any;
  try {
    [belegt] = (await lauf`
      UPDATE fiaon_vertragsannahmen SET bestaetigung_fehler = ${belegung}
       WHERE ref = ${ziel} AND bestaetigung_gesendet_am IS NULL
         AND bestaetigung_fehler IS NOT DISTINCT FROM ${vorher}
      RETURNING id`) as any[];
  } catch (e) {
    console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Belegen fehlgeschlagen:`, e);
    return { ok: false, fehler: `Belegen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` };
  }
  // Ein anderer Aufruf war schneller (oder hat inzwischen gesendet) — dann tut dieser nichts.
  if (!belegt) return { ok: true, uebersprungen: true };

  const scheitern = async (grund: string, endgueltig = false): Promise<SendeErgebnis> => {
    const n = endgueltig ? BESTAETIGUNG_MAX_VERSUCHE : versuche + 1;
    await lauf`
      UPDATE fiaon_vertragsannahmen SET bestaetigung_fehler = ${`${n}|${grund}`.slice(0, 600)}
       WHERE ref = ${ziel} AND bestaetigung_gesendet_am IS NULL AND bestaetigung_fehler = ${belegung}`
      .catch((e) => console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Fehler nicht vermerkt:`, e));
    console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Versuch ${n} gescheitert: ${grund}`);
    if (n >= BESTAETIGUNG_MAX_VERSUCHE) {
      await verlauf(ziel, `Vertragsbestätigung (neuer Antrag): Die Mail mit dem Vertrags-PDF ging NICHT raus — ${n} Versuche, zuletzt: ${grund}. Bitte Adresse prüfen und den Vertrag von Hand schicken; das PDF liegt an der Vertragsannahme (fiaon_vertragsannahmen).`, lauf);
    }
    return { ok: false, fehler: grund };
  };

  try {
    // ── Schon draußen? ────────────────────────────────────────────────────
    // Ging die Mail beim letzten Versuch raus, aber der Vermerk nicht mehr (Neustart, Datenbank kurz weg),
    // steht sie im Versandprotokoll. Dann wird nur der Vermerk nachgetragen — kein zweiter Versand.
    const [schon] = (await lauf`
      SELECT created_at FROM fiaon_mail_log
       WHERE event = ${VERTRAG_EREIGNIS} AND status = 'versandt' AND COALESCE(art, 'echt') <> 'test'
         AND created_at >= ${new Date(z.angenommen_am)} AND payload ->> 'antrag_id' = ${ziel}
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (schon) {
      await lauf`
        UPDATE fiaon_vertragsannahmen SET bestaetigung_gesendet_am = ${schon.created_at}, bestaetigung_fehler = NULL
         WHERE ref = ${ziel} AND bestaetigung_fehler = ${belegung}`;
      console.warn(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Bestätigung stand schon im Versandprotokoll — Vermerk nachgetragen, kein zweiter Versand.`);
      return { ok: true, uebersprungen: true };
    }

    // ── Empfänger und Anrede ──────────────────────────────────────────────
    const [a] = (await lauf`
      SELECT a.person_id, a.email, a.contact_email, a.first_name, a.last_name, a.gdpr_deleted_at, a.antrag_neu_daten,
             (SELECT to_jsonb(p) ->> 'anrede' FROM fiaon_persons p WHERE p.id = a.person_id) AS person_anrede
        FROM fiaon_applications a WHERE a.ref = ${ziel} LIMIT 1`) as any[];
    if (!a) return await scheitern("Keine Bestellung zu dieser Vertragsannahme (fiaon_applications).");
    if (a.gdpr_deleted_at) return await scheitern("Die Daten sind DSGVO-gelöscht — kein Versand.", true);
    // Die Adresse über die zentrale Auflösung — dieselbe wie bei den Zahlungsdaten (Tür in make-webhook.ts).
    const { empfaengerAufloesen } = await import("./fiaon-empfaenger");
    const personId = z.person_id != null ? Number(z.person_id) : a.person_id != null ? Number(a.person_id) : null;
    const empfaenger = await empfaengerAufloesen({ personId, ref: ziel, ausNutzlast: a.email || a.contact_email }, lauf);
    if (!empfaenger?.email) return await scheitern("Keine zustellbare E-Mail-Adresse — weder an der Person noch an der Bestellung.");

    // ── PDF ───────────────────────────────────────────────────────────────
    const aus = await ausfertigung(ziel, lauf);
    if (!aus.pdf) return await scheitern(`${aus.grund} — ohne PDF keine Bestätigung.`);
    const pdf = aus.pdf;

    // ── Mail ──────────────────────────────────────────────────────────────
    const nutzlast = bestaetigungNutzlast(z, {
      email: empfaenger.email,
      anrede: anredeAus(a.antrag_neu_daten, z.vertrag_html, a.person_anrede),
      vorname: a.first_name ?? z.vorname, nachname: a.last_name ?? z.nachname,
    });
    const motor = await import("../mail/motor");
    // Vor dem Versand: Eine Vertragsbestätigung mit leerem Platzhalter wäre ein halber Satz in einer
    // Urkunde. Der Motor sendet in diesem Fall trotzdem und meldet es nur — hier wird abgelehnt.
    const probe = motor.mailRendern(VERTRAG_EREIGNIS, nutzlast);
    if (!probe) return await scheitern(`Keine Vorlage für '${VERTRAG_EREIGNIS}' im Motor.`);
    if (probe.fehlend.length) return await scheitern(`Platzhalter ohne Wert: ${probe.fehlend.join(", ")}.`);
    const dateiname = vertragDateiname(ziel);
    let erg: { ok: boolean; messageId: string | null; grund?: string };
    try {
      erg = await motor.mailDirektSenden(VERTRAG_EREIGNIS, nutzlast, { anhaenge: [{ name: dateiname, inhalt: pdf }] });
    } catch (e) {
      erg = { ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) };
    }
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: VERTRAG_EREIGNIS, personId: empfaenger.personId ?? personId, empfaenger: empfaenger.email,
      status: erg.ok ? "versandt" : "fehlgeschlagen", grund: erg.ok ? (erg.grund ?? null) : (erg.grund || "unbekannt"),
      payload: { ...nutzlast, empfaenger_quelle: empfaenger.quelle, anhaenge: [dateiname], pdf_bytes: pdf.length },
      ausgeloestVon: PROTOKOLL_VON, brevoMessageId: erg.messageId,
    }, lauf);
    if (!erg.ok) return await scheitern(`Versand gescheitert: ${erg.grund || "unbekannt"}`);

    // Ab hier ist die Mail raus — ein Fehler beim Vermerk darf NICHT als gescheiterter Versand zählen.
    // Der nächste Versuch findet sie im Versandprotokoll (oben) und trägt den Vermerk nach.
    try {
      await lauf`
        UPDATE fiaon_vertragsannahmen SET bestaetigung_gesendet_am = NOW(), bestaetigung_fehler = NULL
         WHERE ref = ${ziel} AND bestaetigung_fehler = ${belegung}`;
    } catch (e) {
      console.error(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Mail ist raus, Vermerk fehlt (wird beim nächsten Lauf aus dem Protokoll nachgetragen):`, e);
    }
    const { datum, uhrzeit } = berlinDatumUhrzeit(z.angenommen_am);
    await verlauf(ziel, `Vertragsbestätigung (neuer Antrag) mit dem Vertrag als PDF an ${empfaenger.email} geschickt — angenommen am ${datum} um ${uhrzeit} Uhr, Vertragsfassung ${z.vertrag_fassung}${erg.messageId ? `, Brevo ${erg.messageId}` : ""}.`, lauf);
    console.log(`[ANTRAG-NEU-BESTAETIGUNG] ${ziel}: Bestätigung an ${empfaenger.email} gesendet (${pdf.length} Byte PDF, ${erg.messageId ?? "ohne Id"}).`);
    return { ok: true };
  } catch (e) {
    return await scheitern(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── 3. Der Nachhol-Lauf ─────────────────────────────────────────────────────

/**
 * Für den Nachhol-Lauf (alle 10 Minuten): Bestätigungen, die nicht rausgingen —
 * Annahme älter als 3 Minuten (der erste Versuch der Route hat Vorrang) und
 * jünger als 3 Tage, weniger als fünf Fehlversuche. Nacheinander, höchstens 20
 * je Lauf. Gibt die Zahl der gesendeten Bestätigungen zurück. Idempotent: Eine
 * gesendete Zeile fällt aus der Auswahl, eine belegte überspringt der Versand.
 */
export async function vertragBestaetigungNachholen(lauf: Lauf = sqlPool): Promise<number> {
  const zeilen = (await lauf`
    SELECT ref, bestaetigung_fehler FROM fiaon_vertragsannahmen
     WHERE bestaetigung_gesendet_am IS NULL
       AND angenommen_am < NOW() - INTERVAL '3 minutes'
       AND angenommen_am > NOW() - INTERVAL '3 days'
       AND (CASE WHEN split_part(COALESCE(bestaetigung_fehler, ''), '|', 1) ~ '^[0-9]+$'
                 THEN split_part(bestaetigung_fehler, '|', 1)::int ELSE 0 END) < ${BESTAETIGUNG_MAX_VERSUCHE}
     ORDER BY angenommen_am ASC
     LIMIT 20`) as any[];
  let gesendet = 0;
  for (const r of zeilen) {
    if (fehlerZaehler(r.bestaetigung_fehler) >= BESTAETIGUNG_MAX_VERSUCHE) continue;
    const erg = await vertragBestaetigungSenden(String(r.ref), lauf);
    if (erg.ok && !erg.uebersprungen) gesendet++;
  }
  if (zeilen.length) console.log(`[ANTRAG-NEU-BESTAETIGUNG] Nachhol-Lauf: ${zeilen.length} offen, ${gesendet} gesendet.`);
  return gesendet;
}
