// Prüfstand E-406 B2 (19.10.2026), OHNE Datenbank: Mara fordert fehlende KYC-Unterlagen nach, Vorprüfung, wer prüft,
// Umhängen. Nur die reinen Regeln (shared/fiaon-kyc-nachfordern.ts, shared/fiaon-unterlagen-vorpruefung.ts).
//   node_modules/.bin/tsx scripts/pruef-mara-kyc.ts
import {
  KYC_ABSTAND_TAGE, KYC_GRUND, KYC_HOECHSTENS, kycAnlassSatz, kycBitte, kycPrivatPaketSql, kycSchalterAn, kycUrteil, kycVertragLaeuftSql,
  type KycFakten,
} from "../shared/fiaon-kyc-nachfordern";
import {
  UNTERLAGEN_AUFGABE_ANFANG, darfPruefen, prueferWaehlen, umhaengenAn, umhaengenPasst, unterlagenAufgabeText, vorpruefName, vorpruefNotiz,
  type PrueferKandidat,
} from "../shared/fiaon-unterlagen-vorpruefung";
import { berlinMinuten } from "../shared/fiaon-nicht-erreicht-nachfass";
import { produktkategorieSql } from "../shared/fiaon-produktkategorie";
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 400)}` : ""}`); }
}

// Feste Zeiten (Berlin, Sommerzeit = UTC+2): Montag 20.10.2026 10:00 und 22:00.
const MO_10 = new Date("2026-10-20T08:00:00Z");
const MO_22 = new Date("2026-10-20T20:00:00Z");
const tage = (n: number, ab = MO_10) => new Date(ab.getTime() - n * 86_400_000);
const stunden = (n: number, ab = MO_10) => new Date(ab.getTime() - n * 3_600_000);

const basis = (x: Partial<KycFakten> = {}): KycFakten => ({
  personDa: true, vertragLaeuft: true, testkonto: false, globalKunde: false, gesperrt: false, kuendigungOffen: false, hatEmail: true,
  auswertungAblauf: false, fehlt: ["ausweis", "kontoauszug"], bezahltAm: tage(10), maraGesendet: 0, maraFehlversuche: 0,
  letzteBitteAm: null, letzterVersuchAm: null, letzteMailAm: null, ...x,
});

console.log("── 1 · „Der Vertrag läuft“ — eine Regel für Prüfliste und Mara");
{
  const sql = kycVertragLaeuftSql("a");
  ok(/a\.cancelled_at IS NULL/.test(sql) && /a\.archived_at IS NULL/.test(sql) && /a\.abo_gestoppt_am IS NULL/.test(sql), "storniert, archiviert, Abo gestoppt fallen heraus");
  ok(/a\.vertrag_ende_am IS NULL OR a\.vertrag_ende_am > NOW\(\)/.test(sql), "Vertragsende erreicht fällt heraus");
  ok(/a\.gekuendigt_am IS NULL OR a\.kuendigung_zurueckgenommen_am IS NOT NULL/.test(sql), "gekündigt fällt heraus — außer die Kündigung wurde zurückgenommen (die 32, die E-397 übersah)");
  ok(!/kyc_status/.test(sql), "der kyc_status wird nicht angefasst (bleibt gespeichert)");
  let wirft = false; try { kycVertragLaeuftSql("a; DROP TABLE x"); } catch { wirft = true; }
  ok(wirft, "fremder Alias wirft (kein SQL von außen)");
  const p = kycPrivatPaketSql("a");
  ok(/payment_status = 'paid'/.test(p) && /type, ''\) = 'private'/.test(p) && /FIAON-SCHUFA-/.test(p) && /ist_entwurf/.test(p), "nur bezahlte Privat-Pakete (keine Auskunft, keine Firma, kein Entwurf)");
  // Nachbesserung (Prüfer-Fund): „Paket“ = die eine Regel des Hauses, nicht type + Referenz.
  ok(p.includes(`${produktkategorieSql("a")} = 'konto'`), "Paket = Produktkategorie „konto“ — ein alter Auskunft-Kauf (type private, pack_key schufa) ist kein laufender Vertrag");
  ok(/NOT IN \([^)]*'schufa'[^)]*\)/.test(p) && /NOT IN \([^)]*'llc_paket'[^)]*\)/.test(p) && !/NOT IN \([^)]*'pro'[^)]*\)/.test(p), "kein Einmalkauf aus dem Katalog (Auskunft, LLC …) — die Abo-Pakete bleiben");
}

