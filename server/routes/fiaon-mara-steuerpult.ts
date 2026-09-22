// ═══════════════════════════════════════════════════════════════════════════
// MARAS STEUERPULT (21.09.2026, Justin)
//
// „Ich möchte die Arbeit von Mara einsehen, im Detail sehen können, steuern
// können und ALLES nachvollziehen können."
//
// Nur Chefbüro, nur Stufe „inhaber" (wie die Telefonkartei). Alles, was hier
// steht, liest aus denselben Tabellen, die Mara schreibt: fiaon_mara_aktion
// (jede Mail der Aktion, vollständig), fiaon_postmeister (jede Antwort im
// Postfach), fiaon_mara_gedaechtnis (was sie sich merkt), fiaon_ki_nutzung
// (was es kostet).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import {
  aktionTabellen, aktionZaehler, einstellungenLesen, einstellungSetzen, kandidatenLaden, mailSchreiben, maraAktionLauf,
  AKTION_SCHLUESSEL, DIENST,
} from "../lib/fiaon-mara-aktion";
import { gedaechtnisLesen, gedaechtnisLoeschen } from "../lib/fiaon-mara-gedaechtnis";
import { anweisungLesen, anweisungSetzen, anweisungVerlauf, anweisungZurueck, BEREICHE, BEREICH_TEXT, MAX_ZEICHEN, type Bereich } from "../lib/fiaon-mara-anweisung";

const router = Router();
const wache = requireChef("inhaber");
const tag = (d: any) => (d ? new Date(d).toISOString() : null);
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");

