// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MARA BUSINESS (E-481, 05.11.2026) — Justins digitale Assistentin für FIAON Global auf WhatsApp
//
//   A  REIN (immer): die sechs Business-Vorlagen (Meta-Regeln, Wortwand, Kopf/Fuß = MB_KOPF/MB_FUSS, Knöpfe → Aktion),
//      WhatsApp-Link mit Kennung (hin und zurück), die Business-Wand (Privat-Links/-Wörter, Bank-Satz, Zinszahl, Zusage,
//      „ohne Sicherheiten“, Steuer, Emoji, Vorstellung), feste Sätze und Musterdialoge durch beide Wände, Willkommens-Mail
//      mit/ohne WhatsApp-Zeile, Opt-in-Satz, Handynummern, Quelltext-Wände (Eingang, Haken, Versand, Takt, Kasse).
//   B  LOKALE DATENBANK (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…, WEGWERF-KOPIE): Business-Eingang (Kennung,
//      offene Anfrage, „FIAON Global“) → nie ein Privat-Lead; zahlender Privatkunde → Privat-Mara; Welten-Sperre der Vorlagen;
//      Weg merken (Daniels Auftrag zu, Nachfass-Stopp).
//   C  ECHTE KI (--ki, ohne Versand, ohne Datenbank-Schreiben außer der Kostenzeile in der lokalen DB): 20 echte Fragen von
//      Business-Leads gegen das tragende Modell (OpenAI, Schlüssel nur im Speicher über die Render-API) — jede Antwort durch
//      Hauswand + Business-Wand; Ausgabe zum Lesen.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-mara-business.ts          (A)
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_mb; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_mb?sslmode=disable' … (A + B) [--ki] (A + B + C), danach dropdb.
//
// Repo öffentlich: nur erfundene Menschen (*.example), Nummern aus dem Prüfbereich (+49 1550 …).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
const KI = process.argv.includes("--ki");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN", "GMAIL_SERVICE_ACCOUNT_JSON"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(ist === soll, `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const lies = (p: string) => readFileSync(p, "utf8");

const MB = await import("../shared/fiaon-mara-business");
const LT = await import("../shared/fiaon-lead-texte");
const ER = await import("../shared/fiaon-whatsapp-erlaubnis");
const GLT = await import("../shared/fiaon-global-lead-texte");
const TAKT = await import("../shared/fiaon-lead-takt");

// ═══ A ═════════════════════════════════════════════════════════════════════
abschnitt("A1 Die sechs Business-Vorlagen");
const NAMEN = ["fiaon_gl_willkommen", "fiaon_gl_termin", "fiaon_gl_erinnerung", "fiaon_gl_nicht_erreicht", "fiaon_gl_nachfrage", "fiaon_gl_antwort"];
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
for (const n of NAMEN) {
  const v = LT.WA_VORLAGEN.find((x) => x.name === n);
  ok(!!v, `${n}: steht im Register (wird eingereicht)`);
  if (!v) continue;
  gleich(v.kopf, MB.MB_KOPF, `${n}: Kopf = MB_KOPF`);
  gleich(v.fuss, MB.MB_FUSS, `${n}: Fuß = MB_FUSS`);
  ok((v.fuss ?? "").length <= 60 && (v.kopf ?? "").length <= 60, `${n}: Kopf und Fuß höchstens 60 Zeichen`);
  ok(!v.kopfBild && !LT.WA_VORLAGEN.some((x) => x.varianteVon === n), `${n}: bewusst ohne Bildfassung`);
  ok(v.knoepfe.every((k) => k.text.length <= 25), `${n}: Knöpfe höchstens 25 Zeichen`);
  ok(!/^\s*\{\{/.test(v.text) && !/\}\}\s*[.!?]?\s*$/.test(v.text), `${n}: keine Variable am Anfang oder Ende`);
  gleich(v.beispiele.length, (v.text.match(/\{\{\d\}\}/g) ?? []).length, `${n}: ein Beispiel je Variable`);
  let gefuellt = v.text;
  v.beispiele.forEach((b, i) => { gefuellt = gefuellt.replace(`{{${i + 1}}}`, b); });
  const funde = sendePruefung(gefuellt);
  ok(funde.length === 0, `${n}: Hauswand grün (${funde.join(" · ")})`);
  ok(!/berat/i.test(v.text) && !/kredit|limit|schufa|bonit|antrag/i.test(v.text), `${n}: kein „Beratung“, nichts aus der Privat-Welt`);
  ok(MB.businessWand(gefuellt, { ersteAntwort: false }).length === 0, `${n}: Business-Wand grün (${MB.businessWand(gefuellt, { ersteAntwort: false }).join(" · ")})`);
  for (const k of v.knoepfe.filter((x) => x.typ === "QUICK_REPLY")) {
    ok(!!MB.knopfAktion(k.text) || k.text === "Keine Nachrichten mehr", `${n}: Knopf „${k.text}“ hat eine Aktion`);
  }
  ok(v.text.length <= 1024, `${n}: höchstens 1.024 Zeichen`);
}
const willk = LT.WA_VORLAGEN.find((x) => x.name === "fiaon_gl_willkommen")!;
ok(/digitale Assistentin von Justin Schwarzott/.test(willk.text), "Begrüßung stellt Mara als digitale Assistentin vor (KI-VO Art. 50)");
ok(/Finanzmarkt/.test(willk.text) && /individuell/.test(willk.text), "Begrüßung trägt den Pitch und „individuell“");
gleich(willk.knoepfe.map((k) => MB.knopfAktion(k.text)?.art === "weg" ? (MB.knopfAktion(k.text) as any).weg : null).join(","), "telefon,mail,whatsapp", "Begrüßung: drei Wege");
gleich(willk.kategorie, "MARKETING", "Begrüßung als Marketing eingereicht (ehrlich)");
const ne = LT.WA_VORLAGEN.find((x) => x.name === "fiaon_gl_nicht_erreicht")!;
ok(ne.knoepfe.some((k) => k.typ === "URL" && k.url === "https://fiaon.com/g/{{1}}" && /\/g\/[A-Za-z0-9]{10}$/.test(String(k.beispiel))), "„nicht erreicht“: Link-Knopf mit persönlichem Code");
ok(require_istStopp("Keine Nachrichten mehr"), "„Keine Nachrichten mehr“ ist ein STOPP");
ok(LT.WA_VORLAGEN[0].name === "fiaon_kk_anfrage", "WA_VORLAGEN[0] bleibt der Privat-Erstkontakt (alte Prüfstände)");

