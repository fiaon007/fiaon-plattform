// ═══════════════════════════════════════════════════════════════════════════
// ROUTEN: FINANZ- UND BONITÄTSAUSWERTUNG · UNTERLAGEN ANFORDERN · UPLOAD-LINK
// (E-IT-D, 08.10.2026 — Punkte 4b und 4c des Team-Feedbacks)
//
// Akte (requireAgent + darfAnKunde — wer den Kunden betreut, und die Leitung):
//   GET  /agent/kunden/:personId/finanzauswertung              Voraussetzungen, Fassungen, Anfragen
//   POST /agent/kunden/:personId/finanzauswertung              erzeugen (im Hintergrund)
//   GET  /agent/kunden/:personId/finanzauswertung/:id          Kopf + eingefrorener Inhalt (Vorschau)
//   GET  /agent/kunden/:personId/finanzauswertung/:id/pdf      das PDF (inline, Vorschau im Rahmen)
//   POST /agent/kunden/:personId/finanzauswertung/:id/freigeben
//   POST /agent/kunden/:personId/finanzauswertung/:id/verwerfen  {grund}
//   POST /agent/kunden/:personId/ausweis-sichtpruefung         {dokumenttyp}
//   POST /agent/kunden/:personId/ausweis-sichtpruefung/zuruecknehmen  {grund}
//   POST /agent/kunden/:personId/unterlagen-anfordern          {arten, kanaele}
//   POST /agent/kunden/:personId/unterlagen-link/widerrufen    {grund}
// Kunde (requireKunde — signiertes Cookie):
//   GET  /kunde/:ref/finanzauswertung                         die freigegebene Fassung (eingefroren) + frühere
//   GET  /kunde/:ref/finanzauswertung/:id/pdf                 Download (nur freigegeben/ersetzt, nur die eigene)
// Ohne Anmeldung (Token im Pfad, signiert, 14 Tage):
//   GET  /unterlagen/:token                                   Lage je angeforderter Art (nie Inhalte)
//   POST /unterlagen/:token/hochladen                         multipart, Felder je Art (ausweis, kontoauszug, schufa)
//   POST /unterlagen/:token/neu                               abgelaufen → neuer Link an die Adresse der Akte (gedrosselt)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import {
  lage, erzeugen, fassungLesen, freigeben, verwerfen, pdfLesen, sichtpruefungSetzen, sichtpruefungZuruecknehmen, kundeAuswertungen, kundeGelesen, eingabenSammeln, gehoertZu,
} from "../lib/fiaon-finanzauswertung";
import { linkLesen, artenStand, unterlageAnnehmen, unterlagenAnfrageSenden, linkWiderrufen } from "../lib/fiaon-unterlagen-link";
import {
  LINK_ART_TEXT, LINK_DATEI_MAX_MB, LINK_DATEIEN_JE_ART, LINK_ANFRAGE_MAX_MB, LINK_UPLOADS_GLEICHZEITIG, istLinkArt, type LinkArt,
} from "@shared/fiaon-unterlagen-anfrage";
import { fensterDrossel } from "../lib/fiaon-global-bereich-regeln";

const router = Router();

// ───────────────────────────────────────────────────────────────────────────
// Akte
// ───────────────────────────────────────────────────────────────────────────

async function zugang(req: AgentRequest, res: Response): Promise<{ personId: number; rolle: string } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Ungültiger Kunde." }); return null; }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Nicht dein Kunde." }); return null; }
  return { personId, rolle };
}
const idAus = (req: Request) => { const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? n : null; };

/**
 * Ist dieser Mitarbeiter der BETREUER des Kunden? (Nachprüfung 08.10.2026, Entscheidung 4b „Freigabe durch
 * den Betreuer“.) darfAnKunde öffnet die Akte auch für Pool-Kunden, Termine, Inkasso und Vertretung —
 * freigeben darf aber nur, wem der Kunde zugewiesen ist, oder seine aktuelle Vertretung. Die Leitung
 * prüft freigabeRegel selbst über die Rolle.
 */
