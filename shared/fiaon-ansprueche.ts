// ═══════════════════════════════════════════════════════════════════════════
// ANSPRUCHS-CHECK — die zehn Fragen, die Regeln, die Befunde (05.09.2026)
//
// Detailplan „Weg zum Rahmen", Station 3: Am Ende des Startgesprächs steht im
// Kundenbereich eine Liste mit Beträgen — was der Kunde beantragen kann, in
// welcher Höhe, und was der nächste Schritt ist. Jede Zeile mit Quelle und
// Stand-Datum.
//
// Diese Datei ist die EINE Quelle für Fragen, Regeln und Beträge. Client
// (Anspruchs-Check im Kundenbereich, Schritt 8 im Cockpit) und Server (Befunde
// speichern, Monatsbericht) rechnen mit denselben Funktionen. Die Beträge sind
// Daten mit Rechtsgrundlage, Quelle und Prüfdatum — Pfändungsfreigrenzen
// ändern sich jeden 1. Juli; wer sie fortschreibt, ändert NUR `REGELN`.
//
// SPRACHREGEL, bindend (Detailplan Station 3): „Das können Sie beantragen.
// Über den Betrag entscheidet die Stelle." Nie „Ihnen stehen zu", nie ein
// Punktbetrag ohne Spanne, kein Wort aus shared/fiaon-wortverbote.ts.
// FIAON stellt KEINE P-Konto-Bescheinigung aus — baubar ist der Antrag an die
// Bank plus der Weg zur ausstellenden Stelle.
// ═══════════════════════════════════════════════════════════════════════════

/** Die zehn Fragen — eine sichtbar zur Zeit, Schaltflächen unten. */
export type FrageSchluessel =
  | "p_konto" | "pfaendung" | "unterhalt" | "familienstand" | "netto_cents"
  | "warmmiete_cents" | "haushalt" | "sozialleistung" | "rundfunk_gezahlt" | "kfz_handy";

export type FrageArt = "ja_nein" | "zahl" | "betrag" | "wahl" | "mehrfach";

export interface Frage {
  schluessel: FrageSchluessel;
  art: FrageArt;
  /** Die Frage, so wie der Kunde sie liest (Sie-Form). */
  text: string;
  /** Ein Satz darunter: warum wir das fragen. */
  warum: string;
  /** Für `wahl`/`mehrfach`. */
  optionen?: { wert: string; text: string }[];
  /** Wird schon im Antrag erhoben (ANTRAG_FELDER) — nicht doppelt fragen, vorbelegen. */
  ausAntrag?: boolean;
}

