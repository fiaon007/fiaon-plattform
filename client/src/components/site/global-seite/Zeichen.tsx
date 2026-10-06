// ═══════════════════════════════════════════════════════════════════════════
// ZWÖLF LINIEN-ZEICHEN FÜR DIE UNTERSEITEN (06.10.2026, E-293, Scheibe D)
//
// Bauplan Kapitel 5, Punkte 7 und 14: Jede Karte (Baustein „karten“, 19×) und
// jede Weiterlesen-Karte trägt ein Linien-Zeichen aus einem festen Satz von
// zwölf — Gesellschaft, Steuernummer, Konto, Karte, Pflichten, Miami, Kosten,
// Ablauf, Vergleich, Fragen, Werkzeug, Wissen. Gewählt wird in der Vorlage per
// Stichwort im Titel (kein neues Feld im Register, kein Text im Bild): so bleibt
// das Register unverändert und der Korpus für Suchmaschinen gleich.
// Dieselbe Strichstärke wie die Haarlinien der Business-Welt (1,4 px auf 24),
// rund, ohne Füllung; die Farbe kommt aus currentColor (Navy).
// Nachtrag 06.10.2026 (E-293): In einem Karten-Baustein nur, wenn jede Karte ein
// eigenes Zeichen bekommt (zeichenReihe) — sonst trägt keine eins.
// ═══════════════════════════════════════════════════════════════════════════

export type ZeichenArt =
  | "gesellschaft" | "steuernummer" | "konto" | "karte" | "pflichten" | "miami"
  | "kosten" | "ablauf" | "vergleich" | "fragen" | "werkzeug" | "wissen";

const PFADE: Record<ZeichenArt, string> = {
  // Urkunde mit Siegel
  gesellschaft: "M6 3.5h9l3 3V20.5H6z M15 3.5v3h3 M9 9h6 M9 12h4 M14.5 16.2a2.2 2.2 0 1 0 0 .01 M13.6 18.1l-.8 2.4 M15.4 18.1l.8 2.4",
  // Nummernschild mit Raute
  steuernummer: "M3.5 6.5h17v11h-17z M9 9.5l-1 5 M12 9.5l-1 5 M7 11h5.5 M6.6 13h5.5 M15 11h3 M15 13h2",
  // Kontobuch: Mappe mit Zeilen und Verschluss
  konto: "M4 6.5h16v12H4z M4 9.5h16 M7 13h5 M7 15.5h3 M15.5 12.5h3v3h-3z",
  // Karte mit Chip
  karte: "M3 6.5h18v11H3z M3 10h18 M6 13.5h3.5v2.2H6z M13.5 14.6h4",
  // Kalender mit Haken
  pflichten: "M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.8V7.5 M15.5 3.8V7.5 M9 15l2 2 4-4.2",
  // Ortsmarke
  miami: "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 7.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z",
  // Preisschild
  kosten: "M3.5 12.2V4.5h7.7l9 9-7.7 7.7z M7.6 8.6a1.1 1.1 0 1 0 0 .01",
  // Drei Stationen auf einer steigenden Linie
  ablauf: "M3.5 18.5h4v-5h5v-5h5v-4h3 M7.5 18.5a1.4 1.4 0 1 0 0 .01 M12.5 13.5a1.4 1.4 0 1 0 0 .01 M17.5 8.5a1.4 1.4 0 1 0 0 .01",
  // Waage
  vergleich: "M12 4v16 M8 20h8 M5 7h14 M5 7l-2.5 6h5z M19 7l-2.5 6h5z M12 4.2a.9.9 0 1 0 0 .01",
  // Frage im Kreis
  fragen: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6 M12 16.4v.1",
  // Zirkel / Regler
  werkzeug: "M5 7h14 M5 12h14 M5 17h14 M9 5.4v3.2 M15 10.4v3.2 M8 15.4v3.2",
  // Aufgeschlagenes Buch
  wissen: "M12 6.5c-2-1.6-4.8-2-8-1.6v13c3.2-.4 6 0 8 1.6 2-1.6 4.8-2 8-1.6v-13c-3.2-.4-6 0-8 1.6z M12 6.5v13",
};

export function Zeichen({ art, groesse = 22 }: { art: ZeichenArt; groesse?: number }) {
  return (
    <svg className={`fd-zeichen ${art}`} width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PFADE[art]} />
    </svg>
  );
}

