// ═══════════════════════════════════════════════════════════════════════════
// FIAON Chef-Zugang — persönliche Admin-Sitzungen mit Stufen (24.08.2026)
// Bezug: 01_Plattform/CHEFBUERO_PLAN_2026-08-24.md §2.2 (E-053), Scheibe 1.
//
// VORHER: EIN Sammel-Zahlencode (fiaon-admin-zugang.ts) — wer ihn kennt, kann
// alles, und niemand weiß hinterher, wer was tat. NACHHER: Anmeldung mit dem
// eigenen Mitarbeiter-Konto (E-Mail + Passwort, bcrypt wie /agent/login);
// nur die Stufe „inhaber“ braucht zusätzlich den Chef-Code (ADMIN_ACCESS_CODE)
// als zweiten Faktor. Jede Sitzung gehört einer Person und läuft nach 12 h ab
// — bewusst kürzer als die alten 30 Tage des Sammel-Codes.
//
//   POST /chef/anmelden   { email, passwort, code? } → setzt Cookie fiaon_chef
//   GET  /chef/status     → { angemeldet, stufe, quelle }
//   POST /chef/abmelden   → löscht fiaon_chef UND das alte fiaon_admin-Cookie
//
// Stufen (Spalte fiaon_agents.admin_stufe, wird von Hand gesetzt — KEINE
// Migration befüllt sie): NULL = kein Admin · 'inhaber' (Justin, alles) ·
// 'geschaeftsfuehrung' (Florentine) · 'leitung' (Daniel). Rangfolge:
// inhaber > geschaeftsfuehrung > leitung.
//
// ÜBERGANG (Parallelbetrieb): requireChef akzeptiert auch das alte
// fiaon_admin-Cookie und wertet es als 'inhaber' — sonst wäre Justin in der
// Minute des Umbaus ausgesperrt. Das Scharfschalten der Stufen-Prüfung auf
// allen bestehenden /admin-Routen ist eine SPÄTERE Scheibe; die
// adminCodeGate-Kette in server/routes.ts bleibt unangetastet in Betrieb.
//
// Protokoll: Tabelle fiaon_admin_log (wer, wann, was, Ziel). requireChef
// schreibt für jede NICHT-GET-Anfrage automatisch eine Zeile; chefProtokoll()
// ist der Weg für Routen, die Ziel/Notiz genauer benennen wollen. Fehler beim
// Protokoll dürfen die eigentliche Anfrage NIE kippen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { sqlPool } from "../lib/db-pool";
import { hasAdminCode } from "./fiaon-admin-zugang";

const COOKIE = "fiaon_chef";
/** 12 Stunden: ein Arbeitstag. Wer morgens kommt, meldet sich einmal an. */
const TTL_MS = 12 * 60 * 60 * 1000;

export type ChefStufe = "inhaber" | "geschaeftsfuehrung" | "leitung";
/** Rangfolge — höher darf alles, was niedriger darf. */
const RANG: Record<ChefStufe, number> = { inhaber: 3, geschaeftsfuehrung: 2, leitung: 1 };
const STUFEN = Object.keys(RANG) as ChefStufe[];

function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
}

/** Derselbe Code wie beim alten Gate — er bleibt die Einbruchs-Bremse des Inhabers. */
function chefCode(): string {
  return String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
}

// ── Cookie: agentId.stufe.exp.signatur ──────────────────────────────────────
function sign(agentId: number, stufe: ChefStufe, exp: number): string {
  return createHmac("sha256", secret()).update(`chefzugang:${agentId}:${stufe}:${exp}`).digest("hex").slice(0, 40);
}

function issueToken(agentId: number, stufe: ChefStufe): string {
  const exp = Date.now() + TTL_MS;
  return `${agentId}.${stufe}.${exp}.${sign(agentId, stufe, exp)}`;
}

