// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN — DIE ROUTEN (E-IT-C, 08.10.2026, Punkt 3 + 13)
//
// Drei Türen, eine Logik (server/lib/fiaon-unterlagen.ts):
//   · /kunde/:ref/unterlagen…   — der Kunde (requireKunde: Sitzung UND passende ref).
//     Die Als-Kunde-Ansicht der Leitung liest mit, schreibt nie (requireKunde).
//   · /agent/unterlagen/:personId… — das Office (requireAgent + darfAnKunde).
//   · /admin/unterlagen/:ref…   — die Chefbüro-Akte (hinter dem Admin-Code).
//
// Hausmuster (fiaon-global-bereich.ts, fiaon-social.ts): GENAU EINE Datei je
// Anfrage, der Zutritt wird geprüft, BEVOR multer den Körper liest, die Größe
// schon am Content-Length (vor multer), die Datei liegt auf der Platte (tmp),
// nicht im Arbeitsspeicher. Den Typ bestimmt der Inhalt, ausgeliefert wird nur
// inline mit dem erkannten Typ, `no-store` und `nosniff`. Sätze statt Codes:
// Sie für den Kunden, du fürs Office (shared/fiaon-lesefehler.ts).
//
// Warum eine Datei je Anfrage: 50 MB je Datei (Entscheidung Justin 08.10.) —
// zehn auf einmal wären 500 MB in einer Anfrage, und vor Render sitzt
// Cloudflare: Über ~100 MB endete eine Anfrage dort mit einem HTML-413, und der
// Kunde las „Der Upload hat nicht geklappt". Der Browser schickt die Dateien
// nacheinander, jede mit eigenem Balken.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { sqlPool } from "../lib/db-pool";
import { fensterDrossel } from "../lib/fiaon-global-bereich-regeln";
import { UNTERLAGEN_GRENZEN, istUnterlagenKategorie, kategorieInfo, type UnterlagenKategorie } from "@shared/fiaon-unterlagen";
import { lesefehlerSatz } from "@shared/fiaon-lesefehler";
import {
  unterlagenStand, unterlageHinzufuegen, unterlageEntfernen, kategorieGeprueft, sofortLesen, dateiLesen,
  personZuRef, abgewiesenMerken, inhaltErlaubt, traegerRef, unterlageEndgueltigLoeschen, type Handelnder,
} from "../lib/fiaon-unterlagen";
import { istLeitungsRolle } from "../lib/fiaon-geburtsdatum-akte";

const router = Router();

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

// ── Drossel (Kundenweg): 30 Dateien je zehn Minuten je Person und je Adresse ──
const jeRef = fensterDrossel(UNTERLAGEN_GRENZEN.uploadsJeZehnMinuten, 10 * 60_000);
const jeIp = fensterDrossel(UNTERLAGEN_GRENZEN.uploadsJeZehnMinuten * 2, 10 * 60_000);
const ZU_VIEL = "Das waren gerade sehr viele Dateien in kurzer Zeit. Bitte warten Sie einige Minuten und laden Sie dann den Rest hoch.";

