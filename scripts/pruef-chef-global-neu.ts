// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: CHEFBÜRO › GLOBAL-KUNDEN (E-455, 29.10.2026)
//
// Justin: „Baue mir einen eigenen Bereich für die Global-Kunden in Global CI (Apple) … mit 1 Klick alles lösen.“
// Rein — keine Datenbank, kein Netz.
//   A  ALS NÄCHSTES   die reine Rechnung (shared/fiaon-global-als-naechstes.ts) mit Fällen in der richtigen Reihenfolge
//   B  LISTE          „Braucht uns“ · „Wartet auf Kunde“ · Ruhe, Punkt bei Neuem, ein Satz Stand
//   C  INVENTAR       jede Funktion des Raums „Global-Mandate“ hat im neuen Raum einen Einstieg (Endpunkt bzw. Bauteil)
//   D  RAUM           eigener Raum + Menüpunkt oben in „FIAON Global“ + Zahl; alter Raum und Aufgaben-Links unverändert
//   E  GESTALTUNG     eigenes Präfix .cgn-, Schrift dünn, Handy ≥ 44 px, nichts klebt, reduzierte Bewegung
//
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-chef-global-neu.ts   (Exit 1 bei ROT)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
const N = await import("../shared/fiaon-global-als-naechstes");
const { GLOBAL_FAHRPLAN } = await import("../shared/fiaon-global-mandat");
const { globalChefMandatPfad } = await import("../shared/fiaon-global-wege");

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const HEUTE = "2026-10-29";
/** Ein Fahrplan: die ersten `erledigt` Stationen erledigt, die übrigen offen (Bedarf-Stationen nie angelegt). */
function fahrplan(erledigt: number, ueber: Record<string, Record<string, unknown>> = {}) {
  let i = 0;
  return GLOBAL_FAHRPLAN.map((v) => {
    const bedarf = !!v.nurBeiBedarf;
    const st = bedarf ? "offen" : (i++ < erledigt ? "erledigt" : "offen");
    return { schluessel: v.schluessel, titel: v.titel.de, status: st, geaendertAm: bedarf || st === "offen" ? null : "2026-10-01T10:00:00Z", ...(ueber[v.schluessel] ?? {}) };
  });
}
const basis = (x: Record<string, unknown> = {}) => ({
  status: "gestartet", nachrichten: [], dokumente: [], schritte: fahrplan(3), fristen: [], unterlagen: [], nachreichen: [],
  gesellschaftPlus: {}, zustaendigkeit: { agentId: 7, name: "Team", auswahl: [{ id: 7, name: "Team" }, { id: 1, name: "Leitung A (Leitung)" }] }, ...x,
});

