// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 NACHBESSERUNG (20.10.2026), OFFLINE — Teil 2 der Prüfer-Funde, rein und am Quelltext.
// Je Fund mindestens ein Fall, der auf dem Stand VOR der Korrektur rot ist. Erfundene Texte, keine Kundendaten.
//   npx tsx scripts/pruef-e409-nachbesserung.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 400)}` : ""}`); }
};
const datei = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
/** Ein Abschnitt für sich: fehlt auf dem alten Stand eine Funktion, zählt das als rot statt den Prüfstand abzubrechen. */
const abschnitt = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); } catch (e) { ok(false, `${name}: Abbruch`, String((e as Error)?.message ?? e).slice(0, 200)); }
};

async function main() {
  const R: any = await import("../shared/fiaon-ki-pruefung-regeln");
  const regeln = (text: string, telefon: any) => (R.harteRegeln(text, { kanal: "telefon", telefon }) as { regel: string; schwere: string }[]);
  const hart = (l: { regel: string; schwere: string }[]) => l.filter((p) => p.schwere === "hart").map((p) => p.regel);

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 7 · Telefon: die Regeln lesen nur, was ARAS sagt");
  await abschnitt("Fund 7", () => {
    const zeilen = [
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Herrn Beispielmann?" },
      { wer: "kunde", text: "Ja. Und hören Sie auf mich anzurufen, sonst gehe ich zum Anwalt!" },
      { wer: "aras", text: "Das verstehe ich gut. Ich trage ein, dass wir Sie nicht mehr anrufen. Einen schönen Tag noch." },
    ];
    const text = zeilen.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n");
    const r = regeln(text, { kiHinweisSek: 3, aufnahmeJaSek: 10, aufnahmeGestartetSek: 11, transkript: zeilen });
    ok(!hart(r).some((x) => ["druck", "drohung"].includes(x)), "„Sonst gehe ich zum Anwalt“ vom KUNDEN ist kein Druck von Aras", r);
    const zeilen2 = [...zeilen.slice(0, 2), { wer: "aras", text: "Wenn Sie nicht zahlen, geht das an Inkasso." }];
    const text2 = zeilen2.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n");
    ok(hart(regeln(text2, { kiHinweisSek: 3, transkript: zeilen2 })).some((x) => ["druck", "drohung"].includes(x)), "… droht ARAS selbst, bleibt es ein harter Fehler");
    ok(R.arasText("ARAS: Hallo.\nKUNDE: Sonst Anwalt!\nnoch Kunde\nARAS: Tschüss.") === "Hallo.\nTschüss.", "arasText: Kundenzeilen (auch Folgezeilen) fallen weg", R.arasText?.("ARAS: Hallo.\nKUNDE: Sonst Anwalt!\nnoch Kunde\nARAS: Tschüss."));
    ok(R.arasText("Guten Tag.\nBis bald.") === "Guten Tag.\nBis bald.", "ohne Marken bleibt alles Aras (Teams 1 Live-Text)");
    const t1 = R.telefonRegeln("Guten Tag, hier ist Aras von FIAON, eine KI.", { kiHinweisSek: 2, transkript: [{ wer: "kunde", text: "Hallo?" }, { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, eine KI. Es geht um Ihre Rate über 59,99 Euro." }] });
    ok(t1.some((p: any) => p.regel === "anliegen_vor_identitaet") && !t1.some((p: any) => /^ton_/.test(p.regel)), "telefonRegeln (Teams 1 Form, ohne Ton) mit derselben Identitäts-Regel", t1.map((p: any) => p.regel));
    const live = R.liveBefundPunkte({ live: true, punkte: [{ regel: "druck", schwere: "hart" }, { regel: "amd_widerspruch", schwere: "weich" }] });
    ok(live.length === 2 && live[0].schwere === "hart" && /Live-Prüfung ohne Aufnahme/.test(live[0].hinweis) && live[0].treffer === "", "Teams 1 Live-Befund wird gelesen (Schlüssel + Schwere, kein Wortlaut)", live);
    ok(R.liveBefundPunkte(null).length === 0 && R.liveBefundPunkte({ punkte: [{ regel: "druck", schwere: "hart" }] }).length === 0 && R.liveBefundPunkte("kaputt").length === 0, "ohne live: true oder kaputt → nichts");
    const zus = R.punkteZusammen([{ regel: "druck", schwere: "hart", treffer: "x", hinweis: "" }], live);
    ok(zus.length === 2 && zus[0].treffer === "x", "punkteZusammen: jede Regel einmal", zus.map((p: any) => p.regel));
    const srv = datei("server/lib/fiaon-ki-pruefung.ts");
    ok(/regelText: zeilen \? arasText\(text\) : ""/.test(srv) && /modellText: zeilen \? text : ""/.test(srv), "Server: ohne Transkript keine Textregeln und kein Modell auf der Zusammenfassung");
    ok(/Bewerte NUR die ARAS-Zeilen/.test(srv), "Anweisung ans Modell: nur ARAS bewerten");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 8 · Anliegen erst nach Identität — über das ganze Gespräch, und nur mit Gesprächsanfang");
  await abschnitt("Fund 8", () => {
    const pruefer = [{ wer: "kunde", text: "Hallo?" }, { wer: "aras", text: "Hier ist Aras von FIAON. Es geht um Ihre Rate über 59,99 €." }, { wer: "kunde", text: "Wer?" }];
    ok(!!R.anliegenVorIdentitaet(pruefer), "Beispiel des Prüfers: [Hallo?] [… Rate 59,99 €] [Wer?] → Treffer");
    const dritte = [
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin eine KI. Spreche ich mit Herrn Beispielmann?" },
      { wer: "kunde", text: "Nein, hier ist seine Frau." },
      { wer: "aras", text: "Danke. Es geht um seine Rate über 59,99 Euro." },
    ];
    ok(!!R.anliegenVorIdentitaet(dritte), "Dritte am Telefon („hier ist seine Frau“) → Treffer");
    const sauber = [
      { wer: "kunde", text: "Hallo?" },
      { wer: "aras", text: "Guten Tag, hier ist Aras von FIAON — ich bin eine KI. Spreche ich mit Frau Beispiel?" },
      { wer: "kunde", text: "Ja, am Apparat." },
      { wer: "aras", text: "Schön. Es geht um Ihre Rate 2 über 59,99 Euro." },
    ];
    ok(R.anliegenVorIdentitaet(sauber) === null, "Ja NACH der Identitätsfrage, dann die Rate → in Ordnung");
    const jaVorher = [{ wer: "kunde", text: "Ja?" }, { wer: "aras", text: "Hier ist Aras von FIAON, eine KI. Es geht um Ihre Rate." }];
    ok(!!R.anliegenVorIdentitaet(jaVorher), "ein „Ja?“ beim Abheben bestätigt nichts");
    const abJa = [{ wer: "aras", text: "Danke! Dann kurz zu Ihrer Rate 3 über 59,99 Euro." }, { wer: "kunde", text: "Ja, ich zahle am Freitag." }];
    ok(R.anliegenVorIdentitaet(abJa) === null, "Transkript erst ab dem Aufnahme-Ja (kein Anfang) → nicht prüfbar, kein Fehler");
    const r = regeln(abJa.map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${z.text}`).join("\n"), { kiHinweisSek: null, transkript: abJa });
    ok(!hart(r).length && r.some((p) => p.regel === "ki_hinweis_unbelegt" && p.schwere === "weich"), "… und kein harter „KI-Hinweis fehlt“ — nur ein weicher Punkt", r);
    const t1 = [{ wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Herrn Beispielmann?" }, { wer: "kunde", text: "Ja." }, { wer: "aras", text: "Ich rufe wegen Ihrer Rate 2 über 59,99 Euro an." }];
    ok(R.anliegenVorIdentitaet(t1) === null && hart(regeln("ARAS: x", { kiHinweisSek: null, transkript: [{ wer: "aras", text: "Hallo, hier ist Aras." }, { wer: "kunde", text: "Ja?" }] })).includes("ki_hinweis_fehlt"), "mit Anfang ohne KI-Hinweis bleibt es hart (wie bisher)");
  });

  // ═════════════════════════════════════════════════════════════════════
  console.log("── Fund 16 · „gelb → grün“ je Werkzeug, Takt-Deckel, Historie nur bei Arbeit");
  await abschnitt("Fund 16", () => {
    const fq = R.fehlerquoteRechnen(
      [{ kanal: "whatsapp", schluessel: "antwort", n: 40, auffaellig: 0 }, { kanal: "mail", schluessel: "postfach:support", n: 30, auffaellig: 0 }],
      { tage: 28, gelb: ["ratenpause_setzen"], werkzeuge: [{ schluessel: "ratenpause_setzen", n: 24, auffaellig: 0 }] },
    );
    ok(fq.vorschlaege.length === 1 && fq.vorschlaege[0].includes("ratenpause_setzen"), "Vorschlag aus der Quote je Werkzeug (die Kanal-Schlüssel heißen nie wie ein Werkzeug)", fq.vorschlaege);
    ok(fq.gesamt.n === 70, "die Werkzeug-Zeilen zählen nicht doppelt in die Gesamtquote", fq.gesamt);
    const srv = datei("server/lib/fiaon-ki-pruefung.ts");
    ok(/export const MODELL_JE_LAUF = 2;/.test(srv) && /export const MODELL_JE_STUNDE = 60;/.test(srv), "höchstens 2 Modell-Fragen je Lauf, 60 je Stunde");
    ok(/modell = \$\{modell\.urteil \? modell\.modell : "regeln"\}/.test(srv), "die Spalte modell nennt ein Modell nur mit Urteil");
    const routes = datei("server/routes.ts");
    ok(/tageslauf\('ki_pruefung',[^\n]*pruefungTaktFuerHistorie\(\)[^\n]*nurMitErgebnis: true/.test(routes), "Takt mit nurMitErgebnis (keine 720 Historienzeilen am Tag)");
  });

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
