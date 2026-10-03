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
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import { tageslauf } from "../lib/fiaon-crons";
import { sqlPool } from "../lib/db-pool";
import {
  aktionTabellen, aktionZaehler, einstellungenLesen, einstellungSetzen, kandidatenLaden, mailSchreiben, maraAktionLauf, rundeStand,
  AKTION_SCHLUESSEL, DIENST,
} from "../lib/fiaon-mara-aktion";
import { gedaechtnisLesen, gedaechtnisLoeschen } from "../lib/fiaon-mara-gedaechtnis";
import { anweisungLesen, anweisungSetzen, anweisungVerlauf, anweisungZurueck, BEREICHE, BEREICH_TEXT, MAX_ZEICHEN, type Bereich } from "../lib/fiaon-mara-anweisung";
import { maraBilanz, geldSql, aktionWirkung14, danachSql } from "../lib/fiaon-mara-bilanz";
import { istKiPause, kiPauseLesen, aktivieren as kiAktivieren, pausieren as kiPausieren } from "../lib/fiaon-ki-pause";
import { waBremseLage, aktivieren as waAktivieren, pausieren as waPausieren, metaStandLesen, WA_FEHLER_ART } from "../lib/fiaon-wa-bremse";

const router = Router();
const wache = requireChef("inhaber");
const tag = (d: any) => (d ? new Date(d).toISOString() : null);
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");

// ═══════════════════════════════════════════════════════════════════════════
// KI-PAUSE (27.09.2026, E-246)
//
// Justin: „Wenn OpenAI nicht abbuchen kann, dann soll alles, was über OpenAI
// läuft, pausieren … einfach Pause, bis ich es wieder aktiviere."
//
// Lesen darf jede Chefbüro-Stufe (das Band steht im Kopf JEDER /chef-Seite);
// aktivieren und von Hand pausieren nur der Inhaber. Jeder Klick steht im
// Chef-Protokoll (requireChef schreibt jede Nicht-GET-Anfrage) und im Verlauf
// des Zustands selbst (fiaon_settings.ki_pause, verlauf).
// Die Regeln stehen in server/lib/fiaon-ki-pause.ts.
// ═══════════════════════════════════════════════════════════════════════════
const chefLesen = requireChef("leitung");

/**
 * Was an der Pause hängt — nur Zahlen, die sich ehrlich zählen lassen.
 * Nachprüfung 27.09.: nur Pause-bezogen. WhatsApp zählt offene Gespräche, deren
 * letzte Nachricht NACH Pausenbeginn (−15 Min., wie zuAltFuerMara) kam — nicht
 * alles, was aus anderen Gründen offen ist (Kostendeckel, Nachtruhe, Mara aus).
 * Auswertungen nur, wenn die Datei noch an der Bestellung liegt.
 */
export async function liegenGeblieben(seit: string | null): Promise<{ whatsapp: number; mails: number; auswertungen: number; transkripte: number }> {
  const zahl = async (q: Promise<any[]>) => Number(((await q.catch(() => [{ n: 0 }])) as any[])[0]?.n || 0);
  const { OFFENE_GESPRAECHE_SQL } = await import("../lib/fiaon-whatsapp-mara");
  const ab = new Date((seit ? new Date(seit).getTime() : Date.now()) - 15 * 60_000);
  return {
    whatsapp: await zahl(sqlPool.unsafe(`SELECT COUNT(*)::int AS n FROM (${OFFENE_GESPRAECHE_SQL}\n) o WHERE o.am >= $1`, [ab]) as any),
    mails: await zahl(sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_postmeister WHERE aktion = 'vorgeordnet' AND begruendung LIKE 'KI pausiert%'` as any),
    auswertungen: await zahl(sqlPool`
      SELECT (SELECT COUNT(*) FROM (SELECT DISTINCT ON (ref) ref, status, fehler FROM fiaon_kontoauszug_analysen ORDER BY ref, created_at DESC) k
                JOIN fiaon_applications a ON a.ref = k.ref AND a.bank_statement_pdf IS NOT NULL AND a.gdpr_deleted_at IS NULL
               WHERE k.status = 'fehler' AND k.fehler LIKE 'KI pausiert%')
           + (SELECT COUNT(*) FROM (SELECT DISTINCT ON (ref) ref, status, fehler FROM fiaon_schufa_analysen ORDER BY ref, created_at DESC) s
                JOIN fiaon_applications a ON a.ref = s.ref AND a.schufa_pdf IS NOT NULL AND a.gdpr_deleted_at IS NULL
               WHERE s.status = 'fehler' AND s.fehler LIKE 'KI pausiert%') AS n` as any),
    transkripte: await zahl(sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE transkript_status = 'offen' AND transkript_grund LIKE 'KI pausiert%' AND ohne_aufzeichnung_am IS NULL` as any),
  };
}

