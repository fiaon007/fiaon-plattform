// ═══════════════════════════════════════════════════════════════════════════
// DEMO-ZUGANG DES PARTNERBEREICHS (/partner/demo?bereich=…, E-388, 16.10.2026)
//
// Justin: „auf der Seite einen Demo-Zugang, damit die Dienstleister sehen wie es aussehen könnte — auf max gehen, dass
// man viele Kunden, viel Zahlen sieht, richtig anspruchsvoll“. Derselbe Partnerbereich wie für echte Partner
// (client/src/pages/koop-partner.tsx), nur mit erfundenen Beispieldaten — klar gekennzeichnet, ohne Server, ohne Speichern.
// Namen, Nummern und Adressen sind ausgedacht (Telefon 0000-Bereich, E-Mail @beispiel.de).
// ═══════════════════════════════════════════════════════════════════════════
import { NETZ_PREISE, type NetzBereich } from "@shared/fiaon-partnernetz";

const VOR = ["Sarah", "Thomas", "Lena", "Jonas", "Miriam", "Daniel", "Aylin", "Marco", "Julia", "Kevin", "Nadine", "Patrick", "Svenja", "Mehmet", "Katrin", "Florian", "Ivana", "Tobias", "Melanie", "Sebastian", "Anja", "Lukas", "Elif", "Stefan", "Carina", "Dominik", "Jessica", "René", "Sandra", "Marcel"];
const NACH = ["Krüger", "Meier", "Becker", "Wolf", "Schulz", "Hoffmann", "Yilmaz", "Neumann", "Lange", "Schmitt", "Braun", "Zimmermann", "Hartmann", "Koch", "Richter", "Klein", "Petrović", "Schröder", "Weber", "Fuchs", "Keller", "Lorenz", "Demir", "Vogel", "Frank", "Berger", "Kaiser", "Engel", "Busch", "Seidel"];

