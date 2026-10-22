// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ROUTEN DES INDIVIDUALANGEBOTS
// Individualangebot (01.10.2026), Register E-268
//
// Zwei Türen, ein Vorgang (Ablauf: server/lib/fiaon-global-angebot.ts):
//   · /global/angebot/:token — der Kunde, ohne Anmeldung, mit signiertem Link
//     (Referenz.Ablauf.Signatur). Lesen (mit den Schaltern sofortBeginn und
//     jahresbetreuung), Entwurf als PDF, Prüfbericht als PDF, annehmen.
//     Token im Zugriffslog maskiert (server/index.ts).
//   · /admin/global/angebote… — die Leitung, hinter dem /admin-Gate aus routes.ts;
//     requireChef("leitung") liefert dazu, WER geklickt hat. Die Seite dazu:
//     /chef/s/global-auftraege?reiter=angebote (keine neue Chef-Seite).
//
// Angebot-Aufrufe (01.10.2026): Jeder Abruf des Kundenlinks (Seite, Vertrag-PDF,
// Prüfbericht-PDF) wird NACH der Antwort protokolliert — feuern und vergessen,
// ein Fehler dort erreicht den Kunden nie. Die Route liest nur, ob eine Sitzung
// (Chefbüro/Admin/Mitarbeiter) im Aufruf steckt; alles Weitere (IP gekürzt, Gerät,
// Ort aus Kopfzeilen, Meldung an Justin): server/lib/fiaon-global-angebot-aufrufe.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, readChef, type ChefRequest } from "./fiaon-chef-zugang";
import { hasAdminCode } from "./fiaon-admin-zugang";
import {
  angebotKundenSicht, angebotAnnehmen, angebotPdfFuerToken, angebotPdfErzeugen, schalterAus, angebotListe, angebotAnlegen, angebotAendern,
  angebotZurueckziehen, angebotMeilenstein, angebotFristHemmen, angebotErstattungVormerken, angebotErstattungUeberwiesen, angebotLesen,
  angebotPruefberichtBoniNeu, angebotVorbelegung, angebotFertigstellen, angebotNacharbeit, bestaetigungSenden, nachholenMeldung, angebotGarantieErfuellt,
} from "../lib/fiaon-global-angebot";
import { globalMitarbeiter } from "../lib/fiaon-global-auftrag";
import { aufrufProtokollieren, aufrufClientIp, type AufrufArt, type AufrufKontext } from "../lib/fiaon-global-angebot-aufrufe";
import { ANGEBOT_VORGABEN, BUERGIN_VORGABE, BUERGIN_FELDER, ANGEBOT_FASSUNG, ANGEBOT_GUELTIG_TAGE } from "@shared/fiaon-global-angebot";

const router = Router();

/** Gegenprüfung 01.10.2026 (F2): zuerst cf-connecting-ip (setzt Cloudflare selbst), dann der erste X-Forwarded-For-Eintrag —
 *  eine Regel für Protokoll und Annahme (aufrufClientIp). Nicht req.ip: hinter Cloudflare ist das der Rand von Cloudflare. */
function clientIp(req: Request): string {
  return aufrufClientIp(req);
}
function pdfSenden(res: Response, pdf: Buffer, dateiname: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${dateiname.replace(/[^A-Za-z0-9._-]+/g, "_")}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.end(pdf);
}
/** Wer im Chefbüro sitzt (oder mit Admin-Cookie schaut), sieht die Seite als Vorschau — annehmen kann nur der Kunde. */
function istLeitung(req: Request): boolean {
  try { return !!readChef(req) || hasAdminCode(req); } catch { return false; }
}

