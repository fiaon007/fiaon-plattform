// ═══════════════════════════════════════════════════════════════════════════
// MAIL-EREIGNISSE — die eine Wahrheit über jede Mail im Haus
//
// DER FEHLER, DEN DAS ABSTELLT
// Auf /admin/events stand bei rund zehn Ereignissen „MAKE-ZWEIG FEHLT". Diese
// Behauptung kam aus einer einzigen Zeile:
//
//     makeBranchReady: !/Vorgesetzten-TODO/i.test(e.description)
//
// Die Plattform hat also geprüft, ob in UNSERER EIGENEN Beschreibung das Wort
// „Vorgesetzten-TODO" steht — ein Notizzettel, den frühere Pakete hinterlassen
// haben — und daraus eine Aussage über die Einrichtung des Vorgesetzten
// gemacht. 23 von 33 Beschreibungen enthalten den String. In Wahrheit waren
// alle 21 Zweige aktiv. Die Plattform hat den Vorgesetzten zu Unrecht
// beschuldigt, und er hat es geglaubt, weil es dastand.
//
// AB HIER GILT: Die Plattform BEHAUPTET nichts über Zustellung. Sie WEISS es
// (ein Testversand kam nachweislich bei Brevo an) oder sie sagt „noch nicht
// geprüft" — eine Aussage über den eigenen Kenntnisstand, nicht über jemand
// anderen.
//
// WARUM DIESE DATEI DIE VORHANDENE REGISTRY BENUTZT
// `server/make-events-registry.ts` trägt seit Monaten Label, Beschreibung und
// Beispiel-Payload je Ereignis. Eine zweite Liste mit denselben 33 Einträgen
// wäre die dritte Kopie derselben Wahrheit — und in vier Wochen die falsche.
// Diese Datei ERGÄNZT deshalb: Gruppe, Zielgruppe, Rechte, Zustandsregeln,
// und sie verbindet alles mit dem, was die Datenbank über Vorlage und
// Verifikation weiß.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { MAKE_EVENT_REGISTRY, type MakeEventDef } from "../make-events-registry";
import type { MakeEventType } from "../make-webhook";

type Lauf = typeof sqlPool;

export type Zielgruppe = "kunde" | "mitarbeiter";
export type Gruppe = "zahlung" | "termin" | "konto" | "dokumente" | "team" | "lead";
/** Wer darf dieses Ereignis von Hand auslösen? */
// ── „inkasso" GEHÖRT DAZU (11.08.2026) ─────────────────────────────────────
// Der Vorgesetzte: „Wenn der Inkasso-Mitarbeiter auf ‚senden' klickt … es geht
// nicht!" Nach dem Beheben der Rollenprüfung öffnete sich das Menü — LEER.
// Kein einziges Ereignis war für diese Rolle freigegeben.
//
// Ein Sende-Menü ohne Auswahl ist so nutzlos wie ein verschlossenes.
export type Rolle = "admin" | "vertriebsleiter" | "agent" | "onboarding" | "inkasso";

export interface EventZusatz {
  gruppe: Gruppe;
  zielgruppe: Zielgruppe;
  rollen: Rolle[];
  /**
   * Kurzsatz für das Sende-Menü: WAS geht WANN an WEN raus. Der Vorgesetzte und
   * das Team lesen das im Zweifel unter Zeitdruck am Telefon.
   */
  klartext: string;
}

/**
 * Was die Registry an fachlicher Einordnung NICHT trägt.
 *
 * Ereignisse ohne Eintrag sind Mitarbeiter-Mails der Gruppe „team", die nur
 * der Vorgesetzte auslöst — die sichere Vorgabe.
 */
