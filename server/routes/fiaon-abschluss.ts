// ═══════════════════════════════════════════════════════════════════════════
// ABSCHLUSS EINES GEKÜNDIGTEN MITARBEITERS (13.09.2026, E-185)
//
// Zwei Türen, ein Vorgang:
//   · /abschluss/:token — der Mitarbeiter. Ein gesperrtes Konto bekommt keine
//     Sitzung; der Login (fiaon-agent.ts) gibt ihm stattdessen ein signiertes
//     Token, das 90 Tage gilt. Damit liest er das Schreiben, unterschreibt,
//     nennt die Adresse für die Ausfertigung und lädt die PDF.
//   · /admin/agents/:id/kuendigung — die Verwaltung. Legt die Kündigung an
//     (Datum, Vertragsende, Freistellung), sieht den Stand, holt die PDF,
//     nimmt zurück, solange nichts unterschrieben ist.
// Die Logik liegt in server/lib/fiaon-kuendigung-mitarbeiter.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import {
  abschlussTokenPruefen, abschlussLage, abschlussLink, kuendigungAnlegen, kuendigungLesen,
  kuendigungUnterschreiben, kuendigungZuruecknehmen, provisionenOffen, offeneAnforderungen, isoTag,
} from "../lib/fiaon-kuendigung-mitarbeiter";
import { readChef } from "./fiaon-chef-zugang";

const router = Router();

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

async function tokenOderFehler(req: Request, res: Response): Promise<number | null> {
  const t = await abschlussTokenPruefen(req.params.token);
  if (!t) { res.status(400).json({ ok: false, error: "Dieser Link ist ungültig." }); return null; }
  if (t.abgelaufen) {
    res.status(410).json({ ok: false, error: "Dieser Link ist abgelaufen. Bitte melde dich bei Florentine oder Daniel — dann bekommst du einen neuen." });
    return null;
  }
  return t.agentId;
}

