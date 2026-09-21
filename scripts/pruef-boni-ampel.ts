// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND BONI-AMPEL (21.09.2026, E-202) — ohne Netz, ohne Datenbank
//
// Prüft die eine Rechnung (shared/fiaon-boni-ampel.ts): der typische
// Antragskunde steht auf Grün, ohne Angaben steht niemand auf Rot, belegte
// Zahlen schlagen getippte, ein harter Befund verhindert Grün, zwei machen Rot,
// die Punkte bleiben in 0–100 — und im Quelltext: die Route der Mitarbeiter
// hinter requireAgent + darfAnKunde, nur fertig gelesene Auskünfte und
// Kontoauszüge, nie die Auskunft-Bestellung als Antrag, keine Ampel in Texten
// an Kunden, Hover nur bei Maus.
//
//   npx tsx scripts/pruef-boni-ampel.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  boniAmpel, monateSeit, BONI_FARBE, BONI_GRENZE, BONI_QUELLE_TEXT, type BoniEingang,
} from "../shared/fiaon-boni-ampel";
import { wandPruefen } from "../shared/fiaon-wortverbote";

// Die Datenbank-Anbindung verlangt beim Laden eine Adresse — abgefragt wird hier nie („ins Leere").
process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
const { boniEingangAusZeile, boniLateralSql, BONI_SPALTEN_SQL } = await import("../server/lib/fiaon-boni-ampel");

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

const LEER: BoniEingang = {
  strasse: false, plz: false, ort: false, land: null, wohnform: null, beschaeftigung: null, beschaeftigtSeit: null,
  einkommenEuro: null, zusatzEinkommenEuro: null, mieteEuro: null, ausgabenEuro: null, schuldenEuro: null,
  konto: null, schufa: null,
};
/** Der typische Antrag: Anschrift in DE, zur Miete, angestellt seit Jahren, 2.400 € netto. */
const TYPISCH: BoniEingang = {
  ...LEER, strasse: true, plz: true, ort: true, land: "DE", wohnform: "Zur Miete", beschaeftigung: "Angestellt",
  beschaeftigtSeit: "2019-03", einkommenEuro: 2400, mieteEuro: 700, ausgabenEuro: 400, schuldenEuro: 0,
};
const mit = (teil: Partial<BoniEingang>): BoniEingang => ({ ...TYPISCH, ...teil });

abschnitt("Überwiegend positiv");
{
  const a = boniAmpel(TYPISCH);
  ok(a.farbe === "gruen", `Typischer Antrag → Grün (ist ${a.farbe}, ${a.punkte} P)`);
  ok(a.label === "Gute Lage" && a.satz === BONI_FARBE.gruen.satz, "Grün heißt „Gute Lage“");
  ok(a.belegt === 4 && !a.geschaetzt, `Vier Teile aus dem Antrag, nicht „geschätzt“ (belegt ${a.belegt})`);
  ok(a.befunde.length === 0 && a.deckel === null, "Kein Befund, kein Deckel");

  const leer = boniAmpel(LEER);
  ok(leer.farbe === "gelb", `Ohne jede Angabe → Gelb, nie Rot (ist ${leer.farbe}, ${leer.punkte} P)`);
  ok(leer.geschaetzt && leer.belegt === 0, "Ohne Angaben: „geschätzt“, 0 belegte Teile");
  ok(leer.teile.every((t) => t.quelle === "annahme"), "Ohne Angaben: jeder Teil als Annahme markiert");

  ok(a.teile[0].text === "Vollständige Anschrift im DACH-Raum, zur Miete.", `Adresse als Satz (${a.teile[0].text})`);
  ok(leer.teile[0].text === "Noch keine Anschrift.", `Ohne Anschrift und Land (${leer.teile[0].text})`);
  ok(boniAmpel({ ...LEER, land: "DE" }).teile[0].text === "Noch keine Anschrift, Land im DACH-Raum.", "Ohne Anschrift, aber mit Land");

  const kleinesEinkommen = boniAmpel(mit({ einkommenEuro: 1300, mieteEuro: 550, ausgabenEuro: 300 }));
  ok(kleinesEinkommen.farbe !== "rot", `1.300 € netto ohne Befund → nicht Rot (ist ${kleinesEinkommen.farbe})`);
}

