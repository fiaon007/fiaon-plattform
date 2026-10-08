// ═══════════════════════════════════════════════════════════════════════════
// STUFE A KLÄREN — „bezahlt geklickt“, Geld nicht da (Mara-Topsales 08.10.2026, Justin)
//
// Justins Entscheidung im IT-Feedback: „Stufe A pausiert höchstens 3 Werktage.“ Gemessen (nur lesend, 08.10.):
// rund 280 Menschen mit gemeldeter Zahlung und fehlendem Geld (etwa 20.400 €), 273 von 294 solcher Bestellungen mit
// Mahnstopp der Rückholung, die Mara-Aktion bat sie nie um Zahlung (E-276), die WhatsApp-Zentrale schließt sie aus.
// In sieben Tagen wurden 3 von ihnen angerufen. Ungebucht im Bankbuch lag zu keinem von ihnen ein passender Eingang.
//
// ZWEI WEGE, BEIDE EINMAL JE FALL:
//   (a) die ANRUFAUFGABE: ab dem 3. Werktag ohne Eingang eine Aufgabe „anrufen und klären“ — an den Betreuer
//       (assigned_agent_id, aktiv), sonst an den Betreiber. Schlüssel je Bestellung → idempotent (Muster
//       unzustellbareErstzahlungenMelden in routes/fiaon-antrag.ts).
//   (b) die KLÄRUNGS-MAIL der Mara-Aktion: ab dem 3. Werktag EINE Nachricht im Ton der Klärung — „Wir konnten Ihre
//       Überweisung noch nicht zuordnen — bitte Beleg oder Überweisungsdatum schicken, oder mit diesem
//       Verwendungszweck überweisen“, mit den Zahlungsdaten (Betrag und Verwendungszweck im Text, Empfänger und IBAN
//       hinter dem Knopf — die Wortwand verbietet Bankdaten im Text). Fester Text (keine KI), geprüft wie jede Aktionsmail.
//
// WAS SIE NICHT IST: keine Mahnung, keine Frist, keine Drohung. Die S2-Mail der Rückholung sagt „Wir haben diese
// Erinnerungen gestoppt“ — gemeint sind die automatischen Zahlungserinnerungen. Die Klärung ist eine persönliche
// Nachfrage zu SEINER eigenen Meldung („ich habe überwiesen“) und bleibt das auch im Text.
//
// VORHER IMMER: der unscharfe Bankabgleich (eingangOffenSql, fiaon-zahlung-unverbucht.ts). Liegt ein passender
// ungebuchter Eingang vor, gehört der Fall gebucht — keine Mail, keine Aufgabe.
//
// SPERREN: Vertriebssperre (Kopf), Testkonto, Global-Kunde (E-272), storniert, gekündigt, schon Kunde. Die Mail
// hält dazu alles, was die Mara-Aktion ohnehin hält (Werbesperre, Stopp, Einwand, Zustellung …).
//
// NACH DER PRÜFUNG (08.10.): Die Mail sagt ausdrücklich „keine Zahlungserinnerung“ und „zuerst auf dem Kontoauszug
// nachsehen“ (S2-Zusage, Doppelzahlung); höchstens KLAERUNG_JE_TAG (20) Klärungen am Tag (fiaon-mara-aktion.ts). Die
// Anrufaufgabe nennt „Stopp“ und Werbesperre im Text; ein „abgelehnt“ an der Bestellung geht an die Leitung (klaerAufgabe).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { KOPF_SQL, STOPP_KOEPFE_SQL, VERTRIEBSSPERRE_SQL, WERBESPERRE_FAMILIE_SQL } from "./fiaon-mail-frequenz";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { eingangOffenSql } from "./fiaon-zahlung-unverbucht";
import { STUFE_A_HOECHSTENS_WERKTAGE } from "@shared/fiaon-wiedervorlage";

