// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND TELEFONKARTEI (21.09.2026, E-201) — ohne Netz, ohne Datenbank
//
// Prüft, worauf sich Justins Anrufseite verlässt: die Texte der vier Fälle
// (Wortwand, keine IBAN in Mails, „als Ziel", „in der Regel", richtige Anlässe),
// die Kontaktkarte fürs iPhone, die Kalenderdatei für Rückrufe — und im
// Quelltext: jede Route hinter der Inhaber-Wache, Justin nie als Betreuer
// (agent_id NULL), Storno über die Kündigungsregel, JSONB nur über
// sqlPool.json(), die Stufen des Hauses statt einer eigenen Einstufung.
// E-259 (29.09.2026): WhatsApp nur noch über das FIAON-Konto bei Meta (Vorlage je
// Fall, kein wa.me) und die neue Reihung (Anrufversuche) — hier die Regeln ohne
// Datenbank, der Weg mit Datenbank in scripts/pruef-telefonkartei-meta.ts.
//
//   npx tsx scripts/pruef-telefonkartei.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  whatsappNichtErreicht, whatsappAntrag, mailRechnung, mailNichtErreicht, mailAntrag,
  limitZiel, anlass, pitchAbsatz, hatRechnungsweg, hatAntragsweg, euro, euroGanz, datumKurz,
  KARTEI_GRUPPEN, istKarteiGruppe, istKarteiErgebnis, ohneEmojis, type KarteiKarte,
  karteiWaVorlage, KARTEI_WA_VORLAGE, KARTEI_WA_ENTWURF, versucheText, vorlagenBetrag, NICHT_ERREICHT_HINWEIS,
} from "../shared/fiaon-telefonkartei";
import { linkPruefung } from "../shared/fiaon-mara-ton";
import { WA_VORLAGEN } from "../shared/fiaon-lead-texte";
import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } from "../shared/fiaon-karten-weg";
import { BANK } from "../shared/fiaon-bank";
import { boniAmpel } from "../shared/fiaon-boni-ampel";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { kundenstatus, KUNDENSTATUS } from "../shared/fiaon-kundenstatus";

// Die Datenbank-Anbindung verlangt beim Laden eine Adresse — abgefragt wird hier nie („ins Leere").
process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
const { vcardText, vcardDateiname } = await import("../server/lib/fiaon-telefonkartei");

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

const basis: KarteiKarte = {
  personId: 4711, vorname: "Max", nachname: "Mustermann", name: "Max Mustermann", lage: "B",
  stand: "Antrag fertig — Rechnung offen", ereignisAm: new Date().toISOString(),
  telefonAnzeige: "+49 171 1234567", telefonWaehlbar: "+491711234567", telefonHinweis: null,
  email: "max@example.org", ort: "Berlin",
  paket: { key: "pro", label: "FIAON Pro (Standard)", preisCents: 5999 },
  wunschlimitEuro: 5000, rahmenEuro: 5000,
  zahlung: {
    art: "bestellung", referenz: "FIAON-ABC234", betragCents: 5999, rateNr: null, faelligAm: "2026-09-28",
    zahlungsseite: "https://www.fiaon.com/zahlung/FIAON-ABC234",
    rechnungLink: "https://www.fiaon.com/api/fiaon/invoice/FIAON-ABC234.pdf?exp=1&sig=abc", nochKeineRechnung: false,
  },
  ref: "FIAON-ABC234", leadId: null, lead: null, betreuer: "Nikita Boychenko",
  kontakt: { am: null, von: null, ergebnis: null, nichtErreicht: 0, versuche: 0, fehlInFolge: 0, letzterVersuch: null }, termin: null, erreichbarkeit: "",
  zusage: null, gesperrt: false, werbungGesperrt: false, stopp: false, testfall: false,
  terminLink: "https://www.fiaon.com/justin?k=4711.123.abc", akteId: "FIAON-ABC234", akteLink: "/chef/s/akte?id=FIAON-ABC234",
  storno: null, rueckrufAm: null, anrede: null,
  ampel: boniAmpel({
    strasse: true, plz: true, ort: true, land: "DE", wohnform: "Zur Miete", beschaeftigung: "Angestellt", beschaeftigtSeit: "2019-03",
    einkommenEuro: 2400, zusatzEinkommenEuro: null, mieteEuro: 700, ausgabenEuro: 400, schuldenEuro: 0, konto: null, schufa: null,
  }),
};
const karte = (teil: Partial<KarteiKarte>): KarteiKarte => ({ ...basis, ...teil });
const ABSENDER = "Justin Schwarzott";
/** Intl setzt zwischen Betrag und € ein geschütztes Leerzeichen — gewollt, für die Prüfung normalisiert. */
const flach = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
/** Harte Treffer der Wand. E-259: WhatsApp trägt keine Bankdaten mehr (Vorlage mit Knopf zur Zahlungsseite). */
const hart = (text: string, ausgefuehrt: string[] = []) =>
  wandPruefen(text, ausgefuehrt).filter((f) => f.art === "verboten" || f.art === "zusage");
