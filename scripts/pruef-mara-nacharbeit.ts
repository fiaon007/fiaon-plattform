// Prüfstand E-406 C2 (19.10.2026), offline: Nacharbeit nach dem Anruf — ein Klick, Mara macht den Rest.
// Ohne Datenbank, ohne Netz, ohne Schlüssel. Prüft die reine Regel (shared/fiaon-mara-nacharbeit.ts: Art je Ergebnis,
// Unterlagen-Versprechen, heikle Notiz, Urteil mit Sperren/Fenster/nie doppelt, Vorschau-Zeile), die Textprüfung
// (shared/fiaon-mara-nacharbeit-text.ts: Wortwand, E-393, Ton/Nennform, Bank-Satz, Sie-Form, Belege), die Vorlage im
// Mailwerk (gerendert) und die Verdrahtung (Registry, Tür, Takt, Routen, Häkchen, Rundgänge, Team-Update).
// Datenbank-Teil: scripts/pruef-mara-nacharbeit-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-mara-nacharbeit.ts
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[k];
process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  const R = await import("../shared/fiaon-mara-nacharbeit");
  const T = await import("../shared/fiaon-mara-nacharbeit-text");
  const { nacharbeitArt, unterlagenAusNotiz, unterlagenFuerLink, heikleNotiz, nacharbeitUrteil, nacharbeitVorschau, hinweisFuerMitarbeiter, GRUND } = R;

  // Feste Prüfzeiten (Berliner Wandzeit). Oktober 2026: Umstellung am 25.10. um 3 Uhr.
  const B = (iso: string) => new Date(iso);
  const MITTAG = B("2026-10-20T12:00:00+02:00");
  const VORHIN = new Date(MITTAG.getTime() - 5 * 60_000); // vor 5 Min. vorgemerkt → reif
  const basis: import("../shared/fiaon-mara-nacharbeit").NacharbeitFakten = {
    personDa: true, art: "gespraech", globalKunde: false, sperre: null, kuendigungOffen: false, notizHeikel: null,
    heiklerAuftrag: null, hatEmail: true, letzteNacharbeitAm: null, vorgemerktAm: VORHIN,
  };
  const U = (f: Partial<typeof basis>, jetzt = MITTAG) => nacharbeitUrteil({ ...basis, ...f }, jetzt);
  const zahlungOffen = { status: "pending_payment", betrag: 59.99 };

  console.log("── 1 · Welche Mail passt zu welchem Ergebnis");
  ok(nacharbeitArt("erreicht_zahlt_gleich") === "zusage", "Zahlt sofort → Zahlungszusage");
  ok(nacharbeitArt("erreicht_zahlt_am") === "zusage", "Zahlt am … → Zahlungszusage");
  ok(nacharbeitArt("rueckruf_termin") === "termin", "Rückruf vereinbart → Rückruf");
  ok(nacharbeitArt("erreicht_sonstiges", "Kunde möchte sich noch einige Tage überlegen.") === "gespraech", "Sonstiges → Zusammenfassung");
  ok(nacharbeitArt("erreicht_sonstiges", "Kunde schickt die Kontoauszüge bis Freitag.") === "unterlagen", "Sonstiges + „schickt die Kontoauszüge“ → Upload-Link");
  ok(nacharbeitArt("erreicht_sonstiges", "Reicht die Unterlagen nach.", ["ausweis"]) === "unterlagen", "„reicht die Unterlagen nach“ + Ausweis fehlt → Upload-Link");
  ok(nacharbeitArt("erreicht_sonstiges", "Reicht die Unterlagen nach.", []) === "gespraech", "„reicht die Unterlagen nach“, nichts fehlt → Zusammenfassung");
  for (const e of ["nicht_erreicht", "mailbox", "erreicht_abgelehnt", "nummer_falsch", "nummer_blockiert", "", null]) {
    ok(nacharbeitArt(e as any) === null, `${e || "(leer)"} → keine Mail (nicht erreicht: dafür gibt es E-401)`);
  }

  console.log("── 2 · Verspricht die Notiz Unterlagen?");
  const ja: [string, string[]][] = [
    ["Kunde schickt die Kontoauszüge bis Freitag.", ["kontoauszug"]],
    ["lädt den Ausweis heute noch hoch", ["ausweis"]],
    ["Ausweis und Kontoauszüge schickt er morgen per Mail", ["ausweis", "kontoauszug"]],
    ["Reicht die Schufa-Auskunft nach.", ["schufa"]],
    ["Wird die Unterlagen hochladen", ["allgemein"]],
  ];
  for (const [n, erw] of ja) ok(JSON.stringify(unterlagenAusNotiz(n)?.slice().sort()) === JSON.stringify(erw.slice().sort()), `„${n}“ → ${erw.join(", ")}`, unterlagenAusNotiz(n));
  for (const n of ["Hat keine Kontoauszüge.", "Unterlagen liegen vor.", "Ausweis ist abgelaufen.", "Kunde möchte sich überlegen.", "schickt nicht den Ausweis"]) {
    ok(unterlagenAusNotiz(n) === null, `„${n}“ → kein Versprechen`, unterlagenAusNotiz(n));
  }
  ok(JSON.stringify(unterlagenFuerLink("Wird die Unterlagen hochladen", ["ausweis", "kontoauszug"])) === JSON.stringify(["ausweis", "kontoauszug"]), "„Unterlagen“ ohne Art → die fehlenden");

  console.log("── 3 · Heikle Notiz → Mara schreibt nichts");
  const heikel: [string, RegExp][] = [
    ["Kunde will kündigen, zahlt aber noch die Rate.", /Kündigung/],
    ["Hat den Widerruf erklärt.", /Widerruf/],
    ["Hat sich beschwert wegen der KI.", /Beschwerde/],
    ["Droht mit Anwalt.", /Anwalt/],
    ["Will sein Geld zurück.", /Erstattung/],
    ["Möchte, dass wir seine Daten löschen.", /Löschung/],
    ["Liegt im Krankenhaus, Rückruf später.", /Gesundheit/],
    ["Es geht ihr gerade nicht gut.", /Gesundheit/],
    ["Interesse am Global Konzept, Termin mit Justin.", /Global|Leitung/],
    ["Wurde an Herrn Schwarzott weitergegeben.", /Leitung/],
    ["Möchte keine E-Mails mehr.", /keine Nachrichten/],
  ];
  for (const [n, g] of heikel) ok(g.test(String(heikleNotiz(n))), `„${n}“ → ${String(heikleNotiz(n))}`);
  for (const n of ["Kunde möchte sich noch einige Tage überlegen.", "Zahlt am Freitag, alles klar.", "Fragt, wie es nach der Zahlung weitergeht. Wurde erklärt."]) {
    ok(heikleNotiz(n) === null, `„${n}“ → nicht heikel`, heikleNotiz(n));
  }

  console.log("── 4 · Das Urteil: wer bekommt die Mail (positiv)");
  ok(U({}).art === "senden", "Gespräch, alles frei, 12:00, vor 5 Min. vorgemerkt → senden", U({}));
  ok(U({ art: "zusage", zahlung: zahlungOffen, zusageTag: "2026-10-22" }).art === "senden", "Zusage mit offener Zahlung, Tag in der Zukunft → senden");
  ok(U({ art: "zusage", zahlung: zahlungOffen, zusageTag: "2026-10-20" }).art === "senden", "Zusage „heute“ → senden");
  ok(U({ art: "termin", terminSteht: true, terminAm: B("2026-10-22T14:00:00+02:00") }).art === "senden", "Rückruf steht, übermorgen 14 Uhr → senden");
  ok(U({ art: "unterlagen", unterlagen: ["kontoauszug"] }).art === "senden", "Unterlagen mit Art → senden");
  ok(U({ letzteNacharbeitAm: new Date(MITTAG.getTime() - 13 * 3_600_000) }).art === "senden", "letzte Nacharbeit vor 13 h → senden");

  console.log("── 5 · Wer sie NICHT bekommt (negativ)");
  const neg: [string, Partial<typeof basis>, string, RegExp][] = [
    ["Person weg", { personDa: false }, "auslassen", /nicht mehr da/],
    ["keine Art (nicht erreicht)", { art: null }, "auslassen", /schickt Mara nichts/],
    ["FIAON Global", { globalKunde: true }, "auslassen", /FIAON Global/],
    ["Werbesperre", { sperre: "Werbesperre" }, "auslassen", /Werbesperre/],
    ["Testkonto", { sperre: "Testkonto" }, "auslassen", /Testkonto/],
    ["Vertriebssperre", { sperre: "Vertriebssperre" }, "auslassen", /Vertriebssperre/],
    ["gekündigt", { sperre: "gekündigt oder Vertrag beendet" }, "auslassen", /gekündigt/],
    ["Kündigung eingegangen", { kuendigungOffen: true }, "auslassen", /Kündigung eingegangen/],
    ["heikle Notiz", { notizHeikel: "Beschwerde oder Ärger im Gespräch" }, "auslassen", /Beschwerde/],
    ["heikler Auftrag", { heiklerAuftrag: "Beschwerde" }, "auslassen", /offener Auftrag „Beschwerde“/],
    ["keine Mail-Adresse", { hatEmail: false }, "auslassen", /keine E-Mail-Adresse/],
    ["vor 2 h schon eine (nie doppelt)", { letzteNacharbeitAm: new Date(MITTAG.getTime() - 2 * 3_600_000) }, "auslassen", /schon eine Zusammenfassung/],
    ["Zusage ohne offene Zahlung", { art: "zusage", zahlung: null }, "auslassen", /keine offene Zahlung/],
    ["Zusage, inzwischen bezahlt", { art: "zusage", zahlung: { status: "paid", betrag: 59.99 } }, "erledigt", /bezahlt/],
    ["Zusage, Zahlung schon gemeldet", { art: "zusage", zahlung: { status: "claimed_paid", betrag: 59.99 } }, "auslassen", /gemeldet/],
    ["Zusage, Bestellung abgelaufen", { art: "zusage", zahlung: { status: "expired", betrag: 59.99 } }, "auslassen", /abgelaufen/],
    ["Zusage über 0 €", { art: "zusage", zahlung: { status: "pending_payment", betrag: 0 } }, "auslassen", /keine offene Zahlung/],
    ["Zusage-Tag vorbei (Abendanruf, Mail am Morgen)", { art: "zusage", zahlung: zahlungOffen, zusageTag: "2026-10-19" }, "erledigt", /vorbei/],
    ["Rückruf verworfen", { art: "termin", terminSteht: false, terminAm: B("2026-10-22T14:00:00+02:00") }, "erledigt", /steht nicht mehr/],
    ["Rückruf in 30 Min.", { art: "termin", terminSteht: true, terminAm: new Date(MITTAG.getTime() + 30 * 60_000) }, "erledigt", /gleich an/],
    ["Unterlagen ohne Art", { art: "unterlagen", unterlagen: [] }, "auslassen", /keine Unterlage/],
  ];
  for (const [name, f, art, grund] of neg) {
    const u = U(f);
    ok(u.art === art && grund.test((u as any).grund ?? ""), `${name} → ${art} (${(u as any).grund ?? "—"})`, u);
  }
  // Global geht VOR allem anderen (auch vor einer fehlenden Adresse) — die Wand sagt den echten Grund.
  ok(/FIAON Global/.test((U({ globalKunde: true, hatEmail: false }) as any).grund), "Global + keine Adresse → der Grund ist Global");

  console.log("── 6 · Zeit: Berichtigen, Fenster 08–20 Uhr, am nächsten Morgen");
  const frisch = U({ vorgemerktAm: MITTAG });
  ok(frisch.art === "warten" && (frisch as any).grund === GRUND.reif && (frisch as any).nichtVor.getTime() === MITTAG.getTime() + R.REIF_MINUTEN * 60_000,
    `gerade vorgemerkt → wartet ${R.REIF_MINUTEN} Min. (Zeit zum Berichtigen)`, frisch);
  const abends = B("2026-10-20T21:30:00+02:00");
  const uA = U({ vorgemerktAm: new Date(abends.getTime() - 10 * 60_000) }, abends);
  ok(uA.art === "warten" && (uA as any).nichtVor.toISOString() === B("2026-10-21T08:00:00+02:00").toISOString(), "21:30 → wartet bis morgen 08:00", uA);
  const frueh = B("2026-10-20T06:40:00+02:00");
  const uF = U({ vorgemerktAm: new Date(frueh.getTime() - 10 * 60_000) }, frueh);
  ok(uF.art === "warten" && (uF as any).nichtVor.toISOString() === B("2026-10-20T08:00:00+02:00").toISOString(), "06:40 → wartet bis 08:00 desselben Tages", uF);
  const kurzVor = B("2026-10-20T19:58:00+02:00");
  const uK = U({ vorgemerktAm: kurzVor }, kurzVor);
  ok(uK.art === "warten" && (uK as any).nichtVor.toISOString() === B("2026-10-21T08:00:00+02:00").toISOString() && (uK as any).grund === GRUND.fenster,
    "19:58 vorgemerkt (reif erst 20:01) → morgen 08:00", uK);
  // Über die Zeitumstellung (25.10.2026, 3 Uhr): Samstag 22:00 → Sonntag 08:00 Winterzeit.
  const sa = B("2026-10-24T22:00:00+02:00");
  const uS = U({ vorgemerktAm: sa }, sa);
  ok(uS.art === "warten" && (uS as any).nichtVor.toISOString() === B("2026-10-25T08:00:00+01:00").toISOString(), "über die Zeitumstellung: 08:00 Winterzeit", uS);
  ok(U({ art: "zusage", zahlung: zahlungOffen, zusageTag: "2026-10-20", vorgemerktAm: VORHIN }, B("2026-10-21T08:05:00+02:00")).art === "erledigt",
    "„Zahlt sofort“ um 20:30, der Morgen danach → erledigt (kein „heute“ von gestern)");

  console.log("── 7 · Die Vorschau-Zeile (eine Zeile, vor dem Speichern)");
  const D: import("../shared/fiaon-mara-nacharbeit").NacharbeitVorschauDaten = { an: true, sperrGrund: null, betrag: "59,99 €", zahlungGrund: null, fehlende: ["kontoauszug"] };
  const V = (e: Partial<Parameters<typeof nacharbeitVorschau>[1]>, d: typeof D | null = D) => nacharbeitVorschau(d, { ergebnis: null, heute: "2026-10-20", ...e } as any);
  const vg = V({ ergebnis: "erreicht_zahlt_gleich" });
  ok(vg.moeglich && vg.zeile === "59,99 € heute + Zahlungsseite", `Zahlt sofort → „${vg.zeile}“`);
  const va = V({ ergebnis: "erreicht_zahlt_am", zusageDatum: "2026-10-22" });
  ok(va.moeglich && va.zeile === "59,99 € bis Do 22.10. + Zahlungsseite", `Zahlt am 22.10. → „${va.zeile}“`);
  const vt = V({ ergebnis: "rueckruf_termin", terminDatum: "2026-10-22", terminZeit: "14:00" });
  ok(vt.moeglich && vt.zeile === "Rückruf Do 22.10., 14:00 Uhr bestätigen", `Rückruf → „${vt.zeile}“`);
  const vs = V({ ergebnis: "erreicht_sonstiges", notiz: "Möchte sich überlegen." });
  ok(vs.moeglich && /Zusammenfassung deiner Notiz/.test(vs.zeile), `Sonstiges → „${vs.zeile}“`);
  const vu = V({ ergebnis: "erreicht_sonstiges", notiz: "Schickt die Unterlagen nach." });
  ok(vu.moeglich && vu.zeile === "Upload-Link für Kontoauszüge", `Unterlagen → „${vu.zeile}“`);
  const vh = V({ ergebnis: "erreicht_sonstiges", notiz: "Hat sich beschwert." });
  ok(!vh.moeglich && /Beschwerde/.test(vh.zeile), `heikle Notiz → kein Häkchen („${vh.zeile}“)`);
  const vhz = V({ ergebnis: "erreicht_zahlt_am", zusageDatum: "2026-10-22", notiz: "Will kündigen, zahlt aber die Rate." });
  ok(!vhz.moeglich, "heikle Notiz gilt auch bei „Zahlt am …“");
  const vsp = V({ ergebnis: "erreicht_zahlt_gleich" }, { ...D, sperrGrund: "Kunde von FIAON Global — sein Ansprechpartner schreibt selbst" });
  ok(!vsp.moeglich && /FIAON Global/.test(vsp.zeile), `Sperre → „${vsp.zeile}“`);
  const vz = V({ ergebnis: "erreicht_zahlt_gleich" }, { ...D, betrag: null, zahlungGrund: GRUND.gemeldet });
  ok(!vz.moeglich && /gemeldet/.test(vz.zeile), `Zahlung schon gemeldet → „${vz.zeile}“`);
  ok(!V({ ergebnis: "nicht_erreicht" }).art, "nicht erreicht → keine Zeile");
  ok(!V({ ergebnis: "erreicht_zahlt_gleich" }, null).moeglich, "Daten noch nicht geladen → kein Häkchen");
  for (const v of [vg, va, vt, vs, vu]) ok(v.zeile.length <= 60, `Zeile knapp (${v.zeile.length} Zeichen): „${v.zeile}“`);

  console.log("── 8 · Der Satz nach dem Speichern");
  ok(/in ein paar Minuten die Zusammenfassung \(Zahlungszusage\)/.test(String(hinweisFuerMitarbeiter({ art: "warten", nichtVor: MITTAG, grund: GRUND.reif }, "zusage", MITTAG))), "reif → „in ein paar Minuten“");
  ok(/morgen 08:00 Uhr den Upload-Link/.test(String(hinweisFuerMitarbeiter({ art: "warten", nichtVor: B("2026-10-21T08:00:00+02:00"), grund: GRUND.fenster }, "unterlagen", abends))), "Fenster → „morgen 08:00 Uhr“");
  ok(/keine Mail: keine E-Mail-Adresse/.test(String(hinweisFuerMitarbeiter({ art: "auslassen", grund: GRUND.keineMail }, "gespraech", MITTAG))), "ausgelassen → der Grund");

  console.log("── 9 · Die Vorlage im Mailwerk (gerendert, ganzer Kundentext geprüft)");
  const motor = await import("../server/mail/motor");
  const grund = { email: "max@e406.invalid", einstieg: "Guten Tag Max Mustermann", mitarbeiter: "Herr Stripling", mitarbeiter_dat: "Herrn Stripling" };
  const MA = [{ vorname: "Daniel", nachname: "Stripling", anrede: "Herr" as const }, { vorname: "Florentine", nachname: "Lombardi", anrede: "Frau" as const }, { vorname: "Nikita", nachname: "Boychenko", anrede: null }];
  const kern = (m: { betreff: string; text: string } | null) => {
    const t = m?.text ?? "";
    const f = t.search(/\n—\n|\nFIAON LTD\b/);
    return `${m?.betreff ?? ""}\n${f > 0 ? t.slice(0, f) : t}`;
  };
  const z = motor.mailRendern("mara_nacharbeit", { ...grund, nacharbeit_art: "zusage", betrag: "59.99", zusage_wann: "bis Donnerstag, 22. Oktober", zusage_tag: "bis Donnerstag, 22. Oktober", verwendungszweck: "FIAON-ABC123", zahlung_url: "https://www.fiaon.com/zahlung/FIAON-ABC123" });
  ok(!!z && z.fehlend.length === 0 && !z.knopfEntfallen, "Zusage: alle Platzhalter gefüllt, Knopf da", z?.fehlend);
  ok(/59,99 €/.test(z?.betreff ?? "") && /href="https:\/\/www\.fiaon\.com\/zahlung\/FIAON-ABC123"/.test(z?.html ?? ""), "Zusage: Betrag im Betreff, Knopf zur Zahlungsseite");
  ok(/Herrn Stripling/.test(z?.html ?? "") && !/\bDaniel\b/.test(z?.html ?? ""), "Zusage: Nennform, nie der Vorname");
  ok(!/IBAN|DE\d{2}\s?\d{4}|BIC/.test(kern(z)), "Zusage: keine Bankdaten im Text (die stehen auf der Zahlungsseite)");
  ok(!/partnerbank|entscheidet/i.test(z?.text ?? "") && !/karte-ziel|Ihr Ziel/i.test(z?.html ?? ""), "Zusage: kein Bank-Satz, kein Karten-Block");
  ok(T.nacharbeitTextPruefen(kern(z), { mitarbeiter: MA, kundeNamen: ["Max", "Mustermann"] }).length === 0, "Zusage: Textprüfung sauber", T.nacharbeitTextPruefen(kern(z), { mitarbeiter: MA }));
  const t = motor.mailRendern("mara_nacharbeit", { ...grund, nacharbeit_art: "termin", termin_datum: "Donnerstag, 22. Oktober", termin_uhrzeit: "14 Uhr" });
  ok(!!t && t.fehlend.length === 0 && /Ihr Rückruf: Donnerstag, 22\. Oktober, 14 Uhr/.test(t.betreff), "Rückruf: Betreff mit Tag und Uhrzeit", t?.betreff);
  ok(/ruft <b>Herr Stripling<\/b> Sie/.test(t?.html ?? ""), "Rückruf: wer anruft, in der Nennform");
  ok(T.nacharbeitTextPruefen(kern(t), { mitarbeiter: MA, gedeckt: ["notiz_an_betreuer"] }).length === 0, "Rückruf: Textprüfung sauber (der Rückruf steht im Kalender = gedeckt)", T.nacharbeitTextPruefen(kern(t), { mitarbeiter: MA, gedeckt: ["notiz_an_betreuer"] }));
  ok(T.nacharbeitTextPruefen(kern(t), { mitarbeiter: MA }).some((f) => /Wortwand/.test(f)), "Rot-Probe: ohne eingetragenen Rückruf wäre „ruft Sie an“ eine ungedeckte Zusage");
  const g = motor.mailRendern("mara_nacharbeit", { ...grund, nacharbeit_art: "gespraech", absatz1_html: T.htmlSicher("Sie möchten sich bis Freitag überlegen, ob Sie starten."), absatz2_html: "", absatz3_html: "" });
  ok(!!g && g.fehlend.length === 0 && /kurz zusammengefasst/.test(g.betreff), "Zusammenfassung: gerendert, leere Absätze entfallen");
  ok(!/<p[^>]*>\s*<\/p>/.test(g?.html ?? ""), "Zusammenfassung: kein leerer Absatz");
  const gi = motor.mailRendern("mara_nacharbeit", { ...grund, nacharbeit_art: "gespraech", absatz1_html: T.htmlSicher("<script>x</script> {{params.email}}"), absatz2_html: "", absatz3_html: "" });
  ok(!/<script>/.test(gi?.html ?? "") && !/max@e406/.test((gi?.html ?? "").split("Hier noch einmal")[1] ?? "x"), "Maras Zeilen sind maskiert (kein HTML, kein Platzhalter)");
  ok(motor.absenderFuer("mara_nacharbeit").email === motor.absenderFuer("termin_bestaetigung").email, "Absender: FIAON Welcome (wie Terminmails)");

  console.log("── 10 · Die Textprüfung fängt, was nie rausgehen darf");
  const sauber = "Sie möchten sich bis Freitag überlegen, ob Sie mit FIAON starten. Ihre Fragen zum Ablauf haben wir am Telefon geklärt.";
  ok(T.nacharbeitTextPruefen(sauber, { mitarbeiter: MA, kiTeil: sauber, notiz: "überlegt bis Freitag, Fragen zum Ablauf geklärt" }).length === 0, "saubere Zusammenfassung → leer");
  const boese: [string, string, RegExp][] = [
    ["Daniel ruft Sie am Freitag zurück.", "", /Ton|Wortwand/],
    ["Ihr Kredit ist sofort verfügbar.", "", /Wortwand|Kredit/],
    ["Wir garantieren Ihnen die Karte.", "", /Wortwand/],
    ["Über den Rahmen entscheidet unsere Partnerbank.", "", /Bank-Vorbehalt/],
    ["Ohne die offene Rate können wir Ihre Kündigung nicht bestätigen.", "Kunde will kündigen", /E-393|Wortwand|Kündigung/],
    ["Kannst du uns die Unterlagen schicken?", "", /Du-Form/],
    ["Sie zahlen 79,99 € am Freitag.", "zahlt am Freitag", /Zahl/],
    ["Hier geht es weiter: https://example.com/x", "", /Link/],
    ["Wir melden uns innerhalb von 3 Tagen.", "3", /Wortwand/],
    ["Ihre Akte ist an die Leitung weitergegeben.", "", /internes Wort|Wortwand/],
    ["Ihre Erstattung prüfen wir.", "", /Erstattung/],
    ["Ihr Wunschlimit steht.", "", /Limit|Ton|Wortwand/],
  ];
  for (const [txt, notiz, erw] of boese) {
    const f = T.nacharbeitTextPruefen(txt, { mitarbeiter: MA, kiTeil: txt, notiz });
    ok(f.some((x) => erw.test(x)), `„${txt}“ → ${f[0] ?? "—"}`, f);
  }
  ok(T.nacharbeitTextPruefen("Frau Lombardi hat Ihnen den Ablauf erklärt.", { mitarbeiter: MA, kiTeil: "x" }).length === 0, "„Frau Lombardi“ (Nennform) ist frei");
  ok(T.nacharbeitTextPruefen("Nikita Boychenko hat Ihnen den Ablauf erklärt.", { mitarbeiter: MA, kiTeil: "x" }).length === 0, "voller Name ohne Anrede ist frei");
  const abs = T.absaetzeAus(["Guten Tag Herr Muster,", " Sie   möchten starten. ", "", "Viele Grüße", "Zwei.", "Drei.", "Vier."]);
  ok(JSON.stringify(abs) === JSON.stringify(["Sie möchten starten.", "Zwei.", "Drei."]), "Absätze: ohne Anrede/Gruß, höchstens drei", abs);
  ok(T.htmlSicher(`<b>&"{x}`) === "&lt;b&gt;&amp;&quot;(x)", "htmlSicher maskiert Markup und Platzhalter");
  ok(!/\{\{|\}\}/.test(T.GESPRAECH_AUFTRAG) && /senden=false/.test(T.GESPRAECH_AUFTRAG) && /Nichts erfinden/.test(T.GESPRAECH_AUFTRAG), "Auftrag an Mara: nichts erfinden, senden=false bei Heiklem");
  ok(/<<<[\s\S]*>>>/.test(T.gespraechNachricht({ notiz: "x", mitarbeiterNom: "Herr Stripling", mitarbeiterDat: "Herrn Stripling", heute: "Dienstag, 20. Oktober", termin: null })), "die Notiz reist eingerahmt (Daten, keine Anweisung)");

  console.log("── 11 · Verdrahtung");
  const reg = lies("server/make-events-registry.ts");
  ok(/type: "mara_nacharbeit"/.test(reg), "Registry: mara_nacharbeit");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const bsp = MAKE_EVENT_REGISTRY.find((e) => e.type === "mara_nacharbeit");
  const bm = bsp ? motor.mailRendern("mara_nacharbeit", bsp.example as any) : null;
  ok(!!bm && !bm.knopfEntfallen && bm.fehlend.length === 0, "Registry-Beispiel füllt die Vorlage samt Knopf (Mailwerk/Galerie)", bm?.fehlend);
  const tuer = lies("server/make-webhook.ts");
  ok(/\| "mara_nacharbeit"/.test(tuer), "Tür: Ereignistyp bekannt");
  ok(/const PRIVATLINIE_PERSON = new Set<string>\(\[[\s\S]*"mara_nacharbeit"[\s\S]*?\]\);/.test(tuer), "Tür: Global-Wand (PRIVATLINIE_PERSON) kennt mara_nacharbeit");
  const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");
  ok(!PFLICHTMAILS.has("mara_nacharbeit"), "keine Pflichtmail — Frequenzbremse und Sperren gelten");
  const { mailEvents } = await import("../server/lib/fiaon-mail-events").then((m) => ({ mailEvents: m }));
  ok(/mara_nacharbeit: \{[\s\S]*?vonHand: false/.test(lies("server/lib/fiaon-mail-events.ts")) && !!mailEvents, "Sende-Menü: nur automatisch (vonHand: false)");
  const routes = lies("server/routes.ts");
  ok(/tageslauf\('mara_nacharbeit_mail'[\s\S]{0,200}nacharbeitTakt\(\)[\s\S]{0,80}2 \* 60 \* 1000/.test(routes), "Takt alle 2 Min. (nur mit Ergebnis in der Historie)");
  const ak = lies("server/routes/fiaon-agent-kunden.ts");
  ok(/nacharbeitNachErgebnis\(\{[\s\S]{0,300}gewaehlt: req\.body\?\.maraNacharbeit === true/.test(ak), "Kundenkarte/Akte: Häkchen → vormerken (nur bei true)");
  ok(/maraNacharbeit\?\.hinweis \? ` · \$\{maraNacharbeit\.hinweis\}`/.test(ak), "Kundenkarte/Akte: der Satz hängt an der Meldung");
  ok(/router\.get\("\/agent\/crm\/kunden\/:personId\/mara-nacharbeit"[\s\S]{0,700}darfAnKunde/.test(ak), "Vorschau-Daten: nur für den eigenen Kunden (darfAnKunde)");
  ok(!/mara-nacharbeit\?[^"`]*notiz/.test(ak + lies("client/src/components/agent/MaraNacharbeitHaken.tsx")), "keine Notiz in der Adresse (Vorschau ohne Query)");
  const tel = lies("server/routes/fiaon-telefonie.ts");
  ok(/nacharbeitNachErgebnis\(\{[\s\S]{0,300}gewaehlt: req\.body\?\.maraNacharbeit === true/.test(tel), "Telefon-Route: derselbe Weg");
  const ew = lies("client/src/components/agent/ErgebnisWahl.tsx");
  ok(/<MaraNacharbeitHaken/.test(ew) && /maraNacharbeit: !!\(maraDaten\?\.an && vorschau\.moeglich && mara\)/.test(ew), "ErgebnisWahl: Häkchen mit Vorschau, schickt maraNacharbeit");
  const pl = lies("client/src/pages/agent/pipeline.tsx");
  ok(/<MaraNacharbeitHaken[\s\S]{0,800}?dunkel \/>/.test(pl) && /maraNacharbeit: !!\(maraDaten\?\.an && v\.moeglich && mara\)/.test(pl), "Akte (dunkel): dasselbe Häkchen");
  const sp = lies("server/routes/fiaon-mara-steuerpult.ts");
  ok(/router\.get\("\/chef\/mara\/nacharbeit"/.test(sp) && /router\.post\("\/chef\/mara\/nacharbeit"[\s\S]{0,400}chefProtokoll/.test(sp), "Mara-Einstellungen: GET/POST /chef/mara/nacharbeit mit Chef-Protokoll");
  ok(/data-mara-schalter="nacharbeit"/.test(lies("client/src/components/admin/ChefMaraTermine.tsx")), "Chefbüro › Mara › Termine: der Schalter (keine neue Seite)");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok((rg.match(/Neu: Mara schickt die Zusammenfassung\./g) ?? []).length >= 2 && /ziel: '\[data-mara-schalter="nacharbeit"\]'/.test(rg), "Rundgänge: Akte, Aufträge und Mara-Termine");
  const up = lies("client/src/pages/agent/updates-data.ts");
  ok(up.indexOf('id: "2026-10-19-mara-nacharbeit"') > 0 && up.indexOf('id: "2026-10-19-mara-nacharbeit"') < up.indexOf('id: "2026-10-19-agb-monatsentgelt"'), "Team-Update steht oben");
  const srv = lies("server/lib/fiaon-mara-nacharbeit.ts");
  ok(/FOR UPDATE SKIP LOCKED/.test(srv) && /status = 'unklar'/.test(srv) && /fiaon_mara_nacharbeit_offen_je_person/.test(srv), "Takt: atomar, Hängengebliebenes nie neu, ein wartender Merker je Person");
  ok(/versendenUndProtokollieren\(NACHARBEIT_EVENT/.test(srv) && /verlaufRef: ref, verlaufText/.test(srv), "Versand über den einen Weg (Protokoll + Verlauf in der Akte)");
  ok(/unterlagenAnfrageSenden\(\{[\s\S]{0,200}quelle: "mara_nacharbeit"/.test(srv) && /ereignis: "unterlage_angefordert"/.test(srv), "Unterlagen: bestehende Bitte mit Upload-Link + Ereignis an die Aufträge (E-397)");
  ok(/kiPausiert/.test(srv) && /istKiPause\(err\)/.test(srv), "KI-Pause: die Zusammenfassung wartet");
  ok(!/zahlungBuchen|markPaid|mark-paid|erstattung(?:Buchen|Ausloesen)/i.test(srv), "Geld bucht Mara nie (kein Buchungsweg im Modul)");

  console.log("── 12 · Kündigungs-Code nicht angefasst (Jahresvertrag-Sitzung, E-396)");
  const { execSync } = await import("node:child_process");
  const geaendert = execSync("git status --porcelain", { cwd: new URL("..", import.meta.url).pathname }).toString();
  ok(!/fiaon-kuendigung/.test(geaendert), "keine fiaon-kuendigung*.ts geändert", geaendert.split("\n").filter((z) => /kuendigung/.test(z)).join(" | "));

  console.log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut}/${gut + schlecht} Prüfungen bestanden.`);
  process.exit(schlecht === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
