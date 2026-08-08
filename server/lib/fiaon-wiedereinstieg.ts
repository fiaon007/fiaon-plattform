// ═══════════════════════════════════════════════════════════════════════════
// WIEDEREINSTIEG — statt einer peinlichen Spät-Mahnung ein Terminangebot
//
// DIE LAGE
// 269 Personen haben eine offene Rechnung oder einen fertigen Antrag, bei
// vielen liegt der letzte Kontakt Wochen zurück. Eine Zahlungserinnerung nach
// sechs Wochen Funkstille liest sich wie ein Inkassobrief für etwas, das der
// Kunde längst vergessen hat. Ein Terminangebot dagegen ist ein Anlass, das
// Gespräch neu zu beginnen — und kostet niemanden das Gesicht.
//
// DIE AUSSCHLÜSSE SIND DER EIGENTLICHE INHALT DIESER DATEI
// Eine Massenmail an den Bestand ist genau so lange eine gute Idee, bis sie
// den Falschen erreicht. Wer bezahlt hat, wer abgesagt hat, wer gesperrt oder
// gelöscht ist, wer schon einen Termin hat — die dürfen diese Mail NIE
// bekommen. Deshalb steht die Zielgruppe hier einmal und wird von Vorschau,
// Tagesstaffel und Prüfstand gemeinsam benutzt. Zwei Fassungen davon wären
// der Weg, auf dem irgendwann ein bezahlter Kunde eine Mahnung bekommt.
//
// GESTAFFELT, NICHT AUF EINMAL
// Höchstens 50 am Tag. Nicht aus Vorsicht vor der Technik, sondern vor den
// Folgen: 269 Mails auf einmal erzeugen 269 mögliche Rückrufe an einem
// Vormittag, und die Zustellbarkeit einer Domain, die sonst 20 Mails am Tag
// verschickt, überlebt einen solchen Ausschlag selten unbeschadet.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { terminLink } from "./fiaon-termine";
import { versendenUndProtokollieren } from "./fiaon-mail-log";
import { stufeAusTier } from "@shared/fiaon-kundenstatus";

type Lauf = typeof sqlPool;

/** Höchstens so viele Wiedereinstiegs-Mails pro Tag. */
export const STAFFEL_PRO_TAG = 50;
/** So lange muss Funkstille herrschen, bevor jemand angeschrieben wird. */
export const STILLE_TAGE = 14;

export interface Kandidat {
  personId: number;
  name: string;
  email: string;
  stufe: string;
  tierGrund: string;
  letzterKontakt: string | null;
  versuche: number;
  ruht: boolean;
}

/**
 * Die Zielgruppe. EINE Abfrage, aus der Vorschau UND Versand schöpfen.
 *
 * @param limit Höchstzahl der Zeilen (die Vorschau will alle, der Versand 50).
 */