function require_istStopp(t: string): boolean {
  const k = String(t).trim();
  return /^(keine\s+nachrichten(\s+mehr)?|stopp?|stop)$/i.test(k);
}

abschnitt("A2 WhatsApp-Link mit Kennung");
const code = "Ab3dEf7hJk";
const link = MB.waGlobalLink("+49 151 0000 0000", code)!;
ok(link.startsWith("https://wa.me/4915100000000?text="), "Link zur Nummer, nur Ziffern");
const satz = decodeURIComponent(link.split("text=")[1]);
gleich(MB.kennungAusText(satz), code, "Kennung kommt aus dem fertigen Satz zurück");
ok(MB.istGlobalEinstieg(satz), "der Satz nennt „FIAON Global“");
gleich(MB.kennungAusText("Guten Tag (Anfrage zu kurz)"), null, "kaputte Kennung → null");
gleich(MB.waGlobalLink("", code), null, "ohne Nummer kein Link");
ok(!MB.waGlobalSatz(null).includes("Anfrage"), "ohne Kennung kein Klammer-Rest");
ok(MB.istGlobalEinstieg(MB.waGlobalSatz(null, "en")), "englischer Satz nennt FIAON Global");

abschnitt("A3 Die Business-Wand");
const wand = (t: string, erste = false) => MB.businessWand(t, { ersteAntwort: erste });
ok(wand("Ihren Antrag finden Sie unter fiaon.com/antrag").length > 0, "Privat-Link fliegt");
ok(wand("Ihre Kreditkarte ist bald da.").length > 0, "Privat-Wort fliegt");
ok(wand("Über den Rahmen entscheidet die Bank.").length > 0, "Bank-Satz fliegt (E-468)");
ok(wand("Sie zahlen dort nur 3,5 % Zinsen.").length > 0, "Zinszahl fliegt");
ok(wand("Sie bekommen garantiert eine Finanzierung.").length > 0, "Zusage fliegt");
ok(wand("Das geht ohne Sicherheiten.").length > 0, "„ohne Sicherheiten“ fliegt");
ok(wand("In den USA geht das meist ohne hohe Sicherheiten.").length === 0, "„meist ohne hohe Sicherheiten“ darf");
ok(wand("So sparen Sie Steuern.").length > 0, "Steuer-Versprechen fliegt");
ok(wand("Sehr gern 😊").length > 0, "Emoji fliegt");
ok(wand("Sehr gern, Herr Muster.", true).length > 0, "erste Antwort ohne Vorstellung fliegt");
ok(wand("Ich bin Mara, die digitale Assistentin von Justin Schwarzott. Sehr gern, Herr Muster.", true).length === 0, "erste Antwort mit Vorstellung darf");
ok(wand("Wir arbeiten zum Festpreis; welches Paket passt, klärt Herr Schwarzott im Gespräch.").length === 0, "saubere Antwort darf");
ok(MB.vorstellungVoran("Sehr gern.").startsWith("Ich bin Mara"), "Vorstellung wird vorangestellt, wenn sie fehlt");