router.get("/chef/ki-pause", chefLesen, async (_req: ChefRequest, res: Response) => {
  try {
    const zustand = await kiPauseLesen(true);
    res.json({ ok: true, zustand, liegen: zustand.an ? await liegenGeblieben(zustand.seit) : null });
  } catch (err) {
    console.error("[KI-PAUSE] stand:", err);
    res.status(500).json({ ok: false, error: "Der KI-Zustand ließ sich nicht lesen." });
  }
});

/** „KI wieder aktivieren" — erst ein Probe-Aufruf; bucht OpenAI noch nicht ab, bleibt die Pause. */
router.post("/chef/ki-pause/aktivieren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const r = await kiAktivieren(wer(req));
    if (!r.ok) return res.status(409).json({ ok: false, error: r.fehler, zustand: r.zustand });
    res.json({ ok: true, zustand: r.zustand, hinweis: r.hinweis ?? null });
  } catch (err) {
    console.error("[KI-PAUSE] aktivieren:", err);
    res.status(500).json({ ok: false, error: "Das Aktivieren ist gescheitert — die Pause bleibt." });
  }
});

/** „KI jetzt pausieren" — von Hand, ohne Alarm (Justin weiß es ja). */
router.post("/chef/ki-pause/pausieren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const grund = String(req.body?.grund ?? "").trim().slice(0, 200) || "Von Hand im Chefbüro angehalten.";
    const r = await kiPausieren({ art: "hand", fehler: grund, dienst: "chefbuero", von: wer(req) });
    res.json({ ok: true, zustand: r.zustand, schonPausiert: !r.neu });
  } catch (err) {
    console.error("[KI-PAUSE] pausieren:", err);
    res.status(500).json({ ok: false, error: "Das Pausieren ist gescheitert." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP-BREMSE (29.09.2026, E-261)
//
// Wie die KI-Pause: Lesen darf jede Chefbüro-Stufe (das rote Band steht im Kopf
// JEDER /chef-Seite), aktivieren und von Hand pausieren nur der Inhaber. Jeder
// Klick steht im Chef-Protokoll und im Verlauf des Zustands (fiaon_settings.wa_pause).
// Die Regeln stehen in server/lib/fiaon-wa-bremse.ts.
// ═══════════════════════════════════════════════════════════════════════════
/** Die letzten 24 Stunden Kontofehler je Code — was die Bremse gesehen hat (leer vor Migration 086 / ohne Fehler). */
async function kontofehler24(): Promise<{ code: number; art: string; satz: string; anzahl: number; zuletzt: string | null }[]> {
  const zeilen = (await sqlPool`
    SELECT code, COUNT(*)::int AS n, MAX(am) AS zuletzt FROM fiaon_wa_kontofehler
     WHERE am > NOW() - INTERVAL '24 hours' GROUP BY code ORDER BY n DESC LIMIT 12`.catch(() => [])) as any[];
  return zeilen.map((z) => ({
    code: Number(z.code), anzahl: Number(z.n || 0), zuletzt: z.zuletzt ? new Date(z.zuletzt).toISOString() : null,
    art: WA_FEHLER_ART[Number(z.code)]?.art ?? "sonst", satz: WA_FEHLER_ART[Number(z.code)]?.satz ?? `Meta-Fehler #${z.code}`,
  }));
}

router.get("/chef/wa-pause", chefLesen, async (_req: ChefRequest, res: Response) => {
  try {
    const lage = await waBremseLage();
    res.json({
      ok: true, zustand: lage.pause, stand: lage.stand,
      bremse: { qualitaet: lage.qualitaet, faktor: lage.faktor, satz: lage.satz, werbungGestoppt: lage.werbungGestoppt, allesGestoppt: lage.allesGestoppt, rotGehalten: lage.rotGehalten, metaMeldet: lage.metaMeldet },
      kontofehler: await kontofehler24(),
    });
  } catch (err) {
    console.error("[WA-BREMSE] stand:", err);
    res.status(500).json({ ok: false, error: "Der WhatsApp-Zustand ließ sich nicht lesen." });
  }
});

/** „WhatsApp wieder aktivieren" — erst Metas Kontostand (health_status, keine Nachricht); meldet Meta „gesperrt", bleibt die Pause. */
router.post("/chef/wa-pause/aktivieren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const r = await waAktivieren(wer(req));
    if (!r.ok) return res.status(409).json({ ok: false, error: r.fehler, zustand: r.zustand });
    res.json({ ok: true, zustand: r.zustand, hinweis: r.hinweis ?? null });
  } catch (err) {
    console.error("[WA-BREMSE] aktivieren:", err);
    res.status(500).json({ ok: false, error: "Das Aktivieren ist gescheitert — die Pause bleibt." });
  }
});

/** „WhatsApp jetzt pausieren" — von Hand, ohne Alarm (Justin weiß es ja). Antworten im offenen Fenster laufen weiter. */
router.post("/chef/wa-pause/pausieren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const grund = String(req.body?.grund ?? "").trim().slice(0, 200) || "Von Hand im Chefbüro angehalten.";
    const r = await waPausieren({ art: "hand", fehler: grund, von: wer(req), quelle: "hand" });
    res.json({ ok: true, zustand: r.zustand, schonPausiert: !r.neu });
  } catch (err) {
    console.error("[WA-BREMSE] pausieren:", err);
    res.status(500).json({ ok: false, error: "Das Pausieren ist gescheitert." });
  }
});

