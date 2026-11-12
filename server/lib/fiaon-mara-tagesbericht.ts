// ═══════════════════════════════════════════════════════════════════════════
// MARAS TAGESBERICHT (E-499, 12.11.2026) — jeden Abend ihr Arbeitstag als PDF per Mail an Justin
//
// Justin (10.11.2026): „MARA muss selbst arbeiten können, wie ein Mitarbeiter, der selbst handelt und jeden Tag eine
// Zusammenfassung als PDF per Mail schickt.“
//
// ── WAS DRIN STEHT ──────────────────────────────────────────────────────────
// Die letzten 24 Stunden (20:00 bis 20:00 — so geht auch der späte Abend nie verloren), aus DERSELBEN Liste der
// Handlungen wie die Karte „Mara heute“ (fiaon-mara-heute.ts: handlungenZaehlen / handlungenLesen) — keine zweite Zählung:
//   · Kopfzahlen (erledigt, Mails, WhatsApp, Termine) · die Liste „Das habe ich getan“
//   · Kündigungen: gebucht (alle Wege, fiaon_applications) und im Postfach nicht gebucht mit Grund
//   · Geld heute (die EINE Quelle über Maras Bilanz) · was auf Justin wartet (Karten, Entwürfe) · wo es im Team hängt
//   · KI-Kosten · der Verlauf (die letzten 40 Handlungen mit Uhrzeit)
//
// ── WIE ER RAUSGEHT ─────────────────────────────────────────────────────────
// Einmal je Tag ab 20:00 Berliner Zeit (atomarer Tagesmerker in fiaon_settings, höchstens drei Versuche am Abend),
// als Mail über Brevo mit dem PDF im Anhang. Schalter „mara_tagesbericht_an“ (KI-Team › Einstellungen, Vorgabe an),
// Adresse „mara_tagesbericht_adresse“ (Vorgabe: die Dossier-Adresse). Wirft nie.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { heuteErledigt, heuteZeilen, type HeuteZeile } from "@shared/fiaon-mara-ampel";
import { handlungenLesen, handlungenZaehlen, haengtLesen, kiKostenLesen, MAIL_ARTEN, WA_ARTEN, type Handlung, type HaengtZeile } from "./fiaon-mara-heute";
import { escapeHtml, renderDocumentPdf } from "./fiaon-html-pdf";

type Lauf = typeof sqlPool;

export const TB_SCHLUESSEL = { an: "mara_tagesbericht_an", tag: "mara_tagesbericht_tag", adresse: "mara_tagesbericht_adresse" } as const;
/** Ab dieser Berliner Uhrzeit ist der Bericht fällig (Minuten ab Mitternacht). */
export const TB_AB_MINUTE = 20 * 60;
export const TB_VERSUCHE = 3;

// ── Zeit (Berlin, nur über formatToParts — nie Number(Intl.format())) ────────
function berlinTeile(d: Date): { tag: string; minute: number; uhr: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { tag: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute), uhr: `${p.hour}:${p.minute}` };
}
function tagDeutsch(iso: string): string { const [j, m, t] = iso.split("-"); return `${t}.${m}.${j}`; }
function zeitKurz(d: Date): string { const b = berlinTeile(d); return `${b.tag.slice(8, 10)}.${b.tag.slice(5, 7)}. ${b.uhr}`; }

/** Ist der Bericht jetzt fällig? Merker = „JJJJ-MM-TT“ (gesendet) oder „JJJJ-MM-TT#fN“ (N Fehlversuche heute). Rein. */
export function tagesberichtFaellig(jetzt: Date, merker: string | null | undefined): { faellig: boolean; tag: string; fehlversuche: number } {
  const b = berlinTeile(jetzt);
  const [mTag, mFehl] = String(merker ?? "").split("#f");
  const fehlversuche = mTag === b.tag && mFehl ? Number(mFehl) || 0 : 0;
  if (b.minute < TB_AB_MINUTE) return { faellig: false, tag: b.tag, fehlversuche };
  if (mTag === b.tag && !mFehl) return { faellig: false, tag: b.tag, fehlversuche };
  return { faellig: fehlversuche < TB_VERSUCHE, tag: b.tag, fehlversuche };
}