// ── EINE Datei, auf die Platte ───────────────────────────────────────────────
const einzeln = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _f, cb) => cb(null, `fiaon-unterlage-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: UNTERLAGEN_GRENZEN.bytesJeDatei, files: 1, fields: 8, parts: 10, fieldSize: 4096 },
}).single("datei");

/** Größe VOR multer prüfen, multer mit Sätzen statt Fehlercodes — `anrede` entscheidet Sie oder du. */
function dateiAnnehmen(anrede: "sie" | "du") {
  return (req: Request, res: Response, next: NextFunction) => {
    const grenze = UNTERLAGEN_GRENZEN.bytesJeDatei + UNTERLAGEN_GRENZEN.anfrageReserveBytes;
    const laenge = Number(req.headers["content-length"]);
    const zuGross = () => lesefehlerSatz("zu_gross", anrede, { mb: UNTERLAGEN_GRENZEN.mbJeDatei });
    if (Number.isFinite(laenge) && laenge > grenze) {
      void abgewiesenAnfrage(req, "zu_gross", laenge);
      res.setHeader("Connection", "close");
      return res.status(413).json({ ok: false, klasse: "zu_gross", error: zuGross() });
    }
    if (!Number.isFinite(laenge)) {
      // Ohne Content-Length (chunked): mitzählen und hart abbrechen, sobald es zu viel wird.
      let gelesen = 0;
      req.on("data", (c: Buffer) => { gelesen += c.length; if (gelesen > grenze) req.destroy(new Error("ZU_GROSS")); });
    }
    einzeln(req, res, (err: any) => {
      if (!err) return next();
      aufraeumen(req);
      if (res.headersSent || req.destroyed) return;
      if (err.code === "LIMIT_FILE_SIZE") { void abgewiesenAnfrage(req, "zu_gross", laenge); return res.status(413).json({ ok: false, klasse: "zu_gross", error: zuGross() }); }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ ok: false, error: anrede === "sie" ? "Bitte laden Sie die Dateien einzeln hoch — eine je Schritt." : "Eine Datei je Anfrage, im Feld „datei“." });
      }
      return res.status(400).json({ ok: false, error: anrede === "sie" ? "Die Datei konnte nicht angenommen werden. Bitte versuchen Sie es noch einmal." : "Die Datei konnte nicht angenommen werden." });
    });
  };
}

function aufraeumen(req: Request): void {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (f?.path) fs.promises.unlink(f.path).catch(() => {});
}

/** Abgewiesen, bevor die Datei gelesen war — mit der Person, wenn sie bekannt ist. */
async function abgewiesenAnfrage(req: Request, klasse: string, bytes: number): Promise<void> {
  try {
    const personId = (req as any).unterlagenPerson as number | undefined;
    const kat = String(req.params?.kategorie || "?");
    if (personId) await abgewiesenMerken(personId, klasse, kat, Number.isFinite(bytes) ? bytes : 0);
  } catch { /* das Protokoll darf nichts aufhalten */ }
}

async function dateiAus(req: Request): Promise<{ buffer: Buffer; name: string } | null> {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f?.path) return null;
  try {
    return { buffer: await fs.promises.readFile(f.path), name: String(f.originalname || "Datei") };
  } finally {
    aufraeumen(req);
  }
}

/** Nur inline, mit dem ERKANNTEN Typ, nie zwischengespeichert. */
function dateiSenden(res: Response, d: { inhalt: Buffer; mime: string; dateiname: string }): void {
  const sauber = d.dateiname.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "datei";
  res.setHeader("Content-Type", d.mime);
  res.setHeader("Content-Disposition", `inline; filename="${sauber}"; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
  res.setHeader("Content-Length", String(d.inhalt.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(d.inhalt);
}

const kategorieAus = (req: Request): UnterlagenKategorie | null => {
  const k = String(req.params.kategorie || "").toLowerCase();
  return istUnterlagenKategorie(k) ? k : null;
};

// ═══ DER KUNDE ═══════════════════════════════════════════════════════════════
async function kundePerson(req: KundeRequest, res: Response): Promise<number | null> {
  const personId = await personZuRef(req.kundeRef!);
  if (!personId) {
    // Ein Zustand, den die Seite zeichnet — kein Fehler.
    res.json({ ok: false, grund: "keine_person", text: "Ihre Akte wird gerade mit Ihrer Person verknüpft. Bitte versuchen Sie es in einigen Minuten noch einmal — oder schicken Sie die Unterlage Ihrem Ansprechpartner." });
    return null;
  }
  return personId;
}

router.get("/kunde/:ref/unterlagen", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const personId = await kundePerson(req, res);
    if (!personId) return;
    res.json({ ok: true, stand: await unterlagenStand(personId, "kunde") });
  } catch (err) {
    console.error("[UNTERLAGEN] kunde stand:", err);
    res.status(500).json({ ok: false, error: "Ihre Unterlagen lassen sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

router.post("/kunde/:ref/unterlagen/:kategorie", requireKunde, async (req: KundeRequest, res: Response, next: NextFunction) => {
  // Erst der Zutritt (requireKunde), dann Kategorie und Drossel, DANN der Körper.
  if (!kategorieAus(req)) return res.status(400).json({ ok: false, error: "Diese Unterlage gibt es nicht." });
  const personId = await personZuRef(req.kundeRef!).catch(() => null);
  if (!personId) return res.status(409).json({ ok: false, error: "Ihre Akte wird gerade mit Ihrer Person verknüpft. Bitte versuchen Sie es in einigen Minuten noch einmal." });
  (req as any).unterlagenPerson = personId;
  if (jeRef(String(personId)) || jeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
  next();
}, dateiAnnehmen("sie"), async (req: KundeRequest, res: Response) => {
  try {
    const k = kategorieAus(req)!;
    const personId = (req as any).unterlagenPerson as number;
    const datei = await dateiAus(req);
    if (!datei) return res.status(400).json({ ok: false, error: "Es kam keine Datei an. Bitte wählen Sie die Datei noch einmal aus." });
    const wer: Handelnder = { art: "kunde", name: "Kunde" };
    const erg = await unterlageHinzufuegen({ personId, kategorie: k, unterart: req.body?.unterart, notiz: req.body?.notiz, datei, wer, herkunft: "portal" });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, klasse: erg.klasse, error: erg.satzKunde });
    res.json({ ok: true, doppelt: !!erg.doppelt, datei: erg.datei, satz: erg.satzKunde, stand: await unterlagenStand(personId, "kunde") });
  } catch (err) {
    aufraeumen(req);
    console.error("[UNTERLAGEN] kunde hochladen:", err);
    res.status(500).json({ ok: false, error: "Die Datei konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

router.get("/kunde/:ref/unterlagen/datei/:id", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const personId = await personZuRef(req.kundeRef!);
    if (!personId) return res.status(404).json({ ok: false, error: "Diese Datei gibt es nicht." });
    // Nur aktive Dateien — eine vom Team entfernte (z. B. „falsche Person“) bleibt für den Kunden zu.
    const d = await dateiLesen(personId, Number(req.params.id), sqlPool, { nurAktiv: true });
    if (!d) return res.status(404).json({ ok: false, error: "Diese Datei gibt es nicht." });
    dateiSenden(res, d);
  } catch (err) {
    console.error("[UNTERLAGEN] kunde datei:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Die Datei lässt sich gerade nicht öffnen." });
  }
});

router.post("/kunde/:ref/unterlagen/datei/:id/entfernen", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const personId = await personZuRef(req.kundeRef!);
    if (!personId) return res.status(404).json({ ok: false, error: "Diese Datei gibt es nicht." });
    const erg = await unterlageEntfernen(personId, Number(req.params.id), { art: "kunde", name: "Kunde" }, "vom Kunden im Kundenbereich entfernt");
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, satz: erg.satz, stand: await unterlagenStand(personId, "kunde") });
  } catch (err) {
    console.error("[UNTERLAGEN] kunde entfernen:", err);
    res.status(500).json({ ok: false, error: "Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal." });
  }
});

// ═══ DAS OFFICE ══════════════════════════════════════════════════════════════
async function officeZutritt(req: AgentRequest, res: Response): Promise<{ personId: number; rolle: string; wer: Handelnder } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isFinite(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Person fehlt." }); return null; }
  // E-IT-C Nachbesserung: Eine zusammengeführte Person (alter Link, alte Akte) bekommt keine Dateien mehr —
  // sie landeten sonst als Waisen-Zeile ohne Bestellung, außerhalb der Akte des Gewinners.
  const [p] = (await sqlPool`SELECT merged_into_person_id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  if (p?.merged_into_person_id != null) {
    res.status(409).json({ ok: false, error: `Dieser Kunde wurde zusammengeführt (jetzt Person ${p.merged_into_person_id}) — bitte die Akte des Kunden öffnen.` });
    return null;
  }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Nicht dein Kunde." }); return null; }
  return { personId, rolle, wer: { art: "mitarbeiter", name: req.agent!.name, agentId: req.agent!.id } };
}

router.get("/agent/unterlagen/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await officeZutritt(req, res);
    if (!z) return;
    // Wer den Kunden betreut, öffnet seine Unterlagen (18.09.2026) — wie die Akte.
    // Querprüfung 08.10.2026: Die Leitung darf eine entfernte Datei endgültig löschen.
    res.json({ ok: true, stand: { ...(await unterlagenStand(z.personId, "office")), inhaltErlaubt: inhaltErlaubt(z.rolle, true), darfEndgueltig: istLeitungsRolle(z.rolle) } });
  } catch (err) {
    console.error("[UNTERLAGEN] office stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/unterlagen/:personId/:kategorie", requireAgent, async (req: AgentRequest, res: Response, next: NextFunction) => {
  if (!kategorieAus(req)) return res.status(400).json({ ok: false, error: "Unbekannte Unterlage." });
  const z = await officeZutritt(req, res);
  if (!z) return;
  (req as any).unterlagenZutritt = z;
  (req as any).unterlagenPerson = z.personId;
  next();
}, dateiAnnehmen("du"), async (req: AgentRequest, res: Response) => {
  try {
    const z = (req as any).unterlagenZutritt as { personId: number; wer: Handelnder };
    const k = kategorieAus(req)!;
    const datei = await dateiAus(req);
    if (!datei) return res.status(400).json({ ok: false, error: "Es wurde keine Datei mitgeschickt." });
    const ersetzen = String(req.body?.ersetzen || "") === "1";
    const grund = String(req.body?.grund || "").trim();
    if (ersetzen && grund.length < 5) return res.status(400).json({ ok: false, error: "„Alles ersetzen“ braucht einen kurzen Grund — er steht im Verlauf." });
    // 25.08.2026: Ein Ausweis gehört dem Menschen, nicht seiner Bestellung — fehlt die Akte, wird sie angelegt.
    if (!(await traegerRef(z.personId))) {
      const { sorgeFuerAkte } = await import("../lib/fiaon-akte-anker");
      await sorgeFuerAkte(z.personId, req.agent!.id);
      // Ohne Bestellung keine Ablage — sonst entstünde eine Datei, die keine Akte trägt.
      if (!(await traegerRef(z.personId))) return res.status(409).json({ ok: false, error: "Zu diesem Kunden gibt es keine Akte (Bestellung) — bitte die Akte über die Kundensuche öffnen." });
    }
    const erg = await unterlageHinzufuegen({
      personId: z.personId, kategorie: k, unterart: req.body?.unterart, notiz: req.body?.notiz, datei, wer: z.wer, herkunft: "mitarbeiter",
      ersetzen: ersetzen ? { grund } : null,
    });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, klasse: erg.klasse, error: erg.satzOffice });
    res.json({ ok: true, doppelt: !!erg.doppelt, datei: erg.datei, meldung: erg.satzOffice, stand: await unterlagenStand(z.personId, "office") });
  } catch (err) {
    aufraeumen(req);
    console.error("[UNTERLAGEN] office hochladen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/unterlagen/:personId/datei/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await officeZutritt(req, res);
    if (!z) return;
    const d = await dateiLesen(z.personId, Number(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: "Diese Datei gibt es nicht (mehr) — was der Kunde selbst entfernt hat, ist gelöscht." });
    const label = istUnterlagenKategorie(d.kategorie) ? kategorieInfo(d.kategorie).kurz : d.kategorie;
    if (d.ref) {
      await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                    VALUES (${d.ref}, ${z.personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                            ${`Dokument geöffnet: ${label} „${d.dateiname}“ (von ${req.agent!.name}).`}, NOW())`.catch(() => {});
    }
    dateiSenden(res, d);
  } catch (err) {
    console.error("[UNTERLAGEN] office datei:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/unterlagen/:personId/datei/:id/entfernen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await officeZutritt(req, res);
    if (!z) return;
    // Querprüfung 08.10.2026: Grund-Art („falsche_person“/„nicht_benoetigt“ leert sofort, „veraltet“ Archiv mit Frist).
    const erg = await unterlageEntfernen(z.personId, Number(req.params.id), z.wer, String(req.body?.grund || ""), sqlPool, { grundArt: req.body?.grundArt ?? null });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: { ...(await unterlagenStand(z.personId, "office")), inhaltErlaubt: inhaltErlaubt(z.rolle, true), darfEndgueltig: istLeitungsRolle(z.rolle) } });
  } catch (err) {
    console.error("[UNTERLAGEN] office entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Querprüfung 08.10.2026: Inhalt einer ENTFERNTEN Datei endgültig löschen — nur die Leitung, mit Grund und Verlauf. */
router.post("/agent/unterlagen/:personId/datei/:id/endgueltig", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await officeZutritt(req, res);
    if (!z) return;
    if (!istLeitungsRolle(z.rolle)) return res.status(403).json({ ok: false, error: "Endgültig löschen darf nur die Leitung." });
    const erg = await unterlageEndgueltigLoeschen(z.personId, Number(req.params.id), z.wer, String(req.body?.grund || ""));
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: { ...(await unterlagenStand(z.personId, "office")), inhaltErlaubt: inhaltErlaubt(z.rolle, true), darfEndgueltig: true } });
  } catch (err) {
    console.error("[UNTERLAGEN] office endgültig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/unterlagen/:personId/:kategorie/geprueft", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const k = kategorieAus(req);
    if (!k) return res.status(400).json({ ok: false, error: "Unbekannte Unterlage." });
    const z = await officeZutritt(req, res);
    if (!z) return;
    const erg = await kategorieGeprueft(z.personId, k, z.wer);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: await unterlagenStand(z.personId, "office") });
  } catch (err) {
    console.error("[UNTERLAGEN] office geprüft:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/unterlagen/:personId/:kategorie/neu-lesen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const k = kategorieAus(req);
    if (!k || k === "weitere") return res.status(400).json({ ok: false, error: "Diese Unterlage wird nicht automatisch gelesen." });
    const z = await officeZutritt(req, res);
    if (!z) return;
    const erg = await sofortLesen(z.personId, k, z.wer);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz });
  } catch (err) {
    console.error("[UNTERLAGEN] office neu lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══ DIE CHEFBÜRO-AKTE (hinter dem Admin-Code, wie /admin/dokumente/:ref) ═════
const VERWALTUNG: Handelnder = { art: "verwaltung", name: "Verwaltung" };
async function adminPerson(req: Request, res: Response): Promise<number | null> {
  const personId = await personZuRef(String(req.params.ref || ""));
  if (!personId) { res.status(404).json({ ok: false, error: "Zu dieser Bestellung gibt es keine Person." }); return null; }
  return personId;
}

router.get("/admin/unterlagen/:ref", async (req: Request, res: Response) => {
  try {
    const personId = await adminPerson(req, res);
    if (!personId) return;
    res.json({ ok: true, stand: { ...(await unterlagenStand(personId, "office")), inhaltErlaubt: true, darfEndgueltig: true } });
  } catch (err) {
    console.error("[UNTERLAGEN] admin stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/unterlagen/:ref/:kategorie", async (req: Request, res: Response, next: NextFunction) => {
  if (!kategorieAus(req)) return res.status(400).json({ ok: false, error: "Unbekannte Unterlage." });
  const personId = await adminPerson(req, res).catch(() => null);
  if (!personId) return;
  (req as any).unterlagenPerson = personId;
  next();
}, dateiAnnehmen("du"), async (req: Request, res: Response) => {
  try {
    const personId = (req as any).unterlagenPerson as number;
    const k = kategorieAus(req)!;
    const datei = await dateiAus(req);
    if (!datei) return res.status(400).json({ ok: false, error: "Es wurde keine Datei mitgeschickt." });
    const ersetzen = String(req.body?.ersetzen || "") === "1";
    const grund = String(req.body?.grund || "").trim();
    if (ersetzen && grund.length < 5) return res.status(400).json({ ok: false, error: "„Alles ersetzen“ braucht einen kurzen Grund — er steht im Verlauf." });
    const erg = await unterlageHinzufuegen({ personId, kategorie: k, unterart: req.body?.unterart, notiz: req.body?.notiz, datei, wer: VERWALTUNG, herkunft: "verwaltung", ersetzen: ersetzen ? { grund } : null });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, klasse: erg.klasse, error: erg.satzOffice });
    res.json({ ok: true, doppelt: !!erg.doppelt, datei: erg.datei, meldung: erg.satzOffice, stand: await unterlagenStand(personId, "office") });
  } catch (err) {
    aufraeumen(req);
    console.error("[UNTERLAGEN] admin hochladen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/unterlagen/:ref/datei/:id", async (req: Request, res: Response) => {
  try {
    const personId = await adminPerson(req, res);
    if (!personId) return;
    const d = await dateiLesen(personId, Number(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: "Diese Datei gibt es nicht (mehr) — was der Kunde selbst entfernt hat, ist gelöscht." });
    dateiSenden(res, d);
  } catch (err) {
    console.error("[UNTERLAGEN] admin datei:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/unterlagen/:ref/datei/:id/entfernen", async (req: Request, res: Response) => {
  try {
    const personId = await adminPerson(req, res);
    if (!personId) return;
    const erg = await unterlageEntfernen(personId, Number(req.params.id), VERWALTUNG, String(req.body?.grund || ""), sqlPool, { grundArt: req.body?.grundArt ?? null });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: { ...(await unterlagenStand(personId, "office")), inhaltErlaubt: true, darfEndgueltig: true } });
  } catch (err) {
    console.error("[UNTERLAGEN] admin entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Querprüfung 08.10.2026: Chefbüro-Akte (hinter dem Admin-Code = Leitung) — Inhalt einer entfernten Datei endgültig löschen. */
router.post("/admin/unterlagen/:ref/datei/:id/endgueltig", async (req: Request, res: Response) => {
  try {
    const personId = await adminPerson(req, res);
    if (!personId) return;
    const erg = await unterlageEndgueltigLoeschen(personId, Number(req.params.id), VERWALTUNG, String(req.body?.grund || ""));
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: { ...(await unterlagenStand(personId, "office")), inhaltErlaubt: true, darfEndgueltig: true } });
  } catch (err) {
    console.error("[UNTERLAGEN] admin endgültig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/unterlagen/:ref/:kategorie/geprueft", async (req: Request, res: Response) => {
  try {
    const k = kategorieAus(req);
    if (!k) return res.status(400).json({ ok: false, error: "Unbekannte Unterlage." });
    const personId = await adminPerson(req, res);
    if (!personId) return;
    const erg = await kategorieGeprueft(personId, k, VERWALTUNG);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz, stand: await unterlagenStand(personId, "office") });
  } catch (err) {
    console.error("[UNTERLAGEN] admin geprüft:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/unterlagen/:ref/:kategorie/neu-lesen", async (req: Request, res: Response) => {
  try {
    const k = kategorieAus(req);
    if (!k || k === "weitere") return res.status(400).json({ ok: false, error: "Diese Unterlage wird nicht automatisch gelesen." });
    const personId = await adminPerson(req, res);
    if (!personId) return;
    const erg = await sofortLesen(personId, k, VERWALTUNG);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.satz });
    res.json({ ok: true, meldung: erg.satz });
  } catch (err) {
    console.error("[UNTERLAGEN] admin neu lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