console.log("── 2 · Der Schalter");
ok(kycSchalterAn(undefined) && kycSchalterAn("") && kycSchalterAn("an"), "fehlt er, ist Mara an");
ok(!kycSchalterAn("aus") && !kycSchalterAn("0") && !kycSchalterAn("false") && !kycSchalterAn("OFF"), "„aus“, „0“, „false“, „off“ schalten ab");

console.log("── 3 · Das Urteil — wann Mara NICHT schreibt");
{
  const fall = (x: Partial<KycFakten>, art: string, grund: string, was: string) => {
    const u = kycUrteil(basis(x), MO_10);
    ok(u.art === art && (u as any).grund === grund, was, u);
  };
  fall({ personDa: false }, "auslassen", KYC_GRUND.personWeg, "Person weg → auslassen");
  fall({ vertragLaeuft: false }, "erledigt", KYC_GRUND.vertragAus, "beendeter/gekündigter Vertrag → nichts nachfordern");
  fall({ testkonto: true }, "auslassen", KYC_GRUND.test, "Testkonto → auslassen");
  fall({ globalKunde: true }, "auslassen", KYC_GRUND.global, "FIAON Global → auslassen");
  fall({ gesperrt: true }, "auslassen", KYC_GRUND.gesperrt, "Vertriebssperre → kein Kontakt");
  fall({ kuendigungOffen: true }, "auslassen", KYC_GRUND.kuendigung, "ungebuchter Kündigungsantrag → keine Bitte");
  fall({ fehlt: [] }, "erledigt", KYC_GRUND.vollstaendig, "nichts fehlt → erledigt");
  fall({ fehlt: ["schufa" as any] }, "erledigt", KYC_GRUND.vollstaendig, "nur die Auskunft fehlt → keine KYC-Erinnerung");
  fall({ maraGesendet: KYC_HOECHSTENS }, "erledigt", KYC_GRUND.genug, `nach ${KYC_HOECHSTENS} Erinnerungen ist Schluss`);
  fall({ maraGesendet: 5 }, "erledigt", KYC_GRUND.genug, "auch mit mehr Zeilen: nie eine dritte");
  fall({ auswertungAblauf: true }, "auslassen", KYC_GRUND.auswertung, "Bonitätsauswertung erinnert selbst → Mara nicht doppelt");
  fall({ hatEmail: false }, "auslassen", KYC_GRUND.keineMail, "ohne Mail-Adresse → auslassen");
  fall({ maraFehlversuche: 3 }, "auslassen", KYC_GRUND.fehlversuche, "drei gescheiterte Versuche → nicht weiter probieren");
}

