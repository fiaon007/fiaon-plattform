// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-H (08.10.2026, Punkt 15) — DER WHATSAPP-RAUM FÜLLT DEN BILDSCHIRM
//
// Drei Teile:
//   1. OHNE Datenbank (immer): die Regeln aus shared/fiaon-wa-raum.ts, die Sicht
//      als Menge (sichtbareBetreuer ≡ eigen ∨ vertreterSiehtBetreuer, alle Fälle),
//      zielVon für Maras Übergaben, und der Quelltext (Hülle, CSS, Rundgang,
//      SQL vor der Grenze, Direktsprung).
//   2. Mit der LOKALEN Test-DB (PRUEF_DB=1): ein nachgestellter Vorlagenlauf
//      (380 Vorlagen heute) über Gespräche mit Kundenantwort von vor Tagen —
//      alt (300 jüngste, dann filtern) gegen neu (Sicht/Filter/Suche vor der
//      Grenze), Gegenprobe jeder Zeile gegen den Besitzer, Vertretung, Filter,
//      Suche, Grenze/„mehr", Vorschau gekürzt, Direktsprung 403/404, Suche
//      „Neues Gespräch", Laufzeit (EXPLAIN ANALYZE).
//   3. Im BROWSER (PRUEF_BASIS=http://127.0.0.1:5318, lokaler Server mit
//      derselben DB): Office und Chefbüro in neun Fenstergrößen — die Seite
//      rollt nicht, der Raum reicht bis zum Rand, Chatbreite, Senden nie unter
//      dem Telefonknopf, Schrift ≥ 14 px am Bildschirm, Terminleiste, drei
//      andere Office-Räume behalten den Deckel, Schiene/Fall/Schrift bleiben
//      nach dem Neuladen, ?nummer= öffnet das Gespräch, das Feld wächst.
//   Gegenprüfung (08.10.2026): Direktsprung bei SCHON offenem Raum (pushState
//   wie wouters <Link>, Zurück/Vor, Adresse ohne Nummer) und Suche im
//   Standardfilter „Mit Antwort“ nach einem Kunden, der nur eine Vorlage bekam
//   (wirksamerFilter — Oberfläche und Server mit derselben Regel).
//
// Aufruf:
//   Teil 1:   npx tsx scripts/pruef-it-h.ts
//   Teil 1+2: env -i PATH="$PATH" HOME="$HOME" PRUEF_DB=1 \
//               DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_it_h?sslmode=require' \
//               SESSION_SECRET=pruefstand-nur-lokal npx tsx scripts/pruef-it-h.ts
//   + Teil 3: zusätzlich PRUEF_BASIS=http://127.0.0.1:5318 (Server auf derselben DB, CRONS=aus)
// Eigene Datensätze tragen die Marke PRUEF-ITH und werden am Ende entfernt.
// NIE gegen die Produktion: Teil 2/3 laufen nur auf 127.0.0.1:54329.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
const MIT_DB = process.env.PRUEF_DB === "1";
const BASIS = process.env.PRUEF_BASIS || "";
if (MIT_DB || BASIS) {
  if (!/127\.0\.0\.1:54329\/(fiaon_it_h|fiaon_pruefstand)/.test(String(process.env.DATABASE_URL))) {
    console.error("Teil 2/3 NUR gegen die lokale Test-DB (127.0.0.1:54329)!"); process.exit(3);
  }
  for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "BREVO_API_KEY", "OPENAI_API_KEY", "TWILIO_AUTH_TOKEN", "MAKE_WEBHOOK_URL"]) {
    if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
  }
  process.env.CRONS = "aus";
  process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
}

// Kein Netz außer localhost.
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

const WURZEL = new URL("..", import.meta.url).pathname;
const lies = (p: string) => readFileSync(join(WURZEL, p), "utf8");

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: unknown, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 900)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const R = await import("../shared/fiaon-wa-raum");
const abw = await import("../server/lib/fiaon-abwesenheit");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1a  Filter, Grenze, Vorschau");
// ═══════════════════════════════════════════════════════════════════════════
ok("Standardfilter ist „Mit Antwort“ (Justin, 08.10.)", R.STANDARD_FILTER === "antwort" && R.LISTEN_FILTER[0].wert === "antwort" && R.LISTEN_FILTER[0].text === "Mit Antwort");
ok("„Alle“ ist der zweite Knopf (ein Klick)", R.LISTEN_FILTER[1].wert === "alle" && R.LISTEN_FILTER[1].text === "Alle");
ok("vier Filter, jeder mit Erklärung", R.LISTEN_FILTER.length === 4 && R.LISTEN_FILTER.every((f) => f.titel.length > 20));
ok("filterLesen: antwort/ungelesen/offen bleiben", ["antwort", "ungelesen", "offen"].every((f) => R.filterLesen(f) === f));
ok("filterLesen: leer, unbekannt, null, Zahl → alle (alte Oberfläche während des Deploys)",
  ["", "x", null, undefined, 3, "ANTWORT", " alle "].every((f) => R.filterLesen(f) === "alle"));
ok("filterLesen trimmt („ offen “ → offen)", R.filterLesen(" offen ") === "offen");
// Gegenprüfung (08.10.2026): Beim Suchen gilt „Mit Antwort“ nicht — die Suche läuft über alle eigenen Gespräche.
const wirksamFaelle: [unknown, unknown, string][] = [
  ["antwort", "", "antwort"], ["antwort", "   ", "antwort"], ["antwort", null, "antwort"], ["antwort", undefined, "antwort"],
  ["antwort", "Zora", "alle"], ["antwort", " Zora ", "alle"], ["antwort", "0151", "alle"], ["antwort", "%", "alle"],
  ["ungelesen", "Zora", "ungelesen"], ["offen", "Zora", "offen"], ["ungelesen", "", "ungelesen"], ["offen", "", "offen"],
  ["alle", "Zora", "alle"], ["alle", "", "alle"], ["", "Zora", "alle"], ["", "", "alle"], [null, null, "alle"], ["Quatsch", "x", "alle"],
];
for (const [f, q, soll] of wirksamFaelle) ok(`wirksamerFilter(${JSON.stringify(f)}, ${JSON.stringify(q)}) = ${soll}`, R.wirksamerFilter(f, q) === soll, R.wirksamerFilter(f, q));
ok("wirksamerFilter stimmt mit sucheZerlegen überein (Suche = Muster vorhanden)",
  ["", " ", "a", " Zora ", "y".repeat(200), "\t"].every((q) => (R.wirksamerFilter("antwort", q) === "alle") === (R.sucheZerlegen(q).muster !== null)));
const grenzen: [unknown, number][] = [[undefined, 200], ["", 200], ["abc", 200], [0, 200], [-5, 200], [10, 50], [49.9, 50], [50, 50], [200, 200], ["400", 400], [999, 999], [1000, 1000], [5000, 1000], [Infinity, 200], [NaN, 200]];
for (const [ein, aus] of grenzen) ok(`listenGrenze(${String(ein)}) = ${aus}`, R.listenGrenze(ein) === aus, R.listenGrenze(ein));
ok("LISTE_GRENZE: Start 200, Schritt 200, höchstens 1000", R.LISTE_GRENZE.start === 200 && R.LISTE_GRENZE.schritt === 200 && R.LISTE_GRENZE.max === 1000);
// Gegenprüfung (08.10.2026, niedrig): An der Höchstgrenze kein toter „Ältere Gespräche laden“ mehr.
const endeFaelle: [unknown, number, string][] = [
  [false, 200, "ende"], [false, 1000, "ende"], [undefined, 1000, "ende"], [true, 200, "mehr"], [true, 800, "mehr"], [true, 999, "mehr"], [true, 1000, "gekappt"], [true, 5000, "gekappt"],
];
for (const [m, g, soll] of endeFaelle) ok(`listenEnde(${String(m)}, ${g}) = ${soll}`, R.listenEnde(m, g) === soll, R.listenEnde(m, g));
{
  // Nachgestellt: fünfmal „Ältere laden“ ab dem Start — der Knopf verschwindet genau dann, wenn ein weiterer Klick nichts mehr holte.
  let g: number = R.LISTE_GRENZE.start; let tot = 0;
  for (let i = 0; i < 8; i++) {
    const nach = Math.min(R.LISTE_GRENZE.max, g + R.LISTE_GRENZE.schritt);
    if (R.listenEnde(true, g) === "mehr" && nach === g) tot++;
    if (R.listenEnde(true, g) !== "mehr" && nach !== g) tot++;
    g = nach;
  }
  ok("listenEnde: „mehr“ genau solange ein Klick die Grenze erhöht (kein toter Knopf)", tot === 0, tot);
}
ok("vorschauKuerzen lässt Kurzes stehen", R.vorschauKuerzen("Hallo") === "Hallo" && R.vorschauKuerzen(null) === "" && R.vorschauKuerzen(undefined) === "");
const lang = "x".repeat(600);
ok("vorschauKuerzen: 600 Zeichen → 240 mit …", R.vorschauKuerzen(lang).length === 240 && R.vorschauKuerzen(lang).endsWith("…"));
ok("vorschauKuerzen: genau 240 bleibt ungekürzt", R.vorschauKuerzen("y".repeat(240)) === "y".repeat(240));

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1b  Suche zerlegen");
// ═══════════════════════════════════════════════════════════════════════════
const s0 = R.sucheZerlegen("");
ok("leere Suche: kein Muster, keine Ziffern, kein Volltext", s0.muster === null && s0.ziffern.length === 0 && !s0.volltext && s0.text === "");
ok("nur Leerzeichen = leer", R.sucheZerlegen("   ").muster === null);
const s1 = R.sucheZerlegen("Ma");
ok("„Ma“: Namensmuster %Ma%, kein Volltext (unter 4 Zeichen)", s1.muster === "%Ma%" && !s1.volltext && s1.ziffern.length === 0);
ok("„sen“ (3 Zeichen): kein Volltext — Namenssuche bleibt leise", !R.sucheZerlegen("sen").volltext);
ok("„Rate“ (4 Zeichen): Volltext", R.sucheZerlegen("Rate").volltext);
const s2 = R.sucheZerlegen("0151 777 12345");
ok("„0151 777 12345“: Ziffern 015177712345 und 4915177712345", s2.ziffern.includes("015177712345") && s2.ziffern.includes("4915177712345"), s2);
const s3 = R.sucheZerlegen("+49 151 7771");
ok("„+49 151 7771“: Ziffern 491517771 (ohne Doppel)", s3.ziffern.length === 1 && s3.ziffern[0] === "491517771", s3);
const s4 = R.sucheZerlegen("0049 151 77");
ok("„0049 151 77“: auch ohne 00", s4.ziffern.includes("004915177") && s4.ziffern.includes("4915177"), s4);
ok("„151“: unter 4 Ziffern keine Nummernsuche", R.sucheZerlegen("151").ziffern.length === 0);
ok("„Rate 2024“: Text mit Ziffern ist keine Nummernsuche", R.sucheZerlegen("Rate 2024").ziffern.length === 0);
ok("„100%“ wird entschärft (%100\\%%)", R.sucheZerlegen("100%").muster === "%100\\%%");
ok("„a_b\\c“ wird entschärft", R.likeMaskieren("a_b\\c") === "a\\_b\\\\c");
ok("Suche höchstens 80 Zeichen", R.sucheZerlegen("y".repeat(200)).text.length === 80);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1c  Direktsprung ?nummer=");
// ═══════════════════════════════════════════════════════════════════════════
ok("raumNummer: 4915112345678 bleibt", R.raumNummer("4915112345678") === "4915112345678");
ok("raumNummer: +49 151 1234-5678 → 4915112345678", R.raumNummer("+49 151 1234-5678") === "4915112345678");
ok("raumNummer: zu kurz/zu lang/führende 0/Text → null",
  [null, "", "1234567", "1234567890123456", "015112345678", "abc", "49151x2345678"].every((x) => R.raumNummer(x) === null));
