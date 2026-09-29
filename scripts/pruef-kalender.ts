// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-263 (29.09.2026): TERMINE IM EIGENEN KALENDER
//
// Justin: „wenn ich so ne Email bekomme von FIAON (Termin-Mail) dann muss ich
// die auch mit 1 Klick in mein Google oder Apple Kalender hinzufügen können …
// ‚Alle Termine zu Kalender hinzufügen' … wenn ich nochmal drauf klicke und 1
// neuer Termin ist hinzugekommen dann nur der 1 Termin, nicht alle anderen doppelt."
// Regeln: server/lib/fiaon-ics.ts, fiaon-kalender-abo.ts, server/routes/fiaon-kalender.ts.
//
//   A  ohne Datenbank
//      1  Datei: CRLF, ≤ 75 Oktette, Fortsetzung mit Leerzeichen, Entfalten = Ursprung,
//         BEGIN/END paarig, je VEVENT UID/DTSTAMP/DTSTART
//      2  Maskierung „, ; \ Umbruch", Umlaute + 4-Byte-Zeichen genau an der Faltgrenze
//      3  Zeitumstellung 25.10.2026 / 28.03.2027; Google-Zeiten = ICS-Zeiten
//      4  Google-Link: nur erlaubte Parameter, kein Kundenname, Art im Titel, < 2.000 Zeichen
//      5  Token: 43 Zeichen base64url; falsche Form → unbekannt ohne Ausnahme; zwei Abos, zwei Token
//      6  (Gegenprüfung) kontoDarfAbo: gesperrt/deaktiviert/ohne Inhaber-Stufe → kein Abo;
//         keine METHOD-Zeile bei PUBLISH; Steuerzeichen raus; leerer Kalender für tote Links
//   B  mit Datenbank (lokaler Prüfstand)
//      6  aboHolen zweimal (auch gleichzeitig) → dieselbe Zeile
//      7  Feed A: nur A, nur gebucht/erledigt/verpasst im Fenster, jede UID einmal
//      8  „Nur der 1 neue Termin": ein VEVENT mehr, alle anderen Byte für Byte gleich, ETag neu
//      9  Verschieben → SEQUENCE +1, UID gleich, DTSTART neu
//      10 Absagen → fehlt im Feed; Einzeldatei METHOD:CANCEL, STATUS:CANCELLED, SEQUENCE höher
//      11 Übergabe A→B → bei B mit gleicher UID; A-Link tot
//      12 Erneuern/Beenden; Team-Abo: echte Mitarbeiter OHNE den Inhaber, kein fremdes Testkonto;
//         „Meine" + „Team" teilen keine UID; aboAktiv zählt nur „eigene"
//      13 Mail „Neuer Termin" / „ABGESAGT": Knöpfe, Textteil, Google ohne Namen; mit laufendem Abo
//         KEINE Einzelknöpfe; ohne Abo-Tabelle geht die Mail trotzdem raus
//      14 Trigger: nur notiz geändert → SEQUENCE bleibt
//      15 Kunde: Datei (Sie-Link), abgesagt → CANCEL, Mailzeile (Bestätigung/Erinnerung/Absage),
//         ohne Felder byte-gleich; Satz zum früheren Termin; Global englisch + CANCEL
//      16 Konto zu → Abo zu: Sperre/Deaktivierung/Stufe weg widerruft (Trigger), Abruf prüft
//         das Konto (auch ohne Trigger), Entsperren belebt nichts, Einzel-Link tot
//   C  HTTP (echte Router, lokaler Express): 200/HEAD/304/429, toter Link → leerer Kalender (200),
//      kein Last-Modified (If-Modified-Since allein → 200), Seite, Abruf-Klasse, Kundendatei CANCEL,
//      Mitarbeiter-Route (nur „eigene"), Chef-Route (eigene + team)
//   E  Rot-Proben: Faltung aus → 1 rot; fremder Termin im Feed → 7 rot; DTSTAMP=jetzt → 8 rot;
//      Trigger aus → 9 rot; alte UTF-16-Faltung → 2 rot; Konto-Regel „immer ja" → 6 rot;
//      gemeinsame UID in zwei Abos → 12 rot
//   D  Browser (--browser, laufender lokaler Server PRUEF_BASIS): Knopf finden und drücken,
//      Doppelklick lässt das Blatt offen, Absage-Seite „Aus Ihrem Kalender entfernen"
//
// NUR gegen die lokale Test-DB. Kein Netz: Brevo ist eine Attrappe, alles andere gesperrt.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e263?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-kalender.ts [--browser]
// Eigene Datensätze (Personen PRUEF263-…) werden am Ende entfernt. Fremde Abo-Zeilen der Prüf-Agenten
// werden NIE gelöscht: vorübergehend widerrufen und am Ende wiederhergestellt (Gegenprüfung 29.09.2026).
// Termin-Zeiten liegen auf FREIEN Plätzen (fiaon_termine_keine_ueberschneidung), nicht auf festen Stunden.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
const MIT_BROWSER = process.argv.includes("--browser");

