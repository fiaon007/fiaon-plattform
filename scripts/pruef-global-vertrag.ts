// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER AUFTRAG ÜBER FIAON GLOBAL (17.09.2026, E-188)
//
// Ohne Datenbank, ohne Netz, ohne Browser. Geprüft wird der TEXT — also das,
// was ein Unternehmen unterschreibt — für alle vier Pakete in Deutsch und
// Englisch, dazu die drei Kundenmails und die Eingabeprüfung des Bestellwegs:
//
//   1. Alle Pflichtziffern vorhanden und fortlaufend nummeriert.
//   2. Der Preis im Vertrag ist der Katalogpreis (shared/fiaon-pakete.ts).
//   3. Pflichthinweise, Planungssatz und Geld-zurück-Zusage stehen wörtlich drin.
//   4. Jede Leistung ist ausgeschrieben — kein „Alles aus …".
//   5. Vorschau (vor der Unterschrift) und PDF-Rumpf tragen DENSELBEN Text.
//   6. Eingaben werden entschärft (kein HTML aus dem Firmennamen).
//   7. Die Wortwand (shared/fiaon-wortverbote.ts) über den deutschen Text,
//      eine englische Gegenprobe über den englischen — JEDER Treffer wird
//      gelistet.
//   8. Die drei Mails: kein Platzhalter ohne Wert, Wortwand, keine Bankdaten.
//   9. Die Eingabeprüfung: Pflichtfelder, Land, Telefon nur DE/AT/CH,
//      USt-IdNr., vier Bestätigungen, echtes PNG, Honigtopf; das Token.
//  10. Der Auftrag einer PRIVATPERSON (19.09.2026, E-191): Parteien, Ziffer 5/9/
//      11/12, die gesetzliche Widerrufsbelehrung als Anlage (im Hash-Rumpf),
//      Wortwand; Eingabeprüfung, Widerrufsfrist-Rechnung, Startmail-Liste.
//  11. Die JAHRESBETREUUNG (19.09.2026, E-196): Vertrag mit und ohne — zwölf
//      Ziffern, Vertragssprache, der Absatz in Ziffer 2, 3 und 5 an seiner Stelle,
//      699 € und der Satz zur Staatsgebühr NUR wenn gebucht, kein Widerspruch zum
//      Satz über die laufenden Kosten, Endpreis für Privatpersonen, Fassung;
//      Eingabeprüfung (nur echtes true), die Hinweiszeile auf der Rechnung, und
//      dass die Sätze nirgends in den Anzeige-Dateien kopiert stehen.
//
// Aufruf: npx tsx scripts/pruef-global-vertrag.ts        (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import { deflateSync } from "node:zlib";

// Der Bestellweg lädt den Datenbank-Pool beim Import. Er verbindet sich erst bei der ersten
// Abfrage — und dieser Prüfstand stellt keine. Damit das auch dann gilt, wenn in der Umgebung
// die Produktionsadresse steht, zeigt die Adresse hier ins Leere.
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";

const { PAKETE, paketPreisCents } = await import("../shared/fiaon-pakete");
const { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_GELD_ZURUECK, GLOBAL_VERTRAG_VERSION, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND_VERTRAG, globalPlanungText, inVertragssprache } = await import("../shared/fiaon-global");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const vertrag = await import("../server/lib/fiaon-global-vertrag");
const { mailRendern } = await import("../server/mail/motor");
const auftrag = await import("../server/lib/fiaon-global-auftrag");

