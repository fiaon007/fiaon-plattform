// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KEIN GLOBAL-GESPRÄCH GEHT MEHR VERLOREN (29.10.2026, E-458 Nr. 11)
//
// TEIL A — REIN (keine Datenbank, kein Netz): die Zeitregeln an allen Kanten
// (Zeitumstellung, Wochenende, späte Buchung), die drei Mails DE und EN über den
// echten Motor (mailRendern) mit dem freigegebenen Wortlaut, die Wortwand, die
// Anmeldung im Mailwerk und die Wände im Quelltext (Privat-Erinnerung und
// 12-Stunden-Lauf lassen Global aus, Lauf registriert, Kalender und Chefbüro).
//
// TEIL B — ECHT gegen eine LOKALE Kopie (nur mit PRUEF_DB auf 127.0.0.1:54329,
// Datenbankname mit „pruefstand“): der Lauf mit gestellter Uhr — Vortag, eine
// Stunde vorher, „Ergebnis fehlt“ (Daniel / Vertretung bei Abwesenheit), Leitung
// am nächsten Werktag um 9, „nicht erreicht“ genau einmal, Verschieben setzt
// alles zurück, Firmenangebot ohne Mail, 12-Stunden-Lauf und Privat-Erinnerung
// lassen Global stehen. Brevo ist eine Attrappe im Prozess (fetch abgefangen):
// Keine Mail verlässt den Rechner, jede gerenderte Mail wird geprüft.
//
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-global-gespraech-e458.ts
//   … mit PRUEF_DB=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e458g für Teil B
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const PRUEF_DB = process.env.PRUEF_DB ?? "";
const mitDb = /^postgres(ql)?:\/\/[^@]+@127\.0\.0\.1:54329\/[a-z0-9_]*pruefstand[a-z0-9_]*$/.test(PRUEF_DB);
if (PRUEF_DB && !mitDb) { console.error("PRUEF_DB muss eine lokale Prüfstand-Datenbank sein (127.0.0.1:54329, Name mit „pruefstand“)."); process.exit(2); }
// Vor JEDEM Laden eines Server-Moduls: nie die Produktion, nie ein echter Schlüssel.
process.env.DATABASE_URL = mitDb ? PRUEF_DB : "postgresql://pruef@127.0.0.1:9/keine";
process.env.DATABASE_URL_EXTERN = process.env.DATABASE_URL;
process.env.CRONS = "aus";
process.env.MAKE_WEBHOOK_URL = "";
process.env.BREVO_API_KEY = mitDb ? "pruefstand-attrappe" : "";

