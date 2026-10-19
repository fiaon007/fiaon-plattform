// Prüfstand E-406 B1 (19.10.2026), offline: Mara-Inkasso, erste Stufe — frisch fällige Raten persönlich und freundlich.
// Ohne Datenbank, ohne Netz, ohne Schlüssel. Prüft die reine Regel (shared/fiaon-mara-rate-erinnerung.ts): wer die Mail
// bekommt (positiv/negativ), Fenster 10–18 Uhr, „nie am Tag einer Rechnung/Mahnung“, höchstens 3 Kontakte, Verfall nach
// Tag 3; die Vorlage im Mailwerk (gerendert, Textprüfung E-393/Wortwand/kein Verkauf/KI-Offenlegung); die Verdrahtung
// (Registry, Tür, Zahlungspost, Sperrlisten, Herkunft, Takt, Steuerpult) und Rot-Proben.
// Datenbank-Teil: scripts/pruef-mara-rate-erinnerung-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-mara-rate-erinnerung.ts
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[k];
process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Code ohne Kommentarzeilen — damit ein Satz im Kommentar keine Prüfung besteht. */
const ohneKommentar = (s: string) => s.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");

async function main() {
  const R = await import("../shared/fiaon-mara-rate-erinnerung");
  const { rateErinnerungUrteil, GRUND } = R;

  // Feste Prüfzeiten (Berlin). Oktober 2026: Umstellung am 25.10. um 3 Uhr.
  const B = (iso: string) => new Date(iso);
  const ELF = B("2026-10-20T11:00:00+02:00"); // Dienstag, 20.10., 11:00 — im Fenster
  const basis: import("../shared/fiaon-mara-rate-erinnerung").RateErinnerungFakten = {
    rateOffen: true, faelligAm: "2026-10-19", bestellungAktiv: true, nachVertragsende: false, kuendigungUngebucht: false,
    kuendigungGebucht: false, widerrufOderRecht: false, mahnstopp: false, testperson: false, globalKunde: false,
    vertriebssperre: false, eskaliert: false, karteOffen: false, einwand: false, zahlungGemeldet: false, eingangPasst: false,
    zusageOffen: false, terminSteht: false, hatEmail: true, kontakte: 2, letzteKundenNachrichtAm: null,
    heuteRatenpost: false, motorHeuteDran: false, kiPause: false,
  };
  const U = (f: Partial<typeof basis>, jetzt = ELF) => rateErinnerungUrteil({ ...basis, ...f }, jetzt);

  console.log("── 1 · Wer bekommt die Mail (positiv)");
  ok(U({}).art === "senden", "seit 1 Tag fällig, Rechnung + Erinnerung (2 Kontakte ab Fälligkeit), 11:00 → senden", U({}));
  ok(U({ faelligAm: "2026-10-18" }).art === "senden", "seit 2 Tagen fällig → senden");
  ok(U({ faelligAm: "2026-10-17" }).art === "senden", "seit 3 Tagen fällig, Motor heute nicht dran → senden");
  ok(U({ kontakte: 0 }).art === "senden" && U({ kontakte: 1 }).art === "senden", "0 oder 1 Kontakt → senden");
  ok(U({ letzteKundenNachrichtAm: new Date(ELF.getTime() - 25 * 3600_000) }).art === "senden", "Kunde schrieb vor 25 h → senden (24 h Ruhe vorbei)");

  console.log("── 2 · Wer bekommt sie NICHT (negativ) — mit Grund");
  const neg: [string, Partial<typeof basis>, string, string][] = [
    ["Rate bezahlt", { rateOffen: false }, "erledigt", GRUND.nichtOffen],
    ["Vertragsende (Rate danach fällig)", { nachVertragsende: true }, "auslassen", GRUND.vertragsende],
    ["Kunde von FIAON Global", { globalKunde: true }, "auslassen", GRUND.global],
    ["Testperson", { testperson: true }, "auslassen", GRUND.test],
    ["Mahnstopp", { mahnstopp: true }, "auslassen", GRUND.mahnstopp],
    ["Kündigung eingegangen, nicht gebucht", { kuendigungUngebucht: true }, "auslassen", GRUND.kuendigungUngebucht],
    ["Kündigung gebucht", { kuendigungGebucht: true }, "auslassen", GRUND.kuendigungGebucht],
    ["Widerruf / Bestreiten / Anwalt", { widerrufOderRecht: true }, "auslassen", GRUND.widerruf],
    ["Vertriebssperre (is_blocked)", { vertriebssperre: true }, "auslassen", GRUND.vertriebssperre],
    ["Härtefall eskaliert", { eskaliert: true }, "auslassen", GRUND.eskaliert],
    ["offene Entscheidungskarte bei Justin", { karteOffen: true }, "auslassen", GRUND.karte],
    ["„kann nicht zahlen“ / Beschwerde", { einwand: true }, "auslassen", GRUND.einwand],
    ["Bestellung storniert/archiviert/Abo gestoppt", { bestellungAktiv: false }, "auslassen", GRUND.bestellung],
    ["schon 3 Kontakte", { kontakte: 3 }, "auslassen", GRUND.kontakte],
    ["schon 5 Kontakte", { kontakte: 5 }, "auslassen", GRUND.kontakte],
    ["keine E-Mail-Adresse", { hatEmail: false }, "auslassen", GRUND.keineMail],
    ["Zahlung gemeldet", { zahlungGemeldet: true }, "erledigt", GRUND.gemeldet],
    ["passender Eingang im Bankbuch", { eingangPasst: true }, "erledigt", GRUND.eingang],
    ["Zahlungszusage offen", { zusageOffen: true }, "erledigt", GRUND.zusage],
    ["Termin oder Rückruf steht", { terminSteht: true }, "erledigt", GRUND.termin],
    ["Ratenpause (Fälligkeit verschoben)", { faelligAm: "2026-11-19" }, "erledigt", GRUND.nichtFaellig],
    ["heute fällig (Tag 0) — die Rechnung ist dran", { faelligAm: "2026-10-20" }, "erledigt", GRUND.nichtFaellig],
    ["seit 4 Tagen fällig — erste Stufe vorbei", { faelligAm: "2026-10-16" }, "verfallen", GRUND.zuAlt],
    ["seit 30 Tagen fällig (Altbestand)", { faelligAm: "2026-09-20" }, "verfallen", GRUND.zuAlt],
  ];
  for (const [name, f, art, grund] of neg) {
    const u = U(f);
    ok(u.art === art && (u as any).grund === grund, `${name} → ${art} („${grund}“)`, u);
  }
  // Was ausschließt, schlägt, was erledigt: Kündigung + Zusage → ausgelassen (Grund Kündigung, nicht „Zusage“).
  const beide = U({ kuendigungGebucht: true, zusageOffen: true });
  ok(beide.art === "auslassen" && (beide as any).grund === GRUND.kuendigungGebucht, "Kündigung schlägt Zusage (der Grund im Steuerpult stimmt)", beide);

  console.log("── 3 · Nichts doppelt am selben Tag (Rechnung/Mahnung) — Mara wartet bis morgen");
  const heutePost = U({ heuteRatenpost: true });
  ok(heutePost.art === "warten" && (heutePost as any).grund === GRUND.heutePost
    && (heutePost as any).nichtVor.toISOString() === "2026-10-21T08:00:00.000Z", "Tag 1, heute schon Rechnung/Mahnung → warten bis morgen 10:00", heutePost);
  const motor = U({ motorHeuteDran: true });
  ok(motor.art === "warten" && (motor as any).grund === GRUND.motor, "Tag 1, Abo-Motor heute dran → warten bis morgen", motor);
  const tag3Post = U({ faelligAm: "2026-10-17", heuteRatenpost: true });
  ok(tag3Post.art === "verfallen" && /heute ging schon/.test((tag3Post as any).grund), "Tag 3 + Mahnung heute (Stufe 2 an Tag 3) → verfallen (morgen wäre Tag 4)", tag3Post);
  const tag3Motor = U({ faelligAm: "2026-10-17", motorHeuteDran: true });
  ok(tag3Motor.art === "verfallen", "Tag 3 + Motor heute dran → verfallen", tag3Motor);

  console.log("── 4 · Fenster 10–18 Uhr (Berlin), Zeitumstellung");
  ok(R.imFenster(B("2026-10-20T10:00:00+02:00")) && !R.imFenster(B("2026-10-20T09:59:00+02:00")), "10:00 offen, 09:59 zu");
  ok(R.imFenster(B("2026-10-20T17:59:00+02:00")) && !R.imFenster(B("2026-10-20T18:00:00+02:00")), "17:59 offen, 18:00 zu");
  ok(R.berlinMinuten(B("2026-10-20T00:30:00+02:00")) === 30, "Mitternacht (h23) = 0 Minuten, keine NaN-Falle");
  const frueh = U({}, B("2026-10-20T08:30:00+02:00"));
  ok(frueh.art === "warten" && (frueh as any).grund === GRUND.fenster && (frueh as any).nichtVor.toISOString() === "2026-10-20T08:00:00.000Z", "08:30 → wartet bis heute 10:00", frueh);
  const spaet = U({}, B("2026-10-20T18:30:00+02:00"));
  ok(spaet.art === "warten" && (spaet as any).nichtVor.toISOString() === "2026-10-21T08:00:00.000Z", "18:30 → wartet bis morgen 10:00", spaet);
  const spaetTag3 = U({ faelligAm: "2026-10-17" }, B("2026-10-20T18:30:00+02:00"));
  ok(spaetTag3.art === "verfallen", "Tag 3, 18:30 → verfallen (morgen wäre Tag 4)", spaetTag3);
  ok(R.fensterBeginnAm("2026-10-24").toISOString() === "2026-10-24T08:00:00.000Z" && R.fensterBeginnAm("2026-10-26").toISOString() === "2026-10-26T09:00:00.000Z",
    "Zeitumstellung 25.10.: 10:00 Sommerzeit = 08:00 UTC, danach 09:00 UTC");
  ok(R.naechstesFenster(B("2027-03-27T19:00:00+01:00")).toISOString() === "2027-03-28T08:00:00.000Z", "Zeitumstellung 28.03.: 10:00 Sommerzeit = 08:00 UTC");
  ok(R.berlinTag(B("2026-10-20T23:30:00+02:00")) === "2026-10-20" && R.berlinTag(B("2026-10-20T22:30:00Z")) === "2026-10-21", "Berliner Tag (nicht UTC)");

  console.log("── 5 · Kunde schreibt gerade selbst / KI-Pause");
  const gespraech = U({ letzteKundenNachrichtAm: new Date(ELF.getTime() - 2 * 3600_000) });
  ok(gespraech.art === "warten" && (gespraech as any).grund === GRUND.gespraech
    && (gespraech as any).nichtVor.toISOString() === "2026-10-21T08:00:00.000Z", "um 09:00 geschrieben → 24 h Ruhe bis morgen 09:00 → Fenster ab morgen 10:00", gespraech);
  const gespraechTag3 = U({ faelligAm: "2026-10-17", letzteKundenNachrichtAm: new Date(ELF.getTime() - 2 * 3600_000) });
  ok(gespraechTag3.art === "verfallen", "… an Tag 3 → verfallen", gespraechTag3);
  const ki = U({ kiPause: true });
  ok(ki.art === "warten" && (ki as any).grund === GRUND.kiPause && (ki as any).nichtVor.getTime() === ELF.getTime() + 30 * 60_000, "KI-Pause → in 30 Min. wieder nachsehen", ki);

  console.log("── 6 · Schalter (Standard an)");
  ok(R.schalterAn(undefined) && R.schalterAn(null) && R.schalterAn("") && R.schalterAn("an"), "fehlt/leer/an → an");
  ok(!R.schalterAn("aus") && !R.schalterAn("0") && !R.schalterAn(" AUS "), "aus/0 → aus");

  console.log("── 7 · Die Vorlage im Mailwerk (gerendert, Textprüfung)");
  const motorMod = await import("../server/mail/motor");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const eintrag = MAKE_EVENT_REGISTRY.find((e) => e.type === R.RATE_ERINNERUNG_EVENT);
  ok(!!eintrag && !eintrag.deprecated && eintrag.customerBound, "Registry kennt mara_rate_erinnerung", eintrag?.type);
  const m = motorMod.mailRendern(R.RATE_ERINNERUNG_EVENT, { ...(eintrag?.example ?? {}) } as any);
  ok(!!m && !m.knopfEntfallen && m.fehlend.length === 0, "Beispiel füllt alles (beide Knöpfe mit Ziel)", m?.fehlend);
  const kText = `${m?.betreff ?? ""}\n\n${m?.text ?? ""}`;
  ok(R.textPruefen(kText).length === 0, "Textprüfung grün: keine Kopplung/Drohung (E-393), Wortwand, kein Mahn-/Verkaufswort, KI-Offenlegung", R.textPruefen(kText));
  ok(/^Kurz von Mara: Ihre Monatsrate vom 18\.10\.2026$/.test(m?.betreff ?? ""), "Betreff persönlich, mit Fälligkeitstag", m?.betreff);
  ok(/digitale Assistentin von FIAON/.test(m?.text ?? ""), "Mara gibt sich als digitale Assistentin zu erkennen (KI-VO Art. 50)");
  ok(/1\. Jetzt bezahlen/.test(m?.text ?? "") && /2\. Kurz antworten/.test(m?.text ?? "") && /3\. Rückruf wählen/.test(m?.text ?? ""), "drei Wege: zahlen, antworten, Rückruf");
  ok(/machen Sie sich keine Sorgen/.test(m?.text ?? "") && /Schon überwiesen\?/.test(m?.text ?? ""), "kein Druck, „Schon überwiesen?“ entlastet");
  ok(/href="https:\/\/fiaon\.com\/zahlung\/FIAON-A1B2C3-2"/.test(m?.html ?? ""), "Knopf „Jetzt bezahlen“ → Zahlungsseite DER RATE (Ratenreferenz)");
  ok(/href="https:\/\/www\.fiaon\.com\/termin\/[^"]*von=mara_rate_mail"/.test(m?.html ?? "") && /Rückruf-Zeit wählen/.test(m?.html ?? ""), "zweiter Knopf → persönlicher Terminlink mit Herkunft mara_rate_mail");
  ok(/59,99 €/.test(m?.text ?? "") && /FIAON-A1B2C3-2/.test(m?.text ?? ""), "Betrag mit Komma, Verwendungszweck im Datenkasten");
  ok(!(m?.html ?? "").includes("Ihr Ziel") && !/Kreditkarte|Limit|Partnerbank/i.test(kText), "kein Karten-Block, kein Verkauf (Werbesperre: Service ja, Verkauf nein)");
  const T = await import("../shared/fiaon-mara-ton");
  ok(T.ausrufezeichen(kText) === 0, "kein Ausrufezeichen", T.ausrufezeichen(kText));
  ok(!/\b(Daniel|Florentine|Nikita|Diana|Rifka)\b/.test(kText), "kein Vorname eines Mitarbeiters (E-265)");
  ok(motorMod.absenderFuer(R.RATE_ERINNERUNG_EVENT).email === "welcome@fiaon.com", "Absender welcome@ — Antworten landen bei Mail-Mara im Postfach");

  console.log("── 8 · Verdrahtung (Tür, Zahlungspost, Sperrlisten, Herkunft, Menü, Takt, Steuerpult)");
  const F = await import("../server/lib/fiaon-mail-frequenz");
  const frequenz = lies("server/lib/fiaon-mail-frequenz.ts");
  const zp = frequenz.slice(frequenz.indexOf("const ZAHLUNGSPOST = new Set<string>(["), frequenz.indexOf("]);", frequenz.indexOf("const ZAHLUNGSPOST = new Set<string>([")));
  ok(zp.includes(`"${R.RATE_ERINNERUNG_EVENT}"`), "ZAHLUNGSPOST: Werbesperre hält sie nicht auf (Service ohne Verkauf)");
  ok(!F.istZahlungspost(R.RATE_ERINNERUNG_EVENT) && F.istZahlungspost("abo_payment_reminder"), "… hebt aber nie selbst eine Brevo-Sperre auf (Freigabe bleibt bei der Rechnung)");
  ok(!F.PFLICHTMAILS.has(R.RATE_ERINNERUNG_EVENT), "keine Pflichtmail");
  const tuer = lies("server/make-webhook.ts");
  const privatP = tuer.slice(tuer.indexOf("const PRIVATLINIE_PERSON = new Set<string>(["), tuer.indexOf("]);", tuer.indexOf("const PRIVATLINIE_PERSON")));
  const privat = tuer.slice(tuer.indexOf("const PRIVATLINIE = new Set<string>(["), tuer.indexOf("]);", tuer.indexOf("const PRIVATLINIE = new Set")));
  ok(privatP.includes(`"${R.RATE_ERINNERUNG_EVENT}"`) && privat.includes(`"${R.RATE_ERINNERUNG_EVENT}"`), "Global-Wand der Tür (PRIVATLINIE und PRIVATLINIE_PERSON, E-272)");
  ok(/\|\s*"mara_rate_erinnerung"/.test(tuer), "MakeEventType kennt das Ereignis");
  const { mailEvents, imMenue } = await import("../server/lib/fiaon-mail-events");
  const ev = (await mailEvents((() => Promise.resolve([])) as any)).find((e) => e.type === R.RATE_ERINNERUNG_EVENT);
  ok(!!ev && !imMenue(ev, "admin").ja && !imMenue(ev, "inkasso" as any).ja, "steht in keinem Sende-Menü (nur automatisch)");
  const { herkunftPruefen } = await import("../server/lib/fiaon-termine");
  ok(herkunftPruefen(R.RATE_ERINNERUNG_HERKUNFT) === R.RATE_ERINNERUNG_HERKUNFT, "Herkunft mara_rate_mail ist bekannt (Buchung wird zugeordnet)");
  ok(/eventType === "mara_rate_erinnerung"\) setze\("termin_link", terminLink\(personId, "mara_rate_mail"\)\)/.test(lies("server/lib/fiaon-mail-senden.ts")), "Link-Baustein setzt den persönlichen Terminlink mit Herkunft");
  ok(/"mara_rate_erinnerung",\s*\n\];/.test(lies("server/lib/fiaon-postmeister-aufholen.ts")), "Postmeister: eine Serienmail beantwortet keine Kundenfrage (KEINE_ANTWORT)");
  ok(/"mara_rate_erinnerung",\s*\n\];/.test(lies("server/routes/fiaon-bankwechsel.ts")), "Bankwechsel: Mail mit IBAN steht in BANK_EREIGNISSE");
  ok(/mara_rate_erinnerung: "Maras Raten-Mail \(frisch fällig\)"/.test(lies("server/routes/fiaon-office-vertrieb.ts")), "Akte zeigt den Namen der Mail");
  ok(/tageslauf\('mara_rate_erinnerung'[^\n]*rateErinnerungTakt[^\n]*10 \* 60 \* 1000[^\n]*nurMitErgebnis: true/.test(lies("server/routes.ts")), "Takt alle 10 Minuten registriert (nur mit Ergebnis in der Historie)");
  const pult = lies("server/routes/fiaon-mara-steuerpult.ts");
  ok(/router\.get\("\/chef\/mara\/raten-erinnerung", wache/.test(pult) && /router\.post\("\/chef\/mara\/raten-erinnerung", wache/.test(pult), "Steuerpult: GET/POST /chef/mara/raten-erinnerung, nur Inhaber (wache)");
  const ui = lies("client/src/components/admin/ChefMara.tsx");
  ok(/lazy\(\(\) => import\("\.\/ChefMaraRaten"\)\)/.test(ui) && /<MaraRatenErinnerung \/>/.test(ui), "Karte im Reiter „Mail“ des bestehenden Steuerpults (keine neue Seite)");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/ziel: "\.mr-raten"/.test(rg) && /Tag 1–3: Mara schreibt zuerst\./.test(rg), "Rundgänge: Mara-Steuerpult und Collections (Inkasso) mitgezogen");
  ok(/id: "2026-10-19-mara-rate-frisch"/.test(lies("client/src/pages/agent/updates-data.ts")), "Team-Update oben in updates-data.ts");

  console.log("── 9 · Der Server: nie bremsen, nie doppelt, ein Versandweg");
  const srv = lies("server/lib/fiaon-mara-rate-erinnerung.ts");
  const code = ohneKommentar(srv);
  ok(!/UPDATE\s+fiaon_abo_raten/i.test(code) && !/INSERT\s+INTO\s+fiaon_abo_raten/i.test(code), "schreibt NICHTS an fiaon_abo_raten (E-182: Mahnmotor wird nie verschoben)");
  ok(!/UPDATE\s+fiaon_settings[\s\S]{0,80}(frequenz|mahn|abo_)/i.test(code), "ändert keine Einstellung von Bremse, Mahnung oder Abo-Motor");
  ok(/rate_id INTEGER PRIMARY KEY/.test(code) && /ON CONFLICT \(rate_id\) DO NOTHING/.test(code), "ein Merker je Rate — nie doppelt");
  ok(/FOR UPDATE SKIP LOCKED/.test(code) && /status = 'in_arbeit'/.test(code) && /status = 'unklar'/.test(code), "Merker atomar genommen; Hängengebliebenes wird nie neu gesendet");
  ok(/FORDERUNG_AKTIV_SQL_FUER\("a", "r"\)/.test(code) && /RATE_NACH_ENDE_SQL_FUER\("a", "r"\)/.test(code) && /KUENDIGUNG_UNGEBUCHT_SQL\("a\.person_id"\)/.test(code), "dieselben Regeln wie Mahnmotor und Inkasso (E-391/E-394)");
  ok(/istGlobalKunde\(personId\)\.catch\(\(\) => true\)/.test(code) && /menschSperre\(personId\)/.test(code), "Global und Sperren über die Regeln des Hauses — Fehler schließt aus");
  ok(/mahnAbstandSql\("r\.mahnstufe"\)/.test(code) && /MAHNSTUFEN\.length/.test(code), "„Motor heute dran“ aus den Mahnstufen des Abo-Motors (keine zweite Liste)");
  ok(/textPruefen\(`\$\{m\.betreff\}\\n\\n\$\{m\.text\}`\)/.test(code) && code.indexOf("textPruefen(") < code.indexOf("versendenUndProtokollieren("), "fertiger Text wird VOR dem Versand geprüft");
  ok(!/sendMakeWebhook|mailDirektSenden|waSenden/.test(code) && /versendenUndProtokollieren\(/.test(code), "Versand nur über den einen Weg (versendenUndProtokollieren → Tür); kein WhatsApp");
  ok(!/openai|anthropic|kiAufruf|chatCompletion/i.test(code), "kein KI-Aufruf — die Mail ist eine feste Vorlage (läuft auch ohne Guthaben)");
  const wa = lies("shared/fiaon-lead-texte.ts");
  ok(/name: "fiaon_kk_rate"/.test(wa) && /Nur über die WhatsApp-Zentrale/.test(wa), "Begründung „nur Mail“ geprüft: die freigegebene Raten-Vorlage gehört der WhatsApp-Zentrale");

  console.log("── 10 · Rot-Proben (der Prüfstand sieht den Fehler)");
  const schlecht1 = "Letzte Erinnerung: Bitte zahlen Sie umgehend, sonst geht die Forderung an ein Inkassobüro und wir melden es der SCHUFA.";
  const f1 = R.textPruefen(schlecht1);
  ok(f1.length >= 3, "Rot-Probe Text: „Letzte Erinnerung … umgehend … Inkasso … SCHUFA“ fällt durch", f1);
  ok(R.textPruefen("Guten Tag, Ihre Rate ist offen. Sichern Sie sich jetzt Ihre Kreditkarte mit Wunschlimit.").some((x) => /Verkauf/.test(x)), "Rot-Probe Text: Verkauf (Kreditkarte/Limit) fällt durch");
  ok(R.textPruefen("Ihre Kündigung gilt erst, sobald die Zahlung eingegangen ist.").length > 0, "Rot-Probe Text: Kündigung an Zahlung geknüpft (E-393) fällt durch");
  ok(R.textPruefen((m?.text ?? "").replace(/digitale Assistentin/g, "Kollegin")).some((x) => /digitale Assistentin/.test(x)), "Rot-Probe Text: ohne KI-Offenlegung fällt durch");
  const { BANK, BANK_ALT_GESPERRT } = await import("../shared/fiaon-bank");
  ok(R.textPruefen((m?.text ?? "").split(BANK.ibanDisplay).join(BANK_ALT_GESPERRT.ibanDisplay)).some((x) => /Wortwand/.test(x)), "Rot-Probe Text: eine fremde (gesperrte) IBAN statt der Hausbank fällt durch");
  // Jede Wand einzeln: Würde die Regel sie vergessen, käme „senden“ heraus — der Prüfstand sähe es (Abschnitt 2).
  const waende: (keyof typeof basis)[] = ["nachVertragsende", "kuendigungUngebucht", "kuendigungGebucht", "widerrufOderRecht", "mahnstopp", "testperson", "globalKunde", "vertriebssperre", "eskaliert", "karteOffen", "einwand", "zahlungGemeldet", "eingangPasst", "zusageOffen", "terminSteht", "heuteRatenpost", "motorHeuteDran", "kiPause"];
  ok(waende.every((w) => U({ [w]: true } as any).art !== "senden"), "Rot-Probe Regel: jede der 18 Wände allein verhindert das Senden", waende.filter((w) => U({ [w]: true } as any).art === "senden"));
  ok(U({ kontakte: R.HOECHSTENS_KONTAKTE - 1 }).art === "senden" && U({ kontakte: R.HOECHSTENS_KONTAKTE }).art !== "senden", "Rot-Probe Regel: die Kontaktgrenze liegt genau bei 3");
  // Abnahme Welle 1 (Justin 19.10., „100 % auf Verkauf“, E-182 Dauermahnung): Die Vorabinfo vom Tag −3 zählt nicht —
  // die Zählung beginnt mit der Fälligkeit. Gemessen: so hätte Mara 128 statt 51 von 134 frisch fälligen Raten erreicht.
  ok(R.KONTAKT_VORLAUF_TAGE === 0, "Abnahme: die Zählung beginnt mit der Fälligkeit — KONTAKT_VORLAUF_TAGE = 0, die Vorabinfo vom Tag −3 zählt nicht");
  ok((ohneKommentar(srv).match(/\(r\.faellig_am - \$\{KONTAKT_VORLAUF_TAGE\}\)::timestamp AT TIME ZONE 'Europe\/Berlin'/g) ?? []).length === 2
    && /c\.created_at >= r\.faellig_am::timestamp AT TIME ZONE 'Europe\/Berlin'/.test(ohneKommentar(srv)),
  "Quelltext: Raten-Mails und WhatsApp-Raten zählen ab faellig_am − KONTAKT_VORLAUF_TAGE (zwei Stellen), Anrufe ab dem Fälligkeitstag — kein festes 7");
  const bremst = "UPDATE fiaon_abo_raten SET letzte_erinnerung_at = NOW() WHERE id = 1";
  ok(/UPDATE\s+fiaon_abo_raten/i.test(ohneKommentar(`${srv}\n${bremst}`)), "Rot-Probe Quelltext: eine Zeile, die die Mahnung verschiebt, würde Abschnitt 9 rot machen");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error("Prüfstand abgebrochen:", e); process.exit(2); });
