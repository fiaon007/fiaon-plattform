// ═══════════════════════════════════════════════════════════════════════════
// BREVO-FEHLER IN KLARTEXT
//
// Der Vorgesetzte sah in der Mail-Zentrale die rohe API-Antwort:
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
  /**
   * WER hat den Fehler gemacht? Die wichtigste Unterscheidung überhaupt.
   *
   * ── WARUM DAS EIN EIGENES FELD IST (21.08.2026) ─────────────────────────
   * Der Betreiber setzte BREVO_API_KEY, und die Zweigprüfung scheiterte bei
   * ALLEN 35 Ereignissen gleich: „Brevo hat mit HTTP 400 geantwortet."
   * Gleichzeitig kamen die Testmails bei ihm an. Der Versand war gesund.
   *
   * Die Anzeige machte daraus „35 ohne Zweig" — eine Anschuldigung gegen den
   * Betreiber, obwohl UNSERE Abfrage falsch war. Genau das Muster, das schon
   * einmal in dieser Datei stand („Vorgesetzten-TODO", 09.08.2026).
   *
   *   "wir"   — unsere Abfrage ist falsch. Nichts am Versand ist kaputt, und
   *             niemand muss in Make nachsehen. Ein Programmfehler.
   *   "brevo" — Brevos Seite (Ausfall, Bremse, Sicherheit).
   *   "einstellung" — etwas ist nicht eingerichtet (Schlüssel, IP-Freigabe).
   */
  wer: "wir" | "brevo" | "einstellung";
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
    // Die Adresse merken. Diese Funktion ist synchron und soll es bleiben —
    // deshalb ohne await: Ein Merker darf die Fehlerübersetzung nicht
    // aufhalten, und sein Misslingen darf sie nicht umwerfen.
    if (ip) {
      void import("./fiaon-server-ip")
        .then((m) => m.ipVormerken(ip))
        .catch(() => {});
    }
    return {
      titel: "Brevo-Sicherheit blockiert diesen Server"
        + (ip ? ` — die Adresse ${ip} steht nicht auf der Freigabeliste.` : "."),
      anleitung: ip
        ? [`Trage ${ip} auf app.brevo.com/security/authorised_ips ein`, ...IP_ANLEITUNG.slice(1)]
        : IP_ANLEITUNG,
      behebbar: true, roh, wer: "einstellung",
    };
  }
  if (status === 401) {
    return {
      titel: "Brevo hat den Schlüssel abgelehnt.",
      anleitung: [
        "Prüfe, ob BREVO_API_KEY noch gültig ist (app.brevo.com → SMTP & API → API keys).",
        "Ein neu erzeugter Schlüssel ersetzt den alten sofort — der alte gilt dann nicht mehr.",
      ],
      behebbar: true, roh, wer: "einstellung",
    };
  }
  if (status === 403) {
    return {
      titel: "Der Brevo-Schlüssel darf diese Abfrage nicht.",
      anleitung: [
        "Der Schlüssel braucht Leserechte auf die Transaktions-Statistik.",
        "Erzeuge in Brevo einen Schlüssel mit vollem Zugriff und trage ihn als BREVO_API_KEY ein.",
      ],
      behebbar: true, roh, wer: "einstellung",
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
      behebbar: true, roh, wer: "brevo",
    };
  }
  if (status === 0) {
    return {
      titel: "Brevo war nicht erreichbar.",
      anleitung: [
        "Das kann eine kurze Störung sein. Der stündliche Abgleich versucht es von selbst erneut.",
        "Hält es an, prüfe status.brevo.com.",
      ],
      behebbar: false, roh, wer: "brevo",
    };
  }
  if (status >= 500) {
    return {
      titel: `Brevo meldet einen eigenen Fehler (HTTP ${status}).`,
      anleitung: [
        "Das liegt nicht an FIAON. Der stündliche Abgleich versucht es erneut.",
        "Hält es an, prüfe status.brevo.com.",
      ],
      behebbar: false, roh, wer: "brevo",
    };
  }
  // ══════════════════════════════════════════════════════════════════════
  // HTTP 400 HEISST: UNSERE ABFRAGE IST FALSCH
  //
  // ── DER VORFALL (21.08.2026) ─────────────────────────────────────────
  // Der Betreiber setzte BREVO_API_KEY. Die Zweigprüfung scheiterte bei ALLEN
  // 35 Ereignissen identisch mit „Brevo hat mit HTTP 400 geantwortet" —
  // während das Zustellprotokoll alle Testmails als versandt zeigte und der
  // Betreiber sie EMPFING.
  //
  // Ursache: `ereignisseFuer()` schickte `endDate` auf MORGEN
  // (Date.now() + 86_400_000). Brevo lehnt ein Enddatum in der Zukunft mit 400
  // ab. Der Versand war die ganze Zeit gesund; nur die Nachschau war kaputt.
  //
  // ── WARUM DAS EINEN EIGENEN FALL BRAUCHT ────────────────────────────
  // Vorher fiel 400 in den Sammelfall unten: „Brevo hat mit HTTP 400
  // geantwortet … gehört in eine Rückfrage an Brevo." Das ist falsch und
  // schickt den Betreiber zum Anbieter, während der Fehler bei uns liegt.
  //
  // Und schlimmer: Die Kachel machte daraus „35 ohne Zweig" — eine
  // Anschuldigung gegen den Betreiber, der die Zweige längst gebaut hatte.
  // Dasselbe Muster wie am 09.08.2026 („Vorgesetzten-TODO").
  // ══════════════════════════════════════════════════════════════════════
  if (status === 400 || status === 404 || status === 422) {
    // Brevo nennt in `message` meist den beanstandeten Parameter.
    const brevoSatz = (() => {
      try {
        const j = JSON.parse(roh);
        return typeof j?.message === "string" ? j.message : null;
      } catch { return null; }
    })();
    return {
      titel: "Die Prüfung selbst ist gestört — nicht der Versand."
        + (brevoSatz ? ` Brevo beanstandet: „${brevoSatz}“` : ""),
      anleitung: [
        `Das ist ein Programmfehler bei uns (HTTP ${status}): Brevo hat die Abfrage `
          + "abgelehnt, nicht die Mail. Der Versand läuft weiter, und Zweige fehlen deswegen nicht.",
        "Nichts in Make zu tun. Die vollständige Antwort steht unten und gehört in eine "
          + "Fehlermeldung an die Entwicklung.",
        "Der Abgleich holt alles nach, sobald die Abfrage stimmt — es geht keine Zustellung verloren.",
      ],
      // Behebbar, aber nicht vom Betreiber.
      behebbar: false, roh, wer: "wir",
    };
  }

  return {
    titel: `Brevo hat mit HTTP ${status} geantwortet.`,
    anleitung: ["Die vollständige Antwort steht unten — sie gehört in eine Rückfrage an Brevo."],
    behebbar: false, roh, wer: "brevo",
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
    behebbar: true, roh: "BREVO_API_KEY fehlt", wer: "einstellung",
  };
}
