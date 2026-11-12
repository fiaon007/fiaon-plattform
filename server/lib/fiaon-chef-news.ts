// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — NEWS: Abruf, Kurzfassung, Anzeige (E-508 Scheibe 2, 12.11.2026)
//
// Ausfall: Was sich bei US-Notenbank, EZB, IRS, FinCEN, USCIS und den Aufsichten in Österreich und der Schweiz
// ändert, musste jemand von Hand zusammensuchen — im Chefbüro stand davon nichts.
//
// Fix: Der Lauf „chef_news“ holt die amtlichen Feeds ab (shared/fiaon-chef-news.ts nennt jede Quelle), legt je
// Meldung eine Zeile in fiaon_global_news an und schreibt den EZB-Referenzkurs EUR/USD mit. Danach bekommt jede
// neue Meldung von der KI eine kurze deutsche Fassung und einen Satz „Was heißt das für unsere Mandanten“.
//
// KI: nur über openaiFetch (Weiche, Pause, KI-Kasse — der Dienst „chef-news“ zahlt aus dem Topf „Haus“), eigener
// Tagesdeckel in Dollar und ein Schalter. Fällt die KI aus, bleibt die Meldung im Original stehen und die Seite
// sagt es. In die KI gehen nur öffentliche Meldungen — nie Kundendaten. Nichts hiervon geht an Kunden.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { openaiFetch, istKiPause, kiLesenMoeglich, kiPausiert, kiPauseLesen, kiPauseMeldung, aktiverAnbieter } from "./fiaon-ki-pause";
import {
  NEWS_QUELLEN, NEWS_QUELLE_NACH_KEY, NEWS_EZB_KURS_URL, NEWS_MAX_ALTER_TAGE, NEWS_ANZEIGE_MAX, NEWS_KI_JE_LAUF,
  NEWS_KI_VERSUCHE_MAX, NEWS_SCHLUESSEL, NEWS_KI_ANWEISUNG, feedLesen, postenPasst, ezbKursLesen, kursStand, newsKiLesen, newsKiEingabe,
  newsEinstellungPruefen, newsDeckelAus, type NewsAntwort, type NewsMeldung, type NewsThema, type KursTag, type NewsEinstellungen,
} from "@shared/fiaon-chef-news";

const DIENST = "chef-news";
const MODELL = () => process.env.CHEF_NEWS_MODELL || "gpt-4.1-mini";
/** Zwischen zwei Abrufen von Hand liegen mindestens so viele Minuten — die Quellen sind Behörden, kein Dauerfeuer. */
const ABRUF_PAUSE_MIN = 10;

const BERLIN_TAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
const berlinTag = (d: Date) => { const p: Record<string, string> = {}; for (const x of BERLIN_TAG.formatToParts(d)) p[x.type] = x.value; return `${p.year}-${p.month}-${p.day}`; };

async function tabelleDa(): Promise<boolean> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_news') AS tab`) as any[];
  return !!t?.tab;
}
async function einstellung(key: string): Promise<string | null> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  return z ? String(z.value) : null;
}
async function einstellungSetzen(key: string, wert: string): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Holt eine Adresse als Text — kurzer Zeitrahmen, neutrale Kennung, höchstens 2 MB. */
export type Holen = (url: string) => Promise<string>;
const holenNetz: Holen = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; feed-reader)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(15_000), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  return t.length > 2_000_000 ? t.slice(0, 2_000_000) : t;
};

// ═══════════════════════════════════════════════════════════════════════════
// ABRUF
// ═══════════════════════════════════════════════════════════════════════════
export interface AbrufErgebnis { neu: number; jeQuelle: Record<string, number>; fehler: Record<string, string>; kurs: KursTag | null }

