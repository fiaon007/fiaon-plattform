// ═══════════════════════════════════════════════════════════════════════════
// NACHARBEIT NACH DEM ANRUF — EIN KLICK, MARA MACHT DEN REST (E-406 C2, 19.10.2026) — DER SERVER HANDELT
//
// Justin (19.10.2026), Vorschlag 3 „Mara führt den Betrieb“: „Nach dem Anruf genügt ein Klick auf das Ergebnis.
// Die Nacharbeit macht Mara.“ Die Regel (welche Mail, wann nicht, wann) steht rein in shared/fiaon-mara-nacharbeit.ts,
// Texte und Textprüfung in shared/fiaon-mara-nacharbeit-text.ts. Hier:
//
//   1. VORMERKEN — nacharbeitNachErgebnis, aus jeder Route, die ein Gesprächsergebnis bucht (Kundenkarte, Akte,
//      Telefon). Mit Häkchen merkt Mara die Mail vor (oder hält fest, warum nicht — der Mitarbeiter liest es in
//      der Meldung). Ohne Häkchen nimmt ein ANDERES Ergebnis binnen KORREKTUR_MINUTEN eine noch wartende Mail
//      zurück (berichtigt), ebenso dasselbe Ergebnis mit BEWUSST abgewähltem Häkchen (Kundenkarte/Akte schicken
//      dann `false`, das Telefon schickt nichts) und jede heikle Notiz. Kein Versand im Klick: die Buchung bleibt
//      schnell, und das Ergebnis lässt sich noch REIF_MINUTEN lang berichtigen (ein neueres Ergebnis mit Häkchen
//      ersetzt die wartende Mail). Der Merker kennt seinen Verlaufseintrag (log_id): „Irrtümlich?“ daran nimmt die
//      Mail zurück (nacharbeitZuEintragZuruecknehmen, POST /agent/log/:id/void), und der Takt prüft ihn noch einmal.
//   2. SENDEN — der Takt nacharbeitTakt (routes.ts, tageslauf „mara_nacharbeit_mail“, alle 2 Min.) nimmt fällige
//      Merker atomar (FOR UPDATE SKIP LOCKED), prüft die Regel NOCH EINMAL (bezahlt? gekündigt? gesperrt? Rückruf
//      verworfen?) und schickt über den einen Weg des Hauses: versendenUndProtokollieren → Tür (Adresse,
//      Global-Wand PRIVATLINIE_PERSON, Werbesperre, Frequenzbremse, Protokoll, Verlauf in der Akte). Vor dem Versand
//      rendert der Motor die Mail, und nacharbeitTextPruefen prüft den ganzen Kundentext (Wortwand, E-393, Ton,
//      Bank-Satz, Nennform). „Unterlagen“ geht über die bestehende Unterlagen-Bitte (unterlagenAnfrageSenden) und
//      meldet das Ereignis „unterlage_angefordert“ an die Aufträge (E-397).
//
// NIE DOPPELT: höchstens EIN wartender Merker je Person (eindeutiger Teilindex), höchstens eine versandte Mail je
// DOPPELT_STUNDEN; ein Merker, der beim Senden hängen blieb, wird „unklar“ und nie erneut gesendet.
// Geld bucht Mara nie, Erstattungen nie — diese Mails bestätigen nur, was am Telefon vereinbart war.
// Wirft nie in den Weg des Mitarbeiters: Fehler stehen im Server-Log und im Merker.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "@shared/fiaon-kuendigung-regel";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";
import { schalterAn, imVersandfenster, naechstesFenster } from "@shared/fiaon-nicht-erreicht-nachfass";
import { nennform } from "@shared/fiaon-mitarbeiter-name";
import { datumFuerKunde, uhrText, zeitFuerKunde } from "@shared/fiaon-mara-ton";
import { LINK_ART_TEXT, istLinkArt, type LinkArt } from "@shared/fiaon-unterlagen-anfrage";
import {
  ART_TEXT, DOPPELT_STUNDEN, ERGEBNISSE_MIT_NACHARBEIT, GRUND, KI_PAUSE_WARTEN_MINUTEN, KORREKTUR_MINUTEN, NACHARBEIT_EVENT,
  NACHARBEIT_SCHALTER, VERFALL_STUNDEN, berlinTag, betragText, heikleNotiz, hinweisFuerMitarbeiter, istNacharbeitArt, kurzDatum,
  nacharbeitArt, nacharbeitUrteil, unterlagenAusNotiz, unterlagenFuerLink, zuSpaetGrund,
  type NacharbeitArt, type NacharbeitFakten, type NacharbeitUrteil, type NacharbeitVorschauDaten,
} from "@shared/fiaon-mara-nacharbeit";
import {
  GESPRAECH_AUFTRAG, GESPRAECH_SCHEMA, absaetzeAus, gespraechNachricht, htmlSicher, nacharbeitTextPruefen,
} from "@shared/fiaon-mara-nacharbeit-text";

type Lauf = any;
export const NACHARBEIT_TABELLE = "fiaon_mara_nacharbeit";

export type MerkerStatus =
  | "vorgemerkt" | "in_arbeit" | "versandt" | "fehlgeschlagen" | "ausgelassen" | "erledigt" | "ersetzt"
  | "zurueckgenommen" | "verfallen" | "unklar";

/** Offene heikle Aufträge (E-397, shared/fiaon-auftrag-arten.ts) — dann schreibt ein Mensch, nicht Mara. */
const HEIKLE_AUFTRAGSARTEN = ["kuendigung", "beschwerde", "loeschantrag", "mara_eskalation", "mara_mail_heikel", "mara_wa_heikel"] as const;

let tabelleBereit: Promise<boolean> | null = null;
/**
 * Die Merker-Tabelle beim ersten Gebrauch anlegen — NEUE Tabelle, über den globalen Pool, mit kurzer Sperrfrist
 * (AGENTS.md, Falle 1). Scheitert das Anlegen, fällt nur diese Automatik aus.
 */