const THEMEN: Record<NetzBereich, string[]> = {
  vorsorge: ["Altersvorsorge und Sparen (zum Beispiel Lebens- oder Rentenversicherung)", "Krankenzusatzversicherung", "Absicherung der Kinder", "Vermögensaufbau", "Absicherung von Einkommen und Familie"],
  recht: ["Inkasso und Forderungen", "Verbraucherrecht", "Mietrecht", "Arbeitsrecht", "Insolvenz und Schuldenbereinigung"],
  steuern: ["Steuererklärung 2025", "Steuererklärungen 2023–2025 nachholen", "Einspruch gegen Bescheid", "Belege ordnen und Erstattung prüfen"],
  energie: ["Stromwechsel · 2.400 kWh", "Stromwechsel · 3.100 kWh", "Gaswechsel · 12.000 kWh", "Stromwechsel · 1.800 kWh", "Gaswechsel · 9.500 kWh"],
  telekom: ["Mobilfunk · 20 GB mit Rufnummernmitnahme", "Internet 250 Mbit/s", "Mobilfunk · 10 GB", "Internet 100 Mbit/s + Festnetz", "Mobilfunk · 40 GB"],
};
const NOTIZEN: Record<NetzBereich, string[]> = {
  vorsorge: ["zwei Kinder, möchte für beide etwas ansparen", "selbstständig seit 2024, bisher keine Absicherung", "möchte Zähne und Brille absichern", "Termin lieber abends", "hat schon eine Riester-Rente, will prüfen lassen"],
  recht: ["Schreiben eines Inkassobüros vom 02.10., Frist 16.10.", "Kündigung erhalten, Klagefrist läuft", "Nebenkostenabrechnung mit Nachforderung", "Forderung aus 2019, Verjährung fraglich", ""],
  steuern: ["Belege liegen digital vor", "Kinderbetreuungskosten und Fahrtkosten", "zwei Arbeitgeber in 2025", "Bescheid vom 22.09. mit Nachzahlung", ""],
  energie: ["Abschlag bisher 142 € im Monat", "Grundversorgung seit 2023", "Umzug zum 01.12.", "Zählernummer liegt vor", ""],
  telekom: ["Rufnummer mitnehmen", "braucht Internet für Homeoffice", "kein Gerät gewünscht", "Prepaid bisher", ""],
};
const ARTEN = ["Telefon", "Video", "Telefon", "vor Ort", "Telefon"];
const GRUENDE = [
  { key: "daten_falsch", text: "Kontaktdaten falsch oder nicht erreichbar" },
  { key: "nicht_erschienen", text: "Nicht erschienen, binnen sieben Tagen kein Ersatztermin erreichbar" },
  { key: "keine_einwilligung", text: "Interessent bestreitet Einwilligung oder Gesprächswunsch" },
  { key: "dublette", text: "Schon einmal zum selben Thema übermittelt" },
  { key: "minderjaehrig_ausland", text: "Minderjährig oder wohnt nicht in Deutschland" },
];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const tag = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const zeit = (d: Date) => `${d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} um ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;

/** Bereichsabhängige Wörter im Partnerbereich (Demo und — für Vorsorge — echter Bereich identisch). */
export const DEMO_WORTE: Record<NetzBereich, { kontakteTitel: string; einheit: string; partner: string; gruss: string; modell: string }> = {
  vorsorge: { kontakteTitel: "Ihre Termine", einheit: "Kontakte", partner: "Finanz- und Vermögensberatung Muster", gruss: "Herr Muster", modell: "89 € netto je Kontakt" },
  recht: { kontakteTitel: "Ihre Erstberatungen", einheit: "Erstberatungen", partner: "Kanzlei Muster & Partner", gruss: "Frau Muster", modell: "Partnerplatz 690 € netto im Monat" },
  steuern: { kontakteTitel: "Ihre Erstgespräche", einheit: "Erstgespräche", partner: "Steuerkanzlei Muster", gruss: "Herr Muster", modell: "Partnerplatz 490 € netto im Monat" },
  energie: { kontakteTitel: "Ihre Wechselaufträge", einheit: "Wechsel", partner: "Stadtwerke Muster", gruss: "Frau Muster", modell: "129 € je Strom-, 159 € je Gaswechsel, netto" },
  telekom: { kontakteTitel: "Ihre Vertragsaufträge", einheit: "Verträge", partner: "Muster Mobilfunk", gruss: "Herr Muster", modell: "99 € je Mobilfunkvertrag, 149 € je Anschluss, netto" },
};

/** Ein deterministischer Zufall — dieselbe Demo bei jedem Aufruf. */
function zufall(seed: number) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

export function demoSicht(bereich: NetzBereich, jetzt = new Date()): any {
  const r = zufall(bereich.length * 7919 + 17);
  const preis = NETZ_PREISE[bereich];
  const platz = preis.modell === "platz";
  const je = (i: number) => (preis.zweitCents && i % 3 === 2 ? preis.zweitCents : preis.cents);
  const w = DEMO_WORTE[bereich];
  // Termine dieses Monats: 74 (Vorsorge), etwas weniger in anderen Bereichen.
  const anzahl = { vorsorge: 74, recht: 41, steuern: 36, energie: 63, telekom: 58 }[bereich];
  const monatStart = new Date(jetzt.getFullYear(), jetzt.getMonth(), 1, 0);
  const kontakte = Array.from({ length: anzahl }, (_, i) => {
    const vor = VOR[Math.floor(r() * VOR.length)]; const nach = NACH[Math.floor(r() * NACH.length)];
    const termin = new Date(monatStart.getTime() + Math.floor((i / anzahl) * 26 + 2) * 864e5 + (9 + Math.floor(r() * 8)) * 3600e3);
    if (termin.getDay() === 0) termin.setDate(termin.getDate() + 1);
    if (termin.getDay() === 6) termin.setDate(termin.getDate() + 2);
    const vorbei = termin < jetzt;
    const reklamiert = !platz && vorbei && i % 23 === 7;
    const abgelehnt = !platz && vorbei && i % 31 === 12;
    const t = THEMEN[bereich][Math.floor(r() * THEMEN[bereich].length)];
    const notiz = NOTIZEN[bereich][Math.floor(r() * NOTIZEN[bereich].length)] || null;
    const bis = new Date(termin.getTime() + 8 * 864e5);
    return {
      id: 1000 + i, name: `${vor} ${nach}`, telefon: `+49 30 0000 ${String(1000 + i).slice(-4)}`, email: `${vor.toLowerCase()}.${nach.toLowerCase().replace(/[^a-z]/g, "")}@beispiel.de`,
      thema: t, termin: termin.toISOString(), terminText: bereich === "energie" ? `Lieferbeginn ${tag(new Date(termin.getTime() + 30 * 864e5))}` : bereich === "telekom" ? `Aktivierung ${tag(termin)}` : zeit(termin),
      art: bereich === "energie" || bereich === "telekom" ? "Auftrag" : ARTEN[i % ARTEN.length], dauerMin: bereich === "energie" || bereich === "telekom" ? 0 : 60,
      notiz, uebermitteltAm: new Date(termin.getTime() - 3 * 864e5).toISOString(), ersatz: i % 37 === 20,
      status: reklamiert ? "reklamiert" : "uebermittelt",
      reklamation: reklamiert ? { grund: GRUENDE[i % 2].text, wahl: "ersatz", ergebnis: "berechtigt", begruendung: "Berechtigt — die Vergütung entfällt, und Sie bekommen einen Ersatzkontakt (außerhalb Ihrer Wunschmenge)." }
        : abgelehnt ? { grund: GRUENDE[3].text, wahl: "gutschrift", ergebnis: "abgelehnt", begruendung: "Abgelehnt — derselbe Interessent wurde in den letzten 6 Monaten zu diesem Thema nicht übermittelt." } : null,
      reklamierbarBis: !reklamiert && !abgelehnt && jetzt < bis && !platz ? bis.toISOString() : null,
      keinKontakt: vorbei && i % 29 === 3,
    };
  }).sort((a, b) => (a.termin < b.termin ? 1 : -1));
  // Verlauf der letzten sechs Monate (der laufende zuletzt).
  const reihe = { vorsorge: [38, 46, 52, 47, 61, 69], recht: [22, 27, 31, 29, 36, 41], steuern: [31, 18, 14, 22, 29, 36], energie: [29, 37, 44, 41, 55, 63], telekom: [26, 33, 38, 45, 51, 58] }[bereich];
  const verlauf = reihe.map((n, k) => {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - (5 - k), 1);
    const rekl = platz ? 0 : Math.max(1, Math.round(n * 0.04));
    const betrag = platz ? preis.cents : Array.from({ length: n - rekl }, (_, i) => je(i)).reduce((s, c) => s + c, 0);
    return { monat: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, monatText: `${MONATE[d.getMonth()]} ${d.getFullYear()}`, kontakte: k === 5 ? anzahl : n, reklamiert: rekl, betragCents: betrag, laufend: k === 5 };
  });
  const rechnungen = verlauf.slice(0, 5).reverse().map((v, i) => ({
    monat: v.monat, monatText: v.monatText, anzahl: v.kontakte, betrag: eur(v.betragCents), gutschrift: !platz && i % 2 === 0 ? eur(preis.cents) : null,
    nummer: `FIAON-INV-${v.monat.slice(0, 4)}-0${String(410 - i * 67).padStart(4, "0")}`, status: "bezahlt", faellig: null, zahlung: null, pdf: null,
  }));
  const woche = Math.min(18, anzahl);
  return {
    ok: true, demo: true, demoBereich: bereich, demoWorte: { ...w, platz, ohneZeiten: bereich === "energie" || bereich === "telekom" },
    ref: "FIAON-IA-KDEMO01", partner: w.partner, anrede: `Guten Tag ${w.gruss}`, gruss: w.gruss, email: "partner@beispiel.de",
    preis: w.modell, reklamationTage: 7,
    stand: {
      angebotId: 0, ref: "FIAON-IA-KDEMO01", partnerName: w.partner, aktiv: true, sperre: null, ruht: null, startRahmen: null,
      woche: { geliefert: woche, wunsch: 20, montag: "" }, monat: { monat: verlauf[5].monat, geliefert: anzahl }, ersatzOffen: platz ? 0 : 1,
      zeiten: { tage: [1, 2, 3, 4, 5], von: "09:00", bis: "18:00", dauerMin: 60, arten: ["telefon", "video", "vor_ort"] },
      themen: THEMEN[bereich], preisCents: preis.cents,
      zeitenText: "Mo, Di, Mi, Do, Fr · 09:00–18:00 Uhr · 60 Min. · Telefon, Video, vor Ort",
    },
    gruende: GRUENDE,
    kontakte, rechnungen, verlauf,
  };
}