/** Zeitkonstanter Vergleich — wie im alten Gate. */
function equalStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Liest und prüft das neue Cookie. null = keine gültige Chef-Sitzung. */
function readChef(req: Request): { agentId: number; stufe: ChefStufe } | null {
  const token = (req as any).cookies?.[COOKIE];
  if (typeof token !== "string") return null;
  const [idStr, stufe, expStr, sig] = token.split(".");
  const agentId = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isInteger(agentId) || agentId <= 0) return null;
  if (!STUFEN.includes(stufe as ChefStufe)) return null;
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return null;
  if (!equalStr(sig, sign(agentId, stufe as ChefStufe, exp))) return null;
  return { agentId, stufe: stufe as ChefStufe };
}

// ── Lazy ensure: Spalte admin_stufe + Tabelle fiaon_admin_log ───────────────
// Muster ensureVertriebSpalten (fiaon-office-vertrieb.ts): memoisiert, und das
// ALTER läuft mit lock_timeout, damit es hinter einer langen Transaktion nicht
// alle Abfragen auf fiaon_agents in die Warteschlange zwingt. Die Spalte wird
// NUR angelegt — Werte setzt Justin von Hand (bewusst keine Migration).
let chefBereit: Promise<void> | null = null;
function ensureChefSchema(): Promise<void> {
  if (!chefBereit) {
    chefBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS admin_stufe VARCHAR`;
      });
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_admin_log (
          id BIGSERIAL PRIMARY KEY,
          agent_id INTEGER,
          stufe VARCHAR,
          methode VARCHAR,
          pfad TEXT,
          ziel TEXT,
          notiz TEXT,
          zeit TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_admin_log_zeit_idx ON fiaon_admin_log (zeit DESC)`;
    })().catch((e) => { chefBereit = null; throw e; });
  }
  return chefBereit;
}

// ── Protokoll ───────────────────────────────────────────────────────────────
async function protokollSchreiben(
  agentId: number | null, stufe: string | null, methode: string, pfad: string,
  ziel: string | null, notiz: string | null,
): Promise<void> {
  try {
    await ensureChefSchema();
    await sqlPool`
      INSERT INTO fiaon_admin_log (agent_id, stufe, methode, pfad, ziel, notiz)
      VALUES (${agentId}, ${stufe}, ${methode}, ${pfad}, ${ziel}, ${notiz})`;
  } catch (err) {
    // Ein Protokoll, das Anfragen kippt, wäre schlimmer als keins.
    console.warn("[CHEF-ZUGANG] Protokoll fehlgeschlagen:", err);
  }
}

/** Pfad ohne Query — Suchbegriffe/Filter gehören nicht ins Protokoll. */
function reinerPfad(req: Request): string {
  return String((req as any).originalUrl || req.path || "").split("?")[0];
}

export interface ChefRequest extends Request {
  chef?: { agentId: number | null; stufe: ChefStufe; quelle: "chef" | "alt" };
}

/**
 * Für Routen, die Ziel und Notiz genauer benennen wollen als der Automatik-
 * Eintrag von requireChef (z. B. ziel "person:4711", notiz "vorher→nachher").
 * Feuert und vergisst — der Aufrufer muss nicht warten.
 */
export function chefProtokoll(req: Request, ziel: string, notiz?: string): Promise<void> {
  const chef = (req as ChefRequest).chef ?? readChef(req);
  const stufe = chef?.stufe ?? (hasAdminCode(req) ? "inhaber" : null);
  return protokollSchreiben(chef && "agentId" in chef ? chef.agentId : null, stufe, req.method, reinerPfad(req), ziel, notiz ?? null);
}

/**
 * requireChef('leitung' | 'geschaeftsfuehrung' | 'inhaber') — die Wand vor
 * künftigen Chefbüro-Routen. Akzeptiert das neue fiaon_chef-Cookie ODER
 * (Übergang) das alte fiaon_admin-Cookie als 'inhaber' ohne Personenbezug.
 * NICHT-GET-Anfragen landen automatisch im fiaon_admin_log.
 */
