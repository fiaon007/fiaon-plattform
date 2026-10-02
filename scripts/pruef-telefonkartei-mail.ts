// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-274 (02.10.2026): TELEFONKARTEI — DIE FREIE E-MAIL AUS DER AKTE
//
// Justin: „bei fiaon.com/chef/s/telefonkartei in der Akte — ich brauch da ein
// Knopf wo ich den Kunden eine Email senden kann — wie jetzt, ich hatte eben
// mit [einem Kunden] telefoniert, der will einbezahlen und braucht aber die
// Mail neu."
//
// Geprüft wird mit echter Datenbank (eigene Kopie) und über die echten Routen
// (Router der Telefonkartei in einer kleinen Express-App, Chef-Cookie der Stufe
// „inhaber", wie im Chefbüro):
//   1  Wache: ohne Anmeldung 401, Stufe „leitung" 403.
//   2  mail-lage: Adresse und Anrede wie beim Versand, offene Zahlung, Verlauf.
//   3  Vorschau: HTML mit Anrede, Rechnung im Anhang — ohne Protokollzeile.
//   4  Fremde Referenz → 400 (Vorschau und Senden), nichts protokolliert, kein PDF.
//   5  Senden mit Rechnung → GENAU eine frei_text-Zeile (Kennung tk_frei,
//      Anhang-Angabe), Brevo bekommt das PDF, Verlauf der Akte mit Justins
//      Namen und agent_id NULL — kein Ergebnis, keine Zusage, keine WhatsApp.
//   6  Doppelklick: zwei gleichzeitige „Senden" → eine Zeile; ein dritter mit
//      demselben Text → „schon raus"; ein anderer Text geht sofort.
//   7  Zustellstand: aus fiaon_mail_log.zustellung („zugestellt", „blockiert").
//   8  Fertiger Antrag ohne Rechnung: Vorschau ohne Rechnungsnummer und ohne
//      Buchung; hält die Wand den Text auf, wird NICHT gestellt; Senden stellt
//      die Rechnung (pending → pending_payment) und hängt sie an.
//   9  Lead ohne Bestellung: Mail ohne Anhang, Vermerk im Lead-Verlauf; Anhang → 400.
//  10  Brevo lehnt ab: Zeile „fehlgeschlagen", der Takt ist frei (zweiter Versuch
//      läuft); ohne Adresse und mit leeren Feldern nichts.
//  11  Nur archivierte Bestellungen (Gegenprüfung): Die Mail steht trotzdem im
//      Verlauf der Akte — an der Bestellung der Karte, genau ein Eintrag.
//
// NUR gegen einen lokalen Prüfstand (127.0.0.1:54329, Datenbank fiaon_…). Es geht
// keine Mail raus: fetch ist eine Attrappe (Brevo antwortet 201 aus diesem
// Skript), der Schlüssel ist ein Platzhalter. Eigene Testzeilen: Personen
// 927401–927420, Referenzen TK274-…, Adressen @tk274.invalid.
//
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_e274?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal npx tsx scripts/pruef-telefonkartei-mail.ts
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";

if (!/@127\.0\.0\.1:54329\/fiaon_[a-z0-9_]+/.test(process.env.DATABASE_URL ?? "")) {
  console.error("NUR gegen einen lokalen Prüfstand (127.0.0.1:54329/fiaon_…)!"); process.exit(2);
}
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "META_SYSTEM_TOKEN", "RESEND_API_KEY", "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "MAKE_WEBHOOK_URL"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
// Platzhalter: Der Motor verlangt einen Schlüssel, bevor er fetch ruft — fetch ist unten die Attrappe.
process.env.BREVO_API_KEY = "pruefstand-attrappe-kein-schluessel";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
process.env.MAKE_WEBHOOK_URL = "http://make.pruefstand.invalid/hook";

