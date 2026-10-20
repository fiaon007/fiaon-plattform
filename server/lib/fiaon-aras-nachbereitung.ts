// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Nachbereitung, Anruf-Listen, Probeanruf, Tageszahlen (E-408, Vertrag § 4 / § 8 / § 11 / § 17)
//
// Nach jedem Gespräch, ohne Mensch: Das Ergebnis kommt aus anruf_beenden,
// sonst aus den Werkzeugen, sonst aus dem Verlauf (beschreibt, rät nicht).
// Dann dieselbe Kette wie nach einem Mitarbeiter-Anruf (ergebnisNachbereiten),
// eine kurze Zusammenfassung (≤ 600 Zeichen) und — weich, wenn E-406 C2 da ist —
// die Nacharbeits-Mail.
//
// Prüfen tut Prüf-Mara (E-409, fiaon-ki-pruefung.ts): Sie liest jeden Anruf mit
// pruefung_status = 'offen'. Hier laufen nur die harten Telefon-Regeln
// (telefonRegeln, shared/fiaon-aras-regeln.ts — wortgleich mit Prüf-Mara) auf dem
// Live-Transkript IM SPEICHER, wenn der Kunde Nein zur Aufnahme sagte —
// gespeichert wird dann nur der Befund (Regelname, kein Wortlaut), damit
// Prüf-Mara ihn mitlesen kann (fiaon_aras_anruf.pruefung).
//
// Probeanruf: NUR an die eine hinterlegte Nummer (aras_probe_nummer, sonst die
// Nummer im Ausweis des Inhabers, Agent 928). Eine andere Nummer gibt es in
// diesem Weg nicht — waehlen() prüft sie ein zweites Mal hart.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema, arasAusweisId } from "./fiaon-aras-schema";
import { arasEreignis } from "./fiaon-aras-ereignis";
import { arasEinstellungenLesen, planEinreihen, arasKostenHeute } from "./fiaon-aras-plan";
import { openaiFetch, istKiPause } from "./fiaon-ki-pause";
import { nutzungMerken } from "./fiaon-postmeister-schema";
import { ERGEBNISSE } from "../../shared/fiaon-kontakt-ergebnis-liste";
import { telefonRegeln, type RegelZeile as PruefZeileT } from "../../shared/fiaon-aras-regeln";
import {
  istArasErgebnis, istSpielart, nummerLand, fensterOffen, berlinTeile, ARAS_DIENSTE, PROBE_AGENT_VORGABE, STIMMEN_OPENAI, stimmeGueltig,
  type ArasErgebnis, type Spielart, type AnrufZeile, type AnrufDetail, type Werkzeug,
} from "../../shared/fiaon-aras";
import { probeBriefing } from "../../shared/fiaon-aras-prompt";

type Lauf = typeof sqlPool;

export interface NachbereitungLage {
  zeilen: { t: number; wer: "kunde" | "aras"; text: string; final: boolean; abgebrochen?: boolean }[];
  ausgefuehrt: { werkzeug: Werkzeug; ok: boolean; eingabe: unknown; am: number }[];
  endeGrund: string; sekunden: number; aufnahmeJa: boolean;
  ergebnis: ArasErgebnis | null; ergebnisNotiz: string | null; ergebnisGesetzt: boolean; kundeHatGesprochen: boolean;
  probe?: boolean; kiHinweisSek?: number | null;
}

