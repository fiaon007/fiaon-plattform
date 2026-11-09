// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-476 Scheibe 5 (05.11.2026): EIN STAND JE LEAD, DANIELS TAKT, ÜBERSICHT 18:30, WÄCHTER
// (Plan Lead-Weg 2.0 „Teil C“ — als eigener Prüfstand neben pruef-lead-weg.ts und pruef-lead-mails.ts)
//
//   A  REIN (immer, ohne Datenbank, ohne Netz): Adresse „Lead-Meldungen an“ (nur @fiaon.com, Vorgabe Visitenkarte), Schalter,
//      Dienstzeit-Uhr (Nacht, Wochenende, 17:55 Uhr, Feiertag, Zeitumstellung), „am Freitag ab 9 Uhr“ statt „morgen“, die Leiter
//      15/60/120 (je einmal, nur Dienstzeit, Aufholen ohne Doppelmail), Pflicht-Notiz (nur Business-Leads), Termin-Regel, der
//      EINE Stand (Anfrage aus Cockpit/Kalender/Anrufen, was ein Ereignis mit dem Auftrag macht, „Termin“ ohne Termin), Übersicht
//      fällig (18:30, Merker, Fehlversuche, Wochenende, Feiertag), die Texte (T1, Erinnerung, Zusage, Zeile an Justin, Übersicht
//      mit erfundenen Leads, leer = keine Mail), Wächter-Urteil, Mail-Ziel der Aufträge (eigene / Umleitung), Quelltext-Wände.
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): T1 an die Meldeadresse (nie an
//      die Login-Adresse), genau einmal, keine Auftrag-Mail an die Login-Adresse; Altbestand/Privat/gebucht → keine T1; Schalter AUS;
//      Leiter 15/60/120 mit Rückruf an die Vertretung; Reaktion (geöffnet, Anruf) stoppt; Wochenende still; Anruf-Route (Pflicht-
//      Notiz, Termin-Regel, Kaltakquise frei, „Was er selbst erzählt hat“, Anfrage + Auftrag ziehen mit, nicht erreicht → offen mit
//      Wiedervorlage); Buchung → „termin“, Absage → Auftrag wieder offen; Stand-Leiste; Übersicht (Vorschau sendet nie, 18:30 einmal,
//      Fehlversuch, leer); Wächter grün/rot (Kalender leer bei Werbung, ohne Dossier, Lead-Mail gescheitert, Webhook still EINMAL);
//      Ableitung des Altbestands (Vorschau ändert nichts, Anwenden korrigiert); Chefbüro-Feld (nur @fiaon.com).
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-lead-takt.ts   (nur A)
//   createdb -T fiaon_pruefstand fiaon_pruefstand_lt5 …; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_lt5?sslmode=require'   (A + B), danach dropdb.
//
//   E-490 (09.11.2026): A13 (Mail je Fall, zweiter Lauf, Termin 60 Tage), B9; Nachbesserung (Gutachten): A13 (nur bestätigte
//   Fälle in der Mail, NEU markiert, gemailt ∩ rot, neueste zuerst), B10 (Versand scheitert/wirft → Merker zurück; rot → gelb →
//   rot; nur bestätigte Fälle; Kontakt erst nach der Buchung; echter Meta-Eingang für WhatsApp-Wächter und T1).
// Verschickt nichts: Schlüssel in der Umgebung → Abbruch; Mails über die Attrappen. Repo öffentlich: nur erfundene Menschen.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN", "OPENREGISTER_API_KEY", "GMAIL_SERVICE_ACCOUNT_JSON"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(ist === soll, `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const BANK_SATZ = /entscheidet das jeweilige Institut|Institut entscheidet|Bank entscheidet|die Bank entscheidet/i;

const ST = await import("../shared/fiaon-lead-takt");
const R = await import("../server/lib/fiaon-lead-takt-regeln");
const { berlinZeitpunkt } = await import("../server/lib/fiaon-time");
const { zuweisungZiel } = await import("../server/routes/fiaon-betreiber-todo");
const { radarBankVorbehalt } = await import("../shared/fiaon-radar");
const { VISITENKARTEN } = await import("../shared/fiaon-visitenkarte");

// Berliner Wandzeit → Date (über die Server-Regel, nie „Date.UTC − 1 Stunde“ von Hand).
const um = (tag: string, hh: number, mm = 0) => berlinZeitpunkt(tag, hh * 60 + mm);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 „Lead-Meldungen an“ und die Schalter");
ok(ST.meldeAdresseGueltig("lt-pruef@fiaon.com") && ST.meldeAdresseGueltig(" Lt-Pruef@FIAON.com "), "Firmenadresse @fiaon.com ist gültig (auch mit Großbuchstaben)");
ok(!ST.meldeAdresseGueltig("lt-privat@gmail.example") && !ST.meldeAdresseGueltig("x@fiaon.com.evil.example") && !ST.meldeAdresseGueltig(""), "private oder fremde Adresse ist NICHT gültig (Entscheidung 3A)");
{
  const e = ST.meldeAdresseWaehlen("lt-team@fiaon.com", 8);
  ok(e.an === "lt-team@fiaon.com" && e.quelle === "einstellung", "gültige Einstellung gilt");
  const v = ST.meldeAdresseWaehlen("", 8);
  ok(v.an === VISITENKARTEN.daniel.email && v.an.endsWith("@fiaon.com") && v.quelle === "visitenkarte", "leer → Visitenkarte der zuständigen Person (heute Daniel)");
  const p = ST.meldeAdresseWaehlen("lt-privat@gmail.example", 8);
  ok(p.quelle === "visitenkarte" && p.an.endsWith("@fiaon.com"), "eine private Adresse in der Einstellung wird nie benutzt");
  const o = ST.meldeAdresseWaehlen(null, 987654);
  ok(o.quelle === "vorgabe" && o.an.endsWith("@fiaon.com"), "ohne Visitenkarte → Vorgabe aus Entscheidung 3A (eine Firmenadresse)");
}
ok(ST.schalterLesen(null, true) && !ST.schalterLesen("0", true) && ST.schalterLesen("1", false) && !ST.schalterLesen("aus", true), "Schalter: leer = Vorgabe, 0/aus = AUS, 1 = AN");

abschnitt("A2 Dienstzeit-Uhr (Mo–Fr 9–18 Uhr Berlin, ohne Feiertage)");
{
  // 2026-11-05 ist ein Donnerstag, 2026-11-06 ein Freitag, 2026-11-09 ein Montag.
  gleich(R.dienstMinuten(um("2026-11-09", 10), um("2026-11-09", 10, 15)), 15, "Mo 10:00 → 10:15 = 15");
  gleich(R.dienstMinuten(um("2026-11-06", 17, 55), um("2026-11-09", 9, 10)), 15, "Fr 17:55 → Mo 09:10 = 5 + 10 (Wochenende zählt nicht)");
  gleich(R.dienstMinuten(um("2026-11-05", 21, 13), um("2026-11-06", 9, 0)), 0, "Lead von 21:13 Uhr: am nächsten Morgen um 9:00 bei Minute 0");
  gleich(R.dienstMinuten(um("2026-11-05", 21, 13), um("2026-11-06", 9, 15)), 15, "… um 9:15 bei Minute 15 („nachts zählt die Uhr ab 9 Uhr“)");
  gleich(R.dienstMinuten(um("2026-11-07", 12), um("2026-11-09", 9, 15)), 15, "Sa 12:00 → Mo 09:15 = 15");
  gleich(R.dienstMinuten(um("2026-12-24", 17, 50), um("2026-12-28", 9, 10)), 20, "Feiertag: Do 24.12. 17:50 → Mo 28.12. 09:10 = 10 + 10 (25.12. Feiertag, Wochenende)");
  gleich(R.dienstMinuten(um("2026-10-23", 17), um("2026-10-26", 10)), 120, "über die Zeitumstellung (25.10.): Fr 17–18 + Mo 9–10 = 120");
  ok(R.imDienst(um("2026-11-09", 9)) && !R.imDienst(um("2026-11-09", 18)) && !R.imDienst(um("2026-11-07", 11)) && !R.imDienst(um("2026-12-25", 11)), "imDienst: 9:00 ja, 18:00 nein, Samstag nein, Feiertag nein");
  gleich(R.anrufWann(um("2026-11-05", 21, 13)).text, "am Freitag, 06.11. ab 9 Uhr", "21:13 Uhr Do → „am Freitag, 06.11. ab 9 Uhr“ (nie „morgen“)");
  gleich(R.anrufWann(um("2026-11-05", 0, 33)).text, "am Donnerstag, 05.11. ab 9 Uhr", "00:33 Uhr → derselbe Tag ab 9 Uhr (Fall Nacht-Eingang)");
  gleich(R.anrufWann(um("2026-11-06", 22)).text, "am Montag, 09.11. ab 9 Uhr", "Fr 22:00 → „am Montag, 09.11. ab 9 Uhr“");
  ok(R.anrufWann(um("2026-11-05", 10)).jetzt, "in der Dienstzeit: „jetzt“");
}

abschnitt("A3 Die Leiter 15 / 60 / 120 (je einmal, nur Dienstzeit)");
{
  const ein = um("2026-11-09", 9);
  const p = (m: number, o: Partial<{ reagiert: boolean; angerufen: boolean; e15: boolean; e60: boolean; e120: boolean }> = {}) => R.eskalationPlanen({
    eingang: ein, jetzt: new Date(ein.getTime() + m * 60_000), reagiert: !!o.reagiert, angerufen: !!o.angerufen,
    gesendet: { e15: !!o.e15, e60: !!o.e60, e120: !!o.e120 },
  });
  ok(p(14).markieren.length === 0, "14 Minuten: nichts");
  const a = p(15);
  ok(a.daniel === "e15" && !a.justin && !a.vertretung && a.markieren.join() === "e15", "15 Minuten ohne Reaktion: Erinnerung an Daniel");
  ok(p(16, { e15: true }).markieren.length === 0, "16 Minuten, schon erinnert: nichts (einmal)");
  const b = p(60, { e15: true });
  ok(b.justin && b.vertretung && !b.daniel && b.markieren.join() === "e60", "60 Minuten: Zeile an Justin + Rückruf an die Vertretung");
  const c = p(120, { e15: true, e60: true });
  ok(c.daniel === "e120" && c.vertretung && !c.justin, "120 Minuten ohne Anruf: Zusage-Wächter (Hinweis an Daniel, Rückruf an die Vertretung)");
  const d = p(125, { reagiert: true });
  ok(d.daniel === "e120" && !d.justin && d.markieren.join() === "e120", "geöffnet, aber kein Anruf nach 120: nur der Zusage-Wächter");
  ok(p(200, { reagiert: true, angerufen: true }).markieren.length === 0, "angerufen: nichts mehr");
  const e = p(130);
  ok(e.daniel === "e120" && e.justin && e.markieren.sort().join() === "e120,e15,e60", "Aufholen nach Ausfall: Daniel bekommt EINE (die stärkere) Mail, Justin seine Zeile");
  ok(R.eskalationPlanen({ eingang: um("2026-11-06", 10), jetzt: um("2026-11-07", 11), reagiert: false, angerufen: false, gesendet: { e15: false, e60: false, e120: false } }).markieren.length === 0, "Samstag: keine Erinnerung");
}

abschnitt("A4 Pflicht-Notiz (nur Business-Leads) und Termin-Regel");
{
  const zuKurz = ST.anrufNotizPruefen({ ergebnis: "erreicht_interesse", istLead: true, text: "Interesse." });
  ok(!zuKurz.ok && zuKurz.feld === "notiz", "Business-Lead, „erreicht — Interesse“ ohne zwei, drei Sätze → Fehler");
  const termin = ST.anrufNotizPruefen({ ergebnis: "erreicht_termin", istLead: true, text: "" });
  ok(!termin.ok, "auch bei „Termin vereinbart“ Pflicht");
  const gut = ST.anrufNotizPruefen({ ergebnis: "erreicht_interesse", istLead: true, text: "Inhaber einer Spedition mit 40 Leuten, will Kapital für den Fuhrpark.", felder: { wohnort: "Bayern", us_bezug: "Kunden in Florida" }, einschaetzung: "heiß" });
  ok(gut.ok && /Wohnort \/ Land: Bayern/.test(gut.text ?? "") && gut.erzaehlt === gut.text && gut.einschaetzung === "heiss", "mit Notiz: ein Text (Notiz + kurze Felder) → „Was er selbst erzählt hat“");
  const kalt = ST.anrufNotizPruefen({ ergebnis: "erreicht_interesse", istLead: false, text: "" });
  ok(kalt.ok && kalt.erzaehlt === null, "Kaltakquise (kein Business-Lead): keine Pflicht (Gutachten 0, Mangel 9)");
  const nichtErr = ST.anrufNotizPruefen({ ergebnis: "nicht_erreicht", istLead: true, text: "Mailbox voll" });
  ok(nichtErr.ok && nichtErr.erzaehlt === null && nichtErr.text === "Mailbox voll", "nicht erreicht: frei, und keine Aussage des Leads");
  ok(/Termin bei Justin eintragen/.test(ST.TERMIN_OHNE_KALENDER), "Termin-Regel nennt den Weg („Termin bei Justin eintragen“)");
}

abschnitt("A5 Der EINE Stand");
{
  const s = (o: Partial<{ jetzt: string; firmaStatus: string | null; terminGebucht: boolean; angerufen: boolean; gefuehrt: boolean }>) =>
    ST.anfrageStandAus({ jetzt: o.jetzt ?? "neu", firmaStatus: o.firmaStatus ?? null, terminGebucht: !!o.terminGebucht, angerufen: !!o.angerufen, gefuehrt: !!o.gefuehrt });
  gleich(s({}), "neu", "nichts passiert → neu");
  gleich(s({ angerufen: true, firmaStatus: "wiedervorlage" }), "in_arbeit", "angerufen → in Arbeit");
  gleich(s({ firmaStatus: "termin", angerufen: true }), "in_arbeit", "Cockpit „termin“ OHNE Termin → nicht „termin“ (Fall Termin ohne Kalender)");
  gleich(s({ firmaStatus: "termin", terminGebucht: true }), "termin", "gebuchter Termin → termin");
  gleich(s({ firmaStatus: "kein_interesse", angerufen: true }), "kein_interesse", "Abschluss im Cockpit → derselbe Stand");
  gleich(s({ jetzt: "privat", angerufen: true }), "privat", "Privat-Weg bleibt Privat-Weg");
  gleich(ST.auftragNachEreignis("anruf:erreicht_interesse"), "schliessen", "erreicht → Auftrag erfüllt");
  gleich(ST.auftragNachEreignis("anruf:nicht_erreicht"), "offen_lassen", "nicht erreicht → Auftrag bleibt offen");
  gleich(ST.auftragNachEreignis("anruf:mailbox"), "offen_lassen", "Mailbox → bleibt offen");
  gleich(ST.auftragNachEreignis("termin_gebucht"), "schliessen", "Termin → schließen");
  gleich(ST.auftragNachEreignis("termin_abgesagt"), "wieder_oeffnen", "Absage → wieder öffnen");
  gleich(ST.auftragNachEreignis("gespraech_nicht_zustande"), "wieder_oeffnen", "Justin hat ihn nicht erreicht → wieder öffnen");
  ok(ST.firmaStandKorrektur({ firmaStatus: "termin", terminGebucht: false })?.status === "wiedervorlage" && ST.firmaStandKorrektur({ firmaStatus: "termin", terminGebucht: true }) === null, "„Termin“ ohne Termin → Wiedervorlage; mit Termin → stimmt");
}

abschnitt("A6 Übersicht 18:30 — wann");
{
  ok(!R.uebersichtFaellig(um("2026-11-05", 18, 29), "").faellig, "18:29 Uhr: noch nicht");
  ok(R.uebersichtFaellig(um("2026-11-05", 18, 30), "").faellig, "18:30 Uhr: fällig");
  ok(!R.uebersichtFaellig(um("2026-11-05", 19), "2026-11-05").faellig, "heute schon erledigt: nicht noch einmal");
  ok(R.uebersichtFaellig(um("2026-11-05", 19), "2026-11-05#f1").faellig, "ein Fehlversuch: erneut");
  ok(!R.uebersichtFaellig(um("2026-11-05", 19), "2026-11-05#f3").faellig, "drei Fehlversuche: für heute aufgegeben");
  ok(R.uebersichtFaellig(um("2026-11-06", 18, 45), "2026-11-05").faellig, "der Merker von gestern hält heute nicht auf");
  ok(!R.uebersichtFaellig(um("2026-11-07", 19), "").faellig && !R.uebersichtFaellig(um("2026-12-25", 19), "").faellig, "Samstag und Feiertag: keine Übersicht");
}

abschnitt("A7 Die Texte (rein, erfundene Menschen)");
{
  const antworten = [
    { schluessel: "vorhaben", frage: "Was planen Sie mit Ihrer US-Gesellschaft?", antwort: "Beides", code: "vorhaben_3" },
    { schluessel: "kapitalrahmen_ziel", frage: "Welchen Kapitalrahmen planen Sie als Ziel?", antwort: "100.000 $ – 250.000 $", code: "kapitalrahmen_ziel_2" },
    { schluessel: "wann_starten", frage: "Wann möchten Sie starten?", antwort: "So bald wie möglich", code: "wann_starten_1" },
  ];
  const t1d = {
    anfrageId: 57, anzeige: "Pruef Logistik GmbH", name: "Pruef Person", kanal: "meta" as const, eingangAm: um("2026-11-05", 21, 13), antworten,
    nachricht: null, paketwunsch: null, temperatur: "heiss" as const, telefon: { lesbar: "+49 151 00000001", e164: "+4915100000001", land: "Deutschland" },
    email: "pruef@pruef.example", mailArt: "firma" as const, mailVonJustin: "Justin hat ihm um 21:23 Uhr aus js@ geschrieben.", vermerk: null,
    cockpitUrl: "https://fiaon.com/agent/firmen?firma=3", wer: "Daniel",
  };
  const nacht = R.t1Mail(t1d, um("2026-11-05", 21, 14));
  ok(nacht.betreff === "Neuer Lead: Pruef Logistik GmbH · 100.000 $ – 250.000 $ · So bald wie möglich", `T1-Betreff „Neuer Lead: Firma · Rahmen · Start“ (${nacht.betreff})`);
  ok(nacht.text.startsWith("NEUER LEAD: Pruef Logistik GmbH — bitte am Freitag, 06.11. ab 9 Uhr anrufen"), "T1 nachts: Wochentag statt „morgen“");
  ok(/SEINE ANTWORTEN/.test(nacht.text) && /Kapitalrahmen planen Sie als Ziel\? — 100\.000 \$ – 250\.000 \$/.test(nacht.text), "T1: seine Antworten im Klartext");
  ok(/Termin bei Justin eintragen/.test(nacht.text) && /schließt sich dein Auftrag von allein/.test(nacht.text), "T1: was zu tun ist (eintragen; bucht er selbst, schließt sich der Auftrag)");
  ok(nacht.links.length === 1 && nacht.links[0] === t1d.cockpitUrl && nacht.knoepfe.some((k) => k.url === "tel:+4915100000001"), "T1: klickbar nur das Cockpit (+ tel:)");
  ok(!BANK_SATZ.test(nacht.text) && !radarBankVorbehalt(nacht.text) && !/northwest/i.test(nacht.text), "T1: kein Bank-Satz, kein Partnername");
  const tag = R.t1Mail({ ...t1d, kanal: "website", antworten: [], nachricht: "Bitte Rückruf: https://boese.example/x", eingangAm: um("2026-11-05", 10) }, um("2026-11-05", 10, 1));
  ok(tag.text.startsWith("NEUER LEAD: Pruef Logistik GmbH — bitte jetzt anrufen") && /https\[:\]\/\/boese\.example/.test(tag.text) && tag.betreff === "Neuer Lead: Pruef Logistik GmbH", "T1 Website, Dienstzeit: „jetzt“, Nachricht entschärft");
  const e15 = R.erinnerungMail({ stufe: "e15", anzeige: "Pruef Logistik GmbH", name: "Pruef Person", telefon: t1d.telefon, wer: "Daniel", minuten: 15, zusage: true, vertretung: null, cockpitUrl: t1d.cockpitUrl, t1Betreff: nacht.betreff });
  ok(e15.betreff === `Re: ${nacht.betreff}` && e15.text.startsWith("LEAD WARTET SEIT 15 MIN.: Pruef Logistik GmbH"), "Erinnerung im Faden der Lead-Meldung (Re: …)");
  const z = R.erinnerungMail({ stufe: "e120", anzeige: "Pruef Logistik GmbH", name: "Pruef Person", telefon: t1d.telefon, wer: "Daniel", minuten: 121, zusage: true, vertretung: "Pruef Vertretung", cockpitUrl: t1d.cockpitUrl, t1Betreff: null });
  ok(/Justins Mail hat Pruef Person deinen Anruf angekündigt/.test(z.text) && /Pruef Vertretung hat zur Sicherheit eine Rückruf-Aufgabe/.test(z.text), "Zusage-Wächter: nennt die Zusage und die Vertretung");
  const j = R.justinEskalationMail({ anzeige: "Pruef Logistik GmbH", name: "Pruef Person", eingangAm: um("2026-11-09", 9), wer: "Daniel", minuten: 60, vertretung: "Pruef Vertretung", telefon: t1d.telefon, cockpitUrl: t1d.cockpitUrl, selbstUrl: "https://fiaon.com/api/fiaon/lead-dossier/selbst/1.x", stamm: "Lead: Pruef Logistik GmbH · heiß" });
  ok(j.betreff === "Re: Lead: Pruef Logistik GmbH · heiß" && j.text.startsWith("WARTET SEIT 60 MIN.: Pruef Logistik GmbH — Daniel hat noch nicht reagiert"), "Zeile an Justin im Faden des Leads (Dossier)");
  ok(/keine Aufgabe für dich/.test(j.text) && j.knoepfe.some((k) => k.text === "Ich rufe selbst an"), "keine Aufgabe an Justin, „Ich rufe selbst an“ als Knopf");
  const ohneV = R.justinEskalationMail({ anzeige: "X", name: "Y", eingangAm: um("2026-11-09", 9), wer: "Daniel", minuten: 60, vertretung: null, telefon: t1d.telefon, cockpitUrl: t1d.cockpitUrl, selbstUrl: null, stamm: null });
  ok(!/Vertretung eingetragen|Chefbüro/.test(ohneV.text) && /keine Aufgabe für dich/.test(ohneV.text) && ohneV.betreff === "Lead wartet seit 60 Min.: X", "ohne Vertretung: keine Aufforderung an Justin (der Hinweis steht im Lagezimmer) — Gutachten Betreiber, Mangel 5");
  // Nachbesserung (Gutachten Betreiber, Mangel 5): mehrere wartende Leads in einem Takt = EINE Mail an Daniel bzw. Justin.
  const zeilen = [1, 2, 3].map((n) => ({ anzeige: `Pruef Firma ${n} GmbH`, name: `Pruef ${n}`, minuten: 15, telefon: t1d.telefon, cockpitUrl: t1d.cockpitUrl, stufe: "e15" as const, vertretung: null }));
  const sammel = R.erinnerungSammelMail(zeilen, "Daniel", "https://fiaon.com/agent/firmen");
  ok(sammel.betreff === "3 Leads warten auf deinen Anruf" && zeilen.every((z) => sammel.text.includes(z.anzeige)) && sammel.links.length === 1, "Sammel-Erinnerung: drei Leads, eine Mail");
  const js = R.justinSammelMail(zeilen.map((z) => ({ ...z, stufe: "e60" as const, minuten: 61 })), "Daniel", "https://fiaon.com/agent/firmen");
  ok(js.betreff === "3 Leads warten seit über 60 Min." && /Keine Aufgabe für dich/.test(js.text), "Sammelzeile an Justin: eine Mail, keine Aufgabe");
  // Nachbesserung (Gutachten Betreiber, Mangel 3): Wunschzeit und Englisch stehen in T1 — „bitte zu seiner Wunschzeit anrufen“.
  const wz = R.t1Mail({ ...t1d, wunschzeit: "Dienstag ab 14 Uhr", englisch: true, keineMails: true }, um("2026-11-05", 10, 1));
  ok(wz.text.startsWith("NEUER LEAD: Pruef Logistik GmbH — bitte zu seiner Wunschzeit (Dienstag ab 14 Uhr) anrufen") && /Gespräch auf ENGLISCH/.test(wz.text) && /keine Mails — anrufen ist erlaubt/.test(wz.text) && /1\. Anrufen: [^\n]*zu seiner Wunschzeit/.test(wz.text), "T1: Wunschzeit, Englisch und „keine Mails“");
  // Nachbesserung (Gutachten Betreiber, Mangel 2/6/8): Nachträge im Faden der Lead-Meldung.
  const sb = R.t1NachtragMail({ art: "selbst", anzeige: "Pruef Logistik GmbH", wer: "Daniel", t1Betreff: nacht.betreff, cockpitUrl: t1d.cockpitUrl });
  ok(sb.betreff === `Re: ${nacht.betreff}` && /Justin ruft Pruef Logistik GmbH selbst an — bitte nicht anrufen/.test(sb.text), "Nachtrag „Justin ruft selbst an“ im Faden");
  ok(/hat selbst bei Justin gebucht/.test(R.t1NachtragMail({ art: "gebucht", anzeige: "X", wer: "Daniel", t1Betreff: null, cockpitUrl: t1d.cockpitUrl }).text)
    && /bitte heute anrufen und neu eintragen/.test(R.t1NachtragMail({ art: "abgesagt", anzeige: "X", wer: "Daniel", t1Betreff: null, cockpitUrl: t1d.cockpitUrl }).text)
    && /ein Anruf genügt/.test(R.t1NachtragMail({ art: "zweiter", anzeige: "X", wer: "Daniel", t1Betreff: null, zweiteAnfrage: 9, cockpitUrl: t1d.cockpitUrl }).text), "Nachträge: selbst gebucht, abgesagt, zweiter Eingang");
  ok(R.leadOffen({ stand: "neu", termin: null, anrufe: { n: 0, letzter: null }, selbst: true }, um("2026-11-05", 18)) === null, "Justin ruft selbst an → für das Team nichts offen (Übersicht)");
  const v = R.vertretungAuftragText({ anfrageId: 57, anzeige: "Pruef Logistik GmbH", eingangAm: um("2026-11-09", 9), minuten: 60, wer: "Daniel", stufe: "e60", telefon: "+49 151 0", email: "p@pruef.example" });
  ok(/^FIAON Global: Rückruf Pruef Logistik GmbH — wartet seit 60 Min\./.test(v.titel) && /schließt sich diese Aufgabe von allein/.test(v.text), "Rückruf-Aufgabe der Vertretung");
  // Übersicht mit erfundenen Leads — rendert, sendet nie.
  const jetzt = um("2026-11-05", 18, 31);
  const lead = (n: number, o: Partial<import("../server/lib/fiaon-lead-takt-regeln").UebersichtLead> = {}) => ({
    anfrageId: 60 + n, anzeige: `Pruef Firma ${n} GmbH`, kanal: "meta" as const, eingangAm: um("2026-11-05", 9 + n), temperatur: "heiss" as const,
    antwortenKurz: "Beides · 100.000 $ – 250.000 $ · So bald wie möglich", mail: { status: "gesendet", am: um("2026-11-05", 9 + n, 10) },
    anrufe: { n: 0, letzter: null }, termin: null, stand: "neu", eskaliert: null, ...o,
  });
  const daten = {
    tag: "2026-11-05", jetzt,
    neu: [lead(1), lead(2, { anrufe: { n: 1, letzter: { ergebnis: "erreicht_termin", am: um("2026-11-05", 12, 5), wer: "Daniel Pruef" } }, termin: { beginn: um("2026-11-11", 14), status: "gebucht", bei: "Justin Pruef" }, stand: "termin" }),
      lead(3, { anrufe: { n: 2, letzter: { ergebnis: "nicht_erreicht", am: um("2026-11-05", 15), wer: "Daniel Pruef" } }, stand: "in_arbeit", eskaliert: "e15" })],
    offen: [lead(4, { eingangAm: um("2026-11-03", 10) })], privatWeg: 1,
    anrufe: { eintraege: 3, leads: 2 }, termineGebucht: 1,
    gespraeche: { heute: [{ beginn: um("2026-11-05", 14), anzeige: "Pruef Gespräch GmbH", status: "erledigt" }], morgen: [{ beginn: um("2026-11-06", 10), anzeige: "Pruef Morgen GmbH" }] },
    takt: { t1: 3, e15: 1, e60: 0, e120: 0, ersterAnrufMin: 42 }, nachfass: { n1: 2, n2: 1, n3: 0, gestoppt: 1 }, ki: { usd: 0.45, deckelUsd: 8, an: true },
    waechter: ["Lead-Wächter: Kalender leer, während die Global-Werbung läuft"], cockpitUrl: "https://fiaon.com/agent/firmen",
  };
  const u = R.uebersichtMail(daten, { art: "justin" });
  gleich(u.betreff, "FIAON Global heute: 3 Leads · 1 Termin · 2 angerufen", "Übersicht-Betreff (Plan: „5 Leads · 2 Termine · 3 angerufen“)");
  ok(/NEU HEUTE/.test(u.text) && /offen: anrufen/.test(u.text) && /offen: erneut anrufen/.test(u.text) && /Termin Mi 11\.11\., 14:00 bei Justin/.test(u.text), "je Lead: Stand (Mail, Anruf, Termin) und was offen ist");
  ok(/NOCH OFFEN/.test(u.text) && /GESPRÄCHE BEI DIR/.test(u.text) && /DANIELS TAKT/.test(u.text) && /KI-HINTERGRUND/.test(u.text) && /WÄCHTER/.test(u.text), "Abschnitte: offen, Gespräche, Takt, KI-Kosten, Wächter");
  ok(/2 Leads warten noch auf den ersten Anruf/.test(u.text) && /Privat-Anliegen/.test(u.text) && !u.leer, "Kopf: wer wartet, Privat-Weg");
  ok(!BANK_SATZ.test(u.text) && !/Zins/.test(u.text), "Übersicht: kein Bank-Satz, keine Zinszahl");
  const team = R.uebersichtMail(daten, { art: "team", vorname: "Daniel" });
  ok(/Hallo Daniel/.test(team.text) && /MORGEN ZUERST/.test(team.text) && !/KI-HINTERGRUND/.test(team.text) && !/WÄCHTER/.test(team.text), "Team-Fassung: was morgen zuerst dran ist, ohne Kosten und Wächter");
  const leer = R.uebersichtMail({ ...daten, neu: [], offen: [], privatWeg: 0, anrufe: { eintraege: 0, leads: 0 }, termineGebucht: 0, gespraeche: { heute: [], morgen: [] } }, { art: "justin" });
  ok(leer.leer, "nichts passiert, nichts offen → leer (keine Mail)");
  const w = R.kalenderWaechter({ tage: 0, grund: "keine_zeiten", person: "Pruef Kalender", ausgabenGesternCents: 7000, ausgabenHeuteCents: 0 });
  ok(w.an && /keine Zeitfenster gepflegt/.test(w.text) && /gestern 70,00 €/.test(w.text), "Wächter Kalender: leer + Werbung → an, mit Grund und Betrag");
  ok(!R.kalenderWaechter({ tage: 0, grund: "keine_zeiten", person: null, ausgabenGesternCents: 0, ausgabenHeuteCents: 0 }).an, "leer ohne Werbung → aus");
  ok(!R.kalenderWaechter({ tage: 3, grund: null, person: null, ausgabenGesternCents: 7000, ausgabenHeuteCents: 100 }).an, "Zeiten da → aus");
}

abschnitt("A8 Mail-Ziel der Aufträge (Entscheidung 3A; Gutachten Sicherheit, Mangel 10)");
{
  const wer = { id: 8, email: "lt-privat@gmail.example" };
  ok(zuweisungZiel("eigene", wer).eigene, "„eigene“: keine Make-Mail (T1 kommt stattdessen)");
  gleich(zuweisungZiel({ an: "lt-firma@fiaon.com", fuerAgentId: 8 }, wer).ziel, "lt-firma@fiaon.com", "Umleitung an die Firmenadresse, wenn der Auftrag bei dieser Person landet");
  const fremd = zuweisungZiel({ an: "lt-firma@fiaon.com", fuerAgentId: 10 }, wer);
  ok(fremd.ziel === null && fremd.eigene && fremd.team === "lt-firma@fiaon.com", "Lead-Auftrag bei jemand anderem mit privater Anmeldung: KEINE Mail an das private Postfach, ein Hinweis ans Team-Postfach");
  gleich(zuweisungZiel({ an: "lt-firma@fiaon.com", fuerAgentId: 10 }, { id: 8, email: "lt-kollege@fiaon.com" }).ziel, "lt-kollege@fiaon.com", "… mit Firmen-Anmeldung: an diese");
  const boese = zuweisungZiel({ an: "privat@gmail.example", fuerAgentId: 8 }, wer);
  ok(boese.ziel === null && !boese.team, "eine Umleitung an eine Fremdadresse gilt nie (und die private Anmeldung auch nicht)");
  gleich(zuweisungZiel(null, wer).ziel, wer.email, "ohne Angabe (kein Lead-Auftrag): wie bisher");
  // Nachbesserung (Gutachten Technik Mangel 2): das Ziel der Meldung zu EINEM Auftrag.
  const z = ST.meldeZielFuerAuftrag({ einstellung: "lt-team@fiaon.com", zustaendigId: 8, auftragAgentId: 8, loginEmail: "x@gmail.example" });
  ok(z.an === "lt-team@fiaon.com" && !z.fremd, "Auftrag bei der zuständigen Person → „Lead-Meldungen an“");
  const f2 = ST.meldeZielFuerAuftrag({ einstellung: "lt-team@fiaon.com", zustaendigId: 8, auftragAgentId: 987654, loginEmail: "x@gmail.example" });
  ok(f2.an === "lt-team@fiaon.com" && f2.fremd && f2.quelle === "team", "Auftrag bei jemand anderem ohne Firmenadresse → das Team-Postfach (nie privat)");
  const f3 = ST.meldeZielFuerAuftrag({ einstellung: "", zustaendigId: 8, auftragAgentId: 987654, loginEmail: "lt-vertretung@fiaon.com" });
  ok(f3.an === "lt-vertretung@fiaon.com" && f3.quelle === "anmeldung", "… mit Firmen-Anmeldung → an diese Person");
}

abschnitt("A9 Quelltext-Wände");
{
  const termin = lies("server/lib/fiaon-global-termin.ts");
  const annehmen = termin.split("export async function globalAnfrageAnnehmen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/meldung: await leadMeldungFuerEingang\(\)/.test(annehmen) && /e\.meldungT1An \? "eigene" : await takt\.leadAuftragMeldung\(\)/.test(termin), "Eingang: T1 an → keine Auftrag-Mail (T1 statt aufgabe_zugewiesen); T1 aus → die Auftrag-Mail an die Firmenadresse (Gutachten Technik, Mangel 2)");
  ok(/void import\("\.\/fiaon-lead-takt"\)/.test(annehmen) && !/leadTaktSchema\(|CREATE TABLE|ALTER TABLE/.test(annehmen), "Eingang: T1 nur angestoßen, nie abgewartet, keine Tabellen-Anweisung");
  const buchen = termin.split("export async function globalTerminBuchen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/void leadGespraechVerknuepfen\([\s\S]*schema: false[\s\S]*globalLeadStandSetzen/.test(buchen) && !/await leadGespraechVerknuepfen/.test(buchen), "Buchung: Lead-Gespräch und Stand ziehen nach — angestoßen, nie abgewartet, ohne Tabellen-Anweisung (Gutachten Technik, Mangel 7)");
  ok(!/leadWegSchema\(|leadPostSchema\(|leadTaktSchema\(|CREATE TABLE|ALTER TABLE/.test(buchen.split("\n").filter((z) => !z.trim().startsWith("//")).join("\n")), "Buchung: keine Tabellen-Anweisung im Eingang");
  ok(/pg_advisory_xact_lock\(hashtext\(\$\{`global-lead:/.test(buchen), "Buchung: Sperre je Lead gegen die Doppelbuchung (Gutachten Technik, Mangel 6)");
  ok(/leadStandNachGespraech\(ein\.terminId, lead\.firmaId/.test(termin) && /leadStandNachGespraech\(ein\.terminId, null, "termin_abgesagt"/.test(termin), "Gesprächsergebnis und Absage ziehen den Stand nach");
  ok(/istLeadGespraech\(t\)\) return/.test(termin), "… nur bei Lead-Gesprächen (Startgespräche zahlender Kunden bleiben unberührt)");
  const firmen = lies("server/routes/fiaon-firmen.ts");
  ok(/export async function globalLeadStandSetzen\(/.test(firmen), "globalLeadStandSetzen steht im Firmen-Cockpit (Plan 5.1)");
  ok(/istBusinessLead\(firma\)/.test(firmen) && /anrufNotizPruefen\(/.test(firmen) && /terminGebuchtFuerFirma\(id\)/.test(firmen), "Anruf-Route: Pflicht-Notiz und Termin-Regel nur für Business-Leads");
  const takt = lies("server/lib/fiaon-lead-takt.ts");
  ok(!/@gmail\.com|@web\.de|\+49\s?1[5-7]\d{6,}/.test(takt + lies("shared/fiaon-lead-takt.ts") + lies("server/lib/fiaon-lead-takt-regeln.ts")), "keine Kundendaten im Code (öffentliches Repo)");
  ok(!/fiaon-aras|planEinreihen|arasAnruf/.test(takt), "Daniels Takt löst nie einen ARAS-Anruf aus");
  ok(/if \(!CRONS_AN\) return;/.test(takt.split("export function leadTaktAnstossen")[1] ?? ""), "Anstoß nur im Betrieb (CRONS_AN)");
  ok(/UPDATE fiaon_settings SET value = \$\{f\.tag\}[\s\S]*COALESCE\(value, ''\) = \$\{alt\} RETURNING key/.test(takt), "Übersicht: atomarer Tagesmerker (Gutachten 0, Mangel 11)");
  const crons = lies("server/lib/fiaon-crons.ts");
  ok(/lead_takt: \{/.test(crons), "LAUF_FOLGEN kennt lead_takt");
  const routes = lies("server/routes.ts");
  ok(/tageslauf\('lead_takt', [\s\S]*?nurMitErgebnis: true/.test(routes), "Lauf lead_takt: alle 5 Minuten, nurMitErgebnis + Stundenpuls");
  const meta = lies("server/lib/fiaon-meta-leads.ts");
  const still = meta.split("export async function webhookStilleWaechter(")[1] ?? "";
  ok(/INTERVAL '24 hours'/.test(still) && /stufe: "gelb"/.test(still) && /endetNachStunden: 24/.test(still) && /if \(seit\) return true;/.test(still), "Webhook still: 24 h, gelb, einmal (Merker), Tafel-Zeile geht von selbst aus");
  ok(!/INTERVAL '3 hours'`\) as any\[\];\s*const webhookStumm = Number/.test(meta), "das flatternde 3-Stunden-Fenster ist weg (keine tägliche Meldung mehr)");
  const chef = lies("server/routes/fiaon-chef-rueckholung.ts");
  ok(/"global_lead_meldung_an"/.test(chef) && /meldeAdresseGueltig\(value\)/.test(chef), "Chefbüro › Rückholung: Feld „Lead-Meldungen an“ (nur @fiaon.com)");
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  ok(/meldung: await import\("\.\/fiaon-lead-takt"\)/.test(post) && !/lead-post:willkommen:/.test(post), "Antwort an Justin: Meldung an die Firmenadresse; EIN Lead-Mail-Alarm statt einer Zeile je Anfrage");
  const rund = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Ein Lead, ein Stand — oben auf der Karte\./.test(rund) && /ziel: "\.lm-takt"/.test(rund) && /Lead-Meldungen an/.test(rund) && /Lead-Wächter/.test(rund), "Rundgänge nachgezogen (Cockpit, Lead-Motor, Global-Kunden, Lagezimmer)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A10 E-487 Rückruf selbst eintragen (rein)");
{
  const L = ST.rueckrufLesen;
  const leer = L(undefined, undefined, "2026-11-09");
  ok(leer.tag === null && leer.zeit === null && leer.fehler === null, "nichts gewählt → kein Rückruf, kein Fehler");
  const nurZeit = L("", "10:00", "2026-11-09");
  ok(nurZeit.tag === null && !!nurZeit.fehler, "Uhrzeit ohne Tag → Satz „erst den Tag wählen“");
  const gut = L("2026-11-16", "10:00", "2026-11-09");
  ok(gut.tag === "2026-11-16" && gut.zeit === "10:00" && gut.fehler === null, "Tag + Uhrzeit in einer Woche → gilt");
  const ohne = L("2026-11-09", "", "2026-11-09");
  ok(ohne.tag === "2026-11-09" && ohne.zeit === null && ohne.fehler === null, "heute ohne Uhrzeit → gilt");
  ok(!!L("2026-11-08", null, "2026-11-09").fehler, "gestern → Fehler (Vergangenheit)");
  ok(!!L("2027-04-01", null, "2026-11-09").fehler, "mehr als 120 Tage voraus → Fehler");
  ok(!!L("2026-02-31", null, "2026-02-01").fehler && !!L("16.11.2026", null, "2026-11-09").fehler && !!L("2026-11-16'; DROP", null, "2026-11-09").fehler, "kein echtes Datum / falsches Format / Einschleusung → Fehler");
  ok(!!L("2026-11-16", "10:15", "2026-11-09").fehler && !!L("2026-11-16", "7:30", "2026-11-09").fehler && !!L("2026-11-16", "21:00", "2026-11-09").fehler, "Uhrzeit nur aus der Liste (halbstündlich 8–20 Uhr)");
  ok(ST.RUECKRUF_ZEITEN[0] === "08:00" && ST.RUECKRUF_ZEITEN.at(-1) === "20:00" && ST.RUECKRUF_ZEITEN.length === 25, "Uhrzeiten 08:00 … 20:00 halbstündlich");
  gleich(ST.rueckrufSatz("2026-11-16", "10:00"), "Rückruf vereinbart: Mo., 16.11.2026, 10:00 Uhr", "Satz mit Uhrzeit");
  gleich(ST.rueckrufSatz("2026-11-16", null), "Rückruf vereinbart: Mo., 16.11.2026 (ohne feste Uhrzeit)", "Satz ohne Uhrzeit");
  const tage = ST.rueckrufTage("2026-11-14", 3);
  ok(tage.join() === "2026-11-14,2026-11-16,2026-11-17", "Tage zur Wahl ab heute, Sonntag ausgelassen (Sa 14.11. → Mo 16.11.)");
  ok(ST.rueckrufTage("2026-03-28", 2).join() === "2026-03-28,2026-03-30" && ST.rueckrufTage("2026-12-31", 2).join() === "2026-12-31,2027-01-01", "Zeitumstellung und Jahreswechsel");
  ok((ST.RUECKRUF_ERGEBNISSE as readonly string[]).join() === "erreicht_interesse,nicht_erreicht,mailbox", "nur Interesse / nicht erreicht / Mailbox nehmen den Rückruf mit");
  const route = lies("server/routes/fiaon-firmen.ts");
  ok(/rueckrufLesen\(req\.body\?\.wiedervorlage, req\.body\?\.rueckrufZeit, berlinToday\(\)\)/.test(route) && !/String\(req\.body\.wiedervorlage\)\.slice\(0, 10\)/.test(route), "Anruf-Route prüft den Rückruf (kein ungeprüfter Text mehr als Datum)");
  ok(/AT TIME ZONE 'Europe\/Berlin'\) END,\s*rueckruf_erinnert_am = NULL/.test(route), "Rückruf-Uhrzeit wird als Berliner Zeit gespeichert, Erinnerung neu gestellt");
  const takt = lies("server/lib/fiaon-lead-takt.ts");
  ok(/if \(versandErlaubt\(\)\) gearbeitet \+= await rueckrufErinnern\(jetzt, lauf\)/.test(takt) && /FOR UPDATE SKIP LOCKED/.test(takt), "Erinnerung im Takt, beansprucht vor dem Senden (keine Doppelmail)");
  const seite = lies("client/src/pages/agent/firmen.tsx");
  ok(/Rückruf vereinbart\? Tag und Uhrzeit eintragen/.test(seite) && /rueckrufZeit: mitRueckruf/.test(seite), "Cockpit: Knopf „Rückruf vereinbart?“ und Übergabe an die Route");
  const rund2 = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Rückruf ausgemacht\? Selbst eintragen\./.test(rund2), "Rundgang „Firmenkunden“ nachgezogen");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A11 E-487 Platzhalter im Firmenfeld verschmelzen keine Menschen (rein)");
{
  const { firmaBrauchbar } = await import("../shared/fiaon-global-lead");
  for (const p of ["Selbständig", "selbstständig", "Selbstaendig", "GmbH", "UG", "privat", "Freiberufler", "Einzelunternehmen", "-", "keine"]) {
    ok(!firmaBrauchbar(p, "Erika Beispiel").brauchbar, `„${p}“ ist kein Firmenname (verbindet keine Karten)`);
  }
  ok(!firmaBrauchbar("Erika Beispiel", "Erika Beispiel").brauchbar, "der eigene Name im Firmenfeld verbindet keine Karten");
  ok(firmaBrauchbar("Muster Logistik GmbH", "Erika Beispiel").brauchbar, "ein echter Firmenname verbindet weiter (zwei Menschen derselben Firma)");
  const { firmaNameVerbindet } = await import("../shared/fiaon-global-lead");
  for (const p of ["Selbständig / Freiberufler", "Selbstständig (Einzelunternehmer)", "Solo-Selbstständig", "Kleingewerbe", "Gewerbetreibender", "Immobilien", "Beratung", "GmbH", "Siehe oben", "noch offen"]) {
    ok(!firmaNameVerbindet(p, "Erika Beispiel"), `„${p}“ verbindet keine Karten über den Namen`);
  }
  ok(firmaNameVerbindet("Muster Logistik GmbH", "Erika Beispiel") && firmaNameVerbindet("Beispiel Holding AG", "Max Muster"), "echter Firmenname mit Rechtsform verbindet weiter");
  ok(!firmaNameVerbindet("Selbständig GmbH i. G.", "Erika Beispiel"), "Rollenwort trotz Rechtsform verbindet nicht");
  const route = lies("server/routes/fiaon-firmen.ts");
  ok(/OR \(\$\{nameTaugt\} AND LOWER\(TRIM\(firma\)\) = \$\{firma\.toLowerCase\(\)\}\)/.test(route) && /const nameTaugt = firmaNameVerbindet\(firma, ein\.ansprechpartner\)/.test(route) && !/\n\s+OR LOWER\(TRIM\(firma\)\) = \$\{firma\.toLowerCase\(\)\}\n/.test(route), "globalLeadAufnehmen: Name zählt nur, wenn firmaNameVerbindet");
  ok(/RIGHT\(regexp_replace\(COALESCE\(telefon, ''\), '\[\^0-9\]', '', 'g'\), 9\) = \$\{tel9\}/.test(route), "dieselbe Mobilnummer (9 Ziffern) verbindet");
  const seite = lies("client/src/pages/agent/firmen.tsx");
  ok(/<b>\{firmaAnzeige\(f\)\}<\/b>/.test(seite) && /<h2>\{firmaAnzeige\(aktiv\)\}<\/h2>/.test(seite), "Cockpit zeigt bei Platzhaltern den Menschen („Name (Selbständig)“)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A12 E-487 Ergebnis-Wächter „Lead-Kette“ — W, N, WhatsApp (rein, erfundene Anfragen)");
{
  // 2026-11-09 ist ein Montag, 2026-11-06 ein Freitag, 2026-11-08 ein Sonntag; 2026-12-08 (Dienstag) ist in Österreich Feiertag.
  gleich(R.waFensterMinuten(um("2026-11-09", 7), um("2026-11-09", 8, 30)), 30, "WhatsApp-Fenster: 7:00 → 8:30 = 30 Minuten (ab 8 Uhr)");
  gleich(R.waFensterMinuten(um("2026-11-08", 19, 50), um("2026-11-09", 8, 20)), 30, "über Nacht: 19:50 → 8:20 = 10 + 20 (auch sonntags)");
  gleich(R.waFensterMinuten(um("2026-11-09", 21), um("2026-11-09", 22)), 0, "nach 20 Uhr: 0");

  // ── W ──
  const W = (o: Partial<import("../server/lib/fiaon-lead-takt-regeln").KetteWZeile> = {}) => ({ anfrageId: 901, eingangAm: um("2026-11-09", 10), status: null, grund: null, versuche: 0, ...o });
  const wAn = { an: true, ruheMin: 10 };
  const w1 = R.wLueckeUrteil([W()], um("2026-11-09", 10, 31), wAn);
  ok(w1.an === true && w1.stufe === "rot" && w1.faelle.join() === "901" && w1.schluessel === "lead-takt:w-luecke", "W-Lücke: 31 Minuten ohne Willkommen (keine Zeile) → rot");
  ok(/Anfrage #901/.test(w1.text) && /noch kein Ergebnis/.test(w1.text) && /Daniels Anruf-Aufträge stehen trotzdem/.test(w1.text), "W-Lücke: Text nennt die Anfrage und den Stand");
  ok(R.wLueckeUrteil([W()], um("2026-11-09", 10, 29), wAn).an === false, "29 Minuten (Ruhe 10 + 20): noch nichts");
  ok(R.wLueckeUrteil([W()], um("2026-11-09", 10, 39), { an: true, ruheMin: 20 }).an === false && R.wLueckeUrteil([W()], um("2026-11-09", 10, 40), { an: true, ruheMin: 20 }).an === true, "Ruhe 20 → Grenze 40 Minuten");
  const w0 = R.wLueckeUrteil([W({ status: "fehler", grund: "Wand: Prozentzahl", versuche: 0 })], um("2026-11-09", 11), wAn);
  ok(w0.an === true && /gescheitert \(0 von 3 Versuchen: Wand: Prozentzahl\)/.test(w0.text), "„fehler“ mit 0 Versuchen → rot (Befund 05.–09.11.: genau das blieb stumm)");
  ok(R.wLueckeUrteil([W({ status: "wartet", grund: "Postfach gestört" })], um("2026-11-09", 11), wAn).an === true, "„wartet“ nach 30 Minuten → rot");
  ok(R.wLueckeUrteil([W({ status: "gesendet" }), W({ anfrageId: 902, status: "ausgelassen" })], um("2026-11-09", 11), wAn).an === false, "gesendet oder bewusst ausgelassen → grün");
  ok(R.wLueckeUrteil([W({ eingangAm: um("2026-11-05", 10) })], um("2026-11-09", 11), wAn).an === false, "älter als 3 Tage → nicht mehr (das Willkommen verfällt ohnehin)");
  const wAus = R.wLueckeUrteil([W()], um("2026-11-09", 11), { an: false, ruheMin: 10 });
  ok(wAus.an === false && /ausgeschaltet/.test(wAus.vorbeiGrund), "Lead-Mails aus → kein Alarm (bewusst)");

  // ── N ──
  const N = (o: Partial<import("../server/lib/fiaon-lead-takt-regeln").KetteNZeile> = {}) => ({ anfrageId: 911, faellig: um("2026-11-09", 10), stufe: 0, land: "DE", ...o });
  const n1 = R.nLueckeUrteil([N()], um("2026-11-09", 12, 1), { an: true });
  ok(n1.an === true && n1.faelle.join() === "911" && /N1 fällig seit Mo 09\.11\., 10:00/.test(n1.text), "N-Lücke: N1 seit 2 Dienststunden fällig → rot");
  ok(R.nLueckeUrteil([N()], um("2026-11-09", 11, 59), { an: true }).an === false, "nach 1 Stunde 59: noch nichts");
  ok(R.nLueckeUrteil([N({ faellig: um("2026-11-06", 17, 30) })], um("2026-11-09", 9, 30), { an: true }).an === false, "Fr 17:30 fällig, Mo 9:30: erst 60 Dienstminuten — kein Fehlalarm am Montagmorgen");
  ok(R.nLueckeUrteil([N()], um("2026-11-07", 12), { an: true }).an === null, "Samstag: keine Aussage (der Alarm bleibt, wie er ist)");
  ok(R.nLueckeUrteil([N({ faellig: um("2026-12-08", 10), land: "AT" })], um("2026-12-08", 13), { an: true }).an === false, "Österreich-Feiertag (08.12.): der Nachfass ruht dort — kein Alarm");
  ok(R.nLueckeUrteil([N({ faellig: um("2026-12-08", 10), land: "DE" })], um("2026-12-08", 13), { an: true }).an === true, "… in Deutschland ist der 08.12. ein Werktag → rot");
  ok(R.nLueckeUrteil([N({ stufe: 3 })], um("2026-11-09", 13), { an: true }).an === false, "alle drei gesendet → nichts");
  ok(R.nLueckeUrteil([N()], um("2026-11-09", 13), { an: false }).an === false, "Nachfass aus → kein Alarm");

  // ── WhatsApp ──
  const Z = (o: Partial<import("../server/lib/fiaon-lead-takt-regeln").KetteWaZeile> = {}) => ({
    anfrageId: 921, eingangAm: um("2026-11-09", 10), status: "neu", nummer: "4915500000921", ja: "website", jaSeit: um("2026-11-09", 10),
    terminKommend: false, terminVorbei: false, kontakt: false, begruessungFehler: null, ...o,
  });
  const leer = { ohneAnfrage: [], falsch: [] };
  const wa1 = R.waLueckeUrteil({ an: true, zeilen: [Z()], ...leer }, um("2026-11-09", 10, 41));
  ok(wa1.an === true && wa1.stufe === "rot" && wa1.faelle.join() === "921" && /noch keine WhatsApp-Begrüßung/.test(wa1.text), "Ja (Website), Handy, ohne Termin: 30 Minuten im Fenster ohne WhatsApp → rot");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z()], ...leer }, um("2026-11-09", 10, 39)).an === false, "nach 29 Fensterminuten: noch nichts");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ eingangAm: um("2026-11-08", 22), jaSeit: um("2026-11-08", 22) })], ...leer }, um("2026-11-09", 8, 25)).an === false
    && R.waLueckeUrteil({ an: true, zeilen: [Z({ eingangAm: um("2026-11-08", 22), jaSeit: um("2026-11-08", 22) })], ...leer }, um("2026-11-09", 8, 31)).an === true, "Ja um 22 Uhr: gezählt ab 8 Uhr — 8:25 noch nichts, 8:31 rot");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ kontakt: true })], ...leer }, um("2026-11-09", 12)).an === false, "eine WhatsApp ging hinaus (oder er schrieb selbst, auch „STOPP“) → grün");
  const wat = R.waLueckeUrteil({ an: true, zeilen: [Z({ status: "termin", terminKommend: true })], ...leer }, um("2026-11-09", 12));
  ok(wat.an === true && /Termin steht, aber keine Terminnachricht/.test(wat.text), "Ja + Termin ohne Terminnachricht → rot (Justin 09.11.: „ALLES … WhatsApp“)");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ status: "termin" })], ...leer }, um("2026-11-09", 12)).an === false, "Stand „termin“ ohne kommendes Gespräch → nichts zu erwarten");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ terminVorbei: true })], ...leer }, um("2026-11-09", 12)).an === false, "Gespräch schon vorbei → keine Begrüßung mehr");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ nummer: null }), Z({ anfrageId: 922, ja: null })], ...leer }, um("2026-11-09", 12)).an === false, "Festnetz oder kein Ja → nichts (ohne Ja schreibt Mara nie zuerst)");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ eingangAm: um("2026-11-02", 10), jaSeit: um("2026-11-09", 11, 50), ja: "telefon:Daniel Beispiel" })], ...leer }, um("2026-11-09", 12, 15)).an === false, "Ja am Telefon zu einer älteren Anfrage: gezählt ab dem Ja (25 Minuten → noch nichts)");
  // E-487 Nachbesserung (Gutachten): rot nur, wenn der Takt es NIE versucht hat. Gescheitert → gelb (ohne Mail), mit dem Grund.
  const waf = R.waLueckeUrteil({ an: true, zeilen: [Z({ versucht: true, begruessungFehler: "fehler: (#131042) Business eligibility payment issue" })], ...leer }, um("2026-11-09", 12));
  ok(waf.an === true && waf.stufe === "gelb" && waf.faelle.length === 0 && /Begrüßung gescheitert \(\(#131042\) Business eligibility payment issue\) — kein neuer Versuch/.test(waf.text), "Begrüßung versucht und gescheitert → gelb mit Metas Grund, keine Mail an Justin (vorher rot, drei Tage lang alle 4 Stunden)");
  // Die Gründe, aus denen der Takt bewusst nichts schickt (waAuslassGrund) → kein Alarm.
  for (const grund of ["er hat STOPP geschrieben", "auf WhatsApp nicht erreichbar (Meta: kein WhatsApp)", "hat Werbung auf WhatsApp abbestellt (Meta)", "schon ein WhatsApp-Verlauf (30 Tage)", "zahlender Privatkunde (Mara Privat ist zuständig)"]) {
    ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ ausgelassen: grund }), Z({ anfrageId: 923, status: "termin", terminKommend: true, ausgelassen: grund })], ...leer }, um("2026-11-09", 12)).an === false, `bewusst ausgelassen („${grund}“) → kein Alarm, auch mit Termin`);
  }
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ versucht: true, begruessungFehler: null })], ...leer }, um("2026-11-09", 12)).an === false, "versucht, kein Fehler bekannt (z. B. begrüßt zu einer früheren Anfrage derselben Nummer) → nichts");
  const watF = R.waLueckeUrteil({ an: true, zeilen: [Z({ status: "termin", terminKommend: true, versucht: true, begruessungFehler: "fehler: (#131000) Something went wrong" })], ...leer }, um("2026-11-09", 12));
  ok(watF.stufe === "gelb" && watF.faelle.length === 0 && /Terminnachricht gescheitert \(\(#131000\) Something went wrong\)/.test(watF.text), "Terminnachricht versucht und gescheitert → gelb");
  ok(R.waLueckeUrteil({ an: true, zeilen: [Z({ status: "termin", terminKommend: true, versucht: false, begruessungFehler: "fehler: (#131042) alt" })], ...leer }, um("2026-11-09", 12)).stufe === "rot", "Terminnachricht zu DIESEM Termin nie versucht (ein alter Fehler zählt nicht als Versuch) → rot");
  const waW = R.waLueckeUrteil({ an: true, zeilen: [Z({ wartet: "wartet: WhatsApp pausiert (Meta-Zahlung)" })], ...leer }, um("2026-11-09", 12));
  ok(waW.an === true && waW.stufe === "gelb" && waW.faelle.length === 0 && /Begrüßung wartet \(WhatsApp pausiert \(Meta-Zahlung\)\) — der Takt versucht es wieder/.test(waW.text), "Begrüßung wartet (Bremse) → gelb, der Takt versucht es wieder");
  const waP = R.waLueckeUrteil({ an: true, pausiert: true, zeilen: [Z()], ...leer }, um("2026-11-09", 12));
  ok(waP.an === true && waP.stufe === "gelb" && waP.faelle.length === 0 && /WhatsApp ist pausiert \(eigener Alarm im Lagezimmer\)/.test(waP.text), "WhatsApp pausiert → nie versuchte Fälle gelb (die Pause hat ihren eigenen roten Alarm — keine zweite Mail)");
  const waM = R.waLueckeUrteil({ an: true, zeilen: [Z(), Z({ anfrageId: 924, versucht: true, begruessungFehler: "fehler: Werbesperre" }), Z({ anfrageId: 925, ausgelassen: "er hat STOPP geschrieben" })], ...leer }, um("2026-11-09", 12));
  ok(waM.stufe === "rot" && waM.faelle.join() === "921" && /Anfrage #924/.test(waM.text) && !/Anfrage #925/.test(waM.text), "gemischt: rot nur der nie versuchte Fall (Mail nur dafür), der gescheiterte steht gelb dabei, der ausgelassene gar nicht");
  ok(R.waErwartet(Z({ ausgelassen: "er hat STOPP geschrieben" }), um("2026-11-09", 12)) === false && R.waErwartet(Z(), um("2026-11-09", 12)) === true, "waErwartet: ausgelassen = nichts zu erwarten");
  ok(R.waFallStufe(Z()) === "rot" && R.waFallStufe(Z({ versucht: true })) === null && R.waFallStufe(Z({ versucht: true, begruessungFehler: "fehler: x" })) === "gelb" && R.waFallStufe(Z({ wartet: "wartet: x" })) === "gelb", "waFallStufe: nie versucht = rot, versucht ohne Fehler = nichts, gescheitert oder wartend = gelb");
  const waAus = R.waLueckeUrteil({ an: false, zeilen: [Z()], ...leer }, um("2026-11-09", 12));
  ok(waAus.an === true && waAus.stufe === "gelb" && waAus.faelle.length === 0 && /WhatsApp-Takt ist aus/.test(waAus.text), "Takt aus, aber Leads mit Ja warten → gelb (keine Mail an Justin)");
  const waO = R.waLueckeUrteil({ an: true, zeilen: [], ohneAnfrage: [{ nummer: "4915500000931", anfrageId: 931, seit: um("2026-11-09", 10) }], falsch: [] }, um("2026-11-09", 10, 31));
  ok(waO.an === true && waO.stufe === "gelb" && /ohne Anfrage, obwohl Anfrage #931/.test(waO.text) && !/4915500000931/.test(waO.text), "Ja-Zeile ohne Anfrage (30 Minuten) → gelb, ohne volle Nummer");
  ok(R.waLueckeUrteil({ an: true, zeilen: [], ohneAnfrage: [{ nummer: "4915500000931", anfrageId: 931, seit: um("2026-11-09", 10) }], falsch: [] }, um("2026-11-09", 10, 20)).an === false, "… nach 20 Minuten noch nicht (der Takt verknüpft alle 5 Minuten)");
  const waF = R.waLueckeUrteil({ an: true, zeilen: [], ohneAnfrage: [], falsch: [{ anfrageId: 941, schluessel: "15500000941", erwartet: "4915500000941" }] }, um("2026-11-09", 12));
  ok(waF.an === true && waF.stufe === "gelb" && /falsch gelesen \(\+15… statt \+49…/.test(waF.text), "falsch gelesene Nummer (gleicher Anschluss, +1 statt +49) → gelb");
  // E-490 F5 + Nachbesserung (Gutachten): Die alte Formular-Fassung hat einen EIGENEN gelben Alarm (meta_waechter) — der
  // WhatsApp-Alarm der Lead-Kette fragt Meta nicht mehr (ein Meta-Fehler ließ ihn flattern). Geprüft in pruef-meta-global-weiche.
  ok(R.waLueckeUrteil({ an: true, zeilen: [], ohneAnfrage: [], falsch: [] }, um("2026-11-09", 12)).an === false,
    "nichts offen → aus — Meta spielt im WhatsApp-Alarm keine Rolle mehr (kein Flattern bei einem Meta-Fehler)");

  // ── Mail an Justin ──
  ok(R.ketteMailFaellig({ neu: true, letzte: um("2026-11-09", 11, 59), jetzt: um("2026-11-09", 12) }), "neuer Fall → sofort eine Mail");
  ok(R.ketteMailFaellig({ neu: false, letzte: null, jetzt: um("2026-11-09", 12) }), "noch nie gemeldet → eine Mail");
  ok(!R.ketteMailFaellig({ neu: false, letzte: um("2026-11-09", 8, 1), jetzt: um("2026-11-09", 12) }) && R.ketteMailFaellig({ neu: false, letzte: um("2026-11-09", 8), jetzt: um("2026-11-09", 12) }), "danach höchstens alle 4 Stunden (3:59 nein, 4:00 ja) — kein Mail-Sturm");
  const km = R.ketteMail([{ alarm: w1, faelle: w1.faelle, neu: [] }, { alarm: wa1, faelle: wa1.faelle, neu: [] }], "https://fiaon.com/chef/s/lead-motor");
  ok(/^Lead-Kette rot: Willkommens-Mail hängt · WhatsApp hängt \(#921, #901\)$/.test(km.betreff), `Mail-Betreff (Erinnerung ohne neuen Fall) nennt was und welche Anfragen, die neuesten zuerst (${km.betreff})`);
  ok(/Hallo Justin/.test(km.text) && /höchstens alle 4 Stunden/.test(km.text) && /WILLKOMMENS-MAIL HÄNGT — 1 FALL/.test(km.text) && /WHATSAPP HÄNGT — 1 FALL/.test(km.text)
    && /Keine neuen Fälle/.test(km.text) && /Anfrage #901 \(Eingang /.test(km.text) && /Daniels Anruf-Aufträge stehen trotzdem/.test(km.text), "Mail: du-Form, Hinweis auf die 4 Stunden, je Alarm ein Abschnitt mit den Fall-Zeilen und dem Hinweis");
  ok(km.links.length === 1 && km.knoepfe.length === 1 && km.knoepfe[0].url === "https://fiaon.com/chef/s/lead-motor", "Mail: klickbar nur der Lead-Motor");
  ok(!BANK_SATZ.test(km.text) && !radarBankVorbehalt(km.text) && !/@|\+49\s?1[5-7]/.test(km.text), "Mail: kein Bank-Satz, keine Adresse, keine Nummer");

  // ── Quelltext-Wände ──
  const regeln = lies("server/lib/fiaon-lead-takt-regeln.ts");
  const takt = lies("server/lib/fiaon-lead-takt.ts");
  const kette = regeln.split("DER ERGEBNIS-WÄCHTER „LEAD-KETTE“")[1] ?? "";
  ok(kette.length > 1000 && !/sqlPool|db-pool|fetch\(|new Date\(\)/.test(kette), "die Urteile sind rein (keine Datenbank, kein Netz, keine Uhr — jetzt kommt als Parameter)");
  const waechter = takt.split("export async function leadWaechterPruefen(")[1]?.split("\n}\n")[0] ?? "";
  // E-490 F2/F3: jeder angeschlagene Alarm geht an ketteMailSchicken (auch gelb — der Merker führt, seit wann ein Fall rot ist).
  // E-490 Nachbesserung (Gutachten, Rotprobe M2): die Zeile OHNE Bedingung — auch gelbe Läufe gehen an den Plan (sonst bliebe rotSeit
  // über eine Unterbrechung hinweg stehen und ein WhatsApp-Fall käme nach dem Aktivieren ohne zweiten Lauf in die Mail).
  ok(/leadKetteLesen\(jetzt, lauf, \{ warteMs: opt\.immer \? 5_000 : 30_000 \}\)/.test(waechter) && /^\s*angeschlagen\.push\(\{ alarm: a, neu: r\.neu \}\);$/m.test(waechter) && /ketteMailSchicken\(angeschlagen, jetzt, lauf\)/.test(waechter) && /ketteMerkerLoeschen\(a\.schluessel, lauf\)/.test(waechter), "Wächter Block 7: Lead-Kette melden (Knopf wartet höchstens 5 s), JEDER angeschlagene Alarm → Merker/Mail je Fall, vorbei → Merker frei");
  const schicken = takt.split("async function ketteMailSchicken(")[1]?.split("\n}\n")[0] ?? "";
  ok(/if \(!versandErlaubt\(\)\) return false;/.test(schicken) && /justinAdresse\(lauf\)/.test(schicken) && /COALESCE\(value, ''\) = \$\{alt\} RETURNING key/.test(schicken)
    && /ketteMailPlan\(\{ alarm: r\.alarm, merker: ketteMerkerLesen\(alt\), neu: r\.neu, jetzt \}\)/.test(schicken) && /if \(frei && plan\.mailen\)/.test(schicken),
    "Mail an Justin: nur im Betrieb, an justinAdresse, atomarer Merker, je Fall geplant (ketteMailPlan), gemailt nur, wer den Merker dreht");
  ok(/lead_kette_mail:/.test(takt) && /lead-takt:w-luecke/.test(regeln) && /lead-takt:n-luecke/.test(regeln) && /lead-takt:wa-luecke/.test(regeln), "feste Schlüssel je Alarm und je Merker");
  const lesen = takt.split("export async function leadKetteLesen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/willkommen_am IS NULL[\s\S]*NOT IN \('gesendet', 'ausgelassen'\)/.test(lesen) && /nachfass_faellig < \$\{jetzt\}::timestamptz - INTERVAL '2 hours'/.test(lesen) && /mb\.nummerDerAnfrage\(r\)/.test(lesen), "die Zahlen: W ohne Ergebnis, N seit 2 Stunden fällig, WhatsApp mit der Nummer der Anfrage (Land)");
  // E-487 Nachbesserung (Gutachten): der Wächter liest, was der Takt verbucht hat, und fragt DIESELBE Auslass-Prüfung.
  ok(/BOOL_OR\(w3\.willkommen_am IS NOT NULL\)[\s\S]*AS begruesst/.test(lesen) && /w3\.willkommen_status LIKE 'wartet%'/.test(lesen)
    && /AS raus_fehler/.test(lesen) && /w5\.termin_gemeldet_id = tk\.id\) AS gemeldet\) tg ON TRUE/.test(lesen) && /tg\.gemeldet AS termin_gemeldet/.test(lesen) && /ORDER BY t\.beginn LIMIT 1\) tk ON TRUE/.test(lesen),
    "Wächter liest: Begrüßung verbucht, ihr Stand (fehler/wartet), Metas letzter Fehler seit der Anfrage, Terminnachricht zu GENAU diesem Termin");
  ok(/if \(nummer && waErwartet\(zeile, jetzt\)\)/.test(lesen) && /mb\.waZielFuerAnfrage\(/.test(lesen) && /await mb\.waAuslassGrund\(ziel\?\.nummer \?\? nummer, terminKommend \? "folge" : "begruessung", lauf\)/.test(lesen),
    "nur wo sonst ein Alarm käme: waAuslassGrund an der Nummer, an die der Takt schreiben würde (dieselbe Prüfung wie der Takt)");
  ok(/waPauseLesen\(\)\)\.then\(\(p\) => !!p\.an\)/.test(lesen) && /waLueckeUrteil\(\{ an, pausiert,/.test(lesen), "WhatsApp-Pause wird gelesen und mitgegeben (die Pause hat ihren eigenen roten Alarm)");

  // ── Cockpit: das Ja am Telefon ──
  const seite = lies("client/src/pages/agent/firmen.tsx");
  ok(/Möchte auch per WhatsApp \(am Telefon gefragt\)/.test(seite) && /whatsapp_ja: true/.test(seite) && /GLOBAL_WA_TELEFON_SATZ/.test(seite), "Cockpit: Häkchen mit dem Satz zum Vorlesen, geht als felder.whatsapp_ja mit");
  ok(seite.indexOf("fk-wa-ja") > 0 && seite.indexOf("fk-wa-ja") < seite.indexOf('<div className="fk-ergebnisse">'), "das Häkchen steht direkt über den Ergebnis-Knöpfen");
  const route = lies("server/routes/fiaon-firmen.ts");
  const anruf = route.split('router.post("/agent/firmen/:id/anruf"')[1]?.split("\n});\n")[0] ?? "";
  const telJa = route.split("async function telefonJaMerken(")[1]?.split("\n}\n")[0] ?? "";
  ok(/whatsappJaGewaehlt\(req\.body\?\.felder\)/.test(anruf) && /telefonJaMerken\(\{ firma, anfrageId: lead\.lead \? lead\.anfrageId : null, ergebnis/.test(anruf), "Anruf-Route: felder.whatsapp_ja geht mit dem Ergebnis an telefonJaMerken");
  ok(/if \(!ein\.anfrageId\) return \{ gemerkt: false/.test(telJa) && /TELEFON_JA_ERGEBNISSE/.test(telJa) && /telefonOptinMerken\(/.test(telJa) && /'whatsapp_ja'/.test(telJa), "… nur mit Anfrage, nur nach „Erreicht — Interesse“ oder „Termin vereinbart“ (TELEFON_JA_ERGEBNISSE), gemerkt über telefonOptinMerken, Zeile im Verlauf");
  const jt = route.split('router.post("/agent/firmen/:id/justin-termin"')[1]?.split("\n});\n")[0] ?? "";
  ok(/whatsappJaGewaehlt\(b\.felder\)/.test(jt) && /ergebnis: "erreicht_termin"/.test(jt) && /mitWa \? \{ whatsapp_ja: true \}/.test(seite.split("const justinEintragen")[1] ?? ""), "… auch bei „Termin bei Justin eintragen“ (dann kommt die Bestätigung auch auf WhatsApp)");
  const rund = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Darf Mara ihm schreiben\? Frag am Telefon\./.test(rund) && /Lead-Kette/.test(rund), "Rundgänge nachgezogen (Firmenkunden: das Ja am Telefon; Lead-Motor und Lagezimmer: die Lead-Kette)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A13 E-490 Lead-Kette: Mail je Fall, zweiter Lauf, Termin 60 Tage, alte Fassung bei Meta (rein)");
{
  type Al = import("../server/lib/fiaon-lead-takt-regeln").KetteAlarm;
  const W = "lead-takt:w-luecke" as const, WA = "lead-takt:wa-luecke" as const;
  const al = (schluessel: Al["schluessel"], faelle: number[], stufe: "rot" | "gelb" = "rot"): Al => ({ schluessel, an: true, stufe, titel: "Lead-Kette: Prüfung", text: "Prüftext", faelle, vorbeiGrund: "" });
  const t0 = um("2026-11-09", 10);
  const plus = (min: number) => new Date(t0.getTime() + min * 60_000);
  const rund = (m: import("../server/lib/fiaon-lead-takt-regeln").KetteMerker) => R.ketteMerkerLesen(R.ketteMerkerText(m)); // wie über fiaon_settings
  const leerM = R.ketteMerkerLesen("");

  // ── F2: die Mail je FALL ──
  const p1 = R.ketteMailPlan({ alarm: al(W, [901]), merker: leerM, neu: true, jetzt: t0 });
  ok(p1.mailen && p1.neueFaelle.join() === "901" && (p1.merker.gemailt ?? []).join() === "901" && p1.merker.am?.getTime() === t0.getTime(), "W: ein neuer roter Fall → sofort eine Mail, der Fall steht im Merker");
  const m1 = rund(p1.merker);
  ok(!R.ketteMailPlan({ alarm: al(W, [901]), merker: m1, neu: false, jetzt: plus(15) }).mailen, "derselbe Fall eine Viertelstunde später → keine zweite Mail");
  const p3 = R.ketteMailPlan({ alarm: al(W, [901, 902]), merker: m1, neu: false, jetzt: plus(30) });
  ok(p3.mailen && p3.neueFaelle.join() === "902" && (p3.merker.gemailt ?? []).slice().sort().join() === "901,902", "ein NEUER Fall, während der Alarm offen ist → sofort eine Mail (vorher bis zu 4 Stunden nichts)");
  ok(p3.merkerOhneMail.am?.getTime() === t0.getTime() && (p3.merkerOhneMail.gemailt ?? []).join() === "901", "scheitert der Versand: Zeit und gemailte Fälle wie vorher — der nächste Wächter versucht es wieder");
  const m3 = rund(p3.merker);
  ok(!R.ketteMailPlan({ alarm: al(W, [901, 902]), merker: m3, neu: false, jetzt: plus(30 + 239) }).mailen
    && R.ketteMailPlan({ alarm: al(W, [901, 902]), merker: m3, neu: false, jetzt: plus(30 + 240) }).mailen, "dieselben Fälle: höchstens alle 4 Stunden (3:59 nein, 4:00 ja)");
  ok(R.ketteMailPlan({ alarm: al(W, [901]), merker: m3, neu: true, jetzt: plus(31) }).mailen, "neue Episode des Alarms → der alte Merker gilt nicht (sofort eine Mail)");
  ok(!R.ketteMailPlan({ alarm: al(W, [], "gelb"), merker: leerM, neu: false, jetzt: t0 }).mailen && !R.ketteMailPlan({ alarm: { ...al(W, [901]), an: false }, merker: leerM, neu: false, jetzt: t0 }).mailen, "gelb oder aus → nie eine Mail");
  // Der Befund (Diagnose 09.11.): Eine gelbe Zeile hielt die WhatsApp-Episode offen — ein NEUER roter Fall bekam bis zu 4 Stunden keine Mail.
  let m = rund({ am: plus(-60), gemailt: [921], rotSeit: {} });
  const g1 = R.ketteMailPlan({ alarm: al(WA, [], "gelb"), merker: m, neu: false, jetzt: t0 });
  ok(!g1.mailen && Object.keys(g1.merker.rotSeit).length === 0 && g1.merker.am?.getTime() === plus(-60).getTime(), "WhatsApp gelb (Episode offen, vor einer Stunde gemailt) → keine Mail, nichts rot, Zeit bleibt");
  m = rund(g1.merker);

  // ── F3: ein roter WhatsApp-Fall erst im zweiten Lauf ──
  const r1 = R.ketteMailPlan({ alarm: al(WA, [925]), merker: m, neu: false, jetzt: plus(15) });
  ok(!r1.mailen && r1.merker.rotSeit["925"] === plus(15).toISOString(), "WhatsApp: ein neuer roter Fall im ERSTEN Lauf → noch keine Mail (vielleicht las der Wächter mitten in den Versand)");
  m = rund(r1.merker);
  const r2 = R.ketteMailPlan({ alarm: al(WA, [925, 926]), merker: m, neu: false, jetzt: plus(30) });
  ok(r2.mailen && r2.neueFaelle.join() === "925", "… im nächsten Lauf (15 Minuten) noch rot → sofort eine Mail, obwohl die letzte erst 75 Minuten her ist (F2)");
  // Nachbesserung (Gutachten): In der Mail und in „gemailt“ steht nur, was BESTÄTIGT ist — 926 (erst seit diesem Lauf rot, vielleicht
  // schon überholt) steht nur als Zahl darin; ist er im nächsten Lauf noch rot, bekommt er seine eigene Mail.
  ok(r2.mailFaelle.join() === "925" && r2.unbestaetigt === 1 && !(r2.merker.gemailt ?? []).includes(926),
    "in der Mail und in „gemailt“ nur der bestätigte Fall (925) — 926 (noch unbestätigt) nur als Zahl");
  const r3 = R.ketteMailPlan({ alarm: al(WA, [925, 926]), merker: rund(r2.merker), neu: false, jetzt: plus(45) });
  ok(r3.mailen && r3.neueFaelle.join() === "926" && r3.mailFaelle.slice().sort().join() === "925,926" && r3.unbestaetigt === 0,
    "… im nächsten Lauf noch rot → seine eigene Mail (926 NEU, 925 als bekannter Fall dabei)");
  ok(!R.ketteMailPlan({ alarm: al(WA, [925, 926]), merker: rund(r3.merker), neu: false, jetzt: plus(60) }).mailen, "… danach Ruhe (dieselben Fälle höchstens alle 4 Stunden)");
  const d1 = R.ketteMailPlan({ alarm: al(WA, [931]), merker: leerM, neu: false, jetzt: t0 });
  const d2 = R.ketteMailPlan({ alarm: al(WA, [931]), merker: rund(d1.merker), neu: false, jetzt: new Date(t0.getTime() + 6_000) });
  ok(!d1.mailen && !d2.mailen, "zwei Wächterläufe binnen Sekunden (beim Deploy zwei Prozesse) bestätigen sich nicht → keine Mail");
  const u1 = R.ketteMailPlan({ alarm: al(WA, [], "gelb"), merker: rund(d2.merker), neu: false, jetzt: plus(15) });
  const u2 = R.ketteMailPlan({ alarm: al(WA, [931]), merker: rund(u1.merker), neu: false, jetzt: plus(30) });
  ok(!u2.mailen && u2.merker.rotSeit["931"] === plus(30).toISOString(), "unterbrochen (rot → nicht rot → rot): die Zeit beginnt neu");
  ok(R.ketteMailPlan({ alarm: al(W, [941]), merker: leerM, neu: false, jetzt: t0 }).mailen, "Willkommen (W) und Nachfass (N) brauchen keinen zweiten Lauf — sofort");
  // Nachbesserung (Gutachten): „gemailt“ behält nur, was noch rot ist (gemailt ∩ rot).
  const k1 = R.ketteMailPlan({ alarm: al(W, [961]), merker: leerM, neu: true, jetzt: t0 });
  const k2 = R.ketteMailPlan({ alarm: al(W, [962]), merker: rund(k1.merker), neu: false, jetzt: plus(15) });
  ok(k2.mailen && k2.neueFaelle.join() === "962" && !(k2.merker.gemailt ?? []).includes(961) && !(k2.merkerOhneMail.gemailt ?? []).includes(961), "ein gelöster Fall fällt aus „gemailt“ (gemailt ∩ rot) — auch im Merker für einen gescheiterten Versand");
  const k3 = R.ketteMailPlan({ alarm: al(W, [961, 962]), merker: rund(k2.merker), neu: false, jetzt: plus(30) });
  ok(k3.mailen && k3.neueFaelle.join() === "961", "… ist dieselbe Anfrage später wieder rot (ein anderes Problem), kommt sofort eine Mail — vorher bis zu 4 Stunden still");

  // ── der Merker: altes Format (E-487, nur die Zeit), JSON, Unsinn ──
  const altM = R.ketteMerkerLesen("2026-11-09T08:30:00.000Z");
  ok(altM.am?.toISOString() === "2026-11-09T08:30:00.000Z" && altM.gemailt === null, "alter Merker (nur die Zeit) wird gelesen — welche Fälle gemailt waren, ist unbekannt");
  const pa = R.ketteMailPlan({ alarm: al(W, [901]), merker: altM, neu: false, jetzt: t0 });
  ok(!pa.mailen && (pa.merker.gemailt ?? []).join() === "901", "… dann gelten die jetzt roten Fälle als gemailt — keine Doppelmail direkt nach dem Deploy");
  // 08:30 UTC = 09:30 Berlin → vier Stunden später ist 13:30 Berlin.
  ok(!R.ketteMailPlan({ alarm: al(W, [901]), merker: altM, neu: false, jetzt: um("2026-11-09", 13, 29) }).mailen
    && R.ketteMailPlan({ alarm: al(W, [901]), merker: altM, neu: false, jetzt: um("2026-11-09", 13, 30) }).mailen, "… und nach 4 Stunden wie gewohnt");
  const roh = R.ketteMerkerLesen(JSON.stringify({ am: "nie", gemailt: [1, "2", -3, "x", 2.5], rotSeit: { "5": "nie", abc: t0.toISOString(), "7": t0.toISOString() } }));
  ok(roh.am === null && (roh.gemailt ?? []).join() === "1,2" && Object.keys(roh.rotSeit).join() === "7", "JSON-Merker geprüft gelesen (kaputte Zeit, Nummern und Einträge fallen heraus)");
  ok(R.ketteMerkerText(R.ketteMerkerLesen("{kaputt")) === "" && R.ketteMerkerText(leerM) === "" && R.ketteMerkerText(p1.merker).startsWith("{"), "Unsinn → leer; ein leerer Merker wird nicht geschrieben");
  ok(R.ketteMailPlan({ alarm: al(W, Array.from({ length: 260 }, (_, i) => 1000 + i)), merker: leerM, neu: true, jetzt: t0 }).merker.gemailt?.length === R.KETTE_VORGABE.gemailtHoechstens, "der Merker bleibt klein (höchstens 200 gemailte Fälle)");

  // ── die Mail: welcher Fall ist NEU, nur bestätigte Fälle (Nachbesserung, Gutachten) ──
  const url = "https://fiaon.com/chef/s/lead-motor";
  const viele = Array.from({ length: 20 }, (_, i) => 1001 + i); // 1001 … 1020
  const zeilenW = Object.fromEntries(viele.map((f) => [String(f), `Anfrage #${f} (Eingang heute): noch kein Ergebnis`]));
  const mN = R.ketteMail([{ alarm: { ...al(W, viele), fallZeilen: zeilenW, hinweis: "Hinweis W" }, faelle: viele, neu: [1020] }], url);
  ok(/^Lead-Kette rot: NEU #1020 \(\+19 weitere\) · Willkommens-Mail hängt$/.test(mN.betreff), `Betreff nennt den NEUEN Fall zuerst — auch bei mehr als 6 Fällen, wo er vorher fehlte (${mN.betreff})`);
  const iNeu = mN.text.indexOf("NEU · Anfrage #1020"), i19 = mN.text.indexOf("Anfrage #1019"), i1 = mN.text.indexOf("Anfrage #1001 ");
  ok(/Neu seit der letzten Mail: #1020\./.test(mN.text) && iNeu > 0 && iNeu < i19 && i1 < 0 && /… und 5 weitere \(alle im Lead-Motor\)\./.test(mN.text) && /WILLKOMMENS-MAIL HÄNGT — 20 FÄLLE/.test(mN.text),
    "Text: „Neu seit der letzten Mail“, die neue Zeile zuerst, dann die neuesten — höchstens 15 Zeilen, der Rest als Zahl");
  const mU = R.ketteMail([{ alarm: { ...al(WA, [925, 926]), fallZeilen: { "925": "Anfrage #925 (Ja: website): noch keine WhatsApp-Begrüßung", "926": "Anfrage #926 (Ja: website): noch keine WhatsApp-Begrüßung" } }, faelle: [925], neu: [925], unbestaetigt: 1 }], url);
  ok(/Dazu ein weiterer WhatsApp-Fall, der erst seit eben rot ist/.test(mU.text) && !/#926/.test(mU.text + mU.betreff) && /NEU · Anfrage #925/.test(mU.text),
    "ein unbestätigter WhatsApp-Fall steht nur als Zahl in der Mail — nie mit seiner Nummer (vielleicht schon überholt)");
  ok(!/@|\+49\s?1[5-7]/.test(mN.text + mU.text) && !BANK_SATZ.test(mN.text + mU.text), "Mail: keine Adresse, keine Nummer, kein Bank-Satz");

  // ── F4: „Termin ohne Terminnachricht“ — die 30 Minuten frühestens ab der Buchung ──
  const Zt = (o: Partial<import("../server/lib/fiaon-lead-takt-regeln").KetteWaZeile> = {}) => ({
    anfrageId: 951, eingangAm: um("2026-10-20", 10), status: "termin", nummer: "4915500000951", ja: "website", jaSeit: um("2026-10-20", 10),
    terminKommend: true, terminVorbei: false, kontakt: false, begruessungFehler: null, ...o,
  });
  const fr = Zt({ terminSeit: um("2026-11-09", 11, 50) });
  ok(!R.waErwartet(fr, um("2026-11-09", 12, 29)) && R.waErwartet(fr, um("2026-11-09", 12, 31)), "altes Ja (20 Tage), heute 11:50 gebucht → erst ab 12:30 erwartet (vorher sofort „rot“, bevor der Takt die Buchung sah)");
  const na = Zt({ terminSeit: um("2026-11-09", 21) });
  ok(!R.waErwartet(na, um("2026-11-10", 8, 29)) && R.waErwartet(na, um("2026-11-10", 8, 31)), "um 21 Uhr gebucht → gezählt ab 8 Uhr (keine Nacht-Mail an Justin)");
  ok(R.waErwartet(Zt(), um("2026-11-09", 12)) && R.waErwartet(Zt({ terminSeit: null }), um("2026-11-09", 12)), "ohne Buchungszeit wie bisher (Eingang bzw. Ja)");
  ok(!R.waErwartet(Zt({ terminKommend: false, terminVorbei: true, terminSeit: um("2026-11-09", 9) }), um("2026-11-09", 12)), "vergangenes Gespräch → nichts (keine neue Regel „altes Ja ohne WhatsApp“)");
  const waT = R.waLueckeUrteil({ an: true, zeilen: [Zt({ terminSeit: um("2026-11-08", 9) })], ohneAnfrage: [], falsch: [], alteFassung: null }, um("2026-11-09", 12));
  ok(waT.stufe === "rot" && waT.faelle.join() === "951" && /Anfrage #951 \(Ja: website\): Termin steht, aber keine Terminnachricht/.test(waT.text), "Ja vom 20.10. + kommender Termin ohne Terminnachricht → rot (Befund: so ein Fall fiel nie auf)");

  // ── Quelltext-Wände (F2–F5) ──
  const regeln = lies("server/lib/fiaon-lead-takt-regeln.ts");
  const takt = lies("server/lib/fiaon-lead-takt.ts");
  const lesen = takt.split("export async function leadKetteLesen(")[1]?.split("\n}\n")[0] ?? "";
  const waBlock = lesen.split("// WhatsApp — wer Ja gesagt hat")[1] ?? "";
  const iWarte = waBlock.indexOf('await warteBisLaufFertig("wa_global_takt", { hoechstensMs: opt.warteMs ?? 30_000, schrittMs: 200 })');
  ok(iWarte > 0 && iWarte < waBlock.indexOf('await import("./fiaon-mara-business")'), "F3: der WhatsApp-Block wartet ZUERST auf wa_global_takt (alle 200 ms, höchstens 30 s — der Knopf 5 s), dann liest er");
  ok(!/laufAktiv\("wa_global_takt"\)\) (return|continue)|if \(laufAktiv/.test(lesen), "F3: kein „läuft der Takt → keine Aussage“ (das machte den Wächter fast immer stumm)");
  ok(/tk\.created_at AS termin_gebucht_am/.test(lesen) && /SELECT t\.id, t\.created_at FROM fiaon_termine t/.test(lesen) && /OR \(tk\.id IS NOT NULL AND g\.ja_am IS NOT NULL\)\)/.test(lesen)
    && /INTERVAL '\$\{KETTE_VORGABE\.terminTage\} days'/.test(lesen) && R.KETTE_VORGABE.terminTage === 60 && /terminSeit: terminKommend && r\.termin_gebucht_am/.test(lesen),
    "F4: kommender Termin mit Ja-Zeile → 60 Tage zurück wie der Takt, die Buchungszeit geht mit");
  // Nachbesserung (Gutachten): vorn nur Termine, deren Terminnachricht noch NICHT verbucht ist — dann die neuesten (vorher fielen
  // die ältesten Fälle im 3-Tage-Fenster unten aus der Liste, sobald viele längst gemeldete Termine vorn standen).
  ok(/ORDER BY \(tk\.id IS NOT NULL AND g\.ja_am IS NOT NULL AND NOT tg\.gemeldet\) DESC, a\.created_at DESC LIMIT \$\{KETTE_VORGABE\.zeilenHoechstens\}/.test(lesen) && R.KETTE_VORGABE.zeilenHoechstens >= 100,
    "F4: offene Terminnachrichten vorn, dann die neuesten — kein Fall im 3-Tage-Fenster fällt still heraus");
  ok(/x\.created_at > CASE WHEN tk\.id IS NOT NULL THEN tk\.created_at - INTERVAL '1 minute' ELSE a\.created_at - INTERVAL '1 day' END\) AS kontakt/.test(lesen),
    "F4 (Gutachten): beim kommenden Termin zählt nur eine WhatsApp NACH der Buchung als Kontakt (eine alte Begrüßung verdeckt keine fehlende Terminnachricht)");
  ok(/LEFT JOIN LATERAL \(SELECT MIN\(m\.erstellt_am\) AS erstellt FROM fiaon_meta_leads m WHERE m\.global_anfrage_id = a\.id\) me ON TRUE/.test(lesen)
    && /LEAST\(a\.created_at, COALESCE\(me\.erstellt, a\.created_at\)\) > \$2::timestamptz - INTERVAL '\$\{KETTE_VORGABE\.tage\} days'/.test(lesen),
    "Nachbesserung (Gutachten): „drei Tage“ zählen ab dem ECHTEN Eingang bei Meta — wie im Takt (kein Alarm für einen alten Rückstand-Lead)");
  ok(/ORDER BY a\.created_at DESC, a\.id DESC LIMIT \$\{KETTE_VORGABE\.zeilenHoechstens\}/.test(lesen) && /ORDER BY w\.nachfass_faellig DESC, w\.anfrage_id DESC LIMIT \$\{KETTE_VORGABE\.zeilenHoechstens\}/.test(lesen)
    && !/ORDER BY a\.id LIMIT 30|ORDER BY w\.nachfass_faellig LIMIT 30/.test(lesen),
    "Nachbesserung (Gutachten): W und N lesen die NEUESTEN zuerst (vorher die ältesten 30 — gerade die neuen fehlten in der Mail)");
  ok(!/alteFassung/.test(lesen) && /waLueckeUrteil\(\{ an, pausiert, zeilen, ohneAnfrage, falsch \}, jetzt\)/.test(lesen)
    && !/Meta-Leads \(24 Stunden\) kamen|mit_ja|quoteAb|quote: /.test(takt + regeln) && !("quoteAb" in R.KETTE_VORGABE),
    "F5: die Quote der letzten 24 Stunden ist weg — und Meta wird nicht mehr in diesem Takt gefragt (eigener Alarm in meta_waechter)");
  const metaQ = lies("server/lib/fiaon-meta-leads.ts");
  ok(/if \(\(await alteFassungWaechter\(lauf\)\) === true\) aktiv\.push\("alte-fassung"\);/.test(metaQ.split("export async function waechterLauf(")[1] ?? ""),
    "F5 (Gutachten): die alte Formular-Fassung prüft der Lauf meta_waechter mit eigenem gelben Alarm");
  const schicken13 = takt.split("async function ketteMailSchicken(")[1]?.split("\n}\n")[0] ?? "";
  ok(/try \{\s*const an = await justinAdresse\(lauf\);\s*v = await mailSenden\(/.test(schicken13) && /\} catch \(e\) \{\s*v = \{ ok: false/.test(schicken13)
    && /faellig\.push\(\{ alarm: r\.alarm, faelle: plan\.mailFaelle, neu: plan\.neueFaelle, unbestaetigt: plan\.unbestaetigt \}\)/.test(schicken13),
    "Mail an Justin (Gutachten): der Versand hat sein eigenes try (eine Ausnahme dreht den Merker zurück); in die Mail nur bestätigte Fälle, die neuen markiert");
  const crons = lies("server/lib/fiaon-crons.ts");
  ok(/export function laufAktiv\(name: string\): boolean \{\s*return stillAktiv\.has\(name\) \|\| \(historieAktiv\.get\(name\) \?\? 0\) > 0;/.test(crons)
    && /historieAktiv\.set\(name, \(historieAktiv\.get\(name\) \?\? 0\) \+ 1\);\s*try \{\s*const ergebnis = await fn\(\);/.test(crons) && /\} finally \{\s*const rest = \(historieAktiv\.get\(name\) \?\? 1\) - 1;/.test(crons),
    "F3: laufAktiv kennt Takte mit nurMitErgebnis UND Läufe mit Historie (gezählt bis zum finally)");
  const routes = lies("server/routes.ts");
  ok(/tageslauf\('lead_takt'[\s\S]{0,160}5 \* 60 \* 1000[\s\S]{0,80}nurMitErgebnis: true/.test(routes) && /tageslauf\('wa_global_takt'[\s\S]{0,160}5 \* 60 \* 1000[\s\S]{0,80}nurMitErgebnis: true/.test(routes),
    "F3 (Ursache): lead_takt und wa_global_takt laufen beide alle 5 Minuten als stille Takte — darum wartet der Wächter");

  // ── F3: warten, bis der Takt fertig ist (echt, mit stillerLauf — ohne Datenbank: die Arbeit meldet false) ──
  const C = await import("../server/lib/fiaon-crons");
  ok(!C.laufAktiv("pruef_e490_takt"), "laufAktiv: ein Lauf, der gerade nicht arbeitet → nein");
  let fertigAm = 0;
  const lauf1 = C.stillerLauf("pruef_e490_takt", async () => { await new Promise((r) => setTimeout(r, 450)); fertigAm = Date.now(); return false; });
  ok(C.laufAktiv("pruef_e490_takt"), "… während er arbeitet → ja");
  const w1 = await C.warteBisLaufFertig("pruef_e490_takt", { hoechstensMs: 5000, schrittMs: 50 });
  await lauf1;
  ok(w1.fertig && fertigAm > 0 && w1.gewartetMs >= 350, `warteBisLaufFertig wartet, bis der Takt fertig ist (${w1.gewartetMs} ms)`);
  const lauf2 = C.stillerLauf("pruef_e490_lang", async () => { await new Promise((r) => setTimeout(r, 700)); return false; });
  const w2 = await C.warteBisLaufFertig("pruef_e490_lang", { hoechstensMs: 200, schrittMs: 50 });
  ok(!w2.fertig && w2.gewartetMs >= 200 && w2.gewartetMs < 650, `… aber höchstens so lange wie erlaubt — danach liest der Wächter trotzdem (${w2.gewartetMs} ms)`);
  await lauf2;
  ok(!C.laufAktiv("pruef_e490_lang") && (await C.warteBisLaufFertig("pruef_e490_lang")).gewartetMs < 50, "nach dem Ende sofort frei");

  // ── Rundgänge nachgezogen ──
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Ein NEUER roter Fall kommt sofort per Mail/.test(rg) && /alte Formular-Fassung \(ohne WhatsApp-Satz\)/.test(rg) && /Ein NEUES Formular findet die Plattform selbst/.test(rg), "Rundgang Lead-Motor nachgezogen (F1, F2–F5)");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — LOKALE WEGWERF-DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (erfundene Menschen, Testkonten)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const G = await import("../server/lib/fiaon-global-termin");
  const D = await import("../server/lib/fiaon-lead-dossier");
  const LW = await import("../server/lib/fiaon-lead-weg");
  const T = await import("../server/lib/fiaon-lead-takt");
  const M = await import("../server/lib/fiaon-meta-leads");
  const GG = await import("../server/lib/fiaon-global-gespraech");
  const { kostenTabelle } = await import("../server/lib/fiaon-meta-kosten");
  const { istWerktag, isoPlus } = await import("../shared/fiaon-global-lead-texte");
  const { berlinZeit } = await import("../shared/fiaon-global-lead");
  const LAUF = randomBytes(3).toString("hex");
  const DOM = `lt-${LAUF}.example`;
  const mail = (n: number) => `lt-${LAUF}-${n}@${DOM}`;
  const nummer = (n: number) => `+49152${String(parseInt(LAUF, 16) % 100000).padStart(5, "0")}${String(n).padStart(3, "0")}`;
  const MELDE = `lt-${LAUF}@fiaon.com`;
  const gesendet: any[] = [];
  let versandFehler = false;
  const attrappe = async (m: any) => { gesendet.push(m); return versandFehler ? { ok: false, messageId: null, grund: "Prüf-Störung" } : { ok: true, messageId: `<lt-${LAUF}-${gesendet.length}@example.com>` }; };
  T.leadTaktVersandSetzen(attrappe);
  LW.leadWegVersandSetzen(async () => ({ ok: true, messageId: null }));
  D.dossierVersandSetzen(async () => ({ ok: true, messageId: null }));
  const setze = (k: string, v: string) => sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const loesche = (k: string) => sql`DELETE FROM fiaon_settings WHERE key = ${k}`;
  const [kal] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Kalender', 'Pruef', ${`kal-${LAUF}@example.com`}, TRUE, TRUE, 'agent') RETURNING id`) as any[];
  const [zst] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Vertrieb', 'Pruef', ${`vt-${LAUF}@privat.example`}, TRUE, FALSE, 'agent') RETURNING id`) as any[];
  const [vtr] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Vertretung', 'Vera', ${`vr-${LAUF}@example.com`}, TRUE, FALSE, 'vertriebsleiter') RETURNING id`) as any[];
  const KAL = Number(kal.id), ZST = Number(zst.id), VTR = Number(vtr.id);
  for (const wt of [1, 2, 3, 4, 5]) await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv) VALUES (${KAL}, ${wt}, '07:00', '20:00', TRUE)`;
  await setze("gruender_termin_agent_id", String(KAL));
  await setze("global_zustaendig_agent_id", String(ZST));
  await setze("global_vertretung_agent_id", String(VTR));
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${["global_kalender_agent_id", "global_lead_pro_tag", "global_kalender_gesamt_pro_tag", "lead_takt_an", "lead_meldung_an", "lead_uebersicht_an", "lead_uebersicht_tag", "meta_webhook_still_seit", "lead_dossier_an"]})`;
  await setze("global_termin_pro_tag", "8");
  await setze("global_lead_meldung_an", MELDE);
  await setze("lead_takt_ab", new Date(Date.now() - 3_600_000).toISOString());
  await setze("lead_dossier_an", "0");
  await M.metaTabellen();
  await D.leadDossierSchema();
  await LW.leadWegSchema();
  await GG.ensureGlobalGespraechSpalten();
  await kostenTabelle();
  await T.leadTaktBereit();
  const kontakt = (n: number) => ({ name: `Lt Person${n}`, vorname: "Lt", nachname: `Person${n}`, firma: `Lt Logistik ${LAUF} ${n} GmbH`, email: mail(n), telefon: nummer(n), paket: null, paketText: null, land: "DE", sprache: "de" as const });
  const anfrage = async (n: number, text = "Prüfanfrage zu FIAON Global") => (await G.globalAnfrageAnnehmen({ kontakt: kontakt(n) as any, wunschzeit: null, text, ip: `198.51.100.${n}` })).anfrageId;
  const auftrag = async (anfrageId: number, art = "anfrage") => ((await sql`SELECT id, status, zustaendig_agent_id, faellig_am::text AS faellig, ergebnis, agent_gelesen_am FROM fiaon_betreiber_todos WHERE schluessel = ${`global-${art}:${anfrageId}`}`) as any[])[0];
  const firmaVon = async (n: number) => Number(((await sql`SELECT id FROM fiaon_firmen_leads WHERE LOWER(email) = ${mail(n)}`) as any[])[0]?.id || 0);
  const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Ein Werktag (kein Wochenende, kein Feiertag) NACH heute — für die Zeitreise der Leiter und der Übersicht.
  let TAG = isoPlus(berlinZeit(new Date()).iso, 1);
  while (!istWerktag(TAG, R.feiertagDE)) TAG = isoPlus(TAG, 1);
  const tagUm = (m: number) => um(TAG, 9, m);

  abschnitt("B1 T1 — an „Lead-Meldungen an“, nie an die Login-Adresse, genau einmal");
  const A1 = await anfrage(1);
  const a1 = await auftrag(A1);
  ok(!!a1 && a1.status !== "erledigt" && Number(a1.zustaendig_agent_id) === ZST, "Anfrage → Anruf-Auftrag an die zuständige Person (Portal)");
  await warte(500);
  const [zuw] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'aufgabe_zugewiesen' AND LOWER(COALESCE(empfaenger, '')) = ${`vt-${LAUF}@privat.example`}`) as any[];
  gleich(Number(zuw?.n), 0, "KEINE „Neuer Auftrag“-Mail an die Login-Adresse — Entscheidung 3A");
  gesendet.length = 0;
  const r1 = await T.t1Senden(A1);
  gleich(r1.ergebnis, "gesendet", "T1 gesendet");
  gleich(gesendet.length, 1, "genau EINE Mail");
  ok(gesendet[0]?.an === MELDE && gesendet[0]?.an !== `vt-${LAUF}@privat.example`, "T1 geht an die Meldeadresse, nicht an die Login-Adresse");
  ok(/^Neuer Lead: Lt Logistik/.test(String(gesendet[0]?.betreff)) && /NEUER LEAD/.test(String(gesendet[0]?.text)) && gesendet[0]?.name === "Pruef Vertrieb", "Betreff „Neuer Lead: …“, Anrede an die zuständige Person");
  ok(gesendet[0]?.antwortAn?.email?.endsWith("@fiaon.com"), "Antwort-an: ein Postfach des Hauses (nicht Maras welcome@-Automatik)");
  gleich((await T.t1Senden(A1)).ergebnis, "uebersprungen", "zweiter Versuch: nichts (atomar)");
  const [tk1] = (await sql`SELECT t1_status, t1_an, t1_id, t1_betreff FROM fiaon_lead_takt WHERE anfrage_id = ${A1}`) as any[];
  ok(tk1?.t1_status === "gesendet" && tk1?.t1_an === MELDE && /^<lt-/.test(String(tk1?.t1_id)), "Zeile in fiaon_lead_takt: gesendet, an wen, Kennung (für den Faden)");
  const [log1] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_log WHERE firma_id = ${await firmaVon(1)} AND ergebnis = 'lead_meldung'`) as any[];
  gleich(Number(log1?.n), 1, "Zeile im Cockpit-Verlauf („Lead-Meldung an …“)");
  // Vorgabe ohne Einstellung: die Visitenkarte bzw. die Vorgabe aus 3A (eine Firmenadresse) — nie die Login-Adresse.
  await loesche("global_lead_meldung_an");
  const zielV = await T.leadMeldungZiel();
  ok(zielV.an.endsWith("@fiaon.com") && zielV.quelle !== "einstellung", "ohne Einstellung: Vorgabe (Firmenadresse), nie die Login-Adresse");
  await setze("global_lead_meldung_an", MELDE);
  // Altbestand, Privat-Weg, schon gebucht, Schalter AUS
  const A2 = await anfrage(2);
  await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '2 hours' WHERE id = ${A2}`;
  gleich((await T.t1Senden(A2)).ergebnis, "nicht_noetig", "vor dem Zählbeginn (Altbestand): keine T1");
  const A3 = await anfrage(3, "Ich bin Kundin und wurde ignoriert, man hat mir eine Bank-Zusage versprochen, ich will mein Geld zurück, sonst Anwalt.");
  const [a3] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A3}`) as any[];
  if (a3?.status === "privat") gleich((await T.t1Senden(A3)).ergebnis, "nicht_noetig", "Privat-Weg (Beschwerde): keine T1, Daniel ruft nicht an");
  else ok(true, "(Privat-Weg in dieser Prüf-Vorlage nicht ausgelöst — übersprungen)");
  // Zwei getrennte Schalter (Gutachten Technik, Mangel 2): „Lead-Meldung“ (T1) und „Erinnerungen“ (Leiter 15/60/120).
  await setze("lead_meldung_an", "0");
  const A4 = await anfrage(4);
  gleich((await T.t1Senden(A4)).ergebnis, "aus", "Schalter „Lead-Meldung“ AUS: keine T1");
  await warte(600);
  const [zuw4] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'aufgabe_zugewiesen' AND LOWER(COALESCE(empfaenger, '')) = ${MELDE}`) as any[];
  ok(Number(zuw4?.n) >= 1, "… dann geht die „Neuer Auftrag“-Mail wieder — an die Meldeadresse (nie ins Leere)");
  const [zuw4b] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'aufgabe_zugewiesen' AND LOWER(COALESCE(empfaenger, '')) = ${`vt-${LAUF}@privat.example`}`) as any[];
  gleich(Number(zuw4b?.n), 0, "… und nie an die private Login-Adresse");
  await loesche("lead_meldung_an");
  const a4 = await auftrag(A4);
  await sql`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE id = ${a4.id}`;
  gleich((await T.t1Senden(A4)).ergebnis, "nicht_noetig", "Auftrag schon zu (gebucht / Justin ruft selbst an): keine T1");

  abschnitt("B2 Die Leiter 15/60/120 — Daniel, Justin, Vertretung, Zusage-Wächter");
  const A5 = await anfrage(5);
  await T.t1Senden(A5);
  const ein5 = tagUm(0);
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${A5}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${A5}`;
  const nur = (anfrageId: number) => sql`UPDATE fiaon_lead_takt SET e15_am = COALESCE(e15_am, NOW()), e60_am = COALESCE(e60_am, NOW()), e120_am = COALESCE(e120_am, NOW()) WHERE anfrage_id <> ${anfrageId}`;
  await nur(A5);
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(14)), 0, "14 Dienstminuten: nichts");
  gleich(await T.eskalationenPruefen(tagUm(15)), 1, "15 Minuten: eine Erinnerung");
  ok(gesendet[0]?.an === MELDE && /^LEAD WARTET SEIT 15 MIN\./.test(String(gesendet[0]?.text)), "… an die Meldeadresse, „Lead wartet seit 15 Min.“");
  ok(/^Re: Neuer Lead:/.test(String(gesendet[0]?.betreff)) && /^<lt-/.test(String(gesendet[0]?.kopfzeilen?.["In-Reply-To"] ?? "")), "… im Faden der Lead-Meldung (Re:, In-Reply-To)");
  gleich(await T.eskalationenPruefen(tagUm(20)), 0, "kein zweites Mal");
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(60)), 1, "60 Minuten: eine Zeile an Justin");
  ok(/^WARTET SEIT 60 MIN\./.test(String(gesendet[0]?.text)) && /Pruef Vertretung hat jetzt den Rückruf als Aufgabe — keine Aufgabe für dich/.test(String(gesendet[0]?.text)), "… nennt die Vertretung, keine Aufgabe für Justin");
  const rr5 = await auftrag(A5, "rueckruf");
  ok(!!rr5 && Number(rr5.zustaendig_agent_id) === VTR && rr5.status !== "erledigt", "Rückruf als Aufgabe an die Vertretung");
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(121)), 1, "120 Minuten ohne Anruf: Zusage-Wächter (Hinweis an Daniel)");
  ok(/^ZUSAGE OFFEN/.test(String(gesendet[0]?.text)), "… „Zusage offen“");
  const [rrN] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-rueckruf:${A5}`}`) as any[];
  gleich(Number(rrN?.n), 1, "die Vertretung bekommt den Rückruf nur einmal");
  gleich(await T.eskalationenPruefen(tagUm(200)), 0, "danach nichts mehr (jede Stufe einmal)");
  // Reaktion: geöffnet stoppt 15/60, ein Anruf stoppt alles.
  const A6 = await anfrage(6);
  await T.t1Senden(A6);
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${A6}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${A6}`;
  await nur(A6);
  const a6 = await auftrag(A6);
  await sql`UPDATE fiaon_betreiber_todos SET agent_gelesen_am = NOW() WHERE id = ${a6.id}`;
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(61)), 0, "Auftrag geöffnet: keine Erinnerung, keine Zeile an Justin");
  await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz, created_at) VALUES (${await firmaVon(6)}, ${ZST}, 'Pruef Vertrieb', 'anruf', 'nicht_erreicht', 'Mailbox', ${tagUm(70)})`;
  gleich(await T.eskalationenPruefen(tagUm(130)), 0, "Anruf eingetragen: auch kein Zusage-Wächter");
  // Cockpit geöffnet zählt wie ein geöffneter Auftrag (nicht Justin, nicht die Nur-Ansicht)
  const A7 = await anfrage(7);
  await T.t1Senden(A7);
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${A7}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${A7}`;
  await nur(A7);
  await T.geoeffnetMerken(await firmaVon(7), { id: KAL, name: "Pruef Kalender" });
  const [g7a] = (await sql`SELECT geoeffnet_am FROM fiaon_lead_takt WHERE anfrage_id = ${A7}`) as any[];
  ok(!g7a?.geoeffnet_am, "Justin (Gründer-Konto) öffnet: zählt nicht als Reaktion des Teams");
  await T.geoeffnetMerken(await firmaVon(7), { id: ZST, name: "Pruef Vertrieb", ansicht: true });
  const [g7b] = (await sql`SELECT geoeffnet_am FROM fiaon_lead_takt WHERE anfrage_id = ${A7}`) as any[];
  ok(!g7b?.geoeffnet_am, "Nur-Ansicht der Leitung: zählt nicht");
  // (Die echte Marke setzt der Lauf nur für Leads der letzten drei Tage — hier liegt der Eingang in der Zukunft, das ist erlaubt.)
  await sql`UPDATE fiaon_lead_takt SET eingang_am = NOW() WHERE anfrage_id = ${A7}`;
  await T.geoeffnetMerken(await firmaVon(7), { id: ZST, name: "Pruef Vertrieb" });
  const [g7c] = (await sql`SELECT geoeffnet_am, geoeffnet_von FROM fiaon_lead_takt WHERE anfrage_id = ${A7}`) as any[];
  ok(!!g7c?.geoeffnet_am && g7c?.geoeffnet_von === "Pruef Vertrieb", "Daniel öffnet die Firma im Cockpit: zählt als Reaktion");
  // Samstag: still
  const sa = (() => { let t = TAG; while (new Date(`${t}T12:00:00Z`).getUTCDay() !== 6) t = isoPlus(t, 1); return t; })();
  const A8 = await anfrage(8);
  await T.t1Senden(A8);
  await nur(A8);
  gleich(await T.eskalationenPruefen(um(sa, 11)), 0, "Samstag: keine Erinnerung (nur Mo–Fr 9–18 Uhr)");

  abschnitt("B3 Die Anruf-Route: Pflicht-Notiz, Termin-Regel, EIN Stand");
  const FR = (await import("../server/routes/fiaon-firmen")).default as any;
  const schritt = (methode: string, pfad: string) => FR.stack.find((l: any) => l.route?.path === pfad && l.route.methods[methode])?.route.stack.at(-1).handle;
  const rufe = async (h: any, params: any, body: any = {}, agent: any = { id: ZST, name: "Pruef Vertrieb" }) => {
    const antwort: { status: number; json: any } = { status: 200, json: null };
    const res: any = { status(c: number) { antwort.status = c; return res; }, json(j: any) { antwort.json = j; return res; }, setHeader() { return res; } };
    await h({ body, query: {}, params, headers: {}, socket: {}, agent }, res);
    return antwort;
  };
  const anruf = schritt("post", "/agent/firmen/:id/anruf");
  const detail = schritt("get", "/agent/firmen/:id");
  const A9 = await anfrage(9);
  const F9 = await firmaVon(9);
  const kurz = await rufe(anruf, { id: String(F9) }, { ergebnis: "erreicht_interesse", notiz: "Interesse." });
  ok(kurz.status === 400 && kurz.json?.feld === "notiz", "Business-Lead: „erreicht — Interesse“ ohne zwei, drei Sätze → 400");
  const ohneTermin = await rufe(anruf, { id: String(F9) }, { ergebnis: "erreicht_termin", notiz: "Geschäftsführer einer Agentur mit zwölf Leuten, will US-Kunden direkt bedienen." });
  ok(ohneTermin.status === 400 && ohneTermin.json?.feld === "termin" && ohneTermin.json?.ohneTermin === true, "„Termin vereinbart“ ohne Termin im Kalender → 400 (der Knopf öffnet den Termin-Eintrag)");
  const gut = await rufe(anruf, { id: String(F9) }, { ergebnis: "erreicht_interesse", notiz: "Geschäftsführer einer Agentur mit zwölf Leuten, will US-Kunden direkt bedienen.", felder: { groesse: "zwölf Mitarbeiter" } });
  ok(gut.json?.ok === true && gut.json?.lead === true, `mit Notiz: festgehalten (${gut.json?.error ?? ""})`);
  const [an9] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A9}`) as any[];
  gleich(an9?.status, "in_arbeit", "die Anfrage zieht mit („in Arbeit“)");
  const a9 = await auftrag(A9);
  ok(a9?.status === "erledigt" && /Anruf eingetragen: erreicht, Interesse/.test(String(a9?.ergebnis)), "der Anruf-Auftrag schließt sich (ein Stand)");
  const [erz9] = (await sql`SELECT notiz FROM fiaon_firmen_log WHERE firma_id = ${F9} AND art = 'global' AND ergebnis = 'erzaehlt' ORDER BY id DESC LIMIT 1`) as any[];
  ok(/Agentur mit zwölf Leuten/.test(String(erz9?.notiz)) && /Größe grob \(Mitarbeiter, Umsatz\): zwölf Mitarbeiter/.test(String(erz9?.notiz)), "„Was er selbst erzählt hat“ steht für „Termin steht“ und die Anruf-Karte bereit");
  const A10 = await anfrage(10);
  const F10 = await firmaVon(10);
  const ne = await rufe(anruf, { id: String(F10) }, { ergebnis: "nicht_erreicht" });
  ok(ne.json?.ok === true, "nicht erreicht: ohne Notiz erlaubt");
  const a10 = await auftrag(A10);
  ok(a10?.status !== "erledigt" && /^\d{4}-\d{2}-\d{2}$/.test(String(a10?.faellig)) && String(a10?.faellig) > berlinZeit(new Date()).iso, "Auftrag bleibt offen, fällig am Wiedervorlage-Tag");
  const [an10] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A10}`) as any[];
  gleich(an10?.status, "in_arbeit", "Anfrage „in Arbeit“");
  // Kaltakquise: keine Pflicht
  const [kalt] = (await sql`INSERT INTO fiaon_firmen_leads (firma, telefon, quelle, status) VALUES (${`Lt Kalt ${LAUF} GmbH`}, ${nummer(90)}, 'Import Prüfung', 'neu') RETURNING id`) as any[];
  const k1 = await rufe(anruf, { id: String(kalt.id) }, { ergebnis: "erreicht_termin" });
  ok(k1.json?.ok === true && k1.json?.lead === false, "Kaltakquise: „Termin vereinbart“ ohne Notiz und ohne Kalender wie bisher (Gutachten 0, Mangel 9)");
  // Stand-Leiste
  const d9 = await rufe(detail, { id: String(F9) });
  ok(d9.json?.lead?.anfrageId === A9 && d9.json.lead.schritte?.length === 4 && /Interesse/.test(String(d9.json.lead.jetzt)), "Stand-Leiste: vier Schritte und was jetzt dran ist");
  const dk = await rufe(detail, { id: String(kalt.id) });
  ok(dk.json?.ok === true && dk.json?.lead === null, "Kaltakquise: keine Stand-Leiste");

  abschnitt("B4 Buchung → „termin“, Absage → Auftrag wieder offen, nicht zustande → wieder offen");
  const A11 = await anfrage(11);
  const code = await LW.leadCodeSichern(A11);
  const ang = await G.globalAngebotLaden();
  const slot = ang.tage[0];
  const b11 = await G.globalTerminBuchen({ kontakt: kontakt(11) as any, tag: slot.tag, zeit: slot.zeiten[0], thema: null, code: code!.code });
  ok(b11.ok, `Buchung über den Link (${b11.ok ? "ok" : (b11 as any).error})`);
  await warte(600);
  const [an11] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A11}`) as any[];
  gleich(an11?.status, "termin", "Anfrage „termin“ (mit Termin)");
  ok((await auftrag(A11))?.status === "erledigt", "Daniels Auftrag ist zu");
  const F11 = await firmaVon(11);
  const mitTermin = await rufe(anruf, { id: String(F11) }, { ergebnis: "erreicht_termin", notiz: "Inhaber einer Spedition, will Kapital für den Fuhrpark und eine Niederlassung in Florida." });
  ok(mitTermin.json?.ok === true, "mit Termin im Kalender: „Termin vereinbart“ erlaubt");
  const T11 = b11.ok ? b11.terminId : 0;
  const [t11] = (await sql`SELECT person_id, beginn FROM fiaon_termine WHERE id = ${T11}`) as any[];
  await sql`UPDATE fiaon_termine SET status = 'abgesagt' WHERE id = ${T11}`;
  await G.globalTerminAbgesagt({ terminId: T11, personId: Number(t11.person_id), beginn: t11.beginn, wer: "kunde" });
  const a11b = await auftrag(A11);
  ok(a11b?.status !== "erledigt", "Absage: Daniels Auftrag ist wieder offen (neu vereinbaren)");
  const [an11b] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A11}`) as any[];
  ok(an11b?.status !== "termin", `Absage: die Anfrage steht nicht mehr auf „termin“ (${an11b?.status})`);
  // Startgespräch eines zahlenden Kunden bleibt unberührt
  const [sg] = (await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, quelle, herkunft, status) VALUES (${Number(t11.person_id)}, ${KAL}, NOW() + INTERVAL '5 days', 'global', 'individualangebot', 'abgesagt') RETURNING id`.catch(() => [null])) as any[];
  if (sg?.id) {
    const vorher = (await auftrag(A11))?.status;
    await G.globalTerminAbgesagt({ terminId: Number(sg.id), personId: Number(t11.person_id), beginn: new Date(), wer: "kunde" });
    gleich((await auftrag(A11))?.status, vorher, "Absage eines Startgesprächs (zahlender Kunde): der Lead-Stand bleibt, wie er war");
  }

  abschnitt("B5 Übersicht 18:30 — Vorschau sendet nie, einmal je Tag, Fehlversuch, leer");
  // Zwei Leads am Prüftag: A5 (Eingang 9:00, Leiter durch) und A6 (angerufen).
  gesendet.length = 0;
  const vor = await T.uebersichtVorschau({ tag: TAG });
  ok(/^FIAON Global heute: /.test(vor.betreff) && /NEU HEUTE/.test(vor.text) && /<html|<table|<div/i.test(vor.html) && gesendet.length === 0, "Vorschau rendert (Text + HTML) und sendet nichts");
  const daten = await T.uebersichtDatenLesen(TAG, um(TAG, 18, 31));
  ok(daten.neu.some((l) => l.anfrageId === A5) && daten.neu.some((l) => l.anfrageId === A6), "die Leads des Tages stehen drin");
  ok(daten.neu.find((l) => l.anfrageId === A5)?.eskaliert === "e120", "… mit der Erinnerungsstufe (Zusage-Wächter)");
  gleich(await T.uebersichtSenden({ jetzt: um(TAG, 18, 29) }), "nicht_faellig", "18:29 Uhr: noch nicht");
  gleich(await T.uebersichtSenden({ jetzt: um(TAG, 18, 31) }), "gesendet", "18:31 Uhr: gesendet");
  ok(gesendet.length === 2 && gesendet[0]?.an.endsWith("@fiaon.com") && gesendet[1]?.an === MELDE, "an Justin (Dossier-Adresse) und ans Team (Meldeadresse)");
  ok(/^FIAON Global heute: \d+ Leads? · \d+ Termine? · \d+ angerufen$/.test(String(gesendet[0]?.betreff)) && /Hallo Daniel|Hallo Pruef/.test(String(gesendet[1]?.text)), "Betreff nach Plan; Team-Fassung mit Anrede");
  gleich(await T.uebersichtSenden({ jetzt: um(TAG, 19) }), "nicht_faellig", "ein zweites Mal am selben Abend: nichts (Tagesmerker)");
  const NAECHST = (() => { let t = isoPlus(TAG, 1); while (!istWerktag(t, R.feiertagDE)) t = isoPlus(t, 1); return t; })();
  await sql`UPDATE fiaon_anfragen SET created_at = ${um(NAECHST, 10)} WHERE id = ${A8}`;
  versandFehler = true; gesendet.length = 0;
  gleich(await T.uebersichtSenden({ jetzt: um(NAECHST, 18, 35) }), "fehler", "Versand gestört: Fehler");
  const [mk] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'lead_uebersicht_tag'`) as any[];
  gleich(mk?.value, `${NAECHST}#f1`, "Merker: ein Fehlversuch");
  versandFehler = false;
  gleich(await T.uebersichtSenden({ jetzt: um(NAECHST, 18, 40) }), "gesendet", "der nächste Takt holt nach");
  let LEER = isoPlus(NAECHST, 1); while (!istWerktag(LEER, R.feiertagDE)) LEER = isoPlus(LEER, 1);
  await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE email LIKE ${`%@${DOM}`} AND created_at >= ${um(LEER, 0)} AND created_at < ${um(isoPlus(LEER, 1), 0)}`;
  const leerErg = await T.uebersichtSenden({ jetzt: um(LEER, 18, 30) });
  ok(leerErg === "leer" || leerErg === "gesendet", `ein Tag ohne eigene Leads: ${leerErg} (leer, wenn auch sonst nichts offen ist)`);

  abschnitt("B6 Wächter — grün und rot (System-Alarme im Lagezimmer)");
  const alarm = async (k: string) => ((await sql`SELECT vorbei_am, stufe, anzahl, episoden, endet_nach_stunden FROM fiaon_system_alarme WHERE schluessel = ${k}`) as any[])[0];
  // Kalender leer bei laufender Werbung
  await sql`INSERT INTO fiaon_meta_kosten (tag, ebene, objekt_id, name, ausgaben_cents) VALUES ((NOW() AT TIME ZONE 'Europe/Berlin')::date - 1, 'kampagne', ${`lt-${LAUF}`}, 'FIAON Global · Prüfung', 7000) ON CONFLICT DO NOTHING`;
  await sql`UPDATE fiaon_agent_verfuegbarkeit SET aktiv = FALSE WHERE agent_id = ${KAL}`;
  await T.leadWaechterPruefen({ immer: true });
  const k1a = await alarm("lead-takt:kalender");
  ok(!!k1a && !k1a.vorbei_am && k1a.stufe === "rot", "Kalender leer + Werbung gestern → roter Alarm");
  await sql`UPDATE fiaon_agent_verfuegbarkeit SET aktiv = TRUE WHERE agent_id = ${KAL}`;
  await T.leadWaechterPruefen({ immer: true });
  ok(!!(await alarm("lead-takt:kalender"))?.vorbei_am, "Zeiten wieder da → Alarm vorbei");
  // Lead ohne Dossier
  await setze("lead_dossier_an", "1");
  await setze("lead_dossier_ab", new Date(Date.now() - 30 * 60_000).toISOString());
  await sql`INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, status) SELECT 'anfrage', id, id, 'gesendet' FROM fiaon_anfragen WHERE art = 'global' AND created_at > NOW() - INTERVAL '40 minutes' ON CONFLICT (anlass, anlass_id) DO UPDATE SET status = 'gesendet'`;
  const A12 = await anfrage(12);
  await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '15 minutes' WHERE id = ${A12}`;
  await T.leadWaechterPruefen({ immer: true });
  const d1 = await alarm("lead-takt:dossier");
  ok(!!d1 && !d1.vorbei_am, "Lead seit 15 Minuten ohne Dossier → Alarm");
  await sql`INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, status) VALUES ('anfrage', ${A12}, ${A12}, 'gesendet') ON CONFLICT (anlass, anlass_id) DO UPDATE SET status = 'gesendet'`;
  await T.leadWaechterPruefen({ immer: true });
  ok(!!(await alarm("lead-takt:dossier"))?.vorbei_am, "Dossier gesendet → Alarm vorbei");
  await setze("lead_dossier_an", "0");
  // Lead-Mail gescheitert / nicht zugestellt
  const cw = await LW.leadCodeSichern(A12);
  ok(!!cw, "Lead-Weg-Zeile für den Prüffall");
  await import("../server/lib/fiaon-global-lead-post").then((m) => m.leadPostSchema());
  await sql`UPDATE fiaon_lead_weg SET willkommen_status = 'fehler', willkommen_versuche = 3, willkommen_grund = 'Prüf-Störung', updated_at = NOW() WHERE anfrage_id = ${A12}`;
  await sql`INSERT INTO fiaon_mail_log (event, empfaenger, status, zustellung) VALUES ('global_termin', ${mail(12)}, 'versandt', 'blockiert')`;
  await T.leadWaechterPruefen({ immer: true });
  const lm = await alarm("lead-takt:lead-mail");
  ok(!!lm && !lm.vorbei_am && lm.stufe === "rot", "Willkommen gescheitert + Bestätigung blockiert → roter Alarm");
  ok(/global_termin: 1× bei Brevo blockiert/.test(String(((await sql`SELECT text FROM fiaon_system_alarme WHERE schluessel = 'lead-takt:lead-mail'`) as any[])[0]?.text)), "der Alarm nennt, was blockiert wurde");
  await sql`UPDATE fiaon_lead_weg SET willkommen_status = 'gesendet', willkommen_am = NOW() WHERE anfrage_id = ${A12}`;
  // Ohne Brevo-Schlüssel scheitert im Prüfstand jede echte Bestätigung (B4) — auch sie gehört aus dem 24-Stunden-Fenster.
  // Gutachten Technik, Mangel 13: auch fremde Zeilen der Lead-Mails (z. B. von einem anderen Prüfstand auf derselben Kopie) —
  // sonst wäre dieser Fall nicht abgeschottet. Nur auf der Wegwerf-Kopie (Wand oben: lokale fiaon_pruefstand*-Datenbank).
  await sql`UPDATE fiaon_mail_log SET created_at = NOW() - INTERVAL '2 days'
             WHERE (LOWER(COALESCE(empfaenger, '')) LIKE ${`%@${DOM}`}
                OR event = ANY(${["global_termin", "global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht", "global_termin_absage", "global_lead_willkommen", "global_lead_nachfass", "global_info"]}))
               AND created_at > NOW() - INTERVAL '24 hours'`;
  await T.leadWaechterPruefen({ immer: true });
  ok(!!(await alarm("lead-takt:lead-mail"))?.vorbei_am, "nichts mehr gescheitert (24 h) → Alarm vorbei");
  // Meta-Webhook still: EINMAL
  await sql`DELETE FROM fiaon_meta_leads WHERE gesehen_am > NOW() - INTERVAL '24 hours'`;
  await sql`INSERT INTO fiaon_meta_leads (meta_lead_id, weg, gesehen_am) VALUES (${`LT${LAUF}1`}, 'meta_nachhol', NOW() - INTERVAL '1 hour')`;
  ok(await M.webhookStilleWaechter(), "nur Nachhol-Leads in 24 h → Zustand „still“");
  const w1 = await alarm("lead-motor:webhook");
  ok(!!w1 && !w1.vorbei_am && w1.stufe === "gelb" && Number(w1.endet_nach_stunden) === 24, "einmal gemeldet: gelb, die Tafel-Zeile geht nach 24 Stunden von selbst aus");
  const [ma] = (await sql`SELECT id, erledigt_am FROM fiaon_meta_alarme WHERE art = 'webhook'`) as any[];
  ok(!!ma && !ma.erledigt_am, "… und einmal im Lead-Motor");
  await M.webhookStilleWaechter();
  await M.webhookStilleWaechter();
  const w2 = await alarm("lead-motor:webhook");
  ok(Number(w2?.anzahl) === Number(w1?.anzahl) && Number(w2?.episoden) === Number(w1?.episoden), "weitere Läufe: KEINE neue Meldung (nicht täglich)");
  await sql`UPDATE fiaon_meta_alarme SET erledigt_am = NOW() WHERE art = 'webhook'`;
  await M.webhookStilleWaechter();
  const [mb] = (await sql`SELECT erledigt_am FROM fiaon_meta_alarme WHERE art = 'webhook'`) as any[];
  ok(!!mb?.erledigt_am, "„Erledigt“ im Lead-Motor bleibt erledigt — der bekannte Zustand kommt nicht wieder");
  await sql`INSERT INTO fiaon_meta_leads (meta_lead_id, weg, gesehen_am) VALUES (${`LT${LAUF}2`}, 'meta_webhook', NOW() - INTERVAL '10 minutes')`;
  ok(!(await M.webhookStilleWaechter()), "ein Lead über den Webhook → der Zustand ist vorbei");
  const [mk2] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'meta_webhook_still_seit'`) as any[];
  ok(!String(mk2?.value ?? "") && !!(await alarm("lead-motor:webhook"))?.vorbei_am, "Merker leer, Alarm vorbei");
  await sql`UPDATE fiaon_meta_leads SET gesehen_am = NOW() - INTERVAL '2 days' WHERE meta_lead_id = ${`LT${LAUF}2`}`;
  ok(await M.webhookStilleWaechter(), "fällt er wieder aus: genau eine neue Meldung");
  const w3 = await alarm("lead-motor:webhook");
  ok(Number(w3?.episoden) === Number(w1?.episoden) + 1 && !w3?.vorbei_am, "… eine neue Episode");

  abschnitt("B7 Ableitung des Altbestands — Vorschau ändert nichts, Anwenden korrigiert");
  const A13 = await anfrage(13);
  const F13 = await firmaVon(13);
  await sql`UPDATE fiaon_firmen_leads SET status = 'termin' WHERE id = ${F13}`;
  await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${F13}, ${ZST}, 'Pruef Vertrieb', 'anruf', 'erreicht_termin', 'Termin mündlich vereinbart')`;
  const ab = berlinZeit(new Date(Date.now() - 86_400_000)).iso;
  const v1 = await T.altbestandAbleiten({ ab, anwenden: false, wer: "Prüfung" });
  const z13 = v1.zeilen.find((z) => z.anfrageId === A13);
  ok(!!z13 && z13.firma?.nachher === "wiedervorlage" && z13.auftragSchliessen && z13.nachher === "in_arbeit", "Vorschau: Firma „termin“ ohne Termin → Wiedervorlage, Auftrag schließen, Anfrage „in Arbeit“");
  const [f13a] = (await sql`SELECT status FROM fiaon_firmen_leads WHERE id = ${F13}`) as any[];
  gleich(f13a?.status, "termin", "Vorschau ändert nichts");
  const v2 = await T.altbestandAbleiten({ ab, anwenden: true, wer: "Prüfung" });
  ok(v2.geaendert >= 1, "Anwenden: geändert");
  const [f13b] = (await sql`SELECT status FROM fiaon_firmen_leads WHERE id = ${F13}`) as any[];
  const [an13] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A13}`) as any[];
  ok(f13b?.status === "wiedervorlage" && an13?.status === "in_arbeit" && (await auftrag(A13))?.status === "erledigt", "Firma, Anfrage und Auftrag zeigen jetzt dasselbe");
  const v3 = await T.altbestandAbleiten({ ab, anwenden: false, wer: "Prüfung" });
  ok(!v3.zeilen.some((z) => z.anfrageId === A13), "zweite Vorschau: nichts mehr zu tun");

  abschnitt("B7b Nachbesserung — Zählbeginn, zweiter Eingang, getrennte Schalter, Absage, /justin-Termin, Sammel-Erinnerung");
  // Zählbeginn fehlt (Gutachten Technik, Mangel 3): der erste Lead nach dem Deploy bekommt seine T1 — er ist nie „Altbestand“.
  await loesche("lead_takt_ab");
  const Z0 = await anfrage(15);
  gleich((await T.t1Senden(Z0)).ergebnis, "gesendet", "ohne Zählbeginn: der erste Lead bekommt seine T1");
  const [abNeu] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'lead_takt_ab'`) as any[];
  const [ein15] = (await sql`SELECT created_at FROM fiaon_anfragen WHERE id = ${Z0}`) as any[];
  ok(Date.parse(String(abNeu?.value)) <= new Date(ein15.created_at).getTime(), "… und der Zählbeginn liegt vor seinem Eingang");
  // Zweiter Eingang desselben Leads (Gutachten Betreiber, Mangel 6): keine zweite Meldung, der zweite Auftrag schließt sich,
  // ein Nachtrag im Faden der ersten Meldung.
  const Z1 = await anfrage(16);
  gleich((await T.t1Senden(Z1)).ergebnis, "gesendet", "erster Eingang: T1");
  const [tz1] = (await sql`SELECT t1_id FROM fiaon_lead_takt WHERE anfrage_id = ${Z1}`) as any[];
  const Z2 = await anfrage(16);
  gesendet.length = 0;
  const rz2 = await T.t1Senden(Z2);
  ok(rz2.ergebnis === "nicht_noetig" && /zweiter Eingang/.test(String(rz2.grund)), `zweiter Eingang derselben Mail: keine zweite T1 (${rz2.ergebnis})`);
  ok((await auftrag(Z2))?.status === "erledigt" && (await auftrag(Z1))?.status !== "erledigt", "der zweite Auftrag ist zu, der erste bleibt offen (ein Anruf genügt)");
  ok(gesendet.length === 1 && gesendet[0]?.an === MELDE && /^ZWEITER EINGANG/.test(String(gesendet[0]?.text)) && gesendet[0]?.kopfzeilen?.["In-Reply-To"] === tz1?.t1_id, "ein Nachtrag im Faden der ersten Lead-Meldung");
  // Getrennte Schalter: „Erinnerungen“ AUS hält die Lead-Meldung nicht an — aber die Leiter.
  await setze("lead_takt_an", "0");
  const S1 = await anfrage(17);
  gleich((await T.t1Senden(S1)).ergebnis, "gesendet", "„Erinnerungen“ AUS: die Lead-Meldung geht trotzdem");
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${S1}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${S1}`;
  await nur(S1);
  gleich(await T.eskalationenPruefen(tagUm(16)), 0, "… aber keine Erinnerung");
  await loesche("lead_takt_an");
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(16)), 1, "Schalter wieder EIN: die Erinnerung kommt");
  // Schriftliche Absage (Gutachten Lead-Sicht): keine Erinnerung, keine Zeile an Justin, kein Zusage-Wächter.
  const X1 = await anfrage(18);
  await T.t1Senden(X1);
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${X1}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5}, abgesagt_am = NOW() WHERE anfrage_id = ${X1}`;
  await nur(X1);
  gesendet.length = 0;
  const nX = (await T.eskalationenPruefen(tagUm(16))) + (await T.eskalationenPruefen(tagUm(61))) + (await T.eskalationenPruefen(tagUm(125)));
  ok(nX === 0 && gesendet.length === 0, "schriftlich abgesagt: keine Erinnerung, keine Zeile an Justin, kein Zusage-Wächter");
  // /justin-Buchung über eine eigene Person (Gutachten Betreiber, Mangel 1): über die Mail erkannt — keine Erinnerung.
  const J1 = await anfrage(19);
  await T.t1Senden(J1);
  await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${J1}`;
  await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${J1}`;
  const [pj] = (await sql`INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email) VALUES (${`LT-${LAUF}-J`}, 'privat', 'Lt', 'Person19', ${mail(19)}) RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, quelle, herkunft, status) VALUES (${Number(pj.id)}, ${KAL}, NOW() + INTERVAL '2 days', 'gruender', 'gruender', 'gebucht')`;
  const lj = await T.taktLageLesen(J1);
  ok(!!lj?.terminGebucht, "/justin-Termin einer eigenen Person (ohne person_id an Anfrage und Firma): über die Mail erkannt");
  await nur(J1);
  gleich(await T.eskalationenPruefen(tagUm(16)), 0, "… keine Erinnerung");
  // Zwei Leads zugleich fällig: EINE Sammel-Mail an die Meldeadresse (Gutachten Betreiber, Mangel 4).
  const G1 = await anfrage(20), G2 = await anfrage(21);
  for (const id of [G1, G2]) {
    await T.t1Senden(id);
    await sql`UPDATE fiaon_anfragen SET created_at = ${ein5} WHERE id = ${id}`;
    await sql`UPDATE fiaon_lead_takt SET eingang_am = ${ein5} WHERE anfrage_id = ${id}`;
  }
  await sql`UPDATE fiaon_lead_takt SET e15_am = COALESCE(e15_am, NOW()), e60_am = COALESCE(e60_am, NOW()), e120_am = COALESCE(e120_am, NOW()) WHERE anfrage_id <> ALL(${[G1, G2]})`;
  gesendet.length = 0;
  gleich(await T.eskalationenPruefen(tagUm(15)), 1, "zwei Leads seit 15 Minuten: EINE Mail");
  ok(gesendet[0]?.an === MELDE && /^2 LEADS WARTEN/.test(String(gesendet[0]?.text)) && new RegExp(`Logistik ${LAUF} 20 GmbH`).test(String(gesendet[0]?.text)) && new RegExp(`Logistik ${LAUF} 21 GmbH`).test(String(gesendet[0]?.text)), "… gebündelt an die Meldeadresse, beide Leads darin");
  await setze("lead_takt_ab", new Date(Date.now() - 3_600_000).toISOString());

  abschnitt("B8 Chefbüro › Rückholung: „Lead-Meldungen an“ (nur @fiaon.com)");
  {
    const CR = (await import("../server/routes/fiaon-chef-rueckholung")).default as any;
    const h = CR.stack.find((l: any) => l.route?.path === "/chef/rueckholung/einstellung" && l.route.methods.post)?.route.stack.at(-1).handle;
    const setz = async (value: string) => { const a: any = { status: 200, json: null }; const res: any = { status(c: number) { a.status = c; return res; }, json(j: any) { a.json = j; return res; } }; await h({ body: { key: "global_lead_meldung_an", value } }, res); return a; };
    const privat = await setz("lt-privat@gmail.example");
    ok(privat.status === 400 && /@fiaon\.com/.test(String(privat.json?.error)), "private Adresse → abgelehnt");
    const firma = await setz(`Lt-${LAUF}-B@FIAON.com`);
    const [s1] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'global_lead_meldung_an'`) as any[];
    ok(firma.json?.ok === true && s1?.value === `lt-${LAUF}-b@fiaon.com`, "Firmenadresse → gespeichert (klein geschrieben)");
    const leer = await setz("");
    const [s2] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'global_lead_meldung_an'`) as any[];
    ok(leer.json?.ok === true && !s2, "leer → Vorgabe (Zeile gelöscht)");
  }

  abschnitt("B9 E-490 Lead-Kette in echt: Mail je Fall (F2), Termin 60 Tage zurück (F4), Merker als JSON");
  {
    // Abschotten: alle bisherigen Prüf-Anfragen dieses Laufs zählen nicht mehr (Wegwerf-Kopie).
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE LOWER(COALESCE(email, '')) LIKE ${`%@${DOM}`}`;
    const { alarmVorbei } = await import("../server/lib/fiaon-system-alarme");
    for (const k of ["lead-takt:w-luecke", "lead-takt:n-luecke", "lead-takt:wa-luecke"]) { await alarmVorbei(k, "Prüfstand: Neubeginn"); await loesche(`lead_kette_mail:${k}`); }
    await setze("lead_global_willkommen_an", "1");
    await setze("lead_global_nachfass_an", "0");
    await setze("lead_global_mails_ab", new Date(Date.now() - 3 * 3_600_000).toISOString());
    const ketteMails = () => gesendet.filter((g) => /^Lead-Kette rot/.test(String(g.betreff ?? "")));
    const wach = () => T.leadWaechterPruefen({ immer: true });
    const merkerW = async () => R.ketteMerkerLesen(((await sql`SELECT value FROM fiaon_settings WHERE key = 'lead_kette_mail:lead-takt:w-luecke'`) as any[])[0]?.value);
    gesendet.length = 0;
    const X1 = await anfrage(41, "Prüfanfrage F2 — erster Fall");
    await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '45 minutes' WHERE id = ${X1}`;
    await wach();
    const k1 = ketteMails();
    ok(k1.length === 1 && new RegExp(`#${X1}`).test(String(k1[0]?.betreff)), `W rot: genau EINE Mail an Justin mit der Anfrage (${k1.map((g) => g.betreff).join(" | ")})`);
    const mw1 = await merkerW();
    ok(!!mw1.am && (mw1.gemailt ?? []).includes(X1), "der Merker ist JSON: Zeit der Mail und die gemailte Anfrage");
    await wach();
    ok(ketteMails().length === 1, "zweiter Wächterlauf, derselbe Fall → keine zweite Mail");
    const X2 = await anfrage(42, "Prüfanfrage F2 — neuer Fall bei offenem Alarm");
    await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '40 minutes' WHERE id = ${X2}`;
    await wach();
    const k2 = ketteMails();
    ok(k2.length === 2 && new RegExp(`#${X2}`).test(String(k2[1]?.betreff)), `ein NEUER Fall bei offenem Alarm → sofort eine zweite Mail (vorher erst nach 4 Stunden): ${k2.at(-1)?.betreff ?? "keine"}`);
    const [aw] = (await sql`SELECT episoden, vorbei_am FROM fiaon_system_alarme WHERE schluessel = 'lead-takt:w-luecke'`) as any[];
    ok(!aw?.vorbei_am, "… in derselben, offenen Episode des Alarms");
    await wach();
    ok(ketteMails().length === 2, "und danach wieder Ruhe (höchstens alle 4 Stunden für dieselben Fälle)");
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id IN (${X1}, ${X2})`;
    await wach();
    const [aw2] = (await sql`SELECT vorbei_am FROM fiaon_system_alarme WHERE schluessel = 'lead-takt:w-luecke'`) as any[];
    ok(!!aw2?.vorbei_am && R.ketteMerkerText(await merkerW()) === "", "alles gelöst → Alarm aus, Merker leer");
    await setze("lead_global_willkommen_an", "0");

    // F4: ein altes Ja (20 Tage) mit einem KOMMENDEN Termin ohne Terminnachricht fällt jetzt auf.
    const MB = await import("../server/lib/fiaon-mara-business");
    await MB.mbSchema();
    const Y = await anfrage(43, "Prüfanfrage F4 — altes Ja, Termin kommt");
    await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '20 days', ist_test = FALSE WHERE id = ${Y}`;
    const [ya] = (await sql`SELECT telefon, land, ip, email FROM fiaon_anfragen WHERE id = ${Y}`) as any[];
    const yNummer = MB.nummerDerAnfrage(ya);
    ok(!!yNummer, "die Prüfanfrage hat eine WhatsApp-Nummer (Handy)");
    await sql`INSERT INTO fiaon_wa_global (nummer, anfrage_id, optin_am, optin_quelle) VALUES (${yNummer}, ${Y}, NOW() - INTERVAL '20 days', 'website') ON CONFLICT (nummer) DO UPDATE SET anfrage_id = EXCLUDED.anfrage_id, optin_am = EXCLUDED.optin_am, optin_quelle = EXCLUDED.optin_quelle`;
    const [yp] = (await sql`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, company_name, contact_name, primary_email, primary_phone)
      VALUES (${`PRUEF-E490-${LAUF}-43`}, 'business', 'Lt', 'Person43', ${`Lt Logistik ${LAUF} 43 GmbH`}, 'Lt Person43', ${String(ya.email)}, ${String(ya.telefon)})
      RETURNING id`) as any[];
    const [yt] = (await sql`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, herkunft, storno_token, created_at, updated_at)
      VALUES (${Number(yp.id)}, ${KAL}, NOW() + INTERVAL '3 days', 30, 'gebucht', 'global', 'global_seite', ${randomBytes(24).toString("hex")}, NOW() - INTERVAL '26 hours', NOW() - INTERVAL '26 hours')
      RETURNING id`) as any[];
    const kette = async () => (await T.leadKetteLesen(new Date())).find((a) => a.schluessel === "lead-takt:wa-luecke");
    const wa1 = await kette();
    ok(!!wa1 && wa1.stufe === "rot" && wa1.faelle.includes(Y) && new RegExp(`Anfrage #${Y} \\(Ja: website\\): Termin steht, aber keine Terminnachricht`).test(wa1.text),
      `Ja vor 20 Tagen + kommender Termin ohne Terminnachricht → rot (vorher sah der Wächter nur 3 Tage zurück): ${wa1?.stufe} ${wa1?.faelle.join(",")}`);
    await sql`UPDATE fiaon_wa_global SET termin_gemeldet_id = ${Number(yt.id)} WHERE nummer = ${yNummer}`;
    ok(!(await kette())?.faelle.includes(Y), "die Terminnachricht zu GENAU diesem Termin ist verbucht → kein Fall mehr");
    await sql`UPDATE fiaon_wa_global SET termin_gemeldet_id = NULL WHERE nummer = ${yNummer}`;
    await sql`UPDATE fiaon_termine SET created_at = NOW() - INTERVAL '5 minutes' WHERE id = ${Number(yt.id)}`;
    ok(!(await kette())?.faelle.includes(Y), "eben erst gebucht → noch kein Fall (die 30 Fensterminuten zählen ab der Buchung)");
    await sql`UPDATE fiaon_termine SET created_at = NOW() - INTERVAL '26 hours', beginn = NOW() - INTERVAL '2 days', status = 'erledigt' WHERE id = ${Number(yt.id)}`;
    ok(!(await kette())?.faelle.includes(Y), "Gespräch schon vorbei → nichts (keine neue Regel „altes Ja ohne WhatsApp“)");
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id = ${Y}`;
  }

  abschnitt("B10 E-490 Nachbesserung (Gutachten): Versand scheitert/wirft → Merker zurück; rot → gelb → rot; nur bestätigte Fälle; echter Meta-Eingang");
  {
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE LOWER(COALESCE(email, '')) LIKE ${`%@${DOM}`}`;
    const { alarmVorbei } = await import("../server/lib/fiaon-system-alarme");
    const WK = "lead-takt:w-luecke", WAK = "lead-takt:wa-luecke";
    for (const k of [WK, "lead-takt:n-luecke", WAK]) { await alarmVorbei(k, "Prüfstand: Neubeginn"); await loesche(`lead_kette_mail:${k}`); }
    const vorherMb = ((await sql`SELECT value FROM fiaon_settings WHERE key = 'mara_business_an'`) as any[])[0]?.value ?? null;
    const vorherAb = ((await sql`SELECT value FROM fiaon_settings WHERE key = 'wa_global_ab'`) as any[])[0]?.value ?? null;
    await setze("lead_global_willkommen_an", "1");
    await setze("lead_global_nachfass_an", "0");
    await setze("lead_global_mails_ab", new Date(Date.now() - 3 * 3_600_000).toISOString());
    const ketteMails = () => gesendet.filter((g) => /^Lead-Kette rot/.test(String(g.betreff ?? "")));
    const wach = () => T.leadWaechterPruefen({ immer: true });
    const merker = async (k: string) => R.ketteMerkerLesen(((await sql`SELECT value FROM fiaon_settings WHERE key = ${`lead_kette_mail:${k}`}`) as any[])[0]?.value);

    // (1) Der Versand meldet {ok:false} → „am“ und „gemailt“ bleiben, der nächste Lauf mailt den Fall (Rotprobe M19).
    gesendet.length = 0;
    const V1 = await anfrage(51, "Prüfanfrage Nachbesserung — Versand scheitert");
    await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '45 minutes' WHERE id = ${V1}`;
    versandFehler = true;
    await wach();
    const m1 = await merker(WK);
    ok(ketteMails().length === 1 && !m1.am && !(m1.gemailt ?? []).includes(V1), `Versand scheitert ({ok:false}) → Zeit und „gemailt“ bleiben leer (${R.ketteMerkerText(m1) || "leer"})`);
    versandFehler = false;
    await wach();
    const m2 = await merker(WK);
    ok(ketteMails().length === 2 && !!m2.am && (m2.gemailt ?? []).includes(V1) && new RegExp(`NEU #${V1}\\b`).test(String(ketteMails()[1]?.betreff)),
      `… der nächste Lauf mailt den Fall, NEU im Betreff (${String(ketteMails()[1]?.betreff ?? "keine Mail")})`);
    // (2) Der Versand WIRFT → genauso zurück (vorher galt der Fall dann als gemailt, und es blieb bis zu 4 Stunden still).
    const V2 = await anfrage(52, "Prüfanfrage Nachbesserung — Versand wirft");
    await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '40 minutes' WHERE id = ${V2}`;
    T.leadTaktVersandSetzen(async () => { throw new Error("Prüf-Ausnahme"); });
    await wach();
    const m3 = await merker(WK);
    ok(!(m3.gemailt ?? []).includes(V2) && m3.am?.getTime() === m2.am?.getTime(), "Versand wirft eine Ausnahme → Merker zurück (Zeit wie vorher, der neue Fall nicht gemailt)");
    T.leadTaktVersandSetzen(attrappe);
    const vorM4 = ketteMails().length;
    await wach();
    const neuM4 = ketteMails().slice(vorM4);
    ok(neuM4.length === 1 && new RegExp(`NEU #${V2}\\b`).test(String(neuM4[0]?.betreff)) && new RegExp(`Anfrage #${V1}\\b`).test(String(neuM4[0]?.text)),
      `… danach kommt er: NEU #${V2}, der bekannte Fall steht dabei (${String(neuM4[0]?.betreff ?? "keine Mail")})`);
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id IN (${V1}, ${V2})`;
    await wach();
    await setze("lead_global_willkommen_an", "0");

    // (3) WhatsApp rot → gelb (Takt aus) → rot: auch der gelbe Lauf geht an den Plan — die Zeit beginnt neu (Rotprobe M2).
    const MB = await import("../server/lib/fiaon-mara-business");
    await MB.mbSchema();
    const waFall = async (n: number) => {
      const A = await anfrage(n, `Prüfanfrage Nachbesserung — WhatsApp-Fall ${n}`);
      await sql`UPDATE fiaon_anfragen SET created_at = NOW() - INTERVAL '20 days', ist_test = FALSE WHERE id = ${A}`;
      const [aa] = (await sql`SELECT telefon, land, ip, email FROM fiaon_anfragen WHERE id = ${A}`) as any[];
      const nr = MB.nummerDerAnfrage(aa);
      await sql`INSERT INTO fiaon_wa_global (nummer, anfrage_id, optin_am, optin_quelle) VALUES (${nr}, ${A}, NOW() - INTERVAL '20 days', 'website')
                ON CONFLICT (nummer) DO UPDATE SET anfrage_id = EXCLUDED.anfrage_id, optin_am = EXCLUDED.optin_am, optin_quelle = EXCLUDED.optin_quelle`;
      const [pp] = (await sql`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, company_name, contact_name, primary_email, primary_phone)
        VALUES (${`PRUEF-E490N-${LAUF}-${n}`}, 'business', 'Lt', ${`Person${n}`}, ${`Lt Logistik ${LAUF} ${n} GmbH`}, ${`Lt Person${n}`}, ${String(aa.email)}, ${String(aa.telefon)})
        RETURNING id`) as any[];
      const [tt] = (await sql`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, herkunft, storno_token, created_at, updated_at)
        VALUES (${Number(pp.id)}, ${KAL}, NOW() + INTERVAL '4 days' + ${n} * INTERVAL '1 hour', 30, 'gebucht', 'global', 'global_seite', ${randomBytes(24).toString("hex")}, NOW() - INTERVAL '26 hours', NOW() - INTERVAL '26 hours')
        RETURNING id`) as any[];
      return { anfrageId: A, nummer: String(nr), terminId: Number(tt.id) };
    };
    const Z = await waFall(61);
    gesendet.length = 0;
    await wach();
    const z1 = (await merker(WAK)).rotSeit[String(Z.anfrageId)];
    ok(!!z1 && ketteMails().length === 0, `WhatsApp rot: der Fall steht mit seiner Zeit im Merker — noch unbestätigt, keine Mail (${z1 ?? "fehlt"})`);
    await setze("mara_business_an", "0");
    await wach();
    const [awa] = (await sql`SELECT stufe, vorbei_am FROM fiaon_system_alarme WHERE schluessel = ${WAK}`) as any[];
    ok(awa?.stufe === "gelb" && !awa?.vorbei_am && !(await merker(WAK)).rotSeit[String(Z.anfrageId)], "Takt aus → der Alarm ist gelb (offen) — der gelbe Lauf leert rotSeit");
    await warte(30);
    if (vorherMb === null) await loesche("mara_business_an"); else await setze("mara_business_an", String(vorherMb));
    await wach();
    const z3 = (await merker(WAK)).rotSeit[String(Z.anfrageId)];
    ok(!!z3 && Date.parse(z3) > Date.parse(String(z1)) && ketteMails().length === 0, "wieder rot → die Zeit beginnt NEU (die Unterbrechung zählt) — und noch keine Mail");

    // (4) In die Mail kommen nur BESTÄTIGTE WhatsApp-Fälle: Z gilt als seit 20 Minuten rot, Z2 ist eben erst rot.
    const Z2 = await waFall(62);
    await setze(`lead_kette_mail:${WAK}`, JSON.stringify({ am: null, gemailt: [], rotSeit: { [String(Z.anfrageId)]: new Date(Date.now() - 20 * 60_000).toISOString() } }));
    gesendet.length = 0;
    await wach();
    const wm = ketteMails();
    const wmText = `${String(wm[0]?.betreff ?? "")}\n${String(wm[0]?.text ?? "")}`;
    ok(wm.length === 1 && new RegExp(`NEU #${Z.anfrageId}\\b`).test(String(wm[0]?.betreff)) && !new RegExp(`#${Z2.anfrageId}\\b`).test(wmText) && /Dazu ein weiterer WhatsApp-Fall/.test(wmText),
      `Mail nur mit dem bestätigten Fall (NEU #${Z.anfrageId}); der eben rote steht nur als Zahl darin (${String(wm[0]?.betreff ?? "keine Mail")})`);
    const mw = await merker(WAK);
    ok((mw.gemailt ?? []).includes(Z.anfrageId) && !(mw.gemailt ?? []).includes(Z2.anfrageId), "„gemailt“: nur der bestätigte Fall");

    // (5) F4 (Gutachten): eine alte Begrüßung vor der Buchung verdeckt die fehlende Terminnachricht nicht mehr.
    await sql`INSERT INTO fiaon_whatsapp (nummer, richtung, status, text, created_at) VALUES (${Z2.nummer}, 'raus', 'gesendet', 'Prüfstand: alte Begrüßung', NOW() - INTERVAL '15 days')`;
    const waNach = (await T.leadKetteLesen(new Date())).find((a) => a.schluessel === WAK);
    ok(!!waNach?.faelle.includes(Z2.anfrageId), "eine WhatsApp VOR der Buchung (alte Begrüßung) zählt beim kommenden Termin nicht als Kontakt → weiter rot");
    await sql`INSERT INTO fiaon_whatsapp (nummer, richtung, status, text, created_at) VALUES (${Z2.nummer}, 'raus', 'gesendet', 'Prüfstand: nach der Buchung', NOW() - INTERVAL '2 hours')`;
    ok(!(await T.leadKetteLesen(new Date())).find((a) => a.schluessel === WAK)?.faelle.includes(Z2.anfrageId), "… eine WhatsApp NACH der Buchung zählt → kein Fall mehr");
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id IN (${Z.anfrageId}, ${Z2.anfrageId})`;

    // (6) Der ECHTE Eingang bei Meta: ein alter Lead (Rückstand, 10 Tage bei Meta) ist kein frischer Lead — keine WhatsApp-
    //     Erwartung im Wächter (wie im Takt), keine T1 an Daniel. Ein frischer Meta-Lead bleibt, wie er war.
    const { META_FASSUNG2_NAMEN } = await import("../shared/fiaon-lead-weg");
    const formF2 = `PRUEFF2${LAUF}`;
    await sql`INSERT INTO fiaon_meta_formulare (id, name, status, geladen_am) VALUES (${formF2}, ${META_FASSUNG2_NAMEN.us}, 'ACTIVE', NOW()) ON CONFLICT (id) DO NOTHING`;
    await setze("wa_global_ab", new Date(Date.now() - 30 * 86_400_000).toISOString());
    const metaFall = async (n: number, metaVorTagen: number, anlegenVorStunden: number) => {
      const A = await anfrage(n, `Prüfanfrage Nachbesserung — Meta-Lead ${n}`);
      await sql`UPDATE fiaon_anfragen SET created_at = NOW() - ${`${anlegenVorStunden} hours`}::interval, ip = 'meta-sofortformular' WHERE id = ${A}`;
      await sql`INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg, global_anfrage_id)
                VALUES (${`PRUEFML${LAUF}${n}`}, NULL, ${formF2}, NOW() - ${`${metaVorTagen} days`}::interval, ${metaVorTagen > 3 ? "meta_rueckstand" : "meta_nachhol"}, ${A})`;
      return A;
    };
    const Malt = await metaFall(71, 10, 26), Mfrisch = await metaFall(72, 1, 26);
    const waM = (await T.leadKetteLesen(new Date())).find((a) => a.schluessel === WAK);
    ok(!!waM?.faelle.includes(Mfrisch) && !waM?.faelle.includes(Malt),
      `Wächter: der frische Meta-Lead (Fassung 2, ohne Begrüßung) ist rot, der alte Rückstand-Lead (10 Tage bei Meta) erwartet keine WhatsApp — wie der Takt (${waM?.faelle.join(",")})`);
    const takt = lies("server/lib/fiaon-mara-business.ts").split("export async function waGlobalTakt(")[1] ?? "";
    ok(/LEFT JOIN LATERAL \(SELECT MIN\(m\.erstellt_am\) AS erstellt FROM fiaon_meta_leads m WHERE m\.global_anfrage_id = a\.id\) me ON TRUE/.test(takt)
      && /LEAST\(a\.created_at, COALESCE\(me\.erstellt, a\.created_at\)\) > NOW\(\) - INTERVAL '3 days'/.test(takt), "Takt (Begrüßung): „drei Tage“ zählen ab dem echten Eingang bei Meta");
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id IN (${Malt}, ${Mfrisch})`;
    const Talt = await metaFall(73, 10, 0), Tfrisch = await metaFall(74, 0, 0);
    gesendet.length = 0;
    const t1alt = await T.t1Senden(Talt);
    const [tka] = (await sql`SELECT t1_status, t1_grund FROM fiaon_lead_takt WHERE anfrage_id = ${Talt}`) as any[];
    ok(t1alt.ergebnis === "nicht_noetig" && /Meta-Lead vom .* älter als 3 Tage/.test(String(t1alt.grund)) && tka?.t1_status === "nicht_noetig" && gesendet.length === 0,
      `T1: ein Meta-Lead, der bei Meta 10 Tage alt ist → keine Meldung, „nicht nötig“ gemerkt (auch die Erinnerungsleiter lässt ihn aus): ${t1alt.grund}`);
    const t1frisch = await T.t1Senden(Tfrisch);
    ok(t1frisch.ergebnis === "gesendet", `T1: ein frischer Meta-Lead bekommt seine Meldung wie bisher (${t1frisch.ergebnis} ${t1frisch.grund ?? ""})`);
    const Tmit = await anfrage(75, "Prüfanfrage Nachbesserung — echter Eingang mitgegeben");
    const t1mit = await T.t1Senden(Tmit, { echterEingang: new Date(Date.now() - 9 * 86_400_000).toISOString() });
    ok(t1mit.ergebnis === "nicht_noetig" && /älter als 3 Tage/.test(String(t1mit.grund)), "T1: der vom Eingang mitgegebene echte Eingang zählt (der Anstoß läuft, bevor fiaon_meta_leads die Anfrage kennt)");
    await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id IN (${Talt}, ${Tfrisch}, ${Tmit})`;
    if (vorherAb === null) await loesche("wa_global_ab"); else await setze("wa_global_ab", String(vorherAb));
  }

  T.leadTaktVersandSetzen(null); LW.leadWegVersandSetzen(null); D.dossierVersandSetzen(null);
  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
