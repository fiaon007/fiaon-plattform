// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPERRTE VEREINBARUNGS-SEITE (26.08.2026)
//
// Justin: „Erstelle dafür eine eigene gesperrte Seite (mit einem Code um zu
// entsperren, der Code soll 26082026 sein). Auf der Seite soll er seine
// fehlenden Daten eintippen, Anmerkungen schreiben und direkt unterzeichnen
// können."
//
// ── WARUM EIN EIGENER WEG UND NICHT DER KUNDENBEREICH ─────────────────────
// Ein Vertrag ist kein Kundenvorgang. Er hat einen anderen Empfänger, eine
// andere Rechtsnatur und eine andere Aufbewahrungspflicht. Er in die
// Kundentabellen zu legen hieße, ihn in jede Kundenliste einzuschleusen.
//
// ── WAS DER CODE IST UND WAS NICHT ────────────────────────────────────────
// Der Code ist eine SPERRE, kein Nachweis der Identität. Er hält zufällige
// Aufrufe fern; wer unterschreibt, bestätigt seine Identität durch Name,
// Anschrift und Geburtsdatum, die er selbst einträgt, zusammen mit
// Zeitpunkt und IP-Adresse. Das ist eine einfache elektronische Signatur
// (Art. 3 Nr. 10 eIDAS) — für eine Zusatzvereinbarung unter Kaufleuten
// üblich und ausreichend, solange die Umstände protokolliert sind. Genau
// das passiert hier.
//
// ── DIE ZWEI SCHUTZREGELN ─────────────────────────────────────────────────
// 1. Bremse: Fünf Fehlversuche je IP in zehn Minuten, dann Pause. Ein
//    achtstelliger Zahlencode ist sonst in Minuten durchprobiert.
// 2. Einmal unterschrieben, ist der Text eingefroren. Ein Vertrag, dessen
//    Inhalt sich nach der Unterschrift noch ändern lässt, ist keiner.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { sqlPool } from "../lib/db-pool";

const router = Router();

/** Der Sperrcode. Bewusst KEIN Geheimnis im Sinne eines Passworts. */
const CODE = "26082026";

/** Die eine Vereinbarung, die es derzeit gibt. */
const SCHLUESSEL = "ZV-2026-013";

