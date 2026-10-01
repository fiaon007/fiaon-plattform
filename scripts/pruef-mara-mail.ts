// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARA PER E-MAIL (28.09.2026, E-248)
//
// Justin: „Merkst du nicht, dass Mara gar nicht den persönlichen Link, sondern
// nur /antrag sendet? … gleiches bei den E-Mails. Geh Mara komplett durch."
// Geprüft wird, was die Prüfung vom 28.09. (e247-erkunden-mail / -pruefen-mail)
// an echten Fällen gefunden hat:
//
//   1. Kündigung   #5626 „Ich [Name] kündige per sofort" wird gebucht (E-213);
//                  „liegt mir eindeutig vor" ohne Buchung geht nie raus; Verträge
//                  vor dem 03.09. formlos (#5625).
//   2. Mehrfach    Person A (elf Antworten in elf Minuten), Person B (drei
//                  Rechnungen in 76 s): gleicher Text / leerer Nachtrag → EINE Antwort;
//                  die Sendesperre hält auch den Versand von Hand und das Nachholen.
//   3. Ruhe        Stopp, Widerruf (#5633), Storno (#5575): kein Zahlknopf, keine Rechnung.
//   4. Zusagen     keine Rückzahlung (#5635), kein Ergebnis der Bank.
//   5. Sprache     #5591: eine Sprache je Mail — Rahmen und Text gleich.
//   6. Links       nur persönliche: /a/<code>/m, Zahlungsseite, Terminlink — nie /antrag.
//   dazu: Mara-Aktion (Rahmen statt Limit, Einwände, Werbesperre an der Adresse),
//   Termin (kein zweiter), Kosten, Persona im Auftrag.
//   E-264 (29.09.2026): Abstreiten per Mail („Ich habe nie etwas beantragt") — Riegel
//   (Bestreiten; Stopp nur bei ausdrücklichem Wunsch), feste Antwort ohne Antwort-KI, Werbesperre
//   erst mit der FREIGABE, kein Mahnstopp, Aufgabe an die Leitung; ein nie abgeschickter Antrag ist
//   „interessent" — keine Zahlungsseite, keine Rechnung, keine Reaktivierung, kein Zahlungssatz,
//   aber Storno möglich (Nachbesserung nach dem Gegenlesen).
//
//   Offline (ohne DB, ohne Netz):
//     env -i PATH="$PATH" HOME="$HOME" DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-mail.ts
//   Mit der lokalen Test-DB (Gmail, OpenAI, Make sind Attrappen — nichts geht hinaus):
//     env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//       SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-mail.ts --db
//   Eigene Datensätze (Personen PRUEF248M-…, Referenzen FIAON-P248M…, Mails e248m-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen die lokale Test-DB!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

// ── Attrappen VOR jedem Import ────────────────────────────────────────────
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e248m";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e248m.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.pruef.invalid/token",
});

/** Das Drehbuch des Modells für eine Mail. */
interface Szenario {
  einordnung: Record<string, unknown>;
  werkzeuge?: { name: string; args: Record<string, unknown> }[];
  antwort: Record<string, unknown>;
  umformuliert?: Record<string, unknown>;
}
let SZ: Szenario | null = null;
const OPENAI: { art: "einordnen" | "antwort"; system: string; alles: string }[] = [];
const GMAIL_SENDEN: string[] = [];
const GMAIL_ENTWURF: string[] = [];
const FREMD: string[] = [];
type Nachricht = { thread: string; am: number; von: string; betreff: string; text: string };
const NACHRICHTEN = new Map<string, Nachricht>();