export async function newsHolen(holen: Holen = holenNetz, jetzt: Date = new Date()): Promise<AbrufErgebnis> {
  const erg: AbrufErgebnis = { neu: 0, jeQuelle: {}, fehler: {}, kurs: null };
  if (!(await tabelleDa())) { erg.fehler.tabelle = "fiaon_global_news fehlt"; return erg; }
  const grenze = jetzt.getTime() - NEWS_MAX_ALTER_TAGE * 86_400_000;
  for (const q of NEWS_QUELLEN) {
    try {
      const posten = feedLesen(await holen(q.url))
        .filter((p) => postenPasst(q, p))
        // Ohne Datum gilt die Meldung als frisch (manche Feeds lassen es weg); mit Datum zählt die Frist.
        .filter((p) => !p.datum || (Date.parse(p.datum) >= grenze && Date.parse(p.datum) <= jetzt.getTime() + 86_400_000))
        .slice(0, 40);
      let neu = 0;
      for (const p of posten) {
        if (neu >= q.max) break;
        const z = (await sqlPool`
          INSERT INTO fiaon_global_news (quelle, thema, titel, link, veroeffentlicht_am, text_roh)
          VALUES (${q.key}, ${q.thema}, ${p.titel}, ${p.link}, ${p.datum}, ${p.text || null})
          ON CONFLICT (link) DO NOTHING RETURNING id`) as any[];
        if (z.length) neu++;
      }
      erg.jeQuelle[q.key] = neu; erg.neu += neu;
    } catch (e) {
      erg.fehler[q.key] = String((e as any)?.message ?? e).slice(0, 120);
      console.error(`[CHEF-NEWS] ${q.key}:`, erg.fehler[q.key]);
    }
  }
  // Der EZB-Referenzkurs: die letzten 60 Werte als eine Einstellung (klein, kein eigener Verlaufsspeicher nötig).
  try {
    const werte = ezbKursLesen(await holen(NEWS_EZB_KURS_URL)).slice(-60);
    if (werte.length) { await einstellungSetzen(NEWS_SCHLUESSEL.kurs, JSON.stringify(werte)); erg.kurs = werte[werte.length - 1]; }
    else erg.fehler.kurs = "kein Kurs in der Datei";
  } catch (e) {
    erg.fehler.kurs = String((e as any)?.message ?? e).slice(0, 120);
    console.error("[CHEF-NEWS] Kurs:", erg.fehler.kurs);
  }
  await einstellungSetzen(NEWS_SCHLUESSEL.abrufAm, jetzt.toISOString()).catch(() => {});
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// KI-KURZFASSUNG
// ═══════════════════════════════════════════════════════════════════════════
export interface KiStand { an: boolean; grund: string | null }
/** Darf die KI gerade Kurzfassungen schreiben? Der Grund steht als Satz da. */
export async function newsKiStand(): Promise<KiStand> {
  if ((await einstellung(NEWS_SCHLUESSEL.kiAn)) === "aus") return { an: false, grund: "Die Kurzfassungen sind ausgeschaltet." };
  if (!kiLesenMoeglich()) return { an: false, grund: "Für die KI fehlt der Schlüssel." };
  try {
    if (await kiPausiert()) { const z = await kiPauseLesen(); return { an: false, grund: kiPauseMeldung(z.art ?? null, aktiverAnbieter()) }; }
  } catch { return { an: false, grund: "Der Stand der KI ist gerade nicht lesbar." }; }
  const grenze = newsDeckelAus(await einstellung(NEWS_SCHLUESSEL.kiDeckel));
  const { kostenHeute } = await import("./fiaon-postmeister-schema");
  const heute = await kostenHeute(DIENST).catch(() => 0);
  if (heute >= grenze) return { an: false, grund: `Der Tagesdeckel für Kurzfassungen ist erreicht (${grenze.toLocaleString("de-DE")} $).` };
  return { an: true, grund: null };
}

/** Eine Antwort der KI als Text — oder der Grund, warum es keine gibt. Übergebbar, damit der Prüfstand ohne Netz läuft. */
export type KiFrage = (system: string, nutzer: string) => Promise<{ ok: true; text: string; modell: string } | { ok: false; grund: string; pause?: boolean }>;
const kiNetz: KiFrage = async (system, nutzer) => {
  const modell = MODELL(); const t0 = Date.now();
  try {
    const res = await openaiFetch(DIENST, "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modell, temperature: 0.1, max_tokens: 320, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: nutzer }] }),
      signal: AbortSignal.timeout(40_000),
    });
    const roh: any = await res.json().catch(() => null);
    const text = String(roh?.choices?.[0]?.message?.content ?? "").trim();
    const { nutzungMerken } = await import("./fiaon-postmeister-schema");
    await nutzungMerken({ dienst: DIENST, modell, usage: roh?.usage, dauerMs: Date.now() - t0, ok: res.ok && !!text, fehler: res.ok ? null : JSON.stringify(roh?.error ?? "").slice(0, 200) })
      .catch((e) => console.error("[CHEF-NEWS] Nutzung nicht gemerkt:", e instanceof Error ? e.message : e));
    if (!res.ok) return { ok: false, grund: `HTTP ${res.status}` };
    if (!text) return { ok: false, grund: "leere Antwort" };
    return { ok: true, text, modell };
  } catch (e: any) {
    if (istKiPause(e)) return { ok: false, grund: String(e?.message ?? "KI pausiert"), pause: true };
    return { ok: false, grund: e?.name === "TimeoutError" || e?.name === "AbortError" ? "Zeit überschritten" : String(e?.message ?? e).slice(0, 120) };
  }
};

