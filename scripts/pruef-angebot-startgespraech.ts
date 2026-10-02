// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DAS STARTGESPRÄCH NACH DER ANNAHME EINES INDIVIDUALANGEBOTS
// E-273 (02.10.2026)
//
// Justin an Herrn Hildbrand (WhatsApp, 02.10.2026): „… sobald dieser angenommen
// wurde von Ihnen bucht das System automatisch den nächsten freien Termin …"
// Dieser Prüfstand fährt den Ablauf gegen eine LOKALE Datenbank — mit den
// Funktionen des Moduls, ohne laufenden Server und ohne Mailschlüssel:
//
//   A  „Sofort starten": Annahme → genau EIN Termin (quelle global, herkunft
//      individualangebot) im Kalender des Gründer-Kontos zum ersten freien Platz;
//      die Antwort an die Seite nennt ihn; die Bestätigungsmail im Protokoll
//      („fehlgeschlagen: kein Schlüssel" = sie wäre rausgegangen) trägt die
//      Termin-Platzhalter; zweiter Klick, Nacharbeit, Stundenlauf buchen NICHT
//      doppelt; kein Privat-Ablauf (keine Privat-Mail, kein Firmen-Lead, kein
//      Betreuer-Wechsel).
//   B  „Starten ab <Tag>": der erste Platz an diesem Tag.
//   C  Kein Platz (Tagesdeckel an jedem Tag): kein Termin, Grund am Angebot,
//      dringende Aufgabe an Justin, Bestätigung ohne Termin, Stundenlauf bucht NICHT.
//   D  Technischer Fehler beim ersten Versuch → Stundenlauf holt nach; die
//      Bestätigung war schon draußen → eigene Mail zum Startgespräch; Justins
//      Aufgabe schließt sich.
//   E  Absage durch den Kunden → Aufgabe an Justin, Link zu /justin, Stand „abgesagt".
//   F  Gründer-Konto ohne Zeiten → zuständige Global-Person, mit Hinweis.
//   G  Gegenprüfung recht-zeitpunkt (02.10.2026): Nach dem Termin setzt der Aufräumlauf „verpasst“ ohne Ergebnis —
//      das ist „vorbei“ (der Kunde liest NICHT „vereinbaren wir persönlich“, die Startmail NICHT „meldet sich …“);
//      erst ein eingetragenes „kam nicht zustande“ ist „persönlich“. Dazu in A/B die Erinnerung (binnen 24 h als
//      erledigt, sonst „Morgen: …“ für heute) und in D „technik“ nach drei Tagen (Stundenlauf hört auf → „persönlich“).
//   H  Gegenprüfung technik (02.10.2026): technischer Fehler → Justin bucht laut Aufgabe von Hand → der Stundenlauf
//      übernimmt den Handtermin ans Angebot statt ein zweites Startgespräch zu buchen.
//
// Aufruf (eigene Datenbank, NIE die Produktion):
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null CRONS=aus \
//     PLAYWRIGHT_BROWSERS_PATH=<Ordner mit chromium-1200> \
//     DATABASE_URL="postgresql://fiaon@127.0.0.1:54329/fiaon_e273" npx tsx scripts/pruef-angebot-startgespraech.ts
// ═══════════════════════════════════════════════════════════════════════════
import http from "node:http";
import type { AddressInfo } from "node:net";

