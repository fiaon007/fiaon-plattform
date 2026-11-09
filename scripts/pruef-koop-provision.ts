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
//      E-487 Nachbesserung (Gutachten, 09.11.2026): A9 Satz am Zahltag (Verlauf, nie rückwirkend) · alte Posten je Zahlung einmal ·
//      A10 Zuordnung nur sicher (Name = Vorschlag, belegte Person = Frage, Fenster) · Doppelt · Lead-Entscheid (Einverständnis,
//      Deckel) · Stufe nie vor dem Meldetag · Empfehlung nie in der Beschwerde-Weiche · N3/W ohne „Ihre Anfrage“ ·
//      A11 Quelltext-Wände der Nachbesserung (Partner ohne Personen-Nr., eine Zahlung = eine Empfehlung, Sperre beim Nachbereiten …)
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
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "telefon", seit: "2026-07-01T08:00:00Z" }], G), { art: "pruefen", personId: 7, wege: ["telefon"], seit: "2026-07-01T08:00:00.000Z", gruende: ["frueher"] }, "Person schon lange bei uns: Justin entscheidet");
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
  // E-487 Nachbesserung (Mangel 12): trotzdem die Empfehlungs-Fassung — nie „vielen Dank für Ihre Anfrage“ an jemanden, der nie anfragte.
  ok(!klar(boese).includes("preis-sofort") && klar(boese).includes("Ein Geschäftspartner von uns hat mir Ihren Kontakt gegeben") && !klar(boese).includes("vielen Dank für Ihre Anfrage"), "ein Empfehler-Name, der nach Adresse aussieht, steht nie in Justins Mail (Empfehlungs-Fassung ohne Namen)");
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
  ok(/person_id IS NULL AND COALESCE\(zuordnung_weg, ''\) <> 'hand_geloest'\s+AND NOT EXISTS/.test(zuordnen) && /koop-empfehlung-zuordnen:\$\{e\.id\}/.test(zuordnen) && /koop-empfehlung-anruf:\$\{e\.id\}/.test(zuordnen), "Lauf: setzt nur leere Zuordnung, je Empfehlung höchstens eine Frage und ein Anruf-Auftrag");
  ok(!/globalAnfrageAnnehmen|willkommenSenden|freitextSenden/.test(zuordnen), "Altbestand: keine Anfrage, keine Mail an die empfohlene Person");
  ok(/if \(!CRONS_AN\) return;/.test(srv.split("async function zuordnungMelden(")[1] ?? ""), "Info an Justin nur im Betrieb");
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  ok(/const empfehlung = a\.ip === KOOP_EMPFEHLUNG_IP;/.test(post) && /mitNachricht: !meta && !empfehlung && rumpf\.length >= 3/.test(post) && /empfehler: lage\.empfehler \?\? null/.test(post), "lead_post: erkennt die Empfehlung, keine „Nachricht“, Empfehler in W");
  ok(/!\/\^meta\/\.test\(lage\.ip\) && !lage\.empfehler\) \{/.test(post), "lead_post: keine Flut-Regel nur für eine WIRKLICH verknüpfte Empfehlung (Nachbesserung Mangel 7)");
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

