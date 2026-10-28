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
import { requireChef } from "./fiaon-chef-zugang";

const router = Router();

const COOKIE = "scp_datenraum";
const TAGE = 7;

// ═══════════════════════════════════════════════════════════════════════════
// VIER PARTEIEN, VIER CODES (26.08.2026)
//
// Der Vertrag hat vier Unterschriftsfelder: drei Erwerber und den Veräußerer.
// Ein gemeinsamer Code für alle hieße: Wer eintritt, könnte für jeden
// unterschreiben. Die Rolle muss deshalb AM CODE hängen, nicht an einer
// Auswahl in der Oberfläche — sonst ist die Unterschrift wertlos.
//
// Die Angaben stammen aus dem Vertrag selbst (§ 2 und Unterschriftenseiten),
// nicht aus einer Eingabe: Wer eintritt, findet seine Partei vor und kann sie
// nicht ändern.
// ═══════════════════════════════════════════════════════════════════════════
export interface Partei {
  rolle: string;
  bezeichnung: string;
  name: string;
  sitz: string;
  register: string | null;
  vertretung: string | null;
  quote: string | null;
  gesamtanteil: string | null;
}

// ── NEUE CODES AM 04.09.2026 (Justin: „Setze alle Unterschriften zurück und
// für jeden die neuen Zugangsdaten") ──────────────────────────────────────
// Die ersten Codes hießen SWP-E1-2026 … SWP-V-2026. Wer einen davon kannte,
// konnte die anderen drei erraten — das Muster war die ganze Information.
// Bei vier Codes und einem Vertrag über 14 Mio EUR ist das zu wenig, auch mit
// der Versuchsbremse davor. Die neuen tragen einen Zufallsteil aus einem
// Alphabet ohne verwechselbare Zeichen (kein I, L, O, 0, 1), weil sie am
// Telefon durchgegeben und abgetippt werden.
// ── DIE VERTRAGSANGABEN STEHEN IN DER DATENBANK (E-447, 28.10.2026) ───────
// Bis heute standen Namen, Anschriften, Geburtsdatum des Veräußerers und die
// Kaufpreis-Anteile fest in diesem Modul und in der Seite selbst. Das Repo ist
// öffentlich, und alles unter client/src geht an jeden Besucher — auch an den,
// der nie einen Code hatte. Jetzt hängt am Code nur noch die ROLLE; alles,
// was der Vertrag über die Parteien sagt, liegt in scp_dokumente.angaben und
// wird erst nach der Anmeldung ausgeliefert. Geburtsdatum und Privatanschrift
// zeigt die Oberfläche gar nicht mehr — sie stehen im PDF.
export const PARTEIEN: Record<string, { rolle: string; bezeichnung: string }> = {
  "SCP-E1-DNK8K7": { rolle: "erwerber1", bezeichnung: "Erwerber zu 1" },
  "SCP-E2-5K4HD3": { rolle: "erwerber2", bezeichnung: "Erwerber zu 2" },
  "SCP-E3-NMXWR3": { rolle: "erwerber3", bezeichnung: "Erwerber zu 3" },
  "SCP-V-7PCGHZ": { rolle: "veraeusserer", bezeichnung: "Veräußerer" },
};

/** Was zu einer Partei in den Vertragsangaben steht (scp_dokumente.angaben.parteien). */
type ParteiAngaben = Partial<Omit<Partei, "rolle" | "bezeichnung">> & { quoteKurz?: string | null };

const DOKUMENT_ANGABEN = "anteilskaufvertrag";

async function vertragsAngaben(): Promise<Record<string, any> | null> {
  const [d] = (await sqlPool`
    SELECT angaben FROM scp_dokumente WHERE schluessel = ${DOKUMENT_ANGABEN}`.catch(() => [])) as any[];
  let a = d?.angaben;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = null; } }
  return a && typeof a === "object" && !Array.isArray(a) ? a : null;
}

