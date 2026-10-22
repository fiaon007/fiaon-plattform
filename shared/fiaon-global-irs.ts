// ═══════════════════════════════════════════════════════════════════════════
// IRS FORM SS-4 UND 8821 — VORAUSGEFÜLLT AUS DER AKTE (22.10.2026)
//
// Justin: „Der Kunde füllt nichts aus — er unterschreibt nur.“ Die amtlichen,
// ausfüllbaren PDFs liegen unverändert unter server/assets/irs/ (README dort:
// Quelle, Revision, Abrufdatum; Werke der US-Regierung sind gemeinfrei). Hier
// steht REIN (ohne pdf-lib), welches Formularfeld woher seinen Wert bekommt — der
// Prüfstand (scripts/pruef-global-unterschrift.ts) rechnet es mit Musterdaten nach,
// der Server (server/lib/fiaon-global-irs.ts) füllt damit das PDF.
//
// Was IMMER leer bleibt: Unterschrift und Datum daneben (der Kunde schreibt beides
// von Hand — unser Registered-Agent-Partner verlangt Tinte für das SS-4) und die
// Felder „For IRS use only“. Fehlt eine Angabe, steht sie in `fehlend` — und das
// Formular geht NICHT zur Unterschrift (Stationen-Editor zeigt die Liste).
//
// Revisionen: SS-4 Rev. December 2025, 8821 Rev. January 2021 (Feldnamen unten
// gelten genau für diese Fassungen; eine neue Revision braucht eine neue Zuordnung).
// ═══════════════════════════════════════════════════════════════════════════
import type { FormularKontext, Fehlend } from "./fiaon-global-us-dokumente";
import { mitgliederVon, bundesstaatName, adresseZweizeilig } from "./fiaon-global-us-dokumente";
import { FIAON_FIRMA } from "./fiaon-firma";

export const IRS_FORMULARE = {
  irs_ss4: { datei: "fss4.pdf", revision: "Rev. December 2025", quelle: "https://www.irs.gov/pub/irs-pdf/fss4.pdf" },
  irs_8821: { datei: "f8821.pdf", revision: "Rev. January 2021", quelle: "https://www.irs.gov/pub/irs-pdf/f8821.pdf" },
} as const;

const P1 = "topmostSubform[0].Page1[0].";
/** Zeile 16 des SS-4: Haupttätigkeit → Feld des Kästchens. */
export const SS4_TAETIGKEITEN: { key: string; titel: string; feld: string }[] = [
  { key: "construction", titel: "Construction", feld: `${P1}c1_6[2]` },
  { key: "rental", titel: "Rental & leasing", feld: `${P1}c1_6[3]` },
  { key: "transportation", titel: "Transportation & warehousing", feld: `${P1}c1_6[4]` },
  { key: "health", titel: "Health care & social assistance", feld: `${P1}c1_6[0]` },
  { key: "accommodation", titel: "Accommodation & food service", feld: `${P1}c1_6[5]` },
  { key: "wholesale_agent", titel: "Wholesale — agent/broker", feld: `${P1}c1_6[1]` },
  { key: "wholesale_other", titel: "Wholesale — other", feld: `${P1}c1_6[6]` },
  { key: "retail", titel: "Retail", feld: `${P1}c1_6[7]` },
  { key: "real_estate", titel: "Real estate", feld: `${P1}c1_6[8]` },
  { key: "manufacturing", titel: "Manufacturing", feld: `${P1}c1_6[9]` },
  { key: "finance", titel: "Finance & insurance", feld: `${P1}c1_6[10]` },
  { key: "other", titel: "Other (specify)", feld: `${P1}c1_6[11]` },
];

/** Ein gefülltes Feld mit Herkunft — für die Vorschau im Stationen-Editor („was steht wo, woher“). */
export interface IrsFeld { zeile: string; feld: string; wert: string | boolean; quelle: string }
export interface IrsBelegung { felder: IrsFeld[]; fehlend: Fehlend[]; hinweise: string[] }

const knapp = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const datumUs = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");

/** Third Party Designee / Appointee: FIAON (FIAON_FIRMA) — im Mandat überschreibbar, Fax aus der Umgebung (FIAON_GLOBAL_FAX). */
export function fiaonDesignee(fax?: string | null): { name: string; adresse: string; telefon: string; fax: string } {
  return { name: `${FIAON_FIRMA.name} (${FIAON_FIRMA.director}, Director)`, adresse: `${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`, telefon: FIAON_FIRMA.telefon, fax: knapp(fax) };
}

