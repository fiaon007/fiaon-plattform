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
import { RADAR_BEREICHE, RADAR_STATUS, RADAR_GRUPPEN, RADAR_STAPEL_MAX, radarDomain, alsRadarLand, radarBereich } from "../shared/fiaon-radar";
import { GLOBAL_SEITEN } from "../shared/fiaon-global-seiten";
import { FIAON_FIRMA } from "../shared/fiaon-firma";

// Die Datenbank-Anbindung verlangt beim Laden eine Adresse — abgefragt wird hier nie („ins Leere").
process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
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
const sauber = { betreff: "Silberhorn und die USA: eine kurze Idee", absaetze: ["Ein Satz über die Firma mit genug Inhalt für die Prüfung.", "Der Kapitalrahmen ist ein Ziel; über Rahmen und Bedingungen entscheidet das jeweilige Institut."], frage: "Passt ein kurzes Gespräch?", ps: "" };
ok(mailPruefen(sauber).sperrend.length === 0, `Saubere Mail sperrt nicht (${mailPruefen(sauber).sperrend.join("; ")})`);
ok(mailPruefen({ ...sauber, absaetze: ["Sie bekommen bis zu 250.000 $ Kapital, das Institut entscheidet."] }).sperrend.length > 0, "„bis zu“ sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Wir öffnen Ihnen einen Kapitalrahmen von 250.000 $."] }).sperrend.some((x) => /Institut/.test(x)), "Kapital ohne Institutssatz sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Die Karte kommt garantiert, das Institut entscheidet."] }).sperrend.length > 0, "„garantiert“ sperrt");
ok(mailPruefen({ ...sauber, absaetze: ["Ich hoffe, es geht Ihnen gut! Wir sind innovativ."] }).warnungen.length >= 2, "Floskel und Ausrufezeichen werden gemeldet");
const links = { gespraech: "https://fiaon.com/business?utm_source=radar#gespraech", seite: "https://fiaon.com/business" };
const html = mailHtml({ anrede: "Guten Tag <b>X</b>,", absaetze: ['<script>alert(1)</script> & "Zitat"'], frage: "Passt es?", ps: "<img src=x onerror=alert(1)>", links });
ok(!/<script|<img|onerror=alert\(1\)>/i.test(html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/, "")) && html.includes("&lt;script&gt;"), "HTML ist maskiert — kein eingeschleuster Code");
ok(!/<img\b/i.test(html) && !/background-image/i.test(html), "Keine Bilder — die Mail sieht aus wie eine persönliche Mail");
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
ok(Object.keys(RADAR_STATUS).length === 9, "Neun Stände");
const inGruppen = new Set(RADAR_GRUPPEN.flatMap((g) => g.stati));
ok(Object.keys(RADAR_STATUS).every((st) => inGruppen.has(st as any)), "Jeder Stand liegt in einem Reiter");
ok(RADAR_STAPEL_MAX > 0 && RADAR_STAPEL_MAX <= 50, "Stapel bleibt klein genug für persönliche Mails");

abschnitt("Quelltext-Wände");
const routen = lies("server/routes/fiaon-radar.ts");
const wege = routen.split("\n").filter((z) => /^router\.(get|post|put|delete)\(/.test(z));
ok(wege.length >= 11 && wege.every((z) => z.includes(", wache,")), `Jede Route hinter der Wache (${wege.length} Wege)`);
ok(/requireChef\("geschaeftsfuehrung"\)/.test(routen), "Wache = Geschäftsführung");
ok(/art === "senden" && req\.body\?\.bestaetigt !== true/.test(routen), "Senden nur mit Bestätigung");
const lib = lies("server/lib/fiaon-radar.ts");
ok(!/JSON\.stringify\([^)]*\)\}::jsonb/.test(lib), "JSONB nie als JSON-Text mit ::jsonb");
ok(/je Firma genau eine/.test(lib) && /f\.status === "versendet" \|\| f\.versendet_am/.test(lib), "Je Firma genau eine erste Mail");
ok(/radarPostfaecher\(\)\.includes\(postfach\)/.test(lib), "Nur freigegebene Postfächer");
ok(/await gesperrt\(an, f\.domain\)/.test(lib), "Sperrliste vor jedem Versand");
ok(/f\.mail\.sperrend\?\.length/.test(lib), "Wortwand-Funde sperren Entwurf und Versand");
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