// Stichworte in Reihenfolge der Prüfung — das erste Muster, das passt, gewinnt. Deutsch und englisch in einem Muster,
// weil die englischen Schwestern dieselbe Vorlage nutzen. Warn- und Fehlerkarten („Fehler“, „Warnzeichen“, „Irrweg“)
// tragen das Fragezeichen: Sie sind Prüffragen, keine Pflicht.
const STICHWORTE: [ZeichenArt, RegExp][] = [
  ["fragen", /\b(fehler|warnzeichen|vorsicht|irrweg|folge|grund|was stimmt|was nicht|mistake|warning|caution|wrong turn|consequence|reason|what is true|what is not|fragen|questions|faq)\b/i],
  ["vergleich", /\b(vergleich|selbst|gründungsdienst|passt|gut für|nicht gut|compare|comparison|yourself|formation service|fits|good for|not good)\b|\bvs\b/i],
  ["werkzeug", /\b(finder|werkzeug|tool)\b/i],
  // EIN, ITIN, SSN, IRS nur in Großbuchstaben — „ein“ ist im Deutschen der Artikel.
  ["steuernummer", /\b(EIN|ITIN|SSN|IRS|W-7|SS-4)\b|\b([Ss]teuernummer|[Tt]ax number|[Ff]ax)\b/],
  ["karte", /\b(karte|karten|firmenkarte|rahmen|kredit|darlehen|herausgeber|bonität|card|cards|credit|loan|issuer|limit)\b/i],
  ["konto", /\b(konto|bank|online|filiale|eröffnung|account|branch|opening)\b/i],
  ["pflichten", /\b(pflicht|pflichten|meldung|form|status|zustellung|auflösung|agent|steuererklärung|filing|report|compliance|registered)\b/i],
  ["kosten", /\b(kosten|preis|preise|festpreis|honorar|gebühr|gebühren|cost|costs|price|prices|fee|fees)\b/i],
  ["ablauf", /\b(ablauf|schritt|etappe|termin|weg|process|step|stage|appointment)\b/i],
  ["miami", /\b(miami|florida|vor ort|london|zürich|zurich|delaware|wyoming|deutschland|schweiz|on the ground|on site|germany|switzerland|standorte|locations|partner)\b/i],
  ["gesellschaft", /\b(llc|corporation|gesellschaft|gmbh|tochter|zweigniederlassung|gründung|gründer|unternehmer|privatperson|fiaon ltd|company|subsidiary|formation|founder|entrepreneur|private)\b/i],
  ["wissen", /\b(wissen|knowledge|ratgeber|guide)\b/i],
];

/** Das passende Zeichen zu einem Titel (plus Oberzeile/Adresse) — sonst `ersatz`. */
export function zeichenFuer(text: string, ersatz: ZeichenArt = "wissen"): ZeichenArt {
  for (const [art, muster] of STICHWORTE) if (muster.test(text)) return art;
  return ersatz;
}

/**
 * Zeichen für alle Karten EINES Bausteins (06.10.2026, E-293): Zwei Karten nebeneinander mit demselben Zeichen
 * unterscheidet das Zeichen nicht mehr (auf /business/tochtergesellschaft-usa trugen „LLC“ und „Corporation“ beide die
 * Urkunde) — dann ist es nur Schmuck. Bekäme eine Karte ein Zeichen, das im Baustein schon vergeben ist, verzichtet
 * der ganze Baustein auf Zeichen (null für alle); die Marke (tag) bleibt. Ein „nächstpassendes“ zweites Zeichen wurde
 * geprüft und verworfen: Es wäre oft willkürlich (LLC → Karte) und in DE und EN verschieden. Stand 06.10.: Von 38
 * Karten-Bausteinen behalten 2 ihre Zeichen (us-geschaeftskonto DE/EN: Online → Konto, Vor Ort → Ortsmarke).
 */
export function zeichenReihe(texte: string[], ersatz: ZeichenArt = "wissen"): (ZeichenArt | null)[] {
  const wahl = texte.map((t) => zeichenFuer(t, ersatz));
  return new Set(wahl).size === wahl.length ? wahl : texte.map(() => null);
}

/** Für eine Zielseite (Weiterlesen): erst die Adresse, dann der Titel, dann die Seitenart. */
export function zeichenFuerSeite(pfad: string, titel: string, art?: string): ZeichenArt {
  const p = pfad.toLowerCase();
  const nachPfad: [RegExp, ZeichenArt][] = [
    [/paket-finder|package-finder/, "werkzeug"], [/fragen|questions|faq/, "fragen"], [/vergleich|comparison/, "vergleich"],
    [/kosten|costs/, "kosten"], [/ablauf|process/, "ablauf"], [/ein-itin|ein-|itin/, "steuernummer"],
    [/geschaeftskonto|bank-?account|bankkonto/, "konto"], [/karte|card|credit|bonitaet/, "karte"],
    [/pflichten|obligations|5472|steuererklaerung|tax-return|registered-agent/, "pflichten"],
    [/miami|partner|florida|delaware|wyoming/, "miami"], [/^\/(en\/)?business\/(wissen|knowledge)$/, "wissen"],
  ];
  for (const [m, z] of nachPfad) if (m.test(p)) return z;
  const ersatz: ZeichenArt = art === "wissen" ? "wissen" : art === "staat" || art === "land" ? "miami" : "gesellschaft";
  return zeichenFuer(titel, ersatz);
}