const ZUSATZ: Partial<Record<MakeEventType, EventZusatz>> = {
  welcome: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent", "onboarding"],
    klartext: "Begrüßung mit dem Weg ins Konto. Geht automatisch nach der Zahlungsbuchung — von Hand, wenn der Kunde sie nicht findet.",
  },
  payment_details: {
    // Das Forderungsmanagement braucht genau diese Mail am häufigsten:
    // „Ich schicke Ihnen die Daten gleich noch zu."
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "agent", "inkasso"],
    klartext: "Bankverbindung, Betrag und Verwendungszweck. Geht nach dem Antrag automatisch raus.",
  },
  payment_reminder: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Erinnerung an eine offene Zahlung, gestuft nach Alter der Rechnung.",
  },
  claim_received: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung, dass die Zahlungsmeldung angekommen ist — noch keine Freischaltung.",
  },
  payment_confirmed: {
    // Wer die Zahlung einholt, darf ihren Eingang auch bestätigen.
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "inkasso"],
    klartext: "Das Geld ist da, das Konto ist offen. Geht bei der Buchung automatisch raus.",
  },
  abo_payment_reminder: {
    // ── DIE WICHTIGSTE MAIL DES FORDERUNGSMANAGEMENTS ────────────────────
    // Sie war nur für „admin" freigegeben — also für niemanden, der
    // tatsächlich anruft. Der Mensch, dessen ganze Arbeit darin besteht,
    // offene Raten einzuholen, konnte die Rate-Erinnerung nicht verschicken.
    gruppe: "zahlung", zielgruppe: "kunde",
    rollen: ["admin", "vertriebsleiter", "inkasso"],
    klartext: "Monatliche Rate fällig oder überfällig, in drei Mahnstufen. "
      + "Enthält Betrag, Bankdaten und den Verwendungszweck der Rate.",
  },
  nicht_erreicht_termin: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent"],
    klartext: "Terminlink nach zwei erfolglosen Anrufen — der Kunde wählt selbst eine Uhrzeit.",
  },
  termin_bestaetigung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung nach einer Buchung, mit Storno-Link.",
  },
  termin_erinnerung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "24 Stunden vor dem Gespräch.",
  },
  onboarding_einladung: {
    gruppe: "termin", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "onboarding"],
    klartext: "Einladung zum 15-minütigen Startgespräch für bezahlte Kunden.",
  },
  number_update_request: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent"],
    klartext: "Bitte an den Kunden, seine Rufnummer selbst zu berichtigen.",
  },
  lead_followup: {
    gruppe: "lead", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter"],
    klartext: "Nachfassen bei einem Lead, der noch keinen Antrag gestellt hat.",
  },
  lead_application_link: {
    gruppe: "lead", zielgruppe: "kunde", rollen: ["admin", "vertriebsleiter", "agent"],
    klartext: "Direktlink zum Antrag für einen Lead am Telefon.",
  },
  documents_change_request: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Rückfrage zu hochgeladenen Unterlagen.",
  },
  schufa_requested: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bitte um die Bonitätsauskunft.",
  },
  schufa_approved: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Die eingereichte Auskunft ist angenommen.",
  },
  schufa_rejected: {
    gruppe: "dokumente", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Die eingereichte Auskunft genügt nicht — mit Begründung.",
  },
  account_activated: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Das Konto ist freigeschaltet.",
  },
  account_suspended: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Das Konto ist gesperrt — mit Grund.",
  },
  payment_cancelled: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Die Bestellung wurde storniert.",
  },
  payment_reactivated: {
    gruppe: "zahlung", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Eine abgelaufene Bestellung bekommt eine neue Frist.",
  },
  profile_query: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Rückfrage zu den Profilangaben.",
  },
  gdpr_deleted: {
    gruppe: "konto", zielgruppe: "kunde", rollen: ["admin"],
    klartext: "Bestätigung einer Löschung nach DSGVO.",
  },
};

const VORGABE_ZUSATZ: EventZusatz = {
  gruppe: "team", zielgruppe: "mitarbeiter", rollen: ["admin"],
  klartext: "Interne Mail an einen Mitarbeiter.",
};

export interface Parameter {
  name: string;
  beispiel: unknown;
}

export interface MailEvent extends MakeEventDef, EventZusatz {
  parameter: Parameter[];
  /** Was die Datenbank weiß — nicht, was wir vermuten. */
  brevoTemplateId: number | null;
  brevoTemplateName: string | null;
  verifiziertAm: string | null;
  geprueftAm: string | null;
  pruefErgebnis: string | null;
  /**
   * Der EINZIGE Verifikationsstatus im Haus.
   *   bestaetigt      Ein Testversand kam nachweislich bei Brevo an.
   *   nicht_bestaetigt Geprüft, aber nichts angekommen.
   *   ungeprueft      Wir wissen es nicht — und sagen das auch so.
   */
  verifikation: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
}