let host = "";
try { host = new URL(String(process.env.DATABASE_URL)).hostname; } catch { /* unten */ }
if (!["127.0.0.1", "localhost"].includes(host)) { console.error("ABBRUCH: Dieser Prüfstand läuft nur gegen eine Datenbank auf 127.0.0.1/localhost."); process.exit(2); }
if (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt — bitte mit env -i starten."); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const A = await import("../server/lib/fiaon-global-angebot");
const V = await import("../server/lib/fiaon-global-angebot-vertrag");
const SG = await import("../server/lib/fiaon-global-angebot-startgespraech");
const S = await import("../shared/fiaon-global-angebot");
const ST = (await import("../shared/fiaon-global-startgespraech")).STARTGESPRAECH_TEXTE;
const { berlinUhrzeit, berlinDatum, verfuegbarkeitSetzen, terminAbsagen, berlinDatumText } = await import("../server/lib/fiaon-termine");
const { personFuerZeile } = await import("../server/fiaon-person-model");
const { absoluteUrl } = await import("../server/fiaon-base-url");
const { globalTerminProTag } = await import("../server/lib/fiaon-global-termin");

let fehler = 0; let n = 0;
const ok = (b: unknown, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}${zusatz !== undefined ? `  → ${String(typeof zusatz === "string" ? zusatz : JSON.stringify(zusatz)).slice(0, 600)}` : ""}`); } else console.log(`  ok      ${was}`); };
const titel = (t: string) => console.log(`\n── ${t}`);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bisDa = async (frage: () => Promise<boolean>, ms = 30_000) => { const ende = Date.now() + ms; while (Date.now() < ende) { if (await frage()) return true; await warte(300); } return false; };
const stempel = Date.now().toString(36);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";

// ── Die Bestellzeile: Die Annahme legt sie per Loopback auf POST /api/fiaon/application an. Ohne Server steht hier ein
// kleiner Ersatz, der dasselbe in die Tabelle schreibt (Zeile + Person) — der Rest (Teil binden, Akte, Rechnung) ist der echte Weg.
const ersatz = http.createServer(async (req, res) => {
  try {
    if (req.method !== "POST" || req.url !== "/api/fiaon/application") { res.writeHead(404); res.end(); return; }
    let roh = ""; for await (const c of req) roh += c;
    const b = JSON.parse(roh);
    const zu = await personFuerZeile({
      emails: [b.email], phones: [b.contactPhone].filter(Boolean),
      stammdaten: { kind: "private", first_name: b.firstName, last_name: b.lastName, primary_email: b.email, primary_phone: b.contactPhone },
      quelle: "pruef-startgespraech", firstSeenAt: new Date(),
    } as any);
    await sqlPool`
      INSERT INTO fiaon_applications (ref, type, status, current_step, pack_key, pack_name, first_name, last_name, email, contact_email, billing_email,
                                      contact_phone, street, zip, city, country, person_id, consent_contract, created_at, updated_at)
      VALUES (${b.ref}, 'business', 'submitted', 6, ${b.packKey}, ${b.packName}, ${b.firstName}, ${b.lastName}, ${b.email}, ${b.email}, ${b.email},
              ${b.contactPhone ?? null}, ${b.street}, ${b.zip}, ${b.city}, ${b.country}, ${zu?.personId ?? null}, true, NOW(), NOW())`;
    res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
  } catch (e) { console.error("[ERSATZ application]", e); res.writeHead(500); res.end(); }
});
await new Promise<void>((r) => ersatz.listen(0, "127.0.0.1", () => r()));
process.env.PORT = String((ersatz.address() as AddressInfo).port);

// ── Die Leute: ein Gründer-Konto (wie 928, Zeiten wie Justins) und eine zuständige Global-Person (wie Daniel) ──
await A.ensureAngebotTabellen();
const einstellungAlt = new Map<string, string | null>();
const setzen = async (key: string, value: string | null) => {
  if (!einstellungAlt.has(key)) {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`) as any[];
    einstellungAlt.set(key, r ? String(r.value) : null);
  }
  if (value === null) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${key}`;
  else await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
};
const agentAnlegen = async (vor: string, nach: string, rolle: string) => {
  const [a] = (await sqlPool`
    INSERT INTO fiaon_agents (name, first_name, last_name, email, active, rolle, is_test_account)
    VALUES (${`${vor} ${nach}`}, ${vor}, ${nach}, ${`pruef-e273-${vor.toLowerCase()}-${stempel}@pruefstand.test`}, true, ${rolle}, true) RETURNING id`) as any[];
  return Number(a.id);
};
const JUSTIN_ZEITEN = [1, 2, 3, 4].flatMap((w) => [{ wochentag: w, von: "09:00", bis: "13:00", aktiv: true }, { wochentag: w, von: "14:00", bis: "18:00", aktiv: true }])
  .concat([{ wochentag: 5, von: "09:00", bis: "20:00", aktiv: true }]);
const DANIEL_ZEITEN = [1, 2, 3, 4, 5].map((w) => ({ wochentag: w, von: "09:30", bis: "20:30", aktiv: true }));
const gruender = await agentAnlegen("Justin", "Schwarzott", "vertriebsleiter");
const zustaendig = await agentAnlegen("Daniel", `Stripling-${stempel}`, "vertriebsleiter");
await verfuegbarkeitSetzen(gruender, JUSTIN_ZEITEN);
await verfuegbarkeitSetzen(zustaendig, DANIEL_ZEITEN);
await setzen("gruender_termin_agent_id", String(gruender));
await setzen("global_zustaendig_agent_id", String(zustaendig));
await setzen("global_termin_pro_tag", null);

// ── Angebot anlegen und annehmen — wie der Kunde, mit der Prüfsumme der Seite ──
const PB: any = {
  erstellt: "02.10.2026", datenstand: "02.10.2026", pruefer: "Prüfstand E-273", aktenzeichen: "FIAON-P-E273", eigenschaft: "Privatperson (Verbraucher)",
  vorhaben: "Gründung einer US-LLC und Kapital-Begleitung", stammdaten: [{ merkmal: "Name", befund: "Prüfperson", quelle: "Antrag" }],
  sanktionen: { abruf: "02.10.2026", listen: [{ liste: "SDN List", herausgeber: "OFAC", stand: "01.10.2026", eintraege: 1, personen: 1, treffer: 0 }], verfahren: "Abgleich.", gegenprobe: "ja", quellen: [], pruefsummen: [] },
  pep: { status: "offen", text: "Selbstauskunft." }, boni: null,
  eignung: { voraussetzungen: "Volljährig.", steuer: [], haftung: "Persönliche Haftung.", mitwirkung: "Reisepass.", einordnung: "Geeignet." },
  auflagen: ["Identifizierung vor Leistungsbeginn."],
};
const BUERGIN = { ...S.BUERGIN_VORGABE, registernummer: S.BUERGIN_NUMMER_NICHT_ERFORDERLICH, funktion: "Manager", unterzeichnetAm: "2026-10-01", bestaetigt: true, bestaetigtGrundlage: "Registerauszug vom 01.10.2026" };
let ipNr = 10;
const anlegenUndAnnehmen = async (fall: string, beginn: { beginn: "sofort" } | { beginn: "datum"; startAm: string }) => {
  const email = `pruef-e273-${fall}-${stempel}@fiaon.test`;
  const erg = await A.angebotAnlegen({
    kunde: { anrede: "Herr", vorname: "Prüfperson", nachname: `Startgespräch ${fall.toUpperCase()}`, geburtsdatum: "1971-11-04", strasse: "Prüfweg 1", plz: "69251", ort: "Gaiberg", land: "DE", email, telefon: `+49 171 ${String(Date.now()).slice(-6)}${ipNr % 10}` },
    parameter: S.ANGEBOT_VORGABEN, buergin: BUERGIN, pruefbericht: PB,
  }, "Prüfstand E-273");
  if (!erg.ok) throw new Error(`anlegen ${fall}: ${erg.error}`);
  const token = decodeURIComponent(erg.link.split("/business/angebot/")[1] || "");
  const z = (await A.angebotLesen({ id: erg.id }))!;
  const s = A.schalterAus(beginn);
  const textHash = V.angebotTextHash(A.angebotDatenAus(z), s);
  const vorher = new Date();
  const r = await A.angebotAnnehmen(token, { ...beginn, jahresbetreuung: false, textHash }, { ip: `198.51.100.${ipNr++}`, userAgent: UA, leitung: false });
  return { id: erg.id, ref: erg.ref, token, email, r, vorher, schalter: s };
};
const angebot = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0];
const termineDerPerson = async (personId: number) => (await sqlPool`SELECT * FROM fiaon_termine WHERE person_id = ${personId} ORDER BY id`) as any[];
const mails = async (email: string) => (await sqlPool`SELECT event, status, grund, payload, person_id FROM fiaon_mail_log WHERE empfaenger = ${email} ORDER BY id`) as any[];
const nutzlast = (m: any) => (typeof m?.payload === "string" ? JSON.parse(m.payload) : m?.payload) ?? {};
/** Der erste freie Platz nach DERSELBEN Regel — mit dem Zeitpunkt der Buchung als „jetzt". */
const erwarteterPlatz = async (agentId: number, jetzt: Date, angenommenAm: Date, schalter: any, ohneTerminId: number | null) => {
  const fr = SG.startgespraechFruehestens({ jetzt, angenommenAm, schalter });
  const { verfuegbarkeitVon } = await import("../server/lib/fiaon-termine");
  const belegt = ((await sqlPool`SELECT id, beginn, dauer_min, quelle, status FROM fiaon_termine WHERE agent_id = ${agentId} AND (status IN ('gebucht','erledigt','verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))`) as any[])
    .filter((t) => Number(t.id) !== ohneTerminId)
    .map((t) => ({ beginn: t.beginn, dauerMin: Number(t.dauer_min), zaehltAlsGlobal: t.quelle === "global" && t.status !== "abgesagt" }));
  return SG.startgespraechZeitenRechnen({ ab: fr.ab, fenster: await verfuegbarkeitVon(agentId), belegt, proTag: await globalTerminProTag() }).frei[0] ?? null;
};
const zeileErwartet = (beginn: Date | string) => `${["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][new Date(`${berlinDatum(new Date(beginn))}T12:00:00Z`).getUTCDay()]}, ${berlinDatumText(beginn)}, ${berlinUhrzeit(beginn)} Uhr`;

// ═══ A ═════════════════════════════════════════════════════════════════════
titel("A. „Sofort starten“: Annahme bucht genau EIN Startgespräch beim Gründer, zum ersten freien Platz");
const a = await anlegenUndAnnehmen("a", { beginn: "sofort" });
ok(a.r.status === 200 && a.r.body.ok === true, "Annahme 200", a.r.body);
const az = await angebot(a.id);
const at = await termineDerPerson(Number(az.person_id));
ok(az.startgespraech_termin_id && at.length === 1, "genau ein Termin an der Person, am Angebot vermerkt", at.map((t) => t.id));
const t0 = at[0];
const soll = await erwarteterPlatz(gruender, new Date(t0.created_at), new Date(az.angenommen_am), a.schalter, Number(t0.id));
ok(Number(t0.agent_id) === gruender && t0.quelle === "global" && t0.herkunft === "individualangebot" && Number(t0.dauer_min) === 30 && t0.status === "gebucht", "Kalender des Gründers, quelle global, herkunft individualangebot, dreißig Minuten", { agent: t0.agent_id, quelle: t0.quelle, herkunft: t0.herkunft, dauer: t0.dauer_min });
ok(soll && new Date(t0.beginn).toISOString() === soll.beginn, "zum ersten freien Platz nach den Global-Regeln (Vorlauf, Raster, Mo–Fr)", { ist: new Date(t0.beginn).toISOString(), soll: soll?.beginn });
const sgA = a.r.body.startgespraech;
ok(sgA?.stand === "gebucht" && sgA.zeile === `${zeileErwartet(t0.beginn)} mit Justin Schwarzott` && /\/termin\/absagen\/[0-9a-f]{48}\?anrede=sie&bereich=business$/.test(sgA.verschiebenUrl) && /\.ics$/.test(sgA.kalenderUrl), "Antwort an die Seite: „Ihr Startgespräch: <Tag>, <Uhrzeit> Uhr mit Justin Schwarzott“ + Kalender + Verschieben", sgA);
ok(await bisDa(async () => (await mails(a.email)).some((m) => m.event === "global_angebot_angenommen")), "Bestätigungsmail im Protokoll");
const mA = (await mails(a.email)).find((m) => m.event === "global_angebot_angenommen");
const pA = nutzlast(mA);
ok(mA?.status === "fehlgeschlagen" && /BREVO_API_KEY/.test(String(mA?.grund)), "lokal „fehlgeschlagen: kein Schlüssel“ — sie wäre rausgegangen", { status: mA?.status, grund: mA?.grund });
ok(String(pA.startgespraech_html).includes(`${zeileErwartet(t0.beginn)}</b> mit <b>Justin Schwarzott</b>`) && String(pA.startgespraech_html).includes("rund dreißig Minuten") && String(pA.startgespraech_html).includes(`unter ${JSON.parse(JSON.stringify(az.kunde)).telefon}`)
  && /kalender\/[0-9a-f]{48}\.ics$/.test(pA.startgespraech_kalender_url) && /calendar\.google\.com/.test(pA.startgespraech_google_url) && /termin\/absagen\/[0-9a-f]{48}/.test(pA.startgespraech_storno_url), "Bestätigung trägt die Termin-Platzhalter (Tag, Uhrzeit, Dauer, mit wem, Telefon, Kalender, Verschieben)", Object.keys(pA).filter((k) => k.startsWith("startgespraech")));
// In der Produktion ist die Bestätigung mit dem Termin jetzt draußen (lokal scheitert sie mangels Schlüssel und würde
// bei jeder Nacharbeit nachgeholt — so ist sie gebaut). So tun, als wäre sie zugestellt:
await sqlPool`UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), bestaetigung_mail_fehler = NULL, startgespraech_mail_am = NOW() WHERE id = ${a.id}`;
// Zweiter Klick, Nacharbeit, Stundenlauf, Buchen direkt: nichts doppelt.
const a2 = await A.angebotAnnehmen(a.token, { beginn: "sofort", jahresbetreuung: false, textHash: "egal" }, { ip: "198.51.100.200", userAgent: UA, leitung: false });
await A.angebotNacharbeit(a.id);
const direkt = await SG.angebotStartgespraechBuchen(a.id);
const lauf = await A.globalAngebotLauf();
ok(a2.status === 200 && a2.body.schon === true && a2.body.startgespraech?.zeile === sgA.zeile, "zweiter Klick: dieselbe Antwort mit demselben Termin");
ok(direkt.status === "schon" && (await termineDerPerson(Number(az.person_id))).length === 1 && lauf.startgespraeche === 0, "zweiter Lauf (Nacharbeit, Buchen, Stundenlauf) bucht nicht doppelt", { direkt, lauf });
ok((await mails(a.email)).filter((m) => m.event === "global_angebot_angenommen").length === 1 && !(await mails(a.email)).some((m) => m.event === "global_angebot_startgespraech"), "Bestätigungsmail höchstens einmal, keine zweite Mail zum Startgespräch");
// Kein Privat-Ablauf.
const evA = Array.from(new Set((await mails(a.email)).map((m) => m.event)));
ok(evA.every((e) => e.startsWith("global_angebot_")), "keine Privat-Mail (keine Terminbestätigung/Einladung/„verpasst“/Erstgespräch-Mail) an den Kunden", evA);
const [fl] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_firmen_leads WHERE person_id = ${Number(az.person_id)}`.catch(() => [{ n: 0 }])) as any[];
const [pers] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${Number(az.person_id)}`) as any[];
ok(Number(fl?.n ?? 0) === 0 && Number(pers?.assigned_agent_id ?? 0) !== gruender, "kein Firmen-Lead, kein Betreuer-Wechsel zum Gründer (kein buchungAnwenden)", { leads: fl?.n, betreuer: pers?.assigned_agent_id });
const [vers] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_termin_versuche WHERE agent_id = ${gruender} AND ergebnis = 'gebucht' AND quelle = 'global'`) as any[];
ok(Number(vers.n) >= 1, "Versuch protokolliert (fiaon_termin_versuche)");
const [aufgT] = (await sqlPool`SELECT titel, status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-termin:${t0.id}`}`) as any[];
const [aufgJ] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${az.auftrag_ref}:angebot-justin`}`) as any[];
ok(aufgT && /Startgespräch/.test(aufgT.titel) && aufgT.status === "offen", "Aufgabe zum Termin (Schlüssel global-termin:<id> — schließt sich mit Ergebnis/Absage)", aufgT);
ok(aufgJ && /STARTGESPRÄCH: vom System gebucht/.test(aufgJ.text), "Justins Aufgabe zur Annahme nennt das Startgespräch", aufgJ?.text?.slice(0, 300));
const liste = (await A.angebotListe()).find((x: any) => x.id === a.id) as any;
ok(liste?.startgespraech?.stand === "gebucht" && liste.startgespraech.zeile === sgA.zeile && !!liste.startgespraech.mailAm, "Chefbüro-Liste: Termin + „Kunde informiert“", liste?.startgespraech);
const akte = await A.angebotSichtZurAkte(String(az.auftrag_ref));
ok((akte as any)?.startgespraech?.zeile === sgA.zeile, "„Mein Auftrag“ zeigt das Startgespräch", (akte as any)?.startgespraech);
// Gegenprüfung recht-zeitpunkt (02.10.2026): Die Terminerinnerung (runTerminErinnerungen, alle 20 Minuten) nimmt jeden
// Termin der nächsten 24 Stunden ohne erinnert_am — Betreff „Morgen: Ihr Gespräch um …“. Liegt das Startgespräch binnen
// 24 Stunden, ist sie als erledigt markiert (Tag und Uhrzeit stehen in der Bestätigung); sonst bleibt sie offen.
{
  const kurz = new Date(t0.beginn).getTime() - new Date(t0.created_at).getTime() < 24 * 3_600_000;
  const [faellig] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
     WHERE id = ${t0.id} AND status = 'gebucht' AND erinnert_am IS NULL AND beginn BETWEEN NOW() AND NOW() + INTERVAL '24 hours'`) as any[];
  ok(kurz ? (!!t0.erinnert_am && Number(faellig.n) === 0) : !t0.erinnert_am,
    kurz ? "Erinnerung: Gespräch binnen 24 Stunden → als erledigt markiert, kein „Morgen: …“ für ein Gespräch von heute" : "Erinnerung: Gespräch später als 24 Stunden → bleibt offen (kommt 24 Stunden vorher)",
    { beginn: t0.beginn, gebucht: t0.created_at, erinnert: t0.erinnert_am });
}

// ═══ B ═════════════════════════════════════════════════════════════════════
titel("B. „Starten ab <Tag>“: der erste Platz an diesem Tag");
const heute = berlinDatum(new Date());
let startTag = (() => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 10); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
const b = await anlegenUndAnnehmen("b", { beginn: "datum", startAm: startTag });
const bz = await angebot(b.id); const bt = (await termineDerPerson(Number(bz.person_id)))[0];
ok(b.r.status === 200 && bt && berlinDatum(new Date(bt.beginn)) === startTag && berlinUhrzeit(bt.beginn) === "09:00" && b.r.body.startgespraech?.zeile?.startsWith(zeileErwartet(bt.beginn)), "Termin am gewählten Starttag, 09:00 (erster Platz des Tages)", { startTag, ist: bt ? `${berlinDatum(new Date(bt.beginn))} ${berlinUhrzeit(bt.beginn)}` : null });
ok(bt && !bt.erinnert_am, "„Starten ab“ in zehn Tagen: Erinnerung bleibt offen (24 Stunden vorher, wie bei jedem Termin)", bt?.erinnert_am);

// ═══ C ═════════════════════════════════════════════════════════════════════
titel("C. Kein Platz (Tagesdeckel an jedem Tag): kein Termin, Aufgabe an Justin, Bestätigung ohne Termin");
await setzen("global_termin_pro_tag", "1");
const [platzhalter] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name) VALUES (${`P-E273-${stempel}`}, 'Belegt', 'Prüfstand') RETURNING id`) as any[];
const belegIds: number[] = [];
for (let i = 0; i <= 17; i++) {
  const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
  const tag = d.toISOString().slice(0, 10);
  const [r] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, notiz)
    VALUES (${Number(platzhalter.id)}, ${gruender}, ${new Date(`${tag}T17:30:00+02:00`)}, 30, 'gebucht', 'global', ${`${stempel}${i}`.padEnd(48, "0").slice(0, 48)}, 'Prüfstand E-273: Tagesdeckel')
    ON CONFLICT DO NOTHING RETURNING id`.catch(() => [])) as any[];
  if (r) belegIds.push(Number(r.id));
}
const c = await anlegenUndAnnehmen("c", { beginn: "sofort" });
const cz = await angebot(c.id);
ok(c.r.status === 200 && (await termineDerPerson(Number(cz.person_id))).length === 0 && String(cz.startgespraech_fehler).startsWith("kein_platz"), "kein Termin, Grund „kein_platz“ am Angebot", cz.startgespraech_fehler);
ok(c.r.body.startgespraech?.stand === "persoenlich" && c.r.body.startgespraech?.satz === ST.persoenlich && !c.r.body.startgespraech?.zeile, "Seite: ehrlicher Satz statt Termin", c.r.body.startgespraech);
const [aufgC] = (await sqlPool`SELECT titel, prioritaet, status FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${cz.auftrag_ref}:startgespraech`}`) as any[];
ok(aufgC && /Startgespräch von Hand buchen/.test(aufgC.titel) && Number(aufgC.prioritaet) === 1, "dringende Aufgabe an Justin „Startgespräch von Hand buchen“", aufgC);
ok(await bisDa(async () => (await mails(c.email)).some((m) => m.event === "global_angebot_angenommen")), "Bestätigungsmail im Protokoll");
const pC = nutzlast((await mails(c.email)).find((m) => m.event === "global_angebot_angenommen"));
ok(!("startgespraech_html" in pC) && !("startgespraech_kalender_url" in pC), "Bestätigung ohne Termin-Platzhalter (der bisherige Wortlaut)", Object.keys(pC).filter((k) => k.startsWith("startgespraech")));
await A.globalAngebotLauf(new Date(Date.now() + 31 * 60_000));
ok((await termineDerPerson(Number(cz.person_id))).length === 0, "Stundenlauf holt „kein Platz“ NICHT nach (Justin bucht von Hand)");
await sqlPool`DELETE FROM fiaon_termine WHERE id = ANY(${belegIds})`;
await setzen("global_termin_pro_tag", null);

