// ═══════════════════════════════════════════════════════════════════════════
// DIE KI-KASSE IM SERVER (E-458, 29.10.2026)
//
// kassePruefen(dienst) steht in openaiFetch (fiaon-ki-pause.ts) VOR jedem
// Netzaufruf — in der einen Tür, durch die jeder KI-Aufruf geht, auch der
// Firmen-Radar und der Mail-Motor. Sagt die Kasse nein, wirft openaiFetch
// einen KiPausiertFehler der Art „kasse“: Jeder Aufrufer lässt die Arbeit
// liegen und versucht es im nächsten Takt — nie ein Ersatzsatz an Kunden
// (dieselbe sichere Linie wie die KI-Pause, E-246). Die Regeln selbst stehen
// rein in shared/fiaon-ki-kasse.ts.
//
// Der Stand kommt aus fiaon_ki_nutzung (Summe je Dienst seit 0 Uhr Berlin,
// letzte 60 Minuten), 20 Sekunden zwischengespeichert. Was dieser Prozess
// seitdem verbraucht, rechnet nutzungMerken sofort dazu (kostenNachtragen) —
// sonst rutschte eine schnelle Welle 20 Sekunden lang an jedem Deckel vorbei.
// Eine gestörte Datenbank stellt die KI nie ab: dann gilt der letzte Stand.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  KASSE_BEREICHE, KASSE_SCHLUESSEL, KASSE_TAG_USD_VORGABE, KASSE_NACHHOL_USD_VORGABE, KASSE_NACHHOL_STUNDEN, KI_AUFGABEN, KI_PREISE,
  anteileLesen, bereichFuer, bereichLabel, kasseEntscheiden, kasseTag, modellWahl, nachholSeitAus, summeCents, topfCents, usdText,
  type KasseBereich, type KasseEinstellung, type KasseStand, type KasseTopf, type KasseUrteil, type KiAufgabe,
} from "@shared/fiaon-ki-kasse";

const ZWISCHEN_MS = 20_000;
/**
 * Die Schlüssel, die die Kasse liest (Register: KI-Team › Einstellungen & Kasse) — dazu ki_pause (Ende der Pause →
 * Nachhol-Bremse). Im Klartext, damit der Register-Prüfstand den Leser findet; dieselben wie KASSE_SCHLUESSEL und
 * KI_AUFGABEN (scripts/pruef-ki-kasse.ts hält das nach).
 */
export const KASSE_LESE_SCHLUESSEL: readonly string[] = [
  "ki_kasse_an", "ki_kasse_tag_usd", "ki_kasse_anteile", "ki_kasse_nachhol_je_stunde", "ki_modell_einordnen", "ki_modell_ratgeber", "ki_pause",
];
const SCHLUESSEL = KASSE_LESE_SCHLUESSEL;

interface PauseKurz { an: boolean; seit: string | null; aufgehobenAm: string | null; art: string | null }
interface Zwischen {
  tag: string;
  /** Zeitpunkt, an dem die Abfrage begann — Nachträge davor stecken schon in den Summen. */
  am: number;
  einst: KasseEinstellung;
  jeDienst: Record<string, number>;
  stundeCents: number;
  pause: PauseKurz | null;
  werte: Record<string, string>;
}

let zwischen: Zwischen | null = null;
let laeuft: Promise<Zwischen> | null = null;
/** Verbrauch dieses Prozesses seit der letzten Abfrage (nutzungMerken → kostenNachtragen). */
let nachtraege: { am: number; dienst: string; cents: number }[] = [];

function einstellungAus(werte: Record<string, string>): KasseEinstellung {
  const zahl = (roh: string | undefined, vorgabe: number, min: number, max: number) => {
    const n = Number(String(roh ?? "").trim().replace(",", "."));
    return roh == null || String(roh).trim() === "" || !Number.isFinite(n) ? vorgabe : Math.max(min, Math.min(max, n));
  };
  return {
    an: !/^(aus|0|false|nein)$/i.test(String(werte[KASSE_SCHLUESSEL.an] ?? "an").trim()),
    tagUsd: zahl(werte[KASSE_SCHLUESSEL.tagUsd], KASSE_TAG_USD_VORGABE, 1, 500),
    anteile: anteileLesen(werte[KASSE_SCHLUESSEL.anteile]),
    nachholUsd: zahl(werte[KASSE_SCHLUESSEL.nachholUsd], KASSE_NACHHOL_USD_VORGABE, 1, 100),
  };
}

