// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM-ALARME — EINE ZEILE JE ALARM, SIE GEHT VON SELBST AUS (E-397, 19.10.2026)
//
// ── VORHER ────────────────────────────────────────────────────────────────
// Lead-Motor, KI-Pause, WhatsApp-Bremse, Telefon-Abgleich und Lauf-Wächter legten
// je Anschlag einen AUFTRAG in Justins Liste („Meine Liste“) — teils mit dem Tag
// im Schlüssel (lead-motor:stille:2026-10-12), teils ganz ohne Schlüssel (Telefon:
// jeder Lauf eine neue Zeile). War der Alarm vorbei, blieb der Auftrag trotzdem
// offen. Gemessen am 19.10.2026: 41 Lead-Motor-Aufträge offen, obwohl die Leads
// normal ankommen (15–24 am Tag) und die Alarme in fiaon_meta_alarme längst zu
// sind; 35 gleiche Telefon-Aufträge; 10 KI-Pause-, 6 WhatsApp-, 3 Lauf-Wächter-
// Aufträge. Zusammen mit der Termintreue 377 reine Meldungen in Justins Liste.
//
// ── NACHHER ───────────────────────────────────────────────────────────────
// Ein Alarm ist kein Auftrag, sondern ein ZUSTAND. Er steht als EINE Zeile in
// fiaon_system_alarme (fester Schlüssel, wie ein Aktenzeichen):
//   alarmMelden(schluessel, …)  schlägt an — gibt es die Zeile schon und ist sie
//                               offen, zählt nur „anzahl“ hoch; war sie vorbei,
//                               beginnt eine neue Episode (sichtbar, mit Zähler).
//   alarmVorbei(schluessel, …)  alles wieder gut — die Zeile geht aus; alte
//                               Aufträge desselben Alarms schließen mit dem
//                               Ereignis „Alarm vorbei“ (auftraegeAlarmSchliessen).
//   endet_nach_stunden          für Alarme ohne eigenes Ende (Telefon): ohne neue
//                               Meldung geht die Zeile nach N Stunden von selbst aus.
// Gezeigt wird die Tafel im Lagezimmer als Ampel (server/routes/fiaon-aufgaben-lage.ts).
// Ein Fehler hier hält nie den Aufrufer auf (Wächter, Webhooks, KI-Weg).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export type AlarmStufe = "rot" | "gelb";

export interface AlarmEin {
  /** Woher (lead-motor, ki-pause, wa-pause, telefon-abgleich, lauf-waechter). */
  quelle: string;
  titel: string;
  text?: string | null;
  stufe?: AlarmStufe;
  /** Wo man es löst (Chefbüro-Pfad). */
  link?: string | null;
  /** Ohne eigenes Ende: nach so vielen Stunden ohne neue Meldung geht der Alarm von selbst aus. */
  endetNachStunden?: number | null;
  /** Neuer Text wird angehängt statt ersetzt (z. B. je Aufnahme eine Kennung). */
  anhaengen?: boolean;
  /**
   * Jeder Aufruf IST ein neuer Vorfall (KI-Pause, WhatsApp-Pause, „Meta ROT“ melden genau einmal je Pause/Wechsel):
   * dann beginnt immer eine neue Episode — auch wenn die alte nicht über alarmVorbei ausging.
   */
  neueEpisode?: boolean;
}

export interface AlarmZeile {
  schluessel: string;
  quelle: string;
  titel: string;
  text: string | null;
  stufe: AlarmStufe;
  link: string | null;
  seit: string;
  zuletzt: string;
  anzahl: number;
  episoden: number;
  vorbeiAm: string | null;
  vorbeiGrund: string | null;
}

