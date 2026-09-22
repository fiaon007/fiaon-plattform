// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND LEAD-MOTOR (22.09.2026, E-210) — ohne Netz, ohne Datenbank
//
// Prüft alles, was ohne Meta-Zugang und ohne Datenbank prüfbar ist:
//   · die EINE Anrede (shared/fiaon-anrede.ts) — Schreibweise, Müll-Namen, Titel
//   · die Abbildung eines Meta-Leads (Namen, Telefon, Einwilligung, Herkunft)
//   · die Signaturprüfung des Webhooks und den abgeleiteten Prüf-Token
//   · den Kurzlink (Form, Kanal)
//   · jeden festen Text (Begrüßung, Strecke, WhatsApp-Entwürfe, Einwilligung)
//     gegen die Wortwand, die Strecken-Wörter, die Sie-Wand und die Emoji-Wand
//   · die Begrüßungsmail, wie der Motor sie rendert
//
//   npx tsx scripts/pruef-lead-motor.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { anredeMail, anredeChat, nameFuerAnrede, nameBrauchbar, schreibweiseFuerAnzeige } from "../shared/fiaon-anrede";
import { META_EREIGNIS, CRM_EREIGNIS, EREIGNIS_TEXT, metaEreignisId } from "../shared/fiaon-meta-ereignisse";

