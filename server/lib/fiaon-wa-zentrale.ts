// ═══════════════════════════════════════════════════════════════════════════
// MARAS WHATSAPP-ZENTRALE (23.09.2026, E-229)
//
// Justin: „Mara muss ja eigentlich die ganze Zeit mit Kunden chatten — Kunden,
// die eine Zahlung offen haben, Leads, die keinen Antrag gestellt haben,
// Kunden, die im Antragsprozess abgebrochen haben. Ich muss das managen
// können: ein Knopf wie ‚WhatsApp starten (50)', dann wähle ich Kundengruppe
// und Vorlage. Oder eine Automatik: jede Stunde von 07:40 bis 20:45 schreibt
// Mara fünf Kunden an."
//
// ── WAS HIER ENTSCHIEDEN WIRD ──────────────────────────────────────────────
// Wer in welche Gruppe gehört, welche Vorlage zu welcher Gruppe passt und
// wann jemand in Ruhe gelassen wird. Gesendet wird ausschließlich über
// waSenden() — mit Wortwand, Inkasso-Wand, Platzhalter-Prüfung und der
// Bildfassung, sobald Meta sie freigegeben hat. Antworten übernimmt Mara wie
// bisher (fiaon-whatsapp-mara.ts).
//
// ── DIE REGELN, DIE IMMER GELTEN (Hand und Automatik gleich) ──────────────
//   · Nie nachts: nur zwischen 07:00 und 21:00 Berliner Zeit — die Automatik
//     zusätzlich nur in ihrem eigenen Fenster.
//   · Höchstens EINE Nachricht je Person und Tag, egal von wem.
//   · Abstand je Gruppe zur letzten Vorlage, höchstens acht Vorlagen je Person
//     in 30 Tagen.
//   · „STOPP" oder „Keine Nachrichten mehr" ist endgültig. Werbesperre,
//     Sperre, Testkonto, zusammengeführte Personen: nie.
//   · Wer bezahlt oder eine Zahlung gemeldet hat, bekommt nichts von hier.
//   · Eine Rechnung nur mit echtem Betrag (Katalogpreis) und echter Referenz.
//   · Nur Vorlagen, die Meta freigegeben hat (Text- oder Bildfassung).
//
// ── DIE MONATSRATE (E-230) ─────────────────────────────────────────────────
// fiaon_kk_rechnung verspricht die Aktivierung — bei Bestandskunden gelogen.
// Deshalb gibt es für sie eine eigene Vorlage (fiaon_kk_rate): welche Rate,
// wann fällig, welcher Verwendungszweck, Knopf zur Zahlungsseite genau dieser
// Rate. Gruppe „Monatsrate fällig": bezahlte Bestellung, Rate offen und fällig,
// nicht gekündigt, kein Abo-/Mahnstopp, keine Zahlungszusage offen, nicht
// eskaliert; höchstens alle 7 Tage und zweimal je Rate. Anfangs nur von Hand —
// die Automatik nimmt die Gruppe erst, wenn Justin sie dazuschaltet.
//
// ── DIE ALTE STUNDENKETTE ──────────────────────────────────────────────────
// Ist die Automatik hier AN, pausiert whatsappKetteLaufen() — sonst würde
// zweimal geschrieben und Justins „5 pro Stunde" wäre wertlos. Die
// Sofort-Begrüßung neuer Leads (ersteWhatsAppFuerLead) läuft unabhängig
// weiter: Speed-to-Lead ist der eine Hebel, den wir nie drosseln.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { WA_VORLAGEN } from "@shared/fiaon-lead-texte";
import { WHATSAPP_MOEGLICH_SQL, WHATSAPP_EINWILLIGUNG_SQL } from "@shared/fiaon-whatsapp-erlaubnis";

export type Gruppe = "neu" | "ohne_antrag" | "abbrecher" | "zahlung_offen" | "rate_offen";

export interface GruppenRegel {
  titel: string;
  satz: string;
  /** Vorlagen, die zu dieser Gruppe passen. „stufen" = je nach Tagen seit Eingang. */
  vorlagen: string[];
  standard: string;
  abstandTage: number;
}

export const GRUPPEN: Record<Gruppe, GruppenRegel> = {
  neu: {
    titel: "Neue Leads ohne Nachricht",
    satz: "Aus den letzten 30 Tagen, noch nie angeschrieben, noch kein Antrag.",
    vorlagen: ["fiaon_kk_anfrage", "fiaon_kk_tag1", "fiaon_kk_termin"],
    standard: "fiaon_kk_anfrage",
    abstandTage: 0,
  },
  ohne_antrag: {
    titel: "Leads ohne Antrag",
    satz: "Schon angeschrieben (vor mindestens 2 Tagen) oder älter als 30 Tage — bis heute kein Antrag.",
    vorlagen: ["stufen", "fiaon_kk_tag1", "fiaon_kk_tag3", "fiaon_kk_tag7", "fiaon_kk_letzte", "fiaon_kk_termin", "fiaon_kk_rueckfrage"],
    standard: "stufen",
    abstandTage: 2,
  },
  abbrecher: {
    titel: "Im Antrag abgebrochen",
    satz: "Antrag begonnen und gespeichert, aber nicht abgeschickt.",
    vorlagen: ["fiaon_kk_antrag_offen", "fiaon_kk_termin", "fiaon_kk_rueckfrage"],
    standard: "fiaon_kk_antrag_offen",
    abstandTage: 1,
  },
  zahlung_offen: {
    titel: "Erste Zahlung offen",
    satz: "Antrag abgeschickt, erste Zahlung noch nicht da und nicht als gezahlt gemeldet.",
    vorlagen: ["fiaon_kk_rechnung", "fiaon_kk_aktivierung", "fiaon_kk_rueckfrage"],
    standard: "fiaon_kk_rechnung",
    abstandTage: 2,
  },
  rate_offen: {
    titel: "Monatsrate fällig",
    satz: "Bestandskunden mit fälliger, unbezahlter Monatsrate — nicht gekündigt, kein Abo- oder Mahnstopp. Höchstens alle 7 Tage, zweimal je Rate.",
    vorlagen: ["fiaon_kk_rate"],
    standard: "fiaon_kk_rate",
    abstandTage: 7,
  },
};

export const GRUPPEN_REIHE: Gruppe[] = ["neu", "zahlung_offen", "abbrecher", "ohne_antrag", "rate_offen"];
export const istGruppe = (g: unknown): g is Gruppe => typeof g === "string" && (GRUPPEN_REIHE as string[]).includes(g);

/** Was „stufen" je Kandidat bedeutet — für die Anzeige. */
export const STUFEN_TEXT = "Passend zum Alter: bis Tag 2 Erinnerung 1, bis Tag 5 Erinnerung 2, bis Tag 12 Erinnerung 3, danach die letzte Nachricht.";

