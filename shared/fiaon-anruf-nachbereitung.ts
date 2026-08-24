// ═══════════════════════════════════════════════════════════════════════════
// WAS NACH DEM GESPRÄCH GEFRAGT WIRD — je nach Lage des Menschen
//
// ── DER AUFTRAG (Justin, 24.08.2026) ───────────────────────────────────────
// „Wenn man auf ‚Gut gelaufen' klickt, soll es die Auswahlen geben:
//  (FALLS ER NOCH KEIN MANDAT HAT) ‚Mandat gewonnen' oder ‚Mandat nicht
//  gewonnen'. Wenn schon Mandat, dann: Termin gebucht, Zahlung bestätigt,
//  Sonstiges. Also der gesamte Ablauf muss realitätsnah und an die Situation
//  angepasst werden … Es macht auch einen Unterschied, ob es A-Kunde,
//  B-Kunde, C-Kunde ist, ob der Kunde nach der Bekanntgabe der Mail wegen
//  falscher Nummer aktualisiert und Termin gebucht hat, ob im Antragsprozess
//  ein Termin gebucht wurde, ob es um eine Rate geht — alle Szenarien, die es
//  gibt."
//
// ── WARUM DAS HIER STEHT UND NICHT IN DER OBERFLÄCHE ───────────────────────
// Diese Entscheidung ist die Stelle, an der sich Fachlichkeit und Anzeige
// treffen — und die Stelle, an der man sich am leichtesten irrt. In einer
// React-Komponente ließe sie sich nur durch Anklicken prüfen; hier ist sie
// eine reine Funktion, die `scripts/pruef-nachbereitung.ts` durch JEDE Lage
// schickt, bevor irgendetwas live geht.
//
// ── DIE EINE LEITFRAGE ─────────────────────────────────────────────────────
// Hat dieser Mensch schon ein MANDAT?
//   NEIN  → es geht um den Abschluss. Zwei Wege: gewonnen oder nicht.
//   JA    → der Abschluss ist Vergangenheit. Es geht um das, was jetzt läuft:
//           ein Termin, eine Zahlung, oder etwas, das man aufschreiben muss.
// Alles Weitere verfeinert nur: eine überfällige Rate fragt nach Geld, ein
// fälliger Rückruf nach dem nächsten Schritt, ein Lead ohne Antrag danach, ob
// überhaupt Interesse besteht.
// ═══════════════════════════════════════════════════════════════════════════

/** Die neun Lagen aus fiaon-office-vertrieb.ts, plus „unbekannt" für Nummern
 *  ohne zugeordneten Menschen. */
export type NachLage =
  | "rate_ueberfaellig" | "zusage_gebrochen" | "rueckruf_faellig"
  | "bezahlt_ohne_termin" | "zahlung_gemeldet" | "rechnung_offen"
  | "lead_ohne_antrag" | "termin_heute" | "alles_gut" | "unbekannt";

export type Urteil = "gut" | "nicht_erreicht" | "schlecht";

export interface NachEingang {
  lage: NachLage;
  /** Steht `mandat_seit` an der Person? Das ist die Leitfrage. */
  hatMandat: boolean;
  /** Ein Termin in der Zukunft ODER heute — egal ob vorher oder im Gespräch gebucht. */
  hatTermin: boolean;
  /** Eine Zahlungszusage mit Datum. */
  hatZusage: boolean;
  /** Ging der Anruf an eine Nummer ohne zugeordneten Menschen? */
  ohneKunde: boolean;
  /** Kam eine offene Rate mit (Forderungsmanagement)? */
  mitRate: boolean;
}

export interface NachWeg {
  /** Das kanonische Ergebnis aus shared/fiaon-kontakt-ergebnis-liste.ts.
   *  KEINE neuen Arten — der Server prüft gegen dieselbe Liste. */
  art: string;
  /** Was auf dem Knopf steht. */
  label: string;
  /** Ein Satz darunter, der sagt, was der Klick auslöst. */
  hinweis?: string;
  /** Braucht der Weg ein Datum? */
  braucht?: "zusage" | "termin" | null;
  /** Ist eine Notiz Pflicht? */
  notizPflicht?: boolean;
  /** Soll danach das Mandat verbucht werden? */
  mandat?: boolean;
  /** Öffnet danach die Akte. */
  zurAkte?: boolean;
  /** Optischer Ton. */
  ton?: "gut" | "still" | "warn";
}

