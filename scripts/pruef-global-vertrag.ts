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
const firmaOhneArt = GUT(); (firmaOhneArt as any).auftraggeber = "irgendwas";
ok(auftrag.globalAuftragPruefen(firmaOhneArt).ok === true && (auftrag.globalAuftragPruefen(firmaOhneArt) as any).daten.auftraggeber === "unternehmen", "unbekannter Auftraggeber wird nicht als Unternehmen gelesen");

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
if (wandTreffer.length) { console.log("  Wortwahl-Treffer:"); for (const t of wandTreffer) console.log(`    · ${t}`); }
else console.log("  Wortwand: 0 Treffer im deutschen Vertragstext und in den Mails (eine gedeckte Zusage in global_start).");
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise) console.log(`    · ${h}`); }
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
