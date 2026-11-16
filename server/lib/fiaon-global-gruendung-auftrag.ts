// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG „GRÜNDUNG BESTELLEN“ — DATENBANK-TEIL (E-520, 17.11.2026)
//
// Regeln, Texte und die Bestell-Anleitung stehen rein in
// shared/fiaon-global-gruendung-auftrag.ts. Hier läuft, was die Datenbank braucht:
//
//   gruendungWaechter()      alle 10 Minuten: jede bezahlte Gründung ohne Station
//                            „Gründung eingereicht“ bekommt GENAU EINEN Auftrag bei der
//                            Person, die Gründungen bestellt (Mail „Neuer Auftrag für
//                            dich“ über den einen Auftragsweg). Ist die Station erledigt,
//                            geht der Auftrag von selbst zu. Bleibt er bis zum nächsten
//                            Werktag 10 Uhr offen: rote Zeile in der Ampel + EINE Mail an
//                            die Leitung.
//   gruendungSicht(ref)      was der Reiter „Gründung bestellen“ im Office zeigt.
//   gruendungBestellt(...)   der Mitarbeiter trägt die Bestellnummer ein → Haken, Station,
//                            Auftrag zu, Ampel aus.
//   gruendungDarf(...)       Zugriff auf die Akte für die Person mit dem offenen Auftrag —
//                            auch wenn sie den Auftrag sonst nicht führt.
//
// Der Wächter hängt bewusst NICHT am Buchungsweg der Zahlung: Er findet jede bezahlte
// Gründung, egal über welchen Weg sie bezahlt wurde (Bankbuch, Teilzahlung, von Hand) —
// und holt nach, was vor diesem Bau liegen blieb.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { usBundesstaatName } from "../../shared/fiaon-global-bereich";
import {
  GRUENDUNG_ALARM_QUELLE, GRUENDUNG_ENV, GRUENDUNG_HAKEN, GRUENDUNG_QUELLE, GRUENDUNG_SETTING, GRUENDUNG_STATION,
  gruendungAlarmSchluessel, gruendungAnlegenJetzt, gruendungAnleitung, gruendungAuftragText, gruendungBestellnummer, gruendungEskalation, gruendungFaellig,
  gruendungLink, gruendungSchluessel, gruendungUeberfaellig, type GruendungSchrittSicht,
} from "../../shared/fiaon-global-gruendung-auftrag";

export interface GruendungAgent { id: number; name: string }