// ── KEIN NETZ: Brevo ist eine Attrappe, alles andere außer der eigenen App wirft ──
const echtesFetch = globalThis.fetch;
const FEHL_ADRESSE = "p927409@tk274.invalid";
const brevo: { an: string; betreff: string; html: string; anhaenge: { name: string; groesse: number }[] }[] = [];
const fremd: string[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url ?? input);
  if (url.startsWith("http://127.0.0.1:")) return echtesFetch(input, init);
  if (url === "https://api.brevo.com/v3/smtp/email") {
    const j = JSON.parse(String(init?.body ?? "{}"));
    brevo.push({
      an: String(j.to?.[0]?.email ?? ""), betreff: String(j.subject ?? ""), html: String(j.htmlContent ?? ""),
      anhaenge: (j.attachment ?? []).map((a: any) => ({ name: String(a.name), groesse: Buffer.from(String(a.content ?? ""), "base64").length })),
    });
    if (j.to?.[0]?.email === FEHL_ADRESSE) return new Response(JSON.stringify({ message: "Prüfstand: abgelehnt" }), { status: 400 });
    return new Response(JSON.stringify({ messageId: `<pruef274.${brevo.length}@smtp-relay.invalid>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  fremd.push(url);
  throw new Error(`Prüfstand: kein Netz (${url})`);
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const tk = await import("../server/lib/fiaon-telefonkartei");
const express = (await import("express")).default;
const cookieParser = (await import("cookie-parser")).default;
const router = (await import("../server/routes/fiaon-telefonkartei")).default;
const { mailZahlungsdaten } = await import("../shared/fiaon-telefonkartei");

let ok = 0, fehl = 0;
const pruef = (name: string, bed: boolean, info: unknown = "") => {
  if (bed) { ok++; console.log(`  ✓ ${name}`); }
  else { fehl++; console.log(`  ✗ ${name}${info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);

const IDS = Array.from({ length: 20 }, (_, i) => 927401 + i);
const DOMAIN = "tk274.invalid";
const AGENT = 999274; // kein Mitarbeiter — akteurName fällt auf Justin zurück
const AKTEUR = "Justin Schwarzott";
const P = { B1: 927401, B2: 927402, NEU: 927403, LEAD: 927404, OHNE: 927405, ARCH: 927406, FEHL: 927409 };

async function aufraeumen() {
  const spalten = (await sqlPool`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name IN ('person_id', 'ref')
       AND table_name NOT IN ('fiaon_persons', 'fiaon_applications', 'fiaon_leads')`) as any[];
  for (const s of spalten) {
    const t = String(s.table_name);
    if (s.column_name === "person_id") await sqlPool.unsafe(`DELETE FROM "${t}" WHERE person_id::text = ANY($1)`, [IDS.map(String)]).catch(() => {});
    else await sqlPool.unsafe(`DELETE FROM "${t}" WHERE ref::text LIKE 'TK274-%'`).catch(() => {});
  }
  await sqlPool`DELETE FROM fiaon_mail_log WHERE empfaenger LIKE ${"%@" + DOMAIN}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_lead_log WHERE lead_id IN (SELECT id FROM fiaon_leads WHERE email LIKE ${"%@" + DOMAIN})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_leads WHERE person_id = ANY(${IDS}) OR email LIKE ${"%@" + DOMAIN}`;
  await sqlPool`DELETE FROM fiaon_applications WHERE person_id = ANY(${IDS}) OR ref LIKE 'TK274-%'`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${IDS})`;
}
async function person(id: number, o: { tier: number; grund?: string; email?: string | null; nach?: string }) {
  await sqlPool`
    INSERT INTO fiaon_persons (id, person_ref, first_name, last_name, primary_email, primary_phone, country,
                               priority_tier, tier_reason, created_at, updated_at)
    VALUES (${id}, ${`TK274-P${id}`}, 'Manuel', ${o.nach ?? `Mail${id}`}, ${o.email === undefined ? `p${id}@${DOMAIN}` : o.email},
            ${`+4915900${id}`}, 'DE', ${o.tier}, ${o.grund ?? (o.tier === 2 ? "rechnung_offen" : "nur_lead")}, NOW() - INTERVAL '3 days', NOW())`;
}
/** Eine abgeschickte Bestellung: mit Rechnung (pending_payment) oder ohne (pending). */
async function bestellung(id: number, zahlung: "pending_payment" | "pending"): Promise<{ ref: string; referenz: string }> {
  const ref = `TK274-${id}`;
  const referenz = `FIAON-T${String(id).slice(-5)}`;
  await sqlPool`
    INSERT INTO fiaon_applications (ref, payment_reference, type, status, current_step, pack_key, pack_name, first_name, last_name,
                                    email, country, person_id, payment_status, amount_due, submitted_at, created_at, updated_at)
    VALUES (${ref}, ${referenz}, 'privat', 'submitted', 9, 'pro', 'FIAON Pro (Standard)', 'Manuel', ${`Mail${id}`},
            ${`p${id}@${DOMAIN}`}, 'DE', ${id}, ${zahlung}, 59.99, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW())`;
  return { ref, referenz };
}
const zeilen = async (id: number) => (await sqlPool`
  SELECT id, event, status, grund, empfaenger, ausgeloest_von, brevo_message_id, payload
  FROM fiaon_mail_log WHERE person_id = ${id} ORDER BY id`) as any[];
const nutz = (p: unknown): any => { let x: any = p; for (let i = 0; i < 2 && typeof x === "string"; i++) x = JSON.parse(x); return x ?? {}; };

// ── Die App: derselbe Router wie in server/routes.ts, mit Cookie und JSON ──
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/fiaon", router);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const port = (server.address() as AddressInfo).port;
const cookie = (stufe: string) => {
  const exp = Date.now() + 3_600_000;
  const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${AGENT}:${stufe}:${exp}`).digest("hex").slice(0, 40);
  return `fiaon_chef=${AGENT}.${stufe}.${exp}.${sig}`;
};
async function rufe(methode: "GET" | "POST", pfad: string, body?: unknown, stufe: string | null = "inhaber"): Promise<{ status: number; j: any }> {
  const r = await echtesFetch(`http://127.0.0.1:${port}/api/fiaon${pfad}`, {
    method: methode,
    headers: { "Content-Type": "application/json", ...(stufe ? { Cookie: cookie(stufe) } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, j: await r.json().catch(() => null) };
}

try {
  await aufraeumen();
  await tk.karteiTabellen();

  await person(P.B1, { tier: 2 }); const b1 = await bestellung(P.B1, "pending_payment");
  await person(P.B2, { tier: 2 }); const b2 = await bestellung(P.B2, "pending_payment");
  await person(P.NEU, { tier: 2 }); const neu = await bestellung(P.NEU, "pending");
  await person(P.LEAD, { tier: 3 });
  const [lead] = (await sqlPool`
    INSERT INTO fiaon_leads (person_id, email, vorname, nachname, telefon, erstellt_am, updated_at)
    VALUES (${P.LEAD}, ${`p${P.LEAD}@${DOMAIN}`}, 'Manuel', ${`Mail${P.LEAD}`}, ${`+4915900${P.LEAD}`}, NOW() - INTERVAL '1 day', NOW())
    RETURNING id`) as any[];
  await person(P.OHNE, { tier: 2, email: null }); await bestellung(P.OHNE, "pending_payment");
  // Ohne Adresse heißt: weder an der Person noch an einer Bestellung (ein Abgleich trägt die Bestelladresse sonst nach).
  await sqlPool`UPDATE fiaon_applications SET email = NULL, contact_email = NULL, billing_email = NULL WHERE person_id = ${P.OHNE}`;
  await sqlPool`UPDATE fiaon_persons SET primary_email = NULL WHERE id = ${P.OHNE}`;
  await person(P.FEHL, { tier: 2 }); await bestellung(P.FEHL, "pending_payment");

  // ═════════════════════════════════════════════════════════════════════════
  titel("1  Wache: nur das Chefbüro, Stufe Inhaber");
  // ═════════════════════════════════════════════════════════════════════════
  const ohneAnmeldung = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { betreff: "x", text: "y" }, null);
  pruef(`ohne Anmeldung 401 (${ohneAnmeldung.status})`, ohneAnmeldung.status === 401);
  const leitung = await rufe("GET", `/chef/telefonkartei/${P.B1}/mail-lage`, undefined, "leitung");
  pruef(`Stufe „leitung“ 403 (${leitung.status})`, leitung.status === 403);
  pruef("nichts protokolliert", (await zeilen(P.B1)).length === 0);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2  mail-lage: Adresse, Anrede, offene Zahlung");
  // ═════════════════════════════════════════════════════════════════════════
  const lage = await rufe("GET", `/chef/telefonkartei/${P.B1}/mail-lage`);
  pruef(`200 ok (${lage.status})`, lage.status === 200 && lage.j?.ok === true, lage.j);
  pruef(`Empfänger = Adresse des Versands (${lage.j?.empfaenger})`, lage.j?.empfaenger === `p${P.B1}@${DOMAIN}`);
  pruef(`Anrede „${lage.j?.anrede}“`, lage.j?.anrede === `Guten Tag Manuel Mail${P.B1},`);
  pruef(`offene Zahlung ${lage.j?.zahlung?.referenz} (Bestellung, Rechnung gestellt)`, lage.j?.zahlung?.referenz === b1.referenz && lage.j?.zahlung?.art === "bestellung" && lage.j?.zahlung?.nochKeineRechnung === false);
  pruef(`Absender = Justin (${lage.j?.absender})`, lage.j?.absender === AKTEUR);
  pruef("Verlauf leer", Array.isArray(lage.j?.verlauf) && lage.j.verlauf.length === 0);
  const lageLead = await rufe("GET", `/chef/telefonkartei/${P.LEAD}/mail-lage`);
  pruef("Lead ohne Bestellung: keine Zahlung (keine Schnellwahl, kein Anhang)", lageLead.j?.ok && lageLead.j.zahlung === null);
  const lageOhne = await rufe("GET", `/chef/telefonkartei/${P.OHNE}/mail-lage`);
  pruef("ohne Adresse: empfaenger null (das Blatt sagt es)", lageOhne.j?.ok && lageOhne.j.empfaenger === null);
  const lageWeg = await rufe("GET", `/chef/telefonkartei/927420/mail-lage`);
  pruef(`unbekannte Person 404 (${lageWeg.status})`, lageWeg.status === 404);

  // Die Schnellwahl aus der echten Karte — derselbe Text, den das Blatt einsetzt.
  const karteB1 = (await tk.karteEinzeln(P.B1))!;
  const schnell = mailZahlungsdaten({ ...karteB1, zahlung: lage.j.zahlung }, AKTEUR, true)!;
  pruef("Schnellwahl aus der Karte: Betrag, Verwendungszweck, Zahlungsseite", /59,99/.test(schnell.text) && schnell.text.includes(b1.referenz) && schnell.text.includes(`/zahlung/${b1.referenz}`));

  // ═════════════════════════════════════════════════════════════════════════
  titel("3  Vorschau: so, wie die Mail ankommt — ohne Wirkung");
  // ═════════════════════════════════════════════════════════════════════════
  const vor = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail/vorschau`, { ...schnell, anhangReferenz: b1.referenz });
  pruef(`200 ok (${vor.status})`, vor.status === 200 && vor.j?.ok === true, vor.j?.meldung);
  pruef("HTML trägt die Anrede und den Text", String(vor.j?.vorschau?.html).includes(`Guten Tag Manuel Mail${P.B1},`) && String(vor.j?.vorschau?.html).includes(b1.referenz));
  pruef(`Anhang: Rechnung ${vor.j?.anhang?.rechnungsnummer} über ${vor.j?.anhang?.betrag}`, !!vor.j?.anhang?.rechnungsnummer && vor.j.anhang.betrag === "59.99" && !vor.j.anhangBeimSenden);
  pruef(`Absender FIAON (${vor.j?.vorschau?.absender})`, /welcome@fiaon\.com/.test(String(vor.j?.vorschau?.absender)));
  pruef("keine Protokollzeile, kein Brevo-Aufruf", (await zeilen(P.B1)).length === 0 && brevo.length === 0);
  const vorOhneAnhang = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail/vorschau`, schnell);
  pruef(`„im Anhang“ ohne Anhang: die Wand hält auf (${vorOhneAnhang.status})`, vorOhneAnhang.status === 409 && /Wortwand/.test(String(vorOhneAnhang.j?.meldung)), vorOhneAnhang.j);

  // ═════════════════════════════════════════════════════════════════════════
  titel("4  Fremde Referenz → 400");
  // ═════════════════════════════════════════════════════════════════════════
  const fremdVor = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail/vorschau`, { ...schnell, anhangReferenz: b2.referenz });
  pruef(`Vorschau mit der Referenz eines anderen Kunden: 400 (${fremdVor.status})`, fremdVor.status === 400 && fremdVor.j?.ok === false, fremdVor.j);
  const fremdSenden = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { ...schnell, anhangReferenz: b2.referenz });
  pruef(`Senden mit fremder Referenz: 400 (${fremdSenden.status}) — „${fremdSenden.j?.meldung}“`, fremdSenden.status === 400 && /nicht die offene Zahlung/.test(String(fremdSenden.j?.meldung)));
  const erfunden = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { ...schnell, anhangReferenz: "FIAON-XXXXXX-1" });
  pruef(`erfundene Referenz: 400 (${erfunden.status})`, erfunden.status === 400);
  pruef("nichts protokolliert, nichts an Brevo", (await zeilen(P.B1)).length === 0 && brevo.length === 0);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5  Senden mit Rechnung — eine Zeile, Verlauf, kein Ergebnis");
  // ═════════════════════════════════════════════════════════════════════════
  const vorher = (await sqlPool`SELECT promised_payment_date, priority_tier FROM fiaon_persons WHERE id = ${P.B1}`) as any[];
  const raus = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { ...schnell, anhangReferenz: b1.referenz });
  pruef(`200 ok — „${raus.j?.meldung}“`, raus.status === 200 && raus.j?.ok === true && raus.j.meldung === `Gesendet an p${P.B1}@${DOMAIN}` && !raus.j.doppelt, raus.j);
  const z5 = await zeilen(P.B1);
  pruef(`GENAU eine Protokollzeile (${z5.length})`, z5.length === 1);
  const n5 = nutz(z5[0]?.payload);
  pruef(`frei_text · versandt · Kennung tk_frei · von ${z5[0]?.ausgeloest_von}`, z5[0]?.event === "frei_text" && z5[0]?.status === "versandt" && n5.kennung === "tk_frei" && z5[0]?.ausgeloest_von === AKTEUR);
  pruef(`Anhang-Angabe im Protokoll: ${n5.anhang?.rechnungsnummer} über ${n5.anhang?.betrag} €`, !!n5.anhang?.rechnungsnummer && n5.anhang.betrag === "59.99" && n5.anhang.art === "bestellung");
  pruef("Brevo-Kennung gespeichert", /^<pruef274\./.test(String(z5[0]?.brevo_message_id)));
  const b = brevo[brevo.length - 1];
  pruef(`Brevo: an ${b?.an}, Betreff „${b?.betreff}“, Anhang ${b?.anhaenge.map((a) => `${a.name} (${a.groesse} B)`).join(", ")}`,
    b?.an === `p${P.B1}@${DOMAIN}` && b.betreff === schnell.betreff && b.anhaenge.length === 1 && /\.pdf$/.test(b.anhaenge[0].name) && b.anhaenge[0].groesse > 1000);
  const verlauf5 = (await sqlPool`SELECT agent_id, agent_name, type, outcome, note FROM fiaon_contact_log WHERE ref = ${b1.ref} ORDER BY id`) as any[];
  pruef(`Verlauf der Akte: ein Eintrag mit Justins Namen, agent_id NULL — „${String(verlauf5[0]?.note).slice(0, 90)}…“`,
    verlauf5.length === 1 && verlauf5[0].agent_id === null && verlauf5[0].agent_name === AKTEUR && /mit Rechnung .* im Anhang/.test(String(verlauf5[0].note)));
  pruef("kein Gesprächsergebnis (keine result-Zeile)", verlauf5.every((v) => v.type !== "result" && !v.outcome));
  const nachher = (await sqlPool`SELECT promised_payment_date, priority_tier FROM fiaon_persons WHERE id = ${P.B1}`) as any[];
  pruef("kein Zusagedatum, Stufe unverändert", nachher[0].promised_payment_date === vorher[0].promised_payment_date && nachher[0].priority_tier === vorher[0].priority_tier);
  pruef(`keine WhatsApp, kein anderes Netz (${fremd.length ? fremd.join(", ") : "nichts"})`, fremd.length === 0);
  pruef(`Antwort trägt den Verlauf: „${raus.j?.verlauf?.[0]?.betreff}“ — ${raus.j?.verlauf?.[0]?.stand}`,
    raus.j?.verlauf?.[0]?.betreff === schnell.betreff && raus.j.verlauf[0].stand === "gesendet" && raus.j.verlauf[0].mitAnhang === true && raus.j.verlauf[0].ausKartei === true);

  // ═════════════════════════════════════════════════════════════════════════
  titel("6  Doppelklick");
  // ═════════════════════════════════════════════════════════════════════════
  const nochmal = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { ...schnell, anhangReferenz: b1.referenz });
  pruef(`derselbe Text gleich danach: „schon raus“ (${nochmal.j?.meldung})`, nochmal.status === 200 && nochmal.j?.doppelt === true);
  const frei = { betreff: "Kurze Rückfrage zu Ihren Unterlagen", text: "können Sie mir bitte noch Ihren Gehaltsnachweis schicken?\n\nViele Grüße\nJustin Schwarzott" };
  const [x1, x2] = await Promise.all([
    rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, frei),
    rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, frei),
  ]);
  pruef(`zwei gleichzeitige „Senden“: eine Mail, ein „schon raus“ (${[x1.j?.doppelt, x2.j?.doppelt].join("/")})`, x1.j?.ok && x2.j?.ok && [x1.j.doppelt, x2.j.doppelt].filter(Boolean).length === 1);
  const z6 = await zeilen(P.B1);
  pruef(`Protokoll: zwei Zeilen insgesamt (${z6.length}) — die zweite ohne Anhang`, z6.length === 2 && !nutz(z6[1].payload).anhang);
  const anders = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { ...frei, betreff: "Ihre Unterlagen – Nachtrag" });
  pruef("ein anderer Text geht sofort", anders.j?.ok && !anders.j.doppelt && (await zeilen(P.B1)).length === 3);
  const takt = (await sqlPool`SELECT art FROM fiaon_telefonkartei_takt WHERE person_id = ${P.B1}`) as any[];
  pruef(`Takt je Text (${takt.length} Zeilen, „mail:…“)`, takt.length === 3 && takt.every((t) => /^mail:[0-9a-f]{16}$/.test(t.art)));

  // ═════════════════════════════════════════════════════════════════════════
  titel("7  Zustellstand aus fiaon_mail_log");
  // ═════════════════════════════════════════════════════════════════════════
  await sqlPool`UPDATE fiaon_mail_log SET zustellung = 'zugestellt', zustellung_am = NOW() WHERE id = ${z5[0].id}`;
  await sqlPool`UPDATE fiaon_mail_log SET zustellung = 'blockiert', zustellung_grund = 'Empfänger hat sich abgemeldet' WHERE id = ${z6[1].id}`;
  const lage7 = await rufe("GET", `/chef/telefonkartei/${P.B1}/mail-lage`);
  const st = (id: number) => lage7.j?.verlauf?.find((v: any) => v.id === Number(id));
  pruef(`erste Mail „${st(z5[0].id)?.stand}“ (gut)`, st(z5[0].id)?.stand === "zugestellt" && st(z5[0].id)?.ton === "gut");
  pruef(`zweite Mail „${st(z6[1].id)?.stand}“ mit Grund (rot)`, st(z6[1].id)?.stand === "blockiert" && st(z6[1].id)?.ton === "warn" && st(z6[1].id)?.grund === "Empfänger hat sich abgemeldet");
  pruef("neueste zuerst, „gesendet“ ohne Abgleich", lage7.j?.verlauf?.[0]?.stand === "gesendet" && lage7.j.verlauf.length === 3);

  // ═════════════════════════════════════════════════════════════════════════
  titel("8  Fertiger Antrag ohne Rechnung");
  // ═════════════════════════════════════════════════════════════════════════
  const lage8 = await rufe("GET", `/chef/telefonkartei/${P.NEU}/mail-lage`);
  pruef("Karte: Zahlung mit „noch keine Rechnung“", lage8.j?.zahlung?.nochKeineRechnung === true && lage8.j.zahlung.referenz === neu.referenz);
  const schnell8 = mailZahlungsdaten({ ...(await tk.karteEinzeln(P.NEU))!, zahlung: lage8.j.zahlung }, AKTEUR, true)!;
  const vor8 = await rufe("POST", `/chef/telefonkartei/${P.NEU}/mail/vorschau`, { ...schnell8, anhangReferenz: neu.referenz });
  pruef(`Vorschau: Rechnung „wird beim Senden gestellt“ (${vor8.j?.anhang?.betrag})`, vor8.j?.ok && vor8.j.anhangBeimSenden === true && vor8.j.anhang?.rechnungsnummer === "" && vor8.j.anhang?.betrag === "59.99", vor8.j);
  const stand8a = (await sqlPool`SELECT payment_status, invoice_number FROM fiaon_applications WHERE ref = ${neu.ref}`) as any[];
  pruef(`Vorschau bucht nichts (Status ${stand8a[0].payment_status}, Rechnungsnummer ${stand8a[0].invoice_number ?? "keine"})`, stand8a[0].payment_status === "pending" && !stand8a[0].invoice_number);
  const gesperrt = await rufe("POST", `/chef/telefonkartei/${P.NEU}/mail`, { ...schnell8, text: `${schnell8.text}\n\nIBAN: DE86 2022 0800 0047 7193 24`, anhangReferenz: neu.referenz });
  const stand8b = (await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${neu.ref}`) as any[];
  pruef(`Wand hält den Text auf (${gesperrt.status}) — und es wird NICHT in Rechnung gestellt (${stand8b[0].payment_status})`,
    gesperrt.status === 409 && /Wortwand/.test(String(gesperrt.j?.meldung)) && stand8b[0].payment_status === "pending" && (await zeilen(P.NEU)).length === 0, gesperrt.j);
  const raus8 = await rufe("POST", `/chef/telefonkartei/${P.NEU}/mail`, { ...schnell8, anhangReferenz: neu.referenz });
  const stand8c = (await sqlPool`SELECT payment_status, invoice_number, payment_due_date FROM fiaon_applications WHERE ref = ${neu.ref}`) as any[];
  pruef(`Senden stellt die Rechnung (${stand8c[0].payment_status}, Frist ${stand8c[0].payment_due_date ? "gesetzt" : "fehlt"}) und hängt sie an (${raus8.j?.anhang?.rechnungsnummer})`,
    raus8.j?.ok && stand8c[0].payment_status === "pending_payment" && !!stand8c[0].payment_due_date && !!raus8.j.anhang?.rechnungsnummer && (await zeilen(P.NEU)).length === 1, raus8.j);

  // ═════════════════════════════════════════════════════════════════════════
  titel("9  Lead ohne Bestellung");
  // ═════════════════════════════════════════════════════════════════════════
  const leadAnhang = await rufe("POST", `/chef/telefonkartei/${P.LEAD}/mail`, { ...frei, anhangReferenz: b1.referenz });
  pruef(`Anhang beim Lead: 400 — „${leadAnhang.j?.meldung}“`, leadAnhang.status === 400 && /keine offene Zahlung/.test(String(leadAnhang.j?.meldung)));
  const leadRaus = await rufe("POST", `/chef/telefonkartei/${P.LEAD}/mail`, frei);
  const ll = (await sqlPool`SELECT agent_id, agent_name, type, outcome, note FROM fiaon_lead_log WHERE lead_id = ${lead.id}`) as any[];
  pruef(`Mail raus, Vermerk im Lead-Verlauf: „${ll[0]?.note}“`, leadRaus.j?.ok && ll.length === 1 && ll[0].agent_id === null && ll[0].agent_name === AKTEUR && ll[0].type === "note" && !ll[0].outcome && /Telefonkartei/.test(String(ll[0].note)));
  const leadStand = (await sqlPool`SELECT status FROM fiaon_leads WHERE id = ${lead.id}`) as any[];
  pruef(`Lead-Status unverändert (${leadStand[0].status ?? "leer"})`, leadStand[0].status !== "kontaktiert");

  // ═════════════════════════════════════════════════════════════════════════
  titel("10  Brevo lehnt ab · keine Adresse · leere Felder");
  // ═════════════════════════════════════════════════════════════════════════
  const f1 = await rufe("POST", `/chef/telefonkartei/${P.FEHL}/mail`, frei);
  pruef(`Brevo lehnt ab: 409 — „${String(f1.j?.meldung).slice(0, 60)}…“`, f1.status === 409 && f1.j?.ok === false);
  const zf = await zeilen(P.FEHL);
  pruef(`Protokoll „fehlgeschlagen“ mit Grund — die Antwort zeigt „${f1.j?.verlauf?.[0]?.stand}“`, zf.length === 1 && zf[0].status === "fehlgeschlagen" && !!zf[0].grund && f1.j?.verlauf?.[0]?.stand === "nicht gesendet" && f1.j.verlauf[0].ton === "warn");
  const f2 = await rufe("POST", `/chef/telefonkartei/${P.FEHL}/mail`, frei);
  pruef("der Takt ist frei — der zweite Versuch läuft (kein „schon raus“)", f2.status === 409 && !f2.j?.doppelt && (await zeilen(P.FEHL)).length === 2);
  const ohne = await rufe("POST", `/chef/telefonkartei/${P.OHNE}/mail`, frei);
  pruef(`ohne Adresse: 409 — „${ohne.j?.meldung}“`, ohne.status === 409 && /Keine E-Mail-Adresse/.test(String(ohne.j?.meldung)) && (await zeilen(P.OHNE)).length === 0);
  const leer = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { betreff: " ", text: "Hallo" });
  pruef(`leerer Betreff: 400 (${leer.status})`, leer.status === 400);
  const lang = await rufe("POST", `/chef/telefonkartei/${P.B1}/mail`, { betreff: "x".repeat(201), text: "Hallo" });
  pruef(`zu langer Betreff: 400 (${lang.status})`, lang.status === 400);
  pruef(`kein anderes Netz als die Brevo-Attrappe (${brevo.length} Mails)`, fremd.length === 0);

  // ═════════════════════════════════════════════════════════════════════════
  titel("11  Nur archivierte Bestellungen — der Verlauf fehlt nicht");
  // ═════════════════════════════════════════════════════════════════════════
  // Gegenprüfung E-274 (02.10.2026): freitextVersenden schreibt den Verlauf an die jüngste NICHT
  // archivierte Bestellung (freitextZiel). Sind alle archiviert (gemessen: 22 Menschen mit Adresse,
  // darunter der Global-Kunde aus E-272), schrieb niemand einen Eintrag — das Blatt sagte trotzdem
  // „Steht im Verlauf der Akte“. Die Akte liest das Kontaktprotokoll der ganzen Familie, auch archivierter.
  await person(P.ARCH, { tier: 2 }); const arch = await bestellung(P.ARCH, "pending");
  await sqlPool`UPDATE fiaon_applications SET archived_at = NOW() WHERE ref = ${arch.ref}`;
  const lage11 = await rufe("GET", `/chef/telefonkartei/${P.ARCH}/mail-lage`);
  pruef("Karte ohne offene Zahlung (archiviert), Adresse da", lage11.j?.ok && lage11.j.zahlung === null && lage11.j.empfaenger === `p${P.ARCH}@${DOMAIN}`, lage11.j);
  const raus11 = await rufe("POST", `/chef/telefonkartei/${P.ARCH}/mail`, frei);
  const v11 = (await sqlPool`SELECT agent_id, agent_name, type, outcome, note FROM fiaon_contact_log WHERE ref = ${arch.ref} ORDER BY id`) as any[];
  pruef(`Mail raus, EIN Eintrag im Verlauf der Akte: „${String(v11[0]?.note ?? "—").slice(0, 90)}“`,
    raus11.j?.ok === true && (await zeilen(P.ARCH)).length === 1 && v11.length === 1 && v11[0].agent_id === null
      && v11[0].agent_name === AKTEUR && v11[0].type === "system" && !v11[0].outcome && String(v11[0].note).includes(frei.betreff), { antwort: raus11.j, verlauf: v11 });
  pruef(`kein anderes Netz als die Brevo-Attrappe (${brevo.length} Mails)`, fremd.length === 0);
} catch (e) {
  fehl++;
  console.error("ABBRUCH:", e);
} finally {
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  server.close();
  await sqlPool.end({ timeout: 2 }).catch(() => {});
}

console.log(`\n${fehl === 0 ? "✓" : "✗"} ${ok}/${ok + fehl} Prüfungen bestanden${fehl ? ` — ${fehl} FEHLER` : ""}`);
process.exit(fehl ? 1 : 0);
