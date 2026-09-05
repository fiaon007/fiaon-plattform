// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND SCHREIBEN — jede Vorlage aus server/lib/fiaon-schreiben.ts wird mit
// Beispieldaten gerendert, in Sätze zerlegt und durch die Wortwand geschickt.
//
// Warum ein eigener Prüfstand: Die Schreiben gehen unterschrieben an Banken,
// Behörden und Anbieter. Ein Wort wie „garantiert“ oder „Beratung“ darin ist
// kein Stilfehler, sondern eine Falschaussage im Namen des Kunden. Die Wand
// (shared/fiaon-wortverbote.ts) ist dieselbe wie für Mails und Copilot.
//
// Zusätzlich: kein Prozentzeichen, keine Zeitprognose, kein „Ihnen stehen zu“,
// Sie-Form in den Kundenhinweisen, deutsche Anführungszeichen im Quelltext.
//
//   npx tsx scripts/pruef-schreiben.ts            → Exit 1 bei Treffern
//   npx tsx scripts/pruef-schreiben.ts --pdf DIR  → druckt zusätzlich jede Vorlage als PDF nach DIR
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import {
  ANTRAGSARTEN, schreibenErzeugen, unterschriftHtml, unterschriftEinsetzen,
  schreibenAlsPdf, hashVon, datumPlusMonate, antragsArtFuerRegel,
  type SchreibenArt, type SchreibenDaten,
} from "../server/lib/fiaon-schreiben";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