// ═══ A ALS NÄCHSTES ═══════════════════════════════════════════════════════════
abschnitt("A „Als Nächstes“");
{
  const a = N.alsNaechstes(basis({ status: "storniert" }) as any, HEUTE);
  gleich([a.ton, a.knopf], ["ruhe", null], "storniert → Ruhe, kein Knopf");
  const stornoNachricht = N.alsNaechstes(basis({ status: "storniert", nachrichten: [{ von: "kunde", gelesen: false }] }) as any, HEUTE);
  gleich([stornoNachricht.knopf, stornoNachricht.aktion.art, stornoNachricht.wartet], ["Antworten", "antworten", []], "Gegenprüfung 6: ungelesene Nachricht geht auch bei storniert vor (ohne „Beim Kunden“)");

  const nachricht = N.alsNaechstes(basis({ nachrichten: [{ von: "kunde", gelesen: false }, { von: "fiaon", gelesen: false }], dokumente: [{ id: 5, von: "kunde", neu: true }] }) as any, HEUTE);
  gleich([nachricht.ton, nachricht.knopf, nachricht.aktion.art], ["uns", "Antworten", "antworten"], "1 ungelesene Kundennachricht schlägt alles andere (auch neue Dokumente)");
  ok(/geschrieben/.test(nachricht.titel), "Satz: „Der Kunde hat geschrieben.“", nachricht.titel);
  gleich(N.alsNaechstes(basis({ nachrichten: [{ von: "fiaon", gelesen: false }] }) as any, HEUTE).aktion.art, "station", "ungelesene EIGENE Nachricht zählt nicht");

  const dok = N.alsNaechstes(basis({ dokumente: [{ id: 11, von: "kunde", neu: true, titel: "Reisepass" }, { id: 12, von: "kunde", neu: false }] }) as any, HEUTE);
  gleich([dok.knopf, dok.aktion], ["Öffnen", { art: "dokument-oeffnen", dokumentId: 11 }], "2 neues Kunden-Dokument → „Öffnen“ genau dieses");
  ok(/Öffnen zählt als gesehen/.test(dok.warum), "warum: Öffnen = gesehen");
  const unterschrieben = N.alsNaechstes(basis({ dokumente: [{ id: 13, von: "kunde", neu: true, titel: "Operating Agreement", unterschriebeneFassungVon: 9 }] }) as any, HEUTE);
  ok(/^Unterschrieben zurück/.test(unterschrieben.titel), "frisch unterschriebene Fassung heißt „Unterschrieben zurück“", unterschrieben.titel);
  const zwei = N.alsNaechstes(basis({ dokumente: [{ id: 21, von: "kunde", neu: true }, { id: 22, von: "kunde", neu: true }] }) as any, HEUTE);
  gleich([zwei.knopf, zwei.titel], ["Erstes öffnen", "2 neue Dokumente vom Kunden."], "mehrere neue Dokumente");

  const frist = N.alsNaechstes(basis({ fristen: [{ id: 3, titel: "Annual Report", faelligAm: "2026-11-05", erledigt: false }, { id: 4, titel: "Später", faelligAm: "2027-05-01", erledigt: false }] }) as any, HEUTE);
  gleich([frist.knopf, frist.aktion], ["Erledigt", { art: "frist-erledigt", fristId: 3 }], "3 Frist in 7 Tagen → „Erledigt“");
  ok(/in 7 Tagen/.test(frist.warum), "warum nennt die Tage", frist.warum);
  ok(/überfällig/.test(N.alsNaechstes(basis({ fristen: [{ id: 3, titel: "X", faelligAm: "2026-10-20", erledigt: false }] }) as any, HEUTE).warum), "überfällige Frist sagt „überfällig“");
  gleich(N.alsNaechstes(basis({ fristen: [{ id: 3, titel: "X", faelligAm: "2026-12-20", erledigt: false }] }) as any, HEUTE).aktion.art, "station", "Frist in 52 Tagen drängt nicht");
  gleich(N.alsNaechstes(basis({ fristen: [{ id: 3, titel: "X", faelligAm: "2026-10-30", erledigt: true }] }) as any, HEUTE).aktion.art, "station", "erledigte Frist zählt nicht");

  const zust = N.alsNaechstes(basis({ zustaendigkeit: { agentId: null, auswahl: [{ id: 7, name: "Team" }, { id: 1, name: "Leitung A (Leitung)" }] } }) as any, HEUTE);
  gleich([zust.knopf, zust.aktion], ["Ich übernehme", { art: "zustaendig", agentId: 1 }], "4 niemand zuständig → „Ich übernehme“ (die angemeldete Leitung)");
  gleich(N.alsNaechstes(basis({ zustaendigkeit: { agentId: null, auswahl: [{ id: 7, name: "Team" }] } }) as any, HEUTE).aktion, { art: "zustaendig-waehlen" }, "ohne eigene Leitung in der Auswahl → „Person wählen“");

  const zahlung = N.alsNaechstes(basis({ status: "offen" }) as any, HEUTE);
  gleich([zahlung.ton, zahlung.aktion.art], ["kunde", "zugang-senden"], "5 Zahlung offen → wartet auf Kunde, „Link erneut senden“");
  ok(zahlung.wartet.includes("Zahlung offen"), "„Beim Kunden“ nennt die Zahlung");

  const start = N.alsNaechstes(basis({ schritte: fahrplan(0) }) as any, HEUTE);
  gleich([start.knopf, start.aktion], ["Starten", { art: "station", schluessel: "name", status: "in_arbeit" }], "6 erste offene Station → „Starten“ (in Arbeit)");
  const ein = N.alsNaechstes(basis({ schritte: fahrplan(5, { ein: { status: "in_arbeit", geaendertAm: "2026-10-20T10:00:00Z" } }) }) as any, HEUTE);
  gleich([ein.knopf, ein.aktion], ["EIN eintragen", { art: "station-werte", schluessel: "ein" }], "laufende EIN ohne Wert → „EIN eintragen“ (Editor)");
  const einDa = N.alsNaechstes(basis({ schritte: fahrplan(5, { ein: { status: "in_arbeit", geaendertAm: "x" } }), gesellschaftPlus: { ein: "12-3456789" } }) as any, HEUTE);
  gleich([einDa.knopf, einDa.aktion], ["Erledigt", { art: "station", schluessel: "ein", status: "erledigt" }], "laufende EIN MIT Wert → „Erledigt“");
  const itin = N.alsNaechstes(basis({ schritte: fahrplan(7, { itin: { status: "beantragt", beantragtAm: "2026-10-02", geaendertAm: "x" } }), gesellschaftPlus: {} }) as any, HEUTE);
  gleich([itin.ton, itin.knopf], ["amt", "ITIN eintragen"], "ITIN beantragt, noch ohne Nummer → wartet aufs Amt, „ITIN eintragen“");
  const konto = N.alsNaechstes(basis({ schritte: fahrplan(8, { konto: { status: "beantragt", beantragtAm: "2026-10-02", geaendertAm: "x" } }) }) as any, HEUTE);
  gleich([konto.ton, konto.knopf], ["amt", "Erledigt"], "Konto beantragt → wartet aufs Institut, Knopf „Erledigt“");
  ok(/02\.10\.2026/.test(konto.warum), "warum nennt den Antragstag", konto.warum);
  // Bedarf-Station (frühere Gesellschaft) — nie angelegt, darf nicht die nächste sein.
  const s7 = N.alsNaechstes(basis({ schritte: fahrplan(7) }) as any, HEUTE);
  ok(s7.aktion.art === "station" && (s7.aktion as any).schluessel !== "vorgesellschaft", "nie angelegte Bedarf-Station wird übersprungen", JSON.stringify(s7.aktion));
  const bedarf = N.alsNaechstes(basis({ schritte: fahrplan(7, { vorgesellschaft: { status: "in_arbeit", geaendertAm: "x" } }) }) as any, HEUTE);
  gleich((bedarf.aktion as any).schluessel, "vorgesellschaft", "angelegte Bedarf-Station zählt in Fahrplan-Reihenfolge");
  const entfaellt = N.alsNaechstes(basis({ schritte: fahrplan(0, { name: { status: "entfaellt", geaendertAm: "x" } }) }) as any, HEUTE);
  gleich((entfaellt.aktion as any).schluessel, "articles", "„entfällt“ wird übersprungen");

  const fertig = N.alsNaechstes(basis({ schritte: fahrplan(99) }) as any, HEUTE);
  gleich([fertig.ton, fertig.titel, fertig.knopf], ["ruhe", "Nichts offen.", null], "7 alles erledigt → „Nichts offen.“");
  const wartet = N.alsNaechstes(basis({ schritte: fahrplan(99), dokumente: [{ id: 1, von: "fiaon", unterschrift: { gefordert: true, unterschrieben: false } }] }) as any, HEUTE);
  gleich([wartet.ton, wartet.wartet], ["kunde", ["1 Unterschrift offen"]], "alles erledigt, Unterschrift offen → wartet auf Kunde");
  const unterlagen = N.alsNaechstes(basis({ unterlagen: [{ titel: "Reisepass", vorhanden: false }, { titel: "Adressnachweis", vorhanden: true }, { titel: "Foto", vorhanden: false, abgelehnt: true }], nachreichen: [{ titel: "Foto" }] }) as any, HEUTE);
  gleich(unterlagen.wartet, ["Fehlt: Reisepass", "Bitte neu: Foto"], "„Beim Kunden“: fehlende Unterlagen und „bitte neu“ — getrennt, nicht doppelt");
  gleich(N.wartetAufKunde({ status: "offen", unterlagen: [{ titel: "Reisepass", vorhanden: false }] }), ["Zahlung offen"], "vor der Zahlung zählen fehlende Unterlagen nicht (wie Portal)");
  gleich(N.alsNaechstes(basis({ status: "abgeschlossen" }) as any, HEUTE).titel, "Der Auftrag ist abgeschlossen.", "abgeschlossen → Ruhe");
  gleich(N.alsNaechstes({} as any, HEUTE).ton, "kunde", "leere Akte bricht nicht (Status offen vorgegeben)");
  gleich([N.tageBis("2026-11-05", HEUTE), N.tageBis("2026-10-20", HEUTE), N.tageBis("2027-03-28", "2027-03-27")], [7, -9, 1], "tageBis rechnet in Kalendertagen (auch über die Zeitumstellung)");
}