// ── Angebot-Aufrufe (01.10.2026): wer ruft auf? ─────────────────────────────
/** Steckt eine Sitzung im Aufruf? Chefbüro (neu oder altes Admin-Cookie) oder Mitarbeiter — sonst null. */
async function sitzungAus(req: Request): Promise<AufrufKontext["sitzung"]> {
  try {
    const chef = readChef(req);
    if (chef) return { grund: "chefbuero", agentId: chef.agentId };
    if (hasAdminCode(req)) return { grund: "chefbuero", agentId: null };
    const { verifyAgentToken, AGENT_COOKIE_NAME } = await import("./fiaon-agent");
    const ma = verifyAgentToken((req as any).cookies?.[AGENT_COOKIE_NAME]);
    if (ma) return { grund: "mitarbeiter", agentId: ma.id };
  } catch { /* ohne Sitzung */ }
  return null;
}
/** Nach der Antwort protokollieren — wirft nie, wartet nie. */
function aufrufMerken(req: Request, art: AufrufArt, antwort: number): void {
  void (async () => {
    await aufrufProtokollieren(String(req.params.token), art, antwort, {
      ip: clientIp(req), userAgent: String(req.headers["user-agent"] || ""), kopf: req.headers as AufrufKontext["kopf"], sitzung: await sitzungAus(req),
    });
  })().catch((e) => console.error(`[FIAON-ANGEBOT] Aufruf (${art}) nicht protokolliert:`, e instanceof Error ? e.message : e));
}

// ── Der Kunde ────────────────────────────────────────────────────────────────
router.get("/global/angebot/:token", async (req: Request, res: Response) => {
  // ?wahl=1: Die Seite rechnet nach einem Häkchen nur neu — kein neues Öffnen („Seite · nachgeladen").
  const art: AufrufArt = req.query.wahl === "1" ? "auswahl" : "seite";
  try {
    const erg = await angebotKundenSicht(String(req.params.token), schalterAus(req.query), { leitung: istLeitung(req) });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(erg.status).json(erg.body);
    aufrufMerken(req, art, erg.status);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] lesen:", err);
    res.status(500).json({ ok: false, error: "Das Angebot lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
    aufrufMerken(req, art, 500);
  }
});

router.post("/global/angebot/:token/annehmen", async (req: Request, res: Response) => {
  try {
    const erg = await angebotAnnehmen(String(req.params.token), req.body ?? {}, { ip: clientIp(req), userAgent: String(req.headers["user-agent"] || ""), leitung: istLeitung(req) });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] annehmen:", err);
    res.status(500).json({ ok: false, error: "Da ist bei uns etwas schiefgelaufen — nicht bei Ihnen. Bitte versuchen Sie es in einer Minute noch einmal." });
  }
});

// E-410: Was wie lange gelesen wurde — die Seite schickt alle 15 s und beim Verlassen die Summen je Abschnitt.
// Antwortet sofort 204 und verbucht danach (feuern und vergessen); Unlesbares wird still verworfen.
router.post("/global/angebot/:token/lesen", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(204).end();
  void (async () => {
    const { lesenMerken } = await import("../lib/fiaon-global-angebot-lesen");
    await lesenMerken(String(req.params.token), req.body, {
      ip: clientIp(req), userAgent: String(req.headers["user-agent"] || ""), kopf: req.headers as AufrufKontext["kopf"], sitzung: await sitzungAus(req),
      anzahl: Number((req.body as any)?.anzahl) || 0,
    });
  })().catch((e) => console.error("[FIAON-ANGEBOT] Lesen nicht verbucht:", e instanceof Error ? e.message : e));
});

// E-301: „anlage1“ (Bürgschaftszusage allein) nur beim Firmenangebot — beim Individualangebot antwortet die Route 404.
// Im Protokoll zählt Anlage 1 als Vertrag-PDF (sie ist Teil des Vertrags).
for (const art of ["vertrag", "pruefbericht", "anlage1"] as const) {
  const aufrufArt: AufrufArt = art === "pruefbericht" ? "pruefbericht_pdf" : "vertrag_pdf";
  router.get(`/global/angebot/:token/${art}.pdf`, async (req: Request, res: Response) => {
    try {
      const erg = await angebotPdfFuerToken(String(req.params.token), art, schalterAus(req.query));
      aufrufMerken(req, aufrufArt, erg.pdf ? 200 : erg.status);
      if (!erg.pdf) return res.status(erg.status).json({ ok: false, error: erg.error });
      pdfSenden(res, erg.pdf, erg.dateiname!);
    } catch (err) {
      console.error(`[FIAON-ANGEBOT] ${art}.pdf:`, err);
      aufrufMerken(req, aufrufArt, 500);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Das Dokument lässt sich gerade nicht erzeugen." });
    }
  });
}

