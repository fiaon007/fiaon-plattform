/* ════════════════════════════════════════════════════════════════════════
   FIAON — Begrüßungs- & Onboarding-Textbausteine (Kunden-Dashboard)
   ------------------------------------------------------------------------
   ZENTRALE, LEICHT ANPASSBARE STELLE für die Willkommens-Texte.

   WICHTIG (Betreiber-Hinweis):
   - Die REINE BEGRÜSSUNG (title + body) ist IMMER aktiv.
   - Die FEATURE-/ORIENTIERUNGS-TOUR (die Schritte-Liste) ist erst dann sinnvoll,
     wenn die erklärten Funktionen wirklich existieren. Deshalb ist sie über den
     Schalter `tourEnabled` steuerbar und standardmäßig AUS.
   - `version` erhöhen, wenn Texte geändert wurden und alle Kunden das Popup
     einmalig erneut sehen sollen (setzt den „schon gesehen"-Merker zurück).

   Prompt 2 (Admin-Gegenseite): Dieser Baustein ist bewusst als reine Daten-
   struktur mit {name}-Platzhalter gehalten, damit er später 1:1 aus dem Admin
   bzw. der Datenbank befüllt werden kann, ohne Code anzufassen.
   ════════════════════════════════════════════════════════════════════════ */

export type WelcomeState = "first" | "incomplete" | "review" | "active";

export interface WelcomeBlock {
  /** Überschrift. `{name}` wird durch den Vornamen ersetzt. */
  title: string;
  /** Fließtext. `{name}` wird durch den Vornamen ersetzt. */
  body: string;
  /** Orientierungs-Schritte (Feature-Tour) — nur sichtbar, wenn `tourEnabled`. */
  steps?: string[];
  /** Beschriftung des Haupt-Buttons. */
  cta: string;
  /** Optionaler Sprung in einen Dashboard-Bereich beim Klick auf den Button. */
  gotoSection?: "overview" | "account" | "documents";
}

export interface WelcomeConfig {
  /** Feature-Tour (Orientierungs-Schritte) global scharf schalten. */
  tourEnabled: boolean;
  /** Version der Texte — erhöhen, um das Popup einmalig erneut zu zeigen. */
  version: number;
  content: Record<WelcomeState, WelcomeBlock>;
}

export const welcomeConfig: WelcomeConfig = {
  // Standardmäßig AUS: erst einschalten, wenn die Funktionen wirklich existieren.
  tourEnabled: false,
  version: 1,
  content: {
    /* ── Erster Login: herzliche Begrüßung + kurze Orientierung ── */
    first: {
      title: "Hallo {name}, schön, dass du da bist!",
      body: "Willkommen bei FIAON — schön, dass du an Bord bist. Das hier ist dein persönlicher Mitgliedsbereich. Ab jetzt kümmern wir uns um dich und begleiten dich Schritt für Schritt. Ich zeige dir kurz, wo du was findest.",
      steps: [
        "Übersicht: Dein Status und dein Paket-Rahmen auf einen Blick.",
        "Mein Konto: Vervollständige dein Profil, damit wir deinen Zugang freischalten können.",
        "Dokumente: Lade deine Unterlagen sicher und verschlüsselt hoch.",
      ],
      cta: "Los geht's",
      gotoSection: "overview",
    },

    /* ── Profil unvollständig: freundlicher Hinweis + klare Handlung ── */
    incomplete: {
      title: "Willkommen zurück, {name}",
      body: "Es fehlen noch ein paar Angaben, damit wir deinen Zugang freischalten können. Am schnellsten geht es, wenn du dein Profil vervollständigst und deine Dokumente hochlädst — den Überblick über die nächsten Schritte findest du auf der Startseite.",
      steps: [
        "Profil vervollständigen unter »Mein Konto«.",
        "Dokumente hochladen unter »Dokumente«.",
      ],
      cta: "Profil vervollständigen",
      gotoSection: "account",
    },

    /* ── In Prüfung: beruhigend, was gerade passiert ── */
    review: {
      title: "Alles bei uns eingegangen, {name}",
      body: "Deine Unterlagen und Angaben liegen uns vollständig vor. Unser Team prüft sie in der Regel innerhalb von 1–3 Werktagen. Du musst gerade nichts weiter tun — wir melden uns bei dir.",
      cta: "Alles klar",
      gotoSection: "overview",
    },

    /* ── Aktiv/alles erledigt: kurze, wertschätzende Begrüßung ── */
    active: {
      title: "Schön, dass du da bist, {name}",
      body: "Dein FIAON-Zugang ist freigeschaltet. Alles ist erledigt — wir freuen uns, dich als Mitglied zu begleiten.",
      cta: "Weiter",
      gotoSection: "overview",
    },
  },
};

/** Ersetzt `{name}` und liefert einen sicheren Fallback, wenn kein Name da ist. */
export function fillName(text: string, name?: string): string {
  return text.replace(/\{name\}/g, (name && name.trim()) || "willkommen");
}