// ═══ B LISTE ══════════════════════════════════════════════════════════════════
abschnitt("B Liste");
{
  const z = (x: Record<string, unknown>) => N.listenLage({ status: "gestartet", fortschritt: { erledigt: 4, gesamt: 12 }, ...x } as any, HEUTE);
  gleich([z({ uploadsNeu: 2 }).gruppe, z({ uploadsNeu: 2 }).neu, z({ uploadsNeu: 2 }).naechster], ["uns", true, "2 neue Dokumente"], "neue Uploads → Braucht uns, Punkt, Satz");
  gleich(z({ uploadsNeu: 1, anfragenNeu: 1 }).naechster, "1 neues Dokument · 1 neue Nachricht", "Dokument und Nachricht in einem Satz");
  gleich(z({}).stand, "In Arbeit · 4 von 12 Stationen", "ein Satz Stand");
  gleich(z({ naechsterSchritt: "Wir reichen ein." }).naechster, "Wir reichen ein.", "nächster Schritt = Satz für den Kunden");
  gleich(z({}).gruppe, "uns", "laufender Fahrplan → Braucht uns");
  gleich([z({ naechsteFrist: "2026-11-03" }).gruppe, z({ naechsteFrist: "2026-11-03" }).naechster], ["uns", "Frist am 03.11.2026"], "Frist ≤ 14 Tage → Braucht uns");
  gleich(z({ status: "offen" }).gruppe, "kunde", "Zahlung offen → Wartet auf Kunde");
  gleich(z({ status: "offen" }).stand, "Zahlung offen", "Stand bei offener Zahlung");
  gleich([z({ unterschriftenOffen: 2 }).gruppe, z({ unterschriftenOffen: 2 }).naechster], ["uns", "2 Unterschriften beim Kunden"], "Unterschrift offen, Fahrplan läuft → Braucht uns (wie „Als Nächstes“), Satz nennt die Unterschrift");
  const fertigU = z({ unterschriftenOffen: 1, fortschritt: { erledigt: 12, gesamt: 12 } });
  gleich([fertigU.gruppe, fertigU.naechster], ["kunde", "1 Unterschrift beim Kunden"], "Fahrplan fertig, Unterschrift offen → Wartet auf Kunde");
  gleich(z({ status: "offen", uploadsNeu: 1 }).gruppe, "uns", "Neues schlägt „Zahlung offen“");
  gleich(z({ fortschritt: { erledigt: 12, gesamt: 12 } }).gruppe, "ruhe", "Fahrplan komplett → nur unter „Alle“");
  gleich([z({ status: "storniert" }).gruppe, z({ status: "abgeschlossen" }).gruppe], ["ruhe", "ruhe"], "storniert/abgeschlossen → Ruhe");
  const amt = z({ naechsteStation: { titel: "EIN der Gesellschaft", status: "beantragt" } });
  gleich([amt.gruppe, amt.naechster], ["amt", "Wartet auf Behörde: EIN der Gesellschaft"], "Gegenprüfung 7: nächste Station beantragt → Wartet auf Behörde (wie die Karte)");
  gleich(z({ naechsteStation: { titel: "EIN der Gesellschaft", status: "in_arbeit" } }).gruppe, "uns", "nächste Station läuft → Braucht uns");
  gleich(z({ uploadsNeu: 1, naechsteStation: { titel: "X", status: "beantragt" } }).gruppe, "uns", "Neues schlägt „Wartet auf Behörde“");
  gleich([z({ zustaendig: null }).gruppe, z({ zustaendig: null }).naechster], ["uns", "Niemand führt die Akte"], "niemand zuständig → Braucht uns (wie Karte Regel 4)");
  gleich(z({ zustaendig: null, status: "offen" }).gruppe, "uns", "niemand zuständig geht vor „Zahlung offen“ (wie Karte)");
  gleich(z({ zustaendig: "Team" }).gruppe, "uns", "zuständig gesetzt → keine Sonderregel");
}

