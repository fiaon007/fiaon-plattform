// ═══════════════════════════════════════════════════════════════════════════
// ARAS — der Wähler: Takt alle 20 s, die Wände, das Wählen (E-408, Vertrag § 4)
//
// Wände in dieser Reihenfolge — die erste, die hält, stoppt den Eintrag:
//   aras_an? · Notaus? · Leerlauf? · KI-Pause? · Tages-Deckel? · Parallel voll?
//   · je Stunde voll? · Spielart an? · Fenster (Land, Feiertag)? · Telefonsperre?
//   · Werbe-Spielart ohne Einwilligung? · CH ohne eingetragene Nummer?
//   · Versuche je Person/Tag/Woche (Mensch + ARAS zusammen)? · Mitarbeiter-
//   Anruf < 5 Min? · Adapter bereit? · Twilio bereit?
// Das Protokoll „ausgelassen“ sagt je Grund, wie viele hängen blieben — der
// Labs-Bereich zeigt es. Standard: aras_an = aus — ARAS wählt keinen Kunden,
// bis Justin ihn einschaltet. Der Probeanruf geht an der Wand vorbei, aber nur
// an die eine hinterlegte Nummer.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema, arasAusweisId } from "./fiaon-aras-schema";
import { arasEinstellungenLesen, einstellungSetzen, versucheHeute, reihen, arasKostenHeute, arasAusFuerPerson } from "./fiaon-aras-plan";
import { laufendeSitzungen, notausAlle } from "./fiaon-aras-bruecke";
import { briefingBauen } from "./fiaon-aras-briefing";
import { adapterFuer } from "./fiaon-aras-adapter";
import { arasEreignis } from "./fiaon-aras-ereignis";
import { telefonGesperrt, nummerKern } from "./fiaon-aras-sperre";
import { einwilligungGueltig } from "./fiaon-telefon-einwilligung";
import { twilioBereit, twilioClient, arasCallerId, rueckrufUrl, streamToken } from "./fiaon-aras-twilio-client";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { anweisungBauen } from "../../shared/fiaon-aras-prompt";
import { anweisungLesen } from "./fiaon-mara-anweisung";
import { fensterOffen, darfVersuch, istWerbeSpielart, stufenGrenzen, rateTagErlaubt, berlinTeile, ANRUF_ZEITLIMIT_SEK, type Spielart, type Land, type Kandidat } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;
export { versucheHeute };

export interface TaktErgebnis { gewaehlt: number; ausgelassen: { grund: string; n: number }[]; aus?: boolean }

let laeuft = false;

export async function waehlerTakt(lauf: Lauf = sqlPool): Promise<TaktErgebnis> {
  if (laeuft) return { gewaehlt: 0, ausgelassen: [{ grund: "takt_laeuft", n: 1 }] };
  laeuft = true;
  try { return await takt(lauf); } finally { laeuft = false; }
}

