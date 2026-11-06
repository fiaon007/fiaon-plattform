// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — die Türen (E-227 → E-228, 23.09.2026)
//
// Die Regeln stehen in server/lib/fiaon-buchhaltung.ts (Zugang, TAN, Aufträge)
// und server/lib/fiaon-banking.ts (Konten, Umsätze, Saldo); die Papiere in
// server/lib/fiaon-banking-pdf.ts. Hier ist nur der Weg hinein und hinaus.
//
// Die Pfade beginnen bewusst NICHT mit /admin — sonst würden
// blockAgentsFromAdmin und adminCodeGate die eigene Tür zumauern.
//
// Drei Wände:
//   requireBuch()          — gültige Sitzung (Datensatz, nicht nur Cookie)
//   requireBuch("inhaber") — Freigaben, Überweisung eintragen, Kontostand
//   gleicheHerkunft        — schreibende Anfragen nur von der eigenen Seite
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import {
  BUCH_COOKIE, BUCH_LOGIN, BUCH_LEUTE, LEERLAUF_MIN, type BuchPerson, type BuchRolle, type Sitzung,
  buchPerson, inhaber, buchPasswortStimmt, buchPasswortGesetzt, buchSchema, buchProtokoll, benachrichtigen,
  pinAnlegen, pinPruefen, istGesperrt, gesperrte, sperreSetzen,
  sitzungAnlegen, sitzungPruefen, sitzungBeenden, sitzungenBeenden, sitzungenListe, letzteAnmeldung, clientIp,
  tanAnfordern, tanPruefen,
  anfangsbestandSetzen, bankabgleichSetzen, uebergabe, uebergabeSetzen,
  bewegungBuchen, bewegungStornieren, BEWEGUNG_ARTEN, type BewegungArt,
  auftraege, auftrag, auftragAnlegen, auftragEinreichen, auftragZurueckziehen,
  auftragFreigeben, auftragAblehnen, auftragAusfuehren, auftragAusAuszahlung, auftragZurueckrufen,
  freigabePruefen, freigabeZiel, freigabeBeschreibung, tanZweck,
  zurFreigabeSenden, alleZurFreigabeSenden, freigabeMailSenden, externBeauftragen, externLesen, externBestaetigen,
  durchfuehrungsbelegSenden, BUCHHALTUNG_AUSFUEHRUNG, mailProbe,
  empfaengerSuchen, empfaengerKartei, empfaengerLoeschen,
  dauerauftraege, dauerauftragAnlegen, dauerauftragBeenden, dauerauftraegeAusloesen,
  ibanGueltig, ibanSauber,
} from "../lib/fiaon-buchhaltung";
import {
  KONTEN, umsaetze, umsatz, umsaetzeCsv, kasse, monatsfluss, offenePosten, auszahlungen, abrechnungPdf,
  airwallexProbe, planHinweisZahlen, type UmsatzArt, type KontoSchluessel,
} from "../lib/fiaon-banking";
import {
  planLage, planKandidaten, planEingabeLesen, planVorschau, planTanAnfordern, planAnlegen, teilAusloesen,
  planPausieren, planFortsetzen, planEndeTanAnfordern, planBeenden, planKontoTanAnfordern, planKontoBestaetigen,
  planHinweisSetzen, VORGABE_TEIL_CENTS, VORGABE_ABSTAND_MIN, VORGABE_MAX_OFFEN, GRENZEN,
  planKlaerungNichtAusgefuehrt, planKlaerungTanAnfordern, planKlaerungAusgefuehrt, altpostenDochTanAnfordern, altpostenDochUeberwiesen,
  dochEingabeLesen, type PlanFehler, type PlanVorschau,
} from "../lib/fiaon-auszahlungsplan";
import { sqlPool } from "../lib/db-pool";
import { tageslauf } from "../lib/fiaon-crons";

const router = Router();

// ── Erster Faktor: kurzlebiger Nachweis, dass das Passwort stimmte ──────────
const TOR_COOKIE = "fiaon_buch_tor";
const TOR_TTL_MS = 10 * 60 * 1000;
const PROD = process.env.NODE_ENV === "production";

function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-buchhaltung-secret";
}
const torSig = (exp: number) => createHmac("sha256", secret()).update(`buchtor:${exp}`).digest("hex").slice(0, 40);

