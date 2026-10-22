// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: ZUSATZDIENSTE PER KLICK (Scheibe 1 „Ihr US-Büro“, 22.10.2026)
//
// Rein — keine Datenbank, kein Netz (fetch ist eine Attrappe, die nur mitschreibt; am Ende darf
// niemand es versucht haben). Prüft:
//   1  KATALOG     Schlüssel, Preise (Soll aus dem Auftrag), Abrechnung, Texte de/en vollständig
//   2  PAKETE      jede Zusatzzeile steht im Paketkatalog: Art global, Zahlungsseite global, kein Abo,
//                  eingestellt, Preis = Katalog, Preisliste (PACK_PRICES) kennt sie, Kategorie „global“
//   3  WORTWAHL    jeder Kundensatz de (Wand + E-188) und en (GLOBAL_SCHAERFER_EN) — dazu Justins
//                  Liste vom 22.10.: keine Etiketten, keine Anbieter, keine Marge
//   4  PREIS/ANGABE  „149 € einmalig“, „149 € im Monat“, Wunschdomain-Prüfung
//   5  IDEMPOTENZ  zusatzKlickEntscheidung, Statuswechsel
//   6  AUFTRAG ENTHÄLT  globalZusatzVerfuegbar je Paket und Angebot
//   7  RECHNUNG + MAIL  Rechnungszeile de/en, Vorlage global_zusatz (Platzhalter, Knöpfe, Nutzlast)
//   8  VERDRAHTUNG  Quelltext: Tabelle = Migration, ON CONFLICT = Index, Zahlungsabzweig vor dem Angebot
//   9  GEGENPROBE  jede Prüfung wird an einem eingebauten Fehler rot
//
//   env -i HOME=$HOME PATH=$PATH npx tsx scripts/pruef-global-zusatz.ts      (Exit 1 bei ROT)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";

// Eine Adresse, die nirgends hinführt (Port 1) — die Server-Module laden, aber keine Abfrage erreicht je eine Datenbank.
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — der Prüfstand darf nichts versenden.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const Z = await import("../shared/fiaon-global-zusatz");
const { PAKETE, paket, istGlobalPaket, istAboPaket, istGlobalEinzelrechnung, verkaufbarePakete, PAKET_PREISE_EURO, NICHT_ABO_SCHLUESSEL } = await import("../shared/fiaon-pakete");
const { produktkategorie } = await import("../shared/fiaon-produktkategorie");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER, globalWortPruefenEn } = await import("../shared/fiaon-global-wortregeln");
const { GLOBAL_ZUSATZ_PAARE } = await import("../server/mail/vorlagen/global-zusatz");
const { mailRendern, hatVorlage, VORLAGEN_EN, absenderFuer } = await import("../server/mail/motor");
const auftrag = await import("../server/lib/fiaon-global-auftrag");
const { globalAutomatik } = await import("../server/lib/fiaon-global-firma-post");

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");