// ═══ D ═════════════════════════════════════════════════════════════════════
titel("D. Technischer Fehler beim ersten Versuch → Stundenlauf holt nach, eigene Mail mit Tag und Uhrzeit");
await sqlPool.unsafe(`CREATE TABLE IF NOT EXISTS pruef_e273_sperre (an BOOLEAN)`);
await sqlPool.unsafe(`INSERT INTO pruef_e273_sperre VALUES (TRUE)`);
await sqlPool.unsafe(`CREATE OR REPLACE FUNCTION pruef_e273_sperre_fn() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF EXISTS (SELECT 1 FROM pruef_e273_sperre) THEN RAISE EXCEPTION 'Prüfstand E-273: Termintabelle gesperrt'; END IF; RETURN NEW; END $f$`);
await sqlPool.unsafe(`DROP TRIGGER IF EXISTS pruef_e273_sperre_trg ON fiaon_termine`);
await sqlPool.unsafe(`CREATE TRIGGER pruef_e273_sperre_trg BEFORE INSERT ON fiaon_termine FOR EACH ROW EXECUTE FUNCTION pruef_e273_sperre_fn()`);
const dd = await anlegenUndAnnehmen("d", { beginn: "sofort" });
await bisDa(async () => (await mails(dd.email)).some((m) => m.event === "global_angebot_angenommen"));
const dz1 = await angebot(dd.id);
ok(dd.r.status === 200 && !dz1.startgespraech_termin_id && String(dz1.startgespraech_fehler).startsWith("technik:") && dd.r.body.startgespraech?.stand === "folgt", "erster Versuch technisch gescheitert: kein Termin, „technik:“ am Angebot, Seite „wird eingetragen“", { fehler: dz1.startgespraech_fehler, sg: dd.r.body.startgespraech });
const [aufgD1] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${dz1.auftrag_ref}:startgespraech`}`) as any[];
ok(aufgD1?.status === "offen", "Aufgabe an Justin offen");
// Gegenprüfung recht-zeitpunkt (02.10.2026): Der Stundenlauf holt „technik“ nur drei Tage nach der Annahme nach. Danach
// verspricht die Seite keine Mail mehr („tragen wir gerade ein …“), sondern sagt „vereinbaren wir persönlich“ — Justin
// hat die Aufgabe. Und der Lauf bucht dann wirklich nicht mehr.
const spaetD = new Date(Date.now() + (SG.STARTGESPRAECH_NACHHOLEN_TAGE * 24 + 1) * 3_600_000);
const stD0 = await SG.startgespraechStand(dd.id); const stD3 = await SG.startgespraechStand(dd.id, spaetD);
ok(stD0.stand === "folgt" && stD3.stand === "persoenlich" && stD3.satz === ST.persoenlich && SG.startgespraechFuerKunde(stD3)?.satz === ST.persoenlich,
  "„technik“: drei Tage lang „wird eingetragen“, danach „vereinbaren wir persönlich“ (keine Mail mehr versprochen)", { jetzt: stD0.stand, nachDreiTagen: stD3.stand });