{
  const mandatSrv = datei("server/lib/fiaon-global-mandat.ts");
  ok(/AS stationen_stand/.test(mandatSrv) && /naechsteStation: naechste \? \{ schluessel: naechste\.schluessel, titel: globalSchrittTitel\(naechste\.schluessel, "de"\), status: naechste\.status \}/.test(mandatSrv),
    "Liste (globalMandateListe) trägt die nächste Station — dieselbe Rechnung naechsteStation wie die Karte");
}

// ═══ C INVENTAR ═══════════════════════════════════════════════════════════════
abschnitt("C Inventar: jede Funktion hat einen Einstieg");
const neuRaum = datei("client/src/components/admin/ChefGlobalKunden.tsx");
const teile = datei("client/src/components/admin/chef-global-kunden-teile.tsx");
const beide = neuRaum + "\n" + teile;
const alt = datei("client/src/components/admin/ChefGlobal.tsx");
const EINSTIEG: [string, RegExp][] = [
  ["Liste lesen (60 s nachladen)", /useDaten<Liste>\("\/chef\/global\/mandate", \[\], NACHLADEN_MS\)/],
  ["Akte lesen (60 s nachladen)", /useDaten<[^>]*>\(`\/chef\/global\/mandate\/\$\{r\}`, \[\], NACHLADEN_MS\)/],
  ["Kennzahlen (aktiv, Zahlung offen, neu, Unterschriften, Fristen 30)", /k\.aktiv[\s\S]*k\.zahlungOffen[\s\S]*k\.unterschriftenOffen[\s\S]*k\.fristen30/],
  ["Tests zeigen/ausblenden", /setTests\(/],
  ["Angebote in Arbeit + Global-Akte anlegen", /\/chef\/global\/angebote\/\$\{id\}\/akte/],
  ["Kundenansicht (Vorschau)", /href=\{daten\?\.vorschauUrl\}/],
  ["Kunden-Link kopieren", /clipboard\.writeText\(kundenLink\)/],
  ["Etappe setzen (+ Satz, Mail)", /tun\("\/etappe", "POST", \{ etappe: etappeWahl, text: etappeText, mitteilen: etappeMail \}\)/],
  ["Nächster Schritt (Kunde) + bis", /tun\("\/naechster-schritt", "POST", \{ text: satz, bis: satzBis \|\| null \}\)/],
  ["Stichtag + Mail", /tun\("\/stichtag", "POST", \{ stichtag, mitteilen: stichtagMail \}\)/],
  ["Station: Status/Datum/Notiz (1 Klick)", /tun\("\/station", "POST", \{ schluessel: s\.schluessel, \.\.\.body \}\)/],
  ["Stationen-Editor (alle Werte)", /<GlobalStationen [^>]*startOffen=\{editor\.station\}/],
  ["Firmendaten inline (/station werte)", /tun\("\/station", "POST", \{ schluessel, werte: \{ \[f\.feld\]: wert \} \}\)/],
  ["ITIN anzeigen", /\/itin`, "POST"\)/],
  ["Hinweis zur Gesellschaft", /tun\("\/gesellschaft", "POST", \{ plus: \{ hinweis \} \}\)/],
  ["Zuständigkeit festlegen", /tun\("\/zustaendig", "POST", \{ agentId: Number\(wahl\) \}\)/],
  ["Dokument ablegen (Tresor/Post, sichtbar, Unterschrift, Mail)", /tun\("\/dokument", "POST", f\)/],
  ["Alle als gesehen", /tun\("\/gesehen", "POST"\)/],
  ["Dokument öffnen = gesehen (+ leise nachladen)", /onClick=\{\(\) => geoeffnet\(d\)\}/],
  ["Art ändern", /\{ art: e\.target\.value \}/],
  ["Bitte neu (Grund)", /\{ ablehnen: grund\.trim\(\) \}/],
  ["Bitte neu zurücknehmen", /\{ ablehnungZurueck: true \}/],
  ["Freigeben / intern", /\{ sichtbar: !d\.sichtbarFuerKunde \}/],
  ["Unterschrift anfordern / zurück", /\{ unterschrift: !d\.unterschrift\?\.gefordert \}/],
  ["Dokument entfernen", /tun\(`\/dokument\/\$\{d\.id\}`, "DELETE"\)/],
  ["Pflichtformular hochladen (SS-4/8821/weitere)", /fd\.append\("pflichtKey", hoch\.key\)/],
  ["Scan im Namen des Kunden", /\/dokument\/\$\{hoch\.scanFuer\}\/scan/],
  ["Akte als ZIP", /href=\{daten\.zipUrl\}/],
  ["Formulare erzeugen (GlobalFormulare)", /<GlobalFormulare basis=/],
  ["Antworten (+ Mail)", /tun\("\/antwort", "POST", \{ text, mitteilen: mail \}\)/],
  ["Nachrichten gelesen (beim Öffnen)", /\/anfragen-gelesen`, "POST"\)/],
  ["Rechnungen der Person + Verträge", /\/chef\/global\/mandate\/\$\{r\}\/akte`/],
  ["Leistungen lesen", /\/chef\/global\/mandate\/\$\{r\}\/zusatz`/],
  ["Leistung bezahlt/aktiv/storniert", /tun\(`\/zusatz\/\$\{id\}\/status`, "POST", \{ status, notiz/],
  ["Kapital anlegen/ändern", /tun\("\/kapital", "POST", form\)/],
  ["Kapital entfernen", /tun\(`\/kapital\/\$\{k\.id\}`, "DELETE"\)/],
  ["Frist anlegen", /tun\("\/frist", "POST", \{ titel, faelligAm: faellig, hinweis \}\)/],
  ["Frist erledigt/offen", /tun\(`\/frist\/\$\{f\.id\}`, "POST", \{ erledigt: !f\.erledigt \}\)/],
  ["Frist löschen", /tun\(`\/frist\/\$\{f\.id\}`, "DELETE"\)/],
  ["Notiz (intern/sichtbar)", /tun\("\/notiz", "POST", \{ text, sichtbar \}\)/],
  ["Verlauf", /m\.intern\?\.verlaufAlles/],
  ["Portal freischalten / zurück", /tun\("\/portal", "POST", \{ an \}\)/],
  ["Link per Mail senden", /tun\("\/zugang-senden", "POST"\)/],
  ["Test-Markierung", /tun\("\/test", "POST", \{ an: !m\.test \}\)/],
  ["KI-Gespräche", /\/chef\/global\/mandate\/\$\{encodeURIComponent\(gref\)\}\/fach`/],
  ["Einstellungen (Gespräche je Tag, Google, Zusatz-Freigabe)", /<ChefGlobalEinstellungen \/>/],
  ["Kundenzugänge einladen", /<ChefGlobalZugaenge \/>/],
  ["Personenakte-Link", /href=\{`\/akte\/\$\{m\.person\.id\}`\}/],
  ["Vertrag/Rechnung-PDF", /m\.vertragUrl[\s\S]*m\.rechnungUrl/],
  ["Nachweise aus dem Angebot (Weg)", /\/chef\/s\/global-auftraege\?reiter=angebote/],
  ["Alte Ansicht", /\/chef\/global\?mandat=/],
  ["Menü-Zahl sofort nachladen", /dispatchEvent\(new Event\("chef-global-geaendert"\)\)/],
  ["Rundgang des Raums", /<Rundgang raum="chef-global-kunden"/],
];
for (const [was, re] of EINSTIEG) ok(re.test(beide), `Einstieg: ${was}`);
// Jeder Schreibweg des alten Raums kommt im neuen vor.
const altePfade = Array.from(new Set(Array.from(alt.matchAll(/tun\(\s*[`"](\/[a-z-]+)/g)).map((x) => x[1]))).sort();
const fehlend = altePfade.filter((p) => !beide.includes(`"${p}"`) && !beide.includes(`\`${p}/`) && !beide.includes(`\`${p}`) && !beide.includes(`${p}\``));
ok(altePfade.length >= 14 && fehlend.length === 0, `alle ${altePfade.length} Schreibwege des alten Raums sind im neuen erreichbar`, fehlend.join(", "));

// ═══ D RAUM ═══════════════════════════════════════════════════════════════════
abschnitt("D Raum, Menü, alter Raum unverändert");
const shell = datei("client/src/components/admin/ChefShell.tsx");
const chef = datei("client/src/pages/chef.tsx");
const iKunden = shell.indexOf('key: "global-kunden"'); const iMandate = shell.indexOf('key: "global", label: "Global-Mandate"');
ok(iKunden > 0 && iMandate > iKunden, "Raum „Global-Kunden“ steht in FIAON Global VOR „Global-Mandate“ (oben in der Gruppe)");
ok(/key: "global-kunden", label: "Global-Kunden", Icon: \w+, mindest: "leitung", gruppe: "global"/.test(shell), "Stufe Leitung wie Global-Mandate");
ok(/r\.key === "global-kunden" && globalNeu > 0 && \(\s*<em className="cb-zahl"/.test(shell), "Menü-Zahl (E-451) auch am neuen Punkt");
ok(/r\.key === "global" && globalNeu > 0 && \(\s*<em className="cb-zahl"/.test(shell), "Menü-Zahl am alten Punkt bleibt");
ok(/const allein = CHEF_RAEUME\.filter\(\(x\) => x\.gruppe === r\.gruppe && !x\.nebenraum\)\.length === 1;/.test(shell) && /gruppe: "global", nebenraum: true,/.test(shell),
  "Gegenprüfung 1: „allein“ zählt nur den Nebenraum Global-Kunden nicht mit");
// Für jede Gruppe außer „global“: „allein“ je Raum wie auf origin/main (Räume aus dem Quelltext gelesen).
function raeumeAus(src: string): { key: string; gruppe: string; neben: boolean }[] {
  const block = src.slice(src.indexOf("export const CHEF_RAEUME"), src.indexOf("];", src.indexOf("export const CHEF_RAEUME")));
  return Array.from(block.matchAll(/key: "([^"]+)", label: "[^"]*", Icon: \w+, mindest: "\w+", gruppe: "(\w+)"(, nebenraum: true)?/g)).map((x) => ({ key: x[1], gruppe: x[2], neben: !!x[3] }));
}
const alleinJe = (rs: { key: string; gruppe: string; neben: boolean }[], mitNeben: boolean) =>
  Object.fromEntries(rs.map((r) => [r.key, rs.filter((x) => x.gruppe === r.gruppe && (mitNeben || !x.neben)).length === 1]));
const shellMain = (() => { try { return execSync("git show origin/main:client/src/components/admin/ChefShell.tsx", { cwd: WURZEL, encoding: "utf8", maxBuffer: 1 << 24 }); } catch { return ""; } })();
const raeumeJetzt = raeumeAus(shell); const raeumeMain = raeumeAus(shellMain);
ok(raeumeJetzt.length >= 15 && raeumeMain.length >= 14, `Räume aus dem Quelltext gelesen (jetzt ${raeumeJetzt.length}, main ${raeumeMain.length})`);
const jetzt = alleinJe(raeumeJetzt, false); const vorher = alleinJe(raeumeMain, true);
const abweichung = raeumeMain.filter((r) => r.gruppe !== "global" && jetzt[r.key] !== vorher[r.key]).map((r) => r.key);
ok(abweichung.length === 0, "Gegenprüfung 1: jede Gruppe außer „FIAON Global“ klappt auf wie auf origin/main", abweichung.join(", "));
ok(jetzt["global"] === true && vorher["global"] === true, "Global-Mandate bleibt „allein“ — seine Unterseiten bleiben im Menü offen");
ok(/"global-kunden": \(\) => <Suspense[^\n]*<ChefGlobalKunden \/>/.test(chef), "/chef/global-kunden zeigt den neuen Raum (lazy)");
ok(/\(!istSeite && raum\.key === "global-kunden"\)/.test(chef), "ruhige Hülle: Standbild statt Film unter der Tafel");
ok(/global: \(\) => <Suspense[^\n]*<ChefGlobal \/>/.test(chef), "/chef/global zeigt weiter den alten Raum");
gleich(globalChefMandatPfad("AB-1"), "/chef/global?mandat=AB-1", "Aufgaben-Links bleiben auf dem alten Raum");
const diffAlt = (() => { try { return execSync("git diff --stat origin/main -- client/src/components/admin/ChefGlobal.tsx client/src/styles/chef-global-raum.css server/routes/ shared/fiaon-global-wege.ts", { cwd: WURZEL, encoding: "utf8" }).trim(); } catch { return "?"; } })();
gleich(diffAlt, "", "alter Raum, Server-Routen und Aufgaben-Wege unverändert gegenüber origin/main");
const diffLib = (() => { try { return execSync("git diff -U0 origin/main -- server/", { cwd: WURZEL, encoding: "utf8" }); } catch { return "?"; } })();
const libDateien = Array.from(diffLib.matchAll(/^\+\+\+ b\/(.+)$/gm)).map((x) => x[1]);
const libWeg = diffLib.split("\n").filter((z) => /^-(?!--)/.test(z));
ok(JSON.stringify(libDateien) === JSON.stringify(["server/lib/fiaon-global-mandat.ts"]) && libWeg.length === 1 && /schritte_bedarf$/.test(libWeg[0]),
  "Server: nur globalMandateListe ergänzt (ein Feld mehr, keine Zeile anders außer dem Komma)", `${libDateien.join(",")} · ${libWeg.join(" | ")}`);
const rund = datei("client/src/pages/agent/rundgaenge.ts");
ok(/chefGlobalKunden: \{ titel: "Global-Kunden", schritte: RUNDGANG_CHEF_GLOBAL_KUNDEN \}/.test(rund), "eigener Rundgang eingetragen");
const ziele = Array.from(rund.slice(rund.indexOf("RUNDGANG_CHEF_GLOBAL_KUNDEN: RundgangSchritt[]"), rund.indexOf("// ── /agent/global (17.09.2026")).matchAll(/ziel: "([^"]+)"/g)).map((x) => x[1]);
for (const z of ziele) {
  const roh = z.replace(/^\./, "").replace(/^\[data-cgn='([^']+)'\]$/, "$1");
  ok(beide.includes(roh) || datei("client/src/components/admin/chef-global-kunden-teile.tsx").includes("data-cgn={id}"), `Rundgang-Ziel „${z}“ gibt es im Raum`);
}
// Gegenprüfung 2/3/5/8
ok(/f\.art === "itin" && !wert\.trim\(\)\) \{ setFehler\("Bitte die neue ITIN eingeben — leer lassen löscht sie nicht\."\); return; \}/.test(teile), "Gegenprüfung 2: leeres ITIN-Feld löscht nicht");
ok(/const itinLoeschen = async \(\) => \{\s*if \(!window\.confirm\(/.test(teile) && /werte: \{ itin: "" \}/.test(teile), "Gegenprüfung 2: ITIN löschen nur mit eigener Rückfrage");
ok(/knopf="keiner" startRef=\{rundgangStart\}/.test(neuRaum) && /onClick=\{\(\) => rundgangStart\.current\?\.\(\)\}>Rundgang</.test(neuRaum), "Gegenprüfung 3: kein schwebender Rundgang-Knopf, leiser Link im Kopf");
for (const [was, re, src] of [
  ["Etappe setzen", /disabled=\{!!laeuft\} data-cgn="etappe-setzen" onClick=\{async \(\) => \{ if \(await einmal\("etappe"/, neuRaum],
  ["Satz speichern", /disabled=\{!!laeuft\} data-cgn="satz-speichern" onClick=\{async \(\) => \{ if \(await einmal\("satz"/, neuRaum],
  ["Notiz speichern", /disabled=\{text\.trim\(\)\.length < 2 \|\| laeuft\} data-cgn="notiz-speichern"[\s\S]{0,80}if \(laeuft\) return; setLaeuft\(true\)/, teile],
  ["Frist anlegen", /disabled=\{!titel \|\| !faellig \|\| laeuft\} data-cgn="frist-anlegen"[\s\S]{0,80}if \(laeuft\) return; setLaeuft\(true\)/, teile],
  ["Kapital anlegen", /const speichern = async \(\) => \{ if \(!form \|\| laeuft\) return; setLaeuft\(true\)/, teile],
] as [string, RegExp, string][]) ok(re.test(src), `Gegenprüfung 5: Doppelklick-Sperre „${was}“`);
ok(/const einmal = async \(was: "etappe" \| "satz", f: \(\) => Promise<boolean>\) => \{ if \(laeuft\) return false;/.test(neuRaum), "Sperre greift vor dem zweiten Aufruf (nicht nur über disabled)");
ok(/if \(fehler && !m\) return/.test(neuRaum) && /data-cgn="nachlade-fehler"/.test(neuRaum), "Gegenprüfung 8: misslungenes Nachladen ersetzt die Akte nicht");
ok(/flex: 1 1 auto/.test(datei("client/src/styles/chef-global-kunden.css")) && /\.cgn-filter button span \{ flex: none;/.test(datei("client/src/styles/chef-global-kunden.css")) && /text: "Wartet", titel: "Wartet auf den Kunden/.test(neuRaum),
  "Gegenprüfung 4: Filterzahl wird nie abgeschnitten (kurzes Etikett, Zahl flex: none)");
ok(/startOffen = null/.test(datei("client/src/components/global/GlobalStationen.tsx")) && /useState<string \| null>\(startOffen\)/.test(datei("client/src/components/global/GlobalStationen.tsx")), "Stationen-Editor: startOffen freiwillig (Office unverändert)");
ok(/schreibt über DIESELBEN Endpunkte|Dieselben Daten und Endpunkte/.test(beide) && !/fetch\(`\$\{API\}\/agent\//.test(beide), "nur Chef-Endpunkte (requireChef), keine Office-Wege");

// ═══ E GESTALTUNG ═════════════════════════════════════════════════════════════
abschnitt("E Gestaltung");
const css = datei("client/src/styles/chef-global-kunden.css").replace(/\/\*[\s\S]*?\*\//g, "");
/** Die festen Teile aller className-Angaben — `${…}` (auch verschachtelt) wird übersprungen, Zeichenketten darin zählen mit. */
function klassenAus(src: string): string[] {
  const aus: string[] = [];
  for (const m of src.matchAll(/className=(\{`|")/g)) {
    let i = (m.index ?? 0) + m[0].length; const ende = m[1] === '"' ? '"' : "`"; let tiefe = 0; let text = "";
    for (; i < src.length; i++) {
      const c = src[i];
      if (tiefe === 0 && c === ende) break;
      if (c === "$" && src[i + 1] === "{") { tiefe++; i++; text += " "; continue; }
      if (tiefe > 0 && c === "}") { tiefe--; continue; }
      if (tiefe > 0) { if (c === '"') { const j = src.indexOf('"', i + 1); text += ` ${src.slice(i + 1, j)} `; i = j; } continue; }
      text += c;
    }
    aus.push(...text.split(/\s+/).filter(Boolean));
  }
  return aus;
}
const klassen = klassenAus(beide);
const fremd = Array.from(new Set(klassen.filter((k) => !/^cgn-/.test(k) && !["cgn", "an", "test", "neu", "leer", "haupt", "klein", "gefahr", "leise", "kunde", "uns", "ruhe", "amt", "fiaon", "zwischen", "intern", "auf", "naechste", "gewaehlt", "zieht", "schlecht", "blau", "gruen", "rot", "mit-akte", "cl-geruest", "offen", "jetzt", "fertig", "breit", "entfaellt"].includes(k) && !/^st-/.test(k))));
ok(fremd.length === 0, "alle Klassen tragen das Präfix .cgn- (plus Zustände)", fremd.join(", "));
const cssKlassen = Array.from(css.matchAll(/\.([a-z][a-z0-9-]*)/g)).map((x) => x[1]).filter((k) => k.startsWith("cg"));
ok(cssKlassen.every((k) => k.startsWith("cgn")), "CSS: nur .cgn-Klassen");
ok(!/\.cgn[a-z-]*[^{]*\{[^}]*position:\s*(sticky|fixed)/.test(css), "nichts klebt (kein sticky/fixed)");
const gewichte = Array.from(css.matchAll(/font:\s*(\d{3})/g)).map((x) => Number(x[1]));
ok(gewichte.length > 20 && gewichte.every((g) => g <= 500), "Schrift dünn: Gewichte ≤ 500 (Augenzeilen 500, sonst 300/400)", String(Array.from(new Set(gewichte))));
ok(!/font-weight:\s*[6-9]00/.test(css) && !/fontWeight: [6-9]00/.test(beide), "kein Fett (600+)");
ok(/@media \(prefers-reduced-motion: reduce\)/.test(css), "reduzierte Bewegung beachtet");
ok(/@media \(max-width: 640px\)[\s\S]*min-height: 44px/.test(css), "Handy: Knöpfe ≥ 44 px");
ok(/\.cgn\.mit-akte \.cgn-liste \{ display: none; \}/.test(css) && /cgn-zurueck/.test(neuRaum), "Handy: Liste → Akte mit „‹ Alle Kunden“");
ok((css.match(/linear-gradient\(150deg, #12284a 0%, #0b1c36 100%\)/g) ?? []).length === 1, "Navy-Glas an genau EINER Stelle (Als Nächstes)");
ok(!/#(d4a|c9a|b8860b|ffd700|f59e0b|fbbf24|f97316)/i.test(css), "kein Gold/Orange");
ok(/#288dfa/i.test(css) && /#1d4ed8/i.test(css) && /#0b1c36/i.test(css) && /#12284a/i.test(css), "Glasblau-Paar und Navy aus dem CI");
ok(!/backdrop-filter/.test(css), "kein backdrop-filter über dem Bild (ruhig für Lüfter und Telefon)");

console.log(`\n${gut} grün, ${rot.length} rot.`);
if (rot.length) process.exit(1);