function pdfSenden(res: Response, base64: string | null | undefined, dateiname: string) {
  if (!base64) return res.status(404).json({ ok: false, error: "Für diese Kündigung liegt noch keine PDF vor." });
  const buf = Buffer.from(String(base64), "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${dateiname}"`);
  res.setHeader("Content-Length", String(buf.length));
  res.end(buf);
}

// ── Der Mitarbeiter ──────────────────────────────────────────────────────────
router.get("/abschluss/:token", async (req: Request, res: Response) => {
  try {
    const agentId = await tokenOderFehler(req, res);
    if (agentId == null) return;
    const lage = await abschlussLage(agentId, String(req.params.token));
    if (!lage) return res.status(404).json({ ok: false, error: "Wir finden keine laufende Kündigung zu diesem Link." });
    res.json({ ok: true, lage });
  } catch (err) {
    console.error("[ABSCHLUSS] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/abschluss/:token", async (req: Request, res: Response) => {
  try {
    const agentId = await tokenOderFehler(req, res);
    if (agentId == null) return;
    const b = req.body ?? {};
    if (b.confirm !== true) return res.status(400).json({ ok: false, error: "Bitte die Empfangsbestätigung ankreuzen." });
    const erg = await kuendigungUnterschreiben(agentId, {
      signatureName: String(b.signatureName || ""),
      signatureMode: b.signatureMode === "drawn" ? "drawn" : "typed",
      signaturePng: b.signaturePng ? String(b.signaturePng) : null,
      email: String(b.email || ""),
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] || ""),
    });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    const lage = await abschlussLage(agentId, String(req.params.token));
    res.json({ ok: true, lage, mail: erg.mail });
  } catch (err) {
    console.error("[ABSCHLUSS] unterschreiben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/abschluss/:token/dokument.pdf", async (req: Request, res: Response) => {
  try {
    const agentId = await tokenOderFehler(req, res);
    if (agentId == null) return;
    const k = await kuendigungLesen(agentId);
    if (!k) return res.status(404).json({ ok: false, error: "Keine laufende Kündigung." });
    pdfSenden(res, k.pdf_base64, `FIAON_Kuendigung_${isoTag(k.ausgesprochen_am)}.pdf`);
  } catch (err) {
    console.error("[ABSCHLUSS] pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Die Verwaltung (Admin-Cookie/Chef-Token über das Gate in routes.ts) ─────
async function verwaltungsSicht(agentId: number) {
  const k = await kuendigungLesen(agentId);
  if (!k) return null;
  const prov = await provisionenOffen(agentId);
  const anf = await offeneAnforderungen(agentId);
  return {
    id: Number(k.id), status: String(k.status),
    ausgesprochenAm: isoTag(k.ausgesprochen_am),
    wirksamAm: isoTag(k.wirksam_am),
    freigestelltAb: isoTag(k.freigestellt_ab),
    schlussabrechnungAm: k.schlussabrechnung_am ? isoTag(k.schlussabrechnung_am) : null,
    zustellMailVersandtAm: k.zustell_mail_versandt_am ?? null,
    zustellMailFehler: k.zustell_mail_fehler ?? null,
    anforderungenOffenCents: anf.cents,
    unterschriebenAm: k.unterschrieben_am ?? null,
    unterschriftName: k.unterschrift_name ?? null,
    empfangsEmail: k.empfangs_email ?? null,
    mailVersandtAm: k.mail_versandt_am ?? null,
    mailFehler: k.mail_fehler ?? null,
    provisionenOffenCents: prov.cents,
    schlussPayoutId: k.schluss_payout_id ?? null,
    schlussBetragCents: k.schluss_betrag_cents ?? null,
    schlussFehler: k.schluss_fehler ?? null,
    schlussAbgeschlossenAm: k.schluss_abgeschlossen_am ?? null,
    link: k.status === "offen" || k.status === "unterschrieben" ? await abschlussLink(agentId) : null,
    pdfUrl: k.pdf_base64 ? `/api/fiaon/admin/agents/${agentId}/kuendigung.pdf` : null,
    angelegtVon: k.angelegt_von ?? null,
    grund: k.grund ?? null,
  };
}

router.get("/admin/agents/:id/kuendigung", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    res.json({ ok: true, kuendigung: await verwaltungsSicht(id) });
  } catch (err) {
    console.error("[ABSCHLUSS] admin lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Eine Kündigung ist Sache der Geschäftsführung — ein Chef-Token der Stufe „leitung" darf sie nicht aussprechen. */
function nurGeschaeftsfuehrung(req: Request, res: Response): string | null {
  const chef = readChef(req);
  if (chef && chef.stufe === "leitung") {
    res.status(403).json({ ok: false, error: "Kündigungen spricht nur die Geschäftsführung aus." });
    return null;
  }
  return chef ? `Chefbüro (${chef.stufe}, Konto ${chef.agentId})` : "Verwaltung";
}

router.post("/admin/agents/:id/kuendigung", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    const von = nurGeschaeftsfuehrung(req, res);
    if (von == null) return;
    const [a] = (await sqlPool`SELECT id, is_test_account, rolle FROM fiaon_agents WHERE id = ${id}`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden" });
    const erg = await kuendigungAnlegen(id, {
      ausgesprochenAm: req.body?.ausgesprochenAm ?? null,
      wirksamAm: req.body?.wirksamAm ?? null,
      freigestelltAb: req.body?.freigestelltAb ?? null,
      grund: req.body?.grund ?? null,
      von,
    });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    const sicht = await verwaltungsSicht(id);
    res.json({ ok: true, kuendigung: sicht, link: sicht?.link ?? null,
      meldung: `Kündigung angelegt — ${sicht?.ausgesprochenAm}, Vertragsende ${sicht?.wirksamAm}. Der Mitarbeiter sieht sie beim nächsten Login.` });
  } catch (err) {
    console.error("[ABSCHLUSS] admin anlegen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/agents/:id/kuendigung/zuruecknehmen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    const von = nurGeschaeftsfuehrung(req, res);
    if (von == null) return;
    const erg = await kuendigungZuruecknehmen(id, von);
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.error });
    res.json({ ok: true, kuendigung: await verwaltungsSicht(id), meldung: "Kündigung zurückgenommen. Der Zugang bleibt gesperrt, bis du ihn freigibst." });
  } catch (err) {
    console.error("[ABSCHLUSS] admin zuruecknehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Nur Testkonten: die Akte verwerfen, damit ein Probelauf keine Spur hinterlässt. */
router.post("/admin/agents/:id/kuendigung/verwerfen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    if (nurGeschaeftsfuehrung(req, res) == null) return;
    const [a] = (await sqlPool`SELECT is_test_account FROM fiaon_agents WHERE id = ${id}`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden" });
    if (a.is_test_account !== true) return res.status(403).json({ ok: false, error: "Verwerfen gibt es nur für Testkonten — echte Kündigungen bleiben in der Akte." });
    const weg = (await sqlPool`DELETE FROM fiaon_agent_kuendigungen WHERE agent_id = ${id} RETURNING id`) as any[];
    await sqlPool`UPDATE fiaon_commissions SET status = 'bestaetigt', auszahlbar_ab = NULL, updated_at = NOW()
                   WHERE agent_id = ${id} AND status = 'vorgemerkt' AND note LIKE '%Schlussabrechnung nach Kündigung%'`;
    res.json({ ok: true, verworfen: weg.length });
  } catch (err) {
    console.error("[ABSCHLUSS] admin verwerfen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/agents/:id/kuendigung.pdf", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    const k = await kuendigungLesen(id);
    if (!k) return res.status(404).json({ ok: false, error: "Keine laufende Kündigung." });
    pdfSenden(res, k.pdf_base64, `FIAON_Kuendigung_${id}_${isoTag(k.ausgesprochen_am)}.pdf`);
  } catch (err) {
    console.error("[ABSCHLUSS] admin pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
