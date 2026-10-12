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
ok(Object.keys(RADAR_STATUS).length === 15, "Fünfzehn Stände bis zum Kauf (E-337)");
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
ok(/frisch = Date\.now\(\) - n\.datum\.getTime\(\) < 48/.test(faden) && /if \(!frisch\) return/.test(faden), "Beim Nachholen alter Antworten keine Mara-Antwort und keine Aufgabe");
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
ok(/r\.signal_staerke IS NULL OR r\.signal_staerke >= \$\{RADAR_SIGNAL_AB\}/.test(lies("server/lib/fiaon-radar-faden.ts")) && /< RADAR_SIGNAL_AB\) \{ erg\.uebersprungen/.test(lies("server/lib/fiaon-radar-faden.ts")), "Automatik schreibt nur ab Signalstärke 3");

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

abschnitt("Ergebnis");
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
