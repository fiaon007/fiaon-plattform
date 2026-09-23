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

// ═══════════════════════════════════════════════════════════════════════════
// /fb — DIE DANKE-SEITE DES META-FORMULARS (22.09.2026, E-210)
//
// Der Mensch hat gerade das Formular abgeschickt und tippt auf „Antrag
// abschließen". In dieser Sekunde ist seine Absicht am höchsten — er darf
// NICHT auf einer Seite landen, die ihn noch einmal von vorn überzeugt, und
// erst recht nicht seine Daten ein zweites Mal tippen.
//
// Meta hängt die Lead-Kennung an die Adresse (`?lid={{lead_id}}`). Damit:
//   1. Lead in unserer Datenbank? → seinen persönlichen Code nehmen.
//   2. Noch nicht da (die Meldung ist Sekunden unterwegs)? → den Lead SOFORT
//      bei Meta holen und anlegen. Der Antrag wartet nicht auf den Webhook.
//   3. Nichts zu finden (Kennung fehlt, Meta hat sie nicht ersetzt)? → auf die
//      Startseite, nie in eine Sackgasse.
// ═══════════════════════════════════════════════════════════════════════════
const RUECKFALL = "/start?quelle=fb-formular";

/** Holt den Lead notfalls in Echtzeit bei Meta — der Mensch wartet davor. */
async function leadFuerMetaKennung(lid: string): Promise<number | null> {
  const { sqlPool } = await import("../lib/db-pool");
  const [da] = (await sqlPool`SELECT id FROM fiaon_leads WHERE meta_lead_id = ${lid} LIMIT 1`.catch(() => [])) as any[];
  if (da?.id) return Number(da.id);
  const { metaKonfig, graph } = await import("../lib/fiaon-meta");
  if (!metaKonfig().bereit) return null;
  const { LEAD_FELDER, metaLeadEinspielen } = await import("../lib/fiaon-meta-leads");
  const roh = await graph(lid, { params: { fields: LEAD_FELDER }, app: "leads" });
  const erg = await metaLeadEinspielen(roh as any, "meta_webhook", null);
  return erg.leadId;
}

router.get("/fb", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  const roh = String(req.query.lid ?? "").trim();
  // Meta ersetzt die Platzhalter beim Klick. Steht die Klammer noch da, hat es
  // nicht geklappt — dann ist die Kennung kein Wert, sondern Text.
  const lid = /^\d{3,25}$/.test(roh) ? roh : "";
  try {
    if (!lid) { res.redirect(302, RUECKFALL); return; }
    const leadId = await Promise.race([
      leadFuerMetaKennung(lid),
      new Promise<null>((r) => setTimeout(() => r(null), 4000)),
    ]);
    if (!leadId) { res.redirect(302, RUECKFALL); return; }
    const { kurzlinkFuerLead, kurzlinkLesen, klickZaehlen } = await import("../lib/fiaon-kurzlink");
    const code = await kurzlinkFuerLead(leadId);
    const lage = await kurzlinkLesen(code);
    if (lage) await klickZaehlen(lage, "f", lage.antrag ? "weiter" : "antrag").catch(() => {});
    console.log(`[FB-DANKE] Lead ${leadId} (Meta ${lid}) geht direkt in den Antrag.`);
    res.redirect(302, `/antrag?l=${encodeURIComponent(code)}&k=f`);
  } catch (err) {
    console.error("[FB-DANKE]", err);
    res.redirect(302, RUECKFALL);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// /e/:code — WER HAT WEN GEBRACHT (23.09.2026, E-214)
//
// Florentine: „Michaela Schneider hat gefragt, ob es Provisionen für Neukunden
// gibt, wenn sie FIAON weiterempfiehlt."
//
// Der Link führt auf /start wie jeder andere Weg auch — die Landingpage ist die
// beste, die wir haben, und ein eigener Bildschirm wäre eine zweite Strecke,
// die niemand pflegt. Mitgegeben wird nur, WER empfohlen hat: als Cookie, das
// der Antrag beim Absenden liest (dieselbe Bauart wie der Antrags-Cookie aus
// E-152), und als `quelle=empfehlung` für die Auswertung.
//
// Ein unbekannter oder abgelaufener Code landet trotzdem auf /start. Wer hier
// klickt, will zu FIAON — eine Fehlerseite wäre die schlechteste Antwort.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/e/:code", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  try {
    const { empfehlerFuerCode } = await import("../lib/fiaon-empfehlung");
    const e = await empfehlerFuerCode(String(req.params.code || "")).catch(() => null);
    if (e) {
      res.cookie("fiaon_e", String(req.params.code), {
        httpOnly: true, sameSite: "lax", secure: true,
        maxAge: 90 * 24 * 60 * 60 * 1000, path: "/",
      });
    }
    res.redirect(302, `/start?quelle=${e ? "empfehlung" : "empfehlung-unbekannt"}`);
  } catch (err) {
    console.error("[EMPFEHLUNG] /e:", err);
    res.redirect(302, "/start?quelle=empfehlung");
  }
});

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
