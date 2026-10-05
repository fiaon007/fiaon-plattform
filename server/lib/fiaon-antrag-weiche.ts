// ═══════════════════════════════════════════════════════════════════════════
// DIE WEICHE: ALTER ODER NEUER ANTRAG (05.10.2026, E-282)
//
// Justin: „führe Statistik darüber, ich will später wissen, wie der Weg
// performt und wie das alte". Ein Vergleich ist nur ehrlich, wenn derselbe
// Besucherstrom zufällig auf beide Wege fällt — deshalb diese Weiche vor
// GET /antrag statt zweier Links, die verschiedene Menschen erreichen.
//
// ── DIE REGELN ────────────────────────────────────────────────────────────
// · Einstellung antrag_neu_anteil in fiaon_settings (0–100, Vorgabe 0). Bei 0
//   tut die Weiche NICHTS: kein Cookie, kein Ereignis, kein Umweg.
// · Wer zugeteilt ist, bleibt zugeteilt (Cookie fiaon_aw, 90 Tage, Wert
//   „alt.<kennung>" oder „neu.<kennung>"). Auch ein späteres Hochsetzen auf
//   100 % schreibt kein vorhandenes Cookie um: Ein Mensch soll nicht zwischen
//   zwei Anträgen hin- und hergeworfen werden.
// · Immer ALT, ohne Zuteilung: Roboter (Vorschau, Suchmaschine, Skript), jeder
//   Link mit Parametern, die nur der alte Weg versteht (Lead-Link l, Weiter-
//   Link weiter, Empfehlung, Agenten-Link, Auskunft-Zusatz …), und wer schon
//   einen ALTEN Antrag offen hat (Antrags-Cookie aus fiaon-antrag-sitzung.ts).
//   Erlaubt sind nur Werbe-Kennungen und ein gültiges Paket.
// · Jede ZUTEILUNG (nicht jede Wiederkehr) steht als Ereignis „weiche" in
//   fiaon_antrag_ereignisse — weg = zugeteilter Weg, detail = Anteil. Damit
//   lässt sich nachrechnen, ob die Aufteilung dem eingestellten Anteil folgt.
//
// ── WARUM KEIN httpOnly ───────────────────────────────────────────────────
// Der alte Antrag liest das Cookie im Browser: Steht dort „alt", muss er die
// Weiche nicht noch einmal fragen und misst sofort. Das Cookie trägt nichts
// außer dem Weg und einer Zufallskennung — kein Geheimnis, keine Person.
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
import { ANTRAG_NEU_PAKET_KEYS, ANTRAG_NEU_REIHE } from "@shared/fiaon-antrag-neu";

export type AntragWegWahl = "alt" | "neu";
/** Warum die Weiche so entschied — für die Antwort an den Browser und die Fehlersuche. */
export type WeicheGrund = "aus" | "roboter" | "link" | "antrag_offen" | "cookie" | "zugeteilt";

export const WEICHE_COOKIE = "fiaon_aw";
const COOKIE_TAGE = 90;
const COOKIE_MUSTER = /^(alt|neu)\.([a-z0-9]{8,40})$/;
export const WEICHE_EINSTELLUNG = "antrag_neu_anteil";
/** Die Stufen, die das Chefbüro anbietet. Der Server nimmt jede ganze Zahl 0–100. */
export const WEICHE_STUFEN = [0, 10, 25, 50, 100] as const;
/** So lange wartet die Weiche höchstens auf die Datenbank, dann gilt der alte Weg. */
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
 */
const KEIN_MENSCH = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|python|curl|wget|go-http|java\/|okhttp|axios|node-fetch|^node$|undici|linkcheck|scanner/i;

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

/** Werbe-Kennungen und Herkunft — sie ändern nichts am Antrag und dürfen mit auf den neuen Weg. */
const ERLAUBTE_PARAMETER = new Set(["fbclid", "gclid", "gbraid", "wbraid", "msclkid", "ttclid", "ref_quelle"]);

/**
 * Trägt die Adresse etwas, das nur der alte Weg versteht? Dann bleibt der
 * Besuch alt. Erlaubt: utm_*, die Klick-Kennungen oben und pack/paket mit
 * einem Paket des neuen Wegs. „pack=schufa" gehört NICHT dazu — das leitet
 * der alte Weg auf /bonitaet-antrag um.
 */