const vorlageText = (name: string) => WA_VORLAGEN.find((v) => v.name === name)?.text ?? "";

abschnitt("Fall 1 — Rechnung (erste Zahlung)");
{
  // E-259: WhatsApp = freigegebene Vorlage fiaon_kk_rechnung über das FIAON-Konto, kein wa.me-Text mit IBAN mehr.
  const plan = karteiWaVorlage(basis, "rechnung", ABSENDER);
  ok(plan.art === "vorlage" && plan.vorlage === "fiaon_kk_rechnung", "Rechnung → Vorlage fiaon_kk_rechnung");
  ok(plan.art === "vorlage" && plan.werte.join("|") === "Max Mustermann|59,99|FIAON-ABC234", `Werte: Name, Betrag ohne €, Verwendungszweck (${plan.art === "vorlage" ? plan.werte.join("|") : "–"})`);
  ok(plan.art === "vorlage" && plan.knopfWert === "FIAON-ABC234" && !plan.unaufgefordert, "Knopf = Zahlungsseite dieser Referenz; vom Kunden erbeten (kein Tagesplatz)");
  const mitAnrede = karteiWaVorlage(karte({ anrede: "Herr" }), "rechnung", ABSENDER);
  ok(mitAnrede.art === "vorlage" && mitAnrede.werte[0] === "Herr Mustermann", "mit Anrede: {{1}} = „Herr Mustermann“");
  ok(vorlageText("fiaon_kk_rechnung").includes("{{2}} €") && vorlagenBetrag(5999) === "59,99" && vorlagenBetrag(0) === null, "Betrag wie in der Zentrale („59,99“, das € steht in der Vorlage)");
  const ohneBetrag = karteiWaVorlage(karte({ zahlung: { ...basis.zahlung!, betragCents: null } }), "rechnung", ABSENDER);
  ok(ohneBetrag.art === "keine" && /Betrag/.test(ohneBetrag.grund), "ohne Betrag keine Vorlage — nie ein Beispielwert beim Kunden");
  const m = mailRechnung(basis, ABSENDER)!;
  ok(m.text.includes("Ihr Wunschlimit von 5.000 € nehmen wir dabei als Ziel"), "Wunschlimit als ZIEL, nicht als Versprechen");
  ok(m.text.includes(KARTE_ZEIT_SATZ) && KARTE_ZEIT_SATZ.includes("Nach der Zusage der Bank") && KARTE_ZEIT_SATZ.includes("in der Regel in 2–5 Werktagen"), "Karte: „nach der Zusage der Bank, in der Regel 2–5 Werktage“ (eine Stelle, wie bei Mara)");
  ok(m.text.includes(KARTE_LINK_SATZ), "Link der Partnerbank direkt nach der Aktivierung");
  ok(!/ruft Sie .{0,30}an\b/i.test(m.text), "kein „ruft Sie an“ (Zusage ohne Rückruf)");
  ok(m.text.trim().endsWith("Viele Grüße\nJustin Schwarzott"), "Gruß mit Justins Namen");
  const ohneWunsch = mailRechnung(karte({ wunschlimitEuro: null }), ABSENDER)!;
  ok(!ohneWunsch.text.includes("Wunschlimit") && ohneWunsch.text.includes("aktiviere ich Ihr Konto."), "ohne Wunschlimit fällt der Halbsatz weg — keine erfundene Zahl");
  ok(limitZiel({ wunschlimitEuro: 25000, rahmenEuro: 5000 }) === 5000, "Wunsch über dem Paketrahmen → Rahmen");
  ok(limitZiel({ wunschlimitEuro: 3000, rahmenEuro: 5000 }) === 3000, "Wunsch unter dem Rahmen bleibt");
  ok(limitZiel({ wunschlimitEuro: 0, rahmenEuro: 5000 }) === null, "0 € ist kein Wunschlimit");
  ok(m.betreff.includes("Rechnung"), "Mail-Betreff nennt die Rechnung");
  ok(m.text.includes("Ihre Rechnung finden Sie im Anhang."), "Mail sagt: Rechnung im Anhang");
  ok(!/\bDE\d{2}[\s\d]{14,}/i.test(m.text) && !m.text.includes(BANK.bic), "keine Bankdaten im Mailtext (Wand: Zahlungsseite verlinken)");
  ok(m.text.includes("https://www.fiaon.com/zahlung/FIAON-ABC234") && m.text.includes("FIAON-ABC234"), "Mail: Zahlungsseite + Verwendungszweck");
  ok(hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).length === 0, `Mail besteht die Wortwand MIT Anhang: ${hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).map((f) => f.treffer).join(" | ")}`);
  ok(hart(`${m.betreff}\n${m.text}`).length > 0, "Gegenprobe: ohne Anhang hält die Wand „im Anhang“ auf");
  ok(m.text.includes(pitchAbsatz(basis)), "Mail trägt Justins Pitch");
}

