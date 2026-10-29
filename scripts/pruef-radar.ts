// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND FIRMEN-RADAR (19.09.2026) — ohne Netz, ohne Datenbank
//
// Prüft die Wände, auf die sich der Radar verlässt: Domäne und Name (keine
// erfundene Firma), wörtliche Belege (kein erfundener Aufhänger), die Wortwand
// und der Institutssatz in jeder Mail, HTML ohne eingeschleusten Code, die
// Anrede ohne geratenes Geschlecht, die Pflichtangaben im Fuß — und im
// Quelltext: jede Route hinter der Wache der Geschäftsführung, Senden nur mit
// Bestätigung, je Firma eine Mail, JSONB nur über sqlPool.json().
//
//   npx tsx scripts/pruef-radar.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  RADAR_BEREICHE, RADAR_STATUS, RADAR_GRUPPEN, RADAR_STAPEL_MAX, RADAR_ANTWORT_ARTEN, RADAR_KERNSATZ, RADAR_HOECHSTENS_JE_TAG, RADAR_NACHFASS_TAGE,
  RADAR_SIGNALE, RADAR_SIGNAL_AB,
  radarDomain, alsRadarLand, radarBereich, radarAdressePruefen, radarAutomatikLesen, radarSendefenster,
} from "../shared/fiaon-radar";
import { globalWortPruefen } from "../shared/fiaon-global-wortregeln";
import { GLOBAL_SEITEN } from "../shared/fiaon-global-seiten";
import { FIAON_FIRMA } from "../shared/fiaon-firma";
import { RADAR_SCHLUSSSAETZE as RADAR_SCHLUSSSAETZE_P } from "../shared/fiaon-radar";

// Die Datenbank-Anbindung verlangt beim Laden eine Adresse — abgefragt wird hier nie („ins Leere").
process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
const { antwortKern, antwortVorab, nachfassFaellig } = await import("../server/lib/fiaon-radar-faden");
const { namensWoerter, nameAufSeite, aufhaengerPruefen, mailPruefen, mailHtml, mailText, anredeFuer, seitenWaehlen, ausJson, zeileLesen, cfEntschluesseln, verpackungLoesen, adressenAusSeite, besteAdresse, rot13 } = await import("../server/lib/fiaon-radar");

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

abschnitt("Domäne und Name");
ok(radarDomain("https://www.Firma-Beispiel.de/ueber-uns?x=1") === "firma-beispiel.de", "Domäne aus voller Adresse");
ok(radarDomain("firma.de") === "firma.de", "Domäne ohne Schema");
ok(radarDomain("") === null && radarDomain("mailto:a@b.de") === null && radarDomain("http://localhost") === null, "Unsinn ergibt keine Domäne");
ok(alsRadarLand("de") === "DE" && alsRadarLand("fr") === null, "Land nur DE/AT/CH");
const w = namensWoerter("Maschinenbau Silberhorn GmbH & Co. KG");
ok(w.includes("silberhorn") && w.includes("maschinenbau") && !w.includes("gmbh") && !w.includes("co"), `Namenswörter ohne Rechtsform (${w.join(",")})`);
ok(nameAufSeite("ARKU Maschinenbau GmbH", "Willkommen bei ARKU — Richtmaschinen", "arku.com"), "Name auf der Seite erkannt");
ok(!nameAufSeite("Erfundene Beispiel GmbH", "Ganz andere Firma, andere Produkte", "xyz-shop.de"), "Fremder Name wird nicht erkannt");
ok(nameAufSeite("Müller Präzision GmbH", "MUELLER? Nein: Muller Prazision seit 1950", "mueller-praezision.de"), "Umlaute und Groß/Klein egal");

abschnitt("Kontakt finden (nie raten)");
ok(cfEntschluesseln("741c1d3415031b061f5a171b19") === "hi@awork.com", "Cloudflare-Mailschutz wird entschlüsselt");
ok(cfEntschluesseln("abc") === null && cfEntschluesseln("0000") === null, "Unsinn bleibt Unsinn");
ok(verpackungLoesen("info [at] firma [dot] de").includes("info@firma.de"), "„[at]“ und „[dot]“ werden aufgelöst");
const funde = adressenAusSeite({ text: "Mail: info [at] firma [dot] de", html: '<a href="mailto:hallo%40firma.de">Mail</a><i data-cfemail="741c1d3415031b061f5a171b19"></i><script type="application/ld+json">{"email":"presse@firma.de"}</script>' });
ok(funde.includes("info@firma.de") && funde.includes("hallo@firma.de") && funde.includes("hi@awork.com") && funde.includes("presse@firma.de"), `Text, mailto, Cloudflare und Seitendaten (${funde.join(",")})`);
ok(besteAdresse({ text: "datenschutz@firma.de info@firma.de", html: "" }, "firma.de") === "info@firma.de", "info@ vor datenschutz@");
ok(besteAdresse({ text: "kontakt@fremde-agentur.de und info@firma.de", html: "" }, "firma.de") === "info@firma.de", "Eigene Domäne vor fremder");
ok(besteAdresse({ text: "kein Kontakt hier", html: "<form action=/kontakt></form>" }, "firma.de") === null, "Ohne Fund wird nichts geraten (kein info@ auf Verdacht)");
ok(rot13(rot13("info@firma.de")) === "info@firma.de" && rot13("vasb") === "info", "ROT13 dreht zurück");
const gedreht = adressenAusSeite({ text: "", html: '<a data-enc-email="vasb[at]nvpuryr.qr">E-Mail</a>' }, "aichele.de");
ok(gedreht.includes("info@aichele.de"), `Gedrehte Adresse im Quelltext gefunden (${gedreht.join(",")})`);
ok(!adressenAusSeite({ text: "", html: '<img src="logo@2x.png"><i data-x="sprite@3x.png">' }, "firma.de").length, "Dateinamen wie logo@2x.png sind keine Adressen");
const libVoraus = lies("server/lib/fiaon-radar.ts");
ok(/if \(!kontakt\.email\) return nein\(/.test(libVoraus), "Ohne E-Mail keine Aufnahme in den Radar");
ok(/status = 'ohne_kontakt'/.test(libVoraus), "Firmen ohne Adresse landen unter „Ohne E-Mail“");

abschnitt("Belege");
const seite = { url: "https://firma.de/unternehmen", text: "Über 1.600 Anlagen sind weltweit im Einsatz, betreut von Servicestandorten in Deutschland, den USA und China." };
const p = aufhaengerPruefen([
  { text: "Service in den USA", beleg: "betreut von Servicestandorten in Deutschland, den USA und China", url: "https://egal.de", quelle: "website" },
  { text: "Erfunden", beleg: "Wir eröffnen 2027 ein Werk in Texas mit 500 Mitarbeitern", url: "https://firma.de/", quelle: "website" },
  { text: "Meldung", beleg: "Die Firma gewinnt den Innovationspreis des Landes Bayern", url: "https://zeitung.de/artikel", quelle: "web" },
  { text: "Zu kurz", beleg: "USA", url: "https://firma.de/", quelle: "website" },
], [seite]);
ok(p.gut.length === 1 && p.gut[0].url === seite.url, "Wörtliches Zitat besteht — und zeigt auf die Seite, auf der es steht");
ok(p.offen.length === 1 && p.offen[0].quelle === "web", "Websuche-Fund wartet auf Nachprüfung an seiner Quelle");
ok(p.weg === 2, `Erfundenes und zu kurzes Zitat fallen weg (${p.weg})`);

abschnitt("Mail-Wände");
// E-337 (Justin, 12.10.): kein Institut-Satz in der Akquise-Mail — und deshalb auch kein Betrag, kein Rahmen, kein Limit.
const sauber = { betreff: "Silberhorn und die USA: eine kurze Idee", absaetze: ["Ein Satz über die Firma mit genug Inhalt für die Prüfung.", `Genau da setzen wir an: ${RADAR_KERNSATZ.was} ${RADAR_KERNSATZ.vorteil}`], frage: "Wäre ein kurzes Gespräch dazu für Sie interessant?", ps: "" };
ok(mailPruefen(sauber).sperrend.length === 0, `Saubere Mail sperrt nicht (${mailPruefen(sauber).sperrend.join("; ")})`);
ok(globalWortPruefen(Object.values(RADAR_KERNSATZ).join(" ")).length === 0, "Justins Kernsatz besteht die Global-Wortwand");
ok(mailPruefen({ ...sauber, absaetze: ["Sie bekommen bis zu 250.000 $ Kapital."] }).sperrend.length > 0, "„bis zu“ sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Wir öffnen Ihnen einen Kapitalrahmen für Ihr Wachstum."] }).sperrend.some((x) => /Kapitalrahmen/.test(x)), "Kapitalrahmen in der Akquise-Mail sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Ziel sind 250.000 $ für Ihre Expansion."] }).sperrend.some((x) => /Betrag/.test(x)), "Betrag in der Akquise-Mail sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Über Rahmen und Bedingungen entscheidet das jeweilige Institut."] }).sperrend.some((x) => /Institut-Satz/.test(x)), "Institut-Satz in der Akquise-Mail sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Global Kapital kostet 6.999 € Festpreis."] }).warnungen.some((x) => /Preis/.test(x)), "Preis in der ersten Mail wird gemeldet");
ok(mailPruefen({ ...sauber, absaetze: ["Die Karte kommt garantiert, das Institut entscheidet."] }).sperrend.length > 0, "„garantiert“ sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Ich hoffe, es geht Ihnen gut! Wir sind innovativ."] }).warnungen.length >= 2, "Floskel und Ausrufezeichen werden gemeldet");
const links = { gespraech: "https://fiaon.com/business?utm_source=radar#gespraech", seite: "https://fiaon.com/business" };
const html = mailHtml({ anrede: "Guten Tag <b>X</b>,", absaetze: ['<script>alert(1)</script> & "Zitat"'], frage: "Passt es?", ps: "<img src=x onerror=alert(1)>", links });
// E-337: Die Signaturkarte trägt Bilder (Justins Wunsch) — erlaubt sind NUR die Bilder unter /mail/signatur/.
const ohneSignaturBilder = html.replace(/<img src="https:\/\/[^"]+\/mail\/signatur\/[a-z]+\.(png|gif)"[^>]*>/g, "");
ok(!/<script|<img|onerror=alert\(1\)>/i.test(ohneSignaturBilder.replace(/&lt;img src=x onerror=alert\(1\)&gt;/, "")) && html.includes("&lt;script&gt;"), "HTML ist maskiert — kein eingeschleuster Code");
ok(!/<img\b/i.test(ohneSignaturBilder) && !/background-image/i.test(html), "Keine Bilder außer der Signaturkarte — die Mail sieht aus wie eine persönliche Mail");
// E-458: kein Abmelde-Satz mehr — ein natürlicher Schlusssatz, darunter die leise Zeile mit Firma, Register, Impressum, Datenschutz.
ok(html.includes(FIAON_FIRMA.companyNo) && !html.includes("Kein Thema für Sie?") && html.includes(FIAON_FIRMA.name) && html.includes(RADAR_SCHLUSSSAETZE_P[0]), "Fuß mit Firma und Registernummer, Schlusssatz statt Abmeldesatz");
const text = mailText({ anrede: "Guten Tag,", absaetze: ["A"], frage: "B?", ps: "", links });
ok(text.includes(links.gespraech) && text.includes(FIAON_FIRMA.companyNo) && !text.includes("Kein Thema für Sie?") && text.includes(RADAR_SCHLUSSSAETZE_P[0]), "Textfassung trägt Link, Firma und Schlusssatz — keinen Abmeldesatz");

abschnitt("Anrede");
ok(anredeFuer("Thomas Huber (Geschäftsführer)") === "Guten Tag Thomas Huber,", "Name aus dem Impressum, ohne Funktion");
ok(anredeFuer("Herr Max Muster") === "Guten Tag Max Muster,", "„Herr“ fällt weg — das Geschlecht wird nie geraten");
ok(anredeFuer(null) === "Guten Tag," && anredeFuer("Huber") === "Guten Tag,", "Ohne vollen Namen neutral");

abschnitt("Seitenwahl beim Scan");
const basis = new URL("https://firma.de/");
const gewaehlt = seitenWaehlen(`<a href="/ueber-uns">Über uns</a><a href="/impressum">Impressum</a><a href="/produkte/anlagen">Produkte</a><a href="https://fremd.de/about">Fremd</a><a href="/datei.pdf">PDF</a><a href="/news">News</a>`, basis, 7).map((u) => u.pathname);
ok(gewaehlt.includes("/ueber-uns") && gewaehlt.includes("/produkte/anlagen") && gewaehlt.includes("/news"), `Nützliche Seiten gewählt (${gewaehlt.join(" ")})`);
ok(!gewaehlt.includes("/impressum") && !gewaehlt.some((x) => /pdf/.test(x)), "Impressum und Dateien nicht im Scan");
ok(gewaehlt[0] === "/ueber-uns", "Über uns zuerst");

abschnitt("JSONB lesen");
ok(Array.isArray(ausJson('"[{\\"a\\":1}]"', [])) && (ausJson<any[]>('"[{\\"a\\":1}]"', []))[0].a === 1, "Doppelt verpackt wird gelesen");
ok(ausJson('{"x":2}', null as any)?.x === 2 && ausJson({ y: 3 }, null as any)?.y === 3 && ausJson("kaputt{", "leer") === "leer", "Einfach, als Objekt und kaputt");
ok(Array.isArray(zeileLesen({ gruende: '[{"text":"a","url":"b"}]', mail: null })?.gruende), "Zeile wird normalisiert");

abschnitt("Bereiche");
ok(RADAR_BEREICHE.length === 10 && new Set(RADAR_BEREICHE.map((b) => b.key)).size === 10, "Zehn Bereiche, jeder einmal");
const seitenPfade = new Set(GLOBAL_SEITEN.map((s) => s.pfad));
for (const b of RADAR_BEREICHE) ok(b.seite === "/business" || seitenPfade.has(b.seite), `${b.key}: Seite ${b.seite} existiert`);
ok(radarBereich("gibtsnicht") === null && !!radarBereich("bau"), "Unbekannter Bereich wird abgelehnt");
ok(Object.keys(RADAR_STATUS).length === 16 && RADAR_STATUS.brief?.label === "Brief unterwegs", "Sechzehn Stände bis zum Kauf (E-337), dazu „Brief unterwegs“ (E-339)");
const inGruppen = new Set(RADAR_GRUPPEN.flatMap((g) => g.stati));
ok(Object.keys(RADAR_STATUS).every((st) => inGruppen.has(st as any)), "Jeder Stand liegt in einem Reiter");
ok(RADAR_STAPEL_MAX > 0 && RADAR_STAPEL_MAX <= 50, "Stapel bleibt klein genug für persönliche Mails");

abschnitt("Adress-Wand (E-337)");
const adr = (e: string, d: string, n?: string) => radarAdressePruefen(e, d, n).ok;
ok(!adr("officer@proliance.ai", "voltfang.de", "Voltfang GmbH"), "Externer Datenschutzbeauftragter fällt raus");
ok(!adr("info@domain1.tld", "rz-medizintechnik.com"), "Platzhalter aus dem Impressum fällt raus");
ok(!adr("support@langdock.com", "langdock.com") && !adr("privacy@turn2x.com", "turn2x.com") && !adr("media@neustark.com", "neustark.com") && !adr("booking@brera.de", "brera.de") && !adr("imprint@frontnow.com", "frontnow.com"), "support@/privacy@/media@/booking@/imprint@ fallen raus");
ok(adr("info@foundingrestaurants.de", "kaspar-schmauser.de", "FoundingRestaurants GmbH"), "Betreibergesellschaft mit eigener Domäne bleibt drin");
ok(adr("info@next2sun.de", "next2sun.com") && adr("max.muster@firma.de", "firma.de"), "Eigene Domäne (auch andere Endung) bleibt drin");
ok(!adr("info@fremd-agentur.de", "firma.de", "Firma GmbH"), "Fremde Firma fällt raus");