process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const gleich = (ist: unknown, soll: unknown, text: string) => ok(ist === soll, `${text} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
export const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

// ── 1. Anrede ──────────────────────────────────────────────────────────────
abschnitt("Anrede — eine Regel für alle Kanäle");
gleich(anredeMail({ vorname: "Maria", nachname: "Muster" }), "Guten Tag Maria Muster,", "voller Name");
gleich(anredeChat({ vorname: "Maria", nachname: "Muster" }), "Hallo Maria Muster,", "Chat mit vollem Namen");
gleich(anredeMail({ vorname: "Maria", nachname: "Muster", anrede: "Frau" }), "Guten Tag Frau Muster,", "mit Anrede Frau");
gleich(anredeChat({ vorname: "Klaus", nachname: "Berg", anrede: "herr" }), "Hallo Herr Berg,", "mit Anrede Herr (klein geschrieben)");
gleich(anredeMail({ vorname: "Dr. Maria", nachname: "Muster", anrede: "Frau" }), "Guten Tag Frau Dr. Muster,", "Titel gehört vor den Nachnamen");
gleich(anredeMail({ vorname: "Dr. Maria", nachname: "Muster" }), "Guten Tag Dr. Maria Muster,", "Titel beim vollen Namen");
gleich(anredeMail({ vorname: "max", nachname: "mustermann" }), "Guten Tag Max Mustermann,", "alles klein → groß geschrieben");
gleich(anredeMail({ vorname: "ANNA", nachname: "VON DER HEIDE" }), "Guten Tag Anna von der Heide,", "alles GROSS → Zusätze klein");
gleich(anredeMail({ vorname: "hans-peter", nachname: "o'brien" }), "Guten Tag Hans-Peter O'Brien,", "Bindestrich und Apostroph");
gleich(anredeMail({ vorname: "Maria", nachname: "McDonald" }), "Guten Tag Maria McDonald,", "gemischte Schreibweise bleibt");
gleich(anredeMail({ vorname: "Maria", nachname: "de Vries" }), "Guten Tag Maria de Vries,", "gemischt mit Zusatz bleibt");
gleich(anredeMail({ vorname: "Maria", nachname: null }), "Guten Tag Maria,", "nur Vorname");
gleich(anredeMail({ vorname: "01761234567", nachname: null }), "Guten Tag,", "Telefonnummer im Namensfeld");
gleich(anredeMail({ vorname: "maria@web.de", nachname: "Muster" }), "Guten Tag,", "Mailadresse im Vornamen → keine Anrede mit Name");
gleich(anredeMail({ vorname: "test", nachname: "test" }), "Guten Tag,", "Füllwort");
gleich(anredeMail({ vorname: "M", nachname: "Muster" }), "Guten Tag,", "Einzelbuchstabe als Vorname");
gleich(anredeMail({ vorname: "M", nachname: "Muster", anrede: "Frau" }), "Guten Tag Frau Muster,", "Einzelbuchstabe, aber Anrede bekannt");
gleich(anredeMail({ vorname: "aaaa", nachname: null }), "Guten Tag,", "ein Zeichen wiederholt");
gleich(anredeMail({ vorname: "Maria 🌸", nachname: "Muster" }), "Guten Tag Maria Muster,", "Emoji fällt weg");
gleich(anredeMail({ vorname: "  Maria  ", nachname: "  Muster " }), "Guten Tag Maria Muster,", "Leerraum");
gleich(anredeMail({}), "Guten Tag,", "gar nichts");
gleich(anredeChat({}), "Hallo,", "Chat ohne Namen");
gleich(anredeMail({ vorname: "Jörg", nachname: "ÖZTÜRK" }), "Guten Tag Jörg Öztürk,", "jeder Teil wird für sich beurteilt (Nachname GROSS)");
gleich(schreibweiseFuerAnzeige("ÖZTÜRK"), "Öztürk", "Umlaute groß → Öztürk");
ok(!nameBrauchbar("Herr"), "„Herr“ ist kein Name");
ok(nameBrauchbar("Al"), "zwei Buchstaben sind ein Name");
gleich(nameFuerAnrede({ vorname: "Prof. Dr. Klaus", nachname: "Berg" }).titel, "Prof. Dr.", "mehrere Titel");

// ── 2. Meta-Abbildung ──────────────────────────────────────────────────────
abschnitt("Meta-Lead → unsere Felder");
process.env.META_APP_ID = "1234567890";
process.env.META_APP_SECRET = "pruefstand-geheim";
process.env.META_SYSTEM_TOKEN = "pruefstand-token";
const { leadAusMeta, einwilligungErkennen } = await import("../server/lib/fiaon-meta-leads");
const roh = {
  id: "9001", created_time: "2026-09-22T12:00:00+0000", platform: "ig",
  ad_id: "a1", ad_name: "Karte Video 3", adset_id: "g1", adset_name: "DE 25-45", campaign_id: "c1", campaign_name: "DE Kampagne 2", form_id: "f1",
  field_data: [
    { name: "full_name", values: ["maria muster"] }, { name: "email", values: ["Maria@Web.de"] },
    { name: "phone_number", values: ["+4917612345678"] }, { name: "wann_moechten_sie_starten", values: ["Sofort"] },
  ],
  custom_disclaimer_responses: [{ checkbox_key: "kontakt_whatsapp", is_checked: "1" }, { checkbox_key: "newsletter", is_checked: "0" }],
};
const f1 = leadAusMeta(roh as any);
gleich(f1.vollname, "maria muster", "voller Name aus full_name");
gleich(f1.email, "Maria@Web.de", "E-Mail (Kleinschreibung macht der Eingang)");
gleich(f1.telefon, "+4917612345678", "Telefon");
gleich(f1.plattform, "instagram", "ig → instagram");
gleich(f1.whatsappErlaubt, true, "Kästchen mit „whatsapp“ im Schlüssel angehakt → erlaubt");
gleich(f1.fragen.wann_moechten_sie_starten, "Sofort", "eigene Frage bleibt erhalten");
gleich(leadAusMeta(roh as any, "newsletter").whatsappErlaubt, false, "zugeordnetes Kästchen nicht angehakt → nicht erlaubt");
gleich(leadAusMeta(roh as any, "gibt_es_nicht").whatsappErlaubt, true, "zugeordnetes Kästchen fehlt in der Antwort → der Hinweistext gilt");
gleich(leadAusMeta({ id: "1", field_data: [{ name: "first_name", values: ["Anna"] }, { name: "last_name", values: ["Berg"] }] } as any).whatsappErlaubt, true, "ohne Kästchen → erlaubt (Hinweistext im Formular)");
gleich(leadAusMeta({ id: "1", field_data: [{ name: "first_name", values: ["Anna"] }, { name: "last_name", values: ["Berg"] }] } as any).nachname, "Berg", "Vorname/Nachname getrennt");
gleich(leadAusMeta({ id: "1", platform: "fb" } as any).plattform, "facebook", "fb → facebook");
gleich(einwilligungErkennen({ id: "f", legal_content: { custom_disclaimer: { checkboxes: [{ key: "k1", text: "Ja, FIAON darf mich per WhatsApp kontaktieren" }] } } } as any), "k1", "Kästchen am Text „WhatsApp“ erkannt");
gleich(einwilligungErkennen({ id: "f", legal_content: { custom_disclaimer: { checkboxes: [{ key: "k1", text: "Newsletter" }] } } } as any), null, "kein WhatsApp-Kästchen");

// ── 3. Signatur und Prüf-Token ─────────────────────────────────────────────
abschnitt("Webhook — Signatur und Prüf-Token");
const { signaturPruefen, pruefToken, pruefTokenPasst, metaKonfig, fehlerKlartext } = await import("../server/lib/fiaon-meta");
const { createHmac } = await import("node:crypto");
const koerper = JSON.stringify({ object: "page", entry: [{ id: "p1", changes: [{ field: "leadgen", value: { leadgen_id: "9001", page_id: "p1" } }] }] });
const sig = "sha256=" + createHmac("sha256", "pruefstand-geheim").update(Buffer.from(koerper, "utf8")).digest("hex");
ok(signaturPruefen(koerper, sig), "richtige Signatur wird angenommen");
ok(!signaturPruefen(koerper + " ", sig), "ein Byte mehr → abgelehnt");
ok(!signaturPruefen(koerper, "sha256=" + "0".repeat(64)), "falsche Signatur → abgelehnt");
ok(!signaturPruefen(koerper, undefined), "keine Signatur → abgelehnt");
ok(signaturPruefen("{\"text\":\"Grüße\"}", "sha256=" + createHmac("sha256", "pruefstand-geheim").update(Buffer.from("{\"text\":\"Grüße\"}", "utf8")).digest("hex")), "Umlaute: Signatur über UTF-8-Bytes");
const pt = pruefToken();
ok(!!pt && pt.length === 32, "Prüf-Token abgeleitet (32 Zeichen)");
ok(pruefTokenPasst(pt), "Prüf-Token passt");
ok(!pruefTokenPasst("falsch"), "falscher Prüf-Token passt nicht");
ok(metaKonfig().bereit, "mit drei Werten bereit");
ok(/neuen Systemnutzer-Token/.test(fehlerKlartext(190, null, "")), "Code 190 → Klartext „neuen Token erzeugen“");

// ── 4. Persönlicher Link ───────────────────────────────────────────────────
abschnitt("Persönlicher Link /a/<code>");
const { neuerCode, codeGueltigeForm, kurzlinkUrl, kanalAus, CODE_LAENGE } = await import("../server/lib/fiaon-kurzlink");
const codes = new Set(Array.from({ length: 2000 }, () => neuerCode()));
ok(codes.size === 2000, "2.000 Codes, keiner doppelt");
ok(Array.from(codes).every((c) => c.length === CODE_LAENGE && codeGueltigeForm(c)), "alle Codes 10 Zeichen, gültige Form");
ok(Array.from(codes).every((c) => !/[01OlI]/.test(c)), "keine verwechselbaren Zeichen (0, 1, O, l, I)");
ok(!codeGueltigeForm("../../etc"), "Unsinn aus der Adresszeile wird abgewiesen");
gleich(kurzlinkUrl("Ab3dEf7hJk", "w"), "https://fiaon.com/a/Ab3dEf7hJk/w", "Adresse mit Kanal, Hauptdomain");
gleich(kurzlinkUrl("Ab3dEf7hJk"), "https://fiaon.com/a/Ab3dEf7hJk", "Adresse ohne Kanal");
gleich(kanalAus("W"), "w", "Kanal groß geschrieben");
gleich(kanalAus("x9"), "x", "unbekannter Kanal");
const { nummerFuerFormular } = await import("../server/routes/fiaon-kurzlink");
gleich(JSON.stringify(nummerFuerFormular("+4917612345678")), JSON.stringify({ vorwahl: "+49", nummer: "17612345678" }), "deutsche Nummer geteilt");
gleich(JSON.stringify(nummerFuerFormular("+436641234567")), JSON.stringify({ vorwahl: "+43", nummer: "6641234567" }), "österreichische Nummer");
gleich(nummerFuerFormular("+393331234567"), null, "Ausland → nicht vorausgefüllt (der Antrag nimmt nur DACH)");

// ── 5. Texte gegen alle Wände ──────────────────────────────────────────────
abschnitt("Feste Texte — Wortwand, Strecken-Wörter, Sie, Emojis");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { worthygiene, VARIANTEN, streckenKnopf } = await import("../shared/fiaon-lead-strecke");
const { EINWILLIGUNG_HINWEIS, WA_VORLAGEN, vorlagenName } = await import("../shared/fiaon-lead-texte");
const DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|dein\w*)\b/;
const EMOJI = new RegExp("[\\p{Extended_Pictographic}]", "u");
const pruefeText = (name: string, text: string) => {
  const verboten = wandPruefen(text).filter((w) => w.art === "verboten");
  ok(verboten.length === 0, `${name}: nichts Verbotenes (${verboten.map((v) => v.treffer).join(", ")})`);
  ok(worthygiene(text).length === 0, `${name}: keine Strecken-Verbotswörter (${worthygiene(text).join(", ")})`);
  ok(!DU.test(text), `${name}: gesiezt (${text.match(DU)?.[0] ?? ""})`);
  ok(!EMOJI.test(text) && !/\*[^*]+\*/.test(text), `${name}: keine Emojis, keine Sternchen`);
};
pruefeText("Hinweistext", EINWILLIGUNG_HINWEIS);
ok(/WhatsApp/.test(EINWILLIGUNG_HINWEIS) && /FIAON LTD/.test(EINWILLIGUNG_HINWEIS) && /widerrufen/.test(EINWILLIGUNG_HINWEIS), "Hinweistext nennt WhatsApp, FIAON LTD und den Widerruf");
for (const v of WA_VORLAGEN) {
  pruefeText(`WhatsApp ${v.name}`, v.text);
  ok(!/^\s*\{\{/.test(v.text) && !/\}\}\s*[.!?]?\s*$/.test(v.text), `${v.name}: keine Variable am Anfang oder Ende (Meta-Regel)`);
  ok(v.text.length <= 1024, `${v.name}: höchstens 1.024 Zeichen`);
  ok(v.knoepfe.every((k) => k.text.length <= 25), `${v.name}: Knopftexte höchstens 25 Zeichen`);
  const vars = (v.text.match(/\{\{\d\}\}/g) ?? []).length;
  ok(v.beispiele.length === vars, `${v.name}: ein Beispiel je Variable (${vars})`);
  ok(!/mahn|inkasso|forderung|rate f[aä]llig|überfällig/i.test(v.text), `${v.name}: keine Mahnung über WhatsApp (Richtlinie)`);
}
ok(/digitale Assistentin/.test(WA_VORLAGEN[0].text), "erste WhatsApp gibt sich als KI zu erkennen (KI-VO Art. 50)");
ok(/Mensch/.test(WA_VORLAGEN[0].text), "erste WhatsApp nennt den Weg zum Menschen");
gleich(vorlagenName("Hallo Maria Muster,"), "Maria Muster", "Name für {{1}}");
gleich(vorlagenName("Hallo,"), "und willkommen", "ohne Namen → „Hallo und willkommen,“");
for (const v of VARIANTEN) {
  pruefeText(`Strecke ${v.key}`, `${v.betreff}\n${v.text}`);
  ok(/^[A-ZÄÖÜ„]/.test(v.text), `Strecke ${v.key}: beginnt großgeschrieben (Anrede steht davor)`);
}
ok(VARIANTEN.length === 12, "zwölf Varianten");
ok(!VARIANTEN.some((v) => /monatlich kündbar|keine mindestlaufzeit/i.test(v.text)), "kein „monatlich kündbar“ mehr (Jahresvertrag seit 03.09.)");
ok(streckenKnopf(VARIANTEN.find((v) => v.art === "termin")!).termin, "Termin-Varianten führen zur Terminseite");

// ── 6. Begrüßungsmail, wie der Motor sie rendert ───────────────────────────
abschnitt("Begrüßungsmail (lead_willkommen)");
const { willkommenTexte, tagText } = await import("../server/lib/fiaon-lead-willkommen");
const jetzt = new Date("2026-09-22T18:00:00+02:00");
const t1 = willkommenTexte({ vorname: "maria", nachname: "muster", email: "m@x.de", telefonDach: true, erstelltAm: new Date(jetzt.getTime() - 60_000), jetzt });
gleich(t1.anrede, "Guten Tag Maria Muster,", "Anrede aus der einen Regel");
gleich(t1.betreff, "Maria, Ihr Antrag bei FIAON ist vorbereitet", "Betreff mit Vornamen");
ok(/^Ihre Anfrage ist bei uns angekommen\./.test(t1.einstieg), "frischer Lead: „Ihre Anfrage ist angekommen“");
ok(/Ihren Namen, Ihre E-Mail-Adresse und Ihre Telefonnummer/.test(t1.einstieg), "nennt genau, was eingetragen ist");
const t2 = willkommenTexte({ vorname: "0176", nachname: null, email: "m@x.de", telefonDach: false, erstelltAm: new Date("2026-09-21T08:26:00+02:00"), jetzt });
gleich(t2.anrede, "Guten Tag,", "unbrauchbarer Name → ohne Namen");
gleich(t2.betreff, "Ihr Antrag bei FIAON ist vorbereitet", "Betreff ohne Namen");
ok(/^Sie hatten sich am Montag, 21\.09\. bei uns gemeldet/.test(t2.einstieg), `nachgeholt: „Sie hatten sich am Montag, 21.09. …“ (${t2.einstieg.slice(0, 60)})`);
ok(/Ihre E-Mail-Adresse haben wir/.test(t2.einstieg), "ohne Namen und Telefon: nur die E-Mail genannt");
gleich(tagText(new Date("2026-09-20T23:30:00Z")), "Montag, 21.09.", "Berliner Datum (UTC-Abend = Berliner Folgetag)");
const { mailRendern } = await import("../server/mail/motor");
const mail = mailRendern("lead_willkommen", { ...t1, antrag_url: "https://fiaon.com/a/Ab3dEf7hJk/m", abmelde_url: "https://www.fiaon.com/abmelden/x" })!;
ok(!!mail, "Vorlage lead_willkommen existiert im Motor");
gleich(mail.fehlend.length, 0, `keine leeren Platzhalter (${mail.fehlend.join(", ")})`);
ok(mail.html.includes("Guten Tag Maria Muster,") && mail.html.includes("https://fiaon.com/a/Ab3dEf7hJk/m"), "Anrede und persönlicher Link in der Mail");
ok(mail.html.includes("abmelden/x"), "Abmeldelink in der Mail");
ok(/Entscheidung über eine Karte trifft am Ende immer die Bank/.test(mail.html), "der eine Karten-Satz steht darin");
// Geprüft wird, was die Vorlage sagt — nicht der Pflichtfuß des Gerüsts („FIAON ist keine Rechtsberatung …").
const { AUSKUNFT_LEAD_VORLAGEN } = await import("../server/mail/vorlagen/auskunft-lead");
const lw = AUSKUNFT_LEAD_VORLAGEN.lead_willkommen;
pruefeText("Begrüßungsmail (Vorlage)", [t1.betreff, lw.preheader, lw.titel, t1.anrede, t1.einstieg, t2.einstieg, ...lw.absaetze.slice(1), lw.fussnote ?? "", lw.knopf?.text ?? ""].join("\n"));
const { ABMELDEPFLICHT } = await import("../server/mail/motor");
ok(ABMELDEPFLICHT.has("lead_willkommen"), "Begrüßung steht auf der Abmeldepflicht-Liste");
const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");
ok(PFLICHTMAILS.has("lead_willkommen"), "Begrüßung ist eine Antwort-Mail (Frequenzbremse lässt sie durch)");

// ── 7. Strecken-Mail im Sie ────────────────────────────────────────────────
abschnitt("Nachfass-Strecke (lead_followup) im Sie");
const sm = mailRendern("lead_followup", {
  betreff: VARIANTEN[1].betreff, text: `Guten Tag Maria Muster,\n\n${VARIANTEN[1].text}\n\nZum Antrag: https://fiaon.com/a/Ab3dEf7hJk/m\n\nViele Grüße\nIhr FIAON-Team`,
  anrede: "Guten Tag Maria Muster,", knopf_text: "Jetzt Antrag starten", knopf_url: "https://fiaon.com/a/Ab3dEf7hJk/m", abmelde_url: "https://www.fiaon.com/abmelden/x",
})!;
ok(!!sm && !/Du möchtest|Antworte einfach|dich zurück/.test(sm.html), "Fuß und Fußnote siezen");
ok(/Entscheidung über eine Karte/.test(sm.html), "Karten-Ziel-Block wieder da");
const statisch = mailRendern("lead_followup", { anrede: "Guten Tag,", antrag_url: "https://fiaon.com/a/Ab3dEf7hJk/m", abmelde_url: "https://www.fiaon.com/abmelden/x" })!;
gleich(statisch.fehlend.length, 0, `statische Nachfass-Mail ohne Lücke (${statisch.fehlend.join(", ")})`);
ok(!/Guten Tag ,/.test(statisch.html), "kein „Guten Tag ,“ mehr bei leerem Namen");