/**
 * Die Wege nach dem Gespräch.
 *
 * Rückgabe ist IMMER mindestens ein Weg — eine leere Liste hieße, dass der
 * Mitarbeiter nichts dokumentieren kann, und ein Gespräch ohne Ergebnis ist
 * für den nächsten Anrufer ein verlorenes Gespräch.
 */
export function nachbereitungsWege(e: NachEingang, urteil: Urteil): NachWeg[] {
  // ── NICHT ERREICHT ────────────────────────────────────────────────────
  // Hier ist alles gelogen, was „erreicht" behauptet. Drei Möglichkeiten,
  // mehr gibt es nicht.
  if (urteil === "nicht_erreicht") {
    return [
      { art: "nicht_erreicht", label: "Niemand dran", hinweis: "Wiedervorlage setzt das System selbst.", ton: "still" },
      { art: "mailbox", label: "Mailbox besprochen", hinweis: "Zählt als Kontaktversuch mit Ansage.", ton: "still" },
      { art: "nummer_falsch", label: "Falsche Nummer", hinweis: "Der Kunde bekommt eine Mail, um sie selbst zu berichtigen.", ton: "warn" },
    ];
  }

  // ── KEIN INTERESSE ────────────────────────────────────────────────────
  if (urteil === "schlecht") {
    const wege: NachWeg[] = [
      { art: "erreicht_abgelehnt", label: e.hatMandat ? "Will kündigen" : "Kein Interesse",
        hinweis: e.hatMandat ? "Der Kunde bleibt in deinem Bestand — die Kündigung läuft über die Leitung."
                             : "Der Mensch rutscht aus deiner Arbeitsliste.", ton: "warn" },
      { art: "nummer_blockiert", label: "Möchte nicht mehr angerufen werden",
        hinweis: "Die Nummer wird gesperrt und der Mensch an einen Kollegen abgegeben.", ton: "warn" },
    ];
    if (!e.hatMandat) {
      wege.push({ art: "nummer_falsch", label: "War gar nicht der Richtige",
        hinweis: "Falsche Nummer — der Kunde berichtigt sie selbst per Mail.", ton: "still" });
    }
    return wege;
  }

  // ══ GUT GELAUFEN ═════════════════════════════════════════════════════

  // Eine Nummer ohne zugeordneten Menschen. Justin: „Wenn nicht [zugewiesen],
  // auch okay — dann nach dem Telefonat fragen, warum der Anruf geführt wurde."
  // Ohne diese Notiz steht in der Statistik ein Anruf ohne jeden Zweck.
  if (e.ohneKunde) {
    return [
      { art: "erreicht_sonstiges", label: "Warum hast du angerufen?",
        hinweis: "Kurz aufschreiben — sonst steht hier später ein Anruf, den niemand einordnen kann.",
        notizPflicht: true, ton: "still" },
    ];
  }

  // Forderungsmanagement: Es kam eine Rate mit. Dann geht es um diese Rate und
  // um nichts anderes — die Ergebnisse dafür sind eine eigene Liste.
  if (e.mitRate) return [];

  // ── OHNE MANDAT: Es geht um den Abschluss ────────────────────────────
  if (!e.hatMandat) {
    const gewonnen: NachWeg = {
      art: "erreicht_zahlt_gleich",
      label: "Mandat gewonnen",
      hinweis: e.hatTermin
        ? "Der Termin steht — das Mandat wird sofort verbucht und der Kunde zählt zu deinem Bestand."
        : "Du buchst gleich in der Akte das Startgespräch, danach zählt der Kunde zu deinem Bestand.",
      mandat: e.hatTermin,      // ohne Termin führt der Weg erst in die Akte
      zurAkte: true,
      ton: "gut",
    };
    const wege: NachWeg[] = [gewonnen];

    // Bei einem Lead ohne Antrag ist „zahlt am …" die häufigste Zwischenstufe:
    // Interesse ja, Geld noch nicht. Ohne diesen Weg müsste man ihn als
    // „Sonstiges" verstecken.
    if (e.lage === "lead_ohne_antrag" || e.lage === "rechnung_offen" || e.lage === "zahlung_gemeldet") {
      if (!e.hatZusage) {
        wege.push({ art: "erreicht_zahlt_am", label: "Zahlt am …",
          hinweis: "Er will, aber später. Das Datum hält das System nach.",
          braucht: "zusage", ton: "still" });
      }
      if (!e.hatTermin) {
        wege.push({ art: "rueckruf_termin", label: "Rückruf vereinbart",
          hinweis: "Er überlegt noch — du meldest dich zur vereinbarten Zeit.",
          braucht: "termin", ton: "still" });
      }
    }

    wege.push({
      art: "erreicht_abgelehnt", label: "Mandat nicht gewonnen",
      hinweis: "Erreicht, aber es kommt nicht zustande. Der Mensch rutscht aus deiner Arbeitsliste.",
      ton: "warn",
    });
    wege.push({ art: "erreicht_sonstiges", label: "Sonstiges",
      hinweis: "Alles, was in keine der Schubladen passt — mit Notiz.",
      notizPflicht: true, ton: "still" });
    return wege;
  }

  // ── MIT MANDAT: Der Abschluss ist Vergangenheit ──────────────────────
  const wege: NachWeg[] = [];

  // Ein Termin, der im Gespräch schon gebucht wurde, wird BESTÄTIGT, nicht
  // erneut abgefragt. Justin: „Wenn er bereits einen Termin gebucht hat, wäre
  // es dumm, wenn wir ihn fragen, wann er einen Termin buchen mag."
  if (!e.hatTermin) {
    wege.push({ art: "rueckruf_termin", label: "Termin gebucht",
      hinweis: "Zeit wählen — der Kunde bekommt die Bestätigung per Mail.",
      braucht: "termin", ton: "gut" });
  }

  // Eine gebrochene Zusage ist der Fall, in dem es NUR ums Geld geht.
  if (e.lage === "zusage_gebrochen") {
    wege.unshift({ art: "erreicht_zahlt_gleich", label: "Zahlung bestätigt",
      hinweis: "Er zahlt jetzt. Die alte Zusage ist damit erledigt.", ton: "gut" });
    wege.push({ art: "erreicht_zahlt_am", label: "Neue Zusage",
      hinweis: "Er nennt ein neues Datum. Das System hält es nach.",
      braucht: "zusage", ton: "still" });
  } else {
    wege.push({ art: "erreicht_zahlt_gleich", label: "Zahlung bestätigt",
      hinweis: "Der Kunde hat gezahlt oder zahlt sofort.", ton: "gut" });
    if (!e.hatZusage) {
      wege.push({ art: "erreicht_zahlt_am", label: "Zahlt am …",
        hinweis: "Mit Datum — das System fasst von selbst nach.",
        braucht: "zusage", ton: "still" });
    }
  }

  wege.push({ art: "erreicht_sonstiges", label: "Sonstiges",
    hinweis: "Adressänderung, Rückfrage, Vertragswunsch — mit Notiz, damit der nächste Anruf daran anknüpfen kann.",
    notizPflicht: true, ton: "still" });
  return wege;
}

