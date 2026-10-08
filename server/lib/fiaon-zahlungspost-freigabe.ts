// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSPOST TROTZ BREVO-ABMELDUNG (08.10.2026)
//
// Justins Entscheidung auf die Frage „Brevo blockt Zahlungserinnerungen an rund 70 Adressen — sollen sie
// trotzdem zugestellt werden? Dann sperre ich zuerst deren Werbung, gebe die Adresse nur für Zahlungspost
// frei und nehme den Werbeblock aus der Zahlungsmail.": „Ja, Zahlungspost zustellen." Spam-Beschwerden und
// harte Rückläufer bleiben gesperrt.
//
// GEMESSEN (nur lesend, 14 Tage bis 08.10.2026): 337 Zahlungsmails an 74 Adressen (204 Raten-, 122 Erstzahlungs-
// Erinnerungen, 11 weitere) kamen bei Brevo als „blockiert" an — Brevo nimmt die Mail mit 201 an (Protokoll:
// „versandt") und verwirft sie still, weil die Adresse auf seiner Sperrliste für Transaktionsmails steht (meist
// eine alte Abmeldung von Werbung). 63 davon haben eine offene Rate oder Erstzahlung; Spam-Meldungen: keine,
// Rückläufer in 30 Tagen: einer — bleiben 62 Adressen (64 Menschen), die die Freigabe erreichen kann.
//
// DER WEG — an der einen Tür (sendMakeWebhookMitGrund, server/make-webhook.ts), VOR der Frequenzbremse:
//   Zahlungspost (istZahlungspost) an eine Adresse →
//     · zuerst NUR der jüngste Zustellbefund (eine Abfrage — die kostet jede Zahlungsmail); nicht „blockiert" → nichts;
//     · erst dann die teuren Prüfungen: hart (Spam-Meldung JEMALS, Rückläufer in 30 Tagen), schon einmal freigegeben,
//       Tagesdeckel; keine offene Rate/Erstzahlung; ein Nein des Menschen („Stopp" auf WhatsApp/im Postfach,
//       Abmeldung über eine Lead-Mail) → nichts tun (die Mail geht wie bisher und wird wie bisher verworfen);
//     · Brevo nach dem GRUND fragen (brevoSperrGruende): nur wenn JEDER Eintrag eine Abmeldung ist
//       (unsubscribed…), geht es weiter — hardBounce, contactFlaggedAsSpam, adminBlocked, unbekannt: gesperrt;
//     · 1. Werbung sperren — Stempel UND Herkunft (fiaon_persons.werbesperre_quelle = 'zahlungspost_freigabe') in
//       EINEM UPDATE je Person hinter der Adresse — und prüfen, dass sie greift. Die Herkunft steht damit VOR dem
//       Aufheben bei Brevo: Was danach auch abbricht, die Werbesperre ist nie eine „ohne Herkunft".
//       2. Dann die Brevo-Sperre GENAU dieser Adresse aufheben — drei Antworten (brevoSperreAufhebenBefund):
//          aufgehoben → weiter; abgelehnt (eindeutig, 4xx) → die eben gesetzte Werbesperre zurücknehmen, nächster
//          Anlauf beim nächsten Versand; unklar (Zeitüberschreitung, Netz, 5xx) → die Werbesperre BLEIBT (hat Brevo es
//          doch getan, ist die Adresse sonst offen ohne Werbesperre).
//       3. Vermerken (fiaon_mail_log, Ereignis `zahlungspost_freigabe`, Grund im Klartext, Nutzlast werbesperre_neu und
//          brevo = aufgehoben/unklar; dazu eine Zeile im Kontaktverlauf der Akte) und prüfen, dass der Vermerk steht —
//          sonst eine KRITISCHE Diagnose zum Nachtragen.
//   Ab dann ist die Adresse „nur für Zahlungspost" frei. Die Werbesperre MIT DER HERKUNFT DER FREIGABE hält die
//   Zahlungspost nicht auf, die der Mensch vorher bekam: die Erstzahlungs-Erinnerung (Tür UND Auswahl) und die
//   Raten-WhatsApp der WA-Zentrale (FREIGABE_WERBESPERRE_PERSONEN_SQL, fiaon-mail-frequenz.ts) — solange er nicht Nein
//   sagt: Jeder andere Setzweg der Werbesperre setzt werbesperre_quelle = 'mensch', auch auf eine stehende; „Stopp" und
//   Lead-Abmeldung gelten ohnehin. Pflicht- und Leistungsmails an eine Werbesperre tragen keinen Karten-Block und kein
//   Kartenbild (ohne_werbeteil, server/make-webhook.ts) — Brevo stellte sie an die abgemeldete Adresse bisher gar nicht zu.
//   Danach geht die Mail, die gerade an der Tür steht, raus — das ist der EINE erneute Versand. Kein
//   Massenlauf für den Bestand: Der normale Takt nimmt jede Adresse bei ihrem nächsten fälligen Versand mit.
//
// WARUM NICHT DIE VERWORFENE MAIL AUS DEM PROTOKOLL NACHSCHICKEN: Ihre Nutzlast ist geschwärzt
// (payloadSchwaerzen), kann überholt sein (inzwischen bezahlt) und der Abgleich läuft auch nachts. Die
// nächste Mail des Takts trägt den frischen Stand — und kommt höchstens einen Takt später.
//
// EINMAL JE ADRESSE: Kommt eine freigegebene Adresse wieder auf die Sperrliste, hat der Mensch sich erneut
// abgemeldet — dann bleibt sie gesperrt. Nur ein „unklarer" Vermerk zählt dafür erst, wenn danach eine Mail an die
// Adresse zugestellt wurde (sonst hat Brevo das Aufheben wohl nicht ausgeführt — dann darf der nächste Anlauf es
// nachholen). Keine Werbung danach: Die Werbesperre greift an jeder Tür (Mail, WhatsApp, Mara, Verkaufstakt).
// Wirft nie; im Zweifel bleibt alles, wie es ist — und nach dem Absenden des DELETE im Zweifel die Werbesperre.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { brevoSperrGruende, brevoSperreAufhebenBefund, type BrevoAufhebenBefund } from "./fiaon-brevo";
import {
  FREIGABE_AKTEUR, istZahlungspost, KOPF_SQL, LEAD_ABGEMELDET_ADRESSEN_SQL, LEAD_ABGEMELDET_KOEPFE_SQL, personenAnAdresse,
  STOPP_KOEPFE_SQL, werbesperreAnAdresse, WERBESPERRE_QUELLE_FREIGABE, zahlungspostFrei, ZAHLUNGSPOST_FREIGABE_EVENT,
} from "./fiaon-mail-frequenz";

