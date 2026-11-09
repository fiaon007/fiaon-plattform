// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-487 (09.11.2026): PARTNER-EMPFEHLUNGEN UND PROVISION — Fast-Track-Abzug, „zählt mit“, Nachtrag, Zuordnung, Stufe,
// Empfehlung als Lead (Willkommens-Mail „Empfehlung“ durch die Lead-Wand).
//
//   A  REIN (ohne Datenbank, ohne Netz, verschickt nichts):
//      A1 Fast-Track-Abzug nur, wenn der Kunde ihn gekauft hat (wie kapitalCMitFastTrack) · über Teilzahlungen genau einmal · SQL
//      A2 „zählt mit“ nur über die Umgebungsvariable KOOP_FASTTRACK_ZAEHLT (keine Ref im Code)
//      A3 Nachtrags-Posten: je Zahlung „Provision heute minus schon gutgeschrieben“ — späte Zuordnung, Differenz, Doppelschutz,
//         alte Posten ohne Schlüssel, Raten, Teilzahlungen, nie negativ
//      A4 Zuordnungs-Regel: keiner · eindeutig · mehrdeutig · prüfen (schon länger bei uns) · Namensvergleich
//      A5 Stufe mit Datum (gemeldet → Kontakt → Gespräch → Angebot → Kunde / kein Interesse)
//      A6 Meldung im Partnerbereich: Telefon ODER E-Mail
//      A7 Willkommens-Mail „Empfehlung“ (deutsch + britisch, mit Maras WhatsApp-Link) durch die Lead-Wand
//      A8 Quelltext-Wände (Lead-Weg nach dem INSERT, eigener Lauf, lock_timeout, Advisory-Lock, nie Geld, keine Ref im Code)
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus BREVO_API_KEY=pruef node_modules/.bin/tsx scripts/pruef-koop-provision.ts
//
// Repo öffentlich: nur erfundene Menschen (*.example, Nullnummern), erfundene Refs und Beträge.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string, fund?: unknown) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}${fund !== undefined ? ` — ${JSON.stringify(fund).slice(0, 400)}` : ""}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p: string) => readFileSync(join(WURZEL, p), "utf8");

const S = await import("../shared/fiaon-koop-empfehlung");
const KC = await import("../shared/fiaon-global-angebot-kapital-c");
const T = await import("../shared/fiaon-global-lead-texte");
const MB = await import("../shared/fiaon-mara-business");
const LP = await import("../server/lib/fiaon-global-lead-post");
const K = await import("../server/lib/fiaon-koop-empfehlung");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 Fast-Track-Abzug — nur, wenn der Kunde ihn wirklich hat");
{
  const C = "IA-KAPITAL-2026-10-27-C";
  const par = { fastTrackCents: 20000 };
  const ab = (o: Record<string, unknown>) => S.koopFastTrackAbzugCents({ fassung: C, parameter: par, schalter: {}, zahlungCents: 120000, ...o } as any);
  gleich(ab({}), 20000, "Kapital C ohne Wahl (Bestand): Fast-Track wird abgezogen (E-432 bleibt)");
  gleich(ab({ parameter: { ...par, fastTrackWahl: true }, schalter: { fastTrack: false } }), 0, "mit Wahl und abgewählt: kein Abzug (vorher fälschlich abgezogen)");
  gleich(ab({ parameter: { ...par, fastTrackWahl: true }, schalter: { fastTrack: true } }), 20000, "mit Wahl und gewählt: Abzug");
  gleich(ab({ parameter: { ...par, fastTrackWahl: true }, schalter: {} }), 20000, "mit Wahl, noch keine Wahl gespeichert: wie „mit“ (nie zu wenig abgezogen)");
  gleich(ab({ parameter: { ...par, fastTrackWahl: true }, schalter: JSON.stringify({ fastTrack: false }) }), 0, "Schalter als JSON-Text (doppelt verpackt): wird gelesen");
  gleich(ab({ fassung: "IA-KAPITAL-2026-10-23" }), 0, "andere Fassung (Firma): kein Abzug");
  gleich(ab({ zaehltMit: true }), 0, "Kooperation „Fast-Track zählt mit“: kein Abzug");
  gleich(ab({ zahlungCents: 15000 }), 15000, "nie mehr als der Zahlbetrag");
  gleich([ab({ zahlungCents: 15000, teilVorherCents: 0 }), ab({ zahlungCents: 24000, teilVorherCents: 15000 })], [15000, 5000], "Teilzahlungen: der Fast-Track genau einmal über das erste Geld (E-469)");
  for (const ftw of [undefined, false, true]) for (const ft of [undefined, false, true]) {
    const p = { fastTrackCents: 1, ...(ftw === undefined ? {} : { fastTrackWahl: ftw }) };
    const s = ft === undefined ? {} : { fastTrack: ft };
    ok(S.koopHatFastTrack(p, s) === KC.kapitalCMitFastTrack({ fastTrackWahl: !!ftw } as any, s as any), `koopHatFastTrack = kapitalCMitFastTrack (Wahl ${String(ftw)}, gewählt ${String(ft)})`);
  }
  const sql = S.koopDurchlaufAbzugSql(false);
  ok(sql.includes("ga.fassung LIKE 'IA-KAPITAL-%-C'") && sql.includes("ga.auftrag_ref = q.ref") && /teil_vorher_cents/.test(sql), "SQL: nur das Angebot der Bestellung, Fassung C, Teilzahlungen einmal");
  ok(sql.includes("COALESCE(ga.parameter->>'fastTrackWahl', 'false') = 'true'") && sql.includes("COALESCE(ga.schalter->>'fastTrack', 'true') = 'false'"), "SQL: abgewählter Fast-Track wird nicht abgezogen (dieselbe Regel wie oben)");
  gleich(S.koopDurchlaufAbzugSql(true), "0", "SQL bei „zählt mit“: 0");
  gleich(S.KOOP_DURCHLAUF_ABZUG_SQL, sql, "KOOP_DURCHLAUF_ABZUG_SQL = Abzug ohne „zählt mit“ (Prüfstände ohne Kooperation)");
}

