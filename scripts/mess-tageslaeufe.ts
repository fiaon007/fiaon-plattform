// ═══════════════════════════════════════════════════════════════════════════
// WELCHE TAGESLÄUFE SIND AUSGEFALLEN, UND WAS IST LIEGENGEBLIEBEN?
//
// ── DER BEFUND (30.08.2026) ────────────────────────────────────────────────
// `followup_last_run` stand auf dem 03.08.2026, der Kalender zeigte den 18.08.
// FÜNFZEHN TAGE. Aufgefallen ist es nur, weil jemand nach der Ursache für 188
// gedriftete Stufen gefragt hat.
//
// ── WARUM DIESE MESSUNG SCHWER IST ─────────────────────────────────────────
// Acht Läufe sind registriert. Von ihnen schreiben genau DREI irgendwo hin,
// dass sie gelaufen sind:
//
//   followup-und-termine          → followup_last_run
//   lead-nachfass-und-verteilung  → lead_followup_last_run_slot
//   (Wiedereinstieg, ein Schritt) → wiedereinstieg_last_run
//
// Die anderen fünf — Abo-Motor, Zahlungserinnerungen, Rückruf-Eskalation,
// Rückruf-Erinnerungen, Aufnahmen-Aufräumen — hinterlassen KEINE Spur ihres
// Laufens. Ob sie liefen, lässt sich nur an ihren WIRKUNGEN ablesen: an
// erzeugten Raten, verschickten Mails, vorgerückten Mahnstufen.
//
// Genau das macht dieser Lauf: Er rekonstruiert je Tag, was jeder Lauf
// HINTERLASSEN hat. Ein Tag ohne jede Spur ist ein Tag ohne Lauf.
//
// ── DIE GRENZE DIESER METHODE, AUSDRÜCKLICH ────────────────────────────────
// Ein Lauf, der lief und nichts zu tun hatte, sieht aus wie ein Lauf, der nicht
// lief. Deshalb steht bei jeder Zeile die Frage „hätte es etwas zu tun gegeben?"
// daneben. Ohne sie wäre die Bilanz eine Vermutung — und ein Nachlauf auf eine
// Vermutung erzeugt Schaden, den es vorher nicht gab.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-tageslaeufe.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tag = (v: unknown): string => (v ? String(new Date(String(v)).toISOString().slice(0, 10)) : "—");
const stundenHer = (v: unknown): number =>
  v ? Math.round((Date.now() - new Date(String(v)).getTime()) / 3_600_000) : 99_999;

/** Die acht registrierten Läufe — der Name ist der aus `tageslauf(...)`. */
interface LaufBefund {
  name: string;
  zweck: string;
  /** Woran erkennt man, dass er lief? */
  spur: string;
  letzteSpur: string | null;
  stundenHer: number;
  /** Gibt es Arbeit, die auf ihn wartet? */
  offen: string;
  folge: string;
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  const befunde: LaufBefund[] = [];
  const eins = async (q: Promise<any>, feldName = "wert"): Promise<any> => {
    try { const r = (await q) as any[]; return r[0]?.[feldName] ?? null; } catch { return null; }
  };

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE ACHT REGISTRIERTEN LÄUFE — WANN LIEFEN SIE ZULETZT?");
  // ═════════════════════════════════════════════════════════════════════════