// ── ZUSAMMEN MIT DER PIPELINE-REGEL (Integration IT-Feedback Strang a × Mara-Topsales, 08.10.2026) ─────────────
// Strang a (shared/fiaon-wiedervorlage.ts) lässt Stufe A in der Pipeline höchstens STUFE_A_HOECHSTENS_WERKTAGE
// Werktage pausieren und gibt ab dem 9. Fehlversuch an die Vertriebsleitung (stufeAAnLeitung, fiaon-nicht-erreicht.ts).
// Diese Datei legt ab demselben 3. Werktag die Anrufaufgabe an. Damit es EINE Regel bleibt und keine doppelten
// Aufgaben entstehen:
//   · derselbe Wert (STUFE_A_HOECHSTENS_WERKTAGE) — nicht eine zweite 3;
//   · höchstens EINE offene Anrufaufgabe je Mensch (über alle seine Bestellungen), nie zweimal je Bestellung;
//   · keine Anrufaufgabe, solange die Leitung über den Fall entscheidet (offene Aufgabe „Zahlung gemeldet,
//     n× nicht erreicht — entscheiden“); entsteht diese später, übergibt stufeAAnLeitung die offene
//     Anrufaufgabe an sie (klaerAufgabeAnLeitungUebergeben) — der Betreuer hat dann nicht zwei Zettel zum selben Fall;
//   · die Aufgabe hat im Auftrags-Katalog eine eigene Art (stufe_a_klaeren, shared/fiaon-auftrag-arten.ts): Ein
//     erreichtes Gespräch des Betreuers (auch aus der Pipeline) oder die gebuchte Zahlung erledigt sie automatisch.
//   · „gekündigt“ nach der EINEN Regel aus Strang b (shared/fiaon-kuendigung-regel.ts): ein gesetztes gekuendigt_am
//     IST die geltende Kündigung (die Rücknahme setzt es auf NULL) — nicht mehr „… oder zurückgenommen“.

/** Ab so vielen Werktagen (Mo–Fr, Berlin) nach der Meldung wird geklärt. Justin, IT-Feedback: höchstens 3 — derselbe Wert wie die Pipeline. */
export const KLAERUNG_AB_WERKTAGEN = STUFE_A_HOECHSTENS_WERKTAGE;
/** Der Text der Leitungs-Aufgabe nach dem 9. Fehlversuch beginnt so (fiaon-nicht-erreicht.ts, LEITUNG_MARKE). */
const LEITUNG_MARKE_SQL = "%Zahlung gemeldet, %nicht erreicht%";
/**
 * So viele Anrufaufgaben legt ein Lauf höchstens an (stündlich, 08–20 Uhr) — der Altbestand (gemessen 08.10.: 103 Fälle)
 * verteilt sich so über einen Arbeitstag, statt die Betreuer mit hundert Aufgaben-Mails auf einmal zu fluten.
 */
export const AUFGABEN_JE_LAUF = 10;
export const KLAERUNG_BETREFF = "Kurz zu Ihrer Überweisung";

function berlinTag(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

/**
 * Werktage (Mo–Fr) NACH dem Tag der Meldung bis einschließlich heute, Berliner Kalender. Feiertage zählen mit
 * (bewusst: lieber einen Tag früher klären). Meldung Montag → Donnerstag = 3; Meldung Freitag → Mittwoch = 3. Rein.
 */
export function werktageSeit(von: Date, jetzt: Date = new Date()): number {
  const start = berlinTag(von), ende = berlinTag(jetzt);
  if (ende <= start) return 0;
  let n = 0;
  const d = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const tag = d.toISOString().slice(0, 10);
    if (tag > ende) break;
    const wt = d.getUTCDay();
    if (wt !== 0 && wt !== 6) n++;
  }
  return n;
}

/** Dieselbe Rechnung als SQL-Ausdruck (Anzahl), `zeit` ist ein timestamptz-Ausdruck. Der Prüfstand vergleicht beide. */
export function werktageSeitSql(zeit: string): string {
  return `(SELECT COUNT(*)::int FROM generate_series((((${zeit}) AT TIME ZONE 'Europe/Berlin')::date + 1)::timestamp,
            ((NOW() AT TIME ZONE 'Europe/Berlin')::date)::timestamp, INTERVAL '1 day') wt_d
           WHERE EXTRACT(ISODOW FROM wt_d) < 6)`;
}