/** Schreibt für die neuesten Meldungen ohne Kurzfassung eine — höchstens `max` je Lauf, hört bei Pause oder Deckel auf. */
export async function newsKi(opt: { max?: number; frage?: KiFrage; stand?: () => Promise<KiStand> } = {}): Promise<{ geschrieben: number; offen: number; grund: string | null }> {
  if (!(await tabelleDa())) return { geschrieben: 0, offen: 0, grund: "Tabelle fehlt" };
  const stand = await (opt.stand ?? newsKiStand)();
  const offenZahl = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_news WHERE ki_am IS NULL AND ausgeblendet_am IS NULL AND ki_versuche < ${NEWS_KI_VERSUCHE_MAX}`) as any[])[0]?.n ?? 0);
  if (!stand.an) return { geschrieben: 0, offen: await offenZahl(), grund: stand.grund };
  const frage = opt.frage ?? kiNetz;
  const zeilen = (await sqlPool`
    SELECT id, quelle, titel, text_roh FROM fiaon_global_news
     WHERE ki_am IS NULL AND ausgeblendet_am IS NULL AND ki_versuche < ${NEWS_KI_VERSUCHE_MAX}
     ORDER BY COALESCE(veroeffentlicht_am, erstellt_am) DESC LIMIT ${Math.max(1, opt.max ?? NEWS_KI_JE_LAUF)}`) as any[];
  let geschrieben = 0; let grund: string | null = null;
  for (const z of zeilen) {
    const q = NEWS_QUELLE_NACH_KEY.get(String(z.quelle));
    if (!q) continue;
    const a = await frage(NEWS_KI_ANWEISUNG, newsKiEingabe(q, { titel: String(z.titel), text: String(z.text_roh ?? "") }));
    if (!a.ok) {
      // Eine Pause ist kein Fehlversuch der Meldung — sie bleibt offen und kommt beim nächsten Lauf wieder dran.
      if (a.pause) { grund = a.grund; break; }
      await sqlPool`UPDATE fiaon_global_news SET ki_versuche = ki_versuche + 1, ki_fehler = ${a.grund.slice(0, 200)} WHERE id = ${z.id}`;
      grund = a.grund; continue;
    }
    const k = newsKiLesen(a.text);
    if (!k) { await sqlPool`UPDATE fiaon_global_news SET ki_versuche = ki_versuche + 1, ki_fehler = 'Antwort nicht lesbar' WHERE id = ${z.id}`; continue; }
    await sqlPool`UPDATE fiaon_global_news SET kurz_de = ${k.kurz}, bedeutung_de = ${k.bedeutung}, relevanz = ${k.relevanz}, ki_am = NOW(), ki_modell = ${a.modell}, ki_fehler = NULL WHERE id = ${z.id}`;
    geschrieben++;
  }
  return { geschrieben, offen: await offenZahl(), grund };
}

/** Der Lauf: abrufen, dann Kurzfassungen. Gibt eine kurze Meldung für die Lauf-Historie zurück. */
export async function newsLauf(): Promise<string> {
  const a = await newsHolen();
  const k = await newsKi().catch((e) => {
    console.error("[CHEF-NEWS] Kurzfassungen abgebrochen:", e instanceof Error ? e.message : e);
    return { geschrieben: 0, offen: 0, grund: `Fehler: ${String(e instanceof Error ? e.message : e).slice(0, 120)}` };
  });
  const fehler = Object.keys(a.fehler);
  // Der Grund gehört in die Meldung: „0 Kurzfassungen“ ohne Grund hat am 12.11. eine Stunde Suche gekostet.
  const text = `${a.neu} neu · ${k.geschrieben} Kurzfassungen${k.offen ? ` · ${k.offen} offen` : ""}${k.offen && k.grund ? ` (${k.grund})` : ""}${fehler.length ? ` · nicht erreichbar: ${fehler.join(", ")}` : ""}`;
  console.log(`[CHEF-NEWS] ${text}`);
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANZEIGE UND BEDIENUNG
// ═══════════════════════════════════════════════════════════════════════════
export async function newsLesen(stufe: "inhaber" | "geschaeftsfuehrung" | "leitung"): Promise<NewsAntwort> {
  const quellen = NEWS_QUELLEN.map((q) => ({ key: q.key, name: q.name, thema: q.thema, url: q.url }));
  const leer: NewsAntwort = { ok: true, stand: new Date().toISOString(), kurs: null, meldungen: [], abrufAm: null, ki: { an: false, grund: null, ohneKurzfassung: 0 }, quellen, darfSteuern: stufe !== "leitung" };
  if (!(await tabelleDa())) return leer;
  const zeilen = (await sqlPool`
    SELECT id, quelle, thema, titel, link, veroeffentlicht_am, text_roh, kurz_de, bedeutung_de, relevanz, ki_am
      FROM fiaon_global_news
     WHERE ausgeblendet_am IS NULL AND COALESCE(veroeffentlicht_am, erstellt_am) > NOW() - ${`${NEWS_MAX_ALTER_TAGE + 15} days`}::interval
       -- Was die KI als „kein Bezug“ einstuft, steht nicht in der Lage; ohne Kurzfassung bleibt die Meldung sichtbar.
       AND (relevanz IS NULL OR relevanz >= 1)
     ORDER BY COALESCE(veroeffentlicht_am, erstellt_am) DESC LIMIT ${NEWS_ANZEIGE_MAX}`) as any[];
  const meldungen: NewsMeldung[] = zeilen.map((z) => {
    const q = NEWS_QUELLE_NACH_KEY.get(String(z.quelle));
    const d = z.veroeffentlicht_am ? new Date(z.veroeffentlicht_am) : null;
    return {
      id: Number(z.id), quelle: String(z.quelle), quelleName: q?.name ?? String(z.quelle), thema: String(z.thema) as NewsThema, sprache: q?.sprache ?? "en",
      titel: String(z.titel), link: String(z.link), datum: d ? d.toISOString() : null, tag: d ? berlinTag(d) : null,
      kurz: z.kurz_de ?? null, bedeutung: z.bedeutung_de ?? null, relevanz: z.relevanz != null ? Number(z.relevanz) : null,
      text: z.ki_am ? null : (z.text_roh ? String(z.text_roh).slice(0, 320) : null),
    };
  });
  let werte: KursTag[] = [];
  try { werte = JSON.parse((await einstellung(NEWS_SCHLUESSEL.kurs)) ?? "[]"); } catch { werte = []; }
  const ki = await newsKiStand().catch(() => ({ an: false, grund: "Der Stand der KI ist gerade nicht lesbar." }));
  return {
    ...leer, kurs: kursStand(Array.isArray(werte) ? werte.filter((w) => w && typeof w.tag === "string" && Number.isFinite(Number(w.kurs))) : []), meldungen,
    abrufAm: await einstellung(NEWS_SCHLUESSEL.abrufAm),
    ki: { an: ki.an, grund: ki.grund, ohneKurzfassung: meldungen.filter((m) => !m.kurz).length },
  };
}

type Erg<T = {}> = ({ ok: true } & T) | { ok: false; status: number; error: string };
export async function newsAusblenden(id: number, wer: string): Promise<Erg<{ meldung: string }>> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, error: "Die Meldung ist nicht lesbar." };
  if (!(await tabelleDa())) return { ok: false, status: 503, error: "Die News sind noch nicht eingerichtet." };
  const z = (await sqlPool`UPDATE fiaon_global_news SET ausgeblendet_am = NOW(), ausgeblendet_von = ${wer} WHERE id = ${id} AND ausgeblendet_am IS NULL RETURNING id`) as any[];
  return z.length ? { ok: true, meldung: "Ausgeblendet." } : { ok: false, status: 409, error: "Diese Meldung ist schon ausgeblendet." };
}

/** „Jetzt abrufen“ von Hand — höchstens alle zehn Minuten, damit ein Doppelklick keine Behörde zweimal ruft. */
export async function newsJetzt(): Promise<Erg<{ meldung: string }>> {
  if (!(await tabelleDa())) return { ok: false, status: 503, error: "Die News sind noch nicht eingerichtet — bitte in einer Minute noch einmal." };
  const zuletzt = Date.parse((await einstellung(NEWS_SCHLUESSEL.abrufAm)) ?? "");
  if (Number.isFinite(zuletzt) && Date.now() - zuletzt < ABRUF_PAUSE_MIN * 60_000) {
    return { ok: false, status: 429, error: `Der letzte Abruf ist erst ${Math.max(1, Math.round((Date.now() - zuletzt) / 60_000))} Minuten her — bitte kurz warten.` };
  }
  return { ok: true, meldung: `${await newsLauf()}.` };
}

// ── Einstellungen der Kurzfassungen (E-508 Scheibe 4): Schalter und Tagesdeckel bekommen eine Bedienung ─────────────
export async function newsEinstellungenLesen(): Promise<NewsEinstellungen> {
  const deckel = newsDeckelAus(await einstellung(NEWS_SCHLUESSEL.kiDeckel));
  const { kostenHeute } = await import("./fiaon-postmeister-schema");
  const stand = await newsKiStand().catch(() => ({ an: false, grund: "Der Stand der KI ist gerade nicht lesbar." }));
  return {
    kiAn: (await einstellung(NEWS_SCHLUESSEL.kiAn)) !== "aus",
    kiDeckelUsd: deckel,
    kiHeuteUsd: Math.round((await kostenHeute(DIENST).catch(() => 0)) * 100) / 100,
    kiGrund: stand.an ? null : stand.grund,
  };
}
export async function newsEinstellungSetzen(ein: unknown): Promise<Erg<{ meldung: string } & NewsEinstellungen>> {
  const p = newsEinstellungPruefen(ein);
  if (!p.ok) return { ok: false, status: 400, error: p.error };
  if (p.kiAn !== undefined) await einstellungSetzen(NEWS_SCHLUESSEL.kiAn, p.kiAn ? "an" : "aus");
  if (p.kiDeckelUsd !== undefined) await einstellungSetzen(NEWS_SCHLUESSEL.kiDeckel, String(p.kiDeckelUsd));
  const jetzt = await newsEinstellungenLesen();
  return { ok: true, ...jetzt, meldung: `Kurzfassungen ${jetzt.kiAn ? "an" : "aus"} · Tagesdeckel ${jetzt.kiDeckelUsd.toLocaleString("de-DE")} $.` };
}
