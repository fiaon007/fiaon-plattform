// ═══════════════════════════════════════════════════════════════════════════
// /api/fiaon/global — „GESPRÄCH VEREINBAREN" FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// Justin: „… oder eben eine Beratung zuvor buchen." Die Seite /business zeigt
// dafür einen Kalender mit den freien Zeiten der zuständigen Person — und,
// wenn keine Zeit frei ist, ein Anfrageformular. KEIN LOGIN, KEIN TOKEN, wie
// bei /justin (E-124): Wer die Seite sieht, darf buchen.
//
//   GET  /termine/frei?tage=14   freie Zeiten, Ansprechpartner, rueckfall — E-476 Scheibe 3: mit dem
//                                persönlichen Link (HttpOnly-Cookie fiaon_g) dazu die Vorlage des Leads
//   POST /termine                Termin buchen (409 mit frischen Zeiten, wenn
//                                die Zeit inzwischen vergeben ist) — mit Link an DIESER Anfrage
//   POST /anfrage                Rückfall und „lieber ein Anruf" → { ok, meldung }
//   GET  /termine/kalender/<storno-token>.ics   der Termin als Kalenderdatei
//
// Was dahinter geschieht — zuständige Person, Zeitregeln, Firmenkontakt,
// Firmen-Lead, Bestätigung, Auftrag — steht in server/lib/fiaon-global-termin.ts;
// die Zeitrechnung selbst rein in server/lib/fiaon-global-zeiten.ts. Diese
// Datei ist nur die Tür: lesen, prüfen, antworten.
//
// TEXTE: Alles, was hier zurückgeht, liest ein Unternehmen — Sie-Form, und
// durch die Wortwand (scripts/pruef-global-termin.ts prüft jeden Satz).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { kampagneSpeichern } from "../lib/fiaon-werbung";
import {
  globalAngebotLaden, globalKontaktLesen, globalZuViel, globalTerminBuchen, globalAnfrageAnnehmen,
  globalKalenderZuToken, GLOBAL_ZEITZONE, type GlobalAngebotStand, type GlobalKontakt,
} from "../lib/fiaon-global-termin";
import { GLOBAL_DAUER_MIN, GLOBAL_HORIZONT_TAGE } from "../lib/fiaon-global-zeiten";
import { GLOBAL_TEXTE, globalText } from "@shared/fiaon-global-termin-texte";
import { visitenkarteFuerAgent } from "@shared/fiaon-visitenkarte";
// E-476 Scheibe 3: der persönliche Link — der Code kommt im Cookie (nie in der Adresse der Seite).
import { LEAD_CODE_COOKIE, LEAD_GB_COOKIE, LEAD_COOKIE_PFAD, LEAD_WEG_VORGABE, leadCodeForm, metaLeadKennung } from "@shared/fiaon-lead-weg";
import { aufrufClientIp } from "../lib/fiaon-global-angebot-aufrufe";
// E-481 (Mara Business): der WhatsApp-Satz im Formular (Ja zu WhatsApp) und die Wahl des Gesprächswegs.
import { globalWaHinweisGezeigt } from "@shared/fiaon-whatsapp-erlaubnis";

const router = Router();

/**
 * E-481: Ja zu WhatsApp aus dem Formular merken (nur bei wortgleichem Satz). Wirft nie, wartet nicht. E-487 (09.11.2026): MIT
 * der Anfrage (Buchung über den Link bzw. eine offene Anfrage, „lieber ein Anruf“) und dem Land des Formulars — vorher immer
 * ohne Anfrage: Die Website-Ja vom 05.–07.11. verpufften, die Terminnachricht auf WhatsApp erreichte keinen.
 */
function waJaMerken(b: any, kontakt: { telefon: string; land?: string | null }, anfrageId: number | null | undefined): void {
  if (!globalWaHinweisGezeigt(b?.waHinweis)) return;
  void import("../lib/fiaon-mara-business")
    .then((mb) => mb.websiteOptinMerken({ anfrageId: anfrageId ?? null, telefon: kontakt.telefon, land: kontakt.land ?? null, satz: String(b.waHinweis).trim() }))
    .catch(() => {});
}
/** E-481: der WhatsApp-Link zu Mara (mit Kennung des persönlichen Links, sonst mit „FIAON Global“) — null, wenn Mara Business aus ist. */
async function waLinkFuer(req: Request, sprache: "de" | "en"): Promise<string | null> {
  try {
    const mb = await import("../lib/fiaon-mara-business");
    if (!(await mb.mbAn())) return null;
    return await mb.mbWaLink(codeAus(req), sprache);
  } catch { return null; }
}