  // ── followup-und-termine ────────────────────────────────────────────────
  const followupStand = await eins(sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'followup_last_run'`, "value");
  const [fu] = (await sqlPool`
    SELECT
      -- Wartet Arbeit? Herrenlose Stufe-1-Personen sind sein Kerngeschäft.
      (SELECT COUNT(*)::int FROM fiaon_persons
        WHERE assigned_agent_id IS NULL AND merged_into_person_id IS NULL
          AND priority_tier = 1 AND NOT is_blocked AND ist_test_am IS NULL) AS herrenlos_a,
      (SELECT COUNT(*)::int FROM fiaon_persons
        WHERE assigned_agent_id IS NULL AND merged_into_person_id IS NULL
          AND priority_tier = 2 AND NOT is_blocked AND ist_test_am IS NULL) AS herrenlos_b,
      -- Überfällige Zahlungszusagen: seine Eskalationsliste.
      (SELECT COUNT(*)::int FROM fiaon_persons
        WHERE promised_payment_date < CURRENT_DATE AND merged_into_person_id IS NULL
          AND NOT is_blocked AND assigned_agent_id IS NOT NULL) AS zusagen_ueberfaellig
  `) as any[];
  befunde.push({
    name: "followup-und-termine",
    zweck: "Einstufung, Zuteilung herrenloser Kunden, Eskalation überfälliger Zusagen, Nachschub",
    spur: "followup_last_run",
    letzteSpur: followupStand ? `${followupStand} (Datum, nicht Zeitstempel)` : null,
    stundenHer: followupStand
      ? Math.round((Date.now() - new Date(`${followupStand}T06:00:00Z`).getTime()) / 3_600_000)
      : 99_999,
    offen: `${fu.herrenlos_a} Stufe-A- und ${fu.herrenlos_b} Stufe-B-Kunden ohne Zuständigen, `
      + `${fu.zusagen_ueberfaellig} überfällige Zahlungszusagen`,
    folge: "Bezahlbereite Kunden liegen in niemandes Liste; gebrochene Zusagen werden nicht eskaliert.",
  });

  // ── abo-motor ───────────────────────────────────────────────────────────
  //
  // ── EINE TOTE SPALTE HAT MICH FAST 10.622 € SCHADEN MELDEN LASSEN ──────
  // Der erste Entwurf nahm `rechnung_am` als Fingerabdruck und zählte 154
  // „fällige Raten OHNE gestellte Rechnung (10.622,46 €)". Das las sich wie ein
  // Loch in der Kasse.
  //
  // GEMESSEN: `rechnung_am` ist bei 0 von 690 Raten gesetzt — die Spalte wird
  // in der Migration ANGELEGT (fiaon-abo.ts:146) und im ganzen Haus NIRGENDS
  // beschrieben. Sie ist tot. Gleichzeitig tragen 174 Raten `erinnerungen > 0`
  // (bis zu 7) und Mahnstufen bis 2: Diese Raten sind sehr wohl angemahnt.
  //
  // Der Fingerabdruck des Mahnens ist `letzte_erinnerung_at` — die Spalte, auf
  // die der Motor selbst prüft (fiaon-abo.ts:586). Wer eine Spalte als Beweis
  // nimmt, ohne nachzusehen, ob sie jemand füllt, meldet Schaden, den es nicht
  // gibt — und ein Nachlauf darauf hätte 154 Kunden eine Rechnung geschickt,
  // die sie längst haben.
  const [abo] = (await sqlPool`
    SELECT
      MAX(created_at) AS letzte_rate,
      MAX(letzte_erinnerung_at) AS letzte_mahnung,
      MAX(vorab_am) AS letzte_vorabinfo,
      MAX(ueberfaellig_seit) AS letzte_ueberfaelligkeit,
      -- Die Arbeit, die WIRKLICH wartet: fällig, offen, und noch NIE angemahnt.
      COUNT(*) FILTER (WHERE faellig_am <= CURRENT_DATE AND letzte_erinnerung_at IS NULL
                         AND COALESCE(erinnerungen, 0) = 0
                         AND status = 'offen' AND storniert_am IS NULL)::int AS nie_gemahnt,
      COALESCE(SUM(betrag_cents) FILTER (WHERE faellig_am <= CURRENT_DATE
                         AND letzte_erinnerung_at IS NULL AND COALESCE(erinnerungen, 0) = 0
                         AND status = 'offen' AND storniert_am IS NULL), 0)::bigint AS nie_gemahnt_cents,
      COUNT(*) FILTER (WHERE faellig_am < CURRENT_DATE AND status = 'offen'
                         AND storniert_am IS NULL AND ueberfaellig_seit IS NULL)::int AS nicht_ueberfaellig_gestellt
    FROM fiaon_abo_raten
  `) as any[];
  befunde.push({
    name: "abo-motor",
    zweck: "Raten des Tages anlegen, Rechnungen stellen, überfällig stellen, Inkasso zuteilen",
    spur: "jüngste erzeugte Rate / jüngste Mahnung (letzte_erinnerung_at)",
    letzteSpur: `Rate ${tag(abo.letzte_rate)}, Mahnung ${tag(abo.letzte_mahnung)}, `
      + `überfällig ${tag(abo.letzte_ueberfaelligkeit)}`,
    stundenHer: Math.min(stundenHer(abo.letzte_rate), stundenHer(abo.letzte_mahnung),
      stundenHer(abo.letzte_ueberfaelligkeit)),
    offen: `${abo.nie_gemahnt} fällige Raten NIE angemahnt (${(Number(abo.nie_gemahnt_cents) / 100).toFixed(2).replace(".", ",")} €), `
      + `${abo.nicht_ueberfaellig_gestellt} überfällige Raten nicht als überfällig gestellt`,
    folge: "Kunden bekommen keine Rechnung — es fehlt Geld, das niemand anmahnt.",
  });

  // ── zahlungserinnerungen ────────────────────────────────────────────────
  // `last_reminder_at` und `reminder_count` stehen an der BESTELLUNG (Migration
  // in fiaon-antrag.ts) — das ist die Spur dieses Laufs, genauer als das
  // Mailprotokoll: Sie sagt auch, WIE OFT schon gemahnt wurde.
  const letzteErinnerung = await eins(sqlPool`
    SELECT MAX(last_reminder_at) AS wert FROM fiaon_applications
    WHERE last_reminder_at IS NOT NULL`);
  const maxErinnerungen = Number(await eins(sqlPool`
    SELECT value AS wert FROM fiaon_settings WHERE key = 'max_reminders'`, "wert") ?? 6);
  const [erin] = (await sqlPool`
    SELECT COUNT(*)::int AS faellig FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_status IN ('pending_payment', 'expired')
      AND a.payment_due_date < CURRENT_DATE
      AND COALESCE(a.reminder_count, 0) < ${maxErinnerungen}
  `) as any[];
  befunde.push({
    name: "zahlungserinnerungen",
    zweck: "Zahlungserinnerungen an Kunden mit offener Rechnung",
    spur: "jüngstes last_reminder_at an einer Bestellung",
    letzteSpur: tag(letzteErinnerung),
    stundenHer: stundenHer(letzteErinnerung),
    offen: `${erin.faellig} Bestellungen mit abgelaufener Zahlungsfrist und unter ${maxErinnerungen} Erinnerungen`,
    folge: "Offene Rechnungen werden nicht angemahnt.",
  });

  // ── lead-nachfass-und-verteilung ────────────────────────────────────────
  const leadSlot = await eins(sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'lead_followup_last_run_slot'`, "value");
  const leadUpd = await eins(sqlPool`
    SELECT updated_at AS wert FROM fiaon_settings WHERE key = 'lead_followup_last_run_slot'`);
  // ── DIE STATUSWERTE SIND DEUTSCH ──────────────────────────────────────
  // Der erste Entwurf filterte auf ('converted', 'lost') und meldete 3.232
  // unverteilte Leads. Gemessen sind die echten Werte 'neu', 'kontaktiert' und
  // 'konvertiert': 2.760 kontaktiert, 449 konvertiert, 23 neu. Der Rückstand ist
  // also 23, nicht 3.232 — ein bereits kontaktierter Lead ist keine
  // liegengebliebene Verteilung.
  //
  // Ein Filter mit erfundenen Werten meldet den ganzen Bestand als Rückstand.
  const [leads] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE COALESCE(status, 'neu') = 'neu')::int AS neu_unverteilt,
           COUNT(*)::int AS alle_ohne_agent
    FROM fiaon_leads WHERE assigned_agent_id IS NULL
  `) as any[];
  befunde.push({
    name: "lead-nachfass-und-verteilung",
    zweck: "Lead-Strecke versenden, unverteilte Leads zuweisen",
    spur: "lead_followup_last_run_slot",
    letzteSpur: `${leadSlot} (geschrieben ${tag(leadUpd)})`,
    stundenHer: stundenHer(leadUpd),
    offen: `${leads.neu_unverteilt} NEUE Leads ohne Zuständigen `
      + `(von ${leads.alle_ohne_agent} ohne Agent — die übrigen sind kontaktiert oder konvertiert)`,
    folge: "Leads bekommen keine Nachfassmail und liegen bei niemandem.",
  });

  // ── rueckruf-eskalation ─────────────────────────────────────────────────
  // Die Spur steht in `fiaon_rueckrufe.eskaliert_am` — nicht in den
  // Agenten-Ereignissen. Ein erster Entwurf suchte dort und fand nichts, weil
  // der Lauf seine Eskalation in die Rückruf-Zeile und einen Vermerk schreibt.
  const letzteEskalation = await eins(sqlPool`
    SELECT MAX(eskaliert_am) AS wert FROM fiaon_rueckrufe WHERE eskaliert_am IS NOT NULL`);
  const rueckrufeOffen = Number(await eins(sqlPool`
    SELECT COUNT(*)::int AS wert FROM fiaon_rueckrufe
    WHERE status = 'offen' AND frist_bis < NOW() AND eskaliert_am IS NULL`, "wert") ?? 0);
  befunde.push({
    name: "rueckruf-eskalation",
    zweck: "Rückrufwünsche eskalieren, deren 24-Stunden-Frist gerissen ist",
    spur: "jüngstes Eskalations-Ereignis",
    letzteSpur: tag(letzteEskalation),
    stundenHer: stundenHer(letzteEskalation),
    offen: `${rueckrufeOffen} Rückrufwünsche mit gerissener Frist und ohne Eskalation`,
    folge: "Ein Kunde, der um Rückruf bittet, wartet unbegrenzt.",
  });

  // ── agent-rueckruf-erinnerungen ─────────────────────────────────────────
  const letzteRueckrufMail = await eins(sqlPool`
    SELECT MAX(reminder_sent_at) AS wert FROM fiaon_contact_log
    WHERE reminder_sent_at IS NOT NULL`);
  const [rue] = (await sqlPool`
    SELECT COUNT(*)::int AS faellig FROM fiaon_contact_log
    WHERE scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL
      AND reminder_sent_at IS NULL AND scheduled_at < NOW()
  `) as any[];
  befunde.push({
    name: "agent-rueckruf-erinnerungen",
    zweck: "Den Zuständigen an seinen eigenen Rückruftermin erinnern",
    spur: "jüngstes reminder_sent_at",
    letzteSpur: tag(letzteRueckrufMail),
    stundenHer: stundenHer(letzteRueckrufMail),
    offen: `${rue.faellig} vergangene Rückruftermine ohne Erinnerung`,
    folge: "Der Agent erfährt nichts von seinem Termin — der Kunde wartet.",
  });

  // ── warten-nummern-nachtragen ───────────────────────────────────────────
  const letzteWarte = await eins(sqlPool`
    SELECT MAX(wartet_seit) AS wert FROM fiaon_persons WHERE wartet_auf IS NOT NULL`);
  befunde.push({
    name: "warten-nummern-nachtragen",
    zweck: "Wartezustände nachtragen (Nummernkorrektur, Terminbitte)",
    spur: "jüngstes wartet_seit",
    letzteSpur: tag(letzteWarte),
    stundenHer: stundenHer(letzteWarte),
    offen: "—",
    folge: "Kunden erscheinen in Arbeitslisten, obwohl auf sie gewartet wird.",
  });

  // ── aufnahmen-aufraeumen ────────────────────────────────────────────────
  const letzteLoeschung = await eins(sqlPool`
    SELECT MAX(aufnahme_geloescht_am) AS wert FROM fiaon_calls
    WHERE aufnahme_geloescht_am IS NOT NULL`);
  const [auf] = (await sqlPool`
    SELECT COUNT(*)::int AS ueber_frist FROM fiaon_calls
    WHERE recording_sid IS NOT NULL AND aufnahme_geloescht_am IS NULL
      AND beginn < NOW() - INTERVAL '90 days'
  `) as any[];
  befunde.push({
    name: "aufnahmen-aufraeumen",
    zweck: "Gesprächsaufnahmen nach Ablauf der Frist löschen (DSGVO)",
    spur: "jüngstes aufnahme_geloescht_am",
    letzteSpur: tag(letzteLoeschung),
    stundenHer: stundenHer(letzteLoeschung),
    offen: `${auf.ueber_frist} Aufnahmen älter als 90 Tage noch vorhanden`,
    folge: "Aufnahmen liegen länger als erlaubt — ein Datenschutzverstoß, der wächst.",
  });

  // ── AUSGABE ─────────────────────────────────────────────────────────────
  const ampel = (h: number) => (h < 26 ? "GRÜN " : h < 50 ? "GELB " : "ROT  ");
  log("");
  log(`  ${"Lauf".padEnd(30)} ${"Ampel".padEnd(6)} ${"letzte Spur".padEnd(11)} Spur`);
  log(`  ${"-".repeat(76)}`);
  for (const b of befunde) {
    const her = b.stundenHer >= 99_999 ? "nie" : `${b.stundenHer} h`;
    log(`  ${b.name.padEnd(30)} ${ampel(b.stundenHer)} ${her.padEnd(11)} ${b.spur}`);
  }
  log("");
  for (const b of befunde) {
    log(`  ── ${b.name} ${"─".repeat(Math.max(0, 60 - b.name.length))}`);
    log(`     Zweck:  ${b.zweck}`);
    log(`     Zuletzt: ${b.letzteSpur ?? "keine Spur"}`);
    log(`     Offen:  ${b.offen}`);
    if (b.stundenHer >= 26) log(`     FOLGE:  ${b.folge}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. TAG FÜR TAG — WANN HÖRTE WAS AUF?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Zeile, an der man SIEHT, wo der Bruch liegt. Ein Lauf, der jeden Tag
  // Spuren hinterlässt und dann nicht mehr, ist an diesem Tag ausgefallen.
  const jeTag = (await sqlPool`
    WITH tage AS (
      SELECT generate_series(CURRENT_DATE - 20, CURRENT_DATE, '1 day')::date AS t
    )
    SELECT tg.t AS tag,
      (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.created_at::date = tg.t) AS raten_neu,
      (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.letzte_erinnerung_at::date = tg.t) AS rechnungen,
      (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ueberfaellig_seit::date = tg.t) AS ueberfaellig,
      (SELECT COUNT(*)::int FROM fiaon_mail_log l WHERE l.created_at::date = tg.t) AS mails,
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.last_reminder_at::date = tg.t) AS zahl_erinnerungen,
      (SELECT COUNT(*)::int FROM fiaon_contact_log c
        WHERE c.reminder_sent_at::date = tg.t) AS rueckruf_erinnerungen,
      (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_at::date = tg.t) AS zuteilungen,
      (SELECT COUNT(*)::int FROM fiaon_termine tm WHERE tm.erinnert_am::date = tg.t) AS termin_erinnerungen
    FROM tage tg ORDER BY tg.t DESC
  `) as any[];

  log("");
  log(`  ${"Tag".padEnd(12)} ${"Raten".padStart(6)} ${"Mahn.".padStart(7)} ${"überf.".padStart(7)}`
    + ` ${"Mails".padStart(6)} ${"Z-Erin".padStart(7)} ${"RR-Erin".padStart(8)} ${"Zuteil.".padStart(8)} ${"T-Erin".padStart(7)}`);
  log(`  ${"-".repeat(70)}`);
  for (const z of jeTag) {
    log(`  ${tag(z.tag).padEnd(12)} ${String(z.raten_neu).padStart(6)} ${String(z.rechnungen).padStart(7)}`
      + ` ${String(z.ueberfaellig).padStart(7)} ${String(z.mails).padStart(6)}`
      + ` ${String(z.zahl_erinnerungen).padStart(7)}`
      + ` ${String(z.rueckruf_erinnerungen).padStart(8)} ${String(z.zuteilungen).padStart(8)}`
      + ` ${String(z.termin_erinnerungen).padStart(7)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE SCHADENSBILANZ — WAS IST LIEGENGEBLIEBEN?");
  // ═════════════════════════════════════════════════════════════════════════
  const [schaden] = (await sqlPool`
    SELECT
      -- Abo: Raten, die es geben MÜSSTE. Ein Abo mit Jahrestag in der
      -- Vergangenheit und ohne Rate für den Monat ist eine fehlende Rate.
      (SELECT COUNT(*)::int FROM fiaon_abo_raten
        WHERE faellig_am <= CURRENT_DATE AND letzte_erinnerung_at IS NULL
          AND COALESCE(erinnerungen, 0) = 0
          AND status = 'offen' AND storniert_am IS NULL) AS raten_ohne_rechnung,
      (SELECT COALESCE(SUM(betrag_cents), 0)::bigint FROM fiaon_abo_raten
        WHERE faellig_am <= CURRENT_DATE AND letzte_erinnerung_at IS NULL
          AND COALESCE(erinnerungen, 0) = 0
          AND status = 'offen' AND storniert_am IS NULL) AS summe_ohne_rechnung,
      (SELECT COUNT(*)::int FROM fiaon_abo_raten
        WHERE faellig_am < CURRENT_DATE AND status = 'offen'
          AND storniert_am IS NULL AND ueberfaellig_seit IS NULL) AS nicht_ueberfaellig,
      -- Mahnstufen: Raten, die nach Frist eine höhere Stufe haben müssten.
      (SELECT COUNT(*)::int FROM fiaon_abo_raten
        WHERE status = 'offen' AND storniert_am IS NULL
          AND faellig_am < CURRENT_DATE - 21 AND COALESCE(mahnstufe, 0) < 3) AS mahnstufe_zurueck,
      -- Vertrieb: herrenlose bezahlbereite Kunden.
      (SELECT COUNT(*)::int FROM fiaon_persons
        WHERE assigned_agent_id IS NULL AND merged_into_person_id IS NULL
          AND priority_tier IN (1, 2) AND NOT is_blocked AND ist_test_am IS NULL) AS herrenlos,
      -- Rückrufe: vergangene Termine ohne Erinnerung an den Zuständigen.
      (SELECT COUNT(*)::int FROM fiaon_contact_log
        WHERE scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL
          AND reminder_sent_at IS NULL AND scheduled_at < NOW()) AS rueckrufe_ohne_erinnerung,
      -- Leads.
      (SELECT COUNT(*)::int FROM fiaon_leads
        WHERE assigned_agent_id IS NULL AND COALESCE(status, 'neu') = 'neu') AS leads_unverteilt,
      -- Aufnahmen über der Frist.
      (SELECT COUNT(*)::int FROM fiaon_calls
        WHERE recording_sid IS NOT NULL AND aufnahme_geloescht_am IS NULL
          AND beginn < NOW() - INTERVAL '90 days') AS aufnahmen_ueber_frist
  `) as any[];

  const euro = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
  log("");
  log(`  ${String(schaden.raten_ohne_rechnung).padStart(6)}  fällige Raten NIE angemahnt  (${euro(schaden.summe_ohne_rechnung)})`);
  log(`  ${String(schaden.nicht_ueberfaellig).padStart(6)}  überfällige Raten nicht als überfällig gestellt`);
  log(`  ${String(schaden.mahnstufe_zurueck).padStart(6)}  Raten über 21 Tage fällig, aber Mahnstufe unter 3`);
  log(`  ${String(schaden.herrenlos).padStart(6)}  Stufe-A/B-Kunden ohne Zuständigen`);
  log(`  ${String(schaden.rueckrufe_ohne_erinnerung).padStart(6)}  vergangene Rückruftermine ohne Erinnerung an den Zuständigen`);
  log(`  ${String(schaden.leads_unverteilt).padStart(6)}  NEUE Leads ohne Zuständigen`);
  log(`  ${String(schaden.aufnahmen_ueber_frist).padStart(6)}  Aufnahmen älter als 90 Tage (Löschfrist)`);

  // ── CSV ──────────────────────────────────────────────────────────────────
  writeFileSync("reports/tageslaeufe-bilanz.csv",
    `lauf;zweck;spur;letzte_spur;stunden_her;ampel;offen;folge\n`
    + befunde.map((b) => [b.name, b.zweck, b.spur, b.letzteSpur ?? "",
      b.stundenHer >= 99_999 ? "" : b.stundenHer,
      b.stundenHer < 26 ? "gruen" : b.stundenHer < 50 ? "gelb" : "rot",
      b.offen, b.folge].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  Bilanz: reports/tageslaeufe-bilanz.csv");
  log("");
  log("  ── ZUR LESART ──────────────────────────────────────────────────────");
  log("  Ein Lauf ohne Spur hat entweder nicht gelaufen ODER nichts zu tun");
  log("  gehabt. Deshalb steht neben jeder Zeile, wieviel Arbeit wartet: Erst");
  log("  „keine Spur UND Arbeit wartet“ ist ein Ausfall.");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