/** Höchstens so viele Freigaben je Kalendertag (Berlin). Gemessen kämen 62 Adressen in Frage — also drei Tage. */
export const FREIGABEN_PRO_TAG = 30;

/** Die teuren Prüfungen — erst, wenn der jüngste Zustellbefund „blockiert" ist. */
export interface AdressLage {
  /** Spam-Meldung JEMALS oder Rückläufer in 30 Tagen (strenger als `hart` in darfAnEmpfaenger: Spam ohne Frist). */
  hart: boolean;
  /** Diese Adresse wurde schon einmal freigegeben (ein „unklarer" Vermerk erst, wenn danach etwas zugestellt wurde). */
  schonFrei: boolean;
  /** Freigaben heute (Berlin) — für den Deckel. */
  heute: number;
}

export interface Forderung {
  personen: number[];
  /** Offene Rate oder offene Erstzahlung, ohne Mahn- oder Abo-Stopp. */
  offen: boolean;
  /** Ein Nein des Menschen, bei dem die Brevo-Sperre bleibt („Stopp", Lead-Abmeldung) — null ohne. */
  nein: string | null;
}

export interface Vermerk {
  adresse: string; event: string; codes: string[]; personen: number[]; neu: number[]; grund: string;
  /** Brevos Antwort auf das Aufheben — „abgelehnt" hinterlässt keinen Vermerk (dann ist nichts offen). */
  brevo: "aufgehoben" | "unklar";
}

