// ═══════════════════════════════════════════════════════════════════════════
// EINE TÜR FÜR JEDE MAIL
//
// Vor diesem Paket gab es 25 Stellen, die `sendMakeWebhook` direkt riefen —
// ohne Protokoll, ohne Zustandsprüfung, ohne Tageslimit. Danach wusste
// niemand, was rausgegangen war: Der Vorgesetzte suchte im Make-Protokoll, der
// Agent riet.
//
// Diese Funktion ist die Tür. Sie prüft (darf das raus?), sie sendet, sie
// protokolliert, sie schreibt in die Akte, sie merkt sich den Auslöser. Wer
// an ihr vorbeisendet, sendet unbeobachtet — und der Prüfstand meldet es.
//
// Die REGELN stehen woanders und werden hier nur angewandt:
//   Was es gibt        server/lib/fiaon-mail-events.ts (Registry)
//   Wann es darf       server/lib/fiaon-versand.ts (Zustand, Tageslimit)
//   Wie protokolliert  server/lib/fiaon-mail-log.ts
// Seit 18.09.2026 zusätzlich hier: ob die Mail VOLLSTÄNDIG rausgeht
// (Pflichtfelder, jeder Knopf, Abmeldelink — `versandLuecke`).
// ═══════════════════════════════════════════════════════════════════════════

import { paketPreisCents } from "@shared/fiaon-pakete";
import { BANK } from "@shared/fiaon-bank";
import { sqlPool } from "./db-pool";
import { mailEvent, type MailEvent, type Rolle } from "./fiaon-mail-events";
import { versendenUndProtokollieren, type VersandStatus } from "./fiaon-mail-log";
import { istVersandArt, versandErlaubt } from "./fiaon-versand";
import { terminLink, berlinDatumText, berlinUhrzeit } from "./fiaon-termine";
import { absoluteUrl } from "../fiaon-base-url";
import type { MakeEventType } from "../make-webhook";

type Lauf = typeof sqlPool;

export interface SendeErgebnis {
  ok: boolean;
  status: VersandStatus | "abgelehnt";
  grund: string | null;
  meldung: string;
}

export interface SendeEingabe {
  event: MakeEventType | string;
  /** Der Mensch, an den es geht. Fehlt er, ist es eine Mitarbeiter-Mail. */
  personId?: number | null;
  /** Zusätzliche oder überschreibende Felder für die Payload. */
  zusatz?: Record<string, unknown>;
  /** Wer sendet — für Rechteprüfung, Protokoll und Akte. */
  akteur: { name: string; agentId: number | null; rolle: Rolle };
  /**
   * Empfänger OHNE Person im Haus (11.09.2026, E-177): ein Bewerber, der kein
   * Kunde ist. Die Nutzlast kommt vollständig aus `zusatz`; Zustandsregeln
   * gibt es nicht, weil es keinen Kundenzustand gibt. Protokolliert wird wie
   * jede andere Mail (fiaon_mail_log, person_id leer). Nur wirksam, wenn
   * keine personId angegeben ist.
   */
  ohnePerson?: { email: string };
  /** Prüfversand: geht an die Testadresse und zählt nicht gegen Limits. */
  test?: boolean;
  testAdresse?: string;
  lauf?: Lauf;
}

/**
 * Der Betrag einer Bestellung — aus dem Katalog, nicht aus dem alten
 * Bestellfeld (11.09.2026, E-181; seit 18.09.2026 als Funktion, weil ihn jetzt
 * auch die offene und die bezahlte Bestellung des Link-Bausteins brauchen).
 */
function betragAusKatalog(packKey: unknown, amountDue: unknown, ref: unknown): string | null {
  const katalog = paketPreisCents(packKey);
  const feld = amountDue != null ? Math.round(Number(amountDue) * 100) : null;
  if (katalog > 0 && feld != null && feld !== katalog) {
    console.warn(`[MAIL] Betrag der Bestellung ${ref} weicht vom Katalog ab: ${(feld / 100).toFixed(2)} € statt ${(katalog / 100).toFixed(2)} € (${packKey}) — Katalog gilt.`);
  }
  const cents = katalog > 0 ? katalog : feld;
  return cents != null ? (cents / 100).toFixed(2) : null;
}

/**
 * Baut die Payload aus dem, was das Haus über den Kunden weiß.
 *
 * Bewusst hier und nicht in den 25 Aufrufern: Dort stand jedes Mal eine etwas
 * andere Zusammenstellung, und ein fehlendes Feld fiel erst auf, wenn eine
 * Mail beim Kunden mit „Hallo {{ params.vorname }}" ankam.
 */
