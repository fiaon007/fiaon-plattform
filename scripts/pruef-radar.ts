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
ok(html.includes(FIAON_FIRMA.companyNo) && html.includes("Kein Thema für Sie?") && html.includes(FIAON_FIRMA.name), "Fuß mit Firma, Registernummer und Abmeldesatz");
const text = mailText({ anrede: "Guten Tag,", absaetze: ["A"], frage: "B?", ps: "", links });
ok(text.includes(links.gespraech) && text.includes(FIAON_FIRMA.companyNo) && text.includes("Kein Thema für Sie?"), "Textfassung trägt Link, Firma und Abmeldesatz");

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
ok(/radarSendefenster\(jetzt\)/.test(faden) && /if \(erg\.aus\) return/.test(faden), "Versand nur mit Schalter und im Sendefenster");
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
ok(/r\.signal_staerke IS NULL OR r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(lies("server/lib/fiaon-radar-faden.ts")) && /< RADAR_SIGNAL_AB\) \{[\s\S]{0,600}erg\.uebersprungen\+\+; continue;/.test(lies("server/lib/fiaon-radar-faden.ts")), "Automatik schreibt nur ab Signalstärke 3");

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
ok(/signaturHtml\(\{ person: "justin"/.test(lies("server/lib/fiaon-radar.ts")), "Die erste Mail trägt Justins Karte");
ok((lies("server/lib/fiaon-radar-faden.ts").match(/htmlAusText\(/g) ?? []).length >= 3, "Nachfass, Maras Antwort und Freigabe senden mit Karte");
ok(fs.existsSync(path.join(wurzel, "client/public/mail/signatur/mara.png")) && fs.existsSync(path.join(wurzel, "client/public/mail/signatur/linie.gif")), "Signaturbilder liegen öffentlich bereit");
ok(/radarAdressePersoenlich\(an, namen\)/.test(lies("server/lib/fiaon-radar.ts")), "Wand beim Senden: nur persönliche Adresse eines Entscheiders");
ok(/entscheiderFinden\(id, \{ websuche: false \}\)/.test(lies("server/lib/fiaon-radar-faden.ts")) && /entscheiderFinden\(id, \{ websuche: true \}\)/.test(lies("server/lib/fiaon-radar-faden.ts")), "Automatik: Entscheider erst Website, dann (nach Signal) Websuche");
ok(mailPruefen({ ...sauber, absaetze: ["Das ist ein sehr langer Satz mit wirklich vielen Wörtern, der sich überhaupt nicht wie eine menschliche Mail liest, sondern wie ein Prospekt aus einer Agentur."] }).warnungen.some((x) => /24 Wörter/.test(x)), "Lange Sätze werden gemeldet");

abschnitt("Archiv und „nur qualifiziert“ (E-337)");
const libA = lies("server/lib/fiaon-radar.ts"), fadenA = lies("server/lib/fiaon-radar-faden.ts"), briefA = lies("server/lib/fiaon-radar-brief.ts");
ok(RADAR_GRUPPEN[0].key === "qualifiziert" && RADAR_GRUPPEN.some((g) => g.archiv), "Startreiter „Qualifiziert“, eigener Reiter „Archiv“");
ok(/\(archiviert_am IS NOT NULL\) = \$\{archiv\}/.test(libA), "Die Liste zeigt Archiv und Bestand getrennt");
ok(/r\.archiviert_am IS NULL/.test(fadenA) && /archiviert_am IS NULL/.test(briefA), "Archivierte Firmen bekommen weder Mail noch Brief");
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
  ok(/Wiedervorlage \(E-361\)[\s\S]{0,900}wiedervorlage_am = NULL WHERE id = \$\{w\.id\} AND wiedervorlage_am <= NOW\(\) RETURNING id/.test(fd), "Wiedervorlage: atomar geholt, dann schreibt Mara im Faden");
  ok(/const plan = radarPlan\(\{/.test(fd) && /if \(plan\.buchen\)/.test(fd), "Der Wächter entscheidet über radarPlan — dieselbe Regel wie „Mara testen“");
  const rt = lies("server/routes/fiaon-radar.ts");
  ok(/"\/chef\/radar\/mara-probe", wache/.test(rt) && /"\/chef\/radar\/mara-szenarien", wache/.test(rt) && /"\/chef\/radar\/post\/:id\/termin", wache[\s\S]{0,120}bestaetigt !== true/.test(rt), "Neue Routen hinter der Wache, Termin nur mit Bestätigung");
  const ui = lies("client/src/components/admin/ChefRadar.tsx");
  ok(/<MaraTesten \/>/.test(ui) && /Alle \$\{RADAR_SZENARIEN\.length\} Szenarien prüfen/.test(ui) && /Termin \{wunschLesbar\(p\.wunsch_termin!\)\} eintragen/.test(ui), "Chefbüro: „Mara testen“, „Alle Szenarien prüfen“, „Termin eintragen“");
}

abschnitt("Ergebnis");
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