console.log("── 4 · Das Urteil — warten (Abstand, Frequenzbremse, Fenster)");
{
  const w1 = kycUrteil(basis({ bezahltAm: tage(2) }), MO_10);
  ok(w1.art === "warten" && w1.grund === KYC_GRUND.frischBezahlt, "bezahlt vor 2 Tagen → wartet (die Begrüßung bittet schon)", w1);
  ok(w1.art === "warten" && Math.abs(w1.nichtVor.getTime() - (tage(2).getTime() + KYC_ABSTAND_TAGE * 86_400_000)) < 60_000, "… bis 4 Tage nach der Zahlung (im Fenster)", w1);
  const w2 = kycUrteil(basis({ letzteBitteAm: tage(3) }), MO_10);
  ok(w2.art === "warten" && w2.grund === KYC_GRUND.abstand, "Bitte (Akte/Verwaltung) vor 3 Tagen → wartet", w2);
  const w3 = kycUrteil(basis({ letzteMailAm: stunden(5) }), MO_10);
  ok(w3.art === "warten" && w3.grund === KYC_GRUND.mailAbstand, "andere Mail vor 5 Stunden → wartet (Frequenzbremse)", w3);
  const w4 = kycUrteil(basis({}), MO_22);
  ok(w4.art === "warten" && w4.grund === KYC_GRUND.fenster && berlinMinuten(w4.nichtVor) === 8 * 60, "22 Uhr → wartet bis 8 Uhr", w4);
  const w5 = kycUrteil(basis({ maraFehlversuche: 1, letzterVersuchAm: stunden(2) }), MO_10);
  ok(w5.art === "warten" && w5.grund === KYC_GRUND.fehlAbstand, "gescheitert vor 2 Stunden → wartet 24 Stunden", w5);
  const w8 = kycUrteil(basis({ maraGesendet: 1, letzteMaraAm: tage(2), letzteBitteAm: null }), MO_10);
  ok(w8.art === "warten" && w8.grund === KYC_GRUND.abstand, "Maras eigene Erinnerung (auch beim Senden unterbrochen, ohne Anfrage-Zeile) zählt für den Abstand", w8);
  const w6 = kycUrteil(basis({ letzteBitteAm: tage(1), letzteMailAm: stunden(1) }), MO_10);
  ok(w6.art === "warten" && w6.grund === KYC_GRUND.abstand, "mehrere Sperren → die längste gilt", w6);
  const w7 = kycUrteil(basis({ letzteBitteAm: tage(3.9, new Date("2026-10-20T17:30:00Z")) }), new Date("2026-10-20T17:30:00Z"));
  ok(w7.art === "warten" && berlinMinuten(w7.nichtVor) >= 8 * 60 && berlinMinuten(w7.nichtVor) < 20 * 60, "der Wartezeitpunkt liegt immer im Fenster 8–20 Uhr", w7);
}

console.log("── 5 · Das Urteil — senden");
{
  const s1 = kycUrteil(basis({}), MO_10);
  ok(s1.art === "senden" && s1.nummer === 1 && s1.arten.join(",") === "ausweis,kontoauszug", "alles frei → 1. Erinnerung, Ausweis + Kontoauszug", s1);
  const s2 = kycUrteil(basis({ maraGesendet: 1, letzteBitteAm: tage(5), fehlt: ["kontoauszug"] }), MO_10);
  ok(s2.art === "senden" && s2.nummer === 2 && s2.arten.join(",") === "kontoauszug", "5 Tage nach der 1. → 2. Erinnerung, nur was noch fehlt", s2);
  const s3 = kycUrteil(basis({ letzteMailAm: stunden(21), letzteBitteAm: tage(4.1) }), MO_10);
  ok(s3.art === "senden", "Abstände knapp vorbei → senden", s3);
  const s4 = kycUrteil(basis({ bezahltAm: null }), MO_10);
  ok(s4.art === "senden", "ohne Zahlungsdatum hält nichts auf (die anderen Wände gelten)", s4);
}

console.log("── 6 · Die Worte (Sie-Form, kein Preis, keine Frist, keine Drohung)");
{
  const saetze = [kycAnlassSatz(1), kycAnlassSatz(2), kycBitte("ausweis", "bitte_neu")!, kycBitte("kontoauszug", "bitte_neu")!];
  ok(saetze.every((x) => x && x.length > 20), "alle Sätze da");
  ok(saetze.every((x) => !/(€|\beuro\b|frist|letzte erinnerung|mahn|inkasso|gericht|anwalt|schufa-eintrag|gesperrt|du |dein)/i.test(x)), "kein Preis, keine Frist, kein „letzte Erinnerung“, keine Drohung, kein Du", saetze);
  ok(kycAnlassSatz(1) !== kycAnlassSatz(2), "die 2. Erinnerung klingt anders als die 1.");
  ok(kycBitte("ausweis", "fehlt") === null && kycBitte("kontoauszug", "fehlt") === null, "„fehlt“ nimmt den Standardsatz (BITTE_STANDARD)");
  ok(/Vorder- und Rückseite/.test(kycBitte("ausweis", "bitte_neu")!) && /drei Monate/.test(kycBitte("kontoauszug", "bitte_neu")!), "„bitte neu“ sagt genau, was gebraucht wird");
}

