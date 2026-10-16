// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand E-379 (15.10.2026): Die Ratgeber-Redaktion — jeden Tag ein Artikel je Bereich (privat, business),
// selbst recherchiert, streng geprüft, automatisch veröffentlicht. KEIN Netz: Die KI ist eine Attrappe (RedaktionKi).
//
//   A  offline: Bereich je Kategorie, Berliner Tag (06:00, Mitternacht, Sommer/Winter), nächster Lauf,
//      doppelte Themen, Kürzen, Quellen nur aus der Recherche, der strenge Prüfstand als Tor.
//   B  lokale DB: Rückfüllung (Wanderung 109), Tor + Wiederholung mit Fehler-Rückmeldung, EIN Artikel je Bereich
//      und Tag (auch bei zwei gleichzeitigen Läufen), Wiederanlauf eines Entwurfs, Tagesdeckel, Hand-Artikel zählt,
//      vor 06:00 nur der Vortag, Doppelthema wird abgelehnt, ?bereich= in der öffentlichen Liste, JSON richtig.
//   C  Quelltext-Wand: Takt registriert UND in LAUF_FOLGEN, Seiten holen ihren Bereich, Business-Wege im Artikel.
//
// Aufruf (nur gegen eine WEGWERF-Datenbank — der Prüfstand schreibt):
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_e379
//   env -i HOME=$HOME PATH="$PATH" DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e379 npx tsx scripts/pruef-e379.ts
//   dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_e379
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, info = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${info ? ` — ${info}` : ""}`); } }
const gruppe = (t: string) => console.log(`\n── ${t}`);

/** Ein Musterartikel, der den strengen Prüfstand besteht (oder mit `fehler` gezielt nicht). */
function muster(bereich: "privat" | "business", opt: { titel?: string; fehler?: "garantie" | "kurz" | "ohneFiaon" | "fremdlink" | "gamechanger" | "bisZu" | "du"; quellen?: { titel: string; url: string }[] } = {}) {
  const satz = [
    "Die Lage ist für viele Leser neu, und die Regeln sind in den letzten Monaten genauer geworden.",
    "Wer die Unterlagen ordnet, sieht schneller, welche Frist zählt und welcher Schritt als Nächstes kommt.",
    "Die Behörde hat dazu eine Mitteilung veröffentlicht, die wir unten mit Quelle und Datum nennen.",
    "Ein Beispiel aus dem Alltag zeigt, wie sich die Zahlen auf den Monat auswirken und was das für Sie heißt.",
    "Am Ende entscheidet das Institut nach eigenen Regeln, und genau deshalb lohnt sich eine saubere Vorbereitung.",
  ];
  const absatz = (n: number) => Array.from({ length: n }, (_, i) => satz[i % satz.length]).join(" ");
  const abschnitte = opt.fehler === "kurz" ? 2 : 7;
  const teile: string[] = [absatz(6), absatz(5)];
  for (let i = 0; i < abschnitte; i++) teile.push(`## Abschnitt ${i + 1}: Was jetzt wichtig ist\n\n${absatz(9)}\n\n${absatz(8)}`);
  teile.push("## Schritt für Schritt\n\n1. Unterlagen sammeln.\n2. Fristen notieren.\n3. Den nächsten Schritt planen.");
  const ziel = bereich === "business" ? "[Pakete von FIAON Global](/business#pakete)" : "[die Pakete für Privatkunden](/privatkunden)";
  if (opt.fehler !== "ohneFiaon") teile.push(`## ${bereich === "business" ? "So übernimmt FIAON Global den Weg" : "Was FIAON dabei übernimmt"}\n\n${absatz(4)} Mehr dazu auf ${ziel}.`);
  teile.push(`## Was nicht geht\n\n${absatz(4)}`);
  teile.push(`## Das Wichtigste in drei Sätzen\n\n${absatz(3)}`);
  if (opt.fehler === "garantie") teile.push("Wir geben eine Garantie auf das Ergebnis.");
  if (opt.fehler === "gamechanger") teile.push("Das ist ein echter Gamechanger für Ihr Unternehmen.");
  if (opt.fehler === "bisZu") teile.push("Der Rahmen beträgt bis zu 50.000 Dollar.");
  if (opt.fehler === "du") teile.push("Hast du deine Unterlagen?");
  if (opt.fehler === "fremdlink") teile.push("Siehe auch [diese Seite](/gibt-es-nicht).");
  const quellen = opt.quellen ?? [
    { titel: "Destatis: Insolvenzen (2026)", url: "https://www.destatis.de/insolvenzen-2026" },
    { titel: "BaFin: Mitteilung (2026)", url: "https://www.bafin.de/mitteilung-2026" },
    { titel: "EUR-Lex: Richtlinie (EU) 2023/2225", url: "https://eur-lex.europa.eu/eli/dir/2023/2225/oj" },
  ];
  return {
    titel: opt.titel ?? (bereich === "business" ? "Firmenkredite im Herbst 2026: Was Banken jetzt prüfen" : "Neue Kreditregeln ab 20. November 2026: Was sich für Sie ändert"),
    untertitel: "Ein Untertitel in einem Satz.",
    teaser: "Ein kurzer Teaser, der unter 160 Zeichen bleibt und neugierig macht.",
    inhalt: teile.join("\n\n"),
    faq: [1, 2, 3, 4, 5].map((i) => ({ frage: `Frage ${i}?`, antwort: "Eine Antwort in zwei Sätzen. Mit einem Hinweis auf die Quelle." })),
    metaTitel: "Kreditregeln 2026: Was sich ändert",
    metaBeschreibung: "Was sich ab 20. November 2026 ändert – mit Quellen erklärt.",
    schlagworte: ["Kredit", "Verbraucherkredit", "Richtlinie", "2026"],
    quellen,
  };
}

