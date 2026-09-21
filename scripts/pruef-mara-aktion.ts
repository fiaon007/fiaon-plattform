// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MARA-AKTION, GEDÄCHTNIS, STEUERPULT (21.09.2026) — ohne Netz, ohne DB
//
//   npx tsx scripts/pruef-mara-aktion.ts
//
// Prüft die Wände, die ohne Datenbank prüfbar sind: die Nachprüfung jeder
// Mail, das Bündeln der Absätze, das Gedächtnis (nie Sensibles), und im
// Quelltext die Stopp- und Rücksichtsregeln, die Stufenwand (C gesperrt),
// den Anlauf und die Tür des Steuerpults.
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://nobody@127.0.0.1:1/none";
import { readFileSync } from "node:fs";

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const { absaetzeFassen, aktionPruefen } = await import("../server/lib/fiaon-mara-aktion");
const { istSensibel } = await import("../server/lib/fiaon-mara-gedaechtnis");
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("── Nachprüfung jeder Mail ─────────────────────────────────────────");
const gut = "Hier ist Mara Lindner von FIAON. Ich würde Ihren Account gern aktivieren, mit Ihrem Wunschlimit als Ziel. Dazu fehlt mir nur noch die offene Rechnung über 59,99 €.\n\nSobald Ihre Zahlung da ist, aktiviere ich Ihren Account. Über den Knopf unten ist es in zwei Minuten erledigt. Einen schönen Abend wünsche ich Ihnen.";
ok(aktionPruefen("Ihr Account wartet auf einen Schritt", gut).length === 0, "Eine gute Mail besteht die Prüfung");
const m = aktionPruefen("Jetzt zugreifen!", "Ich garantiere Ihnen die Karte innerhalb von 3 Tagen. Schau auf www.fiaon.com vorbei, dann kannst du loslegen.");
ok(m.some((x) => /garant/i.test(x)), "„garantieren“ fällt durch");
ok(m.some((x) => /innerhalb von/.test(x)), "Feste Frist fällt durch");
ok(m.some((x) => /URL/.test(x)), "Adresse im Text fällt durch");
ok(m.some((x) => /Du-Form/.test(x)), "Du-Form fällt durch");
ok(m.some((x) => /Rechnung kommt nicht vor/.test(x)), "Mail ohne offene Rechnung fällt durch");
ok(m.some((x) => /Ausrufezeichen/.test(x)), "Ausrufezeichen im Betreff fällt durch");
ok(aktionPruefen("Kurz zu Ihrer Karte", "Sehr geehrte Frau Muster, " + gut).some((x) => /Anrede oder Gruß/.test(x)), "Eigene Anrede im Text fällt durch (setzt der Server)");
ok(aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Ihr", "Ich empfehle Ihnen Ihr")).some((x) => /empfehl/i.test(x)), "„ich empfehle“ fällt durch");

console.log("── Absätze ────────────────────────────────────────────────────────");
ok(absaetzeFassen("Eins.\n\nZwei.\n\nDrei.\n\nVier.\n\nFünf.").split("\n\n").length === 3, "Fünf Ein-Satz-Absätze werden zu drei");
ok(absaetzeFassen("A eins.\nA zwei.\n\nB.") === "A eins. A zwei.\n\nB.", "Zeilenumbruch im Absatz wird Leerzeichen, zwei Absätze bleiben");

console.log("── Gedächtnis ─────────────────────────────────────────────────────");
ok(istSensibel("Kunde ist gerade krank und im Krankenhaus"), "Gesundheit wird nie gemerkt");
ok(istSensibel("Er ist Muslim und fastet gerade"), "Religion wird nie gemerkt");
ok(!istSensibel("Arbeitet im Schichtdienst, abends ab 19 Uhr erreichbar"), "Erreichbarkeit wird gemerkt");
ok(!istSensibel("Will die Karte für den Urlaub im Oktober"), "Ziel des Kunden wird gemerkt");

console.log("── Regeln im Quelltext ────────────────────────────────────────────");
const aktion = quelle("server/lib/fiaon-mara-aktion.ts");
for (const [muster, satz] of [
  [/werbung_gesperrt_am IS NULL/, "Werbesperre stoppt"],
  [/is_blocked, FALSE\) = FALSE/, "Vertriebssperre stoppt"],
  [/payment_status = 'paid'/, "Wer bezahlt hat, bekommt nichts mehr"],
  [/fiaon_telefonkartei_storno/, "Storno stoppt"],
  [/stopp\\\\\\\\\?"/, "„Stopp“-Antwort stoppt"],
  [/fiaon_mara_ausschluss/, "Aus der Aktion genommen stoppt"],
  [/INTERVAL '7 days'\)/, "Kunde schreibt selbst → 7 Tage Pause"],
  [/INTERVAL '12 hours'/, "Mitarbeiter gerade dran → Pause"],
  [/INTERVAL '6 hours'/, "Andere Mail gerade raus → Pause"],
  [/'gebounct', 'blockiert', 'spam'/, "Zustellproblem stoppt"],
  [/INTERVAL '2 days' WHEN 2 THEN INTERVAL '4 days' WHEN 3 THEN INTERVAL '7 days' ELSE INTERVAL '14 days'/, "Takt 2 / 4 / 7 / 14 Tage"],
  [/\[200, 400, 800\]/, "Anlauf 200 / 400 / 800"],
  [/x === "A" \|\| x === "B"/, "Stufe C lässt sich nicht einschalten"],
  [/gekuendigt_am IS NULL AND a\.cancelled_at IS NULL/, "Gekündigt und storniert bleiben draußen"],
  [/kostenHeute\(DIENST\)/, "Eigener Kostendeckel"],
] as [RegExp, string][]) ok(muster.test(aktion), satz);
ok(/requireChef\("inhaber"\)/.test(quelle("server/routes/fiaon-mara-steuerpult.ts")), "Steuerpult nur für Stufe Inhaber");
const agent = quelle("server/lib/fiaon-postmeister-agent.ts");
ok(/merken: \{ type: "array"/.test(agent) && /gedaechtnisMerken\(ein\.personId, roh\?\.merken/.test(agent), "Mara merkt sich nach jeder Antwort Neues");
ok(/ERSTES NEIN/.test(agent) && /erst beim ZWEITEN ausdrücklichen Nein/.test(agent), "Beim ersten „zahle ich nicht“ freundlich, Härte erst beim zweiten Nein");
ok(/DEIN TON: herzlich, positiv und motivierend/.test(agent), "Neuer Ton in jeder Antwort");
ok(/maxZeichen: 20_000/.test(agent), "Größerer Weg des Kunden für Antworten");
const weg = quelle("server/lib/fiaon-kundenweg.ts");
ok(/insgesamt \$\{rest\.length\}× seit/.test(weg), "Gleiche Automatik-Mails im Weg zusammengefasst");
ok(/Mara schreibt von sich aus/.test(weg) && /event <> 'mara_aktion'/.test(weg), "Maras Aktions-Mails stehen einmal im Weg (mit Inhalt)");

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