/**
 * Metas Qualität und Kontostand jetzt frisch lesen (nur GET bei Meta). `frisch` = Meta hat wirklich
 * geantwortet (der Stand ist jünger als der Klick) — sonst kommt der letzte Stand zurück, und die Karte
 * sagt „Meta nicht erreichbar — gezeigt wird der Stand von …" (Gegenprüfung 29.09.).
 */
router.post("/chef/wa-meta-stand/pruefen", chefLesen, async (_req: ChefRequest, res: Response) => {
  try {
    const klick = Date.now();
    const stand = await metaStandLesen({ frisch: true });
    const frisch = !!stand.am && Date.parse(stand.am) >= klick;
    const lage = await waBremseLage();
    res.json({ ok: true, frisch, stand, bremse: { qualitaet: lage.qualitaet, faktor: lage.faktor, satz: lage.satz, werbungGestoppt: lage.werbungGestoppt, allesGestoppt: lage.allesGestoppt, rotGehalten: lage.rotGehalten, metaMeldet: lage.metaMeldet } });
  } catch (err) {
    console.error("[WA-BREMSE] Meta-Stand:", err);
    res.status(500).json({ ok: false, error: "Metas Stand ließ sich nicht lesen." });
  }
});

/** Der Stand auf einen Blick. */
router.get("/chef/mara/stand", wache, async (_req: ChefRequest, res: Response) => {
  try {
    await aktionTabellen();
    const e = await einstellungenLesen();
    const z = await aktionZaehler(e);
    const schlange = await kandidatenLaden(40, e.stufen.length ? e.stufen : ["A", "B"]);
    // E-276 (02.10.2026): die Runde für alle offenen Erstzahler — „Runde seit … — X geschrieben, Y offen“ (null ohne Runde).
    const runde = await rundeStand(e).catch(() => null);
    // E-244 (26.09.2026): „bezahlt" las a.paid_at — das setzt eine bezahlte Rate nie, die Kachel
    // stand bei 0, obwohl 4 Zahlungen gebucht waren. Jetzt gebuchtes Geld aus Maras Bilanz-Logik.
    const zahlen = await aktionWirkung14();
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
      runde,
      zahlen: { ...zahlen, bezahltEuro: Number(zahlen?.bezahlt_cents || 0) / 100, postfach: post },
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

// ═══════════════════════════════════════════════════════════════════════════
// MARAS BILANZ (26.09.2026, E-244)
// Justin: „Wo finde ich Maras Abschlussbericht? Ich will wissen, was wir durch
// Mara bislang hatten oder durch die neuen Leads." — heute / 7 Tage / seit
// Start, fünf Wege plus Rahmen. Die Rechnung steht in fiaon-mara-bilanz.ts,
// 60 Sekunden zwischengespeichert (?frisch=1 rechnet neu).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/mara/bilanz", wache, async (req: ChefRequest, res: Response) => {
  try {
    res.json(await maraBilanz({ frisch: req.query.frisch === "1" }));
  } catch (err) {
    console.error("[MARA-STEUERPULT] bilanz:", err);
    res.status(500).json({ ok: false, error: "Die Bilanz ließ sich nicht rechnen." });
  }
});

/** Die Mails der Aktion — neueste zuerst, mit Antwort und Zahlung danach. */
router.get("/chef/mara/mails", wache, async (req: ChefRequest, res: Response) => {
  try {
    await aktionTabellen();
    const status = ["gesendet", "abgelehnt", "fehler"].includes(String(req.query.status)) ? String(req.query.status) : "gesendet";
    const vor = Number(req.query.vor) || 2_147_483_647;
    // E-244: „bezahlt" = erste GEBUCHTE Zahlung höchstens 14 Tage nach dieser Mail (vorher a.paid_at,
    // das bei Raten nie gesetzt wird). Dieselbe Geld-Quelle wie Maras Bilanz; Raten nach Eingangstag
    // (danachSql: Tag nach dem Tag der Mail), weil bezahlt_am keine echte Uhrzeit trägt.
    const zeilen = (await sqlPool.unsafe(`
      WITH seite AS (
        SELECT * FROM fiaon_mara_aktion WHERE status = $1 AND id < $2 ORDER BY id DESC LIMIT 60),
      geld AS (SELECT * FROM (${geldSql()}) g0 WHERE g0.person_id IN (SELECT person_id FROM seite WHERE person_id IS NOT NULL))
      SELECT m.id, m.person_id, m.ref, m.stufe, m.schritt, m.status, m.grund, m.betreff, m.text, m.empfaenger, m.created_at, m.gesendet_am, m.kosten_cents,
             COALESCE(NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''), m.empfaenger) AS name,
             (SELECT MIN(pm.empfangen_am) FROM fiaon_postmeister pm WHERE pm.person_id = m.person_id AND pm.empfangen_am > m.gesendet_am) AS antwort_am,
             (SELECT MIN(a.claimed_paid_at) FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.claimed_paid_at > m.gesendet_am) AS gemeldet_am,
             (SELECT MIN(g.am) FROM geld g WHERE g.person_id = m.person_id AND ${danachSql("g", "m.gesendet_am")}) AS bezahlt_am,
             EXISTS (SELECT 1 FROM fiaon_mara_ausschluss x WHERE x.person_id = m.person_id) AS ausgeschlossen
        FROM seite m LEFT JOIN fiaon_persons p ON p.id = m.person_id
       ORDER BY m.id DESC
    `, [status, vor])) as any[];
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
    if (istKiPause(err)) return res.status(409).json({ ok: false, error: String(err.message) }); // E-246
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

// ═══════════════════════════════════════════════════════════════════════════
// MARA ANWEISEN — DIE ROUTEN (23.09.2026, E-219)
//
// Justin schreibt einen Satz, Mara legt einen Plan vor, er bestätigt mit einem
// Klick. Nichts davon wirkt, bevor er geklickt hat — das ist seine Entscheidung
// vom 23.09. („Plan zeigen, du bestätigst mit einem Klick").
// ═══════════════════════════════════════════════════════════════════════════
router.post("/chef/mara/auftrag", wache, async (req: ChefRequest, res: Response) => {
  try {
    const befehl = String(req.body?.befehl ?? "").trim();
    if (befehl.length < 4) return res.status(400).json({ ok: false, error: "Sag mir in einem Satz, was ich tun soll." });
    const { auftragAnlegen } = await import("../lib/fiaon-mara-auftrag");
    const a = await auftragAnlegen(befehl, wer(req));
    res.json({ ok: true, auftrag: a });
  } catch (err) {
    if (istKiPause(err)) return res.status(409).json({ ok: false, error: String((err as Error).message) }); // E-246
    console.error("[MARA] auftrag:", err);
    res.status(500).json({ ok: false, error: "Der Plan ließ sich nicht bauen." });
  }
});

router.post("/chef/mara/auftrag/:id/ausfuehren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { auftragAusfuehren } = await import("../lib/fiaon-mara-auftrag");
    res.json(await auftragAusfuehren(Number(req.params.id), wer(req)));
  } catch (err) {
    console.error("[MARA] ausfuehren:", err);
    res.status(500).json({ ok: false, error: "Der Auftrag ist abgebrochen." });
  }
});

router.post("/chef/mara/auftrag/:id/verwerfen", wache, async (req: ChefRequest, res: Response) => {
  const { auftragVerwerfen } = await import("../lib/fiaon-mara-auftrag");
  const ok = await auftragVerwerfen(Number(req.params.id), wer(req));
  res.status(ok ? 200 : 409).json(ok ? { ok: true } : { ok: false, error: "Dieser Auftrag lässt sich nicht mehr verwerfen." });
});

router.get("/chef/mara/auftraege", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { auftraege, dauerauftraege, WERKZEUGE, maraTag } = await import("../lib/fiaon-mara-auftrag");
    const [liste, dauer, tag] = await Promise.all([auftraege(40), dauerauftraege(), maraTag()]);
    res.json({
      ok: true,
      auftraege: liste.map((a: any) => ({
        id: Number(a.id), befehl: a.befehl, absicht: a.absicht, status: a.status,
        rueckfrage: a.rueckfrage,
        plan: typeof a.plan === "string" ? JSON.parse(a.plan) : a.plan,
        ergebnis: typeof a.ergebnis === "string" ? JSON.parse(a.ergebnis) : a.ergebnis,
        von: a.von, erstelltAm: a.erstellt_am, fertigAm: a.fertig_am, dauerauftragId: a.dauerauftrag_id,
      })),
      dauerauftraege: dauer.map((d: any) => ({
        id: Number(d.id), befehl: d.befehl, takt: d.takt, uhrzeit: d.uhrzeit, an: d.an === true,
        letzterLauf: d.letzter_lauf, letzteMeldung: d.letzte_meldung,
      })),
      werkzeuge: WERKZEUGE.map((w) => ({ name: w.name, beschreibung: w.beschreibung, klasse: w.klasse, felder: w.felder })),
      tag,
    });
  } catch (err) {
    console.error("[MARA] auftraege:", err);
    res.status(500).json({ ok: false, error: "Die Aufträge ließen sich nicht laden." });
  }
});

