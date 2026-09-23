// ═══════════════════════════════════════════════════════════════════════════
// BUCHHALTUNG — die Türen (23.09.2026, E-227)
//
// Die Regeln stehen in server/lib/fiaon-buchhaltung.ts; hier ist nur der Weg
// hinein und hinaus. Die Pfade beginnen bewusst NICHT mit /admin — sonst
// würden blockAgentsFromAdmin und adminCodeGate die eigene Tür zumauern
// (Lehre aus fiaon-chef-zugang.ts).
//
// Zwei Wände:
//   requireBuch()          — angemeldet, egal in welcher Rolle
//   requireBuch("inhaber") — Freigaben, Einlagen, Anfangsbestand
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import {
  BUCH_COOKIE, BUCH_LOGIN, BUCH_LEUTE, BUCH_TTL_MS, type BuchPerson, type BuchRolle,
  buchPerson, buchPasswortStimmt, buchPasswortGesetzt, buchSitzung, buchToken, buchSchema, buchProtokoll,
  pinAnlegen, pinPruefen,
  kasse, bewegungen, bewegungBuchen, bewegungStornieren,
  anfangsbestandSetzen, bankabgleichSetzen, uebergabe, uebergabeSetzen, uebergabeVermerk,
  auftraege, auftrag, auftragAnlegen, auftragEinreichen, auftragZurueckziehen, auftragEntscheiden,
  auftragAusfuehren, bestaetigungLesen, bestaetigungErzeugen, belegLesen, zugangsblatt,
  ibanGueltig, type AuftragStatus,
} from "../lib/fiaon-buchhaltung";
import { sqlPool } from "../lib/db-pool";

const router = Router();

// ── Erster Faktor: kurzlebiger Nachweis, dass das Passwort stimmte ──────────
const TOR_COOKIE = "fiaon_buch_tor";
const TOR_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-buchhaltung-secret";
}

function torSignieren(exp: number): string {
  return createHmac("sha256", secret()).update(`buchtor:${exp}`).digest("hex").slice(0, 40);
}