abschnitt("Fall 1 — Rechnung (Monatsrate)");
{
  const rate = karte({
    lage: "rate", wunschlimitEuro: null,
    zahlung: { art: "rate", referenz: "FIAON-ABC234-2", betragCents: 5999, rateNr: 2, faelligAm: "2026-09-15", zahlungsseite: "https://www.fiaon.com/zahlung/FIAON-ABC234-2", rechnungLink: null, nochKeineRechnung: false },
  });
  const plan = karteiWaVorlage(rate, "rechnung", ABSENDER);
  ok(plan.art === "vorlage" && plan.vorlage === "fiaon_kk_rate", "Rate offen → Vorlage fiaon_kk_rate (nicht die Aktivierungs-Rechnung)");
  ok(plan.art === "vorlage" && plan.werte.join("|") === "Max Mustermann|59,99|15.09.2026|FIAON-ABC234-2", `Werte: voller Name, Betrag, Fälligkeit, Rate-Referenz (${plan.art === "vorlage" ? plan.werte.join("|") : "–"})`);
  ok(plan.art === "vorlage" && plan.knopfWert === "FIAON-ABC234-2", "Knopfwert = Referenz GENAU dieser Rate (waSenden verlangt sie)");
  const ohneName = karteiWaVorlage(karte({ ...rate, vorname: "", nachname: "", name: "Unbekannt #4711" }), "rechnung", ABSENDER);
  ok(ohneName.art === "keine", "Raten-Vorlage ohne Namen: keine („Hallo und willkommen“ an Bestandskunden gibt es nicht)");
  const m = mailRechnung(rate, ABSENDER)!;
  ok(m.betreff.includes("2. Monatsrate") && m.text.includes("Fällig: 15.09.2026"), "Mail zur Rate");
  ok(!m.text.includes("Kartenantrag") && !m.text.includes("aktiviere"), "kein Aktivierungs-Pitch bei einem laufenden Konto");
  ok(hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).length === 0, "Raten-Mail besteht die Wand");
}

abschnitt("Fall 3 — Nicht erreicht");
{
  const wa = whatsappNichtErreicht(basis, ABSENDER);
  ok(wa.includes("zu Ihrem Kreditkartenantrag bei FIAON anrufen") && wa.includes("heute oder morgen"), "Justins Satz, grammatisch rund");
  ok(wa.includes("https://www.fiaon.com/justin?k=4711.123.abc") && wa.includes("schon eingetragen"), "persönlicher Kalender, vorausgefüllt");
  ok(!/\p{Extended_Pictographic}/u.test(wa + whatsappAntrag(karte({ lage: "C", zahlung: null }), ABSENDER, "https://fiaon.com/a/Ab3dEf7hJk/w")), "Nicht erreicht und Antrag: keine Emojis");
  ok(ohneEmojis("Hallo 🙂 *Test* 👉 ok") === "Hallo Test ok", `ohneEmojis räumt Emojis und Sternchen ab (${ohneEmojis("Hallo 🙂 *Test* 👉 ok")})`);
  ok(whatsappNichtErreicht(karte({ lage: "C" }), ABSENDER).includes("zu Ihrer Anfrage bei FIAON"), "C-Lead: „Anfrage“ statt „Antrag“");
  ok(whatsappNichtErreicht(karte({ lage: "rate" }), ABSENDER).includes("zu Ihrem FIAON Konto"), "Rate offen: „FIAON Konto“");
  ok(anlass("A") === anlass("B") && anlass("B").includes("Kreditkartenantrag"), "A/B: Kreditkartenantrag");
  ok(hart(wa).length === 0, "WhatsApp besteht die Wand");
  // E-259: außerhalb des Fensters die Vorlage — für B/C/Abbrecher; A und Bestandskunden bekommen keine unpassende.
  const plan = karteiWaVorlage(basis, "nicht_erreicht", ABSENDER);
  ok(plan.art === "vorlage" && plan.vorlage === KARTEI_WA_VORLAGE.nicht_erreicht && plan.werte.join("|") === "Max Mustermann|Justin" && plan.unaufgefordert,
    "B: Vorlage fiaon_kk_nicht_erreicht [Name, „Justin“], unaufgefordert (Tagesplatz)");
  for (const lage of ["C", "abbrecher"] as const) {
    ok(karteiWaVorlage(karte({ lage }), "nicht_erreicht", ABSENDER).art === "vorlage", `${lage}: Nicht-erreicht-Vorlage`);
  }
  // Nachbesserung E-259: A hat die Zahlung schon gemeldet — „es fehlt nur noch Ihr Ja" stimmt nicht.
  const a = karteiWaVorlage(karte({ lage: "A" }), "nicht_erreicht", ABSENDER);
  ok(a.art === "keine" && a.grund.includes(KARTEI_WA_ENTWURF.kalender) && vorlageText(KARTEI_WA_VORLAGE.nicht_erreicht).includes("es fehlt nur noch Ihr Ja"),
    "A: keine Nicht-erreicht-Vorlage („es fehlt nur noch Ihr Ja“ stimmt nach der Zahlungsmeldung nicht)");
  const knopf = WA_VORLAGEN.find((v) => v.name === KARTEI_WA_VORLAGE.nicht_erreicht)?.knoepfe.find((x) => x.typ === "URL") as { url?: string } | undefined;
  ok(knopf?.url === "https://fiaon.com/termin" && /allgemeines Terminformular, nicht dein Kalender/.test(NICHT_ERREICHT_HINWEIS),
    "Der Knopf der Vorlage ist das allgemeine /termin — die Seite sagt das offen (NICHT_ERREICHT_HINWEIS)");
  const bestand = karteiWaVorlage(karte({ lage: "rate" }), "nicht_erreicht", ABSENDER);
  ok(bestand.art === "keine" && bestand.grund.includes(KARTEI_WA_ENTWURF.kalender), "Rate/Bezahlt: keine Vorlage („Anfrage“ passt nicht) — ehrlich mit dem Entwurf fiaon_kk_kalender");
  ok(karteiWaVorlage(karte({ lage: "bezahlt", zahlung: null }), "nicht_erreicht", ABSENDER).art === "keine", "Bezahlt: keine Vorlage");
  const m = mailNichtErreicht(basis, ABSENDER);
  ok(m.text.includes("habe Sie aber leider nicht erreicht") && m.text.includes(basis.terminLink), "Mail mit Kalenderlink");
  ok(hart(`${m.betreff}\n${m.text}`).length === 0, `Mail besteht die Wand: ${hart(`${m.betreff}\n${m.text}`).map((f) => f.treffer).join(" | ")}`);
  ok(!/r[üu]ckruf/i.test(`${m.betreff} ${m.text} ${wa}`), "kein „Rückruf“ in Kundentexten (Wand: Zusage)");
}

