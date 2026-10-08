// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG DIGITAL ÜBERGEBEN — Routen (08.10.2026)
//
// Chefbüro (requireChef("leitung") — dieselbe Stufe, die das Team verwaltet;
// /admin/agents/* lässt jede Chef-Stufe ein, siehe adminCodeGate):
//   GET  /chef/zugang-uebergabe                    Liste, Schlüssel-Stand, Vorbelegung
//   POST /chef/zugang-uebergabe                    ausstellen → Link + Code GENAU EINMAL
//   POST /chef/zugang-uebergabe/:id/zurueckziehen  Passwort leeren, Link tot
//
// Empfängerseite (ohne Anmeldung; Token im JSON-Körper, nie im Pfad — so steht
// es in keinem Zugriffsprotokoll und in keiner Leistungsmessung):
//   POST /zugang-uebergabe/stand        { token }        → Stand, KEIN Name
//   POST /zugang-uebergabe/oeffnen      { token, code }  → die eine Anzeige
//   POST /zugang-uebergabe/bestaetigen  { token, code }  → Passwort gelöscht
//
// Jede Antwort: Cache-Control no-store, X-Robots-Tag noindex, kein Referer.
// Die Anfrage-Zeile in server/index.ts schreibt für diese Pfade KEINE Antwort
// mit (dort „ohneAntwort“) — sonst stünden Code oder Passwort im Protokoll.
// Gedrosselt wird zweifach: je Link (3 falsche Codes, Tabelle) und je
// Anschluss (req.ip, hinter „trust proxy 1“ nicht fälschbar; im Speicher).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import {
  zugangSchluessel, uebergabeAusstellen, uebergabenListe, uebergabeZurueckziehen,
  uebergabeStandLesen, uebergabeOeffnen, uebergabeBestaetigen, type EmpfaengerErgebnis,
} from "../lib/fiaon-zugang-uebergabe";
import { UEBERGABE_GUELTIG_STUNDEN, UEBERGABE_MAX_FEHLVERSUCHE } from "@shared/fiaon-zugang-uebergabe";

const router = Router();

/** Nichts zwischenspeichern, nichts indexieren, keine Adresse weitergeben. */
export function keinSpeicher(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}
router.use(["/chef/zugang-uebergabe", "/zugang-uebergabe"], keinSpeicher);

const STUFE_NAME: Record<string, string> = { inhaber: "Inhaber", geschaeftsfuehrung: "Geschäftsführung", leitung: "Leitung" };

/** Wer klickt: Name, Adresse, Titel aus fiaon_agents. Das alte Admin-Cookie hat keinen Namen. */
async function wer(req: ChefRequest): Promise<{ agentId: number | null; name: string; email: string | null; funktion: string; telefon: string | null; stufe: string }> {
  const c = req.chef!;
  if (c.agentId == null) return { agentId: null, name: "Inhaber (Admin-Code)", email: null, funktion: "Inhaber", telefon: null, stufe: c.stufe };
  const [a] = (await sqlPool`SELECT name, email, admin_titel, phone FROM fiaon_agents WHERE id = ${c.agentId}`) as any[];
  return {
    agentId: c.agentId, name: String(a?.name || "").trim() || `Konto ${c.agentId}`, email: a?.email || null,
    funktion: String(a?.admin_titel || "").trim() || STUFE_NAME[c.stufe] || "Leitung", telefon: a?.phone || null, stufe: c.stufe,
  };
}

// ── Chefbüro ────────────────────────────────────────────────────────────────
router.get("/chef/zugang-uebergabe", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const s = zugangSchluessel();
    const [liste, ich] = await Promise.all([uebergabenListe(), wer(req)]);
    res.json({
      ok: true,
      schluessel: s.ok ? { da: true } : { da: false, grund: s.grund },
      gueltigStunden: UEBERGABE_GUELTIG_STUNDEN, maxFehlversuche: UEBERGABE_MAX_FEHLVERSUCHE,
      ich: { name: ich.name, email: ich.email, funktion: ich.funktion, telefon: ich.telefon },
      liste,
    });
  } catch (e: any) {
    console.error("[ZUGANG-UEBERGABE] Liste:", e?.message || e);
    res.status(500).json({ ok: false, error: "Die Übergaben ließen sich nicht laden. Bitte gleich noch einmal versuchen." });
  }
});

router.post("/chef/zugang-uebergabe", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const von = await wer(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = await uebergabeAusstellen(b, { agentId: von.agentId, name: von.name, stufe: von.stufe }, { ersetzt: Number(b.ersetzt) || null });
    if (!r.ok) return res.status(r.status).json({ ok: false, code: r.code, feld: r.feld ?? null, error: r.fehler });
    void chefProtokoll(req, `zugang-uebergabe:${r.id}`, `ausgestellt${r.ersetzt.length ? `, ersetzt ${r.ersetzt.join(", ")}` : ""}`);
    res.json({ ok: true, id: r.id, link: r.link, code: r.code, gueltigBis: r.gueltigBis, ersetzt: r.ersetzt });
  } catch (e: any) {
    // Nur die Meldung — nie den Körper der Anfrage (dort steht das Passwort).
    console.error("[ZUGANG-UEBERGABE] Ausstellen:", e?.message || e);
    res.status(500).json({ ok: false, error: "Die Übergabe ließ sich nicht ausstellen. Es wurde nichts gespeichert — bitte noch einmal versuchen." });
  }
});