export const FRAGEN: readonly Frage[] = [
  { schluessel: "p_konto", art: "ja_nein", text: "Ist Ihr Girokonto ein Pfändungsschutzkonto (P-Konto)?", warum: "Auf einem P-Konto ist ein fester Betrag im Monat vor Pfändungen geschützt." },
  { schluessel: "pfaendung", art: "ja_nein", text: "Läuft aktuell eine Pfändung auf Ihrem Konto oder Lohn?", warum: "Dann zählt jeder Tag – die Umwandlung in ein P-Konto muss die Bank binnen vier Geschäftstagen vornehmen." },
  { schluessel: "unterhalt", art: "zahl", text: "Für wie viele Personen zahlen Sie Unterhalt oder versorgen sie in Ihrem Haushalt (Kinder, Ehepartner)?", warum: "Je unterhaltsberechtigter Person steigt der geschützte Betrag auf dem P-Konto.", ausAntrag: true },
  { schluessel: "familienstand", art: "wahl", text: "Wie ist Ihr Familienstand?", warum: "Wirkt auf Freibeträge und auf einige Anträge.", ausAntrag: true, optionen: [
    { wert: "ledig", text: "Ledig" }, { wert: "verheiratet", text: "Verheiratet / Lebenspartnerschaft" }, { wert: "getrennt", text: "Getrennt lebend / geschieden" }, { wert: "verwitwet", text: "Verwitwet" },
  ] },
  { schluessel: "netto_cents", art: "betrag", text: "Wie hoch ist Ihr monatliches Nettoeinkommen (alle Einkünfte zusammen)?", warum: "Grundlage für Wohngeld und für den geschützten Betrag bei Lohnpfändung.", ausAntrag: true },
  { schluessel: "warmmiete_cents", art: "betrag", text: "Wie hoch ist Ihre Warmmiete im Monat?", warum: "Wohngeld richtet sich nach Miete, Einkommen und Haushaltsgröße.", ausAntrag: true },
  { schluessel: "haushalt", art: "zahl", text: "Wie viele Personen leben in Ihrem Haushalt – Sie eingerechnet?", warum: "Wohngeld und Rundfunkbeitrag werden je Wohnung bzw. Haushalt betrachtet.", ausAntrag: true },
  { schluessel: "sozialleistung", art: "ja_nein", text: "Beziehen Sie Bürgergeld, Grundsicherung, Hilfe zum Lebensunterhalt oder BAföG?", warum: "Wer eine dieser Leistungen bezieht, kann sich vom Rundfunkbeitrag befreien lassen – nur auf Antrag.", ausAntrag: true },
  { schluessel: "rundfunk_gezahlt", art: "ja_nein", text: "Zahlen Sie derzeit den Rundfunkbeitrag (18,36 € im Monat)?", warum: "Eine Befreiung wirkt bis zu drei Jahre rückwirkend – aber nur, wenn sie beantragt wird." },
  { schluessel: "kfz_handy", art: "mehrfach", text: "Welche Verträge laufen bei Ihnen?", warum: "Kfz-Versicherung und Handytarif lassen sich vergleichen; die Ersparnis bleibt jeden Monat bei Ihnen.", optionen: [
    { wert: "kfz", text: "Kfz-Versicherung" }, { wert: "handy", text: "Handyvertrag (kein Prepaid)" }, { wert: "keins", text: "Keins davon" },
  ] },
];

/** Antworten, wie sie in fiaon_anspruch_antworten (wert JSONB) liegen. */
export interface Antworten {
  p_konto?: boolean;
  pfaendung?: boolean;
  unterhalt?: number;
  familienstand?: string;
  netto_cents?: number;
  warmmiete_cents?: number;
  haushalt?: number;
  sozialleistung?: boolean;
  rundfunk_gezahlt?: boolean;
  kfz_handy?: string[];
}

export type Kategorie = "schutz" | "befreiung" | "vertrag" | "pruefung";
export type Rhythmus = "monatlich" | "einmalig" | "jaehrlich";

export interface Regel {
  schluessel: string;
  titel: string;
  kategorie: Kategorie;
  /** Betrag als Spanne in Cent; null = „Betrag ergibt sich aus Vergleich/Bescheid". */
  betragMinCents: number | null;
  betragMaxCents: number | null;
  rhythmus: Rhythmus;
  rechtsgrundlage: string;
  quelleUrl: string;
  /** Wann die Zahl zuletzt gegen die Quelle geprüft wurde (ISO-Datum). */
  geprueftAm: string;
  /** Ab wann die Zahl gilt; `giltBis` null = offen. */
  giltAb: string;
  giltBis: string | null;
  /** Wer entscheidet / wohin geht der Antrag. */
  stelle: string;
  /** Was FIAON tut — in der Plattform, bis zur Bestätigung. */
  wasWirTun: string;
  aktiv: boolean;
}

// ── Pfändungsfreigrenzen ab 01.07.2026 ───────────────────────────────────────
// Bekanntmachung zu den Pfändungsfreigrenzen 2026 nach § 850c ZPO
// (Pfändungsfreigrenzenbekanntmachung 2026), BGBl. verkündet 26.03.2026.
// Grundbetrag 1.587,40 € · erste unterhaltsberechtigte Person +597,42 € ·
// zweite bis fünfte Person je +332,83 €. Nächste Anpassung: 01.07.2027.
export const PFAENDUNG_2026 = {
  grundbetragCents: 158_740,
  erstePersonCents: 59_742,
  weiterePersonCents: 33_283,
  maxPersonen: 5,
  giltAb: "2026-07-01",
  quelleUrl: "https://www.bmjv.de/DE/themen/wirtschaft_finanzen/zwangsvollstreckung/pfaendungsfreigrenzen/pfaendungsfreigrenzen_node.html",
  geprueftAm: "2026-09-05",
} as const;