export async function ensureVereinbarungTabellen(): Promise<void> {
  await sqlPool.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '5s'`;
    await tx`
      CREATE TABLE IF NOT EXISTS fiaon_vereinbarungen (
        schluessel        TEXT PRIMARY KEY,
        agent_id          INTEGER,
        titel             TEXT NOT NULL,
        angaben           JSONB NOT NULL DEFAULT '{}'::jsonb,
        anmerkungen       TEXT,
        variante          TEXT,
        unterschrift_name TEXT,
        unterzeichnet_am  TIMESTAMPTZ,
        unterzeichner_ip  TEXT,
        unterzeichner_ua  TEXT,
        text_pruefsumme   TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`
      CREATE TABLE IF NOT EXISTS fiaon_vereinbarung_zugriffe (
        id          BIGSERIAL PRIMARY KEY,
        schluessel  TEXT NOT NULL,
        art         TEXT NOT NULL,
        ip          TEXT,
        ua          TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx`CREATE INDEX IF NOT EXISTS fiaon_vereinbarung_zugriffe_zeit
             ON fiaon_vereinbarung_zugriffe (ip, created_at DESC)`;
    await tx`
      INSERT INTO fiaon_vereinbarungen (schluessel, agent_id, titel)
      VALUES (${SCHLUESSEL}, 13, 'Zusatzvereinbarung zum Vertriebspartnervertrag')
      ON CONFLICT (schluessel) DO NOTHING`;
  });
}

const ipVon = (req: Request) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "";

async function protokoll(art: string, req: Request): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_vereinbarung_zugriffe (schluessel, art, ip, ua)
    VALUES (${SCHLUESSEL}, ${art}, ${ipVon(req)}, ${String(req.headers["user-agent"] || "").slice(0, 300)})
  `.catch(() => {});
}

/** Fünf Fehlversuche je IP in zehn Minuten — dann Pause. */
async function zuVieleVersuche(req: Request): Promise<boolean> {
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vereinbarung_zugriffe
     WHERE art = 'code_falsch' AND ip = ${ipVon(req)}
       AND created_at > NOW() - INTERVAL '10 minutes'`) as any[];
  return Number(z?.n ?? 0) >= 5;
}

// ── Aufsperren ─────────────────────────────────────────────────────────────
router.post("/vereinbarung/entsperren", async (req: Request, res: Response) => {
  try {
    await ensureVereinbarungTabellen();
    if (await zuVieleVersuche(req)) {
      return res.status(429).json({ ok: false, error: "Zu viele Versuche. Bitte in zehn Minuten erneut probieren." });
    }
    const code = String(req.body?.code ?? "").replace(/\s+/g, "");
    if (code !== CODE) {
      await protokoll("code_falsch", req);
      return res.status(403).json({ ok: false, error: "Der Code stimmt nicht." });
    }
    await protokoll("geoeffnet", req);
    const [v] = (await sqlPool`SELECT * FROM fiaon_vereinbarungen WHERE schluessel = ${SCHLUESSEL}`) as any[];
    res.json({
      ok: true,
      vereinbarung: {
        titel: v?.titel ?? "",
        angaben: v?.angaben ?? {},
        anmerkungen: v?.anmerkungen ?? "",
        variante: v?.variante ?? null,
        unterzeichnetAm: v?.unterzeichnet_am ?? null,
        unterschriftName: v?.unterschrift_name ?? null,
      },
    });
  } catch (err) {
    console.error("[VEREINBARUNG] entsperren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zwischenspeichern — solange nicht unterschrieben ist. */
router.post("/vereinbarung/speichern", async (req: Request, res: Response) => {
  try {
    await ensureVereinbarungTabellen();
    if (String(req.body?.code ?? "").replace(/\s+/g, "") !== CODE) {
      return res.status(403).json({ ok: false, error: "Der Code stimmt nicht." });
    }
    const [v] = (await sqlPool`SELECT unterzeichnet_am FROM fiaon_vereinbarungen WHERE schluessel = ${SCHLUESSEL}`) as any[];
    if (v?.unterzeichnet_am) {
      return res.status(409).json({ ok: false, error: "Die Vereinbarung ist bereits unterzeichnet und lässt sich nicht mehr ändern." });
    }
    const angaben = (req.body?.angaben && typeof req.body.angaben === "object") ? req.body.angaben : {};
    await sqlPool`
      UPDATE fiaon_vereinbarungen
         SET angaben = ${JSON.stringify(angaben)}::jsonb,
             anmerkungen = ${String(req.body?.anmerkungen ?? "").slice(0, 8000)},
             variante = ${req.body?.variante ? String(req.body.variante) : null},
             updated_at = NOW()
       WHERE schluessel = ${SCHLUESSEL}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[VEREINBARUNG] speichern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Unterzeichnen — einmalig, mit Protokoll. */
router.post("/vereinbarung/unterzeichnen", async (req: Request, res: Response) => {
  try {
    await ensureVereinbarungTabellen();
    if (String(req.body?.code ?? "").replace(/\s+/g, "") !== CODE) {
      return res.status(403).json({ ok: false, error: "Der Code stimmt nicht." });
    }
    const name = String(req.body?.unterschriftName ?? "").trim();
    if (name.length < 4 || !name.includes(" ")) {
      return res.status(400).json({ ok: false, error: "Bitte den vollständigen Namen als Unterschrift eintragen." });
    }
    const angaben = (req.body?.angaben && typeof req.body.angaben === "object") ? req.body.angaben : {};
    // Ohne diese Angaben ist die Vereinbarung nicht wirksam abschliessbar.
    const pflicht: [string, string][] = [
      ["legalName", "Vollständiger Name laut Ausweis"],
      ["geburtsdatum", "Geburtsdatum"],
      ["strasse", "Straße und Hausnummer"],
      ["plz", "Postleitzahl"],
      ["ort", "Ort"],
      ["land", "Land"],
      ["steuerId", "Steuerliche Identifikationsnummer"],
      ["iban", "Vollständige IBAN"],
      ["kontoinhaber", "Kontoinhaber"],
    ];
    const fehlend = pflicht.filter(([k]) => !String((angaben as any)[k] ?? "").trim()).map(([, l]) => l);
    if (fehlend.length) {
      return res.status(400).json({ ok: false, error: `Es fehlen noch: ${fehlend.join(", ")}.`, fehlend });
    }
    if (!req.body?.variante) {
      return res.status(400).json({ ok: false, error: "Bitte in § 3 Absatz 3 eine Variante wählen." });
    }
    if (req.body?.gelesen !== true) {
      return res.status(400).json({ ok: false, error: "Bitte bestätigen, dass die Vereinbarung gelesen wurde." });
    }

    const [v] = (await sqlPool`SELECT unterzeichnet_am FROM fiaon_vereinbarungen WHERE schluessel = ${SCHLUESSEL}`) as any[];
    if (v?.unterzeichnet_am) {
      return res.status(409).json({ ok: false, error: "Diese Vereinbarung wurde bereits unterzeichnet." });
    }

    // Die Pruefsumme friert ein, WORUEBER unterschrieben wurde: Angaben,
    // Anmerkungen und die gewaehlte Variante. Aendert jemand spaeter etwas in
    // der Datenbank, passt sie nicht mehr — und das faellt auf.
    const anmerkungen = String(req.body?.anmerkungen ?? "").slice(0, 8000);
    const pruefsumme = createHash("sha256")
      .update(JSON.stringify({ s: SCHLUESSEL, angaben, anmerkungen, variante: String(req.body.variante) }))
      .digest("hex");

    await sqlPool`
      UPDATE fiaon_vereinbarungen
         SET angaben = ${JSON.stringify(angaben)}::jsonb,
             anmerkungen = ${anmerkungen},
             variante = ${String(req.body.variante)},
             unterschrift_name = ${name},
             unterzeichnet_am = NOW(),
             unterzeichner_ip = ${ipVon(req)},
             unterzeichner_ua = ${String(req.headers["user-agent"] || "").slice(0, 300)},
             text_pruefsumme = ${pruefsumme},
             updated_at = NOW()
       WHERE schluessel = ${SCHLUESSEL} AND unterzeichnet_am IS NULL`;
    await protokoll("unterzeichnet", req);

    const [neu] = (await sqlPool`SELECT unterzeichnet_am FROM fiaon_vereinbarungen WHERE schluessel = ${SCHLUESSEL}`) as any[];
    res.json({ ok: true, unterzeichnetAm: neu?.unterzeichnet_am ?? null, pruefsumme: pruefsumme.slice(0, 16) });
  } catch (err) {
    console.error("[VEREINBARUNG] unterzeichnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
