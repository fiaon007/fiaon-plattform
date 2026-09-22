// ═══════════════════════════════════════════════════════════════════════════
// /a/<code> UND DIE VORBELEGUNG DES ANTRAGS (22.09.2026, E-210)
//
// Zwei Türen, eine Regel (server/lib/fiaon-kurzlink.ts):
//   GET /a/:code(/:kanal)                     → zählt den Klick, leitet weiter
//   GET /api/fiaon/antrag/vorbelegung/:code   → Vorname, Nachname, E-Mail,
//                                                Vorwahl, Nummer — sonst nichts
// Beide liegen außerhalb aller Anmelde-Tore: Der Code IST die Berechtigung,
// und er ging nur an den Menschen selbst.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { kurzlinkLesen, klickZaehlen, kanalAus, codeGueltigeForm } from "../lib/fiaon-kurzlink";
import { nameBrauchbar, schreibweiseFuerAnzeige } from "../../shared/fiaon-anrede";

const router = Router();

/** Kein Index, kein Zwischenspeicher, keine Adresse im Referer an fremde Hosts. */
function schutzKoepfe(res: Response): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "private, no-store");
}

async function weiterleiten(req: Request, res: Response): Promise<void> {
  schutzKoepfe(res);
  const code = String(req.params.code || "");
  const kanal = kanalAus(req.params.kanal);
  try {
    const lage = codeGueltigeForm(code) ? await kurzlinkLesen(code) : null;
    if (!lage) {
      // Abgelaufen oder vertippt: kein Fehlerbildschirm, sondern der Antrag —
      // der Mensch wollte genau dorthin.
      res.redirect(302, "/antrag?quelle=link-abgelaufen");
      return;
    }
    if (lage.antrag?.bezahlt) {
      await klickZaehlen(lage, kanal, "bereich").catch((e) => console.error("[KURZLINK] Klick:", e));
      res.redirect(302, "/login");
      return;
    }
    if (lage.antrag) {
      const { weiterLink } = await import("../lib/fiaon-antrag-erinnerung");
      await klickZaehlen(lage, kanal, "weiter").catch((e) => console.error("[KURZLINK] Klick:", e));
      // weiterLink baut eine absolute Adresse — hier genügt der Pfad, damit der
      // Mensch auf der Domain bleibt, über die er kam.
      const ziel = new URL(weiterLink(lage.antrag.ref));
      res.redirect(302, `${ziel.pathname}${ziel.search}`);
      return;
    }
    await klickZaehlen(lage, kanal, "antrag").catch((e) => console.error("[KURZLINK] Klick:", e));
    res.redirect(302, `/antrag?l=${encodeURIComponent(lage.code)}${kanal !== "x" ? `&k=${kanal}` : ""}`);
  } catch (err) {
    console.error("[KURZLINK] Weiterleitung:", err);
    res.redirect(302, "/antrag");
  }
}

router.get("/a/:code", weiterleiten);
router.get("/a/:code/:kanal", weiterleiten);

/** Die Nummer für das Formular: Vorwahl und Rest getrennt — nur Deutschland, Österreich, Schweiz. */
export function nummerFuerFormular(e164: string | null | undefined): { vorwahl: string; nummer: string } | null {
  const n = String(e164 ?? "").replace(/[^\d+]/g, "");
  for (const vorwahl of ["+49", "+43", "+41"]) {
    if (n.startsWith(vorwahl) && n.length > vorwahl.length + 5) return { vorwahl, nummer: n.slice(vorwahl.length).replace(/^0+/, "") };
  }
  return null;
}

router.get("/api/fiaon/antrag/vorbelegung/:code", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  try {
    const lage = await kurzlinkLesen(String(req.params.code || ""));
    if (!lage) return res.status(404).json({ ok: false, error: "Dieser Link ist abgelaufen — Sie können den Antrag trotzdem direkt ausfüllen." });
    const nr = nummerFuerFormular(lage.telefon);
    res.json({
      ok: true,
      vorname: nameBrauchbar(lage.vorname) ? schreibweiseFuerAnzeige(lage.vorname) : "",
      nachname: nameBrauchbar(lage.nachname) ? schreibweiseFuerAnzeige(lage.nachname, "nachname") : "",
      email: lage.email || "",
      vorwahl: nr?.vorwahl || "",
      telefon: nr?.nummer || "",
    });
  } catch (err) {
    console.error("[KURZLINK] Vorbelegung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