abschnitt("A2 „Fast-Track zählt mit“ — nur über KOOP_FASTTRACK_ZAEHLT");
{
  gleich(S.KOOP_FASTTRACK_ZAEHLT_ENV, "KOOP_FASTTRACK_ZAEHLT", "Name der Umgebungsvariable");
  gleich(S.koopFastTrackZaehltListe(" fiaon-ia-ktest01 ; FIAON-IA-KTEST02,\nFIAON-IA-KTEST03 "), ["FIAON-IA-KTEST01", "FIAON-IA-KTEST02", "FIAON-IA-KTEST03"], "Liste: Komma, Semikolon, Zeilen, Groß/klein egal");
  ok(S.koopFastTrackZaehlt("FIAON-IA-KTEST02", "FIAON-IA-KTEST01,fiaon-ia-ktest02") && !S.koopFastTrackZaehlt("FIAON-IA-KTEST09", "FIAON-IA-KTEST01"), "nur die genannte Kooperation");
  ok(!S.koopFastTrackZaehlt("FIAON-IA-KTEST01", undefined) && !S.koopFastTrackZaehlt("FIAON-IA-KTEST01", "") && !S.koopFastTrackZaehlt("", "FIAON-IA-KTEST01"), "ohne Variable oder ohne Ref: zählt nicht mit");
  const vorher = process.env.KOOP_FASTTRACK_ZAEHLT;
  delete process.env.KOOP_FASTTRACK_ZAEHLT;
  gleich(K.koopAbzugSqlFuer("FIAON-IA-KTEST01"), S.koopDurchlaufAbzugSql(false), "Server ohne Variable: normaler Abzug");
  process.env.KOOP_FASTTRACK_ZAEHLT = "FIAON-IA-KTEST01";
  gleich(K.koopAbzugSqlFuer("fiaon-ia-ktest01"), "0", "Server mit Variable: diese Kooperation zieht nichts ab");
  gleich(K.koopAbzugSqlFuer("FIAON-IA-KTEST02"), S.koopDurchlaufAbzugSql(false), "… eine andere Kooperation schon");
  gleich(K.koopAbzugSqlFuer(undefined), S.koopDurchlaufAbzugSql(false), "… ohne Ref (Prüfstand): normaler Abzug");
  if (vorher === undefined) delete process.env.KOOP_FASTTRACK_ZAEHLT; else process.env.KOOP_FASTTRACK_ZAEHLT = vorher;
}

