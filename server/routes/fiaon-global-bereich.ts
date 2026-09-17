// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ROUTEN ZU „MEIN AUFTRAG" (17.09.2026, E-188)
//
// Zwei Türen, eine Akte (die Logik liegt in server/lib/fiaon-global-bereich.ts,
// die Texte in shared/fiaon-global-bereich.ts):
//
//   · /global/mein-auftrag/… und /global/zugang — der Kunde, ohne Anmeldung.
//     Der Zugang ist dasselbe signierte Token wie beim Auftrag (`?t=`, an die
//     Antragsnummer gebunden, 30 Tage). 403 = ungültig, 410 = abgelaufen — dann
//     bietet die Seite „Zugang neu anfordern" (POST /global/zugang, antwortet
//     immer gleich). Token und Nummer werden im Zugriffslog maskiert, Antworten
//     dieser Pfade nie mitgeschrieben (server/index.ts).
//
//   · /agent/global/… — das Office, hinter requireAgent. An einen Auftrag darf
//     die ZUSTÄNDIGE Person, die Vertriebsleitung und wer zusätzlich als Chef
//     (E-053/E-155) oder Verwaltung ausgewiesen ist; alle anderen bekommen 403 —
//     auch lesend (globalOfficeZugriff in fiaon-global-bereich-regeln.ts). Die
//     Ansichts-Sitzung eines Vorgesetzten schreibt nie (nurLesenWand in routes.ts;
//     hier zusätzlich geprüft, wie in fiaon-app-antraege.ts).
//
// ── DATEIEN ───────────────────────────────────────────────────────────────
// Hausmuster für Uploads (fiaon-app-antraege.ts, fiaon-antrag.ts): multer im
// Arbeitsspeicher, feste Obergrenzen, deutsche Sätze statt Multer-Englisch.
// Der ZUTRITT wird geprüft, BEVOR multer den Körper liest — wer kein gültiges
// Token hat, lädt keine 15 MB in den Speicher. Den Typ bestimmt der Inhalt, nie
// die Behauptung des Browsers; ausgeliefert wird nur inline, mit dem erkannten
// Typ, `no-store` und `nosniff`.
//
// Antworten an den Kunden: Sätze in Sie-Form (deutsch oder englisch nach der
// Sprache des Auftrags). Antworten ans Office: Du-Form.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { readChef } from "./fiaon-chef-zugang";
import { hasAdminCode } from "./fiaon-admin-zugang";
import { globalTokenPruefen, globalVertragPdfLesen, globalRechnungPdf } from "../lib/fiaon-global-auftrag";
import {
  globalBereichKundenSicht, globalBereichOfficeSicht, globalBereichListe, globalBereichZustaendig, globalKundenDokument, globalOfficeDokument,
  globalDokumentLesen, globalDokumentEntfernen, globalKundenNachricht, globalZugangAnfordern, globalEtappeSetzen, globalNaechsterSchrittSetzen,
  globalGesellschaftSetzen, globalFristAnlegen, globalFristAendern, globalFristLoeschen, globalNotizSchreiben, globalBereichStichtag,
  globalZugangSenden, globalAbschliessen, globalBereichRaumLage, type BereichAgent, type DateiEin,
} from "../lib/fiaon-global-bereich";
import {
  GLOBAL_DATEI_MAX_BYTES, fensterDrossel, globalDateinameKopf, globalMimeAuslieferbar, globalOfficeRaumZugriff, globalOfficeSiehtAlle, globalOfficeZugriff,
} from "../lib/fiaon-global-bereich-regeln";

const router = Router();

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

// ── Zutritt des Kunden ───────────────────────────────────────────────────────
/** Token aus `?t=` prüfen — und bei einem Fehler gleich die Antwort schreiben. `code` sagt der Seite, was sie anbieten soll. */
function zutritt(req: Request, res: Response): string | null {
  const ref = String(req.params.ref || "").trim();
  const urteil = globalTokenPruefen(ref, req.query.t);
  res.setHeader("Cache-Control", "private, no-store");
  if (!urteil) { res.status(403).json({ ok: false, code: "ungueltig", error: "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus Ihrer letzten E-Mail von FIAON Global — oder fordern Sie mit Ihrer E-Mail-Adresse einen neuen an." }); return null; }
  if (urteil === "abgelaufen") { res.status(410).json({ ok: false, code: "abgelaufen", error: "Dieser Link ist abgelaufen. Fordern Sie mit Ihrer E-Mail-Adresse einen neuen an — er kommt sofort per E-Mail." }); return null; }
  return ref;
}

