// ═══════════════════════════════════════════════════════════════════════════
// BREVO-FEHLER IN KLARTEXT
//
// Der Betreiber sah in der Mail-Zentrale die rohe API-Antwort:
//
//   {"message":"Unrecognised IP address ... unauthorized","code":"unauthorized"}
//
// Damit kann niemand etwas anfangen, der nicht weiß, dass Brevo eine
// IP-Freigabeliste führt. Der Fehler ist auch kein Programmfehler, sondern eine
// EINSTELLUNG mit einer bekannten Lösung — also gehört die Lösung in die
// Meldung, nicht in ein Ticket.
//
// Diese Datei ist die EINZIGE Stelle, die Brevo-Antworten in Sätze übersetzt.
// Überall, wo Brevo angesprochen wird, wird sie benutzt — sonst steht in der
// einen Ansicht eine Anleitung und in der anderen wieder JSON.
// ═══════════════════════════════════════════════════════════════════════════

export interface BrevoKlartext {
  /** Ein Satz, der sagt, was los ist. */
  titel: string;
  /** Was zu tun ist — Schritt für Schritt, mit Adresse. */
  anleitung: string[];
  /** Liegt es an einer Einstellung (behebbar) oder an einem echten Ausfall? */
  behebbar: boolean;
  /** Die rohe Antwort, aufklappbar für den Fall, dass jemand sie braucht. */
  roh: string;
}

const IP_ANLEITUNG = [
  "Öffne app.brevo.com/security/authorised_ips",
  "Trage dort die IP-Adresse des FIAON-Servers ein — oder schalte die Beschränkung ganz ab, "
    + "wenn der Server keine feste Adresse hat (Render wechselt sie).",
  "Danach hier erneut auf „Alle prüfen“ klicken. Es geht nichts verloren: Der Abgleich "
    + "holt die Zustellungen der letzten Tage nach.",
];

/**
 * Eine Brevo-Antwort in Klartext übersetzen.
 *
 * @param status HTTP-Status, 0 wenn die Verbindung gar nicht zustande kam.
 * @param koerper Antworttext oder Fehlermeldung.
 */
export function brevoKlartext(status: number, koerper: unknown): BrevoKlartext {
  const roh = typeof koerper === "string" ? koerper : JSON.stringify(koerper ?? {});
  const kleiner = roh.toLowerCase();

  // Der häufigste Fall, und der einzige mit einer Ein-Klick-Lösung.
  if (status === 401 && (kleiner.includes("unrecognised ip") || kleiner.includes("unrecognized ip"))) {
    const ip = roh.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)?.[1];
    return {
      titel: "Brevo-Sicherheit blockiert diesen Server"
        + (ip ? ` — die Adresse ${ip} steht nicht auf der Freigabeliste.` : "."),
      anleitung: ip
        ? [`Trage ${ip} auf app.brevo.com/security/authorised_ips ein`, ...IP_ANLEITUNG.slice(1)]
        : IP_ANLEITUNG,
      behebbar: true, roh,
    };
  }
  if (status === 401) {
    return {
      titel: "Brevo hat den Schlüssel abgelehnt.",
      anleitung: [
        "Prüfe, ob BREVO_API_KEY noch gültig ist (app.brevo.com → SMTP & API → API keys).",
        "Ein neu erzeugter Schlüssel ersetzt den alten sofort — der alte gilt dann nicht mehr.",
      ],
      behebbar: true, roh,
    };
  }
  if (status === 403) {
    return {
      titel: "Der Brevo-Schlüssel darf diese Abfrage nicht.",
      anleitung: [
        "Der Schlüssel braucht Leserechte auf die Transaktions-Statistik.",
        "Erzeuge in Brevo einen Schlüssel mit vollem Zugriff und trage ihn als BREVO_API_KEY ein.",
      ],
      behebbar: true, roh,
    };
  }
  if (status === 429) {
    return {
      titel: "Brevo bremst uns — zu viele Abfragen in kurzer Zeit.",
      anleitung: [
        "Warte ein paar Minuten und versuche es erneut.",
        "Der Abgleich läuft ohnehin stündlich von selbst; ein Ausfall holt sich beim nächsten Lauf nach.",
      ],
      // Kein Einstellungsfehler, aber auch kein Ausfall — es löst sich selbst.
      behebbar: true, roh,
    };
  }
  if (status === 0) {
    return {
      titel: "Brevo war nicht erreichbar.",
      anleitung: [
        "Das kann eine kurze Störung sein. Der stündliche Abgleich versucht es von selbst erneut.",
        "Hält es an, prüfe status.brevo.com.",
      ],
      behebbar: false, roh,
    };
  }
  if (status >= 500) {
    return {
      titel: `Brevo meldet einen eigenen Fehler (HTTP ${status}).`,
      anleitung: [
        "Das liegt nicht an FIAON. Der stündliche Abgleich versucht es erneut.",
        "Hält es an, prüfe status.brevo.com.",
      ],
      behebbar: false, roh,
    };
  }
  return {
    titel: `Brevo hat mit HTTP ${status} geantwortet.`,
    anleitung: ["Die vollständige Antwort steht unten — sie gehört in eine Rückfrage an Brevo."],
    behebbar: false, roh,
  };
}

/** Fehlt der Schlüssel überhaupt, ist das kein Fehler, sondern eine Lücke. */
export function brevoNichtEingerichtet(): BrevoKlartext {
  return {
    titel: "Es ist kein Brevo-Schlüssel hinterlegt.",
    anleitung: [
      "Ohne Schlüssel kann FIAON nicht nachsehen, ob eine Mail wirklich angekommen ist — "
        + "gesendet wird trotzdem, über Make.",
      "Schlüssel holen: app.brevo.com → SMTP & API → API keys → Generate a new API key.",
      "Als BREVO_API_KEY in die Umgebung eintragen und den Server neu starten.",
    ],
    behebbar: true, roh: "BREVO_API_KEY fehlt",
  };
}