// ═══════════════════════════════════════════════════════════════════════════
// E-487 NACHBESSERUNG (Gutachten, 09.11.2026)
// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A9 Satz am Zahltag — eine Erhöhung zahlt nie rückwirkend (Mangel 8) · alte Posten (Mangel 10)");
{
  type Zahlung = import("../shared/fiaon-koop-empfehlung").KoopZahlung;
  const Z = (o: Partial<Zahlung>): Zahlung => ({ empfehlungId: 1, name: "Erika Beispiel", ref: "FIAON-PRUEF-S", am: "2026-09-10T10:00:00.000Z", rateNr: null, teilVorherCents: 0, umsatzCents: 100000, ...o });
  // Ein Satz ohne Verlauf (so steht es heute in der Produktion): gilt für alle Zahlungen, auch die vor „seit“.
  const ohne = S.koopProvisionAus({ provision: { prozent: 30, seit: "2026-10-22" } })!;
  gleich([ohne.verlauf, S.koopSatzAm(ohne, "2026-09-10T10:00:00Z"), S.koopSatzAm(ohne, "2026-11-05T10:00:00Z")], [[], 30, 30], "ohne Verlauf: ein Satz für alles (wie bisher)");
  // Die Leitung erhöht am 20.11. auf 35 %: der alte Satz geht mit seinem Zeitraum in den Verlauf.
  const n = S.koopProvisionNeu({ provision: { prozent: 30, seit: "2026-10-22" } }, 35, "2026-11-20")!;
  gleich(n, { provision: { prozent: 35, seit: "2026-11-20" }, provisionVerlauf: [{ prozent: 30, seit: "2026-10-22", bis: "2026-11-20" }] }, "neuer Satz: alter Satz mit Zeitraum in den Verlauf");
  gleich(S.koopProvisionNeu({ provision: { prozent: 30, seit: "2026-10-22" } }, 30, "2026-11-20"), null, "derselbe Satz noch einmal: nichts ändert sich (kein neues „seit“)");
  const prov = S.koopProvisionAus({ provision: n.provision, provisionVerlauf: n.provisionVerlauf })!;
  gleich([S.koopSatzAm(prov, "2026-09-10T10:00:00Z"), S.koopSatzAm(prov, "2026-11-05T10:00:00Z"), S.koopSatzAm(prov, "2026-11-19T22:30:00Z"), S.koopSatzAm(prov, "2026-11-19T23:30:00Z"), S.koopSatzAm(prov, "2026-11-25T10:00:00Z")],
    [30, 30, 30, 35, 35], "Satz je Zahltag (Berliner Tag): vor dem ersten Satz der erste, davor 30 %, ab dem 20.11. 35 % (Mitternacht Berlin)");
  // Probe des Gutachtens: Zahlung aus 09/2026, mit 30 % = 300 € gutgeschrieben — nach der Erhöhung KEIN Nachtrag (vorher 50 €).
  const sep = Z({});
  const r = S.koopOffenePosten([sep], [{ empfehlungId: 1, ref: "FIAON-PRUEF-S", am: sep.am, provisionCents: 30000, schluessel: S.koopZahlungSchluessel(sep) }], prov, "2026-11");
  gleich([r.posten, r.zuViel], [[], []], "Erhöhung 30 → 35 %: kein rückwirkender Nachtrag für die gutgeschriebene September-Zahlung");
  const nov = Z({ ref: "FIAON-PRUEF-T", am: "2026-11-25T10:00:00.000Z" });
  gleich(S.koopOffenePosten([sep, nov], [{ empfehlungId: 1, ref: "FIAON-PRUEF-S", am: sep.am, provisionCents: 30000, schluessel: S.koopZahlungSchluessel(sep) }], prov, "2026-11").posten.map((p) => [p.ref, p.provisionCents, p.prozent]),
    [["FIAON-PRUEF-T", 35000, 35]], "Zahlung nach der Erhöhung: 35 % — der Posten trägt seinen Satz");
  // Spät zugeordnete Zahlung aus der Zeit VOR der Erhöhung: alter Satz.
  gleich(S.koopOffenePosten([Z({ ref: "FIAON-PRUEF-U", am: "2026-11-05T10:00:00.000Z" })], [], prov, null).posten.map((p) => [p.provisionCents, p.prozent]), [[30000, 30]], "spät zugeordnete Zahlung vor der Erhöhung: alter Satz (30 %)");
  // Provision entfernt und später neu gesetzt: in der Lücke 0.
  const weg = S.koopProvisionNeu({ provision: { prozent: 30, seit: "2026-10-22" } }, null, "2026-11-20")!;
  gleich(weg.provision, null, "Provision entfernt: provision = null, Satz im Verlauf");
  const wieder = S.koopProvisionNeu({ provision: null, provisionVerlauf: weg.provisionVerlauf }, 25, "2026-12-10")!;
  const pw = S.koopProvisionAus({ provision: wieder.provision, provisionVerlauf: wieder.provisionVerlauf })!;
  gleich([S.koopSatzAm(pw, "2026-11-01T10:00:00Z"), S.koopSatzAm(pw, "2026-11-30T10:00:00Z"), S.koopSatzAm(pw, "2026-12-15T10:00:00Z")], [30, 0, 25], "Lücke (Provision entfernt): 0 — davor der alte, danach der neue Satz");
  gleich(S.koopProvisionVerlaufAus({ provisionVerlauf: [{ prozent: 30, seit: "2026-10-22", bis: "2026-11-20" }, { prozent: "x", bis: "2026-01-01" }, { prozent: 99, bis: "2026-01-01" }, { prozent: 20 }] }),
    [{ prozent: 30, seit: "2026-10-22", bis: "2026-11-20" }], "Verlauf: nur gültige Einträge (Satz 0–50, mit Ende)");
  // Mangel 10: zwei alte Posten (ohne Schlüssel) zweier Teilzahlungen am selben Tag — jede Zahlung nimmt genau einen.
  const am = "2026-10-15T12:00:00.000Z";
  const teile = [Z({ ref: "FIAON-PRUEF-V", am, teilVorherCents: 0, umsatzCents: 50000 }), Z({ ref: "FIAON-PRUEF-V", am, teilVorherCents: 50000, umsatzCents: 30000 })];
  const alt = [{ empfehlungId: 1, ref: "FIAON-PRUEF-V", am, umsatzCents: 50000, provisionCents: 15000 }, { empfehlungId: 1, ref: "FIAON-PRUEF-V", am, umsatzCents: 30000, provisionCents: 9000 }];
  const t1 = S.koopOffenePosten(teile, alt, 30, null);
  gleich([t1.posten, t1.zuViel], [[], []], "zwei alte Posten zweier Teilzahlungen am selben Tag: nichts doppelt (vorher 90 € noch einmal)");
  const t2 = S.koopOffenePosten(teile, [alt[1], alt[0]], 30, null);
  gleich([t2.posten, t2.zuViel], [[], []], "… auch in umgekehrter Reihenfolge (der Zahlbetrag entscheidet)");
  const t3 = S.koopOffenePosten(teile, alt.map(({ umsatzCents: _u, ...x }) => x), 30, null);
  gleich([t3.posten, t3.zuViel], [[], []], "… und ohne Zahlbetrag im alten Posten: jede Zahlung nimmt höchstens einen (nie zweimal)");
  // Eine andere Rate ist nie „Ersatz“ für einen alten Posten, dessen Zahlung nicht mehr zählt.
  const raten = [Z({ ref: "FIAON-PRUEF-W", rateNr: 2, am: "2026-11-01T10:00:00.000Z", umsatzCents: 10000 }), Z({ ref: "FIAON-PRUEF-W", rateNr: 3, am: "2026-12-01T10:00:00.000Z", umsatzCents: 10000 })];
  gleich(S.koopOffenePosten(raten, [{ empfehlungId: 1, ref: "FIAON-PRUEF-W", am: "2026-10-01T10:00:00.000Z", provisionCents: 3000 }], 30, null).posten.length, 2, "alter Posten einer Rate, die nicht mehr zählt: keine andere Rate wird still verrechnet");
}

