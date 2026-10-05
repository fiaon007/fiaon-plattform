// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG DES NEUEN ANTRAGS (/antrag-neu, 05.10.2026, E-282)
//
// EINE Quelle für den Vertragstext: Die Oberfläche zeigt ihn im Sheet
// „Vollständigen Vertrag lesen", der Server speichert genau denselben Text bei
// der Annahme (fiaon_vertragsannahmen.vertrag_html + sha256) und baut daraus
// das PDF für die Bestätigungsmail. Wer einen Satz ändert, erhöht
// ANTRAG_NEU_VERTRAG_FASSUNG (shared/fiaon-antrag-neu.ts).
//
// Bausteine, die woanders schon EINMAL stehen, werden nur gelesen:
//   Kündigung, Bank-Satz, Fußsatz  → client/src/components/antrag/bestelluebersicht-daten.ts
//   Widerrufsbelehrung + Formular → shared/fiaon-global-widerruf.ts (gesetzliches Muster, wörtlich)
//   Firma                          → shared/fiaon-firma.ts
//   Preise                         → shared/fiaon-pakete.ts
//   AGB-Fassung                    → shared/fiaon-vertrag-paket.ts
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { globalWiderrufsbelehrung } from "./fiaon-global-widerruf";
import { paketPreisCents } from "./fiaon-pakete";
import { AGB_FASSUNG } from "./fiaon-vertrag-paket";
import { agbDatumLang, antragNeuPaket, ANTRAG_NEU_VERTRAG_FASSUNG, LANDNAME, LIMIT_GESPRAECH, type Land } from "./fiaon-antrag-neu";
import { KUENDIGUNG_ZEILE, BANK_SATZ } from "../client/src/components/antrag/bestelluebersicht-daten";

export interface VertragDaten {
  ref: string;
  anrede: string;          // "Frau" | "Herr" | "" (ohne Anrede)
  vorname: string;
  nachname: string;
  geburt: string;          // „12. März 1968" oder ""
  strasse: string; nr: string; plz: string; ort: string; land: Land;
  email: string;
  paketKey: string;
  limit: number;
  /** Hat der Kunde ausdrücklich einen Beginn vor Ablauf der Widerrufsfrist verlangt? */
  sofortBeginn: boolean;
  /** Zeitpunkt der Annahme (nur im angenommenen Vertrag). */
  angenommenAm?: Date | null;
}