/** Die Partei einer Rolle — Bezeichnung aus dem Code, alles Weitere aus der Datenbank. */
function parteiMitAngaben(rolle: string, angaben: Record<string, any> | null): Partei | null {
  const p = Object.values(PARTEIEN).find((x) => x.rolle === rolle);
  if (!p) return null;
  const a: ParteiAngaben = angaben?.parteien?.[rolle] ?? {};
  return {
    rolle: p.rolle, bezeichnung: p.bezeichnung,
    name: a.name ?? p.bezeichnung, sitz: a.sitz ?? "",
    register: a.register ?? null, vertretung: a.vertretung ?? null,
    quote: a.quote ?? null, gesamtanteil: a.gesamtanteil ?? null,
  };
}

/**
 * Der Vertrag, wie ihn ein angemeldeter Gast sieht: die Angaben ohne die
 * Parteien-Rohdaten, dazu die Reihe der vier Unterschriftsfelder.
 * Ohne hinterlegte Angaben bleibt `angaben` null — die Seite verweist dann aufs PDF.
 */
function vertragFuerGast(angaben: Record<string, any> | null) {
  const { parteien: _p, ...rest } = angaben ?? {};
  return {
    angaben: angaben ? rest : null,
    reihe: Object.values(PARTEIEN).map((p) => {
      const a: ParteiAngaben = angaben?.parteien?.[p.rolle] ?? {};
      return { rolle: p.rolle, bezeichnung: p.bezeichnung, name: a.name ?? p.bezeichnung, quote: a.quoteKurz ?? a.quote ?? "" };
    }),
  };
}

/**
 * Den Code so lesen, wie Menschen ihn wirklich eingeben (05.09.2026).
 *
 * DER ANLASS: Der Veräußerer kam nicht herein — drei Versuche am 05.09.
 * zwischen 08:41 und 08:43, alle als „code_falsch" protokolliert. Sein Code
 * war und ist gültig; gescheitert ist die Schreibweise.
 *
 * Gemessen an der Live-Seite scheiterten unter anderem:
 *   SCP–V–7PCGHZ   Gedankenstrich statt Bindestrich — Mail-Programme und
 *                  Handy-Tastaturen wandeln „-" unbemerkt um
 *   SCP V 7PCGHZ   mit Leerzeichen abgetippt
 *   SCPV7PCGHZ     ohne Trennzeichen
 *
 * Keine dieser Eingaben ist ein Fehler des Absenders: Der Code ist derselbe,
 * nur anders geschrieben. Ein Zugang, der daran scheitert, schützt nichts —
 * er sperrt bloß den Richtigen aus. Deshalb wird jetzt auf Buchstaben und
 * Ziffern reduziert verglichen. Die Sicherheit steckt im Zufallsteil, nicht
 * in der Zeichensetzung.
 */
