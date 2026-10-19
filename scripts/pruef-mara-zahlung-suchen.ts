// Prüfstand E-401 (3/6, 19.10.2026), ohne Datenbank: Mara sucht die gemeldete Zahlung selbst (zahlung_suchen).
// Der reine Abgleich (shared/fiaon-zahlung-suchen.ts), die Sätze, der Hinweis, die Antwortprüfung, die Karte
// „Geld eingegangen“ mit Maras Fund (eingangKarte) und der Einbau in Postfach und WhatsApp (Quelltext).
// Alle Personen, Namen und Referenzen sind erfunden.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin DATABASE_URL=postgresql://nobody@127.0.0.1:1/none \
//     node_modules/.bin/tsx scripts/pruef-mara-zahlung-suchen.ts
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
// Modell-Attrappe für den WhatsApp-Entwurf (Abschnitt 13): antwortet der Reihe nach aus ANTWORTEN — sonst kein Netz.
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401zs";
process.env.KI_ANBIETER = "openai";
const ANTWORTEN: string[] = [];
let modellRufe = 0, netz = 0;
globalThis.fetch = (async (u: any) => {
  const url = String(u?.url ?? u);
  if (url.startsWith("https://api.openai.com/")) {
    modellRufe++;
    const antwort = ANTWORTEN.shift() ?? "Danke.";
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort, gemerkt: "", mensch: false, uebergabe: "" }) }] }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  netz++;
  return new Response("kein Netz im Prüfstand", { status: 599 });
}) as any;

import { readFileSync } from "node:fs";
import {
  zahlungSuchen, zahlungSatz, zahlungHinweis, zahlungAntwortFunde, zahlungKurz, meldetBezahlt, rateImZweck, namensForm, zweckForm, referenzCode,
  ZAHLUNG_SUCHEN_TAGE, type ZsEingang, type ZsBestellung, type ZsRate, type ZsErgebnis,
} from "../shared/fiaon-zahlung-suchen";
import { tonPruefung } from "../shared/fiaon-mara-ton";
import { wandPruefen } from "../shared/fiaon-wortverbote";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);