router.post("/chef/mara/dauerauftrag", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { dauerauftragAnlegen } = await import("../lib/fiaon-mara-auftrag");
    const befehl = String(req.body?.befehl ?? "").trim();
    if (befehl.length < 4) return res.status(400).json({ ok: false, error: "Sag mir in einem Satz, was regelmäßig passieren soll." });
    res.json({ ok: true, dauerauftrag: await dauerauftragAnlegen(befehl, String(req.body?.takt ?? "taeglich"), String(req.body?.uhrzeit ?? "09:00"), wer(req)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Der Dauerauftrag ließ sich nicht anlegen." });
  }
});

router.post("/chef/mara/dauerauftrag/:id", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { dauerauftragSchalten, dauerauftragLoeschen } = await import("../lib/fiaon-mara-auftrag");
    if (req.body?.loeschen === true) await dauerauftragLoeschen(Number(req.params.id));
    else await dauerauftragSchalten(Number(req.params.id), req.body?.an === true);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Das ließ sich nicht ändern." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MARAS TERMINE — REITER „TERMINE" (29.09.2026, E-260)
//
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können als Chef auf
// einer eigenen übersichtlichen cleanen Seite … Die anderen Mitarbeiter
// arbeiten erst wieder am Freitag. Bis dahin schupfe ich das ganze."
//
//   GET  /chef/mara/termine              die Übersicht (nur lesend)
//   POST /chef/mara/abwesenheit          { an, bis?, vertreterId?, fuer? }
//   POST /chef/mara/termine/:id/ergebnis { ergebnis: "erledigt" | "verpasst", notiz? }
//
// Stufe „inhaber" wie das ganze Steuerpult. requireChef schreibt jede
// Nicht-GET-Anfrage ins Chef-Protokoll; die beiden Schreib-Routen setzen dazu
// eine Zeile mit Ziel und Inhalt (chefProtokoll). Regeln:
// server/lib/fiaon-abwesenheit.ts, fiaon-termin-uebersicht.ts, fiaon-termin-ergebnis.ts.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/mara/termine", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { terminUebersicht } = await import("../lib/fiaon-termin-uebersicht");
    res.json(await terminUebersicht({ chefAgentId: req.chef?.agentId ?? null }));
  } catch (err) {
    console.error("[MARA-STEUERPULT] termine:", err);
    res.status(500).json({ ok: false, error: "Die Termine ließen sich nicht laden." });
  }
});