// ── Brevo-Attrappe: jede Mail wird abgefangen, nichts geht ins Netz ──────────
type Gefangen = { an: string; betreff: string; html: string; text: string };
const gefangen: Gefangen[] = [];
const echtesFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.startsWith("https://api.brevo.com/v3/smtp/email")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    gefangen.push({ an: String(b?.to?.[0]?.email ?? ""), betreff: String(b?.subject ?? ""), html: String(b?.htmlContent ?? ""), text: String(b?.textContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<pruef-${gefangen.length}@fiaon>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  throw new Error(`Prüfstand: Netz gesperrt (${u.slice(0, 80)})`);
}) as typeof fetch;
void echtesFetch;

let gut = 0; let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const quelle = (p: string) => fs.readFileSync(path.join(WURZEL, p), "utf8");

const R = await import("../server/lib/fiaon-global-gespraech-regeln");
const { berlinZeitpunkt, berlinDatum } = await import("../server/lib/fiaon-time");
const B = (tag: string, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return berlinZeitpunkt(tag, h * 60 + m); };

// ═══════════════════════════════════════════════════════════════════════════
titel("A1 · Vortag: 24 Stunden vorher, nur wenn „morgen“ stimmt");
// ═══════════════════════════════════════════════════════════════════════════
{
  const beginn = B("2026-11-12", "10:30"); // Donnerstag
  ok("warten: 25 Stunden vorher", R.vortagFaellig({ jetzt: B("2026-11-11", "09:30"), beginn, gebuchtAm: B("2026-11-06", "12:00") }) === "warten");
  ok("senden: Mi 10:40 für Do 10:30 (am Vortag, nach 24 h vorher)", R.vortagFaellig({ jetzt: B("2026-11-11", "10:40"), beginn, gebuchtAm: B("2026-11-06", "12:00") }) === "senden");
  ok("verfallen: am Vortag gebucht — die Bestätigung ist frisch", R.vortagFaellig({ jetzt: B("2026-11-11", "10:40"), beginn, gebuchtAm: B("2026-11-11", "08:00") }) === "verfallen");
  ok("verfallen: am Gesprächstag gebucht", R.vortagFaellig({ jetzt: B("2026-11-12", "08:00"), beginn, gebuchtAm: B("2026-11-12", "07:00") }) === "verfallen");
  ok("verfallen: Lauf stand bis nach Mitternacht — „morgen“ stimmt nicht mehr", R.vortagFaellig({ jetzt: B("2026-11-12", "00:20"), beginn, gebuchtAm: B("2026-11-06", "12:00") }) === "verfallen");
  ok("verfallen: nicht ab 21 Uhr", R.vortagFaellig({ jetzt: B("2026-11-11", "21:05"), beginn, gebuchtAm: B("2026-11-06", "12:00") }) === "verfallen");
  // Zeitumstellung: Mo 26.10.2026 09:00 (Winterzeit), Vortag So 25.10. 09:00 — 25 Stunden-Nacht dazwischen.
  const mo = B("2026-10-26", "09:00");
  ok("Zeitumstellung: So 25.10. 09:05 für Mo 26.10. 09:00 → senden", R.vortagFaellig({ jetzt: B("2026-10-25", "09:05"), beginn: mo, gebuchtAm: B("2026-10-20", "12:00") }) === "senden");
  ok("Zeitumstellung: So 25.10. 08:30 → warten", R.vortagFaellig({ jetzt: B("2026-10-25", "08:30"), beginn: mo, gebuchtAm: B("2026-10-20", "12:00") }) === "warten");
}

// ═══════════════════════════════════════════════════════════════════════════
titel("A2 · Eine Stunde vorher");
// ═══════════════════════════════════════════════════════════════════════════
{
  const beginn = B("2026-11-12", "10:30");
  const gebucht = B("2026-11-09", "12:00");
  ok("warten: 61 Minuten vorher", R.kurzFaellig({ jetzt: new Date(beginn.getTime() - 61 * 60_000), beginn, gebuchtAm: gebucht }) === "warten");
  ok("senden: 55 Minuten vorher", R.kurzFaellig({ jetzt: new Date(beginn.getTime() - 55 * 60_000), beginn, gebuchtAm: gebucht }) === "senden");
  ok("senden: genau 60 Minuten vorher", R.kurzFaellig({ jetzt: new Date(beginn.getTime() - 60 * 60_000), beginn, gebuchtAm: gebucht }) === "senden");
  ok("verfallen: 9 Minuten vorher", R.kurzFaellig({ jetzt: new Date(beginn.getTime() - 9 * 60_000), beginn, gebuchtAm: gebucht }) === "verfallen");
  ok("verfallen: erst 80 Minuten vorher gebucht", R.kurzFaellig({ jetzt: new Date(beginn.getTime() - 50 * 60_000), beginn, gebuchtAm: new Date(beginn.getTime() - 80 * 60_000) }) === "verfallen");
}

// ═══════════════════════════════════════════════════════════════════════════
titel("A3 · Ergebnis-Pflicht und Leitung");
// ═══════════════════════════════════════════════════════════════════════════
{
  const beginn = B("2026-11-12", "10:00");
  ok("Ergebnis: 10:59 noch nicht (30 Min. Gespräch + 30 Min.)", !R.ergebnisFaellig({ jetzt: B("2026-11-12", "10:59"), beginn, dauerMin: 30 }));
  ok("Ergebnis: 11:00 fällig", R.ergebnisFaellig({ jetzt: B("2026-11-12", "11:00"), beginn, dauerMin: 30 }));
  ok("Ergebnis: ohne Dauer gilt 30", R.ergebnisFaellig({ jetzt: B("2026-11-12", "11:00"), beginn, dauerMin: 0 }));
  ok("Leitung: Do-Gespräch → Fr 09:00", R.leitungAb(beginn).getTime() === B("2026-11-13", "09:00").getTime());
  ok("Leitung: Fr-Gespräch → Mo 09:00 (Wochenende übersprungen)", R.leitungAb(B("2026-11-13", "16:00")).getTime() === B("2026-11-16", "09:00").getTime());
  ok("Leitung: Fr 23.10. → Mo 26.10. 09:00 Winterzeit = 08:00 UTC", R.leitungAb(B("2026-10-23", "15:00")).toISOString() === "2026-10-26T08:00:00.000Z");
  ok("nächster Werktag nach Sa 14.11. = Mo 16.11.", R.naechsterWerktag("2026-11-14") === "2026-11-16");
}

// ═══════════════════════════════════════════════════════════════════════════
titel("A4 · Anrede, Datum, „heute“ oder Datum");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("Frau + Nachname", R.gespraechAnrede({ anrede: "Frau", vorname: "Maria", nachname: "Beispiel" }, "de") === "Guten Tag Frau Beispiel");
  ok("neutral → voller Name", R.gespraechAnrede({ anrede: "neutral", vorname: "Kim", nachname: "Beispiel" }, "de") === "Guten Tag Kim Beispiel");
  ok("ohne alles → „Guten Tag“", R.gespraechAnrede({}, "de") === "Guten Tag");
  ok("EN Herr → Mr", R.gespraechAnrede({ anrede: "Herr", nachname: "Muster" }, "en") === "Dear Mr Muster");
  const b = B("2026-11-12", "10:30");
  ok("nicht erreicht am selben Tag → „heute um 10:30 Uhr“", R.nichtErreichtWann(b, B("2026-11-12", "11:15"), "de").satz === "heute um 10:30 Uhr");
  ok("am nächsten Tag → Datum statt „heute“", R.nichtErreichtWann(b, B("2026-11-13", "09:00"), "de").satz === "am 12.11.2026 um 10:30 Uhr");
  ok("EN: today at 10:30 (German time)", R.nichtErreichtWann(b, B("2026-11-12", "11:15"), "en").satz === "today at 10:30 (German time)");
  ok("Uhrzeit Berlin über die Zeitumstellung: Mo 26.10. 09:00", R.gespraechUhrzeit(B("2026-10-26", "09:00")) === "09:00");
}

