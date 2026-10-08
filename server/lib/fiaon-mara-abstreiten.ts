// ═══════════════════════════════════════════════════════════════════════════
// „HAB NIX BEANTRAGT" — WAS DER SERVER DAZU WEISS UND TUT (29.09.2026, E-264)
//
// Die Erkennung und die Sätze stehen rein in shared/fiaon-mara-ton.ts (f);
// hier nur, was die Datenbank braucht — für Mara auf WhatsApp UND im Postfach:
//   · abstreitenLage()  — seine Stufe (stufeAusAntrag, EINE Regel „abgeschickt"),
//                         woher wir ihn kennen (nur Belegtes) und sein Betreuer.
//   · abstreitenFolgen() — welche Art welche Folge hat (rein): Werbesperre ja/nein,
//                         Aufgabe an wen, dringend.
//   · werbesperreSetzen() — DERSELBE Weg wie werbesperre_setzen im Postfach und
//                         der Abmeldelink (fiaon_persons.werbung_gesperrt_am,
//                         seit 08.10.2026 mit werbesperre_quelle = 'mensch').
//   · werbesperreBeiFreigabe() — per Mail erst, wenn ein Mensch den Entwurf freigibt.
//   · leitungId()       — wer „die Leitung" ist: derselbe Weg wie
//                         aufgabe_an_betreuer mit kollege „Leitung"
//                         (Vertriebsleiter mit offenem Zugang), sonst Justin.
//
// NACHBESSERUNG E-264 (29.09.2026, Gegenlesen):
//   · KEIN Mahnstopp mehr (die erste Fassung setzte mahnstopp_am auf jede nie
//     abgeschickte Bestellung). Er blieb nach dem Abschicken und Zahlen hängen —
//     niemand setzte ihn zurück —, und wer später doch weitermachte („das war
//     meine Frau, wir machen weiter"), bekam nie wieder eine Zahlungs- oder
//     Ratenerinnerung. Er ist auch unnötig: Seit E-264 gehen Zahlungserinnerung
//     (claimReminderBatch), Rückholung, WA-Zentrale, Mara-Aktion und Lead-Kette
//     nur noch an ABGESCHICKTE Anträge (abgeschicktSql).
//   · Die Herkunft kam aus dem JÜNGSTEN Antrag — auch aus einer Betreuer-Anlage
//     (payment_pending, Schritt 5, ohne IP/Browser) oder dem Akte-Anker. Person
//     5149: Web-Anmeldung am 21.08., Betreuer-Anlage am 23.09. — Mara hätte
//     „am 23. September … auf unserer Internetseite" gesagt: Tag und Weg falsch.
//     Jetzt: die FRÜHESTE belegte Quelle — ein Antrag aus dem Webformular
//     (user_agent gesetzt), eine Meta-Anfrage oder seine erste WhatsApp; sonst
//     „unbekannt" („Woher genau, prüft unsere Leitung").
//   · „Falsche Nummer" sperrt nicht mehr die Person (das ist der eigentliche
//     Antragsteller, dessen Nummer falsch hinterlegt ist — Hausregel
//     nummer_falsch in fiaon-kontakt-ergebnis.ts: „NICHT sperren").
//   · Stufe B (abgeschickt) + „bestreitet": keine automatische Werbesperre —
//     die Leitung entscheidet (sonst fielen bei einem Fehlalarm auch Raten-
//     erinnerungen weg, die BASIS der WA-Zentrale verlangt werbung_gesperrt_am IS NULL).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { stufeAusAntrag, type AbstreitenArt, type Herkunft, type LinkStufe } from "@shared/fiaon-mara-ton";
import { antragAbgeschickt } from "@shared/fiaon-antrag-stand";
import { nennform } from "@shared/fiaon-mitarbeiter-name";
import { WERBESPERRE_QUELLE_FREIGABE, WERBESPERRE_QUELLE_MENSCH } from "./fiaon-mail-frequenz";