/** Ein Satz über der Auswahl — er sagt, in welcher Lage der Mensch steckt. */
export function nachLageSatz(e: NachEingang, vorname: string): string {
  const wer = vorname || "Der Kunde";
  if (e.ohneKunde) return "Diese Nummer gehört zu keinem Kunden im System.";
  if (e.mitRate) return `Es ging um die offene Rate von ${wer}.`;
  if (!e.hatMandat) {
    switch (e.lage) {
      case "lead_ohne_antrag": return `${wer} hat noch keinen Antrag — es geht um den Abschluss.`;
      case "rechnung_offen": return `${wer} hat den Antrag fertig, die Rechnung ist offen.`;
      case "zahlung_gemeldet": return `${wer} hat eine Zahlung gemeldet, das Geld ist noch nicht bestätigt.`;
      default: return `${wer} ist noch kein Mandat — es geht um den Abschluss.`;
    }
  }
  switch (e.lage) {
    case "zusage_gebrochen": return `${wer} hat eine Zahlung zugesagt und das Datum verstreichen lassen.`;
    case "rueckruf_faellig": return `Das war der Rückruf, den du ${wer} zugesagt hast.`;
    case "bezahlt_ohne_termin": return `${wer} hat bezahlt, aber noch kein Startgespräch.`;
    case "termin_heute": return `${wer} hatte heute einen Termin.`;
    default: return `${wer} gehört zu deinem Bestand.`;
  }
}