function torGueltig(req: Request): boolean {
  const t = (req as any).cookies?.[TOR_COOKIE];
  if (typeof t !== "string") return false;
  const [expStr, sig] = t.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const a = Buffer.from(sig); const b = Buffer.from(torSig(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Fehlversuche bremsen (Muster fiaon-chef-zugang.ts) ─────────────────────
const versuche = new Map<string, { fails: number; bis: number }>();
function bremse(key: string): number {
  const a = versuche.get(key) || { fails: 0, bis: 0 };
  a.fails += 1;
  const dauer = a.fails <= 5 ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (a.fails - 6));
  a.bis = dauer > 0 ? Date.now() + dauer : 0;
  versuche.set(key, a);
  return dauer;
}
const gesperrtFuer = (key: string) => Math.max(0, (versuche.get(key)?.bis ?? 0) - Date.now());

// ── Wände ───────────────────────────────────────────────────────────────────
export interface BuchRequest extends Request { buch?: BuchPerson; sitzung?: Sitzung }

/**
 * Schreibende Anfragen nur von der eigenen Seite. Der Browser schickt bei
 * fremden Seiten einen fremden Origin mit — dann ist Schluss, egal was im
 * Cookie steht.
 */
function gleicheHerkunft(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const herkunft = String(req.headers.origin || req.headers.referer || "");
  if (!herkunft) return true; // Skripte ohne Browser (Prüfstand) senden keinen Origin
  try {
    const host = new URL(herkunft).host;
    const eigen = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    return host === eigen || host === "fiaon.com" || host === "www.fiaon.com";
  } catch { return false; }
}

export function requireBuch(mindestens?: BuchRolle) {
  return async (req: BuchRequest, res: Response, next: NextFunction) => {
    try {
      if (!gleicheHerkunft(req)) return res.status(403).json({ ok: false, code: "HERKUNFT", error: "Anfrage von fremder Seite abgewiesen." });
      const s = await sitzungPruefen(req);
      if (!s) {
        res.clearCookie(BUCH_COOKIE, { path: "/" });
        return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Die Sitzung ist beendet. Bitte neu anmelden." });
      }
      if (mindestens === "inhaber" && s.person.rolle !== "inhaber") {
        return res.status(403).json({ ok: false, code: "NUR_INHABER", error: "Das darf nur der Inhaber." });
      }
      req.buch = s.person;
      req.sitzung = s;
      res.setHeader("Cache-Control", "no-store");
      next();
    } catch (e) {
      console.error("[BANKING] Wand:", e);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  };
}

const cents = (v: unknown): number => {
  if (typeof v === "number") return Math.round(v * 100);
  const s = String(v ?? "").trim().replace(/\s|€|EUR/gi, "");
  if (!s) return NaN;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const istTag = (v: unknown): v is string => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const text = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const geldText = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);

function pdfSenden(res: Response, pdf: Buffer, name: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}

const fehler = (res: Response, wo: string) => (err: unknown) => {
  console.error(`[BANKING] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
};

// ═══════════════════════════════════════════════════════════════════════════
// ANMELDUNG
// ═══════════════════════════════════════════════════════════════════════════
router.post("/buchhaltung/anmelden", async (req: Request, res: Response) => {
  try {
    await buchSchema();
    const key = clientIp(req);
    const warten = gesperrtFuer(key);
    if (warten > 0) {
      return res.status(429).json({ ok: false, code: "TOO_MANY", wartezeitMs: warten, error: `Zu viele Fehlversuche. Bitte ${Math.ceil(warten / 1000)} Sekunden warten.` });
    }
    const email = text((req.body as any)?.email).toLowerCase();
    const passwort = String((req.body as any)?.passwort || "");
    if (!await buchPasswortGesetzt()) {
      return res.status(503).json({ ok: false, code: "KEIN_PASSWORT", error: "Für das Banking ist noch kein Passwort hinterlegt." });
    }
    if (email !== BUCH_LOGIN || !(await buchPasswortStimmt(passwort))) {
      const dauer = bremse(key);
      console.warn(`[BANKING] Fehlversuch Passwort von ${key}`);
      return res.status(401).json({ ok: false, code: "UNGUELTIG", wartezeitMs: dauer, error: "Anmeldedaten ungültig." });
    }
    versuche.delete(key);
    const exp = Date.now() + TOR_TTL_MS;
    res.cookie(TOR_COOKIE, `${exp}.${torSig(exp)}`, { httpOnly: true, sameSite: "strict", secure: PROD, maxAge: TOR_TTL_MS, path: "/" });
    const gesp = await gesperrte();
    return res.json({
      ok: true, weiter: "pin",
      personen: BUCH_LEUTE.map((p) => ({ email: p.email, name: p.name, titel: p.titel, gesperrt: gesp.includes(p.email) })),
    });
  } catch (err) { fehler(res, "anmelden")(err); }
});

/** PIN nur an die eigene Adresse. Wer eine fremde angibt, bekommt nichts. */
router.post("/buchhaltung/pin-anfordern", async (req: Request, res: Response) => {
  try {
    if (!torGueltig(req)) return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Bitte zuerst mit Passwort anmelden." });
    const person = buchPerson(text((req.body as any)?.email));
    if (!person) return res.status(403).json({ ok: false, error: "Für diese Adresse ist kein Zugang eingerichtet." });
    if (await istGesperrt(person.email)) return res.status(403).json({ ok: false, code: "GESPERRT", error: "Dieser Zugang ist gesperrt." });
    const pin = await pinAnlegen(person);
    const pinBetreff = `PIN ${pin.slice(0, 4)}-•••• · FIAON Banking`;
    const pinText = [
      `Hallo ${person.name.split(" ")[0]},`,
      "",
      "dein Einmal-PIN für die Anmeldung im FIAON Banking:",
      "",
      `    ${pin}`,
      "",
      "Er gilt 10 Minuten und nur für eine Anmeldung.",
      "Wolltest du dich gerade nicht anmelden? Dann sag sofort Bescheid — das Passwort wird geändert.",
      "",
      "FIAON Banking",
    ].join("\n");
    // Lokaler Prüfstand (nie Produktion): der PIN landet im Probe-Ordner statt im Postfach.
    if (!(await mailProbe(person.email, pinBetreff, pinText))) {
      const { mailNeuSenden, gmailBereit } = await import("../lib/fiaon-gmail");
      if (!gmailBereit()) {
        console.error("[BANKING] PIN nicht versendbar — GOOGLE_SA_KEY fehlt");
        return res.status(503).json({ ok: false, error: "Der PIN-Versand ist gerade nicht möglich. Bitte bei js@fiaon.com melden." });
      }
      await mailNeuSenden("js@fiaon.com", person.email, pinBetreff, pinText);
    }
    buchProtokoll(person.email, "PIN angefordert", null, clientIp(req));
    return res.json({ ok: true, an: person.email });
  } catch (err) {
    console.error("[BANKING] pin-anfordern:", err);
    return res.status(500).json({ ok: false, error: "Der PIN konnte nicht versendet werden." });
  }
});

router.post("/buchhaltung/pin-pruefen", async (req: Request, res: Response) => {
  try {
    if (!torGueltig(req)) return res.status(401).json({ ok: false, code: "ANMELDUNG", error: "Bitte zuerst mit Passwort anmelden." });
    const person = buchPerson(text((req.body as any)?.email));
    if (!person) return res.status(403).json({ ok: false, error: "Für diese Adresse ist kein Zugang eingerichtet." });
    if (await istGesperrt(person.email)) return res.status(403).json({ ok: false, code: "GESPERRT", error: "Dieser Zugang ist gesperrt." });
    const erg = await pinPruefen(person, String((req.body as any)?.pin || ""));
    if (!erg.ok) return res.status(401).json({ ok: false, error: erg.grund });

    const token = await sitzungAnlegen(person, req);
    res.clearCookie(TOR_COOKIE, { path: "/" });
    // Kein maxAge: Das Cookie endet mit dem Browser. Gültig ist ohnehin nur, was die Tabelle sagt.
    res.cookie(BUCH_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: PROD, path: "/" });
    buchProtokoll(person.email, "Angemeldet", null, clientIp(req));
    console.log(`[BANKING] Anmeldung: ${person.name}`);
    if (person.rolle !== "inhaber") {
      benachrichtigen(inhaber().email, `Anmeldung im Banking: ${person.name}`, [
        `${person.name} hat sich gerade im FIAON Banking angemeldet.`,
        "",
        "Aktive Sitzungen siehst und beendest du unter „Sicherheit“.",
      ]);
    }
    return res.json({ ok: true, ich: { email: person.email, name: person.name, rolle: person.rolle, titel: person.titel } });
  } catch (err) { fehler(res, "pin-pruefen")(err); }
});

router.get("/buchhaltung/status", async (req: BuchRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const s = await sitzungPruefen(req);
    if (!s) return res.json({ ok: true, angemeldet: false, login: BUCH_LOGIN, passwortGesetzt: await buchPasswortGesetzt().catch(() => false) });
    const vorher = await letzteAnmeldung(s.person.email, s.sid);
    return res.json({
      ok: true, angemeldet: true, leerlaufMin: LEERLAUF_MIN,
      ich: { email: s.person.email, name: s.person.name, rolle: s.person.rolle, titel: s.person.titel },
      letzteAnmeldung: vorher,
    });
  } catch (err) { fehler(res, "status")(err); }
});

/** Lebenszeichen der Oberfläche bei Eingaben — hält die Sitzung, solange jemand arbeitet. */
router.post("/buchhaltung/lebenszeichen", requireBuch(), (_req: Request, res: Response) => res.json({ ok: true }));

router.post("/buchhaltung/abmelden", async (req: Request, res: Response) => {
  try {
    const s = await sitzungPruefen(req).catch(() => null);
    const grund = text((req.body as any)?.grund, 40) || "Abgemeldet";
    if (s) {
      await sitzungBeenden(s.sid, grund);
      buchProtokoll(s.person.email, grund === "Untätigkeit" ? "Automatisch abgemeldet" : "Abgemeldet", null, null);
    }
  } catch { /* abmelden darf nie scheitern */ }
  res.clearCookie(BUCH_COOKIE, { path: "/" });
  res.clearCookie(TOR_COOKIE, { path: "/" });
  res.json({ ok: true, angemeldet: false });
});

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERBLICK
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/lage", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const { nachholZahl, NACHHOLEN_SEIT_AELTESTE } = await import("../lib/fiaon-bank-nachholen");
    const [k, offen, fluss, letzte, alle, u, dauer, ausz, nachholen0, aeltere, plan] = await Promise.all([
      kasse(), offenePosten(), monatsfluss(),
      umsaetze({ konto: "alle", limit: 8 }),
      // E-484: Aufträge und Auszahlungen OHNE die Teilbeträge eines Auszahlungsplans — die haben ihren eigenen Reiter.
      auftraege(200), uebergabe(), dauerauftraege(), auszahlungen(), nachholZahl(), nachholZahl(NACHHOLEN_SEIT_AELTESTE),
      planKurzlage(req.buch!),
    ]);
    // E-277: Auch ältere liegengebliebene Eingänge (seit 15.08.) zählen — „lass kein über".
    const nachholen = { ...nachholen0, gesamtAnzahl: aeltere.anzahl, gesamtCents: aeltere.cents };
    const offeneAuszahlungen = ausz.filter((p) => p.status === "angefordert");
    res.json({
      ok: true,
      ich: req.buch,
      konten: KONTEN,
      kasse: k,
      offen,
      // Eingänge, die im Bankbuch liegen und noch keine Buchung haben (seit 24.09.; gesamt* seit 15.08.) — „Zu tun".
      nachholen,
      fluss,
      letzte: letzte.zeilen,
      auftraege: alle,
      uebergabe: u,
      dauerauftraege: dauer,
      auszahlungOffen: {
        anzahl: offeneAuszahlungen.length,
        cents: offeneAuszahlungen.reduce((s, p) => s + p.cents, 0),
        ohneAuftrag: offeneAuszahlungen.filter((p) => !p.auftragId).length,
      },
      // E-484: der Auszahlungsplan in Kurzform — Zähler am Menüpunkt, „Zu tun“ und die Hinweiszeilen in Aufträge und
      // Auszahlungen. null, wenn er gerade nicht lesbar ist (der Fehler steht im Log; die Übersicht lädt trotzdem).
      auszahlungsplan: plan,
      leute: BUCH_LEUTE,
    });
  } catch (err) { fehler(res, "lage")(err); }
});

/** E-484: Die Zahlen für die Hinweiszeilen — fehlen sie, lädt die Liste trotzdem (null; der Fehler steht im Log). */
async function planHinweisZahlenSicher(): Promise<Awaited<ReturnType<typeof planHinweisZahlen>> | null> {
  try { return await planHinweisZahlen(); } catch (e) {
    console.error("[BANKING] Auszahlungsplan-Zahlen für die Hinweiszeile nicht lesbar:", e);
    return null;
  }
}

/**
 * E-484: Der Auszahlungsplan für die Übersicht — dieselben Zustände wie im Reiter (planLage, kurz), dazu die Zahlen
 * für die Hinweiszeilen „Teilbeträge des Auszahlungsplans: im Reiter Auszahlungsplan (n)“.
 */
async function planKurzlage(ich: BuchPerson) {
  try {
    const [l, zahlen] = await Promise.all([planLage(ich, { kurz: true }), planHinweisZahlen()]);
    return {
      jetzt: l.jetzt,
      badge: l.badge,
      zurFreigabe: l.zurFreigabe.length,
      darfFreigeben: l.zurFreigabe.filter((a) => a.darfFreigeben).length,
      beiBuchhaltung: l.beiBuchhaltung.length,
      ueberfaellig: l.beiBuchhaltung.filter((a) => a.ueberfaellig).length,
      // Nachbesserung E-484: nach einem Rückruf in Klärung — „Zu tun“ für den Inhaber.
      inKlaerung: l.inKlaerung.length,
      darfKlaeren: l.inKlaerung.filter((a) => a.darfKlaeren).length,
      auftraegeLaufend: zahlen.auftraegeLaufend,
      auszahlungenOffen: zahlen.auszahlungenOffen,
      auszahlungenOffenCents: zahlen.auszahlungenOffenCents,
      plaene: l.plaene
        .filter((p) => p.status === "aktiv" || p.status === "pausiert")
        .map((p) => ({
          id: p.id, nummer: p.nummer, empfaengerName: p.empfaengerName, ichBinEmpfaenger: p.ichBinEmpfaenger,
          status: p.status, zustand: p.zustand, darfAusloesen: p.darfAusloesen, sperrGrund: p.sperrGrund,
          naechsteAb: p.naechsteAb, naechsterTeil: p.naechsterTeil, anzahlTeile: p.anzahlTeile,
          ausgefuehrt: p.ausgefuehrt.anzahl,
        })),
    };
  } catch (e) {
    console.error("[BANKING] Auszahlungsplan (Kurzlage):", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UMSÄTZE
// ═══════════════════════════════════════════════════════════════════════════
function umsatzFilter(q: any) {
  const arten = String(q?.arten || "").split(",").map((s) => s.trim()).filter(Boolean) as UmsatzArt[];
  const konto = ["geschaeft", "wise"].includes(String(q?.konto)) ? (String(q.konto) as KontoSchluessel) : "alle" as const;
  const richtung = ["ein", "aus"].includes(String(q?.richtung)) ? (String(q.richtung) as "ein" | "aus") : "alle" as const;
  return {
    konto, richtung, arten,
    von: istTag(q?.von) ? String(q.von) : null,
    bis: istTag(q?.bis) ? String(q.bis) : null,
    suche: text(q?.q, 80) || null,
    limit: Math.min(200, Math.max(1, Number(q?.limit) || 60)),
    offset: Math.max(0, Number(q?.offset) || 0),
  };
}

router.get("/buchhaltung/umsaetze", requireBuch(), async (req: Request, res: Response) => {
  try { res.json({ ok: true, ...(await umsaetze(umsatzFilter(req.query))) }); }
  catch (err) { fehler(res, "umsaetze")(err); }
});

router.get("/buchhaltung/umsaetze.csv", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const csv = await umsaetzeCsv(umsatzFilter(req.query));
    buchProtokoll(req.buch!.email, "Umsätze exportiert", null, JSON.stringify(req.query).slice(0, 200));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="FIAON_Umsaetze_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  } catch (err) { fehler(res, "umsaetze.csv")(err); }
});

router.get("/buchhaltung/umsatz/:uid", requireBuch(), async (req: Request, res: Response) => {
  try {
    const u = await umsatz(String(req.params.uid));
    if (!u) return res.status(404).json({ ok: false, error: "Umsatz nicht gefunden." });
    const a = u.auftragId ? await auftrag(u.auftragId) : null;
    res.json({ ok: true, umsatz: u, auftrag: a });
  } catch (err) { fehler(res, "umsatz")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// LIEGENGEBLIEBENE EINGÄNGE BUCHEN — ohne Admin-Code (01.10.2026)
//
// Justin bucht im Bankbuch. Die Rechnung steht in server/lib/fiaon-bank-nachholen.ts
// (Trockenprobe: Ziel, Regel, Betrag, Provision, Mails, Hinweise; Buchen über
// liveVerbuchen — der eine Buchungsweg). Sehen darf jede Banking-Sitzung,
// buchen nur der Inhaber (Vier Augen wie bei der Überweisung: Florentine sieht,
// Justin klickt). Jeder Klick steht im Banking-Protokoll.
// ═══════════════════════════════════════════════════════════════════════════
const bankId = (uid: unknown): number | null => {
  const m = String(uid ?? "").match(/^(?:bank:)?(\d+)$/);
  return m ? Number(m[1]) : null;
};

/** Alle liegengebliebenen Eingänge mit Trockenprobe — „Alle prüfen". */
router.get("/buchhaltung/nachholen", requireBuch(), async (req: Request, res: Response) => {
  try {
    const { nachholListe, NACHHOLEN_SEIT_AELTESTE } = await import("../lib/fiaon-bank-nachholen");
    // Vorgabe: seit 24.09. (geprüfter Zeitraum); ?seit=aeltere nimmt alles seit 15.08. dazu (E-277).
    const seit = String(req.query.seit) === "aeltere" ? NACHHOLEN_SEIT_AELTESTE : istTag(req.query.seit) ? String(req.query.seit) : null;
    const zeilen = await nachholListe({ seit });
    const buchbar = zeilen.filter((z) => z.buchen);
    res.json({ ok: true, zeilen, anzahl: zeilen.length, buchbar: buchbar.length, buchbarCents: buchbar.reduce((s, z) => s + z.betragCents, 0) });
  } catch (err) { fehler(res, "nachholen")(err); }
});

// E-277 (02.10.2026) — Justin: „Ok buche alle Zahlungen den Kunden richtig zu die gerade nicht
// gebucht wurden, erkenne sie anhand des Namens, Verwendungszweck oder was auch immer, buche alle
// und lass kein über." Je Handfall ein Vorschlag (Liste und Schublade); der Inhaber bestätigt mit
// „So buchen" (Ziel + ggf. Sammelzahlung, der eine Weg), „Nur zuordnen" (Geld schon auf anderem
// Weg gebucht — keine zweite Buchung) oder „Aufgabe anlegen" (Teil-, Über-, Rückzahlung).
const zielAusBody = (b: any): string | null => (typeof b?.ziel === "string" && b.ziel.trim() ? b.ziel.trim().slice(0, 40) : null);
const dazuAusBody = (b: any): number[] =>
  (Array.isArray(b?.dazu) ? b.dazu : []).map((x: unknown) => bankId(x)).filter((n: number | null): n is number => !!n).slice(0, 3);
// E-278 (03.10.2026), Justin: „Konchenko-Sperre im Code reparieren und dann buchen mach ALLE fertig“ —
// zwei Haken bei „Anderes Ziel …“: Storno zurücknehmen (Kündigungs-/Kulanz-Storno bzw. stornierte
// Bestellung) und mit heutigem Datum verrechnen (Doppelzahlung an der Rückwärtssperre). Nur ein
// ausdrückliches true zählt; gebucht wird damit nur vom Inhaber (Routen unten).
const optionenAusBody = (b: any): { stornoZuruecknehmen: boolean; verrechnungHeute: boolean } =>
  ({ stornoZuruecknehmen: b?.stornoZuruecknehmen === true, verrechnungHeute: b?.verrechnungHeute === true });

/** Die Trockenprobe zu EINEM Eingang — für die Schublade und die Dialoge. Schreibt nichts. */
router.post("/buchhaltung/nachholen/:uid/trocken", requireBuch(), async (req: Request, res: Response) => {
  try {
    const id = bankId(req.params.uid);
    if (!id) return res.status(400).json({ ok: false, error: "Das ist kein Bankeingang." });
    const nach = await import("../lib/fiaon-bank-nachholen");
    const ziel = zielAusBody(req.body);
    const dazu = dazuAusBody(req.body);
    const a = String(req.body?.modus) === "zuordnen"
      ? await nach.zuordnenPruefen(id, ziel)
      : await nach.bankeingangTrockenprobe(id, { ziel, dazu, mitVorschlag: !ziel && !dazu.length, ...optionenAusBody(req.body) });
    res.status(a.ok ? 200 : a.status).json(a.ok ? { ok: true, zeile: a.zeile } : { ok: false, error: a.error, zeile: a.zeile ?? null });
  } catch (err) { fehler(res, "nachholen/trocken")(err); }
});

/** EINEN Eingang buchen — nur Inhaber, erst Trockenprobe, dann der eine Buchungsweg. */
router.post("/buchhaltung/nachholen/:uid/buchen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = bankId(req.params.uid);
    if (!id) return res.status(400).json({ ok: false, error: "Das ist kein Bankeingang." });
    const { bankeingangBuchen } = await import("../lib/fiaon-bank-nachholen");
    const opt = optionenAusBody(req.body);
    const a = await bankeingangBuchen(id, {
      wer: `Bankbuch ${req.buch!.email}`, erwartet: req.body?.erwartet ?? null, ziel: zielAusBody(req.body), dazu: dazuAusBody(req.body), ...opt,
    });
    const z = a.zeile;
    const optText = `${opt.stornoZuruecknehmen ? " [Storno zurück]" : ""}${opt.verrechnungHeute ? " [heute verrechnet]" : ""}`;
    buchProtokoll(req.buch!.email, a.ok && a.ergebnis?.gebucht ? "Bankeingang gebucht" : "Bankeingang NICHT gebucht",
      z ? `bank:${z.id}` : `bank:${id}`,
      z ? `${geldText(z.summeCents ?? z.betragCents)} ${z.zielVomMenschen ? `Ziel ${z.zielVomMenschen}` : z.zweckRef ?? ""}${z.dazu?.length ? ` + Sammel ${z.dazu.map((d) => `#${d}`).join(",")}` : ""}${optText} → ${z.regel ?? "—"} ${z.ziel ?? ""}: ${a.ok ? a.ergebnis?.grund : a.error}`.slice(0, 300) : String(a.error ?? "").slice(0, 300));
    if (!a.ok) return res.status(a.status).json({ ok: false, error: a.error, zeile: z ?? null });
    res.json({ ok: true, zeile: z, ergebnis: a.ergebnis, aufgabe: a.aufgabe ?? null, aufgabenErledigt: a.aufgabenErledigt ?? 0 });
  } catch (err) { fehler(res, "nachholen/buchen")(err); }
});

/** E-277: „Nur zuordnen" — das Geld ist schon auf anderem Weg gebucht. Nur Inhaber, keine Buchung. */
router.post("/buchhaltung/nachholen/:uid/zuordnen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = bankId(req.params.uid);
    if (!id) return res.status(400).json({ ok: false, error: "Das ist kein Bankeingang." });
    const ziel = zielAusBody(req.body);
    if (!ziel) return res.status(400).json({ ok: false, error: "Ziel fehlt (Raten- oder Bestellreferenz)." });
    const { bankeingangZuordnen } = await import("../lib/fiaon-bank-nachholen");
    const a = await bankeingangZuordnen(id, { ziel, wer: `Bankbuch ${req.buch!.email}`, erwartet: req.body?.erwartet ?? null });
    const z = a.zeile;
    buchProtokoll(req.buch!.email, a.ok ? "Bankeingang nur zugeordnet" : "Bankeingang NICHT zugeordnet", `bank:${id}`,
      `${z ? geldText(z.betragCents) : ""} → ${ziel}: ${a.ok ? z?.ergebnis ?? "zugeordnet" : a.error}`.slice(0, 300));
    if (!a.ok) return res.status(a.status).json({ ok: false, error: a.error, zeile: z ?? null });
    res.json({ ok: true, zeile: z });
  } catch (err) { fehler(res, "nachholen/zuordnen")(err); }
});

/** E-277: Teil-, Über-, Rückzahlung — Aufgabe statt Buchung. Nur Inhaber. */
router.post("/buchhaltung/nachholen/:uid/aufgabe", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = bankId(req.params.uid);
    if (!id) return res.status(400).json({ ok: false, error: "Das ist kein Bankeingang." });
    const { bankeingangAufgabe } = await import("../lib/fiaon-bank-nachholen");
    const a = await bankeingangAufgabe(id, { wer: req.buch!.email });
    buchProtokoll(req.buch!.email, a.ok ? "Aufgabe zu Bankeingang angelegt" : "Aufgabe zu Bankeingang NICHT angelegt", `bank:${id}`,
      `${a.zeile ? geldText(a.zeile.betragCents) : ""} ${a.zeile?.vorschlag?.text ?? ""}: ${a.ok ? a.aufgabe ?? "" : a.error}`.slice(0, 300));
    if (!a.ok) return res.status(a.status).json({ ok: false, error: a.error, zeile: a.zeile ?? null });
    res.json({ ok: true, zeile: a.zeile, aufgabe: a.aufgabe ?? null });
  } catch (err) { fehler(res, "nachholen/aufgabe")(err); }
});