/** Die Handgriffe der Freigabe — im Prüfstand durch Attrappen ersetzt. */
export interface Werkzeuge {
  /** Der jüngste Zustellbefund der Adresse in 30 Tagen (zugestellt … blockiert, gebounct, spam) — null ohne. */
  letzterBefund(adresse: string): Promise<string | null>;
  lage(adresse: string): Promise<AdressLage>;
  forderung(adresse: string): Promise<Forderung>;
  sperrGruende(adresse: string): Promise<{ ok: boolean; codes: string[]; grund?: string }>;
  werbesperreAnAdresse(adresse: string): Promise<boolean>;
  /** Stempel UND Herkunft 'zahlungspost_freigabe' in einem UPDATE, nur bei leerem Stempel. true = neu gesetzt. */
  werbesperreSetzen(personId: number): Promise<boolean>;
  /** Nur die eben (in diesem Anlauf) gesetzte Werbesperre zurücknehmen — und nur, solange sie die der Freigabe ist. */
  werbesperreZuruecknehmen(personIds: number[]): Promise<void>;
  sperreAufheben(adresse: string): Promise<BrevoAufhebenBefund>;
  /** Wirft, wenn der Vermerk nicht geschrieben ist (kein stilles Verschlucken wie mailProtokoll). */
  vermerken(v: Vermerk): Promise<void>;
  /** Steht der Vermerk für diese Adresse? (zahlungspostFrei — der Nachweis nach dem Schreiben) */
  vermerkSteht(adresse: string): Promise<boolean>;
  /** Eine kritische Diagnose, wenn die Freigabe halb steht (Brevo frei oder unklar, Vermerk fehlt). Wirft nie. */
  melden(d: { code: string; message: string; hint: string }): void;
}

/** Nur eine Abmeldung darf weichen — jeder Eintrag muss eine sein (Brevo: unsubscribedViaEmail/-ViaMA/-ViaApi). */
export function nurAbmeldung(codes: string[]): boolean {
  return codes.length > 0 && codes.every((c) => /^unsubscribed/i.test(String(c)));
}

/** null = an dieser Adresse ist nichts zu tun (kein Befund) — sonst das Urteil mit Grund. */
export type Freigabe = { freigegeben: boolean; grund: string } | null;

const laufend = new Set<string>();

