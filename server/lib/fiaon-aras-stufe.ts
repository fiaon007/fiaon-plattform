// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Stufen-Automatik (E-408 Scheibe 3 Teil 2; Nachtrag „Persona & Skalierung“ § 2)
//
// Takt „aras_stufe_ampel“ (alle 30 Min., fiaon-aras-start.ts). Je Lauf:
//   0. (E-409 Kalibrierung, 22.10.2026) einmal die alten Prüf-Mara-Zeilen seit dem Go-live mit den neuen Regeln neu rechnen;
//   1. die Werte der letzten Tage aus fiaon_aras_anruf (+ Zahlungen binnen 48 h, Werkzeuge, Prüf-Befunde mit Bestand) —
//      je Tag eine Zeile in fiaon_aras_stufe_tag (Farbe, Punkte, die Stufe des Tages);
//   2. ROT im Fenster der Stufe (nur Anrufe SEIT der letzten Stufen-Änderung — sonst ginge es nach einem
//      roten Tag jeden Tag eine Stufe weiter runter) → mit Automatik (aras_stufe_auto) eine Stufe zurück;
//      ohne Automatik nur die Karte;
//   3. GRÜN an 3 (Stufe 1) bzw. 5 (Stufe 2) abgeschlossenen Tagen in der Stufe → eine Stufe hoch;
//   4. höchstens EINE Änderung und höchstens EINE Karte je Tag (Schlüssel aras:stufe:<Tag>, karte_am).
// Nie aus Stufe 0 hoch (die schaltet Justin), nie über 3. Die Ampel selbst ist rein: shared/fiaon-aras-stufe.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { arasEinstellungenLesen, einstellungSetzen } from "./fiaon-aras-plan";
import { berlinTeile, STUFEN, type Spielart, type Stufe } from "../../shared/fiaon-aras";
import {
  tagesAmpel, stufenEntscheidung, fensterTage, tagMinus, tagAbgeschlossen, STUFEN_ZIELE, type TagesWerte, type AmpelFarbe, type AmpelPunkt, type TagEintrag, type SpielartWerte,
} from "../../shared/fiaon-aras-stufe";
import { anrufZaehltAlsPruefFehler } from "../../shared/fiaon-ki-pruefung-regeln";

type Lauf = typeof sqlPool;

const ERREICHT = (ergebnis: unknown) => /^erreicht/.test(String(ergebnis ?? "")) || ergebnis === "rueckruf_termin" || ergebnis === "uebergeben";

/** Die Werte der Kundenanrufe in [von, bis) — `messbar`: Zahlungen binnen 48 h zählen (sonst null). */
export async function werteImZeitraum(e: { tag: string; stufe: number; von: Date; bis: Date; messbar: boolean }, lauf: Lauf = sqlPool): Promise<TagesWerte> {
  const zeilen = (await lauf`
    SELECT aa.spielart, aa.ergebnis, aa.ende_grund, aa.sekunden_sitzung, aa.kosten_ki_cents, aa.kosten_telefon_cents, aa.pruefung_status, aa.pruefung,
           EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = aa.id AND w.werkzeug = 'nicht_mehr_anrufen' AND w.ok IS TRUE) AS sperrwunsch,
           EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = aa.id AND w.werkzeug = 'mensch_verbinden' AND w.eingabe->>'grund' = 'beschwerde') AS beschwerde,
           (c.ref IS NOT NULL AND (
              EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = c.ref AND r.bezahlt_am >= COALESCE(c.beginn, aa.created_at) AND r.bezahlt_am < COALESCE(c.beginn, aa.created_at) + INTERVAL '48 hours')
              OR EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = c.ref AND a.paid_at >= COALESCE(c.beginn, aa.created_at) AND a.paid_at < COALESCE(c.beginn, aa.created_at) + INTERVAL '48 hours')
           )) AS zahlung48,
           k.punkte AS k_punkte, k.entschieden AS k_entschieden
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id
      LEFT JOIN LATERAL (SELECT punkte, entschieden FROM fiaon_ki_pruefung kp
                          WHERE kp.bezug_art = 'aras_anruf' AND kp.bezug_id = aa.id AND kp.modell IS DISTINCT FROM 'laeuft' ORDER BY kp.id DESC LIMIT 1) k ON TRUE
     WHERE aa.spielart <> 'probe' AND aa.created_at >= ${e.von} AND aa.created_at < ${e.bis}`) as any[];
  const w: TagesWerte = { tag: e.tag, stufe: e.stufe, versuche: 0, gespraeche: 0, je: {}, kostenEuro: 0, zahlungen48: e.messbar ? 0 : null, sekundenGespraeche: 0, abbrueche: 0, uebergaben: 0, pruefFehler: 0 };
  for (const z of zeilen) {
    const s = String(z.spielart) as Spielart;
    const je: SpielartWerte = w.je[s] ?? (w.je[s] = { versuche: 0, erreicht: 0, zahlungen48: e.messbar ? 0 : null });
    w.versuche += 1; je.versuche += 1;
    w.kostenEuro += (Number(z.kosten_ki_cents ?? 0) + Number(z.kosten_telefon_cents ?? 0)) / 100;
    if (!ERREICHT(z.ergebnis)) continue;
    w.gespraeche += 1; je.erreicht += 1;
    w.sekundenGespraeche += Number(z.sekunden_sitzung ?? 0);
    if (z.zahlung48 && e.messbar) { w.zahlungen48 = (w.zahlungen48 ?? 0) + 1; je.zahlungen48 = (je.zahlungen48 ?? 0) + 1; }
    // Abbruch: „nicht mehr anrufen“, Beschwerde, oder er legte in den ersten 30 Sekunden auf
    if (z.sperrwunsch || z.beschwerde || (z.ende_grund === "kunde_aufgelegt" && Number(z.sekunden_sitzung ?? 0) < 30)) w.abbrueche += 1;
    if (z.ergebnis === "uebergeben") w.uebergaben += 1;
    // E-409 Kalibrierung (22.10.2026): nur ein harter Punkt, der Bestand hat — aus Prüf-Maras Zeile, sonst aus dem Live-Befund.
    // Ein „fehler“ ohne solchen Punkt (alte Fehlalarme, Modell-Urteil ohne Regel) zählt nicht; „In Ordnung“ von Justin nie.
    if (anrufZaehltAlsPruefFehler({ status: z.pruefung_status, punkte: z.k_punkte, entschieden: z.k_entschieden, live: z.pruefung })) w.pruefFehler += 1;
  }
  w.kostenEuro = Math.round(w.kostenEuro * 100) / 100;
  return w;
}

