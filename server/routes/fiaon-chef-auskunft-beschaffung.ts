// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · AUSKUNFT-BESCHAFFUNG — das Backend von /chef/s/auskunft-beschaffung
// (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
// Hier arbeitet, wer die bezahlten Bonitätsauskünfte beschafft: Er sieht je
// Auftrag alles, was er zum Bestellen braucht (Name, Geburtsdatum, Anschrift
// samt Voranschrift, Land, Auskunfteien, bezahlt am, fällig ab, Einwilligung),
// übernimmt ihn, lädt das PDF hoch — und der Rest passiert von selbst: Ablage
// als Auskunft-Dokument der Person, Analyse, Mail „Ihre Auskunft ist da".
// Die Regeln stehen in server/lib/fiaon-auskunft-lieferung.ts (Abschnitt 5),
// der Anschluss für die API in server/lib/fiaon-auskunft-quelle.ts.
//
//   GET  /chef/auskunft-beschaffung                   Stand + Aufträge (liest den Rückstand ein)
//   POST /chef/auskunft-beschaffung/modus             {modus: einkauf|vollmacht|api}
//   POST /chef/auskunft-beschaffung/:id/aktion        {aktion, notiz?}
//   POST /chef/auskunft-beschaffung/:id/auftrag-link  {nochmal?}  (alter Pfad …/vollmacht-link gilt weiter)
//   POST /chef/auskunft-beschaffung/:id/hochladen     multipart: datei (PDF, bis 6), auskunfteien
//   POST /chef/auskunft-beschaffung/:id/mail          die Mail der letzten Lieferung erneut
//   POST /chef/auskunft-beschaffung/api-abrufen       fällige Aufträge über die API holen
//
// Wache wie der Auskunft-Verkauf (fiaon-chef-auskunft.ts): Geschäftsführung.
// Die Seite zeigt Geburtsdatum und Anschrift — das ist nichts für jede Stufe.
// Jeder schreibende Aufruf steht über requireChef im fiaon_admin_log.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import {
  LIEFERMODUS_SCHLUESSEL, BESCHAFFUNG_PDF_MAX, auskunftLiefermodus, istLiefermodus, beschaffungListe, rueckstandEinlesen,
  beschaffungAktion, beschaffungHochladen, beschaffungMailNachholen, auftragLinkSenden, apiFaelligeAbrufen,
  auftragLinksAlleSenden, beschaffungSammelStand, beschaffungVerantwortlichSetzen, beschaffungWache,
  type BeschaffungAktion, type BeschaffungAuftrag,
} from "../lib/fiaon-auskunft-lieferung";
import { auskunftApiAngebunden } from "../lib/fiaon-auskunft-quelle";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

const AKTIONEN: BeschaffungAktion[] = ["uebernehmen", "problem", "notiz", "wieder_offen", "abschliessen"];

/** Wer im Chefbüro sitzt — mit Namen, damit „übernommen von …" etwas sagt. */
async function wer(req: ChefRequest): Promise<{ name: string; agentId: number | null }> {
  const agentId = req.chef?.agentId ?? null;
  if (!agentId) return { name: "Chefbüro", agentId: null };
  const [a] = (await sqlPool`
    SELECT COALESCE(NULLIF(name, ''), TRIM(CONCAT_WS(' ', first_name, last_name))) AS name FROM fiaon_agents WHERE id = ${agentId} LIMIT 1
  `.catch(() => [])) as any[];
  return { name: String(a?.name || `Chef #${agentId}`), agentId };
}