abschnitt("A3 Nachtrag — jede Zahlung genau einmal voll gutgeschrieben");
{
  const Z = (o: Partial<import("../shared/fiaon-koop-empfehlung").KoopZahlung>): import("../shared/fiaon-koop-empfehlung").KoopZahlung =>
    ({ empfehlungId: 1, name: "Erika Beispiel", ref: "FIAON-PRUEF-A", am: "2026-10-10T11:00:00.000Z", rateNr: null, teilVorherCents: 0, umsatzCents: 100000, ...o });
  // Oktober: Zahlung A (Empfehlung 1) war abgerechnet — nach der alten Regel (Fast-Track abgezogen) 30 % von 1.000 € = 300 €.
  // Posten von vor E-487: OHNE Schlüssel. Zahlung B (Empfehlung 2) kam erst nach der Monatsabrechnung zur Person.
  const altePosten = [{ empfehlungId: 1, name: "Erika Beispiel", ref: "FIAON-PRUEF-A", am: "2026-10-10T11:00:00.000Z", umsatzCents: 100000, provisionCents: 30000 }];
  const heute = [Z({ umsatzCents: 120000 }), Z({ empfehlungId: 2, name: "Max Muster", ref: "FIAON-PRUEF-B", am: "2026-10-20T09:00:00.000Z", umsatzCents: 100000 })];
  const n = S.koopOffenePosten(heute, altePosten, 30, null);
  gleich(n.posten.map((p) => [p.empfehlungId, p.provisionCents, p.nachtrag, p.faelligCents ?? null, p.schonCents ?? null]), [[1, 6000, true, 36000, 30000], [2, 30000, true, null, null]],
    "Nachtrag: Differenz für die abgerechnete Zahlung (360 − 300) und die spät zugeordnete Zahlung voll");
  gleich(n.posten.reduce((s, p) => s + p.provisionCents, 0), 36000, "Summe des Nachtrags");
  ok(n.posten.every((p) => p.schluessel === S.koopZahlungSchluessel(heute.find((z) => z.ref === p.ref)!)), "jeder Posten trägt den Schlüssel seiner Zahlung");
  gleich(n.zuViel, [], "nichts zu viel gutgeschrieben");
  const danach = [...altePosten, ...n.posten];
  gleich(S.koopOffenePosten(heute, danach, 30, null).posten, [], "Doppelschutz: nach dem Nachtrag ist nichts mehr offen (zweiter Lauf schreibt nichts)");
  // Monatsabrechnung November: neue Zahlung C im November + was aus dem Oktober noch offen war (als Nachtrag markiert).
  const nov = [...heute, Z({ empfehlungId: 2, name: "Max Muster", ref: "FIAON-PRUEF-C", am: "2026-11-05T09:00:00.000Z", umsatzCents: 50000 })];
  const m = S.koopOffenePosten(nov, altePosten, 30, "2026-11");
  gleich(m.posten.map((p) => [p.ref, p.provisionCents, !!p.nachtrag]), [["FIAON-PRUEF-A", 6000, true], ["FIAON-PRUEF-B", 30000, true], ["FIAON-PRUEF-C", 15000, false]],
    "Monatsabrechnung nimmt offene Nachträge mit; die Zahlung des Monats ist kein Nachtrag");
  gleich(S.koopOffenePosten(nov, [...altePosten, ...m.posten], 30, "2026-12").posten, [], "nach der Monatsabrechnung: nichts doppelt");
  // Regel wird kleiner (Variable entfernt): nie ein negativer Posten — nur gemeldet.
  const klein = S.koopOffenePosten([Z({ umsatzCents: 100000 })], [{ ...altePosten[0], provisionCents: 36000, schluessel: S.koopZahlungSchluessel(Z({})) }], 30, null);
  ok(klein.posten.length === 0 && klein.zuViel.length === 1 && klein.zuViel[0].schonCents === 36000 && klein.zuViel[0].faelligCents === 30000, "Regel kleiner: kein negativer Posten, „zu viel“ wird nur gemeldet", klein);
  // Alte Posten ohne Schlüssel: Uhrzeit verschoben (derselbe Berliner Tag) oder einzige Zahlung der Bestellung.
  ok(S.koopOffenePosten([Z({ am: "2026-10-10T17:30:00.000Z", umsatzCents: 100000 })], altePosten, 30, null).posten.length === 0, "alter Posten: derselbe Berliner Tag, andere Uhrzeit → erkannt");
  ok(S.koopOffenePosten([Z({ am: "2026-10-12T08:00:00.000Z", umsatzCents: 100000 })], altePosten, 30, null).posten.length === 0, "alter Posten: anderer Tag, aber einzige Zahlung dieser Bestellung → erkannt (nie doppelt)");
  // Raten derselben Bestellung: jede Rate eigen.
  const raten = [Z({ ref: "FIAON-PRUEF-R", rateNr: 1, am: "2026-10-01T10:00:00.000Z", umsatzCents: 10000 }), Z({ ref: "FIAON-PRUEF-R", rateNr: 2, am: "2026-11-01T10:00:00.000Z", umsatzCents: 10000 })];
  ok(S.koopZahlungSchluessel(raten[0]) !== S.koopZahlungSchluessel(raten[1]), "Raten: je Rate ein eigener Schlüssel");
  const rp = S.koopOffenePosten(raten, [{ empfehlungId: 1, ref: "FIAON-PRUEF-R", am: "2026-10-01T10:00:00.000Z", provisionCents: 3000 }], 30, "2026-11");
  gleich(rp.posten.map((p) => [p.provisionCents, !!p.nachtrag]), [[3000, false]], "Raten: die abgerechnete Rate bleibt abgerechnet, die neue kommt dazu");
  // Teilzahlungen am selben Tag: unterschiedliches „was vorher kam“.
  const teile = [Z({ ref: "FIAON-PRUEF-T", am: "2026-10-15T10:00:00.000Z", umsatzCents: 5000, teilVorherCents: 0 }), Z({ ref: "FIAON-PRUEF-T", am: "2026-10-15T10:00:00.000Z", umsatzCents: 5000, teilVorherCents: 5000 })];
  ok(S.koopZahlungSchluessel(teile[0]) !== S.koopZahlungSchluessel(teile[1]) && S.koopOffenePosten(teile, [], 30, "2026-10").posten.length === 2, "Teilzahlungen am selben Tag: zwei Zahlungen, zwei Posten");
  // Berliner Monat/Tag (formatToParts).
  gleich([S.koopBerlinMonat("2026-10-31T23:30:00Z"), S.koopBerlinTag("2026-10-31T23:30:00Z"), S.koopBerlinMonat("2026-10-31T22:30:00Z")], ["2026-11", "2026-11-01", "2026-10"], "Berliner Monat und Tag um Mitternacht (Winterzeit)");
}

