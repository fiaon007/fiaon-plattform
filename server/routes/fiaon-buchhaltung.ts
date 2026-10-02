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
  auftragFreigeben, auftragAblehnen, auftragAusfuehren, auftragAusAuszahlung,
  freigabeMoeglich, freigabeZiel, freigabeBeschreibung,
  empfaengerSuchen, empfaengerKartei, empfaengerLoeschen,
  dauerauftraege, dauerauftragAnlegen, dauerauftragBeenden, dauerauftraegeAusloesen,
  ibanGueltig, ibanSauber,
} from "../lib/fiaon-buchhaltung";
import {
  KONTEN, umsaetze, umsatz, umsaetzeCsv, kasse, monatsfluss, offenePosten, auszahlungen, abrechnungPdf,
  airwallexProbe, type UmsatzArt, type KontoSchluessel,
} from "../lib/fiaon-banking";
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
    const { mailNeuSenden, gmailBereit } = await import("../lib/fiaon-gmail");
    if (!gmailBereit()) {
      console.error("[BANKING] PIN nicht versendbar — GOOGLE_SA_KEY fehlt");
      return res.status(503).json({ ok: false, error: "Der PIN-Versand ist gerade nicht möglich. Bitte bei js@fiaon.com melden." });
    }
    await mailNeuSenden("js@fiaon.com", person.email, `PIN ${pin.slice(0, 4)}-•••• · FIAON Banking`, [
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
    ].join("\n"));
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
    const [k, offen, fluss, letzte, alle, u, dauer, ausz, nachholen0, aeltere] = await Promise.all([
      kasse(), offenePosten(), monatsfluss(),
      umsaetze({ konto: "alle", limit: 8 }),
      auftraege(200), uebergabe(), dauerauftraege(), auszahlungen(), nachholZahl(), nachholZahl(NACHHOLEN_SEIT_AELTESTE),
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
      leute: BUCH_LEUTE,
    });
  } catch (err) { fehler(res, "lage")(err); }
});

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
      : await nach.bankeingangTrockenprobe(id, { ziel, dazu, mitVorschlag: !ziel && !dazu.length });
    res.status(a.ok ? 200 : a.status).json(a.ok ? { ok: true, zeile: a.zeile } : { ok: false, error: a.error, zeile: a.zeile ?? null });
  } catch (err) { fehler(res, "nachholen/trocken")(err); }
});

/** EINEN Eingang buchen — nur Inhaber, erst Trockenprobe, dann der eine Buchungsweg. */
router.post("/buchhaltung/nachholen/:uid/buchen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const id = bankId(req.params.uid);
    if (!id) return res.status(400).json({ ok: false, error: "Das ist kein Bankeingang." });
    const { bankeingangBuchen } = await import("../lib/fiaon-bank-nachholen");
    const a = await bankeingangBuchen(id, {
      wer: `Bankbuch ${req.buch!.email}`, erwartet: req.body?.erwartet ?? null, ziel: zielAusBody(req.body), dazu: dazuAusBody(req.body),
    });
    const z = a.zeile;
    buchProtokoll(req.buch!.email, a.ok && a.ergebnis?.gebucht ? "Bankeingang gebucht" : "Bankeingang NICHT gebucht",
      z ? `bank:${z.id}` : `bank:${id}`,
      z ? `${geldText(z.summeCents ?? z.betragCents)} ${z.zielVomMenschen ? `Ziel ${z.zielVomMenschen}` : z.zweckRef ?? ""}${z.dazu?.length ? ` + Sammel ${z.dazu.map((d) => `#${d}`).join(",")}` : ""} → ${z.regel ?? "—"} ${z.ziel ?? ""}: ${a.ok ? a.ergebnis?.grund : a.error}`.slice(0, 300) : String(a.error ?? "").slice(0, 300));
    if (!a.ok) return res.status(a.status).json({ ok: false, error: a.error, zeile: z ?? null });
    res.json({ ok: true, zeile: z, ergebnis: a.ergebnis, aufgabe: a.aufgabe ?? null });
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
    type Schritt = { id: number; modus: "buchen" | "zuordnen"; ziel: string | null; dazu: number[]; erwartet: any };
    const auftraege: Schritt[] = Array.isArray(req.body?.auftraege)
      ? req.body.auftraege.map((x: any): Schritt => ({
        id: bankId(x?.id) ?? 0, modus: x?.modus === "zuordnen" ? "zuordnen" : "buchen", ziel: zielAusBody(x), dazu: dazuAusBody(x), erwartet: x?.erwartet ?? null,
      })).filter((x: Schritt) => x.id > 0)
      : (Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => bankId(x)).filter((n: number | null): n is number => !!n)
        .map((id: number): Schritt => ({ id, modus: "buchen", ziel: null, dazu: [], erwartet: null }));
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
        const a = await bankeingangBuchen(x.id, { wer, ziel: x.ziel, dazu: x.dazu, erwartet: x.erwartet });
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
  try { res.json({ ok: true, auftraege: await auftraege(300) }); }
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

/** TAN für eine Freigabe anfordern — die Mail nennt Betrag, Empfänger und IBAN. */
router.post("/buchhaltung/auftrag/:id/tan", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const a = await auftrag(Number(req.params.id));
    if (!a) return res.status(404).json({ ok: false, error: "Auftrag nicht gefunden." });
    const darf = freigabeMoeglich(a, req.buch!);
    if (!darf.ok) return res.status(400).json({ ok: false, error: darf.grund });
    const t = await tanAnfordern(req.buch!, "freigabe", freigabeZiel(a), freigabeBeschreibung(a));
    if (!t.ok) return res.status(503).json({ ok: false, error: t.grund });
    res.json({ ok: true, an: req.buch!.email, beschreibung: freigabeBeschreibung(a), art: darf.art });
  } catch (err) { fehler(res, "tan")(err); }
});

router.post("/buchhaltung/auftrag/:id/freigeben", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
  try {
    const erg = await auftragFreigeben(Number(req.params.id), req.buch!, String((req.body as any)?.tan || ""));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, auftrag: erg.auftrag });
  } catch (err) { fehler(res, "freigeben")(err); }
});

router.post("/buchhaltung/auftrag/:id/ablehnen", requireBuch("inhaber"), async (req: BuchRequest, res: Response) => {
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
  try { res.json({ ok: true, auszahlungen: await auszahlungen() }); }
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
