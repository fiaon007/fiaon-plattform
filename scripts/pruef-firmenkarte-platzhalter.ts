// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-487 Nachtrag (16.11.2026): PLATZHALTER IM FIRMENFELD — DIE EINE ZUORDNUNG UND DIE EINMAL-REPARATUR DER KARTE #34
//
//   A  REIN (immer, ohne Datenbank, ohne Netz):
//      A1 leadMerkmale/gleicherLead — Platzhalter („Selbständig“, „GmbH“, „noch offen“, „-“, der eigene Name …) verbinden nie,
//         ein echter Firmenname mit Rechtsform schon; „Selbständig + andere Nummer → neue Karte“.
//      A2 Nummern — „+49 152…“ = „0152…“ = „152…“ (ohne Ländervorwahl) = „+49 (0) 152…“ → dieselbe Karte; Österreich ebenso;
//         Fantasienummern und zu kurze Nummern verbinden nie; Mails ohne „@“ verbinden nie.
//      A3 Die Vorprüfung der Einmal-Reparatur (reparaturPruefen): erwarteter Zustand → trennen; jede Abweichung → nichts.
//      A4 Quelltext-Wände: der Eingang und alle „Karte zur Anfrage“ gehen durch die EINE Zuordnung; die Reparatur hängt vor
//         dem Lauf, schreibt nur über gruppeTrennen und löscht nichts.
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): die Karte #34 so, wie sie
//      in der Produktion liegt (mit den echten Kennungen, aber erfundenen Menschen); Abweichung → nichts; Schalter aus → nichts;
//      echte Reparatur trennt #68 auf eine neue Karte und #77 auf #52, #61 bleibt; zweiter Lauf = nichts; die Zuordnung
//      findet danach die richtigen Karten; der echte Eingang legt „Selbständig“ nie wieder zusammen.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-firmenkarte-platzhalter.ts   (nur A)
//   createdb -T fiaon_pruefstand fiaon_pruefstand_fk …; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_fk?sslmode=require'   (A + B), danach dropdb.
//
// Verschickt nichts. Repo öffentlich: nur erfundene Menschen (*.example), nur Kennungen.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN", "GMAIL_SERVICE_ACCOUNT_JSON"]) {
  if (process.env[k] && process.env[k] !== "pruef") { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const G = await import("../shared/fiaon-global-lead");
const R = await import("../shared/fiaon-firmenkarte-reparatur");
const { leadMerkmale: M, gleicherLead } = G;

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 Platzhalter im Firmenfeld verbinden nie — echte Firmen schon");
{
  const eva = { email: "eva@e.example", telefon: "+49 151 2345 6781", name: "Eva Eigner" };
  const fritz = { email: "fritz@f.example", telefon: "+49 159 0654 3212", name: "Fritz Fremd" };
  const platzhalter = [
    "Selbständig", "Selbstständig", "selbstständig", "Selbständig / Freiberufler", "Privatperson · Fritz Fremd", "Fritz Fremd (Firma noch offen)",
    "GmbH", "UG", "UG (haftungsbeschränkt)", "noch offen", "Noch offen", ".", "-", "--", "Firma", "keine", "privat", "", "   ", "Fritz Fremd", "Fremd Fritz",
    "Kleingewerbe", "Immobilien", "Einzelunternehmen", "Freiberufler", "Inhaber", "Siehe oben", "Mehrere Firmen", "Selbständig GmbH i. G.",
  ];
  for (const f of platzhalter) {
    ok(M({ firma: f, name: fritz.name }).firmaName === "", `„${f}“ ist kein Firmenname, der verbindet`);
    ok(gleicherLead(M({ ...eva, firma: f }), M({ ...fritz, firma: f })) === null, `„${f}“ + andere Mail + andere Nummer → neue Karte`);
  }
  gleich(gleicherLead(M({ ...eva, firma: "Selbständig" }), M({ ...fritz, firma: "Selbständig" })), null, "Selbständig + andere Nummer → neue Karte (der Fall #61/#68/#77)");
  gleich(gleicherLead(M({ ...eva, firma: "Muster Logistik GmbH" }), M({ ...fritz, firma: "Muster Logistik GmbH" })), "firma", "zwei Menschen derselben echten Firma (mit Rechtsform) → dieselbe Karte");
  gleich(gleicherLead(M({ ...eva, firma: "Muster Logistik GmbH" }), M({ ...fritz, firma: "Andere Logistik GmbH" })), null, "andere echte Firma → neue Karte");
  gleich(M({ firma: "  Muster Logistik GmbH ", name: "Eva Eigner" }).firmaName, "muster logistik gmbh", "Firmenname klein, ohne Rand (wie die Karte ihn speichert)");
  gleich(M({ firma: "Muster Logistik GmbH" }).firmaName, "muster logistik gmbh", "ohne Namen: echter Firmenname bleibt");
  gleich(M({ email: eva.email, telefon: eva.telefon }).firmaName, "", "ohne Firma (Karte zur Anfrage): nie über den Namen");
  gleich(gleicherLead(M({ personId: 13850 }), M({ personId: 13850 })), "person", "dieselbe Person → dieselbe Karte");
  gleich(gleicherLead(M({ personId: 13850, ...eva }), M({ personId: 13859, ...fritz })), null, "verschiedene Personen, alles verschieden → neue Karte");
  gleich(M({ personId: "abc" }).personId, null, "unbrauchbare Personen-Kennung zählt nicht");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A2 Nummern und Mails: eindeutig — Ländervorwahl egal, Fantasie verbindet nie");
{
  const n = (t: string) => M({ telefon: t }).tel9;
  gleich(n("+4915790011200"), "790011200", "+49 … → letzte 9 Ziffern");
  gleich(n("15790011200"), "790011200", "ohne Ländervorwahl (wie Anfrage #85) → dieselben 9 Ziffern");
  gleich(n("015790011200"), "790011200", "mit 0 statt +49 → dieselben");
  gleich(n("+49 (0) 157 9001 1200"), "790011200", "„+49 (0) 152 …“ → dieselben");
  gleich(n("0049 157 9001-1200"), "790011200", "„0049 …“ mit Bindestrich → dieselben");
  gleich(gleicherLead(M({ telefon: "+4915790011200" }), M({ telefon: "15790011200", email: "anders@x.example" })), "telefon", "gleiche Nummer mit und ohne +49 → dieselbe Karte (#84/#85)");
  gleich(gleicherLead(M({ telefon: "+43 664 1234 5678" }), M({ telefon: "0664 12345678" })), "telefon", "Österreich: +43 664 … = 0664 … → dieselbe Karte");
  for (const t of ["0123456789", "+49 123 456 789", "000000000", "+49 111 111 111", "987654321", "1212121212", "12345", "+49 30 1234", "", "keine"]) {
    gleich(n(t), "", `„${t}“ verbindet nie (Fantasie oder zu kurz)`);
  }
  gleich(gleicherLead(M({ telefon: "0123456789", firma: "Selbständig" }), M({ telefon: "0123456789", firma: "Selbständig" })), null, "zwei Fantasienummern → zwei Karten");
  gleich(M({ email: "  Eva@E.Example " }).email, "eva@e.example", "Mail klein, ohne Rand");
  gleich(gleicherLead(M({ email: "Eva@E.example" }), M({ email: "eva@e.EXAMPLE" })), "mail", "gleiche Mail (Groß/Klein egal) → dieselbe Karte");
  for (const m of ["keine", "-", "", "eva@", "@e.example", "eva@e", "eva e@x.example"]) gleich(M({ email: m }).email, "", `„${m}“ ist keine Mail, die verbindet`);
  // Dieselben Nummern-Regeln im Lauf firmen_trennen (dort unter den alten Namen).
  const P = await import("../shared/fiaon-firmen-trennen");
  ok(P.nummer9 === G.telefon9 && P.nummerTrivial === G.telefonTrivial && P.nummer9Echt === G.telefon9Echt, "firmen_trennen liest dieselbe Nummern-Regel (keine zweite Fassung)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A3 Einmal-Reparatur: die Vorprüfung");
{
  const S = R.REPARATUR_KARTE_34;
  gleich([S.quelleId, S.eigeneAnfrage, S.eigenePerson, S.gruppen.map((g) => [Array.from(g.anfrageIds), g.ziel, g.zielPerson ?? null])], [34, 61, 13850, [[[68], null, null], [[77], 52, 13859]]], "Soll: #61 bleibt auf #34, #68 → neue Karte, #77 → #52 (Person 13859)");
  gleich(R.reparaturSchluessel(S), ["trennung:34:68", "trennung:34:77"], "Schlüssel wie im Protokoll des Laufs");
  const basis = (): any => ({
    marke: null, modus: "trocken",
    quelle: { id: 34, firma: "Selbständig", ansprechpartner: "Eva Eigner", person_id: 13850, email: "eva@e.example", telefon: "+4915123456781" },
    anfragen: [
      { id: 61, art: "global", ist_test: false, email: "eva@e.example", telefon: "+4915123456781", name: "Eva Eigner", person_id: null },
      { id: 68, art: "global", ist_test: false, email: "fritz@f.example", telefon: "+4915906543212", name: "Fritz Fremd", person_id: null },
      { id: 77, art: "global", ist_test: false, email: "gerd@g.example", telefon: "+491703456712", name: "Gerd Gast", person_id: null },
    ],
    plan: { eigene: [61], gruppen: [{ schluessel: "trennung:34:68", anfrageIds: [68], ziel: null }, { schluessel: "trennung:34:77", anfrageIds: [77], ziel: 52 }] },
    zielKarten: [{ id: 52, firma: "Gerd Gast (Firma offen)", ansprechpartner: "Gerd Gast", person_id: 13859, email: "gerd@g.example", telefon: "+491703456712" }],
    protokoll: [],
  });
  const urteil = (f: (l: any) => void) => { const l = basis(); f(l); return R.reparaturPruefen(l); };
  gleich(R.reparaturPruefen(basis()), { tun: "trennen", schluessel: ["trennung:34:68", "trennung:34:77"] }, "erwarteter Zustand → beide Gruppen trennen");
  gleich(urteil((l) => { l.modus = "an"; }).tun, "trennen", "Schalter an → trennen");
  const nichts = (u: any, status: string, t: string) => ok(u.tun === "nichts" && u.status === status, `${t} → nichts (${status}) — ist: ${JSON.stringify(u)}`);
  nichts(urteil((l) => { l.marke = '{"status":"erledigt"}'; }), "schon_gelaufen", "Marke steht");
  ok((urteil((l) => { l.marke = "x"; }) as any).markeSetzen === false, "… und setzt die Marke nicht neu");
  nichts(urteil((l) => { l.modus = "aus"; }), "aus", "Schalter aus");
  ok((urteil((l) => { l.modus = "aus"; }) as any).markeSetzen === false, "… ohne Marke (läuft, sobald der Schalter nicht mehr aus ist)");
  nichts(urteil((l) => { l.quelle = null; }), "abweichung", "Karte #34 fehlt");
  nichts(urteil((l) => { l.quelle.person_id = 13999; }), "abweichung", "Kopf trägt eine andere Person");
  nichts(urteil((l) => { l.quelle.email = "neu@n.example"; l.quelle.telefon = "+4916012345678"; }), "abweichung", "Kopf passt weder per Mail noch Nummer zu #61");
  gleich(urteil((l) => { l.quelle.telefon = "+4916012345678"; }).tun, "trennen", "Kopf mit neuer Nummer, aber Mail von #61 → trennen");
  nichts(urteil((l) => { l.anfragen = l.anfragen.filter((a: any) => a.id !== 68); }), "abweichung", "Anfrage #68 fehlt");
  nichts(urteil((l) => { l.anfragen[2].ist_test = true; }), "abweichung", "Anfrage #77 ist ein Test");
  nichts(urteil((l) => { l.anfragen[1].art = "kontakt"; }), "abweichung", "Anfrage #68 ist keine Global-Anfrage");
  nichts(urteil((l) => { l.anfragen[1].telefon = "+4915123456781"; }), "abweichung", "#68 hat (inzwischen) die Nummer des Kopfs → dieselbe Person");
  nichts(urteil((l) => { l.anfragen[2].email = "fritz@f.example"; }), "abweichung", "#68 und #77 dieselbe Person");
  nichts(urteil((l) => { l.plan.eigene = [61, 90]; }), "abweichung", "noch eine eigene Anfrage auf der Karte");
  nichts(urteil((l) => { l.plan.gruppen.push({ schluessel: "trennung:34:90", anfrageIds: [90], ziel: null }); }), "abweichung", "eine unerwartete fremde Gruppe");
  nichts(urteil((l) => { l.plan.gruppen[0] = { schluessel: "trennung:34:68,77", anfrageIds: [68, 77], ziel: null }; l.plan.gruppen.pop(); }), "abweichung", "#68 und #77 als EINE Gruppe geplant");
  nichts(urteil((l) => { l.plan.gruppen[1].ziel = null; }), "abweichung", "#77 bekäme eine neue Karte statt #52");
  nichts(urteil((l) => { l.plan.gruppen[1].ziel = 60; }), "abweichung", "#77 landete auf einer dritten Karte");
  nichts(urteil((l) => { l.plan.gruppen[0].ziel = 53; }), "abweichung", "#68 hat schon eine Karte (dann nicht blind neu)");
  nichts(urteil((l) => { l.zielKarten = []; }), "abweichung", "Ziel-Karte #52 fehlt");
  nichts(urteil((l) => { l.zielKarten[0].person_id = 13999; }), "abweichung", "Ziel-Karte #52 trägt eine andere Person");
  nichts(urteil((l) => { l.zielKarten[0].email = "x@x.example"; l.zielKarten[0].telefon = "+4916000000001"; }), "abweichung", "Ziel-Karte #52 passt nicht zu #77");
  nichts(urteil((l) => { l.plan.gruppen.shift(); }), "abweichung", "Gruppe #68 weder auf der Karte noch im Protokoll");
  nichts(urteil((l) => { l.plan = null; }), "abweichung", "Karte kein Kandidat mehr, nichts im Protokoll");
  // Fortsetzen nach einem abgebrochenen Durchgang: was im Protokoll steht, ist erledigt.
  gleich(urteil((l) => { l.plan.gruppen.shift(); l.protokoll = [{ schluessel: "trennung:34:68", ziel_firma_id: 70 }]; }), { tun: "trennen", schluessel: ["trennung:34:77"] }, "#68 schon getrennt (Protokoll) → nur noch #77");
  nichts(urteil((l) => { l.plan.gruppen = []; l.protokoll = [{ schluessel: "trennung:34:68", ziel_firma_id: 70 }, { schluessel: "trennung:34:77", ziel_firma_id: 52 }]; }), "erledigt", "beide im Protokoll");
  ok((urteil((l) => { l.plan.gruppen = []; l.protokoll = [{ schluessel: "trennung:34:68", ziel_firma_id: 70 }, { schluessel: "trennung:34:77", ziel_firma_id: 52 }]; }) as any).markeSetzen === true, "… setzt die Marke (erledigt)");
  nichts(urteil((l) => { l.plan.gruppen.pop(); l.protokoll = [{ schluessel: "trennung:34:77", ziel_firma_id: 60 }]; }), "abweichung", "#77 im Protokoll mit falschem Ziel");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A4 Quelltext-Wände: EINE Zuordnung, Reparatur vor dem Lauf");
{
  const firmen = lies("server/routes/fiaon-firmen.ts");
  const zu = lies("server/lib/fiaon-lead-zuordnung.ts");
  const weg = lies("server/lib/fiaon-lead-weg.ts");
  const takt = lies("server/lib/fiaon-lead-takt.ts");
  const dossier = lies("server/lib/fiaon-lead-dossier.ts");
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  const trennLauf = lies("server/lib/fiaon-firmen-trennen.ts");
  const rep = lies("server/lib/fiaon-firmenkarte-reparatur.ts");
  const repRegel = lies("shared/fiaon-firmenkarte-reparatur.ts");
  const aufnehmen = firmen.slice(firmen.indexOf("export async function globalLeadAufnehmen"), firmen.indexOf("export async function globalLeadFortschreiben"));
  ok(/await karteZuMerkmalen\(merkmale\)/.test(aufnehmen) && /leadMerkmale\(\{ personId, email: ein\.email, telefon: ein\.telefon, firma, name: ein\.ansprechpartner \}\)/.test(aufnehmen), "Eingang: leadMerkmale + karteZuMerkmalen");
  ok(!/LOWER\(TRIM\(firma\)\)|regexp_replace|LOWER\(COALESCE\(email/.test(aufnehmen), "Eingang: keine eigene Such-Abfrage mehr (kein Firmenname, keine Nummer, keine Mail von Hand)");
  ok(/OR \(\$\{m\.firmaName\} <> '' AND LOWER\(TRIM\(firma\)\) = \$\{m\.firmaName\}\)/.test(zu) && /\$\{m\.tel9\} <> ''/.test(zu) && /\$\{m\.email\} <> ''/.test(zu), "die Abfrage: leere Merkmale verbinden nie");
  ok(/ORDER BY COALESCE\(person_id = \$\{m\.personId\}::int, FALSE\) DESC,[\s\S]*?email[\s\S]*?DESC,[\s\S]*?tel9[\s\S]*?DESC,\s+id ASC/.test(zu), "… Rangfolge Person, Mail, Nummer, dann die älteste Karte (wie gleicherLead)");
  const zurAnfrage = zu.slice(zu.indexOf("export async function karteZurAnfrage"));
  ok(/leadMerkmale\(\{ personId: [^}]*email: a\.email, telefon: a\.telefon \}\)/.test(zurAnfrage) && !/firma:/.test(zurAnfrage), "Karte zur Anfrage: nie über den Firmennamen");
  ok(!/fiaon_lead_dossier/.test(zurAnfrage), "… und nicht über den alten Dossier-Verweis (der kann aus der Zeit vor E-487 stammen)");
  ok(/karteZurAnfrage\(anfrageId, lauf\)/.test(weg) && !/JOIN fiaon_firmen_leads f ON/.test(weg), "Lead-Weg: die EINE Zuordnung");
  ok(/const key9 = \(tel: unknown\) => telefon9Echt\(tel\);/.test(weg), "Lead-Weg: Buchung ↔ Anfrage mit derselben Nummern-Regel");
  ok(/karteZurAnfrage\(a\.id, lauf, \{ personId: a\.personId \}\)/.test(takt) && !/LOWER\(COALESCE\(email, ''\)\) = \$\{a\.email\}/.test(takt), "Takt: die EINE Zuordnung");
  const finden = dossier.slice(dossier.indexOf("async function firmaFinden"), dossier.indexOf("async function firmaFinden") + 600);
  ok(/karteZuMerkmalen\(leadMerkmale\(\{ personId: e\.personId, email: e\.email, telefon: e\.telefon \}\), lauf\)/.test(finden), "Dossier: die EINE Zuordnung (ohne Firmenname)");
  ok(/m\.karteZurAnfrage\(anfrageId, lauf\)/.test(post) && !/OR f\.id = \$\{w\?\.firma_id \?\? 0\}/.test(post), "Lead-Post: die EINE Zuordnung");
  const taktFn = trennLauf.slice(trennLauf.indexOf("export async function firmenTrennenTakt"));
  ok(taktFn.indexOf("firmenkarteReparatur()") > 0 && taktFn.indexOf("firmenkarteReparatur()") < taktFn.indexOf("await firmenTrennenLauf()"), "Reparatur läuft im Takt VOR dem Lauf");
  ok(/catch \(e\) \{\s+reparaturFehler = /.test(taktFn) && /if \(reparaturFehler\) \{\s+throw new Error/.test(taktFn), "… ein Fehler hält den Lauf nicht an und steht danach in der Historie");
  ok(/gruppeTrennen\(lauf, p, g, da, heute, rueckfall\)/.test(rep) && !/\b(DELETE|TRUNCATE|DROP)\b/i.test(rep + repRegel), "Reparatur schreibt nur über gruppeTrennen — kein DELETE, TRUNCATE, DROP");
  ok(!/UPDATE fiaon_(firmen_leads|lead_|betreiber_todos|firmen_log)/.test(rep), "… kein eigenes UPDATE auf Karten, Verweise, Aufträge oder Verlauf");
  ok(rep.indexOf("reparaturPruefen(lage, soll)") > 0 && rep.indexOf("reparaturPruefen(lage, soll)") < rep.indexOf("gruppeTrennen(lauf"), "erst die Vorprüfung, dann das Trennen");
  ok(/INSERT INTO fiaon_settings \(key, value, updated_at\) VALUES \(\$\{soll\.marke\}/.test(rep), "Marke in fiaon_settings");
  ok(!/@(?!example)[a-z0-9-]+\.[a-z]{2,}|\+49\s?\d|\b0\d{3,}\s?\d{4,}/i.test(repRegel + rep + zu), "keine Mail-Adressen oder Nummern im Code (Repo öffentlich)");
  ok(!/firma=\d|Anfrage #\d|#\d{2,}/.test(trennLauf), "der Lauf selbst bleibt ohne feste Karten- oder Anfragenummer");
}

// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (Karte #34 wie in der Produktion — erfundene Menschen, echte Kennungen)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const F = await import("../server/routes/fiaon-firmen");
  const Z = await import("../server/lib/fiaon-lead-zuordnung");
  const REP = await import("../server/lib/fiaon-firmenkarte-reparatur");
  await (await import("../server/routes/fiaon-bewerbungen")).ensureAnfragenSpalten();
  await (await import("../server/lib/fiaon-lead-dossier")).leadDossierSchema();
  await (await import("../server/lib/fiaon-lead-weg")).leadWegSchema();
  await (await import("../server/lib/fiaon-global-lead-post")).leadPostSchema();
  await (await import("../server/lib/fiaon-lead-takt")).leadTaktBereit();
  await (await import("../server/lib/fiaon-mara-business")).mbSchema();
  await (await import("../server/routes/fiaon-betreiber-todo")).ensureTodoTabelle();
  await F.globalLeadAufnehmen({
    firma: "Fk Pruef Aufbau GmbH", ansprechpartner: "Fk Aufbau", telefon: "", email: "aufbau@fk-aufbau.example", zustaendigAgentId: null,
    status: "wiedervorlage", ereignis: "anfrage", verlauf: "Prüfaufbau (Tabellen)",
  });
  const [belegt] = (await sql`
    SELECT (SELECT COUNT(*)::int FROM fiaon_firmen_leads WHERE id IN (34, 52)) + (SELECT COUNT(*)::int FROM fiaon_anfragen WHERE id IN (61, 68, 77))
         + (SELECT COUNT(*)::int FROM fiaon_settings WHERE key = ${R.REPARATUR_KARTE_34.marke}) AS n`) as any[];
  if (Number(belegt?.n) > 0) { console.error("ABBRUCH Teil B: Kennungen 34/52/61/68/77 oder die Marke sind in dieser Kopie schon belegt — bitte eine frische Kopie (createdb -T fiaon_pruefstand …)."); process.exit(4); }
  await sql`DELETE FROM fiaon_settings WHERE key = 'firmen_trennen'`;
  const heute = (await import("../server/lib/fiaon-time")).berlinToday();
  const tag = 24 * 3_600_000;
  const t0 = Date.now() - 11 * tag;
  const mensch = {
    61: { name: "Eva Eigner", email: "eva@eigner.example", tel: "+4915123456781" },
    68: { name: "Fritz Fremd", email: "fritz@fremd.example", tel: "+4915906543212" },
    77: { name: "Gerd Gast", email: "gerd@gast.example", tel: "+491703456712" },
  } as const;
  const zeit = { 61: t0, 68: t0 + tag, 77: t0 + 2 * tag + 3_600_000 } as const;
  const eingang = (id: 61 | 68 | 77) => `Bittet um einen Anruf (Anfrage #${id} über das Meta-Sofortformular (Instagram/Facebook)). Paketwunsch: noch offen. Nachricht: Prüfnachricht ${id}`;
  const block = (am: number, verlauf: string) => `FIAON Global (${G.berlinZeit(new Date(am)).iso.split("-").reverse().join(".")}): ${verlauf}`.slice(0, 600);
  for (const id of [61, 68, 77] as const) {
    await sql`INSERT INTO fiaon_anfragen (id, art, name, email, firma, telefon, text, created_at, status, zustaendig_agent_id)
              VALUES (${id}, 'global', ${mensch[id].name}, ${mensch[id].email}, 'Selbständig', ${mensch[id].tel}, 'Paketwunsch: noch offen', ${new Date(zeit[id])}, 'in_arbeit', 8)`;
  }
  const terminVerlauf = "Erstgespräch gebucht: in vier Tagen um 09:00 Uhr mit Justin. Paketwunsch: Global Struktur (2.499 €).";
  const handNotiz = "Notiz vom Gespräch mit dem Eigner — gehört nur ihm.";
  const notiz34 = [block(zeit[61], eingang(61)), block(zeit[61] + 90_000, terminVerlauf), block(zeit[68], eingang(68)), block(zeit[77], eingang(77)), handNotiz].join("\n");
  await sql`INSERT INTO fiaon_firmen_leads (id, firma, ansprechpartner, telefon, email, quelle, status, zustaendig_agent_id, wiedervorlage, person_id, paketwunsch, global_am, notiz, letzter_kontakt, created_at)
            VALUES (34, 'Selbständig', ${mensch[61].name}, ${mensch[61].tel}, ${mensch[61].email}, 'global', 'in_arbeit', 8, ${heute}::date, 13850, 'Global Struktur (2.499 €)',
                    ${new Date(zeit[77])}, ${notiz34}, ${new Date(t0 + 4 * tag)}, ${new Date(zeit[61])})`;
  await sql`INSERT INTO fiaon_firmen_leads (id, firma, ansprechpartner, telefon, email, quelle, status, zustaendig_agent_id, wiedervorlage, person_id, global_am, notiz, created_at)
            VALUES (52, 'Gerd Gast (Firma offen)', ${mensch[77].name}, ${mensch[77].tel}, ${mensch[77].email}, 'global', 'in_arbeit', 8, ${heute}::date, 13859,
                    ${new Date(t0 + 4 * tag)}, ${block(t0 + 4 * tag, "Gespräch über fiaon.com/justin gebucht.")}, ${new Date(t0 + 4 * tag)})`;
  const log = async (firma: number, am: number, wer: string | null, art: string, ergebnis: string, notiz: string | null, agent: number | null = null) =>
    Number(((await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz, created_at) VALUES (${firma}, ${agent}, ${wer}, ${art}, ${ergebnis}, ${notiz}, ${new Date(am)}) RETURNING id`) as any[])[0].id);
  const logIds: Record<string, number> = {};
  for (const id of [61, 68, 77] as const) {
    logIds[`anfrage${id}`] = await log(34, zeit[id] + 10, "Website", "global", "anfrage", eingang(id));
    logIds[`dossier${id}`] = await log(34, zeit[id] + 300, "System", "global", "dossier", "Lead-Dossier an Justin: Firma unklar");
    await sql`INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, firma_id, status, temperatur, faden_betreff, mail_basis_am, mail_basis_id, basis)
              VALUES ('anfrage', ${id}, ${id}, 34, 'gesendet', 'warm', ${`Lead: ${mensch[61].name} · warm`}, ${new Date(zeit[id] + 297)}, ${`<fk-${id}@example.com>`},
                      ${sql.json({ firmaId: 34, cockpitUrl: "https://fiaon.example/agent/firmen?firma=34" } as any)})`;
    await sql`INSERT INTO fiaon_lead_takt (anfrage_id, firma_id, eingang_am, t1_am) VALUES (${id}, ${id === 61 ? 34 : null}, ${new Date(zeit[id])}, ${new Date(zeit[id] + 400)})`;
    if (id !== 61) await sql`INSERT INTO fiaon_lead_weg (anfrage_id, code, code_bis, firma_id) VALUES (${id}, ${`fk${id}pruef`}, NOW() + INTERVAL '30 days', NULL)`;
  }
  logIds.meldung61 = await log(34, zeit[61] + 403, "System", "global", "lead_meldung", "Lead-Meldung an das Team");
  // #61 bucht 90 s später (Termin 2021) — Gespräch an #34; #77 bucht Tage später über /justin auf seine eigene Karte #52 (Termin 2033).
  await sql`INSERT INTO fiaon_lead_gespraech (termin_id, anfrage_id, firma_id, person_id, weg, created_at) VALUES (2021, 61, 34, 13850, 'seite', ${new Date(zeit[61] + 90_000)})`;
  logIds.termin61 = await log(34, zeit[61] + 90_002, "Website", "global", "termin_gebucht", terminVerlauf);
  await sql`INSERT INTO fiaon_lead_gespraech (termin_id, anfrage_id, firma_id, person_id, weg, created_at) VALUES (2033, 77, 52, 13859, 'justin', ${new Date(t0 + 4 * tag)})`;
  logIds.anruf61 = await log(34, t0 + 4 * tag, "Justin", "anruf", "erreicht_interesse", handNotiz, 928);
  logIds.gespraech61 = await log(34, t0 + 4 * tag + 400_000, "Justin", "global", "gespraech_gefuehrt", "Erstgespräch geführt. Justin führt selbst — bitte nicht anrufen.", 928);
  logIds.antwort61 = await log(34, t0 + 7 * tag, "System", "global", "antwort", "Der Lead hat geschrieben. er hat schon ein Gespräch — kein Anruf-Auftrag.");
  for (const [id, sch, status, link] of [[5191, "global-anfrage:61", "erledigt", 34], [5225, "global-anfrage:68", "offen", 34], [5251, "global-anfrage:77", "erledigt", 34]] as const) {
    await sql`INSERT INTO fiaon_betreiber_todos (id, schluessel, titel, text, link, status, quelle, zustaendig_agent_id, zustaendig_name)
              VALUES (${id}, ${sch}, 'FIAON Global: Selbständig bittet um einen Anruf', ${`${sch} — Prüfauftrag`}, ${`/agent/firmen?firma=${link}`}, ${status}, 'website', 8, 'Daniel')`;
  }
  await sql`INSERT INTO fiaon_betreiber_todos (id, schluessel, titel, text, link, status, quelle, person_id) VALUES (5355, 'global-ergebnis:2033', 'Ergebnis erfragen', 'Prüfauftrag', '/agent/firmen?person=13859', 'erledigt', 'system', 13859)`;
  const zaehlen = async () => (await sql`SELECT (SELECT COUNT(*)::int FROM fiaon_firmen_leads) AS karten, (SELECT COUNT(*)::int FROM fiaon_firmen_log) AS log,
    (SELECT COUNT(*)::int FROM fiaon_lead_dossier) AS dossier, (SELECT COUNT(*)::int FROM fiaon_betreiber_todos) AS todos, (SELECT COUNT(*)::int FROM fiaon_anfragen) AS anfragen`) as any[];
  const stand = async () => ({
    d: Object.fromEntries(((await sql`SELECT anlass_id, firma_id FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id IN (61, 68, 77)`) as any[]).map((r) => [r.anlass_id, r.firma_id])),
    t: Object.fromEntries(((await sql`SELECT anfrage_id, firma_id FROM fiaon_lead_takt WHERE anfrage_id IN (61, 68, 77)`) as any[]).map((r) => [r.anfrage_id, r.firma_id])),
    w: Object.fromEntries(((await sql`SELECT anfrage_id, firma_id FROM fiaon_lead_weg WHERE anfrage_id IN (68, 77)`) as any[]).map((r) => [r.anfrage_id, r.firma_id])),
    a: Object.fromEntries(((await sql`SELECT id, link FROM fiaon_betreiber_todos WHERE id IN (5191, 5225, 5251, 5355)`) as any[]).map((r) => [r.id, r.link])),
  });
  const marke = async () => { const [m] = (await sql`SELECT value FROM fiaon_settings WHERE key = ${R.REPARATUR_KARTE_34.marke}`) as any[]; return m ? JSON.parse(String(m.value)) : null; };
  const vorher = await stand();
  const zahlVorher = (await zaehlen())[0];
  gleich(vorher.d, { 61: 34, 68: 34, 77: 34 }, "Aufbau: alle drei Dossiers auf #34 (wie in der Produktion)");
  // Die Trockenprobe des Laufs sieht denselben Plan wie in der Produktion (16.11.: #68 → neu, #77 → #52).
  const L = await import("../server/lib/fiaon-firmen-trennen");
  const tr = await L.firmenTrennenLauf({ modus: "trocken", rueckfall: null });
  gleich(tr.plan.filter((x) => x.quelle === 34), [{ quelle: 34, anfragen: [68], ziel: "neu" }, { quelle: 34, anfragen: [77], ziel: 52 }], "Trockenprobe: derselbe Plan wie in der Produktion");

  abschnitt("B1 Abweichung → nichts ändern, Marke mit Grund");
  await sql`UPDATE fiaon_firmen_leads SET person_id = 13999 WHERE id = 34`;
  const ab = await REP.firmenkarteReparatur({ rueckfall: null });
  ok(ab.urteil.tun === "nichts" && (ab.urteil as any).status === "abweichung", `Kopf mit fremder Person → nichts (${JSON.stringify(ab.urteil)})`);
  gleich(await stand(), vorher, "… kein Verweis bewegt");
  gleich((await zaehlen())[0], zahlVorher, "… keine Karte, keine Zeile neu");
  gleich((await marke())?.status, "abweichung", "… Marke „abweichung“ mit Grund");
  const [hist] = (await sql`SELECT meldung FROM fiaon_lauf_historie WHERE name = 'firmen_trennen' ORDER BY id DESC LIMIT 1`) as any[];
  ok(/abweichung/.test(String(hist?.meldung)) && /Person 13850/.test(String(hist?.meldung)), `… und eine Zeile in der Lauf-Historie (${String(hist?.meldung).slice(0, 120)})`);
  gleich((await REP.firmenkarteReparatur({ rueckfall: null })).urteil.tun, "nichts", "steht die Marke, passiert nichts mehr");
  await sql`DELETE FROM fiaon_settings WHERE key = ${R.REPARATUR_KARTE_34.marke}`;
  await sql`UPDATE fiaon_firmen_leads SET person_id = 13850 WHERE id = 34`;

  abschnitt("B2 Schalter firmen_trennen = aus → nichts, ohne Marke");
  await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('firmen_trennen', 'aus', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const aus = await REP.firmenkarteReparatur({ rueckfall: null });
  ok(aus.urteil.tun === "nichts" && (aus.urteil as any).status === "aus", "Schalter aus → nichts");
  gleich(await marke(), null, "… keine Marke");
  gleich(await stand(), vorher, "… kein Verweis bewegt");
  await sql`DELETE FROM fiaon_settings WHERE key = 'firmen_trennen'`;

  abschnitt("B3 Die Reparatur (Schalter trocken = Vorgabe): #68 → neue Karte, #77 → #52, #61 bleibt");
  const erg = await REP.firmenkarteReparatur({ rueckfall: null });
  gleich(erg.urteil, { tun: "trennen", schluessel: ["trennung:34:68", "trennung:34:77"] }, "Vorprüfung: beide Gruppen");
  gleich(erg.getrennt.map((g) => [g.schluessel, g.status, g.zielNeu]), [["trennung:34:68", "getrennt", true], ["trennung:34:77", "getrennt", false]], "zwei Gruppen getrennt (eine neue Karte)");
  gleich(erg.abweichungen, [], "Nachprüfung ohne Abweichung");
  const neuId = Number(erg.getrennt[0].zielId);
  gleich(erg.getrennt[1].zielId, 52, "#77 auf seine Karte #52");
  const [neu] = (await sql`SELECT * FROM fiaon_firmen_leads WHERE id = ${neuId}`) as any[];
  ok(neu && neu.email === mensch[68].email && neu.telefon === mensch[68].tel && neu.ansprechpartner === mensch[68].name && Number(neu.getrennt_aus) === 34, "neue Karte mit Name, Mail und Nummer aus Anfrage #68, getrennt aus #34");
  ok(neu.person_id == null && neu.status === "wiedervorlage" && String(neu.wiedervorlage instanceof Date ? neu.wiedervorlage.toISOString() : neu.wiedervorlage).length > 0 && Number(neu.zustaendig_agent_id) === 8, "… ohne Person (nie zusammengelegt), Wiedervorlage, zuständig wie sein Auftrag");
  gleich(await stand(), {
    d: { 61: 34, 68: neuId, 77: 52 }, t: { 61: 34, 68: neuId, 77: 52 }, w: { 68: neuId, 77: 52 },
    a: { 5191: "/agent/firmen?firma=34", 5225: `/agent/firmen?firma=${neuId}`, 5251: "/agent/firmen?firma=52", 5355: "/agent/firmen?person=13859" },
  }, "Dossier, Takt, Lead-Weg und Aufträge zeigen auf die richtige Karte; #61 und der Ergebnis-Auftrag bleiben");
  const [a5225] = (await sql`SELECT titel, text, status FROM fiaon_betreiber_todos WHERE id = 5225`) as any[];
  ok(a5225.status === "offen" && /Fritz Fremd/.test(a5225.titel) && /Hinweis \(/.test(a5225.text), "offener Auftrag #68: bleibt offen, Titel mit seinem Namen, Hinweis im Text");
  const logBei = async (k: number) => (await sql`SELECT id, art, ergebnis FROM fiaon_firmen_log WHERE firma_id = ${k} ORDER BY id`) as any[];
  const l34 = await logBei(34), lNeu = await logBei(neuId), l52 = await logBei(52);
  ok([logIds.anfrage61, logIds.dossier61, logIds.meldung61, logIds.termin61, logIds.anruf61, logIds.gespraech61, logIds.antwort61].every((id) => l34.some((l) => l.id === id)), "#34 behält Eingang, Dossier, Meldung, Termin, Anruf, Gespräch und Antwort von #61");
  ok([logIds.anfrage68, logIds.dossier68].every((id) => lNeu.some((l) => l.id === id)) && [logIds.anfrage77, logIds.dossier77].every((id) => l52.some((l) => l.id === id)), "Eingang und Dossier-Zeile von #68 auf der neuen Karte, von #77 auf #52");
  gleich(l34.filter((l) => l.ergebnis === "getrennt").length, 2, "#34: zwei Zeilen „Getrennt: …“");
  ok(lNeu.some((l) => l.ergebnis === "getrennt") && l52.some((l) => l.ergebnis === "getrennt"), "neue Karte und #52: je eine Zeile „Getrennt aus Karte #34“");
  const [k34] = (await sql`SELECT notiz, person_id, status, paketwunsch, global_am FROM fiaon_firmen_leads WHERE id = 34`) as any[];
  gleich(String(k34.notiz), [block(zeit[61], eingang(61)), block(zeit[61] + 90_000, terminVerlauf), handNotiz].join("\n"), "#34: Notiz ohne die Blöcke von #68 und #77, Hand-Notiz bleibt");
  ok(Number(k34.person_id) === 13850 && k34.status === "in_arbeit" && k34.paketwunsch === "Global Struktur (2.499 €)", "#34: Person, Stand und Paketwunsch von #61 bleiben");
  ok(new Date(k34.global_am).getTime() < zeit[68], "#34: „selbst gemeldet“ wieder vom eigenen Eingang (nicht mehr vom Eingang #77)");
  const [k52] = (await sql`SELECT notiz, person_id FROM fiaon_firmen_leads WHERE id = 52`) as any[];
  ok(Number(k52.person_id) === 13859 && String(k52.notiz).includes(block(zeit[77], eingang(77))), "#52: Person bleibt, Block von #77 angehängt");
  ok(String(neu.notiz) === block(zeit[68], eingang(68)), "neue Karte: der Block von #68");
  const gesp = (await sql`SELECT termin_id, firma_id, person_id FROM fiaon_lead_gespraech WHERE termin_id IN (2021, 2033) ORDER BY termin_id`) as any[];
  gleich(gesp.map((g) => [g.termin_id, g.firma_id, g.person_id]), [[2021, 34, 13850], [2033, 52, 13859]], "Termine/Gespräche hingen schon richtig und bleiben");
  const z = (await zaehlen())[0];
  gleich([z.karten, z.dossier, z.todos, z.anfragen], [zahlVorher.karten + 1, zahlVorher.dossier, zahlVorher.todos, zahlVorher.anfragen], "nichts gelöscht: eine Karte mehr, Dossiers/Aufträge/Anfragen gleich viele");
  ok(z.log === zahlVorher.log + 4, `Verlauf: nur die vier „Getrennt“-Zeilen dazu (${z.log - zahlVorher.log})`);
  const prot = (await sql`SELECT schluessel, ziel_firma_id, bewegt, vorher FROM fiaon_firmen_trennung WHERE quell_firma_id = 34 ORDER BY id`) as any[];
  gleich(prot.map((p) => [p.schluessel, p.ziel_firma_id]), [["trennung:34:68", neuId], ["trennung:34:77", 52]], "Protokoll mit Rückweg (bewegt, vorher)");
  ok(prot.every((p) => p.bewegt && p.vorher), "… beide mit bewegt und vorher");
  const mk = await marke();
  ok(mk?.status === "erledigt" && mk.ziele?.["#68"] === `#${neuId}` && mk.ziele?.["#77"] === "#52" && Array.isArray(mk.abweichungen) && mk.abweichungen.length === 0, `Marke „erledigt“ mit Zielen (${JSON.stringify(mk).slice(0, 160)})`);

  abschnitt("B4 Zweiter Durchgang = nichts; ohne Marke = „erledigt“ aus dem Protokoll");
  const vorZwei = await stand();
  gleich((await REP.firmenkarteReparatur({ rueckfall: null })).urteil.tun, "nichts", "Marke steht → nichts");
  await sql`DELETE FROM fiaon_settings WHERE key = ${R.REPARATUR_KARTE_34.marke}`;
  const drei = await REP.firmenkarteReparatur({ rueckfall: null });
  ok(drei.urteil.tun === "nichts" && (drei.urteil as any).status === "erledigt", `Marke weg → „erledigt“ aus dem Protokoll (${JSON.stringify(drei.urteil)})`);
  gleich(await stand(), vorZwei, "… nichts bewegt");
  gleich((await zaehlen())[0].karten, z.karten, "… keine weitere Karte");
  const tr2 = await L.firmenTrennenLauf({ modus: "trocken", rueckfall: null });
  gleich(tr2.plan.filter((x) => x.quelle === 34), [], "der Lauf sieht auf #34 nichts mehr zu trennen");

  abschnitt("B5 Die EINE Zuordnung findet jetzt die richtigen Karten");
  gleich([await Z.karteZurAnfrage(61), await Z.karteZurAnfrage(68), await Z.karteZurAnfrage(77)], [34, neuId, 52], "karteZurAnfrage: #61 → #34, #68 → eigene Karte, #77 → #52");
  // WhatsApp-Anfrage ohne Mail (wie #84) und dieselbe Nummer ohne +49 (wie #85).
  const [wa] = (await sql`INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, created_at) VALUES ('global', '', '', '', '+4915906543212', NOW()) RETURNING id`) as any[];
  gleich(await Z.karteZurAnfrage(Number(wa.id)), neuId, "Anfrage ohne Mail findet ihre Karte über die Nummer");
  const [ohne] = (await sql`INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, created_at) VALUES ('global', 'Fritz', 'fritz.neu@fremd2.example', 'Cafe', '15906543212', NOW()) RETURNING id`) as any[];
  gleich(await Z.karteZurAnfrage(Number(ohne.id)), neuId, "… und dieselbe Nummer ohne +49 ebenso");

  abschnitt("B6 Der echte Eingang legt „Selbständig“ nie wieder zusammen");
  const ein = (name: string, email: string, telefon: string, firma = "Selbständig") => F.globalLeadAufnehmen({
    firma, ansprechpartner: name, telefon, email, zustaendigAgentId: null, status: "wiedervorlage", ereignis: "anfrage", verlauf: `Prüfeingang ${name}`,
  });
  const h1 = await ein("Hanna Hoch", "hanna@hoch.example", "+4916011122233");
  ok(h1.neu && ![34, 52, neuId].includes(h1.firmaId), "„Selbständig“ + neue Mail + neue Nummer → neue Karte (nicht #34)");
  const h2 = await ein("Hanna Hoch", "hanna.privat@hoch2.example", "016011122233");
  ok(!h2.neu && h2.firmaId === h1.firmaId, "dieselbe Nummer mit 0 statt +49 → dieselbe Karte");
  const i1 = await ein("Ida Irr", "ida@irr.example", "0123456789", "noch offen");
  const i2 = await ein("Jan Jux", "jan@jux.example", "+49 123 456 789", "noch offen");
  ok(i1.neu && i2.neu && i1.firmaId !== i2.firmaId, "zwei Fantasienummern und „noch offen“ → zwei Karten");
  const g1 = await ein("Kai Kern", "kai@kern-logistik.example", "+4917055566677", "Kern Logistik GmbH");
  const g2 = await ein("Lea Kern", "lea@lk.example", "+4917088899900", "Kern Logistik GmbH");
  ok(g1.neu && !g2.neu && g2.firmaId === g1.firmaId, "derselbe echte Firmenname mit Rechtsform → dieselbe Karte (Kollegen)");
  await sql.end();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
