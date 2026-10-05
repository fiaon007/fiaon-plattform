// ═══════════════════════════════════════════════════════════════════════════
// DIE WEICHE: ALTER ODER NEUER ANTRAG (05.10.2026, E-282)
//
// Justin: „führe Statistik darüber, ich will später wissen, wie der Weg
// performt und wie das alte". Ein Vergleich ist nur ehrlich, wenn derselbe
// Besucherstrom zufällig auf beide Wege fällt — deshalb diese Weiche vor
// GET /antrag statt zweier Links, die verschiedene Menschen erreichen.
//
// ── DIE REGELN ────────────────────────────────────────────────────────────
// · Der Anteil (0–100): die Zeile antrag_neu_anteil in fiaon_settings. Gibt
//   es KEINE Zeile, gilt die Render-Variable ANTRAG_NEU_ANTEIL (ganze Zahl
//   0–100, sonst 0). Eine im Chefbüro gespeicherte Zeile gewinnt immer — so
//   bleibt das Zurückstellen ohne Deploy möglich (05.10.2026, E-283). Bei 0
//   tut die Weiche NICHTS: kein Cookie, kein Ereignis, kein Umweg.
// · Wer zugeteilt ist, bleibt zugeteilt (Cookie fiaon_aw, 90 Tage, Wert
//   „alt.<kennung>" oder „neu.<kennung>") — bei 1–99 %. Bei 100 % gibt es
//   keinen alten Weg mehr für neue Besucher: Ein vorhandenes „alt."-Cookie
//   wird auf „neu." umgeschrieben (Justin 05.10.2026: „Stelle den neuen
//   Antrag live, überall"), und ein Sitzungs-Cookie „alt." entsteht nicht.
// · Immer ALT, ohne Zuteilung: Roboter (Vorschau, Suchmaschine, Skript), jeder
//   Link mit Parametern, die nur der alte Weg kann (Sperrliste in
//   weicheLinkAusnahme: weiter, skip, skipPayment, step, ein Paket, das der
//   neue Weg nicht kennt), und wer schon einen ALTEN Antrag offen hat
//   (Antrags-Cookie aus fiaon-antrag-sitzung.ts) — dessen Angaben stehen im
//   alten Formular.
// · Jede ZUTEILUNG (nicht jede Wiederkehr, nicht das Umschreiben bei 100 %)
//   steht als Ereignis „weiche" in fiaon_antrag_ereignisse — weg = zugeteilter
//   Weg, detail = Anteil. Damit lässt sich nachrechnen, ob die Aufteilung dem
//   eingestellten Anteil folgt.
//
// ── WARUM KEIN httpOnly ───────────────────────────────────────────────────
// Das Cookie trägt nichts außer dem Weg und einer Zufallskennung — kein
// Geheimnis, keine Person. Der alte Antrag las es früher im Browser und
// fragte bei „alt" die Weiche nicht mehr; seit E-283 fragt er immer (sonst
// hielte ein altes Cookie ihn auch bei 100 % auf dem alten Weg).
//
// Montage (server/routes.ts): antragWeicheMiddleware vor dem Ausliefern der
// Seite an GET /antrag; antragWeicheRouter unter /api/fiaon NACH dem
// adminCodeGate (die /admin-Pfade hier haben keine eigene Wand).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "crypto";
import { sqlPool } from "./db-pool";
import { antragAusCookie } from "./fiaon-antrag-sitzung";
import { istRoboterUnterschrift } from "./fiaon-vertrieb-zusage";
import { chefProtokoll } from "../routes/fiaon-chef-zugang";
import { antragNeuPaket, ANTRAG_NEU_REIHE } from "@shared/fiaon-antrag-neu";

export type AntragWegWahl = "alt" | "neu";
/**
 * Warum die Weiche so entschied — für die Antwort an den Browser und die Fehlersuche.
 * „umgeschrieben": bei 100 % aus einem vorhandenen „alt."-Cookie ein „neu."-Cookie (E-283).
 */
export type WeicheGrund = "aus" | "roboter" | "link" | "antrag_offen" | "cookie" | "umgeschrieben" | "zugeteilt";
/** Woher der Anteil kommt: gespeicherte Zeile, Render-Variable oder keins von beiden (0). */
export type AnteilQuelle = "chefbuero" | "render" | "vorgabe";