let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void {
  if (bed) { gut++; return; }
  rot.push(`${text}${fund ? `  →  ${fund}` : ""}`); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`);
}
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

// ═══ 1 KATALOG ═══════════════════════════════════════════════════════════════
abschnitt("1 Katalog");
const SOLL: Record<string, [number, string]> = {
  mobilnummer: [14900, "einmalig"], telefon_ki: [14900, "monatlich"], telefon_persoenlich: [39000, "monatlich"], wohnadresse: [49000, "einmalig"],
  domain: [4900, "jaehrlich"], website: [190000, "einmalig"], website_pflege: [4900, "monatlich"],
};
gleich(Z.GLOBAL_ZUSATZ.map((z) => z.key).sort(), Object.keys(SOLL).sort(), "genau die sieben Dienste des Auftrags");
ok(new Set(Z.GLOBAL_ZUSATZ.map((z) => z.key)).size === Z.GLOBAL_ZUSATZ.length, "kein Schlüssel doppelt");
for (const z of Z.GLOBAL_ZUSATZ) {
  gleich([z.preisCents, z.abrechnung], SOLL[z.key], `${z.key}: Preis und Abrechnung`);
  ok(z.packKey === `global_zusatz_${z.key}` && /^[a-z0-9_]+$/.test(z.packKey), `${z.key}: Paketschlüssel global_zusatz_<key>`, z.packKey);
  ok(Z.GLOBAL_ZUSATZ_GRUPPEN.some((g) => g.gruppe === z.gruppe), `${z.key}: Gruppe bekannt`);
  for (const s of ["de", "en"] as const) {
    const t = z[s];
    ok([t.titel, t.kurz, t.einrichtung, t.rechnung].every((x) => String(x).trim().length > 3), `${z.key}/${s}: Titel, Satz, Einrichtung, Rechnung`);
    ok(t.enthalten.length >= 3 && t.enthalten.every((x) => x.trim().length > 3), `${z.key}/${s}: drei Zeilen „enthalten“`);
  }
  ok(z.de.enthalten.length === z.en.enthalten.length, `${z.key}: gleich viele Zeilen de/en`);
  ok(Z.globalZusatz(z.key) === z && Z.globalZusatzZuPaket(z.packKey) === z && Z.istGlobalZusatzPaket(z.packKey), `${z.key}: Helfer finden den Eintrag`);
}
gleich(Z.globalZusatz("DOMAIN ")?.key, "domain", "Schlüssel getrimmt und kleingeschrieben");
ok(Z.globalZusatz("gibtsnicht") === null && !Z.istGlobalZusatzPaket("global_struktur"), "Unbekanntes ist kein Zusatzdienst; ein Paket ist keiner");
ok(Z.buchbareZusatzdienste().length === Z.GLOBAL_ZUSATZ.filter((z) => z.buchbar).length, "buchbareZusatzdienste filtert nach buchbar");

// ═══ 2 PAKETE ═══════════════════════════════════════════════════════════════
abschnitt("2 Paketkatalog");
for (const z of Z.GLOBAL_ZUSATZ) {
  const p = paket(z.packKey);
  ok(!!p, `${z.packKey}: steht im Paketkatalog`);
  if (!p) continue;
  ok(p.art === "global" && p.abo === false && p.eingestellt === true && p.zahlungsseite === "global" && p.globalZusatz === true, `${z.packKey}: global, kein Abo, eingestellt, Zahlungsseite global, globalZusatz`);
  gleich(p.preisCents, z.preisCents, `${z.packKey}: Preis = Zusatzkatalog`);
  gleich(PAKET_PREISE_EURO[z.packKey], z.preisCents / 100, `${z.packKey}: PACK_PRICES kennt den Preis (bestellungFuerAntrag)`);
  ok(istGlobalPaket(z.packKey) && !istAboPaket(z.packKey) && NICHT_ABO_SCHLUESSEL.includes(z.packKey), `${z.packKey}: Global-Wände, nie eine Rate`);
  ok(istGlobalEinzelrechnung(z.packKey), `${z.packKey}: Einzelrechnung — nie als Dublette stillgelegt`);
  gleich(produktkategorie({ pack_key: z.packKey }), "global", `${z.packKey}: Produktkategorie global (keine Privat-Abläufe)`);
  ok(z.packKey.startsWith("global"), `${z.packKey}: beginnt mit global (LIKE 'global%'-Wände in Mara/WhatsApp)`);
  ok(!verkaufbarePakete().some((x) => x.key === z.packKey), `${z.packKey}: in keiner Paketauswahl`);
  ok(p.rechnung?.zeitraum === Z.zusatzZeitraumText(z.abrechnung, "de"), `${z.packKey}: Rechnungszeitraum aus dem Zusatzkatalog`);
}
gleich(PAKETE.filter((p) => p.globalZusatz).map((p) => p.key).sort(), Z.GLOBAL_ZUSATZ.map((z) => z.packKey).sort(), "keine Zusatzzeile ohne Katalogeintrag");
gleich(verkaufbarePakete("global").map((p) => p.key).sort(), ["global_banking", "global_kapital", "global_struktur", "global_vip"], "die vier Global-Pakete bleiben die einzige Auswahl");

// ═══ 3 WORTWAHL ═══════════════════════════════════════════════════════════════
abschnitt("3 Wortwahl");
// Justin, 22.10.2026: nie Etiketten, Interna oder Anbieter beim Kunden.
const JUSTIN_LISTE = /bank-?tauglich|bank-?grade|echte[rn]? mietvertrag|\bgeprüft|\bpostfach\b|\bpo box\b|premium|truresidence|blueground|twilio|smarty|smith\.?ai|framer|cloudflare|google workspace|provision|commission|marge|margin|empfohl|empfehl|recommend|\bbis zu\b|\bup to\b|northwest/i;
// Der Anbieter „US Mobile“ heißt wie das Wort — nur in seiner Schreibweise mit großem M.
const JUSTIN_VERBOTEN = { test: (t: string) => JUSTIN_LISTE.test(t) || /\bUS Mobile\b/.test(t) };
const texteDe: [string, string][] = []; const texteEn: [string, string][] = [];
function sammle(wert: unknown, pfad: string, aus: [string, string][]) {
  if (typeof wert === "string") { if (wert.trim()) aus.push([pfad, wert]); return; }
  if (typeof wert === "function") { try { sammle((wert as (...a: string[]) => unknown)("Muster", "Muster", "Muster"), `${pfad}()`, aus); } catch { /* egal */ } return; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => sammle(x, `${pfad}[${i}]`, aus)); return; }
  if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) sammle(v, `${pfad}.${k}`, aus);
}
for (const z of Z.GLOBAL_ZUSATZ) { sammle({ ...z.de, angabe: z.angabe?.de }, `zusatz/${z.key}/de`, texteDe); sammle({ ...z.en, angabe: z.angabe?.en }, `zusatz/${z.key}/en`, texteEn); }
sammle(Z.ZUSATZ_WOERTER.de, "woerter/de", texteDe); sammle(Z.ZUSATZ_WOERTER.en, "woerter/en", texteEn);
sammle(Z.GLOBAL_ZUSATZ_GRUPPEN.map((g) => g.de), "gruppen/de", texteDe); sammle(Z.GLOBAL_ZUSATZ_GRUPPEN.map((g) => g.en), "gruppen/en", texteEn);
sammle(GLOBAL_ZUSATZ_PAARE.global_zusatz.de, "mail/de", texteDe); sammle(GLOBAL_ZUSATZ_PAARE.global_zusatz.en, "mail/en", texteEn);
const deTreffer = (t: string) => [...wandPruefen(t, ["aufgabe_an_betreuer"]).map((x) => x.hinweis), ...GLOBAL_SCHAERFER.filter((r) => r.muster.test(t)).map((r) => r.grund)];
for (const [p, t] of texteDe) {
  for (const h of deTreffer(t)) ok(false, `${p}: „${t.slice(0, 70)}“`, h);
  ok(!JUSTIN_VERBOTEN.test(t), `${p}: Etikett/Anbieter/Marge beim Kunden`, t.slice(0, 80));
  ok(!/\b(du|dein|deine|dir|dich)\b/i.test(t), `${p}: nicht in Sie-Form`, t.slice(0, 80));
}
for (const [p, t] of texteEn) {
  for (const h of globalWortPruefenEn(t)) ok(false, `${p}: „${t.slice(0, 70)}“`, h.hinweis);
  ok(!JUSTIN_VERBOTEN.test(t), `${p}: label/provider/margin shown to the client`, t.slice(0, 80));
}
ok(texteDe.length > 80 && texteEn.length > 80, "genug Texte gesammelt", `${texteDe.length}/${texteEn.length}`);
// Die internen Notizen DÜRFEN Anbieter nennen — und stehen in keiner Kundenfläche.
const portal = datei("client/src/pages/global-portal-dienste.tsx");
ok(!/\.intern\b/.test(portal), "Portal liest nie das interne Feld");
{
  // Ein Textknoten mit mindestens zwei Wörtern zwischen „>“ und „<“ wäre ein fester Satz im JSX.
  const fest = portal.match(/>[ \t]*[A-Za-zÄÖÜäöüß]+(?:[ \t]+[A-Za-zÄÖÜäöüß]+)+[ \t]*</g);
  ok(!fest, "Portal: kein fester Text im JSX — alles aus shared/", String(fest?.slice(0, 3)));
}

// ═══ 4 PREIS UND ANGABE ═════════════════════════════════════════════════════
abschnitt("4 Preis und Angabe");
const zk = (k: string) => Z.globalZusatz(k)!;
gleich(Z.zusatzPreisText(zk("mobilnummer")), "149 € einmalig", "149 € einmalig");
gleich(Z.zusatzPreisText(zk("telefon_ki")), "149 € im Monat", "149 € im Monat");
gleich(Z.zusatzPreisText(zk("domain")), "49 € im Jahr", "49 € im Jahr");
gleich(Z.zusatzPreisText(zk("website")), "1.900 € einmalig", "1.900 € einmalig");
gleich(Z.zusatzPreisText(zk("telefon_persoenlich"), "en"), "€390 per month", "€390 per month");
gleich(Z.zusatzPreisText({ preisCents: 4990, abrechnung: "einmalig" }), "49,90 € einmalig", "Cent-Beträge mit Komma");
const dom = zk("domain");
ok(Z.zusatzAngabePruefen(dom, "").ok === false, "Wunschdomain ist Pflicht");
gleich(Z.zusatzAngabePruefen(dom, " https://www.Muster-LLC.com/ "), { ok: true, wert: "muster-llc.com" }, "Wunschdomain wird bereinigt");
gleich(Z.zusatzAngabePruefen(dom, "muster.co.uk"), { ok: true, wert: "muster.co.uk" }, "mehrteilige Endung");
for (const schlecht of ["muster", "-muster.com", "mu ster.com", "muster..com", "muster.c", "a".repeat(64) + ".com", "<script>.com"]) ok(Z.zusatzAngabePruefen(dom, schlecht).ok === false, `ungültige Domain abgelehnt: ${schlecht.slice(0, 20)}`);
gleich(Z.zusatzAngabePruefen(zk("website"), "egal"), { ok: true, wert: null }, "ohne Angabe-Feld: nichts gespeichert");
ok(/name\.com/.test((Z.zusatzAngabePruefen(dom, "x", "en") as any).error ?? ""), "Fehlertext englisch");

// ═══ 5 IDEMPOTENZ UND STATUS ════════════════════════════════════════════════
abschnitt("5 Idempotenz und Status");
gleich(Z.zusatzKlickEntscheidung(null), "neu", "erster Klick: neu");
gleich(Z.zusatzKlickEntscheidung({ status: "storniert", bestellRef: "R", rechnungSteht: true }), "neu", "nach Storno: neu");
gleich(Z.zusatzKlickEntscheidung({ status: "gebucht", bestellRef: null, rechnungSteht: false }), "weiter", "Buchung ohne Zeile: weiter");
gleich(Z.zusatzKlickEntscheidung({ status: "gebucht", bestellRef: "R", rechnungSteht: false }), "weiter", "Zeile ohne Rechnung: weiter");
gleich(Z.zusatzKlickEntscheidung({ status: "gebucht", bestellRef: "R", rechnungSteht: true }), "schon", "zweiter Klick: bestehende Buchung, nichts Neues");
gleich(["bezahlt", "aktiv"].map((st) => Z.zusatzKlickEntscheidung({ status: st as any, bestellRef: "R", rechnungSteht: true })), ["schon", "schon"], "bezahlt/aktiv: nichts Neues");
ok(Z.zusatzWechselErlaubt("gebucht", "bezahlt") && Z.zusatzWechselErlaubt("bezahlt", "aktiv") && Z.zusatzWechselErlaubt("aktiv", "storniert"), "Weg gebucht → bezahlt → aktiv → storniert");
ok(!Z.zusatzWechselErlaubt("storniert", "aktiv") && !Z.zusatzWechselErlaubt("aktiv", "gebucht") && !Z.zusatzWechselErlaubt("bezahlt", "gebucht") && !Z.zusatzWechselErlaubt("gebucht", "quatsch"), "kein Weg zurück, nichts aus Storno");

// ═══ 6 WAS DER AUFTRAG SCHON ENTHÄLT ════════════════════════════════════════
abschnitt("6 Auftrag enthält");
const frei = (auftrag: Parameters<typeof Z.globalZusatzVerfuegbar>[0]) => Z.GLOBAL_ZUSATZ.filter((z) => Z.globalZusatzVerfuegbar(auftrag, z.key).verfuegbar).map((z) => z.key).sort();
const alle = Z.GLOBAL_ZUSATZ.map((z) => z.key).sort();
for (const p of ["global_struktur", "global_banking", "global_kapital", "global_vip", "global_individuell"]) gleich(frei({ paketKey: p }), alle, `${p}: alle Dienste buchbar (Paket enthält nur die Standardnummer/-adresse)`);
for (const f of ["IA-KAPITAL-2026-10", "IA-BEGLEIT-1", "IA-2026-10-01"]) gleich(frei({ paketKey: "global_individuell", angebotFassung: f }), alle, `${f}: alle Dienste buchbar`);
gleich(frei({ paketKey: "global_individuell", angebotFassung: "IA-FIRMA-2026-10-A" }), ["mobilnummer", "telefon_ki", "wohnadresse"], "Firmenangebot: Assistenz persönlich, Domain, Website, Betreuung sind enthalten");
gleich(Z.globalZusatzVerfuegbar({ angebotFassung: "ia-firma-x" }, "website"), { verfuegbar: false, grund: "enthalten" }, "Fassung unabhängig von Groß/klein");
gleich(Z.globalZusatzVerfuegbar(null, "website"), { verfuegbar: true, grund: null }, "ohne Auftrag: buchbar");
gleich(Z.globalZusatzVerfuegbar({ paketKey: "global_vip" }, "gibtsnicht"), { verfuegbar: false, grund: "nicht_buchbar" }, "unbekannter Dienst: nicht buchbar");
// Was „enthalten“ heißt, steht im Leistungstext des Firmenangebots — die Tabelle ist an ihn gebunden.
const firmaText = datei("shared/fiaon-global-angebot-firma.ts");
ok(/Telefonannahme unter Ihrer US-Nummer/.test(firmaText) && /Website, SEO/.test(firmaText) && /Domains und E-Mail/.test(firmaText), "Firmenangebot nennt Telefonannahme, Website und Domains/E-Mail (Grundlage der Tabelle)");

// ═══ 7 RECHNUNG UND MAIL ════════════════════════════════════════════════════
abschnitt("7 Rechnung und Mail");
gleich(Z.zusatzRechnungsZeile("global_zusatz_telefon_ki"), { beschreibung: "Telefonassistenz rund um die Uhr — Digitale Annahme der Anrufe auf der US-Nummer, Tag und Nacht", zeitraum: "erster Monat" }, "Rechnungszeile de, erster Monat");
gleich(Z.zusatzRechnungsZeile("global_zusatz_domain", "en", "muster.com")?.zeitraum, "first year", "Rechnungszeile en, erstes Jahr");
ok(/\(muster\.com\)$/.test(Z.zusatzRechnungsZeile("global_zusatz_domain", "de", "muster.com")?.beschreibung ?? ""), "Wunschdomain steht auf der Rechnung");
ok(Z.zusatzRechnungsZeile("global_struktur") === null, "ein Paket bekommt keine Zusatzzeile");
for (const z of Z.GLOBAL_ZUSATZ) for (const s of ["de", "en"] as const) ok(!z[s].rechnung.toLowerCase().includes(z[s].titel.toLowerCase()), `${z.key}/${s}: Rechnungszeile wiederholt den Titel nicht`);
const paar = GLOBAL_ZUSATZ_PAARE.global_zusatz;
const platz = (b: unknown) => Array.from(new Set(Array.from(JSON.stringify(b).matchAll(/\{\{params\.([a-z_0-9]+)\}\}/g), (m) => m[1]))).sort();
gleich(platz(paar.en), platz(paar.de), "Platzhalter de/en gleich");
gleich([paar.en.knopf?.url, paar.en.knopf2?.url, paar.en.daten?.length, paar.en.absaetze.length], [paar.de.knopf?.url, paar.de.knopf2?.url, paar.de.daten?.length, paar.de.absaetze.length], "Aufbau de/en gleich");
ok(!/\{\{/.test(paar.de.titel) && !/\{\{/.test(paar.en.titel), "kein Platzhalter im Titel (Textteil in Großbuchstaben)");
ok(hatVorlage("global_zusatz") && !!VORLAGEN_EN.global_zusatz, "global_zusatz im Motor (de + en)");
ok(/accounting|buchhaltung/i.test(JSON.stringify(absenderFuer("global_zusatz"))) || absenderFuer("global_zusatz").email !== absenderFuer("global_start").email, "Absender: Buchhaltung");
ok(globalAutomatik("System (Zusatzdienst im Portal gebucht)"), "Die Rechnungsmail zählt als Automatik — die Wand des Firmenangebots (E-301) greift");
// Die echte Nutzlast: Akte des Mandats + Zusatzzeile; der Link und die Nummer gehören zum MANDAT, Betrag zum Dienst.
const akte = { ref: "FIAON-PRUEF-MANDAT", paket_key: "global_kapital", email: "m.muster@muster-gmbh.example", vertrag_sprache: "de", firma: { name: "Muster GmbH" }, ansprechpartner: { anrede: "Herr", vorname: "Max", nachname: "Muster" } };
const zeile = { ref: "FIAON-PRUEF-ZUSATZ", pack_key: "global_zusatz_telefon_ki", amount_due: "149.00", payment_reference: "FIAON-Z1Y2X3", payment_due_date: "2026-10-29T10:00:00Z", person_id: null };
for (const s of ["de", "en"] as const) {
  const z = zk("telefon_ki");
  const n = auftrag.globalMailNutzlast({ ...akte, vertrag_sprache: s }, zeile, {
    ansprechpartner: "Herr Beispiel", token: null,
    zusatz: { antrag_id: akte.ref, mein_auftrag_url: `https://www.fiaon.com/business/auftrag/${akte.ref}?t=1.abc`, paket: z[s].titel, zusatz_titel: z[s].titel, betrag_text: Z.zusatzPreisText(z, s), zusatz_einrichtung: z[s].einrichtung, rechnungsnummer: "RE-2026-0001" },
  });
  ok(n.antrag_id === akte.ref && n.mein_auftrag_url.includes(akte.ref) && !n.mein_auftrag_url.includes(zeile.ref), `${s}: Link und Nummer des MANDATS, nicht der Zusatzzeile`);
  ok(n.betrag_text === Z.zusatzPreisText(z, s) && !/6\.999|6,999/.test(n.betrag_text), `${s}: Betrag des Dienstes, nicht des Pakets`);
  ok(n.payment_reference === zeile.payment_reference && n.zahlungsseite_url.includes(zeile.payment_reference), `${s}: Zahlungsseite der Zusatzzeile`);
  const mail = mailRendern("global_zusatz", n);
  ok(!!mail && mail.fehlend.length === 0, `${s}: rendert ohne leeren Platzhalter`, mail?.fehlend.join(", "));
  if (!mail) continue;
  ok(mail.html.includes("FIAON Global") && mail.html.includes(z[s].titel) && mail.html.includes("RE-2026-0001"), `${s}: Kopf, Dienst und Rechnungsnummer`);
  ok(!/\{\{|\}\}|undefined|null/.test(mail.text), `${s}: kein Platzhalter-Rest`);
  ok(!/\b[A-Z]{2}\d{2}[ ]?\d{4}[ ]?\d{4}/.test(mail.text), `${s}: keine Bankdaten im Text`);
  const ohneLinks = mail.text.replace(/https?:\/\/\S+/g, "");
  if (s === "de") for (const h of deTreffer(ohneLinks)) ok(false, `Mail de: Wortwahl`, h);
  else for (const h of globalWortPruefenEn(ohneLinks)) ok(false, "Mail en: Wortwahl", h.hinweis);
}

