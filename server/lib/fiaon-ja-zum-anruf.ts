// ═══════════════════════════════════════════════════════════════════════════
// JA ZUM ANRUF — die Datenbank-Seite der drei Wege (E-408 Scheibe 3, 22.10.2026)
//
// Die reinen Regeln (Sätze, JA-Erkenner, Widerrufs-Erkenner, Urteil, Akte-Zeile) stehen in shared/fiaon-ja-zum-anruf.ts.
// Hier holen wir die Fakten und schreiben — immer über die eine Tür fiaon-telefon-einwilligung.ts
// (einwilligungMerken / einwilligungWiderrufen), nie an ihr vorbei:
//
//   · jaLage               die Karte „Ja zum Anruf“ in der Akte: das aktuelle Ja (oder sein Widerruf), ob Mara gerade
//                          fragen darf (sonst EIN Satz, warum nicht) und das Gespräch, das ein Eintrag als Beleg nimmt
//   · jaEintragen          „Ja zum Anruf eintragen“ (Art „chef“) — nur mit der Pflicht-Bestätigung
//   · jaWiderrufen         „Ja widerrufen“ (Akte)
//   · maraFragtNachDemJa   der Knopf in der Akte: Mara schickt die Frage jetzt (nur bei offenem Fenster)
//   · jaAusWhatsApp        jede eingehende WhatsApp (waEingang): ein klares JA auf Maras Frage → „zuruf_whatsapp“;
//                          „bitte nicht anrufen“ → Widerruf; klares „nicht mehr anrufen“ → dazu die Telefonsperre
//   · jaImGespraech        für Maras Antwort: Ja gespeichert? zurückgenommen? stand die Frage zuletzt da?
//   · jaFrageZumAnhaengen  für Maras Antwort: darf die Frage jetzt an diese Antwort? (sonst null)
//
// Fremde Funktionen hier nehmen alle den Lauf-Parameter (AGENTS.md: ein Prüfstand in einer Transaktion muss sehen,
// was er anlegt). Kein Wählen, kein Anruf — ob ARAS anruft, entscheiden Planer und Wähler (anderer Strang).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { nummerKern, telefonGesperrt, telefonSperren } from "./fiaon-aras-sperre";
import { einwilligungMerken, einwilligungWiderrufen } from "./fiaon-telefon-einwilligung";
import { waehlbareNummer } from "./fiaon-telefon";
import { KOPF_SQL, FAMILIE_SQL, menschSperre, werbungVerboten } from "./fiaon-mail-frequenz";
import { istGlobalKunde } from "./fiaon-global-kunde";
// Das Fenster aus EINER Quelle (dieselbe Regel, mit der waSenden Freitext erlaubt). fiaon-whatsapp.ts lädt diese Datei nur dynamisch.
import { fensterOffen } from "./fiaon-whatsapp";
import {
  JA_FRAGE_WA, JA_FRAGE_FASSUNGEN, JA_AKTE_BESTAETIGUNG, JA_FRAGE_MARKE, JA_FRAGE_ABSTAND_TAGE, JA_ANTWORT_GILT_TAGE, JA_GESPRAECH_STUNDEN,
  istKlaresJa, istNeinZumAnruf, istAnrufSperreWunsch, jaFrageIn, antwortOhneFrage, jaFrageUrteil, jaZeile,
  type JaEintrag, type JaFrageFakten, type JaFrageUrteil,
} from "../../shared/fiaon-ja-zum-anruf";
import { EINWILLIGUNG_JAHRE } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

