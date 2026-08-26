// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM — Schwarzott Capital Partners AG (26.08.2026)
//
// Gebaut im Auftrag der Schwarzott Capital Partners AG, Zürich. FIAON stellt
// die Technik; Inhalt, Dokumente und Zeichnungsvorgang verantwortet SCP.
//
// ── WARUM EIN EIGENER WEG UND NICHT /datenraum ────────────────────────────
// Unter /datenraum liegt FIAONS eigener Investorenbereich. Zwei Gesellschaften
// in einem Raum hiessen: ein Fehler in der Zugriffsprüfung, und ein SCP-Gast
// sieht FIAON-Unterlagen. Getrennte Tabellen, getrennte Route, getrennte
// Sitzung — die Trennung ist hier keine Ordnungsfrage, sondern die Sicherheit
// selbst.
//
// ── WIE DER ZUGANG FUNKTIONIERT ───────────────────────────────────────────
// Kein Passwort, sondern eine Anmeldung mit Namen, Firma, E-Mail und Telefon
// plus einem Einladungscode. Wer sich anmeldet, bekommt ein signiertes
// Sitzungs-Plätzchen. Das ist bewusst niedrigschwellig: Ein Datenraum, der
// Investoren an einer Passwortvergabe scheitern lässt, wird nicht benutzt.
// Die Beweiskraft entsteht nicht aus dem Login, sondern aus dem Protokoll —
// jede Anmeldung, jede Ansicht und jede Unterschrift mit Zeitpunkt und IP.
//
// ── WAS DIESER RAUM NICHT TUT ─────────────────────────────────────────────
// Er erzeugt keine qualifizierte elektronische Signatur (ZertES/eIDAS). Für
// Zeichnungsscheine, die eine bestimmte Form verlangen, ist die einfache
// elektronische Signatur unter Umständen nicht ausreichend. Diese Prüfung
// obliegt SCP und ihren Berufsträgern; die Oberfläche sagt es dem
// Unterzeichnenden ausdrücklich.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sqlPool } from "../lib/db-pool";

const router = Router();

const COOKIE = "scp_datenraum";
const TAGE = 7;

/** Der Einladungscode. Sperre, kein Identitätsnachweis. */
const EINLADUNG = "SCP2026";

function geheimnis(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
}

function tokenBauen(gastId: number): string {
  const bis = Date.now() + TAGE * 24 * 3600_000;
  const kern = `${gastId}.${bis}`;
  const sig = createHmac("sha256", geheimnis()).update(`scp1:${kern}`).digest("hex").slice(0, 40);
  return `${kern}.${sig}`;
}

function tokenPruefen(token: string | undefined): number | null {
  if (!token) return null;
  const t = String(token).split(".");
  if (t.length !== 3) return null;
  const [id, bis, sig] = t;
  const soll = createHmac("sha256", geheimnis()).update(`scp1:${id}.${bis}`).digest("hex").slice(0, 40);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(soll))) return null;
  } catch { return null; }
  if (Number(bis) < Date.now()) return null;
  return Number(id);
}

const ipVon = (req: Request) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "";

export async function ensureScpTabellen(): Promise<void> {
  await sqlPool.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '5s'`;
    await tx`
      CREATE TABLE IF NOT EXISTS scp_gaeste (
        id           BIGSERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        firma        TEXT,
        email        TEXT NOT NULL,
        telefon      TEXT NOT NULL,
        erste_ip     TEXT,
        erste_ua     TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        zuletzt_am   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`CREATE UNIQUE INDEX IF NOT EXISTS scp_gaeste_email ON scp_gaeste (lower(email))`;
    await tx`
      CREATE TABLE IF NOT EXISTS scp_zeichnungen (
        id               BIGSERIAL PRIMARY KEY,
        gast_id          BIGINT NOT NULL REFERENCES scp_gaeste(id),
        dokument         TEXT NOT NULL,
        anmerkungen      TEXT,
        betrag_chf       NUMERIC(14,2),
        unterschrift     TEXT,
        unterzeichnet_am TIMESTAMPTZ,
        ip               TEXT,
        ua               TEXT,
        pruefsumme       TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`CREATE UNIQUE INDEX IF NOT EXISTS scp_zeichnung_je_gast
             ON scp_zeichnungen (gast_id, dokument)`;
    await tx`
      CREATE TABLE IF NOT EXISTS scp_protokoll (
        id         BIGSERIAL PRIMARY KEY,
        gast_id    BIGINT,
        art        TEXT NOT NULL,
        detail     TEXT,
        ip         TEXT,
        ua         TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`CREATE INDEX IF NOT EXISTS scp_protokoll_zeit ON scp_protokoll (ip, created_at DESC)`;
  });
}

