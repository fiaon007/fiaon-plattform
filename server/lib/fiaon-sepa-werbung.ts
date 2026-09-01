// ═══════════════════════════════════════════════════════════════════════════
// DIE LASTSCHRIFT-EINLADUNG — ein Lauf statt 409 Handklicks (01.09.2026, E-072)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Am 01.09.2026 hatten 409 aktive Abos eine bezahlte erste Rate und KEIN
// Lastschriftmandat — 0 von 6.334 Personen. Die Technik dafür ist seit dem
// 22.08. fertig und live (fiaon-lastschrift.ts, GoCardless-Livezugang), die
// Mailvorlage seit dem 24.08. Verschickt wurde sie 23-mal: Sie hing an einem
// Knopf auf der Kundenkarte, den ein Mitarbeiter je Kunde einzeln drücken
// musste. Bei 409 Kunden drückt den niemand.
//
// Die Folge in Zahlen: Von 218 fälligen zweiten Raten wurden 28 bezahlt
// (12,8 %). Ein Abo-Bestand pendelt sich auf Neukunden / (1 − Ratentreue)
// ein — bei 170 Neukunden im Monat also auf 195 Kunden. Genau dort steht der
// Umsatz seit Juli. Der Deckel sitzt nicht im Vertrieb, sondern hier.
//
// ── WAS DIESER LAUF TUT ───────────────────────────────────────────────────
// Er sucht Kunden mit bezahlter erster Rate und ohne aktives Mandat und lädt
// sie ein. Nicht mehr. Er bucht nichts, zieht nichts ein und ändert keinen
// Kundenzustand — die Entscheidung trifft der Kunde bei GoCardless.
//
// ── DIE BREMSEN, UND WARUM JEDE EINE GIBT ─────────────────────────────────
// 1. `sepa_werbung_pro_tag` steht standardmäßig auf 0: Der Lauf tut nach dem
//    Ausrollen NICHTS, bis jemand bewusst eine Zahl setzt. Ein Merge darf
//    keine Mailwelle auslösen.
// 2. Höchstens `MAX_EINLADUNGEN` Einladungen je Kunde, mit `ABSTAND_TAGE`
//    dazwischen. Wer dreimal nicht wollte, will nicht — weiter zu fragen wäre
//    Belästigung und kostet Zustellbarkeit.
// 3. Nachtruhe wie in der Lead-Strecke. Eine Zahlungsmail um 3 Uhr früh
//    erschreckt Menschen, deren Geld knapp ist.
// 4. Die Zählung der bisherigen Einladungen kommt aus `fiaon_mail_log` —
//    kein neues Feld, keine zweite Wahrheit, und der Lauf ist damit auch
//    nach einem Neustart nicht vergesslich.
//
// Versand IMMER über `versendenUndProtokollieren` (der eine Weg, Schalter
// `mail_versandweg` steht auf „direkt“/Brevo). Kein zweiter Versandweg.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { versendenUndProtokollieren } from "./fiaon-mail-log";
import { sepaLink } from "../routes/fiaon-lastschrift";
import { absoluteUrl } from "../fiaon-base-url";