function ergebnisAbleiten(l: NachbereitungLage): { ergebnis: ArasErgebnis; notiz: string } {
  if (l.ergebnis) return { ergebnis: l.ergebnis, notiz: l.ergebnisNotiz ?? "" };
  const ok = (w: Werkzeug) => l.ausgefuehrt.some((x) => x.werkzeug === w && x.ok);
  if (ok("nicht_mehr_anrufen")) return { ergebnis: "erreicht_abgelehnt", notiz: "Kunde möchte keine Anrufe mehr (Telefonsperre gesetzt)." };
  if (ok("zahlung_gemeldet")) return { ergebnis: "erreicht_zahlt_gleich", notiz: "Kunde meldet die Überweisung als erledigt." };
  if (ok("zahlungszusage_merken")) return { ergebnis: "erreicht_zahlt_am", notiz: "Kunde hat einen Zahltag zugesagt." };
  if (ok("mensch_verbinden") && l.endeGrund === "uebergabe") return { ergebnis: "uebergeben", notiz: "An einen Menschen aus dem Team verbunden." };
  if (ok("rueckruf_buchen")) return { ergebnis: "rueckruf_termin", notiz: "Anruf zu einer festen Zeit eingetragen." };
  if (l.endeGrund === "mailbox") return { ergebnis: "mailbox", notiz: "Mailbox — keine Nachricht hinterlassen." };
  if (["notaus", "deckel", "fehler", "zeitlimit", "deploy", "kein_stream"].includes(l.endeGrund)) {
    return l.kundeHatGesprochen ? { ergebnis: "abgebrochen", notiz: `Gespräch abgebrochen (${l.endeGrund}).` } : { ergebnis: "nicht_erreicht", notiz: `Abbruch vor dem Gespräch (${l.endeGrund}).` };
  }
  if (!l.kundeHatGesprochen) return { ergebnis: "nicht_erreicht", notiz: l.sekunden < 20 ? "Niemand hat gesprochen." : "Keine Kundenstimme im Gespräch." };
  return { ergebnis: "erreicht_sonstiges", notiz: "Gespräch geführt — Einzelheiten in der Zusammenfassung." };
}