abschnitt("Antworten erkennen (E-337)");
ok(antwortKern("Kein Bedarf, danke.\n\nAm Mo., 28. Sept. 2026 um 14:05 schrieb Justin:\n> Guten Tag") === "Kein Bedarf, danke.", "Zitat „Am … schrieb“ wird abgeschnitten");
ok(antwortKern("Gern mehr Infos.\n-----Original Message-----\nVon: x") === "Gern mehr Infos.", "„-----Original“ wird abgeschnitten");
ok(antwortVorab({ vonAdresse: "mailer-daemon@googlemail.com", betreff: "Delivery Status Notification (Failure)", text: "Die Adresse wurde nicht gefunden" }) === "unzustellbar", "Rückläufer erkannt");
ok(antwortVorab({ vonAdresse: "enjoy@zammad.com", betreff: "Vielen Dank für Ihre Anfrage [Ticket#10238340]", text: "Ihre Anfrage (Ticket#10238340) ist eingegangen" }) === "automatisch", "Ticket-Bestätigung erkannt");
ok(antwortVorab({ vonAdresse: "a@b.de", betreff: "Abwesenheitsnotiz", text: "Ich bin bis 20.10. nicht im Büro" }) === "abwesend", "Abwesenheit erkannt");
ok(antwortVorab({ vonAdresse: "support@sternglas.com", betreff: "AW: Sternglas", text: "Aktuell besteht unsererseits leider kein Interesse und kein Bedarf." }) === null, "Menschliche Absage geht an die KI (nicht als Automat verworfen)");
ok(RADAR_ANTWORT_ARTEN.interesse.lead && RADAR_ANTWORT_ARTEN.frage.lead && RADAR_ANTWORT_ARTEN.termin_wunsch.lead && !RADAR_ANTWORT_ARTEN.kein_interesse.lead, "Lead = Interesse, Frage, Terminwunsch");
ok(RADAR_ANTWORT_ARTEN.kein_interesse.stopptNachfass && RADAR_ANTWORT_ARTEN.unzustellbar.stopptNachfass && !RADAR_ANTWORT_ARTEN.automatisch.stopptNachfass, "Absage und Rückläufer stoppen das Nachfassen, Automaten nicht");