await sqlPool.unsafe(`DELETE FROM pruef_e273_sperre`);
const laufSpaet = await A.globalAngebotLauf(spaetD);
ok(laufSpaet.startgespraeche === 0 && (await termineDerPerson(Number(dz1.person_id))).length === 0, "Stundenlauf nach drei Tagen bucht nicht mehr nach — passt zum Satz der Seite", laufSpaet.startgespraeche);
// In der Produktion ist die Bestätigung längst draußen (hier scheitert sie mangels Schlüssel) — so tun, als wäre sie es.
await sqlPool`UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), bestaetigung_mail_fehler = NULL WHERE id = ${dd.id}`;
const laufD = await A.globalAngebotLauf(new Date(Date.now() + 31 * 60_000));
const dz2 = await angebot(dd.id); const dt = await termineDerPerson(Number(dz2.person_id));
ok(laufD.startgespraeche === 1 && dt.length === 1 && Number(dz2.startgespraech_termin_id) === Number(dt[0].id) && !dz2.startgespraech_fehler, "Stundenlauf hat nachgebucht — genau ein Termin", { lauf: laufD.startgespraeche, termine: dt.length });
ok(await bisDa(async () => (await mails(dd.email)).some((m) => m.event === "global_angebot_startgespraech")), "eigene Mail „Ihr Startgespräch steht“ im Protokoll (Bestätigung war schon draußen)");
const pD = nutzlast((await mails(dd.email)).find((m) => m.event === "global_angebot_startgespraech"));
ok(String(pD.startgespraech_datum_text) === zeileErwartet(dt[0].beginn).replace(/, \d{2}:\d{2} Uhr$/, "") && pD.startgespraech_uhrzeit === berlinUhrzeit(dt[0].beginn) && /Justin Schwarzott/.test(pD.startgespraech_mit), "Mail zum Startgespräch: Datum, Uhrzeit, mit wem", { d: pD.startgespraech_datum_text, u: pD.startgespraech_uhrzeit });
const [aufgD2] = (await sqlPool`SELECT status, ergebnis FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${dz2.auftrag_ref}:startgespraech`}`) as any[];
ok(aufgD2?.status === "erledigt" && /nachgebucht/.test(String(aufgD2.ergebnis)), "Justins Aufgabe schließt sich mit „Vom System nachgebucht“", aufgD2);
// Lokal scheitert die Mail (kein Schlüssel) — der nächste Stundenlauf versucht sie erneut; ist sie draußen, nie wieder.
await A.globalAngebotLauf(new Date(Date.now() + 62 * 60_000));
ok((await mails(dd.email)).filter((m) => m.event === "global_angebot_startgespraech").length === 2 && (await termineDerPerson(Number(dz2.person_id))).length === 1, "nächster Stundenlauf: gescheiterte Mail wird nachgeholt, kein zweiter Termin");
await sqlPool`UPDATE fiaon_global_angebote SET startgespraech_mail_am = NOW() WHERE id = ${dd.id}`; // so, als wäre sie zugestellt
await A.globalAngebotLauf(new Date(Date.now() + 93 * 60_000));
ok((await mails(dd.email)).filter((m) => m.event === "global_angebot_startgespraech").length === 2 && (await termineDerPerson(Number(dz2.person_id))).length === 1, "zugestellt: keine weitere Mail, kein zweiter Termin");
await sqlPool.unsafe(`DROP TRIGGER IF EXISTS pruef_e273_sperre_trg ON fiaon_termine`);
await sqlPool.unsafe(`DROP FUNCTION IF EXISTS pruef_e273_sperre_fn()`);
await sqlPool.unsafe(`DROP TABLE IF EXISTS pruef_e273_sperre`);

// ═══ E ═════════════════════════════════════════════════════════════════════
titel("E. Absage durch den Kunden → Justin erfährt es, „Neuen Termin wählen“ führt zu /justin");
const link = await SG.startgespraechNeuBuchenLink(Number(t0.id));
ok(!!link && link.startsWith(absoluteUrl("/justin?k=")), "Link nach der Absage: Justins Buchungsseite mit den Daten des Kunden", link);
const weg = await terminAbsagen(String(t0.storno_token), "kunde");
ok(weg.ok, "Absage über den Storno-Link");
ok(await bisDa(async () => ((await sqlPool`SELECT 1 FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${az.auftrag_ref}:startgespraech-absage:${t0.id}`}`) as any[]).length === 1), "dringende Aufgabe „Startgespräch abgesagt — neuen Termin vereinbaren“");
ok(await bisDa(async () => ((await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-termin:${t0.id}`}`) as any[])[0]?.status === "erledigt"), "die Aufgabe zum Termin ist geschlossen");
const stE = await SG.startgespraechStand(a.id);
ok(stE.stand === "abgesagt" && stE.satz === ST.abgesagt, "Stand „abgesagt“ — Seite und „Mein Auftrag“ sagen es ehrlich", stE.stand);