function recherche(bereich: "privat" | "business", titel: string, keyword: string) {
  const fakten = [
    { aussage: "Die Richtlinie gilt ab 20. November 2026.", quelle: "EUR-Lex", url: "https://eur-lex.europa.eu/eli/dir/2023/2225/oj", datum: "2023" },
    { aussage: "Die Zahl der Insolvenzen stieg 2026.", quelle: "Destatis", url: "https://www.destatis.de/insolvenzen-2026", datum: "Oktober 2026" },
    { aussage: "Die BaFin hat dazu informiert.", quelle: "BaFin", url: "https://www.bafin.de/mitteilung-2026", datum: "2026" },
    { aussage: "Ein vierter Fakt.", quelle: "Bundesbank", url: "https://www.bundesbank.de/fakt-4", datum: "2026" },
  ];
  return { titel, keyword, kategorie: bereich === "business" ? "firmen" : "kredit", land: "DE", anlass: "Neue Regel ab 20.11.2026.", fokus: "Was gilt.", suchintention: "Was ändert sich?", fiaonBezug: "Passt.", fakten, quellen: fakten.map((f) => ({ titel: f.quelle, url: f.url })), gefundenAm: new Date().toISOString() };
}

/** Die Attrappe der KI — zählt Aufrufe und liefert, was der Test vorgibt. */
function attrappe(plan: { themen?: any[]; artikel?: ((auftrag: any, n: number) => any)[]; immer?: (auftrag: any, n: number) => any }) {
  const log = { themen: 0, schreiben: 0, auftraege: [] as any[], themaAuftraege: [] as any[] };
  const ki = {
    async themaFinden(a: any) {
      log.themaAuftraege.push(a);
      // Ohne Vorgabe: ein Thema aus vier zufälligen Wörtern — kein Zufallstreffer der Doppel-Wand.
      const z = () => Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 7) || "wort";
      const t = plan.themen?.[log.themen] ?? plan.themen?.[plan.themen.length - 1] ?? recherche(a.bereich, `${z()} ${z()} ${z()} ${z()}`, `${z()} ${z()}`);
      log.themen++;
      return { recherche: typeof t === "function" ? t(a) : t, modell: "attrappe" };
    },
    async artikelSchreiben(a: any) {
      log.auftraege.push(a);
      const n = log.schreiben++;
      const f = plan.artikel?.[n] ?? plan.immer ?? ((x: any) => muster(x.bereich));
      return { daten: f(a, n), modell: "attrappe" };
    },
  };
  return { ki, log };
}