async function istBetreuer(agentId: number, personId: number): Promise<boolean> {
  const [p] = (await sqlPool`
    SELECT 1 AS ja FROM fiaon_persons WHERE id = ${personId} AND assigned_agent_id = ${agentId} LIMIT 1`.catch(() => [] as any[])) as any[];
  if (p) return true;
  try {
    const { vertreterDarfAnKunde } = await import("../lib/fiaon-abwesenheit");
    return await vertreterDarfAnKunde(agentId, personId);
  } catch {
    return false;
  }
}

router.get("/agent/kunden/:personId/finanzauswertung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await lage(z.personId)), rolle: z.rolle, ich: req.agent!.id });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Lage:", err);
    res.status(500).json({ ok: false, error: "Die Auswertung ließ sich nicht laden." });
  }
});

router.post("/agent/kunden/:personId/finanzauswertung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await erzeugen(z.personId, { name: req.agent!.name, agentId: req.agent!.id });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, meldung: r.text, id: r.id, status: r.status } : { ok: false, error: r.text });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] erzeugen:", err);
    res.status(500).json({ ok: false, error: "Die Auswertung ließ sich nicht starten." });
  }
});

router.get("/agent/kunden/:personId/finanzauswertung/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = idAus(req); const f = id ? await fassungLesen(id) : null;
    if (!f || !(await gehoertZu(f.personId, z.personId))) return res.status(404).json({ ok: false, error: "Diese Auswertung gibt es nicht." });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, fassung: f });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Fassung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/kunden/:personId/finanzauswertung/:id/pdf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = idAus(req); const p = id ? await pdfLesen(id) : null;
    if (!p || !(await gehoertZu(p.personId, z.personId))) return res.status(404).json({ ok: false, error: "Kein PDF zu dieser Auswertung." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="FIAON-Finanzauswertung-${p.nummer}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(p.pdf);
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] PDF:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/kunden/:personId/finanzauswertung/:id/freigeben", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = idAus(req); const f = id ? await fassungLesen(id) : null;
    if (!f || !(await gehoertZu(f.personId, z.personId))) return res.status(404).json({ ok: false, error: "Diese Auswertung gibt es nicht." });
    const zustaendig = await istBetreuer(req.agent!.id, z.personId);
    const r = await freigeben(f.id, { name: req.agent!.name, agentId: req.agent!.id, rolle: z.rolle, zustaendig });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, meldung: r.text } : { ok: false, error: r.text });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] freigeben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/kunden/:personId/finanzauswertung/:id/verwerfen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = idAus(req); const f = id ? await fassungLesen(id) : null;
    if (!f || !(await gehoertZu(f.personId, z.personId))) return res.status(404).json({ ok: false, error: "Diese Auswertung gibt es nicht." });
    const r = await verwerfen(f.id, String(req.body?.grund ?? ""), { name: req.agent!.name, agentId: req.agent!.id });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, meldung: r.text } : { ok: false, error: r.text });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] verwerfen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/kunden/:personId/ausweis-sichtpruefung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await sichtpruefungSetzen(z.personId, req.body?.dokumenttyp, { name: req.agent!.name, agentId: req.agent!.id });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, meldung: r.text } : { ok: false, error: r.text });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Sichtprüfung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Nachprüfung 08.10.2026: Eine Fehlbestätigung des Ausweises zurücknehmen (mit Grund, steht im Verlauf).