abschnitt("Belege schlagen Angaben");
{
  const a = boniAmpel(mit({
    einkommenEuro: 1200,
    konto: { gehaltCents: 280000, einnahmenCents: 1800000, ausgabenCents: 1200000, tage: 182, dispoGenutzt: false, ruecklastschriften: 0 },
  }));
  const ek = a.teile.find((t) => t.key === "einkommen")!;
  ok(ek.quelle === "kontoauszug", "Einkommen: Kontoauszug vor Antrag");
  ok(ek.text.includes("2.800 €") && ek.text.includes("Gehalt laut Kontoauszug"), `Einkommen nennt das belegte Gehalt (${ek.text})`);
  const aus = a.teile.find((t) => t.key === "ausgaben")!;
  ok(aus.quelle === "kontoauszug" && aus.punkte === 20, `Ausgaben aus dem Kontoauszug, Quote 0,67 → 20 P (ist ${aus.punkte})`);

  const s = boniAmpel(mit({ schuldenEuro: 0, schufa: { ampel: "aufraeumen", summeOffenCents: 350000 } }));
  const sch = s.teile.find((t) => t.key === "schulden")!;
  ok(sch.quelle === "schufa" && sch.text.includes("3.500 €") && sch.punkte === 13, `Schulden: SCHUFA-Summe vor Antragsangabe (${sch.text}, ${sch.punkte} P)`);
  ok(s.teile.find((t) => t.key === "schufa")!.punkte === 16, "SCHUFA „aufräumen“ → 16 P");
}

abschnitt("Harte Befunde deckeln");
{
  const eins = boniAmpel(mit({ schufa: { ampel: "dringend", summeOffenCents: 90000 } }));
  ok(eins.befunde.length === 1 && eins.farbe === "gelb", `SCHUFA dringend bei sonst guter Lage → Gelb (ist ${eins.farbe}, ${eins.punkte} P)`);
  ok(!!eins.deckel && eins.deckel.includes("deshalb nicht Grün"), "Deckel nennt den Grund");
  ok(eins.punkte >= BONI_GRENZE.gruen, "… obwohl die Punkte für Grün reichten (der Deckel greift wirklich)");

  const zwei = boniAmpel(mit({ schufa: { ampel: "dringend", summeOffenCents: 2_000_000 } }));
  ok(zwei.befunde.length === 2 && zwei.farbe === "rot", `SCHUFA dringend + 20.000 € offen → Rot (ist ${zwei.farbe})`);
  ok(!!zwei.deckel && zwei.deckel.startsWith("Zwei harte Befunde"), "Deckel „Zwei harte Befunde“");

  const konto = boniAmpel(mit({
    konto: { gehaltCents: 210000, einnahmenCents: 1260000, ausgabenCents: 1400000, tage: 182, dispoGenutzt: true, ruecklastschriften: 3 },
  }));
  ok(konto.befunde.includes("mehr Ausgaben als Einnahmen im Kontoauszug") && konto.befunde.includes("3 Rücklastschriften"),
    `Kontoauszug: Überziehung + 3 Rücklastschriften erkannt (${konto.befunde.join(" | ")})`);
  ok(konto.farbe === "rot", "Überziehung + Rücklastschriften → Rot");
  ok(konto.teile.find((t) => t.key === "ausgaben")!.punkte === 3, "Ausgaben fallen nie unter 3 P");

  const antragUeber = boniAmpel(mit({ einkommenEuro: 1500, mieteEuro: 900, ausgabenEuro: 800 }));
  ok(!antragUeber.befunde.includes("mehr Ausgaben als Einnahmen im Kontoauszug"), "Überziehung gilt nur belegt — nie aus der Antragsangabe");

  const wenig = boniAmpel(mit({ einkommenEuro: 450 }));
  ok(wenig.befunde.includes("unter 600 € Einkommen im Monat") && wenig.farbe !== "gruen", "Unter 600 € Einkommen → nie Grün");

  const schuldenAntrag = boniAmpel(mit({ schuldenEuro: 22000 }));
  ok(schuldenAntrag.befunde.includes("über 15.000 € Schulden"), "Über 15.000 € Schulden laut Antrag → Befund");
  const genau = boniAmpel(mit({ schuldenEuro: 15000 }));
  ok(!genau.befunde.includes("über 15.000 € Schulden"), "Genau 15.000 € → noch kein Befund");
  const eineRl = boniAmpel(mit({
    konto: { gehaltCents: 250000, einnahmenCents: 1500000, ausgabenCents: 900000, tage: 182, dispoGenutzt: false, ruecklastschriften: 1 },
  }));
  ok(eineRl.befunde.length === 0, "Eine einzelne Rücklastschrift ist kein harter Befund");
}