abschnitt("Nachfassen und Schalter (E-337)");
const jetzt = new Date("2026-10-14T10:00:00+02:00");
ok(nachfassFaellig({ status: "versendet", nachfass_stufe: 0, nachfass_faellig: "2026-10-14T07:00:00Z", antwort_am: null }, jetzt), "Fällig nach Tag 3");
ok(!nachfassFaellig({ status: "versendet", nachfass_stufe: 0, nachfass_faellig: "2026-10-14T07:00:00Z", antwort_am: "2026-10-13T08:00:00Z" }, jetzt), "Nach einer Antwort nie");
ok(!nachfassFaellig({ status: "versendet", nachfass_stufe: RADAR_NACHFASS_TAGE.length, nachfass_faellig: "2026-10-14T07:00:00Z", antwort_am: null }, jetzt), "Nach der letzten Stufe Schluss");
ok(!nachfassFaellig({ status: "kein_interesse", nachfass_stufe: 0, nachfass_faellig: "2026-10-14T07:00:00Z", antwort_am: null }, jetzt), "Nie nach einer Absage");
const aus = radarAutomatikLesen({});
ok(!aus.versand && !aus.nachfass && aus.mara === "entwurf", "Ohne Einstellung: Versand und Nachfassen aus, Mara zur Freigabe");
ok(radarAutomatikLesen({ radar_auto_je_tag: "500" }).jeTag === RADAR_HOECHSTENS_JE_TAG, `Tageskontingent gedeckelt auf ${RADAR_HOECHSTENS_JE_TAG}`);
ok(radarAutomatikLesen({ radar_auto_versand: "an", radar_mara_antwort: "auto" }).versand && radarAutomatikLesen({ radar_mara_antwort: "quatsch" }).mara === "entwurf", "Schalter lesen, Unsinn fällt auf die Vorgabe");
ok(radarSendefenster(new Date("2026-10-14T10:00:00+02:00")) && !radarSendefenster(new Date("2026-10-14T19:00:00+02:00")) && !radarSendefenster(new Date("2026-10-17T10:00:00+02:00")), "Sendefenster: Werktag 10 Uhr ja, 19 Uhr nein, Samstag nein");
const faden = lies("server/lib/fiaon-radar-faden.ts");
ok(/p\.postfach !== "js@fiaon\.com"/.test(faden) && /opts\.sendenErlaubt && !pruefung\.length/.test(faden), "Aus js@ sendet Mara nie selbst; Wortwand-Funde senden nie");
// E-361: Die Entscheidung trifft radarPlan (frisch = false → keine Antwort, keine Aufgabe; geprüft unter „Maras Szenarien“).
ok(/frisch = Date\.now\(\) - n\.datum\.getTime\(\) < 48/.test(faden) && /maraModus: automatik\.mara, postfachJs: postfach === "js@fiaon\.com", frisch,/.test(faden), "Beim Nachholen alter Antworten keine Mara-Antwort und keine Aufgabe");
ok(/abfrage\.art === "domaene" \|\| faeden\.has\(m\.threadId\)/.test(faden), "Gelesen wird nur, was in einem Radar-Faden steht oder von einer Radar-Domäne kommt");
// E-458: Nachfassen im Fenster des Mail-Motors (Einstellung statt fester 8:30–17:30).
ok(/radarMotorImFenster\(jetzt, m\)/.test(faden) && /if \(erg\.aus\) return/.test(faden), "Versand nur mit Schalter und im Sendefenster des Motors");
ok(/status: "kein_interesse"/.test(faden), "Absage → Sperrliste über radarStatusSetzen");
ok(/tageslauf\('radar_post'/.test(lies("server/routes.ts")) && /tageslauf\('radar_versand'/.test(lies("server/routes.ts")) && /radar_post: \{/.test(lies("server/lib/fiaon-crons.ts")) && /radar_versand: \(e\)/.test(lies("server/lib/fiaon-crons.ts")), "Läufe radar_post/radar_versand registriert, beschrieben und bewacht");

abschnitt("Signal-Jäger (E-337)");
const { signalPruefen } = await import("../server/lib/fiaon-radar");
const sSeite = [{ url: "https://firma.de/news", text: "Wir eröffnen 2026 drei neue Standorte in Bayern und suchen dafür Investoren für unser Wachstum." }];
const sBelegt = await signalPruefen({ art: "kapital_gesucht", beleg: "drei neue Standorte in Bayern und suchen dafür Investoren", url: "", staerke: 5 }, sSeite);
ok(sBelegt.signal?.geprueft === true && sBelegt.staerke === 5 && sBelegt.signal?.url === "https://firma.de/news", "Belegtes Signal: geprüft, Stärke 5, zeigt auf die Seite");
const sErfunden = await signalPruefen({ art: "crowd", beleg: "Wir sammeln gerade zwei Millionen Euro auf Companisto ein", url: "", staerke: 5 }, sSeite);
ok(sErfunden.signal?.geprueft === false && (sErfunden.staerke ?? 9) <= 2, "Unbelegtes Signal: höchstens Stärke 2 — Mara schreibt nicht selbst");
const sZuStark = await signalPruefen({ art: "finance_stelle", beleg: "drei neue Standorte in Bayern und suchen dafür Investoren", url: "", staerke: 5 }, sSeite);
ok(sZuStark.staerke === 3, `Stärke gedeckelt auf die Art + 1 (${sZuStark.staerke})`);
ok((await signalPruefen({ art: "gibtsnicht", beleg: "irgendein langer Satz ohne Bedeutung hier", url: "", staerke: 4 }, sSeite)).signal === null, "Unbekannte Signal-Art zählt nicht");
ok(RADAR_SIGNALE.every((x) => x.staerke >= 1 && x.staerke <= 5) && RADAR_SIGNALE.filter((x) => x.staerke >= RADAR_SIGNAL_AB).length >= 5, "Signale mit Stärke 1–5, mindestens fünf ab der Schwelle");
// E-458: Die Automatik der ersten Mails ist der Mail-Motor (fiaon-radar-motor.ts).
ok(/r\.signal_staerke IS NULL OR r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(lies("server/lib/fiaon-radar-motor.ts")) && /< RADAR_SIGNAL_AB\) \{[\s\S]{0,400}return verwerfen\(id,/.test(lies("server/lib/fiaon-radar-motor.ts")), "Automatik schreibt nur ab Signalstärke 3");

abschnitt("Nur Entscheider, menschliche Anrede, Signatur (E-337)");
const { radarAdressePersoenlich } = await import("../shared/fiaon-radar");
ok(!radarAdressePersoenlich("info@firma.de") && !radarAdressePersoenlich("office@firma.at", ["Max Muster"]) && !radarAdressePersoenlich("welcome@kraftblock.com", ["Martin Schichtel"]) && !radarAdressePersoenlich("gf@firma.de", ["Max Muster"]), "info@, office@, welcome@, gf@ sind nie persönlich");
ok(radarAdressePersoenlich("m.schichtel@kraftblock.com", ["Martin Schichtel"]) && radarAdressePersoenlich("claudius.zurlinden@foundingrestaurants.de", ["Claudius zur Linden"]) && radarAdressePersoenlich("jschmidt@firma.de", ["Jana Schmidt"]), "Persönliche Adressen passend zum Namen");
ok(!radarAdressePersoenlich("sabine@firma.de", ["Max Muster"]), "Adresse eines anderen Menschen passt nicht zum Entscheider");
const { anredeAusText } = await import("../server/lib/fiaon-radar-entscheider");
ok(anredeAusText("Geschäftsführer: Herr Claudius zur Linden", "zur Linden") === "Herr" && anredeAusText("Vertreten durch Frau Dr. Anna Berg", "Berg") === "Frau", "Herr/Frau nur, wenn es wörtlich dasteht");
ok(anredeAusText("Geschäftsführer: Claudius zur Linden", "zur Linden") === null, "Ohne Herr/Frau auf der Quelle wird nichts geraten");
ok(anredeFuer("Claudius zur Linden (Geschäftsführung)", "Herr") === "Hallo Herr zur Linden," && anredeFuer("Anna Berg", "Frau") === "Hallo Frau Berg,", "Menschliche Anrede mit Nachname (Partikel bleiben)");
ok(anredeFuer("Anna Berg", null) === "Guten Tag Anna Berg,", "Ohne belegte Anrede: voller Name");
const sig = await import("../server/lib/fiaon-signatur");
const sigHtml = sig.htmlAusText("Hallo Herr Muster,\n\nEin Satz.\n\nDirekt einen Termin wählen: https://fiaon.com/business?utm_source=radar#gespraech\n\nViele Grüße\nMara Lindner\nDigitale Assistentin\n\n—\nFIAON LTD · Fuß", sig.maraSignatur("Justin Schwarzott"));
ok(sigHtml.includes("/mail/signatur/mara.png") && sigHtml.includes("linie.gif") && sigHtml.includes("punkt.gif") && sigHtml.includes("Digitale Assistentin von Justin Schwarzott"), "Maras Karte: Porträt, Lichtlinie, Punkt, KI-Hinweis „Digitale Assistentin“");
ok(sigHtml.includes("Einen Termin wählen") && sigHtml.includes("FIAON LTD · Fuß") && !/Mara Lindner<br>Digitale/.test(sigHtml), "Termin als Link, Fuß klein, Textunterschrift durch die Karte ersetzt");
// E-458: die erste Mail trägt die ECHTE Gmail-Unterschrift des Postfachs (sendAs); Justins Karte nur noch als Rückweg für js@.
ok(/await absenderLesen\(postfach\)/.test(lies("server/lib/fiaon-radar.ts")) && /return postfach === "js@fiaon\.com" \? \{ \.\.\.radarKarteAbsender\(seite\), postfach \} : null;/.test(lies("server/lib/fiaon-radar.ts")), "Die erste Mail trägt die Gmail-Unterschrift des Postfachs, die Karte nur als Rückweg für js@");
ok((lies("server/lib/fiaon-radar-faden.ts").match(/htmlAusText\(/g) ?? []).length >= 2 && /antwortSenden\(String\(f\.postfach\), original, text, persoenlicheMailHtml\(teile\)/.test(lies("server/lib/fiaon-radar-faden.ts")), "Maras Antwort und Freigabe mit Karte, das Nachfassen mit der echten Unterschrift (E-458)");
ok(fs.existsSync(path.join(wurzel, "client/public/mail/signatur/mara.png")) && fs.existsSync(path.join(wurzel, "client/public/mail/signatur/linie.gif")), "Signaturbilder liegen öffentlich bereit");
ok(/radarAdressePersoenlich\(an, namen\)/.test(lies("server/lib/fiaon-radar.ts")), "Wand beim Senden: nur persönliche Adresse eines Entscheiders");
ok(/await schritte\.entscheider\(id, false\);[\s\S]{0,200}await schritte\.entscheider\(id, true\)/.test(lies("server/lib/fiaon-radar-motor.ts")) && /entscheiderFinden\(id, \{ websuche \}\)/.test(lies("server/lib/fiaon-radar-motor.ts")), "Automatik: Entscheider erst Website, dann (nach Signal) Websuche");
ok(mailPruefen({ ...sauber, absaetze: ["Das ist ein sehr langer Satz mit wirklich vielen Wörtern, der sich überhaupt nicht wie eine menschliche Mail liest, sondern wie ein Prospekt aus einer Agentur."] }).warnungen.some((x) => /24 Wörter/.test(x)), "Lange Sätze werden gemeldet");

abschnitt("Archiv und „nur qualifiziert“ (E-337)");
const libA = lies("server/lib/fiaon-radar.ts"), fadenA = lies("server/lib/fiaon-radar-faden.ts"), briefA = lies("server/lib/fiaon-radar-brief.ts");
ok(RADAR_GRUPPEN[0].key === "qualifiziert" && RADAR_GRUPPEN.some((g) => g.archiv), "Startreiter „Qualifiziert“, eigener Reiter „Archiv“");
ok(/\(archiviert_am IS NOT NULL\) = \$\{archiv\}/.test(libA), "Die Liste zeigt Archiv und Bestand getrennt");
ok(/r\.archiviert_am IS NULL/.test(lies("server/lib/fiaon-radar-motor.ts")) && /archiviert_am IS NULL/.test(fadenA) && /archiviert_am IS NULL/.test(briefA), "Archivierte Firmen bekommen weder Mail noch Brief");
ok(/nachfass_faellig <= NOW\(\) AND archiviert_am IS NULL/.test(fadenA), "Kein Nachfassen an archivierte Firmen");
ok(/status NOT IN \('antwort', 'lead', 'termin', 'angebot', 'kauf'\)/.test(libA), "Firmen im Gespräch werden nie archiviert");
ok(/if \(\(sig\.staerke \?\? 0\) < RADAR_SIGNAL_AB\)/.test(libA), "Neue Funde ohne Signal ≥ 3 gehen gleich ins Archiv");

abschnitt("Quelltext-Wände");
const routen = lies("server/routes/fiaon-radar.ts");
const wege = routen.split("\n").filter((z) => /^router\.(get|post|put|delete)\(/.test(z));
ok(wege.length >= 11 && wege.every((z) => z.includes(", wache,")), `Jede Route hinter der Wache (${wege.length} Wege)`);
ok(/requireChef\("geschaeftsfuehrung"\)/.test(routen), "Wache = Geschäftsführung");
ok(/art === "senden" && req\.body\?\.bestaetigt !== true/.test(routen), "Senden nur mit Bestätigung");
ok(/post\/:id\/senden[\s\S]{0,200}req\.body\?\.bestaetigt !== true/.test(routen), "Maras Antwort aus dem Chefbüro nur mit Bestätigung");
const lib = lies("server/lib/fiaon-radar.ts");
ok(!/JSON\.stringify\([^)]*\)\}::jsonb/.test(lib), "JSONB nie als JSON-Text mit ::jsonb");
ok(/je Firma genau eine/.test(lib) && /f\.status === "versendet" \|\| f\.versendet_am/.test(lib), "Je Firma genau eine erste Mail");
ok(/radarPostfaecher\(\)\.includes\(postfach\)/.test(lib), "Nur freigegebene Postfächer");
ok(/await gesperrt\(an, f\.domain\)/.test(lib), "Sperrliste vor jedem Versand");
ok(/f\.mail\.sperrend\?\.length/.test(lib), "Wortwand-Funde sperren Entwurf und Versand");
ok(/const jetzt = mailPruefen\(/.test(lib) && /nach alten Regeln geschrieben/.test(lib), "Beim Senden gilt die AKTUELLE Wand — alte Mails müssen neu geschrieben werden");
ok(/art === "senden" && ein\.bestaetigt !== true/.test(lib), "Stapel-Versand nur mit Bestätigung");
ok(/PAUSE_MS = \(\) => 20_000/.test(lib) && /art === "senden" && fertig < ids\.length/.test(lib), "Pause zwischen zwei Mails im Stapel");
ok(/RADAR_STAPEL_MAX\)/.test(lib), "Stapel ist begrenzt");
const stapelWege = routen.split("\n").filter((z) => /radar\/(stapel|lauf\/:id\/abbrechen|firma\/:id\/(nachsuchen|kontakt))/.test(z));
ok(stapelWege.length === 4 && stapelWege.every((z) => z.includes(", wache,")), `Stapel, Abbruch, Nachsuchen, Kontakt hinter der Wache (${stapelWege.length})`);
const seiten = lies("client/src/components/admin/chef-seiten.tsx");
ok(/slug: "firmen-radar"[^\n]*mindest: "geschaeftsfuehrung"/.test(seiten), "Chefbüro-Eintrag erst ab Geschäftsführung");
ok(!/firmen-radar|ChefRadar/.test(lies("client/src/pages/agent/firmen.tsx")), "Nicht im Office (Nikitas Cockpit)");
ok(/tageslauf\('firmen_radar'/.test(lies("server/routes.ts")) && /firmen_radar:/.test(lies("server/lib/fiaon-crons.ts")), "Tageslauf registriert und beschrieben");

abschnitt("Brief statt Mail (E-339)");
{
  const sh = await import("../shared/fiaon-radar");
  const br = await import("../server/lib/fiaon-radar-brief");
  const QRCode = (await import("qrcode")).default;
  // Schalter
  const v = sh.radarBriefEinstellungLesen({});
  ok(!v.versand && v.testmodus && v.anbieter === "pingen" && v.jeTag === 10 && v.farbe, "Ohne Einstellung: Versand aus, Testmodus an, Pingen, 10 je Tag, Farbe");
  ok(sh.radarBriefEinstellungLesen({ radar_brief_je_tag: "500" }).jeTag === sh.RADAR_BRIEF_HOECHSTENS_JE_TAG, `Tageskontingent gedeckelt auf ${sh.RADAR_BRIEF_HOECHSTENS_JE_TAG}`);
  ok(sh.radarBriefEinstellungLesen({ radar_brief_testmodus: "quatsch" }).testmodus && !sh.radarBriefEinstellungLesen({ radar_brief_testmodus: "aus" }).testmodus, "Echte Briefe nur mit ausdrücklichem „aus“ beim Testmodus");
  ok(sh.radarBriefEinstellungLesen({ radar_brief_anbieter: "post" }).anbieter === "pingen" && sh.radarBriefEinstellungLesen({ radar_brief_anbieter: "letterxpress" }).anbieter === "letterxpress", "Versanddienst: nur Pingen oder LetterXpress");
  ok(sh.radarBriefKosten("pingen", "DE").cents === 114 && !sh.radarBriefKosten("pingen", "DE").geschaetzt && sh.radarBriefKosten("letterxpress", "AT").geschaetzt, "Kosten je Brief: Pingen DE 1,14 €, LetterXpress Ausland als Schätzung markiert");
  // QR-Link und Kennung
  const link = sh.radarBriefLink(1078);
  ok(link === "https://fiaon.com/business?utm_source=radar_brief&utm_content=r1078#gespraech", `QR-Link wie verlangt (${link})`);
  ok(sh.radarKennungLesen("r1078") === 1078 && sh.radarKennungLesen("1078") === null && sh.radarKennungLesen("r12x") === null && sh.radarBriefKennung(1078) === "R-1078", "Kennung r<ID> wird streng gelesen");
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" }) as any;
  ok(qr.segments.map((x: any) => String(x.data ?? "")).join("") === link || qr.segments.some((x: any) => Buffer.from(x.data ?? []).toString() === link), "Der QR-Code trägt genau diesen Link");
  ok((await br.briefQrSvg(link)).startsWith("<svg"), "QR-Code als SVG (scharf im Druck)");
  // Name und Anschrift
  ok(sh.radarNameSchreibweise("ANDREAS SCHMALE") === "Andreas Schmale" && sh.radarNameSchreibweise("HANS-PETER MÜLLER") === "Hans-Peter Müller", "Versalien aus dem Impressum werden normal geschrieben");
  ok(sh.radarNameSchreibweise("CLAUDIUS ZUR LINDEN") === "Claudius zur Linden" && sh.radarNameSchreibweise("Anna-Lena McLean") === "Anna-Lena McLean", "Partikel klein, gemischte Schreibung bleibt");
  const imp = { name: "schmale Maschinenbau GmbH", strasse: "Altenaer Straße 95", plz: "58762", ort: "Altena", land: "DE",
    vertreter: [{ name: "Max Muster", funktion: "Datenschutzbeauftragter" }, { name: "ANDREAS SCHMALE", funktion: "Geschäftsführender Gesellschafter" }] };
  const an = sh.radarBriefAnschrift(imp, { anrede: "Herr" });
  ok(JSON.stringify(an.zeilen) === JSON.stringify(["schmale Maschinenbau GmbH", "Herrn Andreas Schmale", "Altenaer Straße 95", "58762 Altena", "DEUTSCHLAND"]) && !an.fehlt.length, `Anschrift nach DIN 5008 (${an.zeilen.join(" | ")})`);
  ok(sh.radarBriefAnschrift(imp, {}).zeilen[1] === "Andreas Schmale", "Ohne belegte Anrede kein „Herrn“ — das Geschlecht wird nie geraten");
  ok(sh.radarBriefAnschrift({ ...imp, vertreter: [{ name: "Anna Berg", funktion: "Geschäftsführerin" }] }, { anrede: "Frau" }).zeilen[1] === "Frau Anna Berg", "„Frau“ nur mit Beleg");
  ok(sh.radarBriefPerson(imp)?.name === "Andreas Schmale", "Die Geschäftsführung, nicht der Datenschutzbeauftragte");
  ok(sh.radarBriefPerson({ vertreter: [{ name: "Max Muster", funktion: "Datenschutzbeauftragter" }] }) === null, "Nur ein Datenschutzbeauftragter: kein Empfänger");
  ok(sh.radarBriefAnschrift({ ...imp, strasse: "Altenaer Straße" }).fehlt.includes("Straße mit Hausnummer") && sh.radarBriefAnschrift({ ...imp, plz: "5876" }).fehlt.includes("Postleitzahl"), "Unvollständige Anschrift wird gemeldet");
  const at = sh.radarBriefAnschrift({ ...imp, land: "AT", plz: "1010", ort: "Wien" });
  ok(!at.fehlt.length && at.zeilen[at.zeilen.length - 1] === "ÖSTERREICH", "Österreich: vierstellige PLZ, Landeszeile");
  ok(br.briefAnrede(an) === "Guten Tag Herr Schmale," && br.briefAnrede(sh.radarBriefAnschrift(imp, {})) === "Guten Tag Andreas Schmale,", "Anrede nach der Regel der Mail — auf Papier „Guten Tag“");
  // Wer bekommt einen Brief?
  const basis = { status: "gescannt", land: "DE", signal_staerke: 4, impressum: imp, name: imp.name, entscheider: null, versendet_am: null, brief_versendet_am: null };
  ok(sh.radarBriefPruefen(basis).ok, "Signal 4, keine persönliche Adresse, Anschrift vollständig → Brief");
  ok(!sh.radarBriefPruefen({ ...basis, signal_staerke: 2 }).ok && !sh.radarBriefPruefen({ ...basis, signal_staerke: null }).ok, `Unter Stärke ${sh.RADAR_SIGNAL_AB} oder ungeprüft: kein Brief`);
  ok(!sh.radarBriefPruefen({ ...basis, entscheider: { name: "Andreas Schmale", email: "a.schmale@schmale-gmbh.de" } }).ok, "Persönliche Adresse bekannt → die Mail geht vor");
  ok(sh.radarBriefPruefen({ ...basis, entscheider: { name: "Andreas Schmale", email: "info@schmale-gmbh.de" } }).ok, "Nur info@ bekannt → Brief");
  ok(!sh.radarBriefPruefen({ ...basis, versendet_am: "2026-10-01" }).ok && !sh.radarBriefPruefen({ ...basis, brief_versendet_am: "2026-10-01" }).ok, "Schon angeschrieben oder schon ein Brief → kein (zweiter) Brief");
  ok(!sh.radarBriefPruefen({ ...basis, status: "gesperrt" }).ok && !sh.radarBriefPruefen({ ...basis, status: "lead" }).ok, "Gesperrt oder im Gespräch → kein Brief");
  // Dieselben Wände wie die Mail
  const sauberB = { betreff: "Ihre neue Halle in Altena", absaetze: ["Ich habe gelesen, dass Sie in Altena eine neue Halle bauen. Neue Hallen kosten Geld, lange bevor sie welches verdienen.", `${RADAR_KERNSATZ.was} ${RADAR_KERNSATZ.vorteil}`, "In einem Gespräch von 30 Minuten sehen wir gemeinsam, ob dieser Weg zu Ihren Plänen passt."], frage: "Darf ich Ihnen das einmal in Ruhe zeigen?" };
  ok(br.briefPruefen(sauberB).sperrend.length === 0 && !br.briefPruefen(sauberB).warnungen.some((w) => /^Lang \(/.test(w)), `Sauberer Brief sperrt nicht (${br.briefPruefen(sauberB).sperrend.join("; ")}${br.briefPruefen(sauberB).warnungen.join("; ")})`);
  ok(br.briefPruefen({ ...sauberB, absaetze: ["Ziel sind 250.000 $ für Ihre Expansion."] }).sperrend.some((x) => /Betrag/.test(x)), "Betrag im Brief sperrt");
  ok(br.briefPruefen({ ...sauberB, absaetze: ["Wir öffnen Ihnen einen Kapitalrahmen."] }).sperrend.some((x) => /Kapitalrahmen/.test(x)), "Kapitalrahmen im Brief sperrt");
  ok(br.briefPruefen({ ...sauberB, absaetze: ["Über Rahmen und Bedingungen entscheidet das jeweilige Institut."] }).sperrend.some((x) => /Institut-Satz/.test(x)), "Institut-Satz im Brief sperrt");
  ok(br.briefPruefen({ ...sauberB, absaetze: ["Die Karte kommt garantiert."] }).sperrend.length > 0, "„garantiert“ sperrt (Wortwand)");
  ok(br.briefPruefen({ ...sauberB, absaetze: ["Mehr unter https://fiaon.com oder js@fiaon.com."] }).warnungen.some((w) => /Link oder Mailadresse/.test(w)), "Link oder Mailadresse im Text wird gemeldet");
  ok(sh.RADAR_BRIEF_TEXTE.widerspruch("R-1", "js@fiaon.com", "+41").includes("Art. 21 DSGVO") && /Datenschutzbeauftragt|Art\. 6 Abs\. 1 lit\. f/.test(sh.RADAR_BRIEF_TEXTE.datenschutz("dem Impressum")), "Widerspruch (Art. 21) und Rechtsgrundlage (Art. 6 Abs. 1 lit. f) stehen auf dem Brief");
  ok(sh.RADAR_BRIEF_TEXTE.datenschutz("dem Impressum Ihrer Website firma.de").includes("dem Impressum Ihrer Website firma.de") && /Kennnummer/.test(sh.RADAR_BRIEF_TEXTE.datenschutz("x")), "Datenschutzhinweis nennt Herkunft der Daten und die Kennnummer im Code");
  const texteAlle: string[] = []; for (const w of Object.values(sh.RADAR_BRIEF_TEXTE)) texteAlle.push(typeof w === "function" ? (w as any)("Muster", "Muster", "Muster") : String(w));
  ok(globalWortPruefen(texteAlle.join("\n")).length === 0, "Feste Brieftexte bestehen die Global-Wortwand");
  // Das Blatt
  const brief: any = { ...sauberB, betreff: "<script>alert(1)</script>", anrede: "Guten Tag Herr Schmale,", empfaenger: an, quelle: "dem Impressum Ihrer Website schmale-gmbh.de",
    kennung: "R-1078", link, antwortAn: "js@fiaon.com", warnungen: [], sperrend: [], geaendert: false, erstellt_am: "2026-10-12T19:00:00Z" };
  const h = br.briefHtml(brief, { qrSvg: await br.briefQrSvg(link), farbe: true, datum: new Date("2026-10-12T12:00:00Z") });
  ok(!/<script>alert/.test(h) && h.includes("&lt;script&gt;"), "HTML maskiert — kein eingeschleuster Code");
  ok(/\.fenster \{ position: absolute; top: 45mm; left: 20mm; width: 85mm; height: 45mm; \}/.test(h) && /padding: 98\.5mm/.test(h) && /@page \{ size: A4; margin: 0; \}/.test(h), "DIN 5008 Form B: Anschriftfeld 20/45 mm, 85 × 45 mm, Betreff bei 98,5 mm, A4 ohne Rand");
  ok(h.includes("Herrn Andreas Schmale") && h.includes(sh.RADAR_BRIEF_TEXTE.ruecksendung) && h.includes("12. Oktober 2026") && h.includes("R-1078"), "Anschrift, Rücksendeangabe, Datum (Berlin) und Kennung auf dem Blatt");
  ok(h.includes("Keine Post mehr von uns?") && h.includes("Datenschutzhinweis") && h.includes(FIAON_FIRMA.companyNo), "Widerspruch abgesetzt, Datenschutzhinweis, Firmenangaben");
  ok(/#288DFA/i.test(h) && !/gold|#c9a2|#d4af|#b8860b/i.test(h), "Glasblau, kein Gold");
  ok(!/#288DFA/i.test(br.briefHtml(brief, { qrSvg: "<svg></svg>", farbe: false })), "Graustufen-Fassung ohne Blau");
  // Besuche und Versand-Wände ohne Datenbank
  ok(!(await br.radarBriefBesuchMerken("r12", "Googlebot/2.1")) && !(await br.radarBriefBesuchMerken("12", "Mozilla/5.0")) && !(await br.radarBriefBesuchMerken("r12", "")), "Roboter, falsche Kennung und leere Kennung zählen nicht als Besuch");
  let warf: any = null;
  try { await br.radarBriefEinstellungSetzen({ versand: true, anbieter: "pingen" }); } catch (e) { warf = e; }
  ok(warf?.status === 409 && /Zugangsdaten/.test(String(warf?.message)), "Briefversand lässt sich ohne Zugangsdaten nicht einschalten");
  // Quelltext-Wände
  const blib = lies("server/lib/fiaon-radar-brief.ts");
  ok(/if \(!s\.versand\) throw new RadarFehler/.test(blib) && /anbieterBereit\(s\.anbieter\)/.test(blib), "Senden nur mit Schalter und eingerichtetem Dienst");
  ok(/pg_advisory_xact_lock\(339001\)/.test(blib) && /brief_versendet_am IS NULL AND COALESCE\(brief_status, 'entwurf'\) NOT IN \('sendet', 'uebergeben', 'versendet'\)/.test(blib), "Kontingent und „genau ein Brief“ unter einer Sperre");
  ok(/const jetzt = briefPruefen\(brief\)/.test(blib) && /nach alten Regeln geschrieben/.test(blib), "Beim Senden gilt die AKTUELLE Wand");
  ok(/auto_send: !ein\.test/.test(blib) && /mode: ein\.test \? "test" : "live"/.test(blib), "Testmodus: Pingen ohne Absenden, LetterXpress in die Postbox");
  ok(/if \(seiten > 2\)/.test(blib) && /await gesperrt\(f\.email \?\? null, f\.domain\)/.test(blib), "Höchstens zwei Seiten; Sperrliste vor jedem Brief");
  const pdfLib = lies("server/lib/fiaon-html-pdf.ts");
  const blatt = pdfLib.slice(pdfLib.indexOf("export async function htmlZuPdfBlatt"), pdfLib.indexOf("// EINE ECHTE LAUFENDE FUSSZEILE"));
  ok(blatt.length > 50 && !/renderPdfKitFallback/.test(blatt) && /preferCSSPageSize: true/.test(blatt), "Brief-PDF ohne pdfkit-Notbehelf (sonst verrutscht die Anschrift)");
  const r = lies("server/routes.ts");
  ok(r.indexOf("app.get('/business', (req, _res, next)") > 0 && r.indexOf("app.get('/business', (req, _res, next)") < r.indexOf("seiteUnbekannt(req.path)") && /radarBriefBesuchMerken\(req\.query\.utm_content, req\.get\('user-agent'\)\)/.test(r) && /next\(\);\n  \}\);/.test(r), "QR-Besuche werden vor dem Seitenaufbau gemerkt — die Seite läuft weiter");
  ok(/tageslauf\('radar_brief'/.test(r) && /radar_brief: \{/.test(lies("server/lib/fiaon-crons.ts")) && /radar_brief: \(e\)/.test(lies("server/lib/fiaon-crons.ts")), "Lauf radar_brief registriert, beschrieben und bewacht");
  const fd = lies("server/lib/fiaon-radar-faden.ts");
  ok(/z\.utm_source IN \('radar', 'radar_brief'\)/.test(fd) && /FROM fiaon_radar_besuche WHERE quelle = 'radar_brief'/.test(fd) && /INTERVAL '13 months'/.test(fd), "Abgleich zählt Termine/Aufträge aus dem Brief und die QR-Besuche (13 Monate)");
  ok(/OR \(\$\{briefPostfach\} AND brief_versendet_am IS NOT NULL\)/.test(fd), "Mails von Brief-Firmen liest der Antwort-Wächter — eine Absage sperrt (Widerspruch)");
  ok(/AS briefe/.test(fd) && /AS besuche/.test(fd) && /"briefKostenCents"/.test(fd), "Trichter je Tag: Briefe, QR-Besuche, Porto");
  ok(/RADAR_BRIEF_TEXTE/.test(lies("scripts/pruef-wortwand-de.ts")), "Die festen Brieftexte stehen in der deutschen Wortwand");
  const rt = lies("server/routes/fiaon-radar.ts");
  ok(/brief\/senden[\s\S]{0,260}req\.body\?\.bestaetigt !== true/.test(rt) && /brief\.pdf", wache,/.test(rt), "Brief senden nur mit Bestätigung, PDF nur hinter der Wache");
  const ui = lies("client/src/components/admin/ChefRadar.tsx");
  ok(/\["brief", "Brief"\]/.test(ui) && /<BriefReiter /.test(ui) && /<BriefKachel \/>/.test(ui) && /cr-trichter-brief/.test(ui), "Chefbüro: Akte › Brief, Automatik › Briefe, Brief-Kanal im Trichter");
}

abschnitt("Maras Szenarien (E-361)");
{
  const { RADAR_SZENARIEN } = await import("../shared/fiaon-radar-szenarien");
  const { radarPlan, radarBuchungslink, radarRoboter, RADAR_ANTWORT_SCHLUESSEL } = await import("../shared/fiaon-radar");
  const { absenderTeile, datenschutzEntwurf } = await import("../server/lib/fiaon-radar-faden");
  for (const sz of RADAR_SZENARIEN) {
    const { adresse } = absenderTeile(sz.von);
    const vorab = antwortVorab({ vonAdresse: adresse, betreff: sz.betreff, text: antwortKern(sz.text) || sz.text });
    if (sz.regel === true) ok(vorab === sz.erwartet, `Regel erkennt „${sz.titel}“ als ${sz.erwartet} (ist: ${vorab})`);
    if (sz.regel === false) ok(vorab === null, `Regel schlägt bei „${sz.titel}“ nicht fälschlich an (ist: ${vorab})`);
  }
  const abgedeckt = new Set(RADAR_SZENARIEN.map((x) => x.erwartet));
  for (const k of RADAR_ANTWORT_SCHLUESSEL) ok(abgedeckt.has(k), `Der Katalog hat ein Szenario für „${k}“`);
  ok(new Set(RADAR_SZENARIEN.map((x) => x.key)).size === RADAR_SZENARIEN.length && RADAR_SZENARIEN.length >= 30, "Mindestens 30 Szenarien, Schlüssel eindeutig");
  ok(RADAR_ANTWORT_SCHLUESSEL.length === 18 && RADAR_ANTWORT_SCHLUESSEL.every((k) => RADAR_ANTWORT_ARTEN[k].was.length > 10), "18 Arten, jede mit einem Satz, was passiert");

  const basis = { art: "termin_wunsch" as const, maraModus: "auto" as const, postfachJs: false, frisch: true, roboter: false, buchungslink: null, wunschFrei: true, telefon: true, maraHeute: 0 };
  let pl = radarPlan(basis);
  ok(pl.buchen && pl.mara === "senden" && pl.aufgabe && pl.dringend, "Freie Wunschzeit + Telefon + „auto“ → Mara trägt ein, antwortet, dringende Aufgabe");
  pl = radarPlan({ ...basis, postfachJs: true });
  ok(pl.buchen && pl.mara === "entwurf", "js@: eintragen ja (Bestätigung kommt vom System), Maras Antwort nur als Entwurf (E-171)");
  pl = radarPlan({ ...basis, maraModus: "entwurf" });
  ok(!pl.buchen && pl.mara === "entwurf" && pl.schritte.some((x) => /Termin eintragen/.test(x)), "Schalter „Zur Freigabe“: nichts selbst eintragen — Knopf „Termin eintragen“");
  pl = radarPlan({ ...basis, telefon: false });
  ok(!pl.buchen && pl.schritte.some((x) => /Telefonnummer fehlt/.test(x)), "Ohne Telefonnummer kein Eintrag — Mara fragt danach");
  pl = radarPlan({ ...basis, buchungslink: "https://calendly.com/x" });
  ok(!pl.buchen && pl.mara === "entwurf" && pl.dringend, "Eigener Buchungskalender der Firma: kein Eintrag bei uns, Entwurf, dringende Aufgabe");
  pl = radarPlan({ ...basis, maraHeute: 3 });
  ok(pl.mara === "entwurf", "Schleifenbremse: nach drei eigenen Antworten im Faden nur noch Entwurf");
  pl = radarPlan({ ...basis, art: "termin_abgesagt", roboter: true, wunschFrei: false });
  ok(pl.mara === "keine" && pl.aufgabe && pl.dringend, "Kalender-Absage von einer Maschine: keine Antwort, dringende Aufgabe");
  pl = radarPlan({ ...basis, art: "termin_gebucht", wunschFrei: false });
  ok(pl.mara === "keine" && pl.aufgabe && !pl.buchen && !pl.dringend, "Termin gebucht: keine Antwort an den Kalender, Aufgabe");
  pl = radarPlan({ ...basis, art: "datenschutz", frisch: false, wunschFrei: false });
  ok(pl.mara === "entwurf" && pl.sperre && pl.aufgabe && pl.dringend, "Datenschutz: immer Entwurf, Sperrliste, dringend — auch eine alte Mail");
  pl = radarPlan({ ...basis, art: "rechtlich", wunschFrei: false });
  ok(pl.mara === "keine" && pl.sperre && pl.dringend, "Anwalt/Abmahnung: nie antworten, Sperrliste, dringend");
  pl = radarPlan({ ...basis, art: "kein_interesse", wunschFrei: false });
  ok(pl.mara === "keine" && pl.sperre && !pl.aufgabe, "Absage: Sperrliste, keine Antwort, keine Aufgabe");
  pl = radarPlan({ ...basis, art: "sonstiges", wunschFrei: false });
  ok(pl.mara === "entwurf", "Sonstiges: Mara schreibt nur einen Entwurf");
  pl = radarPlan({ ...basis, art: "einwand" });
  ok(pl.mara === "senden" && !pl.buchen && !pl.dringend, "Einwand: Mara antwortet einmal, bucht nie");
  pl = radarPlan({ ...basis, frisch: false });
  ok(pl.mara === "keine" && !pl.buchen && !pl.aufgabe, "Alte Mail (Nachholen): nur einordnen");
  pl = radarPlan({ ...basis, maraModus: "aus" });
  ok(pl.mara === "keine" && !pl.buchen, "Mara aus: keine Antwort, kein Eintrag");
  pl = radarPlan({ ...basis, roboter: true });
  ok(pl.mara === "keine" && !pl.buchen, "Einer Maschine antwortet Mara nie");

  ok(radarBuchungslink("Buch dir über meinen Link: https://calendar.app.google/AbC123.") === "https://calendar.app.google/AbC123", "Google-Terminplan erkannt, Satzzeichen am Ende ab");
  ok(radarBuchungslink("https://calendly.com/max-muster/30min") !== null && radarBuchungslink("https://outlook.office365.com/owa/calendar/Muster@firma.de/bookings/") !== null && radarBuchungslink("https://meetings-eu1.hubspot.com/max") !== null, "Calendly, Microsoft Bookings, HubSpot erkannt");
  ok(radarBuchungslink("Termin: https://fiaon.com/business?utm_source=radar#gespraech") === null && radarBuchungslink("Unsere Seite: https://musterfirma.de/kontakt") === null, "Unser eigener Link und normale Seiten zählen nicht");
  ok(radarRoboter("calendar-notification@google.com") && radarRoboter("info+noreply@greenlyte.tech") && radarRoboter("no-reply@calendly.com") && !radarRoboter("joerg.bluemel@pakajo.world") && !radarRoboter("info@musterfirma.de"), "Maschinen-Absender erkannt, Menschen nicht");
  ok(absenderTeile("\"Jörg Blümel\" <Joerg.Bluemel@pakajo.world>").name === "Jörg Blümel" && absenderTeile("x@y.de").name === "" && absenderTeile("Jörg <J@p.de>").adresse === "j@p.de", "Absender in Name und Adresse zerlegt");
  ok(antwortVorab({ vonAdresse: "newsletter@musterfirma.de", betreff: "Einladung: Herbst-Webinar", text: "Jetzt anmelden" }) === null, "„Einladung:“ ohne Kalender-Merkmal ist kein Termin");
  ok(antwortVorab({ vonAdresse: "a@b.de", betreff: "AW: x", text: "Wir sind DSGVO-konform aufgestellt — wie ist das bei Ihnen?" }) === null, "„DSGVO“ in einer Frage ist kein Datenschutz-Antrag");
  const ds = datenschutzEntwurf({ name: "Musterfirma", domain: "musterfirma.de", email: "max@musterfirma.de", impressum: { seite: "https://musterfirma.de/impressum" } }, "Max Muster <max@musterfirma.de>", false);
  ok(/https:\/\/musterfirma\.de\/impressum/.test(ds) && /Art\. 15 DSGVO/.test(ds) && /gesperrt/.test(ds) && globalWortPruefen(ds).length === 0 && !/Mara Lindner/.test(ds) && /^Guten Tag Max Muster,/.test(ds), "Datenschutz-Antwort: Quelle, Art. 15, Sperrvermerk, Wortwand sauber, von Justin");
  const dsEn = datenschutzEntwurf({ name: "Muster", domain: "muster.com", website: "https://muster.com" }, "tom@muster.com", true);
  ok(/^Hello,/.test(dsEn) && /Art\. 15 GDPR/.test(dsEn) && /https:\/\/muster\.com/.test(dsEn), "Datenschutz-Antwort auf Englisch");

  const sigEn = sig.htmlAusText("Dear Max Muster,\n\nOne sentence.\n\nBook a time directly: https://fiaon.com/en/business?utm_source=radar#gespraech\n\nBest regards\nMara Lindner\nDigital assistant\n\n—\nFIAON LTD · Fuß", sig.maraSignatur("Justin Schwarzott", { rolle: "Digital assistant to Justin Schwarzott" }), "en");
  ok(sigEn.includes('lang="en"') && sigEn.includes("Choose a time") && sigEn.includes("Best regards") && sigEn.includes("Digital assistant to Justin Schwarzott") && !/Mara Lindner<br>Digital/.test(sigEn), "Englische Antwort: lang=en, „Choose a time“, Karte mit KI-Hinweis");

  const fd = lies("server/lib/fiaon-radar-faden.ts");
  const probe = fd.slice(fd.indexOf("export async function radarMaraProbe"), fd.indexOf("// ── ABGLEICH: TERMIN, ANGEBOT, KAUF"));
  ok(probe.length > 500 && !/INSERT|UPDATE|DELETE|antwortSenden|globalTerminBuchen|radarTerminEintragen|aufgabeFuerJustin/.test(probe), "„Mara testen“ schreibt, sendet und bucht nichts");
  ok(/darfSenden = opts\.sendenErlaubt && !pruefung\.length && p\.postfach !== "js@fiaon\.com" && regel\?\.mara === "antwort" && !p\.buchungslink && !radarRoboter/.test(fd), "Mara sendet nie aus js@, nie an Maschinen, nie bei fremdem Buchungslink, nur Arten mit Antwort");
  ok(/Wiedervorlage \(E-361\)[\s\S]{0,1600}wiedervorlage_am = NULL WHERE id = \$\{w\.id\} AND wiedervorlage_am <= NOW\(\) RETURNING id/.test(fd), "Wiedervorlage: atomar geholt, dann schreibt Mara im Faden");
  ok(/const plan = radarPlan\(\{/.test(fd) && /if \(plan\.buchen\)/.test(fd), "Der Wächter entscheidet über radarPlan — dieselbe Regel wie „Mara testen“");
  const rt = lies("server/routes/fiaon-radar.ts");
  ok(/"\/chef\/radar\/mara-probe", wache/.test(rt) && /"\/chef\/radar\/mara-szenarien", wache/.test(rt) && /"\/chef\/radar\/post\/:id\/termin", wache[\s\S]{0,120}bestaetigt !== true/.test(rt), "Neue Routen hinter der Wache, Termin nur mit Bestätigung");
  const ui = lies("client/src/components/admin/ChefRadar.tsx");
  ok(/<MaraTesten \/>/.test(ui) && /Alle \$\{RADAR_SZENARIEN\.length\} Szenarien prüfen/.test(ui) && /Termin \{wunschLesbar\(p\.wunsch_termin!\)\} eintragen/.test(ui), "Chefbüro: „Mara testen“, „Alle Szenarien prüfen“, „Termin eintragen“");
}

// ═══════════════════════════════════════════════════════════════════════════
// E-458 (29.10.2026) — DER MAIL-MOTOR. Testdaten erfunden (example.com), keine echten Firmen.
// ═══════════════════════════════════════════════════════════════════════════
const sh8 = await import("../shared/fiaon-radar");

abschnitt("Mail-Motor: Schalter, Fenster, Takt (E-458)");
{
  const v = sh8.radarMotorLesen({});
  ok(JSON.stringify(v.tage) === "[1,2,3,4,5]" && v.von === "07:00" && v.bis === "19:00" && v.firmenJeStunde === 10 && v.partnerJeStunde === 10 && v.puffer === 1.2 && v.haltbarTage === 7,
    `Ohne Einstellung: Mo–Fr 07:00–19:00, je Strom 10 je Stunde, Puffer 1,2, haltbar 7 (${JSON.stringify(v)})`);
  const u = sh8.radarMotorLesen({ radar_motor_von: "25:00", radar_motor_firmen_je_stunde: "-3", radar_motor_partner_je_stunde: "abc", radar_motor_puffer: "-3", radar_motor_tage: "abc", radar_motor_haltbar_tage: "abc" });
  ok(u.von === "07:00" && u.firmenJeStunde === 10 && u.partnerJeStunde === 10 && u.puffer === 1.2 && JSON.stringify(u.tage) === "[1,2,3,4,5]" && u.haltbarTage === 7, "Unsinn („25:00“, „-3“, „abc“) fällt auf die Vorgabe");
  const g = sh8.radarMotorLesen({ radar_motor_von: "20:00", radar_motor_bis: "19:00" });
  ok(g.von === "07:00" && g.bis === "19:00", "von ≥ bis fällt auf die Vorgabe");
  ok(sh8.radarMotorLesen({ radar_motor_firmen_je_stunde: "500" }).firmenJeStunde === sh8.RADAR_MOTOR_HOECHSTENS_JE_STUNDE && sh8.radarMotorLesen({ radar_motor_partner_je_stunde: "0" }).partnerJeStunde === 0, "Je Stunde über 30 wird gedeckelt, 0 schaltet den Strom aus");
  const eigen = sh8.radarMotorLesen({ radar_motor_von: "7:30", radar_motor_bis: "18:00", radar_motor_tage: "6,1,2,9" });
  ok(eigen.von === "07:30" && eigen.bis === "18:00" && JSON.stringify(eigen.tage) === "[1,2,6]", `Eigene Tage und Zeiten werden gelesen (${JSON.stringify(eigen)})`);
  const im = (iso: string, m = v) => sh8.radarMotorImFenster(new Date(iso), m);
  ok(im("2026-10-29T07:00:00+01:00") && !im("2026-10-29T06:59:00+01:00") && im("2026-10-29T18:59:00+01:00") && !im("2026-10-29T19:00:00+01:00"), "Do 29.10. (Winterzeit): 07:00 ja, 06:59 nein, 18:59 ja, 19:00 nein");
  ok(!im("2026-10-31T10:00:00+01:00") && im("2026-10-31T10:00:00+01:00", sh8.radarMotorLesen({ radar_motor_tage: "1,2,3,4,5,6" })), "Samstag 10:00 nein — mit Tagen 1–6 ja");
  ok(im("2026-03-30T07:00:00+02:00") && !im("2026-03-30T06:59:00+02:00") && !im("2026-03-29T10:00:00+02:00"), "Sommerzeit: Mo 30.03. 07:00 ja, 06:59 nein, Sonntag nein");
  ok(sh8.radarMotorFensterStunden(v) === 12 && sh8.radarMotorReststunden(new Date("2026-10-29T13:00:00+01:00"), v) === 6 && sh8.radarMotorReststunden(new Date("2026-10-31T13:00:00+01:00"), v) === 0, "Fenster 12 Stunden, um 13 Uhr noch 6, am Samstag 0");
  const soll = (iso: string, gesendet: number, letzte: string | null = null, extra: Record<string, unknown> = {}) =>
    sh8.radarMotorSoll({ jetzt: new Date(iso), m: v, jeStunde: 10, gesendetHeute: gesendet, letzteAm: letzte, ...extra });
  ok(soll("2026-10-29T07:30:00+01:00", 0).faellig, "10 je Stunde, 07:30, 0 gesendet → fällig");
  ok(!soll("2026-10-29T07:30:00+01:00", 6).faellig, "07:30 mit 6 gesendet → nicht fällig");
  const abstand = soll("2026-10-29T07:30:00+01:00", 2, "2026-10-29T07:28:00+01:00");
  ok(!abstand.faellig && abstand.abstandSek >= 216 && abstand.abstandSek <= 360, `Letzte Mail vor 120 s bei 360-s-Takt → nicht fällig (Abstand ${abstand.abstandSek} s)`);
  ok(soll("2026-10-29T07:30:00+01:00", 0, null, { bremse: 0.5 }).soll === 2.5 && soll("2026-10-29T07:30:00+01:00", 0).soll === 5, "Bremse 0,5 halbiert das Soll");
  ok(!soll("2026-10-29T19:30:00+01:00", 0).faellig && !soll("2026-10-31T10:00:00+01:00", 0).faellig && !soll("2026-10-29T06:30:00+01:00", 0).faellig, "Außerhalb des Fensters nie fällig");
  ok(!sh8.radarMotorSoll({ jetzt: new Date("2026-10-29T10:00:00+01:00"), m: v, jeStunde: 0, gesendetHeute: 0, letzteAm: null }).faellig, "Strom mit 0 je Stunde ist aus");
  let gesendet = 0, letzte: Date = new Date("2026-10-29T07:00:00+01:00"), maxJeTakt = 0, inZehn = 0;
  for (let t = 0; t < 10; t++) {
    const jetzt = new Date(Date.parse("2026-10-29T10:00:00+01:00") + t * 60_000);
    let jeTakt = 0;
    if (sh8.radarMotorSoll({ jetzt, m: v, jeStunde: 10, gesendetHeute: gesendet, letzteAm: letzte }).faellig) { gesendet++; letzte = jetzt; jeTakt++; inZehn++; }
    maxJeTakt = Math.max(maxJeTakt, jeTakt);
  }
  ok(maxJeTakt <= 1 && inZehn >= 1 && inZehn <= 3, `Nach 3 h Ausfall kein Schwall: ${inZehn} Mails in 10 Minuten, höchstens eine je Takt`);
  let tag = 0, letzteTag: Date | null = null;
  for (let t = 0; t < 12 * 60; t++) {
    const jetzt = new Date(Date.parse("2026-10-29T07:00:00+01:00") + t * 60_000);
    if (sh8.radarMotorSoll({ jetzt, m: v, jeStunde: 10, gesendetHeute: tag, letzteAm: letzteTag }).faellig) { tag++; letzteTag = jetzt; }
  }
  ok(tag >= 115 && tag <= 120, `Ein ganzer Tag im Minutentakt: ${tag} Mails (Ziel 10 × 12 = 120), gleichmäßig verteilt`);
}

abschnitt("Österreich: Brief statt Mail (E-458)");
{
  ok(sh8.radarLandFuer({ land: "AT" }) === "AT" && sh8.radarLandFuer({ land: "", domain: "beispiel.at" }) === "AT" && sh8.radarLandFuer({ impressum: { land: "CH" } }) === "CH" && sh8.radarLandFuer({}) === "DE", "Land: Spalte, sonst Impressum, sonst Domäne, sonst DE");
  ok(!sh8.radarMailErlaubt("AT") && sh8.radarMailErlaubt("DE") && sh8.radarMailErlaubt("CH"), "Mail nach DE und CH, nicht nach AT");
  const impAt = { name: "Beispiel Handel GmbH", strasse: "Musterstraße 1", plz: "1010", ort: "Wien", land: "AT", vertreter: [{ name: "Anna Beispiel", funktion: "Geschäftsführerin" }] };
  const atFirma = { status: "gescannt", land: "AT", signal_staerke: 4, impressum: impAt, name: impAt.name, domain: "beispiel-handel.example", entscheider: { name: "Anna Beispiel", email: "anna.beispiel@beispiel-handel.example" }, versendet_am: null, brief_versendet_am: null };
  ok(sh8.radarBriefPruefen(atFirma).ok, "Österreich mit persönlicher Adresse → Brief (die Mail geht dort nicht vor)");
  ok(!sh8.radarBriefPruefen({ ...atFirma, land: "DE", impressum: { ...impAt, land: "DE", plz: "10115", ort: "Berlin" } }).ok, "Deutschland mit persönlicher Adresse → die Mail geht vor");
  const lib8 = lies("server/lib/fiaon-radar.ts"), fd8 = lies("server/lib/fiaon-radar-faden.ts"), br8 = lies("server/lib/fiaon-radar-brief.ts");
  ok(/if \(!radarMailErlaubt\(radarLandFuer\(f\)\)\) throw new RadarFehler\("Österreich bekommt Briefe, keine Mails\."\)/.test(lib8), "radarMailAusgeben wirft für Österreich — gilt für Motor, Stapel und Akte");
  ok(/nachfass_stufe < [\s\S]{0,500}= ANY\(\$\{\[\.\.\.RADAR_NUR_BRIEF_LAENDER\]\}::text\[\]\)\)/.test(fd8) && /SET nachfass_faellig = NULL[\s\S]{0,600}RADAR_NUR_BRIEF_LAENDER/.test(fd8), "Kein Nachfassen nach Österreich (auch nicht auf eine alte erste Mail)");
  ok(/wiedervorlage_am <= NOW\(\)[\s\S]{0,700}RADAR_NUR_BRIEF_LAENDER/.test(fd8), "Keine Wiedervorlage-Mail nach Österreich");
  ok(/COALESCE\(r\.motor_status, ''\) NOT IN \('arbeit', 'bereit', 'sendet'\) AND r\.strom = 'firma'/.test(br8), "Brief-Lauf: kein Brief, solange die Mail in der Warteschlange liegt; nur Firmen");
  ok(/ADD COLUMN IF NOT EXISTS strom TEXT NOT NULL DEFAULT 'firma',[\s\S]{0,500}ADD COLUMN IF NOT EXISTS partner_firma_id INTEGER`/.test(lib8) && /fiaon_radar_firmen_motor_idx ON fiaon_radar_firmen \(motor_status, strom, signal_staerke\)/.test(lib8), "Neue Spalten in EINEM ALTER, Index für die Warteschlange");
}

abschnitt("Text und Unterschrift: menschlich, nie nach KI (E-458)");
{
  const lib = await import("../server/lib/fiaon-radar");
  const sig8 = await import("../server/lib/fiaon-signatur");
  const gm = await import("../server/lib/fiaon-gmail");
  const fd = await import("../server/lib/fiaon-radar-faden");
  const schluss = sh8.RADAR_SCHLUSSSAETZE[0];
  const basis = {
    betreff: "Ihre neue Halle",
    absaetze: [
      "Ich habe gesehen, dass Sie in diesem Jahr eine zweite Halle bauen. So ein Schritt bindet viel Kapital, lange bevor er etwas einbringt.",
      "Genau dafür bauen wir Unternehmern eine zweite Kapitalquelle auf. Wir gründen Ihnen eine eigene LLC in den USA, vergleichbar mit einer GmbH, und kümmern uns um Konto, Firmenkarten und den Weg zu US-Funding. Das Amerikanische erledigt unser Team vor Ort.",
    ],
    frage: "Wäre das für Ihre Pläne gerade ein Thema?", ps: "",
  };
  const o = { streng: true, strom: "firma" as const, anrede: "Hallo Frau Beispiel,", schluss, mitLink: true };
  const sp = (m: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => lib.mailPruefen({ ...basis, ...m } as any, { ...o, ...extra }).sperrend;
  const mit = (zusatz: string) => ({ absaetze: [`${basis.absaetze[0]} ${zusatz}`, basis.absaetze[1]] });
  ok(sp().length === 0, `Saubere Mail besteht die strengen Regeln (${sp().join("; ")})`);
  ok(sp(mit("Das ist mutig – und richtig.")).some((x) => /Gedankenstrich/.test(x)) && sp(mit("Das ist mutig—und richtig.")).some((x) => /Gedankenstrich/.test(x)) && sp(mit("Hamburg - Berlin.")).some((x) => /Gedankenstrich/.test(x)), "Streng: „ – “, „—“ und „ - “ sperren");
  ok(sp({ absaetze: [basis.absaetze[0], basis.absaetze[1].replace("vergleichbar mit einer GmbH", "das US-Gegenstück zur GmbH")] }).length === 0, "Streng: „US-Gegenstück“ sperrt nicht (Bindestrich ist kein Gedankenstrich)");
  ok(sp({ absaetze: [basis.absaetze[0], `- Punkt eins\n${basis.absaetze[1]}`] }).some((x) => /Aufzählung/.test(x)) && sp(mit("Das ist **wichtig**.")).some((x) => /Fettdruck/.test(x)) && sp(mit("Los geht es 🚀.")).some((x) => /Emoji/.test(x)), "Streng: Aufzählung, **fett** und Emoji sperren");
  ok(sp(mit("Mehr unter https://beispiel.example.")).some((x) => /Link im Text/.test(x)) && sp(mit("Mehr unter www.beispiel.example.")).some((x) => /Link im Text/.test(x)), "Streng: „https://“ und „www.“ im Text sperren");
  const woerter = (n: number) => sp({ absaetze: [Array.from({ length: n - 4 - schluss.split(/\s+/).length }, (_, i) => `Wort${i}`).join(" ")], frage: "Darf ich kurz nachfragen?" });
  ok(woerter(69).some((x) => /Zu kurz/.test(x)) && !woerter(70).some((x) => /Zu (kurz|lang)/.test(x)) && !woerter(130).some((x) => /Zu (kurz|lang)/.test(x)) && woerter(131).some((x) => /Zu lang/.test(x)), "Streng: 69 Wörter sperrt, 70 und 130 gehen, 131 sperrt (mit Schlusssatz)");
  ok(sp({ frage: "Passt das? Oder lieber später?" }).some((x) => /Genau eine Frage/.test(x)) && sp({ frage: "Wäre das für Ihre Pläne gerade ein Thema." }).some((x) => /endet nicht mit/.test(x)), "Streng: zwei Fragezeichen sperren, eine Frage ohne „?“ sperrt");
  for (const fl of ["Ich hoffe, diese Nachricht erreicht Sie gut.", "Das ist spannend.", "In der heutigen Zeit zählt das.", "Wir arbeiten maßgeschneidert.", "Alles läuft nahtlos."]) ok(sp(mit(fl)).some((x) => /Floskel/.test(x)), `Streng: „${fl}“ sperrt`);
  ok(sp(mit("Hast du Zeit?")).some((x) => /Du-Form/.test(x)) && sp(mit("Das klappt.!")).some((x) => /Ausrufezeichen/.test(x)), "Streng: Du-Form und „!“ sperren");
  ok(sp(mit("Eine Bürgschaft brauchen Sie nicht.")).some((x) => /Bürgschaft/.test(x)) && sp(mit("Wir sagen Ihnen die Finanzierung zu.")).some((x) => /Zusage/.test(x)), "Streng: „Bürgschaft“ und „Wir sagen Ihnen die Finanzierung zu“ sperren");
  ok(sp({ ps: "Noch etwas." }).some((x) => /PS/.test(x)) && lib.mailPruefen(basis, { ...o, anrede: "Guten Tag," }).sperrend.some((x) => /Anrede ohne Namen/.test(x)), "Streng: PS sperrt, „Guten Tag,“ ohne Namen sperrt");
  ok(sp({ betreff: "Ein sehr langer Betreff, der weit über sechzig Zeichen hinausgeht und auffällt" }).some((x) => /Betreff länger/.test(x)) && sp({ betreff: "Re: Ihre Halle" }).some((x) => /Re:/.test(x)) && sp({ betreff: "IHRE NEUE HALLE" }).some((x) => /Versalien/.test(x)) && !sp({ betreff: "ARKU: Ihre neue Halle" }).length, "Streng: Betreff über 60 Zeichen, „Re:“ und Versalien sperren — ein Firmenkürzel nicht");
  ok(sp({ absaetze: ["Sie bauen eine zweite Halle. So ein Schritt bindet viel Kapital, lange bevor er etwas einbringt.", basis.absaetze[1].replace(/wir|uns|unser/gi, "man")] }).some((x) => /Erste Person/.test(x)), "Streng: ohne „ich“/„wir“ sperrt");
  ok(sp({}, { strom: "partner", mitLink: true }).some((x) => /Terminlink/.test(x)) && sp(mit("Ein kurzes Telefonat wäre gut."), { strom: "partner", mitLink: false }).some((x) => /Gesprächswunsch/.test(x)), "Streng: Partner-Mail mit Terminlink oder Gesprächswunsch sperrt");
  const weich = lib.mailPruefen({ ...basis, absaetze: [`${basis.absaetze[0]} Das ist spannend!`, basis.absaetze[1]], ps: "Noch etwas." });
  ok(!weich.sperrend.length && weich.warnungen.some((x) => /Ausrufezeichen/.test(x)), "Ohne streng bleiben dieselben Fälle Hinweise (Hand-Änderung)");
  ok(!/[–—]/.test(Object.values(sh8.RADAR_KERNSATZ).join(" ")) && globalWortPruefen(Object.values(sh8.RADAR_KERNSATZ).join(" ")).length === 0, "Kernsatz ohne Gedankenstriche, besteht die Wortwand");
  ok(sh8.RADAR_SCHLUSSSAETZE.length === 4 && sh8.RADAR_SCHLUSSSAETZE.every((x) => !globalWortPruefen(x).length && !/[?!–—]/.test(x) && !/abmeld|verteiler|newsletter/i.test(x)), "Vier natürliche Schlusssätze, Wortwand sauber, kein Abmelde-Wort");
  ok(sh8.radarSchlusssatz(7) === sh8.radarSchlusssatz(7) && sh8.radarSchlusssatz(0) !== sh8.radarSchlusssatz(1) && sh8.radarGruss(2) === "Viele Grüße" && sh8.radarGruss(3) === "Beste Grüße", "Schlusssatz und Gruß je Firma fest (gleiche ID, gleicher Satz)");
  ok(fd.antwortKern(`Kein Bedarf, danke.\n\nAm Do., 29. Okt. 2026 um 10:05 schrieb Max Beispiel <max@beispiel.example>:\n> ${schluss}`) === "Kein Bedarf, danke." && fd.antwortVorab({ vonAdresse: "max@beispiel.example", betreff: "AW: Ihre neue Halle", text: schluss }) === null, "Der Schlusssatz im Zitat wird abgeschnitten und nie als Abmeldung gelesen");
  ok(!/Abmeldesatz/.test(sh8.RADAR_ANTWORT_ARTEN.kein_interesse.was), "„Kein Interesse“ erklärt sich ohne Abmeldesatz");
  // Die Mail sieht aus wie in Gmail geschrieben — mit der echten Unterschrift des Postfachs.
  const anna = { postfach: "anna@versand.example", name: "Anna Beispiel", signaturHtml: '<div dir="ltr"><b>Anna Beispiel</b><br>Partnerschaften<br><img src="https://bilder.example/anna.png" width="80"></div>', signaturText: "Anna Beispiel\nPartnerschaften", quelle: "gmail" as const };
  const lk = { gespraech: "https://fiaon.com/business?utm_source=radar&utm_content=r7#gespraech", seite: "https://fiaon.com/business" };
  const h8 = lib.mailHtml({ anrede: "Hallo Frau <b>X</b>,", absaetze: ['<script>alert(1)</script> & "Zitat"'], frage: "Passt es?", links: lk, schluss: sh8.radarSchlusssatz(3), gruss: "Beste Grüße", mitLink: true }, anna);
  const vorSig = h8.slice(0, h8.indexOf('class="gmail_signature"'));
  ok(h8.includes(sh8.radarSchlusssatz(3)) && /https:\/\/fiaon\.com\/impressum/.test(h8) && /https:\/\/fiaon\.com\/datenschutz/.test(h8) && h8.includes(">Impressum<") && h8.includes(">Datenschutz<"), "Neue Mail-HTML: Schlusssatz, Impressum und Datenschutz verlinkt");
  ok(!h8.includes("Kein Thema für Sie?") && !/border-top/.test(h8) && !/DOCTYPE/i.test(h8) && (vorSig.match(/<a /g) ?? []).length <= 1 && h8.startsWith('<div dir="ltr">'), "Kein Abmeldesatz, keine Fußleiste, kein eigenes Dokument, höchstens ein Link vor der Unterschrift");
  ok(h8.includes("&lt;script&gt;") && !/<script/i.test(h8) && h8.includes("Hallo Frau &lt;b&gt;X&lt;/b&gt;,") && h8.includes(anna.signaturHtml), "Eingaben maskiert, die Gmail-Unterschrift steht unverändert im Block gmail_signature");
  const t8 = lib.mailText({ anrede: "Hallo Frau Beispiel,", absaetze: ["Ein Satz."], frage: "Passt es?", links: lk, schluss, gruss: "Viele Grüße", mitLink: false }, anna);
  ok(t8.includes(schluss) && t8.includes("-- \nAnna Beispiel") && t8.includes("Impressum: https://fiaon.com/impressum") && !t8.includes(lk.gespraech), "Textfassung: Schlusssatz, Unterschrift, Impressum — ohne Link, wenn keiner gewünscht ist");
  ok(lib.radarPersonEcht("Anna Beispiel", anna.signaturHtml) && !lib.radarPersonEcht("Vertrieb", anna.signaturHtml) && !lib.radarPersonEcht("Anna Beispiel", ""), "Echte Person: Vor- und Nachname und eine Signatur mit Inhalt");
  ok(sig8.signaturAlsText('<div>Anna Beispiel<br>Partnerschaften</div><div><img src="x.png"></div>') === "Anna Beispiel\nPartnerschaften", "Gmail-Signatur als Text");
  const roh = gm.mimeNeu({ von: "anna@versand.example", vonName: "Anna Beispiel", an: "max@beispiel.example", betreff: "Ihre neue Halle", text: "x", html: "<div>x</div>" });
  const kopf = Buffer.from(roh.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8").split("\r\n\r\n")[0];
  ok(!/List-Unsubscribe/i.test(kopf) && kopf.includes(`=?UTF-8?B?${Buffer.from("Anna Beispiel").toString("base64")}?=`), "Ohne abmelden: kein List-Unsubscribe im Kopf, Absendername ohne Zusatz");
  const libQ = lies("server/lib/fiaon-radar.ts"), fdQ = lies("server/lib/fiaon-radar-faden.ts");
  ok(/neueMailSendenMitFaden\(postfach, inhalt\)/.test(libQ) && !/abmelden: postfach/.test(libQ) && /abmelden/.test(lies("server/lib/fiaon-mara-aktion.ts")), "radarMailAusgeben sendet ohne List-Unsubscribe; die Mara-Aktion bleibt unverändert");
  ok(/const inhalt = \{ vonName: absender\.name,/.test(libQ) && /vonName: absender\.name, an: f\.email/.test(fdQ) && /"Mara Lindner \| FIAON Global"/.test(fdQ) && !/\$\{radarAbsender\(\)\.name\} \| FIAON Global/.test(libQ + fdQ), "Absendername ohne „| FIAON Global“ bei Erstmail, Nachfass und Freigabe — Mara bleibt „Mara Lindner | FIAON Global“");
  for (const strom of ["firma", "partner"] as const) for (const stufe of [1, 2]) {
    const v = fd.NACHFASS_VORLAGEN[strom][stufe - 1];
    const r = lib.mailPruefen({ betreff: "Ihre neue Halle", absaetze: v.absaetze, frage: v.frage, ps: "" }, fd.nachfassRegeln(strom, stufe));
    ok(!r.sperrend.length, `Nachfass-Vorlage ${strom} Stufe ${stufe} besteht die strenge Prüfung (${r.sperrend.join("; ")})`);
  }
  ok(/Diese Mail ist nach alten Regeln geschrieben oder verletzt sie/.test(libQ) && /\{ streng: true, strom, gruppe: f\.mail\.gruppe \?\? null, anrede: f\.mail\.anrede \?\? null, schluss, mitLink \}/.test(libQ), "Beim Senden gelten die strengen Regeln — für Motor, Stapel und Akte");
}

abschnitt("Prüf-KI vor jeder Mail (E-458)");
{
  const lib = await import("../server/lib/fiaon-radar");
  const pk = await import("../server/lib/fiaon-radar-pruef");
  const gut = { ok: true, ki_klang: 1, bezug_konkret: true, nutzen_klar: true, eine_frage: true, zusage: false, erfunden: false, punkte: [], neu_hinweis: "" };
  ok(sh8.radarPruefUrteil(gut, 3).bestanden, "Urteil: alles gut → bestanden");
  ok(!sh8.radarPruefUrteil("{kaputt", 3).bestanden && !sh8.radarPruefUrteil(null, 3).bestanden && !sh8.radarPruefUrteil({}, 3).bestanden, "Urteil: kaputtes JSON oder leeres Urteil → nicht bestanden");
  ok(!sh8.radarPruefUrteil({ ...gut, ki_klang: 4 }, 3).bestanden && sh8.radarPruefUrteil({ ...gut, ki_klang: 3 }, 3).bestanden, "Urteil: KI-Klang 4 → nicht bestanden, 3 → bestanden");
  ok(!sh8.radarPruefUrteil({ ...gut, zusage: true }, 3).bestanden && !sh8.radarPruefUrteil({ ...gut, erfunden: true }, 3).bestanden && !sh8.radarPruefUrteil({ ...gut, zusage: undefined }, 3).bestanden, "Urteil: Zusage oder Erfundenes (auch unklar) → nicht bestanden");
  ok(!sh8.radarPruefUrteil({ ...gut, ok: false }, 3).bestanden && !sh8.radarPruefUrteil({ ...gut, eine_frage: false }, 3).bestanden && !sh8.radarPruefUrteil({ ...gut, bezug_konkret: false }, 3).bestanden, "Urteil: ok = false, mehrere Fragen oder kein Bezug → nicht bestanden");
  const m = { betreff: "Ihre neue Halle", absaetze: ["Satz eins.", "Satz zwei."], frage: "Passt das?" };
  const h = lib.radarMailHash(m);
  ok(h === lib.radarMailHash({ ...m }) && /^[0-9a-f]{64}$/.test(h), "Hash: stabil (sha256)");
  ok(h !== lib.radarMailHash({ ...m, betreff: "Ihre neue Halle." }) && h !== lib.radarMailHash({ ...m, absaetze: ["Satz eins!", "Satz zwei."] }) && h !== lib.radarMailHash({ ...m, frage: "Passt das ?" }), "Hash: ändert sich bei jedem Zeichen in Betreff, Absätzen oder Frage");
  const anw = pk.radarPruefAnweisung({ strom: "firma" });
  ok(["Zusage", "Zinssatz", "Betrag", "Bürgschaft", "„bis zu“", "Bankname", "ERFUNDEN", "KI-KLANG", "Gedankenstrich", "Aufzählung", "Floskeln"].every((w) => anw.includes(w)), "Die Prüf-Anweisung nennt Zusage, Zinssatz, Betrag, Bürgschaft, „bis zu“, Bankname, Erfundenes, KI-Klang, Gedankenstrich, Aufzählung, Floskeln");
  ok(/KEINE Provision/.test(pk.radarPruefAnweisung({ strom: "partner", provision: false })) && /Terminwunsch/.test(pk.radarPruefAnweisung({ strom: "partner", provision: true })), "Partner: Provision nur wo erlaubt, kein Treffen");
  // Fingerabdruck
  const kern = Object.values(sh8.RADAR_KERNSATZ).join(" ");
  const a1 = `Ich habe gelesen, dass Ihre Werkstatt im Frühjahr einen zweiten Standort eröffnet hat. ${kern} Wäre das für Sie ein Thema?`;
  const a2 = `Mir ist aufgefallen, dass Sie gerade drei neue Fahrzeuge für die Auslieferung anschaffen. ${kern} Passt das zu Ihren Plänen?`;
  const f1 = "Ich habe gesehen, dass Sie dieses Jahr eine zweite Halle bauen. Genau dafür gründen wir Unternehmern eine eigene Gesellschaft in Amerika und kümmern uns um Konto und Karten. Wäre das gerade ein Thema?";
  const f2 = "Ihr neuer Onlineshop für Kunden in Übersee ist mir aufgefallen. Für so einen Schritt bauen wir eine Firma vor Ort auf, samt Geschäftskonto, Firmenkarten und dem Weg zu frischem Kapital. Darf ich Ihnen dazu kurz schreiben, wie das abläuft?";
  ok(sh8.radarAehnlichkeit(a2, [a1]) > 0.35, `Fingerabdruck: wörtlich gleicher Kernsatz > 0,35 (${sh8.radarAehnlichkeit(a2, [a1])}) — sperrt`);
  ok(sh8.radarAehnlichkeit(f2, [f1]) < 0.35 && sh8.radarAehnlichkeit("", [f1]) === 0, `Fingerabdruck: frei formuliert < 0,35 (${sh8.radarAehnlichkeit(f2, [f1])})`);
  // Der Ablauf mit Attrappen: einmal neu, nie ein drittes Mal, KI-Pause bricht ab.
  const pruefung = (bestanden: boolean, extra: any = {}) => ({ bestanden, urteil: { ...gut, ok: bestanden, ki_klang: bestanden ? 1 : 6, punkte: bestanden ? [] : [{ regel: "KI-Klang", stelle: "nahtlos", hinweis: "Schreib es wie ein Mensch" }], neu_hinweis: bestanden ? "" : "Kürzer und konkreter." }, gruende: bestanden ? [] : ["Klingt nach KI (6 von 10)"], modell: "attrappe", hash: "h", ...extra });
  const lauf = async (urteile: boolean[], o: { sperrend?: string[][]; aehnlich?: number[]; wirft?: boolean } = {}) => {
    const hinweise: (string | null)[] = []; let geprueft = 0;
    const erg = await pk.radarFertigAblauf({
      schreiben: async (hw) => { hinweise.push(hw); return { sperrend: o.sperrend?.[hinweise.length - 1] ?? [], n: hinweise.length }; },
      pruefen: async () => { if (o.wirft) throw new lib.RadarFehler("KI pausiert", 503); return pruefung(urteile[geprueft++] ?? false); },
      aehnlich: () => o.aehnlich?.[hinweise.length - 1] ?? 0.1, aehnlichMax: 0.35,
    });
    return { erg, hinweise, geprueft };
  };
  let r = await lauf([true]);
  ok(r.erg.ok && r.erg.versuche === 1 && r.hinweise.length === 1 && r.geprueft === 1, "Attrappe: Urteil ok → bereit nach einem Versuch");
  r = await lauf([false, true]);
  ok(r.erg.ok && r.erg.versuche === 2 && r.hinweise.length === 2 && r.hinweise[0] === null && /Schreib es wie ein Mensch/.test(String(r.hinweise[1])) && /Kürzer und konkreter/.test(String(r.hinweise[1])), "Attrappe: erstes Nein → genau ein Neuschreiben, die Punkte stehen im Nachtrag");
  r = await lauf([false, false, true]);
  ok(!r.erg.ok && r.hinweise.length === 2 && r.geprueft === 2 && /Klingt nach KI/.test(String(r.erg.grund)), "Attrappe: zweites Nein → verworfen mit Grund, kein drittes Schreiben");
  r = await lauf([true], { sperrend: [["Gedankenstrich"]] });
  ok(!r.erg.ok && r.geprueft === 0 && /Gedankenstrich/.test(String(r.erg.grund)), "Harte Regeln verletzt → die Prüf-KI wird gar nicht erst gefragt");
  r = await lauf([true], { aehnlich: [0.6, 0.1] });
  ok(r.erg.ok && r.hinweise.length === 2 && /Zu ähnlich/.test(String(r.hinweise[1])) && r.geprueft === 1, "Zu ähnlich zu einer früheren Mail → einmal neu, ohne die Prüf-KI zu bezahlen");
  let warf: any = null;
  try { await lauf([true], { wirft: true }); } catch (e) { warf = e; }
  ok(warf?.status === 503, "KI-Pause in der Attrappe: der Ablauf bricht ab, nichts gilt als bestanden");
  // Die Prüf-KI selbst, mit Attrappe statt Modell (kein Netz)
  let gesehen = "";
  pk.radarPruefModellSetzen(async (e) => { gesehen = `${e.anweisung}\n${e.eingabe}`; return JSON.stringify({ ...gut, ki_klang: 2 }); });
  const pr = await pk.radarMailPruefKi({ name: "Beispiel Bau GmbH", domain: "beispiel-bau.example", scan: { aufhaenger: [{ text: "Neue Halle", beleg: "Wir bauen 2026 eine zweite Halle" }], profil: { zusammenfassung: "Bauunternehmen" } } }, { betreff: "Ihre neue Halle", absaetze: ["Ich habe gesehen, dass Sie bauen."], frage: "Passt das?" }, { strom: "firma" });
  pk.radarPruefModellSetzen(null);
  ok(pr.bestanden && pr.modell === "attrappe" && pr.hash === lib.radarMailHash({ betreff: "Ihre neue Halle", absaetze: ["Ich habe gesehen, dass Sie bauen."], frage: "Passt das?" }) && /Wir bauen 2026 eine zweite Halle/.test(gesehen), "Prüf-KI mit Attrappe: Urteil, Hash der Fassung, Aufhänger als Beleg in der Eingabe");
  const libQ = lies("server/lib/fiaon-radar.ts");
  ok(/if \(!f\.pruef_ki\?\.ok \|\| f\.pruef_ki\.hash !== radarMailHash\(f\.mail\)\) throw new RadarFehler/.test(libQ), "radarMailAusgeben verlangt pruef_ki.ok und denselben Hash — für Motor, Stapel und Akte");
  ok(/radarMailAendern[\s\S]{0,3200}pruef_ki = NULL, pruef_ki_am = NULL/.test(libQ) && /mail_am = NOW\(\), pruef_ki = NULL, pruef_ki_am = NULL/.test(libQ), "Hand-Änderung und Neuschreiben setzen das Urteil zurück");
  ok(/radarMailFertig, radarMailNurPruefen/.test(libQ) && /"\/chef\/radar\/firma\/:id\/pruefen", wache/.test(lies("server/routes/fiaon-radar.ts")) && /Prüfen lassen/.test(lies("client/src/components/admin/ChefRadar.tsx")), "Stapel prüft vor dem Senden; Akte: „Prüfen lassen“ hinter der Wache");
  ok(/radarMailPruefKi\(f, \{ betreff: String\(f\.mail\?\.betreff \?\? ""\), absaetze, frage \}, \{ strom, art: "nachfass" \}\)/.test(lies("server/lib/fiaon-radar-faden.ts")), "Auch das Nachfassen liest die Prüf-KI (zweimal durchgefallen → feste Vorlage)");
}

abschnitt("Warteschlange und Takt: der Mail-Motor (E-458)");
{
  const mo = await import("../server/lib/fiaon-radar-motor");
  const v = sh8.radarMotorLesen({});
  const st = (f: [number, number, string | null], p: [number, number, string | null]) => ({
    firma: { gesendet: f[0], schlange: f[1], letzte: f[2] ? new Date(f[2]) : null },
    partner: { gesendet: p[0], schlange: p[1], letzte: p[2] ? new Date(p[2]) : null },
  });
  const t0730 = new Date("2026-10-29T07:30:00+01:00");
  const kurz = (x: { strom: string; fuer: string }[]) => JSON.stringify(x.map((d) => ({ strom: d.strom, fuer: d.fuer })));
  ok(kurz(mo.motorDran(t0730, v, st([0, 5, null], [0, 5, null]))) === JSON.stringify([{ strom: "firma", fuer: "firma" }, { strom: "partner", fuer: "partner" }]), "Zwei Ströme mit je eigenem Stundenziel: um 07:30 sind beide dran");
  ok(kurz(mo.motorDran(t0730, v, st([6, 5, null], [0, 5, null]))) === JSON.stringify([{ strom: "partner", fuer: "partner" }]), "Firmen-Soll erreicht → nur Partner dran");
  ok(kurz(mo.motorDran(t0730, v, st([0, 5, null], [0, 0, null]))) === JSON.stringify([{ strom: "firma", fuer: "beide" }]), "Partner-Warteschlange leer → die Firmen füllen die Lücke (für beide)");
  ok(mo.motorDran(t0730, v, st([2, 5, null], [0, 5, null]))[0]?.strom === "partner", "Beide dran: zuerst der Strom, der weiter hinter seinem Ziel liegt (sonst nähme bei einem Postfach immer derselbe den Platz)");
  ok(!mo.motorDran(t0730, v, st([6, 5, null], [5, 0, null])).length, "Lücke füllen nur bis zum gemeinsamen Soll (11 von 10 je Stunde × 2 um 07:30)");
  ok(!mo.motorDran(t0730, { ...v, partnerJeStunde: 0 }, st([6, 5, null], [0, 9, null])).length, "Ein Strom mit Ziel 0 ist aus — er sendet nicht und füllt keine Lücke");
  ok(!mo.motorDran(new Date("2026-10-29T19:30:00+01:00"), v, st([0, 5, null], [0, 5, null])).length, "Außerhalb des Fensters ist niemand dran");
  // Postfächer
  const pf = (adresse: string, heute: number, letzte: string | null = null, extra: Record<string, unknown> = {}) => ({ adresse, grenze: 60, heute, reserve: 0, letzteAm: letzte, bereit: true, ...extra });
  const jetzt = new Date("2026-10-29T10:00:00+01:00");
  ok(sh8.radarPostfachWaehlen([pf("a@versand.example", 30), pf("b@versand.example", 10)], jetzt)?.adresse === "b@versand.example", "Rundlauf: das Postfach mit dem größten Rest");
  ok(sh8.radarPostfachWaehlen([pf("a@versand.example", 60), pf("b@versand.example", 59, "2026-10-29T09:59:00+01:00")], jetzt) === null, "Volles Postfach nie; Postfach unter dem Mindestabstand (3 Min) nie; keins frei → null");
  ok(sh8.radarPostfachWaehlen([pf("a@versand.example", 10, null, { bereit: false }), pf("b@versand.example", 50, null, { pause: true })], jetzt) === null, "Nicht bereit oder pausiert → sendet nicht");
  ok(sh8.radarPostfachAbstandSek("2026-10-29T09:00:00Z") >= 180 && sh8.radarPostfachAbstandSek("2026-10-29T09:00:00Z") < 240, "Abstand je Postfach: 3 Minuten plus Zufall");
  const mg = sh8.radarMoeglich({ postfaecher: [pf("js@fiaon.com", 0)], reststunden: 12, fensterStunden: 12, ziele: { firma: 10, partner: 10 } });
  ok(mg.moeglich === 5 && mg.satz === "Ziel 20 je Stunde, heute möglich 5 — mehr Postfächer = mehr Tempo", `Ehrliche Leistung: ein Postfach 60/Tag, 12 Stunden → 5 je Stunde („${mg.satz}“)`);
  ok(sh8.radarMoeglich({ postfaecher: [pf("js@fiaon.com", 0, null, { reserve: 30 })], reststunden: 12, fensterStunden: 12, ziele: { firma: 10, partner: 10 } }).moeglich === 2, "30 Nachfass-Mails reserviert → 2 je Stunde");
  ok(mg.postfaecherNoetig === 12 && sh8.radarMoeglich({ postfaecher: [], reststunden: 12, fensterStunden: 12, ziele: { firma: 10, partner: 10 }, nachfassStufen: 1 }).postfaecherNoetig === 8 && sh8.radarSendungenJeErstmail(2) === 2.85, "Für 20 je Stunde: 12 warme Postfächer (2 Nachfass) bzw. 8 (1 Nachfass)");
  ok(mg.tagJe.firma === 30 && mg.tagJe.partner === 30 && sh8.radarMoeglich({ postfaecher: Array.from({ length: 12 }, (_, i) => pf(`p${i}@versand.example`, 0)), reststunden: 12, fensterStunden: 12, ziele: { firma: 10, partner: 10 } }).satz === "Ziel 20 je Stunde, heute möglich 20", "Puffer hängt an der Leistung (je Strom 30 am Tag); mit genug Postfächern volles Ziel");
  // Quelltext-Wände
  const routes = lies("server/routes.ts"), crons = lies("server/lib/fiaon-crons.ts"), motorQ = lies("server/lib/fiaon-radar-motor.ts"), fadenQ = lies("server/lib/fiaon-radar-faden.ts");
  ok(/tageslauf\('radar_motor_vorbereiten', [^\n]*, 5 \* 60 \* 1000,/.test(routes) && /tageslauf\('radar_motor_senden', [^\n]*, 60 \* 1000, \{[^}]*nurMitErgebnis: true \}\)/.test(routes), "Läufe: radar_motor_vorbereiten (5 Min) und radar_motor_senden (60 s, nurMitErgebnis)");
  ok(/radar_motor_vorbereiten: \{\s*zweck:/.test(crons) && /radar_motor_senden: \{\s*zweck:/.test(crons) && /folge:/.test(crons) && !/8:30–17:30/.test(crons.slice(crons.indexOf("radar_versand: {"), crons.indexOf("radar_versand: {") + 400)), "Zweck und Folge beider Läufe im Katalog; radar_versand ohne festes 8:30–17:30");
  const versandQ = fadenQ.slice(fadenQ.indexOf("export async function radarVersandLauf"), fadenQ.indexOf("// ── DER TRICHTER JE TAG"));
  ok(versandQ.length > 500 && !/radarMailAusgeben|radarMailSchreiben|automatik_am/.test(versandQ) && /art = 'erstmail'/.test(versandQ), "radarVersandLauf schickt keine ersten Mails mehr (kein zweiter Weg), zählt aber die des Motors");
  const sendenQ = motorQ.slice(motorQ.indexOf("export async function radarMotorSenden"), motorQ.indexOf("/** Für den Minutentakt"));
  ok(sendenQ.length > 500 && !/radarKi|kiPausiert/.test(sendenQ), "radarMotorSenden ruft keine KI und fragt die KI-Pause nicht (sendet aus der Warteschlange weiter)");
  ok(/pg_advisory_xact_lock\(\$\{MOTOR_SPERRE\}\)/.test(motorQ) && /MOTOR_SPERRE = 458001/.test(motorQ) && /SET motor_status = 'sendet'[\s\S]{0,400}RETURNING id/.test(motorQ), "Übernahme unter pg_advisory_xact_lock mit motor_status = 'sendet' … RETURNING");
  const kandQ = motorQ.slice(motorQ.indexOf("export async function kandidatNehmen"), motorQ.indexOf("async function verwerfen"));
  ok(/r\.strom = \$\{strom\}/.test(kandQ) && /r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(kandQ) && /ORDER BY COALESCE\(r\.signal_staerke, \$\{RADAR_SIGNAL_AB\}\) DESC, r\.passung DESC/.test(kandQ) && /RADAR_NUR_BRIEF_LAENDER/.test(kandQ) && /r\.motor_status IS NULL/.test(kandQ) && /FOR UPDATE SKIP LOCKED/.test(kandQ), "Kandidaten: Strom-Filter, Signal ≥ 3, stärkstes Signal und Passung zuerst, ohne Österreich, über motor_status (nicht automatik_am)");
  ok(Object.keys(sh8.RADAR_STATUS).length === 16, "RADAR_STATUS bleibt bei 16 Ständen (die Warteschlange ist eine eigene Spalte)");
  ok(!/JSON\.stringify\([^)]*\)\}::jsonb/.test(motorQ + lies("server/lib/fiaon-radar-pruef.ts")), "JSONB nur über sqlPool.json()");
  const rt = lies("server/routes/fiaon-radar.ts");
  ok(/"\/chef\/radar\/motor", wache/.test(rt) && /"\/chef\/radar\/motor\/fuellen", wache/.test(rt) && /"\/chef\/radar\/motor\/senden", wache[\s\S]{0,160}bestaetigt !== true/.test(rt), "Routen des Motors hinter der Wache; „Jetzt eine senden“ nur mit Bestätigung");
  const ui = lies("client/src/components/admin/ChefRadar.tsx");
  ok(/<MotorKachel /.test(ui) && /className="cr-kachel breit cr-motor"/.test(ui) && /\{l\.satz\}/.test(ui) && !/Mails je Werktag/.test(ui) && !/8:30–17:30/.test(ui), "Chefbüro: Kachel „Mail-Motor“ (Ziele, Fenster, Tage, Warteschlange, ehrlicher Satz); kein festes 8:30–17:30, kein „Mails je Werktag“");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  const rgFr = rg.slice(rg.indexOf("export const RUNDGANG_FIRMEN_RADAR"), rg.indexOf("// ── /chef/s/telefonkartei"));
  ok(/ziel: "\.cr-motor"/.test(rgFr) && !/8:30/.test(rgFr) && !/Abmeldesatz/.test(rgFr), "Rundgang: Schritt zum Mail-Motor, kein 8:30, kein Abmeldesatz");
}

// ── Ende zu Ende gegen den LOKALEN Prüfstand (nur mit PRUEF_MOTOR_DB=an und einer Datenbank auf 127.0.0.1) ──
if (process.env.PRUEF_MOTOR_DB === "an") {
  abschnitt("Mail-Motor Ende zu Ende im lokalen Prüfstand (E-458)");
  const url = String(process.env.DATABASE_URL ?? "");
  if (!/@127\.0\.0\.1:54329\//.test(url)) { ok(false, "Ende-zu-Ende nur gegen den lokalen Prüfstand (127.0.0.1:54329)"); }
  else {
    const { sqlPool } = await import("../server/lib/db-pool");
    const lib = await import("../server/lib/fiaon-radar");
    const mo = await import("../server/lib/fiaon-radar-motor");
    await lib.ensureRadarTabellen();
    const setzen = async (werte: Record<string, string>) => { for (const [k, w] of Object.entries(werte)) await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${k}, ${w}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`; };
    const heuteTag = sh8.radarBerlinTagMinute(new Date()).tag;
    await sqlPool`DELETE FROM fiaon_radar_post`; await sqlPool`DELETE FROM fiaon_radar_firmen`; await sqlPool`DELETE FROM fiaon_radar_sperre`;
    await sqlPool`DELETE FROM fiaon_settings WHERE key LIKE 'radar_%'`;
    await setzen({ radar_auto_versand: "an", radar_auto_nachfass: "aus", radar_mara_antwort: "entwurf", radar_auto_ab_passung: "70", radar_motor_tage: String(heuteTag), radar_motor_von: "00:00", radar_motor_bis: "23:59" });
    const mailFirma = { betreff: "Ihre neue Halle", anrede: "Hallo Frau Beispiel,", absaetze: [
      "Ich habe gesehen, dass Sie in diesem Jahr eine zweite Halle bauen. So ein Schritt bindet viel Kapital, lange bevor er etwas einbringt.",
      "Genau dafür bauen wir Unternehmern eine zweite Kapitalquelle auf. Wir gründen Ihnen eine eigene LLC in den USA, vergleichbar mit einer GmbH, und kümmern uns um Konto, Firmenkarten und den Weg zu US-Funding. Das Amerikanische erledigt unser Team vor Ort."],
      frage: "Wäre das für Ihre Pläne gerade ein Thema?", ps: "", paket: null, warnungen: [], sperrend: [], geaendert: false, erstellt_am: new Date().toISOString(), mitLink: true, strom: "firma" };
    const mailPartner = { betreff: "Ihre Mandanten mit Plänen in den USA", anrede: "Guten Tag Max Beispiel,", absaetze: [
      "Ich habe auf Ihrer Website gelesen, dass Sie viele Onlinehändler betreuen, die auch an Kunden in Übersee verkaufen. Für genau diese Unternehmer haben wir etwas Passendes.",
      "Wir gründen ihnen eine eigene Gesellschaft in den USA und kümmern uns um Geschäftskonto und Firmenkarten. Die steuerliche Betreuung bleibt dabei ganz bei Ihnen, und wir stellen uns gern gegenseitig Mandanten vor."],
      frage: "Haben Sie Mandanten, für die das gerade ein Thema ist?", ps: "", paket: null, warnungen: [], sperrend: [], geaendert: false, erstellt_am: new Date().toISOString(), mitLink: false, strom: "partner", gruppe: "steuerberater" };
    const anlegen = async (n: number, o: { strom?: string; land?: string; mail?: any; status?: string; motor?: string | null; signal?: number; passung?: number } = {}) => {
      const domain = `firma${n}.example`;
      const mail = { ...(o.mail ?? mailFirma), schluss: sh8.radarSchlusssatz(n), gruss: sh8.radarGruss(n), links: { gespraech: `https://fiaon.com/business?utm_source=radar&utm_content=r${n}#gespraech`, seite: "https://fiaon.com/business" } };
      const name = o.strom === "partner" ? "Max Beispiel" : "Anna Beispiel";
      const email = `${name.toLowerCase().replace(" ", ".")}@${domain}`;
      const [z] = (await sqlPool`
        INSERT INTO fiaon_radar_firmen (tag, quelle, bereich, land, name, domain, website, passung, email, ansprechpartner, status, mail, entscheider, signal_staerke, strom, motor_status, motor_am, pruef_ki, impressum)
        VALUES (CURRENT_DATE, 'pruefstand', ${o.strom === "partner" ? "steuerberater" : "bau"}, ${o.land ?? "DE"}, ${`Beispiel ${n} GmbH`}, ${domain}, ${`https://${domain}`}, ${o.passung ?? 85}, ${email}, ${name},
                ${o.status ?? "mail"}, ${sqlPool.json(mail)}, ${sqlPool.json({ name, rolle: "Geschäftsführung", email, anrede: null, quelle: `https://${domain}/impressum`, weg: "website", am: new Date().toISOString() })},
                ${o.signal ?? 4}, ${o.strom ?? "firma"}, ${o.motor === undefined ? "bereit" : o.motor}, NOW() - INTERVAL '1 hour',
                ${sqlPool.json({ ok: true, hash: lib.radarMailHash(mail), punkte: [], ki_klang: 1, modell: "attrappe", am: new Date().toISOString(), versuch: 1 })},
                ${sqlPool.json({ name: `Beispiel ${n} GmbH`, vertreter: [{ name, funktion: "Geschäftsführung" }], land: o.land ?? "DE" })})
        RETURNING id`) as any[];
      return Number(z.id);
    };
    const gesendet: any[] = [];
    let nr = 0;
    const sender = async (postfach: string, inhalt: any) => { gesendet.push({ postfach, ...inhalt }); nr++; return { id: `pruef-${Date.now()}-${nr}`, threadId: `faden-${nr}` }; };
    const zuruecklegen = async (minuten: number) => {
      await sqlPool`UPDATE fiaon_radar_post SET datum = datum - make_interval(mins => ${minuten}), created_at = created_at - make_interval(mins => ${minuten})`;
      await sqlPool`UPDATE fiaon_radar_firmen SET motor_am = motor_am - make_interval(mins => ${minuten}) WHERE motor_status IN ('gesendet', 'sendet')`;
    };
    const f1 = await anlegen(1), f2 = await anlegen(2), p1 = await anlegen(3, { strom: "partner", mail: mailPartner });
    const at = await anlegen(4, { land: "AT", signal: 5 }), gesp = await anlegen(5, { signal: 5 });
    await lib.radarSperren({ wert: "firma5.example", grund: "Prüfstand" });
    // 1. Erster Takt: genau eine Mail (ein Postfach, Mindestabstand) — die stärkste Firma (Signal 5, aber AT/Sperrliste) fällt durch die Wand.
    let r = await mo.radarMotorSenden({ sender });
    const z1 = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund, status FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(r.gesendet + r.verworfen >= 1 && gesendet.length <= 1, `Erster Takt: höchstens eine Mail aus js@ (gesendet ${r.gesendet}, verworfen ${r.verworfen})`);
    // Weiter takten, bis die Wände ihre Firmen verworfen haben und etwas hinausging.
    for (let i = 0; i < 6 && gesendet.length < 1; i++) { await zuruecklegen(10); r = await mo.radarMotorSenden({ sender }); }
    const stand = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund, status, versendet_am FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(stand[at].motor_status === "verworfen" && /Österreich/.test(String(stand[at].motor_grund)), `Österreich: beim Senden verworfen (${stand[at].motor_status}: ${stand[at].motor_grund})`);
    ok(stand[gesp].motor_status === "verworfen" && /Sperrliste|gesperrt/i.test(String(stand[gesp].motor_grund)), `Sperrliste: beim Senden verworfen (${stand[gesp].motor_status}: ${stand[gesp].motor_grund})`);
    ok(gesendet.length === 1 && gesendet[0].postfach === "js@fiaon.com" && gesendet[0].vonName === "Justin Schwarzott" && !("abmelden" in gesendet[0]), `Gesendet aus js@ als „Justin Schwarzott“ ohne Zusatz und ohne List-Unsubscribe (${gesendet[0]?.vonName})`);
    ok(gesendet.length === 1 && gesendet[0].html.startsWith('<div dir="ltr">') && gesendet[0].html.includes('class="gmail_signature"') && gesendet[0].html.includes(">Impressum<") && !/Kein Thema für Sie|DOCTYPE/.test(gesendet[0].html)
      && sh8.RADAR_SCHLUSSSAETZE.some((x) => gesendet[0].text.includes(x)) && /\n-- \n/.test(gesendet[0].text), "Die gesendete Mail: Gmail-Aufbau, Unterschrift, Schlusssatz, Impressum — kein Abmeldesatz, kein eigenes Dokument");
    void z1;
    const post1 = (await sqlPool`SELECT p.art, f.strom, f.motor_status, f.status FROM fiaon_radar_post p JOIN fiaon_radar_firmen f ON f.id = p.firma_id`) as any[];
    ok(post1.length === 1 && post1[0].art === "erstmail" && post1[0].motor_status === "gesendet" && post1[0].status === "versendet", "Nach dem Senden: Faden-Eintrag „erstmail“, Motor „gesendet“, Radar „versendet“");
    // 2. Sofort noch ein Takt: nichts (Abstand je Postfach und je Strom).
    r = await mo.radarMotorSenden({ sender });
    ok(r.gesendet === 0 && gesendet.length === 1, "Gleich danach: kein zweiter Versand (Abstand) — kein Schwall");
    // 3. Zehn Minuten später: der andere Strom ist dran.
    await zuruecklegen(10);
    r = await mo.radarMotorSenden({ sender });
    ok(r.gesendet === 1 && gesendet.length === 2 && gesendet[1].vonName === "Justin Schwarzott", `Zehn Minuten später: die nächste Mail (${JSON.stringify(r.je)})`);
    const stroeme = new Set(((await sqlPool`SELECT f.strom FROM fiaon_radar_post p JOIN fiaon_radar_firmen f ON f.id = p.firma_id`) as any[]).map((x) => x.strom));
    ok(stroeme.has("firma") && stroeme.has("partner"), "Beide Ströme bekommen ihre Mails (Firmen und Partner im Wechsel)");
    const partnerMail = gesendet.find((g) => /Mandanten/.test(g.betreff));
    ok(!!partnerMail && !/Einen Termin wählen|#gespraech/.test(partnerMail.html), "Partner-Mail ohne Terminlink");
    // 4. Zwei Instanzen gleichzeitig: Die Sperre lässt nur so viele hinaus, wie dran sind (zwei Postfächer, zwei Ströme).
    process.env.RADAR_POSTFAECHER = "js@fiaon.com,pruef@fiaon.com";
    lib.radarAbsenderErsatzSetzen(async (p) => ({ postfach: p, name: p.startsWith("pruef") ? "Anna Beispiel" : "Justin Schwarzott", signaturHtml: "<div>Unterschrift</div>", signaturText: "Unterschrift", quelle: "gmail" as const }));
    await anlegen(6); await anlegen(7, { strom: "partner", mail: mailPartner }); await anlegen(8); await anlegen(9, { strom: "partner", mail: mailPartner });
    await zuruecklegen(30);
    const vorher = gesendet.length;
    const [ra, rb] = await Promise.all([mo.radarMotorSenden({ sender }), mo.radarMotorSenden({ sender })]);
    const neuGesendet = gesendet.length - vorher;
    ok(neuGesendet >= 1 && neuGesendet <= 2 && ra.gesendet + rb.gesendet === neuGesendet, `Zwei Instanzen gleichzeitig: ${neuGesendet} Mails (höchstens eine je Strom), keine doppelt`);
    const doppelt = (await sqlPool`SELECT firma_id, COUNT(*)::int AS n FROM fiaon_radar_post WHERE art = 'erstmail' GROUP BY firma_id HAVING COUNT(*) > 1`) as any[];
    ok(!doppelt.length, "Keine Firma bekam zwei erste Mails");
    lib.radarAbsenderErsatzSetzen(null);
    delete process.env.RADAR_POSTFAECHER;
    // 5. Vorbereiten mit Attrappen: Österreich nie, stärkstes Signal zuerst, KI-Pause gibt die Firma zurück.
    await sqlPool`DELETE FROM fiaon_radar_post`; await sqlPool`DELETE FROM fiaon_radar_firmen`;
    const k1 = await anlegen(11, { motor: null, signal: 3 }), k2 = await anlegen(12, { motor: null, signal: 5 }), kAt = await anlegen(13, { motor: null, signal: 5, land: "AT" });
    const k4 = await anlegen(14, { motor: null, signal: 4, passung: 50 }), kp = await anlegen(15, { motor: null, signal: 4, strom: "partner", mail: mailPartner });
    await sqlPool`UPDATE fiaon_radar_firmen SET scan = ${sqlPool.json({ profil: {}, aufhaenger: [{ text: "x", beleg: "y" }] })} WHERE id = ANY(${[k1, k2, kAt, k4, kp]})`;
    const reihenfolge: number[] = [];
    const attrappe = { scannen: async () => null, entscheider: async () => null, fertig: async (id: number) => { reihenfolge.push(id); return id === k1 ? { ok: false, grund: "Prüf-KI: klingt nach KI" } : { ok: true, grund: null }; } };
    const v1 = await mo.radarMotorVorbereiten({ schritte: attrappe, max: 6 });
    const z5 = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(z5[kAt].motor_status === null && !reihenfolge.includes(kAt), "Vorbereiten: Österreich wird nie genommen");
    ok(z5[k4].motor_status === null, "Vorbereiten: unter der Passungsschwelle (70) nicht");
    ok(reihenfolge.indexOf(k2) > -1 && (reihenfolge.indexOf(k1) === -1 || reihenfolge.indexOf(k2) < reihenfolge.indexOf(k1)), `Vorbereiten: stärkstes Signal zuerst (${reihenfolge.join(",")})`);
    ok(z5[k2].motor_status === "bereit" && z5[kp].motor_status === "bereit" && z5[k1].motor_status === "verworfen" && /klingt nach KI/.test(String(z5[k1].motor_grund)), `Vorbereiten: freigegeben → bereit, durchgefallen → verworfen mit Grund (${v1.bereit} bereit, ${v1.verworfen} verworfen)`);
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = NULL, motor_grund = NULL WHERE id = ${k1}`;
    const pause = { ...attrappe, fertig: async () => { throw new lib.RadarFehler("KI pausiert", 503); } };
    const v2 = await mo.radarMotorVorbereiten({ schritte: pause, max: 6 });
    const k1Stand = ((await sqlPool`SELECT motor_status, motor_grund FROM fiaon_radar_firmen WHERE id = ${k1}`) as any[])[0];
    ok(k1Stand.motor_status === null && /KI pausiert/.test(String(v2.grund)), "KI-Pause beim Vorbereiten: Lauf endet, die Firma geht zurück in den Vorrat — nichts als bestanden gebucht");
    // 6. Aufräumen: veraltete „bereit“ → abgelaufen; hängende „sendet“ ohne Versand → zurück auf bereit.
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_am = NOW() - INTERVAL '8 days' WHERE id = ${k2}`;
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'sendet', motor_am = NOW() - INTERVAL '20 minutes' WHERE id = ${kp}`;
    await mo.warteschlangeAufraeumen(sh8.radarMotorLesen({}));
    const z6 = Object.fromEntries(((await sqlPool`SELECT id, motor_status FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x.motor_status]));
    ok(z6[k2] === "abgelaufen" && z6[kp] === "bereit", "Aufräumen: nach 7 Tagen abgelaufen; hängendes Senden ohne Versand zurück auf bereit");
    const stand2 = await mo.radarMotorStand();
    ok(stand2.leistung && typeof stand2.leistung.satz === "string" && stand2.stroeme.partner.bereit >= 1, `Stand fürs Chefbüro: ${stand2.leistung.satz}`);
    await sqlPool.end({ timeout: 2 });
  }
}

abschnitt("Ergebnis");
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
