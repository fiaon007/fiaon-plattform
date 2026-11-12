// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND — Chefbüro › Global-Lage (E-508, 12.11.2026)
//
// Teil 1 (immer, ohne Datenbank): die Rechenregeln aus shared/fiaon-chef-global-lage.ts — was ein Angebot wert ist,
//   wer am Zug ist, Auftragswert, Fixkosten, Gültigkeit, Notiz, „Wir warten auf“, Feed. Mit Rotproben: Jede Probe
//   rechnet mit einer absichtlich falschen Annahme und muss scheitern.
// Teil 2 (--lokal): gegen eine LOKALE Prüf-Datenbank mit kopierten Daten — die ganze Antwort, Gegenrechnung der
//   Summen mit eigener SQL, die Umsatzzahl gegen umsatzBausteine(), und die vier Schreibwege mit Zurückstellen.
//   Der Prüfstand weigert sich, wenn DATABASE_URL nicht auf 127.0.0.1 oder localhost zeigt.
//
// Aufruf:
//   env -i PATH HOME TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-chef-global-lage.ts
//   … DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<kopie> … scripts/pruef-chef-global-lage.ts --lokal
// ═══════════════════════════════════════════════════════════════════════════
import {
  tagPlus, tageZwischen, wocheMontag, wochenTage, wocheWaehlen, tagName, tagKurz, wocheName, kurzText,
  lageAngebotAus, angebotWert, angebotPhase, angebotSchritt, akteSchritt, mandantenBauen, auftragswertRechnen,
  fixkostenRechnen, fixkostenPruefen, gueltigkeitPruefen, notizPruefen, wartetBauen, feedOrdnen,
  LAGE_FIXKOSTEN_VORGABE_CENTS, LAGE_PARTNER_ZEILEN,
  type LageAngebot, type LageAkte, type FeedEintrag, type LagePartnerAufgabe, type LageWiedervorlage,
} from "../shared/fiaon-chef-global-lage";

