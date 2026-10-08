// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-E (08.10.2026) — Punkt 5 „Akte aus dem Chefbüro: nicht
// gefunden" und Punkt 10 „Dubletten: Betreuer-Wahl ohne zweiten Betreuer“
//
// TEIL 1 (immer, ohne Datenbank): die reinen Regeln in shared/ —
//   Kennung lesen, Akte-Link, Umleitungstexte, Fehlertitel, Betreuer-Lage.
// TEIL 2 (immer, ohne Datenbank): Quelltext — stehen die Regeln dort, wo die
//   Anwendung sie liest? (Kommentare ausgeschlossen, AGENTS.md.)
// TEIL 3 (nur mit LOKALER Datenbank): die echten Funktionen gegen Testdaten in
//   EINER Transaktion, die am Ende zurückgerollt wird —
//   akteAufloesen, personKopf, betreuerLage, personenZusammenfuehren.
// TEIL 4 (`--server`, nur gegen einen LOKALEN Prüfserver mit derselben
//   lokalen Datenbank): die Routen, wie die Oberfläche sie ruft. Die Testdaten
//   werden dafür angelegt und am Ende wieder entfernt (nur lokal).
//
//   tsx scripts/pruef-it-e.ts                                  (Teil 1+2)
//   DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<lokal> tsx scripts/pruef-it-e.ts   (+ Teil 3)
//   … PRUEF_BASIS=http://127.0.0.1:5315 PRUEF_ADMIN_CODE=<lokal> PRUEF_GEHEIMNIS=<lokal> tsx scripts/pruef-it-e.ts --server
//
// Rot-Probe: `--rotprobe` verbiegt die Regel im Speicher (Agent 0 zählt wieder
// als Betreuer) — dann MÜSSEN Prüfungen aus Teil 1 rot werden.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  AKTE_FEHLER_TITEL, akteLinkFuer, kennungLesen, umleitungText, TEXT_KENNUNG_LEER,
  type Umleitung, type UmleitungsGrund,
} from "../shared/fiaon-akte-aufloesung";
import * as lageModul from "../shared/fiaon-betreuer-lage";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  pruef(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => readFileSync(p, "utf8");
/** Quelltext ohne Kommentare — eine Prüfung auf Abwesenheit darf die Begründung nicht treffen. */
const ohneKommentare = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
  .replace(/^\s*--[^\n]*$/gm, "");

const ROTPROBE = process.argv.includes("--rotprobe");
const SERVER = process.argv.includes("--server");

// ── Rot-Probe: die alte Regel im Speicher nachbauen ─────────────────────────
// Agent 0 / gesperrt / Testkonto zählen wieder als Betreuer — genau der Fehler.
const lebenderBetreuer: typeof lageModul.lebenderBetreuer = ROTPROBE
  ? ((s) => ({ agentId: s.agentId == null ? 0 : Number(s.agentId), grund: null }))
  : lageModul.lebenderBetreuer;
const betreuerLageAus: typeof lageModul.betreuerLageAus = ROTPROBE
  ? ((g, v, w) => {
      const a = lebenderBetreuer(g).agentId; const b = lebenderBetreuer(v).agentId;
      if (a !== b && w == null) return { fall: "streit", wahlNoetig: true, agentId: null, agentName: null, quelle: "keiner", text: "", hinweise: [] };
      return { fall: "gleich", wahlNoetig: false, agentId: a, agentName: null, quelle: "unstrittig", text: "", hinweise: [] };
    })
  : lageModul.betreuerLageAus;
const betreuerStreitAus = ROTPROBE
  ? ((a: lageModul.BetreuerSeite, b: lageModul.BetreuerSeite) => lebenderBetreuer(a).agentId !== lebenderBetreuer(b).agentId)
  : lageModul.betreuerStreitAus;

// ═══════════════════════════════════════════════════════════════════════════
function teil1(): void {
  titel("TEIL 1a — Kennung lesen (shared/fiaon-akte-aufloesung.ts)");
  for (const leer of ["", "  ", "null", "NULL", "undefined", "NaN", "0", "person-", "person-null", "lead-", "lead-null", "lead-undefined", "lead-0", "person-0", null, undefined]) {
    gleich(`„${String(leer)}“ ist KEINE Kennung (400 statt „nicht gefunden“)`, kennungLesen(leer).art, "leer");
  }
  gleich("„123“ → Person 123", kennungLesen("123"), { art: "person", personId: 123 });
  gleich("„ 13373 “ (Leerzeichen) → Person 13373", kennungLesen(" 13373 "), { art: "person", personId: 13373 });
  gleich("„person-77“ → Person 77", kennungLesen("person-77"), { art: "person", personId: 77 });
  gleich("„PERSON-5“ → Person 5", kennungLesen("PERSON-5"), { art: "person", personId: 5 });
  gleich("„lead-4862“ → Lead 4862", kennungLesen("lead-4862"), { art: "lead", leadId: 4862 });
  gleich("„LEAD-9“ → Lead 9", kennungLesen("LEAD-9"), { art: "lead", leadId: 9 });
  gleich("zehnstellige Zahl (Rufnummer) ist KEINE Personen-Nummer (int4)", kennungLesen("1512345678").art, "text");
  gleich("„FIAON-MOA83B2P-N8ZH“ → Text (Referenz)", kennungLesen("FIAON-MOA83B2P-N8ZH"), { art: "text", wert: "FIAON-MOA83B2P-N8ZH" });
  gleich("„FIAON-P-8ZFZHS3B“ → Text (Personen-Kennung)", kennungLesen("FIAON-P-8ZFZHS3B").art, "text");
  gleich("„lead-abc“ ist keine Lead-Nummer", kennungLesen("lead-abc").art, "leer");

  titel("TEIL 1b — Akte-Link (ohne Kennung kein Link)");
  for (const leer of [null, undefined, "", "null", "undefined", 0]) {
    gleich(`Link für ${JSON.stringify(leer)} ist null`, akteLinkFuer(leer, "chef"), null);
  }
  gleich("Chef: Personen-Nummer", akteLinkFuer(13536, "chef"), "/chef/s/akte?id=13536");
  gleich("Chef: Lead", akteLinkFuer("lead-4862", "chef"), "/chef/s/akte?id=lead-4862");
  gleich("Admin: Referenz", akteLinkFuer("FIAON-ABC-123", "admin"), "/admin/kunde/FIAON-ABC-123");
  gleich("Sonderzeichen werden kodiert", akteLinkFuer("A B&C", "chef"), "/chef/s/akte?id=A%20B%26C");
  gleich("„person-12“ wird zur reinen Nummer", akteLinkFuer("person-12", "admin"), "/admin/kunde/12");

  titel("TEIL 1c — Umleitungstexte und Fehlertitel");
  const gruende: UmleitungsGrund[] = ["person_zusammengefuehrt", "person_ohne_bestellung", "lead_zur_person", "lead_konvertiert",
    "lead_kontaktgleich", "bestellung_zusammengefuehrt", "bestellung_ersetzt", "kettenziel_fehlt", "familie_kontaktgleich"];
  for (const g of gruende) {
    const u: Umleitung = { grund: g, von: "VON-1", nach: "NACH-2", am: null, wer: null };
    const t = umleitungText(u);
    pruef(`Band „${g}“ nennt Herkunft und Ziel`, t.includes("VON-1") && t.includes("NACH-2"), t);
    pruef(`Band „${g}“ ohne „undefined“/„null“`, !/undefined|null/.test(t), t);
  }
  const mitDatum = umleitungText({ grund: "person_zusammengefuehrt", von: "13373", nach: "13374", am: "2026-10-05T10:15:48Z", wer: "Vorgesetzter (Admin)" });
  pruef("Merge-Band nennt Datum (Berliner Tag) und Akteur", mitDatum.includes("05.10.2026") && mitDatum.includes("Vorgesetzter (Admin)"), mitDatum);
  const spaet = umleitungText({ grund: "person_zusammengefuehrt", von: "1", nach: "2", am: "2026-10-05T22:30:00Z", wer: null });
  pruef("Datum in Berliner Zeit (22:30 UTC = 06.10.)", spaet.includes("06.10.2026"), spaet);
  for (const g of ["kennung_leer", "person_fehlt", "person_ohne_vorgang", "lead_fehlt", "bestellung_fehlt", "kette_kaputt", "sitzung", "server", "kein_zugriff"] as const) {
    pruef(`Fehlertitel „${g}“ vorhanden und nicht „Akte nicht gefunden“`, !!AKTE_FEHLER_TITEL[g] && AKTE_FEHLER_TITEL[g] !== "Akte nicht gefunden");
  }
  pruef("Satz für leere Kennung führt zur Suche", /Suche/.test(TEXT_KENNUNG_LEER));

  titel("TEIL 1d — Betreuer-Lage (shared/fiaon-betreuer-lage.ts) — Justins Regel vom 08.10.2026");
  const seite = (agentId: number | null, x: Partial<lageModul.BetreuerSeite> = {}): lageModul.BetreuerSeite => ({
    agentId, agentName: agentId ? `Agent${agentId}` : null, agentGibtEs: agentId != null && agentId > 0,
    aktiv: true, testkonto: false, gesperrt: false, mandatSeit: null, ...x,
  });
  const echt12 = seite(12);
  const echt14 = seite(14);
  const leer = seite(null);
  const null0 = seite(0, { agentGibtEs: false });
  const gesperrt = seite(20, { gesperrt: true });
  const inaktiv = seite(21, { aktiv: false });
  const test = seite(22, { testkonto: true });
  const fehlt = seite(23, { agentGibtEs: false });

  for (const [name, andere] of [["leer (Pool)", leer], ["Agent 0", null0], ["gesperrt", gesperrt], ["ausgeschieden", inaktiv], ["Testkonto", test], ["gelöschtes Konto", fehlt]] as const) {
    pruef(`Streit? echter Betreuer gegen ${name} → NEIN`, betreuerStreitAus(echt12, andere) === false);
    const a = betreuerLageAus(echt12, andere);
    pruef(`Gewinner echt, Verlierer ${name} → keine Wahl, Agent 12 bleibt`, !a.wahlNoetig && a.agentId === 12 && a.quelle === "gewinner", JSON.stringify(a));
    const b = betreuerLageAus(andere, echt12);
    pruef(`Gewinner ${name}, Verlierer echt → keine Wahl, Agent 12 übernommen`, !b.wahlNoetig && b.agentId === 12 && b.quelle === "verlierer", JSON.stringify(b));
  }
  pruef("Zwei echte, verschiedene → Streit", betreuerStreitAus(echt12, echt14) === true);
  const ohneWahl = betreuerLageAus(echt12, echt14);
  pruef("Zwei echte, verschiedene → Wahl Pflicht", ohneWahl.wahlNoetig && ohneWahl.agentId === null, JSON.stringify(ohneWahl));
  pruef("Meldung nennt beide NAMEN, nicht „Agent 0“", /Agent12/.test(ohneWahl.text) && /Agent14/.test(ohneWahl.text) && !/Agent 0/.test(ohneWahl.text), ohneWahl.text);
  const mitWahlV = betreuerLageAus(echt12, echt14, "verlierer");
  pruef("Mit Wahl „verlierer“ → Agent 14", !mitWahlV.wahlNoetig && mitWahlV.agentId === 14 && mitWahlV.quelle === "verlierer", JSON.stringify(mitWahlV));
  const mitWahlG = betreuerLageAus(echt12, echt14, "gewinner");
  pruef("Mit Wahl „gewinner“ → Agent 12", mitWahlG.agentId === 12 && mitWahlG.quelle === "gewinner", JSON.stringify(mitWahlG));
  const gleicherAgent = betreuerLageAus(echt12, seite(12));
  pruef("Derselbe Betreuer auf beiden Seiten → unstrittig", gleicherAgent.fall === "gleich" && gleicherAgent.agentId === 12 && !gleicherAgent.wahlNoetig);
  const keiner = betreuerLageAus(leer, null0);
  pruef("Keine Seite lebt → agentId null (NIE 0), Gewinner bleibt", keiner.fall === "keiner" && keiner.agentId === null && keiner.quelle === "keiner", JSON.stringify(keiner));
  const keiner2 = betreuerLageAus(gesperrt, test);
  pruef("Gesperrt gegen Testkonto → keiner", keiner2.agentId === null && !keiner2.wahlNoetig, JSON.stringify(keiner2));
  const mandat = betreuerLageAus(echt12, seite(20, { gesperrt: true, mandatSeit: "2026-08-24" }));
  pruef("Mandat beim gesperrten Verlierer → automatisch Agent 12, Hinweis auf das Mandat", mandat.agentId === 12 && mandat.hinweise.some((h) => /Mandat/.test(h)), JSON.stringify(mandat.hinweise));
  // Integrator 08.10.2026: Die Zuordnung der Bestellungen bleibt wie in der Basis —
  // kein Hinweis darf versprechen, dass Bestellungen/Provisionen beim Verkäufer bleiben.
  pruef("Hinweis verspricht nichts über Bestellungen/Provisionen", !mandat.hinweise.some((h) => /Provision|Bestellung/.test(h)), JSON.stringify(mandat.hinweise));
  // Nachprüfung 08.10.2026 (niedrig): Im Fall „keiner" fällt das Mandat des Verlierers weg — der Hinweis sagt es.
  const keinerMandat = betreuerLageAus(gesperrt, seite(21, { aktiv: false, mandatSeit: "2026-08-24" }));
  pruef("Keiner lebt, Mandat am Verlierer → Hinweis nennt das Mandat, das nicht mitgeht",
    keinerMandat.fall === "keiner" && keinerMandat.hinweise.some((h) => /Mandat/.test(h) && /geht nicht mit/.test(h) && /bleibt, wie sie ist/.test(h)),
    JSON.stringify(keinerMandat.hinweise));
  pruef("Ausgeschiedener Betreuer wird im Hinweis benannt", betreuerLageAus(echt12, inaktiv).hinweise.some((h) => /ausgeschieden/.test(h)));
  gleich("Anzeige: echter Betreuer", lageModul.betreuerAnzeige(echt12), "Agent12");
  gleich("Anzeige: gesperrt", lageModul.betreuerAnzeige(gesperrt), "Agent20 (gesperrt)");
  gleich("Anzeige: ausgeschieden", lageModul.betreuerAnzeige(inaktiv), "Agent21 (ausgeschieden)");
  gleich("Anzeige: Testkonto", lageModul.betreuerAnzeige(test), "Agent22 (Testkonto)");
  gleich("Anzeige: leer", lageModul.betreuerAnzeige(leer), "ohne Betreuer");
  pruef("Anzeige: Agent 0 heißt „ohne Betreuer …“", lageModul.betreuerAnzeige(null0).startsWith("ohne Betreuer"));
  // Kein Ergebnis darf je 0 als Betreuer liefern — über alle Kombinationen.
  const alle = [echt12, echt14, leer, null0, gesperrt, inaktiv, test, fehlt];
  let nullTreffer = 0;
  for (const g of alle) for (const v of alle) for (const w of [undefined, "gewinner", "verlierer"] as const) {
    const l = betreuerLageAus(g, v, w);
    if (l.agentId === 0 || (l.agentId != null && !(l.agentId > 0))) nullTreffer++;
    if (betreuerStreitAus(g, v) !== betreuerStreitAus(v, g)) nullTreffer++;
  }
  pruef("Über alle 192 Kombinationen: nie Agent 0, Streit symmetrisch", nullTreffer === 0, `${nullTreffer} Verstöße`);
}

// ═══════════════════════════════════════════════════════════════════════════
function teil2(): void {
  titel("TEIL 2 — Quelltext: stehen die Regeln dort, wo die Anwendung sie liest?");
  const merge = ohneKommentare(lies("server/lib/fiaon-person-merge.ts"));
  pruef("Merge: kein Number(…assigned_agent_id) ohne Null-Prüfung",
    !/betreuung_seit\s*!=\s*null\s*\?\s*Number\(\s*(verlierer|gewinner)\.assigned_agent_id\s*\)/.test(merge)
    && !/Number\(\s*(verlierer|gewinner)\.assigned_agent_id\s*\)\s*!==/.test(merge));
  pruef("Merge: Betreuer kommt aus der EINEN Regel (betreuerLageAus)", /betreuerLageAus\(/.test(merge));
  pruef("Merge: harte Wand gegen eine 0", /betreuer_ungueltig/.test(merge));
  pruef("Merge: quality_flags NICHT mehr als JSON-Text (JSONB-Falle)", !/JSON\.stringify\(\{\s*agents/.test(merge) && /lauf\.json\(/.test(merge));
  pruef("Merge: Werbesperre des Verlierers wandert mit", /werbung_gesperrt_am\s*=\s*CASE/.test(merge));
  pruef("Merge: Forderungsmanagement (inkasso_ab) wandert mit", /inkasso_ab\s*=\s*COALESCE\(inkasso_ab/.test(merge));
  pruef("Merge: Grund im Besitzer-Protokoll (fiaon.reason)", /set_config\('fiaon\.reason', 'person_merge'/.test(merge));
  // Integrator 08.10.2026: Zuordnung von Bestellungen/Provision wie in der Basis —
  // kein eigenes Umschreiben/Zurücksetzen von fiaon_applications.assigned_agent_id im Merge.
  pruef("Merge: schreibt assigned_agent_id an Bestellungen NICHT selbst um (wie Basis)",
    !/UPDATE fiaon_applications a SET assigned_agent_id/.test(merge) && !/bestellungenBeimVerkaeufer|provisionsHinweise/.test(merge));
  pruef("Merge: setzt eine bestehende Konfliktmarke nicht still zurück", !/agent_conflict\s*=\s*FALSE/.test(merge));
  const versprechen = ["client/src/pages/agent/pipeline.tsx", "client/src/components/admin/DublettenArbeitsplatz.tsx", "shared/fiaon-betreuer-lage.ts", "server/lib/fiaon-person-merge.ts"]
    .filter((d) => /eingetragenen Mitarbeiter|wandern (durch das Zusammenführen )?nicht mit|bleib(t|en) bei \$\{name\}/.test(ohneKommentare(lies(d))));
  pruef("Keine Oberfläche verspricht „Bestellungen bleiben beim Verkäufer“", versprechen.length === 0, versprechen.join(", "));
  const kand = ohneKommentare(lies("server/lib/fiaon-dubletten-kandidaten.ts"));
  pruef("Kandidatenliste: Streit über betreuerStreitAus (keine eigene Formel)",
    (kand.match(/betreuerStreitAus\(/g) ?? []).length >= 2 && !/betreuungSeit\s*&&\s*!!\s*rechts\.betreuungSeit/.test(kand));
  pruef("Gegenüberstellung liefert die Lage für beide Gewinner", /wennLinksBleibt/.test(kand) && /wennRechtsBleibt/.test(kand));
  const modell = ohneKommentare(lies("server/fiaon-person-model.ts"));
  pruef("Zweite Merge-Fassung im Personenmodell ist entfernt", !/async function personenZusammenfuehren\(/.test(modell));
  const dub = ohneKommentare(lies("server/routes/fiaon-dubletten.ts"));
  pruef("Abgelehnte Merges werden protokolliert", /'person_merge_abgelehnt'/.test(dub));
  const kunden = ohneKommentare(lies("server/routes/fiaon-kunden.ts"));
  pruef("Akte löst über akteAufloesen auf", /akteAufloesen\(req\.query\.id\)/.test(kunden));
  pruef("Akte: alte Sackgasse „Zur Person … liegt keine Bestellung vor“ ist weg", !/liegt keine Bestellung vor/.test(kunden));
  pruef("Akte: kein eigener Lead-Rückfall über E-Mail/Telefon mehr (Fremdanker)", !/primaryLead\.converted_order_id/.test(kunden));
  pruef("Akte: Leads auch über die Personen-Nummer", /l\.person_id = \$5::int/.test(kunden));
  pruef("Akte: Antwort trägt die Auflösung", /aufloesung:\s*\{/.test(kunden));
  const agent = ohneKommentare(lies("server/routes/fiaon-agent-kunden.ts"));
  const block = agent.slice(agent.indexOf('router.get("/agent/crm/kunden/:personId"'));
  pruef("Agenten-Akte: erst Kopf auflösen, DANN Zugriff prüfen",
    block.indexOf("personKopf(") > 0 && block.indexOf("personKopf(") < block.indexOf("meinePerson("));
  const startSrv = ohneKommentare(lies("server/routes/fiaon-agent-start.ts"));
  pruef("Pipeline-Sprung ?person= auf einen Verlierer zeigt den Kopf", /personKopf\(nurPersonRoh/.test(startSrv) && /const nurPerson = req\.query\.person \? await kopfVon\(/.test(startSrv));
  const vertriebSrv = ohneKommentare(lies("server/routes/fiaon-vertrieb.ts"));
  pruef("Vertriebs-Akte löst den Kopf auf", /personKopf\(Number\(req\.params\.id\)\)/.test(vertriebSrv));
  const chefDateien = ["ChefKundenliste", "ChefWerkzeuge", "ChefWhatsAppZentrale", "ChefMara", "ChefAuskunft", "ChefAuskunftBeschaffung",
    "ChefLeadMotor", "ChefLagezimmer", "ChefZahlungen", "ChefPostfach"].map((n) => `client/src/components/admin/${n}.tsx`);
  const roh = chefDateien.filter((d) => /\/chef\/s\/akte\?id=\$\{/.test(ohneKommentare(lies(d))));
  pruef("Chefbüro: kein selbstgebauter Akte-Link mehr (?id=null unmöglich)", roh.length === 0, roh.join(", "));
  const zentrale = ohneKommentare(lies("client/src/pages/admin-kunden.tsx"));
  pruef("Kunden-Zentrale öffnet über akteLink (bleibt im Chefbüro)", /akteLink\(z\.ref \?\? z\.person_id\)/.test(zentrale) && !/navigate\(`\/admin\/kunde\/\$\{z\.ref/.test(zentrale));
  const akte = ohneKommentare(lies("client/src/pages/admin-kunde.tsx"));
  pruef("Chef-Akte: Fehlerseite unterscheidet Sitzung/Server/Grund", /AKTE_FEHLER_TITEL\.sitzung/.test(akte) && /AKTE_FEHLER_TITEL\.server/.test(akte));
  pruef("Chef-Akte: Hinweisband bei Umleitung", /data-testid="akte-umleitung"/.test(akte) && /umleitungText\(/.test(akte));
  pruef("Chef-Akte: Rücksprung bleibt im Chefbüro", /\/chef\/kundenliste/.test(akte));
  // Gegenprüfung 08.10.2026 (niedrig): Im Chefbüro eingebettete Seiten bauen keinen /admin/kunde-Link mehr von Hand.
  const eingebettet = ["client/src/pages/admin-zahlungen.tsx", "client/src/pages/admin-auszahlungen.tsx", "client/src/pages/admin-leads.tsx"]
    .filter((d) => /\/admin\/kunde\//.test(ohneKommentare(lies(d))));
  pruef("Eingebettete Chef-Seiten: Akte-Links nur über akteLink", eingebettet.length === 0, eingebettet.join(", "));
  pruef("Chef-Akte: Namens-Treffer und Dubletten-Prüfung bleiben im Chefbüro",
    !/<Link href=\{`\/admin\/kunde\//.test(akte) && /imChefbuero\(\) \? "\/chef\/s\/dubletten"/.test(akte));
  pruef("Chef-Akte: Vermerke an der aufgelösten Bestellung, nicht an der Adresse", /ref: app\?\.ref \?\? null/.test(akte));
  pruef("Chef-Akte: Portal-Knopf nur mit Bestellung", /\{ref && \(\s*<button type="button" onClick=\{portalAnsehen\}/.test(akte));
  const pipeline = ohneKommentare(lies("client/src/pages/agent/pipeline.tsx"));
  pruef("Akten-Dialog fragt „Wer betreut künftig?“ und schickt die Wahl", /Wer betreut künftig\?/.test(pipeline) && /\.\.\.\(betreuer \? \{ betreuer \} : \{\}\)/.test(pipeline));
  pruef("Akten-Dialog öffnet die Wahl bei betreuer_entscheidung_fehlt", /code === "betreuer_entscheidung_fehlt"/.test(pipeline));
  pruef("Agenten-Akte zeigt das Band „aufgegangen“", /data-testid="akte-aufgegangen"/.test(pipeline));
  const arbeitsplatz = ohneKommentare(lies("client/src/components/admin/DublettenArbeitsplatz.tsx"));
  pruef("Arbeitsplatz: Wahl je PERSON (kippt nicht beim Gewinnertausch)", /setBetreuerVon\(seite\.id\)/.test(arbeitsplatz) && !/betreuerWahl\b/.test(arbeitsplatz));
  pruef("Arbeitsplatz: zeigt vor dem Klick, wer betreut", /data-testid="dub-betreuer-lage"/.test(arbeitsplatz));
  const vertrieb = ohneKommentare(lies("client/src/pages/agent/vertrieb.tsx"));
  pruef("Leitung › Ordnung liest „kandidaten“ (nicht paare/dubletten)", /r\.json\.kandidaten/.test(vertrieb) && !/r\.json\.paare/.test(vertrieb));
  const rund = lies("client/src/pages/agent/rundgaenge.ts");
  pruef("Rundgang erklärt Band und Betreuer-Regel", /aufgegangen/.test(rund) && /nur bei zwei AKTIVEN Betreuern/.test(rund));
  const mig = lies("db/migrations/101_betreuer_nie_null.sql");
  pruef("Migration 101: CHECK nur, wenn keine 0 mehr da ist (sonst NOTICE)", /RAISE NOTICE/.test(mig) && /assigned_agent_id IS NULL OR assigned_agent_id > 0/.test(mig) && /lock_timeout/.test(mig));
}

// ═══════════════════════════════════════════════════════════════════════════
class Zurueckrollen extends Error {}

async function teil3(): Promise<void> {
  titel("TEIL 3 — Auflösung und Merge gegen die LOKALE Datenbank (Transaktion, Rollback)");
  const db = String(process.env.DATABASE_URL ?? "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(db)) { console.log("  (übersprungen: DATABASE_URL ist nicht lokal)"); return; }
  const { sqlPool } = await import("../server/lib/db-pool");
  const { akteAufloesen, personKopf } = await import("../server/lib/fiaon-akte-aufloesen");
  const { personenZusammenfuehren, betreuerLage, MergeVerboten } = await import("../server/lib/fiaon-person-merge");
  const marke = `ITE${Date.now().toString(36).toUpperCase()}`;
  try {
    await sqlPool.begin(async (tx) => {
      const lauf = tx as unknown as typeof sqlPool;
      let nr = 0;
      const agent = async (name: string, x: Record<string, unknown> = {}) => {
        const [r] = await tx`INSERT INTO fiaon_agents ${tx({ name: `${name} ${marke}`, email: `${name.toLowerCase()}-${marke}@it-e.invalid`, active: true, is_test_account: false, ...x } as any)} RETURNING id`;
        return Number(r.id);
      };
      const person = async (x: Record<string, unknown> = {}) => {
        const [r] = await tx`INSERT INTO fiaon_persons ${tx({ person_ref: `FIAON-P-${marke}${++nr}`, first_name: "Prüf", last_name: `It${nr}`, primary_email: `p${nr}-${marke}@it-e.invalid`, ...x } as any)} RETURNING id, person_ref`;
        return { id: Number(r.id), ref: String(r.person_ref) };
      };
      const antrag = async (personId: number | null, x: Record<string, unknown> = {}) => {
        const ref = `FIAON-${marke}-${++nr}`;
        await tx`INSERT INTO fiaon_applications ${tx({ ref, payment_reference: `FIAON${marke}${nr}`.slice(0, 24), person_id: personId, status: "completed", payment_status: "pending_payment", first_name: "Prüf", last_name: `It${nr}`, email: `a${nr}-${marke}@it-e.invalid`, ...x } as any)}`;
        return ref;
      };
      const lead = async (x: Record<string, unknown> = {}) => {
        const [r] = await tx`INSERT INTO fiaon_leads ${tx({ vorname: "Prüf", nachname: `Lead${++nr}`, email: `l${nr}-${marke}@it-e.invalid`, quelle: "pruefstand", ...x } as any)} RETURNING id`;
        return Number(r.id);
      };
      const merge = async (verlierer: number, gewinner: number, wann = "2026-10-05T10:15:48Z") => {
        await tx`UPDATE fiaon_persons SET merged_into_person_id = ${gewinner}, account_status = 'merged' WHERE id = ${verlierer}`;
        await tx`INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason, created_at)
                 VALUES (NULL, 'person_merge', ${JSON.stringify({ verliererId: verlierer, gewinnerId: gewinner, marke })}, 'Prüfstand IT-E',
                         ${`Person ${verlierer} in Person ${gewinner} zusammengeführt`}, ${wann}::timestamptz)`;
      };

      // ── 3a: Auflösung ───────────────────────────────────────────────
      const nurLead = await person();
      const leadNur = await lead({ person_id: nurLead.id });
      const r1 = await akteAufloesen(String(nurLead.id), lauf);
      pruef("Interessent (nur Lead) öffnet die Interessenten-Akte statt 404",
        r1.ok && r1.ziel.art === "lead" && r1.ziel.leadId === leadNur && r1.ziel.personId === nurLead.id, JSON.stringify(r1));
      pruef("… mit Band „noch keine Bestellung“", r1.ok && r1.umleitungen.some((u) => u.grund === "person_ohne_bestellung"));
      pruef("… kanonisch „lead-N“", r1.ok && r1.kanonisch === `lead-${leadNur}`);
      const r1b = await akteAufloesen(`person-${nurLead.id}`, lauf);
      pruef("„person-N“ wie N", r1b.ok && r1b.ziel.art === "lead");
      const r1c = await akteAufloesen(nurLead.ref, lauf);
      pruef("Personen-Kennung FIAON-P-… öffnet dieselbe Akte", r1c.ok && r1c.ziel.art === "lead" && (r1c.ziel as any).leadId === leadNur, JSON.stringify(r1c));

      const leer = await person();
      const r2 = await akteAufloesen(String(leer.id), lauf);
      pruef("Leere Hülle → 404 „person_ohne_vorgang“ mit Datum", !r2.ok && r2.grund === "person_ohne_vorgang" && r2.status === 404 && /seit \d{2}\.\d{2}\.\d{4}/.test(r2.text), JSON.stringify(r2));

      const r3 = await akteAufloesen("987654321", lauf);
      pruef("Unbekannte Personen-Nummer → 404 „person_fehlt“", !r3.ok && r3.grund === "person_fehlt");
      for (const e of ["", "null", "undefined", "NaN"]) {
        const r = await akteAufloesen(e, lauf);
        pruef(`Eingabe „${e}“ → 400 „kennung_leer“`, !r.ok && r.status === 400 && r.grund === "kennung_leer");
      }

      // Kette A → B → C (C hat Bestellungen: eine bezahlt, eine SCHUFA, eine offen)
      const a = await person(); const b = await person(); const c = await person();
      const cOffen = await antrag(c.id, { created_at: new Date(Date.now() - 1000) });
      const cBezahlt = await antrag(c.id, { payment_status: "paid", created_at: new Date(Date.now() - 86_400_000) });
      await merge(b.id, c.id, "2026-10-05T10:15:48Z");
      await merge(a.id, b.id, "2026-10-04T08:00:00Z");
      const r4 = await akteAufloesen(String(a.id), lauf);
      pruef("Kette A→B→C öffnet die BEZAHLTE Bestellung von C", r4.ok && r4.ziel.art === "bestellung" && r4.ziel.ref === cBezahlt && r4.ziel.personId === c.id, JSON.stringify(r4));
      pruef("… mit zwei Bändern „aufgegangen“ samt Datum und Akteur",
        r4.ok && r4.umleitungen.filter((u) => u.grund === "person_zusammengefuehrt" && u.am && u.wer === "Prüfstand IT-E").length === 2, JSON.stringify(r4.ok ? r4.umleitungen : r4));
      pruef("Bezahlt schlägt offen (dieselbe Ordnung wie bisher)", cOffen !== cBezahlt && r4.ok && (r4.ziel as any).ref === cBezahlt);
      const kopf = await personKopf(a.id, lauf);
      pruef("personKopf(A) = C", kopf.ok && kopf.kopfId === c.id);
      const kopfC = await personKopf(c.id, lauf);
      pruef("personKopf(C) = C ohne Umleitung", kopfC.ok && kopfC.kopfId === c.id && kopfC.umleitungen.length === 0);

      // Zyklus X → Y → X
      const x = await person(); const y = await person();
      await tx`UPDATE fiaon_persons SET merged_into_person_id = ${y.id} WHERE id = ${x.id}`;
      await tx`UPDATE fiaon_persons SET merged_into_person_id = ${x.id} WHERE id = ${y.id}`;
      const t0 = Date.now();
      const r5 = await akteAufloesen(String(x.id), lauf);
      pruef("Zyklus → 404 „kette_kaputt“, ohne Endlosschleife", !r5.ok && r5.grund === "kette_kaputt" && Date.now() - t0 < 5000, JSON.stringify(r5));

      // Lange Kette (12 Glieder) → Obergrenze greift
      const glieder: number[] = [];
      for (let i = 0; i < 12; i++) glieder.push((await person()).id);
      for (let i = 0; i < 11; i++) await tx`UPDATE fiaon_persons SET merged_into_person_id = ${glieder[i + 1]} WHERE id = ${glieder[i]}`;
      const r5b = await akteAufloesen(String(glieder[0]), lauf);
      pruef("Kette über 10 Schritte → „kette_kaputt“ (harte Obergrenze)", !r5b.ok && r5b.grund === "kette_kaputt");

      // Ref-Ketten: R1 → R2 → R3, R4 → fehlt, R5 superseded_by R6
      const pr = await person();
      const R3 = await antrag(pr.id);
      const R2 = await antrag(pr.id, { merged_into: R3 });
      const R1 = await antrag(pr.id, { merged_into: R2 });
      const r6 = await akteAufloesen(R1, lauf);
      pruef("Ref-Kette Tiefe 2 → Kopf R3", r6.ok && (r6.ziel as any).ref === R3 && r6.umleitungen.filter((u) => u.grund === "bestellung_zusammengefuehrt").length === 2, JSON.stringify(r6));
      const R4 = await antrag(pr.id, { merged_into: "PRUEFSTAND-AUFGERAEUMT" });
      const r7 = await akteAufloesen(R4, lauf);
      pruef("merged_into auf fehlende Ref → bleibt bei R4, Band „kettenziel_fehlt“", r7.ok && (r7.ziel as any).ref === R4 && r7.umleitungen.some((u) => u.grund === "kettenziel_fehlt"), JSON.stringify(r7));
      const R6 = await antrag(pr.id);
      const R5 = await antrag(pr.id, { superseded_by: R6 });
      const r8 = await akteAufloesen(R5, lauf);
      pruef("superseded_by wird verfolgt (Band „ersetzt“)", r8.ok && (r8.ziel as any).ref === R6 && r8.umleitungen.some((u) => u.grund === "bestellung_ersetzt"));
      const [zweck] = (await tx`SELECT payment_reference FROM fiaon_applications WHERE ref = ${R6}`) as any[];
      // Gegenprüfung 08.10.2026: Im Bestand trägt superseded_by den VERWENDUNGSZWECK der
      // ersetzenden Bestellung (31 von 35 Zeigern), nicht die Referenz.
      const R7 = await antrag(pr.id, { superseded_by: String(zweck.payment_reference) });
      const r8b = await akteAufloesen(R7, lauf);
      pruef("superseded_by = Verwendungszweck → öffnet die ersetzende Bestellung (Band „ersetzt“, nicht „fehlt“)",
        r8b.ok && (r8b.ziel as any).ref === R6 && r8b.umleitungen.some((u) => u.grund === "bestellung_ersetzt" && u.nach === R6)
          && !r8b.umleitungen.some((u) => u.grund === "kettenziel_fehlt"), JSON.stringify(r8b));
      const r9 = await akteAufloesen(String(zweck.payment_reference), lauf);
      pruef("Verwendungszweck öffnet die Bestellung", r9.ok && (r9.ziel as any).ref === R6, JSON.stringify(r9));
      const r9b = await akteAufloesen(R6.toLowerCase(), lauf);
      pruef("Referenz in Kleinbuchstaben wird gefunden", r9b.ok && (r9b.ziel as any).ref === R6);
      const r10 = await akteAufloesen("FIAON-GIBT-ES-NICHT", lauf);
      pruef("Unbekannte Referenz → 404 „bestellung_fehlt“", !r10.ok && r10.grund === "bestellung_fehlt");

      // FREMDANKER: Lead mit Person ohne Bestellung, converted_order_id einer FREMDEN Bestellung,
      // dazu dieselbe E-Mail wie eine fremde Bestellung → darf NICHT die fremde Bestellung öffnen.
      const fremd = await person();
      const fremdRef = await antrag(fremd.id, { payment_status: "paid", email: `gleich-${marke}@it-e.invalid` });
      const eigen = await person();
      const leadFremd = await lead({ person_id: eigen.id, converted_order_id: fremdRef, email: `gleich-${marke}@it-e.invalid` });
      const r11 = await akteAufloesen(`lead-${leadFremd}`, lauf);
      pruef("Fremdanker: Lead mit Personen-Nummer öffnet NICHT die fremde Bestellung", r11.ok && r11.ziel.art === "lead" && r11.ziel.personId === eigen.id, JSON.stringify(r11));
      const r11b = await akteAufloesen(String(eigen.id), lauf);
      pruef("Fremdanker: auch über die Personen-Nummer nicht", r11b.ok && r11b.ziel.art === "lead", JSON.stringify(r11b));

      // Lead mit Person, deren Bestellung eine ANDERE Mail hat → Bestellung der Person
      const mitBest = await person();
      const mitBestRef = await antrag(mitBest.id, { email: `anders-${marke}@it-e.invalid` });
      const leadZurPerson = await lead({ person_id: mitBest.id, email: `lead-mail-${marke}@it-e.invalid` });
      const r12 = await akteAufloesen(`lead-${leadZurPerson}`, lauf);
      pruef("Lead → Bestellung derselben Person (andere Mail)", r12.ok && (r12.ziel as any).ref === mitBestRef && r12.umleitungen.some((u) => u.grund === "lead_zur_person"), JSON.stringify(r12));
      pruef("… eingabeLeadId bleibt bekannt (Akte zeigt den Lead mit)", r12.ok && r12.eingabeLeadId === leadZurPerson);
      // Lead der Person zeigt über converted_order_id auf die EIGENE Bestellung → „konvertiert“
      const leadKonv = await lead({ person_id: mitBest.id, converted_order_id: mitBestRef });
      const r12b = await akteAufloesen(`lead-${leadKonv}`, lauf);
      pruef("Lead mit eigener Bestellung → „konvertiert“", r12b.ok && (r12b.ziel as any).ref === mitBestRef && r12b.umleitungen.some((u) => u.grund === "lead_konvertiert"));
      // Lead OHNE Person (Altbestand): converted_order_id bzw. gleiche E-Mail
      const altRef = await antrag(null, { email: `alt-${marke}@it-e.invalid` });
      const leadAltKonv = await lead({ converted_order_id: altRef });
      const r13 = await akteAufloesen(`lead-${leadAltKonv}`, lauf);
      pruef("Altbestand: Lead ohne Person mit converted_order_id → Bestellung", r13.ok && (r13.ziel as any).ref === altRef);
      const leadAltMail = await lead({ email: `alt-${marke}@it-e.invalid` });
      const r14 = await akteAufloesen(`lead-${leadAltMail}`, lauf);
      pruef("Altbestand: gleiche E-Mail → Bestellung mit Band „bitte prüfen“", r14.ok && (r14.ziel as any).ref === altRef && r14.umleitungen.some((u) => u.grund === "lead_kontaktgleich"), JSON.stringify(r14));
      const leadAllein = await lead({ email: `allein-${marke}@it-e.invalid` });
      const r15 = await akteAufloesen(`lead-${leadAllein}`, lauf);
      pruef("Lead ohne alles → Lead-Akte", r15.ok && r15.ziel.art === "lead" && r15.ziel.personId === null);
      const r16 = await akteAufloesen("lead-999999999", lauf);
      pruef("Unbekannter Lead → 404 „lead_fehlt“", !r16.ok && r16.grund === "lead_fehlt");
      // Gemergte Person, deren Lead zur Person zeigt → Kopf
      const lk = await person(); const lkKopf = await person();
      const lkKopfRef = await antrag(lkKopf.id);
      await merge(lk.id, lkKopf.id);
      const leadAmVerlierer = await lead({ person_id: lk.id });
      const r17 = await akteAufloesen(`lead-${leadAmVerlierer}`, lauf);
      pruef("Lead am Verlierer → Bestellung des Kopfs", r17.ok && (r17.ziel as any).ref === lkKopfRef, JSON.stringify(r17));

      // ── 3b: Merge — Justins Regel ───────────────────────────────────
      const A = await agent("Aktiv");
      const B = await agent("Zweit");
      const G = await agent("Gesperrt", { zugang_gesperrt_am: new Date() });
      const I = await agent("Inaktiv", { active: false });
      const T = await agent("Test", { is_test_account: true });
      const AKTEUR = { name: "Prüfstand IT-E", agentId: null as number | null };
      const jetzt = new Date();
      const lebt = async (x: Record<string, unknown>) => (await person(x)).id;
      const stand = async (id: number) => ((await tx`SELECT assigned_agent_id, betreuung_seit, agent_conflict, quality_flags, werbung_gesperrt_am, inkasso_ab, mandat_seit FROM fiaon_persons WHERE id = ${id}`) as any[])[0];
      // Der stündliche Lauf „betreuer-kopie-angleich" (server/routes/fiaon-zentralen.ts),
      // auf EINE Person beschränkt — damit Teil 3 die Basis-Zuordnung nachstellt.
      const kopieAngleich = async (personId: number) => {
        await tx`
          UPDATE fiaon_applications a
          SET assigned_agent_id = p.assigned_agent_id, updated_at = NOW()
          FROM fiaon_persons p
          WHERE p.id = a.person_id AND a.merged_into IS NULL
            AND p.merged_into_person_id IS NULL
            AND p.assigned_agent_id IS NOT NULL
            AND a.assigned_agent_id IS DISTINCT FROM p.assigned_agent_id
            AND p.id = ${personId}`;
      };

      // (i) A betreut vs. Pool-Person mit Stempel → ohne Wahl, beide Richtungen
      for (const richtung of ["betreut gewinnt", "pool gewinnt"] as const) {
        const betreut = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const pool = await lebt({ assigned_agent_id: null, betreuung_seit: jetzt });
        await antrag(pool);
        const [gew, verl] = richtung === "betreut gewinnt" ? [betreut, pool] : [pool, betreut];
        try {
          const e = await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
          pruef(`(i) ${richtung}: OHNE Wahl zusammengeführt, Betreuer = Aktiv`, e.betreuer.agentId === A, JSON.stringify(e.betreuer));
          pruef(`(i) ${richtung}: Quelle stimmt`, e.betreuer.quelle === (richtung === "betreut gewinnt" ? "gewinner" : "verlierer"), e.betreuer.quelle);
          const s = await stand(gew);
          pruef(`(i) ${richtung}: assigned_agent_id = Aktiv (nie 0)`, Number(s.assigned_agent_id) === A);
          // Bestellungen wie in der Basis: Wechselt der Betreuer der Person, zieht
          // der Trigger (033) nach; sonst gleicht der stündliche Lauf an (hier für
          // diese eine Person nachgestellt — dieselbe SQL wie „betreuer-kopie-angleich").
          const [bs] = (await tx`SELECT assigned_agent_id FROM fiaon_applications WHERE person_id = ${gew} LIMIT 1`) as any[];
          if (richtung === "pool gewinnt") {
            pruef(`(i) ${richtung}: Bestellungen folgen (Trigger)`, Number(bs?.assigned_agent_id) === A);
          } else {
            pruef(`(i) ${richtung}: Merge schreibt an der Bestellung nichts um (wie Basis)`, bs?.assigned_agent_id == null, String(bs?.assigned_agent_id));
            await kopieAngleich(gew);
            const [bs2] = (await tx`SELECT assigned_agent_id FROM fiaon_applications WHERE person_id = ${gew} LIMIT 1`) as any[];
            pruef(`(i) ${richtung}: nach dem stündlichen Angleich folgt die Bestellung dem Betreuer`, Number(bs2?.assigned_agent_id) === A);
          }
        } catch (err: any) { pruef(`(i) ${richtung}: zusammengeführt`, false, `${err?.code}: ${err?.message}`); }
      }
      // (ii) A gegen gesperrt / inaktiv / Testkonto → automatisch A
      for (const [name, X] of [["gesperrt", G], ["ausgeschieden", I], ["Testkonto", T]] as const) {
        const gew = await lebt({ assigned_agent_id: X, betreuung_seit: jetzt });
        const verl = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        try {
          const e = await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
          pruef(`(ii) Gewinner mit ${name}em Betreuer, Verlierer aktiv → Aktiv übernommen`, e.betreuer.agentId === A && e.betreuer.quelle === "verlierer", JSON.stringify(e.betreuer));
          pruef(`(ii) ${name}: kein Konfliktvermerk`, (await stand(gew)).agent_conflict === false);
          pruef(`(ii) ${name}: Hinweis nennt den nicht zählenden Betreuer`, e.betreuer.hinweise.some((h) => h.includes(name === "ausgeschieden" ? "ausgeschieden" : name)), JSON.stringify(e.betreuer.hinweise));
        } catch (err: any) { pruef(`(ii) ${name}: zusammengeführt`, false, `${err?.code}: ${err?.message}`); }
      }
      // (iii) zwei aktive, verschiedene → ohne Wahl abgelehnt, mit Wahl gelingt
      {
        const p1 = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const p2 = await lebt({ assigned_agent_id: B, betreuung_seit: jetzt });
        try {
          await tx.savepoint(async (sp) => { await personenZusammenfuehren(p2, p1, {}, AKTEUR, { tx: sp as any }); });
          pruef("(iii) zwei aktive Betreuer OHNE Wahl abgelehnt", false, "wurde ausgeführt");
        } catch (err: any) {
          pruef("(iii) zwei aktive Betreuer OHNE Wahl abgelehnt", err instanceof MergeVerboten && err.code === "betreuer_entscheidung_fehlt", `${err?.code}: ${err?.message}`);
          pruef("(iii) Meldung nennt beide Namen", String(err?.message).includes(`Aktiv ${marke}`) && String(err?.message).includes(`Zweit ${marke}`), err?.message);
        }
        const e = await personenZusammenfuehren(p2, p1, { betreuer: "verlierer" }, AKTEUR, { tx: lauf });
        pruef("(iii) mit Wahl „verlierer“ → Zweit", e.betreuer.agentId === B && e.betreuer.quelle === "verlierer");
        const s = await stand(p1);
        pruef("(iii) Historie: beide Agenten in quality_flags (als OBJEKT)", Array.isArray(s.quality_flags?.agents) && s.quality_flags.agents.includes(A) && s.quality_flags.agents.includes(B), JSON.stringify(s.quality_flags));
        const [typ] = (await tx`SELECT jsonb_typeof(quality_flags) AS t FROM fiaon_persons WHERE id = ${p1}`) as any[];
        pruef("(iii) quality_flags ist ein JSON-Objekt, kein Text (JSONB-Falle)", typ?.t === "object", typ?.t);
        const [ev] = (await tx`SELECT reason FROM fiaon_agent_events WHERE type = 'person_owner_changed' AND meta LIKE ${`%"person_id" : ${p1},%`} ORDER BY id DESC LIMIT 1`) as any[];
        pruef("(iii) Besitzerwechsel protokolliert mit Grund „person_merge“", ev?.reason === "person_merge", JSON.stringify(ev));
      }
      // (iii-b) Bedeutungswechsel (Gegenprüfung): zwei aktive, verschiedene Betreuer OHNE
      // Stempel betreuung_seit liefen früher still als „unstrittig" (mit Konfliktmarke) —
      // jetzt verlangen sie eine Wahl, weil der Stempel nicht mehr entscheidet, WER betreut.
      {
        const p1 = await lebt({ assigned_agent_id: A });
        const p2 = await lebt({ assigned_agent_id: B });
        try {
          await tx.savepoint(async (sp) => { await personenZusammenfuehren(p2, p1, {}, AKTEUR, { tx: sp as any }); });
          pruef("(iii-b) zwei aktive Betreuer OHNE Stempel → Wahl Pflicht", false, "wurde ausgeführt");
        } catch (err: any) {
          pruef("(iii-b) zwei aktive Betreuer OHNE Stempel → Wahl Pflicht", err?.code === "betreuer_entscheidung_fehlt", `${err?.code}`);
        }
      }
      // (iv) Verlierer Stempel+NULL, Gewinner ohne alles → bleibt NULL, nie 0 (Fall 13458)
      {
        const gew = await lebt({});
        const verl = await lebt({ assigned_agent_id: null, betreuung_seit: jetzt });
        const e = await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
        const s = await stand(gew);
        pruef("(iv) Fall 13458: assigned_agent_id bleibt NULL (nie 0)", s.assigned_agent_id === null && e.betreuer.agentId === null, JSON.stringify({ s: s.assigned_agent_id, e: e.betreuer }));
        pruef("(iv) Besitzschutz-Stempel bleibt erhalten", s.betreuung_seit != null);
      }
      // (v) keine Seite mit lebendem Agenten → Gewinner unangetastet
      {
        const gew = await lebt({ assigned_agent_id: G, betreuung_seit: jetzt });
        const verl = await lebt({ assigned_agent_id: T });
        const e = await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
        const s = await stand(gew);
        pruef("(v) Keiner lebt → Zuständigkeit des Gewinners unverändert", Number(s.assigned_agent_id) === G && e.betreuer.quelle === "keiner", JSON.stringify(e.betreuer));
      }
      // (vi) Werbesperre, Inkasso und Mandat
      {
        const frueh = new Date("2026-09-22T09:00:00Z");
        const gew = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verl = await lebt({ assigned_agent_id: A, werbung_gesperrt_am: frueh, inkasso_ab: frueh, inkasso_von: "Prüfstand", mandat_seit: frueh });
        await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
        const s = await stand(gew);
        pruef("(vi) Werbesperre des Verlierers gilt jetzt am Gewinner (UWG § 7)", s.werbung_gesperrt_am != null && new Date(s.werbung_gesperrt_am).getTime() === frueh.getTime());
        pruef("(vi) Forderungsmanagement wandert mit", s.inkasso_ab != null);
        pruef("(vi) Mandat wandert mit, weil derselbe Betreuer weitermacht", s.mandat_seit != null);
        const gew2 = await lebt({ werbung_gesperrt_am: new Date("2026-09-30T00:00:00Z") });
        const verl2 = await lebt({ werbung_gesperrt_am: frueh });
        await personenZusammenfuehren(verl2, gew2, {}, AKTEUR, { tx: lauf });
        pruef("(vi) Zwei Sperren → die FRÜHERE gilt", new Date((await stand(gew2)).werbung_gesperrt_am).getTime() === frueh.getTime());
        // Mandat beim gesperrten Verlierer, Gewinner aktiv → Mandat NICHT übertragen, Hinweis im Verlauf
        const gew3 = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const gew3Ref = await antrag(gew3);
        const verl3 = await lebt({ assigned_agent_id: G, mandat_seit: frueh, betreuung_seit: frueh });
        const e3 = await personenZusammenfuehren(verl3, gew3, {}, AKTEUR, { tx: lauf });
        const s3 = await stand(gew3);
        pruef("(vi) Mandat beim gesperrten Verlierer: Aktiv betreut, Mandat-Stempel NICHT übertragen", e3.betreuer.agentId === A && s3.mandat_seit === null, JSON.stringify({ b: e3.betreuer, m: s3.mandat_seit }));
        const [notiz] = (await tx`SELECT note FROM fiaon_contact_log WHERE ref = ${gew3Ref} AND outcome = 'person_merge' ORDER BY id DESC LIMIT 1`) as any[];
        pruef("(vi) Verlauf nennt Betreuung und Mandat-Hinweis", /Betreuung:/.test(notiz?.note ?? "") && /Mandat/.test(notiz?.note ?? ""), notiz?.note);
      }
      // (vi-b) Gegenprüfung 08.10.2026: Das Mandat folgt der QUELLE der Betreuung, nicht der Gewinner-Wahl.
      {
        const frueh = new Date("2026-08-24T09:00:00Z");
        // (a) Mandat am Gewinner beim GESPERRTEN Betreuer, Verlierer aktiv → Aktiv übernimmt OHNE Mandat
        const gewA = await lebt({ assigned_agent_id: G, mandat_seit: frueh, betreuung_seit: frueh });
        const verlA = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const eA = await personenZusammenfuehren(verlA, gewA, {}, AKTEUR, { tx: lauf });
        const sA = await stand(gewA);
        pruef("(vi-b a) Mandat am Gewinner (gesperrt), Aktiv übernimmt → mandat_seit NICHT bei Aktiv",
          eA.betreuer.agentId === A && sA.mandat_seit === null, JSON.stringify({ b: eA.betreuer.agentId, m: sA.mandat_seit }));
        pruef("(vi-b a) Hinweis: das Mandat geht nicht mit", eA.betreuer.hinweise.some((h) => /Mandat/.test(h) && /geht nicht mit/.test(h)), JSON.stringify(eA.betreuer.hinweise));
        // (b) gespiegelt: Mandat am Verlierer (gesperrt), Gewinner aktiv → ebenfalls kein Mandat
        const gewB = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verlB = await lebt({ assigned_agent_id: G, mandat_seit: frueh, betreuung_seit: frueh });
        await personenZusammenfuehren(verlB, gewB, {}, AKTEUR, { tx: lauf });
        pruef("(vi-b b) gespiegelt → dasselbe Ergebnis (kein Mandat)", (await stand(gewB)).mandat_seit === null);
        // (c) zwei aktive, Wahl „verlierer“: das Mandat von A wandert NICHT zu B
        const gewC = await lebt({ assigned_agent_id: A, mandat_seit: frueh, betreuung_seit: frueh });
        const verlC = await lebt({ assigned_agent_id: B, betreuung_seit: jetzt });
        const eC = await personenZusammenfuehren(verlC, gewC, { betreuer: "verlierer" }, AKTEUR, { tx: lauf });
        const sC = await stand(gewC);
        pruef("(vi-b c) Wahl „verlierer“: B betreut, Mandat von A NICHT bei B", Number(sC.assigned_agent_id) === B && sC.mandat_seit === null, JSON.stringify({ a: sC.assigned_agent_id, m: sC.mandat_seit }));
        pruef("(vi-b c) Hinweis nennt das Mandat, das nicht mitgeht", eC.betreuer.hinweise.some((h) => /Mandat/.test(h) && /geht nicht mit/.test(h)), JSON.stringify(eC.betreuer.hinweise));
        // (d) Wahl „verlierer“ mit Mandat am Verlierer → das Mandat des Verlierers gilt
        const gewD = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verlD = await lebt({ assigned_agent_id: B, mandat_seit: frueh, betreuung_seit: frueh });
        await personenZusammenfuehren(verlD, gewD, { betreuer: "verlierer" }, AKTEUR, { tx: lauf });
        const sD = await stand(gewD);
        pruef("(vi-b d) Wahl „verlierer“ mit dessen Mandat → Mandat bleibt bei B", Number(sD.assigned_agent_id) === B && sD.mandat_seit != null);
      }
      // (vi-c) Integrator 08.10.2026: Die Zuordnung der Bestellungen bleibt wie in der
      // Basis (Trigger 033 + stündlicher Angleich). Der Merge schreibt an den
      // Bestellungen keinen Mitarbeiter um und verspricht nichts darüber.
      {
        const agentVon = async (ref: string) => Number(((await tx`SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0]?.assigned_agent_id);
        // Streit, Wahl „gewinner“: kein Wechsel an der Person → der Merge lässt die Bestellung des Verlierers stehen
        const gew = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verl = await lebt({ assigned_agent_id: B, betreuung_seit: jetzt });
        const refV = await antrag(verl, { assigned_agent_id: B, payment_status: "paid" });
        const refG = await antrag(gew, { assigned_agent_id: A });
        const e = await personenZusammenfuehren(verl, gew, { betreuer: "gewinner" }, AKTEUR, { tx: lauf });
        pruef("(vi-c) Wahl „gewinner“: Merge selbst schreibt die Bestellung des Verlierers nicht um (wie Basis)", (await agentVon(refV)) === B, String(await agentVon(refV)));
        pruef("(vi-c) Bestellung des Gewinners bleibt bei A", (await agentVon(refG)) === A);
        pruef("(vi-c) Kein Hinweis verspricht „Provision bleibt beim Verkäufer“", !e.betreuer.hinweise.some((h) => /Provision|bleibt bei|bleiben bei/.test(h)), JSON.stringify(e.betreuer.hinweise));
        const [log] = (await tx`SELECT meta FROM fiaon_agent_events WHERE type = 'person_merge' AND meta LIKE ${`%"gewinnerId":${gew},%`} ORDER BY id DESC LIMIT 1`) as any[];
        pruef("(vi-c) Protokoll ohne „bestellungenBeimVerkaeufer“", !!log && !String(log.meta).includes("bestellungenBeimVerkaeufer"), log ? "" : "kein Protokoll gefunden");
        await kopieAngleich(gew);
        pruef("(vi-c) … nach dem stündlichen Angleich folgt sie dem Betreuer A (Basis-Verhalten)", (await agentVon(refV)) === A, String(await agentVon(refV)));
        // Streit, Wahl „verlierer“: der Trigger (033) zieht die Bestellungen der Person nach B
        const gew2 = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verl2 = await lebt({ assigned_agent_id: B, betreuung_seit: jetzt });
        const refG2 = await antrag(gew2, { assigned_agent_id: A, payment_status: "paid" });
        await personenZusammenfuehren(verl2, gew2, { betreuer: "verlierer" }, AKTEUR, { tx: lauf });
        pruef("(vi-c) Wahl „verlierer“: Person bei B, Bestellungen folgen über den Trigger (wie Basis)",
          Number((await stand(gew2)).assigned_agent_id) === B && (await agentVon(refG2)) === B, String(await agentVon(refG2)));
        // Gesperrter Gewinner, aktiver Verlierer: Aktiv übernimmt, Bestellungen folgen (Trigger)
        const gew3 = await lebt({ assigned_agent_id: G, betreuung_seit: jetzt });
        const verl3 = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const refG3 = await antrag(gew3, { assigned_agent_id: G });
        await personenZusammenfuehren(verl3, gew3, {}, AKTEUR, { tx: lauf });
        pruef("(vi-c) Gesperrter Gewinner: Aktiv übernimmt, Bestellung folgt über den Trigger (wie Basis)", (await agentVon(refG3)) === A, String(await agentVon(refG3)));
      }
      // (vi-d) Gegenprüfung 08.10.2026 (niedrig): Eine SCHON BESTEHENDE Konfliktmarke
      // (agentPruefen) bleibt nach dem Merge stehen — der Merge entscheidet sie nicht.
      {
        const gew = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt, agent_conflict: true });
        const verl = await lebt({ assigned_agent_id: I });
        await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
        const s = await stand(gew);
        pruef("(vi-d) Vorbestehender Konflikt bleibt nach dem Merge stehen", s.agent_conflict === true, JSON.stringify({ k: s.agent_conflict, q: s.quality_flags }));
        pruef("(vi-d) … und die Historie nennt beide Agenten", Array.isArray(s.quality_flags?.agents) && s.quality_flags.agents.includes(A) && s.quality_flags.agents.includes(I), JSON.stringify(s.quality_flags));
      }
      // (vii) Altbestand quality_flags als JSON-Text wird gelesen und als Objekt vereinigt
      {
        const gew = await lebt({ assigned_agent_id: A });
        await tx`UPDATE fiaon_persons SET quality_flags = to_jsonb(${JSON.stringify({ agents: [999] })}::text) WHERE id = ${gew}`;
        const verl = await lebt({ assigned_agent_id: B });
        await personenZusammenfuehren(verl, gew, { betreuer: "gewinner" }, AKTEUR, { tx: lauf });
        const s = await stand(gew);
        pruef("(vii) quality_flags aus Text-Altbestand: Objekt mit allen Agenten", Array.isArray(s.quality_flags?.agents) && [999, A, B].every((n) => s.quality_flags.agents.includes(n)), JSON.stringify(s.quality_flags));
      }
      // (viii) betreuerLage — dieselbe Regel für die Gegenüberstellung
      {
        const [pg] = (await tx`SELECT * FROM fiaon_persons WHERE id = ${await lebt({ assigned_agent_id: A })}`) as any[];
        const [pv] = (await tx`SELECT * FROM fiaon_persons WHERE id = ${await lebt({ assigned_agent_id: 0 as any, betreuung_seit: jetzt })}`) as any[];
        const l = await betreuerLage(pg, pv, lauf);
        pruef("(viii) betreuerLage: „Agent 0“ auf der anderen Seite → keine Wahl", !l.wahlNoetig && l.agentId === A, JSON.stringify(l));
        pruef("(viii) betreuerLage liefert die Seiten mit Klartext", l.seiten.verlierer.agentId === 0 && l.seiten.gewinner.agentName === `Aktiv ${marke}`);
      }
      // Merge darf weiterhin nichts verlieren — die alte Zählprobe läuft mit
      {
        const gew = await lebt({ assigned_agent_id: A, betreuung_seit: jetzt });
        const verl = await lebt({ betreuung_seit: jetzt });
        const r = await antrag(verl);
        await tx`INSERT INTO fiaon_contact_log (ref, agent_name, type, outcome, note) VALUES (${r}, 'Prüfstand', 'result', 'erreicht', 'vorher')`;
        const e = await personenZusammenfuehren(verl, gew, {}, AKTEUR, { tx: lauf });
        pruef("Zählprobe: Bestellungen und Verlauf vollständig", e.zaehlprobe.bestellungen.nachher === e.zaehlprobe.bestellungen.vorher && e.zaehlprobe.verlauf.nachher >= e.zaehlprobe.verlauf.vorher);
        const r2 = await akteAufloesen(String(verl), lauf);
        pruef("Nach dem Merge öffnet die Nummer des Verlierers die Akte des Gewinners", r2.ok && (r2.ziel as any).ref === r && r2.umleitungen.some((u) => u.grund === "person_zusammengefuehrt" && u.wer === "Prüfstand IT-E"), JSON.stringify(r2));
      }

      throw new Zurueckrollen();
    });
  } catch (err) {
    if (!(err instanceof Zurueckrollen)) { pruef("Teil 3 lief durch", false, (err as Error)?.message); console.error(err); }
  }
  const [rest] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE ${`%${marke}%`})::int AS p,
           (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`%${marke}%`})::int AS a,
           (SELECT COUNT(*) FROM fiaon_agents WHERE email LIKE ${`%${marke}%`})::int AS g`) as any[];
  pruef("Zurückgerollt: keine Testzeile ist geblieben", Number(rest.p) + Number(rest.a) + Number(rest.g) === 0, JSON.stringify(rest));
  await sqlPool.end();
}

// ═══════════════════════════════════════════════════════════════════════════
async function teil4(): Promise<void> {
  titel("TEIL 4 — Die Routen am lokalen Prüfserver (wie die Oberfläche sie ruft)");
  const basis = process.env.PRUEF_BASIS ?? "http://127.0.0.1:5315";
  const code = process.env.PRUEF_ADMIN_CODE ?? "";
  const geheim = process.env.PRUEF_GEHEIMNIS ?? "";
  const db = String(process.env.DATABASE_URL ?? "");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(basis) || !/@(127\.0\.0\.1|localhost)[:/]/.test(db) || !code || !geheim) {
    pruef("Teil 4 nur lokal: PRUEF_BASIS, lokale DATABASE_URL, PRUEF_ADMIN_CODE, PRUEF_GEHEIMNIS", false); return;
  }
  const postgres = (await import("postgres")).default;
  const sql = postgres(db, { ssl: "require", max: 1, onnotice: () => {} });
  const marke = `ITS${Date.now().toString(36).toUpperCase()}`;
  const ids: { personen: number[]; refs: string[]; leads: number[]; agenten: number[] } = { personen: [], refs: [], leads: [], agenten: [] };
  try {
    // Testdaten (lokal, werden am Ende entfernt)
    const agent = async (name: string, x: Record<string, unknown> = {}) => {
      const [r] = await sql`INSERT INTO fiaon_agents ${sql({ name: `${name} ${marke}`, email: `${name.toLowerCase()}-${marke}@it-e.invalid`, active: true, is_test_account: false, ...x } as any)} RETURNING id, session_epoch`;
      ids.agenten.push(Number(r.id)); return { id: Number(r.id), epoch: Number(r.session_epoch ?? 0) };
    };
    let nr = 0;
    const person = async (x: Record<string, unknown> = {}) => {
      const [r] = await sql`INSERT INTO fiaon_persons ${sql({ person_ref: `FIAON-P-${marke}${++nr}`, first_name: "Server", last_name: `Pruef${nr}`, primary_email: `s${nr}-${marke}@it-e.invalid`, ...x } as any)} RETURNING id`;
      ids.personen.push(Number(r.id)); return Number(r.id);
    };
    const antrag = async (personId: number, x: Record<string, unknown> = {}) => {
      const ref = `FIAON-${marke}-${++nr}`;
      await sql`INSERT INTO fiaon_applications ${sql({ ref, payment_reference: `FIAON${marke}${nr}`.slice(0, 24), person_id: personId, status: "completed", payment_status: "pending_payment", first_name: "Server", last_name: `Pruef${nr}`, email: `as${nr}-${marke}@it-e.invalid`, ...x } as any)}`;
      ids.refs.push(ref); return ref;
    };
    const lead = async (x: Record<string, unknown>) => {
      const [r] = await sql`INSERT INTO fiaon_leads ${sql({ vorname: "Server", nachname: `Lead${++nr}`, email: `ls${nr}-${marke}@it-e.invalid`, quelle: "pruefstand", ...x } as any)} RETURNING id`;
      ids.leads.push(Number(r.id)); return Number(r.id);
    };
    const A = await agent("Aktiv");
    const interessent = await person();
    const leadI = await lead({ person_id: interessent });
    const kopf = await person({ assigned_agent_id: A.id, betreuung_seit: new Date() });
    const kopfRef = await antrag(kopf);
    const verlierer = await person();
    await sql`UPDATE fiaon_persons SET merged_into_person_id = ${kopf}, account_status = 'merged' WHERE id = ${verlierer}`;
    const pool = await person({ betreuung_seit: new Date() });
    await antrag(pool);

    // Admin-Tor (nur lokaler Code)
    const tor = await fetch(`${basis}/api/fiaon/zugang/oeffnen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const keks = (tor.headers.get("set-cookie") ?? "").split(";")[0];
    pruef("Admin-Tor lokal geöffnet", tor.ok && keks.startsWith("fiaon_admin="), String(tor.status));
    const holen = async (pfad: string, init: RequestInit = {}) => {
      const r = await fetch(`${basis}/api/fiaon${pfad}`, { ...init, headers: { "Content-Type": "application/json", cookie: keks, ...(init.headers ?? {}) } });
      return { status: r.status, json: await r.json().catch(() => null) as any };
    };

    const a1 = await holen(`/admin/kunden/akte?id=${interessent}`);
    pruef("Route: Interessent öffnet (200) als Interessenten-Akte", a1.status === 200 && a1.json?.head?.id === `lead-${leadI}` && a1.json?.head?.personId === interessent, `${a1.status} ${JSON.stringify(a1.json?.head ?? a1.json)}`);
    pruef("Route: Antwort trägt Auflösung + Band", a1.json?.aufloesung?.kanonisch === `lead-${leadI}` && a1.json?.aufloesung?.umleitungen?.length === 1);
    pruef("Route: Lead der Person steht in der Akte", (a1.json?.leads ?? []).some((l: any) => Number(l.id) === leadI));
    const a2 = await holen(`/admin/kunden/akte?id=${verlierer}`);
    pruef("Route: gemergte Person öffnet den Kopf mit Band", a2.status === 200 && a2.json?.head?.id === kopfRef && a2.json?.aufloesung?.umleitungen?.[0]?.grund === "person_zusammengefuehrt", `${a2.status} ${JSON.stringify(a2.json?.aufloesung ?? a2.json)}`);
    const a3 = await holen(`/admin/kunden/akte?id=null`);
    pruef("Route: „?id=null“ → 400 mit Grund „kennung_leer“", a3.status === 400 && a3.json?.grund === "kennung_leer" && !!a3.json?.titel, `${a3.status} ${JSON.stringify(a3.json)}`);
    const a4 = await holen(`/admin/kunden/akte?id=987654321`);
    pruef("Route: unbekannte Nummer → 404 „person_fehlt“ mit Titel", a4.status === 404 && a4.json?.grund === "person_fehlt" && !!a4.json?.titel);
    const a5 = await fetch(`${basis}/api/fiaon/admin/kunden/akte?id=${interessent}`);
    pruef("Route: ohne Anmeldung 401/403 (die Seite sagt „Sitzung“, nicht „nicht gefunden“)", a5.status === 401 || a5.status === 403, String(a5.status));

    const k = await holen(`/chef/kunden?filter=pool&q=${encodeURIComponent(marke)}`);
    const zeile = (k.json?.zeilen ?? []).find((z: any) => Number(z.id) === interessent);
    pruef("Chef-Kundenliste: Interessent trägt „nur_interessent“", zeile?.nur_interessent === true, `${k.status} ${JSON.stringify(zeile ?? k.json?.error)}`);

    // Dubletten: Pool-Person (Stempel, kein Agent) und betreute Person → Lage ohne Wahl, Merge ohne Wahl
    const paar = await holen(`/admin/dubletten/paar/${kopf}/${pool}`);
    pruef("Gegenüberstellung: kein Streit, Lage „Aktiv betreut weiter“", paar.status === 200 && paar.json?.betreuerStreit === false && paar.json?.betreuerLage?.wennLinksBleibt?.agentId === A.id && paar.json?.betreuerLage?.wennRechtsBleibt?.agentId === A.id, `${paar.status} ${JSON.stringify(paar.json?.betreuerLage ?? paar.json)}`);
    pruef("Gegenüberstellung: Betreuer-Anzeige je Seite", paar.json?.links?.betreuerAnzeige === `Aktiv ${marke}` && paar.json?.rechts?.betreuerAnzeige === "ohne Betreuer");
    const m = await holen(`/admin/dubletten/zusammenfuehren`, { method: "POST", body: JSON.stringify({ gewinnerId: pool, verliererId: kopf }) });
    pruef("Merge über die Route OHNE Wahl: gelingt, Aktiv übernommen", m.status === 200 && m.json?.ergebnis?.betreuer?.agentId === A.id, `${m.status} ${JSON.stringify(m.json)}`);
    const abgelehnt = await holen(`/admin/dubletten/zusammenfuehren`, { method: "POST", body: JSON.stringify({ gewinnerId: pool, verliererId: kopf }) });
    pruef("Zweiter Versuch wird abgelehnt (schon gemergt)", abgelehnt.status === 400 && abgelehnt.json?.code === "bereits_gemergt");
    const [proto] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_agent_events WHERE type = 'person_merge_abgelehnt' AND meta LIKE ${`%"gewinnerId":${pool},%`}`;
    pruef("Ablehnung steht im Protokoll (person_merge_abgelehnt)", Number(proto?.n) >= 1);

    // Agenten-Akte: gemergte Nummer öffnet den Kopf. Gebraucht wird ein Konto der
    // Leitung mit abgeschlossenem Onboarding (Zustimmungen + unterschriebener
    // Vertrag) — sonst sperrt das Onboarding-Tor jede /agent-Route. Es wird ein
    // vorhandenes PRÜFKONTO der lokalen Kopie benutzt, nie ein echtes.
    const [L0] = await sql`
      SELECT a.id, a.session_epoch FROM fiaon_agents a
      WHERE a.active AND a.is_test_account AND a.rolle = 'vertriebsleiter'
        AND EXISTS (SELECT 1 FROM fiaon_agent_contracts k WHERE k.agent_id = a.id AND k.status = 'signed')
      ORDER BY a.id LIMIT 1`;
    pruef("Lokales Prüfkonto der Leitung mit abgeschlossenem Onboarding vorhanden", !!L0);
    const L = { id: Number(L0?.id ?? 0), epoch: Number(L0?.session_epoch ?? 0) };
    const exp = Date.now() + 10 * 60_000;
    const nutzlast = `${L.id}.${L.epoch}.${exp}`;
    const token = `${nutzlast}.${createHmac("sha256", geheim).update(`agent2:${nutzlast}`).digest("hex").slice(0, 40)}`;
    const ak = await fetch(`${basis}/api/fiaon/agent/crm/kunden/${kopf}`, { headers: { cookie: `fiaon_agent_token=${token}` } });
    const akJ = await ak.json().catch(() => null) as any;
    pruef("Agenten-Akte: Nummer des (jetzt) Verlierers öffnet den Kopf mit „aufgegangen“", ak.status === 200 && Number(akJ?.kunde?.personId) === pool && !!akJ?.kunde?.aufgegangen?.text, `${ak.status} ${JSON.stringify(akJ?.error ?? akJ?.kunde?.aufgegangen)}`);
    const li = await fetch(`${basis}/api/fiaon/agent/kunden/liste?filter=alle&sort=arbeit&limit=50&person=${kopf}`, { headers: { cookie: `fiaon_agent_token=${token}` } });
    const liJ = await li.json().catch(() => null) as any;
    pruef("Pipeline-Liste: Sprung auf den Verlierer liefert die Karte des Kopfs (keine Wegweiser-Karte)",
      li.status === 200 && (liJ?.kunden ?? []).some((k: any) => Number(k.personId) === pool) && !(liJ?.kunden ?? []).some((k: any) => Number(k.personId) === kopf),
      `${li.status} ${JSON.stringify((liJ?.kunden ?? []).map((k: any) => k.personId))}`);
    // Gegenprüfung 08.10.2026 (niedrig): Tausch auf die bezahlte Bestellung einer ANDEREN
    // Person (gleiche Telefon-Ziffern) → Band „bitte prüfen“, Adresse bleibt bei der eigenen.
    const tel = `+49151${String(Date.now()).slice(-7)}`;
    const eigen = await person({ primary_phone: tel });
    const eigenRef = await antrag(eigen, { phone: tel });
    const fremdP = await person({ primary_phone: tel });
    const fremdRef = await antrag(fremdP, { phone: tel, payment_status: "paid" });
    const af = await holen(`/admin/kunden/akte?id=${encodeURIComponent(eigenRef)}`);
    const umlF = (af.json?.aufloesung?.umleitungen ?? []) as any[];
    pruef("Route: fremde bezahlte Familien-Bestellung → Band „familie_kontaktgleich“, kanonisch bleibt die eigene",
      af.status === 200 && af.json?.aufloesung?.kanonisch === eigenRef && umlF.some((u) => u.grund === "familie_kontaktgleich" && u.nach === fremdRef),
      `${af.status} ${JSON.stringify(af.json?.aufloesung ?? af.json)}`);
    const ak2 = await fetch(`${basis}/api/fiaon/agent/crm/kunden/987654321`, { headers: { cookie: `fiaon_agent_token=${token}` } });
    const ak2J = await ak2.json().catch(() => null) as any;
    pruef("Agenten-Akte: unbekannte Nummer mit Grund „person_fehlt“", ak2.status === 404 && ak2J?.grund === "person_fehlt", JSON.stringify(ak2J));
  } catch (err) {
    pruef("Teil 4 lief durch", false, (err as Error)?.message);
  } finally {
    // Aufräumen — NUR lokal (oben geprüft), in umgekehrter Abhängigkeit.
    await sql`DELETE FROM fiaon_agent_events WHERE meta LIKE ${`%${marke}%`} OR reason LIKE ${`%${marke}%`} OR actor LIKE ${`%${marke}%`}`.catch(() => {});
    if (ids.personen.length) {
      await sql`DELETE FROM fiaon_agent_events WHERE type IN ('person_merge', 'person_merge_abgelehnt', 'person_owner_changed') AND (${sql.unsafe(ids.personen.map((i) => `meta LIKE '%${i}%'`).join(" OR "))})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${ids.refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${ids.personen}) OR quelle_person_id = ANY(${ids.personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${ids.refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_leads WHERE id = ANY(${ids.leads})`.catch(() => {});
    await sql`UPDATE fiaon_persons SET merged_into_person_id = NULL WHERE id = ANY(${ids.personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${ids.personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_agents WHERE id = ANY(${ids.agenten})`.catch(() => {});
    const [rest] = await sql`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE ${`%${marke}%`})::int + (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`%${marke}%`})::int AS n`;
    pruef("Teil 4 hat aufgeräumt (lokale Datenbank)", Number(rest?.n) === 0, JSON.stringify(rest));
    await sql.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log(`\n══ Prüfstand E-IT-E (Akte & Dubletten)${ROTPROBE ? " — ROTPROBE" : ""} ══`);
  teil1();
  if (!ROTPROBE) {
    teil2();
    await teil3();
    if (SERVER) await teil4();
  }
  console.log(`\n══ Ergebnis: ${ok} ok, ${rot} rot ══`);
  if (fehler.length) console.log(`   Rot: ${fehler.join(" · ")}`);
  process.exit(rot > 0 ? 1 : 0);
}
main().catch((e) => { console.error("[PRUEF-IT-E]", e); process.exit(1); });
