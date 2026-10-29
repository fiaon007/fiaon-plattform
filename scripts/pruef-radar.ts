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
  radarDomain, alsRadarLand, radarBereich, radarAdressePruefen, radarAutomatikLesen, radarSendefenster, RADAR_LAENDER_AKTIV, radarLandAktiv,
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
const links = { gespraech: "https://fiaon.com/?utm_source=radar#gespraech", seite: "https://fiaon.com/" };
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
for (const b of RADAR_BEREICHE) ok(b.seite === "/" || seitenPfade.has(b.seite), `${b.key}: Seite ${b.seite} existiert`);
// E-458 nach E-461: /business leitet nur noch per 301 auf „/“ — keine Bereichsseite darf über diesen Umweg führen.
ok(!RADAR_BEREICHE.some((b) => /^\/(en\/)?business\/?$/.test(b.seite)), "Keine Bereichsseite zeigt auf /business (seit E-461 nur noch eine Weiterleitung)");
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
ok(/r\.signal_staerke IS NULL OR r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(lies("server/lib/fiaon-radar-motor.ts")) && /< RADAR_SIGNAL_AB\) return nichtQualifiziert\(f\)/.test(lies("server/lib/fiaon-radar-motor.ts"))
  && /const nichtQualifiziert = async[\s\S]{0,400}return verwerfen\(id,/.test(lies("server/lib/fiaon-radar-motor.ts")), "Automatik schreibt nur ab Signalstärke 3");

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
const sigHtml = sig.htmlAusText("Hallo Herr Muster,\n\nEin Satz.\n\nDirekt einen Termin wählen: https://fiaon.com/?utm_source=radar#gespraech\n\nViele Grüße\nMara Lindner\nDigitale Assistentin\n\n—\nFIAON LTD · Fuß", sig.maraSignatur("Justin Schwarzott"));
ok(sigHtml.includes("/mail/signatur/mara.png") && sigHtml.includes("linie.gif") && sigHtml.includes("punkt.gif") && sigHtml.includes("Digitale Assistentin von Justin Schwarzott"), "Maras Karte: Porträt, Lichtlinie, Punkt, KI-Hinweis „Digitale Assistentin“");
ok(sigHtml.includes("Einen Termin wählen") && sigHtml.includes("FIAON LTD · Fuß") && !/Mara Lindner<br>Digitale/.test(sigHtml), "Termin als Link, Fuß klein, Textunterschrift durch die Karte ersetzt");
// E-458: die erste Mail trägt die ECHTE Gmail-Unterschrift des Postfachs (sendAs); als Rückweg Justins Karte für js@ und —
// seit Justins Wort vom 29.10. („von Mara (also welcome) und meiner js“) — Maras Karte für welcome@; jedes andere Postfach: null.
{
  const lib = lies("server/lib/fiaon-radar.ts");
  ok(/await absenderLesen\(postfach\)/.test(lib)
    && /if \(postfach === "js@fiaon\.com"\) return \{ absender: \{ \.\.\.radarKarteAbsender\(seite\), postfach \}, gestoert \};/.test(lib)
    && /if \(postfach === "welcome@fiaon\.com"\) return \{ absender: radarMaraKarteAbsender\(seite\), gestoert \};\n  return \{ absender: null, gestoert \};/.test(lib),
    "Die erste Mail trägt die Gmail-Unterschrift des Postfachs, sonst Justins Karte (js@) bzw. Maras Karte (welcome@), sonst keine");
  ok(/maraSignatur\(radarAbsender\(\)\.name\), email: "welcome@fiaon\.com"/.test(lib) && /quelle: "karte"/.test(lib), "Maras Karte: Mara Lindner, digitale Assistentin, welcome@, Startseite");
}
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
ok(/const sperrt = radarMailWand\(f, await radarMotorEinstellung\(\)\)/.test(lib) && /nach alten Regeln geschrieben/.test(lib), "Beim Senden gilt die AKTUELLE Wand — alte Mails müssen neu geschrieben werden");
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
  ok(link === "https://fiaon.com/?utm_source=radar_brief&utm_content=r1078#gespraech", `QR-Link direkt auf die Startseite, ohne 301 über /business (${link})`);
  ok(sh.RADAR_BRIEF_TEXTE.qrOhneCode === "Ohne Code: fiaon.com", "Ohne Code: die kurze Adresse fiaon.com (E-461: die Global-Startseite)");
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
  ok(r.indexOf("app.get('/', (req, _res, next)") > 0 && r.indexOf("app.get('/', (req, _res, next)") < r.indexOf("seiteUnbekannt(req.path)") && /radarBriefBesuchMerken\(req\.query\.utm_content, req\.get\('user-agent'\)\)/.test(r) && /next\(\);\n  \}\);/.test(r), "QR-Besuche werden auf der Startseite vor dem Seitenaufbau gemerkt — die Seite läuft weiter");
  ok(r.indexOf("app.get('/business', (req, _res, next)") < 0 && (r.match(/radarBriefBesuchMerken\(/g) ?? []).length === 1 && /'\/business': '\/'/.test(r), "Alter Brief (/business?…): zählt nach der 301 genau einmal auf „/“ — kein zweiter Zähler auf /business");
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
  ok(radarBuchungslink("Termin: https://fiaon.com/?utm_source=radar#gespraech") === null && radarBuchungslink("Termin: https://fiaon.com/business?utm_source=radar#gespraech") === null && radarBuchungslink("Unsere Seite: https://musterfirma.de/kontakt") === null, "Unser eigener Link und normale Seiten zählen nicht");
  ok(radarRoboter("calendar-notification@google.com") && radarRoboter("info+noreply@greenlyte.tech") && radarRoboter("no-reply@calendly.com") && !radarRoboter("joerg.bluemel@pakajo.world") && !radarRoboter("info@musterfirma.de"), "Maschinen-Absender erkannt, Menschen nicht");
  ok(absenderTeile("\"Jörg Blümel\" <Joerg.Bluemel@pakajo.world>").name === "Jörg Blümel" && absenderTeile("x@y.de").name === "" && absenderTeile("Jörg <J@p.de>").adresse === "j@p.de", "Absender in Name und Adresse zerlegt");
  ok(antwortVorab({ vonAdresse: "newsletter@musterfirma.de", betreff: "Einladung: Herbst-Webinar", text: "Jetzt anmelden" }) === null, "„Einladung:“ ohne Kalender-Merkmal ist kein Termin");
  ok(antwortVorab({ vonAdresse: "a@b.de", betreff: "AW: x", text: "Wir sind DSGVO-konform aufgestellt — wie ist das bei Ihnen?" }) === null, "„DSGVO“ in einer Frage ist kein Datenschutz-Antrag");
  const ds = datenschutzEntwurf({ name: "Musterfirma", domain: "musterfirma.de", email: "max@musterfirma.de", impressum: { seite: "https://musterfirma.de/impressum" } }, "Max Muster <max@musterfirma.de>", false);
  ok(/https:\/\/musterfirma\.de\/impressum/.test(ds) && /Art\. 15 DSGVO/.test(ds) && /gesperrt/.test(ds) && globalWortPruefen(ds).length === 0 && !/Mara Lindner/.test(ds) && /^Guten Tag Max Muster,/.test(ds), "Datenschutz-Antwort: Quelle, Art. 15, Sperrvermerk, Wortwand sauber, von Justin");
  const dsEn = datenschutzEntwurf({ name: "Muster", domain: "muster.com", website: "https://muster.com" }, "tom@muster.com", true);
  ok(/^Hello,/.test(dsEn) && /Art\. 15 GDPR/.test(dsEn) && /https:\/\/muster\.com/.test(dsEn), "Datenschutz-Antwort auf Englisch");

  const sigEn = sig.htmlAusText("Dear Max Muster,\n\nOne sentence.\n\nBook a time directly: https://fiaon.com/en?utm_source=radar#gespraech\n\nBest regards\nMara Lindner\nDigital assistant\n\n—\nFIAON LTD · Fuß", sig.maraSignatur("Justin Schwarzott", { rolle: "Digital assistant to Justin Schwarzott" }), "en");
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

abschnitt("Österreich: keine Mail, kein automatischer Brief (E-458; Justin 29.10.: nur DE und CH)");
{
  ok(sh8.radarLandFuer({ land: "AT" }) === "AT" && sh8.radarLandFuer({ land: "", domain: "beispiel.at" }) === "AT" && sh8.radarLandFuer({ impressum: { land: "CH" } }) === "CH" && sh8.radarLandFuer({}) === "DE", "Land: Spalte, sonst Impressum, sonst Domäne, sonst DE");
  ok(!sh8.radarMailErlaubt("AT") && sh8.radarMailErlaubt("DE") && sh8.radarMailErlaubt("CH"), "Mail nach DE und CH, nicht nach AT");
  const impAt = { name: "Beispiel Handel GmbH", strasse: "Musterstraße 1", plz: "1010", ort: "Wien", land: "AT", vertreter: [{ name: "Anna Beispiel", funktion: "Geschäftsführerin" }] };
  const atFirma = { status: "gescannt", land: "AT", signal_staerke: 4, impressum: impAt, name: impAt.name, domain: "beispiel-handel.example", entscheider: { name: "Anna Beispiel", email: "anna.beispiel@beispiel-handel.example" }, versendet_am: null, brief_versendet_am: null };
  // E-458 (Justin 29.10.2026, wörtlich „kein Brief, keine Email“): auch kein Brief von Hand mehr.
  ok(!sh8.radarBriefPruefen(atFirma).ok && /weder Mail noch Brief/.test(sh8.radarBriefPruefen(atFirma).punkte.find((p) => p.key === "land")?.text ?? "") && !sh8.radarBriefPruefen({ ...atFirma, land: "DE", domain: "beispiel-handel.example", impressum: { ...impAt, land: "AT" } }).ok,
    "Österreich: weder Mail noch Brief — auch nicht von Hand in der Akte (Land-Punkt in der Brief-Prüfung)");
  ok(!sh8.radarBriefPruefen({ ...atFirma, land: "DE", impressum: { ...impAt, land: "DE", plz: "10115", ort: "Berlin" } }).ok, "Deutschland mit persönlicher Adresse → die Mail geht vor");
  const lib8 = lies("server/lib/fiaon-radar.ts"), fd8 = lies("server/lib/fiaon-radar-faden.ts"), br8 = lies("server/lib/fiaon-radar-brief.ts");
  ok(/if \(!radarMailErlaubt\(radarLandFuer\(f\)\)\) throw new RadarFehler\("Nach Österreich geht keine Mail — vorerst nur Deutschland und die Schweiz\."\)/.test(lib8), "radarMailAusgeben wirft für Österreich — gilt für Motor, Stapel und Akte");
  // E-458 (Nachbesserung): EINE Regel „Österreich gewinnt“ als SQL-Teil (sqlOesterreich) — im Ende-zu-Ende-Lauf auch gegen die Datenbank geprüft.
  ok(/nachfass_stufe < [\s\S]{0,300}AND NOT \$\{sqlOesterreich\(\)\}/.test(fd8) && /SET nachfass_faellig = NULL WHERE nachfass_faellig IS NOT NULL AND \$\{sqlOesterreich\(\)\}/.test(fd8), "Kein Nachfassen nach Österreich (auch nicht auf eine alte erste Mail)");
  ok(/wiedervorlage_am <= NOW\(\)[\s\S]{0,300}AND NOT \$\{sqlOesterreich\(\)\}/.test(fd8), "Keine Wiedervorlage-Mail nach Österreich");
  const imp = (x: Record<string, unknown>) => ({ land: "DE", domain: "beispiel.example", impressum: { land: "DE", ...x } });
  ok(sh8.radarLandFuer({ land: "DE", domain: "beispiel-handel.at" }) === "AT" && sh8.radarLandFuer(imp({ ustId: "ATU 12345678" })) === "AT" && sh8.radarLandFuer(imp({ telefon: "+43 1 234 56 78" })) === "AT"
    && sh8.radarLandFuer(imp({ telefon: "0043 1 234" })) === "AT" && sh8.radarLandFuer(imp({ telefon: "+49 30 1234" })) === "DE" && sh8.radarLandFuer({ land: "CH", domain: "beispiel.ch" }) === "CH",
    "Österreich gewinnt: Spalte „DE“ mit .at-Domäne, UID ATU oder Telefon +43/0043 → AT; +49 bleibt DE, .ch bleibt CH");
  ok(/COALESCE\(r\.motor_status, ''\) NOT IN \('arbeit', 'bereit', 'sendet'\) AND r\.strom = 'firma'/.test(br8), "Brief-Lauf: kein Brief, solange die Mail in der Warteschlange liegt; nur Firmen");
  ok(/ADD COLUMN IF NOT EXISTS strom TEXT NOT NULL DEFAULT 'firma',[\s\S]{0,500}ADD COLUMN IF NOT EXISTS partner_firma_id INTEGER,[\s\S]{0,200}ADD COLUMN IF NOT EXISTS motor_sendefehler INTEGER NOT NULL DEFAULT 0,\s*ADD COLUMN IF NOT EXISTS entscheider_websuche_am TIMESTAMPTZ`/.test(lib8) && /fiaon_radar_firmen_motor_idx ON fiaon_radar_firmen \(motor_status, strom, signal_staerke\)/.test(lib8), "Neue Spalten in EINEM ALTER, Index für die Warteschlange");
}

abschnitt("Text und Unterschrift: menschlich, nie nach KI (E-458)");
{
  const lib = await import("../server/lib/fiaon-radar");
  const sig8 = await import("../server/lib/fiaon-signatur");
  const gm = await import("../server/lib/fiaon-gmail");
  const fd = await import("../server/lib/fiaon-radar-faden");
  const basis = {
    betreff: "Ihre neue Halle",
    absaetze: [
      "Ich habe gesehen, dass Sie in diesem Jahr eine zweite Halle bauen. So ein Schritt bindet viel Kapital, lange bevor er etwas einbringt.",
      "Wir gründen Ihnen eine eigene LLC in den USA, vergleichbar mit einer GmbH. Dann kümmern wir uns um Konto, Firmenkarten und den Weg zu US-Funding. Das Amerikanische erledigt unser Team vor Ort.",
    ],
    frage: "Wäre das für Ihre Pläne gerade ein Thema?", ps: "",
  };
  // E-458 (Befund „Echo“): Der Schlusssatz wird zur Frage gewählt — keiner, der „gerade“ oder „Thema“ wiederholt.
  const schluss = sh8.radarSchlusssatzFuer(0, basis.frage);
  ok(!sh8.radarSchlussEcho(basis.frage, schluss).length && sh8.radarSchlussEcho(basis.frage, sh8.RADAR_SCHLUSSSAETZE[0]).join(",") === "gerade,thema", `Schlusssatz ohne Echo zur Frage gewählt („${schluss}“)`);
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
  ok(sh8.RADAR_SCHLUSSSAETZE.length === 6 && sh8.RADAR_SCHLUSSSAETZE.every((x) => !globalWortPruefen(x).length && !/[?!–—]/.test(x) && !/abmeld|verteiler|newsletter/i.test(x)), "Sechs natürliche Schlusssätze, Wortwand sauber, kein Abmelde-Wort");
  ok(sh8.radarSchlusssatz(7) === sh8.radarSchlusssatz(7) && sh8.radarSchlusssatz(0) !== sh8.radarSchlusssatz(1) && sh8.radarGruss(2) === "Viele Grüße" && sh8.radarGruss(3) === "Beste Grüße", "Schlusssatz und Gruß je Firma fest (gleiche ID, gleicher Satz)");
  // E-458 (Befund „Echo“): Für jede Frage gibt es einen Schlusssatz ohne gemeinsames Wort; die strenge Prüfung sperrt ein Echo.
  for (const fr of ["Wäre das für Ihre Pläne gerade ein Thema?", "Passt das gerade zu Ihren Plänen?", "Ist das im Moment ein Thema für Sie?", "Darf ich Ihnen unsere Konditionen schriftlich schicken?"]) {
    for (const id of [0, 1, 2, 3, 4, 5]) ok(!sh8.radarSchlussEcho(fr, sh8.radarSchlusssatzFuer(id, fr)).length, `Kein Echo: „${fr}“ (Firma ${id}) → „${sh8.radarSchlusssatzFuer(id, fr)}“`);
  }
  ok(sp({}, { schluss: sh8.RADAR_SCHLUSSSAETZE[0] }).some((x) => /Schlusssatz wiederholt die Frage/.test(x)), "Streng: „gerade ein Thema? … gerade kein Thema“ sperrt");
  // E-458 (Befund): Sollzins nur mit Einführungszeitraum, kein Euro-Betrag, keine Prozentzahl in Firmen-Mails.
  ok(sp(mit("Viele Karten starten ohne Sollzins.")).some((x) => /ohne Sollzins/.test(x)) && !sp(mit("Viele Karten starten mit einem Einführungszeitraum ohne Sollzins.")).some((x) => /Sollzins/.test(x)), "Streng: „ohne Sollzins“ sperrt — mit „Einführungszeitraum“ im selben Satz nicht");
  ok(sp(mit("Das kostet sonst 50.000 € Zinsen.")).some((x) => /Euro/.test(x)) && sp(mit("Das sind 3.900 Euro im Jahr.")).some((x) => /Euro/.test(x)), "Streng: Euro-Betrag sperrt (vorher nur ein Hinweis)");
  ok(sp(mit("Ihr Umsatz wuchs um 40 Prozent.")).some((x) => /Prozentzahl/.test(x)) && sp(mit("Ihr Umsatz wuchs um 40 %.")).some((x) => /Prozentzahl/.test(x)), "Streng: Prozentzahl in der Firmen-Mail sperrt");
  // Partner: Provision nur im freigegebenen Satz; Steuerberater nie, auch nicht im Betreff; „Gespräch“ zählt als Gesprächswunsch.
  const satz = "30 Prozent unseres Honorars, ein Jahr lang";
  const pmail = { betreff: "Ihre Kunden mit Plänen in den USA", absaetze: ["Ich habe auf Ihrer Seite gelesen, dass Sie vor allem inhabergeführte Händler und Hersteller bei ihren Investitionen begleiten. Gerade diese Unternehmer suchen oft einen zweiten Weg zu Kapital, neben der Hausbank.", `Wir gründen ihnen eine eigene Gesellschaft in den USA und kümmern uns um Konto und Firmenkarten. Für jeden Kunden, den Sie uns vorstellen, bekommen Sie ${satz}.`], frage: "Darf ich Ihnen unsere Konditionen schriftlich schicken?", ps: "" };
  const pp = (m: Record<string, unknown>, gruppe: string, extra: Record<string, unknown> = {}) => lib.mailPruefen({ ...pmail, ...m } as any, { streng: true, strom: "partner", gruppe, anrede: "Guten Tag Martin Keller,", schluss: sh8.radarSchlusssatzFuer(1, pmail.frage), mitLink: false, provisionText: satz, ...extra }).sperrend;
  ok(!pp({}, "finanzierer").length, `Partner mit Provision: der freigegebene Satz besteht (${pp({}, "finanzierer").join("; ")})`);
  ok(pp({ absaetze: [pmail.absaetze[0], pmail.absaetze[1].replace(satz, "25 Prozent für zwei Jahre")] }, "finanzierer").some((x) => /außerhalb des freigegebenen Satzes/.test(x)), "Partner mit Provision: eine andere Prozentzahl sperrt");
  ok(pp({ betreff: "30 % für Ihre Mandanten", absaetze: [pmail.absaetze[0], "Wir gründen ihnen eine eigene Gesellschaft in den USA und kümmern uns um Konto und Firmenkarten. Die steuerliche Betreuung bleibt ganz bei Ihnen, und wir stellen uns gegenseitig Mandanten vor."] }, "steuerberater").some((x) => /keine Provision/.test(x)), "Steuerberater: Provision im BETREFF sperrt");
  ok(pp({ frage: "Hätten Sie Zeit für ein kurzes Gespräch?" }, "finanzierer").some((x) => /Gesprächswunsch/.test(x)) && pp({ frage: "Wollen wir uns kurz austauschen?" }, "finanzierer").some((x) => /Gesprächswunsch/.test(x)), "Partner: „Gespräch“ und „austauschen“ sperren");
  // Partner-Angebot: über Konto und Karte entscheidet die Bank — nie „bekommen bei uns“; der Provisions-Satz kommt aus dem Chefbüro.
  ok(sh8.RADAR_PARTNER_GRUPPEN.every((g) => !/bekommen bei uns/i.test(g.angebot)) && sh8.radarPartnerAngebot(sh8.radarPartnerGruppe("finanzierer"), "25 Prozent unseres Honorars, zwei Jahre lang").includes("25 Prozent unseres Honorars, zwei Jahre lang") && !sh8.radarPartnerAngebot(sh8.radarPartnerGruppe("steuerberater"), satz).includes("Prozent"), "Partner-Angebot: nie „bekommen bei uns“; Provisions-Satz eingesetzt, Steuerberater ohne");
  // Anrede: Titel bleibt, Partner „Guten Tag“, Firmen „Hallo“; die Anrede gehört dem Menschen hinter der Adresse.
  ok(lib.anredeFuer("Dr. Anna Brandt", "Frau", { partner: true }) === "Guten Tag Frau Dr. Brandt," && lib.anredeFuer("Prof. Dr. Max Müller", "Herr") === "Hallo Herr Prof. Dr. Müller," && lib.anredeFuer("Anna Berg", "Frau") === "Hallo Frau Berg,", "Anrede: „Frau Dr. Brandt“ (Partner: „Guten Tag“), „Herr Prof. Dr. Müller“, Firmen weiter „Hallo“");
  ok(sh8.radarEmpfaengerName("m.mueller@beispiel.example", ["Anna Beispiel", "Max Müller"]) === "Max Müller" && sh8.radarEmpfaengerName("info@beispiel.example", ["Anna Beispiel"]) === null, "Die Anrede gehört dem Menschen hinter der Adresse (zwei Geschäftsführer)");
  ok(sh8.radarAnredeName("Hallo Frau Dr. Brandt,") === "Brandt" && sh8.radarAnredeName("Guten Tag Max Müller,") === "Max Müller" && sh8.radarAnredeName("Guten Tag,") === null, "Name aus der Anrede gelesen (für die Wand beim Senden)");
  ok(/if \(anredeName && !radarAdressePersoenlich\(an, \[anredeName\]\)\) throw new RadarFehler/.test(lies("server/lib/fiaon-radar.ts")), "Beim Senden: Anrede und Empfänger müssen zusammenpassen");
  // Kurzer, persönlicher Terminlink statt utm_campaign; Impressum-Zeile mit Sitzanschrift.
  ok(sh8.radarKurzlink(4101) === "https://fiaon.com/g/r4101" && sh8.radarKurzlinkZiel("r4101") === "/?utm_source=radar&utm_medium=email&utm_campaign=firmen_radar&utm_content=r4101#gespraech" && sh8.radarKurzlinkZiel("x<script>") === "/", "Kurzlink fiaon.com/g/r<ID> → Startseite mit Zuordnung und Anker (E-461, ohne 301-Kette); Unsinn → Startseite");
  ok(sh8.radarTerminLink(7) === "https://fiaon.com/?utm_source=radar&utm_medium=email&utm_campaign=firmen_radar&utm_content=r7#gespraech", "Terminlink direkt auf fiaon.com/ (dort steht seit E-461 „Gespräch vereinbaren“, #gespraech)");
  // E-458 nach E-461: radarStartseiteLink stellt jede Form der Übersicht auf „/“ bzw. „/en“ — auch gespeicherte Links.
  const sl = sh8.radarStartseiteLink;
  ok(sl("https://fiaon.com/business?utm_source=radar&utm_content=r7#gespraech") === "https://fiaon.com/?utm_source=radar&utm_content=r7#gespraech"
    && sl("https://fiaon.com/business?utm_source=radar&utm_content=r7#gespraech", true) === "https://fiaon.com/en?utm_source=radar&utm_content=r7#gespraech"
    && sl("https://fiaon.com/en/business#gespraech", true) === "https://fiaon.com/en#gespraech"
    && sl("https://fiaon.com/?utm_source=radar#gespraech", true) === "https://fiaon.com/en?utm_source=radar#gespraech"
    && sl("https://fiaon.com/business/") === "https://fiaon.com/" && sl("https://fiaon.com") === "https://fiaon.com/" && sl("/business?x=1") === "/?x=1",
    "Gespeicherte Links: /business, /en/business, „/“ → direkt „/“ bzw. „/en“ — utm und Anker bleiben");
  ok(sl("https://fiaon.com/business/onlinehandel?utm_source=radar") === "https://fiaon.com/business/onlinehandel?utm_source=radar" && sl("https://fiaon.com/g/r12") === "https://fiaon.com/g/r12"
    && sl("https://fiaon.com/business-antrag") === "https://fiaon.com/business-antrag" && sl("https://fiaon.com/enterprise?x") === "https://fiaon.com/enterprise?x",
    "Unterseiten, Kurzlink und ähnliche Pfade bleiben unverändert");
  const altText = lib.mailText({ anrede: "Hallo Frau Beispiel,", absaetze: ["Ein Satz."], frage: "Passt es?", links: { gespraech: "https://fiaon.com/business?utm_source=radar&utm_content=r9#gespraech", seite: "https://fiaon.com/business?utm_source=radar" }, schluss, gruss: "Viele Grüße", mitLink: true });
  ok(altText.includes("https://fiaon.com/?utm_source=radar&utm_content=r9#gespraech") && !/fiaon\.com\/business/.test(altText), "Mail ohne Kurzlink (gespeichert vor E-458): Link und Karte direkt auf die Startseite, kein /business");
  const karteLeer = lib.radarKarteAbsender(null);
  const karteAlt = lib.radarKarteAbsender("https://fiaon.com/business?utm_source=radar&utm_content=r9");
  ok(karteLeer.signaturHtml.includes('href="https://fiaon.com/"') && karteLeer.signaturHtml.includes(">fiaon.com</a>") && !/\/business/.test(karteLeer.signaturHtml + karteLeer.signaturText)
    && karteAlt.signaturHtml.includes('href="https://fiaon.com/?utm_source=radar&amp;utm_content=r9"') && !/\/business/.test(karteAlt.signaturHtml + karteAlt.signaturText),
    "Justins Karte (Rückweg für js@): Startseite fiaon.com/ direkt, sichtbar „fiaon.com“ — auch aus alten Mails mit /business");
  const fdLink = lies("server/lib/fiaon-radar-faden.ts");
  ok(/const link = radarStartseiteLink\(f\.mail\?\.links\?\.gespraech \?\? "https:\/\/fiaon\.com\/#gespraech", en\);/.test(fdLink) && !/fiaon\.com\/(en\/)?business/.test(fdLink.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n")),
    "Maras Antworten und Karten: Terminlink und Seite direkt auf fiaon.com/ bzw. /en (auch alte gespeicherte Links)");
  // Kein Ziel des Motors (Mail, Kurzlink, QR, Karte, Antwort, Nachfass) zeigt mehr auf die Übersicht /business.
  const motorDateien = ["shared/fiaon-radar.ts", "server/routes/fiaon-radar.ts", ...fs.readdirSync(path.join(wurzel, "server/lib")).filter((d) => /^fiaon-radar.*\.ts$/.test(d)).map((d) => `server/lib/${d}`)];
  const treffer = motorDateien.flatMap((d) => lies(d).split("\n").map((z, i) => ({ d, i: i + 1, z }))
    .filter(({ z }) => !/^\s*(\/\/|\*|\/\*)/.test(z) && /\/business(?=[?#"'`\s]|$)|fiaon\.com\/en\/business/.test(z)));
  ok(motorDateien.length >= 9 && !treffer.length, `Kein Motor-Link mehr auf /business (${treffer.map((t) => `${t.d}:${t.i}`).join(", ") || "sauber"})`);
  const kurzHtml = lib.mailHtml({ anrede: "Hallo Frau Beispiel,", absaetze: ["Ein Satz."], frage: "Passt es?", links: { gespraech: sh8.radarTerminLink(4101), seite: "https://fiaon.com/", kurz: sh8.radarKurzlink(4101) }, schluss, gruss: "Viele Grüße", mitLink: true });
  const kurzText = lib.mailText({ anrede: "Hallo Frau Beispiel,", absaetze: ["Ein Satz."], frage: "Passt es?", links: { gespraech: sh8.radarTerminLink(4101), seite: "https://fiaon.com/", kurz: sh8.radarKurzlink(4101) }, schluss, gruss: "Viele Grüße", mitLink: true });
  ok(kurzHtml.includes(">fiaon.com/g/r4101</a>") && !/utm_campaign|Einen Termin wählen/.test(kurzHtml) && kurzText.includes("Wenn Sie mögen, suchen Sie sich hier direkt eine Zeit aus: https://fiaon.com/g/r4101") && !sh8.radarSchlussEcho(lib.RADAR_LINK_SATZ, "Passt das gerade zu Ihrem Thema?").length && !/utm_/.test(kurzText), "Mail zeigt den Kurzlink als normalen Satz — kein utm im Blick, kein Werbe-Knopf");
  ok(/app\.get\('\/g\/:kennung'/.test(lies("server/routes.ts")) && /res\.redirect\(302, radarKurzlinkZiel\(req\.params\.kennung\)\)/.test(lies("server/routes.ts")), "Server leitet /g/r<ID> weiter (302, noindex)");
  ok(sig8.impressumZeileText().includes(FIAON_FIRMA.strasse) && sig8.impressumZeileText().includes("England and Wales") && sig8.impressumZeileText().includes(FIAON_FIRMA.companyNo) && sig8.impressumZeileHtml().includes(">Impressum<"), "Impressum-Zeile mit Sitzanschrift und Register (England and Wales)");
  ok(fd.antwortKern(`Kein Bedarf, danke.\n\nAm Do., 29. Okt. 2026 um 10:05 schrieb Max Beispiel <max@beispiel.example>:\n> ${schluss}`) === "Kein Bedarf, danke." && fd.antwortVorab({ vonAdresse: "max@beispiel.example", betreff: "AW: Ihre neue Halle", text: schluss }) === null, "Der Schlusssatz im Zitat wird abgeschnitten und nie als Abmeldung gelesen");
  // E-458 (Befund): Das eingeladene „kurze Nein“ erkennt die Regel — ohne KI, auch in der KI-Pause; mit Gruß darunter auch.
  const vorab = (text: string) => fd.antwortVorab({ vonAdresse: "max@beispiel.example", betreff: "AW: Ihre neue Halle", text });
  ok(vorab("Nein.") === "kein_interesse" && vorab("Nein danke") === "kein_interesse" && vorab("Kein Thema.") === "kein_interesse" && vorab("Ist gerade kein Thema.") === "kein_interesse" && vorab("Nein.\n\nViele Grüße\nMax Beispiel\nGeschäftsführer") === "kein_interesse",
    "„Nein.“, „Nein danke“, „Kein Thema.“ — auch mit Gruß und Unterschrift darunter — sind eine Absage (Regel, ohne KI)");
  ok(vorab("Nein, aber melden Sie sich gern im Januar wieder.") === null && vorab("Nein.\n\nAber im Januar gern.") === null, "„Nein, aber im Januar“ bleibt für die Einordnung (keine falsche Sperre)");
  ok(/wartend\.add\(firmaId\)/.test(lies("server/lib/fiaon-radar-faden.ts")) && /id <> ALL\(\$\{Array\.from\(wartet\)\}::int\[\]\)/.test(lies("server/lib/fiaon-radar-faden.ts")), "Liegt eine Antwort noch uneingeordnet im Faden, wartet das Nachfassen");
  ok(!/Abmeldesatz/.test(sh8.RADAR_ANTWORT_ARTEN.kein_interesse.was), "„Kein Interesse“ erklärt sich ohne Abmeldesatz");
  // Die Mail sieht aus wie in Gmail geschrieben — mit der echten Unterschrift des Postfachs.
  const anna = { postfach: "anna@versand.example", name: "Anna Beispiel", signaturHtml: '<div dir="ltr"><b>Anna Beispiel</b><br>Partnerschaften<br><img src="https://bilder.example/anna.png" width="80"></div>', signaturText: "Anna Beispiel\nPartnerschaften", quelle: "gmail" as const };
  const lk = { gespraech: "https://fiaon.com/?utm_source=radar&utm_content=r7#gespraech", seite: "https://fiaon.com/" };
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
  // E-458 (Befund): mehrere Vorlagen je Stufe (sonst hunderte gleiche Mails); alle bestehen — Partner auch als Steuerkanzlei.
  for (const strom of ["firma", "partner"] as const) for (const stufe of [1, 2]) {
    const liste = fd.NACHFASS_VORLAGEN[strom][stufe - 1];
    ok(liste.length >= 2 && new Set(liste.map((v) => v.absaetze.join(" "))).size === liste.length, `Nachfass-Vorlagen ${strom} Stufe ${stufe}: ${liste.length} verschiedene Fassungen`);
    liste.forEach((v, i) => {
      const r = lib.mailPruefen({ betreff: "Ihre neue Halle", absaetze: v.absaetze, frage: v.frage, ps: "" }, fd.nachfassRegeln(strom, stufe, strom === "partner" ? "steuerberater" : null));
      ok(!r.sperrend.length && !/bekommen bei uns/i.test(v.absaetze.join(" ")), `Nachfass-Vorlage ${strom} Stufe ${stufe} Fassung ${i + 1} besteht die strenge Prüfung (${r.sperrend.join("; ")})`);
    });
  }
  ok(fd.nachfassVorlage("firma", 2, 10) !== fd.nachfassVorlage("firma", 2, 11) && fd.nachfassVorlage("firma", 2, 10) === fd.nachfassVorlage("firma", 2, 10), "Die Vorlage ist je Firma fest und wechselt zwischen Firmen");
  ok(/Diese Mail ist nach alten Regeln geschrieben oder verletzt sie/.test(libQ) && /export function radarMailWand\(f: any, motor: RadarMotor\)/.test(libQ) && /streng: true, strom, gruppe: m\.gruppe \?\? null,[\s\S]{0,300}provisionText: strom === "partner" \? motor\.partnerProvisionText : null/.test(libQ), "Beim Senden gelten die strengen Regeln — für Motor, Stapel und Akte (radarMailWand, mit Provisions-Satz)");
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
  ok(["ZUSAGE", "Zinssatz", "Betrag", "Bürgschaft", "„bis zu“", "Bankname", "ERFUNDEN", "KI-KLANG", "Gedankenstrich", "Aufzählung", "Floskeln"].every((w) => anw.includes(w)), "Die Prüf-Anweisung nennt Zusage, Zinssatz, Betrag, Bürgschaft, „bis zu“, Bankname, Erfundenes, KI-Klang, Gedankenstrich, Aufzählung, Floskeln");
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
  // E-458 (Befund): Die Anweisung kennt den Aufbau der Mail (Link und Schlusssatz nach der Frage), das Hauswort zum Sollzins,
  // den Provisions-Satz aus dem Chefbüro, und beim Nachfassen die erste Mail und den Abschluss ohne neuen Nutzen.
  const anwF = pk.radarPruefAnweisung({ strom: "firma" });
  // E-458 (Befund Prüf-KI 29.10.): Link-Satz und Schlusssatz stehen NICHT in der Eingabe — die Anweisung sagt nur, dass es sie gibt;
  // die freigegebene Leistungsbeschreibung steht ausdrücklich als „keine Zusage“ da; Erfahrungssätze mit „meist/oft“ sind erlaubt.
  ok(/festen Link-Satz und einen festen Schlusssatz\. Beide stehen NICHT unten und werden nicht geprüft/.test(anwF) && /KEINE Zusage ist die freigegebene Beschreibung unserer Leistung/.test(anwF)
    && /uns um Geschäftskonto und Firmenkarten kümmern oder dabei helfen/.test(anwF) && /„Einführungszeitraum ohne Sollzins“ \(das Hauswort\)/.test(anwF) && /„ohne Sollzins“ ohne „Einführungszeitraum“ ist eine Zusage/.test(anwF)
    && /Allgemeine Erfahrungssätze mit „meist“, „oft“ oder „häufig“/.test(anwF),
    "Prüf-Anweisung: Link und Schlusssatz nicht in der Eingabe; freigegebene Leistung ist keine Zusage; Hauswort; allgemeine Erfahrungssätze erlaubt");
  const anwP = pk.radarPruefAnweisung({ strom: "partner", provision: true, provisionText: "25 Prozent unseres Honorars, zwei Jahre lang" });
  ok(anwP.includes("„25 Prozent unseres Honorars, zwei Jahre lang“") && !anwP.includes("30 Prozent") && /wobei FIAON den Mandanten oder Kunden dieses Partners hilft/.test(anwP) && !/bei FIAON bekommen/.test(anwP), "Prüf-Anweisung Partner: Provisions-Satz aus dem Chefbüro, Nutzen als Hilfe statt „bekommen“");
  const anwN = pk.radarPruefAnweisung({ strom: "partner", art: "nachfass", stufe: 2, provision: false, maxKlang: 2 });
  ok(/KEINE Provision/.test(anwN) && /ein neuer Nutzen ist hier NICHT nötig/.test(anwN) && /ki_klang ≤ 2/.test(anwN) && /DIE ERSTE MAIL/.test(anwN), "Prüf-Anweisung Nachfass Stufe 2: Kanzlei ohne Provision, Abschluss ohne neuen Nutzen, KI-Klang aus dem Chefbüro, Bezug zur ersten Mail");
  // Das Nachfassen Ende zu Ende mit Attrappen (Schreiber und Prüferin): eine Steuerkanzlei bekommt nie eine Provision.
  const fd = await import("../server/lib/fiaon-radar-faden");
  const mm = { ...sh8.radarMotorLesen({}), kiKlangMax: 2 };
  const kanzlei = { id: 77, name: "Kanzlei Beispiel", strom: "partner", bereich: "steuerberater", domain: "kanzlei.example", scan: { aufhaenger: [], profil: {} },
    mail: { betreff: "Ihre Mandanten im Onlinehandel", anrede: "Guten Tag Frau Dr. Beispiel,", absaetze: ["Ich habe gesehen, dass Sie viele Onlinehändler betreuen."], frage: "Haben Sie Mandanten, für die das gerade ein Thema ist?", text: "Erste Mail" } };
  const mitProvision = { absaetze: ["ich melde mich noch einmal kurz. Für jede Vorstellung erhalten Sie 30 Prozent unseres Honorars, ein Jahr lang, und wir kümmern uns um Konto und Karten Ihrer Mandanten in den USA."], frage: "Haben Sie Mandanten, für die das gerade ein Thema ist?" };
  let geschrieben = 0, gelesen = "";
  pk.radarPruefModellSetzen(async (e) => { gelesen = `${e.anweisung}\n${e.eingabe}`; return JSON.stringify({ ...gut, ki_klang: 1 }); });
  const nf1 = await fd.nachfassSchreiben(kanzlei, 1, mm, async () => { geschrieben++; return mitProvision; });
  ok(nf1.vorlage && geschrieben === 2 && !/provision|prozent|honorar/i.test(nf1.absaetze.join(" ")) && !gelesen, `Nachfass an eine Steuerkanzlei mit „30 Prozent“: die feste Wand sperrt zweimal, es geht die Vorlage ohne Provision (${geschrieben} Versuche)`);
  const sauberNf = { absaetze: ["ich melde mich noch einmal kurz zu meiner letzten Nachricht. Wenn einer Ihrer Mandanten in den USA verkaufen will, gründen wir dort die Gesellschaft und kümmern uns um Konto und Karten."], frage: "Haben Sie gerade so einen Fall?" };
  const nf2 = await fd.nachfassSchreiben(kanzlei, 1, mm, async () => sauberNf);
  pk.radarPruefModellSetzen(null);
  ok(!nf2.vorlage && /KEINE Provision/.test(gelesen) && /ki_klang ≤ 2/.test(gelesen) && /DIE ERSTE MAIL[\s\S]*Ich habe gesehen, dass Sie viele Onlinehändler betreuen/.test(gelesen), "Nachfass sauber: die Prüf-KI liest mit „KEINE Provision“, dem KI-Klang aus dem Chefbüro und der ersten Mail");
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
  // E-458 (29.10.): seit nur noch EINER Nachfass-Stufe (RADAR_NACHFASS_TAGE = [3]) die Rechnung mit zwei Stufen ausdrücklich.
  const mg = sh8.radarMoeglich({ postfaecher: [pf("js@fiaon.com", 0)], reststunden: 12, fensterStunden: 12, ziele: { firma: 10, partner: 10 }, nachfassStufen: 2 });
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
  ok(/pg_advisory_xact_lock\(\$\{MOTOR_SPERRE\}\)/.test(motorQ) && /MOTOR_SPERRE = 458001/.test(motorQ) && /SET motor_status = 'sendet'[\s\S]{0,700}RETURNING id/.test(motorQ), "Übernahme unter pg_advisory_xact_lock mit motor_status = 'sendet' … RETURNING");
  const kandQ = motorQ.slice(motorQ.indexOf("export async function kandidatNehmen"), motorQ.indexOf("async function verwerfen"));
  ok(/r\.strom = \$\{strom\}/.test(kandQ) && /r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(kandQ) && /ORDER BY \$\{sqlWebsucheErfolglos\(\)\} ASC, COALESCE\(r\.signal_staerke, \$\{RADAR_SIGNAL_AB\}\) DESC, r\.passung DESC/.test(kandQ) && /AND NOT \$\{sqlOesterreich\(\)\}/.test(kandQ) && /r\.motor_status IS NULL/.test(kandQ) && /FOR UPDATE SKIP LOCKED/.test(kandQ)
    && /\(\$\{strom\} <> 'partner' OR r\.bereich = ANY\(\$\{\[\.\.\.gruppen\]\}::text\[\]\)\)/.test(kandQ), "Kandidaten: Strom-Filter, nur eingeschaltete Partner-Gruppen, Signal ≥ 3, stärkstes Signal und Passung zuerst, ohne Österreich, über motor_status (nicht automatik_am)");
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

// E-458 (Befund der ersten echten Mails, 29.10. abends): EINE Sprachregel für Schreib-KI (Firma, Partner) und Prüf-KI.
{
  const lib = lies("server/lib/fiaon-radar.ts"), pr = lies("server/lib/fiaon-radar-pruef.ts"), sh = lies("shared/fiaon-radar.ts");
  ok(/export const RADAR_SPRACHE_REGEL =/.test(sh) && /Satzfetzen/.test(sh), "Sprachregel steht einmal in shared/fiaon-radar.ts");
  ok((lib.match(/`- \$\{RADAR_SPRACHE_REGEL\}`/g) ?? []).length === 2, "Schreib-Anweisung Firma und Partner tragen die Sprachregel");
  ok(/8\. SPRACHE: \$\{RADAR_SPRACHE_REGEL\}/.test(pr) && /NICHT beanstanden: die Anrede-Zeile/.test(pr) && /9\. PARTNER/.test(pr), "Prüf-KI: Regel 8 Sprache (Anrede = Hausstil, nicht beanstanden), Partner jetzt Regel 9");
}

// ── Ende zu Ende gegen den LOKALEN Prüfstand (nur mit PRUEF_MOTOR_DB=an und einer EIGENEN Datenbank auf 127.0.0.1) ──
if (process.env.PRUEF_MOTOR_DB === "an") {
  abschnitt("Mail-Motor Ende zu Ende im lokalen Prüfstand (E-458)");
  const url = String(process.env.DATABASE_URL ?? "");
  // E-458 (Befund): Der Lauf leert die Radar-Tabellen und alle radar_*-Schalter — deshalb nur gegen eine EIGENE Wegwerf-
  // Datenbank fiaon_e458_<name> auf 127.0.0.1:54329, nie gegen die gemeinsame Vorlage fiaon_pruefstand anderer Sitzungen.
  const dbName = (url.split("/").pop() ?? "").split("?")[0];
  if (!/@127\.0\.0\.1:54329\//.test(url) || !/^fiaon_e458_[a-z0-9_]+$/.test(dbName)) {
    ok(false, `Ende-zu-Ende nur gegen eine eigene Datenbank fiaon_e458_… auf 127.0.0.1:54329 (nicht „${dbName || "?"}“)`);
  } else {
    const { sqlPool } = await import("../server/lib/db-pool");
    const lib = await import("../server/lib/fiaon-radar");
    const mo = await import("../server/lib/fiaon-radar-motor");
    await lib.ensureRadarTabellen();
    const setzen = async (werte: Record<string, string>) => { for (const [k, w] of Object.entries(werte)) await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${k}, ${w}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`; };
    const jetztBerlin = sh8.radarBerlinTagMinute(new Date());
    // Das Fenster endet 40 Minuten nach jetzt: Jedes Postfach verteilt seinen Tagesrest über das restliche Fenster (Takt).
    const bisMin = Math.min(23 * 60 + 59, jetztBerlin.minute + 40);
    const bis = `${String(Math.floor(bisMin / 60)).padStart(2, "0")}:${String(bisMin % 60).padStart(2, "0")}`;
    const leeren = async () => { await sqlPool`DELETE FROM fiaon_radar_post`; await sqlPool`DELETE FROM fiaon_radar_firmen`; };
    // E-458 (Nachbesserung): Was Schritt 7 im Partner-CRM anlegt („Beispiel 21 GmbH“, Kontakt „Max Beispiel“), räumt der Lauf
    // selbst wieder weg — sonst wäre „Max Beispiel“ beim nächsten Lauf ein bekannter Partner (Sperre über den Namen).
    const crmLeeren = async () => {
      const ids = ((await sqlPool`SELECT id FROM fiaon_partner_firmen WHERE erstellt_von = 'Mara (Firmen-Radar)' AND name LIKE 'Beispiel % GmbH'`.catch(() => [])) as any[]).map((z) => Number(z.id));
      if (ids.length) {
        await sqlPool`DELETE FROM fiaon_partner_verlauf WHERE firma_id = ANY(${ids})`.catch(() => {});
        await sqlPool`DELETE FROM fiaon_partner_aufgaben WHERE firma_id = ANY(${ids})`.catch(() => {});
        await sqlPool`DELETE FROM fiaon_partner_dokumente WHERE firma_id = ANY(${ids})`.catch(() => {});
        await sqlPool`DELETE FROM fiaon_partner_kontakte WHERE firma_id = ANY(${ids})`.catch(() => {});
        await sqlPool`DELETE FROM fiaon_partner_firmen WHERE id = ANY(${ids})`.catch(() => {});
      }
      (await import("../server/lib/fiaon-radar-partner")).schonPartnerVergessen();
    };
    await crmLeeren();
    await leeren(); await sqlPool`DELETE FROM fiaon_radar_sperre`;
    await sqlPool`DELETE FROM fiaon_settings WHERE key LIKE 'radar_%'`;
    // E-458 (Befund Go-live): Ohne Freigabe sendet der Motor nichts — die Läufe hier gelten dem freigegebenen Motor (die Sperre
    // davor prüft Schritt 18). Die Freigabe liegt zwei Tage zurück: Woche 1 des Hochfahrens, wie nach einem echten Start.
    await setzen({ radar_auto_versand: "an", radar_auto_nachfass: "aus", radar_mara_antwort: "entwurf", radar_auto_ab_passung: "70", radar_motor_tage: String(jetztBerlin.tag), radar_motor_von: "00:00", radar_motor_bis: bis,
      radar_motor_freigabe: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    const mailFirma = { betreff: "Ihre neue Halle", anrede: "Hallo Frau Beispiel,", absaetze: [
      "Ich habe gesehen, dass Sie in diesem Jahr eine zweite Halle bauen. So ein Schritt bindet viel Kapital, lange bevor er etwas einbringt.",
      "Wir gründen Ihnen eine eigene LLC in den USA, vergleichbar mit einer GmbH. Dann kümmern wir uns um Konto, Firmenkarten und den Weg zu US-Funding. Das Amerikanische erledigt unser Team vor Ort."],
      frage: "Wäre das für Ihre Pläne gerade ein Thema?", ps: "", paket: null, warnungen: [], sperrend: [], geaendert: false, erstellt_am: new Date().toISOString(), mitLink: true, strom: "firma" };
    const mailPartner = { betreff: "Ihre Mandanten mit Plänen in den USA", anrede: "Guten Tag Max Beispiel,", absaetze: [
      "Ich habe auf Ihrer Website gelesen, dass Sie viele Onlinehändler betreuen, die auch an Kunden in Übersee verkaufen. Für genau diese Unternehmer haben wir etwas Passendes.",
      "Wir gründen ihnen eine eigene Gesellschaft in den USA und kümmern uns um Geschäftskonto und Firmenkarten. Die steuerliche Betreuung bleibt dabei ganz bei Ihnen, und wir stellen uns gern gegenseitig Mandanten vor."],
      frage: "Haben Sie Mandanten, für die das gerade ein Thema ist?", ps: "", paket: null, warnungen: [], sperrend: [], geaendert: false, erstellt_am: new Date().toISOString(), mitLink: false, strom: "partner", gruppe: "steuerberater" };
    const anlegen = async (n: number, o: { strom?: string; land?: string; mail?: any; status?: string; motor?: string | null; signal?: number; passung?: number; domain?: string; weg?: string; impressum?: Record<string, unknown> } = {}) => {
      const domain = o.domain ?? `firma${n}.example`;
      const roh = o.mail ?? mailFirma;
      // E-458 (Befund „Echo“): der Schlusssatz zur Frage gewählt — wie im Betrieb.
      const mail = { ...roh, schluss: sh8.radarSchlusssatzFuer(n, roh.frage), gruss: sh8.radarGruss(n), links: { gespraech: sh8.radarTerminLink(n), seite: "https://fiaon.com/", kurz: sh8.radarKurzlink(n) } };
      const name = o.strom === "partner" ? "Max Beispiel" : "Anna Beispiel";
      const email = `${name.toLowerCase().replace(" ", ".")}@${domain}`;
      const [z] = (await sqlPool`
        INSERT INTO fiaon_radar_firmen (tag, quelle, bereich, land, name, domain, website, passung, email, ansprechpartner, status, mail, entscheider, signal_staerke, strom, motor_status, motor_am, pruef_ki, impressum)
        VALUES (CURRENT_DATE, 'pruefstand', ${o.strom === "partner" ? "steuerberater" : "bau"}, ${o.land ?? "DE"}, ${`Beispiel ${n} GmbH`}, ${domain}, ${`https://${domain}`}, ${o.passung ?? 85}, ${email}, ${name},
                ${o.status ?? "mail"}, ${sqlPool.json(mail)}, ${sqlPool.json({ name, rolle: "Geschäftsführung", email, anrede: null, quelle: `https://${domain}/impressum`, weg: o.weg ?? "website", am: new Date().toISOString() })},
                ${o.signal ?? 4}, ${o.strom ?? "firma"}, ${o.motor === undefined ? "bereit" : o.motor}, NOW() - INTERVAL '1 hour',
                ${sqlPool.json({ ok: true, hash: lib.radarMailHash(mail), punkte: [], ki_klang: 1, modell: "attrappe", am: new Date().toISOString(), versuch: 1 })},
                ${sqlPool.json({ name: `Beispiel ${n} GmbH`, vertreter: [{ name, funktion: "Geschäftsführung" }], land: o.land ?? "DE", ...(o.impressum ?? {}) })})
        RETURNING id`) as any[];
      return Number(z.id);
    };
    const zeile = async (id: number) => lib.zeileLesen(((await sqlPool`SELECT * FROM fiaon_radar_firmen WHERE id = ${id}`) as any[])[0]) as any;
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
    void f1; void f2; void p1;
    // 1. Erster Takt: genau eine Mail (ein Postfach, Mindestabstand) — die stärkste Firma (Signal 5, aber AT/Sperrliste) fällt durch die Wand.
    let r = await mo.radarMotorSenden({ sender });
    ok(r.gesendet + r.verworfen >= 1 && gesendet.length <= 1, `Erster Takt: höchstens eine Mail aus js@ (gesendet ${r.gesendet}, verworfen ${r.verworfen})`);
    for (let i = 0; i < 6 && gesendet.length < 1; i++) { await zuruecklegen(10); r = await mo.radarMotorSenden({ sender }); }
    const stand = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund, status, versendet_am FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(stand[at].motor_status === "verworfen" && /Österreich/.test(String(stand[at].motor_grund)), `Österreich: beim Senden verworfen (${stand[at].motor_status}: ${stand[at].motor_grund})`);
    ok(stand[gesp].motor_status === "verworfen" && /Sperrliste|gesperrt/i.test(String(stand[gesp].motor_grund)), `Sperrliste: beim Senden verworfen (${stand[gesp].motor_status}: ${stand[gesp].motor_grund})`);
    ok(gesendet.length === 1 && gesendet[0].postfach === "js@fiaon.com" && gesendet[0].vonName === "Justin Schwarzott" && !("abmelden" in gesendet[0]), `Gesendet aus js@ als „Justin Schwarzott“ ohne Zusatz und ohne List-Unsubscribe (${gesendet[0]?.vonName})`);
    ok(gesendet.length === 1 && gesendet[0].html.startsWith('<div dir="ltr">') && gesendet[0].html.includes('class="gmail_signature"') && gesendet[0].html.includes(">Impressum<") && !/Kein Thema für Sie|DOCTYPE/.test(gesendet[0].html)
      && sh8.RADAR_SCHLUSSSAETZE.some((x) => gesendet[0].text.includes(x)) && /\n-- \n/.test(gesendet[0].text), "Die gesendete Mail: Gmail-Aufbau, Unterschrift, Schlusssatz, Impressum — kein Abmeldesatz, kein eigenes Dokument");
    const post1 = (await sqlPool`SELECT p.art, p.adress_weg, f.strom, f.motor_status, f.status, f.versand_lauf FROM fiaon_radar_post p JOIN fiaon_radar_firmen f ON f.id = p.firma_id`) as any[];
    ok(post1.length === 1 && post1[0].art === "erstmail" && post1[0].motor_status === "gesendet" && post1[0].status === "versendet" && post1[0].versand_lauf === null && post1[0].adress_weg === "website", "Nach dem Senden: Faden-Eintrag „erstmail“ mit Herkunft der Adresse, Motor „gesendet“, Radar „versendet“, Anspruch gelöst");
    ok(gesendet.every((g) => !/utm_/.test(String(g.text).split("\n-- \n")[0])), "Kein utm_… im sichtbaren Text der Mail (kurzer, persönlicher Link)");
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
    ok(!!partnerMail && !/suchen Sie sich hier direkt eine Zeit aus|#gespraech|\/g\/r/.test(partnerMail.html), "Partner-Mail ohne Terminlink");
    // 4. Zwei Instanzen gleichzeitig: Die Sperre lässt nur so viele hinaus, wie dran sind (zwei Postfächer, zwei Ströme).
    process.env.RADAR_POSTFAECHER = "js@fiaon.com,pruef@fiaon.com";
    lib.radarAbsenderErsatzSetzen(async (p) => ({ postfach: p, name: p.startsWith("pruef") ? "Anna Beispiel" : "Justin Schwarzott", signaturHtml: '<div>Unterschrift<br><img src="https://bilder.example/u.png"></div>', signaturText: "Unterschrift", quelle: "gmail" as const }));
    mo.postfachBereitschaftVergessen();
    const lagenNeu = await mo.postfachLagen(new Date());
    ok(lagenNeu.find((l) => l.adresse === "pruef@fiaon.com")?.grenze === 20, "Ein neues Postfach ohne Geschichte startet mit 20 am Tag (Hochfahren)");
    await anlegen(6); await anlegen(7, { strom: "partner", mail: mailPartner }); await anlegen(8); await anlegen(9, { strom: "partner", mail: mailPartner });
    await zuruecklegen(30);
    const vorher = gesendet.length;
    const [ra, rb] = await Promise.all([mo.radarMotorSenden({ sender }), mo.radarMotorSenden({ sender })]);
    const neuGesendet = gesendet.length - vorher;
    ok(neuGesendet >= 1 && neuGesendet <= 2 && ra.gesendet + rb.gesendet === neuGesendet, `Zwei Instanzen gleichzeitig: ${neuGesendet} Mails (höchstens eine je Strom), keine doppelt`);
    const doppelt = (await sqlPool`SELECT firma_id, COUNT(*)::int AS n FROM fiaon_radar_post WHERE art = 'erstmail' GROUP BY firma_id HAVING COUNT(*) > 1`) as any[];
    ok(!doppelt.length, "Keine Firma bekam zwei erste Mails");
    const genutzt = new Set(gesendet.slice(vorher).map((x) => x.postfach));
    ok(neuGesendet < 2 || genutzt.size === 2, `Rundlauf: zwei Mails im selben Takt gehen aus zwei Postfächern (${Array.from(genutzt).join(", ")})`);
    lib.radarAbsenderErsatzSetzen(null);
    mo.postfachBereitschaftVergessen();
    delete process.env.RADAR_POSTFAECHER;

    // 4b. E-458 (Befund Takt): Jedes Postfach verteilt seinen Tagesrest über das restliche Fenster — kein leeres Postfach um 10 Uhr.
    const lageTakt = { adresse: "js@fiaon.com", grenze: 60, heute: 0, reserve: 0, letzteAm: new Date(Date.now() - 5 * 60_000), bereit: true };
    ok(sh8.radarPostfachTaktSek(lageTakt, 12 * 3600) === 720 && sh8.radarPostfachTaktSek({ ...lageTakt, grenze: 30 }, 12 * 3600) === 1440 && sh8.radarPostfachTaktSek(lageTakt, null) < 240,
      "Takt je Postfach: 60 am Tag über 12 Stunden → alle 12 Minuten; Bremse (Grenze 30) → alle 24 Minuten; ohne Fenster nur der Mindestabstand");
    ok(sh8.radarPostfachWaehlen([lageTakt], new Date(), 12 * 3600) === null && sh8.radarPostfachWaehlen([lageTakt], new Date(), 40 * 60)?.adresse === "js@fiaon.com", "Postfach erst frei, wenn sein Takt abgelaufen ist");

    // 5. Vorbereiten mit Attrappen: Österreich nie, stärkstes Signal zuerst, KI-Pause gibt die Firma zurück.
    await leeren();
    const k1 = await anlegen(11, { motor: null, signal: 3 }), k2 = await anlegen(12, { motor: null, signal: 5 }), kAt = await anlegen(13, { motor: null, signal: 5, land: "AT" });
    const k4 = await anlegen(14, { motor: null, signal: 4, passung: 50 }), kp = await anlegen(15, { motor: null, signal: 4, strom: "partner", mail: mailPartner });
    await sqlPool`UPDATE fiaon_radar_firmen SET scan = ${sqlPool.json({ profil: {}, aufhaenger: [{ text: "x", beleg: "y" }] })} WHERE id = ANY(${[k1, k2, kAt, k4, kp]})`;
    const reihenfolge: number[] = [];
    const attrappe = {
      scannen: async () => null, entscheider: async () => null,
      fertig: async (id: number) => { reihenfolge.push(id); return id === k1 ? { ok: false, grund: "Prüf-KI: klingt nach KI" } : { ok: true, grund: null }; },
      pruefen: async () => ({ ok: true, grund: null }),
    };
    // Eine Firma je Lauf: welche zuerst drankommt, ist eindeutig (drei gleichzeitig wären eine Frage der Laufzeit).
    await mo.radarMotorVorbereiten({ schritte: attrappe, max: 1 });
    ok(reihenfolge.length === 1 && reihenfolge[0] === k2, `Vorbereiten: stärkstes Signal zuerst (${reihenfolge.join(",")})`);
    const v1 = await mo.radarMotorVorbereiten({ schritte: attrappe, max: 6 });
    const z5 = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(z5[kAt].motor_status === null && !reihenfolge.includes(kAt), "Vorbereiten: Österreich wird nie genommen");
    ok(z5[k4].motor_status === null, "Vorbereiten: unter der Passungsschwelle (70) nicht");
    ok(z5[k2].motor_status === "bereit" && z5[kp].motor_status === "bereit" && z5[k1].motor_status === "verworfen" && /klingt nach KI/.test(String(z5[k1].motor_grund)), `Vorbereiten: freigegeben → bereit, durchgefallen → verworfen mit Grund (${v1.bereit} bereit, ${v1.verworfen} verworfen)`);
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = NULL, motor_grund = NULL WHERE id = ${k1}`;
    const pause = { ...attrappe, fertig: async () => { throw new lib.RadarFehler("KI pausiert", 503); } };
    const v2 = await mo.radarMotorVorbereiten({ schritte: pause, max: 6 });
    const k1Stand = ((await sqlPool`SELECT motor_status, motor_grund FROM fiaon_radar_firmen WHERE id = ${k1}`) as any[])[0];
    ok(k1Stand.motor_status === null && /KI pausiert/.test(String(v2.grund)), "KI-Pause beim Vorbereiten: Lauf endet, die Firma geht zurück in den Vorrat — nichts als bestanden gebucht");
    // 5b. E-458 (Befund): Eine von Hand geänderte Mail wird nie überschrieben — die Prüf-KI liest sie nur.
    const hand = await anlegen(16, { motor: null, signal: 5 });
    await sqlPool`UPDATE fiaon_radar_firmen SET mail = jsonb_set(mail, '{geaendert}', 'true'::jsonb) WHERE id = ${hand}`;
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'gesendet' WHERE id <> ${hand} AND motor_status IS NULL`;
    const gesehen = { fertig: 0, pruefen: 0 };
    await mo.radarMotorVorbereiten({ schritte: { ...attrappe, fertig: async () => { gesehen.fertig++; return { ok: true, grund: null }; }, pruefen: async () => { gesehen.pruefen++; return { ok: true, grund: null }; } }, max: 1 });
    ok(gesehen.pruefen === 1 && gesehen.fertig === 0 && (await zeile(hand)).motor_status === "bereit", "Von Hand geänderte Mail: nur geprüft, nie neu geschrieben — dann bereit");
    // 6. Aufräumen: veraltete „bereit“ → zurück in den Vorrat (neu vorbereiten); hängende „sendet“ ohne Gmail-Aufruf → bereit;
    //    nach Sendefehlern verworfen → nach einem Tag einmal zurück auf bereit.
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_am = NOW() - INTERVAL '8 days' WHERE id = ${k2}`;
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'sendet', motor_am = NOW() - INTERVAL '20 minutes' WHERE id = ${kp}`;
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'verworfen', motor_grund = 'Senden fehlgeschlagen: HTTP 400', motor_am = NOW() - INTERVAL '2 days', motor_versuche = 0 WHERE id = ${k4}`;
    await mo.warteschlangeAufraeumen(sh8.radarMotorLesen({}));
    const z6 = Object.fromEntries(((await sqlPool`SELECT id, motor_status, motor_grund FROM fiaon_radar_firmen`) as any[]).map((x) => [Number(x.id), x]));
    ok(z6[k2].motor_status === null && /neu vorbereitet/.test(String(z6[k2].motor_grund)) && z6[kp].motor_status === "bereit" && z6[k4].motor_status === "bereit",
      "Aufräumen: nach 7 Tagen zurück in den Vorrat (neu vorbereiten, keine Sackgasse); hängendes Senden ohne Gmail-Aufruf zurück auf bereit; nach Sendefehlern verworfen → nach einem Tag wieder bereit");
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = 'abgelaufen' WHERE id = ${k2}`;
    await mo.radarZurueckInVorrat(k2);
    ok((await zeile(k2)).motor_status === null, "„Zurück in den Vorrat“ (Akte) holt eine abgelaufene Firma zurück");

    // 7. Partner mit Interesse → Partner-CRM (eine Transaktion), beim zweiten Mal nur Verlauf und Aufgabe.
    const fd = await import("../server/lib/fiaon-radar-faden");
    const pcrm = await import("../server/lib/fiaon-partner-crm");
    await pcrm.ensurePartnerTabellen();
    await sqlPool`DELETE FROM fiaon_partner_aufgaben WHERE erstellt_von = 'Mara (Firmen-Radar)'`.catch(() => {});
    const pId = await anlegen(21, { strom: "partner", mail: mailPartner, motor: "gesendet", status: "versendet" });
    const pFirma = await zeile(pId);
    const akteId = await fd.partnerInsCrm(pFirma, { text: "Das klingt gut, schicken Sie mir die Konditionen.", zusammenfassung: "Interesse an der Zusammenarbeit", datum: new Date() });
    const akte = akteId ? await pcrm.partnerAkte(akteId) : null;
    ok(!!akte && akte.firma.art === "kanzlei" && akte.kontakte.some((k: any) => k.name === "Max Beispiel" && k.haupt) && akte.verlauf.length >= 1 && akte.aufgaben.some((a: any) => /ohne Provision/.test(a.titel)), "Ende zu Ende: Steuerkanzlei mit Interesse → Partner-Akte „kanzlei“, Hauptkontakt, Verlauf, Aufgabe „ohne Provision“");
    const pFirma2 = await zeile(pId);
    const akteId2 = await fd.partnerInsCrm(pFirma2, { text: "Noch eine Frage zur Abwicklung.", zusammenfassung: "Sachfrage", datum: new Date() });
    const akte2 = akteId2 ? await pcrm.partnerAkte(akteId2) : null;
    const anzahlFirmen = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_partner_firmen WHERE name = ${"Beispiel 21 GmbH"}`) as any[])[0].n);
    ok(akteId2 === akteId && anzahlFirmen === 1 && (akte2?.verlauf.length ?? 0) >= 2, "Zweite Antwort: dieselbe Akte, nur Verlauf und Aufgabe dazu (keine Dublette)");
    // 7b. E-458 (Befund): Wer schon unter Geschäftspartner steht, bekommt keine Kaltmail — auch wenn er schon im Vorrat lag.
    const pa = await import("../server/lib/fiaon-radar-partner");
    pa.schonPartnerVergessen();
    await leeren();
    const schon = await anlegen(21, { motor: null });
    let schonWarf: any = null;
    try { await lib.radarMailAusgeben(schon, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { schonWarf = e; }
    ok(schonWarf?.status === 409 && /Geschäftspartner/.test(String(schonWarf?.message)) && !gesendet.some((g) => g.an.endsWith("@firma21.example")), `Schon Partner (CRM): keine Kaltmail beim Senden (${schonWarf?.message})`);
    await crmLeeren();

    // 8. E-458 (Befund Sendefehler): Gmail-Störungen verbrennen keine geprüften Top-Firmen mehr.
    await leeren();
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('radar_postfach_stoerung', 'radar_motor_bremse', 'radar_postfach_pause')`;
    const s1 = await anlegen(31, { signal: 5 });
    r = await mo.radarMotorSenden({ sender: async () => { throw new Error("Gmail js@fiaon.com /messages/send: HTTP 400 Invalid To header"); } });
    let zs = await zeile(s1);
    ok(zs.motor_status === "bereit" && zs.motor_sendefehler === 1 && new Date(zs.motor_am).getTime() > Date.now() && !zs.versand_lauf, `Gmail lehnt genau diese Mail ab: zurück auf bereit mit Wartezeit, nicht verworfen (${zs.motor_status}, Fehler ${zs.motor_sendefehler})`);
    r = await mo.radarMotorSenden({ sender });
    ok(r.gesendet === 0, "In der Wartezeit wird dieselbe Mail nicht sofort wieder versucht (kein Verbrennen im Minutentakt)");
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_am = NOW() - INTERVAL '1 hour', motor_sendefehler = 0 WHERE id = ${s1}`;
    r = await mo.radarMotorSenden({ sender: async () => { throw new Error("Token für js@fiaon.com: HTTP 500 {}"); } });
    zs = await zeile(s1);
    const stoer = await mo.postfachStoerungen();
    const lagenStoer = await mo.postfachLagen(new Date());
    ok(zs.motor_status === "bereit" && zs.motor_sendefehler === 0 && !!stoer["js@fiaon.com"] && lagenStoer.find((l) => l.adresse === "js@fiaon.com")?.pause === true,
      "Postfach gestört (Token): die Mail zurück ohne Strafe, das POSTFACH ruht kurz");
    r = await mo.radarMotorSenden({ sender });
    ok(r.gesendet === 0 && !gesendet.some((g) => g.an.endsWith("@firma31.example")), "Während der Störungspause geht aus diesem Postfach nichts hinaus");
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_postfach_stoerung'`;
    // 9. E-458 (Befund Doppelversand): Gmail nimmt an, die Antwort geht verloren → „sendet“ bleibt, der Gesendet-Ordner entscheidet.
    const halb: any[] = [];
    r = await mo.radarMotorSenden({ sender: async (postfach: string, inhalt: any) => { halb.push({ postfach, ...inhalt }); throw new Error("fetch failed"); } });
    zs = await zeile(s1);
    ok(zs.motor_status === "sendet" && !!zs.versand_lauf?.am && !zs.versendet_am && halb.length === 1, "Antwort verloren: die Mail bleibt „sendet“ mit Anspruch — kein Zurück auf bereit, kein zweiter Versuch");
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_postfach_stoerung'`;
    await zuruecklegen(11);
    lib.radarGesendetSucherSetzen(async (_postfach, an) => (halb.some((h) => h.an === an) ? { id: "gefunden-1", threadId: "faden-gefunden-1" } : null));
    await mo.warteschlangeAufraeumen(sh8.radarMotorLesen({}));
    zs = await zeile(s1);
    const postS1 = (await sqlPool`SELECT gmail_id FROM fiaon_radar_post WHERE firma_id = ${s1} AND art = 'erstmail'`) as any[];
    ok(zs.motor_status === "gesendet" && zs.status === "versendet" && !!zs.versendet_am && !zs.versand_lauf && postS1.length === 1 && postS1[0].gmail_id === "gefunden-1",
      "Nach 10 Minuten: im Gesendet-Ordner gefunden → nachgebucht, genau EINE Mail");
    let doppel: any = null;
    try { await lib.radarMailAusgeben(s1, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { doppel = e; }
    ok(!!doppel && halb.length === 1 && !gesendet.some((g) => g.an.endsWith("@firma31.example")), "Ein zweiter Versand derselben Firma wird abgewiesen");
    // … und wenn die Mail NICHT im Gesendet-Ordner steht: frei für einen neuen Versuch.
    const s2 = await anlegen(32);
    await zuruecklegen(10);
    r = await mo.radarMotorSenden({ sender: async () => { throw new Error("fetch failed"); } });
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_postfach_stoerung'`;
    await zuruecklegen(11);
    lib.radarGesendetSucherSetzen(async () => null);
    await mo.warteschlangeAufraeumen(sh8.radarMotorLesen({}));
    zs = await zeile(s2);
    ok(zs.motor_status === "bereit" && !zs.versand_lauf && !zs.versendet_am, "Nicht im Gesendet-Ordner → zurück auf bereit, Anspruch gelöst");
    lib.radarGesendetSucherSetzen(null);
    // 10. Stapel und Akte gleichzeitig an dieselbe Firma: der Anspruch (versand_lauf) lässt genau EINEN Versand zu.
    const s3 = await anlegen(33, { motor: null });
    let parallel = 0;
    const langsam = async () => { parallel++; await new Promise((ja) => setTimeout(ja, 300)); return { id: `parallel-${parallel}`, threadId: `faden-p-${parallel}` }; };
    const beide = await Promise.allSettled([
      lib.radarMailAusgeben(s3, { art: "senden", postfach: "js@fiaon.com", sender: langsam, grenzeGeprueft: true }),
      lib.radarMailAusgeben(s3, { art: "senden", postfach: "js@fiaon.com", sender: langsam, grenzeGeprueft: true }),
    ]);
    ok(parallel === 1 && beide.filter((x) => x.status === "fulfilled").length === 1 && beide.some((x) => x.status === "rejected" && (x as any).reason?.status === 409), `Zwei Wege gleichzeitig: genau ein Gmail-Aufruf (${parallel}), der andere 409`);

    // 11. E-458 (Befund): ausgeschaltete Partner-Gruppe, abgeschaltete Ableitung, Österreich nach Domäne/Telefon.
    await leeren();
    await setzen({ radar_partner_gruppen: "finanzierer" });
    const g1 = await anlegen(34, { strom: "partner", mail: mailPartner });
    r = await mo.radarMotorSenden({ sender });
    const g2 = await anlegen(35, { strom: "partner", mail: mailPartner, motor: null });
    ok((await zeile(g1)).motor_status === "bereit" && r.gesendet === 0 && (await mo.kandidatNehmen("partner", 0, ["finanzierer"])) === null && g2 > 0,
      "Gruppe „Steuerberater“ aus: weder gesendet noch vorbereitet");
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_partner_gruppen'`;
    await leeren();
    await setzen({ radar_ableitung: "aus" });
    const ab1 = await anlegen(36, { weg: "abgeleitet" });
    r = await mo.radarMotorSenden({ sender });
    ok((await zeile(ab1)).motor_status === "bereit" && r.gesendet === 0, "Ableitung aus: eine schon vorbereitete Mail an eine abgeleitete Adresse geht nicht hinaus");
    // (Anteil 100 %: sonst darf die erste Mail einer Stunde nie an eine abgeleitete Adresse gehen — höchstens 50 % je Stunde.)
    await setzen({ radar_ableitung: "an", radar_ableitung_anteil: "100" });
    r = await mo.radarMotorSenden({ sender });
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_ableitung_anteil'`;
    const ab1Post = (await sqlPool`SELECT adress_weg FROM fiaon_radar_post WHERE firma_id = ${ab1}`) as any[];
    ok(r.gesendet === 1 && ab1Post[0]?.adress_weg === "abgeleitet", "Ableitung wieder an: sie geht hinaus — und der Eintrag trägt „abgeleitet“");
    const fAb = { email: "a.beispiel@firma.example", domain: "firma.example", name: "Beispiel GmbH", entscheider: { name: "Anna Beispiel", email: "a.beispiel@firma.example", weg: "abgeleitet" }, impressum: { vertreter: [{ name: "Anna Beispiel" }] } };
    ok(mo.persoenlicheAdresse(fAb, { ableitung: true }) && !mo.persoenlicheAdresse(fAb, { ableitung: false }), "Vorbereiten: bei abgeschalteter Ableitung zählt die abgeleitete Adresse nicht");
    await leeren();
    const atDom = await anlegen(37, { motor: null, domain: "firma37-beispiel.at" });
    const atTel = await anlegen(38, { motor: null, impressum: { telefon: "+43 1 234 56 78" } });
    const atUid = await anlegen(39, { motor: null, impressum: { ustId: "ATU12345678" } });
    ok((await mo.kandidatNehmen("firma", 0, [])) === null, "Österreich gewinnt (Datenbank): Spalte „DE“, aber .at-Domäne, Telefon +43 oder UID ATU → nie in die Warteschlange");
    let atWarf: any = null;
    try { await lib.radarMailAusgeben(atDom, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { atWarf = e; }
    ok(/Österreich/.test(String(atWarf?.message)) && atTel > 0 && atUid > 0, "… und radarMailAusgeben weist sie ab (Akte, Stapel)");

    // 12. E-458 (Befund Anrede): Anrede und Empfänger müssen zusammenpassen.
    await leeren();
    const zwei = await anlegen(40, { motor: null });
    await sqlPool`UPDATE fiaon_radar_firmen SET email = 'max.mueller@firma40.example', entscheider = NULL,
                    impressum = ${sqlPool.json({ name: "Beispiel 40 GmbH", land: "DE", vertreter: [{ name: "Anna Beispiel", funktion: "Geschäftsführerin" }, { name: "Max Müller", funktion: "Geschäftsführer" }] })} WHERE id = ${zwei}`;
    let anredeWarf: any = null;
    try { await lib.radarMailAusgeben(zwei, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { anredeWarf = e; }
    ok(/Die Anrede nennt „Beispiel“/.test(String(anredeWarf?.message)) && !gesendet.some((g) => g.an === "max.mueller@firma40.example"), `„Hallo Frau Beispiel“ an max.mueller@ wird abgewiesen (${anredeWarf?.message})`);

    // 13. E-458 (Befund): Die Tagesgrenze je Postfach gilt auch für Akte und Stapel.
    await leeren();
    const voll = await anlegen(41, { motor: null });
    for (let i = 0; i < 20; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum) VALUES (0, 'js@fiaon.com', ${`voll-${i}`}, 'aus', 'nachfass1', NOW())`;
    let vollWarf: any = null;
    try { await lib.radarMailAusgeben(voll, { art: "senden", postfach: "js@fiaon.com", sender }); } catch (e) { vollWarf = e; }
    ok(vollWarf?.status === 429 && /für heute voll/.test(String(vollWarf?.message)), `Akte/Stapel: Postfach voll → 429 (${vollWarf?.message})`);

    // 14. E-458 (Befund Rückläufer): Eine widerlegte Ableitung geht in den Brief, nicht noch einmal in die bezahlte Suche.
    await leeren();
    const rueck = await anlegen(42, { motor: null, status: "unzustellbar", weg: "abgeleitet", impressum: { strasse: "Musterweg 1", plz: "10115", ort: "Berlin" } });
    await sqlPool`UPDATE fiaon_radar_firmen SET versendet_am = NOW() - INTERVAL '2 days', email = 'anna.b@firma42.example', email_ungueltig = 'anna.beispiel@firma42.example',
                    entscheider = jsonb_set(entscheider, '{muster_widerlegt}', 'true'::jsonb) WHERE id = ${rueck}`;
    const rueckF = await zeile(rueck);
    ok((await mo.kandidatNehmen("firma", 0, [])) === null && sh8.radarBriefPruefen(rueckF).ok, "Rückläufer einer abgeleiteten Adresse (echter Stand: unzustellbar, versendet_am gesetzt): kein neuer Motor-Versuch — der Brief geht");

    // 15. E-458 (Befund Bereitschaft): Ein kurzer Gmail-Aussetzer legt das Postfach nicht stundenlang lahm.
    mo.postfachBereitschaftVergessen();
    mo.postfachProbeSetzen(async () => ({ ok: true }));
    const b1 = await mo.postfachBereitschaft("js@fiaon.com", true);
    mo.postfachProbeSetzen(async () => ({ ok: false, fehler: "Gmail js@fiaon.com /labels: HTTP 503 backendError" }));
    const b2 = await mo.postfachBereitschaft("js@fiaon.com", true);
    mo.postfachProbeSetzen(async () => ({ ok: false, fehler: "Token für js@fiaon.com: HTTP 401 {\"error\":\"unauthorized_client\"}" }));
    const b3 = await mo.postfachBereitschaft("js@fiaon.com", true);
    mo.postfachProbeSetzen(null); mo.postfachBereitschaftVergessen();
    ok(b1.bereit && b2.bereit && !!b2.stoerung?.length && !b3.bereit, "Probe wirft einmal (503): bereit bleibt (letzter guter Stand, mit Hinweis); Zugang wirklich weg (401): nicht bereit");

    // 16. Zustellung: 100 Sendungen aus js@, 4 Rückläufer → 4 % → Bremse 0,5 — Tempo UND Tagesgrenze; mit einem Postfach kein Vollstopp.
    await leeren();
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('radar_motor_bremse', 'radar_postfach_pause')`;
    for (let i = 0; i < 100; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum) VALUES (0, 'js@fiaon.com', ${`z-aus-${i}`}, 'aus', ${i % 3 ? "erstmail" : "nachfass1"}, NOW() - INTERVAL '2 days')`;
    for (let i = 0; i < 4; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum) VALUES (0, 'js@fiaon.com', ${`z-rueck-${i}`}, 'ein', 'unzustellbar', NOW() - INTERVAL '1 day')`;
    const zw = await mo.radarZustellWache();
    const br = await mo.bremseLesen();
    ok(zw.bremse === 0.5 && br?.faktor === 0.5 && /Rückläufer 4 %/.test(String(br?.grund)) && (await mo.bremseFaktor()) === 0.5, `Ende zu Ende: 4 % Rückläufer → Bremse 0,5 gespeichert (${br?.grund})`);
    ok(!zw.pausiert.length && !(await mo.postfachPausen())["js@fiaon.com"], "Nur ein Postfach: keine 48-h-Pause (das wäre Vollstopp) — es bremst allein der Faktor");
    const lageB = (await mo.postfachLagen(new Date())).find((l) => l.adresse === "js@fiaon.com");
    const grenzeOhne = sh8.radarPostfachGrenze({ ersterVersand: new Date(Date.now() - 2 * 86_400_000), jetzt: new Date(), jeTag: 60, rampe: [20, 40] });
    ok(lageB?.grenze === Math.floor(grenzeOhne * 0.5), `Die Bremse halbiert die Tagesgrenze des Postfachs (${lageB?.grenze} statt ${grenzeOhne}) — und damit den Takt`);
    process.env.RADAR_POSTFAECHER = "js@fiaon.com,zweit@fiaon.com";
    for (let i = 0; i < 60; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum) VALUES (0, 'zweit@fiaon.com', ${`z2-aus-${i}`}, 'aus', 'erstmail', NOW() - INTERVAL '2 days')`;
    const zw2 = await mo.radarZustellWache();
    ok(zw2.pausiert.includes("js@fiaon.com") && !!(await mo.postfachPausen())["js@fiaon.com"] && !zw2.pausiert.includes("zweit@fiaon.com"), "Zwei Postfächer, eines sauber: nur das schlechte ruht 48 Stunden, das andere sendet weiter");
    const zw3 = await mo.radarZustellWache();
    ok(zw3.bremse <= 0.5 && !zw3.pausiert.length, "Dritter Lauf: Bremse bleibt, keine doppelte Pause");
    delete process.env.RADAR_POSTFAECHER;
    // Die Bremse ab einem Zeitpunkt: davor zählt das volle Ziel (kein Stillstand für den Rest des Tages).
    const mm = sh8.radarMotorLesen({ radar_motor_tage: "1,2,3,4,5,6,7" });
    const nachmittag = new Date("2026-10-29T15:00:00+01:00");
    const sollAb = sh8.radarMotorSoll({ jetzt: nachmittag, m: mm, jeStunde: 10, gesendetHeute: 75, letzteAm: new Date("2026-10-29T14:40:00+01:00"), bremse: 0.5, bremseSeit: new Date("2026-10-29T14:30:00+01:00") });
    const sollGanz = sh8.radarMotorSoll({ jetzt: nachmittag, m: mm, jeStunde: 10, gesendetHeute: 75, letzteAm: new Date("2026-10-29T14:40:00+01:00"), bremse: 0.5 });
    ok(sollAb.faellig && Math.round(sollAb.soll * 10) / 10 === 77.5 && !sollGanz.faellig, `Bremse ab 14:30: bis dahin volles Ziel, danach halbes (Soll ${sollAb.soll}) — ohne Zeitpunkt stünde der Motor bis abends still`);
    await mo.radarBremseLoesen();
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('radar_motor_bremse', 'radar_postfach_pause')`;
    ok((await mo.bremseFaktor()) === 1, "„Bremse lösen“: wieder volle Fahrt");
    // 17. E-458 (Befund): Die Ableitungs-Wache zählt nach der Herkunft am Eintrag (adress_weg), nicht nach dem Entscheider.
    await leeren();
    for (let i = 0; i < 30; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum, adress_weg) VALUES (0, 'js@fiaon.com', ${`a-aus-${i}`}, 'aus', 'erstmail', NOW() - INTERVAL '1 day', 'abgeleitet')`;
    for (let i = 0; i < 3; i++) await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum, adress_weg) VALUES (0, 'js@fiaon.com', ${`a-rueck-${i}`}, 'ein', 'unzustellbar', NOW(), 'abgeleitet')`;
    const aw = await mo.radarAbleitungWache();
    ok(aw.abgeschaltet && aw.quote === 10 && !(await lib.radarMotorEinstellung()).ableitung, `Ableitungs-Wache nach adress_weg: 3 von 30 zurück (10 %) → Ableitung aus (${aw.quote} %)`);
    await setzen({ radar_ableitung: "an" });

    const stand2 = await mo.radarMotorStand();
    ok(stand2.leistung && typeof stand2.leistung.satz === "string" && Array.isArray(stand2.postfaecher), `Stand fürs Chefbüro: ${stand2.leistung.satz}`);
    // Feineinstellungen genau so, wie das Chefbüro sie schickt (Text, Komma als Dezimalzeichen).
    const fein = await mo.radarMotorSetzen({ puffer: "1,5", haltbarTage: "5", link: "keiner", kiKlangMax: "2", aehnlichMax: "0,3", postfachRampe: "15,30",
      zustellRueckMax: "2,5", zustellBasis: "80", partnerProvisionText: "30 Prozent unseres Honorars, zwei Jahre lang" });
    ok(fein.puffer === 1.5 && fein.haltbarTage === 5 && fein.link === "keiner" && fein.kiKlangMax === 2 && fein.aehnlichMax === 0.3 && fein.postfachRampe.join(",") === "15,30"
      && fein.zustellRueckMax === 2.5 && fein.zustellBasis === 80 && /zwei Jahre/.test(fein.partnerProvisionText), "Feineinstellungen: Werte mit Komma werden gespeichert und richtig gelesen");
    // E-458 (Befund): Der Provisions-Satz wirkt überall — Prüf-KI, Partner-Angebot, CRM.
    const pk = await import("../server/lib/fiaon-radar-pruef");
    ok(pk.radarPruefAnweisung({ strom: "partner", provision: true, provisionText: fein.partnerProvisionText }).includes("zwei Jahre lang")
      && sh8.radarPartnerCrmEingabe({ firma: { name: "X", bereich: "finanzierer" }, antwort: { text: "Gern.", datum: new Date() }, heute: "2026-10-30", provisionText: fein.partnerProvisionText }).firma.konditionen[0].value.includes("zwei Jahre lang"),
      "Provisions-Satz aus dem Chefbüro in Prüf-KI und CRM");
    let abgelehnt = "";
    try { await mo.radarMotorSetzen({ haltbarTage: "9", aehnlichMax: "7" }); } catch (e: any) { abgelehnt = String(e?.message ?? e); }
    ok(/Ähnlichkeit/.test(abgelehnt) && (await lib.radarMotorEinstellung()).haltbarTage === 5, `Falsche Eingabe: klare Meldung („${abgelehnt}“), auch der gültige Teil bleibt ungespeichert`);
    let abgelehnt2 = "";
    try { await mo.radarMotorSetzen({ partnerProvisionText: "Tippgeld nach Absprache" }); } catch (e: any) { abgelehnt2 = String(e?.message ?? e); }
    ok(/Prozent/.test(abgelehnt2) && /zwei Jahre/.test((await lib.radarMotorEinstellung()).partnerProvisionText), "Provisions-Satz ohne „Prozent“ wird abgelehnt");
    // 18. E-458 (Befund Go-live): Vor der Freigabe weder Vorbereitung von selbst noch Versand — „3 Mails vorbereiten“ geht.
    await leeren();
    // Die Feineinstellungen aus Schritt 17 zurück auf die Vorgaben (Hochfahren 20/40 usw.).
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('radar_postfach_rampe', 'radar_motor_puffer', 'radar_motor_haltbar_tage', 'radar_motor_link', 'radar_pruef_ki_klang_max',
                    'radar_motor_aehnlich_max', 'radar_zustell_rueck_max', 'radar_zustell_basis', 'radar_partner_provision_text')`;
    const freiVorher = (await lib.radarMotorEinstellung()).freigabeAm;
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_motor_freigabe'`;
    await anlegen(90);
    r = await mo.radarMotorSenden({ sender });
    const vorFreigabe = gesendet.length;
    const zaehler = { entscheider: 0, fertig: 0, scannen: 0 };
    const zaehlend = {
      scannen: async () => { zaehler.scannen++; return null; }, entscheider: async () => { zaehler.entscheider++; return null; },
      fertig: async () => { zaehler.fertig++; return { ok: true, grund: null }; }, pruefen: async () => ({ ok: true, grund: null }),
    };
    const vg1 = await mo.radarMotorVorbereiten({ schritte: zaehlend, max: 1 });
    ok(r.gesendet === 0 && r.grund === "wartet auf Justins Freigabe" && vg1.aus === true && vg1.grund === "wartet auf Justins Freigabe" && gesendet.length === vorFreigabe,
      `Vor der Freigabe: kein Versand, keine Vorbereitung von selbst (${r.grund} · ${vg1.grund})`);
    await anlegen(91, { motor: null, signal: 4 });
    await sqlPool`UPDATE fiaon_radar_firmen SET scan = ${sqlPool.json({ profil: {}, aufhaenger: [{ text: "x", beleg: "y" }] })} WHERE domain = 'firma91.example'`;
    const vg2 = await mo.radarMotorVorbereiten({ schritte: zaehlend, max: 1, ohneHauptschalter: true });
    ok(vg2.bereit === 1 && zaehler.fertig === 1, "„3 Mails vorbereiten“ (ohneHauptschalter) geht auch vor der Freigabe — Justin liest echte Mails, bevor etwas hinausgeht");
    const am1 = await mo.radarMotorFreigeben(new Date("2026-10-30T06:00:00Z"));
    const am2 = await mo.radarMotorFreigeben(new Date("2026-11-05T06:00:00Z"));
    ok(am1 === "2026-10-30T06:00:00.000Z" && am2 === am1 && (await lib.radarMotorEinstellung()).freigabeAm === "2026-10-30T06:00:00.000Z", "Freigabe gesetzt — ein zweiter Klick überschreibt sie nicht");
    // 19. Hochfahren ab der Freigabe: js@ mit Radar-Geschichte seit 40 Tagen startet in Woche 1 (20), nicht mit 60.
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('radar_motor_bremse', 'radar_postfach_pause', 'radar_postfach_stoerung')`;
    await sqlPool`INSERT INTO fiaon_radar_post (firma_id, postfach, gmail_id, richtung, art, datum) VALUES (0, 'js@fiaon.com', 'alt-40', 'aus', 'erstmail', NOW() - INTERVAL '40 days')`;
    await setzen({ radar_motor_freigabe: new Date(Date.now() - 86_400_000).toISOString() });
    const grenzeW1 = (await mo.postfachLagen(new Date())).find((l) => l.adresse === "js@fiaon.com")?.grenze;
    await setzen({ radar_motor_freigabe: new Date(Date.now() - 15 * 86_400_000).toISOString() });
    const grenzeW3 = (await mo.postfachLagen(new Date())).find((l) => l.adresse === "js@fiaon.com")?.grenze;
    ok(grenzeW1 === 20 && grenzeW3 === 60, `js@ (Radar seit 40 Tagen): einen Tag nach der Freigabe ${grenzeW1} am Tag, zwei Wochen danach ${grenzeW3}`);
    // 20. Derselbe Mensch: dieselbe Adresse über eine andere Firma, derselbe Name im selben Ort → keine zweite Kaltmail.
    await leeren();
    const schonA = await anlegen(92, { motor: "gesendet", status: "versendet" });
    await sqlPool`UPDATE fiaon_radar_firmen SET versendet_am = NOW() - INTERVAL '30 days', ort = 'Ulm' WHERE id = ${schonA}`;
    const gleicheAdresse = await anlegen(93, { motor: null });
    await sqlPool`UPDATE fiaon_radar_firmen SET email = 'anna.beispiel@firma92.example' WHERE id = ${gleicheAdresse}`;
    ok((await mo.kandidatNehmen("firma", 0, [])) === null, "Vorbereiten: an diese Adresse ging schon eine erste Mail (andere Firma) → nicht genommen");
    let doppelWarf: any = null;
    try { await lib.radarMailAusgeben(gleicheAdresse, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true, an: "anna.beispiel@firma92.example" }); } catch (e) { doppelWarf = e; }
    ok(doppelWarf?.status === 409 && /Schon angeschrieben/.test(String(doppelWarf?.message)), `Senden: dieselbe Adresse über eine andere Firma → 409 (${doppelWarf?.message})`);
    const gleicherName = await anlegen(94, { motor: null });
    await sqlPool`UPDATE fiaon_radar_firmen SET ort = 'Ulm' WHERE id = ${gleicherName}`;
    let nameWarf: any = null;
    try { await lib.radarMailAusgeben(gleicherName, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { nameWarf = e; }
    ok(nameWarf?.status === 409 && /Anna Beispiel/.test(String(nameWarf?.message)), `Senden: derselbe Name im selben Ort (anderer Betrieb?) → 409 (${nameWarf?.message})`);
    const andererOrt = await anlegen(95, { motor: null });
    await sqlPool`UPDATE fiaon_radar_firmen SET ort = 'Köln' WHERE id = ${andererOrt}`;
    const vorAnders = gesendet.length;
    await lib.radarMailAusgeben(andererOrt, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true });
    ok(gesendet.length === vorAnders + 1, "Gleicher Name, anderer Ort und andere Domäne: geht hinaus (kein Fehlalarm)");
    // 21. Bekannte (hier: eine Anfrage mit Freemail-Adresse) bekommen keine Kaltmail — über den vollen Namen.
    const pa21 = await import("../server/lib/fiaon-radar-partner");
    const [anf] = (await sqlPool`INSERT INTO fiaon_anfragen (art, name, email) VALUES ('pruefstand', 'Erika Musterfrau', 'erika.musterfrau@gmx.de') RETURNING id`) as any[];
    pa21.schonPartnerVergessen();
    const bekannt = await anlegen(96, { motor: null });
    await sqlPool`UPDATE fiaon_radar_firmen SET email = 'erika.musterfrau@firma96.example', ansprechpartner = 'Erika Musterfrau',
                    entscheider = jsonb_set(jsonb_set(entscheider, '{name}', '"Erika Musterfrau"'), '{email}', '"erika.musterfrau@firma96.example"'),
                    impressum = jsonb_set(impressum, '{vertreter}', '[{"name": "Erika Musterfrau", "funktion": "Geschäftsführerin"}]'::jsonb),
                    mail = jsonb_set(mail, '{anrede}', '"Hallo Frau Musterfrau,"') WHERE id = ${bekannt}`;
    let bekanntWarf: any = null;
    try { await lib.radarMailAusgeben(bekannt, { art: "senden", postfach: "js@fiaon.com", sender, grenzeGeprueft: true }); } catch (e) { bekanntWarf = e; }
    await sqlPool`DELETE FROM fiaon_anfragen WHERE id = ${anf.id}`;
    pa21.schonPartnerVergessen();
    ok(bekanntWarf?.status === 409 && /Schon bekannt \(Anfrage\)/.test(String(bekanntWarf?.message)) && (await pa21.schonBekannt({ person: "Erika Musterfrau" })) === null,
      `Bekannt mit Freemail (Anfrage): über den vollen Namen erkannt → keine Kaltmail (${bekanntWarf?.message})`);
    // 22. Altlasten: frische Firmen zuerst; eine Altlast bekommt keine zweite bezahlte Websuche und keinen Scan ohne Adresse.
    await leeren();
    const alt = await anlegen(97, { motor: null, signal: 5, passung: 99 });
    await sqlPool`UPDATE fiaon_radar_firmen SET email = 'info@firma97.example', entscheider = NULL, entscheider_am = NOW() - INTERVAL '5 days', automatik_am = NOW() - INTERVAL '5 days', scan = NULL WHERE id = ${alt}`;
    const frisch = await anlegen(98, { motor: null, signal: 4, passung: 80 });
    const erste = await mo.kandidatNehmen("firma", 0, []);
    ok(erste === frisch, `Altlasten zuletzt: zuerst die frische Firma (${erste} statt ${alt})`);
    await sqlPool`UPDATE fiaon_radar_firmen SET motor_status = NULL WHERE id = ${frisch}`;
    zaehler.entscheider = 0; zaehler.scannen = 0;
    const altErg = await mo.vorbereitenEine(alt, "firma", { ...zaehlend, entscheider: async (_id: number, websuche: boolean) => { zaehler.entscheider += websuche ? 100 : 1; return null; } }, { ableitung: true });
    ok(altErg.ergebnis === "verworfen" && zaehler.entscheider === 1 && zaehler.scannen === 0 && /Websuche lief schon/.test(String(altErg.grund)),
      `Altlast: nur der kostenlose Website-Schritt, keine zweite Websuche, kein Scan ohne Adresse (${altErg.grund})`);
    // 23. KI-Geld: Hat die Vorbereitung ihren Teil des B2B-Topfs verbraucht, endet der Lauf vor der nächsten Firma.
    const ks = await import("../server/lib/fiaon-ki-kasse");
    await setzen({ ki_kasse_tag_usd: "10", radar_motor_ki_anteil: "50" });
    await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, kosten_cents, ok) VALUES ('radar', 'pruefstand', 0, 0, 400, TRUE)`;
    await ks.kasseFrisch();
    const geld = await lib.radarVorbereitungGeld(await lib.radarMotorEinstellung());
    const vgGeld = await mo.radarMotorVorbereiten({ max: 1 });
    await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell = 'pruefstand'`;
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('ki_kasse_tag_usd', 'radar_motor_ki_anteil')`;
    await ks.kasseFrisch();
    ok(!geld.frei && geld.grenze === 3.75 && /KI-Geld für die Vorbereitung heute verbraucht/.test(String(vgGeld.grund)) && vgGeld.bereit === 0,
      `KI-Geld der Vorbereitung: 4 $ von 3,75 $ (50 % von 7,50 $) verbraucht → Lauf endet (${vgGeld.grund})`);
    // 24. Nachfassen: eine gescheiterte Stufe kommt zurück (in einer Stunde), nur einmal.
    const nf = await anlegen(99, { motor: "gesendet", status: "versendet" });
    await sqlPool`UPDATE fiaon_radar_firmen SET nachfass_stufe = 1, nachfass_faellig = NULL WHERE id = ${nf}`;
    const z1 = await fd.nachfassStufeZurueck(nf, 1), z2 = await fd.nachfassStufeZurueck(nf, 1);
    const nfZ = await zeile(nf);
    ok(z1 && !z2 && nfZ.nachfass_stufe === 0 && new Date(nfZ.nachfass_faellig).getTime() > Date.now() + 50 * 60_000, "Nachfass-Stufe nach einem Sendefehler zurück (in einer Stunde erneut) — genau einmal");
    // 25. Postfach-Schalter: ruht es noch wegen einer Störung, sagt die Meldung das ehrlich.
    await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('radar_postfach_stoerung', ${JSON.stringify({ "js@fiaon.com": { bis: new Date(Date.now() + 30 * 60_000).toISOString(), grund: "Gmail bremst kurz (zu viele Mails in kurzer Zeit)", n: 1 } })})
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    const sch = await mo.radarPostfachSchalten("js@fiaon.com", false);
    const lageS = (await mo.postfachLagen(new Date())).find((l) => l.adresse === "js@fiaon.com");
    ok(!!sch.ruhtBis && /sendet es von selbst/.test(sch.meldung) && lageS?.pause === true && lageS?.aus === false && /Gmail bremst kurz/.test(String(lageS?.ruhtGrund)),
      `Postfach-Schalter an, Störung läuft: ehrliche Meldung, Schalter „an“, ruht mit Grund (${sch.meldung})`);
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'radar_postfach_stoerung'`;
    const stand3 = await mo.radarMotorStand();
    ok(!!stand3.lage?.chip && "freigabeAm" in stand3 && typeof stand3.ableitungAnteilJetzt === "number", `Stand fürs Chefbüro mit Lage („${stand3.lage?.chip}“), Freigabe und Anteil der Ableitung`);
    if (freiVorher) await setzen({ radar_motor_freigabe: freiVorher });
    await sqlPool.end({ timeout: 2 });
  }
}

abschnitt("Partner-Strom: Steuerberater, Finanzierer, Kreditvermittler … (E-458)");
{
  const crm = await import("../shared/fiaon-partner-crm");
  const lib = await import("../server/lib/fiaon-radar");
  const G = sh8.RADAR_PARTNER_GRUPPEN;
  ok(G.length === 10 && new Set(G.map((g) => g.key)).size === 10 && G.every((g) => !sh8.RADAR_BEREICHE.some((b) => b.key === g.key) && sh8.radarBereich(g.key) === null) && sh8.RADAR_BEREICHE.length === 10, "Zehn Partner-Gruppen, Schlüssel eindeutig und keine Firmen-Bereiche; die zehn Bereiche bleiben");
  ok(JSON.stringify(G.filter((g) => !g.provision).map((g) => g.key).sort()) === JSON.stringify(["rechtsanwaelte", "steuerberater"]) && G.every((g) => (g.provision ? g.crmArt === "kooperation" : g.crmArt === "kanzlei") && crm.PARTNER_ARTEN.some((a) => a.wert === g.crmArt)), "Steuerberater und Rechtsanwälte ohne Provision (Akte „kanzlei“), alle anderen mit Provision („kooperation“)");
  for (const g of G) {
    const text = `${g.angebot}\n${g.frage}`;
    ok(!globalWortPruefen(text).length && !/[–—]/.test(text) && g.frage.trim().endsWith("?") && !/termin|call|meeting|gespräch|telefon|treffen/i.test(g.frage) && (g.provision || !/provision|prozent|vergütung|tippgeld/i.test(g.angebot)),
      `Gruppe ${g.key}: Angebot und Frage bestehen die Wortwand, ohne Gedankenstrich, Frage mit „?“ ohne Termin${globalWortPruefen(text).length ? ` (${globalWortPruefen(text).map((x) => x.treffer).join(", ")})` : ""}`);
  }
  ok(sh8.RADAR_PARTNER_SIGNALE.every((x) => x.staerke >= 1 && x.staerke <= 5) && sh8.RADAR_PARTNER_SIGNALE.filter((x) => x.staerke >= 3).length >= 3 && sh8.RADAR_PARTNER_SIGNALE.every((x) => !sh8.radarSignal(x.key)), "Partnersignale: Stärke 1–5, mindestens drei ab 3, eigene Schlüssel");
  const seite = [{ url: "https://kanzlei-beispiel.example/schwerpunkte", text: "Wir begleiten Unternehmer und Onlinehändler beim Schritt in die USA und bei der Gründung einer eigenen Gesellschaft dort." }];
  const pSig = await lib.signalPruefen({ art: "p_us_expansion", beleg: "Wir begleiten Unternehmer und Onlinehändler beim Schritt in die USA", url: "", staerke: 5 }, seite, undefined, "partner");
  const fSig = await lib.signalPruefen({ art: "p_us_expansion", beleg: "Wir begleiten Unternehmer und Onlinehändler beim Schritt in die USA", url: "", staerke: 5 }, seite, undefined, "firma");
  ok(pSig.staerke === 5 && pSig.signal?.geprueft === true && fSig.signal === null, "signalPruefen nimmt Partner-Schlüssel nur im Partner-Strom");
  // Übergabe ins Partner-CRM (rein)
  const kanzlei = { name: "Beispiel Steuerkanzlei", website: "https://kanzlei-beispiel.example", email: "max.beispiel@kanzlei-beispiel.example",
    impressum: { strasse: "Musterweg 12", plz: "10115", ort: "Berlin", land: "DE" }, entscheider: { name: "Max Beispiel", rolle: "Partner", email: "max.beispiel@kanzlei-beispiel.example" } };
  const st = sh8.radarPartnerCrmEingabe({ firma: { ...kanzlei, bereich: "steuerberater" }, antwort: { text: "Gern, schicken Sie mir das schriftlich.", zusammenfassung: "Interesse", datum: "2026-10-30T10:00:00+01:00" }, heute: "2026-10-30" });
  ok(st.firma.art === "kanzlei" && /ohne Provision/.test(st.firma.konditionen[0].value) && !/30 %/.test(JSON.stringify(st)), "Steuerberater → Akte „kanzlei“, Kondition ohne Provision");
  const kv = sh8.radarPartnerCrmEingabe({ firma: { ...kanzlei, name: "Beispiel Kreditvermittlung", bereich: "kreditvermittler" }, antwort: { text: "Klingt gut.", datum: "2026-10-30T10:00:00+01:00" }, heute: "2026-10-30" });
  ok(kv.firma.art === "kooperation" && /^30 Prozent unseres Honorars, ein Jahr lang, je vorgestelltem Kunden/.test(kv.firma.konditionen[0].value) && /Tippgeber-Vereinbarung/.test(kv.aufgabe.titel) && !/30 %/.test(kv.aufgabe.titel), "Kreditvermittler → „kooperation“ mit dem Provisions-Satz, Aufgabe Tippgeber-Vereinbarung");
  ok(st.kontakte.length === 1 && st.kontakte[0].haupt === true && st.kontakte[0].name === "Max Beispiel" && st.firma.tags.includes("radar") && st.firma.tags.includes("steuerberater"), "Kontakt = Entscheider als Hauptkontakt; Schlagworte „radar“ und Gruppe");
  ok(st.aufgabe.faelligAm === "2026-11-02" && sh8.radarNaechsterWerktag("2026-10-29") === "2026-10-30", "Aufgabe fällig am nächsten Werktag (Freitag → Montag)");
  ok(st.firma.strasse === "Musterweg" && st.firma.hausnummer === "12" && crm.firmaPruefen(st.firma).ok && crm.aufgabePruefen({ firmaId: 1, ...st.aufgabe }).ok, "Die Eingabe besteht die Prüfungen des Partner-CRM (Firma, Aufgabe)");
  // Regeln je Gruppe
  const pm = { betreff: "Ihre Mandanten mit Plänen in den USA", absaetze: [
    "Ich habe auf Ihrer Website gelesen, dass Sie viele Onlinehändler betreuen, die auch an Kunden in Übersee verkaufen. Für genau diese Unternehmer haben wir etwas Passendes.",
    "Wir gründen ihnen eine eigene Gesellschaft in den USA und kümmern uns um Geschäftskonto und Firmenkarten. Die steuerliche Betreuung bleibt dabei ganz bei Ihnen, und wir stellen uns gern gegenseitig Mandanten vor."],
    frage: "Haben Sie Mandanten, für die das gerade ein Thema ist?", ps: "" };
  const po = (gruppe: string) => ({ streng: true, strom: "partner" as const, gruppe, anrede: "Guten Tag Max Beispiel,", schluss: sh8.radarSchlusssatzFuer(1, pm.frage), mitLink: false });
  ok(lib.mailPruefen(pm, po("steuerberater")).sperrend.length === 0, `Saubere Partner-Mail an eine Steuerkanzlei besteht (${lib.mailPruefen(pm, po("steuerberater")).sperrend.join("; ")})`);
  const mitProv = { ...pm, absaetze: [pm.absaetze[0], `${pm.absaetze[1]} Dafür gibt es eine Provision.`] };
  const mitProzent = { ...pm, absaetze: [pm.absaetze[0], `${pm.absaetze[1]} Sie bekommen 30 Prozent unseres Honorars.`] };
  ok(lib.mailPruefen(mitProv, po("steuerberater")).sperrend.some((x) => /keine Provision/.test(x)) && lib.mailPruefen(mitProzent, po("steuerberater")).sperrend.some((x) => /keine Provision/.test(x)), "Steuerberater: „Provision“ oder „Prozent“ sperrt");
  ok(!lib.mailPruefen(mitProzent, po("kreditvermittler")).sperrend.length, `Kreditvermittler: „30 Prozent unseres Honorars“ sperrt nicht (${lib.mailPruefen(mitProzent, po("kreditvermittler")).sperrend.join("; ")})`);
  const ph = lib.mailHtml({ anrede: "Guten Tag Max Beispiel,", absaetze: pm.absaetze, frage: pm.frage, links: { gespraech: "https://fiaon.com/#gespraech", seite: "https://fiaon.com/" }, mitLink: false });
  ok(!/#gespraech|Einen Termin wählen/.test(ph), "Partner-Mail ohne Terminlink");
  const termin = sh8.radarPlan({ art: "termin_wunsch", maraModus: "auto", postfachJs: false, frisch: true, roboter: false, buchungslink: null, wunschFrei: true, telefon: true, maraHeute: 0, strom: "partner" });
  ok(!termin.buchen && termin.schritte.some((x) => /Partner/.test(x)) && sh8.radarPlan({ art: "termin_wunsch", maraModus: "auto", postfachJs: false, frisch: true, roboter: false, buchungslink: null, wunschFrei: true, telefon: true, maraHeute: 0 }).buchen, "radarPlan: Partner buchen nie einen Termin (Firmen weiter)");
  const pmo = sh8.radarMotorLesen({ radar_partner_gruppen: "steuerberater,quatsch,kreditvermittler" });
  ok(JSON.stringify(pmo.partnerGruppen) === JSON.stringify(["steuerberater", "kreditvermittler"]) && sh8.radarMotorLesen({}).partnerGruppen.length === 10 && sh8.radarMotorLesen({ radar_partner_gruppen: "" }).partnerGruppen.length === 0 && sh8.radarMotorLesen({}).partnerTagesziel === 100, "Partner-Schalter: Gruppen an/aus (unbekannte fallen weg), 100 Funde am Tag");
  const libQ = lies("server/lib/fiaon-radar.ts"), fdQ = lies("server/lib/fiaon-radar-faden.ts"), paQ = lies("server/lib/fiaon-radar-partner.ts");
  ok(/if \(f\.strom === "partner" && regel\.lead && frisch\) \{\s*await partnerInsCrm\(/.test(fdQ) && /uebernehmen\(firmaId/.test(fdQ) && /partner_firma_id = \$\{r\.id\}/.test(fdQ), "Antwort-Wächter: Partner mit Interesse → Partner-CRM (eine Transaktion), bestehende Partner nur Verlauf und Aufgabe");
  ok(/FROM fiaon_partner_firmen/.test(paQ) && /FROM fiaon_partner_kontakte/.test(paQ) && /fassung LIKE 'IA-KOOP-%'/.test(paQ) && /for \(const d of Array\.from\(await partnerAusschluss\(\)\)\) aus\.add\(d\)/.test(paQ), "Partner-Suche schließt bestehende Partner aus (CRM-Firmen, Kontakte, Kooperationsverträge)");
  ok(/const mitLink = strom === "firma" && motor\.link === "termin"/.test(libQ) && /KEIN Termin, kein Anruf, kein Gespräch/.test(libQ) && /KEINE Provision, keine Prozente/.test(libQ) && /Nie „empfehlen“/.test(libQ), "Partner-Mail: kein Terminlink, kein Gesprächswunsch, keine Provision für Kanzleien, nie „empfehlen“");
  ok(/Ziel: die Zusammenarbeit SCHRIFTLICH vereinbaren/.test(fdQ) && /const ohneLink = partner \|\|/.test(fdQ), "Maras Antwort an Partner: schriftlich, ohne Zeiten und ohne Link");
  ok(/radarPartnerSuchen\(\{ gruppe, land: PARTNER_LAENDER/.test(libQ) && /const PARTNER_LAENDER: RadarLand\[\] = \["DE", "DE", "CH"\]/.test(libQ) && /quote\("partner"\) < quote\("firma"\)/.test(libQ), "Tageslauf: Partner-Suche im selben Lauf, Vorrang für den knapperen Vorrat, Partner nur DE und CH");
  ok(/"\/chef\/radar\/partner\/suchen", wache/.test(lies("server/routes/fiaon-radar.ts")), "Partnersuche von Hand hinter der Wache");
}

abschnitt("Chef-Adresse ableiten — nur mit belegtem Muster und MX (E-458)");
{
  const d = "beispiel-gmbh.example";
  ok(sh8.radarAdressMusterLernen([{ adresse: `a.schmidt@${d}`, name: "Anna Schmidt" }], d) === "{v}.{nachname}" && sh8.radarAdresseAbleiten("Max Müller", "{v}.{nachname}", d) === `m.mueller@${d}`, "a.schmidt@ + Anna Schmidt → {v}.{nachname}; Max Müller → m.mueller@");
  ok(sh8.radarAdressMusterLernen([{ adresse: `jonas.weber@${d}`, name: "Jonas Weber" }], d) === "{vorname}.{nachname}" && sh8.radarAdresseAbleiten("Jürgen Groß", "{vorname}.{nachname}", d) === `juergen.gross@${d}`, "jonas.weber@ → {vorname}.{nachname}; Jürgen Groß → juergen.gross@ (Umlaute, ß)");
  ok(sh8.radarAdressMusterLernen([{ adresse: `a.schmidt@${d}`, name: "Anna Schmidt" }, { adresse: `jonas.weber@${d}`, name: "Jonas Weber" }], d) === null, "Widersprechende Beispiele → kein Muster");
  ok(sh8.radarAdressMusterLernen([], d) === null && sh8.radarAdresseAbleiten("Max Müller", null, d) === null, "Kein Beispiel → nichts (nie raten)");
  ok(sh8.radarAdressMusterLernen([{ adresse: `info@${d}`, name: "Anna Schmidt" }, { adresse: `office@${d}`, name: "Jonas Weber" }], d) === null, "info@ und office@ zählen nie als Beispiel");
  ok(sh8.radarAdressMusterLernen([{ adresse: "a.schmidt@andere-firma.example", name: "Anna Schmidt" }], d) === null, "Beispiel einer fremden Domäne zählt nicht");
  ok(sh8.radarAdresseAbleiten("Claudius zur Linden", "{v}.{nachname}", d) === null && sh8.radarAdresseAbleiten("Hans-Peter Meier", "{v}.{nachname}", d) === null, "„Claudius zur Linden“ und „Hans-Peter Meier“ → nichts, solange kein Beispiel diesen Fall zeigt");
  ok(sh8.radarAdresseAbleiten("Hans-Peter Meier", "{v}.{nachname}", d, [{ adresse: `e.roth@${d}`, name: "Eva-Maria Roth" }]) === `h.meier@${d}`, "Zeigt ein Beispiel einen Doppelnamen, darf auch einer abgeleitet werden");
  const abg = sh8.radarAdresseAbleiten("Max Müller", "{v}.{nachname}", d)!;
  ok(sh8.radarAdressePersoenlich(abg, ["Max Müller"]) && sh8.radarAdressePruefen(abg, d, "Beispiel GmbH").ok, "Die abgeleitete Adresse besteht die Adress-Wand (persönlich, eigene Domäne)");
  const ent = await import("../server/lib/fiaon-radar-entscheider");
  const bsp = ent.adressBeispiele([{ url: `https://${d}/team`, text: `Ihre Ansprechpartnerin im Vertrieb: Anna Schmidt, Telefon 0, a.schmidt@${d}. Allgemein: info@${d}`, html: "" }], d, ["Max Müller"]);
  ok(bsp.length === 1 && bsp[0].name === "Anna Schmidt" && bsp[0].adresse === `a.schmidt@${d}` && sh8.radarAdressMusterLernen(bsp, d) === "{v}.{nachname}", `Beispiele aus dem Seitentext: Name rund um die Adresse (${JSON.stringify(bsp)})`);
  // E-458 (Befund): Abteilungen, Standorte und Messen sind keine Menschen — „Abteilung Export · Tel … · export@“ lernt kein Muster.
  const nichtPerson = ent.adressBeispiele([
    { url: `https://${d}/kontakt`, text: `Abteilung Export · Tel 0 · export@${d}. Niederlassung Hamburg, Telefon 0, hamburg@${d}. Messe Frankfurt: messe@${d}`, html: "" },
  ], d, ["Peter Meier"]);
  ok(!nichtPerson.length && sh8.radarAdressMusterLernen(nichtPerson, d) === null, `„Abteilung Export / export@“, „Niederlassung Hamburg / hamburg@“, „Messe Frankfurt / messe@“ zählen nie als Beispiel (${JSON.stringify(nichtPerson)})`);
  ok(!ent.nameImTextTaugt("Anna Schmidt", "Kontakt: anna@firma.example") && ent.nameImTextTaugt("Anna Schmidt", "Ihre Ansprechpartnerin Anna Schmidt") && !ent.nameImTextTaugt("Abteilung Export", "Leiterin Abteilung Export"), "Name aus dem Text nur mit Personenkontext (Rolle, Herr/Frau) und nie aus Abteilungswörtern");
  ok(sh8.radarAdressMusterLernen([{ adresse: `schmidt@${d}`, name: "Anna Schmidt" }], d) === null && sh8.radarAdressMusterLernen([{ adresse: `schmidt@${d}`, name: "Anna Schmidt" }, { adresse: `weber@${d}`, name: "Jonas Weber" }], d) === "{nachname}"
    && sh8.radarAdressMusterLernen([{ adresse: `schmidt@${d}`, name: "Anna Schmidt" }, { adresse: `schmidt@${d}`, name: "Anna Schmidt" }], d) === null, "Schwache Muster ({nachname}, {vorname}, {v}{n}) erst mit zwei VERSCHIEDENEN Beispielen");
  const mx = await import("../server/lib/fiaon-mx");
  const fehler = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));
  mx.mxAufloeserSetzen({ resolveMx: async () => [{ exchange: "mx.beispiel.example", priority: 10 }], resolve4: async () => [], resolveTxt: async () => [] });
  const m1 = await mx.mailDomain(d);
  mx.mxAufloeserSetzen({ resolveMx: () => fehler("ENOTFOUND"), resolve4: () => fehler("ENOTFOUND"), resolveTxt: () => fehler("ENOTFOUND") });
  const m2 = await mx.mailDomain(d);
  mx.mxAufloeserSetzen({ resolveMx: () => fehler("ETIMEOUT"), resolve4: () => fehler("ETIMEOUT"), resolveTxt: () => fehler("ETIMEOUT") });
  const m3 = await mx.mailDomain(d);
  mx.mxAufloeserSetzen(null);
  ok(m1 === "mx" && m2 === "keine" && m3 === "unklar", `MX mit Attrappe (kein Netz): Eintrag → mx, ENOTFOUND → keine, Zeitüberschreitung → unklar (${m1}/${m2}/${m3})`);
  const enQ = lies("server/lib/fiaon-radar-entscheider.ts");
  ok(/if \(\(await mailDomain\(f\.domain\)\) !== "mx"\) return null;/.test(enQ) && /const muster = radarAdressMusterLernen\(liste, f\.domain\);/.test(enQ) && /weg: "abgeleitet"[\s\S]{0,200}muster, beleg: \{ adresse: beleg\.adresse, name: beleg\.name/.test(enQ), "Ableitung nur mit gelerntem Muster und MX „mx“; gespeichert mit weg „abgeleitet“, Muster und Beleg");
  const iWeb = enQ.indexOf("// ── 1. Die Website ──"), iAbl = enQ.indexOf("// ── 1b. Die Ableitung"), iSuche = enQ.indexOf("// ── 2. Die Websuche ──");
  ok(iWeb > 0 && iWeb < iAbl && iAbl < iSuche && /if \(!motor\.ableitung \|\| widerlegt \|\| !chef\) return null;/.test(enQ), "Reihenfolge Website → Ableitung (kostenlos) → Websuche (bezahlt); nie bei widerlegtem Muster oder abgeschalteter Ableitung");
  ok(/f\.entscheider\?\.weg === "abgeleitet"[\s\S]{0,200}muster_widerlegt: true/.test(lies("server/lib/fiaon-radar-faden.ts")), "Rückläufer einer abgeleiteten Adresse → muster_widerlegt (keine zweite Ableitung)");
  const briefBasis = { status: "gescannt", land: "DE", signal_staerke: 4, name: "Beispiel GmbH", domain: d, versendet_am: null, brief_versendet_am: null,
    impressum: { name: "Beispiel GmbH", strasse: "Musterweg 1", plz: "10115", ort: "Berlin", land: "DE", vertreter: [{ name: "Max Müller", funktion: "Geschäftsführer" }] } };
  ok(!sh8.radarBriefPruefen({ ...briefBasis, entscheider: { name: "Max Müller", email: abg, weg: "abgeleitet" } }).ok && sh8.radarBriefPruefen({ ...briefBasis, entscheider: { name: "Max Müller", email: abg, weg: "abgeleitet", muster_widerlegt: true } }).ok, "Brief: widerlegte abgeleitete Adresse zählt nicht als persönlich → Brief möglich");
  // E-458 (Befund): der ECHTE Stand nach einem Rückläufer — status „unzustellbar“, versendet_am gesetzt.
  const nachRueck = { ...briefBasis, status: "unzustellbar", versendet_am: "2026-10-27T10:00:00Z", entscheider: { name: "Max Müller", email: abg, weg: "abgeleitet", muster_widerlegt: true } };
  ok(sh8.radarBriefPruefen(nachRueck).ok && !sh8.radarBriefPruefen({ ...nachRueck, entscheider: { name: "Max Müller", email: abg, weg: "website" } }).ok, "Brief nach dem Rückläufer einer abgeleiteten Adresse (echter Stand) — nach einem anderen Rückläufer nicht");
  const briefQ = lies("server/lib/fiaon-radar-brief.ts");
  ok(/OR \(r\.status = 'unzustellbar' AND r\.entscheider->>'muster_widerlegt' = 'true'\)/.test(briefQ) && /'ohne_kontakt', 'unzustellbar'\) THEN 'brief'/.test(briefQ), "Der Brief-Lauf nimmt widerlegte Ableitungen; der Stand wird danach „Brief unterwegs“");
  ok(sh8.radarAbleitungUrteil({ gesendet: 30, rueck: 2, rueckMax: 5 }).abschalten && !sh8.radarAbleitungUrteil({ gesendet: 29, rueck: 9, rueckMax: 5 }).abschalten && !sh8.radarAbleitungUrteil({ gesendet: 100, rueck: 5, rueckMax: 5 }).abschalten, "Schutz: über 5 % Rückläufer abgeleiteter Adressen (ab 30 Sendungen) schaltet die Ableitung ab");
  const moQ = lies("server/lib/fiaon-radar-motor.ts");
  ok(/const anteil = radarAbleitungAnteilJetzt\(m, jetzt\);[\s\S]{0,200}abgeleitetErlaubt = m\.ableitung && \(\(abg \+ 1\) \/ \(alle \+ 1\)\) \* 100 <= anteil/.test(moQ) && /\(p\.datum AT TIME ZONE 'Europe\/Berlin'\)::date = \$\{berlinToday\(jetzt\)\}::date`\) as any\[\];\s*let abg/.test(moQ)
    && /INSERT INTO fiaon_settings \(key, value\) VALUES \('radar_ableitung', 'aus'\)/.test(moQ), "Je Tag höchstens radar_ableitung_anteil Prozent an abgeleitete Adressen (erste Woche nach der Freigabe 20 %); Wache schaltet ab und legt eine Aufgabe an");
  ok(/import \{ mailDomain \} from "\.\.\/lib\/fiaon-mx"/.test(lies("server/routes/fiaon-antrag-neu.ts")) && !/async function mailDomain/.test(lies("server/routes/fiaon-antrag-neu.ts")), "Der Antrag prüft MX über dieselbe Funktion (fiaon-mx.ts)");
  ok(/WHERE motor_status IS NULL|r\.motor_status IS NULL/.test(moQ) && !/automatik_am IS NULL/.test(moQ), "Die früher einmal versuchten Firmen (automatik_am) kommen über motor_status wieder dran");
}

abschnitt("Postfächer: Rundlauf, Tagesgrenze, Hochfahren (E-458)");
{
  const lib = await import("../server/lib/fiaon-radar");
  const alt = { p: process.env.RADAR_POSTFAECHER, d: process.env.RADAR_VERSAND_DOMAINS };
  process.env.RADAR_POSTFAECHER = "a@fiaon.com,b@versand.example,c@gmail.com"; process.env.RADAR_VERSAND_DOMAINS = "fiaon.com,versand.example,gmail.com";
  const mit = lib.radarPostfaecher();
  delete process.env.RADAR_VERSAND_DOMAINS;
  const ohne = lib.radarPostfaecher();
  if (alt.p === undefined) delete process.env.RADAR_POSTFAECHER; else process.env.RADAR_POSTFAECHER = alt.p;
  if (alt.d !== undefined) process.env.RADAR_VERSAND_DOMAINS = alt.d;
  ok(JSON.stringify(mit) === JSON.stringify(["a@fiaon.com", "b@versand.example"]) && JSON.stringify(ohne) === JSON.stringify(["a@fiaon.com"]), `RADAR_VERSAND_DOMAINS: fiaon.com und versand.example ja, gmail.com nie; ohne Env nur @fiaon.com (${mit.join(",")} / ${ohne.join(",")})`);
  const jetzt = new Date("2026-10-29T10:00:00+01:00");
  const g = (tageHer: number | null, jeTag = 60) => sh8.radarPostfachGrenze({ ersterVersand: tageHer == null ? null : new Date(jetzt.getTime() - tageHer * 86_400_000), jetzt, jeTag, rampe: [20, 40] });
  ok(g(0) === 20 && g(6) === 20 && g(7) === 40 && g(13) === 40 && g(14) === 60 && g(400) === 60 && g(null) === 20, "Hochfahren: Tag 0–6 → 20, Tag 7–13 → 40, ab Tag 14 → 60; ohne Geschichte → 20");
  ok(g(30, 30) === 30 && g(8, 30) === 30 && sh8.radarMotorLesen({ radar_postfach_je_tag: "500" }).postfachJeTag === 60 && JSON.stringify(sh8.radarMotorLesen({ radar_postfach_rampe: "10,30" }).postfachRampe) === "[10,30]", "radar_postfach_je_tag 30 → höchstens 30; die harte Grenze bleibt 60; Rampe einstellbar");
  const sig = '<div>Anna Beispiel<br><img src="https://bilder.example/anna.png"></div>';
  const dnsGut = { mx: true, spf: true, dkim: true, dmarc: true };
  const b = (person: any, eigen = true, dns: any = null, gmail: boolean | null = true) => sh8.radarPostfachBereit({ person, gmail, dns, eigeneDomain: eigen });
  ok(b({ name: "Anna Beispiel", signaturHtml: sig, quelle: "gmail" }).bereit && b({ name: "Justin Schwarzott", signaturHtml: "", quelle: "karte" }).bereit, "Bereit: echte Person mit Bild-Signatur (oder Justins Karte)");
  ok(!b({ name: "Anna Beispiel", signaturHtml: "<div>Anna Beispiel</div>", quelle: "gmail" }).bereit && !b({ name: "Vertrieb", signaturHtml: sig, quelle: "gmail" }).bereit && !b(null).bereit, "Nicht bereit: Signatur ohne Bild, Name mit einem Wort, keine Unterschrift");
  ok(!b({ name: "Anna Beispiel", signaturHtml: sig, quelle: "gmail" }, false, { ...dnsGut, spf: false, dkim: false, dmarc: false }).bereit && b({ name: "Anna Beispiel", signaturHtml: sig, quelle: "gmail" }, false, dnsGut).bereit && !b({ name: "Anna Beispiel", signaturHtml: sig, quelle: "gmail" }, true, null, false).bereit, "Fremde Domäne ohne SPF/DKIM/DMARC nicht bereit, mit allen vier bereit; ohne Gmail-Zugang nie");
  const mx = await import("../server/lib/fiaon-mx");
  mx.mxAufloeserSetzen({
    resolveMx: async () => [{ exchange: "aspmx.l.google.com", priority: 1 }], resolve4: async () => [],
    resolveTxt: async (n: string) => (n.startsWith("_dmarc.") ? [["v=DMARC1; p=none"]] : n.startsWith("google._domainkey.") ? [["v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"]] : [["v=spf1 include:_spf.google.com ~all"]]),
  });
  const vd = await mx.versandDns("versand.example");
  mx.mxAufloeserSetzen({ resolveMx: async () => [{ exchange: "mx.example", priority: 1 }], resolve4: async () => [], resolveTxt: async () => [["v=spf1 -all"]] });
  const vd2 = await mx.versandDns("versand.example");
  mx.mxAufloeserSetzen(null);
  ok(vd.mx && vd.spf && vd.dkim && vd.dmarc && vd2.mx && !vd2.spf && !vd2.dkim && !vd2.dmarc, "DNS-Ampel (Attrappe): MX, SPF mit Google, DKIM, DMARC");
  const moQ = lies("server/lib/fiaon-radar-motor.ts"), fdQ = lies("server/lib/fiaon-radar-faden.ts");
  ok(/WHERE richtung = 'aus' AND art <> 'von_hand' AND postfach = ANY/.test(moQ) && /AND nachfass_stufe < \$\{RADAR_NACHFASS_TAGE\.length\} AND postfach = ANY/.test(moQ), "Tageszählung je Postfach: erste Mail, Nachfass und Mara (nicht Justins Antworten von Hand); fällige Nachfass-Mails reserviert");
  ok(/const lage = lagen\.find\(\(l\) => l\.adresse === String\(f\.postfach\)\);[\s\S]{0,400}if \(lage && \(lage\.pause \|\| lage\.heute >= lage\.grenze\)\) \{ erg\.uebersprungen\+\+; continue; \}/.test(fdQ), "Nachfass bleibt im Postfach der ersten Mail und wartet, wenn es voll oder pausiert ist");
  ok(/postfachJs: postfach === "js@fiaon\.com"/.test(fdQ) && /for \(const a of radarPostfaecher\(\)\) await postfachBereitschaft\(a\);\s*const genommen = await uebernehmen/.test(moQ), "Aus js@ antwortet Mara nie selbst (andere Postfächer dürfen); Bereitschaft vor der Sperre geprüft");
  ok(/"\/chef\/radar\/postfach\/:adresse\/pause", wache/.test(lies("server/routes/fiaon-radar.ts")) && /"\/chef\/radar\/postfach\/:adresse\/pruefen", wache/.test(lies("server/routes/fiaon-radar.ts")), "Postfach pausieren und prüfen hinter der Wache");
}

abschnitt("Zustellung schützen: Rückläufer und Beschwerden (E-458)");
{
  const w = (g: number, r: number, b = 0) => sh8.radarZustellWerte({ gesendet: g, rueck: r, beschwerden: b });
  const grenzen = { rueckMax: 3, beschwerdeMax: 0.3 };
  const jetzt = new Date("2026-10-29T12:00:00+01:00");
  const ent = (werte: any, bremse: any = null, j = jetzt) => sh8.radarBremseEntscheiden({ werte, bremse, jetzt: j, grenzen });
  ok(w(1000, 31).rueckQuote === 3.1 && ent(w(1000, 31)).faktor === 0.5, "1.000 gesendet, 31 Rückläufer → 3,1 % → Bremse 0,5");
  ok(w(1000, 30).rueckQuote === 3 && ent(w(1000, 30)).faktor === 1, "30 Rückläufer → 3,0 % → keine Bremse");
  ok(w(1000, 0, 4).beschwerdeQuote === 0.4 && ent(w(1000, 0, 4)).faktor === 0.5, "4 Beschwerden auf 1.000 → 0,4 % → Bremse");
  ok(w(40, 10).rueckQuote === null && ent(w(40, 10)).faktor === 1, "40 Sendungen → keine Quote (Mindestbasis 50)");
  const halb = { faktor: 0.5, seit: new Date(jetzt.getTime() - 49 * 3_600_000).toISOString(), grund: "x" };
  ok(ent(w(1000, 40), halb).faktor === 0.25 && ent(w(1000, 40), { ...halb, seit: new Date(jetzt.getTime() - 10 * 3_600_000).toISOString() }).faktor === 0.5, "Schon 0,5 und nach 48 h weiter drüber → 0,25 (vorher bleibt 0,5)");
  ok(ent(w(1000, 90), { faktor: 0.25, seit: new Date(jetzt.getTime() - 200 * 3_600_000).toISOString(), grund: "x" }).faktor === 0.25, "Nie unter 0,25");
  const unter = ent(w(1000, 5), { ...halb, unterSeit: new Date(jetzt.getTime() - 73 * 3_600_000).toISOString() });
  const nochNicht = ent(w(1000, 5), { ...halb, unterSeit: new Date(jetzt.getTime() - 30 * 3_600_000).toISOString() });
  ok(unter.faktor === 1 && unter.geloest && nochNicht.faktor === 0.5 && !nochNicht.geloest && ent(w(1000, 5), halb).unterSeit === jetzt.toISOString(), "Drei Tage unter beiden Grenzen → 1 (vorher bleibt die Bremse, der Zähler startet)");
  ok(sh8.radarBeschwerde("rechtlich", "") && sh8.radarBeschwerde("datenschutz", "") && sh8.radarBeschwerde("kein_interesse", "Das ist Spam, bitte nicht mehr.") && !sh8.radarBeschwerde("kein_interesse", "Kein Bedarf, danke."), "Beschwerde: Anwalt, Datenschutz und Absage mit „Spam“ zählen — eine normale Absage nicht");
  const moQ = lies("server/lib/fiaon-radar-motor.ts");
  ok(/const bremse = await bremseLesen\(\);[\s\S]{0,400}uebernehmen\(jetzt, m, bremse,/.test(moQ) && /motorDran\(jetzt, m, st, faktor, bremse\?\.seit \?\? null\)/.test(moQ) && /jeStunde: ziel\.firma \+ ziel\.partner,[\s\S]{0,200}bremse, bremseSeit \}\)/.test(moQ)
    && /grenze: Math\.floor\(radarPostfachGrenze\([\s\S]{0,160}\) \* faktor\)/.test(moQ), "Die Bremse wirkt beim Senden auf beide Stundenziele UND auf die Tagesgrenze der Postfächer");
  ok(/`radar-zustellung:\$\{berlinToday\(jetzt\)\}`/.test(moQ) && /pausen\[adresse\] = new Date\(jetzt\.getTime\(\) \+ 48 \* 3_600_000\)/.test(moQ), "Aufgabe für Justin einmal je Tag (radar-zustellung:<Tag>); ein Postfach über der Grenze pausiert 48 h");
  ok(/if \(radarBeschwerde\(art, kern\)\) await sqlPool`UPDATE fiaon_radar_post SET beschwerde = TRUE/.test(lies("server/lib/fiaon-radar-faden.ts")) && /ADD COLUMN IF NOT EXISTS beschwerde BOOLEAN/.test(lies("server/lib/fiaon-radar.ts")), "Beschwerden werden am Eingang markiert (Spalte beschwerde)");
  ok(/"\/chef\/radar\/bremse\/loesen", wache[\s\S]{0,120}bestaetigt !== true/.test(lies("server/routes/fiaon-radar.ts")), "„Bremse lösen“ nur mit Bestätigung, hinter der Wache");
}

abschnitt("Chefbüro: alle Schalter im Raum Firmen-Radar › Automatik (E-458)");
{
  const ui = lies("client/src/components/admin/ChefRadar.tsx"), rg = lies("client/src/pages/agent/rundgaenge.ts"), rt = lies("server/routes/fiaon-radar.ts");
  ok(["<MotorKachel ", "<PostfachKachel ", "<ZustellKachel ", "<PruefKiKachel ", "<PartnerKachel ", "<AdressenKachel "].every((k) => ui.includes(k)), "Reiter Automatik: Kacheln Mail-Motor, Postfächer, Zustellung, Prüf-KI, Partner, Adressen");
  ok(/Heute möglich/.test(ui) && !/8:30–17:30/.test(ui) && !/Mails je Werktag/.test(ui), "„Heute möglich“ steht da; kein festes 8:30–17:30, kein „Mails je Werktag“");
  ok(/p\.set\("strom", strom\)/.test(ui) && /Partner suchen/.test(ui) && /"\/chef\/radar\/partner\/suchen"/.test(ui) && /trichter\?tage=30&strom=/.test(ui), "Firmen | Partner im Reiter Firmen, Partnersuche im Suchfenster, Trichter je Strom");
  ok(/Abgeleitet aus/.test(ui) && /Kooperationspartner · \{radarPartnerGruppe\(f\.bereich\)/.test(ui) && /Prüfen lassen/.test(ui), "Akte: Herkunft der Adresse (Website, Websuche, abgeleitet mit Beleg), Strom und Gruppe, Prüf-KI mit „Prüfen lassen“");
  const wege = rt.split("\n").filter((z) => /^router\.(get|post|put|delete)\("\/chef\/radar\/(motor|bremse|postfach|partner)/.test(z));
  ok(wege.length >= 7 && wege.every((z) => z.includes(", wache,")), `Neue Routen des Motors alle hinter der Wache (${wege.length})`);
  ok(/"\/chef\/radar\/motor\/senden", wache[\s\S]{0,160}bestaetigt !== true/.test(rt) && /"\/chef\/radar\/bremse\/loesen", wache[\s\S]{0,120}bestaetigt !== true/.test(rt), "Eine Mail senden und Bremse lösen nur mit Bestätigung");
  const seiten = lies("client/src/components/admin/chef-seiten.tsx");
  ok((seiten.match(/slug: "firmen-radar"/g) ?? []).length === 1 && /slug: "firmen-radar"[^\n]*mindest: "geschaeftsfuehrung"/.test(seiten), "Keine neue Chef-Seite; der Firmen-Radar bleibt ab Geschäftsführung");
  const rgFr = rg.slice(rg.indexOf("export const RUNDGANG_FIRMEN_RADAR"), rg.indexOf("// ── /chef/s/telefonkartei"));
  const ziele = Array.from(rgFr.matchAll(/ziel: "\.([a-z0-9-]+)"/g)).map((m) => m[1]);
  ok([".cr-motor", ".cr-postfaecher", ".cr-zustellung", ".cr-partner", ".cr-pruefki-kachel", ".cr-adressen"].every((z) => rgFr.includes(`ziel: "${z}"`)) && !/8:30/.test(rgFr) && !/Abmeldesatz/.test(rgFr), "Rundgang: Schritte Mail-Motor, Postfächer, Zustellung, Prüf-KI, Adressen, Partner; kein 8:30, kein Abmeldesatz");
  // E-458 (Nachbesserung): Rundgang und Oberfläche sagen, was der Bau jetzt tut.
  ok(/„Nachfassen jetzt“/.test(rgFr) && !/Jetzt eine Runde senden/.test(rgFr + ui) && /„Alle“, „Firmen“ oder „Partner“/.test(rgFr) && /„Prüfen lassen“/.test(rgFr) && /„Zurück in den Vorrat“/.test(rgFr) && !/bekommen bei uns US-Gesellschaft/.test(rgFr),
    "Rundgang: „Nachfassen jetzt“, Umschalter im Trichter, „Prüfen lassen“ nach Hand-Änderung, „Zurück in den Vorrat“, kein „bekommen bei uns“");
  ok(!/drohen Abmahnungen|vorherige Einwilligung/.test(ui) && /Wer absagt, hört nie wieder von uns/.test(ui), "Chefbüro: keine Rechts-Belehrung mehr, stattdessen eine stille Leitplanke");
  ok(/\/chef\/radar\/firma\/\$\{id\}\/vorschau\?postfach=/.test(ui) && /srcDoc=\{vorschau\?\.html \?\? mail\.html\}/.test(ui) && /motor\?\.postfaecher\.find\(\(x\) => x\.adresse === p\)\?\.name/.test(ui) && /"\/chef\/radar\/firma\/:id\/vorschau", wache/.test(rt),
    "Akte: Vorschau und Absender mit der echten Unterschrift des gewählten Postfachs");
  ok(/Zurück in den Vorrat/.test(ui) && /"\/chef\/radar\/firma\/:id\/vorrat", wache/.test(rt), "Akte: verworfen/abgelaufen → „Zurück in den Vorrat“ (hinter der Wache)");
  ok(ziele.every((k) => new RegExp(`className=[{"\`][^>]*\\b${k}\\b`).test(ui)), `Jedes Rundgang-Ziel steht als className im Chefbüro (${ziele.join(", ")})`);
  ok(!/gold|#c9a2|#d4af|#b8860b/i.test(lies("client/src/styles/chef-radar.css").replace(/\/\*[\s\S]*?\*\//g, "")), "Glasblau, kein Gold (Farben ohne Kommentare geprüft)");
  // Jeder Schalter, den der Weg /chef/radar/motor annimmt, ist im Chefbüro bedienbar (Kachel, Feineinstellungen, Partner, Adressen);
  // jeder Schlüssel des Motors ist über diesen Weg erreichbar — Postfach-Pausen über ihren eigenen Knopf.
  const motorWeg = rt.slice(rt.indexOf('router.post("/chef/radar/motor", wache'), rt.indexOf('router.post("/chef/radar/partner/suchen"'));
  const erlaubt = Array.from((motorWeg.match(/const erlaubt = \[([\s\S]*?)\];/)?.[1] ?? "").matchAll(/"([a-zA-Z]+)"/g)).map((m) => m[1]);
  const felder = Array.from(ui.matchAll(/feld\("([a-zA-Z]+)"/g)).map((m) => m[1]);
  const motorRufe = Array.from(ui.matchAll(/rufen\("\/chef\/radar\/motor", "POST", \{([^}]*)\}/g)).map((m) => m[1]).join(" ");
  const fehltUi = erlaubt.filter((k) => !felder.includes(k) && !new RegExp(`\\b${k}\\b`).test(motorRufe) && !(k === "link" && /value=\{w\.link\}/.test(ui))
    && !(k === "postfachRampe" && /teil\.postfachRampe = \[w\.rampe1, w\.rampe2\]/.test(ui)));
  ok(erlaubt.length >= 23 && !fehltUi.length, `Jeder Schalter des Motors ist im Chefbüro bedienbar (${erlaubt.length}${fehltUi.length ? `; fehlt: ${fehltUi.join(", ")}` : ""})`);
  // Die Freigabe setzt NICHT der allgemeine Schalter-Weg, sondern nur „Freigeben und starten“ mit Bestätigung (eigene Route).
  const fehltWeg = Object.keys(sh8.RADAR_MOTOR_SCHLUESSEL).filter((k) => k !== "postfachAus" && k !== "freigabeAm" && !erlaubt.includes(k));
  ok(!erlaubt.includes("freigabeAm") && /"\/chef\/radar\/motor\/freigeben", wache[\s\S]{0,200}bestaetigt !== true/.test(rt) && /rufen\("\/chef\/radar\/motor\/freigeben", "POST", \{ bestaetigt: true \}\)/.test(ui),
    "Die Freigabe des Motors nur über „Freigeben und starten“ mit Bestätigung (nicht über den allgemeinen Schalter-Weg)");
  ok(!fehltWeg.length && /<PostfachKachel /.test(ui) && /\/chef\/radar\/postfach\/\$\{encodeURIComponent\(/.test(ui), `Jeder Motor-Schlüssel ist einstellbar${fehltWeg.length ? ` (fehlt: ${fehltWeg.join(", ")})` : ""}; Postfach-Pausen über ihren Knopf`);
  ok(/<summary>Feineinstellungen<\/summary>/.test(ui) && /const stand = JSON\.stringify\(e\)/.test(ui) && /\}\), \[stand\]\);/.test(ui) && /v !== \(start as Record<string, string>\)\[k\]/.test(ui),
    "Feineinstellungen: aufklappbar, Eingaben überleben das Nachladen jede Minute, gespeichert wird nur, was sich geändert hat");
  ok(/Unter „Feineinstellungen“/.test(rgFr), "Rundgang nennt die Feineinstellungen");
}

abschnitt("Nur Deutschland und Schweiz (E-458, Justin 29.10.2026)");
ok(!RADAR_LAENDER_AKTIV.includes("AT") && RADAR_LAENDER_AKTIV.includes("DE") && RADAR_LAENDER_AKTIV.includes("CH"), "Aktive Länder: DE und CH, nicht AT");
ok(!radarLandAktiv("AT") && !radarLandAktiv("at") && radarLandAktiv("DE") && radarLandAktiv("CH") && radarLandAktiv(null), "radarLandAktiv: AT nein, DE/CH ja, ohne Angabe = DE");
{
  const f = lies("server/lib/fiaon-radar-faden.ts"), b = lies("server/lib/fiaon-radar-brief.ts"), r = lies("server/lib/fiaon-radar.ts"), mo = lies("server/lib/fiaon-radar-motor.ts");
  ok(/AND NOT \$\{sqlOesterreich\(\)\}\s*AND COALESCE\(land, 'DE'\) = ANY\(\$\{laender\}\)/.test(f), "Nachfass nur in aktiven Ländern (und „Österreich gewinnt“)");
  ok(/AND NOT \$\{sqlOesterreich\(\)\}\s*AND COALESCE\(f\.land, 'DE'\) = ANY\(\$\{laender\}\)/.test(f), "Wiedervorlage nur in aktiven Ländern (und „Österreich gewinnt“)");
  // E-458 (Mail-Motor): Die erste Mail wählt der Motor (kandidatNehmen) — der alte Erstmail-Block in radar_versand ist weg.
  ok(/AND NOT \$\{sqlOesterreich\(\)\}\s*AND COALESCE\(r\.land, 'DE'\) = ANY\(\$\{\[\.\.\.RADAR_LAENDER_AKTIV\]/.test(mo) && !/art = 'erstmail' AND \(datum AT TIME ZONE 'Europe\/Berlin'\)::date = \$\{berlinToday\(jetzt\)\}::date`\) as any\[\];\s*erg\.heute = Number/.test(f), "Erste Mail nur in aktiven Ländern (Motor) — kein zweiter Erstmail-Weg im Versandlauf");
  ok(/AND COALESCE\(r\.land, 'DE'\) = ANY\(\$\{\[\.\.\.RADAR_LAENDER_AKTIV\]/.test(b) && /AND NOT \$\{sqlOesterreich\(\)\}/.test(b), "Brief nur in aktiven Ländern (und „Österreich gewinnt“: .at, ATU, +43)");
  ok(!/const LAENDER: RadarLand\[\] = \[[^\]]*"AT"/.test(r), "Tageslauf sucht reihum nicht in Österreich");
  ok((r.match(/if \(!radarLandAktiv\(/g) ?? []).length >= 2 && /if \(ein\.land && !radarLandAktiv\(ein\.land\)\)/.test(r), "Funde aus Österreich werden nicht aufgenommen, Suche nach Österreich abgewiesen");
  // E-458 (Merge mit dem Mail-Motor): dieselbe Regel für Partner, für die strengere Erkennung und für alle Texte des Motors.
  const pa = lies("server/lib/fiaon-radar-partner.ts");
  ok((pa.match(/if \(ein\.land && !radarLandAktiv\(ein\.land\)\) throw new RadarFehler\(OESTERREICH_AUS\)/g) ?? []).length === 2, "Partner-Suche nach Österreich abgewiesen (Knopf und Tageslauf)");
  ok(/if \(!radarLandAktiv\(radarLandFuer\(\{ land: landFirma, impressum: f, domain \}\)\)\) return nein\(/.test(r), "Aufnahme: auch .at-Domäne, UID ATU oder +43 gilt als Österreich („Österreich gewinnt“)");
  const texte = lies("client/src/components/admin/ChefRadar.tsx") + lies("client/src/pages/agent/rundgaenge.ts") + lies("shared/fiaon-radar.ts");
  ok(!/Österreich bekommt Briefe|Briefe statt Mails|im Brief-Vorrat|Österreich nur für den Brief|geht ein Brief statt einer Mail|hier geht der Brief statt der Mail/.test(texte), "Chefbüro, Rundgang und Zielbilder sagen nicht mehr „Österreich bekommt Briefe“");
}

abschnitt("Nachbesserung nach Sicht, echter Prüf-KI und Go-live-Prüfung (E-458, 29.10.2026)");
{
  const lib = await import("../server/lib/fiaon-radar");
  const pk = await import("../server/lib/fiaon-radar-pruef");
  const kasse = await import("../shared/fiaon-ki-kasse");
  const mo = lies("server/lib/fiaon-radar-motor.ts"), rq = lies("server/lib/fiaon-radar.ts"), fq = lies("server/lib/fiaon-radar-faden.ts"), pq = lies("server/lib/fiaon-radar-pruef.ts");
  const rt = lies("server/routes/fiaon-radar.ts"), ui = lies("client/src/components/admin/ChefRadar.tsx"), rg = lies("client/src/pages/agent/rundgaenge.ts");
  // ── Prüf-KI: Schlusssatz nicht in der Eingabe, Aufwand medium, Zweitmeinung nur bei „nur Zusage“ ──
  let eingabe = "";
  pk.radarPruefModellSetzen(async (e) => { eingabe = e.eingabe; return JSON.stringify({ ok: true, ki_klang: 1, bezug_konkret: true, nutzen_klar: true, eine_frage: true, zusage: false, erfunden: false, punkte: [], neu_hinweis: "" }); });
  await pk.radarMailPruefKi({ name: "Beispiel GmbH", domain: "beispiel.example", scan: { aufhaenger: [{ text: "Neue Halle", beleg: "Wir bauen eine zweite Halle" }], profil: {} } },
    { betreff: "Ihre neue Halle", absaetze: ["Ein Absatz."], frage: "Passt das?", schluss: sh8.RADAR_SCHLUSSSAETZE[2] }, { strom: "firma" });
  pk.radarPruefModellSetzen(null);
  ok(!!eingabe && !sh8.RADAR_SCHLUSSSAETZE.some((x) => eingabe.includes(x)) && !eingabe.includes(lib.RADAR_LINK_SATZ), "Prüf-KI: Schlusssatz und Link-Satz stehen NICHT in der Eingabe (sie hielt sie für einen Fehler der Schreib-KI)");
  ok(/zweck: "radar_pruef", anweisung, eingabe, schema: SCHEMA_PRUEF, aufwand: "medium"/.test(pq), "Prüf-KI denkt mit Aufwand „medium“ (bei „low“ oft gar nicht — genau diese Urteile schwankten)");
  const urteil = (x: Record<string, unknown>) => ({ ok: false, ki_klang: 2, bezug_konkret: true, nutzen_klar: true, eine_frage: true, zusage: true, erfunden: false, punkte: [], neu_hinweis: "", ...x });
  ok(sh8.radarNurZusage(urteil({}) as any, 3) && !sh8.radarNurZusage(urteil({ erfunden: true }) as any, 3) && !sh8.radarNurZusage(urteil({ ki_klang: 5 }) as any, 3) && !sh8.radarNurZusage(urteil({ zusage: false }) as any, 3),
    "„Nur Zusage“ erkannt — mit Erfundenem, KI-Klang über der Grenze oder ohne Zusage nicht");
  let rufe = 0;
  const pruefung = (u: Record<string, unknown>) => async () => { rufe++; const r = sh8.radarPruefUrteil(urteil(u), 3); return { ...r, modell: "attrappe", hash: "h" }; };
  let zm = await pk.radarPruefMitZweitmeinung(pruefung({}), 3);
  ok(rufe === 2 && zm.zweitmeinung === true, "Nur „Zusage“: ein zweites Urteil, bevor neu geschrieben wird");
  rufe = 0; zm = await pk.radarPruefMitZweitmeinung(pruefung({ erfunden: true }), 3);
  ok(rufe === 1 && !zm.zweitmeinung, "Erfunden (echter Fehler): kein zweites Urteil — gleich neu schreiben");
  rufe = 0; zm = await pk.radarPruefMitZweitmeinung(pruefung({ ok: true, zusage: false }), 3);
  ok(rufe === 1 && zm.bestanden, "Bestanden: kein zweiter Aufruf");
  ok(/radarPruefMitZweitmeinung\(\(\) => radarMailPruefKi\(f, mail,/.test(pq) && /radarPruefMitZweitmeinung\(\(\) => radarMailPruefKi\(f, f\.mail,/.test(pq) && /radarPruefMitZweitmeinung\(\(\) => radarMailPruefKi\(f, \{ betreff/.test(fq),
    "Zweitmeinung in Motor, „Prüfen lassen“ und Nachfassen");
  // ── Fingerabdruck: ohne Provisions-Satz und Hauswort, gegen die Ton-Beispiele, Betreff doppelt ──
  const satz = sh8.RADAR_MOTOR_VORGABE.partnerProvisionText;
  const p1 = { absaetze: ["Auf Ihrer Seite steht, dass Sie vor allem Händler begleiten.", `Für jeden Kunden, den Sie uns vorstellen, bekommen Sie ${satz}. Den Rest erledigt unser Team.`], frage: "Darf ich Ihnen die Konditionen dafür schriftlich schicken?" };
  const p2 = { absaetze: ["Ihre Kanzlei betreut viele Gründer aus der Region.", `Wer uns einen Kunden vorstellt, bekommt ${satz}. Die Arbeit mit dem Kunden bleibt bei Ihnen.`], frage: "Wäre das für Ihre Mandanten etwas?" };
  const roh = sh8.radarAehnlichkeit(pk.radarMailKoerper(p2), [pk.radarMailKoerper(p1)]);
  const ohne = pk.radarMailAehnlichkeit(p2, [pk.radarMailKoerper(p1)], "partner", satz);
  ok(roh > 0 && ohne < roh, `Fingerabdruck ohne den freigegebenen Provisions-Satz (${roh} → ${ohne})`);
  ok(!sh8.radarFingerabdruckText("viele Karten mit einem Einführungszeitraum ohne Sollzins").includes("Sollzins"), "Fingerabdruck ohne das Hauswort „Einführungszeitraum ohne Sollzins“");
  const kopie = { absaetze: [lib.RADAR_TON_BEISPIELE.slice(0, 3).join(" "), lib.RADAR_TON_BEISPIELE.slice(3, 6).join(" ")], frage: lib.RADAR_TON_BEISPIELE[6] };
  ok(pk.radarMailAehnlichkeit(kopie, [], "firma") > 0.35, "Eine Mail, die die Ton-Beispiele abschreibt, fällt durch den Fingerabdruck");
  ok(sh8.radarBetreffSchluessel("Ihre neue Halle!") === sh8.radarBetreffSchluessel(" ihre  NEUE halle ") && sh8.radarBetreffSchluessel("Ihre Halle") !== sh8.radarBetreffSchluessel("Ihre neue Halle"), "Betreff-Schlüssel: Groß/Klein und Satzzeichen egal");
  const hinweise: (string | null)[] = [];
  const doppelErg = await pk.radarFertigAblauf({
    schreiben: async (hw) => { hinweise.push(hw); return { sperrend: [] as string[], betreff: hinweise.length === 1 ? "Ihre neue Halle" : "Ihr zweiter Standort" }; },
    pruefen: async () => ({ bestanden: true, urteil: null, gruende: [], modell: "attrappe", hash: "h" }),
    aehnlich: () => 0.1, aehnlichMax: 0.35, betreffDoppelt: (m) => m.betreff === "Ihre neue Halle",
  });
  ok(doppelErg.ok && hinweise.length === 2 && /Denselben Betreff gab es schon/.test(String(hinweise[1])), "Betreff schon einmal verwendet → einmal neu, mit Hinweis (ohne die Prüf-KI zu bezahlen)");
  // ── Schreib-Anweisung: Einstieg je Firma, Ton-Beispiele statt Vorbild, Folgerung allgemein, Nutzen als Möglichkeit ──
  ok(new Set([0, 1, 2, 3].map((i) => sh8.radarEinstiegFuer(i).key)).size === 4 && sh8.radarEinstiegFuer(4).key === sh8.radarEinstiegFuer(0).key, "Vier Einstiege, je Firma fest (nicht jede Mail beginnt mit „Ich habe gesehen“)");
  ok(/const einstieg = radarEinstiegFuer\(id\)\.anweisung;/.test(rq) && /mailAnweisung\(einstieg\)/.test(rq) && /mailAnweisungPartner\(radarPartnerGruppe\(f\.bereich\), motor\.partnerProvisionText, einstieg\)/.test(rq), "Schreib-KI bekommt den Einstieg dieser Firma");
  ok(!/Genau dafür bauen wir Unternehmern eine zweite Kapitalquelle auf/.test(rq) && !/das Kapital können Sie auch hier einsetzen/.test(rq) && /TON-BEISPIELE \(nur der Ton; nie einen dieser Sätze übernehmen/.test(rq),
    "Das alte Ton-Vorbild (abgeschrieben, von der Prüf-KI abgelehnt) ist weg; kurze, verschiedene Ton-Beispiele");
  ok(/Folgerung als ALLGEMEINE Erfahrung mit „meist“, „oft“ oder „häufig“/.test(rq) && /als MÖGLICHKEIT \(„wenn es klappt“, „hätten Sie“\), nie als sicheres Geld/.test(rq) && /unterstellt keine Pläne, Wünsche oder Probleme/.test(rq),
    "Anweisung: Folgerung allgemein (nie Unbelegtes über die Firma), Nutzen als Möglichkeit, Partner-Betreff ohne Unterstellung");
  ok(!/Ihre Mandanten mit Plänen in den USA/.test(rq) && /lieber „Kapital aus den USA“ als „Funding“/.test(rq), "Kein Betreff-Vorbild mehr, das Pläne unterstellt; kein Fachjargon");
  ok(/wenn es klappt/.test(sh8.RADAR_KERNSATZ.vorteil) && !globalWortPruefen(sh8.RADAR_KERNSATZ.vorteil).length, "Kernsatz: der Vorteil als Möglichkeit („wenn es klappt“), besteht die Wortwand");
  const punkteSt = sh8.radarPartnerAngebotPunkte(sh8.radarPartnerGruppe("steuerberater"), satz).join(" ");
  const punkteKv = sh8.radarPartnerAngebotPunkte(sh8.radarPartnerGruppe("kreditvermittler"), satz).join(" ");
  ok(!/provision|prozent|honorar/i.test(punkteSt) && /Kanzlei in Deutschland, die beide Seiten kennt/.test(punkteSt) && punkteKv.includes(satz) && /unberührt/.test(punkteKv),
    "Partner-Angebot als Inhalt: Kanzlei ohne Provision mit echtem Grund; Vermittler mit dem Provisions-Satz");
  ok(sh8.RADAR_PARTNER_GRUPPEN.every((g) => !/Tippgeber/.test(g.frage)), "Partner-Fragen ohne „Tippgeber“ (klingt für einen Profi klein)");
  // ── Strenge Wand: Satzlänge, „sprechen … an“, Schlusssatz nach dem Link ──
  const satz23 = Array.from({ length: 23 }, (_, i) => `wort${i}`).join(" ") + ".";
  const satz22 = Array.from({ length: 22 }, (_, i) => `wort${i}`).join(" ") + ".";
  const wand = (absatz: string, extra: Record<string, unknown> = {}) => lib.radarMailStreng({ betreff: "Ihre Halle", absaetze: [absatz, "Ich schreibe Ihnen kurz."], frage: "Passt das?" }, { streng: true, strom: "firma", ...extra });
  ok(wand(satz23).some((x) => /Satz mit 23 Wörtern/.test(x)) && !wand(satz22).some((x) => /Satz mit/.test(x)) && !wand(satz23, { woerter: [25, 60], frageOptional: true }).some((x) => /Satz mit/.test(x)),
    "Streng: ein Satz über 22 Wörter sperrt (erste Mail); 22 geht; beim Nachfassen keine Satzgrenze");
  const pw = (t: string) => lib.radarMailStreng({ betreff: "Ihre Mandanten", absaetze: [t, "Ich schreibe Ihnen kurz."], frage: "Haben Sie solche Mandanten?" }, { streng: true, strom: "partner", gruppe: "steuerberater", mitLink: false });
  ok(!pw("Sie sprechen dort Händler an, die ins Ausland verkaufen.").some((x) => /Gesprächswunsch/.test(x)) && pw("Darüber sprechen wir gern kurz.").some((x) => /Gesprächswunsch/.test(x)) && pw("Ein kurzes Gespräch dazu?").some((x) => /Gesprächswunsch/.test(x)),
    "Partner-Wand: „sprechen … an“ ist kein Gesprächswunsch; „sprechen wir“ und „Gespräch“ sperren weiter");
  const ohneEcho = "Wäre das für die neue Halle eine Hilfe?";
  ok([0, 1, 2, 3, 4, 5, 6, 7].every((id) => !/^wenn\b/i.test(sh8.radarSchlusssatzFuer(id, ohneEcho, { mitLink: true }))) && [0, 1, 2, 3, 4, 5].some((id) => /^wenn\b/i.test(sh8.radarSchlusssatzFuer(id, ohneEcho))),
    "Nach dem Terminlink („Wenn Sie mögen …“) kein Schlusssatz, der auch mit „Wenn“ beginnt");
  ok(/radarSchlusssatzFuer\(id, entwurf\.frage, \{ mitLink \}\)/.test(rq) && /radarSchlusssatzFuer\(id, frage, \{ mitLink \}\)/.test(rq), "Schreiben und Hand-Änderung wählen den Schlusssatz mit Blick auf den Link");
  // ── Anrede: weibliche Rolle am Namen belegt „Frau“ ──
  ok(lib.radarFormAusRolle({ impressum: { vertreter: [{ name: "Hannah Albrecht", funktion: "Geschäftsführerin" }] } }, "Hannah Albrecht") === "Frau"
    && lib.radarFormAusRolle({ impressum: { vertreter: [{ name: "Max Müller", funktion: "Geschäftsführer" }] } }, "Max Müller") === null
    && lib.radarFormAusRolle({ impressum: { vertreter: [{ name: "Hannah Albrecht (Inhaberin)" }] } }, "Hannah Albrecht") === "Frau"
    && lib.radarFormAusRolle({ impressum: { vertreter: [{ name: "Anna Beispiel", funktion: "Geschäftsführerin" }] } }, "Max Müller") === null,
    "Anrede: „Geschäftsführerin“/„Inhaberin“ am Namen → „Frau“; männliche Form oder fremder Name → nichts geraten");
  ok(lib.anredeFuer("Hannah Albrecht", "Frau") === "Hallo Frau Albrecht," && lib.anredeFuer("Petra Brandt", "Frau", { partner: true }) === "Guten Tag Frau Brandt,", "„Hallo Frau Albrecht,“ statt „Guten Tag Hannah Albrecht,“");
  // ── Klartext statt roher Gmail-Fehler; was der Motor gerade tut ──
  ok(sh8.radarFehlerKlartext('Gmail js@fiaon.com /messages/send: HTTP 429 {"code":429,"message":"User-rate limit exceeded"}') === "Gmail bremst kurz (zu viele Mails in kurzer Zeit)"
    && sh8.radarFehlerKlartext("Token für js@fiaon.com: HTTP 401 {}") === "Gmail-Zugang abgelaufen oder gesperrt" && sh8.radarFehlerKlartext("fetch failed") === "Gmail kurz nicht erreichbar"
    && sh8.radarFehlerKlartext("Gmail js@fiaon.com /messages/send: HTTP 400 Invalid To header") === "Gmail hat diese Mail abgelehnt",
    "Gmail-Fehler in einfachen Worten (429, Token, Netz, Ablehnung) — keine Rohmeldung in Kachel und Akte");
  ok(!/Sendet wieder ab \$\{uhr\} Uhr: \$\{s\.grund\}/.test(mo) && /radarFehlerKlartext\(grund\)\.slice\(0, 200\)/.test(mo), "Störung des Postfachs wird in Klartext gespeichert und gezeigt");
  const pfl = (x: Record<string, unknown> = {}) => ({ adresse: "js@fiaon.com", grenze: 20, heute: 0, reserve: 0, bereit: true, ...x });
  const lage = (x: Record<string, unknown>) => sh8.radarMotorLage({ an: true, freigabe: true, imFenster: true, schlange: 3, von: "07:00", postfaecher: [pfl()], ...x } as any);
  ok(lage({ freigabe: false }).chip === "wartet auf deine Freigabe" && !lage({ freigabe: false }).senden && lage({ an: false }).chip === "aus" && lage({ imFenster: false }).chip === "bereitet vor",
    "Motor-Lage: Freigabe, Schalter, Fenster");
  const voll = lage({ postfaecher: [pfl({ heute: 75, grenze: 60 })] });
  const stoer = lage({ postfaecher: [pfl({ pause: true, ruhtBis: "2026-10-29T16:13:00Z", ruhtGrund: "Gmail bremst kurz (zu viele Mails in kurzer Zeit)" })] });
  ok(voll.chip === "für heute voll" && /75 von 60/.test(String(voll.grund)) && /Morgen ab 07:00 Uhr/.test(String(voll.grund)) && !voll.senden, `„heute möglich 0“ sagt den wahren Grund (${voll.grund})`);
  ok(stoer.chip === "Störung bis 17:13" && /Gmail bremst kurz/.test(String(stoer.grund)) && !stoer.senden && lage({ schlange: 0 }).chip === "Warteschlange leer" && lage({}).senden && lage({}).chip === "sendet gerade",
    "Motor-Lage: Störung mit Uhrzeit, leere Warteschlange, sendet gerade");
  // ── Freigabe, Hochfahren ab Freigabe, Ableitung in der ersten Woche ──
  const mFrei = sh8.radarMotorLesen({ radar_motor_freigabe: "2026-10-30T06:00:00Z" });
  ok(sh8.radarMotorLesen({}).freigabeAm === null && mFrei.freigabeAm === "2026-10-30T06:00:00.000Z" && sh8.radarMotorLesen({ radar_motor_freigabe: "quatsch" }).freigabeAm === null, "Freigabe lesen: ohne Wert keine, Unsinn keine");
  ok(sh8.radarPostfachStart(null, mFrei.freigabeAm) === null && sh8.radarPostfachStart("2026-09-19T08:00:00Z", mFrei.freigabeAm)?.toISOString() === "2026-10-30T06:00:00.000Z"
    && sh8.radarPostfachStart("2026-11-05T08:00:00Z", mFrei.freigabeAm)?.toISOString() === "2026-11-05T08:00:00.000Z",
    "Hochfahren: ohne Geschichte Woche 1; mit Geschichte frühestens ab der Freigabe (js@ seit 19.09. → ab Freigabe)");
  const js = sh8.radarPostfachGrenze({ ersterVersand: sh8.radarPostfachStart("2026-09-19T08:00:00Z", mFrei.freigabeAm), jetzt: new Date("2026-10-30T12:00:00Z"), jeTag: 60, rampe: [20, 40] });
  ok(js === 20 && sh8.radarPostfachGrenze({ ersterVersand: "2026-09-19T08:00:00Z", jetzt: new Date("2026-10-30T12:00:00Z"), jeTag: 60, rampe: [20, 40] }) === 60, `js@ fährt ab der Freigabe hoch: Woche 1 → ${js} statt sofort 60`);
  ok(/radarPostfachGrenze\(\{ ersterVersand: radarPostfachStart\(g\?\.erster \?\? null, m\.freigabeAm\)/.test(mo), "postfachLagen rechnet das Hochfahren ab der Freigabe");
  ok(sh8.radarAbleitungAnteilJetzt({ ...mFrei, ableitungAnteil: 50, ableitungAnteilEigen: false }, new Date("2026-11-02T12:00:00Z")) === 20
    && sh8.radarAbleitungAnteilJetzt({ ...mFrei, ableitungAnteil: 50, ableitungAnteilEigen: false }, new Date("2026-11-08T12:00:00Z")) === 50
    && sh8.radarAbleitungAnteilJetzt({ ...mFrei, ableitungAnteil: 50, ableitungAnteilEigen: true }, new Date("2026-11-02T12:00:00Z")) === 50
    && sh8.radarMotorLesen({ radar_ableitung_anteil: "35" }).ableitungAnteilEigen && !sh8.radarMotorLesen({}).ableitungAnteilEigen,
    "Ableitung: erste Woche nach der Freigabe höchstens 20 %, danach 50 %; ausdrücklich gesetzt gilt der eigene Wert");
  ok(/if \(!m\.freigabeAm && !opt\.ohneHauptschalter\) return \{ \.\.\.erg, aus: true, grund: "wartet auf Justins Freigabe" \}/.test(mo) && /if \(!m\.freigabeAm\) return \{ \.\.\.erg, grund: "wartet auf Justins Freigabe" \}/.test(mo),
    "Vor der Freigabe: keine Vorbereitung von selbst, kein Versand (auch nicht „Jetzt eine senden“)");
  ok(/radarMotorVorbereiten\(\{ max: 3, ohneHauptschalter: true \}\)/.test(rt) && /ON CONFLICT \(key\) DO UPDATE SET value = fiaon_settings\.value RETURNING value/.test(mo), "„3 Mails vorbereiten“ geht vor der Freigabe; die Freigabe wird nie überschrieben");
  ok(/Freigeben und starten/.test(ui) && /3 Mails vorbereiten/.test(ui) && /Freigeben und starten/.test(rg), "Chefbüro und Rundgang: Freigabe-Kasten mit „3 Mails vorbereiten“ und „Freigeben und starten“");
  // ── KI-Geld: Antworten zahlen aus „Antworten an Menschen“, Vorbereitung höchstens kiAnteil % des B2B-Topfs ──
  ok(lib.radarKiDienst("radar_antwort") === "radar-antwort" && lib.radarKiDienst("radar_mara") === "radar-antwort" && lib.radarKiDienst("radar_mail") === "radar" && lib.radarKiDienst("radar_pruef") === "radar",
    "Antworten einordnen und Maras Antwort laufen als eigener Dienst „radar-antwort“");
  ok(kasse.bereichFuer("radar-antwort") === "menschen" && kasse.bereichFuer("global-berater") === "menschen" && kasse.bereichFuer("radar") === "b2b" && kasse.bereichFuer("radar_irgendwas") === "b2b",
    "KI-Kasse: Radar-Antworten und Fach-Chat der Global-Kunden = Antworten an Menschen (Vorrang); Radar-Vorbereitung bleibt B2B");
  ok(/const heute = dienst === "radar" \? await kostenHeute\("radar"\)/.test(rq) && /openaiFetch\(dienst, "\/responses"/.test(rq), "Der Radar-Deckel gilt nicht für Antworten an Menschen");
  ok(sh8.radarMotorLesen({}).kiAnteil === 60 && sh8.radarMotorLesen({ radar_motor_ki_anteil: "5" }).kiAnteil === 60 && sh8.radarMotorLesen({ radar_motor_ki_anteil: "40" }).kiAnteil === 40, "KI-Anteil der Vorbereitung: Vorgabe 60 %, 10–100");
  ok(/const geld = await radarVorbereitungGeld\(m\);\s*if \(!geld\.frei\)/.test(mo) && /const geld = await radarVorbereitungGeld\(motor\);\s*if \(!geld\.frei\) \{ fehler = geld\.grund; break; \}/.test(rq), "Vor jeder Runde des Motors und vor jedem Suchlauf: KI-Geld der Vorbereitung geprüft");
  // ── Vorrat: EINE Definition; Altlasten zuletzt und ohne zweite bezahlte Websuche ──
  ok(/WHERE \$\{sqlMotorVorrat\(abPassung, motor\.partnerGruppen\)\} OR motor_status IN \('arbeit', 'bereit'\)/.test(rq) && (mo.match(/sqlMotorVorrat\(a\.abPassung, m\.partnerGruppen\)/g) ?? []).length === 2,
    "Vorrat gezählt wie der Motor auswählt — im Tageslauf (Firmen vs. Partner), im Motor und im Chefbüro");
  const jetzt = new Date("2026-10-30T10:00:00Z");
  ok(lib.radarWebsucheErfolglos({ entscheider: null, entscheider_am: "2026-10-20T10:00:00Z", automatik_am: "2026-10-20T10:00:00Z" }, jetzt)
    && !lib.radarWebsucheErfolglos({ entscheider: null, entscheider_am: "2026-10-20T10:00:00Z", automatik_am: null }, jetzt)
    && !lib.radarWebsucheErfolglos({ entscheider: null, entscheider_websuche_am: "2026-09-10T10:00:00Z" }, jetzt)
    && !lib.radarWebsucheErfolglos({ entscheider: { name: "X" }, entscheider_websuche_am: "2026-10-29T10:00:00Z" }, jetzt),
    "Altlast: Websuche (alter Lauf oder Motor) in den letzten 30 Tagen ohne Ergebnis → keine zweite bezahlte Suche");
  ok(/const websucheVergeblich = radarWebsucheErfolglos\(f\);\s*await schritte\.entscheider\(id, false\);/.test(mo) && /if \(!persoenlich\(f\) && !websucheVergeblich\) \{ await schritte\.entscheider\(id, true\);/.test(mo)
    && mo.indexOf("await schritte.entscheider(id, false)") < mo.indexOf("await schritte.scannen(id)"), "Erst die kostenlosen Schritte (Website, Ableitung), dann die Websuche (nicht doppelt), erst mit Adresse der bezahlte Scan");
  ok(/SET entscheider_websuche_am = NOW\(\) WHERE id = \$\{id\}/.test(lies("server/lib/fiaon-radar-entscheider.ts")), "Die bezahlte Websuche merkt sich ihr Datum");
  ok(/COUNT\(\*\) FILTER \(WHERE motor_status = 'bereit' AND COALESCE\(entscheider->>'weg', ''\) = 'abgeleitet'\)::int AS abgeleitet/.test(mo) && /Math\.min\(Number\(z\.abgeleitet\)/.test(mo),
    "Puffer: abgeleitete Mails zählen nur bis zu ihrem erlaubten Anteil (keine Warteschlange, die stillsteht)");
  // ── Derselbe Mensch, bekannte Kunden und Partner, Österreich-Adresse, Nachfassen ──
  ok(sh8.radarPersonSchluessel("Dr. Petra Brandt") === "petra brandt" && sh8.radarPersonSchluessel("Brandt") === "" && sh8.radarGleicherBetrieb({ ort: "Freiburg im Breisgau", domain: "a.example" }, { ort: "Freiburg", domain: "b.example" })
    && sh8.radarGleicherBetrieb({ domain: "kornblume-backstuben.example" }, { domain: "kornblume.example" }) && !sh8.radarGleicherBetrieb({ ort: "Ulm", domain: "kanzlei-meier.example" }, { ort: "Köln", domain: "kanzlei-schulz.example" }),
    "Derselbe Mensch: Name als Schlüssel; gleicher Betrieb über Ort oder Domänen-Kern („kanzlei“ zählt nicht)");
  ok(/const doppelt = await radarSchonAngeschrieben\(f, an, person\);/.test(rq) && /const bekannt = await partnerModul\.schonBekannt\(/.test(rq) && /if \(\/\\\.at\$\/i\.test\(an\)\) throw new RadarFehler/.test(rq),
    "Beim Senden: derselbe Mensch nie zweimal, bekannte Kunden/Tippgeber/Partner nie, keine Adresse auf .at");
  ok(/AND NOT EXISTS \(SELECT 1 FROM fiaon_radar_firmen y WHERE y\.id <> r\.id AND y\.versendet_am IS NOT NULL AND r\.email IS NOT NULL AND lower\(y\.email\) = lower\(r\.email\)\)/.test(mo), "Vorbereiten: an diese Adresse ging schon eine erste Mail → gar nicht erst vorbereiten");
  const paQ = lies("server/lib/fiaon-radar-partner.ts");
  ok(/FROM fiaon_global_angebote/.test(paQ) && /FROM fiaon_global_konten/.test(paQ) && /FROM fiaon_persons WHERE primary_email/.test(paQ) && /t\.quelle = 'global'/.test(paQ) && /FROM fiaon_koop_empfehlungen/.test(paQ) && /bekannteDomains\(\)/.test(rq),
    "Bekannte: Global-Angebote (auch IA-KOOP-Tippgeber mit Freemail, über den Namen), Konten, Global-Bucher, Kunden, Empfehlungen — auch bei der Suche ausgeschlossen");
  ok(/if \(radarSendeFehlerArt\(e\) !== "unklar"\) await nachfassStufeZurueck\(Number\(f\.id\), stufe\);/.test(fq) && /nachfass_faellig = NULL, updated_at = NOW\(\) WHERE id = \$\{firmaId\}/.test(fq),
    "Nachfassen: gescheiterte Stufe kommt zurück; schreibt ein Mensch selbst im Faden, endet das automatische Nachfassen");
  // ── Chefbüro ──
  ok(/const an = !!a && \(a\.versand \|\| a\.nachfass\);/.test(ui) && !/mara: "auto" \} : \{ versand: false/.test(ui), "Not-Aus: der große Schalter zeigt „an“, solange irgendetwas sendet; Einschalten ändert „Mara antwortet“ nicht");
  ok(/<SuchFenster start=\{suchen\}/.test(ui) && /useState<"firma" \| "partner">\(start\)/.test(ui) && /\.\.\.RADAR_LAENDER_AKTIV\.map/.test(ui) && !/\["AT", "AT"\]/.test(ui), "„Partner suchen“ öffnet die Partnersuche; kein „AT“ mehr im Suchfenster");
  ok(/className="cr-mara-frage" data-volltext/.test(ui) && /<Kippe an=\{!p\.aus\}/.test(ui) && /radarPostfachSchalten/.test(rt) && /cr-motor-chip/.test(ui) && /set\("motor", motorFilter\)/.test(ui) && /motor_status = \$\{motor\}/.test(rq),
    "Chefbüro: Einschalt-Frage ganz lesbar, Postfach-Schalter nur für die eigene Pause, Motor-Stand in der Liste mit Filter");
  ok(/Erste Mails je Stunde heute/.test(ui) && /cr-motor-ziel/.test(ui) && /Partnersignal/.test(ui) && /"Geschäftspartner"\]/.test(ui) && /sendenGesperrt/.test(ui) && /KI heute<\/dt><dd>[^<]*\$<\/dd>/.test(ui),
    "Chefbüro: Stunden-Leiste mit Überschrift und Ziel-Linie, Partner-Wörter, Senden nur mit Unterschrift und Freigabe, KI in Dollar");
  ok(/raum="firmen-radar-2"/.test(ui) && /Reiter „Automatik“/.test(rg), "Rundgang: neuer Merker (alle sehen die neuen Schritte einmal), Schritte nennen den Reiter „Automatik“");
}

abschnitt("Ergebnis");
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