export const WEICHE_COOKIE = "fiaon_aw";
const COOKIE_TAGE = 90;
const COOKIE_MUSTER = /^(alt|neu)\.([a-z0-9]{8,40})$/;
export const WEICHE_EINSTELLUNG = "antrag_neu_anteil";
/** Die Stufen, die das Chefbüro anbietet. Der Server nimmt jede ganze Zahl 0–100. */
export const WEICHE_STUFEN = [0, 10, 25, 50, 100] as const;
/**
 * So lange wartet die Weiche höchstens auf die Datenbank. Danach gilt beim Anteil der letzte
 * bekannte Wert (sonst die Render-Variable), beim Weg eines offenen Antrags der alte Weg.
 */
const FRIST_MS = 1500;
/** Protokoll-Ziel in fiaon_admin_log — daraus liest die Anzeige „geändert von". */
const PROTOKOLL_ZIEL = "antrag-weiche";

// ═══════════════════════════════════════════════════════════════════════════
// DIE SCHRITTE BEIDER WEGE — Reihenfolge und Klartext für den Trichter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Schritte des ALTEN Wegs (client/src/pages/antrag.tsx). Der Name trägt
 * die Schrittnummer aus dem Code (= current_step in fiaon_applications), damit
 * er stabil bleibt, solange die Nummern bleiben. Dieselbe Liste steht als
 * ALT_SCHRITT in antrag.tsx — weicht der Browser ab, erscheint der fremde
 * Name hinten im Trichter, statt still zu verschwinden.
 */
export const ALT_SCHRITTE: { schritt: string; label: string }[] = [
  { schritt: "a0_paket", label: "Paketwahl" },
  { schritt: "a1_person", label: "Persönliche Daten" },
  { schritt: "a2_finanzen", label: "Finanzen" },
  { schritt: "a3_karte", label: "Wunschlimit & Zweck" },
  { schritt: "a4_pruefung", label: "Prüfung" },
  { schritt: "a5_ergebnis", label: "Ergebnis" },
  { schritt: "a6_vertrag", label: "Vertrag" },
  { schritt: "a7_verarbeitung", label: "Verarbeitung" },
  { schritt: "a8_angenommen", label: "Vertrag angenommen" },
  // a9_passwort (Passwortseite) gibt es nur im Entwicklungsserver. Taucht er in
  // der Messung auf, erscheint er als „unbekannt" hinten — dann stimmt etwas nicht.
];

/** Klartext der Schritte des NEUEN Wegs (Reihenfolge: ANTRAG_NEU_REIHE). */
const NEU_LABEL: Record<string, string> = {
  name: "Name", kontakt: "Kontakt", geburt: "Geburtsdatum", adresse: "Adresse", beruf: "Beruf",
  einkommen: "Einkommen", eintraege: "Einträge", pruefung: "Prüfung", ergebnis: "Ergebnis",
  // Die persönliche FIAON-PIN dient dem Erkennen am Telefon — keine Karten-PIN.
  pin: "FIAON-PIN festlegen", paket: "Paket", limit: "Ziel-Limit", vertrag: "Vertrag",
  unterschrift: "Unterschrift", zahlung: "Zahlung", danke: "Danke",
};

export const NEU_SCHRITTE: { schritt: string; label: string }[] = ANTRAG_NEU_REIHE.map((s) => ({ schritt: s, label: NEU_LABEL[s] ?? s }));