export async function wiedereinstiegKandidaten(
  limit: number | null = null, lauf: Lauf = sqlPool,
): Promise<Kandidat[]> {
  const rows = (await lauf`
    SELECT p.id, p.priority_tier, p.tier_reason, p.unreachable_count, p.ruhe_seit,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email) AS name,
           COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
           p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1
           )) AS email,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
           (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
             JOIN fiaon_applications a2 ON a2.ref = cl.ref
             WHERE a2.person_id = p.id AND cl.voided_at IS NULL
               AND cl.type <> 'system' AND cl.agent_id IS NOT NULL) AS letzter_kontakt,
           (SELECT a3.ref FROM fiaon_applications a3
             WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
             ORDER BY a3.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL
      -- ZIELGRUPPE: offene Rechnung oder fertiger Antrag (Stufe A und B).
      AND p.priority_tier IN (1, 2)
      -- ── AUSSCHLÜSSE ──────────────────────────────────────────────────────
      AND NOT p.is_blocked                       -- abgelehnt oder Kontaktsperre
      AND COALESCE(p.account_status, '') <> 'suspended'
      AND p.wiedereinstieg_am IS NULL            -- hat die Mail schon bekommen
      AND p.terminlink_mail_am IS NULL           -- hat den Link schon über die
                                                 -- Nicht-erreicht-Automatik
      -- Kein gebuchter Termin: Wer schon einen hat, braucht keine Einladung.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW()
      )
      -- Keine bezahlte, erstattete oder DSGVO-gelöschte Bestellung im Spiel.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications ax
        WHERE ax.person_id = p.id AND ax.merged_into IS NULL
          AND (ax.payment_status = 'paid' OR ax.gdpr_deleted_at IS NOT NULL)
      )
      -- Mindestens eine lebende, nicht archivierte Bestellung mit offenem Geld.
      AND EXISTS (
        SELECT 1 FROM fiaon_applications ay
        WHERE ay.person_id = p.id AND ay.merged_into IS NULL AND ay.archived_at IS NULL
          AND ay.gdpr_deleted_at IS NULL
          AND ay.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      )
      -- Kein Testkonto und keine Attrappen-Adresse. „Test Test" stand im
      -- ersten Vorschaulauf mit in der Liste — ein Datensatz, der eine echte
      -- Mail an eine echte Adresse ausgelöst hätte.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_agents tg WHERE tg.id = p.assigned_agent_id AND tg.is_test_account
      )
      AND COALESCE(p.first_name, '') !~* '^(test|demo|probe|dummy)$'
      AND COALESCE(p.last_name, '')  !~* '^(test|demo|probe|dummy)$'
      AND COALESCE(p.primary_email, '') !~* '(example\.|test@|@test\.|\.invalid$)'
      -- ── FUNKSTILLE: seit mindestens 14 Tagen nichts vom Kunden ───────────
      -- WICHTIG: die Spalte assigned_at gehört hier NICHT hinein. Sie sagt „wann bekam
      -- dieser Agent die Person", nicht „wann sprach jemand mit ihr" — ein
      -- rein interner Vorgang. Ein erster Entwurf hat es benutzt, und weil die
      -- Erstverteilung am 03.–08.08.2026 lief, sah jeder Kunde frisch
      -- kontaktiert aus: von 283 Kandidaten blieben 3 übrig. Eine Umverteilung
      -- im Haus darf nicht so aussehen, als hätte man den Kunden angerufen.
      --
      -- Aus demselben Grund zählen Zeilen vom Typ 'system' NICHT: Das sind
      -- Notizen, die sich das Haus selbst schreibt („Zugeteilt", „Terminlink
      -- versandt", sogar „VERSAND FEHLGESCHLAGEN"). Am 08.08.2026 setzte
      -- ausgerechnet die Notiz über eine NICHT versandte Mail die Stille-Uhr
      -- auf null und leerte damit die Zielgruppe komplett.
      --
      -- Gemessen wird deshalb: der letzte Kontakt, den ein MENSCH
      -- dokumentiert hat, sonst der letzte Schritt des KUNDEN (seine jüngste
      -- Bestellung), sonst sein Anlegedatum.
      AND COALESCE((
        SELECT MAX(cl2.created_at) FROM fiaon_contact_log cl2
        JOIN fiaon_applications a4 ON a4.ref = cl2.ref
        WHERE a4.person_id = p.id AND cl2.voided_at IS NULL
          AND cl2.type <> 'system' AND cl2.agent_id IS NOT NULL
      ), (
        SELECT MAX(a7.created_at) FROM fiaon_applications a7
        WHERE a7.person_id = p.id AND a7.merged_into IS NULL
      ), p.created_at) < NOW() - (${STILLE_TAGE} || ' days')::interval
      -- E-Mail muss es geben — ohne sie gibt es nichts zu senden.
      AND COALESCE(NULLIF(p.primary_email, ''), (
        SELECT NULLIF(COALESCE(a5.email, a5.contact_email, a5.billing_email), '')
        FROM fiaon_applications a5
        WHERE a5.person_id = p.id AND a5.merged_into IS NULL
        ORDER BY a5.created_at DESC LIMIT 1
      )) IS NOT NULL
    -- Die Ältesten zuerst: Wer am längsten nichts gehört hat, ist am ehesten
    -- verloren, wenn nichts passiert.
    ORDER BY COALESCE((
      SELECT MAX(cl3.created_at) FROM fiaon_contact_log cl3
      JOIN fiaon_applications a6 ON a6.ref = cl3.ref
      WHERE a6.person_id = p.id AND cl3.voided_at IS NULL
        AND cl3.type <> 'system' AND cl3.agent_id IS NOT NULL
    ), (
      SELECT MAX(a8.created_at) FROM fiaon_applications a8
      WHERE a8.person_id = p.id AND a8.merged_into IS NULL
    ), p.created_at) ASC NULLS FIRST, p.id ASC
    ${limit ? lauf`LIMIT ${limit}` : lauf``}
  `) as any[];

  return rows.map((r) => ({
    personId: Number(r.id),
    name: String(r.name || `Person ${r.id}`),
    email: String(r.email),
    stufe: stufeAusTier(r.priority_tier)?.marke ?? "—",
    tierGrund: String(r.tier_reason || ""),
    letzterKontakt: r.letzter_kontakt ? new Date(r.letzter_kontakt).toISOString() : null,
    versuche: Number(r.unreachable_count || 0),
    ruht: !!r.ruhe_seit,
    // Für den Versand mitgeschleppt, aber nicht Teil der öffentlichen Form.
    ...({ _vorname: r.vorname, _nachname: r.nachname, _agent: r.agent_vorname, _ref: r.ref } as any),
  }));
}

/**
 * Verschickt die nächste Tagesstaffel. Wird vom Tageslauf aufgerufen.
 *
 * Idempotent über `wiedereinstieg_am`: Wer die Mail hat, fällt aus der
 * Zielgruppe. Ein zweiter Aufruf am selben Tag findet dieselben 50 nicht noch
 * einmal — er findet die nächsten 50. Deshalb die Tagessperre darüber.
 */