let gut = 0; let schlecht = 0;
const ok = (name: string, bedingung: unknown, zusatz = "") => {
  if (bedingung) { gut++; return; }
  schlecht++; console.error(`  ✗ ${name}${zusatz ? ` — ${zusatz}` : ""}`);
};
const gleich = (name: string, ist: unknown, soll: unknown) => ok(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
/** Rotprobe: die falsche Annahme MUSS auffallen — `stimmt` ist das Ergebnis des Vergleichs mit dem falschen Sollwert. */
const rot = (name: string, stimmt: boolean) => ok(`Rotprobe: ${name}`, !stimmt, "die falsche Annahme wurde nicht erkannt");

const HEUTE = "2026-11-12"; // Donnerstag

// ── Bausteine für Prüffälle (erfundene Namen und Beträge) ────────────────────
const kapitalC = (ein: Partial<Record<string, any>> = {}): Record<string, any> => ({
  art: "kapital", variante: "privat", id: 101, ref: "FIAON-IA-CPRUEF01", status: "offen", kundeName: "Prüf Person (privat)",
  gesamtCents: 329_800, gueltigBis: "2026-11-19", erstelltAm: "2026-11-10T09:00:00.000Z", angenommenAm: null, link: "https://example.invalid/angebot", auftragRef: null,
  parameter: { gruendungCents: 279_900, fastTrackCents: 49_900, fastTrackWahl: true, erfolgCents: 420_000 },
  gebuehren: { buergschaftCents: 420_000, auszahlungCents: 0, vereinbart: true },
  knopfTexte: { buergschaft: { knopf: "Gesellschaft eingetragen" } },
  kapital: { zeile: "LLC in Delaware" }, teile: [{ nr: 1, betragCents: 329_800, zahlungsstatus: null, bestellRef: null }],
  aufrufe: null, ...ein,
});
const mitAufrufen = (zuletzt: string, n = 2) => ({ kundeAufrufe: n, besuche: n, kundeErster: { am: `${zuletzt}T08:00:00.000Z` }, kundeZuletzt: { am: `${zuletzt}T10:00:00.000Z` } });
const akte = (ein: Partial<LageAkte> = {}): LageAkte => ({
  ref: "FIAON-PRUEF-AKTE1", kunde: "Prüf Kunde", firma: null, llc: null, paket: "global_individuell", angelegtAm: "2026-11-01T10:00:00.000Z", test: false,
  status: "gestartet", anfragenNeu: 0, uploadsNeu: 0, unterschriftenOffen: 0, naechsteFrist: null, naechsterSchritt: null,
  fortschritt: { erledigt: 3, gesamt: 13 }, zustaendig: "Prüf Leitung", naechsteStation: { titel: "EIN der Gesellschaft", status: "in_arbeit" }, ...ein,
});
const A = (roh: Record<string, any>): LageAngebot => lageAngebotAus(roh)!;

// ═══════════════════════════════════════════════════════════════════════════
console.log("Teil 1 — Regeln ohne Datenbank");

// Tage
gleich("tagPlus über den Monat", tagPlus("2026-11-28", 5), "2026-12-03");
gleich("tageZwischen vorwärts", tageZwischen("2026-11-12", "2026-11-19"), 7);
gleich("tageZwischen rückwärts", tageZwischen("2026-11-12", "2026-11-06"), -6);
gleich("Montag der Woche (Donnerstag)", wocheMontag(HEUTE), "2026-11-09");
gleich("Montag der Woche (Sonntag)", wocheMontag("2026-11-15"), "2026-11-09");
gleich("Montag bleibt Montag", wocheMontag("2026-11-09"), "2026-11-09");
gleich("Wochentage bis heute, neueste zuerst", wochenTage("2026-11-09", HEUTE), ["2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09"]);
gleich("Vergangene Woche hat sieben Tage", wochenTage("2026-11-02", HEUTE).length, 7);
gleich("Woche wählen: Unsinn → diese Woche", wocheWaehlen("abc", HEUTE), "2026-11-09");
gleich("Woche wählen: Zukunft → diese Woche", wocheWaehlen("2026-12-01", HEUTE), "2026-11-09");
gleich("Woche wählen: Tag der Vorwoche → deren Montag", wocheWaehlen("2026-11-05", HEUTE), "2026-11-02");
gleich("Tagname heute", tagName(HEUTE, HEUTE), "Heute");
gleich("Tagname gestern", tagName("2026-11-11", HEUTE), "Gestern");
gleich("Tagname davor", tagName("2026-11-09", HEUTE), "Montag, 9. November");
gleich("Kurzdatum", tagKurz("2026-11-06"), "06.11.");
gleich("Wochenname", wocheName("2026-11-09"), "9.–15. November 2026");
gleich("Wochenname über den Monat", wocheName("2026-11-30"), "30. November–6. Dezember 2026");
gleich("kurzText kürzt und glättet", kurzText("a\n\n b   c", 20), "a b c");
ok("kurzText setzt Auslassung", kurzText("x".repeat(50), 20).endsWith("…") && kurzText("x".repeat(50), 20).length === 20);

// Was ein Angebot wert ist
const offen = A(kapitalC());
gleich("Kooperation ist kein Mandant", lageAngebotAus({ art: "koop", id: 9, ref: "X" }), null);
gleich("Fast-Track zur Wahl zählt nicht mit", offen.gesamtCents, 279_900);
gleich("Fast-Track steht daneben", offen.fastTrackWahlCents, 49_900);
gleich("Name des Rechnungs-Knopfs", offen.meilensteinKnopf, "Gesellschaft eingetragen");
gleich("Wert offen", angebotWert(offen), { startCents: 279_900, erfolgCents: 420_000, erfolgNachErgebnis: false, startBezahlt: false, startOffenCents: 279_900, erfolgStand: "offen" });
rot("Fast-Track mitgezählt", angebotWert(offen).startCents === 329_800);
const ohneWahl = A(kapitalC({ parameter: { gruendungCents: 209_900, fastTrackWahl: false, erfolgCents: 420_000, bestand: { name: "Prüf LLC" } }, gesamtCents: 209_900 }));
gleich("Ohne Fast-Track-Wahl gilt der Listenbetrag", [ohneWahl.gesamtCents, ohneWahl.fastTrackWahlCents, ohneWahl.bestand], [209_900, 0, true]);
const angenommen = A(kapitalC({ status: "angenommen", angenommenAm: "2026-11-11T10:00:00.000Z", gesamtCents: 329_800, teile: [{ nr: 1, betragCents: 329_800, zahlungsstatus: "pending", bestellRef: "FIAON-PRUEF-B1", zahlbarBis: "2026-11-11" }] }));
gleich("Nach der Annahme gilt die Rechnung (mit gewähltem Fast-Track)", angebotWert(angenommen).startCents, 329_800);
gleich("Phase angenommen ohne Zahlung", angebotPhase(angenommen), "zahlung");
const teilgezahlt = { ...angenommen, teile: [{ ...angenommen.teile[0], teilBezahltCents: 200_000 }] };
gleich("Teilzahlung: offener Rest", angebotWert(teilgezahlt).startOffenCents, 129_800);
const bezahlt = A(kapitalC({ status: "angenommen", angenommenAm: "2026-11-01T10:00:00.000Z", gesamtCents: 279_900, teile: [{ nr: 1, betragCents: 279_900, zahlungsstatus: "paid", bestellRef: "FIAON-PRUEF-B2" }] }));
gleich("Bezahlt → Mandat läuft", [angebotPhase(bezahlt), angebotWert(bezahlt).startBezahlt, angebotWert(bezahlt).startOffenCents, angebotWert(bezahlt).erfolgStand], ["arbeit", true, 0, "offen"]);
const gestellt = A(kapitalC({ status: "angenommen", teile: [{ nr: 1, betragCents: 279_900, zahlungsstatus: "paid", bestellRef: "B" }, { nr: 2, betragCents: 420_000, zahlungsstatus: "pending", bestellRef: "B2" }] }));
gleich("Rechnung für Teil 2 steht → gestellt", angebotWert(gestellt).erfolgStand, "gestellt");
const honorarBezahlt = A(kapitalC({ status: "angenommen", teile: [{ nr: 1, betragCents: 279_900, zahlungsstatus: "paid", bestellRef: "B" }, { nr: 2, betragCents: 420_000, zahlungsstatus: "paid", bestellRef: "B2" }] }));
gleich("Teil 2 bezahlt", angebotWert(honorarBezahlt).erfolgStand, "bezahlt");
// Individualangebot: Teil 2 steht schon als Plan in der Liste, ohne Bestellung — das ist KEINE gestellte Rechnung.
const individuell = A({ id: 3, ref: "FIAON-IA-PRUEF03", status: "angenommen", kundeName: "Prüf Firma", gesamtCents: 1_150_000, gueltigBis: "2026-10-15", erstelltAm: "2026-10-01T08:00:00Z", angenommenAm: "2026-10-08T08:00:00Z",
  parameter: { teil1Cents: 465_000, teil2Cents: 685_000 }, teile: [{ nr: 1, betragCents: 465_000, zahlungsstatus: "pending", bestellRef: "B3", faelligAm: "2026-11-06" }, { nr: 2, betragCents: 685_000, zahlungsstatus: null, bestellRef: null }] });
gleich("Individuell: Teil 2 ohne Bestellung ist offen, nicht gestellt", [individuell.art, angebotWert(individuell).erfolgCents, angebotWert(individuell).erfolgStand], ["individuell", 685_000, "offen"]);
rot("Plan-Zeile als gestellte Rechnung gewertet", angebotWert(individuell).erfolgStand === "gestellt");
const begleit = A({ art: "begleit", id: 4, ref: "FIAON-IA-PRUEF04", status: "angenommen", kundeName: "Prüf Begleit", gesamtCents: 0, teile: [], erstelltAm: "2026-10-08T08:00:00Z", angenommenAm: "2026-10-09T08:00:00Z" });
gleich("Begleitvertrag: Honorar nach Ergebnis, Mandat läuft", [angebotWert(begleit).erfolgNachErgebnis, angebotWert(begleit).erfolgCents, angebotPhase(begleit)], [true, 0, "arbeit"]);
const firmaB = A({ art: "kapital", id: 5, ref: "FIAON-IA-PRUEF05", status: "angenommen", kundeName: "Prüf AG", gesamtCents: 279_900, gebuehren: { buergschaftCents: 49_900, auszahlungCents: 109_900, vereinbart: true }, teile: [{ nr: 1, betragCents: 279_900, zahlungsstatus: "paid", bestellRef: "B5" }], erstelltAm: "2026-10-19T08:00:00Z", angenommenAm: "2026-10-30T08:00:00Z" });
gleich("Kapital für Firmen: beide Gebühren zusammen", angebotWert(firmaB).erfolgCents, 159_800);
gleich("Zurückgezogen ist kein Mandant", angebotPhase(A(kapitalC({ status: "zurueckgezogen" }))), null);

// Wer am Zug ist
const s = (roh: Record<string, any>) => angebotSchritt(A(roh), HEUTE)!;
gleich("Heute angelegt, nie geöffnet → wartet auf den ersten Blick", [s(kapitalC({ erstelltAm: "2026-11-12T08:00:00Z" })).ton, s(kapitalC({ erstelltAm: "2026-11-12T08:00:00Z" })).schritt], ["kunde", "Wartet auf den ersten Blick"]);
gleich("Zwei Tage alt, nie geöffnet → nachfassen", [s(kapitalC()).ton, s(kapitalC()).schritt], ["uns", "Noch nicht geöffnet — nachfassen"]);
gleich("Gestern gelesen → wartet auf die Annahme", s(kapitalC({ aufrufe: mitAufrufen("2026-11-11") })).ton, "kunde");
gleich("Drei Tage still → nachfassen", [s(kapitalC({ aufrufe: mitAufrufen("2026-11-09") })).ton, s(kapitalC({ aufrufe: mitAufrufen("2026-11-09") })).schritt], ["uns", "Seit 3 Tagen still — nachfassen"]);
gleich("Läuft morgen ab → wir sind dran", [s(kapitalC({ gueltigBis: "2026-11-13", aufrufe: mitAufrufen("2026-11-12") })).ton, s(kapitalC({ gueltigBis: "2026-11-13" })).schritt], ["uns", "Läuft morgen ab — nachfassen oder verlängern"]);
gleich("Läuft heute ab", s(kapitalC({ gueltigBis: HEUTE })).schritt, "Läuft heute ab — nachfassen oder verlängern");
gleich("Abgelaufen", [s(kapitalC({ status: "abgelaufen", gueltigBis: "2026-11-10" })).ton, s(kapitalC({ status: "abgelaufen", gueltigBis: "2026-11-10" })).ueberfaellig], ["uns", true]);
ok("Satz endet nicht mit zwei Punkten", !/\.\./.test(s(kapitalC({ aufrufe: mitAufrufen("2026-11-09") })).warum) && !/\.\./.test(angebotSchritt(individuell, HEUTE)!.warum));
gleich("Angenommen, Zahlung überfällig", [angebotSchritt(individuell, HEUTE)!.ton, angebotSchritt(individuell, HEUTE)!.ueberfaellig, angebotSchritt(individuell, HEUTE)!.bis], ["uns", true, "2026-11-06"]);
const frisch = { ...angenommen, teile: [{ ...angenommen.teile[0], faelligAm: "2026-11-20" }] };
gleich("Angenommen, Zahlung noch im Ziel → wartet auf den Kunden", [angebotSchritt(frisch, HEUTE)!.ton, angebotSchritt(frisch, HEUTE)!.ueberfaellig], ["kunde", false]);
gleich("Bezahlt ohne Akte → Akte anlegen", angebotSchritt(bezahlt, HEUTE)!.schritt, "Akte anlegen");
gleich("Akte: Neues vom Kunden → wir", akteSchritt(akte({ uploadsNeu: 2 }), HEUTE).ton, "uns");
gleich("Akte: Station beantragt → Behörde", akteSchritt(akte({ naechsteStation: { titel: "EIN der Gesellschaft", status: "beantragt" } }), HEUTE).ton, "amt");
gleich("Akte: Zahlung offen → Kunde", akteSchritt(akte({ status: "offen" }), HEUTE).ton, "kunde");

// Mandanten
const liste = mandantenBauen(
  [offen, A(kapitalC({ id: 102, ref: "FIAON-IA-CPRUEF02", status: "abgelaufen", gueltigBis: "2026-10-20" })), A(kapitalC({ id: 103, ref: "FIAON-IA-CPRUEF03", status: "abgelaufen", gueltigBis: "2026-11-05" })),
    A(kapitalC({ id: 104, ref: "FIAON-IA-CPRUEF04", status: "zurueckgezogen" })), { ...bezahlt, id: 105, akteRef: "FIAON-PRUEF-AKTE1" }, { ...individuell, akteRef: "FIAON-PRUEF-AKTE2" },
    { ...bezahlt, id: 106, akteRef: "FIAON-PRUEF-TEST" }, { ...bezahlt, id: 107, akteRef: "FIAON-PRUEF-STORNO" }],
  [akte({ llc: "PRUEF EINS LLC" }), akte({ ref: "FIAON-PRUEF-AKTE2", llc: "PRUEF ZWEI LLC" }), akte({ ref: "FIAON-PRUEF-TEST", test: true }), akte({ ref: "FIAON-PRUEF-STORNO", status: "storniert" }),
    akte({ ref: "FIAON-PRUEF-WEB", status: "offen", kunde: "Prüf Webkauf", betragCents: 499_900, teilBezahltCents: 0 }), akte({ ref: "FIAON-PRUEF-WEBTEST", test: true, status: "offen" })],
  HEUTE);
const schluessel = liste.map((m) => m.schluessel).sort();
gleich("Mandanten: Koop, zurückgezogen, alt abgelaufen, Test und Storno fehlen", schluessel, ["akte:FIAON-PRUEF-AKTE1", "akte:FIAON-PRUEF-AKTE2", "akte:FIAON-PRUEF-WEB", "angebot:101", "angebot:103"]);
const m1 = liste.find((m) => m.schluessel === "akte:FIAON-PRUEF-AKTE1")!;
gleich("Angebot mit Akte ist EIN Mandant unter dem Namen der Gesellschaft", [m1.name, m1.angebotId, m1.wert.startBezahlt, m1.schritt.ton], ["PRUEF EINS LLC", 105, true, "uns"]);
const m2 = liste.find((m) => m.schluessel === "akte:FIAON-PRUEF-AKTE2")!;
gleich("Mit Akte, aber Start-Betrag offen → die Zahlung ist der Schritt", [m2.phase, m2.schritt.schritt], ["zahlung", "Zahlung überfällig — nachfassen"]);
gleich("Überfälliges steht ganz oben", liste[0].schluessel, "akte:FIAON-PRUEF-AKTE2");
gleich("Meilenstein-Warnung nur nach der Annahme mit festem Honorar", [m1.meilensteinOffen, liste.find((m) => m.schluessel === "angebot:101")!.meilensteinOffen], [true, false]);
gleich("Verlängern nur offen oder abgelaufen", [liste.find((m) => m.schluessel === "angebot:101")!.kannVerlaengern, liste.find((m) => m.schluessel === "angebot:103")!.kannVerlaengern, m1.kannVerlaengern], [true, true, false]);
const web = liste.find((m) => m.schluessel === "akte:FIAON-PRUEF-WEB")!;
gleich("Akte ohne Angebot: Betrag der Bestellung, Zahlung offen", [web.phase, web.wert.startCents, web.wert.startOffenCents, web.schritt.ton], ["zahlung", 499_900, 499_900, "kunde"]);

// Auftragswert
const w = auftragswertRechnen(liste);
gleich("Auftragswert offen", w.offen, { anzahl: 1, startCents: 279_900, erfolgCents: 420_000 });
gleich("Auftragswert angenommen (offener Rest)", w.angenommen, { anzahl: 2, startCents: 465_000 + 499_900, erfolgCents: 685_000 });
gleich("Auftragswert Mandat läuft", [w.bezahlt.anzahl, w.bezahlt.startCents, w.bezahlt.erfolgCents], [1, 279_900, 420_000]);
gleich("Zugesagt = angenommen + ausstehendes Honorar", w.zugesagtCents, 465_000 + 499_900 + 685_000 + 420_000);
gleich("Draußen = offen + zugesagt", w.draussenCents, 279_900 + 420_000 + w.zugesagtCents);
rot("abgelaufenes Angebot mitgezählt", w.offen.anzahl === 2);
gleich("Honorar nach Ergebnis steckt in keiner Summe", auftragswertRechnen(mandantenBauen([begleit], [], HEUTE)), { offen: { anzahl: 0, startCents: 0, erfolgCents: 0 }, angenommen: { anzahl: 0, startCents: 0, erfolgCents: 0 }, bezahlt: { anzahl: 1, startCents: 0, erfolgCents: 0, erfolgGestelltCents: 0, erfolgBezahltCents: 0 }, draussenCents: 0, zugesagtCents: 0, nachErgebnis: 1 });

// Fixkosten
const f = fixkostenRechnen({ fixCents: 1_900_000, vorgabe: true, monatCents: 760_050, globalMonatCents: 500_000, zugesagtCents: 3_000_000, offen: { anzahl: 10, startCents: 2_800_000, erfolgCents: 0 }, heute: HEUTE });
gleich("Fixkosten: Deckung, Rest, Stand", [f.deckungProzent, f.fehltCents, f.stand, f.monatVorbeiProzent, f.abschluesseNoetig], [40, 1_139_950, "zugesagt", 40, 5]);
gleich("Fixkosten gedeckt", fixkostenRechnen({ fixCents: 100_000, vorgabe: false, monatCents: 150_000, globalMonatCents: 0, zugesagtCents: 0, offen: { anzahl: 0, startCents: 0, erfolgCents: 0 }, heute: HEUTE }).stand, "gedeckt");
gleich("Fixkosten offen ohne Zusagen", fixkostenRechnen({ fixCents: 1_000_000, vorgabe: false, monatCents: 100_000, globalMonatCents: 0, zugesagtCents: 50_000, offen: { anzahl: 0, startCents: 0, erfolgCents: 0 }, heute: HEUTE }).stand, "offen");
gleich("Fixkosten 0 → keine Prozentzahl", fixkostenRechnen({ fixCents: 0, vorgabe: false, monatCents: 100, globalMonatCents: 0, zugesagtCents: 0, offen: { anzahl: 0, startCents: 0, erfolgCents: 0 }, heute: HEUTE }).deckungProzent, null);
gleich("Eingabe 19.000", fixkostenPruefen("19.000"), { ok: true, cents: 1_900_000 });
gleich("Eingabe 19000,50 €", fixkostenPruefen("19000,50 €"), { ok: true, cents: 1_900_050 });
gleich("Eingabe als Zahl", fixkostenPruefen(26000), { ok: true, cents: 2_600_000 });
ok("Eingabe Unsinn abgelehnt", !fixkostenPruefen("viel").ok && !fixkostenPruefen("-5").ok && !fixkostenPruefen("").ok);
ok("Eingabe zu groß abgelehnt", !fixkostenPruefen("99.999.999").ok);
gleich("Startwert", LAGE_FIXKOSTEN_VORGABE_CENTS, 1_900_000);

// Gültigkeit
gleich("Verlängern um sieben Tage: alter Link reicht", gueltigkeitPruefen({ status: "offen", altBis: "2026-11-19", neuBis: "2026-11-26", heute: HEUTE }), { ok: true, neuBis: "2026-11-26", linkBleibtBis: "2026-11-26" });
gleich("Abgelaufenes Angebot wieder öffnen", gueltigkeitPruefen({ status: "abgelaufen", altBis: "2026-11-10", neuBis: "2026-11-19", heute: HEUTE }), { ok: true, neuBis: "2026-11-19", linkBleibtBis: "2026-11-17" });
gleich("Lange abgelaufen: der alte Link ist tot", (gueltigkeitPruefen({ status: "abgelaufen", altBis: "2026-10-01", neuBis: "2026-11-19", heute: HEUTE }) as any).linkBleibtBis, null);
ok("Angenommenes Angebot wird nie verlängert", !gueltigkeitPruefen({ status: "angenommen", altBis: "2026-11-19", neuBis: "2026-11-26", heute: HEUTE }).ok);
ok("Zurückgezogenes Angebot wird nie verlängert", !gueltigkeitPruefen({ status: "zurueckgezogen", altBis: "2026-11-19", neuBis: "2026-11-26", heute: HEUTE }).ok);
ok("Vergangenheit abgelehnt", !gueltigkeitPruefen({ status: "offen", altBis: "2026-11-19", neuBis: "2026-11-11", heute: HEUTE }).ok);
ok("Mehr als 60 Tage abgelehnt", !gueltigkeitPruefen({ status: "offen", altBis: "2026-11-19", neuBis: "2027-02-01", heute: HEUTE }).ok);
ok("Gleiches Datum abgelehnt", !gueltigkeitPruefen({ status: "offen", altBis: "2026-11-19", neuBis: "2026-11-19", heute: HEUTE }).ok);
ok("Kein Datum abgelehnt", !gueltigkeitPruefen({ status: "offen", altBis: "2026-11-19", neuBis: "morgen", heute: HEUTE }).ok);

// Notiz
gleich("Notiz mit Wiedervorlage", notizPruefen({ bezugArt: "angebot", bezugId: "14", text: " Hat Zeit bis Montag. ", wiedervorlageAm: "2026-11-16", wiedervorlageText: "anrufen" }, HEUTE),
  { ok: true, wert: { bezugArt: "angebot", bezugId: "14", art: "gespraech", text: "Hat Zeit bis Montag.", wiedervorlageAm: "2026-11-16", wiedervorlageText: "anrufen" } });
gleich("Nur Wiedervorlage", (notizPruefen({ bezugArt: "akte", bezugId: "FIAON-PRUEF-AKTE1", wiedervorlageAm: HEUTE }, HEUTE) as any).wert?.art, "wiedervorlage");
gleich("Freie Notiz ohne Bezug", (notizPruefen({ bezugArt: "frei", bezugId: "egal", text: "Notiz" }, HEUTE) as any).wert?.bezugId, "");
ok("Leere Notiz abgelehnt", !notizPruefen({ bezugArt: "frei", text: "  " }, HEUTE).ok);
ok("Fremder Bezug abgelehnt", !notizPruefen({ bezugArt: "person", bezugId: "1", text: "x" }, HEUTE).ok);
ok("Bezug mit Sonderzeichen abgelehnt", !notizPruefen({ bezugArt: "akte", bezugId: "1; DROP", text: "x" }, HEUTE).ok);
ok("Wiedervorlage in der Vergangenheit abgelehnt", !notizPruefen({ bezugArt: "frei", text: "x", wiedervorlageAm: "2026-11-11" }, HEUTE).ok);
ok("Zu lange Notiz abgelehnt", !notizPruefen({ bezugArt: "frei", text: "x".repeat(4001) }, HEUTE).ok);

// Wir warten auf
const aufgaben: LagePartnerAufgabe[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: i + 1, firmaId: 7, firma: "Prüf Partner", titel: `Alt ${i}`, faelligAm: tagPlus(HEUTE, -(i + 1)), angelegtAm: "2026-10-27T10:00:00Z" })),
  { id: 50, firmaId: 8, firma: "Prüf Kanzlei", titel: "Heute fällig", faelligAm: HEUTE, angelegtAm: "2026-11-10T10:00:00Z" },
  { id: 51, firmaId: 8, firma: "Prüf Kanzlei", titel: "In drei Wochen", faelligAm: tagPlus(HEUTE, 21), angelegtAm: "2026-11-10T10:00:00Z" },
  { id: 52, firmaId: 8, firma: "Prüf Kanzlei", titel: "Ohne Tag", faelligAm: null, angelegtAm: "2026-11-10T10:00:00Z" },
];
const wv: LageWiedervorlage[] = [{ id: 900, bezugArt: "angebot", bezugId: "101", name: "Prüf Person", am: "2026-11-11", text: "anrufen", notiz: null, angelegtAm: "2026-11-09T10:00:00Z" }];
const wb = wartetBauen(liste, aufgaben, wv, HEUTE, () => "/ziel");
gleich("Überfällige Wiedervorlage zuerst", [wb.wartet[0].art, wb.wartet[0].ueberfaellig, wb.wartet[0].mandant, wb.wartet[0].notizId], ["wiedervorlage", true, "angebot:101", 900]);
ok("In „Wir warten auf“ stehen nur Kunde, Behörde und Wiedervorlage", wb.wartet.every((x) => x.art !== "partner") && wb.wartet.some((x) => x.art === "kunde"));
gleich("Partner: nur Fälliges und die nächsten sieben Tage", [wb.partner.gesamt, wb.partner.ueberfaellig], [11, 10]);
gleich("Partner: heute Fälliges oben, dann das Jüngste", [wb.partner.liste[0].worauf, wb.partner.liste[1].worauf, wb.partner.liste.length], ["Heute fällig", "Alt 0", LAGE_PARTNER_ZEILEN]);

