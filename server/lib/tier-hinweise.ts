/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HANDLUNGSHINWEISE JE TIER-GRUND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der Agent muss sehen, WARUM ein Kunde in seinem Tier liegt — die
 * Gesprächsführung unterscheidet sich fundamental. Ein Kunde, der seinen
 * Antrag abgeschlossen hat und nur nicht bezahlt, braucht einen anderen Satz
 * als einer, der bei der Konfiguration abgesprungen ist.
 *
 * Die Texte stehen hier und NUR hier. Part 2 rendert sie als Badge plus
 * Handlungshinweis auf der Kundenkarte; gepflegt werden sie an dieser einen
 * Stelle. Keine Duplikate im Frontend.
 */

/** Die möglichen Gründe. Entspricht `fiaon_persons.tier_reason`. */
import { KUNDENSTATUS, ETIKETT_FRIST_ABGELAUFEN } from "../../shared/fiaon-kundenstatus";

export type TierGrund =
  | "bezahlt"
  | "zahlung_angekuendigt"
  | "rechnung_offen"
  | "zahlungsfrist_abgelaufen"
  | "antrag_abgeschlossen"
  | "antrag_abgebrochen"
  | "nur_lead"
  | "ausgeschlossen";

/**
 * Klartext für die Abbruchstelle. Wird in den Titel von `antrag_abgebrochen`
 * eingesetzt — „Antrag abgebrochen bei: Konfiguration" statt „…bei: config".
 */
export const STATUS_KLARTEXT: Record<string, string> = {
  started: "Start",
  config: "Konfiguration",
  personal_data: "Persönliche Daten",
};

export interface TierHinweis {
  /** Kann `{status}` enthalten — über `hinweisFuer()` auflösen. */
  titel: string;
  hinweis: string;
}

export const TIER_HINWEISE: Record<TierGrund, TierHinweis> = {
  bezahlt: {
    titel: "Bestandskunde",
    hinweis:
      "Die Zahlung ist eingegangen. Dieser Kunde ist aus dem Vertrieb heraus und " +
      "wird nicht mehr zur Zahlung aufgefordert.",
  },

  zahlung_angekuendigt: {
    // „angekündigt" klang wie eine Zusage der Bank. Der Kunde hat es GEMELDET —
    // bankbestätigt ist es nicht, und genau das muss im Titel stehen.
    titel: `${KUNDENSTATUS.zahlung_gemeldet.text} (${KUNDENSTATUS.zahlung_gemeldet.zusatz})`,
    hinweis:
      "Der Kunde hat angegeben, bezahlt zu haben. Prüfe, ob die Zahlung eingegangen " +
      "ist. Falls nicht: freundlich nachfassen und ein konkretes Zahlungsdatum " +
      "vereinbaren — das Datum hier eintragen.",
  },

  antrag_abgeschlossen: {
    // GEÄNDERT 08.08.2026: Hier stand „Antrag abgeschlossen, keine Zahlung" —
    // zwei Aussagen in einer Zeile. Eine Agentin hat die erste gelesen und den
    // Kunden für bezahlt gehalten; ein Kollege hatte den Gegenbeweis. Der Titel
    // kommt jetzt aus dem einen Vokabular (shared/fiaon-kundenstatus.ts) und
    // sagt, was fehlt: das Geld.
    titel: KUNDENSTATUS.rechnung_offen.text,
    hinweis:
      "Dieser Kunde hat seinen Antrag abgeschlossen, aber noch keine Zahlung " +
      "bestätigt. Ruf ihn an und sag ihm, dass wir sein Konto gerne aktivieren — " +
      "dafür muss er nur die Zahlung durchführen. Über den Button " +
      "„Zahlungsdetails senden\" schickst du ihm direkt seine Rechnung.",
  },

  rechnung_offen: {
    titel: "Rechnung versendet, keine Reaktion",
    hinweis:
      "Die Rechnung liegt beim Kunden. Nachfassen, ob sie angekommen ist und ob es " +
      "Rückfragen gibt. Bei Bedarf über „Zahlungsdetails senden\" erneut schicken.",
  },

  zahlungsfrist_abgelaufen: {
    titel: `${KUNDENSTATUS.rechnung_offen.text} · ${ETIKETT_FRIST_ABGELAUFEN}`,
    hinweis:
      "Der Kunde war schon vollständig durch den Antrag, hat aber nicht rechtzeitig " +
      "gezahlt. Reaktivieren: nachfragen, was dazwischengekommen ist, und eine neue " +
      "Rechnung über „Zahlungsdetails senden\" auslösen.",
  },

  antrag_abgebrochen: {
    titel: "Antrag abgebrochen bei: {status}",
    hinweis:
      "Der Kunde hat den Antrag begonnen, aber nicht abgeschlossen. Frag nach, wo es " +
      "gehakt hat, und begleite ihn telefonisch bis zum Absenden.",
  },

  nur_lead: {
    titel: "Nur Lead — Antrag nie gestartet",
    hinweis: "Erstkontakt. Interesse prüfen und zum Antrag führen.",
  },

  ausgeschlossen: {
    titel: "Aus dem Vertrieb ausgeschlossen",
    hinweis:
      "Erstattet oder storniert. Erscheint in keinem Vertriebs-Pool und wird nicht " +
      "kontaktiert. Nur über den Admin-Filter sichtbar.",
  },
};

/**
 * Hinweis mit aufgelöstem Platzhalter.
 *
 * @param grund      Wert aus `fiaon_persons.tier_reason`
 * @param abbruchbei Rohwert aus `fiaon_applications.status`, nur für
 *                   `antrag_abgebrochen` relevant. Unbekannte Werte werden
 *                   unverändert durchgereicht, damit ein neuer Funnel-Schritt
 *                   nicht als leerer Titel erscheint.
 */
export function hinweisFuer(grund: TierGrund, abbruchbei?: string | null): TierHinweis {
  const vorlage = TIER_HINWEISE[grund];
  if (!vorlage) {
    return {
      titel: "Unbekannter Grund",
      hinweis: `Für „${grund}" ist kein Hinweis hinterlegt. Bitte im Backend ergänzen.`,
    };
  }
  if (!vorlage.titel.includes("{status}")) return vorlage;

  const klartext = abbruchbei
    ? STATUS_KLARTEXT[abbruchbei] ?? abbruchbei
    : "unbekanntem Schritt";
  return { titel: vorlage.titel.replace("{status}", klartext), hinweis: vorlage.hinweis };
}