abschnitt("A4 Feste Sätze und Musterdialoge durch beide Wände");
const zeiten = ["Donnerstag, 12.11., 14:00 Uhr", "Freitag, 13.11., 16:30 Uhr", "Montag, 16.11., 09:00 Uhr"];
const saetze = [
  MB.satzWegMail("max@muster.example"), MB.satzWegMail(null), MB.satzWegWhatsapp(), MB.satzTelefon(zeiten, "https://fiaon.com/g/Ab3dEf7hJk"),
  MB.satzTelefon([], null), MB.satzSpaeter(), MB.satzPasst(zeiten[0]), MB.satzGebucht(zeiten[0]), MB.satzUebergabe(),
  MB.satzWegMail("max@muster.example", true), MB.satzWegWhatsapp(true), MB.satzTelefon(zeiten, null, true), MB.satzGebucht(zeiten[0], true),
];
for (const s of saetze) {
  const f = [...sendePruefung(s, { namen: [] }), ...wand(s)];
  ok(f.length === 0, `Satz „${s.slice(0, 50)}…“ grün (${f.join(" · ")})`);
}
ok(/oder Montag/.test(MB.satzTelefon(zeiten, null)), "drei Zeiten mit „oder“ verbunden");
for (const m of MB.MB_MUSTER) {
  const s = m.mara.replace(/\{\{ab\}\}/g, MB.mbAbPreis());
  const f = [...sendePruefung(s), ...wand(s)];
  ok(f.length === 0, `Muster „${m.kunde}“ grün (${f.join(" · ")})`);
}
ok(/^\d\.\d{3}\s?€$/.test(MB.mbAbPreis()), `Einstiegspreis aus dem Katalog (${MB.mbAbPreis()})`);
const auftrag = MB.businessAuftrag({ anrede: "Herr Muster", firma: "Muster GmbH", antworten: ["Was planen Sie? — Beides"], weg: null, termin: null,
  freieZeiten: zeiten, link: "https://fiaon.com/g/Ab3dEf7hJk", ersteAntwort: true, englisch: false, erzaehlt: [], anweisung: null });
ok(/digitale Assistentin von Justin Schwarzott/.test(auftrag) && /Pflicht/.test(auftrag), "Auftrag: Vorstellung in der ersten Antwort ist Pflicht");
ok(/Finanzmarkt/.test(auftrag) && /individuell/.test(auftrag), "Auftrag: Pitch und „individuell“");
ok(/Gespräch/.test(auftrag) && /Nie das Wort „Beratung“/.test(auftrag), "Auftrag: „Gespräch“ statt „Beratung“");
ok(/nie von „dem Team“/.test(auftrag), "Auftrag: Mara spricht von Herrn Schwarzott, nicht vom Team");
ok(!/\{\{ab\}\}/.test(auftrag) && auftrag.includes(MB.mbAbPreis()), "Auftrag: Preis aus dem Katalog eingesetzt");
ok(auftrag.includes("Donnerstag, 12.11., 14:00 Uhr"), "Auftrag: freie Zeiten stehen drin");

abschnitt("A5 Willkommens-Mail (E-476) mit der Wahl");
const wEin: any = {
  sprache: "de", name: "Max Muster", kanal: "meta", antworten: [], mitNachricht: false, oesterreich: false, bestandskunde: false,
  link: { url: "https://fiaon.com/g/Ab3dEf7hJk", anzeige: "fiaon.com/g/Ab3dEf7hJk" }, eingangAm: new Date(), jetzt: new Date(),
  ruf: { kollege: null, art: "persoenlich" },
};
const ohne = GLT.willkommenText(wEin);
const mit = GLT.willkommenText({ ...wEin, whatsapp: { url: link } });
ok(!GLT.leadMailKlartext(ohne).includes("WhatsApp"), "ohne Link: keine WhatsApp-Zeile (alter Wortlaut)");
ok(GLT.leadMailKlartext(mit).includes("Lieber schriftlich?") && GLT.leadMailKlartext(mit).includes(link), "mit Link: die Wahl „lieber schriftlich“ mit WhatsApp-Link");
ok(GLT.platzhalterWache(GLT.leadMailKlartext(mit)).length === 0, `W mit WhatsApp-Zeile: Platzhalter-Wache grün (${GLT.platzhalterWache(GLT.leadMailKlartext(mit)).join(" · ")})`);
ok(/Message Mara on WhatsApp/.test(GLT.leadMailKlartext(GLT.willkommenText({ ...wEin, sprache: "en", whatsapp: { url: link } })).concat(JSON.stringify(GLT.willkommenText({ ...wEin, sprache: "en", whatsapp: { url: link } }).bloecke))), "englische Fassung");

abschnitt("A6 Opt-in-Satz, Nummern, Ereignisse");
ok(/WhatsApp/.test(ER.GLOBAL_WA_HINWEIS.de) && /FIAON LTD/.test(ER.GLOBAL_WA_HINWEIS.de) && /STOPP/.test(ER.GLOBAL_WA_HINWEIS.de), "Opt-in-Satz nennt WhatsApp, FIAON LTD und STOPP");
ok(/WhatsApp/.test(ER.GLOBAL_WA_HINWEIS.en) && /FIAON LTD/.test(ER.GLOBAL_WA_HINWEIS.en), "Opt-in-Satz englisch");
ok(ER.globalWaHinweisGezeigt(ER.GLOBAL_WA_HINWEIS.de) && !ER.globalWaHinweisGezeigt("irgendwas"), "nur der wortgleiche Satz zählt");
const { anfrageNummer, zeitText } = await import("../server/lib/fiaon-mara-business");
gleich(anfrageNummer("0151 23456789"), "4915123456789", "deutsche Handynummer");
gleich(anfrageNummer("+49 30 1234567"), null, "deutsches Festnetz → kein WhatsApp");
gleich(anfrageNummer("+43 664 1234567"), "436641234567", "österreichische Handynummer");
gleich(anfrageNummer("+41 79 123 45 67"), "41791234567", "Schweizer Handynummer");
gleich(zeitText("2026-11-12", "14:00"), "Donnerstag, 12.11., 14:00 Uhr", "Zeit-Text");
gleich(TAKT.auftragNachEreignis("weg_mail" as any), "schliessen", "Wahl E-Mail schließt Daniels Anruf-Auftrag");
gleich(TAKT.auftragNachEreignis("weg_whatsapp" as any), "schliessen", "Wahl WhatsApp schließt Daniels Anruf-Auftrag");