// ── Daten ────────────────────────────────────────────────────────────────────
export interface TagesberichtDaten {
  tag: string; von: string; bis: string;
  erledigt: number; zeilen: HeuteZeile[];
  mails: number; whatsapps: number; termine: number;
  /** entwuerfeWarten = Entwürfe der letzten 14 Tage; entwuerfeAlt = ältere (die sendet niemand mehr — Vorschlag: ablegen). */
  postfach: { rein: number; selbstBeantwortet: number; entwuerfeWarten: number; entwuerfeAlt: number } | null;
  kuendigungen: { gebucht: number; postfachGebucht: { kunde: string; ergebnis: string }[]; postfachOffen: { kunde: string; grund: string }[] } | null;
  geld: { heuteCents: number; zahlungen: number; nachMaraCents: number; nachMaraZahlungen: number } | null;
  karten: { entscheidungen: number; minuten: number; aeltesteTage: number } | null;
  haengt: HaengtZeile[];
  ki: { maraCents: number; alleCents: number; wocheCents: number } | null;
  verlauf: Handlung[];
}

function jsonDoppelt(wert: unknown): any[] {
  let v: any = wert;
  for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
}

/** Alles für den Bericht. Jeder Teil darf scheitern, ohne den Bericht umzuwerfen (dann fehlt nur der Abschnitt). */
export async function tagesberichtDaten(o: { jetzt?: Date; lauf?: Lauf } = {}): Promise<TagesberichtDaten> {
  const lauf = o.lauf ?? sqlPool;
  const bis = o.jetzt ?? new Date();
  const von = new Date(bis.getTime() - 24 * 3600_000);
  const leise = (was: string) => (e: unknown) => { console.warn(`[MARA-TAGESBERICHT] ${was}:`, String((e as Error)?.message ?? e).slice(0, 200)); return null; };
  const [zahlen, verlauf, postfach, kuendigungen, geld, karten, haengt, ki] = await Promise.all([
    handlungenZaehlen(von, bis, lauf).catch(leise("Handlungen")),
    handlungenLesen(von, bis, { lauf, mitText: true }).catch(leise("Verlauf")),
    (async () => {
      const [z] = (await lauf`
        SELECT COUNT(*) FILTER (WHERE created_at >= ${von} AND created_at < ${bis} AND aktion <> 'ignoriert')::int AS rein,
               COUNT(*) FILTER (WHERE created_at >= ${von} AND created_at < ${bis} AND aktion = 'auto_beantwortet')::int AS selbst,
               COUNT(*) FILTER (WHERE aktion = 'entwurf' AND gesendet_am IS NULL AND created_at >= ${bis}::timestamptz - INTERVAL '14 days')::int AS entwuerfe,
               COUNT(*) FILTER (WHERE aktion = 'entwurf' AND gesendet_am IS NULL AND created_at < ${bis}::timestamptz - INTERVAL '14 days')::int AS entwuerfe_alt
          FROM fiaon_postmeister WHERE (created_at >= ${von} AND created_at < ${bis}) OR (aktion = 'entwurf' AND gesendet_am IS NULL)`) as any[];
      return { rein: Number(z?.rein ?? 0), selbstBeantwortet: Number(z?.selbst ?? 0), entwuerfeWarten: Number(z?.entwuerfe ?? 0), entwuerfeAlt: Number(z?.entwuerfe_alt ?? 0) };
    })().catch(leise("Postfach")),
    (async () => {
      const [g] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE gekuendigt_am >= ${von} AND gekuendigt_am < ${bis} AND merged_into IS NULL`) as any[];
      const zeilen = (await lauf`
        SELECT p.id, p.handlungen::text AS handlungen, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', pe.first_name, pe.last_name)), ''), p.von) AS kunde
          FROM fiaon_postmeister p LEFT JOIN fiaon_persons pe ON pe.id = p.person_id
         WHERE p.created_at >= ${von} AND p.created_at < ${bis} AND p.handlungen::text LIKE '%kuendigung_vormerken%'
           AND (pe.id IS NULL OR pe.ist_test_am IS NULL)
         ORDER BY p.created_at`) as any[];
      const postfachGebucht: { kunde: string; ergebnis: string }[] = [], postfachOffen: { kunde: string; grund: string }[] = [];
      for (const z of zeilen) {
        const h = jsonDoppelt(z.handlungen).filter((x: any) => x?.werkzeug === "kuendigung_vormerken");
        if (!h.length) continue;
        const ok = h.find((x: any) => x.ok);
        const kunde = String(z.kunde || "").replace(/<[^>]*>/g, "").trim().slice(0, 60) || "ohne Namen";
        if (ok) postfachGebucht.push({ kunde, ergebnis: String(ok.ergebnis || "").replace(/\s+/g, " ").slice(0, 140) });
        // Der Grund ohne die Anweisung an das Modell („— NICHTS ist gebucht. Bestätige keine …“).
        else postfachOffen.push({ kunde, grund: String(h[h.length - 1]?.ergebnis || "").replace(/\s+/g, " ").split(/\s+[—–-]\s+NICHTS\b|\.\s/)[0].slice(0, 140) });
      }
      return { gebucht: Number(g?.n ?? 0), postfachGebucht, postfachOffen };
    })().catch(leise("Kündigungen")),
    (async () => {
      const { maraBilanz } = await import("./fiaon-mara-bilanz");
      const r = (await maraBilanz()).zeitraeume.heute?.rahmen;
      return r ? { heuteCents: r.geldCents, zahlungen: r.zahlungen, nachMaraCents: r.nachMaraCents, nachMaraZahlungen: r.nachMaraZahlungen } : null;
    })().catch(leise("Geld")),
    (async () => {
      const { tagesLastLesen } = await import("./fiaon-mara-entscheidungen");
      const l = await tagesLastLesen(lauf);
      return { entscheidungen: l.entscheidungen, minuten: l.minuten, aeltesteTage: l.aeltesteTage };
    })().catch(leise("Karten")),
    haengtLesen(lauf).catch(leise("Hängt")),
    kiKostenLesen(lauf).catch(leise("KI")),
  ]);
  const z = zahlen ?? {};
  const n = (art: string) => Math.max(0, Number((z as any)[art] ?? 0) || 0);
  return {
    tag: berlinTeile(bis).tag, von: von.toISOString(), bis: bis.toISOString(),
    erledigt: heuteErledigt(z), zeilen: heuteZeilen(z),
    mails: MAIL_ARTEN.reduce((s, a) => s + n(a), 0), whatsapps: WA_ARTEN.reduce((s, a) => s + n(a), 0), termine: n("termin"),
    postfach, kuendigungen, geld, karten, haengt: haengt ?? [], ki, verlauf: (verlauf ?? []).slice(0, 40),
  };
}

// ── Darstellung (rein) ───────────────────────────────────────────────────────
const euro = (cents: number) => `${(Math.round(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dollar = (cents: number) => `${(Math.round(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** Die drei, vier Sätze oben in Mail und PDF — in Maras Stimme, ohne Zahlenfriedhof. Rein. */
export function tagesberichtKurz(d: TagesberichtDaten): string[] {
  const s: string[] = [];
  if (!d.erledigt) s.push("Heute war es ruhig: Es kam nichts herein, das ich erledigen konnte.");
  else s.push(`Ich habe in den letzten 24 Stunden ${d.erledigt} ${d.erledigt === 1 ? "Sache" : "Sachen"} selbst erledigt — ${d.mails} ${d.mails === 1 ? "Mail" : "Mails"}, ${d.whatsapps} WhatsApp-${d.whatsapps === 1 ? "Antwort" : "Antworten"}, ${d.termine} ${d.termine === 1 ? "Termin" : "Termine"}.`);
  if (d.geld && d.geld.zahlungen) s.push(`Heute sind ${euro(d.geld.heuteCents)} eingegangen (${d.geld.zahlungen} ${d.geld.zahlungen === 1 ? "Zahlung" : "Zahlungen"}), davon ${euro(d.geld.nachMaraCents)} nach einem Kontakt mit mir.`);
  if (d.kuendigungen && (d.kuendigungen.gebucht || d.kuendigungen.postfachOffen.length)) {
    s.push(`Kündigungen: ${d.kuendigungen.gebucht} gebucht${d.kuendigungen.postfachOffen.length ? `, ${d.kuendigungen.postfachOffen.length} im Postfach noch nicht gebucht (Grund steht im Bericht)` : ""}.`);
  }
  const wartet: string[] = [];
  if (d.karten?.entscheidungen) wartet.push(`${d.karten.entscheidungen} ${d.karten.entscheidungen === 1 ? "Entscheidung" : "Entscheidungen"} (etwa ${d.karten.minuten} Minuten)`);
  if (d.postfach?.entwuerfeWarten) wartet.push(`${d.postfach.entwuerfeWarten} ${d.postfach.entwuerfeWarten === 1 ? "Entwurf" : "Entwürfe"} im Postfach`);
  s.push(wartet.length ? `Auf dich wartet: ${wartet.join(" und ")}.` : "Auf dich wartet gerade nichts.");
  return s;
}

const TB_CSS = `
  .tb-kurz p { margin: 0 0 6px; font-size: 12.5px; line-height: 1.55; }
  .tb-kacheln { display: flex; gap: 10px; margin: 16px 0 6px; }
  .tb-kachel { flex: 1; border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px 14px; }
  .tb-kachel b { display: block; font-size: 24px; font-weight: 300; color: #0f2747; }
  .tb-kachel span { font-size: 10.5px; color: #5b6b82; letter-spacing: .02em; }
  h3.tb { font-size: 12px; font-weight: 600; color: #0f2747; letter-spacing: .06em; text-transform: uppercase; margin: 20px 0 8px; break-after: avoid; page-break-after: avoid; }
  table.tb tr { break-inside: avoid; page-break-inside: avoid; }
  /* Laufende Fußzeile am Ende statt der fest positionierten — die feste lief auf Seite 1 durch die letzte Zeile. */
  footer.doc { position: static; margin-top: 22px; }
  table.tb { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  table.tb td { padding: 5px 6px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  table.tb td.z { width: 54px; text-align: right; font-weight: 600; color: #0f2747; }
  table.tb td.u { width: 86px; color: #5b6b82; white-space: nowrap; }
  .tb-leer { font-size: 11.5px; color: #5b6b82; }
`;

/** Der Rumpf des PDF. Rein. */
export function tagesberichtHtml(d: TagesberichtDaten): string {
  const e = escapeHtml;
  const teil: string[] = [];
  teil.push(`<div class="tb-kurz">${tagesberichtKurz(d).map((x) => `<p>${e(x)}</p>`).join("")}</div>`);
  teil.push(`<div class="tb-kacheln">${[
    [d.erledigt, "selbst erledigt"], [d.mails, "Mails geschrieben"], [d.whatsapps, "WhatsApp-Antworten"], [d.termine, "Termine eingetragen"],
  ].map(([n, t]) => `<div class="tb-kachel"><b>${e(String(n))}</b><span>${e(String(t))}</span></div>`).join("")}</div>`);

  teil.push(`<h3 class="tb">Das habe ich getan</h3>`);
  teil.push(d.zeilen.length
    ? `<table class="tb">${d.zeilen.map((z) => `<tr><td class="z">${z.n}</td><td>${e(z.text)}</td></tr>`).join("")}</table>`
    : `<p class="tb-leer">Nichts in den letzten 24 Stunden.</p>`);

  if (d.postfach) {
    teil.push(`<h3 class="tb">Postfach</h3><table class="tb">
      <tr><td class="z">${d.postfach.rein}</td><td>Mails hereingekommen</td></tr>
      <tr><td class="z">${d.postfach.selbstBeantwortet}</td><td>davon selbst beantwortet und gesendet</td></tr>
      <tr><td class="z">${d.postfach.entwuerfeWarten}</td><td>Entwürfe der letzten 14 Tage warten auf eine Freigabe (Chefbüro › Postfach)</td></tr>
      ${d.postfach.entwuerfeAlt ? `<tr><td class="z">${d.postfach.entwuerfeAlt}</td><td>ältere Entwürfe (über 14 Tage) liegen noch dort — die sendet niemand mehr; Vorschlag: ablegen</td></tr>` : ""}</table>`);
  }

  if (d.kuendigungen) {
    const k = d.kuendigungen;
    teil.push(`<h3 class="tb">Kündigungen</h3><table class="tb">
      <tr><td class="z">${k.gebucht}</td><td>gebucht (alle Wege: Mail, WhatsApp, Formular, Team)</td></tr>
      ${k.postfachGebucht.map((x) => `<tr><td class="z">✓</td><td>${e(x.kunde)} — ${e(x.ergebnis)}</td></tr>`).join("")}
      ${k.postfachOffen.map((x) => `<tr><td class="z">offen</td><td>${e(x.kunde)} — nicht gebucht: ${e(x.grund)}</td></tr>`).join("")}</table>`);
  }

  if (d.geld) {
    teil.push(`<h3 class="tb">Geld heute</h3><table class="tb">
      <tr><td class="z">${d.geld.zahlungen}</td><td>Zahlungen, zusammen ${e(euro(d.geld.heuteCents))} (bankbestätigt)</td></tr>
      <tr><td class="z">${d.geld.nachMaraZahlungen}</td><td>davon nach einem Kontakt mit mir: ${e(euro(d.geld.nachMaraCents))}</td></tr></table>`);
  }

  teil.push(`<h3 class="tb">Wartet auf dich</h3>`);
  const wartet: string[] = [];
  if (d.karten?.entscheidungen) wartet.push(`<tr><td class="z">${d.karten.entscheidungen}</td><td>Entscheidungen im Chefbüro (etwa ${d.karten.minuten} Minuten${d.karten.aeltesteTage > 0 ? `, die älteste seit ${d.karten.aeltesteTage} ${d.karten.aeltesteTage === 1 ? "Tag" : "Tagen"}` : ""})</td></tr>`);
  if (d.postfach?.entwuerfeWarten) wartet.push(`<tr><td class="z">${d.postfach.entwuerfeWarten}</td><td>Entwürfe im Postfach</td></tr>`);
  teil.push(wartet.length ? `<table class="tb">${wartet.join("")}</table>` : `<p class="tb-leer">Gerade nichts.</p>`);

  if (d.haengt.length) {
    teil.push(`<h3 class="tb">Hier hängt es im Team</h3><table class="tb">${d.haengt.map((h) =>
      `<tr><td>${e(h.name)}</td><td>${h.termineOhneErgebnis} ${h.termineOhneErgebnis === 1 ? "Termin" : "Termine"} ohne Ergebnis · ${h.auftraegeUeberfaellig} überfällige ${h.auftraegeUeberfaellig === 1 ? "Auftrag" : "Aufträge"}</td></tr>`).join("")}</table>`);
  }

  if (d.ki) {
    teil.push(`<h3 class="tb">KI-Kosten</h3><table class="tb">
      <tr><td class="z">${e(dollar(d.ki.maraCents))}</td><td>ich heute</td></tr>
      <tr><td class="z">${e(dollar(d.ki.alleCents))}</td><td>alle KI-Dienste heute · diese Woche ${e(dollar(d.ki.wocheCents))}</td></tr></table>`);
  }

  if (d.verlauf.length) {
    teil.push(`<h3 class="tb">Verlauf (die letzten ${d.verlauf.length})</h3><table class="tb">${d.verlauf.map((h) => {
      const art = d.zeilen.find((z) => z.art === h.art)?.text ?? h.art;
      return `<tr><td class="u">${e(zeitKurz(new Date(h.am)))}</td><td>${e(String(art))}${h.kunde ? ` · ${e(h.kunde.slice(0, 50))}` : ""}${h.titel ? ` — ${e(h.titel.replace(/\s+/g, " ").slice(0, 110))}` : ""}</td></tr>`;
    }).join("")}</table>`);
  }
  return teil.join("\n");
}

/** Betreff und Text der Mail (das PDF hängt an). Rein. */
export function tagesberichtMail(d: TagesberichtDaten): { betreff: string; text: string; dateiname: string } {
  return {
    betreff: `Mein Tag, ${tagDeutsch(d.tag)}: ${d.erledigt} erledigt${d.karten?.entscheidungen ? ` · ${d.karten.entscheidungen} für dich` : ""}`,
    text: ["Guten Abend Justin,", "", "hier ist mein Tag in Kürze — der ganze Bericht hängt als PDF an.", "", ...tagesberichtKurz(d).map((x) => `· ${x}`), "", "Bis morgen", "Mara"].join("\n"),
    dateiname: `Mara_Tagesbericht_${d.tag}.pdf`,
  };
}

export async function tagesberichtPdf(d: TagesberichtDaten): Promise<Buffer> {
  return renderDocumentPdf({
    documentTitle: "Maras Tagesbericht",
    subtitle: `${zeitKurz(new Date(d.von))} bis ${zeitKurz(new Date(d.bis))} Uhr`,
    bodyHtml: tagesberichtHtml(d), zusatzCss: TB_CSS,
    markenzeile: "FIAON · intern · nur für die Geschäftsführung",
  });
}

// ── Versand ──────────────────────────────────────────────────────────────────
async function einstellungen(lauf: Lauf): Promise<{ an: boolean; tag: string; adresse: string }> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key IN (${TB_SCHLUESSEL.an}, ${TB_SCHLUESSEL.tag}, ${TB_SCHLUESSEL.adresse})`.catch(() => [])) as any[];
  const w = Object.fromEntries(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  let adresse = String(w[TB_SCHLUESSEL.adresse] ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@fiaon\.com$/.test(adresse)) {
    adresse = await import("./fiaon-lead-dossier").then((m) => m.dossierEinstellungen(lauf)).then((x) => String(x.anAdresse || "")).catch(() => "");
  }
  const anRoh = String(w[TB_SCHLUESSEL.an] ?? "").trim().toLowerCase();
  return { an: anRoh === "" ? true : ["an", "1", "true", "ja"].includes(anRoh), tag: String(w[TB_SCHLUESSEL.tag] ?? ""), adresse };
}

async function senden(d: TagesberichtDaten, an: string): Promise<{ ok: boolean; grund?: string }> {
  const m = tagesberichtMail(d);
  const pdf = await tagesberichtPdf(d);
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  const v = await eigeneMailSenden({ an, name: "Justin", betreff: m.betreff, text: m.text, anhaenge: [{ name: m.dateiname, inhalt: pdf }] });
  return v.ok ? { ok: true } : { ok: false, grund: v.grund };
}

/** Der Takt (alle 10 Minuten): sendet den Bericht einmal je Tag ab 20:00 Berliner Zeit. Wirft nie. */
export async function tagesberichtSenden(o: { jetzt?: Date; lauf?: Lauf } = {}): Promise<"gesendet" | "nicht_faellig" | "aus" | "fehler"> {
  const lauf = o.lauf ?? sqlPool;
  const jetzt = o.jetzt ?? new Date();
  try {
    const einst = await einstellungen(lauf);
    if (!einst.an) return "aus";
    const f = tagesberichtFaellig(jetzt, einst.tag);
    if (!f.faellig) return "nicht_faellig";
    if (!einst.adresse) { console.error("[MARA-TAGESBERICHT] keine Adresse — nicht gesendet."); return "fehler"; }
    await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${TB_SCHLUESSEL.tag}, '', NOW()) ON CONFLICT (key) DO NOTHING`;
    // Atomar: Nur wer den Merker vom gelesenen Stand auf „heute“ dreht, sendet (zwei Prozesse, ein Bericht).
    const [frei] = (await lauf`
      UPDATE fiaon_settings SET value = ${f.tag}, updated_at = NOW() WHERE key = ${TB_SCHLUESSEL.tag} AND COALESCE(value, '') = ${einst.tag} RETURNING key`) as any[];
    if (!frei) return "nicht_faellig";
    const d = await tagesberichtDaten({ jetzt, lauf });
    const v = await senden(d, einst.adresse);
    if (!v.ok) {
      await lauf`UPDATE fiaon_settings SET value = ${`${f.tag}#f${f.fehlversuche + 1}`}, updated_at = NOW() WHERE key = ${TB_SCHLUESSEL.tag}`.catch(() => {});
      console.error(`[MARA-TAGESBERICHT] nicht gesendet (${f.fehlversuche + 1}/${TB_VERSUCHE}): ${v.grund}`);
      return "fehler";
    }
    console.log(`[MARA-TAGESBERICHT] ${f.tag} gesendet: ${d.erledigt} erledigt.`);
    return "gesendet";
  } catch (err) {
    console.error("[MARA-TAGESBERICHT]", String((err as Error)?.message ?? err).slice(0, 200));
    return "fehler";
  }
}

/**
 * Der Lauf für den Zeitplan (stillerLauf, nurMitErgebnis): `true` schreibt eine Historienzeile — beim Versand und als Puls
 * alle 6 Stunden (so steht der Lauf auch dann nicht auf Rot, wenn der Schalter aus ist). Ein gescheiterter Versand wirft
 * (die Historie schreibt „fehler“ mit Text).
 */
let letzterPuls = 0;
export async function tagesberichtLauf(): Promise<boolean> {
  const e = await tagesberichtSenden();
  if (e === "fehler") throw new Error("Maras Tagesbericht wurde nicht gesendet (siehe Log [MARA-TAGESBERICHT]).");
  if (e === "gesendet") { letzterPuls = Date.now(); return true; }
  if (Date.now() - letzterPuls > 6 * 3600_000) { letzterPuls = Date.now(); return true; }
  return false;
}

/** Prüfversand „jetzt“ (Knopf/Lauf) — ohne Tagesmerker, nur an eine fiaon.com-Adresse. */
export async function tagesberichtPruefversand(anRoh?: string | null, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string; an?: string; erledigt?: number }> {
  try {
    const an = String(anRoh || "").trim().toLowerCase() || (await einstellungen(lauf)).adresse;
    if (!/^[^@\s]+@fiaon\.com$/.test(an)) return { ok: false, grund: "nur an eine fiaon.com-Adresse" };
    const d = await tagesberichtDaten({ lauf });
    const v = await senden(d, an);
    return v.ok ? { ok: true, an, erledigt: d.erledigt } : { ok: false, grund: v.grund };
  } catch (err) {
    return { ok: false, grund: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}
