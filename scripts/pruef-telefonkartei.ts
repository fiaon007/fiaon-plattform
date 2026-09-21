// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND TELEFONKARTEI (21.09.2026, E-201) — ohne Netz, ohne Datenbank
//
// Prüft, worauf sich Justins Anrufseite verlässt: die Texte der vier Fälle
// (Wortwand, keine IBAN in Mails, „als Ziel", „in der Regel", richtige Anlässe),
// die Kontaktkarte fürs iPhone, die Kalenderdatei für Rückrufe — und im
// Quelltext: jede Route hinter der Inhaber-Wache, Justin nie als Betreuer
// (agent_id NULL), Storno über die Kündigungsregel, JSONB nur über
// sqlPool.json(), die Stufen des Hauses statt einer eigenen Einstufung.
//
//   npx tsx scripts/pruef-telefonkartei.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  whatsappRechnung, whatsappNichtErreicht, whatsappAntrag, mailRechnung, mailNichtErreicht, mailAntrag,
  waLink, waNummer, limitZiel, anlass, pitchAbsatz, hatRechnungsweg, hatAntragsweg, euro, euroGanz, datumKurz,
  KARTEI_GRUPPEN, istKarteiGruppe, istKarteiErgebnis, type KarteiKarte,
} from "../shared/fiaon-telefonkartei";
import { BANK } from "../shared/fiaon-bank";
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
  kontakt: { am: null, von: null, ergebnis: null, nichtErreicht: 0 }, termin: null, erreichbarkeit: "",
  zusage: null, gesperrt: false, werbungGesperrt: false, testfall: false,
  terminLink: "https://www.fiaon.com/justin?k=4711.123.abc", akteId: "FIAON-ABC234", akteLink: "/chef/s/akte?id=FIAON-ABC234",
  storno: null, rueckrufAm: null,
};
const karte = (teil: Partial<KarteiKarte>): KarteiKarte => ({ ...basis, ...teil });
const ABSENDER = "Justin Schwarzott";
/** Intl setzt zwischen Betrag und € ein geschütztes Leerzeichen — gewollt, für die Prüfung normalisiert. */
const flach = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const IBAN_REGEL = /\bDE\d{2}/i;
/** Harte Treffer der Wand — für WhatsApp OHNE die IBAN-Regel (WhatsApp trägt die Bankdaten wie der Akte-Knopf, E-181). */
const hart = (text: string, ausgefuehrt: string[] = [], ohneIban = false) =>
  wandPruefen(text, ausgefuehrt)
    .filter((f) => f.art === "verboten" || f.art === "zusage")
    .filter((f) => !(ohneIban && IBAN_REGEL.test(f.treffer)));

