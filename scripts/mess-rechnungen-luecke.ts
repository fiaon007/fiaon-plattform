// ═══════════════════════════════════════════════════════════════════════════
// SIND DIE RECHNUNGEN RAUSGEGANGEN — ODER FEHLT NUR DAS PROTOKOLL?
//
// ── DIE OFFENE FRAGE (Betreiber, 21.08.2026) ──────────────────────────────
// „Du hast gefunden, dass wegen Kommentarzeilen im SQL-Template seit 19.08.
// kein Akteneintrag ‚Erste Rechnung gestellt' mehr geschrieben wurde. Offene
// Frage, die du nicht beantwortet hast: Sind die Rechnungen selbst rausgegangen,
// oder nur das Protokoll fehlt?"
//
// Die Frage ist berechtigt und ich habe sie gestern offen gelassen.
//
// ── WAS DER CODE SAGT (und warum das nicht genügt) ────────────────────────
// In `rechnungStellen` steht die Reihenfolge: erst UPDATE (Betrag, Frist,
// Zustand), dann `sendMakeWebhookMitGrund`, DANN der Verlaufseintrag. Der
// kaputte Eintrag war der LETZTE Schritt — die Mail müsste also raus sein.
//
// „Müsste" ist keine Messung. Der Code beweist die Absicht, nicht das Ergebnis:
// Der Versand hätte auch aus einem anderen Grund scheitern können, und dann
// stünde davon nirgends etwas (der Verlaufseintrag, der es festgehalten hätte,
// war ja gerade der kaputte).
//
// ── DREI TÖPFE ───────────────────────────────────────────────────────────
//   A  versendet UND protokolliert
//   B  versendet, aber NICHT protokolliert   ← der Schaden, den ich gefunden habe
//   C  gar nicht versendet                    ← der Schaden, den ich befürchtet habe
//
// Maßgeblich ist `fiaon_mail_log`: Dort steht, was die Mail-Kette
// angenommen hat. Sie wird VOR dem Verlaufseintrag geschrieben und war nicht
// betroffen.
//
// NUR LESEND. Schreibt reports/rechnungen-19-08-luecke.csv.
//
//   npx tsx scripts/mess-rechnungen-luecke.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