router.post("/agent/kunden/:personId/ausweis-sichtpruefung/zuruecknehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await sichtpruefungZuruecknehmen(z.personId, req.body?.grund, { name: req.agent!.name, agentId: req.agent!.id });
    res.status(r.ok ? 200 : 422).json(r.ok ? { ok: true, meldung: r.text } : { ok: false, error: r.text });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Sichtprüfung zurücknehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/kunden/:personId/unterlagen-anfordern", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const arten = (Array.isArray(req.body?.arten) ? req.body.arten : []).map(String).filter(istLinkArt) as LinkArt[];
    if (!arten.length) return res.status(400).json({ ok: false, error: "Bitte wählen, was angefordert wird." });
    const kanaele = (Array.isArray(req.body?.kanaele) ? req.body.kanaele : ["mail"]).map(String).filter((k: string) => k === "mail" || k === "whatsapp") as ("mail" | "whatsapp")[];
    if (!kanaele.length) return res.status(400).json({ ok: false, error: "Bitte einen Weg wählen: E-Mail oder WhatsApp." });
    // Die genauen Sätze aus den Voraussetzungen („Ihre Kontoauszüge für August und September").
    const e = await eingabenSammeln(z.personId).catch(() => null);
    const saetze: Partial<Record<LinkArt, string>> = {};
    if (e?.voraussetzungen.ausweis.bitte) saetze.ausweis = e.voraussetzungen.ausweis.bitte;
    if (e?.voraussetzungen.kontoauszug.bitte) saetze.kontoauszug = e.voraussetzungen.kontoauszug.bitte;
    const r = await unterlagenAnfrageSenden({
      personId: z.personId, arten, kanaele, saetze, quelle: "akte",
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: z.rolle },
    });
    const { _url, ...ohneLink } = r;
    void _url;
    res.status(r.status === "abgelehnt" ? 422 : 200).json({ ...ohneLink, ok: r.ok, meldung: r.meldung, error: r.ok ? undefined : r.meldung });
  } catch (err) {
    console.error("[UNTERLAGEN] anfordern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/kunden/:personId/unterlagen-link/widerrufen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const grund = String(req.body?.grund ?? "").trim() || `widerrufen von ${req.agent!.name}`;
    const n = await linkWiderrufen(z.personId, grund);
    if (n) {
      await sqlPool`INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, ref)
                    VALUES (${z.personId}, ${req.agent!.id}, ${req.agent!.name}, 'system', ${`Upload-Link widerrufen (${grund}).`},
                            (SELECT ref FROM fiaon_applications WHERE person_id = ${z.personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1))`.catch(() => {});
    }
    res.json({ ok: true, meldung: n ? "Der Upload-Link gilt ab sofort nicht mehr." : "Es gab keinen gültigen Upload-Link." });
  } catch (err) {
    console.error("[UNTERLAGEN] widerrufen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Kunde
// ───────────────────────────────────────────────────────────────────────────

/** Querprüfung 08.10.2026: Hat der Mensch (mit Dubletten) ein bezahltes, ungekündigtes, nicht beendetes Stufenpaket? */
async function paketLaeuft(personId: number): Promise<boolean> {
  const { personFamilie } = await import("../lib/fiaon-unterlagen-link");
  const { produktkategorieSql } = await import("../lib/fiaon-produktkategorie");
  const familie = await personFamilie(personId);
  const [z] = (await sqlPool.unsafe(
    `SELECT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ANY($1::int[]) AND a.merged_into IS NULL
        AND a.payment_status = 'paid' AND a.gekuendigt_am IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
        AND (a.vertrag_ende_am IS NULL OR a.vertrag_ende_am > NOW()) AND ${produktkategorieSql("a")} = 'konto') AS ja`, [familie])) as any[];
  return z?.ja === true;
}

async function personVonRef(ref: string): Promise<number | null> {
  const [a] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return a?.person_id != null ? Number(a.person_id) : null;
}

router.get("/kunde/:ref/finanzauswertung", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const personId = await personVonRef(req.kundeRef!);
    if (!personId) return res.json({ ok: true, aktuell: null, fruehere: [], laufend: false });
    const r = await kundeAuswertungen(personId);
    // Querprüfung 08.10.2026: Die Leerkarte („Sobald Ihre Unterlagen vollständig sind …“) verspricht etwas nur dem, der ein
    // laufendes, ungekündigtes Paket hat — Gekündigte und Kunden ohne Paket sehen einen neutralen Satz.
    const laufend = await paketLaeuft(personId).catch(() => false);
    const gelesen = !!r.aktuell?.kundeGelesenAm;
    // Gelesen erst, wenn die Ansicht wirklich offen ist (?gelesen=1) — nicht schon, wenn die Karte auf „Heute“ nachfragt.
    // Nur der Kunde selbst macht sie „gelesen" — nie die Als-Kunde-Ansicht der Leitung (Nur-Ansicht, ohne Kunden-Cookie).
    const { kundeAusCookie } = await import("../lib/fiaon-kunde-session");
    if (r.aktuell && req.query.gelesen === "1" && kundeAusCookie(req as any) === req.kundeRef) await kundeGelesen(r.aktuell.id, personId);
    // Nur, was der Kunde sehen darf: kein Ersteller, keine Kosten, kein Modell, keine internen Vermerke.
    const schmal = (f: any) => ({ id: f.id, nummer: f.nummer, fassung: f.fassung, freigegebenAm: f.freigegebenAm, status: f.status });
    res.json({
      ok: true, gelesen, laufend,
      aktuell: r.aktuell ? { ...schmal(r.aktuell), inhalt: req.query.kurz === "1" ? null : r.aktuell.inhalt } : null,
      fruehere: r.fruehere.map(schmal),
    });
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Kunde:", err);
    res.status(500).json({ ok: false, error: "Ihre Auswertung lässt sich gerade nicht laden." });
  }
});

router.get("/kunde/:ref/finanzauswertung/:id/pdf", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const personId = await personVonRef(req.kundeRef!);
    const id = idAus(req); const p = id ? await pdfLesen(id) : null;
    if (!personId || !p || !(await gehoertZu(p.personId, personId)) || (p.status !== "freigegeben" && p.status !== "ersetzt")) {
      return res.status(404).json({ ok: false, error: "Diese Auswertung gibt es nicht." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.ansehen ? "inline" : "attachment"}; filename="FIAON-Finanzauswertung-${p.nummer}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(p.pdf);
  } catch (err) {
    console.error("[FINANZAUSWERTUNG] Kunde PDF:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Upload-Link ohne Anmeldung
// ───────────────────────────────────────────────────────────────────────────

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}
// fensterDrossel: true = zu viel (fiaon-global-bereich-regeln.ts).
const leseJeIp = fensterDrossel(60, 10 * 60_000);
const uploadJeLink = fensterDrossel(30, 10 * 60_000);
const uploadJeIp = fensterDrossel(40, 10 * 60_000);
const neuJeLink = fensterDrossel(1, 24 * 3_600_000);
const ZU_VIEL = "Das waren gerade viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten noch einmal.";
const GRUND_TEXT: Record<string, string> = {
  ungueltig: "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus Ihrer letzten E-Mail von FIAON.",
  abgelaufen: "Dieser Link ist abgelaufen. Sie können mit einem Klick einen neuen anfordern — er kommt an die E-Mail-Adresse, die wir von Ihnen haben.",
  widerrufen: "Dieser Link gilt nicht mehr — Sie haben inzwischen einen neueren bekommen. Bitte nutzen Sie den Link aus Ihrer letzten E-Mail.",
  zurueckgezogen: "Dieser Link gilt nicht mehr. Bitte wenden Sie sich an Ihre Ansprechperson bei FIAON.",
};
/** Der Satz zum Link: „ersetzt durch …" heißt, ein neuerer ist zugestellt — sonst ein Widerruf von Hand. */
function grundText(l: { grund: string; link?: { widerrufGrund: string | null } }): string {
  if (l.grund === "widerrufen" && !/^ersetzt durch/.test(l.link?.widerrufGrund ?? "")) return GRUND_TEXT.zurueckgezogen;
  return GRUND_TEXT[l.grund] ?? GRUND_TEXT.ungueltig;
}
const ANFRAGE_MAX_BYTES = LINK_ANFRAGE_MAX_MB * 1024 * 1024;
const ZU_GROSS = `Das sind zusammen mehr als ${LINK_ANFRAGE_MAX_MB} MB. Bitte laden Sie die Dateien in mehreren Schritten hoch — oder nur die Seiten, die noch fehlen.`;
/** Wie viele Uploads ohne Anmeldung gerade im Speicher liegen (je Server-Prozess). */
let uploadsLaufend = 0;

router.get("/unterlagen/:token", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    if (leseJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const l = await linkLesen(String(req.params.token));
    if (!l.ok) return res.status(l.grund === "ungueltig" ? 404 : 410).json({ ok: false, code: l.grund, error: grundText(l) });
    const [p] = (await sqlPool`SELECT first_name FROM fiaon_persons WHERE id = ${l.link.personId} LIMIT 1`) as any[];
    const stand = await artenStand(l.link.personId, l.link.arten);
    res.json({
      ok: true, vorname: String(p?.first_name ?? "").trim() || null, gueltigBis: l.link.gueltigBis.toISOString(),
      maxMb: LINK_DATEI_MAX_MB, maxDateien: LINK_DATEIEN_JE_ART, maxGesamtMb: LINK_ANFRAGE_MAX_MB,
      arten: l.link.arten.map((a) => ({ art: a, titel: LINK_ART_TEXT[a].titel, anleitung: LINK_ART_TEXT[a].anleitung, ...stand[a] })),
    });
  } catch (err) {
    console.error("[UNTERLAGEN-LINK] Lage:", err);
    res.status(500).json({ ok: false, error: "Die Seite lässt sich gerade nicht laden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

/**
 * Zutritt VOR multer: Ohne gültigen Link liest niemand 50 MB in den Speicher.
 * Gegenprüfung 08.10.: dazu eine Obergrenze je Anfrage (Content-Length vorab,
 * Zähler im Strom, falls die Länge fehlt) und höchstens LINK_UPLOADS_GLEICHZEITIG
 * Uploads zugleich — sonst reichten zwei, drei Handys mit 20 Fotos für einen
 * Speicherüberlauf, und mit dem Dienst fielen Telefonie und Office aus.
 */
async function linkZutritt(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const ip = clientIp(req);
    if (uploadJeIp(ip) || uploadJeLink(String(req.params.token).split(".")[0])) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const laenge = Number(req.headers["content-length"]);
    if (Number.isFinite(laenge) && laenge > ANFRAGE_MAX_BYTES) return res.status(413).json({ ok: false, error: ZU_GROSS });
    const l = await linkLesen(String(req.params.token));
    if (!l.ok) return res.status(l.grund === "ungueltig" ? 404 : 410).json({ ok: false, code: l.grund, error: grundText(l) });
    // Prüfen und zählen ohne await dazwischen — sonst kämen mehrere zugleich durch.
    if (uploadsLaufend >= LINK_UPLOADS_GLEICHZEITIG) {
      return res.status(503).json({ ok: false, error: "Gerade laden viele gleichzeitig hoch. Bitte versuchen Sie es in einer Minute noch einmal." });
    }
    uploadsLaufend++;
    let frei = false;
    res.on("close", () => { if (!frei) { frei = true; uploadsLaufend--; } });
    (req as any).unterlagenLink = l.link;
    const { default: multer } = await import("multer");
    // Zähler im Strom (auch ohne Content-Length): über der Grenze wird die Anfrage abgebrochen.
    let gelesen = 0;
    let zuGross = false;
    req.on("data", (c: Buffer) => {
      gelesen += c.length;
      if (gelesen > ANFRAGE_MAX_BYTES && !zuGross) {
        zuGross = true;
        if (!res.headersSent) res.status(413).json({ ok: false, error: ZU_GROSS });
        req.unpipe();
        req.destroy();
      }
    });
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: LINK_DATEI_MAX_MB * 1024 * 1024, files: LINK_DATEIEN_JE_ART * l.link.arten.length, fields: 6, parts: LINK_DATEIEN_JE_ART * l.link.arten.length + 6 },
    }).fields(l.link.arten.map((a) => ({ name: a, maxCount: LINK_DATEIEN_JE_ART })))(req as any, res as any, (err: any) => {
      if (zuGross || res.headersSent) return;
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ ok: false, error: `Eine Datei ist größer als ${LINK_DATEI_MAX_MB} MB. Bitte fotografieren Sie die Seite noch einmal oder laden Sie eine kleinere PDF-Datei hoch.` });
      if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ ok: false, error: `Bitte höchstens ${LINK_DATEIEN_JE_ART} Dateien je Unterlage auf einmal.` });
      if (err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ ok: false, error: "Über diesen Link lassen sich nur die angeforderten Unterlagen hochladen." });
      return res.status(400).json({ ok: false, error: "Die Dateien konnten nicht angenommen werden. Bitte versuchen Sie es noch einmal." });
    });
  } catch (err) {
    console.error("[UNTERLAGEN-LINK] Zutritt:", err);
    res.status(500).json({ ok: false, error: "Der Upload ist gerade nicht möglich. Bitte versuchen Sie es gleich noch einmal." });
  }
}