// ── DIE DREI STELLSCHRAUBEN (Justin, 01.09.2026) ──────────────────────────
// „Der Kunde soll jeden 2. Tag an die Einrichtung erinnert werden" und „jetzt
// kannst du an ALLE Kunden die Einladung schicken". Beides steht in den
// Einstellungen, nicht im Quelltext — damit sich der Takt ohne Auslieferung
// nachziehen lässt, wenn die Zahlen etwas anderes sagen.
//
// `sepa_werbung_abstand_tage`  Standard 2  — Abstand zwischen zwei Einladungen
// `sepa_werbung_max`           Standard 10 — Einladungen je Kunde, dann Schluss
// `sepa_werbung_pro_tag`       Standard 0  — Tagesdeckel; 0 heißt: Lauf ist AUS
//
// Warum trotz „an alle" ein Deckel bleibt: Er ist der Notausschalter. Wer ihn
// auf 0 setzt, stoppt die Strecke sofort, ohne Auslieferung. Für „alle" setzt
// man ihn auf 500 — dann ist er wirkungslos und trotzdem greifbar.
//
// Warum bei 10 Einladungen Schluss ist: Alle zwei Tage sind das drei Wochen.
// Wer bis dahin nicht wollte, will nicht. Weiter zu senden kostet nur noch
// Zustellbarkeit — und die brauchen die 15.934 Zahlungserinnerungen im Monat.
const STANDARD_ABSTAND_TAGE = 2;
const STANDARD_MAX = 10;
/** Nachtruhe in Europe/Berlin: vor 8:00 und ab 20:00 geht nichts raus. */
const RUHE_BIS = 8, RUHE_AB = 20;