const nurZeichen = (s: string) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function parteiVonCode(code: string): { code: string; partei: { rolle: string; bezeichnung: string } } | null {
  const roh = String(code ?? "").trim().toUpperCase();
  const p = PARTEIEN[roh];
  if (p) return { code: roh, partei: p };
  const kern = nurZeichen(roh);
  if (!kern) return null;
  for (const [schluessel, partei] of Object.entries(PARTEIEN)) {
    if (nurZeichen(schluessel) === kern) return { code: schluessel, partei };
  }
  return null;
}

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
        rolle        TEXT,
        erste_ip     TEXT,
        erste_ua     TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        zuletzt_am   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    await tx.unsafe(`ALTER TABLE scp_gaeste ADD COLUMN IF NOT EXISTS rolle TEXT`);
    await tx`CREATE UNIQUE INDEX IF NOT EXISTS scp_gaeste_email ON scp_gaeste (lower(email))`;
    await tx`
      CREATE TABLE IF NOT EXISTS scp_zeichnungen (
        id               BIGSERIAL PRIMARY KEY,
        gast_id          BIGINT NOT NULL REFERENCES scp_gaeste(id),
        rolle            TEXT,
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
    await tx.unsafe(`ALTER TABLE scp_zeichnungen ADD COLUMN IF NOT EXISTS rolle TEXT`);
    // Je Partei genau EINE Unterschrift — unabhaengig davon, wer sich anmeldet.
    // MUSS nach der Spalte stehen: Ein Index auf ein Feld, das es noch nicht
    // gibt, laesst die ganze Einrichtung scheitern.
    // 04.09.2026: Der Index galt fuer JEDE Zeile mit Rolle — auch fuer die
    // unfertigen, die beim blossen Betreten durch das stille Zwischenspeichern
    // entstanden. Folge: Meldete sich ein ZWEITER Mensch derselben Partei mit
    // anderer E-Mail an, scheiterte er beim Speichern und beim Unterschreiben
    // an einem nackten „Serverfehler" — ohne Grund und ohne Ausweg. Bei
    // FIAON Ltd. ist gar nicht festgelegt, wer zeichnet; dort war genau das
    // wahrscheinlich. Die Regel gilt jetzt nur noch fuer echte Unterschriften:
    // Je Partei genau eine — unfertige Entwuerfe stehen sich nicht gegenseitig
    // im Weg. Der alte Index wird ausdruecklich entfernt, sonst bliebe er
    // neben dem neuen bestehen und wirkte weiter.
    await tx.unsafe(`DROP INDEX IF EXISTS scp_zeichnung_je_rolle`);
    await tx.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS scp_zeichnung_je_rolle
             ON scp_zeichnungen (rolle, dokument)
             WHERE rolle IS NOT NULL AND unterzeichnet_am IS NOT NULL`);
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
    await tx`
      CREATE TABLE IF NOT EXISTS scp_dokumente (
        schluessel  TEXT PRIMARY KEY,
        dateiname   TEXT,
        datei       BYTEA,
        seiten      INTEGER,
        pruefsumme  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    // E-447: die Vertragsangaben (Parteien, Quoten, Kaufpreis) — nie im Quelltext.
    await tx.unsafe(`ALTER TABLE scp_dokumente ADD COLUMN IF NOT EXISTS angaben JSONB`);
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
    const treffer = parteiVonCode(String(req.body?.code ?? ""));
    if (!treffer) {
      // Den Versuch mitschreiben — sonst steht im Protokoll nur „code_falsch"
      // und niemand kann nachvollziehen, WAS eingegeben wurde. Genau daran
      // hing am 05.09. eine halbe Stunde Suche. Nur die ersten 20 Zeichen,
      // und nur der Code: mehr braucht es nicht, mehr gehört nicht ins Log.
      await protokoll(null, "code_falsch", `eingegeben: ${String(req.body?.code ?? "").slice(0, 20)}`, req);
      return res.status(403).json({
        ok: false,
        error: "Dieser Zugangscode stimmt nicht. Bitte prüfen Sie, ob der Code vollständig "
             + "aus der E-Mail übernommen wurde — am besten kopieren statt abtippen. "
             + "Kommen Sie damit nicht weiter, wenden Sie sich an office@schwarzott-global.com.",
      });
    }
    const { partei } = treffer;

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
      INSERT INTO scp_gaeste (name, firma, email, telefon, rolle, erste_ip, erste_ua)
      VALUES (${name}, ${firma}, ${email}, ${telefon}, ${partei.rolle}, ${ipVon(req)},
              ${String(req.headers["user-agent"] || "").slice(0, 300)})
      ON CONFLICT (lower(email)) DO UPDATE
        SET name = EXCLUDED.name, firma = EXCLUDED.firma,
            telefon = EXCLUDED.telefon, rolle = EXCLUDED.rolle, zuletzt_am = NOW()
      RETURNING id, name, firma, email, telefon, rolle`) as any[];

    res.cookie(COOKIE, tokenBauen(Number(gast.id)), {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: TAGE * 24 * 3600_000,
    });
    await protokoll(Number(gast.id), "angemeldet", `${partei.rolle} · ${email}`, req);
    const angaben = await vertragsAngaben();
    res.json({
      ok: true,
      gast: { name: gast.name, firma: gast.firma, email: gast.email, telefon: gast.telefon },
      partei: parteiMitAngaben(partei.rolle, angaben),
      vertrag: vertragFuerGast(angaben),
    });
  } catch (err) {
    console.error("[SCP] anmelden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stand: wer bin ich, was habe ich gezeichnet ────────────────────────────
router.get("/scp/stand", async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    // ── DER UNTERSCHRIFTENSTAND GILT AUCH OHNE ANMELDUNG (04.09.2026) ────
    // Justin: „Man sieht nicht wenn jemand unterschrieben hat." Der Grund lag
    // hier: Ohne gültige Sitzung kam die Antwort { angemeldet: false } ZURÜCK
    // OHNE das Feld `stand`. Die Oberfläche macht daraus ein leeres Feld und
    // zeigt „0 von 4 Unterschriften liegen vor" — bei zwei geleisteten.
    // Die Sitzung gilt sieben Tage; die Unterschriften stammen vom 26.08.,
    // also sah JEDER, der später vorbeikam, den Vertrag als ungezeichnet.
    // Das ist schlimmer als eine fehlende Anzeige: Es ist eine falsche.
    //
    // E-447 (28.10.2026): Der Stand trägt die getippten Namen der
    // Unterzeichner — personenbezogen. Er geht deshalb nur noch an angemeldete
    // Gäste. Die Seite zeigt ihn ohnehin erst nach der Anmeldung und holt ihn
    // dort frisch (standHolen nach dem Anmelden), der Fehler vom 04.09. kehrt
    // also nicht zurück.
    const standAlle = (await sqlPool`
      SELECT rolle, unterschrift, unterzeichnet_am FROM scp_zeichnungen
       WHERE rolle IS NOT NULL AND unterzeichnet_am IS NOT NULL`) as any[];
    const standListe = standAlle.map((z: any) => ({
      rolle: z.rolle, unterschrift: z.unterschrift, unterzeichnetAm: z.unterzeichnet_am,
    }));
    const gastId = tokenPruefen((req as any).cookies?.[COOKIE]);
    if (!gastId) return res.json({ ok: true, angemeldet: false, stand: [] });
    const [gast] = (await sqlPool`SELECT id, name, firma, email, telefon, rolle FROM scp_gaeste WHERE id = ${gastId}`) as any[];
    if (!gast) return res.json({ ok: true, angemeldet: false, stand: [] });
    const [meine] = (await sqlPool`
      SELECT dokument, anmerkungen, unterschrift, unterzeichnet_am
        FROM scp_zeichnungen WHERE gast_id = ${gastId} LIMIT 1`) as any[];
    // Der Stand ALLER Parteien: Ein Vertrag mit vier Unterschriften ist erst
    // dann vollstaendig, wenn alle vier da sind — jede Partei soll sehen,
    // worauf noch gewartet wird.
    const angaben = await vertragsAngaben();
    const partei = gast.rolle ? parteiMitAngaben(gast.rolle, angaben) : null;
    res.json({
      ok: true, angemeldet: true,
      gast: { name: gast.name, firma: gast.firma, email: gast.email, telefon: gast.telefon },
      partei,
      vertrag: vertragFuerGast(angaben),
      meine: meine ? {
        anmerkungen: meine.anmerkungen, unterschrift: meine.unterschrift,
        unterzeichnetAm: meine.unterzeichnet_am,
      } : null,
      stand: standListe,
    });
  } catch (err) {
    console.error("[SCP] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFSICHT — was der Betreiber sehen muss (04.09.2026)
//
// Bis heute gab es KEINE Stelle, an der jemand den Stand des Vertrags
// nachsehen konnte. Nur dieses Modul kannte die Tabellen; es existierte weder
// eine Chef-Seite noch eine Admin-Ansicht. Justin wusste deshalb nicht, dass
// zwei der vier Parteien längst gezeichnet hatten.
//
// Diese Route ist die Aufsicht: Sie zeigt alle vier Parteien mit ihrem Stand,
// jede Anmeldung, jede Vertragsöffnung und jede Unterschrift mit Zeitpunkt,
// IP und Prüfsumme. Sie liegt hinter requireChef("inhaber") — sie enthält
// personenbezogene Daten Dritter (Namen, E-Mail, Telefon, IP) und geht
// niemanden außer dem Betreiber etwas an.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/scp/aufsicht", requireChef("inhaber"), async (_req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    const gaeste = (await sqlPool`
      SELECT id, name, firma, email, telefon, rolle, erste_ip, created_at, zuletzt_am
        FROM scp_gaeste ORDER BY id`) as any[];
    const zeichnungen = (await sqlPool`
      SELECT z.id, z.gast_id, z.rolle, z.dokument, z.unterschrift, z.unterzeichnet_am,
             z.ip, z.ua, z.pruefsumme, z.anmerkungen, g.name AS gast_name, g.email AS gast_email
        FROM scp_zeichnungen z LEFT JOIN scp_gaeste g ON g.id = z.gast_id
       ORDER BY z.unterzeichnet_am NULLS LAST, z.id`) as any[];
    const protokoll = (await sqlPool`
      SELECT p.id, p.gast_id, p.art, p.detail, p.created_at, g.name AS gast_name
        FROM scp_protokoll p LEFT JOIN scp_gaeste g ON g.id = p.gast_id
       ORDER BY p.id DESC LIMIT 200`) as any[];

    // Jede Partei mit ihrem Stand — auch die, die noch nie da war. Eine Liste,
    // die nur Anwesende zeigt, beantwortet die wichtigste Frage nicht: wer fehlt.
    const angaben = await vertragsAngaben();
    const parteien = Object.entries(PARTEIEN).map(([code, roh]) => {
      const p = parteiMitAngaben(roh.rolle, angaben)!;
      const z = zeichnungen.find((x: any) => x.rolle === p.rolle && x.unterzeichnet_am);
      const g = gaeste.find((x: any) => x.rolle === p.rolle);
      return {
        code, rolle: p.rolle, bezeichnung: p.bezeichnung, name: p.name,
        quote: p.quote, gesamtanteil: p.gesamtanteil,
        gezeichnet: !!z,
        unterschrift: z?.unterschrift ?? null,
        unterzeichnetAm: z?.unterzeichnet_am ?? null,
        ip: z?.ip ?? null,
        pruefsumme: z?.pruefsumme ?? null,
        gastName: g?.name ?? null,
        gastEmail: g?.email ?? null,
        gastTelefon: g?.telefon ?? null,
        zuletztDa: g?.zuletzt_am ?? null,
      };
    });
    const gezeichnet = parteien.filter((p) => p.gezeichnet).length;
    res.json({
      ok: true,
      zusammenfassung: {
        gezeichnet, gesamt: parteien.length,
        vollstaendig: gezeichnet === parteien.length,
        fehlen: parteien.filter((p) => !p.gezeichnet).map((p) => p.name),
      },
      parteien, gaeste, zeichnungen, protokoll,
      angabenHinterlegt: !!angaben,
    });
  } catch (err) {
    console.error("[SCP] aufsicht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Vertragsangaben hinterlegen (E-447) ────────────────────────────────────
// Der eine Schreibweg für scp_dokumente.angaben — nur der Inhaber, aus der
// angemeldeten Chefbüro-Sitzung. So kommen Namen und Beträge in die Datenbank,
// ohne je wieder im (öffentlichen) Quelltext zu stehen.
router.put("/chef/scp/angaben", requireChef("inhaber"), async (req: Request, res: Response) => {
  try {
    await ensureScpTabellen();
    const a = req.body?.angaben;
    if (!a || typeof a !== "object" || Array.isArray(a) || !a.parteien || typeof a.parteien !== "object") {
      return res.status(400).json({ ok: false, error: "Erwartet: { angaben: { …, parteien: { <rolle>: {…} } } }" });
    }
    const unbekannt = Object.keys(a.parteien).filter((r) => !Object.values(PARTEIEN).some((p) => p.rolle === r));
    if (unbekannt.length) return res.status(400).json({ ok: false, error: `Unbekannte Rolle: ${unbekannt.join(", ")}` });
    const json = JSON.stringify(a);
    if (json.length > 50_000) return res.status(413).json({ ok: false, error: "Zu groß." });
    const r = (await sqlPool`
      UPDATE scp_dokumente SET angaben = ${json}::text::jsonb, updated_at = NOW()
       WHERE schluessel = ${DOKUMENT_ANGABEN} RETURNING schluessel`) as any[];
    if (!r.length) return res.status(404).json({ ok: false, error: "Der Vertrag ist noch nicht hinterlegt." });
    res.json({ ok: true });
  } catch (err) {
    console.error("[SCP] angaben:", err);
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
    const [g] = (await sqlPool`SELECT rolle FROM scp_gaeste WHERE id = ${gastId}`) as any[];
    await sqlPool`
      INSERT INTO scp_zeichnungen (gast_id, rolle, dokument, anmerkungen)
      VALUES (${gastId}, ${g?.rolle ?? null}, ${dokument},
              ${String(req.body?.anmerkungen ?? "").slice(0, 8000)})
      ON CONFLICT (gast_id, dokument) DO UPDATE
        SET anmerkungen = EXCLUDED.anmerkungen, updated_at = NOW()`;
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
    // § 12 des Vertrags: Beide Parteien muessen bestaetigen, dass ihnen das
    // Beurkundungserfordernis nach § 15 Abs. 3 und 4 GmbHG bekannt ist. Ohne
    // diese Bestaetigung waere die Unterschrift hier irrefuehrend.
    if (req.body?.form !== true) {
      return res.status(400).json({ ok: false, error: "Bitte bestätigen, dass Ihnen das Beurkundungserfordernis nach § 12 bekannt ist." });
    }
    const [gr] = (await sqlPool`SELECT rolle FROM scp_gaeste WHERE id = ${gastId}`) as any[];
    const rolle = gr?.rolle ?? null;
    if (!rolle) return res.status(403).json({ ok: false, error: "Ihrem Zugang ist keine Vertragspartei zugeordnet." });
    // Je Partei genau EINE Unterschrift — auch wenn sich zwei Menschen mit
    // demselben Code anmelden.
    const [schon] = (await sqlPool`
      SELECT unterschrift, unterzeichnet_am FROM scp_zeichnungen
       WHERE rolle = ${rolle} AND dokument = ${dokument} AND unterzeichnet_am IS NOT NULL`) as any[];
    if (schon) {
      return res.status(409).json({
        ok: false,
        error: `Für diese Vertragspartei liegt bereits eine Unterschrift vor (${schon.unterschrift}).`,
      });
    }

    const [da] = (await sqlPool`
      SELECT unterzeichnet_am FROM scp_zeichnungen WHERE gast_id = ${gastId} AND dokument = ${dokument}`) as any[];
    if (da?.unterzeichnet_am) {
      return res.status(409).json({ ok: false, error: "Diese Zeichnung wurde bereits unterzeichnet." });
    }

    const anmerkungen = String(req.body?.anmerkungen ?? "").slice(0, 8000);
    // Die Pruefsumme friert ein, WORUEBER unterschrieben wurde: Vertragsfassung,
    // Partei, Unterzeichner und Anmerkungen.
    const pruefsumme = createHash("sha256")
      .update(JSON.stringify({ dokument, rolle, gast: gast.email, name, anmerkungen }))
      .digest("hex");

    await sqlPool`
      INSERT INTO scp_zeichnungen (gast_id, rolle, dokument, anmerkungen,
                                   unterschrift, unterzeichnet_am, ip, ua, pruefsumme)
      VALUES (${gastId}, ${rolle}, ${dokument}, ${anmerkungen},
              ${name}, NOW(), ${ipVon(req)},
              ${String(req.headers["user-agent"] || "").slice(0, 300)}, ${pruefsumme})
      ON CONFLICT (gast_id, dokument) DO UPDATE
        SET rolle = EXCLUDED.rolle, anmerkungen = EXCLUDED.anmerkungen,
            unterschrift = EXCLUDED.unterschrift, unterzeichnet_am = NOW(),
            ip = EXCLUDED.ip, ua = EXCLUDED.ua, pruefsumme = EXCLUDED.pruefsumme,
            updated_at = NOW()
      WHERE scp_zeichnungen.unterzeichnet_am IS NULL`;

    await protokoll(gastId, "unterzeichnet", `${rolle} · ${dokument}`, req);
    const [neu] = (await sqlPool`
      SELECT unterzeichnet_am FROM scp_zeichnungen WHERE gast_id = ${gastId} AND dokument = ${dokument}`) as any[];
    res.json({ ok: true, unterzeichnetAm: neu?.unterzeichnet_am ?? null, pruefsumme: pruefsumme.slice(0, 16) });
  } catch (err) {
    console.error("[SCP] unterzeichnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Der Vertrag als PDF ────────────────────────────────────────────────────
//
// ── WARUM DIE DATENBANK UND NICHT DAS REPOSITORY (26.08.2026) ─────────────
// Der erste Ansatz war eine Datei unter server/dokumente/. Beim Prüfen fiel
// auf: github.com/fiaon007/fiaon-plattform ist ÖFFENTLICH. Ein Vertrag über
// 14 Mio. EUR mit Geburtsdatum und Anschrift des Veräußerers wäre damit
// weltweit abrufbar gewesen — und Git vergisst nichts, auch nach dem Löschen
// bleibt der Blob in der Historie. Die Datei wurde entfernt, bevor sie in
// einen Commit geriet.
//
// Die Datenbank ist ohnehin der eingeführte Weg: Kontoauszüge und Ausweise
// liegen dort seit jeher als bytea. Ein zweiter Ablageort für Dokumente wäre
// ein zweiter Ort, an dem etwas vergessen wird.
//
// Eingespielt wird der Vertrag mit scripts/scp-vertrag-einspielen.ts —
// einmalig, von Justins Rechner, ohne Umweg über Git.
router.get("/scp/vertrag.pdf", async (req: Request, res: Response) => {
  try {
    const gastId = tokenPruefen((req as any).cookies?.[COOKIE]);
    if (!gastId) return res.status(401).json({ ok: false, error: "Bitte erneut anmelden." });
    const [d] = (await sqlPool`
      SELECT datei, dateiname FROM scp_dokumente WHERE schluessel = 'anteilskaufvertrag'`) as any[];
    if (!d?.datei) {
      return res.status(404).json({ ok: false, error: "Der Vertrag ist noch nicht hinterlegt." });
    }
    await protokoll(gastId, "vertrag_geoeffnet", null, req);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${d.dateiname || "Anteilskaufvertrag.pdf"}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.send(Buffer.from(d.datei));
  } catch (err) {
    console.error("[SCP] vertrag:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Abmelden ───────────────────────────────────────────────────────────────
router.post("/scp/abmelden", async (req: Request, res: Response) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