/** Mitternacht (Berlin) eines Tages als Zeitpunkt — über die Datenbank (Sommer-/Winterzeit richtig). */
async function berlinMitternacht(tag: string, lauf: Lauf): Promise<Date> {
  const [z] = (await lauf`SELECT (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin') AS t`) as any[];
  return new Date(z.t);
}

export interface StufenLauf {
  geaendert: boolean; stufe: number; neu: number | null; richtung: "hoch" | "runter" | null;
  farbe: AmpelFarbe; rotJetzt: boolean; grund: string; karte: boolean; punkte: AmpelPunkt[];
}

/**
 * Ein Lauf der Automatik (Takt alle 30 Min.). `jetzt` nur für Prüfstände. Liefert, was entschieden wurde.
 * Ohne Kundenanrufe passiert nichts — außer dass die Tageszeilen geschrieben werden.
 */
export async function stufeAutomatik(lauf: Lauf = sqlPool, jetzt = new Date()): Promise<StufenLauf> {
  await arasSchema(lauf);
  // E-409 Kalibrierung (22.10.2026): erst die alten Prüf-Mara-Zeilen mit den neuen Regeln (einmal, sonst sofort zurück) — die
  // Ampel rechnet nie mit Fehlalarmen der alten Fassung, auch nicht im ersten Lauf nach dem Deploy.
  await (await import("./fiaon-ki-pruefung")).arasPruefungenNeuBewerten({ sofort: true })
    .catch((e) => console.error("[ARAS-STUFE] Neubewertung Prüf-Mara:", String((e as Error)?.message ?? e).slice(0, 160)));
  const einst = await arasEinstellungenLesen(true, lauf);
  const heute = berlinTeile(jetzt).datum;
  const stufe = einst.stufe as number;
  // Seit wann gilt die jetzige Stufe? (Zeitpunkt der letzten Änderung von aras_stufe — von Hand oder von hier)
  const [st] = (await lauf`SELECT updated_at FROM fiaon_settings WHERE key = 'aras_stufe'`.catch(() => [])) as any[];
  const stufeSeit = st?.updated_at ? new Date(st.updated_at) : new Date(0);
  const stufeSeitTag = berlinTeile(stufeSeit).datum;

  // 1. Tageszeilen der letzten 8 Tage (die Stufe eines vergangenen Tages bleibt, wie sie damals war)
  const alt = new Map(((await lauf`SELECT tag::text AS tag, stufe, entscheidung, karte_am FROM fiaon_aras_stufe_tag WHERE tag >= ${tagMinus(heute, 8)}::date`) as any[]).map((z) => [String(z.tag), z]));
  const tage: TagEintrag[] = [];
  for (let n = 0; n <= 7; n++) {
    const tag = tagMinus(heute, n);
    // Ohne Zeile ist die Stufe des Tages unbekannt (-1) — so ein Tag zählt nie für „grün in Folge“.
    const tagStufe = n === 0 ? stufe : alt.has(tag) ? Number(alt.get(tag).stufe) : -1;
    const von = await berlinMitternacht(tag, lauf), bis = await berlinMitternacht(tagMinus(tag, -1), lauf);
    const w = await werteImZeitraum({ tag, stufe: tagStufe, von, bis, messbar: tagAbgeschlossen(tag, heute) }, lauf);
    const a = tagesAmpel(w);
    if (w.versuche || alt.has(tag) || n === 0) {
      await lauf`
        INSERT INTO fiaon_aras_stufe_tag (tag, stufe, werte, farbe, punkte, updated_at)
        VALUES (${tag}::date, ${tagStufe}, ${lauf.json(w as any)}, ${a.farbe}, ${lauf.json(a.punkte as any)}, NOW())
        ON CONFLICT (tag) DO UPDATE SET werte = EXCLUDED.werte, farbe = EXCLUDED.farbe, punkte = EXCLUDED.punkte, updated_at = NOW(),
               stufe = CASE WHEN fiaon_aras_stufe_tag.tag = ${heute}::date THEN EXCLUDED.stufe ELSE fiaon_aras_stufe_tag.stufe END`;
    }
    // Für „grün in Folge“ zählen nur Tage NACH der letzten Stufen-Änderung (ein Tag mit Wechsel ist gemischt).
    if (tag > stufeSeitTag) tage.push({ tag, stufe: tagStufe, farbe: a.farbe, versuche: w.versuche, abgeschlossen: tagAbgeschlossen(tag, heute) });
  }

  // 2. ROT jetzt? Nur Anrufe seit der Stufen-Änderung und im Fenster der Stufe (inkl. heute bis jetzt). „Jetzt“ ist das
  // Spätere aus Prozess- und Datenbank-Uhr (+1 s): created_at setzt die Datenbank — eine Uhr-Abweichung von ein paar
  // Millisekunden darf einen gerade geschriebenen Anruf nicht aus dem Fenster fallen lassen (Prüfstand 20.10.: 1 von 3 rot).
  const fensterVon = await berlinMitternacht(tagMinus(heute, fensterTage(stufe) - 1), lauf);
  const seit = new Date(Math.max(fensterVon.getTime(), stufeSeit.getTime()));
  const [db] = (await lauf`SELECT NOW() AS t`) as any[];
  const bisJetzt = new Date(Math.max(jetzt.getTime(), new Date(db.t).getTime()) + 1000);
  const imFenster = await werteImZeitraum({ tag: `${berlinTeile(seit).datum}…${heute}`, stufe, von: seit, bis: bisJetzt, messbar: false }, lauf);
  const ampelJetzt = tagesAmpel(imFenster);
  const rotJetzt = ampelJetzt.farbe === "rot";

  // 3. Entscheidung — höchstens eine je Tag
  const heuteZeile = alt.get(heute);
  const e = stufenEntscheidung({ stufe, auto: einst.stufeAuto, rotJetzt, tage });
  const ergebnis: StufenLauf = { geaendert: false, stufe, neu: null, richtung: null, farbe: ampelJetzt.farbe, rotJetzt, grund: e.grund, karte: false, punkte: ampelJetzt.punkte };
  const roteSaetze = ampelJetzt.punkte.filter((p) => p.farbe === "rot").map((p) => `${p.name}: ${p.wert} (Ziel ${p.ziel})`).join(" · ");
  if (heuteZeile?.entscheidung) return { ...ergebnis, grund: `Heute schon entschieden: ${heuteZeile.entscheidung}` };

  if (e.neu != null && e.neu !== stufe) {
    await einstellungSetzen("aras_stufe", String(e.neu), "aras-stufen-ampel", lauf);
    const satz = e.richtung === "runter" ? `Stufe ${stufe} → ${e.neu} (Rot)` : `Stufe ${stufe} → ${e.neu} (grün)`;
    await lauf`UPDATE fiaon_aras_stufe_tag SET entscheidung = ${satz}, entscheidung_am = NOW(), stufe = ${e.neu} WHERE tag = ${heute}::date`;
    const karte = await karteMelden(heute, lauf, e.richtung === "runter"
      ? { stufe: "rot", titel: `ARAS: eine Stufe zurück — jetzt Stufe ${e.neu} (${STUFEN[e.neu].name})`, text: `Rot im Fenster der Stufe ${stufe}: ${roteSaetze || e.grund} Aras wählt ab jetzt nur noch nach Stufe ${e.neu}. Bitte die auffälligen Gespräche ansehen; hochschalten kannst du im KI-Team (Ausbaustufe).` }
      : { stufe: "gelb", titel: `ARAS: eine Stufe hoch — jetzt Stufe ${e.neu} (${STUFEN[e.neu].name})`, text: `${e.grund} Neue Grenzen: ${STUFEN[e.neu].versucheJeTag} Anrufe am Tag, ${STUFEN[e.neu].parallel} gleichzeitig, ${STUFEN[e.neu].tagEuro} € Tagesdeckel. Zurück geht es jederzeit im KI-Team (Ausbaustufe).` });
    console.log(`[ARAS-STUFE] ${satz} — ${e.grund}`);
    return { ...ergebnis, geaendert: true, neu: e.neu, richtung: e.richtung, karte };
  }
  // Rot ohne Automatik (oder schon in Stufe 0): keine Änderung, aber Justin erfährt es — einmal am Tag.
  if (rotJetzt && stufe >= 1) {
    const karte = await karteMelden(heute, lauf, { stufe: "rot", titel: "ARAS: Ampel rot — Automatik ist aus, Stufe bleibt", text: `${roteSaetze} Mit „Stufe automatisch“ ginge Aras jetzt eine Stufe zurück. Bitte ansehen.` });
    return { ...ergebnis, karte };
  }
  return ergebnis;
}