// ═══ 8 VERDRAHTUNG (Quelltext) ══════════════════════════════════════════════
abschnitt("8 Verdrahtung");
const lib = datei("server/lib/fiaon-global-zusatz.ts");
const mig = datei("db/migrations/120_global_zusatz.sql");
const spalten = (t: string) => Array.from((t.match(/CREATE TABLE IF NOT EXISTS fiaon_global_zusatz \(([\s\S]*?)\n\s*\)/)?.[1] ?? "").matchAll(/^\s*([a-z_]+)\s+[A-Z]/gm), (m) => m[1]).sort();
ok(spalten(lib).length >= 18, "ensureZusatzTabelle legt die Tabelle an", String(spalten(lib).length));
gleich(spalten(mig), spalten(lib), "Migration 120 = ensureZusatzTabelle (Spalten)");
const IDX = "(ref, zusatz_key) WHERE status <> 'storniert'";
ok(lib.includes(`ON fiaon_global_zusatz ${IDX}`) && mig.includes(`ON fiaon_global_zusatz ${IDX}`), "Teilindex in Server und Migration gleich");
ok(lib.includes(`ON CONFLICT ${IDX} DO NOTHING`), "ON CONFLICT nennt dasselbe Prädikat wie der Index (sonst 42P10)");
const ga = datei("server/lib/fiaon-global-auftrag.ts");
const nach = ga.slice(ga.indexOf("export async function globalNachZahlung"));
ok(nach.indexOf("globalZusatz") > 0 && nach.indexOf("globalZusatz") < nach.indexOf("istAngebotsPaket(b.pack_key)"), "globalNachZahlung zweigt für Zusatzdienste VOR dem Angebot und dem Start ab");
ok(/"global_zusatz"/.test(ga.slice(ga.indexOf("export type GlobalMail"), ga.indexOf("export type GlobalMailSprache"))), "GlobalMail kennt global_zusatz");
ok(/AUFTRAG_SCHLUESSEL\}\) AND a\.merged_into IS NULL/.test(ga) && /!p\.globalZusatz/.test(ga), "Liste der Aufträge ohne Zusatzzeilen");
const route = datei("server/routes/fiaon-global-bereich.ts");
const r = route.slice(route.indexOf('router.post("/global/mein-auftrag/:ref/zusatz"'));
ok(r.indexOf("zutritt(req, res)") > 0 && r.indexOf("zutritt(req, res)") < r.indexOf("istVorschau") && r.indexOf("istVorschau") < r.indexOf("zusatzJeRef(ref)") && r.indexOf("zusatzJeRef(ref)") < r.indexOf("zusatzBuchen"), "Route: Token → Vorschau → Drossel → Buchen");
ok(/istRoboterUnterschrift/.test(lib) && /ist_test_am/.test(lib) && /l\.status === "storniert"/.test(lib), "Buchen: Roboter-, Test- und Storno-Wand");
ok(/globalZusatzVerfuegbar\(await zusatzAuftragLesen\(ref\)/.test(lib), "Buchen: was der Auftrag enthält, wird nie berechnet");
ok(/bestellungFuerAntrag\(bestellRef, \{ globalMailFolgt: true \}\)/.test(lib) && /globalMailSenden\("global_zusatz"/.test(lib), "Kette: Bestellung mit Rechnungsnummer → Mail über globalMailSenden");
ok(lib.indexOf("zeileWieMandat(bestellRef, ref)") > 0 && lib.indexOf("zeileWieMandat(bestellRef, ref)") < lib.indexOf("bestellungFuerAntrag(bestellRef"), "USt-Modus des Mandats VOR der Rechnungsnummer");
ok(/rechnung_am IS NULL RETURNING id/.test(lib), "Mail, Verlauf und Aufgabe genau einmal (Marke rechnung_am)");
const chef = datei("server/routes/fiaon-chef-global.ts");
ok(/"\/chef\/global\/mandate\/:ref\/zusatz\/:id\/status", requireChef\("leitung"\)/.test(chef), "Chef-Route Status auf Stufe Leitung");
const cg = datei("client/src/components/admin/ChefGlobal.tsx");
ok(/key: "leistungen", titel: "Leistungen"/.test(cg) && /reiter === "leistungen" && <Leistungen/.test(cg), "Chefbüro: Reiter „Leistungen“ mit Inhalt");
const gp = datei("client/src/pages/global-portal.tsx");
ok(/"dienste"/.test(gp.slice(gp.indexOf("const SEITEN"), gp.indexOf("const NAV_GRUPPEN"))) && /seite === "dienste" && \(/.test(gp), "Portal: Seite „dienste“ mit Inhalt");
ok(/ZUSATZ_WOERTER\[s\]\.tunTitel/.test(gp), "Portal: offene Rechnung unter „Für Sie zu tun“");
{
  const css = datei("client/src/styles/global-portal-dienste.css").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(/prefers-reduced-motion/.test(css) && !/gold|#c9a|#d4af|#b8860b|#daa520/i.test(css), "CSS: Bewegung abschaltbar, kein Gold");
}

// ═══ 9 GEGENPROBE ═══════════════════════════════════════════════════════════
abschnitt("9 Gegenprobe — die Prüfungen schlagen an");
for (const [satz, was] of [["Bis zu 3 Nummern", "bis zu"], ["Eingerichtet binnen 3 Tagen", "Frist mit Ziffer"], ["Unser empfohlener Dienst", "empfohlen"]] as const) ok(deTreffer(satz).length > 0, `Wand erkennt „${was}“`);
for (const satz of ["Bank-taugliche Nummer", "Premium-Website", "Partner TruResidence", "Adresse geprüft", "kein Postfach"]) ok(JUSTIN_VERBOTEN.test(satz), `Justins Liste erkennt „${satz}“`);
ok(globalWortPruefenEn("We recommend this").length > 0 && globalWortPruefenEn("set up within 3 days").length > 0, "englische Wand erkennt recommend / Frist mit Ziffer");
ok(Z.zusatzKlickEntscheidung({ status: "gebucht", bestellRef: "R", rechnungSteht: true }) !== "neu", "Idempotenz: eine bestehende Buchung ergibt nie „neu“");

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