export function weicheLinkAusnahme(suche: string): boolean {
  let ausnahme = false;
  let params: URLSearchParams;
  try { params = new URLSearchParams(String(suche || "")); } catch { return true; }
  params.forEach((wert, schluessel) => {
    if (ausnahme) return;
    const k = schluessel.trim().toLowerCase();
    if (/^utm_[a-z0-9_]{1,40}$/.test(k) || ERLAUBTE_PARAMETER.has(k)) return;
    if (k === "pack" || k === "paket") {
      if ((ANTRAG_NEU_PAKET_KEYS as string[]).includes(wert.trim().toLowerCase())) return;
    }
    ausnahme = true;
  });
  return ausnahme;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ANTEIL — gelesen über getSettings, 30 Sekunden im Speicher
// ═══════════════════════════════════════════════════════════════════════════
// getSettings liest jedes Mal die ganze Tabelle (fiaon-agent.ts hat keinen
// Zwischenspeicher). GET /antrag ist die meistbesuchte Formularseite — deshalb
// hier ein kurzer Speicher. Ein Wechsel im Chefbüro gilt in diesem Prozess
// sofort, in anderen nach höchstens 30 Sekunden.
let anteilStand: { wert: number; bis: number } | null = null;
let anteilLaeuft: Promise<number> | null = null;

function anteilAusText(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
}

function mitFrist<T>(p: Promise<T>, ms: number, was: string): Promise<T> {
  return new Promise<T>((gut, schlecht) => {
    const t = setTimeout(() => schlecht(new Error(`${was}: keine Antwort nach ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); gut(v); }, (e) => { clearTimeout(t); schlecht(e); });
  });
}

/** Der eingestellte Anteil neuer Besucher für /antrag-neu (0–100). Wirft, wenn die Datenbank nicht antwortet. */
export function antragNeuAnteil(): Promise<number> {
  if (anteilStand && anteilStand.bis > Date.now()) return Promise.resolve(anteilStand.wert);
  if (!anteilLaeuft) {
    anteilLaeuft = (async () => {
      try {
        const { getSettings } = await import("../routes/fiaon-agent");
        const wert = anteilAusText((await getSettings())[WEICHE_EINSTELLUNG]);
        anteilStand = { wert, bis: Date.now() + 30_000 };
        return wert;
      } catch (e) {
        // Zehn Sekunden mit dem letzten bekannten Wert weiter (sonst 0 = alter Weg),
        // damit eine kranke Datenbank nicht jede Seitenanfrage um die Frist verlängert.
        anteilStand = { wert: anteilStand?.wert ?? 0, bis: Date.now() + 10_000 };
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

/**
 * Die Weiche selbst — für die Middleware und für GET /antrag-weiche.
 * Setzt bei einer Zuteilung das Cookie auf res. Datenbankfehler und Fristen
 * enden hier als „alt"; die beiden Aufrufer fangen trotzdem selbst ab.
 * @param suche Die Abfrage der Seite (mit oder ohne führendes „?").
 */
export async function weicheEntscheiden(req: Request, res: Response, suche: string): Promise<{ weg: AntragWegWahl; grund: WeicheGrund }> {
  let anteil: number;
  try {
    anteil = await mitFrist(antragNeuAnteil(), FRIST_MS, "Anteil");
  } catch (e: any) {
    anteil = anteilStand?.wert ?? 0;
    console.warn(`[ANTRAG-WEICHE] Anteil nicht lesbar, weiter mit ${anteil} %:`, e?.message || e);
  }
  if (anteil <= 0) {
    // Auch bei 0 %: Wer schon einen NEUEN Antrag offen hat (Antrags-Cookie), macht dort weiter —
    // das alte Formular kennt dessen Angaben nicht. Nur ohne Link-Parameter (die gehören dem alten Weg).
    const offen = weicheLinkAusnahme(suche) ? null : antragAusCookie(req);
    if (offen && (await offenerAntragWeg(offen)) === "neu") return { weg: "neu", grund: "antrag_offen" };
    return { weg: "alt", grund: "aus" };
  }

  const ua = req.headers["user-agent"];
  if (istWeicheRoboter(ua)) return { weg: "alt", grund: "roboter" };

  const vorhanden = weicheCookieLesen(req);
  if (weicheLinkAusnahme(suche)) {
    // Der alte Weg räumt l, k und weiter nach dem Laden aus der Adresszeile.
    // Ohne dieses Sitzungs-Cookie landete ein Neuladen ohne die Parameter bei
    // der Zuteilung — und ein Lead-Link womöglich auf dem neuen Weg, der ihn
    // nicht kennt. Ein vorhandenes Cookie bleibt unangetastet.
    if (!vorhanden) weicheCookieSetzen(res, `alt.${neueKennung()}`, false);
    return { weg: "alt", grund: "link" };
  }

  const offen = antragAusCookie(req);
  if (offen) return { weg: await offenerAntragWeg(offen), grund: "antrag_offen" };

  if (vorhanden) return { weg: vorhanden.weg, grund: "cookie" };

  const weg: AntragWegWahl = Math.random() * 100 < anteil ? "neu" : "alt";
  const id = neueKennung();
  weicheCookieSetzen(res, `${weg}.${id}`, true);
  if (zuteilungMessenErlaubt(req)) {
    void zuteilungMerken(weg, id, anteil, ua).catch((e: any) => {
      console.warn("[ANTRAG-WEICHE] Zuteilung nicht gemessen:", e?.message || e);
    });
  }
  return { weg, grund: "zugeteilt" };
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
  geaendertAm: string | null;
  geaendertVon: string | null;
  stufen: number[];
}

/** Anteil frisch aus der Tabelle (nicht aus dem Speicher), dazu wann und von wem zuletzt geändert. */
export async function weicheStand(): Promise<WeicheStand> {
  const [z] = (await sqlPool`SELECT value, updated_at FROM fiaon_settings WHERE key = ${WEICHE_EINSTELLUNG}`) as any[];
  const anteil = anteilAusText(z?.value);
  anteilStand = { wert: anteil, bis: Date.now() + 30_000 };
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
    anteilStand = { wert: anteil, bis: Date.now() + 30_000 };
    if (vorher.anteil !== anteil) {
      // Abgewartet, damit „geändert von" in der Antwort schon stimmt. chefProtokoll wirft nie.
      await chefProtokoll(req, PROTOKOLL_ZIEL, `Anteil neuer Antrag: ${vorher.anteil} % → ${anteil} %`);
    }
    res.json({ ok: true, geaendert: vorher.anteil !== anteil, ...(await weicheStand()) });
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