// ═══ F ═════════════════════════════════════════════════════════════════════
titel("F. Gründer-Konto ohne Zeiten → zuständige Global-Person, mit Hinweis im Verlauf");
await verfuegbarkeitSetzen(gruender, []);
const f = await anlegenUndAnnehmen("f", { beginn: "sofort" });
const fz = await angebot(f.id); const ft = (await termineDerPerson(Number(fz.person_id)))[0];
const verlaufF = (typeof fz.verlauf === "string" ? JSON.parse(fz.verlauf) : fz.verlauf) as any[];
ok(ft && Number(ft.agent_id) === zustaendig && f.r.body.startgespraech?.zeile?.endsWith(`mit Daniel Stripling-${stempel}`), "Termin bei der zuständigen Global-Person; die Seite nennt ihren Namen", { agent: ft?.agent_id, zeile: f.r.body.startgespraech?.zeile });
ok(verlaufF.some((v) => /Die Angebotsseite nennt Justin Schwarzott als Gesprächspartner; gebucht ist/.test(String(v.was))), "Hinweis im Verlauf: die Seite nennt Justin, gebucht ist die zuständige Person");
await verfuegbarkeitSetzen(gruender, JUSTIN_ZEITEN);

// ═══ G ═════════════════════════════════════════════════════════════════════
titel("G. Nach dem Termin: Aufräumlauf („verpasst“ ohne Ergebnis) ist „vorbei“ — erst „kam nicht zustande“ ist „persönlich“");
// Das Gespräch aus B liegt jetzt dreizehn Stunden zurück, niemand hat es im Kalender abgeschlossen (z. B. geführt, aber
// nicht abgehakt). Der echte Aufräumlauf (runVerpassteTermine, im 20-Minuten-Takt) setzt dann „verpasst“ OHNE erledigt_am.
await sqlPool`UPDATE fiaon_termine SET beginn = NOW() - INTERVAL '13 hours' WHERE id = ${bt.id}`;
const { runVerpassteTermine } = await import("../server/routes/fiaon-startgespraech");
await runVerpassteTermine();
const [btV] = (await sqlPool`SELECT status, erledigt_am FROM fiaon_termine WHERE id = ${bt.id}`) as any[];
const stG = await SG.startgespraechStand(b.id);
ok(btV?.status === "verpasst" && !btV.erledigt_am && stG.stand === "vorbei" && SG.startgespraechFuerKunde(stG) === null && SG.startgespraechStartSatz(stG) === ST.mailStartVorbei,
  "Aufräumlauf: „vorbei“ — Seite und „Mein Auftrag“ ohne „vereinbaren wir persönlich“, Startmail ohne „meldet sich … zu vereinbaren“", { termin: btV, stand: stG.stand });