router.post("/chef/mara/abwesenheit", wache, async (req: ChefRequest, res: Response) => {
  try {
    const an = req.body?.an === true;
    const fuer = Array.isArray(req.body?.fuer) ? (req.body.fuer as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0) : null;
    const vertreterId = Number(req.body?.vertreterId) > 0 ? Number(req.body.vertreterId) : null;
    const bis = req.body?.bis != null ? String(req.body.bis).slice(0, 40) : null;
    const { abwesenheitSetzen } = await import("../lib/fiaon-abwesenheit");
    const r = await abwesenheitSetzen({ an, bis, vertreterId, fuer }, wer(req));
    if (!r.ok) return res.status(409).json({ ok: false, error: r.fehler });
    void chefProtokoll(req, "team_abwesenheit", r.was ?? (an ? "an" : "aus"));
    console.log(`[MARA-STEUERPULT] ${wer(req)}: Team-Abwesenheit ${r.was}`);
    const { abwesenheitSicht } = await import("../lib/fiaon-termin-uebersicht");
    res.json({ ok: true, was: r.was ?? null, abwesenheit: await abwesenheitSicht(req.chef?.agentId ?? null) });
  } catch (err) {
    console.error("[MARA-STEUERPULT] abwesenheit:", err);
    res.status(500).json({ ok: false, error: "Die Abwesenheit ließ sich nicht speichern — Mara bucht weiter wie vorher." });
  }
});