const tagText = (d: unknown): string => {
  const x = d instanceof Date ? d : new Date(String(d ?? ""));
  if (Number.isNaN(x.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(x);
};
const tagZeitText = (d: unknown): string => {
  const x = d instanceof Date ? d : new Date(String(d ?? ""));
  if (Number.isNaN(x.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(x).replace(",", "") + " Uhr";
};

/** „DE“ → „Delaware“: Die Akte führt den Bundesstaat als Kürzel, der Auftrag nennt ihn beim Namen. Unbekanntes bleibt, wie es ist. */
function staatLang(roh: unknown): string {
  const s = String(roh ?? "").trim();
  if (!s) return "";
  return usBundesstaatName(s) ?? s;
}

/** jsonb als Objekt — auch wenn es als JSON-Text in der Spalte steht (doppelt verpackt, E-238/E-432). */
function alsObjekt(roh: unknown): Record<string, any> {
  let v: unknown = roh;
  for (let i = 0; i < 2 && typeof v === "string"; i++) { try { v = JSON.parse(v); } catch { return {}; } }
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}

/**
 * Wer bestellt Gründungen? Reihenfolge: Einstellung (fiaon_settings) → Umgebungsvariable → die Person, die
 * neue Global-Aufträge führt (global_zustaendig_agent_id). Nur aktive, nicht gesperrte, echte Konten.
 * null = niemand eingestellt (dann bleibt der Auftrag beim Betreiber — und die Ampel sagt es).
 */
export async function gruendungEmpfaenger(lauf: typeof sqlPool = sqlPool): Promise<GruendungAgent | null> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key IN (${GRUENDUNG_SETTING}, 'global_zustaendig_agent_id')`.catch(() => [])) as any[];
  const wert = (k: string) => Number(String(zeilen.find((z) => z.key === k)?.value ?? "").trim());
  const kandidaten = [wert(GRUENDUNG_SETTING), Number(String(process.env[GRUENDUNG_ENV] ?? "").trim()), wert("global_zustaendig_agent_id")]
    .filter((n) => Number.isInteger(n) && n > 0);
  for (const id of kandidaten) {
    const [a] = (await lauf`
      SELECT id, name FROM fiaon_agents
       WHERE id = ${id} AND COALESCE(active, TRUE) = TRUE AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL LIMIT 1`.catch(() => [])) as any[];
    if (a?.id) return { id: Number(a.id), name: String(a.name || "Mitarbeiter") };
  }
  return null;
}

interface Zeile {
  ref: string; status: string | null; bezahlt_am: Date | null; storniert_am: Date | null; abgeschlossen_am: Date | null; ist_test_am: Date | null;
  person_id: number | null; gesellschaft: unknown; angebot_id: number | null; parameter: unknown; schalter: unknown; station_status: string | null;
}

/** Alle echten, bezahlten, laufenden Global-Aufträge mit dem Stand der Station „Gründung eingereicht“. */
async function kandidaten(nurRef: string | null = null): Promise<Zeile[]> {
  return (await sqlPool`
    SELECT g.ref, g.status, g.bezahlt_am, g.storniert_am, g.abgeschlossen_am, g.ist_test_am, g.person_id, g.gesellschaft, g.angebot_id,
           a.parameter, a.schalter,
           (SELECT s.status FROM fiaon_global_schritte s WHERE s.ref = g.ref AND s.schluessel = ${GRUENDUNG_STATION} LIMIT 1) AS station_status
      FROM fiaon_global_auftraege g
      LEFT JOIN fiaon_global_angebote a ON a.id = g.angebot_id
     WHERE g.bezahlt_am IS NOT NULL AND (${nurRef}::text IS NULL OR g.ref = ${nurRef}::text)
     ORDER BY g.bezahlt_am`) as unknown as Zeile[];
}

function lageAus(z: Zeile) {
  const par = alsObjekt(z.parameter);
  const schalter = alsObjekt(z.schalter);
  const g = alsObjekt(z.gesellschaft);
  const llc = alsObjekt(schalter.llc);
  return {
    faellig: gruendungFaellig({
      status: z.status, bezahltAm: z.bezahlt_am, storniertAm: z.storniert_am, abgeschlossenAm: z.abgeschlossen_am,
      istTest: !!z.ist_test_am, bestand: !!par.bestand, stationStatus: z.station_status,
    }),
    gesellschaft: String(g.name || llc.wunsch || "").trim(),
    bundesstaat: staatLang(g.bundesstaatName || par.bundesstaat || g.bundesstaat),
    fastTrack: schalter.fastTrack === true,
  };
}

/** Der offene oder erledigte Auftrag zu einer Referenz (höchstens einer — der Schlüssel ist eindeutig). */
async function auftragZu(ref: string): Promise<{ id: number; status: string; zustaendig_agent_id: number | null; zustaendig_name: string | null; created_at: Date; erledigt_art: string | null } | null> {
  const [t] = (await sqlPool`
    SELECT id, status, zustaendig_agent_id, zustaendig_name, created_at, erledigt_art
      FROM fiaon_betreiber_todos WHERE schluessel = ${gruendungSchluessel(ref)} LIMIT 1`.catch(() => [])) as any[];
  return t ? { id: Number(t.id), status: String(t.status), zustaendig_agent_id: t.zustaendig_agent_id ? Number(t.zustaendig_agent_id) : null, zustaendig_name: t.zustaendig_name ?? null, created_at: new Date(t.created_at), erledigt_art: t.erledigt_art ?? null } : null;
}

export interface WaechterErgebnis { angelegt: number; geschlossen: number; eskaliert: number }

let laeuft = false;
/** Der Takt. Gibt true zurück, wenn er etwas getan hat (für die Lauf-Historie). */
export async function gruendungWaechter(jetzt: Date = new Date()): Promise<WaechterErgebnis> {
  const erg: WaechterErgebnis = { angelegt: 0, geschlossen: 0, eskaliert: 0 };
  if (laeuft) return erg;
  laeuft = true;
  try {
    const zeilen = await kandidaten();
    if (!zeilen.length) return erg;
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { auftragErledigen } = await import("./fiaon-auftraege");
    const { alarmMelden, alarmVorbei } = await import("./fiaon-system-alarme");
    let empfaenger: GruendungAgent | null | undefined;
    for (const z of zeilen) {
      const l = lageAus(z);
      const t = await auftragZu(z.ref);
      if (!l.faellig) {
        // Die Sache ist erledigt (Station steht) oder entfallen (Storno, Abschluss): Auftrag zu, Ampel aus.
        if (t && t.status !== "erledigt") {
          const grund = String(z.station_status ?? "") === "erledigt" ? "Gründung eingereicht (Station im Fahrplan)" : "Auftrag beendet — keine Bestellung mehr nötig";
          if (await auftragErledigen(t.id, { art: "auto", von: "System", autorArt: "system", ereignis: grund, beitragText: `Erledigt: ${grund}.` })) erg.geschlossen += 1;
        }
        if (t) await alarmVorbei(gruendungAlarmSchluessel(z.ref), "Gründung eingereicht oder Auftrag beendet");
        continue;
      }
      if (!t) {
        if (!gruendungAnlegenJetzt(jetzt)) continue; // nachts keine Mail — der Takt ab 7 Uhr legt an
        if (empfaenger === undefined) empfaenger = await gruendungEmpfaenger();
        const text = gruendungAuftragText({ gesellschaft: l.gesellschaft, bundesstaat: l.bundesstaat, fastTrack: l.fastTrack, bezahltAmText: tagText(z.bezahlt_am) });
        const a = await auftragFuerKunden({
          personId: z.person_id ? Number(z.person_id) : null, ref: z.ref, titel: text.titel, text: text.text, dringend: true,
          schluessel: gruendungSchluessel(z.ref), quelle: GRUENDUNG_QUELLE, bereich: "sonstiges", link: gruendungLink(z.ref), autorName: "System",
          ...(empfaenger ? { agentId: empfaenger.id } : { anBetreiber: true }),
          anlageText: "Angelegt vom System: Die Gründung ist bezahlt.",
        });
        if (a.id) { erg.angelegt += 1; console.log(`[GRUENDUNG] ${z.ref}: Auftrag #${a.id} bei ${a.agentName ?? "Betreiber"}.`); }
        continue;
      }
      // Auftrag ist da und die Bestellung fehlt noch: nachhalten.
      if (t.status !== "erledigt" && gruendungUeberfaellig(t.created_at, jetzt)) {
        const e = gruendungEskalation({ gesellschaft: l.gesellschaft, wer: t.zustaendig_name, bezahltAmText: tagText(z.bezahlt_am), angelegtAmText: tagZeitText(t.created_at) });
        const m = await alarmMelden(gruendungAlarmSchluessel(z.ref), { quelle: GRUENDUNG_ALARM_QUELLE, titel: e.titel, text: e.text, stufe: "rot", link: "/chef/s/global-auftraege" } as any);
        if (m.neu) {
          erg.eskaliert += 1;
          await leitungMail(e.titel, e.text).catch((err) => console.error("[GRUENDUNG] Mail an die Leitung:", String(err).slice(0, 160)));
        }
      }
      // Von Hand geschlossen, obwohl die Station fehlt: Das ist kein Beleg — die Ampel sagt es der Leitung.
      if (t.status === "erledigt" && t.erledigt_art !== "auto" && gruendungUeberfaellig(t.created_at, jetzt)) {
        const e = gruendungEskalation({ gesellschaft: l.gesellschaft, wer: t.zustaendig_name, bezahltAmText: tagText(z.bezahlt_am), angelegtAmText: tagZeitText(t.created_at) });
        const m = await alarmMelden(gruendungAlarmSchluessel(z.ref), { quelle: GRUENDUNG_ALARM_QUELLE, titel: e.titel, stufe: "rot", link: "/chef/s/global-auftraege",
          text: `${e.text} Hinweis: Der Auftrag wurde von Hand geschlossen, die Station „Gründung eingereicht“ steht aber nicht.` } as any);
        if (m.neu) erg.eskaliert += 1;
      }
    }
    return erg;
  } finally {
    laeuft = false;
  }
}

