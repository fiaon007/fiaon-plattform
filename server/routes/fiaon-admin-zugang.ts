// ═══════════════════════════════════════════════════════════════════
// FIAON Admin-Zugang — EIN Zahlencode vor dem ganzen Verwaltungsbereich
//
// Warum kein zweiter Login: Es gibt keinen zweiten Personenkreis, der hier
// getrennt werden müsste. Gebraucht wird eine Tür, nicht eine Benutzer-
// verwaltung. Der Code ist der Schlüssel, das signierte Cookie das Band, das
// man nicht bei jeder Seite neu zeigen muss.
//
// Die Wahrheit liegt serverseitig: adminCodeGate hängt VOR allen /admin-
// Endpoints unter /api/fiaon. Ohne gültiges Cookie antwortet jeder Admin-
// Endpoint mit 401 — auch dann, wenn jemand die Oberfläche umgeht und die
// API direkt aufruft. Die Sperre im Browser ist nur die Anzeige dazu.
//
// Reihenfolge in server/routes.ts:
//   1. blockAgentsFromAdmin  → Agent-Token auf /admin ⇒ 403 (Rollentrennung)
//   2. adminCodeGate         → kein Code ⇒ 401 (diese Datei)
// Ein angemeldeter Agent bekommt also weiterhin 403 und nicht die Code-Frage:
// er soll nicht einmal erfahren, dass es einen Code gibt.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { readChef } from "./fiaon-chef-zugang";

const COOKIE = "fiaon_admin";
/** 30 Tage: lange genug, dass man den Code im Alltag nie wieder tippt. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CODE_LENGTH = 8;

function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
}

/**
 * Der Code kommt aus der Umgebung, damit er ohne Deploy wechselbar ist.
 * Der Vorgabewert hält das System auch ohne gesetzte Variable geschlossen.
 */
function expectedCode(): string {
  return String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
}

/**
 * Fingerabdruck des aktuellen Codes im Cookie-Siegel: Wird der Code geändert,
 * verlieren ALLE ausgegebenen Cookies sofort ihre Gültigkeit. Ohne das wäre ein
 * Codewechsel wirkungslos, solange irgendwo noch ein altes Cookie liegt.
 */
function codeFingerprint(): string {
  return createHmac("sha256", secret()).update(`admincode:${expectedCode()}`).digest("hex").slice(0, 16);
}

function sign(exp: number): string {
  return createHmac("sha256", secret()).update(`adminzugang:${exp}:${codeFingerprint()}`).digest("hex").slice(0, 40);
}