// ═══════════════════════════════════════════════════════════════════════════
// ERKENNEN: Roboter, Gerät, Link-Parameter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vorschau-, Such- und Prüfprogramme. Dieselbe Familie wie KEIN_MENSCH in
 * server/routes/fiaon-auskunft-kauf.ts (dort nicht exportiert) — ohne
 * „telegram" und „skype": Deren Vorschau-Abrufer tragen „bot" bzw. „preview",
 * der eingebaute Browser von Telegram aber Menschen.
 *
 * „bot" nur am Wortende (05.10.2026, E-283): Vorher traf das nackte „bot" auch
 * Handys der Marke CUBOT („Android 10; CUBOT X30") — echte Menschen landeten
 * als Roboter im alten Weg. Jetzt zählt „bot"/„bots" nur, wenn danach ein
 * Wortende oder „_" kommt und davor nicht „cu" steht: Googlebot/2.1,
 * bingbot, AhrefsBot, AdsBot-Google, Slackbot-LinkExpanding, Discordbot und
 * GPTBot bleiben Roboter. Prüfstand: scripts/pruef-antrag-weiche.ts.
 */
const KEIN_MENSCH = /(?<!cu)bots?(?:\b|_)|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|python|curl|wget|go-http|java\/|okhttp|axios|node-fetch|^node$|undici|linkcheck|scanner/i;

/** Ein Roboter bekommt immer den alten Weg und nie ein Cookie. Leere Kennung zählt als Roboter. */
export function istWeicheRoboter(userAgent: unknown): boolean {
  const ua = String(userAgent ?? "").trim();
  if (!ua) return true;
  // Die Kennungsprüfung der Rechtsnachweise (Headless, Playwright, curl …) — ohne die
  // Adressprüfung: Hinter dem Render-Proxy sagt req.ip nichts über den Besucher.
  if (istRoboterUnterschrift(null, ua).roboter) return true;
  return KEIN_MENSCH.test(ua);
}

/**
 * Gerät aus der Browserkennung — handy | tablet | desktop. Dieselben Werte
 * sollte die Ereignis-Route (POST /api/fiaon/antrag-neu/ereignis) in die
 * Spalte geraet schreiben, damit die Geräteaufteilung beider Wege vergleichbar ist.
 */
export function antragGeraet(userAgent: unknown): "handy" | "tablet" | "desktop" {
  const ua = String(userAgent ?? "");
  if (/ipad|tablet|kindle|silk\//i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobile|iphone|ipod|android|windows phone/i.test(ua)) return "handy";
  return "desktop";
}

/**
 * Parameter, die nur der alte Weg kann (Groß/klein egal):
 *   weiter       — Weiter-Link aus Erinnerungsmail und /a/ bei begonnenem Antrag.
 *                  Ein NEUER Antrag springt von dort selbst nach /antrag-neu
 *                  (GET /antrag/weiter/:token, antrag.tsx).
 *   skip, skippayment, step — Abkürzungen des alten Formulars im Entwicklungsbetrieb.
 */
const NUR_ALT = new Set(["weiter", "skip", "skippayment", "step"]);

/**
 * Trägt die Adresse etwas, das nur der alte Weg kann? Dann bleibt der Besuch alt.
 *
 * SPERRLISTE STATT ERLAUBTLISTE (05.10.2026, E-283): Bis hier war nur erlaubt,
 * was ausdrücklich auf einer Liste stand (utm_*, Klick-Kennungen, Paket). Fast
 * jeder echte Einstieg trägt aber mehr — /start hängte src=wa an, /privatkunden
 * src=privatkunden, der persönliche Link l und k, Google gad_source und
 * srsltid —, und so blieb „überall neu" auch bei 100 % beim alten Weg. Jetzt
 * bleibt nur alt, was der neue Weg wirklich nicht kann:
 *   · ein Parameter aus NUR_ALT,
 *   · pack/paket mit einem Wert, den antragNeuPaket() nicht als Privatpaket
 *     kennt (schufa, auskunft*, business_… — der alte Weg leitet die
 *     Auskunft-Pakete selbst auf /bonitaet-antrag weiter).
 * Alles andere (l, k, src, ref, quelle, lead, auskunft, gad_source, srsltid,
 * _gl, utm_*, fbclid …) geht in die normale Entscheidung. Den persönlichen
 * Link (l, k) und die Auskunft-Parameter (src=auskunft, auskunft=1|0,
 * src=auskunft_da) liest der neue Weg selbst (antrag-neu/index.tsx).
 */
export function weicheLinkAusnahme(suche: string): boolean {
  let ausnahme = false;
  let params: URLSearchParams;
  try { params = new URLSearchParams(String(suche || "")); } catch { return true; }
  params.forEach((wert, schluessel) => {
    if (ausnahme) return;
    const k = schluessel.trim().toLowerCase();
    if (NUR_ALT.has(k)) { ausnahme = true; return; }
    // Ein leeres pack= ist kein Paket — es ändert nichts am Weg.
    if ((k === "pack" || k === "paket") && wert.trim() && !antragNeuPaket(wert)) ausnahme = true;
  });
  return ausnahme;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ANTEIL — Zeile in fiaon_settings, sonst Render-Variable; 30 Sekunden im Speicher
// ═══════════════════════════════════════════════════════════════════════════
// GET /antrag ist die meistbesuchte Formularseite — deshalb ein kurzer
// Speicher. Ein Wechsel im Chefbüro gilt in diesem Prozess sofort, in anderen
// nach höchstens 30 Sekunden. Gelesen wird nur die eine Zeile (nicht
// getSettings): Nur so ist „keine Zeile" von „Zeile mit 0" zu unterscheiden.
//
// ── DIE RENDER-VARIABLE (05.10.2026, E-283) ───────────────────────────────
// Das Hochsetzen im Chefbüro braucht den Admin-Code oder eine Chef-Sitzung.
// Damit der Schalter auch ohne beides umgelegt werden kann, gilt
// ANTRAG_NEU_ANTEIL, solange es KEINE Zeile gibt. Wer im Chefbüro speichert,
// legt die Zeile an — ab dann zählt nur noch sie (Zurückstellen ohne Deploy).
// Render übernimmt eine geänderte Variable erst mit dem nächsten Deploy.
let anteilStand: { wert: number; quelle: AnteilQuelle; bis: number } | null = null;
let anteilLaeuft: Promise<number> | null = null;

function anteilAusText(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
}

/** ANTRAG_NEU_ANTEIL als ganze Zahl 0–100 — null, wenn nicht gesetzt oder ungültig. */
export function anteilAusRender(roh: unknown): number | null {
  const s = String(roh ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * Welcher Anteil gilt — rein, ohne Datenbank (Prüfstand).
 * @param zeile Wert der Zeile antrag_neu_anteil; null = es gibt keine Zeile.
 * @param render Inhalt der Render-Variable ANTRAG_NEU_ANTEIL.
 */
export function anteilBestimmen(zeile: string | null, render: unknown): { wert: number; quelle: AnteilQuelle } {
  if (zeile !== null) return { wert: anteilAusText(zeile), quelle: "chefbuero" };
  const r = anteilAusRender(render);
  return r === null ? { wert: 0, quelle: "vorgabe" } : { wert: r, quelle: "render" };
}

let renderGewarnt = false;
/** Die Variable lesen — ein ungültiger Wert wird EINMAL gemeldet und gilt als nicht gesetzt (0 %). */
function renderAnteil(): unknown {
  const roh = process.env.ANTRAG_NEU_ANTEIL;
  if (!renderGewarnt && String(roh ?? "").trim() && anteilAusRender(roh) === null) {
    renderGewarnt = true;
    console.warn(`[ANTRAG-WEICHE] ANTRAG_NEU_ANTEIL="${String(roh).slice(0, 20)}" ist keine ganze Zahl von 0 bis 100 — gilt als nicht gesetzt (0 %).`);
  }
  return roh;
}

/** Die Zeile antrag_neu_anteil — null, wenn es sie nicht gibt. */
async function anteilZeile(): Promise<{ value: string; updated_at: Date | null } | null> {
  const [z] = (await sqlPool`SELECT value, updated_at FROM fiaon_settings WHERE key = ${WEICHE_EINSTELLUNG} LIMIT 1`) as any[];
  return z ? { value: String(z.value ?? ""), updated_at: z.updated_at ?? null } : null;
}

function mitFrist<T>(p: Promise<T>, ms: number, was: string): Promise<T> {
  return new Promise<T>((gut, schlecht) => {
    const t = setTimeout(() => schlecht(new Error(`${was}: keine Antwort nach ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); gut(v); }, (e) => { clearTimeout(t); schlecht(e); });
  });
}

/** Ohne Datenbank: der letzte bekannte Anteil, sonst die Render-Variable (nicht mehr pauschal 0). */
function anteilOhneDatenbank(): { wert: number; quelle: AnteilQuelle } {
  return anteilStand ? { wert: anteilStand.wert, quelle: anteilStand.quelle } : anteilBestimmen(null, renderAnteil());
}

/** Der eingestellte Anteil neuer Besucher für /antrag-neu (0–100). Wirft, wenn die Datenbank nicht antwortet. */
export function antragNeuAnteil(): Promise<number> {
  if (anteilStand && anteilStand.bis > Date.now()) return Promise.resolve(anteilStand.wert);
  if (!anteilLaeuft) {
    anteilLaeuft = (async () => {
      try {
        const z = await anteilZeile();
        const a = anteilBestimmen(z ? z.value : null, renderAnteil());
        anteilStand = { ...a, bis: Date.now() + 30_000 };
        return a.wert;
      } catch (e) {
        // Zehn Sekunden mit dem letzten bekannten Wert weiter (sonst der Render-Variable),
        // damit eine kranke Datenbank nicht jede Seitenanfrage um die Frist verlängert.
        anteilStand = { ...anteilOhneDatenbank(), bis: Date.now() + 10_000 };
        throw e;
      } finally {
        anteilLaeuft = null;
      }
    })();
  }
  return anteilLaeuft;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ENTSCHEIDUNG
// ═══════════════════════════════════════════════════════════════════════════

function neueKennung(): string {
  return randomBytes(9).toString("hex");
}

function weicheCookieLesen(req: Request): { weg: AntragWegWahl; id: string } | null {
  const roh = String((req as any).cookies?.[WEICHE_COOKIE] ?? "").trim().toLowerCase();
  const m = COOKIE_MUSTER.exec(roh);
  return m ? { weg: m[1] as AntragWegWahl, id: m[2] } : null;
}

function weicheCookieSetzen(res: Response, wert: string, dauerhaft: boolean): void {
  res.cookie(WEICHE_COOKIE, wert, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Ohne maxAge ein Sitzungs-Cookie: endet mit dem Browser.
    ...(dauerhaft ? { maxAge: COOKIE_TAGE * 864e5 } : {}),
  });
}

/**
 * Welcher Weg gehört zum offenen Antrag aus dem Antrags-Cookie? Wer einen
 * NEUEN Antrag offen hat, gehört auf den neuen Weg; alles andere (alter
 * Antrag, Zeile nicht gefunden, Datenbank langsam) bleibt alt.
 */
async function offenerAntragWeg(ref: string): Promise<AntragWegWahl> {
  try {
    const [z] = (await mitFrist(
      sqlPool`SELECT antrag_weg FROM fiaon_applications WHERE ref = ${ref} LIMIT 1` as unknown as Promise<any[]>,
      FRIST_MS, "Antragsweg",
    )) as any[];
    return z?.antrag_weg === "neu" ? "neu" : "alt";
  } catch (e: any) {
    console.warn("[ANTRAG-WEICHE] Weg des offenen Antrags nicht lesbar, alter Weg:", e?.message || e);
    return "alt";
  }
}

// Höchstens 120 gemessene Zuteilungen je Anschluss in 10 Minuten. Ein Programm,
// das Cookies wegwirft und sich als Browser ausgibt, bekommt trotzdem seinen
// Weg — es füllt nur die Messung nicht. Großzügig, weil Mobilfunk viele
// Menschen hinter einer Adresse bündelt.
const ZUTEILUNG_FENSTER_MS = 10 * 60_000;
const ZUTEILUNG_HOECHSTENS = 120;
const zuteilungenJeAnschluss = new Map<string, { n: number; ab: number }>();

function zuteilungMessenErlaubt(req: Request): boolean {
  const anschluss = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || String(req.ip || "unbekannt");
  const jetzt = Date.now();
  if (zuteilungenJeAnschluss.size > 5000) {
    Array.from(zuteilungenJeAnschluss.entries()).forEach(([k, v]) => {
      if (jetzt - v.ab > ZUTEILUNG_FENSTER_MS) zuteilungenJeAnschluss.delete(k);
    });
  }
  const z = zuteilungenJeAnschluss.get(anschluss);
  if (!z || jetzt - z.ab > ZUTEILUNG_FENSTER_MS) {
    zuteilungenJeAnschluss.set(anschluss, { n: 1, ab: jetzt });
    return true;
  }
  z.n += 1;
  return z.n <= ZUTEILUNG_HOECHSTENS;
}

async function zuteilungMerken(weg: AntragWegWahl, sitzung: string, anteil: number, userAgent: unknown): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_antrag_ereignisse (weg, sitzung, ereignis, detail, geraet)
    VALUES (${weg}, ${sitzung}, 'weiche', ${String(anteil)}, ${antragGeraet(userAgent)})`;
}

/** Was die Regel aus einer Lage macht — ohne Anfrage, ohne Datenbank. */
export interface WeicheUrteil {
  weg: AntragWegWahl;
  grund: WeicheGrund;
  /** Cookie, das gesetzt werden soll (dauerhaft = 90 Tage, sonst Sitzungs-Cookie) — oder null. */
  cookie: { wert: string; dauerhaft: boolean } | null;
  /** Eine neue Zuteilung, die als Ereignis „weiche" gemessen wird. */
  zuteilung: boolean;
}

/**
 * DIE REGEL — rein, damit der Prüfstand sie ohne Anfrage und ohne Datenbank
 * Fall für Fall durchgehen kann (scripts/pruef-antrag-weiche.ts).
 * @param offen Weg des offenen Antrags aus dem Antrags-Cookie (null = keiner
 *   oder nicht gefragt). weicheEntscheiden fragt die Datenbank nur, wenn die
 *   Regel die Antwort braucht.
 * @param zufall Zahl in [0, 100) — die Würfel der Zuteilung.
 * @param neueId Kennung für ein neues Cookie.
 */
export function weicheRegel(e: {
  anteil: number; roboter: boolean; link: boolean; offen: AntragWegWahl | null;
  cookie: { weg: AntragWegWahl; id: string } | null; zufall: number; neueId: string;
}): WeicheUrteil {
  if (e.anteil <= 0) {
    // Auch bei 0 %: Wer schon einen NEUEN Antrag offen hat (Antrags-Cookie), macht dort weiter —
    // das alte Formular kennt dessen Angaben nicht. Nur ohne Link-Ausnahme (die gehört dem alten Weg).
    if (!e.link && e.offen === "neu") return { weg: "neu", grund: "antrag_offen", cookie: null, zuteilung: false };
    return { weg: "alt", grund: "aus", cookie: null, zuteilung: false };
  }
  if (e.roboter) return { weg: "alt", grund: "roboter", cookie: null, zuteilung: false };
  if (e.link) {
    // Bei 1–99 %: Ein Sitzungs-Cookie „alt" hält den Besucher auch nach einem Neuladen
    // ohne die Parameter im alten Weg (der räumt weiter aus der Adresszeile). Bei 100 %
    // nicht — dort gibt es für neue Besucher keinen alten Weg mehr; ein offener alter
    // Antrag hält ihn über das Antrags-Cookie. Ein vorhandenes Cookie bleibt unangetastet.
    const cookie = !e.cookie && e.anteil < 100 ? { wert: `alt.${e.neueId}`, dauerhaft: false } : null;
    return { weg: "alt", grund: "link", cookie, zuteilung: false };
  }
  // Ein offener ALTER Antrag bleibt alt (seine Angaben stehen im alten Formular), auch bei 100 %.
  if (e.offen) return { weg: e.offen, grund: "antrag_offen", cookie: null, zuteilung: false };
  if (e.cookie) {
    if (e.anteil >= 100 && e.cookie.weg === "alt") {
      // 100 %: aus „alt.<id>" wird „neu.<id>" — dieselbe Kennung, keine neue Zuteilung in der Messung.
      return { weg: "neu", grund: "umgeschrieben", cookie: { wert: `neu.${e.cookie.id}`, dauerhaft: true }, zuteilung: false };
    }
    return { weg: e.cookie.weg, grund: "cookie", cookie: null, zuteilung: false };
  }
  const weg: AntragWegWahl = e.zufall < e.anteil ? "neu" : "alt";
  return { weg, grund: "zugeteilt", cookie: { wert: `${weg}.${e.neueId}`, dauerhaft: true }, zuteilung: true };
}

/**
 * Die Weiche selbst — für die Middleware und für GET /antrag-weiche.
 * Setzt bei einer Zuteilung das Cookie auf res. Datenbankfehler und Fristen
 * enden beim letzten bekannten Anteil (sonst der Render-Variable) bzw. beim
 * alten Weg des offenen Antrags; die beiden Aufrufer fangen trotzdem selbst ab.
 * @param suche Die Abfrage der Seite (mit oder ohne führendes „?").
 */
export async function weicheEntscheiden(req: Request, res: Response, suche: string): Promise<{ weg: AntragWegWahl; grund: WeicheGrund }> {
  let anteil: number;
  try {
    anteil = await mitFrist(antragNeuAnteil(), FRIST_MS, "Anteil");
  } catch (e: any) {
    anteil = anteilOhneDatenbank().wert;
    console.warn(`[ANTRAG-WEICHE] Anteil nicht lesbar, weiter mit ${anteil} %:`, e?.message || e);
  }
  const ua = req.headers["user-agent"];
  // Bei 0 % wird nicht nach Robotern gefragt (die Weiche ist aus) — wie bisher.
  const roboter = anteil > 0 && istWeicheRoboter(ua);
  const link = weicheLinkAusnahme(suche);
  const ref = antragAusCookie(req);
  // Die Datenbank nur fragen, wenn die Regel die Antwort braucht.
  const offen = ref && !link && !roboter ? await offenerAntragWeg(ref) : null;
  const id = neueKennung();
  const u = weicheRegel({ anteil, roboter, link, offen, cookie: weicheCookieLesen(req), zufall: Math.random() * 100, neueId: id });
  if (u.cookie) weicheCookieSetzen(res, u.cookie.wert, u.cookie.dauerhaft);
  if (u.zuteilung && zuteilungMessenErlaubt(req)) {
    void zuteilungMerken(u.weg, id, anteil, ua).catch((e: any) => {
      console.warn("[ANTRAG-WEICHE] Zuteilung nicht gemessen:", e?.message || e);
    });
  }
  return { weg: u.weg, grund: u.grund };
}

/**
 * Express-Handler für GET /antrag, VOR dem Ausliefern der Seite montiert.
 * Bei „neu": 302 auf /antrag-neu mit derselben Abfrage. Sonst next().
 */
export function antragWeicheMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET") { next(); return; }
  const roh = String(req.originalUrl || req.url || "");
  const frage = roh.indexOf("?");
  const pfad = (frage >= 0 ? roh.slice(0, frage) : roh).toLowerCase().replace(/\/+$/, "");
  if (pfad !== "/antrag") { next(); return; }
  const suche = frage >= 0 ? roh.slice(frage) : "";
  void (async () => {
    try {
      const e = await weicheEntscheiden(req, res, suche);
      if (e.weg === "neu") {
        res.setHeader("Cache-Control", "no-store");
        res.redirect(302, `/antrag-neu${suche}`);
        return;
      }
    } catch (err) {
      console.error("[ANTRAG-WEICHE] Middleware, alter Weg:", err);
    }
    next();
  })();
}

// ═══════════════════════════════════════════════════════════════════════════
// STAND FÜR DAS CHEFBÜRO
// ═══════════════════════════════════════════════════════════════════════════

export interface WeicheStand {
  anteil: number;
  /** chefbuero = gespeicherte Zeile · render = Variable ANTRAG_NEU_ANTEIL (keine Zeile) · vorgabe = keins von beiden, 0 %. */
  quelle: AnteilQuelle;
  geaendertAm: string | null;
  geaendertVon: string | null;
  stufen: number[];
}

/** Anteil frisch aus der Tabelle (nicht aus dem Speicher), dazu Quelle, wann und von wem zuletzt geändert. */
export async function weicheStand(): Promise<WeicheStand> {
  const z = await anteilZeile();
  const { wert: anteil, quelle } = anteilBestimmen(z ? z.value : null, renderAnteil());
  anteilStand = { wert: anteil, quelle, bis: Date.now() + 30_000 };
  let geaendertVon: string | null = null;
  try {
    const [p] = (await sqlPool`
      SELECT l.stufe, l.agent_id, g.name
        FROM fiaon_admin_log l
        LEFT JOIN fiaon_agents g ON g.id = l.agent_id
       WHERE l.ziel = ${PROTOKOLL_ZIEL}
       ORDER BY l.zeit DESC
       LIMIT 1`) as any[];
    if (p) geaendertVon = p.name ? String(p.name) : p.stufe === "inhaber" ? "Inhaber (Zugangscode)" : p.stufe ? String(p.stufe) : "unbekannt";
  } catch (e: any) {
    // Ohne Protokolltabelle (noch nie eine Chef-Änderung) bleibt „von" leer — gesagt, nicht verschwiegen.
    console.warn("[ANTRAG-WEICHE] Protokoll nicht lesbar:", e?.message || e);
  }
  return {
    anteil,
    quelle,
    geaendertAm: z?.updated_at ? new Date(z.updated_at).toISOString() : null,
    geaendertVon,
    stufen: [...WEICHE_STUFEN],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTEN (montiert unter /api/fiaon)
// ═══════════════════════════════════════════════════════════════════════════
export const antragWeicheRouter = Router();

/**
 * Für den alten Antrag im Browser: Kommt der Kunde über einen Link innerhalb
 * der App (ohne Seitenaufruf beim Server), fragt die Seite hier nach.
 * q = location.search der Seite.
 */
antragWeicheRouter.get("/antrag-weiche", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 2000) : "";
    const e = await weicheEntscheiden(req, res, q);
    res.json({ ok: true, weg: e.weg, grund: e.grund });
  } catch (err) {
    console.error("[ANTRAG-WEICHE] Abfrage:", err);
    res.status(500).json({ ok: false, weg: "alt", error: "Weiche nicht verfügbar — der alte Antrag gilt." });
  }
});

antragWeicheRouter.get("/admin/finance/antrag-weiche", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...(await weicheStand()) });
  } catch (err) {
    console.error("[ANTRAG-WEICHE] Stand:", err);
    res.status(500).json({ ok: false, error: "Der Stand der Weiche konnte nicht gelesen werden." });
  }
});

antragWeicheRouter.post("/admin/finance/antrag-weiche", async (req: Request, res: Response) => {
  const roh = (req.body || {}).anteil;
  const anteil = typeof roh === "number" ? roh : typeof roh === "string" && roh.trim() !== "" ? Number(roh) : NaN;
  if (!Number.isInteger(anteil) || anteil < 0 || anteil > 100) {
    return res.status(400).json({ ok: false, error: "Der Anteil muss eine ganze Zahl von 0 bis 100 sein." });
  }
  try {
    const vorher = await weicheStand();
    const { setSetting } = await import("../routes/fiaon-agent");
    await setSetting(WEICHE_EINSTELLUNG, String(anteil));
    anteilStand = { wert: anteil, quelle: "chefbuero", bis: Date.now() + 30_000 };
    // Auch derselbe Wert ist eine Änderung, wenn er bisher aus der Render-Variable kam:
    // Ab jetzt gilt die Zeile, die Variable nicht mehr (E-283).
    const geaendert = vorher.anteil !== anteil || vorher.quelle !== "chefbuero";
    if (geaendert) {
      // Abgewartet, damit „geändert von" in der Antwort schon stimmt. chefProtokoll wirft nie.
      const herkunft = vorher.quelle === "render" ? " (vorher über die Render-Variable ANTRAG_NEU_ANTEIL)" : "";
      await chefProtokoll(req, PROTOKOLL_ZIEL, `Anteil neuer Antrag: ${vorher.anteil} % → ${anteil} %${herkunft}`);
    }
    res.json({ ok: true, geaendert, ...(await weicheStand()) });
  } catch (err) {
    console.error("[ANTRAG-WEICHE] Speichern:", err);
    res.status(500).json({ ok: false, error: "Der Anteil wurde NICHT gespeichert (Serverfehler)." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUFRÄUMEN — Löschfrist 180 Tage (Migration 091, Datenschutz)
// ═══════════════════════════════════════════════════════════════════════════
// Messereignisse ohne Inhalt und ohne IP; nach 180 Tagen haben sie keinen
// Zweck mehr. Gelöscht wird in Stapeln zu 5000 je Weg über den Index
// (weg, am), damit kein Lauf die Tabelle lange belegt. Die Ereignis-Route
// nimmt nur die Wege alt und neu an — andere Werte erreicht dieser Lauf nicht.
export async function antragEreignisseAufraeumen(): Promise<number> {
  const grenze = new Date(Date.now() - 180 * 864e5);
  let geloescht = 0;
  for (const weg of ["alt", "neu"]) {
    for (let runde = 0; runde < 400; runde++) {
      const zeilen = (await sqlPool`
        DELETE FROM fiaon_antrag_ereignisse
         WHERE id IN (
           SELECT id FROM fiaon_antrag_ereignisse
            WHERE weg = ${weg} AND am < ${grenze}
            ORDER BY am
            LIMIT 5000)
        RETURNING id`) as any[];
      geloescht += zeilen.length;
      if (zeilen.length < 5000) break;
    }
  }
  return geloescht;
}