abschnitt("A4 Zuordnung Empfehlung → Person — die Regel");
{
  const G = "2026-11-01T10:00:00.000Z";
  gleich(S.koopZuordnungUrteil([], G), { art: "keiner" }, "keine Spur: nichts");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "name", seit: "2026-11-02T08:00:00Z" }, { personId: 7, weg: "angebot", seit: "2026-11-02T08:00:00Z" }, { personId: 7, weg: "email", seit: null }], G),
    { art: "eindeutig", personId: 7, wege: ["angebot", "email", "name"] }, "eine neue Person über mehrere Wege: eindeutig");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "email", seit: "2026-10-05T08:00:00Z" }], G), { art: "eindeutig", personId: 7, wege: ["email"] }, "Person bis 30 Tage vor der Meldung: noch neu");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "telefon", seit: "2026-07-01T08:00:00Z" }], G), { art: "pruefen", personId: 7, wege: ["telefon"], seit: "2026-07-01T08:00:00.000Z" }, "Person schon lange bei uns: Justin entscheidet");
  gleich(S.koopZuordnungUrteil([{ personId: 9, weg: "name", seit: G }, { personId: 7, weg: "email", seit: G }], G),
    { art: "mehrdeutig", personen: [{ personId: 7, wege: ["email"] }, { personId: 9, wege: ["name"] }] }, "zwei Personen: mehrdeutig (Aufgabe an Justin)");
  ok(S.koopNamePasst("Erika Beispiel", "Beispiel Erika") && S.koopNamePasst("Frau Dr. Erika Beispiel", "erika beispiel") && S.koopNamePasst("Jürgen Groß", "Jurgen Gross"), "Name: Reihenfolge, Anrede/Titel, Akzente und ß egal");
  ok(!S.koopNamePasst("Erika Beispiel", "Erika Muster") && !S.koopNamePasst("Beispiel", "Beispiel") && !S.koopNamePasst("Erika Maria Beispiel", "Erika Beispiel"), "Name: nur alle Teile gleich, mindestens Vor- und Nachname");
  gleich(S.koopZuordnungWege(["email", "name"]), "die E-Mail, Vor- und Nachname", "Wege im Klartext");
  gleich(S.KOOP_ZUORDNUNG_TAGE_VORHER, 30, "Spuren ab Meldetag minus 30 Tage");
}