console.log("── 7 · Vorprüfung: die Notiz an der Unterlage");
{
  const g = vorpruefNotiz({ kategorie: "kontoauszug", urteil: { pruefbar: true, erkannt: true, vollstaendig: true }, namePasst: true });
  ok(g.ampel === "gruen" && g.notiz === "Kontoauszug · erkannt · lesbar · vollständig · Name passt", "grün: erkannt, lesbar, vollständig, Name passt", g);
  const r = vorpruefNotiz({ kategorie: "ausweis", urteil: { pruefbar: true, erkannt: false, vollstaendig: false, fehlt: ["Das Dokument sieht nicht wie ein Ausweisdokument aus"], klasse: "falsche_art" }, namePasst: null });
  ok(r.ampel === "rot" && /NICHT als Ausweis erkannt/.test(r.notiz) && /unvollständig/.test(r.notiz), "rot: falsche Art", r);
  const f = vorpruefNotiz({ kategorie: "ausweis", urteil: { pruefbar: false, erkannt: true, vollstaendig: true, klasse: "von_hand", ausweisArt: "reisepass" }, namePasst: null });
  ok(f.ampel === "gelb" && /Foto — bitte selbst ansehen/.test(f.notiz) && /erkannt \(Reisepass\)/.test(f.notiz) && /Name nicht prüfbar/.test(f.notiz), "Ausweisfoto: gelb, „bitte selbst ansehen“, Name nicht prüfbar (keine KI)", f);
  const n = vorpruefNotiz({ kategorie: "kontoauszug", urteil: { pruefbar: true, erkannt: true, vollstaendig: true }, namePasst: false });
  ok(n.ampel === "gelb" && /Name aus der Akte NICHT gefunden/.test(n.notiz), "Name nicht gefunden → gelb (Fehlen ist kein Beweis)", n);
  const u = vorpruefNotiz({ kategorie: "kontoauszug", urteil: { pruefbar: true, erkannt: true, vollstaendig: false, fehlt: ["Der Auszug deckt nur rund 1 Monat(e) ab — benötigt sind die letzten drei Monate"] }, namePasst: true });
  ok(u.ampel === "rot" && /unvollständig: Der Auszug deckt nur rund 1 Monat/.test(u.notiz), "unvollständig → rot mit Grund", u);
  const pw = vorpruefNotiz({ kategorie: "schufa", urteil: { pruefbar: false, erkannt: null, vollstaendig: false, klasse: "passwort" }, namePasst: null });
  ok(pw.ampel === "rot" && /mit Passwort geschützt/.test(pw.notiz) && /^Bonitätsauskunft/.test(pw.notiz), "Passwort → rot", pw);
  const z = vorpruefNotiz({ kategorie: "kontoauszug", urteil: null, namePasst: null });
  ok(z.ampel === "gelb" && /noch nicht gelesen/.test(z.notiz), "keine Prüfung zurück → gelb, „noch nicht gelesen“", z);
  const k = vorpruefNotiz({ kategorie: "kontoauszug", urteil: { kiPause: true }, namePasst: null });
  ok(/KI-Pause/.test(k.notiz) && k.ampel === "gelb", "KI-Pause → gelb, wird nachgeholt", k);
  const w = vorpruefNotiz({ kategorie: "weitere", urteil: null, namePasst: null });
  ok(/Weitere Unterlage — keine automatische Prüfung/.test(w.notiz), "Weitere Unterlagen: keine automatische Prüfung", w);
  ok([g, r, f, n, u, pw, z, k, w].every((x) => x.notiz.length <= 240), "jede Notiz kurz (≤ 240 Zeichen)");
  ok([g, r, f, n, u, pw, z, k, w].every((x) => !/geprüft|freigegeben|passt alles/i.test(x.notiz)), "die Notiz sagt nie „geprüft“/„freigegeben“ (Vier-Augen)");
}