const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const nachricht = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const system = String((body.input ?? []).find((m: any) => m?.role === "system")?.content ?? "");
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    OPENAI.push({ art: einordnen ? "einordnen" : "antwort", system, alles });
    if (!SZ) return json(500, { error: { message: "kein Szenario" } });
    let aus: any;
    if (einordnen) aus = nachricht(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = nachricht(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else if (body.tools && SZ.werkzeuge?.length && !alles.includes("function_call_output")) {
      aus = { output: SZ.werkzeuge.map((w, i) => ({ type: "function_call", call_id: `c${i}`, name: w.name, arguments: JSON.stringify(w.args) })) };
    } else aus = nachricht("fertig");
    return json(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send/.test(u)) { GMAIL_SENDEN.push(String(init?.body ?? "")); return json(200, { id: `gesendet-${GMAIL_SENDEN.length}`, threadId: "t" }); }
    if (/\/drafts/.test(u)) { GMAIL_ENTWURF.push(String(init?.body ?? "")); return json(200, { id: `entwurf-${GMAIL_ENTWURF.length}`, message: { id: "x" } }); }
    if (/\/messages\?/.test(u)) return json(200, { messages: [], resultSizeEstimate: 0 });
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return json(404, { error: { message: "Not Found" } });
      return json(200, {
        id: m[1], threadId: n.thread, labelIds: ["INBOX", "UNREAD"], internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: { mimeType: "text/plain", headers: [
          { name: "From", value: n.von }, { name: "To", value: "support@fiaon.com" },
          { name: "Subject", value: n.betreff }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text).toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const agent = await import("../server/lib/fiaon-postmeister-agent");
const wz = await import("../server/lib/fiaon-postmeister-werkzeuge");
const lauf = await import("../server/lib/fiaon-postmeister-lauf");
const aktion = await import("../server/lib/fiaon-mara-aktion");
const { istWillenserklaerung } = await import("../server/lib/fiaon-kuendigung");
const ton = await import("../shared/fiaon-mara-ton");
const { linkPruefung, tonPruefung } = ton;
const { wandPruefen } = await import("../shared/fiaon-wortverbote");

// ═══ TEIL A · OHNE DATENBANK ══════════════════════════════════════════════
abschnitt("1 · Kündigung erkennen (kuendigungsWille)");
const W = (t: string, o: { unbezahlt?: boolean; formlos?: boolean } = {}) => wz.kuendigungsWille(t, { ...o, istWillenserklaerung });
ok(W("Hallo, ich Max Prüfer kündige per sofort den Vertrag. Grüße"), "#5626: „Ich [Name] kündige per sofort den Vertrag“ → Kündigung");
ok(!istWillenserklaerung("ich Max Prüfer kündige per sofort den Vertrag"), "… die alte Regel allein hätte sie abgelehnt (Beleg für den Fund)");
ok(W("Ich möchte meinen Vertrag bei Ihnen kündigen."), "„Ich möchte meinen Vertrag kündigen“ (#5497) → Kündigung");
ok(W("Ich möchte das bei Ihnen kündigen"), "„Ich möchte das bei Ihnen kündigen“ (#4792) → Kündigung");
ok(W("Please cancel my subscription."), "„Please cancel my subscription“ (#5243) → Kündigung");
ok(W("Hiermit möchte ich meinen Vertrag widerrufen."), "„Hiermit möchte ich … widerrufen“ → Kündigung/Widerruf");
ok(W("Ich kündige zum nächstmöglichen Zeitpunkt."), "„zum nächstmöglichen Zeitpunkt“ bleibt eine Kündigung");
ok(W("Wegen meiner Diagnose möchte ich alles komplett wieder stornieren.", { formlos: true }), "#5625 (formlos, vor 03.09.): „alles komplett wieder stornieren“ → Kündigung");
ok(!W("Wie kann ich meinen Vertrag kündigen?"), "Frage „Wie kann ich kündigen?“ → keine Kündigung");
ok(!W("Ich überlege, ob ich kündigen soll."), "Überlegung → keine Kündigung");
ok(!W("Kann ich zum Monatsende kündigen?"), "„Kann ich … kündigen?“ → keine Kündigung");
ok(!W("Ich brauche die Karte nicht mehr sofort, aber bald.", { formlos: true }), "formlos, aber keine Absage: „brauche die Karte nicht mehr sofort“ → keine Kündigung");
ok(!W("Was kostet die Kündigung?"), "Frage nach Kosten → keine Kündigung");
ok(wz.zitatInText("kündige per sofort", "Hallo, ich Max Prüfer KÜNDIGE per sofort den Vertrag."), "Zitat steht in seiner Mail (Groß/Klein, Satzzeichen egal)");
ok(!wz.zitatInText("Hiermit kündige ich", "Wie kann ich kündigen?"), "erfundenes Zitat → nicht in seiner Mail (dann wird NICHTS gebucht)");
// Nachbesserung E-248 (Gegenprobe kuend.mts / Gegenlesen): Verneinung, Bedingung, fremde Person,
// fremder Vertrag — in JEDER Lage keine Kündigung (vorher alle „BUCHT“, sofort mit Urkunde).
for (const t of [
  "Ich kündige nicht, ich will nur wissen, wann die Karte kommt.",
  "Ich will nicht kündigen, sondern die Rate verschieben.",
  "Ich möchte das Abo nicht beenden, nur pausieren.",
  "Bevor ich kündige, möchte ich mit jemandem sprechen.",
  "Wenn das nicht klappt, werde ich kündigen.",
  "Sonst werde ich kündigen.",
  "Mein Mann will kündigen, ich aber nicht.",
  "Ich möchte meinen Handyvertrag kündigen, damit ich die Rate zahlen kann.",
  "Ich muss erst mein Konto bei der Sparkasse kündigen.",
  "Ich habe nicht vor den Vertrag zu kündigen.",
  "Ich will nicht kündigen, ich zahle morgen.",
  "Ich möchte auf keinen Fall kündigen.",
  "Ich kündige nicht, keine Sorge.",
  "Bitte nicht alles stornieren, ich habe mich vertan.",
  "Ich möchte meinen Antrag beenden, aber die Seite hängt.",
  "Ich werde das heute beenden und die Rate zahlen.",
  "Ohne diese Zahlung können wir den Vertrag nicht beenden.",
  "Stopp",
]) for (const o of [{}, { formlos: true }, { unbezahlt: true }]) ok(!W(t, o), `keine Kündigung (${Object.keys(o)[0] ?? "fest"}): „${t}“`);
for (const t of ["Bitte alles komplett stornieren.", "Ich will nicht mehr weitermachen.", "Kein Interesse mehr, bitte stornieren.",
  "Ich bin nicht zufrieden und kündige hiermit den Vertrag.", "Ja, bitte kündigen.", "Kündigen Sie bitte meinen Vertrag."])
  ok(W(t, { formlos: true }) && W(t, { unbezahlt: true }), `klare Kündigung bleibt eine: „${t}“`);
ok(!W(wz.saetzeZumZitat("kündigen", "Ich will nicht kündigen, ich zahle morgen.")), "Ein Wort als Zitat („kündigen“) holt seinen ganzen Satz — und der verneint");
ok(wz.saetzeZumZitat("Hiermit kündige ich", "Wie kann ich kündigen?") === "", "Erfundenes Zitat → leer, nichts wird gebucht");
ok(!W(wz.saetzeZumZitat("will nicht kündigen", "Hallo. Ich will nicht kündigen, ich zahle morgen. Danke")), "Geprüft wird der GANZE Satz des Zitats — die Verneinung geht nicht verloren");
const RF = "Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt.";
for (const t of ["Ja", "Ja bitte", "Ja genau", "Ja, bitte kündigen."]) ok(wz.jaAufRueckfrage(t, RF), `„${t}“ auf unsere Rückfrage → Kündigung (keine Schleife)`);
ok(wz.jaAufRueckfrage("Ja", "Möchten Sie, dass ich Ihre Bestellung jetzt storniere? Ein kurzes Ja genügt."), "„Ja“ auf die Storno-Rückfrage → Storno");
ok(!wz.jaAufRueckfrage("Ja", "Soll ich Ihnen den Antrag schicken?"), "„Ja“ auf eine andere Frage → keine Kündigung");
ok(!wz.jaAufRueckfrage("Ja aber nicht jetzt", RF) && !wz.jaAufRueckfrage("Nein", RF), "„Nein“ / „Ja aber nicht jetzt“ → keine Kündigung");

abschnitt("2 · Nie eine Kündigung bestätigen, die nicht gebucht ist");
ok(!!agent.bestaetigtKuendigung("Ihre Kündigung liegt mir jetzt eindeutig vor, und mit der Zahlung ist alles abgeschlossen."), "#5626: „liegt mir jetzt eindeutig vor“ erkannt");
ok(!!agent.bestaetigtKuendigung("Ich habe Ihre Bestellung storniert."), "„Ich habe Ihre Bestellung storniert“ erkannt");
ok(!!agent.bestaetigtKuendigung("Ihre Bestellung ist storniert, es bleibt nichts offen."), "„Bestellung ist storniert, es bleibt nichts offen“ erkannt");
ok(!!agent.bestaetigtKuendigung("Ihre Kündigung ist erfasst."), "„Kündigung ist erfasst“ erkannt");
ok(!!agent.bestaetigtKuendigung("Your contract has been cancelled."), "Englisch erkannt");
ok(agent.bestaetigtKuendigung("Ihre Kündigung liegt uns noch nicht vor.") === null, "Verneint („liegt uns noch nicht vor“) → keine Bestätigung");
ok(agent.bestaetigtKuendigung("Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt.") === null, "Die Rückfrage ist keine Bestätigung");
// Zur Information (kein Prüfpunkt — die Wortwand gehört einer anderen Datei): Fängt sie „liegt … vor“ inzwischen selbst?
console.log(`  ℹ Wortwand allein fängt „liegt … vor“: ${wandPruefen("Ihre Kündigung liegt mir jetzt eindeutig vor.").length ? "ja" : "nein (Vorschlag im Bericht)"}`);

abschnitt("3 · Ruhe: keine Zahlungsaufforderung auf Stopp, Widerruf, Beschwerde …");
ok(agent.zahlungsRuhe({ flags: { stopp: true } }) === "Stopp-Wunsch", "Stopp → Ruhe");
ok(/Widerruf/.test(String(agent.zahlungsRuhe({ flags: { widerruf: true, rechtlich: true } }))), "Widerruf → Ruhe");
ok(agent.zahlungsRuhe({ flags: { kuendigung: true } }) === null, "Kündigung allein → keine Ruhe (Justins Regel: letzte Rate mit Knopf)");
ok(/früheren|Mail vom/.test(String(agent.zahlungsRuhe({ flags: {}, vorgeschichte: { grund: "Widerruf aus seiner Mail vom 25.09. (Mail #1) noch offen" } }))), "Offener Widerruf aus früherer Mail (#5633) → Ruhe");
ok(agent.sagtNichtNochmalZahlen("Bitte nicht noch einmal überweisen, das Geld ist da."), "#5662: „nicht noch einmal überweisen“ erkannt");
ok(!!agent.fordertZahlung("Bitte begleichen Sie trotzdem die offene Rate."), "„Bitte begleichen Sie …“ ist eine Zahlungsaufforderung");
ok(agent.fordertZahlung("Über Ihren Widerruf entscheidet unsere Geschäftsführung.") === null, "Sachlicher Satz ohne Bitte → keine Zahlungsaufforderung");
const RATE = { zahlungsseite: "https://fiaon.com/zahlung/FIAON-AB12CD-3", betrag: "7.99", verwendungszweck: "FIAON-AB12CD-3" };
const r1 = agent.schrittBestimmen({ naechster_schritt: { art: "zahlung", url: null, text: "x" } }, "rate_ueberfaellig", { zahlungslink_bauen: RATE }, false, { ruhe: true }).schritt;
ok(r1?.art === "erledigt" && !r1?.url, `Ruhe: Zahlknopf → „erledigt“ (${JSON.stringify(r1)})`);
const r2 = agent.schrittBestimmen({ naechster_schritt: { art: "zahlung", url: null, text: "x" } }, "rate_ueberfaellig", { zahlungslink_bauen: RATE, terminlink_bauen: { terminlink: "https://fiaon.com/termin/abc" } }, false, { ruhe: true }).schritt;
ok(r2?.art === "termin" && r2?.url === "https://fiaon.com/termin/abc", "Ruhe mit Terminlink → Knopf „Termin wählen“");
const r3 = agent.schrittBestimmen({ naechster_schritt: { art: "zahlung", url: null, text: "x" } }, "rate_ueberfaellig", { zahlungslink_bauen: RATE }).schritt;
ok(r3?.art === "zahlung" && r3?.url === RATE.zahlungsseite, "Ohne Ruhe bleibt die Zahlungsseite der Knopf (Hausregel)");
const r4 = agent.schrittBestimmen({ naechster_schritt: { art: "zahlung", url: null, text: "x" } }, "rate_ueberfaellig", { zahlungslink_bauen: RATE, kuendigung_vormerken: { weg: "storno_unbezahlt" } }).schritt;
ok(r4?.art === "erledigt", "Nach Storno kein Zahlungsknopf (#5575)");

abschnitt("4 · Keine Rückzahlungs- und Ergebniszusage");
ok(!!agent.zusageRueckzahlung("Ich bestätige Ihnen die zugesagten Informationen zur möglichen Rückzahlung bei einer späteren DKB-Ablehnung."), "#5635 erkannt");
ok(!!agent.zusageRueckzahlung("Sollte die Bank Sie ablehnen, bekommen Sie Ihr Geld zurück."), "„bei Ablehnung Geld zurück“ erkannt");
ok(!!agent.zusageRueckzahlung("Wir erstatten Ihnen den Betrag."), "„Wir erstatten Ihnen den Betrag“ erkannt");
ok(agent.zusageRueckzahlung("Über eine Erstattung entscheidet allein unsere Geschäftsführung.") === null, "„entscheidet die Geschäftsführung“ ist erlaubt");
ok(agent.zusageRueckzahlung("Bereits gezahlte Raten werden grundsätzlich nicht erstattet.") === null, "Die Hausregel selbst ist erlaubt (Kündigung)");
// Nachbesserung E-248 (Recht, § 357 BGB): beim Widerruf nie „nichts wird erstattet“.
ok(!!agent.zusageRueckzahlung("Bereits gezahlte Raten werden grundsätzlich nicht erstattet.", { widerruf: true }), "Widerruf: „grundsätzlich nicht erstattet“ ist verboten");
ok(!!agent.zusageRueckzahlung("Nach Ihrem Widerruf wird nichts erstattet."), "„Nach Ihrem Widerruf wird nichts erstattet“ ist verboten");
ok(agent.zusageRueckzahlung("Ihren Widerruf prüft unsere Geschäftsführung; über eine Erstattung bekommen Sie eine schriftliche Nachricht.", { widerruf: true }) === null, "Widerruf: „prüft die Geschäftsführung“ ist erlaubt");

abschnitt("5 · Eine Sprache je Mail");
ok(agent.antwortSprache("und", null) === "de", "#5591: Einordnung „und“ → Deutsch (vorher Rahmen deutsch, Text spanisch)");
ok(agent.antwortSprache("es", null) === "es", "Spanisch kann unsere Mail ganz → Spanisch");
ok(agent.antwortSprache("hr", null) === "de", "Kroatisch kann unsere Mail nicht ganz → Deutsch");
ok(agent.antwortSprache("de", "en") === "en", "Deutsch erkannt, Sprachvermerk Englisch in der Akte → Englisch (Rückfall wie bisher)");
const spanisch = "Hola, la factura de 59,99 € está abierta con la referencia FIAON-AB12CD. Puede pagarla con el botón de abajo, es muy fácil y rápido para usted.";
ok(agent.spracheGeschaetzt(spanisch) === "es" && !agent.spracheStimmt(spanisch, "de"), "Spanischer Text in einer deutschen Mail fällt auf");
ok(agent.spracheStimmt(spanisch, "es"), "… in einer spanischen Mail nicht");
ok(agent.spracheStimmt("Gern: Offen ist Ihre erste Rechnung über 59,99 € mit dem Verwendungszweck FIAON-AB12CD. Mit einem Klick auf den Knopf unten ist sie in zwei Minuten erledigt.", "de"), "Deutscher Text in einer deutschen Mail passt");

abschnitt("6 · Nur persönliche Links — Knopf und Text");
const k1 = agent.schrittBestimmen({ naechster_schritt: { art: "antrag", url: "https://fiaon.com/antrag", text: "x" } }, "interessent", { antrag_link: { url: "https://fiaon.com/a/ABCDEFGHJK/m", persoenlich: true, leadCode: "ABCDEFGHJK" } }).schritt;
ok(k1?.url === "https://fiaon.com/a/ABCDEFGHJK/m", `Knopf „antrag“ → sein Code-Link, nie /antrag (${k1?.url})`);
const k2 = agent.schrittBestimmen({ naechster_schritt: { art: "antrag", url: null, text: "x" } }, "interessent", {}).schritt;
ok(k2?.url === null, "Ohne persönlichen Link KEIN Knopf auf /antrag (vorher Vorgabe „/antrag“)");
const k3 = agent.schrittBestimmen({ naechster_schritt: { art: "bereich", url: RATE.zahlungsseite, text: "x" } }, "aktiv", { zahlungslink_bauen: RATE }).schritt;
ok(k3?.art === "bereich" && /\/mein-bereich$/.test(String(k3?.url)), "#5559/#5565: „Zu meinem Bereich“ führt in den Bereich, nicht auf die Zahlungsseite");
const k4 = agent.schrittBestimmen({ naechster_schritt: { art: "zahlung", url: "https://fiaon.com/zahlung", text: "x" } }, "aktiv", {}).schritt;
ok(k4?.art === "zahlung" && k4?.url === null, "Vom Modell erfundene Zahlungsadresse gilt nie");
const lageL = agent.linkLageFuer({ werkzeugDaten: { antrag_link: { url: "https://fiaon.com/a/ABCDEFGHJK/m", persoenlich: true, leadCode: "ABCDEFGHJK" } }, lage: "interessent" });
ok(linkPruefung("Hier geht es los: https://fiaon.com/antrag", lageL).some((b) => b.schwere === "hart"), "Nackter /antrag im Text → harter Mangel");
ok(!linkPruefung("https://fiaon.com/a/ABCDEFGHJK/m", lageL).some((b) => b.schwere === "hart"), "Sein Code-Link → kein Mangel");
ok(linkPruefung("https://fiaon.com/a/ZZZZZZZZZZ/m", lageL).some((b) => b.art === "fremd"), "Ein fremder Code → harter Mangel");
const lageZ = agent.linkLageFuer({ werkzeugDaten: { zahlungslink_bauen: RATE }, lage: "rate_ueberfaellig" });
ok(!linkPruefung(RATE.zahlungsseite, lageZ).some((b) => b.schwere === "hart"), "Seine Zahlungsseite (Rate) → kein Mangel");
ok(linkPruefung("https://fiaon.com/zahlung/FIAON-ZZZZZZ", lageZ).some((b) => b.art === "fremd"), "Fremde Zahlungsseite → harter Mangel");

abschnitt("7 · Mara erledigt selbst — nur die zwei sicheren Fälle");
ok(agent.sichereSelbstErledigung({ flags: { stopp: true }, gelaufen: ["werbesperre_setzen"], werkzeugDaten: {} }) !== null, "Stopp mit gesetzter Werbesperre → selbst");
ok(agent.sichereSelbstErledigung({ flags: { stopp: true }, gelaufen: [], werkzeugDaten: {} }) === null, "Stopp OHNE Werbesperre → Mensch");
ok(agent.sichereSelbstErledigung({ flags: { kuendigung: true }, gelaufen: ["kuendigung_vormerken"], werkzeugDaten: { kuendigung_vormerken: { weg: "storno_unbezahlt" } } }) !== null, "Storno einer unbezahlten Bestellung („Keine Interesse“) → selbst");
ok(agent.sichereSelbstErledigung({ flags: { stopp: true, beschwerde: true }, gelaufen: ["werbesperre_setzen"], werkzeugDaten: {} }) === null, "Stopp + Beschwerde → Mensch");
ok(agent.sichereSelbstErledigung({ flags: { stopp: true, widerruf: true, rechtlich: true }, gelaufen: ["werbesperre_setzen"], werkzeugDaten: {} }) === null, "Stopp + Widerruf → Mensch");
ok(agent.sichereSelbstErledigung({ flags: { zahlung_behauptet: true }, gelaufen: [], werkzeugDaten: {} }) === null, "„Habe bezahlt“ → Mensch (Bankbuch)");
// Nachbesserung E-248 (Probelauf M1/M2/M3):
ok(agent.sichereSelbstErledigung({ flags: { stopp: true, kuendigung: true }, gelaufen: ["kuendigung_vormerken"], werkzeugDaten: { kuendigung_vormerken: { weg: "storno_unbezahlt" } } }) !== null, "M3: Storno + „stopp“ ohne Werbesperre → selbst (der Storno beendet die Erinnerungen)");
ok(agent.sichereSelbstErledigung({ flags: { kuendigung: true }, gelaufen: ["kuendigung_vormerken"], werkzeugDaten: { kuendigung_vormerken: { weg: "letzte_rate" } } }) !== null, "M1: gebuchte Kündigung eines laufenden Vertrags → selbst (auch wenn „dringend“)");
ok(agent.sichereSelbstErledigung({ flags: { stopp: true }, gelaufen: ["werbesperre_setzen"], werkzeugDaten: {}, antwort: "Gern, ich habe Sie aus den Werbe- und Erinnerungsmails herausgenommen. Wenn Sie auch diese Bestellung stornieren möchten, schreiben Sie mir kurz.", kundeText: "Stopp" }) === null, "M2: Stopp-Antwort MIT ungefragtem Storno-Angebot → Mensch");
ok(!!ton.stornoUngefragt("Wenn Sie auch diese Bestellung stornieren möchten, schreiben Sie mir kurz: bitte stornieren.", "Stopp"), "Storno-Angebot auf „Stopp“ erkannt");
ok(ton.stornoUngefragt("Möchten Sie, dass ich Ihre Bestellung jetzt storniere?", "Ich will das stornieren, geht das?") === null, "Hat er selbst „stornieren“ geschrieben, ist die Rückfrage erlaubt");

abschnitt("8 · Mehrfachversand: Doppel und Nachtrag (echte Fälle)");
const T = Date.parse("2026-09-21T13:23:00Z");
const textA = "Sehr geehrte liebe Frau Lindner, bitte unten lesen. Bitte mit meinem Betreuer sprechen, ich warte seit Tagen auf eine Antwort zu meinem Konto.";
const kand = [{ id: 5133, text: textA, am: T - 6 * 60_000, aktion: "gesendet" }];
ok(lauf.doppelUrteil({ text: textA, am: T }, kand)?.id === 5133, "Person A: derselbe Text sechs Minuten später → Doppel von #5133");
ok(lauf.doppelUrteil({ text: textA + "   ", am: T + 11 * 3_600_000 }, kand)?.id === 5133, "Person A: dieselbe Mail elf Stunden später → Doppel");
ok(lauf.doppelUrteil({ text: textA, am: T + 30 * 3_600_000 }, kand) === null, "… zwei Tage später ist es ein neues Nachfragen (keine Sperre)");
ok(lauf.doppelUrteil({ text: "", am: T + 60_000 }, kand)?.grund.includes("Nachtrag") === true, "Person B: leere Mail mit Anhang eine Minute später → Nachtrag");
ok(lauf.doppelUrteil({ text: "Ja", am: T + 2 * 3_600_000 }, [{ id: 1, text: "Ja", am: T, aktion: "gesendet" }]) === null, "Ein „Ja“ zwei Stunden später ist ein neues Ja (kurze Texte nur 30 Minuten)");
ok(lauf.doppelUrteil({ text: "Wann kommt meine Karte?", am: T }, kand) === null, "Anderer Text → kein Doppel");
ok(lauf.doppelSchluessel("Здравствуйте, когда будет карта?") !== "", "Kyrillischer Text wird nie ein leerer Schlüssel (sonst „Nachtrag“)");

abschnitt("9 · Mara-Aktion: Kreditkarte vorn, Wunschlimit nur mit der Bank, Einwände, Adresse");
// E-265 (29.09.2026, Justin: „VIEL MEHR AUF DIE KREDITKARTEN!"): Die Kreditkarte gehört in jede Mail; das
// Wunschlimit darf stehen — genannt, nie zugesagt, immer mit dem Satz über die Bank (limit_ohne_bank).
const gut = "Hier ist Mara Lindner, die digitale Assistentin von FIAON. Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte, mit Ihrem Wunschlimit von 5.000 € als Ziel — über den Rahmen entscheidet unsere Partnerbank. Dazu fehlt mir nur noch die offene Rechnung über 59,99 €.\n\nSobald Ihre Zahlung gebucht ist, schaltet das System Sie frei. Über den Knopf unten ist es in zwei Minuten erledigt. Einen schönen Abend wünsche ich Ihnen.";
ok(aktion.aktionPruefen("Ihr Account wartet auf einen Schritt", gut).length === 0, "Gute Mail (Kreditkarte, Wunschlimit mit Bank-Satz) besteht");
ok(aktion.aktionPruefen("Kurz zu Ihrer Karte", gut.replace(" — über den Rahmen entscheidet unsere Partnerbank", "")).some((m) => /Bank|bank/.test(m)), "„Wunschlimit“ ohne den Satz über die Bank fällt durch");
ok(aktion.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Wunschlimit", "Limit")).some((m) => /Limit|limit/.test(m)), "„Limit“ allein fällt weiter durch (Rahmen statt Limit)");
ok(aktion.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("eigenen Visa-Kreditkarte", "eigenen Karte")).some((m) => /Kreditkarte/.test(m)), "Mail ohne „Kreditkarte“ fällt durch");
ok(aktion.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("offene Rechnung", "offene Rechnung und Ihre SCHUFA-Prüfung"), { land: "AT" }).some((m) => /SCHUFA/.test(m)), "„SCHUFA“ an einen Kunden in Österreich fällt durch");
const qa = readFileSync(new URL("../server/lib/fiaon-mara-aktion.ts", import.meta.url), "utf8");
ok(/einwand AS/.test(qa) && /NOT IN \(SELECT person_id FROM einwand\)/.test(qa), "Kandidaten: Widerruf/Bestreiten/Anwalt/„kann nicht zahlen“ ausgeschlossen");
ok(/gesperrte_adresse AS/.test(qa), "Kandidaten: Werbesperre an der Adresse schon in der Schlange");
ok(!/FIAON vergibt und vermittelt keine Kredite/.test(qa), "Aktion: kein Pflicht-Nein „FIAON vergibt keine Kredite“ mehr");

abschnitt("10 · Der Auftrag (Quelltext): Persona, keine IBAN, keine Menschen-Behauptung");
const qp = readFileSync(new URL("../server/lib/fiaon-postmeister-agent.ts", import.meta.url), "utf8");
ok(/personaText\("mail"/.test(qp), "Postfach: Persona aus shared/fiaon-mara-ton.ts");
ok(!/Du bist ein Mensch am Schreibtisch, kein Automat/.test(qp), "Nie mehr „Du bist ein Mensch am Schreibtisch“ (KI-Offenlegung)");
ok(!/Verwendungszweck und die IBAN — zum Ablesen/.test(qp), "Keine IBAN aus dem Kopf (Widerspruch zur Wortwand aufgelöst)");
ok(!/FIAON vergibt keine Kredite und vermittelt keine\. Erkläre/.test(qp), "Kredit: kein Nein am Anfang mehr");
ok(!/antrag: "\/antrag"/.test(qp), "Keine Knopf-Vorgabe „/antrag“ mehr");
// E-265: „Wunschlimit" steht jetzt im Postfach-Auftrag — nur mit dem Satz über die Bank.
ok(/Wunschlimit[^\n]{0,160}entscheidet unsere Partnerbank/.test(qp) || /kartenziel[^\n]{0,200}entscheidet unsere Partnerbank/.test(qp), "„Wunschlimit“ im Postfach-Auftrag nur mit „über den Rahmen entscheidet unsere Partnerbank“");
ok(/kostenCentsAus\(MODELL\(\)/.test(qp), "Kosten je Zeile wie in der Nutzungstabelle (vorher Tokens/1000)");
for (const b of [agent.AUSKUNFT_MUSTER_ANTWORT]) {
  ok(!tonPruefung(b, { kanal: "mail" }).some((x) => x.schwere === "hart"), "Musterantwort Auskunft: kein harter Ton-Treffer (kein „Limit“)");
}

abschnitt("11 · Abstreiten per Mail (E-264) — Riegel und Link-Lage");
{
  const leer = { kategorien: ["frage"] as any[], flags: {} as any };
  const r1 = agent.riegelAnwenden({ betreff: "Re: Ihr Antrag", text: "Ich habe nie etwas bei Ihnen beantragt!", ...leer });
  ok(!r1.flags.stopp && r1.flags.bestreitet, "„Ich habe nie etwas bei Ihnen beantragt!“ → Bestreiten (Riegel), kein dauerhafter Stopp");
  const r2 = agent.riegelAnwenden({ betreff: "Re: Ihr Antrag", text: "Hab nix beantragt 😡", ...leer });
  ok(!r2.flags.stopp && r2.flags.bestreitet, "„Hab nix beantragt 😡“ → Bestreiten (der alte Riegel kannte nur „nie bestellt“)");
  // Nachbesserung E-264 (Gegenlesen): Der Riegel setzte „stopp" auch bei zahlenden Kunden, die sich über
  // „Betrug" beschwerten, und bei „Spam-Ordner" — stopp ist dauerhaft (auch keine Raten-Erinnerung mehr).
  const r6 = agent.riegelAnwenden({ betreff: "Re: Zahlung", text: "Ich habe längst die erste Rate bezahlt. Sieht eher wie Betrug aus. Bitte um Info", ...leer });
  ok(!r6.flags.stopp, "Zahlender Kunde „… Sieht eher wie Betrug aus. Bitte um Info“ → KEIN Stopp");
  const r7 = agent.riegelAnwenden({ betreff: "Re: Ihr Zugang", text: "Ihre Mail war im Spam-Ordner. Wie geht es weiter?", ...leer });
  ok(!r7.flags.stopp && !r7.flags.bestreitet, "„Ihre Mail war im Spam-Ordner …“ → kein Stopp, kein Bestreiten");
  const r8 = agent.riegelAnwenden({ betreff: "Karte", text: "Ich will Sie nicht belästigen, aber wann kommt meine Karte?", ...leer });
  ok(!r8.flags.stopp, "„Ich will Sie nicht belästigen, aber …“ → kein Stopp");
  const r9 = agent.riegelAnwenden({ betreff: "Re: Ihr Antrag", text: "Lassen Sie mich in Ruhe!", ...leer });
  ok(r9.flags.stopp, "„Lassen Sie mich in Ruhe!“ → Stopp (ausdrücklich)");
  const r3 = agent.riegelAnwenden({ betreff: "Re: Ihr Antrag", text: "Löschen Sie bitte sofort meine Daten.", ...leer });
  ok(r3.flags.stopp && r3.flags.rechtlich && !r3.flags.bestreitet, "„Löschen Sie bitte sofort meine Daten“ → Stopp + rechtlich");
  const r4 = agent.riegelAnwenden({ betreff: "Frage", text: "Woher haben Sie meine E-Mail-Adresse?", ...leer });
  ok(!r4.flags.stopp && !r4.flags.bestreitet, "„Woher haben Sie meine E-Mail-Adresse?“ → kein Stopp (ehrlich antworten, Stopp anbieten)");
  const zitiert = "Ich möchte wissen, wann meine Karte kommt.\n\nAm 28.09.2026 schrieb FIAON <welcome@fiaon.com>:\n> Sie haben nie etwas beantragt? Dann antworten Sie einfach.";
  const r5 = agent.riegelAnwenden({ betreff: "Re: Karte", text: zitiert, ...leer });
  ok(!r5.flags.bestreitet, "Unser eigener zitierter Text zählt nie als sein Abstreiten");
  ok(agent.linkLageFuer({ werkzeugDaten: {}, lage: "unbezahlt" }).stufe === "zahlung_offen", "Lage „unbezahlt“ heißt seit E-264 immer abgeschickt → zahlung_offen");
  ok(linkPruefung("Offen ist Ihre erste Rechnung über 59,99 €.", agent.linkLageFuer({ werkzeugDaten: {}, lage: "interessent" })).some((b) => b.art === "ohne_antrag" && b.schwere === "hart"), "Zahlungssatz an einen Interessenten (nie abgeschickt) → harter Mangel");
  const m = ton.bausteinAbstreiten({ kanal: "mail", art: "bestreitet", herkunft: { art: "antrag", am: "2026-07-29T05:24:00Z" } });
  ok(!tonPruefung(m, { kanal: "mail" }).length && !wandPruefen(m).filter((w) => w.art !== "zusage").length && !linkPruefung(m, { stufe: "antrag_offen" }).length, "Die Mail-Antwort besteht Ton, Wortwand und Link");
}

// ═══ TEIL B · MIT DER LOKALEN TEST-DB ═════════════════════════════════════
if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
  const START = new Date();
  const EINSTELLUNGEN = ["ki_pause", "postmeister_an", "postmeister_v2"];
  const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`) as any[];
  const personen: Record<string, number> = {};
  const PF = "support@fiaon.com";
  const GRUSS = "Freundliche Grüße\nIhr FIAON Support-Team";
  const jetzt = Date.now();
  let mailNr = 0;

  const person = async (kurz: string, extra: { email?: string } = {}) => {
    const mail = extra.email ?? `pruef248m-${kurz.toLowerCase()}@kunde.invalid`;
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PRUEF248M-${kurz}`}, 'Max', ${`Prüfer${kurz}`}, ${mail}) RETURNING id`) as any[];
    personen[kurz] = Number(p.id);
    return { id: Number(p.id), mail };
  };
  const antrag = async (ref: string, personId: number, mail: string, o: { status: string; betrag?: number | null; agb?: string | null; typ?: string }) => {
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, agb_stand, created_at)
              VALUES (${ref}, ${personId}, 'private', ${o.typ ?? "submitted"}, 'pro', 'FIAON Pro (Standard)', ${ref}, ${o.status}, ${o.betrag === undefined ? 59.99 : o.betrag}, 'Max', 'Prüfer', ${mail}, ${o.agb ?? null}, NOW() - INTERVAL '40 days')`;
  };
  const rate = async (ref: string, nr: number, status: string, faellig: string) => {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, ${nr}, ${`${ref}-${nr}`}, 5999, ${faellig}, ${status})`;
  };
  /** Eine Kundenmail durch den ganzen Lauf — mit Drehbuch für das Modell. */
  const lauf1 = async (von: string, text: string, sz: Szenario, o: { betreff?: string; thread?: string; vorMin?: number } = {}) => {
    mailNr += 1;
    const gmailId = `e248m-${mailNr}`;
    NACHRICHTEN.set(gmailId, { thread: o.thread ?? `e248m-t${mailNr}`, am: jetzt - (o.vorMin ?? 3) * 60_000, von: `Max Prüfer <${von}>`, betreff: o.betreff ?? "Frage", text });
    SZ = sz;
    const vorKi = OPENAI.length, vorSenden = GMAIL_SENDEN.length, vorEntwurf = GMAIL_ENTWURF.length;
    const e = await lauf.mailBearbeiten({ postfach: PF, gmailId, gruss: GRUSS, modus: "auto" });
    const [z] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[];
    // --zeigen: die fertige Mail (Anrede · Text · Knopf · Gruß) zum Lesen — für Justin.
    if (process.argv.includes("--zeigen")) console.log(`\n  ┌ Mail #${z?.id} (${z?.aktion}; ${String(z?.begruendung ?? "").slice(0, 80)})\n${String(z?.antwort ?? "(keine Antwort)").split("\n").map((l: string) => `  │ ${l}`).join("\n")}\n  └`);
    const lies = (w: unknown) => { if (w == null) return null; if (typeof w === "object") return w; try { const x = JSON.parse(String(w)); return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } };
    return {
      e, z, id: Number(z?.id), schritt: lies(z?.naechster_schritt) as any, pruefung: lies(z?.pruefung) as any, handlungen: lies(z?.handlungen) as any[] | null,
      kiAntwort: OPENAI.slice(vorKi).filter((x) => x.art === "antwort"), gesendet: GMAIL_SENDEN.length - vorSenden, entwuerfe: GMAIL_ENTWURF.length - vorEntwurf,
    };
  };

  try {
    await postmeisterSchema();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren?.();

    // ── 1. KÜNDIGUNG ───────────────────────────────────────────────────────
    abschnitt("DB 1 · Kündigung wird gebucht (E-213) — nie falsch bestätigt");
    const A = await person("A");
    await antrag("FIAON-P248MA", A.id, A.mail, { status: "paid", agb: null });
    await rate("FIAON-P248MA", 1, "bezahlt", "2026-09-01");
    // E-265 Nachbesserung (29.09.2026): Altvertrag — die Rate muss VOR dem Vertragsende (E-265 Recht: Ende des
    // Abrechnungsmonats, Fälligkeit zu Fälligkeit) fällig sein, sonst verlangt Mara sie nie (Fall „Rate nach
    // Vertragsende" unten). Vorher 15.10.: eine Rate für die Zeit nach dem Ende.
    await rate("FIAON-P248MA", 2, "offen", "2026-09-15");
    const s1 = await lauf1(A.mail, "Hallo, ich Max Prüfer kündige per sofort den Vertrag. Grüße", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kündigt per sofort.", flags: { kuendigung: true } },
      werkzeuge: [
        { name: "kuendigung_vormerken", args: { zitat: "ich Max Prüfer kündige per sofort den Vertrag", grund: "" } },
        { name: "zahlungslink_bauen", args: { referenz: "FIAON-P248MA-2" } },
      ],
      antwort: {
        antwort: "Ihre Kündigung ist vorgemerkt und gilt zum Ende Ihres laufenden Abrechnungsmonats. Offen ist noch Rate 2 über 59,99 € (fällig am 15.09.2026) mit dem Verwendungszweck FIAON-P248MA-2 — die zahlen Sie bitte noch, danach kommt nichts mehr.\n\nWenn Sie es sich anders überlegen, schreiben Sie mir einfach.",
        naechster_schritt: { art: "zahlung", url: null, text: "Rechnung ansehen und bezahlen" },
        belege: [{ satz: "Offen ist noch Rate 2 über 59,99 €", werkzeug: "kuendigung_vormerken", feld: "letzte_rate" }], fragen_beantwortet: [], merken: [],
      },
    });
    const [aA] = (await sql`SELECT gekuendigt_am, kuendigung_quelle FROM fiaon_applications WHERE ref = 'FIAON-P248MA'`) as any[];
    ok(!!aA?.gekuendigt_am && aA?.kuendigung_quelle === "mail", "#5626: Kündigung „Ich [Name] kündige per sofort“ ist GEBUCHT");
    ok((s1.handlungen ?? []).some((h: any) => h.werkzeug === "kuendigung_vormerken" && h.ok), "Werkzeug kuendigung_vormerken lief erfolgreich");
    ok(/formlos kündbar/.test(s1.kiAntwort[0]?.system ?? ""), "Auftrag nennt: Vertrag vor dem 03.09. — formlos kündbar");
    if (process.env.PRUEF_AUFTRAG_DATEI) (await import("node:fs")).writeFileSync(process.env.PRUEF_AUFTRAG_DATEI, s1.kiAntwort[0]?.system ?? "");
    ok(s1.z?.aktion === "auto_beantwortet" && s1.gesendet === 1, `Gebucht und sauber → Mara sendet selbst (${s1.z?.aktion}, ${s1.z?.begruendung})`);
    ok(s1.schritt?.art === "zahlung" && /\/zahlung\/FIAON-P248MA-2$/.test(String(s1.schritt?.url)), "Justins Regel bleibt: letzte Rate mit Knopf auf SEINE Zahlungsseite");

    const B = await person("B");
    await antrag("FIAON-P248MB", B.id, B.mail, { status: "paid", agb: "2026-09-10" });
    await rate("FIAON-P248MB", 1, "bezahlt", "2026-09-10");
    await rate("FIAON-P248MB", 2, "offen", "2026-10-10");
    const falsch = "Ihre Kündigung liegt mir jetzt eindeutig vor, und mit der Zahlung ist alles abgeschlossen.";
    const s1b = await lauf1(B.mail, "Wie kann ich meinen Vertrag kündigen?", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: ["Wie kann ich kündigen?"], zusammenfassung: "Fragt, wie er kündigen kann.", flags: { kuendigung: true } },
      werkzeuge: [{ name: "kuendigung_vormerken", args: { zitat: "Hiermit kündige ich meinen Vertrag.", grund: "" } }],
      antwort: { antwort: falsch, naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: falsch, naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const [aB] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = 'FIAON-P248MB'`) as any[];
    ok(!aB?.gekuendigt_am, "Erfundenes Zitat („Hiermit kündige ich“) zählt nicht — sein Text ist eine Frage, nichts gebucht");
    ok(s1b.z?.aktion === "entwurf" && s1b.gesendet === 0, `„liegt mir eindeutig vor“ ohne Buchung geht NIE raus (${s1b.z?.aktion})`);
    ok((s1b.pruefung?.fehlend ?? []).some((f: string) => /ohne Buchung entfernt/.test(f)), "Prüfung nennt den Grund: bestätigt, aber nicht gebucht");
    ok(!/liegt mir jetzt eindeutig vor/.test(String(s1b.z?.antwort)) && /Ein kurzes Ja genügt/.test(String(s1b.z?.antwort)), "Auch der Entwurf trägt die falsche Bestätigung nicht mehr — die Rückfrage steht an ihrer Stelle (die Zentrale prüft beim Freigeben nur die Wortwand)");
    ok(/Kündigung angesprochen, aber nicht gebucht/.test(String(s1b.z?.begruendung)), `Übergabe an einen Menschen mit Grund („${String(s1b.z?.begruendung).slice(0, 70)}“)`);

    // ── Nachbesserung E-248: Verneinung bucht nie, ein „Ja“ auf die Rückfrage bucht ──
    const NP = await person("NP");
    await antrag("FIAON-P248MP", NP.id, NP.mail, { status: "paid", agb: "2026-09-10" });
    await rate("FIAON-P248MP", 1, "bezahlt", "2026-09-10");
    await rate("FIAON-P248MP", 2, "offen", "2026-10-10");
    const sNP = await lauf1(NP.mail, "Ich will nicht kündigen, ich zahle morgen. Wann kommt meine Karte?", {
      einordnung: { kategorien: ["frage"], dringend: false, sprache: "de", fragen: ["Wann kommt die Karte?"], zusammenfassung: "Zahlt morgen.", flags: { kuendigung: true } },
      werkzeuge: [{ name: "kuendigung_vormerken", args: { zitat: "kündigen", grund: "" } }],
      antwort: { antwort: "Danke Ihnen — schön, dass Sie dabeibleiben!", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const [aNP] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = 'FIAON-P248MP'`) as any[];
    ok(!aNP?.gekuendigt_am, "„Ich will nicht kündigen, ich zahle morgen“ — auch mit Zitat „kündigen“ wird NICHTS gebucht");
    ok((sNP.handlungen ?? []).some((h: any) => h.werkzeug === "kuendigung_vormerken" && !h.ok), "Das Werkzeug lehnt ab (keine eindeutige Kündigung)");
    const JA = await person("JA");
    await antrag("FIAON-P248MQ", JA.id, JA.mail, { status: "paid", agb: "2026-09-10" });
    await rate("FIAON-P248MQ", 1, "bezahlt", "2026-09-10");
    await rate("FIAON-P248MQ", 2, "offen", "2026-10-10");
    await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, ref, aktion, antwort, gesendet_am, created_at)
              VALUES (${PF}, 'e248m-rueckfrage', 'e248m-t-rf', ${JA.id}, 'FIAON-P248MQ', 'gesendet', 'Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt.', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')`;
    await lauf1(JA.mail, "Ja", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Bestätigt die Kündigung.", flags: { kuendigung: true } },
      werkzeuge: [{ name: "kuendigung_vormerken", args: { zitat: "Ja", grund: "" } }],
      antwort: { antwort: "Ihre Kündigung ist vorgemerkt.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const [aJA] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = 'FIAON-P248MQ'`) as any[];
    ok(!!aJA?.gekuendigt_am, "„Ja“ auf unsere Rückfrage „… jetzt kündige? Ein kurzes Ja genügt.“ → GEBUCHT (keine Kündigungsschleife)");
    // Abgelaufene Bestellung: Mara schaltet sie neu frei, bevor sie die Zahlungsseite schickt.
    const EX = await person("EX");
    await antrag("FIAON-P248MR", EX.id, EX.mail, { status: "expired" });
    await lauf1(EX.mail, "Wo kann ich jetzt bezahlen? Der Link sagt abgelaufen.", {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: ["Wo bezahlen?"], zusammenfassung: "Will zahlen.", flags: {} },
      werkzeuge: [{ name: "zahlungslink_bauen", args: { referenz: "FIAON-P248MR" } }],
      antwort: { antwort: "Gern — Ihre Bestellung ist wieder offen, die Zahlungsseite gilt.", naechster_schritt: { art: "zahlung", url: null, text: "Jetzt bezahlen" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const [aEX] = (await sql`SELECT payment_status, payment_due_date FROM fiaon_applications WHERE ref = 'FIAON-P248MR'`) as any[];
    ok(aEX?.payment_status === "pending_payment" && !!aEX?.payment_due_date, `Abgelaufene Bestellung neu freigeschaltet (${aEX?.payment_status}) — nie die „abgelaufen“-Seite`);

    // ── E-265 Nachbesserung (29.09.2026, Recht): Altvertrag, die einzige offene Rate liegt NACH dem Vertragsende ──
    // Die Kündigung gilt zum Ende des Abrechnungsmonats (E-265 Recht 01.10.: Fälligkeit zu Fälligkeit — hier 01.09. bis
    // zum Tag vor der Rate in 40 Tagen); eine Rate für die Zeit danach verlangt Mara nie (kein Zahlknopf, keine
    // Zahlungsbitte). Nachbesserung 2 (01.10.2026, EINE Rechnung): kuendigungSetzen storniert sie selbst (storno_grund
    // „kuendigung“) — kein Prüffall mehr; Urkunde, Bestätigungsmail und Mail lesen dieselbe Liste.
    const NE = await person("NE");
    await antrag("FIAON-P248M5N", NE.id, NE.mail, { status: "paid", agb: null });
    await rate("FIAON-P248M5N", 1, "bezahlt", "2026-09-01");
    const spaet = new Date(Date.now() + 40 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    await rate("FIAON-P248M5N", 2, "offen", spaet);
    const sNE = await lauf1(NE.mail, "Hiermit kündige ich meinen Vertrag.", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kündigt.", flags: { kuendigung: true } },
      werkzeuge: [{ name: "kuendigung_vormerken", args: { zitat: "Hiermit kündige ich meinen Vertrag.", grund: "" } }],
      antwort: { antwort: "Ihre Kündigung ist heute bei uns eingegangen und gilt zum Ende Ihres laufenden Abrechnungsmonats, danach kommt nichts mehr.\n\nWenn Sie es sich anders überlegen, schreiben Sie mir einfach.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const [aNE] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = 'FIAON-P248M5N'`) as any[];
    const kvNE = (sNE.handlungen ?? []).find((h: any) => h.werkzeug === "kuendigung_vormerken") as any;
    ok(!!aNE?.gekuendigt_am && kvNE?.ok && /keine Rate mehr offen/.test(String(kvNE?.ergebnis ?? "")), `Altvertrag: gebucht, die Rate nach dem Vertragsende ist nicht „offen zu zahlen“ („${String(kvNE?.ergebnis ?? "").slice(0, 80)}“)`);
    ok(sNE.z?.aktion === "auto_beantwortet" || /Entwurf \(Lage oder Flag\)|sauber/.test(String(sNE.z?.begruendung ?? "")), `die Antwort ohne Zahlungsbitte ist sauber (${sNE.z?.aktion}, ${String(sNE.z?.begruendung ?? "").slice(0, 70)})`);
    ok(sNE.schritt?.art !== "zahlung", `kein Zahlknopf (${sNE.schritt?.art})`);
    const pfNE = (await sql`SELECT 1 FROM fiaon_betreiber_todos WHERE schluessel = 'postmeister:kuendigung-nach-ende:FIAON-P248M5N'`) as any[];
    const [r2NE] = (await sql`SELECT status, storno_grund FROM fiaon_abo_raten WHERE ref = 'FIAON-P248M5N' AND rate_nr = 2`) as any[];
    ok(pfNE.length === 0 && r2NE?.status === "storniert" && r2NE?.storno_grund === "kuendigung", `die Rate nach dem Vertragsende entfällt mit der Kündigung (${r2NE?.status}/${r2NE?.storno_grund ?? "-"}), kein Prüffall (${pfNE.length})`);
    const NF = await person("NF");
    await antrag("FIAON-P248M5F", NF.id, NF.mail, { status: "paid", agb: null });
    await rate("FIAON-P248M5F", 1, "bezahlt", "2026-09-01");
    await rate("FIAON-P248M5F", 2, "offen", spaet);
    const sNE2 = await lauf1(NF.mail, "Ich kündige den Vertrag zum Monatsende.", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kündigt.", flags: { kuendigung: true } },
      werkzeuge: [{ name: "kuendigung_vormerken", args: { zitat: "Ich kündige den Vertrag zum Monatsende.", grund: "" } }],
      antwort: { antwort: "Ihre Kündigung liegt uns vor. Offen ist noch Rate 2 über 59,99 € — die zahlen Sie bitte noch.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: "Ihre Kündigung liegt uns vor. Offen ist noch Rate 2 über 59,99 € — die zahlen Sie bitte noch.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(sNE2.gesendet === 0 && (sNE2.pruefung?.fehlend ?? []).some((f: string) => /bis zum Vertragsende nichts mehr zu zahlen/.test(f)), `… verlangt die Mail die Rate trotzdem, geht sie nicht raus (${sNE2.z?.aktion}: ${(sNE2.pruefung?.fehlend ?? []).join(" · ").slice(0, 160)})`);

    // ── E-265 (01.10.2026, Paket Recht): ABRECHNUNGSMONAT STATT KALENDERMONAT — direkt an kuendigungSetzen, mit festen
    // Daten (Erklärung über `am`), AGB 04.07.2026 § 6: Frist 24 Stunden zum Ende des Abrechnungsmonats (Fälligkeit zu
    // Fälligkeit). Raten jeweils am 28.
    abschnitt("DB 1b · Abrechnungsmonat (E-265, Recht 01.10.2026) — Beispiele, 12665, Jahresvertrag, ohne Kette");
    {
      const { kuendigungSetzen, vertragsendeLesen, rateNachVertragsende } = await import("../server/lib/fiaon-kuendigung");
      const { bestaetigungInhalt } = await import("../server/routes/fiaon-kuendigung");
      const bTag = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null);
      const rateStand = async (ref: string) => Object.fromEntries(((await sql`SELECT rate_nr, status, storno_grund FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[]).map((r) => [Number(r.rate_nr), `${r.status}/${r.storno_grund ?? "-"}`]));
      // Beispiel 1 (= 12665, Kündigung am Fälligkeitstag): Kündigung 28.09. → Rate vom 28.09. geschuldet, Ende 27.10., Rate 28.10. entfällt.
      const AM1 = await person("AM1");
      await antrag("FIAON-P248MA1", AM1.id, AM1.mail, { status: "paid", agb: null });
      await rate("FIAON-P248MA1", 1, "bezahlt", "2026-07-28"); await rate("FIAON-P248MA1", 2, "bezahlt", "2026-08-28");
      await rate("FIAON-P248MA1", 3, "offen", "2026-09-28"); await rate("FIAON-P248MA1", 4, "offen", "2026-10-28");
      const e1 = await kuendigungSetzen("FIAON-P248MA1", { quelle: "mail", am: "2026-09-28T10:00:00+02:00" });
      const st1 = await rateStand("FIAON-P248MA1");
      ok(e1.ok && e1.weg === "letzte_rate" && e1.letzteRateNr === 3 && e1.stornierteRaten === 1 && st1[3] === "offen/-" && st1[4] === "storniert/kuendigung", `Beispiel 1: Kündigung 28.09. → Rate 3 (28.09.) geschuldet, Rate 4 (28.10.) entfällt (${e1.weg}, letzte ${e1.letzteRateNr}, ${JSON.stringify(st1)})`);
      const v1 = await vertragsendeLesen("FIAON-P248MA1");
      ok(!v1.jahresvertrag && v1.ende === "2026-10-27" && v1.endeDe === "27.10.2026" && v1.quelle === "raten", `… Vertragsende 27.10.2026 aus der Ratenkette (${v1.ende}, ${v1.quelle})`);
      ok((await rateNachVertragsende("FIAON-P248MA1-3")) === null && (await rateNachVertragsende("FIAON-P248MA1-4"))?.ende === "27.10.2026", "… Rate 3 liegt im Vertrag, Rate 4 danach (rateNachVertragsende)");
      const [aAM1] = (await sql`SELECT agb_stand, gekuendigt_am, (SELECT json_agg(json_build_object('rate_nr', rate_nr, 'betrag_cents', betrag_cents, 'faellig_am', faellig_am, 'zahlungsreferenz', zahlungsreferenz)) FROM fiaon_abo_raten WHERE ref = 'FIAON-P248MA1' AND status = 'offen' AND storniert_am IS NULL) AS offene_raten FROM fiaon_applications WHERE ref = 'FIAON-P248MA1'`) as any[];
      const inh1 = bestaetigungInhalt({ ...aAM1, ende_tag: v1.ende });
      ok(!!inh1 && /gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27\.10\.2026/.test(inh1.vertrag_satz) && /Rate 3 über 59,99 €/.test(inh1.offen_satz) && !/Monatsende/.test(`${inh1.vertrag_satz} ${inh1.offen_satz} ${inh1.preheader_text}`), `… Bestätigungsmail: „${String(inh1?.vertrag_satz ?? "").slice(0, 150)}“`);
      const prot1 = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = 'FIAON-P248MA1' ORDER BY id DESC LIMIT 1`) as any[];
      ok(/zum Ende des Abrechnungsmonats \(27\.10\.2026\)/.test(String(prot1[0]?.note ?? "")), `… Verlauf nennt das Vertragsende („${String(prot1[0]?.note ?? "").slice(0, 120)}“)`);
      // Nachbesserung Recht (01.10.2026, Gegenprüfung M2): Die Zahlung der letzten Rate (02.10.) setzt beim Altvertrag das
      // Vertragsende auf das Ende des Abrechnungsmonats (27.10., Berliner Tagesende) — nicht auf den Zahltag; die Lesestelle
      // liefert 27.10. Vorher stand NOW(), und Mara, Dossier und Urkunde sagten „gilt zum … dem 02.10.2026".
      {
        const { vertragEndePruefen } = await import("../server/lib/fiaon-kuendigung");
        await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = '2026-10-02T12:00:00Z' WHERE ref = 'FIAON-P248MA1' AND rate_nr = 3`;
        const z1 = await vertragEndePruefen("FIAON-P248MA1", 3);
        const [aZ1] = (await sql`SELECT vertrag_ende_am, to_char(vertrag_ende_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD HH24:MI:SS') AS ende_berlin FROM fiaon_applications WHERE ref = 'FIAON-P248MA1'`) as any[];
        const vZ1 = await vertragsendeLesen("FIAON-P248MA1");
        ok(z1.beendet && aZ1?.ende_berlin === "2026-10-27 23:59:59", `M2: letzte Rate 3 am 02.10. bezahlt → vertrag_ende_am = Ende des Abrechnungsmonats 27.10. 23:59:59 Berlin, nicht der Zahltag (${aZ1?.ende_berlin})`);
        ok(vZ1.ende === "2026-10-27" && vZ1.endeDe === "27.10.2026" && vZ1.quelle === "vertrag_ende_am", `M2: … und die Lesestelle liefert 27.10.2026 (${vZ1.ende}, ${vZ1.quelle})`);
        const protZ1 = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = 'FIAON-P248MA1' ORDER BY id DESC LIMIT 1`) as any[];
        ok(/Letzte Rate 3 bezahlt/.test(String(protZ1[0]?.note ?? "")) && /Abrechnungsmonats \(27\.10\.2026\)/.test(String(protZ1[0]?.note ?? "")), `M2: … Verlauf nennt das Ende („${String(protZ1[0]?.note ?? "").slice(0, 110)}“)`);
        // Altdaten: ein zu frühes vertrag_ende_am (Zahltag 02.10., gesetzt vor dieser Nachbesserung) → die Lesestelle liefert
        // trotzdem das Ende des Abrechnungsmonats; die Akte (Dossier) liest dieselbe Stelle.
        await sql`UPDATE fiaon_applications SET vertrag_ende_am = '2026-10-02T10:00:00Z' WHERE ref = 'FIAON-P248MA1'`;
        const vAlt = await vertragsendeLesen("FIAON-P248MA1");
        ok(vAlt.ende === "2026-10-27" && vAlt.quelle === "raten", `M2: Altdaten — vertrag_ende_am 02.10. (Zahltag) → Lesestelle liefert trotzdem 27.10. (${vAlt.ende}, ${vAlt.quelle})`);
        const akteAlt = await (await import("../server/lib/fiaon-postmeister-dossier")).akteLesen(AM1.id, "FIAON-P248MA1");
        ok(akteAlt.kuendigung?.giltZum === "27.10.2026", `M2: … die Akte nennt 27.10.2026 (giltZum ${akteAlt.kuendigung?.giltZum})`);
        ok((await rateNachVertragsende("FIAON-P248MA1-4"))?.ende === "27.10.2026", "M2: … Rate 4 (28.10.) liegt weiter nach dem Vertragsende 27.10.");
        // Ein späteres vertrag_ende_am (z. B. Kulanz-Ende nach dem Abrechnungsmonat) bleibt, wie es ist.
        await sql`UPDATE fiaon_applications SET vertrag_ende_am = '2026-11-15T10:00:00Z' WHERE ref = 'FIAON-P248MA1'`;
        const vSpaet = await vertragsendeLesen("FIAON-P248MA1");
        ok(vSpaet.ende === "2026-11-15" && vSpaet.quelle === "vertrag_ende_am", `M2: ein späteres vertrag_ende_am bleibt (${vSpaet.ende}, ${vSpaet.quelle})`);
      }
      // Beispiel 2: Kündigung 26.09. (Frist läuft 27.09. ab) → Abrechnungsmonat 28.08.–27.09. → Rate 28.09. entfällt, Ende 27.09.
      const AM2 = await person("AM2");
      await antrag("FIAON-P248MA2", AM2.id, AM2.mail, { status: "paid", agb: null });
      await rate("FIAON-P248MA2", 1, "bezahlt", "2026-07-28"); await rate("FIAON-P248MA2", 2, "bezahlt", "2026-08-28"); await rate("FIAON-P248MA2", 3, "offen", "2026-09-28");
      const e2 = await kuendigungSetzen("FIAON-P248MA2", { quelle: "mail", am: "2026-09-26T10:00:00+02:00" });
      const st2 = await rateStand("FIAON-P248MA2");
      ok(e2.ok && e2.weg === "sofort_beendet" && e2.stornierteRaten === 1 && st2[3] === "storniert/kuendigung" && bTag(e2.vertragEndeAm) === "2026-09-27", `Beispiel 2: Kündigung 26.09. → Rate 3 (28.09.) entfällt, Vertragsende 27.09. (${e2.weg}, Ende ${bTag(e2.vertragEndeAm)}, ${JSON.stringify(st2)})`);
      const v2 = await vertragsendeLesen("FIAON-P248MA2");
      ok(v2.ende === "2026-09-27" && v2.quelle === "vertrag_ende_am", `… vertragsendeLesen liest das gesetzte Ende (${v2.ende}, ${v2.quelle})`);
      // 24-Stunden-Frist: Kündigung 27.09. 23:30 → Frist endet 28.09. 23:30 → Abrechnungsmonat 28.09.–27.10. → Rate 28.09. geschuldet.
      const AM3 = await person("AM3");
      await antrag("FIAON-P248MA3", AM3.id, AM3.mail, { status: "paid", agb: null });
      await rate("FIAON-P248MA3", 1, "bezahlt", "2026-07-28"); await rate("FIAON-P248MA3", 2, "bezahlt", "2026-08-28"); await rate("FIAON-P248MA3", 3, "offen", "2026-09-28");
      const e3 = await kuendigungSetzen("FIAON-P248MA3", { quelle: "mail", am: "2026-09-27T23:30:00+02:00" });
      ok(e3.ok && e3.weg === "letzte_rate" && e3.letzteRateNr === 3 && (await vertragsendeLesen("FIAON-P248MA3")).ende === "2026-10-27", `Frist: Kündigung 27.09. 23:30 → Rate 3 (28.09.) geschuldet, Ende 27.10. (${e3.weg}, letzte ${e3.letzteRateNr})`);
      // Jahresvertrag unverändert: nur fällige Raten (Kulanz), kein Abrechnungsmonat.
      const AJ = await person("AJ");
      await antrag("FIAON-P248MAJ", AJ.id, AJ.mail, { status: "paid", agb: "2026-09-10" });
      await rate("FIAON-P248MAJ", 1, "bezahlt", "2026-09-10"); await rate("FIAON-P248MAJ", 2, "offen", "2026-10-10"); await rate("FIAON-P248MAJ", 3, "offen", "2026-11-10");
      const eJ = await kuendigungSetzen("FIAON-P248MAJ", { quelle: "mail", am: "2026-10-15T10:00:00+02:00" });
      const stJ = await rateStand("FIAON-P248MAJ");
      const vJ = await vertragsendeLesen("FIAON-P248MAJ");
      ok(eJ.ok && eJ.weg === "letzte_rate" && eJ.letzteRateNr === 2 && stJ[3] === "storniert/kuendigung" && eJ.vertragEndeAm === null && vJ.jahresvertrag && vJ.ende === null, `Jahresvertrag unverändert: fällige Rate 2 bleibt (Kulanz), Rate 3 entfällt, kein Abrechnungsmonat (${eJ.weg}, letzte ${eJ.letzteRateNr}, Ende ${vJ.ende})`);
      const inhJ = bestaetigungInhalt({ agb_stand: "2026-09-10", gekuendigt_am: "2026-10-15T08:00:00Z", offene_raten: [{ rate_nr: 2, betrag_cents: 5999, faellig_am: "2026-10-10", zahlungsreferenz: "FIAON-P248MAJ-2" }] });
      ok(!!inhJ && /zwölf Monatsraten/.test(inhJ.vertrag_satz) && !/Abrechnungsmonat/.test(`${inhJ.vertrag_satz} ${inhJ.offen_satz}`), "… Bestätigungsmail Jahresvertrag ohne Abrechnungsmonat");
      // Nachbesserung Recht (M2): beim Jahresvertrag bleibt der Zahltag das Vertragsende (Justins Kulanz) — unverändert.
      {
        const { vertragEndePruefen } = await import("../server/lib/fiaon-kuendigung");
        await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE ref = 'FIAON-P248MAJ' AND rate_nr = 2`;
        const zJ = await vertragEndePruefen("FIAON-P248MAJ", 2);
        const heuteJ = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const vJ2 = await vertragsendeLesen("FIAON-P248MAJ");
        ok(zJ.beendet && vJ2.jahresvertrag && vJ2.ende === heuteJ && vJ2.quelle === "vertrag_ende_am", `M2: Jahresvertrag — letzte Rate bezahlt → Vertragsende ist der Zahltag (${vJ2.ende}, ${vJ2.quelle})`);
      }
      // Ohne Ratenkette: der Anker (erste Zahlung 05.07.) in Monatsschritten → Abrechnungsmonat 05.09.–04.10.
      const AK = await person("AK");
      await antrag("FIAON-P248MAK", AK.id, AK.mail, { status: "paid", agb: null });
      await sql`UPDATE fiaon_applications SET paid_at = '2026-07-05T10:00:00Z' WHERE ref = 'FIAON-P248MAK'`;
      const eK = await kuendigungSetzen("FIAON-P248MAK", { quelle: "mail", am: "2026-09-20T10:00:00+02:00" });
      const vK = await vertragsendeLesen("FIAON-P248MAK");
      ok(eK.ok && eK.weg === "sofort_beendet" && bTag(eK.vertragEndeAm) === "2026-10-04" && vK.ende === "2026-10-04", `ohne Ratenkette: Anker 05.07. → Ende 04.10. (${eK.weg}, ${bTag(eK.vertragEndeAm)})`);
    }

    // ── E-265 Schluss-Nachbesserung (01.10.2026, Echt-Probe 3 M3 #5779): ALTBESTAND — vor der Nachbesserung 2 gekündigt,
    // letzte_rate_nr = 3, Rate 3 ist erst NACH dem Vertragsende fällig und steht noch offen. Die Akte rechnet die letzte zu
    // zahlende Rate neu (keine), zahlungslink_bauen verweigert Rate 3, und „Rate 3 ist die letzte Rate. Sobald der Eingang
    // gebucht ist, wird das Kündigungsschreiben … verschickt" geht nie raus.
    const M3 = await person("M3");
    await antrag("FIAON-P248M3", M3.id, M3.mail, { status: "paid", agb: null });
    const heuteB = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const ersterM = new Date(`${heuteB.slice(0, 8)}01T10:00:00Z`);
    const gekM3 = new Date(ersterM.getTime() - 24 * 86_400_000); // im Vormonat → Vertragsende = Ende des Vormonats
    const nachM3 = `${heuteB.slice(0, 8)}06`;                     // fällig am 6. dieses Monats → nach dem Vertragsende
    await rate("FIAON-P248M3", 1, "bezahlt", "2026-08-06");
    await rate("FIAON-P248M3", 2, "bezahlt", "2026-09-06");
    await rate("FIAON-P248M3", 3, "offen", nachM3);
    await sql`UPDATE fiaon_applications SET gekuendigt_am = ${gekM3}, letzte_rate_nr = 3, kuendigung_quelle = 'mail', payment_status = 'paid' WHERE ref = 'FIAON-P248M3'`;
    const akteM3 = await (await import("../server/lib/fiaon-postmeister-dossier")).akteLesen(M3.id, "FIAON-P248M3");
    ok(akteM3.kuendigung?.letzteRate === null && (akteM3.kuendigung?.zuZahlen ?? []).length === 0 && (akteM3.kuendigung?.nachVertragsende ?? []).map((r) => r.nr).join(",") === "3" && /gilt zum/.test(String(akteM3.kuendigung?.regel ?? "")),
      `M3: Akte — keine „letzte Rate“, Rate 3 steht unter nachVertragsende (letzteRate ${akteM3.kuendigung?.letzteRate}, giltZum ${akteM3.kuendigung?.giltZum})`);
    ok(akteM3.raten.find((r) => r.nr === 3)?.nachVertragsende === true, "M3: die Rate selbst trägt die Marke nachVertragsende");
    const zlM3 = await wz.zahlungslinkBauen.ausfuehren({ referenz: "FIAON-P248M3-3" }, { personId: M3.id, ref: "FIAON-P248M3", postfach: PF, postmeisterId: null, kundenlage: "gekuendigt" as any });
    ok(!zlM3.ok && /NACH dem Vertragsende/.test(String(zlM3.fehler)), `M3: zahlungslink_bauen verweigert Rate 3 („${String(zlM3.fehler ?? "").slice(0, 90)}“)`);
    const P3_M3 = "Danke, die Überweisungsquittung über 59,99 € ist bei der Zahlungsstelle zur Prüfung. Ihre Kündigung vom 6. September liegt vor, und Rate 3 ist die letzte Rate. Sobald der Eingang gebucht ist, wird das Kündigungsschreiben der FIAON LTD automatisch verschickt.";
    const sM3 = await lauf1(M3.mail, "Anbei die Quittung über 59,99 €. Wann kommt mein Kündigungsschreiben?", {
      einordnung: { kategorien: ["zahlung", "kuendigung"], dringend: false, sprache: "de", fragen: ["Wann kommt das Kündigungsschreiben?"], zusammenfassung: "Schickt eine Quittung, fragt nach dem Kündigungsschreiben.", flags: { zahlung_behauptet: true } },
      werkzeuge: [],
      antwort: { antwort: P3_M3, naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: P3_M3, naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const fM3 = (sM3.pruefung?.fehlend ?? []).join(" · ");
    ok(sM3.gesendet === 0 && /kuendigung_an_zahlung|Kündigung und ihre Bestätigung hängen nie/.test(fM3) && /Rate 3 .*nach dem Vertragsende/.test(fM3), `M3: die Probe-3-Antwort geht nicht raus — Kündigung an Zahlung gebunden, Rate 3 nach dem Vertragsende (${fM3.slice(0, 200)})`);
    ok(!(sM3.handlungen ?? []).some((h: any) => h.werkzeug === "zahlungslink_bauen" && h.ok), "M3: keine Zahlungsseite vorab geholt (die Rate nach dem Vertragsende zählt nicht)");
    const sysM3 = String(sM3.kiAntwort[0]?.system ?? "") + JSON.stringify(sM3.kiAntwort[0] ?? {});
    ok(/HÄNGEN NIE AN EINER ZAHLUNG/.test(sysM3), "M3: der Auftrag sagt: Kündigung und Bestätigung hängen nie an einer Zahlung");

    // ── E-265 Schluss-Nachbesserung (Probe 3 f11): „Vertrag kam per E-Mail" ohne Beleg geht im Postfach nicht raus ──
    const VM = await person("VM");
    await antrag("FIAON-P248MVM", VM.id, VM.mail, { status: "paid", agb: "2026-09-10" });
    await rate("FIAON-P248MVM", 1, "bezahlt", "2026-09-10");
    const sVM = await lauf1(VM.mail, "Wo ist eigentlich mein Vertrag?", {
      einordnung: { kategorien: ["frage"], dringend: false, sprache: "de", fragen: ["Wo ist der Vertrag?"], zusammenfassung: "Fragt nach dem Vertrag.", flags: {} },
      werkzeuge: [],
      antwort: { antwort: "Ihr Vertrag vom 10. September kam damals per E-Mail zu Ihnen. Ihre Visa-Kreditkarte bleibt das Ziel.", naechster_schritt: { art: "bereich", url: null, text: "Zu meinem Bereich" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: "Ihr Vertrag vom 10. September kam damals per E-Mail zu Ihnen. Ihre Visa-Kreditkarte bleibt das Ziel.", naechster_schritt: { art: "bereich", url: null, text: "Zu meinem Bereich" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(sVM.gesendet === 0 && (sVM.pruefung?.fehlend ?? []).some((f: string) => /Vertrag sei per E-Mail gekommen/.test(f)), `f11 im Postfach: „Vertrag kam per E-Mail“ ohne Beleg → Entwurf (${(sVM.pruefung?.fehlend ?? []).join(" · ").slice(0, 120)})`);

    // ── E-265 Nachbesserung (Regression r3.mts): Zahlung gemeldet → Termin/Bereich statt Zahlknopf, sauber ist sauber ──
    const ZG = await person("ZG");
    await antrag("FIAON-P248M5Z", ZG.id, ZG.mail, { status: "claimed_paid", agb: "2026-09-20" });
    // Ohne Beleg-Lampe (zahlung_behauptet ist eine Warnlampe und bleibt immer Entwurf — ein Mensch prüft den Beleg).
    const sZG = await lauf1(ZG.mail, "Ich habe gestern überwiesen. Wie geht es jetzt weiter?", {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: ["Wie geht es weiter?"], zusammenfassung: "Hat überwiesen, fragt nach dem Ablauf.", flags: {} },
      werkzeuge: [],
      antwort: { antwort: "Danke Ihnen! Sobald Ihre Zahlung bei uns gebucht ist, schaltet das System Sie frei, und Sie bekommen direkt den Link unserer Partnerbank für Konto und Karte. Ziel bleibt Ihre eigene Visa-Kreditkarte.\n\nIch freue mich, wenn es für Sie jetzt losgeht.", naechster_schritt: { art: "bereich", url: null, text: "Zu meinem Bereich" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(sZG.schritt?.art === "bereich" && !(sZG.pruefung?.fehlend ?? []).some((f: string) => /Zahlungsseite|nicht erlaubt/.test(f)), `zahlung_gemeldet: Knopf „bereich“ ist erlaubt, keine Pflicht zur Zahlungsseite (${(sZG.pruefung?.fehlend ?? []).join(" · ").slice(0, 120) || "sauber"})`);
    ok(sZG.z?.aktion === "auto_beantwortet" && sZG.gesendet === 1, `… und sauber heißt: Mara sendet selbst (${sZG.z?.aktion}, ${String(sZG.z?.begruendung ?? "").slice(0, 80)})`);

    // ── 2. MEHRFACHVERSAND ─────────────────────────────────────────────────
    abschnitt("DB 2 · Eine Mail — eine Antwort (Person A, B)");
    const C = await person("C");
    await antrag("FIAON-P248MC", C.id, C.mail, { status: "pending_payment" });
    const textAb = "Sehr geehrte Frau Lindner, bitte unten lesen. Ich warte seit Tagen auf eine Antwort zu meiner Rechnung und möchte wissen, wie es weitergeht.";
    const szC: Szenario = {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: ["Wie geht es weiter?"], zusammenfassung: "Fragt nach dem Stand.", flags: {} },
      antwort: {
        antwort: "Gern: Offen ist Ihre erste Rechnung über 59,99 € mit dem Verwendungszweck FIAON-P248MC. Mit einem Klick auf den Knopf unten ist sie in zwei Minuten erledigt.\n\nDanach ist Ihr Account aktiv, und es geht direkt weiter. Ich freue mich auf Ihre Rückmeldung.",
        naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    };
    const d1 = await lauf1(C.mail, textAb, szC, { vorMin: 6 });
    const d2 = await lauf1(C.mail, textAb, szC, { vorMin: 5 });
    const d3 = await lauf1(C.mail, "", szC, { vorMin: 4 });
    ok(d1.z?.aktion === "auto_beantwortet" && d1.gesendet === 1, `Erste Mail: beantwortet (${d1.z?.aktion})`);
    ok(d2.z?.aktion === "geordnet" && new RegExp(`^Doppel von Mail #${d1.id}`).test(String(d2.z?.begruendung)) && d2.gesendet === 0 && d2.entwuerfe === 0, `Gleicher Text: Doppel von #${d1.id}, keine zweite Antwort, kein Entwurf`);
    ok(d2.kiAntwort.length === 0, "… und keine Antwort-KI (keine Kosten)");
    ok(d3.z?.aktion === "geordnet" && /Nachtrag/.test(String(d3.z?.begruendung)) && d3.gesendet === 0, "Leere Mail (nur Anhang) kurz danach: Nachtrag, keine dritte Antwort");
    ok(d1.schritt?.art === "zahlung" && /\/zahlung\/FIAON-P248MC$/.test(String(d1.schritt?.url)), "Knopf: SEINE Zahlungsseite");
    // Die Sendesperre: ein liegender Doppel-Entwurf (aus der Zeit vor E-248) wird nicht mehr gesendet.
    const [alt] = (await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, person_id, von, text, empfangen_am, antwort)
      VALUES (${PF}, 'e248m-altdoppel', 'e248m-talt', 'entwurf', ${C.id}, ${`Max Prüfer <${C.mail}>`}, ${textAb}, ${new Date(jetzt - 2 * 60_000)}, 'Antwort') RETURNING id`) as any[];
    const sp = await lauf.sendeSperre(Number(alt.id));
    ok(sp?.doppelVon === d1.id, `sendeSperre: liegender Doppel-Entwurf → „Doppel von #${sp?.doppelVon}“ (für Zentrale und Nachholen)`);
    const n = await lauf.doppelteEntwuerfeOrdnen({ immer: true });
    const [altN] = (await sql`SELECT aktion, begruendung FROM fiaon_postmeister WHERE id = ${Number(alt.id)}`) as any[];
    ok(n >= 1 && altN?.aktion === "geordnet" && /^Doppel von Mail #/.test(String(altN?.begruendung)), "doppelteEntwuerfeOrdnen: liegende Doppel-Entwürfe werden eingeordnet (nichts gelöscht)");
    const [d1neu] = (await sql`SELECT aktion FROM fiaon_postmeister WHERE id = ${d1.id}`) as any[];
    ok(d1neu?.aktion === "auto_beantwortet", "… das Original bleibt, wie es ist");

    // ── 3. RUHE ────────────────────────────────────────────────────────────
    abschnitt("DB 3 · Stopp und Widerruf: kein Zahlknopf, keine Rechnung");
    const D = await person("D");
    await antrag("FIAON-P248MD", D.id, D.mail, { status: "pending_payment" });
    const s3 = await lauf1(D.mail, "Stopp. Bitte keine Werbung mehr.", {
      einordnung: { kategorien: ["abmeldung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Will keine Werbung mehr.", flags: { stopp: true } },
      werkzeuge: [{ name: "werbesperre_setzen", args: { zitat: "Stopp. Bitte keine Werbung mehr." } }, { name: "zahlungslink_bauen", args: { referenz: "FIAON-P248MD" } }],
      antwort: {
        antwort: "Gern, das ist erledigt: Sie bekommen von uns ab sofort keine Werbung mehr. Wenn Sie es sich anders überlegen, antworten Sie einfach auf diese Mail.",
        naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    });
    const [pD] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${D.id}`) as any[];
    ok(!!pD?.werbung_gesperrt_am, "Werbesperre gesetzt");
    ok(s3.schritt?.art !== "zahlung" && !s3.schritt?.url, `#5479: kein Zahlknopf auf „Stopp“ (${JSON.stringify(s3.schritt)})`);
    ok(!(s3.handlungen ?? []).some((h: any) => h.werkzeug === "zahlungslink_bauen" && h.ok), "Zahlungsseite in der Ruhe abgelehnt");
    ok(!String(s3.z?.anhaenge ?? "").includes("rechnung"), "Keine Rechnung angehängt");
    ok(!/KEINE ZAHLUNGSAUFFORDERUNG/.test("") && /KEINE ZAHLUNGSAUFFORDERUNG \(Stopp-Wunsch\)/.test(s3.kiAntwort[0]?.system ?? ""), "Auftrag sagt: diese Mail ist keine Zahlungsaufforderung");
    ok(!/VORAB GEHOLT \(zahlungslink_bauen/.test(s3.kiAntwort[0]?.system ?? ""), "Die Zahlungsseite wird in der Ruhe NICHT vorab geholt");
    ok(s3.z?.aktion === "auto_beantwortet" && /Mara erledigt selbst/.test(String(s3.z?.begruendung)), `Reines „Stopp“ erledigt Mara selbst (${s3.z?.begruendung})`);

    const E = await person("E");
    await antrag("FIAON-P248ME", E.id, E.mail, { status: "paid", agb: "2026-09-20" });
    await rate("FIAON-P248ME", 1, "bezahlt", "2026-09-20");
    await rate("FIAON-P248ME", 2, "offen", "2026-10-20");
    const s4 = await lauf1(E.mail, "Ich habe fristgerecht widerrufen und warte auf Ihre Prüfung.", {
      einordnung: { kategorien: ["rechtlich"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Hat widerrufen.", flags: { widerruf: true } },
      werkzeuge: [{ name: "zahlungslink_bauen", args: { referenz: "FIAON-P248ME-2" } }],
      antwort: {
        antwort: "Bitte begleichen Sie trotzdem die offene Rate 2 über 59,99 €, falls der Nachweis nicht reicht.",
        naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [],
      },
      umformuliert: {
        antwort: "Danke, Ihr Schreiben ist bei uns. Über Ihren Widerruf entscheidet unsere Geschäftsführung, und bis dahin müssen Sie nichts unternehmen.",
        naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    });
    ok(s4.z?.aktion === "entwurf" && s4.gesendet === 0, "#5633: Widerruf → Entwurf für einen Menschen, nichts automatisch");
    ok(s4.schritt?.art !== "zahlung", "Kein Zahlknopf in der Widerrufs-Antwort");
    ok(s4.pruefung?.umformuliert === true && !/begleichen/.test(String(s4.z?.antwort)), "Die Zahlungsaufforderung wurde umformuliert — der Entwurf fordert kein Geld");
    const s4b = await lauf1(E.mail, "Wann bekomme ich eigentlich meine Karte?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Wann kommt die Karte?"], zusammenfassung: "Fragt nach der Karte.", flags: {} },
      antwort: {
        antwort: "Ihre Karte ist Ihr Ziel, und wir bereiten alles dafür vor. Zu Ihrem Widerruf hören Sie von unserer Geschäftsführung.",
        naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    });
    ok(/KEINE ZAHLUNGSAUFFORDERUNG \(Widerruf aus seiner Mail vom/.test(s4b.kiAntwort[0]?.system ?? ""), "Folgemail ohne das Wort „Widerruf“: der offene Widerruf aus der Vorgeschichte hält die Zahlung an");
    ok(s4b.z?.aktion === "entwurf" && /Widerruf oder Einwand aus einer früheren Mail offen/.test(String(s4b.z?.begruendung)), `… und ein Mensch entscheidet („${String(s4b.z?.begruendung).slice(0, 60)}“)`);

    // ── 4. ZUSAGEN ─────────────────────────────────────────────────────────
    abschnitt("DB 4 · Keine Rückzahlungszusage");
    const F = await person("F");
    await antrag("FIAON-P248MF", F.id, F.mail, { status: "paid", agb: "2026-09-20" });
    await rate("FIAON-P248MF", 1, "bezahlt", "2026-09-20");
    const rz = "Sollte die DKB Sie ablehnen, bekommen Sie Ihr Geld zurück.";
    const s5 = await lauf1(F.mail, "Was passiert, wenn die Bank mich ablehnt?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Was, wenn die Bank ablehnt?"], zusammenfassung: "Fragt nach Ablehnung.", flags: {} },
      antwort: { antwort: rz, naechster_schritt: { art: "bereich", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: rz, naechster_schritt: { art: "bereich", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s5.z?.aktion === "entwurf" && s5.gesendet === 0 && (s5.pruefung?.fehlend ?? []).some((f: string) => /Rückzahlung/.test(f)), "#5635: Rückzahlungszusage geht nie automatisch raus");

    // ── 5. SPRACHE ─────────────────────────────────────────────────────────
    abschnitt("DB 5 · Eine Sprache je Mail (#5591)");
    const G = await person("G");
    await antrag("FIAON-P248MG", G.id, G.mail, { status: "pending_payment" });
    const s6 = await lauf1(G.mail, "Hola, ¿cuándo tengo que pagar la factura? Gracias", {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "und", fragen: ["Wann zahlen?"], zusammenfassung: "Fragt nach der Rechnung.", flags: {} },
      antwort: { antwort: spanisch.replace("FIAON-AB12CD", "FIAON-P248MG"), naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: {
        antwort: "Gern: Offen ist Ihre erste Rechnung über 59,99 € mit dem Verwendungszweck FIAON-P248MG. Mit einem Klick auf den Knopf unten ist sie in zwei Minuten erledigt.\n\nDanach ist Ihr Account aktiv, und es geht direkt weiter.",
        naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    });
    ok(s6.z?.sprache === "de" && /^Guten Tag/.test(String(s6.z?.antwort)) && !/la factura/.test(String(s6.z?.antwort)), "Einordnung „und“: ganze Mail Deutsch — Anrede, Text und Knopf (vorher Rahmen deutsch, Text spanisch)");
    const H = await person("H");
    await antrag("FIAON-P248MH", H.id, H.mail, { status: "pending_payment" });
    const s6b = await lauf1(H.mail, "Hola, ¿cuándo tengo que pagar la factura? Gracias", {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "es", fragen: ["Wann zahlen?"], zusammenfassung: "Fragt nach der Rechnung.", flags: {} },
      antwort: { antwort: spanisch.replace("FIAON-AB12CD", "FIAON-P248MH"), naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s6b.z?.sprache === "es" && /^(Buenos días|Estimad)/.test(String(s6b.z?.antwort)) && /Ver y pagar la factura/.test(String(s6b.z?.antwort)) && !/Guten Tag|Freundliche Grüße/.test(String(s6b.z?.antwort)), "Spanisch: Anrede, Knopf und Gruß spanisch — eine Sprache");

    // ── 6. LINKS ───────────────────────────────────────────────────────────
    abschnitt("DB 6 · Nur persönliche Links");
    const I = await person("I");
    await sql`INSERT INTO fiaon_leads (person_id, vorname, email, quelle, link_code) VALUES (${I.id}, 'Max', ${I.mail}, 'pruef', 'PRF248ICOD')`;
    const s7 = await lauf1(I.mail, "Wie kann ich bei Ihnen eine Kreditkarte beantragen?", {
      einordnung: { kategorien: ["neuinteresse"], dringend: false, sprache: "de", fragen: ["Wie beantragen?"], zusammenfassung: "Will beantragen.", flags: {} },
      antwort: {
        antwort: "Sehr gern! Mit Ihrem Antrag bei uns sind Sie einen großen Schritt weiter. Er dauert nur zwei Minuten, und Ihre Angaben sind schon vorbereitet.",
        naechster_schritt: { art: "antrag", url: "https://fiaon.com/antrag", text: "Antrag starten" }, belege: [], fragen_beantwortet: [], merken: [],
      },
    });
    ok(/\/a\/PRF248ICOD\/m$/.test(String(s7.schritt?.url)), `Knopf „Antrag“ = sein persönlicher Link (${s7.schritt?.url})`);
    ok(!/fiaon\.com\/antrag(\s|$)/.test(String(s7.z?.antwort)) && /\/a\/PRF248ICOD\/m/.test(String(s7.z?.antwort)), "In der Mail steht nie der nackte /antrag, sondern /a/<code>/m");
    const s7c = await lauf1(I.mail, "Und wo genau geht das los? Bitte den Link.", {
      einordnung: { kategorien: ["neuinteresse"], dringend: false, sprache: "de", fragen: ["Wo geht es los?"], zusammenfassung: "Will den Link.", flags: {} },
      antwort: { antwort: "Hier geht es los: https://fiaon.com/antrag", naechster_schritt: { art: "antrag", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: "Hier geht es los: https://fiaon.com/antrag", naechster_schritt: { art: "antrag", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s7c.z?.aktion === "entwurf" && (s7c.pruefung?.fehlend ?? []).some((f: string) => /^Link: .*fiaon\.com\/antrag/.test(f)), "Nackter /antrag im Text → nie automatisch");
    const lk0 = await agent.antragLinkFuer(null, null);
    ok(lk0?.persoenlich === false && /\/privatkunden$/.test(String(lk0?.url)), "Niemand bekannt → Paketseite, nie /antrag");
    const J = await person("J");
    await antrag("FIAON-P248MJ", J.id, J.mail, { status: "draft", typ: "started" });
    await sql`UPDATE fiaon_applications SET status = 'started', payment_status = 'pending', current_step = 2 WHERE ref = 'FIAON-P248MJ'`.catch(() => {});
    const lkJ = await agent.antragLinkFuer(J.id, "FIAON-P248MJ");
    ok(/\/antrag\?weiter=/.test(String(lkJ?.url)), `Begonnener Antrag → Wiedereinstieg (weiterLink): ${String(lkJ?.url).slice(0, 60)}…`);

    // ── 7. WERKZEUGE ───────────────────────────────────────────────────────
    abschnitt("DB 7 · Werkzeuge: kein Betrag, kein zweiter Termin");
    const K = await person("K");
    await antrag("FIAON-P248MK", K.id, K.mail, { status: "pending_payment", betrag: null });
    const kx = (ref: string, pid: number, extra: Record<string, unknown> = {}) => ({ personId: pid, ref, postfach: PF, postmeisterId: null, kundenlage: "unbezahlt" as any, ...extra });
    const zl = await wz.zahlungslinkBauen.ausfuehren({ referenz: "FIAON-P248MK" }, kx("FIAON-P248MK", K.id));
    ok(!zl.ok && /kein Betrag/.test(String(zl.fehler)), "#5500: Zahlungsseite ohne Betrag → abgelehnt (vorher „über null €“)");
    const rz2 = await wz.rechnungAnhaengen.ausfuehren({ referenz: "FIAON-P248MK" }, kx("FIAON-P248MK", K.id));
    ok(!rz2.ok, "Rechnung ohne Betrag → abgelehnt");
    const zlR = await wz.zahlungslinkBauen.ausfuehren({ referenz: "FIAON-P248MC" }, kx("FIAON-P248MC", C.id, { ruhe: "Stopp-Wunsch" }));
    ok(!zlR.ok && /keine Zahlungsaufforderung/.test(String(zlR.fehler)), "Ruhe → Zahlungsseite abgelehnt");
    const reR = await wz.rechnungAnhaengen.ausfuehren({ referenz: "FIAON-P248MC" }, kx("FIAON-P248MC", C.id, { ruhe: "Beschwerde", kundeText: "Schicken Sie mir endlich die Rechnung!" }));
    ok(reR.ok, "Ruhe, aber er verlangt die Rechnung ausdrücklich → sie geht mit");
    const [ag] = (await sql`SELECT id FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];
    const morgen20 = new Date(Date.now() + 26 * 3_600_000);
    await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${K.id}, ${Number(ag.id)}, ${morgen20}, 'gebucht', 'agent_manuell')`;
    const tl = await wz.terminlinkBauen.ausfuehren({}, kx("FIAON-P248MK", K.id));
    ok(!tl.ok && /schon einen Termin/.test(String(tl.fehler)) && !/\d{4}-\d{2}-\d{2}/.test(String(tl.fehler)), `Termin steht → kein zweiter Link, Zeit menschlich („${String(tl.fehler).slice(0, 70)}…“)`);
    const au = await wz.aufgabeAnBetreuer.ausfuehren({ titel: "Rückruf gewünscht", text: "Kunde möchte zurückgerufen werden.", faellig_in_tagen: 0, dringend: false, kollege: "", rueckruf_am: "2026-12-01 10:00" }, kx("FIAON-P248MK", K.id));
    const [tn] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${K.id}`) as any[];
    ok(au.ok && Number(tn.n) === 1 && /Es steht schon ein Termin/.test(au.ergebnis), "Rückrufwunsch bei bestehendem Termin → kein zweiter Termin");
    const vergangen = await wz.aufgabeAnBetreuer.ausfuehren({ titel: "Rückruf gewünscht", text: "Kunde möchte zurückgerufen werden.", faellig_in_tagen: 0, dringend: false, kollege: "", rueckruf_am: "2020-01-01 10:00" }, kx("FIAON-P248MC", C.id));
    ok(vergangen.ok && /kein Termin eingetragen/.test(vergangen.ergebnis), "Rückruf-Zeit in der Vergangenheit → kein Termin");
    ok(wz.berlinZeitLesen("2026-07-01 20:00")?.toISOString() === "2026-07-01T18:00:00.000Z" && wz.berlinZeitLesen("2026-12-01 20:00")?.toISOString() === "2026-12-01T19:00:00.000Z", "Berliner Zeit richtig gelesen (Sommer- und Winterzeit)");

    // ── 8. MARA-AKTION ─────────────────────────────────────────────────────
    abschnitt("DB 8 · Mara-Aktion: Einwand und Werbesperre an der Adresse");
    const L = await person("L");
    await antrag("FIAON-P248ML", L.id, L.mail, { status: "pending_payment" });
    await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, person_id, flags, created_at)
              VALUES (${PF}, 'e248m-einwand', 'e248m-te', 'entwurf', ${L.id}, ${JSON.stringify({ widerruf: true })}::jsonb, NOW() - INTERVAL '20 days')`;
    const M = await person("M");
    await antrag("FIAON-P248MM", M.id, M.mail, { status: "pending_payment" });
    const Mzwei = await person("M2", { email: "pruef248m-andere@kunde.invalid" });
    await sql`UPDATE fiaon_persons SET werbung_gesperrt_am = NOW() WHERE id = ${Mzwei.id}`;
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, payment_reference, payment_status, email) VALUES ('FIAON-P248MX', ${Mzwei.id}, 'private', 'submitted', 'pro', 'FIAON-P248MX', 'cancelled', ${M.mail})`;
    const N = await person("N");
    await antrag("FIAON-P248MN", N.id, N.mail, { status: "pending_payment" });
    const kands = await aktion.kandidatenLaden(500, ["B"]);
    const ids = new Set(kands.map((k: any) => k.personId));
    ok(!ids.has(L.id), "Widerruf (auch vor 20 Tagen) → keine Werbemail zur Zahlung");
    ok(!ids.has(M.id), "Werbesperre an derselben Adresse (andere Person) → schon in der Schlange raus");
    ok(ids.has(N.id), "Gegenprobe: ein gewöhnlicher offener Antrag bleibt in der Schlange");

    // ── E-264: ABSTREITEN PER MAIL ──────────────────────────────────────────
    abschnitt("DB 10 · Abstreiten per Mail (E-264): fester Text, Werbe-Stopp, Leitung, keine Zahlung");
    const S = await person("S");
    await antrag("FIAON-P248MS", S.id, S.mail, { status: "pending_payment", typ: "approved" });
    // Nachbesserung E-264: die Herkunft ist der früheste Antrag AUS DEM WEBFORMULAR (Browser-Kennung gesetzt).
    await sql`UPDATE fiaon_applications SET current_step = 5, created_at = '2026-07-29T05:24:00Z', user_agent = 'Mozilla/5.0 (Prüfstand E-264)' WHERE ref = 'FIAON-P248MS'`;
    const lageS = await (await import("../server/lib/fiaon-postmeister-dossier")).kundenlageBerechnen(S.id, "FIAON-P248MS");
    ok(lageS.lage === "interessent" && /NIE abgeschickt/.test(lageS.grund), `approved/Schritt 5/pending_payment → „interessent“, nicht „unbezahlt“ (${lageS.lage}: ${lageS.grund.slice(0, 60)})`);
    const zlS = await wz.zahlungslinkBauen.ausfuehren({ referenz: "FIAON-P248MS" }, { personId: S.id, ref: "FIAON-P248MS", postfach: PF, postmeisterId: null, kundenlage: "unbezahlt" as any });
    ok(!zlS.ok && /nie abgeschickt/.test(String(zlS.fehler)), "zahlungslink_bauen auf einen nie abgeschickten Antrag → abgelehnt");
    // Nachbesserung E-264 (Gegenlesen): derselbe Riegel für rechnung_anhaengen — „Interessent" darf automatisch antworten.
    const raS = await wz.rechnungAnhaengen.ausfuehren({ referenz: "FIAON-P248MS" }, { personId: S.id, ref: "FIAON-P248MS", postfach: PF, postmeisterId: null, kundenlage: "interessent" as any, kundeText: "Bitte schicken Sie mir die Rechnung." });
    ok(!raS.ok && /nie abgeschickt/.test(String(raS.fehler)), "rechnung_anhaengen auf einen nie abgeschickten Antrag → abgelehnt (keine Rechnung mit IBAN und Betrag)");
    ok(wz.werkzeugeFuerLage("interessent").some((w: any) => w.name === "kuendigung_vormerken"), "Interessent mit angefangener Bestellung: kuendigung_vormerken steht bereit (Storno ohne Vertrag, „Ein kurzes Ja genügt“ läuft nicht ins Leere)");
    const sS = await lauf1(S.mail, "Ich habe nie etwas bei Ihnen beantragt! Woher haben Sie meine Adresse?", {
      einordnung: { kategorien: ["beschwerde"], dringend: false, sprache: "de", fragen: ["Woher die Adresse?"], zusammenfassung: "Bestreitet den Antrag.", flags: {} },
      werkzeuge: [{ name: "zahlungslink_bauen", args: { referenz: "FIAON-P248MS" } }],
      antwort: { antwort: "Sehr gern — nach der Zahlung ist Ihr Account aktiv. Offen ist Ihre erste Rechnung über 59,99 €.", naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const antwortS = String(sS.z?.antwort ?? "");
    ok(sS.kiAntwort.length === 0, `Keine Antwort-KI — der Text ist fest (${sS.kiAntwort.length} Aufrufe)`);
    ok(/Entschuldigen Sie bitte unsere Nachricht/.test(antwortS) && /Ihre E-Mail-Adresse wurde am 29\. Juli bei einem Antrag auf unserer Internetseite eingetragen/.test(antwortS), "Mail: Entschuldigung + ehrliche Herkunft mit dem Tag aus dem Antrag");
    ok(/Wir schreiben Ihnen ab jetzt nicht mehr/.test(antwortS) && /„Löschen“ genügt/.test(antwortS), "Mail: kein Schreiben mehr, Löschen auf Wunsch");
    ok(!/\/zahlung\/|Account aktiv|Rechnung/i.test(antwortS) && sS.schritt?.art === "erledigt" && !sS.schritt?.url, `Keine Zahlung, kein Knopf (${JSON.stringify(sS.schritt)})`);
    ok(sS.z?.aktion === "entwurf" && sS.gesendet === 0, `Bestreiten bleibt beim Menschen: Entwurf (${sS.z?.aktion}; ${String(sS.z?.begruendung).slice(0, 60)})`);
    // Nachbesserung E-264 (Gegenlesen): Werbesperre erst mit der Freigabe, kein Mahnstopp mehr.
    const [pS] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${S.id}`) as any[];
    const [aS] = (await sql`SELECT mahnstopp_am FROM fiaon_applications WHERE ref = 'FIAON-P248MS'`) as any[];
    ok(!pS?.werbung_gesperrt_am && !aS?.mahnstopp_am, "Beim ENTWURF noch keine Werbesperre und kein Mahnstopp (ein Mensch gibt frei)");
    ok((sS.handlungen ?? []).some((h: any) => h.werkzeug === "aufgabe_an_betreuer" && h.ok) && (sS.handlungen ?? []).some((h: any) => h.werkzeug === "werbesperre_bei_freigabe"), "Handlungen: aufgabe_an_betreuer (Leitung) + Merker „Werbesperre mit der Freigabe“");
    const abstr = await import("../server/lib/fiaon-mara-abstreiten");
    ok(await abstr.werbesperreBeiFreigabe({ id: sS.id, person_id: S.id, handlungen: sS.z?.handlungen }), "Freigabe: der Merker wird gefunden (jsonb, auch als Text)");
    const [pS2] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${S.id}`) as any[];
    ok(!!pS2?.werbung_gesperrt_am, "… und die Werbesperre steht jetzt");
    const [tS] = (await sql`SELECT titel FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND titel ILIKE '%bestreitet Antrag%' LIMIT 1`) as any[];
    ok(!!tS, `Aufgabe „Kunde bestreitet Antrag“ steht (${tS?.titel ?? "keine"})`);
    // Folge-Mail: ausdrücklicher Löschwunsch
    const sL = await lauf1(S.mail, "Bitte löschen Sie meine Daten.", {
      einordnung: { kategorien: ["sonstiges"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Will Löschung.", flags: {} },
      antwort: { antwort: "Gern!", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(/Ihre Bitte, Ihre Daten zu löschen, ist bei uns angekommen/.test(String(sL.z?.antwort)) && sL.kiAntwort.length === 0, `„Bitte löschen Sie meine Daten.“ → feste Löschbestätigung ohne Antwort-KI (${sL.z?.aktion})`);
    // EIN Auftrag je Kunde (Schlüssel postmeister:<person>:aufgabe) — der Löschwunsch hängt sich an die Aufgabe „bestreitet Antrag" an.
    const [tL] = (await sql`SELECT titel FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND (titel ILIKE '%Löschwunsch%' OR text ILIKE '%Löschung seiner Daten%') LIMIT 1`) as any[];
    ok(!!tL, `Löschwunsch steht in der Aufgabe an die Leitung (${tL?.titel ?? "keine"})`);
    // Ein offener, nie abgeschickter Antrag fragt „Wie kann ich bezahlen?" — der Zahlungssatz des Modells fällt durch.
    const U = await person("U");
    await antrag("FIAON-P248MU", U.id, U.mail, { status: "pending_payment", typ: "approved" });
    await sql`UPDATE fiaon_applications SET current_step = 5 WHERE ref = 'FIAON-P248MU'`;
    await sql`INSERT INTO fiaon_leads (person_id, vorname, email, quelle, link_code) VALUES (${U.id}, 'Max', ${U.mail}, 'pruef', 'PRF264UCOD')`;
    const zahlSatz = { antwort: "Gern: Offen ist Ihre erste Rechnung über 59,99 €. Nach der Zahlung ist Ihr Account aktiv.", naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] };
    const sU = await lauf1(U.mail, "Wie kann ich bezahlen?", {
      einordnung: { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: ["Wie bezahlen?"], zusammenfassung: "Will zahlen.", flags: {} },
      antwort: zahlSatz, umformuliert: zahlSatz,
    });
    ok(/ER HAT KEINE OFFENE RECHNUNG/.test(sU.kiAntwort[0]?.system ?? ""), "Auftrag: „ER HAT KEINE OFFENE RECHNUNG“ bei nie abgeschicktem Antrag");
    ok(sU.z?.aktion === "entwurf" && (sU.pruefung?.fehlend ?? []).some((f: string) => /nie abgeschickt/.test(f)), `Zahlungssatz ohne abgeschickten Antrag → harter Mangel, nie automatisch (${(sU.pruefung?.fehlend ?? []).slice(0, 2).join(" | ").slice(0, 120)})`);
    ok(sU.schritt?.art !== "zahlung" || !sU.schritt?.url, `Kein Zahlungsknopf mit Adresse (${JSON.stringify(sU.schritt)})`);
    // Reaktivierung: nie abgeschickt + abgelaufen → nie freischalten
    const V = await person("V");
    await antrag("FIAON-P248MV", V.id, V.mail, { status: "expired", typ: "approved" });
    await sql`UPDATE fiaon_applications SET current_step = 5 WHERE ref = 'FIAON-P248MV'`;
    ok(!(await wz.abgelaufeneBestellungFreischalten("FIAON-P248MV")), "Abgelaufene, nie abgeschickte Bestellung → nie reaktiviert");
    const [aV] = (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = 'FIAON-P248MV'`) as any[];
    ok(aV?.payment_status === "expired", `… bleibt abgelaufen (${aV?.payment_status})`);
    // Mara-Aktion: B heißt abgeschickt (W schrieb nie — sonst hielte ihn schon „schrieb" zurück)
    const W = await person("W");
    await antrag("FIAON-P248MW", W.id, W.mail, { status: "pending_payment", typ: "approved" });
    await sql`UPDATE fiaon_applications SET current_step = 5 WHERE ref = 'FIAON-P248MW'`;
    const W2 = await person("W2");
    await antrag("FIAON-P248MY", W2.id, W2.mail, { status: "pending_payment" });
    const kandsE264 = await aktion.kandidatenLaden(500, ["B"]);
    ok(!kandsE264.some((k: any) => k.personId === W.id), "Mara-Aktion: ein nie abgeschickter Antrag (approved/Schritt 5) ist keine Stufe B — keine Zahlungsmail");
    ok(kandsE264.some((k: any) => k.personId === W2.id), "Gegenprobe: ein abgeschickter Antrag mit offener Zahlung bleibt Stufe B");

    abschnitt("DB 9 · Nichts ging hinaus");
    ok(FREMD.length === 0, `Kein fremdes Netz (${FREMD.slice(0, 2).join(", ")})`);
  } finally {
    const refs = ["FIAON-P248MA", "FIAON-P248MB", "FIAON-P248MC", "FIAON-P248MD", "FIAON-P248ME", "FIAON-P248MF", "FIAON-P248MG", "FIAON-P248MH", "FIAON-P248MJ", "FIAON-P248MK", "FIAON-P248ML", "FIAON-P248MM", "FIAON-P248MN", "FIAON-P248MX", "FIAON-P248MP", "FIAON-P248MQ", "FIAON-P248MR",
      "FIAON-P248MS", "FIAON-P248MU", "FIAON-P248MV", "FIAON-P248MW", "FIAON-P248MY",
      // E-265 Nachbesserung: Rate nach Vertragsende (5N, 5F), Zahlung gemeldet (5Z)
      "FIAON-P248M5N", "FIAON-P248M5F", "FIAON-P248M5Z",
      // E-265 (01.10.2026, Recht): Abrechnungsmonat (DB 1b)
      "FIAON-P248MA1", "FIAON-P248MA2", "FIAON-P248MA3", "FIAON-P248MAJ", "FIAON-P248MAK",
      // E-265 Schluss-Nachbesserung: Altbestand M3, Vertragsmail (VM); M3A = Rest eines Zwischenlaufs
      "FIAON-P248M3", "FIAON-P248MVM", "FIAON-P248M3A"];
    const pids = Object.values(personen);
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE created_at >= ${START})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START}`.catch(() => {});
    await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'e248m-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs}) OR person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_kurzlinks WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_leads WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${pids})`.catch(() => {});
    for (const t of ["fiaon_kuendigung_urkunden", "fiaon_kuendigungen", "cancellation_requests"]) {
      await sql.unsafe(`DELETE FROM ${t} WHERE ref = ANY($1)`, [refs] as any).catch(() => {});
    }
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_ki_nutzung WHERE created_at >= ${START}`.catch(() => {});
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
    for (const z of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${z.key}, ${z.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
    const [rest] = (await sql`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE 'PRUEF248M-%')::int AS p, (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'FIAON-P248M%')::int AS a`) as any[];
    console.log(`\n  ℹ aufgeräumt — übrig: ${rest?.p ?? "?"} Personen, ${rest?.a ?? "?"} Bestellungen`);
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