let fehler = 0; let geprueft = 0;
const ok = (bedingung: boolean, was: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  FEHLER  ${was}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(3, 70 - t.length))}`);

// ── Ein echtes PNG, wie es das Unterschriften-Pad liefert ───────────────────
function crc32(b: Buffer): number {
  let c = ~0;
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function stueck(typ: string, daten: Buffer): Buffer {
  const kopf = Buffer.alloc(4); kopf.writeUInt32BE(daten.length);
  const rumpf = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(rumpf));
  return Buffer.concat([kopf, rumpf, crc]);
}
function probePng(): string {
  const w = 160, h = 48;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const roh = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) roh[y * (w + 1) + 1 + x] = (x * 7 + y * 13 + ((x * y) % 11) * 17) % 251;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), stueck("IHDR", ihdr), stueck("IDAT", deflateSync(roh)), stueck("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}
const PNG = probePng();

const FIRMA = { name: "Muster & Söhne <b>GmbH</b>", rechtsform: "GmbH", registergericht: "Amtsgericht München", registernummer: "HRB 123456", strasse: "Beispielweg 12", plz: "80331", ort: "München", land: "DE", ustId: "DE123456789" };
const PERSON = { anrede: "Herr", vorname: "Max", nachname: "Muster", funktion: "Geschäftsführer" };
const ohneSignatur = (t: string) => t.replace(/(Für FIAON|For FIAON)[\s\S]*$/, "").trim();

// ═══ 1–7: DER VERTRAG ═══════════════════════════════════════════════════════
const wandTreffer: string[] = [];
const hinweise: string[] = [];
for (const p of GLOBAL_PAKETE) {
  for (const sprache of ["de", "en"] as const) {
    abschnitt(`Vertrag ${p.key} · ${sprache}`);
    const daten = { paket: p.key, sprache, firma: FIRMA, ansprechpartner: PERSON } as any;
    const vorschau = vertrag.globalVertragVorschauHtml(daten);
    const text = vertrag.globalVertragText(daten);
    const signiert = { ...daten, ref: "FIAON-PRUEFSTAND-0001", unterschrift: { png: PNG, am: new Date("2026-09-17T10:30:00Z"), ip: "203.0.113.7", hash: "a".repeat(64) } };
    const rumpfSigniert = vertrag.globalVertragRumpfHtml(signiert);
    const textSigniert = vertrag.globalVertragText(signiert);

    // 1 · Pflichtziffern
    const erwartet = vertrag.GLOBAL_VERTRAG_ZIFFERN[sprache].filter((_, i) => i !== 5 || GLOBAL_GELD_ZURUECK.aktiv);
    const gefunden = Array.from(vorschau.matchAll(/<h2><span class="gv-nr">(\d+)<\/span>([^<]+)<\/h2>/g)).map((m) => `${m[1]} ${m[2]}`);
    ok(gefunden.length === erwartet.length, `${erwartet.length} Ziffern erwartet, ${gefunden.length} gefunden`);
    erwartet.forEach((t, i) => ok(gefunden[i] === `${i + 1} ${t.replace(/&/g, "&amp;")}`, `Ziffer ${i + 1} „${t}“ fehlt oder steht an falscher Stelle (gefunden: ${gefunden[i] ?? "—"})`));

    // 2 · Preis = Katalog
    const cents = paketPreisCents(p.key);
    const katalog = PAKETE.find((k) => k.key === p.key);
    ok(!!katalog && katalog.art === "global" && katalog.abo === false && !katalog.eingestellt, "Katalog: Art global, kein Abo, nicht eingestellt");
    const preisText = sprache === "en"
      ? "€" + (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })
      : (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
    ok(cents > 0 && text.includes(preisText), `Katalogpreis ${preisText} steht nicht im Vertrag`);
    const fremdePreise = PAKETE.filter((k) => k.art === "global" && k.key !== p.key && k.preisCents !== cents)
      .map((k) => (k.preisCents / 100).toLocaleString(sprache === "en" ? "en-GB" : "de-DE", { minimumFractionDigits: 2 }));
    ok(!fremdePreise.some((f) => text.includes(f)), "Im Vertrag steht der Preis eines ANDEREN Pakets");

    // 3 · Wörtliche Sätze
    for (const satz of GLOBAL_PFLICHTHINWEIS[sprache]) ok(text.includes(satz), `Pflichthinweis fehlt: „${satz.slice(0, 60)}…“`);
    ok(text.includes(globalPlanungText(p.key, sprache)), `Planungsgröße ${globalPlanungText(p.key, sprache)} fehlt`);
    ok(sprache === "de" ? text.includes("ein bestimmtes Ergebnis ist nicht geschuldet") : text.includes("no particular result is owed"), "Satz „kein bestimmtes Ergebnis geschuldet“ fehlt");
    if (GLOBAL_GELD_ZURUECK.aktiv) {
      ok(text.includes(GLOBAL_GELD_ZURUECK[sprache].vertrag), "Geld-zurück-Zusage (Vertragssprache) steht nicht wörtlich im Vertrag");
      ok(text.includes(GLOBAL_GELD_ZURUECK[sprache].vertragBedingungen), "Bedingungen der Geld-zurück-Zusage (Vertragssprache) stehen nicht wörtlich im Vertrag");
    }
    ok(vorschau.includes(GLOBAL_VERTRAG_VERSION), "Vertragsversion fehlt in der Unterzeile");
    ok(text.startsWith(vertrag.globalVertragTitel(p.key, sprache)), "Titel stimmt nicht");
    ok(text.includes(p[sprache].dauer), "Dauer-Satz des Pakets fehlt");
    ok(text.includes("17318250") && text.includes("128 City Road"), "Pflichtangaben der FIAON LTD fehlen");

    // 4 · Leistungen ausgeschrieben
    const leistungen = vertrag.globalLeistungenVollstaendig(p.key, sprache);
    ok(leistungen.length >= p[sprache].leistungen.length, "Leistungsliste kürzer als die Tafel");
    ok(!/Alles aus |Everything in /.test(text), "„Alles aus …“ steht im Vertrag — Leistungen müssen ausgeschrieben sein");
    for (const l of leistungen) ok(text.includes(inVertragssprache(l, sprache)), `Leistung fehlt: „${l}“`);

    // 4b · Vertragssprache (18.09.2026): Der Vertrag spricht über die Parteien, nicht zu ihnen.
    const ansprache = sprache === "de" ? /\b(Ihr|Ihre|Ihrer|Ihrem|Ihren|Ihres|Ihnen|[Uu]nser\w*|[Ww]ir)\b/g : /\b(your|our|we|you|Your|Our|We|You)\b/g;
    const angesprochen = Array.from(new Set(ohneSignatur(text).match(ansprache) ?? []));
    ok(angesprochen.length === 0, `Kundenansprache im Vertrag: ${angesprochen.join(", ")} — Ersetzung in VERTRAGSSPRACHE (shared/fiaon-global.ts) ergänzen`);
    for (const z of GLOBAL_INKLUSIVE[sprache]) ok(text.includes(inVertragssprache(z, sprache)), `Festpreis-Posten fehlt im Vertrag: „${z}“`);
    ok(text.includes(GLOBAL_LAUFEND_VERTRAG[sprache]), "Satz zu den laufenden Kosten ab dem zweiten Jahr fehlt");

    // 5 · Vorschau und unterschriebene Fassung: derselbe Text
    ok(ohneSignatur(text) === ohneSignatur(textSigniert), "Der Text VOR der Unterschrift weicht vom unterschriebenen ab");
    ok(!vorschau.includes('class="sig-img"') && rumpfSigniert.includes('class="sig-img"') && rumpfSigniert.includes("a".repeat(64)), "Unterschriftsblock: Bild/Hash nur in der unterschriebenen Fassung");
    ok(textSigniert.includes("203.0.113.7") && textSigniert.includes(sprache === "en" ? "executed electronically" : "elektronisch ausgefertigt"), "Unterschriftsblock unvollständig");

    // 6 · Entschärfung
    ok(!vorschau.includes("<b>GmbH</b>") && vorschau.includes("Muster &amp; Söhne &lt;b&gt;GmbH&lt;/b&gt;"), "Firmenname wird nicht entschärft");

    // 7 · Wortwahl
    if (sprache === "de") {
      for (const t of wandPruefen(text)) { wandTreffer.push(`${p.key}: [${t.art}] „${t.treffer}“ — ${t.hinweis}`); ok(false, `Wortwand [${t.art}] „${t.treffer}“`); }
    } else {
      // „personal guarantee" ist der Rechtsbegriff für die persönliche Haftung des Inhabers — er steht im
      // Pflichthinweis aus shared/fiaon-global.ts und warnt, statt zu versprechen. Gemeldet wird er trotzdem.
      for (const m of text.matchAll(/\b(guarantee[sd]?|advice|recommend\w*|affiliate\w*)\b/gi)) {
        const davor = text.slice(Math.max(0, m.index! - 12), m.index!);
        if (/personal\s$/i.test(davor)) { hinweise.push(`${p.key}/en: „personal ${m[0]}“ — Rechtsbegriff im Pflichthinweis (persönliche Haftung), kein Versprechen`); continue; }
        wandTreffer.push(`${p.key}/en: „${m[0]}“`); ok(false, `Wortwahl (EN) „${m[0]}“`);
      }
    }
    console.log(`  ${gefunden.length} Ziffern · ${leistungen.length} Leistungen · Preis ${preisText} · ${text.length} Zeichen`);
  }
}

// ═══ 8: DIE MAILS ═══════════════════════════════════════════════════════════
abschnitt("Kundenmails global_auftrag · global_start · global_stichtag");
const NUTZLAST = {
  email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur",
  betrag_text: "2.499,00 €", antrag_id: "FIAON-PRUEFSTAND-0001", payment_reference: "FIAON-A1B2C3", faellig_am_text: "24.09.2026",
  zahlungsseite_url: "https://fiaon.com/zahlung/FIAON-A1B2C3", ansprechpartner: "Herr Beispiel", stichtag_text: "30.10.2026",
  unterlagen_liste: "· Reisepass<br />· Adressnachweis",
};
// `global_start` sagt „Ihr Ansprechpartner … meldet sich bei Ihnen". Gedeckt ist das, weil der Versand
// erst NACH der Aufgabe „US-Struktur starten" geschieht (globalNachZahlung) — hier wie dort dieselbe Deckung.
const GEDECKT: Record<string, string[]> = { global_start: ["aufgabe_an_betreuer"] };
for (const event of ["global_auftrag", "global_start", "global_stichtag"]) {
  const mail = mailRendern(event, NUTZLAST);
  ok(!!mail, `Vorlage ${event} fehlt im Motor`);
  if (!mail) continue;
  ok(mail.fehlend.length === 0, `${event}: Platzhalter ohne Wert — ${mail.fehlend.join(", ")}`);
  ok(!/Bonität ist machbar|keine Löschung berechtigter Einträge|Ihr Ziel bleibt die eigene Karte/.test(mail.html), `${event}: trägt Sätze der Privatkundenlinie`);
  ok(mail.html.includes("FIAON Global"), `${event}: Kopfsatz „FIAON Global“ fehlt`);
  ok(!/\b[A-Z]{2}\d{2}[ ]?\d{4}[ ]?\d{4}/.test(mail.text), `${event}: Bankdaten im Mailtext`);
  for (const t of wandPruefen(mail.text, GEDECKT[event] ?? [])) { wandTreffer.push(`${event}: [${t.art}] „${t.treffer}“ — ${t.hinweis}`); ok(false, `${event}: Wortwand [${t.art}] „${t.treffer}“`); }
  const ungedeckt = wandPruefen(mail.text).filter((t) => t.art === "zusage");
  console.log(`  ${event}: Betreff „${mail.betreff}“ · Absender ${mail.absender.name}${ungedeckt.length ? ` · Zusage „${ungedeckt.map((u) => u.treffer).join("“, „")}“ — gedeckt durch die Start-Aufgabe` : ""}`);
}
ok(mailRendern("global_auftrag", NUTZLAST)?.html.includes("https://fiaon.com/zahlung/FIAON-A1B2C3") === true, "global_auftrag: Knopf zur Zahlungsseite fehlt");

// ═══ 9: DIE EINGABEPRÜFUNG ══════════════════════════════════════════════════
abschnitt("Eingabeprüfung des Bestellwegs");
const GUT = () => ({
  paket: "global_struktur",
  firma: { land: "DE", name: "Muster GmbH", rechtsform: "GmbH", strasse: "Beispielweg 12", plz: "80331", ort: "München", ustId: "DE 123 456 789" },
  ansprechpartner: { anrede: "Herr", vorname: "Max", nachname: "Muster", funktion: "Geschäftsführer", email: "M.Muster@Muster-GmbH.example", telefon: "0171 1234567" },
  bestaetigungen: { vertrag: true, pflichthinweis: true, unternehmer: true, vertretung: true },
  unterschriftPng: PNG, falle: "",
});
const gut = auftrag.globalAuftragPruefen(GUT());
ok(gut.ok === true, `vollständige Eingabe wird abgelehnt: ${(gut as any).error}`);
if (gut.ok) {
  ok(gut.daten.ansprechpartner.telefon === "+491711234567", `Telefon nicht normalisiert: ${gut.daten.ansprechpartner.telefon}`);
  ok(gut.daten.ansprechpartner.email === "m.muster@muster-gmbh.example", "E-Mail nicht kleingeschrieben");
  ok(gut.daten.firma.ustId === "DE123456789", `USt-IdNr. nicht normalisiert: ${gut.daten.firma.ustId}`);
  ok(gut.daten.sprache === "de", "Sprache: Vorgabe de");
}
const abgelehnt = (aendern: (b: any) => void, feld: string | undefined, was: string) => {
  const b = GUT(); aendern(b);
  const p = auftrag.globalAuftragPruefen(b);
  ok(!p.ok && (p as any).feld === feld && /Sie|Ihre|Bitte/.test((p as any).error || ""), `${was} — erwartet Ablehnung am Feld ${feld ?? "—"}, bekam ${p.ok ? "Annahme" : `${(p as any).feld}: ${(p as any).error}`}`);
};
abgelehnt((b) => { b.paket = "business_pro"; }, "paket", "eingestelltes Business-Abo");
abgelehnt((b) => { b.paket = "ultra"; }, "paket", "Privatpaket");
abgelehnt((b) => { b.firma.land = "FR"; }, "firma.land", "Land außerhalb DE/AT/CH");
abgelehnt((b) => { b.firma.name = ""; }, "firma.name", "Firma fehlt");
abgelehnt((b) => { b.firma.plz = "8033"; }, "firma.plz", "deutsche PLZ mit vier Ziffern");
abgelehnt((b) => { b.firma.ustId = "XX12"; }, "firma.ustId", "kaputte USt-IdNr.");
abgelehnt((b) => { b.ansprechpartner.email = "max@"; }, "ansprechpartner.email", "kaputte E-Mail");
abgelehnt((b) => { b.ansprechpartner.telefon = "+33 1 23 45 67 89"; }, "ansprechpartner.telefon", "französische Nummer");
abgelehnt((b) => { b.ansprechpartner.telefon = ""; }, "ansprechpartner.telefon", "Telefon fehlt");
abgelehnt((b) => { b.ansprechpartner.funktion = ""; }, "ansprechpartner.funktion", "Funktion fehlt");
for (const k of ["vertrag", "pflichthinweis", "unternehmer", "vertretung"]) abgelehnt((b) => { b.bestaetigungen[k] = false; }, `bestaetigungen.${k}`, `Bestätigung ${k} fehlt`);
abgelehnt((b) => { b.bestaetigungen.vertrag = "true"; }, "bestaetigungen.vertrag", "Bestätigung als Text statt true");
abgelehnt((b) => { b.unterschriftPng = "data:image/png;base64,AAAA"; }, "unterschriftPng", "zu kleine Unterschrift");
abgelehnt((b) => { b.unterschriftPng = PNG.replace("iVBOR", "AAAAA"); }, "unterschriftPng", "kein PNG-Kopf");
abgelehnt((b) => { b.falle = "http://spam.example"; }, undefined, "Honigtopf gefüllt");
// Florentines Fund (19.09.2026): FIAON als Kunde ergab zwei Parteien „FIAON LTD“ mit verschiedenen Adressen.
abgelehnt((b) => { b.firma.name = "FIAON LTD"; }, "firma.name", "FIAON als eigenes Unternehmen");
abgelehnt((b) => { b.firma.name = "F.I.A.O.N. Limited"; }, "firma.name", "FIAON mit Punkten");
abgelehnt((b) => { b.firma.website = "https://www.fiaon.com"; }, "firma.website", "FIAON-Website als eigene");
abgelehnt((b) => { b.ansprechpartner.funktion = "Director FIAON"; }, "ansprechpartner.funktion", "Unterzeichner „Director FIAON“");
abgelehnt((b) => { b.firma.strasse = "128 City Road (FIAON)"; }, "firma.strasse", "FIAON in der Anschrift");
const at = GUT(); at.firma.land = "AT"; at.firma.plz = "1010"; at.firma.ustId = "ATU12345678"; at.ansprechpartner.telefon = "+43 660 1234567";
ok(auftrag.globalAuftragPruefen(at).ok === true, "Österreich: gültige Eingabe wird abgelehnt");
const ch = GUT(); ch.firma.land = "CH"; ch.firma.plz = "8001"; ch.firma.ustId = "CHE-123.456.789 MWST"; ch.ansprechpartner.telefon = "044 123 45 67";
const chP = auftrag.globalAuftragPruefen(ch);
ok(chP.ok === true && (chP as any).daten.firma.ustId === "CHE-123.456.789 MWST" && (chP as any).daten.ansprechpartner.telefon === "+41441234567", "Schweiz: gültige Eingabe wird abgelehnt oder falsch normalisiert");

// Das Token: an die Antragsnummer gebunden, läuft ab, lässt sich nicht übertragen.
const token = auftrag.globalTokenErzeugen("FIAON-PRUEFSTAND-0001");
ok(auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", token) === "gueltig", "frisches Token gilt nicht");
ok(auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0002", token) === null, "Token gilt für eine FREMDE Antragsnummer");
ok(auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", auftrag.globalTokenErzeugen("FIAON-PRUEFSTAND-0001", -1000)) === "abgelaufen", "abgelaufenes Token wird nicht erkannt");
ok(auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", token.replace(/.$/, (z) => (z === "0" ? "1" : "0"))) === null, "verändertes Token gilt");
ok(auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", "") === null && auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", undefined) === null, "leeres Token gilt");


// ═══ 10: DER AUFTRAG EINER PRIVATPERSON (E-191) ═════════════════════════════
const ANSCHRIFT = { land: "DE", strasse: "Lindenweg 3", plz: "80331", ort: "München" };
const PRIVAT_FIRMA = { art: "privat", ...ANSCHRIFT, name: "Erika <i>Muster</i>", rechtsform: "Privatperson", ustId: null, registergericht: null, registernummer: null };
const PRIVAT_PERSON = { anrede: "Frau", vorname: "Erika", nachname: "<i>Muster</i>", funktion: "Privatperson" };
const firmaText = vertrag.globalVertragText({ paket: "global_struktur", sprache: "de", firma: FIRMA, ansprechpartner: PERSON } as any);
ok(!/Widerrufsbelehrung|wohnhaft|Endpreis|Muster-Widerrufsformular/.test(firmaText), "Firmenauftrag trägt Sätze des Privatauftrags");
ok(firmaText.includes("Unternehmer im Sinne von § 14 BGB") && firmaText.includes("begrenzt auf den Paketpreis"), "Firmenauftrag: Ziffer 9/11 nicht mehr wie bisher");
for (const p of GLOBAL_PAKETE) {
  for (const sprache of ["de", "en"] as const) {
    for (const sofortBeginn of [false, true]) {
      abschnitt(`Privatauftrag ${p.key} · ${sprache} · ${sofortBeginn ? "sofort" : "nach der Frist"}`);
      const daten = { paket: p.key, sprache, auftraggeber: "privat", sofortBeginn, firma: PRIVAT_FIRMA, ansprechpartner: PRIVAT_PERSON } as any;
      const vorschau = vertrag.globalVertragVorschauHtml(daten);
      const text = vertrag.globalVertragText(daten);
      const rumpf = vertrag.globalVertragRumpfHtml({ ...daten, ref: "FIAON-PRUEFSTAND-0002", unterschrift: { png: PNG, am: new Date("2026-09-19T10:30:00Z"), ip: "203.0.113.8", hash: "b".repeat(64) } });
      const erwartet = vertrag.GLOBAL_VERTRAG_ZIFFERN_PRIVAT[sprache].filter((_, i) => i !== 5 || GLOBAL_GELD_ZURUECK.aktiv);
      const gefunden = Array.from(vorschau.matchAll(/<h2><span class="gv-nr">(\d+)<\/span>([^<]+)<\/h2>/g)).map((m) => `${m[1]} ${m[2]}`);
      ok(gefunden.length === erwartet.length && erwartet.every((t, i) => gefunden[i] === `${i + 1} ${t}`), `Ziffern des Privatauftrags: ${gefunden.join(" | ")}`);
      const de = sprache === "de";
      // Parteien und Unterschrift: Person mit Wohnanschrift, keine Funktion, entschärft
      ok(text.includes(de ? "wohnhaft Lindenweg 3, 80331 München, Deutschland" : "residing at Lindenweg 3, 80331 München, Germany"), "Parteien: Wohnanschrift fehlt");
      ok(!/vertreten durch|represented by (?!its Director)/.test(text.replace(/vertreten durch den Director/g, "")), "Parteien: Privatperson wird „vertreten“");
      ok(!vorschau.includes("<i>Muster</i>") && vorschau.includes("&lt;i&gt;Muster&lt;/i&gt;"), "Name der Privatperson wird nicht entschärft");
      ok(!/Privatperson<br\/>|, Privatperson<br/.test(vorschau), "Unterschriftszeile nennt eine Funktion");
      // Ziffer 5, 9, 11, 12
      ok(text.includes(de ? "ist der Paketpreis ein Endpreis" : "the package price is a final price"), "Ziffer 5: Endpreis fehlt");
      ok(!/Reverse Charge|reverse charge/.test(text), "Privatauftrag spricht von Reverse Charge");
      const nr = GLOBAL_GELD_ZURUECK.aktiv ? 11 : 10;
      const beginnWartet = de ? `FIAON beginnt nach Ablauf der Widerrufsfrist (Ziffer ${nr}), frühestens mit dem Zahlungseingang.` : `FIAON starts work after the withdrawal period has expired (clause ${nr}), and not before payment has been received.`;
      ok(text.includes(beginnWartet) === !sofortBeginn, `Ziffer 5: Beginn-Satz passt nicht zur Wahl (sofort=${sofortBeginn})`);
      ok(text.includes(de ? "vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden" : "typical damage foreseeable"), "Ziffer 9: Haftungsgrenze für Privatpersonen fehlt");
      ok(!text.includes(de ? "begrenzt auf den Paketpreis" : "limited in amount to the package price"), "Ziffer 9: Grenze Paketpreis im Privatauftrag");
      ok(text.includes(de ? "Der Auftraggeber hat ausdrücklich verlangt" : "The Client has expressly requested") === sofortBeginn, "Ziffer 11: ausdrückliches Verlangen passt nicht zur Wahl");
      ok(text.includes(de ? "Der Auftraggeber hat nicht verlangt" : "The Client has not requested") === !sofortBeginn, "Ziffer 11: Satz ohne Verlangen passt nicht zur Wahl");
      ok(!text.includes(de ? "Unternehmer im Sinne von § 14 BGB" : "entrepreneur within the meaning"), "Ziffer 11: Unternehmer-Bestätigung im Privatauftrag");
      ok(text.includes(de ? "zwingenden Bestimmungen des Rechts des Staates seines gewöhnlichen Aufenthalts" : "mandatory provisions of the law of the state of the Client’s habitual residence"), "Ziffer 12: Verbraucherschutz-Satz fehlt");
      // Anlage: gesetzliche Belehrung und Formular — hinter der Unterschrift, im Hash-Rumpf
      for (const satz of de
        ? ["Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.", "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.", "Folgen des Widerrufs", "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll", "Muster-Widerrufsformular", "Unzutreffendes streichen", "support@fiaon.com", "128 City Road"]
        : ["You have the right to withdraw from this contract within 14 days without giving any reason.", "Effects of withdrawal", "If you requested to begin the performance of services during the withdrawal period", "Model withdrawal form", "Delete as appropriate", "support@fiaon.com"]) {
        ok(text.includes(satz), `Anlage: „${satz.slice(0, 50)}…“ fehlt`);
      }
      ok(rumpf.indexOf("gv-anlage") > rumpf.indexOf("sig-img"), "Anlage steht nicht HINTER der Unterschrift");
      ok(rumpf.includes("gv-anlage"), "Anlage fehlt im Rumpf (Hash und PDF)");
      // Vertragssprache bis zur Unterschrift; danach spricht das gesetzliche Muster den Kunden an
      const ansprache = de ? /\b(Ihr|Ihre|Ihrer|Ihrem|Ihren|Ihres|Ihnen|[Uu]nser\w*|[Ww]ir)\b/g : /\b(your|our|we|you|Your|Our|We|You)\b/g;
      const angesprochen = Array.from(new Set(ohneSignatur(text).match(ansprache) ?? []));
      ok(angesprochen.length === 0, `Privatauftrag: Kundenansprache vor der Unterschrift: ${angesprochen.join(", ")}`);
      if (de) for (const t of wandPruefen(text)) { wandTreffer.push(`privat ${p.key}: [${t.art}] „${t.treffer}“ — ${t.hinweis}`); ok(false, `Wortwand [${t.art}] „${t.treffer}“`); }
      console.log(`  ${gefunden.length} Ziffern · Anlage mit Belehrung und Formular · ${text.length} Zeichen`);
    }
  }
}

abschnitt("Widerrufsfrist und Start nach der Frist");
const frist = (iso: string) => vertrag.globalWiderrufsfrist(new Date(iso));
ok(JSON.stringify(frist("2026-09-21T10:00:00Z")) === JSON.stringify({ fristEnde: "2026-10-05", startAb: "2026-10-08" }), `Montag: ${JSON.stringify(frist("2026-09-21T10:00:00Z"))}`);
ok(frist("2026-09-19T10:00:00Z").fristEnde === "2026-10-05", `Ende am Samstag → Montag: ${frist("2026-09-19T10:00:00Z").fristEnde}`);
ok(frist("2026-09-20T10:00:00Z").fristEnde === "2026-10-05", `Ende am Sonntag → Montag: ${frist("2026-09-20T10:00:00Z").fristEnde}`);
ok(frist("2026-09-20T23:30:00Z").fristEnde === "2026-10-05", `nach Mitternacht Berlin zählt der Berliner Tag: ${frist("2026-09-20T23:30:00Z").fristEnde}`);
ok(frist("2026-10-20T09:00:00Z").fristEnde === "2026-11-03", `über die Zeitumstellung: ${frist("2026-10-20T09:00:00Z").fristEnde}`);
const akteP = (sofort: boolean) => ({ firma: { art: "privat" }, bestaetigungen: { vertrag: true, sofortBeginn: sofort }, unterschrieben_am: "2026-09-21T10:00:00Z" });
ok(auftrag.globalStartWartet(akteP(false), new Date("2026-09-25T10:00:00Z"))?.startAb === "2026-10-08", "Privat ohne Wunsch: wartet nicht");
ok(auftrag.globalStartWartet(akteP(false), new Date("2026-10-08T07:00:00Z")) === null, "Privat ohne Wunsch: wartet am Starttag noch");
ok(auftrag.globalStartWartet(akteP(true), new Date("2026-09-25T10:00:00Z")) === null, "Privat MIT Wunsch: wartet trotzdem");
ok(auftrag.globalStartWartet({ firma: { name: "Muster GmbH" }, bestaetigungen: {}, unterschrieben_am: "2026-09-21T10:00:00Z" }, new Date("2026-09-25T10:00:00Z")) === null, "Firmenauftrag wartet auf eine Widerrufsfrist");
ok(auftrag.globalStartWartet({ firma: JSON.stringify({ art: "privat" }), bestaetigungen: JSON.stringify({ sofortBeginn: false }), unterschrieben_am: "2026-09-21T10:00:00Z" }, new Date("2026-09-25T10:00:00Z")) !== null, "JSON als Text (wie aus der Datenbank) wird nicht gelesen");

abschnitt("Startmail: Unterlagen je Auftraggeber");
const nutzlastPrivat = auftrag.globalMailNutzlast({ ref: "FIAON-P", paket_key: "global_struktur", firma: { art: "privat", name: "Erika Muster" }, ansprechpartner: { anrede: "Frau", nachname: "Muster" }, email: "e@x.example" }, { ref: "FIAON-P" }, { ansprechpartner: "Team" });
const nutzlastFirma = auftrag.globalMailNutzlast({ ref: "FIAON-F", paket_key: "global_struktur", firma: { name: "Muster GmbH" }, ansprechpartner: { anrede: "Herr", nachname: "Muster" }, email: "m@x.example" }, { ref: "FIAON-F" }, { ansprechpartner: "Team" });
ok(!/Handelsregister|Gesellschafterliste/.test(nutzlastPrivat.unterlagen_liste) && nutzlastPrivat.unterlagen_liste.includes("Reisepass"), "Privatperson bekommt die Registerzeile");
ok(/Handelsregister/.test(nutzlastFirma.unterlagen_liste), "Firma bekommt die Registerzeile nicht");
const startPrivat = mailRendern("global_start", { ...NUTZLAST, unterlagen_liste: nutzlastPrivat.unterlagen_liste });
ok(!!startPrivat && startPrivat.fehlend.length === 0 && !/Handelsregister/.test(startPrivat.text) && startPrivat.text.includes("Reisepass"), "global_start (privat): Liste falsch oder Platzhalter offen");

abschnitt("Eingabeprüfung: Privatperson");
const GUT_PRIVAT = () => ({
  paket: "global_struktur", auftraggeber: "privat",
  firma: { ...ANSCHRIFT, name: "Soll ignoriert werden GmbH", rechtsform: "GmbH", ustId: "DE123456789" },
  ansprechpartner: { anrede: "Frau", vorname: "Erika", nachname: "Muster", funktion: "", email: "Erika@Example.org", telefon: "0171 7654321" },
  bestaetigungen: { vertrag: true, pflichthinweis: true, widerruf: true } as Record<string, unknown>,
  unterschriftPng: PNG, falle: "",
});
const gp = auftrag.globalAuftragPruefen(GUT_PRIVAT());
ok(gp.ok === true, `vollständige Privateingabe wird abgelehnt: ${(gp as any).error}`);
if (gp.ok) {
  const d = gp.daten as any;
  ok(d.auftraggeber === "privat" && d.firma.art === "privat" && d.firma.rechtsform === "Privatperson" && d.firma.name === "Erika Muster", `Privatperson falsch abgelegt: ${JSON.stringify(d.firma)}`);
  ok(d.firma.ustId === null && d.firma.registernummer === null, "Privatperson trägt Firmenfelder aus der Eingabe");
  ok(d.bestaetigungen.sofortBeginn === false && d.bestaetigungen.widerruf === true && !("unternehmer" in d.bestaetigungen), `Bestätigungen falsch: ${JSON.stringify(d.bestaetigungen)}`);
  ok(d.ansprechpartner.funktion === "Privatperson" && d.ansprechpartner.email === "erika@example.org" && d.ansprechpartner.telefon === "+491717654321", "Ansprechpartner der Privatperson falsch");
}
const mitWunsch = GUT_PRIVAT(); mitWunsch.bestaetigungen.sofortBeginn = true;
ok((auftrag.globalAuftragPruefen(mitWunsch) as any).daten?.bestaetigungen.sofortBeginn === true, "sofortiger Beginn wird nicht übernommen");
const alsText = GUT_PRIVAT(); alsText.bestaetigungen.sofortBeginn = "true";
ok((auftrag.globalAuftragPruefen(alsText) as any).daten?.bestaetigungen.sofortBeginn === false, "„true“ als Text gilt als ausdrückliches Verlangen");
const vorschauP = auftrag.globalVorschauPruefen({ ...GUT_PRIVAT(), bestaetigungen: { sofortBeginn: true } });
ok(vorschauP.ok === true && (vorschauP as any).daten.sofortBeginn === true && (vorschauP as any).daten.auftraggeber === "privat", "Vorschau liest den Wunsch zum Beginn nicht");
const abgelehntP = (aendern: (b: any) => void, feld: string | undefined, was: string) => {
  const b = GUT_PRIVAT(); aendern(b);
  const r = auftrag.globalAuftragPruefen(b);
  ok(!r.ok && (r as any).feld === feld, `${was} — erwartet Ablehnung am Feld ${feld ?? "—"}, bekam ${r.ok ? "Annahme" : `${(r as any).feld}: ${(r as any).error}`}`);
};
abgelehntP((b) => { b.ansprechpartner.vorname = ""; }, "privat.vorname", "Vorname fehlt");
abgelehntP((b) => { b.ansprechpartner.nachname = " "; }, "privat.nachname", "Nachname fehlt");
abgelehntP((b) => { b.firma.land = "FR"; }, "privat.land", "Wohnsitz außerhalb DE/AT/CH");
abgelehntP((b) => { b.firma.plz = "1234"; }, "privat.plz", "deutsche PLZ mit vier Ziffern");
abgelehntP((b) => { b.firma.strasse = "a"; }, "privat.strasse", "Straße zu kurz");
abgelehntP((b) => { b.bestaetigungen.widerruf = false; }, "bestaetigungen.widerruf", "Widerrufsbelehrung nicht bestätigt");
abgelehntP((b) => { b.bestaetigungen.vertrag = false; }, "bestaetigungen.vertrag", "Vertrag nicht bestätigt");
abgelehntP((b) => { b.ansprechpartner.telefon = "+33 1 23 45 67 89"; }, "ansprechpartner.telefon", "französische Nummer");
abgelehntP((b) => { b.ansprechpartner.nachname = "Fiaon"; }, "privat.nachname", "Privatperson „Fiaon“");
const firmaOhneArt = GUT(); (firmaOhneArt as any).auftraggeber = "irgendwas";
ok(auftrag.globalAuftragPruefen(firmaOhneArt).ok === true && (auftrag.globalAuftragPruefen(firmaOhneArt) as any).daten.auftraggeber === "unternehmen", "unbekannter Auftraggeber wird nicht als Unternehmen gelesen");

// ═══ 11: DIE JAHRESBETREUUNG (19.09.2026, E-196) ════════════════════════════
// Justin: im Auftrag ankreuzbar, 699 € im Jahr ab dem zweiten Jahr, ALLE Gebühren inklusive — auch die
// Staatsgebühr. Geprüft wird, dass der Vertrag MIT Haken genau das sagt (Ziffer 2, 3, 5), OHNE Haken kein
// Wort davon — und dass ein nicht gebuchter Vertrag Byte für Byte der bisherige bleibt.
{
  const { GLOBAL_JAHRESBETREUUNG, globalJahresbetreuungPreisText } = await import("../shared/fiaon-global");
  const NEUE_FASSUNG = "2026-09-19c";
  const entitaeten = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  // Der Text EINER Ziffer — damit geprüft wird, WO ein Satz steht, nicht nur, DASS er irgendwo steht.
  const zifferText = (vorschau: string, nr: number) => entitaeten(vorschau.split('<section class="gv-ziffer">')[nr] ?? "");
  const anspracheDe = /\b(Ihr|Ihre|Ihrer|Ihrem|Ihren|Ihres|Ihnen|[Uu]nser\w*|[Ww]ir)\b/g;
  const anspracheEn = /\b(your|our|we|you|Your|Our|We|You)\b/g;
  const PLAN_SATZ = { de: "Jahresmeldung beim Bundesstaat einschließlich der Staatsgebühr", en: "annual report to the state including the state fee" } as const;
  const ENDPREIS = { de: "Dasselbe gilt für den Preis der Jahresbetreuung.", en: "The same applies to the price of the annual care plan." } as const;
  const HONORAR = { de: "und, soweit sie die Jahresbetreuung betreffen, in deren Preis", en: "and, where they relate to the annual care plan, in its price" } as const;

  abschnitt("Jahresbetreuung: Fassung");
  ok(GLOBAL_VERTRAG_VERSION >= NEUE_FASSUNG, `Vertragsfassung ist „${GLOBAL_VERTRAG_VERSION}“ — der Vertrag mit Jahresbetreuung ist eine neue Fassung und braucht „${NEUE_FASSUNG}“ oder später (shared/fiaon-global.ts, GLOBAL_VERTRAG_VERSION)`);
  ok(GLOBAL_JAHRESBETREUUNG.preisCents === 69900 && globalJahresbetreuungPreisText("de") === "699 €" && globalJahresbetreuungPreisText("en") === "€699", `Preis der Quelle: ${GLOBAL_JAHRESBETREUUNG.preisCents} / ${globalJahresbetreuungPreisText("de")} / ${globalJahresbetreuungPreisText("en")}`);

  let faelle = 0;
  for (const p of GLOBAL_PAKETE) {
    for (const sprache of ["de", "en"] as const) {
      for (const art of ["unternehmen", "privat"] as const) {
        const de = sprache === "de";
        const jb = GLOBAL_JAHRESBETREUUNG[sprache];
        const basis = art === "privat"
          ? { paket: p.key, sprache, auftraggeber: "privat", sofortBeginn: false, firma: PRIVAT_FIRMA, ansprechpartner: PRIVAT_PERSON }
          : { paket: p.key, sprache, firma: FIRMA, ansprechpartner: PERSON };
        const wo = `${p.key}/${sprache}/${art}`;
        const mit = { ...basis, jahresbetreuung: true } as any;
        const ohne = { ...basis, jahresbetreuung: false } as any;
        const vMit = vertrag.globalVertragVorschauHtml(mit); const tMit = vertrag.globalVertragText(mit);
        const vOhne = vertrag.globalVertragVorschauHtml(ohne); const tOhne = vertrag.globalVertragText(ohne);
        faelle++;

        // Zwölf Ziffern, dieselben Titel, dieselbe Reihenfolge — mit und ohne.
        const titelListe = vertrag.globalVertragZiffern(sprache, art === "privat" ? "privat" : "unternehmen").filter((_, i) => i !== 5 || GLOBAL_GELD_ZURUECK.aktiv);
        for (const [name, v] of [["mit", vMit], ["ohne", vOhne]] as const) {
          const gefunden = Array.from(v.matchAll(/<h2><span class="gv-nr">(\d+)<\/span>([^<]+)<\/h2>/g)).map((m) => `${m[1]} ${m[2]}`);
          ok(gefunden.length === titelListe.length && titelListe.every((t, i) => gefunden[i] === `${i + 1} ${t.replace(/&/g, "&amp;")}`), `${wo} ${name}: Ziffern ${gefunden.join(" | ")}`);
          ok(v.includes(GLOBAL_VERTRAG_VERSION), `${wo} ${name}: Vertragsversion fehlt in der Unterzeile`);
        }

        // MIT: Ziffer 2 nennt sie, Ziffer 3 die Honorare, Ziffer 5 den Wortlaut der Quelle — je genau einmal.
        const z2 = zifferText(vMit, 2); const z3 = zifferText(vMit, 3); const z5 = zifferText(vMit, 5);
        ok(de ? /Zusätzlich umfasst der Auftrag die Jahresbetreuung ab dem zweiten Jahr nach der Gründung.*regelt Ziffer 5\./.test(z2) : /In addition, the engagement covers the annual care plan from the second year after formation.*set out in clause 5\./.test(z2), `${wo}: Ziffer 2 nennt die Jahresbetreuung nicht (mit Verweis auf Ziffer 5)`);
        ok(z3.includes(HONORAR[sprache]), `${wo}: Ziffer 3 — die Partner-Honorare der Jahresbetreuung stecken nicht in deren Preis`);
        ok(z5.includes(jb.vertrag) && z5.includes(jb.vertragBedingungen), `${wo}: Ziffer 5 trägt den Wortlaut der Jahresbetreuung nicht (vertrag + vertragBedingungen aus shared/fiaon-global.ts)`);
        ok(tMit.split(jb.vertrag).length === 2 && tMit.split(jb.vertragBedingungen).length === 2, `${wo}: der Wortlaut der Jahresbetreuung steht nicht GENAU einmal im Vertrag`);
        ok(z5.includes(globalJahresbetreuungPreisText(sprache)) && z5.includes(PLAN_SATZ[sprache]), `${wo}: Ziffer 5 — Preis ${globalJahresbetreuungPreisText(sprache)} oder der Satz zur Staatsgebühr fehlt`);
        ok(!tMit.includes(GLOBAL_LAUFEND_VERTRAG[sprache]), `${wo}: MIT Jahresbetreuung steht noch „die laufenden Kosten trägt der Auftraggeber“ — Widerspruch zu Ziffer 5`);
        ok(de ? z5.includes("für die Leistungen des Pakets nach Ziffer 2") : z5.includes("for the services of the package under clause 2"), `${wo}: Ziffer 5 — der Festpreis deckt nicht mehr nur „die Leistungen des Pakets“`);
        ok(z5.includes(ENDPREIS[sprache]) === (art === "privat"), `${wo}: Endpreis-Satz der Jahresbetreuung ${art === "privat" ? "fehlt beim Privatauftrag" : "steht im Firmenauftrag"}`);
        if (art === "privat") ok(z5.includes(de ? "ist der Paketpreis ein Endpreis" : "the package price is a final price"), `${wo}: der Endpreis-Satz des Pakets ist weg`);
        ok(!zifferText(vMit, 1).includes(jb.titel) && !zifferText(vMit, 4).includes(jb.titel), `${wo}: die Jahresbetreuung steht in einer Ziffer, in die sie nicht gehört`);
        const angesprochen = Array.from(new Set(ohneSignatur(tMit).match(de ? anspracheDe : anspracheEn) ?? []));
        ok(angesprochen.length === 0, `${wo}: Kundenansprache im Vertrag mit Jahresbetreuung: ${angesprochen.join(", ")}`);
        if (de) for (const t of wandPruefen(tMit)) { wandTreffer.push(`${wo} mit Jahresbetreuung: [${t.art}] „${t.treffer}“ — ${t.hinweis}`); ok(false, `${wo}: Wortwand [${t.art}] „${t.treffer}“`); }
        else for (const m of tMit.matchAll(/\b(guarantee[sd]?|advice|recommend\w*|affiliate\w*)\b/gi)) if (!/personal\s$/i.test(tMit.slice(Math.max(0, m.index! - 12), m.index!))) { wandTreffer.push(`${wo}/en mit Jahresbetreuung: „${m[0]}“`); ok(false, `${wo}: Wortwahl (EN) „${m[0]}“`); }
        // Der Hash-Rumpf (Unterschrift) trägt den Absatz — was unterschrieben wird, ist, was angezeigt wurde.
        const rumpfMit = vertrag.globalVertragRumpfHtml({ ...mit, ref: "FIAON-JB-0001" }); const rumpfOhne = vertrag.globalVertragRumpfHtml({ ...ohne, ref: "FIAON-JB-0001" });
        ok(rumpfMit !== rumpfOhne && entitaeten(rumpfMit).includes(jb.vertrag), `${wo}: der Rumpf für PDF und Hash trägt die Jahresbetreuung nicht`);

        // OHNE: kein Wort davon, der bisherige Satz zu den laufenden Kosten — und Byte für Byte wie ohne Feld.
        ok(!tOhne.toLowerCase().includes(jb.titel.toLowerCase()) && !tOhne.includes("699") && !tOhne.includes(PLAN_SATZ[sprache]) && !tOhne.includes(HONORAR[sprache]), `${wo}: OHNE Haken steht etwas von der Jahresbetreuung im Vertrag`);
        ok(tOhne.includes(GLOBAL_LAUFEND_VERTRAG[sprache]), `${wo}: OHNE Haken fehlt der Satz zu den laufenden Kosten ab dem zweiten Jahr`);
        ok(vOhne === vertrag.globalVertragVorschauHtml(basis as any), `${wo}: „jahresbetreuung: false“ ändert den Vertrag gegenüber dem bisherigen (ohne Feld)`);
        ok(vertrag.globalVertragVorschauHtml({ ...basis, jahresbetreuung: "true" } as any) === vOhne, `${wo}: der TEXT „true“ zählt als angekreuzt (nur boolean true)`);
      }
    }
  }
  console.log(`  ${faelle} Fälle (4 Pakete × 2 Sprachen × Unternehmen/Privatperson), je mit und ohne Jahresbetreuung.`);

  abschnitt("Jahresbetreuung: Eingabeprüfung und Akte");
  const vorschauMit = auftrag.globalVorschauPruefen({ ...GUT(), jahresbetreuung: true });
  ok(vorschauMit.ok === true && (vorschauMit as any).daten.jahresbetreuung === true, "Vorschau: jahresbetreuung true kommt nicht an");
  ok((auftrag.globalVorschauPruefen(GUT()) as any).daten?.jahresbetreuung === false, "Vorschau: ohne Feld ist die Jahresbetreuung gebucht");
  ok((auftrag.globalVorschauPruefen({ ...GUT(), jahresbetreuung: "true" }) as any).daten?.jahresbetreuung === false, "Vorschau: der TEXT „true“ gilt als angekreuzt");
  ok((auftrag.globalVorschauPruefen({ ...GUT_PRIVAT(), jahresbetreuung: true }) as any).daten?.jahresbetreuung === true, "Vorschau Privatperson: jahresbetreuung true kommt nicht an");
  const aMit = auftrag.globalAuftragPruefen({ ...GUT(), jahresbetreuung: true });
  ok(aMit.ok === true && (aMit as any).daten.jahresbetreuung === true, `Auftrag: jahresbetreuung true kommt nicht an (${(aMit as any).error ?? ""})`);
  ok((auftrag.globalAuftragPruefen(GUT()) as any).daten?.jahresbetreuung === false, "Auftrag: ohne Feld ist die Jahresbetreuung gebucht");
  ok((auftrag.globalAuftragPruefen({ ...GUT_PRIVAT(), jahresbetreuung: true }) as any).daten?.jahresbetreuung === true, "Auftrag Privatperson: jahresbetreuung true kommt nicht an");
  ok((auftrag.globalAuftragPruefen({ ...GUT_PRIVAT(), jahresbetreuung: 1 }) as any).daten?.jahresbetreuung === false, "Auftrag: 1 gilt als angekreuzt (nur boolean true)");
  const aus = auftrag.globalJahresbetreuungAus;
  ok(JSON.stringify(aus({ jahresbetreuung: true, jahresbetreuung_preis_cents: 69900 })) === JSON.stringify({ jahresbetreuung: true, jahresbetreuungPreisCents: 69900 }), "Akte gebucht: Preis vom Tag der Bestellung");
  ok(aus({ jahresbetreuung: true, jahresbetreuung_preis_cents: 59900 }).jahresbetreuungPreisCents === 59900, "Akte gebucht: ein ALTER Preis wird durch den heutigen ersetzt");
  ok(aus({ jahresbetreuung: true, jahresbetreuung_preis_cents: null }).jahresbetreuungPreisCents === GLOBAL_JAHRESBETREUUNG.preisCents, "Akte gebucht ohne Preis: nicht der Preis der Quelle");
  ok(JSON.stringify(aus({ jahresbetreuung: false, jahresbetreuung_preis_cents: 69900 })) === JSON.stringify({ jahresbetreuung: false, jahresbetreuungPreisCents: null }) && aus(null).jahresbetreuung === false && aus({ jahresbetreuung: "true" }).jahresbetreuung === false, "Akte nicht gebucht (oder Text statt Wahrheitswert): trotzdem gebucht");

  abschnitt("Jahresbetreuung: Hinweiszeile auf der Rechnung");
  const PDFDocument = (await import("pdfkit")).default;
  const rechnung = await import("../server/fiaon-invoice");
  // Mitgeschrieben wird, was gezeichnet wird: jeder Text und die Unterkante des Zahlungskastens.
  const zeichne = (zeile: any): Promise<{ texte: string[]; kastenBis: number; fussOben: number; seiten: number }> => new Promise((fertig, fehlschlag) => {
    const doc: any = new PDFDocument({ size: "A4", margin: 50 });
    const teile: Buffer[] = []; const texte: string[] = []; let kastenBis = 0;
    const text = doc.text.bind(doc); doc.text = (t: unknown, ...r: unknown[]) => { texte.push(String(t)); return text(t, ...r); };
    const kasten = doc.roundedRect.bind(doc); doc.roundedRect = (x: number, y: number, w: number, h: number, ...r: unknown[]) => { kastenBis = Math.max(kastenBis, y + h); return kasten(x, y, w, h, ...r); };
    doc.on("data", (c: Buffer) => teile.push(c)); doc.on("error", fehlschlag);
    doc.on("end", () => fertig({ texte, kastenBis, fussOben: doc.page.height - 60, seiten: (Buffer.concat(teile).toString("latin1").match(/\/Type \/Page\b/g) ?? []).length }));
    rechnung.renderInvoicePdf(doc, zeile); doc.end();
  });
  const kopfR = { ref: "FIAON-MB2XK4LQ-7T9A", invoice_number: "FIAON-INV-2026-00321", invoice_date: "2026-09-19T10:00:00Z", payment_reference: "FIAON-A1B2C3", payment_due_date: "2026-09-26T10:00:00Z" };
  const firmaR = { ...kopfR, pack_key: "global_vip", pack_name: "FIAON Global VIP", amount_due: "35999.00", company_name: "Muster & Söhne Projektentwicklungsgesellschaft mbH & Co. KG Niederlassung Süd", contact_name: "Maximilian Mustermann-Beispielhausen", street: "Beispielweg 12", zip: "80331", city: "München", country: "DE", tax_id: "DE123456789", contact_email: "m.muster@muster-gmbh.example" };
  const HINWEIS_DE = "Jahresbetreuung ab dem zweiten Jahr: 699,00 € je Betreuungsjahr, wird jährlich gesondert berechnet – nicht Teil dieser Rechnung.";
  const HINWEIS_EN = "Annual care plan from the second year: €699.00 per year of care, invoiced separately each year – not part of this invoice.";
  for (const [name, zeile, erwartet] of [
    ["de, ohne Steuerausweis", { ...firmaR, rechnung_jahresbetreuung_cents: 69900 }, [HINWEIS_DE]],
    ["en, Reverse Charge", { ...firmaR, rechnung_ust_modus: "reverse_charge", rechnung_sprache: "en", rechnung_jahresbetreuung_cents: 69900 }, [HINWEIS_DE, HINWEIS_EN]],
    ["Privatauftrag (ohne Firmenname)", { ...firmaR, company_name: null, first_name: "Erika", last_name: "Muster", rechnung_jahresbetreuung_cents: 69900 }, [HINWEIS_DE]],
  ] as [string, Record<string, unknown>, string[]][]) {
    const r = await zeichne(zeile);
    ok(erwartet.every((h) => r.texte.filter((t) => t === h).length === 1), `Rechnung ${name}: Hinweiszeile fehlt oder steht doppelt — ${r.texte.filter((t) => /Jahresbetreuung|annual care/i.test(t)).join(" | ")}`);
    ok(r.texte.filter((t) => /Jahresbetreuung|annual care/i.test(t)).length === erwartet.length, `Rechnung ${name}: mehr Jahresbetreuung als die eine Hinweiszeile (je Sprache)`);
    ok(r.texte.includes("35.999,00 €") && !r.texte.includes("699,00 €"), `Rechnung ${name}: Betrag ist nicht mehr der Paketpreis — oder die Jahresbetreuung steht als Posten da`);
    ok(r.seiten === 1 && r.kastenBis > 0 && r.kastenBis < r.fussOben, `Rechnung ${name}: Zahlungskasten reicht bis ${r.kastenBis.toFixed(0)}, Fuß beginnt bei ${r.fussOben.toFixed(0)} (${r.seiten} Seite(n))`);
  }
  for (const [name, zeile] of [["ohne Feld", firmaR], ["Feld 0", { ...firmaR, rechnung_jahresbetreuung_cents: 0 }], ["Feld null", { ...firmaR, rechnung_jahresbetreuung_cents: null }], ["Privatkunde mit Feld", { ...kopfR, pack_key: "pro", pack_name: "FIAON Pro", amount_due: "59.99", first_name: "Kim", last_name: "Beispiel", rechnung_jahresbetreuung_cents: 69900 }]] as [string, Record<string, unknown>][]) {
    const r = await zeichne(zeile);
    ok(!r.texte.some((t) => /Jahresbetreuung|annual care/i.test(t)), `Rechnung ${name}: trägt eine Jahresbetreuung`);
  }
  // Die Zeile kommt über rechnungsSpracheSetzen — an allen fünf Zeichenstellen gleich. Eine fehlende Spalte
  // (vor dem ersten ensureGlobalTabelle nach dem Deploy) darf die englische Zweitzeile nicht mitreißen.
  const attrappe = (spalteFehlt: boolean) => async (teile: TemplateStringsArray) => {
    const q = teile.join("?");
    if (q.includes("jahresbetreuung")) { if (spalteFehlt) throw new Error('column "jahresbetreuung" does not exist'); return [{ jahresbetreuung: true, jahresbetreuung_preis_cents: 69900 }]; }
    if (q.includes("vertrag_sprache")) return [{ vertrag_sprache: "en" }];
    return [];
  };
  const z1: any = { ref: "FIAON-X", pack_key: "global_struktur" }; await rechnung.rechnungsSpracheSetzen(attrappe(false), z1);
  ok(z1.rechnung_sprache === "en" && z1.rechnung_jahresbetreuung_cents === 69900, `rechnungsSpracheSetzen: Sprache/Jahresbetreuung nicht an der Zeile (${JSON.stringify(z1)})`);
  const z2: any = { ref: "FIAON-X", pack_key: "global_struktur" }; await rechnung.rechnungsSpracheSetzen(attrappe(true), z2);
  ok(z2.rechnung_sprache === "en" && z2.rechnung_jahresbetreuung_cents === undefined, "rechnungsSpracheSetzen: eine fehlende Spalte reißt die englische Zweitzeile mit");
  const z3: any = { ref: "FIAON-X", pack_key: "pro" }; await rechnung.rechnungsSpracheSetzen(attrappe(false), z3);
  ok(z3.rechnung_sprache === undefined && z3.rechnung_jahresbetreuung_cents === undefined, "rechnungsSpracheSetzen: fasst eine Privatkunden-Rechnung an");

  abschnitt("Jahresbetreuung: eine Quelle — kein Satz kopiert, Haken nie vorangekreuzt");
  const fs = await import("node:fs");
  const WURZEL_V = new URL("..", import.meta.url).pathname;
  const saetze = (["de", "en"] as const).flatMap((s) => [GLOBAL_JAHRESBETREUUNG[s].vertrag, GLOBAL_JAHRESBETREUUNG[s].vertragBedingungen, GLOBAL_JAHRESBETREUUNG[s].bedingungen, GLOBAL_JAHRESBETREUUNG[s].buchen, GLOBAL_JAHRESBETREUUNG[s].gebucht, GLOBAL_JAHRESBETREUUNG[s].nichtHeute]);
  for (const datei of ["client/src/pages/business-start.tsx", "client/src/i18n/global-start.ts", "client/src/pages/business-auftrag.tsx", "client/src/i18n/global-auftrag.ts", "client/src/pages/site/global-recht.tsx", "server/lib/fiaon-global-vertrag.ts", "server/fiaon-invoice.ts"]) {
    const q = fs.readFileSync(WURZEL_V + datei, "utf8");
    const kopie = saetze.find((s) => q.includes(s));
    ok(!kopie, `${datei}: ein Satz der Jahresbetreuung steht als Kopie da („${String(kopie).slice(0, 60)}…“) — er gehört nur nach shared/fiaon-global.ts`);
  }
  const seite = fs.readFileSync(WURZEL_V + "client/src/pages/business-start.tsx", "utf8");
  ok(/useState<boolean>\(entwurf\?\.jahresbetreuung === true\)/.test(seite) && !/setJahresbetreuung\(true\)/.test(seite), "Auftrag: der Haken der Jahresbetreuung ist nicht mehr „aus, bis der Kunde ihn setzt“ (§ 312a Abs. 3 BGB)");
  ok(/checked=\{jahresbetreuung\}[^\n]*J\.buchen/.test(seite), "Auftrag: der Haken trägt nicht den Satz „buchen“ aus der Quelle");
  ok(/jahresbetreuung, sprache: s \}/.test(seite) && /\n\s*jahresbetreuung,\n\s*kampagne: kampagne\(\)/.test(seite), "Auftrag: Vorschau oder Auftrag schicken die Jahresbetreuung nicht mit");
}

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
if (wandTreffer.length) { console.log("  Wortwahl-Treffer:"); for (const t of wandTreffer) console.log(`    · ${t}`); }
else console.log("  Wortwand: 0 Treffer im deutschen Vertragstext und in den Mails (eine gedeckte Zusage in global_start).");
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise) console.log(`    · ${h}`); }
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