console.log("── 8 · Vorprüfung: der Name aus der Akte (ohne KI)");
{
  const kopf = "Girokonto IBAN DE12 3456 7890 1234 5678 90 Kontoinhaber Herr Max Müller-Lüdenscheidt Hauptstraße 5 12345 Berlin Kontoauszug 3/2026";
  ok(vorpruefName(kopf, { vorname: "Max", nachname: "Müller-Lüdenscheidt" }) === true, "Doppelname mit Umlauten wird gefunden");
  ok(vorpruefName(kopf.toUpperCase().replace(/Ü/g, "UE"), { vorname: "Max", nachname: "Müller" }) === true, "MUELLER (Großschrift, ue) passt zu Müller");
  ok(vorpruefName(kopf, { vorname: "Erika", nachname: "Beispielfrau" }) === false, "fremder Name → nicht gefunden");
  ok(vorpruefName("kurz", { nachname: "Müller" }) === null, "kein Text (Foto) → nicht prüfbar");
  ok(vorpruefName(kopf, { nachname: "" }) === null, "kein Nachname in der Akte → nicht prüfbar");
}

console.log("── 9 · Die Aufgabe „Unterlagen eingegangen“");
{
  const t = unterlagenAufgabeText("Ausweis: 1 Datei", ["Ausweis · erkannt · lesbar · vollständig · Name passt"], null);
  ok(t.startsWith(UNTERLAGEN_AUFGABE_ANFANG) && t.startsWith("Unterlagen eingegangen ("), "beginnt mit „Unterlagen eingegangen (“ — E-397 (Ereignis, Hausputz) findet sie");
  ok(/Vorprüfung: Ausweis · erkannt/.test(t) && !/⚠/.test(t), "trägt die Vorprüfung, ohne Befund kein ⚠", t);
  const t2 = unterlagenAufgabeText("Kontoauszug: 2 Dateien", [], "Kontoauszug erkannt, aber Zeitraum nur ~30 Tage");
  ok(!/Vorprüfung:/.test(t2) && /⚠ Automatische Prüfung meldet: Kontoauszug erkannt/.test(t2), "ohne Vorprüfung keine leere Zeile; Befund mit ⚠", t2);
  ok(/„Geprüft“ setzen/.test(t), "der Mensch setzt „Geprüft“");
}

console.log("── 10 · Wer prüft");
{
  const k = (id: number, x: Partial<PrueferKandidat> = {}): PrueferKandidat =>
    ({ id, name: `Person ${id}`, rolle: "vertriebsleiter", stufe: null, aktiv: true, gesperrt: false, test: false, geprueft30: 0, ...x });
  const team = [k(8, { geprueft30: 32 }), k(10, { geprueft30: 64, stufe: "geschaeftsfuehrung" }), k(13), k(928, { stufe: "inhaber", geprueft30: 500 }), k(505, { rolle: "agent", geprueft30: 900 })];
  ok(!darfPruefen(team[3]) && !darfPruefen(team[4]), "nie der Inhaber (Justin), nie ein Mitarbeiter ohne Leitungsrolle");
  const v = prueferWaehlen(team, null);
  ok(v?.id === 10 && v.quelle === "vorschlag", "Vorschlag: wer in 30 Tagen am meisten geprüft hat (Frau Lombardi, 64)", v);
  const e = prueferWaehlen(team, 8);
  ok(e?.id === 8 && e.quelle === "einstellung", "die Einstellung gewinnt", e);
  ok(prueferWaehlen(team, 928)?.id === 10, "Justin eingestellt → gilt nicht, der Vorschlag greift");
  ok(prueferWaehlen(team, 505)?.id === 10, "Mitarbeiter ohne Leitung eingestellt → gilt nicht");
  ok(prueferWaehlen([k(10, { geprueft30: 64, gesperrt: true }), k(8, { geprueft30: 32 })], null)?.id === 8, "gesperrt → der Nächste");
  ok(prueferWaehlen([k(10, { geprueft30: 64, aktiv: false }), k(8, { geprueft30: 1, test: true })], null) === null, "inaktiv/Testkonto → niemand (bleibt beim Betreiber)");
  ok(prueferWaehlen([k(12, { geprueft30: 5 }), k(9, { geprueft30: 5 })], null)?.id === 9, "Gleichstand → die kleinere Nummer (stabil)");
  ok(prueferWaehlen([k(13)], null) === null, "niemand hat geprüft und nichts eingestellt → niemand");
  ok(prueferWaehlen([k(13)], 13)?.id === 13, "… aber eingestellt geht auch ohne Prüfzahl");
}