export interface AbstreitenLage {
  stufe: LinkStufe;
  /** Ein abgeschickter Antrag liegt vor (Stufe B oder weiter). */
  abgeschickt: boolean;
  herkunft: Herkunft | null;
  /** Vorname seines Betreuers (für die Rückfrage) — null ohne. */
  betreuer: string | null;
}

/**
 * Die früheste belegte Quelle seiner Nummer/Adresse — rein, für Server und Prüfstand.
 * `webAm`: ältester Antrag aus dem Webformular (user_agent gesetzt); `leads`: seine Leads.
 * Ein Lead zählt nur mit bekannter Quelle (Meta-Formular, WhatsApp-Eingang) — „import" sagt nicht, woher.
 */
export function fruehesteHerkunft(webAm: unknown, leads: { erstellt_am: unknown; quelle: unknown }[]): Herkunft | null {
  const kandidaten: { art: Herkunft["art"]; am: Date }[] = [];
  const zeit = (x: unknown): Date | null => {
    if (x == null || x === "") return null;
    const d = new Date(x as any);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const w = zeit(webAm);
  if (w) kandidaten.push({ art: "antrag", am: w });
  for (const l of leads) {
    const d = zeit(l.erstellt_am);
    if (!d) continue;
    const q = String(l.quelle ?? "");
    if (/facebook|instagram|meta/i.test(q)) kandidaten.push({ art: "anfrage_meta", am: d });
    else if (q === "whatsapp_eingang") kandidaten.push({ art: "whatsapp", am: d });
  }
  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => a.am.getTime() - b.am.getTime());
  return { art: kandidaten[0].art, am: kandidaten[0].am };
}

/**
 * Seine Lage für die Abstreiten-Antwort. Der Antrag für die Stufe wird gewählt wie
 * in Maras Lage (fiaon-whatsapp-mara.ts, lageFuer): kein Auskunft-/Global-Auftrag,
 * bezahlt zuerst, sonst der jüngste. Die Herkunft: fruehesteHerkunft. Ohne Person: nur der Lead.
 *
 * E-272 (02.10.2026, Gegenprüfung): Seit lageFuer archivierte, unbezahlte Bestellungen auslässt
 * (archived_at IS NULL OR paid, wie antragBasisSql), tut es diese Wahl auch — sonst nannte die Lage
 * den lebenden Antrag und das Abstreiten eine archivierte Dublette („abgeschickt“ statt „nie
 * abgeschickt“). Gemessen 02.10. über alle 2.756 Personen mit Bestellung: wich für 23 ab, jetzt 0.
 */