function pauseAus(roh: string | undefined): PauseKurz | null {
  if (!roh) return null;
  try {
    const j = JSON.parse(roh);
    return { an: j?.an === true, seit: j?.seit ?? null, aufgehobenAm: j?.aufgehobenAm ?? null, art: j?.art ?? null };
  } catch { return null; }
}

async function laden(): Promise<Zwischen> {
  const am = Date.now();
  const tag = kasseTag(new Date(am));
  const [dienste, stunde, werteZeilen] = await Promise.all([
    sqlPool`
      SELECT dienst, COALESCE(SUM(kosten_cents), 0)::float AS c FROM fiaon_ki_nutzung
       WHERE created_at >= (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin') GROUP BY dienst` as Promise<any[]>,
    sqlPool`SELECT COALESCE(SUM(kosten_cents), 0)::float AS c FROM fiaon_ki_nutzung WHERE created_at > NOW() - INTERVAL '60 minutes'` as Promise<any[]>,
    sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${SCHLUESSEL as string[]})` as Promise<any[]>,
  ]);
  const werte: Record<string, string> = {};
  for (const z of werteZeilen) werte[String(z.key)] = String(z.value ?? "");
  const jeDienst: Record<string, number> = {};
  for (const z of dienste) jeDienst[String(z.dienst)] = Number(z.c) || 0;
  const neu: Zwischen = { tag, am, einst: einstellungAus(werte), jeDienst, stundeCents: Number(stunde[0]?.c) || 0, pause: pauseAus(werte.ki_pause), werte };
  zwischen = neu;
  nachtraege = nachtraege.filter((n) => n.am >= am);
  return neu;
}

/** Der Stand — 20 s zwischengespeichert, beim Tageswechsel (Berlin) sofort neu. Wirft nur, wenn es nie einen gab. */
async function standHolen(frisch = false): Promise<Zwischen> {
  const z = zwischen;
  if (!frisch && z && Date.now() - z.am < ZWISCHEN_MS && z.tag === kasseTag()) return z;
  if (!laeuft) laeuft = laden().finally(() => { laeuft = null; });
  try {
    return await laeuft;
  } catch (e) {
    if (z) {
      console.error("[KI-KASSE] Stand nicht lesbar — der letzte Stand gilt:", String((e as Error)?.message ?? e).slice(0, 160));
      // 20 s merken — sonst fragte bei einer DB-Störung jeder KI-Aufruf neu.
      zwischen = { ...z, am: Date.now() };
      return zwischen;
    }
    throw e;
  }
}

/** Nach dem Speichern eines Kassen-Schalters: sofort neu lesen (sonst gälte der alte Wert noch bis zu 20 Sekunden). */
export async function kasseFrisch(): Promise<void> {
  await standHolen(true).catch(() => {});
}

/** Was nutzungMerken eben verbucht hat — sofort in den Stand, nicht erst nach 20 Sekunden. */
export function kostenNachtragen(dienst: string, cents: number): void {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) return;
  nachtraege.push({ am: Date.now(), dienst: String(dienst), cents: c });
  if (nachtraege.length > 5_000) nachtraege = nachtraege.slice(-2_000);
}

function standMitNachtraegen(z: Zwischen): KasseStand & { jeDienst: Record<string, number> } {
  const jeDienst: Record<string, number> = { ...z.jeDienst };
  let stunde = z.stundeCents;
  const jetzt = Date.now();
  const heute = z.tag === kasseTag();
  for (const n of nachtraege) {
    if (n.am < z.am) continue;
    if (heute) jeDienst[n.dienst] = (jeDienst[n.dienst] ?? 0) + n.cents;
    if (jetzt - n.am < 3_600_000) stunde += n.cents;
  }
  const heuteCents = Object.fromEntries(KASSE_BEREICHE.map((b) => [b.key, 0])) as Record<KasseBereich, number>;
  if (heute) for (const [d, c] of Object.entries(jeDienst)) heuteCents[bereichFuer(d)] += Number(c) || 0;
  return { heuteCents, stundeCents: stunde, nachholSeit: nachholSeitAus(z.pause), jeDienst };
}

// ── Bremsen merken (für Protokoll und Chefbüro) ────────────────────────────
const gemerkt = new Map<string, number>();
let bremsTag = "";
const bremsenHeute = new Map<KasseBereich, number>();

async function bremseMerken(dienst: string, u: Extract<KasseUrteil, { erlaubt: false }>): Promise<void> {
  const tag = kasseTag();
  if (tag !== bremsTag) { bremsTag = tag; bremsenHeute.clear(); }
  bremsenHeute.set(u.bereich, (bremsenHeute.get(u.bereich) ?? 0) + 1);
  // Eine Zeile je Dienst und Art höchstens alle 15 Minuten — WhatsApp fragt jede Minute neu.
  const k = `${dienst}:${u.art}`;
  if (Date.now() - (gemerkt.get(k) ?? 0) < 15 * 60_000) return;
  gemerkt.set(k, Date.now());
  console.warn(`[KI-KASSE] ${dienst} (${bereichLabel(u.bereich)}) gebremst — ${u.grund}`);
  await sqlPool`
    INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok, fehler)
    VALUES ('ki-kasse', '-', 0, 0, 0, 0, 0, FALSE, ${`${dienst} · ${u.art}: ${u.grund}`.slice(0, 300)})`.catch(() => {});
}

/**
 * Darf dieser Dienst jetzt die KI rufen? (openaiFetch fragt vor jedem Aufruf.) Ohne lesbaren Stand: ja —
 * eine gestörte Datenbank darf die KI nicht abstellen; die KI-Pause bleibt die Not-Bremse.
 */
export async function kassePruefen(dienst: string): Promise<KasseUrteil> {
  let z: Zwischen | null = null;
  try { z = await standHolen(); } catch { z = zwischen; }
  if (!z) return { erlaubt: true, bereich: bereichFuer(dienst), ueberAnteil: false };
  const u = kasseEntscheiden(z.einst, standMitNachtraegen(z), dienst);
  if (!u.erlaubt) void bremseMerken(dienst, u).catch(() => {});
  return u;
}

// ── Modell je Aufgabe (E-262 D) ────────────────────────────────────────────
/**
 * Das Modell einer Aufgabe — synchron (die Aufrufer bauen ihre Anfrage ohne Warten). Liest den zwischengespeicherten
 * Stand; vor dem ersten Laden gilt Weiche (ENV) bzw. Vorgabe. Texte an Kunden bleiben auf gpt-5.5 (shared: modellWahl).
 */
export function kiModell(aufgabe: KiAufgabe["aufgabe"]): string {
  const a = KI_AUFGABEN.find((x) => x.aufgabe === aufgabe)!;
  if (!zwischen && !laeuft) void standHolen().catch(() => {});
  return modellWahl(a, a.schluessel ? zwischen?.werte[a.schluessel] : null, process.env[a.env]);
}

// ── Die Lage fürs Chefbüro (KI-Team › Einstellungen & Kasse) ───────────────
export interface KasseLage {
  tag: string;
  an: boolean;
  tagUsd: number;
  anteile: Record<KasseTopf, number>;
  nachholUsd: number;
  summeCents: number;
  stundeCents: number;
  /** Nachhol-Bremse: seit wann und bis wann (ISO), sonst null. */
  nachhol: { seit: string; bis: string } | null;
  status: "aus" | "laeuft" | "nachhol" | "nur_antworten" | "voll";
  statusText: string;
  toepfe: { key: KasseTopf; label: string; satz: string; vorrang: boolean; cents: number; grenzeCents: number; anteil: number; gebremst: number }[];
  /** Die letzten Bremsungen (aus dem Protokoll, heute). */
  bremsen: { am: string; text: string }[];
  /** Cache-Quote heute (E-262 B): Anteil der Eingabe-Token, die OpenAI aus dem Cache las — je Dienst. */
  cache: { dienst: string; eingabe: number; gecacht: number; quote: number }[];
  modelle: { aufgabe: string; label: string; kunde: boolean; modell: string; schluessel: string | null; erlaubt: string[] }[];
  preise: Record<string, { ein: number; gecacht: number; aus: number }>;
}

export async function kasseLage(): Promise<KasseLage> {
  const z = await standHolen(true);
  const s = standMitNachtraegen(z);
  const e = z.einst;
  const summe = summeCents(s);
  const gesamt = e.tagUsd * 100;
  const reserve = topfCents(e, "reserve");
  const tag = z.tag;
  const [bremsZeilen, cacheZeilen] = await Promise.all([
    sqlPool`
      SELECT created_at, fehler FROM fiaon_ki_nutzung
       WHERE dienst = 'ki-kasse' AND created_at >= (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin')
       ORDER BY id DESC LIMIT 12`.catch(() => []) as Promise<any[]>,
    sqlPool`
      SELECT dienst, COALESCE(SUM(prompt_tokens), 0)::float AS ein, COALESCE(SUM(cached_tokens), 0)::float AS gecacht
        FROM fiaon_ki_nutzung
       WHERE ok AND created_at >= (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin') AND prompt_tokens > 0
       GROUP BY dienst ORDER BY 2 DESC LIMIT 12`.catch(() => []) as Promise<any[]>,
  ]);
  const nachholSeit = s.nachholSeit;
  const nachhol = nachholSeit ? { seit: nachholSeit, bis: new Date(new Date(nachholSeit).getTime() + KASSE_NACHHOL_STUNDEN * 3_600_000).toISOString() } : null;
  const bis = nachhol ? new Date(nachhol.bis).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "";
  const status: KasseLage["status"] = !e.an ? "aus" : summe >= gesamt ? "voll" : summe >= gesamt - reserve ? "nur_antworten" : nachhol ? "nachhol" : "laeuft";
  const statusText = {
    aus: "Kasse aus — sie misst nur und bremst nie.",
    laeuft: "Läuft — jeder Bereich arbeitet in seinem Anteil.",
    nachhol: `Nachhol-Bremse bis ${bis} Uhr — höchstens ${usdText(e.nachholUsd * 100)} je Stunde, Antworten an Menschen zuerst.`,
    nur_antworten: "Nur noch Antworten an Menschen — die Reserve ist angebrochen.",
    voll: "Tagesdeckel erreicht — ab 0 Uhr geht es weiter.",
  }[status];
  const toepfe: KasseLage["toepfe"] = KASSE_BEREICHE.map((b) => ({
    key: b.key, label: b.label, satz: b.satz, vorrang: !!b.vorrang, cents: Math.round(s.heuteCents[b.key] * 100) / 100,
    grenzeCents: topfCents(e, b.key), anteil: e.anteile[b.key], gebremst: bremsTag === tag ? bremsenHeute.get(b.key) ?? 0 : 0,
  }));
  toepfe.push({
    key: "reserve", label: "Reserve", satz: "Nur für Antworten an Menschen, wenn ihr Anteil verbraucht ist.", vorrang: false,
    cents: Math.max(0, Math.min(reserve, summe - (gesamt - reserve))), grenzeCents: reserve, anteil: e.anteile.reserve, gebremst: 0,
  });
  return {
    tag, an: e.an, tagUsd: e.tagUsd, anteile: e.anteile, nachholUsd: e.nachholUsd,
    summeCents: Math.round(summe * 100) / 100, stundeCents: Math.round(s.stundeCents * 100) / 100, nachhol, status, statusText, toepfe,
    bremsen: bremsZeilen.map((r) => ({ am: new Date(r.created_at).toISOString(), text: String(r.fehler ?? "") })),
    cache: cacheZeilen.map((r) => ({ dienst: String(r.dienst), eingabe: Number(r.ein) || 0, gecacht: Number(r.gecacht) || 0, quote: Number(r.ein) ? Math.round((Number(r.gecacht) / Number(r.ein)) * 1000) / 10 : 0 })),
    modelle: KI_AUFGABEN.map((a) => ({ aufgabe: a.aufgabe, label: a.label, kunde: a.kunde, modell: kiModell(a.aufgabe), schluessel: a.schluessel ?? null, erlaubt: [...(a.erlaubt ?? [])] })),
    preise: { ...KI_PREISE },
  };
}

// ── Die alten Deckel einmal auf echte Dollar umstellen ─────────────────────
/**
 * Bis E-458 zählten die Deckel je Dienst die Hausrechnung (≈ 3,3-mal zu billig, Plan E-458). Mit den echten
 * Preisen griffen sie sonst 3–4-mal zu früh. Einmal je Datenbank (Marke ki_kasse_umgestellt): gespeicherter
 * Wert × 3,3, höchstens die neue Notbremse — sie liegt über jedem echten Tag der letzten 30 Tage (Postfach
 * höchstens 18,89 $, WhatsApp 18,02 $, Mail-Aktion 16,22 $). Ohne gespeicherten Wert gilt die neue Vorgabe.
 */
export const UMSTELLUNG_SCHLUESSEL = "ki_kasse_umgestellt";
export const UMSTELLUNG_FAKTOR = 3.3;
export const DECKEL_NEU_USD: Readonly<Record<string, number>> = { postmeister_tag_euro: 40, mara_wa_tag_euro: 30, mara_aktion_tag_euro: 30 };
let umgestellt = false;

/** Rein: der neue Deckel aus dem alten Hauswert. */
export function deckelUmrechnen(schluessel: string, alt: unknown): number | null {
  const n = Number(String(alt ?? "").trim().replace(",", "."));
  if (alt == null || String(alt).trim() === "" || !Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n * UMSTELLUNG_FAKTOR), DECKEL_NEU_USD[schluessel] ?? Math.round(n * UMSTELLUNG_FAKTOR));
}

async function einmalUmstellen(): Promise<void> {
  if (umgestellt) return;
  const { istProduktionsdienst } = await import("./fiaon-ki-pause");
  // Nur der Produktionsdienst schreibt (wie die KI-Pause) — ein lokaler Probelauf gegen die echte Datenbank nie.
  if (!istProduktionsdienst()) return;
  const schluessel = Object.keys(DECKEL_NEU_USD);
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`) as any[];
  const alt = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  if (!alt.has("postmeister_tag_euro") && process.env.POSTMEISTER_TAG_EURO) alt.set("postmeister_tag_euro", String(process.env.POSTMEISTER_TAG_EURO));
  const protokoll: Record<string, { alt: string; neu: number }> = {};
  for (const k of schluessel) {
    const neu = deckelUmrechnen(k, alt.get(k));
    if (neu != null) protokoll[k] = { alt: alt.get(k)!, neu };
  }
  const marke = JSON.stringify({ am: new Date().toISOString(), faktor: UMSTELLUNG_FAKTOR, protokoll });
  // Erst die Marke beanspruchen (genau ein Prozess stellt um), dann umstellen.
  const r = (await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${UMSTELLUNG_SCHLUESSEL}, ${marke}, NOW())
    ON CONFLICT (key) DO NOTHING RETURNING key`) as any[];
  umgestellt = true;
  if (!r.length) return;
  for (const [k, p] of Object.entries(protokoll)) {
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${String(p.neu)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  }
  console.log(`[KI-KASSE] Deckel auf echte Dollar umgestellt: ${Object.entries(protokoll).map(([k, p]) => `${k} ${p.alt} → ${p.neu} $`).join(", ") || "nichts gespeichert — die neuen Vorgaben gelten"}.`);
}

// ── Der Takt (alle 10 Minuten) ─────────────────────────────────────────────
let letztesNachholen = 0;
/**
 * Stand auffrischen, einmal umstellen — und während der Nachhol-Bremse alle 30 Minuten nachDerPause erneut: Was die
 * Bremse liegen ließ (Postfach-Rückstand älter als zwei Tage, Kontoauszüge, Transkripte), holt so der nächste Schub.
 * Jeder Nachhol-Schritt findet seine Arbeit selbst und baut nichts doppelt (fiaon-ki-pause.ts: nachDerPause).
 */
export async function kasseTakt(): Promise<{ nachgeholt: boolean; status: string }> {
  const z = await standHolen(true);
  await einmalUmstellen().catch((e) => console.error("[KI-KASSE] Umstellung:", String((e as Error)?.message ?? e).slice(0, 200)));
  const seit = nachholSeitAus(z.pause);
  if (!seit || !z.pause) return { nachgeholt: false, status: "ruhig" };
  const ab = Math.max(letztesNachholen, new Date(seit).getTime());
  if (Date.now() - ab < 30 * 60_000) return { nachgeholt: false, status: "nachhol-bremse" };
  const m = await import("./fiaon-ki-pause");
  if (!m.istProduktionsdienst()) return { nachgeholt: false, status: "nachhol-bremse (nicht im Produktionsdienst)" };
  letztesNachholen = Date.now();
  const pause = await m.kiPauseRohLesen(true);
  if (pause.an) return { nachgeholt: false, status: "pausiert" };
  await m.nachDerPause(pause);
  return { nachgeholt: true, status: "nachhol-bremse — nächster Schub" };
}

/** Nur für Prüfstände: Zwischenspeicher, Nachträge und Marken vergessen. */
export function kasseZuruecksetzen(): void {
  zwischen = null; laeuft = null; nachtraege = []; gemerkt.clear(); bremsenHeute.clear(); bremsTag = ""; umgestellt = false; letztesNachholen = 0;
}
