// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-476 Scheibe 3 (05.11.2026): DER LEAD-WEG — ein Kalender, der bucht (Gespräch bei Justin, persönlicher
// Link, Cockpit-Knopf, /justin-Weiche, „Termin steht“, Anruf-Karte, Mara-Weiche) — mit den Gutachten-Pflichten.
//
//   A  REIN (immer, ohne Datenbank, ohne Netz): /g-Weiche (Radar-Code, Lead-Code, Unsinn), Code-Form, „Gespräche führt“
//      (leer → Justin, „zustaendig“, Konto, Unsinn), Deckel (Lead, Gesamt, Startgespräch immer frei), zweiter Deckel,
//      Pflicht-Notiz, Gesprächshilfe und Paket-Idee (alle Rahmen-Optionen), D2/D3 (Links nur aus der Liste, kein Bank-Satz,
//      fremde Adressen entschärft, Faden), Datenschutz-Satz (Justins Wortlaut, deutsch + britisch), die Bestätigung
//      global_termin (Sie-Form, FIAON Global, KEIN Institut-Satz, kein „Bonität ist machbar“, de + en), Wortwand der neuen
//      Kundensätze, Quelltext-Wände (kein ARAS für Leads, keine DDL im Eingang, Beanspruchung vor der Annahme, 0c nach 0b).
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): echte Funktionen mit
//      erfundenen Menschen (*.example): Lead → Code → Vorlage → Buchung bei der Kalender-Person (Testkonto wie Justins);
//      Anfrage auf „termin“, Auftrag zu, Firma verknüpft, kein Auftrag an Justin; falscher/abgelaufener Code → normale
//      Fläche; Doppelbuchung; Lead-Deckel; Gesamtdeckel; „zustaendig“ → altes Verhalten; Buchung ohne Link per Mail
//      zugeordnet; Anfrage NACH der Buchung → kein Anruf-Auftrag; Cockpit-Knopf (agent_global, Notiz in D2); D2 genau
//      einmal; D3 genau einmal; Ergebnis-Rückfrage an die zuständige Person (nicht vor 9 Uhr am nächsten Werktag);
//      /justin-Weiche (Business-Lead → Global-Gespräch, Privat → unverändert); Mara-Weiche 0c (Lead ja, zahlende
//      Privatkundin nein); zwei gleichzeitige Meta-Eingänge → EINE Anfrage; Danke-Knopf-Auflösung; Kalender-Zusatz.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-lead-weg.ts   (nur A)
//   createdb -T fiaon_pruefstand fiaon_pruefstand_lw3 …; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_lw3?sslmode=require'   (A + B), danach dropdb.
//
// Verschickt nichts: Schlüssel in der Umgebung → Abbruch; Mails an Justin über die Attrappe (leadWegVersandSetzen),
// Kundenmails ohne Brevo-Schlüssel (Protokoll „fehlgeschlagen“). Repo öffentlich: nur erfundene Menschen (*.example).
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

const W = await import("../shared/fiaon-lead-weg");
const LW = await import("../server/lib/fiaon-lead-weg");
const Z = await import("../server/lib/fiaon-global-zeiten");
const { mailRendern } = await import("../server/mail/motor");
const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { globalWortPruefen } = await import("../shared/fiaon-global-wortregeln");
const { radarBankVorbehalt } = await import("../shared/fiaon-radar");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 /g-Weiche und der persönliche Link");
gleich(W.gPfadArt("r12345"), "radar", "r<Ziffern> bleibt der Radar-Link (schon verschickte Kaltmails)");
gleich(W.gPfadArt("aB3kMn7pQ2"), "lead", "10 Zeichen aus dem Alphabet = persönlicher Link");
gleich(W.gPfadArt("aB3kMn7pQ"), "unbekannt", "9 Zeichen = unbekannt");
gleich(W.gPfadArt("aB3kMn7pQ0"), "unbekannt", "„0“ gehört nicht zum Alphabet (verwechselbar)");
gleich(W.gPfadArt("../etc/pwd"), "unbekannt", "Unsinn = unbekannt");
gleich(W.gPfadArt("r12a"), "unbekannt", "r + Buchstaben ist weder Radar noch Lead");
ok(W.leadLinkUrl("aB3kMn7pQ2") === "https://fiaon.com/g/aB3kMn7pQ2", "Link: fiaon.com/g/<code> — keine Kundendaten in der Adresse");
ok(Math.pow(W.LEAD_CODE_ZEICHEN.length, W.LEAD_CODE_LAENGE) > 1e17, "nicht erratbar (56^10 > 10^17)");
gleich(W.LEAD_WEG_VORGABE.codeTage, 30, "Link gilt 30 Tage");
gleich(W.metaLeadKennung("123456789012345"), "123456789012345", "Meta-Lead-Kennung (Ziffern)");
gleich(W.metaLeadKennung("{{lead_id}}"), null, "nicht ersetzter Platzhalter = keine Kennung");
gleich(W.META_DANKE_URL, "https://fiaon.com/gb?lid={{lead_id}}", "Danke-Knopf der Fassung 2");
ok(W.META_FASSUNG2_NAMEN.kapital.startsWith("FIAON Global") && W.META_FASSUNG2_NAMEN.us.startsWith("FIAON Global"), "Fassung 2 beginnt mit „FIAON Global“ (sonst keine Weiche)");

abschnitt("A2 „Gespräche führt“ und die Deckel");
ok(JSON.stringify(W.kalenderWahlLesen("", 928)) === JSON.stringify({ art: "vorgabe", agentId: 928 }), "leer → Vorgabe Justin (Entscheidung 1A)");
ok(JSON.stringify(W.kalenderWahlLesen(null, 928)) === JSON.stringify({ art: "vorgabe", agentId: 928 }), "fehlt → Vorgabe Justin");
ok(JSON.stringify(W.kalenderWahlLesen("zustaendig", 928)) === JSON.stringify({ art: "zustaendig", agentId: null }), "„zustaendig“ → wie vor E-476");
ok(JSON.stringify(W.kalenderWahlLesen("8", 928)) === JSON.stringify({ art: "konto", agentId: 8 }), "Zahl → dieses Konto");
ok(W.kalenderWahlLesen("drop table", 928).art === "vorgabe", "Unsinn → Vorgabe");
gleich(W.LEAD_WEG_VORGABE.leadProTag, 3, "Lead-Deckel Vorgabe 3 (Entscheidung 1A)");
gleich(W.deckelLesen("", 3), 3, "leer → Vorgabe");
gleich(W.deckelLesen("13", 3), 3, "über 12 → Vorgabe");
gleich(W.deckelLesen("2", 3), 2, "2 → 2");
gleich(W.tagesRest({ leadProTag: 3, gesamtProTag: 5, leadGebucht: 3, gesamtGebucht: 3 }), 0, "drei Leads → Tag zu");
gleich(W.tagesRest({ leadProTag: 3, gesamtProTag: 5, leadGebucht: 1, gesamtGebucht: 5 }), 0, "Gesamtdeckel voll (/justin + Leads) → Tag zu");
gleich(W.tagesRest({ leadProTag: 3, gesamtProTag: 5, leadGebucht: 1, gesamtGebucht: 2 }), 2, "Rest = Minimum beider Deckel");
const t = (quelle: string, herkunft: string | null, status = "gebucht") => ({ quelle, herkunft, status });
ok(W.zaehltAufLeadDeckel(t("global", "global_seite")) && W.zaehltAufLeadDeckel(t("global", "global_link")) && W.zaehltAufLeadDeckel(t("global", "agent_global")), "Lead-Deckel zählt Kalender, Link, Cockpit");
ok(!W.zaehltAufLeadDeckel(t("global", "individualangebot")), "Startgespräch zählt NIE auf den Lead-Deckel");
ok(W.zaehltAufLeadDeckel(t("global", "gruender_global")), "/justin-Weiche zählt auf den Lead-Deckel — Entscheidung 1A „höchstens drei Global-Gespräche am Tag“ (Gutachten Technik, Mangel 5)");
ok(W.zaehltAufGesamtDeckel(t("gruender", "gruender_seite")) && W.zaehltAufGesamtDeckel(t("global", "gruender_global")) && W.zaehltAufGesamtDeckel(t("global", "global_seite")), "Gesamtdeckel: /justin + Leads");
ok(!W.zaehltAufGesamtDeckel(t("global", "individualangebot")) && !W.zaehltAufGesamtDeckel(t("global", "global_seite", "abgesagt")), "Gesamtdeckel ohne Startgespräch und ohne Absage");
ok(W.istLeadGespraech(t("global", "gruender_global")) && !W.istLeadGespraech(t("gruender", "gruender_seite")) && !W.istLeadGespraech(t("global", "individualangebot")), "Lead-Gespräch erkannt");

