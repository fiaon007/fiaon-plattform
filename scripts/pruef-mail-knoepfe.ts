// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Hat jede Kundenmail ihren Knopf? (18.09.2026, Team-Feedback P3)
//
// „Bei ‚Willkommen und Zugang' erhalten Kunden stattdessen eine Nachricht mit
// ‚Ihr Antrag ist genehmigt, bitte zahlen Sie' … In manchen E-Mails steht
// ‚Klicken Sie unten, um zum Zugang zu gelangen', aber es gibt dort keinen
// anklickbaren Link oder Button."
//
// Die Ursache lag an zwei Stellen: Der Mail-Motor ließ einen Knopf, dessen
// Platzhalter leer blieb, STILL weg (er stand in keiner Fehlliste), und der
// Handversand füllte fast keinen Platzhalter. Dieser Prüfstand rendert jede
// Kundenmail so, wie sie rausginge, und verlangt, dass jeder Knopf ein Ziel hat.
//
// ── NICHTS WIRD VERSENDET ──────────────────────────────────────────────────
// MAKE_WEBHOOK_URL und BREVO_API_KEY werden geleert und CRONS abgeschaltet,
// BEVOR ein Servermodul geladen wird. Der Prüfstand ruft nur mailRendern,
// sendePayloadBauen (Vorschau: kein Anmelde-Schlüssel), versandLuecke und
// versandErlaubt — keine Sendefunktion.
//
// ── DREI TEILE ─────────────────────────────────────────────────────────────
//   1. Motor und Vorlagen — ohne Datenbank. Jede Vorlage mit dem Beispiel der
//      Registry (so zeigen sie Galerie und Prüfversand), dazu die Regeln des
//      Motors: Knopf ohne Ziel wird gemeldet, Abmeldezeile nur mit Ziel,
//      wahlweise Absätze, Titel im Text-Teil, Du-Fassung der Lead-Strecke.
//   2. Der Link-Baustein je Kunden-Ereignis — gegen die Datenbank, in EINER
//      Transaktion, die am Ende zurückgerollt wird (Muster: pruef-merge.ts).
//      Ein Prüfkunde mit bezahlter, offener und begonnener Bestellung und
//      einem verpassten Termin. Jedes Ereignis, das ein Menü oder das
//      Versandzentrum anbietet, muss VOLLSTÄNDIG sein (jeder Knopf mit Ziel)
//      oder mit Klartext abgelehnt werden — nie still ohne Knopf.
//   3. Die Aufrufstellen der Automatik — am Quelltext: Jede Stelle, die eine
//      Kundenmail mit Knopf OHNE den Link-Baustein verschickt, gibt dessen
//      Platzhalter selbst mit.
//
//   npx tsx scripts/pruef-mail-knoepfe.ts                   alle drei Teile
//   npx tsx scripts/pruef-mail-knoepfe.ts --ohne-datenbank  nur 1 und 3
//   npx tsx scripts/pruef-mail-knoepfe.ts --rot-probe       baut den alten
//        Fehler nach (Knopf ohne Ziel) und verlangt, dass Teil 1 rot wird
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

process.env.MAKE_WEBHOOK_URL = "";
process.env.BREVO_API_KEY = "";
process.env.CRONS = "aus";

import { readFileSync } from "node:fs";