export async function zahlungspostFreigeben(email: string, event: string, werkzeuge?: Werkzeuge): Promise<Freigabe> {
  const w = werkzeuge ?? ECHT;
  const adresse = String(email || "").trim().toLowerCase();
  if (!adresse || !istZahlungspost(event) || laufend.has(adresse)) return null;
  laufend.add(adresse);
  // GANZ ODER GAR NICHT: Scheitert vor dem DELETE ein Schritt, wird die eben gesetzte Werbesperre zurückgenommen.
  // Ab dem Absenden des DELETE ist offen, ob Brevo die Sperre aufhebt — dann BLEIBT sie (behalten), außer Brevo lehnt
  // eindeutig ab. Sonst stünde die Adresse womöglich offen, ohne Werbesperre (zweite Prüfung, 08.10.2026).
  const neu: number[] = [];
  let behalten = false;
  try {
    // 0. Die billige Frage zuerst (zweite Prüfung): Jede Zahlungsmail kommt hier vorbei, fast jede endet hier.
    if ((await w.letzterBefund(adresse)) !== "blockiert") return null;
    const nein = (grund: string) => ({ freigegeben: false, grund });
    const l = await w.lage(adresse);
    if (l.hart) return nein("Rückläufer oder Spam-Meldung — bleibt gesperrt");
    if (l.schonFrei) return nein("schon einmal freigegeben — eine erneute Sperre bleibt");
    if (l.heute >= FREIGABEN_PRO_TAG) return nein(`Tagesdeckel erreicht (${l.heute}/${FREIGABEN_PRO_TAG})`);
    const f = await w.forderung(adresse);
    if (!f.personen.length || !f.offen) return nein("keine offene Rate und keine offene Erstzahlung");
    if (f.nein) return nein(`${f.nein} — bleibt gesperrt`);
    const s = await w.sperrGruende(adresse);
    if (!s.ok) return nein(`Brevo-Sperrliste nicht lesbar: ${s.grund ?? "unbekannt"}`);
    if (!s.codes.length) return nein("steht nicht (mehr) auf Brevos Sperrliste");
    if (!nurAbmeldung(s.codes)) return nein(`Brevo-Sperrgrund ${s.codes.join(", ")} — bleibt gesperrt`);

    // 1. ZUERST die Werbung sperren, mit Herkunft — und prüfen, dass sie an genau dieser Adresse greift.
    for (const id of f.personen) if (await w.werbesperreSetzen(id)) neu.push(id);
    if (!(await w.werbesperreAnAdresse(adresse))) return nein("Werbesperre greift an der Adresse nicht — Brevo-Sperre bleibt");
    // 2. DANN die Brevo-Sperre genau dieser Adresse aufheben.
    behalten = true;
    const a = await w.sperreAufheben(adresse);
    if (a.ergebnis === "abgelehnt") {
      behalten = false;
      return nein(`Brevo-Sperre ließ sich nicht aufheben (${a.status ? `HTTP ${a.status}` : a.grund}) — nächster Anlauf beim nächsten Versand`);
    }
    // 3. Vermerken — er ist das „einmal je Adresse" und der Tagesdeckel. Ein klemmender Schreibversuch bekommt EINEN
    //    zweiten Anlauf; danach (oder wenn der Vermerk trotzdem nicht steht) eine kritische Diagnose zum Nachtragen.
    const codes = Array.from(new Set(s.codes)).join(", ");
    const sperre = neu.length ? `neu gesetzt (Person ${neu.join(", ")})` : "bestand schon";
    const grund = a.ergebnis === "aufgehoben"
      ? `Zahlungspost-Freigabe: Brevo-Abmeldung (${codes}) aufgehoben, Adresse nur für Zahlungspost — Werbesperre ${sperre}. Auslöser: ${event}.`
      : `Zahlungspost-Freigabe unklar: Brevo-Abmeldung (${codes}), die Antwort auf das Aufheben fehlt (${a.grund}) — Werbesperre ${sperre}, `
        + `sie bleibt stehen; ist die Adresse beim nächsten Versand noch gesperrt, folgt ein neuer Anlauf. Auslöser: ${event}.`;
    const vermerk: Vermerk = { adresse, event, codes: s.codes, personen: f.personen, neu, grund, brevo: a.ergebnis };
    let fehler = "";
    for (let versuch = 0; versuch < 2; versuch++) {
      try { await w.vermerken(vermerk); fehler = ""; break; } catch (e) { fehler = e instanceof Error ? e.message : String(e); }
    }
    const steht = !fehler && (await w.vermerkSteht(adresse).catch(() => false));
    if (!steht) {
      w.melden({
        code: "zahlungspost_freigabe_ohne_vermerk",
        message: `Zahlungspost-Freigabe halb: Die Brevo-Sperre einer abgemeldeten Adresse (Auslöser ${event}) ist `
          + `${a.ergebnis === "aufgehoben" ? "aufgehoben" : "vielleicht aufgehoben (Brevo-Antwort unklar)"} und die Werbesperre steht mit der `
          + `Herkunft „Zahlungspost-Freigabe" (Person ${f.personen.join(", ")}${neu.length ? `, neu gesetzt an ${neu.join(", ")}` : ""}), aber der Vermerk `
          + `„${ZAHLUNGSPOST_FREIGABE_EVENT}“ fehlt${fehler ? ` (${fehler.replace(/[^\s@]+@[^\s@]+/g, "…").slice(0, 160)})` : ""}. Zahlungspost `
          + `läuft (die Herkunft steht an der Person) — es fehlt der Nachweis „einmal je Adresse": Meldet sich der Mensch `
          + `bei Brevo erneut ab, höbe die Freigabe die Sperre noch einmal auf.`,
        hint: `Vermerk nachtragen: Zeile in fiaon_mail_log mit event = '${ZAHLUNGSPOST_FREIGABE_EVENT}', status = 'uebersprungen', `
          + `empfaenger = die Adresse der Person, payload = {"werbesperre_neu": [${neu.join(", ")}], "brevo": "${a.ergebnis}"}.`,
      });
      return { freigegeben: false, grund: `Brevo-Sperre ${a.ergebnis === "aufgehoben" ? "aufgehoben" : "vielleicht aufgehoben"}, aber der Vermerk fehlt — kritisch gemeldet (Werbesperre bleibt)` };
    }
    if (a.ergebnis === "unklar") {
      return { freigegeben: false, grund: `Brevo-Antwort unklar (${a.grund}) — Werbesperre bleibt, Vermerk steht; ist die Adresse beim nächsten Versand noch gesperrt, folgt ein neuer Anlauf` };
    }
    return { freigegeben: true, grund };
  } catch (e) {
    console.error("[ZAHLUNGSPOST] Freigabe fehlgeschlagen, alles bleibt wie es ist:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    // Vor dem DELETE: die eben gesetzte Werbesperre zurück. Ab dem DELETE bleibt sie (außer bei eindeutiger Ablehnung).
    if (!behalten && neu.length) await w.werbesperreZuruecknehmen(neu).catch(() => {});
    laufend.delete(adresse);
  }
}

// ── DIE ECHTEN HANDGRIFFE ────────────────────────────────────────────────────
export const ECHT: Werkzeuge = {
  async letzterBefund(a) {
    // Die EINE Abfrage, die jede Zahlungsmail an der Tür kostet (zweite Prüfung, 08.10.): nur der jüngste Befund.
    const [z] = (await sqlPool`
      SELECT m.zustellung FROM fiaon_mail_log m
       WHERE LOWER(TRIM(m.empfaenger)) = ${a} AND m.status = 'versandt' AND m.art = 'echt'
         AND m.created_at > NOW() - INTERVAL '30 days'
         AND m.zustellung IN ('zugestellt', 'geoeffnet', 'geklickt', 'blockiert', 'gebounct', 'spam')
       ORDER BY m.created_at DESC LIMIT 1`) as any[];
    return z?.zustellung ?? null;
  },
  async lage(a) {
    const [z] = (await sqlPool`
      SELECT
        -- Spam-Meldung JEMALS (nach der Prüfung, 08.10.: sonst hob eine spätere Abmeldung bei Brevo die Sperre
        -- eines Menschen auf, der uns vor über 30 Tagen als Spam gemeldet hat), Rückläufer in 30 Tagen.
        EXISTS (SELECT 1 FROM fiaon_mail_log m
          WHERE LOWER(TRIM(m.empfaenger)) = ${a}
            AND (m.zustellung = 'spam'
                 OR (m.zustellung = 'gebounct' AND m.status = 'versandt' AND m.art = 'echt'
                     AND m.created_at > NOW() - INTERVAL '30 days'))) AS hart,
        -- Schon einmal freigegeben. Ein „unklarer" Vermerk (Brevo-Antwort fehlte) zählt erst, wenn danach eine Mail an
        -- die Adresse zugestellt wurde — sonst hat Brevo das Aufheben wohl nicht ausgeführt, und der Anlauf darf es nachholen.
        EXISTS (SELECT 1 FROM fiaon_mail_log m
          WHERE m.event = ${ZAHLUNGSPOST_FREIGABE_EVENT} AND LOWER(TRIM(m.empfaenger)) = ${a}
            AND (COALESCE(m.payload ->> 'brevo', 'aufgehoben') <> 'unklar'
                 OR EXISTS (SELECT 1 FROM fiaon_mail_log z
                             WHERE LOWER(TRIM(z.empfaenger)) = ${a} AND z.created_at > m.created_at
                               AND z.status = 'versandt' AND z.art = 'echt'
                               AND z.zustellung IN ('zugestellt', 'geoeffnet', 'geklickt')))) AS schon_frei,
        (SELECT COUNT(*) FROM fiaon_mail_log m WHERE m.event = ${ZAHLUNGSPOST_FREIGABE_EVENT}
          AND m.created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'))::int AS heute
    `) as any[];
    return { hart: !!z?.hart, schonFrei: !!z?.schon_frei, heute: Number(z?.heute ?? 0) };
  },
  async forderung(a) {
    const personen = await personenAnAdresse(a);
    if (!personen.length) return { personen, offen: false, nein: null };
    // Offene Erstzahlung: wie die Erinnerungsmaschine (claimReminderBatch), ohne Mahnstopp. Offene Rate: offen,
    // nicht storniert, fällig oder in der Vorabwoche, ohne Abo-Stopp. Auch an zusammengeführten Personen.
    // Zweite Prüfung (08.10.): Hat der Mensch Nein gesagt — „Stopp" auf WhatsApp oder im Postfach, eine Abmeldung über
    // eine Lead-Mail (an seiner Familie oder an genau dieser Adresse) —, hebt die Freigabe Brevos Sperre nicht auf.
    const [o] = (await sqlPool`
      WITH ids AS (SELECT id FROM fiaon_persons WHERE id = ANY(${personen}) OR merged_into_person_id = ANY(${personen}))
      SELECT EXISTS (SELECT 1 FROM fiaon_applications f WHERE f.person_id IN (SELECT id FROM ids)
                       AND f.merged_into IS NULL AND f.archived_at IS NULL AND f.mahnstopp_am IS NULL
                       AND f.payment_status IN ('pending_payment', 'claimed_paid') AND f.payment_reference IS NOT NULL)
          OR EXISTS (SELECT 1 FROM fiaon_abo_raten r
                       JOIN fiaon_applications f ON f.ref = r.ref AND f.merged_into IS NULL AND f.abo_gestoppt_am IS NULL
                      WHERE f.person_id IN (SELECT id FROM ids)
                        AND r.status = 'offen' AND r.storniert_am IS NULL AND r.faellig_am <= CURRENT_DATE + 7) AS offen,
             EXISTS (SELECT 1 FROM ids WHERE ${sqlPool.unsafe(KOPF_SQL("ids.id"))} IN ${sqlPool.unsafe(STOPP_KOEPFE_SQL)}) AS stopp,
             (EXISTS (SELECT 1 FROM ids WHERE ${sqlPool.unsafe(KOPF_SQL("ids.id"))} IN ${sqlPool.unsafe(LEAD_ABGEMELDET_KOEPFE_SQL)})
              OR ${a} IN ${sqlPool.unsafe(LEAD_ABGEMELDET_ADRESSEN_SQL)}) AS lead_abgemeldet
    `) as any[];
    const nein = o?.stopp ? "„Stopp“ des Menschen (WhatsApp oder Postfach)" : o?.lead_abgemeldet ? "Abmeldung über eine Lead-Mail" : null;
    return { personen, offen: !!o?.offen, nein };
  },
  sperrGruende: brevoSperrGruende,
  werbesperreAnAdresse,
  async werbesperreSetzen(id) {
    // Stempel UND Herkunft in EINEM UPDATE (zweite Prüfung, 08.10.) — nur bei leerem Stempel: Eine stehende Werbesperre
    // bleibt samt ihrer Herkunft, wie sie ist (die eines Menschen bleibt die eines Menschen).
    const r = (await sqlPool`
      UPDATE fiaon_persons SET werbung_gesperrt_am = NOW(), werbesperre_quelle = ${WERBESPERRE_QUELLE_FREIGABE}, updated_at = NOW()
       WHERE id = ${id} AND werbung_gesperrt_am IS NULL RETURNING id`) as any[];
    return r.length > 0;
  },
  async werbesperreZuruecknehmen(ids) {
    // Nur ein frischer Stempel (dieser Anlauf, Sekunden alt) mit der Herkunft der Freigabe — eine ältere oder eine
    // inzwischen von einem Menschen übernommene Werbesperre (werbesperre_quelle 'mensch') bleibt unangetastet.
    await sqlPool`
      UPDATE fiaon_persons SET werbung_gesperrt_am = NULL, werbesperre_quelle = NULL, updated_at = NOW()
       WHERE id = ANY(${ids}) AND werbung_gesperrt_am > NOW() - INTERVAL '10 minutes'
         AND werbesperre_quelle = ${WERBESPERRE_QUELLE_FREIGABE}`;
  },
  sperreAufheben: brevoSperreAufhebenBefund,
  async vermerken(v) {
    // Direkt geschrieben (nach der Prüfung, 08.10.): mailProtokoll verschluckt jeden Fehler — hier MUSS ein Fehler
    // werfen, sonst meldete die Freigabe „freigegeben", ohne dass der Vermerk steht. Die Nutzlast als echtes
    // jsonb-Objekt (sqlPool.json, nicht JSON.stringify — E-238-Falle; lage() liest payload ->> 'brevo'). status
    // „uebersprungen": Diese Zeile ist keine Mail — Zustell-Marke, Zustellprotokoll und Mailwerk nehmen das Ereignis
    // aus ihren Zählungen.
    await sqlPool`
      INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, grund, payload, ausgeloest_von)
      VALUES (${ZAHLUNGSPOST_FREIGABE_EVENT}, ${v.personen[0] ?? null}, ${v.adresse}, 'uebersprungen', ${v.grund},
              ${sqlPool.json({ ausloeser: v.event, brevo_gruende: v.codes, personen: v.personen, werbesperre_neu: v.neu, brevo: v.brevo } as any)},
              ${FREIGABE_AKTEUR})`;
    // Die Werbesperre ist in der Akte sichtbar — hier steht, warum (sonst hebt sie jemand „aus Versehen" auf).
    for (const id of v.neu) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        SELECT a.ref, ${id}, NULL, ${FREIGABE_AKTEUR}, 'system',
               ${`Werbesperre gesetzt: ${v.adresse} war bei Brevo abgemeldet. Die Adresse bekommt nur noch Zahlungspost (Raten- und Zahlungserinnerungen), keine Werbung (Justin, 08.10.2026).`}
          FROM fiaon_applications a WHERE a.person_id = ${id} AND a.merged_into IS NULL
         ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});
    }
  },
  vermerkSteht: zahlungspostFrei,
  melden(d) {
    import("./fiaon-diagnostics")
      .then((m) => m.logDiagnostic({ severity: "kritisch", category: "email_make", code: d.code, message: d.message, hint: d.hint }))
      .catch((e) => console.error("[ZAHLUNGSPOST] Diagnose nicht geschrieben:", e instanceof Error ? e.message : e));
    console.error(`[ZAHLUNGSPOST] KRITISCH ${d.code}: ${d.message}`);
  },
};