async function zusammenfassung(l: NachbereitungLage, spielart: Spielart): Promise<string> {
  const ausTools = l.ausgefuehrt.filter((x) => x.werkzeug !== "akte_nachsehen").map((x) => `${x.werkzeug}${x.ok ? "" : " (fehlgeschlagen)"}`);
  const fallback = `Gespräch „${spielart}“, ${l.sekunden} s, Ende: ${l.endeGrund}.${ausTools.length ? ` Werkzeuge: ${ausTools.join(", ")}.` : ""}${l.aufnahmeJa ? "" : " Ohne Aufzeichnung."}`.slice(0, 600);
  // Ohne Aufnahme-Ja nur die letzten drei Zeilen (wie die Notiz eines Menschen) — nie den Volltext an ein Modell.
  const zeilen = (l.aufnahmeJa ? l.zeilen : l.zeilen.slice(-3)).filter((z) => z.text.trim());
  if (!l.kundeHatGesprochen || zeilen.length < 2 || !process.env.OPENAI_API_KEY) return fallback;
  const text = zeilen.map((z) => `${z.wer === "kunde" ? "Kunde" : "Aras"}: ${z.text.trim()}`).join("\n").slice(0, 12_000);
  const t0 = Date.now();
  try {
    const modell = process.env.ARAS_NACHBEREITUNG_MODELL || "gpt-4.1-mini";
    const res = await openaiFetch(ARAS_DIENSTE.nachbereitung, "/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell, temperature: 0.2, max_tokens: 260,
        messages: [
          { role: "system", content: "Du fasst ein Telefonat zwischen Aras (KI-Assistent von FIAON) und einem Kunden zusammen. DU BESCHREIBST NUR, WAS GESAGT WURDE — keine Bewertung, keine Vermutung, keine Empfehlung. Höchstens 4 Sätze, insgesamt unter 550 Zeichen, deutsch, ohne Namen von Mitarbeitern, ohne Systemwörter." },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = res.ok ? ((await res.json()) as any) : null;
    const roh = String(json?.choices?.[0]?.message?.content ?? "").trim();
    await nutzungMerken({ dienst: ARAS_DIENSTE.nachbereitung, modell, usage: json?.usage, dauerMs: Date.now() - t0, ok: !!roh }).catch(() => {});
    return roh ? roh.slice(0, 600) : fallback;
  } catch (e) {
    if (!istKiPause(e)) console.error("[ARAS-NACHBEREITUNG] Zusammenfassung:", String((e as Error)?.message ?? e).slice(0, 200));
    return fallback;
  }
}

export async function nachbereiten(arasAnrufId: number, l: NachbereitungLage, lauf: Lauf = sqlPool): Promise<{ ergebnis: ArasErgebnis; pruefung: string }> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT aa.spielart, aa.call_id, aa.plan_id, aa.nachbereitet_am, aa.ki_hinweis_am, aa.angenommen_am, aa.aufnahme_ja_am, aa.aufnahme_nein_am, aa.aufnahme_gestartet_am,
                                 c.person_id, c.ref, c.nummer
                            FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id WHERE aa.id = ${arasAnrufId}`) as any[];
  if (!z) throw new Error(`ARAS-Anruf ${arasAnrufId} fehlt.`);
  if (z.nachbereitet_am) return { ergebnis: (l.ergebnis ?? "erreicht_sonstiges"), pruefung: "schon" };
  const spielart = z.spielart as Spielart;
  const probe = l.probe === true || spielart === "probe";
  const { ergebnis, notiz } = ergebnisAbleiten(l);
  const zusammen = await zusammenfassung(l, spielart);

  // Akte: dieselbe Kette wie nach einem Mitarbeiter-Anruf — nur, wenn kein Werkzeug sie schon ausgelöst hat (nie bei Probe).
  if (!probe && !l.ergebnisGesetzt && z.ref && z.person_id && (ERGEBNISSE as readonly string[]).includes(ergebnis)) {
    try {
      const { ergebnisNachbereiten } = await import("./fiaon-kontakt-ergebnis");
      await ergebnisNachbereiten({ ref: String(z.ref), personId: Number(z.person_id), ergebnis: ergebnis as any, notiz: `Aras am Telefon: ${notiz || zusammen}`.slice(0, 400), akteur: { id: await arasAusweisId(lauf), name: "Aras" }, herkunft: "telefon" });
    } catch (e) { console.error("[ARAS-NACHBEREITUNG] Akte:", String((e as Error)?.message ?? e).slice(0, 200)); }
  }
  await lauf`UPDATE fiaon_calls SET ergebnis = COALESCE(ergebnis, ${ergebnis}), ergebnis_am = COALESCE(ergebnis_am, NOW()), ergebnis_notiz = COALESCE(ergebnis_notiz, ${notiz || null}),
               zusammenfassung = COALESCE(zusammenfassung, ${zusammen}), updated_at = NOW() WHERE id = ${z.call_id}`.catch(() => null);

  // Gespräch ohne Gespräch (nicht erreicht, Mailbox, stumm) → nichts zu prüfen. Sonst bleibt es „offen“ für Prüf-Mara.
  const gesprochen = l.kundeHatGesprochen && l.zeilen.some((x) => x.wer === "aras" && x.text.trim());
  const status = gesprochen ? "offen" : "entfaellt";
  // Ohne Aufnahme-Ja: die harten Regeln auf dem Live-Transkript im Speicher — gespeichert wird nur der Befund, kein Wortlaut.
  let befund: { live: boolean; punkte: { regel: string; schwere: string }[] } | null = null;
  if (gesprochen && !l.aufnahmeJa) {
    try {
      const sek = (t: unknown) => (t && z.angenommen_am ? Math.max(0, (new Date(t as string).getTime() - new Date(z.angenommen_am).getTime()) / 1000) : null);
      const zeilen: PruefZeileT[] = l.zeilen.filter((x) => x.text.trim()).map((x) => ({ t: x.t, wer: x.wer, text: x.text }));
      const text = zeilen.filter((x) => x.wer === "aras").map((x) => x.text).join("\n");
      // arasBeendet: Aras hat aufgelegt — ohne hörbaren Abschied ist das ein Befund (Justins Test 20.10., Anruf 6).
      const punkte = telefonRegeln(text, { kiHinweisSek: l.kiHinweisSek ?? sek(z.ki_hinweis_am), aufnahmeJaSek: sek(z.aufnahme_ja_am), aufnahmeGestartetSek: sek(z.aufnahme_gestartet_am), aufnahmeNeinSek: sek(z.aufnahme_nein_am), transkript: zeilen, arasBeendet: l.endeGrund === "aras_beendet" });
      befund = { live: true, punkte: punkte.map((p) => ({ regel: p.regel, schwere: p.schwere })) };
    } catch (e) { console.error("[ARAS-NACHBEREITUNG] Live-Regeln:", String((e as Error)?.message ?? e).slice(0, 160)); }
  }
  await lauf`UPDATE fiaon_aras_anruf SET ergebnis = COALESCE(ergebnis, ${ergebnis}), ergebnis_notiz = COALESCE(ergebnis_notiz, ${notiz || null}),
               zusammenfassung = ${zusammen}, pruefung_status = CASE WHEN pruefung_status = 'offen' THEN ${status} ELSE pruefung_status END,
               pruefung = COALESCE(${befund ? lauf.json(befund as any) : null}, pruefung), nachbereitet_am = NOW(), updated_at = NOW()
             WHERE id = ${arasAnrufId}`;
  if (z.plan_id) await lauf`UPDATE fiaon_aras_plan SET status = 'fertig', updated_at = NOW() WHERE id = ${z.plan_id} AND status IN ('gewaehlt', 'laeuft', 'wartet')`.catch(() => null);
  if (befund?.punkte.some((p) => p.schwere === "hart")) {
    await arasEreignis({ art: "aras_pruefung", callId: Number(z.call_id), arasAnrufId, personId: z.person_id != null ? Number(z.person_id) : null, spielart, ok: false,
      text: `Harte Regel im Gespräch: ${befund.punkte.filter((p) => p.schwere === "hart").map((p) => p.regel).join(", ")}`, daten: { punkte: befund.punkte } });
  }
  // E-406 C2 (weiche Abhängigkeit): die Nacharbeits-Mail nach dem Gespräch — fehlt die Datei, läuft es ohne
  if (!probe && z.person_id && ergebnis.startsWith("erreicht")) {
    try {
      const m: any = await import("./fiaon-mara-nacharbeit" as string).catch(() => null);
      if (m?.nacharbeitNachErgebnis) await m.nacharbeitNachErgebnis({ personId: Number(z.person_id), ref: z.ref, ergebnis, notiz: zusammen, akteur: "aras", callId: Number(z.call_id) });
    } catch (e) { console.error("[ARAS-NACHBEREITUNG] Nacharbeit (C2):", String((e as Error)?.message ?? e).slice(0, 200)); }
  }
  return { ergebnis, pruefung: status };
}

// ── Listen und Detail ──────────────────────────────────────────────────────
function zeile(z: any, maskiert: boolean): AnrufZeile {
  const name = z.last_name ? String(z.last_name) : (z.company_name ? String(z.company_name) : (z.spielart === "probe" ? "Probe" : "—"));
  return {
    id: Number(z.id), callId: Number(z.call_id), am: new Date(z.created_at).toISOString(), spielart: z.spielart,
    personId: z.person_id != null ? Number(z.person_id) : null,
    name: maskiert && name !== "—" && name !== "Probe" ? `${name.slice(0, 1)}…` : name,
    ergebnis: z.ergebnis ?? null, dauerSek: Number(z.sekunden_sitzung ?? 0),
    kostenCents: Math.round((Number(z.kosten_ki_cents ?? 0) + Number(z.kosten_telefon_cents ?? 0)) * 10) / 10,
    pruefung: String(z.pruefung_status ?? "offen"), uebergabe: z.uebergabe_status ?? null, endeGrund: z.ende_grund ?? null, angenommen: !!z.angenommen_am,
    probeUrteil: z.probe_urteil ?? null,
  };
}

export async function anrufListe(f: { tag?: string; spielart?: string; ergebnis?: string; seite?: number }, lauf: Lauf = sqlPool, maskiert = false): Promise<AnrufZeile[]> {
  await arasSchema(lauf);
  const tag = f.tag && /^\d{4}-\d{2}-\d{2}$/.test(f.tag) ? f.tag : null;
  const spielart = f.spielart && istSpielart(f.spielart) ? f.spielart : null;
  const seite = Math.max(0, Number(f.seite ?? 0) || 0);
  const zeilen = (await lauf`
    SELECT aa.*, c.person_id, p.last_name, p.company_name FROM fiaon_aras_anruf aa
      JOIN fiaon_calls c ON c.id = aa.call_id LEFT JOIN fiaon_persons p ON p.id = c.person_id
     WHERE (${tag}::date IS NULL OR (aa.created_at AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)
       AND (${spielart}::text IS NULL OR aa.spielart = ${spielart})
       AND (${f.ergebnis ?? null}::text IS NULL OR aa.ergebnis = ${f.ergebnis ?? null})
     ORDER BY aa.created_at DESC LIMIT 50 OFFSET ${seite * 50}`) as any[];
  return zeilen.map((z) => zeile(z, maskiert));
}

export async function anrufDetail(arasAnrufId: number, lauf: Lauf = sqlPool, maskiert = false): Promise<AnrufDetail | null> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    SELECT aa.*, c.person_id, p.last_name, p.company_name, c.recording_sid FROM fiaon_aras_anruf aa
      JOIN fiaon_calls c ON c.id = aa.call_id LEFT JOIN fiaon_persons p ON p.id = c.person_id WHERE aa.id = ${arasAnrufId}`) as any[];
  if (!z) return null;
  const werkzeuge = (await lauf`SELECT werkzeug, eingabe, ergebnis, ok, dauer_ms, created_at FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${arasAnrufId} ORDER BY created_at`) as any[];
  const transkript = z.transkript ? (typeof z.transkript === "string" ? JSON.parse(z.transkript) : z.transkript) : null;
  return {
    ...zeile(z, maskiert),
    briefing: maskiert ? null : (typeof z.briefing === "string" ? JSON.parse(z.briefing) : z.briefing),
    transkript: maskiert ? null : (Array.isArray(transkript) ? transkript : null),
    zusammenfassung: z.zusammenfassung ?? null, ergebnisNotiz: z.ergebnis_notiz ?? null,
    werkzeuge: werkzeuge.map((w) => ({ werkzeug: String(w.werkzeug), eingabe: w.eingabe, ergebnis: w.ergebnis, ok: w.ok ?? null, dauerMs: w.dauer_ms != null ? Number(w.dauer_ms) : null, am: new Date(w.created_at).toISOString() })),
    // Die Aufnahme läuft über denselben Weg wie beim Team (GET /telefon/:id/aufnahme, Mitarbeiter-Anmeldung).
    aufnahmeUrl: z.recording_sid ? `/api/fiaon/telefon/${Number(z.call_id)}/aufnahme` : null,
    kiHinweisAm: z.ki_hinweis_am ? new Date(z.ki_hinweis_am).toISOString() : null,
    aufnahmeJaAm: z.aufnahme_ja_am ? new Date(z.aufnahme_ja_am).toISOString() : null,
    aufnahmeNeinAm: z.aufnahme_nein_am ? new Date(z.aufnahme_nein_am).toISOString() : null,
    aufnahmeJaText: maskiert ? null : (z.aufnahme_ja_text ?? null),
    adapter: String(z.adapter), modell: z.modell ?? null, stimme: z.stimme ?? null, promptVersion: String(z.prompt_version), fehler: z.fehler ?? null,
    befund: z.pruefung ?? null,
    probeUrteilGrund: z.probe_urteil_grund ?? null,
  };
}

// ── Tageszahlen (für „Heute“ und die Lage im KI-Raum, Vertrag § 17) ────────
export async function tagesZahlen(tag: string, lauf: Lauf = sqlPool): Promise<{ gewaehlt: number; erreicht: number; gespraeche: number; zusagen: number; euroKi: number; euroTelefon: number; proben: number }> {
  await arasSchema(lauf);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : berlinTeile(new Date()).datum;
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE spielart <> 'probe')::int AS gewaehlt,
           COUNT(*) FILTER (WHERE spielart <> 'probe' AND angenommen_am IS NOT NULL AND COALESCE(ergebnis, '') NOT IN ('mailbox', 'nicht_erreicht'))::int AS erreicht,
           COUNT(*) FILTER (WHERE spielart <> 'probe' AND sekunden_sitzung >= 30)::int AS gespraeche,
           COUNT(*) FILTER (WHERE spielart <> 'probe' AND ergebnis IN ('erreicht_zahlt_am', 'erreicht_zahlt_gleich'))::int AS zusagen,
           COUNT(*) FILTER (WHERE spielart = 'probe')::int AS proben,
           COALESCE(SUM(kosten_telefon_cents), 0)::float AS telefon
      FROM fiaon_aras_anruf WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`) as any[];
  const [k] = (await lauf`
    SELECT COALESCE(SUM(kosten_cents), 0)::float AS cents FROM fiaon_ki_nutzung
     WHERE dienst LIKE 'aras-%' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [{ cents: 0 }])) as any[];
  return {
    gewaehlt: Number(z?.gewaehlt ?? 0), erreicht: Number(z?.erreicht ?? 0), gespraeche: Number(z?.gespraeche ?? 0), zusagen: Number(z?.zusagen ?? 0),
    euroKi: Math.round(Number(k?.cents ?? 0)) / 100, euroTelefon: Math.round(Number(z?.telefon ?? 0)) / 100, proben: Number(z?.proben ?? 0),
  };
}