abschnitt("A5 Stufe mit Datum — nur Stufe, keine Inhalte");
{
  const st = (o: Record<string, string | null>) => { const r = S.koopEmpfehlungStufe({ gemeldetAm: "2026-11-01T10:00:00Z", ...o }); return [r.stand, r.am ? r.am.toISOString().slice(0, 10) : null]; };
  gleich(st({}), ["gemeldet", "2026-11-01"], "ohne Spur: gemeldet mit Meldetag");
  gleich(st({ kontaktAm: "2026-11-02T10:00:00Z" }), ["kontaktiert", "2026-11-02"], "Kontakt aufgenommen");
  gleich(st({ kontaktAm: "2026-11-02T10:00:00Z", gespraechAm: "2026-11-03T10:00:00Z" }), ["gespraech", "2026-11-03"], "Gespräch vereinbart");
  gleich(st({ gespraechAm: "2026-11-03T10:00:00Z", angebotAm: "2026-11-04T10:00:00Z" }), ["angebot", "2026-11-04"], "Angebot");
  gleich(st({ angebotAm: "2026-11-04T10:00:00Z", kundeAm: "2026-11-05T10:00:00Z", keinInteresseAm: "2026-11-06T10:00:00Z" }), ["kunde", "2026-11-05"], "eine Zahlung ist immer „Kunde“");
  gleich(st({ kontaktAm: "2026-11-02T10:00:00Z", keinInteresseAm: "2026-11-03T10:00:00Z" }), ["kein_interesse", "2026-11-03"], "kein Interesse nach dem Kontakt");
  gleich(st({ keinInteresseAm: "2026-11-03T10:00:00Z", angebotAm: "2026-11-09T10:00:00Z" }), ["angebot", "2026-11-09"], "später doch ein Angebot: die neuere Stufe gilt");
  gleich(Object.keys(S.KOOP_EMPFEHLUNG_STAND_TEXT), ["gemeldet", "kontaktiert", "gespraech", "angebot", "kunde", "kein_interesse"], "sechs Stufen");
  gleich([S.KOOP_EMPFEHLUNG_STAND_TEXT.kontaktiert, S.KOOP_EMPFEHLUNG_STAND_TEXT.gespraech], ["Kontakt aufgenommen", "Gespräch vereinbart"], "Stufen-Texte");
}

abschnitt("A6 Meldung im Partnerbereich — Telefon ODER E-Mail");
{
  const p = (o: Record<string, unknown>) => S.koopEmpfehlungAus({ name: "Erika Beispiel", ...o }, { kontaktPflicht: true });
  ok(!p({}).ok && /Telefonnummer oder E-Mail/.test((p({}) as any).error), "ohne beides: abgelehnt mit klarem Satz");
  ok(p({ telefon: "+49 151 00000000" }).ok && p({ email: "erika@beispiel.example" }).ok, "Telefon allein oder E-Mail allein genügt");
  ok(!p({ telefon: "12" }).ok, "Telefon mit zu wenigen Ziffern: abgelehnt");
  gleich((p({ email: "Erika@Beispiel.EXAMPLE" }) as any).email, "erika@beispiel.example", "E-Mail klein");
  ok(S.koopEmpfehlungAus({ name: "Erika Beispiel" }).ok, "Leitung (ohne Pflicht): Name genügt wie bisher");
  ok(/Mit E-Mail bekommt die Person sofort eine persönliche Einladung/.test(S.KOOP_EMPFEHLUNG_TEXTE.kontaktHinweis), "Hinweis im Partnerbereich");
  gleich(S.KOOP_EMPFEHLUNG_IP, "partner-empfehlung", "Kennung der Anfrage aus einer Empfehlung");
}