const OHNE_DB = process.argv.includes("--ohne-datenbank");
const ROT_PROBE = process.argv.includes("--rot-probe");
// db-pool verlangt eine Adresse schon beim Laden. Ohne Datenbank genügt eine,
// zu der nie eine Verbindung aufgebaut wird (postgres verbindet erst bei der
// ersten Abfrage).
if (OHNE_DB || !process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://keine-datenbank.invalid/pruefstand";

let bestanden = 0;
let rot = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function titel(t: string): void { log(`\n══ ${t} ${"═".repeat(Math.max(0, 66 - t.length))}`); }
const lies = (p: string) => readFileSync(p, "utf8");

class Zurueckrollen extends Error {}

async function main(): Promise<void> {
  const motor = await import("../server/mail/motor");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const { KARTE_SATZ } = await import("../server/mail/geruest");
  const strecke = await import("../shared/fiaon-lead-strecke");
  const { mailEvents, imMenue } = await import("../server/lib/fiaon-mail-events");
  const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");

  const knopfPlatzhalter = (ev: string): string[] => {
    const v = motor.VORLAGEN[ev];
    if (!v) return [];
    return [v.knopf?.url, v.knopf2?.url]
      .map((u) => u?.match(/\{\{params\.([a-z_0-9]+)\}\}/i)?.[1])
      .filter((p): p is string => !!p && !motor.KNOPF_DARF_FEHLEN.has(p));
  };

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. MOTOR UND VORLAGEN (ohne Datenbank)");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Rot-Probe baut den alten Fehler nach: Der Motor meldete einen
  // weggelassenen Knopf nicht. Wir simulieren das, indem wir die Meldung
  // unterdrücken — dann MUSS die erste Gruppe rot werden.
  const rendern = (ev: string, p: Record<string, unknown>) => {
    const m = motor.mailRendern(ev, p);
    if (m && ROT_PROBE) return { ...m, knopfEntfallen: false, entfalleneKnoepfe: [], fehlend: [] };
    return m;
  };

  // 1a. Jede Vorlage mit ihrem Registry-Beispiel: So zeigen Galerie und
  //     Prüfversand die Mail. Fehlt dort ein Knopf, sieht das Team eine Mail
  //     ohne Knopf und hält sie für richtig.
  for (const e of MAKE_EVENT_REGISTRY) {
    if (e.deprecated || !motor.VORLAGEN[e.type]) continue;
    const m = rendern(e.type, e.example as Record<string, unknown>);
    ok(`Beispiel füllt jeden Knopf: ${e.type}`, !!m && !m.knopfEntfallen,
      m?.entfalleneKnoepfe.map((k) => `„${k.text}“ ohne ${k.platzhalter}`).join(", "));
  }

  // 1b. Die Regeln des Motors — jede mit dem Fall, an dem sie gebrochen war.
  const basis = {
    email: "pruefstand@pruefstand-knopf.invalid", vorname: "Prüf", nachname: "Knopf",
    antrag_id: "FIAON-PRUEFSTAND-1", payment_reference: "FIAON-PRUEF1", betrag: "59.99", paket: "FIAON Pro (Standard)",
  };
  const ohneZiel = rendern("zugang_link", { ...basis });
  ok("Ein Knopf ohne Ziel wird GEMELDET (nicht still weggelassen)",
    !!ohneZiel?.knopfEntfallen && ohneZiel.fehlend.includes("login_url"),
    `knopfEntfallen=${ohneZiel?.knopfEntfallen}, fehlend=${ohneZiel?.fehlend.join(",")}`);
  const mitZiel = rendern("zugang_link", { ...basis, login_url: "https://fiaon.com/login", passwort_url: "https://fiaon.com/passwort-vergessen" });
  ok("Die Zugangsmail hat Knopf UND Passwort-Link",
    !!mitZiel && /href="https:\/\/fiaon\.com\/login"/.test(mitZiel.html) && /href="https:\/\/fiaon\.com\/passwort-vergessen"/.test(mitZiel.html));
  ok("… und nennt die 60 Minuten des Passwort-Links", /60 Minuten/.test(mitZiel?.text ?? ""));

  // 19.09.2026 (E-194): GoCardless ist beendet — der Hauptknopf jeder Zahlungsmail ist die
  // Zahlungsseite (QR-Code & Bankdaten); einen Bank-App- oder Lastschrift-Knopf gibt es nicht mehr.
  const zahlung = rendern("payment_details", { ...basis });
  ok("Zahlungsmail: Hauptknopf ist die Zahlungsseite mit QR-Code & Bankdaten",
    !!zahlung && !zahlung.knopfEntfallen && /href="https:\/\/fiaon\.com\/zahlung\/FIAON-PRUEF1"[^>]*>[^<]*QR-Code/.test(zahlung.html), zahlung?.fehlend.join(","));
  {
    const quelle = ["server/mail/vorlagen/zahlung.ts", "server/mail/vorlagen/konto.ts", "server/mail/vorlagen/rueckholung.ts", "server/mail/motor.ts"].map(lies).join("\n");
    ok("Keine Vorlage trägt noch sofort_url oder sepa_link", !/params\.(sofort_url|sepa_link)/.test(quelle));
    ok("Die Lastschrift-Mail „sepa_einrichten“ gibt es nicht mehr", !motor.hatVorlage("sepa_einrichten"));
    ok("Keine Zahlungsmail bietet „Sofort per Bank-App“ an", !/Bank-App bezahlen/.test(zahlung?.html ?? "x"));
  }

  const ohneAbmelden = rendern("lead_followup", { email: basis.email, vorname: "Prüf", antrag_url: "https://fiaon.com/antrag" });
  ok("Ohne Abmeldelink keine Zeile „Hier abmelden“ mit leerem Ziel",
    !!ohneAbmelden && !/Hier abmelden/.test(ohneAbmelden.html) && ohneAbmelden.fehlend.includes("abmelde_url"));
  const mitAbmelden = rendern("lead_followup", { email: basis.email, vorname: "Prüf", antrag_url: "https://fiaon.com/antrag", abmelde_url: "https://fiaon.com/abmelden/x" });
  ok("… mit Abmeldelink steht sie da, mit Ziel", /href="https:\/\/fiaon\.com\/abmelden\/x"[^>]*>Hier abmelden/.test(mitAbmelden?.html ?? ""));
  ok("Werbe-Mails ohne Abmeldelink sind für die Tür gesperrt (ABMELDEPFLICHT)",
    ["lead_followup", "rueckhol_s5", "rueckhol_s5b", "rueckhol_s5c", "rueckhol_s5d"].every((ev) => motor.ABMELDEPFLICHT.has(ev)));

  // Bis 19.09.2026 prüfte das die Lastschrift-Mail (offene_rate_hinweis); die ist mit GoCardless weg (E-194).
  const wahlweise = rendern("app_monatsbericht", { ...basis, monat_text: "August 2026", grosse_zahl_text: "", betrag_text: "1,00 €", bericht_url: "https://fiaon.com/app/geld/bericht/2026-08" });
  ok("Ein wahlweiser Absatz ohne Wert entfällt (kein leerer Absatz)",
    !!wahlweise && !/<font color="#1f2937" style="color:#1f2937 !important;"><\/font>/.test(wahlweise.html) && !wahlweise.fehlend.includes("grosse_zahl_text"));

  const bericht = rendern("app_monatsbericht", { ...basis, monat_text: "August 2026", grosse_zahl_text: "x", betrag_text: "1,00 €", bericht_url: "https://fiaon.com/app/geld/bericht/2026-08" });
  ok("Der Titel im Text-Teil wird NACH dem Füllen großgeschrieben",
    /IHR BERICHT FÜR AUGUST 2026/.test(bericht?.text ?? "") && !bericht?.fehlend.some((f) => f !== f.toLowerCase()),
    (bericht?.text.split("\n")[2] ?? "").slice(0, 60));

  const willkommen = rendern("welcome", basis);
  ok("„Antrag eingegangen“ verspricht keine Zahlungsmail, die nie kommt",
    !!willkommen && !/gleich eine separate E-Mail|kommt in wenigen Minuten/.test(willkommen.text));

  ok("Kontowechsel kommt von „FIAON Accounting“", motor.absenderFuer("bankverbindung_neu").name === "FIAON Accounting");
  ok("Kündigung und Vertragsende kommen von „FIAON Legal“",
    motor.absenderFuer("kuendigung_bestaetigt").name === "FIAON Legal" && motor.absenderFuer("vertrag_beendet").name === "FIAON Legal");

  // 1c. Die Lead-Strecke: Knopf je Variante, durchgehend geduzt.
  for (const v of strecke.VARIANTEN) {
    const k = strecke.streckenKnopf(v);
    const url = k.termin ? "https://fiaon.com/termin" : "https://fiaon.com/antrag?lead=1";
    const text = `Hallo Prüf,\n\n${v.text}\n\n${k.zeile}: ${url}\n\nViele Grüße\ndein FIAON-Team\n\n─────\nDu möchtest keine Nachrichten mehr? Ein Klick genügt: https://fiaon.com/abmelden/x`;
    const m = rendern("lead_followup", {
      email: basis.email, vorname: "Prüf", betreff: v.betreff, text,
      abmelde_url: "https://fiaon.com/abmelden/x", antrag_url: "https://fiaon.com/antrag?lead=1",
      knopf_text: k.text, knopf_url: url,
    });
    const html = m?.html ?? "";
    const knopfZiel = html.match(/<a href="([^"]*)"[^>]*>([^<]*)&nbsp;&nbsp;&rarr;<\/a>/);
    ok(`Strecke „${v.key}“: Knopf passt zum Text (${k.text})`,
      !!knopfZiel && knopfZiel[1] === url && knopfZiel[2].trim() === k.text,
      knopfZiel ? `${knopfZiel[2].trim()} → ${knopfZiel[1]}` : "kein Knopf");
    ok(`Strecke „${v.key}“: geduzt bis in den Fuß, ohne Karten-Satz`,
      /Du möchtest diese Hinweise/.test(html) && /Antworte einfach/.test(html)
      && !/Sie möchten diese Hinweise|Antworten Sie/.test(html) && !html.includes(KARTE_SATZ));
    ok(`Strecke „${v.key}“: Worthygiene`, strecke.worthygiene(`${v.betreff} ${v.text}`).length === 0,
      strecke.worthygiene(`${v.betreff} ${v.text}`).join(","));
  }
  ok("Keine Variante verspricht einen Zugang oder eine Rückkehr an eine Stelle, die es nicht gibt",
    strecke.VARIANTEN.every((v) => !/Zugang wartet|dorthin zurück, wo du aufgehört/.test(v.text)));

  // 1d. Registry und Menü-Regeln. mailEvents liest aus fiaon_mail_events nur
  //     den Prüfstand der Zweige — für Rollen und Menü genügt eine leere Antwort.
  const leererLauf = (() => Promise.resolve([])) as any;
  const events = await mailEvents(leererLauf);
  const ev = (t: string) => events.find((e) => e.type === t) as any;
  ok("„welcome“ ist nur noch Verwaltungssache", JSON.stringify(ev("welcome")?.rollen) === JSON.stringify(["admin"]), JSON.stringify(ev("welcome")?.rollen));
  ok("„zugang_link“ steht für jede Rolle im Menü",
    ["admin", "vertriebsleiter", "agent", "onboarding", "inkasso"].every((r) => ev("zugang_link")?.rollen?.includes(r)));
  ok("Zugang und Freischaltung sind Pflichtmails (keine Frequenzbremse)",
    PFLICHTMAILS.has("zugang_link") && PFLICHTMAILS.has("bereich_freigeschaltet"));
  ok("Terminbestätigung, Sperr- und Löschmail stehen in keinem Menü",
    ["termin_bestaetigung", "termin_erinnerung", "termin_absage", "gdpr_deleted", "account_suspended", "payment_cancelled", "payment_reactivated", "schufa_rejected", "app_monatsbericht", "global_auftrag", "global_start", "global_stichtag", "bewerbung_zusage", "bewerbung_absage"]
      .every((t) => ev(t) && !imMenue(ev(t), "admin").ja));
  ok("Konto & Karte im allgemeinen Menü nur für die Verwaltung",
    !!ev("konto_karte_einladung") && imMenue(ev("konto_karte_einladung"), "admin").ja && !imMenue(ev("konto_karte_einladung"), "agent").ja);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. LINK-BAUSTEIN JE KUNDEN-EREIGNIS (Transaktion, zurückgerollt)");
  // ═════════════════════════════════════════════════════════════════════════
  if (OHNE_DB || ROT_PROBE) {
    log(`  ÜBERSPRUNGEN — ${ROT_PROBE ? "Rot-Probe (prüft nur die Wand des Motors)" : "mit --ohne-datenbank aufgerufen"}. Dieser Teil hat NICHTS geprüft.`);
  } else {
    await teilZwei(knopfPlatzhalter);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. AUFRUFSTELLEN DER AUTOMATIK (Quelltext)");
  // ═════════════════════════════════════════════════════════════════════════
  // Stellen, die eine Kundenmail mit Knopf OHNE den Link-Baustein verschicken.
  // Je Stelle: das Ereignis-Literal und die Schlüssel, die im Aufruf stehen
  // müssen (Fenster: 12 Zeilen davor bis 40 danach — die Nutzlast wird mal
  // vorher gebaut, mal im Aufruf). `makePayloadFromRow` bringt
  // payment_reference mit.
  const STELLEN: { datei: string; event: string; schluessel: string[] }[] = [
    { datei: "server/routes/fiaon-antrag.ts", event: "payment_confirmed", schluessel: ["login_url"] },
    { datei: "server/routes/fiaon-onboarding-bereich.ts", event: "bereich_freigeschaltet", schluessel: ["login_url"] },
    { datei: "server/routes/fiaon-onboarding-bereich.ts", event: "termin_verpasst", schluessel: ["termin_link", "termin_datum", "termin_uhrzeit"] },
    { datei: "server/routes/fiaon-onboarding-bereich.ts", event: "onboarding_einladung", schluessel: ["termin_link"] },
    { datei: "server/routes/fiaon-agent-kunden.ts", event: "account_activated", schluessel: ["login_url"] },
    { datei: "server/routes/fiaon-agent-kunden.ts", event: "zustimmung_link", schluessel: ["zustimmung_url"] },
    { datei: "server/routes/fiaon-agent-kunden.ts", event: "konto_karte_einladung", schluessel: ["partner_link"] },
    { datei: "server/routes/fiaon-zugang-retten.ts", event: "zugang_link", schluessel: ["login_url", "passwort_url"] },
    { datei: "server/routes/fiaon-app-login.ts", event: "app_login_link", schluessel: ["login_link_url"] },
    { datei: "server/fiaon-number-update.ts", event: "number_update_request", schluessel: ["update_url", "termin_link"] },
    { datei: "server/routes/fiaon-termin.ts", event: "termin_bestaetigung", schluessel: ["storno_link"] },
    { datei: "server/routes/fiaon-gruender-termin.ts", event: "termin_bestaetigung", schluessel: ["storno_link"] },
    { datei: "server/routes/fiaon-followup.ts", event: "termin_erinnerung", schluessel: ["storno_link"] },
    { datei: "server/lib/fiaon-termine.ts", event: "termin_absage", schluessel: ["neu_buchen_link"] },
    { datei: "server/lib/fiaon-nicht-erreicht.ts", event: "nicht_erreicht_termin", schluessel: ["termin_link"] },
    { datei: "server/lib/fiaon-wiedereinstieg.ts", event: "nicht_erreicht_termin", schluessel: ["termin_link"] },
    { datei: "server/routes/fiaon-abo.ts", event: "vertrag_beendet", schluessel: ["portal_url"] },
    { datei: "server/routes/fiaon-abo.ts", event: "abo_verlaengerung_frage", schluessel: ["portal_url"] },
    { datei: "server/routes/fiaon-kuendigung.ts", event: "kuendigung_bestaetigt", schluessel: ["verwendungszweck"] },
    { datei: "server/routes/fiaon-bankwechsel.ts", event: "bankverbindung_neu", schluessel: ["makePayloadFromRow", "verwendungszweck"] },
    { datei: "server/lib/fiaon-antrag-erinnerung.ts", event: "antrag_erinnerung", schluessel: ["weiter_link"] },
    { datei: "server/routes/fiaon-einrichtung.ts", event: "antrag_erinnerung", schluessel: ["weiter_link"] },
    { datei: "server/routes/fiaon-leads.ts", event: "lead_application_link", schluessel: ["antrag_url"] },
    { datei: "server/lib/fiaon-lead-strecke.ts", event: "lead_followup", schluessel: ["knopf_url", "abmelde_url"] },
    { datei: "server/lib/fiaon-monatsbericht.ts", event: "app_monatsbericht", schluessel: ["bericht_url"] },
  ];
  for (const s of STELLEN) {
    const zeilen = lies(s.datei).split("\n");
    // Nur Versandstellen, keine Listen oder Vergleiche: das Literal als erstes
    // Argument eines Sendeaufrufs, als `event:` oder allein auf der Zeile nach
    // einem offenen Sendeaufruf.
    const SENDER = "(?:sendMakeWebhook(?:MitGrund)?|versendenUndProtokollieren)";
    const direkt = new RegExp(`${SENDER}\\(\\s*"${s.event}"`);
    const alsFeld = new RegExp(`\\bevent:\\s*"${s.event}"`);
    const allein = new RegExp(`^\\s*"${s.event}"(\\s+as\\s+any)?,\\s*$`);
    const offen = new RegExp(`${SENDER}\\(\\s*$`);
    const treffer = zeilen
      .map((z, i) => (!/^\s*(\/\/|\*)/.test(z)
        && (direkt.test(z) || alsFeld.test(z) || (allein.test(z) && offen.test(zeilen[i - 1] ?? ""))) ? i : -1))
      .filter((i) => i >= 0);
    if (!treffer.length) { ok(`${s.datei.split("/").pop()}: Versandstelle „${s.event}“ gefunden`, false, "kein Aufruf mit diesem Ereignis"); continue; }
    for (const i of treffer) {
      // Nur Code: Ein Kommentar über dem Aufruf nennt den Schlüssel oft selbst
      // („… mit login_url") — die erste Fassung dieser Prüfung blieb deshalb
      // bei der Rot-Probe grün (AGENTS.md: Kommentare ausschließen).
      const fenster = zeilen.slice(Math.max(0, i - 12), i + 40)
        .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
        .map((z) => z.replace(/\s\/\/\s.*$/, ""))
        .join("\n");
      const fehlt = s.schluessel.filter((k) => !new RegExp(`\\b${k}\\b`).test(fenster));
      ok(`${s.datei.split("/").pop()}:${i + 1} „${s.event}“ gibt ${s.schluessel.join(", ")} mit`, fehlt.length === 0,
        `fehlt: ${fehlt.join(", ")}`);
    }
  }
  // Die Rückholung schickt ihr Ereignis als Variable (f.event) — eigener Blick.
  const rueck = lies("server/lib/fiaon-rueckholung.ts");
  const ab = rueck.indexOf("versendenUndProtokollieren(f.event");
  const aufruf = ab >= 0 ? rueck.slice(ab, ab + 2500) : "";
  ok("Rückholung (alle Lagen): termin_link, abmelde_url und Paket-Rückfall im Aufruf",
    /termin_link:/.test(aufruf) && /abmelde_url:/.test(aufruf) && /PAKET_RUECKFALL/.test(aufruf),
    ab < 0 ? "Aufruf nicht gefunden" : "");
  // Jede Werbe-Versandstelle der Leads mit Abmeldelink (18.09.2026: eine hatte keinen).
  const leads = lies("server/routes/fiaon-leads.ts");
  const ohneAbmeldung = Array.from(leads.matchAll(/sendMakeWebhook\("lead_followup",\s*([^;]+);/g))
    .map((m) => m[1]).filter((arg) => !/MitAbmeldung/.test(arg));
  ok("Jeder lead_followup in fiaon-leads.ts geht MIT Abmeldelink", ohneAbmeldung.length === 0, ohneAbmeldung.join(" | "));

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${rot} fehlgeschlagen ══\n`);
  if (rot > 0) { log("Fehlgeschlagen:"); for (const f of fehler) log(`  · ${f}`); }
  if (ROT_PROBE) {
    log(rot > 0
      ? "ROT-PROBE: Der nachgebaute Fehler wurde erkannt — die Wand greift."
      : "ROT-PROBE GESCHEITERT: Der nachgebaute Fehler blieb unbemerkt.");
    process.exit(rot > 0 ? 0 : 1);
  }
  process.exit(rot > 0 ? 1 : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 2 — gegen die Datenbank, in einer Transaktion
// ═══════════════════════════════════════════════════════════════════════════
async function teilZwei(knopfPlatzhalter: (ev: string) => string[]): Promise<void> {
  const { sqlPool } = await import("../server/lib/db-pool");
  const { mailEvents, imMenue } = await import("../server/lib/fiaon-mail-events");
  const { sendePayloadBauen, versandLuecke, mailVorschau } = await import("../server/lib/fiaon-mail-senden");
  const { versandErlaubt, istVersandArt, artenFuerRolle } = await import("../server/lib/fiaon-versand");
  const motor = await import("../server/mail/motor");

  // ── DDL VOR DER TRANSAKTION (AGENTS.md, „Drei Fallen", 1) ────────────────
  // Die Tabellen-Prüfungen laufen über die GLOBALE Verbindung. Einmal hier
  // aufgerufen, merken sie sich das — in der Transaktion warten sie dann
  // nicht auf deren Sperren.
  try {
    const { kartenStand } = await import("../server/lib/fiaon-konto-karte");
    await kartenStand(-1);
    const { ensureAboTabellen } = await import("../server/routes/fiaon-abo");
    await ensureAboTabellen();
  } catch (e) {
    log(`  HINWEIS  Vorab-Prüfung der Tabellen: ${e instanceof Error ? e.message : String(e)}`);
  }

  const stempel = Date.now().toString(36).toUpperCase();
  const REF = (s: string) => `FIAON-KNOPF${stempel}-${s}`;
  const MAIL = `pruefstand-knopf-${stempel}@pruefstand-knopf.invalid`.toLowerCase();

  // Ereignisse, die in der Transaktion ABLEHNEN dürfen — mit dem Grund. Alles
  // andere, was ein Menü anbietet, muss vollständig sein.
  const ERWARTET_ABGELEHNT: Record<string, { muster: RegExp; warum: string }> = {
    app_login_link: { muster: /Kundenkonto/, warum: "die Kontosuche liest über die globale Verbindung und sieht den Prüfkunden nicht" },
    abo_payment_reminder: { muster: /keine Rate offen/, warum: "die Ratensuche liest über die globale Verbindung" },
    konto_karte_einladung: { muster: /Noch nicht so weit/, warum: "der Prüfkunde erfüllt die drei Bedingungen nicht — genau das soll greifen" },
  };

  try {
    await sqlPool.begin(async (tx) => {
      const [agent] = await tx`
        INSERT INTO fiaon_agents ${tx({ name: `Prüfstand Knopf ${stempel}`, email: `agent-${MAIL}`, active: true, rolle: "agent", is_test_account: true } as any)}
        RETURNING id`;
      const [p] = await tx`
        INSERT INTO fiaon_persons ${tx({ person_ref: `FIAON-P-KNOPF${stempel}`, first_name: "Prüf", last_name: `Knopf${stempel}`, primary_email: MAIL, assigned_agent_id: agent.id } as any)}
        RETURNING id`;
      const personId = Number(p.id);
      const bestellung = (f: Record<string, unknown>) => tx`
        INSERT INTO fiaon_applications ${tx({ type: "private", person_id: personId, email: MAIL, first_name: "Prüf", last_name: `Knopf${stempel}`, ...f } as any)}
        RETURNING ref`;
      // Reihenfolge der Anlage = Reihenfolge von created_at: die jüngste zuletzt.
      await bestellung({ ref: REF("BEZAHLT"), payment_reference: `FIAON-KB${stempel}`.slice(0, 20), payment_status: "paid", status: "payment_completed", pack_key: "pro", pack_name: "FIAON Pro (Standard)", amount_due: 59.99, paid_at: new Date(), created_at: new Date(Date.now() - 3 * 86400000) });
      await bestellung({ ref: REF("OFFEN"), payment_reference: `FIAON-KO${stempel}`.slice(0, 20), payment_status: "pending_payment", status: "approved", pack_key: "ultra", pack_name: "FIAON Ultra", amount_due: 79.99, created_at: new Date(Date.now() - 2 * 86400000) });
      await bestellung({ ref: REF("ENTWURF"), payment_reference: `FIAON-KE${stempel}`.slice(0, 20), payment_status: "pending", status: "personal_data", current_step: 2, pack_key: "pro", pack_name: "FIAON Pro (Standard)", created_at: new Date(Date.now() - 86400000) });
      await tx`
        INSERT INTO fiaon_termine ${tx({ person_id: personId, agent_id: agent.id, beginn: new Date(Date.now() - 86400000), status: "verpasst", quelle: "onboarding_call", storno_token: `knopf${stempel}` } as any)}`;

      const events = (await mailEvents(tx as any)).filter((e) => e.zielgruppe === "kunde" && !e.deprecated && motor.hatVorlage(e.type));
      const angeboten = events.filter((e) => e.rollen.some((r) => imMenue(e, r).ja) || istVersandArt(e.type));
      log(`  ${angeboten.length} Kunden-Ereignisse stehen in einem Menü oder im Versandzentrum.`);
      for (const e of angeboten) {
        const g = await sendePayloadBauen(e.type, personId, tx as any, { vorschau: true, akteurName: "Prüfstand" });
        if (!g) { ok(`${e.type}: Nutzlast gebaut`, false, "Kunde nicht gefunden"); continue; }
        if (g.fehler) {
          const erwartet = ERWARTET_ABGELEHNT[e.type];
          ok(`${e.type}: lehnt mit Klartext ab${erwartet ? ` (${erwartet.warum})` : ""}`, !!erwartet && erwartet.muster.test(g.fehler), g.fehler);
          continue;
        }
        const payload = { ...g.basis, ...g.links };
        const luecke = await versandLuecke(e, payload);
        const knoepfe = knopfPlatzhalter(e.type);
        ok(`${e.type}: vollständig${knoepfe.length ? ` (${knoepfe.join(", ")})` : " (ohne Knopf)"}`, luecke === null, luecke ?? "");
      }

      // Die WERTE, nicht nur die Knöpfe — am ungünstigsten Fall: Die jüngste
      // Bestellung ist der Entwurf, offen ist eine ältere, bezahlt eine noch ältere.
      const zd = await sendePayloadBauen("payment_details", personId, tx as any, { vorschau: true });
      ok("Zahlungsdaten tragen die OFFENE Bestellung, nicht die jüngste",
        String(zd?.links.payment_reference ?? "").startsWith("FIAON-KO") && zd?.links.betrag === "79.99" && !("sofort_url" in (zd?.links ?? {})),
        JSON.stringify({ ref: zd?.links.payment_reference, betrag: zd?.links.betrag }));
      const zb = await sendePayloadBauen("payment_confirmed", personId, tx as any, { vorschau: true });
      ok("Die Zahlungsbestätigung nennt die BEZAHLTE Bestellung",
        String(zb?.links.payment_reference ?? "").startsWith("FIAON-KB") && zb?.links.betrag === "59.99",
        JSON.stringify({ ref: zb?.links.payment_reference, betrag: zb?.links.betrag }));
      const tv = await sendePayloadBauen("termin_verpasst", personId, tx as any, { vorschau: true });
      ok("Die No-Show-Mail nennt Datum und Uhrzeit des verpassten Termins",
        /^\d{2}\.\d{2}\.\d{4}$/.test(String(tv?.links.termin_datum ?? "")) && /^\d{2}:\d{2}$/.test(String(tv?.links.termin_uhrzeit ?? "")),
        JSON.stringify({ datum: tv?.links.termin_datum, uhrzeit: tv?.links.termin_uhrzeit }));
      const al = await sendePayloadBauen("lead_application_link", personId, tx as any, { vorschau: true, akteurName: "Prüfstand" });
      ok("„Wie besprochen mit …“ nennt den, der sendet", al?.links.agent_name === "Prüfstand", String(al?.links.agent_name));
      const alv = await sendePayloadBauen("lead_application_link", personId, tx as any, { vorschau: true });
      ok("… und sendet die Verwaltung: „mit uns“ (nicht „mit Verwaltung“, nicht leer)", alv?.links.agent_name === "uns", String(alv?.links.agent_name));
      const ae = await sendePayloadBauen("antrag_erinnerung", personId, tx as any, { vorschau: true });
      ok("Die Antrags-Erinnerung führt in den Entwurf zurück",
        /\/antrag\?weiter=/.test(String(ae?.links.weiter_link ?? "")) && String(ae?.links.antrag_id ?? "").endsWith("-ENTWURF"),
        JSON.stringify({ weiter: ae?.links.weiter_link, ref: ae?.links.antrag_id }));

      // Die Gegenproben: Ohne Datengrundlage lehnt der Baustein ab, statt eine halbe Mail zu bauen.
      const [q] = await tx`
        INSERT INTO fiaon_persons ${tx({ person_ref: `FIAON-P-KNOPFQ${stempel}`, first_name: "Ohne", last_name: `Termin${stempel}`, primary_email: `q-${MAIL}` } as any)}
        RETURNING id`;
      await tx`
        INSERT INTO fiaon_applications ${tx({ type: "private", person_id: q.id, email: `q-${MAIL}`, ref: REF("Q"), payment_reference: `FIAON-KQ${stempel}`.slice(0, 20), payment_status: "pending_payment", status: "approved", pack_key: "pro", amount_due: 59.99 } as any)}`;
      const ohneTermin = await sendePayloadBauen("termin_verpasst", Number(q.id), tx as any, { vorschau: true });
      ok("Ohne verpassten Termin keine No-Show-Mail mit „am  um  Uhr“", /kein verpasster Termin/.test(ohneTermin?.fehler ?? ""), ohneTermin?.fehler ?? "gebaut");
      const mitTermin = await sendePayloadBauen("termin_verpasst", Number(q.id), tx as any, { vorschau: true, vorhanden: { termin_datum: "17.09.2026", termin_uhrzeit: "10:00" } });
      ok("… gibt der Kalender den Termin mit, baut der Baustein die Mail", !mitTermin?.fehler, mitTermin?.fehler ?? "");
      const ohneEntwurf = await sendePayloadBauen("antrag_erinnerung", Number(q.id), tx as any, { vorschau: true });
      ok("Ohne begonnenen Antrag keine Antrags-Erinnerung", /keinen begonnenen Antrag/.test(ohneEntwurf?.fehler ?? ""), ohneEntwurf?.fehler ?? "gebaut");

      // Die Zustandsregeln (fiaon-versand.ts) — die Zugangsmail und ihr Gegenstück.
      ok("„Antrag eingegangen“ an einen Bezahlten: abgelehnt", !(await versandErlaubt(personId, "welcome", tx as any)).erlaubt);
      ok("„Zugang zum Bereich“ an einen Bezahlten: erlaubt", (await versandErlaubt(personId, "zugang_link", tx as any)).erlaubt);
      ok("„Zugang zum Bereich“ an einen Unbezahlten: abgelehnt", !(await versandErlaubt(Number(q.id), "zugang_link", tx as any)).erlaubt);
      ok("Zahlungsbestätigung an einen Unbezahlten: abgelehnt", !(await versandErlaubt(Number(q.id), "payment_confirmed", tx as any)).erlaubt);
      ok("Die Lastschrift-Bitte steht in keinem Sende-Menü mehr (E-194)",
        !(artenFuerRolle("agent") as string[]).includes("sepa_einrichten") && !(artenFuerRolle("onboarding") as string[]).includes("sepa_einrichten"));
      ok("Das Versandzentrum bietet „Zugang zum Bereich“ statt „welcome“ an",
        artenFuerRolle("agent").includes("zugang_link") && !artenFuerRolle("agent").includes("welcome")
        && artenFuerRolle("onboarding").includes("zugang_link"));

      // Die Vorschau zeigt Lücke und Absender — dieselbe Kette wie der Versand.
      const v = await mailVorschau({ event: "zugang_link", personId, rolle: "agent", lauf: tx as any });
      ok("Die Vorschau der Zugangsmail ist vollständig", v.ok && v.sperre === null && /\/login/.test(v.html), v.ok ? String(v.sperre) : v.grund);
      const knapp = await versandLuecke({ type: "zugang_link", label: "Zugang zum Bereich", pflichtFelder: [] } as any, { ...basisOhneLinks(MAIL) });
      ok("versandLuecke nennt den fehlenden Knopf im Klartext", /ohne ihren Knopf/.test(knapp ?? ""), knapp ?? "null");
      const pflicht = await versandLuecke({ type: "termin_bestaetigung", label: "Terminbestätigung", pflichtFelder: ["termin_datum"] } as any, { email: MAIL });
      ok("… und fehlende Pflichtfelder", /termin_datum/.test(pflicht ?? ""), pflicht ?? "null");

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) {
      ok("Teil 2 lief durch", false, e instanceof Error ? e.message : String(e));
    }
  }

  // Gegenprobe: nichts geschrieben.
  const [rest] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-KNOPF%${stempel}`})::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-KNOPF${stempel}%`})::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_mail_log WHERE empfaenger LIKE ${`%${stempel.toLowerCase()}@pruefstand-knopf.invalid`})::int AS mails
  `) as any[];
  ok("Nichts ist übrig — alles zurückgerollt", Number(rest?.personen) === 0 && Number(rest?.bestellungen) === 0 && Number(rest?.mails) === 0,
    JSON.stringify(rest));
  await sqlPool.end({ timeout: 5 }).catch(() => {});
}

function basisOhneLinks(email: string): Record<string, unknown> {
  return { email, vorname: "Prüf", nachname: "Knopf" };
}

main().catch((err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  process.exit(1);
});