function idAus(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Die Zahlen oben — gezählt aus derselben Liste, die darunter steht. */
function zahlen(liste: BeschaffungAuftrag[]) {
  const offen = liste.filter((a) => a.status !== "fertig");
  return {
    // Gegenlesen 25.09.2026 (E-241): nicht mehr bezahlt (erstattet, storniert) zählt nie als „jetzt beschaffen“.
    jetzt: offen.filter((a) => a.status !== "problem" && a.faellig && a.einwilligung.ja && !a.dokumentDa && a.bestellung.bezahlt).length,
    einwilligungFehlt: offen.filter((a) => a.status !== "problem" && !a.einwilligung.ja).length,
    wartet: offen.filter((a) => a.status !== "problem" && !a.faellig && a.einwilligung.ja).length,
    mailFehlt: offen.filter((a) => a.status === "hochgeladen").length,
    problem: offen.filter((a) => a.status === "problem").length,
    offen: offen.length,
    fertig30: liste.filter((a) => a.status === "fertig").length,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// GET — der Stand. Liest dabei den Rückstand ein (ohne Mail an die Kunden).
// ───────────────────────────────────────────────────────────────────────────
/**
 * GET /chef/auskunft-beschaffung/auswertungen — die Arbeitsliste der Bonitätsauswertung (E-352, 14.10.2026).
 *
 * Daniel (Team-Chat 14.10.): „Wir brauchen eine Lösung für die ganzen bezahlten Bonitätsauskünfte, die nie
 * ankamen … viele Kunden, die 74 € bezahlt und alles hochgeladen haben.“ Gemessen 14.10.: 72 bezahlte Auskünfte,
 * 44 mit Ausweis und Kontoauszug, 2 Auswertungen (beide Entwurf). Diese Liste zeigt jeden bezahlten Kunden mit
 * seinem Stand und führt in die Akte — dort steht der Knopf. Sie startet NICHTS (Justin: „nicht automatisch
 * erstellen, sondern ERST wenn man den Knopf drückt“).
 */
router.get("/chef/auskunft-beschaffung/auswertungen", wache, async (_req: Request, res: Response) => {
  try {
    const { IST_AUSKUNFT, ECHT } = await import("../lib/fiaon-umsatz-quelle");
    const { ensureFinanzauswertungTabellen } = await import("../lib/fiaon-finanzauswertung");
    await ensureFinanzauswertungTabellen();
    const zeilen = (await sqlPool.unsafe(`
      WITH k AS (
        SELECT a.person_id, MIN(COALESCE(a.paid_at, a.completed_at)) AS bezahlt_am
          FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
         WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL AND ${IST_AUSKUNFT} AND ${ECHT}
         GROUP BY a.person_id
      )
      SELECT k.person_id, k.bezahlt_am,
             TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
             ag.name AS betreuer,
             EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.person_id = k.person_id AND b.merged_into IS NULL AND b.id_card_pdf IS NOT NULL) AS ausweis,
             (EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.person_id = k.person_id AND b.merged_into IS NULL AND b.bank_statement_pdf IS NOT NULL)
              OR EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = k.person_id AND d.kategorie = 'kontoauszug'
                           AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL)) AS auszug,
             f.status AS fa_status, f.gesamt, f.finanzwert, f.vier_augen, f.freigegeben_am, f.erstellt_am AS fa_am
        FROM k
        JOIN fiaon_persons p ON p.id = k.person_id
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
        LEFT JOIN LATERAL (
          SELECT status, gesamt, finanzwert, vier_augen, freigegeben_am, erstellt_am FROM fiaon_finanzauswertungen fz
           WHERE fz.person_id = k.person_id AND fz.status IN ('laeuft', 'entwurf', 'freigegeben', 'fehler')
           ORDER BY (fz.status = 'freigegeben') DESC, fz.erstellt_am DESC LIMIT 1
        ) f ON TRUE`)) as any[];
    const stand = (z: any): "fehlt" | "bereit" | "laeuft" | "entwurf" | "beim_kunden" =>
      z.fa_status === "freigegeben" ? "beim_kunden" : z.fa_status === "entwurf" ? "entwurf" : z.fa_status === "laeuft" ? "laeuft"
        : z.ausweis && z.auszug ? "bereit" : "fehlt";
    const RANG = { bereit: 0, laeuft: 1, entwurf: 2, fehlt: 3, beim_kunden: 4 } as const;
    const liste = zeilen.map((z) => ({
      personId: Number(z.person_id), name: String(z.name || "").trim() || `Person ${z.person_id}`, betreuer: z.betreuer ?? null,
      bezahltAm: z.bezahlt_am ? new Date(z.bezahlt_am).toISOString() : null, ausweis: !!z.ausweis, kontoauszug: !!z.auszug,
      stand: stand(z), gesamt: z.gesamt ?? null, finanzwert: z.finanzwert != null ? Number(z.finanzwert) : null, vierAugen: !!z.vier_augen,
      gescheitert: z.fa_status === "fehler",
    })).sort((a, b) => RANG[a.stand] - RANG[b.stand] || String(a.bezahltAm ?? "").localeCompare(String(b.bezahltAm ?? "")));
    const zahlen = { gesamt: liste.length, bereit: 0, laeuft: 0, entwurf: 0, fehlt: 0, beim_kunden: 0 } as Record<string, number>;
    for (const z of liste) zahlen[z.stand]++;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, zahlen, liste });
  } catch (err) {
    console.error("[AUSKUNFT-BESCHAFFUNG] auswertungen:", err);
    res.status(500).json({ ok: false, error: "Die Liste ließ sich nicht laden." });
  }
});

router.get("/chef/auskunft-beschaffung", wache, async (_req: Request, res: Response) => {
  try {
    const rueckstandNeu = await rueckstandEinlesen().catch((e) => {
      console.error("[CHEF-BESCHAFFUNG] Rückstand einlesen:", e);
      return 0;
    });
    const [modus, liste] = await Promise.all([auskunftLiefermodus(), beschaffungListe()]);
    const { antraegeFreigeschaltet } = await import("./fiaon-app");
    res.json({
      ok: true,
      stand: new Date().toISOString(),
      modus,
      apiAngebunden: auskunftApiAngebunden(),
      unterschriftAn: await antraegeFreigeschaltet().catch(() => false),
      pdfMaxMb: Math.round(BESCHAFFUNG_PDF_MAX / 1024 / 1024),
      rueckstandNeu,
      zahlen: zahlen(liste),
      // E-IT-D (08.10.2026, 4a): Sammelknopf, Wache und benannte Verantwortung.
      sammel: await beschaffungSammelStand(liste),
      auftraege: liste,
    });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Stand:", err);
    res.status(500).json({ ok: false, error: "Die Beschaffung ließ sich nicht laden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /modus — der Lieferweg (fiaon_settings.auskunft_liefermodus)
// ───────────────────────────────────────────────────────────────────────────
// Integration 25.09.2026 (E-241): geschrieben über einstellungSetzen des Verkaufstakts (EINE Erlaubnisliste)
// und protokolliert wie die Steuerung auf /chef/s/auskunft (Ziel „auskunft-einstellung:auskunft_liefermodus",
// „Liefermodus: alt → neu") — vorher schrieb diese Route am Protokoll der Steuerung vorbei.
router.post("/chef/auskunft-beschaffung/modus", wache, async (req: ChefRequest, res: Response) => {
  try {
    const modus = String(req.body?.modus ?? "").trim().toLowerCase();
    if (!istLiefermodus(modus)) return res.status(400).json({ ok: false, error: "Erlaubt sind einkauf, vollmacht und api." });
    const { einstellungSetzen, verkaufEinstellungen, SCHALTER_LIEFERMODUS } = await import("../lib/fiaon-auskunft-verkauf");
    const vorher = (await verkaufEinstellungen()).liefermodus;
    const erg = await einstellungSetzen(SCHALTER_LIEFERMODUS, modus);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    const w = await wer(req);
    if (vorher !== erg.einstellungen.liefermodus) {
      await chefProtokoll(req, `auskunft-einstellung:${SCHALTER_LIEFERMODUS}`, `Liefermodus: ${vorher} → ${erg.einstellungen.liefermodus}`);
    }
    console.log(`[CHEF-BESCHAFFUNG] ${LIEFERMODUS_SCHLUESSEL} = ${modus} durch ${w.name}`);
    res.json({ ok: true, modus: erg.einstellungen.liefermodus });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Modus:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/aktion — übernehmen, Problem, Notiz, wieder öffnen, abschließen
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/:id/aktion", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    const aktion = String(req.body?.aktion ?? "") as BeschaffungAktion;
    if (!id || !AKTIONEN.includes(aktion)) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag oder unbekannte Aktion." });
    const erg = await beschaffungAktion(id, aktion, await wer(req), String(req.body?.notiz ?? ""));
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text });
    res.json({ ok: true, text: erg.text });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Aktion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/auftrag-link — der Link zur Auftragsbestätigung (25.09.2026, E-241)
// Vorher „…/vollmacht-link" auf /app/unterschrift: Die Vollmacht deckt den Kauf
// nicht und hakte alle sieben Antragsarten vor. Der alte Pfad bleibt als
// zweiter Name derselben Route — ein Browser mit altem Stand schickt ihn noch.
// ───────────────────────────────────────────────────────────────────────────
router.post(["/chef/auskunft-beschaffung/:id/auftrag-link", "/chef/auskunft-beschaffung/:id/vollmacht-link"], wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
    const erg = await auftragLinkSenden(id, await wer(req), { nochmal: req.body?.nochmal === true });
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text, mail: erg.mail });
    res.json({ ok: true, text: erg.text, mail: erg.mail });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Link zur Auftragsbestätigung:", err);
    res.status(500).json({ ok: false, error: "Der Link ließ sich nicht senden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/hochladen — das PDF der Auskunft (nur PDF, bis 25 MB je Datei)
// Multer erst hier laden — die Route ist selten, der Speicher liegt im RAM.
// ───────────────────────────────────────────────────────────────────────────
router.post(
  "/chef/auskunft-beschaffung/:id/hochladen",
  wache,
  (req: Request, res: Response, next: NextFunction) => {
    import("multer")
      .then(({ default: multer }) => {
        multer({ storage: multer.memoryStorage(), limits: { fileSize: BESCHAFFUNG_PDF_MAX, files: 6, fields: 4 } })
          .array("datei", 6)(req as any, res as any, (err: any) => {
            if (err) {
              return res.status(400).json({
                ok: false,
                error: err?.code === "LIMIT_FILE_SIZE" ? "Die Datei ist größer als 25 MB." : err?.code === "LIMIT_FILE_COUNT" ? "Höchstens sechs Dateien auf einmal." : "Die Datei konnte nicht gelesen werden.",
              });
            }
            next();
          });
      })
      .catch(() => res.status(500).json({ ok: false, error: "Upload nicht verfügbar." }));
  },
  async (req: ChefRequest, res: Response) => {
    try {
      const id = idAus(req);
      if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
      const dateien = (((req as any).files ?? []) as { buffer: Buffer; originalname: string }[])
        .map((f) => ({ buffer: f.buffer, name: String(f.originalname || "auskunft.pdf").slice(0, 120) }));
      const auskunfteien = String(req.body?.auskunfteien ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const erg = await beschaffungHochladen(id, { dateien, auskunfteien, wer: await wer(req) });
      if (!erg.ok) return res.status(400).json({ ok: false, error: erg.text });
      res.json({ ok: true, text: erg.text, status: erg.status, mail: erg.mail, hinweis: erg.hinweis ?? null });
    } catch (err) {
      console.error("[CHEF-BESCHAFFUNG] Hochladen:", err);
      res.status(500).json({ ok: false, error: "Das Hochladen ist gescheitert." });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/mail — die Mail „Ihre Auskunft ist da" der letzten Lieferung erneut
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
    const erg = await beschaffungMailNachholen(id);
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text });
    res.json({ ok: true, text: erg.text, status: erg.status });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Mail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// E-IT-D (08.10.2026, 4a): DER RÜCKSTAND WIRD GELIEFERT
//   POST /auftrag-links-alle   „Auftragsbestätigung an alle offenen senden" — Datenkopie-Weg,
//                              je Auftrag höchstens einmal in 72 Stunden (auftragLinksAlleSenden)
//   POST /verantwortlich       {agentId | null} — wer die Aufgaben der Liegezeit-Wache bekommt
//   POST /wache                die Liegezeit-Wache jetzt laufen lassen (sonst alle 6 Stunden)
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/auftrag-links-alle", wache, async (req: ChefRequest, res: Response) => {
  try {
    const erg = await auftragLinksAlleSenden(await wer(req));
    await chefProtokoll(req, "auskunft-beschaffung:auftrag-links-alle",
      `Sammelknopf: ${erg.gesendet} gesendet, ${erg.fehlgeschlagen} fehlgeschlagen, ${erg.aufDatenkopie} auf Datenkopie gestellt, ${erg.uebersprungen.length} übersprungen`);
    res.json({ ok: true, ...erg, text: `${erg.gesendet} Auftragsbestätigungen verschickt${erg.aufDatenkopie ? `, ${erg.aufDatenkopie} Aufträge auf den Datenkopie-Weg gestellt` : ""}${erg.fehlgeschlagen ? `, ${erg.fehlgeschlagen} nicht zugestellt (${erg.texte.slice(0, 3).join(" · ")})` : ""}.` });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Sammelknopf:", err);
    res.status(500).json({ ok: false, error: "Der Sammelversand ist gescheitert." });
  }
});

router.post("/chef/auskunft-beschaffung/verantwortlich", wache, async (req: ChefRequest, res: Response) => {
  try {
    const roh = req.body?.agentId;
    const agentId = roh === null || roh === "" || roh === undefined ? null : Number(roh);
    if (agentId != null && (!Number.isInteger(agentId) || agentId <= 0)) return res.status(400).json({ ok: false, error: "Unbekannte Person." });
    const erg = await beschaffungVerantwortlichSetzen(agentId);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.text });
    await chefProtokoll(req, "auskunft-beschaffung:verantwortlich", erg.text);
    res.json({ ok: true, text: erg.text });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Verantwortung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/chef/auskunft-beschaffung/wache", wache, async (req: ChefRequest, res: Response) => {
  try {
    const erg = await beschaffungWache();
    await chefProtokoll(req, "auskunft-beschaffung:wache", `Wache von Hand: ${erg.aufgaben} Aufgaben, ${erg.dringend} dringend, ${erg.anrufe} Anrufe`);
    res.json({ ok: true, ...erg, text: erg.aufgaben + erg.dringend + erg.anrufe
      ? `${erg.aufgaben} Aufgaben, ${erg.dringend} dringende, ${erg.anrufe} Anruf-Aufgaben angelegt.`
      : "Nichts liegt über der Frist — keine neue Aufgabe." });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Wache:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /api-abrufen — alle heute fälligen Aufträge mit Beschaffungsauftrag über die API
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/api-abrufen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    if ((await auskunftLiefermodus()) !== "api") return res.status(409).json({ ok: false, error: "Der Lieferweg steht nicht auf „API“." });
    const erg = await apiFaelligeAbrufen();
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] API-Abruf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