/** Der Stand auf einen Blick. */
router.get("/chef/mara/stand", wache, async (_req: ChefRequest, res: Response) => {
  try {
    await aktionTabellen();
    const e = await einstellungenLesen();
    const z = await aktionZaehler(e);
    const schlange = await kandidatenLaden(40, e.stufen.length ? e.stufen : ["A", "B"]);
    const [zahlen] = (await sqlPool`
      WITH m AS (SELECT * FROM fiaon_mara_aktion WHERE status = 'gesendet' AND gesendet_am > NOW() - INTERVAL '14 days')
      SELECT (SELECT COUNT(*)::int FROM m) AS gesendet,
             (SELECT COUNT(DISTINCT person_id)::int FROM m) AS menschen,
             (SELECT COUNT(DISTINCT m.person_id)::int FROM m WHERE EXISTS (
                SELECT 1 FROM fiaon_postmeister pm WHERE pm.person_id = m.person_id AND pm.empfangen_am > m.gesendet_am)) AS antworten,
             (SELECT COUNT(DISTINCT m.person_id)::int FROM m WHERE EXISTS (
                SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.claimed_paid_at > m.gesendet_am)) AS gemeldet,
             (SELECT COUNT(DISTINCT m.person_id)::int FROM m WHERE EXISTS (
                SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.payment_status = 'paid' AND a.paid_at > m.gesendet_am)) AS bezahlt,
             (SELECT COUNT(*)::int FROM fiaon_mara_aktion WHERE status = 'abgelehnt' AND created_at > NOW() - INTERVAL '14 days') AS abgelehnt,
             (SELECT COUNT(*)::int FROM fiaon_mara_aktion WHERE status = 'fehler' AND created_at > NOW() - INTERVAL '14 days') AS fehler,
             (SELECT COUNT(*)::int FROM fiaon_mara_ausschluss) AS ausgeschlossen
    `) as any[];
    const [post] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE empfangen_am > date_trunc('day', NOW()))::int AS heute_rein,
             COUNT(*) FILTER (WHERE gesendet_am > date_trunc('day', NOW()))::int AS heute_beantwortet,
             COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS entwuerfe
        FROM fiaon_postmeister WHERE empfangen_am > NOW() - INTERVAL '30 days'`.catch(() => [{}])) as any[];
    const [kosten] = (await sqlPool`
      SELECT COALESCE(SUM(kosten_cents) FILTER (WHERE created_at > date_trunc('day', NOW())), 0)::float AS heute,
             COALESCE(SUM(kosten_cents), 0)::float AS woche
        FROM fiaon_ki_nutzung WHERE dienst = ${DIENST} AND created_at > NOW() - INTERVAL '7 days'`.catch(() => [{}])) as any[];
    res.json({
      ok: true,
      einstellungen: e,
      zaehler: z,
      zahlen: { ...zahlen, postfach: post },
      kosten: { heuteEuro: Number(kosten?.heute || 0) / 100, wocheEuro: Number(kosten?.woche || 0) / 100 },
      schlange: schlange.map((k) => ({
        personId: k.personId, ref: k.ref, stufe: k.stufe, schritt: k.schritt,
        name: [k.vorname, k.nachname].filter(Boolean).join(" ") || k.email,
        paket: k.paket, betragEuro: k.betragEuro, wunschlimit: k.wunschlimit,
        ereignisAm: k.ereignisAm, zuletztAm: k.zuletztAm,
      })),
    });
  } catch (err: any) {
    console.error("[MARA-STEUERPULT] stand:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

/** Die Mails der Aktion — neueste zuerst, mit Antwort und Zahlung danach. */
router.get("/chef/mara/mails", wache, async (req: ChefRequest, res: Response) => {
  try {
    await aktionTabellen();
    const status = ["gesendet", "abgelehnt", "fehler"].includes(String(req.query.status)) ? String(req.query.status) : "gesendet";
    const vor = Number(req.query.vor) || 2_147_483_647;
    const zeilen = (await sqlPool`
      SELECT m.id, m.person_id, m.ref, m.stufe, m.schritt, m.status, m.grund, m.betreff, m.text, m.empfaenger, m.created_at, m.gesendet_am, m.kosten_cents,
             COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), m.empfaenger) AS name,
             (SELECT MIN(pm.empfangen_am) FROM fiaon_postmeister pm WHERE pm.person_id = m.person_id AND pm.empfangen_am > m.gesendet_am) AS antwort_am,
             (SELECT MIN(a.claimed_paid_at) FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.claimed_paid_at > m.gesendet_am) AS gemeldet_am,
             (SELECT MIN(a.paid_at) FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.payment_status = 'paid' AND a.paid_at > m.gesendet_am) AS bezahlt_am,
             EXISTS (SELECT 1 FROM fiaon_mara_ausschluss x WHERE x.person_id = m.person_id) AS ausgeschlossen
        FROM fiaon_mara_aktion m LEFT JOIN fiaon_persons p ON p.id = m.person_id
       WHERE m.status = ${status} AND m.id < ${vor}
       ORDER BY m.id DESC LIMIT 60
    `) as any[];
    res.json({
      ok: true,
      mails: zeilen.map((z) => ({
        id: Number(z.id), personId: Number(z.person_id), ref: z.ref, stufe: z.stufe, schritt: Number(z.schritt), status: z.status,
        grund: z.grund, betreff: z.betreff, text: z.text, empfaenger: z.empfaenger, name: z.name,
        am: tag(z.gesendet_am ?? z.created_at), antwortAm: tag(z.antwort_am), gemeldetAm: tag(z.gemeldet_am), bezahltAm: tag(z.bezahlt_am),
        kostenCent: Number(z.kosten_cents || 0), ausgeschlossen: z.ausgeschlossen === true,
      })),
    });
  } catch (err: any) {
    console.error("[MARA-STEUERPULT] mails:", err);
    res.status(500).json({ ok: false, error: "Die Mails ließen sich nicht laden." });
  }
});

/** Alles zu einem Menschen: Gedächtnis, Aktions-Mails, Postfach. */
router.get("/chef/mara/person/:id", wache, async (req: ChefRequest, res: Response) => {
  const personId = Number(req.params.id);
  if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Ungültige Person." });
  try {
    await aktionTabellen();
    const [gedaechtnis, mails, post, aus] = await Promise.all([
      gedaechtnisLesen(personId),
      sqlPool`SELECT id, stufe, schritt, status, grund, betreff, gesendet_am, created_at FROM fiaon_mara_aktion WHERE person_id = ${personId} ORDER BY id DESC LIMIT 30`,
      sqlPool`SELECT id, empfangen_am, betreff, zusammenfassung, aktion, gesendet_am FROM fiaon_postmeister WHERE person_id = ${personId} ORDER BY empfangen_am DESC LIMIT 20`.catch(() => []),
      sqlPool`SELECT grund, von, created_at FROM fiaon_mara_ausschluss WHERE person_id = ${personId}`,
    ]);
    res.json({ ok: true, gedaechtnis, mails, postfach: post, ausschluss: (aus as any[])[0] ?? null });
  } catch (err: any) {
    console.error("[MARA-STEUERPULT] person:", err);
    res.status(500).json({ ok: false, error: "Die Person ließ sich nicht laden." });
  }
});

/** Einstellung ändern — nur die Schlüssel der Aktion, mit Grenzen. */
router.post("/chef/mara/einstellung", wache, async (req: ChefRequest, res: Response) => {
  const schluessel = String(req.body?.schluessel || "");
  let wert = String(req.body?.wert ?? "").trim();
  if (!AKTION_SCHLUESSEL.includes(schluessel)) return res.status(400).json({ ok: false, error: "Diese Einstellung gibt es nicht." });
  if (schluessel === "mara_aktion_an" || schluessel === "mara_aktion_emojis") wert = wert === "an" ? "an" : "aus";
  // 22.09.2026 (Justin): kein Anlauf, kein 50er-Deckel mehr — die Grenzen sind
  // dieselben wie in fiaon-mara-aktion.ts (500 je Stunde, 500 € am Tag).
  if (schluessel === "mara_aktion_je_stunde") wert = String(Math.max(0, Math.min(500, Math.round(Number(wert) || 0))));
  if (schluessel === "mara_aktion_tag_euro") wert = String(Math.max(0, Math.min(500, Math.round(Number(wert) || 0))));
  if (schluessel === "mara_aktion_stufen") wert = wert.toUpperCase().split(",").map((x) => x.trim()).filter((x) => x === "A" || x === "B").join(",");
  if (schluessel === "mara_aktion_postfach" && !["support@fiaon.com", "welcome@fiaon.com"].includes(wert)) return res.status(400).json({ ok: false, error: "Nur support@ oder welcome@." });
  try {
    await einstellungSetzen(schluessel, wert);
    console.log(`[MARA-STEUERPULT] ${wer(req)}: ${schluessel} = ${wert}`);
    res.json({ ok: true, einstellungen: await einstellungenLesen() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || "Nicht gespeichert.") });
  }
});

/** Probe: Mara schreibt die nächste Mail — oder die an einen bestimmten Menschen — OHNE zu senden. */
router.post("/chef/mara/probe", wache, async (req: ChefRequest, res: Response) => {
  try {
    const e = await einstellungenLesen();
    const personId = Number(req.body?.personId) || null;
    const schlange = await kandidatenLaden(personId ? 500 : 1, e.stufen.length ? e.stufen : ["A", "B"]);
    const k = personId ? schlange.find((x) => x.personId === personId) : schlange[0];
    if (!k) return res.status(404).json({ ok: false, error: personId ? "Dieser Mensch steht gerade nicht in der Schlange (Takt, Rücksicht oder Stopp)." : "Die Schlange ist leer." });
    const m = await mailSchreiben(k, e);
    res.json({ ok: true, fuer: { personId: k.personId, name: [k.vorname, k.nachname].filter(Boolean).join(" "), stufe: k.stufe, schritt: k.schritt }, probe: m });
  } catch (err: any) {
    console.error("[MARA-STEUERPULT] probe:", err);
    res.status(500).json({ ok: false, error: "Die Probe ist gescheitert." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MARAS KOPF: ANWEISEN UND NACHVOLLZIEHEN (22.09.2026, E-210)
// Justin: „ich muss im DETAIL sehen, wie Mara denkt, was sie macht … ihre
// Ansprache, ihren gesamten Auftrag einsehen und ändern können."
// ═══════════════════════════════════════════════════════════════════════════

/** Die Hausanweisung je Bereich — mit allen früheren Fassungen. */
router.get("/chef/mara/anweisung", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const bereiche = await Promise.all(BEREICHE.map(async (b) => ({
      bereich: b,
      titel: BEREICH_TEXT[b],
      text: await anweisungLesen(b),
      verlauf: (await anweisungVerlauf(b, 12)).map((v) => ({
        id: Number(v.id), text: String(v.text), von: v.von ?? null, aktiv: v.aktiv === true, am: tag(v.erstellt_am),
      })),
    })));
    res.json({ ok: true, bereiche, maxZeichen: MAX_ZEICHEN });
  } catch (err) {
    console.error("[MARA-STEUERPULT] anweisung:", err);
    res.status(500).json({ ok: false, error: "Die Anweisung ließ sich nicht laden." });
  }
});

/** Eine neue Fassung — die alte bleibt erhalten. */
router.post("/chef/mara/anweisung", wache, async (req: ChefRequest, res: Response) => {
  const bereich = String(req.body?.bereich || "") as Bereich;
  if (!BEREICHE.includes(bereich)) return res.status(400).json({ ok: false, error: "Diesen Bereich gibt es nicht." });
  try {
    const r = await anweisungSetzen(bereich, String(req.body?.text ?? ""), wer(req));
    console.log(`[MARA-STEUERPULT] ${wer(req)}: Anweisung ${bereich} = ${r.zeichen} Zeichen`);
    res.json({ ok: true, zeichen: r.zeichen });
  } catch (err) {
    console.error("[MARA-STEUERPULT] anweisung speichern:", err);
    res.status(500).json({ ok: false, error: "Nicht gespeichert." });
  }
});

/** Eine frühere Fassung zurückholen. */
router.post("/chef/mara/anweisung/zurueck", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültige Fassung." });
  const ok = await anweisungZurueck(id, wer(req)).catch(() => false);
  res.json({ ok, ...(ok ? {} : { error: "Diese Fassung gibt es nicht mehr." }) });
});

/** Das Denkprotokoll einer geschriebenen Mail: was sie wusste, was geprüft wurde. */
router.get("/chef/mara/denkprotokoll/:id", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültig." });
  try {
    await aktionTabellen();
    const [m] = (await sqlPool`
      SELECT m.id, m.person_id, m.ref, m.stufe, m.schritt, m.status, m.grund, m.betreff, m.text, m.pruefung,
             m.kosten_cents, m.created_at, m.gesendet_am, m.empfaenger,
             COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), m.empfaenger) AS name
        FROM fiaon_mara_aktion m LEFT JOIN fiaon_persons p ON p.id = m.person_id
       WHERE m.id = ${id}`) as any[];
    if (!m) return res.status(404).json({ ok: false, error: "Diese Mail gibt es nicht." });
    const pruefung = typeof m.pruefung === "string" ? JSON.parse(m.pruefung) : (m.pruefung ?? {});
    const verlauf = (await sqlPool`
      SELECT agent_name, type, note, created_at FROM fiaon_contact_log
       WHERE person_id = ${Number(m.person_id)} ORDER BY created_at DESC LIMIT 12`.catch(() => [])) as any[];
    res.json({
      ok: true,
      mail: {
        id: Number(m.id), personId: Number(m.person_id), name: m.name, ref: m.ref, stufe: m.stufe,
        schritt: Number(m.schritt), status: m.status, grund: m.grund ?? null, betreff: m.betreff,
        text: m.text, kostenCent: Number(m.kosten_cents || 0), am: tag(m.gesendet_am ?? m.created_at),
      },
      wissen: pruefung?.wissen ?? null,
      maengel: pruefung?.maengel ?? [],
      gedaechtnis: await gedaechtnisLesen(Number(m.person_id)).catch(() => []),
      verlauf: verlauf.map((v) => ({ wer: v.agent_name ?? "System", art: v.type, text: String(v.note || "").slice(0, 300), am: tag(v.created_at) })),
    });
  } catch (err) {
    console.error("[MARA-STEUERPULT] denkprotokoll:", err);
    res.status(500).json({ ok: false, error: "Das Protokoll ließ sich nicht laden." });
  }
});

/** Einen Menschen aus der Aktion nehmen — oder wieder hinein. */
router.post("/chef/mara/ausschluss", wache, async (req: ChefRequest, res: Response) => {
  const personId = Number(req.body?.personId);
  if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Ungültige Person." });
  try {
    await aktionTabellen();
    if (req.body?.aus === false) {
      await sqlPool`DELETE FROM fiaon_mara_ausschluss WHERE person_id = ${personId}`;
    } else {
      await sqlPool`INSERT INTO fiaon_mara_ausschluss (person_id, grund, von) VALUES (${personId}, ${String(req.body?.grund || "im Steuerpult").slice(0, 200)}, ${wer(req)})
                    ON CONFLICT (person_id) DO UPDATE SET grund = EXCLUDED.grund, von = EXCLUDED.von, created_at = NOW()`;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Nicht gespeichert." });
  }
});

/** Einen Merksatz aus Maras Gedächtnis löschen. */
router.post("/chef/mara/gedaechtnis/loeschen", wache, async (req: ChefRequest, res: Response) => {
  const personId = Number(req.body?.personId);
  const index = Number(req.body?.index);
  if (!Number.isInteger(personId) || !Number.isInteger(index)) return res.status(400).json({ ok: false, error: "Ungültig." });
  const ok = await gedaechtnisLoeschen(personId, index).catch(() => false);
  res.json({ ok, gedaechtnis: await gedaechtnisLesen(personId) });
});

/** Einen Durchgang jetzt anstoßen — dieselben Regeln wie der Takt. */
router.post("/chef/mara/durchgang", wache, async (_req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ergebnis: await maraAktionLauf() });
  } catch (err: any) {
    console.error("[MARA-STEUERPULT] durchgang:", err);
    res.status(500).json({ ok: false, error: "Der Durchgang ist gescheitert." });
  }
});

export default router;