// ── Drosseln (im Arbeitsspeicher der Instanz, wie jede Drossel im Haus) ──────
const uploadJeRef = fensterDrossel(20, 10 * 60_000);
const uploadJeIp = fensterDrossel(30, 10 * 60_000);
const nachrichtJeRef = fensterDrossel(5, 10 * 60_000);
const nachrichtJeIp = fensterDrossel(10, 10 * 60_000);
const ZU_VIEL = "Das waren gerade viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten noch einmal.";

// ── Upload: EINE Datei, im Arbeitsspeicher, bis 15 MB ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: GLOBAL_DATEI_MAX_BYTES, files: 1, fields: 8, parts: 12 },
}).fields([{ name: "datei", maxCount: 1 }, { name: "file", maxCount: 1 }]);

/** multer mit Sätzen statt Fehlercodes — `anrede` entscheidet über Sie oder du. */
function dateiAnnehmen(anrede: "sie" | "du") {
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: any) => {
      if (!err) return next();
      const sie = anrede === "sie";
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ ok: false, error: sie ? "Die Datei ist größer als 15 MB. Bitte speichern Sie sie kleiner oder teilen Sie sie auf." : "Die Datei ist größer als 15 MB." });
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ ok: false, error: sie ? "Bitte laden Sie die Dateien einzeln hoch — eine je Schritt." : "Bitte eine Datei je Schritt hochladen." });
      return res.status(400).json({ ok: false, error: sie ? "Die Datei konnte nicht angenommen werden. Bitte versuchen Sie es noch einmal." : "Die Datei konnte nicht angenommen werden." });
    });
  };
}
function dateiAus(req: Request): DateiEin | null {
  const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
  const f = files?.datei?.[0] ?? files?.file?.[0];
  return f?.buffer ? { buffer: f.buffer, originalname: String(f.originalname || "") } : null;
}