abschnitt("A10 Zuordnung nur sicher · Doppelt · Lead-Entscheid · Stufe · Weiche · Texte (Mangel 1, 3, 4, 6, 7, 11, 12, 14)");
{
  const G = "2026-11-01T10:00:00.000Z";
  // Mangel 4: nur über den Namen (auch „Kunde eines Angebots“ und Firma) = Vorschlag, nie automatisch.
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "name", seit: "2026-11-02T08:00:00Z" }, { personId: 7, weg: "angebot", seit: "2026-11-02T08:00:00Z" }], G),
    { art: "pruefen", personId: 7, wege: ["angebot", "name"], seit: "2026-11-02T08:00:00.000Z", gruende: ["nur_name"] }, "nur Name/Angebot: prüfen (Namensvetter wäre ein fremder Kunde)");
  gleich((S.koopZuordnungUrteil([{ personId: 7, weg: "firma", seit: G }], G) as any).gruende, ["nur_name"], "nur über die Firma: prüfen");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "telefon", seit: G }], G).art, "eindeutig", "Telefon: eindeutig");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "anfrage", seit: G }], G).art, "eindeutig", "eigene Anfrage der Empfehlung: eindeutig");
  // Mangel 4: Spuren nach dem Provisionsfenster zählen nicht (ein später angelegter Namensvetter).
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "email", seit: "2027-11-02T10:00:00Z" }], G), { art: "keiner" }, "Person erst nach Meldetag + 12 Monate angelegt: kein Kandidat");
  gleich(S.koopZuordnungUrteil([{ personId: 7, weg: "email", seit: "2027-10-30T10:00:00Z" }], G).art, "eindeutig", "… knapp im Fenster: zählt");
  // Mangel 1: Person hängt schon an einer anderen Empfehlung → Frage an Justin, nie zweimal Provision.
  const bel = S.koopZuordnungUrteil([{ personId: 7, weg: "email", seit: G }], G, { belegt: new Map([[7, 42]]) });
  gleich(bel, { art: "pruefen", personId: 7, wege: ["email"], seit: G, gruende: ["belegt"], belegtVon: 42 }, "Person schon an Empfehlung #42: prüfen (nie dieselbe Zahlung zweimal)");
  const saetze = S.koopZuordnungGruendeText(bel as any, (d) => d.slice(0, 10));
  ok(saetze.length === 1 && /#42/.test(saetze[0]) && /eine Zahlung zählt nur für eine Empfehlung/.test(saetze[0]), "Aufgabe nennt die andere Empfehlung", saetze);
  ok(S.koopZuordnungGruendeText({ art: "pruefen", personId: 7, wege: ["name"], seit: "2026-07-01T08:00:00.000Z", gruende: ["frueher", "nur_name"] }, (d) => d.slice(0, 10)).length === 2, "mehrere Gründe: je ein Satz");
  gleich(S.KOOP_ZUORDNUNG_STARK, ["anfrage", "email", "telefon"], "sichere Wege: Anfrage, E-Mail, Telefon");
  // Mangel 1: doppelt beim selben Partner — auch mit Titel, anderer Reihenfolge, gleicher E-Mail oder Telefonnummer.
  const da = [{ name: "Max Muster", email: "max@muster.example", telefon: "+49 151 0000 0001" }];
  ok(S.koopEmpfehlungDoppelt({ name: "Dr. Max Muster" }, da) && S.koopEmpfehlungDoppelt({ name: "Muster Max" }, da) && S.koopEmpfehlungDoppelt({ name: "max muster" }, da), "doppelt: Titel, Reihenfolge, Groß/klein");
  ok(S.koopEmpfehlungDoppelt({ name: "M. Muster", email: "MAX@muster.example" }, da) && S.koopEmpfehlungDoppelt({ name: "Herr M.", telefon: "0151 00000001" }, da), "doppelt: gleiche E-Mail oder gleiche letzte neun Telefonziffern");
  ok(!S.koopEmpfehlungDoppelt({ name: "Erika Muster", email: "erika@muster.example", telefon: "+49 151 0000 0002" }, da) && !S.koopEmpfehlungDoppelt({ name: "Max Muster-Beispiel" }, da), "nicht doppelt: andere Person");
  // Mangel 6 + 7: Lead nur mit Einverständnis, ohne Personen-Nr., mit Kontaktweg — Partner höchstens 5 in 24 Stunden.
  const L = (o: Record<string, unknown>) => S.koopEmpfehlungLeadEntscheid({ personId: null, email: "a@b.example", telefon: null, einverstanden: true, quelle: "partner", letzte24h: 0, ...o } as any);
  gleich([L({}), L({ letzte24h: 4 }), L({ letzte24h: 5 }), L({ quelle: "fiaon", letzte24h: 50 })], [{ lead: true }, { lead: true }, { lead: false, grund: "deckel" }, { lead: true }], "Deckel: die sechste Partner-Empfehlung in 24 Stunden ist kein Lead (Leitung ohne Deckel)");
  gleich([L({ einverstanden: false, quelle: "fiaon" }), L({ personId: 7, quelle: "fiaon" }), L({ email: null })], [{ lead: false, grund: "einverstanden" }, { lead: false, grund: "person" }, { lead: false, grund: "kontakt" }], "ohne Einverständnis, mit Personen-Nr. oder ohne Kontakt: kein Lead");
  gleich(S.KOOP_EMPFEHLUNG_LEAD_MAX_TAG, 5, "Deckel je Kooperation: 5 in 24 Stunden");
  ok(Object.values(S.KOOP_OHNE_LEAD_TEXT).every((t) => t.length > 10), "jeder Grund ohne Lead hat einen Satz fürs Chefbüro");
  // Mangel 14: Die Einwilligung deckt den Stand ab, den der Partner sieht.
  ok(/Stand der Empfehlung mitteilt/.test(S.KOOP_EMPFEHLUNG_TEXTE.einverstanden) && /dem Partner den Stand mitteilt/.test(S.KOOP_EMPFEHLUNG_TEXTE.einverstandenLeitung), "Einwilligung: Kontakt UND Stand an den Partner (Partnerbereich und Chefbüro)");
  // Mangel 11: Das Datum der Stufe ist nie früher als der Meldetag — die Reihenfolge rechnet mit den echten Zeiten.
  const st = (o: Record<string, string>) => { const r = S.koopEmpfehlungStufe({ gemeldetAm: G, ...o }); return [r.stand, r.am ? r.am.toISOString() : null]; };
  gleich(st({ angebotAm: "2026-10-10T10:00:00Z" }), ["angebot", G], "Angebot vor der Meldung: Stufe bleibt, Datum = Meldetag");
  gleich(st({ keinInteresseAm: "2026-10-20T10:00:00Z", angebotAm: "2026-10-25T10:00:00Z" }), ["angebot", G], "Reihenfolge mit echten Zeiten (Angebot nach „kein Interesse“), Datum = Meldetag");
  gleich(st({ kontaktAm: "2026-11-03T10:00:00Z" }), ["kontaktiert", "2026-11-03T10:00:00.000Z"], "nach der Meldung: das echte Datum");
  // Mangel 3: Die Notiz des Partners geht nie in die Weiche — mit leerer Nachricht bleibt die Empfehlung Global.
  const LD = await import("../shared/fiaon-global-lead");
  const firma = LD.firmaOffenPlatzhalter("Max Muster");
  for (const notiz of ["Die Hausbank hat ihm eine Finanzierung versprochen und dann abgesagt.", "Wurde von einem Finanzvermittler abgezockt, sucht seriöse Hilfe."]) {
    const mit = T.privatWeiche({ nachricht: `Empfehlung von Erika Beispiel (Kooperation FIAON-IA-KTEST01): ${notiz}`, privatBestand: false, zahlend: false, firmaBrauchbar: LD.firmaBrauchbar(firma, "Max Muster").brauchbar, globalInteresse: true });
    const ohneN = T.privatWeiche({ nachricht: null, privatBestand: false, zahlend: false, firmaBrauchbar: LD.firmaBrauchbar(firma, "Max Muster").brauchbar, globalInteresse: true });
    ok(mit.weg === "beschwerde" && ohneN.weg === "global", `Weiche: die Notiz allein machte „Beschwerde“ — ohne Notiz Global („${notiz.slice(0, 28)}…“)`, [mit.weg, ohneN.weg]);
  }
  // Mangel 12: W bei unbrauchbarem Empfehler-Namen und N3 bei Empfehlungen — nie „Ihre Anfrage“.
  const LINK = { url: "https://fiaon.com/g/AbCdEfGh23", anzeige: "fiaon.com/g/AbCdEfGh23", bis: new Date("2026-12-09T10:00:00Z") };
  const JETZT = new Date("2026-11-09T13:00:00Z");
  const NR = "4915100000000";
  for (const sprache of ["de", "en"] as const) {
    const w = T.willkommenText({
      sprache, name: "Max Muster", kanal: "website", antworten: [], mitNachricht: false, paketName: null, oesterreich: false, bestandskunde: false, link: LINK,
      eingangAm: new Date(JETZT.getTime() - 12 * 60_000), jetzt: JETZT, ruf: { kollege: "Daniel Beispiel", weiblich: false, art: "heute" },
      empfehler: { name: "Gewinn www.preis-sofort.example", nachname: null, anrede: null },
    } as any);
    const k = T.leadMailKlartext(w);
    ok((sprache === "de" ? /^Ein Geschäftspartner von uns hat mir Ihren Kontakt gegeben/ : /^A business partner of ours passed your details on to me/).test(String((w.bloecke[0] as any).text)) && !/preis-sofort|vielen Dank für Ihre Anfrage|thank you for your enquiry/i.test(k),
      `W: Empfehler-Name taugt nicht → „Ein Geschäftspartner von uns“, nie „Dank für Ihre Anfrage“ (${sprache})`, String((w.bloecke[0] as any).text));
    gleich(await LP.leadMailPruefen(w, { maraNummer: NR }), [], `W „Geschäftspartner“ durch die Lead-Wand (${sprache})`);
    // Partnername leer (koopEmpfehlerFuerAnfrage liefert dann name „“): dieselbe neutrale Fassung, nie die Anfrage-Fassung.
    const leerName = T.willkommenText({
      sprache, name: "Max Muster", kanal: "website", antworten: [], mitNachricht: false, paketName: null, oesterreich: false, bestandskunde: false, link: LINK,
      eingangAm: new Date(JETZT.getTime() - 12 * 60_000), jetzt: JETZT, ruf: { kollege: "Daniel Beispiel", weiblich: false, art: "heute" }, empfehler: { name: "", nachname: null, anrede: null },
    } as any);
    ok(/^(Ein Geschäftspartner von uns|A business partner of ours)/.test(String((leerName.bloecke[0] as any).text)), `W: Partnername leer → neutrale Empfehlungs-Fassung (${sprache})`);
    const n3e = T.nachfassText(3, { sprache, name: "Max Muster", link: LINK, willkommenAm: new Date(JETZT.getTime() - 9 * 86_400_000), jetzt: JETZT, angaben: null, empfehlung: true });
    const n3 = T.nachfassText(3, { sprache, name: "Max Muster", link: LINK, willkommenAm: new Date(JETZT.getTime() - 9 * 86_400_000), jetzt: JETZT, angaben: null });
    ok(!/Anfrage|enquiry/.test(T.leadMailKlartext(n3e)) && (sprache === "de" ? /letzte Nachricht dazu\./ : /last message on this\./).test(T.leadMailKlartext(n3e)), `N3 bei Empfehlung ohne „Ihre Anfrage“ (${sprache})`);
    ok((sprache === "de" ? /letzte Nachricht zu Ihrer Anfrage\./ : /last message about your enquiry\./).test(T.leadMailKlartext(n3)), `N3 sonst unverändert (${sprache})`);
    gleich(await LP.leadMailPruefen(n3e, { maraNummer: NR }), [], `N3 „Empfehlung“ durch die Lead-Wand (${sprache})`);
  }
}

