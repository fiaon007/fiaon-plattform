// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-FEHLER IN KLARTEXT
//
// ── DER FEHLER, DER DIESE DATEI AUSGELÖST HAT ──────────────────────────────
// In Produktion stand im Panel:
//     „Das Telefon konnte nicht starten: undefined"
//
// Ursache: `err instanceof Error ? err.message : String(err)`. Fehler des
// Twilio-Browser-SDK SIND Instanzen von Error — aber ihre Aussage steckt
// nicht in `message`, sondern in `code`, `description`, `explanation` oder
// einem verschachtelten `originalError`. `message` ist bei einigen Klassen
// schlicht leer. Der Ausdruck lief also in den ersten Zweig und lieferte
// undefined.
//
// „undefined" ist die schlechteste aller Fehlermeldungen: Sie sagt nicht
// einmal, dass etwas unbekannt ist — sie sieht aus wie ein Programmfehler
// und lässt den Nutzer ratlos zurück.
//
// ── WAS DIESE DATEI TUT ────────────────────────────────────────────────────
// Sie holt aus JEDEM Fehlerobjekt das Beste heraus, was drinsteht, und
// ergänzt für die bekannten Twilio-Codes, WAS ZU TUN IST. Ein Code allein
// hilft dem Betreiber nicht; „31402 — der Browser hat kein Mikrofon
// freigegeben" schon.
//
// Geteilt zwischen Server und Browser: Beide Seiten sollen dieselbe Sprache
// sprechen, sonst heißt derselbe Fehler an zwei Stellen anders.
// ═══════════════════════════════════════════════════════════════════════════

export interface TelefonFehler {
  /** Der Twilio-Code, falls es einen gibt — er ist der Schlüssel zum Support. */
  code: number | null;
  /** Ein Satz, den ein Mensch versteht. */
  titel: string;
  /** Was jetzt zu tun ist. Leer, wenn nichts zu tun ist. */
  rat: string;
  /** Die Rohfassung, für das Protokoll. Nie für die Oberfläche. */
  roh: string;
  /** Kann der Betreiber das selbst beheben? */
  behebbar: boolean;
}

/**
 * Die Codes, die in der Praxis vorkommen.
 *
 * Bewusst keine vollständige Liste — Twilio hat hunderte. Hier stehen die,
 * die bei einem Browser-Softphone tatsächlich auftreten, mit dem Handgriff,
 * der sie löst.
 */
const CODES: Record<number, { titel: string; rat: string; behebbar: boolean }> = {
  20101: {
    titel: "Der Zugangsausweis wurde abgelehnt",
    rat: "Der API-Key gehört nicht zu diesem Twilio-Konto, oder das Secret stimmt nicht. "
      + "Lege in der Twilio-Console unter „Account → API keys & tokens“ einen neuen Standard-Key an "
      + "und trage SID und Secret neu ein.",
    behebbar: true,
  },
  20104: {
    titel: "Der Zugangsausweis ist abgelaufen",
    rat: "Das passiert, wenn zwischen Anforderung und Wahl mehr als eine Stunde liegt. "
      + "Schließe das Telefon und öffne es neu.",
    behebbar: true,
  },
  31000: {
    titel: "Allgemeiner Verbindungsfehler",
    rat: "Meist ein Netzproblem. Prüfe die Verbindung und versuche es erneut.",
    behebbar: true,
  },
  31005: {
    titel: "Die Verbindung zu Twilio ist abgerissen",
    rat: "Häufig eine Firewall, die WebRTC blockiert (UDP 10000–20000). "
      + "In einem Firmennetz muss der Bereich freigegeben sein.",
    behebbar: true,
  },
  31201: {
    titel: "Kein Zugriff auf das Mikrofon",
    rat: "Der Browser hat die Freigabe nicht erteilt. Klicke links in der Adresszeile auf das "
      + "Schloss und erlaube das Mikrofon — danach die Seite neu laden.",
    behebbar: true,
  },
  31208: {
    titel: "Das Mikrofon wurde nicht freigegeben",
    rat: "Erlaube den Mikrofonzugriff, wenn der Browser fragt. Ohne ihn kann niemand dich hören.",
    behebbar: true,
  },
  31402: {
    titel: "Der Browser hat kein Mikrofon gefunden",
    rat: "Ist ein Mikrofon oder Headset angeschlossen? Unter macOS zusätzlich in den "
      + "Systemeinstellungen → Datenschutz → Mikrofon den Browser freigeben.",
    behebbar: true,
  },
  31480: {
    titel: "Der Angerufene ist vorübergehend nicht erreichbar",
    rat: "Später erneut versuchen.",
    behebbar: false,
  },
  31486: {
    titel: "Besetzt",
    rat: "Die Gegenseite telefoniert gerade.",
    behebbar: false,
  },
  31603: {
    titel: "Der Ruf wurde abgelehnt",
    rat: "",
    behebbar: false,
  },
  13224: {
    titel: "Diese Nummer darf nicht angerufen werden",
    rat: "Twilio sperrt Ziele, die im Konto nicht freigeschaltet sind. Prüfe unter "
      + "„Voice → Settings → Geographic Permissions“, ob Deutschland, Österreich und die "
      + "Schweiz erlaubt sind.",
    behebbar: true,
  },
  21215: {
    titel: "Das Zielland ist im Konto gesperrt",
    rat: "Twilio → Voice → Settings → Geographic Permissions: DE, AT und CH freischalten.",
    behebbar: true,
  },
  21210: {
    titel: "Die Absendernummer gehört nicht zu diesem Konto",
    rat: "TWILIO_CALLER_ID muss eine Nummer sein, die in DIESEM Twilio-Konto gekauft "
      + "oder als Caller ID verifiziert wurde.",
    behebbar: true,
  },
  31941: {
    titel: "Die TwiML-App antwortet nicht richtig",
    rat: "Die Voice-URL der TwiML-App muss auf https://www.fiaon.com/api/fiaon/telefon/twiml "
      + "zeigen und die Methode POST verwenden. Eine leere URL ist der häufigste Grund.",
    behebbar: true,
  },
};

