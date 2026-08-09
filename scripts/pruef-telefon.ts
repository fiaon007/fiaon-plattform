// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Dokumente, Softphone, Gesprächsblatt
//
// Der gefährlichste Teil ist NICHT das Telefon — es ist der Ausweis. Bis zum
// 10.08.2026 lag `GET /api/fiaon/document/:ref/:type` unter „Public (no auth)":
// Wer eine Bestellreferenz kannte, lud fremde Ausweise herunter. Diese Datei
// prüft, dass das vorbei ist, und dass die Grenze aus der
// Verpflichtungserklärung („sichtbar ist nur, ob sie vorliegen") jetzt im
// Code steht statt nur im Text.
//
// TWILIO UND OPENAI SIND ATTRAPPEN. Es geht kein Anruf raus, keine Mail, kein
// API-Aufruf. Die Zugangsdaten fehlen ohnehin — genau der Zustand, in dem der
// Vorgesetzter die Plattform heute vorfindet.
//
//   npx tsx scripts/pruef-telefon.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT = {
  make: process.env.MAKE_WEBHOOK_URL,
  openai: process.env.OPENAI_API_KEY,
  sid: process.env.TWILIO_ACCOUNT_SID,
};
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";
process.env.OPENAI_API_KEY = "";
delete process.env.TWILIO_ACCOUNT_SID;

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  darfInhalt, dateiTyp, dokumentInhalt, dokumentStand, dokumentTokenErzeugen,
  dokumentTokenPruefen, DOKUMENTE, istDokumentArt,
} from "../server/lib/fiaon-dokumente";
import {
  einrichtungsStand, MAX_MINUTEN, nummerNormalisieren, offeneAnrufe,
  telefonBereit, twimlAusgehend, wahlProtokoll, wahlPruefen, zugangsAusweis, ENV_FELDER,
} from "../server/lib/fiaon-softphone";
import { cacheLeeren, FUSSSATZ, gespraechsblatt } from "../server/lib/fiaon-gespraechsblatt";
import { EINWAENDE, einwaendeFuer } from "../server/lib/fiaon-einwaende";
import { entschaerfen } from "../server/lib/fiaon-mail-ki";
import { anrufNachbereiten, transkriptKonfiguriert } from "../server/lib/fiaon-transkript";
import { ergebnisAnwenden } from "../server/lib/fiaon-kontakt-ergebnis";
import { ZUSAGE_TEXT } from "../server/lib/fiaon-vertrieb-zusage";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-TEL${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-telefon.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Dokumente, Telefon, Gesprächsblatt ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_call_versuche)::int AS versuche,
           (SELECT COUNT(*) FROM fiaon_gespraechsblatt_log)::int AS blaetter
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Der Ausweis liegt nicht mehr offen");
  // ═══════════════════════════════════════════════════════════════════════
  const antrag = readFileSync("server/routes/fiaon-antrag.ts", "utf8");
  ok("Die alte Download-Route verlangt jetzt ein Token",
    /router\.get\("\/document\/:ref\/:type"[\s\S]{0,1400}dokumentTokenPruefen/.test(antrag));
  ok("… und lehnt ohne Token ab", /Dieser Link ist abgelaufen oder ungültig/.test(antrag));
  ok("Es gibt einen Weg, wie der Kunde ein Token bekommt",
    /router\.post\("\/document-link"/.test(antrag));
  ok("… der Referenz UND E-Mail verlangt",
    /document-link[\s\S]{0,900}LOWER\(TRIM\(COALESCE\(email/.test(antrag));

  const portal = readFileSync("client/src/pages/dashboard.tsx", "utf8");
  ok("Das Kundenportal benutzt keinen direkten Dokumentlink mehr",
    !/href=\{`\/api\/fiaon\/document\//.test(portal));
  ok("… sondern holt sich einen signierten", /document-link/.test(portal));

  // Token-Mechanik.
  const t = dokumentTokenErzeugen("FIAON-ABC", "ausweis");
  ok("Ein frisches Token gilt", dokumentTokenPruefen("FIAON-ABC", "ausweis", t));
  ok("Für eine andere Bestellung nicht", !dokumentTokenPruefen("FIAON-XYZ", "ausweis", t));
  ok("Für eine andere Dokumentart nicht", !dokumentTokenPruefen("FIAON-ABC", "kontoauszug", t));
  ok("Abgelaufen gilt es nicht",
    !dokumentTokenPruefen("FIAON-ABC", "ausweis", dokumentTokenErzeugen("FIAON-ABC", "ausweis", -1000)));
  ok("Ein erfundenes Token gilt nicht", !dokumentTokenPruefen("FIAON-ABC", "ausweis", "9999999999999.abc"));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Die Grenze der Verpflichtungserklärung steht im Code");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die Erklärung verbietet der Leitung Dokumenteinsicht",
    ZUSAGE_TEXT.kannNicht.some((z) => /Kundendokumente öffnen oder herunterladen/.test(z)));
  ok("Der Vorgesetzte darf Inhalte", darfInhalt("admin"));
  ok("Die Vertriebsleitung NICHT", !darfInhalt("vertriebsleiter"));
  ok("Ein Teammitglied NICHT", !darfInhalt("agent"));
  ok("Das Onboarding NICHT", !darfInhalt("onboarding"));

  gleich("Es gibt drei Dokumentarten", DOKUMENTE.length, 3);
  ok("… und sie werden geprüft", istDokumentArt("ausweis") && !istDokumentArt("gehaltszettel"));
  gleich("PDF wird erkannt", dateiTyp(Buffer.from("%PDF-1.4")), "pdf");
  gleich("JPEG wird erkannt", dateiTyp(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "bild");
  gleich("PNG wird erkannt", dateiTyp(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "bild");
  gleich("Unbekanntes bleibt unbekannt", dateiTyp(Buffer.from("hallo")), "unbekannt");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Softphone ohne Zugangsdaten");
  // ═══════════════════════════════════════════════════════════════════════
  const stand = einrichtungsStand();
  ok("Nicht bereit", !stand.bereit);
  gleich("Alle sechs Werte fehlen", stand.fehlend.length, 6);
  for (const f of ENV_FELDER) {
    ok(`Der fehlende Wert wird beim Namen genannt: ${f.name}`,
      stand.fehlend.some((x) => x.name === f.name));
  }
  ok("Jeder fehlende Wert sagt, wozu er da ist", stand.fehlend.every((f) => f.zweck.length > 8));
  ok("… und wo man ihn herbekommt", stand.fehlend.every((f) => f.woher.length > 20),
    stand.fehlend.map((f) => f.woher).find((w) => w.length <= 20) ?? "");
  ok("Der Hinweis nennt eine Zahl, nicht nur „nicht konfiguriert“", /6 Werte/.test(stand.hinweis));
  ok("telefonBereit() sagt nein", !telefonBereit());

  const ausweis = await zugangsAusweis(1);
  ok("Ein Ausweis wird nicht ausgestellt", !ausweis.ok);
  ok("… mit Begründung", !!ausweis.grund && ausweis.grund.length > 10);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Nummern und die DACH-Sperre");
  // ═══════════════════════════════════════════════════════════════════════
  for (const [roh, soll] of [
    ["0176 229 106 92", "+4917622910692"],
    ["+49 (0)176 22910692", "+4917622910692"],
    ["004917622910692", "+4917622910692"],
    ["017622910692", "+4917622910692"],
  ] as const) {
    gleich(`Normalisiert: „${roh}“`, nummerNormalisieren(roh), soll);
  }
  ok("Unsinn wird abgelehnt", nummerNormalisieren("abc") === null);
  ok("Zu kurz wird abgelehnt", nummerNormalisieren("123") === null);

  for (const n of ["+4917622910692", "+436601234567", "+41791234567"]) {
    ok(`DACH erlaubt: ${n}`, (await wahlPruefen(n)).erlaubt);
  }
  const usa = await wahlPruefen("+12125550100");
  ok("USA abgelehnt", !usa.erlaubt);
  ok("… mit Begründung, die den Grund nennt", /Deutschland, Österreich und der Schweiz/.test(usa.grund || ""));
  const teuer = await wahlPruefen("+8811234567890");
  ok("Satellitennummer abgelehnt", !teuer.erlaubt);

  gleich("Höchstdauer 60 Minuten", MAX_MINUTEN, 60);
  const twiml = twimlAusgehend({
    an: "+4917622910692", von: "+493012345678", ansage: "Testansage",
    aufnahmeCallback: "https://x/a", statusCallback: "https://x/s",
  });
  ok("Die Ansage steht VOR dem Wählen", twiml.indexOf("<Say") < twiml.indexOf("<Dial"));
  ok("Die Ansage ist im TwiML", /Testansage/.test(twiml));
  ok("Aufgezeichnet wird ab Rufannahme", /record="record-from-answer-dual"/.test(twiml));
  ok("Die Höchstdauer steht im TwiML", new RegExp(`timeLimit="${MAX_MINUTEN * 60}"`).test(twiml));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Guardrails und Einwand-Bausteine");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Kein Baustein verspricht etwas",
    EINWAENDE.every((e) => !/garantier|sicher zugesagt|auf jeden Fall bewilligt/i.test(e.antwort)),
    EINWAENDE.filter((e) => /garantier/i.test(e.antwort)).map((e) => e.schluessel).join(", "));
  ok("Kein Baustein sagt „Beratung“ oder „Berater“",
    EINWAENDE.every((e) => !/\bberat(ung|er|en)\b/i.test(e.antwort)));
  ok("Jeder Baustein ist sprechbar (mind. 80 Zeichen)",
    EINWAENDE.every((e) => e.antwort.length >= 80));
  ok("Es gibt Bausteine für Preis, Zweifel und Seriosität",
    ["preis", "ueberlegen", "seriositaet"].every((s) => EINWAENDE.some((e) => e.schluessel === s)));

  const fuerA = einwaendeFuer({ tier: 1, grund: "zahlung_angekuendigt", hatUnterlagen: true, verpassterTermin: false });
  ok("Stufe A bekommt den „schon bezahlt“-Baustein", fuerA.some((e) => e.schluessel === "schon_bezahlt"));
  const fuerC = einwaendeFuer({ tier: 3, grund: "nur_lead", hatUnterlagen: false, verpassterTermin: false });
  ok("Ein Lead bekommt die Seriositätsfrage", fuerC.some((e) => e.schluessel === "seriositaet"));
  ok("… und NICHT „schon bezahlt“", !fuerC.some((e) => e.schluessel === "schon_bezahlt"));

  // Die Wand gegen provozierte Zusagen.
  const boese = entschaerfen(
    "Wir garantieren dir ein Limit von 25.000 Euro. Unsere Beratung ist kostenlos, der Berater berät dich.",
  );
  ok("„garantieren“ übersteht die Wand nicht", !/garantier/i.test(boese.text), boese.text);
  ok("„Beratung“ ebenso wenig", !/beratung/i.test(boese.text));
  ok("… und der Mensch erfährt, was geändert wurde", boese.entfernt.length >= 2);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Transkript ohne Schlüssel");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Ohne OPENAI_API_KEY meldet sich der Transkriptweg ab", !transkriptKonfiguriert());
  const transkriptLib = readFileSync("server/lib/fiaon-transkript.ts", "utf8");
  ok("Der Anbieter steckt in EINER Datei",
    /api\.openai\.com\/v1\/audio\/transcriptions/.test(transkriptLib));
  ok("Andere Dateien rufen die Audio-API nicht",
    !readFileSync("server/routes/fiaon-telefonie.ts", "utf8").includes("audio/transcriptions"));
  ok("Die Zusammenfassung verbietet Bewertungen ausdrücklich",
    /Keine Bewertung, keine Empfehlung/.test(transkriptLib));
  ok("… und läuft durch denselben Ausgabefilter wie die Mail-KI",
    /entschaerfen\(roh\)\.text/.test(transkriptLib));

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-TL${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Telefon${stempel}`, priority_tier: 2, tier_reason: "rechnung_offen", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (f: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "pending_payment", ...f,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      const [agent] = (await tx`
        SELECT id, name FROM fiaon_agents WHERE active AND NOT is_test_account ORDER BY id LIMIT 1
      `) as any[];

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Dokumente: vorhanden, Lücke, kein Inhalt für die Leitung");
      // ═══════════════════════════════════════════════════════════════════
      const p1 = await person({ first_name: "Mitausweis", primary_email: MAIL("m1"), birthdate: "1988-08-14" });
      const r1 = await bestellung({
        ref: REF("DOK"), person_id: p1, email: MAIL("m1"),
        // Echte Bytes: „%PDF" als Kopf, damit die Typerkennung greift.
        id_card_pdf: Buffer.from("%PDF-1.4 Ausweis"),
        documents_uploaded_at: new Date(), kyc_status: "pending",
        payment_reference: `FIAON-VZ${stempel}`, amount_due: 99.99, pack_name: "FIAON Pro",
      });

      const alsAdmin = await dokumentStand({ ref: r1, rolle: "admin" }, tx as any);
      ok("Der Stand wird geliefert", !!alsAdmin);
      const ausweis = alsAdmin!.dokumente.find((d) => d.art === "ausweis")!;
      ok("Der vorhandene Ausweis ist als vorhanden gemeldet", ausweis.vorhanden);
      ok("… mit Größe", ausweis.groesseKb != null);
      gleich("… und erkanntem Typ", ausweis.typ, "pdf");
      const auszug = alsAdmin!.dokumente.find((d) => d.art === "kontoauszug")!;
      ok("Der fehlende Kontoauszug ist eine LÜCKE", !auszug.vorhanden);
      ok("… und wird gebraucht", auszug.benoetigt);
      gleich("Der Prüfstand steht auf offen", alsAdmin!.kycStatus, "pending");
      ok("Der Vorgesetzte darf Inhalte", alsAdmin!.inhaltErlaubt);

      const alsLeitung = await dokumentStand({ ref: r1, rolle: "vertriebsleiter" }, tx as any);
      ok("Die Leitung sieht denselben Stand", alsLeitung!.dokumente.find((d) => d.art === "ausweis")!.vorhanden);
      ok("… aber KEINE Inhaltsfreigabe", !alsLeitung!.inhaltErlaubt);

      const inhaltAdmin = await dokumentInhalt(r1, "ausweis", "admin", tx as any);
      ok("Der Vorgesetzte bekommt die Datei", inhaltAdmin.ok);
      const inhaltLeitung = await dokumentInhalt(r1, "ausweis", "vertriebsleiter", tx as any);
      ok("Die Leitung bekommt sie NICHT", !inhaltLeitung.ok);
      gleich("… mit 403", (inhaltLeitung as any).code, 403);
      ok("… und dem Wortlaut aus der Erklärung",
        /nur ob sie vorliegen|nur der Vorgesetzte öffnen/.test((inhaltLeitung as any).grund));
      const inhaltAgent = await dokumentInhalt(r1, "ausweis", "agent", tx as any);
      ok("Ein Teammitglied ebenfalls nicht", !inhaltAgent.ok);
      const fehlt = await dokumentInhalt(r1, "kontoauszug", "admin", tx as any);
      ok("Ein nicht vorhandenes Dokument gibt 404", !fehlt.ok && (fehlt as any).code === 404);

      const telefonieQuelle = readFileSync("server/routes/fiaon-telefonie.ts", "utf8");
      ok("„Anfordern“ läuft über die bestehende Registry",
        /schufa_requested/.test(telefonieQuelle) && /documents_change_request/.test(telefonieQuelle));
      ok("… über mailSenden, also mit Zustandsprüfung", /mailSenden\(\{/.test(telefonieQuelle));
      ok("Die Datei-Route setzt no-store", /no-store, private/.test(telefonieQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Anrufe: Datensatz, Ergebnis-Pflicht, Nachbereitung");
      // ═══════════════════════════════════════════════════════════════════
      const [c1] = (await tx`
        INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, status, beginn, dauer_sek)
        VALUES (${p1}, ${r1}, ${agent.id}, '+4917622910692', 'beendet', NOW() - INTERVAL '10 minutes', 214)
        RETURNING id
      `) as any[];

      const offen1 = await offeneAnrufe(Number(agent.id), tx as any);
      ok("Ein Anruf ohne Ergebnis steht in der Erinnerungsliste",
        offen1.some((o: any) => Number(o.id) === Number(c1.id)), String(offen1.length));
      ok("… mit dem Namen des Kunden", offen1.some((o: any) => /Mitausweis|Telefon/.test(String(o.name))));

      // Ergebnis über DENSELBEN Weg wie der Handeintrag.
      const [vorZaehler] = (await tx`SELECT unreachable_count, follow_up_date FROM fiaon_persons WHERE id = ${p1}`) as any[];
      // MIT Transaktion — seit dem 10.08.2026 nimmt ergebnisAnwenden einen
      // Lauf entgegen. Vorher schrieb es fest gegen den Pool und war damit
      // aus einer zurückgerollten Transaktion heraus nicht prüfbar.
      const wirkung = await ergebnisAnwenden(
        { ref: r1, personId: p1, ergebnis: "nicht_erreicht" }, tx as any,
      );
      await tx`UPDATE fiaon_calls SET ergebnis = 'nicht_erreicht', ergebnis_am = NOW() WHERE id = ${c1.id}`;
      const [nachZaehler] = (await tx`SELECT unreachable_count, follow_up_date, betreuung_seit FROM fiaon_persons WHERE id = ${p1}`) as any[];
      gleich("Zählprobe: der Fehlversuch-Zähler ist gestiegen",
        Number(nachZaehler.unreachable_count), Number(vorZaehler.unreachable_count) + 1);
      ok("… eine Wiedervorlage wurde gesetzt", !!nachZaehler.follow_up_date);
      ok("… und der Besitzschutz greift ab jetzt", !!nachZaehler.betreuung_seit);
      ok("Die Meldung ist für Menschen geschrieben", /Nicht erreicht/.test(wirkung.meldung));
      const telWeg = readFileSync("server/routes/fiaon-telefonie.ts", "utf8");
      ok("Der Telefon-Weg nutzt DIESELBE Funktion wie der Handeintrag",
        /await ergebnisAnwenden\(\{/.test(telWeg));
      ok("… und baut keine eigene Wiedervorlage-Rechnung",
        !/follow_up_date\s*=/.test(telWeg));

      const offen2 = await offeneAnrufe(Number(agent.id), tx as any);
      ok("Nach dem Ergebnis ist die Erinnerung weg",
        !offen2.some((o: any) => Number(o.id) === Number(c1.id)));

      // Nachbereitung ohne Aufnahme.
      const [c2] = (await tx`
        INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, status)
        VALUES (${p1}, ${r1}, ${agent.id}, '+4917622910692', 'beendet') RETURNING id
      `) as any[];
      const nach = await anrufNachbereiten(Number(c2.id), tx as any);
      ok("Ohne Aufnahme scheitert die Nachbereitung", !nach.ok);
      const [c2danach] = (await tx`
        SELECT id, status, transkript_status, transkript_grund FROM fiaon_calls WHERE id = ${c2.id}
      `) as any[];
      ok("Der Anruf-Datensatz bleibt INTAKT", !!c2danach && c2danach.status === "beendet");
      gleich("… und trägt den Fehlschlag", c2danach.transkript_status, "fehlgeschlagen");
      ok("… mit einem Grund, den man lesen kann", /keine Aufnahme/i.test(String(c2danach.transkript_grund)));

      // Protokoll jeder Wahl — auch der abgelehnten.
      await wahlProtokoll({
        agentId: Number(agent.id), agentName: String(agent.name), nummer: "+12125550100",
        personId: p1, erlaubt: false, grund: "Nur DACH",
      }, tx as any);
      const [v] = (await tx`
        SELECT nummer, erlaubt, grund FROM fiaon_call_versuche ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("Auch eine ABGELEHNTE Wahl steht im Protokoll", v.erlaubt === false && v.nummer === "+12125550100");
      ok("… mit Grund", /DACH/.test(String(v.grund)));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Gesprächsblatt");
      // ═══════════════════════════════════════════════════════════════════
      cacheLeeren();
      const blatt = await gespraechsblatt(p1, tx as any);
      ok("Das Blatt wird gebaut", !!blatt);
      ok("Der Name steht im Kurzprofil", /Mitausweis/.test(blatt!.profil.zeile));
      ok("… mit Alter aus dem Geburtsdatum", /\d+ Jahre/.test(blatt!.profil.zeile), blatt!.profil.zeile);
      const vz = blatt!.profil.werte.find((w) => w.was === "Verwendungszweck");
      ok("Der VERWENDUNGSZWECK steht drin", vz?.wert === `FIAON-VZ${stempel}`, vz?.wert);
      ok("Stufe und Status stehen drin",
        blatt!.profil.werte.some((w) => w.was === "Stufe" && /B/.test(w.wert)));
      ok("Der Betrag steht drin", blatt!.profil.werte.some((w) => /99,99/.test(w.wert)));
      ok("Es gibt Aufhänger aus echten Fakten", blatt!.aufhaenger.length > 0, blatt!.aufhaenger.join(" | "));
      ok("Eine nächste Aktion mit Begründung", !!blatt!.naechsteAktion.titel && blatt!.naechsteAktion.warum.length > 15);
      ok("Einwand-Bausteine passend zur Stufe", blatt!.einwaende.length >= 2);
      gleich("Der Fußsatz steht auf dem Blatt", blatt!.fussSatz, FUSSSATZ);
      ok("… und mahnt zur Prüfung", /prüfe Fakten/.test(blatt!.fussSatz));

      // Ohne Modell: rohe Einträge statt Erfindungen.
      gleich("Ohne KI-Schlüssel kommt die Historie roh", blatt!.historieHerkunft === "ki", false);
      ok("Das Blatt enthält keine Zusage",
        !/garantier|sicheres Limit|bewilligt/i.test(JSON.stringify(blatt)),
        "Guardrail");

      // Cache gegen Doppelklick.
      const zweites = await gespraechsblatt(p1, tx as any);
      ok("Der zweite Abruf kommt aus dem Zwischenspeicher", zweites!.ausCache);
      gleich("… und ist identisch", zweites!.erstelltAm, blatt!.erstelltAm);

      // Fremder Kunde.
      const fremd = await person({ first_name: "Fremd", primary_email: MAIL("fr") });
      const blattQuelle = readFileSync("server/routes/fiaon-telefonie.ts", "utf8");
      ok("Ein fremder Kunde wird abgelehnt",
        /gespraechsblatt\/:personId[\s\S]{0,500}darfAnKunde[\s\S]{0,300}403/.test(blattQuelle));
      ok("… mit verständlicher Begründung", /von jemand anderem betreut/.test(blattQuelle));
      ok("Jeder Abruf wird protokolliert", /fiaon_gespraechsblatt_log/.test(blattQuelle));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("10. team-alt und nachbuchung-alt sind weg");
  // ═══════════════════════════════════════════════════════════════════════
  const app = readFileSync("client/src/App.tsx", "utf8");
  ok("/admin/team-alt leitet um", /path="\/admin\/team-alt" component=\{\(\) => <Umleitung/.test(app));
  ok("/admin/nachbuchung-alt gibt es nicht mehr", !/path="\/admin\/nachbuchung-alt"/.test(app));
  ok("/admin/nachbuchung leitet weiterhin um", /path="\/admin\/nachbuchung" component=\{\(\) => <Umleitung/.test(app));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("11. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_call_versuche)::int AS versuche,
           (SELECT COUNT(*) FROM fiaon_gespraechsblatt_log)::int AS blaetter
  `;
  ok(`Personen nicht verloren (${vorher.personen} → ${nachher.personen})`,
    Number(nachher.personen) >= Number(vorher.personen));
  gleich("Kein Anruf übrig", nachher.anrufe, vorher.anrufe);
  gleich("Kein Wahlversuch übrig", nachher.versuche, vorher.versuche);
  gleich("Kein Blatt-Protokoll übrig", nachher.blaetter, vorher.blaetter);
  const [reste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Telefon${stempel}`}
  `) as any[];
  gleich("Keine eigene Person übrig", Number(reste.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHT.make;
  process.env.OPENAI_API_KEY = ECHT.openai;
  if (ECHT.sid) process.env.TWILIO_ACCOUNT_SID = ECHT.sid;

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) { log("Fehlgeschlagen:"); for (const f of fehler) log(`  · ${f}`); }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