// ── Brevo-Attrappe VOR jedem Import; alles andere außer localhost ist gesperrt ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
process.env.MAKE_WEBHOOK_URL = "";
const BREVO: { an: string; betreff: string; html: string; text: string }[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    BREVO.push({ an: String(b.to?.[0]?.email ?? "").toLowerCase(), betreff: String(b.subject ?? ""), html: String(b.htmlContent ?? ""), text: String(b.textContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<e263-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { createHash, createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): boolean {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 700)}`); }
  return b;
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);

const ics = await import("../server/lib/fiaon-ics");
const kal = await import("../server/lib/fiaon-kalender-abo");
const kText = await import("../shared/fiaon-kalender-abo");
const { berlinZeitpunkt } = await import("../server/lib/fiaon-time");

// ── Die Prüfungen als Funktionen — damit die Rot-Proben (E) sie auf kaputte Eingaben anwenden können ──
const entfalten = (s: string) => s.replace(/\r\n[ \t]/g, "");
const EINSAM = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
/** 1 — die Form der Datei. Liefert die Liste der Verstöße (leer = gut). */
function dateiVerstoesse(s: string): string[] {
  const v: string[] = [];
  if (!s.endsWith("\r\n")) v.push("endet nicht mit CRLF");
  if (/[^\r]\n/.test(s) || /\r(?!\n)/.test(s)) v.push("nacktes LF/CR");
  const zeilen = s.split("\r\n").slice(0, -1);
  for (const z of zeilen) {
    if (Buffer.byteLength(z, "utf8") > 75) { v.push(`Zeile > 75 Oktette: ${z.slice(0, 40)}…`); break; }
    if (EINSAM.test(z) || Buffer.from(z, "utf8").toString("utf8") !== z) { v.push(`Zeile zerteilt ein Zeichen: ${z.slice(0, 40)}…`); break; }
  }
  const echt = entfalten(s).split("\r\n").slice(0, -1);
  const zahl = (re: RegExp) => echt.filter((z) => re.test(z)).length;
  for (const b of ["VCALENDAR", "VEVENT", "VALARM"]) if (zahl(new RegExp(`^BEGIN:${b}$`)) !== zahl(new RegExp(`^END:${b}$`))) v.push(`BEGIN/END ${b} ungleich`);
  const bloecke = entfalten(s).split("BEGIN:VEVENT").slice(1);
  for (const b of bloecke) for (const f of ["UID:", "DTSTAMP:", "DTSTART:"]) if (!new RegExp(`\\r\\n${f}`).test(`\r\n${b}`)) v.push(`VEVENT ohne ${f}`);
  return v;
}
const vevents = (s: string) => entfalten(s).split("\r\n").join("\n").match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
const uidVon = (e: string) => /\nUID:([^\n]+)/.exec(`\n${e}`)?.[1] ?? "";
const feld = (e: string, f: string) => new RegExp(`(?:^|\\n)${f}:([^\\n]*)`).exec(e)?.[1] ?? null;
/** 8 — „nur der eine neue": vorher ⊂ nachher Byte für Byte, genau ein Block mehr. */
function nurEinNeuer(vorher: string, nachher: string): { ok: boolean; grund: string } {
  const a = vevents(vorher), b = vevents(nachher);
  if (b.length !== a.length + 1) return { ok: false, grund: `${a.length} → ${b.length} Blöcke` };
  const rest = new Set(b);
  for (const x of a) if (!rest.delete(x)) return { ok: false, grund: `Block ${uidVon(x)} hat sich geändert` };
  return { ok: rest.size === 1, grund: `neu: ${Array.from(rest).map(uidVon).join(",")}` };
}
/** 7 — Feed eines Mitarbeiters: nur erlaubte UIDs, jede einmal. */
function feedNur(feed: string, erlaubt: Set<string>): { ok: boolean; grund: string } {
  const uids = vevents(feed).map(uidVon);
  const fremd = uids.filter((u) => !erlaubt.has(u));
  const doppelt = uids.filter((u, i) => uids.indexOf(u) !== i);
  return { ok: fremd.length === 0 && doppelt.length === 0, grund: `fremd: ${fremd.join(",")} doppelt: ${doppelt.join(",")}` };
}

/** 12 — zwei Abos teilen keine UID (sonst steht ein Termin in zwei Kalendern). */
function gemeinsameUids(a: string, b: string): string[] {
  const inB = new Set(vevents(b).map(uidVon));
  return vevents(a).map(uidVon).filter((u) => inB.has(u));
}

// Alte Faltung aus fiaon-global-zeiten.ts (vor E-263) — für die Rot-Probe: schneidet an UTF-16-Einheiten.
function alteFaltung(zeile: string): string {
  const teile: string[] = [];
  let rest = zeile; let grenze = 75;
  while (Buffer.byteLength(rest, "utf8") > grenze) {
    let schnitt = Math.min(rest.length, grenze);
    while (schnitt > 1 && Buffer.byteLength(rest.slice(0, schnitt), "utf8") > grenze) schnitt--;
    teile.push(rest.slice(0, schnitt)); rest = rest.slice(schnitt); grenze = 74;
  }
  teile.push(rest);
  return teile.join("\r\n ");
}

// ═══ A ═════════════════════════════════════════════════════════════════════
abschnitt("A1. Die Datei (CRLF, Faltung, Rahmen)");
const PROBE_NAME = "Zoë Ärger-Probe";
const langerText = `Rückruf wegen Übergröße — ${"sehr lange Beschreibung mit Umlauten äöüß und Zeichen ".repeat(4)}Ende`;
const probeDatei = ics.icsKalender({
  abo: { name: "FIAON · meine Termine", beschreibung: "Probe" },
  ereignisse: [1, 2].map((i) => ({
    uid: `termin-${9000 + i}@fiaon.com`, stempel: new Date("2026-09-29T10:00:00Z"),
    beginn: new Date("2026-10-01T08:00:00Z"), ende: new Date("2026-10-01T08:20:00Z"),
    titel: `Rückruf: ${PROBE_NAME} ${i}`, beschreibung: `${langerText}\nZweite Zeile`, ort: "Telefon (FIAON)",
    url: "https://www.fiaon.com/agent/kunden?person=123", sequenz: i, alarme: [{ minutenVorher: 10, text: `Rückruf: ${PROBE_NAME}` }],
  })),
});
ok("A1 Datei ohne Verstöße (CRLF, ≤ 75 Oktette, Rahmen, UID/DTSTAMP/DTSTART)", dateiVerstoesse(probeDatei).length === 0, dateiVerstoesse(probeDatei));
ok("A1 Fortsetzungszeilen beginnen mit einem Leerzeichen", probeDatei.split("\r\n").filter((z, i, a) => i > 0 && Buffer.byteLength(a[i - 1], "utf8") === 75).every((z) => z.startsWith(" ")) && /\r\n /.test(probeDatei));
ok("A1 Entfalten ergibt die Beschreibung exakt", entfalten(probeDatei).includes(`DESCRIPTION:${ics.icsText(`${langerText}\nZweite Zeile`)}\r\n`));
ok("A1 Kopf des Abos (X-WR-CALNAME, REFRESH-INTERVAL, X-WR-TIMEZONE, kein VTIMEZONE)",
  /X-WR-CALNAME:FIAON · meine Termine\r\n/.test(probeDatei) && /REFRESH-INTERVAL;VALUE=DURATION:PT15M/.test(probeDatei) && /X-WR-TIMEZONE:Europe\/Berlin/.test(probeDatei) && !/VTIMEZONE/.test(probeDatei));
ok("A1 keine METHOD-Zeile bei PUBLISH (RFC 5546: PUBLISH verlangte ORGANIZER; DTSTAMP = Zeilenzeit nur ohne METHOD)", !/\r\nMETHOD:/.test(probeDatei));
for (const s of ["", "kurz", "a".repeat(75), "a".repeat(76), "ä".repeat(60), `${"x".repeat(73)}😀${"y".repeat(80)}`, `${"𝔸".repeat(40)}`]) {
  const f = ics.icsFalten(s);
  if (!ok(`A1 Falten/Entfalten rund (${s.length} Zeichen)`, entfalten(f) === s && f.split("\r\n").every((z) => Buffer.byteLength(z, "utf8") <= 75 && !EINSAM.test(z)), f)) break;
}

abschnitt("A2. Maskierung und 4-Byte-Zeichen an der Faltgrenze");
{
  const t = ics.icsText("Müller, Hans; Sohn\\Firma\r\nZeile 2");
  ok("A2 , ; \\ und Umbruch maskiert, CR entfernt", t === "Müller\\, Hans\\; Sohn\\\\Firma\\nZeile 2", t);
  const st = ics.icsText("a\u000bb\u0007c\u0000d\u007fe\tf\ng");
  ok("A2 Steuerzeichen (U+0000–U+001F außer Tab/Umbruch, U+007F) fliegen raus, Umbruch bleibt \\n", st === "abcde\tf\\ng", JSON.stringify(st));
  // „SUMMARY:" (8) + 66 „x" = 74 Oktette, dann ein 4-Byte-Zeichen: Es passt nicht mehr in Zeile 1.
  for (const vor of [64, 65, 66, 67, 70]) {
    const titel = `${"x".repeat(vor)}😀ä𝔸 Name`;
    const d = ics.icsKalender({ ereignisse: [{ uid: "u@x", stempel: new Date(0), beginn: new Date(0), ende: new Date(60_000), titel }] });
    const rund = Buffer.from(d, "utf8").toString("utf8");
    ok(`A2 4-Byte-Zeichen nach ${vor} Zeichen: ganz, gültiges UTF-8, entfaltet gleich`,
      dateiVerstoesse(d).length === 0 && rund === d && !rund.includes("�") && entfalten(d).includes(`SUMMARY:${titel}\r\n`), dateiVerstoesse(d));
  }
}

abschnitt("A3. Zeitumstellung (UTC in der Datei) und Google-Zeiten");
{
  const faelle: [string, string][] = [["2026-10-24", "20261024T080000Z"], ["2026-10-25", "20261025T090000Z"], ["2027-03-27", "20270327T090000Z"], ["2027-03-28", "20270328T080000Z"]];
  for (const [tag, soll] of faelle) {
    const b = berlinZeitpunkt(tag, 600);
    ok(`A3 ${tag} 10:00 Berlin → ${soll}`, ics.icsZeit(b) === soll, ics.icsZeit(b));
    const t = { id: 1, person_id: 77, agent_id: 13, beginn: b, dauer: 20, status: "gebucht", quelle: "agent_manuell", herkunft: null, created_at: b, abgesagt_am: null, kal_sequenz: 0, stand: b, name: "X", firma: null, bei_vorname: "Nikita" };
    const e = kal.terminEreignis(t as any);
    const g = new URL(kal.googleTerminLink({ person_id: 77, quelle: "agent_manuell", beginn: b, dauer: 20 }));
    const d = ics.icsKalender({ ereignisse: [e] });
    ok(`A3 ${tag}: Google „dates" = DTSTART/DTEND der Datei`, g.searchParams.get("dates") === `${feld(entfalten(d), "DTSTART")}/${feld(entfalten(d), "DTEND")}`.replace(/\r/g, ""), g.searchParams.get("dates"));
  }
}

abschnitt("A4. Google-Link: nur erlaubte Parameter, kein Name, kurz");
{
  const link = kal.googleTerminLink({ person_id: 4711, quelle: "agent_manuell", beginn: "2026-10-25T09:00:00Z", dauer: 20 });
  const u = new URL(link);
  const para = Array.from(u.searchParams.keys());
  ok("A4 nur erlaubte Parameter", para.every((p) => (ics.GOOGLE_LINK_PARAMETER as readonly string[]).includes(p)), para);
  ok("A4 Titel „FIAON · Rückruf · Kunde #4711“ (Art, kein Name)", u.searchParams.get("text") === "FIAON · Rückruf · Kunde #4711", u.searchParams.get("text"));
  const tOnb = new URL(kal.googleTerminLink({ person_id: 625, quelle: "onboarding_call", beginn: "2026-10-25T09:00:00Z", dauer: 20 })).searchParams.get("text");
  const tGlob = new URL(kal.googleTerminLink({ person_id: 608, quelle: "global", beginn: "2026-10-25T09:00:00Z", dauer: 30 })).searchParams.get("text");
  ok("A4 Art im Google-Titel: Onboarding / FIAON Global (Firma)", tOnb === "FIAON · Onboarding · Kunde #625" && tGlob === "FIAON · FIAON Global · Firma #608", { tOnb, tGlob });
  ok("A4 Länge < 2.000", link.length < 2000, link.length);
  const kunde = kal.kundenKalenderFelder({ stornoToken: "ab".repeat(24), beginn: "2026-10-25T09:00:00Z", dauerMin: 20 });
  const gk = new URL(kunde.google_kalender_url);
  ok("A4 Kunden-Google-Link: keine Daten außer Zeit (kein Token, kein Name)", !decodeURIComponent(kunde.google_kalender_url).includes("abab") && gk.searchParams.get("text") === "Gespräch mit FIAON — wir rufen Sie an", kunde);
  ok("A4 Kundenfelder ohne Storno-Token → leer (Zeile entfällt)", Object.keys(kal.kundenKalenderFelder({ stornoToken: null, beginn: new Date() })).length === 0);
}

abschnitt("A5. Token");
{
  const t1 = kal.aboTokenAus(1, "a".repeat(32)), t2 = kal.aboTokenAus(2, "a".repeat(32)), t3 = kal.aboTokenAus(1, "b".repeat(32));
  ok("A5 43 Zeichen base64url", kal.ABO_TOKEN_FORM.test(t1) && t1.length === 43, t1);
  ok("A5 verschiedene Abos → verschiedene Token", t1 !== t2 && t1 !== t3 && t2 !== t3);
  let geworfen = false; let erg: unknown = "x";
  try { erg = await kal.aboPruefen(`${t1.slice(0, 42)}!`); if (erg === null) erg = await kal.aboPruefen(t1.slice(0, 40)); } catch { geworfen = true; }
  ok("A5 falsche Form/Länge → unbekannt, ohne Ausnahme", !geworfen && erg === null);
  ok("A5 Client-Klassen aus dem User-Agent",
    kText.kalenderClientAus("iOS/17.4 (21E219) dataaccessd/1.0") === "apple" && kText.kalenderClientAus("macOS/14.4 (23E214) CalendarAgent/988") === "apple"
    && kText.kalenderClientAus("Google-Calendar-Importer") === "google" && kText.kalenderClientAus("Microsoft Office/16.0 (Microsoft Outlook 16.0.17)") === "outlook"
    && kText.kalenderClientAus("Mozilla/5.0 (Macintosh) AppleWebKit Chrome/129 Safari/537.36") === null);
}

abschnitt("A6. Wer ein Abo haben darf; der leere Kalender");
type KontoFall = { u: "eigene" | "team"; k: { aktiv: boolean; gesperrt: boolean; stufe: string | null } | null; soll: boolean; n: string };
const KONTO_FAELLE: KontoFall[] = [
  { n: "eigene · aktiv", u: "eigene", k: { aktiv: true, gesperrt: false, stufe: null }, soll: true },
  { n: "eigene · gesperrt", u: "eigene", k: { aktiv: true, gesperrt: true, stufe: null }, soll: false },
  { n: "eigene · deaktiviert", u: "eigene", k: { aktiv: false, gesperrt: false, stufe: null }, soll: false },
  { n: "eigene · deaktiviert, Stufe Geschäftsführung", u: "eigene", k: { aktiv: false, gesperrt: false, stufe: "geschaeftsfuehrung" }, soll: false },
  { n: "eigene · deaktiviert, Inhaber (kommt ins Chefbüro)", u: "eigene", k: { aktiv: false, gesperrt: false, stufe: "inhaber" }, soll: true },
  { n: "eigene · Konto fehlt", u: "eigene", k: null, soll: false },
  { n: "team · aktiv ohne Stufe", u: "team", k: { aktiv: true, gesperrt: false, stufe: null }, soll: false },
  { n: "team · Geschäftsführung", u: "team", k: { aktiv: true, gesperrt: false, stufe: "geschaeftsfuehrung" }, soll: false },
  { n: "team · Inhaber", u: "team", k: { aktiv: true, gesperrt: false, stufe: "inhaber" }, soll: true },
  { n: "team · Inhaber, gesperrt", u: "team", k: { aktiv: true, gesperrt: true, stufe: "inhaber" }, soll: false },
];
const kontoRegelFalsch = (f: (u: "eigene" | "team", k: KontoFall["k"]) => boolean) => KONTO_FAELLE.filter((c) => f(c.u, c.k) !== c.soll).map((c) => c.n);
ok("A6 kontoDarfAbo: alle zehn Fälle (gesperrt, deaktiviert, Stufe)", kontoRegelFalsch(kal.kontoDarfAbo).length === 0, kontoRegelFalsch(kal.kontoDarfAbo));
{
  const leer = kal.leererKalenderIcs();
  ok("A6 toter Link → leerer Kalender: gültig, 0 Termine, „Link gilt nicht mehr“, täglicher Abruf",
    dateiVerstoesse(leer).length === 0 && vevents(leer).length === 0 && /X-WR-CALNAME:FIAON · Link gilt nicht mehr/.test(leer) && /REFRESH-INTERVAL;VALUE=DURATION:P1D/.test(leer) && !/\r\nMETHOD:/.test(leer), leer);
}

// ═══ E (ohne Datenbank) ════════════════════════════════════════════════════
abschnitt("E. Rot-Proben ohne Datenbank (die Prüfungen MÜSSEN anschlagen)");
ok("E1 Faltung aus (entfaltete Datei) → A1 wird rot", dateiVerstoesse(entfalten(probeDatei)).some((v) => /75 Oktette/.test(v)));
{
  // „SUMMARY:" + 64 „x" = 72 Oktette: Die alte Faltung nimmt noch das halbe Emoji (3 Oktette als U+FFFD) mit.
  const titel = `${"x".repeat(64)}😀 Name`;
  const kaputt = `SUMMARY:${titel}`;
  const alt = alteFaltung(kaputt);
  ok("E2 alte UTF-16-Faltung zerteilt das 4-Byte-Zeichen → A2 wird rot", alt.split("\r\n").some((z) => EINSAM.test(z) || Buffer.from(z, "utf8").toString("utf8") !== z), alt);
}
ok("E6 Konto-Regel „immer ja“ (keine Sperr-Prüfung) → A6 wird rot", kontoRegelFalsch(() => true).length >= 5, kontoRegelFalsch(() => true));
{
  const a = "BEGIN:VEVENT\r\nUID:termin-1@fiaon.com\r\nEND:VEVENT", b = "BEGIN:VEVENT\r\nUID:termin-2@fiaon.com\r\nEND:VEVENT";
  ok("E7 dieselbe UID in zwei Abos (Team mit Inhaber-Terminen) → B12 wird rot", gemeinsameUids(`${a}\r\n${b}`, a).length === 1 && gemeinsameUids(a, b).length === 0);
}

// ═══ B ═════════════════════════════════════════════════════════════════════
const { sqlPool } = await import("../server/lib/db-pool");
const meldung = await import("../server/lib/fiaon-termin-meldung");
const { berlinDatumText } = await import("../server/lib/fiaon-termine");
const START = new Date();
const MARKE = `PRUEF263-${Date.now().toString(36)}`;
/** Der Stempel dieses Laufs in erstellt_von/widerrufen_von. */
const STEMPEL = `Prüfstand ${MARKE}`;
const A = 13, B = 8, INHABER = 928, FREMDES_TESTKONTO = 927;
const PRUEF_AGENTEN = [A, B, INHABER, FREMDES_TESTKONTO];
const personen: number[] = [];
let server: import("node:http").Server | null = null;
// Gegenprüfung 29.09.2026: Die gemeinsame Prüf-DB trägt womöglich Abos anderer Läufe (lokaler Server,
// Gegenprüfung). Sie werden NICHT gelöscht: für diesen Lauf widerrufen (sonst verfälscht ein fremdes
// aktives Abo „aboAktiv") und am Ende wiederhergestellt. Gelöscht wird nur, was dieser Lauf anlegte.
let aboVorher: number[] = [];
let fremdWiderrufen: number[] = [];
// Aus B für C/D: der Inhaber-Termin (darf nicht im Team-Feed stehen) und ein abgesagter Kundentermin.
let tInhaber: { id: number } | null = null;
let kundeAbgesagt: string | null = null;
/** Zufälliger Versatz je Lauf — zwei Läufe (oder fremde Fixtures) treffen sich nicht auf derselben Minute. */
const VERSATZ_MIN = 5 * Math.floor(Math.random() * 6);

async function person(name: string, email: string | null = null): Promise<number> {
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason, primary_email, primary_phone)
    VALUES (${`${MARKE}-${personen.length + 1}`}, ${name}, ${`Kunde${personen.length + 1}`}, ${A}, 2, 'nur_lead', ${email}, '+49 151 26300000')
    RETURNING id`) as any[];
  personen.push(Number(p.id));
  return Number(p.id);
}
async function termin(ein: { personId: number; agentId: number; beginn: Date; status?: string; quelle?: string; herkunft?: string | null; notiz?: string | null; abgesagt?: boolean }): Promise<{ id: number; storno: string; beginn: Date }> {
  const storno = createHmac("sha256", MARKE).update(`${ein.personId}.${ein.beginn.toISOString()}`).digest("hex").slice(0, 48);
  const [t] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, herkunft, notiz, abgesagt_am)
    VALUES (${ein.personId}, ${ein.agentId}, ${ein.beginn}, 20, ${ein.status ?? "gebucht"}, ${ein.quelle ?? "agent_manuell"}, ${storno},
            ${ein.herkunft ?? null}, ${ein.notiz ?? null}, ${ein.abgesagt ? new Date() : null})
    RETURNING id`) as any[];
  return { id: Number(t.id), storno, beginn: ein.beginn };
}
async function aufraeumen(): Promise<void> {
  const ids = personen.length ? personen : [-1];
  await sqlPool`DELETE FROM fiaon_testkonto_warnungen WHERE tabelle = 'fiaon_termine' AND datensatz_id IN (SELECT id::text FROM fiaon_termine WHERE person_id = ANY(${ids}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_testkonto_warnungen WHERE tabelle = 'fiaon_persons' AND datensatz_id = ANY(${ids.map(String)})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termine WHERE person_id = ANY(${ids})`.catch((e) => console.error("Aufräumen termine:", e));
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`.catch((e) => console.error("Aufräumen personen:", e));
  // Nur Zeilen, die in DIESEM Lauf für die Prüf-Agenten entstanden (auch über die HTTP-Routen) — nie ältere.
  await sqlPool`DELETE FROM fiaon_kalender_abo
                 WHERE agent_id = ANY(${PRUEF_AGENTEN}) AND erstellt_am >= ${START} AND NOT (id = ANY(${[...aboVorher, -1]}))`.catch((e) => console.error("Aufräumen abo:", e));
  if (fremdWiderrufen.length) {
    await sqlPool`
      UPDATE fiaon_kalender_abo k SET widerrufen_am = NULL, widerrufen_von = NULL
       WHERE k.id = ANY(${fremdWiderrufen}) AND k.widerrufen_von = ${`${STEMPEL} (vorübergehend)`}
         AND NOT EXISTS (SELECT 1 FROM fiaon_kalender_abo x WHERE x.agent_id = k.agent_id AND x.umfang = k.umfang AND x.widerrufen_am IS NULL)`
      .catch((e) => console.error("Wiederherstellen abo:", e));
  }
  await sqlPool`DELETE FROM fiaon_admin_log WHERE pfad LIKE '%/kalender-abo%' AND zeit >= ${START}`.catch(() => {});
}

const tag = (n: number, stunde: number) => { const d = new Date(); d.setUTCHours(stunde, 0, 0, 0); return new Date(d.getTime() + n * 86_400_000); };
/**
 * Ein FREIER Platz bei diesem Mitarbeiter, ab Tag n / Stunde (UTC) plus Versatz: fiaon_termine_keine_ueberschneidung
 * (gebucht, je Mitarbeiter) darf nie zuschnappen. Gegenprüfung 29.09.2026: tag(2, 8) traf einen fremden Termin.
 */
async function freierBeginn(agentId: number, n: number, stunde: number): Promise<Date> {
  let b = new Date(tag(n, stunde).getTime() + VERSATZ_MIN * 60_000);
  for (let i = 0; i < 40; i++) {
    const [x] = (await sqlPool`
      SELECT 1 AS belegt FROM fiaon_termine
       WHERE agent_id = ${agentId} AND status = 'gebucht' AND abgesagt_am IS NULL
         AND beginn < ${new Date(b.getTime() + 25 * 60_000)}
         AND beginn + make_interval(mins => COALESCE(dauer_min, 20)::int) > ${new Date(b.getTime() - 5 * 60_000)}
       LIMIT 1`) as any[];
    if (!x) return b;
    b = new Date(b.getTime() + 30 * 60_000);
  }
  throw new Error(`Prüfstand: kein freier Platz für Agent ${agentId} an Tag ${n}`);
}
/** Etwas in einer Transaktion prüfen und zurückrollen — Sperren und Stufen bleiben in der Prüf-DB, wie sie waren. */
async function zurueckrollen(f: (tx: any) => Promise<void>): Promise<void> {
  try { await sqlPool.begin(async (tx) => { await f(tx); throw new Error("zurückrollen"); }); }
  catch (e) { if (String((e as Error).message) !== "zurückrollen") throw e; }
}

try {
  aboVorher = ((await sqlPool`SELECT id FROM fiaon_kalender_abo WHERE agent_id = ANY(${PRUEF_AGENTEN})`) as any[]).map((r) => Number(r.id));
  fremdWiderrufen = ((await sqlPool`
    UPDATE fiaon_kalender_abo SET widerrufen_am = NOW(), widerrufen_von = ${`${STEMPEL} (vorübergehend)`}
     WHERE agent_id = ANY(${PRUEF_AGENTEN}) AND widerrufen_am IS NULL
     RETURNING id`) as any[]).map((r) => Number(r.id));
  if (fremdWiderrufen.length) console.log(`  (${fremdWiderrufen.length} fremde Abo-Zeilen für den Lauf widerrufen — sie werden am Ende wiederhergestellt)`);
  // ═══ 6 ═══
  abschnitt("B6. aboHolen ist idempotent");
  const a1 = await kal.aboHolen(A, "eigene", STEMPEL);
  const a2 = await kal.aboHolen(A, "eigene", STEMPEL);
  const [g1, g2] = await Promise.all([kal.aboHolen(B, "eigene", STEMPEL), kal.aboHolen(B, "eigene", STEMPEL)]);
  const zeilenA = (await sqlPool`SELECT count(*)::int AS n FROM fiaon_kalender_abo WHERE agent_id = ${A} AND widerrufen_am IS NULL`) as any[];
  ok("B6 zweimal → dieselbe Zeile, derselbe Token", !!a1 && !!a2 && a1.id === a2.id && kal.aboToken(a1) === kal.aboToken(a2));
  ok("B6 gleichzeitig (Doppelklick) → eine Zeile", !!g1 && !!g2 && g1.id === g2.id);
  ok("B6 genau eine aktive Zeile", zeilenA[0].n === 1, zeilenA);
  ok("B6 Token steht nirgends im Klartext", !!a1 && !JSON.stringify((await sqlPool`SELECT * FROM fiaon_kalender_abo WHERE id = ${a1.id}`) as any).includes(kal.aboToken(a1)));
  ok("B6 aboPruefen(Token) → dieselbe Zeile", !!a1 && (await kal.aboPruefen(kal.aboToken(a1)))?.id === a1.id);

  // ═══ 7 ═══
  abschnitt("B7. Feed A: nur A, nur das Fenster, jede UID einmal");
  const P1 = await person("Anna", "anna.pruef263@example.invalid"), P2 = await person("Bernd"), P3 = await person("Carla"), P4 = await person("Dora"), P5 = await person("Emil");
  // Was schon VOR dem Lauf bei A im Fenster lag, gehört dazu — der Prüfstand verlangt keine leere DB.
  const vorA = vevents((await kal.aboFeed(a1!)).ics).map(uidVon);
  const tA1 = await termin({ personId: P1, agentId: A, beginn: await freierBeginn(A, 2, 8), herkunft: "mara_whatsapp" });
  const tA2 = await termin({ personId: P2, agentId: A, beginn: tag(-3, 9), status: "erledigt" });
  const tA3 = await termin({ personId: P3, agentId: A, beginn: tag(-5, 10), status: "verpasst" });
  const tAabg = await termin({ personId: P4, agentId: A, beginn: tag(3, 11), status: "abgesagt", abgesagt: true });
  const tAalt = await termin({ personId: P4, agentId: A, beginn: tag(-40, 12), status: "erledigt" });
  const tAweit = await termin({ personId: P4, agentId: A, beginn: await freierBeginn(A, 75, 12) });
  const tB1 = await termin({ personId: P5, agentId: B, beginn: await freierBeginn(B, 2, 13) });
  const tI1 = await termin({ personId: P5, agentId: INHABER, beginn: await freierBeginn(INHABER, 4, 9), quelle: "gruender" });
  tInhaber = tI1;
  const tX1 = await termin({ personId: P5, agentId: FREMDES_TESTKONTO, beginn: await freierBeginn(FREMDES_TESTKONTO, 4, 10) });
  const uid = (t: { id: number }) => `termin-${t.id}@fiaon.com`;
  let feedA = (await kal.aboFeed(a1!)).ics;
  const erlaubtA = new Set([...vorA, uid(tA1), uid(tA2), uid(tA3)]);
  const fA = feedNur(feedA, erlaubtA);
  ok("B7 Feed A enthält genau A's gebucht/erledigt/verpasst im Fenster (plus was vorher schon bei A lag)", fA.ok && vevents(feedA).length === erlaubtA.size, `${fA.grund} · ${vevents(feedA).map(uidVon)}`);
  ok("B7 nicht: B, abgesagt, −40 Tage, +75 Tage", ![tB1, tAabg, tAalt, tAweit].some((t) => feedA.includes(uid(t))));
  ok("B7 Datei ohne Verstöße", dateiVerstoesse(feedA).length === 0, dateiVerstoesse(feedA));
  ok("B7 keine METHOD-Zeile im Abo", !/\r\nMETHOD:/.test(feedA));
  const starts = vevents(feedA).map((e) => feld(e, "DTSTART") ?? "");
  ok("B7 Reihenfolge nach Beginn (aufsteigend)", starts.every((x, i) => i === 0 || starts[i - 1] <= x), starts);
  const eA1 = vevents(feedA).find((e) => uidVon(e) === uid(tA1)) ?? "";
  ok("B7 Titel „Rückruf: Anna Kunde1 (Mara)“, Alarm 10 Min., Akte-Link", /SUMMARY:Rückruf: Anna Kunde1 \(Mara\)/.test(eA1) && /TRIGGER:-PT10M/.test(eA1) && eA1.includes(`URL:https://www.fiaon.com/agent/kunden?person=${P1}`), eA1);
  ok("B7 Vergangenes: „Erledigt – …“ / „Nicht zustande gekommen – …“", feedA.includes("SUMMARY:Erledigt – Rückruf: Bernd Kunde2") && feedA.includes("SUMMARY:Nicht zustande gekommen – Rückruf: Carla Kunde3"));
  ok("B7 keine Telefonnummer, keine Notiz im Feed", !/\+49 151|26300000/.test(entfalten(feedA)));
  const standA2 = ((await sqlPool`SELECT GREATEST(created_at, updated_at, COALESCE(kal_geaendert_am, created_at)) AS s FROM fiaon_termine WHERE id = ${tA2.id}`) as any[])[0]?.s;
  ok("B7 DTSTAMP = Zeit der Zeile (nicht „jetzt“)", feld(vevents(feedA).find((e) => uidVon(e) === uid(tA2)) ?? "", "DTSTAMP") === ics.icsZeit(new Date(standA2)), standA2);

  // ═══ 8 ═══
  abschnitt("B8. „Nur der 1 neue Termin“");
  const f0 = await kal.aboFeed(a1!);
  await new Promise((r) => setTimeout(r, 1100)); // eine volle Sekunde später: Ein DTSTAMP „jetzt" fiele hier auf
  const f0b = await kal.aboFeed(a1!);
  ok("B8 ohne Änderung (1 s später): gleiche Datei, gleicher ETag", f0.ics === f0b.ics && f0.etag === f0b.etag);
  const tA4 = await termin({ personId: P2, agentId: A, beginn: await freierBeginn(A, 6, 14) });
  const f1 = await kal.aboFeed(a1!);
  const n8 = nurEinNeuer(f0.ics, f1.ics);
  ok("B8 genau ein VEVENT mehr, alle anderen Byte für Byte gleich", n8.ok && n8.grund.includes(String(tA4.id)), n8.grund);
  ok("B8 ETag neu", f1.etag !== f0.etag);

  // ═══ 9 ═══
  abschnitt("B9. Verschieben → SEQUENCE +1, UID gleich");
  const vorSeq = Number(feld(vevents(f1.ics).find((e) => uidVon(e) === uid(tA1)) ?? "", "SEQUENCE"));
  const neuBeginn = await freierBeginn(A, 2, 15);
  await sqlPool`UPDATE fiaon_termine SET beginn = ${neuBeginn}, erinnert_am = NULL WHERE id = ${tA1.id}`; // wie /agent/termine/:id/verschieben
  const f2 = await kal.aboFeed(a1!);
  const e2 = vevents(f2.ics).find((e) => uidVon(e) === uid(tA1)) ?? "";
  const seq9 = (vor: number, e: string) => Number(feld(e, "SEQUENCE")) === vor + 1 && feld(e, "DTSTART") === ics.icsZeit(neuBeginn);
  ok("B9 SEQUENCE +1, DTSTART neu, UID gleich", seq9(vorSeq, e2), { vorSeq, nach: feld(e2, "SEQUENCE"), dt: feld(e2, "DTSTART") });

  // ═══ 10 ═══
  abschnitt("B10. Absagen → fehlt im Feed; Einzeldatei = CANCEL");
  const einzelVor = await kal.einzelIcs(`${tA4.id}-${kal.einzelSignatur(tA4.id, A)}.ics`);
  ok("B10 Einzeldatei vor der Absage: ohne METHOD (RFC 5546), eine VEVENT, gültig", !!einzelVor && !/\r\nMETHOD:/.test(einzelVor.ics) && vevents(einzelVor.ics).length === 1 && dateiVerstoesse(einzelVor.ics).length === 0);
  const seqVor = Number(feld(vevents(einzelVor?.ics ?? "")[0] ?? "", "SEQUENCE"));
  await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW(), abgesagt_von = 'agent' WHERE id = ${tA4.id}`;
  const f3 = await kal.aboFeed(a1!);
  ok("B10 abgesagter Termin fehlt im Feed", !f3.ics.includes(uid(tA4)));
  const einzelNach = await kal.einzelIcs(`${tA4.id}-${kal.einzelSignatur(tA4.id, A)}`);
  const eN = vevents(einzelNach?.ics ?? "")[0] ?? "";
  ok("B10 Einzeldatei: METHOD:CANCEL, STATUS:CANCELLED, SEQUENCE höher, gleiche UID, Veranstalter", !!einzelNach && einzelNach.abgesagt && /METHOD:CANCEL/.test(einzelNach.ics)
    && feld(eN, "STATUS") === "CANCELLED" && Number(feld(eN, "SEQUENCE")) > seqVor && uidVon(eN) === uid(tA4) && /ORGANIZER;CN=FIAON:mailto:/.test(eN), eN);
  const absage1 = await kal.einzelIcs(`${tA2.id}-${kal.einzelSignatur(tA2.id, A)}.ics`, { absage: true });
  ok("B10 ?absage=1 an einem nicht abgesagten Termin → CANCEL", !!absage1 && /METHOD:CANCEL/.test(absage1.ics));

  // ═══ 11 ═══
  abschnitt("B11. Übergabe A → B");
  const sigA = kal.einzelSignatur(tA3.id, A);
  await sqlPool`UPDATE fiaon_termine SET agent_id = ${B} WHERE id = ${tA3.id}`;
  const fA4 = await kal.aboFeed(a1!);
  const fB = await kal.aboFeed(g1!);
  ok("B11 fehlt bei A, steht bei B mit gleicher UID", !fA4.ics.includes(uid(tA3)) && fB.ics.includes(uid(tA3)) && fB.ics.includes(uid(tB1)));
  ok("B11 Einzel-Link mit A-Signatur → unbekannt", (await kal.einzelIcs(`${tA3.id}-${sigA}.ics`)) === null);
  ok("B11 mit B-Signatur → gültig", !!(await kal.einzelIcs(`${tA3.id}-${kal.einzelSignatur(tA3.id, B)}.ics`)));
  ok("B11 falsche Signatur / Form → unbekannt", (await kal.einzelIcs(`${tA1.id}-${"0".repeat(32)}.ics`)) === null && (await kal.einzelIcs("abc")) === null);

  // ═══ 12 ═══
  abschnitt("B12. Erneuern, Beenden, Team-Abo");
  const altTok = kal.aboToken(a1!);
  const a3 = await kal.aboErneuern(A, "eigene", STEMPEL);
  ok("B12 Erneuern: alter Token unbekannt, neuer gültig", (await kal.aboPruefen(altTok)) === null && !!a3 && (await kal.aboPruefen(kal.aboToken(a3)))?.id === a3.id && a3.id !== a1!.id);
  ok("B12 alte Zeile bleibt (widerrufen, kein Löschen)", ((await sqlPool`SELECT widerrufen_am FROM fiaon_kalender_abo WHERE id = ${a1!.id}`) as any[])[0]?.widerrufen_am != null);
  ok("B12 Beenden → Token unbekannt", (await kal.aboBeenden(A, "eigene", STEMPEL)) && (await kal.aboPruefen(kal.aboToken(a3!))) === null);
  const aNeu = await kal.aboHolen(A, "eigene", STEMPEL);
  const team = await kal.aboHolen(INHABER, "team", STEMPEL);
  const fT = (await kal.aboFeed(team!)).ics;
  ok("B12 Team-Feed: A und B, NICHT der Inhaber selbst (der steht in „Meine Termine“), nicht das fremde Testkonto 927",
    fT.includes(uid(tA1)) && fT.includes(uid(tB1)) && !fT.includes(uid(tI1)) && !fT.includes(uid(tX1)), vevents(fT).map(uidVon));
  ok("B12 Team-Titel mit Mitarbeiter vorn („Nikita · Rückruf: …“), Name „FIAON · Termine des Teams“",
    /SUMMARY:Nikita · Rückruf: Anna Kunde1 \(Mara\)/.test(entfalten(fT)) && /X-WR-CALNAME:FIAON · Termine des Teams\r\n/.test(fT));
  const inhEigene = await kal.aboHolen(INHABER, "eigene", STEMPEL);
  const fI = (await kal.aboFeed(inhEigene!)).ics;
  ok("B12 „Meine Termine“ des Inhabers: seine, keine fremden", fI.includes(uid(tI1)) && ![tA1, tB1, tX1].some((t) => fI.includes(uid(t))), vevents(fI).map(uidVon));
  ok("B12 „Meine“ + „Team“ teilen keine UID — beide abonniert, steht jeder Termin genau einmal", gemeinsameUids(fI, fT).length === 0, gemeinsameUids(fI, fT));
  await sqlPool`UPDATE fiaon_kalender_abo SET zuletzt_abgerufen_am = NOW() WHERE id = ${team!.id}`;
  const nurTeam = await kal.aboAktiv(INHABER);
  await sqlPool`UPDATE fiaon_kalender_abo SET zuletzt_abgerufen_am = NOW() WHERE id = ${inhEigene!.id}`;
  const mitEigene = await kal.aboAktiv(INHABER);
  ok("B12 aboAktiv zählt nur „eigene“ (das Team-Abo trägt die eigenen Termine nicht)", !nurTeam && mitEigene, { nurTeam, mitEigene });
  const quelleAgent = (await import("node:fs")).readFileSync("server/routes/fiaon-kalender.ts", "utf8");
  ok("B12 die Mitarbeiter-Route kennt nur „eigene“ (kein „team“ im Agent-Router)", !/aboHolen\([^)]*"team"/.test(quelleAgent) && /aboHolen\(agent\.id, "eigene"/.test(quelleAgent));

  // ═══ 13 ═══
  abschnitt("B13. Mails an den Mitarbeiter");
  BREVO.length = 0;
  const tA5 = await termin({ personId: P1, agentId: A, beginn: await freierBeginn(A, 8, 9) });
  const m1 = await meldung.buchungMelden(tA5.id, tA5.beginn, "agent_manuell");
  const mail1 = BREVO.at(-1);
  const hrefsVon = (html: string) => Array.from(html.matchAll(/<a href="([^"]+)"/g)).map((m) => m[1].replace(/&amp;/g, "&"));
  const hrefs = hrefsVon(mail1?.html ?? "");
  const einzelUrl = kal.einzelLink(tA5.id, A);
  const googleUrl = hrefs.find((h) => h.startsWith("https://calendar.google.com/calendar/render?"));
  const aboSeite = kal.aboLinks(aNeu!).seite;
  ok("B13 Mail ging raus", m1.gemeldet && !!mail1, m1);
  ok("B13 ohne Abo — HTML: drei Knöpfe (Apple/Outlook, Google, Alle meine Termine)", hrefs.includes(einzelUrl) && !!googleUrl && hrefs.includes(aboSeite)
    && /In Apple-\/Outlook-Kalender/.test(mail1?.html ?? "") && /In Google Kalender/.test(mail1?.html ?? "") && /Alle meine Termine automatisch in den Kalender/.test(mail1?.html ?? ""), hrefs);
  ok("B13 Textteil: drei Adressen", [einzelUrl, aboSeite].every((u) => mail1?.text.includes(u)) && /In Google Kalender: https:\/\/calendar\.google\.com/.test(mail1?.text ?? ""), mail1?.text.slice(-900));
  ok("B13 Google-Link ohne Kundennamen, mit Art", !!googleUrl && !decodeURIComponent(googleUrl).includes("Anna") && !decodeURIComponent(googleUrl).includes("Kunde1") && new URL(googleUrl).searchParams.get("text") === `FIAON · Rückruf · Kunde #${P1}`, googleUrl);
  ok("B13 ohne aktives Abo kein „Abo ist aktiv“-Satz; Fuß warnt vor doppelt, kein „Einzelknopf“", !(mail1?.html ?? "").includes("Kalender-Abo ist aktiv")
    && /sonst steht er doppelt/.test(mail1?.text ?? "") && !/Einzelknopf/.test(`${mail1?.text}${mail1?.html}`));
  ok("B13 Satz über den Knöpfen meint das Portal („FIAON-Calendar (Portal)“), nicht „deinen Kalender“",
    /FIAON-Calendar \(Portal\) und meldet sich dort 30 Minuten vorher/.test(mail1?.text ?? "") && !/steht in deinem Kalender und meldet/.test(mail1?.text ?? ""));
  const felderOhne = await kal.mitarbeiterKalenderFelderFuer({ id: tA5.id, agent_id: A, person_id: P1, quelle: "agent_manuell", beginn: tA5.beginn, dauer: 20 });
  await sqlPool`UPDATE fiaon_kalender_abo SET zuletzt_abgerufen_am = NOW(), letzter_client = 'apple' WHERE id = ${aNeu!.id}`;
  await meldung.buchungMelden(tA5.id, tA5.beginn, "agent_manuell");
  const mail2 = BREVO.at(-1);
  const hrefs2 = hrefsVon(mail2?.html ?? "");
  ok("B13 mit laufendem Abo: KEINE Einzelknöpfe (ein Klick legte den Termin ein zweites Mal an), der Satz steht, leise „Mein Kalender-Abo ansehen“",
    (mail2?.html ?? "").includes(kText.KALENDER_TEXT.mailAktiv) && (mail2?.text ?? "").includes(kText.KALENDER_TEXT.mailAktiv)
    && !hrefs2.includes(einzelUrl) && !hrefs2.some((h) => h.startsWith("https://calendar.google.com/calendar/render?")) && !(mail2?.text ?? "").includes(einzelUrl)
    && /Mein Kalender-Abo ansehen/.test(mail2?.html ?? "") && hrefs2.includes(aboSeite), hrefs2);
  const felderAktiv = await kal.mitarbeiterKalenderFelderFuer({ id: tA5.id, agent_id: A, person_id: P1, quelle: "agent_manuell", beginn: tA5.beginn, dauer: 20 });
  ok("B13 Rückruf-Erinnerung/Übergabe: Kalender-Felder nur ohne laufendes Abo", Object.keys(felderOhne).length === 2 && Object.keys(felderAktiv).length === 0, { felderOhne, felderAktiv });
  await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW(), abgesagt_von = 'kunde' WHERE id = ${tA5.id}`;
  await meldung.absageMelden(tA5.id, tA5.beginn, "agent_manuell", "kunde");
  const mailAbs = BREVO.at(-1);
  ok("B13 Absage-Mail (Abo läuft): „Aus dem Kalender entfernen“ leise auf den Einzel-Link, „nur falls zusätzlich eingetragen“, Google von Hand",
    !!mailAbs && /ABGESAGT/.test(mailAbs.betreff) && mailAbs.html.includes(`href="${einzelUrl}"`) && /Aus dem Kalender entfernen/.test(mailAbs.html)
    && /zusätzlich selbst eingetragen/.test(mailAbs.html) && /von Hand/.test(mailAbs.text), mailAbs?.betreff);
  // Ohne Abo-Tabelle (vor Migration 085): Die Mail geht wie vorher raus, mit den Einzelknöpfen.
  const tA6 = await termin({ personId: P1, agentId: A, beginn: await freierBeginn(A, 9, 9) });
  const vorher = BREVO.length;
  let ohneTabelle: { gemeldet: boolean } | null = null;
  await zurueckrollen(async (tx) => {
    await tx`ALTER TABLE fiaon_kalender_abo RENAME TO fiaon_kalender_abo_weg263`;
    ohneTabelle = await meldung.buchungMelden(tA6.id, tA6.beginn, "agent_manuell", tx as any);
  });
  const mailOhne = BREVO.at(-1);
  ok("B13 ohne Abo-Tabelle: Mail geht raus, Einzelknöpfe ja, Abo-Knopf nein", !!ohneTabelle && (ohneTabelle as any).gemeldet && BREVO.length === vorher + 1
    && !!mailOhne && mailOhne.html.includes("In Apple-/Outlook-Kalender") && !mailOhne.html.includes("Alle meine Termine"),
    { betreff: mailOhne?.betreff, gemeldet: (ohneTabelle as any)?.gemeldet, anzahl: BREVO.length - vorher, text: mailOhne?.text.slice(-600) });
  ok("B13 Tabelle nach dem Zurückrollen wieder da", await kal.aboTabelleDa());

  // ═══ 14 ═══
  abschnitt("B14. Trigger: nur die Notiz geändert → SEQUENCE bleibt");
  const seqAlt = Number(((await sqlPool`SELECT kal_sequenz FROM fiaon_termine WHERE id = ${tA1.id}`) as any[])[0].kal_sequenz);
  await sqlPool`UPDATE fiaon_termine SET notiz = 'nur eine Notiz', updated_at = updated_at WHERE id = ${tA1.id}`;
  const seqNeu = Number(((await sqlPool`SELECT kal_sequenz FROM fiaon_termine WHERE id = ${tA1.id}`) as any[])[0].kal_sequenz);
  ok("B14 kal_sequenz unverändert", seqAlt === seqNeu, { seqAlt, seqNeu });

  // ═══ 15 ═══
  abschnitt("B15. Der Kunde: Datei, Absage = CANCEL, Zeile in Bestätigung/Erinnerung/Absage, Global");
  const tK = await termin({ personId: P2, agentId: A, beginn: await freierBeginn(A, 10, 9) });
  const k1 = await kal.kundenIcs(`${tK.storno}.ics`);
  ok("B15 Kundendatei 200, UID kunde-termin-<id>, ohne Namen/Telefon, Storno-Link in Sie-Form (?anrede=sie)", k1.status === 200 && !!k1.ics && k1.ics.includes(`UID:kunde-termin-${tK.id}@fiaon.com`)
    && !/Bernd|Kunde2|\+49/.test(entfalten(k1.ics!)) && entfalten(k1.ics!).includes(`/termin/absagen/${tK.storno}?anrede=sie`) && dateiVerstoesse(k1.ics!).length === 0, k1.ics?.slice(0, 400));
  ok("B15 unbekannter Token → 404", (await kal.kundenIcs("0".repeat(48))).status === 404 && (await kal.kundenIcs("../../etc")).status === 404);
  const seqK = Number(feld(vevents(k1.ics ?? "")[0] ?? "", "SEQUENCE"));
  await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW() WHERE id = ${tK.id}`;
  kundeAbgesagt = tK.storno;
  const k2 = await kal.kundenIcs(tK.storno);
  const eK = vevents(k2.ics ?? "")[0] ?? "";
  ok("B15 abgesagt → 200 mit METHOD:CANCEL, gleicher UID, STATUS:CANCELLED, höherer SEQUENCE, Veranstalter (vorher 410)",
    k2.status === 200 && k2.abgesagt === true && /\r\nMETHOD:CANCEL\r\n/.test(k2.ics ?? "") && uidVon(eK) === `kunde-termin-${tK.id}@fiaon.com`
    && feld(eK, "STATUS") === "CANCELLED" && Number(feld(eK, "SEQUENCE")) > seqK && /ORGANIZER;CN=FIAON:mailto:/.test(eK) && dateiVerstoesse(k2.ics ?? "").length === 0, eK);
  const tK2 = await termin({ personId: P2, agentId: A, beginn: await freierBeginn(A, 11, 9) });
  const altSatz = await kal.kalenderAltSatz(P2, tK2.id);
  const altLeer = await kal.kalenderAltSatz(P3, -1);
  ok("B15 neuer Termin nach einer Absage/Verschiebung: Satz nennt den alten (Datum), „löschen Sie ihn dort bitte“; ohne → leer",
    altSatz.includes(berlinDatumText(tK.beginn)) && /löschen Sie ihn dort bitte/.test(altSatz) && altLeer === "", { altSatz, altLeer });
  const { mailRendern } = await import("../server/mail/motor");
  const { mailHtml } = await import("../server/mail/geruest");
  const { TERMIN_VORLAGEN } = await import("../server/mail/vorlagen/termin");
  const basis = { email: "k@example.invalid", vorname: "Kim", nachname: "Probe", agent_vorname: "Nikita", termin_datum: "25.10.2026", termin_uhrzeit: "10:00",
    termin_art: "Rückruf", storno_link: "https://www.fiaon.com/termin/absagen/abc", hinweis_anruf: "Wir rufen an.", hinweis_absage: "Absage." };
  const felder = kal.kundenKalenderFelder({ stornoToken: "ab".repeat(24), beginn: "2026-10-25T09:00:00Z", dauerMin: 20 });
  for (const ev of ["termin_bestaetigung", "termin_erinnerung"]) {
    const mit = mailRendern(ev, { ...basis, ...felder })!;
    const ohne = mailRendern(ev, basis)!;
    ok(`B15 ${ev}: Zeile „In Ihren Kalender: Apple / Outlook · Google Kalender“ (HTML + Text)`, mit.html.includes("In Ihren Kalender:") && mit.html.includes(`href="${felder.kalender_url}"`)
      && mit.text.includes(`In Ihren Kalender (Apple / Outlook): ${felder.kalender_url}`) && mit.text.includes("In Google Kalender: https://calendar.google.com"), mit.text.slice(-700));
    ok(`B15 ${ev}: ohne Kalenderfelder keine Zeile und keine Lücke`, !ohne.html.includes("In Ihren Kalender:") && !ohne.fehlend.includes("kalender_url") && !ohne.fehlend.includes("google_kalender_url"), ohne.fehlend);
    const { kalender: _weg, ...ohneKal } = (TERMIN_VORLAGEN as any)[ev];
    ok(`B15 ${ev}: ohne Kalender-Zeile Byte für Byte wie ohne das Feld`, mailHtml(ohneKal) === mailHtml({ ...ohneKal, kalender: undefined }));
  }
  {
    const absBasis = { email: "k@example.invalid", vorname: "Kim", nachname: "Probe", termin_datum: "25.10.2026", termin_uhrzeit: "10:00", termin_art: "Rückruf", neu_buchen_link: "https://www.fiaon.com/termin/abc" };
    const absMit = mailRendern("termin_absage", { ...absBasis, kalender_url: felder.kalender_url })!;
    const absOhne = mailRendern("termin_absage", absBasis)!;
    ok("B15 termin_absage: „Aus Ihrem Kalender entfernen (Apple / Outlook)“ · „Bei Google bitte von Hand löschen.“ (HTML + Text)",
      absMit.html.includes(`href="${felder.kalender_url}"`) && absMit.html.includes("Aus Ihrem Kalender entfernen (Apple / Outlook)") && absMit.html.includes("Stand der Termin in Ihrem Kalender?")
      && absMit.text.includes(`Aus Ihrem Kalender entfernen (Apple / Outlook): ${felder.kalender_url}`) && absMit.text.includes("Bei Google bitte von Hand löschen."), absMit.text.slice(-500));
    ok("B15 termin_absage ohne kalender_url: keine Zeile, keine Lücke", !absOhne.html.includes("Aus Ihrem Kalender entfernen") && !absOhne.fehlend.includes("kalender_url"), absOhne.fehlend);
  }
  {
    const { globalKalenderDatei } = await import("../server/lib/fiaon-global-zeiten");
    const gt = await import("../server/lib/fiaon-global-termin");
    const gEn = globalKalenderDatei({ terminId: 4711, beginn: "2026-10-25T09:00:00Z", ansprechpartner: "Nikita", sprache: "en" });
    const gAbg = globalKalenderDatei({ terminId: 4711, beginn: "2026-10-25T09:00:00Z", ansprechpartner: "Nikita", sequenz: 2, abgesagt: true });
    const gLink = new URL(gt.globalGoogleFeld("2026-10-25T09:00:00Z", "en").google_kalender_url);
    const pEn = gt.globalTerminPayload({ email: "x@example.invalid", name: "N", firma: "F", telefon: "+1 555", paketText: null, ansprechpartner: "Nikita",
      datumText: "25.10.2026", uhrzeit: "10:00", stornoToken: "ab".repeat(24), sprache: "en", beginn: "2026-10-25T09:00:00Z", paket: null });
    const pDe = gt.globalTerminPayload({ email: "x@example.invalid", name: "N", firma: "F", telefon: "+49 30", paketText: null, ansprechpartner: "Nikita",
      datumText: "25.10.2026", uhrzeit: "10:00", stornoToken: "ab".repeat(24), sprache: "de", beginn: "2026-10-25T09:00:00Z", paket: null });
    ok("B15 Global englisch: Datei „first call“, Google-Titel und -Text englisch, Datei-Link ?sprache=en; deutsch unverändert",
      entfalten(gEn).includes("SUMMARY:FIAON Global – first call") && gLink.searchParams.get("text") === "FIAON Global – first call" && /will call you/.test(gLink.searchParams.get("details") ?? "")
      && pEn.kalender_url.endsWith("?sprache=en") && new URL(pEn.google_kalender_url).searchParams.get("text") === "FIAON Global – first call"
      && !pDe.kalender_url.includes("sprache") && new URL(pDe.google_kalender_url).searchParams.get("text") === "FIAON Global – Erstgespräch", { en: pEn.kalender_url, de: pDe.kalender_url });
    ok("B15 Global abgesagt: METHOD:CANCEL, UID global-termin-4711, SEQUENCE 3, Veranstalter, kein Wecker",
      /\r\nMETHOD:CANCEL\r\n/.test(gAbg) && entfalten(gAbg).includes("UID:global-termin-4711@fiaon.com") && /\r\nSEQUENCE:3\r\n/.test(gAbg) && /ORGANIZER;CN=FIAON/.test(gAbg) && !/VALARM/.test(gAbg) && dateiVerstoesse(gAbg).length === 0, gAbg);
    const tG = await termin({ personId: P5, agentId: B, beginn: await freierBeginn(B, 5, 9), quelle: "global" });
    const gk1 = await kal.kundenIcs(`${tG.storno}.ics`);
    const gkEn = await gt.globalKalenderZuToken(tG.storno, "en");
    await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW() WHERE id = ${tG.id}`;
    const gk2 = await kal.kundenIcs(tG.storno);
    ok("B15 Global über /kalender/k: Datei, englisch über ?sprache=en, abgesagt → CANCEL mit derselben UID",
      gk1.status === 200 && entfalten(gk1.ics ?? "").includes(`UID:global-termin-${tG.id}@fiaon.com`) && !!gkEn && entfalten(gkEn.datei).includes("first call")
      && gk2.status === 200 && gk2.abgesagt === true && /\r\nMETHOD:CANCEL\r\n/.test(gk2.ics ?? "") && entfalten(gk2.ics ?? "").includes(`UID:global-termin-${tG.id}@fiaon.com`), { gk1: gk1.status, gk2: gk2.status });
  }

  // ═══ 16 ═══
  abschnitt("B16. Konto zu → Abo zu (Sperre, Deaktivierung, Stufe) — alles in zurückgerollten Transaktionen");
  const tS = await termin({ personId: P1, agentId: A, beginn: await freierBeginn(A, 13, 9) });
  const sha = (x: string) => createHash("sha256").update(x).digest("hex");
  await zurueckrollen(async (tx) => {
    const z = await kal.aboHolen(A, "eigene", STEMPEL, tx);
    const tok = kal.aboToken(z!);
    const vor = await kal.aboPruefen(tok, tx);
    const einzelDatei = `${tS.id}-${kal.einzelSignatur(tS.id, A)}.ics`;
    const einzelVorS = await kal.einzelIcs(einzelDatei, {}, tx);
    await tx`UPDATE fiaon_agents SET zugang_gesperrt_am = NOW() WHERE id = ${A}`;
    const [w] = (await tx`SELECT widerrufen_am, widerrufen_von FROM fiaon_kalender_abo WHERE id = ${z!.id}`) as any[];
    const nach = await kal.aboPruefen(tok, tx);
    const neu = await kal.aboHolen(A, "eigene", STEMPEL, tx);
    const einzelNachS = await kal.einzelIcs(einzelDatei, {}, tx);
    ok("B16 Sperre: Trigger widerruft („System (Zugang gesperrt)“), Abruf → unbekannt, kein neues Abo, Einzel-Link tot",
      !!vor && !!einzelVorS && w?.widerrufen_am != null && /gesperrt/.test(String(w?.widerrufen_von)) && nach === null && neu === null && einzelNachS === null,
      { vor: !!vor, einzelVor: !!einzelVorS, w, nach: !!nach, neu: !!neu, einzelNach: !!einzelNachS });
    await tx`UPDATE fiaon_agents SET zugang_gesperrt_am = NULL WHERE id = ${A}`;
    ok("B16 Entsperren belebt den alten Link nicht", (await kal.aboPruefen(tok, tx)) === null);
  });
  await zurueckrollen(async (tx) => {
    // Ohne Trigger (anderer Weg, vor der Migration): Die Prüfung beim Abruf hält allein dicht.
    await tx`UPDATE fiaon_agents SET zugang_gesperrt_am = NOW() WHERE id = ${A}`;
    const [n] = (await tx`SELECT nextval(pg_get_serial_sequence('fiaon_kalender_abo', 'id')) AS id`) as any[];
    const id = Number(n.id), zufall = "c".repeat(32);
    await tx`INSERT INTO fiaon_kalender_abo (id, agent_id, umfang, zufall, token_hash, erstellt_von)
             VALUES (${id}, ${A}, 'eigene', ${zufall}, ${sha(kal.aboTokenAus(id, zufall))}, ${STEMPEL})`;
    ok("B16 Abruf prüft das Konto selbst: aktive Zeile, Konto gesperrt → unbekannt", (await kal.aboPruefen(kal.aboTokenAus(id, zufall), tx)) === null);
  });
  await zurueckrollen(async (tx) => {
    const z = await kal.aboHolen(A, "eigene", STEMPEL, tx);
    await tx`UPDATE fiaon_agents SET active = FALSE WHERE id = ${A}`;
    const [w] = (await tx`SELECT widerrufen_am, widerrufen_von FROM fiaon_kalender_abo WHERE id = ${z!.id}`) as any[];
    ok("B16 Deaktivierung: widerrufen („System (Konto deaktiviert)“), Abruf → unbekannt",
      w?.widerrufen_am != null && /deaktiviert/.test(String(w?.widerrufen_von)) && (await kal.aboPruefen(kal.aboToken(z!), tx)) === null, w);
  });
  await zurueckrollen(async (tx) => {
    const t = await kal.aboHolen(INHABER, "team", STEMPEL, tx);
    const e = await kal.aboHolen(INHABER, "eigene", STEMPEL, tx);
    await tx`UPDATE fiaon_agents SET admin_stufe = NULL WHERE id = ${INHABER}`;
    const tNach = await kal.aboPruefen(kal.aboToken(t!), tx);
    const eNach = await kal.aboPruefen(kal.aboToken(e!), tx);
    const tNeu = await kal.aboHolen(INHABER, "team", STEMPEL, tx);
    ok("B16 Stufe „inhaber“ entzogen: Team-Abo widerrufen, kein neues; „Meine Termine“ (aktives Konto) bleibt",
      !!t && tNach === null && tNeu === null && eNach?.id === e?.id, { t: !!t, tNach: !!tNach, tNeu: !!tNeu, eNach: eNach?.id, e: e?.id });
  });
  await zurueckrollen(async (tx) => {
    const t = await kal.aboHolen(INHABER, "team", STEMPEL, tx);
    const e = await kal.aboHolen(INHABER, "eigene", STEMPEL, tx);
    await tx`UPDATE fiaon_agents SET active = FALSE WHERE id = ${INHABER}`;
    ok("B16 deaktivierter Inhaber (kommt weiter ins Chefbüro und sieht dort alles): beide Abos bleiben",
      (await kal.aboPruefen(kal.aboToken(t!), tx))?.id === t!.id && (await kal.aboPruefen(kal.aboToken(e!), tx))?.id === e!.id);
  });
  const trg = (await sqlPool`SELECT tgname FROM pg_trigger WHERE tgrelid = 'fiaon_agents'::regclass AND tgname IN ('fiaon_agents_kalender_abo_zu', 'fiaon_agents_kalender_abo_weg')`) as any[];
  ok("B16 beide Trigger an fiaon_agents stehen (Migration 085)", trg.length === 2, trg);
} catch (e) {
  // Gegenprüfung 29.09.2026: Vorher verschluckte process.exit im finally jede Ausnahme hier — B7…B15 fehlten kommentarlos.
  ok("B lief durch", false, String((e as Error)?.stack ?? e).slice(0, 900));
} finally {
  // ═══ C ═════════════════════════════════════════════════════════════════════
  try {
    abschnitt("C. HTTP (echte Router, lokaler Express)");
    const express = (await import("express")).default;
    const cookieParser = (await import("cookie-parser")).default;
    const oeffentlich = await import("../server/routes/fiaon-kalender");
    const steuerpult = (await import("../server/routes/fiaon-mara-steuerpult")).default;
    const app = express();
    app.set("trust proxy", 1);
    app.use(cookieParser()); app.use(express.json());
    app.use("/api/fiaon", oeffentlich.agentRouter);
    app.use("/api/fiaon", steuerpult);
    app.use(oeffentlich.default);
    server = app.listen(0);
    const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const APPLE = "iOS/17.4 (21E219) dataaccessd/1.0";
    const hol = (pfad: string, init: RequestInit & { ua?: string; ip?: string } = {}) => echtFetch(`${basis}${pfad}`, {
      ...init, redirect: "manual",
      headers: { "user-agent": init.ua ?? APPLE, "x-forwarded-for": init.ip ?? "203.0.113.7", ...(init.headers as any || {}) },
    });
    oeffentlich.drosselVergessen();
    const aboC = await kal.aboHolen(A, "eigene", STEMPEL);
    /** Ein toter Link (unbekannt, widerrufen, gesperrt): 200, text/calendar, no-store, 0 Termine, „Link gilt nicht mehr". */
    const istLeer = async (r: Response) => {
      const t = await r.text();
      return r.status === 200 && /^text\/calendar/.test(r.headers.get("content-type") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? "")
        && vevents(t).length === 0 && /FIAON · Link gilt nicht mehr/.test(t);
    };
    const tok = kal.aboToken(aboC!);
    const r1 = await hol(`/kalender/${tok}.ics`);
    const text1 = await r1.text();
    const etag = r1.headers.get("etag") ?? "";
    ok("C15 GET .ics → 200 text/calendar, ETag, noindex, kein Referer", r1.status === 200 && /^text\/calendar/.test(r1.headers.get("content-type") ?? "") && !!etag
      && /noindex/.test(r1.headers.get("x-robots-tag") ?? "") && r1.headers.get("referrer-policy") === "no-referrer" && /BEGIN:VCALENDAR/.test(text1), { s: r1.status, ct: r1.headers.get("content-type") });
    const zeileC = ((await sqlPool`SELECT abrufe, letzter_client, zuletzt_abgerufen_am FROM fiaon_kalender_abo WHERE id = ${aboC!.id}`) as any[])[0];
    ok("C15 Abruf vermerkt: Apple, Zähler 1", zeileC?.letzter_client === "apple" && Number(zeileC?.abrufe) === 1 && !!zeileC?.zuletzt_abgerufen_am, zeileC);
    const rHead = await hol(`/kalender/${tok}.ics`, { method: "HEAD" });
    ok("C15 HEAD → 200 ohne Inhalt", rHead.status === 200 && (await rHead.text()) === "");
    const r304 = await hol(`/kalender/${tok}.ics`, { headers: { "if-none-match": etag } });
    ok("C15 If-None-Match → 304", r304.status === 304, r304.status);
    await hol(`/kalender/${tok}.ics`, { ua: "Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605" });
    const zeileB = ((await sqlPool`SELECT abrufe, letzter_client FROM fiaon_kalender_abo WHERE id = ${aboC!.id}`) as any[])[0];
    ok("C15 ein Browser zählt nicht als Abruf", zeileB?.letzter_client === "apple" && Number(zeileB?.abrufe) === 2, zeileB);
    ok("C15 kein Last-Modified (das Inhalts-ETag allein entscheidet über 304)", !r1.headers.get("last-modified"), r1.headers.get("last-modified"));
    const rIms = await hol(`/kalender/${tok}.ics`, { headers: { "if-modified-since": new Date(Date.now() + 3_600_000).toUTCString() } });
    ok("C15 nur If-Modified-Since (sogar „in der Zukunft“) → 200, nie 304", rIms.status === 200 && /BEGIN:VCALENDAR/.test(await rIms.text()), rIms.status);
    {
      // Gegenprüfung T1/T4: Absage des jüngsten Termins, dann ein Client, der NUR If-Modified-Since schickt.
      const tC = await termin({ personId: personen[0], agentId: A, beginn: await freierBeginn(A, 14, 9) });
      kal.zwischenspeicherVergessen();
      const rVor = await hol(`/kalender/${tok}.ics`);
      const vorText = await rVor.text();
      const ims = new Date().toUTCString();
      await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW() WHERE id = ${tC.id}`;
      kal.zwischenspeicherVergessen();
      const rNach = await hol(`/kalender/${tok}.ics`, { headers: { "if-modified-since": ims } });
      const nachText = await rNach.text();
      ok("C15 Absage, dann nur If-Modified-Since → 200 ohne den Termin (vorher 304, der Termin blieb stehen)",
        vorText.includes(`termin-${tC.id}@fiaon.com`) && rNach.status === 200 && !nachText.includes(`termin-${tC.id}@fiaon.com`), { vor: rVor.status, nach: rNach.status });
    }
    const rFalsch = await hol(`/kalender/${"A".repeat(43)}.ics`);
    const rFalschSeite = await hol(`/kalender/${"A".repeat(43)}`);
    const seiteFalsch = await rFalschSeite.text();
    ok("C15 unbekannter Token (gültige Form): Datei → leerer Kalender (200), Seite → 404", await istLeer(rFalsch) && rFalschSeite.status === 404 && /gilt nicht/.test(seiteFalsch));
    ok("C15 404-Seite nennt beide Wege (Portal und Chefbüro → Mara → Termine)", /Calendar → „In meinen Kalender“/.test(seiteFalsch) && /Chefbüro → Mara → Termine/.test(seiteFalsch), seiteFalsch.slice(-400));
    const rKaputt = await hol(`/kalender/${"A".repeat(10)}.ics`);
    ok("C15 falsch geformter Link → 404 (kein leerer Kalender)", rKaputt.status === 404, rKaputt.status);
    const rSeite = await hol(`/kalender/${tok}`);
    const seite = await rSeite.text();
    ok("C15 Seite 200, noindex, webcal:// und Google-cid, Zustand aktiv", rSeite.status === 200 && /noindex/.test(rSeite.headers.get("x-robots-tag") ?? "") && /<meta name="robots" content="noindex/.test(seite)
      && seite.includes(`webcal://www.fiaon.com/kalender/${tok}.ics`) && seite.includes("calendar.google.com/calendar/r?cid=webcal%3A%2F%2F") && /data-zustand="aktiv"/.test(seite), seite.slice(0, 300));
    const tE = await (async () => { const pid = personen[0]; const [t] = (await sqlPool`SELECT id FROM fiaon_termine WHERE person_id = ${pid} AND agent_id = ${A} AND status = 'gebucht' ORDER BY id LIMIT 1`) as any[]; return Number(t?.id); })();
    const rEinzel = await hol(`/kalender/t/${tE}-${kal.einzelSignatur(tE, A)}.ics`);
    ok("C15 Einzeltermin 200 text/calendar", rEinzel.status === 200 && /^text\/calendar/.test(rEinzel.headers.get("content-type") ?? "") && /UID:termin-/.test(await rEinzel.text()));
    const rEinzelFalsch = await hol(`/kalender/t/${tE}-${"f".repeat(32)}.ics`);
    ok("C15 Einzeltermin falsche Signatur → 404", rEinzelFalsch.status === 404);
    if (kundeAbgesagt) {
      const rK = await hol(`/kalender/k/${kundeAbgesagt}.ics`);
      const kText = await rK.text();
      ok("C15 Kundendatei eines abgesagten Termins → 200 METHOD:CANCEL (vorher 410)", rK.status === 200 && /^text\/calendar/.test(rK.headers.get("content-type") ?? "")
        && /\r\nMETHOD:CANCEL\r\n/.test(kText) && /fiaon-termin-absage\.ics/.test(rK.headers.get("content-disposition") ?? ""), rK.status);
    } else ok("C15 Kundendatei CANCEL (Fixture aus B15 fehlt)", false);
    oeffentlich.drosselVergessen();
    let letzter = 0;
    for (let i = 1; i <= oeffentlich.DROSSEL.jeToken + 1; i++) letzter = (await hol(`/kalender/${tok}.ics`, { ip: `198.51.100.${i}` })).status;
    ok("C15 21. Abruf in 10 Min. (gleicher Token) → 429", letzter === 429, letzter);
    oeffentlich.drosselVergessen();
    let fehl = 0;
    for (let i = 0; i <= oeffentlich.DROSSEL.fehlgriffeJeAdresse; i++) fehl = (await hol(`/kalender/${"B".repeat(42)}${i % 10}.ics`, { ip: "192.0.2.99" })).status;
    const nachFehl = await hol(`/kalender/${tok}.ics`, { ip: "192.0.2.99" });
    ok("C15 nach 20 Fehlgriffen (leere Kalender zählen mit): auch ein gültiger Token → 429 mit Retry-After", fehl === 429 && nachFehl.status === 429 && Number(nachFehl.headers.get("retry-after")) > 0, { fehl, nach: nachFehl.status });
    oeffentlich.drosselVergessen();

    // Mitarbeiter-Route (echter requireAgent, Cookie mit dem lokalen Geheimnis)
    const [ag] = (await sqlPool`SELECT session_epoch FROM fiaon_agents WHERE id = ${A}`) as any[];
    const exp = Date.now() + 30 * 60_000;
    const nutz = `${A}.${Number(ag.session_epoch ?? 0)}.${exp}`;
    const agentKeks = `fiaon_agent_token=${nutz}.${createHmac("sha256", process.env.SESSION_SECRET!).update(`agent2:${nutz}`).digest("hex").slice(0, 40)}`;
    const rA = await hol("/api/fiaon/agent/kalender-abo", { headers: { cookie: agentKeks } });
    const jA = await rA.json().catch(() => null) as any;
    ok("C Mitarbeiter: GET /agent/kalender-abo → eigenes Abo mit Links", rA.status === 200 && jA?.abo?.umfang === "eigene" && jA.abo.links.webcal.startsWith("webcal://") && jA.abo.links.google.includes("cid="), jA);
    ok("C Mitarbeiter: ohne Anmeldung → 401", (await hol("/api/fiaon/agent/kalender-abo")).status === 401);
    const rErn = await hol("/api/fiaon/agent/kalender-abo/erneuern", { method: "POST", headers: { cookie: agentKeks } });
    const jErn = await rErn.json().catch(() => null) as any;
    ok("C Mitarbeiter: erneuern → neuer Link; der alte liefert einen LEEREN Kalender (die App leert sich, statt eingefroren zu bleiben)",
      rErn.status === 200 && jErn?.abo?.links?.ics && jErn.abo.links.ics !== jA?.abo?.links?.ics && await istLeer(await hol(`/kalender/${tok}.ics`)), jErn);
    ok("C Mitarbeiter: kein Team-Weg (POST …/team/… → 404)", (await hol("/api/fiaon/agent/kalender-abo/team", { method: "POST", headers: { cookie: agentKeks } })).status === 404);

    // Chef-Route (Stufe inhaber)
    const cexp = Date.now() + 3_600_000;
    const csig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${INHABER}:inhaber:${cexp}`).digest("hex").slice(0, 40);
    const chefKeks = `fiaon_chef=${INHABER}.inhaber.${cexp}.${csig}`;
    const rC = await hol("/api/fiaon/chef/mara/kalender-abo", { headers: { cookie: chefKeks } });
    const jC = await rC.json().catch(() => null) as any;
    ok("C Chef: GET → eigene + team", rC.status === 200 && jC?.eigene?.umfang === "eigene" && jC?.team?.umfang === "team" && jC.eigene.links.ics !== jC.team.links.ics, jC);
    ok("C Chef: ohne Chef-Cookie → abgewiesen", [401, 403].includes((await hol("/api/fiaon/chef/mara/kalender-abo", { headers: { cookie: agentKeks } })).status));
    const teamTok = String(jC?.team?.links?.ics ?? "").split("/kalender/")[1]?.replace(/\.ics$/, "") ?? "";
    const rTeam = await hol(`/kalender/${teamTok}.ics`);
    const teamText = await rTeam.text();
    ok("C Chef: Team-Feed abrufbar (200), „FIAON · Termine des Teams“, ohne den Termin des Inhabers", rTeam.status === 200 && /FIAON · Termine des Teams/.test(teamText)
      && !!tInhaber && !teamText.includes(`termin-${tInhaber.id}@fiaon.com`));
    const rCe = await hol("/api/fiaon/chef/mara/kalender-abo/team/beenden", { method: "POST", headers: { cookie: chefKeks, "content-type": "application/json" }, body: "{}" });
    ok("C Chef: Team-Abo beenden → Feed leer (200, 0 Termine)", rCe.status === 200 && await istLeer(await hol(`/kalender/${teamTok}.ics`)));
  } catch (e) {
    ok("C lief durch", false, String((e as Error)?.stack ?? e).slice(0, 600));
  }

  // ═══ E (mit Datenbank) ═════════════════════════════════════════════════════
  try {
    abschnitt("E. Rot-Proben mit Datenbank");
    const aboE = await kal.aboHolen(A, "eigene", STEMPEL);
    const fE = (await kal.aboFeed(aboE!)).ics;
    const fremd = (await kal.aboFeed((await kal.aboHolen(B, "eigene", STEMPEL))!)).ics;
    const gemischt = fE.replace("END:VCALENDAR\r\n", `${vevents(fremd)[0]?.split("\n").join("\r\n")}\r\nEND:VCALENDAR\r\n`);
    const erlaubt = new Set(vevents(fE).map(uidVon));
    ok("E3 fremder Termin im Feed (Agentenfilter weg) → B7 wird rot", vevents(fremd).length > 0 && !feedNur(gemischt, erlaubt).ok);
    const jetztStempel = fE.replace(/DTSTAMP:\d{8}T\d{6}Z/g, `DTSTAMP:${ics.icsZeit(new Date(Date.now() + 1000))}`);
    const P = personen[1] ?? personen[0];
    const tNeu = await termin({ personId: P, agentId: A, beginn: await freierBeginn(A, 12, 9) });
    const nachE5 = await freierBeginn(A, 12, 11);
    const fE2 = (await kal.aboFeed(aboE!)).ics;
    ok("E4 DTSTAMP = jetzt → B8 wird rot", nurEinNeuer(fE, fE2).ok && !nurEinNeuer(fE, fE2.replace(/DTSTAMP:\d{8}T\d{6}Z/g, `DTSTAMP:${ics.icsZeit(new Date(Date.now() + 1000))}`)).ok && jetztStempel !== fE);
    let seqOhneTrigger: { vor: number; nach: number } | null = null;
    try {
      await sqlPool.begin(async (tx) => {
        await tx`ALTER TABLE fiaon_termine DISABLE TRIGGER fiaon_termine_kal_sequenz`;
        const [v] = (await tx`SELECT kal_sequenz FROM fiaon_termine WHERE id = ${tNeu.id}`) as any[];
        await tx`UPDATE fiaon_termine SET beginn = ${nachE5} WHERE id = ${tNeu.id}`;
        const [n] = (await tx`SELECT kal_sequenz FROM fiaon_termine WHERE id = ${tNeu.id}`) as any[];
        seqOhneTrigger = { vor: Number(v.kal_sequenz), nach: Number(n.kal_sequenz) };
        throw new Error("zurückrollen");
      });
    } catch (e) { if (String((e as Error).message) !== "zurückrollen") throw e; }
    ok("E5 Trigger aus → B9 wird rot (SEQUENCE bleibt stehen)", !!seqOhneTrigger && (seqOhneTrigger as any).nach === (seqOhneTrigger as any).vor, seqOhneTrigger);
    const trig = (await sqlPool`SELECT tgenabled FROM pg_trigger WHERE tgname = 'fiaon_termine_kal_sequenz'`) as any[];
    ok("E5 … und nach dem Zurückrollen ist er wieder an", trig[0]?.tgenabled === "O", trig);
  } catch (e) {
    ok("E lief durch", false, String((e as Error)?.stack ?? e).slice(0, 600));
  }

  // ═══ D ═════════════════════════════════════════════════════════════════════
  if (MIT_BROWSER) {
    try { await browserTeil(); } catch (e) { ok("D lief durch", false, String((e as Error)?.stack ?? e).slice(0, 600)); }
  }

  // Schluss: Jede Ausnahme hier wird ROT gezählt, aufgeräumt wird immer, und die Zahl steht immer da.
  try {
    ok("Kein fremder Netzaufruf", FREMD.length === 0, FREMD);
    if (server) await new Promise((r) => server!.close(r));
  } catch (e) {
    ok("Schluss lief durch", false, String((e as Error)?.stack ?? e).slice(0, 600));
  } finally {
    await aufraeumen().catch((e) => { ok("Aufräumen lief durch", false, String(e).slice(0, 300)); });
    await sqlPool.end({ timeout: 2 }).catch(() => {});
    console.log(`\n══ E-263 Kalender: ${gruen} grün, ${rot} rot${rot ? ` — ${fehler.join(" | ")}` : ""}`);
    process.exit(rot ? 1 : 0);
  }
}

// ═══ D: Browser — Knopf finden und drücken (Regel „Erledigt heißt bedienbar") ═══
async function browserTeil(): Promise<void> {
  abschnitt("D. Browser (laufender lokaler Server)");
  const basis = process.env.PRUEF_BASIS ?? "http://127.0.0.1:5263";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(basis)) { ok("D nur gegen einen lokalen Server", false, basis); return; }
  const aus = process.env.PRUEF_FOTOS ?? "/tmp";
  const { chromium } = await import(process.env.PRUEF_PLAYWRIGHT ?? "playwright");
  const browser = await chromium.launch();
  const [ag] = (await sqlPool`SELECT session_epoch FROM fiaon_agents WHERE id = ${A}`) as any[];
  const exp = Date.now() + 30 * 60_000;
  const nutz = `${A}.${Number(ag.session_epoch ?? 0)}.${exp}`;
  const agentTok = `${nutz}.${createHmac("sha256", process.env.SESSION_SECRET!).update(`agent2:${nutz}`).digest("hex").slice(0, 40)}`;
  const cexp = Date.now() + 3_600_000;
  const chefTok = `${INHABER}.inhaber.${cexp}.${createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${INHABER}:inhaber:${cexp}`).digest("hex").slice(0, 40)}`;
  const host = new URL(basis).hostname;
  const seitenfehler: string[] = [];
  // Die lokale Struktur-Kopie kennt keine Zustimmungen/Verträge — ohne sie hält das Onboarding-Tor jede
  // /agent-Route auf. Prüf-Zeilen NUR in der lokalen DB, erkennbar markiert, am Ende wieder entfernt.
  const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
  const MARKE_UA = "PRUEFSTAND E-263 (lokal)";
  const [vorlage] = (await sqlPool`SELECT version FROM fiaon_contract_templates WHERE status = 'active' ORDER BY version DESC LIMIT 1`) as any[];
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, user_agent) VALUES (${A}, ${d.key}, ${d.version}, ${MARKE_UA})`;
  }
  if (vorlage) {
    await sqlPool`INSERT INTO fiaon_agent_contracts (agent_id, template_version, variables_json, rendered_html, signature_name, signature_mode, doc_hash, user_agent, status)
                  VALUES (${A}, ${Number(vorlage.version)}, '{}', '<p>Prüfstand</p>', ${MARKE_UA}, 'pruefstand', 'pruefstand-e263', ${MARKE_UA}, 'signed')`;
  }
  const onboardingWeg = async () => {
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${A} AND user_agent = ${MARKE_UA}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${A} AND user_agent = ${MARKE_UA}`.catch(() => {});
  };
  try { await browserSchritte(); } finally { await onboardingWeg(); await browser.close(); }
  async function browserSchritte(): Promise<void> {
  const kontext = async (breite: number, hoehe: number, mobil = false) => {
    const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addCookies([
      { name: "fiaon_agent_token", value: agentTok, domain: host, path: "/", httpOnly: true, secure: false },
      { name: "fiaon_chef", value: chefTok, domain: host, path: "/", httpOnly: true, secure: false },
      { name: "fiaon_cookie_consent", value: "notwendig", domain: host, path: "/" },
    ]);
    // Rundgänge als „gesehen" melden — ihr Scheinwerfer liegt sonst über jedem Knopf (Klicks gehen ins Leere).
    await ctx.addInitScript(() => {
      const echt = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k: string) {
        if (String(k).startsWith("fiaon_rundgang_")) return "ja";
        if (k === "fiaon_einfuehrung") return "gesehen"; // die Einführung beim ersten Login (Einfuehrung.tsx)
        return echt.call(this, k);
      };
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e: Error) => seitenfehler.push(String(e).slice(0, 200)));
    // Fremde Aufrufe (Schriften, Messung) abfangen — nichts verlässt den Rechner.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r: any) => r.abort());
    return { ctx, page };
  };
  // Hinweise des Office (Verfügbarkeit fehlt, „Ich bin da“) kommen mit Verzögerung — erst warten, dann wegklicken.
  const wegklicken = async (page: any) => {
    await page.waitForTimeout(1500);
    for (const t of ["Überspringen", "Später", "Nur notwendige", "In 5 Minuten erinnern", "Ich bin da", "Schließen"]) {
      const k = page.getByRole("button", { name: t, exact: true }).first();
      if (await k.count().catch(() => 0)) await k.click({ timeout: 1500 }).catch(() => {});
    }
  };

  // 16 — Mitarbeiter: Calendar → „In meinen Kalender"
  {
    const { ctx, page } = await kontext(1360, 900);
    await page.goto(`${basis}/agent/kalender`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".ca-leiste", { timeout: 30_000 }).catch(() => {});
    await wegklicken(page);
    const knopf = page.locator(".ca-leiste").getByRole("button", { name: /In meinen Kalender/i });
    const da = ok("D16 Knopf „In meinen Kalender“ in der Leiste des Calendar", (await knopf.count()) > 0 && !/Zugriff gesperrt bis Abschluss/.test(await page.locator("body").innerText()));
    if (da) {
      await knopf.first().click();
      await page.waitForSelector(".ca-abo-blatt .ca-abo-wege a", { timeout: 15_000 }).catch(() => {});
      const blatt = page.locator(".ca-abo-blatt");
      const text = (await blatt.innerText().catch(() => "")).toLowerCase();
      const webcal = await blatt.getByRole("link", { name: /iPhone \/ Mac/i }).getAttribute("href").catch(() => null);
      const google = await blatt.getByRole("link", { name: /Google Kalender/i }).getAttribute("href").catch(() => null);
      ok("D16 Blatt zeigt iPhone/Mac (webcal), Google (cid) und „Link kopieren“", !!webcal?.startsWith("webcal://") && !!google?.includes("calendar.google.com/calendar/r?cid=") && /link kopieren/.test(text), { webcal, google });
      const klick = await blatt.getByRole("button", { name: /Link kopieren/i }).click({ timeout: 8000 }).then(() => "ok", (e: Error) => String(e.message).slice(0, 160));
      await page.waitForSelector(".ca-abo-meldung", { timeout: 5000 }).catch(() => {});
      const zw = await page.evaluate(() => navigator.clipboard.readText()).catch((e: Error) => `Lesefehler: ${e.message}`);
      ok("D16 „Link kopieren“ legt die https-Adresse in die Zwischenablage", /^https:\/\/www\.fiaon\.com\/kalender\/[A-Za-z0-9_-]{43}\.ics$/.test(zw), { klick, zw, meldung: await page.locator(".ca-abo-meldung").innerText().catch(() => null) });
      await blatt.getByRole("button", { name: /Neuen Link erzeugen/i }).click({ timeout: 5000 }).catch(() => {});
      ok("D16 „Neuen Link erzeugen“ fragt erst nach", /hört sofort auf/i.test(await blatt.innerText()));
      await page.screenshot({ path: `${aus}/e263-agent-blatt.png` });
    }
    await ctx.close();
  }
  // 16b — Doppelklick auf „In meinen Kalender“ (Gegenprüfung: vorher 0 Blätter offen) und „Termin anlegen“
  {
    const { ctx, page } = await kontext(1360, 900);
    await page.goto(`${basis}/agent/kalender`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".ca-leiste", { timeout: 30_000 }).catch(() => {});
    await wegklicken(page);
    // Die Office-Hinweise („Verfügbarkeit fehlt“, „Bist du noch da?“) kommen verzögert und liegen über allem — erst weg damit.
    const modalWeg = async () => {
      for (let i = 0; i < 4 && (await page.locator(".of-modal-hintergrund").count()); i++) {
        for (const t of ["In 5 Minuten erinnern", "Ich bin da"]) await page.getByRole("button", { name: t, exact: true }).first().click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400);
      }
    };
    await modalWeg();
    const dbl = await page.locator(".ca-leiste").getByRole("button", { name: /In meinen Kalender/i }).first().dblclick({ timeout: 10_000 }).then(() => "ok", (e: Error) => String(e.message).slice(0, 120));
    await page.waitForTimeout(800);
    const nachDoppel = await page.locator(".ca-abo-blatt").count();
    await modalWeg();
    // Ein Klick unten links: Hintergrund, nicht das Blatt (das steht mittig).
    await page.mouse.click(40, 850);
    await page.waitForTimeout(300);
    const nachHintergrund = await page.locator(".ca-abo-blatt").count();
    ok("D16b Doppelklick öffnet das Blatt und lässt es offen; ein späterer Klick auf den Hintergrund schließt es", nachDoppel === 1 && nachHintergrund === 0, { dbl, nachDoppel, nachHintergrund });
    await modalWeg();
    const dbl2 = await page.locator(".ca-leiste").getByRole("button", { name: /Termin anlegen/i }).first().dblclick({ timeout: 10_000 }).then(() => "ok", (e: Error) => String(e.message).slice(0, 120));
    await page.waitForTimeout(800);
    ok("D16b „Termin anlegen“ per Doppelklick bleibt ebenfalls offen", (await page.getByRole("heading", { name: "Termin anlegen" }).count()) === 1, dbl2);
    await ctx.close();
  }
  // 17 — Chef: Mara → Termine → „Termine in deinem Kalender"
  {
    const { ctx, page } = await kontext(1360, 1000);
    await page.goto(`${basis}/chef/s/mara?reiter=termine`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".mt-abo", { timeout: 40_000 }).catch(() => {});
    await wegklicken(page);
    const karte = page.locator(".mt-abo");
    const da = ok("D17 Karte „Termine in deinem Kalender“ steht im Reiter Termine", (await karte.count()) > 0 && /Termine in deinem Kalender/i.test(await karte.innerText().catch(() => "")));
    if (da) {
      await karte.locator("summary").click();
      await page.waitForSelector('.mt-abo [data-abo="team"]', { timeout: 15_000 }).catch(() => {});
      const txt = await karte.innerText();
      ok("D17 beide Abos: „Meine Termine“ und „Termine des Teams (ohne deine)“, dazu „beide abonnieren — jeder Termin genau einmal“",
        /Meine Termine/.test(txt) && /Termine des Teams \(ohne deine\)/.test(txt) && /genau einmal/.test(txt) && !/wie unter „Alle“ oben/.test(txt), txt.slice(0, 400));
      await karte.locator('[data-abo="team"]').getByRole("button", { name: /Link kopieren/i }).click();
      await page.waitForTimeout(300);
      const zw = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      ok("D17 „Link kopieren“ (Team) legt die Adresse in die Zwischenablage", /\/kalender\/[A-Za-z0-9_-]{43}\.ics$/.test(zw), zw);
      await karte.locator('[data-abo="eigene"]').getByRole("button", { name: /Neuen Link erzeugen/i }).click();
      ok("D17 „Neuen Link erzeugen“ zeigt die Bestätigung (Foto endet VOR dem letzten Klick)", /hört sofort auf/i.test(await karte.innerText()) && (await karte.getByRole("button", { name: /Ja, neuen Link erzeugen/i }).count()) === 1);
      await karte.screenshot({ path: `${aus}/e263-chef-karte.png` });
    }
    await ctx.close();
  }
  // 18 — 380 px: kein seitliches Scrollen, Blatt und Karte lesbar
  {
    const { ctx, page } = await kontext(380, 800, true);
    await page.goto(`${basis}/agent/kalender`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".ca-leiste", { timeout: 30_000 }).catch(() => {});
    await wegklicken(page);
    const k = page.getByRole("button", { name: /In meinen Kalender/i });
    if (await k.count()) { await k.first().click(); await page.waitForSelector(".ca-abo-wege a", { timeout: 15_000 }).catch(() => {}); }
    const breit = await page.evaluate(() => document.documentElement.scrollWidth);
    ok("D18 380 px: Calendar mit Blatt ohne Querscrollen", breit <= 381, breit);
    await page.screenshot({ path: `${aus}/e263-agent-380.png` });
    await page.goto(`${basis}/chef/s/mara?reiter=termine`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".mt-abo", { timeout: 40_000 }).catch(() => {});
    await wegklicken(page);
    if (await page.locator(".mt-abo summary").count()) await page.locator(".mt-abo summary").click();
    await page.waitForTimeout(800);
    const breit2 = await page.evaluate(() => document.documentElement.scrollWidth);
    ok("D18 380 px: Chef-Karte ohne Querscrollen", breit2 <= 381, breit2);
    await page.locator(".mt-abo").screenshot({ path: `${aus}/e263-chef-380.png` }).catch(() => {});
    await ctx.close();
  }
  // 20 — Kunde sagt auf der Absage-Seite ab → „Aus Ihrem Kalender entfernen“ liefert CANCEL (Gegenprüfung 29.09.2026)
  {
    const pid = personen[0];
    const tAbs = pid ? await termin({ personId: pid, agentId: A, beginn: await freierBeginn(A, 16, 9) }) : null;
    const { ctx, page } = await kontext(380, 800, true);
    if (tAbs) {
      await page.goto(`${basis}/termin/absagen/${tAbs.storno}?anrede=sie`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /Ja, Termin absagen/i }).click({ timeout: 20_000 }).catch(() => {});
      await page.waitForSelector("[data-kalender-entfernen] a", { timeout: 15_000 }).catch(() => {});
      const zeile = page.locator("[data-kalender-entfernen]");
      const href = await zeile.locator("a").getAttribute("href").catch(() => null);
      const text = await zeile.innerText().catch(() => "");
      const datei = href ? await (await echtFetch(`${basis}${href}`)).text().catch(() => "") : "";
      ok("D20 Absage-Seite (Sie): „Aus Ihrem Kalender entfernen (Apple / Outlook)“ → Datei mit METHOD:CANCEL und derselben UID",
        href === `/kalender/k/${tAbs.storno}.ics` && /Aus Ihrem Kalender entfernen \(Apple \/ Outlook\)/.test(text) && /\r\nMETHOD:CANCEL\r\n/.test(datei)
        && entfalten(datei).includes(`UID:kunde-termin-${tAbs.id}@fiaon.com`), { href, text, datei: datei.slice(0, 200) });
      await page.screenshot({ path: `${aus}/e263-absage-seite-380.png` }).catch(() => {});
    } else ok("D20 Absage-Seite (Fixture fehlt)", false);
    await ctx.close();
  }
  ok("D keine Skriptfehler auf den Seiten", seitenfehler.length === 0, seitenfehler);
  }
}