abschnitt("Fall 1 — Rechnung (erste Zahlung)");
{
  const wa = flach(whatsappRechnung(basis, ABSENDER)!);
  ok(wa.startsWith("Hi Max Mustermann,"), "WhatsApp beginnt mit „Hi Vor- und Nachname“");
  ok(wa.includes("vielen Dank für das freundliche Telefonat"), "Dank fürs Telefonat");
  ok(wa.includes("mit Ihrem Wunschlimit von 5.000 € als Ziel"), "Wunschlimit als ZIEL, nicht als Versprechen");
  ok(wa.includes("nach Zusage der Bank in der Regel in 4–8 Werktagen"), "Karte: „nach Zusage der Bank in der Regel 4–8 Werktage“");
  ok(wa.includes("Kartenantrag"), "Justins Pitch: Kartenantrag im Anschluss");
  ok(!/ruft Sie .{0,30}an\b/i.test(wa), "kein „ruft Sie an“ (Zusage ohne Rückruf)");
  ok(wa.includes(`*IBAN:* ${BANK.ibanDisplay}`) && wa.includes(`*BIC:* ${BANK.bic}`) && wa.includes(`*Empfänger:* ${BANK.empfaenger}`), "Bankdaten aus shared/fiaon-bank.ts");
  ok(wa.includes("*Verwendungszweck:* FIAON-ABC234") && wa.includes("*Betrag:* 59,99 €"), "Betrag und Verwendungszweck");
  ok(wa.includes("https://www.fiaon.com/zahlung/FIAON-ABC234"), "Zahlungsseite drin");
  ok(wa.includes("📄 Ihre Rechnung als PDF:") && wa.includes("invoice/FIAON-ABC234.pdf"), "Rechnung als PDF-Link");
  ok(wa.includes("zusätzlich per E-Mail"), "Hinweis auf die Mail, wenn eine Adresse da ist");
  ok(!whatsappRechnung(karte({ email: null }), ABSENDER)!.includes("per E-Mail"), "ohne Adresse kein Mail-Hinweis");
  ok(wa.trim().endsWith("Viele Grüße\nJustin Schwarzott"), "Gruß mit Justins Namen");
  ok(hart(wa, ["rechnung_anhaengen"], true).length === 0, `WhatsApp besteht die Wortwand (außer der IBAN-Regel): ${hart(wa, ["rechnung_anhaengen"], true).map((f) => f.treffer).join(" | ")}`);
  const ohneWunsch = whatsappRechnung(karte({ wunschlimitEuro: null }), ABSENDER)!;
  ok(!ohneWunsch.includes("Wunschlimit") && ohneWunsch.includes("aktiviere ich umgehend Ihr Konto."), "ohne Wunschlimit fällt der Halbsatz weg — keine erfundene Zahl");
  ok(limitZiel({ wunschlimitEuro: 25000, rahmenEuro: 5000 }) === 5000, "Wunsch über dem Paketrahmen → Rahmen");
  ok(limitZiel({ wunschlimitEuro: 3000, rahmenEuro: 5000 }) === 3000, "Wunsch unter dem Rahmen bleibt");
  ok(limitZiel({ wunschlimitEuro: 0, rahmenEuro: 5000 }) === null, "0 € ist kein Wunschlimit");
  const m = mailRechnung(basis, ABSENDER)!;
  ok(m.betreff.includes("Rechnung"), "Mail-Betreff nennt die Rechnung");
  ok(m.text.includes("Ihre Rechnung finden Sie im Anhang."), "Mail sagt: Rechnung im Anhang");
  ok(!/\bDE\d{2}[\s\d]{14,}/i.test(m.text) && !m.text.includes(BANK.bic), "keine Bankdaten im Mailtext (Wand: Zahlungsseite verlinken)");
  ok(m.text.includes("https://www.fiaon.com/zahlung/FIAON-ABC234") && m.text.includes("FIAON-ABC234"), "Mail: Zahlungsseite + Verwendungszweck");
  ok(hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).length === 0, `Mail besteht die Wortwand MIT Anhang: ${hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).map((f) => f.treffer).join(" | ")}`);
  ok(hart(`${m.betreff}\n${m.text}`).length > 0, "Gegenprobe: ohne Anhang hält die Wand „im Anhang“ auf");
  ok(m.text.includes(pitchAbsatz(basis)), "Mail und WhatsApp tragen denselben Pitch");
}

abschnitt("Fall 1 — Rechnung (Monatsrate)");
{
  const rate = karte({
    lage: "rate", wunschlimitEuro: null,
    zahlung: { art: "rate", referenz: "FIAON-ABC234-2", betragCents: 5999, rateNr: 2, faelligAm: "2026-09-15", zahlungsseite: "https://www.fiaon.com/zahlung/FIAON-ABC234-2", rechnungLink: null, nochKeineRechnung: false },
  });
  const wa = whatsappRechnung(rate, ABSENDER)!;
  ok(wa.includes("2. Monatsrate") && wa.includes("*Fällig:* 15.09.2026"), "Rate mit Nummer und Fälligkeit");
  ok(!wa.includes("Kartenantrag") && !wa.includes("aktiviere"), "kein Aktivierungs-Pitch bei einem laufenden Konto");
  ok(!wa.includes("Ihre Rechnung als PDF"), "kein öffentlicher PDF-Link für Raten (die Mail trägt das PDF)");
  const m = mailRechnung(rate, ABSENDER)!;
  ok(m.betreff.includes("2. Monatsrate") && m.text.includes("Fällig: 15.09.2026"), "Mail zur Rate");
  ok(hart(`${m.betreff}\n${m.text}`, ["rechnung_anhaengen"]).length === 0, "Raten-Mail besteht die Wand");
}