function issueToken(): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(exp)}`;
}

/** Prüft das Cookie: Ablauf, Signatur und Code-Fingerabdruck müssen passen. */
export function hasAdminCode(req: Request): boolean {
  const token = (req as any).cookies?.[COOKIE];
  if (typeof token !== "string") return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  return equalStr(sig, sign(exp));
}

/** Zeitkonstanter Vergleich — verhindert, dass man den Code Stelle für Stelle ertastet. */
function equalStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ── Fehlversuche bremsen ─────────────────────────────────────────────────────
// Ein achtstelliger Zahlencode hat 100 Mio. Möglichkeiten. Ohne Bremse wären
// die in Stunden durchprobiert, mit Bremse in Jahrhunderten. Bewusst im
// Speicher: eine Tabelle dafür anzulegen wäre Aufwand ohne Gewinn, ein
// Neustart löscht höchstens die Sperre eines Angreifers, der dann wieder von
// vorn beginnt.
type Attempt = { fails: number; lockedUntil: number };
const attempts = new Map<string, Attempt>();
const FREE_TRIES = 5;

function clientKey(req: Request): string {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || "unbekannt";
}

function lockMs(fails: number): number {
  if (fails <= FREE_TRIES) return 0;
  // 30 s, 1 min, 2 min, 4 min … bis maximal 15 min
  return Math.min(15 * 60_000, 30_000 * 2 ** (fails - FREE_TRIES - 1));
}

function lockedFor(req: Request): number {
  const a = attempts.get(clientKey(req));
  if (!a) return 0;
  return Math.max(0, a.lockedUntil - Date.now());
}

// ── Router (mount: /api/fiaon/zugang — bewusst NICHT unter /admin, sonst
//    würde das Gate seine eigene Tür zumauern) ────────────────────────────────
const router = Router();

/** Anzeige-Zustand für die Oberfläche: gesperrt oder offen. */
router.get("/status", (req: Request, res: Response) => {
  res.json({
    ok: true,
    entsperrt: hasAdminCode(req),
    // Kennzeichen kommt aus server/routes.ts (agentMarkieren) — diese Datei
    // bleibt bewusst frei von Datenbank- und Agent-Abhängigkeiten.
    agent: !!(req as any).agentAngemeldet,
    wartezeitMs: lockedFor(req),
    laenge: CODE_LENGTH,
  });
});

/** Code prüfen und bei Erfolg das Cookie setzen. */
router.post("/oeffnen", (req: Request, res: Response) => {
  const key = clientKey(req);
  const warten = lockedFor(req);
  if (warten > 0) {
    return res.status(429).json({
      ok: false, code: "TOO_MANY", wartezeitMs: warten,
      error: `Zu viele Fehlversuche. Bitte ${Math.ceil(warten / 1000)} Sekunden warten.`,
    });
  }

  const eingabe = String((req.body as any)?.code ?? "").replace(/\D/g, "");
  if (eingabe.length === CODE_LENGTH && equalStr(eingabe, expectedCode())) {
    attempts.delete(key);
    res.cookie(COOKIE, issueToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TTL_MS,
      path: "/",
    });
    return res.json({ ok: true, entsperrt: true });
  }

  const a = attempts.get(key) || { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  const sperre = lockMs(a.fails);
  a.lockedUntil = sperre > 0 ? Date.now() + sperre : 0;
  attempts.set(key, a);
  console.warn(`[ADMIN-ZUGANG] Fehlversuch (${a.fails}) von ${key}`);

  res.status(401).json({
    ok: false, code: "WRONG_CODE", wartezeitMs: sperre,
    error: sperre > 0 ? `Falscher Code. Bitte ${Math.ceil(sperre / 1000)} Sekunden warten.` : "Falscher Code.",
    versucheFrei: Math.max(0, FREE_TRIES - a.fails),
  });
});

/** Wieder abschliessen (z. B. fremdes Gerät). */
router.post("/schliessen", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true, entsperrt: false });
});

/**
 * Das Gate selbst. Wird in server/routes.ts auf /api/fiaon gemountet, req.path
 * ist dort relativ zum Mount (also "/admin/hub/stats").
 */
// ═══════════════════════════════════════════════════════════════════════════
// ZWEITER WEG DURCH DIESE TÜR: DIE PERSÖNLICHE CHEF-ANMELDUNG (26.08.2026)
//
// GEFUNDEN beim Nachprüfen: Das Chefbüro setzt beim Anmelden nur sein eigenes
// Cookie (fiaon_chef). Jeder Raum dort verlinkt aber auf /admin-Seiten, und
// die hingen ausschliesslich am geteilten Zugangscode. Wer sich also im
// Chefbüro anmeldete, ohne den Code zusätzlich zu kennen, sah acht Räume, in
// denen jede einzelne Seite „Verwaltungsbereich gesperrt" meldete. Das
// Chefbüro war für Florentine und Daniel eine Fassade.
//
// Der geteilte Code bleibt bestehen (Justins gewohnter Weg). Daneben zählt ab
// jetzt die persönliche Anmeldung — sie ist der STÄRKERE Nachweis: sie hängt
// an einem Konto, an einem bcrypt-Passwort und an session_epoch, statt an
// einem Wort, das drei Leute kennen.
//
// ── DIE STUFE GILT AUCH HIER ──────────────────────────────────────────────
// Im Chefbüro sind „Geld" und „System" erst ab Geschäftsführung sichtbar.
// Wäre der Gate blind für die Stufe, käme die Leitung über die blosse
// Adresszeile trotzdem an jede Geldzahl — die Raumsperre wäre Zierrat. Die
// Liste unten spiegelt deshalb genau die beiden Räume wider.
// ═══════════════════════════════════════════════════════════════════════════
const NUR_GESCHAEFTSFUEHRUNG = [
  "/admin/zahlungen", "/admin/verbuchung", "/admin/kontoabgleich",
  "/admin/auszahlungen", "/admin/abrechnungen", "/admin/verbuchungen",
  "/admin/buchhaltung", "/admin/rechnungen", "/admin/finanzen",
  "/admin/investoren", "/admin/payouts", "/admin/payments",
  "/admin/commissions", "/admin/commission-backfill", "/admin/ledger",
  "/admin/finance", "/admin/truth-check", "/admin/kontoauszug",
  "/admin/einstellungen", "/admin/settings", "/admin/diagnose", "/admin/audit",
];

export function adminCodeGate(req: Request, res: Response, next: NextFunction) {
  // ═══════════════════════════════════════════════════════════════════════
  // KLEINGESCHRIEBEN VERGLEICHEN — SONST IST DIE WAND EINE ATTRAPPE
  //
  // Gefunden bei der Abnahme am 02.09.2026, gegen die Produktion gemessen:
  //   GET /api/fiaon/admin/kunden   → 401  (Wand greift)
  //   GET /api/fiaon/ADMIN/kunden   → 200  (5.801 Datensätze, ohne Cookie)
  //
  // Express routet standardmäßig OHNE Rücksicht auf Groß- und Kleinschreibung
  // („case sensitive routing" ist per Vorgabe aus). Die Route griff also auch
  // bei /ADMIN — dieser Vergleich hier aber nicht. Ergebnis: Name, E-Mail und
  // Telefonnummer von 5.801 Menschen waren öffentlich abrufbar, solange man
  // einen Großbuchstaben tippte.
  //
  // Der Pfad wird deshalb kleingeschrieben verglichen, hier und in
  // blockAgentsFromAdmin. Zwei Zeichen, die den Unterschied zwischen einer
  // Wand und einer Attrappe ausmachen.
  // ═══════════════════════════════════════════════════════════════════════
  const pfad = String(req.path || "").toLowerCase();
  if (!pfad.startsWith("/admin")) return next();
  if (hasAdminCode(req)) return next();

  const chef = readChef(req);
  if (chef) {
    const heikel = NUR_GESCHAEFTSFUEHRUNG.some((p) => pfad.startsWith(p));
    if (!heikel || chef.stufe === "inhaber" || chef.stufe === "geschaeftsfuehrung") {
      return next();
    }
    return res.status(403).json({
      ok: false,
      code: "STUFE_ZU_NIEDRIG",
      error: "Dieser Bereich ist der Geschäftsführung vorbehalten.",
      stufe: chef.stufe,
    });
  }

  return res.status(401).json({
    ok: false,
    code: "ADMIN_CODE_REQUIRED",
    error: "Verwaltungsbereich gesperrt — Zugangscode erforderlich.",
  });
}

export default router;