/** Eine Zahl aus fiaon_settings, mit Standardwert und Deckel. */
async function einstellung(schluessel: string, standard: number, hoechstens: number): Promise<number> {
  try {
    const [r] = (await sqlPool`
      SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    if (r?.value === undefined || r?.value === null || String(r.value).trim() === "") return standard;
    const n = Number(String(r.value).trim());
    return Number.isFinite(n) && n >= 0 ? Math.min(hoechstens, Math.floor(n)) : standard;
  } catch {
    return standard;
  }
}

/** Der Tagesdeckel. 0 (Standard) heißt: Lauf aus — ein Merge löst nichts aus. */
async function tagesDeckel(): Promise<number> {
  return einstellung("sepa_werbung_pro_tag", 0, 1000);
}

function berlinStunde(): number {
  return Number(new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", hour12: false,
  }).format(new Date()));
}

export interface SepaWerbungErgebnis {
  geprueft: number; verschickt: number; uebersprungen: number; deckel: number; grund?: string;
}

/**
 * Ein Durchlauf. Wird vom Tageslauf getaktet und ist absichtlich klein:
 * Er verschickt höchstens den Tagesdeckel und läuft lieber häufiger.
 */
export async function sepaWerbungLauf(): Promise<SepaWerbungErgebnis> {
  const deckel = await tagesDeckel();
  if (deckel <= 0) {
    return { geprueft: 0, verschickt: 0, uebersprungen: 0, deckel: 0, grund: "abgeschaltet (sepa_werbung_pro_tag = 0)" };
  }
  const std = berlinStunde();
  if (std < RUHE_BIS || std >= RUHE_AB) {
    return { geprueft: 0, verschickt: 0, uebersprungen: 0, deckel, grund: "Nachtruhe" };
  }

  // Was heute schon rausging, wird abgezogen — der Deckel gilt je Tag, nicht
  // je Durchlauf. Sonst würde ein 30-Minuten-Takt ihn 48-mal ausschöpfen.
  const [heute] = (await sqlPool`
    SELECT COUNT(*)::int n FROM fiaon_mail_log
     WHERE event = 'sepa_einrichten' AND art = 'echt' AND status = 'versandt'
       AND created_at > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'`) as any[];
  const rest = deckel - Number(heute?.n || 0);
  if (rest <= 0) return { geprueft: 0, verschickt: 0, uebersprungen: 0, deckel, grund: "Tagesdeckel erreicht" };

  const abstandTage = await einstellung("sepa_werbung_abstand_tage", STANDARD_ABSTAND_TAGE, 90);
  const maxEinladungen = await einstellung("sepa_werbung_max", STANDARD_MAX, 50);

  // ── DIE ZIELGRUPPE ──────────────────────────────────────────────────────
  // Bezahltes, laufendes Abo ohne aktives Mandat, mit Mailadresse, kein Test.
  // `letzte`/`anzahl` kommen aus dem Protokoll: Wer schon eingeladen wurde,
  // wartet den Abstand ab; wer die Höchstzahl erreicht hat, fällt raus.
  // `offen_cents` ist die Summe der überfälligen Raten — sie kommt in die Mail,
  // weil der Bankeinzug genau diese Raten abrufen wird. Wer das erst bei der
  // Abbuchung erfährt, widerruft sie.
  const kandidaten = (await sqlPool`
    WITH bisher AS (
      SELECT person_id, COUNT(*)::int anzahl, MAX(created_at) letzte
        FROM fiaon_mail_log
       WHERE event = 'sepa_einrichten' AND status = 'versandt' AND person_id IS NOT NULL
       GROUP BY person_id
    )
    SELECT a.ref, a.person_id, a.first_name, a.email,
           COALESCE(b.anzahl, 0) AS anzahl,
           COALESCE((SELECT SUM(r.betrag_cents) FROM fiaon_abo_raten r
                      WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL
                        AND r.faellig_am < CURRENT_DATE), 0)::int AS offen_cents
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN bisher b ON b.person_id = a.person_id
     WHERE a.payment_status = 'paid'
       AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.ref NOT LIKE 'FIAON-SCHUFA-%' AND a.ref NOT LIKE 'FIAON-TEST%'
       AND a.abo_gestoppt_am IS NULL AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
       AND a.amount_due IS NOT NULL AND a.amount_due > 0
       AND a.email IS NOT NULL AND a.email <> ''
       AND p.ist_test_am IS NULL
       AND COALESCE(p.gc_mandate_status, '') <> 'active'
       AND COALESCE(b.anzahl, 0) < ${maxEinladungen}
       AND (b.letzte IS NULL OR b.letzte < NOW() - (${abstandTage} || ' days')::interval)
     ORDER BY COALESCE(b.anzahl, 0) ASC, a.paid_at DESC NULLS LAST
     LIMIT ${rest}`) as any[];

  const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",");

  let verschickt = 0, uebersprungen = 0;
  for (const k of kandidaten) {
    try {
      // ── DIE OFFENE RATE WIRD ANGESAGT, NICHT VERSCHWIEGEN ──────────────
      // Der Bankeinzug ruft überfälliges gestaffelt ab (erster Abruf nach drei
      // Tagen, jeder weitere eine Woche später — siehe fiaon-lastschrift.ts).
      // Wer das vorher liest, rechnet damit. Wer davon überrascht wird,
      // widerruft die Lastschrift und ist doppelt verloren.
      const offen = Number(k.offen_cents || 0);
      const hinweis = offen > 0
        ? `Bei Ihnen ist derzeit eine offene Rate von ${euro(offen)} € fällig. Sobald der Bankeinzug steht, holen wir sie in etwa drei Tagen nach — bei mehreren offenen Raten im Abstand von je einer Woche, damit nicht alles auf einmal von Ihrem Konto geht.`
        : "";
      const erg = await versendenUndProtokollieren("sepa_einrichten" as any, {
        email: String(k.email),
        vorname: k.first_name || "",
        agent_vorname: "Ihr Team von FIAON",
        sepa_link: sepaLink(String(k.ref)),
        kundenbereich_link: absoluteUrl("/dashboard#abo"),
        payment_reference: k.ref,
        offene_rate_hinweis: hinweis,
      } as any, {
        personId: Number(k.person_id),
        verlaufRef: String(k.ref),
        verlaufText: `Einladung zum Bankeinzug verschickt (Einladung ${Number(k.anzahl) + 1} von ${maxEinladungen}).`,
        // Kein `ausgeloestVon`: Das ist eine Automatik, und das Protokoll
        // soll das auch so ausweisen — nicht einen Mitarbeiter benennen,
        // der nicht geklickt hat.
      });
      if (erg.status === "versandt") verschickt++; else uebersprungen++;
    } catch (e) {
      uebersprungen++;
      console.error("[SEPA-WERBUNG]", k.ref, e);
    }
  }
  return { geprueft: kandidaten.length, verschickt, uebersprungen, deckel };
}
