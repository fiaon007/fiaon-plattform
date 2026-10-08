// Prüfstand E-299 (07.10.2026): Mara fasst nach · PIN frei wählbar · Adresse ohne Sackgasse · Rettungsfenster an
// der Unterschrift. Offline, ohne KI, ohne Datenbank-Zugriff (DATABASE_URL muss gesetzt sein, wird nicht benutzt).
import fs from "fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  process.env.MARA_LIMIT_NENNEN = "an";
  process.env.MARA_BANK_SATZ = "nachfrage";
  const ton = await import("../shared/fiaon-mara-ton");
  const nf = await import("../server/lib/fiaon-mara-nachfass");
  const an = await import("../shared/fiaon-antrag-neu");

  console.log("── Nachfass-Texte");
  const b = nf.nachfassText({ stufe: "zahlung_offen", link: "https://fiaon.com/zahlung/FIAON-E299AA", betrag: "59,99 €" });
  const bL = nf.nachfassText({ stufe: "zahlung_offen", link: "https://fiaon.com/zahlung/FIAON-E299AA", betrag: "59,99 €", luecke: ["Geburtsdatum"] });
  const c = nf.nachfassText({ stufe: "antrag_offen", link: "https://fiaon.com/a/Ab3dEf7hJk/w" });
  const l = nf.nachfassText({ stufe: "lead", link: "https://fiaon.com/a/Ab3dEf7hJk/w" });
  ok(b.includes(ton.AKTIVIERUNG_AUFRUF) && b.includes("59,99 €") && b.includes("FIAON-E299AA") && b.includes("direkt den fertigen Link unserer Partnerbank"), "B: Aktivierung, Betrag, Link, Justins Nutzen-Satz");
  ok(!bL.includes("direkt den fertigen Link") && bL.includes("es fehlt noch: Geburtsdatum"), "B mit Antragslücke: kein „direkt der Link“, sondern was fehlt");
  ok(c.includes("fünf Minuten") && c.includes("/a/Ab3dEf7hJk/w") && !/monatsrate|überweis/i.test(c), "C (Antrag offen): Antrag, Link, kein Wort zur Zahlung (E-264)");
  ok(l.includes("Visa-Kreditkarte") && /Wollen wir starten\?$/.test(l), "Lead: Karte, Link, eine Frage");
  for (const [n, t] of [["B", b], ["B Lücke", bL], ["C", c], ["Lead", l]] as const) {
    const hart = ton.tonPruefung(t, { kanal: "whatsapp" }).filter((f) => f.schwere === "hart");
    ok(!hart.length, `Ton-Wand ohne harten Treffer: ${n}${hart.length ? ` (${hart.map((h) => h.id).join(", ")})` : ""}`);
    ok(t.replace(/https?:\/\/\S+/g, "x").length < 500, `${n}: unter 500 Zeichen`);
    ok(!ton.BANK_SATZ_MUSTER.test(t) && (t.match(/!/g) ?? []).length <= 1, `${n}: kein Bank-Satz, höchstens ein „!“`);
    ok(!/\b(du|dein|dich|dir)\b/i.test(t.replace(/https?:\/\/\S+/g, "")), `${n}: Sie-Form`);
  }
  const wort = await import("../shared/fiaon-wortverbote").catch(() => null as any);
  if (wort?.wandPruefen) for (const [n, t] of [["B", b], ["C", c], ["Lead", l]] as const) ok(!wort.wandPruefen(t).some((f: any) => f.art === "verboten"), `Wortwand: ${n}`);

  console.log("── Wer NICHT angeschrieben wird");
  for (const t of ["Ich will kündigen", "Das ist Betrug", "Ich will mein Geld zurück, Erstattung bitte", "Ich gehe zum Anwalt", "Bitte löschen Sie meine Daten", "Keine Nachrichten mehr", "kein Interesse", "Ich habe schon Anzeige gemacht"]) ok(nf.NACHFASS_HEIKEL.test(t), `heikel: „${t}“`);
  for (const t of ["Aber ich hab das geld nicht aber soll gleich zahlen nein danke sowas kenne ich nicht mach ich nicht", "Nein danke", "Kein Bedarf", "Ich möchte doch nicht", "brauche ich nicht"]) ok(nf.NACHFASS_NEIN.test(t), `klares Nein: „${t.slice(0, 40)}“`);
  for (const t of ["Ich versuche es so schnell wie möglich.", "Okay", "Morgen", "Ich habe eine Frage", "Wann kommt die Karte?"]) ok(!nf.NACHFASS_HEIKEL.test(t) && !nf.NACHFASS_NEIN.test(t), `darf nachgefasst werden: „${t}“`);
  for (const t of ["Herr Stripling übernimmt das persönlich.", "Das geht zur Leitung.", "Ihre Kündigung ist eingegangen.", "Herr Stripling ruft Sie morgen um 13:30 Uhr an."]) ok(nf.NACHFASS_UEBERGABE.test(t), `Übergabe erkannt: „${t.slice(0, 40)}“`);
  ok(!nf.NACHFASS_UEBERGABE.test("Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate über 59,99 € — mit Ihrem Verwendungszweck ist Ihr Account sofort nach Eingang aktiv!"), "Maras Abschluss ist keine Übergabe");

  console.log("── Zeit, Fenster, Abfrage");
  const um = (h: number, m: number) => new Date(Date.UTC(2026, 9, 8, h - 2, m)); // Berlin = UTC+2 im Oktober
  ok(!nf.nachfassZeitOk(um(7, 59)) && nf.nachfassZeitOk(um(8, 0)) && nf.nachfassZeitOk(um(20, 30)) && !nf.nachfassZeitOk(um(20, 31)), "nur 08:00–20:30 Uhr (Berlin)");
  const q = nf.nachfassKandidatenSql();
  // Mara-Topsales 08.10.2026 (Justin): ab 4 statt ab 16 Stunden — Fenster 4–23 h nach seiner letzten Nachricht.
  ok(/INTERVAL '23 hours'/.test(q) && /INTERVAL '4 hours'/.test(q) && nf.NACHFASS_AB_STUNDEN === 4, "Fenster 4–23 Stunden nach seiner letzten Nachricht (Mara-Topsales 08.10.2026)");
  ok(q.includes("ILIKE '%stopp%'") && q.includes("kein(e|en)?\\s+interesse"), "STOPP und Widerspruch (WA_STOPP_ZEILE_SQL) schließen aus");
  ok(/vorlage IS NOT NULL OR COALESCE\(o\.von, ''\) NOT ILIKE 'Mara%'/.test(q), "nach einem Menschen oder einer Vorlage kein Nachfassen");
  ok(/LIKE '%\(Nachfass\)' AND o\.created_at > NOW\(\) - INTERVAL '7 days'/.test(q), "höchstens einmal in sieben Tagen");
  ok(/COALESCE\(g\.mara_an, TRUE\) = TRUE/.test(q) && /g\.antwort_text IS NULL/.test(q), "Mara abgeschaltet oder Antwort in Vorbereitung → nichts");
  ok(/INTERVAL '0 hours'/.test(nf.nachfassKandidatenSql(-5)) && /INTERVAL '23 hours'/.test(nf.nachfassKandidatenSql(99)), "Probe-Fenster bleibt in 0–23 Stunden");
  const quelle = fs.readFileSync("server/lib/fiaon-mara-nachfass.ts", "utf8");
  ok(/stufe !== "zahlung_offen" && stufe !== "antrag_offen" && stufe !== "lead"/.test(quelle), "nur B, Antrag offen und Lead — nie Folgerate, gemeldet, Kunde (WhatsApp: kein Inkasso)");
  ok(/lage\.zahltag && lage\.zahltag >= heuteIso/.test(quelle), "festgehaltener Zahltag in der Zukunft → nichts");
  ok(/globalKundeWa/.test(quelle) && /werbungVerboten/.test(quelle) && /lage\.werbesperre \|\| lage\.vertriebssperre/.test(quelle), "Global-Kunde, Werbe- und Vertriebssperre → nichts");
  ok(/if \(opt\.trocken\) \{ erg\.gesendet\+\+; frei--; continue; \}/.test(quelle), "Trockenlauf sendet nie");
  ok(/von: `\$\{namen\.voll\} \$\{NACHFASS_MARKE\}`/.test(quelle), "Absender „<Mara> (Nachfass)“ — zählt als Mara, ist wiederzufinden");
  const routen = fs.readFileSync("server/routes.ts", "utf8");
  ok(/tageslauf\('mara_wa_nachfass'[\s\S]{0,140}nachfassLauf\(\)[\s\S]{0,40}10 \* 60 \* 1000/.test(routen), "Takt alle 10 Minuten eingetragen");

  console.log("── PIN frei wählbar");
  for (const p of ["1234", "0000", "1111", "4321", "1985", "1403"]) ok(an.pinPruefen(p, { tag: 14, monat: 3, jahr: 1985 }) === null, `PIN ${p} ist erlaubt`);
  for (const p of ["123", "12345", "12a4", ""]) ok(an.pinPruefen(p) !== null, `„${p}“ ist keine PIN aus vier Ziffern`);
  const pinSeite = fs.readFileSync("client/src/pages/antrag-neu/pin.tsx", "utf8");
  const pinApp = fs.readFileSync("client/src/pages/app/Pin.tsx", "utf8");
  ok(!/keine Reihe|Geburtsjahr/.test(pinSeite.replace(/\/\/.*$/gm, "")) && pinSeite.includes("Vier Ziffern, ganz nach Ihrer Wahl."), "Antrag: kein Verbots-Hinweis mehr");
  ok(!/Zahlenreihe wie 1234/.test(pinApp) && pinApp.includes("Vier Ziffern, ganz nach Ihrer Wahl."), "Kundenbereich: kein Verbots-Hinweis mehr");

  console.log("── Adresse und Unterschrift (Quelltext)");
  const angaben = fs.readFileSync("client/src/pages/antrag-neu/schritte-angaben.tsx", "utf8");
  ok(/if \(liste\.length === 1\) \{ waehlen\(liste\[0\]\)/.test(angaben) && !/if \(liste\[0\]\) \{ waehlen\(liste\[0\]\); ereignis\("adresse_uebernommen"/.test(angaben), "nur EIN Vorschlag wird übernommen — bei mehreren nie raten");
  ok(/adresseOffen: true, plz: "", ort: ""/.test(angaben), "Handweg leert PLZ und Ort (keine fremde Stadt aus einem früheren Vorschlag)");
  const abschluss = fs.readFileSync("client/src/pages/antrag-neu/schritte-abschluss.tsx", "utf8");
  ok(/export function RettungSheet/.test(abschluss) && /Lieber kleiner starten/.test(abschluss) && /Später weitermachen/.test(abschluss), "Rettungsfenster: kleiner, Rückruf, weiter, später");
  ok(/Sie überweisen selbst – abgebucht wird nichts\. Gesetzliches Widerrufsrecht: 14 Tage\./.test(abschluss), "Vertrauenssatz über dem Knopf");
  ok(/unterschrift_gezeichnet/.test(abschluss) && /haken_gesetzt/.test(abschluss), "Messung: gezeichnet und Haken");
  const index = fs.readFileSync("client/src/pages/antrag-neu/index.tsx", "utf8");
  ok(/rettungGezeigt\.current = true/.test(index) && /if \(jetztRef\.current !== s \|\| sheetAnRef\.current\) return;/.test(index), "einmal je Besuch, nie bei schnellem Mehrfach-Zurück");
  const zustand = await import("../client/src/pages/antrag-neu/zustand").catch(() => null as any);
  if (zustand?.kleineresPaket) {
    ok(zustand.kleineresPaket("highend")?.key === "ultra" && zustand.kleineresPaket("ultra")?.key === "pro" && zustand.kleineresPaket("pro")?.key === "start" && zustand.kleineresPaket("start") === null, "kleineresPaket: High-End → Ultra → Pro → Start → keins");
  }

  console.log(`\n${schlecht ? "ROT" : "GRÜN"}: ${gut} bestanden, ${schlecht} fehlgeschlagen`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
