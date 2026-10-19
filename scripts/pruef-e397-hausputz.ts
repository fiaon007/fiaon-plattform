// Prüfstand E-397 (19.10.2026): Großer Hausputz der Aufgaben.
// Teil A rein (ohne Datenbank): Erstattung, „nur Kündigung“, Sonderregeln der Ereignisse, ehrliche Priorität,
// Schnell-Gründe, Hausputz-Bewertung, Kartenlast/Sammelkarten.
// Teil B mit einer LOKALEN Prüfdatenbank (erfundene Testkunden): Ereignisse, Alarm-Tafel, Rückruf durch Gespräch,
// „Unterlagen eingegangen“, Hausputz Probelauf/Lauf/Zurückholen, Sammelkarte, Häkchen-Weg. Kein Netz, keine Mail.
// Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* bzw. fiaon_e397* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_e397_hausputz?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-e397-hausputz.ts
const URL_ = process.env.DATABASE_URL ?? "";
const MIT_DB = /@(127\.0\.0\.1|localhost):\d+\/(fiaon_pruefstand|fiaon_e397)/.test(URL_);
if (URL_ && !MIT_DB) { console.error("Nur gegen eine lokale Prüfdatenbank (fiaon_pruefstand*/fiaon_e397*)."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "META_SYSTEM_TOKEN"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 400)}` : ""}`); } }