/** Der Tag, an dem der kaputte Kommentar eingebaut wurde. */
export const AB_TAG = "2026-08-19";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  titel(`1 — WELCHE ERSTEN RECHNUNGEN WURDEN SEIT DEM ${AB_TAG} GESTELLT?`);
  // ══════════════════════════════════════════════════════════════════════
  // DER STELLTAG WIRD AUS DER FRIST ZURÜCKGERECHNET, NICHT AUS updated_at
  //
  // ── DER FEHLER IM ERSTEN ENTWURF (21.08.2026) ────────────────────────
  // Die Auswahl lautete `updated_at >= 19.08.` Damit fielen 689 Bestellungen
  // in die Messung — und weil für die meisten keine Mail von dieser Woche
  // existiert, landeten 610 im Topf „gar nicht versendet". Das wäre eine
  // Katastrophenmeldung gewesen, und sie war falsch.
  //
  // `updated_at` wird von JEDEM Lauf angefasst. GEMESSEN: 689 Zeilen tragen
  // ein frisches `updated_at`, aber nur 63 einen Stelltag ab dem 19.08. Die
  // anderen 626 haben ihre Rechnung längst bekommen und wurden nur berührt.
  //
  // Dieselbe Falle hat mich am selben Tag schon einmal erwischt (Bestandswache,
  // `MAX(updated_at)` als Zahlungsdatum). Deshalb steht sie hier ausgeschrieben:
  // Eine Spalte, die „irgendetwas hat sich geändert" bedeutet, taugt für keine
  // Frage, die „wann ist DAS passiert" lautet.
  //
  // `rechnungStellen` setzt `payment_due_date = Lauftag + ZAHLUNGSFRIST_TAGE`.
  // Das ist der einzige verlässliche Marker — die Funktion schreibt kein
  // eigenes Stelldatum.
  // ══════════════════════════════════════════════════════════════════════
  const gestellt = (await sqlPool`
    SELECT a.ref, a.person_id, a.pack_name, a.amount_due, a.payment_reference,
           a.payment_status, a.payment_due_date, a.updated_at,
           COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''),
                    NULLIF(TRIM(a.billing_email), ''), NULLIF(TRIM(p.primary_email), '')) AS empfaenger,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           -- TOPF-ENTSCHEIDUNG 1: Hat die Mail-Kette eine Sendung angenommen?
           (SELECT MAX(l.created_at) FROM fiaon_mail_log l
             WHERE l.event = 'payment_details' AND l.status = 'versandt'
               AND l.created_at >= ${AB_TAG}::date
               AND (l.person_id = a.person_id
                 OR LOWER(TRIM(COALESCE(l.empfaenger, ''))) = LOWER(TRIM(COALESCE(a.email, 'x')))))
             AS mail_am,
           (SELECT l.grund FROM fiaon_mail_log l
             WHERE l.event = 'payment_details' AND l.status <> 'versandt'
               AND l.created_at >= ${AB_TAG}::date AND l.person_id = a.person_id
             ORDER BY l.created_at DESC LIMIT 1) AS mail_fehler,
           -- TOPF-ENTSCHEIDUNG 1b: Der zweite Nachweis. Die automatische
           -- Antragsstrecke setzt diese Spalte und schreibt nicht ins
           -- Zustellprotokoll (Begründung unten bei den Töpfen).
           a.payment_email_sent_at AS email_sent_at,
           -- TOPF-ENTSCHEIDUNG 2: Steht der Vorgang in der Akte?
           (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
             WHERE cl.ref = a.ref AND cl.note ILIKE '%Erste Rechnung gestellt%'
               AND cl.voided_at IS NULL) AS akte_am
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_due_date IS NOT NULL
      AND a.amount_due IS NOT NULL
      AND (a.payment_due_date - INTERVAL '7 days')::date >= ${AB_TAG}::date
    ORDER BY a.payment_due_date
  `) as any[];
  log(`  ${z(gestellt.length)}  erste Rechnungen gestellt (Stelltag ab dem ${AB_TAG})`);
  const [weit] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND payment_due_date IS NOT NULL AND amount_due IS NOT NULL
      AND updated_at >= ${AB_TAG}::date
  `) as any[];
  log(`  ${z(Number(weit.n))}  hätte die zu weite Auswahl über updated_at ergeben `
    + `(${Number(weit.n) - gestellt.length} davon berührt, nicht gestellt)`);

  // ══════════════════════════════════════════════════════════════════════
  // ZWEI NACHWEISE FÜR „VERSENDET", NICHT EINER
  //
  // ── DER BEFUND (21.08.2026) ──────────────────────────────────────────
  // Der erste Entwurf las nur `fiaon_mail_log` und legte fünf Bestellungen
  // in Topf C. Nachgesehen: Alle fünf tragen ein `payment_email_sent_at`
  // (19.08. 08:06 bis 21.08. 09:32) und haben NULL Zeilen im Zustellprotokoll.
  //
  // Sie kommen nicht von `rechnungStellen`, sondern aus der automatischen
  // Antragsstrecke: Der Kunde stellt den Antrag fertig, das System schickt die
  // Zahlungsdaten sofort und setzt `payment_email_sent_at`. Dieser Weg
  // schreibt NICHT ins Zustellprotokoll — ein blinder Fleck, aber kein
  // Versandausfall.
  //
  // Wer nur eine Quelle liest, erklärt fünf Kunden zu Opfern, die ihre
  // Rechnung längst haben. Deshalb zählt hier BEIDES als Nachweis.
  // ══════════════════════════════════════════════════════════════════════
  const raus = (r: any) => !!r.mail_am || !!r.email_sent_at;
  const A = gestellt.filter((r) => raus(r) && r.akte_am);
  const B = gestellt.filter((r) => raus(r) && !r.akte_am);
  const C = gestellt.filter((r) => !raus(r));
  const nurSpalte = B.filter((r) => !r.mail_am && r.email_sent_at);

  titel("2 — DIE DREI TÖPFE");
  log(`  ${z(A.length)}  A  versendet UND protokolliert`);
  log(`  ${z(B.length)}  B  versendet, aber NICHT protokolliert  ← nur das Protokoll fehlt`);
  log(`  ${z(C.length)}  C  gar nicht versendet                  ← der teure Fall`);
  log(`\n  ${z(nurSpalte.length)}  davon nur über payment_email_sent_at nachweisbar `
    + "(automatische Antragsstrecke, schreibt nicht ins Zustellprotokoll)");

  titel("3 — GEGENPROBE AM ZUSTELLPROTOKOLL");
  // Wenn Topf B stimmt, muss es im Zustellprotokoll deutlich mehr
  // `payment_details` geben als Akteneinträge. Zwei unabhängige Zählungen,
  // damit die Einteilung oben nicht ihre eigene Bestätigung ist.
  const [mails] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE status = 'versandt')::int AS versandt,
           COUNT(*) FILTER (WHERE status <> 'versandt')::int AS nicht
    FROM fiaon_mail_log
    WHERE event = 'payment_details' AND created_at >= ${AB_TAG}::date
  `) as any[];
  const [akten] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_contact_log
    WHERE note ILIKE '%Erste Rechnung gestellt%' AND created_at >= ${AB_TAG}::date
      AND voided_at IS NULL
  `) as any[];
  log(`  ${z(Number(mails.gesamt))}  Sendungen „payment_details" im Zustellprotokoll `
    + `(${mails.versandt} versandt, ${mails.nicht} nicht)`);
  log(`  ${z(Number(akten.n))}  Akteneinträge „Erste Rechnung gestellt"`);
  log(Number(akten.n) === 0
    ? "\n  NULL Akteneinträge bei " + mails.versandt + " versandten Mails — das ist der\n"
      + "  Fingerabdruck des kaputten SQL-Kommentars, und er bestätigt Topf B."
    : `\n  ${akten.n} Akteneinträge — der Eintrag hat also zeitweise funktioniert.`);

  titel("4 — TOPF C, NAMENTLICH (nicht versendet)");
  if (C.length === 0) log("  Keiner. Jede gestellte Rechnung hat das Haus verlassen.");
  for (const r of C.slice(0, 25)) {
    log(`  ${String(r.ref).padEnd(22)} ${String(r.name).slice(0, 26).padEnd(27)} `
      + `${r.empfaenger ? String(r.empfaenger).slice(0, 30) : "OHNE ADRESSE"}  `
      + `${r.mail_fehler ? `Grund: ${String(r.mail_fehler).slice(0, 40)}` : "kein Protokolleintrag"}`);
  }
  if (C.length > 25) log(`  … und ${C.length - 25} weitere (alle in der CSV)`);

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/rechnungen-19-08-luecke.csv", "\uFEFF" + [
    ["topf", "ref", "person_id", "name", "paket", "betrag", "verwendungszweck",
      "empfaenger", "zahlungsstand", "mail_versandt_am", "payment_email_sent_at",
      "mail_fehler", "akteneintrag_am"],
    ...gestellt.map((r) => [
      (r.mail_am || r.email_sent_at) && r.akte_am ? "A versendet+protokolliert"
        : (r.mail_am || r.email_sent_at) ? "B versendet ohne Protokoll" : "C nicht versendet",
      r.ref, r.person_id ?? "", r.name, String(r.pack_name ?? "").split("\n")[0],
      r.amount_due ?? "", r.payment_reference ?? "", r.empfaenger ?? "",
      r.payment_status,
      r.mail_am ? new Date(r.mail_am).toLocaleString("de-DE") : "",
      r.email_sent_at ? new Date(r.email_sent_at).toLocaleString("de-DE") : "",
      r.mail_fehler ?? "",
      r.akte_am ? new Date(r.akte_am).toLocaleString("de-DE") : "",
    ]),
  ].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → reports/rechnungen-19-08-luecke.csv (${gestellt.length} Zeilen)`);

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