/**
 * Mehrere auf einmal — nur Inhaber. Einer nach dem anderen, Abbruch beim ersten Fehlschlag.
 * `ids`: buchbare Eingänge wie bisher (Referenz im Zweck). E-277 `auftraege`: bestätigte
 * Vorschläge [{ id, modus: "buchen"|"zuordnen", ziel, dazu, erwartet }] — jeder läuft durch
 * dieselbe Prüfung wie der Einzelklick (weicht der Stand von der Erwartung ab: Abbruch).
 */
router.post("/buchhaltung/nachholen/alle-buchen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    type Schritt = { id: number; modus: "buchen" | "zuordnen"; ziel: string | null; dazu: number[]; erwartet: any; stornoZuruecknehmen: boolean; verrechnungHeute: boolean };
    const auftraege: Schritt[] = Array.isArray(req.body?.auftraege)
      ? req.body.auftraege.map((x: any): Schritt => ({
        id: bankId(x?.id) ?? 0, modus: x?.modus === "zuordnen" ? "zuordnen" : "buchen", ziel: zielAusBody(x), dazu: dazuAusBody(x), erwartet: x?.erwartet ?? null,
        ...optionenAusBody(x),
      })).filter((x: Schritt) => x.id > 0)
      : (Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => bankId(x)).filter((n: number | null): n is number => !!n)
        .map((id: number): Schritt => ({ id, modus: "buchen", ziel: null, dazu: [], erwartet: null, stornoZuruecknehmen: false, verrechnungHeute: false }));
    if (!auftraege.length) return res.status(400).json({ ok: false, error: "Keine Eingänge angegeben." });
    if (auftraege.length > 100) return res.status(400).json({ ok: false, error: "Höchstens 100 auf einmal." });
    if (auftraege.some((x) => x.modus === "zuordnen" && !x.ziel)) return res.status(400).json({ ok: false, error: "„Nur zuordnen“ braucht ein Ziel." });
    const { bankeingangBuchen, bankeingangZuordnen } = await import("../lib/fiaon-bank-nachholen");
    const schritte: Array<{ id: number; modus: string; gebucht: boolean; grund: string; ziel: string | null; aufgabe: string | null }> = [];
    let abgebrochen = false;
    for (const x of auftraege) {
      const wer = `Bankbuch ${req.buch!.email}`;
      let ok = false;
      let grund = "";
      let ziel: string | null = null;
      let aufgabe: string | null = null;
      let betrag = 0;
      if (x.modus === "zuordnen") {
        const a = await bankeingangZuordnen(x.id, { ziel: x.ziel, wer, erwartet: x.erwartet });
        ok = a.ok; grund = a.ok ? "nur zugeordnet" : String(a.error ?? ""); ziel = a.zeile?.ziel ?? x.ziel; betrag = a.zeile?.betragCents ?? 0;
      } else {
        const a = await bankeingangBuchen(x.id, { wer, ziel: x.ziel, dazu: x.dazu, erwartet: x.erwartet, stornoZuruecknehmen: x.stornoZuruecknehmen, verrechnungHeute: x.verrechnungHeute });
        ok = !!(a.ok && a.ergebnis?.gebucht); grund = a.ok ? String(a.ergebnis?.grund ?? "") : String(a.error ?? "");
        ziel = a.zeile?.ziel ?? null; aufgabe = a.aufgabe ?? null; betrag = a.zeile?.summeCents ?? a.zeile?.betragCents ?? 0;
      }
      schritte.push({ id: x.id, modus: x.modus, gebucht: ok, grund, ziel, aufgabe });
      buchProtokoll(req.buch!.email,
        x.modus === "zuordnen" ? (ok ? "Bankeingang nur zugeordnet" : "Bankeingang NICHT zugeordnet") : (ok ? "Bankeingang gebucht" : "Bankeingang NICHT gebucht"),
        `bank:${x.id}`, `${geldText(betrag)} → ${ziel ?? "—"}: ${grund}`.slice(0, 300));
      if (!ok) { abgebrochen = true; break; }
    }
    res.json({ ok: true, gebucht: schritte.filter((s) => s.gebucht).length, abgebrochen, schritte });
  } catch (err) { fehler(res, "nachholen/alle-buchen")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERWEISUNGEN — Zahlungsaufträge
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/auftraege", requireBuch(), async (_req: Request, res: Response) => {
  try {
    // E-484: ohne Teilbeträge des Auszahlungsplans (eigener Reiter) — die Zahl steht für die Hinweiszeile dabei.
    const [liste, plan] = await Promise.all([auftraege(300), planHinweisZahlenSicher()]);
    res.json({ ok: true, auftraege: liste, planAuftraegeLaufend: plan?.auftraegeLaufend ?? null });
  }
  catch (err) { fehler(res, "auftraege")(err); }
});