const listeG = (await A.angebotListe()).find((x: any) => x.id === b.id) as any;
ok(listeG?.startgespraech?.stand === "vorbei", "Chefbüro: „Zeit vorbei — im Kalender abschließen“ (der Kalender führt ihn weiter als offen)", listeG?.startgespraech?.stand);
const { globalTerminErgebnis } = await import("../server/lib/fiaon-global-termin");
await globalTerminErgebnis({ terminId: Number(bt.id), personId: Number(bz.person_id), beginn: new Date(Date.now() - 13 * 3_600_000), agent: { id: gruender, name: "Justin Schwarzott" }, ergebnis: "verpasst", grund: "nicht_erschienen" });
const stG2 = await SG.startgespraechStand(b.id);
ok(stG2.stand === "persoenlich" && stG2.terminStatus === "verpasst" && stG2.satz === ST.persoenlich && SG.startgespraechStartSatz(stG2) === ST.mailStartOhne,
  "„kam nicht zustande“ (vom Menschen eingetragen): „vereinbaren wir persönlich“", { stand: stG2.stand, status: stG2.terminStatus });

// ═══ H ═════════════════════════════════════════════════════════════════════
// Gegenprüfung E-273 (technik, 02.10.2026): Justins Aufgabe „noch nicht gebucht“ sagt „sonst bitte von Hand …“. Bucht er
// von Hand und heilt danach der technische Fehler, buchte der Stundenlauf vorher ein ZWEITES Startgespräch (und schickte
// „Ihr Startgespräch steht“ mit der zweiten Zeit). Jetzt übernimmt er den Handtermin.
titel("H. Technischer Fehler → Justin bucht von Hand → Stundenlauf übernimmt den Handtermin, kein zweiter");
await sqlPool.unsafe(`CREATE TABLE IF NOT EXISTS pruef_e273h_sperre (an BOOLEAN)`);
await sqlPool.unsafe(`INSERT INTO pruef_e273h_sperre VALUES (TRUE)`);
await sqlPool.unsafe(`CREATE OR REPLACE FUNCTION pruef_e273h_sperre_fn() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF EXISTS (SELECT 1 FROM pruef_e273h_sperre) THEN RAISE EXCEPTION 'Prüfstand E-273 H: Termintabelle gesperrt'; END IF; RETURN NEW; END $f$`);
await sqlPool.unsafe(`DROP TRIGGER IF EXISTS pruef_e273h_sperre_trg ON fiaon_termine`);
await sqlPool.unsafe(`CREATE TRIGGER pruef_e273h_sperre_trg BEFORE INSERT ON fiaon_termine FOR EACH ROW EXECUTE FUNCTION pruef_e273h_sperre_fn()`);
const h = await anlegenUndAnnehmen("h", { beginn: "sofort" });
await bisDa(async () => (await mails(h.email)).some((m) => m.event === "global_angebot_angenommen"));
const hz1 = await angebot(h.id);
ok(String(hz1.startgespraech_fehler).startsWith("technik:") && !hz1.startgespraech_termin_id, "Vorbedingung: technisch gescheitert, kein Termin", hz1.startgespraech_fehler);
await sqlPool.unsafe(`DELETE FROM pruef_e273h_sperre`);
const { terminBuchen: handBuchen } = await import("../server/lib/fiaon-termine");
const handTag = (() => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 3); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
const hand = await handBuchen({ personId: Number(hz1.person_id), agentId: gruender, beginn: `${handTag}T10:00`, quelle: "agent_manuell", herkunft: "agent" });
await sqlPool`UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), bestaetigung_mail_fehler = NULL, startgespraech_versuch_am = NOW() - INTERVAL '40 minutes' WHERE id = ${h.id}`;
const laufH = await A.globalAngebotLauf(new Date(Date.now() + 31 * 60_000));
const hz2 = await angebot(h.id);
const htGebucht = (await termineDerPerson(Number(hz2.person_id))).filter((t) => t.status === "gebucht");
ok(laufH.startgespraeche === 0 && htGebucht.length === 1 && Number(hz2.startgespraech_termin_id) === Number(hand.id) && !hz2.startgespraech_fehler,
  "genau EIN Termin: der Handtermin hängt am Angebot, das System bucht keinen zweiten", { lauf: laufH.startgespraeche, termine: htGebucht.map((t) => t.id), amAngebot: hz2.startgespraech_termin_id, hand: hand.id });
