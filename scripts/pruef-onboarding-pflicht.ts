// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: ONBOARDING-PFLICHT, COCKPIT UND DIE ARBEITSFLUSS-FIXES
//
// Was hier geprüft wird — jedes davon hat einmal einen Kunden gekostet:
//   1. Die Konto-Stufen: bezahlt → wartet_auf_onboarding → voll_aktiv.
//   2. Freigeschaltet wird NUR durch das erledigte Startgespräch.
//   3. Der Bestand wird NICHT ausgesperrt (349 zahlende Kunden).
//   4. Die Agenda: sechs Schritte, Worthygiene, Pflichtnotizen.
//   5. Der Termin-Haken trifft die RICHTIGE Tabelle (101 Kollisionen!).
//   6. Absagen bleiben sichtbar und werden gemeldet.
//   7. Telefon-Ergebnis = Listen-Ergebnis (eine Kette).
//   8. „Sonstiges" ohne Notiz wird abgelehnt.
//   9. Wartezustand nimmt die Karte vom Tisch und bringt sie zurück.
//  10. Rückrufe: 24-Stunden-Frist, Eskalation, Erledigen nur mit Notiz.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-onboarding-pflicht.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

// Die Attrappe steht VOR jedem Import, der sie lesen könnte.
const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";
const ECHT_BREVO = process.env.BREVO_API_KEY;
process.env.BREVO_API_KEY = "";

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  AGENDA, AGENDA_KEYS, AGENDA_PFLICHT, darfAbschliessen, fortschritt,
  VERBOTENE_WORTE, worthygiene,
} from "../shared/fiaon-onboarding-agenda";
import {
  BEREICHE_WARTEND, bereichOffen, stufeText, vollFreischalten, wartendeZaehlen,
} from "../server/lib/fiaon-kontostufe";
import { WARTE_TAGE, nichtMehrWarten, wartenAufKunde, warteZahlen } from "../server/lib/fiaon-warten";
import {
  FRIST_STUNDEN, rueckrufAufnehmen, rueckrufErledigen, rueckrufeEskalieren, rueckrufZahlen,
} from "../server/lib/fiaon-rueckruf";
import { berlinToday } from "../server/lib/fiaon-time";

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
function datei(pfad: string): string {
  try { return readFileSync(pfad, "utf8"); } catch { return ""; }
}

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-ONB${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-onb.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Onboarding-Pflicht, Cockpit, Arbeitsfluss ══\n");
  log(`  Attrappen aktiv (Make ${ECHT_MAKE ? "ersetzt" : "leer"}, Brevo ${ECHT_BREVO ? "ersetzt" : "leer"}).`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Agenda — sechs Schritte, kuratiert");
  // Reine Prüfung ohne Datenbank: Die Texte sind der Inhalt des Produkts.
  // ═════════════════════════════════════════════════════════════════════════
  gleich("Es gibt sechs Schritte", AGENDA.length, 6);
  gleich("Die Reihenfolge fängt mit der Begrüßung an", AGENDA[0].key, "begruessung");
  gleich("… und endet mit dem Abschluss", AGENDA[AGENDA.length - 1].key, "abschluss");
  ok("Jeder Schritt hat einen Zweck",
    AGENDA.every((a) => a.zweck.length > 20));
  ok("Jeder Schritt hat zwei bis drei Stichpunkte",
    AGENDA.every((a) => a.punkte.length >= 2 && a.punkte.length <= 3),
    AGENDA.map((a) => `${a.key}:${a.punkte.length}`).join(" "));
  ok("Die Schlüssel sind eindeutig",
    new Set(AGENDA_KEYS).size === AGENDA_KEYS.length);
  ok("Die Plattform-Tour ist dabei", AGENDA_KEYS.includes("tour"));
  ok("Der Fahrplan ist dabei", AGENDA_KEYS.includes("fahrplan"));
  ok("Die Unterlagen sind dabei", AGENDA_KEYS.includes("unterlagen"));
  ok("Die Bonitätsauskunft ist dabei", AGENDA_KEYS.includes("bonitaet"));

  // ── WORTHYGIENE ─────────────────────────────────────────────────────────
  // Die 74 € sind eine AUSKUNFT. Wer „Beratung" sagt, verspricht eine
  // erlaubnispflichtige Leistung.
  const bon = AGENDA.find((a) => a.key === "bonitaet")!;
  const alleTexte = AGENDA.flatMap((a) => [a.titel, a.zweck, ...a.punkte]).join(" ");
  gleich("Kein verbotenes Wort in der ganzen Agenda", worthygiene(alleTexte).join(","), "");
  ok("Der Bonitäts-Schritt sagt „Auskunft“",
    /auskunft/i.test([bon.titel, bon.zweck, ...bon.punkte].join(" ")));
  ok("… und nennt die 74 €",
    /74/.test([bon.zweck, ...bon.punkte].join(" ")));
  ok("… und den Zahlweg mit Verwendungszweck",
    /verwendungszweck/i.test(bon.punkte.join(" ")));
  ok("… und dass der Abruf neutral ist",
    /neutral/i.test(bon.punkte.join(" ")));
  ok("GEGENPROBE: „Beratung“ würde erkannt",
    worthygiene("Wir bieten eine Bonitätsberatung").length > 0);
  ok("GEGENPROBE: „garantiert“ würde erkannt",
    worthygiene("Das ist garantiert").length > 0);
  ok("Die Verbotsliste ist nicht leer", VERBOTENE_WORTE.length >= 8);

  // ── FORTSCHRITT UND ABSCHLUSS-SPERRE ────────────────────────────────────
  gleich("Nichts getan = 0 %", fortschritt({ erledigt: [], notizen: {} }), 0);
  gleich("Alles getan = 100 %",
    fortschritt({ erledigt: [...AGENDA_KEYS], notizen: {} }), 100);
  const halb = { erledigt: AGENDA_KEYS.slice(0, 3), notizen: {} };
  gleich("Drei von sechs = 50 %", fortschritt(halb), 50);

  ok("Ohne Pflichtnotizen KEIN Abschluss",
    !darfAbschliessen({ erledigt: [...AGENDA_KEYS], notizen: {} }).ok);
  const vollstaendig = {
    erledigt: [...AGENDA_KEYS],
    notizen: Object.fromEntries(AGENDA_PFLICHT.map((k) => [k, "Ausreichend lange Notiz."])),
  };
  ok("Mit allen Pflichtnotizen JA", darfAbschliessen(vollstaendig).ok,
    darfAbschliessen(vollstaendig).fehlt.join(", "));
  ok("Eine zu kurze Notiz zählt nicht",
    !darfAbschliessen({
      erledigt: [...AGENDA_KEYS],
      notizen: Object.fromEntries(AGENDA_PFLICHT.map((k) => [k, "kurz"])),
    }).ok);
  ok("… und der Fehler NENNT den Schritt",
    darfAbschliessen({ erledigt: [...AGENDA_KEYS], notizen: {} }).fehlt.length === AGENDA_PFLICHT.length);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die Konto-Stufen");
  // ═════════════════════════════════════════════════════════════════════════
  ok("Im Wartezustand ist die Hilfe offen", bereichOffen("wartet_auf_onboarding", "support"));
  ok("… die Unterlagen sind offen", bereichOffen("wartet_auf_onboarding", "documents"));
  ok("… sein Konto ist offen", bereichOffen("wartet_auf_onboarding", "account"));
  ok("… die Bank-Anleitung ist offen", bereichOffen("wartet_auf_onboarding", "bank-guide"));
  ok("ABER der Fahrplan ist GESPERRT", !bereichOffen("wartet_auf_onboarding", "roadmap"));
  ok("Voll aktiv ist alles offen",
    ["roadmap", "documents", "support", "account", "overview"]
      .every((b) => bereichOffen("voll_aktiv", b)));
  gleich("Fünf Bereiche im Wartezustand", BEREICHE_WARTEND.length, 5);
  ok("Der Klartext nennt das fehlende Gespräch",
    /Startgespräch/.test(stufeText("wartet_auf_onboarding", false, false)));
  ok("… und sagt, dass danach alles offen ist",
    /danach ist alles offen/i.test(stufeText("wartet_auf_onboarding", true, false)));
  ok("Voll aktiv sagt es auch",
    /voll freigeschaltet/i.test(stufeText("voll_aktiv", true, true)));

  // ═════════════════════════════════════════════════════════════════════════
  // Ab hier gegen echte Daten — Transaktion, am Ende zurückgerollt.
  // ═════════════════════════════════════════════════════════════════════════
  // Tabellenprüfungen VORHER auslösen: Sie führen ALTER TABLE über den
  // globalen Pool aus und würden sich mit der offenen Transaktion tot warten
  // (AGENTS.md, gelernt am 16.08.2026).
  await (await import("../server/routes/fiaon-agent")).ensureAgentTables();
  await (await import("../server/routes/fiaon-abo")).ensureAboTabellen();

  const vorher = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS apps,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_rueckrufe)::int AS rueckrufe,
           (SELECT COUNT(*) FROM fiaon_contact_log)::int AS verlauf
  `)[0] as any;

  try {
    await sqlPool.begin(async (tx) => {
      // ── Testdaten ───────────────────────────────────────────────────────
      const [person] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email,
                                   primary_phone, phone_key9, priority_tier, created_at, updated_at)
        VALUES (${`PO-${stempel}`}, 'privat', 'Otto', 'Onboarding', ${MAIL("otto")},
                '+4915100000042', '100000042', 1, NOW(), NOW())
        RETURNING id
      `) as any[];
      const ref = REF("A");
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, payment_reference, person_id, paid_at, completed_at,
           onboarding_stufe, onboarding_pflicht, account_status, created_at, updated_at)
        VALUES (${ref}, 'privat', 'payment_completed', 'pro', 'FIAON Pro',
                'Otto', 'Onboarding', ${MAIL("otto")}, 59.99, 'paid', ${`PO-${stempel}`},
                ${person.id}, NOW(), NOW(), 'wartet_auf_onboarding', TRUE, 'active', NOW(), NOW())
      `;

      const [agent] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, created_at)
        VALUES (${`Prüf Onboarding ${stempel}`}, ${MAIL("ob")}, 'onboarding', TRUE, NOW())
        RETURNING id
      `) as any[];

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Freigeschaltet wird NUR durch das Startgespräch");
      // ═══════════════════════════════════════════════════════════════════
      const { stufeVon } = await import("../server/lib/fiaon-kontostufe");
      // `stufeVon` liest über den globalen Pool — in der Transaktion prüfen
      // wir die Spalten deshalb direkt.
      const [s1] = (await tx`
        SELECT onboarding_stufe, onboarding_pflicht, freigeschaltet_am
        FROM fiaon_applications WHERE ref = ${ref}
      `) as any[];
      gleich("Der frisch bezahlte Kunde wartet", s1.onboarding_stufe, "wartet_auf_onboarding");
      gleich("… und für ihn gilt die harte Pflicht", s1.onboarding_pflicht, true);
      gleich("… und er ist NICHT freigeschaltet", s1.freigeschaltet_am, null);

      const frei = await vollFreischalten(Number(person.id),
        { name: "Prüfstand", grund: "Startgespräch geführt (Prüfstand)" }, tx as any);
      gleich("Freischalten trifft genau eine Bestellung", frei.freigeschaltet, 1);
      const [s2] = (await tx`
        SELECT onboarding_stufe, freigeschaltet_am, freigeschaltet_von, freigabe_grund
        FROM fiaon_applications WHERE ref = ${ref}
      `) as any[];
      gleich("… die Stufe steht auf voll_aktiv", s2.onboarding_stufe, "voll_aktiv");
      ok("… mit Zeitstempel", s2.freigeschaltet_am != null);
      gleich("… und mit dem Namen des Freischaltenden", s2.freigeschaltet_von, "Prüfstand");
      ok("… und mit Grund", /Startgespräch/.test(String(s2.freigabe_grund)));

      const [log1] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_contact_log
        WHERE person_id = ${person.id} AND note ILIKE '%voll freigeschaltet%'
      `) as any[];
      ok("Die Freischaltung steht im Verlauf der Akte", Number(log1.n) >= 1);

      // GEGENPROBE: Ein zweiter Aufruf schaltet nicht doppelt frei.
      const frei2 = await vollFreischalten(Number(person.id),
        { name: "Prüfstand", grund: "zweiter Versuch" }, tx as any);
      gleich("GEGENPROBE: ein zweites Freischalten tut nichts", frei2.freigeschaltet, 0);

      // Und der EINE Weg steht im Quelltext.
      const obQuelle = datei("server/routes/fiaon-onboarding-bereich.ts");
      ok("Das erledigte Startgespräch schaltet frei",
        /vollFreischalten\(Number\(termin\.person_id\)/.test(obQuelle));
      ok("… und NUR im Erledigt-Zweig, nicht bei „verpasst“",
        obQuelle.indexOf("vollFreischalten") > obQuelle.indexOf('ergebnis === "verpasst"'));
      const agentQuelle = datei("server/routes/fiaon-agent.ts");
      ok("Jede Zahlung setzt die Wartestufe",
        /aufWartestufeSetzen\(ref\)/.test(agentQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Der Termin-Haken trifft die RICHTIGE Tabelle");
      // ═══════════════════════════════════════════════════════════════════
      const [termin] = (await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle,
                                   storno_token, created_at, updated_at)
        VALUES (${person.id}, ${agent.id}, NOW() + INTERVAL '2 hours', 15, 'gebucht',
                'onboarding_call', ${`t${stempel}`.padEnd(48, "0")}, NOW(), NOW())
        RETURNING id
      `) as any[];

      // DER KERNBEFUND: Kollidiert die Kennung mit einem Verlaufseintrag?
      const [kollision] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE id = ${termin.id}
      `) as any[];
      log(`        (Kennung ${termin.id} trifft ${kollision.n} Verlaufseintrag/-einträge)`);

      const kalQuelle = datei("client/src/pages/agent/kalender.tsx");
      ok("Der Kalender-Haken folgt der Herkunft",
        /a\.art === "termin"[\s\S]{0,200}\/agent\/termine\/\$\{a\.id\}\/ergebnis/.test(kalQuelle));
      ok("… und ruft für Verlaufseinträge den anderen Weg",
        /\/agent\/calendar\/\$\{a\.id\}\/done/.test(kalQuelle));
      ok("Der Server liefert die Herkunft mit",
        /art: "termin"/.test(agentQuelle) && /art: "verlauf"/.test(agentQuelle));
      ok("… und einen eindeutigen Schlüssel",
        /schluessel: `termin:\$\{t\.id\}`/.test(agentQuelle)
        && /schluessel: `verlauf:\$\{r\.id\}`/.test(agentQuelle));

      // Abhaken für ALLE Quellen und auch für „verpasst".
      const terminQuelle = datei("server/routes/fiaon-termin.ts");
      ok("Abhaken verlangt nicht mehr nur „gebucht“",
        /status IN \('gebucht', 'verpasst'\)/.test(terminQuelle));
      ok("… und die Zuständigkeit kommt aus darfAnKunde",
        /darfAnKunde\(req\.agent!\.id, rolle, Number\(termin\.person_id\)\)/.test(terminQuelle));
      ok("… und es gibt KEINEN Filter auf quelle mehr",
        !/AND quelle = 'agent_manuell'/.test(terminQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Absagen bleiben sichtbar und werden gemeldet");
      // ═══════════════════════════════════════════════════════════════════
      const { terminAbsagen } = await import("../server/lib/fiaon-termine");
      const abg = await terminAbsagen(`t${stempel}`.padEnd(48, "0"), "kunde", tx as any);
      ok("Die Absage greift", abg.ok);
      const [nachAbsage] = (await tx`
        SELECT status, abgesagt_am, abgesagt_von FROM fiaon_termine WHERE id = ${termin.id}
      `) as any[];
      gleich("… der Status ist abgesagt", nachAbsage.status, "abgesagt");
      ok("… mit Zeitstempel", nachAbsage.abgesagt_am != null);
      gleich("… und der Urheber steht dran", nachAbsage.abgesagt_von, "kunde");
      ok("Der Kalender zeigt Absagen SIEBEN Tage",
        /t\.status = 'abgesagt' AND t\.abgesagt_am > NOW\(\) - INTERVAL '7 days'/.test(agentQuelle));
      ok("… mit Zeit und Urheber im Klartext",
        /absageText/.test(agentQuelle) && /durch den Kunden/.test(agentQuelle));
      const meldQuelle = datei("server/lib/fiaon-termin-meldung.ts");
      ok("Buchung UND Absage werden gemeldet",
        /export async function buchungMelden/.test(meldQuelle)
        && /export async function absageMelden/.test(meldQuelle));
      ok("… direkt über Brevo mit FIAON-Rahmen",
        /eigeneMailSenden/.test(meldQuelle));
      ok("… und die Meldung nennt Kunde, Zeit, Quelle und Akten-Link",
        /Wann: \$\{wann\}/.test(meldQuelle) && /Art: \$\{quelle\}/.test(meldQuelle)
        && /Zur Akte: \$\{akte\}/.test(meldQuelle));
      const termineQuelle = datei("server/lib/fiaon-termine.ts");
      ok("Die Buchung stößt die Meldung an", /m\.buchungMelden\(buchung\.id/.test(termineQuelle));
      ok("Die Absage stößt die Meldung an", /m\.absageMelden\(/.test(termineQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Telefon-Ergebnis = Listen-Ergebnis (eine Kette)");
      // ═══════════════════════════════════════════════════════════════════
      const kettenQuelle = datei("server/lib/fiaon-kontakt-ergebnis.ts");
      ok("Es gibt eine gemeinsame Kette",
        /export async function ergebnisNachbereiten/.test(kettenQuelle));
      for (const [was, muster] of [
        ["den Verlaufseintrag", /INSERT INTO fiaon_contact_log/],
        ["den Zustand", /await ergebnisAnwenden\(/],
        ["die Nummern-Mail", /maybeSendNumberUpdateMail/],
        ["die Übergabe", /uebergabeAnNaechsten/],
        ["den Nachschub", /m\.nachschub\(/],
      ] as [string, RegExp][]) {
        ok(`Die Kette enthält ${was}`, muster.test(kettenQuelle));
      }
      const telQuelle = datei("server/routes/fiaon-telefonie.ts");
      ok("Das Telefon-Panel ruft die Kette",
        /await ergebnisNachbereiten\(\{/.test(telQuelle));
      ok("… und nicht mehr nur ergebnisAnwenden",
        !/await ergebnisAnwenden\(\{/.test(telQuelle));
      const listeQuelle = datei("server/routes/fiaon-agent-kunden.ts");
      ok("Die Liste ruft dieselbe Kette",
        /await ergebnisNachbereiten\(\{/.test(listeQuelle));
      ok("… und hat ihre eigene Fassung abgegeben",
        !/uebergabeAnNaechsten/.test(listeQuelle));

      // ── „SONSTIGES" BRAUCHT EINE NOTIZ ────────────────────────────────
      ok("„Sonstiges“ ohne Notiz wird abgelehnt",
        /ergebnis === "erreicht_sonstiges" && \(notiz \?\? ""\)\.length < 10/.test(telQuelle));
      ok("… mit einer Erklärung, die die Frage stellt",
        /Was wurde besprochen/.test(telQuelle));
      const sofoQuelle = datei("client/src/components/Softphone.tsx");
      ok("Das Panel hat ein Notizfeld", /fi-tel-notiz/.test(sofoQuelle));
      ok("… und es ist bei „Sonstiges“ Pflicht",
        /notizPflicht: true/.test(sofoQuelle));
      ok("… und freiwillig bei allen anderen",
        /Notiz hinzufügen/.test(sofoQuelle));
      ok("Die Notiz wird mitgesendet", /notiz: notiz\.trim\(\) \|\| null/.test(sofoQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Wartet auf den Kunden");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Die Wartezeit sind sieben Tage", WARTE_TAGE, 7);
      const w = await wartenAufKunde(Number(person.id), "nummer", tx as any);
      const [nachWarten] = (await tx`
        SELECT wartet_auf, wartet_seit, follow_up_date::text AS fu
        FROM fiaon_persons WHERE id = ${person.id}
      `) as any[];
      gleich("Der Grund steht dran", nachWarten.wartet_auf, "nummer");
      ok("… mit Zeitstempel", nachWarten.wartet_seit != null);
      gleich("… und die Wiedervorlage steht in sieben Tagen", nachWarten.fu, w.bis);
      ok("Der Tag liegt wirklich in der Zukunft", w.bis > berlinToday());

      const zahlen = await warteZahlen(null, tx as any);
      ok("Der Zähler findet ihn", zahlen.nummer >= 1, JSON.stringify(zahlen));

      const zurueck = await nichtMehrWarten(Number(person.id), "nummer", tx as any);
      ok("Der Kunde reagiert → die Karte kommt zurück", zurueck.zurueck);
      const [nachZurueck] = (await tx`
        SELECT wartet_auf, follow_up_date FROM fiaon_persons WHERE id = ${person.id}
      `) as any[];
      gleich("… der Wartegrund ist weg", nachZurueck.wartet_auf, null);
      gleich("… und die Wiedervorlage ist heute (NULL)", nachZurueck.follow_up_date, null);
      ok("GEGENPROBE: ein zweiter Aufruf ändert nichts",
        !(await nichtMehrWarten(Number(person.id), "nummer", tx as any)).zurueck);

      const startQuelle = datei("server/routes/fiaon-agent-start.ts");
      ok("Die Tagesliste nimmt Wartende heraus",
        /wo\.push\(`NOT \$\{wartetSql\("p"\)\}`\)/.test(startQuelle));
      ok("… und es gibt einen Filter „Wartend“",
        /filter === "wartend"/.test(startQuelle));
      const kundenQuelle = datei("client/src/pages/agent/kunden-neu.tsx");
      ok("… den ein Mensch anklicken kann",
        /key: "wartend", label: "Wartend \(Kunde\)"/.test(kundenQuelle));
      const numQuelle = datei("server/fiaon-number-update.ts");
      ok("Der Termin-Link fährt in der Nummern-Mail mit",
        /termin_link: terminLink/.test(numQuelle));
      ok("… und der Eintrag der Nummer beendet das Warten",
        /nichtMehrWarten\(Number\(p\.person_id\), "nummer"\)/.test(numQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Rückrufe mit Frist");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Die Frist sind 24 Stunden", FRIST_STUNDEN, 24);
      const rr = await rueckrufAufnehmen({
        personId: Number(person.id), ref,
        quelle: "manuell",
        anliegen: "Kunde bittet um Rückruf wegen seiner Rechnung.",
        kontakt: "+4915100000042",
      }, tx as any);
      ok("Der Rückruf entsteht", rr.id != null && rr.neu);
      const [r1] = (await tx`
        SELECT frist_bis, status, zustaendig_agent_id,
               EXTRACT(EPOCH FROM (frist_bis - NOW()))/3600 AS stunden
        FROM fiaon_rueckrufe WHERE id = ${rr.id}
      `) as any[];
      gleich("… und ist offen", r1.status, "offen");
      ok("… mit einer Frist von rund 24 Stunden",
        Number(r1.stunden) > 23.5 && Number(r1.stunden) <= 24.01, `${r1.stunden} h`);

      const [aufgabe] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_vermerke
        WHERE art = 'aufgabe' AND text ILIKE '%RÜCKRUF binnen%' AND dringend
      `) as any[];
      ok("Es entsteht eine dringende Aufgabe", Number(aufgabe.n) >= 1);

      // Erledigen NUR mit Notiz.
      const ohneNotiz = await rueckrufErledigen(Number(rr.id!),
        { name: "Prüfstand", agentId: null }, "kurz", tx as any);
      ok("Erledigen ohne Notiz wird ABGELEHNT", !ohneNotiz.ok);
      ok("… mit einer Erklärung, die den Grund nennt",
        /mindestens 10 Zeichen/.test(String(ohneNotiz.error)));
      const mitNotiz = await rueckrufErledigen(Number(rr.id!),
        { name: "Prüfstand", agentId: null },
        "Angerufen, Rechnung erklärt, zahlt bis Freitag.", tx as any);
      ok("Mit Notiz geht es", mitNotiz.ok, mitNotiz.error);
      const [r2] = (await tx`
        SELECT status, ergebnis_notiz, erledigt_am FROM fiaon_rueckrufe WHERE id = ${rr.id}
      `) as any[];
      gleich("… und der Rückruf ist erledigt", r2.status, "erledigt");
      ok("… mit Ergebnis-Notiz", /zahlt bis Freitag/.test(String(r2.ergebnis_notiz)));
      const [rLog] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_contact_log
        WHERE ref = ${ref} AND note ILIKE '%Rückruf erledigt%'
      `) as any[];
      ok("… und das Ergebnis steht in der Akte", Number(rLog.n) >= 1);

      // ── DIE ESKALATION ───────────────────────────────────────────────
      const rr2 = await rueckrufAufnehmen({
        personId: Number(person.id), ref, quelle: "telefon",
        anliegen: "Zweiter Wunsch, absichtlich überfällig gemacht.",
      }, tx as any);
      await tx`
        UPDATE fiaon_rueckrufe SET frist_bis = NOW() - INTERVAL '2 hours' WHERE id = ${rr2.id}
      `;
      const esk = await rueckrufeEskalieren(tx as any);
      ok("Die gerissene Frist eskaliert", esk.eskaliert >= 1, JSON.stringify(esk));
      const [r3] = (await tx`
        SELECT eskaliert_am FROM fiaon_rueckrufe WHERE id = ${rr2.id}
      `) as any[];
      ok("… mit Zeitstempel", r3.eskaliert_am != null);
      const [eskKarte] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_vermerke
        WHERE art = 'aufgabe' AND fuer_betreiber AND text ILIKE '%FRIST GERISSEN%'
      `) as any[];
      ok("… und es gibt eine Karte für den Betreiber", Number(eskKarte.n) >= 1);
      const esk2 = await rueckrufeEskalieren(tx as any);
      gleich("GEGENPROBE: ein zweiter Lauf eskaliert nicht erneut", esk2.eskaliert, 0);

      const zahlenRR = await rueckrufZahlen(tx as any);
      ok("Die Zahlen für die Admin-Karte stimmen",
        zahlenRR.offen >= 1 && zahlenRR.ueberfaellig >= 1, JSON.stringify(zahlenRR));

      const inbQuelle = datei("server/routes/mail-inbound.ts");
      ok("Eine eingehende Mail erzeugt einen Rückruf",
        /rueckrufAufnehmen\(\{/.test(inbQuelle) && /quelle: 'mail_inbound'/.test(inbQuelle));
      ok("… und nur für NEUE Mails (keine Doppelung)",
        /if \(isNew && payload\.fromEmail\)[\s\S]{0,400}rueckrufAufnehmen/.test(inbQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Der Bestand wird NICHT ausgesperrt");
      // ═══════════════════════════════════════════════════════════════════
      const [best] = (await tx`
        SELECT COUNT(*)::int AS gesamt,
               COUNT(*) FILTER (WHERE onboarding_stufe = 'voll_aktiv')::int AS voll,
               COUNT(*) FILTER (WHERE onboarding_pflicht)::int AS pflicht
        FROM fiaon_applications
        WHERE payment_status = 'paid' AND merged_into IS NULL
          AND ref <> ${ref}
      `) as any[];
      log(`        (${best.gesamt} bezahlte Bestellungen im Bestand)`);
      gleich("Der ganze Bestand steht auf voll_aktiv", best.voll, best.gesamt);
      gleich("… und für KEINE gilt die harte Pflicht", best.pflicht, 0);
      const sgQuelle = datei("server/routes/fiaon-startgespraech.ts");
      ok("„Später“ wird bei Pflicht serverseitig verweigert",
        /if \(lage\.pflicht && !lage\.termin && !lage\.erledigt\)[\s\S]{0,300}403/.test(sgQuelle));
      ok("… und die Tafel bleibt bei Pflicht stehen",
        /faellig: offen && \(pflicht \|\| !lage\.spaeterAm\)/.test(sgQuelle));
      const gateQuelle = datei("client/src/components/StartgespraechGate.tsx");
      ok("Bei Pflicht zeigt das Gate „Abmelden“ statt „Später“",
        /lage\?\.pflicht \?/.test(gateQuelle) && /Abmelden/.test(gateQuelle));
      ok("Der Bestand bekommt einen Banner",
        /banner: offen && !pflicht/.test(sgQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Cockpit und Portal sind bedienbar");
      // ═══════════════════════════════════════════════════════════════════
      const cockQuelle = datei("client/src/components/agent/OnboardingCockpit.tsx");
      ok("Das Cockpit steht auf FiaonEbene", /<FiaonEbene/.test(cockQuelle));
      ok("… mit Fortschrittsbalken", /role="progressbar"/.test(cockQuelle));
      ok("… mit Uhr", /fi-ob-uhr/.test(cockQuelle));
      ok("… mit Anrufen-Knopf", /onAnrufen\(termin\.telefon!/.test(cockQuelle));
      ok("… mit Notizfeld je Schritt", /notieren\(a\.key, e\.target\.value\)/.test(cockQuelle));
      ok("… mit dem einen Abschluss-Knopf",
        /Gespräch abschließen & freischalten/.test(cockQuelle));
      ok("… und „nicht erschienen“ daneben",
        /Kunde nicht erschienen/.test(cockQuelle));
      ok("Der Abschluss sendet die Agenda mit", /agenda: stand/.test(cockQuelle));
      ok("… und die Dauer", /dauerSek: sekunden/.test(cockQuelle));
      ok("Es gibt eine 380-px-Regel", /max-width: 460px/.test(cockQuelle));
      ok("Der Server nimmt Agenda und Dauer an",
        /agenda_stand = \$\{agendaStand/.test(obQuelle) && /dauer_sek = \$\{dauerSek\}/.test(obQuelle));

      const sgSeite = datei("client/src/pages/agent/startgespraeche.tsx");
      ok("Der Bereich hat einen Knopf ins Cockpit",
        /onClick=\{onCockpit\}/.test(sgSeite) && /Gespräch führen/.test(sgSeite));
      ok("Der Kennzahlen-Kopf nennt „heute geplant“",
        /Heute geplant/.test(sgSeite));
      ok("… und die Ø-Dauer", /Ø Dauer/.test(sgSeite));
      ok("… und die Freischaltungen der Woche",
        /Freigeschaltet \(7 Tage\)/.test(sgSeite));

      const sperreQuelle = datei("client/src/components/PortalSperre.tsx");
      ok("Es gibt eine Sperrkarte statt einer 404",
        /export function PortalSperre/.test(sperreQuelle));
      ok("… sie nennt den Grund und den nächsten Schritt",
        /aktion/.test(sperreQuelle) && /termin/.test(sperreQuelle));
      const dashQuelle = datei("client/src/pages/dashboard.tsx");
      ok("Der Fahrplan ist im Wartezustand gesperrt",
        /stufe && !stufe\.vollAktiv \?[\s\S]{0,200}<PortalSperre/.test(dashQuelle));
      ok("… und die Sperre nennt das Startgespräch",
        /Fahrplan wartet auf das Startgespräch/.test(dashQuelle));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("11. Die Transaktion wurde zurückgerollt");
  // ═════════════════════════════════════════════════════════════════════════
  const nachher = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS apps,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_rueckrufe)::int AS rueckrufe,
           (SELECT COUNT(*) FROM fiaon_contact_log)::int AS verlauf
  `)[0] as any;
  for (const feld of ["apps", "personen", "termine", "rueckrufe", "verlauf"]) {
    ok(`${feld}: nichts verloren`,
      Number(nachher[feld]) >= Number(vorher[feld]),
      `vorher ${vorher[feld]}, nachher ${nachher[feld]}`);
  }
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-ONB${stempel}%`})::int
         + (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref = ${`PO-${stempel}`})::int
         + (SELECT COUNT(*) FROM fiaon_agents WHERE email = ${MAIL("ob")})::int
         + (SELECT COUNT(*) FROM fiaon_rueckrufe WHERE anliegen ILIKE '%absichtlich überfällig%')::int AS c
  `) as any[];
  gleich("Kein Prüfstands-Datensatz in der Produktion", reste.c, 0);

  log(`\n${"═".repeat(62)}`);
  log(`  ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehler.length > 0) {
    log("\n  Fehlgeschlagen:");
    for (const f of fehler) log(`    · ${f}`);
  }
  log(`${"═".repeat(62)}\n`);

  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