router.post("/buchhaltung/auftrag", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const empfaenger = text(b?.empfaenger, 140);
    const iban = ibanSauber(b?.iban);
    const zweck = text(b?.zweck, 140);
    const c = cents(b?.betrag);
    if (!empfaenger) return res.status(400).json({ ok: false, error: "Bitte den Empfänger angeben." });
    if (!ibanGueltig(iban)) return res.status(400).json({ ok: false, error: "Die IBAN stimmt nicht (Prüfziffer). Bitte noch einmal ansehen." });
    if (!Number.isFinite(c) || c <= 0) return res.status(400).json({ ok: false, error: "Bitte einen Betrag größer als null angeben." });
    if (c > 10_000_000) return res.status(400).json({ ok: false, error: "Beträge über 100.000 € bitte direkt in der Bank anweisen." });
    if (!zweck) return res.status(400).json({ ok: false, error: "Bitte einen Verwendungszweck angeben." });
    const belegBase64 = typeof b?.belegBase64 === "string" ? b.belegBase64.replace(/^data:[^,]+,/, "") : null;
    if (belegBase64 && belegBase64.length > 8_000_000) return res.status(413).json({ ok: false, error: "Der Beleg ist zu groß (höchstens 6 MB)." });
    const a = await auftragAnlegen({
      empfaenger, iban, bic: text(b?.bic, 11).toUpperCase() || null,
      betragCents: c, zweck, kategorie: text(b?.kategorie, 60) || null,
      faelligAm: istTag(b?.faelligAm) ? String(b.faelligAm) : null,
      belegName: text(b?.belegName, 120) || null, belegBase64,
    }, req.buch!);
    // Die Buchhaltung reicht direkt ein — ein Entwurf, den niemand sieht, hilft keinem.
    if (b?.einreichen === true && req.buch!.rolle !== "inhaber") {
      const e = await auftragEinreichen(a.id, req.buch!);
      if (e.ok) return res.json({ ok: true, auftrag: e.auftrag });
    }
    res.json({ ok: true, auftrag: a });
  } catch (err) { fehler(res, "auftrag")(err); }
});

router.post("/buchhaltung/auftrag/:id/einreichen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragEinreichen(Number(req.params.id), req.buch!);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "einreichen")(err); }
});

router.post("/buchhaltung/auftrag/:id/zurueckziehen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragZurueckziehen(Number(req.params.id), req.buch!);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "zurueckziehen")(err); }
});

/**
 * TAN für eine Freigabe anfordern — die Mail nennt Betrag, Empfänger und IBAN.
 * 13.10.2026: Aufträge über die Buchhaltung gibt die Geschäftsführung frei (jede TAN gehört zu genau einem Auftrag);
 * alle anderen weiterhin nur der Inhaber.
 * E-484: freigabePruefen statt freigabeMoeglich — für den Teilbetrag eines pausierten oder beendeten Auszahlungsplans
 * geht gar keine TAN-Mail raus (die Freigabe selbst wiese ihn ohnehin ab).
 */
router.post("/buchhaltung/auftrag/:id/tan", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const a = await auftrag(Number(req.params.id));
    if (!a) return res.status(404).json({ ok: false, error: "Auftrag nicht gefunden." });
    if (req.buch!.rolle !== "inhaber" && !a.ausfuehrungExtern) return res.status(403).json({ ok: false, code: "NUR_INHABER", error: "Das darf nur der Inhaber." });
    const darf = await freigabePruefen(a, req.buch!);
    if (!darf.ok) return res.status(400).json({ ok: false, error: darf.grund });
    const t = await tanAnfordern(req.buch!, tanZweck(a), freigabeZiel(a), freigabeBeschreibung(a));
    if (!t.ok) return res.status(503).json({ ok: false, error: t.grund });
    res.json({ ok: true, an: req.buch!.email, beschreibung: freigabeBeschreibung(a), art: darf.art });
  } catch (err) { fehler(res, "tan")(err); }
});