async function protokoll(gastId: number | null, art: string, detail: string | null, req: Request): Promise<void> {
  await sqlPool`
    INSERT INTO scp_protokoll (gast_id, art, detail, ip, ua)
    VALUES (${gastId}, ${art}, ${detail}, ${ipVon(req)},
            ${String(req.headers["user-agent"] || "").slice(0, 300)})
  `.catch(() => {});
}

/** Fünf Fehlversuche je IP in zehn Minuten. */
async function zuVieleVersuche(req: Request): Promise<boolean> {
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM scp_protokoll
     WHERE art = 'code_falsch' AND ip = ${ipVon(req)}
       AND created_at > NOW() - INTERVAL '10 minutes'`) as any[];
  return Number(z?.n ?? 0) >= 5;
}

// ── Anmelden ───────────────────────────────────────────────────────────────
router.post("/scp/anmelden", async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    if (await zuVieleVersuche(req)) {
      return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte in zehn Minuten erneut probieren." });
    }
    const code = String(req.body?.code ?? "").trim().toUpperCase();
    if (code !== EINLADUNG) {
      await protokoll(null, "code_falsch", null, req);
      return res.status(403).json({ ok: false, error: "Der Einladungscode stimmt nicht." });
    }

    const name = String(req.body?.name ?? "").trim();
    const firma = String(req.body?.firma ?? "").trim() || null;
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const telefon = String(req.body?.telefon ?? "").trim();

    if (name.length < 4 || !name.includes(" ")) {
      return res.status(400).json({ ok: false, error: "Bitte den vollständigen Vor- und Nachnamen angeben." });
    }
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben." });
    }
    if (telefon.replace(/[^0-9]/g, "").length < 8) {
      return res.status(400).json({ ok: false, error: "Bitte eine erreichbare Telefonnummer angeben." });
    }

    const [gast] = (await sqlPool`
      INSERT INTO scp_gaeste (name, firma, email, telefon, erste_ip, erste_ua)
      VALUES (${name}, ${firma}, ${email}, ${telefon}, ${ipVon(req)},
              ${String(req.headers["user-agent"] || "").slice(0, 300)})
      ON CONFLICT (lower(email)) DO UPDATE
        SET name = EXCLUDED.name, firma = EXCLUDED.firma,
            telefon = EXCLUDED.telefon, zuletzt_am = NOW()
      RETURNING id, name, firma, email, telefon`) as any[];

    res.cookie(COOKIE, tokenBauen(Number(gast.id)), {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: TAGE * 24 * 3600_000,
    });
    await protokoll(Number(gast.id), "angemeldet", email, req);
    res.json({ ok: true, gast: { name: gast.name, firma: gast.firma, email: gast.email, telefon: gast.telefon } });
  } catch (err) {
    console.error("[SCP] anmelden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stand: wer bin ich, was habe ich gezeichnet ────────────────────────────
router.get("/scp/stand", async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    const gastId = tokenPruefen((req as any).cookies?.[COOKIE]);
    if (!gastId) return res.json({ ok: true, angemeldet: false });
    const [gast] = (await sqlPool`SELECT id, name, firma, email, telefon FROM scp_gaeste WHERE id = ${gastId}`) as any[];
    if (!gast) return res.json({ ok: true, angemeldet: false });
    const zeichnungen = (await sqlPool`
      SELECT dokument, anmerkungen, betrag_chf, unterschrift, unterzeichnet_am
        FROM scp_zeichnungen WHERE gast_id = ${gastId}`) as any[];
    res.json({
      ok: true, angemeldet: true,
      gast: { name: gast.name, firma: gast.firma, email: gast.email, telefon: gast.telefon },
      zeichnungen: zeichnungen.map((z) => ({
        dokument: z.dokument, anmerkungen: z.anmerkungen, betragChf: z.betrag_chf,
        unterschrift: z.unterschrift, unterzeichnetAm: z.unterzeichnet_am,
      })),
    });
  } catch (err) {
    console.error("[SCP] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Anmerkungen zwischenspeichern ──────────────────────────────────────────
router.post("/scp/anmerkungen", async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    const gastId = tokenPruefen((req as any).cookies?.[COOKIE]);
    if (!gastId) return res.status(401).json({ ok: false, error: "Bitte erneut anmelden." });
    const dokument = String(req.body?.dokument ?? "").trim() || "zeichnungsschein";
    const [da] = (await sqlPool`
      SELECT unterzeichnet_am FROM scp_zeichnungen WHERE gast_id = ${gastId} AND dokument = ${dokument}`) as any[];
    if (da?.unterzeichnet_am) {
      return res.status(409).json({ ok: false, error: "Bereits unterzeichnet — der Inhalt ist festgeschrieben." });
    }
    const betrag = req.body?.betragChf != null && String(req.body.betragChf).trim() !== ""
      ? Number(String(req.body.betragChf).replace(/[^0-9.]/g, "")) : null;
    await sqlPool`
      INSERT INTO scp_zeichnungen (gast_id, dokument, anmerkungen, betrag_chf)
      VALUES (${gastId}, ${dokument}, ${String(req.body?.anmerkungen ?? "").slice(0, 8000)},
              ${Number.isFinite(betrag as number) ? betrag : null})
      ON CONFLICT (gast_id, dokument) DO UPDATE
        SET anmerkungen = EXCLUDED.anmerkungen, betrag_chf = EXCLUDED.betrag_chf, updated_at = NOW()`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[SCP] anmerkungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Unterzeichnen ──────────────────────────────────────────────────────────
router.post("/scp/unterzeichnen", async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    const gastId = tokenPruefen((req as any).cookies?.[COOKIE]);
    if (!gastId) return res.status(401).json({ ok: false, error: "Bitte erneut anmelden." });

    const [gast] = (await sqlPool`SELECT name, firma, email FROM scp_gaeste WHERE id = ${gastId}`) as any[];
    if (!gast) return res.status(401).json({ ok: false, error: "Bitte erneut anmelden." });

    const dokument = String(req.body?.dokument ?? "").trim() || "zeichnungsschein";
    const name = String(req.body?.unterschrift ?? "").trim();
    if (name.length < 4 || !name.includes(" ")) {
      return res.status(400).json({ ok: false, error: "Bitte den vollständigen Namen als Unterschrift eintragen." });
    }
    if (req.body?.gelesen !== true) {
      return res.status(400).json({ ok: false, error: "Bitte bestätigen, dass die Unterlagen gelesen wurden." });
    }
    if (req.body?.risiko !== true) {
      return res.status(400).json({ ok: false, error: "Bitte die Kenntnisnahme der Risikohinweise bestätigen." });
    }

    const [da] = (await sqlPool`
      SELECT unterzeichnet_am FROM scp_zeichnungen WHERE gast_id = ${gastId} AND dokument = ${dokument}`) as any[];
    if (da?.unterzeichnet_am) {
      return res.status(409).json({ ok: false, error: "Diese Zeichnung wurde bereits unterzeichnet." });
    }

    const anmerkungen = String(req.body?.anmerkungen ?? "").slice(0, 8000);
    const betrag = req.body?.betragChf != null && String(req.body.betragChf).trim() !== ""
      ? Number(String(req.body.betragChf).replace(/[^0-9.]/g, "")) : null;
    // Die Pruefsumme friert ein, WORUEBER unterschrieben wurde.
    const pruefsumme = createHash("sha256")
      .update(JSON.stringify({ dokument, gast: gast.email, anmerkungen, betrag }))
      .digest("hex");

    await sqlPool`
      INSERT INTO scp_zeichnungen (gast_id, dokument, anmerkungen, betrag_chf,
                                   unterschrift, unterzeichnet_am, ip, ua, pruefsumme)
      VALUES (${gastId}, ${dokument}, ${anmerkungen},
              ${Number.isFinite(betrag as number) ? betrag : null},
              ${name}, NOW(), ${ipVon(req)},
              ${String(req.headers["user-agent"] || "").slice(0, 300)}, ${pruefsumme})
      ON CONFLICT (gast_id, dokument) DO UPDATE
        SET anmerkungen = EXCLUDED.anmerkungen, betrag_chf = EXCLUDED.betrag_chf,
            unterschrift = EXCLUDED.unterschrift, unterzeichnet_am = NOW(),
            ip = EXCLUDED.ip, ua = EXCLUDED.ua, pruefsumme = EXCLUDED.pruefsumme,
            updated_at = NOW()
      WHERE scp_zeichnungen.unterzeichnet_am IS NULL`;

    await protokoll(gastId, "unterzeichnet", dokument, req);
    const [neu] = (await sqlPool`
      SELECT unterzeichnet_am FROM scp_zeichnungen WHERE gast_id = ${gastId} AND dokument = ${dokument}`) as any[];
    res.json({ ok: true, unterzeichnetAm: neu?.unterzeichnet_am ?? null, pruefsumme: pruefsumme.slice(0, 16) });
  } catch (err) {
    console.error("[SCP] unterzeichnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Abmelden ───────────────────────────────────────────────────────────────
router.post("/scp/abmelden", async (req: Request, res: Response) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