export async function wiedereinstiegTagesstaffel(
  opts: { force?: boolean; anzahl?: number } = {},
): Promise<{ ausgefuehrt: boolean; grund?: string; versandt: number; fehlgeschlagen: number }> {
  const heute = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  if (!opts.force) {
    const [s] = (await sqlPool`
      SELECT value FROM fiaon_settings WHERE key = 'wiedereinstieg_last_run'
    `) as any[];
    if (s?.value === heute) return { ausgefuehrt: false, grund: "heute bereits gelaufen", versandt: 0, fehlgeschlagen: 0 };
  }

  // ── IST DER KANAL ÜBERHAUPT DA? ────────────────────────────────────────
  // Ohne MAKE_WEBHOOK_URL kann keine einzige Mail rausgehen. Ohne diese
  // Prüfung markiert die Staffel trotzdem 50 Menschen als „angeschrieben",
  // sie fallen aus der Zielgruppe — und niemand hat je etwas bekommen.
  // Genau das ist am 08.08.2026 passiert: Der Entwicklungsserver hat den
  // Tageslauf ausgeführt, 26 echte Kunden wurden verbrannt, null Mails
  // versandt. Ein Entwicklungsrechner hat diese Variable nie gesetzt.
  if (!process.env.MAKE_WEBHOOK_URL) {
    console.warn("[WIEDEREINSTIEG] MAKE_WEBHOOK_URL fehlt — Staffel wird NICHT ausgeführt.");
    return { ausgefuehrt: false, grund: "MAKE_WEBHOOK_URL ist nicht gesetzt", versandt: 0, fehlgeschlagen: 0 };
  }

  const kandidaten = await wiedereinstiegKandidaten(opts.anzahl ?? STAFFEL_PRO_TAG);
  if (kandidaten.length === 0) {
    return { ausgefuehrt: true, grund: "keine Kandidaten", versandt: 0, fehlgeschlagen: 0 };
  }

  let versandt = 0;
  let fehlgeschlagen = 0;
  for (const k of kandidaten as any[]) {
    // ── EIN TOTER KANAL IST KEIN EMPFÄNGERPROBLEM ────────────────────────
    // Scheitern die ersten drei hintereinander, liegt es nicht an drei
    // Adressen, sondern an Make (Szenario aus, Zweig fehlt, Netz weg). Dann
    // wird abgebrochen, BEVOR der Rest der Staffel verbrannt ist. Einzelne
    // Fehlschläge dazwischen sind etwas anderes und werden markiert.
    if (versandt === 0 && fehlgeschlagen >= 3) {
      console.error(`[WIEDEREINSTIEG] Abbruch: ${fehlgeschlagen} Fehlschläge, kein einziger Versand — der Kanal ist tot.`);
      return { ausgefuehrt: false, grund: `Kanal tot (${fehlgeschlagen}× fehlgeschlagen, 0 versandt)`, versandt, fehlgeschlagen };
    }
    const ergebnis = await versendenUndProtokollieren(
      "nicht_erreicht_termin",
      {
        email: k.email,
        vorname: k._vorname || null,
        nachname: k._nachname || null,
        agent_vorname: String(k._agent || "Ihr Ansprechpartner"),
        termin_link: terminLink(k.personId),
      },
      {
        personId: k.personId,
        verlaufRef: k._ref || null,
        verlaufText: "Wiedereinstieg: Terminlink versandt (Stufe " + k.stufe + ", seit über 14 Tagen kein Kontakt).",
      },
    );
    if (ergebnis.status === "versandt") versandt++;
    else fehlgeschlagen++;
    // Auch bei Fehlschlag markieren: Sonst versucht die Staffel morgen
    // dieselben 50 erneut und kommt nie bei den anderen an. Der Fehlschlag
    // steht im Mail-Protokoll und in der Akte.
    await sqlPool`UPDATE fiaon_persons SET wiedereinstieg_am = NOW() WHERE id = ${k.personId}`;
  }

  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('wiedereinstieg_last_run', ${heute}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${heute}, updated_at = NOW()
  `;
  console.log(`[WIEDEREINSTIEG] Staffel: ${versandt} versandt, ${fehlgeschlagen} fehlgeschlagen`);
  return { ausgefuehrt: true, versandt, fehlgeschlagen };
}

/** Kennzahl für den Vertriebsbereich: versandt / gebucht / Quote. */
export async function wiedereinstiegKennzahl(lauf: Lauf = sqlPool): Promise<{
  versandt: number; gebucht: number; quote: number; offen: number;
}> {
  const [z] = (await lauf`
    SELECT
      COUNT(*) FILTER (WHERE p.wiedereinstieg_am IS NOT NULL)::int AS versandt,
      COUNT(*) FILTER (WHERE p.wiedereinstieg_am IS NOT NULL AND EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.beginn > p.wiedereinstieg_am
      ))::int AS gebucht
    FROM fiaon_persons p WHERE p.merged_into_person_id IS NULL
  `) as any[];
  const versandt = Number(z?.versandt || 0);
  const gebucht = Number(z?.gebucht || 0);
  const offen = (await wiedereinstiegKandidaten(null, lauf)).length;
  return {
    versandt, gebucht,
    quote: versandt > 0 ? Math.round((gebucht / versandt) * 1000) / 10 : 0,
    offen,
  };
}