/** Alle Ereignisse mit allem, was wir über sie wissen. */
export async function mailEvents(lauf: Lauf = sqlPool): Promise<MailEvent[]> {
  const stand = new Map<string, any>();
  const rows = (await lauf`SELECT * FROM fiaon_mail_events`) as any[];
  for (const r of rows) stand.set(String(r.event), r);

  return MAKE_EVENT_REGISTRY.map((e) => {
    const z = ZUSATZ[e.type] ?? VORGABE_ZUSATZ;
    const s = stand.get(e.type);
    const verifiziertAm = s?.verifiziert_am ?? null;
    const geprueftAm = s?.geprueft_am ?? null;
    return {
      ...e,
      ...z,
      parameter: Object.entries(e.example).map(([name, beispiel]) => ({ name, beispiel })),
      brevoTemplateId: s?.brevo_template_id ?? null,
      brevoTemplateName: s?.brevo_template_name ?? null,
      verifiziertAm: verifiziertAm ? new Date(verifiziertAm).toISOString() : null,
      geprueftAm: geprueftAm ? new Date(geprueftAm).toISOString() : null,
      pruefErgebnis: s?.pruef_ergebnis ?? null,
      verifikation: verifiziertAm ? "bestaetigt" : geprueftAm ? "nicht_bestaetigt" : "ungeprueft",
    };
  });
}

/** Ein einzelnes Ereignis. */
export async function mailEvent(event: string, lauf: Lauf = sqlPool): Promise<MailEvent | null> {
  return (await mailEvents(lauf)).find((e) => e.type === event) ?? null;
}

/** Ereignisse, die diese Rolle von Hand auslösen darf. */
export async function eventsFuerRolle(rolle: Rolle, lauf: Lauf = sqlPool): Promise<MailEvent[]> {
  return (await mailEvents(lauf)).filter((e) => !e.deprecated && e.rollen.includes(rolle));
}

/** Brevo-Vorlage zuordnen. */
export async function templateZuordnen(
  event: string, templateId: number | null, templateName: string | null, lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_mail_events (event, brevo_template_id, brevo_template_name, updated_at)
    VALUES (${event}, ${templateId}, ${templateName}, NOW())
    ON CONFLICT (event) DO UPDATE
      SET brevo_template_id = EXCLUDED.brevo_template_id,
          brevo_template_name = EXCLUDED.brevo_template_name,
          updated_at = NOW()
  `;
}

/**
 * Das Ergebnis einer Zweig-Prüfung festhalten.
 *
 * `verifiziert_am` wird bei einem Misserfolg NICHT gelöscht: Ein Zweig, der
 * gestern nachweislich funktioniert hat, ist heute nicht plötzlich weg, nur
 * weil eine einzelne Prüfung ins Leere lief (Brevo braucht manchmal länger als
 * unser Fenster). Der Misserfolg steht als `pruef_ergebnis` daneben.
 */
export async function verifikationSpeichern(
  event: string, bestaetigt: boolean, ergebnis: string, lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_mail_events (event, verifiziert_am, geprueft_am, pruef_ergebnis, updated_at)
    VALUES (${event}, ${bestaetigt ? new Date() : null}, NOW(), ${ergebnis}, NOW())
    ON CONFLICT (event) DO UPDATE
      SET verifiziert_am = ${bestaetigt ? new Date() : sqlPool`fiaon_mail_events.verifiziert_am`},
          geprueft_am = NOW(),
          pruef_ergebnis = EXCLUDED.pruef_ergebnis,
          updated_at = NOW()
  `;
}

/**
 * Der Klartext zum Verifikationsstatus.
 *
 * Bei „nicht bestätigt" werden BEIDE möglichen Ursachen genannt. Genau das
 * hat gefehlt: Die alte Meldung behauptete „Make-Zweig fehlt" und schickte den
 * Vorgesetzter in die falsche Richtung, während in Wahrheit die Brevo-Vorlage
 * nicht aktiv war.
 */
export function verifikationsText(e: MailEvent): string {
  if (e.verifikation === "bestaetigt") {
    return `Zweig bestätigt am ${new Date(e.verifiziertAm!).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })} Uhr — ein Testversand ist nachweislich bei Brevo angekommen.`;
  }
  if (e.verifikation === "nicht_bestaetigt") {
    return "Nicht bestätigt — die Testmail kam bei Brevo nie an. Zwei mögliche Ursachen: "
      + "der Make-Zweig für dieses Ereignis fehlt oder ist inaktiv, ODER das Brevo-Template "
      + "ist nicht aktiv beziehungsweise nicht zugeordnet. Beides sieht von hier aus gleich aus.";
  }
  return "Noch nicht geprüft. Mit „Zweig prüfen“ geht ein Testversand raus, und wir sehen bei Brevo nach, ob er ankommt.";
}