// ── Tabelle ─────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function zentraleSchema(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_wa_aktion (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER,
          gruppe TEXT NOT NULL,
          vorlage TEXT NOT NULL,
          quelle TEXT NOT NULL,
          lauf_id TEXT,
          ausgeloest_von TEXT,
          wa_id TEXT,
          ok BOOLEAN NOT NULL,
          grund TEXT,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_zeit_idx ON fiaon_wa_aktion (erstellt_am DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_person_idx ON fiaon_wa_aktion (person_id, erstellt_am DESC)`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// WER IST IN WELCHER GRUPPE
// ═══════════════════════════════════════════════════════════════════════════
export interface Kandidat {
  personId: number;
  name: string;
  telefon: string;
  leadId: number | null;
  eingang: string;
  tage: number;
  letzteVorlageAm: string | null;
  betrag: string | null;       // „99,99" für {{2}} der Rechnung bzw. der Rate
  referenz: string | null;     // Verwendungszweck der ersten Zahlung bzw. der Rate
  faelligAm: string | null;    // „22.09.2026" — nur bei der Monatsrate
}

/** „ANNA VON DER HEIDE" / „max mustermann" → „Anna von der Heide" / „Max Mustermann". Gemischte Schreibung bleibt. */
export function schoenerName(roh: string): string {
  const s = String(roh || "").replace(/\s+/g, " ").trim();
  if (!s || (s !== s.toUpperCase() && s !== s.toLowerCase())) return s;
  const klein = new Set(["von", "van", "der", "den", "de", "zu", "zur", "di", "da", "del", "la", "le"]);
  return s.toLowerCase().split(" ").map((w, i) => (i > 0 && klein.has(w)) ? w
    : w.split("-").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("-")).join(" ");
}

/** Die Menschen, die überhaupt in Frage kommen — die harten Regeln oben. */
export const BASIS = `
  WITH basis AS (
    SELECT p.id AS person_id,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           p.primary_phone AS telefon,
           p.created_at,
           (SELECT MAX(w.created_at) FROM fiaon_whatsapp w
             WHERE w.person_id = p.id AND w.richtung = 'raus' AND w.vorlage IS NOT NULL AND w.status <> 'fehler') AS letzte_vorlage,
           (SELECT COUNT(*) FROM fiaon_whatsapp w
             WHERE w.person_id = p.id AND w.richtung = 'raus' AND w.vorlage IS NOT NULL AND w.status <> 'fehler'
               AND w.created_at > NOW() - INTERVAL '30 days')::int AS vorlagen_30,
           (SELECT le.id FROM fiaon_leads le WHERE le.person_id = p.id ORDER BY le.erstellt_am DESC LIMIT 1) AS lead_id
      FROM fiaon_persons p
      -- Die eine WhatsApp-Regel des Hauses (shared/fiaon-whatsapp-erlaubnis.ts):
      -- ein ausdrückliches Nein im Lead-Formular schließt aus, Festnetz auch.
      CROSS JOIN LATERAL (
        SELECT p.primary_phone AS telefon,
               (SELECT bool_and(le.whatsapp_erlaubt) FROM fiaon_leads le
                 WHERE le.person_id = p.id AND le.whatsapp_erlaubt IS NOT NULL) AS whatsapp_erlaubt
      ) wx
     WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
       AND p.primary_phone IS NOT NULL AND TRIM(p.primary_phone) <> '' AND p.werbung_gesperrt_am IS NULL
       AND ${WHATSAPP_MOEGLICH_SQL("wx")}
       -- 24.09.2026, Justin: „Wir schreiben alle per WhatsApp an, die wir haben, nicht nur die mit
       -- Einwilligung." Kein Einwilligungs-Filter — die Seite zeigt je Gruppe, wie viele nachweislich
       -- eingewilligt haben (Risiko: Meta-Qualität, bei Werbung an Website-Abbrecher § 7 UWG).
       -- Höchstens ein Versuch je Person und Tag — auch ein übersprungener
       -- (sonst griffe die Automatik alle fünf Minuten nach demselben Fall).
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_wa_aktion x WHERE x.person_id = p.id
            AND (x.erstellt_am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp w WHERE w.person_id = p.id AND w.richtung = 'raus'
            AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp s WHERE s.person_id = p.id AND s.richtung = 'rein'
            AND (s.text ILIKE '%stopp%' OR s.knopf ILIKE '%stopp%' OR s.text ILIKE '%keine nachrichten%' OR s.knopf ILIKE '%keine nachrichten%'))
       -- E-230: Wer gerade mit uns schreibt, bekommt keine Vorlage mitten ins Gespräch — dort antwortet Mara.
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp e WHERE e.person_id = p.id AND e.richtung = 'rein' AND e.created_at > NOW() - INTERVAL '24 hours')
  )`;

// Für die vier Gruppen VOR der ersten Zahlung (neu, ohne Antrag, abgebrochen,
// erste Zahlung offen): nicht älter als 120 Tage, nichts bezahlt oder gemeldet.
// Stand bis E-229 in BASIS — dort hätte es die Monatsrate (nur Bezahlte) leer gemacht.
const VOR_DER_ZAHLUNG = `b.created_at > NOW() - INTERVAL '120 days'
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = b.person_id AND ap.merged_into IS NULL
                     AND ap.payment_status IN ('paid', 'claimed_paid'))`;

/**
 * Eine Rate, an die erinnert werden darf. `r` ist fiaon_abo_raten, `a` die
 * Bestellung, `person` der Ausdruck für die Personen-ID. Gruppe UND Auswahl der
 * Rate nutzen genau diesen Baustein — sonst liefen „höchstens zweimal je Rate"
 * und die gewählte Rate auseinander (E-230-Durchsicht).
 */
export const RATE_ERINNERBAR = (r: string, a: string, person: string) => `(
  ${RATE_OFFEN_FAELLIG(r)}
  -- höchstens zwei WhatsApp je Rate
  AND (SELECT COUNT(*) FROM fiaon_whatsapp wr WHERE wr.person_id = ${person} AND wr.richtung = 'raus'
         AND wr.vorlage IN ('fiaon_kk_rate', 'fiaon_kkb_rate') AND wr.status <> 'fehler'
         AND wr.text LIKE '%' || ${r}.zahlungsreferenz || '%') < 2
  -- keine Erinnerung, wenn ein passender Eingang unverbucht im Bankbuch liegt (Regel der Rückholung)
  AND NOT EXISTS (
    SELECT 1 FROM fiaon_bank_txns t
     WHERE t.applied = FALSE AND t.amount_cents > 0 AND t.booked_at > NOW() - INTERVAL '30 days'
       AND (t.matched_ref = ${a}.ref
            OR UPPER(REGEXP_REPLACE(COALESCE(t.extracted_ref, ''), '[^A-Za-z0-9]', '', 'g'))
               LIKE UPPER(REGEXP_REPLACE(COALESCE(${a}.payment_reference, ${a}.ref), '[^A-Za-z0-9]', '', 'g')) || '%'
            OR (LENGTH(TRIM(COALESCE(${a}.last_name, ''))) >= 4 AND t.payer_name ILIKE '%' || TRIM(${a}.last_name) || '%')))
  -- ein zugesagtes Zahldatum abwarten (steht an der Person)
  AND NOT EXISTS (SELECT 1 FROM fiaon_persons pz WHERE pz.id = ${person}
                    AND pz.promised_payment_date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date)
)`;

/** Rate offen, fällig, zahlbar über /zahlung/, nicht eskaliert, kein Beleg „überwiesen" in 14 Tagen. */
const RATE_OFFEN_FAELLIG = (r: string) => `(
  ${r}.status = 'offen' AND ${r}.storniert_am IS NULL AND ${r}.bezahlt_am IS NULL
  AND ${r}.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date
  AND UPPER(${r}.zahlungsreferenz) ~ '^FIAON-?[A-Z0-9]{6}-[0-9]{1,2}$'
  AND (${r}.inkasso_zusage_am IS NULL OR ${r}.inkasso_zusage_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date)
  AND ${r}.eskaliert_am IS NULL
  AND NOT EXISTS (SELECT 1 FROM fiaon_raten_arbeit ra WHERE ra.rate_id = ${r}.id AND ra.ergebnis = 'ueberwiesen_beleg'
                    AND ra.created_at > NOW() - INTERVAL '14 days'))`;

/** Die Bestellung eines Bestandskunden, an dessen Rate erinnert werden darf. `a` ist fiaon_applications. */
const BESTAND = (a: string) => `(${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND ${a}.payment_status = 'paid'
  AND ${a}.archived_at IS NULL AND ${a}.gdpr_deleted_at IS NULL
  AND (${a}.gekuendigt_am IS NULL OR ${a}.kuendigung_zurueckgenommen_am IS NOT NULL)
  AND ${a}.abo_gestoppt_am IS NULL AND ${a}.mahnstopp_am IS NULL)`;

// „Abgeschickt" — dieselbe Regel wie der Wiedereinstieg in fiaon-antrag.ts
// (E-210): Schritt 8 erreicht oder ein Status außerhalb der unfertigen. Die
// Zahlungsreferenz taugt NICHT als Zeichen — ein Trigger füllt sie seit dem
// 08.08.2026 schon beim ersten Speichern.
const UNFERTIG_SQL = `('started', 'personal_data', 'finances', 'config', 'verifying', 'approved', 'contract', 'processing')`;
// Offen heißt: abgeschickt und weder bezahlt, gemeldet, storniert noch
// archiviert — auch „pending" (so führt kundenstatus() es als „Rechnung offen").
const abgeschickt = (t: string) => `(COALESCE(${t}.current_step, 0) >= 8 OR COALESCE(${t}.status, '') NOT IN ${UNFERTIG_SQL})`;

const OHNE_ANTRAG = `NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL)`;

export function gruppenBedingung(g: Gruppe): string {
  const abstand = `(b.letzte_vorlage IS NULL OR b.letzte_vorlage < NOW() - INTERVAL '${GRUPPEN[g].abstandTage} days')`;
  const deckel = `b.vorlagen_30 < 8`;
  switch (g) {
    case "neu":
      // „Noch nie angeschrieben" heißt: gar kein WhatsApp-Kontakt — auch keine Antwort von Mara, kein eigener Eingang.
      return `${VOR_DER_ZAHLUNG} AND b.created_at > NOW() - INTERVAL '30 days' AND b.letzte_vorlage IS NULL AND ${OHNE_ANTRAG}
              AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp wk WHERE wk.person_id = b.person_id AND (wk.richtung = 'rein' OR wk.status <> 'fehler'))`;
    case "ohne_antrag":
      return `${VOR_DER_ZAHLUNG} AND ${OHNE_ANTRAG} AND b.created_at > NOW() - INTERVAL '90 days' AND ${deckel}
              AND ((b.letzte_vorlage IS NOT NULL AND b.letzte_vorlage < NOW() - INTERVAL '2 days')
                   OR (b.letzte_vorlage IS NULL AND b.created_at <= NOW() - INTERVAL '30 days'))`;
    case "abbrecher":
      // Abgebrochen = eine Bestellung, die noch vor dem Abschicken steht, seit
      // mindestens 30 Minuten unberührt — und keine abgeschickte daneben.
      // (Entwürfe mit ist_entwurf haben keine Person; sie sind hier nie dabei.)
      return `${VOR_DER_ZAHLUNG} AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL AND NOT a.ist_entwurf
                        AND NOT ${abgeschickt("a")} AND a.payment_status NOT IN ('paid', 'claimed_paid', 'cancelled', 'superseded')
                        AND a.gekuendigt_am IS NULL AND COALESCE(a.updated_at, a.created_at) < NOW() - INTERVAL '30 minutes')
              AND NOT EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = b.person_id AND a2.merged_into IS NULL
                        AND NOT a2.ist_entwurf AND ${abgeschickt("a2")})
              AND b.created_at > NOW() - INTERVAL '90 days' AND ${abstand} AND ${deckel}`;
    case "zahlung_offen":
      return `${VOR_DER_ZAHLUNG} AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL AND NOT a.ist_entwurf
                        AND ${abgeschickt("a")} AND a.payment_status IN ('pending_payment', 'expired', 'pending') AND a.mahnstopp_am IS NULL
                        AND a.gekuendigt_am IS NULL AND a.payment_reference IS NOT NULL)
              AND ${abstand} AND ${deckel}`;
    case "rate_offen":
      // Höchstens zwei WhatsApp je Rate: Erinnerung, kein Dauermahnen (die Mail erinnert ohnehin, E-182).
      return `EXISTS (SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
                       WHERE a.person_id = b.person_id AND ${BESTAND("a")} AND ${RATE_ERINNERBAR("r", "a", "b.person_id")})
              AND ${abstand} AND ${deckel}`;
  }
}

/** Reihenfolge je Gruppe: Neue die frischesten zuerst, sonst wer am längsten nichts bekam. */
const ORDNUNG: Record<Gruppe, string> = {
  neu: "b.created_at DESC",
  ohne_antrag: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
  abbrecher: "b.created_at DESC",
  zahlung_offen: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
  rate_offen: "b.letzte_vorlage ASC NULLS FIRST, b.created_at DESC",
};

export async function gruppenZahlen(): Promise<Record<Gruppe, number>> {
  return (await gruppenZahlenMitEinwilligung()).alle;
}

/** Je Gruppe: alle — und wie viele davon nachweislich eingewilligt haben (Meta-Formular mit Hinweis oder selbst geschrieben). */
export async function gruppenZahlenMitEinwilligung(): Promise<{ alle: Record<Gruppe, number>; einwilligung: Record<Gruppe, number> }> {
  await zentraleSchema();
  const alle = {} as Record<Gruppe, number>;
  const einwilligung = {} as Record<Gruppe, number>;
  await Promise.all(GRUPPEN_REIHE.map(async (g) => {
    const [r] = (await sqlPool.unsafe(`${BASIS}
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE ${WHATSAPP_EINWILLIGUNG_SQL("b.person_id")})::int AS e
        FROM basis b WHERE ${gruppenBedingung(g)}`)) as any[];
    alle[g] = Number(r?.n || 0);
    einwilligung[g] = Number(r?.e || 0);
  }));
  return { alle, einwilligung };
}

export async function kandidaten(g: Gruppe, anzahl: number, ohne: number[] = []): Promise<Kandidat[]> {
  await zentraleSchema();
  const n = Math.min(500, Math.max(1, Math.round(anzahl)));
  const ausschluss = ohne.filter((x) => Number.isInteger(x));
  const rows = (await sqlPool.unsafe(`
    ${BASIS}
    SELECT b.*, EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400 AS tage_roh
      FROM basis b
     WHERE ${gruppenBedingung(g)} ${ausschluss.length ? `AND b.person_id <> ALL($1::int[])` : ""}
     ORDER BY ${ORDNUNG[g]}
     LIMIT ${n}`, ausschluss.length ? [ausschluss] : [])) as any[];
  const aus: Kandidat[] = [];
  for (const r of rows) {
    let betrag: string | null = null;
    let referenz: string | null = null;
    let faelligAm: string | null = null;
    if (g === "rate_offen") {
      // Die älteste fällige Rate — Betrag wie auf der Zahlungsseite (betrag_cents), nicht der Katalogpreis.
      const [ra] = (await sqlPool.unsafe(`
        SELECT r.zahlungsreferenz, r.betrag_cents, to_char(r.faellig_am, 'DD.MM.YYYY') AS faellig
          FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
         WHERE a.person_id = $1 AND ${BESTAND("a")} AND ${RATE_ERINNERBAR("r", "a", "$1::int")}
         ORDER BY r.faellig_am ASC, r.rate_nr ASC LIMIT 1`, [Number(r.person_id)])) as any[];
      if (ra) {
        betrag = (Number(ra.betrag_cents) / 100).toFixed(2).replace(".", ",");
        referenz = String(ra.zahlungsreferenz);
        faelligAm = String(ra.faellig);
      }
    } else if (g === "zahlung_offen") {
      const [a] = (await sqlPool`
        SELECT payment_reference, pack_key, amount_due FROM fiaon_applications
         WHERE person_id = ${r.person_id} AND merged_into IS NULL AND NOT ist_entwurf
           AND payment_status IN ('pending_payment', 'expired', 'pending') AND payment_reference IS NOT NULL
           AND mahnstopp_am IS NULL AND gekuendigt_am IS NULL
           AND (COALESCE(current_step, 0) >= 8 OR COALESCE(status, '') NOT IN ('started', 'personal_data', 'finances', 'config', 'verifying', 'approved', 'contract', 'processing'))
         ORDER BY created_at DESC LIMIT 1`) as any[];
      if (a) {
        // E-181: Der Katalogpreis gilt; amount_due nur, wenn das Paket unbekannt ist.
        const cents = paketPreisCents(a.pack_key) || (a.amount_due != null ? Math.round(Number(a.amount_due) * 100) : 0);
        betrag = cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : null;
        referenz = String(a.payment_reference);
      }
    }
    aus.push({
      personId: Number(r.person_id),
      name: schoenerName(String(r.name || "")),
      telefon: String(r.telefon || ""),
      leadId: r.lead_id != null ? Number(r.lead_id) : null,
      eingang: new Date(r.created_at).toISOString(),
      tage: Math.floor(Number(r.tage_roh || 0)),
      letzteVorlageAm: r.letzte_vorlage ? new Date(r.letzte_vorlage).toISOString() : null,
      betrag, referenz, faelligAm,
    });
  }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE UND WERTE
// ═══════════════════════════════════════════════════════════════════════════
function stufenVorlage(tage: number): string {
  if (tage <= 2) return "fiaon_kk_tag1";
  if (tage <= 5) return "fiaon_kk_tag3";
  if (tage <= 12) return "fiaon_kk_tag7";
  return "fiaon_kk_letzte";
}

export function vorlageFuerKandidat(gewaehlt: string, k: Kandidat): string {
  return gewaehlt === "stufen" ? stufenVorlage(k.tage) : gewaehlt;
}

/** Die Werte für {{1}}, {{2}}, {{3}} — oder ein Grund, warum es nicht geht. */
export function werteFuer(vorlage: string, k: Kandidat): { werte: string[]; knopfWert?: string } | { grund: string } {
  const anrede = k.name || "und willkommen";
  if (vorlage === "fiaon_kk_rate") {
    // Bestandskunden bekommen kein „Hallo und willkommen".
    if (!k.name) return { grund: "Kein Name — bei Bestandskunden kein „und willkommen“" };
    if (!k.betrag || !k.referenz || !k.faelligAm) return { grund: "Keine fällige Rate gefunden" };
    return { werte: [k.name, k.betrag, k.faelligAm, k.referenz], knopfWert: k.referenz };
  }
  if (vorlage === "fiaon_kk_rechnung") {
    if (!k.betrag || !k.referenz) return { grund: "Kein Betrag oder keine Referenz" };
    return { werte: [anrede, k.betrag, k.referenz], knopfWert: k.referenz };
  }
  // {{2}} ist bei diesen Vorlagen der Absender: „hier ist Mara von FIAON".
  if (["fiaon_kk_rueckfrage", "fiaon_kk_termin", "fiaon_kk_nicht_erreicht"].includes(vorlage)) return { werte: [anrede, "Mara"] };
  return { werte: [anrede] };
}

export function vorlagePasst(g: Gruppe, vorlage: string): boolean {
  if (!GRUPPEN[g].vorlagen.includes(vorlage)) return false;
  return vorlage === "stufen" || WA_VORLAGEN.some((v) => v.name === vorlage);
}

/** Freigegeben heißt: die Textfassung oder ihre Bildfassung ist bei Meta APPROVED. */
export function istFrei(vorlage: string, frei: Set<string>): boolean {
  return frei.has(vorlage) || frei.has(vorlage.replace(/^fiaon_kk_/, "fiaon_kkb_"));
}

async function freigabeSatz(): Promise<Set<string>> {
  const { freigegebeneVorlagen } = await import("./fiaon-whatsapp");
  return freigegebeneVorlagen().catch(() => new Set<string>());
}

// ── Uhr ─────────────────────────────────────────────────────────────────────
// Nur formatToParts — Number(Intl.format()) ergibt NaN (Zeit-Falle, Gedächtnis).
export function berlinMinutenJetzt(): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const w = (art: string) => Number(teile.find((p) => p.type === art)?.value ?? "0");
  return (w("hour") === 24 ? 0 : w("hour")) * 60 + w("minute");
}
const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

/** Harte Ruhezeit für jede Sendung, auch von Hand: nur 07:00 bis 21:00. */
export function tagsueber(): boolean {
  const m = berlinMinutenJetzt();
  return m >= 7 * 60 && m < 21 * 60;
}

// ═══════════════════════════════════════════════════════════════════════════
// META-TAGESRAUM
//
// Meta erlaubt je Nummer nur so viele Gespräche mit NEUEN Empfängern in 24
// Stunden, wie die Stufe hergibt (50, 250, 1.000 …). Wer darüber schreibt,
// bekommt Fehler — und jede Häufung drückt die Qualitätsbewertung, bis Meta
// die Nummer drosselt. Deshalb zählt hier jede Vorlage der letzten 24 Stunden
// (Begrüßung, Kette, Zentrale, Hand) gegen 80 % der Stufe. Unbekannte Stufe:
// wir rechnen mit 250.
// ═══════════════════════════════════════════════════════════════════════════
const STUFEN: Record<string, number> = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 100000 };
let metaCache: { am: number; stufe: string | null; qualitaet: string | null; name: string | null } | null = null;

export async function metaStand(): Promise<{ stufe: string | null; qualitaet: string | null; name: string | null }> {
  if (metaCache && Date.now() - metaCache.am < 10 * 60_000) return metaCache;
  const { waKonfig } = await import("./fiaon-whatsapp");
  const k = waKonfig();
  let stufe: string | null = null, qualitaet: string | null = null, name: string | null = null;
  if (k.nummerId) {
    try {
      const { graph } = await import("./fiaon-meta");
      const j = await graph(k.nummerId, { params: { fields: "messaging_limit_tier,quality_rating,verified_name" }, zeitMs: 8000 });
      stufe = j?.messaging_limit_tier ? String(j.messaging_limit_tier) : null;
      qualitaet = j?.quality_rating ? String(j.quality_rating) : null;
      name = j?.verified_name ? String(j.verified_name) : null;
    } catch (e) {
      console.warn("[WA-ZENTRALE] Meta-Stand nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  metaCache = { am: Date.now(), stufe, qualitaet, name };
  return metaCache;
}

export async function tagesRaum(): Promise<{ grenze: number; verbraucht: number; frei: number; stufe: string | null; qualitaet: string | null }> {
  const m = await metaStand();
  const grenze = Math.floor((STUFEN[m.stufe ?? ""] ?? 250) * 0.8);
  const [z] = (await sqlPool`
    SELECT COUNT(DISTINCT nummer)::int AS n FROM fiaon_whatsapp
     WHERE richtung = 'raus' AND vorlage IS NOT NULL AND status <> 'fehler' AND created_at > NOW() - INTERVAL '24 hours'`.catch(() => [{ n: 0 }])) as any[];
  const verbraucht = Number(z?.n || 0);
  return { grenze, verbraucht, frei: Math.max(0, grenze - verbraucht), stufe: m.stufe, qualitaet: m.qualitaet };
}

// ═══════════════════════════════════════════════════════════════════════════
// SENDEN
// ═══════════════════════════════════════════════════════════════════════════
export interface Lauf {
  id: string;
  laeuft: boolean;
  quelle: "hand" | "automatik";
  gruppe: Gruppe;
  vorlage: string;
  gesamt: number;
  gesendet: number;
  uebersprungen: number;
  fehler: number;
  gruende: Record<string, number>;
  seit: string;
  bis: string | null;
  ausgeloestVon: string | null;
  abgebrochen: boolean;
}

let aktuellerLauf: Lauf | null = null;
let abbrechen = false;
export const laufStand = (): Lauf | null => (aktuellerLauf ? { ...aktuellerLauf, gruende: { ...aktuellerLauf.gruende } } : null);
export function laufAbbrechen(): boolean {
  if (!aktuellerLauf?.laeuft) return false;
  abbrechen = true;
  return true;
}

async function protokoll(k: Kandidat, g: Gruppe, vorlage: string, quelle: string, laufId: string, von: string | null, ok: boolean, grund: string | null, waId: string | null = null) {
  await sqlPool`
    INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, lauf_id, ausgeloest_von, wa_id, ok, grund)
    VALUES (${k.personId}, ${g}, ${vorlage}, ${quelle}, ${laufId}, ${von}, ${waId}, ${ok}, ${grund ? grund.slice(0, 300) : null})`.catch((e) => console.error("[WA-ZENTRALE] Protokoll:", e));
}

async function einzelnSenden(
  g: Gruppe, gewaehlt: string, k: Kandidat, quelle: "hand" | "automatik", laufId: string, von: string | null, frei: Set<string>,
): Promise<{ ok: boolean; grund?: string }> {
  const vorlage = vorlageFuerKandidat(gewaehlt, k);
  if (!istFrei(vorlage, frei)) {
    const grund = "Vorlage bei Meta noch nicht freigegeben";
    await protokoll(k, g, vorlage, quelle, laufId, von, false, grund);
    return { ok: false, grund };
  }
  const w = werteFuer(vorlage, k);
  if ("grund" in w) {
    await protokoll(k, g, vorlage, quelle, laufId, von, false, w.grund);
    return { ok: false, grund: w.grund };
  }
  const { waSenden } = await import("./fiaon-whatsapp");
  const { nummerFuerWhatsApp } = await import("@shared/fiaon-whatsapp-erlaubnis");
  const nummer = nummerFuerWhatsApp(k.telefon);
  if (!nummer) {
    await protokoll(k, g, vorlage, quelle, laufId, von, false, "Keine WhatsApp-Nummer");
    return { ok: false, grund: "Keine WhatsApp-Nummer" };
  }
  const r = await waSenden(nummer, { vorlage, werte: w.werte, knopfWert: w.knopfWert }, { personId: k.personId, leadId: k.leadId, von: "Mara" });
  await protokoll(k, g, vorlage, quelle, laufId, von, r.ok, r.ok ? null : String(r.grund || "Senden fehlgeschlagen"), r.waId ?? null);
  if (r.ok) {
    const { waAktenvermerk } = await import("./fiaon-whatsapp");
    await waAktenvermerk(k.personId, `WhatsApp „${vorlage}“ gesendet (${GRUPPEN[g].titel}, ${quelle === "hand" ? `von Hand gestartet${von ? ` durch ${von}` : ""}` : "Automatik"}).`);
  }
  return r.ok ? { ok: true } : { ok: false, grund: r.grund };
}

/**
 * Ein Lauf von Hand: die nächsten `anzahl` aus der Gruppe, eine Nachricht nach
 * der anderen mit kurzem Abstand. Läuft schon einer, startet kein zweiter.
 */
export async function laufStarten(opts: { gruppe: Gruppe; vorlage: string; anzahl: number; quelle: "hand" | "automatik"; von: string | null }): Promise<{ ok: true; lauf: Lauf } | { ok: false; grund: string }> {
  if (aktuellerLauf?.laeuft) return { ok: false, grund: "Es läuft schon ein Versand. Bitte warten, bis er fertig ist." };
  if (!vorlagePasst(opts.gruppe, opts.vorlage)) return { ok: false, grund: "Diese Vorlage passt nicht zu dieser Gruppe." };
  if (!tagsueber()) return { ok: false, grund: "Zwischen 21:00 und 07:00 schreiben wir niemanden an." };
  const frei = await freigabeSatz();
  if (opts.vorlage !== "stufen" && !istFrei(opts.vorlage, frei)) return { ok: false, grund: "Diese Vorlage ist bei Meta noch nicht freigegeben." };
  const raum = await tagesRaum();
  if (raum.frei <= 0) return { ok: false, grund: `Das Tageslimit von Meta ist ausgeschöpft (${raum.verbraucht} von ${raum.grenze} in 24 Stunden). Morgen geht es weiter.` };
  if (raum.qualitaet === "RED") return { ok: false, grund: "Meta bewertet die Nummer gerade mit ROT. Bis sich das erholt, keine Massenversände — sonst droht die Sperre." };
  const anzahl = Math.min(200, raum.frei, Math.max(1, Math.round(Number(opts.anzahl) || 0)));
  const id = `L${Date.now().toString(36)}`;
  abbrechen = false;
  aktuellerLauf = {
    id, laeuft: true, quelle: opts.quelle, gruppe: opts.gruppe, vorlage: opts.vorlage,
    gesamt: 0, gesendet: 0, uebersprungen: 0, fehler: 0, gruende: {}, seit: new Date().toISOString(), bis: null,
    ausgeloestVon: opts.von, abgebrochen: false,
  };
  const lauf = aktuellerLauf;
  const zaehle = (g: string) => { const s = g.slice(0, 90); lauf.gruende[s] = (lauf.gruende[s] ?? 0) + 1; };
  void (async () => {
    try {
      const liste = await kandidaten(opts.gruppe, anzahl);
      lauf.gesamt = liste.length;
      for (const k of liste) {
        if (abbrechen) { lauf.abgebrochen = true; break; }
        if (!tagsueber()) { zaehle("Ruhezeit begonnen — Rest nicht gesendet"); break; }
        try {
          const r = await einzelnSenden(opts.gruppe, opts.vorlage, k, opts.quelle, id, opts.von, frei);
          if (r.ok) lauf.gesendet++;
          else { lauf.uebersprungen++; zaehle(String(r.grund || "unbekannt")); }
        } catch (e) {
          lauf.fehler++;
          zaehle(String((e as Error)?.message || e));
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
    } catch (e) {
      lauf.fehler++;
      zaehle(String((e as Error)?.message || e));
    } finally {
      lauf.laeuft = false;
      lauf.bis = new Date().toISOString();
      console.log(`[WA-ZENTRALE] Lauf ${id} (${lauf.quelle}, ${lauf.gruppe}, ${lauf.vorlage}): ${lauf.gesendet} gesendet, ${lauf.uebersprungen} übersprungen, ${lauf.fehler} Fehler${lauf.abgebrochen ? ", abgebrochen" : ""}`);
    }
  })();
  return { ok: true, lauf: { ...lauf } };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUTOMATIK
// ═══════════════════════════════════════════════════════════════════════════
export interface Automatik {
  an: boolean;
  von: string;       // „07:40"
  bis: string;       // „20:45"
  jeStunde: number;  // 5
  gruppen: Gruppe[]; // Reihenfolge = Vorrang
  vorlagen: Partial<Record<Gruppe, string>>;
  geaendertVon?: string | null;
  geaendertAm?: string | null;
}

const AUTOMATIK_KEY = "wa_zentrale_automatik";
export const AUTOMATIK_VORGABE: Automatik = {
  an: false, von: "07:40", bis: "20:45", jeStunde: 5,
  gruppen: ["neu", "zahlung_offen", "abbrecher", "ohne_antrag"],
  vorlagen: { neu: "fiaon_kk_anfrage", zahlung_offen: "fiaon_kk_rechnung", abbrecher: "fiaon_kk_antrag_offen", ohne_antrag: "stufen", rate_offen: "fiaon_kk_rate" },
};

export async function automatik(): Promise<Automatik> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${AUTOMATIK_KEY}`.catch(() => [] as any[])) as any[];
  if (!r?.value) return { ...AUTOMATIK_VORGABE, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen } };
  try {
    const roh = JSON.parse(String(r.value));
    const a: Automatik = { ...AUTOMATIK_VORGABE, ...roh, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen, ...(roh?.vorlagen || {}) } };
    a.gruppen = (a.gruppen || []).filter(istGruppe);
    return a;
  } catch { return { ...AUTOMATIK_VORGABE, vorlagen: { ...AUTOMATIK_VORGABE.vorlagen } }; }
}