// Feed
const e = (id: string, am: string, art: FeedEintrag["art"], extra: Partial<FeedEintrag> = {}): FeedEintrag => ({ id, am, tag: am.slice(0, 10), uhr: am.slice(11, 16), art, wer: "Prüf", titel: "x", text: null, betragCents: null, ziel: null, laut: true, ...extra });
const woche = feedOrdnen([e("a", "2026-11-12T09:00:00Z", "anfrage"), e("b", "2026-11-12T15:00:00Z", "zahlung", { betragCents: 279_900 }), e("c", "2026-11-10T08:00:00Z", "gespraech"), e("d", "2026-11-05T08:00:00Z", "anfrage"), e("z", "2026-11-11T08:00:00Z", "zahlung", { betragCents: 100 })], "2026-11-09", HEUTE);
gleich("Feed: Tage neueste zuerst", woche.tage.map((t) => t.tag), ["2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09"]);
gleich("Feed: im Tag das Neueste oben", woche.tage[0].eintraege.map((x) => x.id), ["b", "a"]);
gleich("Feed: fremde Woche bleibt draußen", woche.zahlen.anfrage, 1);
gleich("Feed: leise Zeilen zählen nicht mit, stehen aber im Tag", (({ zahlen, tage }) => [zahlen.mail ?? 0, zahlen.anfrage, tage[0].eintraege.length])(feedOrdnen([e("l", "2026-11-12T10:00:00Z", "mail", { laut: false }), e("a", "2026-11-12T09:00:00Z", "anfrage")], "2026-11-09", HEUTE)), [0, 1, 2]);
gleich("Feed: Zahlungen der Woche", woche.zahlungCents, 280_000);
gleich("Feed: diese Woche hat kein „danach“", [woche.istDieseWoche, woche.nachher, woche.vorher], [true, null, "2026-11-02"]);
gleich("Feed: Vorwoche blättert vor und zurück", (({ istDieseWoche, nachher, vorher }) => [istDieseWoche, nachher, vorher])(feedOrdnen([], "2026-11-02", HEUTE)), [false, "2026-11-09", "2026-10-26"]);