abschnitt("A3 Kalender: Lead-Deckel, zweiter Deckel, Startgespräch immer buchbar");
{
  // Ein Werktag in der Zukunft, ohne Uhr: Dienstag, 10.11.2026, Fenster 9–17 Uhr.
  const jetzt = new Date("2026-11-09T07:00:00Z");
  const fenster = [1, 2, 3, 4, 5].map((wochentag) => ({ wochentag, von: "09:00", bis: "17:00", aktiv: true }));
  const tag = "2026-11-10";
  // Berliner Wandzeit im November (MEZ = UTC+1).
  const um = (h: number, m = 0) => new Date(`${tag}T${String(h - 1).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const leads = [um(9), um(10), um(11)].map((b) => ({ beginn: b, dauerMin: 30, zaehltAlsGlobal: true }));
  const e1 = Z.globalZeitenRechnen({ jetzt, fenster, belegt: leads, tage: 3, proTag: 3 });
  ok(!e1.frei.some((f) => f.tag === tag), "drei Lead-Gespräche → keine weitere Lead-Zeit an diesem Tag");
  ok(e1.frei.some((f) => f.tag === "2026-11-11"), "der nächste Tag ist offen");
  // Startgespräch: Lead-Gespräche sperren nur ihre ZEIT, nie den PLATZ (zaehltAlsGlobal = false).
  const SG = await import("../server/lib/fiaon-global-angebot-startgespraech");
  const sg = SG.startgespraechZeitenRechnen({ ab: jetzt, fenster, proTag: 3, belegt: leads.map((l) => ({ ...l, zaehltAlsGlobal: false })) });
  ok(sg.frei.some((f) => f.tag === tag) && !sg.frei.some((f) => f.tag === tag && ["09:00", "10:00", "11:00"].includes(f.zeit)), "Startgespräch bucht trotzdem am selben Tag — nur die belegten Zeiten fehlen");
  // Zweiter Deckel (Gesamtdeckel)
  const e2 = Z.globalZeitenRechnen({ jetzt, fenster, belegt: [], tage: 3, proTag: 3 });
  const e3 = Z.zweitenDeckelAnwenden(e2, { [tag]: 0, "2026-11-11": 1 });
  ok(!e3.frei.some((f) => f.tag === tag) && e3.restJeTag[tag] === undefined, "Gesamtdeckel 0 → Tag fällt weg");
  gleich(e3.restJeTag["2026-11-11"], 1, "Gesamtdeckel 1 → Rest 1");
  ok(Z.globalAngebot(e3).find((x) => x.tag === "2026-11-11")?.zeiten.length === 1, "Angebot zeigt dann genau eine Zeit");
}

abschnitt("A4 Pflicht-Notiz (Cockpit-Knopf)");
{
  const zuKurz = W.erzaehltPruefen({ text: "Interesse.", einschaetzung: "heiss" });
  ok(!zuKurz.ok && zuKurz.feld === "erzaehlt", "ohne zwei, drei Sätze → Fehler (Pflicht)");
  const ohneE = W.erzaehltPruefen({ text: "Inhaber einer Spedition, will Kapital für den Fuhrpark und eine Niederlassung in Florida.", einschaetzung: "" });
  ok(!ohneE.ok && ohneE.feld === "einschaetzung", "ohne Einschätzung → Fehler");
  const abc = W.erzaehltPruefen({ text: "Inhaber einer Spedition, will Kapital für den Fuhrpark und eine Niederlassung in Florida.", einschaetzung: "A" });
  ok(!abc.ok, "„A“ ist keine Einschätzung (A/B/C sind die Kundenstufen)");
  const gut = W.erzaehltPruefen({ text: "Inhaber einer Spedition, will Kapital für den Fuhrpark und eine Niederlassung in Florida.", einschaetzung: "heiß", felder: { wohnort: "Bayern", us_bezug: "Kunden in Florida" } });
  ok(gut.ok && gut.einschaetzung === "heiss" && /Wohnort \/ Land: Bayern/.test(gut.text) && /US-Bezug: Kunden in Florida/.test(gut.text), "Notiz + kurze Felder → ein Text, „heiß“ gelesen");
}

abschnitt("A5 Gesprächshilfe und Paket-Idee (aus SEINEN Antworten)");
{
  const a = (code: string, frage: string, antwort: string) => ({ schluessel: code.replace(/_\d$/, ""), frage, antwort, code });
  const R = (n: number, text: string) => a(`kapitalrahmen_ziel_${n}`, "Welchen Kapitalrahmen planen Sie als Ziel?", text);
  gleich(W.paketIdeeAusAntworten([R(1, "50.000 $ – 100.000 $")])?.key, "global_banking", "50–100 Tsd. → Global Banking");
  gleich(W.paketIdeeAusAntworten([R(2, "100.000 $ – 250.000 $")])?.key, "global_kapital", "100–250 Tsd. → Global Kapital");
  gleich(W.paketIdeeAusAntworten([R(3, "250.000 $ – 1.000.000 $")])?.key, "global_vip", "250 Tsd.–1 Mio. → Global VIP");
  gleich(W.paketIdeeAusAntworten([R(4, "Noch offen")])?.key, "global_struktur", "Rahmen offen → Global Struktur");
  gleich(W.paketIdeeAusAntworten([a("wann_gruenden_1", "Wann möchten Sie gründen?", "So bald wie möglich")])?.key, "global_struktur", "US-Formular ohne Rahmen → Global Struktur");
  const kombis = [1, 2, 3, 4].flatMap((v) => [1, 2, 3, 4].map((s) => [a(`vorhaben_${v}`, "Was planen Sie mit Ihrer US-Gesellschaft?", "x"), R(2, "100.000 $ – 250.000 $"), a(`wann_starten_${s}`, "Wann möchten Sie starten?", "y")]));
  let alleGut = true;
  for (const k of kombis) {
    const h = W.gespraechsHilfe({ antworten: k, temperatur: "heiss" });
    const text = [h.einstieg, ...h.fragen].join(" ");
    if (h.fragen.length !== 3 || !/^„.*“$/.test(h.einstieg) || BANK_SATZ.test(text) || /\d+\s?%|Zins|Zusage|garantiert/i.test(text) || /\b(du|dich|dir|dein)\b/i.test(h.einstieg)) { alleGut = false; console.log("   ", JSON.stringify(h)); }
  }
  ok(alleGut, "alle 16 Kombinationen: Einstieg in Sie-Form mit Anführung, drei Fragen, keine Zahl/Zusage/Bank-Satz");
  const web = W.gespraechsHilfe({ antworten: [], temperatur: "warm", nachricht: "US Kontenstruktur" });
  ok(/Nachricht/.test(web.einstieg), "Website-Anfrage mit Nachricht: Einstieg greift die Nachricht auf");
}

abschnitt("A6 D2 „Termin steht“ und D3 „Anruf-Karte“ (rein)");
{
  const basis: any = {
    kontakt: { tel: { e164: "+4915100000001" }, telefonLesbar: "+49 151 00000001" },
    firma: { brauchbar: true, formular: "Pruef Logistik GmbH", anzeige: "Pruef Logistik GmbH" },
    temperatur: { wert: "heiss", grund: "will so bald wie möglich starten" },
    antworten: [
      { schluessel: "vorhaben", frage: "Was planen Sie mit Ihrer US-Gesellschaft?", antwort: "Beides", code: "vorhaben_3" },
      { schluessel: "kapitalrahmen_ziel", frage: "Welchen Kapitalrahmen planen Sie als Ziel?", antwort: "100.000 $ – 250.000 $", code: "kapitalrahmen_ziel_2" },
      { schluessel: "wann_starten", frage: "Wann möchten Sie starten?", antwort: "So bald wie möglich", code: "wann_starten_1" },
    ],
    paketwunsch: null, nachricht: null,
    fakten: { firma: "ja", firmaText: "Register: Pruef Logistik GmbH", mail: "ja", mailText: "Firmen-Domain", telefonText: "Deutschland" },
  };
  const stand: any = {
    terminId: 1, beginn: new Date("2026-11-11T13:00:00Z"), status: "gebucht", herkunft: "agent_global", agentId: 928, agentName: "Pruef Kalender",
    personId: 1, name: "Pruef Person", firma: "Pruef Logistik GmbH", email: "pruef@pruef.example", telefon: "+4915100000001",
    anfrageId: 7, firmaId: 3, weg: "agent", eingetragenVon: "Pruef Vertrieb",
    erzaehlt: [{ text: "Lebt teils in Florida, will dort eine Niederlassung. Siehe https://boese.example/x", wer: "Pruef Vertrieb", am: "2026-11-05T09:12:00Z" }],
    einschaetzung: "heiss", basis, ki: null,
    faden: { stamm: "Lead: Pruef Logistik GmbH · heiß", kopfzeilen: { "In-Reply-To": "<a@example.com>", References: "<a@example.com>" }, erste: false },
    stamm: "Lead: Pruef Logistik GmbH · heiß", cockpitUrl: "https://fiaon.com/agent/firmen?firma=3", d2Am: null, d3Am: null,
  };
  const d2 = LW.d2Mail(stand);
  gleich(d2.betreff, "Re: Lead: Pruef Logistik GmbH · heiß", "D2 im Faden des Leads (Re: + Stamm)");
  ok(d2.text.startsWith("TERMIN STEHT: Mittwoch, 11.11. um 14:00 Uhr"), "D2: erste Zeile „TERMIN STEHT“ mit Berliner Zeit (Vorschau in Gmail)");
  ok(/Pruef Vertrieb hat ihn im Gespräch erreicht und eingetragen/.test(d2.text), "D2: „eingetragen von …“ statt „selbst ausgesucht“");
  ok(/WAS ER SELBST ERZÄHLT HAT/.test(d2.text) && /https\[:\]\/\/boese\.example/.test(d2.text), "D2: Notiz drin, fremde Adresse entschärft");
  ok(/60 Minuten vorher bekommst du die Anruf-Karte/.test(d2.text), "D2 kündigt D3 an");
  ok(d2.links.every((l) => l === stand.cockpitUrl), "D2: klickbar nur das Cockpit");
  ok(!BANK_SATZ.test(d2.text) && !radarBankVorbehalt(d2.text), "D2: kein Bank-/Institut-Satz");
  const d3 = LW.d3Mail(stand, new Date("2026-11-11T12:00:00Z"));
  ok(d3.text.startsWith("ANRUF UM 14:00 UHR: Pruef Logistik GmbH — +49 151 00000001"), "D3: erste Zeile Uhrzeit, Firma, Nummer");
  ok(/in 60 Minuten rufst du/.test(d3.text), "D3: „in 60 Minuten“");
  ok(d3.knoepfe[0]?.url === "tel:+4915100000001", "D3: der tel:-Knopf ist der erste");
  ok(/FÜR DEIN GESPRÄCH/.test(d3.text) && /Frage 3:/.test(d3.text) && /Paket-Idee: Global Kapital/.test(d3.text), "D3: Einstieg, drei Fragen, Paket-Idee");
  ok(/Auftragslink zum Schicken: https:\/\/fiaon\.com\/business\/start\?paket=global_kapital/.test(d3.text), "D3: Auftragslink der Paket-Idee (Gutachten 1, Mangel 16)");
  ok(/Ergebnis eintragen: Chefbüro › Global-Kunden › Gespräche/.test(d3.text) && d3.knoepfe.some((k) => /Ergebnis eintragen/.test(k.text)), "D3: „Ergebnis eintragen“");
  ok(/keine Aufgabe für dich/.test(d3.text), "D3: keine Aufgabe an Justin");
  ok(d3.links.every((l) => [stand.cockpitUrl, "https://fiaon.com/business/start?paket=global_kapital"].includes(l) || /\/chef\/global-kunden\?gespraeche=offen$/.test(l)), "D3: klickbar nur Cockpit, Ergebnis, Auftragslink");
  ok(!BANK_SATZ.test(d3.text), "D3: kein Bank-/Institut-Satz");
  const ohneFaden = LW.d2Mail({ ...stand, faden: { stamm: null, kopfzeilen: null, erste: true }, weg: "link" });
  ok(/^Termin steht: Pruef Logistik GmbH — Mi 11\.11\., 14:00$/.test(ohneFaden.betreff), "D2 ohne Faden: eigener Betreff „Termin steht: …“");
  ok(/hat selbst über seinen persönlichen Link gebucht/.test(ohneFaden.text), "D2 (Link): „hat selbst über seinen persönlichen Link gebucht“");
  const leer = LW.d3Mail({ ...stand, erzaehlt: [], basis: null }, new Date("2026-11-11T12:05:00Z"));
  ok(/Privates \(Wohnort, Familie, Anteile\) fragst du am besten selbst/.test(leer.text) && /kein Dossier vorhanden/.test(leer.text), "D3 ohne Notiz und Dossier: ehrlicher Hinweis statt Lücke");
}

abschnitt("A7 Datenschutz-Satz (Entscheidung 4A) und Kundentexte");
{
  gleich(W.LEAD_HINTERGRUND_DATENSCHUTZ.de, "Um Ihr Gespräch vorzubereiten, prüfen wir öffentlich zugängliche Angaben zu Ihrem Unternehmen und zu Ihrer geschäftlichen Rolle darin (z. B. Handelsregister, Impressum, Presse). Dienstleister für die Websuche: OpenAI.", "Justins Wortlaut, Wort für Wort");
  ok(/OpenAI/.test(W.LEAD_HINTERGRUND_DATENSCHUTZ.en) && /commercial register/.test(W.LEAD_HINTERGRUND_DATENSCHUTZ.en) && !/\bcenter\b|\borganization\b/i.test(W.LEAD_HINTERGRUND_DATENSCHUTZ.en), "englische Fassung (britisch)");
  const privacy = lies("client/src/pages/privacy.tsx");
  ok(/LEAD_HINTERGRUND_DATENSCHUTZ\.de/.test(privacy) && /LEAD_HINTERGRUND_DATENSCHUTZ\.en/.test(privacy) && /lang="en-GB"/.test(privacy), "Datenschutzerklärung zeigt beide Fassungen (VII a Nr. 6)");
  ok(!/rufen wir Sie kurz vorher an, um den Termin zu bestätigen — auch durch ARAS/.test(privacy) && /ARAS ruft dafür nicht an/.test(privacy), "VII c: kein ARAS-Erinnerungsanruf mehr (was der Code tut)");
  const i18n = lies("client/src/i18n/global.ts");
  const de = /persoenlich: "([^"]+)"/.exec(i18n)?.[1] ?? "", en = /persoenlich: "(Your[^"]+)"/.exec(i18n)?.[1] ?? "";
  const dePruefen = /persoenlichPruefen: "([^"]+)"/.exec(i18n)?.[1] ?? "", enPruefen = /persoenlichPruefen: "(Your[^"]+)"/.exec(i18n)?.[1] ?? "";
  ok(!!de && !!en && !!dePruefen && !!enPruefen, "Seiten-Sätze „Ihre Angaben sind schon eingetragen“ deutsch und englisch");
  for (const satz of [de, en, dePruefen, enPruefen, W.LEAD_HINTERGRUND_DATENSCHUTZ.de]) {
    const f = [...wandPruefen(satz), ...globalWortPruefen(satz)];
    ok(!f.length, `Wortwand grün: „${satz.slice(0, 40)}…“ ${f.map((x: any) => x.treffer).join(", ")}`);
  }
  ok(!/\b(du|dich|dir|dein\w*)\b/i.test(de), "Seiten-Satz siezt");
}

abschnitt("A8 Bestätigung global_termin (de + en): FIAON Global, Sie-Form, KEIN Institut-Satz");
{
  const def = MAKE_EVENT_REGISTRY.find((e) => e.type === "global_termin")!;
  ok(!!def, "global_termin ist registriert");
  const { globalTerminPayload } = await import("../server/lib/fiaon-global-termin");
  for (const sprache of ["de", "en"] as const) {
    // Die echte Nutzlast der Buchung (globalTerminPayload) — dieselbe Mail, die rausgeht.
    const nutzlast = globalTerminPayload({
      email: "lead@pruef.example", name: "Lw Person", firma: "Lw Logistik GmbH", telefon: "+49 30 1234567", paketText: null,
      ansprechpartner: "Pruef Kalender", datumText: "11.11.2026", uhrzeit: "14:00", stornoToken: "a".repeat(48),
      sprache, beginn: new Date("2026-11-11T13:00:00Z"), paket: null,
    });
    const m = mailRendern("global_termin", nutzlast as any);
    ok(!!m, `${sprache}: rendert`);
    if (!m) continue;
    ok(m.fehlend.length === 0, `${sprache}: kein Platzhalter ohne Wert`);
    ok(/FIAON Global/.test(m.html) && !/Bonität ist machbar/.test(m.html), `${sprache}: Kopf FIAON Global, nicht „Bonität ist machbar.“`);
    ok(!/entscheidet das jeweilige Institut|institution decides/i.test(m.text), `${sprache}: KEIN Institut-Satz (E-468)`);
    if (sprache === "de") ok(!/\b(du|dich|dir|dein\w*)\b/i.test(m.text), "de: Sie-Form");
    ok(m.text.includes("anrede=sie&bereich=business") || m.html.includes("anrede=sie&amp;bereich=business") || m.html.includes("anrede=sie&bereich=business"), `${sprache}: Absage-Seite in Sie-Form, Business-Rahmen`);
  }
}

abschnitt("A9 Quelltext-Wände");
{
  const termin = lies("server/lib/fiaon-global-termin.ts");
  const annehmen = termin.split("export async function globalAnfrageAnnehmen(")[1]?.split("\n}\n")[0] ?? "";
  ok(!/leadWegSchema\(|CREATE TABLE|ALTER TABLE|leadCodeSichern\(/.test(annehmen), "Eingang (globalAnfrageAnnehmen): keine Tabellen-Anweisung, kein Code-Anlegen");
  ok(/void import\("\.\/fiaon-lead-weg"\)/.test(annehmen), "Eingang: Verknüpfung mit einem schon gebuchten Gespräch angestoßen, nie abgewartet");
  const buchen = termin.split("export async function globalTerminBuchen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/leadCodeLesen\(ein\.code, \{ schema: false \}\)/.test(buchen), "Buchung: der Link wird ohne Tabellen-Anweisung gelesen");
  ok(/globalZustaendig\(\)/.test(buchen) && /zustaendigAgentId: zustaendig\.id/.test(buchen), "Buchung: Firma bleibt bei der zuständigen Person (Gutachten 0, Mangel 15)");
  ok(/if \(!justin\) \{[\s\S]*auftragFuerKunden\(/.test(buchen), "Buchung: kein Auftrag an Justin, wenn er die Gespräche führt");
  ok(/pg_advisory_xact_lock\(hashtext\(\$\{`global-termin:\$\{person\.id\}:\$\{slot\.tag\}`\}\)\)/.test(buchen) && /tagesRest\(/.test(buchen), "Buchung: Sperre je Person und Tag + Lead-/Gesamtdeckel");
  const gruender = lies("server/routes/fiaon-gruender-termin.ts");
  ok(/global-termin:\$\{ein\.gruender\.id\}:\$\{ein\.slot\.datum\}/.test(gruender), "/justin-Weiche nimmt dieselbe Sperre (Gutachten 0, Mangel 2)");
  ok(/terminStehtAnstossen\(buchung\.id\)/.test(gruender) && !/weicheBuchen[\s\S]*buchungMelden\([\s\S]*\n}\n\n\/\/ ── POST/.test(gruender), "/justin-Weiche: D2 statt der üblichen Meldung (eine Mail, nicht zwei)");
  const route = lies("server/routes/fiaon-global-termin.ts");
  ok(!/globalTerminEinwilligungMerken|GLOBAL_TERMIN_ARAS/.test(route), "Buchungs-Tür speichert keinen ARAS-Nachweis mehr (kein ARAS für Leads)");
  const seite = lies("client/src/components/site/GlobalGespraech.tsx");
  ok(!/GLOBAL_TERMIN_ARAS_HINWEIS|arasHinweis/.test(seite), "Buchungsformular ohne ARAS-Hinweis");
  ok(!/[?&](g|code)=/.test(seite), "die Seite trägt den Code nie in ihrer Adresse");
  const aras = lies("server/lib/fiaon-aras-wunsch.ts");
  ok(/istLeadGespraech\(t\)\) return \{ status: "verfallen"/.test(aras) && /NOT IN \(\$\{LEAD_GESPRAECH_HERKUENFTE/.test(aras), "ARAS: Lead-Gespräche werden weder geplant noch gewählt");
  const agent = lies("server/routes/fiaon-agent.ts");
  ok(/AND NOT \(quelle = 'global' AND agent_id = \$\{gruender\} AND COALESCE\(herkunft, ''\) = ANY/.test(agent), "allgemeine Termin-Erinnerung lässt Lead-Gespräche bei Justin aus (D3 statt zwei Mails)");
  const meta = lies("server/lib/fiaon-meta-leads.ts");
  const gm = meta.split("async function globalMetaLeadEinspielen(")[1]?.split("\n}\n")[0] ?? "";
  const iClaim = gm.indexOf("RETURNING meta_lead_id"), iAnnehmen = gm.indexOf("globalAnfrageAnnehmen({");
  ok(iClaim > 0 && iAnnehmen > iClaim, "Meta: erst beanspruchen, dann annehmen (Gutachten 0, Mangel 4)");
  ok(/DELETE FROM fiaon_meta_leads WHERE meta_lead_id = .* AND global_anfrage_id IS NULL/.test(gm), "Meta: scheitert die Annahme, fällt die Beanspruchung zurück (nichts geht verloren)");
  const pm = lies("server/lib/fiaon-postmeister-lauf.ts");
  const i0b = pm.indexOf("// 0b. E-350"), i0c = pm.indexOf("// 0c. E-476"), i1 = pm.indexOf("// 1. Fremdpost");
  ok(i0b > 0 && i0c > i0b && i1 > i0c, "Postmeister: 0c steht nach 0b und vor jeder Antwort");
  const lw = lies("server/lib/fiaon-lead-weg.ts");
  ok(/payment_status = 'paid'/.test(lw.split("export async function globalLeadAbsender(")[1] ?? ""), "0c: zahlende Privatkundin bekommt weiter Maras Antwort (Gutachten 0, Mangel 7)");
  ok(!/fiaon-aras|planEinreihen|arasAnruf/.test(lw), "Lead-Weg löst nie einen ARAS-Anruf aus");
  ok(!/@gmail\.com|@web\.de|\+49\s?1[5-7]\d{6,}/.test(lw + lies("shared/fiaon-lead-weg.ts")), "keine Kundendaten im Code (öffentliches Repo)");
  const routes = lies("server/routes.ts");
  ok(/gPfadArt\(req\.params\.kennung\) === 'lead'/.test(routes) && /radarKurzlinkZiel\(req\.params\.kennung\)/.test(routes), "/g/: Lead-Code und Radar-Code nebeneinander (Gutachten 0, Mangel 1)");
  ok(/'Referrer-Policy', 'no-referrer'/.test(routes) && /noindex, nofollow/.test(routes), "/g/: Schutzköpfe (noindex, no-store, no-referrer)");
  const kurz = lies("server/routes/fiaon-kurzlink.ts");
  ok(/router\.get\("\/gb"/.test(kurz) && /"meta_danke"|holen: true/.test(kurz) && /gbZuViel\(/.test(kurz), "/gb: sofort weiter, Lead im Hintergrund, Bremse je Adresse");
  ok(/httpOnly: true/.test(kurz) && /LEAD_COOKIE_PFAD/.test(kurz), "/gb: Kennung nur im HttpOnly-Cookie für /api/fiaon/global");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — LOKALE WEGWERF-DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (erfundene Menschen, Testkonten)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const G = await import("../server/lib/fiaon-global-termin");
  const M = await import("../server/lib/fiaon-meta-leads");
  const D = await import("../server/lib/fiaon-lead-dossier");
  const GG = await import("../server/lib/fiaon-global-gespraech");
  const REG = await import("../server/lib/fiaon-global-gespraech-regeln");
  const LAUF = randomBytes(3).toString("hex");
  const DOM = `lw-${LAUF}.example`;
  const mail = (n: number) => `lw-${LAUF}-${n}@${DOM}`;
  const nummer = (n: number) => `+49151${String(parseInt(LAUF, 16) % 100000).padStart(5, "0")}${String(n).padStart(3, "0")}`;
  const gesendet: any[] = [];
  LW.leadWegVersandSetzen(async (m) => { gesendet.push(m); return { ok: true, messageId: `<lw-${LAUF}-${gesendet.length}@example.com>` }; });
  D.dossierVersandSetzen(async (m) => { gesendet.push({ ...m, _dossier: true }); return { ok: true, messageId: `<lwd-${LAUF}-${gesendet.length}@example.com>` }; });
  // Nachbesserung: die Antwort an ein Mara-Postfach geht jetzt über dieselbe Regel wie js@ (Lead-Post) — deren Meldung an Justin auch hierher.
  const LP = await import("../server/lib/fiaon-global-lead-post");
  LP.leadPostMeldungSetzen(async (m) => { gesendet.push({ ...m, _post: true }); return { ok: true, messageId: `<lwp-${LAUF}-${gesendet.length}@example.com>` }; });
  const setze = (k: string, v: string) => sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const [kal] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Kalender', 'Pruef', ${`kal-${LAUF}@example.com`}, TRUE, TRUE, 'agent') RETURNING id`) as any[];
  // Die zuständige Person ist (wie im Betrieb) KEIN Testkonto — Aufträge an Testkonten landen beim Betreiber.
  const [zst] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Vertrieb', 'Pruef', ${`vt-${LAUF}@example.com`}, TRUE, FALSE, 'agent') RETURNING id`) as any[];
  const KAL = Number(kal.id), ZST = Number(zst.id);
  for (const wt of [1, 2, 3, 4, 5]) await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv) VALUES (${KAL}, ${wt}, '07:00', '20:00', TRUE), (${ZST}, ${wt}, '07:00', '20:00', TRUE)`;
  await setze("gruender_termin_agent_id", String(KAL));
  await setze("global_zustaendig_agent_id", String(ZST));
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${["global_kalender_agent_id", "global_lead_pro_tag", "global_kalender_gesamt_pro_tag"]})`;
  await setze("global_termin_pro_tag", "8");
  await setze("lead_dossier_an", "1");
  await M.metaTabellen();
  await D.leadDossierSchema();
  await LW.leadWegSchema();
  await GG.ensureGlobalGespraechSpalten();
  const kontakt = (n: number, firma = `Lw Logistik ${LAUF} ${n} GmbH`, email = mail(n)) => ({
    name: `Lw Person${n}`, vorname: "Lw", nachname: `Person${n}`, firma, email, telefon: nummer(n), paket: null, paketText: null, land: "DE", sprache: "de" as const,
  });
  const anfrage = async (n: number) => (await G.globalAnfrageAnnehmen({ kontakt: kontakt(n) as any, wunschzeit: null, text: "Prüfanfrage", ip: `198.51.100.${n}` })).anfrageId;
  const auftragJetzt = async (anfrageId: number) => ((await sql`SELECT status, zustaendig_agent_id, ergebnis FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${anfrageId}`}`) as any[])[0];
  // Nachbesserung (Gutachten Technik, Mangel 7): Nach einer Buchung zieht der Stand im Hintergrund nach (die Buchung wartet nicht
  // darauf) — der Prüfstand wartet bis zu drei Sekunden, bis der Auftrag zu ist.
  const auftrag = async (anfrageId: number) => {
    for (let i = 0; i < 30; i++) { const a = await auftragJetzt(anfrageId); if (a?.status === "erledigt") return a; await new Promise((r) => setTimeout(r, 100)); }
    return auftragJetzt(anfrageId);
  };

  abschnitt("B1 „Gespräche führt“ (Vorgabe = Justins Konto, hier ein Testkonto)");
  const a0 = await G.globalAngebotLaden();
  gleich(a0.person?.id, KAL, "Kalender-Person = Vorgabe (Gründer-Konto, Testkonto erlaubt — Gutachten 0, Mangel 21)");
  gleich(a0.kalender?.modus, "justin", "Modus „justin“: D2/D3 statt Auftrag");
  ok(a0.tage.length > 0 && !a0.rueckfall, "der Global-Kalender ist nicht leer (tage ≠ [], rueckfall false)");
  ok(a0.tage.every((d) => d.zeiten.length <= 3), "höchstens drei Zeiten je Tag sichtbar (Lead-Deckel 3)");

  abschnitt("B2 Lead → Code → Vorlage → Buchung über den Link");
  const A1 = await anfrage(1);
  ok(!!(await auftrag(A1)) && (await auftrag(A1)).status !== "erledigt" && Number((await auftrag(A1)).zustaendig_agent_id) === ZST, "Anfrage → Anruf-Auftrag an die zuständige Person (Daniel ruft trotzdem sofort an)");
  const link = await LW.leadCodeSichern(A1);
  ok(!!link && W.leadCodeForm(link.code) && link.url === `https://fiaon.com/g/${link.code}`, "Code: 10 Zeichen, Link fiaon.com/g/<code>");
  ok(!!link && Math.abs(link.bis.getTime() - Date.now() - 30 * 86_400_000) < 120_000, "gültig 30 Tage");
  const nochmal = await LW.leadCodeSichern(A1);
  gleich(nochmal?.code, link?.code, "zweiter Aufruf: derselbe Code");
  const v = await LW.leadCodeLesen(link!.code, { klick: true });
  ok(v?.anfrageId === A1 && v.email === mail(1) && v.telefon === nummer(1) && v.firma === `Lw Logistik ${LAUF} 1 GmbH`, "Vorlage: Name, Firma, Mail, Telefon");
  gleich(await LW.leadCodeLesen("zzzzzzzzzz"), null, "fremder Code → keine Vorlage (normale Fläche)");
  const [{ klicks }] = (await sql`SELECT klicks FROM fiaon_lead_weg WHERE anfrage_id = ${A1}`) as any[];
  gleich(Number(klicks), 1, "der Klick ist gezählt");
  // Platzhalter-Firma wird nicht vorausgefüllt
  const [pa] = (await sql`INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, text) VALUES ('global', 'Lw Ohne', ${mail(90)}, 'Lw Ohne (Firma noch offen)', ${nummer(90)}, 'x') RETURNING id`) as any[];
  const lp = await LW.leadCodeSichern(Number(pa.id));
  gleich((await LW.leadCodeLesen(lp!.code))?.firma, "", "Platzhalter „(Firma noch offen)“ wird nie vorausgefüllt");
  // abgelaufen
  await sql`UPDATE fiaon_lead_weg SET code_bis = NOW() - INTERVAL '1 minute' WHERE anfrage_id = ${Number(pa.id)}`;
  gleich(await LW.leadCodeLesen(lp!.code), null, "abgelaufener Code → keine Vorlage");
  const neuCode = await LW.leadCodeSichern(Number(pa.id));
  ok(!!neuCode && neuCode.code !== lp!.code, "abgelaufen → beim nächsten Bedarf ein neuer Code");

  const tag1 = a0.tage[0];
  const b1 = await G.globalTerminBuchen({ kontakt: kontakt(1, `Lw Logistik ${LAUF} 1 GmbH`, `anders-${LAUF}@${DOM}`) as any, tag: tag1.tag, zeit: tag1.zeiten[0], thema: null, code: link!.code });
  ok(b1.ok, `Buchung über den Link: ${b1.ok ? "ok" : (b1 as any).error}`);
  const T1 = b1.ok ? b1.terminId : 0;
  const [t1] = (await sql`SELECT agent_id, quelle, herkunft, status FROM fiaon_termine WHERE id = ${T1}`) as any[];
  ok(t1?.agent_id === KAL && t1?.quelle === "global" && t1?.herkunft === "global_link", "Termin bei der Kalender-Person, quelle global, herkunft global_link");
  const [lg] = (await sql`SELECT anfrage_id, firma_id, weg FROM fiaon_lead_gespraech WHERE termin_id = ${T1}`) as any[];
  ok(Number(lg?.anfrage_id) === A1 && lg?.weg === "link", "Lead-Gespräch hängt an DIESER Anfrage — auch mit anderer Mail (Fall andere Mail beim Buchen)");
  const au1 = await auftrag(A1);
  const [an1] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A1}`) as any[];
  gleich(an1?.status, "termin", "Anfrage auf „termin“");
  ok(au1?.status === "erledigt" && /hat selbst über seinen persönlichen Link gebucht/.test(String(au1?.ergebnis)), "Daniels Auftrag hat sich selbst geschlossen");
  const [fa1] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_leads WHERE LOWER(email) IN (${mail(1)}, ${`anders-${LAUF}@${DOM}`})`) as any[];
  gleich(fa1?.n, 1, "eine Firma im Cockpit (keine zweite durch die andere Mail)");
  const [fz1] = (await sql`SELECT zustaendig_agent_id, status FROM fiaon_firmen_leads WHERE id = ${Number(lg?.firma_id) || 0}`) as any[];
  ok(Number(fz1?.zustaendig_agent_id) === ZST && fz1?.status === "termin", "Firma bleibt bei der zuständigen Person, Stand „termin“ (Gutachten 0, Mangel 15)");
  const [ja] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-termin:${T1}`}`) as any[];
  gleich(ja?.n, 0, "kein Auftrag „Erstgespräch …“ an Justin (er bekommt D2/D3)");
  const [ein1] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_telefon_einwilligung WHERE quelle_art = 'global_termin' AND quelle_id = ${String(T1)}`.catch(() => [{ n: 0 }])) as any[];
  gleich(Number(ein1?.n ?? 0), 0, "kein ARAS-Nachweis, also kein ARAS-Erinnerungsanruf");

  const b1b = await G.globalTerminBuchen({ kontakt: kontakt(1) as any, tag: tag1.tag, zeit: tag1.zeiten[tag1.zeiten.length - 1], thema: null, code: link!.code });
  ok(!b1b.ok && b1b.grund === "schon_gebucht", "Doppelbuchung derselben Anfrage → „schon gebucht“");

  abschnitt("B3 D2 „Termin steht“ — genau einmal, im Faden");
  gesendet.length = 0;
  gleich(await LW.terminStehtMelden(T1), "gesendet", "D2 gesendet");
  gleich(await LW.terminStehtMelden(T1), "uebersprungen", "zweiter Versuch: nichts (atomar)");
  gleich(gesendet.length, 1, "genau EINE Mail an Justin");
  ok(String(gesendet[0]?.an).endsWith("@fiaon.com") && /TERMIN STEHT/.test(String(gesendet[0]?.text)) && !BANK_SATZ.test(String(gesendet[0]?.text)), "an die Dossier-Adresse, „TERMIN STEHT“, kein Bank-Satz");
  gleich(await LW.terminStehtNachholen(), 0, "Nachholen: nichts offen");

  abschnitt("B4 D3 Anruf-Karte — genau einmal, 60 Minuten vorher");
  await sql`UPDATE fiaon_termine SET beginn = date_trunc('minute', NOW()) + INTERVAL '50 minutes' WHERE id = ${T1}`;
  gesendet.length = 0;
  gleich(await LW.anrufKartenSenden(new Date()), 1, "D3 gesendet");
  gleich(await LW.anrufKartenSenden(new Date()), 0, "D3 kein zweites Mal (agent_erinnert_am)");
  ok(/^Re: Lead: /.test(String(gesendet[0]?.betreff)) && !!gesendet[0]?.kopfzeilen?.["In-Reply-To"], "D3 im Faden des Leads (nach D2)");
  ok(/ANRUF UM/.test(String(gesendet[0]?.text)) && gesendet[0]?.knoepfe?.[0]?.url?.startsWith("tel:+49"), "Anruf-Karte mit tel:-Knopf");
  const [g3] = (await sql`SELECT d3_am FROM fiaon_lead_gespraech WHERE termin_id = ${T1}`) as any[];
  ok(!!g3?.d3_am, "d3_am vermerkt");
  // allgemeine Erinnerung: dieselbe Bedingung wie runCallbackReminders → Lead-Gespräch bei Justin fällt heraus
  const [allg] = (await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
     WHERE id = ${T1} AND NOT (quelle = 'global' AND agent_id = ${KAL} AND COALESCE(herkunft, '') = ANY(${W.LEAD_GESPRAECH_HERKUENFTE as unknown as string[]}))`) as any[];
  gleich(allg?.n, 0, "die allgemeine Termin-Erinnerung lässt dieses Gespräch aus");

  abschnitt("B5 Ergebnis fehlt → die zuständige Person fragt bei Justin nach (nicht Justins Brett)");
  await sql`UPDATE fiaon_termine SET beginn = date_trunc('day', NOW() - INTERVAL '3 days') + INTERVAL '9 hours', ergebnis_aufgabe_am = NULL WHERE id = ${T1}`;
  const [tb] = (await sql`SELECT beginn FROM fiaon_termine WHERE id = ${T1}`) as any[];
  const ab = REG.leitungAb(new Date(tb.beginn));
  await GG.globalGespraecheLauf(new Date(ab.getTime() - 10 * 60_000));
  const [vor] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-ergebnis:${T1}`}`) as any[];
  gleich(vor?.n, 0, "vor 9 Uhr am nächsten Werktag: keine Aufgabe (D3 trägt „Ergebnis eintragen“)");
  await GG.globalGespraecheLauf(new Date(ab.getTime() + 5 * 60_000));
  const [nach] = (await sql`SELECT titel, zustaendig_agent_id, zustaendig_art FROM fiaon_betreiber_todos WHERE schluessel = ${`global-ergebnis:${T1}`}`) as any[];
  ok(/^Ergebnis bei Justin erfragen/.test(String(nach?.titel)) && Number(nach?.zustaendig_agent_id) === ZST, "danach: „Ergebnis bei Justin erfragen“ an die zuständige Person");

  abschnitt("B6 Deckel: Lead-Deckel, Gesamtdeckel, „zustaendig“ = altes Verhalten");
  await setze("global_lead_pro_tag", "1");
  const A2 = await anfrage(2);
  const a1 = await G.globalAngebotLaden();
  const freiTag = a1.tage[0];
  const b2 = await G.globalTerminBuchen({ kontakt: kontakt(2) as any, tag: freiTag.tag, zeit: freiTag.zeiten[0], thema: null });
  ok(b2.ok, "Buchung ohne Link (Kalender auf fiaon.com)");
  const [lg2] = (await sql`SELECT anfrage_id, weg FROM fiaon_lead_gespraech WHERE termin_id = ${b2.ok ? b2.terminId : 0}`) as any[];
  ok(Number(lg2?.anfrage_id) === A2 && lg2?.weg === "seite", "ohne Link per Mail/Telefon an die Anfrage gehängt (Gutachten 0, Mangel 17)");
  ok((await auftrag(A2))?.status === "erledigt", "… und Daniels Auftrag ist zu");
  const a2 = await G.globalAngebotLaden();
  ok(!a2.tage.some((d) => d.tag === freiTag.tag), "Lead-Deckel 1 erreicht → der Tag ist für Leads zu");
  const b3 = await G.globalTerminBuchen({ kontakt: kontakt(3) as any, tag: freiTag.tag, zeit: freiTag.zeiten[freiTag.zeiten.length - 1] ?? freiTag.zeiten[0], thema: null });
  ok(!b3.ok && ["nicht_angeboten", "tag_voll"].includes(b3.grund), "eine weitere Lead-Buchung an dem Tag wird abgewiesen");
  await setze("global_lead_pro_tag", "3");
  await setze("global_kalender_gesamt_pro_tag", "2");
  // Ein /justin-Gespräch am selben Tag → Gesamt 2 erreicht (Lead 1 + /justin 1)
  const { personFuerZeile } = await import("../server/fiaon-person-model");
  const pj = await personFuerZeile({ emails: [mail(50)], phones: [nummer(50)], stammdaten: { kind: "private", first_name: "Lw", last_name: "Gruender" }, quelle: "pruefstand", firstSeenAt: new Date() });
  const slotsTag = (await G.globalAngebotLaden()).ergebnis.frei.filter((f) => f.tag === freiTag.tag);
  const { terminBuchen } = await import("../server/lib/fiaon-termine");
  if (slotsTag.length && pj) await terminBuchen({ personId: pj.personId, agentId: KAL, beginn: slotsTag[slotsTag.length - 1].beginn, quelle: "gruender", herkunft: "gruender_seite" });
  const a3 = await G.globalAngebotLaden();
  ok(slotsTag.length > 0 && !a3.tage.some((d) => d.tag === freiTag.tag), "Gesamtdeckel 2 (/justin + Leads) → der Tag ist zu, obwohl der Lead-Deckel 3 noch Platz hätte");
  await sql`DELETE FROM fiaon_settings WHERE key = 'global_kalender_gesamt_pro_tag'`;
  await setze("global_kalender_agent_id", "zustaendig");
  const a4 = await G.globalAngebotLaden();
  ok(a4.person?.id === ZST && a4.kalender?.modus === "alt" && a4.proTag === 8, "„zustaendig“ → die zuständige Person mit global_termin_pro_tag (wie vor E-476)");
  await sql`DELETE FROM fiaon_settings WHERE key = 'global_kalender_agent_id'`;

  abschnitt("B7 Cockpit-Knopf „Termin bei Justin eintragen“");
  const A4 = await anfrage(4);
  const a5 = await G.globalAngebotLaden();
  const t5 = a5.ergebnis.frei.find((f) => f.tag !== freiTag.tag) ?? a5.ergebnis.frei[0];
  const firmaA4 = await LW.offeneAnfrageFuer(mail(4), nummer(4));
  const code4 = await LW.leadCodeSichern(A4);
  const b4 = await G.globalTerminBuchen({ kontakt: kontakt(4) as any, tag: t5.tag, zeit: t5.zeit, thema: null, code: code4!.code,
    durch: { agentId: ZST, name: "Pruef Vertrieb", erzaehlt: "Inhaber einer Spedition, will Kapital für den Fuhrpark.\nUS-Bezug: Kunden in Florida", einschaetzung: "heiss", firmaId: firmaA4?.firmaId ?? null } });
  ok(b4.ok, `Cockpit-Buchung: ${b4.ok ? "ok" : (b4 as any).error}`);
  const T4 = b4.ok ? b4.terminId : 0;
  const [t4] = (await sql`SELECT herkunft, notiz FROM fiaon_termine WHERE id = ${T4}`) as any[];
  ok(t4?.herkunft === "agent_global" && /Was er selbst erzählt hat \(Pruef Vertrieb\)/.test(String(t4?.notiz)), "herkunft agent_global, die Notiz steht am Termin");
  const [lg4] = (await sql`SELECT weg, erzaehlt, einschaetzung FROM fiaon_lead_gespraech WHERE termin_id = ${T4}`) as any[];
  ok(lg4?.weg === "agent" && /Spedition/.test(String(lg4?.erzaehlt)) && lg4?.einschaetzung === "heiss", "Lead-Gespräch: weg agent, Notiz, Einschätzung");
  const au4 = await auftrag(A4);
  ok(au4?.status === "erledigt" && /Pruef Vertrieb hat ihn bei Justin eingetragen/.test(String(au4?.ergebnis)), "Daniels Auftrag schließt sich („hat ihn bei Justin eingetragen“)");
  gesendet.length = 0;
  await LW.terminStehtMelden(T4);
  ok(/Pruef Vertrieb hat ihn im Gespräch erreicht und eingetragen/.test(String(gesendet[0]?.text)) && /WAS ER SELBST ERZÄHLT HAT/.test(String(gesendet[0]?.text)), "D2: „eingetragen von …“ mit der Notiz");

  // Dieselbe Tür wie im Cockpit (Route, ohne Server): Zeiten holen, ohne Pflicht-Notiz → 400, mit Notiz → eingetragen.
  {
    const FR = (await import("../server/routes/fiaon-firmen")).default as any;
    const schritt = (methode: string, pfad: string) => FR.stack.find((l: any) => l.route?.path === pfad && l.route.methods[methode])?.route.stack.at(-1).handle;
    const rufeAgent = async (h: any, params: any, body: any = {}) => {
      const antwort: { status: number; json: any } = { status: 200, json: null };
      const res: any = { status(c: number) { antwort.status = c; return res; }, json(j: any) { antwort.json = j; return res; }, setHeader() { return res; } };
      await h({ body, query: {}, params, headers: {}, socket: {}, agent: { id: ZST, name: "Pruef Vertrieb" } }, res);
      return antwort;
    };
    const A5 = await anfrage(5);
    const [f5] = (await sql`SELECT id FROM fiaon_firmen_leads WHERE LOWER(email) = ${mail(5)}`) as any[];
    const z5 = await rufeAgent(schritt("get", "/agent/firmen/:id/justin-zeiten"), { id: String(f5.id) });
    ok(z5.json?.ok && z5.json.person?.id === KAL && z5.json.tage?.length > 0 && /\/g\/[A-Za-z0-9]{10}$/.test(String(z5.json.link)), "Cockpit: Justins freie Zeiten + der persönliche Link des Leads");
    const wahl = z5.json.tage.find((x: any) => x.zeiten.length) ?? z5.json.tage[0];
    const ohne = await rufeAgent(schritt("post", "/agent/firmen/:id/justin-termin"), { id: String(f5.id) }, { tag: wahl.tag, zeit: wahl.zeiten[0], erzaehlt: "Interesse.", einschaetzung: "heiss" });
    ok(ohne.status === 400 && ohne.json?.feld === "erzaehlt", "Cockpit-Knopf ohne Pflicht-Notiz → Fehler");
    const mit = await rufeAgent(schritt("post", "/agent/firmen/:id/justin-termin"), { id: String(f5.id) },
      { tag: wahl.tag, zeit: wahl.zeiten[0], erzaehlt: "Geschäftsführer einer Agentur mit zwölf Leuten, will US-Kunden direkt bedienen.", einschaetzung: "warm", felder: { groesse: "zwölf Mitarbeiter" } });
    ok(mit.json?.ok === true && Number(mit.json.terminId) > 0, `Cockpit-Knopf mit Notiz → eingetragen (${mit.json?.error ?? ""})`);
    const [lg5] = (await sql`SELECT anfrage_id, weg, einschaetzung FROM fiaon_lead_gespraech WHERE termin_id = ${Number(mit.json?.terminId) || 0}`) as any[];
    ok(Number(lg5?.anfrage_id) === A5 && lg5?.weg === "agent" && lg5?.einschaetzung === "warm", "… an der Anfrage des Leads, weg agent, Einschätzung warm");
    ok((await auftrag(A5))?.status === "erledigt", "… Daniels Auftrag ist zu");
  }

  abschnitt("B8 Anfrage NACH der Buchung (Danke-Knopf schneller als der Meta-Rückstand)");
  const a6 = await G.globalAngebotLaden();
  const t6 = a6.ergebnis.frei.find((f) => ![freiTag.tag, t5.tag].includes(f.tag)) ?? a6.ergebnis.frei[0];
  const b6 = await G.globalTerminBuchen({ kontakt: kontakt(6) as any, tag: t6.tag, zeit: t6.zeit, thema: null });
  ok(b6.ok, "Buchung ohne vorherige Anfrage");
  const A6 = await anfrage(6);
  gleich((await auftrag(A6)) ?? null, null, "danach eintreffende Anfrage → KEIN „bitte anrufen“-Auftrag");
  await new Promise((r) => setTimeout(r, 400));
  const [lg6] = (await sql`SELECT anfrage_id FROM fiaon_lead_gespraech WHERE termin_id = ${b6.ok ? b6.terminId : 0}`) as any[];
  gleich(Number(lg6?.anfrage_id), A6, "die Anfrage hängt sich an das gebuchte Gespräch");
  const [fl6] = (await sql`SELECT status FROM fiaon_firmen_leads WHERE LOWER(email) = ${mail(6)}`) as any[];
  gleich(fl6?.status, "termin", "Cockpit bleibt auf „termin“ (kein Rückschritt auf „Wiedervorlage“)");

  abschnitt("B9 /justin-Weiche");
  const GR = (await import("../server/routes/fiaon-gruender-termin")).default as any;
  const handler = GR.stack.find((l: any) => l.route?.path === "/gruender-termin/buchen" && l.route.methods.post)?.route.stack[0].handle;
  const angebotJ = GR.stack.find((l: any) => l.route?.path === "/gruender-termin" && l.route.methods.get)?.route.stack[0].handle;
  const rufe = async (h: any, body: any, query: any = {}) => {
    const antwort: { status: number; json: any } = { status: 200, json: null };
    const res: any = { status(c: number) { antwort.status = c; return res; }, json(j: any) { antwort.json = j; return res; }, setHeader() { return res; } };
    await h({ body, query, params: {}, headers: { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}` }, socket: {} }, res);
    return antwort;
  };
  const A7 = await anfrage(7);
  const ang = await rufe(angebotJ, {});
  const slot7 = (ang.json?.slots ?? [])[0];
  ok(!!slot7, "/justin bietet Zeiten an");
  const r7 = slot7 ? await rufe(handler, { vorname: "Lw", nachname: "Person7", email: mail(7), telefon: nummer(7), beginn: slot7.beginn, thema: "Kapital" }) : { status: 0, json: null };
  ok(r7.json?.ok === true, `/justin mit der Mail eines Business-Leads → gebucht (${r7.json?.error ?? ""})`);
  const [t7] = (await sql`SELECT t.id, t.quelle, t.herkunft, p.kind FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id WHERE p.primary_email = ${mail(7)} ORDER BY t.id DESC LIMIT 1`) as any[];
  ok(t7?.quelle === "global" && t7?.herkunft === "gruender_global" && t7?.kind === "business", "… als Global-Gespräch (quelle global, Person business)");
  const [lg7] = (await sql`SELECT anfrage_id, weg FROM fiaon_lead_gespraech WHERE termin_id = ${Number(t7?.id) || 0}`) as any[];
  ok(Number(lg7?.anfrage_id) === A7 && lg7?.weg === "justin", "… an der Anfrage, weg „justin“");
  ok((await auftrag(A7))?.status === "erledigt", "… Daniels Auftrag ist zu");
  const [ml7] = (await sql`SELECT event FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(7)} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
  ok(ml7?.event === "global_termin", "… Bestätigung im FIAON-Global-Rahmen (global_termin, nicht termin_bestaetigung)");
  // Frisch geladen: inzwischen kann der Gesamtdeckel einen Tag geschlossen haben (das ist gewollt).
  const ang8 = await rufe(angebotJ, {});
  const slot8 = (ang8.json?.slots ?? [])[0];
  ok(!!slot8, "/justin bietet weiter Zeiten an (für Nicht-Leads)");
  const r8 = await rufe(handler, { vorname: "Lw", nachname: "Privat", email: mail(8), telefon: nummer(8), beginn: slot8.beginn, thema: "Presse" });
  const [t8] = (await sql`SELECT t.quelle FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id WHERE p.primary_email = ${mail(8)} ORDER BY t.id DESC LIMIT 1`) as any[];
  ok(r8.json?.ok === true && t8?.quelle === "gruender", "/justin mit privater Mail (keine Anfrage) → unverändert ein Gründergespräch");
  const [ml8] = (await sql`SELECT event FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(8)} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
  gleich(ml8?.event, "termin_bestaetigung", "… mit der bisherigen Bestätigung");

  abschnitt("B10 Mara-Weiche 0c");
  const l1 = await LW.globalLeadAbsender(mail(2));
  ok(!!l1 && l1.anfrageId === A2, "offener Global-Lead wird erkannt → keine Mara-Antwort");
  ok(!(await LW.globalLeadAbsender(`fremd-${LAUF}@${DOM}`)), "fremde Adresse → keine Weiche");
  ok(!(await LW.globalLeadAbsender("welcome@fiaon.com")), "eigene Adresse → keine Weiche");
  await sql`INSERT INTO fiaon_applications (ref, email, payment_reference, payment_status, type) VALUES (${`LW-${LAUF}-P`}, ${mail(2)}, ${`LW${LAUF}P`}, 'paid', 'private')`;
  ok(!(await LW.globalLeadAbsender(mail(2))), "zahlende Privatkundin mit Global-Anfrage → Mara antwortet wie bisher (Gutachten 0, Mangel 7)");
  const l3 = await LW.globalLeadAbsender(mail(4));
  gesendet.length = 0;
  if (l3) await LW.leadAntwortVermerken(l3, { postfach: "welcome@fiaon.com", betreff: "Rückfrage zum Termin", auszug: "Passt auch 15 Uhr? https://x.example", von: mail(4) });
  const [w3] = (await sql`SELECT antwort_am FROM fiaon_lead_weg WHERE anfrage_id = ${A4}`) as any[];
  ok(!!w3?.antwort_am, "antwort_am gesetzt");
  const [fl3] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_log WHERE firma_id = ${l3?.firmaId ?? 0} AND ergebnis = 'antwort'`) as any[];
  ok(Number(fl3?.n) >= 1, "Zeile im Cockpit-Verlauf");
  ok(gesendet.length === 1 && /ANTWORT DES LEADS/.test(String(gesendet[0]?.text)) && /https\[:\]\/\/x\.example/.test(String(gesendet[0]?.text)) && !/Antworte am besten selbst/.test(String(gesendet[0]?.text)), "kurze Mail an Justin (Adresse entschärft) — keine Aufgabe, kein „antworte selbst“ (Gutachten Lead-Sicht, Mangel 18)");
  const [rr3] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A4}`}`) as any[];
  gleich(Number(rr3?.n), 0, "er hat schon ein Gespräch → kein Rückruf-Auftrag (dieselbe Regel wie js@)");

  abschnitt("B11 Zwei gleichzeitige Meta-Eingänge → EINE Anfrage (Gutachten 0, Mangel 4)");
  const formG = `LWK${LAUF}`;
  await sql`INSERT INTO fiaon_meta_formulare (id, name, status, sprache, geladen_am) VALUES (${formG}, ${W.META_FASSUNG2_NAMEN.kapital}, 'ACTIVE', 'de_DE', NOW()) ON CONFLICT (id) DO NOTHING`;
  const roh = { id: `LW${LAUF}99`, created_time: new Date().toISOString(), form_id: formG, ad_name: "Prüfanzeige", campaign_name: "FIAON Global · Prüfung", platform: "ig",
    field_data: [{ name: "full_name", values: ["Lw Person99"] }, { name: "email", values: [mail(99)] }, { name: "phone_number", values: [nummer(99)] }, { name: "company_name", values: [`Lw ${LAUF} 99 GmbH`] }] };
  gleich(await LW.metaDankeAufloesen(roh.id, { holen: false }), "folgt", "Danke-Knopf vor dem Eingang: „folgt“");
  const [x1, x2] = await Promise.all([M.metaLeadEinspielen(roh as any, "meta_danke", null), M.metaLeadEinspielen(roh as any, "meta_nachhol", null)]);
  ok([x1.status, x2.status].sort().join(",") === "dublette,neu", `einer „neu“, einer „dublette“ (${x1.status}/${x2.status})`);
  const [{ n: anfragenN }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_anfragen WHERE email = ${mail(99)}`) as any[];
  gleich(anfragenN, 1, "genau EINE Anfrage");
  const [{ n: auftraegeN }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE 'global-anfrage:%' AND text LIKE ${`%${mail(99)}%`}`) as any[];
  gleich(auftraegeN, 1, "genau EIN Auftrag");
  const aufl = await LW.metaDankeAufloesen(roh.id, { holen: false });
  ok(typeof aufl === "object" && aufl !== null && aufl.anfrageId > 0, "Danke-Knopf nach dem Eingang: die Anfrage");
  const [w99] = (await sql`SELECT weg FROM fiaon_meta_leads WHERE meta_lead_id = ${roh.id}`) as any[];
  ok(["meta_danke", "meta_nachhol"].includes(String(w99?.weg)), "Weg „meta_danke“ bzw. „meta_nachhol“ — nie ein falscher „Webhook“");

  abschnitt("B12 Kalender-Eintrag: Firma, Rahmen, Cockpit-Link; Dossier-Netz überspringt verknüpfte Buchungen");
  const zus = await LW.leadKalenderZusatz([{ id: T4, quelle: "global", herkunft: "agent_global", person_id: 0 }]);
  ok((zus.get(T4) ?? []).some((z) => /^Firmen-Cockpit: https?:\/\/.*\/agent\/firmen\?firma=\d+$/.test(z)), "Kalendereintrag trägt den Cockpit-Link");
  const [netz] = (await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_termine t
     WHERE t.id = ${b2.ok ? b2.terminId : 0}
       AND NOT EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.termin_id = t.id AND g.anfrage_id IS NOT NULL)`) as any[];
  gleich(netz?.n, 0, "eine Buchung mit Anfrage bekommt kein zweites (Termin-)Dossier — D2 im Faden");

  abschnitt("B13 Absage durch den Mitarbeiter: Business-Absage mit dem persönlichen Link (Gutachten Lead-Sicht, Mangel 3)");
  {
    const TV = await import("../server/lib/fiaon-termine");
    const A11 = await anfrage(11);
    const l11 = await LW.leadCodeSichern(A11);
    const ang11 = await G.globalAngebotLaden();
    const frei11 = [...ang11.tage].reverse().find((d) => d.zeiten.length > 0);
    const b11 = frei11 ? await G.globalTerminBuchen({ kontakt: kontakt(11) as any, tag: frei11.tag, zeit: frei11.zeiten[0], thema: null, code: l11!.code }) : ({ ok: false, error: "kein freier Tag" } as any);
    ok(b11.ok, `Buchung über den Link (${b11.ok ? "ok" : (b11 as any).error ?? (b11 as any).grund})`);
    const [tk11] = (await sql`SELECT storno_token FROM fiaon_termine WHERE id = ${b11.ok ? b11.terminId : 0}`) as any[];
    const abs11 = await TV.terminAbsagen(String(tk11?.storno_token ?? "-"), "agent");
    ok(abs11.ok, "der Mitarbeiter sagt ab");
    let zeile11: any = null;
    for (let i = 0; i < 40 && !zeile11; i++) {
      [zeile11] = (await sql`SELECT event, payload::text AS p FROM fiaon_mail_log WHERE LOWER(COALESCE(empfaenger, '')) = ${mail(11)} AND event IN ('global_termin_absage', 'termin_absage') ORDER BY id DESC LIMIT 1`) as any[];
      if (!zeile11) await new Promise((r) => setTimeout(r, 100));
    }
    gleich(zeile11?.event, "global_termin_absage", "das Unternehmen bekommt die Business-Absage (nicht die Privat-Vorlage termin_absage)");
    ok(String(zeile11?.p ?? "").includes(`/g/${l11!.code}`), "… mit seinem persönlichen Link für eine neue Zeit");
    ok(/js@fiaon\.com/.test(String(zeile11?.p ?? "")), "… Antworten gehen an Justin (Lead-Gespräch)");
  }

  abschnitt("B14 Zwei gleichzeitige Buchungen desselben Leads → EIN Gespräch (Gutachten Technik, Mangel 6)");
  {
    const A12 = await anfrage(12);
    const l12 = await LW.leadCodeSichern(A12);
    const ang12 = await G.globalAngebotLaden();
    const tage12 = ang12.tage.filter((d) => d.zeiten.length > 0);
    const s1 = tage12[0], s2 = tage12[1] ?? tage12[0];
    const z1 = s1?.zeiten[0], z2 = s2 === s1 ? s1?.zeiten[1] : s2?.zeiten[0];
    if (s1 && s2 && z1 && z2) {
      const [p1, p2] = await Promise.all([
        G.globalTerminBuchen({ kontakt: kontakt(12) as any, tag: s1.tag, zeit: z1, thema: null, code: l12!.code }),
        G.globalTerminBuchen({ kontakt: kontakt(12) as any, tag: s2.tag, zeit: z2, thema: null, code: l12!.code }),
      ]);
      const guten = [p1, p2].filter((p) => p.ok).length;
      ok(guten === 1 && [p1, p2].some((p) => !p.ok && (p as any).grund === "schon_gebucht"), `genau eine Buchung, die zweite „schon gebucht“ (${guten} ok)`);
      const [n12] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_lead_gespraech WHERE anfrage_id = ${A12}`) as any[];
      gleich(Number(n12?.n), 1, "… ein Lead-Gespräch an der Anfrage");
    } else ok(true, "(nicht genug freie Zeiten in dieser Prüf-Vorlage — übersprungen)");
  }

  LW.leadWegVersandSetzen(null); D.dossierVersandSetzen(null);
  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