/** HTML → Fließtext (Blockgrenzen werden Zeilenumbrüche). */
function textAus(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6]|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Sätze: an Satzzeichen und Zeilenumbrüchen trennen; „§ 850c ZPO.“-Punkte hinter Ziffern bleiben zusammen. */
function saetze(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const BEISPIEL: SchreibenDaten = {
  kunde: { vorname: "Maria", nachname: "Beispiel", strasse: "Musterstraße 12", plz: "10115", ort: "Berlin", geburtsdatum: "1987-04-03" },
  aktenzeichen: "AZ 2026-000123",
  datum: "05.09.2026",
  antworten: {
    p_konto: true, pfaendung: true, unterhalt: 2, familienstand: "getrennt",
    netto_cents: 145_000, warmmiete_cents: 78_000, haushalt: 3,
    sozialleistung: true, rundfunk_gezahlt: true, kfz_handy: ["kfz", "handy"],
  },
  betragCents: 93_025,
  empfaenger: null,
  vollmachtUmfang: null,
  bezug: { aktenzeichen: "AZ 2026-000120", versandtAm: "2026-08-10", empfaenger: "Musterbank AG" },
  vertrag: { nummer: "KV-4711-08", kennzeichen: "B-MB 1234" },
};

/** Zweite Datenlage: Antworten fehlen, Empfänger bekannt, Vollmacht mit Teilumfang. */
const BEISPIEL_LEER: SchreibenDaten = {
  kunde: { vorname: "Ahmet", nachname: "Yilmaz", strasse: "Hafenweg 3", plz: "20457", ort: "Hamburg" },
  aktenzeichen: "AZ 2026-000124",
  datum: "31.01.2026",
  antworten: {},
  betragCents: null,
  empfaenger: { name: "Musterbank AG", adresse: "Bankplatz 1\n60311 Frankfurt am Main" },
  vollmachtUmfang: ["p_konto", "rundfunk", "unsinn"],
  bezug: null,
  vertrag: null,
};

const ARTEN: SchreibenArt[] = ["vollmacht", ...ANTRAGSARTEN, "nachfass"];

const PROGNOSE = /\b(bald|in kürze|demnächst|zeitnah|innerhalb von)\b/i;
const ZUSTEHEN = /\b(steht|stehen)\s+(ihnen|mir)\s+zu\b|\bzusteh\w*/i;
const DU_FORM = /\b(du|dir|dich|dein\w*)\b/i;

async function main(): Promise<void> {
  const pdfDirIdx = process.argv.indexOf("--pdf");
  const pdfDir = pdfDirIdx > -1 ? process.argv[pdfDirIdx + 1] : null;

  titel("Quelltext: Anführungszeichen und Backticks");
  const quelle = readFileSync(join(process.cwd(), "server/lib/fiaon-schreiben.ts"), "utf8");
  pruef("kein gerades Anführungszeichen direkt nach „", !/„[^“\n]*"/.test(quelle), "Vite beendet den String am geraden Zeichen");
  pruef("keine Kundenzeile im Quelltext endet mit Zeitprognose", !PROGNOSE.test(quelle.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));

  for (const daten of [BEISPIEL, BEISPIEL_LEER]) {
    titel(`Vorlagen mit Beispieldaten (${daten.kunde.vorname} ${daten.kunde.nachname}, ${daten.aktenzeichen})`);
    for (const art of ARTEN) {
      const s = schreibenErzeugen(art, daten);
      const text = textAus(s.html);
      const alleSaetze = [...saetze(text), ...saetze(s.hinweisFuerKunden), s.titel, s.fusszeile];

      let treffer = 0;
      for (const satz of alleSaetze) {
        const funde = wandPruefen(satz);
        if (funde.length) {
          treffer += funde.length;
          for (const f of funde) console.log(`        [${art}] ${f.art}: „${f.treffer}“ in: ${satz.slice(0, 110)}`);
        }
      }
      pruef(`${art}: Wortwand 0 Treffer`, treffer === 0, `${treffer} Treffer`);
      pruef(`${art}: kein Prozentzeichen`, !text.includes("%") && !s.hinweisFuerKunden.includes("%"));
      pruef(`${art}: keine Zeitprognose`, !PROGNOSE.test(text) && !PROGNOSE.test(s.hinweisFuerKunden));
      pruef(`${art}: kein „stehen zu“`, !ZUSTEHEN.test(text) && !ZUSTEHEN.test(s.hinweisFuerKunden));
      pruef(`${art}: Kundenhinweis in Sie-Form`, !DU_FORM.test(s.hinweisFuerKunden) && /\bSie\b|\bIhr\w*\b/.test(s.hinweisFuerKunden));
      pruef(`${art}: Ich-Form im Schreiben`, art === "vollmacht" || /\bIch, /.test(text));
      pruef(`${art}: Absender ist der Kunde`, text.startsWith(`${daten.kunde.vorname} ${daten.kunde.nachname}`));
      pruef(`${art}: Empfänger und Titel gesetzt`, s.empfaengerName.length > 0 && s.titel.length > 0);
      pruef(`${art}: Fußzeile trägt das Aktenzeichen`, s.fusszeile.includes(daten.aktenzeichen) && s.fusszeile.startsWith("Übermittelt durch FIAON LTD"));
      pruef(`${art}: keine Adress-Rohdaten unescaped`, !s.html.includes("<script"));

      if (pdfDir) {
        mkdirSync(pdfDir, { recursive: true });
        const mitUnterschrift = unterschriftEinsetzen(s.html, unterschriftHtml("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", `${daten.kunde.vorname} ${daten.kunde.nachname}`, "05.09.2026, 14:32 Uhr"));
        const pdf = await schreibenAlsPdf(mitUnterschrift, s.titel, s.fusszeile);
        const pfad = join(pdfDir, `${daten.aktenzeichen.replace(/\W+/g, "_")}_${art}.pdf`);
        writeFileSync(pfad, pdf);
        pruef(`${art}: PDF geschrieben (${pdf.length} Bytes)`, pdf.length > 1000 && pdf.subarray(0, 4).toString() === "%PDF", pfad);
      }
    }
  }

  titel("Unterschriftblock, Einsetzen, Hash, Hilfsfunktionen");
  const s = schreibenErzeugen("p_konto", BEISPIEL);
  const block = unterschriftHtml("data:image/png;base64,AAAA", "Maria Beispiel", "05.09.2026, 14:32 Uhr");
  pruef("Unterschriftblock enthält Bild, Name, Zeitpunkt", block.includes("<img") && block.includes("Maria Beispiel") && block.includes("unterschrieben am 05.09.2026, 14:32 Uhr"));
  pruef("kein Bild bei fremdem Datenformat", !unterschriftHtml("javascript:alert(1)", "X", "y").includes("<img"));
  pruef("Name im Block wird escaped", unterschriftHtml("", "<b>x</b>", "y").includes("&lt;b&gt;"));
  const eingesetzt = unterschriftEinsetzen(s.html, block);
  pruef("Block landet an der Platzhalterstelle über dem Namen", !eingesetzt.includes("unterschrift-platz") && eingesetzt.indexOf(block) < eingesetzt.lastIndexOf("Maria Beispiel"));
  pruef("Hash ist SHA-256 hex und stabil", /^[0-9a-f]{64}$/.test(hashVon(s.html)) && hashVon(s.html) === hashVon(schreibenErzeugen("p_konto", BEISPIEL).html));
  pruef("Hash ändert sich mit der Unterschrift", hashVon(s.html) !== hashVon(eingesetzt));
  pruef("datumPlusMonate: 05.09.2026 + 12 = 05.09.2027", datumPlusMonate("05.09.2026", 12) === "05.09.2027");
  pruef("datumPlusMonate: 31.01.2026 + 1 = 28.02.2026", datumPlusMonate("31.01.2026", 1) === "28.02.2026");
  pruef("datumPlusMonate: 29.02.2028 + 12 = 28.02.2029", datumPlusMonate("29.02.2028", 12) === "28.02.2029");
  pruef("Vollmacht nennt das Ablaufdatum", textAus(schreibenErzeugen("vollmacht", BEISPIEL).html).includes("bis zum 05.09.2027"));
  const teil = textAus(schreibenErzeugen("vollmacht", BEISPIEL_LEER).html);
  pruef("Vollmacht mit Teilumfang: nur gewählte Zeilen", teil.includes("Höherer Schutzbetrag") && teil.includes("Rundfunkbeitrag") && !teil.includes("Wohngeldstelle") && !teil.includes("Kfz"));
  pruef("Vollmacht ohne Umfang: alle sechs Zeilen", (textAus(schreibenErzeugen("vollmacht", BEISPIEL).html).match(/ – Übermittlung an /g) || []).length === 6);
  pruef("P-Konto nennt Personenzahl und Betrag aus den Daten", textAus(s.html).includes("zwei unterhaltsberechtigte Personen") && textAus(s.html).includes("930,25"));
  pruef("P-Konto ohne Antworten: kein Betrag, keine Zahl erfunden", !/\d+,\d{2}\s?€/.test(textAus(schreibenErzeugen("p_konto", BEISPIEL_LEER).html)));
  pruef("Wohngeld ohne Antworten: keine Angabenliste", !textAus(schreibenErzeugen("wohngeld", BEISPIEL_LEER).html).includes("Zu meiner Situation"));
  pruef("Empfänger aus den Daten wird übernommen", schreibenErzeugen("p_konto", BEISPIEL_LEER).empfaengerName === "Musterbank AG");
  pruef("Nachfass nennt Bezug-Aktenzeichen und Datum", textAus(schreibenErzeugen("nachfass", BEISPIEL).html).includes("AZ 2026-000120") && textAus(schreibenErzeugen("nachfass", BEISPIEL).html).includes("10.08.2026"));
  pruef("Regel → Antragsart", antragsArtFuerRegel("p_konto_erhoehung") === "p_konto" && antragsArtFuerRegel("kfz_vergleich") === "kfz" && antragsArtFuerRegel("x") === null);
  pruef("HTML escaped Kundendaten", schreibenErzeugen("rundfunk", { ...BEISPIEL, kunde: { ...BEISPIEL.kunde, nachname: "<img src=x>" } }).html.includes("&lt;img src=x&gt;"));

  console.log(`\n${ok} ok, ${rot} rot`);
  if (rot > 0) {
    console.log("\nROT:");
    for (const f of fehler) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
