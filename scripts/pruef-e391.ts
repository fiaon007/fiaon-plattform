// Prüfstand E-391 (16.10.2026): Team-Feedback — Kontoauszüge (Zeitraum aus allen Buchungen, doppelt hochgeladene
// Seiten, Zahlformat). Offline: reine Funktionen, keine Datenbank, kein Netz, keine KI. Aufruf:
//   env -i HOME=$HOME PATH=$PATH DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e391.ts
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

async function main() {
  const K = await import("../server/lib/fiaon-kontoauszug-analyse");
  const L = await import("../server/lib/fiaon-pdf-lesen");
  const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const HEUTE = Date.parse("2026-10-16T12:00:00Z");
  const b = (datum: string, betragCents = -1000, empfaenger = "REWE", saldoDanachCents: number | null = null) =>
    ({ datum, betragCents, empfaenger, zweck: "", kategorie: "lebensmittel", wiederkehrend: false, saldoDanachCents });
  const spanne = (von: string, bis: string, schritt = 3) => {
    const aus: ReturnType<typeof b>[] = [];
    for (let t = Date.parse(`${von}T00:00:00Z`); t <= Date.parse(`${bis}T00:00:00Z`); t += schritt * 86_400_000) aus.push(b(new Date(t).toISOString().slice(0, 10)));
    return aus;
  };

  console.log("── 1 · Zeitraum aus Kopf UND Buchungen (Daniels PDF Juli–September)");
  const drei = spanne("2026-07-01", "2026-09-30");
  let z = K.zeitraumAusBuchungen("2026-07-01", "2026-07-31", drei, HEUTE);
  ok(z.von === "2026-07-01" && z.bis >= "2026-09-28", "Kopf sagt Juli, Buchungen bis Ende September → Juli bis September", JSON.stringify(z));
  z = K.zeitraumAusBuchungen("2026-08-01", "2026-08-31", spanne("2026-07-01", "2026-09-30", 1), HEUTE);
  ok(z.von === "2026-07-01" && z.bis === "2026-09-30", "Kopf August (Niko), Buchungen 01.07.–30.09. → 01.07.–30.09.", JSON.stringify(z));
  z = K.zeitraumAusBuchungen("2026-07-01", "2026-09-30", spanne("2026-08-01", "2026-08-31"), HEUTE);
  ok(z.von === "2026-07-01" && z.bis === "2026-09-30", "Kopf weiter als die Buchungen → der Kopf bleibt");
  z = K.zeitraumAusBuchungen("2026-07-01", "2026-07-31", [...spanne("2026-07-01", "2026-07-31"), b("2006-06-15"), b("2020-08-01")], HEUTE);
  ok(z.von === "2026-07-01" && z.bis === "2026-07-31", "falsch gelesenes Jahr (2006, 2020) dehnt nichts aus", JSON.stringify(z));
  z = K.zeitraumAusBuchungen("2026-08-01", "2026-08-31", [...spanne("2026-08-01", "2026-08-31", 1), b("2026-03-02")], HEUTE);
  ok(z.von === "2026-08-01", "ein einzelner Randtag Monate davor zählt nicht (randBereinigt)", JSON.stringify(z));
  z = K.zeitraumAusBuchungen(null, null, spanne("2026-07-03", "2026-09-29"), HEUTE);
  ok(z.von === "2026-07-03" && z.bis !== null, "ohne Kopf: Spanne der Buchungen", JSON.stringify(z));
  z = K.zeitraumAusBuchungen("2026-07-01", "2026-07-31", [], HEUTE);
  ok(z.von === "2026-07-01" && z.bis === "2026-07-31", "ohne Buchungen: der Kopf");
  z = K.zeitraumAusBuchungen("2026-07-01", "2026-07-31", [b("2026-08-02"), b("2026-08-05")], HEUTE);
  ok(z.bis === "2026-07-31", "unter drei Buchungstagen zählt nur der Kopf");
  z = K.zeitraumAusBuchungen("2026-07-01", "2026-07-31", [...spanne("2026-07-01", "2026-07-31"), b("2026-12-24"), b("2026-12-30"), b("2026-12-31")], HEUTE);
  ok(z.bis === "2026-07-31", "Tage in der Zukunft zählen nie", JSON.stringify(z));

  console.log("── 2 · Doppelt hochgeladene Seiten (Fotos ohne Saldo)");
  const kaffee = b("2026-08-05", -350, "Bäckerei Müller");
  const miete = b("2026-08-01", -80000, "Hausverwaltung GmbH");
  const lohn = b("2026-08-28", 250000, "Arbeitgeber AG");
  let d = K.ueberStueckeDoppelteEntfernen([[kaffee, { ...kaffee }, miete], [{ ...miete }, { ...kaffee }, lohn]]);
  ok(d.buchungen.length === 4 && d.entfernt === 2, "zweimal Kaffee im selben Stück bleibt, die Wiederholung im späteren Stück fällt weg", JSON.stringify({ n: d.buchungen.length, e: d.entfernt }));
  d = K.ueberStueckeDoppelteEntfernen([[miete, lohn], [{ ...miete }, { ...lohn }], [{ ...miete }, { ...lohn }]]);
  ok(d.buchungen.length === 2 && d.entfernt === 4, "ein Monat dreifach hochgeladen → einmal gezählt (Nikos August)");
  const mitSaldo = b("2026-08-01", -80000, "Hausverwaltung GmbH", 120000);
  d = K.ueberStueckeDoppelteEntfernen([[mitSaldo], [{ ...mitSaldo }]]);
  ok(d.buchungen.length === 2 && d.entfernt === 0, "Zeilen MIT gedrucktem Saldo regelt weiter doppelteBuchungenEntfernen");
  ok(K.doppelteBuchungenEntfernen(d.buchungen).buchungen.length === 1, "… und dort fällt die gleiche Saldo-Zeile weg");
  d = K.ueberStueckeDoppelteEntfernen([[b("2026-08-01", -80000, "Hausverwaltung GmbH")], [b("2026-09-01", -80000, "Hausverwaltung GmbH")]]);
  ok(d.buchungen.length === 2, "gleiche Miete in verschiedenen Monaten bleibt");
  d = K.ueberStueckeDoppelteEntfernen([[b("2026-08-01", -80000, "TELEKOM DEUTSCHLAND GMBH")], [b("2026-08-01", -80000, "Telekom Deutschland")]]);
  ok(d.buchungen.length === 1, "Empfänger in anderer Schreibweise gilt als derselbe");

  console.log("── 3 · Zahlformat: auch US-Auszüge sind lesbar");
  const us = Array.from({ length: 12 }, (_, i) => `10/0${(i % 9) + 1}/2026 POS PURCHASE STARBUCKS #${i} 9.${10 + i} 1,234.56`).join("\n");
  ok(L.auszugBrauchbar(us), "US-Format (9.99, 1,234.56) gilt als lesbar");
  ok(K.auszugWert(us) >= 12, "auszugWert zählt US-Beträge", String(K.auszugWert(us)));
  const de = Array.from({ length: 6 }, (_, i) => `0${i + 1}.08.2026 Lastschrift REWE -1.234,5${i}`).join("\n") + "\n".repeat(3) + "Kontostand am 31.08.2026";
  ok(L.auszugBrauchbar(de.padEnd(130, " ")), "deutsches Format weiter lesbar");
  const nurDaten = Array.from({ length: 20 }, () => "18.08.2026 01.07.2026 30.09.26").join(" ");
  ok(((nurDaten.match(L.BETRAG_MUSTER) || []).length) === 0, "Daten sind keine Beträge", String((nurDaten.match(L.BETRAG_MUSTER) || []).length));
  ok(((("Zins 3,50 % p.a. 12,5%").match(L.BETRAG_MUSTER) || []).length) === 0, "Prozentsätze sind keine Beträge");

  console.log("── 4 · Quelltext: angeschlossen");
  const q = lies("server/lib/fiaon-kontoauszug-analyse.ts");
  ok(/export const AUSWERTUNG_VERSION = 5;/.test(q), "Fassung 5 — der Tageslauf rechnet die Zeiträume aller fertigen Analysen ohne Modell nach");
  ok(/const zr = zeitraumAusBuchungen\(tagText\(k\.zeitraum_von\), tagText\(k\.zeitraum_bis\), bereinigt\)/.test(q), "Neu-Rechnen setzt den Zeitraum aus den gespeicherten Buchungen");
  ok(/zeitraumVon: zeitraum\.von, zeitraumBis: zeitraum\.bis/.test(q), "neue Analysen speichern den vereinigten Zeitraum");
  ok(/status: "unlesbar"[^\n]*auswertung_version: AUSWERTUNG_VERSION/.test(q), "„unlesbar“ trägt die Fassung (sonst zeigte die Bonitätsauswertung „Startklar“)");
  ok(/if \(kopfAblehnung && buchungen\.length < 5\) return ablehnen\(\);/.test(q) && /kreditkartenabrechnung", "depot_oder_sparkonto"\]\.includes/.test(q), "„kein Kontoauszug“ erst ohne Buchungen; Kreditkarte/Depot sofort");
  ok(/WHERE status = 'laeuft' AND created_at < NOW\(\) - INTERVAL '30 minutes'/.test(q), "hängende Läufe werden nach 30 Minuten zum Fehler und nachgeholt");
  ok(/ueberStueckeDoppelteEntfernen\(jeStueck\)/.test(q), "beim Lesen werden doppelt hochgeladene Seiten entfernt");
  ok(/THEN 'doppelt'/.test(q) && /k\.grund === "doppelt"/.test(q) && /pruefung \? 'doppeltHochgeladen'/.test(q), "alte, stark doppelte Analysen werden einmal neu gelesen (hakt sich über doppeltHochgeladen selbst ab)");

  console.log("── 5 · Kündigung aus dem Formular: wann ohne Menschen gebucht wird");
  const F = await import("../server/lib/fiaon-kuendigung-folgen");
  const basis = { identitaetOffen: false, zielBuchbar: true, grund: "Bitte kündigen", agbStand: null as string | null, bezahlt: true, bestellungAm: "2026-07-01T10:00:00Z", antragAm: "2026-09-19T10:00:00Z" };
  ok(F.automatischBuchbar(basis).ja, "Altvertrag, Identität bestätigt, ein Paket → sofort gebucht (Lisa Kühne, Karin Garber …)");
  ok(!F.automatischBuchbar({ ...basis, identitaetOffen: true }).ja, "Identität offen → bleibt Karte");
  ok(!F.automatischBuchbar({ ...basis, zielBuchbar: false }).ja, "kein eindeutiges Paket → bleibt Karte");
  ok(!F.automatischBuchbar({ ...basis, grund: "Ich widerrufe den Vertrag" }).ja, "Widerruf im Text → bleibt Karte (Erstattung)");
  ok(!F.automatischBuchbar({ ...basis, agbStand: "2026-09-10" }).ja, "bezahlter Jahresvertrag → bleibt Karte (Kulanz = Geldentscheidung)");
  ok(F.automatischBuchbar({ ...basis, agbStand: "2026-09-10", bezahlt: false }).ja, "unbezahlter Jahresvertrag → gebucht (Storno, nichts geschuldet)");
  ok(!F.automatischBuchbar({ ...basis, bestellungAm: "2026-09-10T10:00:00Z", antragAm: "2026-09-19T10:00:00Z" }).ja, "bezahlt und unter 14 Tagen → bleibt Karte (möglicher Widerruf)");
  ok(F.automatischBuchbar({ ...basis, bezahlt: false, bestellungAm: "2026-09-18T10:00:00Z" }).ja, "nie bezahlt, frisch → gebucht");

  console.log("── 6 · Abrechnungsmonat (Vertragsende beim Altvertrag)");
  const A = await import("../shared/fiaon-antrag-stand");
  const kette = ["2026-06-24", "2026-07-24", "2026-08-23", "2026-09-23"];
  ok(A.abrechnungsmonatEnde("2026-05-26T10:00:00Z", kette, { anker: "2026-05-26" }) === "2026-06-23", "Startzahlung vor der Kette (Kuball): Ende 23.06., nicht 23.07.", A.abrechnungsmonatEnde("2026-05-26T10:00:00Z", kette, { anker: "2026-05-26" }));
  ok(A.abrechnungsmonatEnde("2026-09-19T10:00:00Z", ["2026-08-27", "2026-09-27"], { anker: "2026-08-27" }) === "2026-09-26", "Normalfall unverändert: Kündigung 19.09., Rate 27.09. → Ende 26.09. (Lisa Kühne)");
  ok(A.abrechnungsmonatEnde("2026-09-19T10:00:00Z", ["2026-08-27", "2026-09-27"], { anker: "2026-08-20" }) === "2026-09-26", "Anker nah an Rate 1 (7 Tage) ändert nichts");
  let geworfen = false; let ende = "";
  try { ende = A.abrechnungsmonatEnde("2026-08-20T10:00:00Z", [], { anker: "2026-08-29" }); } catch { geworfen = true; }
  ok(!geworfen && /^2026-09-\d\d$/.test(ende), "Kündigung vor der ersten Zahlung ohne Kette stürzt nicht mehr ab", ende);

  console.log("── 7 · Mara: „in Ruhe lassen“ mit Satzzeichen");
  const T = await import("../shared/fiaon-mara-ton");
  ok(T.abstreitenArt("Ich will nix mehr von.euch hören")?.art === "in_ruhe", "„will nix mehr von.euch“ wird erkannt", JSON.stringify(T.abstreitenArt("Ich will nix mehr von.euch hören")));
  ok(T.abstreitenArt("Ich will nichts mehr von Ihnen")?.art === "in_ruhe", "„will nichts mehr von Ihnen“ weiter erkannt");

  console.log("── 8 · Quelltext: Kündigungsfolgen angeschlossen");
  const abo = lies("server/routes/fiaon-abo.ts");
  ok(/m\.kuendigungsFolgenNachziehen\(\)/.test(abo) && abo.indexOf("kuendigungsFolgenNachziehen") < abo.indexOf("const ueber = await ueberfaelligStellen"), "Tageslauf zieht Kündigungsfolgen VOR „überfällig stellen“ nach");
  ok(/AND \$\{lauf\.unsafe\(FORDERUNG_AKTIV_SQL_FUER\("a", "r"\)\)\}/.test(abo), "„überfällig stellen“ nur für geschuldete Raten");
  ok(/const RATE_NACH_ENDE_SQL = RATE_NACH_ENDE_SQL_FUER\("a", "r"\);/.test(abo), "Mahnmotor liest dieselbe Nach-Ende-Regel");
  const ink = lies("server/lib/fiaon-inkasso.ts");
  ok(/AND \$\{FORDERUNG_AKTIV_SQL_FUER\("a", "r"\)\}/.test(ink), "Inkasso-Liste/-Verteilung (SICHTFELD) nur für geschuldete Raten");
  ok(/FORDERUNG_AKTIV_SQL_FUER\("a", "r"\)/.test(lies("server/routes/fiaon-inkasso-bereich.ts")), "Inkasso-Erinnerung von Hand nur für geschuldete Raten");
  ok(/r\.status !== "bezahlt" && !r\.storniert_am && r\.status !== "storniert"/.test(lies("server/routes/fiaon-kunde-bereich.ts")), "Kundenbereich zählt stornierte Raten nicht als offen");
  const can = lies("server/routes/cancellation.ts");
  ok(/antragAutomatischBuchen\(Number\(row\.id\)\)/.test(can) && /c\.id IN \(SELECT kr_u\.antrag_id FROM \(\$\{KUENDIGUNG_ANTRAEGE_SQL\}\) kr_u\)/.test(can), "Formular bucht eindeutige Anträge sofort; Doppelprüfung nur gegen echte offene");
  ok(/const ungebucht = `NOT \$\{KUENDIGUNG_UNGEBUCHT_SQL\("b\.person_id"\)\}`/.test(lies("server/lib/fiaon-wa-zentrale.ts")), "WhatsApp-Gruppen ohne Menschen mit ungebuchter Kündigung");
  const ku = lies("server/lib/fiaon-kuendigung.ts");
  ok(/offen_davor === true\) return \{ beendet: false \}/.test(ku), "Vertrag endet erst, wenn keine geschuldete Rate mehr offen ist (Fall Virag)");
  ok(/if \(art === "in_ruhe" && ein\.personId\)/.test(lies("server/lib/fiaon-whatsapp-mara.ts")), "Mara setzt bei „in Ruhe lassen“ auch beim Kunden die Werbesperre (Fall Rieser)");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