/** Erhöhungsbetrag auf dem P-Konto für n unterhaltsberechtigte Personen (§ 902 ZPO). */
export function pKontoErhoehungCents(personen: number): number {
  const n = Math.max(0, Math.min(PFAENDUNG_2026.maxPersonen, Math.floor(personen || 0)));
  if (n === 0) return 0;
  return PFAENDUNG_2026.erstePersonCents + (n - 1) * PFAENDUNG_2026.weiterePersonCents;
}

export const RUNDFUNK = {
  monatlichCents: 1_836,
  rueckwirkendMonate: 36,
  quelleUrl: "https://www.rundfunkbeitrag.de/buergerinnen_und_buerger/informationen/befreiung_oder_ermaessigung/",
  geprueftAm: "2026-09-05",
} as const;

export const REGELN: readonly Regel[] = [
  {
    schluessel: "p_konto_erhoehung",
    titel: "Höherer Schutzbetrag auf dem P-Konto",
    kategorie: "schutz",
    betragMinCents: PFAENDUNG_2026.erstePersonCents,
    betragMaxCents: pKontoErhoehungCents(PFAENDUNG_2026.maxPersonen),
    rhythmus: "monatlich",
    rechtsgrundlage: "§ 902 Satz 1 Nr. 1 ZPO i. V. m. § 850c ZPO; Pfändungsfreigrenzenbekanntmachung 2026",
    quelleUrl: PFAENDUNG_2026.quelleUrl,
    geprueftAm: PFAENDUNG_2026.geprueftAm,
    giltAb: PFAENDUNG_2026.giltAb,
    giltBis: null,
    stelle: "Ihre Bank – gegen Bescheinigung von Arbeitgeber, Familienkasse, Jobcenter/Sozialamt, Anwalt, Steuerberater oder einer anerkannten Schuldnerberatung",
    wasWirTun: "Wir bereiten den Antrag an Ihre Bank vor und zeigen Ihnen die Stelle, die Ihnen die Bescheinigung ausstellt. Die Bescheinigung selbst darf FIAON nicht ausstellen.",
    aktiv: true,
  },
  {
    schluessel: "p_konto_umwandlung",
    titel: "Girokonto in ein P-Konto umwandeln",
    kategorie: "schutz",
    betragMinCents: PFAENDUNG_2026.grundbetragCents,
    betragMaxCents: PFAENDUNG_2026.grundbetragCents,
    rhythmus: "monatlich",
    rechtsgrundlage: "§ 850k ZPO (Umwandlung binnen vier Geschäftstagen), § 899 ZPO (Grundfreibetrag)",
    quelleUrl: PFAENDUNG_2026.quelleUrl,
    geprueftAm: PFAENDUNG_2026.geprueftAm,
    giltAb: PFAENDUNG_2026.giltAb,
    giltBis: null,
    stelle: "Ihre Bank – sie muss die Umwandlung binnen vier Geschäftstagen vornehmen",
    wasWirTun: "Wir bereiten das Umwandlungsschreiben an Ihre Bank vor; Sie unterschreiben mit dem Finger.",
    aktiv: true,
  },
  {
    schluessel: "rundfunk_befreiung",
    titel: "Befreiung vom Rundfunkbeitrag",
    kategorie: "befreiung",
    betragMinCents: RUNDFUNK.monatlichCents,
    betragMaxCents: RUNDFUNK.monatlichCents,
    rhythmus: "monatlich",
    rechtsgrundlage: "§ 4 Abs. 1 Rundfunkbeitragsstaatsvertrag (Befreiung bei Bürgergeld, Grundsicherung, Hilfe zum Lebensunterhalt, BAföG u. a.); rückwirkend bis zu drei Jahre",
    quelleUrl: RUNDFUNK.quelleUrl,
    geprueftAm: RUNDFUNK.geprueftAm,
    giltAb: "2021-08-01",
    giltBis: null,
    stelle: "ARD ZDF Deutschlandradio Beitragsservice, 50656 Köln",
    wasWirTun: "Wir füllen den Befreiungsantrag mit Ihren Angaben vor; Sie fügen den Leistungsbescheid an und unterschreiben. Eine Befreiung gibt es nur auf Antrag, nie automatisch.",
    aktiv: true,
  },
  {
    schluessel: "wohngeld_pruefung",
    titel: "Wohngeld prüfen lassen",
    kategorie: "pruefung",
    betragMinCents: null,
    betragMaxCents: null,
    rhythmus: "monatlich",
    rechtsgrundlage: "Wohngeldgesetz (WoGG); Formulare und Zuständigkeit sind Ländersache",
    quelleUrl: "https://www.bmwsb.bund.de/Webs/BMWSB/DE/themen/stadt-wohnen/wohnraumfoerderung/wohngeld/wohngeld-node.html",
    geprueftAm: "2026-09-05",
    giltAb: "2023-01-01",
    giltBis: null,
    stelle: "Wohngeldstelle Ihrer Stadt oder Gemeinde",
    wasWirTun: "Wir bereiten das Anschreiben mit Ihren Angaben vor und nennen Ihnen Ihre Wohngeldstelle. Über den Betrag entscheidet die Stelle nach Miete, Einkommen und Haushaltsgröße.",
    aktiv: true,
  },
  {
    schluessel: "kfz_vergleich",
    titel: "Kfz-Versicherung vergleichen",
    kategorie: "vertrag",
    betragMinCents: null,
    betragMaxCents: null,
    rhythmus: "jaehrlich",
    rechtsgrundlage: "Kündigung zum 30.11. (Stichtag für die meisten Kfz-Verträge, § 11 VVG); Pflichtversicherung – kein Ausschluss wegen Bonität",
    quelleUrl: "https://www.gesetze-im-internet.de/vvg_2008/__11.html",
    geprueftAm: "2026-09-05",
    giltAb: "2026-01-01",
    giltBis: null,
    stelle: "Versicherer Ihrer Wahl über den Vergleich in Ihrem Bereich",
    wasWirTun: "Sie vergleichen in Ihrem Bereich; wir bereiten die Kündigung des alten Vertrags zum Stichtag vor. Die Ersparnis ergibt sich aus dem Vergleich – wir nennen keine Zahl, die nicht aus Ihrem Angebot stammt.",
    aktiv: true,
  },
  {
    schluessel: "handy_vergleich",
    titel: "Handytarif vergleichen",
    kategorie: "vertrag",
    betragMinCents: null,
    betragMaxCents: null,
    rhythmus: "monatlich",
    rechtsgrundlage: "§ 56 TKG (Kündigungsfrist nach Mindestlaufzeit ein Monat)",
    quelleUrl: "https://www.gesetze-im-internet.de/tkg_2021/__56.html",
    geprueftAm: "2026-09-05",
    giltAb: "2021-12-01",
    giltBis: null,
    stelle: "Anbieter Ihrer Wahl über den Vergleich in Ihrem Bereich",
    wasWirTun: "Wir zeigen Ihnen die Kündigungsfrist Ihres Vertrags und bereiten die Kündigung vor; der neue Tarif kommt aus dem Vergleich.",
    aktiv: true,
  },
];