// ── Probeanruf: nur an die EINE hinterlegte Nummer ─────────────────────────
/**
 * Die Probe-Nummer: aras_probe_nummer, sonst die Nummer im Ausweis des Inhabers (Agent 928) — nur DACH, E.164.
 * Gibt null zurück, wenn keine da ist. Eine andere Quelle gibt es nicht.
 */
export async function probeZiel(lauf: Lauf = sqlPool): Promise<{ nummer: string; quelle: "einstellung" | "ausweis"; agentId: number } | null> {
  const einst = await arasEinstellungenLesen(true, lauf);
  const agentId = PROBE_AGENT_VORGABE;
  if (einst.probeNummer && nummerLand(einst.probeNummer)) return { nummer: einst.probeNummer, quelle: "einstellung", agentId };
  const [a] = (await lauf`SELECT phone, country FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
  if (!a?.phone) return null;
  const { waehlbareNummer } = await import("./fiaon-telefon");
  const w = waehlbareNummer([{ nummer: a.phone }], a.country ?? "DE").waehlbar;
  return w && nummerLand(w) && /^\+[1-9]\d{6,15}$/.test(w) ? { nummer: w, quelle: "ausweis", agentId } : null;
}

export async function probeanruf(e: { spielart: string; personId?: number | null; von: string; stimme?: string | null }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; callId?: number; grund?: string }> {
  await arasSchema(lauf);
  const einst = await arasEinstellungenLesen(true, lauf);
  const ziel = await probeZiel(lauf);
  if (!ziel) return { ok: false, grund: "Keine Probe-Nummer: Trag deine Handynummer einmal ein (Aras › Probeanruf › „Deine Nummer“) — sie ist die einzige Nummer, die Aras im Test anruft." };
  if (einst.notaus) return { ok: false, grund: "Notaus ist an — erst „Wieder an“, dann der Probeanruf." };
  if (einst.leerlauf) return { ok: false, grund: "Leerlauf ist an (Deploy) — kein neuer Anruf, auch keine Probe." };
  const f = fensterOffen("probe", nummerLand(ziel.nummer) ?? "DE", new Date());
  if (!f.offen) return { ok: false, grund: "Probeanrufe gehen von 7 bis 23 Uhr." };
  const kosten = await arasKostenHeute(lauf);
  if (kosten.euro >= einst.tagEuro) return { ok: false, grund: `Tagesdeckel erreicht (${kosten.euro.toFixed(2)} € von ${einst.tagEuro} €) — morgen wieder, oder den Deckel anheben.` };
  const [laeuftSchon] = (await lauf`SELECT 1 FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id
                                    WHERE aa.spielart = 'probe' AND c.status IN ('gewaehlt', 'laeuft') AND c.beginn > NOW() - INTERVAL '10 minutes' LIMIT 1`) as any[];
  if (laeuftSchon) return { ok: false, grund: "Ein Probeanruf läuft schon — erst auflegen." };
  const spielart: Spielart = istSpielart(e.spielart) && e.spielart !== "eingehend" ? e.spielart : "probe";
  const stimme = e.stimme && (stimmeGueltig(e.stimme) || (STIMMEN_OPENAI as readonly string[]).includes(e.stimme)) ? e.stimme : null;
  const r = await planEinreihen({
    personId: e.personId ?? null, nummer: ziel.nummer, spielart: "probe", grund: `Probeanruf (${spielart}) von ${e.von}`.slice(0, 200), erzeugtVon: "probe",
    fruehAb: new Date(), spaetBis: new Date(Date.now() + 10 * 60_000),
  }, lauf);
  if (!r.ok || !r.id) return { ok: false, grund: r.grund ?? "Einreihen fehlgeschlagen." };
  const { waehlen } = await import("./fiaon-aras-waehler");
  const w = await waehlen(r.id, { probe: true, spielartFuerBriefing: spielart, stimme }, lauf);
  return w.ok ? { ok: true, callId: w.callId } : { ok: false, grund: w.grund };
}

/** Das Probe-Briefing mit Justins Namen aus seinem Ausweis (nie Kundendaten, außer er wählt eine Person). */
export async function probeBriefingBauen(spielart: Spielart, agentId: number, lauf: Lauf = sqlPool) {
  const [a] = (await lauf`SELECT anrede, last_name FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
  const anredeRoh = String(a?.anrede ?? "").toLowerCase();
  const b = berlinTeile(new Date());
  const wochentag = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(new Date());
  return probeBriefing({
    spielart, anrede: /^h/.test(anredeRoh) ? "Herr" : /^f/.test(anredeRoh) ? "Frau" : null, nachname: a?.last_name ? String(a.last_name) : null,
    heute: { datum: b.datum.split("-").reverse().join("."), wochentag, uhrzeit: b.hhmm },
    vorTagen: (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }),
  });
}