// ═══════════════════════════════════════════════════════════════════════════
titel("A5 · Die drei Mails über den echten Motor — freigegebener Wortlaut, DE und EN");
// ═══════════════════════════════════════════════════════════════════════════
const { mailRendern, hatVorlage, absenderFuer } = await import("../server/mail/motor");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const G = await import("../server/lib/fiaon-global-gespraech");
const beispiel = (sprache: "de" | "en") => ({
  id: 1, personId: 1, agentId: 8, beginn: B("2026-11-12", "10:30"), dauerMin: 30, status: "gebucht", stornoToken: "a".repeat(48),
  herkunft: "global_seite", notiz: "", gebuchtAm: B("2026-11-06", "12:00"), anrede: "Frau", vorname: "Maria", nachname: "Beispiel",
  firma: "Beispiel GmbH", email: "m.beispiel@beispiel-gmbh.example", telefon: "+49 30 1234567", sprache, ohneKundenmail: false, angebotId: null,
} as const);
const nutz = (sprache: "de" | "en", jetzt = B("2026-11-11", "10:40")) => G.globalGespraechNutzlast({ ...beispiel(sprache) } as any, {
  anrufer: { name: "Daniel Stripling", vorname: "Daniel" }, jetzt, stornoLink: "https://www.fiaon.com/termin/absagen/aaaa?anrede=sie&bereich=business",
  linkKalender: "https://www.fiaon.com/business#gespraech",
});
for (const ev of ["global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht"]) {
  ok(`${ev}: Vorlage im Motor, Absender ${absenderFuer(ev).name}`, hatVorlage(ev));
}
{
  const m = mailRendern("global_termin_erinnerung", nutz("de"))!;
  ok("Vortag DE: Betreff wörtlich", m.betreff === "Morgen um 10:30 Uhr: Ihr Gespräch mit FIAON Global", m.betreff);
  ok("Vortag DE: Anrede-Zeile", m.text.includes("Guten Tag Frau Beispiel,"));
  ok("Vortag DE: Satz 1 wörtlich", m.text.includes("morgen, am 12.11.2026, um 10:30 Uhr (deutsche Zeit) ruft Daniel Stripling Sie unter +49 30 1234567 an. Wir nehmen uns 30 Minuten Zeit für Ihr Vorhaben in den USA."));
  ok("Vortag DE: Vorbereitung (drei Punkte)", m.text.includes("– was Sie in den USA vorhaben (zwei Sätze genügen),") && m.text.includes("– wo Sie bzw. Ihr Unternehmen ansässig sind,") && m.text.includes("– welches Ziel Sie für Ihren Kapitalrahmen haben."));
  ok("Vortag DE: „Stimmt die Nummer nicht?“", m.text.includes("Stimmt die Nummer nicht? Antworten Sie einfach auf diese Mail."));
  ok("Vortag DE: Unterschrift mit Companies House 17318250", m.text.includes("Freundliche Grüße\nDaniel Stripling\nFIAON Global · FIAON LTD, London · Companies House 17318250"));
  ok("Vortag DE: Knopf zum Verschieben trägt den Storno-Link", m.text.includes("Termin verschieben oder absagen: https://www.fiaon.com/termin/absagen/aaaa?anrede=sie&bereich=business"));
  ok("Vortag DE: Global-Rahmen (Kopf „FIAON Global“)", m.text.startsWith("FIAON — FIAON Global"));
  ok("Vortag DE: kein Platzhalter ohne Wert", m.fehlend.length === 0 && !/\{\{|undefined/.test(m.html + m.text), m.fehlend.join(", "));
  const en = mailRendern("global_termin_erinnerung", nutz("en"))!;
  ok("Vortag EN: englische Vorlage über sprache: en", en.betreff === "Tomorrow at 10:30: your call with FIAON Global" && en.text.includes("Dear Ms Beispiel,") && en.text.includes("12 November 2026"), en.betreff);
}
{
  const m = mailRendern("global_termin_kurz", nutz("de"))!;
  ok("Kurz DE: Betreff", m.betreff === "Um 10:30 Uhr rufen wir Sie an", m.betreff);
  ok("Kurz DE: Satz wörtlich", m.text.includes("Guten Tag Frau Beispiel, um 10:30 Uhr rufen wir Sie an."));
  ok("Kurz DE: Gruß mit Vornamen", m.text.includes("Freundliche Grüße, Daniel, FIAON Global"));
  ok("Kurz DE: kein Kalender-Anhang", !/In Ihren Kalender/.test(m.text));
}
{
  const m = mailRendern("global_nicht_erreicht", nutz("de", B("2026-11-12", "11:15")))!;
  ok("Nicht erreicht DE: Betreff „heute“", m.betreff === "Wir haben Sie heute nicht erreicht", m.betreff);
  ok("Nicht erreicht DE: Satz wörtlich", m.text.includes("heute um 10:30 Uhr haben wir Sie unter +49 30 1234567 leider nicht erreicht. Das kommt vor — kein Problem."));
  ok("Nicht erreicht DE: Rückruf-Satz", m.text.includes("Lieber zurückgerufen werden? Antworten Sie kurz mit einer Zeit, die Ihnen passt."));
  ok("Nicht erreicht DE: Knopf „Neue Zeit wählen“ → /business#gespraech", m.text.includes("Neue Zeit wählen: https://www.fiaon.com/business#gespraech"));
  const spaeter = mailRendern("global_nicht_erreicht", nutz("de", B("2026-11-13", "09:00")))!;
  ok("Nicht erreicht DE am nächsten Tag: Datum statt „heute“", spaeter.betreff === "Wir haben Sie am 12.11.2026 nicht erreicht" && spaeter.text.includes("am 12.11.2026 um 10:30 Uhr haben wir Sie"), spaeter.betreff);
  const en = mailRendern("global_nicht_erreicht", nutz("en", B("2026-11-12", "11:15")))!;
  ok("Nicht erreicht EN", en.betreff === "We could not reach you today" && en.text.includes("unable to reach you today at 10:30 (German time) on +49 30 1234567"), en.betreff);
}
{
  // Die Wortwand — „ruft Sie an“ ist eine Zusage; gedeckt durch die Aufgabe an die zuständige Person (wie pruef-global-termin).
  for (const ev of ["global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht"]) {
    for (const sp of ["de", "en"] as const) {
      const m = mailRendern(ev, nutz(sp, B("2026-11-12", "11:15")))!;
      const funde = wandPruefen(`${m.betreff}\n${m.text}`, ["aufgabe_an_betreuer"]);
      ok(`Wortwand ${ev} ${sp}: besteht (Zusage gedeckt durch die Aufgabe an die zuständige Person)`, funde.length === 0, funde.map((f) => `${f.art}: „${f.treffer}“`).join(" / "));
      ok(`${ev} ${sp}: kein Platzhalter ohne Wert`, m.fehlend.length === 0, m.fehlend.join(", "));
      if (sp === "de") ok(`${ev} de: siezt`, !/\b(du|dich|dir|dein\w*)\b/i.test(m.text), m.text.match(/\b(du|dich|dir|dein\w*)\b/i)?.[0]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
titel("A6 · Anmeldung im Mailwerk und die Wände im Quelltext");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");
  for (const ev of ["global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht"]) {
    ok(`${ev}: im Ereignis-Register und Pflichtmail (keine Bremse)`, MAKE_EVENT_REGISTRY.some((e: any) => e.type === ev) && PFLICHTMAILS.has(ev));
  }
  const events = quelle("server/lib/fiaon-mail-events.ts");
  ok("Mailwerk-Steckbriefe für alle drei", ["global_termin_erinnerung:", "global_termin_kurz:", "global_nicht_erreicht:"].every((k) => events.includes(k)));
  const sg = quelle("server/routes/fiaon-startgespraech.ts");
  ok("12-Stunden-Lauf lässt Global stehen", /status = 'verpasst'[\s\S]{0,200}quelle IS DISTINCT FROM 'global'/.test(sg));
  ok("12-Stunden-Lauf schreibt weiter keinen Verlauf (Prüfregel pruef-menschen)", !/runVerpassteTermine[\s\S]{0,700}fiaon_contact_log/.test(sg));
  ok("Privat-Erinnerung lässt Global aus", /erinnert_am IS NULL[\s\S]{0,200}quelle IS DISTINCT FROM 'global'/.test(quelle("server/routes/fiaon-followup.ts")));
  ok("Lauf global_gespraeche registriert (10 Minuten, nur mit Ergebnis)", /tageslauf\('global_gespraeche'[\s\S]{0,200}10 \* 60 \* 1000[\s\S]{0,80}nurMitErgebnis: true/.test(quelle("server/routes.ts")));
  ok("Kalender: Vertretung sieht ihr Global-Gespräch", quelle("server/routes/fiaon-agent.ts").includes("'global-ergebnis:' || t.id"));
  ok("Kalender: drei Knöpfe bei offenem Global-Gespräch", quelle("client/src/pages/agent/calendar.tsx").includes('data-fiaon="global-ergebnis"'));
  ok("Chefbüro › Global-Kunden: Leiste „Gespräche“", quelle("client/src/components/admin/ChefGlobalKunden.tsx").includes("<ChefGlobalGespraeche />"));
  ok("Rundgang Global-Kunden: Schritt „Gespräche“", quelle("client/src/pages/agent/rundgaenge.ts").includes("[data-cgn='gespraeche']"));
  ok("Rückholung: Einstellung Vertretung erlaubt", quelle("server/routes/fiaon-chef-rueckholung.ts").includes('"global_vertretung_agent_id",'));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL B — DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (!mitDb) {
  log(`\nTeil B übersprungen (ohne PRUEF_DB).`);
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  const crypto = await import("node:crypto");
  await G.ensureGlobalGespraechSpalten();
  // Aufräumen aus einem früheren Lauf dieses Prüfstands.
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE 'global-%' OR schluessel LIKE 'pruef-e458%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_global_angebote WHERE angebot_ref LIKE 'PRUEF-E458-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termine WHERE notiz LIKE 'PRUEF-E458%'`;
  await sqlPool`DELETE FROM fiaon_firmen_log WHERE firma_id IN (SELECT id FROM fiaon_firmen_leads WHERE email LIKE '%@beispiel-gmbh.example')`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_firmen_leads WHERE email LIKE '%@beispiel-gmbh.example'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PRUEF-E458-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_mail_log`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('global_vertretung_agent_id', 'team_abwesenheit')`;
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('global_zustaendig_agent_id', '8') ON CONFLICT (key) DO UPDATE SET value = '8'`;
  const { abwesenheitVergessen } = await import("../server/lib/fiaon-abwesenheit");
  abwesenheitVergessen();

  // Die gestellte Uhr: ein Mittwoch, 10:00 Berlin, mindestens eine Woche voraus (Verschieben braucht echte Zukunft).
  let tag = berlinDatum(new Date(Date.now() + 8 * 86_400_000));
  while (new Date(`${tag}T12:00:00Z`).getUTCDay() !== 3) tag = R.tagPlus(tag, 1);
  const J = B(tag, "10:00");
  const h = (stunden: number) => new Date(J.getTime() + stunden * 3_600_000);
  log(`\n  Gestellte Uhr: ${J.toISOString()} (Mittwoch ${tag}, 10:00 Berlin)`);

  const { globalLeadAufnehmen } = await import("../server/routes/fiaon-firmen");
  let nr = 0;
  // Jede Firma mit eigener Nummer — der Firmen-Topf führt Leads mit gleicher Nummer zusammen.
  const tel = (n: number) => `+49 30 9${String(n).padStart(6, "0")}`;
  async function firma(an: { anrede?: string; email?: string } = {}): Promise<number> {
    nr++;
    const [p] = (await sqlPool`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, company_name, contact_name, primary_email, primary_phone, anrede)
      VALUES (${`PRUEF-E458-${Date.now()}-${nr}`}, 'business', 'Maria', ${`Beispiel${nr}`}, ${`Beispiel ${nr} GmbH`}, ${`Maria Beispiel${nr}`},
              ${an.email ?? `m.beispiel${nr}@beispiel-gmbh.example`}, ${tel(nr)}, ${an.anrede ?? "Frau"})
      RETURNING id`) as any[];
    await globalLeadAufnehmen({
      firma: `Beispiel ${nr} GmbH`, ansprechpartner: `Maria Beispiel${nr}`, telefon: tel(nr), email: `m.beispiel${nr}@beispiel-gmbh.example`,
      land: "Deutschland", paketwunsch: "Global Banking (4.999 €)", personId: Number(p.id), zustaendigAgentId: 8,
      status: "termin", ereignis: "termin_gebucht", verlauf: "Prüfstand E-458: gebucht.",
    } as any);
    return Number(p.id);
  }
  async function gespraech(personId: number, beginn: Date, gebucht: Date, agentId = 8, zusatz = ""): Promise<number> {
    const [t] = (await sqlPool`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, herkunft, storno_token, notiz, created_at, updated_at)
      VALUES (${personId}, ${agentId}, ${beginn}, 30, 'gebucht', 'global', 'global_seite', ${crypto.randomBytes(24).toString("hex")},
              ${`PRUEF-E458 ${zusatz}\nPaketwunsch: Global Banking (4.999 €)`}, ${gebucht}, ${gebucht})
      RETURNING id`) as any[];
    return Number(t.id);
  }
  const zeile = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_termine WHERE id = ${id}`) as any[])[0];
  const aufgabe = async (k: string) => ((await sqlPool`SELECT * FROM fiaon_betreiber_todos WHERE schluessel = ${k}`) as any[])[0];

  // ─────────────────────────────────────────────────────────────────────────
  titel("B1 · Lauf um Mi 10:00 — Vortag, eine Stunde vorher, Ergebnis fehlt");
  // ─────────────────────────────────────────────────────────────────────────
  const pV = await firma(); const tV = await gespraech(pV, h(24 - 1 / 6), h(-72), 8, "vortag");          // Do 09:50, vor drei Tagen gebucht
  const pV2 = await firma(); const tV2 = await gespraech(pV2, h(24 - 2 / 6), h(-2), 10, "vortag-frisch"); // Do 09:40, heute gebucht
  const pK = await firma(); const tK = await gespraech(pK, h(50 / 60), h(-48), 8, "kurz");              // Mi 10:50
  const pE = await firma(); const tE = await gespraech(pE, h(-2), h(-48), 8, "ergebnis");               // Mi 08:00, vorbei
  await sqlPool`UPDATE fiaon_termine SET erinnert_am = ${h(-24)}, kurz_erinnert_am = ${h(-3)} WHERE id = ${tE}`;
  gefangen.length = 0;
  const getan = await G.globalGespraecheLauf(J);
  ok("Lauf meldet, dass er gearbeitet hat (Historienzeile)", getan === true);
  const mV = gefangen.find((m) => m.an === `m.beispiel1@beispiel-gmbh.example`);
  ok("Vortag: Mail an das Unternehmen", !!mV && /^Morgen um 09:50 Uhr: Ihr Gespräch mit FIAON Global$/.test(mV.betreff), mV?.betreff ?? "keine Mail");
  ok("Vortag: nennt Daniel und die Nummer", !!mV && mV.text.includes("ruft Daniel Stripling Sie unter +49 30 9000001 an"), mV?.text.slice(0, 400));
  ok("Vortag: Marke gesetzt", !!(await zeile(tV)).erinnert_am);
  ok("Vortag, heute gebucht: Marke gesetzt, KEINE Mail", !!(await zeile(tV2)).erinnert_am && !gefangen.some((m) => m.an === "m.beispiel2@beispiel-gmbh.example"));
  const mK = gefangen.filter((m) => m.an === "m.beispiel3@beispiel-gmbh.example");
  ok("Eine Stunde vorher: genau eine Mail „Um 10:50 Uhr rufen wir Sie an“", mK.length === 1 && mK[0].betreff === "Um 10:50 Uhr rufen wir Sie an", mK.map((m) => m.betreff).join(" | "));
  ok("Eine Stunde vorher: Vortags-Mail am selben Tag nicht nachgeholt (Marke ohne Mail)", !!(await zeile(tK)).erinnert_am && !!(await zeile(tK)).kurz_erinnert_am);
  const aE = await aufgabe(`global-ergebnis:${tE}`);
  ok("Ergebnis fehlt: Aufgabe an Daniel, dringend, heute fällig", !!aE && Number(aE.zustaendig_agent_id) === 8 && Number(aE.prioritaet) === 1 && String(aE.faellig_am).length > 0, aE ? `${aE.zustaendig_art}/${aE.zustaendig_agent_id}/${aE.prioritaet}` : "keine");
  ok("Ergebnis fehlt: Titel und Link in den Kalender", !!aE && String(aE.titel).startsWith("Ergebnis fehlt: Gespräch mit Beispiel 4 GmbH am ") && aE.link === `/agent/kalender?termin=${tE}`, aE?.titel);
  ok("Ergebnis fehlt: Gespräch bleibt „gebucht“ (kein stilles „verpasst“)", (await zeile(tE)).status === "gebucht");
  gefangen.length = 0;
  ok("Zweiter Lauf sofort danach: nichts doppelt", (await G.globalGespraecheLauf(J)) === false && gefangen.length === 0);

  // ─────────────────────────────────────────────────────────────────────────
  titel("B2 · Leitung: erst am nächsten Werktag um 9 Uhr");
  // ─────────────────────────────────────────────────────────────────────────
  await G.globalGespraecheLauf(h(23 - 1 / 6)); // Do 08:50
  ok("Do 08:50: noch keine Erinnerung an die Leitung", !(await aufgabe(`global-ergebnis-leitung:${tE}`)));
  await G.globalGespraecheLauf(h(23 + 1 / 12)); // Do 09:05
  const aL = await aufgabe(`global-ergebnis-leitung:${tE}`);
  ok("Do 09:05: Erinnerung an die Leitung (Brett des Betreibers, dringend)", !!aL && aL.zustaendig_art !== "agent" && Number(aL.prioritaet) === 1, aL ? `${aL.zustaendig_art}` : "keine");
  ok("Leitung: Link ins Chefbüro › Global-Kunden › Gespräche", aL?.link === "/chef/global-kunden?gespraeche=offen");
  const liste = await G.globalGespraecheListe(h(23.1));
  ok("Chefbüro-Liste: das Gespräch steht unter „ohne Ergebnis“", liste.offen.some((z) => z.id === tE) && !!liste.offen.find((z) => z.id === tE)?.leitungAm);

  // ─────────────────────────────────────────────────────────────────────────
  titel("B3 · „Nicht erreicht“ — genau EINE Mail, alle Aufgaben zu");
  // ─────────────────────────────────────────────────────────────────────────
  gefangen.length = 0;
  const { globalTerminErgebnis } = await import("../server/lib/fiaon-global-termin");
  const e1 = await globalTerminErgebnis({ terminId: tE, personId: pE, beginn: h(-2), agent: { id: 8, name: "Daniel Stripling" }, ergebnis: "verpasst", grund: "nicht_erschienen" });
  const mN = gefangen.filter((m) => m.an === "m.beispiel4@beispiel-gmbh.example");
  ok("eine Mail „Wir haben Sie … nicht erreicht“", mN.length === 1 && /^Wir haben Sie (heute|am [0-9.]+) nicht erreicht$/.test(mN[0].betreff), mN.map((m) => m.betreff).join(" | "));
  ok("Knopf „Neue Zeit wählen“ zur Website", mN.length === 1 && /Neue Zeit wählen: https?:\/\/[^\s]+\/business#gespraech/.test(mN[0].text));
  ok("Hinweis an Daniel sagt, dass die Mail rausging", /einmal eine Mail mit dem Link/.test(e1.hinweis), e1.hinweis);
  const zE = await zeile(tE);
  ok("Termin: verpasst, Grund „nicht_erschienen“, Marke der Mail", zE.status === "verpasst" && zE.verpasst_grund === "nicht_erschienen" && !!zE.verpasst_mail_am);
  ok("Aufgaben „Ergebnis fehlt“ und „Leitung“ geschlossen", (await aufgabe(`global-ergebnis:${tE}`))?.status === "erledigt" && (await aufgabe(`global-ergebnis-leitung:${tE}`))?.status === "erledigt");
  gefangen.length = 0;
  const zweit = await G.globalNichtErreichtSenden(tE);
  ok("zweiter Versuch: keine zweite Mail", !zweit.versandt && gefangen.length === 0, zweit.satz);
  const [firmaLog] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_firmen_log l JOIN fiaon_firmen_leads f ON f.id = l.firma_id
     WHERE f.person_id = ${pE} AND l.ergebnis IN ('gespraech_nicht_zustande', 'gespraech_mail')`) as any[];
  ok("Firmen-Cockpit: Verlauf „kam nicht zustande“ und die Mail", Number(firmaLog?.n) >= 2, String(firmaLog?.n));

  // ─────────────────────────────────────────────────────────────────────────
  titel("B4 · Daniel abwesend → die Vertretung bekommt „Ergebnis fehlt“ und sieht das Gespräch");
  // ─────────────────────────────────────────────────────────────────────────
  // Vertretung: Hans-Jürgen (#505, aktiv). #12 ist im Prüfstand gesperrt — und darf deshalb nie Vertretung sein (eigene Probe unten).
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('global_vertretung_agent_id', '12') ON CONFLICT (key) DO UPDATE SET value = '12'`;
  ok("gesperrtes Konto (#12) gilt nie als Vertretung", (await G.globalVertretung()) === null);
  await sqlPool`UPDATE fiaon_settings SET value = '505' WHERE key = 'global_vertretung_agent_id'`;
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('team_abwesenheit', ${JSON.stringify({ an: true, vertreterId: 13, bis: h(72).toISOString(), fuer: [8], gesetztVon: "Prüfstand", gesetztAm: new Date().toISOString(), endeteAm: null, endeteWie: null, verlauf: [] })})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  abwesenheitVergessen();
  const pA = await firma(); const tA = await gespraech(pA, h(-3), h(-50), 8, "abwesend");
  await sqlPool`UPDATE fiaon_termine SET erinnert_am = ${h(-27)}, kurz_erinnert_am = ${h(-4)} WHERE id = ${tA}`;
  await G.globalGespraecheLauf(J);
  const aA = await aufgabe(`global-ergebnis:${tA}`);
  ok("Aufgabe bei der Vertretung (#505), mit Satz „Du bist als Vertretung eingetragen“", !!aA && Number(aA.zustaendig_agent_id) === 505 && String(aA.text).includes("Vertretung"), aA ? `${aA.zustaendig_agent_id}` : "keine");
  ok("Vertretung darf das Ergebnis eintragen (Zugriffsprüfung)", await G.istGlobalVertretung(505) && !(await G.istGlobalVertretung(13)));
  const imKalender = (await sqlPool`
    SELECT t.id FROM fiaon_termine t
     WHERE (t.agent_id = ${505} OR (t.quelle = 'global' AND EXISTS (
       SELECT 1 FROM fiaon_betreiber_todos b WHERE b.schluessel = 'global-ergebnis:' || t.id AND b.status <> 'erledigt'
          AND b.zustaendig_art = 'agent' AND b.zustaendig_agent_id = ${505}))) AND t.id = ${tA}`) as any[];
  ok("Kalender-Abfrage der Vertretung findet das Gespräch", imKalender.length === 1);
  await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('global_vertretung_agent_id', 'team_abwesenheit')`;
  abwesenheitVergessen();
  const pA2 = await firma(); const tA2 = await gespraech(pA2, h(-4), h(-50), 8, "ohne-vertretung");
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES ('team_abwesenheit', ${JSON.stringify({ an: true, vertreterId: 13, bis: h(72).toISOString(), fuer: [8], gesetztVon: "Prüfstand", gesetztAm: new Date().toISOString(), endeteAm: null, endeteWie: null, verlauf: [] })})`;
  abwesenheitVergessen();
  await sqlPool`UPDATE fiaon_termine SET erinnert_am = ${h(-28)}, kurz_erinnert_am = ${h(-5)} WHERE id = ${tA2}`;
  await G.globalGespraecheLauf(J);
  const aA2 = await aufgabe(`global-ergebnis:${tA2}`);
  ok("ohne Vertretung: Aufgabe aufs Brett der Leitung, Link ins Chefbüro", !!aA2 && aA2.zustaendig_art !== "agent" && aA2.link === "/chef/global-kunden?gespraeche=offen", aA2 ? `${aA2.zustaendig_art} ${aA2.link}` : "keine");
  await sqlPool`DELETE FROM fiaon_settings WHERE key = 'team_abwesenheit'`;
  abwesenheitVergessen();

  // ─────────────────────────────────────────────────────────────────────────
  titel("B5 · Verschieben — neue Zeit, Bestätigung, alles läuft neu");
  // ─────────────────────────────────────────────────────────────────────────
  const pS = await firma(); const tS = await gespraech(pS, h(-5), h(-60), 8, "verschieben");
  await sqlPool`UPDATE fiaon_termine SET erinnert_am = ${h(-29)}, kurz_erinnert_am = ${h(-6)} WHERE id = ${tS}`;
  await G.globalGespraecheLauf(J);
  ok("vorher: Aufgabe „Ergebnis fehlt“ offen", (await aufgabe(`global-ergebnis:${tS}`))?.status === "offen");
  gefangen.length = 0;
  const neu = h(48 + 3); // Fr 13:00
  const vs = await G.globalGespraechVerschieben(tS, neu, { id: 8, name: "Daniel Stripling" });
  ok("verschoben (ok)", vs.ok === true, (vs as any).error ?? "");
  const zS = await zeile(tS);
  ok("neue Zeit steht, alle Marken zurückgesetzt", new Date(zS.beginn).getTime() === neu.getTime() && !zS.erinnert_am && !zS.kurz_erinnert_am && !zS.ergebnis_aufgabe_am && !zS.ergebnis_leitung_am);
  ok("Aufgabe „Ergebnis fehlt“ geschlossen mit „Verschoben auf …“", (await aufgabe(`global-ergebnis:${tS}`))?.status === "erledigt" && String((await aufgabe(`global-ergebnis:${tS}`))?.ergebnis).startsWith("Verschoben auf "));
  const mS = gefangen.filter((m) => m.an === "m.beispiel7@beispiel-gmbh.example");
  ok("Bestätigung (FIAON Global) mit der neuen Zeit an das Unternehmen", mS.length === 1 && mS[0].betreff.startsWith("Ihr Gespräch zu FIAON Global: ") && mS[0].betreff.endsWith("13:00 Uhr"), mS.map((m) => m.betreff).join(" | "));
  ok("Bestätigung trägt den Paketwunsch aus der Buchung", mS.length === 1 && mS[0].text.includes("Global Banking (4.999 €)"));
  const zuFrueh = await G.globalGespraechVerschieben(tS, new Date(Date.now() - 3_600_000), { id: 8, name: "Daniel Stripling" });
  ok("Vergangenheit wird abgewiesen", zuFrueh.ok === false);

  // ─────────────────────────────────────────────────────────────────────────
  titel("B6 · Firmenangebot (E-301): keine automatische Kundenmail");
  // ─────────────────────────────────────────────────────────────────────────
  const pF = await firma(); const tF = await gespraech(pF, h(50 / 60 - 0.01), h(-48), 10, "firmenangebot");
  await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, gueltig_bis, status, person_id, startgespraech_termin_id)
    VALUES (${`PRUEF-E458-${Date.now()}`}, 'IA-FIRMA-PRUEF', ${sqlPool.json({ anrede: "Frau", vorname: "Maria", nachname: "Firma", email: "m.beispiel8@beispiel-gmbh.example", telefon: "+49 30 1234567" } as any)},
            ${sqlPool.json({} as any)}, ${sqlPool.json({} as any)}, ${h(24 * 30)}, 'angenommen', ${pF}, ${tF})`;
  gefangen.length = 0;
  await G.globalGespraecheLauf(J);
  ok("kurz vorher: Marke gesetzt, KEINE Mail", !!(await zeile(tF)).kurz_erinnert_am && !gefangen.some((m) => m.an === "m.beispiel8@beispiel-gmbh.example"));
  const nF = await G.globalNichtErreichtSenden(tF);
  ok("„nicht erreicht“: keine Mail beim Firmenangebot", !nF.versandt && /Firmenangebot/.test(nF.satz), nF.satz);

  // ─────────────────────────────────────────────────────────────────────────
  titel("B7 · Alte Fassungen: 12-Stunden-Lauf und Privat-Erinnerung lassen Global stehen");
  // ─────────────────────────────────────────────────────────────────────────
  const pAlt = await firma(); const tAlt = await gespraech(pAlt, new Date(Date.now() - 20 * 3_600_000), new Date(Date.now() - 70 * 3_600_000), 8, "alt");
  const [privat] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, notiz, created_at)
    VALUES (${pAlt}, 10, ${new Date(Date.now() - 20 * 3_600_000)}, 20, 'gebucht', 'agent_manuell', ${crypto.randomBytes(24).toString("hex")}, 'PRUEF-E458 privat', NOW() - INTERVAL '3 days')
    RETURNING id`) as any[];
  const { runVerpassteTermine } = await import("../server/routes/fiaon-startgespraech");
  await runVerpassteTermine();
  ok("12-Stunden-Lauf: Global bleibt „gebucht“", (await zeile(tAlt)).status === "gebucht");
  ok("12-Stunden-Lauf: Privat-Termin wie bisher „verpasst“", (await zeile(Number(privat.id))).status === "verpasst");
  const pZ = await firma(); const tZ = await gespraech(pZ, new Date(Date.now() + 5 * 3_600_000), new Date(Date.now() - 70 * 3_600_000), 8, "privat-erinnerung");
  gefangen.length = 0;
  const { runTerminErinnerungen } = await import("../server/routes/fiaon-followup");
  await runTerminErinnerungen();
  ok("Privat-Erinnerung: Global-Gespräch ohne Marke und ohne Mail", !(await zeile(tZ)).erinnert_am && !gefangen.some((m) => m.an === "m.beispiel10@beispiel-gmbh.example"));

  await sqlPool.end({ timeout: 2 }).catch(() => {});
}

log(`\n${"═".repeat(74)}\n${schlecht === 0 ? "GRÜN" : "ROT"} — ${gut} ok, ${schlecht} rot\n${"═".repeat(74)}`);
process.exit(schlecht === 0 ? 0 : 1);