/** Das, was die Oberfläche vom Angebot wissen muss — an einer Stelle gebaut. */
function angebotAntwort(a: GlobalAngebotStand) {
  return {
    zeitzone: GLOBAL_ZEITZONE,
    dauerMin: GLOBAL_DAUER_MIN,
    tage: a.tage,
    // 19.09.2026: nur der Vorname — das Profilbild einer Mitarbeiterin/eines Mitarbeiters gehört ohne
    // ausdrückliche Freigabe nicht auf eine öffentliche Seite (die Seite zeigt den Anfangsbuchstaben).
    // E-309 (08.10.2026, Justin): Steht die Person auf /team (shared/fiaon-visitenkarte.ts), kommt ihr Kürzel mit —
    // die Seite zeigt dann Porträt, vollen Namen, Rolle, Mail und Nummer von dort. Sonst bleibt es beim Vornamen.
    ansprechpartner: a.person ? { vorname: a.person.vorname, kuerzel: visitenkarteFuerAgent(a.person.id)?.kuerzel ?? null } : null,
    rueckfall: a.rueckfall,
  };
}

// E-476 Nachbesserung (Gutachten Sicherheit, Mangel 2 und 7): die ECHTE Adresse des Aufrufers — cf-connecting-ip setzt Cloudflare
// selbst; den ersten X-Forwarded-For-Eintrag setzt der Aufrufer frei (die Bremse ließe sich sonst umgehen).
function ipVon(req: Request): string {
  return aufrufClientIp(req as any);
}

// ── Die Messung an Meta (23.09.2026, E-231) ─────────────────────────────────
// Ein Global-Gespräch lief nie über buchungAnwenden — dort sitzt die
// Schedule-Meldung der Privatkunden. Deshalb meldet es diese Tür selbst, unter
// einer Referenz, die der Browser als `messRef` zurückbekommt und für den
// Pixel benutzt: eine Kennung, ein Ereignis. Ohne Marketing-Einwilligung im
// Browser wird nichts gespeichert (ereignisMitMessung prüft das).
function gespraechMelden(req: Request, messRef: string, kontakt: GlobalKontakt): void {
  void import("../lib/fiaon-meta-capi")
    .then((c) => c.ereignisMitMessung(c.META_EREIGNIS.termin, messRef, req.body?.messung, {
      ip: ipVon(req) || null, ua: String(req.headers["user-agent"] ?? ""), paket: kontakt.paket,
      kontakt: { email: kontakt.email, telefon: kontakt.telefon, vorname: kontakt.vorname, nachname: kontakt.nachname },
    }))
    .catch((e) => console.error(`[GLOBAL-TERMIN] Messung ${messRef} nicht gemeldet:`, e));
}

// ── E-476 Scheibe 3: der persönliche Link ─────────────────────────────────────
// /g/<code> (server/routes.ts) und der Meta-Danke-Knopf /gb?lid=… (fiaon-kurzlink.ts) setzen ein HttpOnly-Cookie NUR für
// /api/fiaon/global und leiten auf die Seite — der Code steht nie in der Adresse der Seite (kein Pixel, keine Statistik,
// kein Verlauf sieht ihn). Diese Tür liest ihn: GET /termine/frei liefert die Vorlage (Name, Firma, Mail, Telefon — nur,
// was der Lead selbst angegeben hat), POST /termine bucht an DIESER Anfrage. `?code=` geht auch (Prüfstand, Cockpit).
function schutzKoepfe(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
}
function codeAus(req: Request): string | null {
  const roh = String((req.query?.code as string) ?? (req as any).cookies?.[LEAD_CODE_COOKIE] ?? "").trim();
  return leadCodeForm(roh) ? roh : null;
}
export function leadCookieSetzen(res: Response, code: string): void {
  res.cookie(LEAD_CODE_COOKIE, code, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: LEAD_WEG_VORGABE.cookieStunden * 3_600_000, path: LEAD_COOKIE_PFAD,
  });
}