router.post("/unterlagen/:token/hochladen", linkZutritt, async (req: Request, res: Response) => {
  try {
    const link = (req as any).unterlagenLink as { id: number; personId: number; arten: LinkArt[] };
    const files = ((req as any).files ?? {}) as Record<string, Express.Multer.File[]>;
    const ergebnisse: { art: LinkArt; ok: boolean; meldung: string }[] = [];
    for (const art of link.arten) {
      const liste = files[art] ?? [];
      if (!liste.length) continue;
      const r = await unterlageAnnehmen({
        personId: link.personId, art, quelle: { art: "link", linkId: link.id },
        dateien: liste.map((f) => ({ buffer: f.buffer, name: String(f.originalname || "Datei"), mimetype: String(f.mimetype || "") })),
      });
      ergebnisse.push({ art, ok: r.ok, meldung: r.meldung });
    }
    if (!ergebnisse.length) return res.status(400).json({ ok: false, error: "Bitte wählen Sie mindestens eine Datei aus." });
    const stand = await artenStand(link.personId, link.arten);
    const ok = ergebnisse.every((e) => e.ok);
    res.status(ok ? 200 : 422).json({
      ok, ergebnisse, meldung: ergebnisse.map((e) => e.meldung).join(" "),
      arten: link.arten.map((a) => ({ art: a, titel: LINK_ART_TEXT[a].titel, anleitung: LINK_ART_TEXT[a].anleitung, ...stand[a] })),
      error: ok ? undefined : ergebnisse.filter((e) => !e.ok).map((e) => e.meldung).join(" "),
    });
  } catch (err) {
    console.error("[UNTERLAGEN-LINK] hochladen:", err);
    res.status(500).json({ ok: false, error: "Beim Hochladen ist etwas schiefgegangen. Bitte versuchen Sie es noch einmal." });
  }
});