abschnitt("Fall 1 für Leads — Antrag");
{
  const lead = karte({ lage: "C", zahlung: null, ref: null, leadId: 99, paket: null });
  ok(hatAntragsweg(lead) && !hatRechnungsweg(lead), "C ohne Zahlung → Antrag, keine Rechnung");
  ok(hatRechnungsweg(basis) && !hatAntragsweg(basis), "B mit Zahlung → Rechnung");
  ok(!hatRechnungsweg(karte({ lage: "storniert" })), "Storniert → keine Rechnung");
  ok(karteiWaVorlage(lead, "rechnung", ABSENDER).art === "keine" && mailRechnung(lead, ABSENDER) === null, "ohne Zahlung keine Rechnung (weder Vorlage noch Mail)");
  // Nachbesserung E-259: immer SEIN Link (Hausregel E-248) — der Server baut ihn (antragLinkFuer).
  const wa = whatsappAntrag(lead, ABSENDER, "https://fiaon.com/a/Ab3dEf7hJk/w");
  ok(wa.includes("https://fiaon.com/a/Ab3dEf7hJk/w") && wa.includes("zwei Minuten"), "Antrags-Link in WhatsApp");
  ok(linkPruefung(wa).every((f) => f.art !== "nackt") && linkPruefung("https://www.fiaon.com/antrag").some((f) => f.art === "nackt"),
    "Persönlicher Link besteht die Link-Prüfung, der nackte /antrag nicht");
  const m = mailAntrag(lead, ABSENDER, "https://fiaon.com/a/Ab3dEf7hJk/m");
  ok(hart(`${m.betreff}\n${m.text}`).length === 0 && hart(wa).length === 0, "Antrags-Texte bestehen die Wand");
  const c = karteiWaVorlage(lead, "antrag", ABSENDER);
  ok(c.art === "keine" && c.grund.includes(KARTEI_WA_ENTWURF.antrag_link), "Lead C: keine freigegebene Vorlage mit Antrag-Link — ehrlich, Entwurf fiaon_kk_antrag_link");
  const ab = karteiWaVorlage(karte({ lage: "abbrecher", zahlung: null, ref: "FIAON-XYZ789" }), "antrag", ABSENDER);
  ok(ab.art === "vorlage" && ab.vorlage === "fiaon_kk_antrag_offen" && !ab.unaufgefordert, "Abbrecher: fiaon_kk_antrag_offen (Knopf an die Stelle, an der er aufgehört hat)");
  const rf = karteiWaVorlage(basis, "rueckfrage", ABSENDER);
  ok(rf.art === "vorlage" && rf.vorlage === "fiaon_kk_rueckfrage" && rf.werte.join("|") === "Max Mustermann|Justin" && rf.unaufgefordert, "Rückfrage: fiaon_kk_rueckfrage [Name, „Justin“], mit Tagesplatz");
  for (const name of Object.values(KARTEI_WA_VORLAGE)) ok(WA_VORLAGEN.some((v) => v.name === name), `Vorlage ${name} steht im Katalog`);
  for (const name of Object.values(KARTEI_WA_ENTWURF)) ok(!WA_VORLAGEN.some((v) => v.name === name), `Entwurf ${name} ist NICHT im Katalog (nicht eingereicht)`);
}