/** Die Vorlage aus dem Link — oder (Danke-Knopf) „folgt“, solange die Anfrage aus Meta noch unterwegs ist. */
async function vorlageFuer(req: Request, res: Response): Promise<{ vorlage: { name: string; firma: string; email: string; telefon: string } | null; folgt: boolean }> {
  const { leadCodeLesen, leadCodeSichern, metaDankeAufloesen } = await import("../lib/fiaon-lead-weg");
  let code = codeAus(req);
  if (!code) {
    // Nachbesserung (Gutachten Technik Mangel 10, Sicherheit Mangel 9): nur ein von /gb GESTEMPELTES Cookie zählt, und nur für
    // einen frischen Lead (2 Stunden) — danach gilt nur der persönliche Link aus der Mail.
    const { gbCookieLesen } = await import("../lib/fiaon-lead-weg");
    const lid = metaLeadKennung(gbCookieLesen((req as any).cookies?.[LEAD_GB_COOKIE]));
    if (!lid) return { vorlage: null, folgt: false };
    const auf = await metaDankeAufloesen(lid, { holen: false, nurFrisch: true }).catch(() => null);
    if (auf === "folgt") return { vorlage: null, folgt: true };
    res.clearCookie(LEAD_GB_COOKIE, { path: LEAD_COOKIE_PFAD });
    if (!auf) return { vorlage: null, folgt: false };
    const link = await leadCodeSichern(auf.anfrageId).catch(() => null);
    if (!link) return { vorlage: null, folgt: false };
    leadCookieSetzen(res, link.code);
    code = link.code;
  }
  const v = await leadCodeLesen(code).catch(() => null);
  if (!v) {
    // Abgelaufen oder unbekannt: die normale Fläche — und das Cookie weg.
    res.clearCookie(LEAD_CODE_COOKIE, { path: LEAD_COOKIE_PFAD });
    return { vorlage: null, folgt: false };
  }
  return { vorlage: { name: v.name, firma: v.firma, email: v.email, telefon: v.telefon }, folgt: false };
}

// ── GET /termine/frei ───────────────────────────────────────────────────────
router.get("/termine/frei", async (req: Request, res: Response) => {
  try {
    const wunsch = Math.round(Number(req.query.tage));
    const tage = Number.isFinite(wunsch) && wunsch >= 1 ? Math.min(wunsch, GLOBAL_HORIZONT_TAGE) : GLOBAL_HORIZONT_TAGE;
    const a = await globalAngebotLaden(tage);
    if (a.rueckfall) console.log(`[GLOBAL-TERMIN] Rückfall auf die Anfrage: ${a.grund}${a.person ? ` (${a.person.name})` : ""}`);
    // Die Vorlage hängt nie am Kalender: eine Störung hier = die normale Fläche.
    const v = await vorlageFuer(req, res).catch((e) => { console.error("[GLOBAL-TERMIN] Vorlage:", String(e).slice(0, 160)); return { vorlage: null, folgt: false }; });
    // E-481: die Wahl „lieber schriftlich“ — der WhatsApp-Link zu Mara (mit Kennung, wenn der persönliche Link mitkam).
    const waLink = await waLinkFuer(req, String(req.query.sprache ?? "").toLowerCase().startsWith("en") ? "en" : "de");
    // Freie Zeiten sind flüchtig — kein Zwischenspeicher darf sie festhalten; die Vorlage gehört niemandem sonst.
    schutzKoepfe(res);
    res.json({ ok: true, ...angebotAntwort(a), ...(v.vorlage ? { vorlage: v.vorlage, persoenlich: true } : {}), ...(v.folgt ? { vorlageFolgt: true } : {}), ...(waLink ? { waLink } : {}) });
  } catch (err) {
    console.error("[GLOBAL-TERMIN] frei:", err);
    res.status(500).json({ ok: false, error: GLOBAL_TEXTE.de.fehlerLaden });
  }
});