abschnitt("Fall 3 — Nicht erreicht");
{
  const wa = whatsappNichtErreicht(basis, ABSENDER);
  ok(wa.includes("zu Ihrem Kreditkartenantrag bei FIAON anrufen") && wa.includes("heute oder morgen"), "Justins Satz, grammatisch rund");
  ok(wa.includes("https://www.fiaon.com/justin?k=4711.123.abc") && wa.includes("schon ausgefüllt"), "persönlicher Kalender, vorausgefüllt");
  ok(whatsappNichtErreicht(karte({ lage: "C" }), ABSENDER).includes("zu Ihrer Anfrage bei FIAON"), "C-Lead: „Anfrage“ statt „Antrag“");
  ok(whatsappNichtErreicht(karte({ lage: "rate" }), ABSENDER).includes("zu Ihrem FIAON Konto"), "Rate offen: „FIAON Konto“");
  ok(anlass("A") === anlass("B") && anlass("B").includes("Kreditkartenantrag"), "A/B: Kreditkartenantrag");
  ok(hart(wa).length === 0, "WhatsApp besteht die Wand");
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
  ok(whatsappRechnung(lead, ABSENDER) === null && mailRechnung(lead, ABSENDER) === null, "ohne Zahlung kein Rechnungstext");
  const wa = whatsappAntrag(lead, ABSENDER, "https://www.fiaon.com/antrag");
  ok(wa.includes("https://www.fiaon.com/antrag") && wa.includes("zwei Minuten"), "Antrags-Link in WhatsApp");
  const m = mailAntrag(lead, ABSENDER, "https://www.fiaon.com/antrag");
  ok(hart(`${m.betreff}\n${m.text}`).length === 0 && hart(wa).length === 0, "Antrags-Texte bestehen die Wand");
}

abschnitt("WhatsApp-Link, Formate, Gruppen");
ok(waNummer("+49 171 123-4567") === "491711234567", "wa.me will nur Ziffern");
ok(waLink("+491711234567", "Hallo Welt & Co")?.startsWith("https://wa.me/491711234567?text=Hallo%20Welt%20%26%20Co") === true, "Text sauber kodiert");
ok(waLink("123", "x") === null && waLink(null, "x") === null, "zu kurze oder fehlende Nummer → kein Link");
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
  ok(lib.includes("kuendigungSetzen(") && lib.includes("kuendigungZuruecknehmen("), "Storno über die Kündigungsregel des Hauses");
  ok(!/UPDATE fiaon_applications\s+SET payment_status = 'cancelled'/.test(lib), "kein eigener Storno an der Kündigung vorbei");
  ok(lib.includes("ergebnisNachbereiten(") && !lib.includes("erreicht_zahlt_gleich"), "eine Ergebniskette; „zahlt gleich“ als Zusage für morgen");
  ok(lib.includes("istZahlenderKunde("), "zahlende Kunden werden nicht gesperrt (Regel 06.09.)");
  ok(lib.includes("freitextVersenden(") && lib.includes('anhangReferenz: z.referenz'), "Mail mit Rechnungs-PDF über die geprüfte Hauskette");
  ok(lib.includes("nurBuchen: true"), "fertiger Antrag wird ohne zweite Hausmail in Rechnung gestellt");
  ok(lib.includes("RATE_FAELLIG_SQL") && lib.includes("EREIGNIS_SQL") && lib.includes("priority_tier = 1"), "Stufen und Reihung des Hauses, keine eigene Einstufung");
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
  ok(seite.includes("keepalive: true"), "Ergebnis kommt auch an, wenn das iPhone zu WhatsApp wechselt");
  ok(!/window\.open\(/.test(seite), "WhatsApp über echte Links, kein window.open (Popup-Sperre)");

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
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? ` — ${fehler} FEHLER` : ""}`);
process.exit(fehler ? 1 : 0);