abschnitt("A7 Willkommens-Mail „Empfehlung“ durch die Lead-Wand");
{
  const LINK = { url: "https://fiaon.com/g/AbCdEfGh23", anzeige: "fiaon.com/g/AbCdEfGh23", bis: new Date("2026-12-09T10:00:00Z") };
  const JETZT = new Date("2026-11-09T13:00:00Z"); // Montag, 14:00 Uhr Berlin
  const NR = "4915100000000";
  const W = (over: Record<string, unknown> = {}) => T.willkommenText({
    sprache: "de", name: "Max Muster", kanal: "website", antworten: [], mitNachricht: false, paketName: null, oesterreich: false,
    bestandskunde: false, link: LINK, eingangAm: new Date(JETZT.getTime() - 12 * 60_000), jetzt: JETZT,
    ruf: { kollege: "Daniel Beispiel", weiblich: false, art: "heute" }, empfehler: { name: "Erika Beispiel", nachname: "Beispiel", anrede: "Frau" }, ...over,
  } as any);
  const klar = (m: any) => T.leadMailKlartext(m);
  const faelle: [string, any][] = [];
  for (const sprache of ["de", "en"] as const) {
    const m = W({ sprache, whatsapp: { url: MB.waGlobalLink(NR, "AbCdEfGh23", sprache)! } });
    faelle.push([`Empfehlung ${sprache}`, m]);
    const k = klar(m);
    const erster = String((m.bloecke[0] as any).text ?? "");
    ok(sprache === "de" ? erster.startsWith("Frau Beispiel hat mir Ihren Kontakt gegeben") : erster.startsWith("Ms Beispiel passed your details on to me"), `erster Satz nennt den Empfehlenden (${sprache})`, erster);
    ok(!/vielen Dank für Ihre Anfrage|thank you for your enquiry/i.test(k) && !/Sie möchten wissen|You would like to know/.test(k), `kein „Dank für Ihre Anfrage“, kein Vorhaben-Satz (${sprache})`);
    ok(k.includes(LINK.url), `persönlicher Terminlink (${sprache})`);
    ok(sprache === "de" ? /mein Kollege Daniel Beispiel/.test(k) : /my colleague Daniel Beispiel/.test(k), `„mein Kollege ruft Sie an“ (${sprache})`);
    ok(k.includes(MB.waGlobalLink(NR, "AbCdEfGh23", sprache)!), `Maras WhatsApp-Link wie in W (${sprache})`);
    gleich(await LP.leadMailPruefen(m, { maraNummer: NR }), [], `Lead-Wand ohne Fund (${sprache})`);
  }
  const ohneAnrede = W({ empfehler: { name: "Erika Beispiel", nachname: "Beispiel", anrede: null } });
  faelle.push(["ohne Anrede", ohneAnrede]);
  ok(String((ohneAnrede.bloecke[0] as any).text).startsWith("Erika Beispiel hat mir Ihren Kontakt gegeben"), "ohne Anrede: der volle Name");
  const spaet = W({ eingangAm: new Date(JETZT.getTime() - 2 * 86_400_000) });
  faelle.push(["zwei Tage später", spaet]);
  ok(String((spaet.bloecke[0] as any).text).startsWith("Frau Beispiel") && !/Entschuldigen/.test(klar(spaet)), "später versandt: trotzdem der Empfehlungs-Satz, keine Entschuldigung für eine Anfrage, die es nie gab");
  const leer = W({ kalenderLeer: true });
  faelle.push(["Kalender leer", leer]);
  ok(!klar(leer).includes(LINK.url) && /vereinbart mit Ihnen einen Termin/.test(klar(leer)), "Kalender leer: wer anruft und den Termin vereinbart");
  const boese = W({ empfehler: { name: "Gewinn www.preis-sofort.example", nachname: null, anrede: null } });
  faelle.push(["Empfehler mit Adresse", boese]);
  ok(!klar(boese).includes("preis-sofort") && klar(boese).includes("vielen Dank für Ihre Anfrage"), "ein Empfehler-Name, der nach Adresse aussieht, steht nie in Justins Mail (übliche Fassung)");
  const ohne = W({ empfehler: null });
  ok(klar(ohne).includes("vielen Dank für Ihre Anfrage. Ihre Angaben sind bei mir angekommen.") && klar(ohne).includes("Sie möchten wissen, wie FIAON Global für Sie funktioniert."), "ohne Empfehler: W wie bisher (Website-Fassung unverändert)");
  for (const [name, m] of faelle) {
    const funde = await LP.leadMailPruefen(m, { maraNummer: NR });
    ok(funde.length === 0, `Wand ohne Fund: ${name}`, funde);
    ok((klar(m).match(/[–—]/g) ?? []).length <= 1, `höchstens ein Gedankenstrich: ${name}`);
    ok(!/\bmorgen\b|\btomorrow\b/i.test(klar(m)) && T.platzhalterWache(klar(m)).length === 0, `nie „morgen“, keine Platzhalter: ${name}`);
    ok(m.betreff === T.LEAD_BETREFF[m.sprache as "de" | "en"], `Betreff wie N1–N3 (derselbe Faden): ${name}`);
  }
}