ok("nummerAusAdresse: ?nummer=4915112345678", R.nummerAusAdresse("?nummer=4915112345678") === "4915112345678");
ok("nummerAusAdresse: mit anderen Werten davor", R.nummerAusAdresse("?a=1&nummer=4915112345678&b=2") === "4915112345678");
ok("nummerAusAdresse: Müll/leer → null", [null, "", "?nummer=", "?nummer=abc", "?nummer=<script>", "?x=4915112345678"].every((x) => R.nummerAusAdresse(x as any) === null));
ok("raumPfad agent/chef mit Nummer", R.raumPfad("agent", "4915112345678") === "/agent/whatsapp?nummer=4915112345678" && R.raumPfad("chef", "+4915112345678") === "/chef/s/whatsapp?nummer=4915112345678");
ok("raumPfad ohne gültige Nummer: nur der Raum", R.raumPfad("agent", null) === "/agent/whatsapp" && R.raumPfad("chef", "12") === "/chef/s/whatsapp");
ok("nummerAusRaumPfad: Office und Chefbüro", R.nummerAusRaumPfad("/agent/whatsapp?nummer=4915112345678") === "4915112345678" && R.nummerAusRaumPfad("/chef/s/whatsapp?nummer=4915112345678") === "4915112345678");
ok("nummerAusRaumPfad: fremde Wege → null", ["/agent/kunden?person=5", "/agent/whatsapp", "/chef/s/mara?nummer=4915112345678", "", null].every((x) => R.nummerAusRaumPfad(x) === null));

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1d  Aufteilung des Raums und Ansicht je Mitarbeiter");
// ═══════════════════════════════════════════════════════════════════════════
ok("Modus: 759 schmal, 760 mittel, 1099 mittel, 1100 breit", R.raumModus(759) === "schmal" && R.raumModus(760) === "mittel" && R.raumModus(1099) === "mittel" && R.raumModus(1100) === "breit");
ok("Modus: 0 und negative Breiten → schmal", R.raumModus(0) === "schmal" && R.raumModus(-1) === "schmal");
const std = R.ANSICHT_STANDARD;
ok("Fall-Spalte von selbst erst ab 1400 (1399 aus, 1400 an)", !R.raumAufteilung(1399, std).fallSpalte && R.raumAufteilung(1400, std).fallSpalte);
ok("unter 1100 nie eine Fall-Spalte — auch nicht gewählt", !R.raumAufteilung(1099, { ...std, fall: true }).fallSpalte && !R.raumAufteilung(800, { ...std, fall: true }).fallSpalte);
ok("Wahl „Fall aus“ gilt auch auf großem Schirm", !R.raumAufteilung(2000, { ...std, fall: false }).fallSpalte);
ok("Wahl „Fall an“ gilt ab 1100", R.raumAufteilung(1100, { ...std, fall: true }).fallSpalte && R.raumAufteilung(1250, { ...std, fall: true }).fallSpalte);
ok("Schiene ab 760, nie am Handy", R.raumAufteilung(760, { ...std, liste: "schmal" }).listeSchmal && !R.raumAufteilung(500, { ...std, liste: "schmal" }).listeSchmal);
ok("ohne Wahl: volle Liste", !R.raumAufteilung(1600, std).listeSchmal);
ok("ansichtLesen: Müll → Standard", JSON.stringify(R.ansichtLesen(null)) === JSON.stringify(std) && JSON.stringify(R.ansichtLesen("x")) === JSON.stringify(std) && JSON.stringify(R.ansichtLesen([1])) === JSON.stringify(std));
ok("ansichtLesen: gültige Werte bleiben", JSON.stringify(R.ansichtLesen({ liste: "schmal", fall: false, schrift: "gross" })) === JSON.stringify({ liste: "schmal", fall: false, schrift: "gross" }));
ok("ansichtLesen: fall „true“ als Text zählt nicht", R.ansichtLesen({ fall: "true" }).fall === null && R.ansichtLesen({ schrift: "riesig" }).schrift === "normal");
ok("Schwellen stimmen mit dem CSS überein (760/1100/1500)", (() => {
  const css = lies("client/src/styles/whatsapp-raum.css");
  return /@container wr \(max-width: 759\.98px\)/.test(css) && /@container wr \(min-width: 1500px\)/.test(css)
    && R.RAUM_MASSE.mittelAb === 760 && R.RAUM_MASSE.breitAb === 1100 && R.RAUM_MASSE.grossAb === 1500;
})());
ok("Schrift größer = × 1,15 (CSS --wr-nutzer)", R.SCHRIFT_GROSS_FAKTOR === 1.15 && /\.wr-schrift-gross \{ --wr-nutzer: 1\.15; \}/.test(lies("client/src/styles/whatsapp-raum.css")));

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1e  Sicht als Menge ≡ eigen ∨ vertreterSiehtBetreuer (alle Fälle)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const v = (id: number) => ({ id, vorname: "V", name: "V", anrufName: "V", anrufDat: "V", nenn: {} as any, mitarbeiter: true });
  const bis = new Date(Date.now() + 86_400_000);
  const lagen: (abw.AktiveAbwesenheit | null)[] = [
    null,
    { vertreter: v(13), bis, fuer: [] },
    { vertreter: v(13), bis, fuer: [505] },
    { vertreter: v(13), bis, fuer: [505, 8] },
    { vertreter: v(13), bis, fuer: [13, 505] },
    { vertreter: v(505), bis, fuer: [] },
    { vertreter: v(505), bis, fuer: [13] },
  ];
  const agenten: (number | null)[] = [null, 0, 8, 10, 12, 13, 505, 999];
  const betreuer: (number | null | undefined)[] = [null, undefined, 0, 8, 10, 12, 13, 505, 999];
  let faelle = 0; const abweichung: unknown[] = [];
  for (const ab of lagen) for (const agentId of agenten) {
    if (agentId === 0) continue; // agentId 0 gibt es nicht (requireAgent); sichtFuer würde dort Kunden ohne Betreuer zeigen
    const menge = abw.sichtbareBetreuer(ab, agentId);
    for (const b of betreuer) {
      faelle++;
      const eigen = Number(b ?? 0) === agentId;
      const alt = eigen || (!!(ab && agentId && ab.vertreter.id === agentId) && abw.vertreterSiehtBetreuer(ab, agentId, b ?? null));
      const neu = abw.mengeEnthaelt(menge, b);
      if (alt !== neu) abweichung.push({ ab: ab ? { v: ab.vertreter.id, fuer: ab.fuer } : null, agentId, b, alt, neu });
    }
  }
  ok(`${faelle} Fälle: Menge und alte Regel stimmen überein`, abweichung.length === 0, abweichung.slice(0, 5));
  ok("ohne Agent: nichts", JSON.stringify(abw.sichtbareBetreuer(null, null)) === JSON.stringify({ alle: false, ids: [], ohne: false }));
  ok("Vertreter, ganzes Team weg: alle (auch ohne Betreuer)", abw.sichtbareBetreuer(lagen[1], 13).alle && abw.sichtbareBetreuer(lagen[1], 13).ohne);
  ok("Vertreter, nur 505 weg: [13, 505], ohne Betreuer nein", JSON.stringify(abw.sichtbareBetreuer(lagen[2], 13)) === JSON.stringify({ alle: false, ids: [13, 505], ohne: false }));
  ok("Nicht-Vertreter in der Abwesenheit: nur die eigenen", JSON.stringify(abw.sichtbareBetreuer(lagen[2], 505)) === JSON.stringify({ alle: false, ids: [505], ohne: false }));
  ok("Vertreter steht selbst in „fuer“: keine Doppelung", JSON.stringify(abw.sichtbareBetreuer(lagen[4], 13).ids) === JSON.stringify([13, 505]));
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1f  Maras Übergaben: zielVon führt direkt ins Gespräch");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { zielVon } = await import("../server/routes/fiaon-agent-aufgaben-popup");
  const z1 = zielVon({ link: "/agent/whatsapp?nummer=4915177700009", personId: null, ref: null, kanal: "WhatsApp" });
  ok("Office-Link mit Nummer → derselbe Weg, „WhatsApp öffnen“", z1.href === "/agent/whatsapp?nummer=4915177700009" && z1.text === "WhatsApp öffnen", z1);
  const z2 = zielVon({ link: "/chef/s/whatsapp?nummer=4915177700009", personId: null, ref: null, kanal: "WhatsApp" });
  ok("Chefbüro-Link mit Nummer → der Mitarbeiter landet in SEINEM Raum (nie /chef/…)", z2.href === "/agent/whatsapp?nummer=4915177700009" && z2.text === "WhatsApp öffnen", z2);
  const z3 = zielVon({ link: "/agent/kunden?person=77", personId: 77, ref: null, kanal: "WhatsApp" });
  ok("mit Person: weiter die Akte", z3.href === "/agent/kunden?person=77" && z3.text === "Akte öffnen", z3);
  const z4 = zielVon({ link: "/chef/s/whatsapp", personId: null, ref: null, kanal: "WhatsApp" });
  ok("alte Aufgabe ohne Nummer: wie bisher der Raum", z4.href === "/agent/whatsapp" && z4.text === "WhatsApp öffnen", z4);
  const z5 = zielVon({ link: null, personId: null, ref: null, kanal: null });
  ok("ohne alles: Aufgabenliste", z5.href === "/agent/aufgaben", z5);
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1g  Quelltext: Hülle, Raum, CSS, Rundgang, Server, Direktsprung");
// ═══════════════════════════════════════════════════════════════════════════
{
  const office = lies("client/src/styles/office.css");
  const shell = lies("client/src/pages/agent/OfficeShell.tsx");
  const seite = lies("client/src/pages/agent/whatsapp.tsx");
  const chefSeiten = lies("client/src/components/admin/chef-seiten.tsx");
  const chefShell = lies("client/src/components/admin/ChefShell.tsx");
  const chef = lies("client/src/pages/chef.tsx");
  const chefCss = lies("client/src/styles/chefbuero.css");
  const raum = lies("client/src/components/whatsapp/WhatsAppRaum.tsx");
  const liste = lies("client/src/components/whatsapp/Gespraechsliste.tsx");
  const kopf = lies("client/src/components/whatsapp/ChatKopf.tsx");
  const eingabe = lies("client/src/components/whatsapp/Eingabe.tsx");
  const css = lies("client/src/styles/whatsapp-raum.css");
  const route = lies("server/routes/fiaon-whatsapp-postfach.ts");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  const pipeline = lies("client/src/pages/agent/pipeline.tsx");
  const mara = lies("server/lib/fiaon-whatsapp-mara.ts");

  ok("Office: .of.voll ohne Deckel, Höhe = (100dvh − Terminleiste) / Zoom", /\.of\.voll\{\s*height:calc\(\(100vh - var\(--fi-erin-hoehe, 0px\)\) \/ var\(--of-zoom, 1\)\);\s*height:calc\(\(100dvh - var\(--fi-erin-hoehe, 0px\)\) \/ var\(--of-zoom, 1\)\)/.test(office)
    && /\.of\.voll \.of-grund\{[^}]*max-width:none/.test(office));
  ok("Office: kein width:100% an .of-grund (lief im Mock über)", !/\.of\.voll \.of-grund\{[^}]*width:100%/.test(office));
  ok("Office: Kette .of-inhalt → .agent-scope trägt flex/min-height:0", /\.of\.voll \.of-inhalt\{min-height:0;display:flex;flex-direction:column\}/.test(office) && /\.of\.voll \.of-inhalt>\.agent-scope\{flex:1 1 auto;min-height:0/.test(office));
  ok("Office: äußere App-Hülle ohne 100vh-Mindesthöhe in der Vollfläche", /#root:has\(\.of\.voll\)>\.min-h-screen\{min-height:0\}/.test(office));
  ok("Office: Zoom 87,5 % bleibt (Justin 24.08./08.10.)", /\.of\{\s*zoom:\.875;/.test(office));
  ok("OfficeShell: vollflaeche im Kontext, Klasse „voll“, Reset beim Ortswechsel", /vollflaeche: setVoll/.test(shell) && /\$\{voll \? " voll" : ""\}/.test(shell) && /setDunkel\(false\); setVoll\(false\);/.test(shell));
  ok("/agent/whatsapp sagt dunkel(true) UND vollflaeche(true)", /dunkel\(true\); vollflaeche\(true\);/.test(seite));
  ok("Chefbüro: nur die WhatsApp-Seite trägt vollflaeche", (chefSeiten.match(/vollflaeche: true/g) ?? []).length === 1 && /slug: "whatsapp"[^\n]*vollflaeche: true/.test(chefSeiten));
  ok("Chefbüro: chef.tsx reicht vollflaeche durch, ChefShell setzt cb-voll", /vollflaeche=\{!!seite\?\.vollflaeche/.test(chef) && /vollflaeche \? " cb-voll" : ""/.test(chefShell));
  ok("Chefbüro: .cb-voll füllt die Höhe, Kette bis .cbs-eigen", /\.cb\.cb-voll\{height:100vh;height:100dvh;min-height:0;display:flex;flex-direction:column\}/.test(chefCss) && /\.cb\.cb-voll \.cbs-huelle,\.cb\.cb-voll \.cbs-eigen\{flex:1 1 auto;min-height:0/.test(chefCss));
  ok("Raum: keine Höhenmessung mehr (var(--wr-hoehe), setProperty, raumRef, luft)", !/var\(--wr-hoehe/.test(raum + css) && !/setProperty\("--wr-hoehe"/.test(raum) && !/raumRef/.test(raum) && !/let luft/.test(raum));
  ok("Raum: Rundgang ohne festen Knopf, Chip im Kopf", /knopf="keiner" startRef=\{rundgangStart\}/.test(raum) && /rundgangStart\.current\?\.\(\)/.test(raum) && /wr-kopf-knoepfe/.test(raum));
  ok("Raum: „Schrift größer“ mit aria-pressed, auch in der Handy-Vollfläche", /aria-pressed=\{ansicht\.schrift === "gross"\}/.test(raum) && /wr-vollflaeche\$\{schriftKlasse\}/.test(raum));
  ok("Raum: Ansicht über die Helfer mit try/catch (fiaon_wa_ansicht)", /ansichtLesen\(lesen\(ANSICHT_SCHLUESSEL, \{\}\)\)/.test(raum) && /schreiben\(ANSICHT_SCHLUESSEL, ansicht\)/.test(raum) && R.ANSICHT_SCHLUESSEL === "fiaon_wa_ansicht");
  ok("Raum: Liste startet mit STANDARD_FILTER, fragt mit limit, nur die jüngste Antwort zählt", /useState<ListenFilter>\(STANDARD_FILTER\)/.test(raum) && /&limit=\$\{grenze\}/.test(raum) && /nr !== listenAnfrage\.current/.test(raum));
  ok("Raum: Suche entprellt (300 ms)", /setSucheFest\(suche\.trim\(\)\)/.test(raum) && /, 300\);/.test(raum));
  ok("Raum: Direktsprung liest ?nummer= und schreibt die Wahl in die Adresse", /nummerAusAdresse\(window\.location\.search\)/.test(raum) && /searchParams\.set\("nummer", gewaehlt\)/.test(raum) && /history\.replaceState/.test(raum));
  ok("Raum: 403/404 beim Direktsprung → zurück zur Liste", /r\.status === 403 \|\| r\.status === 404/.test(raum));
  // Gegenprüfung (08.10.2026): Der Raum hört auf die Adresse — nicht nur beim ersten Bild.
  ok("Raum: hört auf die Adresse (useSearch aus wouter)", /import \{ useSearch \} from "wouter";/.test(raum) && /const adresse = useSearch\(\);/.test(raum));
  ok("Raum: neue Adresse → ihr Gespräch (auch ohne Nummer → Liste), Abhängigkeit [adresse], keine Schleife über gewaehltRef",
    /const n = nummerAusAdresse\(adresse\);\s*if \(n !== gewaehltRef\.current\) \{ setFallOffen\(false\); setGewaehlt\(n\); \}\s*\}, \[adresse\]\);/.test(raum));
  ok("Raum: das Hören steht VOR dem Schreiben der Adresse (Reihenfolge der Effekte)", raum.indexOf("nummerAusAdresse(adresse)") > 0 && raum.indexOf("nummerAusAdresse(adresse)") < raum.indexOf('searchParams.set("nummer", gewaehlt)'));
  ok("Server: Liste fragt wirksamerFilter (Suche → alle eigenen Gespräche), kein filterLesen(opts.filter) mehr",
    /const filter = wirksamerFilter\(opts\.filter, s\.text\);/.test(route) && !/filterLesen\(opts\.filter\)/.test(route));
  ok("Liste: Knöpfe zeigen den WIRKSAMEN Filter, „Mit Antwort“ ruht beim Suchen",
    /const wirksam = wirksamerFilter\(filter, suche\);/.test(liste) && /aria-pressed=\{wirksam === f\.wert\}/.test(liste) && /const still = sucht && f\.wert === "antwort";/.test(liste) && /disabled=\{still\}/.test(liste));
  ok("Liste: Hinweis „Die Suche läuft über alle deine Gespräche“ im Filterblock (Raster aus drei Zeilen bleibt)",
    /<p className="wr-still wr-filter-hinweis">Die Suche läuft über alle deine Gespräche, auch die ohne Antwort\.<\/p>\s*\)\}\s*<\/div>/.test(liste)
    && /\.wr-filter-hinweis \{ grid-column: 1 \/ -1;/.test(css));
  ok("Liste: leere Suche unter „Ungelesen“/„Fenster offen“ bietet „In allen Gesprächen suchen“",
    /\{wirksam !== "alle" && \(/.test(liste) && /sucht \? "In allen Gesprächen suchen" : "Alle Gespräche zeigen"/.test(liste) && /Unter „\$\{filterName\}“ nichts gefunden\./.test(liste));
  ok("Liste: kein „Nichts gefunden“ mehr ohne Ausweg bei Suche + Filter (alte Bedingung „filter !== alle && !suche“ weg)", !/filter !== "alle" && !suche/.test(liste));
  ok("Raum: keine leere dritte Spur (mit-fall nur bei gewähltem Gespräch)", /const mitFall = fallSpalte && !!gewaehlt/.test(raum) && /mit-fall/.test(raum));
  ok("Liste: Schiene, «/», „Ältere Gespräche laden“, Filter aus shared", /wr-liste schmal/.test(liste) && /Liste schmal machen/.test(liste) && /Ältere Gespräche laden/.test(liste) && /LISTEN_FILTER\.map/.test(liste));
  ok("Liste: leere „Mit Antwort“-Liste bietet „Alle Gespräche zeigen“", /Alle Gespräche zeigen/.test(liste));
  ok("Raum: „mehr“/„gekappt“ über listenEnde (an der Höchstgrenze kein toter Knopf)",
    /mehr=\{listenEnde\(mehr, grenze\) === "mehr"\} gekappt=\{listenEnde\(mehr, grenze\) === "gekappt"\}/.test(raum) && !/\bmehr=\{mehr\}/.test(raum));
  ok("Liste: an der Höchstgrenze „Ältere Gespräche findest du über die Suche.“ statt „Das sind alle …“",
    /gekappt && \(\s*<p className="wr-still wr-ende">Ältere Gespräche findest du über die Suche\.<\/p>/.test(liste) && /!mehr && !gekappt && filter === STANDARD_FILTER/.test(liste));
  ok("Kopf: (i) in jeder Breite (Klasse wr-fall-knopf)", /wr-fall-knopf/.test(kopf) && /fallKnopf=\{chatDa && !!chat!\.lage\}/.test(raum));
  ok("Eingabe: Höchsthöhe 36 % der Chathöhe, höchstens 320 px — JS und CSS mit denselben Zahlen", /FELD_ANTEIL_CHAT/.test(eingabe) && /FELD_HOECHSTENS_PX/.test(eingabe)
    && R.FELD_ANTEIL_CHAT === 0.36 && R.FELD_HOECHSTENS_PX === 320 && /max-height: min\(36cqh, 320px\)/.test(css));
  const groessen = [...css.matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1].trim());
  const fest = groessen.filter((g) => !/var\(--wr-f, 1\)/.test(g) && g !== "inherit" && !/^2[26]px$/.test(g));
  ok(`CSS: alle ${groessen.length} Schriftgrößen laufen über --wr-f (außer h1)`, fest.length === 0, fest);
  ok("CSS: Blase 16 px (Office 14 px am Bildschirm), Zeile 1,5, bis 44em", /\.wr-blase \{[\s\S]*?max-width: min\(76%, 44em\)[\s\S]*?font-size: calc\(16px \* var\(--wr-f, 1\)\); line-height: 1\.5/.test(css));
  ok("CSS: Felder nie unter 16 px (iOS zoomt sonst)", (css.match(/font-size: max\(16px, calc\(16px \* var\(--wr-f, 1\)\)\)/g) ?? []).length === 3);
  ok("CSS: Spalten wachsen mit (Liste 280–380, Fall 280–360), Schiene 76 px", /--wr-liste-b: clamp\(280px, 21cqi, 380px\)/.test(css) && /--wr-fall-b: clamp\(280px, 20cqi, 360px\)/.test(css) && /\.wr-raum\.liste-schmal \{ --wr-liste-b: 76px; \}/.test(css));
  ok("CSS: Telefonknopf-Ecke statt Höhenstreifen; Pille reserviert unten", /html\.wr-telefon \.wr \{ --wr-knopf-zone: 78px; \}/.test(css) && /html\.wr-telefon:has\(\.fi-tel-pille\) \.wr \{ --wr-unten-zone: 80px; \}/.test(css)
    && /\.wr-raum:not\(\.mit-fall\) \.wr-eingabe \{ padding-right: calc\(12px \+ var\(--wr-knopf-zone, 0px\)\); \}/.test(css));
  ok("CSS: der Rundgang-Knopf wird nicht mehr verschoben (kein .ru-knopf right:88px)", !/right: 88px/.test(css));
  ok("CSS: sehr breiter Chat bleibt mittig lesbar", /@container wrchat \(min-width: 1180px\)/.test(css));
  ok("Server: Sicht, Filter und Suche VOR der Grenze (kein LIMIT 300 mehr)", !/LIMIT 300/.test(route) && /LIMIT \$\{grenze \+ 1\}/.test(route) && /= ANY\(\$\{ids\}::int\[\]\)/.test(route)
    && route.indexOf("= ANY(${ids}::int[])") < route.indexOf("LIMIT ${grenze + 1}"));
  ok("Server: Gegenprobe jeder Zeile mit sichtFuer, Abweichung wird geloggt", /Sicht-Abweichung/.test(route) && /blick\.alles \|\| sieht\(z\.assigned_agent_id \?\? z\.lead_agent \?\? null\)/.test(route));
  ok("Server: „Mit Antwort“ = der Kunde hat geschrieben (richtung = 'rein')", /\$\{filter !== "antwort"\} OR EXISTS \(SELECT 1 FROM fiaon_whatsapp x WHERE x\.nummer = l\.nummer AND x\.richtung = 'rein'\)/.test(route));
  ok("Server: Name/Nummer zuerst, Volltext ab vier Zeichen, stabile Reihenfolge (id)", /ORDER BY a\.namenstreffer DESC, a\.am DESC NULLS LAST, a\.id DESC/.test(route) && /\$\{s\.volltext\} AND EXISTS/.test(route));
  ok("Server: Antwort trägt mehr und grenze", /ok: true, gespraeche, mehr, grenze: listenGrenze\(req\.query\.limit\)/.test(route));
  ok("Server: „Neues Gespräch“-Suche filtert die Sicht VOR LIMIT 40/25", /AND \(\$\{m\.alle\} OR p\.assigned_agent_id = ANY/.test(route) && /AND \(\$\{m\.alle\} OR le\.assigned_agent_id = ANY/.test(route));
  ok("Server: herrenlose Gespräche höchstens alle 30 s nachziehen", /VERWAIST_ABSTAND_MS = 30_000/.test(route));
  ok("Server: kein stilles catch um Abfragen mehr (Hausregel p.phone)", !/LIMIT 1`\.catch\(\(\) => \[\]\)/.test(route) && !/LIMIT 25`\.catch\(\(\) => \[\]\)/.test(route) && !/gebucht\.`\}, NOW\(\)\)`\.catch\(\(\) => \{\}\)/.test(route));
  ok("Server: Direktsprung auf eine Nummer ohne Gespräch → 404 mit Klartext", /status\(404\)\.json\(\{ ok: false, error: "Mit dieser Nummer gibt es noch kein WhatsApp-Gespräch/.test(route));
  ok("Akte: Knopf „Chat im WhatsApp-Raum öffnen“ (raumPfad)", /raumPfad\("agent", stand\.nummer\)/.test(pipeline) && /Chat im WhatsApp-Raum öffnen/.test(pipeline));
  ok("Mara: Übergabe ohne Person trägt die Nummer", /raumPfad\(vt\?\.anVertreter \? "agent" : "chef", nummer\)/.test(mara));
  // Rundgang-Pflegepflicht
  const { RUNDGAENGE } = await import("../client/src/pages/agent/rundgaenge");
  const schritte = RUNDGAENGE.whatsapp.schritte;
  const klassen = lies("client/src/components/whatsapp/WhatsAppRaum.tsx") + readdirSync(join(WURZEL, "client/src/components/whatsapp")).map((f) => lies(`client/src/components/whatsapp/${f}`)).join("\n");
  for (const s of schritte.filter((x) => x.ziel)) {
    const k = String(s.ziel).replace(/^\./, "");
    ok(`Rundgang-Ziel ${s.ziel} steht im Raum`, new RegExp(`["\` ]${k}["\` $]`).test(klassen));
  }
  ok("Rundgang erklärt Schrift größer + Rundgang-Chip (Ziel .wr-kopf-knoepfe)", schritte.some((s) => s.ziel === ".wr-kopf-knoepfe" && /Schrift größer/.test(s.text)));
  ok("Rundgang: „Mehr Platz für den Chat“ OHNE Ziel (« und (i) fehlen am Handy)", schritte.some((s) => s.titel === "Mehr Platz für den Chat." && !s.ziel && /«/.test(s.text) && /\(i\)/.test(s.text)));
  ok("Rundgang: „Mit Antwort“, „Alle“ und „Ältere Gespräche laden“ an der Liste", schritte.some((s) => s.ziel === ".wr-liste" && /Mit Antwort/.test(s.text) && /„Alle“/.test(s.text) && /Ältere Gespräche laden/.test(s.tipp ?? "")));
  ok("Rundgang: „Ältere Gespräche laden“ bis 1.000, noch ältere über die Suche", schritte.some((s) => s.ziel === ".wr-liste" && /Ältere Gespräche laden“ weitere, bis 1\.000 — noch ältere findest du über die Suche/.test(s.tipp ?? "")));
  ok("Rundgang: Direktsprung aus der Akte", schritte.some((s) => /Chat im WhatsApp-Raum öffnen/.test(s.text)));
  ok("Rundgang: Direktsprung auch bei schon offenem Raum, „Zurück“ zum Gespräch davor", schritte.some((s) => /schon im Raum sitzt/.test(s.text) && /„Zurück“ im Browser zum Gespräch davor/.test(s.text)));
  ok("Rundgang: Suche auch in Gesprächen ohne Antwort, Filter beim Suchen „Alle“", schritte.some((s) => s.ziel === ".wr-liste" && /auch in denen ohne Antwort/.test(s.tipp ?? "") && /Solange du suchst, steht der Filter deshalb\s+auf „Alle“/.test((s.tipp ?? "").replace(/"\s*\+\s*"/g, ""))));
  ok("Rundgang: der Rundgang steht oben rechts (nicht mehr unten)", /oben rechts im Raum/.test(rg) && !schritte.some((s) => /unten rechts startet/.test(`${s.text} ${s.tipp ?? ""}`)));
  ok("Rundgang: Du-Form an den Mitarbeiter", schritte.every((s) => !/\bSie (können|müssen|sehen|finden)\b/.test(`${s.text} ${s.tipp ?? ""}`)));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 2 — LOKALE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
const MARKE = "PRUEF-ITH";
const PREFIX = "4915177";          // alle Prüf-Nummern beginnen so (4915177 + 6 Ziffern)
let sqlPool: any = null;
let aufraeumen: () => Promise<void> = async () => {};

if (MIT_DB || BASIS) {
  sqlPool = (await import("../server/lib/db-pool")).sqlPool;
  const wa = await import("../server/lib/fiaon-whatsapp");
  await wa.waTabellen();
  aufraeumen = async () => {
    await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE ${PREFIX + "%"} AND (text LIKE ${"%" + MARKE + "%"} OR vorlage LIKE 'fiaon_kk_%' OR von = ${MARKE})`;
    await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE ${PREFIX + "%"} AND person_id IN (SELECT id FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"})`;
    await sqlPool`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer LIKE ${PREFIX + "%"}`;
    await sqlPool`DELETE FROM fiaon_leads WHERE nachname LIKE ${MARKE + "%"}`;
    await sqlPool`DELETE FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}`;
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id IN (SELECT id FROM fiaon_agents WHERE email LIKE ${"pruef-ith-%@pruefstand.test"})`;
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id IN (SELECT id FROM fiaon_agents WHERE email LIKE ${"pruef-ith-%@pruefstand.test"})`;
    await sqlPool`DELETE FROM fiaon_agents WHERE email LIKE ${"pruef-ith-%@pruefstand.test"}`;
    await abw.abwesenheitSetzen({ an: false }, "Prüfstand E-IT-H").catch(() => null); abw.abwesenheitVergessen();
  };
}

/** Der Prüf-Mitarbeiter (Testkonto) — mit abgeschlossenem Onboarding, sonst sperrt das Gate jede /agent-Route. */
async function pruefMitarbeiter(): Promise<number> {
  const bcrypt = (await import("bcryptjs")).default;
  const [ta] = await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account, distribution_active, created_at)
    VALUES ('Prüfstand Raum (Testkonto)', 'pruef-ith-agent@pruefstand.test', ${await bcrypt.hash("pruef-ith-lokal", 10)}, 'agent', TRUE, TRUE, FALSE, NOW())
    RETURNING id`;
  const id = Number(ta.id);
  const [vorbild] = await sqlPool`SELECT agent_id FROM fiaon_agent_contracts WHERE status = 'signed' ORDER BY id LIMIT 1`;
  if (vorbild) {
    await sqlPool`INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at)
                  SELECT ${id}, doc_key, doc_version, NOW() FROM fiaon_agent_consents WHERE agent_id = ${vorbild.agent_id}`;
    await sqlPool`INSERT INTO fiaon_agent_contracts (agent_id, template_version, variables_json, rendered_html, signature_name, signature_mode, doc_hash, status)
                  SELECT ${id}, template_version, variables_json, rendered_html, signature_name, signature_mode, doc_hash, 'signed'
                    FROM fiaon_agent_contracts WHERE agent_id = ${vorbild.agent_id} AND status = 'signed' ORDER BY id DESC LIMIT 1`;
  }
  return id;
}

/** Fixture: Menschen, Nummern, Nachrichten. Gibt die Wahrheit je Nummer zurück. */
interface Soll { nummer: string; betreuer: number | null; antwort: boolean; ungelesen: boolean; offen: boolean; am: number }
async function anlegen(agentTest: number): Promise<Map<string, Soll>> {
  const soll = new Map<string, Soll>();
  let lauf = 0;
  const jetzt = Date.now();
  const nummerNeu = () => `${PREFIX}${String(100000 + lauf++).padStart(6, "0")}`;
  const person = async (betreuer: number | null, vor: string, nach: string, nummer: string) => {
    const [p] = await sqlPool`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, assigned_agent_id, updated_at)
      VALUES (${`${MARKE}-${nummer}`}, ${vor}, ${nach}, ${`+${nummer}`}, ${betreuer}, NOW()) RETURNING id`;
    return Number(p.id);
  };
  const nachricht = async (n: { nummer: string; richtung: "rein" | "raus"; text?: string | null; vorlage?: string | null; von?: string | null; am: number; personId?: number | null; leadId?: number | null }) => {
    const t = new Date(n.am).toISOString();
    await sqlPool`
      INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, lead_id, typ, text, vorlage, status, von, empfangen_am, gesendet_am, created_at)
      VALUES (${n.richtung}, ${n.nummer}, ${n.personId ?? null}, ${n.leadId ?? null}, 'text', ${n.text ?? null}, ${n.vorlage ?? null},
              ${n.richtung === "rein" ? "empfangen" : "gesendet"}, ${n.von ?? (n.richtung === "raus" ? MARKE : null)},
              ${n.richtung === "rein" ? t : null}, ${n.richtung === "raus" ? t : null}, ${t})`;
  };
  const gespraech = async (nummer: string, personId: number | null, leadId: number | null, gelesenBis: number) => {
    await sqlPool`INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, lead_id, gelesen_bis, updated_at)
                  VALUES (${nummer}, ${personId}, ${leadId}, ${gelesenBis}, NOW()) ON CONFLICT (nummer) DO NOTHING`;
  };
  const H = 3600_000, T = 24 * H;
  const maraLang = `Guten Tag, hier ist Mara von FIAON. ${"Ich melde mich wegen Ihrer Anfrage zur Kreditkarte und erkläre Ihnen gern die nächsten Schritte. ".repeat(6)}${MARKE}`;

  // Gespräche MIT Kundenantwort (vor Tagen) — sie fielen bisher aus der Liste.
  const gruppen: [number | null, number, number][] = [[505, 70, 9], [13, 40, 4], [12, 20, 6], [null, 15, 4]];
  for (const [betreuer, anzahl, tage] of gruppen) {
    for (let i = 0; i < anzahl; i++) {
      const nummer = nummerNeu();
      const pid = await person(betreuer, "Prüf", `${MARKE} ${betreuer ?? "ohne"} ${i}`, nummer);
      const am = jetzt - tage * T - i * H;
      await nachricht({ nummer, richtung: "raus", vorlage: "fiaon_kk_anfrage", von: "Mara", am: am - 2 * H, personId: pid });
      await nachricht({ nummer, richtung: "rein", text: `Hallo, ich habe eine Frage (${MARKE} ${i})`, am, personId: pid });
      await nachricht({ nummer, richtung: "raus", text: maraLang, von: "Mara Lindner", am: am + 60_000, personId: pid });
      const [maxId] = await sqlPool`SELECT MAX(id)::bigint AS id FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
      await gespraech(nummer, pid, null, Number(maxId.id));
      soll.set(nummer, { nummer, betreuer, antwort: true, ungelesen: false, offen: false, am: am + 60_000 });
    }
  }
  // Leads von 505 (ohne Person) mit Antwort.
  for (let i = 0; i < 10; i++) {
    const nummer = nummerNeu();
    const [le] = await sqlPool`INSERT INTO fiaon_leads (vorname, nachname, telefon, assigned_agent_id, erstellt_am)
                               VALUES ('Lead', ${`${MARKE} Lead ${i}`}, ${`+${nummer}`}, 505, NOW()) RETURNING id`;
    const am = jetzt - 2 * T - i * H;
    await nachricht({ nummer, richtung: "rein", text: `Lead fragt (${MARKE})`, am, leadId: Number(le.id) });
    const [maxId] = await sqlPool`SELECT MAX(id)::bigint AS id FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await gespraech(nummer, null, Number(le.id), Number(maxId.id));
    soll.set(nummer, { nummer, betreuer: 505, antwort: true, ungelesen: false, offen: false, am });
  }
  // Sonderfälle von 505: alte Volltext-Nachricht, ungelesen, Fenster offen, Name für die Suche.
  const sonder: { vor: string; nach: string; text: string; tage: number; ungelesen?: boolean }[] = [
    { vor: "Zacharias", nach: "Prüfling", text: `Ich möchte eine Ratenpause beantragen wegen Sonderwunsch (${MARKE})`, tage: 20 },
    { vor: "Ulla", nach: "Ungelesen", text: `Bitte rufen Sie mich an (${MARKE})`, tage: 12, ungelesen: true },
    { vor: "Otto", nach: "Offen", text: `Ich bin jetzt erreichbar (${MARKE})`, tage: 0.05 },
    { vor: "Frieda", nach: "Fragestein", text: `Guten Tag (${MARKE})`, tage: 30 },
  ];
  const sonderNummern: Record<string, string> = {};
  for (const sd of sonder) {
    const nummer = sd.nach === "Prüfling" ? `${PREFIX}712345` : nummerNeu();
    const pid = await person(505, sd.vor, sd.nach, nummer);
    const am = jetzt - sd.tage * T;
    await nachricht({ nummer, richtung: "raus", text: maraLang, von: "Mara Lindner", am: am - H, personId: pid });
    const [vorher] = await sqlPool`SELECT MAX(id)::bigint AS id FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await nachricht({ nummer, richtung: "rein", text: sd.text, am, personId: pid });
    const [maxId] = await sqlPool`SELECT MAX(id)::bigint AS id FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await gespraech(nummer, pid, null, sd.ungelesen ? Number(vorher.id) : Number(maxId.id));
    soll.set(nummer, { nummer, betreuer: 505, antwort: true, ungelesen: !!sd.ungelesen, offen: sd.tage * T < 24 * H, am });
    sonderNummern[sd.nach] = nummer;
  }
  // „100%" im Text eines Kunden von 13 — die Suche nach „100%" darf nicht alles treffen.
  {
    const nummer = nummerNeu();
    const pid = await person(13, "Anton", "Prozent", nummer);
    await nachricht({ nummer, richtung: "rein", text: `Ich bin mir 100% sicher (${MARKE})`, am: jetzt - 3 * T, personId: pid });
    await gespraech(nummer, pid, null, 0);
    soll.set(nummer, { nummer, betreuer: 13, antwort: true, ungelesen: true, offen: false, am: jetzt - 3 * T });
    sonderNummern.Prozent = nummer;
  }
  // DER VORLAGENLAUF: 380 Vorlagen heute, ohne Antwort — sie verdrängten bisher alles.
  const lauf380: [number | null, number][] = [[13, 130], [505, 130], [null, 120]];
  for (const [betreuer, anzahl] of lauf380) {
    for (let i = 0; i < anzahl; i++) {
      const nummer = nummerNeu();
      const pid = await person(betreuer, "Vorlage", `${MARKE} lauf ${betreuer ?? "ohne"} ${i}`, nummer);
      const am = jetzt - 30 * 60_000 - i * 20_000;
      await nachricht({ nummer, richtung: "raus", vorlage: "fiaon_kk_anfrage", text: maraLang, von: "Mara", am, personId: pid });
      await gespraech(nummer, pid, null, 0);
      soll.set(nummer, { nummer, betreuer, antwort: false, ungelesen: false, offen: false, am });
    }
  }
  // Für den Browser: Gespräche des Prüf-Mitarbeiters (lange Mara-Nachrichten, eines mit offenem Fenster).
  for (let i = 0; i < 24; i++) {
    const nummer = nummerNeu();
    // i = 1: ein zweites, benanntes Gespräch für den Direktsprung bei schon offenem Raum (Gegenprüfung).
    const pid = await person(agentTest, i === 0 ? "Fenja" : i === 1 ? "Bruno" : "Kunde", i === 0 ? "Fensteroffen" : i === 1 ? "Zweitgespraech" : `${MARKE} Browser ${i}`, nummer);
    const basis = jetzt - (i === 0 ? 0.5 * H : (i + 1) * 5 * H);
    for (let k = 0; k < 6; k++) {
      await nachricht({ nummer, richtung: "raus", text: maraLang, von: "Mara Lindner", am: basis - (12 - 2 * k) * 60_000, personId: pid });
      await nachricht({ nummer, richtung: "rein", text: `Antwort ${k} (${MARKE})`, am: basis - (11 - 2 * k) * 60_000, personId: pid });
    }
    const [maxId] = await sqlPool`SELECT MAX(id)::bigint AS id FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await gespraech(nummer, pid, null, Number(maxId.id));
    soll.set(nummer, { nummer, betreuer: agentTest, antwort: true, ungelesen: false, offen: i === 0, am: basis });
    if (i === 0) sonderNummern.Fenster = nummer;
    if (i === 1) sonderNummern.Zweit = nummer;
  }
  // Gegenprüfung (08.10.2026): Zora bekam nur eine Vorlage, geantwortet hat sie nie — die Suche im
  // Standardfilter „Mit Antwort“ fand sie nicht, und der Mitarbeiter begann ein zweites Gespräch.
  {
    const nummer = nummerNeu();
    const pid = await person(agentTest, "Zora", "Nurvorlage", nummer);
    const am = jetzt - 3 * T;
    await nachricht({ nummer, richtung: "raus", vorlage: "fiaon_kk_anfrage", text: maraLang, von: "Mara", am, personId: pid });
    await gespraech(nummer, pid, null, 0);
    soll.set(nummer, { nummer, betreuer: agentTest, antwort: false, ungelesen: false, offen: false, am });
    sonderNummern.Zora = nummer;
  }
  (soll as any).sonder = sonderNummern;
  return soll;
}

/** Die ALTE Liste (bis 07.10.): 300 jüngste Nummern im Haus, danach Sicht/Filter in JS. */
async function alteListe(agentId: number): Promise<string[]> {
  const z = await sqlPool`
    WITH letzte AS (SELECT DISTINCT ON (w.nummer) w.nummer, COALESCE(w.empfangen_am, w.gesendet_am, w.created_at) AS am, w.person_id, w.lead_id
                      FROM fiaon_whatsapp w ORDER BY w.nummer, w.id DESC)
    SELECT l.nummer, COALESCE(p.assigned_agent_id, le.assigned_agent_id) AS b,
           EXISTS (SELECT 1 FROM fiaon_whatsapp x WHERE x.nummer = l.nummer AND x.richtung = 'rein') AS antwort
      FROM letzte l LEFT JOIN fiaon_persons p ON p.id = l.person_id LEFT JOIN fiaon_leads le ON le.id = l.lead_id
     ORDER BY l.am DESC NULLS LAST LIMIT 300`;
  return z.filter((r: any) => Number(r.b ?? 0) === agentId && r.antwort).map((r: any) => String(r.nummer));
}

if (MIT_DB) {
  const express = (await import("express")).default;
  const { raumRouten } = await import("../server/routes/fiaon-whatsapp-postfach");
  let blick: { agentId: number | null; name: string; alles: boolean } = { agentId: 505, name: "Prüfstand", alles: false };
  const app = express();
  app.use(express.json());
  app.use("/raum", raumRouten(() => blick));
  const server = await new Promise<any>((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/raum`;
  const holen = async (pfad: string, als: typeof blick) => {
    blick = als;
    const r = await echtFetch(`${url}${pfad}`);
    return { status: r.status, j: await r.json().catch(() => null) as any };
  };
  const als = (agentId: number | null, alles = false) => ({ agentId, name: `Agent ${agentId}`, alles });
  const nurPruef = (l: any[]) => (l ?? []).filter((g: any) => String(g.nummer).startsWith(PREFIX));

  try {
    await aufraeumen();
    const AGENT_TEST = await pruefMitarbeiter();
    const soll = await anlegen(AGENT_TEST);
    const sonder = (soll as any).sonder as Record<string, string>;
    const wahrheit = (agent: number, f: (s: Soll) => boolean = () => true) =>
      [...soll.values()].filter((s) => s.betreuer === agent && f(s)).map((s) => s.nummer).sort();

    abschnitt("2a  Der Vorlagenlauf verdrängt nichts mehr (alt gegen neu)");
    for (const agent of [505, 13, 12]) {
      const alt = (await alteListe(agent)).filter((n) => n.startsWith(PREFIX));
      const { j } = await holen(`/gespraeche?filter=antwort&limit=1000`, als(agent));
      const neu = nurPruef(j?.gespraeche).map((g: any) => g.nummer).sort();
      const soll1 = wahrheit(agent, (s) => s.antwort);
      ok(`Agent ${agent}: alt ${alt.length}, neu ${neu.length}, Soll ${soll1.length} (Gespräche mit Kundenantwort)`, JSON.stringify(neu) === JSON.stringify(soll1), { alt: alt.length, neu: neu.length, soll: soll1.length });
      ok(`Agent ${agent}: die alte Liste verlor Gespräche (Rot-Probe des Befunds)`, alt.length < soll1.length, { alt: alt.length, soll: soll1.length });
    }

    abschnitt("2b  Gegenprobe: keine fremden Kunden");
    for (const agent of [505, 13, 12, AGENT_TEST]) {
      for (const filter of ["antwort", "alle", "ungelesen", "offen"]) {
        const { j } = await holen(`/gespraeche?filter=${filter}&limit=1000`, als(agent));
        const fremd = nurPruef(j?.gespraeche).filter((g: any) => soll.get(g.nummer)?.betreuer !== agent);
        ok(`Agent ${agent}, Filter ${filter}: nur eigene (${nurPruef(j?.gespraeche).length} Zeilen)`, j?.ok && fremd.length === 0, fremd.slice(0, 3).map((g: any) => g.nummer));
      }
    }
    {
      const { j } = await holen(`/gespraeche?filter=alle&limit=1000`, als(null));
      ok("Agent ohne ID sieht nichts", j?.ok && nurPruef(j.gespraeche).length === 0, j?.gespraeche?.length);
      const { j: l } = await holen(`/gespraeche?filter=alle&limit=1000`, als(null, true));
      ok(`Leitung (alles) sieht alle ${soll.size} Prüf-Gespräche`, nurPruef(l?.gespraeche).length === soll.size, nurPruef(l?.gespraeche).length);
      const ohne = nurPruef(l?.gespraeche).filter((g: any) => soll.get(g.nummer)?.betreuer === null).length;
      ok("… darunter die ohne Betreuer (nur die Leitung)", ohne === [...soll.values()].filter((s) => s.betreuer === null).length, ohne);
    }

    abschnitt("2c  Vertretung: 13 vertritt 505 — dieselbe Menge wie sichtFuer");
    {
      const bis = new Date(Date.now() + 2 * 86_400_000);
      const bisText = `${bis.toISOString().slice(0, 10)} 18:00`;
      const r1 = await abw.abwesenheitSetzen({ an: true, bis: bisText, vertreterId: 13, fuer: [505] }, "Prüfstand E-IT-H"); abw.abwesenheitVergessen();
      ok("Abwesenheit gesetzt (13 vertritt 505)", r1.ok, r1.fehler);
      const { j } = await holen(`/gespraeche?filter=alle&limit=1000`, als(13));
      const neu = nurPruef(j?.gespraeche).map((g: any) => g.nummer).sort();
      const soll2 = [...soll.values()].filter((s) => s.betreuer === 13 || s.betreuer === 505).map((s) => s.nummer).sort();
      ok(`13 sieht seine + die von 505 (${neu.length} von ${soll2.length}), nicht 12, nicht ohne Betreuer`, JSON.stringify(neu) === JSON.stringify(soll2), { neu: neu.length, soll: soll2.length });
      const { j: j505 } = await holen(`/gespraeche?filter=alle&limit=1000`, als(505));
      ok("505 selbst sieht weiter nur die eigenen", nurPruef(j505?.gespraeche).every((g: any) => soll.get(g.nummer)?.betreuer === 505));
      const r2 = await abw.abwesenheitSetzen({ an: true, bis: bisText, vertreterId: 13, fuer: [] }, "Prüfstand E-IT-H"); abw.abwesenheitVergessen();
      const { j: jAlle } = await holen(`/gespraeche?filter=alle&limit=1000`, als(13));
      ok(`ganzes Team weg: 13 sieht alle ${soll.size} (auch ohne Betreuer)`, r2.ok && nurPruef(jAlle?.gespraeche).length === soll.size, nurPruef(jAlle?.gespraeche).length);
      await abw.abwesenheitSetzen({ an: false }, "Prüfstand E-IT-H"); abw.abwesenheitVergessen();
      const { j: jZurueck } = await holen(`/gespraeche?filter=alle&limit=1000`, als(13));
      ok("Abwesenheit aus: 13 wieder nur die eigenen", nurPruef(jZurueck?.gespraeche).every((g: any) => soll.get(g.nummer)?.betreuer === 13));
    }

    abschnitt("2d  Filter, Reihenfolge, Grenze, Vorschau");
    {
      const { j: alle } = await holen(`/gespraeche?filter=alle&limit=1000`, als(505));
      const { j: antw } = await holen(`/gespraeche?filter=antwort&limit=1000`, als(505));
      ok("„Alle“ enthält die Vorlagen ohne Antwort, „Mit Antwort“ nicht",
        nurPruef(alle?.gespraeche).length === wahrheit(505).length && nurPruef(antw?.gespraeche).every((g: any) => soll.get(g.nummer)?.antwort), { alle: nurPruef(alle?.gespraeche).length, soll: wahrheit(505).length });
      const { j: leer } = await holen(`/gespraeche?filter=&limit=1000`, als(505));
      ok("leerer Filter (alte Oberfläche) = „Alle“", nurPruef(leer?.gespraeche).length === nurPruef(alle?.gespraeche).length);
      const { j: ung } = await holen(`/gespraeche?filter=ungelesen&limit=1000`, als(505));
      ok("„Ungelesen“: genau Ulla Ungelesen (12 Tage alt — fiel vorher nach dem Lauf heraus)", JSON.stringify(nurPruef(ung?.gespraeche).map((g: any) => g.nummer)) === JSON.stringify([sonder.Ungelesen]), nurPruef(ung?.gespraeche).map((g: any) => g.name));
      ok("… mit Zähler 1", nurPruef(ung?.gespraeche)[0]?.ungelesen === 1);
      const { j: off } = await holen(`/gespraeche?filter=offen&limit=1000`, als(505));
      ok("„Fenster offen“: genau Otto Offen", JSON.stringify(nurPruef(off?.gespraeche).map((g: any) => g.nummer)) === JSON.stringify([sonder.Offen]) && !!nurPruef(off?.gespraeche)[0]?.fensterBis);
      const zeiten = nurPruef(alle?.gespraeche).map((g: any) => new Date(g.letzte.am).getTime());
      ok("ohne Suche: nach letzter Nachricht absteigend", zeiten.every((t: number, i: number) => i === 0 || zeiten[i - 1] >= t));
      const { j: g50 } = await holen(`/gespraeche?filter=alle&limit=50`, als(505));
      ok("limit=50: 50 Zeilen, mehr = true", g50?.gespraeche?.length === 50 && g50?.mehr === true && g50?.grenze === 50, { n: g50?.gespraeche?.length, mehr: g50?.mehr });
      const { j: g7 } = await holen(`/gespraeche?filter=alle&limit=7`, als(505));
      ok("limit=7 → auf 50 angehoben", g7?.gespraeche?.length === 50 && g7?.grenze === 50);
      const { j: gx } = await holen(`/gespraeche?filter=alle&limit=abc`, als(505));
      ok("limit=abc → 200 (Start)", gx?.grenze === 200 && gx?.gespraeche?.length === Math.min(200, alle.gespraeche.length), { grenze: gx?.grenze, n: gx?.gespraeche?.length });
      const { j: g1000 } = await holen(`/gespraeche?filter=alle&limit=1000`, als(505));
      ok("limit=1000: alles da, mehr = false", g1000?.mehr === false);
      const { j: gross } = await holen(`/gespraeche?filter=alle&limit=1000`, als(null, true));
      ok("Leitung, limit=1000 bei > 500 Gesprächen: Vorschau je Zeile höchstens 240 Zeichen", gross?.gespraeche?.length > 500 && gross.gespraeche.every((g: any) => String(g.letzte.text).length <= 240), gross?.gespraeche?.length);
      const ersteSeite = (await holen(`/gespraeche?filter=alle&limit=200`, als(null, true))).j;
      const zweite = (await holen(`/gespraeche?filter=alle&limit=400`, als(null, true))).j;
      ok("„Ältere laden“ (200 → 400): die ersten 200 bleiben dieselben, in derselben Reihenfolge",
        JSON.stringify(ersteSeite.gespraeche.map((g: any) => g.nummer)) === JSON.stringify(zweite.gespraeche.slice(0, 200).map((g: any) => g.nummer)) && zweite.gespraeche.length === 400);
    }

    abschnitt("2e  Suche — vor der Grenze, Name zuerst, Volltext ab vier Zeichen");
    {
      const { j: s1 } = await holen(`/gespraeche?filter=alle&limit=50&suche=${encodeURIComponent("Ratenpause")}`, als(505));
      ok("Volltext „Ratenpause“ findet das Gespräch vor 20 Tagen (bisher unauffindbar)", nurPruef(s1?.gespraeche).some((g: any) => g.nummer === sonder.Prüfling), nurPruef(s1?.gespraeche).map((g: any) => g.name));
      const { j: s2 } = await holen(`/gespraeche?filter=alle&limit=50&suche=${encodeURIComponent("Rat")}`, als(505));
      ok("„Rat“ (3 Zeichen) sucht nicht im Text", !nurPruef(s2?.gespraeche).some((g: any) => g.nummer === sonder.Prüfling));
      const { j: s3 } = await holen(`/gespraeche?filter=antwort&limit=50&suche=${encodeURIComponent("prüfling")}`, als(505));
      ok("Name „prüfling“ (klein) findet Zacharias Prüfling", nurPruef(s3?.gespraeche).length === 1 && nurPruef(s3?.gespraeche)[0].nummer === sonder.Prüfling);
      const { j: s4 } = await holen(`/gespraeche?filter=alle&limit=50&suche=${encodeURIComponent("0151 777 12345")}`, als(505));
      ok("Nummer in deutscher Schreibweise „0151 777 12345“ findet +49 151 77712345", nurPruef(s4?.gespraeche).some((g: any) => g.nummer === sonder.Prüfling), nurPruef(s4?.gespraeche).length);
      const { j: s5 } = await holen(`/gespraeche?filter=alle&limit=50&suche=${encodeURIComponent("Ratenpause")}`, als(13));
      ok("dieselbe Suche als Agent 13: nichts (fremder Kunde)", !nurPruef(s5?.gespraeche).some((g: any) => g.nummer === sonder.Prüfling));
      const { j: s6 } = await holen(`/gespraeche?filter=alle&limit=1000&suche=${encodeURIComponent("100%")}`, als(13));
      ok("„100%“ findet nur Anton Prozent (das % wird nicht zum Joker)", nurPruef(s6?.gespraeche).length === 1 && nurPruef(s6?.gespraeche)[0].nummer === sonder.Prozent, nurPruef(s6?.gespraeche).length);
      // „Frage": Frieda Fragestein (Name, 30 Tage alt) steht VOR den 70 jüngeren Texttreffern „… eine Frage …".
      const { j: s7 } = await holen(`/gespraeche?filter=alle&limit=1000&suche=${encodeURIComponent("Frage")}`, als(505));
      const t7 = nurPruef(s7?.gespraeche);
      ok(`„Frage“: der Namenstreffer (30 Tage alt) steht vor ${t7.length - 1} jüngeren Texttreffern`, t7.length >= 71 && t7[0]?.nummer === sonder.Fragestein, t7.slice(0, 2).map((g: any) => g.name));
      const t7zeit = t7.slice(1).map((g: any) => new Date(g.letzte.am).getTime());
      ok("… die Texttreffer danach nach Zeit absteigend", t7zeit.every((t: number, i: number) => i === 0 || t7zeit[i - 1] >= t));
      const { j: s8 } = await holen(`/gespraeche?filter=alle&limit=50&suche=${encodeURIComponent("Sonderwunsch")}`, als(null, true));
      ok("Leitung: Volltext über alle Gespräche", nurPruef(s8?.gespraeche).some((g: any) => g.nummer === sonder.Prüfling));
    }

    abschnitt("2e2 Gegenprüfung: Suche im Standard „Mit Antwort“ findet auch Kunden ohne Antwort");
    {
      const T_ = AGENT_TEST;
      const { j: ohne } = await holen(`/gespraeche?filter=antwort&limit=1000`, als(T_));
      ok("ohne Suche: „Mit Antwort“ zeigt Zora (nur Vorlage) NICHT", !nurPruef(ohne?.gespraeche).some((g: any) => g.nummer === sonder.Zora));
      for (const q of ["Zora", "zora", "Nurvorlage", "Zora Nurvorlage", sonder.Zora.slice(-6)]) {
        const { j } = await holen(`/gespraeche?filter=antwort&limit=50&suche=${encodeURIComponent(q)}`, als(T_));
        const t = nurPruef(j?.gespraeche);
        ok(`„Mit Antwort“ + Suche „${q}“ findet Zora (vorher 0 Treffer)`, t.length === 1 && t[0].nummer === sonder.Zora, t.map((g: any) => g.name));
      }
      const { j: jAlle } = await holen(`/gespraeche?filter=alle&limit=50&suche=Zora`, als(T_));
      ok("„Alle“ + Suche „Zora“: dasselbe Ergebnis", nurPruef(jAlle?.gespraeche).length === 1 && nurPruef(jAlle?.gespraeche)[0].nummer === sonder.Zora);
      const { j: jUng } = await holen(`/gespraeche?filter=ungelesen&limit=50&suche=Zora`, als(T_));
      ok("„Ungelesen“ + Suche „Zora“: bewusst gewählter Filter gilt weiter (0 Treffer, die Liste bietet „In allen suchen“)", jUng?.ok && nurPruef(jUng?.gespraeche).length === 0);
      const { j: jOff } = await holen(`/gespraeche?filter=offen&limit=50&suche=Zora`, als(T_));
      ok("„Fenster offen“ + Suche „Zora“: 0 Treffer", jOff?.ok && nurPruef(jOff?.gespraeche).length === 0);
      const { j: jFremd } = await holen(`/gespraeche?filter=antwort&limit=50&suche=Zora`, als(505));
      ok("Agent 505 sucht „Zora“: nichts (fremder Kunde — die Sicht bleibt)", !nurPruef(jFremd?.gespraeche).some((g: any) => g.nummer === sonder.Zora));
      // Rot-Probe in groß: 130 Vorlagen-Kunden von 505 — vorher fand „lauf 505“ im Standard keinen davon.
      const { j: jLauf } = await holen(`/gespraeche?filter=antwort&limit=1000&suche=${encodeURIComponent("lauf 505")}`, als(505));
      const lauf = nurPruef(jLauf?.gespraeche);
      const sollLauf = wahrheit(505, (x) => !x.antwort).length;
      ok(`„Mit Antwort“ + Suche „lauf 505“: alle ${sollLauf} Vorlagen-Kunden von 505, keiner mit Antwort`, lauf.length === sollLauf && lauf.every((g: any) => soll.get(g.nummer)?.antwort === false), { n: lauf.length, soll: sollLauf });
      const { j: jFragestein } = await holen(`/gespraeche?filter=antwort&limit=1000&suche=Frage`, als(505));
      ok("Suche „Frage“: der Namenstreffer bleibt vorn", nurPruef(jFragestein?.gespraeche)[0]?.nummer === sonder.Fragestein);
      const { j: jLeer } = await holen(`/gespraeche?filter=antwort&limit=1000&suche=${encodeURIComponent("   ")}`, als(505));
      ok("Suche nur aus Leerzeichen = keine Suche: „Mit Antwort“ gilt", nurPruef(jLeer?.gespraeche).every((g: any) => soll.get(g.nummer)?.antwort));
    }

    abschnitt("2f  Direktsprung: Gespräch öffnen, fremd, unbekannt");
    {
      const eigen = await holen(`/gespraech/${sonder.Prüfling}`, als(505));
      ok("eigenes Gespräch: 200 mit Verlauf", eigen.status === 200 && eigen.j?.ok && eigen.j.verlauf.length >= 2, eigen.status);
      const fremd = await holen(`/gespraech/${sonder.Prüfling}`, als(13));
      ok("fremdes Gespräch: 403 „gehört einem anderen Betreuer“, ohne Inhalt", fremd.status === 403 && !fremd.j?.verlauf && /anderen Betreuer/.test(fremd.j?.error), fremd);
      const unbekannt = await holen(`/gespraech/4915177999999`, als(505));
      ok("Nummer ohne Gespräch: 404 mit Klartext (Du-Form)", unbekannt.status === 404 && /noch kein WhatsApp-Gespräch/.test(unbekannt.j?.error) && /beginnst du/.test(unbekannt.j?.error), unbekannt);
      const leitung = await holen(`/gespraech/4915177999999`, als(null, true));
      ok("Leitung: leere Nummer öffnet (zum Beginnen mit Vorlage)", leitung.status === 200 && leitung.j?.ok && leitung.j.verlauf.length === 0, leitung.status);
      const muell = await holen(`/gespraech/abc`, als(505));
      ok("Müll-Nummer: 400", muell.status === 400);
    }

    abschnitt("2g  „Neues Gespräch“: Suche filtert die Sicht vor LIMIT 40");
    {
      // 45 jüngere „Anton…" bei Agent 12, 3 bei 505 — vorher kappte LIMIT 40 die von 505 weg.
      for (let i = 0; i < 45; i++) await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, assigned_agent_id, updated_at)
        VALUES (${`${MARKE}-suche12-${i}`}, 'Antonella', ${`${MARKE}S ${i}`}, ${`+49151777${String(800000 + i)}`}, 12, NOW())`;
      for (let i = 0; i < 3; i++) await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, assigned_agent_id, updated_at)
        VALUES (${`${MARKE}-suche505-${i}`}, 'Antonella', ${`${MARKE}S505 ${i}`}, ${`+49151777${String(900000 + i)}`}, 505, NOW() - INTERVAL '1 day')`;
      const { j } = await holen(`/suche?q=Antonella`, als(505));
      const eigene = (j?.treffer ?? []).filter((t: any) => /S505/.test(t.name));
      ok("505 findet seine drei „Antonella“ (vorher 0 von 3)", eigene.length === 3, j?.treffer?.map((t: any) => t.name));
      ok("… und keine fremden", (j?.treffer ?? []).every((t: any) => /S505/.test(t.name) || !/Antonella/.test(t.name)));
      const { j: l } = await holen(`/suche?q=Antonella`, als(null, true));
      ok("Leitung: höchstens 20 Treffer wie bisher", (l?.treffer ?? []).length === 20, l?.treffer?.length);
    }

    abschnitt("2h  Laufzeit (Route, Leitung, limit 1000)");
    {
      const t0 = Date.now();
      const { j } = await holen(`/gespraeche?filter=alle&limit=1000`, als(null, true));
      const ms = Date.now() - t0;
      ok(`Liste mit ${j?.gespraeche?.length} Zeilen in ${ms} ms (Route, lokal) unter 1.500 ms`, ms < 1500, ms);
      const t1 = Date.now();
      await holen(`/gespraeche?filter=antwort&limit=1000&suche=Hallo`, als(505));
      ok(`Volltext-Suche als Agent in ${Date.now() - t1} ms unter 1.500 ms`, Date.now() - t1 < 1500);
    }
    if (BASIS) console.log(`\n  (Prüf-Mitarbeiter #${AGENT_TEST}, Fenster-Gespräch ${sonder.Fenster} — bleiben für Teil 3 stehen)`);
    (globalThis as any).__ith = { AGENT_TEST, sonder };
  } catch (e) {
    ok("Teil 2 ohne Ausnahme", false, String((e as Error)?.stack ?? e).slice(0, 1500));
  } finally {
    server.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 3 — BROWSER
// ═══════════════════════════════════════════════════════════════════════════
if (BASIS) {
  const { chromium } = await import("playwright");
  const BILDER = process.env.PRUEF_BILDER || "/tmp/pruef-it-h-bilder";
  mkdirSync(BILDER, { recursive: true });
  let ith = (globalThis as any).__ith as { AGENT_TEST: number; sonder: Record<string, string> } | undefined;
  if (!ith) {
    await aufraeumen();
    const id = await pruefMitarbeiter();
    const soll = await anlegen(id);
    ith = { AGENT_TEST: id, sonder: (soll as any).sonder };
  }
  // Chef-Zugang (Stufe leitung) für /chef/s/whatsapp.
  {
    const bcrypt = (await import("bcryptjs")).default;
    await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account, distribution_active, admin_stufe, created_at)
      VALUES ('Prüfstand Leitung (Testkonto)', 'pruef-ith-chef@pruefstand.test', ${await bcrypt.hash("pruef-ith-lokal", 10)}, 'agent', TRUE, TRUE, FALSE, 'leitung', NOW())
      ON CONFLICT DO NOTHING`;
  }
  const browser = await chromium.launch({ channel: process.env.PRUEF_CHROME === "0" ? undefined : "chrome" }).catch(() => chromium.launch());
  const mitTermin = { leiste: false };
  const neuerKontext = async (breite: number, hoehe: number) => {
    const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, isMobile: breite < 700, hasTouch: breite < 700 });
    // Merkt sich, ob die Handy-Vollfläche je auftauchte (am Rechner darf sie nie, auch nicht kurz).
    await k.addInitScript(`(() => { window.__portal = 0; new MutationObserver(() => { if (document.querySelector(".wr-vollflaeche")) window.__portal++; })
      .observe(document.documentElement, { childList: true, subtree: true }); })()`);
    // Alles Schreibende ist eine Attrappe — außer Anmeldung. Zugangswände und Termine als Attrappe.
    await k.route("**/api/**", async (r) => {
      const u = r.request().url(); const m = r.request().method();
      if (/\/agent\/onboarding(\?|$)/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: { complete: true, schritte: [] } }) });
      if (/\/agent\/onboarding\/zusage/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, frei: true, zusage: { angenommen: true } }) });
      if (/\/agent\/arbeitszeiten(\?|$)/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vollstaendig: true, zeiten: [] }) });
      if (/\/agent\/einfuehrung/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, gesehen: true }) });
      if (/\/agent\/rundgaenge(\?|$)/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, gesehen: ["whatsapp", "pipeline", "start", "kalender", "aufgaben"] }) });
      if (/\/agent\/termine\/faellig/.test(u)) {
        const termine = mitTermin.leiste ? [{ logId: 990001, personId: 990002, name: "Prüf Termin", wann: new Date(Date.now() + 10 * 60_000).toISOString(), inMinuten: 10, notiz: null, art: "rueckruf" }] : [];
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, termine }) });
      }
      if (/\/agent\/termine(\?|$)/.test(u) && m === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, termine: [] }) });
      if (m === "GET" || m === "HEAD" || /\/agent\/login$/.test(u) || /\/chef\/anmelden$/.test(u)) return r.fallback();
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, attrappe: true }) });
    });
    return k;
  };
  const anmeldenAgent = async (seite: any) => {
    const r = await seite.request.post(`${BASIS}/api/fiaon/agent/login`, { data: { email: "pruef-ith-agent@pruefstand.test", password: "pruef-ith-lokal" } });
    return r.ok();
  };
  const anmeldenChef = async (seite: any) => {
    const r = await seite.request.post(`${BASIS}/api/fiaon/chef/anmelden`, { data: { email: "pruef-ith-chef@pruefstand.test", passwort: "pruef-ith-lokal" } });
    return r.ok();
  };
  /** Die Messung je Ansicht — alles in Bildschirm-px (getBoundingClientRect). Als Text, weil tsx sonst __name einschleust. */
  const MESS_JS = `(() => {
    function r(s) { var e = document.querySelector(s); if (!e) return null; var b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, u: b.bottom }; }
    var root = document.getElementById("root");
    var blase = document.querySelector(".wr-blase");
    var fs = blase ? parseFloat(getComputedStyle(blase).fontSize) : 0;
    var zoom = blase ? blase.getBoundingClientRect().height / Math.max(1, blase.offsetHeight) : 1;
    var se = document.scrollingElement;
    return {
      innen: { w: window.innerWidth, h: window.innerHeight },
      rollen: { root: root.scrollHeight - root.clientHeight, doc: (se ? se.scrollHeight : 0) - window.innerHeight, body: document.body.scrollHeight - document.body.clientHeight },
      raum: r(".wr-raum"), chat: r(".wr-chat"), liste: r(".wr-liste"), fall: r(".wr-raum > .wr-person"), senden: r(".wr-senden"), feld: r(".wr-feld-text"),
      telefon: r(".fi-telefonknopf"), eingabe: r(".wr-eingabe"), leiste: r(".fi-erin"),
      blasePx: fs * zoom, zoom: zoom,
      kopfFrei: (function () { var h = document.querySelector(".wr-kopf h1"); if (!h) return null; var b = h.getBoundingClientRect();
        var e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(e && e.closest(".wr-kopf")); })()
    };
  })()`;
  const messen = async (seite: any): Promise<any> => seite.evaluate(MESS_JS);
  /** Bis die Startbühne (index.html, #fi-start) weg ist — vorher zeigt ein Bild nur das Logo. */
  const buehneWeg = async (seite: any) => { await seite.waitForFunction("!document.getElementById('fi-start')", null, { timeout: 25000 }).catch(() => null); };
  const schneiden = (a: any, b: any) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.u && b.y < a.u;

  try {
  const GROESSEN: [number, number][] = [[1920, 1080], [1680, 1050], [1536, 864], [1440, 900], [1366, 768], [1280, 720], [1280, 600], [1024, 768], [768, 1024], [390, 844]];
  const ZIEL_CHAT: Record<string, [number, number]> = { "1920": [950, 1250], "1366": [580, 830] };

  abschnitt("3a  Office /agent/whatsapp — Fläche, kein Seitenrollen, Telefonknopf");
  for (const [b, h] of GROESSEN) {
    const k = await neuerKontext(b, h); const s = await k.newPage();
    ok(`${b}×${h}: angemeldet`, await anmeldenAgent(s));
    await s.goto(`${BASIS}/agent/whatsapp?nummer=${ith.sonder.Fenster}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-raum", { timeout: 20000 }).catch(() => null);
    await s.waitForSelector(".wr-blase", { timeout: 15000 }).catch(() => null);
    await s.waitForTimeout(900);
    await buehneWeg(s);
    const m = await messen(s);
    await s.screenshot({ path: `${BILDER}/office-${b}x${h}.png` });
    const handy = b < 760;
    ok(`${b}×${h}: die Seite rollt nicht (#root ${m.rollen.root} px, Dokument ${m.rollen.doc} px)`, m.rollen.root <= 1 && m.rollen.doc <= 1, m.rollen);
    if (!handy) {
      ok(`${b}×${h}: der Raum reicht bis zum Rand (Unterkante ${Math.round(m.raum?.u ?? 0)} ≥ ${h - 24})`, (m.raum?.u ?? 0) >= h - 24 && (m.raum?.u ?? 0) <= h + 1, m.raum);
      ok(`${b}×${h}: die Kopfzeile des Raums ist frei (nichts liegt darüber)`, m.kopfFrei === true);
      ok(`${b}×${h}: Senden und Telefonknopf überschneiden sich nicht`, !schneiden(m.senden, m.telefon), { senden: m.senden, telefon: m.telefon });
      ok(`${b}×${h}: Blase ≥ 14 px am Bildschirm (${m.blasePx.toFixed(1)})`, m.blasePx >= 13.95, m.blasePx);
      const ziel = ZIEL_CHAT[String(b)];
      if (ziel) ok(`${b}×${h}: Chat ${Math.round(m.chat?.w ?? 0)} px breit (mit Fall ≥ ${ziel[0]} oder ohne ≥ ${ziel[1]})`, (m.fall ? (m.chat?.w ?? 0) >= ziel[0] : (m.chat?.w ?? 0) >= ziel[1]), { chat: m.chat?.w, fall: !!m.fall });
      ok(`${b}×${h}: der Chat ist offen (?nummer=), das Feld da (Fenster offen)`, !!m.feld && !!m.chat);
      ok(`${b}×${h}: am Rechner blitzt nie die Handy-Vollfläche auf`, (await s.evaluate("window.__portal")) === 0);
    } else {
      ok(`${b}×${h}: Handy — das Gespräch öffnet als Vollfläche`, await s.locator(".wr-vollflaeche .wr-chat").count() === 1);
      ok(`${b}×${h}: Handy — Blase ≥ 15 px (kein Zoom)`, m.blasePx >= 15.5, m.blasePx);
    }
    await k.close();
  }

  abschnitt("3b  Office: Umschalter bleiben nach dem Neuladen, Rundgang-Chip, Feld wächst");
  {
    const k = await neuerKontext(1440, 900); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp?nummer=${ith.sonder.Fenster}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".of.voll .wr-raum .wr-blase", { timeout: 20000 });
    await buehneWeg(s);
    const vorher = await messen(s);
    await s.click(".wr-liste-klapp");
    await s.waitForSelector(".wr-liste.schmal");
    const schiene = await messen(s);
    ok("« macht die Liste zur Schiene, der Chat wird breiter", (schiene.liste?.w ?? 999) < 90 && (schiene.chat?.w ?? 0) > (vorher.chat?.w ?? 0) + 150, { vorher: vorher.chat?.w, nachher: schiene.chat?.w, liste: schiene.liste?.w });
    ok("Schiene: das gewählte Gespräch ist markiert, Fenster-Punkt da", await s.locator(".wr-rund.an").count() === 1 && await s.locator(".wr-rund .wr-offen-punkt").count() >= 1);
    // Fall: bei 1440 (Raum < 1400 CSS-px) von selbst aus → (i) schaltet die Spalte an
    const fallVorher = await s.locator(".wr-raum > .wr-person").count();
    await s.click(".wr-fall-knopf");
    await s.waitForTimeout(300);
    const fallNachher = await s.locator(".wr-raum > .wr-person").count();
    ok("(i) blendet den Fall als Spalte ein bzw. aus", fallVorher !== fallNachher, { fallVorher, fallNachher });
    await s.click(".wr-schrift-knopf");
    const gross = await messen(s);
    ok(`„Schrift größer“: Blase ${vorher.blasePx.toFixed(1)} → ${gross.blasePx.toFixed(1)} px (× 1,15)`, Math.abs(gross.blasePx / vorher.blasePx - 1.15) < 0.02, { vorher: vorher.blasePx, gross: gross.blasePx });
    await s.reload({ waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-blase", { timeout: 20000 });
    await s.waitForTimeout(500);
    const nachLaden = await messen(s);
    ok("nach dem Neuladen: Schiene, Fall-Wahl und Schrift gelten weiter, das Gespräch ist wieder offen (?nummer=)",
      await s.locator(".wr-liste.schmal").count() === 1 && (await s.locator(".wr-raum > .wr-person").count()) === fallNachher
      && Math.abs(nachLaden.blasePx - gross.blasePx) < 0.2 && new URL(s.url()).searchParams.get("nummer") === ith.sonder.Fenster);
    ok("Senden liegt auch jetzt nicht unter dem Telefonknopf", !schneiden(nachLaden.senden, nachLaden.telefon));
    const ueberlauf = await s.evaluate(`(() => { var e = document.querySelector(".wr-feld-text"); return e ? getComputedStyle(e).overflowY : null; })()`);
    // Feld wächst bis 36 % der Chathöhe bzw. 320 px, dann rollt es
    const feld = s.locator(".wr-feld-text");
    await feld.fill(Array.from({ length: 30 }, (_x, i) => `Zeile ${i + 1}`).join("\n"));
    await s.waitForTimeout(200);
    const lang = await messen(s);
    const maxErwartet = Math.min(0.36 * (lang.chat?.h ?? 0), 320 * lang.zoom);
    ok(`das Feld wächst auf ${Math.round(lang.feld?.h ?? 0)} px (Grenze ≈ ${Math.round(maxErwartet)}) und rollt dann`, (lang.feld?.h ?? 0) > 150 * lang.zoom && (lang.feld?.h ?? 0) <= maxErwartet + 4
      && (await s.evaluate(`getComputedStyle(document.querySelector(".wr-feld-text")).overflowY`)) === "auto", { feld: lang.feld?.h, max: maxErwartet, vorher: ueberlauf });
    ok("… und die Seite rollt trotzdem nicht", lang.rollen.root <= 1);
    await feld.fill("");
    // Rundgang-Chip startet den Rundgang
    await s.click(".wr-rundgang-knopf");
    await s.waitForTimeout(700);
    ok("der Chip „Rundgang“ startet den Rundgang", await s.locator("text=Hier schreibst du mit deinen Kunden.").count() > 0);
    ok("kein fester Rundgang-Knopf mehr unten rechts", await s.locator(".ru-knopf").count() === 0);
    await s.keyboard.press("Escape").catch(() => null);
    // Ansicht zurücksetzen
    await s.evaluate(`(() => { try { localStorage.removeItem("fiaon_wa_ansicht"); } catch (e) { return null; } })()`);
    await k.close();
  }

  // ── Gegenprüfung (08.10.2026) ────────────────────────────────────────────
  // Maras Karte „WhatsApp öffnen“ ist ein wouter-<Link>: pushState auf DENSELBEN Pfad, die Seite bleibt
  // stehen. Vorher stand B in der Adresse und A blieb offen. history.pushState ist hier dieselbe
  // (von wouter gemeldete) Bewegung wie der Link; window.__eineSeite beweist, dass nichts neu lud.
  const chatName = (s: any) => s.evaluate(`(() => { var b = document.querySelector(".wr-chat .wr-chat-wer b"); return b ? b.textContent : null; })()`);
  const wartenAufName = async (s: any, name: string) => s.waitForFunction(
    `(() => { var b = document.querySelector(".wr-chat .wr-chat-wer b"); return !!b && b.textContent === ${JSON.stringify(name)}; })()`, null, { timeout: 12000 }).then(() => true).catch(() => false);
  const nummerInAdresse = (s: any) => new URL(s.url()).searchParams.get("nummer");

  abschnitt("3f  Gegenprüfung: Direktsprung bei schon offenem Raum, Zurück/Vor, Menü ohne Nummer");
  {
    const A = ith.sonder.Fenster, B = ith.sonder.Zweit;
    const k = await neuerKontext(1440, 900); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp?nummer=${A}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-blase", { timeout: 20000 }).catch(() => null);
    await buehneWeg(s);
    ok("Start: ?nummer=A öffnet Fenja Fensteroffen", await wartenAufName(s, "Fenja Fensteroffen"), await chatName(s));
    await s.evaluate(`(() => { window.__eineSeite = 1; })()`);
    const laengeVorher = await s.evaluate("history.length");
    await s.evaluate(`history.pushState(null, "", "/agent/whatsapp?nummer=${B}")`);
    ok("pushState auf ?nummer=B bei offenem Raum → Gespräch B ist offen (vorher blieb A)", await wartenAufName(s, "Bruno Zweitgespraech"), await chatName(s));
    ok("… die Adresse trägt B, die Liste markiert B", nummerInAdresse(s) === B && /Bruno/.test(String(await s.locator(".wr-zeile.an").first().textContent().catch(() => ""))));
    ok("… ohne Neuladen (dieselbe Seite)", (await s.evaluate("window.__eineSeite")) === 1);
    ok("… der Sprung ist EIN Eintrag im Verlauf (das eigene replaceState legt keinen dazu)", (await s.evaluate("history.length")) === laengeVorher + 1, { vorher: laengeVorher, nachher: await s.evaluate("history.length") });
    await s.goBack();
    ok("Zurück im Browser → wieder A", await wartenAufName(s, "Fenja Fensteroffen") && nummerInAdresse(s) === A, { name: await chatName(s), nr: nummerInAdresse(s) });
    await s.goForward();
    ok("Vor im Browser → wieder B", await wartenAufName(s, "Bruno Zweitgespraech") && nummerInAdresse(s) === B, { name: await chatName(s), nr: nummerInAdresse(s) });
    ok("… alles ohne Neuladen", (await s.evaluate("window.__eineSeite")) === 1);
    // Wahl in der Liste: ersetzt die Adresse (kein neuer Verlaufseintrag), und das Hören springt nicht zurück.
    const laenge2 = await s.evaluate("history.length");
    await s.locator(".wr-zeile", { hasText: "Fenja Fensteroffen" }).first().click();
    ok("Klick in der Liste → A, Adresse ersetzt (Verlauf unverändert)", await wartenAufName(s, "Fenja Fensteroffen") && nummerInAdresse(s) === A && (await s.evaluate("history.length")) === laenge2);
    await s.waitForTimeout(1500);
    ok("… und bleibt A (keine Schleife zwischen Adresse und Wahl)", (await chatName(s)) === "Fenja Fensteroffen" && nummerInAdresse(s) === A);
    // Ungültige Nummer per Link: kein Gespräch, Adresse wird bereinigt.
    await s.evaluate(`history.pushState(null, "", "/agent/whatsapp?nummer=abc")`);
    await s.waitForTimeout(800);
    ok("pushState mit ungültiger Nummer → Liste, Adresse ohne nummer", (await s.locator(".wr-nichts").count()) === 1 && nummerInAdresse(s) === null, { nr: nummerInAdresse(s) });
    await s.goBack();
    ok("Zurück → wieder A", await wartenAufName(s, "Fenja Fensteroffen"));
    // „WhatsApp“ im Office-Menü (echter wouter-<Link>, Adresse ohne Nummer) → die Liste.
    await s.click(`a.of-punkt[href="/agent/whatsapp"]`).catch(async () => { await s.evaluate(`history.pushState(null, "", "/agent/whatsapp")`); });
    await s.waitForTimeout(800);
    ok("„WhatsApp“ im Menü (ohne Nummer) → zur Liste, nichts offen", (await s.locator(".wr-nichts").count()) === 1 && nummerInAdresse(s) === null && (await s.evaluate("window.__eineSeite")) === 1);
    ok("… der Raum bleibt in der Vollfläche (Hülle setzt nichts zurück)", (await s.locator(".of.voll .wr-raum").count()) === 1);
    await s.goBack();
    ok("Zurück → wieder A", await wartenAufName(s, "Fenja Fensteroffen"));
    await k.close();
  }
  {
    const A = ith.sonder.Fenster, B = ith.sonder.Zweit;
    const k = await neuerKontext(390, 844); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp?nummer=${A}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-vollflaeche .wr-chat", { timeout: 20000 }).catch(() => null);
    await buehneWeg(s);
    ok("Handy 390: ?nummer=A als Vollfläche", await wartenAufName(s, "Fenja Fensteroffen"));
    await s.evaluate(`history.pushState(null, "", "/agent/whatsapp?nummer=${B}")`);
    ok("Handy 390: pushState auf B → die Vollfläche zeigt B", await wartenAufName(s, "Bruno Zweitgespraech") && (await s.locator(".wr-vollflaeche .wr-chat").count()) === 1);
    await s.goBack();
    ok("Handy 390: Zurück → A", await wartenAufName(s, "Fenja Fensteroffen"));
    await k.close();
  }
  {
    const A = ith.sonder.Fenster, B = ith.sonder.Zweit;
    const k = await neuerKontext(1440, 900); const s = await k.newPage();
    ok("Chef: angemeldet", await anmeldenChef(s));
    await s.goto(`${BASIS}/chef/s/whatsapp?nummer=${A}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-blase", { timeout: 20000 }).catch(() => null);
    await buehneWeg(s);
    ok("Chefbüro: ?nummer=A offen", await wartenAufName(s, "Fenja Fensteroffen"));
    await s.evaluate(`history.pushState(null, "", "/chef/s/whatsapp?nummer=${B}")`);
    ok("Chefbüro: pushState auf B → B offen", await wartenAufName(s, "Bruno Zweitgespraech") && nummerInAdresse(s) === B);
    await s.goBack();
    ok("Chefbüro: Zurück → A", await wartenAufName(s, "Fenja Fensteroffen"));
    await k.close();
  }

  abschnitt("3g  Gegenprüfung: Suche im Standard „Mit Antwort“ nach einem Kunden ohne Antwort");
  {
    const Z = ith.sonder.Zora;
    const k = await neuerKontext(1440, 900); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-zeile", { timeout: 20000 }).catch(() => null);
    await buehneWeg(s);
    const knopf = (text: string) => s.locator(".wr-filter button", { hasText: text }).first();
    ok("Start: „Mit Antwort“ gedrückt, Zora (nur Vorlage) nicht in der Liste",
      (await knopf("Mit Antwort").getAttribute("aria-pressed")) === "true" && (await s.locator(".wr-zeile", { hasText: "Zora" }).count()) === 0);
    await s.fill(".wr-suchfeld input", "Zora");
    const gefunden = await s.waitForSelector(".wr-zeile:has-text('Zora Nurvorlage')", { timeout: 8000 }).then(() => true).catch(() => false);
    ok("Suche „Zora“ im Standard findet Zora (vorher „Nichts gefunden“ ohne Knopf)", gefunden && (await s.locator(".wr-zeile").count()) === 1, await s.locator(".wr-zeilen").textContent());
    ok("… der Filter zeigt beim Suchen „Alle“, „Mit Antwort“ ruht",
      (await knopf("Alle").getAttribute("aria-pressed")) === "true" && (await knopf("Mit Antwort").getAttribute("aria-pressed")) === "false" && await knopf("Mit Antwort").isDisabled());
    ok("… mit dem Hinweis „Die Suche läuft über alle deine Gespräche“", await s.locator(".wr-filter-hinweis").isVisible());
    ok("… die Liste rollt weiter in ihrem Raster (Zeilen nicht verdrängt)", await s.evaluate(`(() => { var z = document.querySelector(".wr-zeilen"), l = document.querySelector(".wr-liste"); if (!z || !l) return false;
      var a = z.getBoundingClientRect(), b = l.getBoundingClientRect(); return a.bottom <= b.bottom + 1 && a.height > 200; })()`));
    await s.fill(".wr-suchfeld input", "");
    const zurueck = await s.waitForFunction(`(() => { var b = Array.from(document.querySelectorAll(".wr-filter button")).find(function (x) { return /Mit Antwort/.test(x.textContent || ""); });
      return !!b && b.getAttribute("aria-pressed") === "true" && !b.disabled; })()`, null, { timeout: 8000 }).then(() => true).catch(() => false);
    await s.waitForTimeout(900);
    ok("Suche leer → wieder „Mit Antwort“, Zora nicht mehr in der Liste, kein Hinweis", zurueck && (await s.locator(".wr-zeile", { hasText: "Zora" }).count()) === 0 && (await s.locator(".wr-filter-hinweis").count()) === 0);
    // Bewusst „Ungelesen“ gewählt: dort findet die Suche Zora nicht — die leere Liste bietet den Ausweg.
    await knopf("Ungelesen").click();
    await s.fill(".wr-suchfeld input", "Zora");
    const leer = await s.waitForSelector(".wr-leer:has-text('Unter „Ungelesen“ nichts gefunden.')", { timeout: 8000 }).then(() => true).catch(() => false);
    ok("„Ungelesen“ + Suche „Zora“: „Unter „Ungelesen“ nichts gefunden.“", leer, await s.locator(".wr-zeilen").textContent());
    const ausweg = s.locator(".wr-leer-knopf", { hasText: "In allen Gesprächen suchen" });
    ok("… mit dem Knopf „In allen Gesprächen suchen“ (vorher kein Knopf bei Suche)", (await ausweg.count()) === 1);
    await ausweg.click().catch(() => null);
    ok("… der Knopf findet Zora", await s.waitForSelector(".wr-zeile:has-text('Zora Nurvorlage')", { timeout: 8000 }).then(() => true).catch(() => false));
    await s.locator(".wr-zeile", { hasText: "Zora Nurvorlage" }).first().click();
    ok("Klick auf Zora öffnet ihr Gespräch (Adresse trägt die Nummer)", await wartenAufName(s, "Zora Nurvorlage") && nummerInAdresse(s) === Z);
    // Handy: dieselbe Suche
    await k.close();
    const k2 = await neuerKontext(390, 844); const s2 = await k2.newPage();
    await anmeldenAgent(s2);
    await s2.goto(`${BASIS}/agent/whatsapp`, { waitUntil: "domcontentloaded" });
    await s2.waitForSelector(".wr-suchfeld input", { timeout: 20000 }).catch(() => null);
    await buehneWeg(s2);
    await s2.fill(".wr-suchfeld input", "Zora");
    ok("Handy 390: Suche „Zora“ im Standard findet Zora", await s2.waitForSelector(".wr-zeile:has-text('Zora Nurvorlage')", { timeout: 8000 }).then(() => true).catch(() => false));
    ok("Handy 390: Hinweis sichtbar, nichts rollt seitlich", await s2.locator(".wr-filter-hinweis").isVisible()
      && (await s2.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")) === true);
    await s2.screenshot({ path: `${BILDER}/office-suche-zora-390.png` });
    await k2.close();
  }

  abschnitt("3c  Terminleiste (40 px oben): der Raum schrumpft, nichts rollt, das Feld bleibt ganz sichtbar");
  for (const [b, h] of [[1920, 1080], [1440, 900], [1366, 768]] as [number, number][]) {
    mitTermin.leiste = true;
    const k = await neuerKontext(b, h); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp?nummer=${ith.sonder.Fenster}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".fi-erin", { timeout: 20000 }).catch(() => null);
    await s.waitForSelector(".wr-feld-text", { timeout: 20000 }).catch(() => null);
    await s.waitForTimeout(800);
    await buehneWeg(s);
    const m = await messen(s);
    await s.screenshot({ path: `${BILDER}/office-terminleiste-${b}x${h}.png` });
    ok(`${b}×${h} mit Terminleiste: die Leiste steht (${Math.round(m.leiste?.h ?? 0)} px)`, (m.leiste?.h ?? 0) >= 39);
    ok(`${b}×${h} mit Terminleiste: kein Seitenrollen (#root ${m.rollen.root})`, m.rollen.root <= 1 && m.rollen.doc <= 1, m.rollen);
    ok(`${b}×${h} mit Terminleiste: Feld und Senden ganz im Fenster`, (m.senden?.u ?? 9e9) <= h && (m.feld?.u ?? 9e9) <= h, { senden: m.senden, feld: m.feld });
    ok(`${b}×${h} mit Terminleiste: der Office-Kopf deckt die Kopfzeile des Raums nicht zu`, m.kopfFrei === true);
    mitTermin.leiste = false;
    await k.close();
  }

  abschnitt("3d  Andere Office-Räume behalten den 1440-px-Deckel (kein .voll)");
  {
    const k = await neuerKontext(1920, 1080); const s = await k.newPage();
    await anmeldenAgent(s);
    await s.goto(`${BASIS}/agent/whatsapp`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".of.voll", { timeout: 20000 });
    ok("WhatsApp: .of.voll gesetzt", await s.locator(".of.voll").count() === 1);
    for (const pfad of ["/agent/pipeline", "/agent/start", "/agent/kalender"]) {
      await s.click(`a.of-punkt[href="${pfad}"]`).catch(async () => { await s.goto(`${BASIS}${pfad}`, { waitUntil: "domcontentloaded" }); });
      await s.waitForURL(`**${pfad}**`, { timeout: 15000 }).catch(() => null);
      await s.waitForSelector(".of:not(.voll) .of-grund", { timeout: 20000 }).catch(() => null);
      const deckel = await s.evaluate(`(() => { var g = document.querySelector(".of-grund"); return g ? getComputedStyle(g).maxWidth : null; })()`);
      ok(`${pfad}: ohne .voll, Deckel 1440 px wieder da`, await s.locator(".of.voll").count() === 0 && deckel === "1440px", deckel);
    }
    await k.close();
  }

  abschnitt("3e  Chefbüro /chef/s/whatsapp — Fläche, kein Seitenrollen");
  for (const [b, h] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [390, 844]] as [number, number][]) {
    const k = await neuerKontext(b, h); const s = await k.newPage();
    ok(`Chef ${b}×${h}: angemeldet`, await anmeldenChef(s));
    await s.goto(`${BASIS}/chef/s/whatsapp?nummer=${ith.sonder.Fenster}`, { waitUntil: "domcontentloaded" });
    await s.waitForSelector(".wr-raum", { timeout: 20000 }).catch(() => null);
    await s.waitForSelector(".wr-blase", { timeout: 15000 }).catch(() => null);
    await s.waitForTimeout(900);
    await buehneWeg(s);
    const m = await messen(s);
    await s.screenshot({ path: `${BILDER}/chef-${b}x${h}.png` });
    ok(`Chef ${b}×${h}: die Seite rollt nicht`, m.rollen.root <= 1 && m.rollen.doc <= 1, m.rollen);
    if (b >= 760) {
      ok(`Chef ${b}×${h}: Raum bis zum Rand (${Math.round(m.raum?.u ?? 0)})`, (m.raum?.u ?? 0) >= h - 24 && (m.raum?.u ?? 0) <= h + 1, m.raum);
      ok(`Chef ${b}×${h}: Raum beginnt höher als vorher (y ${Math.round(m.raum?.y ?? 0)} < 198)`, (m.raum?.y ?? 999) < 198, m.raum?.y);
      ok(`Chef ${b}×${h}: Blase 16 px`, m.blasePx >= 15.9, m.blasePx);
      ok(`Chef ${b}×${h}: die Kopfzeile des Raums ist frei`, m.kopfFrei === true);
    }
    ok(`Chef ${b}×${h}: kein Rundgang-Knopf unten rechts`, await s.locator(".ru-knopf").count() === 0);
    await k.close();
  }
  } catch (e) {
    ok("Teil 3 ohne Ausnahme", false, String((e as Error)?.stack ?? e).slice(0, 1500));
  } finally {
    await browser.close().catch(() => null);
  }
  console.log(`\n  Bilder: ${BILDER}`);
}

if (MIT_DB || BASIS) {
  if (process.env.PRUEF_BEHALTEN !== "1") {
    await aufraeumen().catch((e) => ok("Aufräumen", false, String(e)));
    const [rest] = await sqlPool`SELECT (SELECT COUNT(*)::int FROM fiaon_whatsapp WHERE nummer LIKE ${PREFIX + "%"}) AS wa,
                                        (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}) AS p,
                                        (SELECT COUNT(*)::int FROM fiaon_agents WHERE email LIKE 'pruef-ith-%') AS a`;
    ok("aufgeräumt: keine Prüf-Nachrichten, -Personen, -Konten mehr", rest.wa === 0 && rest.p === 0 && rest.a === 0, rest);
  }
  await sqlPool.end({ timeout: 2 }).catch(() => {});
}
ok("kein fremder Netzaufruf", FREMD.length === 0, FREMD);
console.log(`\nE-IT-H WhatsApp-Raum: ${gruen} grün, ${rot} rot${rot ? `\n  ${fehler.join("\n  ")}` : ""}`);
process.exit(rot ? 1 : 0);