const HEUTE = "2026-10-19";
const tag = (n: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let nr = 1;
const eingang = (o: Partial<ZsEingang> & { cents: number }): ZsEingang => ({
  id: nr++, txnId: `AWX-q401-${nr}`, datum: HEUTE, zahler: null, zweck: null, erkannteRef: null, zugeordnet: null,
  gebucht: false, ignoriert: false, unterwegs: false, rateNr: null, ...o,
});
const best = (o: Partial<ZsBestellung> & { ref: string }): ZsBestellung => ({ zahlungsreferenz: null, erstzahlungOffen: false, sollCents: 0, ...o });
const rate = (o: Partial<ZsRate> & { ref: string; nr: number }): ZsRate => ({ id: 1000 + o.nr, zahlungsreferenz: null, cents: 5999, faellig: tag(-3), ...o });

async function main() {
  abschnitt("1 · Normalformen und kleine Erkenner");
  ok(zweckForm("Fiaon - q7x2k9 / Rate 3") === "FIAONQ7X2K9RATE3", "zweckForm: groß, nur A–Z/0–9");
  ok(namensForm("Jürgen Müller-Weiß") === namensForm("Juergen Mueller-Weiss") && namensForm("Ünal Çelik") === "unalcelik", "namensForm: ü = ue, ß = ss, Akzente weg");
  ok(referenzCode("FIAON-Q7X2K9") === "Q7X2K9" && referenzCode("FIAONQ7X2K9-3") === "Q7X2K9" && referenzCode("FIAON-SCHUFA-AB12CD34") === null, "referenzCode: sechs Zeichen, nie SCHUFA");
  ok(rateImZweck("FIAON Q7X2K9 3") === 3 && rateImZweck("Rate 2 Oktober") === 2 && rateImZweck("3. Rate") === 3 && rateImZweck("FIAON-Q7X2K9 59,99") === null, "rateImZweck: Nummer hinter der Referenz oder am Wort Rate — kein Betrag");
  ok(ZAHLUNG_SUCHEN_TAGE === 21, "Fenster: 21 Tage");

  abschnitt("2 · Er meldet eine Zahlung (meldetBezahlt)");
  for (const t of ["Ich habe gestern überwiesen", "Habe die Rate bereits bezahlt.", "Zahlungsbeleg anbei", "Hab heute 59,99 überwiesen", "I have already paid", "Die Zahlung ist schon abgebucht worden"]) ok(meldetBezahlt(t), `meldet: „${t}“`);
  for (const t of ["Ich habe noch nicht bezahlt", "Wann soll ich bezahlen?", "Wo ist meine Karte?", "Ich habe es nie überwiesen", ""]) ok(!meldetBezahlt(t), `meldet nicht: „${t}“`);

  abschnitt("3 · Gefunden: Name + Betrag (Erstzahlung, Zweck ohne Referenz)");
  const A_B = [best({ ref: "FIAON-MQ401A1-TEST", zahlungsreferenz: "FIAONQ401A1", vorname: "Edith", nachname: "Quarzmeier", erstzahlungOffen: true, sollCents: 5999 })];
  const eA = eingang({ cents: 5999, zahler: "EDITH QUARZMEIER", zweck: "Gesendet mit N26", datum: tag(-1) });
  const rA = zahlungSuchen({ person: { vorname: "Edith", nachname: "Quarzmeier" }, bestellungen: A_B, raten: [], eingaenge: [eA, eingang({ cents: 5999, zahler: "JEMAND ANDERES" })], heute: HEUTE });
  ok(rA.art === "gefunden" && rA.haupt?.eingang.id === eA.id, "art gefunden, der Eingang von Edith", rA.art);
  ok(rA.haupt?.ziel?.art === "erstzahlung" && rA.haupt.ziel.referenz === "FIAONQ401A1" && rA.haupt.wege.join() === "name", "Ziel: Erstzahlung in der DB-Schreibweise, Weg: Name", rA.haupt);
  ok(rA.ohneEingang.length === 0, "nichts mehr ohne Eingang (die Erstzahlung ist gedeckt)");
  const sA = zahlungSatz(rA);
  ok(/Ich habe Ihre Überweisung über 59,99 € gefunden \(bei uns eingegangen am 18\.10\.2026\), wir ordnen sie jetzt zu\./.test(sA), "Satz: „Ich habe Ihre Überweisung über 59,99 € gefunden (… am 18.10.2026), wir ordnen sie jetzt zu.“", sA);

  abschnitt("4 · Gefunden: Referenz ohne Strich, Ratennummer im Zweck, Sammelfall zwei gleiche Überweisungen");
  const B_B = [best({ ref: "FIAON-MQ401B2-TEST", zahlungsreferenz: "FIAON-Q401B2", vorname: "Berta", nachname: "Quellmann" })];
  const B_R = [rate({ ref: "FIAON-MQ401B2-TEST", nr: 2, zahlungsreferenz: "FIAON-Q401B2-2", faellig: tag(-10) }), rate({ ref: "FIAON-MQ401B2-TEST", nr: 3, zahlungsreferenz: "FIAON-Q401B2-3", faellig: tag(5) })];
  const eB3 = eingang({ cents: 5999, zahler: "KONTO EHEMANN", zweck: "FIAONQ401B2 3", datum: tag(-2) });
  const rB = zahlungSuchen({ person: { vorname: "Berta", nachname: "Quellmann" }, bestellungen: B_B, raten: B_R, eingaenge: [eB3], heute: HEUTE });
  ok(rB.art === "gefunden" && rB.haupt?.ziel?.rateNr === 3 && rB.haupt.wege.includes("referenz"), "Referenz ohne Strich + „3“ → Rate 3 (nicht die ältere Rate 2)", rB.haupt?.ziel);
  ok(rB.ohneEingang.length === 1 && rB.ohneEingang[0].rateNr === 2, "Rate 2 (fällig) bleibt ohne Eingang", rB.ohneEingang);
  const e1 = eingang({ cents: 5999, zahler: "Berta Quellmann", datum: tag(-6) });
  const e2 = eingang({ cents: 5999, zahler: "Berta Quellmann", datum: tag(-1) });
  const rB2 = zahlungSuchen({ person: { vorname: "Berta", nachname: "Quellmann" }, bestellungen: B_B, raten: B_R, eingaenge: [e2, e1], heute: HEUTE });
  const zu = (id: number) => rB2.treffer.find((t) => t.eingang.id === id)?.ziel?.rateNr;
  ok(zu(e1.id) === 2 && zu(e2.id) === 3, "Zwei gleiche Überweisungen: die ältere → Rate 2, die neuere → Rate 3 (jede Forderung nur einmal)", rB2.treffer.map((t) => [t.eingang.id, t.ziel?.rateNr]));
  ok(rB2.haupt?.eingang.id === e2.id && rB2.ohneEingang.length === 0, "Haupt-Treffer: der neueste; nichts mehr ohne Eingang");

  abschnitt("5 · Gebucht: Bankbuch hat ihn seiner Bestellung zugeordnet");
  const eC = eingang({ cents: 7999, zweck: "FIAON-Q401C3-2", zugeordnet: "FIAON-MQ401C3-TEST", gebucht: true, datum: tag(-3), rateNr: 2 });
  const C_B = [best({ ref: "FIAON-MQ401C3-TEST", zahlungsreferenz: "FIAON-Q401C3", vorname: "Cord", nachname: "Quintus" })];
  const rC = zahlungSuchen({ person: { vorname: "Cord", nachname: "Quintus" }, bestellungen: C_B, raten: [rate({ ref: "FIAON-MQ401C3-TEST", nr: 3, cents: 7999, faellig: tag(-1), zahlungsreferenz: "FIAON-Q401C3-3" })], eingaenge: [eC], heute: HEUTE });
  ok(rC.art === "gebucht" && rC.haupt?.eingang.id === eC.id, "art gebucht");
  ok(zahlungSatz(rC) === "Ihre Zahlung über 79,99 € ist am 16.10.2026 bei uns eingegangen und gebucht (Rate 2).", "Satz mit Datum, Betrag und Rate", zahlungSatz(rC));
  ok(rC.ohneEingang.length === 1 && rC.ohneEingang[0].rateNr === 3, "Rate 3 (fällig gestern) steht ohne Eingang daneben");
  const eCfremd = eingang({ cents: 7999, zahler: "Cord Quintus", zugeordnet: "FIAON-MFREMD99-TEST", gebucht: true, datum: tag(-2) });
  const eCohne = eingang({ cents: 7999, zahler: "Cord Quintus", zugeordnet: null, gebucht: true, datum: tag(-2) });
  const rC2 = zahlungSuchen({ person: { vorname: "Cord", nachname: "Quintus" }, bestellungen: C_B, raten: [], eingaenge: [eCfremd, eCohne], heute: HEUTE });
  ok(rC2.art === "nicht_gefunden", "Gebucht, aber fremder Bestellung oder ohne Zuordnung → nicht seiner (das Bankbuch weiß es besser)", rC2.treffer);

  abschnitt("6 · Unterwegs, abweichend, zu alt, „kein Kundengeld“, fremd zugeordnet");
  const D_B = [best({ ref: "FIAON-MQ401D4-TEST", zahlungsreferenz: "FIAON-Q401D4", erstzahlungOffen: true, sollCents: 9999 })];
  const person = { vorname: "Dora", nachname: "Quendt" };
  const rU = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 9999, zahler: "DORA QUENDT", unterwegs: true })], heute: HEUTE });
  ok(rU.art === "unterwegs" && /auf dem Weg zu uns/.test(zahlungSatz(rU)), "unterwegs: angekündigt, „auf dem Weg zu uns“", zahlungSatz(rU));
  const rW = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 5000, zweck: "Q401D4 Teil 1" })], heute: HEUTE });
  ok(rW.art === "abweichend" && rW.haupt?.ziel?.cents === 9999 && /über 50,00 € ist bei uns angekommen/.test(zahlungSatz(rW)), "abweichend: 50 € statt 99,99 € — angekommen, Vergleich mit der Erstzahlung", rW.haupt);
  const rAlt = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 9999, zahler: "DORA QUENDT", datum: tag(-22) })], heute: HEUTE });
  ok(rAlt.art === "nicht_gefunden", "22 Tage alt → außerhalb des Fensters");
  const rIgn = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 9999, zahler: "DORA QUENDT", ignoriert: true })], heute: HEUTE });
  ok(rIgn.art === "nicht_gefunden", "„kein Kundengeld“ (ignored) zählt nie");
  const rFremd = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 9999, zahler: "DORA QUENDT", zugeordnet: "FIAON-MANDERE1-TEST" })], heute: HEUTE });
  ok(rFremd.art === "nicht_gefunden", "Name passt, aber einer fremden Bestellung zugeordnet → nicht seiner");
  const rZuo = zahlungSuchen({ person: { vorname: null, nachname: null }, bestellungen: D_B, raten: [], eingaenge: [eingang({ cents: 9999, zweck: "Danke", zugeordnet: "FIAON-MQ401D4-TEST" })], heute: HEUTE });
  ok(rZuo.art === "gefunden" && rZuo.haupt?.wege.join() === "zuordnung", "Ungebucht, aber schon seiner Bestellung zugeordnet (Betrag gleich) → gefunden", rZuo.haupt?.wege);

  abschnitt("7 · Namen: nur Vor- UND Nachname; Namenszusätze; nur Vorname reicht nie");
  const E_B = [best({ ref: "FIAON-MQ401E5-TEST", erstzahlungOffen: true, sollCents: 5999 })];
  const rN1 = zahlungSuchen({ person: { vorname: "Max", nachname: "Müller" }, bestellungen: E_B, raten: [], eingaenge: [eingang({ cents: 5999, zahler: "MUELLER MAX" })], heute: HEUTE });
  ok(rN1.art === "gefunden", "„MUELLER MAX“ = Max Müller (Reihenfolge egal, ue = ü)");
  const rN2 = zahlungSuchen({ person: { vorname: "Max", nachname: "Müller" }, bestellungen: E_B, raten: [], eingaenge: [eingang({ cents: 5999, zahler: "MAX SCHMIDT" })], heute: HEUTE });
  ok(rN2.art === "nicht_gefunden", "Nur der Vorname passt → nicht seiner");
  const rN3 = zahlungSuchen({ person: { vorname: "Anna", nachname: "von der Heide" }, bestellungen: E_B, raten: [], eingaenge: [eingang({ cents: 5999, zahler: "ANNA HEIDE" })], heute: HEUTE });
  ok(rN3.art === "gefunden", "„von der Heide“: das tragende Wort ist „Heide“");
  const rN4 = zahlungSuchen({ person: { vorname: "Anna", nachname: "von der Heide" }, bestellungen: E_B, raten: [], eingaenge: [eingang({ cents: 5999, zahler: "ANNA VON DER LINDE" })], heute: HEUTE });
  ok(rN4.art === "nicht_gefunden", "„von der …“ allein ist kein Nachname");

  abschnitt("8 · Nichts gefunden: Satz und Hinweis wie bisher (Beleg, nicht doppelt zahlen)");
  const rNix = zahlungSuchen({ person, bestellungen: D_B, raten: [], eingaenge: [], heute: HEUTE });
  ok(rNix.art === "nicht_gefunden" && rNix.ohneEingang.length === 1, "nicht_gefunden, die Erstzahlung steht ohne Eingang");
  const sNix = zahlungSatz(rNix);
  ok(/noch kein Eingang zu sehen/.test(sNix) && /Beleg \(Datum, Betrag, Verwendungszweck\)/.test(sNix) && /nicht noch einmal/.test(sNix), "Satz: kein Eingang, Beleg erbitten, nicht doppelt überweisen", sNix);
  const hNix = zahlungHinweis(rNix, { kanal: "mail" });
  ok(/ZAHLUNG GESUCHT/.test(hNix) && /NICHTS GEFUNDEN/.test(hNix) && /Sag NIE, dass sie angekommen, gefunden oder gebucht ist/.test(hNix), "Hinweis: nichts gefunden, nie „angekommen/gebucht“");
  const hA = zahlungHinweis(rA, { kanal: "mail", kartenGelegt: true });
  ok(hA.includes(sA) && /Keine Aufgabe an die Zahlungsstelle/.test(hA) && /Sag nicht „gebucht“/.test(hA) && /seine übrigen Fragen/.test(hA), "Hinweis gefunden (Mail): der Satz, keine Aufgabe an die Zahlungsstelle, nicht „gebucht“", hA);
  const hAw = zahlungHinweis(rA, { kanal: "whatsapp" });
  ok(!/Zahlungsstelle/.test(hAw) && /Kein Kollege/.test(hAw), "Hinweis WhatsApp: ohne Zahlungsstelle, kein Kollege");
  const hC = zahlungHinweis(rC, { kanal: "mail" });
  ok(/GEBUCHT: 79,99 €, bei uns eingegangen am 16\.10\.2026 \(Rate 2\)/.test(hC) && /NOCH OHNE EINGANG: seine Rate 3/.test(hC) && /nicht doppelt zu überweisen/.test(hC), "Hinweis gebucht: Fakten + Rate 3 ohne Eingang", hC);
  const kurzA = zahlungKurz(rA);
  ok(kurzA.treffer[0].datum === "18.10.2026" && kurzA.treffer[0].betragPunkt === "59.99" && kurzA.satz === sA, "Kurzform für die Belegprüfung: 18.10.2026 und 59.99", kurzA.treffer[0]);

  abschnitt("9 · Die Antwortprüfung — nie eine Zusage, die nicht im Bankbuch steht");
  const f = (t: string, e: ZsErgebnis, frueher?: { datum: string; cents: number }[]) => zahlungAntwortFunde(t, e, { frueher });
  // Jeder eigene Satz besteht seine Prüfung.
  for (const [name, e] of [["gefunden", rA], ["gebucht", rC], ["unterwegs", rU], ["abweichend", rW], ["nicht_gefunden", rNix]] as const) {
    ok(!f(zahlungSatz(e), e).length, `eigener Satz (${name}) besteht die Prüfung`, f(zahlungSatz(e), e));
  }
  ok(f("Ihre Zahlung ist bei uns eingegangen, vielen Dank!", rNix).length === 1, "nichts gefunden + „Ihre Zahlung ist bei uns eingegangen“ → Mangel");
  ok(f("Vielen Dank für Ihre Überweisung. Sie ist bei uns eingegangen.", rNix).length === 1, "nichts gefunden + „… Überweisung. Sie ist bei uns eingegangen.“ (Pronomen im Folgesatz) → Mangel");
  ok(!f("Vielen Dank für Ihre Nachricht. Sie sind bei uns in guten Händen.", rNix).length, "„Sie sind …“ (höfliches Sie) → kein Mangel");
  ok(f("Wir haben Ihre Zahlung erhalten.", rNix).length === 1, "nichts gefunden + „Wir haben Ihre Zahlung erhalten“ → Mangel");
  ok(f("Your payment has been received.", rNix).length === 1, "nichts gefunden + „Your payment has been received“ → Mangel (Englisch)");
  ok(f("Ihre Zahlung ist bereits gebucht.", rNix).length === 1, "nichts gefunden + „bereits gebucht“ → Mangel");
  ok(!f("Sobald Ihre Zahlung eingegangen ist, schaltet das System Sie frei.", rNix).length, "bedingt („Sobald …“) → kein Mangel");
  ok(!f("Ihre Zahlung ist bei uns noch nicht eingegangen.", rNix).length, "verneint → kein Mangel");
  ok(!f("Sie haben unsere Zahlungserinnerung erhalten.", rNix).length, "„Zahlungserinnerung erhalten“ ist keine Zahlungsaussage");
  ok(!f("Ihr Rückruf ist gebucht, und Ihre Zahlung prüfen wir gern.", rNix).length, "„Ihr Rückruf ist gebucht“ — gebucht ohne Zahlungswort im Teilsatz → kein Mangel");
  ok(!f("Ihre erste Zahlung vom 03.09.2026 ist gebucht.", rNix, [{ datum: "2026-09-03", cents: 5999 }]).length, "ältere, gebuchte Zahlung aus der Akte (genau ihr Datum) → frei");
  ok(f("Ihre Zahlung über 99,99 € ist gebucht.", rNix, [{ datum: "2026-09-03", cents: 9999 }]).length === 1, "… ohne Datum ist „gebucht“ mehrdeutig → Mangel");
  ok(f("Ihre Zahlung ist gebucht.", rA).length === 1, "gefunden, aber „gebucht“ → Mangel (gebucht wird erst mit der Zuordnung)");
  ok(f("Ich habe Ihre Überweisung über 59,99 € vom 12.10.2026 gefunden.", rA).some((x) => /Datum 12\.10/.test(x)), "gefunden mit falschem Datum → Mangel (Datum)");
  ok(f("Ich habe Ihre Überweisung über 69,99 € gefunden.", rA).some((x) => /Betrag 69,99/.test(x)), "gefunden mit falschem Betrag → Mangel (Betrag)");
  ok(f("Auf unserem Konto ist noch kein Eingang zu sehen.", rA).length === 1, "gefunden, aber „kein Eingang“ → Mangel");
  ok(!f("Für Ihre Rate 2 ist noch kein Eingang da.", rB).length, "„kein Eingang“ für eine ANDERE, noch offene Rate → frei");
  ok(f("Ihre Überweisung ist bei uns angekommen.", rU).length === 1, "unterwegs, aber „angekommen“ → Mangel");
  ok(!f("Ich habe Ihre Überweisung gefunden — sie ist auf dem Weg zu uns.", rU).length, "unterwegs + „gefunden … auf dem Weg“ → frei");
  ok(!f("Ihre Zahlung über 79,99 € ist am 16.10.2026 gebucht. Für Ihre Rate 3 sehe ich noch keinen Eingang — bitte schicken Sie mir den Beleg.", rC).length, "gebucht + Rate 3 ohne Eingang → frei");

  abschnitt("10 · Die Sätze bestehen Maras Wände (Ton Mail/WhatsApp, Wortwand)");
  for (const [name, e] of [["gefunden", rA], ["gebucht", rC], ["unterwegs", rU], ["abweichend", rW], ["nicht_gefunden", rNix]] as const) {
    const s = zahlungSatz(e);
    const tonM = tonPruefung(s, { kanal: "mail" }).filter((b) => b.schwere === "hart");
    const tonW = tonPruefung(s, { kanal: "whatsapp" }).filter((b) => b.schwere === "hart");
    const wand = wandPruefen(s, []).filter((t) => t.art !== "floskel");
    ok(!tonM.length && !tonW.length && !wand.length, `Satz (${name}): kein harter Ton-Treffer, keine Wortwand`, { tonM, tonW, wand });
  }
  const wa = await import("../server/lib/fiaon-whatsapp");
  for (const [name, e] of [["gefunden", rA], ["gebucht", rC], ["nicht_gefunden", rNix]] as const) {
    ok(!wa.sendePruefung(zahlungSatz(e)).length, `Satz (${name}): WhatsApp-Sendewand frei (sicherer Satz)`, wa.sendePruefung(zahlungSatz(e)));
  }

  abschnitt("11 · Die Karte „Geld eingegangen“ mit Maras Fund (eingangKarte)");
  const me = await import("../server/lib/fiaon-mara-entscheidungen");
  const zeile = (o: Record<string, unknown> = {}): any => ({
    id: 4011, txnId: "AWX-q401-k", datum: "2026-10-18", betragCents: 5999, zweck: "Gesendet mit N26", absender: "EDITH QUARZMEIER", zweckRef: null,
    regel: null, ziel: null, bestellung: null, kunde: null, personId: null, rateId: null, rateNr: null, ergebnis: "keine Referenz im Zweck", buchen: false,
    deckung: null, provision: [], mails: [], hinweise: [], genannteRate: null, unklar: "keine Referenz", schonVerbucht: false, zielVomMenschen: null,
    dazu: [], summeCents: 5999, buchDatum: "2026-10-18", zuordenbar: false, zugeordnet: null,
    vorschlag: { art: "unbekannt", aktion: null, ziel: null, mitZiel: false, bestellung: null, rateNr: null, rateId: null, kunde: null, personId: null, dazu: [], sicherheit: "unklar", gruende: [], text: "Kein eindeutiger Kunde", hinweise: [], erwartet: null },
    stornoZurueck: null, verrechnung: null, ...o,
  });
  const fund = (o: Record<string, unknown> = {}): any => ({
    bankTxnId: 4011, personId: 77, kanal: "mail", quelle: "Mail #401", stand: "gefunden", ziel: "FIAONQ401A1", bestellung: "FIAON-MQ401A1-TEST", rateNr: null,
    erwartet: { regel: "erstzahlung", ziel: "FIAONQ401A1", rateId: null }, probe: "würde buchen: …", wege: "Name + Betrag gleich", am: "2026-10-19T08:00:00Z", ...o,
  });
  const k0 = me.eingangKarte(zeile(), []);
  ok(k0 && !k0.optionen.some((o) => o.key === "buchen") && k0.optionen.some((o) => o.key === "kein_kunde"), "ohne Fund: kein Buchungsknopf, „Kein Kundengeld“ möglich (wie bisher)", k0?.optionen.map((o) => o.key));
  const k1 = me.eingangKarte(zeile(), [fund()])!;
  const b1 = k1.optionen.find((o) => o.key === "buchen");
  ok(b1?.werkzeug === "bankeingang_buchen" && (b1.args as any)?.ziel === "FIAONQ401A1" && (b1.args as any)?.erwartet?.regel === "erstzahlung" && k1.empfehlung === "buchen",
    "mit Fund: „Zubuchen“ über bankeingang_buchen mit Ziel und Erwartungs-Stempel, empfohlen", b1);
  ok(k1.belege?.some((b) => /Kunde meldet Zahlung \(Mail 19\.10\.\)/.test(b.text)) && /Der Kunde meldet diese Zahlung/.test(k1.text) && k1.personId === 77, "Beleg „Kunde meldet Zahlung (Mail 19.10.)“, Text und Person", k1.belege);
  ok(!k1.optionen.some((o) => o.key === "kein_kunde") && k1.schluessel === "eingang:4011" && k1.art === "eingang_unverbucht", "kein „Kein Kundengeld“ (ein Kunde meldet sie); dieselbe Karte (eingang:4011)");
  const k2 = me.eingangKarte(zeile({ vorschlag: { ...zeile().vorschlag, personId: 99, sicherheit: "wahrscheinlich" } }), [fund()])!;
  ok(!k2.optionen.some((o) => o.key === "buchen") && k2.belege?.some((b) => b.ton === "warn" && /andere Person/.test(b.text)), "Vorschlag nennt eine ANDERE Person → kein Knopf, nur Warnung", k2.optionen.map((o) => o.key));
  const k3 = me.eingangKarte(zeile({ buchen: true, unklar: null, regel: "rate", ziel: "FIAON-Q401A1-2", rateId: 5, rateNr: 2, ergebnis: "würde buchen: Rate 2" }), [fund()])!;
  ok(k3.optionen.filter((o) => o.key === "buchen").length === 1 && (k3.optionen[0].args as any)?.ziel === null, "Hat die Karte schon einen Buchungsknopf, kommt kein zweiter dazu", k3.optionen.map((o) => o.key));
  const k4 = me.eingangKarte(zeile(), [fund({ erwartet: null, probe: "Betrag weicht ab" })])!;
  ok(!k4.optionen.some((o) => o.key === "buchen") && k4.titel === "Kunde hat gezahlt — bitte zuordnen", "Trockenprobe sagte nicht „würde buchen“ → kein Knopf, Titel „bitte zuordnen“", k4.titel);
  const k5 = me.eingangKarte(zeile({ vorschlag: { ...zeile().vorschlag, art: "teilzahlung" } }), [fund({ stand: "abweichend", ziel: null, erwartet: null })])!;
  ok(k5.titel === "Teilzahlung" && !k5.optionen.some((o) => o.key === "buchen"), "Teilzahlung bleibt „Teilzahlung“ (Maras Titel überschreibt nichts)", k5.titel);
  ok(me.eingangKarte(zeile({ schonVerbucht: true }), [fund()]) === null, "schon verbucht → keine Karte");

  abschnitt("12 · Einbau (Quelltext): der Server sucht vor dem Modell, kein Kreis, nie buchen");
  const q = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const pm = ohneKommentare(q("server/lib/fiaon-postmeister-agent.ts"));
  const iSuche = pm.indexOf("zahlungSuchenBehandeln(");
  ok(iSuche > 0 && iSuche < pm.indexOf("const nachrichten: any[] = [") && pm.includes("vorab.push(zahlungGesucht.hinweis)"), "Postfach: zahlung_suchen läuft VOR dem Modell, der Hinweis steht vorab");
  ok(/zahlungAntwortFunde\(t, k\.zahlung\.ergebnis/.test(pm) && pm.includes("zahlung: zahlungGesucht"), "Postfach: Antwortprüfung mit dem Ergebnis");
  ok(/zahlungsAufgabeUnnoetig\(w\.name, p\)/.test(pm), "Postfach: keine Aufgabe an die Zahlungsstelle, wenn die Zahlung im Bankbuch ist");
  ok(/!akte\?\.global/.test(pm.slice(iSuche - 400, iSuche)), "Postfach: nicht beim Global-Kunden");
  const wq = ohneKommentare(q("server/lib/fiaon-whatsapp-mara.ts"));
  ok(wq.includes('kanal: "whatsapp", quelle: `WhatsApp #${neuesteRein.id}`') && wq.includes("zahlungsHinweis = zahlungGesucht.hinweis"), "WhatsApp: derselbe Weg (zahlungSuchenBehandeln) bei „habe bezahlt“");
  ok(/zahlungAntwortFunde\(a, pruef\.zahlung\.ergebnis/.test(wq) && wq.includes("zahlung: zahlungGesucht ?"), "WhatsApp: harte Antwortprüfung im Entwurf");
  ok(wq.includes("eingangOffenSql") , "WhatsApp: der E-372-Abgleich bleibt als Rückfall, wenn die Suche scheitert");
  const zs = ohneKommentare(q("server/lib/fiaon-mara-zahlung-suchen.ts"));
  ok(!/bankeingangBuchen|liveVerbuchen\(|alsBezahltBuchen|rateBezahltBuchen|UPDATE\s+fiaon_bank_txns|UPDATE\s+fiaon_abo_raten|UPDATE\s+fiaon_applications/.test(zs), "Mara bucht nie: kein Buchungsweg, kein UPDATE auf Bankbuch, Raten, Bestellungen");
  ok(/bankeingangTrockenprobe\(t\.eingang\.id, \{ ziel \}\)/.test(zs) && /eingangKarteJetzt\(/.test(zs), "Nur die Trockenprobe (bucht nichts) und die bestehende Karte");
  ok(/istGlobalKunde/.test(zs) && /d\.person\.test/.test(zs), "Global-Kunde → keine Suche; Testperson → nichts schreiben");
  const meq = q("server/lib/fiaon-mara-entscheidungen.ts");
  ok(/import\("\.\/fiaon-mara-zahlung-suchen"\)/.test(meq) && !/^import\s+(?!type)[^;]*from\s+"\.\/fiaon-mara-zahlung-suchen"/m.test(meq), "Entscheidungen laden Maras Funde dynamisch (kein Kreis)");

  abschnitt("13 · WhatsApp-Entwurf (entwerfen, Modell-Attrappe): die Wand hält jede Zusage, die nicht im Bankbuch steht");
  {
    const mara = await import("../server/lib/fiaon-whatsapp-mara");
    const ew = (e: ZsErgebnis) => mara.entwerfen("SYSTEM (Prüfstand)", { kunde: "Habe gestern überwiesen", letzteDu: [], verkaufen: false, zahlung: { ergebnis: e } }, null);
    ANTWORTEN.length = 0; ANTWORTEN.push("Danke, Ihre Zahlung ist bei uns angekommen.", "Danke, Ihre Zahlung ist bei uns angekommen.");
    const w1 = await ew(rNix);
    ok(w1.funde.some((x) => /kein passender Eingang/.test(x)), "nichts gefunden, beide Entwürfe „angekommen“ → harter Mangel (maraAntwortet nimmt dann den sicheren Satz)", w1.funde);
    ANTWORTEN.length = 0; ANTWORTEN.push("Super, Ihre Zahlung ist schon gebucht!", `Danke! ${zahlungSatz(rA)}`);
    const w2 = await ew(rA);
    ok(w2.zweiter && w2.antwort === `Danke! ${zahlungSatz(rA)}` && !w2.funde.length, "gefunden: „schon gebucht“ → zweiter Entwurf mit dem Fund geht", { antwort: w2.antwort, funde: w2.funde });
    const vorher = modellRufe;
    ANTWORTEN.length = 0; ANTWORTEN.push(`Vielen Dank! ${zahlungSatz(rC)}`);
    const w3 = await ew(rC);
    ok(!w3.zweiter && !w3.funde.length && modellRufe - vorher === 1, "gebucht + richtiger Satz → kein zweiter Entwurf", { zweiter: w3.zweiter, rufe: modellRufe - vorher });
    ok(netz === 0, `kein Netz außer der Attrappe (${netz})`);
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
