// ═══════════════════════════════════════════════════════════════════════════
// PFLEGE EINES GLOBAL-AUFTRAGS — Unterlagen, Fahrplan, Akte, Zahlungsfrist, Partner-Empfehlung (E-432, 28.10.2026)
//
// Justin (28.10.2026): „… update alles bei ihm — seine gesamten Unterlagen in den Tresor … einfach alles perfekt abwickeln und
// synchron halten, sodass alles Hand und Fuß hat!“
//
// EIN Auftrag (--ref), jede Aktion einzeln schaltbar. Vorgabe: NUR VORSCHAU — die Verbindung zur Datenbank ist dann auf
// „nur lesen“ gestellt (default_transaction_read_only), es kann nichts geschrieben werden. Geschrieben wird erst mit --schreiben
// (lokal) bzw. --schreiben --produktion. Jeder Schritt geht über die vorhandenen Plattform-Wege — nie rohes SQL, wo es einen gibt:
//
//   --tresor <ordner>             Unterlagen aus einem Ordner in den Tresor (globalMandatDokument): Art am Dateinamen erkannt
//                                 (Reisepass, Personalausweis Vorder-/Rückseite, Gehalts-/Einkommensnachweis JJJJ-MM, Kontoauszug
//                                 JJJJ-MM, Adressnachweis), Metadaten entfernt (EXIF/XMP/Info; ein signiertes PDF bleibt
//                                 unverändert), OHNE Mail. Sichtbar für den Kunden NUR, wenn sein Konto aktiv ist (sonst öffnete der
//                                 Link aus der Vertragsbestätigung die Dateien ohne Anmeldung) — sonst intern, später im Chefbüro
//                                 sichtbar schalten (globalMandatDokumentAendern). Nie doppelt: gleicher Inhalt oder gleicher
//                                 Titel im Tresor → übersprungen. Versteckte Dateien (.…) und Unbekanntes bleiben liegen.
//   --name-geprueft <JJJJ-MM-TT>  Fahrplan-Station „Name geprüft“ auf erledigt mit Datum (globalStationSpeichern, vor der Zahlung
//     [--beleg "<text>"]          erlaubt); der Beleg steht intern (Vorgabe „Sunbiz TT.MM.JJJJ: frei“). Der Merker „geprüft“
//                                 springt mit — die Zahlungsseite sagt danach „Name geprüft“ statt „Wunschname vorgemerkt“.
//   --akte <privat.json>          fehlende Personendaten aus der privaten Angebotsdatei (kunde.*): Person an die Akte, Anrede und
//                                 Staatsangehörigkeit an die Person, Staatsangehörigkeit und Reisepass (Nummer, gültig bis) an die
//                                 Bestellung — nur LEERE Felder, nie überschreiben; die Datei muss zum Auftrag passen (E-Mail/Name).
//   --faellig <JJJJ-MM-TT>        Zahlungsfrist der offenen Rechnung (zahlungsfristSetzen, wie Verwaltungsakte › Konditionen) —
//                                 NUR, wenn der Vertrag sie trägt: nie vor dem spätesten Zahltag laut Vertrag (Rechnung +
//                                 Zahlungsziel des Angebotsteils). Früher wäre eine Vertragsänderung zu Lasten des Kunden
//                                 (§ 271 Abs. 2 BGB; Änderungen nur in Textform) — dann lehnt das Skript ab und sagt, warum.
//   --empfehlung <id>             eine Partner-Empfehlung (fiaon_koop_empfehlungen) der Person dieses Auftrags zuordnen
//                                 (koopEmpfehlungAendern) — nur, wenn der Name der Empfehlung zur Person passt.
//   --agent <id>                  wer handelt (fiaon_agents.id, z. B. das Konto der Leitung) — steht im internen Verlauf.
//
// Wiederholbar: Ein zweiter Lauf findet alles erledigt und schreibt nichts. Am Ende eine Zeile „ERGEBNIS {…}“; Exit 1, wenn ein
// verlangter Schritt abgelehnt wurde oder scheiterte.
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   Vorschau gegen die Produktion (Verbindung nur lesend, ohne die Adresse auszugeben):
//     sh ~/Developer/it-rettung/werkzeuge/ro-env.sh node_modules/.bin/tsx scripts/global-auftrag-pflegen.ts --produktion \
//       --ref FIAON-… --agent <id> --tresor <ordner> --name-geprueft JJJJ-MM-TT --akte <privat.json> --empfehlung <id>
//   Schreiben (nur mit Justins Go, nach dem Deploy, ARAS-Wache vorher): dieselben Schalter plus --schreiben, DATABASE_URL ohne
//   den Nur-Lesen-Zusatz.
//   Lokal (Prüfstand): DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_… … --schreiben
//
// Das Repo ist öffentlich: Hier steht kein Kundendatum. Namen, Ausweise und Dateien kommen nur aus den Pfaden, die der Aufruf
// nennt; die Ausgabe zeigt Ausweiswerte nur maskiert. Mails, Webhooks und Netz sind in diesem Lauf abgeklemmt.
// Prüfstand: scripts/pruef-global-auftrag-pflegen.ts (lokale Prüf-Datenbank).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// ── Schalter ─────────────────────────────────────────────────────────────────
const MIT_WERT = ["--ref", "--tresor", "--name-geprueft", "--beleg", "--akte", "--faellig", "--empfehlung", "--agent"];
const OHNE_WERT = ["--schreiben", "--produktion"];
const argv = process.argv.slice(2);
const werte = new Map<string, string>();
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (MIT_WERT.includes(a)) {
    const w = argv[i + 1];
    if (w === undefined || w.startsWith("--")) abbruch(`${a} braucht einen Wert.`);
    werte.set(a, String(w)); i++;
  } else if (OHNE_WERT.includes(a)) schalter.add(a);
  else abbruch(`Unbekannter Schalter „${a}“ (erlaubt: ${[...MIT_WERT, ...OHNE_WERT].join(", ")}).`);
}
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

