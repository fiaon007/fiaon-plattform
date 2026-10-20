// ═══════════════════════════════════════════════════════════════════════════
// MARA FÜHRT DEN BETRIEB — „MARA HEUTE“ (E-406 B3, 19.10.2026; E-409 × E-406, 20.10.2026)
//
// Keine zweite Seite und keine zweite Zahl: EINE Server-Quelle (maraHeuteLesen, server/lib/fiaon-mara-heute.ts) für
//   · das Lagezimmer (ChefLagezimmer.tsx → ChefMaraHeute.tsx): GET /chef/mara-heute — eine KURZE Zusammenfassung ohne
//     Namen (Stufe Leitung) mit Link in KI-Team › Heute;
//   · KI-Team › Heute (GET /chef/ki/heute, fiaon-chef-ki.ts) — dort die Einzelheiten und „Rückgängig“.
//   POST /chef/mara-heute/rueckgaengig (Stufe Inhaber) — gelbe Handlungen 24 h zurücknehmen (Knöpfe in KI-Team › Heute).
// Die Ampel steht nur noch in KI-Team › Werkzeuge (GET/POST /chef/ki/werkzeuge…); die Wochen-Stichprobe für die
// Trainerin gibt es nicht mehr (Justin 19.10.: „warum Diana? … Die ist ja gar nicht Thema“ — Prüf-Mara prüft).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";

const router = Router();
const inhaber = requireChef("inhaber");

async function chefName(req: ChefRequest): Promise<string> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name && String(a.name).trim()) return String(a.name).trim().slice(0, 80);
  }
  return id ? `Chef #${id}` : "Inhaber";
}

/** Die kurze Fassung fürs Lagezimmer — dieselben Zahlen wie KI-Team › Heute, ohne Namen und ohne Einzelzeilen. */
export function maraHeuteKurz(h: import("../lib/fiaon-mara-heute").MaraHeute) {
  return {
    stand: h.stand,
    erledigt: h.erledigt,
    oben: h.zeilen.slice(0, 3).map((z) => ({ art: z.art, n: z.n, text: z.text })),
    geld: h.geld ? { heuteCents: h.geld.heuteCents, zahlungen: h.geld.zahlungen } : null,
    entscheidungen: h.karten?.entscheidungen ?? 0,
    gelb: h.gelb.filter((g) => !g.erledigt && g.id !== "mail_weitere").length,
    aufraeumen: h.aufraeumen.reduce((s, a) => s + a.anzahl, 0),
    haengt: h.haengt.length,
    link: "/chef/s/ki-heute",
  };
}

// ── LAGEZIMMER: „MARA HEUTE“ (kurz) ──────────────────────────────────────────
router.get("/chef/mara-heute", requireChef("leitung"), async (_req: ChefRequest, res: Response) => {
  try {
    const { maraHeuteLesen } = await import("../lib/fiaon-mara-heute");
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...maraHeuteKurz(await maraHeuteLesen()) });
  } catch (err) {
    console.error("[MARA-HEUTE]", err);
    res.status(500).json({ ok: false, error: "„Mara heute“ ließ sich nicht laden." });
  }
});

router.post("/chef/mara-heute/rueckgaengig", inhaber, async (req: ChefRequest, res: Response) => {
  try {
    const art = String(req.body?.art ?? "");
    const id = String(req.body?.id ?? "");
    if (!["termin", "angaben", "mail_nicht_senden", "mail_senden"].includes(art)) return res.status(400).json({ ok: false, error: "Unbekannter Knopf." });
    const { rueckgaengigMachen } = await import("../lib/fiaon-mara-heute");
    const von = await chefName(req);
    const erg = await rueckgaengigMachen(art as any, id, von);
    void chefProtokoll(req, `mara_heute:${art}:${id}`, erg.text.slice(0, 200));
    res.status(erg.ok ? 200 : erg.status).json(erg.ok ? { ok: true, text: erg.text } : { ok: false, error: erg.text });
  } catch (err) {
    console.error("[MARA-HEUTE] rückgängig:", err);
    res.status(500).json({ ok: false, error: "Das ist abgebrochen — bitte noch einmal." });
  }
});

export default router;