export function requireChef(mindestStufe: ChefStufe = "leitung") {
  return (req: ChefRequest, res: Response, next: NextFunction) => {
    const c = readChef(req);
    const chef: ChefRequest["chef"] = c
      ? { agentId: c.agentId, stufe: c.stufe, quelle: "chef" }
      : hasAdminCode(req)
        ? { agentId: null, stufe: "inhaber", quelle: "alt" }
        : undefined;
    if (!chef) {
      return res.status(401).json({ ok: false, code: "CHEF_ANMELDUNG_ERFORDERLICH", error: "Bitte im Chefbüro anmelden." });
    }
    if (RANG[chef.stufe] < RANG[mindestStufe]) {
      return res.status(403).json({ ok: false, code: "STUFE_ZU_NIEDRIG", error: "Dafür reicht deine Stufe nicht.", stufe: chef.stufe, noetig: mindestStufe });
    }
    req.chef = chef;
    if (req.method !== "GET") {
      void protokollSchreiben(chef.agentId, chef.stufe, req.method, reinerPfad(req), null, chef.quelle === "alt" ? "altes Admin-Cookie" : null);
    }
    next();
  };
}

// ── Fehlversuche bremsen (Muster fiaon-admin-zugang.ts, hier je IP+E-Mail) ──
type Attempt = { fails: number; lockedUntil: number };
const attempts = new Map<string, Attempt>();
const FREE_TRIES = 5;

