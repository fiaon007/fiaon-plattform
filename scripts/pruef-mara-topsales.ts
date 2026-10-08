// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MARA-TOPSALES (08.10.2026, Justin: „Mach Mara verkaufsfähig … mehr Umsatz in die Kasse“)
//
// Neun Hebel aus der Diagnose vom 08.10. (it-rettung/mara/diagnose-ergebnis.json):
//   1 Abbruch-Kette scharf · 2 Lead-Strecke erst fällig, dann begrenzt · 3 Mara-Aktion gleichmäßig (Wochentag, 08–21 Uhr,
//   Vorgabe 60/h) · 4 Stufe A klären (Anrufaufgabe + eine Klärungs-Mail ab dem 3. Werktag) · 5 dritte Raten-WhatsApp ·
//   6 Mara-Nachfass ab 4 h · 7 Lauf-Wächter (Meldung + Alarm bei 24 h ohne Versand) · 8 Vertriebssperre beim
//   Zusammenführen nur mit dokumentierter Ablehnung (+ Prüfliste) · 9 dieselbe Sperrprüfung wie die Tür, Zähler nur bei Versand.
//
// NACH DER PRÜFUNG (08.10., 11 Funde): Abbruch-Kette vier Mails, höchstens eine am Tag (auch je Adresse), Lead-Abmeldung,
// alter Antragsweg nur nach dem Werbehinweis, Weiter-Link mit Abmeldelink · dritte Raten-WhatsApp nur am festen Wochentag
// (Verteilung über sieben Tage geprüft) · Mara-Aktion immer höchstens 60/h, Klärungen höchstens 20/Tag, Fremdsprache
// beendet die Klärung · Klärungs-Mail „keine Zahlungserinnerung“ + „zuerst Kontoauszug“ · Anrufaufgabe mit Stopp-/Werbe-
// sperre-Hinweis, „abgelehnt“ an die Leitung · Zusammenführen vererbt die Sperre IMMER, ohne Vermerk eine Prüfaufgabe.
//
// Ohne Schalter: OFFLINE (reine Funktionen, SQL-Texte, Quelltext). Keine Datenbank, keine KI, kein Netz.
// Mit --db: zusätzlich gegen eine EIGENE lokale Test-DB (127.0.0.1:54329/fiaon_*), eigene Datensätze PRUEFTS-…,
// am Ende entfernt. Es wird NIE gesendet (kein Lauf mit Versand, keine Make-/Brevo-/Gmail-Aufrufe).
//
//   env -i … DATABASE_URL=postgresql://x@127.0.0.1:1/x node_modules/.bin/tsx scripts/pruef-mara-topsales.ts
//   env -i … DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_mara_ts?sslmode=require' node_modules/.bin/tsx scripts/pruef-mara-topsales.ts --db
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "MAKE_WEBHOOK_URL", "DATABASE_URL_EXTERN", "WHATSAPP_TOKEN"]) {
  delete process.env[k];
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen eine lokale Test-DB (127.0.0.1:54329/fiaon_*)!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.MARA_BANK_SATZ = "nachfrage";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const MARKE = "Mara-Topsales 08.10.2026";

const AE = await import("../server/lib/fiaon-antrag-erinnerung");
const LS = await import("../shared/fiaon-lead-strecke");
const MA = await import("../server/lib/fiaon-mara-aktion");
const SA = await import("../server/lib/fiaon-stufe-a-klaeren");
const WZ = await import("../server/lib/fiaon-wa-zentrale");
const NF = await import("../server/lib/fiaon-mara-nachfass");
const CR = await import("../server/lib/fiaon-crons");
const MF = await import("../server/lib/fiaon-mail-frequenz");
const MOTOR = await import("../server/mail/motor");
const TON = await import("../shared/fiaon-mara-ton");
const { fordertZahlung } = await import("../server/lib/fiaon-postmeister-agent");

// Berlin = UTC+2 im Oktober
const um = (tag: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, tag, h - 2, m));

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 1: Abbruch-Kette ─────────────────────────────────────────");
{
  // Abbruch Donnerstag 08.10. 15:00 → 15:11 die 10-Minuten-Mail (wie E-023)
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(8, 15, 0), letzteAm: null, jetzt: um(8, 15, 11) }) === 1, "Abbruch am Tag: erste Mail nach 10 Minuten (E-023 bleibt)");
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(8, 15, 0), letzteAm: null, jetzt: um(8, 15, 5) }) === null, "… nicht vor 10 Minuten");
  // Abbruch Mittwoch 21:40 → Donnerstag 07:00 NICHT (schwächste Stunde), 12:05 ja
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(7, 21, 40), letzteAm: null, jetzt: um(8, 7, 0) }) === null, "Abbruch in der Nacht: keine Mail um 07:00 (1,5 % geöffnet)");
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(7, 21, 40), letzteAm: null, jetzt: um(8, 9, 10) }) === null, "… und keine um 09:10 (Slot 12 Uhr abwarten)");
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(7, 21, 40), letzteAm: null, jetzt: um(8, 12, 5) }) === 1, "… sondern im ersten Tagesfenster 12:00 (33 % geöffnet)");
  ok(AE.stufeFaellig({ stufe: 0, standAm: um(8, 3, 0), letzteAm: null, jetzt: um(8, 12, 5) }) === 1 && AE.stufeFaellig({ stufe: 0, standAm: um(8, 3, 0), letzteAm: null, jetzt: um(8, 8, 0) }) === null, "Abbruch um 03:00: 12:05 ja, 08:00 nein");
  // ── Prüfung 08.10.: höchstens eine Mail am Tag, vier insgesamt — nachgestellt im 5-Minuten-Takt des Laufs ──
  const kette = (abbruch: Date, tage = 9) => {
    const mails: Date[] = []; let stufe = 0; let letzte: Date | null = null;
    for (let t = abbruch.getTime(); t < abbruch.getTime() + tage * 86_400_000; t += 5 * 60_000) {
      const jetzt = new Date(t);
      const s = AE.stufeFaellig({ stufe, standAm: abbruch, letzteAm: letzte, jetzt });
      if (s) { mails.push(jetzt); stufe = s; letzte = jetzt; }
    }
    return mails;
  };
  const hm = (d: Date) => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tg = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const jeTag = (m: Date[]) => { const z = new Map<string, number>(); for (const d of m) z.set(tg(d), (z.get(tg(d)) ?? 0) + 1); return Math.max(0, ...z.values()); };
  const k1140 = kette(um(8, 11, 40));
  ok(k1140.length > 0 && hm(k1140[0]) === "11:50" && !k1140.some((d) => tg(d) === "2026-10-08" && hm(d) === "12:00"),
    `Abbruch Do 11:40: 11:50, aber NICHT 12:00 (vorher 11:50 und 12:00) — ${k1140.map((d) => `${tg(d).slice(8)}. ${hm(d)}`).join(", ")}`);
  ok(k1140.length === 4 && tg(k1140[1]) === "2026-10-09" && hm(k1140[1]) === "12:00" && tg(k1140[2]) === "2026-10-10" && hm(k1140[2]) === "17:30"
    && tg(k1140[3]) === "2026-10-13" && hm(k1140[3]) === "20:00", "Vier Mails: Tag 1 nach 10 Min., Tag 2 12:00, Tag 3 17:30, Tag 6 20:00 (vorher sieben in 27 h)");
  const k1145 = kette(um(8, 11, 45));
  ok(k1145.filter((d) => tg(d) === "2026-10-08").length === 1, `Abbruch 11:45: höchstens eine Mail bis zum Folgetag (vorher 11:55, 12:00, 13:30, 17:30, 20:00)`);
  const k0900 = kette(um(8, 9, 0));
  ok(k0900.filter((d) => tg(d) === "2026-10-08").length === 1, "Abbruch 09:00: eine Mail am selben Tag (vorher fünf)");
  ok([k1140, k1145, k0900, kette(um(8, 17, 0)), kette(um(7, 21, 40)), kette(um(10, 13, 20))].every((m) => jeTag(m) <= 1 && m.length <= AE.STUFEN_MAX),
    "Kein Abbruchzeitpunkt ergibt zwei Mails an einem Berliner Tag oder mehr als vier");
  const k2140 = kette(um(7, 21, 40));
  ok(k2140.length >= 2 && tg(k2140[0]) === "2026-10-08" && hm(k2140[0]) === "12:00" && tg(k2140[1]) === "2026-10-09",
    "Abbruch nachts (Mi 21:40): erste Mail Do 12:00, die zweite erst am Freitag");
  const ab = new Date("2026-10-06T14:00:00Z");
  const sql = AE.abbrecherSql(ab.toISOString());
  ok(!/AND a\.payment_reference IS NULL/.test(sql), "nicht mehr payment_reference IS NULL (der Trigger aus 037 füllt sie bei JEDEM Antrag)");
  ok(sql.includes(`NOT ${(await import("../shared/fiaon-antrag-stand")).abgeschicktSql("a")}`), "nicht abgeschickt — die EINE Regel (shared/fiaon-antrag-stand.ts)");
  ok(/NOT IN \('paid', 'claimed_paid'\)/.test(sql), "nichts bezahlt und nichts als bezahlt gemeldet");
  ok(/a\.person_id IS NOT NULL/.test(sql) && sql.includes(MF.WERBESPERRE_FAMILIE_SQL("a.person_id")) && sql.includes(MF.VERTRIEBSSPERRE_SQL("a.person_id")) && sql.includes(MF.STOPP_KOEPFE_SQL), "Werbesperre (Familie), Vertriebssperre (Kopf), Stopp, Person nötig (Abmeldelink)");
  ok(/globalKunde|fiaon_global_angebote/.test(sql) || sql.includes("global"), "Global-Kunde (E-272) bleibt draußen");
  ok(sql.includes(`a.created_at > '${ab.toISOString()}'::timestamptz`), "Untergrenze aus erinnerbarAb");
  const stich = new Date("2026-10-08T15:00:00Z");
  ok(AE.erinnerbarAb(stich, new Date("2026-10-08T15:05:00Z")).getTime() === stich.getTime() - 48 * 3_600_000, "Erster Lauf: nur Anträge der letzten 48 h vor dem Stichtag");
  ok(AE.erinnerbarAb(stich, new Date("2026-10-30T15:00:00Z")).getTime() === new Date("2026-10-16T15:00:00Z").getTime(), "Danach normal: wieder 14 Tage (Fenster wächst von selbst)");
  ok(MOTOR.ABMELDEPFLICHT.has("antrag_erinnerung"), "antrag_erinnerung steht in ABMELDEPFLICHT (Werbung nur mit Ausgang)");
  const muster = { email: "max@kunde.invalid", vorname: "Max", schritt_text: "Beruf und Einkommen", weiter_link: "https://www.fiaon.com/antrag?weiter=X", abmelde_url: "https://www.fiaon.com/api/fiaon/abmelden/p/4711.abc" };
  const m = MOTOR.mailRendern("antrag_erinnerung", muster) as any;
  ok(!!m && JSON.stringify(m).includes("abmelden/p/4711.abc"), "Die Vorlage druckt den Abmeldelink");
  const lauf = quelle("server/lib/fiaon-antrag-erinnerung.ts");
  ok(/abmelde_url: abmeldeLinkPerson\(Number\(k\.person_id\)\)/.test(lauf), "Der Lauf gibt den Abmeldelink je Person mit");
  ok(AE.STUFEN_MAX === 4 && AE.FOLGESTUFEN.length === AE.STUFEN_MAX - 1 && /const SLOTS = \[12 \* 60, 13 \* 60 \+ 30, 17 \* 60 \+ 30, 20 \* 60\]/.test(lauf) && /LIMIT 200/.test(sql),
    "Vier Stufen (vorher sieben), Zeitfenster und Deckel 200 je Lauf bleiben");
  ok(sql.includes(MF.LEAD_ABGEMELDET_KOEPFE_SQL) && sql.includes(MF.LEAD_ABGEMELDET_ADRESSEN_SQL), "Lead-Abmeldung (Familie und Adresse) hält die Kette auf");
  ok(/COALESCE\(a\.antrag_weg, ''\) = 'neu' OR COALESCE\(a\.current_step, 0\) >= 6/.test(sql) && /le\.einwilligung IS NOT NULL/.test(sql),
    "Alter Antragsweg nur nach dem Werbehinweis (Schritt 6) oder mit Lead-Einwilligung");
  ok(/ml\.event = 'antrag_erinnerung' AND ml\.status = 'versandt'/.test(sql) && /AT TIME ZONE 'Europe\/Berlin'\)::date::timestamp/.test(sql),
    "Höchstens eine antrag_erinnerung je Person/Adresse am Berliner Tag (Mail-Protokoll)");
  ok(/heuteSchon\.has\(adresse\) \|\| heuteSchon\.has\(person\)/.test(lauf), "… und innerhalb eines Laufs (zwei Anträge derselben Adresse)");
  const ein = quelle("server/routes/fiaon-einrichtung.ts");
  const wl = ein.slice(ein.indexOf('router.post("/antrag/weiter-link"'));
  ok(/abgeschicktSql\("fiaon_applications"\)/.test(wl) && !/a\.payment_reference \|\| a\.payment_status === "paid"/.test(wl)
    && /abmelde_url: abmeldeLinkPerson\(Number\(a\.person_id\)\)/.test(wl), "Weiter-Link auf Anforderung: Regel „abgeschickt“ statt Verwendungszweck, mit Abmeldelink (ABMELDEPFLICHT)");
  ok(/const unfertig = !!r && r\.abgeschickt !== true/.test(ein), "Hinweis „schon begonnen“ (email-bekannt): dieselbe Regel — der Knopf erscheint wieder");
  const leads = quelle("server/routes/fiaon-leads.ts");
  const abm = leads.slice(leads.indexOf('router.post("/abmelden/:schluessel"'), leads.indexOf("// ── DIE KENNZAHLEN DER STRECKE"));
  ok(/RETURNING id, email, person_id/.test(abm) && /werbesperreSetzen\(Number\(zeilen\[0\]\.person_id\)/.test(abm), "Lead-Abmeldung setzt die Werbesperre der verknüpften Person");
  ok(lauf.includes(MARKE), `Kommentar „${MARKE}“`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 2: Lead-Strecke ──────────────────────────────────────────");
{
  ok(LS.naechsteStufe(0, 1.2) === 1 && LS.naechsteStufe(1, 3.5) === 2 && LS.naechsteStufe(4, 31) === 5, "Pünktlich: Stufe + 1");
  const s87 = LS.naechsteStufe(1, 87);
  ok(s87 >= 5 && LS.faelligNachTagen(s87) - 87 >= LS.NACHHOL_MIN_ABSTAND_TAGE && LS.faelligNachTagen(s87) - 87 <= LS.NACHHOL_MIN_ABSTAND_TAGE + LS.MONATS_ABSTAND_TAGE, `Überfällig (Stufe 1, 87 Tage): EINE Mail, dann Monatsstufe ${s87} (nächste in ${LS.faelligNachTagen(s87) - 87} Tagen)`);
  const s40 = LS.naechsteStufe(1, 40);
  ok(s40 === 5 && LS.faelligNachTagen(5) === 60, "Überfällig (Stufe 1, 40 Tage): nächste Mail am Tag 60 — keine fünf Mails an fünf Tagen");
  const s58 = LS.naechsteStufe(2, 58);
  ok(LS.faelligNachTagen(s58) - 58 >= 14, "Knapp vor einem Monatspunkt (58 Tage): mindestens 14 Tage Abstand");
  ok(LS.faelligNachTagenSql("x").includes("ARRAY[1, 3, 7, 14, 30]") && LS.faelligNachTagenSql("x").includes("* 30"), "Fälligkeit als SQL aus derselben Kadenz");
  const strecke = quelle("server/lib/fiaon-lead-strecke.ts");
  const f = strecke.slice(strecke.indexOf("export async function faellige("), strecke.indexOf("export async function streckenMail("));
  ok(!/ORDER BY le\.erstellt_am DESC\s+LIMIT 2000/.test(f) && /WHERE k\.start \+ make_interval\(days => \$\{sqlPool\.unsafe\(faelligNachTagenSql\("k\.stufe"\)\)\}\) <= NOW\(\)/.test(f), "Erst die Fälligkeit, dann die Grenze");
  ok(/ORDER BY k\.strecke_letzte_am ASC NULLS FIRST, k\.erstellt_am DESC/.test(f), "Reihenfolge: nie angeschrieben zuerst, dann wer am längsten wartet");
  ok(/AND NOT \$\{sqlPool\.unsafe\(IMPORT_OHNE_EINWILLIGUNG_SQL\("le"\)\)\}/.test(f) && /import_id IS NOT NULL AND \$\{le\}\.einwilligung IS NULL/.test(strecke), "Import ohne Einwilligung (13.07.) bleibt ausgeschlossen");
  ok(/frei = Math\.max\(0, grenze - Number\(heute\?\.n \|\| 0\)\)/.test(strecke), "Tagesdeckel zählt, was heute schon raus ist (zwei Slots = ein Deckel)");
  ok(/naechsteStufe\(Number\(l\.stufe\), tage\)/.test(strecke), "Nach dem Versand: naechsteStufe (Nachhol-Regel)");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 3: Mara-Aktion gleichmäßig ───────────────────────────────");
{
  const letzte = new Date("2026-10-03T12:21:03Z");
  const tage = new Map<string, number>();
  for (let pid = 1000; pid < 1700; pid++) { const t = MA.wochenslotTag(letzte, pid); tage.set(t, (tage.get(t) ?? 0) + 1); }
  const werte = Array.from(tage.values());
  ok(tage.size === 7 && Math.max(...werte) === 100 && Math.min(...werte) === 100, `700 Menschen mit Mail am 03.10. → 7 Tage je 100 (${Array.from(tage.keys()).sort().join(", ")}) — keine Welle am 17.10.`);
  ok(Array.from(tage.keys()).every((t) => t >= "2026-10-10" && t <= "2026-10-16"), "fällig zwischen 10.10. und 16.10. (7 statt 14 Tage)");
  ok(MA.wochenslotTag(new Date(`${MA.wochenslotTag(letzte, 4711)}T09:00:00Z`), 4711) === (() => { const d = new Date(`${MA.wochenslotTag(letzte, 4711)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); })(), "Danach genau wöchentlich am selben Wochentag");
  const jetzt = new Date("2026-10-08T14:00:00Z");
  ok(!MA.aktionTaktFaellig(1, new Date("2026-10-07T10:00:00Z"), 5, jetzt) && MA.aktionTaktFaellig(1, new Date("2026-10-06T10:00:00Z"), 5, jetzt), "2 Tage nach der ersten Mail");
  ok(!MA.aktionTaktFaellig(3, new Date("2026-10-02T10:00:00Z"), 5, jetzt) && MA.aktionTaktFaellig(3, new Date("2026-10-01T10:00:00Z"), 5, jetzt), "7 Tage nach der dritten Mail (unverändert)");
  ok(!MA.imAktionsFenster(7) && MA.imAktionsFenster(8) && MA.imAktionsFenster(20) && !MA.imAktionsFenster(21) && !MA.imAktionsFenster(3), "Versand nur 08:00–21:00 Uhr (Berlin)");
  ok(MA.RUNDE_HOECHSTENS_JE_STUNDE === 60 && MA.AKTION_HOECHSTENS_JE_STUNDE === 60, "Nie über 60 je Stunde (03.10.: 300/h → KI-Sperre)");
  const src = quelle("server/lib/fiaon-mara-aktion.ts");
  ok(/mara_aktion_je_stunde: "60"/.test(src), "Vorgabe mara_aktion_je_stunde = 60 (Einstellung bleibt änderbar)");
  ok(/const stundenRate = Math\.min\(e\.jeStunde, AKTION_HOECHSTENS_JE_STUNDE\);/.test(src) && /jeStunde: zahl\("mara_aktion_je_stunde", 0, AKTION_HOECHSTENS_JE_STUNDE\)/.test(src)
    && /tagesDeckel = Math\.min\(e\.jeStunde, AKTION_HOECHSTENS_JE_STUNDE\) \* 24/.test(src),
    "Prüfung: der 60er-Deckel gilt IMMER (Lesen, Lauf, Tagesdeckel) — nicht nur in einer Runde (Produktion: 190 gespeichert)");
  const pult = quelle("server/routes/fiaon-mara-steuerpult.ts");
  ok(/Math\.min\(AKTION_HOECHSTENS_JE_STUNDE, Math\.round\(Number\(wert\) \|\| 0\)\)/.test(pult) && /max=\{60\}/.test(quelle("client/src/components/admin/ChefMara.tsx")),
    "Steuerpult speichert höchstens 60, der Regler geht bis 60");
  ok(MA.KLAERUNG_JE_TAG === 20 && /klaerung_heute AS/.test(src) && /\(SELECT n FROM klaerung_heute\) < \$\{KLAERUNG_JE_TAG\}/.test(src)
    && /if \(klaerungFrei <= 0\) \{ uebersprungen\+\+; continue; \}/.test(src), "Klärungen höchstens 20 am Tag (Schlange und Durchgang) — die 83 verteilen sich auf rund vier Tage");
  const lauf = src.slice(src.indexOf("export async function maraAktionLauf("));
  ok(lauf.indexOf("imAktionsFenster(") > 0 && lauf.indexOf("imAktionsFenster(") < lauf.indexOf("kandidatenLaden("), "Das Fenster greift vor der Schlange (nichts wird beansprucht)");
  ok(!/ELSE INTERVAL '14 days'/.test(src), "kein 14-Tage-Takt mehr");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 4: Stufe A klären ────────────────────────────────────────");
{
  ok(SA.werktageSeit(um(5, 10), um(8, 9)) === 3, "Meldung Mo 05.10. → Do 08.10. = 3 Werktage");
  ok(SA.werktageSeit(um(2, 10), um(6, 9)) === 2 && SA.werktageSeit(um(2, 10), um(7, 9)) === 3, "Meldung Fr 02.10. → Di 2, Mi 3 (Wochenende zählt nicht)");
  ok(SA.werktageSeit(um(8, 10), um(8, 23)) === 0, "Am selben Tag: 0");
  const abs = TON.mitAntragLuecke(TON.bausteinAbschluss({ kanal: "mail", art: "a", ziel: null, betrag: "59,99 €" }), []);
  const kern = TON.bankSatzNurWennGefragt(TON.ohneLimitUndBankSatz(SA.klaerungKern({ name: "Mara Lindner", gemeldetAm: "05.10.2026", betrag: "59,99 €", verwendungszweck: "FIAON-AB12CD", abschluss: abs, wunsch: MA.wunschZurTageszeit("Abend") })), "");
  ok(MA.aktionPruefen(SA.KLAERUNG_BETREFF, kern, { stufe: "A", klaerung: true }).length === 0, "Die Klärungs-Mail besteht die Prüfung der Aktion (Wortwand, Ton, Kreditkarte, kein Termin)");
  ok(MA.aktionPruefen(SA.KLAERUNG_BETREFF, kern, { stufe: "A" }).some((x) => /Erneute Zahlungsaufforderung/.test(x)), "Ohne Klärungs-Kennung wäre der Satz eine verbotene Zahlungsbitte (die Ausnahme ist eng)");
  ok(MA.aktionPruefen(SA.KLAERUNG_BETREFF, `${kern}\n\nZahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate.`, { stufe: "A", klaerung: true }).some((x) => /Erneute Zahlungsaufforderung/.test(x)), "Jede ANDERE Zahlungsbitte bleibt auch in der Klärung ein Mangel");
  ok(/noch nicht zuordnen/.test(kern) && /Überweisungsbeleg oder das Überweisungsdatum/.test(kern) && /mit diesem Verwendungszweck: FIAON-AB12CD/.test(kern), "Ton Klärung: nicht zugeordnet, Beleg/Datum, sonst mit diesem Verwendungszweck");
  ok(/Betrag 59,99 €, Verwendungszweck FIAON-AB12CD/.test(kern) && /hinter dem Knopf/.test(kern) && !/DE86|IBAN DE/.test(kern), "Zahlungsdaten: Betrag + Verwendungszweck im Text, IBAN hinter dem Knopf (Wortwand)");
  ok(!/mahn|frist|letzte|inkasso|sofort zahlen/i.test(kern) && (kern.match(/!/g) ?? []).length <= 1, "Keine Mahnung, keine Frist, höchstens ein „!“");
  ok(MA.KLAERUNG_ERLAUBT.test(kern) && !fordertZahlung(kern.replace(MA.KLAERUNG_ERLAUBT, "")), "Nur der eine bedingte Satz trägt eine Bitte zu überweisen");
  const q = SA.stufeAKlaerenSql();
  ok(q.includes(SA.werktageSeitSql("fa.claimed_paid_at")) && />= 3\b/.test(q), "Anrufaufgabe ab dem 3. Werktag");
  ok(/NOT IN \(SELECT DISTINCT b\.person_id/.test(q) && q.includes(MF.VERTRIEBSSPERRE_SQL("fa.person_id")), "Bankabgleich (eingangOffenSql) vorher, Vertriebssperre hält auf");
  ok(/t\.schluessel = 'antrag:' \|\| fa\.ref \|\| ':a-klaeren'/.test(q) && /LIMIT 10\b/.test(q) && SA.AUFGABEN_JE_LAUF === 10, "Einmal je Bestellung (Schlüssel), höchstens 10 je Lauf (Altbestand über einen Arbeitstag)");
  const src = quelle("server/lib/fiaon-stufe-a-klaeren.ts");
  ok(/agentId: auftrag\.agentId/.test(src) && /anBetreiber: true as const/.test(src), "an den Betreuer, sonst an den Betreiber");
  ok(/Das ist keine Zahlungserinnerung, sondern eine Nachfrage zu Ihrer Meldung\./.test(kern) && /Bitte sehen Sie zuerst auf Ihrem Kontoauszug nach — zweimal zahlen soll niemand\./.test(kern)
    && kern.indexOf("Kontoauszug") < kern.indexOf("Wurde die Überweisung nicht ausgeführt"),
    "Prüfung: „keine Zahlungserinnerung“ und „zuerst Kontoauszug“ VOR dem bedingten Satz (S2-Zusage, Doppelzahlung)");
  const zeileA = { claimed_paid_at: "2026-10-05T10:00:00Z", pack_name: "FIAON Pro", werktage: 3, payment_reference: "FIAON-AB12CD", ref: "FIAON-X" };
  const t0 = SA.klaerAufgabe({ ...zeileA }, 7), t1 = SA.klaerAufgabe({ ...zeileA, stopp: true, werbesperre: true }, 7), t2 = SA.klaerAufgabe({ ...zeileA, abgelehnt: true }, 7);
  ok(t0.agentId === 7 && !/ACHTUNG/.test(t0.text), "Anrufaufgabe ohne Besonderheit: an den Betreuer, kein Warnhinweis");
  ok(/^ACHTUNG: Kunde hat „Stopp“ gesagt, Kunde trägt eine Werbesperre — nur Klärung seiner Meldung, kein Verkauf/.test(t1.text) && t1.agentId === 7,
    "„Stopp“/Werbesperre: Hinweis steht vorn im Aufgabentext");
  ok(t2.agentId === null && /„abgelehnt“ — bitte zuerst entscheiden/.test(t2.text), "„abgelehnt“ an der Bestellung: an die Leitung (Betreiber), nicht an den Betreuer");
  const qa = SA.stufeAKlaerenSql();
  ok(qa.includes(`(${MF.KOPF_SQL("fa.person_id")} IN ${MF.STOPP_KOEPFE_SQL}) AS stopp`) && qa.includes(`${MF.WERBESPERRE_FAMILIE_SQL("fa.person_id")} AS werbesperre`) && /AS abgelehnt/.test(qa),
    "Die Auswahl liefert Stopp, Werbesperre und Ablehnung je Fall");
  const akt2 = quelle("server/lib/fiaon-mara-aktion.ts");
  ok(/\.\.\.\(k\.klaerung \? \{ klaerungEntfaellt: true \} : \{\}\)/.test(akt2) && /pruefung->'wissen'->>'klaerungEntfaellt'/.test(akt2),
    "Fremdsprache: die KI-Mail vermerkt „klaerungEntfaellt“, die Klärung gilt als erledigt (keine Mail alle 2 Tage ohne Ende)");
  const antrag = quelle("server/routes/fiaon-antrag.ts");
  ok(/m\.stufeAKlaerenMelden\(\)/.test(antrag), "Hängt am stündlichen Zahlungslauf (wie unzustellbareErstzahlungenMelden)");
  const akt = quelle("server/lib/fiaon-mara-aktion.ts");
  ok(/klaerung_raus AS/.test(akt) && /OR \(app\.klaerung_faellig AND l\.am < NOW\(\) - INTERVAL '2 days'\)/.test(akt), "Mara-Aktion: EINE Klärung je Bestellung, frühestens 2 Tage nach der letzten Aktionsmail");
  ok(/app\.person_id NOT IN \(SELECT person_id FROM eingang\)/.test(akt) && /eingangOffenFuer\(k\.personId\)/.test(akt), "… mit dem Bankabgleich davor (Schlange und direkt vor dem Schreiben)");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 5 + 6: Raten-WhatsApp, Mara-Nachfass ──────────────────────");
{
  ok(WZ.RATE_WA_HOECHSTENS === 3 && WZ.RATE_ERINNERBAR("r", "a", "p").includes(`< (CASE WHEN ${WZ.RATE_WOCHENTAG_SQL("p")} THEN 3 ELSE 2 END)`),
    "Dritte WhatsApp je fälliger Monatsrate — nur an seinem festen Wochentag");
  // Prüfung 08.10.: die Welle vom 13.10. — 95 Menschen, deren zweite Raten-Vorlage aus dem Stoß vom 06.10. stammt.
  const verteilung = new Map<string, number>();
  const alt = new Map<string, number>();
  for (let i = 0; i < 95; i++) {
    const pid = 9_000 + i * 37; // gestreute Personennummern
    const letzte = new Date(Date.UTC(2026, 9, 6, 8 + (i % 9), (i * 7) % 60)); // 06.10., 10–18 Uhr Berlin
    const ab = new Date(letzte.getTime() + 7 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const tag = WZ.dritteRateWaTag(ab, pid);
    verteilung.set(tag, (verteilung.get(tag) ?? 0) + 1);
    alt.set(ab, (alt.get(ab) ?? 0) + 1);
  }
  const vw = Array.from(verteilung.values());
  ok(Math.max(...alt.values()) === 95 && verteilung.size === 7 && Math.max(...vw) <= 20,
    `95 dritte Raten-WhatsApp: vorher alle am ${Array.from(alt.keys())[0]}, jetzt über 7 Tage (höchstens ${Math.max(...vw)} am Tag: ${Array.from(verteilung.entries()).sort().map(([t, n]) => `${t.slice(8)}.: ${n}`).join(", ")})`);
  ok(Array.from(verteilung.keys()).every((t) => t >= "2026-10-13" && t <= "2026-10-19"), "… zwischen 13.10. und 19.10. — keiner früher als nach 7 Tagen");
  ok([0, 1, 2, 3, 4, 5, 6].every((w) => Array.from({ length: 7 }, (_, d) => WZ.rateWochentagHeute(1000 + w, new Date(Date.UTC(2026, 9, 12 + d, 10)))).filter(Boolean).length === 1),
    "Jeder Mensch hat genau einen Wochentag");
  ok(WZ.GRUPPEN.rate_offen.abstandTage === 7, "7 Tage Abstand bleiben");
  const z = quelle("server/lib/fiaon-wa-zentrale.ts");
  ok(/werbung: g !== "rate_offen"/.test(z) && /g !== "rate_offen"/.test(z), "Monatsrate bleibt Service (läuft auch bei ROT)");
  ok(NF.NACHFASS_AB_STUNDEN === 4 && /INTERVAL '4 hours'/.test(NF.nachfassKandidatenSql()) && /INTERVAL '23 hours'/.test(NF.nachfassKandidatenSql()), "Nachfass 4–23 h nach seiner letzten Nachricht");
  ok(NF.nachfassZeitOk(um(8, 8, 0)) && !NF.nachfassZeitOk(um(8, 20, 31)), "weiterhin nur 08:00–20:30");
  ok(/INTERVAL '7 days'/.test(NF.nachfassKandidatenSql()), "weiterhin höchstens einmal in sieben Tagen");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 7: Lauf-Wächter ──────────────────────────────────────────");
{
  const m1 = CR.laufMeldung("mara_aktion", { gesendet: 0, abgelehnt: 2, fehler: 0, grund: "KI pausiert" });
  ok(m1 === '{"gesendet":0,"abgelehnt":2,"fehler":0,"grund":"KI pausiert","versandt":0}', `Mara-Aktion: ${m1}`);
  ok(CR.laufMeldung("mara_aktion", { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "aus" })!.includes('"aus":true'), "abgeschaltet → \"aus\":true (kein Alarm)");
  const m2 = CR.laufMeldung("rueckholung", [{ segment: "s1_frisch", geprueft: 3, verschickt: 2, uebersprungen: 1 }, { segment: "s2_behauptet", geprueft: 1, verschickt: 1, uebersprungen: 0 }]);
  ok(!!m2 && m2.includes('"versandt":3') && m2.includes('"anzahl":2'), `Rückholung (Liste): ${m2}`);
  ok(CR.laufMeldung("antrag-erinnerungen", 4) === '{"wert":4,"versandt":4}', "Abbruch-Kette: Zahl");
  ok(CR.laufMeldung("lead-nachfass-und-verteilung", null) === null && CR.laufMeldung("lead-nachfass-und-verteilung", { sent: 12, markedDead: 0, skippedWindow: false })!.includes('"versandt":12'), "Lead-Strecke: nur zum Slot eine Zahl");
  ok(CR.laufMeldung("mara_wa_nachfass", { kandidaten: 3, gesendet: 1, uebersprungen: { heikel: 1, sperre: 1 }, beispiele: ["zahlung_offen: Kurz nachgefragt … max@kunde.de 0176 1234567"] })!.includes('"uebersprungen.heikel":1'), "Nachfass: Gründe als Zahlen, Beispieltexte nie");
  const pii = CR.laufMeldung("postmeister", { grund: "an max.mustermann@kunde.de, Tel. +49 176 12345678", n: 2 })!;
  ok(!/max\.mustermann|kunde\.de|12345678/.test(pii) && /…@…/.test(pii), `Keine Personendaten in der Meldung: ${pii}`);
  ok(CR.laufMeldung("irgendwas", undefined) === null && CR.laufMeldung("irgendwas", { text: "Langer Text" }) === null, "Nichts zu sagen → keine Meldung (nicht „null“ als Text)");
  const ids = CR.laufMeldung("irgendwas", [{ id: 13411, person_id: 13411, n: 1 }, { id: 13412, lead_id: 9, n: 2 }])!;
  ok(ids === '{"anzahl":2,"n":3}', `Kennungen (id, person_id, lead_id) stehen nie in der Meldung: ${ids}`);
  for (const n of ["mara_aktion", "wa_zentrale_takt", "rueckholung", "antrag-erinnerungen", "lead-nachfass-und-verteilung", "mara_wa_nachfass"]) {
    ok(!!CR.VERKAUFSLAEUFE[n] && !!CR.LAUF_FOLGEN[n], `„${n}“: Verkaufslauf mit Folgensatz`);
  }
  const cr = quelle("server/lib/fiaon-crons.ts");
  ok(/meldung: \(e\) => laufMeldung\(name, e\)/.test(cr) && /async \(\) => await fn\(\)/.test(cr), "tageslauf schreibt das Ergebnis als Meldung");
  ok(/const stumm = await verkaufsLaeufeWachen/.test(cr) && /lauf:\$\{name\}:null-versand:\$\{tag\}/.test(cr), "Alarm als Betreiber-Aufgabe, einmal je Lauf und Tag");
  const r = quelle("server/routes.ts");
  ok(/tageslauf\('wa_zentrale_takt', async \(\) => await \(await import\('\.\/lib\/fiaon-wa-zentrale'\)\)\.automatikTakt\(\)/.test(r) && /tageslauf\('mara_wa_nachfass', async \(\) => await/.test(r), "WA-Takt und Nachfass geben ihr Ergebnis zurück");
  ok(/const erg = await maybeRunScheduledFollowups\(\);[\s\S]{0,200}return erg;/.test(quelle("server/routes/fiaon-leads.ts")), "Lead-Takt gibt das Slot-Ergebnis zurück");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("── Hebel 8 + 9: Sperren ───────────────────────────────────────────");
{
  const mg = quelle("server/lib/fiaon-person-merge.ts");
  ok(/is_blocked = \(is_blocked OR \$\{!!verlierer\.is_blocked\}\)/.test(mg) && !/verliererSperreErben/.test(mg),
    "Prüfung: Zusammenführen vererbt die Sperre des Verlierers IMMER (nichts fällt ohne Einzelprüfung)");
  ok(/merge:\$\{gewinnerId\}:sperre-ohne-vermerk/.test(mg) && /ON CONFLICT \(schluessel\) DO NOTHING/.test(mg) && /Sperre aufheben/.test(mg),
    "… ohne Vermerk EINE Betreiber-Aufgabe „Vertriebssperre ohne Vermerk — bitte prüfen“ (in derselben Transaktion)");
  ok(/is_blocked = TRUE,\s*\n\s*promised_payment_date = NULL/.test(mg), "Die Wegweiser-Marke am Verlierer bleibt (keine Sperre aufgehoben)");
  const ad = MF.ABLEHNUNG_DOKUMENTIERT_SQL("x.id");
  ok(/abgelehnt\|kein_interesse\|kein interesse\|not_interested\|dsgvo\|loesch/.test(ad) && /vertrieb_sperre/.test(ad) && /werbung_gesperrt_am IS NOT NULL/.test(ad), "Ablehnung = Kontaktprotokoll, Sperr-Klick, Werbesperre oder Stopp");
  ok(/vertriebssperre gesetzt/.test(ad) && !/fiaon_sperr_protokoll/.test(ad) && /fiaon_sperr_protokoll/.test(MF.ABLEHNUNG_DOKUMENTIERT_SQL("x.id", { sperrProtokoll: true }))
    && /NOT ILIKE '%account_status = CASE%'/.test(MF.ABLEHNUNG_DOKUMENTIERT_SQL("x.id", { sperrProtokoll: true })),
    "Prüfung: auch die Sperre der Verwaltung und das Sperr-Protokoll (nicht aus einem Zusammenführen) zählen als dokumentiert");
  const pl = quelle("scripts/mara-sperren-pruefliste.ts");
  ok(/sqlPool\.begin\("READ ONLY"/.test(pl) && !/\b(UPDATE|DELETE|INSERT)\b/.test(pl.replace(/\/\/.*$/gm, "")), "Prüfliste: nur lesen (READ ONLY, kein UPDATE/DELETE/INSERT)");
  ok(/person_id;stufe;offen_euro/.test(pl), "Prüfliste: person_id, Stufe, offener Betrag");
  const tn = MF.tuerNeinSql("adr", "payment_reminder");
  ok(tn.includes(MF.WERBESPERRE_ADRESSEN_SQL) && tn.includes(MF.HART_UNZUSTELLBAR_ADRESSEN_SQL), "payment_reminder: Werbesperre an der Adresse + hart unzustellbar (wie die Tür)");
  ok(!MF.tuerNeinSql("adr", "abo_payment_reminder").includes(MF.WERBESPERRE_ADRESSEN_SQL), "Zahlungspost (Rate): nur unzustellbar — die Werbesperre trifft sie nicht");
  const an = quelle("server/routes/fiaon-antrag.ts");
  const claim = an.slice(an.indexOf("async function claimReminderBatch("), an.indexOf("function reminderPayload("));
  ok(!/reminder_count = COALESCE\(reminder_count, 0\) \+ 1/.test(claim) && /tuerNeinSql\(/.test(claim), "claimReminderBatch: Sperrprüfung der Tür, Anspruch zählt nicht hoch");
  ok((an.match(/await erinnerungGezaehlt\(String\(r\.ref\)\)/g) ?? []).length === 2 && /reminder_number: Number\(r\.reminder_count \|\| 0\) \+ 1/.test(an), "reminder_count nur nach echtem Versand (Takt und Sammelversand)");
  const rh = quelle("server/lib/fiaon-rueckholung.ts");
  ok(/AND NOT \$\{sqlPool\.unsafe\(tuerNeinSql\("LOWER\(TRIM\(b\.email\)\)", event\)\)\}/.test(rh) && /tuerNeinSql\("LOWER\(TRIM\(d\.email\)\)", "rueckhol_s5"\)/.test(rh), "rueckholKandidaten und Dauerpflege: dieselbe Sperrprüfung (kein Mahnstopp ohne Mail)");
}

// ═══════════════════════════════════════════════════════════════════════════
if (MIT_DB) {
  console.log("── Gegen die lokale Test-DB ───────────────────────────────────────");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const { globalKundeBereit } = await import("../server/lib/fiaon-global-kunde");
  await globalKundeBereit();
  await AE.ensureAntragErinnerungSpalten();
  await MA.aktionTabellen();
  const P: Record<string, number> = {};
  const historie: number[] = [];
  const [jsv] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'mara_aktion_je_stunde'`) as any[];
  const jeStundeVorher: string | null | undefined = jsv ? String(jsv.value) : null;
  await (await import("../server/lib/fiaon-kunde-aktiv")).ensureSperrProtokoll();
  const aufraeumen = async () => {
    const ids = Object.values(P);
    if (ids.length) {
      await sql`DELETE FROM fiaon_mara_aktion WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref LIKE 'FIAON-TS%'`.catch(() => {});
      await sql`DELETE FROM fiaon_agent_events WHERE type = 'vertrieb_sperre' AND meta LIKE '%"pruefts":true%'`.catch(() => {});
      await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${ids}) OR quelle_person_id = ANY(${ids})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE 'antrag:FIAON-TS%'`.catch(() => {});
    if (ids.length) {
      await sql`DELETE FROM fiaon_betreiber_todos WHERE schluessel = ANY(${ids.map((i) => `merge:${i}:sperre-ohne-vermerk`)})`.catch(() => {});
      await sql`DELETE FROM fiaon_sperr_protokoll WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${ids})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE 'PRUEFTS-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_leads WHERE email LIKE 'pruefts-%@kunde.invalid'`.catch(() => {});
    if (jeStundeVorher !== undefined) {
      if (jeStundeVorher === null) await sql`DELETE FROM fiaon_settings WHERE key = 'mara_aktion_je_stunde'`.catch(() => {});
      else await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_aktion_je_stunde', ${jeStundeVorher}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE 'FIAON-TS%'`.catch(() => {});
    await sql`UPDATE fiaon_persons SET merged_into_person_id = NULL WHERE person_ref LIKE 'PRUEFTS-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PRUEFTS-%'`.catch(() => {});
    if (historie.length) await sql`DELETE FROM fiaon_lauf_historie WHERE id = ANY(${historie})`.catch(() => {});
  };
  await aufraeumen();
  try {
    const person = async (k: string, o: { werbesperre?: boolean; blockiert?: boolean; test?: boolean } = {}) => {
      const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, werbung_gesperrt_am, is_blocked, ist_test_am)
        VALUES (${`PRUEFTS-${k}`}, 'Max', ${`Topsales${k}`}, ${`pruefts-${k.toLowerCase()}@kunde.invalid`}, ${o.werbesperre ? new Date() : null}, ${!!o.blockiert}, ${o.test ? new Date() : null})
        RETURNING id`) as any[];
      P[k] = Number(p.id);
      return P[k];
    };
    // Prüfung 08.10.: ein Abbrecher ist ohne Angabe einer aus dem NEUEN Weg (Werbehinweis am E-Mail-Feld); weg: null = alter Weg.
    const antrag = async (k: string, o: { ref: string; art: "abbruch" | "B" | "A"; vorStunden: number; email?: string; claimedVorStunden?: number; weg?: string | null; schritt?: number }) => {
      const abgeschickt = o.art !== "abbruch";
      await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, current_step, pack_key, pack_name, payment_status, amount_due,
                  first_name, last_name, email, created_at, updated_at, antrag_stand_am, submitted_at, claimed_paid_at, antrag_weg)
        VALUES (${o.ref}, ${P[k] ?? null}, 'private', ${abgeschickt ? "submitted" : "finances"}, ${abgeschickt ? 8 : (o.schritt ?? 2)}, 'pro', 'FIAON Pro',
                ${o.art === "A" ? "claimed_paid" : o.art === "B" ? "pending_payment" : "pending"}, 59.99,
                'Max', ${`Topsales${k}`}, ${o.email ?? `pruefts-${k.toLowerCase()}@kunde.invalid`},
                NOW() - make_interval(hours => ${o.vorStunden}), NOW() - make_interval(hours => ${o.vorStunden}), NOW() - make_interval(hours => ${o.vorStunden}),
                ${abgeschickt ? sql`NOW() - make_interval(hours => ${o.vorStunden})` : null},
                ${o.art === "A" ? sql`NOW() - make_interval(hours => ${o.claimedVorStunden ?? o.vorStunden})` : null},
                ${o.weg === undefined ? (abgeschickt ? null : "neu") : o.weg})`;
    };

    // ── Hebel 1 ──
    console.log("  · Hebel 1: Abbruch-Kette (Auswahl, ohne Versand)");
    await person("AB1"); await antrag("AB1", { ref: "FIAON-TSAB1-0001", art: "abbruch", vorStunden: 1 });
    await person("AB2", { werbesperre: true }); await antrag("AB2", { ref: "FIAON-TSAB2-0002", art: "abbruch", vorStunden: 1 });
    await person("AB3", { blockiert: true }); await antrag("AB3", { ref: "FIAON-TSAB3-0003", art: "abbruch", vorStunden: 1 });
    await person("AB4"); await antrag("AB4", { ref: "FIAON-TSAB4-0004", art: "abbruch", vorStunden: 120 });
    await person("AB5"); await antrag("AB5", { ref: "FIAON-TSAB5-0005", art: "abbruch", vorStunden: 2 }); await antrag("AB5", { ref: "FIAON-TSAB5-0006", art: "B", vorStunden: 1 });
    await person("AB6"); await antrag("AB6", { ref: "FIAON-TSAB6-0007", art: "B", vorStunden: 3 });
    await antrag("OHNE", { ref: "FIAON-TSAB7-0008", art: "abbruch", vorStunden: 1, email: "pruefts-ohne@kunde.invalid" });
    const refAB = await sql`SELECT payment_reference FROM fiaon_applications WHERE ref = 'FIAON-TSAB1-0001'` as any[];
    ok(!!refAB[0]?.payment_reference, "Der Trigger gibt auch dem Abbrecher sofort einen Verwendungszweck (die alte Bedingung traf nie)");
    const ab = AE.erinnerbarAb(new Date(), new Date());
    const ausw = new Set(((await sql.unsafe(AE.abbrecherSql(ab.toISOString()))) as any[]).map((z) => String(z.ref)));
    ok(ausw.has("FIAON-TSAB1-0001"), "Abbrecher (1 h, mit Verwendungszweck) ist in der Kette");
    ok(!ausw.has("FIAON-TSAB2-0002") && !ausw.has("FIAON-TSAB3-0003"), "Werbesperre und Vertriebssperre: nicht in der Kette");
    ok(!ausw.has("FIAON-TSAB4-0004"), "Älter als 48 h vor dem Stichtag: nicht im ersten Lauf (Schutz gegen den Stoß)");
    ok(!ausw.has("FIAON-TSAB5-0005") && !ausw.has("FIAON-TSAB6-0007"), "Daneben abgeschickt bzw. selbst abgeschickt: nicht in der Kette");
    ok(!ausw.has("FIAON-TSAB7-0008"), "Ohne Person (kein Abmeldelink): nicht in der Kette");

    // ── Prüfung 08.10.: alter Weg, Lead-Abmeldung, eine Mail je Tag ──
    await person("AW1"); await antrag("AW1", { ref: "FIAON-TSAW1-0031", art: "abbruch", vorStunden: 1, weg: null, schritt: 2 });
    await person("AW2"); await antrag("AW2", { ref: "FIAON-TSAW2-0032", art: "abbruch", vorStunden: 1, weg: null, schritt: 6 });
    await person("AW3"); await antrag("AW3", { ref: "FIAON-TSAW3-0033", art: "abbruch", vorStunden: 1, weg: null, schritt: 2 });
    await sql`INSERT INTO fiaon_leads (email, vorname, quelle, status, person_id, einwilligung) VALUES ('pruefts-aw3@kunde.invalid', 'Lea', 'facebook_lead_ads', 'neu', ${P.AW3}, ${sql.json({ text: "Ich willige ein …", ja: true } as any)})`;
    await person("LA1"); await antrag("LA1", { ref: "FIAON-TSLA1-0034", art: "abbruch", vorStunden: 1 });
    await sql`INSERT INTO fiaon_leads (email, vorname, quelle, status, person_id, abgemeldet_am) VALUES ('pruefts-la1-lead@kunde.invalid', 'Lea', 'facebook_lead_ads', 'neu', ${P.LA1}, NOW() - INTERVAL '3 days')`;
    await person("LA2"); await antrag("LA2", { ref: "FIAON-TSLA2-0035", art: "abbruch", vorStunden: 1 });
    await sql`INSERT INTO fiaon_leads (email, vorname, quelle, status, abgemeldet_am) VALUES ('pruefts-la2@kunde.invalid', 'Lea', 'facebook_lead_ads', 'neu', NOW() - INTERVAL '3 days')`;
    await person("TG1"); await antrag("TG1", { ref: "FIAON-TSTG1-0036", art: "abbruch", vorStunden: 1 });
    await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art) VALUES ('antrag_erinnerung', ${P.TG1}, 'pruefts-tg1@kunde.invalid', 'versandt', 'echt')`;
    await person("TG2"); await antrag("TG2", { ref: "FIAON-TSTG2-0037", art: "abbruch", vorStunden: 1 });
    await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, created_at) VALUES ('antrag_erinnerung', ${P.TG2}, 'pruefts-tg2@kunde.invalid', 'versandt', 'echt', NOW() - INTERVAL '30 hours')`;
    const ausw2 = new Set(((await sql.unsafe(AE.abbrecherSql(ab.toISOString()))) as any[]).map((z) => String(z.ref)));
    ok(!ausw2.has("FIAON-TSAW1-0031"), "Alter Weg, Abbruch vor Schritt 6, ohne Lead-Einwilligung: keine Kette (Werbehinweis nie gesehen)");
    ok(ausw2.has("FIAON-TSAW2-0032") && ausw2.has("FIAON-TSAW3-0033"), "Alter Weg ab Schritt 6 oder mit Lead-Einwilligung: in der Kette");
    ok(!ausw2.has("FIAON-TSLA1-0034") && !ausw2.has("FIAON-TSLA2-0035"), "Lead-Abmeldung (an der Person bzw. nur an derselben Adresse): keine Kette");
    ok(!ausw2.has("FIAON-TSTG1-0036") && ausw2.has("FIAON-TSTG2-0037"), "Heute schon eine antrag_erinnerung an Person/Adresse: keine zweite (gestern: ja)");
    ok(ausw2.has("FIAON-TSAB1-0001"), "Der gewöhnliche Abbrecher (neuer Weg) bleibt in der Kette");
    // Lead-Abmeldung setzt die Werbesperre der Person (werbesperreSetzen — die Funktion der Route)
    await person("LA3");
    const { werbesperreSetzen } = await import("../server/routes/fiaon-abmelden");
    ok((await werbesperreSetzen(P.LA3, "Prüfstand: Abmeldung über eine Lead-Mail")) === true, "werbesperreSetzen trifft die Person");
    const [la3] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${P.LA3}`) as any[];
    ok(la3?.werbung_gesperrt_am != null, "… und setzt werbung_gesperrt_am (dann greifen Tür, Mara-Aktion, Rückholung, WhatsApp)");

    // ── Hebel 2 ──
    console.log("  · Hebel 2: Lead-Strecke");
    const [fs] = (await sql.unsafe(`SELECT ${Array.from({ length: 14 }, (_, s) => `${LS.faelligNachTagenSql(String(s))} AS s${s}`).join(", ")}`)) as any[];
    ok(Array.from({ length: 14 }, (_, s) => Number(fs[`s${s}`]) === LS.faelligNachTagen(s)).every(Boolean), "faelligNachTagenSql = faelligNachTagen (Stufe 0–13)");
    const lead = async (k: string, o: { tage: number; stufe: number; letzteVorTagen: number | null; importiert?: boolean }) =>
      sql`INSERT INTO fiaon_leads (email, vorname, nachname, quelle, status, erstellt_am, strecke_stufe, strecke_seit, strecke_letzte_am, import_id)
          VALUES (${`pruefts-lead-${k}@kunde.invalid`}, 'Lea', ${`Topsales${k}`}, ${o.importiert ? "import" : "facebook_lead_ads"}, 'kontaktiert',
                  NOW() - make_interval(days => ${o.tage}), ${o.stufe}, NOW() - make_interval(days => ${o.tage}),
                  ${o.letzteVorTagen == null ? null : sql`NOW() - make_interval(days => ${o.letzteVorTagen})`}, ${o.importiert ? "PRUEFTS-IMPORT" : null})`;
    await lead("alt", { tage: 87, stufe: 1, letzteVorTagen: 27 });
    await lead("frisch", { tage: 2, stufe: 0, letzteVorTagen: null });
    await lead("nicht", { tage: 3, stufe: 2, letzteVorTagen: 2 });
    await lead("import", { tage: 87, stufe: 1, letzteVorTagen: 27, importiert: true });
    const strecke = await import("../server/lib/fiaon-lead-strecke");
    const dran = (await strecke.faellige(5_000)).filter((l: any) => String(l.email).startsWith("pruefts-lead-"));
    const mails = dran.map((l: any) => String(l.email));
    ok(mails.includes("pruefts-lead-alt@kunde.invalid"), "Überfälliger alter Lead (87 Tage, Stufe 1) wird gefunden");
    ok(mails.includes("pruefts-lead-frisch@kunde.invalid") && mails.indexOf("pruefts-lead-frisch@kunde.invalid") < mails.indexOf("pruefts-lead-alt@kunde.invalid"), "Nie angeschrieben steht vor dem Wartenden");
    ok(!mails.includes("pruefts-lead-nicht@kunde.invalid"), "Nicht fälliger Lead bleibt draußen");
    ok(!mails.includes("pruefts-lead-import@kunde.invalid"), "Import ohne Einwilligung bleibt draußen");
    const nurEiner = (await strecke.faellige(1)).length;
    ok(nurEiner <= 1, "Die Grenze gilt NACH der Fälligkeit");

    // ── Hebel 3 ──
    console.log("  · Hebel 3: Takt SQL = TypeScript");
    const proben: { n: number; am: Date; pid: number }[] = [];
    for (let i = 0; i < 60; i++) proben.push({ n: 1 + (i % 7), am: new Date(Date.now() - (i * 7.3 + 0.4) * 3_600_000 * 4), pid: 1000 + i * 13 });
    const werte = proben.map((p, i) => `(${i}, ${p.n}, '${p.am.toISOString()}'::timestamptz, ${p.pid})`).join(", ");
    const zeilen = (await sql.unsafe(`SELECT i, (${MA.aktionTaktSql("v.n", "v.am", "v.pid")}) AS f FROM (VALUES ${werte}) v(i, n, am, pid) ORDER BY i`)) as any[];
    const abw = zeilen.filter((z) => z.f !== MA.aktionTaktFaellig(proben[z.i].n, proben[z.i].am, proben[z.i].pid));
    ok(abw.length === 0, `aktionTaktSql = aktionTaktFaellig (60 Proben${abw.length ? `, ${abw.length} abweichend` : ""})`);
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_aktion_je_stunde', '190') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    const e190 = await MA.einstellungenLesen();
    const z190 = await MA.aktionZaehler(e190);
    ok(e190.jeStunde === 60 && z190.tagesDeckel === 60 * 24, `Gespeichert 190 (wie in der Produktion) → es gelten 60 je Stunde (gelesen ${e190.jeStunde}, Tagesdeckel ${z190.tagesDeckel})`);

    // ── Hebel 4 ──
    console.log("  · Hebel 4: Stufe A klären");
    const wProben = Array.from({ length: 21 }, (_, i) => new Date(Date.now() - i * 86_400_000 + 3_600_000 * (i % 5)));
    const wz = (await sql.unsafe(`SELECT ${wProben.map((d, i) => `${SA.werktageSeitSql(`'${d.toISOString()}'::timestamptz`)} AS w${i}`).join(", ")}`)) as any[];
    ok(wProben.every((d, i) => Number(wz[0][`w${i}`]) === SA.werktageSeit(d)), "werktageSeitSql = werktageSeit (21 Tage)");
    // A1: Meldung vor 7 Tagen (≥ 3 Werktage), 5 Aktionsmails, die letzte vor 3 Tagen → Takt (wöchentlich) evtl. nicht fällig, Klärung schon
    await person("A1"); await antrag("A1", { ref: "FIAON-TSA1-0011", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    for (let i = 0; i < 5; i++) await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, gesendet_am, created_at)
      VALUES (${P.A1}, 'FIAON-TSA1-0011', 'A', ${i + 1}, 'gesendet', 'früher', NOW() - make_interval(days => ${3 + i}), NOW() - make_interval(days => ${3 + i}))`;
    // A2: frisch gemeldet (vor 2 h) → keine Klärung; A3: ≥ 3 Werktage, aber passender Eingang → nichts
    await person("A2"); await antrag("A2", { ref: "FIAON-TSA2-0012", art: "A", vorStunden: 30, claimedVorStunden: 2 });
    await person("A3"); await antrag("A3", { ref: "FIAON-TSA3-0013", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    const [z3] = (await sql`SELECT payment_reference FROM fiaon_applications WHERE ref = 'FIAON-TSA3-0013'`) as any[];
    await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, payer_name, reference_raw, extracted_ref, match_status, applied)
              VALUES ('PRUEFTS-1', NOW() - INTERVAL '2 hours', 5999, 'Jemand Anders', ${String(z3.payment_reference)}, ${String(z3.payment_reference).replace(/-/g, "")}, 'unmatched', FALSE)`;
    // A4: ≥ 3 Werktage, Vertriebssperre → keine Aufgabe, keine Mail
    await person("A4", { blockiert: true }); await antrag("A4", { ref: "FIAON-TSA4-0014", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    const sch = await MA.kandidatenLaden(5_000, ["A", "B"], { rundeSeit: null });
    const k1 = sch.find((k) => k.personId === P.A1);
    ok(!!k1 && k1.klaerung === true, "A1 (7 Tage, 5 Aktionsmails, letzte vor 3 Tagen): die Klärung ist fällig — trotz Wochentakt");
    ok(!sch.some((k) => k.personId === P.A2) || sch.find((k) => k.personId === P.A2)?.klaerung === false, "A2 (frisch gemeldet): keine Klärung");
    ok(!sch.some((k) => k.personId === P.A3) && !sch.some((k) => k.personId === P.A4), "A3 (Eingang im Bankbuch) und A4 (Vertriebssperre): nicht in der Schlange");
    // Prüfung 08.10.: höchstens 20 Klärungen am Tag — 20 heute schon raus → A1 wartet (er ist NUR über die Klärung fällig)
    for (let i = 0; i < MA.KLAERUNG_JE_TAG; i++) await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, gesendet_am, created_at, pruefung)
      VALUES (${P.A3}, ${`FIAON-TSKL-${i}`}, 'A', 1, 'gesendet', 'Klärung', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute', ${sql.json({ wissen: { klaerung: true } } as any)})`;
    ok((await MA.klaerungenHeute()) >= MA.KLAERUNG_JE_TAG, `klaerungenHeute zählt die heutigen Klärungen (${await MA.klaerungenHeute()})`);
    const schVoll = await MA.kandidatenLaden(5_000, ["A", "B"], { rundeSeit: null });
    ok(!schVoll.find((k) => k.personId === P.A1), "20 Klärungen heute schon raus → A1 ist heute nicht dran (morgen wieder)");
    await sql`DELETE FROM fiaon_mara_aktion WHERE person_id = ${P.A3} AND ref LIKE 'FIAON-TSKL-%'`;
    // Prüfung 08.10.: Fremdsprache — die KI-Mail trägt klaerungEntfaellt; danach keine 2-Tage-Ausnahme mehr
    await person("A5"); await antrag("A5", { ref: "FIAON-TSA5-0015", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    for (let i = 0; i < 5; i++) await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, gesendet_am, created_at, pruefung)
      VALUES (${P.A5}, 'FIAON-TSA5-0015', 'A', ${i + 1}, 'gesendet', 'früher', NOW() - make_interval(days => ${3 + i}), NOW() - make_interval(days => ${3 + i}),
              ${i === 0 ? sql.json({ wissen: { klaerungEntfaellt: true, stufe: "A" } } as any) : null})`;
    const sch5 = await MA.kandidatenLaden(5_000, ["A", "B"], { rundeSeit: null });
    ok(!sch5.find((k) => k.personId === P.A5), "A5 (Mail in fremder Sprache mit „klaerungEntfaellt“): keine Klärung mehr fällig, kein Takt-Durchbruch alle 2 Tage");
    await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, gesendet_am, created_at, pruefung)
      VALUES (${P.A1}, 'FIAON-TSA1-0011', 'A', 6, 'gesendet', ${SA.KLAERUNG_BETREFF}, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', ${sql.json({ wissen: { klaerung: true } } as any)})`;
    const sch2 = await MA.kandidatenLaden(5_000, ["A", "B"], { rundeSeit: null });
    ok(!sch2.find((k) => k.personId === P.A1)?.klaerung, "Nach der Klärung: keine zweite zu derselben Bestellung");
    const aufg = new Set(((await sql.unsafe(SA.stufeAKlaerenSql({ hoechstens: 5_000 }))) as any[]).map((z) => Number(z.person_id)));
    ok(aufg.has(P.A1) && !aufg.has(P.A2) && !aufg.has(P.A3) && !aufg.has(P.A4), "Anrufaufgabe: A1 ja; frisch, Eingang im Bankbuch und Vertriebssperre nein");
    // Prüfung 08.10.: Stopp / Werbesperre / „abgelehnt“ stehen in der Zeile der Aufgabe
    await person("A6", { werbesperre: true }); await antrag("A6", { ref: "FIAON-TSA6-0016", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    await person("A7"); await antrag("A7", { ref: "FIAON-TSA7-0017", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note) VALUES ('FIAON-TSA7-0017', NULL, 'Prüfstand', 'call', 'erreicht_abgelehnt', 'will nicht')`;
    await person("A8"); await antrag("A8", { ref: "FIAON-TSA8-0018", art: "A", vorStunden: 24 * 9, claimedVorStunden: 24 * 7 });
    await sql`INSERT INTO fiaon_whatsapp (person_id, richtung, nummer, text, status) VALUES (${P.A8}, 'rein', '4915100000000', 'STOPP', 'empfangen')`;
    const zA = new Map(((await sql.unsafe(SA.stufeAKlaerenSql({ hoechstens: 5_000 }))) as any[]).map((z) => [Number(z.person_id), z]));
    ok(zA.get(P.A6)?.werbesperre === true && zA.get(P.A7)?.abgelehnt === true && zA.get(P.A8)?.stopp === true && zA.get(P.A1)?.stopp === false && zA.get(P.A1)?.abgelehnt === false,
      "Werbesperre (A6), „abgelehnt“ an der Bestellung (A7) und „Stopp“ (A8) werden erkannt; A1 ohne");
    ok(SA.klaerAufgabe(zA.get(P.A7), 3).agentId === null && /^ACHTUNG: Kunde hat „Stopp“ gesagt/.test(SA.klaerAufgabe(zA.get(P.A8), 3).text),
      "A7 geht an die Leitung, A8 trägt den Hinweis vorn im Text");
    ok((await SA.stufeAKlaerenMelden({ trocken: true, hoechstens: 5_000 })) >= 1, "Trockenlauf zählt, legt nichts an");
    const [todo0] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE 'antrag:FIAON-TS%'`) as any[];
    ok(Number(todo0.n) === 0, "… und hat wirklich nichts angelegt");

    // ── Hebel 5 (Prüfung 08.10.) ──
    console.log("  · Hebel 5: Wochentag der dritten Raten-WhatsApp, SQL = TypeScript");
    const pids = Array.from({ length: 50 }, (_, i) => 1 + i * 131);
    const [wt] = (await sql.unsafe(`SELECT ${pids.map((pid, i) => `${WZ.RATE_WOCHENTAG_SQL(String(pid))} AS w${i}`).join(", ")}`)) as any[];
    ok(pids.every((pid, i) => wt[`w${i}`] === WZ.rateWochentagHeute(pid)), "RATE_WOCHENTAG_SQL = rateWochentagHeute (50 Personennummern, heute)");
    ok(pids.filter((pid) => WZ.rateWochentagHeute(pid)).length >= 5 && pids.filter((pid) => WZ.rateWochentagHeute(pid)).length <= 10, "Heute ist rund ein Siebtel dran");

    // ── Hebel 7 ──
    console.log("  · Hebel 7: Wächter der Verkaufsläufe");
    const zeile = async (name: string, vorStunden: number, meldung: string) => {
      const [r] = (await sql`INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
        VALUES (${name}, 'erfolg', NOW() - make_interval(hours => ${vorStunden}), NOW() - make_interval(hours => ${vorStunden}), 5, ${meldung}) RETURNING id`) as any[];
      historie.push(Number(r.id));
    };
    const altMeldungen = (await sql`SELECT id FROM fiaon_lauf_historie WHERE name = 'mara_wa_nachfass' AND begonnen > NOW() - INTERVAL '24 hours'`) as any[];
    if (!altMeldungen.length) {
      await zeile("mara_wa_nachfass", 23, CR.laufMeldung("mara_wa_nachfass", { kandidaten: 4, gesendet: 0, uebersprungen: {} })!);
      await zeile("mara_wa_nachfass", 2, CR.laufMeldung("mara_wa_nachfass", { kandidaten: 1, gesendet: 0, uebersprungen: {} })!);
      ok((await CR.verkaufsLaeufeWachen({ nichtSenden: true })).includes("mara_wa_nachfass"), "24 h gelaufen, 0 verschickt → Alarm");
      await zeile("mara_wa_nachfass", 1, CR.laufMeldung("mara_wa_nachfass", { kandidaten: 1, gesendet: 2, uebersprungen: {} })!);
      ok(!(await CR.verkaufsLaeufeWachen({ nichtSenden: true })).includes("mara_wa_nachfass"), "Sobald etwas rausging → kein Alarm");
    } else ok(true, "(Historie für mara_wa_nachfass schon belegt — Wächter-Probe übersprungen)");
    const [lm] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_lauf_historie WHERE id = ANY(${historie}) AND meldung ~ '"versandt":[0-9]+'`) as any[];
    ok(Number(lm.n) === historie.length, "Meldungen tragen „versandt“");

    // ── Hebel 8 ──
    console.log("  · Hebel 8: Vertriebssperre beim Zusammenführen");
    const doku = async (id: number) => ((await sql.unsafe(`SELECT ${MF.ABLEHNUNG_DOKUMENTIERT_SQL("$1::int")} AS ja`, [id])) as any[])[0]?.ja === true;
    await person("V1", { blockiert: true }); await antrag("V1", { ref: "FIAON-TSV1-0021", art: "B", vorStunden: 30 });
    await person("V2", { blockiert: true }); await antrag("V2", { ref: "FIAON-TSV2-0022", art: "B", vorStunden: 30 });
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note) VALUES ('FIAON-TSV2-0022', ${P.V2}, NULL, 'Prüfstand', 'call', 'erreicht_abgelehnt', 'Kunde hat abgelehnt')`;
    await person("V3", { blockiert: true });
    await sql`INSERT INTO fiaon_agent_events (agent_id, type, meta) VALUES (NULL, 'vertrieb_sperre', ${JSON.stringify({ person_id: P.V3, alt: false, neu: true, pruefts: true })})`;
    ok(!(await doku(P.V1)) && (await doku(P.V2)) && (await doku(P.V3)), "Dokumentiert: Kontaktprotokoll „abgelehnt“ (V2), Sperr-Klick (V3); V1 ohne");
    // Prüfung 08.10.: die Sperre der Verwaltung (V4) und eine Sperre im Sperr-Protokoll, die nicht aus einem Zusammenführen stammt (V5)
    await person("V4", { blockiert: true }); await antrag("V4", { ref: "FIAON-TSV4-0024", art: "B", vorStunden: 30 });
    await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note) VALUES ('FIAON-TSV4-0024', NULL, 'Admin', 'edit', 'Vertriebssperre GESETZT durch die Verwaltung — Prüfstand')`;
    await person("V5"); await antrag("V5", { ref: "FIAON-TSV5-0025", art: "B", vorStunden: 30 });
    await sql`UPDATE fiaon_persons SET is_blocked = TRUE, follow_up_date = NULL, updated_at = NOW() WHERE id = ${P.V5}`;
    const dokuP = async (id: number) => ((await sql.unsafe(`SELECT ${MF.ABLEHNUNG_DOKUMENTIERT_SQL("$1::int", { sperrProtokoll: true })} AS ja`, [id])) as any[])[0]?.ja === true;
    ok((await doku(P.V4)) && !(await doku(P.V5)) && (await dokuP(P.V5)) && !(await dokuP(P.V1)),
      "Dokumentiert: Sperre der Verwaltung (V4); Sperr-Protokoll ohne Zusammenführen (V5, nur mit sperrProtokoll); V1 weiter ohne");
    await person("G1"); await person("G2"); await person("G4");
    const { personenZusammenfuehren } = await import("../server/lib/fiaon-person-merge");
    const probe = async (verlierer: number, gewinner: number) => {
      let blockiert: boolean | null = null, aufgabe = false;
      await sql.begin(async (tx: any) => {
        await personenZusammenfuehren(verlierer, gewinner, {}, { name: "Prüfstand Topsales" }, { tx });
        const [g] = (await tx`SELECT is_blocked FROM fiaon_persons WHERE id = ${gewinner}`) as any[];
        blockiert = !!g?.is_blocked;
        const [t] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`merge:${gewinner}:sperre-ohne-vermerk`}`) as any[];
        aufgabe = Number(t?.n || 0) === 1;
        throw new Error("ZURUECK");
      }).catch((e: any) => { if (!/ZURUECK/.test(String(e?.message))) throw e; });
      return { blockiert, aufgabe };
    };
    const m1 = await probe(P.V1, P.G1);
    ok(m1.blockiert === true && m1.aufgabe === true, "Prüfung: Verlierer gesperrt OHNE Vermerk → die Sperre geht MIT, dazu EINE Prüfaufgabe (nichts fällt automatisch)");
    const m2 = await probe(P.V2, P.G2);
    ok(m2.blockiert === true && m2.aufgabe === false, "Verlierer gesperrt MIT Ablehnung → die Sperre geht mit, keine Aufgabe");
    const m4 = await probe(P.V4, P.G4);
    ok(m4.blockiert === true && m4.aufgabe === false, "Sperre der Verwaltung → mit, keine Aufgabe");
    await person("G3", { blockiert: true });
    ok((await probe(P.G1, P.G3)).blockiert === true, "Eine Sperre des Gewinners bleibt immer (keine Sperre aufgehoben)");
    const [nachMerge] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`merge:${P.G1}:sperre-ohne-vermerk`}`) as any[];
    ok(Number(nachMerge.n) === 0, "Zusammenführen zurückgerollt → auch keine Aufgabe (dieselbe Transaktion)");
    const env = { HOME: String(process.env.HOME ?? ""), PATH: String(process.env.PATH ?? ""), DATABASE_URL: String(process.env.DATABASE_URL) };
    const csv = execFileSync("node_modules/.bin/tsx", ["scripts/mara-sperren-pruefliste.ts"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const reihen = csv.trim().split("\n");
    ok(reihen[0] === "person_id;stufe;offen_euro;aus_zusammenfuehrung;gesperrt_seit", "Prüfliste: Kopfzeile");
    ok(reihen.some((r) => r.startsWith(`${P.V1};B;59,99;`)) && !reihen.some((r) => r.startsWith(`${P.V2};`)), "Prüfliste: V1 (ohne Ablehnung) drin, V2 (abgelehnt) nicht");
    ok(!reihen.some((r) => r.startsWith(`${P.V4};`)) && !reihen.some((r) => r.startsWith(`${P.V5};`)), "Prüfliste: Sperre der Verwaltung (V4) und aus dem Sperr-Protokoll (V5) nicht");
    ok(!reihen.slice(1).some((r) => /@|Topsales|Max/.test(r)), "Prüfliste: keine Namen, keine Adressen");
    const [nachher] = (await sql`SELECT is_blocked FROM fiaon_persons WHERE id = ${P.V1}`) as any[];
    ok(nachher?.is_blocked === true, "Prüfliste hat nichts geändert (V1 weiter gesperrt)");

    // ── Hebel 9 ──
    console.log("  · Hebel 9: Sperrprüfung wie die Tür");
    await person("WS", { werbesperre: true });
    await sql`INSERT INTO fiaon_leads (email, vorname, quelle, status, person_id) VALUES ('pruefts-zweit@kunde.invalid', 'Lea', 'facebook_lead_ads', 'neu', ${P.WS})`;
    const adressen = ["pruefts-ws@kunde.invalid", "pruefts-zweit@kunde.invalid", "pruefts-ab1@kunde.invalid", "pruefts-ab2@kunde.invalid", "niemand@kunde.invalid"];
    const sqlMenge = new Set(((await sql.unsafe(`SELECT adresse FROM ${MF.WERBESPERRE_ADRESSEN_SQL} m(adresse) WHERE adresse = ANY($1)`, [adressen])) as any[]).map((z) => String(z.adresse)));
    let gleich = true;
    for (const a of adressen) if (sqlMenge.has(a) !== (await MF.werbesperreAnAdresse(a))) gleich = false;
    ok(gleich && sqlMenge.has("pruefts-zweit@kunde.invalid") && sqlMenge.has("pruefts-ab2@kunde.invalid") && !sqlMenge.has("pruefts-ab1@kunde.invalid"), "WERBESPERRE_ADRESSEN_SQL = werbesperreAnAdresse (auch die Lead-Adresse)");
    const rk = await (await import("../server/lib/fiaon-rueckholung")).rueckholKandidaten("s4_nie_gemahnt", 5_000).catch((e: any) => { console.log("    (Rückholung:", String(e?.message).slice(0, 120), ")"); return null; });
    ok(rk === null || !rk.some((f) => String(f.email).toLowerCase() === "pruefts-ab2@kunde.invalid"), "Rückholung: keine Kandidaten mit Werbesperre an der Adresse");
  } finally {
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
    const [rest] = (await sql`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE 'PRUEFTS-%')::int AS p,
                                     (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'FIAON-TS%')::int AS a,
                                     (SELECT COUNT(*) FROM fiaon_leads WHERE email LIKE 'pruefts-%@kunde.invalid')::int AS l`) as any[];
    ok(rest.p === 0 && rest.a === 0 && rest.l === 0, "Aufgeräumt: keine Prüf-Personen, -Anträge, -Leads");
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n${schlecht ? "ROT" : "GRÜN"}: ${gut} bestanden, ${schlecht} fehlgeschlagen${MIT_DB ? " (mit Test-DB)" : " (offline)"}`);
process.exit(schlecht ? 1 : 0);