/** Justins Daumen nach dem Probeanruf (hoch/runter + Grund) — Grundlage für „gut genug“ oder „klingt nach KI“. */
export async function probeUrteil(e: { callId: number; daumen: "hoch" | "runter"; grund?: string | null; von: string }, lauf: Lauf = sqlPool): Promise<{ ok: boolean; grund?: string }> {
  await arasSchema(lauf);
  if (e.daumen !== "hoch" && e.daumen !== "runter") return { ok: false, grund: "daumen: hoch oder runter." };
  const r = (await lauf`
    UPDATE fiaon_aras_anruf SET probe_urteil = ${e.daumen}, probe_urteil_grund = ${String(e.grund ?? "").trim().slice(0, 400) || null},
           probe_urteil_am = NOW(), probe_urteil_von = ${e.von.slice(0, 80)}, updated_at = NOW()
     WHERE call_id = ${e.callId} RETURNING id, spielart`) as any[];
  if (!r.length) return { ok: false, grund: "Diesen Anruf gibt es nicht." };
  await arasEreignis({ art: "aras_pruefung", callId: e.callId, arasAnrufId: Number(r[0].id), spielart: r[0].spielart, ok: e.daumen === "hoch",
    text: `Urteil von ${e.von}: Daumen ${e.daumen}${e.grund ? ` — ${String(e.grund).slice(0, 120)}` : ""}`, daten: { daumen: e.daumen } });
  return { ok: true };
}