/** Nur inline, mit dem ERKANNTEN Typ, nie zwischengespeichert, nie neu geraten. */
function dateiSenden(res: Response, d: { inhalt: Buffer; mime: string; dateiname: string }) {
  const typ = globalMimeAuslieferbar(d.mime);
  if (!typ) return res.status(415).json({ ok: false, error: "Dieses Dokument lässt sich nicht anzeigen." });
  res.setHeader("Content-Type", typ);
  res.setHeader("Content-Disposition", `inline; filename="${globalDateinameKopf(d.dateiname)}"; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
  res.setHeader("Content-Length", String(d.inhalt.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(d.inhalt);
}
function pdfSenden(res: Response, pdf: Buffer, dateiname: string) {
  dateiSenden(res, { inhalt: pdf, mime: "application/pdf", dateiname });
}

// ═══ DER KUNDE ═══════════════════════════════════════════════════════════════
router.get("/global/mein-auftrag/:ref", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const auftrag = await globalBereichKundenSicht(ref, String(req.query.t));
    if (!auftrag) return res.status(404).json({ ok: false, error: "Wir finden zu diesem Link keinen Auftrag." });
    res.json({ ok: true, auftrag });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] mein-auftrag:", err);
    res.status(500).json({ ok: false, error: "Ihr Auftrag lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

router.post("/global/mein-auftrag/:ref/dokument", (req: Request, res: Response, next: NextFunction) => {
  // Erst der Zutritt, dann die Drossel, DANN der Körper.
  const ref = zutritt(req, res);
  if (!ref) return;
  if (uploadJeRef(ref) || uploadJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
  next();
}, dateiAnnehmen("sie"), async (req: Request, res: Response) => {
  try {
    const erg = await globalKundenDokument(String(req.params.ref).trim(), { art: req.body?.art, datei: dateiAus(req) });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, dokument: erg.dokument });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] dokument hochladen:", err);
    res.status(500).json({ ok: false, error: "Das Dokument konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

router.get("/global/mein-auftrag/:ref/dokument/:id", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const d = await globalDokumentLesen(ref, req.params.id, "kunde");
    if (!d) return res.status(404).json({ ok: false, error: "Dieses Dokument gibt es nicht." });
    dateiSenden(res, d);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] dokument lesen:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Das Dokument lässt sich gerade nicht laden." });
  }
});

router.post("/global/mein-auftrag/:ref/nachricht", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (nachrichtJeRef(ref) || nachrichtJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const erg = await globalKundenNachricht(ref, { text: req.body?.text, art: req.body?.art });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung, ...(erg.dokument ? { dokument: erg.dokument } : {}) });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] nachricht:", err);
    res.status(500).json({ ok: false, error: "Ihre Nachricht konnte gerade nicht zugestellt werden — bitte versuchen Sie es in einer Minute noch einmal." });
  }
});

/** Antwortet IMMER gleich — wer fragt, erfährt nicht, ob es zu einer Adresse einen Auftrag gibt. Honigtopf: Feld `falle`. */
router.post("/global/zugang", (req: Request, res: Response) => {
  try {
    if (!String(req.body?.falle ?? "").trim()) globalZugangAnfordern(req.body?.email, clientIp(req));
  } catch (err) {
    console.error("[GLOBAL-BEREICH] zugang:", err);
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true });
});

// ═══ DAS OFFICE ══════════════════════════════════════════════════════════════
/**
 * Wer fragt? Der angemeldete Mitarbeiter (requireAgent) — dazu, ob derselbe Browser zusätzlich als
 * Chef (E-053/E-155) oder Verwaltung ausgewiesen ist. requireAgent selbst lässt weder Chef-Token noch
 * Verwaltungs-Code ohne Mitarbeiter-Anmeldung durch; die Leitung ohne Office-Konto arbeitet über
 * /chef/s/global-auftraege. In einer ANSICHTS-Sitzung („mit den Augen eines Mitarbeiters") zählen die
 * Ausweise des Betrachters nicht: Er soll sehen, was der Mitarbeiter sieht — nicht mehr.
 */
function wer(req: AgentRequest) {
  const ansicht = !!req.agent?.ansicht;
  return { agentId: req.agent?.id, rolle: req.agent?.rolle, chef: !ansicht && !!readChef(req), adminCode: !ansicht && hasAdminCode(req) };
}

/**
 * Zugriff auf EINEN Auftrag. Wer nicht alle sehen darf, bekommt für fremde und für unbekannte
 * Nummern dieselbe Antwort (403) — eine Antragsnummer lässt sich so nicht erfragen.
 */
async function office(req: AgentRequest, res: Response, schreibt: boolean): Promise<{ ref: string; agent: BereichAgent } | null> {
  const ref = String(req.params.ref || "").trim();
  const person = wer(req);
  const zustaendig = ref ? await globalBereichZustaendig(ref) : undefined;
  const urteil = globalOfficeZugriff(person, zustaendig ?? null);
  if (!urteil.erlaubt) { res.status(403).json({ ok: false, error: "Diesen Auftrag führt jemand anderes. Zugriff haben die zuständige Person und die Leitung." }); return null; }
  if (zustaendig === undefined) { res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." }); return null; }
  if (schreibt && req.agent?.ansicht) { res.status(403).json({ ok: false, error: "In der Ansicht lässt sich nichts ändern." }); return null; }
  return { ref, agent: { id: req.agent!.id, name: req.agent!.name } };
}

/** Die Standardform einer schreibenden Office-Route: Zugriff, Aktion, Antwort. */
function aktion(name: string, tun: (ref: string, body: any, agent: BereichAgent, req: AgentRequest) => Promise<{ ok: true; [k: string]: unknown } | { ok: false; status: number; error: string }>) {
  return async (req: AgentRequest, res: Response) => {
    try {
      const z = await office(req, res, true);
      if (!z) return;
      const erg = await tun(z.ref, req.body ?? {}, z.agent, req);
      if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
      res.json(erg);
    } catch (err) {
      console.error(`[GLOBAL-BEREICH] office ${name}:`, err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  };
}

// Die Office-Leiste entscheidet an DIESER Antwort, ob sie den Raum „Global" zeigt: 403 = ausblenden.
// Eine leere Liste mit 200 bekäme jeder Mitarbeiter — dann sähen alle den Raum (globalOfficeRaumZugriff).
router.get("/agent/global/auftraege", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const person = wer(req);
    const siehtAlle = !!globalOfficeSiehtAlle(person);
    const urteil = globalOfficeRaumZugriff(person, siehtAlle ? { fuehrtAuftraege: false, istEingestellt: false } : await globalBereichRaumLage(req.agent!.id));
    if (!urteil.erlaubt) return res.status(403).json({ ok: false, error: "Dieser Raum gehört der Person, die FIAON Global führt, und der Leitung." });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, alle: urteil.alle, zeilen: await globalBereichListe({ agentId: req.agent!.id, alle: urteil.alle }) });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/global/auftraege/:ref", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const auftrag = await globalBereichOfficeSicht(z.ref);
    if (!auftrag) return res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, auftrag });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office auftrag:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/global/auftraege/:ref/etappe", requireAgent, aktion("etappe", (ref, b, agent) => globalEtappeSetzen(ref, { etappe: b.etappe, text: b.text, mitteilen: b.mitteilen }, agent)));
router.post("/agent/global/auftraege/:ref/naechster-schritt", requireAgent, aktion("naechster-schritt", (ref, b, agent) => globalNaechsterSchrittSetzen(ref, { text: b.text, bis: b.bis }, agent)));
router.post("/agent/global/auftraege/:ref/gesellschaft", requireAgent, aktion("gesellschaft", (ref, b, agent) => globalGesellschaftSetzen(ref, b, agent)));
router.post("/agent/global/auftraege/:ref/frist", requireAgent, aktion("frist", (ref, b, agent) => globalFristAnlegen(ref, { titel: b.titel, faelligAm: b.faelligAm, hinweis: b.hinweis }, agent)));
router.post("/agent/global/auftraege/:ref/frist/:id", requireAgent, aktion("frist ändern", (ref, b, agent, req) => globalFristAendern(ref, req.params.id, b, agent)));
router.delete("/agent/global/auftraege/:ref/frist/:id", requireAgent, aktion("frist löschen", (ref, _b, agent, req) => globalFristLoeschen(ref, req.params.id, agent)));
router.post("/agent/global/auftraege/:ref/notiz", requireAgent, aktion("notiz", (ref, b, agent) => globalNotizSchreiben(ref, { text: b.text, sichtbar: b.sichtbar }, agent)));
router.post("/agent/global/auftraege/:ref/zugang-senden", requireAgent, aktion("zugang-senden", (ref, _b, agent) => globalZugangSenden(ref, agent)));
router.post("/agent/global/auftraege/:ref/abschliessen", requireAgent, aktion("abschliessen", (ref, b, agent) => globalAbschliessen(ref, { text: b.text, mitteilen: b.mitteilen }, agent)));
router.post("/agent/global/auftraege/:ref/stichtag", requireAgent, aktion("stichtag", async (ref, b, agent) => {
  // Dieselbe Funktion wie im Leitungs-Weg (globalStichtagSetzen) — hier mit der Zeile im Verlauf des Kunden.
  const erg = await globalBereichStichtag(ref, b.stichtag, agent.name, b.mitteilen !== false, agent.id);
  return erg.ok ? { ok: true as const, meldung: erg.meldung } : { ok: false as const, status: 400, error: erg.error || "Der Stichtag ließ sich nicht setzen." };
}));

router.post("/agent/global/auftraege/:ref/dokument", requireAgent, async (req: AgentRequest, res: Response, next: NextFunction) => {
  // Erst der Zugriff, dann der Körper.
  try {
    const z = await office(req, res, true);
    if (!z) return;
    (req as any).globalOffice = z;
    next();
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office dokument (Zugriff):", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
}, dateiAnnehmen("du"), async (req: AgentRequest, res: Response) => {
  try {
    const z = (req as any).globalOffice as { ref: string; agent: BereichAgent };
    const wahr = (v: unknown) => v === true || ["true", "1", "on", "ja"].includes(String(v ?? "").trim().toLowerCase());
    const sichtbar = wahr(req.body?.sichtbarFuerKunde);
    const erg = await globalOfficeDokument(z.ref, {
      art: req.body?.art, datei: dateiAus(req), sichtbarFuerKunde: sichtbar,
      mitteilen: sichtbar && (req.body?.mitteilen === undefined ? true : wahr(req.body?.mitteilen)),
    }, z.agent);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json(erg);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office dokument:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/global/auftraege/:ref/dokument/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const d = await globalDokumentLesen(z.ref, req.params.id, "office");
    if (!d) return res.status(404).json({ ok: false, error: "Dieses Dokument gibt es nicht (mehr)." });
    dateiSenden(res, d);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office dokument lesen:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.delete("/agent/global/auftraege/:ref/dokument/:id", requireAgent, aktion("dokument entfernen", (ref, _b, agent, req) => globalDokumentEntfernen(ref, req.params.id, agent)));

// Vertrag und Rechnung für das Office — die Adressen stehen in GET /agent/global/auftraege/:ref.
router.get("/agent/global/auftraege/:ref/vertrag.pdf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const pdf = await globalVertragPdfLesen(z.ref);
    if (!pdf) return res.status(404).json({ ok: false, error: "Zu diesem Auftrag liegt kein unterschriebener Vertrag vor." });
    pdfSenden(res, pdf, `FIAON_Global_Auftrag_${z.ref}.pdf`);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office vertrag.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.get("/agent/global/auftraege/:ref/rechnung.pdf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const r = await globalRechnungPdf(z.ref);
    if (!r) return res.status(404).json({ ok: false, error: "Zu diesem Auftrag liegt keine Rechnung vor." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office rechnung.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
