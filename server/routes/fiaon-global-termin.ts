// ═══════════════════════════════════════════════════════════════════════════
// /api/fiaon/global — „GESPRÄCH VEREINBAREN" FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// Justin: „… oder eben eine Beratung zuvor buchen." Die Seite /business zeigt
// dafür einen Kalender mit den freien Zeiten der zuständigen Person — und,
// wenn keine Zeit frei ist, ein Anfrageformular. KEIN LOGIN, KEIN TOKEN, wie
// bei /justin (E-124): Wer die Seite sieht, darf buchen.
//
//   GET  /termine/frei?tage=14   freie Zeiten, Ansprechpartner, rueckfall
//   POST /termine                Termin buchen (409 mit frischen Zeiten, wenn
//                                die Zeit inzwischen vergeben ist)
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
  globalKalenderZuToken, GLOBAL_ZEITZONE, type GlobalAngebotStand,
} from "../lib/fiaon-global-termin";
import { GLOBAL_DAUER_MIN, GLOBAL_HORIZONT_TAGE } from "../lib/fiaon-global-zeiten";
import { GLOBAL_TEXTE, globalText } from "@shared/fiaon-global-termin-texte";

const router = Router();

/** Das, was die Oberfläche vom Angebot wissen muss — an einer Stelle gebaut. */
function angebotAntwort(a: GlobalAngebotStand) {
  return {
    zeitzone: GLOBAL_ZEITZONE,
    dauerMin: GLOBAL_DAUER_MIN,
    tage: a.tage,
    // 19.09.2026: nur der Vorname — das Profilbild einer Mitarbeiterin/eines Mitarbeiters gehört ohne
    // ausdrückliche Freigabe nicht auf eine öffentliche Seite (die Seite zeigt den Anfangsbuchstaben).
    ansprechpartner: a.person ? { vorname: a.person.vorname } : null,
    rueckfall: a.rueckfall,
  };
}

function ipVon(req: Request): string {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
}

// ── GET /termine/frei ───────────────────────────────────────────────────────
router.get("/termine/frei", async (req: Request, res: Response) => {
  try {
    const wunsch = Math.round(Number(req.query.tage));
    const tage = Number.isFinite(wunsch) && wunsch >= 1 ? Math.min(wunsch, GLOBAL_HORIZONT_TAGE) : GLOBAL_HORIZONT_TAGE;
    const a = await globalAngebotLaden(tage);
    if (a.rueckfall) console.log(`[GLOBAL-TERMIN] Rückfall auf die Anfrage: ${a.grund}${a.person ? ` (${a.person.name})` : ""}`);
    // Freie Zeiten sind flüchtig — kein Zwischenspeicher darf sie festhalten.
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...angebotAntwort(a) });
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
    const erg = await globalTerminBuchen({ kontakt, tag, zeit, thema });
    if (erg.ok) {
      void kampagneSpeichern("termin", erg.terminId, b.kampagne);
      return res.json({
        ok: true, terminId: erg.terminId, wann: erg.wann, datumText: erg.datumText, uhrzeit: erg.uhrzeit,
        ansprechpartner: erg.ansprechpartner, kalenderUrl: erg.kalenderUrl,
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

router.post("/anfrage", async (req: Request, res: Response) => {
  const b = req.body || {};
  const en = String(b.sprache ?? "").toLowerCase().startsWith("en");
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;
  if (String(b.falle ?? "").trim()) return res.json({ ok: true });

  const kontakt = globalKontaktLesen(b);
  if ("error" in kontakt) return res.status(400).json({ ok: false, error: kontakt.error, feld: kontakt.feld });
  const jetzt = Date.now();
  if (jetzt - (letzteAnfrage.get(kontakt.email) ?? 0) < 60_000) return res.json({ ok: true, meldung: T.anfrageDankeOhneName });
  letzteAnfrage.set(kontakt.email, jetzt);

  try {
    const erg = await globalAnfrageAnnehmen({
      kontakt,
      wunschzeit: String(b.wunschzeit ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null,
      text: String(b.text ?? "").trim().slice(0, 4000) || null,
      ip: ipVon(req),
    });
    void kampagneSpeichern("anfrage", erg.anfrageId, b.kampagne);
    // Die Antwort nennt die Person, bei der der Auftrag WIRKLICH liegt — und
    // nennt niemanden, wenn er beim Betreiber gelandet ist.
    res.json({
      ok: true,
      meldung: erg.zustaendigName && !erg.anBetreiber
        ? globalText(T.anfrageDanke, { name: erg.zustaendigName }) : T.anfrageDankeOhneName,
    });
  } catch (err) {
    // Die Sperre wieder lösen: Ein Serverfehler darf den zweiten Versuch nicht
    // stumm schlucken — sonst glaubt das Unternehmen, die Anfrage sei da.
    letzteAnfrage.delete(kontakt.email);
    console.error("[GLOBAL-TERMIN] anfrage:", err);
    res.status(500).json({ ok: false, error: T.fehlerServer });
  }
});

// ── GET /termine/kalender/<storno-token>.ics ────────────────────────────────
// Der Link steht in der Bestätigung. Der Storno-Token ist das Geheimnis, das
// das Unternehmen ohnehin in derselben Mail hält (48 Hex-Zeichen, je Termin).
router.get("/termine/kalender/:datei", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.datei || "").replace(/\.ics$/i, "");
    const k = await globalKalenderZuToken(token);
    if (!k) return res.status(404).type("text/plain").send("Dieser Termin wurde nicht gefunden.");
    if (k.abgesagt) return res.status(410).type("text/plain").send("Dieser Termin wurde abgesagt.");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"fiaon-global-gespraech.ics\"");
    res.setHeader("Cache-Control", "no-store");
    res.send(k.datei);
  } catch (err) {
    console.error("[GLOBAL-TERMIN] kalender:", err);
    res.status(500).type("text/plain").send("Die Kalenderdatei konnte nicht erstellt werden.");
  }
});

export default router;