/**
 * Der Kern der Klärungs-Mail (ohne Anrede, Gruß und Knopf — die setzt die Aktion wie bei jeder Mara-Mail). `abschluss`
 * ist der freigegebene A-Abschluss (bausteinAbschluss art „a“, mit Antragslücke) — „sofort aktiv“ nur nach der
 * Zuordnung. Rein.
 */
export function klaerungKern(ein: {
  name: string; gemeldetAm: string | null; betrag: string | null; verwendungszweck: string | null; abschluss: string; wunsch: string;
}): string {
  const betrag = ein.betrag ? ` über ${ein.betrag}` : "";
  const zweck = ein.verwendungszweck || null;
  // Die Zahlungsdaten: Betrag und Verwendungszweck im Text, Empfänger und IBAN hinter dem Knopf (Zahlungsseite) — die
  // Wortwand verbietet Bankdaten im Text („dort stehen sie immer aktuell“, Kontowechsel 02.09.2026).
  const daten = [...(ein.betrag ? [`Betrag ${ein.betrag}`] : []), ...(zweck ? [`Verwendungszweck ${zweck}`] : [])].join(", ");
  return [
    `Hier ist ${ein.name}, die digitale Assistentin von FIAON. Sie haben uns${ein.gemeldetAm ? ` am ${ein.gemeldetAm}` : ""} gemeldet, dass Sie Ihre erste Monatsrate${betrag} überwiesen haben — vielen Dank dafür. Wir konnten Ihre Überweisung bis heute leider noch nicht zuordnen; meist kommt der Verwendungszweck verkürzt oder gar nicht bei uns an.`,
    // Mara-Topsales 08.10.2026 (Prüfung): 101 der 103 Klärfälle haben die S2-Mail der Rückholung bekommen („Wir haben diese
    // Erinnerungen gestoppt“). Deshalb sagt die Mail ausdrücklich, dass sie keine Zahlungserinnerung ist, und — wie S2 —
    // dass er zuerst auf dem Kontoauszug nachsieht, bevor er überweist (keine Doppelzahlung).
    `Das ist keine Zahlungserinnerung, sondern eine Nachfrage zu Ihrer Meldung. Schicken Sie mir bitte kurz Ihren Überweisungsbeleg oder das Überweisungsdatum als Antwort auf diese Mail, dann kümmere ich mich selbst um die Zuordnung. Bitte sehen Sie zuerst auf Ihrem Kontoauszug nach — zweimal zahlen soll niemand. Wurde die Überweisung nicht ausgeführt, überweisen Sie bitte mit ${zweck ? `diesem Verwendungszweck: ${zweck}` : "dem Verwendungszweck hinter dem Knopf unten"}. ${daten ? `Ihre Zahlungsdaten: ${daten} — Empfänger und IBAN stehen hinter dem Knopf unten.` : "Empfänger, IBAN und Betrag stehen hinter dem Knopf unten."}`,
    `${ein.abschluss}\n\n${ein.wunsch}`,
  ].join("\n\n");
}