const mH = (await mails(h.email)).filter((m) => m.event === "global_angebot_startgespraech");
ok(mH.every((m) => nutzlast(m).startgespraech_uhrzeit === hand.uhrzeit), "eine Mail „Ihr Startgespräch steht“ nennt höchstens den Handtermin", mH.map((m) => nutzlast(m).startgespraech_uhrzeit));
const [aufgH] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${hz2.auftrag_ref}:startgespraech`}`) as any[];
const stH = await SG.startgespraechStand(h.id);
ok(aufgH?.status === "erledigt" && stH.stand === "gebucht" && stH.termin?.terminId === Number(hand.id), "Justins Aufgabe geschlossen, Seite zeigt den Handtermin", { aufgabe: aufgH?.status, stand: stH.stand });
await sqlPool.unsafe(`DROP TRIGGER IF EXISTS pruef_e273h_sperre_trg ON fiaon_termine`);
await sqlPool.unsafe(`DROP FUNCTION IF EXISTS pruef_e273h_sperre_fn()`);
await sqlPool.unsafe(`DROP TABLE IF EXISTS pruef_e273h_sperre`);

// ═══ I ═════════════════════════════════════════════════════════════════════
// Abschlussprüfung 02.10.2026: Wird der Auftrag storniert (Widerruf, Kündigung), sagt globalAuftragStornieren das
// automatisch gebuchte Startgespräch STILL ab — sonst ginge 24 h vorher die Erinnerung raus, und terminAbsagen
// schickte eine Absage mit „neu buchen“.
titel("I. Storno des Auftrags sagt das Startgespräch still ab");
const i = await anlegenUndAnnehmen("i", { beginn: "sofort" });
await bisDa(async () => !!(await angebot(i.id))?.startgespraech_termin_id);
const iz = await angebot(i.id);
const iTermin = Number(iz.startgespraech_termin_id);
await bisDa(async () => (await mails(i.email)).some((m) => m.event === "global_angebot_angenommen"));
const iMailsVorher = (await mails(i.email)).length;
const { globalAuftragStornieren } = await import("../server/lib/fiaon-global-storno");
const iSt = await globalAuftragStornieren(String(iz.auftrag_ref), { grund: "Prüfstand E-273: Widerruf des Kunden", erstattung: false }, "Prüfstand E-273");
const [iT] = (await sqlPool`SELECT status, abgesagt_von FROM fiaon_termine WHERE id = ${iTermin}`) as any[];
ok(iSt.ok === true, "Storno gelingt", iSt);
ok(iT?.status === "abgesagt" && iT.abgesagt_von === "Prüfstand E-273", "Startgespräch abgesagt (von: der Storno)", iT);
await warte(1500);
ok((await mails(i.email)).length === iMailsVorher, "keine Mail an den Kunden durch die Absage", (await mails(i.email)).slice(iMailsVorher).map((m) => m.event));
const [iV] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${String(iz.auftrag_ref)} AND note LIKE ${"%Startgespräch am %abgesagt (ohne Mail an den Kunden)%"}`) as any[];
ok(Number(iV?.n) >= 1, "Verlauf nennt die Absage", iV);

// ── Aufräumen: Einstellungen zurück, Ersatz-Server zu ──
for (const [k, v] of einstellungAlt) await setzen(k, v);
ersatz.close();
console.log(`\n${n - fehler} von ${n} Prüfungen grün.`);
console.log(fehler ? `✗ ${fehler} von ${n} Prüfungen rot` : `✓ alle ${n} Prüfungen grün`);
await warte(1500);
await sqlPool.end({ timeout: 5 }).catch(() => {});
process.exit(fehler ? 1 : 0);