abschnitt("Beschäftigt seit");
{
  const heute = new Date(2026, 8, 21);
  ok(monateSeit("2020-01", heute) === 80, `„2020-01“ → 80 Monate (ist ${monateSeit("2020-01", heute)})`);
  ok(monateSeit("03/2024", heute) === 30, "„03/2024“ → 30 Monate");
  ok(monateSeit("03.2024", heute) === 30, "„03.2024“ → 30 Monate");
  ok(monateSeit("15.06.2025", heute) === 15, "„15.06.2025“ → 15 Monate");
  ok(monateSeit("2025", heute) === 15, "„2025“ → Jahresmitte, 15 Monate");
  ok(monateSeit("gestern", heute) === null && monateSeit("", heute) === null && monateSeit(null, heute) === null, "Unlesbares → null");
  ok(monateSeit("1900", heute) === null && monateSeit("2031-01", heute) === null && monateSeit("2020-13", heute) === null, "Unmögliches → null");
  ok(monateSeit("2026-12", heute) === 0, "Zukunft im laufenden Jahr → 0, nie negativ");

  const frisch = boniAmpel(mit({ beschaeftigtSeit: `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}` }));
  const lang = boniAmpel(TYPISCH);
  ok(frisch.teile[1].punkte === lang.teile[1].punkte - 2, "Angestellt unter 12 Monaten → 2 P weniger Stabilität");
}

abschnitt("Punkte, Farben, Gleichheit");
{
  // Deterministischer Zufall — immer dieselben 4.000 Lagen.
  let s = 20260921;
  const zufall = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const wahl = <T,>(xs: T[]): T => xs[Math.floor(zufall() * xs.length)];
  let alleOk = true, farbeOk = true, teileOk = true;
  const zaehl = { gruen: 0, gelb: 0, rot: 0 };
  for (let i = 0; i < 4000; i++) {
    const e: BoniEingang = {
      strasse: zufall() > 0.2, plz: zufall() > 0.2, ort: zufall() > 0.2,
      land: wahl(["DE", "AT", "CH", "Deutschland", "PL", null, ""]),
      wohnform: wahl(["Zur Miete", "Eigentum", "Bei Familie", "Sonstiges", null]),
      beschaeftigung: wahl(["Angestellt", "Beamter/in", "Rentner/in", "Selbstständig", "Student/in", "Arbeitslos", null]),
      beschaeftigtSeit: wahl(["2010-01", "2025-11", "05/2023", "2024", "irgendwann", null]),
      einkommenEuro: wahl([null, 0, 300, 900, 1400, 2100, 3200, 8000, -50]),
      zusatzEinkommenEuro: wahl([null, 0, 200]),
      mieteEuro: wahl([null, 0, 450, 900, 1600]),
      ausgabenEuro: wahl([null, 0, 300, 1200, 4000]),
      schuldenEuro: wahl([null, 0, 800, 4000, 12000, 30000, -10]),
      konto: zufall() > 0.7 ? {
        gehaltCents: wahl([null, 0, 150000, 320000]), einnahmenCents: wahl([null, 900000, 1800000]),
        ausgabenCents: wahl([null, 800000, 2000000]), tage: wahl([null, 0, 90, 182]),
        dispoGenutzt: zufall() > 0.5, ruecklastschriften: wahl([0, 1, 2, 7]),
      } : null,
      schufa: zufall() > 0.8 ? { ampel: wahl(["frei", "aufraeumen", "angreifbar", "dringend", "unbekannt", null]), summeOffenCents: wahl([null, 0, 250000, 3_000_000]) } : null,
    };
    const a = boniAmpel(e);
    zaehl[a.farbe]++;
    if (!(Number.isInteger(a.punkte) && a.punkte >= 0 && a.punkte <= 100)) alleOk = false;
    if (!a.teile.every((t) => Number.isInteger(t.punkte) && t.punkte >= 0 && t.punkte <= 20) || a.teile.length !== 5) teileOk = false;
    if (a.teile.reduce((x, t) => x + t.punkte, 0) !== a.punkte) teileOk = false;
    const ohneDeckel = a.punkte >= BONI_GRENZE.gruen ? "gruen" : a.punkte >= BONI_GRENZE.gelb ? "gelb" : "rot";
    const erwartet = a.befunde.length >= 2 ? "rot" : a.befunde.length === 1 && ohneDeckel === "gruen" ? "gelb" : ohneDeckel;
    if (a.farbe !== erwartet) farbeOk = false;
    if (JSON.stringify(boniAmpel(e)) !== JSON.stringify(a)) farbeOk = false;
  }
  ok(alleOk, "4.000 Lagen: Punkte immer ganzzahlig in 0–100");
  ok(teileOk, "4.000 Lagen: fünf Teile, je 0–20, Summe = Punktzahl");
  ok(farbeOk, "4.000 Lagen: Farbe = Schwelle + Deckelregel, gleiche Lage → gleiche Ampel");
  ok(zaehl.gruen > 0 && zaehl.gelb > 0 && zaehl.rot > 0, `Alle drei Farben kommen vor (${JSON.stringify(zaehl)})`);
}