router.post("/buchhaltung/auftrag/:id/freigeben", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragFreigeben(Number(req.params.id), req.buch!, String((req.body as any)?.tan || ""));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "freigeben")(err); }
});

router.post("/buchhaltung/auftrag/:id/ablehnen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragAblehnen(Number(req.params.id), req.buch!, text((req.body as any)?.notiz, 300));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "ablehnen")(err); }
});

router.post("/buchhaltung/auftrag/:id/ausfuehren", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const erg = await auftragAusfuehren(Number(req.params.id), req.buch!, text(b?.bankReferenz, 80), istTag(b?.wertAm) ? String(b.wertAm) : null);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag, hinweis: erg.hinweis ?? null });
  } catch (err) { fehler(res, "ausfuehren")(err); }
});

router.get("/buchhaltung/auftrag/:id/bestaetigung.pdf", requireBuch(), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const a = await auftrag(id);
    if (!a) return res.status(404).send("Nicht gefunden");
    if (a.status !== "ausgefuehrt") return res.status(409).send("Eine Bestätigung gibt es erst nach der Ausführung.");
    const { bestaetigungLesen, bestaetigungErzeugen } = await import("../lib/fiaon-banking-pdf");
    const pdf = (await bestaetigungLesen(id)) ?? (await bestaetigungErzeugen(id));
    pdfSenden(res, pdf, `FIAON_Zahlungsbestaetigung_${a.nummer}.pdf`);
  } catch (err) {
    console.error("[BANKING] bestaetigung:", err);
    res.status(500).send("Die Bestätigung konnte nicht erzeugt werden.");
  }
});