async function teilA() {
  const A = await import("../shared/fiaon-auftrag-arten");
  const H = await import("../shared/fiaon-hausputz-regeln");

  console.log("── A1 · Erstattung erkennt das System immer (dann schließt nichts)");
  for (const [t, w] of [
    ["Der Kunde bittet darum, 99,99 Euro noch heute auf sein Konto zurückzusenden", true],
    ["Orhan Kircali’ye geri dönüş — kart ve geri ödeme talebi", true], ["Bitte Rückerstattung der Zahlung", true],
    ["Ich will mein Geld zurück", true], ["Rate zurückgebucht (Lastschrift)", true], ["Doppelzahler-Gutschrift freigeben", true],
    ["Kunde ruft morgen zurück", false], ["Kündigung bestätigen", false], ["Zahlung steht noch aus", false],
  ] as [string, boolean][]) ok(A.istErstattung(t) === w, `istErstattung(„${t.slice(0, 50)}“) = ${w}`);

  console.log("── A2 · „Nur Kündigung“ — Widerruf, Beschwerde, Erstattung, Werbewiderspruch bleiben offen");
  ok(A.nurKuendigung("Kunde möchte kündigen. Bitte Kündigung bestätigen."), "reine Kündigung");
  ok(A.nurKuendigung("möchte sein Starter-Abo beenden"), "„Abo beenden“ ist Kündigung");
  ok(!A.nurKuendigung("Kündigung und Widerruf des Vertrags"), "mit Widerruf: nein");
  ok(!A.nurKuendigung("Kündigung, ich will mein Geld zurück"), "mit Erstattung: nein");
  ok(!A.nurKuendigung("Kündigung — mein Anwalt meldet sich"), "mit Anwalt: nein");
  ok(!A.nurKuendigung("Ich kündige und will keine weiteren Mails mehr"), "mit Werbewiderspruch: nein");
  ok(!A.nurKuendigung("Ankündigung der nächsten Rate"), "„Ankündigung“ ist keine Kündigung");
  ok(!A.nurKuendigung(""), "leer: nein");

  console.log("── A3 · Sonderregeln: welches Ereignis schließt welche Art");
  const S = A.ereignisSchliesstArt;
  ok(S("kuendigung_gebucht", "kuendigung", { titel: "Kündigung", text: "Kunde kündigt sein Abo." }), "Kündigung gebucht → „Kündigung“ (rein) zu");
  ok(!S("kuendigung_gebucht", "kuendigung", { titel: "Kündigung oder Widerruf", text: "Widerruf nach 3 Tagen" }), "… mit Widerruf: bleibt");
  ok(!S("kuendigung_gebucht", "beschwerde", { titel: "Beschwerde", text: "Kündigung, ich beschwere mich" }), "„Beschwerde“ nie");
  const mailText = "Kündigung angesprochen, aber nicht gebucht. Betreff „Kündigung“ — Kunde möchte kündigen. [Mail #11]";
  ok(S("kuendigung_gebucht", "mara_mail_heikel", { titel: "Kunde hat geschrieben", text: mailText }), "Mail heikel nur mit Kündigungs-Grund → zu");
  ok(!S("kuendigung_gebucht", "mara_mail_heikel", { titel: "Kunde hat geschrieben", text: "Beschwerde. Betreff „Kündigung“ — Kündigung. [Mail #12]" }), "Mail heikel mit Grund Beschwerde → bleibt");
  ok(!S("kuendigung_gebucht", "mara_mail_heikel", { titel: "x", text: "Text ohne Blockformat" }), "Mail heikel unlesbar → bleibt");
  ok(S("vertrag_beendet", "mara_wa_heikel", { schluessel: "wa-77-heikel-2026-10-01", titel: "WhatsApp", text: "Bitte kündigen" }), "WhatsApp Klasse heikel + nur Kündigung → zu (Vertrag beendet)");
  ok(!S("vertrag_beendet", "mara_wa_heikel", { schluessel: "wa-77-bestreitet-2026-10-01", titel: "WhatsApp", text: "Bitte kündigen" }), "WhatsApp „bestreitet“ → nie");
  ok(S("testkonto", "beschwerde", { titel: "Beschwerde", text: "Anwalt" }), "Testkonto schließt auch Heikles …");
  ok(!S("testkonto", "beschwerde", { titel: "Beschwerde", text: "Geld zurück" }), "… aber nie eine Erstattung");
  ok(S("kunde_archiviert", "mara_rueckruf", { titel: "Rückruf", text: "bitte anrufen" }), "Archiviert → Rückruf zu");
  ok(!S("kunde_archiviert", "mara_rueckruf", { titel: "Rückruf", text: "Kunde will widerrufen" }), "Archiviert, heikler Inhalt → bleibt");
  ok(!S("kunde_archiviert", "zahlung", { titel: "Zahlung prüfen", text: "" }), "Archiviert → „Zahlung prüfen“ (nur Hand) bleibt");
  ok(S("alarm_vorbei", "verwaltung", { quelle: "lead-motor", titel: "Lead-Motor" }), "Alarm vorbei → alter Lead-Motor-Auftrag zu");
  ok(!S("alarm_vorbei", "verwaltung", { quelle: "system", titel: "Make-Zweig anlegen" }), "Alarm vorbei → andere Verwaltung bleibt");
  ok(S("mail_gespeichert", "unzustellbar_rate", { titel: "Rate: E-Mail unzustellbar" }), "neue E-Mail → „Rate: unzustellbar“ zu");
  ok(S("mail_gespeichert", "unzustellbar_erstzahlung", { titel: "Erstzahlung" }), "neue E-Mail → „Erstzahlung: unzustellbar“ zu");
  ok(S("zahlung_gebucht", "unzustellbar_erstzahlung", { titel: "x" }) && !S("zahlung_gebucht", "unzustellbar_rate", { titel: "x" }), "Zahlung gebucht: wie bisher (Erstzahlung ja, Rate nein)");
  ok(!S("kuendigung_gebucht", "mara_aufgabe", { titel: "Adresse ändern", text: "Kündigung" }), "Kündigung gebucht → „Aufgabe von Mara“ bleibt");
  ok(A.kandidatArtenFuerEreignis("testkonto").length === A.AUFTRAG_ART_LISTE.length, "Testkonto: alle Arten sind Kandidaten");
  ok(A.artenFuerEreignis("ergebnis_erreicht").every((a) => !(A.AUFTRAG_ARTEN[a] as any).nurHand), "alte Regel bleibt: ein Gespräch schließt keine nurHand-Art");

  console.log("── A4 · Ehrliche Priorität und Schnell-Gründe");
  ok(A.auftragDringend({ art: "kuendigung", quelle: "postmeister", prioritaet: 2 }), "Kündigung = dringend (Frist)");
  ok(!A.auftragDringend({ art: "mara_rueckruf", quelle: "postmeister", prioritaet: 1 }), "Rückruf mit P1 von Mara = nicht dringend");
  ok(A.auftragDringend({ art: "sonstiges", quelle: "hand", prioritaet: 1 }), "Justins eigene P1 = dringend");
  ok(A.AUFTRAG_ART_LISTE.every((a) => A.schnellGruende(a).length >= 2 && A.schnellGruende(a).every((g) => g.trim().length >= 5)), "je Art ≥ 2 Schnell-Gründe, jeder ≥ 5 Zeichen (erfüllt den Pflichtsatz)");
  const reihe = A.auftraegeSortieren([
    { id: 1, status: "offen", art: "mara_rueckruf", quelle: "postmeister", prioritaet: 1, eingangAm: "2026-10-01T10:00:00Z" },
    { id: 2, status: "offen", art: "beschwerde", quelle: "postmeister", prioritaet: 2, eingangAm: "2026-10-10T10:00:00Z" },
    { id: 3, status: "offen", art: "mara_hinweis", quelle: "postmeister", prioritaet: 2, eingangAm: "2026-09-01T10:00:00Z" },
  ]);
  ok(reihe[0].id === 2 && reihe[1].id === 3, "Reihenfolge: Frist zuerst, P1 von Mara zählt nicht als dringend", reihe.map((r) => r.id));
  ok(A.auftragStatus({ status: "erledigt", erledigtArt: "hausputz", erledigtEreignis: "Hausputz: Kopie" }).text === "Beim Hausputz erledigt"
    && A.auftragStatus({ status: "erledigt", erledigtArt: "hausputz", erledigtEreignis: "Hausputz: Kopie" }).grund === "Hausputz: Kopie", "Status „Beim Hausputz erledigt“ mit Grund");

  console.log("── A5 · Hausputz-Bewertung (rein)");
  const t = (x: any) => ({ id: 1, art: "mara_rueckruf", titel: "Rückruf", text: "bitte anrufen", schluessel: null, quelle: "postmeister", zustaendig_art: "agent", zustaendig_agent_id: 8,
    frage: false, von_hand_offen: false, alter_tage: 40, ist_test: false, alle_archiviert: false, alle_beendet: false, offene_raten: 0, kuendigung_danach: false, ende_danach: false,
    zust_gesperrt: false, bestellung_bezahlt_danach: false, erreicht_vom_zustaendigen: false, entwurf_wartet: false, kopie_mit_original: false, doppel_rang: 1, doppel_ziel: 1, root: 5, ...x });
  const B = H.auftragBewerten;
  ok(B(t({ ist_test: true }))?.regel === "test", "Testkonto → test");
  ok(B(t({ ist_test: true, text: "Geld zurück" })) === null, "Testkonto mit Erstattung → bleibt");
  ok(B(t({ frage: true, ist_test: true })) === null, "offene Frage → Hausputz fasst nichts an");
  ok(B(t({ von_hand_offen: true, ist_test: true })) === null, "von Hand wieder geöffnet → nichts");
  ok(B(t({ quelle: "lead-motor", art: "verwaltung", zustaendig_art: "betreiber", schluessel: "lead-motor:stille:2026-10-12" }))?.regel === "alarm", "Lead-Motor-Auftrag → alarm");
  ok(B(t({ quelle: "ki-pause", art: "verwaltung", zustaendig_art: "betreiber", schluessel: "ki-pause-wa-2026-10-19T04:11:00Z" })) === null, "Sammelaufgabe ki-pause-wa (echte Nachrichten) → bleibt");
  ok(B(t({ quelle: "termintreue", art: "verwaltung", zustaendig_art: "betreiber" }))?.regel === "termintreue", "Termintreue → termintreue");
  ok(B(t({ kopie_mit_original: true, zustaendig_art: "betreiber", art: "mara_mail_heikel", text: "Widerruf" }))?.regel === "kopie", "Kopie mit Original → kopie (auch heikel)");
  ok(B(t({ art: "kuendigung", titel: "Kündigung", text: "Kunde kündigt sein Abo.", kuendigung_danach: true }))?.regel === "kuendigung_gebucht", "Kündigung gebucht + rein → kuendigung_gebucht");
  ok(B(t({ art: "kuendigung", titel: "Kündigung", text: "Kündigung und Widerruf", kuendigung_danach: true, doppel_rang: 1 })) === null, "… mit Widerruf → bleibt");
  ok(B(t({ art: "mara_eskalation", titel: "Zahlung verweigert", text: "", alle_beendet: true, offene_raten: 0 }))?.regel === "eskalation_beendet", "Eskalation: beendet, keine Rate → zu");
  ok(B(t({ art: "mara_eskalation", titel: "Zahlung verweigert", text: "", alle_beendet: true, offene_raten: 2 })) === null, "Eskalation mit offener Rate → bleibt");
  ok(B(t({ art: "konto_karte", titel: "Konto & Karte", text: "Karte schicken", alle_beendet: true, ende_danach: true }))?.regel === "vertrag_beendet", "Vertrag beendet → Konto & Karte zu");
  ok(B(t({ art: "mara_hinweis", titel: "Hinweis", text: "Kunde fragt, wo seine 99,99 € sind", alle_beendet: true, ende_danach: true })) === null, "Vertrag beendet, Geld im Text → bleibt");
  ok(B(t({ art: "mara_rueckruf", erreicht_vom_zustaendigen: true }))?.regel === "erreicht", "vom Zuständigen erreicht → erreicht");
  ok(B(t({ art: "mara_mail", text: "Mara hat einen Entwurf vorbereitet, aber nicht gesendet.. Betreff „x“ — y. [Mail #3]", erreicht_vom_zustaendigen: true, entwurf_wartet: true }))?.regel !== "erreicht", "erreicht, aber Mara-Entwurf wartet → nicht „erreicht“");
  ok(B(t({ quelle: "system", art: "verwaltung", zustaendig_art: "betreiber", schluessel: "crif-b2b", alter_tage: 58 }))?.regel === "entwickler_alt", "Entwickler-Liste August → entwickler_alt");
  ok(B(t({ quelle: "system", art: "verwaltung", zustaendig_art: "betreiber", schluessel: "doppelzahler-gutschrift", titel: "Doppelzahler-Gutschrift freigeben", alter_tage: 58 })) === null, "… „Gutschrift“ (Erstattung) → bleibt");
  ok(B(t({ doppel_rang: 2, doppel_ziel: 99 }))?.regel === "doppel", "Doppel → zusammenführen");
  ok(B(t({ zust_gesperrt: true }))?.regel === "gesperrt", "bei gesperrtem Mitarbeiter → umhängen");
  // Doppel in ein Ziel, das selbst zugeht → bleibt offen
  const daten = { auftraege: [
    t({ id: 10, art: "kuendigung", titel: "Kündigung", text: "Kunde kündigt.", kuendigung_danach: true, doppel_rang: 1, doppel_ziel: 10 }),
    t({ id: 11, art: "kuendigung", titel: "Kündigung oder Widerruf", text: "Widerruf!", kuendigung_danach: true, doppel_rang: 2, doppel_ziel: 10 }),
    t({ id: 12, art: "mara_hinweis", titel: "Hinweis", text: "x", doppel_rang: 1, doppel_ziel: 12 }),
    t({ id: 13, art: "mara_hinweis", titel: "Hinweis", text: "y", doppel_rang: 2, doppel_ziel: 12 }),
  ], vermerke: [], rueckrufe: [] };
  const ent = H.hausputzBewerten(daten);
  ok(ent.some((e) => e.id === 10 && e.regel === "kuendigung_gebucht") && !ent.some((e) => e.id === 11), "Doppel mit Widerruf geht NICHT in ein geschlossenes Ziel — bleibt offen", ent);
  ok(ent.some((e) => e.id === 13 && e.regel === "doppel" && e.ziel === 12), "Doppel in offenes Ziel → zusammenführen");
  const v = (x: any) => ({ id: 1, text: "x", typ: "sonstige", fuer_betreiber: true, zustaendig_agent_id: null, alter_tage: 40, ist_test: false, alle_archiviert: false, alle_beendet: false,
    offene_raten: 1, kuendigung_danach: false, bezahlt_danach: false, zust_gesperrt: false, unterlagen_ungeprueft: 1, doppel_rang: 1, doppel_ziel: 1, root: 5, ...x });
  const V = H.vermerkBewerten;
  ok(V(v({ typ: "frist_gerissen", text: "FRIST GERISSEN — Rückruf … Anliegen: Karte fehlt" }))?.regel === "frist_gerissen", "Frist gerissen → zu (der Rückruf bleibt)");
  ok(V(v({ typ: "frist_gerissen", text: "FRIST GERISSEN — Rückruf … Anliegen: Rückerstattung" })) === null, "Frist gerissen mit Erstattung, kein offener Rückruf → bleibt (Erstattung nie automatisch)");
  ok(V(v({ typ: "frist_gerissen", text: "FRIST GERISSEN — Rückruf … Anliegen: Rückerstattung", rueckruf_offen: true }))?.regel === "frist_gerissen", "… mit offenem Rückruf → nur der Hinweis geht zu (die Sache bleibt im Rückruf)");
  ok(B(t({ kopie_mit_original: true, kopie_original_offen: true, zustaendig_art: "betreiber", text: "Geld zurück" }))?.regel === "kopie", "Kopie mit Erstattung, Original offen → Kopie zu (das Original bleibt)");
  ok(B(t({ kopie_mit_original: true, kopie_original_offen: false, zustaendig_art: "betreiber", text: "Geld zurück", doppel_rang: 1 })) === null, "Kopie mit Erstattung, Original schon zu → bleibt");
  ok(B(t({ quelle: "termintreue", art: "verwaltung", zustaendig_art: "betreiber", text: "Geld zurück" })) === null, "Erstattung gewinnt vor jeder Regel (auch Termintreue/Alarm)");
  ok(V(v({ typ: "unterlagen", unterlagen_ungeprueft: 0 }))?.regel === "unterlagen_geprueft", "Unterlagen alle geprüft → zu");
  ok(V(v({ typ: "unterlagen", unterlagen_ungeprueft: 2 })) === null, "Unterlagen noch ungeprüft → bleibt");
  ok(V(v({ typ: "postmeister_alt", text: "Postmeister: Dringende Mail … Bitte übernehmen." }))?.regel === "postmeister_alt", "alter Postmeister ohne Heikles → zu");
  ok(V(v({ typ: "postmeister_alt", text: "Postmeister: BESCHWERDE in welcome@ …" })) === null, "alter Postmeister mit Beschwerde → bleibt");
  ok(V(v({ typ: "nicht_erreicht", text: "Zahlung gemeldet, 9× nicht erreicht — entscheiden.", alter_tage: 40 }))?.regel === "gemeldet_alt", "gemeldete Zahlung > 14 Tage → zu (E-368/E-303)");
  ok(V(v({ typ: "nicht_erreicht", text: "Zahlung gemeldet, 9× nicht erreicht — entscheiden.", alter_tage: 5 })) === null, "gemeldete Zahlung < 14 Tage → bleibt");
  ok(V(v({ typ: "sonstige", zust_gesperrt: true, zustaendig_agent_id: 12 }))?.regel === "gesperrt", "Vermerk bei Gesperrtem → umhängen");
  ok(V(v({ typ: "sonstige", doppel_rang: 2, doppel_ziel: 7 })) === null, "handgeschriebene Vermerke („sonstige“) werden nie zusammengeführt");
  const R = H.rueckrufBewerten;
  ok(R({ id: 1, anliegen: "bitte zurückrufen", erreicht_danach: true })?.regel === "rueckruf_alt", "Rückruf: Kunde danach erreicht → zu");
  ok(R({ id: 1, anliegen: "Rückerstattung der Zahlung", erreicht_danach: true }) === null, "Rückruf mit Erstattung → bleibt");
  const z = H.hausputzZaehlen({ auftraege: [t({ id: 1, ist_test: true }), t({ id: 2 })], vermerke: [v({ id: 3, typ: "frist_gerissen" })], rueckrufe: [] },
    H.hausputzBewerten({ auftraege: [t({ id: 1, ist_test: true }), t({ id: 2 })], vermerke: [v({ id: 3, typ: "frist_gerissen" })], rueckrufe: [] }));
  ok(z.vorher.gesamt === 3 && z.nachher.gesamt === 1, "Zählung: vorher 3 → nachher 1", z);
  const sql = H.hausputzAuftraegeSql() + H.hausputzVermerkeSql() + H.hausputzRueckrufeSql();
  ok(!/\b(UPDATE|INSERT|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(sql), "Kandidaten-Abfragen sind reine SELECTs");

  console.log("── A9 · „Daraus einen Termin machen?“ — Tag und Uhrzeit aus der Notiz");
  const { terminAusNotiz } = await import("../shared/fiaon-termin-aus-notiz");
  const team = [{ id: 928, vorname: "Justin", nachname: "Schwarzott" }, { id: 8, vorname: "Daniel", nachname: "Stripling" }];
  const fr = new Date("2026-10-16T13:00:00Z"); // Freitag 15:00 Berlin — Daniels Notiz
  const TN = (notiz: string, jetzt = fr, bestehende: any[] = []) => terminAusNotiz({ notiz, jetzt, schreiberId: 8, mitarbeiter: team, bestehende });
  const daniel = TN("telefoniert am Montag 11 Uhr mit Justin");
  ok(daniel?.wandzeit === "2026-10-19 11:00" && daniel.teilnehmerId === 928 && daniel.genannt, "Daniels Notiz (Fr 16.10.) → Mo 19.10. 11:00 bei Justin", daniel);
  ok(TN("telefoniert am Montag 11 Uhr mit Justin", new Date("2026-10-19T08:00:00Z"))?.wandzeit === "2026-10-19 11:00", "am Montag um 10 gelesen → heute 11:00");
  ok(TN("telefoniert am Montag 11 Uhr mit Justin", new Date("2026-10-19T10:00:00Z"))?.wandzeit === "2026-10-26 11:00", "am Montag nach 11 gelesen → nächster Montag");
  const selbst = TN("Rückruf morgen 14:30, Kunde sucht die Kontoauszüge raus");
  ok(selbst?.wandzeit === "2026-10-17 14:30" && selbst.teilnehmerId === 8 && !selbst.genannt, "„Rückruf morgen 14:30“ → beim Schreiber selbst", selbst);
  ok(TN("Termin am 22.10. um 9 vereinbart")?.wandzeit === "2026-10-22 09:00", "„am 22.10. um 9“ → 22.10. 09:00 (Datum ist keine Uhrzeit)");
  ok(TN("Gespräch am 22.10., Uhrzeit offen") === null, "Datum ohne Uhrzeit → kein Vorschlag (22.10. ist nicht 22:10)");
  ok(TN("Rückruf Montag 11.30 Uhr")?.wandzeit === "2026-10-19 11:30", "„11.30 Uhr“ → 11:30");
  ok(TN("Rückruf übermorgen um 11 Uhr")?.wandzeit === "2026-10-18 11:00", "„übermorgen“ wird erkannt (vorher: ü brach die Wortgrenze)");
  ok(TN("Kunde zahlt am Freitag") === null, "kein Uhrzeit → nichts");
  ok(TN("Kunde hat gestern um 10 Uhr überwiesen") === null, "Vergangenheit → nichts");
  ok(TN("Termin am 15.11. um 10 Uhr") === null, "mehr als 14 Tage voraus → nichts");
  ok(TN("Kunde ruft um 11 Uhr zurück") === null, "Uhrzeit ohne Tag → nichts");
  ok(TN("telefoniert am Montag 11 Uhr mit Justin", fr, [{ id: 1, beginn: "2026-10-19T09:15:00Z", agentId: 928, status: "gebucht" }]) === null, "steht schon ein Termin (±30 Min.) → nichts");
  ok(TN("telefoniert am Montag 11 Uhr mit Justin", fr, [{ id: 1, beginn: "2026-10-19T09:15:00Z", agentId: 928, status: "abgesagt" }])?.wandzeit === "2026-10-19 11:00", "abgesagter Termin zählt nicht");

  console.log("── A10 · Maras WhatsApp-Antwort schließt nur „Kunde wartet auf Antwort“");
  const { maraWaAntwortSchliesst } = await import("../shared/fiaon-auftrag-arten");
  const W = (klasse: string, text: string, art = klasse === "pruefung" ? "mara_wa_pruefung" : "mara_wa_anliegen", titel = "WhatsApp") =>
    maraWaAntwortSchliesst({ art, schluessel: klasse ? `wa-123-${klasse}-2026-10-14` : "wa-123-2026-10-14", quelle: "mara_whatsapp", titel, text });
  ok(W("pruefung", "Mara konnte nicht sicher antworten (Regel). Letzte Nachricht: „Wann kommt meine Karte?“"), "„Mara war unsicher“ → schließt");
  ok(W("ki", "Die KI war aus — bitte selbst antworten."), "KI-Ausfall → schließt");
  ok(W("versand", "Maras Antwort ging dreimal nicht raus (Netz). Bitte selbst antworten."), "Versand gescheitert → schließt");
  ok(!W("anliegen", "Kunde fragt verärgert nach der Karte; Justin soll den Kartenlink schicken."), "„Anliegen“ → bleibt (Inhalt braucht einen Menschen)");
  ok(!W("rueckruf", "Kunde bittet um Rückruf", "mara_wa_rueckruf"), "Rückrufwunsch → bleibt");
  ok(!W("heikel", "Kunde kündigt", "mara_wa_heikel"), "heikel → bleibt");
  ok(!W("pruefung", "Mara war unsicher. Letzte Nachricht: „Ich widerrufe den Vertrag“"), "unsicher bei einem Widerruf → bleibt");
  ok(!W("pruefung", "Mara war unsicher. Letzte Nachricht: „Bitte Geld zurück“"), "unsicher bei einer Erstattung → bleibt");
  ok(!W("", "Alter Tages-Schlüssel ohne Klasse"), "alter Schlüssel ohne Klasse → bleibt");
}

async function teilB() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const AU = await import("../server/lib/fiaon-auftraege");
  const AL = await import("../server/lib/fiaon-system-alarme");
  const HP = await import("../server/lib/fiaon-hausputz");
  const ME = await import("../server/lib/fiaon-mara-entscheidungen");
  const BT = await import("../server/routes/fiaon-betreiber-todo");
  await BT.ensureTodoTabelle();
  await AU.ensureAuftragSpalten();
  const { ensureVermerkTabelle } = await import("../server/routes/fiaon-vermerke");
  await ensureVermerkTabelle();
  await AU.ensureVermerkErledigtSpalten();
  const NR = Date.now() % 100000;

  const person = async (nn: string, opt: { test?: boolean; archiviert?: boolean; gekuendigt?: boolean } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am)
                           VALUES (${`PR-E397-${nn}-${NR}`}, 'Test', ${nn}, ${`${nn.toLowerCase()}-${NR}@test.invalid`}, 8, ${opt.test ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    const ref = `FIAON-E397-${nn.toUpperCase()}-${NR}`;
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, first_name, last_name, email, payment_reference, archived_at, gekuendigt_am)
              VALUES (${ref}, ${pid}, 'private', 'high_end', 'FIAON High-End', 'pending', NOW() - INTERVAL '20 days', 'Test', ${nn}, ${`${nn.toLowerCase()}-${NR}@test.invalid`}, ${`E397-${nn}-${NR}`},
                      ${opt.archiviert ? new Date() : null}, ${opt.gekuendigt ? new Date() : null})`;
    return { pid, ref };
  };
  const auftrag = async (o: { pid?: number | null; ref?: string | null; titel: string; text?: string; schluessel?: string; quelle?: string; agent?: number | null; vorTagen?: number }) => {
    const [r] = (await sql`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, quelle, status, person_id, ref, zustaendig_art, zustaendig_agent_id, zustaendig_name,
                                         eingang_am, neu_seit, created_at)
      VALUES (${o.schluessel ?? null}, ${o.titel}, ${o.text ?? null}, 'postmeister', 2, ${o.quelle ?? "postmeister"}, 'offen', ${o.pid ?? null}, ${o.ref ?? null},
              ${o.agent ? "agent" : "betreiber"}, ${o.agent ?? null}, ${o.agent ? "Daniel Stripling" : null},
              NOW() - make_interval(days => ${o.vorTagen ?? 2}), NOW() - make_interval(days => ${o.vorTagen ?? 2}), NOW() - make_interval(days => ${o.vorTagen ?? 2}))
      RETURNING id`) as any[];
    await AU.auftraegeZuordnen({ ids: [Number(r.id)], neu: true });
    return Number(r.id);
  };
  const status = async (id: number) => ((await sql`SELECT status, erledigt_art, erledigt_ereignis FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[])[0];

  console.log("── B1 · Kündigung gebucht: nur reine Kündigungs-Fälle, auch auf Justins Board, egal wer bucht");
  const k = await person("Kuend");
  const aRein = await auftrag({ pid: k.pid, titel: "Kündigung", text: "Kunde möchte kündigen.", schluessel: `postmeister:kuendigung:${NR}`, agent: 8 });
  const aWid = await auftrag({ pid: k.pid, titel: "Kündigung oder Widerruf", text: "Kunde widerruft den Vertrag.", schluessel: `postmeister:kuendigung2:${NR}`, agent: 8 });
  const aBoard = await auftrag({ pid: k.pid, titel: "Kündigung", text: "Kündigung per Formular.", schluessel: `kuendigung:${NR}`, quelle: "kuendigung", agent: null });
  const aBesch = await auftrag({ pid: k.pid, titel: "Beschwerde", text: "Ich beschwere mich und kündige.", schluessel: `postmeister:${k.pid}:beschwerde-${NR}`, agent: 8 });
  const n1 = await AU.kuendigungGebuchtMelden(k.ref, { weg: "letzte_rate", personId: k.pid, wer: "Florentine Lombardi", agentId: 10 });
  ok((await status(aRein)).status === "erledigt" && (await status(aRein)).erledigt_art === "auto", "reine Kündigung → erledigt (auch wenn eine Kollegin bucht)", await status(aRein));
  ok((await status(aBoard)).status === "erledigt", "Kündigung auf Justins Board → erledigt", await status(aBoard));
  ok((await status(aWid)).status !== "erledigt", "Widerruf → bleibt offen");
  ok((await status(aBesch)).status !== "erledigt", "Beschwerde → bleibt offen");
  ok(n1 === 2, "genau 2 geschlossen", n1);
  ok(/Kündigung gebucht/.test(String((await status(aRein)).erledigt_ereignis)), "Grund steht da: „Kündigung gebucht …“", (await status(aRein)).erledigt_ereignis);

  console.log("── B2 · Neue E-Mail-Adresse: „Mail unzustellbar“ (über die Bestellung) geht zu");
  const m = await person("Mailneu");
  const aUnz = await auftrag({ pid: null, ref: m.ref, titel: "Rate: E-Mail unzustellbar", text: "Adresse klären", schluessel: `abo:${m.ref}:unzustellbar`, quelle: "abo", agent: 8 });
  await AU.ereignisMelden({ ereignis: "mail_gespeichert", ref: m.ref, akteur: { id: 8, name: "Daniel Stripling" }, detail: "neu@test.invalid" });
  ok((await status(aUnz)).status === "erledigt", "unzustellbar_rate → erledigt", await status(aUnz));

  console.log("── B3 · Archiviert: erst wenn ALLE Bestellungen archiviert sind; Heikles bleibt");
  const ar = await person("Archiv");
  const aRueck = await auftrag({ pid: ar.pid, titel: "Rückruf — bitte anrufen", text: "Kunde bittet um Rückruf", schluessel: `postmeister:${ar.pid}:aufgabe-${NR}`, agent: 8 });
  const aWid2 = await auftrag({ pid: ar.pid, titel: "Rückruf — Widerruf", text: "Kunde will widerrufen", schluessel: `postmeister:${ar.pid}:aufgabe2-${NR}`, agent: 8 });
  await AU.ereignisMelden({ ereignis: "kunde_archiviert", personId: ar.pid, akteur: { id: null, name: "Verwaltung" } });
  ok((await status(aRueck)).status !== "erledigt", "Bestellung noch aktiv → nichts zu");
  await sql`UPDATE fiaon_applications SET archived_at = NOW() WHERE person_id = ${ar.pid}`;
  await AU.ereignisMelden({ ereignis: "kunde_archiviert", personId: ar.pid, akteur: { id: null, name: "Verwaltung" } });
  ok((await status(aRueck)).status === "erledigt", "alle archiviert → Rückruf zu", await status(aRueck));
  ok((await status(aWid2)).status !== "erledigt", "Widerruf bleibt");

  console.log("── B4 · Testkonto: alles zu, außer Erstattung");
  const te = await person("Testkonto");
  const aT1 = await auftrag({ pid: te.pid, titel: "Beschwerde", text: "Anwalt", schluessel: `postmeister:${te.pid}:b-${NR}`, agent: 8 });
  const aT2 = await auftrag({ pid: te.pid, titel: "Erstattung", text: "Bitte Geld zurück", schluessel: `postmeister:${te.pid}:e-${NR}`, agent: 8 });
  const { alsTestMarkieren } = await import("../server/lib/fiaon-testerkennung");
  const markiert = await alsTestMarkieren(te.pid, "Prüfstand E-397", "Prüfstand");
  ok(markiert, "als Test markiert");
  ok((await status(aT1)).status === "erledigt", "Beschwerde beim Testkonto → zu");
  ok((await status(aT2)).status !== "erledigt", "Erstattung beim Testkonto → bleibt");

  console.log("── B5 · Gespräch „erreicht“ schließt den Rückruf-Wunsch (beim Zuständigen, nicht beim Kollegen)");
  const rr = await person("Rueckruf");
  const [r1] = (await sql`INSERT INTO fiaon_rueckrufe (person_id, ref, quelle, quelle_id, anliegen, zustaendig_agent_id, frist_bis, created_at)
                          VALUES (${rr.pid}, ${rr.ref}, 'pruef', ${`e397-a-${NR}`}, 'Bitte um Rückruf wegen Termin', 8, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day') RETURNING id`) as any[];
  const [r2] = (await sql`INSERT INTO fiaon_rueckrufe (person_id, ref, quelle, quelle_id, anliegen, zustaendig_agent_id, frist_bis, created_at)
                          VALUES (${rr.pid}, ${rr.ref}, 'pruef', ${`e397-b-${NR}`}, 'Bitte um Rückruf (Kollegin)', 10, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 day') RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_vermerke (art, ref, text, sicht, zustaendig_agent_id, status, autor_art, autor_name)
            VALUES ('aufgabe', ${rr.ref}, 'RÜCKRUF binnen 24 h: Bitte um Rückruf wegen Termin', 'privat', 8, 'offen', 'system', 'System')`;
  await AU.ereignisMelden({ ereignis: "ergebnis_erreicht", personId: rr.pid, ref: rr.ref, akteur: { id: 8, name: "Daniel Stripling" }, detail: "Erreicht — Sonstiges" });
  const rs = (await sql`SELECT id, status, ergebnis_notiz FROM fiaon_rueckrufe WHERE id = ANY(${[r1.id, r2.id]}::int[]) ORDER BY id`) as any[];
  ok(rs[0].status === "erledigt" && /Gesprächsergebnis/.test(String(rs[0].ergebnis_notiz)), "eigener Rückruf → erledigt mit Grund", rs[0]);
  ok(rs[1].status === "offen", "Rückruf der Kollegin → bleibt");
  const [vr] = (await sql`SELECT status, erledigt_art, erledigt_grund FROM fiaon_vermerke WHERE ref = ${rr.ref} AND text LIKE 'RÜCKRUF binnen%'`) as any[];
  ok(vr?.status === "erledigt" && vr?.erledigt_art === "auto", "„RÜCKRUF binnen 24 h“ → erledigt (Grund)", vr);

  console.log("── B6 · Unterlage geprüft: „Unterlagen eingegangen“ geht erst zu, wenn nichts Ungeprüftes mehr da ist");
  const un = await person("Unterlage");
  await sql`INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, status, autor_art, autor_name)
            VALUES ('aufgabe', ${un.ref}, 'Unterlagen eingegangen (Ausweis, Kontoauszug) — bitte prüfen', 'betreiber', TRUE, 'offen', 'system', 'System')`;
  await sql`INSERT INTO fiaon_dokumente (person_id, ref, art, kategorie, quelle, dateiname, mime, bytes, inhalt, doc_hash, hochgeladen_am)
            VALUES (${un.pid}, ${un.ref}, 'unterlage', 'ausweis', 'kunde', 'a.pdf', 'application/pdf', 3, ${Buffer.from("abc")}, ${`e397-a-${NR}`}, NOW()),
                   (${un.pid}, ${un.ref}, 'unterlage', 'kontoauszug', 'kunde', 'k.pdf', 'application/pdf', 3, ${Buffer.from("def")}, ${`e397-k-${NR}`}, NOW())`;
  await sql`UPDATE fiaon_dokumente SET geprueft_am = NOW() WHERE person_id = ${un.pid} AND kategorie = 'ausweis'`;
  await AU.ereignisMelden({ ereignis: "unterlage_geprueft", personId: un.pid, akteur: { id: null, name: "Verwaltung" }, detail: "Ausweis" });
  let [uv] = (await sql`SELECT status FROM fiaon_vermerke WHERE ref = ${un.ref} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok(uv?.status === "offen", "Kontoauszug noch ungeprüft → bleibt offen");
  await sql`UPDATE fiaon_dokumente SET geprueft_am = NOW() WHERE person_id = ${un.pid}`;
  await AU.ereignisMelden({ ereignis: "unterlage_geprueft", personId: un.pid, akteur: { id: null, name: "Verwaltung" }, detail: "Kontoauszug" });
  [uv] = (await sql`SELECT status, erledigt_grund FROM fiaon_vermerke WHERE ref = ${un.ref} AND text LIKE 'Unterlagen eingegangen%'`) as any[];
  ok(uv?.status === "erledigt" && /Unterlage geprüft/.test(String(uv?.erledigt_grund)), "alles geprüft → erledigt mit Grund", uv);

  console.log("── B7 · Alarm-Tafel: eine Zeile, zählt, geht aus, alte Aufträge schließen mit");
  const sch = `pruef-e397:${NR}`;
  const al1 = await AL.alarmMelden(sch, { quelle: "lead-motor", titel: "Prüf-Alarm", text: "eins", stufe: "rot" });
  const al2 = await AL.alarmMelden(sch, { quelle: "lead-motor", titel: "Prüf-Alarm", text: "zwei", stufe: "rot" });
  let [az] = (await sql`SELECT anzahl, episoden, vorbei_am FROM fiaon_system_alarme WHERE schluessel = ${sch}`) as any[];
  ok(al1.neu && !al2.neu && Number(az.anzahl) === 2 && !az.vorbei_am, "zweimal gemeldet → eine Zeile, anzahl 2", az);
  const alt1 = await auftrag({ titel: "Lead-Motor: alt", schluessel: `lead-motor:pruef${NR}:2026-10-12`, quelle: "lead-motor", agent: null });
  const fremdAlt = await auftrag({ titel: "Make-Zweig", schluessel: `lead-motor-fremd-${NR}`, quelle: "system", agent: null });
  await AL.alarmVorbei(sch, "Leads kommen wieder", sql, { auftraege: { quelle: "lead-motor", schluesselWie: `lead-motor:pruef${NR}:%` } });
  [az] = (await sql`SELECT anzahl, episoden, vorbei_am, vorbei_grund FROM fiaon_system_alarme WHERE schluessel = ${sch}`) as any[];
  ok(!!az.vorbei_am && az.vorbei_grund === "Leads kommen wieder", "Alarm vorbei", az);
  ok((await status(alt1)).status === "erledigt" && /Alarm vorbei/.test(String((await status(alt1)).erledigt_ereignis)), "alter Alarm-Auftrag → erledigt (Alarm vorbei)", await status(alt1));
  ok((await status(fremdAlt)).status !== "erledigt", "andere Quelle bleibt");
  await AL.alarmMelden(sch, { quelle: "lead-motor", titel: "Prüf-Alarm", text: "drei", stufe: "rot" });
  [az] = (await sql`SELECT anzahl, episoden, vorbei_am FROM fiaon_system_alarme WHERE schluessel = ${sch}`) as any[];
  ok(Number(az.anzahl) === 1 && Number(az.episoden) === 2 && !az.vorbei_am, "neue Episode: anzahl 1, episoden 2", az);
  await sql`UPDATE fiaon_system_alarme SET endet_nach_stunden = 1, zuletzt_am = NOW() - INTERVAL '2 hours' WHERE schluessel = ${sch}`;
  const tafel = await AL.alarmTafel(24);
  ok(tafel.some((x) => x.schluessel === sch && !!x.vorbeiAm), "endet_nach_stunden: geht ohne neue Meldung von selbst aus");

  console.log("── B8 · Sammelkarte: je Karte ihre eigene Empfehlung; fremde Karte wird abgewiesen");
  await ME.entscheidungTabellen();
  const karte = async (n: number, empf = "lassen", art = "mahnstopp") => (await ME.entscheidungAnlegen({
    schluessel: `pruef-e397-${art}-${NR}-${n}`, art, personId: null, ref: null, titel: `Prüf ${n}`, text: "x", empfehlung: empf,
    optionen: [{ key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" }, { key: "anders", label: "Anders", werkzeug: "nichts", ton: "neutral" }],
  } as any))!.id;
  const c1 = await karte(1), c2 = await karte(2), c3 = await karte(3, "anders");
  const stand = await ME.entscheidungenLesen();
  const g = stand.gruppen.find((x) => x.schluessel === "mahnstopp|lassen");
  ok(!!g && g.ids.includes(c1) && g.ids.includes(c2) && !g.ids.includes(c3), "Gruppe „mahnstopp|lassen“ mit 2 Karten (die andere Empfehlung nicht)", g);
  ok(stand.last.karten >= 3 && stand.last.entscheidungen <= stand.last.karten - 1 && stand.last.minuten >= 1, "Kartenlast: Sammelkarte zählt als eine, Minuten geschätzt", stand.last);
  const fremd = await ME.entscheidenSammel([c1, c3], "mahnstopp|lassen", { von: "Prüfstand" });
  ok(!fremd.ok && fremd.status === 409, "Karte mit anderer Empfehlung in der Auswahl → abgewiesen");
  const sam = await ME.entscheidenSammel([c1, c2], "mahnstopp|lassen", { von: "Prüfstand" });
  ok(sam.ok && sam.erledigt === 2, "Sammelkarte: 2 entschieden", sam);
  const nachher = (await sql`SELECT status, gewaehlt FROM fiaon_mara_entscheidungen WHERE id = ANY(${[c1, c2, c3]}::bigint[]) ORDER BY id`) as any[];
  ok(nachher[0].status === "entschieden" && nachher[0].gewaehlt === "lassen" && nachher[2].status === "offen", "die beiden entschieden (lassen), die dritte offen", nachher);
  ok(!(await ME.entscheidenSammel([c3], "wa_vorlagen|x", { von: "Prüfstand" })).ok, "Art ohne Sammelkarte → abgewiesen");

  console.log("── B9 · Häkchen-Weg: Mitarbeiter erledigt seinen Auftrag; Pflichtsatz bleibt Pflicht");
  const hk = await person("Haken");
  const h1 = await auftrag({ pid: hk.pid, titel: "Rückruf — bitte anrufen", text: "Rückruf", schluessel: `postmeister:${hk.pid}:aufgabe-h-${NR}`, agent: 8 });
  const h2 = await auftrag({ pid: hk.pid, titel: "Kündigung", text: "Kunde kündigt.", schluessel: `postmeister:kuendigung-h:${NR}`, agent: 8 });
  const z1 = await BT.auftragDurchMitarbeiterErledigen((await sql`SELECT * FROM fiaon_betreiber_todos WHERE id = ${h1}`)[0], { id: 8, name: "Daniel Stripling" }, "Im Gespräch erledigt (Erreicht — Sonstiges)");
  ok(z1.ok && (await status(h1)).status === "erledigt" && (await status(h1)).erledigt_art === "hand", "Rückruf → erledigt (hand)");
  const z2 = await BT.auftragDurchMitarbeiterErledigen((await sql`SELECT * FROM fiaon_betreiber_todos WHERE id = ${h2}`)[0], { id: 8, name: "Daniel Stripling" }, "");
  ok(!z2.ok && z2.code === "ERGEBNIS_PFLICHT" && (await status(h2)).status !== "erledigt", "Kündigung ohne Notiz → bleibt (Pflichtsatz)");

  console.log("── B10 · Hausputz: Probelauf ändert nichts; Lauf nur mit Freigabe; Zurückholen");
  const hp = await person("Hausputz");
  const hTerm = await auftrag({ titel: "Termin verpasst: Prüf", schluessel: `termintreue-termin-e397-${NR}`, quelle: "termintreue", agent: null, vorTagen: 20 });
  const hD1 = await auftrag({ pid: hp.pid, titel: "Hinweis von Mara", text: "alt", schluessel: `postmeister:${hp.pid}:2026-10-01-${NR}`, agent: 8, vorTagen: 18 });
  const hD2 = await auftrag({ pid: hp.pid, titel: "Hinweis von Mara", text: "neu", schluessel: `postmeister:${hp.pid}:2026-10-10-${NR}`, agent: 8, vorTagen: 9 });
  const hErst = await auftrag({ pid: hp.pid, titel: "Kunde will Geld zurück", text: "Erstattung bitte", schluessel: `postmeister:${hp.pid}:erst-${NR}`, quelle: "termintreue", agent: null, vorTagen: 20 });
  await sql`INSERT INTO fiaon_vermerke (art, ref, text, sicht, zustaendig_agent_id, status, autor_art, autor_name, created_at)
            VALUES ('aufgabe', ${hp.ref}, 'Termin übernommen von Prüf: 01.10.2026', 'agenten', 12, 'offen', 'system', 'System', NOW() - INTERVAL '2 days')`;
  const vorStatus = await status(hTerm);
  const probe = await HP.hausputzProbelauf();
  ok((await status(hTerm)).status === vorStatus.status && vorStatus.status !== "erledigt", "Probelauf ändert nichts", await status(hTerm));
  ok(probe.jeRegel.some((r) => r.regel === "termintreue" && r.auftraege >= 1), "Probelauf zählt „termintreue“", probe.jeRegel);
  ok((await HP.hausputzAusfuehren(null)).ok === false, "ohne Freigabe: kein Lauf");
  const freigabe = `pruef-e397-${NR}`;
  const lauf = await HP.hausputzAusfuehren(freigabe);
  ok(lauf.ok && lauf.laufId, "Lauf mit Freigabe", lauf.grund);
  const st = await status(hTerm);
  ok(st.status === "erledigt" && st.erledigt_art === "hausputz" && /Hausputz: Termintreue/.test(String(st.erledigt_ereignis)), "Termintreue-Meldung → beim Hausputz erledigt, mit Grund", st);
  ok((await status(hErst)).status !== "erledigt", "Erstattung (selbst als Termintreue-Quelle) → bleibt offen");
  const d1 = await status(hD1), d2 = await status(hD2);
  ok(d1.status === "erledigt" && /zusammengeführt in Auftrag #/.test(String(d1.erledigt_ereignis)) && d2.status !== "erledigt", "Doppel → in den neuesten zusammengeführt", { d1, d2 });
  const [beitragZiel] = (await sql`SELECT text FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${hD2} AND text LIKE 'Zusammengeführt aus Auftrag #%' ORDER BY id DESC LIMIT 1`) as any[];
  ok(/alt/.test(String(beitragZiel?.text ?? "")), "der Text des Doppels steht im Verlauf des neuesten", beitragZiel);
  const [umgehaengt] = (await sql`SELECT zustaendig_agent_id FROM fiaon_vermerke WHERE ref = ${hp.ref} AND text LIKE 'Termin übernommen%'`) as any[];
  ok(Number(umgehaengt?.zustaendig_agent_id) === 8, "Vermerk beim gesperrten Lucas → an den Betreuer (Daniel) umgehängt", umgehaengt);
  const [logZ] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_hausputz_log WHERE lauf_id = ${lauf.laufId}`) as any[];
  ok(Number(logZ.n) >= 3, "jede Änderung steht im Protokoll", logZ);
  ok((await HP.hausputzAusfuehren(freigabe)).ok === false, "dieselbe Freigabe läuft nur einmal");
  const zur = await HP.hausputzZurueckholen({ laufId: Number(lauf.laufId), regel: "termintreue" }, "Justin Schwarzott");
  const zurSt = (await sql`SELECT status, wieder_offen_grund FROM fiaon_betreiber_todos WHERE id = ${hTerm}`) as any[];
  ok(zur.zurueck >= 1 && zurSt[0].status !== "erledigt" && /von Justin Schwarzott wieder geöffnet/.test(String(zurSt[0].wieder_offen_grund)), "Zurückholen: wieder offen, „von … wieder geöffnet“ (Pendelschutz)", zurSt[0]);
  const zurV = await HP.hausputzZurueckholen({ laufId: Number(lauf.laufId), regel: "gesperrt" }, "Justin Schwarzott");
  const [vz] = (await sql`SELECT zustaendig_agent_id FROM fiaon_vermerke WHERE ref = ${hp.ref} AND text LIKE 'Termin übernommen%'`) as any[];
  ok(zurV.zurueck >= 1 && Number(vz?.zustaendig_agent_id) === 12, "Umhängen zurückgeholt → wieder bei Lucas", vz);
  const stand2 = await HP.hausputzStand();
  ok(!!stand2.probelauf && !!stand2.lauf && !!stand2.lauf.zurueckBis, "Stand fürs Lagezimmer: Probelauf, Lauf, zurückholbar bis");

  console.log("── B11 · „Daraus einen Termin machen?“ — Vorschlag, Klick, Termin bei Justin; nichts ohne Notiz");
  const TA = await import("../server/lib/fiaon-termin-aus-notiz");
  const tn = await person("TerminNotiz");
  const notizJ = "Kunde will Firmenkredit besprechen, telefoniert übermorgen um 11 Uhr mit Justin";
  const vj = await TA.terminVorschlagFuerNotiz({ personId: tn.pid, notiz: notizJ, schreiberId: 8 });
  ok(!!vj && vj.teilnehmerId === 928 && vj.genannt && /um 11:00 Uhr/.test(vj.wannText), "Vorschlag: übermorgen 11:00 bei Justin", vj);
  const falsch = await TA.terminAusNotizEintragen({ personId: tn.pid, notiz: notizJ, wandzeit: vj!.wandzeit, teilnehmerId: 8, agent: { id: 8, name: "Daniel Stripling" } });
  ok(!falsch.ok, "anderer Teilnehmer als die Notiz nennt → abgewiesen", falsch);
  const leer = await TA.terminAusNotizEintragen({ personId: tn.pid, notiz: "Kunde war freundlich", wandzeit: vj!.wandzeit, teilnehmerId: 928, agent: { id: 8, name: "Daniel Stripling" } });
  ok(!leer.ok, "Notiz ohne Tag/Uhrzeit → abgewiesen", leer);
  const ein = await TA.terminAusNotizEintragen({ personId: tn.pid, notiz: notizJ, wandzeit: vj!.wandzeit, teilnehmerId: 928, agent: { id: 8, name: "Daniel Stripling" } });
  ok(ein.ok, "Klick → eingetragen", ein);
  const [tt] = (await sql`SELECT agent_id, herkunft, quelle, status, notiz FROM fiaon_termine WHERE person_id = ${tn.pid} ORDER BY id DESC LIMIT 1`) as any[];
  ok(Number(tt?.agent_id) === 928 && tt?.herkunft === "agent_notiz" && tt?.status === "gebucht" && /Gesprächsnotiz von Daniel Stripling/.test(String(tt?.notiz)), "Termin bei Justin, Herkunft „agent_notiz“, Notiz dabei", tt);
  const [pz] = (await sql`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${tn.pid}`) as any[];
  ok(Number(pz?.assigned_agent_id) === 8, "Kunde bleibt bei Daniel (Termin im Kalender eines Kollegen hängt nicht um)", pz);
  ok((await TA.terminVorschlagFuerNotiz({ personId: tn.pid, notiz: notizJ, schreiberId: 8 })) === null, "danach kein zweiter Vorschlag (steht schon)");
  const vs = await TA.terminVorschlagFuerNotiz({ personId: tn.pid, notiz: "Rückruf übermorgen 15 Uhr, sucht die Unterlagen", schreiberId: 8 });
  ok(!!vs && vs.teilnehmerId === 8 && !vs.genannt, "ohne Namen → beim Schreiber", vs);

  console.log("── B12 · Maras WhatsApp-Antwort: „unsicher“/KI zu, „Anliegen“ bleibt; neue Kundennachricht oder Rückfallsatz → nichts");
  const wa = await person("WaAntwort");
  const nummer = `49176${String(NR).padStart(5, "0")}11`;
  const waAuftrag = async (schluessel: string, titel: string, text: string, pid: number | null = wa.pid) => {
    const id = await auftrag({ pid, titel, text, schluessel, quelle: "mara_whatsapp", agent: 8, vorTagen: 2 });
    await sql`UPDATE fiaon_betreiber_todos SET updated_at = NOW() - INTERVAL '2 days' WHERE id = ${id}`;
    return id;
  };
  const wP = await waAuftrag(`wa-${wa.pid}-pruefung-2026-10-14`, "WhatsApp: Mara war unsicher", "Mara konnte nicht sicher antworten (Regel). Letzte Nachricht: „Wann kommt die Karte?“");
  const wK = await waAuftrag(`wa-n${nummer}-ki-2026-10-14`, "WhatsApp: KI aus", "Die KI war aus — bitte selbst antworten.", null);
  const wA = await waAuftrag(`wa-${wa.pid}-anliegen-2026-10-14`, "WhatsApp: Anliegen", "Kunde fragt verärgert nach der Karte; Justin soll den Kartenlink schicken.");
  const wF = await waAuftrag(`wa-${wa.pid}-pruefung-2026-10-15`, "WhatsApp: Mara war unsicher", "Frage offen");
  await sql`UPDATE fiaon_betreiber_todos SET frage_offen = TRUE WHERE id = ${wF}`;
  const [m1] = (await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, text, status, created_at) VALUES ('rein', ${nummer}, ${wa.pid}, 'Und, wann kommt sie?', 'empfangen', NOW() - INTERVAL '1 hour') RETURNING id`) as any[];
  const [m2] = (await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, text, status, created_at) VALUES ('rein', ${nummer}, ${wa.pid}, 'Hallo?', 'empfangen', NOW() - INTERVAL '30 minutes') RETURNING id`) as any[];
  ok((await AU.maraWaGeantwortet({ nummer, personId: wa.pid, aufId: Number(m1.id), antwortText: "Ihre Karte ist unterwegs." })).length === 0, "Antwort auf eine ältere Nachricht (neue Kundennachricht da) → nichts");
  ok((await AU.maraWaGeantwortet({ nummer, personId: wa.pid, aufId: Number(m2.id), antwortText: "Einen Moment bitte", rueckfall: true })).length === 0, "Rückfallsatz → nichts");
  const zuW = await AU.maraWaGeantwortet({ nummer, personId: wa.pid, aufId: Number(m2.id), antwortText: "Ihre Karte ist unterwegs — der Link kam heute per E-Mail." });
  const sp = await status(wP), sk = await status(wK);
  ok(sp.status === "erledigt" && sp.erledigt_art === "auto" && /Mara hat per WhatsApp geantwortet/.test(String(sp.erledigt_ereignis)), "„Mara war unsicher“ → erledigt (auto, Grund)", sp);
  ok(sk.status === "erledigt", "KI-Ausfall (Nummern-Schlüssel) → erledigt", sk);
  ok((await status(wA)).status !== "erledigt", "„Anliegen“ → bleibt offen");
  ok((await status(wF)).status !== "erledigt", "offene Frage → bleibt offen");
  ok(zuW.length === 2, "genau 2 geschlossen", zuW);
  const wR = await waAuftrag(`wa-${wa.pid}-pruefung-2026-10-19`, "WhatsApp: Mara war unsicher", "Wieder unsicher");
  await sql`UPDATE fiaon_betreiber_todos SET updated_at = NOW() WHERE id = ${wR}`;
  ok((await AU.maraWaGeantwortet({ nummer, personId: wa.pid, aufId: Number(m2.id), antwortText: "Antwort" })).length === 0 && (await status(wR)).status !== "erledigt", "nach der Kundennachricht neu übergeben → bleibt offen");

  await sql.end({ timeout: 2 }).catch(() => {});
}

(async () => {
  await teilA();
  if (MIT_DB) await teilB(); else console.log("(Teil B übersprungen — keine lokale DATABASE_URL)");
  console.log(`\n${gut} Prüfungen bestanden, ${schlecht} nicht bestanden.`);
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