/** IRS Form SS-4 — welche Felder woher. `umgebung.fax` = FIAON_GLOBAL_FAX. */
export function ss4Belegung(k: FormularKontext, umgebung: { fax?: string | null } = {}): IrsBelegung {
  const felder: IrsFeld[] = []; const fehlend: Fehlend[] = []; const hinweise: string[] = [];
  const setz = (zeile: string, feld: string, wert: string | boolean, quelle: string, fehltText?: string) => {
    if (typeof wert === "string" && !wert.trim()) { if (fehltText) fehlend.push({ feld: `ss4.${zeile}`, text: `SS-4 Zeile ${zeile}: ${fehltText}` }); return; }
    felder.push({ zeile, feld: `${P1}${feld}`, wert, quelle });
  };
  const m = mitgliederVon(k);
  const s4 = k.angaben.ss4 ?? {};
  const einzig = m.length === 1;
  // 1 Legal name, 2 Trade name (nur wenn abweichend — bleibt leer), 3 care-of (leer)
  setz("1", "f1_2[0]", knapp(k.llc.name).toUpperCase(), "Gesellschaft › Name", "Name der Gesellschaft fehlt");
  // 4a/4b Postanschrift = US-Geschäftsanschrift (sonst Anschrift des Registered Agent); 5a/5b nur, wenn abweichend (leer).
  const post = adresseZweizeilig(knapp(k.llc.usAdresse) ? k.llc.usAdresse : k.llc.agentAdresse);
  setz("4a", "Line4ReadOrder[0].f1_5[0]", post?.[0] ?? "", knapp(k.llc.usAdresse) ? "Station US-Adresse › US-Geschäftsadresse (Zeile 1)" : "Station Registered Agent › Anschrift (Zeile 1)", "US-Postanschrift (zweizeilig: Straße / Ort, Staat ZIP)");
  setz("4b", "Line4ReadOrder[0].f1_6[0]", post?.[1] ?? "", knapp(k.llc.usAdresse) ? "Station US-Adresse › US-Geschäftsadresse (Zeile 2)" : "Station Registered Agent › Anschrift (Zeile 2)", "Ort, Staat und ZIP der US-Postanschrift");
  // 6 County und Staat
  const staat = bundesstaatName(k.llc.bundesstaat);
  const county = knapp(k.angaben.county);
  setz("6", "f1_9[0]", county && staat ? `${county}, ${staat}` : "", "Dokumente & Unterschriften › County + Gesellschaft › Bundesstaat", "County der Geschäftsanschrift (z. B. „Laramie County“)");
  // 7a/7b Verantwortliche Person = erstes Mitglied; ITIN, sonst „Foreign“ (ausländische Person ohne SSN/ITIN).
  setz("7a", "f1_10[0]", m[0]?.name ?? "", "Mitglied 1 (Auftrag › Ansprechpartner bzw. Mitgliederliste)", "Name der verantwortlichen Person (Mitglied)");
  const itin = knapp(k.itin);
  setz("7b", "f1_11[0]", itin || "Foreign", itin ? "Station ITIN (verschlüsselt, nur hier entschlüsselt)" : "keine SSN/ITIN → „Foreign“");
  if (!itin) hinweise.push("Zeile 7b: „Foreign“ — die verantwortliche Person hat keine SSN/ITIN (Fax-Antrag über den Registered-Agent-Partner). Rechtlich prüfen lassen.");
  // 8a LLC ja, 8b Zahl der Mitglieder, 8c in den USA gegründet ja
  setz("8a", "c1_1[0]", true, "fest: LLC");
  setz("8b", "f1_12[0]", String(m.length), "Mitgliederliste");
  setz("8c", "c1_2[0]", true, "fest: in den USA gegründet");
  // 9a Rechtsform: eine Person → „Other: Foreign-owned disregarded entity“; mehrere → Partnership
  if (einzig) {
    setz("9a", "c1_3[15]", true, "ein Mitglied → Other");
    setz("9a", "f1_19[0]", "Foreign-owned disregarded entity", "fest (Anleitung zu Zeile 9a für ausländisch gehaltene Ein-Personen-LLC)");
  } else {
    setz("9a", "c1_3[2]", true, "mehrere Mitglieder → Partnership");
  }
  // 10 Grund: Started new business + Art
  setz("10", "c1_4[0]", true, "fest: Started new business");
  const art = knapp(s4.geschaeftsart);
  // Kurz (bis zwölf Zeichen) passt es in das Feld hinter dem Kästchen, sonst in die breite Zeile darunter — nie mitten im Wort getrennt.
  setz("10", art.length <= 12 ? "f1_25[0]" : "f1_26[0]", art, "Dokumente & Unterschriften › Art des Geschäfts", "Art des Geschäfts (Zeile 10, englisch)");
  // 11 Beginn = Gründungstag, 12 Geschäftsjahr endet Dezember
  setz("11", "f1_31[0]", datumUs(k.llc.gegruendetAm), "Gesellschaft › Gründungstag", "Gründungstag der Gesellschaft");
  setz("12", "f1_32[0]", "December", "fest: Kalenderjahr");
  // 13 Beschäftigte: keine erwartet (−0−); 14 leer; 15 N/A
  setz("13", "f1_33[0]", "0", "fest: keine Beschäftigten erwartet"); setz("13", "f1_34[0]", "0", "fest"); setz("13", "f1_35[0]", "0", "fest");
  setz("15", "f1_36[0]", "N/A", "fest: keine Löhne");
  // 16 Haupttätigkeit, 17 Waren/Leistungen
  const t = SS4_TAETIGKEITEN.find((x) => x.key === knapp(s4.taetigkeit));
  if (!t) fehlend.push({ feld: "ss4.16", text: "SS-4 Zeile 16: Haupttätigkeit wählen" });
  else {
    felder.push({ zeile: "16", feld: t.feld, wert: true, quelle: "Dokumente & Unterschriften › Haupttätigkeit" });
    if (t.key === "other") setz("16", "f1_37[0]", knapp(s4.taetigkeitText), "Haupttätigkeit › Other (specify)", "„Other (specify)“ ausfüllen");
  }
  setz("17", "f1_38[0]", knapp(s4.leistungen), "Dokumente & Unterschriften › Waren oder Leistungen", "Waren oder Leistungen (Zeile 17, englisch)");
  // 18 früher EIN beantragt: Nein
  setz("18", "c1_7[1]", true, "fest: nein (neue Gesellschaft)");
  // Third Party Designee = FIAON
  const d = fiaonDesignee(umgebung.fax);
  setz("Designee", "f1_40[0]", knapp(s4.designeeName) || d.name, "FIAON (FIAON_FIRMA) bzw. Mandat", "Name des Third Party Designee");
  setz("Designee", "f1_41[0]", knapp(s4.designeeTelefon) || d.telefon, "FIAON_FIRMA.telefon", "Telefon des Designee");
  setz("Designee", "f1_42[0]", knapp(s4.designeeAdresse) || d.adresse, "FIAON_FIRMA (Anschrift)", "Anschrift des Designee");
  const fax = knapp(s4.designeeFax) || d.fax;
  if (fax) setz("Designee", "f1_43[0]", fax, "FIAON_GLOBAL_FAX bzw. Mandat");
  else hinweise.push("Designee-Fax leer: Die IRS antwortet dann per Post an die Anschrift in Zeile 4. Faxnummer über FIAON_GLOBAL_FAX setzen, wenn die EIN per Fax zurückkommen soll.");
  // Name und Funktion, Telefon des Antragstellers. Unterschrift und Datum: von Hand.
  setz("Name/Titel", "f1_44[0]", m[0]?.name ? `${m[0].name}, ${einzig ? "Sole Member" : "Member"}` : "", "Mitglied 1", "Name des Unterzeichners");
  setz("Telefon", "f1_45[0]", knapp(m[0]?.telefon) || knapp(k.kundeTelefon), "Mitglied 1 › Telefon (sonst Auftrag)", "Telefon des Antragstellers (international, z. B. +49 …)");
  return { felder, fehlend, hinweise };
}