router.get("/buchhaltung/auftrag/:id/beleg", requireBuch(), async (req: Request, res: Response) => {
  try {
    const [r] = (await sqlPool`SELECT beleg_name, beleg_base64 FROM fiaon_buch_auftrag WHERE id = ${Number(req.params.id)}`) as any[];
    if (!r?.beleg_base64) return res.status(404).send("Kein Beleg hinterlegt");
    const name = String(r.beleg_name || "beleg.pdf");
    const endung = name.toLowerCase().split(".").pop();
    const typ = endung === "pdf" ? "application/pdf" : endung === "png" ? "image/png" : ["jpg", "jpeg"].includes(String(endung)) ? "image/jpeg" : "application/octet-stream";
    res.setHeader("Content-Type", typ);
    res.setHeader("Content-Disposition", `inline; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(String(r.beleg_base64), "base64"));
  } catch (err) { fehler(res, "beleg")(err); }
});

// ── Empfänger ───────────────────────────────────────────────────────────────
router.get("/buchhaltung/empfaenger", requireBuch(), async (req: Request, res: Response) => {
  try { res.json({ ok: true, vorschlaege: await empfaengerSuchen(text(req.query.q, 60)) }); }
  catch (err) { fehler(res, "empfaenger")(err); }
});

router.get("/buchhaltung/empfaenger/kartei", requireBuch(), async (_req: Request, res: Response) => {
  try { res.json({ ok: true, kartei: await empfaengerKartei() }); }
  catch (err) { fehler(res, "kartei")(err); }
});

router.post("/buchhaltung/empfaenger/:id/loeschen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try { await empfaengerLoeschen(Number(req.params.id), req.buch!); res.json({ ok: true }); }
  catch (err) { fehler(res, "empfaenger loeschen")(err); }
});

// ── Daueraufträge ───────────────────────────────────────────────────────────
router.post("/buchhaltung/dauerauftrag", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const empfaenger = text(b?.empfaenger, 140);
    const iban = ibanSauber(b?.iban);
    const zweck = text(b?.zweck, 120);
    const c = cents(b?.betrag);
    const tagImMonat = Math.round(Number(b?.tagImMonat));
    if (!empfaenger) return res.status(400).json({ ok: false, error: "Bitte den Empfänger angeben." });
    if (!ibanGueltig(iban)) return res.status(400).json({ ok: false, error: "Die IBAN stimmt nicht (Prüfziffer)." });
    if (!Number.isFinite(c) || c <= 0) return res.status(400).json({ ok: false, error: "Bitte einen Betrag größer als null angeben." });
    if (!zweck) return res.status(400).json({ ok: false, error: "Bitte einen Verwendungszweck angeben." });
    if (!(tagImMonat >= 1 && tagImMonat <= 31)) return res.status(400).json({ ok: false, error: "Bitte einen Tag zwischen 1 und 31 wählen." });
    const ab = istTag(b?.ab) ? String(b.ab) : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const d = await dauerauftragAnlegen({
      empfaenger, iban, bic: text(b?.bic, 11).toUpperCase() || null, betragCents: c, zweck,
      kategorie: text(b?.kategorie, 60) || null, tagImMonat, ab,
    }, req.buch!);
    res.json({ ok: true, dauerauftrag: d });
  } catch (err) { fehler(res, "dauerauftrag")(err); }
});

router.post("/buchhaltung/dauerauftrag/:id/beenden", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await dauerauftragBeenden(Number(req.params.id), req.buch!);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true });
  } catch (err) { fehler(res, "dauerauftrag beenden")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGEN AN MITARBEITER
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/auszahlungen", requireBuch(), async (_req: Request, res: Response) => {
  try {
    // E-484: ohne Teilbeträge des Auszahlungsplans — sie laufen über ihren Reiter; die Zahl steht für die Hinweiszeile dabei.
    const [liste, plan] = await Promise.all([auszahlungen(), planHinweisZahlenSicher()]);
    res.json({ ok: true, auszahlungen: liste, planTeile: plan ? { offen: plan.auszahlungenOffen, offenCents: plan.auszahlungenOffenCents } : null });
  }
  catch (err) { fehler(res, "auszahlungen")(err); }
});

router.post("/buchhaltung/auszahlung/:id/anweisen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragAusAuszahlung(Number(req.params.id), req.buch!);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    // Die Buchhaltung reicht sofort ein; der Inhaber gibt eigene Anweisungen direkt mit TAN frei.
    if (req.buch!.rolle !== "inhaber" && erg.auftrag.status === "entwurf") {
      const e = await auftragEinreichen(erg.auftrag.id, req.buch!);
      if (e.ok) return res.json({ ok: true, auftrag: e.auftrag });
    }
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "anweisen")(err); }
});

/** Sammelanweisung: jede angeforderte Auszahlung ohne offenen Auftrag bekommt einen. */
router.post("/buchhaltung/auszahlungen/alle-anweisen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const offen = (await auszahlungen()).filter((p) => p.status === "angefordert" && !p.auftragId);
    const angelegt: string[] = [];
    const fehlgeschlagen: { id: number; grund: string }[] = [];
    for (const p of offen) {
      const erg = await auftragAusAuszahlung(p.id, req.buch!);
      if (!erg.ok) { fehlgeschlagen.push({ id: p.id, grund: erg.grund }); continue; }
      if (req.buch!.rolle !== "inhaber" && erg.auftrag.status === "entwurf") await auftragEinreichen(erg.auftrag.id, req.buch!);
      angelegt.push(erg.auftrag.nummer);
    }
    buchProtokoll(req.buch!.email, "Sammelanweisung Auszahlungen", null, `${angelegt.length} Aufträge, ${fehlgeschlagen.length} ohne`);
    res.json({ ok: true, angelegt, fehlgeschlagen });
  } catch (err) { fehler(res, "alle-anweisen")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNG ÜBER DIE BUCHHALTUNG (13.10.2026) — siehe server/lib/fiaon-buchhaltung.ts
// ═══════════════════════════════════════════════════════════════════════════
/** Inhaber: eine Auszahlung zur Freigabe an die Geschäftsführung („Bitte geben Sie folgende Auszahlung frei“). */
router.post("/buchhaltung/auszahlung/:id/zur-freigabe", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await zurFreigabeSenden(Number(req.params.id), req.buch!);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag, mail: !!erg.mail, hinweis: erg.hinweis ?? null });
  } catch (err) { fehler(res, "zur-freigabe")(err); }
});

/** Inhaber: alle angeforderten Auszahlungen zur Freigabe — je Auszahlung eine Mail mit eigener TAN. */
router.post("/buchhaltung/auszahlungen/alle-zur-freigabe", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try { res.json({ ok: true, ...(await alleZurFreigabeSenden(req.buch!)) }); }
  catch (err) { fehler(res, "alle-zur-freigabe")(err); }
});

/** Inhaber: die Freigabe-Mail mit neuer TAN erneut schicken (die alte TAN verfällt). */
router.post("/buchhaltung/auftrag/:id/freigabe-mail", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const a = await auftrag(Number(req.params.id));
    if (!a) return res.status(404).json({ ok: false, error: "Auftrag nicht gefunden." });
    const m = await freigabeMailSenden(a);
    if (!m.ok) return res.status(400).json({ ok: false, error: m.grund });
    res.json({ ok: true, auftrag: await auftrag(a.id) });
  } catch (err) { fehler(res, "freigabe-mail")(err); }
});

/** Den freigegebenen Auftrag erneut an die Buchhaltung (neuer Bestätigungslink, der alte verfällt). */
router.post("/buchhaltung/auftrag/:id/an-buchhaltung", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await externBeauftragen(Number(req.params.id));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    buchProtokoll(req.buch!.email, "Auftrag erneut an die Buchhaltung", String(req.params.id), BUCHHALTUNG_AUSFUEHRUNG);
    res.json({ ok: true, auftrag: await auftrag(Number(req.params.id)) });
  } catch (err) { fehler(res, "an-buchhaltung")(err); }
});

/** Den Durchführungsbeleg erneut an die Geschäftsführung schicken. */
router.post("/buchhaltung/auftrag/:id/beleg-senden", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await durchfuehrungsbelegSenden(Number(req.params.id));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true });
  } catch (err) { fehler(res, "beleg-senden")(err); }
});

/**
 * E-484: Inhaber — einen freigegebenen Auftrag bei der Buchhaltung zurückrufen (Link ungültig, „Bitte NICHT ausführen“).
 * Für JEDEN Auftrag über die Buchhaltung, nicht nur für Teilbeträge — solange sie noch nicht bestätigt hat.
 */
router.post("/buchhaltung/auftrag/:id/zurueckrufen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragZurueckrufen(Number(req.params.id), req.buch!, text((req.body as any)?.grund, 300));
    if (!erg.ok) {
      // 400 = Eingabe fehlt, 404 = gibt es nicht, 409 = der Zustand lässt es nicht (mehr) zu — z. B. gerade bestätigt.
      const status = /braucht einen Grund/.test(erg.grund) ? 400 : /nicht gefunden/.test(erg.grund) ? 404 : 409;
      return res.status(status).json({ ok: false, error: erg.grund });
    }
    res.json({ ok: true, auftrag: erg.auftrag, mail: erg.mail !== false, hinweis: erg.hinweis ?? null });
  } catch (err) { fehler(res, "zurueckrufen")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGSPLAN (E-484, 06.11.2026) — die Regeln stehen in server/lib/fiaon-auszahlungsplan.ts
//
// Ein zugesagter Betrag in festen Teilbeträgen, je Empfänger ein eigener Plan mit eigener Wartezeit. Anlegen, Fortsetzen,
// Beenden und das Konto bestätigen darf nur der Inhaber (mit TAN); auslösen und pausieren dürfen beide. Freigegeben wird
// über die bestehenden Auftrags-Routen (auftrag/:id/tan, /freigeben, /ablehnen) — danach geht jeder Teilbetrag an die
// Buchhaltung. Ob ein Knopf geht, sagt nur der Server (planLage): Die Routen prüfen jede Regel selbst noch einmal.
// ═══════════════════════════════════════════════════════════════════════════
/** Die Plan-Nummer aus der Adresse — eine positive ganze Zahl, sonst null. */
const planIdAus = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Ein Fehlschlag aus der Plan-Logik als Antwort: Status, Kennung, Klartext — bei „zu früh“ auch der Zeitpunkt. */
function planFehlerSenden(res: Response, f: PlanFehler) {
  return res.status(f.status).json({ ok: false, code: f.code, error: f.grund, ...(f.naechsteAb ? { naechsteAb: f.naechsteAb } : {}) });
}

/** Die Vorschau ohne die TAN-Bindung — die bleibt im Server. */
const vorschauAussen = (v: PlanVorschau) => {
  const { ziel: _ziel, ...rest } = v;
  return rest;
};

/** Alles für den Reiter: Pläne mit Knopf-Zuständen, zur Freigabe, bei der Buchhaltung, Ausgeführt (20 je Seite), Verlauf. */
router.get("/buchhaltung/auszahlungsplan", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const seite = Math.max(0, Math.floor(Number(req.query.seite) || 0));
    res.json({ ok: true, ...(await planLage(req.buch!, { seite })) });
  } catch (err) { fehler(res, "auszahlungsplan")(err); }
});

/** Inhaber: wer einen Plan bekommen kann (aktive, echte Mitarbeiter), mit ihren offenen Altposten und den Vorgaben. */
router.get("/buchhaltung/auszahlungsplan/kandidaten", requireBuch("inhaber"), async (_req: BuchRequest, res: Response) => {
  try {
    res.json({
      ok: true,
      kandidaten: await planKandidaten(),
      vorgaben: { teilCents: VORGABE_TEIL_CENTS, abstandMin: VORGABE_ABSTAND_MIN, maxOffen: VORGABE_MAX_OFFEN, altposten: "verrechnet", hinweisAnInhaber: true },
      grenzen: GRENZEN,
    });
  } catch (err) { fehler(res, "auszahlungsplan kandidaten")(err); }
});

/** Inhaber: die Vorschau VOR der TAN — je Empfänger Teile, Konto und genau die Altposten, die verrechnet würden. */
router.post("/buchhaltung/auszahlungsplan/neu/vorschau", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const ein = planEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    res.json({ ok: true, vorschau: vorschauAussen(await planVorschau(ein.ein)) });
  } catch (err) { fehler(res, "auszahlungsplan vorschau")(err); }
});

/** Inhaber: TAN für die Anlage anfordern — die Mail nennt alle Pläne, den Takt und die Summe der verrechneten Altposten. */
router.post("/buchhaltung/auszahlungsplan/neu/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const ein = planEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const t = await planTanAnfordern(ein.ein, req.buch!);
    if (!t.ok) return planFehlerSenden(res, t);
    res.json({ ok: true, an: t.an, vorschau: vorschauAussen(t.vorschau) });
  } catch (err) { fehler(res, "auszahlungsplan tan")(err); }
});

/** Inhaber: Pläne anlegen — dieselbe Eingabe wie bei der TAN-Anforderung, dazu die TAN. Alles oder nichts. */
router.post("/buchhaltung/auszahlungsplan/neu", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const ein = planEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const erg = await planAnlegen(ein.ein, req.buch!, String((req.body as any)?.tan || ""));
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, plaene: erg.plaene, zurueckgerufen: erg.zurueckgerufen, hinweise: erg.hinweise });
  } catch (err) { fehler(res, "auszahlungsplan anlegen")(err); }
});

/** Inhaber oder Geschäftsführung: den nächsten Teilbetrag auslösen. Empfänger, Betrag und Konto stehen im Plan fest. */
router.post("/buchhaltung/auszahlungsplan/:id/ausloesen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await teilAusloesen(id, req.buch!);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, schon: erg.schon, auftrag: erg.auftrag, plan: erg.plan, teil: erg.teil, naechsteAb: erg.naechsteAb });
  } catch (err) { fehler(res, "auszahlungsplan ausloesen")(err); }
});

/** Beide Rollen: pausieren (mit Grund). Danach wird nichts ausgelöst und nichts freigegeben, bis der Inhaber fortsetzt. */
router.post("/buchhaltung/auszahlungsplan/:id/pause", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await planPausieren(id, req.buch!, text((req.body as any)?.grund, 300));
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true });
  } catch (err) { fehler(res, "auszahlungsplan pause")(err); }
});

/** Inhaber: fortsetzen. */
router.post("/buchhaltung/auszahlungsplan/:id/weiter", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await planFortsetzen(id, req.buch!);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true });
  } catch (err) { fehler(res, "auszahlungsplan weiter")(err); }
});

/** Inhaber: TAN zum Beenden anfordern. */
router.post("/buchhaltung/auszahlungsplan/:id/ende/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await planEndeTanAnfordern(id, req.buch!);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, an: erg.an, beschreibung: erg.beschreibung });
  } catch (err) { fehler(res, "auszahlungsplan ende tan")(err); }
});

/** Inhaber: beenden (Grund + TAN). Eingereichte Teilbeträge werden zurückgezogen; was bei der Buchhaltung liegt, kommt als Liste zurück. */
router.post("/buchhaltung/auszahlungsplan/:id/ende", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const b = req.body as any;
    const erg = await planBeenden(id, req.buch!, text(b?.grund, 300), String(b?.tan || ""));
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, zurueckgezogen: erg.zurueckgezogen, beiBuchhaltung: erg.beiBuchhaltung });
  } catch (err) { fehler(res, "auszahlungsplan ende")(err); }
});

/** Inhaber: die Hinweis-Mail „Bitte freigeben“ (nach jeder Auslösung durch die Geschäftsführung) an- oder abschalten. */
router.post("/buchhaltung/auszahlungsplan/:id/hinweis", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const an = (req.body as any)?.an;
    if (typeof an !== "boolean") return res.status(400).json({ ok: false, code: "EINGABE", error: "Bitte an oder aus wählen." });
    const erg = await planHinweisSetzen(id, req.buch!, an);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, an });
  } catch (err) { fehler(res, "auszahlungsplan hinweis")(err); }
});

/** Inhaber: TAN anfordern, um nach einer Kontoänderung des Empfängers das neue Konto zu übernehmen. */
router.post("/buchhaltung/auszahlungsplan/:id/konto/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await planKontoTanAnfordern(id, req.buch!);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, an: erg.an, beschreibung: erg.beschreibung });
  } catch (err) { fehler(res, "auszahlungsplan konto tan")(err); }
});

/** Inhaber: das neue Konto mit TAN übernehmen — künftige Teilbeträge gehen darauf, unterwegs bleibt unterwegs. */
router.post("/buchhaltung/auszahlungsplan/:id/konto", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.id);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Auszahlungsplan gibt es nicht." });
    const erg = await planKontoBestaetigen(id, req.buch!, String((req.body as any)?.tan || ""));
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, ibanMasked: erg.ibanMasked, unterwegs: erg.unterwegs });
  } catch (err) { fehler(res, "auszahlungsplan konto")(err); }
});

// ── Nach einem Rückruf (Nachbesserung E-484): Klärung eines Teilbetrags, „doch überwiesen“ bei einem Altposten ──
/**
 * Inhaber: Ein zurückgerufener Teilbetrag wurde von der Buchhaltung NICHT überwiesen — der Teil wird wieder frei (Grund).
 */
router.post("/buchhaltung/auszahlungsplan/klaerung/:auftragId/nicht-ausgefuehrt", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.auftragId);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Auftrag nicht gefunden." });
    const erg = await planKlaerungNichtAusgefuehrt(id, req.buch!, text((req.body as any)?.grund, 300));
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, planNummer: erg.planNummer, nr: erg.nr });
  } catch (err) { fehler(res, "klaerung nicht ausgefuehrt")(err); }
});

/** Inhaber: TAN anfordern, um einen zurückgerufenen Teilbetrag als „doch ausgeführt“ zu buchen. */
router.post("/buchhaltung/auszahlungsplan/klaerung/:auftragId/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.auftragId);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Auftrag nicht gefunden." });
    const ein = dochEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const erg = await planKlaerungTanAnfordern(id, req.buch!, ein.ein);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, an: erg.an, beschreibung: erg.beschreibung });
  } catch (err) { fehler(res, "klaerung tan")(err); }
});

/** Inhaber: „doch ausgeführt“ mit TAN — Auszahlung ausgebucht, Teilbetrag fertig. */
router.post("/buchhaltung/auszahlungsplan/klaerung/:auftragId/ausgefuehrt", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = planIdAus(req.params.auftragId);
    if (!id) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Auftrag nicht gefunden." });
    const ein = dochEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const erg = await planKlaerungAusgefuehrt(id, req.buch!, String((req.body as any)?.tan || ""), ein.ein);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, planNummer: erg.planNummer, nr: erg.nr, hinweis: erg.hinweis });
  } catch (err) { fehler(res, "klaerung ausgefuehrt")(err); }
});

/** Inhaber: TAN anfordern — ein beim Anlegen verrechneter Altposten wurde trotz Rückruf überwiesen. */
router.post("/buchhaltung/auszahlungsplan/:id/altposten/:auftragId/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const planId = planIdAus(req.params.id), auftragId = planIdAus(req.params.auftragId);
    if (!planId || !auftragId) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Nicht gefunden." });
    const ein = dochEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const erg = await altpostenDochTanAnfordern(planId, auftragId, req.buch!, ein.ein);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, an: erg.an, beschreibung: erg.beschreibung });
  } catch (err) { fehler(res, "altposten doch tan")(err); }
});

/** Inhaber (mit TAN): verrechneter Altposten doch überwiesen — alte Auszahlung ausgezahlt, Plan um den Betrag gekürzt. */
router.post("/buchhaltung/auszahlungsplan/:id/altposten/:auftragId/ueberwiesen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const planId = planIdAus(req.params.id), auftragId = planIdAus(req.params.auftragId);
    if (!planId || !auftragId) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Nicht gefunden." });
    const ein = dochEingabeLesen(req.body);
    if (!ein.ok) return planFehlerSenden(res, ein);
    const erg = await altpostenDochUeberwiesen(planId, auftragId, req.buch!, String((req.body as any)?.tan || ""), ein.ein);
    if (!erg.ok) return planFehlerSenden(res, erg);
    res.json({ ok: true, gekuerztCents: erg.gekuerztCents, restCents: erg.restCents, entfallen: erg.entfallen, planNummer: erg.planNummer });
  } catch (err) { fehler(res, "altposten doch ueberwiesen")(err); }
});

/**
 * ÖFFENTLICH, nur mit dem Bestätigungslink der Buchhaltung: Auftrag ansehen und die ausgeführte SEPA-Überweisung
 * bestätigen. Kein Banking-Zugang nötig — der Link (24 Zufallsbytes, gespeichert nur als Hash) ist der Nachweis.
 */
router.get("/buchhaltung/extern/:token", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const v = await externLesen(String(req.params.token || ""));
    if (!v) return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig oder abgelaufen." });
    res.json({ ok: true, auftrag: v });
  } catch (err) { fehler(res, "extern lesen")(err); }
});

router.post("/buchhaltung/extern/:token/bestaetigen", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    if (!gleicheHerkunft(req)) return res.status(403).json({ ok: false, code: "HERKUNFT", error: "Anfrage von fremder Seite abgewiesen." });
    const ip = clientIp(req);
    const warte = gesperrtFuer(`extern:${ip}`);
    if (warte > 0) return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte später erneut." });
    const b = req.body as any;
    // E-484: die Bank-Referenz der Buchhaltung — freiwillig; wenn angegeben, prüft die Lib Form und Eindeutigkeit.
    const erg = await externBestaetigen(String(req.params.token || ""), {
      wertAm: istTag(b?.wertAm) ? String(b.wertAm) : null, notiz: text(b?.notiz, 200) || null, bankReferenz: text(b?.bankReferenz, 200) || null,
    });
    if (!erg.ok) {
      if (/ungültig/.test(erg.grund)) bremse(`extern:${ip}`);
      return res.status(400).json({ ok: false, error: erg.grund });
    }
    // E-484: Kein interner Hinweis auf der Seite der fremden Buchhaltung — er steht im Protokoll und geht an den
    // Inhaber (externBestaetigen). Die Buchhaltung sieht nur „bestätigt“.
    res.json({ ok: true, hinweis: null, auftrag: await externLesen(String(req.params.token || "")) });
  } catch (err) { fehler(res, "extern bestaetigen")(err); }
});

router.get("/buchhaltung/auszahlung/:id/beleg.pdf", requireBuch(), async (req: Request, res: Response) => {
  try {
    const { auszahlungsbeleg } = await import("../lib/fiaon-banking-pdf");
    pdfSenden(res, await auszahlungsbeleg(Number(req.params.id)), `FIAON_Auszahlungsbeleg_${Number(req.params.id)}.pdf`);
  } catch (err) {
    console.error("[BANKING] auszahlungsbeleg:", err);
    res.status(409).send(String((err as Error)?.message || "Der Beleg konnte nicht erzeugt werden."));
  }
});

router.get("/buchhaltung/abrechnung/:id.pdf", requireBuch(), async (req: Request, res: Response) => {
  try {
    const a = await abrechnungPdf(Number(req.params.id));
    if (!a) return res.status(404).send("Diese Abrechnung hat kein PDF.");
    pdfSenden(res, a.daten, a.name);
  } catch (err) { fehler(res, "abrechnung")(err); }
});

router.get("/buchhaltung/auszahlungsjournal.pdf", requireBuch(), async (req: Request, res: Response) => {
  try {
    const { auszahlungsjournal } = await import("../lib/fiaon-banking-pdf");
    const von = istTag(req.query.von) ? String(req.query.von) : null;
    const bis = istTag(req.query.bis) ? String(req.query.bis) : null;
    pdfSenden(res, await auszahlungsjournal(von, bis), `FIAON_Auszahlungsjournal_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error("[BANKING] journal:", err);
    res.status(500).send("Das Journal konnte nicht erzeugt werden.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUSZÜGE
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/auszug.pdf", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const konto = String(req.query.konto) === "wise" ? "wise" : "geschaeft";
    const monat = String(req.query.monat || "");
    if (!/^\d{4}-\d{2}$/.test(monat)) return res.status(400).send("Monat im Format JJJJ-MM angeben.");
    const { kassenbuchauszug } = await import("../lib/fiaon-banking-pdf");
    const pdf = await kassenbuchauszug(konto, monat);
    buchProtokoll(req.buch!.email, "Auszug erstellt", `${konto}:${monat}`, null);
    pdfSenden(res, pdf, `FIAON_Kassenbuchauszug_${konto === "wise" ? "Wise" : "Geschaeftskonto"}_${monat}.pdf`);
  } catch (err) {
    console.error("[BANKING] auszug:", err);
    res.status(500).send("Der Auszug konnte nicht erzeugt werden.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER KONTOSTAND — nur der Inhaber, jede Bewegung mit TAN
//
// Das TAN-Ziel enthält den ganzen Vorgang. Die Oberfläche fordert die TAN mit
// denselben Daten an, mit denen sie danach bucht; ändert sich dazwischen ein
// Cent oder ein Tag, passt die TAN nicht mehr.
// ═══════════════════════════════════════════════════════════════════════════
type KassenVorgang =
  | { art: "anfang"; cents: number; am: string; notiz: string }
  | { art: BewegungArt; cents: number; wertAm: string; zweck: string; gegenpartei: string | null; beleg: string | null }
  | { art: "storno"; id: number; grund: string };

function kassenVorgang(b: any): { ok: true; v: KassenVorgang } | { ok: false; grund: string } {
  const art = String(b?.art || "");
  if (art === "anfang") {
    const c = cents(b?.betrag);
    if (!Number.isFinite(c)) return { ok: false, grund: "Bitte den Kontostand angeben." };
    if (!istTag(b?.am)) return { ok: false, grund: "Bitte den Tag des Endstands angeben." };
    return { ok: true, v: { art: "anfang", cents: c, am: String(b.am), notiz: text(b?.notiz, 200) } };
  }
  if (art === "storno") {
    const id = Number(b?.id);
    const grund = text(b?.grund, 200);
    if (!id) return { ok: false, grund: "Welche Buchung?" };
    if (!grund) return { ok: false, grund: "Bitte einen Grund angeben." };
    return { ok: true, v: { art: "storno", id, grund } };
  }
  if ((BEWEGUNG_ARTEN as readonly string[]).includes(art)) {
    const c = cents(b?.betrag);
    if (!Number.isFinite(c) || c === 0) return { ok: false, grund: "Bitte einen Betrag angeben." };
    if (art !== "korrektur" && c < 0) return { ok: false, grund: "Bitte einen positiven Betrag angeben — die Richtung ergibt sich aus der Art." };
    if (!istTag(b?.wertAm)) return { ok: false, grund: "Bitte das Wertstellungsdatum angeben." };
    const zweck = text(b?.zweck, 140);
    if (!zweck) return { ok: false, grund: "Bitte einen Zweck angeben — eine Buchung ohne Zweck ist keine Buchung." };
    return { ok: true, v: { art: art as BewegungArt, cents: c, wertAm: String(b.wertAm), zweck, gegenpartei: text(b?.gegenpartei, 140) || null, beleg: text(b?.beleg, 80) || null } };
  }
  return { ok: false, grund: "Unbekannter Vorgang." };
}

function kassenZiel(v: KassenVorgang): string {
  if (v.art === "anfang") return `anfang:${v.cents}:${v.am}`;
  if (v.art === "storno") return `storno:${v.id}`;
  return `buchung:${v.art}:${v.cents}:${v.wertAm}:${v.zweck.slice(0, 40)}`;
}

function kassenBeschreibung(v: KassenVorgang): string {
  if (v.art === "anfang") return `Anfangsbestand ${geldText(v.cents)} (Endstand am ${v.am.split("-").reverse().join(".")})`;
  if (v.art === "storno") return `Storno der Buchung Nr. ${v.id} — ${v.grund}`;
  const namen: Record<BewegungArt, string> = { einlage: "Einlage", eingang: "Eingang", ausgabe: "Ausgabe", korrektur: "Korrekturbuchung" };
  const vz = v.art === "ausgabe" ? "−" : v.art === "korrektur" ? (v.cents < 0 ? "−" : "+") : "+";
  return `${namen[v.art]} ${vz}${geldText(Math.abs(v.cents))} am ${v.wertAm.split("-").reverse().join(".")} — ${v.zweck}`;
}

router.post("/buchhaltung/kasse/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const p = kassenVorgang(req.body);
    if (!p.ok) return res.status(400).json({ ok: false, error: p.grund });
    const t = await tanAnfordern(req.buch!, "kasse", kassenZiel(p.v), kassenBeschreibung(p.v));
    if (!t.ok) return res.status(503).json({ ok: false, error: t.grund });
    res.json({ ok: true, an: req.buch!.email, beschreibung: kassenBeschreibung(p.v) });
  } catch (err) { fehler(res, "kasse tan")(err); }
});

router.post("/buchhaltung/kasse/buchen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const p = kassenVorgang(req.body);
    if (!p.ok) return res.status(400).json({ ok: false, error: p.grund });
    const t = await tanPruefen(req.buch!, "kasse", kassenZiel(p.v), String((req.body as any)?.tan || ""));
    if (!t.ok) return res.status(400).json({ ok: false, error: t.grund });
    const v = p.v;
    if (v.art === "anfang") {
      await anfangsbestandSetzen({ cents: v.cents, am: v.am, notiz: v.notiz, von: req.buch!.email });
      buchProtokoll(req.buch!.email, "Anfangsbestand gesetzt", v.am, `${geldText(v.cents)} · TAN bestätigt`);
    } else if (v.art === "storno") {
      const erg = await bewegungStornieren(v.id, req.buch!, v.grund);
      if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    } else {
      await bewegungBuchen({ art: v.art, betragCents: v.cents, wertAm: v.wertAm, zweck: v.zweck, gegenpartei: v.gegenpartei, beleg: v.beleg }, req.buch!);
    }
    res.json({ ok: true, kasse: await kasse() });
  } catch (err) { fehler(res, "kasse buchen")(err); }
});

/** Der Bankabgleich bewegt nichts — er hält fest, was die Bank am Ende eines Tages zeigte. */
router.post("/buchhaltung/kasse/abgleich", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const c = cents(b?.betrag);
    if (!Number.isFinite(c)) return res.status(400).json({ ok: false, error: "Bitte den Kontostand laut Bank angeben." });
    if (!istTag(b?.am)) return res.status(400).json({ ok: false, error: "Bitte den Tag angeben." });
    await bankabgleichSetzen({ cents: c, am: String(b.am), von: req.buch!.email, erfasst: new Date().toISOString() });
    buchProtokoll(req.buch!.email, "Bankabgleich erfasst", String(b.am), geldText(c));
    res.json({ ok: true, kasse: await kasse() });
  } catch (err) { fehler(res, "abgleich")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERGABE UND PAPIERE
// ═══════════════════════════════════════════════════════════════════════════
router.post("/buchhaltung/uebergabe", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const b = req.body as any;
    const bisher = text(b?.bisher, 160);
    if (!bisher) return res.status(400).json({ ok: false, error: "Bitte angeben, wer die Buchhaltung bisher geführt hat." });
    if (!istTag(b?.stichtag)) return res.status(400).json({ ok: false, error: "Bitte den Stichtag angeben." });
    const alt = await uebergabe();
    await uebergabeSetzen({ bisher, stichtag: String(b.stichtag), bestaetigtVon: alt?.bestaetigtVon, bestaetigtAm: alt?.bestaetigtAm });
    buchProtokoll(req.buch!.email, "Übergabe hinterlegt", String(b.stichtag), bisher);
    res.json({ ok: true, uebergabe: await uebergabe() });
  } catch (err) { fehler(res, "uebergabe")(err); }
});

router.post("/buchhaltung/uebergabe/bestaetigen", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const u = await uebergabe();
    if (!u) return res.status(404).json({ ok: false, error: "Es ist keine Übergabe hinterlegt." });
    if (u.bestaetigtVon) return res.status(409).json({ ok: false, error: "Die Übernahme ist bereits bestätigt." });
    if (req.buch!.rolle !== "buchhaltung") return res.status(403).json({ ok: false, error: "Bestätigen kann nur, wer übernimmt." });
    await uebergabeSetzen({ ...u, bestaetigtVon: req.buch!.email, bestaetigtAm: new Date().toISOString() });
    buchProtokoll(req.buch!.email, "Übernahme bestätigt", u.stichtag, null);
    benachrichtigen(inhaber().email, "Übernahme der Buchhaltung bestätigt", [`${req.buch!.name} hat die Übernahme der Buchhaltung bestätigt.`]);
    res.json({ ok: true, uebergabe: await uebergabe() });
  } catch (err) { fehler(res, "uebergabe bestaetigen")(err); }
});