function clientKey(req: Request, email: string): string {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${fwd || req.ip || "unbekannt"}|${email}`;
}

function lockMs(fails: number): number {
  if (fails <= FREE_TRIES) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (fails - FREE_TRIES - 1));
}

function fehlversuch(key: string): number {
  const a = attempts.get(key) || { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  const sperre = lockMs(a.fails);
  a.lockedUntil = sperre > 0 ? Date.now() + sperre : 0;
  attempts.set(key, a);
  return sperre;
}

// ── Router (mount: /api/fiaon — Pfade beginnen bewusst NICHT mit /admin,
//    sonst würden blockAgentsFromAdmin/adminCodeGate die eigene Tür zumauern) ─
const router = Router();

/**
 * POST /chef/anmelden { email, passwort, code? }
 * Der Code wird erst verlangt, wenn E-Mail+Passwort stimmen UND die Stufe
 * 'inhaber' ist — die Oberfläche blendet das Feld dann nach (CODE_NOETIG).
 * Für 'geschaeftsfuehrung' und 'leitung' genügt E-Mail+Passwort.
 */
router.post("/chef/anmelden", async (req: Request, res: Response) => {
  try {
    await ensureChefSchema();
    const email = String((req.body as any)?.email || "").trim().toLowerCase();
    const passwort = String((req.body as any)?.passwort || "");
    const code = String((req.body as any)?.code ?? "").replace(/\D/g, "");
    if (!email || !passwort) {
      return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich." });
    }

    const key = clientKey(req, email);
    const gesperrt = attempts.get(key);
    const warten = gesperrt ? Math.max(0, gesperrt.lockedUntil - Date.now()) : 0;
    if (warten > 0) {
      return res.status(429).json({ ok: false, code: "TOO_MANY", wartezeitMs: warten, error: `Zu viele Fehlversuche. Bitte ${Math.ceil(warten / 1000)} Sekunden warten.` });
    }

    const rows = (await sqlPool`SELECT id, name, email, active, password_hash, admin_stufe FROM fiaon_agents WHERE LOWER(email) = ${email}`) as any[];
    const row = rows.length === 1 ? rows[0] : null;
    // Passwort ZUERST — wer das Passwort nicht kennt, erfährt auch nicht,
    // ob hinter der Adresse ein Admin-Konto steckt. Bewusst AUCH inaktive
    // Konten zulassen, WENN admin_stufe gesetzt ist: der Office-Umbau (E-038)
    // deaktiviert Mitarbeiter — Justin/Florentine dürfen trotzdem hinein.
    if (!row || !row.password_hash || !(await bcrypt.compare(passwort, row.password_hash))) {
      const sperre = fehlversuch(key);
      console.warn(`[CHEF-ZUGANG] Fehlversuch (Passwort) für ${email}`);
      return res.status(401).json({ ok: false, code: "ANMELDUNG_UNGUELTIG", wartezeitMs: sperre, error: "Anmeldedaten ungültig." });
    }
    const stufe = String(row.admin_stufe || "").trim() as ChefStufe;
    if (!STUFEN.includes(stufe)) {
      // Richtiges Passwort, aber kein Admin — ehrlich sagen, nicht raten lassen.
      return res.status(403).json({ ok: false, code: "KEIN_CHEF_ZUGANG", error: "Für dieses Konto ist kein Chef-Zugang eingerichtet." });
    }
    if (!row.active && !row.admin_stufe) {
      return res.status(403).json({ ok: false, code: "KEIN_CHEF_ZUGANG", error: "Zugang deaktiviert." });
    }
    if (stufe === "inhaber") {
      if (!code) {
        // Kein Fehlversuch: Die Oberfläche fragt jetzt erst nach dem Code.
        return res.status(428).json({ ok: false, code: "CODE_NOETIG", error: "Für den Inhaber-Zugang ist zusätzlich der Chef-Code nötig." });
      }
      if (!equalStr(code, chefCode())) {
        const sperre = fehlversuch(key);
        console.warn(`[CHEF-ZUGANG] Fehlversuch (Code) für ${email}`);
        return res.status(401).json({ ok: false, code: "CODE_FALSCH", wartezeitMs: sperre, error: "Chef-Code falsch." });
      }
    }

    attempts.delete(key);
    res.cookie(COOKIE, issueToken(Number(row.id), stufe), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TTL_MS,
      path: "/",
    });
    void protokollSchreiben(Number(row.id), stufe, "ANMELDUNG", "/chef/anmelden", `agent:${row.id}`, `Stufe ${stufe}`);
    console.log(`[CHEF-ZUGANG] Anmeldung: ${row.name} (${row.email}) als ${stufe}`);
    return res.json({ ok: true, angemeldet: true, stufe, name: String(row.name || "") });
  } catch (err) {
    console.error("[CHEF-ZUGANG] anmelden:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /chef/status — was die Oberfläche wissen muss: Bin ich drin? Als wer?
 * `quelle: "alt"` heißt: nur das alte fiaon_admin-Cookie (Übergang, zählt als
 * Inhaber ohne Personenbezug). `codeNurFuerInhaber` sagt der Anmeldemaske,
 * dass das Code-Feld erst gezeigt wird, wenn der Server es verlangt.
 */
router.get("/chef/status", async (req: Request, res: Response) => {
  const c = readChef(req);
  if (c) {
    let name: string | null = null;
    try {
      const rows = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${c.agentId}`) as any[];
      name = rows[0]?.name ?? null;
    } catch { /* Anzeige-Zucker — Status bleibt gültig auch ohne Namen */ }
    return res.json({ ok: true, angemeldet: true, stufe: c.stufe, agentId: c.agentId, name, quelle: "chef" });
  }
  if (hasAdminCode(req)) {
    return res.json({ ok: true, angemeldet: true, stufe: "inhaber", agentId: null, name: null, quelle: "alt" });
  }
  return res.json({ ok: true, angemeldet: false, codeNurFuerInhaber: true });
});

/**
 * POST /chef/abmelden — beide Türen schließen. Wer sich abmeldet, will WEG:
 * Bliebe das alte fiaon_admin-Cookie stehen, wäre man sofort wieder
 * „inhaber“ (Lehre aus /agent/logout, 11.08.2026).
 */
router.post("/chef/abmelden", (req: Request, res: Response) => {
  const c = readChef(req);
  if (c) void protokollSchreiben(c.agentId, c.stufe, "ABMELDUNG", "/chef/abmelden", `agent:${c.agentId}`, null);
  res.clearCookie(COOKIE, { path: "/" });
  res.clearCookie("fiaon_admin", { path: "/" });
  res.json({ ok: true, angemeldet: false });
});

export default router;