const ref = String(werte.get("--ref") ?? "").trim().toUpperCase();
if (!/^FIAON-[A-Z0-9]+-[A-Z0-9]+$/.test(ref)) abbruch("--ref FIAON-… fehlt oder hat nicht die Form einer Auftragsnummer.");
const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const tresorOrdner = werte.get("--tresor") ?? null;
const nameTag = werte.get("--name-geprueft") ?? null;
const akteDatei = werte.get("--akte") ?? null;
const faelligTag = werte.get("--faellig") ?? null;
const empfehlungRoh = werte.get("--empfehlung") ?? null;
const agentRoh = werte.get("--agent") ?? null;
if (nameTag && !ISO.test(nameTag)) abbruch("--name-geprueft: Datum als JJJJ-MM-TT.");
if (faelligTag && !ISO.test(faelligTag)) abbruch("--faellig: Datum als JJJJ-MM-TT.");
if (empfehlungRoh && !/^\d{1,9}$/.test(empfehlungRoh)) abbruch("--empfehlung: die Nummer der Empfehlung (Zahl).");
if (agentRoh && !/^\d{1,9}$/.test(agentRoh)) abbruch("--agent: die Nummer des Mitarbeiterkontos (Zahl).");
if (werte.has("--beleg") && !nameTag) abbruch("--beleg gehört zu --name-geprueft.");
if (!tresorOrdner && !nameTag && !akteDatei && !faelligTag && !empfehlungRoh) abbruch("Keine Aktion gewählt (--tresor, --name-geprueft, --akte, --faellig, --empfehlung).");
if (tresorOrdner && !fs.existsSync(tresorOrdner)) abbruch(`--tresor: Ordner „${tresorOrdner}“ gibt es nicht.`);
if (akteDatei && !fs.existsSync(akteDatei)) abbruch(`--akte: Datei „${akteDatei}“ gibt es nicht.`);

