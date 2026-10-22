// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-408 (Scheibe 3, 22.10.2026): DAS KÄSTCHEN „FIAON DARF MICH ANRUFEN, AUCH ARAS“ IM ANTRAG
//
// Justin hat „ja“ gesagt: /antrag-neu sammelt schon jetzt die ausdrückliche Telefon-Einwilligung
// (§ 7 Abs. 2 Nr. 1 UWG, Nachweis nach § 7a UWG) — freiwillig, nie vorangekreuzt, eigene Zeile, keine
// Bedingung für den Vertrag. Angerufen wird damit heute niemand (Werbe-Gesprächsarten im Code gesperrt).
//
//   A  REIN (immer): der Wortlaut buchstabengetreu gegen eine ausgeschriebene Kopie; er steht genau einmal
//      im Code (nicht in Seite oder Server); der Zustand startet leer — auch aus einem alten Sitzungsspeicher;
//      Quelltext-Wachen: eigenes Kästchen in eigener Zeile, die Annahme verlangt es nicht, die Vertrags-Haken
//      bleiben ohne „anruf“, gespeichert wird erst nach der Annahme; Zuruf bleibt gesperrt.
//   B  SERVER (--server <url>): der echte Weg über HTTP gegen einen LOKALEN Server auf einer LOKALEN
//      Prüfdatenbank — anlegen, speichern, prüfen, PIN, annehmen: ohne Haken (Annahme klappt, keine
//      Einwilligung), mit Haken (GENAU EINE Zeile mit GENAU dem Wortlaut der Konstante, Art, Person, Nummer,
//      Quelle, Zeitpunkt der Annahme), zweiter Klick (bleibt eine), und vier Abwege, die nichts speichern
//      dürfen (Haken aus, „true“ als Text, fremder Satz, kein Satz). Dazu: Der Planer reiht damit nicht ein.
//   C  BROWSER (--browser, mit --server): die echte Seite /antrag-neu im Chromium — das Kästchen ist beim
//      ersten Anzeigen leer, ein Tipp setzt und löst es; am Handy (390 px) Annahme OHNE Haken, am Rechner
//      MIT Haken — danach genau eine Einwilligung bzw. keine. Fotos mit --fotos <ordner>.
//
//   npx tsx scripts/pruef-antrag-kaestchen.ts                                   (nur A)
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus \
//     PLAYWRIGHT_BROWSERS_PATH=/Users/Justin/Developer/fiaon-plattform/.playwright \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pr_kaestchen?sslmode=require' \
//     npx tsx scripts/pruef-antrag-kaestchen.ts --server http://127.0.0.1:5311 --browser [--fotos <ordner>]
//
// Der Server dazu läuft auf DERSELBEN lokalen Datenbank: CRONS=aus, ohne Mail-/Zahlungs-/KI-Schlüssel, eigener
// PORT (der interne Aufruf /application geht an PORT), SESSION_SECRET gesetzt und PRUEFSTAND_ROBOTER_ERLAUBT=1
// (nur so nimmt er die Annahme aus dem Chromium des Prüfstands an — gegen eine fremde Datenbank nie, siehe
// pruefstandErlaubt in server/routes/fiaon-antrag-neu.ts). Die Wache unten prüft vor dem ersten Schreiben,
// dass der Server wirklich in DIESE lokale Datenbank schaut. Danach die Datenbank verwerfen (dropdb).
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";