console.log("── 11 · Umhängen (nur mit Schalter, Standard AUS)");
{
  ok(!umhaengenAn(undefined) && !umhaengenAn("") && !umhaengenAn("aus") && !umhaengenAn("vielleicht"), "fehlt der Wert oder ist er unklar → AUS");
  ok(umhaengenAn("an") && umhaengenAn("AN") && umhaengenAn("1"), "nur ein ausdrückliches „an“ schaltet ein");
  const z = { text: "Unterlagen eingegangen (Ausweis: 1 Datei) — bitte prüfen …", status: "offen", beiJustin: true, ungeprueft: 2, vertragLaeuft: true, test: false };
  ok(umhaengenPasst(z), "offen, bei Justin, Ungeprüftes, Vertrag läuft → umhängen");
  ok(!umhaengenPasst({ ...z, beiJustin: false }), "liegt schon im Team → bleibt");
  ok(!umhaengenPasst({ ...z, ungeprueft: 0 }), "nichts mehr ungeprüft → bleibt (schließt der Hausputz)");
  ok(!umhaengenPasst({ ...z, vertragLaeuft: false }), "Vertrag beendet/gekündigt → bleibt");
  ok(!umhaengenPasst({ ...z, test: true }), "Testkonto → bleibt");
  ok(!umhaengenPasst({ ...z, status: "erledigt" }), "erledigt → bleibt");
  ok(!umhaengenPasst({ ...z, text: "RÜCKRUF binnen 24 h: …" }), "andere Aufgabe → bleibt");
}