export interface Befund {
  regel: Regel;
  /** Der Betrag, der sich aus den Antworten ergibt (Cent) — null, wenn ihn erst die Stelle nennt. */
  betragCents: number | null;
  rhythmus: Rhythmus;
  /** Ein Satz in Kundensprache, warum dieser Punkt auf der Liste steht. */
  begruendung: string;
  /** Was als Nächstes passiert. */
  naechsterSchritt: string;
}

const eur = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

/**
 * Antworten → Befunde. Reine Funktion, keine Nebenwirkungen — Client und Server
 * kommen auf dieselbe Liste. Wer eine Antwort nicht gegeben hat, bekommt den
 * Punkt nicht (kein Raten).
 */
export function befunde(a: Antworten): Befund[] {
  const liste: Befund[] = [];
  const regel = (s: string) => REGELN.find((r) => r.schluessel === s && r.aktiv);

  const unterhalt = Math.max(0, Math.floor(a.unterhalt ?? 0));
  if (a.p_konto === true && unterhalt > 0) {
    const r = regel("p_konto_erhoehung");
    if (r) {
      const betrag = pKontoErhoehungCents(unterhalt);
      liste.push({ regel: r, betragCents: betrag, rhythmus: "monatlich",
        begruendung: `Sie versorgen ${unterhalt === 1 ? "eine Person" : `${Math.min(unterhalt, 5)} Personen`}. Damit kann der geschützte Betrag auf Ihrem P-Konto um ${eur(betrag)} im Monat steigen.`,
        naechsterSchritt: "Antrag an Ihre Bank vorbereiten; Bescheinigung bei der zuständigen Stelle holen." });
    }
  }
  if (a.pfaendung === true && a.p_konto === false) {
    const r = regel("p_konto_umwandlung");
    if (r) liste.push({ regel: r, betragCents: PFAENDUNG_2026.grundbetragCents, rhythmus: "monatlich",
      begruendung: `Auf einem P-Konto sind ${eur(PFAENDUNG_2026.grundbetragCents)} im Monat vor der Pfändung geschützt${unterhalt > 0 ? ", mit Bescheinigung mehr" : ""}.`,
      naechsterSchritt: "Umwandlungsschreiben an Ihre Bank – die Bank muss binnen vier Geschäftstagen umstellen." });
  }
  if (a.sozialleistung === true && a.rundfunk_gezahlt === true) {
    const r = regel("rundfunk_befreiung");
    if (r) liste.push({ regel: r, betragCents: RUNDFUNK.monatlichCents, rhythmus: "monatlich",
      begruendung: `Mit Ihrem Leistungsbescheid können Sie sich vom Rundfunkbeitrag befreien lassen – ${eur(RUNDFUNK.monatlichCents)} im Monat, rückwirkend bis zu drei Jahre.`,
      naechsterSchritt: "Befreiungsantrag vorbereiten; Leistungsbescheid anfügen." });
  }
  if (a.sozialleistung === false && (a.warmmiete_cents ?? 0) > 0 && (a.netto_cents ?? 0) > 0 && (a.haushalt ?? 0) > 0) {
    const r = regel("wohngeld_pruefung");
    if (r) liste.push({ regel: r, betragCents: null, rhythmus: "monatlich",
      begruendung: "Miete, Einkommen und Haushaltsgröße liegen vor – ob und wie viel Wohngeld in Frage kommt, entscheidet Ihre Wohngeldstelle.",
      naechsterSchritt: "Anschreiben an die Wohngeldstelle vorbereiten." });
  }
  const vertraege = a.kfz_handy ?? [];
  if (vertraege.includes("kfz")) {
    const r = regel("kfz_vergleich");
    if (r) liste.push({ regel: r, betragCents: null, rhythmus: "jaehrlich",
      begruendung: "Kfz-Versicherungen lassen sich jedes Jahr zum 30.11. wechseln – unabhängig von Ihrer Bonität.",
      naechsterSchritt: "Vergleich öffnen; Kündigung zum Stichtag vorbereiten." });
  }
  if (vertraege.includes("handy")) {
    const r = regel("handy_vergleich");
    if (r) liste.push({ regel: r, betragCents: null, rhythmus: "monatlich",
      begruendung: "Nach der Mindestlaufzeit ist Ihr Handyvertrag mit einem Monat Frist kündbar.",
      naechsterSchritt: "Vergleich öffnen; Kündigungsfrist prüfen." });
  }
  return liste;
}

/** Summe der monatlichen Beträge, die sich aus den Antworten beziffern lassen (nur bezifferte Befunde). */
export function summeMonatlichCents(liste: Befund[]): number {
  return liste.reduce((s, b) => s + (b.rhythmus === "monatlich" && b.betragCents ? b.betragCents : 0), 0);
}

/** Wie viele der zehn Fragen beantwortet sind. */
export function beantwortet(a: Antworten): number {
  return FRAGEN.filter((f) => a[f.schluessel] !== undefined && a[f.schluessel] !== null).length;
}