abschnitt("Formate, Gruppen, Versuche");
ok(versucheText(0) === "noch nie angerufen" && versucheText(1) === "1 Versuch" && versucheText(3) === "3 Versuche", "„3 Versuche“ an der Karte");
ok(KARTEI_GRUPPEN.every((g) => g.key === "storniert" || /10 Versuchen/.test(g.satz)), "Jeder Reiter sagt die Regel „ab 10 Versuchen ans Ende“");
ok(flach(euro(5999)) === "59,99 €" && euroGanz(25000) === "25.000 €" && datumKurz("2026-09-15T10:00:00Z") === "15.09.2026", "Zahlen- und Datumsformate");
ok(KARTEI_GRUPPEN.map((g) => g.key).join(",") === "alle,A,B,C,rate,storniert", "sechs Gruppen");
ok(istKarteiGruppe("A") && !istKarteiGruppe("D") && istKarteiErgebnis("rueckruf") && !istKarteiErgebnis("loeschen"), "Eingaben werden geprüft");

abschnitt("Kontaktkarte fürs iPhone");
{
  const v = vcardText(karte({ nachname: "Müller; Sohn", vorname: "Anna, Maria", name: "Anna, Maria Müller; Sohn" }));
  ok(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n") && v.endsWith("END:VCARD\r\n"), "vCard 3.0 mit CRLF");
  ok(v.includes("N:Müller\\; Sohn;Anna\\, Maria;;;(FIAON)"), "Namensfelder maskiert, Zusatz „(FIAON)“ im Suffix");
  ok(v.includes("TEL;TYPE=CELL,VOICE:+491711234567"), "Nummer wählbar (E.164)");
  ok(v.includes("ORG:FIAON Kunde") && v.includes("CATEGORIES:FIAON"), "als FIAON-Kontakt erkennbar");
  ok(/NOTE:FIAON · .*Wunschlimit: 5\.000 €/.test(v), "Notiz mit Stand und Wunschlimit");
  ok(!/\n(?!\r)/.test(v.replace(/\r\n/g, "")), "keine rohen Zeilenumbrüche in Feldern");
  ok(vcardDateiname(basis) === "Max-Mustermann-FIAON.vcf", `Dateiname ohne Sonderzeichen (${vcardDateiname(basis)})`);
}

abschnitt("Status für die Mitarbeiter");
ok(kundenstatus({ zahlungsstatus: "cancelled", hatBestellung: true }).text === "Storniert", "cancelled heißt jetzt „Storniert“ (vorher „Archiviert“)");
ok(kundenstatus({ zahlungsstatus: "refunded", hatBestellung: true }).schluessel === "archiviert", "erstattet bleibt archiviert");
ok(KUNDENSTATUS.storniert.hinweis.includes("nicht mehr anrufen"), "Hinweis für den Mitarbeiter");
ok(kundenstatus({ zahlungsstatus: "cancelled", hatBestellung: true, frist: "2020-01-01" }).etikett === null, "kein „Frist abgelaufen“ an einem Storno");

abschnitt("Wände im Quelltext");
{
  const routen = lies("server/routes/fiaon-telefonkartei.ts");
  const lib = lies("server/lib/fiaon-telefonkartei.ts");
  const aufrufe = routen.match(/router\.(get|post|put|patch|delete)\(/g) ?? [];
  const bewacht = routen.match(/router\.(get|post|put|patch|delete)\("[^"]+", wache,/g) ?? [];
  ok(aufrufe.length >= 9 && aufrufe.length === bewacht.length, `jede Route hinter der Wache (${bewacht.length}/${aufrufe.length})`);
  ok(routen.includes('const wache = requireChef("inhaber")'), "Wache = Stufe Inhaber (Justin: „für mich“)");
  ok(!/JSON\.stringify\([^)]*\)\s*}?\s*::jsonb/.test(lib), "JSONB nur über sqlPool.json()");
  ok((lib.match(/sqlPool\.json\(/g) ?? []).length >= 2, "Storno-Stand über sqlPool.json()");
  const logs = Array.from(lib.matchAll(/INSERT INTO fiaon_contact_log/g)).map((m) => lib.slice(m.index!, m.index! + 260));
  ok(logs.length >= 1 && logs.every((l) => /NULL, \$\{akteur\}/.test(l)), `Verlaufseinträge mit agent_id NULL — Justin wird nie Betreuer (${logs.length})`);
  ok(/akteur: \{ id: null, name: akteur \}/.test(lib) && /logLead\([^)]*\{ id: null, name: (akteur|opts\.akteur) \}/.test(lib), "Ergebnisse und Lead-Einträge ohne Mitarbeiter-ID");
  // E-259: Seit E-213 heißt der eine Weg kuendigungDurchfuehren (Wirkung, Urkunde, Bestätigung) — die Prüfung suchte
  // noch den alten Namen und war seitdem rot (auch auf dem Stand 63051659).
  ok(lib.includes("kuendigungDurchfuehren(") && lib.includes("kuendigungZuruecknehmen("), "Storno über die Kündigungsregel des Hauses");
  ok(!/UPDATE fiaon_applications\s+SET payment_status = 'cancelled'/.test(lib), "kein eigener Storno an der Kündigung vorbei");
  ok(lib.includes("ergebnisNachbereiten(") && !lib.includes("erreicht_zahlt_gleich"), "eine Ergebniskette; „zahlt gleich“ als Zusage für morgen");
  ok(lib.includes("istZahlenderKunde("), "zahlende Kunden werden nicht gesperrt (Regel 06.09.)");
  ok(lib.includes("freitextVersenden(") && lib.includes('anhangReferenz: z.referenz'), "Mail mit Rechnungs-PDF über die geprüfte Hauskette");
  ok(lib.includes("nurBuchen: true"), "fertiger Antrag wird ohne zweite Hausmail in Rechnung gestellt");
  ok(lib.includes("RATE_FAELLIG_SQL") && lib.includes("EREIGNIS_SQL") && lib.includes("priority_tier = 1"), "Stufen und Reihung des Hauses, keine eigene Einstufung");
  // ── E-259: Reihung ────────────────────────────────────────────────────────
  const zaehlung = lies("server/lib/fiaon-anrufversuche.ts");
  ok(/b\.versuche >= \$\{ANRUFE_ENDE\} OR b\.rang = 5/.test(lib) && zaehlung.includes("export const ANRUFE_ENDE = 10;"), "Reihung: ab 10 Versuchen ans Ende");
  ok(/COALESCE\(b\.ereignis_am < NOW\(\) - INTERVAL '\$\{FRISCH_TAGE\} days', TRUE\),\s*b\.rang,/.test(lib), "Reihung: frisch zuerst, dann Stufe A → B → C → Rate");
  ok(/\(COALESCE\(vz\.letzter > NOW\(\)/.test(lib) && lib.includes("COALESCE(${JETZT_ERREICHBAR_SQL}, TRUE) AS fenster_jetzt"), "pause und fenster_jetzt nie NULL (COALESCE)");
  ok(/CASE WHEN b\.versuche = 0 THEN 0 WHEN b\.versuche <= 2 THEN 1/.test(lib), "Reihung: wenigste Versuche zuerst");
  // Nachbesserung E-259: Die Wunschzeit sortiert erst innerhalb derselben Versuchsstufe.
  ok(/ELSE 3 END,\s*NOT b\.fenster_jetzt,\s*b\.fehl_folge,/.test(lib), "Reihung: Wunschzeit erst nach der Versuchsstufe");
  ok(zaehlung.includes("${c}.status = 'gewaehlt' AND ${c}.twilio_sid IS NULL") && zaehlung.includes("WAHL_BUENDEL_MINUTEN = 5"),
    "Zählung: hängende Wählzeilen zählen nicht, Wählbündel binnen 5 Min. = 1 Versuch");
  ok(/LEFT\(\$\{spalte\}, 5\) = 'rate_'/.test(zaehlung) && zaehlung.includes("Startgespräch geführt%") && zaehlung.includes("AS zaehlt"),
    "Zählung: Ratenergebnisse erreicht, Ergebnisse ohne outcome keine Versuche, entdoppelte Ergebnisse behalten „erreicht“");
  ok(lib.includes("AND p.id <> ALL(") && /router\.post\("\/chef\/telefonkartei\/weitere", wache,/.test(routen), "„Weitere laden“ ohne OFFSET — mit den schon gezeigten Karten");
  ok(zaehlung.includes("c.richtung = 'raus'") && zaehlung.includes("c2.richtung = 'raus'") && !/merged_into IS NULL/.test(zaehlung), "Zählung: nur ausgehende Anrufe, Ergebnisse an zusammengeführten Bestellungen zählen mit");
  ok(/anrufversucheCte\(\{ personId: f\.personId \?\? null \}\)/.test(lib), "eine Karte zählt nur für ihren Menschen");
  ok(lies("server/routes/fiaon-office-vertrieb.ts").includes("export const JETZT_ERREICHBAR_SQL"), "Wunschzeit aus derselben Quelle wie die Arbeitsliste");
  // ── E-259: WhatsApp über das FIAON-Konto ──────────────────────────────────
  ok(/karteiWhatsApp\(k, "rechnung", akteur\)/.test(lib) && /karteiWhatsApp\(k, "nicht_erreicht", akteur\)/.test(lib) && /karteiWhatsApp\(k, "antrag", akteur\)/.test(lib), "jeder Fall schickt die WhatsApp auf dem Server");
  ok(lib.includes("wa.waSenden(") && lib.includes("wa.waTagesplatz(") && lib.includes("wa.waVorlagenSperre(") && lib.includes("wa.freigegebeneVorlagen()"), "Hausweg: waSenden, Tagesplatz, Sperre, Freigabestand");
  // Nachbesserung E-259
  ok(!/absoluteUrl\("\/antrag"\)/.test(lib) && !/ANTRAG_URL/.test(lib + routen) && lib.includes("persoenlicherLink(") && lib.includes("kl.kurzlinkFuerLead("),
    "Kein nackter /antrag mehr: Text, Mail und KI tragen seinen persönlichen Link");
  ok(/ON CONFLICT \(person_id, art\) DO UPDATE SET am = NOW\(\)\s*WHERE t\.am < NOW\(\)/.test(lib) && lib.includes('taktNehmen(personId, "rechnung"'),
    "Doppelklick atomar: Takt je Mensch und Knopf, vor jeder Wirkung");
  ok(lib.includes("karteiSperre(k.personId)") && lib.includes("menschSperre(personId)"), "Persönliche Nachricht achtet „Stopp“ und Sperren (menschSperre)");
  ok(lib.includes("antrag.knopfGrund") && lib.includes("antragDesLeads("), "Abbrecher-Knopf nur mit dem Code, der in GENAU seinen Antrag führt");
  ok(!/u\.fenster && fall === "rechnung"/.test(lib) && /if \(!u\.fenster\) \{\s*return \{ weg: null/.test(lib), "Rechnung nie als freier Text; freier Text nie ohne offenes Fenster");
  ok(!/Zahlungsdaten per WhatsApp/.test(lib.replace(/\/\/[^\n]*/g, "")) && lib.includes("wegeText(mail, wa,"), "Der Verlauf nennt nur, was wirklich rausging");
  ok(lib.includes("NICHT_ERREICHT_MAIL_ABSTAND_TAGE") && lib.includes("werbungGesperrt"), "Nicht-erreicht-Mail höchstens alle drei Tage, nie bei Werbesperre");
  const mailRoute = lies("server/routes/fiaon-mail.ts");
  ok(mailRoute.includes("export async function freitextVersenden") && /adminFreitext[\s\S]{0,400}freitextVersenden\(/.test(mailRoute), "Verwaltung nutzt denselben Mail-Kern");
  ok(lies("server/routes.ts").includes("./routes/fiaon-telefonkartei"), "Routen eingehängt");
  ok(/slug: "telefonkartei"[^\n]*mindest: "inhaber"/.test(lies("client/src/components/admin/chef-seiten.tsx")), "Chefbüro-Seite nur für Inhaber");
  ok(lies("server/lib/fiaon-termine.ts").includes("gruender_link:"), "Herkunft „gruender_link“ im einen Wörterbuch");
  const gruender = lies("server/routes/fiaon-gruender-termin.ts");
  ok(gruender.includes("terminTokenPruefen(k)") && gruender.includes('herkunft: ausLink ? "gruender_link" : "gruender_seite"'), "/justin?k= füllt vor und bucht auf die Person");
  ok(lies("client/src/pages/agent/rundgaenge.ts").includes("telefonkartei: { titel: \"Telefonkartei\""), "Rundgang eingetragen");
  const seite = lies("client/src/components/admin/ChefTelefonkartei.tsx");
  ok(!/https:\/\/wa\.me|whatsapp:\/\/|waLink\(/.test(seite.replace(/\/\/[^\n]*/g, "")), "E-259: kein wa.me-/whatsapp://-Link mehr — WhatsApp nur über das FIAON-Konto");
  ok(!/window\.open\(/.test(seite), "kein window.open");
  ok(!/export function (waLink|waNummer|whatsappRechnung)/.test(lies("shared/fiaon-telefonkartei.ts")), "wa.me-Bausteine und der IBAN-Text sind entfernt");

  // ── Nachschärfung 21.09. abends (Justins Rückmeldung) ─────────────────────
  ok(/const sucht = !!String\(f\.suche/.test(lib) && lib.includes("const test = f.personId || sucht ? sqlPool`` : sqlPool`AND p.ist_test_am IS NULL`"),
    "Suche findet jeden (auch Testkonten wie Justin selbst), die Reiter bleiben ohne Testkonten");
  ok(/const gruppe = f\.personId \|\| sucht \? sqlPool``/.test(lib) && /const sperre = f\.personId \|\| sucht/.test(lib), "Suche ignoriert Reiter und Sperre");
  ok(lib.includes("testfall: !!z.testfall") && seite.includes('className="test">Testkonto'), "Karte trägt das Schild „Testkonto“");
  ok(routen.includes("gruenderAgentId()") && lib.includes("t.quelle = 'gruender' OR t.agent_id = ANY(${meine})"), "„Deine Termine“ = Gründerseite, eigenes Konto, Gründergespräch");
  ok(seite.includes('id="tk-deine-termine"') && seite.indexOf("Deine Termine") < seite.indexOf("Alle Termine des Teams"), "erst deine Termine, darunter alle");
  ok(seite.includes("function AkteFenster") && seite.includes("<KundeAkte akteId={k.akteId} eingebettet />") && !/href=\{k\.akteLink\}/.test(seite), "Akte öffnet als Fenster auf derselben Seite");
  ok(/export default function AdminKundeAktePage\(\{ akteId, eingebettet = false \}/.test(lies("client/src/pages/admin-kunde.tsx")), "Akte-Seite nimmt Kennung als Eigenschaft");
  ok(!seite.includes("datetime-local") && seite.includes("const STUNDEN = [8,") && seite.includes("const MINUTEN = [0, 15, 30, 45]"), "Rückruf ohne Systemkalender: Tag, Stunde, Minute als Knöpfe");
  const css = lies("client/src/styles/chef-telefonkartei.css");
  ok(/\.tk-suche:focus-within/.test(css) && !/\.tk input:focus-visible/.test(css), "Suchfeld: Fokus an der runden Kante, kein eckiger Rahmen");
  ok(lies("client/src/pages/agent/rundgaenge.ts").includes("„Akte öffnen“ unten auf der Karte zeigt die ganze Akte in einem Fenster"), "Rundgang erklärt Akte-Fenster und Termine");

  // ── E-205 (21.09. spät): ein Knopf „Nachrichten", persönliche Nachricht per KI ──
  ok(seite.includes('className="tk-nachrichten"') && seite.includes("function NachrichtenBlatt") && !seite.includes('className="tk-faelle"'),
    "Karte: „Anrufen“ + „Nachrichten“ — die vier Fälle stehen im Blatt");
  const nb = seite.slice(seite.indexOf("function NachrichtenBlatt"), seite.indexOf("function KiNachricht"));
  ok(nb.includes("onClick={() => onErgebnis(ersterFall)}") && nb.includes('onClick={() => onErgebnis("nicht_erreicht")}') && !/<a[^>]+tk-nb-fall/.test(nb),
    "E-259: Die Fälle sind Knöpfe — der Server schickt Mail und WhatsApp");
  ok(seite.includes("/whatsapp-lage`") && nb.includes("wegeZeile("), "Das Blatt zeigt vorher, was rausgeht — oder warum keine WhatsApp");
  for (const pfad of ["ki-nachricht", "whatsapp-frei", "whatsapp-rueckfrage"]) {
    ok(new RegExp(`router\\.post\\("/chef/telefonkartei/:personId/${pfad}", wache,`).test(routen), `${pfad} nur hinter der Inhaber-Wache`);
  }
  ok(/router\.get\("\/chef\/telefonkartei\/:personId\/whatsapp-lage", wache,/.test(routen) && !routen.includes("nachricht-vermerken"), "whatsapp-lage hinter der Wache; „nachricht-vermerken“ entfallen");
  const ki = lies("server/lib/fiaon-kartei-ki.ts");
  ok(!/"\/antrag"/.test(ki) && ki.includes("u.antragLink") && ki.includes("if (u.sperre) return liste;"), "KI: [ANTRAG] nur als persönlicher Link; bei Sperre kein Antrag- und Zahlungslink");
  ok(!/freitextSenden|freitextVersenden|mailSenden|sendMail|brevo|twilio|waSenden/i.test(ki.replace(/\/\/[^\n]*/g, "")), "Die KI-Datei kann nicht senden — gesendet wird nur über karteiNachricht");
  const eingabeFn = ki.slice(ki.indexOf("function eingabe("), ki.indexOf("export function nachrichtGlaetten"));
  ok(!/telefon|email|primary_|street|iban/i.test(eingabeFn), "An das Modell gehen weder Telefonnummer noch E-Mail, Anschrift oder Bankdaten");
  ok(ki.includes("[WEBSITE]") && ki.includes("t.split(p.zeichen).join(p.wert)"), "Links nur als Platzhalter, eingesetzt auf dem Server");
  ok(ki.includes("wandPruefen(text, [])") && ki.includes("ohneEmojis(") && ki.includes("entschaerfen"), "Antwort durch Wortwand, Emoji-Filter und Entschärfer");
  ok(ki.includes('kostenHeute("telefonkartei")') && ki.includes("TAGESDECKEL_EUR"), "Tagesdeckel für KI-Kosten");
  ok(lib.includes("async function waVermerk(") && lib.includes("NULL, ${akteur}, 'system'"), "Vermerk der persönlichen Nachricht mit Justins Namen, ohne Mitarbeiter-ID");
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? ` — ${fehler} FEHLER` : ""}`);
process.exit(fehler ? 1 : 0);