// ── 8. Quelltext-Regeln ────────────────────────────────────────────────────
abschnitt("Quelltext — was nicht verloren gehen darf");
const webhook = lies("server/routes/fiaon-meta-webhook.ts");
const post = webhook.slice(webhook.indexOf('router.post("/webhook"'));
ok(post.indexOf("meldungSpeichern(") > 0 && post.indexOf("meldungSpeichern(") < post.indexOf("res.status(200)"), "Webhook: erst speichern, dann 200");
ok(/signaturPruefen\(/.test(webhook) && /status\(401\)/.test(webhook), "Webhook: ohne gültige Signatur 401");
const antrag = lies("client/src/pages/antrag.tsx");
ok((antrag.match(/leadLink, messung: messungsDaten\(\)/g) ?? []).length >= 2, "Antrag: beide Zwischenspeicher tragen Code und Werbe-Kennungen");
ok(/vorbelegung\//.test(antrag), "Antrag: liest die Vorbelegung");
ok(/leadLink/.test(lies("server/routes/fiaon-antrag.ts")), "Server hängt den Antrag über den Code an den Lead");
const weiterRoute = lies("server/routes/fiaon-antrag.ts").split('router.get("/antrag/weiter/:token"')[1]?.slice(0, 2500) ?? "";
ok(!/if \(a\.payment_reference \|\| a\.payment_status === "paid"\)/.test(weiterRoute) && /UNFERTIG/.test(weiterRoute), "Wiedereinstieg: „fertig“ nicht mehr am Verwendungszweck (den hat seit 08.08. jeder Entwurf)");
ok(/eigeneRef=\{ref\}/.test(antrag) && /ohne=/.test(lies("client/src/components/antrag/EmailBekannt.tsx")), "E-Mail-Hinweis schließt den eigenen Antrag aus");
const strecke = lies("server/lib/fiaon-lead-strecke.ts");
ok(/anredeMail\(/.test(strecke) && /kurzlinkFuerLead/.test(strecke) && !/dein FIAON-Team/.test(strecke), "Strecke: Anrede, persönlicher Link, „Ihr FIAON-Team“");
ok(/leadMotor:/.test(lies("client/src/pages/agent/rundgaenge.ts")), "Rundgang lead-motor vorhanden");
ok(/slug: "lead-motor"/.test(lies("client/src/components/admin/chef-seiten.tsx")), "Seite im Chefbüro eingetragen");
const routen = lies("server/routes.ts");
ok(routen.indexOf("fiaon-kurzlink") < routen.indexOf("app.get('*'"), "/a/<code> liegt VOR den Seiten-Fangnetzen");
ok(/<meta name="facebook-domain-verification" content="54kh3pz2o7i6q2u4ztpmafbq8a7bxz" \/>/.test(lies("client/index.html").split("</head>")[0]), "Meta-Domainbestätigung steht im <head> von index.html");

// ── 8b. Wer darf eine WhatsApp bekommen? ───────────────────────────────────
abschnitt("WhatsApp-Erlaubnis — Hinweistext statt Kästchen, Nummer entscheidet");
{
  const { whatsappUrteil, nummernArt, nummerFuerWhatsApp, WHATSAPP_MOEGLICH_SQL } = await import("../shared/fiaon-whatsapp-erlaubnis");
  gleich(whatsappUrteil({ telefon: "+4917612345601" }).moeglich, true, "Handynummer ohne Kästchen → erlaubt");
  gleich(whatsappUrteil({ telefon: "0176 12345601" }).moeglich, true, "deutsche 0-Schreibweise → erlaubt");
  gleich(whatsappUrteil({ telefon: "+4989414343" }).moeglich, false, "Festnetz München → kein WhatsApp");
  gleich(whatsappUrteil({ telefon: "+4989414343" }).grund, "Festnetz — kein WhatsApp", "und der Grund steht da");
  gleich(whatsappUrteil({ telefon: null }).moeglich, false, "ohne Nummer → nein");
  gleich(whatsappUrteil({ telefon: "+4917612345601", erlaubt: false }).moeglich, false, "ausdrückliches Nein schlägt alles");
  gleich(whatsappUrteil({ telefon: "+4917612345601", gesperrt: true }).moeglich, false, "Sperre schlägt alles");
  gleich(whatsappUrteil({ telefon: "+436641234503" }).moeglich, true, "österreichisches Handy");
  gleich(whatsappUrteil({ telefon: "+41761234567" }).moeglich, true, "Schweizer Handy");
  gleich(nummerFuerWhatsApp("0176 123 456 01"), "4917612345601", "Nummer wird auf Ziffern mit Landesvorwahl gebracht");
  gleich(nummernArt("+12125551234"), "unklar", "außerhalb DACH: versuchen statt aussperren");
  ok(/whatsapp_erlaubt, TRUE\) IS TRUE/.test(WHATSAPP_MOEGLICH_SQL()), "In SQL zählt NULL als erlaubt");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/Die Erlaubnis steht im Hinweistext des Formulars/.test(rg) && !/Ohne Kästchen geht an diesen Menschen keine WhatsApp/.test(rg),
    "Rundgang erklärt den Hinweistext, nicht mehr das Kästchen");
  ok(!/Kein Kästchen — nur E-Mail/.test(lies("client/src/components/admin/ChefLeadMotor.tsx")), "Die Kästchen-Zuordnung ist aus dem Steuerpult raus");
  ok(!/lead-motor\/einwilligung/.test(lies("server/routes/fiaon-lead-motor.ts")), "Die Route dazu ist ebenfalls weg (keine Knöpfe ohne Funktion, keine Routen ohne Knopf)");
}

// ── 8c. Die Einrichtung des Datensatzes (Pixel) ────────────────────────────
abschnitt("Datensatz finden — Firma über die Seite, echte Fehler im Klartext");
{
  const ml = lies("server/lib/fiaon-meta-leads.ts");
  const mt = lies("server/lib/fiaon-meta.ts");
  ok(/fields: "business"/.test(ml), "Die Firma kommt über die Seite (me/businesses ist bei Systemnutzern leer)");
  ok(ml.indexOf('fields: "business"') < ml.lastIndexOf('me/businesses'), "Der Seiten-Weg wird zuerst versucht, me/businesses nur als Rückfall");
  ok(/hinweis = e instanceof MetaFehler \? e\.klartext/.test(ml), "Der Fehler von Meta wird nicht mehr geschluckt");
  ok(/shared_accounts/.test(ml), "Ein neuer Datensatz wird dem Werbekonto zugewiesen");
  ok(/subcode === 1784018/.test(mt) && /Events-Manager/.test(mt), "Pixel-Bedingungen: Meta-Fehler wird in einen Klickweg übersetzt");
}

// ── 8d. Der Paket-Aufstieg nach der Freigabe ───────────────────────────────
abschnitt("Paket-Aufstieg — nur nach oben, ohne Empfehlung, ohne Bankzusage");
{
  const auf = lies("client/src/components/antrag/PaketAufstieg.tsx");
  const ant = lies("client/src/pages/antrag.tsx");
  ok(/pakete\.filter\(\(p\) => p\.lim > aktuell\.lim\)/.test(auf), "Es werden nur größere Pakete gezeigt (kein Rückwärtsgang)");
  ok(/Ebenfalls freigegeben/.test(auf) && /Ihre Prüfung reicht über/.test(auf), "Überschrift knüpft an die Freigabe an");
  // Nur das, was der Mensch wirklich liest — die Kommentare oben erklären die Regeln und dürfen sie nennen.
  // Geprüft wird mit der HAUS-Wand (wandPruefen), nicht mit der Strecken-Liste:
  // „Limit" ist auf der Antragsseite das Produktwort und steht dort überall.
  const sichtbar = auf.slice(auf.indexOf("export function PaketAufstieg"));
  const wandTreffer = wandPruefen(sichtbar).filter((w) => w.art === "verboten");
  ok(wandTreffer.length === 0, `Aufstieg-Texte: nichts Verbotenes (${wandTreffer.map((v) => v.treffer).join(", ")})`);
  ok(!DU.test(sichtbar), "Aufstieg-Texte: gesiezt");
  ok(!/empfehl/i.test(sichtbar), "Kein „empfehlen“ — das Wort ist gesperrt");
  ok(!/garanti/i.test(sichtbar) && !/\bBank\b/i.test(sichtbar), "Keine Zusage, keine Bank");
  ok(/Größter Sprung/.test(auf), "Das größte Paket bekommt die Bühne");
  ok(/const aufstieg = useCallback/.test(ant) && /setApproved\(neuesPaket\.lim\)/.test(ant), "Der Wechsel hebt den Ziel-Rahmen auf das neue Paket");
  ok(/track\("upsell_wechsel"/.test(ant), "Jeder Wechsel wird gezählt");
  ok(ant.indexOf("<PaketAufstieg") > ant.indexOf("Genehmigt mit {pack?.name}"), "Der Aufstieg steht NACH der Freigabe — im stärksten Moment");
}

// ── 9. Die Messung an Meta (Pixel + Conversions API) ───────────────────────
abschnitt("Messung an Meta — eine Quelle, eine Kennung, keine Klartextdaten");
{
  const capi = lies("server/lib/fiaon-meta-capi.ts");
  const werbung = lies("client/src/lib/werbung.ts");
  // Erst hier laden: Die Datei hängt an der Datenbank-Hülle, und die will DATABASE_URL (oben gesetzt).
  const { hashFeld } = await import("../server/lib/fiaon-meta-capi");

  // Dieselbe Kennung im Browser und auf dem Server — sonst zählt Meta doppelt.
  gleich(metaEreignisId("Purchase", "FIA-123"), "Purchase.FIA-123", "Ereignis-Kennung: Name.Verwendungszweck");
  ok(metaEreignisId("Purchase", "x".repeat(200)).length <= 120, "Ereignis-Kennung bleibt unter der Grenze von Meta");
  ok(/export const ereignisId = metaEreignisId/.test(capi), "Server nimmt die Kennung aus der geteilten Quelle");
  ok(/from "@shared\/fiaon-meta-ereignisse"/.test(werbung), "Browser nimmt die Namen aus der geteilten Quelle");
  ok(!/"InitiateCheckout"|"CompleteRegistration"/.test(lies("client/src/pages/antrag.tsx")), "Antrag nennt keine Ereignisnamen von Hand");
  gleich(META_EREIGNIS.zahlung, "Purchase", "Zahlung heißt bei Meta Purchase");
  gleich(CRM_EREIGNIS.zahlung, "converted_lead", "Der zahlende Lead heißt converted_lead");
  ok(Object.values(META_EREIGNIS).every((n) => EREIGNIS_TEXT[n]), "Jedes Ereignis hat einen deutschen Namen fürs Haus");
  ok(Object.values(CRM_EREIGNIS).every((n) => EREIGNIS_TEXT[n]), "Jede Lead-Stufe hat einen deutschen Namen fürs Haus");

  // Nichts im Klartext.
  const email = hashFeld("em", "  Maria.Muster@Example.COM ");
  ok(email !== null && email.length === 64 && !/@/.test(email), "E-Mail: verschlüsselt (64 Zeichen), kein Klartext");
  gleich(hashFeld("em", "maria.muster@example.com"), email, "Groß- und Kleinschreibung ändern den Wert nicht");
  gleich(hashFeld("ph", "0170 1234567"), hashFeld("ph", "1701234567"), "Telefon: führende Null und Leerzeichen fallen weg");
  gleich(hashFeld("ph", "0171"), null, "Zu kurze Nummer wird gar nicht gemeldet");
  gleich(hashFeld("em", "   "), null, "Leeres Feld wird nicht gemeldet");
  ok(/createHash\("sha256"\)/.test(capi), "Verschlüsselt wird mit SHA-256");
  ok(!/user_data[\s\S]{0,400}?\bemail\b\s*:/.test(capi), "Keine E-Mail im Klartext in der Nutzlast");

  // Einwilligung und Schalter.
  ok(/if \(!m\.einwilligung\) return "keine_einwilligung"/.test(capi), "Ohne Marketing-Einwilligung kein Web-Ereignis");
  ok(/if \(!\(await anAus\(WEB_SCHALTER/.test(capi) && /if \(!\(await anAus\(CRM_SCHALTER/.test(capi), "Beide Messwege haben einen Schalter");
  ok(/einwilligungLesen\(\)\?\.marketing/.test(werbung.split("export function metaEreignis")[1] ?? ""), "Der Pixel feuert nur mit Einwilligung");
  ok(/consent", "grant"/.test(werbung), "Der Pixel bekommt die Einwilligung ausdrücklich mitgeteilt");

  // Doppelte Meldungen sind unmöglich.
  ok(/ereignis_id TEXT NOT NULL UNIQUE/.test(capi), "Jedes Ereignis kann nur einmal in der Schlange stehen");
  ok(/ON CONFLICT \(ereignis_id\) DO NOTHING/.test(capi), "Ein zweiter Versuch legt nichts doppelt an");
  ok(/action_source: "system_generated"/.test(capi) && /event_source: "crm"/.test(capi), "Lead-Stufen gehen als CRM-Ereignis an Meta");
  ok(/user_data: \{ lead_id: Number\(metaLeadId\) \}/.test(capi), "Die Lead-Stufe trägt die Meta-Lead-Kennung");
  ok(/versuche < 6/.test(capi), "Ein Ereignis wird höchstens sechsmal versucht");

  // Die Stellen, an denen gemessen wird.
  const antragServer = lies("server/routes/fiaon-antrag.ts");
  ok(/messungMerken\(/.test(antragServer), "Der Antrag merkt sich die Werbe-Kennungen");
  ok(/META_EREIGNIS\.antragFertig/.test(antragServer), "Antrag abgeschickt wird gemeldet");
  ok(/CRM_EREIGNIS\.antragFertig/.test(antragServer), "Der Lead wird als „Antrag fertig“ gemeldet");
  const agent = lies("server/routes/fiaon-agent.ts");
  ok(/META_EREIGNIS\.zahlung/.test(agent) && /CRM_EREIGNIS\.zahlung/.test(agent), "Die gebuchte Zahlung meldet Purchase und converted_lead");
  ok(/META_EREIGNIS\.termin/.test(lies("server/lib/fiaon-termine.ts")), "Ein gebuchtes Gespräch meldet Schedule");
  ok(/metaSeitenwechsel\(/.test(lies("client/src/components/site/EinwilligungsHinweis.tsx")), "Seitenwechsel im Einseiter werden gemeldet");

  // Das Steuerpult.
  const motor = lies("server/routes/fiaon-lead-motor.ts");
  for (const r of ["messung/schalter", "messung/datensatz", "messung/senden", "messung/probe", "messung/ereignisse"]) {
    ok(motor.includes(`/chef/lead-motor/${r}`), `Steuerpult-Route ${r} vorhanden`);
  }
  ok(/requireChef\("inhaber"\)/.test(motor), "Die Messung ist hinter der Inhaber-Stufe");
  ok(/test_event_code/.test(capi), "Die Probe geht mit Testcode raus (verfälscht die Zahlen nicht)");
  const ui = lies("client/src/components/admin/ChefLeadMotor.tsx");
  ok(/lm-messung/.test(ui) && /EreignisListe/.test(ui), "Das Steuerpult zeigt die Messung und die Ereignisse");
  ok(/Probe senden/.test(ui) && /Wartende senden/.test(ui), "Beide Knöpfe sind da");
  ok(/lm-messung/.test(lies("client/src/styles/chef-lead-motor.css")), "Der Abschnitt hat sein Aussehen im eigenen Blatt");
}

// ── 10. Die Danke-Seite des Meta-Formulars (/fb) ───────────────────────────
abschnitt("Danke-Seite /fb — vom Formular direkt in den vorausgefüllten Antrag");
{
  const kl = lies("server/routes/fiaon-kurzlink.ts");
  ok(/router\.get\("\/fb"/.test(kl), "Route /fb vorhanden");
  ok(kl.indexOf('router.get("/fb"') < kl.indexOf('router.get("/a/:code"'), "/fb steht vor /a/:code (sonst gilt „fb“ als Code)");
  ok(/\/\^\\d\{3,25\}\$\//.test(kl), "Die Lead-Kennung muss aus Ziffern bestehen — ein nicht ersetzter Platzhalter zählt nicht");
  ok(/RUECKFALL = "\/start\?quelle=fb-formular"/.test(kl), "Ohne Kennung geht es auf die Startseite, nie in eine Sackgasse");
  ok(/metaLeadEinspielen/.test(kl), "Ist der Lead noch nicht da, wird er sofort bei Meta geholt");
  ok(/setTimeout\(\(\) => r\(null\), 4000\)/.test(kl), "Nach 4 Sekunden wartet niemand mehr — dann die Startseite");
  ok(/klickZaehlen\(lage, "f"/.test(kl), "Der Klick zählt auf den Kanal „Facebook-Formular“");
  const link = lies("server/lib/fiaon-kurzlink.ts");
  ok(/f: "Facebook-Formular"/.test(link) && /"f" \| "x"/.test(link), "Der Kanal f ist überall bekannt");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler ? 1 : 0);
