// Prüfstand E-406 B1 Nachbesserung (19.10.2026), ohne Datenbank: Mail-Mara hält den genannten Zahltag fest.
// Prüfer-Fund: Maras Raten-Mail sagt „Schreiben Sie mir einfach, wann Sie zahlen“ — der Postmeister hatte kein Werkzeug,
// das die Zusage festhält. Hier: die reine Regel (shared/fiaon-zahlungszusage.ts), Hinweise, die Antwortprüfung, die
// Vorlage und der Einbau in Postfach und Lauf (Quelltext) — mit Rot-Proben. Alle Texte sind erfunden.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin DATABASE_URL=postgresql://nobody@127.0.0.1:1/none \
//     node_modules/.bin/tsx scripts/pruef-mara-zahlungszusage.ts
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
let netz = 0;
globalThis.fetch = (async () => { netz++; return new Response("kein Netz im Prüfstand", { status: 599 }); }) as any;

import { readFileSync } from "node:fs";
import * as Z from "../shared/fiaon-zahlungszusage";
import { tonPruefung } from "../shared/fiaon-mara-ton";
import { wandPruefen } from "../shared/fiaon-wortverbote";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ohneKommentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// Montag, 19.10.2026 — der Tag, an dem er schreibt.
const B = "2026-10-19";
const E = (t: string, o: { zahlFrage?: boolean; letzteMara?: string | null } = {}) => Z.zahltagErkennen(t, B, o);
const tag = (t: string, o?: any) => { const e = E(t, o); return e?.art === "tag" ? e.datum : null; };
const unklar = (t: string, o?: any) => { const e = E(t, o); return e?.art === "unklar" ? e.grund : null; };