// ── POST /termine ───────────────────────────────────────────────────────────
router.post("/termine", async (req: Request, res: Response) => {
  const b = req.body || {};
  const en = String(b.sprache ?? "").toLowerCase().startsWith("en");
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;
  // Honigtopf: Das Feld „falle" sieht kein Mensch. Wer es füllt, bekommt ein
  // freundliches Ja und keinen Termin.
  if (String(b.falle ?? "").trim()) return res.json({ ok: true, terminId: null, wann: null, ansprechpartner: null });

  const kontakt = globalKontaktLesen(b);
  if ("error" in kontakt) return res.status(400).json({ ok: false, error: kontakt.error, feld: kontakt.feld });
  const tag = String(b.tag ?? "").trim();
  const zeit = String(b.zeit ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !/^\d{2}:\d{2}$/.test(zeit)) {
    return res.status(400).json({ ok: false, error: T.fehlerZeitWaehlen, feld: "zeit" });
  }
  if (globalZuViel(ipVon(req), kontakt.email)) {
    return res.status(429).json({ ok: false, error: T.fehlerZuSchnell });
  }

  try {
    const thema = String(b.thema ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
    // E-476 Scheibe 3: der persönliche Link (Cookie) — die Buchung hängt dann an DIESER Anfrage.
    const erg = await globalTerminBuchen({ kontakt, tag, zeit, thema, code: codeAus(req) });
    if (erg.ok) {
      void kampagneSpeichern("termin", erg.terminId, b.kampagne);
      waJaMerken(b, kontakt, erg.anfrageId);
      // E-476 Scheibe 3 (Logbuch 03.11. 18:30, „kein ARAS für Leads“): Das Buchungsformular trägt keinen ARAS-Hinweis mehr,
      // und diese Tür speichert keinen Nachweis für einen Erinnerungsanruf. Schickt ein Browser mit altem Stand den Satz
      // noch mit, wird er übergangen — die Erinnerung kommt per Mail (Vortag, eine Stunde vorher).
      res.clearCookie(LEAD_CODE_COOKIE, { path: LEAD_COOKIE_PFAD });
      const messRef = `global-termin-${erg.terminId}`;
      gespraechMelden(req, messRef, kontakt);
      return res.json({
        ok: true, terminId: erg.terminId, wann: erg.wann, datumText: erg.datumText, uhrzeit: erg.uhrzeit,
        ansprechpartner: erg.ansprechpartner, kalenderUrl: erg.kalenderUrl, messRef,
      });
    }
    // 409: Die Zeit ist weg — die frischen Zeiten kommen gleich mit, damit die
    // Seite nicht neu laden muss, um weiterzumachen.
    return res.status(erg.status).json({
      ok: false, error: erg.error, grund: erg.grund, ...(erg.feld ? { feld: erg.feld } : {}),
      ...(erg.angebot ? angebotAntwort(erg.angebot) : {}),
    });
  } catch (err) {
    console.error("[GLOBAL-TERMIN] buchen:", err);
    res.status(500).json({ ok: false, error: T.fehlerServer });
  }
});

// ── POST /anfrage ───────────────────────────────────────────────────────────
// Eine Anfrage je Adresse und Minute — dieselbe Bremse wie fiaon-anfragen.ts:
// Der Doppelklick bekommt ein Ja, aber keinen zweiten Auftrag.
const letzteAnfrage = new Map<string, number>();
// E-476 Nachbesserung (Gutachten Sicherheit, Mangel 2): dazu je ANSCHLUSS höchstens 3 Anfragen in 15 Minuten und 10 am Tag —
// sonst ließe sich über das öffentliche Formular eine Flut fremder Adressen einspielen (jede bekäme Justins Willkommen).
const anfragenJeIp = new Map<string, number[]>();
export function anfrageZuViel(ip: string, jetzt: number = Date.now()): boolean {
  if (!ip) return false;
  const liste = (anfragenJeIp.get(ip) ?? []).filter((z) => jetzt - z < 86_400_000);
  if (liste.filter((z) => jetzt - z < 15 * 60_000).length >= 3 || liste.length >= 10) { anfragenJeIp.set(ip, liste); return true; }
  liste.push(jetzt); anfragenJeIp.set(ip, liste);
  if (anfragenJeIp.size > 5000) for (const [k, v] of Array.from(anfragenJeIp.entries())) if (!v.some((z) => jetzt - z < 86_400_000)) anfragenJeIp.delete(k);
  return false;
}

router.post("/anfrage", async (req: Request, res: Response) => {
  const b = req.body || {};
  const en = String(b.sprache ?? "").toLowerCase().startsWith("en");
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;
  if (String(b.falle ?? "").trim()) return res.json({ ok: true });

  const kontakt = globalKontaktLesen(b);
  if ("error" in kontakt) return res.status(400).json({ ok: false, error: kontakt.error, feld: kontakt.feld });
  const jetzt = Date.now();
  if (jetzt - (letzteAnfrage.get(kontakt.email) ?? 0) < 60_000) return res.json({ ok: true, meldung: T.anfrageDankeOhneName });
  if (anfrageZuViel(ipVon(req), jetzt)) return res.status(429).json({ ok: false, error: T.fehlerZuSchnell });
  letzteAnfrage.set(kontakt.email, jetzt);

  try {
    // E-476 Nachbesserung (Gutachten Lead-Sicht, Mangel 8): Kommt er über seinen persönlichen Link (Cookie) und bittet um einen
    // Rückruf, entsteht KEINE zweite Anfrage — DIESE Anfrage bekommt seine Wunschzeit, der Anruf-Auftrag hängt sie an.
    const code = codeAus(req);
    if (code) {
      const { leadCodeLesen } = await import("../lib/fiaon-lead-weg");
      const v = await leadCodeLesen(code, { schema: false }).catch(() => null);
      if (v) {
        const { leadRueckrufWunsch } = await import("../lib/fiaon-global-lead-post");
        const r = await leadRueckrufWunsch(v.anfrageId, {
          wunschzeit: String(b.wunschzeit ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null,
          text: String(b.text ?? "").trim().slice(0, 4000) || null,
          firma: kontakt.firma, name: kontakt.name, telefon: kontakt.telefon, email: kontakt.email,
        });
        if (r.ok) {
          waJaMerken(b, kontakt, v.anfrageId);
          res.clearCookie(LEAD_CODE_COOKIE, { path: LEAD_COOKIE_PFAD });
          return res.json({ ok: true, meldung: r.zustaendigName ? globalText(T.anfrageDanke, { name: r.zustaendigName }) : T.anfrageDankeOhneName });
        }
      }
    }
    const erg = await globalAnfrageAnnehmen({
      kontakt,
      wunschzeit: String(b.wunschzeit ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null,
      text: String(b.text ?? "").trim().slice(0, 4000) || null,
      ip: ipVon(req),
    });
    void kampagneSpeichern("anfrage", erg.anfrageId, b.kampagne);
    waJaMerken(b, kontakt, erg.anfrageId);
    // Die Rückruf-Bitte zählt wie das Gespräch (Schedule) — so meldete es der Pixel schon immer.
    const messRef = `global-anfrage-${erg.anfrageId}`;
    gespraechMelden(req, messRef, kontakt);
    // Die Antwort nennt die Person, bei der der Auftrag WIRKLICH liegt — und
    // nennt niemanden, wenn er beim Betreiber gelandet ist.
    res.json({
      ok: true,
      meldung: erg.zustaendigName && !erg.anBetreiber
        ? globalText(T.anfrageDanke, { name: erg.zustaendigName }) : T.anfrageDankeOhneName,
      messRef,
    });
  } catch (err) {
    // Die Sperre wieder lösen: Ein Serverfehler darf den zweiten Versuch nicht
    // stumm schlucken — sonst glaubt das Unternehmen, die Anfrage sei da.
    letzteAnfrage.delete(kontakt.email);
    console.error("[GLOBAL-TERMIN] anfrage:", err);
    res.status(500).json({ ok: false, error: T.fehlerServer });
  }
});

// ── POST /gespraechsweg ─────────────────────────────────────────────────────
// E-481 (Mara Business, Justin: „der Kunde sich aussuchen kann, telefonische Beratung, Beratung via Mail … WhatsApp“): Auf der
// Seite hinter dem persönlichen Link wählt er „Per E-Mail“ oder tippt „Auf WhatsApp mit Mara“. Nur mit seinem Code (Cookie) —
// ohne Link weiß niemand, wer er ist. E-Mail: Justin schreibt ihm aus js@ (Mail an Justin), Daniels Anruf-Auftrag schließt sich.
router.post("/gespraechsweg", async (req: Request, res: Response) => {
  try {
    const weg = String(req.body?.weg ?? "");
    if (weg !== "mail" && weg !== "whatsapp") return res.status(400).json({ ok: false });
    const code = codeAus(req);
    if (!code) return res.json({ ok: false, grund: "ohne_link" });
    const { wegAusWebsite } = await import("../lib/fiaon-mara-business");
    const erg = await wegAusWebsite(code, weg);
    schutzKoepfe(res);
    res.json({ ok: erg.ok, ...(weg === "mail" && erg.email ? { email: erg.email } : {}) });
  } catch (err) {
    console.error("[GLOBAL-TERMIN] gespraechsweg:", err);
    res.status(500).json({ ok: false });
  }
});

// ── GET /termine/kalender/<storno-token>.ics ────────────────────────────────
// Der Link steht in der Bestätigung. Der Storno-Token ist das Geheimnis, das
// das Unternehmen ohnehin in derselben Mail hält (48 Hex-Zeichen, je Termin).
// E-263 (Gegenprüfung 29.09.2026): ?sprache=en → englische Datei; abgesagt →
// METHOD:CANCEL mit derselben UID statt 410 (nimmt das Gespräch aus dem Kalender).
router.get("/termine/kalender/:datei", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.datei || "").replace(/\.ics$/i, "");
    const k = await globalKalenderZuToken(token, String(req.query.sprache ?? "") === "en" ? "en" : "de");
    if (!k) return res.status(404).type("text/plain").send("Dieser Termin wurde nicht gefunden.");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${k.abgesagt ? "fiaon-global-absage.ics" : "fiaon-global-gespraech.ics"}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(k.datei);
  } catch (err) {
    console.error("[GLOBAL-TERMIN] kalender:", err);
    res.status(500).type("text/plain").send("Die Kalenderdatei konnte nicht erstellt werden.");
  }
});

export default router;