router.get("/buchhaltung/uebergabe.pdf", requireBuch(), async (_req: Request, res: Response) => {
  try {
    const { uebergabeVermerk } = await import("../lib/fiaon-banking-pdf");
    pdfSenden(res, await uebergabeVermerk(), "FIAON_Uebergabe_Buchhaltung.pdf");
  } catch (err) {
    console.error("[BANKING] uebergabe.pdf:", err);
    res.status(500).send("Der Vermerk konnte nicht erzeugt werden.");
  }
});

router.get("/buchhaltung/zugang.pdf", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const wunsch = buchPerson(String(req.query.fuer || ""));
    const ziel = req.buch!.rolle === "inhaber" && wunsch ? wunsch : req.buch!;
    const { zugangsblatt } = await import("../lib/fiaon-banking-pdf");
    pdfSenden(res, await zugangsblatt(ziel), `FIAON_Zugang_Banking_${ziel.name.split(" ").pop()}.pdf`);
  } catch (err) {
    console.error("[BANKING] zugang.pdf:", err);
    res.status(500).send("Das Zugangsblatt konnte nicht erzeugt werden.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SICHERHEIT
// ═══════════════════════════════════════════════════════════════════════════
router.get("/buchhaltung/sicherheit", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const [sitz, gesp] = await Promise.all([sitzungenListe(req.sitzung!), gesperrte()]);
    const rows = (req.buch!.rolle === "inhaber"
      ? await sqlPool`SELECT person, aktion, ziel, notiz, zeit FROM fiaon_buch_log ORDER BY zeit DESC LIMIT 250`
      : await sqlPool`SELECT person, aktion, ziel, notiz, zeit FROM fiaon_buch_log ORDER BY zeit DESC LIMIT 150`) as any[];
    res.json({
      ok: true,
      sitzungen: sitz,
      gesperrt: gesp,
      leute: BUCH_LEUTE,
      protokoll: rows.map((r) => ({
        person: r.person, name: r.person ? buchPerson(String(r.person))?.name ?? r.person : "System",
        aktion: r.aktion, ziel: r.ziel, notiz: r.notiz, zeit: new Date(r.zeit).toISOString(),
      })),
    });
  } catch (err) { fehler(res, "sicherheit")(err); }
});