abschnitt("A7 Quelltext-Wände");
const wa = lies("server/lib/fiaon-whatsapp.ts");
const mara = lies("server/lib/fiaon-whatsapp-mara.ts");
const mbs = lies("server/lib/fiaon-mara-business.ts");
const routen = lies("server/routes.ts");
ok((wa.match(/businessEingang\(nummer/g) ?? []).length === 2, "Eingang + Nachziehen: Business-Kontakt vor leadAusEingang");
ok(wa.indexOf("businessEingang(nummer, text, lauf)") < wa.indexOf("gehoert = await leadAusEingang(nummer, text)"), "Eingang: Business zuerst, sonst Privat-Lead");
ok(/vorlageWeltSperre\(/.test(wa), "waSenden: Welten-Sperre vor jeder Vorlage");
const iStopp = mara.indexOf('handlung: "WhatsApp-Stopp bestätigt');
const iHaken = mara.indexOf("mb.maraBusinessAntwortet(");
const iJa = mara.indexOf("SEINE ANTWORT AUF DIE FRAGE NACH DEM JA ZUM ANRUF");
const iE272 = mara.indexOf("if (personId && await globalKundeWa(Number(personId)))");
ok(iE272 > 0 && iE272 < iStopp && iStopp < iHaken && iHaken < iJa, "Haken: nach Global-Kunde (E-272) und STOPP, vor allem Privaten (ARAS-Ja)");
ok(/tageslauf\('wa_global_takt'/.test(routen) && /wa_global_takt:\s*\{/.test(lies("server/lib/fiaon-crons.ts")), "Takt registriert und im Verzeichnis der Läufe");
ok(/"mara-business": "menschen"/.test(lies("shared/fiaon-ki-kasse.ts")), "KI-Kasse: Topf „Antworten an Menschen“");
ok(!/fiaon_radar_firmen/.test(mbs), "Mara Business schreibt nie in den Firmen-Radar");
ok(/vorlageNutzbar\(n, frei\)/.test(mbs), "Takt: Vorlagen erst nach Metas Freigabe");
ok(/imVersandfenster/.test(mbs), "Takt: Begrüßung nur 8–20 Uhr");
ok(/formularMitWhatsapp|optin_am/.test(mbs), "Takt: Begrüßung nur mit Ja zu WhatsApp");
ok(!/processIntake\(|leadEingang\(|fiaon-leads["']/.test(mbs), "Mara Business legt nie einen Privat-Lead an");

// ═══ A8 E-487 ══════════════════════════════════════════════════════════════
abschnitt("A8 E-487 (09.11.2026): Nummern mit Land, das Ja findet seine Anfrage, Ja + Termin, das Ja am Telefon");
{
  const MBS = await import("../server/lib/fiaon-mara-business");
  // Die Nummer aus dem Formular — mit dem Land, nie als +1 (Befund: Ja-Zeile „15…“ aus dem Buchungsformular).
  gleich(ER.formularNummer("15500000123"), "4915500000123", "„15…“ ohne 0 und ohne +49 → deutsche Handynummer (nie +1)");
  gleich(MBS.anfrageNummer("15500000123"), "4915500000123", "anfrageNummer: dieselbe Nummer");
  gleich(MBS.anfrageNummer("1550 0000123"), "4915500000123", "… auch mit Leerzeichen");
  gleich(MBS.anfrageNummer("+15500000123"), "4915500000123", "„+15…“ mit 11 Ziffern (Meta-Formular, ohne 0 getippt) → +49");
  gleich(MBS.anfrageNummer("0664 1234567", "Österreich"), "436641234567", "österreichische Handynummer mit 0 und Land „Österreich“");
  gleich(MBS.anfrageNummer("0664 1234567", "AT"), "436641234567", "… mit Land „AT“");
  gleich(MBS.anfrageNummer("0664 1234567"), null, "… ohne Land gilt Deutschland (0664 = Festnetz) → kein WhatsApp");
  gleich(MBS.anfrageNummer("079 123 45 67", "Schweiz"), "41791234567", "Schweizer Handynummer mit 0 und Land");
  gleich(MBS.anfrageNummer("+1 305 555 0100", "USA"), "13055550100", "eine echte US-Nummer (+1, Land USA) bleibt +1");
  gleich(MBS.anfrageNummer("12485302707", null, { ausWhatsapp: true }), "12485302707", "Anfrage aus WhatsApp: die Nummer bleibt, wie WhatsApp sie lieferte");
  // Welche Nummer bekommt das Ja?
  gleich(ER.waJaNummer({ anfrage: "4915500000123", eingabe: "15500000123" }), "4915500000123", "derselbe Anschluss → die Nummer der Anfrage („deren Meta-Nummer nehmen“)");
  gleich(ER.waJaNummer({ anfrage: "4915500000123", eingabe: "4915500000456" }), "4915500000456", "ein anderer Anschluss → seine Eingabe (für sie gab er das Ja)");
  gleich(ER.waJaNummer({ anfrage: "4915500000123", eingabe: null }), "4915500000123", "Eingabe Festnetz/leer → die Handynummer der Anfrage");
  gleich(ER.waJaNummer({ anfrage: null, eingabe: null }), null, "keine Handynummer → kein Ja");
  ok(ER.nummerFalschGelesen("15500000123", "4915500000123") && !ER.nummerFalschGelesen("4915500000123", "4915500000123") && !ER.nummerFalschGelesen("4915500000456", "4915500000123") && !ER.nummerFalschGelesen("anfrage-12", "4915500000123"), "falsch gelesen = gleicher Anschluss, andere Landesvorwahl");
  gleich(ER.nummerKey9("+49 155 00000123"), "500000123", "die letzten neun Ziffern");
  // Das Ja findet seine Anfrage (rein): an welche Nummer, mit welchem Ja?
  const ja = (o: Partial<import("../server/lib/fiaon-mara-business").WaJaZeile>) => ({ nummer: "15500000123", anfrageId: null, optinAm: new Date("2026-11-05T15:14:00Z"), optinQuelle: "website", optinText: null, ...o });
  const z1 = MBS.waZielFuerAnfrage({ anfrageId: 9061, nummer: "4915500000123", ja: [ja({})], formular: false });
  ok(z1?.nummer === "4915500000123" && z1?.quelle === "website" && z1?.am?.toISOString() === "2026-11-05T15:14:00.000Z", "Ja an einer falsch gelesenen Zeile (gleicher Anschluss) → die Nummer der Anfrage, Zeit und Quelle des Jas bleiben");
  const z2 = MBS.waZielFuerAnfrage({ anfrageId: 9062, nummer: "4915500000124", ja: [ja({ nummer: "4915500000456", anfrageId: 9062 })], formular: false });
  gleich(z2?.nummer, "4915500000456", "Ja an DIESER Anfrage für einen anderen Anschluss → genau diese Nummer");
  gleich(MBS.waZielFuerAnfrage({ anfrageId: 9063, nummer: "4915500000125", ja: [], formular: true })?.quelle, "formular", "Formular-Fassung 2 (WhatsApp-Satz) → Ja an der Nummer der Anfrage");
  gleich(MBS.waZielFuerAnfrage({ anfrageId: 9064, nummer: "4915500000126", ja: [ja({ nummer: "4915500000999", anfrageId: 9099 })], formular: false }), null, "ein fremdes Ja (andere Anfrage, anderer Anschluss) → kein Ja");
  gleich(MBS.waZielFuerAnfrage({ anfrageId: 9065, nummer: "4915500000127", ja: [], formular: false }), null, "ohne Ja schreibt Mara nie zuerst");
  gleich(MBS.waZielFuerAnfrage({ anfrageId: 9066, nummer: null, ja: [ja({ nummer: "4915500000777", anfrageId: 9066 })], formular: true })?.nummer, "4915500000777", "Anfrage mit Festnetz, Ja für eine Handynummer → an diese");
  // Der Satz am Telefon.
  ok(/FIAON LTD/.test(ER.GLOBAL_WA_TELEFON_SATZ.de) && /WhatsApp/.test(ER.GLOBAL_WA_TELEFON_SATZ.de) && /STOPP/.test(ER.GLOBAL_WA_TELEFON_SATZ.de), "Satz am Telefon nennt FIAON LTD, WhatsApp und STOPP (Meta verlangt Firma + Kanal)");
  ok(/FIAON LTD/.test(ER.GLOBAL_WA_TELEFON_SATZ.en) && /WhatsApp/.test(ER.GLOBAL_WA_TELEFON_SATZ.en) && /STOP/.test(ER.GLOBAL_WA_TELEFON_SATZ.en), "… englisch ebenso");
  ok(!/\b(du|dich|dir|dein\w*)\b/i.test(ER.GLOBAL_WA_TELEFON_SATZ.de) && sendePruefung(ER.GLOBAL_WA_TELEFON_SATZ.de, { namen: [] }).length === 0, `Satz am Telefon: Sie-Form, Hauswand grün (${sendePruefung(ER.GLOBAL_WA_TELEFON_SATZ.de, { namen: [] }).join(" · ")})`);
  gleich((MBS.TELEFON_JA_ERGEBNISSE as readonly string[]).join(","), "erreicht_interesse,erreicht_termin,erreicht_antrag", "das Ja am Telefon zählt nur nach einem Gespräch (nie bei „kein Interesse“, „nicht erreicht“)");
  ok(MBS.WA_KANDIDATEN >= 60, `Begrüßung: höheres Limit (${MBS.WA_KANDIDATEN}, vorher 30)`);

  // Quelltext-Wände: die Stellen aus dem Befund.
  const mbs8 = lies("server/lib/fiaon-mara-business.ts");
  const takt8 = mbs8.split("export async function waGlobalTakt(")[1]?.split("\nlet letzterPuls")[0] ?? "";
  ok(takt8.indexOf("jaVerknuepfen(lauf)") > 0 && takt8.indexOf("jaVerknuepfen(lauf)") < takt8.indexOf("VORLAGE.willkommen"), "Takt: zuerst die Ja-Zeilen verknüpfen (anfrage_id / letzte neun Ziffern), dann die Begrüßung");
  ok(/LEFT JOIN LATERAL \([\s\S]*?FROM fiaon_wa_global w[\s\S]*?\) g ON TRUE/.test(takt8) && /NOT COALESCE\(g\.begruesst, FALSE\)/.test(takt8) && /ORDER BY a\.created_at DESC LIMIT \$\{WA_KANDIDATEN\}/.test(takt8) && !/ORDER BY a\.created_at ASC LIMIT 30/.test(takt8), "Begrüßung: LEFT JOIN fiaon_wa_global (nur ohne willkommen_am), Ja im SQL, die neuesten zuerst, höheres Limit — niemand verhungert");
  ok(/AND \(g\.weg = 'whatsapp' OR g\.optin_am IS NOT NULL OR g\.willkommen_status = 'gesendet'/.test(takt8), "Schritte 2–5: auch mit Ja zu WhatsApp (optin_am), nicht nur mit Weg „whatsapp“");
  ok(/termin && !erinnerungErsetzt && \(z\.weg === "whatsapp" \|\| \(!!z\.optin_am && z\.weg !== "mail"\)\)/.test(takt8), "Erinnerung am Vortag: Weg WhatsApp ODER Ja zu WhatsApp (nicht bei „Per E-Mail“)");
  ok(/const bald = termin\.beginn\.getTime\(\) - Date\.now\(\) < 30 \* 3_600_000;/.test(takt8) && /erinnert_id = CASE WHEN \$\{erinnerungErsetzt\} THEN/.test(takt8), "kommt die Bestätigung unter 30 Stunden vor dem Gespräch, ersetzt sie die Erinnerung (nie zwei Nachrichten in Minuten)");
  ok(/fenster && nutzbar\(VORLAGE\.termin\)/.test(takt8) && !/if \(ok \|\| !offen\)/.test(takt8), "Terminnachricht: Vorlage nur 8–20 Uhr und erst nach Metas Freigabe — außerhalb des Fensters wartet sie (gilt nicht mehr als erledigt)");
  ok(!/Number\(new Intl\.DateTimeFormat/.test(mbs8) && /berlinMinuten\(new Date\(\)\)/.test(takt8), "Berliner Stunde über berlinMinuten — nie Number(Intl.format())");
  ok(/imVersandfenster\(/.test(takt8) && /WILLKOMMEN_MAX_TAG/.test(takt8) && /hatStopp\(/.test(takt8) && /vorlageNutzbar\(n, frei\)/.test(takt8) && /async function vorlageSenden[\s\S]{0,200}waSenden\(/.test(mbs8), "die Sperren bleiben: Fenster 8–20 Uhr, Tagesdeckel, STOPP, nur freigegebene Vorlagen, alles über waSenden (Bremse, Welten-Sperre)");
  ok(/nummer ~ '\^\(49\|43\|41\)'/.test(takt8), "Direktbucher ohne Anfrage: nur eine DACH-Handynummer (nie eine falsch gelesene)");
  const verkn = mbs8.split("async function jaVerknuepfen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/NOT LIKE 'whatsapp%'/.test(verkn) && /RIGHT\(REGEXP_REPLACE\(COALESCE\(telefon, ''\), '\\\\D', '', 'g'\), 9\) = \$\{k9\}/.test(verkn) && /willkommen_am IS NULL AND weg IS NULL/.test(verkn), "Verknüpfen: nur Formular-/Telefon-Jas, über die letzten neun Ziffern; die falsche Zeile fällt nur ohne eigenen Verlauf weg");
  const tel8 = mbs8.split("export async function telefonOptinMerken(")[1]?.split("\n}\n")[0] ?? "";
  ok(/optinQuelle: `telefon:\$\{wer\}`/.test(tel8) && /GLOBAL_WA_TELEFON_SATZ/.test(tel8), "Ja am Telefon: Quelle „telefon:<Name>“ und der vorgelesene Satz");
  ok(/ALTER TABLE fiaon_wa_global ADD COLUMN IF NOT EXISTS optin_text TEXT/.test(mbs8) && /optin_text = CASE WHEN fiaon_wa_global\.optin_am IS NULL/.test(mbs8), "der Satz steht beim Ja (optin_text) — das erste Ja bleibt stehen");
  const route8 = lies("server/routes/fiaon-global-termin.ts");
  ok((route8.match(/waJaMerken\(b, kontakt, erg\.anfrageId\)/g) ?? []).length === 2 && /waJaMerken\(b, kontakt, v\.anfrageId\)/.test(route8) && !/websiteOptinMerken\(null/.test(route8), "Website-Ja: alle drei Stellen geben die Anfrage mit (Buchung, Rückruf über den Link, Anfrage)");
  ok(/anfrageId: lead\?\.anfrageId \?\? null,/.test(lies("server/lib/fiaon-global-termin.ts")), "die Buchung nennt ihre Anfrage (Link oder offene Anfrage)");
}

// ═══ B ═════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B Lokale Datenbank (Wegwerf-Kopie)");
  const { sqlPool } = await import("../server/lib/db-pool");
  const mb = await import("../server/lib/fiaon-mara-business");
  const { ensureAnfragenSpalten } = await import("../server/routes/fiaon-bewerbungen");
  await ensureAnfragenSpalten();
  const zufall = String(Date.now()).slice(-6);
  const tel = (n: number) => `+4915500${zufall}${n}`;
  const [a1] = (await sqlPool`INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, text, status) VALUES ('global', 'Max Muster', ${`max${zufall}@muster.example`}, 'Muster GmbH', ${tel(1)}, 'Prüfstand E-481', 'neu') RETURNING id`) as any[];
  // 1. Offene Anfrage, Nummer unbekannt → Business, kein Privat-Lead.
  ok(await mb.businessEingang(tel(1).replace("+", ""), "Hallo, ich habe eine Frage"), "offene Global-Anfrage → Business-Eingang");
  const k1 = await mb.businessKontakt(tel(1).replace("+", ""), null);
  ok(!!k1 && k1.anfrageId === Number(a1.id), "businessKontakt findet die Anfrage");
  ok(!!k1?.code && /\/g\/[A-Za-z0-9]{10}$/.test(String(k1?.link)), "persönlicher Link wird angelegt");
  gleich(k1?.anrede, "Max Muster", "Anrede aus dem Namen — ohne bekannte Anrede nie geraten (kein „Herr“ aus dem Vornamen)");
  const [privatLead] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_leads WHERE telefon LIKE ${"%" + tel(1).slice(-9)}`) as any[];
  gleich(Number(privatLead?.n ?? 0), 0, "kein Privat-Lead angelegt");
  // 2. Kennung im Text → Business + Weg WhatsApp.
  const [a2] = (await sqlPool`INSERT INTO fiaon_anfragen (art, name, email, telefon, text, status) VALUES ('global', 'Erika Beispiel', ${`erika${zufall}@beispiel.example`}, ${tel(2)}, 'Prüfstand E-481', 'neu') RETURNING id`) as any[];
  const { leadCodeSichern } = await import("../server/lib/fiaon-lead-weg");
  const l2 = await leadCodeSichern(Number(a2.id));
  ok(await mb.businessEingang(tel(7).replace("+", ""), MB.waGlobalSatz(l2?.code ?? null)), "andere Nummer mit Kennung → Business");
  const [z2] = (await sqlPool`SELECT anfrage_id, weg, optin_quelle FROM fiaon_wa_global WHERE nummer = ${tel(7).replace("+", "")}`) as any[];
  ok(Number(z2?.anfrage_id) === Number(a2.id) && z2?.weg === "whatsapp" && z2?.optin_quelle === "whatsapp_selbst", "Kennung → Anfrage verknüpft, Weg WhatsApp, Ja zu WhatsApp");
  // 3. Unbekannt ohne Global-Bezug → alter Weg.
  ok(!(await mb.businessEingang(tel(8).replace("+", ""), "Hallo, ich will eine Kreditkarte")), "ohne Global-Bezug → Privat-Weg wie bisher");
  // 4. Welten-Sperre.
  ok(!!(await mb.vorlageWeltSperre("fiaon_gl_willkommen", tel(8).replace("+", ""), null)), "Business-Vorlage an Nicht-Business → gesperrt");
  ok(!!(await mb.vorlageWeltSperre("fiaon_kk_anfrage", tel(1).replace("+", ""), null)), "Privat-Vorlage an Business-Lead → gesperrt");
  gleich(await mb.vorlageWeltSperre("fiaon_gl_willkommen", tel(1).replace("+", ""), null), null, "Business-Vorlage an Business-Lead → darf");
  gleich(await mb.vorlageWeltSperre("fiaon_kk_anfrage", tel(8).replace("+", ""), null), null, "Privat-Vorlage an Privat → darf");
  // 5. Weg merken.
  await mb.wegSetzen(tel(1).replace("+", ""), "mail", "pruefstand");
  const [z1] = (await sqlPool`SELECT weg, weg_quelle FROM fiaon_wa_global WHERE nummer = ${tel(1).replace("+", "")}`) as any[];
  ok(z1?.weg === "mail" && z1?.weg_quelle === "pruefstand", "Weg E-Mail gemerkt");
  await sqlPool`DELETE FROM fiaon_anfragen WHERE id IN (${Number(a1.id)}, ${Number(a2.id)})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_global WHERE nummer LIKE ${"4915500" + zufall + "%"}`.catch(() => {});
} else {
  console.log("\n(B übersprungen — keine lokale Prüf-Datenbank fiaon_pruefstand…)");
}

// ═══ C ═════════════════════════════════════════════════════════════════════
if (KI) {
  abschnitt("C Echte KI (ohne Versand)");
  const env = readFileSync("/Users/Justin/Developer/fiaon-plattform/.env", "utf8");
  const renderKey = (env.match(/^RENDER_API_KEY=(.+)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  const r = await fetch("https://api.render.com/v1/services/srv-da5dlfu417fc73f46ua0/env-vars?limit=100", { headers: { Authorization: `Bearer ${renderKey}`, Accept: "application/json" } });
  const liste: any[] = await r.json();
  const wert = (k: string) => liste.map((x) => x.envVar ?? x).find((x) => x?.key === k)?.value ?? "";
  if (wert("KI_ANBIETER") !== "openai") { console.log(`  KI_ANBIETER ist „${wert("KI_ANBIETER")}“ — C nur mit OpenAI.`); }
  process.env.OPENAI_API_KEY = wert("OPENAI_API_KEY");
  process.env.KI_ANBIETER = "openai";
  const { kiAufruf, antwortLesen } = await import("../server/lib/fiaon-postmeister-agent");
  const { kiModell } = await import("../server/lib/fiaon-ki-kasse");
  const FRAGEN = [
    "Was kostet das bei Ihnen?", "Bekomme ich damit sofort einen Kredit für meine Firma?", "Muss ich dafür in die USA fliegen?",
    "Spare ich damit Steuern in Deutschland?", "Ist das überhaupt seriös? Klingt zu gut.", "Wie lange dauert die Gründung?",
    "Ich habe eine GmbH in Bayern, 12 Mitarbeiter, wir wollen expandieren. Passt das?", "Welche Bank nehmen Sie?",
    "Brauche ich eine US-Adresse?", "Kann ich mit Ihnen auch per Mail weitermachen?", "Am liebsten telefonieren wir. Donnerstag um 14 Uhr?",
    "Ich bin gerade im Urlaub, melde mich nächste Woche.", "Wie hoch ist der Zins in den USA?", "Bin ich ein Mensch? Also sind Sie ein Mensch?",
    "Hello, do you also speak English? I run a company in Switzerland.", "Ich habe Schufa-Einträge, geht das trotzdem?",
    "Ich will das nicht mehr, das ist Abzocke!", "Was genau bekomme ich im Paket?", "Kann das Kapital auch in Deutschland investiert werden?",
    "Mein Steuerberater ist skeptisch. Was sagen Sie dazu?",
  ];
  let gruen = 0;
  for (const [i, frage] of FRAGEN.entries()) {
    const auftragC = MB.businessAuftrag({ anrede: "Herr Muster", firma: "Muster GmbH", email: "max@muster.example", antworten: ["Was planen Sie mit Ihrer US-Gesellschaft? — Beides"], weg: null, termin: null,
      freieZeiten: ["Donnerstag, 12.11., 14:00 Uhr [2026-11-12 14:00]", "Freitag, 13.11., 16:30 Uhr [2026-11-13 16:30]"], link: "https://fiaon.com/g/Ab3dEf7hJk",
      ersteAntwort: true, englisch: /^hello/i.test(frage), erzaehlt: [], anweisung: null });
    let funde: string[] = ["—"]; let obj: any = null;
    for (let v = 0; v < 2 && funde.length; v++) {
      const j = await kiAufruf({ dienst: MB.MB_DIENST, modell: kiModell("whatsapp"), schema: MB.MB_SCHEMA, aufwand: "low", maxTokens: 3000, person: null,
        nachrichten: v === 0 ? [{ role: "system", content: auftragC }, { role: "user", content: frage }]
          : [{ role: "system", content: auftragC }, { role: "user", content: frage }, { role: "user", content: `INTERN: Deine letzte Fassung verletzt: ${funde.join(" · ")}. Schreib neu.` }] });
      obj = antwortLesen(j, "Prüfstand Mara Business");
      const text = String(obj?.antwort ?? "");
      funde = [...sendePruefung(text), ...MB.businessWand(text, { ersteAntwort: true })];
    }
    if (!funde.length) gruen++;
    console.log(`\n  [${i + 1}] Kunde: ${frage}\n      Mara: ${String(obj?.antwort ?? "").replace(/\n/g, " ")}\n      weg=${obj?.weg ?? "-"} termin=${obj?.termin ? JSON.stringify(obj.termin) : "-"} uebergabe=${obj?.uebergabe ? "ja" : "-"}${funde.length ? `\n      ✗ ${funde.join(" · ")}` : ""}`);
  }
  console.log(`\n  KI: ${gruen} von ${FRAGEN.length} Antworten grün.`);
  ok(gruen / FRAGEN.length >= 0.95, `mindestens 95 % grün (${gruen}/${FRAGEN.length})`);
  process.env.OPENAI_API_KEY = "";
}

if (LOKAL_DB) await (await import("../server/lib/db-pool")).sqlPool.end({ timeout: 2 }).catch(() => {});
console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler} von ${geprueft} Prüfungen bestanden.`);
process.exit(fehler === 0 ? 0 : 1);