export async function abstreitenLage(personId: number | null, leadId: number | null = null): Promise<AbstreitenLage> {
  const [a] = personId ? (await sqlPool`
    SELECT status, payment_status, current_step, submitted_at, gekuendigt_am, abo_gestoppt_am
      FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
       AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
       AND (archived_at IS NULL OR payment_status = 'paid')
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[] : [];
  // Der älteste Antrag, der im Webformular entstand (Browser-Kennung gesetzt) — auch eine spätere
  // Dublette (merged_into) war seine eigene Eingabe. Betreuer-Anlage und Akte-Anker haben keine.
  const [web] = personId ? (await sqlPool`
    SELECT MIN(created_at) AS am FROM fiaon_applications
     WHERE person_id = ${personId} AND NOT COALESCE(ist_entwurf, FALSE) AND COALESCE(user_agent, '') <> ''
       AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'`.catch(() => [])) as any[] : [];
  const leads = (await (personId
    ? sqlPool`SELECT erstellt_am, quelle FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am ASC NULLS LAST LIMIT 20`
    : leadId ? sqlPool`SELECT erstellt_am, quelle FROM fiaon_leads WHERE id = ${leadId} LIMIT 1` : Promise.resolve([])).catch(() => [])) as any[];
  // Der Betreuer nur, wenn er wirklich da ist (wie lageFuer, E-236) — sonst „Jemand aus unserem Team".
  // E-265 (29.09.2026): als Nennform („Herr Stripling meldet sich …"), vorher der Vorname aus name.
  const [b] = personId ? (await sqlPool`
    SELECT g.name, g.first_name, g.last_name, g.anrede
      FROM fiaon_persons p JOIN fiaon_agents g ON g.id = p.assigned_agent_id
     WHERE p.id = ${personId} AND COALESCE(g.active, TRUE) AND g.zugang_gesperrt_am IS NULL
       AND NOT COALESCE(g.is_test_account, FALSE) LIMIT 1`.catch(() => [])) as any[] : [];
  const stufe: LinkStufe = a ? stufeAusAntrag(a) : "lead";
  return {
    stufe, abgeschickt: a ? antragAbgeschickt(a) : false,
    herkunft: fruehesteHerkunft(web?.am ?? null, leads),
    betreuer: b?.name || b?.first_name ? nennform(b).nom : null,
  };
}

export interface AbstreitenFolgen {
  /** Die Werbesperre setzen (bestehender Weg). */
  werbesperre: boolean;
  /** Wer die Aufgabe bekommt: die Leitung (Abstreiten, Löschen) oder sein Betreuer (Rückfrage). */
  an: "leitung" | "betreuer";
  dringend: boolean;
}

/**
 * Welche Folge eine Art hat — EINE Stelle für WhatsApp und Mail. Rein.
 *   · Löschwunsch: Werbesperre immer (ausdrücklich), Leitung, dringend.
 *   · bestreitet: Werbesperre nur ohne abgeschickten Antrag (Stufe C) — bei B entscheidet die Leitung.
 *   · in_ruhe („lassen Sie mich in Ruhe", „keinen Kontakt mehr"): Werbesperre — er hat darum gebeten.
 *   · falsche_nummer: KEINE Werbesperre (der eigentliche Kunde verlöre jede Post) — die Leitung korrigiert.
 *   · wut (nur Emojis), rueckfrage: keine Werbesperre; die Rückfrage geht an den Betreuer.
 */
export function abstreitenFolgen(art: AbstreitenArt | "loeschen", abgeschickt: boolean): AbstreitenFolgen {
  if (art === "loeschen") return { werbesperre: true, an: "leitung", dringend: true };
  if (art === "bestreitet") return { werbesperre: !abgeschickt, an: "leitung", dringend: true };
  if (art === "in_ruhe") return { werbesperre: true, an: "leitung", dringend: false };
  if (art === "falsche_nummer") return { werbesperre: false, an: "leitung", dringend: true };
  if (art === "rueckfrage") return { werbesperre: false, an: "betreuer", dringend: true };
  return { werbesperre: false, an: "leitung", dringend: false };
}

/**
 * Werbesperre setzen (bestehender Weg) — auf Wunsch des MENSCHEN. true = sie war vorher nicht gesetzt.
 *
 * Zahlungspost-Freigabe (zweite Prüfung, 08.10.2026): Setzt IMMER werbesperre_quelle = 'mensch', auch wenn der Stempel
 * schon steht. Vorher tat diese Funktion dann gar nichts — stand dort die Werbesperre der Zahlungspost-Freigabe, liefen
 * Erstzahlungs-Erinnerung und Raten-WhatsApp weiter, obwohl der Mensch eben „in Ruhe lassen", „schreiben Sie mir nicht
 * mehr" oder „löschen" gesagt hatte, und nichts davon stand im Kontaktprotokoll. Jetzt ist die Werbesperre ab da seine
 * (FREIGABE_WERBESPERRE_PERSONEN_SQL, fiaon-mail-frequenz.ts), und der Wechsel steht im Kontaktprotokoll (`wer`).
 * Eine schon als 'mensch' vermerkte Werbesperre bleibt unberührt (kein neues updated_at); eine von vor dem 08.10.
 * (Herkunft leer, also die eines Menschen) bekommt den Vermerk nachgetragen.
 */
export async function werbesperreSetzen(personId: number, wer = "Mara"): Promise<boolean> {
  const [r] = (await sqlPool`
    WITH vorher AS (SELECT werbung_gesperrt_am AS stempel, werbesperre_quelle AS quelle FROM fiaon_persons WHERE id = ${personId}),
         jetzt AS (
           UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()),
                  werbesperre_quelle = ${WERBESPERRE_QUELLE_MENSCH}, updated_at = NOW()
            WHERE id = ${personId} AND (werbung_gesperrt_am IS NULL OR werbesperre_quelle IS DISTINCT FROM ${WERBESPERRE_QUELLE_MENSCH})
           RETURNING id)
    SELECT (v.stempel IS NULL) AS neu, (v.stempel IS NOT NULL AND v.quelle = ${WERBESPERRE_QUELLE_FREIGABE}) AS aus_freigabe
      FROM vorher v, jetzt`) as any[];
  if (r?.aus_freigabe) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT a.ref, ${personId}, NULL, ${wer}, 'system',
             ${"Werbesperre jetzt auf seinen Wunsch (vorher nur aus der Zahlungspost-Freigabe): keine Erstzahlungs-Erinnerung und keine Raten-WhatsApp mehr. Die Raten-Mail läuft bis zu einem Mahnstopp weiter (E-182)."}
        FROM fiaon_applications a WHERE a.person_id = ${personId} AND a.merged_into IS NULL
       ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});
  }
  return !!r?.neu;
}