async function payloadFuer(personId: number, lauf: Lauf): Promise<Record<string, unknown> | null> {
  const [p] = (await lauf`
    SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS email,
           COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', NULLIF(ag.first_name, ''), NULLIF(ag.last_name, '')))) AS agent_vorname,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref,
           (SELECT a3.payment_reference FROM fiaon_applications a3
             WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
             ORDER BY a3.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT a4.amount_due FROM fiaon_applications a4
             WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
             ORDER BY a4.created_at DESC LIMIT 1) AS betrag,
           (SELECT a4.pack_key FROM fiaon_applications a4
             WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
             ORDER BY a4.created_at DESC LIMIT 1) AS pack_key,
           (SELECT a5.pack_name FROM fiaon_applications a5
             WHERE a5.person_id = p.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
             ORDER BY a5.created_at DESC LIMIT 1) AS paket
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!p) return null;
  return {
    email: String(p.email || ""),
    vorname: p.vorname || null,
    nachname: p.nachname || null,
    antrag_id: p.ref || undefined,
    payment_reference: p.zahlungsreferenz || null,
    // ── DER BETRAG KOMMT AUS DEM KATALOG, NICHT AUS DEM ALTEN BESTELLFELD (11.09.2026, E-181) ──
    // Ilijana Weber bekam am 09.09. DREI Mails mit 79,99 €: die Ratenerinnerung
    // (E-173 hat sie repariert) — und zwei Terminmails, die denselben `betrag`
    // aus `amount_due` der Bestellung nehmen. Ihr Paket ist High-End, 99,99 €;
    // das Feld trug den Wert aus der Stripe-Aera. Drei High-End-Bestellungen
    // tragen 79,99 €, jede Mail mit Betrag haette es wiederholt.
    // Regel: Ist das Paket bekannt, gilt der Katalogpreis. Das Bestellfeld ist
    // nur noch der Rueckfall fuer Bestellungen ohne Paket — und weicht es ab,
    // steht es im Protokoll, damit es jemand geraderueckt.
    betrag: betragAusKatalog(p.pack_key, p.betrag, p.ref),
    paket: p.paket ? String(p.paket).split("\n")[0].trim() : null,
    // Kunden werden gesiezt — auch im Notnagel, wenn kein Betreuer zugewiesen ist.
    agent_vorname: p.agent_vorname || "Ihr Ansprechpartner",
    _ref: p.ref || null,
  };
}

/** Was der Link-Baustein wissen muss, außer Ereignis und Person (18.09.2026). */
export interface PayloadOptionen {
  /** Vorschau: keine echten Einmal-Schlüssel erzeugen (Anmelde-Link). */
  vorschau?: boolean;
  /** Wer sendet — für „wie im Gespräch mit … vereinbart" (lead_application_link). */
  akteurName?: string | null;
  /**
   * Was der Aufrufer schon mitbringt (sein `zusatz`). Diese Felder baut der
   * Baustein NICHT noch einmal — ein zweiter Anmelde-Schlüssel, der nie
   * verschickt wird, wäre ein offenes Geheimnis, und eine zweite Abfrage für
   * einen Wert, den der Aufrufer genauer kennt (Termin des No-Shows), wäre
   * die zweite Wahrheit.
   */
  vorhanden?: Record<string, unknown>;
}

export interface GebautePayload {
  basis: Record<string, unknown>;
  links: Record<string, unknown>;
  ref: string | null;
  /** Gesetzt, wenn diese Mail an diesen Kunden so nicht geht — im Klartext. */
  fehler?: string;
  /** Räumt auf, was nur für den Versand erzeugt wurde (Anmelde-Schlüssel), wenn er nicht stattfindet. */
  aufraeumen?: () => Promise<void>;
}

/**
 * Baut die KOMPLETTE Nutzlast eines Ereignisses für eine Person — Basisdaten
 * plus die Links, die nur der Server bauen kann.
 *
 * Eine Funktion für Versand UND Vorschau (28.08.2026): Die Vorschau in der
 * Akte zeigt nur dann garantiert das, was rausgeht, wenn beide dieselbe
 * Zusammenstellung nehmen. Zwei Fassungen wären der sichere Weg zu einer
 * Vorschau, die lügt. Seit dem 18.09.2026 nimmt auch das Versandzentrum
 * (routes/fiaon-versand.ts) diese Funktion — vorher baute es seine eigene.
 */
export async function sendePayloadBauen(
  eventType: string,
  personId: number,
  lauf: Lauf = sqlPool,
  opts: PayloadOptionen = {},
): Promise<GebautePayload | null> {
  const basis = await payloadFuer(personId, lauf);
  if (!basis) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // DIE RATENERINNERUNG SPRICHT ÜBER DIE RATE, NICHT ÜBER DIE BESTELLUNG
  // (10.09.2026, E-173)
  //
  // ── DER BEFUND ───────────────────────────────────────────────────────────
  // `payloadFuer` nimmt `betrag` aus `fiaon_applications.amount_due` — dem Preis
  // der BESTELLUNG — und `payment_reference` aus derselben Zeile. Für jedes
  // andere Ereignis ist das richtig. Für `abo_payment_reminder` ist es falsch,
  // denn diese Mail meint eine bestimmte MONATSRATE.
  //
  // Was dabei herauskam, steht im Protokoll: Ilijana Weber bekam am 09.09. um
  // 18:55 von Hand eine Erinnerung über 79,99 €, während ihre offene Rate 2
  // 99,99 € beträgt — der automatische Lauf hatte ihr sieben Tage zuvor
  // korrekt 99,99 € geschrieben. Drei weitere Kunden wurden zur Zahlung von
  // 74,00 € aufgefordert; das ist der Preis der Bonitätsauskunft, nicht ihre
  // Rate. In keiner dieser Mails stand eine Ratennummer, und als
  // Verwendungszweck stand die Bestellreferenz statt der RATENreferenz
  // (FIAON-5BNPWZ statt FIAON-5BNPWZ-2) — eine Überweisung darauf hätte sich
  // keiner Rate zuordnen lassen.
  //
  // ── DIE REGEL ────────────────────────────────────────────────────────────
  // Dieses Ereignis baut seinen Inhalt aus der offenen Rate, mit derselben
  // Funktion wie der automatische Takt (`aboErinnerungPayload`). Weil diese
  // Funktion Vorschau UND Versand speist, sieht der Mitarbeiter ab sofort
  // genau das, was rausgeht. Gibt es keine offene Rate, wird nicht gesendet:
  // Eine Mahnung ohne Forderung ist schlimmer als keine Mahnung.
  // ══════════════════════════════════════════════════════════════════════════
  if (eventType === "abo_payment_reminder") {
    const { offeneRateFuerErinnerung, aboErinnerungPayload } = await import("../routes/fiaon-abo");
    const rate = await offeneRateFuerErinnerung(personId);
    if (!rate) {
      return {
        basis: basis as Record<string, unknown>, links: {}, ref: (basis as any)._ref ?? null,
        fehler: "Bei diesem Kunden ist gerade keine Rate offen. Es gibt nichts zu erinnern.",
      };
    }
    const ausRate = aboErinnerungPayload(rate) as Record<string, unknown>;
    const ref = (basis as any)._ref as string | null;
    delete (basis as any)._ref;
    return {
      // Die Rate schlägt die Bestellung. Nur die Adresse bleibt die des
      // Kunden — `payloadFuer` löst sie über die Person auf und findet sie
      // auch dann, wenn an der Bestellung keine steht.
      basis: { ...basis, ...ausRate, email: ausRate.email || (basis as any).email },
      links: {},
      ref: (rate.ref as string) || ref,
    };
  }

  const ref = (basis as any)._ref as string | null;
  delete (basis as any)._ref;
  const bau = await linkBaustein(eventType, personId, basis, ref, lauf, opts);
  return { basis: basis as Record<string, unknown>, links: bau.links, ref, fehler: bau.fehler, aufraeumen: bau.aufraeumen };
}

/** Ereignisse, deren Knopf in den Bereich führt (login_url). */
const MIT_LOGIN = new Set<string>([
  "payment_confirmed", "zugang_link", "account_activated", "bereich_freigeschaltet",
  "documents_change_request", "profile_query", "schufa_requested", "schufa_approved",
  // E-206: die Karten-Einladung hat „Unterlagen hochladen" als zweiten Knopf.
  "konto_karte_einladung",
]);

// ═══════════════════════════════════════════════════════════════════════════
// DER LINK-BAUSTEIN (18.09.2026, Team-Feedback Priorität 3)
//
// „In manchen E-Mails steht ‚Klicken Sie unten, um zum Zugang zu gelangen',
// aber es gibt dort keinen anklickbaren Link oder Button." Gemessen: Dieser
// Weg — das Sende-Menü und jeder Aufrufer von mailSenden ohne eigenen Zusatz —
// baute genau einen Link (termin_link, für drei Ereignisse). Jede andere
// Vorlage mit Knopf ging OHNE ihr Ziel raus, und der Motor ließ den Knopf
// still weg: die Zahlungsbestätigung ohne login_url, die Nummern-Bitte ohne
// update_url, der Anmelde-Link ohne Link, die Zustimmung ohne Zustimmungsseite.
//
// Hier stehen jetzt ALLE Links, die nur der Server bauen kann, an EINER
// Stelle — für Versand, Vorschau und Versandzentrum. Geht eine Mail an diesen
// Kunden so nicht (keine offene Zahlung, kein Konto, kein Entwurf), kommt der
// Grund als `fehler` zurück, statt eine halbe Mail zu bauen.
// ═══════════════════════════════════════════════════════════════════════════
async function linkBaustein(
  eventType: string, personId: number, basis: Record<string, unknown>, ref: string | null,
  lauf: Lauf, opts: PayloadOptionen,
): Promise<{ links: Record<string, unknown>; fehler?: string; aufraeumen?: () => Promise<void> }> {
  const links: Record<string, unknown> = {};
  const hat = (k: string) => String(opts.vorhanden?.[k] ?? "").trim() !== "";
  const setze = (k: string, wert: unknown) => { if (!hat(k)) links[k] = wert; };
  let aufraeumen: (() => Promise<void>) | undefined;

  // ── Der Weg in den Bereich ─────────────────────────────────────────────
  if (MIT_LOGIN.has(eventType)) setze("login_url", absoluteUrl("/login"));
  if (eventType === "zugang_link") setze("passwort_url", absoluteUrl("/passwort-vergessen"));
  if (eventType === "abo_verlaengerung_frage") setze("portal_url", absoluteUrl("/dashboard#abo"));
  if (eventType === "vertrag_beendet") setze("portal_url", absoluteUrl("/login"));

  // ── Termine ─────────────────────────────────────────────────────────────
  // HERKUNFT STATT FOLGENLOSER QUELLE (24.08.2026): Der zweite Parameter trägt
  // den WEG und landet als `?von=` im Link; die Gesprächsart bleibt abgeleitet.
  if (eventType === "nicht_erreicht_termin") setze("termin_link", terminLink(personId, "nicht_erreicht_mail"));
  if (eventType === "onboarding_einladung") setze("termin_link", terminLink(personId, "onboarding_einladung"));
  if (eventType === "termin_verpasst") {
    setze("termin_link", terminLink(personId, "termin_verpasst_mail"));
    // Datum und Uhrzeit des verpassten Termins — bis heute kannte sie nur das
    // Versandzentrum; das Sende-Menü und der Kalender schickten „am  um  Uhr".
    // Der Kalender gibt sie jetzt selbst mit (vorhanden), hier der Rückfall.
    if (!hat("termin_datum")) {
      const [t] = (await lauf`
        SELECT t.beginn, COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
        FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
        WHERE t.person_id = ${personId} AND t.status = 'verpasst'
        ORDER BY t.beginn DESC LIMIT 1
      `) as any[];
      if (!t) {
        return { links, fehler: "Für diesen Kunden ist kein verpasster Termin vermerkt — die Mail nennt Datum und Uhrzeit des verpassten Termins. Für eine neue Einladung: „Terminlink“ oder „Einladung zum Startgespräch“." };
      }
      links.termin_datum = berlinDatumText(t.beginn);
      links.termin_uhrzeit = berlinUhrzeit(t.beginn);
      if (t.agent_vorname) setze("agent_vorname", t.agent_vorname);
    }
  }

  // ── Zahlung ─────────────────────────────────────────────────────────────
  // DIE ZAHLUNGSDATEN GEHÖREN ZUR OFFENEN BESTELLUNG (02.09.2026, aus dem
  // Versandzentrum übernommen): `basis` nimmt die JÜNGSTE Bestellung — ist die
  // bezahlt und eine ältere offen, trüge die Mail Referenz und Betrag der
  // falschen. Bevorzugt die mit Betrag: Eine Zahlungsaufforderung ohne Betrag
  // ist keine. Bis heute galt das nur im Versandzentrum; das Sende-Menü
  // schickte die jüngste Bestellung.
  if (eventType === "payment_details" || eventType === "payment_reminder") {
    const [o] = (await lauf`
      SELECT ref, payment_reference, amount_due, pack_key, pack_name, payment_status, reminder_count
        FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
         AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
       ORDER BY (COALESCE(amount_due, 0) > 0) DESC, created_at DESC
       LIMIT 1
    `) as any[];
    if (!o) return { links, fehler: "Keine offene Zahlung — es gibt keine Zahlungsdaten zu schicken." };
    links.antrag_id = String(o.ref);
    links.payment_reference = o.payment_reference || null;
    links.betrag = betragAusKatalog(o.pack_key, o.amount_due, o.ref);
    if (o.pack_name) links.paket = String(o.pack_name).split("\n")[0].trim();
    // Bezahlt wird per Überweisung — die Sofortzahlung per Bank-App lief über
    // GoCardless und ist seit 19.09.2026 beendet (E-194).
    // Empfänger/IBAN/BIC aus der einen Quelle — mitgeschickt stehen sie auch
    // im Protokoll, und die Mail lässt sich später richtig nachdrucken.
    links.empfaenger = BANK.empfaenger;
    links.iban = BANK.ibanDisplay;
    links.bic = BANK.bic;
    if (eventType === "payment_reminder") links.reminder_number = Number(o.reminder_count || 0) + 1;
  }
  // Die Zahlungsbestätigung nennt Paket und Betrag der BEZAHLTEN Bestellung —
  // nicht der jüngsten (die kann eine offene Auskunft-Bestellung sein).
  if (eventType === "payment_confirmed") {
    const [b] = (await lauf`
      SELECT ref, payment_reference, amount_due, pack_key, pack_name
        FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND payment_status = 'paid'
       ORDER BY paid_at DESC NULLS LAST, created_at DESC
       LIMIT 1
    `) as any[];
    if (b) {
      links.antrag_id = String(b.ref);
      links.payment_reference = b.payment_reference || null;
      links.betrag = betragAusKatalog(b.pack_key, b.amount_due, b.ref);
      if (b.pack_name) links.paket = String(b.pack_name).split("\n")[0].trim();
    }
  }

  // (Bis 19.09.2026 stand hier der Lastschrift-Link „sepa_einrichten" — GoCardless ist beendet, E-194.)

  // ── Rufnummer: Formular UND Termin (fiaon-number-update.ts) ─────────────
  if (eventType === "number_update_request") {
    if (!hat("update_url")) {
      const { signNumberUpdateUrl } = await import("../fiaon-number-update");
      if (ref) {
        links.update_url = signNumberUpdateUrl("app", ref);
      } else {
        const [l] = (await lauf`
          SELECT id FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am DESC LIMIT 1
        `) as any[];
        if (!l) return { links, fehler: "Zu diesem Kunden gibt es weder Bestellung noch Lead — kein Formular, in dem er seine Nummer berichtigen könnte." };
        links.update_url = signNumberUpdateUrl("lead", String(l.id));
      }
    }
    setze("termin_link", terminLink(personId, "nummer_korrektur"));
  }

  // ── Zustimmung (wie fiaon-agent-kunden.ts, E-184) ───────────────────────
  if (eventType === "zustimmung_link" && !hat("zustimmung_url")) {
    const { massgeblicheBestellung } = await import("./fiaon-massgebliche-bestellung");
    const massgeblich = await massgeblicheBestellung(personId, lauf);
    let zRef = massgeblich?.ref ? String(massgeblich.ref) : null;
    if (!zRef) {
      const [neueste] = (await lauf`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
          AND gdpr_deleted_at IS NULL AND payment_status NOT IN ('paid', 'refunded')
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      zRef = neueste ? String(neueste.ref) : null;
    }
    if (!zRef) return { links, fehler: "Dieser Kunde hat keine offene Bestellung — ohne sie gibt es keinen Vertrag, dem er zustimmen könnte." };
    const { zustimmungsLage, zustimmungLink } = await import("./fiaon-zustimmung");
    const lage = await zustimmungsLage(zRef, lauf);
    if (!lage) return { links, fehler: "Bestellung nicht gefunden." };
    if (lage.fertig) return { links, fehler: "Dieser Kunde hat bereits allen Punkten zugestimmt — es fehlt nichts." };
    links.zustimmung_url = zustimmungLink(zRef);
    setze("offen", lage.offen.join(", "));
    setze("paket", lage.paket ?? "");
    setze("paket_satz", lage.paket ? ` über ${lage.paket}` : "");
  }

  // ── Leads ───────────────────────────────────────────────────────────────
  // `/antrag?lead=…` liest der Antrag nicht (client/src/pages/antrag.tsx) —
  // die Adresse ohne Anhang ist ehrlicher.
  if (eventType === "lead_application_link") {
    setze("antrag_url", absoluteUrl("/antrag"));
    // „wie im Gespräch mit {{agent_name}} vereinbart": Das Gespräch führte, wer
    // sendet. Sendet die Verwaltung (kein Mitarbeiterkonto — mailSenden gibt
    // dann keinen Namen), heißt es „mit uns": „mit Verwaltung" ist kein Satz,
    // und der zugewiesene Betreuer war es womöglich nicht.
    setze("agent_name", String(opts.akteurName || "").trim() || "uns");
  }
  if (eventType === "lead_followup") {
    setze("antrag_url", absoluteUrl("/antrag"));
    if (!hat("abmelde_url")) {
      const { abmeldeLinkPerson } = await import("../routes/fiaon-abmelden");
      links.abmelde_url = abmeldeLinkPerson(personId);
    }
  }

  // ── Abgebrochener Antrag ────────────────────────────────────────────────
  // „Noch keine Bestellung" heißt payment_status 'pending' (der Vorgabewert).
  // NICHT payment_reference IS NULL, wie im Lauf (fiaon-antrag-erinnerung.ts):
  // Die Spalte ist NOT NULL, jeder Entwurf trägt eine Referenz — gemessen am
  // 18.09.2026: keine einzige Zeile ohne. Die Bedingung des Laufs trifft deshalb
  // nie (1 Versand seit Bestehen); das steht als offene Entscheidung im Bericht.
  if (eventType === "antrag_erinnerung" && !hat("weiter_link")) {
    const [e] = (await lauf`
      SELECT ref, current_step, pack_name FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
         AND gdpr_deleted_at IS NULL
         AND COALESCE(payment_status, 'pending') = 'pending'
         AND status NOT IN ('submitted', 'completed', 'payment_completed', 'documents_submitted', 'approved', 'processing')
         AND COALESCE(current_step, 0) BETWEEN 1 AND 7
       ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (!e) return { links, fehler: "Dieser Kunde hat keinen begonnenen Antrag — es gibt nichts fortzusetzen." };
    const { weiterLink, SCHRITT_TEXT } = await import("./fiaon-antrag-erinnerung");
    const schritt = Number(e.current_step || 1);
    links.weiter_link = weiterLink(String(e.ref));
    links.antrag_id = String(e.ref);
    setze("schritt_text", SCHRITT_TEXT[schritt] || `Schritt ${schritt}`);
    if (e.pack_name) setze("paket", String(e.pack_name).split("\n")[0].trim());
  }

  // ── Anmelde-Link ohne Passwort (fiaon-app-login.ts) ─────────────────────
  // Dieselbe Auswahlregel wie die Anforderung durch den Kunden. Der Schlüssel
  // entsteht NUR beim echten Versand — die Vorschau zeigt eine Adresse ohne
  // gültigen Schlüssel — und wird verworfen, wenn die Mail nicht rausgeht.
  if (eventType === "app_login_link" && !hat("login_link_url")) {
    const app = await import("../routes/fiaon-app-login");
    const adresse = String(basis.email || "").trim().toLowerCase();
    const konto = adresse ? await app.kontoFuerAdresse(adresse) : null;
    if (!konto) return { links, fehler: "Zu dieser Adresse gibt es kein Kundenkonto — ein Anmelde-Link hätte kein Ziel." };
    if (konto.gesperrt) return { links, fehler: "Das Konto ist gesperrt — ein Anmelde-Link würde nicht funktionieren." };
    if (konto.personId && konto.personId !== personId) {
      return { links, fehler: "Diese Adresse gehört zu einem anderen Kundenkonto — bitte die E-Mail-Adresse in der Akte prüfen." };
    }
    setze("login_url", absoluteUrl("/app/login"));
    setze("gueltig_minuten", String(app.LOGIN_LINK_MINUTEN));
    if (opts.vorschau) {
      links.login_link_url = absoluteUrl(`${app.LOGIN_LINK_PFAD}/vorschau-ohne-gueltigen-schluessel`);
    } else {
      const link = await app.anmeldeLinkErzeugen(konto.ref, { userAgent: "Handversand (fiaon-mail-senden)" });
      links.login_link_url = link.url;
      aufraeumen = () => app.anmeldeLinkVerwerfen(link.tokenHash);
    }
  }

  // ── Konto & Karte: die drei Bedingungen gelten auf JEDEM Weg ────────────
  // Der eigene Knopf in der Akte prüfte sie; das allgemeine Sende-Menü nicht.
  if (eventType === "konto_karte_einladung") {
    const { kartenStand } = await import("./fiaon-konto-karte");
    const stand = await kartenStand(personId, lauf);
    if (!stand) return { links, fehler: "Kunde nicht gefunden." };
    if (!stand.bereit) return { links, fehler: `Noch nicht so weit: ${stand.esFehlt || "es fehlen Voraussetzungen"}.` };
  }

  return { links, aufraeumen };
}

/**
 * Geht diese Mail VOLLSTÄNDIG raus? (18.09.2026)
 *
 * Rendert sie mit dem Motor — derselben Funktion, die gleich versendet — und
 * prüft drei Dinge: die Pflichtfelder des Ereignisses, jeden Knopf und bei
 * Werbung den Abmeldelink. Gibt den Grund im Klartext zurück, sonst null.
 *
 * Vorher ließ der Motor einen Knopf ohne Ziel still weg, und der Handversand
 * schickte die Mail trotzdem: „Klicken Sie unten …" — und unten war nichts.
 * Erwartete Lücken stehen in KNOPF_DARF_FEHLEN (Mail-Motor).
 */
export async function versandLuecke(
  def: Pick<MailEvent, "type" | "label" | "pflichtFelder">, payload: Record<string, unknown>,
): Promise<string | null> {
  const leer = (k: string) => String(payload[k] ?? "").trim() === "";
  const ohne = (def.pflichtFelder ?? []).filter(leer);
  if (ohne.length) {
    return `„${def.label}“ braucht Angaben, die hier fehlen (${ohne.join(", ")}) — die gibt nur ihr eigener Auslöser mit. Nicht verschickt.`;
  }
  const motor = await import("../mail/motor");
  if (motor.ABMELDEPFLICHT.has(def.type) && leer("abmelde_url")) {
    return `„${def.label}“ geht an Menschen ohne Vertrag und braucht einen Abmeldelink — ohne ihn geht sie nicht raus.`;
  }
  const mail = motor.mailRendern(def.type, payload);
  if (mail?.knopfEntfallen) {
    const knoepfe = mail.entfalleneKnoepfe.map((k) => `„${k.text}“ (${k.platzhalter} fehlt)`).join(", ");
    return `„${def.label}“ ginge ohne ihren Knopf raus: ${knoepfe}. Nicht verschickt — bitte die Angaben in der Akte prüfen.`;
  }
  return null;
}

/**
 * Die Vorschau: exakt die Mail, die `mailSenden` verschicken würde — gleiche
 * Nutzlast, gleiche Vorlage, gleiche Renderfunktion (Mail-Motor).
 *
 * Justins Auftrag 28.08.2026: „bevor man sie versendet soll es eine Vorschau
 * geben damit der Mitarbeiter sieht was er verschickt."
 *
 * 18.09.2026: `sperre` sagt, warum der Versand ablehnen würde (fehlender
 * Knopf, Pflichtfeld, Abmeldelink) — die Vorschau zeigt es, bevor jemand drückt.
 */
export async function mailVorschau(ein: {
  event: string;
  personId: number;
  rolle: Rolle;
  zusatz?: Record<string, unknown>;
  /** Wer die Vorschau ansieht — derselbe Name, der beim Senden in die Mail käme. */
  akteurName?: string | null;
  lauf?: Lauf;
}): Promise<
  | { ok: true; betreff: string; html: string; empfaenger: string; absender: { name: string; email: string }; fehlend: string[]; sperre: string | null }
  | { ok: false; grund: string }
> {
  const lauf = ein.lauf ?? sqlPool;
  const def = await mailEvent(String(ein.event), lauf);
  if (!def) return { ok: false, grund: `Unbekanntes Ereignis „${ein.event}“.` };
  if (def.deprecated) return { ok: false, grund: `„${def.label}“ ist abgelöst.` };
  if (!def.rollen.includes(ein.rolle)) return { ok: false, grund: `Deine Rolle darf „${def.label}“ nicht senden.` };

  const gebaut = await sendePayloadBauen(def.type, ein.personId, lauf, {
    vorschau: true, akteurName: ein.akteurName ?? null, vorhanden: ein.zusatz,
  });
  if (!gebaut) return { ok: false, grund: "Kunde nicht gefunden." };
  if (gebaut.fehler) return { ok: false, grund: gebaut.fehler };
  const zusatz = await partnerLinkErgaenzen(def.type, ein.personId, (ein as any).agentId ?? null, ein.zusatz, lauf);
  const payload = { ...gebaut.basis, ...gebaut.links, ...zusatz };

  const { mailRendern } = await import("../mail/motor");
  const mail = mailRendern(def.type, payload);
  if (!mail) return { ok: false, grund: `Für „${def.label}“ gibt es noch keine Quelltext-Vorlage.` };
  return {
    ok: true,
    betreff: mail.betreff,
    html: mail.html,
    empfaenger: String(payload.email || ""),
    absender: mail.absender,
    fehlend: mail.fehlend,
    sperre: await versandLuecke(def, payload),
  };
}

/**
 * Sendet eine Mail — der EINZIGE Weg im Haus.
 *
 * Wirft nie. Ein Versand, der einen Vorgang zum Absturz bringt, ist teurer als
 * eine Mail, die nicht rausgeht.
 */
// ── DER PARTNERLINK GEHÖRT ZUR NUTZLAST, NICHT ZUM AUFRUFER (05.09.2026) ──
// Justin: „Die Mail kommt so beim Kunden an, ohne Button, ohne Link." Vier
// Konto-und-Karte-Mails (01.09. und 05.09.) gingen über „Vorlage aus der Akte
// senden" raus — dieser Weg kannte den Link nicht, nur der Knopf im
// Onboarding-Raum brachte ihn als Zusatz mit. Der Motor lässt einen Knopf ohne
// Ziel weg, also stand der Kunde ohne Weg zur Bank da. Jetzt baut der Versand
// den Link selbst, mit Kunden- und Mitarbeiterkennung — für jeden Weg.
async function partnerLinkErgaenzen(
  eventType: string, personId: number | null, agentId: number | null | undefined, zusatz: Record<string, unknown> | undefined, lauf: Lauf,
): Promise<Record<string, unknown>> {
  const z = { ...(zusatz || {}) };
  if (eventType !== "konto_karte_einladung" || !personId || String(z.partner_link || "").trim()) return z;
  try {
    const { partnerLink } = await import("./fiaon-konto-karte");
    let wer = agentId ?? null;
    if (!wer) {
      const [p] = (await lauf`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [] as any[])) as any[];
      wer = p?.assigned_agent_id ? Number(p.assigned_agent_id) : null;
    }
    z.partner_link = partnerLink(personId, wer);
  } catch (e) { console.error("[MAIL] partner_link:", String(e).slice(0, 120)); }
  return z;
}