/** Höchstens EINE Karte je Tag an Justin (Schlüssel aras:stufe:<Tag>, karte_am in der Tageszeile). */
async function karteMelden(heute: string, lauf: Lauf, k: { stufe: "rot" | "gelb"; titel: string; text: string }): Promise<boolean> {
  const [z] = (await lauf`SELECT karte_am FROM fiaon_aras_stufe_tag WHERE tag = ${heute}::date`) as any[];
  if (z?.karte_am) return false;
  const { alarmMelden } = await import("./fiaon-system-alarme");
  await alarmMelden(`aras:stufe:${heute}`, { quelle: "aras", titel: k.titel, text: k.text, stufe: k.stufe, link: "/chef/s/aras?reiter=probe", endetNachStunden: 48 }, lauf).catch(() => null);
  await lauf`UPDATE fiaon_aras_stufe_tag SET karte_am = NOW() WHERE tag = ${heute}::date`;
  return true;
}

/** Für die Anzeige (KI-Team › Aras › Stufe): die letzten 14 Tage, die jetzige Stufe und was bis zur nächsten fehlt. */
export async function stufeLage(lauf: Lauf = sqlPool): Promise<{ stufe: number; auto: boolean; naechste: string; tage: { tag: string; stufe: number; farbe: string; entscheidung: string | null; punkte: AmpelPunkt[] }[]; ziele: typeof STUFEN_ZIELE }> {
  await arasSchema(lauf);
  const einst = await arasEinstellungenLesen(true, lauf);
  const zeilen = (await lauf`SELECT tag::text AS tag, stufe, farbe, entscheidung, punkte, (werte->>'versuche')::int AS versuche FROM fiaon_aras_stufe_tag ORDER BY tag DESC LIMIT 14`) as any[];
  // Dieselbe Regel wie die Automatik: grüne, abgeschlossene Tage IN der Stufe, nach der letzten Änderung.
  const [st] = (await lauf`SELECT updated_at FROM fiaon_settings WHERE key = 'aras_stufe'`.catch(() => [])) as any[];
  const seitTag = berlinTeile(st?.updated_at ? new Date(st.updated_at) : new Date(0)).datum;
  const heute = berlinTeile(new Date()).datum;
  const tage: TagEintrag[] = zeilen.filter((z) => String(z.tag) > seitTag).map((z) => ({ tag: String(z.tag), stufe: Number(z.stufe), farbe: String(z.farbe) as AmpelFarbe, versuche: Number(z.versuche ?? 0), abgeschlossen: tagAbgeschlossen(String(z.tag), heute) }));
  const naechste = einst.stufe === 0 ? "Aus Stufe 0 schaltest nur du (Einstellungen › Ausbaustufe)." : einst.stufe >= 3 ? "Höchste Stufe." : stufenEntscheidung({ stufe: einst.stufe, auto: true, rotJetzt: false, tage }).grund;
  return { stufe: einst.stufe, auto: einst.stufeAuto, naechste, ziele: STUFEN_ZIELE, tage: zeilen.map((z) => ({ tag: String(z.tag), stufe: Number(z.stufe), farbe: String(z.farbe), entscheidung: z.entscheidung ?? null, punkte: (z.punkte ?? []) as AmpelPunkt[] })) };
}

export type { Stufe };