/** Für die alte Stundenkette: Ist die Zentrale-Automatik an, pausiert sie. */
export async function automatikAn(): Promise<boolean> {
  return (await automatik()).an === true;
}

export async function automatikSetzen(neu: Partial<Automatik>, von: string | null): Promise<{ ok: true; automatik: Automatik } | { ok: false; grund: string }> {
  const alt = await automatik();
  const a: Automatik = {
    ...alt,
    ...(typeof neu.an === "boolean" ? { an: neu.an } : {}),
    ...(typeof neu.von === "string" ? { von: neu.von } : {}),
    ...(typeof neu.bis === "string" ? { bis: neu.bis } : {}),
    ...(neu.jeStunde != null ? { jeStunde: Number(neu.jeStunde) } : {}),
    ...(Array.isArray(neu.gruppen) ? { gruppen: neu.gruppen } : {}),
    vorlagen: { ...alt.vorlagen, ...(neu.vorlagen && typeof neu.vorlagen === "object" ? neu.vorlagen : {}) },
  };
  if (!/^\d{2}:\d{2}$/.test(a.von) || !/^\d{2}:\d{2}$/.test(a.bis)) return { ok: false, grund: "Zeiten bitte als HH:MM." };
  if (hhmm(a.von) < 7 * 60 || hhmm(a.bis) > 21 * 60 || hhmm(a.von) >= hhmm(a.bis)) return { ok: false, grund: "Das Fenster muss zwischen 07:00 und 21:00 liegen." };
  if (!Number.isFinite(a.jeStunde) || a.jeStunde < 1 || a.jeStunde > 30) return { ok: false, grund: "Je Stunde sind 1 bis 30 Nachrichten möglich." };
  a.jeStunde = Math.round(a.jeStunde);
  a.gruppen = Array.from(new Set((a.gruppen || []).filter(istGruppe)));
  if (a.an && !a.gruppen.length) return { ok: false, grund: "Mindestens eine Gruppe muss dabei sein." };
  for (const g of Object.keys(a.vorlagen)) {
    const v = a.vorlagen[g as Gruppe];
    if (!istGruppe(g) || !v || !vorlagePasst(g, v)) delete a.vorlagen[g as Gruppe];
  }
  a.geaendertVon = von;
  a.geaendertAm = new Date().toISOString();
  const wert = JSON.stringify(a);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${AUTOMATIK_KEY}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${wert}, updated_at = NOW()`;
  if (alt.an !== a.an) console.log(`[WA-ZENTRALE] Automatik ${a.an ? "AN" : "AUS"} durch ${von ?? "?"} (${a.von}–${a.bis}, ${a.jeStunde}/h)`);
  return { ok: true, automatik: a };
}

/**
 * Die erlaubte Menge bis zu dieser Minute — gleichmäßig verteilt. Angebrochene
 * Stunden am Rand des Fensters bekommen ihren Anteil: 07:40–08:00 sind bei
 * „5 je Stunde" zwei Nachrichten, nicht fünf auf einen Schlag.
 */
export function sollBisMinute(jeStunde: number, minute: number, vonMin: number, bisMin: number): number {
  const stundenAnfang = Math.floor(minute / 60) * 60;
  const anfang = Math.max(stundenAnfang, vonMin);
  const ende = Math.min(stundenAnfang + 60, bisMin);
  if (ende <= anfang || minute < anfang) return 0;
  const jeMinute = jeStunde / 60;
  return Math.min(Math.ceil(jeMinute * (ende - anfang)), Math.ceil(jeMinute * (minute - anfang + 5)));
}

let taktLaeuft = false;
/**
 * Der Takt (alle 5 Minuten). Um xx:00 darf die erste raus, um xx:30 etwa die
 * Hälfte, um xx:55 alle. Wer die Stunde schon voll hat, wartet auf die
 * nächste. Gezählt werden nur erfolgreiche Automatik-Sendungen.
 */
export async function automatikTakt(): Promise<{ gesendet: number; grund?: string }> {
  if (taktLaeuft) return { gesendet: 0, grund: "Takt läuft noch" };
  taktLaeuft = true;
  try {
    await zentraleSchema();
    const a = await automatik();
    if (!a.an) return { gesendet: 0, grund: "aus" };
    const m = berlinMinutenJetzt();
    if (m < hhmm(a.von) || m >= hhmm(a.bis) || !tagsueber()) return { gesendet: 0, grund: "außerhalb des Fensters" };
    if (aktuellerLauf?.laeuft) return { gesendet: 0, grund: "ein Lauf von Hand läuft" };
    const { waKonfig } = await import("./fiaon-whatsapp");
    if (!waKonfig().bereit) return { gesendet: 0, grund: "WhatsApp nicht eingerichtet" };
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion
       WHERE quelle = 'automatik' AND ok
         AND date_trunc('hour', erstellt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('hour', NOW() AT TIME ZONE 'Europe/Berlin')`) as any[];
    const schon = Number(z?.n || 0);
    let frei = sollBisMinute(a.jeStunde, m, hhmm(a.von), hhmm(a.bis)) - schon;
    if (frei <= 0) return { gesendet: 0, grund: "Stundenmenge erreicht" };
    const raum = await tagesRaum();
    if (raum.qualitaet === "RED") return { gesendet: 0, grund: "Meta-Qualität ROT" };
    frei = Math.min(frei, raum.frei);
    if (frei <= 0) return { gesendet: 0, grund: "Meta-Tageslimit erreicht" };
    const freigabe = await freigabeSatz();
    let gesendet = 0;
    const versucht: number[] = [];
    const laufId = `A${Date.now().toString(36)}`;
    for (const g of a.gruppen) {
      if (frei <= 0) break;
      const vorlage = a.vorlagen[g] ?? GRUPPEN[g].standard;
      if (!vorlagePasst(g, vorlage)) continue;
      if (vorlage !== "stufen" && !istFrei(vorlage, freigabe)) continue;
      // Etwas mehr holen als nötig — wer an einer Regel scheitert, soll den Platz nicht blockieren.
      const liste = await kandidaten(g, frei + 3, versucht);
      for (const k of liste) {
        if (frei <= 0) break;
        versucht.push(k.personId);
        const r = await einzelnSenden(g, vorlage, k, "automatik", laufId, "Automatik", freigabe).catch(() => ({ ok: false }));
        if (r.ok) { gesendet++; frei--; }
        await new Promise((res) => setTimeout(res, 1200));
      }
    }
    if (gesendet) console.log(`[WA-ZENTRALE] Automatik: ${gesendet} gesendet (${schon + gesendet}/${a.jeStunde} in dieser Stunde)`);
    return { gesendet };
  } finally {
    taktLaeuft = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE — alles, was die Seite zeigt, in einem Zug
// ═══════════════════════════════════════════════════════════════════════════
export async function zentraleLage() {
  await zentraleSchema();
  const [zaehlung, a, frei, raum] = await Promise.all([gruppenZahlenMitEinwilligung(), automatik(), freigabeSatz(), tagesRaum()]);
  const zahlen = zaehlung.alle;
  // E-230: Wer wartet gerade auf eine Antwort? Justin soll Stille sehen, bevor ein Kunde sie spürt.
  const { OFFENE_GESPRAECHE_SQL } = await import("./fiaon-whatsapp-mara");
  const [wartend] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n, COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - o.am)) / 60), 0)::int AS laengste
      FROM (${OFFENE_GESPRAECHE_SQL} AND r.am < NOW() - INTERVAL '2 minutes') o`).catch(() => [{ n: 0, laengste: 0 }])) as any[];
  const { waKonfig } = await import("./fiaon-whatsapp");
  const { ketteAn } = await import("./fiaon-lead-whatsapp");
  const kette = await ketteAn().catch(() => false);

  const [heute] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ok)::int AS gesendet,
           COUNT(*) FILTER (WHERE NOT ok)::int AS nicht,
           COUNT(*) FILTER (WHERE ok AND quelle = 'automatik')::int AS automatik,
           COUNT(*) FILTER (WHERE ok AND quelle = 'hand')::int AS hand
      FROM fiaon_wa_aktion
     WHERE (erstellt_am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  const [stunde] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_wa_aktion
     WHERE quelle = 'automatik' AND ok
       AND date_trunc('hour', erstellt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('hour', NOW() AT TIME ZONE 'Europe/Berlin')`) as any[];
  // Alles, was heute über WhatsApp lief — auch Begrüßung und Kette, damit Justin das Ganze sieht.
  const [alle] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE richtung = 'raus' AND vorlage IS NOT NULL AND status <> 'fehler')::int AS vorlagen,
           COUNT(*) FILTER (WHERE richtung = 'raus' AND vorlage IS NULL AND von ILIKE 'Mara%')::int AS mara_antworten,
           COUNT(*) FILTER (WHERE richtung = 'rein')::int AS rein,
           COUNT(DISTINCT person_id) FILTER (WHERE richtung = 'rein')::int AS menschen_rein,
           COUNT(*) FILTER (WHERE richtung = 'raus' AND status = 'fehler')::int AS fehler
      FROM fiaon_whatsapp
     WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`.catch(() => [{}])) as any[];
  const [wirkung] = (await sqlPool`
    WITH gesendet AS (
      SELECT person_id, MIN(erstellt_am) AS am FROM fiaon_wa_aktion
       WHERE ok AND erstellt_am > NOW() - INTERVAL '7 days' AND person_id IS NOT NULL GROUP BY person_id
    )
    SELECT COUNT(*)::int AS menschen,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.person_id = g.person_id AND w.richtung = 'rein' AND w.created_at > g.am))::int AS geantwortet,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = g.person_id AND ap.merged_into IS NULL AND NOT ap.ist_entwurf AND ap.created_at > g.am))::int AS antrag,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = g.person_id AND ap.merged_into IS NULL AND ap.payment_status IN ('paid','claimed_paid') AND COALESCE(ap.paid_at, ap.updated_at) > g.am))::int AS gezahlt
      FROM gesendet g`) as any[];
  const letzte = (await sqlPool`
    SELECT x.id, x.person_id, x.gruppe, x.vorlage, x.quelle, x.ok, x.grund, x.erstellt_am, x.ausgeloest_von,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           w.status AS zustellung,
           EXISTS (SELECT 1 FROM fiaon_whatsapp w2 WHERE w2.person_id = x.person_id AND w2.richtung = 'rein' AND w2.created_at > x.erstellt_am) AS geantwortet
      FROM fiaon_wa_aktion x
      LEFT JOIN fiaon_persons p ON p.id = x.person_id
      LEFT JOIN fiaon_whatsapp w ON w.wa_id = x.wa_id AND x.wa_id IS NOT NULL
     ORDER BY x.erstellt_am DESC LIMIT 60`) as any[];

  const vorlagenListe = WA_VORLAGEN.filter((v) => !v.varianteVon && v.name.startsWith("fiaon_kk_")).map((v) => ({
    name: v.name, kopf: v.kopf ?? "", zweck: v.zweck, text: v.text,
    frei: istFrei(v.name, frei),
    bild: frei.has(v.name.replace(/^fiaon_kk_/, "fiaon_kkb_")),
    kopfBild: WA_VORLAGEN.find((x) => x.varianteVon === v.name)?.kopfBild ?? null,
    fuss: v.fuss ?? "",
  }));

  return {
    whatsappBereit: waKonfig().bereit,
    meta: raum,
    wartend: { anzahl: Number(wartend?.n || 0), laengsteMin: Number(wartend?.laengste || 0) },
    gruppen: GRUPPEN_REIHE.map((g) => ({ schluessel: g, ...GRUPPEN[g], anzahl: zahlen[g], mitEinwilligung: zaehlung.einwilligung[g] })),
    stufenText: STUFEN_TEXT,
    vorlagen: vorlagenListe,
    automatik: { ...a, dieseStunde: Number(stunde?.n || 0) },
    kette: { an: kette, pausiert: kette && a.an },
    tagsueber: tagsueber(),
    uhr: berlinMinutenJetzt(),
    heute: {
      gesendet: Number(heute?.gesendet || 0), nicht: Number(heute?.nicht || 0),
      automatik: Number(heute?.automatik || 0), hand: Number(heute?.hand || 0),
      vorlagenGesamt: Number(alle?.vorlagen || 0), maraAntworten: Number(alle?.mara_antworten || 0),
      rein: Number(alle?.rein || 0), menschenRein: Number(alle?.menschen_rein || 0), fehler: Number(alle?.fehler || 0),
    },
    wirkung7: { menschen: Number(wirkung?.menschen || 0), geantwortet: Number(wirkung?.geantwortet || 0), antrag: Number(wirkung?.antrag || 0), gezahlt: Number(wirkung?.gezahlt || 0) },
    lauf: laufStand(),
    letzte: letzte.map((r) => ({
      id: Number(r.id), personId: r.person_id != null ? Number(r.person_id) : null, name: String(r.name || "").trim() || "Ohne Namen",
      gruppe: String(r.gruppe), vorlage: String(r.vorlage), quelle: String(r.quelle), ok: !!r.ok, grund: r.grund ?? null,
      am: new Date(r.erstellt_am).toISOString(), von: r.ausgeloest_von ?? null, zustellung: r.zustellung ?? null, geantwortet: !!r.geantwortet,
    })),
  };
}

/** Vorschau: die nächsten Empfänger mit genau dem Text, den sie bekämen. */
export async function vorschau(g: Gruppe, vorlage: string, anzahl: number) {
  const frei = await freigabeSatz();
  const liste = await kandidaten(g, Math.min(Math.max(anzahl, 1), 50));
  return liste.map((k) => {
    const v = vorlageFuerKandidat(vorlage, k);
    const w = werteFuer(v, k);
    const def = WA_VORLAGEN.find((x) => x.name === v);
    const text = def && !("grund" in w) ? def.text.replace(/\{\{(\d)\}\}/g, (_m, n) => w.werte[Number(n) - 1] ?? "") : null;
    const hinderung = !istFrei(v, frei) ? "Vorlage bei Meta noch nicht freigegeben" : "grund" in w ? w.grund : null;
    return {
      personId: k.personId, name: k.name || "Ohne Namen", tage: k.tage, vorlage: v,
      letzteVorlageAm: k.letzteVorlageAm, betrag: k.betrag, referenz: k.referenz, faelligAm: k.faelligAm, text, hinderung,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BILDVORLAGEN EINMAL BEI META EINREICHEN (E-229)
//
// Die 15 Bildfassungen (fiaon_kkb_*) müssen bei Meta geprüft werden, bevor
// waSenden auf sie umsteigt. Das geschieht EINMAL nach dem Ausrollen — die
// Zeile in fiaon_settings wird zuerst beansprucht, damit ein zweiter Dienst
// oder Neustart nicht doppelt einreicht. Bewusst NUR „einreichen, was fehlt"
// (vorlagenEinreichen) und NICHT „auffrischen": Weicht der bei Meta gespeicherte
// Text auch nur um ein Leerzeichen ab, schickte das Auffrischen eine
// freigegebene Textvorlage zurück in die Prüfung — und die Sendungen stünden
// stundenlang. Das Ergebnis steht in der Zeile.
// ═══════════════════════════════════════════════════════════════════════════
const BILD_KEY = "wa_bildvorlagen_eingereicht_e229";
export const bildvorlagenEinmalEinreichen = () => vorlagenEinmalEinreichen(BILD_KEY);

/** Einmal je Schlüssel: nur fehlende Vorlagen einreichen (E-230: fiaon_kk_rate + fiaon_kkb_rate). */
export async function vorlagenEinmalEinreichen(schluessel: string): Promise<void> {
  const { waKonfig, vorlagenEinreichen } = await import("./fiaon-whatsapp");
  if (!waKonfig().bereit) return;
  const beansprucht = (await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, 'laeuft', NOW())
    ON CONFLICT (key) DO NOTHING RETURNING key`.catch(() => [])) as any[];
  if (!beansprucht.length) return;
  try {
    const erg = await vorlagenEinreichen();
    const wert = JSON.stringify({ am: new Date().toISOString(), eingereicht: erg.eingereicht, schonDa: erg.schonDa.length, fehler: erg.fehler });
    await sqlPool`UPDATE fiaon_settings SET value = ${wert}, updated_at = NOW() WHERE key = ${schluessel}`;
    console.log(`[WA-ZENTRALE] Vorlagen eingereicht (${schluessel}): ${erg.eingereicht.length} neu, ${erg.schonDa.length} schon da, ${erg.fehler.length} Fehler${erg.fehler.length ? ` — ${erg.fehler.map((f) => `${f.name}: ${f.grund}`).join(" | ").slice(0, 400)}` : ""}`);
  } catch (e) {
    const wert = JSON.stringify({ am: new Date().toISOString(), abbruch: String((e as Error)?.message || e).slice(0, 300) });
    await sqlPool`UPDATE fiaon_settings SET value = ${wert}, updated_at = NOW() WHERE key = ${schluessel}`.catch(() => {});
    console.error(`[WA-ZENTRALE] Vorlagen einreichen (${schluessel}):`, e);
  }
}