/** Der Schalter im KI-Raum (Register shared/fiaon-ki-schalter.ts): „aus“ = Mara hängt die Frage nicht mehr an. */
export const JA_FRAGE_SCHALTER = "mara_wa_ja_frage";
export async function jaFrageSchalter(lauf: Lauf = sqlPool): Promise<boolean> {
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${JA_FRAGE_SCHALTER} LIMIT 1`.catch((e) => {
    console.error("[JA-ZUM-ANRUF] Schalter nicht lesbar — Mara fragt nicht:", String(e?.message ?? e).slice(0, 160));
    return [{ value: "aus" }];
  })) as any[];
  return String(z?.value ?? "an").trim().toLowerCase() !== "aus";
}

const LIKE_ROH = (s: string) => s.replace(/[\\%_]/g, (z) => `\\${z}`);
/** Die Muster aller Fassungen der Frage für „text LIKE ANY(…)“. */
const FRAGE_MUSTER = JA_FRAGE_FASSUNGEN.map((f) => `%${LIKE_ROH(f)}%`);
/** fiaon_whatsapp.nummer ist ohne „+“ (waKanonisch) — der Nachweis speichert E.164. */
const e164 = (n: string) => (/^\d{8,15}$/.test(n) ? `+${n}` : n);

/** Der Mensch hinter einer Person: der Kopf und alle Personen, die bei ihm enden (E-253, fiaon-mail-frequenz.ts). */
export async function familie(personId: number, lauf: Lauf = sqlPool): Promise<{ kopf: number; ids: number[] }> {
  const zeilen = (await lauf.unsafe(`
    SELECT ${KOPF_SQL("$1::int")} AS kopf, f.id FROM ${FAMILIE_SQL(KOPF_SQL("$1::int"))} AS f(id)`, [personId])) as any[];
  const kopf = zeilen[0]?.kopf != null ? Number(zeilen[0].kopf) : personId;
  const ids = Array.from(new Set([kopf, personId, ...zeilen.map((z) => Number(z.id)).filter((x) => Number.isInteger(x) && x > 0)]));
  return { kopf, ids };
}

/** Die WhatsApp-Nummer, über die dieser Mensch uns zuletzt geschrieben hat (oder null). */
async function waNummerVon(ids: number[], lauf: Lauf): Promise<{ nummer: string; leadId: number | null; personId: number | null } | null> {
  const [z] = (await lauf`
    SELECT nummer, lead_id, person_id FROM fiaon_whatsapp
     WHERE person_id = ANY(${ids}) AND richtung = 'rein' ORDER BY id DESC LIMIT 1`) as any[];
  return z ? { nummer: String(z.nummer), leadId: z.lead_id != null ? Number(z.lead_id) : null, personId: z.person_id != null ? Number(z.person_id) : null } : null;
}

/** Wann Mara zuletzt nach dem Ja gefragt hat (jede Fassung, über diese Nummer oder an eine Person der Familie). */
async function zuletztGefragt(nummer: string | null, ids: number[], lauf: Lauf): Promise<{ id: number; am: string } | null> {
  const [z] = (await lauf`
    SELECT id, COALESCE(gesendet_am, created_at) AS am FROM fiaon_whatsapp
     WHERE richtung = 'raus' AND status <> 'fehler' AND text LIKE ANY(${FRAGE_MUSTER})
       AND ((${nummer}::text IS NOT NULL AND nummer = ${nummer}) OR person_id = ANY(${ids}))
       AND COALESCE(gesendet_am, created_at) > NOW() - make_interval(days => ${JA_FRAGE_ABSTAND_TAGE})
     ORDER BY id DESC LIMIT 1`) as any[];
  return z ? { id: Number(z.id), am: new Date(z.am).toISOString() } : null;
}

/** Wartet seine neueste Nachricht noch auf eine freie Antwort (von Mara oder einem Menschen)? */
async function wartetAufAntwort(nummer: string, lauf: Lauf): Promise<boolean> {
  const [z] = (await lauf`
    SELECT (SELECT MAX(id) FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein') AS rein,
           (SELECT MAX(id) FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND vorlage IS NULL AND status <> 'fehler') AS raus,
           (SELECT antwort_text IS NOT NULL FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}) AS vorbereitet`) as any[];
  if (z?.vorbereitet === true) return true;
  return z?.rein != null && (z?.raus == null || Number(z.raus) < Number(z.rein));
}

/** Gültiges Ja zu einer dieser Personen oder Nummern? (dieselbe Gültigkeit wie einwilligungGueltig: nicht widerrufen, < 5 Jahre) */
async function gueltigesJa(ids: number[], kerne: string[], lauf: Lauf): Promise<boolean> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    SELECT 1 FROM fiaon_telefon_einwilligung
     WHERE widerrufen_am IS NULL AND erteilt_am > NOW() - make_interval(years => ${EINWILLIGUNG_JAHRE})
       AND (person_id = ANY(${ids}) OR nummer_kern = ANY(${kerne})) LIMIT 1`) as any[];
  return !!z;
}