abschnitt("Worte");
{
  const texte = [
    ...Object.values(BONI_FARBE).flatMap((f) => [f.label, f.satz]),
    ...Object.values(BONI_QUELLE_TEXT),
    ...boniAmpel(TYPISCH).teile.map((t) => t.text),
    ...boniAmpel(mit({ schufa: { ampel: "dringend", summeOffenCents: 2_000_000 } })).teile.map((t) => t.text),
  ];
  const treffer = texte.flatMap((t) => wandPruefen(t, []).filter((f) => f.art === "verboten" || f.art === "zusage").map((f) => `${t} → ${f.art}`));
  ok(treffer.length === 0, `Keine Wand-Treffer in den Ampel-Texten${treffer.length ? `: ${treffer.join(" | ")}` : ""}`);
  ok(BONI_FARBE.rot.label === "Erst aufräumen" && !/abgelehnt|kein kunde|schlecht/i.test(JSON.stringify(BONI_FARBE)),
    "Rot heißt „Erst aufräumen“ — kein Urteil über den Menschen");
  const anzeige = lies("client/src/components/BoniAmpel.tsx");
  ok(anzeige.includes("keine Kreditentscheidung"), "Die Anzeige sagt: keine Kreditentscheidung");
  ok(lies("shared/fiaon-boni-ampel.ts").includes("Art. 22 DSGVO"), "Die Rechnung nennt Art. 22 DSGVO vor jeder Übertragung an Dritte");
}

abschnitt("Aus der Datenbankzeile");
{
  const z = {
    boni_einkommen: "2100", boni_zusatz: null, boni_miete: "650", boni_schulden: "0", boni_wohnform: "Zur Miete",
    boni_beschaeftigung: "Angestellt", boni_seit: "2018", boni_strasse: "", boni_plz: null, boni_ort: "",
    boni_land: null, boni_ausgaben: "350", boni_schufa_ampel: null, boni_schufa_offen: null,
    boni_konto_da: false, boni_konto_gehalt: null, boni_konto_ein: null, boni_konto_aus: null, boni_konto_tage: null,
    boni_konto_dispo: null, boni_konto_rl: null,
  };
  const e = boniEingangAusZeile(z, { strasse: "Hauptstr. 1", plz: "10115", ort: "Berlin", land: "DE" });
  ok(e.strasse && e.plz && e.ort && e.land === "DE", "Anschrift: Rückfall auf die Personendaten, wenn der Antrag leer ist");
  ok(e.einkommenEuro === 2100 && e.mieteEuro === 650 && e.schuldenEuro === 0, "Zahlen aus Text gelesen, 0 bleibt 0");
  ok(e.konto === null && e.schufa === null, "Kein fertiger Kontoauszug/keine Auskunft → null, keine erfundene 0");
  const mitKonto = boniEingangAusZeile({ ...z, boni_konto_da: true, boni_konto_gehalt: "230000", boni_konto_ein: "1400000", boni_konto_aus: "900000", boni_konto_tage: 181, boni_konto_dispo: true, boni_konto_rl: 2 });
  ok(mitKonto.konto?.gehaltCents === 230000 && mitKonto.konto?.dispoGenutzt === true && mitKonto.konto?.ruecklastschriften === 2, "Kontoauszug-Felder übernommen");

  let wirft = false;
  try { boniLateralSql("p; DROP TABLE x"); } catch { wirft = true; }
  ok(wirft, "boniLateralSql nimmt nur einen schlichten Alias an");
  const sql = boniLateralSql("p");
  ok(sql.includes("a.person_id = p.id") && sql.includes("s.person_id = p.id") && sql.includes("k.person_id = p.id"), "Alle drei Verbindungen hängen am Alias");
  ok(sql.includes("s.status = 'fertig'") && sql.includes("k.status = 'fertig'"), "Nur fertig gelesene Auskünfte und Kontoauszüge");
  ok(sql.includes("<> 'schufa'") && sql.includes("NOT LIKE 'FIAON-SCHUFA-%'"), "Die Auskunft-Bestellung zählt nie als Antrag");
  ok(sql.includes("merged_into IS NULL"), "Zusammengeführte Anträge zählen nicht");
  ok(/boni_/.test(BONI_SPALTEN_SQL) && !/\bAS (id|name|email|ref)\b/.test(BONI_SPALTEN_SQL), "Spalten tragen das Präfix boni_");
}