console.log(`  ${gut} bestanden, ${schlecht} durchgefallen`);

// ═══════════════════════════════════════════════════════════════════════════
if (process.argv.includes("--lokal")) {
  const url = String(process.env.DATABASE_URL || "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { console.error("Teil 2 läuft nur gegen eine lokale Datenbank (127.0.0.1 oder localhost) — abgebrochen."); process.exit(3); }
  console.log("Teil 2 — lokale Prüf-Datenbank");
  const { sqlPool } = await import("../server/lib/db-pool");
  const L = await import("../server/lib/fiaon-chef-global-lage");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const heute = berlinToday();
  try {
    const [tab] = (await sqlPool`SELECT to_regclass('public.fiaon_global_notizen') AS t`) as any[];
    if (!tab?.t) { console.error("fiaon_global_notizen fehlt — erst scripts/run-migrations.mjs gegen die lokale DB laufen lassen."); process.exit(3); }
    const lage = await L.globalLageLesen({ stufe: "inhaber" });
    gleich("Antwort ohne Lücken", lage.luecken, []);
    ok("Antwort hat Mandanten, Woche und Auftragswert", lage.mandanten.length > 0 && lage.woche.tage.length > 0 && lage.auftragswert.draussenCents > 0, "die lokale Kopie ist leer?");
    // Gegenrechnung mit eigener SQL: offene Angebote ohne Kooperation.
    const [dbOffen] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebote WHERE status = 'offen' AND gueltig_bis >= ${heute}::date AND fassung NOT LIKE 'IA-KOOP%'`) as any[];
    gleich("Zahl der offenen Angebote = Datenbank", lage.auftragswert.offen.anzahl, Number(dbOffen.n));
    const [dbErfolgC] = (await sqlPool`SELECT COALESCE(SUM((parameter->>'erfolgCents')::bigint), 0)::bigint AS s, COUNT(*)::int AS n FROM fiaon_global_angebote
      WHERE status = 'offen' AND gueltig_bis >= ${heute}::date AND fassung LIKE 'IA-KAPITAL%' AND parameter ? 'erfolgCents' AND NOT (parameter ? 'rahmenWahl')`) as any[];
    const ohneRegler = lage.mandanten.filter((m) => m.phase === "angebot" && m.angebotArt === "kapital");
    ok("Erfolgshonorar der offenen Kapital-Angebote ≥ Summe aus der Datenbank (ohne Regler-Angebote)", ohneRegler.reduce((x, m) => x + m.wert.erfolgCents, 0) >= Number(dbErfolgC.s), `Lage ${ohneRegler.reduce((x, m) => x + m.wert.erfolgCents, 0)}, DB ${dbErfolgC.s}`);
    gleich("Summe der Spalten = draußen", lage.auftragswert.draussenCents, lage.auftragswert.offen.startCents + lage.auftragswert.offen.erfolgCents + lage.auftragswert.angenommen.startCents + lage.auftragswert.angenommen.erfolgCents + lage.auftragswert.bezahlt.erfolgCents);
    ok("Kein Mandant ist eine Kooperation oder eine Test-Akte", lage.mandanten.every((m) => m.angebotArt !== "koop"));
    const [dbTest] = (await sqlPool`SELECT COALESCE(array_agg(ref), '{}') AS refs FROM fiaon_global_auftraege WHERE ist_test_am IS NOT NULL OR status = 'storniert'`) as any[];
    ok("Test- und stornierte Akten fehlen", lage.mandanten.every((m) => !m.akteRef || !(dbTest.refs as string[]).includes(m.akteRef)));
    // Umsatz: dieselbe Zahl wie die Hausfunktion der Geld-Wahrheit.
    const { umsatzBausteine } = await import("../server/routes/fiaon-chef-zahlen");
    const [eingang, haus] = await Promise.all([L.monatsEingang(), umsatzBausteine()]);
    gleich("Eingang im Monat = umsatzBausteine().monatCents", eingang.monatCents, haus.monatCents);
    ok("Global-Anteil ≤ Monat", eingang.globalCents <= eingang.monatCents);
    gleich("Fixkosten-Karte zeigt denselben Eingang", lage.fixkosten?.monatCents, haus.monatCents);
    gleich("Leitung sieht keine Fixkosten", (await L.globalLageLesen({ stufe: "leitung" })).fixkosten, null);
    // Feed: Vorwoche lädt, jede Zeile liegt in ihrer Woche.
    const vor = await L.globalLageLesen({ stufe: "inhaber", woche: lage.woche.vorher });
    ok("Vorwoche: alle Zeilen liegen in der Vorwoche", vor.woche.tage.every((t) => t.tag >= vor.woche.montag && t.tag <= tagPlus(vor.woche.montag, 6) && t.eintraege.every((x) => x.tag === t.tag)));
    ok("Diese Woche: keine Zeile aus der Zukunft oder aus der Vorwoche", lage.woche.tage.every((t) => t.tag <= heute && t.tag >= lage.woche.montag));
    ok("Feed-Kennungen sind eindeutig", new Set(lage.woche.tage.flatMap((t) => t.eintraege.map((x) => x.id))).size === lage.woche.tage.reduce((n, t) => n + t.eintraege.length, 0));

    // ── Schreibwege (nur lokal) — alles wird am Ende zurückgestellt ──
    const wer = { id: null, name: "Prüfstand E-508" };
    const ziel = lage.mandanten.find((m) => m.phase === "angebot" && m.angebotId != null && !m.akteRef);
    const angenommenM = lage.mandanten.find((m) => m.phase !== "angebot" && m.phase !== "abgelaufen" && m.angebotId != null);
    const neueIds: number[] = [];
    try {
      if (!ziel) ok("Es gibt ein offenes Angebot als Prüffall", false, "kein offenes Angebot in der Kopie");
      else {
        const n1 = await L.lageNotizSchreiben({ bezugArt: "angebot", bezugId: String(ziel.angebotId), text: "PRUEFSTAND Gespräch: will bis Montag entscheiden.", wiedervorlageAm: tagPlus(heute, 3), wiedervorlageText: "PRUEFSTAND anrufen" }, wer);
        ok("Notiz am Angebot gespeichert", n1.ok, JSON.stringify(n1));
        if (n1.ok) neueIds.push(n1.id);
        const danach = await L.globalLageLesen({ stufe: "inhaber" });
        const m = danach.mandanten.find((x) => x.schluessel === ziel.schluessel);
        ok("Notiz steht an der Karte", m?.notizen[0]?.text.startsWith("PRUEFSTAND Gespräch"));
        ok("Wiedervorlage steht in „Wir warten auf“", danach.wartet.some((x) => x.art === "wiedervorlage" && x.worauf === "PRUEFSTAND anrufen" && x.mandant === ziel.schluessel));
        ok("Notiz steht im Feed von heute", danach.woche.tage[0]?.eintraege.some((x) => x.art === "gespraech" && (x.text ?? "").includes("PRUEFSTAND Gespräch")));
        if (n1.ok) {
          const e1 = await L.lageWiedervorlageErledigen(n1.id, wer);
          ok("Wiedervorlage erledigt", e1.ok);
          ok("Zweimal erledigen geht nicht", !(await L.lageWiedervorlageErledigen(n1.id, wer)).ok);
          ok("Erledigte Wiedervorlage ist weg", !(await L.globalLageLesen({ stufe: "inhaber" })).wartet.some((x) => x.notizId === n1.id));
        }
        // Gültigkeit: verlängern, Verlauf, zurückstellen
        const [vorher] = (await sqlPool`SELECT gueltig_bis::text AS g, status, verlauf FROM fiaon_global_angebote WHERE id = ${ziel.angebotId}`) as any[];
        const neuBis = tagPlus(String(vorher.g).slice(0, 10), 5);
        const g1 = await L.lageGueltigkeitSetzen(ziel.angebotId!, neuBis, wer);
        ok("Gültigkeit verlängert", g1.ok && g1.gueltigBis === neuBis, JSON.stringify(g1));
        const [nachher] = (await sqlPool`SELECT gueltig_bis::text AS g, status, jsonb_array_length(verlauf) AS n FROM fiaon_global_angebote WHERE id = ${ziel.angebotId}`) as any[];
        gleich("Datum steht in der Datenbank, Status offen", [String(nachher.g).slice(0, 10), nachher.status], [neuBis, "offen"]);
        ok("Verlauf hat die Zeile dazu", Number(nachher.n) > (Array.isArray(vorher.verlauf) ? vorher.verlauf.length : 0));
        await sqlPool`UPDATE fiaon_global_angebote SET gueltig_bis = ${String(vorher.g).slice(0, 10)}::date, status = ${vorher.status}, verlauf = ${sqlPool.json(vorher.verlauf)} WHERE id = ${ziel.angebotId}`;
      }
      if (angenommenM) {
        const g2 = await L.lageGueltigkeitSetzen(angenommenM.angebotId!, tagPlus(heute, 10), wer);
        ok("Angenommenes Angebot lässt sich nicht verlängern", !g2.ok);
      }
      ok("Notiz an einem Angebot, das es nicht gibt, wird abgelehnt", !(await L.lageNotizSchreiben({ bezugArt: "angebot", bezugId: "99999999", text: "x" }, wer)).ok);
      ok("Notiz an einer Akte, die es nicht gibt, wird abgelehnt", !(await L.lageNotizSchreiben({ bezugArt: "akte", bezugId: "FIAON-GIBTSNICHT", text: "x" }, wer)).ok);
      const frei = await L.lageNotizSchreiben({ bezugArt: "frei", bezugId: "", art: "notiz", text: "PRUEFSTAND freie Notiz" }, wer);
      ok("Freie Notiz gespeichert", frei.ok); if (frei.ok) neueIds.push(frei.id);
      // Fixkosten setzen und zurückstellen
      const [fixVorher] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'chef_fixkosten_monat_cents'`) as any[];
      const fx = await L.lageFixkostenSetzen("21.500");
      gleich("Fixkosten gesetzt", [fx.ok, (await L.fixkostenLesen())], [true, { cents: 2_150_000, vorgabe: false }]);
      ok("Unsinn wird nicht gespeichert", !(await L.lageFixkostenSetzen("abc")).ok && (await L.fixkostenLesen()).cents === 2_150_000);
      if (fixVorher) await sqlPool`UPDATE fiaon_settings SET value = ${fixVorher.value} WHERE key = 'chef_fixkosten_monat_cents'`;
      else await sqlPool`DELETE FROM fiaon_settings WHERE key = 'chef_fixkosten_monat_cents'`;
      gleich("Fixkosten zurückgestellt", (await L.fixkostenLesen()).vorgabe, !fixVorher);
    } finally {
      // Aufräumen läuft immer: die Prüf-Notizen verschwinden weich, die Verlaufszeile am Angebot wurde oben zurückgestellt.
      if (neueIds.length) await sqlPool`UPDATE fiaon_global_notizen SET entfernt_am = NOW(), entfernt_von = 'Prüfstand E-508' WHERE id = ANY(${neueIds}::bigint[])`;
      await sqlPool`UPDATE fiaon_global_notizen SET entfernt_am = NOW(), entfernt_von = 'Prüfstand E-508' WHERE entfernt_am IS NULL AND (text LIKE 'PRUEFSTAND%' OR wiedervorlage_text LIKE 'PRUEFSTAND%')`;
    }
    console.log(`  gesamt ${gut} bestanden, ${schlecht} durchgefallen`);
  } finally { await sqlPool.end({ timeout: 5 }).catch(() => {}); }
}

if (schlecht) { console.error(`\nDURCHGEFALLEN: ${schlecht}`); process.exit(1); }
console.log(`\nALLES GRÜN: ${gut} Prüfungen`);
