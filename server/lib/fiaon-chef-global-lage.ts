// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — LESEN UND DIE WENIGEN SCHREIBWEGE (E-508, 12.11.2026)
//
// Ausfall: Offene Angebote, Nachfass-Termine und „wer wartet worauf“ standen in Listen außerhalb der Plattform.
// Das Chefbüro zeigte beim Öffnen fast nur Privatkunden-Zahlen; für FIAON Global gab es Räume je Thema
// (Angebote, Akten, Partner, Leads), aber keinen Ort, der sie zusammenzieht.
//
// Fix: EINE Antwort für die Global-Lage — Auftragswert draußen, Deckung der Fixkosten, „Wir warten auf“,
// der nächste Schritt je Mandant und der Feed der Woche. Gerechnet wird in shared/fiaon-chef-global-lage.ts;
// hier wird nur gelesen. Jede Quelle liest für sich: Scheitert eine, fehlt ihr Teil und die Antwort nennt ihn
// („luecken“) — eine Zahl, die still auf 0 fällt, wäre schlimmer als eine fehlende.
//
// Schreibwege (alle ohne Mail, ohne Geld): Notiz/Wiedervorlage, Wiedervorlage erledigt, Fixkosten-Wert,
// Gültigkeit eines Angebots verlängern. Geld kommt aus der EINEN Umsatzquelle (UMSATZ_QUELLE_SQL).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday, berlinZeitpunkt } from "./fiaon-time";
import { UMSATZ_QUELLE_SQL } from "./fiaon-umsatz-quelle";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { angebotListe, angebotLesen, verlaufAngebot } from "./fiaon-global-angebot";
import { globalMandateListe } from "./fiaon-global-mandat";
import { globalNotizSchreiben } from "./fiaon-global-bereich";
import {
  LAGE_FIXKOSTEN_SCHLUESSEL, LAGE_FIXKOSTEN_VORGABE_CENTS,
  lageAngebotAus, mandantenBauen, auftragswertRechnen, fixkostenRechnen, fixkostenPruefen, gueltigkeitPruefen, notizPruefen,
  wartetBauen, feedOrdnen, wocheWaehlen, tagPlus, tagKurz, kurzText, istTag, nachfassArt, nachfassMail, nachfassAnrede, nachfassText, NACHFASS_ART_NAME,
  type LageAngebot, type LageAkte, type LageMandant, type LageAntwort, type LagePartnerAufgabe, type LageWiedervorlage,
  type LageNotizZeile, type LageTermin, type FeedEintrag, type FeedArt, type LageBezug, type NachfassMail,
} from "@shared/fiaon-chef-global-lage";

type Stufe = "inhaber" | "geschaeftsfuehrung" | "leitung";
const RANG: Record<Stufe, number> = { inhaber: 3, geschaeftsfuehrung: 2, leitung: 1 };
export interface LageWer { id: number | null; name: string }

// ── Zeit: Berliner Tag und Uhrzeit eines Zeitpunkts (formatToParts — nie selbst rechnen) ─────────────
const BERLIN = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function berlinTagUhr(v: unknown): { am: string; tag: string; uhr: string } | null {
  const d = v instanceof Date ? v : new Date(String(v ?? ""));
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of BERLIN.formatToParts(d)) p[x.type] = x.value;
  return { am: d.toISOString(), tag: `${p.year}-${p.month}-${p.day}`, uhr: `${p.hour}:${p.minute}` };
}
const eur = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const ohnePrivat = (name: string) => name.replace(/\s*\(privat\)\s*$/i, "");
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

async function tabelleDa(name: string): Promise<boolean> {
  const [t] = (await sqlPool`SELECT to_regclass(${`public.${name}`}::text) AS tab`) as any[];
  return !!t?.tab;
}

// ── Sprungziele im Chefbüro ──────────────────────────────────────────────────
const zielAkte = (ref: string) => `/chef/global-kunden?akte=${encodeURIComponent(ref)}`;
const zielAngebot = (ref: string) => `/chef/s/global-auftraege?reiter=angebote&angebot=${encodeURIComponent(ref)}`;
const zielPartner = (id: number) => `/chef/s/geschaeftspartner?reiter=partner&partner=${id}`;

/** Die Antworten aus dem Formular einer Anfrage in einer Zeile („Beides · 250.000–1.000.000 $ · so bald wie möglich“). */
export function anfrageKurz(roh: unknown): string {
  const zeilen = String(roh ?? "").split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  const antworten = zeilen.filter((z) => z.includes(" — ")).map((z) => z.slice(z.indexOf(" — ") + 3).trim()).filter(Boolean);
  const thema = zeilen.find((z) => /^(Thema|Anliegen):/i.test(z));
  return kurzText([...(thema ? [thema.replace(/^(Thema|Anliegen):\s*/i, "")] : []), ...antworten].join(" · "), 200);
}