/**
 * Aus irgendeinem geworfenen Ding einen brauchbaren Fehler machen.
 *
 * Die Reihenfolge ist Absicht: Erst der Twilio-Code (er ist am genauesten),
 * dann die eigenen Textfelder des SDK, dann `message`, dann der Rohstring.
 * `message` steht bewusst NICHT vorn — bei Twilio ist es oft leer.
 */
export function telefonFehler(err: unknown): TelefonFehler {
  const e = (err ?? {}) as any;

  // Der Code kann an mehreren Stellen stecken.
  const rohCode = e.code ?? e.causes?.[0]?.code ?? e.originalError?.code ?? null;
  const code = Number.isFinite(Number(rohCode)) && Number(rohCode) !== 0 ? Number(rohCode) : null;

  const roh = (() => {
    try {
      if (typeof err === "string") return err;
      const teile = [e.code, e.message, e.description, e.explanation,
                     e.originalError?.message, e.causes?.join?.("; ")]
        .filter((x) => x != null && x !== "");
      return teile.length ? teile.join(" | ") : JSON.stringify(err ?? null);
    } catch {
      return String(err);
    }
  })();

  if (code && CODES[code]) {
    return { code, ...CODES[code], roh };
  }

  // Kein bekannter Code: das Beste aus den Textfeldern.
  const text = [e.description, e.explanation, e.message, e.originalError?.message]
    .find((x) => typeof x === "string" && x.trim().length > 0);

  if (text) {
    return {
      code,
      titel: code ? `Twilio-Fehler ${code}: ${text}` : text,
      rat: code
        ? "Diesen Code kennt FIAON noch nicht. Such ihn unter twilio.com/docs/api/errors — "
          + "und sag Bescheid, dann kommt er hier mit Klartext dazu."
        : "",
      roh, behebbar: false,
    };
  }

  // Gar nichts Brauchbares. Das ist der Fall, der früher „undefined" ergab.
  return {
    code,
    titel: code
      ? `Twilio-Fehler ${code} — ohne weitere Angabe`
      : "Das Telefon konnte nicht starten, und der Fehler nennt keinen Grund",
    rat: "Öffne Einstellungen → Telefon → „Verbindung prüfen“. Dort läuft die ganze "
      + "Kette einzeln durch und zeigt, an welcher Stelle es klemmt.",
    roh, behebbar: true,
  };
}

/** Eine Zeile für die Oberfläche. Nie „undefined“, nie leer. */
export function telefonFehlerText(err: unknown): string {
  const f = telefonFehler(err);
  return f.rat ? `${f.titel} — ${f.rat}` : f.titel;
}