/** Der jüngste Probeanruf (für die Probe-Bedienung: Stand, Zeilen, Daumen). */
export async function letzterProbeanruf(lauf: Lauf = sqlPool): Promise<{ callId: number; arasAnrufId: number; am: string; spielart: string; stimme: string | null; status: string; ende: string | null; sekunden: number; kiHinweis: boolean; aufnahme: "ja" | "nein" | null; urteil: string | null; urteilGrund: string | null; fehler: string | null; zusammenfassung: string | null } | null> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    SELECT aa.id, aa.call_id, aa.created_at, aa.briefing->>'probeSpielart' AS gespielt, aa.stimme, aa.ende_grund, aa.sekunden_sitzung, aa.ki_hinweis_am,
           aa.aufnahme_ja_am, aa.aufnahme_nein_am, aa.probe_urteil, aa.probe_urteil_grund, aa.fehler, aa.zusammenfassung, c.status
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id
     WHERE aa.spielart = 'probe' ORDER BY aa.id DESC LIMIT 1`) as any[];
  if (!z) return null;
  return {
    callId: Number(z.call_id), arasAnrufId: Number(z.id), am: new Date(z.created_at).toISOString(), spielart: String(z.gespielt ?? "probe"), stimme: z.stimme ?? null,
    status: String(z.status ?? ""), ende: z.ende_grund ?? null, sekunden: Number(z.sekunden_sitzung ?? 0), kiHinweis: !!z.ki_hinweis_am,
    aufnahme: z.aufnahme_ja_am ? "ja" : z.aufnahme_nein_am ? "nein" : null, urteil: z.probe_urteil ?? null, urteilGrund: z.probe_urteil_grund ?? null,
    fehler: z.fehler ?? null, zusammenfassung: z.zusammenfassung ?? null,
  };
}

export { istArasErgebnis };