// ── (a) DIE ANRUFAUFGABE ─────────────────────────────────────────────────────
/** Die Fälle für eine Anrufaufgabe — eine Zeile je Person (die jüngste Meldung). Exportiert für Trockenzählung und Prüfstand. */
export function stufeAKlaerenSql(opt: { hoechstens?: number; nurOhneAufgabe?: boolean; mitLeitung?: boolean } = {}): string {
  return `
    SELECT f.* FROM (
      SELECT DISTINCT ON (fa.person_id) fa.ref, fa.person_id, fa.pack_name, fa.pack_key, fa.amount_due, fa.payment_reference,
             fa.claimed_paid_at, ${werktageSeitSql("fa.claimed_paid_at")} AS werktage,
             -- Mara-Topsales 08.10.2026 (Prüfung): was der Anrufer wissen muss (Text der Aufgabe, Empfänger) — gemessen 08.10.:
             -- von 103 Fällen 5 mit „Stopp“, 2 mit Werbesperre, 2 mit „erreicht — abgelehnt“ an der Bestellung.
             (${KOPF_SQL("fa.person_id")} IN ${STOPP_KOEPFE_SQL}) AS stopp,
             ${WERBESPERRE_FAMILIE_SQL("fa.person_id")} AS werbesperre,
             EXISTS (SELECT 1 FROM fiaon_contact_log cl WHERE cl.voided_at IS NULL AND (cl.ref = fa.ref OR cl.person_id = fa.person_id)
                       AND COALESCE(cl.outcome, '') ~* '(abgelehnt|kein_interesse|not_interested)') AS abgelehnt
        FROM fiaon_applications fa
        JOIN fiaon_persons p ON p.id = fa.person_id
       WHERE fa.payment_status = 'claimed_paid' AND fa.claimed_paid_at IS NOT NULL
         AND fa.merged_into IS NULL AND fa.archived_at IS NULL AND fa.gdpr_deleted_at IS NULL AND fa.cancelled_at IS NULL
         -- Integration Strang b (08.10.2026): gesetztes gekuendigt_am = geltende Kündigung (shared/fiaon-kuendigung-regel.ts)
         AND fa.gekuendigt_am IS NULL
         AND COALESCE(fa.type, '') <> 'schufa' AND COALESCE(fa.ref, '') NOT LIKE 'FIAON-SCHUFA-%'
         AND NOT (${produktkategorieSql("fa")} IN ('global', 'auskunft'))
         AND NOT ${globalKundeSql("fa.person_id")}
         AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
         AND NOT ${VERTRIEBSSPERRE_SQL("fa.person_id")}
         AND NOT EXISTS (SELECT 1 FROM fiaon_applications bz WHERE bz.person_id = fa.person_id AND bz.merged_into IS NULL
                           AND bz.payment_status = 'paid' AND COALESCE(bz.type, '') <> 'schufa' AND COALESCE(bz.ref, '') NOT LIKE 'FIAON-SCHUFA-%')
         -- der Bankabgleich zuerst: ein passender ungebuchter Eingang → buchen, nicht anrufen
         AND fa.person_id NOT IN (${eingangOffenSql()})
         AND ${werktageSeitSql("fa.claimed_paid_at")} >= ${KLAERUNG_AB_WERKTAGEN}
         ${opt.nurOhneAufgabe === false ? "" : `AND NOT EXISTS (SELECT 1 FROM fiaon_betreiber_todos t WHERE t.schluessel = 'antrag:' || fa.ref || ':a-klaeren')
         -- Integration Strang a (08.10.2026): höchstens EINE offene Anrufaufgabe je Mensch — auch über mehrere Bestellungen
         AND NOT EXISTS (SELECT 1 FROM fiaon_betreiber_todos t2 WHERE t2.status <> 'erledigt'
                           AND t2.schluessel IN (SELECT 'antrag:' || x.ref || ':a-klaeren' FROM fiaon_applications x WHERE x.person_id = fa.person_id))
         -- Querprüfung 08.10.2026 (E-303 × E-184): keine zweite Anrufaufgabe, solange „Erstzahlung: E-Mail unzustellbar“
         -- zu diesem Menschen offen ist — dieser Auftrag nennt die gemeldete Zahlung mit (unzustellbareErstzahlungenMelden).
         AND NOT EXISTS (SELECT 1 FROM fiaon_betreiber_todos t3 WHERE t3.status <> 'erledigt'
                           AND t3.schluessel IN (SELECT 'antrag:' || x.ref || ':unzustellbar' FROM fiaon_applications x WHERE x.person_id = fa.person_id))`}
         ${opt.mitLeitung ? `-- … und keine, solange die Vertriebsleitung nach dem 9. Fehlversuch entscheidet (stufeAAnLeitung)
         AND NOT EXISTS (SELECT 1 FROM fiaon_vermerke v WHERE v.art = 'aufgabe' AND v.status = 'offen' AND v.entfernt_am IS NULL
                           AND v.text LIKE '${LEITUNG_MARKE_SQL}'
                           AND v.ref IN (SELECT x.ref FROM fiaon_applications x WHERE x.person_id = fa.person_id))` : ""}
       ORDER BY fa.person_id, fa.claimed_paid_at DESC
    ) f
    ORDER BY f.claimed_paid_at DESC
    LIMIT ${Math.max(1, Math.min(5_000, Math.round(opt.hoechstens ?? AUFGABEN_JE_LAUF)))}`;
}