router.post("/chef/zugang-uebergabe/:id/zurueckziehen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Übergabe." });
    const von = await wer(req);
    const r = await uebergabeZurueckziehen(id, von.name);
    if (!r.ok) return res.status(409).json({ ok: false, error: r.fehler });
    void chefProtokoll(req, `zugang-uebergabe:${id}`, "zurückgezogen");
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[ZUGANG-UEBERGABE] Zurückziehen:", e?.message || e);
    res.status(500).json({ ok: false, error: "Das Zurückziehen hat nicht geklappt. Bitte noch einmal versuchen." });
  }
});

// ── Drossel je Anschluss (zusätzlich zu den 3 Versuchen je Link) ───────────
const FENSTER_MS = 15 * 60_000;
const MAX_ANFRAGEN = 60;   // alle Empfänger-Anfragen eines Anschlusses je Fenster
const MAX_FEHLER = 10;     // falsche Codes eines Anschlusses je Fenster, über alle Links
type Zaehler = { anfragen: number; fehler: number; seit: number };
const drossel = new Map<string, Zaehler>();

function zaehlerFuer(req: Request): Zaehler {
  const jetzt = Date.now();
  const ip = String(req.ip || req.socket?.remoteAddress || "unbekannt");
  let z = drossel.get(ip);
  if (!z || jetzt - z.seit > FENSTER_MS) { z = { anfragen: 0, fehler: 0, seit: jetzt }; drossel.set(ip, z); }
  if (drossel.size > 5000) {
    for (const [k, v] of Array.from(drossel.entries())) if (jetzt - v.seit > FENSTER_MS) drossel.delete(k);
  }
  return z;
}

/** true = abgewiesen (Antwort ist schon gesendet). */
function gedrosselt(req: Request, res: Response, z: Zaehler): boolean {
  z.anfragen += 1;
  if (z.anfragen <= MAX_ANFRAGEN && z.fehler < MAX_FEHLER) return false;
  const minuten = Math.max(1, Math.ceil((z.seit + FENSTER_MS - Date.now()) / 60_000));
  res.status(429).json({ ok: false, code: "ZU_VIELE", minuten, error: "Zu viele Versuche von diesem Gerät." });
  return true;
}

/** Das Ergebnis der Empfänger-Prüfung als Antwort. Fehlversuche zählen auch je Anschluss. */
function antworten(res: Response, r: EmpfaengerErgebnis, z: Zaehler): void {
  switch (r.art) {
    case "ok": res.json({ ok: true, anzeige: r.anzeige }); return;
    case "bestaetigt": res.json({ ok: true, vorname: r.vorname, bestaetigtAm: r.bestaetigtAm }); return;
    case "falsch": z.fehler += 1; res.status(401).json({ ok: false, code: "CODE_FALSCH", rest: r.rest }); return;
    case "zu":
      if (r.stand === "gesperrt") z.fehler += 1;
      res.status(410).json({ ok: false, code: "ZU", stand: r.stand }); return;
    case "unbekannt": z.fehler += 1; res.status(404).json({ ok: false, code: "UNBEKANNT", stand: "unbekannt" }); return;
    case "format": res.status(400).json({ ok: false, code: "CODE_FORMAT" }); return;
    case "schluessel":
      console.error("[ZUGANG-UEBERGABE] Empfängerseite ohne Server-Schlüssel:", r.grund);
      res.status(503).json({ ok: false, code: "NICHT_ERREICHBAR", error: "Die Übergabe ist gerade nicht erreichbar. Bitte melden Sie sich bei der Person, die Ihnen den Link gegeben hat." });
      return;
    case "unlesbar":
      console.error("[ZUGANG-UEBERGABE] Chiffrat unlesbar (Schlüssel gewechselt?) — Übergabe neu ausstellen.");
      res.status(500).json({ ok: false, code: "UNLESBAR", error: "Das Start-Passwort lässt sich nicht mehr öffnen. Bitte lassen Sie sich den Zugang neu ausstellen." });
      return;
  }
}

// ── Empfängerseite ──────────────────────────────────────────────────────────
router.post("/zugang-uebergabe/stand", async (req: Request, res: Response) => {
  const z = zaehlerFuer(req);
  if (gedrosselt(req, res, z)) return;
  try {
    const r = await uebergabeStandLesen((req.body ?? {}).token);
    if (r.art === "unbekannt") { z.fehler += 1; return res.status(404).json({ ok: false, code: "UNBEKANNT", stand: "unbekannt" }); }
    res.json({ ok: true, stand: r.stand, gueltigBis: r.gueltigBis, rest: r.rest });
  } catch (e: any) {
    console.error("[ZUGANG-UEBERGABE] Stand:", e?.message || e);
    res.status(500).json({ ok: false, error: "Der Link ließ sich gerade nicht prüfen." });
  }
});

for (const [pfad, arbeit] of [
  ["/zugang-uebergabe/oeffnen", uebergabeOeffnen],
  ["/zugang-uebergabe/bestaetigen", uebergabeBestaetigen],
] as const) {
  router.post(pfad, async (req: Request, res: Response) => {
    const z = zaehlerFuer(req);
    if (gedrosselt(req, res, z)) return;
    try {
      const b = req.body ?? {};
      antworten(res, await arbeit(b.token, typeof b.code === "string" ? b.code.replace(/\s+/g, "") : b.code), z);
    } catch (e: any) {
      console.error(`[ZUGANG-UEBERGABE] ${pfad.split("/").pop()}:`, e?.message || e);
      res.status(500).json({ ok: false, error: "Das hat gerade nicht geklappt. Bitte gleich noch einmal versuchen." });
    }
  });
}

/** Nur für den Prüfstand: die Drossel zwischen zwei Abschnitten leeren. */
export function drosselLeeren(): void { drossel.clear(); }

export default router;