/** Der Merker in den Handlungen eines Postfach-Entwurfs: „Werbesperre mit der Freigabe setzen". */
export const WERBESPERRE_BEI_FREIGABE = "werbesperre_bei_freigabe";

/**
 * Per Mail gilt: erst die Freigabe durch einen Menschen, dann die Werbesperre (E-264, Gegenlesen —
 * vorher setzte schon der ENTWURF sie, auch bei einem Fehlalarm). Beide Sendewege der Zentrale rufen
 * das vor dem Versand. true = diese Zeile trug den Merker (die Werbesperre steht jetzt).
 */
export async function werbesperreBeiFreigabe(zeile: { id: number; person_id?: number | null; handlungen?: unknown }): Promise<boolean> {
  if (!zeile.person_id) return false;
  // Die Handlungen liegen als jsonb — auch doppelt als Text gespeichert (E-238-Falle); handlungenFlach kennt jede Form.
  const { handlungenFlach } = await import("./fiaon-postmeister-lauf");
  if (!handlungenFlach(zeile.handlungen).some((x: any) => x && x.werkzeug === WERBESPERRE_BEI_FREIGABE)) return false;
  const neu = await werbesperreSetzen(Number(zeile.person_id), "Postmeister").catch(() => false);
  if (neu) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT a.ref, ${Number(zeile.person_id)}, NULL, 'Postmeister', 'system',
             ${`Werbesperre mit der Freigabe gesetzt (Mail #${zeile.id}, E-264).`}
        FROM fiaon_applications a WHERE a.person_id = ${Number(zeile.person_id)} AND a.merged_into IS NULL
       ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});
  }
  return true;
}

/** Die Leitung — wie aufgabe_an_betreuer mit kollege „Leitung": Vertriebsleiter mit offenem Zugang. null = Justin. */
export async function leitungId(): Promise<number | null> {
  const [l] = (await sqlPool`
    SELECT id FROM fiaon_agents
     WHERE COALESCE(active, TRUE) = TRUE AND rolle = 'vertriebsleiter' AND COALESCE(is_test_account, FALSE) = FALSE
       AND zugang_gesperrt_am IS NULL
     ORDER BY id ASC LIMIT 1`.catch(() => [])) as any[];
  return l?.id ? Number(l.id) : null;
}