const tagDe = (d: Date) => d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Text und Empfänger einer Anrufaufgabe — rein, für Prüfstand und Lauf. `z` ist eine Zeile aus stufeAKlaerenSql.
 * Mara-Topsales 08.10.2026 (Prüfung): Der Anruf klärt seinen eigenen Vertrag (keine Werbung) — aber wer „Stopp“ gesagt hat
 * oder eine Werbesperre trägt, muss das vor dem Anruf lesen. Ein „abgelehnt“ an der Bestellung geht an die Leitung
 * (Betreiber), nicht an den Betreuer: Sie entscheidet, ob überhaupt angerufen wird.
 */
export function klaerAufgabe(z: {
  claimed_paid_at: string | Date; pack_name?: string | null; werktage: number | string; payment_reference?: string | null; ref: string;
  stopp?: boolean | null; werbesperre?: boolean | null; abgelehnt?: boolean | null;
}, betreuerId: number | null): { text: string; agentId: number | null } {
  const paket = z.pack_name ? String(z.pack_name).split("\n")[0].trim() : null;
  const achtung = [
    ...(z.stopp === true ? ["Kunde hat „Stopp“ gesagt"] : []),
    ...(z.werbesperre === true ? ["Kunde trägt eine Werbesperre"] : []),
  ];
  const hinweis = (achtung.length ? `ACHTUNG: ${achtung.join(", ")} — nur Klärung seiner Meldung, kein Verkauf, kein Angebot. ` : "")
    + (z.abgelehnt === true ? "Am Vorgang steht ein „abgelehnt“ — bitte zuerst entscheiden, ob angerufen wird (sonst nur vermerken). " : "");
  const text = hinweis
    + `Der Kunde hat am ${tagDe(new Date(z.claimed_paid_at))} gemeldet, dass er überwiesen hat${paket ? ` (${paket})` : ""} — `
    + `seit ${Number(z.werktage)} Werktagen ist kein passender Eingang da (Bankbuch geprüft). Bitte anrufen: `
    + `Überweisungsbeleg oder Überweisungsdatum erfragen; wurde nicht überwiesen, Verwendungszweck ${z.payment_reference || z.ref} nennen. `
    + "Das Ergebnis ins Kontaktprotokoll. Ton: Klärung seiner eigenen Meldung — keine Mahnung.";
  return { text, agentId: betreuerId != null && z.abgelehnt !== true ? betreuerId : null };
}

/**
 * (a) Die Anrufaufgaben anlegen — höchstens AUFGABEN_JE_LAUF je Aufruf, je Bestellung einmal (Schlüssel).
 * Aufgerufen aus dem stündlichen Zahlungslauf (routes/fiaon-antrag.ts, runPaymentReminders). `trocken`: nur zählen.
 */