// db-pool verlangt beim Laden eine Adresse — Teil A verbindet nie.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i >= 0 ? String(process.argv[i + 1] ?? "") : null; };
const SERVER = arg("--server");
const BROWSER = process.argv.includes("--browser");
const FOTOS = arg("--fotos");
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/[A-Za-z0-9_]+(\?|$)/.test(URL_DB);
const LOKAL_SERVER = !!SERVER && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(SERVER);

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "DATABASE_URL_EXTERN"]) {
  if (process.env[k] && !(k === "DATABASE_URL_EXTERN" && process.env[k] === URL_DB)) {
    console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`);
    process.exit(3);
  }
}
if (SERVER !== null && (!LOKAL_SERVER || !LOKAL_DB)) {
  console.error("ABBRUCH: Teil B/C nur mit --server http://127.0.0.1:<port> UND DATABASE_URL auf die lokale Prüfdatenbank (127.0.0.1:54329).");
  process.exit(3);
}

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 500)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Kommentare raus — wer Quelltext prüft, darf die Begründung nicht treffen (AGENTS.md). */
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
/** Der Block zwischen zwei Marken (AGENTS.md: wer eine Reihenfolge prüft, schneidet den Block heraus). */
function ausschnitt(t: string, von: string, bis: string): string {
  const a = t.indexOf(von);
  if (a < 0) return "";
  const b = t.indexOf(bis, a + von.length);
  return b < 0 ? t.slice(a) : t.slice(a, b);
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Der freigegebene Wortlaut, AUSGESCHRIEBEN — nicht aus der Konstante gelesen (sonst prüfte er sich selbst).
const WORTLAUT = "Ja, FIAON darf mich telefonisch zu meinem Antrag und zu passenden FIAON-Angeboten anrufen – auch ARAS, die digitale Mitarbeiterin von FIAON (eine KI). Freiwillig und jederzeit widerrufbar: Ein kurzer Satz am Telefon oder eine Nachricht genügt.";

// ═══════════════════════════════════════════════════════════════════════════
// A — REIN
// ═══════════════════════════════════════════════════════════════════════════
async function teilA() {
  const N = await import("../shared/fiaon-antrag-neu");
  const Z = await import("../client/src/pages/antrag-neu/zustand");
  const A = await import("../shared/fiaon-aras");

  console.log("── A1 · Der Wortlaut");
  ok(N.ANTRAG_NEU_ANRUF_TEXT === WORTLAUT, "Konstante buchstabengetreu wie freigegeben", N.ANTRAG_NEU_ANRUF_TEXT);
  ok(/^Ja, FIAON darf mich telefonisch/.test(N.ANTRAG_NEU_ANRUF_TEXT) && /ARAS, die digitale Mitarbeiterin von FIAON \(eine KI\)/.test(N.ANTRAG_NEU_ANRUF_TEXT),
    "ausdrücklich („Ja, …“) und nennt ARAS als KI (KI-VO Art. 50)");
  ok(/Freiwillig und jederzeit widerrufbar/.test(N.ANTRAG_NEU_ANRUF_TEXT), "sagt freiwillig und jederzeit widerrufbar");

  console.log("── A2 · Ein Satz, ein Ort");
  const stuecke = [WORTLAUT, "digitale Mitarbeiterin von FIAON (eine KI)", "Ein kurzer Satz am Telefon oder eine Nachricht genügt"];
  const fundorte = new Set<string>();
  for (const wurzel of ["client/src", "server", "shared"]) {
    for (const rel of readdirSync(new URL(`../${wurzel}`, import.meta.url), { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(rel)) continue;
      const pfad = `${wurzel}/${rel}`;
      const t = lies(pfad);
      if (stuecke.some((s) => t.includes(s))) fundorte.add(pfad);
    }
  }
  ok(fundorte.size === 1 && fundorte.has("shared/fiaon-antrag-neu.ts"), "der Satz steht genau einmal im Code — in shared/fiaon-antrag-neu.ts, nicht in Seite oder Server", [...fundorte]);

  console.log("── A3 · Nie vorangekreuzt (Zustand der Seite)");
  ok(Z.ZUSTAND_LEER.anrufJa === false, "Vorgabe im Zustand: leer");
  ok(Z.zustandLaden().anrufJa === false, "neuer Besuch ohne Speicher: leer");
  const speicher = new Map<string, string>();
  (globalThis as any).sessionStorage = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); }, removeItem: (k: string) => { speicher.delete(k); } };
  try {
    speicher.set("fiaon_antrag_neu", JSON.stringify({ ref: "FIAON-PRUEF-KAEST", vorname: "Pia", ag1: true, ag3: true, ag4: true }));
    ok(Z.zustandLaden().anrufJa === false, "Stand aus der Zeit vor dem Kästchen (alle anderen Haken gesetzt): leer");
    speicher.set("fiaon_antrag_neu", JSON.stringify({ ref: "FIAON-PRUEF-KAEST", anrufJa: "true" }));
    ok(Z.zustandLaden().anrufJa === false, "„true“ als Text im Speicher setzt den Haken nicht");
    speicher.set("fiaon_antrag_neu", JSON.stringify({ ref: "FIAON-PRUEF-KAEST", anrufJa: true }));
    ok(Z.zustandLaden().anrufJa === true, "Gegenprobe: der EIGENE Haken des Kunden überlebt ein Neuladen");
  } finally { delete (globalThis as any).sessionStorage; }

  console.log("── A4 · Quelltext-Wachen der Seite (das Verhalten prüft Teil C im Browser)");
  const seite = ohneKommentare(lies("client/src/pages/antrag-neu/schritte-abschluss.tsx"));
  const block = ausschnitt(seite, "export function SchrittUnterschrift", "export function RettungSheet");
  const tags = block.match(/<Haken id="an-anruf"[\s\S]*?<\/Haken>/g) ?? [];
  ok(tags.length === 1, "genau ein Kästchen #an-anruf auf der Unterschrift-Seite", tags.length);
  const tag = tags[0] ?? "";
  const klick = (tag.match(/onClick=\{([\s\S]*?)\}>/) ?? ["", ""])[1];
  ok(/an=\{S\.anrufJa\}/.test(tag), "zeigt seinen eigenen Zustand (S.anrufJa)");
  ok(/anrufJa/.test(klick) && !/ag1|ag3|ag4|hakenKombi/.test(klick), "ein Tipp ändert nur dieses Kästchen — keine Sammel-Zustimmung", klick);
  ok(/>\{ANTRAG_NEU_ANRUF_TEXT\}<\/Haken>$/.test(tag), "Text aus der einen Konstante");
  const tagAg1 = (block.match(/<Haken id="an-ag1"[\s\S]*?<\/Haken>/) ?? [""])[0];
  const tagAg4 = (block.match(/<Haken id="an-ag4"[\s\S]*?<\/Haken>/) ?? [""])[0];
  ok(!!tagAg1 && !!tagAg4 && !/anruf/i.test(tagAg1 + tagAg4), "AGB-Haken und Sofort-Haken setzen das Anruf-Kästchen nie mit");
  const p = (s: string) => block.indexOf(s);
  ok(p('id="an-ag1"') > 0 && p('id="an-ag1"') < p('id="an-ag4"') && p('id="an-ag4"') < p('id="an-anruf"')
    && p('id="an-anruf"') < p("{ANTRAG_NEU_WERBE_HINWEIS}") && p("{ANTRAG_NEU_WERBE_HINWEIS}") < p("{KNOPF_ZAHLUNGSPFLICHTIG}</button>"),
  "eigene Zeile nach AGB- und Sofort-Haken, vor dem Knopf");
  const annehmen = ausschnitt(block, "const annehmen = async", "\n  return (");
  ok(/haken: \{[^}]*\banruf: S\.anrufJa\b[^}]*\}/.test(annehmen), "die Annahme schickt den Haken mit (haken.anruf)");
  ok(/\.\.\.\(S\.anrufJa \? \{ anrufWortlaut: ANTRAG_NEU_ANRUF_TEXT \} : \{\}\)/.test(annehmen), "und den gezeigten Satz nur MIT Haken");
  ok(!/if\s*\([^)]*anrufJa/.test(annehmen) && !/setFehlt\([^)]*anruf/.test(annehmen), "keine Bedingung: die Annahme hält ohne Haken nicht an");
  const lotse = (block.match(/const lotsenZiel[^\n]*/) ?? [""])[0];
  ok(!!lotse && !/anruf/.test(lotse), "der Lotse am Handy führt weiter nur zu AGB-Haken und Knopf");

  console.log("── A5 · Quelltext-Wachen des Servers (das Verhalten prüft Teil B)");
  const srv = ohneKommentare(lies("server/routes/fiaon-antrag-neu.ts"));
  const route = ausschnitt(srv, 'router.post("/antrag-neu/:ref/annehmen"', 'router.post("/antrag-neu/:ref/auskunft"');
  ok(/const anrufJa = h\.anruf === true;/.test(route), "nur ein echtes true zählt (h.anruf === true)");
  ok(route.split("\n").filter((z) => /anruf/i.test(z)).every((z) => !/res\.status|return res/.test(z)), "kein Abbruch der Annahme wegen des Kästchens");
  const vertragsHaken = ausschnitt(route, "const haken = [", "];");
  ok(!!vertragsHaken && !/anruf/i.test(vertragsHaken), "die Vertrags-Haken (Nachweis im Vertrags-PDF) bleiben ohne das Anruf-Kästchen");
  const iAbschluss = route.indexOf("await annahmeAbschliessen("), iMerken = route.indexOf("if (anrufJa) anrufEinwilligungMerken(");
  ok(iAbschluss > 0 && iMerken > iAbschluss, "gespeichert wird erst nach Annahme und Antragszeile (Person steht fest) — und nur mit Haken");
  const fn = ausschnitt(srv, "function anrufEinwilligungMerken(", "\nasync function annahmeAbschliessen(");
  ok(/art: "antrag_kaestchen"/.test(fn) && /wortlaut: ANTRAG_NEU_ANRUF_TEXT/.test(fn) && /quelleArt: "antrag", quelleId: ref/.test(fn) && /erteiltAm: am/.test(fn),
    "Art antrag_kaestchen, Wortlaut der Konstante, Quelle = der Antrag, Zeitpunkt = die Annahme");
  ok(/o\.wortlautBrowser !== ANTRAG_NEU_ANRUF_TEXT/.test(fn) && /\.catch\(\(e\) => console\.error\(/.test(fn), "fremder Satz → nichts; ein Fehler wird protokolliert, nie geworfen");

  console.log("── A6 · Eine Einwilligung wählt heute nicht");
  ok((A.EINWILLIGUNG_ARTEN as readonly string[]).includes("antrag_kaestchen"), "antrag_kaestchen ist eine bekannte Einwilligungs-Art");
  ok(A.istGesperrteSpielart("zuruf") && A.RECHTSGRUND.zuruf === "einwilligung", "„Verkauf nach JA“ (zuruf) bleibt im Code gesperrt — nur Vertragskunden");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — SERVER (lokal, echte Routen über HTTP)
// ═══════════════════════════════════════════════════════════════════════════
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const LAUF = randomBytes(3).toString("hex").toUpperCase();
/** Fünf Ziffern je Lauf — so teilen sich zwei Läufe auf derselben Prüfdatenbank nie eine Person (Abgleich über die Nummer). */
const LAUF_ZIFFERN = String(parseInt(LAUF, 16) % 100000).padStart(5, "0");
type Antwort = { status: number; json: any; cookies: string[] };

async function rufe(pfad: string, body: unknown, o: { ip: string; cookie?: string }): Promise<Antwort> {
  const r = await fetch(`${SERVER}/api/fiaon${pfad}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "x-forwarded-for": o.ip, ...(o.cookie ? { cookie: o.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json, cookies: (r.headers as any).getSetCookie?.() ?? [] };
}

/** Ein kleines, gültiges PNG (eine Schwungline) — wie eine Unterschrift aus dem Browser. */
function unterschriftPng(): string {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const stueck = (typ: string, daten: Buffer) => {
    const kopf = Buffer.alloc(4); kopf.writeUInt32BE(daten.length);
    const td = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const pz = Buffer.alloc(4); pz.writeUInt32BE(crc(td));
    return Buffer.concat([kopf, td, pz]);
  };
  const w = 220, h = 60;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; // 8 Bit Graustufen
  const zeilen = Buffer.alloc((w + 1) * h, 255);
  for (let y = 0; y < h; y++) {
    zeilen[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) if (Math.abs(y - (30 + 18 * Math.sin(x / 11) * Math.cos(x / 37))) < 1.6) zeilen[y * (w + 1) + 1 + x] = 25;
  }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), stueck("IHDR", ihdr), stueck("IDAT", deflateSync(zeilen)), stueck("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Die Angaben eines erfundenen Menschen (example.com nach RFC 2606; die Nummer lebt nur in der lokalen Datenbank, gewählt wird nie). */
const telefonFuer = (nr: number) => `171 ${LAUF_ZIFFERN}${String(nr).padStart(2, "0")}`;
function angaben(nr: number) {
  const zwei = String(nr).padStart(2, "0");
  return {
    anrede: "Frau", vorname: "Pia", nachname: `Kästchenprobe ${"ABCDEFGHIJKLMNOP"[nr % 16]}${LAUF}`,
    email: `pruefstand.kaestchen.${LAUF.toLowerCase()}.${zwei}@example.com`, vorwahl: "+49", telefon: telefonFuer(nr),
    gt: "14", gm: "03", gj: "1986", land: "DE", strasse: "Musterstraße", nr: "12", plz: "10115", ort: "Berlin", adresseQuelle: "",
    staatArt: "land", staat: "deutsch", staatText: "", beruf: "angestellt", arbeitgeber: "Prüfstand GmbH", seit: "1-5", branche: "",
    einkommen: "2800", wohnen: "miete", eintraege: "nein", paket: "pro", limit: 2500, zweck: ["alltag"],
  };
}
const ipFuer = (nr: number) => `203.0.113.${(nr % 200) + 20}`; // RFC 5737, Beispiel-Netz

/** Der echte Weg bis vor die Unterschrift: anlegen → speichern → prüfen → PIN → Paket/Limit. */
async function antragBisUnterschrift(nr: number): Promise<{ ref: string; cookie: string; daten: ReturnType<typeof angaben>; ip: string; geprueftAm: string } | null> {
  const daten = angaben(nr), ip = ipFuer(nr), sitzung = `kaestchen${LAUF.toLowerCase()}${nr}`;
  const a = await rufe("/antrag-neu/anlegen", { daten: { anrede: daten.anrede, vorname: daten.vorname, nachname: daten.nachname, email: daten.email, vorwahl: daten.vorwahl, telefon: daten.telefon }, leadLink: null, messung: {}, sitzung }, { ip });
  const ref = String(a.json?.ref ?? "");
  const roh = a.cookies.find((c) => c.startsWith("fiaon_antrag=")) ?? "";
  const cookie = roh.split(";")[0];
  if (a.status !== 200 || !ref || !cookie) { ok(false, `Fall ${nr}: anlegen`, { status: a.status, json: a.json }); return null; }
  const s1 = await rufe(`/antrag-neu/${ref}/speichern`, { daten, schritt: "eintraege", messung: {} }, { ip, cookie });
  const pr = await rufe(`/antrag-neu/${ref}/pruefen`, { daten, sitzung, messung: {} }, { ip, cookie });
  const pin = await rufe(`/antrag-neu/${ref}/pin`, { pin: "2580", sitzung }, { ip, cookie });
  const s2 = await rufe(`/antrag-neu/${ref}/speichern`, { daten, schritt: "unterschrift", messung: {} }, { ip, cookie });
  const alle = [s1, pr, pin, s2].every((x) => x.status === 200 && x.json?.ok);
  if (!alle) { ok(false, `Fall ${nr}: speichern/prüfen/PIN/Paket`, [s1, pr, pin, s2].map((x) => ({ s: x.status, j: x.json }))); return null; }
  return { ref, cookie, daten, ip, geprueftAm: String(pr.json?.geprueftAm ?? new Date().toISOString()) };
}

async function annehmen(f: { ref: string; cookie: string; daten: unknown; ip: string }, extra: { haken?: Record<string, unknown>; anrufWortlaut?: unknown } = {}): Promise<Antwort> {
  const { AGB_FASSUNG } = await import("../shared/fiaon-vertrag-paket");
  const N = await import("../shared/fiaon-antrag-neu");
  const { KNOPF_ZAHLUNGSPFLICHTIG } = await import("../client/src/components/antrag/bestelluebersicht-daten");
  return rufe(`/antrag-neu/${f.ref}/annehmen`, {
    daten: f.daten, sitzung: `kaestchen${LAUF.toLowerCase()}`, knopf: KNOPF_ZAHLUNGSPFLICHTIG,
    haken: { agb: true, geprueft: true, agbGeprueft: true, sofort: false, ...(extra.haken ?? {}) },
    ...("anrufWortlaut" in extra ? { anrufWortlaut: extra.anrufWortlaut } : {}),
    unterschrift: { png: unterschriftPng(), getippt: false }, messung: {},
    fassungen: { agb: AGB_FASSUNG, vertrag: N.ANTRAG_NEU_VERTRAG_FASSUNG, leistung: N.ANTRAG_NEU_LEISTUNG_FASSUNG },
  }, { ip: f.ip, cookie: f.cookie });
}

async function teilB(): Promise<Map<string, string>> {
  const { sqlPool } = await import("../server/lib/db-pool");
  const zeilen = async (ref: string) => (await sqlPool`SELECT * FROM fiaon_telefon_einwilligung WHERE quelle_id = ${ref} ORDER BY id`.catch((e: any) => {
    // Vor dem ersten Speichern gibt es die Tabelle womöglich noch nicht (arasSchema legt sie beim ersten Gebrauch an).
    if (String(e?.code) === "42P01") return [];
    throw e;
  })) as any[];
  const refs = new Map<string, string>();

  console.log("── B0 · Wache: schaut der Server in DIESE lokale Datenbank?");
  const marke = `wache.${LAUF.toLowerCase()}.${randomBytes(4).toString("hex")}@pruefstand.invalid`;
  await sqlPool`INSERT INTO fiaon_applications (ref, email) VALUES (${`FIAON-WACHE-${LAUF}`}, ${marke})`;
  const w = await rufe(`/antrag/email-bekannt?email=${encodeURIComponent(marke)}`, undefined, { ip: "203.0.113.250" });
  const dieselbe = w.status === 200 && w.json?.bekannt === true;
  ok(dieselbe, "der Server findet die Marke, die nur in der lokalen Prüfdatenbank steht", w.json);
  if (!dieselbe) { console.error("ABBRUCH: Server und Prüfstand sehen verschiedene Datenbanken — es wird nichts angelegt."); return refs; }

  const N = await import("../shared/fiaon-antrag-neu");
  const { nummerKern } = await import("../server/lib/fiaon-aras-sperre");

  console.log("── B1 · Ohne Haken: die Annahme klappt wie immer");
  const fOhne = await antragBisUnterschrift(1);
  const aOhne = fOhne ? await annehmen(fOhne) : null;
  ok(aOhne?.status === 200 && !!aOhne?.json?.angenommenAm && !!aOhne?.json?.paymentReference, "angenommen, mit Verwendungszweck", aOhne && { s: aOhne.status, j: aOhne.json });
  if (fOhne) refs.set("ohne", fOhne.ref);
  if (fOhne) {
    const [st] = (await sqlPool`SELECT current_step, status FROM fiaon_applications WHERE ref = ${fOhne.ref}`) as any[];
    const [va] = (await sqlPool`SELECT ref FROM fiaon_vertragsannahmen WHERE ref = ${fOhne.ref}`) as any[];
    ok(Number(st?.current_step) === 8 && st?.status === "submitted" && !!va, "Antragszeile auf Schritt 8 (abgeschickt), Vertragsannahme gespeichert", st);
  }

  console.log("── B2 · Mit Haken: genau EINE Einwilligung mit genau dem Wortlaut");
  const fMit = await antragBisUnterschrift(2);
  const aMit = fMit ? await annehmen(fMit, { haken: { anruf: true }, anrufWortlaut: N.ANTRAG_NEU_ANRUF_TEXT }) : null;
  ok(aMit?.status === 200 && !!aMit?.json?.angenommenAm, "angenommen", aMit && { s: aMit.status, j: aMit.json });
  let mitZeilen: any[] = [];
  if (fMit) {
    refs.set("mit", fMit.ref);
    // Gespeichert wird im Hintergrund — erst warten, dann messen (höchstens 15 s).
    for (let i = 0; i < 60 && !(mitZeilen = await zeilen(fMit.ref)).length; i++) await warte(250);
    await warte(300);
    mitZeilen = await zeilen(fMit.ref);
    ok(mitZeilen.length === 1, "genau eine Zeile in fiaon_telefon_einwilligung", mitZeilen.length);
    const e = mitZeilen[0] ?? {};
    const [app] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${fMit.ref}`) as any[];
    const [va] = (await sqlPool`SELECT angenommen_am, haken FROM fiaon_vertragsannahmen WHERE ref = ${fMit.ref}`) as any[];
    ok(e.wortlaut === N.ANTRAG_NEU_ANRUF_TEXT && e.wortlaut === WORTLAUT, "Wortlaut buchstabengetreu = die Konstante", e.wortlaut);
    ok(e.art === "antrag_kaestchen", "Art antrag_kaestchen", e.art);
    ok(e.quelle_art === "antrag" && e.quelle_id === fMit.ref, "Quelle = dieser Antrag", { a: e.quelle_art, i: e.quelle_id });
    ok(app?.person_id != null && Number(e.person_id) === Number(app.person_id), "Person = die Person des Antrags", { e: e.person_id, a: app?.person_id });
    const erwartet = `+49${telefonFuer(2).replace(/\s/g, "")}`;
    ok(e.nummer === erwartet && e.nummer_kern === nummerKern(erwartet), "Nummer aus dem Antrag (E.164) und ihr Kern", { n: e.nummer, k: e.nummer_kern, erwartet });
    ok(!!va && new Date(e.erteilt_am).getTime() === new Date(va.angenommen_am).getTime(), "Zeitpunkt = die Annahme", { e: e.erteilt_am, a: va?.angenommen_am });
    ok(e.widerrufen_am == null, "gültig (nicht widerrufen)");
    ok(e.beleg?.seite === "/antrag-neu" && e.beleg?.bildschirm === "unterschrift" && e.beleg?.ip === fMit.ip && !e.beleg?.pruefstand, "Beleg: Seite, Bildschirm, Adresse des Menschen", e.beleg);
    const haken = Array.isArray(va?.haken) ? va.haken.map((x: any) => x.id) : [];
    ok(haken.join(",") === "agb_geprueft,sofort", "Vertrags-Haken unverändert (ohne Anruf-Kästchen)", haken);
    const { einwilligungGueltig } = await import("../server/lib/fiaon-telefon-einwilligung");
    const g = await einwilligungGueltig(e.nummer_kern ?? null, Number(e.person_id));
    ok(g?.id === Number(e.id) && g?.art === "antrag_kaestchen", "einwilligungGueltig (Planer, Wähler, Briefing) findet sie", g);
    // Der Planer darf daraus heute keinen Anruf machen (Justin 20.10.2026: „nur Vertragskunden“).
    const { planEinreihen } = await import("../server/lib/fiaon-aras-plan");
    const plan = await planEinreihen({ personId: Number(e.person_id), ref: fMit.ref, nummer: e.nummer, spielart: "zuruf", grund: "antrag_frisch", erzeugtVon: "takt",
      fruehAb: new Date(), spaetBis: new Date(Date.now() + 4 * 3600_000), einwilligungId: Number(e.id), anlassAm: new Date(e.erteilt_am) });
    const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE einwilligung_id = ${Number(e.id)}`) as any[];
    ok(plan.ok === false && /gesperrt/.test(String(plan.grund)) && Number(anz?.n) === 0, "der Planer reiht damit nicht ein (zuruf gesperrt), kein Eintrag in der Warteschlange", { plan, n: anz?.n });

    console.log("── B3 · Zweiter Klick: bleibt EINE");
    const nochmal = await annehmen(fMit, { haken: { anruf: true }, anrufWortlaut: N.ANTRAG_NEU_ANRUF_TEXT });
    await warte(1500);
    ok(nochmal.status === 200 && (await zeilen(fMit.ref)).length === 1, "zweite Annahme → dieselbe Antwort, weiter genau eine Zeile", { s: nochmal.status });
  }

  console.log("── B4 · Abwege speichern nichts (und halten die Annahme nie auf)");
  const abwege: [number, string, { haken?: Record<string, unknown>; anrufWortlaut?: unknown }][] = [
    [3, "Haken aus, Satz trotzdem dabei", { haken: { anruf: false }, anrufWortlaut: N.ANTRAG_NEU_ANRUF_TEXT }],
    [4, "„true“ als Text statt Haken", { haken: { anruf: "true" }, anrufWortlaut: N.ANTRAG_NEU_ANRUF_TEXT }],
    [5, "Haken mit fremdem Satz (alter Stand)", { haken: { anruf: true }, anrufWortlaut: "Ja, FIAON darf mich anrufen." }],
    [6, "Haken ohne Satz", { haken: { anruf: true } }],
  ];
  const abwegRefs: [string, string][] = [];
  for (const [nr, name, extra] of abwege) {
    const f = await antragBisUnterschrift(nr);
    const a = f ? await annehmen(f, extra) : null;
    ok(a?.status === 200 && !!a?.json?.angenommenAm, `${name}: angenommen`, a && { s: a.status, j: a.json });
    if (f) { abwegRefs.push([f.ref, name]); refs.set(`abweg${nr}`, f.ref); }
  }
  // Gemessen wird NACH der Gegenprobe: Erst wenn die Zeile des Falls „mit Haken“ (früher abgeschickt) längst
  // steht, beweist ihr Fehlen hier etwas. Dazu eine feste Wartezeit für die eigenen Hintergrund-Aufrufe.
  await warte(2500);
  if (fOhne) ok((await zeilen(fOhne.ref)).length === 0, "ohne Haken: keine Einwilligung");
  for (const [ref, name] of abwegRefs) ok((await zeilen(ref)).length === 0, `${name}: keine Einwilligung`);
  return refs;
}

// ═══════════════════════════════════════════════════════════════════════════
// C — BROWSER (die echte Seite)
// ═══════════════════════════════════════════════════════════════════════════
async function teilC() {
  const { sqlPool } = await import("../server/lib/db-pool");
  let chromium: any;
  try { ({ chromium } = await import("playwright")); } catch (e) { ok(false, "Playwright laden", String(e)); return; }
  let browser: any;
  try { browser = await chromium.launch(); }
  catch { browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }).catch((e: any) => { ok(false, "Chromium starten", String(e?.message ?? e)); return null; }); }
  if (!browser) return;
  if (FOTOS) mkdirSync(FOTOS, { recursive: true });
  const N = await import("../shared/fiaon-antrag-neu");
  const ergebnis: { name: string; ref: string; mit: boolean; status: number | null }[] = [];

  for (const geraet of [
    { name: "Handy 390 px", datei: "handy-390", nr: 11, mit: false, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: "Rechner 1440 px", datei: "rechner-1440", nr: 12, mit: true, ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  ]) {
    console.log(`── C · ${geraet.name}: ${geraet.mit ? "MIT" : "OHNE"} Haken annehmen`);
    const f = await antragBisUnterschrift(geraet.nr);
    if (!f) continue;
    const ctx = await browser.newContext({ ...geraet.ctx, locale: "de-DE", timezoneId: "Europe/Berlin" });
    const [name, wert] = f.cookie.split("=");
    await ctx.addCookies([{ name, value: wert, domain: new URL(SERVER!).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
    // Der Zustand im Sitzungsspeicher, wie ihn die Seite nach PIN und Paketwahl selbst hält — OHNE anrufJa:
    // Ob das Kästchen leer startet, entscheidet die Seite, nicht der Prüfstand. Nur beim ersten Laden setzen.
    const zustand = { ...f.daten, ref: f.ref, adresseOffen: true, geprueftAm: f.geprueftAm, pinGesetzt: true };
    await ctx.addInitScript((z: unknown) => { try { if (!sessionStorage.getItem("fiaon_antrag_neu")) sessionStorage.setItem("fiaon_antrag_neu", JSON.stringify(z)); } catch { /* egal */ } }, zustand);
    const page = await ctx.newPage();
    const fehler: string[] = [];
    page.on("pageerror", (e: any) => fehler.push(String(e?.message ?? e)));
    await page.goto(`${SERVER}/antrag-neu#unterschrift`, { waitUntil: "domcontentloaded" });
    const kaestchen = page.locator("#an-anruf");
    const da = await kaestchen.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    ok(da, "die Unterschrift-Seite zeigt das Kästchen #an-anruf");
    if (!da) { if (FOTOS) await page.screenshot({ path: `${FOTOS}/${geraet.datei}-FEHLT.png` }).catch(() => {}); await ctx.close(); continue; }
    // Zuerst messen — bevor irgendein Klick auf der Seite passiert.
    ok(await kaestchen.getAttribute("aria-checked") === "false", "beim ersten Anzeigen: NICHT angehakt");
    // Einwilligungs-Hinweis der Website (erscheint mit Verzögerung): „Nur notwendige“, die datensparsame Wahl.
    const nurNotwendige = page.getByRole("button", { name: "Nur notwendige" });
    if (await nurNotwendige.waitFor({ state: "visible", timeout: 6000 }).then(() => true).catch(() => false)) {
      await nurNotwendige.click();
      await nurNotwendige.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    }
    const text = String(await kaestchen.innerText()).replace(/\s+/g, " ").trim();
    ok(text === N.ANTRAG_NEU_ANRUF_TEXT, "zeigt genau den Wortlaut der Konstante", text);
    const getrennt = await page.evaluate(() => {
      const a = document.getElementById("an-anruf"), b = document.getElementById("an-ag1"), c = document.getElementById("an-ag4");
      return !!a && !!b && !!c && a !== b && !a.contains(b) && !b.contains(a) && !a.contains(c) && a.getAttribute("role") === "checkbox";
    });
    ok(getrennt, "eigene Zeile (eigenes Kästchen, getrennt von AGB- und Sofort-Haken)");
    ok(await page.locator("#an-ag1").getAttribute("aria-checked") === "false", "und auch der AGB-Haken ist nicht vorangekreuzt");
    // Für das Foto: alle drei Haken im Bild — der AGB-Haken knapp unter der festen Kopfleiste (rund 90 px).
    await page.evaluate(() => { const el = document.getElementById("an-ag1"); if (el) { el.style.scrollMarginTop = "104px"; el.scrollIntoView({ block: "start" }); } });
    await warte(500);
    if (FOTOS) await page.screenshot({ path: `${FOTOS}/${geraet.datei}-1-leer.png` });
    await kaestchen.click();
    ok(await kaestchen.getAttribute("aria-checked") === "true", "ein Tipp setzt den Haken");
    ok(await page.locator("#an-ag1").getAttribute("aria-checked") === "false" && await page.locator("#an-ag4").getAttribute("aria-checked") === "false", "… und nur diesen (AGB und Sofortbeginn bleiben leer)");
    await warte(250);
    if (FOTOS) await page.screenshot({ path: `${FOTOS}/${geraet.datei}-2-angehakt.png` });
    if (!geraet.mit) {
      await kaestchen.click();
      ok(await kaestchen.getAttribute("aria-checked") === "false", "ein zweiter Tipp nimmt ihn wieder weg");
    }
    // Unterschreiben (mit dem Namen), AGB-Haken, annehmen — gegen die lokale Datenbank (weg „neu-pruefstand“).
    await page.getByRole("button", { name: "Mit meinem Namen unterschreiben" }).first().click();
    await page.locator("#an-ag1").click();
    const antwortP = page.waitForResponse((r: any) => r.url().includes(`/antrag-neu/${f.ref}/annehmen`), { timeout: 60_000 });
    await page.getByRole("button", { name: "Zahlungspflichtig annehmen" }).click();
    const antwort = await antwortP.catch(() => null);
    const json = antwort ? await antwort.json().catch(() => null) : null;
    ok(antwort?.status() === 200 && !!json?.angenommenAm, `Annahme im Browser ${geraet.mit ? "mit" : "ohne"} Haken: angenommen`, { s: antwort?.status(), j: json });
    ergebnis.push({ name: geraet.name, ref: f.ref, mit: geraet.mit, status: antwort?.status() ?? null });
    ok(!fehler.length, "keine Fehler im Browser", fehler);
    await ctx.close();
  }
  await browser.close();

  // Messen erst, wenn die Zeile des Falls MIT Haken steht (Hintergrund), dann das Fehlen beim Fall ohne.
  const mit = ergebnis.find((e) => e.mit), ohne = ergebnis.find((e) => !e.mit);
  let zMit: any[] = [];
  for (let i = 0; mit && i < 60; i++) { zMit = (await sqlPool`SELECT * FROM fiaon_telefon_einwilligung WHERE quelle_id = ${mit.ref}`) as any[]; if (zMit.length) break; await warte(250); }
  await warte(1500);
  if (mit) {
    zMit = (await sqlPool`SELECT * FROM fiaon_telefon_einwilligung WHERE quelle_id = ${mit.ref}`) as any[];
    ok(zMit.length === 1 && zMit[0].wortlaut === WORTLAUT && zMit[0].art === "antrag_kaestchen", "Browser mit Haken: genau eine Einwilligung mit genau dem Wortlaut", zMit.map((z) => ({ art: z.art, w: z.wortlaut })));
    ok(zMit[0]?.beleg?.pruefstand === true, "… als Prüfstand-Annahme gekennzeichnet (Beleg)", zMit[0]?.beleg);
  }
  if (ohne) {
    const zOhne = (await sqlPool`SELECT id FROM fiaon_telefon_einwilligung WHERE quelle_id = ${ohne.ref}`) as any[];
    ok(zOhne.length === 0, "Browser ohne Haken (gesetzt und wieder gelöst): keine Einwilligung", zOhne.length);
  }
}

async function main() {
  console.log("\n══ Prüfstand E-408: Kästchen „FIAON darf mich anrufen, auch ARAS“ ══");
  await teilA();
  if (SERVER) {
    console.log(`\n── Teil B gegen ${SERVER} (Datenbank ${URL_DB.replace(/\?.*$/, "")}, Lauf ${LAUF})`);
    await teilB();
    if (BROWSER) await teilC();
  } else {
    console.log("\n(Teil B/C übersprungen — ohne --server läuft nur der reine Teil.)");
  }
  console.log(`\n══ ${gut} Prüfungen bestanden, ${schlecht} rot ══`);
  const { sqlPool } = await import("../server/lib/db-pool");
  await (sqlPool as any).end?.({ timeout: 2 }).catch?.(() => {});
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