abschnitt("A11 Quelltext-Wände der Nachbesserung");
{
  const srv = lies("server/lib/fiaon-koop-empfehlung.ts");
  const fn = (name: string) => srv.split(name)[1]?.split("\n}\n")[0] ?? "";
  const eintragen = fn("export async function koopEmpfehlungEintragen(");
  ok(/const personId = quelle === "partner" \? null : e\.personId;/.test(eintragen) && /VALUES \(\$\{Number\(z\.id\)\}, \$\{personId\},/.test(eintragen) && !/\$\{e\.personId\}/.test(eintragen), "Mangel 2: Partner setzt nie eine Personen-Nummer (INSERT mit personId, nie e.personId)");
  ok(/res\.json\(\{ ok: true, id: r\.id \}\)/.test(lies("server/routes/fiaon-koop.ts")), "Mangel 2: Partnerbereich bekommt nur „gespeichert“ (keine Lead-Interna)");
  ok(/personSchonEmpfohlen\(personId, null\)/.test(eintragen) && /koopEmpfehlungDoppelt\(e, vorhanden\)/.test(eintragen), "Mangel 1: Eintragen prüft belegte Person und Doppelte (Name, E-Mail, Telefon)");
  ok(/personSchonEmpfohlen\(pid, eid\)/.test(fn("export async function koopEmpfehlungAendern(")), "Mangel 1: Zuordnen von Hand prüft, ob die Person schon an einer anderen Empfehlung hängt");
  const lesen = fn("async function koopZahlungenLesen(");
  const sicht = fn("export async function koopEmpfehlungSicht(");
  ok(/\$\{KOOP_NUR_ERSTE_EMPFEHLUNG_SQL\}/.test(lesen) && /\$\{KOOP_NUR_ERSTE_EMPFEHLUNG_SQL\}/.test(sicht), "Mangel 1: beide Geld-Abfragen zählen jede Zahlung nur für die früheste Empfehlung");
  ok(/x\.person_id = e\.person_id AND x\.entfernt_am IS NULL AND x\.id <> e\.id/.test(K.KOOP_NUR_ERSTE_EMPFEHLUNG_SQL) && /q\.am >= x\.gemeldet_am AND q\.am < x\.gemeldet_am \+ make_interval\(months => \$2\)/.test(K.KOOP_NUR_ERSTE_EMPFEHLUNG_SQL), "Mangel 1: Regel „früheste Empfehlung, in deren Fenster die Zahlung fällt“");
  ok(/koopSatzAm\(prov, am\)/.test(sicht) && !/koopProvisionCents\(umsatz, prov\.prozent\)/.test(sicht), "Mangel 8: Liste rechnet je Zahlung mit dem Satz am Zahltag");
  const anlegen = fn("export async function koopGutschriftAnlegen(");
  ok(/bisherigePosten\(id, tx\), prov,/.test(anlegen) && !/prov\.prozent, art ===/.test(anlegen), "Mangel 8: Gutschrift rechnet mit der Provision samt Verlauf (nie rückwirkend mit dem heutigen Satz)");
  ok(/koopProvisionNeu\(/.test(fn("export async function koopProvisionSetzen(")), "Mangel 8: neuer Satz geht über koopProvisionNeu (Verlauf)");
  const nach = srv.split("async function gutschriftNachbereiten(")[1]?.split("async function gutschriftNachbereitenJetzt(")[0] ?? "";
  ok(/pg_try_advisory_xact_lock\(\$\{GS_NACH_SPERRE\}, \$\{Number\(gRoh\.id\)\}\)/.test(nach) && /SELECT \* FROM fiaon_koop_gutschriften WHERE id = /.test(nach), "Mangel 9: Nachbereiten einer Gutschrift nur einmal zugleich, Zeile frisch gelesen");
  const zuordnen = fn("export async function koopEmpfehlungenZuordnen(");
  ok(/e\.zuordnung_frage_am IS NULL/.test(zuordnen) && /make_interval\(months => \$\{KOOP_PROVISION_MONATE \+ 1\}\)/.test(zuordnen) && /ORDER BY e\.zuordnung_geprueft_am NULLS FIRST, e\.id LIMIT 200/.test(zuordnen), "Mangel 5: im Fenster, ohne offene Frage, reihum");
  ok(/belegteDurch\(/.test(zuordnen) && /koopZuordnungUrteil\(kandidaten, e\.gemeldet_am, \{ belegt \}\)/.test(zuordnen), "Mangel 1/4: Urteil kennt belegte Personen");
  ok(/if \(erg\.fehler\) throw new Error\(/.test(zuordnen) && !/catch \(err\) \{\s*console\.error\("\[KOOP\] Zuordnungs-Lauf/.test(zuordnen), "Mangel 13: Fehler kommen in die Lauf-Historie (kein stiller Erfolg)");
  ok(/throw new Error\(`Spurensuche/.test(fn("async function zuordnungKandidaten(")) && (fn("async function zuordnungKandidaten(").match(/created_at < \$\{bis\}/g) ?? []).length >= 9, "Mangel 4/13: Spuren bis Meldetag + 12 Monate, eine gescheiterte Abfrage stoppt die Suche");
  ok(/const einverstanden = !!e\.einverstanden_am \|\| String\(e\.quelle\) === "partner";/.test(zuordnen), "Mangel 6: Altbestand-Anruf nur mit Einverständnis");
  ok(/einverstanden_am, einverstanden_von, einverstanden_text/.test(eintragen) && /koopEmpfehlungLeadEntscheid\(/.test(eintragen), "Mangel 6/7/14: Einwilligung gespeichert, Lead nach Entscheid (Einverständnis, Deckel)");
  ok(/empfehlungLeadBeenden\(/.test(fn("export async function koopEmpfehlungAendern(")) && /leadMailsBeenden\(anfrageId/.test(fn("async function empfehlungLeadBeenden(")), "Mangel 12: Entfernen stoppt Lead-Mails und schließt den Anruf-Auftrag");
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  ok(/if \(lage\.ip === KOOP_EMPFEHLUNG_IP && !lage\.empfehler\) \{/.test(post) && /export async function leadMailsBeenden\(/.test(post) && /empfehlung: lage\.ip === KOOP_EMPFEHLUNG_IP,/.test(post), "Mangel 7/12: keine W ohne verknüpfte Empfehlung, Stopp von außen, N3-Fassung");
  ok(/if \(lage\.empfehler === undefined\) return \{ ergebnis: "wartet"/.test(post) && /koopEmpfehlerFuerAnfrage\(anfrageId, lauf\)\)\.catch\(\(\) => undefined\)/.test(post), "Mangel 12: eine Lese-Störung lässt W warten (nie für immer ausgelassen)");
  ok(/if \(name\.length < 2\) return \{ name: "", nachname: null, anrede: null \};/.test(srv), "Mangel 12: leerer Partnername → Empfehler ohne Namen (neutrale Fassung statt keiner Mail)");
  const termin = lies("server/lib/fiaon-global-termin.ts");
  ok(/nachricht: istMeta \|\| ein\.empfehlung === true \? null : ein\.text,/.test(termin) && /empfehlung: true,/.test(fn("async function empfehlungAlsLead(")), "Mangel 3: die Notiz des Partners geht nie in die Weiche");
  ok(/\/\^\[0-9A-Fa-f:\.\]\{3,45\}\$\/\.test\(vorn\)/.test(lies("server/routes/fiaon-anfragen.ts")), "Mangel 7: /anfrage nimmt aus X-Forwarded-For nur eine echte IP-Adresse");
  const chef = lies("client/src/components/admin/ChefGlobalAngebote.tsx");
  ok(/KOOP_EMPFEHLUNG_TEXTE\.einverstandenLeitung/.test(chef) && /einverstanden: neu\.einverstanden/.test(chef) && /x\.vorschlagPersonId != null \? String\(x\.vorschlagPersonId\)/.test(chef), "Chefbüro: Haken „einverstanden“, Vorschlag füllt das Feld vor");
  ok(/als Vorschlag im Feld/.test(lies("client/src/pages/agent/rundgaenge.ts")), "Rundgang mitgezogen (Haken, Vorschlag, eine Person = eine Empfehlung)");
  ok(/ADD COLUMN IF NOT EXISTS zuordnung_vorschlag JSONB/.test(fn("export function ensureEmpfehlungTabelle(")) && /Number\(n\?\.n\) < 10/.test(fn("export function ensureEmpfehlungTabelle(")), "neue Spalten additiv (Katalog, lock_timeout)");
}

console.log(`\n${fehler ? "✗" : "✓"} pruef-koop-provision: ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? ` — ${fehler} rot` : ""}`);
process.exit(fehler ? 1 : 0);