/** EINE Mail an die Leitung (derselbe Weg wie die Annahme-Meldung). Wirft nie nach außen weiter als bis zum Aufrufer-catch. */
async function leitungMail(betreff: string, text: string): Promise<void> {
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
  const { absoluteUrl } = await import("../fiaon-base-url");
  await eigeneMailSenden({ an: AUFRUF_MELDUNG_AN, name: "Justin", betreff, text, knoepfe: [{ text: "Global-Aufträge öffnen", url: absoluteUrl("/chef/s/global-auftraege") }] } as any);
}

// ── ZUGRIFF ──────────────────────────────────────────────────────────────────
/** So lange nach dem Erledigen darf die Person noch in die Akte sehen (nachlesen, einen Tippfehler melden). */
export const GRUENDUNG_NACHSEHEN_STUNDEN = 24;
/**
 * Hat diese Person den Auftrag „Gründung bestellen“ zu dieser Referenz — offen, oder in den letzten 24 Stunden erledigt?
 * Dann darf sie an die Akte. Ohne die 24 Stunden fiele sie im Augenblick des Erledigens aus der Seite, auf der sie steht.
 */
export async function gruendungDarf(agentId: number, ref: string): Promise<boolean> {
  if (!Number.isInteger(agentId) || agentId <= 0 || !ref) return false;
  const [t] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_betreiber_todos
     WHERE schluessel = ${gruendungSchluessel(ref)} AND zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId}
       AND (status <> 'erledigt' OR erledigt_am > NOW() - make_interval(hours => ${GRUENDUNG_NACHSEHEN_STUNDEN})) LIMIT 1`.catch(() => [])) as any[];
  return !!t;
}
/** Die Referenzen, zu denen diese Person einen offenen Gründungs-Auftrag hat (für den Raum „Global“ im Office). */
export async function gruendungRefsVon(agentId: number): Promise<string[]> {
  if (!Number.isInteger(agentId) || agentId <= 0) return [];
  const r = (await sqlPool`
    SELECT ref FROM fiaon_betreiber_todos
     WHERE schluessel LIKE 'global:%:gruendung-bestellen' AND status <> 'erledigt' AND zustaendig_art = 'agent' AND zustaendig_agent_id = ${agentId} AND ref IS NOT NULL`.catch(() => [])) as any[];
  return r.map((x) => String(x.ref));
}

// ── DIE SICHT IM OFFICE ──────────────────────────────────────────────────────
export interface GruendungSicht {
  faellig: boolean;
  bezahltAm: string | null;
  fastTrack: boolean;
  gesellschaft: string;
  bundesstaat: string;
  /** Erledigt: wann die Station gesetzt wurde. */
  eingereichtAm: string | null;
  bestellnummer: string | null;
  auftrag: { id: number; offen: boolean; bei: string | null } | null;
  schritte: GruendungSchrittSicht[];
  fehlend: string[];
  haken: Record<string, { am: string; von: string }>;
}

export async function gruendungSicht(ref: string): Promise<GruendungSicht | null> {
  const [z] = await kandidatenAuchUnbezahlt(ref);
  if (!z) return null;
  const l = lageAus(z);
  const { globalMandatChefSicht } = await import("./fiaon-global-mandat");
  const m = ((await globalMandatChefSicht(ref).catch(() => null)) ?? {}) as Record<string, any>;
  const anleitung = gruendungAnleitung({
    gesellschaftName: m.gesellschaft?.name ?? l.gesellschaft, bundesstaatName: m.gesellschaft?.bundesstaatName ?? l.bundesstaat,
    vorname: m.kontakt?.vorname, nachname: m.kontakt?.nachname,
    telefon: m.kontaktVorschlag?.telefon || m.kontakt?.telefon, wohnadresse: m.kontaktVorschlag?.adresse,
    usTelefon: m.gesellschaftPlus?.usTelefon,
  });
  const [s] = (await sqlPool`SELECT status, datum, intern FROM fiaon_global_schritte WHERE ref = ${ref} AND schluessel = ${GRUENDUNG_STATION} LIMIT 1`.catch(() => [])) as any[];
  const t = await auftragZu(ref);
  const nummer = /Bestellnummer\s+([A-Z0-9]{5,14})/.exec(String(s?.intern ?? ""))?.[1] ?? null;
  return {
    faellig: l.faellig, bezahltAm: z.bezahlt_am ? new Date(z.bezahlt_am).toISOString() : null, fastTrack: l.fastTrack,
    gesellschaft: anleitung.werte.gesellschaft || l.gesellschaft, bundesstaat: anleitung.werte.bundesstaat,
    eingereichtAm: String(s?.status ?? "") === "erledigt" && s?.datum ? String(s.datum instanceof Date ? s.datum.toISOString().slice(0, 10) : s.datum).slice(0, 10) : null,
    bestellnummer: nummer,
    auftrag: t ? { id: t.id, offen: t.status !== "erledigt", bei: t.zustaendig_name } : null,
    schritte: anleitung.schritte, fehlend: anleitung.fehlend,
    haken: (m.arbeitsablaufHaken ?? {}) as Record<string, { am: string; von: string }>,
  };
}

async function kandidatenAuchUnbezahlt(ref: string): Promise<Zeile[]> {
  return (await sqlPool`
    SELECT g.ref, g.status, g.bezahlt_am, g.storniert_am, g.abgeschlossen_am, g.ist_test_am, g.person_id, g.gesellschaft, g.angebot_id,
           a.parameter, a.schalter,
           (SELECT s.status FROM fiaon_global_schritte s WHERE s.ref = g.ref AND s.schluessel = ${GRUENDUNG_STATION} LIMIT 1) AS station_status
      FROM fiaon_global_auftraege g
      LEFT JOIN fiaon_global_angebote a ON a.id = g.angebot_id
     WHERE g.ref = ${ref} LIMIT 1`) as unknown as Zeile[];
}

type Erg<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/**
 * Der Mitarbeiter hat bestellt: Bestellnummer als Beleg. Setzt die drei Haken der Bestellung, die Station
 * „Gründung eingereicht“ (heute, interne Zeile mit Nummer und Namen), schließt den Auftrag und löscht die Ampel.
 * Zweimal dieselbe Nummer ist kein Fehler (nichts passiert doppelt).
 */
export async function gruendungBestellt(ref: string, ein: { bestellnummer?: unknown }, agent: GruendungAgent): Promise<Erg<{ meldung: string; gruendung: GruendungSicht | null }>> {
  const nummer = gruendungBestellnummer(ein.bestellnummer);
  if (!nummer) return { ok: false, status: 400, error: "Bitte die Bestellnummer aus der Bestätigung des Registered Agent eintragen (Buchstaben und Ziffern, 5 bis 14 Zeichen)." };
  const [z] = await kandidatenAuchUnbezahlt(ref);
  if (!z) return { ok: false, status: 404, error: "Diesen Auftrag gibt es nicht." };
  if (!z.bezahlt_am) return { ok: false, status: 409, error: "Die Gründung ist noch nicht bezahlt — bestellt wird erst nach dem Zahlungseingang." };
  if (z.storniert_am || String(z.status ?? "") === "storniert") return { ok: false, status: 409, error: "Der Auftrag ist storniert." };
  const { globalArbeitsablaufHaken, globalStationSpeichern } = await import("./fiaon-global-mandat");
  const { berlinToday } = await import("./fiaon-time");
  if (String(z.station_status ?? "") !== "erledigt") {
    const st = await globalStationSpeichern(ref, { schluessel: GRUENDUNG_STATION, status: "erledigt", datum: berlinToday(), intern: `Bestellnummer ${nummer} (Registered Agent), eingetragen von ${agent.name}.` }, agent);
    if (!st.ok) return { ok: false, status: st.status, error: st.error };
  }
  for (const key of GRUENDUNG_HAKEN) await globalArbeitsablaufHaken(ref, { schritt: key, erledigt: true }, agent).catch(() => null);
  const t = await auftragZu(ref);
  if (t && t.status !== "erledigt") {
    const { auftragErledigen } = await import("./fiaon-auftraege");
    await auftragErledigen(t.id, { art: "auto", von: agent.name, autorArt: "agent", autorAgentId: agent.id, ereignis: "Gründung bestellt (Bestellnummer eingetragen)", ergebnis: `Bestellt, Bestellnummer ${nummer}.`, gelesen: true });
  }
  const { alarmVorbei } = await import("./fiaon-system-alarme");
  await alarmVorbei(gruendungAlarmSchluessel(ref), "Gründung bestellt").catch(() => 0);
  return { ok: true, meldung: "Gespeichert. Die Station „Gründung eingereicht“ steht, der Auftrag ist erledigt.", gruendung: await gruendungSicht(ref).catch(() => null) };
}