router.post("/buchhaltung/sitzungen/andere-beenden", requireBuch(), async (req: BuchRequest, res: Response) => {
  try {
    const n = await sitzungenBeenden(req.buch!.email, req.sitzung!.sid, "Von Hand beendet");
    buchProtokoll(req.buch!.email, "Andere Sitzungen beendet", null, `${n} Sitzung(en)`);
    res.json({ ok: true, beendet: n });
  } catch (err) { fehler(res, "andere beenden")(err); }
});

/** Der Notschalter des Inhabers: Zugang einer Person sofort sperren oder wieder öffnen. */
router.post("/buchhaltung/zugang/sperre", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const person = buchPerson(text((req.body as any)?.email));
    if (!person) return res.status(404).json({ ok: false, error: "Unbekannte Person." });
    if (person.rolle === "inhaber") return res.status(400).json({ ok: false, error: "Den Inhaber-Zugang sperrt man nicht über sich selbst." });
    await sperreSetzen(person.email, (req.body as any)?.gesperrt === true, req.buch!);
    res.json({ ok: true, gesperrt: await gesperrte() });
  } catch (err) { fehler(res, "sperre")(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TAKTE
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("banking-dauerauftraege", async () => {
  const n = await dauerauftraegeAusloesen();
  if (n > 0) console.log(`[BANKING] ${n} Dauerauftrag/-aufträge fällig — als Zahlungsauftrag eingereicht`);
}, 60 * 60 * 1000, { beimStartNach: 180_000 });

airwallexProbe();

export default router;