console.log("── 12 · Quelltext-Belege (Routen, Takte, Oberfläche, Rundgang, Team-Update)");
{
  const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const pult = lies("server/routes/fiaon-mara-steuerpult.ts");
  for (const r of ['router.get("/chef/mara/unterlagen", wache', 'router.post("/chef/mara/unterlagen/kyc", wache', 'router.post("/chef/mara/unterlagen/pruefer", wache',
    'router.post("/chef/mara/unterlagen/umhaengen", wache', 'router.post("/chef/mara/unterlagen/zurueck", wache']) ok(pult.includes(r), `Route ${r.split('"')[1]} nur für den Inhaber (wache)`);
  ok(/tageslauf\("mara_kyc_nachfordern"[\s\S]{0,200}nurMitErgebnis: true/.test(pult) && /tageslauf\("unterlagen_pruefer_umhaengen"[\s\S]{0,200}nurMitErgebnis: true/.test(pult), "Takte registriert (Historie nur mit Ergebnis)");
  ok(/art = \$\{UMHAENGEN_LAUF_ART\}/.test(pult) && /umhaengenSchalterSetzen\(false\)[\s\S]{0,200}hausputzZurueckholen/.test(pult), "Zurückholen nur für Umhäng-Läufe, schaltet dabei aus");
  ok(/req\.body\?\.alle === true[\s\S]{0,200}umhaengenAllesZurueck/.test(pult) && /umhaengenOffen\(\)/.test(pult), "„Alle zurückholen“ (jeder Lauf der 30 Tage) + Zahl dazu");
  const unt = lies("server/lib/fiaon-unterlagen.ts");
  const prf = lies("server/lib/fiaon-unterlagen-pruefer.ts");
  ok(/unterlagenAufgabeText\(was, notizen, ein\.befund \|\| null\)/.test(prf) && /zustaendig_agent_id, fuer_betreiber/.test(prf) && /\$\{!pruefer\}/.test(prf), "Aufgabe an die prüfende Person (sonst wie bisher an den Betreiber)");
  // Nachbesserung (Prüfer-Fund): EIN Weg für jeden Upload — Kundenbereich UND Upload-Link (Maras KYC-Mail).
  const lnk = lies("server/lib/fiaon-unterlagen-link.ts");
  ok(/pruefAufgabeMelden\(/.test(unt) && /pruefAufgabeMelden\(/.test(lnk) && /vorpruefen\(ein\.personId, ein\.art, urteil, pdf, lauf\)/.test(lnk), "Upload-Link: Vorprüfung + Prüf-Aufgabe über denselben Weg wie der Kundenbereich");
  ok(!/INSERT INTO fiaon_vermerke/.test(unt + lnk), "kein zweiter, eigener Aufgaben-Weg mehr (nie wieder still bei Justin)");
  ok(!/geprueft_am\s*=/.test(lies("server/lib/fiaon-unterlagen-pruefer.ts")) && !/geprueft_am\s*=/.test(lies("server/lib/fiaon-mara-kyc.ts")), "Mara setzt nirgends geprueft_am (Vier-Augen)");
  ok(!/kyc_status\s*=/.test(lies("server/lib/fiaon-mara-kyc.ts") + lies("server/lib/fiaon-unterlagen-pruefer.ts")), "Mara ändert nie den kyc_status");
  ok(/ocrLesen|openai|anthropic/i.test(lies("server/lib/fiaon-unterlagen-pruefer.ts")) === false, "die Vorprüfung ruft keine KI und keine Texterkennung");
  const zent = lies("server/lib/fiaon-kundenzentrale.ts");
  ok(/const KYC_VERTRAG_LAEUFT_SQL = kycVertragLaeuftSql\("a"\)/.test(zent), "„KYC zu prüfen“ nutzt dieselbe Regel wie Mara");
  const mara = lies("client/src/components/admin/ChefMara.tsx");
  ok(/const MaraUnterlagen = lazy\(\(\) => import\("\.\/ChefMaraUnterlagen"\)\)/.test(mara) && /<MaraUnterlagen \/>/.test(mara), "Karte im Reiter Bonitätsauskunft (keine neue Seite)");
  const karte = lies("client/src/components/admin/ChefMaraUnterlagen.tsx");
  ok(/data-fiaon="mara-unterlagen"/.test(karte) && /\/chef\/mara\/unterlagen\/umhaengen/.test(karte) && /Zurückholen/.test(karte), "Karte: Schalter, Prüfer-Wahl, Umhängen mit Zurückholen");
  ok(/\{ alle: true \}/.test(karte) && /Alle zurückholen/.test(karte), "Karte: „Alle zurückholen“ — auch Läufe außerhalb der Liste");
  const akte = lies("client/src/components/unterlagen/UnterlagenAkte.tsx");
  ok(/data-fiaon="unterlage-vorpruefung"/.test(akte) && /k\.vorpruefung && !k\.geprueft/.test(akte), "Akte zeigt die Vorprüfung (bis „Geprüft“)");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/ziel: '\[data-fiaon="mara-unterlagen"\]'/.test(rg) && /Neu: „Vorprüfung“ an der Unterlage/.test(rg) && /„Unterlagen eingegangen“ kommt zu der Person, die prüft/.test(rg), "Rundgänge: Mara-Karte, Akte, Aufgaben");
  ok(/id: "2026-10-19-mara-unterlagen"/.test(lies("client/src/pages/agent/updates-data.ts")), "Team-Update eingetragen");
}

console.log(`\n${gut} ✓ · ${schlecht} ✗`);
process.exit(schlecht ? 1 : 0);