let bereit: Promise<void> | null = null;
/** Die Tabelle (dieselbe DDL wie db/migrations/113_hausputz.sql) — die DDL-Wache prüft vorher im Katalog. */
export function ensureAlarmTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_system_alarme (
          schluessel TEXT PRIMARY KEY,
          quelle VARCHAR(40) NOT NULL,
          titel TEXT NOT NULL,
          text TEXT,
          stufe VARCHAR(10) NOT NULL DEFAULT 'rot',
          link TEXT,
          erstmals_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zuletzt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          anzahl INTEGER NOT NULL DEFAULT 1,
          episoden INTEGER NOT NULL DEFAULT 1,
          endet_nach_stunden INTEGER,
          vorbei_am TIMESTAMPTZ,
          vorbei_grund TEXT
        )`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * Der Alarm schlägt an. Gibt zurück, ob damit eine NEUE Episode beginnt (vorher aus oder nie da) —
 * für Aufrufer, die nur beim ersten Anschlag etwas Zusätzliches tun (Mail, Protokoll).
 */
export async function alarmMelden(schluessel: string, ein: AlarmEin, lauf: Lauf = sqlPool): Promise<{ neu: boolean }> {
  try {
    await ensureAlarmTabelle(lauf);
    const titel = String(ein.titel || schluessel).slice(0, 300);
    const text = ein.text ? String(ein.text).slice(0, 8000) : null;
    const [r] = (await lauf`
      INSERT INTO fiaon_system_alarme (schluessel, quelle, titel, text, stufe, link, endet_nach_stunden)
      VALUES (${schluessel}, ${String(ein.quelle).slice(0, 40)}, ${titel}, ${text}, ${ein.stufe ?? "rot"}, ${ein.link ?? null}, ${ein.endetNachStunden ?? null})
      ON CONFLICT (schluessel) DO UPDATE SET
        titel = EXCLUDED.titel,
        text = CASE
          WHEN ${!!ein.anhaengen} AND fiaon_system_alarme.vorbei_am IS NULL AND NOT ${!!ein.neueEpisode} AND EXCLUDED.text IS NOT NULL
               AND strpos(COALESCE(fiaon_system_alarme.text, ''), EXCLUDED.text) = 0
            THEN RIGHT(CONCAT_WS(E'\n', NULLIF(fiaon_system_alarme.text, ''), EXCLUDED.text), 8000)
          ELSE COALESCE(EXCLUDED.text, fiaon_system_alarme.text) END,
        stufe = EXCLUDED.stufe, link = COALESCE(EXCLUDED.link, fiaon_system_alarme.link),
        endet_nach_stunden = EXCLUDED.endet_nach_stunden,
        zuletzt_am = NOW(),
        anzahl = CASE WHEN fiaon_system_alarme.vorbei_am IS NULL AND NOT ${!!ein.neueEpisode} THEN fiaon_system_alarme.anzahl + 1 ELSE 1 END,
        erstmals_am = CASE WHEN fiaon_system_alarme.vorbei_am IS NULL AND NOT ${!!ein.neueEpisode} THEN fiaon_system_alarme.erstmals_am ELSE NOW() END,
        episoden = fiaon_system_alarme.episoden + CASE WHEN fiaon_system_alarme.vorbei_am IS NULL AND NOT ${!!ein.neueEpisode} THEN 0 ELSE 1 END,
        vorbei_am = NULL, vorbei_grund = NULL
      RETURNING anzahl`) as any[];
    const neu = Number(r?.anzahl) === 1;
    if (neu) console.warn(`[ALARM] ${schluessel}: ${titel}`);
    return { neu };
  } catch (e) {
    console.error(`[ALARM] ${schluessel} nicht gemeldet:`, String(e).slice(0, 200));
    return { neu: false };
  }
}

/**
 * Alles wieder gut: der Alarm geht aus. `schluessel` endet mit „%“ = alle Zeilen mit diesem Anfang.
 * Schließt dazu die ALTEN Aufträge desselben Alarms (aus der Zeit vor E-397) mit dem Ereignis „Alarm vorbei“.
 * Gibt die Zahl der ausgegangenen Zeilen zurück.
 */
export async function alarmVorbei(schluessel: string, grund: string, lauf: Lauf = sqlPool,
  opt: { auftraege?: { quelle: string; schluesselWie?: string | null } } = {}): Promise<number> {
  let n = 0;
  try {
    await ensureAlarmTabelle(lauf);
    const wie = schluessel.endsWith("%");
    const r = (await lauf`
      UPDATE fiaon_system_alarme SET vorbei_am = NOW(), vorbei_grund = ${String(grund || "wieder gut").slice(0, 300)}
       WHERE vorbei_am IS NULL AND (${wie} AND schluessel LIKE ${schluessel} OR NOT ${wie} AND schluessel = ${schluessel})
       RETURNING schluessel`) as any[];
    n = r.length;
    if (n) console.log(`[ALARM] vorbei: ${r.map((x) => x.schluessel).join(", ")} — ${grund}`);
  } catch (e) {
    console.error(`[ALARM] ${schluessel} nicht beendet:`, String(e).slice(0, 200));
  }
  if (opt.auftraege) await auftraegeAlarmSchliessen(opt.auftraege.quelle, opt.auftraege.schluesselWie ?? null, grund, lauf);
  return n;
}

/**
 * Die alten Alarm-Aufträge (Justins Liste) schließen — „Automatisch erledigt durch Alarm vorbei (…)“.
 * Nur Aufträge auf Justins Board aus genau dieser Quelle; `schluesselWie` grenzt auf einen Alarm ein
 * (z. B. „lead-motor:stille:%“). Rückholbar wie jeder Auftrag („Wieder öffnen“).
 */
export async function auftraegeAlarmSchliessen(quelle: string, schluesselWie: string | null, grund: string, lauf: Lauf = sqlPool): Promise<number> {
  try {
    const offen = (await lauf`
      SELECT id FROM fiaon_betreiber_todos
       WHERE status <> 'erledigt' AND quelle = ${quelle} AND zustaendig_art = 'betreiber'
         AND (${schluesselWie}::text IS NULL OR schluessel LIKE ${schluesselWie}::text)
       ORDER BY id LIMIT 500`) as any[];
    if (!offen.length) return 0;
    const { auftragErledigen } = await import("./fiaon-auftraege");
    const { autoErledigtText } = await import("../../shared/fiaon-auftrag-arten");
    const text = autoErledigtText("alarm_vorbei", "System", new Date(), grund);
    let n = 0;
    for (const t of offen) {
      const zu = await auftragErledigen(Number(t.id), {
        art: "auto", von: "System", autorArt: "system", ereignis: `Alarm vorbei (${String(grund).slice(0, 200)}) – System`,
        ergebnis: text, beitragText: text,
      }, lauf);
      if (zu) n += 1;
    }
    if (n) console.log(`[ALARM] ${n} alte Auftrag/Aufträge aus „${quelle}“ geschlossen — ${grund}.`);
    return n;
  } catch (e) {
    console.error("[ALARM] alte Aufträge:", String(e).slice(0, 200));
    return 0;
  }
}

/** Alarme ohne eigenes Ende: nach endet_nach_stunden ohne neue Meldung von selbst aus. */
export async function alarmeAblaufen(lauf: Lauf = sqlPool): Promise<number> {
  try {
    await ensureAlarmTabelle(lauf);
    const r = (await lauf`
      UPDATE fiaon_system_alarme
         SET vorbei_am = NOW(), vorbei_grund = 'seit ' || endet_nach_stunden || ' Stunden keine neue Meldung'
       WHERE vorbei_am IS NULL AND endet_nach_stunden IS NOT NULL
         AND zuletzt_am < NOW() - make_interval(hours => endet_nach_stunden)
       RETURNING schluessel`) as any[];
    return r.length;
  } catch { return 0; }
}

/** Die Tafel: offene Alarme, dazu was in den letzten `vorbeiStunden` ausging. */
export async function alarmTafel(vorbeiStunden = 24, lauf: Lauf = sqlPool): Promise<AlarmZeile[]> {
  await ensureAlarmTabelle(lauf);
  await alarmeAblaufen(lauf);
  const rows = (await lauf`
    SELECT * FROM fiaon_system_alarme
     WHERE vorbei_am IS NULL OR vorbei_am > NOW() - make_interval(hours => ${vorbeiStunden})
     ORDER BY (vorbei_am IS NULL) DESC, (stufe = 'rot') DESC, zuletzt_am DESC
     LIMIT 40`) as any[];
  return rows.map((r) => ({
    schluessel: String(r.schluessel), quelle: String(r.quelle), titel: String(r.titel), text: r.text ?? null,
    stufe: (r.stufe === "gelb" ? "gelb" : "rot") as AlarmStufe, link: r.link ?? null,
    seit: new Date(r.erstmals_am).toISOString(), zuletzt: new Date(r.zuletzt_am).toISOString(),
    anzahl: Number(r.anzahl || 1), episoden: Number(r.episoden || 1),
    vorbeiAm: r.vorbei_am ? new Date(r.vorbei_am).toISOString() : null, vorbeiGrund: r.vorbei_grund ?? null,
  }));
}