// E-301 (Gegenprüfung 07.10.2026): die Bilder eines Firmenangebots — NUR hinter dem Link, dieselbe Prüfung wie Seite und
// PDFs (server/lib/fiaon-global-angebot-firma.ts firmaBildFuerToken). Keine Auflistung; ein unbekannter Name ist 404.
// Cache-Control private (nie in einem geteilten Zwischenspeicher wie Cloudflare) und no-cache: Der Browser darf das Bild
// behalten, fragt aber bei jeder Nutzung mit dem Link nach (ETag → 304) — ein zurückgezogenes Angebot zeigt sofort nichts
// mehr. Bildabrufe stehen nicht im Aufruf-Protokoll (sie gehören zum Seitenaufruf, der schon protokolliert ist).
router.get("/global/angebot/:token/bild/:name", async (req: Request, res: Response) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noimageindex");
  try {
    const F = await import("../lib/fiaon-global-angebot-firma");
    const erg = await F.firmaBildFuerToken(String(req.params.token), String(req.params.name));
    if (!erg.daten || !erg.typ) {
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(erg.status).json({ ok: false, error: erg.error });
    }
    const etag = `"${String(erg.sha256 ?? "").slice(0, 40)}"`;
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("ETag", etag);
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Disposition", "inline");
    if (String(req.headers["if-none-match"] ?? "") === etag) return res.status(304).end();
    res.setHeader("Content-Type", erg.typ);
    res.setHeader("Content-Length", String(erg.daten.length));
    res.end(erg.daten);
  } catch (err) {
    console.error("[FIAON-FIRMA] bild:", err);
    if (!res.headersSent) { res.setHeader("Cache-Control", "private, no-store"); res.status(500).json({ ok: false, error: "Das Bild lässt sich gerade nicht laden." }); }
  }
});