export function nacharbeitTabelle(): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          CREATE TABLE IF NOT EXISTS fiaon_mara_nacharbeit (
            id BIGSERIAL PRIMARY KEY,
            person_id INTEGER NOT NULL,
            ref TEXT,
            art TEXT NOT NULL,
            ergebnis TEXT NOT NULL,
            notiz TEXT,
            zusage_tag DATE,
            termin_am TIMESTAMPTZ,
            unterlagen TEXT[],
            agent_id INTEGER,
            agent_name TEXT,
            status TEXT NOT NULL,
            grund TEXT,
            nicht_vor TIMESTAMPTZ,
            vorgemerkt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            bearbeitet_am TIMESTAMPTZ,
            erledigt_am TIMESTAMPTZ,
            text TEXT,
            kosten_cents INTEGER,
            log_id BIGINT
          )`;
        // Nachbesserung 19.10.2026: der Verlaufseintrag des Ergebnisses (für „Irrtümlich?“).
        await tx`ALTER TABLE fiaon_mara_nacharbeit ADD COLUMN IF NOT EXISTS log_id BIGINT`;
        await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_mara_nacharbeit_offen_je_person ON fiaon_mara_nacharbeit (person_id) WHERE status IN ('vorgemerkt', 'in_arbeit')`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_nacharbeit_status ON fiaon_mara_nacharbeit (status, nicht_vor)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_nacharbeit_person ON fiaon_mara_nacharbeit (person_id, vorgemerkt_am DESC)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_nacharbeit_log ON fiaon_mara_nacharbeit (log_id) WHERE log_id IS NOT NULL`;
      });
      return true;
    })().catch((e) => {
      console.error("[MARA-NACHARBEIT] Merker-Tabelle nicht bereit — Nacharbeit ruht:", e?.message || e);
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/** Der Schalter (fiaon_settings.mara_nacharbeit_mail). Fehlt er: AN. Lesefehler: AUS (lieber keine Mail). */
export async function schalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${NACHARBEIT_SCHALTER}`) as any[];
    return schalterAn(z?.value);
  } catch (e) {
    console.error("[MARA-NACHARBEIT] Schalter nicht lesbar — nichts vormerken:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function schalterSetzen(an: boolean): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${NACHARBEIT_SCHALTER}, ${an ? "an" : "aus"})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS DER SERVER ÜBER DEN MENSCHEN WEISS
// ═══════════════════════════════════════════════════════════════════════════
interface PersonLage {
  personDa: boolean;
  globalKunde: boolean;
  sperre: string | null;
  kuendigungOffen: boolean;
  heiklerAuftrag: string | null;
  hatEmail: boolean;
  letzteNacharbeitAm: Date | string | null;
}

/**
 * Sperren je Person. Jede Teilprüfung, die scheitert, urteilt VORSICHTIG (Global kaputt → Global, Sperre kaputt →
 * gesperrt, Adresse unklar → keine) — eine Mail zu wenig ist billiger als eine an den Falschen.
 */
async function personLage(personId: number, lauf: Lauf = sqlPool): Promise<PersonLage> {
  const [p] = (await lauf.unsafe(`
    SELECT p.id,
           ${KUENDIGUNG_UNGEBUCHT_SQL("p.id")} AS kuendigung_offen,
           (SELECT MAX(n.erledigt_am) FROM fiaon_mara_nacharbeit n WHERE n.person_id = p.id AND n.status = 'versandt') AS letzte
      FROM fiaon_persons p
     WHERE p.id = $1 AND p.merged_into_person_id IS NULL`, [personId])) as any[];
  if (!p) return { personDa: false, globalKunde: false, sperre: null, kuendigungOffen: false, heiklerAuftrag: null, hatEmail: false, letzteNacharbeitAm: null };
  const { istGlobalKunde } = await import("./fiaon-global-kunde");
  const { menschSperre, werbungVerboten } = await import("./fiaon-mail-frequenz");
  const { hatZustellbareMail } = await import("./fiaon-empfaenger");
  const globalKunde = await istGlobalKunde(personId).catch(() => true);
  const sperre = await menschSperre(personId, lauf).then((s) => werbungVerboten(s)).catch(() => "Sperrprüfung nicht möglich");
  const hatEmail = await hatZustellbareMail(personId, lauf).catch(() => false);
  let heiklerAuftrag: string | null = null;
  try {
    const { ensureAuftragSpalten, personenKreis } = await import("./fiaon-auftraege");
    await ensureAuftragSpalten();
    const kreis = await personenKreis(personId, lauf);
    const ids = kreis.ids.length ? kreis.ids : [personId];
    const [t] = (await lauf`
      SELECT art FROM fiaon_betreiber_todos
       WHERE person_id = ANY(${ids}::int[]) AND COALESCE(status, 'offen') <> 'erledigt'
         AND art = ANY(${HEIKLE_AUFTRAGSARTEN as unknown as string[]}::text[])
       ORDER BY id DESC LIMIT 1`) as any[];
    if (t?.art) {
      const { AUFTRAG_ARTEN } = await import("@shared/fiaon-auftrag-arten");
      heiklerAuftrag = (AUFTRAG_ARTEN as any)[t.art]?.label ?? String(t.art);
    }
  } catch (e) {
    console.error(`[MARA-NACHARBEIT] Aufträge von Person ${personId} nicht prüfbar — nichts senden:`, e instanceof Error ? e.message : e);
    heiklerAuftrag = "Aufträge nicht prüfbar";
  }
  return {
    personDa: true, globalKunde, sperre, kuendigungOffen: p.kuendigung_offen === true, heiklerAuftrag, hatEmail,
    letzteNacharbeitAm: p.letzte ?? null,
  };
}

/** Die offene Zahlung, die eine Zusage meint: die offene Erstzahlung (abgeschickter Antrag), sonst die älteste offene Rate. */
export interface OffeneZahlung { status: string; betrag: number | null; referenz: string; art: "bestellung" | "rate"; faellig: string | null }
export async function offeneZahlung(personId: number, lauf: Lauf = sqlPool): Promise<OffeneZahlung | null> {
  const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
  const [b] = (await lauf.unsafe(`
    SELECT a.payment_reference FROM fiaon_applications a
     WHERE a.person_id = $1 AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired') AND a.payment_reference IS NOT NULL
       AND a.mahnstopp_am IS NULL AND ${abgeschicktSql("a")}
     ORDER BY (COALESCE(a.amount_due, 0) > 0) DESC, a.created_at DESC
     LIMIT 1`, [personId])) as any[];
  if (b?.payment_reference) {
    const z = await zahlungsauftragFinden(String(b.payment_reference)).catch(() => null);
    if (z) return { status: z.status, betrag: Number(z.amountDue) || null, referenz: z.paymentReference, art: "bestellung", faellig: z.dueDate };
  }
  const { offeneRateFuerErinnerung } = await import("../routes/fiaon-abo");
  const r = await offeneRateFuerErinnerung(personId).catch(() => null);
  if (r?.zahlungsreferenz) {
    const z = await zahlungsauftragFinden(String(r.zahlungsreferenz)).catch(() => null);
    const status = z?.status === "pending_payment" || z?.status === "paid" || z?.status === "cancelled" ? z.status : "pending_payment";
    return { status, betrag: z ? Number(z.amountDue) || null : Number(r.betrag_cents) / 100, referenz: String(r.zahlungsreferenz), art: "rate", faellig: z?.dueDate ?? null };
  }
  return null;
}

/** Unterlagen, die in der Akte fehlen oder neu angefordert sind (für „Unterlagen“ ohne genaue Art). */
async function fehlendeUnterlagen(personId: number, lauf: Lauf = sqlPool): Promise<LinkArt[]> {
  try {
    const { artenStand } = await import("./fiaon-unterlagen-link");
    const st = await artenStand(personId, ["ausweis", "kontoauszug"], lauf);
    return (["ausweis", "kontoauszug"] as LinkArt[]).filter((a) => st[a]?.stand === "fehlt" || st[a]?.stand === "bitte_neu");
  } catch {
    return [];
  }
}

/** Steht der vereinbarte Rückruf (contact_log, „Rückruf vereinbart“) noch — nicht erledigt, nicht verworfen? */
async function rueckrufSteht(personId: number, am: Date, lauf: Lauf = sqlPool): Promise<boolean> {
  const [z] = (await lauf`
    SELECT EXISTS (SELECT 1 FROM fiaon_contact_log c
                    WHERE (c.person_id = ${personId} OR c.ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = ${personId}))
                      AND c.outcome = 'rueckruf_termin' AND c.done_at IS NULL AND c.voided_at IS NULL
                      AND c.scheduled_at = ${am}) AS steht`) as any[];
  return z?.steht === true;
}

/** Ein eingetragener künftiger Termin oder Rückruf — für Maras Zusammenfassung (und als gedeckte Zusage). */
async function naechsterTermin(personId: number, lauf: Lauf = sqlPool): Promise<Date | null> {
  const [z] = (await lauf`
    SELECT LEAST(
      (SELECT MIN(t.beginn) FROM fiaon_termine t WHERE t.person_id = ${personId} AND t.status = 'gebucht' AND t.beginn > NOW()),
      (SELECT MIN(c.scheduled_at) FROM fiaon_contact_log c
        WHERE (c.person_id = ${personId} OR c.ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = ${personId}))
          AND c.outcome = 'rueckruf_termin' AND c.done_at IS NULL AND c.voided_at IS NULL AND c.scheduled_at > NOW())) AS am`.catch(() => [{ am: null }])) as any[];
  return z?.am ? new Date(z.am) : null;
}

/** Nennform des Kollegen, der das Gespräch geführt hat — ohne Konto „unser Team“. */
async function mitarbeiterNennform(agentId: number | null, lauf: Lauf = sqlPool): Promise<{ nom: string; dat: string }> {
  if (agentId) {
    const [a] = (await lauf`SELECT anrede, first_name, last_name, name FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
    if (a) { const n = nennform(a); if (n.voll !== "jemand aus unserem Team") return { nom: n.nom, dat: n.dat }; }
  }
  return { nom: "unser Team", dat: "unserem Team" };
}

interface MerkerZeile {
  id: number; person_id: number; ref: string | null; art: string; ergebnis: string; notiz: string | null;
  zusage_tag: string | Date | null; termin_am: string | Date | null; unterlagen: string[] | null;
  agent_id: number | null; agent_name: string | null; vorgemerkt_am: string | Date;
  /** Der Verlaufseintrag des Ergebnisses (fiaon_contact_log.id) — null bei Merkern ohne Eintrag. */
  log_id?: number | string | null;
}

/** Stunde und Minute in Berlin (nur formatToParts — Zeit-Falle 01.09.2026). */
function berlinUhr(d: Date): { h: number; min: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  return { h: Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24, min: Number(p.find((x) => x.type === "minute")?.value ?? 0) };
}

const tagIso = (d: string | Date | null | undefined): string | null => {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : berlinTag(d);
  const m = String(d).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
};

/** Die vollständigen Fakten für das Urteil — beim Vormerken und noch einmal beim Senden. */
async function faktenFuer(m: Pick<MerkerZeile, "person_id" | "art" | "notiz" | "zusage_tag" | "termin_am" | "unterlagen" | "vorgemerkt_am" | "log_id">, lauf: Lauf = sqlPool): Promise<{ f: NacharbeitFakten; zahlung: OffeneZahlung | null }> {
  const pl = await personLage(m.person_id, lauf);
  // „Irrtümlich?“ am Verlaufseintrag des Ergebnisses → nichts senden. Eintrag weg oder nicht lesbar: vorsichtig = gestrichen.
  let ergebnisGestrichen = false;
  if (m.log_id != null && Number(m.log_id) > 0) {
    const [e] = (await lauf`SELECT voided_at FROM fiaon_contact_log WHERE id = ${Number(m.log_id)}`.catch(() => [])) as any[];
    ergebnisGestrichen = !e || e.voided_at != null;
  }
  const art = istNacharbeitArt(m.art) ? m.art : null;
  let zahlung: OffeneZahlung | null = null;
  let terminSteht = false;
  if (pl.personDa && art === "zusage") {
    zahlung = await offeneZahlung(m.person_id, lauf).catch(() => null);
    // Nichts mehr offen, weil er seit dem Gespräch bezahlt hat? Dann ist die Zusage erledigt — kein „keine offene Zahlung“.
    if (!zahlung && m.vorgemerkt_am) {
      const seit = new Date(new Date(m.vorgemerkt_am).getTime() - 3_600_000);
      const [b] = (await lauf`
        SELECT (EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${m.person_id} AND a.payment_status = 'paid' AND a.paid_at >= ${seit})
             OR EXISTS (SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
                         WHERE a.person_id = ${m.person_id} AND r.bezahlt_am >= ${seit})) AS bezahlt`.catch(() => [{ bezahlt: false }])) as any[];
      if (b?.bezahlt === true) zahlung = { status: "paid", betrag: null, referenz: "", art: "bestellung", faellig: null };
    }
  }
  if (pl.personDa && art === "termin" && m.termin_am) terminSteht = await rueckrufSteht(m.person_id, new Date(m.termin_am), lauf).catch(() => false);
  return {
    zahlung,
    f: {
      ...pl, art, ergebnisGestrichen,
      notizHeikel: heikleNotiz(m.notiz),
      zahlung: zahlung ? { status: zahlung.status, betrag: zahlung.betrag } : null,
      zusageTag: tagIso(m.zusage_tag),
      terminAm: m.termin_am ?? null,
      terminSteht,
      unterlagen: (m.unterlagen ?? []).filter(istLinkArt),
      vorgemerktAm: m.vorgemerkt_am ?? null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. VORMERKEN — nach jedem Gesprächsergebnis
// ═══════════════════════════════════════════════════════════════════════════
export interface NacharbeitEingabe {
  personId: number;
  /** Die Bestellung, an der der Verlauf hängt (schreib_ref) — für den Vermerk in der Akte. */
  ref: string | null;
  ergebnis: string;
  notiz?: string | null;
  /** „Zahlt am …“: JJJJ-MM-TT. */
  zusageDatum?: string | null;
  /** „Rückruf“: Berliner Wandzeit „JJJJ-MM-TTTHH:MM:SS“ (wie ergebnisNachbereiten). */
  terminZeitpunkt?: string | null;
  akteur: { id: number | null; name: string };
  /** Das Häkchen „Mara schickt die Zusammenfassung“ — nur `true` merkt vor. */
  gewaehlt: boolean;
  /**
   * Das Häkchen stand zur Wahl und wurde BEWUSST abgewählt (Kundenkarte/Akte schicken dann `maraNacharbeit: false`;
   * das Telefon und eine noch ladende Vorschau schicken nichts). Nimmt eine wartende Mail zurück — auch beim gleichen Ergebnis.
   */
  abgewaehlt?: boolean;
  /** Der Verlaufseintrag dieses Ergebnisses (ergebnisNachbereiten → logId) — „Irrtümlich?“ daran nimmt die Mail zurück. */
  logId?: number | null;
}

export interface NacharbeitWirkung {
  art: NacharbeitArt | null;
  urteil: NacharbeitUrteil | null;
  /** Der Satz für den Mitarbeiter (hängt an der Meldung) — null: nichts zu sagen. */
  hinweis: string | null;
  /** Eine wartende Mail wurde durch dieses Ergebnis zurückgenommen oder ersetzt. */
  ersetzt?: boolean;
}

/**
 * Nach dem Buchen eines Gesprächsergebnisses: mit Häkchen vormerken (oder sagen, warum nicht); ohne Häkchen eine
 * wartende Mail zurücknehmen, wenn dieses Ergebnis sie berichtigt. Wirft nie.
 */
export async function nacharbeitNachErgebnis(ein: NacharbeitEingabe, jetzt: Date = new Date()): Promise<NacharbeitWirkung> {
  const nichts: NacharbeitWirkung = { art: null, urteil: null, hinweis: null };
  const pid = Number(ein.personId);
  if (!Number.isInteger(pid) || pid <= 0 || !ein.ergebnis) return nichts;
  try {
    if (!(await nacharbeitTabelle())) return nichts;
    if (!ein.gewaehlt || !ERGEBNISSE_MIT_NACHARBEIT.includes(ein.ergebnis)) {
      // Berichtigung — die wartende Mail geht zurück, wenn
      //   · eine heikle Notiz kommt (Kündigung, Beschwerde, Anwalt …) — egal, wie alt die wartende ist;
      //   · das Häkchen BEWUSST abgewählt ist (auch beim gleichen Ergebnis) — egal, wie alt;
      //   · ein ANDERES Ergebnis binnen KORREKTUR_MINUTEN kommt.
      // Dasselbe Ergebnis ohne Wahl (Telefon UND Akte, derselbe Anruf zweimal gebucht) lässt die Mail stehen.
      const heikel = heikleNotiz(ein.notiz);
      const abgewaehlt = ein.abgewaehlt === true && ERGEBNISSE_MIT_NACHARBEIT.includes(ein.ergebnis);
      const grund = heikel
        ? `zurückgenommen: neueres Ergebnis mit heikler Notiz (${heikel})`
        : abgewaehlt ? `zurückgenommen: Häkchen bei „${ein.ergebnis}“ bewusst aus` : `berichtigt: neueres Ergebnis „${ein.ergebnis}“ ohne Häkchen`;
      const weg = (await sqlPool`
        UPDATE fiaon_mara_nacharbeit
           SET status = 'zurueckgenommen', grund = ${grund}, erledigt_am = NOW()
         WHERE person_id = ${pid} AND status = 'vorgemerkt'
           AND (${heikel !== null}::boolean OR ${abgewaehlt}::boolean
                OR (ergebnis <> ${ein.ergebnis} AND vorgemerkt_am > ${new Date(jetzt.getTime() - KORREKTUR_MINUTEN * 60_000)}))
        RETURNING id`) as any[];
      if (!weg.length) return nichts;
      const hinweis = heikel
        ? `Maras wartende Zusammenfassung ist zurückgenommen (${heikel}).`
        : abgewaehlt ? "Häkchen aus: Maras wartende Zusammenfassung ist zurückgenommen." : "Maras wartende Zusammenfassung ist zurückgenommen (neues Ergebnis).";
      return { ...nichts, ersetzt: true, hinweis };
    }
    if (!(await schalterLesen())) return nichts;

    const notiz = ein.notiz ? String(ein.notiz).trim().slice(0, 2000) : null;
    // „Unterlagen“ ohne genaue Art: die fehlenden (Ausweis, Kontoauszug) aus der Akte.
    const allgemein = (unterlagenAusNotiz(notiz) ?? []).includes("allgemein");
    const fehlende = ein.ergebnis === "erreicht_sonstiges" && allgemein ? await fehlendeUnterlagen(pid) : [];
    const art = nacharbeitArt(ein.ergebnis, notiz, fehlende);
    if (!art) return nichts;
    const zusageTag = art === "zusage"
      ? (ein.ergebnis === "erreicht_zahlt_am" && /^\d{4}-\d{2}-\d{2}$/.test(String(ein.zusageDatum || "")) ? String(ein.zusageDatum) : berlinTag(jetzt))
      : null;
    let terminAm: Date | null = null;
    if (art === "termin" && ein.terminZeitpunkt) {
      const { parseBerlinInput } = await import("./fiaon-time");
      terminAm = parseBerlinInput(String(ein.terminZeitpunkt));
    }
    const unterlagen = art === "unterlagen" ? unterlagenFuerLink(notiz, fehlende) : null;
    const { f } = await faktenFuer({ person_id: pid, art, notiz, zusage_tag: zusageTag, termin_am: terminAm, unterlagen, vorgemerkt_am: jetzt });
    const u = nacharbeitUrteil(f, jetzt);
    const offen = u.art === "senden" || u.art === "warten";

    // Ein neueres Ergebnis mit Häkchen ersetzt die wartende Mail (nie zwei) — auch, wenn nach ihm nichts mehr rausgeht
    // (das neuere Gespräch weiß es besser: heikles Thema, inzwischen bezahlt, Rückruf vorbei).
    const ersetzt = ((await sqlPool`
      UPDATE fiaon_mara_nacharbeit SET status = 'ersetzt', grund = 'durch ein neueres Ergebnis ersetzt', erledigt_am = NOW()
       WHERE person_id = ${pid} AND status = 'vorgemerkt' RETURNING id`) as any[]).length > 0;
    const zeile = {
      person_id: pid, ref: ein.ref ?? null, art, ergebnis: ein.ergebnis, notiz,
      zusage_tag: zusageTag, termin_am: terminAm, unterlagen,
      agent_id: ein.akteur.id ?? null, agent_name: String(ein.akteur.name || "").slice(0, 120) || null,
      log_id: Number.isInteger(Number(ein.logId)) && Number(ein.logId) > 0 ? Number(ein.logId) : null,
      status: offen ? "vorgemerkt" : "ausgelassen",
      grund: u.art === "senden" ? null : u.grund,
      nicht_vor: u.art === "warten" ? u.nichtVor : null,
      vorgemerkt_am: jetzt,
      erledigt_am: offen ? null : jetzt,
    };
    const neu = (await sqlPool`
      INSERT INTO fiaon_mara_nacharbeit ${sqlPool(zeile as any)}
      ON CONFLICT (person_id) WHERE status IN ('vorgemerkt', 'in_arbeit') DO NOTHING
      RETURNING id`) as any[];
    if (!neu.length) {
      // Eine Mail an ihn ist gerade unterwegs (in_arbeit) — keine zweite.
      return { art, urteil: { art: "auslassen", grund: "eine Zusammenfassung an ihn ist gerade unterwegs" }, hinweis: "Mara schickt gerade schon eine Zusammenfassung an ihn — keine zweite." };
    }
    return { art, urteil: u, hinweis: hinweisFuerMitarbeiter(u, art, jetzt), ersetzt };
  } catch (e) {
    console.error(`[MARA-NACHARBEIT] Vormerken für Person ${pid}:`, e instanceof Error ? e.message : e);
    return nichts;
  }
}

/**
 * „Irrtümlich?“ am Verlaufseintrag (POST /agent/log/:id/void): eine dazu noch wartende Mail zurücknehmen.
 * Der Satz für den Mitarbeiter, oder null (nichts wartete). Wirft nie. Ist die Mail schon unterwegs, prüft der Takt
 * den Eintrag beim Senden noch einmal (faktenFuer → ergebnisGestrichen).
 */
export async function nacharbeitZuEintragZuruecknehmen(logId: number): Promise<string | null> {
  const id = Number(logId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    if (!(await nacharbeitTabelle())) return null;
    const weg = (await sqlPool`
      UPDATE fiaon_mara_nacharbeit
         SET status = 'zurueckgenommen', grund = ${GRUND.gestrichen}, erledigt_am = NOW()
       WHERE log_id = ${id} AND status = 'vorgemerkt'
      RETURNING id`) as any[];
    return weg.length ? "Maras wartende Zusammenfassung an den Kunden ist zurückgenommen." : null;
  } catch (e) {
    console.error(`[MARA-NACHARBEIT] Zurücknehmen zu Eintrag ${id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VORSCHAU FÜRS HÄKCHEN (GET /agent/crm/kunden/:personId/mara-nacharbeit)
// ═══════════════════════════════════════════════════════════════════════════
export async function vorschauDaten(personId: number, jetzt: Date = new Date()): Promise<NacharbeitVorschauDaten> {
  const an = await schalterLesen();
  if (!an || !(await nacharbeitTabelle())) return { an: false, sperrGrund: null, betrag: null, zahlungGrund: null, fehlende: [] };
  const pl = await personLage(personId);
  // Dieselbe Regel wie beim Vormerken, ohne Art-Teil: Was an der PERSON hängt, sagt die Zeile vorher.
  const u = nacharbeitUrteil({ ...pl, art: "gespraech", notizHeikel: null, vorgemerktAm: new Date(0) }, jetzt);
  const sperrGrund = u.art === "auslassen" ? u.grund : null;
  let betrag: string | null = null;
  let zahlungGrund: string | null = null;
  if (!sperrGrund) {
    const z = await offeneZahlung(personId).catch(() => null);
    // Ohne Tag: hier zählt nur die ZAHLUNG. Ob der Tag bis zum Versand vorbei wäre, rechnet die Vorschau mit dem
    // gewählten Tag (zuSpaetGrund) — sonst sperrte „heute“ um 20:30 auch „Zahlt am Donnerstag“.
    const zu = nacharbeitUrteil({ ...pl, art: "zusage", notizHeikel: null, zahlung: z ? { status: z.status, betrag: z.betrag } : null, zusageTag: null, vorgemerktAm: new Date(0) }, jetzt);
    if (zu.art === "auslassen" || zu.art === "erledigt") zahlungGrund = zu.grund;
    else betrag = betragText(z?.betrag ?? null);
  }
  const fehlende = sperrGrund ? [] : await fehlendeUnterlagen(personId);
  return { an: true, sperrGrund, betrag, zahlungGrund, fehlende };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SENDEN — der Takt
// ═══════════════════════════════════════════════════════════════════════════
export interface TaktErgebnis {
  aus: boolean;
  versandt: number; fehlgeschlagen: number; ausgelassen: number; erledigt: number; wartet: number; verfallen: number; unklar: number;
}
const LEER_TAKT = (): TaktErgebnis => ({ aus: false, versandt: 0, fehlgeschlagen: 0, ausgelassen: 0, erledigt: 0, wartet: 0, verfallen: 0, unklar: 0 });
export const istBearbeitet = (e: TaktErgebnis) => e.versandt + e.fehlgeschlagen + e.ausgelassen + e.erledigt + e.wartet + e.verfallen + e.unklar > 0;

/** Maras Zusammenfassung schreiben — austauschbar für den Prüfstand. */
export type KiSchreiber = (nachrichten: { role: string; content: string }[], personId: number) => Promise<{ roh: any; kostenCents: number }>;
const kiStandard: KiSchreiber = async (nachrichten, personId) => {
  const { kiAufruf, antwortLesen, MODELL } = await import("./fiaon-postmeister-agent");
  const { kostenCentsAus } = await import("./fiaon-postmeister-schema");
  const j = await kiAufruf({ dienst: "mara-nacharbeit", modell: MODELL(), aufwand: "low", maxTokens: 3000, schema: GESPRAECH_SCHEMA, nachrichten, person: personId });
  return { roh: antwortLesen(j, "Mara-Nacharbeit"), kostenCents: kostenCentsAus(MODELL(), (j as any)?.usage) };
};

async function merkerSetzen(id: number, status: MerkerStatus, grund: string | null, extra: { nichtVor?: Date | null; text?: string | null; kosten?: number } = {}): Promise<void> {
  const fertig = status !== "vorgemerkt" && status !== "in_arbeit";
  await sqlPool`
    UPDATE fiaon_mara_nacharbeit
       SET status = ${status}, grund = ${grund ? String(grund).slice(0, 500) : null}, nicht_vor = ${extra.nichtVor ?? null},
           erledigt_am = ${fertig ? new Date() : null},
           text = COALESCE(${extra.text ?? null}, text),
           kosten_cents = COALESCE(kosten_cents, 0) + ${Math.max(0, Math.round(extra.kosten ?? 0))}
     WHERE id = ${id}`;
}

/** Vermerk in der Akte (nur, wenn Mara wegen des Häkchens etwas NICHT tat — das Gesendete vermerkt der Versandweg). */
async function akteVermerk(m: MerkerZeile, text: string): Promise<void> {
  const ref = m.ref || ((await sqlPool`SELECT ref FROM fiaon_applications WHERE person_id = ${m.person_id} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[])[0]?.ref;
  if (!ref) return;
  await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                VALUES (${ref}, ${m.person_id}, NULL, 'Mara', 'system', ${text.slice(0, 1500)}, NOW())`.catch((e) =>
    console.error("[MARA-NACHARBEIT] Akte-Vermerk:", e instanceof Error ? e.message : e));
}

/** Die gemeinsame Nutzlast (Adresse, Name, Nennform) — dieselbe Auflösung wie jede Mail des Hauses. */
async function grundNutzlast(m: MerkerZeile): Promise<{ nutzlast: Record<string, unknown>; ref: string | null; ma: { nom: string; dat: string }; namen: string[] } | { fehler: string }> {
  const { sendePayloadBauen } = await import("./fiaon-mail-senden");
  const g = await sendePayloadBauen(NACHARBEIT_EVENT, m.person_id);
  if (!g || g.fehler) return { fehler: g?.fehler ?? "Kunde nicht gefunden" };
  const ma = await mitarbeiterNennform(m.agent_id);
  const vor = String((g.basis as any).vorname ?? "").trim();
  const nach = String((g.basis as any).nachname ?? "").trim();
  const nutzlast: Record<string, unknown> = { ...g.basis, ...g.links, person_id: m.person_id };
  // Was zur Bestellung gehört, sagt hier nichts — die Zusage setzt ihre eigenen Werte.
  delete nutzlast.betrag; delete nutzlast.payment_reference; delete nutzlast.paket;
  Object.assign(nutzlast, {
    einstieg: `Guten Tag${vor || nach ? ` ${[vor, nach].filter(Boolean).join(" ")}` : ""}`,
    mitarbeiter: ma.nom, mitarbeiter_dat: ma.dat,
  });
  return { nutzlast, ref: m.ref ?? g.ref ?? null, ma, namen: [vor, nach, `${vor} ${nach}`.trim()].filter(Boolean) };
}

/** Eine fertige Mail rendern und als Kundentext prüfen. Leer = darf raus. */
async function mailPruefen(nutzlast: Record<string, unknown>, opt: Parameters<typeof nacharbeitTextPruefen>[1]): Promise<{ maengel: string[]; text: string }> {
  const { mailRendern } = await import("../mail/motor");
  const mail = mailRendern(NACHARBEIT_EVENT, nutzlast);
  if (!mail) return { maengel: ["Vorlage fehlt im Motor"], text: "" };
  if (mail.fehlend.length) return { maengel: [`Platzhalter ohne Wert: ${mail.fehlend.join(", ")}`], text: mail.text };
  // Geprüft wird, was der Kunde von UNS liest: Betreff und Text bis zum Fuß des Gerüsts (der Fuß ist Hausrecht, kein Inhalt).
  const fussAb = mail.text.search(/\n—\n|\nFIAON LTD\b|\nFIAON ist keine|\nDiese Nachricht wurde automatisch/);
  const kern = `${mail.betreff}\n${fussAb > 0 ? mail.text.slice(0, fussAb) : mail.text}`;
  const { mitarbeiterListe } = await import("./fiaon-mitarbeiter-namen");
  const mitarbeiter = await mitarbeiterListe().catch(() => []);
  return { maengel: nacharbeitTextPruefen(kern, { ...opt, mitarbeiter }), text: kern };
}

async function versenden(m: MerkerZeile, nutzlast: Record<string, unknown>, ref: string | null, verlaufText: string): Promise<{ status: string; grund: string | null }> {
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  const erg = await versendenUndProtokollieren(NACHARBEIT_EVENT as any, nutzlast as any, { personId: m.person_id, verlaufRef: ref, verlaufText });
  return { status: erg.status, grund: erg.grund ?? null };
}

/** Einen genommenen Merker abarbeiten — die Regel noch einmal, dann senden oder abschließen. */
async function nacharbeitEinen(m: MerkerZeile, jetzt: Date, e: TaktErgebnis, ki: KiSchreiber): Promise<void> {
  const { f, zahlung } = await faktenFuer(m);
  const u = nacharbeitUrteil(f, jetzt);
  if (u.art === "warten") { await merkerSetzen(m.id, "vorgemerkt", u.grund, { nichtVor: u.nichtVor }); e.wartet++; return; }
  // „Irrtümlich?“ am Ergebnis: zurückgenommen (den Vermerk schreibt die Route selbst).
  if (u.art === "auslassen" && u.grund === GRUND.gestrichen) { await merkerSetzen(m.id, "zurueckgenommen", u.grund); e.ausgelassen++; return; }
  if (u.art === "erledigt") {
    // Das Häkchen war an — die Akte sagt, warum nichts kam (bezahlt, Tag vorbei, Rückruf verworfen oder gleich dran).
    await merkerSetzen(m.id, "erledigt", u.grund); e.erledigt++;
    await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt: ${u.grund}.`);
    return;
  }
  if (u.art === "auslassen") {
    await merkerSetzen(m.id, "ausgelassen", u.grund); e.ausgelassen++;
    await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt: ${u.grund}.`);
    return;
  }
  const art = f.art as NacharbeitArt;

  // ── UNTERLAGEN: die bestehende Bitte mit dem Upload-Link ohne Anmeldung ──
  if (art === "unterlagen") {
    const arten = (f.unterlagen ?? []) as LinkArt[];
    const ma = await mitarbeiterNennform(m.agent_id);
    const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
    const r = await unterlagenAnfrageSenden({
      personId: m.person_id, arten, kanaele: ["mail"], quelle: "mara_nacharbeit",
      anlassSatz: `Wie im Gespräch mit ${ma.dat} besprochen: Über den Knopf laden Sie alles ganz einfach hoch.`,
      akteur: { name: "Mara (Nacharbeit)", agentId: null, rolle: "admin" },
    });
    if (r.ok) {
      await merkerSetzen(m.id, "versandt", null, { text: `Unterlagen-Bitte mit Upload-Link: ${arten.map((a) => LINK_ART_TEXT[a].titel).join(", ")}` });
      e.versandt++;
      const { ereignisMelden } = await import("./fiaon-auftraege");
      await ereignisMelden({ ereignis: "unterlage_angefordert", personId: m.person_id, ref: m.ref, akteur: { id: null, name: "Mara" }, detail: arten.map((a) => LINK_ART_TEXT[a].titel).join(", ") }).catch(() => null);
    } else {
      await merkerSetzen(m.id, r.status === "abgelehnt" ? "ausgelassen" : "fehlgeschlagen", r.meldung);
      if (r.status === "abgelehnt") { e.ausgelassen++; await akteVermerk(m, `Mara hat nach dem Gespräch keinen Upload-Link geschickt: ${r.meldung}`); } else e.fehlgeschlagen++;
    }
    return;
  }

  const g = await grundNutzlast(m);
  if ("fehler" in g) { await merkerSetzen(m.id, "fehlgeschlagen", g.fehler); e.fehlgeschlagen++; return; }
  const { nutzlast, ref, ma, namen } = g;
  nutzlast.nacharbeit_art = art;
  let verlaufText = "";
  let kosten = 0;
  /** Maras eigene Zeilen (nur „Gespräch“) — sie werden zusätzlich streng geprüft. */
  let kiTeil: string | null = null;
  let pruefOpt: Parameters<typeof nacharbeitTextPruefen>[1] = { kundeNamen: namen, notiz: m.notiz };

  if (art === "zusage") {
    const { absoluteUrl } = await import("../fiaon-base-url");
    const tag = f.zusageTag ?? berlinTag(jetzt);
    const heute = tag === berlinTag(jetzt);
    const tagText = datumFuerKunde(new Date(`${tag}T12:00:00Z`));
    Object.assign(nutzlast, {
      betrag: Number(zahlung!.betrag).toFixed(2),
      zusage_wann: heute ? "heute" : `bis ${tagText}`,
      zusage_tag: heute ? `heute, ${tagText}` : `bis ${tagText}`,
      verwendungszweck: zahlung!.referenz,
      zahlung_url: absoluteUrl(`/zahlung/${encodeURIComponent(zahlung!.referenz)}`),
    });
    verlaufText = `Mara: Zahlungszusage nach dem Gespräch mit ${ma.dat} per Mail bestätigt — ${betragText(zahlung!.betrag)} ${heute ? "heute" : `bis ${kurzDatum(tag)}`}, Verwendungszweck ${zahlung!.referenz}, mit Zahlungsseite.`;
  } else if (art === "termin") {
    const am = new Date(f.terminAm as any);
    const z = berlinUhr(am);
    Object.assign(nutzlast, { termin_datum: datumFuerKunde(am), termin_uhrzeit: uhrText(z.h, z.min) });
    // Der Rückruf steht im Kalender (contact_log mit scheduled_at) — „ruft Sie an“ ist eine gedeckte Zusage.
    pruefOpt = { ...pruefOpt, gedeckt: ["notiz_an_betreuer"] };
    verlaufText = `Mara: Rückruf ${kurzDatum(berlinTag(am))}, ${uhrText(z.h, z.min)} nach dem Gespräch mit ${ma.dat} per Mail bestätigt.`;
  } else {
    // ── GESPRÄCH: Mara schreibt aus der Notiz, der Server prüft ──
    const { kiPausiert, istKiPause } = await import("./fiaon-ki-pause");
    if (await kiPausiert().catch(() => false)) {
      await merkerSetzen(m.id, "vorgemerkt", "KI-Pause — Mara schreibt, sobald sie wieder läuft", { nichtVor: new Date(jetzt.getTime() + KI_PAUSE_WARTEN_MINUTEN * 60_000) });
      e.wartet++;
      return;
    }
    const termin = await naechsterTermin(m.person_id);
    const ein = {
      notiz: String(m.notiz || ""), mitarbeiterNom: ma.nom, mitarbeiterDat: ma.dat,
      heute: datumFuerKunde(jetzt), termin: termin ? zeitFuerKunde(termin, jetzt) : null,
    };
    const nachrichten = [{ role: "system", content: GESPRAECH_AUFTRAG }, { role: "user", content: gespraechNachricht(ein) }];
    if (termin) pruefOpt = { ...pruefOpt, gedeckt: ["notiz_an_betreuer"] };
    const fuellen = (absaetze: string[]) => {
      const felder = ["absatz1_html", "absatz2_html", "absatz3_html"] as const;
      for (let i = 0; i < felder.length; i++) nutzlast[felder[i]] = absaetze[i] ? htmlSicher(absaetze[i]) : "";
    };
    let absaetze: string[] = [];
    try {
      const r1 = await ki(nachrichten, m.person_id);
      kosten += r1.kostenCents;
      if (r1.roh?.senden !== true) {
        const grund = `Mara: nichts zu schreiben — ${String(r1.roh?.grund || "die Notiz enthält nichts für den Kunden").slice(0, 200)}`;
        await merkerSetzen(m.id, "ausgelassen", grund, { kosten }); e.ausgelassen++;
        await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt (${grund.replace(/^Mara: /, "")}).`);
        return;
      }
      absaetze = absaetzeAus(r1.roh?.absaetze);
      fuellen(absaetze);
      let p = await mailPruefen(nutzlast, { ...pruefOpt, kiTeil: absaetze.join("\n") });
      if (!absaetze.length) p = { ...p, maengel: ["Zusammenfassung leer"] };
      if (p.maengel.length) {
        // EINMAL neu schreiben — mit den Mängeln (wie der Postmeister). Hält auch das nicht, geht nichts raus.
        const r2 = await ki([...nachrichten, { role: "user", content: `Deine Zusammenfassung hat diese Mängel:\n${p.maengel.map((x) => `· ${x}`).join("\n")}\n\nSchreib sie neu — dasselbe Besprochene, ohne die Mängel. Nichts erfinden.` }], m.person_id);
        kosten += r2.kostenCents;
        const neu = r2.roh?.senden === true ? absaetzeAus(r2.roh?.absaetze) : [];
        fuellen(neu);
        const p2 = await mailPruefen(nutzlast, { ...pruefOpt, kiTeil: neu.join("\n") });
        if (!neu.length || p2.maengel.length) {
          const grund = `Prüfung: ${(neu.length ? p2.maengel : p.maengel).slice(0, 2).join("; ")}`;
          await merkerSetzen(m.id, "ausgelassen", grund, { kosten }); e.ausgelassen++;
          await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt — ihr Text bestand die Prüfung nicht (${grund.slice(9, 300)}).`);
          return;
        }
        absaetze = neu;
      }
    } catch (err) {
      if (istKiPause(err)) {
        await merkerSetzen(m.id, "vorgemerkt", "KI-Pause — Mara schreibt, sobald sie wieder läuft", { nichtVor: new Date(jetzt.getTime() + KI_PAUSE_WARTEN_MINUTEN * 60_000), kosten });
        e.wartet++;
        return;
      }
      await merkerSetzen(m.id, "fehlgeschlagen", `Modell: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300), { kosten }); e.fehlgeschlagen++;
      return;
    }
    kiTeil = absaetze.join("\n");
    verlaufText = `Mara: kurze Zusammenfassung des Gesprächs mit ${ma.dat} verschickt: „${absaetze.join(" ").slice(0, 600)}“`;
  }

  // ── Der ganze Kundentext geht durch die Prüfung (auch die festen Fassungen) ──
  const pr = await mailPruefen(nutzlast, { ...pruefOpt, kiTeil });
  if (pr.maengel.length) {
    await merkerSetzen(m.id, "ausgelassen", `Prüfung: ${pr.maengel.slice(0, 2).join("; ")}`, { kosten }); e.ausgelassen++;
    await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt — die Prüfung fand: ${pr.maengel[0]}.`);
    return;
  }
  const erg = await versenden(m, nutzlast, ref, verlaufText);
  if (erg.status === "versandt") { await merkerSetzen(m.id, "versandt", null, { text: pr.text.slice(0, 4000), kosten }); e.versandt++; return; }
  // Die Frequenzbremse hält nur auf — dann später noch einmal (bis VERFALL_STUNDEN), sonst ist es ein echtes Nein.
  // Wäre die Mail bis dahin überholt (Zusage-Tag vorbei, Rückruf dran), gleich auslassen — mit Vermerk.
  if (/^Frequenzbremse/.test(String(erg.grund ?? ""))) {
    const spaeter = new Date(jetzt.getTime() + 2 * 3_600_000);
    const spaet = zuSpaetGrund(f, imVersandfenster(spaeter) ? spaeter : naechstesFenster(spaeter), !imVersandfenster(spaeter));
    if (spaet) {
      await merkerSetzen(m.id, "ausgelassen", `${erg.grund} · ${spaet}`, { kosten }); e.ausgelassen++;
      await akteVermerk(m, `Mara hat nach dem Gespräch keine Zusammenfassung geschickt: ${spaet}.`);
      return;
    }
    await merkerSetzen(m.id, "vorgemerkt", erg.grund, { nichtVor: spaeter, kosten }); e.wartet++;
    return;
  }
  // Ein Nein der Tür (Sperre, Global-Wand, keine Adresse) ist bewusst nicht gesendet — kein Zustellfehler.
  const tuerNein = erg.status === "uebersprungen" || /^(Sperre:|FIAON Global|Keine (E-Mail-)?Adresse|Kein Empfänger)/i.test(String(erg.grund ?? ""));
  await merkerSetzen(m.id, tuerNein ? "ausgelassen" : "fehlgeschlagen", erg.grund, { kosten });
  if (tuerNein) e.ausgelassen++; else e.fehlgeschlagen++;
}

/**
 * Der Takt (alle 2 Minuten, routes.ts): Hängengebliebenes → „unklar“, zu lange Wartendes → „verfallen“, dann im
 * Fenster 08–20 Uhr bis zu `hoechstens` fällige Merker abarbeiten.
 */
export async function nacharbeitTakt(opts: { jetzt?: Date; hoechstens?: number; ki?: KiSchreiber } = {}): Promise<TaktErgebnis> {
  const e = LEER_TAKT();
  const jetzt = opts.jetzt ?? new Date();
  if (!(await nacharbeitTabelle())) return e;
  if (!(await schalterLesen())) { e.aus = true; return e; }
  const haengt = (await sqlPool`
    UPDATE fiaon_mara_nacharbeit
       SET status = 'unklar', grund = 'Beim Senden unterbrochen — wird nicht wiederholt (nie doppelt)', erledigt_am = NOW()
     WHERE status = 'in_arbeit' AND bearbeitet_am < NOW() - INTERVAL '30 minutes'
    RETURNING id`) as any[];
  e.unklar += haengt.length;
  const alt = (await sqlPool`
    UPDATE fiaon_mara_nacharbeit
       SET status = 'verfallen', grund = COALESCE(grund || ' · ', '') || 'zu lange gewartet', erledigt_am = NOW()
     WHERE status = 'vorgemerkt' AND vorgemerkt_am < ${new Date(jetzt.getTime() - VERFALL_STUNDEN * 3_600_000)}
    RETURNING id`) as any[];
  e.verfallen += alt.length;
  if (!imVersandfenster(jetzt)) return e;
  const n = Math.max(1, Math.min(50, Math.floor(opts.hoechstens ?? 20)));
  const faellig = (await sqlPool`
    UPDATE fiaon_mara_nacharbeit SET status = 'in_arbeit', bearbeitet_am = NOW()
     WHERE id IN (
       SELECT id FROM fiaon_mara_nacharbeit
        WHERE status = 'vorgemerkt' AND (nicht_vor IS NULL OR nicht_vor <= ${jetzt})
        ORDER BY vorgemerkt_am
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED)
    RETURNING id, person_id, ref, art, ergebnis, notiz, zusage_tag, termin_am, unterlagen, agent_id, agent_name, vorgemerkt_am, log_id`) as any[];
  for (const z of faellig) {
    const m = { ...z, id: Number(z.id), person_id: Number(z.person_id), agent_id: z.agent_id == null ? null : Number(z.agent_id) } as MerkerZeile;
    try {
      await nacharbeitEinen(m, jetzt, e, opts.ki ?? kiStandard);
    } catch (err) {
      console.error(`[MARA-NACHARBEIT] Merker ${m.id} (Person ${m.person_id}):`, err instanceof Error ? err.message : err);
      await merkerSetzen(m.id, "fehlgeschlagen", `Fehler: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
      e.fehlgeschlagen++;
    }
  }
  if (istBearbeitet(e)) {
    console.log(`[MARA-NACHARBEIT] Takt: ${e.versandt} versandt, ${e.wartet} wartet, ${e.ausgelassen} ausgelassen, ${e.erledigt} erledigt, ${e.fehlgeschlagen} fehlgeschlagen, ${e.verfallen} verfallen.`);
  }
  return e;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STAND FÜRS CHEFBÜRO (/chef/s/mara?reiter=termine, Schalter „Nach dem Anruf schickt Mara die Zusammenfassung“)
// ═══════════════════════════════════════════════════════════════════════════
export interface NacharbeitStand {
  an: boolean;
  eingerichtet: boolean;
  heute: number;
  woche: { versandt: number; ausgelassen: number; fehlgeschlagen: number; zurueck: number };
  /** Versandt in 7 Tagen je Art. */
  jeArt: Record<NacharbeitArt, number>;
  wartet: number;
  /** Die häufigsten Gründe fürs Auslassen (7 Tage). */
  gruende: { grund: string; n: number }[];
  /** KI-Kosten der Zusammenfassungen (7 Tage), in Cent. */
  kostenCents: number;
}

export async function nacharbeitStand(): Promise<NacharbeitStand> {
  const an = await schalterLesen();
  const eingerichtet = await nacharbeitTabelle();
  const jeArt = { zusage: 0, termin: 0, gespraech: 0, unterlagen: 0 } as Record<NacharbeitArt, number>;
  const leer: NacharbeitStand = { an, eingerichtet, heute: 0, woche: { versandt: 0, ausgelassen: 0, fehlgeschlagen: 0, zurueck: 0 }, jeArt, wartet: 0, gruende: [], kostenCents: 0 };
  if (!eingerichtet) return leer;
  const [z] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE status = 'versandt' AND erledigt_am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute,
      COUNT(*) FILTER (WHERE status = 'versandt' AND erledigt_am > NOW() - INTERVAL '7 days')::int AS versandt,
      COUNT(*) FILTER (WHERE status IN ('ausgelassen', 'erledigt', 'verfallen') AND erledigt_am > NOW() - INTERVAL '7 days')::int AS ausgelassen,
      COUNT(*) FILTER (WHERE status IN ('fehlgeschlagen', 'unklar') AND erledigt_am > NOW() - INTERVAL '7 days')::int AS fehlgeschlagen,
      COUNT(*) FILTER (WHERE status IN ('ersetzt', 'zurueckgenommen') AND erledigt_am > NOW() - INTERVAL '7 days')::int AS zurueck,
      COUNT(*) FILTER (WHERE status IN ('vorgemerkt', 'in_arbeit'))::int AS wartet,
      COALESCE(SUM(kosten_cents) FILTER (WHERE vorgemerkt_am > NOW() - INTERVAL '7 days'), 0)::int AS kosten
    FROM fiaon_mara_nacharbeit`) as any[];
  const arten = (await sqlPool`
    SELECT art, COUNT(*)::int AS n FROM fiaon_mara_nacharbeit
     WHERE status = 'versandt' AND erledigt_am > NOW() - INTERVAL '7 days' GROUP BY art`) as any[];
  for (const a of arten) if (istNacharbeitArt(a.art)) jeArt[a.art as NacharbeitArt] = Number(a.n);
  const gruende = (await sqlPool`
    SELECT grund, COUNT(*)::int AS n FROM fiaon_mara_nacharbeit
     WHERE status = 'ausgelassen' AND erledigt_am > NOW() - INTERVAL '7 days' AND grund IS NOT NULL
     GROUP BY grund ORDER BY n DESC LIMIT 4`) as any[];
  return {
    an, eingerichtet,
    heute: Number(z?.heute || 0),
    woche: { versandt: Number(z?.versandt || 0), ausgelassen: Number(z?.ausgelassen || 0), fehlgeschlagen: Number(z?.fehlgeschlagen || 0), zurueck: Number(z?.zurueck || 0) },
    jeArt,
    wartet: Number(z?.wartet || 0),
    gruende: gruende.map((r: any) => ({ grund: String(r.grund), n: Number(r.n) })),
    kostenCents: Number(z?.kosten || 0),
  };
}

export { ART_TEXT, DOPPELT_STUNDEN, GRUND };