/** IRS Form 8821 — Steuerauskunft. Steuerpflichtige ist die Gesellschaft (EIN), Empfänger FIAON (oder Partner-CPA). */
export function f8821Belegung(k: FormularKontext): IrsBelegung {
  const felder: IrsFeld[] = []; const fehlend: Fehlend[] = []; const hinweise: string[] = [];
  const setz = (zeile: string, feld: string, wert: string | boolean, quelle: string, fehltText?: string) => {
    if (typeof wert === "string" && !wert.trim()) { if (fehltText) fehlend.push({ feld: `f8821.${zeile}`, text: `8821 Zeile ${zeile}: ${fehltText}` }); return; }
    felder.push({ zeile, feld: `${P1}${feld}`, wert, quelle });
  };
  const m = mitgliederVon(k);
  const a = k.angaben.irs8821 ?? {};
  const einzig = m.length === 1;
  const adresse = String(knapp(k.llc.usAdresse) ? k.llc.usAdresse : k.llc.agentAdresse).split(/\r?\n/).map(knapp).filter(Boolean);
  setz("1", "f1_6[0]", knapp(k.llc.name) && adresse.length ? [knapp(k.llc.name).toUpperCase(), ...adresse].join("\n") : "", "Gesellschaft › Name + US-Geschäftsadresse", "Name und Anschrift der Gesellschaft");
  setz("1", "f1_7[0]", knapp(k.llc.ein), "Station EIN", "EIN der Gesellschaft (das 8821 kommt nach der EIN)");
  setz("1", "f1_8[0]", knapp(k.llc.usTelefon) || knapp(m[0]?.telefon) || knapp(k.kundeTelefon), "Station US-Telefon (sonst Mitglied 1)", "Telefon der Gesellschaft");
  // 2 Designee: FIAON (Vorgabe) oder Partner-CPA aus dem Mandat
  const d = fiaonDesignee(a.fax);
  const name = knapp(a.name) || d.name;
  const anschrift = knapp(a.adresse) || d.adresse;
  setz("2", "f1_10[0]", `${name}\n${anschrift}`, a.name ? "Dokumente & Unterschriften › 8821-Empfänger" : "FIAON (FIAON_FIRMA)", "Empfänger (Name und Anschrift)");
  setz("2", "f1_11[0]", knapp(a.caf) || "None", a.caf ? "Mandat › CAF" : "keine CAF-Nummer → „None“ (die IRS vergibt sie)");
  if (knapp(a.ptin)) setz("2", "f1_12[0]", knapp(a.ptin), "Mandat › PTIN");
  setz("2", "f1_13[0]", knapp(a.telefon) || d.telefon, "Telefon des Empfängers", "Telefon des Empfängers");
  if (knapp(a.fax) || d.fax) setz("2", "f1_14[0]", knapp(a.fax) || d.fax, "Fax des Empfängers");
  // 3 Steuerauskunft: Art, Formular, Jahre, besondere Sachverhalte
  const jahr = Number(String(k.llc.gegruendetAm ?? "").slice(0, 4)) || null;
  setz("3", "Table_Line3[0].BodyRow1[0].f1_20[0]", knapp(a.steuerart) || "Income", "Vorgabe „Income“");
  setz("3", "Table_Line3[0].BodyRow1[0].f1_21[0]", knapp(a.formular) || (einzig ? "1120, 5472" : "1065"), einzig ? "Vorgabe: pro-forma 1120 mit 5472" : "Vorgabe: 1065");
  setz("3", "Table_Line3[0].BodyRow1[0].f1_22[0]", knapp(a.jahre) || (jahr ? `${jahr} through ${jahr + 2}` : ""), "Gründungsjahr bis zwei Jahre danach", "Jahre (Gründungstag fehlt)");
  if (knapp(a.sachverhalt)) setz("3", "Table_Line3[0].BodyRow1[0].f1_23[0]", knapp(a.sachverhalt), "Mandat › besondere Sachverhalte");
  // 6 Print name / Title — Unterschrift und Datum von Hand
  setz("6", "f1_32[0]", m[0]?.name ?? "", "Mitglied 1", "Name des Unterzeichners");
  setz("6", "f1_33[0]", einzig ? "Sole Member" : "Member", "Rolle");
  if (!knapp(a.caf)) hinweise.push("CAF: „None“ — FIAON hat keine CAF-Nummer; die IRS vergibt sie mit der ersten Vollmacht. Mit Partner-CPA dessen CAF eintragen.");
  return { felder, fehlend, hinweise };
}

export function irsBelegung(art: "irs_ss4" | "irs_8821", k: FormularKontext, umgebung: { fax?: string | null } = {}): IrsBelegung {
  return art === "irs_ss4" ? ss4Belegung(k, umgebung) : f8821Belegung(k);
}