/** Abgelaufen: ein neuer Link an die Adresse der Akte — höchstens einmal je Link und Tag, durch dieselbe Drossel wie die Akte. */
router.post("/unterlagen/:token/neu", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const l = await linkLesen(String(req.params.token));
    if (l.ok) return res.json({ ok: true, meldung: "Ihr Link ist noch gültig — Sie können direkt hochladen." });
    if (!l.link || l.grund === "ungueltig") return res.status(404).json({ ok: false, error: GRUND_TEXT.ungueltig });
    // Nur ABGELAUFENE Links bringen einen neuen. Ein widerrufener (ersetzt oder von Hand
    // zurückgezogen, z. B. falsche Adresse, weitergeleitet) darf sich nicht selbst wiederbeleben.
    if (l.grund !== "abgelaufen") return res.status(410).json({ ok: false, code: l.grund, error: grundText(l) });
    if (neuJeLink(String(l.link.id))) return res.status(429).json({ ok: false, error: "Ein neuer Link ist schon unterwegs. Bitte schauen Sie in Ihr Postfach." });
    const r = await unterlagenAnfrageSenden({
      personId: l.link.personId, arten: l.link.arten, kanaele: ["mail"], quelle: "kunde_neu",
      akteur: { name: "Kunde (neuer Link)", agentId: null, rolle: "admin" },
    });
    // Immer dieselbe Antwort nach außen (keine Auskunft über Adresse oder Sperren).
    void r;
    res.json({ ok: true, meldung: "Wenn wir Sie per E-Mail erreichen dürfen, ist ein neuer Link unterwegs. Bitte schauen Sie in Ihr Postfach." });
  } catch (err) {
    console.error("[UNTERLAGEN-LINK] neu:", err);
    res.status(500).json({ ok: false, error: "Das hat gerade nicht geklappt. Bitte versuchen Sie es später noch einmal." });
  }
});

export default router;