/** Das Thema eines Termins aus seiner Notiz — nur die Zeilen „Thema:“ / „Anliegen:“. */
export function terminThema(roh: unknown): string | null {
  const z = String(roh ?? "").split(/\r?\n/).map((x) => x.trim()).find((x) => /^(Thema|Anliegen):/i.test(x));
  return z ? kurzText(z.replace(/^(Thema|Anliegen):\s*/i, ""), 140) || null : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
interface Grundlage { angebote: LageAngebot[]; koop: { id: number; ref: string; name: string; erstelltAm: string; angenommenAm: string | null }[]; roh: Record<string, any>[]; akten: LageAkte[] }

async function grundlageLesen(): Promise<Grundlage> {
  const [roh, mandate, verbunden] = await Promise.all([
    angebotListe({ betrachterAgentId: null }),
    globalMandateListe(),
    sqlPool`SELECT ref, angebot_id FROM fiaon_global_auftraege WHERE angebot_id IS NOT NULL` as Promise<any[]>,
  ]);
  const akteZuAngebot = new Map<number, string>((verbunden as any[]).map((r) => [Number(r.angebot_id), String(r.ref)]));
  const angebote: LageAngebot[] = []; const koop: Grundlage["koop"] = [];
  for (const e of roh as Record<string, any>[]) {
    if (String(e.art) === "koop") { koop.push({ id: Number(e.id), ref: String(e.ref), name: String(e.kundeName || e.ref), erstelltAm: String(e.erstelltAm), angenommenAm: e.angenommenAm ? String(e.angenommenAm) : null }); continue; }
    const a = lageAngebotAus(e);
    if (!a) continue;
    a.name = ohnePrivat(a.name);
    if (!a.akteRef && akteZuAngebot.has(a.id)) a.akteRef = akteZuAngebot.get(a.id)!;
    angebote.push(a);
  }
  const akten = ((mandate.mandate ?? []) as Record<string, any>[]).map((m) => ({ ...m } as unknown as LageAkte));
  // Akten ohne Angebot (Kauf über die Website): der Rechnungsbetrag steht an der Bestellung.
  const mitAngebot = new Set(angebote.map((a) => a.akteRef).filter(Boolean) as string[]);
  const ohne = akten.filter((k) => !mitAngebot.has(k.ref)).map((k) => k.ref);
  if (ohne.length) {
    const betraege = (await sqlPool`SELECT ref, COALESCE(ROUND(amount_due * 100), 0)::int AS cents FROM fiaon_applications WHERE ref = ANY(${ohne})`) as any[];
    const nachRef = new Map(betraege.map((b) => [String(b.ref), Number(b.cents)]));
    for (const k of akten) if (nachRef.has(k.ref)) k.betragCents = nachRef.get(k.ref);
  }
  // E-469: gebuchte Teilzahlungen — der offene Rest einer Rechnung ist kleiner als ihr Betrag.
  const rechnungen = [...angebote.flatMap((a) => a.teile.map((t) => t.bestellRef)), ...akten.map((k) => k.ref)].filter(Boolean) as string[];
  if (rechnungen.length && (await tabelleDa("fiaon_teilzahlungen"))) {
    const teil = (await sqlPool`
      SELECT t.ref, COALESCE(SUM(t.betrag_cents), 0)::int AS cents FROM fiaon_teilzahlungen t
       WHERE t.ref = ANY(${rechnungen}) AND t.erstattung_am IS NULL GROUP BY t.ref`) as any[];
    const nachRef = new Map(teil.map((r) => [String(r.ref), Number(r.cents)]));
    for (const a of angebote) for (const t of a.teile) if (t.bestellRef && nachRef.has(t.bestellRef)) t.teilBezahltCents = nachRef.get(t.bestellRef)!;
    for (const k of akten) if (nachRef.has(k.ref)) k.teilBezahltCents = nachRef.get(k.ref);
  }
  return { angebote, koop, roh: roh as Record<string, any>[], akten };
}

/**
 * Welche Zahlung der Umsatzquelle (Alias q) gehört zu FIAON Global? Eine Bestellung mit Global-Akte, ein Teil eines Angebots
 * (z. B. das Erfolgshonorar) oder ein Global-Produkt des Katalogs ohne eigene Akte (z. B. der Fast-Track als Nachtrag).
 * Nie eine Test-Akte.
 */
const IST_GLOBAL_ZAHLUNG = `q.art = 'global'
  AND NOT EXISTS (SELECT 1 FROM fiaon_global_auftraege gt WHERE gt.ref = q.ref AND gt.ist_test_am IS NOT NULL)
  AND (EXISTS (SELECT 1 FROM fiaon_global_auftraege g WHERE g.ref = q.ref)
    OR EXISTS (SELECT 1 FROM fiaon_global_angebot_teile t WHERE t.bestell_ref = q.ref)
    OR EXISTS (SELECT 1 FROM fiaon_applications ak WHERE ak.ref = q.ref AND ${produktkategorieSql("ak")} = 'global'))`;

/** Eingang im laufenden Berliner Monat — gesamt und davon Global (aus der EINEN Umsatzquelle). */
export async function monatsEingang(): Promise<{ monatCents: number; globalCents: number }> {
  const [z] = (await sqlPool.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT COALESCE(SUM(q.cents), 0)::bigint AS monat,
           COALESCE(SUM(q.cents) FILTER (WHERE ${IST_GLOBAL_ZAHLUNG}), 0)::bigint AS global
      FROM q
     WHERE date_trunc('month', q.am AT TIME ZONE 'Europe/Berlin') = date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin')`)) as any[];
  return { monatCents: Number(z?.monat ?? 0), globalCents: Number(z?.global ?? 0) };
}

export async function fixkostenLesen(): Promise<{ cents: number; vorgabe: boolean }> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${LAGE_FIXKOSTEN_SCHLUESSEL} LIMIT 1`.catch(() => [])) as any[];
  const n = z ? Number(z.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? { cents: Math.round(n), vorgabe: false } : { cents: LAGE_FIXKOSTEN_VORGABE_CENTS, vorgabe: true };
}

async function partnerAufgabenLesen(inhaber: boolean): Promise<LagePartnerAufgabe[]> {
  const z = (await sqlPool`
    SELECT a.id, a.firma_id, f.name AS firma, a.titel, a.faellig_am::text AS faellig_am, a.created_at
      FROM fiaon_partner_aufgaben a JOIN fiaon_partner_firmen f ON f.id = a.firma_id
     WHERE a.erledigt_am IS NULL AND a.entfernt_am IS NULL AND f.archiviert_am IS NULL AND a.faellig_am IS NOT NULL
       AND (${inhaber}::boolean OR NOT COALESCE(f.vertraulich, FALSE))
     ORDER BY a.faellig_am ASC LIMIT 200`) as any[];
  return z.map((r) => ({ id: Number(r.id), firmaId: Number(r.firma_id), firma: String(r.firma || "Partner"), titel: kurzText(r.titel, 140), faelligAm: istTag(String(r.faellig_am).slice(0, 10)) ? String(r.faellig_am).slice(0, 10) : null, angelegtAm: new Date(r.created_at).toISOString() }));
}

interface NotizRoh { id: number; bezug_art: LageBezug; bezug_id: string; art: string; text: string; wiedervorlage_am: string | null; wiedervorlage_text: string | null; erledigt_am: Date | null; erstellt_von: string | null; erstellt_am: Date }
async function notizenLesen(): Promise<NotizRoh[]> {
  if (!(await tabelleDa("fiaon_global_notizen"))) return [];
  return (await sqlPool`
    SELECT id, bezug_art, bezug_id, art, text, wiedervorlage_am::text AS wiedervorlage_am, wiedervorlage_text, erledigt_am, erstellt_von, erstellt_am
      FROM fiaon_global_notizen WHERE entfernt_am IS NULL ORDER BY erstellt_am DESC LIMIT 600`) as any[] as NotizRoh[];
}
const notizZeile = (n: NotizRoh): LageNotizZeile => {
  const z = berlinTagUhr(n.erstellt_am)!;
  return { id: Number(n.id), am: z.am, tag: z.tag, uhr: z.uhr, art: String(n.art), text: String(n.text || ""), von: n.erstellt_von ?? null, wiedervorlageAm: n.wiedervorlage_am ? String(n.wiedervorlage_am).slice(0, 10) : null, wiedervorlageText: n.wiedervorlage_text ?? null, erledigt: !!n.erledigt_am };
};

async function termineLesen(jetzt: Date): Promise<LageTermin[]> {
  const z = (await sqlPool`
    SELECT t.id, t.beginn, t.quelle, ag.name AS mit, NULLIF(p.company_name, '') AS firma,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', NULLIF(p.first_name, ''), NULLIF(p.last_name, ''))), ''), NULLIF(p.contact_name, '')) AS person,
           t.notiz
      FROM fiaon_termine t
      LEFT JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.quelle IN ('global', 'gruender') AND t.status = 'gebucht' AND t.abgesagt_am IS NULL
       AND t.beginn >= ${jetzt} AND t.beginn < ${new Date(jetzt.getTime() + 10 * 86_400_000)}
     ORDER BY t.beginn ASC LIMIT 14`) as any[];
  return z.map((r) => {
    const b = berlinTagUhr(r.beginn)!;
    // Platzhalter wie „GmbH“ oder „Privatperson · …“ sind kein Firmenname — dann steht nur die Person da.
    const firma = r.firma && !/^(privatperson|gmbh|ug|selbst[aä]ndig|firma|einzelunternehmen|keine|-)\b/i.test(String(r.firma).trim()) ? String(r.firma) : null;
    const name = [r.person ? String(r.person) : null, firma].filter(Boolean).join(" · ") || String(r.firma || "Gespräch").replace(/^Privatperson\s*·\s*/i, "");
    return { id: Number(r.id), tag: b.tag, uhr: b.uhr, name, mit: r.mit ? String(r.mit) : null, thema: terminThema(r.notiz), ziel: "/chef/global-kunden" };
  });
}

// ── Der Feed: jede Quelle für sich ───────────────────────────────────────────
interface Fenster { von: Date; bis: Date }
const eintrag = (id: string, wann: unknown, art: FeedArt, wer: string, titel: string, extra: Partial<Pick<FeedEintrag, "text" | "betragCents" | "ziel" | "laut">> = {}): FeedEintrag | null => {
  const z = berlinTagUhr(wann);
  if (!z) return null;
  return { id, am: z.am, tag: z.tag, uhr: z.uhr, art, wer: wer || "—", titel, text: extra.text ?? null, betragCents: extra.betragCents ?? null, ziel: extra.ziel ?? null, laut: extra.laut ?? true };
};
const drin = (wann: unknown, f: Fenster) => { const t = new Date(String(wann ?? "")).getTime(); return Number.isFinite(t) && t >= f.von.getTime() && t < f.bis.getTime(); };

async function feedAnfragen(f: Fenster): Promise<(FeedEintrag | null)[]> {
  const z = (await sqlPool`
    SELECT a.id, a.created_at, a.name, a.firma, a.text, d.temperatur, d.kanal
      FROM fiaon_anfragen a
      LEFT JOIN LATERAL (SELECT temperatur, kanal FROM fiaon_lead_dossier d WHERE d.anfrage_id = a.id ORDER BY d.id DESC LIMIT 1) d ON TRUE
     WHERE a.art = 'global' AND NOT COALESCE(a.ist_test, FALSE) AND a.created_at >= ${f.von} AND a.created_at < ${f.bis}`) as any[];
  const temp: Record<string, string> = { heiss: "heiß", warm: "warm", kalt: "kalt" };
  const kanal: Record<string, string> = { meta: "über Meta", website: "über die Website", buchung: "mit Terminbuchung", justin: "über /justin" };
  return z.map((r) => eintrag(`anfrage:${r.id}`, r.created_at, "anfrage", [r.name, r.firma].filter(Boolean).join(" · "),
    ["Neue Anfrage", temp[String(r.temperatur)] ?? "", kanal[String(r.kanal)] ?? ""].filter(Boolean).join(" · "), { text: anfrageKurz(r.text) || null }));
}

/** Gespräche, Anrufe und Terminbuchungen aus dem Firmen-Cockpit (fiaon_firmen_log) — „was wurde gesprochen“. */
async function feedGespraeche(f: Fenster): Promise<(FeedEintrag | null)[]> {
  const z = (await sqlPool`
    SELECT l.id, l.firma_id, l.art, l.ergebnis, l.notiz, l.agent_name, l.created_at,
           COALESCE(NULLIF(fl.ansprechpartner, ''), NULLIF(fl.firma, ''), 'Interessent') AS wer, NULLIF(fl.firma, '') AS firma
      FROM fiaon_firmen_log l LEFT JOIN fiaon_firmen_leads fl ON fl.id = l.firma_id
     WHERE l.created_at >= ${f.von} AND l.created_at < ${f.bis}
       AND ((l.art = 'global' AND l.ergebnis IN ('gespraech_gefuehrt', 'gespraech_nicht_zustande', 'erzaehlt', 'termin_gebucht'))
         OR (l.art = 'anruf' AND l.ergebnis IS NOT NULL))
     ORDER BY l.created_at ASC`) as any[];
  const aus: (FeedEintrag | null)[] = [];
  const gesehen = new Set<string>();
  const still = new Map<string, { n: number; wann: Date; wer: string }>();
  // „erzaehlt“ zuerst: Derselbe Text steht oft zusätzlich am Anruf-Ergebnis — er soll nur einmal erscheinen.
  const sortiert = [...z].sort((a, b) => Number(b.ergebnis === "erzaehlt") - Number(a.ergebnis === "erzaehlt"));
  for (const r of sortiert) {
    const notiz = kurzText(r.notiz, 600);
    const zeit = berlinTagUhr(r.created_at);
    if (!zeit) continue;
    const wer = String(r.wer);
    if (r.art === "anruf") {
      const e = String(r.ergebnis);
      if (!e.startsWith("erreicht")) {
        const k = `${zeit.tag}|${r.agent_name || "Team"}`;
        const s = still.get(k) ?? { n: 0, wann: r.created_at, wer: String(r.agent_name || "Team") };
        s.n++; if (new Date(r.created_at) > new Date(s.wann)) s.wann = r.created_at;
        still.set(k, s);
        continue;
      }
      const doppelt = `${zeit.tag}|${r.firma_id}|${notiz.slice(0, 80)}`;
      if (notiz && gesehen.has(doppelt)) continue;
      gesehen.add(doppelt);
      const titel = e === "erreicht_termin" ? "Erreicht — Termin vereinbart" : e === "erreicht_interesse" ? "Erreicht — Interesse" : e === "erreicht_kein_interesse" ? "Erreicht — kein Interesse" : "Erreicht";
      aus.push(eintrag(`log:${r.id}`, r.created_at, "anruf", wer, `${titel}${r.agent_name ? ` (${r.agent_name})` : ""}`, { text: notiz || null, laut: !!notiz || e !== "erreicht_kein_interesse" }));
      continue;
    }
    if (r.ergebnis === "termin_gebucht") { aus.push(eintrag(`log:${r.id}`, r.created_at, "termin", wer, "Termin gebucht", { text: notiz || null })); continue; }
    if (r.ergebnis === "erzaehlt") {
      gesehen.add(`${zeit.tag}|${r.firma_id}|${notiz.slice(0, 80)}`);
      aus.push(eintrag(`log:${r.id}`, r.created_at, "gespraech", wer, `Im Gespräch erzählt${r.agent_name ? ` (${r.agent_name})` : ""}`, { text: notiz || null }));
      continue;
    }
    aus.push(eintrag(`log:${r.id}`, r.created_at, "gespraech", wer, r.ergebnis === "gespraech_gefuehrt" ? "Gespräch geführt" : "Gespräch kam nicht zustande", { text: notiz || null, laut: r.ergebnis === "gespraech_gefuehrt" }));
  }
  still.forEach((s, k) => { aus.push(eintrag(`still:${k}`, s.wann, "anruf", s.wer, `${mehrzahl(s.n, "Anruf", "Anrufe")} ohne Gespräch`, { laut: false })); });
  return aus;
}

/** Angebote: angelegt, geändert, angenommen (aus der Liste) und gelesen (Aufrufe des Kunden, je Tag eine Zeile). */
async function feedAngebote(f: Fenster, g: Grundlage): Promise<(FeedEintrag | null)[]> {
  const aus: (FeedEintrag | null)[] = [];
  const name = new Map<number, { name: string; ref: string }>();
  for (const a of g.angebote) {
    name.set(a.id, { name: a.name, ref: a.ref });
    const ziel = a.akteRef ? zielAkte(a.akteRef) : zielAngebot(a.ref);
    if (drin(a.erstelltAm, f)) {
      const teile = [a.gesamtCents > 0 ? `Start ${eur(a.gesamtCents)}${a.fastTrackWahlCents ? ` (+ ${eur(a.fastTrackWahlCents)} Fast-Track wählbar)` : ""}` : "", a.erfolgCents ? `Erfolgshonorar ${eur(a.erfolgCents)}` : a.erfolgCents === null ? "Erfolgshonorar nach Ergebnis" : ""].filter(Boolean);
      aus.push(eintrag(`angebot:${a.id}:neu`, a.erstelltAm, "angebot", a.name, "Angebot angelegt", { text: teile.join(" · ") || null, ziel }));
    }
    if (a.angenommenAm && drin(a.angenommenAm, f)) aus.push(eintrag(`angebot:${a.id}:ja`, a.angenommenAm, "annahme", a.name, "Angebot angenommen", { betragCents: a.gesamtCents || null, ziel }));
  }
  for (const k of g.koop) {
    name.set(k.id, { name: k.name, ref: k.ref });
    if (drin(k.erstelltAm, f)) aus.push(eintrag(`koop:${k.id}:neu`, k.erstelltAm, "partner", k.name, "Kooperationsvertrag angelegt", { ziel: zielAngebot(k.ref), laut: false }));
    if (k.angenommenAm && drin(k.angenommenAm, f)) aus.push(eintrag(`koop:${k.id}:ja`, k.angenommenAm, "partner", k.name, "Kooperationsvertrag angenommen", { ziel: zielAngebot(k.ref) }));
  }
  for (const e of g.roh) {
    if (String(e.art) === "koop") continue;
    const n = name.get(Number(e.id));
    for (const v of (Array.isArray(e.verlauf) ? e.verlauf : []) as any[]) {
      const was = String(v?.was ?? "");
      if (!was.startsWith("geändert:") || !drin(v?.am, f)) continue;
      aus.push(eintrag(`angebot:${e.id}:v:${v.am}`, v.am, "angebot", n?.name ?? String(e.ref), `Angebot ${was}`, { ziel: n ? zielAngebot(n.ref) : null, laut: false }));
    }
  }
  if (await tabelleDa("fiaon_global_angebot_aufrufe")) {
    const gelesen = (await sqlPool`
      SELECT angebot_id, to_char(am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag, COUNT(*)::int AS n, MAX(am) AS letzter
        FROM fiaon_global_angebot_aufrufe
       WHERE NOT intern AND NOT roboter AND art = 'seite' AND am >= ${f.von} AND am < ${f.bis}
       GROUP BY 1, 2`) as any[];
    const sek = new Map<string, number>();
    if (gelesen.length && (await tabelleDa("fiaon_global_angebot_lesen"))) {
      for (const r of (await sqlPool`
        SELECT angebot_id, to_char(beginn AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag, SUM(sekunden)::int AS sek
          FROM fiaon_global_angebot_lesen WHERE NOT intern AND NOT roboter AND beginn >= ${f.von} AND beginn < ${f.bis} GROUP BY 1, 2`) as any[]) sek.set(`${r.angebot_id}|${r.tag}`, Number(r.sek));
    }
    for (const r of gelesen) {
      const n = name.get(Number(r.angebot_id));
      if (!n) continue;
      const s = sek.get(`${r.angebot_id}|${r.tag}`) ?? 0;
      const dauer = s >= 60 ? ` · ${Math.round(s / 60)} Min. gelesen` : s > 0 ? ` · ${s} Sek. gelesen` : "";
      aus.push(eintrag(`gelesen:${r.angebot_id}:${r.tag}`, r.letzter, "gelesen", n.name, "Angebot geöffnet", { text: `${mehrzahl(Number(r.n), "Aufruf", "Aufrufe")}${dauer}`, ziel: zielAngebot(n.ref) }));
    }
  }
  return aus;
}

async function feedZahlungen(f: Fenster, g: Grundlage, akteName: Map<string, string>): Promise<(FeedEintrag | null)[]> {
  const z = (await sqlPool.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT q.am, q.cents, q.ref, q.person_id,
           (SELECT t.angebot_id FROM fiaon_global_angebot_teile t WHERE t.bestell_ref = q.ref ORDER BY t.nr LIMIT 1) AS angebot_id,
           (SELECT t.nr FROM fiaon_global_angebot_teile t WHERE t.bestell_ref = q.ref ORDER BY t.nr LIMIT 1) AS teil_nr,
           EXISTS (SELECT 1 FROM fiaon_global_auftraege g WHERE g.ref = q.ref) AS akte,
           (SELECT ak.pack_name FROM fiaon_applications ak WHERE ak.ref = q.ref LIMIT 1) AS produkt
      FROM q
     WHERE ${IST_GLOBAL_ZAHLUNG} AND q.am >= $1 AND q.am < $2`, [f.von, f.bis] as any)) as any[];
  const angebotName = new Map(g.angebote.map((a) => [a.id, a]));
  // Eine Zahlung ohne eigene Akte (Fast-Track als Nachtrag) gehört zur Akte derselben Person.
  const akteDerPerson = new Map<number, string>();
  for (const k of g.akten) { const pid = Number((k as any).personId); if (pid && !k.test && k.status !== "storniert") akteDerPerson.set(pid, k.ref); }
  return z.map((r) => {
    const a = r.angebot_id != null ? angebotName.get(Number(r.angebot_id)) : undefined;
    const akteRef = r.akte ? String(r.ref) : (a?.akteRef ?? akteDerPerson.get(Number(r.person_id)) ?? null);
    const wer = (akteRef ? akteName.get(akteRef) : undefined) ?? a?.name ?? "Global-Kunde";
    const nachtrag = !r.akte && r.angebot_id == null;
    const was = Number(r.teil_nr) >= 2 ? "Erfolgshonorar bezahlt" : "Zahlung eingegangen";
    return eintrag(`zahlung:${r.ref}:${new Date(r.am).getTime()}`, r.am, "zahlung", wer, was, { betragCents: Number(r.cents), text: nachtrag && r.produkt ? kurzText(r.produkt, 120) : null, ziel: akteRef ? zielAkte(akteRef) : a ? zielAngebot(a.ref) : null });
  });
}

/** Aus den Akten: Meilensteine (für den Kunden sichtbare Schritte), interne Notizen, Unterlagen und Nachrichten des Kunden. */
async function feedAkten(f: Fenster, akteName: Map<string, string>, eigeneNotizen: Set<string>): Promise<(FeedEintrag | null)[]> {
  const aus: (FeedEintrag | null)[] = [];
  const echt = Array.from(akteName.keys());
  if (!echt.length) return aus;
  const verlauf = (await sqlPool`
    SELECT id, ref, art, text, sichtbar, created_at FROM fiaon_global_verlauf
     WHERE ref = ANY(${echt}) AND created_at >= ${f.von} AND created_at < ${f.bis}
       AND ((art IN ('schritt', 'gesellschaft', 'start') AND sichtbar) OR art = 'notiz')
     ORDER BY created_at ASC`) as any[];
  const doppelt = new Set<string>();
  for (const r of verlauf) {
    const z = berlinTagUhr(r.created_at); if (!z) continue;
    const t = kurzText(r.text, 600);
    const k = `${r.ref}|${z.tag}|${t}`;
    if (doppelt.has(k)) continue;
    doppelt.add(k);
    if (r.art === "notiz") {
      // Eine Notiz aus der Global-Lage steht schon als eigene Zeile im Feed — nicht doppelt zeigen.
      if (eigeneNotizen.has(`${r.ref}|${t.slice(0, 120)}`)) continue;
      aus.push(eintrag(`verlauf:${r.id}`, r.created_at, "notiz", akteName.get(String(r.ref))!, "Notiz in der Akte", { text: t, ziel: zielAkte(String(r.ref)) }));
    } else aus.push(eintrag(`verlauf:${r.id}`, r.created_at, "meilenstein", akteName.get(String(r.ref))!, t, { ziel: zielAkte(String(r.ref)) }));
  }
  const dok = (await sqlPool`
    SELECT ref, COALESCE(NULLIF(titel, ''), NULLIF(art, ''), dateiname, 'Dokument') AS was, created_at FROM fiaon_global_dokumente
     WHERE ref = ANY(${echt}) AND von = 'kunde' AND geloescht_am IS NULL AND created_at >= ${f.von} AND created_at < ${f.bis}
     ORDER BY created_at ASC`) as any[];
  const jeTag = new Map<string, { ref: string; wann: Date; was: string[] }>();
  for (const r of dok) {
    const z = berlinTagUhr(r.created_at); if (!z) continue;
    const k = `${r.ref}|${z.tag}`;
    const s: { ref: string; wann: Date; was: string[] } = jeTag.get(k) ?? { ref: String(r.ref), wann: r.created_at, was: [] };
    s.was.push(String(r.was)); s.wann = r.created_at;
    jeTag.set(k, s);
  }
  jeTag.forEach((s, k) => { aus.push(eintrag(`dok:${k}`, s.wann, "unterlage", akteName.get(s.ref)!, s.was.length === 1 ? "Unterlage eingegangen" : `${s.was.length} Unterlagen eingegangen`, { text: kurzText(s.was.join(", "), 200), ziel: zielAkte(s.ref) })); });
  const nachr = (await sqlPool`
    SELECT id, ref, text, created_at FROM fiaon_global_nachrichten
     WHERE ref = ANY(${echt}) AND von = 'kunde' AND created_at >= ${f.von} AND created_at < ${f.bis}`) as any[];
  for (const r of nachr) aus.push(eintrag(`nachricht:${r.id}`, r.created_at, "nachricht", akteName.get(String(r.ref))!, "Nachricht im Portal", { text: kurzText(r.text, 400), ziel: zielAkte(String(r.ref)) }));
  return aus;
}

/** Post mit Interessenten: Antworten (wichtig), persönliche Mails (leise) und die Automatik-Mails als eine Zeile je Tag. */
async function feedLeadPost(f: Fenster): Promise<(FeedEintrag | null)[]> {
  if (!(await tabelleDa("fiaon_lead_post"))) return [];
  const z = (await sqlPool`
    SELECT lp.id, lp.richtung, lp.art, lp.betreff, lp.auszug, lp.am, COALESCE(NULLIF(a.name, ''), NULLIF(a.firma, ''), 'Interessent') AS wer
      FROM fiaon_lead_post lp LEFT JOIN fiaon_anfragen a ON a.id = lp.anfrage_id
     WHERE lp.am >= ${f.von} AND lp.am < ${f.bis} ORDER BY lp.am ASC`) as any[];
  const aus: (FeedEintrag | null)[] = [];
  const auto = new Map<string, { wann: Date; willkommen: number; nachfass: number }>();
  for (const r of z) {
    if (r.richtung === "ein" && r.art === "antwort") { aus.push(eintrag(`post:${r.id}`, r.am, "antwort", String(r.wer), "Antwort per Mail", { text: kurzText([r.betreff, r.auszug].filter(Boolean).join(" — "), 320) })); continue; }
    if (r.richtung === "aus" && r.art === "von_hand") { aus.push(eintrag(`post:${r.id}`, r.am, "mail", String(r.wer), "Persönliche Mail gesendet", { text: kurzText(r.betreff, 160) || null, laut: false })); continue; }
    if (r.richtung !== "aus") continue;
    const tag = berlinTagUhr(r.am)?.tag; if (!tag) continue;
    const s = auto.get(tag) ?? { wann: r.am, willkommen: 0, nachfass: 0 };
    if (r.art === "willkommen") s.willkommen++; else s.nachfass++;
    s.wann = r.am; auto.set(tag, s);
  }
  auto.forEach((s, tag) => { aus.push(eintrag(`post:auto:${tag}`, s.wann, "mail", "Automatik", "Mails an Interessenten", { text: [s.willkommen ? `${s.willkommen}× Willkommen` : "", s.nachfass ? `${s.nachfass}× Nachfassen` : ""].filter(Boolean).join(" · "), laut: false })); });
  return aus;
}

async function feedPartner(f: Fenster, inhaber: boolean): Promise<(FeedEintrag | null)[]> {
  const z = (await sqlPool`
    SELECT v.id, v.firma_id, v.typ, v.titel, v.text, v.created_at, fi.name AS firma
      FROM fiaon_partner_verlauf v JOIN fiaon_partner_firmen fi ON fi.id = v.firma_id
     WHERE v.entfernt_am IS NULL AND v.typ <> 'aufgabe' AND v.created_at >= ${f.von} AND v.created_at < ${f.bis}
       AND (${inhaber}::boolean OR NOT COALESCE(fi.vertraulich, FALSE))`) as any[];
  const typ: Record<string, string> = { email: "Mail", anruf: "Anruf", vereinbarung: "Vereinbarung", vertrag: "Vertrag", notiz: "Notiz" };
  return z.map((r) => eintrag(`partner:${r.id}`, r.created_at, "partner", String(r.firma), `${typ[String(r.typ)] ?? "Eintrag"}: ${kurzText(r.titel, 140)}`,
    { text: kurzText(r.text, 280) || null, ziel: zielPartner(Number(r.firma_id)), laut: r.typ === "vereinbarung" || r.typ === "vertrag" }));
}

/** Liest einen Teil; scheitert er, fehlt nur dieser Teil — und die Antwort nennt ihn. */
async function teil<T>(name: string, luecken: string[], fn: () => Promise<T>, leer: T): Promise<T> {
  try { return await fn(); }
  catch (e) { console.error(`[GLOBAL-LAGE] ${name}:`, String((e as any)?.message ?? e).slice(0, 220)); luecken.push(name); return leer; }
}

export async function globalLageLesen(opts: { stufe: Stufe; woche?: unknown; jetzt?: Date }): Promise<LageAntwort> {
  const jetzt = opts.jetzt ?? new Date();
  const heute = berlinToday(jetzt);
  const inhaber = opts.stufe === "inhaber";
  const luecken: string[] = [];
  const g = await teil<Grundlage>("Angebote und Akten", luecken, grundlageLesen, { angebote: [], koop: [], roh: [], akten: [] });
  const mandanten = mandantenBauen(g.angebote, g.akten, heute);
  const auftragswert = auftragswertRechnen(mandanten);

  const akteName = new Map<string, string>();
  for (const k of g.akten) if (!k.test) akteName.set(k.ref, k.llc || k.firma || k.kunde || k.ref);
  for (const m of mandanten) if (m.akteRef) akteName.set(m.akteRef, m.name);

  const [aufgaben, notizen, termine] = await Promise.all([
    teil("Partner-Aufgaben", luecken, () => partnerAufgabenLesen(inhaber), [] as LagePartnerAufgabe[]),
    teil("Notizen", luecken, notizenLesen, [] as NotizRoh[]),
    teil("Termine", luecken, () => termineLesen(jetzt), [] as LageTermin[]),
  ]);

  // Namen für Wiedervorlagen ohne Mandant (Anfrage, Partner).
  const mandantName = new Map(mandanten.map((m) => [m.schluessel, m.name]));
  const angebotName = new Map(g.angebote.map((a) => [String(a.id), a.name]));
  const offeneWv = notizen.filter((n) => n.wiedervorlage_am && !n.erledigt_am);
  const anfrageIds = offeneWv.filter((n) => n.bezug_art === "anfrage").map((n) => Number(n.bezug_id)).filter(Number.isFinite);
  const partnerIds = offeneWv.filter((n) => n.bezug_art === "partner").map((n) => Number(n.bezug_id)).filter(Number.isFinite);
  const fremd = await teil("Namen der Wiedervorlagen", luecken, async () => {
    const m = new Map<string, string>();
    if (anfrageIds.length) for (const r of (await sqlPool`SELECT id, COALESCE(NULLIF(name, ''), NULLIF(firma, ''), 'Interessent') AS n FROM fiaon_anfragen WHERE id = ANY(${anfrageIds}::int[])`) as any[]) m.set(`anfrage:${r.id}`, String(r.n));
    if (partnerIds.length) for (const r of (await sqlPool`SELECT id, name FROM fiaon_partner_firmen WHERE id = ANY(${partnerIds}::int[])`) as any[]) m.set(`partner:${r.id}`, String(r.name));
    return m;
  }, new Map<string, string>());
  const wv: LageWiedervorlage[] = offeneWv.map((n) => ({
    id: Number(n.id), bezugArt: n.bezug_art, bezugId: String(n.bezug_id), am: String(n.wiedervorlage_am).slice(0, 10),
    text: n.wiedervorlage_text ?? null, notiz: n.text || null, angelegtAm: new Date(n.erstellt_am).toISOString(),
    name: n.bezug_art === "frei" ? "Allgemein"
      : n.bezug_art === "akte" ? (akteName.get(String(n.bezug_id)) ?? String(n.bezug_id))
      : n.bezug_art === "angebot" ? (mandantName.get(`angebot:${n.bezug_id}`) ?? angebotName.get(String(n.bezug_id)) ?? `Angebot ${n.bezug_id}`)
      : (fremd.get(`${n.bezug_art}:${n.bezug_id}`) ?? (n.bezug_art === "partner" ? "Partner" : "Interessent")),
  }));
  const zielFuer = (x: { mandant?: LageMandant; partnerId?: number; bezug?: { art: LageBezug; id: string } }): string | null => {
    if (x.mandant) return x.mandant.akteRef ? zielAkte(x.mandant.akteRef) : x.mandant.angebotRef ? zielAngebot(x.mandant.angebotRef) : null;
    if (x.partnerId) return zielPartner(x.partnerId);
    if (x.bezug?.art === "akte") return zielAkte(x.bezug.id);
    if (x.bezug?.art === "partner" && Number(x.bezug.id)) return zielPartner(Number(x.bezug.id));
    if (x.bezug?.art === "angebot") { const a = g.angebote.find((y) => String(y.id) === x.bezug!.id); return a ? (a.akteRef ? zielAkte(a.akteRef) : zielAngebot(a.ref)) : null; }
    return null;
  };
  const { wartet, partner } = wartetBauen(mandanten, aufgaben, wv, heute, zielFuer);

  // Fixkosten: nur ab Geschäftsführung (wie der Raum „Geld“).
  let fixkosten: LageAntwort["fixkosten"] = null;
  if (RANG[opts.stufe] >= RANG.geschaeftsfuehrung) {
    fixkosten = await teil("Fixkosten", luecken, async () => {
      const [fix, eingang] = await Promise.all([fixkostenLesen(), monatsEingang()]);
      return fixkostenRechnen({ fixCents: fix.cents, vorgabe: fix.vorgabe, monatCents: eingang.monatCents, globalMonatCents: eingang.globalCents, zugesagtCents: auftragswert.zugesagtCents, offen: auftragswert.offen, heute });
    }, null);
  }

  // Der Feed der gewählten Woche.
  const montag = wocheWaehlen(opts.woche, heute);
  const f: Fenster = { von: berlinZeitpunkt(montag, 0), bis: berlinZeitpunkt(tagPlus(montag, 7), 0) };
  const eigene: (FeedEintrag | null)[] = [];
  const eigeneSchluessel = new Set<string>();
  for (const n of notizen) {
    if (n.bezug_art === "akte" && n.text) eigeneSchluessel.add(`${n.bezug_id}|${kurzText(n.text, 600).slice(0, 120)}`);
    if (!drin(n.erstellt_am, f)) continue;
    const wer = n.bezug_art === "frei" ? "Allgemein" : n.bezug_art === "akte" ? (akteName.get(String(n.bezug_id)) ?? String(n.bezug_id))
      : n.bezug_art === "angebot" ? (mandantName.get(`angebot:${n.bezug_id}`) ?? angebotName.get(String(n.bezug_id)) ?? "Angebot") : (fremd.get(`${n.bezug_art}:${n.bezug_id}`) ?? "—");
    const ziel = zielFuer({ bezug: { art: n.bezug_art, id: String(n.bezug_id) } });
    const wvSatz = n.wiedervorlage_am ? `Wiedervorlage ${tagKurz(String(n.wiedervorlage_am).slice(0, 10))}${n.wiedervorlage_text ? `: ${n.wiedervorlage_text}` : ""}` : "";
    if (n.art === "wiedervorlage") eigene.push(eintrag(`notiz:${n.id}`, n.erstellt_am, "notiz", wer, "Wiedervorlage gesetzt", { text: wvSatz, ziel, laut: false }));
    else eigene.push(eintrag(`notiz:${n.id}`, n.erstellt_am, n.art === "gespraech" ? "gespraech" : "notiz", wer, `${n.art === "gespraech" ? "Gesprächsnotiz" : "Notiz"}${n.erstellt_von ? ` (${n.erstellt_von})` : ""}`, { text: [kurzText(n.text, 600), wvSatz].filter(Boolean).join(" — "), ziel }));
  }
  const quellen = await Promise.all([
    teil("Feed: Anfragen", luecken, () => feedAnfragen(f), []),
    teil("Feed: Gespräche", luecken, () => feedGespraeche(f), []),
    teil("Feed: Angebote", luecken, () => feedAngebote(f, g), []),
    teil("Feed: Zahlungen", luecken, () => feedZahlungen(f, g, akteName), []),
    teil("Feed: Akten", luecken, () => feedAkten(f, akteName, eigeneSchluessel), []),
    teil("Feed: Post", luecken, () => feedLeadPost(f), []),
    teil("Feed: Partner", luecken, () => feedPartner(f, inhaber), []),
  ]);
  const woche = feedOrdnen([...eigene, ...quellen.flat()].filter(Boolean) as FeedEintrag[], montag, heute);

  // Notizen je Mandant (die letzten drei) — ein Mandant mit Akte trägt auch die Notizen aus der Zeit als Angebot.
  const notizenJe = new Map<string, LageNotizZeile[]>();
  for (const n of notizen) {
    const k = `${n.bezug_art}:${n.bezug_id}`;
    const l = notizenJe.get(k) ?? [];
    if (l.length < 6) { l.push(notizZeile(n)); notizenJe.set(k, l); }
  }
  return {
    ok: true, stand: jetzt.toISOString(), heute, stufe: opts.stufe, auftragswert, fixkosten, wartet, partner,
    mandanten: mandanten.map((m) => ({
      ...m,
      // Nachfass-Entwurf: nur für Angebote, die noch offen oder gerade abgelaufen sind — und nur der Inhaber legt in js@ ab.
      nachfass: inhaber && m.angebotId != null ? nachfassArt(m, heute) : null,
      ziele: { akte: m.akteRef ? zielAkte(m.akteRef) : null, angebot: m.angebotRef ? zielAngebot(m.angebotRef) : null },
      notizen: [...(notizenJe.get(m.schluessel) ?? []), ...(m.akteRef && m.angebotId != null ? notizenJe.get(`angebot:${m.angebotId}`) ?? [] : [])]
        .sort((a, b) => b.am.localeCompare(a.am)).slice(0, 3),
    })),
    termine, woche, luecken,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHREIBEN — nichts davon sendet eine Mail oder bewegt Geld
// ═══════════════════════════════════════════════════════════════════════════
type Erg<T = {}> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const nein = (status: number, error: string) => ({ ok: false as const, status, error });

/** Eine Gesprächsnotiz und/oder Wiedervorlage festhalten. Bei einer Akte steht die Notiz zusätzlich intern im Verlauf der Akte. */
export async function lageNotizSchreiben(ein: unknown, wer: LageWer): Promise<Erg<{ id: number; meldung: string }>> {
  const heute = berlinToday();
  const p = notizPruefen(ein, heute);
  if (!p.ok) return nein(400, p.error);
  const w = p.wert;
  if (!(await tabelleDa("fiaon_global_notizen"))) return nein(503, "Die Notizen sind noch nicht eingerichtet — bitte in einer Minute noch einmal.");
  // Der Bezug muss es geben — eine Notiz an einem Angebot, das es nicht gibt, fände niemand wieder.
  if (w.bezugArt === "angebot") { if (!(await angebotLesen({ id: Number(w.bezugId) }))) return nein(404, "Dieses Angebot gibt es nicht."); }
  else if (w.bezugArt === "akte") { const [a] = (await sqlPool`SELECT 1 FROM fiaon_global_auftraege WHERE ref = ${w.bezugId} LIMIT 1`) as any[]; if (!a) return nein(404, "Diese Akte gibt es nicht."); }
  else if (w.bezugArt === "anfrage") { const [a] = (await sqlPool`SELECT 1 FROM fiaon_anfragen WHERE id = ${Number(w.bezugId) || 0} AND art = 'global' LIMIT 1`) as any[]; if (!a) return nein(404, "Diese Anfrage gibt es nicht."); }
  else if (w.bezugArt === "partner") { const [a] = (await sqlPool`SELECT 1 FROM fiaon_partner_firmen WHERE id = ${Number(w.bezugId) || 0} LIMIT 1`) as any[]; if (!a) return nein(404, "Diesen Partner gibt es nicht."); }
  const [z] = (await sqlPool`
    INSERT INTO fiaon_global_notizen (bezug_art, bezug_id, art, text, wiedervorlage_am, wiedervorlage_text, erstellt_von, erstellt_agent_id)
    VALUES (${w.bezugArt}, ${w.bezugId}, ${w.art}, ${w.text}, ${w.wiedervorlageAm}, ${w.wiedervorlageText}, ${wer.name}, ${wer.id})
    RETURNING id`) as any[];
  // Dieselbe Wahrheit in den bestehenden Räumen: die Akte bekommt die Notiz intern in ihren Verlauf, das Angebot eine Zeile.
  if (w.text && w.bezugArt === "akte") {
    await globalNotizSchreiben(w.bezugId, { text: w.text.slice(0, 2000), sichtbar: false }, { id: wer.id ?? 0, name: wer.name })
      .catch((e) => console.error("[GLOBAL-LAGE] Notiz in den Verlauf der Akte:", String(e).slice(0, 160)));
  } else if (w.bezugArt === "angebot") {
    const was = w.text ? `${w.art === "gespraech" ? "Gesprächsnotiz" : "Notiz"}: ${kurzText(w.text, 160)}` : `Wiedervorlage ${tagKurz(w.wiedervorlageAm)}${w.wiedervorlageText ? `: ${w.wiedervorlageText}` : ""}`;
    await verlaufAngebot(Number(w.bezugId), wer.name, was);
  }
  const teile = [w.text ? "Notiz gespeichert" : "", w.wiedervorlageAm ? `Wiedervorlage am ${tagKurz(w.wiedervorlageAm)}` : ""].filter(Boolean);
  // Endet die Meldung mit einem Datum („15.11.“), bekommt sie keinen zweiten Punkt.
  const satz = teile.join(" · ");
  return { ok: true, id: Number(z.id), meldung: satz.endsWith(".") ? satz : `${satz}.` };
}

export async function lageWiedervorlageErledigen(id: number, wer: LageWer): Promise<Erg<{ meldung: string }>> {
  if (!Number.isInteger(id) || id <= 0) return nein(400, "Die Wiedervorlage ist nicht lesbar.");
  if (!(await tabelleDa("fiaon_global_notizen"))) return nein(503, "Die Notizen sind noch nicht eingerichtet.");
  const z = (await sqlPool`
    UPDATE fiaon_global_notizen SET erledigt_am = NOW(), erledigt_von = ${wer.name}
     WHERE id = ${id} AND entfernt_am IS NULL AND erledigt_am IS NULL AND wiedervorlage_am IS NOT NULL RETURNING id`) as any[];
  return z.length ? { ok: true, meldung: "Wiedervorlage erledigt." } : nein(409, "Diese Wiedervorlage ist schon erledigt oder gibt es nicht.");
}

export async function lageFixkostenSetzen(roh: unknown): Promise<Erg<{ cents: number; meldung: string }>> {
  const p = fixkostenPruefen(roh);
  if (!p.ok) return nein(400, p.error);
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${LAGE_FIXKOSTEN_SCHLUESSEL}, ${String(p.cents)}, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  return { ok: true, cents: p.cents, meldung: `Fixkosten je Monat: ${eur(p.cents)}.` };
}

/**
 * „Gültig bis“ eines Angebots neu setzen — auch für ein gerade abgelaufenes (dann ist es wieder offen). Ändert nur das Datum:
 * kein Preis, kein Text, keine Mail. Angenommene und zurückgezogene Angebote fasst es nie an (Bedingung steht im UPDATE).
 */
export async function lageGueltigkeitSetzen(id: number, neuBisRoh: unknown, wer: LageWer): Promise<Erg<{ gueltigBis: string; linkBleibtBis: string | null; meldung: string }>> {
  if (!Number.isInteger(id) || id <= 0) return nein(400, "Das Angebot ist nicht lesbar.");
  const z = await angebotLesen({ id });
  if (!z) return nein(404, "Dieses Angebot gibt es nicht.");
  const heute = berlinToday();
  const altBis = z.gueltig_bis instanceof Date ? berlinToday(z.gueltig_bis) : (String(z.gueltig_bis ?? "").slice(0, 10) || null);
  const p = gueltigkeitPruefen({ status: String(z.status), altBis, neuBis: neuBisRoh, heute });
  if (!p.ok) return nein(409, p.error);
  const ge = (await sqlPool`
    UPDATE fiaon_global_angebote SET gueltig_bis = ${p.neuBis}::date, status = 'offen', updated_at = NOW()
     WHERE id = ${id} AND status IN ('offen', 'abgelaufen') AND angenommen_am IS NULL AND zurueckgezogen_am IS NULL RETURNING id`) as any[];
  if (!ge.length) return nein(409, "Das Angebot ließ sich nicht verlängern — es ist inzwischen angenommen oder zurückgezogen.");
  await verlaufAngebot(id, wer.name, `geändert: Gültigkeit (bis ${tagKurz(p.neuBis)}${altBis ? `, vorher ${tagKurz(altBis)}` : ""})`);
  const link = p.linkBleibtBis && p.linkBleibtBis >= p.neuBis ? "Der schon verschickte Link bleibt gültig."
    : p.linkBleibtBis ? `Der schon verschickte Link gilt noch bis ${tagKurz(p.linkBleibtBis)} — danach bitte den neuen Link schicken.`
    : "Der alte Link ist abgelaufen — bitte den neuen Link schicken.";
  return { ok: true, gueltigBis: p.neuBis, linkBleibtBis: p.linkBleibtBis, meldung: `Gültig bis ${tagKurz(p.neuBis)}. ${link}` };
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHFASSEN — eine persönliche Mail als ENTWURF in js@ (E-508 Scheibe 3). Gesendet wird hier nie.
// ═══════════════════════════════════════════════════════════════════════════
const NACHFASS_POSTFACH = "js@fiaon.com";
/** Legt den Entwurf ab und gibt seine Kennung zurück — übergebbar, damit der Prüfstand ohne Gmail läuft. */
export type EntwurfAblegen = (m: { vonName: string; an: string; betreff: string; text: string; html: string }) => Promise<string>;

async function nachfassBauen(id: number): Promise<Erg<{ mail: NachfassMail; an: string; name: string }>> {
  if (!Number.isInteger(id) || id <= 0) return nein(400, "Das Angebot ist nicht lesbar.");
  const heute = berlinToday();
  const g = await grundlageLesen();
  const m = mandantenBauen(g.angebote, g.akten, heute).find((x) => x.angebotId === id);
  if (!m) return nein(404, "Zu diesem Angebot gibt es keinen Mandanten in der Lage.");
  const art = nachfassArt(m, heute);
  if (!art) return nein(409, "Nachfassen gibt es nur, solange das Angebot offen oder gerade abgelaufen ist.");
  const kunde = ((g.roh.find((e) => Number(e.id) === id)?.kunde ?? {}) as Record<string, any>);
  const an = String(kunde.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(an)) return nein(409, "Am Angebot steht keine E-Mail-Adresse — bitte im Angebot nachtragen.");
  // Bei einer Firma schreiben wir der Person, die sie vertritt.
  const person = kunde.vertretung && typeof kunde.vertretung === "object" ? kunde.vertretung : kunde;
  const mail = nachfassMail({ art, anrede: nachfassAnrede(person), link: art === "abgelaufen" ? null : m.link, gueltigBis: m.gueltigBis });
  // Die Wand: keine Lücke im Text, keine verbotene Aussage — sonst entsteht kein Entwurf.
  const klartext = nachfassText(mail);
  const { platzhalterWache } = await import("@shared/fiaon-global-lead-texte");
  const { globalWortPruefen } = await import("@shared/fiaon-global-wortregeln");
  const luecken = platzhalterWache(klartext); const funde = globalWortPruefen(klartext);
  if (luecken.length || funde.length) {
    console.error("[GLOBAL-LAGE] Nachfass-Text hält die Wand nicht:", luecken.join(", "), funde.map((f) => f.treffer).join(", "));
    return nein(422, "Der Text hält die Wortregeln nicht ein — es wurde kein Entwurf angelegt.");
  }
  return { ok: true, mail, an, name: m.name };
}

/** Was im Entwurf stehen würde — legt nichts an. */
export async function lageNachfassVorschau(id: number): Promise<Erg<{ an: string; betreff: string; text: string; artName: string; postfach: string }>> {
  const b = await nachfassBauen(id);
  if (!b.ok) return b;
  return { ok: true, an: b.an, betreff: b.mail.betreff, text: nachfassText(b.mail), artName: NACHFASS_ART_NAME[b.mail.art], postfach: NACHFASS_POSTFACH };
}

/** Legt die Nachfass-Mail als Entwurf in js@ ab (mit der echten Signatur aus Gmail) und vermerkt es am Angebot. Sendet nie. */
export async function lageNachfassAblegen(id: number, wer: LageWer, opt: { ablegen?: EntwurfAblegen } = {}): Promise<Erg<{ meldung: string; entwurfId: string }>> {
  const b = await nachfassBauen(id);
  if (!b.ok) return b;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let entwurfId = "";
  try {
    if (opt.ablegen) {
      entwurfId = await opt.ablegen({ vonName: "Justin Schwarzott", an: b.an, betreff: b.mail.betreff, text: nachfassText(b.mail), html: `<div>${esc(nachfassText(b.mail)).replace(/\n/g, "<br>")}</div>` });
    } else {
      const { gmailBereit, neueMailEntwurf } = await import("./fiaon-gmail");
      if (!gmailBereit()) return nein(503, "Gmail ist auf diesem Server nicht eingerichtet — der Text steht in der Vorschau zum Kopieren.");
      const { radarAbsenderFuer } = await import("./fiaon-radar");
      const a = await radarAbsenderFuer(NACHFASS_POSTFACH).catch(() => null);
      if (!a) return nein(503, "Die Signatur aus Gmail ließ sich nicht lesen — der Text steht in der Vorschau zum Kopieren.");
      const { persoenlicheMailHtml, persoenlicheMailText } = await import("./fiaon-signatur");
      const teile = { anrede: b.mail.anrede, absaetze: b.mail.absaetze, frage: b.mail.frage, gruss: b.mail.gruss, signatur: { html: a.signaturHtml, text: a.signaturText } };
      let html = persoenlicheMailHtml(teile);
      // Der Link steht im Satz — im HTML wird er anklickbar (er kommt genau einmal vor).
      const link = b.mail.absaetze.map((x) => x.match(/https:\/\/\S+/)?.[0]).find(Boolean);
      if (link) html = html.replace(esc(link), `<a href="${esc(link)}">${esc(link)}</a>`);
      entwurfId = await neueMailEntwurf(NACHFASS_POSTFACH, { vonName: a.name, an: b.an, betreff: b.mail.betreff, text: persoenlicheMailText(teile), html });
    }
  } catch (e) {
    console.error("[GLOBAL-LAGE] Nachfass-Entwurf:", String((e as any)?.message ?? e).slice(0, 200));
    return nein(502, "Der Entwurf ließ sich nicht anlegen — der Text steht in der Vorschau zum Kopieren.");
  }
  if (!entwurfId) return nein(502, "Gmail hat keinen Entwurf zurückgemeldet — bitte im Postfach nachsehen.");
  const vermerk = `Nachfass-Mail als Entwurf in js@ abgelegt (${NACHFASS_ART_NAME[b.mail.art]}).`;
  if (await tabelleDa("fiaon_global_notizen")) {
    await sqlPool`INSERT INTO fiaon_global_notizen (bezug_art, bezug_id, art, text, erstellt_von, erstellt_agent_id) VALUES ('angebot', ${String(id)}, 'notiz', ${vermerk}, ${wer.name}, ${wer.id})`
      .catch((e) => console.error("[GLOBAL-LAGE] Vermerk zum Nachfass-Entwurf:", String(e).slice(0, 160)));
  }
  await verlaufAngebot(id, wer.name, "Nachfass-Mail als Entwurf in js@ abgelegt");
  return { ok: true, entwurfId, meldung: `Der Entwurf an ${b.an} liegt in js@ unter „Entwürfe“. Bitte lesen, wenn nötig anpassen und selbst senden.` };
}