function esc(t: unknown): string {
  return String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c] as string));
}
export function euroCent(cents: number): string {
  const e = cents / 100; const ganz = Number.isInteger(e);
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: ganz ? 0 : 2, maximumFractionDigits: 2 })} €`;
}
function berlinZeit(d: Date): string {
  return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

const AUSKUNFTEIEN_SATZ: Record<Land, string> = {
  DE: "bei der SCHUFA Holding AG oder anderen Auskunfteien",
  AT: "beim KSV1870 oder anderen Auskunfteien",
  CH: "bei CRIF, Intrum oder anderen Auskunfteien",
};

/** Der Kunde in einer Zeile: „Frau Maria Müller, geboren am …, wohnhaft …". */
export function kundeZeile(d: VertragDaten): string {
  const name = [d.anrede === "Frau" || d.anrede === "Herr" ? d.anrede : "", d.vorname, d.nachname].filter(Boolean).join(" ").trim();
  return name
    + (d.geburt ? `, geboren am ${d.geburt}` : "")
    + (d.strasse ? `, wohnhaft ${d.strasse} ${d.nr}, ${d.plz} ${d.ort}, ${LANDNAME[d.land] ?? d.land}` : "")
    + (d.email ? `, E-Mail ${d.email}` : "");
}

/**
 * Der vollständige Vertrag als HTML (ohne <html>-Gerüst). Alle Werte sind
 * maskiert. Klassen: vt-* (Stil liefert die Seite bzw. das PDF).
 */
export function antragNeuVertragHtml(d: VertragDaten): string {
  const P = antragNeuPaket(d.paketKey);
  const rate = paketPreisCents(d.paketKey);
  const gesamt = rate * 12;
  const wb = globalWiderrufsbelehrung("de");
  const angenommen = d.angenommenAm ? berlinZeit(d.angenommenAm) : "";
  const kunde = kundeZeile(d) || "[Name des Kunden]";
  const name = [d.vorname, d.nachname].filter(Boolean).join(" ") || "[Name des Kunden]";
  const f = FIAON_FIRMA;
  const p = (t: string) => `<p>${t}</p>`;
  const h = (t: string) => `<h4>${esc(t)}</h4>`;
  const teile: string[] = [];
  teile.push(`<p class="vt-fassung">Vertragsfassung ${esc(ANTRAG_NEU_VERTRAG_FASSUNG)} · Vorgang ${esc(d.ref)} · AGB-Fassung ${esc(AGB_FASSUNG)}</p>`);
  teile.push(`<h3>Vertrag über die FIAON-Begleitung · Paket ${esc(P?.name ?? d.paketKey)}</h3>`);
  teile.push(h("§ 1 Vertragspartner"));
  teile.push(p(`(1) ${esc(f.name)}, ${esc(f.strasse)}, ${esc(f.ortZeile)}, Vereinigtes Königreich, eingetragen im ${esc(f.register)} unter der Company No. ${esc(f.companyNo)}, vertreten durch den Director ${esc(f.director)}, Telefon ${esc(f.telefon)}, E-Mail ${esc(f.email)} – nachfolgend „FIAON“.`));
  teile.push(p(`(2) ${esc(kunde)} – nachfolgend „Kunde“.`));
  teile.push(h("§ 2 Vertragsgegenstand"));
  teile.push(p("(1) FIAON stellt dem Kunden für die Laufzeit dieses Vertrages den Zugang zur FIAON-Plattform (Kundenbereich mit Auswertungen und persönlichem Fahrplan) bereit und erbringt die Leistungen des Pakets nach § 3."));
  teile.push(p(`(2) Ziel des Kunden ist die eigene Visa-Kreditkarte mit einem Start-Limit von ${esc(euroCent(d.limit * 100))}. Dieses Ziel ist die Angabe des Kunden; danach richten sich Plan und Begleitung.`));
  teile.push(p(`(3) FIAON ist kein Kreditinstitut und erbringt keine Rechts-, Steuer- oder Anlageberatung. ${esc(BANK_SATZ)} Ein bestimmtes Ergebnis – insbesondere eine bestimmte Karte, ein bestimmtes Limit oder eine Veränderung eines Scores bei Auskunfteien – ist nicht geschuldet.`));
  teile.push(p(`(4) FIAON führt keine Bonitätsanfragen ${esc(AUSKUNFTEIEN_SATZ[d.land] ?? AUSKUNFTEIEN_SATZ.DE)} durch. Das FIAON-Profil des Kunden entsteht aus seinen eigenen Angaben und Unterlagen.`));
  teile.push(p("(5) Für den Zugang zur Plattform gilt das gesetzliche Mängelhaftungsrecht."));
  teile.push(h(`§ 3 Leistungen des Pakets ${P?.name ?? d.paketKey}`));
  teile.push(`<ol>${(P?.leistungen ?? []).map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`);
  // E-283 (05.10.2026, Fassung PV-2026-10-05b): Wie und ab wann das Limit-Gespräch gebucht wird — nur bei
  // Paketen, die es enthalten (Pro, Ultra, High-End). Die Regel im Code: shared/fiaon-limit-gespraech.ts.
  if (P?.leistungen.includes(LIMIT_GESPRAECH)) {
    teile.push(p("Das erste Limit-Gespräch ist drei Monate nach Eingang der ersten Monatsrate im Kundenbereich buchbar, jedes weitere drei Monate nach dem letzten geführten. Nicht genutzte Gespräche werden nicht nachgeholt."));
  }
  teile.push(p(`Den Antragslink der Partnerbank schickt FIAON dem Kunden ${d.sofortBeginn ? "nach Eingang der ersten Monatsrate" : "nach Eingang der ersten Monatsrate und Ablauf der Widerrufsfrist (§ 6)"} per E-Mail; auf Wunsch schickt FIAON ihn erneut. Den Antrag bei der Bank stellt der Kunde selbst und im eigenen Namen. FIAON erhält von der Partnerbank für eine Kontoeröffnung eine Vergütung; für den Kunden entstehen dadurch keine Kosten.`));
  teile.push(h("§ 4 Mitwirkung des Kunden"));
  teile.push(p("Der Kunde macht vollständige und wahre Angaben und stellt die für die Leistungen benötigten Unterlagen bereit, insbesondere Ausweis, Kontoauszug und Bonitätsauskunft. Gegenüber Banken macht er nur wahre Angaben. Verzögert sich seine Mitwirkung, verschieben sich die davon abhängigen Leistungen entsprechend."));
  teile.push(h("§ 5 Vergütung und Zahlung"));
  teile.push(p(`(1) Die Vergütung für die Erstlaufzeit von zwölf Monaten beträgt insgesamt ${esc(euroCent(gesamt))}. Sie wird zinsfrei in zwölf gleich hohen Monatsraten zu je ${esc(euroCent(rate))} gezahlt. Die Ratenzahlung begründet kein monatliches Vertragsverhältnis.`));
  teile.push(p("(2) Die erste Rate ist mit Vertragsschluss fällig. Die weiteren Raten sind jeweils monatlich im Voraus fällig, und zwar am Kalendertag, an dem die erste Rate bei FIAON eingegangen ist; fehlt dieser Tag in einem Monat, am letzten Tag des Monats."));
  teile.push(p(`(3) Gezahlt wird per Überweisung auf das in der Rechnung und auf der Zahlungsseite genannte Konto der ${esc(f.name)}, Verwendungszweck ${esc(d.ref)}.`));
  teile.push(p("(4) Alle Preise sind Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer."));
  teile.push(p("(5) Bei Zahlungsverzug gelten Verzugszinsen in gesetzlicher Höhe (§ 288 BGB); eine Mahnpauschale wird gegenüber Verbrauchern nicht erhoben. Die weiteren Folgen regelt § 5 Absatz 5 und 6 der AGB."));
  teile.push(h("§ 6 Beginn der Leistungen"));
  teile.push(p(d.sofortBeginn
    ? "Der Kunde hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt. FIAON schaltet das Konto deshalb mit Eingang der ersten Monatsrate frei. Dem Kunden ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt."
    : "Der Kunde hat keinen früheren Beginn verlangt. FIAON beginnt mit den Leistungen nach § 3 deshalb erst nach Ablauf der Widerrufsfrist, frühestens mit Eingang der ersten Monatsrate. Den Zugang zum Kundenbereich erhält der Kunde schon mit Eingang der ersten Monatsrate; dafür schuldet er im Fall des Widerrufs keinen Wertersatz."));
  teile.push(h("§ 7 Laufzeit und Kündigung"));
  teile.push(p("(1) Der Vertrag wird mit einer festen Erstlaufzeit von zwölf Monaten geschlossen; sie beginnt mit dem Vertragsschluss."));
  teile.push(p(`(2) ${esc(KUENDIGUNG_ZEILE)}`));
  teile.push(p("(3) FIAON bestätigt den Zugang einer Kündigung und den Zeitpunkt der Vertragsbeendigung unverzüglich in Textform."));
  teile.push(p("(4) Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt."));
  teile.push(h("§ 8 Paketwechsel"));
  teile.push(p("Der Kunde kann jederzeit in ein höheres Paket wechseln. Der Wechsel wird mit der nächsten fälligen Rate wirksam; ab dann gilt die Rate des höheren Pakets für die verbleibenden Raten der Erstlaufzeit. Die Erstlaufzeit verlängert sich dadurch nicht."));
  teile.push(h("§ 9 Persönliche FIAON-PIN"));
  teile.push(p("Der Kunde legt eine vierstellige persönliche PIN fest. Mit ihr erkennt FIAON den Kunden am Telefon. FIAON speichert die PIN nur als geschützten Prüfwert, nie im Klartext; sie wird nirgends angezeigt, gemailt oder protokolliert. Der Kunde nennt sie nur am Telefon, wenn FIAON ihn erkennen soll. Der Kunde kann sie jederzeit in seinem Kundenbereich ändern und hält sie geheim. Die PIN ist keine PIN einer Bankkarte; diese vergibt allein die Bank."));
  teile.push(h("§ 10 Widerrufsrecht"));
  teile.push(p("Handelt der Kunde als Verbraucher (§ 13 BGB), kann er diesen Vertrag binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in Anlage 1 widerrufen; Anlage 2 enthält das Muster-Widerrufsformular."));
  teile.push(h("§ 11 Haftung"));
  teile.push(p("FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen Dritter – insbesondere von Banken, Kartenherausgebern und Auskunfteien – haftet FIAON nicht."));
  teile.push(h("§ 12 Datenschutz und Vertraulichkeit"));
  teile.push(p("FIAON verarbeitet personenbezogene Daten nach der Datenschutzerklärung unter fiaon.com/privacy und behandelt alle Angaben des Kunden vertraulich. Die Unterschrift wird nur als Bild gespeichert, ohne Schreibzeiten oder Druckdaten."));
  teile.push(h("§ 13 Vertragsschluss, Nachweis und Schlussbestimmungen"));
  teile.push(p("(1) Dieser Text ist das verbindliche Angebot von FIAON. Der Vertrag kommt zustande, wenn der Kunde nach seiner Unterschrift die Schaltfläche „Zahlungspflichtig annehmen“ anklickt."));
  teile.push(p("(2) FIAON speichert den Vertragstext, den Zeitpunkt der Annahme, die Unterschrift und eine Prüfsumme und sendet dem Kunden Vertrag, Bestellbestätigung und Widerrufsbelehrung unverzüglich per E-Mail. Der Kunde kann den Vertrag jederzeit im Kundenbereich abrufen."));
  teile.push(p(`(3) Ergänzend gelten die Allgemeinen Geschäftsbedingungen von FIAON in der Fassung vom ${esc(agbDatumLang(AGB_FASSUNG))} (abrufbar und speicherbar unter fiaon.com/agb). Widersprechen sie diesem Vertrag, geht dieser Vertrag vor. Vertragssprache ist Deutsch.`));
  teile.push(p("(4) Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; ist der Kunde Verbraucher, gilt diese Rechtswahl nur, soweit ihm dadurch nicht der Schutz der zwingenden Bestimmungen des Staates seines gewöhnlichen Aufenthalts entzogen wird. FIAON ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."));
  teile.push(`<div class="vt-kasten"><div><span class="vt-klein">Für FIAON</span><br>${esc(f.name)} – elektronisch ausgefertigt<br>${esc(f.director)}, Director</div><div><span class="vt-klein">Kunde</span><br>${angenommen ? `${esc(name)} – unterschrieben und angenommen am ${esc(angenommen)}` : "Ihre Unterschrift folgt im nächsten Schritt."}</div></div>`);
  teile.push(`<h3 id="vt-widerruf">Anlage 1 – Widerrufsbelehrung</h3>`);
  for (const a of wb.abschnitte) { teile.push(`<p><b>${esc(a.h)}</b></p>`); for (const t of a.absaetze) teile.push(p(esc(t))); }
  teile.push(`<h3 id="vt-formular">Anlage 2 – ${esc(wb.formular.titel)}</h3>`);
  teile.push(`<div class="vt-kasten">${p(esc(wb.formular.hinweis))}${p(esc(wb.formular.an))}${wb.formular.zeilen.map((z) => p(esc(z))).join("")}${p(esc(wb.formular.fuss))}</div>`);
  teile.push(`<h3 id="vt-agb">Anlage 3 – Allgemeine Geschäftsbedingungen</h3>`);
  teile.push(p(`Es gelten die Allgemeinen Geschäftsbedingungen der FIAON LTD in der Fassung vom ${esc(agbDatumLang(AGB_FASSUNG))}. Sie sind unter fiaon.com/agb abrufbar und speicherbar und liegen der Bestätigungsmail als Link bei.`));
  return teile.join("\n");
}