export async function stufeAKlaerenMelden(opt: { trocken?: boolean; hoechstens?: number } = {}): Promise<number> {
  await globalKundeBereit();
  const { ensureTodoTabelle, auftragFuerKunden, empfaengerNachId } = await import("../routes/fiaon-betreiber-todo");
  await ensureTodoTabelle();
  // Integration 08.10.2026: Anrufaufgaben, die vor ihrer eigenen Art (stufe_a_klaeren) angelegt wurden, tragen „sonstiges“
  // (nur von Hand) — sie werden hier einmal umgestellt, damit auch sie das erreichte Gespräch bzw. die Zahlung erledigt.
  if (!opt.trocken) {
    await sqlPool`UPDATE fiaon_betreiber_todos SET art = 'stufe_a_klaeren'
                   WHERE art = 'sonstiges' AND schluessel LIKE 'antrag:%:a-klaeren'`.catch(() => {});
  }
  // Die Leitungs-Aufgaben (fiaon_vermerke) gibt es auf jedem Betriebsstand — auf einem frischen Prüfstand vielleicht nicht.
  const [vt] = (await sqlPool`SELECT to_regclass('public.fiaon_vermerke') IS NOT NULL AS da`.catch(() => [])) as any[];
  const zeilen = (await sqlPool.unsafe(stufeAKlaerenSql({ hoechstens: opt.hoechstens, mitLeitung: vt?.da === true }))) as any[];
  if (opt.trocken || !zeilen.length) return zeilen.length;
  let n = 0;
  for (const z of zeilen) {
    try {
      const [p] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${Number(z.person_id)}`) as any[];
      const betreuer = p?.assigned_agent_id ? await empfaengerNachId(Number(p.assigned_agent_id)).catch(() => null) : null;
      const auftrag = klaerAufgabe(z, betreuer?.id ?? null);
      await auftragFuerKunden({
        personId: Number(z.person_id),
        ref: String(z.ref),
        titel: "Zahlung gemeldet, nicht da — anrufen und klären",
        text: auftrag.text,
        faelligAm: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }),
        schluessel: `antrag:${z.ref}:a-klaeren`,
        quelle: "antrag",
        bereich: "konten",
        autorName: "Erinnerungsmaschine",
        anlageText: "Angelegt von der Erinnerungsmaschine: Zahlung gemeldet, seit 3 Werktagen kein Eingang (Mara-Topsales 08.10.2026).",
        // an den Betreuer — sonst an den Betreiber (nicht an eine abgeleitete Rolle); mit „abgelehnt“ an die Leitung (Betreiber)
        ...(auftrag.agentId != null ? { agentId: auftrag.agentId } : { anBetreiber: true as const }),
      });
      n++;
    } catch (e) {
      console.error("[STUFE-A] Aufgabe:", e instanceof Error ? e.message : e);
    }
  }
  if (n) console.log(`[STUFE-A] ${n} Anrufaufgabe(n) „Zahlung gemeldet, nicht da“ angelegt.`);
  return n;
}

/**
 * Integration Strang a × Mara-Topsales (08.10.2026): Geht ein Stufe-A-Fall nach dem 9. Fehlversuch an die
 * Vertriebsleitung (stufeAAnLeitung), ist die offene Anrufaufgabe „Zahlung gemeldet, nicht da — anrufen und klären“
 * damit übergeben: Sie wird mit einem Satz erledigt (Art „verwaltung“, im Verlauf sichtbar) — der Betreuer hat nicht
 * zwei Zettel zum selben Fall, und die Leitung entscheidet. Läuft in einem Sicherungspunkt, wenn `lauf` eine Transaktion
 * ist: Ein Fehler hier darf das Buchen des Ergebnisses nie abbrechen. Gibt die Zahl der übergebenen Aufgaben zurück.
 */
export async function klaerAufgabeAnLeitungUebergeben(personId: number, lauf: typeof sqlPool = sqlPool): Promise<number> {
  const arbeit = async (tx: typeof sqlPool): Promise<number> => {
    const [t] = (await tx`SELECT to_regclass('public.fiaon_betreiber_todos') IS NOT NULL AS todo,
                                 to_regclass('public.fiaon_betreiber_todo_beitraege') IS NOT NULL AS beitrag`) as any[];
    if (!t?.todo || !t?.beitrag) return 0;
    const offen = (await tx`
      SELECT id FROM fiaon_betreiber_todos
       WHERE status <> 'erledigt'
         AND schluessel IN (SELECT 'antrag:' || a.ref || ':a-klaeren' FROM fiaon_applications a WHERE a.person_id = ${personId})`) as any[];
    if (!offen.length) return 0;
    const { auftragErledigen } = await import("./fiaon-auftraege");
    let n = 0;
    for (const o of offen) {
      const text = "An die Vertriebsleitung übergeben: 9× nicht erreicht bei gemeldeter Zahlung — dort liegt jetzt die Aufgabe "
        + "„Zahlung gemeldet, … entscheiden“. Erreichst du den Kunden doch, trage das Ergebnis wie immer in die Akte ein.";
      if (await auftragErledigen(Number(o.id), { art: "verwaltung", von: "Erinnerungsmaschine", autorArt: "system", ergebnis: text, beitragText: text }, tx)) n++;
    }
    return n;
  };
  try {
    const sp = (lauf as any)?.savepoint;
    if (lauf !== sqlPool && typeof sp === "function") return await (lauf as any).savepoint((tx: typeof sqlPool) => arbeit(tx));
    return await arbeit(lauf);
  } catch (e) {
    console.error("[STUFE-A] Übergabe an die Leitung:", e instanceof Error ? e.message : e);
    return 0;
  }
}
