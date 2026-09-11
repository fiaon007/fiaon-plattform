// ═══════════════════════════════════════════════════════════════════════════
// DIE KATEGORIEN EINES KONTOAUSZUGS — eine Liste, beide Seiten (11.09.2026, E-178)
//
// Der Server (fiaon-kontoauszug-analyse.ts) lässt das Modell jede Buchung in
// GENAU eine dieser Kategorien legen und rechnet daraus Fixkosten, Gruppen und
// Warnungen. Der Kundenbereich und das Betreuerportal zeigen die Buchungen an
// und brauchen dieselben Wörter. Stünde die Liste zweimal da, hieße dieselbe
// Zahlung beim Kunden anders als in der Akte.
//
//   seite    ein = Gutschrift, aus = Belastung
//   gruppe   die Überschrift in „Wohin Ihr Geld geht"
//   fix      wiederkehrende Ausgabe — gehört in den Kalender, auch wenn sie im
//            Auszug nur einmal steht
//   warnung  zählt für die Bonität (Inkasso, Rücklastschrift, Glücksspiel, Kredit)
// ═══════════════════════════════════════════════════════════════════════════
export interface Kategorie { label: string; seite: "ein" | "aus"; gruppe: string; fix?: boolean; warnung?: string }

export const KATEGORIEN: Record<string, Kategorie> = {
  gehalt:            { label: "Gehalt / Lohn",          seite: "ein", gruppe: "Einkommen" },
  rente:             { label: "Rente / Pension",        seite: "ein", gruppe: "Einkommen" },
  sozialleistung:    { label: "Sozialleistung",         seite: "ein", gruppe: "Einkommen" },
  erstattung:        { label: "Erstattung",             seite: "ein", gruppe: "Sonstige Einnahmen" },
  ueberweisung_ein:  { label: "Überweisung erhalten",   seite: "ein", gruppe: "Sonstige Einnahmen" },
  sonstige_einnahme: { label: "Sonstige Einnahme",      seite: "ein", gruppe: "Sonstige Einnahmen" },
  miete:             { label: "Miete / Wohnen",         seite: "aus", gruppe: "Wohnen", fix: true },
  energie:           { label: "Strom / Gas / Wasser",   seite: "aus", gruppe: "Energie", fix: true },
  versicherung:      { label: "Versicherung",           seite: "aus", gruppe: "Versicherung", fix: true },
  telefon_internet:  { label: "Telefon / Internet",     seite: "aus", gruppe: "Telefon & Internet", fix: true },
  abo_medien:        { label: "Abo / Medien",           seite: "aus", gruppe: "Abos & Medien", fix: true },
  kredit_rate:       { label: "Kredit / Rate",          seite: "aus", gruppe: "Kredite & Raten", fix: true, warnung: "kredit" },
  inkasso_mahnung:   { label: "Inkasso / Mahnung",      seite: "aus", gruppe: "Inkasso & Mahnungen", warnung: "inkasso" },
  ruecklastschrift:  { label: "Rücklastschrift",        seite: "aus", gruppe: "Rücklastschriften", warnung: "ruecklastschrift" },
  gebuehren:         { label: "Bankgebühren / Zinsen",  seite: "aus", gruppe: "Gebühren" },
  gluecksspiel:      { label: "Glücksspiel / Wetten",   seite: "aus", gruppe: "Glücksspiel", warnung: "gluecksspiel" },
  lebensmittel:      { label: "Lebensmittel",           seite: "aus", gruppe: "Lebensmittel" },
  mobilitaet:        { label: "Mobilität",              seite: "aus", gruppe: "Mobilität" },
  gesundheit:        { label: "Gesundheit",             seite: "aus", gruppe: "Gesundheit" },
  freizeit:          { label: "Freizeit / Einkauf",     seite: "aus", gruppe: "Freizeit & Einkauf" },
  bargeld:           { label: "Bargeld",                seite: "aus", gruppe: "Bargeld" },
  ueberweisung_aus:  { label: "Überweisung",            seite: "aus", gruppe: "Überweisungen" },
  sonstige_ausgabe:  { label: "Sonstige Ausgabe",       seite: "aus", gruppe: "Sonstiges" },
};

export const KATEGORIE_SCHLUESSEL = Object.keys(KATEGORIEN);

export function kategorieLabel(key: string | null | undefined): string {
  return (key && KATEGORIEN[key]?.label) || "Buchung";
}

/** Zählt diese Buchung als feste Zahlung? Kategorie ODER die Erkennung des Modells. */
export function istFest(kategorie: string | null | undefined, wiederkehrend: boolean | null | undefined): boolean {
  return !!(kategorie && KATEGORIEN[kategorie]?.fix) || wiederkehrend === true;
}