// E-331 (12.10.2026): „Ihre Unterlagen" — Liste und Datei, NUR hinter dem Link (dieselbe Prüfung wie Seite und PDFs,
// server/lib/fiaon-global-angebot-unterlagen.ts). Nie zwischengespeichert, nie indexiert: darunter liegt ein Reisepass.
const unterlagenKoepfe = (res: Response) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noimageindex");
  res.setHeader("X-Content-Type-Options", "nosniff");
};
router.get("/global/angebot/:token/unterlagen", async (req: Request, res: Response) => {
  unterlagenKoepfe(res);
  try {
    const U = await import("../lib/fiaon-global-angebot-unterlagen");
    const erg = await U.unterlagenFuerToken(String(req.params.token));
    if (!erg.unterlagen) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, unterlagen: erg.unterlagen });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] unterlagen:", err);
    res.status(500).json({ ok: false, error: "Die Unterlagen lassen sich gerade nicht laden." });
  }
});
router.get("/global/angebot/:token/unterlage/:id", async (req: Request, res: Response) => {
  unterlagenKoepfe(res);
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ ok: false, error: "Diese Unterlage gibt es nicht." });
    const U = await import("../lib/fiaon-global-angebot-unterlagen");
    const erg = await U.unterlageDateiFuerToken(String(req.params.token), id);
    if (!erg.daten || !erg.mime) return res.status(erg.status).json({ ok: false, error: erg.error });
    const name = String(erg.dateiname || "Unterlage").replace(/["\\\r\n]/g, "");
    const ascii = name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim() || "Unterlage";
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Content-Type", erg.mime);
    res.setHeader("Content-Length", String(erg.daten.length));
    res.setHeader("Content-Disposition", `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.end(erg.daten);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] unterlage:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Die Unterlage lässt sich gerade nicht laden." });
  }
});

// ── Die Leitung ──────────────────────────────────────────────────────────────
async function chefName(req: ChefRequest): Promise<string> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Justin (Chefbüro)";
}
const idAus = (req: Request) => Number(req.params.id);

router.get("/admin/global/angebote", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    // E-301 (Nachprüfung 08.10.2026): Den Link eines Firmenangebots mit Versandsperre sieht nur der Inhaber („Link nur an Justin“).
    const { firmaListeFuerStufe } = await import("../lib/fiaon-global-angebot-firma");
    res.json({
      // Angebot-Aufrufe (01.10.2026): „du" in der Liste = wer gerade schaut.
      ok: true, angebote: firmaListeFuerStufe(await angebotListe({ betrachterAgentId: req.chef?.agentId ?? null }), req.chef?.stufe), mitarbeiter: await globalMitarbeiter(),
      vorgaben: { parameter: ANGEBOT_VORGABEN, buergin: BUERGIN_VORGABE, buerginFelder: BUERGIN_FELDER, fassung: ANGEBOT_FASSUNG, gueltigTage: ANGEBOT_GUELTIG_TAGE },
    });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] liste:", err);
    res.status(500).json({ ok: false, error: "Die Angebote lassen sich gerade nicht laden." });
  }
});

router.get("/admin/global/angebote/vorbelegung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const personId = Number(req.query.personId);
    if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Bitte eine Personen-Nummer angeben." });
    const erg = await angebotVorbelegung(personId);
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] vorbelegung:", err);
    res.status(500).json({ ok: false, error: "Die Daten der Person ließen sich nicht laden." });
  }
});

router.post("/admin/global/angebote", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    // Der Prüfbericht kommt nie aus einem Formular (Justin: „Echter Prüfbericht") — er wird aus den Daten
    // gerechnet („Bonitätsteil neu rechnen") oder von der Saat aus den Messwerten gesetzt.
    const { pruefbericht: _nieAusDemFormular, ...ein } = (req.body ?? {}) as Record<string, unknown>;
    const erg = await angebotAnlegen(ein, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] anlegen:", err);
    res.status(500).json({ ok: false, error: "Das Angebot ließ sich nicht anlegen." });
  }
});

router.put("/admin/global/angebote/:id", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotAendern(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: erg.fehlt.length ? `Gespeichert. Für die Annahme fehlt noch: ${erg.fehlt.join("; ")}.` : "Gespeichert. Das Angebot ist jetzt annehmbar." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] ändern:", err);
    res.status(500).json({ ok: false, error: "Nicht gespeichert — Serverfehler." });
  }
});

router.post("/admin/global/angebote/:id/pruefbericht", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotPruefberichtBoniNeu(idAus(req), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: `Bonitätsteil neu gerechnet: ${erg.punkte} Punkte.` });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] prüfbericht:", err);
    res.status(500).json({ ok: false, error: "Der Prüfbericht ließ sich nicht neu rechnen." });
  }
});

router.post("/admin/global/angebote/:id/zurueckziehen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotZurueckziehen(idAus(req), req.body?.grund, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ok: true, meldung: "Zurückgezogen. Der Link antwortet jetzt mit „gilt nicht mehr“." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] zurückziehen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// E-419: Kooperation — Empfehlungen des Partners an FIAON (eintragen, Person zuordnen, ausgezahlt, entfernen), Provision in % und
// „Berechnung ausgesetzt“ (Kontakte 0 €, keine Monatsrechnung).
async function koopZeile(req: ChefRequest, res: Response) {
  const { angebotLesen } = await import("../lib/fiaon-global-angebot");
  const z = await angebotLesen({ id: idAus(req) });
  if (!z || !String(z.fassung ?? "").startsWith("IA-KOOP-")) { res.status(404).json({ ok: false, error: "Kein Kooperationsvertrag." }); return null; }
  return z;
}
router.post("/admin/global/angebote/:id/koop/empfehlung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const z = await koopZeile(req, res); if (!z) return;
    const { koopEmpfehlungEintragen } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopEmpfehlungEintragen(z, req.body ?? {}, await chefName(req), "fiaon");
    return r.ok ? res.json({ ...r, meldung: "Empfehlung eingetragen." }) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[FIAON-ANGEBOT] koop/empfehlung:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});
router.post("/admin/global/angebote/:id/koop/empfehlung/:eid", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const z = await koopZeile(req, res); if (!z) return;
    const { koopEmpfehlungAendern } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopEmpfehlungAendern(z, Number(req.params.eid), req.body ?? {}, await chefName(req));
    return r.ok ? res.json({ ...r, meldung: "Gespeichert." }) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[FIAON-ANGEBOT] koop/empfehlung ändern:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});
router.get("/admin/global/angebote/:id/koop/gutschrift/:gid.pdf", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const z = await koopZeile(req, res); if (!z) return;
    const { koopGutschriftPdf, ensureGutschriftTabelle } = await import("../lib/fiaon-koop-empfehlung");
    await ensureGutschriftTabelle();
    const [g] = (await sqlPool`SELECT id FROM fiaon_koop_gutschriften WHERE id = ${Number(req.params.gid)} AND angebot_id = ${Number(z.id)}`) as any[];
    const p = g ? await koopGutschriftPdf(Number(g.id)) : null;
    if (!p) return res.status(404).json({ ok: false, error: "Gutschrift nicht gefunden." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${p.dateiname}"`);
    res.send(p.pdf);
  } catch (err) { console.error("[FIAON-ANGEBOT] koop/gutschrift:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});
// E-421: Vorschau des Monatsberichts (ohne Versand) — ?monat=JJJJ-MM, Vorgabe der laufende Monat bis heute.
router.get("/admin/global/angebote/:id/koop/monatsbericht.html", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const z = await koopZeile(req, res); if (!z) return;
    const roh = String(req.query.monat ?? "");
    const monat = /^\d{4}-(0[1-9]|1[0-2])$/.test(roh) ? roh : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    const { koopMonatsberichtBauen, koopMonatsberichtBaustein, gsMonatText } = await import("../lib/fiaon-koop-empfehlung");
    const bau = await koopMonatsberichtBauen(z, monat);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!bau) return res.send(`<p style="font:15px system-ui;padding:24px">Für ${gsMonatText(monat)} gibt es keinen Monatsbericht: Provision nicht gesetzt oder in diesem Monat zählt keine Empfehlung.</p>`);
    const { freitextRendern } = await import("../mail/motor");
    const m = freitextRendern({ betreff: bau.bericht.betreff, text: bau.bericht.text, absender: bau.gutschrift ? "accounting" : "welcome", baustein: koopMonatsberichtBaustein(bau.bericht, gsMonatText(monat)) });
    res.send(m.html);
  } catch (err) { console.error("[FIAON-ANGEBOT] koop/monatsbericht:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});
router.post("/admin/global/angebote/:id/koop/provision", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const z = await koopZeile(req, res); if (!z) return;
    const { koopProvisionSetzen } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopProvisionSetzen(z, req.body ?? {}, await chefName(req));
    return r.ok ? res.json({ ...r, meldung: "Gespeichert." }) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[FIAON-ANGEBOT] koop/provision:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/admin/global/angebote/:id/meilenstein", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotMeilenstein(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] meilenstein:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// E-401 (Kapital-Angebot): „Bürgschaft zugesagt“ (:art = buergschaft, Teil 2) und „Finanzierung ausgezahlt“ (:art = auszahlung,
// Teil 3) — je ein Teil mit Rechnung, ohne Kundenmail. Body: { datum: "JJJJ-MM-TT", beleg?: string }. Wiederholbar.
router.post("/admin/global/angebote/:id/kapital/:art", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const { kapitalGebuehrBerechnen } = await import("../lib/fiaon-global-angebot-kapital");
    const erg = await kapitalGebuehrBerechnen(idAus(req), String(req.params.art || ""), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-KAPITAL] Rechnung Bürgschaft/Auszahlung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// E-271 (Kreditgarantie): „Garantie erfüllt“ — Kreditrahmen ≥ Ziel und Karten ≥ Ziel bis zum Fristende, mit Belegen.
// Body: { erfuelltAm: "JJJJ-MM-TT", rahmenUsd: number, karten: number, beleg: string }.
router.post("/admin/global/angebote/:id/garantie", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotGarantieErfuellt(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] garantie:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/hemmung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotFristHemmen(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: `Ruhezeit eingetragen: vom ${erg.von.split("-").reverse().join(".")} bis ${erg.bis.split("-").reverse().join(".")} (${erg.tage} Tage). Neues Fristende: ${erg.fristEnde.split("-").reverse().join(".")} — der Kunde bekommt es per Mail; die zuständige Person hat eine Aufgabe.` });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] hemmung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/erstattung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotErstattungVormerken(idAus(req), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] erstattung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/erstattung-ueberwiesen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotErstattungUeberwiesen(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ok: true, meldung: "Überweisung eingetragen." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] erstattung überwiesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Hing etwas nach der Annahme (Bestellung, Mail)? Derselbe Weg noch einmal — er ist wiederholbar. */
router.post("/admin/global/angebote/:id/nachholen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotFertigstellen(idAus(req));
    if (!erg.ok) return res.status(409).json({ ok: false, error: `Nicht fertig: ${erg.grund}` });
    await angebotNacharbeit(idAus(req));
    const mail = await bestaetigungSenden(idAus(req));
    // E-273 (02.10.2026): Die Nacharbeit bucht auch das Startgespräch (wiederholbar) — die Meldung sagt, wie es steht.
    const sg = await import("../lib/fiaon-global-angebot-startgespraech").then((m) => m.startgespraechStand(idAus(req))).catch(() => null);
    const sgSatz = sg?.stand === "gebucht" && sg.termin ? ` Startgespräch: ${sg.termin.zeile}.` : sg && sg.stand !== "keins" && !sg.termin ? ` Startgespräch noch nicht gebucht${sg.fehler ? ` (${sg.fehler})` : ""}.` : "";
    // Nachprüfung 08.10.2026 (N1): Beim Firmenangebot meldet „Nachholen“ keine Bestätigungsmail — es geht keine raus.
    res.json({ ok: true, meldung: nachholenMeldung(mail) + sgSatz });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] nachholen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── E-301 (07.10.2026): DAS FIRMENANGEBOT — die Aktionen der Leitung (server/lib/fiaon-global-angebot-firma.ts) ──
// Jede Aktion prüft selbst, ob sie frei ist (dieselbe Regel liefert die Liste als knoepfe). Pfade unter …/:id/firma/…
// Die Freigabe des Anwalts öffnet den Versand an die Kundin — sie trägt nur der Inhaber ein (Nachprüfung 08.10.2026, „Link nur an Justin“).
const FIRMA_NUR_INHABER: ReadonlySet<string> = new Set(["freigabe"]);
const FIRMA_AKTIONEN = {
  freigabe: "firmaFreigabeAnwalt", bedingungen: "firmaBedingungenErfuellt", kapital: "firmaKapitalErhalten", hemmung: "firmaFristHemmen",
  umsatz: "firmaUmsatz", verkauf: "firmaVerkauf", kuendigung: "firmaKuendigung",
  // Runde 2 (08.10.2026): „Shop live“ setzt den Starttag — das gemeinsame Wachstumsbudget beginnt (Monatsteile, erste Rechnung).
  "shop-live": "firmaShopLive",
} as const;
for (const [pfad, fn] of Object.entries(FIRMA_AKTIONEN)) {
  router.post(`/admin/global/angebote/:id/firma/${pfad}`, requireChef(FIRMA_NUR_INHABER.has(pfad) ? "inhaber" : "leitung"), async (req: ChefRequest, res: Response) => {
    try {
      const F = await import("../lib/fiaon-global-angebot-firma");
      const z = await angebotLesen({ id: idAus(req) });
      if (!z) return res.status(404).json({ ok: false, error: "Dieses Angebot gibt es nicht." });
      if (!F.istFirmenAngebot(z)) return res.status(409).json({ ok: false, error: "Das ist kein Firmenangebot." });
      const erg = await (F as any)[fn](idAus(req), req.body ?? {}, await chefName(req));
      if (!erg.ok) return res.status(erg.status).json(erg);
      res.json({ meldung: "Gespeichert.", ...erg });
    } catch (err) {
      console.error(`[FIAON-FIRMA] ${pfad}:`, err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
}
router.post("/admin/global/angebote/:id/firma/garantiefall", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const F = await import("../lib/fiaon-global-angebot-firma");
    const z = await angebotLesen({ id: idAus(req) });
    if (!z || !F.istFirmenAngebot(z)) return res.status(404).json({ ok: false, error: "Kein Firmenangebot." });
    const erg = await F.firmaGarantiefall(idAus(req), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-FIRMA] garantiefall:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
/** Eine Rechnung für einen fälligen Teil jetzt stellen (z. B. wenn der Monatslauf an der Bestellzeile hing). */
router.post("/admin/global/angebote/:id/firma/rechnung/:teilId", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const F = await import("../lib/fiaon-global-angebot-firma");
    const z = await angebotLesen({ id: idAus(req) });
    if (!z || !F.istFirmenAngebot(z)) return res.status(404).json({ ok: false, error: "Kein Firmenangebot." });
    const erg = await F.firmaTeilJetztBerechnen(idAus(req), Number(req.params.teilId), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-FIRMA] rechnung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// „anlage1" = das Blatt zum eigenhändigen Unterschreiben (nur für die Leitung; Gegenprüfung 01.10.2026).
for (const art of ["vertrag", "pruefbericht", "anlage1"] as const) {
  router.get(`/admin/global/angebote/:id/${art}.pdf`, requireChef("leitung"), async (req: ChefRequest, res: Response) => {
    try {
      const z = await angebotLesen({ id: idAus(req) });
      if (!z) return res.status(404).json({ ok: false, error: "Dieses Angebot gibt es nicht." });
      const erg = await angebotPdfErzeugen(z, art, schalterAus(req.query));
      if (!erg.pdf) return res.status(erg.status).json({ ok: false, error: erg.error });
      pdfSenden(res, erg.pdf, erg.dateiname!);
    } catch (err) {
      console.error(`[FIAON-ANGEBOT] admin ${art}.pdf:`, err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
}

// E-331: Unterlagen eines Angebots — nur die Leitung lädt hoch oder entfernt (ein Mensch entscheidet, was der Kunde sieht).
router.get("/admin/global/angebote/:id/unterlagen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const U = await import("../lib/fiaon-global-angebot-unterlagen");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, unterlagen: await U.unterlagenListe(idAus(req)) });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] unterlagen (Leitung):", err);
    res.status(500).json({ ok: false, error: "Die Unterlagen lassen sich gerade nicht laden." });
  }
});
router.post(
  "/admin/global/angebote/:id/unterlagen",
  requireChef("leitung"),
  (req: Request, res: Response, next: (e?: unknown) => void) => {
    import("multer")
      .then(({ default: multer }) => {
        multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 12, fields: 2 } })
          .array("dateien", 12)(req as any, res as any, (err: any) => {
            if (err) {
              return res.status(400).json({
                ok: false,
                error: err?.code === "LIMIT_FILE_SIZE" ? "Eine Datei ist größer als 15 MB." : err?.code === "LIMIT_FILE_COUNT" ? "Höchstens zwölf Dateien auf einmal." : "Die Dateien konnten nicht gelesen werden.",
              });
            }
            next();
          });
      })
      .catch(() => res.status(500).json({ ok: false, error: "Hochladen ist gerade nicht verfügbar." }));
  },
  async (req: ChefRequest, res: Response) => {
    try {
      // multer liest Dateinamen als latin1 — Umlaute und Gedankenstriche kommen sonst verstümmelt an.
      const name = (roh: string) => { const u = Buffer.from(String(roh || ""), "latin1").toString("utf8"); return u.includes("\uFFFD") ? String(roh || "") : u; };
      const dateien = (((req as any).files ?? []) as { buffer: Buffer; originalname: string }[])
        .map((f) => ({ buffer: f.buffer, name: name(f.originalname || "Unterlage.pdf").slice(0, 160) }));
      const U = await import("../lib/fiaon-global-angebot-unterlagen");
      const erg = await U.unterlagenHinzufuegen(idAus(req), dateien, await chefName(req));
      res.status(erg.ok ? 200 : 400).json(erg.ok ? { ok: true, meldung: erg.text, neu: erg.neu } : { ok: false, error: erg.text });
    } catch (err) {
      console.error("[FIAON-ANGEBOT] unterlagen hochladen:", err);
      res.status(500).json({ ok: false, error: "Das Hochladen ist gescheitert." });
    }
  },
);
router.delete("/admin/global/angebote/:id/unterlagen/:uid", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const U = await import("../lib/fiaon-global-angebot-unterlagen");
    const erg = await U.unterlageEntfernen(idAus(req), Number(req.params.uid));
    res.status(erg.ok ? 200 : 404).json(erg.ok ? { ok: true, meldung: erg.text } : { ok: false, error: erg.text });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] unterlage entfernen:", err);
    res.status(500).json({ ok: false, error: "Das Entfernen ist gescheitert." });
  }
});

export default router;