function torGueltig(req: Request): boolean {
  const t = (req as any).cookies?.[TOR_COOKIE];
  if (typeof t !== "string") return false;
  const [expStr, sig] = t.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const a = Buffer.from(sig); const b = Buffer.from(torSignieren(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Fehlversuche bremsen (Muster fiaon-chef-zugang.ts) ─────────────────────
const versuche = new Map<string, { fails: number; bis: number }>();
const FREI = 5;

function schluessel(req: Request): string {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || "unbekannt";
}

function bremse(key: string): number {
  const a = versuche.get(key) || { fails: 0, bis: 0 };
  a.fails += 1;
  const dauer = a.fails <= FREI ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (a.fails - FREI - 1));
  a.bis = dauer > 0 ? Date.now() + dauer : 0;
  versuche.set(key, a);
  return dauer;
}

function gesperrt(key: string): number {
  const a = versuche.get(key);
  return a ? Math.max(0, a.bis - Date.now()) : 0;
}

// ── Wand ────────────────────────────────────────────────────────────────────
export interface BuchRequest extends Request { buch?: BuchPerson }

export function requireBuch(mindestens?: BuchRolle) {
  return (req: BuchRequest, res: Response, next: NextFunction) => {
    const p = buchSitzung(req);
    if (!p) return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Bitte in der Buchhaltung anmelden." });
    if (mindestens === "inhaber" && p.rolle !== "inhaber") {
      return res.status(403).json({ ok: false, code: "NUR_INHABER", error: "Das darf nur der Inhaber." });
    }
    req.buch = p;
    next();
  };
}

const cents = (v: unknown): number => {
  // Akzeptiert "1.234,56", "1234.56", 1234.56 — und gibt ganze Cent zurück.
  if (typeof v === "number") return Math.round(v * 100);
  const s = String(v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return NaN;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const istTag = (v: unknown): v is string => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

// ═══════════════════════════════════════════════════════════════════════════
// ANMELDUNG
// ═══════════════════════════════════════════════════════════════════════════

/** POST /buchhaltung/anmelden { email, passwort } — erster Faktor. */
router.post("/buchhaltung/anmelden", async (req: Request, res: Response) => {
  try {
    await buchSchema();
    const key = schluessel(req);
    const warten = gesperrt(key);
    if (warten > 0) {
      return res.status(429).json({ ok: false, code: "TOO_MANY", wartezeitMs: warten, error: `Zu viele Fehlversuche. Bitte ${Math.ceil(warten / 1000)} Sekunden warten.` });
    }
    const email = String((req.body as any)?.email || "").trim().toLowerCase();
    const passwort = String((req.body as any)?.passwort || "");
    if (!await buchPasswortGesetzt()) {
      return res.status(503).json({ ok: false, code: "KEIN_PASSWORT", error: "Für die Buchhaltung ist noch kein Passwort hinterlegt." });
    }
    if (email !== BUCH_LOGIN || !(await buchPasswortStimmt(passwort))) {
      const dauer = bremse(key);
      return res.status(401).json({ ok: false, code: "UNGUELTIG", wartezeitMs: dauer, error: "Anmeldedaten ungültig." });
    }
    versuche.delete(key);
    const exp = Date.now() + TOR_TTL_MS;
    res.cookie(TOR_COOKIE, `${exp}.${torSignieren(exp)}`, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: TOR_TTL_MS, path: "/",
    });
    return res.json({
      ok: true, weiter: "pin",
      personen: BUCH_LEUTE.map((p) => ({ email: p.email, name: p.name, titel: p.titel })),
    });
  } catch (err) {
    console.error("[BUCH] anmelden:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /buchhaltung/pin-anfordern { email }
 * Der PIN geht IMMER nur an die eigene Adresse. Wer eine fremde angibt,
 * bekommt nichts — und es steht im Protokoll.
 */
router.post("/buchhaltung/pin-anfordern", async (req: Request, res: Response) => {
  try {
    if (!torGueltig(req)) return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Bitte zuerst mit Passwort anmelden." });
    const person = buchPerson(String((req.body as any)?.email || ""));
    if (!person) return res.status(403).json({ ok: false, error: "Für diese Adresse ist kein Zugang eingerichtet." });

    const pin = await pinAnlegen(person);
    const { mailNeuSenden, gmailBereit } = await import("../lib/fiaon-gmail");
    const text = [
      `Hallo ${person.name.split(" ")[0]},`,
      "",
      "dein Einmal-PIN für die Buchhaltung:",
      "",
      `    ${pin}`,
      "",
      "Er gilt 10 Minuten und nur einmal.",
      "",
      "Falls du dich nicht gerade anmelden wolltest: sag Bescheid, dann ändern wir das Passwort.",
      "",
      "FIAON LTD",
    ].join("\n");

    if (!gmailBereit()) {
      console.error("[BUCH] PIN nicht versendbar — GOOGLE_SA_KEY fehlt");
      return res.status(503).json({ ok: false, error: "Der PIN-Versand ist gerade nicht möglich. Bitte bei js@fiaon.com melden." });
    }
    await mailNeuSenden("js@fiaon.com", person.email, "Dein PIN für die FIAON-Buchhaltung", text);
    buchProtokoll(person.email, "PIN angefordert", null, null);
    return res.json({ ok: true, an: person.email });
  } catch (err) {
    console.error("[BUCH] pin-anfordern:", err);
    return res.status(500).json({ ok: false, error: "Der PIN konnte nicht versendet werden." });
  }
});

/** POST /buchhaltung/pin-pruefen { email, pin } — zweiter Faktor, setzt die Sitzung. */
router.post("/buchhaltung/pin-pruefen", async (req: Request, res: Response) => {
  try {
    if (!torGueltig(req)) return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Bitte zuerst mit Passwort anmelden." });
    const person = buchPerson(String((req.body as any)?.email || ""));
    if (!person) return res.status(403).json({ ok: false, error: "Für diese Adresse ist kein Zugang eingerichtet." });
    const erg = await pinPruefen(person, String((req.body as any)?.pin || ""));
    if (!erg.ok) return res.status(401).json({ ok: false, error: erg.grund });

    res.clearCookie(TOR_COOKIE, { path: "/" });
    res.cookie(BUCH_COOKIE, buchToken(person.email), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: BUCH_TTL_MS, path: "/",
    });
    buchProtokoll(person.email, "Angemeldet", null, null);
    console.log(`[BUCH] Anmeldung: ${person.name}`);
    return res.json({ ok: true, ich: { email: person.email, name: person.name, rolle: person.rolle, titel: person.titel } });
  } catch (err) {
    console.error("[BUCH] pin-pruefen:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/buchhaltung/status", async (req: Request, res: Response) => {
  const p = buchSitzung(req);
  if (!p) {
    return res.json({ ok: true, angemeldet: false, login: BUCH_LOGIN, passwortGesetzt: await buchPasswortGesetzt().catch(() => false) });
  }
  return res.json({ ok: true, angemeldet: true, ich: { email: p.email, name: p.name, rolle: p.rolle, titel: p.titel } });
});

router.post("/buchhaltung/abmelden", (req: Request, res: Response) => {
  const p = buchSitzung(req);
  if (p) buchProtokoll(p.email, "Abgemeldet", null, null);
  res.clearCookie(BUCH_COOKIE, { path: "/" });
  res.clearCookie(TOR_COOKIE, { path: "/" });
  res.json({ ok: true, angemeldet: false });
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/lage", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const [k, offen, alle, bew, u] = await Promise.all([
      kasse(),
      auftraege(["eingereicht", "freigegeben"] as AuftragStatus[], 100),
      auftraege(null, 120),
      bewegungen(150),
      uebergabe(),
    ]);
    res.json({
      ok: true,
      ich: req.buch,
      kasse: k,
      offen,
      auftraege: alle,
      bewegungen: bew,
      uebergabe: u,
      leute: BUCH_LEUTE,
    });
  } catch (err) {
    console.error("[BUCH] lage:", err);
    res.status(500).json({ ok: false, error: "Die Lage konnte nicht geladen werden." });
  }
});

router.get("/buchhaltung/protokoll", requireBuch(), async (_req: Request, res: Response) => {
  try {
    await buchSchema();
    const rows = (await sqlPool`SELECT person, aktion, ziel, notiz, zeit FROM fiaon_buch_log ORDER BY zeit DESC LIMIT 200`) as any[];
    res.json({ ok: true, zeilen: rows.map((r) => ({
      person: r.person, aktion: r.aktion, ziel: r.ziel, notiz: r.notiz, zeit: new Date(r.zeit).toISOString(),
    })) });
  } catch (err) {
    console.error("[BUCH] protokoll:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KASSE — Anfangsbestand, Einlagen, Bankabgleich
// ═══════════════════════════════════════════════════════════════════════════
router.post("/buchhaltung/anfangsbestand", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const c = cents(b?.betrag);
    if (!Number.isFinite(c)) return res.status(400).json({ ok: false, error: "Bitte einen Betrag angeben." });
    if (!istTag(b?.am)) return res.status(400).json({ ok: false, error: "Bitte das Datum des Kontostands angeben (JJJJ-MM-TT)." });
    await anfangsbestandSetzen({ cents: c, am: String(b.am), notiz: String(b?.notiz || "").slice(0, 300), von: req.buch!.email });
    buchProtokoll(req.buch!.email, "Anfangsbestand gesetzt", String(b.am), `${(c / 100).toFixed(2)} €`);
    res.json({ ok: true, kasse: await kasse() });
  } catch (err) {
    console.error("[BUCH] anfangsbestand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/buchhaltung/abgleich", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const c = cents(b?.betrag);
    if (!Number.isFinite(c)) return res.status(400).json({ ok: false, error: "Bitte den Kontostand angeben." });
    if (!istTag(b?.am)) return res.status(400).json({ ok: false, error: "Bitte das Datum angeben (JJJJ-MM-TT)." });
    await bankabgleichSetzen({ cents: c, am: String(b.am), von: req.buch!.email, erfasst: new Date().toISOString() });
    buchProtokoll(req.buch!.email, "Bankabgleich erfasst", String(b.am), `${(c / 100).toFixed(2)} €`);
    res.json({ ok: true, kasse: await kasse() });
  } catch (err) {
    console.error("[BUCH] abgleich:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Bewegungen von Hand — Einlagen, sonstige Eingänge, Kosten außerhalb des
 * Auftragswegs. Bewusst nur der Inhaber: Der Weg der Buchhaltung für Geld
 * nach draußen ist der Zahlungsauftrag mit Freigabe, nicht die freie Buchung.
 */
router.post("/buchhaltung/bewegung", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const art = String(b?.art || "");
    if (!["einlage", "eingang", "ausgabe"].includes(art)) return res.status(400).json({ ok: false, error: "Unbekannte Art." });
    const c = cents(b?.betrag);
    if (!Number.isFinite(c) || c <= 0) return res.status(400).json({ ok: false, error: "Bitte einen Betrag größer als null angeben." });
    if (!istTag(b?.wertAm)) return res.status(400).json({ ok: false, error: "Bitte das Wertstellungsdatum angeben (JJJJ-MM-TT)." });
    const zweck = String(b?.zweck || "").trim();
    if (!zweck) return res.status(400).json({ ok: false, error: "Bitte einen Zweck angeben — eine Buchung ohne Zweck ist keine Buchung." });
    const bew = await bewegungBuchen({
      art: art as any, betragCents: c, wertAm: String(b.wertAm), zweck,
      gegenpartei: String(b?.gegenpartei || "").trim() || null,
      beleg: String(b?.beleg || "").trim() || null,
    }, req.buch!);
    res.json({ ok: true, bewegung: bew, kasse: await kasse() });
  } catch (err) {
    console.error("[BUCH] bewegung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/buchhaltung/bewegung/:id/stornieren", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const grund = String((req.body as any)?.grund || "").trim();
    if (!grund) return res.status(400).json({ ok: false, error: "Bitte einen Grund angeben." });
    const erg = await bewegungStornieren(Number(req.params.id), req.buch!, grund);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, kasse: await kasse() });
  } catch (err) {
    console.error("[BUCH] stornieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSAUFTRÄGE
// ═══════════════════════════════════════════════════════════════════════════
router.post("/buchhaltung/auftrag", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const empfaenger = String(b?.empfaenger || "").trim();
    const iban = String(b?.iban || "").replace(/\s+/g, "").toUpperCase();
    const zweck = String(b?.zweck || "").trim();
    const c = cents(b?.betrag);
    if (!empfaenger) return res.status(400).json({ ok: false, error: "Bitte den Empfänger angeben." });
    if (!ibanGueltig(iban)) return res.status(400).json({ ok: false, error: "Die IBAN stimmt nicht (Prüfziffer). Bitte noch einmal ansehen." });
    if (!Number.isFinite(c) || c <= 0) return res.status(400).json({ ok: false, error: "Bitte einen Betrag größer als null angeben." });
    if (!zweck) return res.status(400).json({ ok: false, error: "Bitte einen Verwendungszweck angeben." });
    const belegBase64 = typeof b?.belegBase64 === "string" ? b.belegBase64.replace(/^data:[^,]+,/, "") : null;
    if (belegBase64 && belegBase64.length > 8_000_000) {
      return res.status(413).json({ ok: false, error: "Der Beleg ist zu groß (max. ca. 6 MB)." });
    }
    const a = await auftragAnlegen({
      empfaenger, iban, bic: String(b?.bic || "").trim().toUpperCase() || null,
      betragCents: c, zweck, kategorie: String(b?.kategorie || "").trim() || null,
      faelligAm: istTag(b?.faelligAm) ? String(b.faelligAm) : null,
      belegName: String(b?.belegName || "").trim() || null, belegBase64,
    }, req.buch!);
    res.json({ ok: true, auftrag: a });
  } catch (err) {
    console.error("[BUCH] auftrag:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/buchhaltung/auftrag/:id/einreichen", requireBuch(), async (req: BuchRequest, res: Response) => {
  const erg = await auftragEinreichen(Number(req.params.id), req.buch!);
  if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
  res.json({ ok: true, auftrag: erg.auftrag });
});

router.post("/buchhaltung/auftrag/:id/zurueckziehen", requireBuch(), async (req: BuchRequest, res: Response) => {
  const erg = await auftragZurueckziehen(Number(req.params.id), req.buch!);
  if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
  res.json({ ok: true, auftrag: erg.auftrag });
});

router.post("/buchhaltung/auftrag/:id/entscheiden", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  const frei = (req.body as any)?.frei === true;
  const notiz = String((req.body as any)?.notiz || "").trim() || null;
  if (!frei && !notiz) return res.status(400).json({ ok: false, error: "Eine Ablehnung braucht einen Grund." });
  const erg = await auftragEntscheiden(Number(req.params.id), frei, req.buch!, notiz);
  if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
  res.json({ ok: true, auftrag: erg.auftrag, kasse: await kasse() });
});

router.post("/buchhaltung/auftrag/:id/ausfuehren", requireBuch(), async (req: BuchRequest, res: Response) => {
  const b = req.body as any;
  const erg = await auftragAusfuehren(Number(req.params.id), req.buch!, String(b?.bankReferenz || ""), istTag(b?.wertAm) ? String(b.wertAm) : null);
  if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
  res.json({ ok: true, auftrag: erg.auftrag, kasse: await kasse() });
});

router.get("/buchhaltung/auftrag/:id/bestaetigung.pdf", requireBuch(), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    let pdf = await bestaetigungLesen(id);
    if (!pdf) {
      const a = await auftrag(id);
      if (!a) return res.status(404).send("Nicht gefunden");
      if (a.status !== "ausgefuehrt") return res.status(409).send("Eine Bestätigung gibt es erst nach der Ausführung.");
      pdf = await bestaetigungErzeugen(id);
    }
    const a = await auftrag(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="FIAON_Zahlungsbestaetigung_${a?.nummer || id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[BUCH] bestaetigung:", err);
    res.status(500).send("Die Bestätigung konnte nicht erzeugt werden.");
  }
});

router.get("/buchhaltung/auftrag/:id/beleg", requireBuch(), async (req: Request, res: Response) => {
  try {
    const b = await belegLesen(Number(req.params.id));
    if (!b) return res.status(404).send("Kein Beleg hinterlegt");
    const pdf = b.name.toLowerCase().endsWith(".pdf");
    res.setHeader("Content-Type", pdf ? "application/pdf" : "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${b.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`);
    res.send(b.daten);
  } catch (err) {
    console.error("[BUCH] beleg:", err);
    res.status(500).send("Serverfehler");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERGABE & PAPIERE
// ═══════════════════════════════════════════════════════════════════════════
router.post("/buchhaltung/uebergabe", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const bisher = String(b?.bisher || "").trim();
    const stichtag = String(b?.stichtag || "").trim();
    if (!bisher) return res.status(400).json({ ok: false, error: "Bitte angeben, wer die Buchhaltung bisher geführt hat." });
    if (!istTag(stichtag)) return res.status(400).json({ ok: false, error: "Bitte den Stichtag angeben (JJJJ-MM-TT)." });
    const alt = await uebergabe();
    await uebergabeSetzen({ bisher, stichtag, bestaetigtVon: alt?.bestaetigtVon, bestaetigtAm: alt?.bestaetigtAm });
    buchProtokoll(req.buch!.email, "Übergabe hinterlegt", stichtag, bisher);
    res.json({ ok: true, uebergabe: await uebergabe() });
  } catch (err) {
    console.error("[BUCH] uebergabe:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/buchhaltung/uebergabe/bestaetigen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const u = await uebergabe();
    if (!u) return res.status(404).json({ ok: false, error: "Es ist keine Übergabe hinterlegt." });
    if (u.bestaetigtVon) return res.status(409).json({ ok: false, error: "Die Übernahme ist bereits bestätigt." });
    if (req.buch!.rolle !== "buchhaltung") return res.status(403).json({ ok: false, error: "Bestätigen kann nur, wer übernimmt." });
    await uebergabeSetzen({ ...u, bestaetigtVon: req.buch!.email, bestaetigtAm: new Date().toISOString() });
    buchProtokoll(req.buch!.email, "Übernahme bestätigt", u.stichtag, null);
    res.json({ ok: true, uebergabe: await uebergabe() });
  } catch (err) {
    console.error("[BUCH] uebergabe bestaetigen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/buchhaltung/uebergabe.pdf", requireBuch(), async (_req: Request, res: Response) => {
  try {
    const pdf = await uebergabeVermerk();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="FIAON_Uebergabe_Buchhaltung.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error("[BUCH] uebergabe.pdf:", err);
    res.status(500).send("Der Vermerk konnte nicht erzeugt werden.");
  }
});

router.get("/buchhaltung/zugang.pdf", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const wunsch = String(req.query.fuer || "").toLowerCase();
    const ziel = (req.buch!.rolle === "inhaber" && buchPerson(wunsch)) || req.buch!;
    const pdf = await zugangsblatt(ziel);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="FIAON_Zugang_Buchhaltung_${ziel.name.split(" ").pop()}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[BUCH] zugang.pdf:", err);
    res.status(500).send("Das Zugangsblatt konnte nicht erzeugt werden.");
  }
});

export default router;
