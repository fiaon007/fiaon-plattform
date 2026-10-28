// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › BESUCHER › GOOGLE (28.10.2026, E-454)
//
// Justin: „Ja Zugang — die Google-Zahlen landen automatisch im Chefbüro."
// Zwei Wege, beide hinter der Chefbüro-Wand:
//   GET  /chef/google          liest den abgelegten Stand (nie direkt bei Google)
//   POST /chef/google/abrufen  holt jetzt neu — nur Geschäftsführung und Inhaber;
//                              läuft im Hintergrund, die Seite fragt nach.
// Die Arbeit selbst steht in server/lib/fiaon-search-console.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { gscAbrufEinmal, gscHandErgebnis, gscLaeuft, gscStand } from "../lib/fiaon-search-console";

const router = Router();
/** Von Hand höchstens alle zehn Minuten — die URL-Prüfung hat ein Tagesbudget. */
const HAND_PAUSE_MS = 10 * 60_000;
let letzterHandabruf = 0;

const darfAbrufen = (req: Request) => {
  const stufe = (req as ChefRequest).chef?.stufe;
  return stufe === "inhaber" || stufe === "geschaeftsfuehrung";
};

router.get("/chef/google", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const stand = await gscStand();
    res.json({ ok: true, ...stand, laeuft: gscLaeuft(), darfAbrufen: darfAbrufen(req), hand: gscHandErgebnis() });
  } catch (err) {
    console.error("[GSC] lesen:", err);
    res.status(500).json({ ok: false, error: "Die Google-Zahlen ließen sich nicht laden." });
  }
});

router.post("/chef/google/abrufen", requireChef("geschaeftsfuehrung"), (_req: Request, res: Response) => {
  if (gscLaeuft()) return res.json({ ok: true, laeuft: true });
  const warten = letzterHandabruf + HAND_PAUSE_MS - Date.now();
  if (warten > 0) {
    return res.status(429).json({ ok: false, error: `Gerade erst abgerufen — wieder in ${Math.ceil(warten / 60_000)} Min.` });
  }
  letzterHandabruf = Date.now();
  // Im Hintergrund: Die URL-Prüfung dauert bis zu zwei Minuten.
  gscAbrufEinmal({ vonHand: true }).catch((e) => console.error("[GSC] Abruf von Hand:", e));
  res.json({ ok: true, laeuft: true });
});

export default router;
