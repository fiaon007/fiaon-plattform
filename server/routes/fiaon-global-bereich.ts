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
import { globalTokenPruefen, globalTokenErzeugen, globalVertragPdfLesen, globalRechnungPdf, GLOBAL_PORTAL_TAGE, GLOBAL_PORTAL_ERNEUERN_TAGE } from "../lib/fiaon-global-auftrag";
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
/**
 * E-338: Die Leitung öffnet das neue Portal als Vorschau (Link aus Chefbüro › Global mit `vorschau=neu|1`).
 * Gilt NUR mit gültiger Chefbüro-Anmeldung im selben Browser — ein Kunde, der das Wort an seinen Link hängt,
 * bekommt nichts anderes. In der Vorschau wird nichts als „vom Kunden gelesen" vermerkt.
 */
function istVorschau(req: Request): boolean {
  const v = String(req.query.vorschau ?? "");
  return (v === "neu" || v === "1") && (!!readChef(req) || hasAdminCode(req));
}

const unterschriftJeRef = fensterDrossel(10, 10 * 60_000);
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
  // Die Adresse des Kunden-Downloads trägt das Token (?t=). Ein Link IN einem PDF darf sie nicht als Referer weiterreichen.
  res.setHeader("Referrer-Policy", "no-referrer");
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
    // E-332: Läuft der Link in weniger als GLOBAL_PORTAL_ERNEUERN_TAGE ab, gibt der Besuch einen frischen (ein Jahr) aus —
    // die Seite setzt ihn in die Adresse. So bleibt das Portal offen, solange der Kunde es wenigstens alle paar Monate öffnet.
    const tag = 24 * 60 * 60 * 1000;
    const exp = Number(String(req.query.t ?? "").split(".")[0]);
    const zugang = Number.isFinite(exp) && exp - Date.now() < GLOBAL_PORTAL_ERNEUERN_TAGE * tag ? globalTokenErzeugen(ref, GLOBAL_PORTAL_TAGE * tag) : null;
    const auftrag = await globalBereichKundenSicht(ref, zugang ?? String(req.query.t));
    if (!auftrag) return res.status(404).json({ ok: false, error: "Wir finden zu diesem Link keinen Auftrag." });
    // E-338: das NEUE Portal — für diesen Kunden freigeschaltet, oder die Leitung sieht die Vorschau (?vorschau=neu + Chefbüro-Anmeldung).
    const vorschau = istVorschau(req);
    const { globalPortalNeuFrei, globalMandatKundenZusatz } = await import("../lib/fiaon-global-mandat");
    if (vorschau || await globalPortalNeuFrei(ref)) {
      Object.assign(auftrag, await globalMandatKundenZusatz(ref, zugang ?? String(req.query.t), (auftrag.sprache as "de" | "en") ?? "de", vorschau));
    }
    res.json({ ok: true, auftrag, ...(zugang && !vorschau ? { zugang } : {}) });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] mein-auftrag:", err);
    res.status(500).json({ ok: false, error: "Ihr Auftrag lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

// E-332: eine Unterlage aus dem Individualangebot — derselbe Zutritt wie das Portal, nie zwischengespeichert, nie indexiert.
router.get("/global/mein-auftrag/:ref/unterlage/:id", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noimageindex");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const id = Number(req.params.id);
    const { unterlageDateiFuerAuftrag } = await import("../lib/fiaon-global-angebot-unterlagen");
    const d = Number.isInteger(id) && id > 0 ? await unterlageDateiFuerAuftrag(ref, id) : null;
    if (!d) return res.status(404).json({ ok: false, error: "Diese Unterlage gibt es nicht." });
    const name = d.dateiname.replace(/["\\\r\n]/g, "");
    const ascii = name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim() || "Unterlage";
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Type", d.mime);
    res.setHeader("Content-Length", String(d.daten.length));
    res.setHeader("Content-Disposition", `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.end(d.daten);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] unterlage:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Die Unterlage lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

router.post("/global/mein-auftrag/:ref/dokument", (req: Request, res: Response, next: NextFunction) => {
  // Erst der Zutritt, dann die Drossel, DANN der Körper.
  const ref = zutritt(req, res);
  if (!ref) return;
  if (istVorschau(req)) return res.status(409).json({ ok: false, error: "Vorschau — hochladen kann hier nur der Kunde." });
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
    // E-338: geöffnet = gelesen (Post, Antworten-Anhänge, Unterschriften) — nie in der Vorschau der Leitung.
    if (!istVorschau(req)) {
      const { globalKundeHatGelesen } = await import("../lib/fiaon-global-mandat");
      await globalKundeHatGelesen(ref, { dokument: Number(req.params.id) }).catch(() => {});
    }
    dateiSenden(res, d);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] dokument lesen:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Das Dokument lässt sich gerade nicht laden." });
  }
});

// ── E-341: DIE FACHBEREICHE (Strategie & Wachstum · Recht & Verträge · Steuern & Pflichten) ──
const fachJeIp = fensterDrossel(40, 10 * 60_000);
router.get("/global/mein-auftrag/:ref/fach", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const v = istVorschau(req);
    const F = await import("../lib/fiaon-global-fach");
    const [vorbelegung, strategie, recht, steuern] = await Promise.all([
      F.fachVorbelegung(ref), F.fachChatVerlauf(ref, "strategie", v), F.fachChatVerlauf(ref, "recht", v), F.fachChatVerlauf(ref, "steuern", v),
    ]);
    res.json({ ok: true, vorbelegung, chats: { strategie, recht, steuern } });
  } catch (err) {
    console.error("[GLOBAL-FACH] lesen:", err);
    res.status(500).json({ ok: false, error: "Dieser Bereich lässt sich gerade nicht laden." });
  }
});
router.post("/global/mein-auftrag/:ref/fach/chat", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (fachJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const { fachChat } = await import("../lib/fiaon-global-fach");
    const erg = await fachChat(ref, req.body?.bereich, req.body?.frage, istVorschau(req));
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, antwort: erg.antwort, hinweis: erg.hinweis });
  } catch (err) {
    console.error("[GLOBAL-FACH] chat:", err);
    res.status(500).json({ ok: false, error: "Der Assistent ist gerade nicht erreichbar — bitte gleich noch einmal." });
  }
});
/** Vorlage → PDF. Kunde: in den Tresor (JSON). Vorschau der Leitung: das PDF selbst, nichts wird abgelegt. */
router.post("/global/mein-auftrag/:ref/fach/vorlage", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (fachJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const vorschau = istVorschau(req);
    const { fachVorlageErstellen } = await import("../lib/fiaon-global-fach");
    const erg = await fachVorlageErstellen(ref, { vorlage: req.body?.vorlage, werte: req.body?.werte, unterschrift: req.body?.unterschrift }, vorschau);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    if (erg.pdf) return pdfSenden(res, erg.pdf, erg.dateiname);
    res.json({ ok: true, id: erg.id, meldung: erg.meldung });
  } catch (err) {
    console.error("[GLOBAL-FACH] vorlage:", err);
    res.status(500).json({ ok: false, error: "Das Dokument ließ sich gerade nicht erstellen — bitte gleich noch einmal." });
  }
});
router.post("/global/mein-auftrag/:ref/fach/expose", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (fachJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const vorschau = istVorschau(req);
    const { fachExpose } = await import("../lib/fiaon-global-fach");
    const erg = await fachExpose(ref, (req.body ?? {}) as Record<string, unknown>, vorschau);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    if (erg.pdf) return pdfSenden(res, erg.pdf, erg.dateiname);
    res.json({ ok: true, id: erg.id, meldung: erg.meldung });
  } catch (err) {
    console.error("[GLOBAL-FACH] expose:", err);
    res.status(500).json({ ok: false, error: "Das Exposé ließ sich gerade nicht erstellen — bitte gleich noch einmal." });
  }
});
router.post("/global/mein-auftrag/:ref/fach/einzelfall", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (istVorschau(req)) return res.status(409).json({ ok: false, error: "Vorschau — Anfragen schickt hier nur der Kunde." });
    if (nachrichtJeRef(ref) || nachrichtJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const { fachEinzelfall } = await import("../lib/fiaon-global-fach");
    const erg = await fachEinzelfall(ref, req.body?.bereich, req.body?.text);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung });
  } catch (err) {
    console.error("[GLOBAL-FACH] einzelfall:", err);
    res.status(500).json({ ok: false, error: "Ihre Anfrage konnte gerade nicht zugestellt werden — bitte gleich noch einmal." });
  }
});

// E-338: Der Kunde hat die Antworten im Faden gesehen (nie in der Vorschau der Leitung).
router.post("/global/mein-auftrag/:ref/gelesen", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (!istVorschau(req)) {
      const { globalKundeHatGelesen } = await import("../lib/fiaon-global-mandat");
      await globalKundeHatGelesen(ref, "nachrichten");
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] gelesen:", err);
    res.status(500).json({ ok: false });
  }
});

// E-338: Der Kunde unterschreibt ein angefordertes PDF (Vollmacht u. a.). In der Vorschau der Leitung nie.
router.post("/global/mein-auftrag/:ref/unterschrift/:id", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (istVorschau(req)) return res.status(409).json({ ok: false, error: "Vorschau — hier unterschreibt nur der Kunde." });
    if (unterschriftJeRef(ref) || nachrichtJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZU_VIEL });
    const { globalKundeUnterschreibt } = await import("../lib/fiaon-global-mandat");
    const erg = await globalKundeUnterschreibt(ref, req.params.id, {
      name: req.body?.name, bild: req.body?.bild, zustimmung: req.body?.zustimmung,
      ip: clientIp(req), userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung, id: erg.id });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] unterschrift:", err);
    res.status(500).json({ ok: false, error: "Ihre Unterschrift konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ── SCHEIBE 1 „IHR US-BÜRO“ (22.10.2026): ZUSATZDIENSTE PER KLICK ──────────────────
// Der Kunde fügt einen Dienst hinzu: Buchung, Rechnung mit Nummer, Mail mit PDF, Verlauf, Aufgabe
// (server/lib/fiaon-global-zusatz.ts). Wiederholbar — ein zweiter Klick gibt die bestehende Buchung zurück.
// Erst Zutritt, dann Vorschau-Sperre, dann Drossel; in der Vorschau der Leitung entsteht nie eine Buchung.
const zusatzJeRef = fensterDrossel(6, 10 * 60_000);
const zusatzJeIp = fensterDrossel(12, 10 * 60_000);
router.post("/global/mein-auftrag/:ref/zusatz", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const { ZUSATZ_WOERTER } = await import("@shared/fiaon-global-zusatz");
    const en = String(req.body?.sprache ?? "") === "en";
    if (istVorschau(req)) return res.status(409).json({ ok: false, error: ZUSATZ_WOERTER[en ? "en" : "de"].vorschau });
    if (zusatzJeRef(ref) || zusatzJeIp(clientIp(req))) return res.status(429).json({ ok: false, error: ZUSATZ_WOERTER[en ? "en" : "de"].zuViel });
    const { zusatzBuchen } = await import("../lib/fiaon-global-zusatz");
    const erg = await zusatzBuchen(ref, { key: req.body?.key, angabe: req.body?.angabe }, { ip: clientIp(req), userAgent: String(req.headers["user-agent"] || "").slice(0, 300) });
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[GLOBAL-ZUSATZ] buchen:", err);
    res.status(500).json({ ok: false, error: "Der Dienst ließ sich gerade nicht hinzufügen. Bitte versuchen Sie es gleich noch einmal." });
  }
});
router.get("/global/mein-auftrag/:ref/zusatz/:id/rechnung.pdf", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const { zusatzRechnungPdf } = await import("../lib/fiaon-global-zusatz");
    const r = await zusatzRechnungPdf(ref, req.params.id);
    if (!r) return res.status(404).json({ ok: false, error: "Diese Rechnung gibt es nicht." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[GLOBAL-ZUSATZ] rechnung:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Die Rechnung lässt sich gerade nicht laden." });
  }
});

// ── DIE VOLLSTÄNDIGE AKTE (22.10.2026): jede Rechnung, jeder Vertrag, alles als ZIP — derselbe Zutritt wie das Portal ──
async function akteZutritt(req: Request, res: Response): Promise<string | null> {
  const ref = zutritt(req, res);
  if (!ref) return null;
  const { globalPortalNeuFrei } = await import("../lib/fiaon-global-mandat");
  if (!istVorschau(req) && !(await globalPortalNeuFrei(ref))) { res.status(404).json({ ok: false, error: "Nicht gefunden." }); return null; }
  return ref;
}
const zipJeRef = fensterDrossel(6, 10 * 60_000);
router.get("/global/mein-auftrag/:ref/rechnung/:bestell", async (req: Request, res: Response) => {
  try {
    const ref = await akteZutritt(req, res);
    if (!ref) return;
    const { globalAkteRechnungPdf } = await import("../lib/fiaon-global-akte-komplett");
    const r = await globalAkteRechnungPdf(ref, String(req.params.bestell || ""));
    if (!r) return res.status(404).json({ ok: false, error: "Diese Rechnung gibt es nicht." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] akte rechnung:", err);
    res.status(500).json({ ok: false, error: "Die Rechnung lässt sich gerade nicht laden." });
  }
});
router.get("/global/mein-auftrag/:ref/vertrag/:id", async (req: Request, res: Response) => {
  try {
    const ref = await akteZutritt(req, res);
    if (!ref) return;
    const roh = String(req.params.id || "");
    const art = roh === "auftrag" ? "auftrag" as const : Number(roh);
    if (art !== "auftrag" && !(Number.isInteger(art) && art > 0)) return res.status(404).json({ ok: false, error: "Diesen Vertrag gibt es nicht." });
    const { globalAkteVertragPdf } = await import("../lib/fiaon-global-akte-komplett");
    const r = await globalAkteVertragPdf(ref, art);
    if (!r) return res.status(404).json({ ok: false, error: "Diesen Vertrag gibt es nicht." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] akte vertrag:", err);
    res.status(500).json({ ok: false, error: "Der Vertrag lässt sich gerade nicht laden." });
  }
});
router.get("/global/mein-auftrag/:ref/akte.zip", async (req: Request, res: Response) => {
  try {
    const ref = await akteZutritt(req, res);
    if (!ref) return;
    if (zipJeRef(ref) || zipJeRef(`ip:${clientIp(req)}`)) return res.status(429).json({ ok: false, error: "Bitte einen Moment warten und dann noch einmal." });
    res.setHeader("Referrer-Policy", "no-referrer");
    const { globalAkteZip } = await import("../lib/fiaon-global-akte-komplett");
    await globalAkteZip(ref, "kunde", res, { name: "Kunde", agentId: null, vorschau: istVorschau(req) });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] akte zip:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Das hat gerade nicht geklappt — bitte gleich noch einmal." });
  }
});

// Stationen-Editor (22.10.2026): Die ITIN des Kunden im Klartext — nur auf seinen Klick „Anzeigen“ im eigenen Portal
// (derselbe Zutritt wie das Portal), nie zwischengespeichert, gedrosselt. Die Seite zeigt sonst nur die Maske.
const itinJeRef = fensterDrossel(10, 10 * 60_000);
router.post("/global/mein-auftrag/:ref/itin", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (itinJeRef(ref) || itinJeRef(`ip:${clientIp(req)}`)) return res.status(429).json({ ok: false, error: "Bitte einen Moment warten und dann noch einmal." });
    const { globalPortalNeuFrei, globalItinKlartext } = await import("../lib/fiaon-global-mandat");
    if (!istVorschau(req) && !(await globalPortalNeuFrei(ref))) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const itin = await globalItinKlartext(ref, { team: null });
    if (!itin) return res.status(404).json({ ok: false, error: "Für Ihre Gesellschaft ist noch keine ITIN hinterlegt." });
    res.json({ ok: true, itin });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] itin:", err);
    res.status(500).json({ ok: false, error: "Das hat gerade nicht geklappt — bitte gleich noch einmal." });
  }
});

router.post("/global/mein-auftrag/:ref/nachricht", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    if (istVorschau(req)) return res.status(409).json({ ok: false, error: "Vorschau — Nachrichten schreibt hier nur der Kunde." });
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
// ── Stationen-Editor (22.10.2026): dieselben Wege wie im Chefbüro (fiaon-global-mandat.ts) — Status, Werte, Karten ──
router.get("/agent/global/auftraege/:ref/stationen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const { globalStationenSicht } = await import("../lib/fiaon-global-mandat");
    const sicht = await globalStationenSicht(z.ref);
    if (!sicht) return res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, ...sicht });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office stationen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.post("/agent/global/auftraege/:ref/station", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, true);
    if (!z) return;
    const { globalStationSpeichern } = await import("../lib/fiaon-global-mandat");
    const erg = await globalStationSpeichern(z.ref, req.body ?? {}, z.agent);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error, ...(typeof (erg as any).feld === "string" ? { feld: (erg as any).feld } : {}) });
    res.json(erg);
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office station:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.post("/agent/global/auftraege/:ref/itin", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const { globalItinKlartext } = await import("../lib/fiaon-global-mandat");
    res.setHeader("Cache-Control", "private, no-store");
    const itin = await globalItinKlartext(z.ref, { team: z.agent });
    if (!itin) return res.status(404).json({ ok: false, error: "Für diesen Auftrag ist keine ITIN hinterlegt." });
    res.json({ ok: true, itin });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office itin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
// Die vollständige Akte als ZIP — für die zuständige Person und die Leitung (dieselbe Wand wie die Akte).
router.get("/agent/global/auftraege/:ref/akte.zip", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await office(req, res, false);
    if (!z) return;
    const { globalAkteZip } = await import("../lib/fiaon-global-akte-komplett");
    await globalAkteZip(z.ref, "team", res, { name: z.agent.name, agentId: z.agent.id });
  } catch (err) {
    console.error("[GLOBAL-BEREICH] office akte zip:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.post("/agent/global/auftraege/:ref/kapital", requireAgent, aktion("kapital", async (ref, b, agent) => (await import("../lib/fiaon-global-mandat")).globalKapitalSpeichern(ref, b, agent)));
router.delete("/agent/global/auftraege/:ref/kapital/:id", requireAgent, aktion("kapital entfernen", async (ref, _b, agent, req) => (await import("../lib/fiaon-global-mandat")).globalKapitalEntfernen(ref, req.params.id, agent)));
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
    // 22.10.2026 (Stationen-Editor): direkt zur Unterschrift stellen, optional als Pflichtunterlage (z. B. SS-4 an der EIN).
    if (wahr(req.body?.unterschrift) || req.body?.pflichtKey) {
      const { globalDokumentZurUnterschrift } = await import("../lib/fiaon-global-akte-komplett");
      const id = Number((erg as any).dokument?.id);
      const u = Number.isInteger(id) && id > 0 ? await globalDokumentZurUnterschrift(z.ref, id, req.body?.pflichtKey || null, z.agent) : { ok: false as const, status: 500, error: "Dokument ohne Nummer." };
      if (!u.ok) return res.status(u.status).json({ ok: false, error: `Abgelegt — aber nicht zur Unterschrift gestellt: ${u.error}` });
    }
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
