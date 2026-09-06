// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: DER KUNDENBEREICH /APP (Scheibe 6, 06.09.2026)
//
// Schreibregeln: siehe konto.ts. Diese Datei folgt ihnen unverändert —
// gesiezt, ein Gedanke je Absatz, ein Knopf, keine Zusage, kein Vergleich,
// kein Rabatt. Jeder Satz ging durch wandPruefen (shared/fiaon-wortverbote.ts).
//
// Jedes Modul der Scheibe trägt seine Vorlage hier ein (app_monatsbericht,
// app_login_link, …). Die Nutzlast-Wahrheit steht in
// server/make-events-registry.ts (example-Blöcke) — nur Platzhalter verwenden,
// die das Ereignis WIRKLICH mitschickt.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

export const APP_VORLAGEN: Record<string, MailBaustein> = {

  // ── Modul C: Anmelde-Link ohne Passwort ────────────────────────────────────
  // Der Kunde hat seine Adresse eingegeben; der Link ist das Geheimnis. Darum
  // kein Datenkasten, kein Aktenzeichen, nichts, was die Mail wertvoller
  // macht als nötig — nur der eine Knopf und die Fußnote mit Frist und
  // Einmaligkeit. Wer den Link nicht angefordert hat, muss nichts tun.
  app_login_link: {
    betreff: "Ihr Anmelde-Link für Mein FIAON",
    preheader: "Ein Klick, und Sie sind angemeldet — ohne Passwort.",
    titel: "Ihr Anmelde-Link",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, Sie haben einen Anmelde-Link für Mein FIAON angefordert.",
      "Mit dem Knopf unten melden Sie sich direkt an — ein Passwort brauchen Sie dafür nicht. Bitte öffnen Sie den Link auf dem Gerät, auf dem Sie Ihren Bereich nutzen möchten.",
    ],
    knopf: { text: "Jetzt anmelden", url: "{{params.login_link_url}}" },
    fussnote: "Der Link gilt 60 Minuten und nur einmal. Nicht angefordert? Dann ignorieren Sie diese E-Mail.",
  },

  // ── Modul A: Monatsbericht ─────────────────────────────────────────────────
  // Ein Beleg, keine Werbung: Der Kunde soll die Zahl nachrechnen können,
  // deshalb heißt der Knopf „Nachrechnen“ und führt auf den Bericht mit jedem
  // einzelnen Posten. Die große Zahl kommt FERTIG aus dem Bericht
  // (grosse_zahl_text, betrag_text) — die Vorlage rechnet nichts und
  // formuliert keinen eigenen Betrag. Kein karteZiel-Block: ein Beleg wirbt
  // nicht. Platzhalter (Registry): vorname, monat_text, grosse_zahl_text,
  // betrag_text, bericht_url. Bei 0 € liefert der Lauf betrag_text als Wort
  // („noch kein Betrag“), nicht als „0,00 €“ — ob die Mail bei 0 € überhaupt
  // gehen soll, entscheidet Justin (Schalter, offen).
  app_monatsbericht: {
    betreff: "Ihr Bericht für {{params.monat_text}} ist da",
    preheader: "Was in {{params.monat_text}} in Ihrer Akte geschehen ist — jede Zahl zum Nachrechnen.",
    titel: "Ihr Bericht für {{params.monat_text}}",
    marke: "Monatsbericht",
    absaetze: [
      "Guten Tag {{params.vorname}}, einmal im Monat fassen wir zusammen, was in Ihrer Akte geschehen ist: was bewilligt wurde, was noch unterwegs ist und welche Raten eingegangen sind.",
      "{{params.grosse_zahl_text}}",
      "Jede Zahl im Bericht kommt aus einem Vorgang Ihrer Akte — Sie können sie Posten für Posten nachrechnen. Der Bericht ändert sich nicht mehr: Er ist Ihr Beleg für diesen Monat.",
    ],
    daten: [
      { label: "Berichtsmonat", wert: "{{params.monat_text}}" },
      { label: "Für Sie geholt", wert: "{{params.betrag_text}}" },
    ],
    knopf: { text: "Nachrechnen", url: "{{params.bericht_url}}" },
    // Keine Mitarbeiter-Sicht auf fiaon_monatsberichte, Absender ist „welcome“ —
    // darum keine Zusage, dass jemand „denselben Bericht sieht“ (Prüfung 06.09.2026).
    fussnote: "Fragen zu einem Posten? Jeder Posten führt in Mein FIAON zu seinem Vorgang – dort steht, wer für ihn zuständig ist.",
  },

};