async function takt(lauf: Lauf): Promise<TaktErgebnis> {
  await arasSchema(lauf);
  const aus: Record<string, number> = {};
  const merken = (g: string, n = 1) => { aus[g] = (aus[g] ?? 0) + n; };
  const fertig = (gewaehlt: number, abgeschaltet = false): TaktErgebnis => ({ gewaehlt, ausgelassen: Object.entries(aus).map(([grund, n]) => ({ grund, n })), ...(abgeschaltet ? { aus: true } : {}) });

  const einst = await arasEinstellungenLesen(true, lauf);
  if (!einst.an) { merken("aras_aus"); return fertig(0, true); }
  if (einst.notaus) { merken("notaus"); return fertig(0, true); }
  if (einst.leerlauf) { merken("leerlauf"); return fertig(0, true); }
  // Verschobene Einträge (je Person/Tag voll, Twilio-Fehler, hängender Versuch) kommen zur neuen Zeit zurück in die Reihe —
  // sonst blieben sie für immer liegen (ein Auftrag aus der Akte ginge verloren). Nie zwei wartende je Person und Spielart.
  await lauf`UPDATE fiaon_aras_plan p SET status = 'wartet', updated_at = NOW()
              WHERE p.status = 'verschoben' AND p.frueh_ab <= NOW() AND p.spaet_bis >= NOW() AND p.spielart <> 'probe'
                AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.person_id = p.person_id AND x.spielart = p.spielart AND x.status = 'wartet')`.catch(() => null);
  // Stufenplan (hart): Stufe 0 = nur Probeanrufe — NIE ein Kunde, auch mit aras_an = an. Darüber gilt je Stufe das Engere
  // aus Stufe und Schalter (Gleichzeitig, Deckel, Gesprächsarten) und die Tagesmenge der Stufe.
  const grenzen = stufenGrenzen(einst);
  if (grenzen.stufe === 0) { merken("stufe_0"); return fertig(0, true); }
  const adapter = adapterFuer(einst.adapter);
  const bereit = await adapter.bereit();
  if (!bereit.ok) { merken(`adapter:${(bereit.grund ?? "nicht bereit").slice(0, 40)}`); return fertig(0); }
  if (einst.adapter !== "attrappe") { const t = twilioBereit(); if (!t.ok) { merken(`twilio_fehlt:${t.fehlt.join(",")}`); return fertig(0); } }
  const kosten = await arasKostenHeute(lauf);
  if (kosten.euro >= grenzen.tagEuro) {
    merken("deckel");
    const { alarmMelden } = await import("./fiaon-system-alarme");
    await alarmMelden("aras:deckel", { quelle: "aras", titel: "ARAS: Tagesdeckel erreicht", text: `${kosten.euro.toFixed(2)} € von ${grenzen.tagEuro} € (Stufe ${grenzen.stufe}) — kein neues Wählen heute.`, stufe: "gelb", link: "/chef/s/aras?reiter=probe", endetNachStunden: 12 }).catch(() => null);
    return fertig(0);
  }
  const laufend = laufendeSitzungen().length + Number(((await lauf`SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt' AND beginn > NOW() - INTERVAL '2 minutes'`) as any[])[0]?.n ?? 0);
  let frei = grenzen.parallel - laufend;
  if (frei <= 0) { merken("parallel_voll"); return fertig(0); }
  const [stunde] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_aras_anruf WHERE created_at > NOW() - INTERVAL '1 hour' AND spielart <> 'probe'`) as any[];
  if (Number(stunde?.n ?? 0) >= einst.jeStunde) { merken("je_stunde_voll"); return fertig(0); }
  const [heute] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_aras_anruf WHERE spielart <> 'probe' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  if (Number(heute?.n ?? 0) >= grenzen.versucheJeTag) { merken(`stufe_tagesmenge:${grenzen.versucheJeTag}`); return fertig(0); }

  const roh = (await lauf`
    SELECT * FROM fiaon_aras_plan WHERE status = 'wartet' AND frueh_ab <= NOW() AND spaet_bis >= NOW() AND spielart <> 'probe'
     ORDER BY prioritaet, frueh_ab LIMIT 200`) as any[];
  const kandidaten: (Kandidat & { zeile: any })[] = roh.map((z) => ({
    id: Number(z.id), spielart: z.spielart as Spielart, prioritaet: Number(z.prioritaet), fruehAb: new Date(z.frueh_ab), fehlFolge: Number(z.fehl_folge ?? 0),
    betragCents: z.betrag_cents != null ? Number(z.betrag_cents) : null, anlassAm: z.anlass_am ? new Date(z.anlass_am) : null, zeile: z,
  }));
  let gewaehlt = 0;
  for (const k of reihen(kandidaten)) {
    if (frei <= 0) break;
    const z = k.zeile;
    const land = (z.land as Land) || "DE";
    if (!einst.spielarten[k.spielart]) { merken(`spielart_aus:${k.spielart}`); continue; }
    if (!grenzen.spielartErlaubt(k.spielart)) { merken(`stufe:${k.spielart}`); continue; }
    if (k.spielart === "rate" && grenzen.regel.rateTage) {
      // Stufe 1: nur Tag 1–3 nach Fälligkeit — ohne bekanntes Fälligkeitsdatum gar nicht (hart, auch für Einträge von Hand).
      let faellig: Date | null = z.anlass_am ? new Date(z.anlass_am) : null;
      if (!faellig && z.rate_id) { const [r] = (await lauf`SELECT faellig_am FROM fiaon_abo_raten WHERE id = ${z.rate_id}`) as any[]; faellig = r?.faellig_am ? new Date(r.faellig_am) : null; }
      if (!faellig) { merken("stufe:rate_ohne_datum"); continue; }
      const tage = Math.round((Date.parse(`${berlinTeile(new Date()).datum}T12:00:00Z`) - Date.parse(`${berlinTeile(faellig).datum}T12:00:00Z`)) / 86_400_000);
      if (!rateTagErlaubt(grenzen.stufe, tage)) { merken("stufe:rate_tag"); continue; }
    }
    if (k.spielart === "zuruf" && grenzen.regel.zurufNurNachricht) {
      // Bis Stufe 2 nur mit „JA per Nachricht“ — ohne nachweisbares Ja (Kennung) gar nicht.
      const [ew] = z.einwilligung_id ? ((await lauf`SELECT art FROM fiaon_telefon_einwilligung WHERE id = ${z.einwilligung_id}`) as any[]) : [];
      if (!["zuruf_whatsapp", "zuruf_mail"].includes(String(ew?.art ?? ""))) { merken("stufe:zuruf_kaestchen"); continue; }
    }
    const f = fensterOffen(k.spielart, land, new Date(), { fenster: einst.fenster });
    if (!f.offen) { merken(`fenster:${f.grund}`); continue; }
    const personId = z.person_id != null ? Number(z.person_id) : null;
    if (await telefonGesperrt(nummerKern(z.nummer), personId, lauf)) { merken("sperre"); await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', updated_at = NOW() WHERE id = ${k.id}`; continue; }
    if (personId && await arasAusFuerPerson(personId, lauf)) { merken("aras_aus_person"); await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'Aras für diesen Kunden aus', updated_at = NOW() WHERE id = ${k.id}`; continue; }
    if (istWerbeSpielart(k.spielart) || z.rechtsgrund === "einwilligung") {
      const ew = await einwilligungGueltig(nummerKern(z.nummer), personId, lauf);
      if (!ew) { merken("ohne_einwilligung"); await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'keine Einwilligung', updated_at = NOW() WHERE id = ${k.id}`; continue; }
      if (land === "CH" && !einst.callerIdCh) { merken("ch_ohne_nummer"); continue; }
    }
    if (personId) {
      await globalKundeBereit();
      const [g] = (await lauf.unsafe(`SELECT ${globalKundeSql("p.id")} AS global, p.ist_test_am IS NOT NULL AS test FROM fiaon_persons p WHERE p.id = ${personId}`)) as any[];
      if (g?.global) { merken("global"); await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'Global-Kunde', updated_at = NOW() WHERE id = ${k.id}`; continue; }
      if (g?.test) { merken("testperson"); await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'Testperson', updated_at = NOW() WHERE id = ${k.id}`; continue; }
      const v = await versucheHeute(personId, lauf);
      const d = darfVersuch({ versucheHeute: v.heute, versucheWoche: v.woche, fehlFolge: v.fehlFolge, letzterVersuchAm: v.letzterVersuchAm, jetzt: new Date(),
        jePersonTag: einst.jePersonTag, jePersonWoche: einst.jePersonWoche, versucheEnde: einst.versucheEnde, spielart: k.spielart });
      if (!d.ok) {
        merken(d.grund ?? "versuch");
        if (d.grund === "versuche_ende") await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = 'Versuche aufgebraucht', updated_at = NOW() WHERE id = ${k.id}`;
        else if (d.grund === "je_person_tag" || d.grund === "je_person_woche" || d.grund === "pause_nach_fehl") await lauf`UPDATE fiaon_aras_plan SET status = 'verschoben', frueh_ab = NOW() + INTERVAL '1 day', spaet_bis = GREATEST(spaet_bis, NOW() + INTERVAL '36 hours'), verschoben_grund = ${d.grund}, updated_at = NOW() WHERE id = ${k.id}`;
        continue;
      }
    }
    const w = await waehlen(k.id, {}, lauf);
    if (w.ok) { gewaehlt += 1; frei -= 1; } else merken(`wahl:${(w.grund ?? "").slice(0, 40)}`);
  }
  return fertig(gewaehlt);
}

/** Einen Plan-Eintrag wählen: Zeilen in fiaon_calls + fiaon_aras_anruf, Twilio calls.create, Protokoll. */
export async function waehlen(planId: number, opt: { probe?: boolean; spielartFuerBriefing?: Spielart; stimme?: string | null } = {}, lauf: Lauf = sqlPool): Promise<{ ok: boolean; callId?: number; grund?: string }> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT * FROM fiaon_aras_plan WHERE id = ${planId}`) as any[];
  if (!z) return { ok: false, grund: "Eintrag fehlt." };
  if (z.status !== "wartet") return { ok: false, grund: `Eintrag ist ${z.status}.` };
  const einst = await arasEinstellungenLesen(true, lauf);
  if (einst.notaus) return { ok: false, grund: "Notaus." };
  // PROBE: nur die eine hinterlegte Nummer — hart, hier ein zweites Mal geprüft. Und ein Probe-Eintrag geht nur als Probe.
  const { probeZiel, probeBriefingBauen } = await import("./fiaon-aras-nachbereitung");
  if (opt.probe || z.spielart === "probe") {
    if (!opt.probe || z.spielart !== "probe") return { ok: false, grund: "Probe-Einträge wählt nur der Probeanruf." };
    const ziel = await probeZiel(lauf);
    if (!ziel || ziel.nummer !== String(z.nummer)) {
      await lauf`UPDATE fiaon_aras_plan SET status = 'gesperrt', verschoben_grund = 'Probe nur an die hinterlegte Nummer', updated_at = NOW() WHERE id = ${planId}`;
      return { ok: false, grund: "Probeanrufe gehen nur an die hinterlegte Probe-Nummer — diese Nummer ist es nicht." };
    }
  } else if (!einst.an) return { ok: false, grund: "ARAS ist aus." };
  else {
    // Stufenplan (hart, auch hier — nicht nur im Takt): Stufe 0 wählt NIE einen Kunden; darüber nur die Arten der Stufe.
    const g = stufenGrenzen(einst);
    if (g.stufe === 0) return { ok: false, grund: "Stufe 0: Aras führt nur Probeanrufe — keine Kunden." };
    if (!g.spielartErlaubt(z.spielart as Spielart)) return { ok: false, grund: `Stufe ${g.stufe}: „${z.spielart}“ ist in dieser Stufe noch nicht erlaubt.` };
  }
  const adapter = adapterFuer(einst.adapter);
  const bereit = await adapter.bereit();
  if (!bereit.ok) return { ok: false, grund: bereit.grund };
  const attrappe = einst.adapter === "attrappe";
  if (!attrappe) { const t = twilioBereit(); if (!t.ok) return { ok: false, grund: `Twilio fehlt: ${t.fehlt.join(", ")}` }; }
  const land = (z.land as Land) || "DE";
  const spielart = z.spielart as Spielart;
  const personId = z.person_id != null ? Number(z.person_id) : null;
  const ausweis = await arasAusweisId(lauf);
  const von = arasCallerId(land, { at: einst.callerIdAt, ch: einst.callerIdCh });
  const stimme = opt.stimme || einst.stimme;

  // Zeile anlegen, dann Twilio — in dieser Reihenfolge, damit die Kennung in jedem Rückruf steht (E-012-Regel)
  const [c] = (await lauf`
    INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, richtung, status, von_nummer, zuordnung_herkunft, gefuehrt_von)
    VALUES (${personId}, ${z.ref ?? null}, ${ausweis}, ${z.nummer}, 'raus', 'gewaehlt', ${von || null}, 'gewaehlt', 'aras') RETURNING id`) as any[];
  const callId = Number(c.id);
  const briefingSpielart = opt.spielartFuerBriefing ?? spielart;
  let briefing;
  if (opt.probe && !personId) {
    briefing = await probeBriefingBauen(briefingSpielart === "probe" ? "zuruf" : briefingSpielart, (await probeZiel(lauf))?.agentId ?? 928, lauf);
  } else {
    briefing = await briefingBauen({ personId, nummer: z.nummer, spielart: briefingSpielart, rateId: z.rate_id ?? null, terminId: z.termin_id ?? null, zusageAm: spielart === "zusage" && z.anlass_am ? new Date(z.anlass_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : null, probe: opt.probe === true, planId }, lauf);
    if (opt.probe) briefing = { ...briefing, probe: true, probeSpielart: briefingSpielart };
  }
  const hausanweisung = await anweisungLesen("telefon" as any).catch(() => "");
  const anweisung = anweisungBauen({ spielart, briefing, einstellungen: einst, hausanweisung: hausanweisung || null });
  const [aa] = (await lauf`
    INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, adapter, modell, stimme, prompt_version, briefing)
    VALUES (${callId}, ${planId}, ${spielart}, ${einst.adapter}, ${einst.modellStimme}, ${stimme}, ${anweisung.version}, ${lauf.json(briefing as any)}) RETURNING id`) as any[];
  await lauf`UPDATE fiaon_aras_plan SET status = 'gewaehlt', call_id = ${callId}, updated_at = NOW() WHERE id = ${planId}`;

  let sid: string;
  if (attrappe) {
    sid = `ATTRAPPE-${callId}`;
  } else {
    try {
      const client = await twilioClient();
      const call = await client.calls.create({
        to: z.nummer, from: von,
        url: rueckrufUrl("/api/fiaon/aras/twiml", callId, { t: streamToken(callId) }), method: "POST",
        statusCallback: rueckrufUrl("/api/fiaon/aras/status", callId), statusCallbackMethod: "POST", statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        machineDetection: "Enable", asyncAmd: "true", asyncAmdStatusCallback: rueckrufUrl("/api/fiaon/aras/amd", callId), asyncAmdStatusCallbackMethod: "POST",
        timeout: 30, timeLimit: ANRUF_ZEITLIMIT_SEK,
      });
      sid = String(call.sid);
    } catch (err) {
      const grund = String((err as Error)?.message ?? err).slice(0, 300);
      await lauf`UPDATE fiaon_calls SET status = 'fehlgeschlagen', ende = NOW(), updated_at = NOW() WHERE id = ${callId}`;
      await lauf`UPDATE fiaon_aras_anruf SET fehler = ${grund}, ende_grund = 'fehler', nachbereitet_am = NOW(), pruefung_status = 'entfaellt', updated_at = NOW() WHERE id = ${Number(aa.id)}`;
      // Probe: nie von selbst neu wählen. Kunde: in 30 Minuten noch einmal (die Wände prüfen erneut).
      await lauf`UPDATE fiaon_aras_plan SET status = CASE WHEN spielart = 'probe' THEN 'verfallen' ELSE 'verschoben' END, frueh_ab = NOW() + INTERVAL '30 minutes',
                 verschoben_grund = ${`Twilio: ${grund.slice(0, 120)}`}, updated_at = NOW() WHERE id = ${planId}`;
      await arasEreignis({ art: "aras_fehler", callId, arasAnrufId: Number(aa.id), personId, spielart, text: `Wählen fehlgeschlagen: ${grund}`, ok: false, daten: { fatal: false } });
      return { ok: false, grund: `Twilio: ${grund}` };
    }
  }
  await lauf`UPDATE fiaon_calls SET twilio_sid = ${sid}, updated_at = NOW() WHERE id = ${callId}`;
  await arasEreignis({ art: "aras_gewaehlt", callId, arasAnrufId: Number(aa.id), personId, spielart, text: `Gewählt (${spielart}, ${land})${opt.probe ? " — Probeanruf" : ""}`, nummer: z.nummer, daten: { planId, probe: opt.probe === true } });
  return { ok: true, callId };
}

/** Notaus: aras_notaus = an, laufende Gespräche enden mit Abschiedssatz. */
export async function notaus(von: string, grund: string): Promise<{ beendet: number }> {
  await einstellungSetzen("aras_notaus", "an", von);
  const beendet = await notausAlle();
  await arasEreignis({ art: "aras_notaus", callId: 0, spielart: "probe", text: `Notaus von ${von}: ${grund || "ohne Grund"} — ${beendet} Gespräch(e) beendet`, daten: { von, grund, beendet } });
  return { beendet };
}
export async function start(von: string): Promise<void> {
  await einstellungSetzen("aras_notaus", "aus", von);
}
export async function leerlauf(an: boolean, von: string): Promise<{ laufend: number }> {
  await einstellungSetzen("aras_leerlauf", an ? "an" : "aus", von);
  return { laufend: laufendeSitzungen().length };
}

/** Hängende Wählversuche (Twilio hat nie zurückgemeldet) nach 10 Minuten schließen. */
export async function haengendeSchliessen(lauf: Lauf = sqlPool): Promise<number> {
  const r = (await lauf`
    UPDATE fiaon_calls SET status = 'fehlgeschlagen', ende = NOW(), updated_at = NOW()
     WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt' AND beginn < NOW() - INTERVAL '10 minutes' RETURNING id`) as any[];
  for (const z of r) {
    await lauf`UPDATE fiaon_aras_anruf SET ende_grund = COALESCE(ende_grund, 'haengend'), nachbereitet_am = COALESCE(nachbereitet_am, NOW()), pruefung_status = 'entfaellt', updated_at = NOW() WHERE call_id = ${Number(z.id)}`;
    await lauf`UPDATE fiaon_aras_plan SET status = 'verschoben', frueh_ab = NOW() + INTERVAL '2 hours', verschoben_grund = 'hängender Wählversuch', updated_at = NOW() WHERE call_id = ${Number(z.id)} AND status = 'gewaehlt'`;
  }
  return r.length;
}