// ── Sicherheit: wohin, und was ist abgeklemmt ────────────────────────────────
let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = ""; let dbName = "";
try { const u = new URL(url); host = u.hostname; dbName = u.pathname.replace(/^\//, ""); } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch(`DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion${schreiben ? " (und Justins Go)" : ""}.`);
if (lokal && produktion) abbruch("--produktion, aber DATABASE_URL zeigt auf 127.0.0.1/localhost — bitte prüfen.");
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) abbruch("Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten.");
// Ein Tunnel zur Produktion auf 127.0.0.1 sähe „lokal“ aus — lokal geschrieben wird nur in eine Prüf-DB.
if (schreiben && lokal && !/^fiaon_pruefstand_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB (Name fiaon_pruefstand_…), nicht in „${dbName}“.`);
// Kein Schritt dieses Laufs verschickt etwas — die Wege werden trotzdem abgeklemmt (eine Mail an den Kunden ginge nie still raus).
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async (eingabe: unknown) => { throw new Error(`Pflege-Skript: kein Netz (${String((eingabe as any)?.url ?? eingabe).slice(0, 60)})`); }) as typeof fetch;
// Vorschau: Die Verbindung selbst ist „nur lesen“ — ein Fehler im Skript kann nichts schreiben.
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const { sqlPool } = await import("../server/lib/db-pool");
const P = await import("../server/lib/fiaon-global-pflege");
const SM = await import("../shared/fiaon-global-mandat");
const SB = await import("../shared/fiaon-global-bereich");
const { berlinToday } = await import("../server/lib/fiaon-time");

type Stand = "neu" | "schon" | "nein" | "fehler";
const zaehler: Record<Stand, number> = { neu: 0, schon: 0, nein: 0, fehler: 0 };
const MARKE: Record<Stand, string> = { neu: schreiben ? "[erledigt]" : "[neu]     ", schon: "[schon da]", nein: "[abgelehnt]", fehler: "[FEHLER]  " };
const zeile = (s: Stand | "bleibt", text: string) => { console.log(`  ${s === "bleibt" ? "[bleibt]   " : MARKE[s]} ${text}`); };
const schritt = (s: Stand) => { zaehler[s]++; };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const tagText = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
const jsonLesen = (v: unknown): Record<string, any> => {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as Record<string, any>;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) ?? {}; } catch { return {}; }
};

// ── Der Auftrag (nur lesen) ──────────────────────────────────────────────────
const [akte] = (await sqlPool`
  SELECT ref, status, paket_key, person_id, vertrag_version, gesellschaft, jsonb_typeof(gesellschaft) AS ges_typ, angebot_id
    FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`.catch((e: unknown) => abbruch(`Akte nicht lesbar: ${e instanceof Error ? e.message : e}`))) as any[];
if (!akte) abbruch(`Den Auftrag ${ref} gibt es nicht.`);
const [bestellung] = (await sqlPool`
  SELECT person_id, payment_status, payment_due_date, invoice_number, invoice_date FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
let agent = { id: 0, name: "Chefbüro (Pflege-Skript)" };
if (agentRoh) {
  const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${Number(agentRoh)} LIMIT 1`) as any[];
  if (!a) abbruch(`--agent ${agentRoh}: dieses Mitarbeiterkonto gibt es nicht.`);
  agent = { id: Number(a.id), name: String(a.name || `Konto ${a.id}`) };
}
const ges = jsonLesen(akte.gesellschaft);
const personId = bestellung?.person_id != null ? Number(bestellung.person_id) : akte.person_id != null ? Number(akte.person_id) : null;
console.log("FIAON Global — Pflege eines Auftrags (E-432)");
console.log(`Auftrag   ${ref} · Status ${akte.status} · Paket ${akte.paket_key} · Person ${personId ?? "—"} · Bundesstaat ${ges.bundesstaat ?? "—"}${akte.ges_typ === "string" ? " · Gesellschaft als JSON-Text gespeichert" : ""}`);
console.log(`Rechnung  ${bestellung?.invoice_number ?? "—"} · ${bestellung?.payment_status ?? "—"} · zahlbar bis ${bestellung?.payment_due_date ? tagText(berlinToday(new Date(bestellung.payment_due_date))) : "—"}`);
console.log(`Datenbank ${lokal ? `lokal (${dbName})` : "PRODUKTION"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"} · handelnd: ${agent.name}${agent.id ? ` (#${agent.id})` : ""}`);

// Schreibwege erst laden, wenn geschrieben wird (sie legen beim ersten Gebrauch ihre Tabellen an — in der Vorschau nie).
const M = schreiben ? await import("../server/lib/fiaon-global-mandat") : null;

// ═══ 1 AKTE: PERSONENDATEN ═══════════════════════════════════════════════════
if (akteDatei) {
  abschnitt("1 Akte: fehlende Personendaten nachtragen");
  try {
    const roh = JSON.parse(fs.readFileSync(akteDatei, "utf8"));
    const quelle = (roh?.kunde && typeof roh.kunde === "object" ? roh.kunde : roh) as Record<string, unknown>;
    const r = await P.globalAkteNachtragen(ref, quelle, { schreiben, agent });
    if (!r.ok) { zeile("nein", r.error); schritt("nein"); }
    else {
      for (const z of r.zeilen) {
        const s: Stand = z.stand === "neu" ? "neu" : "schon";
        const art = z.stand === "da" ? "steht schon" : z.stand === "fehlt" ? "leer — auch die Datei hat nichts" : z.stand === "hand" ? (z.anzeige ?? "nicht automatisch") : `leer → ${z.anzeige ?? "nachgetragen"}`;
        zeile(s, `${z.wo} · ${z.feld}: ${art}`);
      }
      const neu = r.zeilen.filter((z) => z.stand === "neu").length;
      schritt(neu ? "neu" : "schon");
      if (schreiben) console.log(`  → ${r.geschrieben} Feld(er) geschrieben${r.geschrieben ? "; interne Verlaufszeile in der Akte" : ""}.`);
    }
  } catch (e) { zeile("fehler", `Akte: ${e instanceof Error ? e.message : String(e)}`); schritt("fehler"); }
}

// ═══ 2 TRESOR ════════════════════════════════════════════════════════════════
if (tresorOrdner) {
  const namen = fs.readdirSync(tresorOrdner).filter((n) => !n.startsWith(".") && fs.statSync(path.join(tresorOrdner, n)).isFile()).sort((a, b) => a.localeCompare(b, "de"));
  const versteckt = fs.readdirSync(tresorOrdner).filter((n) => n.startsWith(".")).length;
  abschnitt(`2 Tresor: ${namen.length} Datei(en)${versteckt ? ` (+${versteckt} versteckte, bleiben liegen)` : ""}`);
  try {
    // Sichtbar nur hinter einem AKTIVEN Konto (Gutachten 28.10.2026): ohne Anmeldung öffnet der Link aus der Vertragsbestätigung
    // das Portal — und mit ihm jedes sichtbare Dokument und das ZIP.
    const { refAktivesKonto } = await import("../server/lib/fiaon-global-konto");
    const kontoAktiv = !!(await refAktivesKonto(ref).catch(() => null));
    const sichtbarText = kontoAktiv ? "für den Kunden sichtbar, ohne Mail" : "INTERN (Kunde hat noch kein aktives Konto — sichtbar schalten, sobald er sich angemeldet hat), ohne Mail";
    const vorhanden = (await sqlPool`
      SELECT id, art, titel, doc_hash FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL ORDER BY id`.catch(() => [])) as any[];
    const geplant: { name: string; art: string; titel: string; dateiname: string; daten: Buffer; hash: string }[] = [];
    let gelesen = 0; let probleme = 0; let liegen = 0;
    for (const name of namen) {
      const e = P.unterlageErkennen(name);
      // Keine Unterlage nach Name (Notiz, Lesebild …): bleibt liegen — kein Fehler, aber sichtbar.
      if (!e) { zeile("bleibt", `${name}: Art nicht erkannt — bleibt liegen (Dateiname mit Reisepass, Personalausweis, Gehaltsnachweis, Kontoauszug oder Adressnachweis)`); liegen++; continue; }
      let b: Awaited<ReturnType<typeof P.unterlageOhneMetadaten>>;
      try { b = await P.unterlageOhneMetadaten(fs.readFileSync(path.join(tresorOrdner, name)), name); }
      catch (err) { zeile("nein", err instanceof Error ? err.message : String(err)); probleme++; continue; }
      gelesen++;
      const hash = createHash("sha256").update(b.daten).digest("hex");
      const mappe = SM.globalTresorTitel(SM.globalTresorKategorie(e.art));
      const meta = b.unveraendert ? b.unveraendert : b.entfernt.length ? `Metadaten entfernt: ${b.entfernt.join(", ")}` : "keine Metadaten gefunden";
      const kopf = `${name} → „${e.titel}“ (${SB.globalDokumentArtText(e.art)} · Mappe „${mappe}“) · ${b.typ.endung.toUpperCase()} ${kb(b.daten.length)} · ${meta}`;
      const gleich = vorhanden.find((d) => d.doc_hash === hash) ?? geplant.find((d) => d.hash === hash);
      const gleicherTitel = vorhanden.find((d) => d.art === e.art && String(d.titel ?? "") === e.titel) ?? geplant.find((d) => d.art === e.art && d.titel === e.titel);
      if (gleich) { zeile("schon", `${kopf} — genau diese Datei liegt schon im Tresor${"id" in gleich ? ` (#${gleich.id})` : " (doppelt im Ordner)"}`); continue; }
      if (gleicherTitel) { zeile("schon", `${kopf} — „${e.titel}“ liegt schon im Tresor${"id" in gleicherTitel ? ` (#${gleicherTitel.id})` : " (doppelt im Ordner)"}, andere Datei: übersprungen (bei Bedarf die alte Fassung im Chefbüro entfernen)`); continue; }
      geplant.push({ name, art: e.art, titel: e.titel, dateiname: `${e.dateiname}.${b.typ.endung}`, daten: b.daten, hash });
      if (!schreiben) zeile("neu", `${kopf} — ${sichtbarText}`);
    }
    if (schreiben && M) {
      for (const g of geplant) {
        const r = await M.globalMandatDokument(ref, { art: g.art, datei: { buffer: g.daten, originalname: g.dateiname }, titel: g.titel, sichtbar: kontoAktiv, mitteilen: false, unterschrift: false }, agent);
        if (!r.ok) { zeile("fehler", `${g.name}: ${r.error}`); probleme++; continue; }
        zeile(/liegt schon/.test(r.meldung) ? "schon" : "neu", `${g.name} → „${g.titel}“ (#${r.id}) — ${r.meldung}`);
      }
    }
    console.log(`  → ${gelesen} gelesen und bereinigt, ${geplant.length} ${schreiben ? "abgelegt" : "neu abzulegen"}, ${probleme} abgelehnt, ${liegen} ohne erkannte Art liegen geblieben.`);
    schritt(probleme ? "nein" : geplant.length ? "neu" : "schon");
  } catch (e) { zeile("fehler", `Tresor: ${e instanceof Error ? e.message : String(e)}`); schritt("fehler"); }
}

// ═══ 3 FAHRPLAN: „NAME GEPRÜFT“ ═══════════════════════════════════════════════
if (nameTag) {
  abschnitt("3 Fahrplan: „Name geprüft“");
  try {
    const beleg = String(werte.get("--beleg") ?? `Sunbiz ${tagText(nameTag)}: frei`).replace(/\s+/g, " ").trim().slice(0, 600);
    const staat = String(ges.bundesstaat ?? "").toUpperCase();
    const [st] = (await sqlPool`SELECT status, datum, intern FROM fiaon_global_schritte WHERE ref = ${ref} AND schluessel = 'name' LIMIT 1`.catch(() => [])) as any[];
    const altStatus = st ? String(st.status) : "offen";
    const altDatum = st?.datum ? berlinToday(new Date(st.datum)) : null;
    const geprueft = ges.geprueft === true || ges.geprueft === undefined;
    if (!ges.name) { zeile("nein", "In der Akte steht noch kein Name der Gesellschaft — zuerst den Namen eintragen."); schritt("nein"); }
    else if (nameTag > berlinToday()) { zeile("nein", `Das Datum ${tagText(nameTag)} liegt in der Zukunft.`); schritt("nein"); }
    else if (/sunbiz/i.test(beleg) && staat && staat !== "FL" && staat !== "FLORIDA") { zeile("nein", `Sunbiz ist das Register von Florida — die Akte nennt ${staat}. Bitte den Beleg prüfen.`); schritt("nein"); }
    else if (altStatus === "erledigt" && altDatum === nameTag && String(st?.intern ?? "") === beleg && ges.geprueft !== false) {
      zeile("schon", `erledigt am ${tagText(nameTag)} · Beleg (intern) „${beleg}“ · geprüft: ja`); schritt("schon");
    } else if (!schreiben) {
      zeile("neu", `${altStatus} → erledigt am ${tagText(nameTag)} · Beleg (intern) „${beleg}“ · Merker „geprüft“: ${geprueft ? "ja" : "nein → ja"}${akte.ges_typ === "string" ? " (JSON-Text wird dabei zum Objekt)" : ""}`);
      zeile("neu", "Der Kunde liest im Verlauf „Erledigt: Name geprüft.“; die Zahlungsseite zeigt „Name geprüft“ statt „Wunschname vorgemerkt“.");
      schritt("neu");
    } else if (M) {
      const r = await M.globalStationSpeichern(ref, { schluessel: "name", status: "erledigt", datum: nameTag, intern: beleg }, agent, { vorZahlung: true });
      if (!r.ok) { zeile("fehler", `Station: ${r.error}`); schritt("fehler"); }
      else {
        const [nach] = (await sqlPool`SELECT gesellschaft, jsonb_typeof(gesellschaft) AS typ FROM fiaon_global_auftraege WHERE ref = ${ref}`) as any[];
        const g2 = jsonLesen(nach?.gesellschaft);
        zeile(g2.geprueft === true ? "neu" : "fehler", `${r.meldung} · Merker „geprüft“: ${g2.geprueft === true ? "ja" : "NEIN"} (gespeichert als ${nach?.typ})`);
        schritt(g2.geprueft === true ? "neu" : "fehler");
      }
    }
  } catch (e) { zeile("fehler", `Name geprüft: ${e instanceof Error ? e.message : String(e)}`); schritt("fehler"); }
}

// ═══ 4 ZAHLUNGSFRIST DER OFFENEN RECHNUNG ═════════════════════════════════════
if (faelligTag) {
  abschnitt("4 Zahlungsfrist der offenen Rechnung");
  try {
    const vf = await P.globalVertragsfrist(ref);
    const status = String(bestellung?.payment_status ?? "");
    const jetzt = bestellung?.payment_due_date ? berlinToday(new Date(bestellung.payment_due_date)) : null;
    if (!bestellung) { zeile("nein", "Keine Bestellzeile zu diesem Auftrag."); schritt("nein"); }
    else if (!["pending_payment", "claimed_paid", "expired"].includes(status)) { zeile("nein", `Die Rechnung ist ${status || "ohne Status"} — eine Frist gibt es nur bei offenen Rechnungen.`); schritt("nein"); }
    else if (!vf) { zeile("nein", "An dieser Bestellung hängt kein angenommener Angebotsteil — die Frist steht nicht in einem Vertrag, den dieses Skript prüfen kann. Bitte in der Verwaltungsakte › Konditionen setzen."); schritt("nein"); }
    else if (faelligTag < vf.spaetesterTag) {
      zeile("nein", `Laut Vertrag (${vf.angebotRef}, Teil ${vf.teilNr}) ist die Rechnung vom ${tagText(vf.rechnungTag)} zahlbar ${vf.tage === 0 ? "sofort" : `binnen ${vf.tage} Tagen`} — spätester Zahltag ${tagText(vf.spaetesterTag)}.`);
      zeile("nein", `Ein früherer Tag (${tagText(faelligTag)}) wäre eine Vertragsänderung zu Lasten des Kunden: FIAON kann die Zahlung nicht vor dem vereinbarten Tag verlangen (§ 271 Abs. 2 BGB), Änderungen nur in Textform mit ihm. Nichts geändert.`);
      zeile("nein", "Fällig ist der Betrag trotzdem schon mit dem Auftrag — die Zahlungsseite sagt deshalb „bitte jetzt überweisen, spätestens bis …“.");
      schritt("nein");
    } else if (jetzt === faelligTag) { zeile("schon", `zahlbar bis ${tagText(faelligTag)} — steht schon so.`); schritt("schon"); }
    else if (!schreiben) { zeile("neu", `zahlbar bis ${jetzt ? tagText(jetzt) : "—"} → ${tagText(faelligTag)} (Ende des Tages, Berlin) — zugunsten des Kunden, der Vertrag trägt das; keine Mail.`); schritt("neu"); }
    else {
      const { zahlungsfristSetzen } = await import("../server/lib/fiaon-zahlungsfrist");
      const r = await zahlungsfristSetzen(ref, faelligTag, { wer: agent.name, grund: "Pflege-Skript (E-432)" });
      if (!r.ok) { zeile("fehler", r.error); schritt("fehler"); }
      else { zeile(r.geaendert ? "neu" : "schon", r.geaendert ? `zahlbar bis ${r.von} → ${r.nach} (Protokoll in der Akte)` : `steht schon auf ${r.nach}`); schritt(r.geaendert ? "neu" : "schon"); }
    }
  } catch (e) { zeile("fehler", `Zahlungsfrist: ${e instanceof Error ? e.message : String(e)}`); schritt("fehler"); }
}

// ═══ 5 PARTNER-EMPFEHLUNG ZUORDNEN ═════════════════════════════════════════════
if (empfehlungRoh) {
  abschnitt("5 Partner-Empfehlung zuordnen");
  try {
    const eid = Number(empfehlungRoh);
    const [e] = (await sqlPool`
      SELECT e.id, e.angebot_id, e.person_id, e.name, e.entfernt_am, a.angebot_ref, a.fassung, a.status
        FROM fiaon_koop_empfehlungen e LEFT JOIN fiaon_global_angebote a ON a.id = e.angebot_id
       WHERE e.id = ${eid} LIMIT 1`.catch(() => [])) as any[];
    const [p] = personId ? ((await sqlPool`SELECT first_name, last_name, company_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[]) : [];
    const nameNorm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    const empfName = new Set(nameNorm(e?.name).split(" ").filter((x) => x.length >= 2));
    const persName = new Set(nameNorm(`${p?.first_name ?? ""} ${p?.last_name ?? ""}`).split(" ").filter((x) => x.length >= 2));
    const namePasst = empfName.size > 0 && [...empfName].every((x) => persName.has(x)) && [...persName].every((x) => empfName.has(x));
    if (!e || e.entfernt_am) { zeile("nein", `Die Empfehlung ${eid} gibt es nicht (mehr).`); schritt("nein"); }
    else if (!String(e.fassung ?? "").startsWith("IA-KOOP-")) { zeile("nein", `Die Empfehlung ${eid} hängt an keinem Kooperationsvertrag.`); schritt("nein"); }
    else if (!personId) { zeile("nein", "Der Auftrag hat (noch) keine Person — erst die Bestellung an die Person binden."); schritt("nein"); }
    else if (e.person_id != null && Number(e.person_id) === personId) { zeile("schon", `Empfehlung ${eid} (Kooperation ${e.angebot_ref}) ist schon Person ${personId} zugeordnet.`); schritt("schon"); }
    else if (e.person_id != null) { zeile("nein", `Empfehlung ${eid} gehört schon zu Person ${e.person_id} — nichts geändert.`); schritt("nein"); }
    else if (!namePasst) { zeile("nein", `Der Name der Empfehlung ${eid} passt nicht zu Person ${personId} — bitte im Chefbüro prüfen. Nichts geändert.`); schritt("nein"); }
    else if (!schreiben) { zeile("neu", `Empfehlung ${eid} (Kooperation ${e.angebot_ref}): Person — → ${personId} · Name passt · danach „im Gespräch“, mit der bankbestätigten Zahlung „Kunde“; keine Mail an den Partner.`); schritt("neu"); }
    else {
      const { angebotLesen } = await import("../server/lib/fiaon-global-angebot");
      const { koopEmpfehlungAendern } = await import("../server/lib/fiaon-koop-empfehlung");
      const z = await angebotLesen({ id: Number(e.angebot_id) });
      const r = z ? await koopEmpfehlungAendern(z, eid, { personId }, agent.name) : { ok: false as const, error: "Kooperationsvertrag nicht lesbar." };
      if (!r.ok) { zeile("fehler", (r as any).error ?? "unbekannt"); schritt("fehler"); }
      else { zeile("neu", `Empfehlung ${eid} (Kooperation ${e.angebot_ref}) → Person ${personId} zugeordnet (Verlauf am Kooperationsvertrag).`); schritt("neu"); }
    }
  } catch (e) { zeile("fehler", `Empfehlung: ${e instanceof Error ? e.message : String(e)}`); schritt("fehler"); }
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────
console.log("");
console.log(schreiben
  ? `Geschrieben (${lokal ? "lokal" : "PRODUKTION"}). Ein zweiter Lauf findet alles erledigt.`
  : `Nur Vorschau — nichts geschrieben. Schreiben mit --schreiben${lokal ? "" : " --produktion (nur mit Justins Go)"}.`);
console.log(`ERGEBNIS ${JSON.stringify({ ref, geschrieben: schreiben, ...zaehler })}`);
await sqlPool.end({ timeout: 5 }).catch(() => {});
process.exit(zaehler.nein || zaehler.fehler ? 1 : 0);