async function main() {
  abschnitt("1 · Er nennt einen klaren Tag (Bezug: Mo, 19.10.2026)");
  ok(tag("Ich zahle am Freitag.") === "2026-10-23", "„am Freitag“ → Fr, 23.10.");
  ok(tag("Guten Morgen, ich zahle am Freitag.") === "2026-10-23", "„Guten Morgen“ ist ein Gruß, kein Zahltag");
  ok(tag("Ich überweise am 23.10.") === "2026-10-23" && tag("Überweise am 23.10.2026 die Rate") === "2026-10-23", "23.10. und 23.10.2026");
  ok(tag("Ich überweise am 23.10. 59,99 €") === "2026-10-23", "ein Betrag hinter dem Datum ist kein Jahr");
  ok(tag("Die Rate vom 18.10. zahle ich am 23.10.") === "2026-10-23", "die Fälligkeit (vergangen) neben dem Zahltag ist Rückbezug");
  ok(tag("Ich zahle am 23. Oktober") === "2026-10-23" && tag("zahle am 5. November") === "2026-11-05", "Tag mit Monatsname");
  ok(tag("Ich zahle morgen") === "2026-10-20" && tag("Überweise übermorgen") === "2026-10-21" && tag("Ich überweise heute noch") === B, "morgen, übermorgen, heute");
  ok(tag("Ich zahle nächste Woche Mittwoch") === "2026-10-28", "„nächste Woche Mittwoch“ → Mi der nächsten Kalenderwoche");
  ok(tag("Ich zahle am Montag") === "2026-10-26", "derselbe Wochentag wie heute → in sieben Tagen");
  ok(tag("Ich zahle Ende des Monats") === "2026-10-31" && tag("zahle zum Monatsende") === "2026-10-31", "Monatsende → letzter Tag des Monats");
  ok(tag("Ich zahle in zwei Wochen") === "2026-11-02" && tag("Ich überweise in 3 Tagen") === "2026-10-22", "in zwei Wochen / in 3 Tagen");
  ok(tag("Ich zahle am Fr. die Rate") === "2026-10-23", "„Fr.“ trennt keinen Satz und ist Freitag");
  ok(tag("Ich zahle am 2.1.") === "2027-01-02", "ein Tag weit zurück im Jahr → nächstes Jahr");
  ok(tag("Kann ich auch am Freitag zahlen?") === "2026-10-23" && tag("Ist es ok, wenn ich am 23.10. überweise?") === "2026-10-23", "eine Frage, die einen Tag VORSCHLÄGT, gilt");
  ok(tag("Ich kann am Freitag nicht, aber am Montag zahle ich") === "2026-10-26", "„nicht am Freitag, aber am Montag“ → Montag");
  ok(tag("Keine Sorge, ich zahle am Freitag") === "2026-10-23" && tag("Kein Problem, überweise morgen") === "2026-10-20", "„keine Sorge“/„kein Problem“ ist keine Verneinung");
  ok(tag("Ich werde am Freitag überweisen, das habe ich schon geplant") === "2026-10-23", "Futur schlägt „habe schon“");
  ok(tag("Überweisung geht am Freitag raus. Mit freundlichen Grüßen Max") === "2026-10-23", "„Überweisung geht … raus“ mit Gruß");
  ok(tag("Das Geld kommt am 23.10., dann überweise ich sofort") === "2026-10-23", "„Geld kommt am …“");
  ok(E("Ich zahle am Freitag.")?.art === "tag" && (E("Ich zahle am Freitag.") as any).quelle === "kunde", "Quelle: er selbst");

  abschnitt("2 · Kurze Antwort auf Maras Raten-Mail („wann Sie zahlen“)");
  const rateBetreff = "Re: Kurz von Mara: Ihre Monatsrate vom 18.10.2026";
  ok(Z.zahlFrage(rateBetreff, null) && !Z.zahlFrage("Re: Ihre Monatsrate 2 — FIAON-A1B2C3-2", null) && !Z.zahlFrage("Frage", null), "zahlFrage: nur Maras Raten-Mail (nicht jede Raten-Mail)");
  ok(Z.zahlFrage(null, "Danke! Wann können Sie die Rate überweisen?"), "zahlFrage: Maras eigene Frage „wann … überweisen?“");
  ok(tag("Am Freitag.", { zahlFrage: true }) === "2026-10-23" && tag("Mach ich am Freitag, danke!", { zahlFrage: true }) === "2026-10-23", "„Am Freitag.“ / „Mach ich am Freitag“ als Antwort → Zahltag");
  ok(E("Am Freitag.") === null, "… ohne Frage nach dem Zahltag kein Zahltag");
  ok(E("Bitte schicken Sie mir die Rechnung bis Freitag", { zahlFrage: true }) === null, "„schicken Sie mir die Rechnung bis Freitag“ ist kein Zahltag");
  ok(E("Am Freitag um 10 Uhr passt mir ein Anruf", { zahlFrage: true }) === null, "ein Termin am Freitag ist kein Zahltag");
  ok(E("Hallo Mara, vielen Dank für die freundliche Nachricht. Ich habe gerade viel um die Ohren und melde mich am Freitag wieder bei Ihnen, versprochen.", { zahlFrage: true }) === null, "lange Nachricht ohne Zahlwort → kein Zahltag");

  abschnitt("3 · „Ja“ auf Maras Rückfrage");
  ok(tag("Ja", { letzteMara: "Gern! Meinen Sie Freitag, den 23.10.?" }) === "2026-10-23" && (E("Ja", { letzteMara: "Gern! Meinen Sie Freitag, den 23.10.?" }) as any).quelle === "rueckfrage", "„Ja“ → ihr Tag (Quelle Rückfrage)");
  ok(tag("Genau, danke", { letzteMara: "Meinen Sie den 1.11.?" }) === "2026-11-01", "„Genau“ → ihr Tag");
  ok(E("Ja gerne", { letzteMara: "Darf ich Ihren Rückruf am Freitag um 10 Uhr eintragen?" }) === null, "Ja auf einen RÜCKRUF ist kein Zahltag");
  ok(E("Ja", { letzteMara: "Meinen Sie Freitag, den 30.10.?" }) === null, "Wochentag und Datum passen nicht zusammen → nichts (nie raten)");
  ok(E("Ja, aber nicht am Freitag", { letzteMara: "Meinen Sie Freitag, den 23.10.?" })?.art !== "tag", "„Ja, aber nicht …“ → kein Zahltag");
  ok(E("Ja", { letzteMara: null }) === null, "„Ja“ ohne Rückfrage → nichts");

  abschnitt("4 · Unklar → Mara fragt nach (nie geraten, E-248 #621)");
  ok(unklar("Ich kann erst am 15. zahlen") === "ohne_monat" && unklar("zahlen an 1") === "ohne_monat", "„am 15.“ / „zahlen an 1“ → ohne Monat");
  ok(unklar("Ich zahle nächste Woche") === "vage" && unklar("Ich überweise Anfang des Monats") === "vage" && unklar("Ich zahle, sobald mein Gehalt kommt") === "vage", "„nächste Woche“, „Anfang des Monats“, „sobald“ → vage");
  ok(unklar("Muss ich bis Freitag zahlen?") === "frage", "eine Frage nach der Frist ist kein Zahltag");
  ok(unklar("Ich kann am Freitag nicht zahlen") === "verneint", "„am Freitag NICHT“ → verneint");
  ok(unklar("Ich zahle am 23.10. und den Rest am 5.11.") === "mehrere", "zwei Tage → mehrere");

  abschnitt("5 · Kein Zahltag (null)");
  ok(E("Ich habe am Freitag überwiesen") === null && E("Ich habe die Rate gestern bezahlt.") === null && E("Heute morgen habe ich überwiesen") === null, "Vergangenheit („habe überwiesen/bezahlt“) → nichts (das ist zahlung_suchen)");
  ok(E("Ich kann gerade nicht zahlen") === null, "„kann nicht zahlen“ ohne Tag → nichts");
  ok(E("Wann kommt meine Karte?") === null && E("") === null, "kein Zahlwort / leer → nichts");
  ok(Z.zahltagErkennen("Ich zahle am Freitag", "kaputt") === null, "kaputter Bezugstag → nichts");

  abschnitt("6 · Das Urteil");
  const r = (nr: number, faellig: string, zusage: string | null = null): Z.ZusageRate => ({ id: 100 + nr, nr, ref: "FIAON-PRUEF-E406", faellig, zusage });
  const fr = E("Ich zahle am Freitag.");
  const u1 = Z.zusageUrteil({ erkennung: fr, heute: B, raten: [r(2, "2026-10-18"), r(3, "2026-11-18")], personZusage: null });
  ok(u1?.art === "merken" && u1.datum === "2026-10-23" && u1.raten.map((x) => x.nr).join() === "2" && !u1.schon, "merken: nur die Rate, die bis dahin fällig ist (Rate 2, nicht Rate 3)", u1);
  const u2 = Z.zusageUrteil({ erkennung: fr, heute: B, raten: [r(2, "2026-10-18", "2026-10-23")], personZusage: "2026-10-23" });
  ok(u2?.art === "merken" && u2.schon, "steht schon so → schon (kein zweiter Eintrag)");
  ok(Z.zusageUrteil({ erkennung: fr, heute: B, raten: [r(2, "2026-10-18", "2026-10-23")], personZusage: "2026-10-30" })?.art === "merken"
    && !(Z.zusageUrteil({ erkennung: fr, heute: B, raten: [r(2, "2026-10-18", "2026-10-23")], personZusage: "2026-10-30" }) as any).schon, "ein anderer Tag an der Person → neu festhalten (sein jüngstes Wort gilt)");
  ok(Z.zusageUrteil({ erkennung: fr, heute: "2026-10-26", raten: [r(2, "2026-10-18")], personZusage: null })?.art === "vergangen", "Mail lag bis nach dem Tag → vergangen (nichts festhalten)");
  const weit = Z.zahltagErkennen("Ich zahle am 25.11.", B);
  ok(Z.zusageUrteil({ erkennung: weit, heute: B, raten: [r(2, "2026-10-18")], personZusage: null })?.art === "zu_weit", `mehr als ${Z.ZUSAGE_HOECHSTENS_TAGE} Tage → zu weit (eine Pause, keine Zusage)`);
  ok(Z.zusageUrteil({ erkennung: Z.zahltagErkennen("Ich zahle am 19.11.", B), heute: B, raten: [r(2, "2026-10-18")], personZusage: null })?.art === "merken", "genau 31 Tage → noch eine Zusage");
  ok(Z.zusageUrteil({ erkennung: fr, heute: B, raten: [], personZusage: null })?.art === "keine_rate", "keine offene (geschuldete) Rate → nichts festzuhalten");
  ok(Z.zusageUrteil({ erkennung: fr, heute: B, raten: [r(3, "2026-11-18")], personZusage: null })?.art === "puenktlich", "Tag vor der nächsten Fälligkeit → pünktlich, nichts festzuhalten");
  ok(Z.zusageUrteil({ erkennung: E("Ich zahle nächste Woche"), heute: B, raten: [r(2, "2026-10-18")], personZusage: null })?.art === "unklar", "unklar bleibt unklar");
  ok(Z.zusageUrteil({ erkennung: null, heute: B, raten: [r(2, "2026-10-18")], personZusage: null }) === null, "kein Zahltag → kein Urteil");

  abschnitt("7 · Was Mara sagt (Hinweis, Satz, Handlung)");
  const satz = Z.zusageSatz("2026-10-23");
  ok(satz === "Danke — ich habe mir Ihren Zahltag notiert: Freitag, 23.10.", "der eine Satz", satz);
  ok(tonPruefung(satz, { kanal: "mail" }).filter((b) => b.schwere === "hart").length === 0 && wandPruefen(satz).filter((w) => w.art === "verboten").length === 0, "der Satz besteht Ton und Wortwand");
  const h1 = Z.zusageHinweis(u1!, fr);
  ok(/FESTGEHALTEN/.test(h1) && h1.includes(satz) && /Keine Bitte, HEUTE zu zahlen/.test(h1) && /Versprich NICHT, dass bis dahin keine Erinnerung kommt/.test(h1), "Hinweis „merken“: Satz, keine Bitte für heute, keine Ruhe versprechen");
  const hU = Z.zusageHinweis({ art: "unklar", grund: "ohne_monat" }, E("Ich kann erst am 15. zahlen"));
  ok(/NICHT FESTGEHALTEN/.test(hU) && /Meinen Sie \[Wochentag\], den \[TT\.MM\.\]\?/.test(hU) && /NICHT „notiert“/.test(hU), "Hinweis „unklar“: Rückfrage mit Wochentag und Datum, nie „notiert“");
  const hW = Z.zusageHinweis({ art: "zu_weit", datum: "2026-11-25" });
  ok(/terminlink_bauen/.test(hW) && /keine Pause und keine Stundung/.test(hW), "Hinweis „zu weit“: Rückruf anbieten, keine Pause zusagen");
  const hS = Z.schwierigHinweis();
  ok(/terminlink_bauen/.test(hS) && /keine Pause, Stundung oder Verschiebung zu/.test(hS) && /keine Zahlungsbitte/.test(hS), "„kann nicht zahlen“: Rückruf statt Pause, keine Zahlungsbitte");
  ok(/festgehalten — zahlt Rate 2 am Freitag, 23\.10\./.test(Z.zusageHandlung(u1!, { geschrieben: true })) && /stand schon/.test(Z.zusageHandlung(u1!, { geschrieben: false })), "Handlung für die Postmeister-Zeile");
  ok(JSON.stringify(Z.zusageKurz(u1!)) === JSON.stringify({ art: "merken", datum: "2026-10-23", raten: [2], schon: false }), "Kurzform für werkzeugDaten");

  abschnitt("8 · Die Antwortprüfung (zusageAntwortFunde)");
  const F = Z.zusageAntwortFunde;
  ok(F(`Ihre Rate über 59,99 € ist noch offen. ${satz} Über den Knopf unten ist die Zahlungsseite bereit.`, u1!).length === 0, "festgehalten + richtiger Satz → frei");
  ok(F("Danke, ich habe mir den Freitag notiert.", null).length === 1, "„notiert“ ohne Lage → Mangel (niemand hat etwas festgehalten)");
  ok(F("Danke, ich habe mir den 15.11. als Zahltag notiert.", { art: "unklar", grund: "ohne_monat" }).some((f) => /Frag nach dem genauen Tag/.test(f)), "„notiert“ bei unklar → Mangel mit „frag nach“");
  ok(F("Ich habe mir Ihren Zahltag notiert: Freitag, 30.10.", u1!).some((f) => /anderen Tag/.test(f)), "ein anderer Tag als der festgehaltene → Mangel");
  ok(F("Bis dahin bekommen Sie von uns keine weitere Erinnerung.", u1!).length === 1 && F("Die Erinnerungen pausieren bis dahin.", u1!).length === 1, "„keine weitere Erinnerung“ / „Erinnerungen pausieren“ → Mangel (Mahnungen laufen weiter)");
  ok(F("Ihr Rückruf am Freitag ist eingetragen.", null).length === 0 && F("Ihr Gespräch am 23.10. um 10 Uhr ist bei uns eingetragen.", null).length === 0, "ein eingetragener Termin ist keine Zahltag-Behauptung");
  ok(F("Ihre Zahlung vom 12.10. ist eingegangen und vermerkt.", null).length === 0, "eine eingegangene Zahlung ist keine Zahltag-Behauptung");
  ok(F("Darf ich mir den Freitag als Zahltag notieren?", null).length === 0, "eine FRAGE ist keine Behauptung");
  ok(F("Ihre neue Adresse habe ich gespeichert.", null).length === 0, "Adresse gespeichert → kein Fund hier (das prüft angaben_aendern)");

  abschnitt("9 · Lage und Wände (zusageErlaubt)");
  ok(Z.zusageErlaubt({ lage: "rate_ueberfaellig" }) && Z.zusageErlaubt({ lage: "aktiv" }) && Z.zusageErlaubt({ lage: "gekuendigt" }), "Raten-Lagen: rate_ueberfaellig, aktiv, gekuendigt");
  ok(!Z.zusageErlaubt({ lage: "unbezahlt" }) && !Z.zusageErlaubt({ lage: "interessent" }) && !Z.zusageErlaubt({ lage: "zahlung_gemeldet" }) && !Z.zusageErlaubt({ lage: "gesperrt" }), "keine Raten-Lage → nie");
  ok(["bestreitet", "widerruf", "droht_anwalt", "rechtlich"].every((f) => !Z.zusageErlaubt({ lage: "rate_ueberfaellig", flags: { [f]: true } })), "Bestreiten, Widerruf, Anwalt, Recht → nie");
  ok(!Z.zusageErlaubt({ lage: "rate_ueberfaellig", global: true }) && !Z.zusageErlaubt({ lage: "rate_ueberfaellig", vorgeschichte: true }), "Global-Kunde und offener früherer Einwand → nie");
  ok(Z.zusageErlaubt({ lage: "rate_ueberfaellig", flags: { zahlungsunfaehig: true, stopp: true, kuendigung: true } }), "„kann nicht zahlen“, Stopp, Kündigung → ein genannter Tag gilt trotzdem");

  abschnitt("10 · Die Vorlage mara_rate_erinnerung (gerendert)");
  const motorMod = await import("../server/mail/motor");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const R = await import("../shared/fiaon-mara-rate-erinnerung");
  const eintrag = MAKE_EVENT_REGISTRY.find((e) => e.type === R.RATE_ERINNERUNG_EVENT);
  const m = motorMod.mailRendern(R.RATE_ERINNERUNG_EVENT, { ...(eintrag?.example ?? {}) } as any);
  const text = m?.text ?? "";
  ok(/2\. Kurz antworten:.*wann Sie zahlen.*ich notiere mir den Tag/s.test(text), "Weg 2: „wann Sie zahlen … ich notiere mir den Tag“ (jetzt gedeckt)");
  ok(/Gerade schwierig diesen Monat\? Wählen Sie einfach eine Rückruf-Zeit/.test(text) && !/Schreiben Sie es mir/.test(text), "Fußnote führt zum Rückruf — nicht mehr „Schreiben Sie es mir“ (per Mail setzt niemand eine Pause)");
  ok(R.textPruefen(`${m?.betreff ?? ""}\n\n${text}`).length === 0, "Textprüfung B1 bleibt grün", R.textPruefen(`${m?.betreff ?? ""}\n\n${text}`));
  ok(Z.zahlFrage(`Re: ${m?.betreff ?? ""}`, null) && Z.zahlFrage(`AW: ${m?.betreff ?? ""}`, null), "eine Antwort auf genau diesen Betreff zählt als Antwort auf „wann Sie zahlen“");

  abschnitt("11 · Der Einbau (Quelltext)");
  const pm = ohneKommentar(lies("server/lib/fiaon-postmeister-agent.ts"));
  const einbau = (q: string) => {
    const hook = q.indexOf("zuM.zahlungszusageBehandeln(");
    const modell = q.indexOf("const nachrichten: any[] = [");
    return hook > 0 && hook < modell
      && /zusageErlaubt\(\{ lage, flags: ein\.einordnung\.flags as any, global: !!akte\?\.global, vorgeschichte: !!ein\.vorgeschichte\?\.grund \}\)/.test(q)
      && /kundeText: kontext\.kundeText \?\? ""/.test(q) && /geschriebenAm: ein\.mail\.am \?\? null/.test(q)
      && /vorab\.push\(zusage\.hinweis\)/.test(q)
      && /fehlend\.push\(\.\.\.zusageAntwortFunde\(t, k\.zusage\?\.urteil \?\? null\)\)/.test(q)
      && /genannt, zahlung: zahlungGesucht, angaben,\s*zusage,/.test(q);
  };
  ok(einbau(pm), "Postfach: Server hält den Zahltag VOR Maras Antwort fest, gibt den Hinweis mit und prüft die Antwort");
  ok(/v\.von === "FIAON"/.test(pm) && /letzteMara/.test(pm), "Maras letzte Antwort aus dem Verlauf (für „Ja“ auf ihre Rückfrage)");
  ok(/flags\?\.zahlungsunfaehig && zusage\?\.urteil\.art !== "merken"[\s\S]{0,200}vorab\.push\(schwierigHinweis\(\)\)/.test(pm), "„kann nicht zahlen“ ohne Tag → Rückruf-Hinweis");
  ok(/am: mail\.datum \?\? null/.test(ohneKommentar(lies("server/lib/fiaon-postmeister-lauf.ts"))), "Lauf gibt den Tag mit, an dem er schrieb (Bezug für „Freitag“)");
  const srv = ohneKommentar(lies("server/lib/fiaon-mara-zahlungszusage.ts"));
  const schreibtRichtig = (q: string) => /UPDATE fiaon_persons SET promised_payment_date = \$\{e\.datum\}::date, follow_up_date = \$\{wv\}::date/.test(q)
    && /naechsterVersuch\(\{ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: e\.datum \}\)/.test(q)
    && /inkasso_zusage_am = \$\{e\.datum\}::date/.test(q)
    && /inkasso_wiedervorlage = GREATEST\(COALESCE\(inkasso_wiedervorlage, \$\{tagDanach\}::date\), \$\{tagDanach\}::date\)/.test(q)
    && /INSERT INTO fiaon_contact_log \(ref, person_id, agent_id, agent_name, type, note, promised_date\)/.test(q)
    && /lauf\.begin\(/.test(q);
  ok(schreibtRichtig(srv), "festhalten wie WhatsApp-Mara und Inkasso: Person (Zusage + Wiedervorlage der einen Regel), Rate (inkasso_zusage_am, Wiedervorlage), Verlauf — in einer Transaktion");
  ok(/ERINNERBARE_BESTELLUNG_SQL\("a"\)/.test(srv) && /FORDERUNG_AKTIV_SQL_FUER\("a", "r"\)/.test(srv), "nur geschuldete Raten (dieselben Wände wie Mahnmotor und Inkasso, E-391/E-394)");
  const abo = (q: string) => Array.from(q.matchAll(/UPDATE fiaon_abo_raten SET([\s\S]*?)WHERE/g)).map((x) => x[1]);
  const nurInkasso = (q: string) => abo(q).length === 1 && abo(q).every((set) => !/mahnstufe|erinnerungen|letzte_erinnerung_at|faellig_am|ueberfaellig_seit|status\s*=|bezahlt_am|vorab_am|eskaliert_am/.test(set));
  ok(nurInkasso(srv), "an der Rate NUR die Inkasso-Felder — Mahnstufe, Fälligkeit, Erinnerungen bleiben (E-182: nie bremsen)");
  const aboRoute = ohneKommentar(lies("server/routes/fiaon-abo.ts"));
  ok(!/inkasso_zusage_am|inkasso_wiedervorlage|promised_payment_date/.test(aboRoute), "der Mahnmotor liest keines dieser Felder — er läuft unverändert weiter");
  ok(!/openai|anthropic|kiAufruf/i.test(srv) && !/versendenUndProtokollieren|sendMakeWebhook|waSenden/.test(srv), "kein KI-Aufruf, kein Versand — nur festhalten");
  const pmWerkzeuge = ohneKommentar(lies("server/lib/fiaon-postmeister-werkzeuge.ts"));
  ok(!/promised_payment_date/.test(pmWerkzeuge), "die Werkzeugliste des Postmeisters bleibt, wie sie war (der Server hält fest, nicht das Modell)");

  abschnitt("12 · Rot-Proben (der Prüfstand sieht den Fehler)");
  // Ohne die Korrektur: Der Postfach-Lauf ohne den Zahltag-Schritt (Stand B1) — der Einbau-Check wird rot.
  const ohneSchritt = pm.replace(/const zusage = ein\.personId[\s\S]*?: null;/, "const zusage = null;");
  ok(!einbau(ohneSchritt), "Rot-Probe: Postfach ohne den Zahltag-Schritt (Stand B1) → Einbau-Check rot");
  ok(!einbau(pm.replace("fehlend.push(...zusageAntwortFunde(t, k.zusage?.urteil ?? null));", "")), "Rot-Probe: ohne Antwortprüfung → rot");
  ok(!schreibtRichtig(srv.replace(/inkasso_zusage_am = \$\{e\.datum\}::date,/, "")), "Rot-Probe: ohne inkasso_zusage_am → rot");
  ok(!nurInkasso(srv.replace("updated_at = NOW()\n      WHERE id = ANY", "letzte_erinnerung_at = NOW(), updated_at = NOW()\n      WHERE id = ANY")), "Rot-Probe: eine Zeile, die den Mahnstand anfasst → rot");
  ok(Z.zusageAntwortFunde("Ich habe mir Ihren Zahltag notiert: Freitag, 23.10.", null).length === 1, "Rot-Probe Antwort: „notiert“ ohne Festhalten fällt durch");
  ok(Z.zusageUrteil({ erkennung: E("Ich zahle am 30.12."), heute: B, raten: [r(2, "2026-10-18")], personZusage: null })?.art !== "merken", "Rot-Probe Urteil: ein Tag in zwei Monaten wird nicht als Zusage festgehalten");
  ok(E("Ich habe am Freitag überwiesen")?.art !== "tag", "Rot-Probe Erkennen: „habe überwiesen“ wird nie ein Zahltag");

  ok(netz === 0, `kein Netz (${netz})`);
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