abschnitt("Türen und Einsatzorte");
{
  const route = lies("server/routes/fiaon-boni-ampel.ts");
  ok(/router\.get\("\/agent\/kunden\/:personId\/boni-ampel", requireAgent,/.test(route), "Route der Mitarbeiter hinter requireAgent");
  ok(route.includes("darfAnKunde(") && route.includes("403"), "… und hinter darfAnKunde (fremde Kunden → 403)");
  ok(!/router\.(post|put|patch|delete)\(/.test(route), "Die Ampel-Route liest nur");
  ok(lies("server/routes.ts").includes("./routes/fiaon-boni-ampel"), "Route ist eingehängt");

  const kartei = lies("server/lib/fiaon-telefonkartei.ts");
  ok(kartei.includes("boniLateralSql(\"b\")") && kartei.includes("BONI_SPALTEN_SQL"), "Telefonkartei holt die Ampel in derselben Abfrage");
  ok(/ampel: boniAmpel\(boniEingangAusZeile\(/.test(kartei), "Jede Karte trägt die Ampel aus der einen Rechnung");
  // Gemessen am 21.09.2026 auf echten Daten: „Alle“ 502 ms → 50 ms, sobald die Seite VOR den Nachschlagungen steht.
  ok(/seite AS \(\s*SELECT \* FROM basis b \$\{ordnung\} LIMIT \$\{grenze\} OFFSET \$\{versatz\}\s*\)/.test(kartei) && kartei.includes("FROM seite b"),
    "Kartei: erst die Seite auswählen, dann nur deren Karten nachschlagen");
  ok((kartei.match(/LIMIT \$\{grenze\}/g) ?? []).length === 1, "Kartei: genau eine Seitengrenze");
  ok(lies("server/lib/fiaon-boni-ampel.ts").match(/boniAmpel\(boniEingangAusZeile/g)?.length === 1, "Akte-Weg nutzt dieselbe Beschaffung");

  const karteiText = lies("shared/fiaon-telefonkartei.ts");
  ok(/ampel: BoniAmpel;/.test(karteiText), "KarteiKarte hat das Feld ampel");
  ok(!/\.ampel\b/.test(karteiText), "Keine Ampel in Mail- oder WhatsApp-Texten an Kunden");

  ok(/<BoniAmpelBlock ampel=\{k\.ampel\} \/>/.test(lies("client/src/components/admin/ChefTelefonkartei.tsx")), "Karte der Telefonkartei zeigt die Ampel");
  ok(/<BoniAmpelAkte personId=\{k\.personId\}/.test(lies("client/src/pages/agent/pipeline.tsx")), "Kopf der Mitarbeiter-Akte zeigt die Ampel");

  // Nur diese zwei Oberflächen: der Kundenbereich bekommt die Ampel nie zu sehen.
  const nutzer: string[] = [];
  const lauf = (dir: string) => {
    for (const f of fs.readdirSync(path.join(wurzel, dir), { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) lauf(p);
      else if (/\.(tsx?|jsx?)$/.test(f.name) && p !== path.join("client/src/components/BoniAmpel.tsx") && /from "@\/components\/BoniAmpel"/.test(lies(p))) nutzer.push(p);
    }
  };
  lauf("client/src");
  ok(nutzer.sort().join(",") === ["client/src/components/admin/ChefTelefonkartei.tsx", "client/src/pages/agent/pipeline.tsx"].join(","),
    `Ampel-Anzeige nur in Telefonkartei und Mitarbeiter-Akte (gefunden: ${nutzer.join(", ") || "—"})`);

  // Hover nur bei Maus — am iPhone bliebe er sonst kleben.
  const css = lies("client/src/styles/boni-ampel.css");
  let rest = css;
  for (;;) {
    const i = rest.indexOf("@media (hover: hover)");
    if (i < 0) break;
    let tiefe = 0, j = rest.indexOf("{", i);
    for (let k = j; k < rest.length; k++) {
      if (rest[k] === "{") tiefe++;
      else if (rest[k] === "}" && --tiefe === 0) { j = k; break; }
    }
    rest = rest.slice(0, i) + rest.slice(j + 1);
  }
  ok(css.includes(":hover") && !rest.includes(":hover"), "Hover-Regeln nur innerhalb von @media (hover: hover)");
  ok(/\.ba-schleier[^{]*\{[^}]*z-index:\s*2147483000/.test(css), "Fenster liegt über dem Rundgang-Knopf");
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