router.post("/chef/mara/termine/:id/ergebnis", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.params.id);
  const ergebnis = String(req.body?.ergebnis ?? "");
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültiger Termin." });
  if (ergebnis !== "erledigt" && ergebnis !== "verpasst") return res.status(400).json({ ok: false, error: "Ergebnis muss „erledigt“ oder „verpasst“ sein." });
  try {
    const [t] = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.agent_id, t.quelle, t.status,
             COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS bei
        FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
       WHERE t.id = ${id} AND t.status IN ('gebucht', 'verpasst')`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Diesen offenen Termin gibt es nicht mehr — vielleicht hat ihn gerade jemand abgeschlossen. Die Liste lädt neu." });
    // Startgespräch und FIAON Global haben eigene Wege (Freischaltung und Gutschrift bzw. Firmen-Cockpit).
    if (String(t.quelle) === "onboarding_call") return res.status(409).json({ ok: false, error: "Ein Startgespräch schließt du in der Akte ab — dort hängen Freischaltung und Gutschrift daran." });
    if (String(t.quelle) === "global") return res.status(409).json({ ok: false, error: "Ein Erstgespräch zu FIAON Global schließt du im Firmen-Cockpit ab." });
    const chefId = req.chef?.agentId ?? null;
    const [ich] = chefId ? (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${chefId}`) as any[] : [null];
    const fuer = chefId && Number(t.agent_id) !== chefId && t.bei ? `, für ${t.bei}` : "";
    const { terminErgebnisSetzen } = await import("../lib/fiaon-termin-ergebnis");
    const erg = await terminErgebnisSetzen({
      terminId: id, personId: Number(t.person_id), beginn: t.beginn,
      ergebnis, notiz: req.body?.notiz ? String(req.body.notiz).slice(0, 2000) : null,
      akteur: { id: chefId, name: `${ich?.name ?? "Inhaber"} (Chefbüro${fuer})` },
    });
    void chefProtokoll(req, `termin:${id}`, `${ergebnis} (Agent ${t.agent_id}, Person ${t.person_id})`);
    res.json({ ok: true, hinweis: erg.hinweis });
  } catch (err) {
    console.error("[MARA-STEUERPULT] termin-ergebnis:", err);
    res.status(500).json({ ok: false, error: "Das Ergebnis ließ sich nicht speichern — der Termin steht unverändert." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERMINE IN DEINEM KALENDER (29.09.2026, E-263) — Karte im Reiter „Termine"
//
// Justin: „… ‚Alle Termine zu Kalender hinzufügen' … pflegen sich automatisch
// ein … wenn ich nochmal drauf klicke und 1 neuer Termin ist hinzugekommen dann
// nur der 1 Termin, nicht alle anderen doppelt."
//
//   GET  /chef/mara/kalender-abo                       { eigene, team } (legt an, was fehlt)
//   POST /chef/mara/kalender-abo/:umfang/erneuern      neuer Link, der alte hört sofort auf
//   POST /chef/mara/kalender-abo/:umfang/beenden
//
// Zwei Abos am Konto des Chefs (Justin: 928, Gründer + Vertretung): „eigene"
// und „team" (die Termine der Mitarbeiter OHNE die eigenen — beide zusammen =
// der Filter „Alle", jeder Termin genau einmal; Gegenprüfung 29.09.2026). Das
// Team-Abo gibt es NUR hier (Stufe inhaber) — die Mitarbeiter-Route kennt nur
// „eigene", und kontoDarfAbo verlangt für „team" die Stufe am Konto selbst.
// Regeln: server/lib/fiaon-kalender-abo.ts; jede Änderung steht im Chef-Protokoll.
// ═══════════════════════════════════════════════════════════════════════════
async function chefKalenderKonto(req: ChefRequest): Promise<number | null> {
  if (req.chef?.agentId) return req.chef.agentId;
  const { gruenderAgentId } = await import("./fiaon-gruender-termin");
  return (await gruenderAgentId().catch(() => 0)) || null;
}

router.get("/chef/mara/kalender-abo", wache, async (req: ChefRequest, res: Response) => {
  try {
    const k = await import("../lib/fiaon-kalender-abo");
    if (!(await k.aboTabelleDa())) return res.json({ ok: true, eingerichtet: false, eigene: null, team: null });
    const agentId = await chefKalenderKonto(req);
    if (!agentId) return res.status(409).json({ ok: false, error: "Kein Mitarbeiterkonto für den Chef gefunden — das Abo braucht eins." });
    const eigene = await k.aboHolen(agentId, "eigene", wer(req));
    const team = await k.aboHolen(agentId, "team", wer(req));
    res.json({ ok: true, eingerichtet: true, eigene: eigene ? k.aboSicht(eigene) : null, team: team ? k.aboSicht(team) : null });
  } catch (err) {
    console.error("[MARA-STEUERPULT] kalender-abo:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).json({ ok: false, error: "Die Kalender-Abos ließen sich nicht laden." });
  }
});

router.post("/chef/mara/kalender-abo/:umfang/:aktion", wache, async (req: ChefRequest, res: Response) => {
  const umfang = String(req.params.umfang || "");
  const aktion = String(req.params.aktion || "");
  if ((umfang !== "eigene" && umfang !== "team") || (aktion !== "erneuern" && aktion !== "beenden")) {
    return res.status(404).json({ ok: false, error: "Unbekannte Aktion." });
  }
  try {
    const k = await import("../lib/fiaon-kalender-abo");
    const agentId = await chefKalenderKonto(req);
    if (!agentId) return res.status(409).json({ ok: false, error: "Kein Mitarbeiterkonto für den Chef gefunden." });
    if (aktion === "beenden") {
      await k.aboBeenden(agentId, umfang, wer(req));
      void chefProtokoll(req, `kalender_abo:${umfang}`, "beendet");
      return res.json({ ok: true, beendet: true, abo: null });
    }
    const abo = await k.aboErneuern(agentId, umfang, wer(req));
    void chefProtokoll(req, `kalender_abo:${umfang}`, "neuer Link");
    res.json({ ok: true, abo: abo ? k.aboSicht(abo) : null });
  } catch (err) {
    console.error("[MARA-STEUERPULT] kalender-abo ändern:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).json({ ok: false, error: "Das hat nicht geklappt — bitte noch einmal." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER TAKT FÜR DIE DAUERAUFTRÄGE (23.09.2026, E-219)
//
// Alle zehn Minuten nachsehen, ob einer dran ist. Die Uhrzeit prüft der Lauf
// selbst (Berliner Zeit), deshalb ohne `alleXStunden` — sonst könnte ein
// Auftrag für 9:00 Uhr um 14:00 Uhr nachgeholt werden, und der Kunde bekäme
// seine Geburtstagsnachricht am Nachmittag.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("mara-dauerauftraege", async () => {
  const { dauerauftraegeLaufen } = await import("../lib/fiaon-mara-auftrag");
  await dauerauftraegeLaufen();
}, 10 * 60 * 1000);

export default router;