export async function mailSenden(ein: SendeEingabe): Promise<SendeErgebnis> {
  const lauf = ein.lauf ?? sqlPool;
  const abgelehnt = (grund: string): SendeErgebnis =>
    ({ ok: false, status: "abgelehnt", grund, meldung: grund });

  const def = await mailEvent(String(ein.event), lauf);
  if (!def) return abgelehnt(`Unbekanntes Ereignis „${ein.event}“.`);
  if (def.deprecated) return abgelehnt(`„${def.label}“ ist abgelöst und wird nicht mehr versendet.`);
  if (!def.rollen.includes(ein.akteur.rolle)) {
    return abgelehnt(`Deine Rolle darf „${def.label}“ nicht senden.`);
  }

  // ── Prüfversand ────────────────────────────────────────────────────────
  // Geht an die Testadresse, prüft KEINEN Kundenzustand (es gibt keinen
  // Kunden) und zählt nicht gegen Tageslimits.
  if (ein.test) {
    const an = String(ein.testAdresse || "").trim();
    if (!an) return abgelehnt("Keine Testadresse hinterlegt.");
    const erg = await versendenUndProtokollieren(
      def.type as MakeEventType,
      { ...(def.example as Record<string, unknown>), ...(ein.zusatz || {}), email: an, test: true } as any,
      { personId: null, ausgeloestVon: ein.akteur.name, ausgeloestAgentId: ein.akteur.agentId, lauf },
    );
    await lauf`
      UPDATE fiaon_mail_log SET art = 'test'
      WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${def.type})
    `.catch((e) => console.error(`[MAIL] Testmarke fuer ${def.type} nicht gesetzt — die Sendung zaehlt damit als echt:`, e));
    return {
      ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      meldung: erg.status === "versandt" ? `Prüfversand an ${an} raus.` : `Prüfversand fehlgeschlagen: ${erg.grund}`,
    };
  }

  // ── Echter Versand an einen Menschen ohne Person (E-177) ───────────────
  if (!ein.personId && ein.ohnePerson) {
    const an = String(ein.ohnePerson.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(an)) return abgelehnt("Keine gültige E-Mail-Adresse.");
    const payload = { ...(ein.zusatz || {}), email: an };
    const luecke = await versandLuecke(def, payload);
    if (luecke) return abgelehnt(luecke);
    const erg = await versendenUndProtokollieren(
      def.type as MakeEventType,
      payload as any,
      { personId: null, ausgeloestVon: ein.akteur.name, ausgeloestAgentId: ein.akteur.agentId, lauf },
    );
    return {
      ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      meldung: erg.status === "versandt"
        ? `„${def.label}“ an ${an} verschickt.${erg.hinweis ? ` ${erg.hinweis}` : ""}`
        : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
    };
  }

  // ── Echter Versand ─────────────────────────────────────────────────────
  if (!ein.personId) return abgelehnt("Kein Empfänger angegeben.");

  // Die Zustandsregeln kennt fiaon-versand.ts. Ereignisse, die dort keine
  // eigene Regel haben, kommen durch — sie sind vom Vorgesetzten ausgelöste
  // Einzelfälle (Storno, DSGVO), bei denen der Mensch die Lage kennt.
  // ── EINE LISTE, NICHT ZWEI (18.09.2026) ──────────────────────────────────
  // Hier stand eine eigene Liste mit sechs Arten; die Zahlungsbestätigung hatte
  // gar keine Regel. Jetzt gilt jede Art, für die fiaon-versand.ts eine Regel
  // kennt (VERSAND_ARTEN).
  if (istVersandArt(def.type)) {
    const pruefung = await versandErlaubt(ein.personId, def.type, lauf);
    if (!pruefung.erlaubt) return abgelehnt(pruefung.grund || "Nicht erlaubt.");
  }

  const gebaut = await sendePayloadBauen(def.type, ein.personId, lauf, {
    // Nur ein Mitarbeiter ist ein Gesprächspartner — „Verwaltung" nicht.
    akteurName: ein.akteur.agentId ? ein.akteur.name : null, vorhanden: ein.zusatz,
  });
  if (!gebaut) return abgelehnt("Kunde nicht gefunden.");
  // E-173: Eine Ratenerinnerung ohne offene Rate geht nicht raus — und alles
  // andere, was an diesem Kunden so nicht geht (Link-Baustein, 18.09.2026).
  if (gebaut.fehler) {
    await gebaut.aufraeumen?.();
    return abgelehnt(gebaut.fehler);
  }
  const { basis, links, ref } = gebaut;
  if (!basis.email) {
    await gebaut.aufraeumen?.();
    return abgelehnt("Keine E-Mail-Adresse hinterlegt.");
  }

  const zusatz = await partnerLinkErgaenzen(def.type, ein.personId, ein.akteur.agentId, ein.zusatz, lauf);
  const payload = { ...basis, ...links, ...zusatz };
  // Vollständig? Sonst lieber keine Mail als eine ohne ihren Knopf.
  const luecke = await versandLuecke(def, payload);
  if (luecke) {
    await gebaut.aufraeumen?.();
    return abgelehnt(luecke);
  }
  const erg = await versendenUndProtokollieren(
    def.type as MakeEventType,
    payload as any,
    {
      personId: ein.personId,
      verlaufRef: ref,
      verlaufText: `${def.label} versandt${ein.akteur.agentId ? ` (von ${ein.akteur.name})` : ""}.`,
      ausgeloestVon: ein.akteur.name,
      ausgeloestAgentId: ein.akteur.agentId,
      lauf,
    },
  );
  if (erg.status !== "versandt") await gebaut.aufraeumen?.();
  return {
    ok: erg.status === "versandt",
    status: erg.status,
    grund: erg.grund,
    meldung: erg.status === "versandt"
      ? `„${def.label}“ an ${basis.email} verschickt.${erg.hinweis ? ` ${erg.hinweis}` : ""}`
      : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
  };
}