/** Die Fakten für jaFrageUrteil — für Maras Antwort (WhatsApp-Nummer bekannt) und für den Knopf in der Akte. */
export async function jaFrageFakten(ein: { nummer: string | null; personId: number | null; knopf?: boolean }, lauf: Lauf = sqlPool): Promise<JaFrageFakten & { kopf: number | null; ids: number[] }> {
  const fam = ein.personId ? await familie(ein.personId, lauf) : null;
  const ids = fam?.ids ?? [];
  const nummer = ein.nummer ?? null;
  const kern = nummer ? nummerKern(nummer) : null;
  const kerne = kern ? [kern] : [];
  const sperre = fam ? await menschSperre(fam.kopf, lauf) : null;
  return {
    kopf: fam?.kopf ?? null, ids,
    nummer,
    fensterOffen: nummer ? await fensterOffen(nummer, lauf) : false,
    hatJa: await gueltigesJa(ids, kerne, lauf),
    telefonSperre: await telefonGesperrt(kern, fam?.kopf ?? null, lauf),
    global: fam ? await istGlobalKunde(fam.kopf, lauf) : false,
    // Ein Testkonto darf gefragt werden (Justins eigene Nummer zum Ausprobieren) — wie beim Nachfassen.
    werbeGrund: werbungVerboten(sperre ? { ...sperre, test: false } : null),
    zuletztGefragtAm: (await zuletztGefragt(nummer, ids, lauf))?.am ?? null,
    wartetAufAntwort: ein.knopf && nummer ? await wartetAufAntwort(nummer, lauf) : false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AKTE
// ═══════════════════════════════════════════════════════════════════════════
export interface JaGespraech { id: number; beginn: string; laeuft: boolean }
export interface JaLage {
  ok: true;
  /** Das gültige Ja — sonst das zuletzt widerrufene — sonst null. */
  aktuell: JaEintrag | null;
  gueltig: boolean;
  /** „Ja zum Anruf: seit 22.10. (WhatsApp)“ / „… · Widerrufen am …“ / „Noch kein Ja zum Anruf“. */
  zeile: string;
  /** Darf Mara gerade per WhatsApp fragen? Sonst EIN Satz warum (der Knopf ist dann grau mit genau diesem Satz). */
  frage: JaFrageUrteil & { zuletzt: string | null };
  /** Das Gespräch, das ein Eintrag als Beleg mitnimmt (dein laufendes oder letztes der letzten 2 Stunden). */
  gespraech: JaGespraech | null;
}

/** Die Nummernkerne eines Menschen: Telefon aus der Akte und jede WhatsApp-Nummer, über die er schrieb. */
async function kerneVon(ids: number[], lauf: Lauf): Promise<string[]> {
  const zeilen = (await lauf`
    SELECT primary_phone AS n FROM fiaon_persons WHERE id = ANY(${ids}) AND primary_phone IS NOT NULL
    UNION SELECT DISTINCT nummer AS n FROM fiaon_whatsapp WHERE person_id = ANY(${ids}) AND richtung = 'rein'`) as any[];
  return Array.from(new Set(zeilen.map((z) => nummerKern(String(z.n ?? ""))).filter((k): k is string => !!k)));
}

async function aktuellesJa(ids: number[], kerne: string[], lauf: Lauf): Promise<{ eintrag: JaEintrag | null; gueltig: boolean }> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    SELECT id, art, erteilt_am, widerrufen_am, beleg,
           (widerrufen_am IS NULL AND erteilt_am > NOW() - make_interval(years => ${EINWILLIGUNG_JAHRE})) AS gilt
      FROM fiaon_telefon_einwilligung
     WHERE person_id = ANY(${ids}) OR nummer_kern = ANY(${kerne})
     ORDER BY (widerrufen_am IS NULL AND erteilt_am > NOW() - make_interval(years => ${EINWILLIGUNG_JAHRE})) DESC,
              COALESCE(widerrufen_am, erteilt_am) DESC, id DESC
     LIMIT 1`) as any[];
  if (!z) return { eintrag: null, gueltig: false };
  const beleg = z.beleg && typeof z.beleg === "object" ? z.beleg : {};
  return {
    gueltig: z.gilt === true,
    eintrag: {
      id: Number(z.id), art: String(z.art), seit: new Date(z.erteilt_am).toISOString(),
      von: typeof beleg.mitarbeiterName === "string" ? beleg.mitarbeiterName : null,
      widerrufenAm: z.widerrufen_am ? new Date(z.widerrufen_am).toISOString() : null,
    },
  };
}

/** Dein laufendes oder letztes Gespräch mit diesem Menschen (letzte 2 Stunden) — der Beleg eines Eintrags. */
async function gespraechFuer(ids: number[], agentId: number, lauf: Lauf): Promise<(JaGespraech & { nummer: string | null; aufnahme: boolean }) | null> {
  const [c] = (await lauf`
    SELECT id, beginn, status, nummer, recording_url IS NOT NULL AS aufnahme FROM fiaon_calls
     WHERE person_id = ANY(${ids}) AND agent_id = ${agentId} AND beginn > NOW() - make_interval(hours => ${JA_GESPRAECH_STUNDEN})
     ORDER BY (status IN ('laeuft', 'gewaehlt')) DESC, beginn DESC LIMIT 1`) as any[];
  return c ? { id: Number(c.id), beginn: new Date(c.beginn).toISOString(), laeuft: ["laeuft", "gewaehlt"].includes(String(c.status)), nummer: c.nummer ?? null, aufnahme: c.aufnahme === true } : null;
}

export async function jaLage(personId: number, agentId: number, lauf: Lauf = sqlPool): Promise<JaLage | null> {
  const [p] = (await lauf`SELECT id FROM fiaon_persons WHERE id = ${personId}`) as any[];
  if (!p) return null;
  const fam = await familie(personId, lauf);
  const kerne = await kerneVon(fam.ids, lauf);
  const { eintrag, gueltig } = await aktuellesJa(fam.ids, kerne, lauf);
  const wa = await waNummerVon(fam.ids, lauf);
  const fakten = await jaFrageFakten({ nummer: wa?.nummer ?? null, personId, knopf: true }, lauf);
  const urteil = jaFrageUrteil(fakten);
  const g = await gespraechFuer(fam.ids, agentId, lauf);
  return {
    ok: true, aktuell: eintrag, gueltig, zeile: jaZeile(eintrag),
    frage: { ...urteil, zuletzt: fakten.zuletztGefragtAm ? new Date(fakten.zuletztGefragtAm as any).toISOString() : null },
    gespraech: g ? { id: g.id, beginn: g.beginn, laeuft: g.laeuft } : null,
  };
}

/** Ein Vermerk im Verlauf der Akte (wie waAktenvermerk, aber mit dem Mitarbeiter) — wirft nie. */
async function aktenvermerk(personId: number | null, text: string, wer: { id: number | null; name: string }, lauf: Lauf): Promise<void> {
  if (!personId) return;
  try {
    const [a] = (await lauf`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND ref IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (!a?.ref) return; // reiner Lead: der Verlauf steht im WhatsApp-Raum und im Protokoll
    await lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${personId}, ${String(a.ref)}, ${wer.id}, ${wer.name.slice(0, 80)}, 'system', ${text.slice(0, 1000)})`;
  } catch (e) {
    console.error("[JA-ZUM-ANRUF] Aktenvermerk:", String((e as Error)?.message ?? e).slice(0, 200));
  }
}

async function protokoll(ein: { text: string; personId: number | null; leadId?: number | null; nummer?: string | null; daten?: Record<string, unknown>; kanal?: string }, lauf: Lauf): Promise<void> {
  try {
    const { protokollieren } = await import("./fiaon-mara-termin");
    await protokollieren({ kanal: ein.kanal ?? "whatsapp", art: "ja_zum_anruf", ok: true, text: ein.text, personId: ein.personId, leadId: ein.leadId ?? null, nummer: ein.nummer ?? null, daten: ein.daten ?? null }, lauf);
  } catch (e) { console.error("[JA-ZUM-ANRUF] Protokoll:", String((e as Error)?.message ?? e).slice(0, 200)); }
}

type Ergebnis = { ok: true; id?: number; anzahl?: number; meldung: string } | { ok: false; status: number; grund: string };

/**
 * „Ja zum Anruf eintragen“ (Akte) — Art „chef“. Nur mit der Pflicht-Bestätigung: `bestaetigt` muss genau true sein
 * (ein Häkchen, das der Mitarbeiter selbst setzt). Nachweis: der Satz (JA_AKTE_BESTAETIGUNG), Mitarbeiter, Zeitpunkt
 * und — wenn vorhanden — sein laufendes oder letztes Gespräch mit diesem Menschen (Kennung, Beginn, Aufnahme ja/nein).
 */
export async function jaEintragen(ein: { personId: number; agentId: number; agentName: string; bestaetigt: unknown }, lauf: Lauf = sqlPool): Promise<Ergebnis> {
  if (ein.bestaetigt !== true) return { ok: false, status: 400, grund: "Bitte zuerst bestätigen: Der Kunde hat es dir gerade im Gespräch gesagt." };
  const [p] = (await lauf`SELECT id, primary_phone, country FROM fiaon_persons WHERE id = ${ein.personId}`) as any[];
  if (!p) return { ok: false, status: 404, grund: "Diesen Kunden gibt es nicht." };
  const fam = await familie(ein.personId, lauf);
  const kerne = await kerneVon(fam.ids, lauf);
  const jetzt = await aktuellesJa(fam.ids, kerne, lauf);
  if (jetzt.gueltig && jetzt.eintrag) return { ok: false, status: 409, grund: `Er hat schon Ja gesagt – ${jaZeile(jetzt.eintrag).replace(/^Ja zum Anruf: /, "")}.` };
  const [kp] = (await lauf`SELECT primary_phone, country FROM fiaon_persons WHERE id = ${fam.kopf}`) as any[];
  const g = await gespraechFuer(fam.ids, ein.agentId, lauf);
  const quelle = kp?.primary_phone ?? p.primary_phone;
  const nummer = (quelle ? waehlbareNummer([{ nummer: quelle }], kp?.country ?? p.country).waehlbar : null) ?? g?.nummer ?? null;
  if (!nummer || !nummerKern(nummer)) return { ok: false, status: 409, grund: "In der Akte steht keine Telefonnummer — erst die Nummer eintragen." };
  if (await telefonGesperrt(nummerKern(nummer), fam.kopf, lauf)) {
    return { ok: false, status: 409, grund: "Für ihn steht „nicht mehr anrufen“ (Telefonsperre). Ein Ja zählt erst, wenn die Sperre aufgehoben ist." };
  }
  const am = new Date();
  const { id } = await einwilligungMerken({
    personId: fam.kopf, nummer, art: "chef", wortlaut: JA_AKTE_BESTAETIGUNG,
    quelleArt: g ? "gespraech" : "akte", quelleId: g ? String(g.id) : `agent:${ein.agentId}`, erteiltAm: am,
    beleg: {
      weg: "Akte › ARAS › Ja zum Anruf eintragen", bestaetigung: JA_AKTE_BESTAETIGUNG,
      mitarbeiterId: ein.agentId, mitarbeiterName: ein.agentName.slice(0, 80),
      gespraechId: g?.id ?? null, gespraechBeginn: g?.beginn ?? null, gespraechLaeuft: g?.laeuft ?? null, aufnahme: g?.aufnahme ?? null,
    },
  }, lauf);
  await aktenvermerk(fam.kopf, `Ja zum Anruf eingetragen (im Gespräch, auch ARAS): „${JA_AKTE_BESTAETIGUNG}“ — ${ein.agentName}${g ? `, Gespräch #${g.id}` : ""}. Nachweis § 7a UWG Nr. ${id}.`, { id: ein.agentId, name: ein.agentName }, lauf);
  await protokoll({ kanal: "telefon", text: `Ja zum Anruf eingetragen (Akte, ${ein.agentName})`, personId: fam.kopf, nummer, daten: { einwilligungId: id, agentId: ein.agentId, gespraechId: g?.id ?? null } }, lauf);
  return { ok: true, id, meldung: "Eingetragen — ab jetzt darf FIAON ihn anrufen, auch ARAS." };
}

/** „Ja widerrufen“ (Akte) — jedes gültige Ja dieses Menschen (alle Personen der Familie, alle seine Nummern). */
export async function jaWiderrufen(ein: { personId: number; agentId: number; agentName: string }, lauf: Lauf = sqlPool): Promise<Ergebnis> {
  const [p] = (await lauf`SELECT id FROM fiaon_persons WHERE id = ${ein.personId}`) as any[];
  if (!p) return { ok: false, status: 404, grund: "Diesen Kunden gibt es nicht." };
  const fam = await familie(ein.personId, lauf);
  const kerne = await kerneVon(fam.ids, lauf);
  const quelle = `akte:${ein.agentId} ${ein.agentName}`.slice(0, 200);
  let anzahl = 0;
  for (const pid of fam.ids) anzahl += await einwilligungWiderrufen({ personId: pid, quelle }, lauf);
  for (const k of kerne) anzahl += await einwilligungWiderrufen({ nummerKern: k, quelle }, lauf);
  if (!anzahl) return { ok: false, status: 409, grund: "Es gibt kein gültiges Ja, das sich widerrufen ließe." };
  await aktenvermerk(fam.kopf, `Ja zum Anruf widerrufen (Akte, ${ein.agentName}) — FIAON ruft ihn ohne neues Ja nicht mehr zu Werbezwecken an.`, { id: ein.agentId, name: ein.agentName }, lauf);
  await protokoll({ kanal: "telefon", text: `Ja zum Anruf widerrufen (Akte, ${ein.agentName})`, personId: fam.kopf, daten: { anzahl, agentId: ein.agentId } }, lauf);
  return { ok: true, anzahl, meldung: "Widerrufen — ohne neues Ja ruft FIAON ihn nicht mehr an (Werbung)." };
}

/** Der Sendeweg (waSenden) — im Prüfstand eine Attrappe. */
export type JaSenden = (an: string, inhalt: { text: string }, zusatz: { personId?: number | null; leadId?: number | null; von?: string | null }, lauf: Lauf) => Promise<{ ok: boolean; waId?: string; grund?: string }>;

/**
 * Der Knopf „Mara fragt nach dem Ja“ (Akte): Mara schickt JA_FRAGE_WA JETZT als eigene Nachricht — nur, wenn
 * jaFrageUrteil es erlaubt (offenes Fenster, kein Ja, keine Sperre, nicht in den letzten 30 Tagen gefragt, keine
 * Nachricht von ihm wartet noch auf Antwort). Absender „Mara … (Ja-Frage)“: Für Maras Gesprächsregeln ist es ihre
 * Nachricht, sein „Ja“ darauf beantwortet also Mara (mit dem festen Dank), nicht ein Kollege.
 */
export async function maraFragtNachDemJa(ein: { personId: number; agentId: number; agentName: string }, lauf: Lauf = sqlPool, senden?: JaSenden): Promise<Ergebnis> {
  const [p] = (await lauf`SELECT id FROM fiaon_persons WHERE id = ${ein.personId}`) as any[];
  if (!p) return { ok: false, status: 404, grund: "Diesen Kunden gibt es nicht." };
  const fam = await familie(ein.personId, lauf);
  const wa = await waNummerVon(fam.ids, lauf);
  const urteil = jaFrageUrteil(await jaFrageFakten({ nummer: wa?.nummer ?? null, personId: ein.personId, knopf: true }, lauf));
  if (!urteil.darf || !wa) return { ok: false, status: 409, grund: urteil.grund ?? "Mara kann gerade nicht fragen." };
  if (!(await jaFrageSchalter(lauf))) return { ok: false, status: 409, grund: "Die Frage nach dem Ja ist im KI-Raum ausgeschaltet." };
  const { agentNamen } = await import("./fiaon-postmeister-agent");
  const namen = await agentNamen();
  const sende: JaSenden = senden ?? (async (an, inhalt, zusatz, l) => (await import("./fiaon-whatsapp")).waSenden(an, inhalt, zusatz, l));
  const erg = await sende(wa.nummer, { text: JA_FRAGE_WA }, { personId: wa.personId ?? fam.kopf, leadId: wa.leadId, von: `${namen.voll} ${JA_FRAGE_MARKE}` }, lauf);
  if (!erg.ok) return { ok: false, status: 502, grund: `Die Nachricht ging nicht raus: ${String(erg.grund ?? "unbekannt").slice(0, 200)}` };
  await aktenvermerk(fam.kopf, `Mara hat auf WhatsApp gefragt, ob wir ihn anrufen dürfen (auch ARAS) — Knopf von ${ein.agentName}.`, { id: ein.agentId, name: ein.agentName }, lauf);
  await protokoll({ text: `Frage nach dem Ja zum Anruf geschickt (Knopf in der Akte, ${ein.agentName})`, personId: fam.kopf, leadId: wa.leadId, nummer: wa.nummer, daten: { agentId: ein.agentId, waId: erg.waId ?? null } }, lauf);
  return { ok: true, meldung: "Mara hat gefragt. Antwortet er mit JA, steht es hier." };
}

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════
export interface JaAusWhatsApp { ja: boolean; nein: boolean; id?: number; neu?: boolean; widerrufen?: number; gesperrt?: boolean; grund?: string }

/**
 * Jede eingehende WhatsApp (waEingang, VOR Maras Antwort). Wirft nur bei Datenbankfehlern — der Aufrufer fängt.
 *   · KLARES JA (istKlaresJa) als ERSTE Nachricht nach Maras Frage (die Frage ist unsere letzte Nachricht, keine andere
 *     Kundennachricht dazwischen, höchstens 7 Tage danach) → genau EINE Einwilligung „zuruf_whatsapp“: Wortlaut = die
 *     gestellte Frage (die Fassung, die er gelesen hat), Zeitpunkt = sein Ja, Quelle = seine Nachricht, Beleg = beide
 *     Nachrichten (unsere Kennung und die von Meta, Text, Zeit, Absender).
 *   · „Bitte nicht anrufen“ (istNeinZumAnruf) → jedes gültige Ja dieser Nummer und dieses Menschen ist widerrufen.
 *   · Klares „nicht mehr anrufen“ / „keine Anrufe mehr“ / „rufen Sie mich nie wieder an“ / „hören Sie auf anzurufen“
 *     (istAnrufSperreWunsch) → zusätzlich die Telefonsperre: derselbe Weg wie ARAS' Werkzeug nicht_mehr_anrufen
 *     (fiaon-aras-werkzeuge.ts: telefonSperren + einwilligungWiderrufen), Quelle „whatsapp“. Wie dort setzt
 *     telefonSperren auch die Werbesperre der Person und sperrt ihre wartenden ARAS-Anrufe.
 */
export async function jaAusWhatsApp(ein: { nummer: string; nachrichtId: number; text: string; personId: number | null; leadId: number | null; am?: Date | string | null }, lauf: Lauf = sqlPool): Promise<JaAusWhatsApp> {
  const ja = istKlaresJa(ein.text);
  const sperre = !ja && istAnrufSperreWunsch(ein.text);
  const nein = !ja && (sperre || istNeinZumAnruf(ein.text));
  if (!ja && !nein) return { ja: false, nein: false };
  await arasSchema(lauf);
  const fam = ein.personId ? await familie(ein.personId, lauf) : null;
  const kern = nummerKern(ein.nummer);

  if (nein) {
    const sein = ein.text.replace(/\s+/g, " ").slice(0, 160);
    if (sperre) {
      // Derselbe Weg wie ARAS' Werkzeug nicht_mehr_anrufen — die Sperre gilt für alle (Nummer UND Person).
      await telefonSperren({ nummerKern: kern, personId: fam?.kopf ?? null, quelle: "whatsapp", grund: `Kunde per WhatsApp (Nachricht ${ein.nachrichtId}): „${sein.slice(0, 140)}“` }, lauf);
    }
    const quelle = `whatsapp:${ein.nachrichtId}`;
    let widerrufen = kern ? await einwilligungWiderrufen({ nummerKern: kern, quelle }, lauf) : 0;
    for (const pid of fam?.ids ?? []) widerrufen += await einwilligungWiderrufen({ personId: pid, quelle }, lauf);
    if (sperre) {
      await aktenvermerk(fam?.kopf ?? null, `Nicht mehr anrufen (WhatsApp): „${sein}“ — Telefonsperre gesetzt (gilt für alle, auch ARAS), Werbesperre gesetzt${widerrufen ? ", Ja zum Anruf widerrufen" : ""}.`, { id: null, name: "Mara" }, lauf);
      await protokoll({ text: "Telefonsperre per WhatsApp (nicht mehr anrufen)", personId: fam?.kopf ?? null, leadId: ein.leadId, nummer: ein.nummer, daten: { nachrichtId: ein.nachrichtId, widerrufen } }, lauf);
    } else if (widerrufen) {
      await aktenvermerk(fam?.kopf ?? null, `Ja zum Anruf zurückgenommen (WhatsApp): „${sein}“ — gespeichert, ohne neues Ja keine Werbeanrufe mehr.`, { id: null, name: "Mara" }, lauf);
      await protokoll({ text: "Ja zum Anruf per WhatsApp zurückgenommen", personId: fam?.kopf ?? null, leadId: ein.leadId, nummer: ein.nummer, daten: { nachrichtId: ein.nachrichtId, anzahl: widerrufen } }, lauf);
    }
    return { ja: false, nein: true, gesperrt: sperre, widerrufen };
  }

  const [frage] = (await lauf`
    SELECT id, wa_id, text, von, COALESCE(gesendet_am, created_at) AS am FROM fiaon_whatsapp
     WHERE nummer = ${ein.nummer} AND richtung = 'raus' AND status <> 'fehler' AND id < ${ein.nachrichtId}
     ORDER BY id DESC LIMIT 1`) as any[];
  const fassung = frage ? jaFrageIn(frage.text) : null;
  if (!frage || !fassung) return { ja: false, nein: false, grund: "Unsere letzte Nachricht war nicht die Frage nach dem Ja." };
  const [dazwischen] = (await lauf`
    SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${ein.nummer} AND richtung = 'rein' AND id > ${Number(frage.id)} AND id < ${ein.nachrichtId} LIMIT 1`) as any[];
  if (dazwischen) return { ja: false, nein: false, grund: "Nicht seine erste Antwort auf die Frage." };
  const [rein] = (await lauf`SELECT wa_id, COALESCE(empfangen_am, created_at) AS am FROM fiaon_whatsapp WHERE id = ${ein.nachrichtId}`) as any[];
  const jaAm = new Date(ein.am ?? rein?.am ?? Date.now());
  if (jaAm.getTime() - new Date(frage.am).getTime() > JA_ANTWORT_GILT_TAGE * 86_400_000) {
    return { ja: false, nein: false, grund: `Das Ja kam mehr als ${JA_ANTWORT_GILT_TAGE} Tage nach der Frage.` };
  }
  const [schon] = (await lauf`
    SELECT id FROM fiaon_telefon_einwilligung WHERE art = 'zuruf_whatsapp' AND quelle_art = 'whatsapp' AND quelle_id = ${String(ein.nachrichtId)} LIMIT 1`) as any[];
  if (schon) return { ja: true, nein: false, id: Number(schon.id), neu: false };
  const { id } = await einwilligungMerken({
    personId: fam?.kopf ?? null, leadId: ein.leadId, nummer: e164(ein.nummer), art: "zuruf_whatsapp", wortlaut: fassung,
    quelleArt: "whatsapp", quelleId: String(ein.nachrichtId), erteiltAm: jaAm,
    beleg: {
      kanal: "whatsapp",
      frage: { nachrichtId: Number(frage.id), waId: frage.wa_id ?? null, am: new Date(frage.am).toISOString(), von: frage.von ?? null, knopf: String(frage.von ?? "").includes(JA_FRAGE_MARKE) },
      antwort: { nachrichtId: ein.nachrichtId, waId: rein?.wa_id ?? null, am: jaAm.toISOString(), text: ein.text.slice(0, 200) },
    },
  }, lauf);
  await aktenvermerk(fam?.kopf ?? null, `Ja zum Anruf per WhatsApp: „${ein.text.replace(/\s+/g, " ").slice(0, 80)}“ auf Maras Frage — gespeichert (Nachweis § 7a UWG Nr. ${id}).`, { id: null, name: "Mara" }, lauf);
  await protokoll({ text: `Ja zum Anruf per WhatsApp gespeichert („${ein.text.slice(0, 60)}“)`, personId: fam?.kopf ?? null, leadId: ein.leadId, nummer: ein.nummer, daten: { einwilligungId: id, frageId: Number(frage.id), antwortId: ein.nachrichtId } }, lauf);
  return { ja: true, nein: false, id, neu: true };
}

/**
 * Für Maras Antwort: welche offenen Nachrichten ein gespeichertes Ja, ein Widerruf oder eine Telefonsperre sind — und ob
 * die Frage zuletzt dastand. Sperre = die Nachricht verlangt sie (istAnrufSperreWunsch) UND sie steht für diese Nummer.
 */
export async function jaImGespraech(ein: { nummer: string; offene: { id: number; text: string }[]; ersteOffeneId: number }, lauf: Lauf = sqlPool): Promise<{ gespeichertIds: number[]; zurueckIds: number[]; sperreIds: number[]; frageOffen: boolean }> {
  const leer = { gespeichertIds: [] as number[], zurueckIds: [] as number[], sperreIds: [] as number[], frageOffen: false };
  if (!ein.offene.length) return leer;
  await arasSchema(lauf);
  const ids = ein.offene.map((o) => String(o.id));
  const wollenSperre = ein.offene.filter((o) => istAnrufSperreWunsch(o.text));
  const gesperrt = wollenSperre.length > 0 && await telefonGesperrt(nummerKern(ein.nummer), null, lauf);
  const ja = (await lauf`
    SELECT quelle_id FROM fiaon_telefon_einwilligung WHERE art = 'zuruf_whatsapp' AND quelle_art = 'whatsapp' AND quelle_id = ANY(${ids})`) as any[];
  const zurueck = (await lauf`
    SELECT DISTINCT widerruf_quelle FROM fiaon_telefon_einwilligung WHERE widerruf_quelle = ANY(${ids.map((i) => `whatsapp:${i}`)})`) as any[];
  const [vorher] = (await lauf`
    SELECT text FROM fiaon_whatsapp WHERE nummer = ${ein.nummer} AND richtung = 'raus' AND status <> 'fehler' AND id < ${ein.ersteOffeneId}
     ORDER BY id DESC LIMIT 1`) as any[];
  return {
    gespeichertIds: ja.map((z) => Number(z.quelle_id)),
    zurueckIds: zurueck.map((z) => Number(String(z.widerruf_quelle).slice("whatsapp:".length))),
    sperreIds: gesperrt ? wollenSperre.map((o) => o.id) : [],
    frageOffen: !!vorher && !!jaFrageIn(vorher.text),
  };
}

/**
 * Darf die Frage an DIESE Antwort von Mara? Dann JA_FRAGE_WA, sonst null. `ruhe` = Gründe aus Maras Lage, aus denen
 * sie heute nicht fragt (heikles Anliegen, Kündigung, Übergabe, Rückfallsatz, Termin, er will selbst telefonieren …).
 * Maras Antwort selbst bleibt unverändert — der Aufrufer hängt den Satz als eigenen Absatz an.
 */
export async function jaFrageZumAnhaengen(ein: { nummer: string; personId: number | null; antwort: string; ruhe: readonly string[] }, lauf: Lauf = sqlPool): Promise<string | null> {
  if (ein.ruhe.length || !antwortOhneFrage(ein.antwort)) return null;
  if (!(await jaFrageSchalter(lauf))) return null;
  const urteil = jaFrageUrteil(await jaFrageFakten({ nummer: ein.nummer, personId: ein.personId }, lauf));
  return urteil.darf ? JA_FRAGE_WA : null;
}