abschnitt("A8 Quelltext-Wände");
{
  const srv = lies("server/lib/fiaon-koop-empfehlung.ts");
  const eintragen = srv.split("export async function koopEmpfehlungEintragen(")[1]?.split("\n}\n")[0] ?? "";
  ok(eintragen.indexOf("INSERT INTO fiaon_koop_empfehlungen") > 0 && eintragen.indexOf("empfehlungAlsLead(") > eintragen.indexOf("INSERT INTO fiaon_koop_empfehlungen"), "Eintragen: der Lead-Weg läuft NACH dem INSERT");
  ok(/kontaktPflicht: quelle === "partner"/.test(eintragen), "Partnerbereich: Telefon ODER E-Mail Pflicht");
  const lead = srv.split("async function empfehlungAlsLead(")[1]?.split("\n}\n")[0] ?? "";
  ok(/globalAnfrageAnnehmen\(\{/.test(lead) && /ip: KOOP_EMPFEHLUNG_IP/.test(lead) && /SET anfrage_id = \$\{erg\.anfrageId\}/.test(lead), "Lead-Weg: globalAnfrageAnnehmen mit Kennung, anfrage_id gemerkt");
  const ensE = srv.split("export function ensureEmpfehlungTabelle(")[1]?.split("\n}\n")[0] ?? "";
  ok(/SET LOCAL lock_timeout = '3s'/.test(ensE) && /ADD COLUMN IF NOT EXISTS anfrage_id INTEGER/.test(ensE) && /information_schema\.columns/.test(ensE), "anfrage_id additiv: erst Katalog, dann mit lock_timeout");
  const ensG = srv.split("export function ensureGutschriftTabelle(")[1]?.split("\n}\n")[0] ?? "";
  ok(/SET LOCAL lock_timeout = '3s'/.test(ensG) && /ADD COLUMN IF NOT EXISTS art VARCHAR\(10\) NOT NULL DEFAULT 'monat'/.test(ensG) && /fiaon_koop_gutschriften \(angebot_id, monat, art\)/.test(ensG) && /DROP CONSTRAINT IF EXISTS fiaon_koop_gutschriften_angebot_id_monat_key/.test(ensG), "Gutschrift: Spalte art und UNIQUE(angebot_id, monat, art) additiv mit lock_timeout");
  const anlegen = srv.split("export async function koopGutschriftAnlegen(")[1]?.split("\n}\n")[0] ?? "";
  ok(anlegen.indexOf("pg_advisory_xact_lock") > 0 && anlegen.indexOf("koopOffenePosten(") > anlegen.indexOf("pg_advisory_xact_lock") && /bisherigePosten\(id, tx\)/.test(anlegen), "Posten werden unter dem Advisory-Lock gerechnet (Lauf und Knopf nie doppelt)");
  ok(!/auftragEinreichen|auftragFreigeben|auftragAusfuehren|ausfuehren\(/.test(srv), "nie Geld: der Zahlungsauftrag bleibt Entwurf (kein Einreichen, keine Freigabe)");
  const monatsbericht = srv.split("export async function koopMonatsberichtBauen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/AND art = 'monat'/.test(monatsbericht), "Monatsbericht hängt nur die Monatsabrechnung an (Nachtrag hat eigene Mail)");
  ok(!/koopEmpfehlungenZuordnen/.test(lies("server/lib/fiaon-koop-lieferung.ts")), "Zuordnung NICHT im Lieferlauf (eigene Datei-Grenze)");
  ok(/tageslauf\('koop_empfehlung_zuordnen'/.test(lies("server/routes.ts")) && /koop_empfehlung_zuordnen: \{/.test(lies("server/lib/fiaon-crons.ts")), "eigener Lauf, stündlich, im Lauf-Katalog");
  const zuordnen = srv.split("export async function koopEmpfehlungenZuordnen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/person_id IS NULL AND COALESCE\(zuordnung_weg, ''\) <> 'hand_geloest' RETURNING id/.test(zuordnen) && /koop-empfehlung-zuordnen:\$\{e\.id\}/.test(zuordnen) && /koop-empfehlung-anruf:\$\{e\.id\}/.test(zuordnen), "Lauf: setzt nur leere Zuordnung, je Empfehlung höchstens eine Frage und ein Anruf-Auftrag");
  ok(!/globalAnfrageAnnehmen|willkommenSenden|freitextSenden/.test(zuordnen), "Altbestand: keine Anfrage, keine Mail an die empfohlene Person");
  ok(/if \(!CRONS_AN\) return;/.test(srv.split("async function zuordnungMelden(")[1] ?? ""), "Info an Justin nur im Betrieb");
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  ok(/const empfehlung = a\.ip === KOOP_EMPFEHLUNG_IP;/.test(post) && /mitNachricht: !meta && !empfehlung && rumpf\.length >= 3/.test(post) && /empfehler: lage\.empfehler \?\? null/.test(post), "lead_post: erkennt die Empfehlung, keine „Nachricht“, Empfehler in W");
  ok(/lage\.ip !== KOOP_EMPFEHLUNG_IP\) \{/.test(post), "lead_post: keine Flut-Regel für Empfehlungen");
  const termin = lies("server/lib/fiaon-global-termin.ts");
  const annehmen = termin.split("export async function globalAnfrageAnnehmen(")[1]?.split("\n}\n")[0] ?? "";
  ok((annehmen.match(/\$\{k\.email\} <> ''/g) ?? []).length === 2, "Eingang: leere E-Mail trifft keine fremde Bestellung (Kunde und Privat-Bestand)");
  const route = lies("server/routes/fiaon-global-angebot.ts");
  ok(/router\.post\("\/admin\/global\/angebote\/:id\/koop\/gutschrift-nachtrag", requireChef\("leitung"\)/.test(route), "Route „Nachtrag jetzt abrechnen“ nur für die Leitung");
  const chef = lies("client/src/components/admin/ChefGlobalAngebote.tsx");
  const knopf = chef.split(">Nachtrag jetzt abrechnen</button>")[0] ?? "";
  ok(chef.includes(">Nachtrag jetzt abrechnen</button>") && /\/gutschrift-nachtrag/.test(knopf.slice(-700)) && /window\.confirm\(/.test(knopf.slice(-700)) && /n\.posten\.map\(/.test(chef), "Chefbüro: Knopf mit Vorschau der Posten und Rückfrage");
  const partner = lies("client/src/pages/koop-partner.tsx");
  ok(/T\.kontaktHinweis/.test(partner) && /\(!form\.telefon\.trim\(\) && !form\.email\.trim\(\)\)/.test(partner) && /x\.standAmText/.test(partner), "Partnerbereich: Hinweis, Telefon oder E-Mail, Stufe mit Datum");
  ok(/Nachtrag jetzt abrechnen/.test(lies("client/src/pages/agent/rundgaenge.ts")), "Rundgang des Raums mitgezogen");
  const gepr = ["shared/fiaon-koop-empfehlung.ts", "server/lib/fiaon-koop-empfehlung.ts", "scripts/pruef-koop-provision.ts"].map((p) => [p, lies(p)] as const);
  ok(gepr.every(([, s]) => !/FIAON-IA-K[0-9A-F]{6}\b/.test(s)), "keine echte Kooperations-Ref im Code (nur über KOOP_FASTTRACK_ZAEHLT)");
}

console.log(`\n${fehler ? "✗" : "✓"} pruef-koop-provision: ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? ` — ${fehler} rot` : ""}`);
process.exit(fehler ? 1 : 0);
