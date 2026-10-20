// Prüfstand E-406 B3 (19.10.2026), ohne Datenbank: „Mara heute“, Mails auf Gelb/Rot und Maras Aufräum-Vorschläge —
// die reinen Regeln (shared/fiaon-mara-ampel.ts), die reinen Kartenbauer und der Einbau in die Wege (Quelltext).
// E-409 × E-406 (20.10.2026): Die Ampel ist EINE (shared/fiaon-ki-team.ts, echte Werkzeugnamen) — Abschnitt 1 prüft,
// dass B3 sie benutzt; die Wochen-Stichprobe für die Trainerin gibt es nicht mehr. Alle Personen sind erfunden.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin DATABASE_URL=postgresql://nobody@127.0.0.1:1/none \
//     node_modules/.bin/tsx scripts/pruef-e406-b3-mara-heute.ts
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
let netz = 0;
globalThis.fetch = (async () => { netz++; return new Response("kein Netz im Prüfstand", { status: 599 }); }) as any;

import { readFileSync } from "node:fs";
import {
  mailDarfAuto, mailAmpelGrund, istAmpelGelbEntwurf, istAmpelRotEntwurf, rueckgaengigOffen, editZeileLesen,
  mailAmpelGelbKarteGrund, istAmpelGelbKarte, gelbKarteGrund, gelbEntwurfSatz, mailAmpelWerkzeugRotGrund,
  HANDLUNG_ARTEN, ERLEDIGT_ARTEN, heuteZeilen, heuteErledigt,
  MELDUNG_AB_TAGE, MELDUNG_BIS_TAGE, AUFRAEUM_ART_ZAHLUNG, meldungImFenster, meldungSuchTage, tageSeit,
} from "../shared/fiaon-mara-ampel";
import * as AMPELMOD from "../shared/fiaon-mara-ampel";
import { MARA_AMPEL, ampelStufeAus, ampelStandLesen, ampelStandSetzen, ampelSetzenPruefen } from "../shared/fiaon-ki-team";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. EINE Ampel (E-409 × E-406): B3 benutzt die Liste aus shared/fiaon-ki-team.ts — keine zweite");
  const w = (k: string) => MARA_AMPEL.find((x) => x.key === k);
  ok(!("MARA_AMPEL" in AMPELMOD) && !("ampelLesen" in AMPELMOD) && !("stichprobeZiehen" in AMPELMOD) && !("AMPEL_SCHALTER" in AMPELMOD),
    "shared/fiaon-mara-ampel.ts hat keine eigene Ampel und keine Stichprobe mehr");
  for (const k of ["antwort_senden", "rueckruf_eintragen", "vereinbarten_termin_eintragen", "angaben_aendern", "ratenpause_setzen"]) {
    ok(!!w(k) && w(k)!.stufen.includes("gelb"), `B3-Weg „${k}“ steht in der EINEN Liste und kennt Gelb`);
  }
  ok(MARA_AMPEL.every((x) => x.stufen.includes(x.vorgabe)), "jede Vorgabe ist eine erlaubte Stufe");
  ok(w("antwort_senden")!.vorgabe === "gruen" && w("rueckruf_eintragen")!.vorgabe === "gruen" && w("vereinbarten_termin_eintragen")!.vorgabe === "gruen", "Startwerte = heutiges Verhalten (grün)");
  ok(w("geld_buchen")!.fest && w("erstattung")!.fest && w("raten_storno")!.fest && w("geld_buchen")!.vorgabe === "rot", "Geld, Erstattung, Storno fest rot");
  ok(!w("karte_link_schicken")!.stufen.includes("rot") && !w("karte_senden")!.stufen.includes("rot"), "Kartenlink: kein Rot (Vertragsleistung)");
  const roh = JSON.stringify({ stufen: { rueckruf_eintragen: "gelb", antwort_senden: "rot", karte_senden: "rot", geld_buchen: "gruen", erfunden: "rot" } });
  const st = ampelStandLesen(roh);
  ok(ampelStufeAus(MARA_AMPEL, st, "rueckruf_eintragen") === "gelb" && ampelStufeAus(MARA_AMPEL, st, "antwort_senden") === "rot", "erlaubte Stufen gelten");
  ok(ampelStufeAus(MARA_AMPEL, st, "karte_senden") === "gruen" && ampelStufeAus(MARA_AMPEL, st, "geld_buchen") === "rot", "nicht erlaubte Stufe gilt nicht; fest bleibt fest");
  ok(st.stufen.erfunden === "rot", "unbekannte Schlüssel bleiben im Speicher (ein Klick überschreibt keine fremde Zeile)");
  const n1 = ampelStandSetzen(MARA_AMPEL, st, "vereinbarten_termin_eintragen", "gelb", "Justin", new Date("2026-10-20T08:00:00Z"));
  ok(n1.stand.stufen.antwort_senden === "rot" && n1.stand.stufen.erfunden === "rot" && n1.stand.stufen.vereinbarten_termin_eintragen === "gelb", "Setzen behält alle anderen Stufen");
  ok(!!ampelSetzenPruefen(MARA_AMPEL, "termin_eintragen", "gelb"), "der alte B3-Name „termin_eintragen“ gibt es nicht mehr");

  console.log("\n4. Mails beantworten: die Weiche vor dem Senden");
  ok(mailDarfAuto("gruen") && mailDarfAuto("gruen", { fristNeu: true }), "grün: sendet wie bisher");
  ok(!mailDarfAuto("gelb") && mailDarfAuto("gelb", { fristNeu: true }), "gelb: erst im zweiten Anlauf der 24-Stunden-Regel");
  ok(!mailDarfAuto("rot") && !mailDarfAuto("rot", { fristNeu: true }), "rot: nie von selbst");
  ok(mailAmpelGrund("gruen", "x") === null, "grün: keine Ampel-Begründung");
  const gg = mailAmpelGrund("gelb", "sauber, Automat erlaubt")!;
  ok(istAmpelGelbEntwurf(gg) && !istAmpelRotEntwurf(gg) && gg.includes("Nicht senden") && gg.includes("sauber"), "gelb: Begründung mit Kopf und altem Grund", gg);
  const gr = mailAmpelGrund("rot", "sauber")!;
  ok(istAmpelRotEntwurf(gr) && !istAmpelGelbEntwurf(gr), "rot: eigener Kopf");
  ok(!/widerruf|anwalt|beh(ö|oe)rde|rechtlich|FIAON Global/i.test(gg + gr), "die Ampel-Begründungen lösen keine Heikel-/Global-Regel der 24-Stunden-Regel aus");
  ok(!istAmpelGelbEntwurf("Übergabe an den Betreuer: Ampel gelb:") && !istAmpelGelbEntwurf(null), "nur der Anfang zählt");

  console.log("\n5. Rückgängig: 24 Stunden");
  const jetzt = new Date("2026-10-19T18:00:00Z");
  ok(rueckgaengigOffen(new Date(jetzt.getTime() - 23 * 3_600_000), jetzt), "vor 23 Stunden: noch offen");
  ok(!rueckgaengigOffen(new Date(jetzt.getTime() - 25 * 3_600_000), jetzt), "vor 25 Stunden: zu");
  ok(!rueckgaengigOffen(null, jetzt) && !rueckgaengigOffen("unsinn", jetzt), "ohne Zeitpunkt: zu");
  ok(!rueckgaengigOffen(new Date(jetzt.getTime() + 3_600_000), jetzt), "in der Zukunft: zu");
  const e1 = editZeileLesen("Straße korrigiert durch Mara (Mail): Alte Gasse 1 → Neue Straße 7");
  ok(e1?.feld === "Straße" && e1.vorher === "Alte Gasse 1" && e1.nachher === "Neue Straße 7", "Verlaufszeile Straße gelesen", e1);
  const e2 = editZeileLesen("Telefon korrigiert durch Mara (WhatsApp): — → +491701234567");
  ok(e2?.feld === "Telefon" && e2.vorher === "—" && e2.nachher === "+491701234567", "Telefon mit leerem Vorher", e2);
  ok(editZeileLesen("Vorname korrigiert durch Mara (Mail): A → B") === null, "Name ist kein Feld zum Zurücknehmen");
  ok(editZeileLesen("irgendwas") === null, "fremde Zeile: null");
  ok(editZeileLesen("Land korrigiert durch Mara (Mail): DE → AT")?.nachher === "AT", "Land gelesen");

  console.log("\n6. „Mara heute“: Zeilen und Kopfzahl");
  const zeilen = heuteZeilen({ wa_antwort: 12, mail_beantwortet: 1, termin: 3, karte_vorgelegt: 2, uebergabe: 1, angaben: 0, gibtsnicht: 5 } as any);
  ok(zeilen.length === 5 && zeilen[0].art === "wa_antwort" && zeilen[0].text === "WhatsApp-Antworten", "die meisten zuerst, Mehrzahl", zeilen.map((z) => z.art));
  ok(zeilen.find((z) => z.art === "mail_beantwortet")?.text === "Mail beantwortet", "Einzahl bei 1");
  ok(!zeilen.some((z) => z.art === "angaben" || (z.art as string) === "gibtsnicht"), "0 und Unbekanntes fallen heraus");
  ok(heuteErledigt({ wa_antwort: 12, mail_beantwortet: 1, termin: 3, karte_vorgelegt: 2, uebergabe: 1 }) === 16, "Kopfzahl ohne Karten und Übergaben");
  ok(!ERLEDIGT_ARTEN.includes("karte_vorgelegt") && !ERLEDIGT_ARTEN.includes("uebergabe"), "Karten und Übergaben sind keine Erledigung");
  ok(Object.values(HANDLUNG_ARTEN).every((a) => a.link.startsWith("/chef/")), "jede Zeile führt in einen Chefbüro-Raum");
  ok(Object.values(HANDLUNG_ARTEN).every((a) => a.werkzeug === null || !!w(a.werkzeug)), "jede Art gehört zu einem Werkzeug der EINEN Ampel (oder keinem)");
  ok(Object.values(HANDLUNG_ARTEN).every((a) => !("stichprobe" in a)), "keine Art kommt in eine Stichprobe für Mitarbeiter");

  console.log("\n10. Aufräumen: alte Zahlungsmeldungen");
  const h = new Date("2026-10-19T12:00:00Z");
  const vor = (tage: number) => new Date(h.getTime() - tage * 86_400_000);
  ok(!meldungImFenster(vor(10), h) && meldungImFenster(vor(15), h) && meldungImFenster(vor(75), h) && !meldungImFenster(vor(76), h), "Fenster 14–75 Tage");
  ok(meldungSuchTage(vor(20), h) === 27 && meldungSuchTage(vor(100), h) === 90 && meldungSuchTage(vor(5), h) === 21, "Bankbuch-Fenster: seit Meldung + 7, 21 bis 90 Tage");
  ok(tageSeit(vor(20), h) === 20, "Tage seit der Meldung");
  ok(MELDUNG_AB_TAGE === 14 && MELDUNG_BIS_TAGE === 75 && AUFRAEUM_ART_ZAHLUNG === "mara_aufraeumen_zahlung", "Grenzen und Art");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n11. Die Kartenbauer (rein, ohne Datenbank)");
  const auf = await import("../server/lib/fiaon-mara-aufraeumen");
  const ent = await import("../server/lib/fiaon-mara-entscheidungen");
  const pmE = await import("../server/lib/fiaon-postmeister-entscheidungen");
  const k = auf.meldungKarte({ ref: "FIAON-Q406-1", person_id: 4061, claimed_paid_at: vor(20), soll: 9999, pack_name: "PRO\nmehr" }, h);
  ok(k.art === AUFRAEUM_ART_ZAHLUNG && k.schluessel === `${AUFRAEUM_ART_ZAHLUNG}:FIAON-Q406-1:${Math.floor(vor(20).getTime() / 1000)}`, "Schlüssel: Bestellung + Zeitpunkt der Meldung");
  ok(k.empfehlung === "nachsehen" && k.optionen.map((o) => o.werkzeug).join(",") === "mara_zahlung_nachsehen,nichts", "Ja = im Bankbuch nachsehen, Nein = nichts");
  ok(!k.optionen.some((o) => /buchen|erstatt|kuendig|storn/i.test(o.werkzeug)), "nie Geld buchen, Erstattung, Kündigung oder Storno");
  ok(/27 Tage zurück/.test(k.text) && /20 Tagen/.test(k.text) && /99,99/.test(k.text), "Text: Tage, Fenster, Betrag", k.text);
  ok(ent.SAMMEL_ARTEN.includes(AUFRAEUM_ART_ZAHLUNG), "als E-397-Sammelkarte zugelassen");
  // Die Sammelkarte mit „Ja“ und „Nein“ für alle.
  const sicht = (id: number) => ({
    id, art: AUFRAEUM_ART_ZAHLUNG, artText: "Alte Zahlungsmeldung", gewicht: 35, personId: id, name: null, ref: null, titel: "t", text: "x",
    empfehlung: "nachsehen", optionen: [{ key: "nachsehen", label: "Ja, im Bankbuch nachsehen", ton: "gut" as const, link: null, titel: null, harmlos: false },
      { key: "lassen", label: "Nein, so lassen", ton: "neutral" as const, link: null, titel: null, harmlos: true }],
    belege: [], status: "offen" as const, spaeterBis: null, entschiedenAm: null, entschiedenVon: null, gewaehlt: null, gewaehltLabel: null, ergebnis: null, fehler: null, createdAt: h.toISOString(),
  });
  const gruppen = ent.sammelGruppen([sicht(1), sicht(2), sicht(3)]);
  ok(gruppen.length === 1 && gruppen[0].anzahl === 3 && gruppen[0].empfehlungLabel === "Ja, im Bankbuch nachsehen", "drei gleiche Fälle → eine Sammelkarte");
  ok(gruppen[0].nein?.key === "lassen" && gruppen[0].nein?.label === "Nein, so lassen", "die Sammelkarte trägt „Nein, so lassen“");
  const ohneNein = ent.sammelGruppen([sicht(1), { ...sicht(2), optionen: [sicht(2).optionen[0]] }]);
  ok(ohneNein[0]?.nein === null, "fehlt einer Karte die harmlose Option → kein „Nein“ für alle");
  const kuend = ent.sammelGruppen([{ ...sicht(1), art: "kuendigung_ungebucht", empfehlung: "buchen", optionen: [{ ...sicht(1).optionen[0], key: "buchen" }, { ...sicht(1).optionen[1], key: "keine", harmlos: false }] },
    { ...sicht(2), art: "kuendigung_ungebucht", empfehlung: "buchen", optionen: [{ ...sicht(1).optionen[0], key: "buchen" }, { ...sicht(1).optionen[1], key: "keine", harmlos: false }] }]);
  ok(kuend[0]?.nein === null, "„Ist keine Kündigung“ ist kein harmloses Nein (schließt den Antrag) — kein Sammel-Nein");
  // Die Karte „Termin eintragen?“ (Ampel rot)
  const tk = auf.terminRotKarte({ personId: 4062, ref: "FIAON-Q406-2", agentId: 8, agentName: "Daniel Muster", wandzeit: "2026-10-21 11:00",
    beginn: new Date("2026-10-21T09:00:00Z"), herkunft: "mara_mail_genannt", vereinbart: true, kanal: "mail", kundeText: "morgen um 11 Gespräch mit Herrn Muster", quelle: "Mail #1", beleg: "laut Kunde" });
  ok(tk.empfehlung === "eintragen" && tk.optionen[0].werkzeug === "mara_termin_eintragen" && tk.optionen[1].werkzeug === "nichts", "Termin-Karte: Eintragen / Nicht eintragen");
  ok(tk.schluessel.startsWith("mara_termin_rot:4062:") && /Mi\.?, 21\.10\..*11:00/.test(tk.titel), "Termin-Karte: Schlüssel und Titel mit Zeit", tk.titel);
  // Die Postfach-Karte bei Ampel rot
  ok(pmE.entwurfFall(mailAmpelGrund("rot", "sauber, Automat erlaubt")) === "ampel", "Postfach: „Ampel rot“ ist ein eigener Fall");
  ok(pmE.entwurfFall(mailAmpelWerkzeugRotGrund(["Zahlungslink"], "sauber")) === "ampel", "Postfach: ein rotes WERKZEUG macht die Antwort ebenfalls zur Ampel-Karte");
  ok(pmE.entwurfFall("Widerruf nach Zahlung") === "widerruf", "Widerruf bleibt Widerruf");
  const pk = pmE.karteAusZeile({ id: 9001, person_id: 4063, betreff: "Frage", begruendung: mailAmpelGrund("rot", "sauber"), text: "Hallo", antwort: "Antwort" });
  ok(/Ampel rot/.test(pk.titel) && pk.empfehlung === "senden", "Karte „Ampel rot — Maras Antwort senden?“, Empfehlung senden", pk.titel);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n11b. Gelb nur, wenn die 24-Stunden-Regel ihn WIRKLICH sendet (Nachbesserung, Prüfer-Fund)");
  {
    const FR = await import("../shared/fiaon-entwurf-frist");
    const j0 = new Date("2026-10-19T10:00:00Z"); // Mo. 12:00 Berlin
    const tage = (n: number) => new Date(j0.getTime() - n * 86_400_000);
    const gelbB = mailAmpelGrund("gelb", "sauber, Automat erlaubt");
    const basis = { neu: true, entwurfAm: j0, mailAm: new Date(j0.getTime() - 10 * 60_000), neuGeschriebenAm: null, begruendung: gelbB };
    ok(FR.fristLaesstLiegen(basis, null, j0) === null, "neue Zeile, frisch, frei: die Regel schreibt nach 24 h neu und sendet — Gelb darf warten");
    const a = FR.fristLaesstLiegen({ ...basis, neu: false }, null, j0);
    ok(/Altbestand/.test(a ?? ""), "(A) ohne Merker frist_ab (alter Entwurf, „Neu schreiben lassen“): die Regel ließe ihn liegen", a);
    const b = FR.fristLaesstLiegen({ ...basis, neuGeschriebenAm: new Date(j0.getTime() - 3_600_000) }, null, j0);
    ok(/schon einmal neu geschrieben/.test(b ?? ""), "(B) schon einmal von der Regel neu geschrieben: liegt", b);
    const c = FR.fristLaesstLiegen(basis, "Vertriebssperre", j0);
    ok(/Vertriebssperre/.test(c ?? "") && /Testkonto/.test(FR.fristLaesstLiegen(basis, "Testkonto", j0) ?? ""), "(C) Vertriebssperre oder Testkonto: liegt", c);
    ok(/nicht möglich/.test(FR.fristLaesstLiegen(basis, "Sperrprüfung nicht möglich", j0) ?? ""), "(C) Sperre nicht lesbar: liegt (lieber eine Karte)");
    const d = FR.fristLaesstLiegen({ ...basis, mailAm: tage(6.5) }, null, j0);
    ok(/älter als 7 Tage/.test(d ?? ""), "(D) Kundenmail 6,5 Tage alt: zur Fälligkeit (+24 h) über 7 Tage → liegt", d);
    ok(FR.fristLaesstLiegen({ ...basis, mailAm: tage(5) }, null, j0) === null, "Kundenmail 5 Tage alt: wird noch gesendet");
    const nacht = new Date("2026-10-19T19:30:00Z"); // 21:30 Berlin
    ok(FR.fristFaellig(nacht, nacht).toISOString() === "2026-10-21T06:00:00.000Z", "Fälligkeit im Versandfenster: Entwurf 21:30 → übermorgen 08:00", FR.fristFaellig(nacht, nacht).toISOString());
    const dn = FR.fristLaesstLiegen({ ...basis, entwurfAm: nacht, mailAm: new Date(nacht.getTime() - 5.6 * 86_400_000) }, null, nacht);
    ok(/älter als 7 Tage/.test(dn ?? ""), "(D) mit Versandfenster: Mail 5,6 Tage, Entwurf 21:30 → am Morgen der Fälligkeit über 7 Tage → liegt", dn);
    const w = FR.fristLaesstLiegen({ ...basis, begruendung: mailAmpelGrund("gelb", "Widerruf als Storno gebucht") }, null, j0);
    ok(/Widerruf/.test(w ?? ""), "Widerruf in der Begründung: die Regel schreibt ihn nicht neu → liegt", w);
    ok(/Global/.test(FR.fristLaesstLiegen({ ...basis, global: true }, null, j0) ?? ""), "Global-Kunde: liegt (die Regel fasst ihn nie an)");
    ok(FR.fristLaesstLiegen({ ...basis, entwurfAm: new Date(j0.getTime() - 30 * 3_600_000), mailAm: tage(1.3) }, null, j0) === null,
      "schon über 24 h, noch nicht dran (Takt, Fenster): kein „liegt“");
    // Dieselbe Regel wie der Lauf: wo fristLaesstLiegen „liegt“ sagt, sagt fristUrteil zur Fälligkeit „bleibt“/„auslassen“.
    const faellig = FR.fristFaellig(j0, j0);
    const fakten = { id: 1, neu: false, entwurfAm: j0, mailAm: basis.mailAm, neuGeschriebenAm: null, begruendung: gelbB, kategorien: [], flags: null,
      global: false, spaetereMail: null, stornoAm: null, kuendigungAm: null, gespraechAm: null, zahlungAm: null };
    ok(FR.fristUrteil(fakten, { modus: "auto", kiPausiert: false, altbestandAblegen: false, sperre: null }, faellig).art === "bleibt",
      "Gegenprobe: der Lauf selbst sagt zur Fälligkeit „bleibt“ (Altbestand) — genau der Fall, der vorher für immer lag");

    const gk = mailAmpelGelbKarteGrund("Testkonto — Mara schreibt nicht von selbst neu", "sauber");
    ok(istAmpelGelbKarte(gk) && !istAmpelGelbEntwurf(gk) && !istAmpelRotEntwurf(gk), "„Ampel gelb, als Karte“: eigener Kopf — kein gelber Entwurf (keine Ausnahme von der Karte)", gk);
    ok(!gk.startsWith("Ampel gelb:") && gelbKarteGrund(gk).startsWith("Testkonto") && gelbKarteGrund("Ampel gelb: x") === "", "der Grund lässt sich wieder lesen", gelbKarteGrund(gk));
    ok(pmE.entwurfFall(gk) === "ampel_gelb", "Postfach: „Ampel gelb, als Karte“ ist ein eigener Fall", pmE.entwurfFall(gk));
    ok(pmE.entwurfFall(mailAmpelGelbKarteGrund("Widerruf — entscheidest du (Entscheidungskarte)")) === "widerruf", "… mit Widerruf-Grund: die Widerruf-Karte (Vorsicht)");
    const gkarte = pmE.karteAusZeile({ id: 9002, person_id: 4064, betreff: "Frage", begruendung: gk, text: "Hallo", antwort: "Antwort" });
    ok(/Ampel gelb/.test(gkarte.titel) && /nie raus/.test(gkarte.text) && /Testkonto/.test(gkarte.text) && gkarte.empfehlung === "senden",
      "Karte „Ampel gelb — Maras Antwort senden?“ nennt den Grund", gkarte.text);
    const sOk = gelbEntwurfSatz("Frage zum Stand", FR.fristFaellig(j0, j0), null);
    ok(/frühestens Di\.?, 20\.10\., 12:00/.test(sOk) && /Karte/.test(sOk) && !/wenn sie darf/.test(sOk), "„Mara heute“: Satz mit Fälligkeit, ehrlich (sonst Karte)", sOk);
    const sLiegt = gelbEntwurfSatz("Frage zum Stand", FR.fristFaellig(j0, j0), "Vertriebssperre — Mara schreibt nicht von selbst neu");
    ok(/NICHT von selbst/.test(sLiegt) && /Vertriebssperre/.test(sLiegt) && /Karte/.test(sLiegt) && !/frühestens/.test(sLiegt), "„Mara heute“: liegt → „geht NICHT von selbst raus“ mit Grund", sLiegt);
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n12. Die Liste der Handlungen (SQL-Bau)");
  const heute = await import("../server/lib/fiaon-mara-heute");
  // E-406 Welle 2 (Integration): dazu B1, C1 (fiaon_tickets mit Maras Spalten), C2, B2 — 15 Teile.
  const alle = { ...Object.fromEntries(heute.HANDLUNG_TABELLEN.map((t) => [t, true])), fiaon_tickets_mara: true } as any;
  const sql = heute.handlungenSql(alle, { mitText: true });
  ok((sql.match(/UNION ALL/g) ?? []).length === 14, "fünfzehn Teile, wenn alle Tabellen da sind", (sql.match(/UNION ALL/g) ?? []).length);
  ok(["'rate_mail'", "'anliegen_antwort'", "'nacharbeit_mail'", "'kyc_mail'"].every((a) => sql.includes(a)), "die Wege aus Welle 1 und 2 stehen in der Liste");
  ok(/w\.von LIKE 'Mara%' AND w\.von NOT LIKE '%\(Nachfass\)%'/.test(sql) && /w\.vorlage IS NULL/.test(sql), "WhatsApp: nur Maras eigene Antworten (keine Vorlagen der Strecken)");
  ok(/pm\.aktion = 'auto_beantwortet'/.test(sql), "Mails: nur, was Mara selbst gesendet hat");
  ok(/g\.kanal = 'mail'/.test(sql), "Angaben per WhatsApp nicht doppelt (stehen schon im Protokoll)");
  ok(/n\.status = 'versandt'/.test(sql), "Nachfass-Mail: nur versandt");
  const ohne = heute.handlungenSql({ ...alle, fiaon_mara_angaben: false, fiaon_mara_zahlung_funde: false }, { mitText: false });
  ok(!/fiaon_mara_angaben|fiaon_mara_zahlung_funde/.test(ohne) && !/LEFT\(COALESCE\(w\.text/.test(ohne), "fehlende Tabellen fallen heraus; ohne Text kein Text");
  const leer = heute.handlungenSql(Object.fromEntries(heute.HANDLUNG_TABELLEN.map((t) => [t, false])) as any, { mitText: false });
  ok(/WHERE FALSE/.test(leer) && /\$1/.test(leer) && /\$2/.test(leer), "ganz ohne Tabellen: leere Abfrage mit denselben Parametern");
  ok(heute.MARA_TERMIN_HERKUENFTE.includes("mara_whatsapp") && !(heute.MARA_TERMIN_HERKUENFTE as readonly string[]).includes("mara_whatsapp_link"), "„Termin absagen“ nur für Termine, die Mara eingetragen hat — nicht die, die der Kunde selbst gebucht hat");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n13. Der Einbau in die Wege (Quelltext)");
  const lauf = quelle("server/lib/fiaon-postmeister-lauf.ts");
  ok(/const darfAuto = darfAutoOhneAmpel && !ampelGrund;/.test(lauf) && /mailDarfAuto\(stufe, \{ fristNeu: !!ein\.ampelFrist \}\)/.test(lauf), "Postfach: die Ampel hält nur an, was sonst rausginge");
  ok(/if \(darfAutoOhneAmpel\) \{/.test(lauf), "Postfach: die Ampel liest nur, wenn sonst gesendet würde (kein Lockern)");
  ok(/\} else if \(!ampelGelb\) \{/.test(lauf), "Postfach: ein gelber Entwurf ist keine Karte");
  ok(/if \(ampelGelb\) \{[\s\S]{0,400}gelbLiegenLesen[\s\S]{0,900}ampelGrund = mailAmpelGelbKarteGrund\(liegen, erg\.grund\);\s*ampelGelb = false;/.test(lauf),
    "Postfach: Gelb nur, wenn die 24-Stunden-Regel ihn später sendet — sonst Karte (Nachbesserung)");
  ok(/ampelFrist: true/.test(quelle("server/lib/fiaon-postmeister-frist.ts")), "24-Stunden-Regel: zweiter Anlauf darf bei Gelb senden");
  const pmEq = quelle("server/lib/fiaon-postmeister-entscheidungen.ts");
  ok(/NOT LIKE \$3/.test(pmEq) && /istAmpelGelbEntwurf\(z\.begruendung\)/.test(pmEq), "Karten: gelbe Entwürfe ausgenommen (Detektor und Sofort-Karte)");
  ok(/gelbeAlsKarten\(\(await lauf\.unsafe\(`\$\{GELB_SQL\}/.test(pmEq) && /for \(const k of await gelbeAlsKarten\(g \? \[g\] : \[\]\)\)/.test(pmEq),
    "Karten: … außer die 24-Stunden-Regel ließe sie liegen — dann doch eine Karte (Detektor und Sofort-Karte)");
  const heuteQ = quelle("server/lib/fiaon-mara-heute.ts");
  ok(!/wenn sie darf/.test(heuteQ) && /gelbEntwurfSatz\(x\.betreff, fristFaellig\(x\.am, jetzt\), liegen\.get/.test(heuteQ) && !/ORDER BY pm\.id DESC LIMIT 40/.test(heuteQ) && /mail_weitere/.test(heuteQ),
    "„Mara heute“: Satz aus demselben Urteil; kein stilles LIMIT 40 (Deckel mit „und N weitere“)");
  const wa = quelle("server/lib/fiaon-whatsapp-mara.ts");
  ok(/ampelRot\("rueckruf_eintragen"\)/.test(wa) && /vorlegen: `Ampel rot \(Rückruf eintragen\)/.test(wa), "WhatsApp: Rückruf bei Rot nicht eingetragen, Karte vorgelegt");
  ok(/ampelRot\("ratenpause_setzen"\)/.test(wa) && /ohneSperreMoeglich: true, intern: "Ampel rot/.test(wa), "WhatsApp: Ratenpause bei Rot als Karte „Pause setzen“");
  ok(/ampelRot\("rueckruf_eintragen"\)/.test(quelle("server/lib/fiaon-postmeister-werkzeuge.ts")), "Mail: Rückruf-Termin aus der Aufgabe bei Rot nicht eingetragen");
  const gen = quelle("server/lib/fiaon-mara-genannter-termin.ts");
  ok(/ampelRot\("vereinbarten_termin_eintragen"/.test(gen) && /terminRotKarteAnlegen/.test(gen), "Genannter Termin: bei Rot die Karte „Termin eintragen?“");
  ok(/ampelStufe\("mara", "antwort_senden"\)/.test(lauf), "Postfach: die Weiche liest „antwort_senden“ der EINEN Ampel");
  ok(/import\("\.\/fiaon-mara-aufraeumen"\)/.test(quelle("server/lib/fiaon-mara-entscheidungen.ts")), "Aufräumen wird mit den Karten geladen");
  ok(/kanal: "meldung"/.test(quelle("server/lib/fiaon-mara-aufraeumen.ts")) && /"mail" \| "whatsapp" (?:\| "anliegen" )?\| "meldung"/.test(quelle("server/lib/fiaon-mara-zahlung-suchen.ts")), "Aufräumen: zahlung_suchen mit Kanal „Meldung“");
  const auf2 = quelle("server/lib/fiaon-mara-aufraeumen.ts");
  ok(!/bankeingangBuchen|ratenStornieren|erstattung|kuendigung_buchen|antragBuchen/.test(auf2.replace(/\/\/.*$/gm, "")), "Aufräumen ruft nie Buchen, Storno, Erstattung oder Kündigung");
  const routen = quelle("server/routes/fiaon-mara-heute.ts");
  ok(/router\.post\("\/chef\/mara-heute\/rueckgaengig", inhaber/.test(routen), "Rückgängig nur Stufe Inhaber");
  ok(!/\/chef\/mara\/ampel|mara-stichprobe|tageslauf/.test(routen), "keine zweite Ampel-Route, keine Stichprobe, kein Stichproben-Takt");
  ok(/requireChef\("leitung"\)/.test(routen) && /maraHeuteKurz/.test(routen), "„Mara heute“ (kurz) lesen ab Stufe Leitung");
  ok(netz === 0, "kein Netz benutzt");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