async function main() {
  const r = await import("../server/lib/fiaon-ratgeber-redaktion");
  const sh = await import("../shared/fiaon-ratgeber");

  // ═══ A. OFFLINE ═══════════════════════════════════════════════════════════
  gruppe("A1 Bereich je Kategorie");
  ok(sh.bereichVonKategorie("firmen") === "business", "„firmen“ → business");
  ok(["eintraege", "auskunft", "karte", "kredit", "score", "inkasso", "at", "ch", "grundlagen"].every((k) => sh.bereichVonKategorie(k) === "privat"), "alle anderen Kategorien → privat");
  ok(sh.bereichVonKategorie(null) === "privat" && sh.bereichVonKategorie("unbekannt") === "privat", "leer/unbekannt → privat");
  ok(JSON.stringify(sh.kategorienFuer("business")) === JSON.stringify(["firmen"]) && !sh.kategorienFuer("privat").includes("firmen" as any), "kategorienFuer trennt sauber");
  ok(!!sh.KATEGORIEN.firmen?.label, "„firmen“ hat ein Label (Redaktion, Artikelseite)");

  gruppe("A2 Der Berliner Tag (06:00, Mitternacht, Sommer/Winter)");
  const ft = (iso: string) => r.faelligerTag(new Date(iso));
  ok(!ft("2026-10-15T03:59:00Z").faellig && ft("2026-10-15T03:59:00Z").tag === "2026-10-15", "05:59 Sommerzeit → noch nicht fällig");
  ok(ft("2026-10-15T04:00:00Z").faellig, "06:00 Sommerzeit → fällig");
  const nacht = ft("2026-10-14T22:30:00Z");
  ok(nacht.tag === "2026-10-15" && nacht.vortag === "2026-10-14" && !nacht.faellig, `00:30 Berlin: Tag 15., Vortag 14. (nicht 13.) — ${nacht.tag}/${nacht.vortag}`);
  ok(!ft("2026-12-01T04:59:00Z").faellig && ft("2026-12-01T05:00:00Z").faellig, "Winterzeit: 05:59 nein, 06:00 ja");
  ok(ft("2026-10-25T05:00:00Z").faellig && ft("2026-10-25T05:00:00Z").tag === "2026-10-25", "Tag der Zeitumstellung: 06:00 MEZ fällig");
  ok(r.tagPlus("2026-03-01", -1) === "2026-02-28" && r.tagPlus("2028-03-01", -1) === "2028-02-29" && r.tagPlus("2026-12-31", 1) === "2027-01-01", "tagPlus über Monats-, Schaltjahr- und Jahresgrenze");
  ok(r.berlinStunde(new Date("2026-10-15T06:00:00Z")) === 8, "berlinStunde ohne NaN-Falle (08 Uhr)");

  gruppe("A3 Nächster Lauf");
  const nl = r.naechsterLauf(new Date("2026-10-15T10:00:00Z"), new Date("2026-10-15T09:40:00Z"), true);
  ok(nl.toISOString() === "2026-10-16T04:00:00.000Z", `beide fertig → morgen 06:00 Berlin (${nl.toISOString()})`);
  ok(r.naechsterLauf(new Date("2026-12-01T03:00:00Z"), null, false).toISOString() === "2026-12-01T05:00:00.000Z", "vor 06:00 im Winter → heute 06:00 MEZ");
  ok(r.naechsterLauf(new Date("2026-10-15T10:00:00Z"), new Date("2026-10-15T09:50:00Z"), false).toISOString() === "2026-10-15T10:20:00.000Z", "offen → letzter Beginn + 30 Minuten");

  gruppe("A4 Doppelte Themen");
  const vorh = [{ titel: "SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind – und wie Sie vorgehen", keyword: "schufa eintrag löschen", slug: "schufa-eintrag-loeschen-lassen" }];
  ok(!!r.themaDoppelt({ titel: "Ganz anderer Titel", keyword: "SCHUFA Eintrag löschen" }, vorh), "gleiches Keyword (andere Schreibung) → doppelt");
  ok(!!r.themaDoppelt({ titel: "SCHUFA-Eintrag löschen lassen: welche Einträge angreifbar sind und wie Sie vorgehen", keyword: "neu" }, vorh), "fast derselbe Titel → doppelt");
  ok(r.themaDoppelt({ titel: "Neue Kreditregeln ab 20. November 2026: Was sich für Sie ändert", keyword: "verbraucherkreditrichtlinie 2026" }, vorh) === null, "neues Thema → frei");
  ok(r.themaDoppelt({ titel: "SCHUFA-Eintrag löschen nach dem BGH-Urteil vom Oktober 2026", keyword: "schufa bgh urteil oktober" }, vorh) === null, "neuer Blickwinkel auf bekanntes Feld → frei");

  gruppe("A5 Kürzen, Adressen, Quellen nur aus der Recherche");
  const k = r.kuerzen("Wort ".repeat(60), 155);
  ok(k.length <= 155 && k.endsWith("…") && !/\s…$/.test(k), `kuerzen: ${k.length} Zeichen, Wortgrenze`);
  ok(r.urlNorm("https://WWW.Destatis.de/a/b/#x") === "https://destatis.de/a/b" && r.urlNorm("kaputt") === "", "urlNorm: Host klein, ohne www/Anker/Schrägstrich");
  ok(r.urlSauber("https://www.irs.gov/instructions/i5472?trk=public_post_comment-text&utm_source=x") === "https://www.irs.gov/instructions/i5472"
    && r.urlSauber("https://www.irs.gov/instructions/iss4?topic=banking") === "https://www.irs.gov/instructions/iss4?topic=banking", "urlSauber: Verfolgungs-Anhängsel weg, echte Parameter bleiben");
  const rech = recherche("privat", "T", "k") as any;
  const roh = muster("privat", { quellen: [{ titel: "Erfunden", url: "https://erfunden.example/studie" }, { titel: "EUR-Lex", url: "https://eur-lex.europa.eu/eli/dir/2023/2225/oj/" }, { titel: "Destatis", url: "https://destatis.de/insolvenzen-2026" }, { titel: "BaFin", url: "https://www.bafin.de/mitteilung-2026" }] });
  roh.inhalt = `# Doppelter Titel\n\nGeschätzte Lesezeit: etwa neun Minuten.\n\n${roh.inhalt}\n\n## Quellen\n\n- [Selbst geschrieben](https://irgendwo.example)`;
  const nb = r.artikelNachbereiten(roh as any, rech);
  ok(!/^# /m.test(nb.inhalt), "H1 der KI entfernt");
  ok(!/Lesezeit/i.test(nb.inhalt.slice(0, 200)), "Zeile „Geschätzte Lesezeit“ am Anfang entfernt");
  ok((nb.inhalt.match(/^## Quellen/gm) || []).length === 1 && !nb.inhalt.includes("irgendwo.example"), "eigener Quellenblock der KI ersetzt");
  ok(!nb.inhalt.includes("erfunden.example") && nb.quellen.length === 3, `erfundene Adresse fällt heraus, drei echte bleiben (${nb.quellen.length})`);
  ok(nb.inhalt.includes("(https://eur-lex.europa.eu/eli/dir/2023/2225/oj)"), "Adresse in der Schreibweise der Recherche");
  const roheRecherche = { titel: "T", keyword: "K", kategorie: "firmen", land: "DE", fakten: [
    { aussage: "Gesehen", quelle: "Destatis", url: "https://www.destatis.de/a", datum: "2026" },
    { aussage: "Nicht gesehen", quelle: "Erfunden", url: "https://erfunden.example/x", datum: "2026" },
    { aussage: "Ohne Adresse", quelle: "Niemand", url: "", datum: "2026" }] };
  const rb = r.rechercheBereinigen(roheRecherche, ["https://destatis.de/a/"], "privat");
  ok(rb.fakten.length === 1 && rb.fakten[0].aussage === "Gesehen", "Recherche: nur Fakten, deren Adresse die Suche gesehen hat");
  ok(rb.kategorie !== ("firmen" as any) && sh.kategorienFuer("privat").includes(rb.kategorie), "Recherche: Kategorie wird in den Bereich gezwungen");
  ok(r.rechercheBereinigen(roheRecherche, [], "privat").fakten.length === 2, "ohne Quellenliste der Suche: Fakten mit Adresse bleiben");

  gruppe("A6 Der strenge Prüfstand als Tor");
  const links = r.linkZiele("privat").map((l) => l.pfad);
  const linksB = r.linkZiele("business").map((l) => l.pfad);
  ok(links.includes("/privatkunden") && links.includes("/bonitaetsauskunft") && !links.some((l) => l.startsWith("/business")), "Privat-Links: Angebote, keine Business-Seiten");
  ok(linksB.includes("/business") && linksB.includes("/business/firmenkarten-kapital") && linksB.every((l) => l.startsWith("/business")), "Business-Links: nur die Business-Welt");
  const tor = (b: "privat" | "business", f?: any) => { const d = r.artikelNachbereiten(muster(b, { fehler: f }) as any, recherche(b, "T", "kredit") as any); return r.torPruefen(d, recherche(b, "T", "kredit") as any, b, r.linkZiele(b)); };
  ok(tor("privat").ok, "Musterartikel privat: Tor offen", tor("privat").punkte.filter((p) => p.art === "fehler").map((p) => p.text).join(" | "));
  ok(tor("business").ok, "Musterartikel business: Tor offen", tor("business").punkte.filter((p) => p.art === "fehler").map((p) => p.text).join(" | "));
  for (const f of ["garantie", "kurz", "ohneFiaon", "fremdlink", "gamechanger", "du"] as const) ok(!tor("privat", f).ok, `privat mit „${f}“ → Tor zu`);
  ok(!tor("business", "bisZu").ok && tor("privat", "bisZu").ok, "„bis zu“ sperrt nur Business (FIAON-Global-Regel)");
  const beste = (satz: string) => { const m = muster("privat"); m.inhalt += `\n\n${satz}`; return sh.pruefstand(m as any, { streng: true }).punkte.some((p) => /Superlativ/.test(p.text)); };
  ok(!beste("Die beste Arbeitsregel lautet: nicht vermischen.") && beste("FIAON ist die beste Lösung für Sie."), "„die beste …“ nur im Satz über FIAON (Echtlauf-Fehlalarm behoben)");
  const kette = muster("privat"); kette.inhalt += "\n\nBeim Thema **boi reporting us llc** gilt das auch.";
  const wortkette = (x: any, kw: string) => sh.pruefstand({ ...x, keyword: kw } as any, { streng: true }).punkte.some((p) => p.art === "fehler" && /Wortkette/.test(p.text));
  ok(wortkette(kette, "boi reporting us llc") && !wortkette(muster("privat"), "kredit ohne schufa"), "Keyword als klein geschriebene Wortkette → Tor zu (natürliches Keyword stört nicht)");
  const jahr = (satz: string) => { const m = muster("privat"); m.inhalt += `\n\n${satz}`; return sh.pruefstand(m as any, { streng: true }).punkte.some((p) => p.art === "fehler" && /Jahreszahl/.test(p.text)); };
  ok(jahr("Seit August zweitausendsechsundzwanzig gilt das.") && !jahr("Seit August 2026 gilt das, binnen zwei Wochen."), "ausgeschriebene Jahreszahl → Tor zu (Echtlauf 15.10.)");
  const normal = sh.pruefstand(muster("privat", { fehler: "gamechanger" }) as any);
  ok(normal.ok && normal.punkte.some((p) => p.art === "hinweis" && /Gamechanger/i.test(p.text)), "im Redaktionsmodus ist derselbe Superlativ nur ein Hinweis");
  const ohneQuellen = muster("privat"); const dq = r.artikelNachbereiten({ ...ohneQuellen, quellen: [] } as any, recherche("privat", "T", "kredit") as any);
  ok(!r.torPruefen(dq, recherche("privat", "T", "kredit") as any, "privat", r.linkZiele("privat")).ok, "ohne Quellenblock → Tor zu (E-034)");

  // ═══ B. LOKALE DATENBANK ══════════════════════════════════════════════════
  const url = String(process.env.DATABASE_URL || "");
  if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
    ok(false, "DB-Teil: DATABASE_URL zeigt nicht auf eine lokale Wegwerf-Datenbank — Teil B nicht gelaufen");
  } else {
    const { sqlPool: sql } = await import("../server/lib/db-pool");
    await r.ensureRatgeberTabelle();

    gruppe("B1 Rückfüllung (Wanderung 109) und Spalten");
    await sql`INSERT INTO fiaon_ratgeber (slug, titel, kategorie, status, bereich, inhalt) VALUES ('pruef-e379-firma-alt', 'Alter Firmenartikel', 'firmen', 'veroeffentlicht', 'privat', 'x') ON CONFLICT (slug) DO NOTHING`;
    const mig = readFileSync("db/migrations/109_ratgeber_bereich.sql", "utf8");
    await sql.unsafe(mig); await sql.unsafe(mig);
    const [alt] = (await sql`SELECT bereich FROM fiaon_ratgeber WHERE slug = 'pruef-e379-firma-alt'`) as any[];
    ok(alt?.bereich === "business", "kategorie firmen → bereich business (zweimal ausgeführt, wiederholbar)");
    const spalten = ((await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_ratgeber'`) as any[]).map((x) => x.column_name);
    ok(["bereich", "tagesartikel", "recherche", "anlass", "versuche", "sprache"].every((c) => spalten.includes(c)), "neue Spalten da");
    const [idx] = (await sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'fiaon_ratgeber_tagesartikel_uq'`) as any[];
    ok(/UNIQUE/.test(String(idx?.indexdef)), "eindeutiger Index bereich + tagesartikel");
    await sql`UPDATE fiaon_ratgeber SET status = 'archiv' WHERE slug = 'pruef-e379-firma-alt'`;

    gruppe("B2 Tor + Wiederholung: erst Fehler, dann durch — Fehler gehen an die KI zurück");
    const T1 = new Date("2026-11-02T08:00:00Z"); // 09:00 MEZ
    const a1 = attrappe({
      themen: [(a: any) => recherche(a.bereich, a.bereich === "business" ? "Firmenkredite im Herbst 2026: was Banken prüfen" : "Kreditregeln ab 20. November 2026 erklärt", a.bereich === "business" ? "firmenkredit herbst 2026" : "verbraucherkredit richtlinie 2026")],
      immer: (a: any, n: number) => muster(a.bereich, { fehler: n % 2 === 0 ? "garantie" : undefined }),
    });
    const e1 = await r.tagesartikelLauf({ jetzt: T1, ki: a1.ki as any });
    ok(e1.faellig && e1.fehlt.length === 0 && e1.veroeffentlicht === 2, `beide Bereiche veröffentlicht (${e1.veroeffentlicht}, fehlt ${e1.fehlt.join(",") || "nichts"})`, e1.grund ?? "");
    ok(a1.log.themen === 2 && a1.log.schreiben === 4, `zwei Recherchen, je zwei Schreibversuche (${a1.log.themen}/${a1.log.schreiben})`);
    const zweiter = a1.log.auftraege[1];
    ok(Array.isArray(zweiter?.fehler) && zweiter.fehler.some((f: string) => /garantie/i.test(f)) && !!zweiter.vorlage, "2. Versuch bekommt die Fehler des Prüfstands und den Entwurf");
    const rows1 = (await sql`SELECT * FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-02' ORDER BY bereich`) as any[];
    ok(rows1.length === 2 && rows1.every((x) => x.status === "veroeffentlicht" && x.quelle === "ki" && x.published_at), "Status veroeffentlicht, quelle ki, published_at gesetzt");
    ok(rows1.find((x) => x.bereich === "business")?.kategorie === "firmen" && rows1.find((x) => x.bereich === "privat")?.kategorie === "kredit", "Kategorie passt zum Bereich");
    const [jt] = (await sql`SELECT jsonb_typeof(faq) AS f, jsonb_typeof(schlagworte) AS s, jsonb_typeof(recherche) AS r, jsonb_typeof(pruefung) AS p FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-02' LIMIT 1`) as any[];
    ok(jt?.f === "array" && jt?.s === "array" && jt?.r === "object" && jt?.p === "object", `JSON richtig gespeichert, nicht doppelt verpackt (${JSON.stringify(jt)})`);
    ok(rows1.every((x) => /## Quellen/.test(x.inhalt) && Number(x.versuche) === 3), "Quellenblock im Text, drei KI-Aufrufe gezählt");

    gruppe("B3 Genau EIN Artikel je Bereich und Tag");
    const a2 = attrappe({});
    const e2 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-02T15:00:00Z"), ki: a2.ki as any });
    ok(e2.fehlt.length === 0 && a2.log.themen === 0 && a2.log.schreiben === 0 && e2.grund === "erledigt", "zweiter Lauf am selben Tag: keine KI, nichts Neues");
    const T3 = new Date("2026-11-03T07:00:00Z");
    const a3 = attrappe({});
    const [p1, p2] = await Promise.all([r.tagesartikelLauf({ jetzt: T3, ki: a3.ki as any }), r.tagesartikelLauf({ jetzt: T3, ki: a3.ki as any })]);
    const rows3 = (await sql`SELECT bereich, status FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-03'`) as any[];
    ok(rows3.length === 2 && rows3.every((x) => x.status === "veroeffentlicht"), `zwei gleichzeitige Läufe: je Bereich genau eine Zeile (${rows3.length})`);
    ok(p1.bereiche.concat(p2.bereiche).filter((b) => b.ergebnis === "parallel").length >= 1 || a3.log.themen === 2, `der zweite Lauf bekommt die Arbeitszeile nicht (${a3.log.themen} Recherchen)`);
    const [n3] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' AND bereich = 'privat' AND tagesartikel = '2026-11-03'`) as any[];
    ok(Number(n3.n) === 1, "genau ein veröffentlichter Privat-Artikel am 03.11.");

    gruppe("B4 Tor bleibt zu → Entwurf, nächster Lauf macht weiter, Tagesdeckel");
    const T4 = new Date("2026-11-04T07:00:00Z");
    const a4 = attrappe({ immer: (a: any) => muster(a.bereich, { fehler: "garantie" }) });
    const e4 = await r.tagesartikelLauf({ jetzt: T4, ki: a4.ki as any, nurBereich: "privat" });
    const [z4] = (await sql`SELECT id, status, versuche FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-04' AND bereich = 'privat'`) as any[];
    ok(e4.fehlt.includes("privat") && z4?.status === "entwurf" && a4.log.schreiben === r.VERSUCHE_JE_LAUF, `nach ${r.VERSUCHE_JE_LAUF} Versuchen bleibt es Entwurf (${z4?.status})`);
    let geworfen = ""; try { r.ratgeberLaufPruefen(e4); } catch (x: any) { geworfen = String(x?.message); }
    ok(/Tagesartikel fehlt/.test(geworfen), "der Takt meldet FEHLER statt Erfolg (Historie, Ampel)");
    const a4b = attrappe({ immer: (a: any) => muster(a.bereich) });
    const e4b = await r.tagesartikelLauf({ jetzt: new Date("2026-11-04T07:30:00Z"), ki: a4b.ki as any, nurBereich: "privat" });
    const [z4b] = (await sql`SELECT id, status FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-04' AND bereich = 'privat'`) as any[];
    ok(e4b.fehlt.length === 0 && z4b?.id === z4?.id && z4b?.status === "veroeffentlicht" && a4b.log.themen === 0, "Wiederanlauf: dieselbe Zeile, keine neue Recherche, jetzt veröffentlicht");
    ok(a4b.log.auftraege[0]?.fehler?.length > 0 && !!a4b.log.auftraege[0]?.vorlage, "Wiederanlauf überarbeitet den letzten Entwurf mit dessen Fehlern");
    const T5 = new Date("2026-11-05T07:00:00Z");
    const a5 = attrappe({ immer: (a: any) => muster(a.bereich, { fehler: "kurz" }) });
    for (let i = 0; i < 5; i++) await r.tagesartikelLauf({ jetzt: T5, ki: a5.ki as any, nurBereich: "business" });
    const [z5] = (await sql`SELECT versuche, status FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-05' AND bereich = 'business'`) as any[];
    ok(Number(z5?.versuche) === r.VERSUCHE_JE_TAG && a5.log.themen + a5.log.schreiben === r.VERSUCHE_JE_TAG && z5?.status === "entwurf", `Tagesdeckel: höchstens ${r.VERSUCHE_JE_TAG} KI-Aufrufe (${z5?.versuche})`);

    gruppe("B5 Ein Hand-Artikel des Tages zählt; vor 06:00 zählt der Vortag");
    await sql`INSERT INTO fiaon_ratgeber (slug, titel, kategorie, status, quelle, bereich, inhalt, published_at) VALUES ('pruef-e379-hand', 'Von Hand', 'score', 'veroeffentlicht', 'hand', 'privat', 'x', '2026-11-06T10:00:00+01:00') ON CONFLICT (slug) DO NOTHING`;
    const a6 = attrappe({});
    const e6 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-06T12:00:00Z"), ki: a6.ki as any });
    ok(a6.log.auftraege.every((x) => x.bereich === "business") && a6.log.themaAuftraege.every((x) => x.bereich === "business") && e6.fehlt.length === 0, "privat schon von Hand erschienen → nur Business wird geschrieben");
    const a7 = attrappe({});
    const e7 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-08T04:00:00Z"), ki: a7.ki as any }); // 05:00 MEZ, Vortag 07.11. leer
    ok(!e7.faellig && e7.tag === "2026-11-07" && e7.fehlt.length === 2 && a7.log.themen === 0, "vor 06:00: keine KI, Vortag ohne Artikel wird gemeldet");
    let g7 = ""; try { r.ratgeberLaufPruefen(e7); } catch (x: any) { g7 = String(x?.message); }
    ok(/2026-11-07/.test(g7), "… und als Fehler in der Historie (nicht „erfolg“)");
    const e8 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-03T04:00:00Z"), ki: a7.ki as any }); // Vortag 02.11. erfüllt
    let g8 = "kein Fehler"; try { r.ratgeberLaufPruefen(e8); } catch (x: any) { g8 = String(x?.message); }
    ok(g8 === "kein Fehler" && e8.grund === "vor 06:00", "erfüllter Vortag vor 06:00 → Erfolg");
    const e9 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-09T04:00:00Z"), ki: attrappe({}).ki as any, sofort: true, nurBereich: "privat" });
    ok(e9.faellig && e9.tag === "2026-11-09" && e9.veroeffentlicht === 1, "„Tagesartikel jetzt“ (sofort) läuft auch vor 06:00");

    gruppe("B6 Doppeltes Thema wird abgelehnt, die KI bekommt den Grund");
    const a10 = attrappe({ themen: [recherche("privat", "Kreditregeln ab 20. November 2026 erklärt", "verbraucherkredit richtlinie 2026"), recherche("privat", "Pfändungsfreibetrag 2027: was sich ändert", "pfändungsfreibetrag 2027")] });
    const e10 = await r.tagesartikelLauf({ jetzt: new Date("2026-11-10T07:00:00Z"), ki: a10.ki as any, nurBereich: "privat" });
    ok(a10.log.themen === 2 && a10.log.themaAuftraege[1]?.ausschliessen?.some((x: string) => /Kreditregeln/.test(x)), "zweite Recherche mit dem abgelehnten Thema");
    const [z10] = (await sql`SELECT titel, keyword FROM fiaon_ratgeber WHERE tagesartikel = '2026-11-10' AND bereich = 'privat'`) as any[];
    ok(e10.veroeffentlicht === 1 && z10?.keyword === "pfändungsfreibetrag 2027", `veröffentlicht wird das neue Thema (${z10?.keyword})`);
    ok(a10.log.themaAuftraege[0]?.vorhandene?.length > 10 && a10.log.themaAuftraege[0].vorhandene.every((v: any) => v.bereich !== "business"), "die Recherche sieht die vorhandenen Titel ihres Bereichs");

    gruppe("B7 Öffentliche Liste: ?bereich= und Weiterlesen im Bereich");
    const express = (await import("express")).default;
    const router = (await import("../server/routes/fiaon-ratgeber")).default;
    const app = express(); app.use(express.json()); app.use("/api/fiaon", router);
    const srv = app.listen(0); await new Promise((res) => srv.once("listening", res));
    const port = (srv.address() as any).port;
    const holen = async (p: string) => (await fetch(`http://127.0.0.1:${port}/api/fiaon${p}`)).json() as Promise<any>;
    const lb = await holen("/ratgeber?bereich=business&sprache=de");
    const lp = await holen("/ratgeber?bereich=privat");
    const la = await holen("/ratgeber");
    ok(lb.ok && lb.artikel.length > 0 && lb.artikel.every((x: any) => x.bereich === "business"), `?bereich=business → nur Business (${lb.artikel?.length})`);
    ok(lp.ok && lp.artikel.length > 0 && lp.artikel.every((x: any) => x.bereich === "privat"), `?bereich=privat → nur Privat (${lp.artikel?.length})`);
    ok(la.artikel.length === lb.artikel.length + lp.artikel.length, "ohne Filter: beide (rückwärtskompatibel)");
    ok(lb.artikel.every((x: any) => x.quellen === undefined && x.pruefung === undefined && x.inhalt === undefined), "öffentlich ohne Recherche, Prüfung, Inhalt");
    const lim = await holen("/ratgeber?bereich=business&limit=1");
    ok(lim.artikel.length === 1, "?limit= greift");
    // Rückfallobjekt statt TypeError: Eine leere Liste macht diese Prüfung rot, nicht den ganzen Prüfstand tot.
    const ein = await holen(`/ratgeber/${encodeURIComponent(lb.artikel?.[0]?.slug ?? "keiner")}`);
    ok(ein.ok && ein.artikel?.bereich === "business" && ((ein.weitere ?? []) as any[]).every((w) => lb.artikel.some((x: any) => x.slug === w.slug)), "Weiterlesen bleibt im Bereich");
    const adm = await holen("/admin/ratgeber");
    ok(adm.ok && adm.heute && "privat" in adm.heute && "business" in adm.heute && "naechsterLauf" in adm, "Redaktion: Stand von heute je Bereich + nächster Lauf");
    srv.close();
    await sql.end({ timeout: 2 });
  }

  // ═══ C. QUELLTEXT-WAND ════════════════════════════════════════════════════
  gruppe("C Quelltext-Wand");
  const lies = (p: string) => readFileSync(p, "utf8");
  const { LAUF_FOLGEN } = await import("../server/lib/fiaon-crons");
  ok(!!LAUF_FOLGEN["ratgeber-tagesartikel"]?.folge, "LAUF_FOLGEN kennt „ratgeber-tagesartikel“ (Ampel)");
  ok(/tageslauf\('ratgeber-tagesartikel',\s*async \(\) => await fiaonRatgeber\.ratgeberTageslaufStreng\(\)/.test(lies("server/routes.ts")), "der Takt ist registriert (REGISTRIERT) und meldet Fehlendes als Fehler");
  ok(r.RATGEBER_LAUF === "ratgeber-tagesartikel", "ein Name für Takt, Katalog und Redaktion");
  ok(/bereich=privat/.test(lies("client/src/pages/site/ratgeber.tsx")), "/ratgeber holt nur Privat");
  ok(/bereich=business&sprache=de/.test(lies("client/src/pages/site/global-seite.tsx")) && /RedaktionAktuell/.test(lies("client/src/pages/site/global-seite.tsx")), "/business/wissen zeigt die neuesten Business-Artikel");
  const art = lies("client/src/pages/site/ratgeber-artikel.tsx");
  ok(/globalPaketePfad\("de"\)/.test(art) && /\{!business && <LeseAufruf[^>]*\/>\}/.test(art), "Business-Artikel: Weg zu FIAON Global, kein Privat-Aufruf");
  const adminSeite = lies("client/src/pages/admin-ratgeber.tsx");
  ok(/Tagesartikel jetzt/.test(adminSeite) && /Automatisch veröffentlicht/.test(adminSeite) && !/info\.themenOffen|heuteErzeugt/.test(adminSeite), "Redaktion: „Heute“ statt „Themen offen“, Knopf „Tagesartikel jetzt“");
  ok(!/chat\/completions/.test(lies("server/lib/fiaon-ratgeber-redaktion.ts")) && /openaiFetch\("ratgeber", "\/responses"/.test(lies("server/lib/fiaon-ratgeber-redaktion.ts")), "KI nur über openaiFetch → /v1/responses");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
