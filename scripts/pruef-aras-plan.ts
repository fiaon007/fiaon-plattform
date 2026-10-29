// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (offline): ARAS-Planregeln — Fenster, Höchstzahlen, Reihung,
// Sperrgründe, Einstellungs-Grenzen, Feiertage, Druck-Muster (E-408)
//
//   npx tsx scripts/pruef-aras-plan.ts
//
// Keine Datenbank, kein Netz. Jede Regel hat eine Rotprobe: Der Fall, der
// NICHT durchgehen darf, wird mitgeprüft (AGENTS.md: „Ein Prüfstand muss rot
// werden können“).
// ═══════════════════════════════════════════════════════════════════════════
import {
  fensterOffen, darfVersuch, reihen, stundeFuer, druckFinden, sperrwunsch, istAufnahmeJa, istAufnahmeNein,
  einstellungPruefen, einstellungenAnwenden, nummerLand, berlinTeile, stimmKostenCents, telefonKostenCents,
  ARAS_SCHLUESSEL, ARAS_AMPEL, WERKZEUGE, SPIELARTEN, RECHTSGRUND, PRIORITAET, istWerbeSpielart, FENSTER_VORGABE,
  type Kandidat,
} from "../shared/fiaon-aras";
import { istFeiertag, ostersonntag } from "../shared/fiaon-feiertage";
import { telefonRegeln, lastschriftFinden, vertragZusageFinden, anliegenVorIdentitaet, kiHinweisGesagt } from "../shared/fiaon-aras-regeln";

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
/** Ein Berliner Zeitpunkt („2026-10-20 10:30“) als Date — im Oktober 2026 gilt MESZ (+02:00) bis 25.10., danach MEZ (+01:00). */
const berlin = (s: string, offset = "+02:00") => new Date(`${s.replace(" ", "T")}:00${offset}`);

titel("1. FEIERTAGE");
ok("Ostersonntag 2026 = 05.04.", ostersonntag(2026) === "2026-04-05", ostersonntag(2026));
ok("Ostersonntag 2027 = 28.03.", ostersonntag(2027) === "2027-03-28", ostersonntag(2027));
ok("Ostermontag 2026 (06.04.) ist in DE frei", istFeiertag("DE", "2026-04-06"));
ok("26.10. ist nur in AT frei", istFeiertag("AT", "2026-10-26") && !istFeiertag("DE", "2026-10-26") && !istFeiertag("CH", "2026-10-26"));
ok("1.8. ist nur in CH frei", istFeiertag("CH", "2026-08-01") && !istFeiertag("DE", "2026-08-01"));
ok("3.10. ist nur in DE frei", istFeiertag("DE", "2026-10-03") && !istFeiertag("AT", "2026-10-03"));
ok("Rotprobe: 20.10.2026 ist nirgends frei", !istFeiertag("DE", "2026-10-20") && !istFeiertag("AT", "2026-10-20") && !istFeiertag("CH", "2026-10-20"));

titel("2. BERLINER ZEIT (formatToParts, keine NaN-Falle)");
{
  const t = berlinTeile(berlin("2026-10-20 10:30"));
  ok("Dienstag 10:30", t.wochentag === 2 && t.hhmm === "10:30" && t.datum === "2026-10-20", JSON.stringify(t));
  const m = berlinTeile(new Date("2026-10-20T23:30:00+02:00"));
  ok("23:30 bleibt 23:30 (kein „24:30“)", m.hhmm === "23:30" && m.stunde === 23, JSON.stringify(m));
  const w = berlinTeile(new Date("2026-11-02T09:00:00+01:00"));
  ok("Nach der Zeitumstellung: Montag 09:00 MEZ", w.wochentag === 1 && w.hhmm === "09:00", JSON.stringify(w));
}

titel("3. FENSTER");
ok("Rate Di 10:30 offen", fensterOffen("rate", "DE", berlin("2026-10-20 10:30")).offen);
// Go-live (Justin 20.10.2026): „jeden Tag von 09:30 Uhr bis 21:00 Uhr“ — Mo–Sa; Sonntag/Feiertag nur gebuchte Rückrufe.
ok("Rate Di 09:29 zu, 09:30 offen (Go-live: ab 09:30)", fensterOffen("rate", "DE", berlin("2026-10-20 09:29")).grund === "ausserhalb_fenster" && fensterOffen("rate", "DE", berlin("2026-10-20 09:30")).offen);
ok("Rate Di 20:59 offen, 21:00 zu (bis 21:00)", fensterOffen("rate", "DE", berlin("2026-10-20 20:59")).offen && fensterOffen("rate", "DE", berlin("2026-10-20 21:00")).grund === "ausserhalb_fenster");
ok("Rate Sa 11:00 offen (Mo–Sa)", fensterOffen("rate", "DE", berlin("2026-10-24 11:00")).offen);
ok("Verkauf (zuruf) Sa 11:00 offen", fensterOffen("zuruf", "DE", berlin("2026-10-24 11:00")).offen);
ok("Verkauf Sa 20:59 offen, 21:00 zu", fensterOffen("zuruf", "DE", berlin("2026-10-24 20:59")).offen && fensterOffen("zuruf", "DE", berlin("2026-10-24 21:00")).grund === "ausserhalb_fenster");
ok("Sonntag: alles zu", fensterOffen("zuruf", "DE", berlin("2026-10-25 11:00", "+01:00")).grund === "sonntag");
ok("Feiertag AT 26.10. zu, DE am selben Tag offen",
  fensterOffen("zuruf", "AT", berlin("2026-10-26 11:00", "+01:00")).grund === "feiertag" && fensterOffen("zuruf", "DE", berlin("2026-10-26 11:00", "+01:00")).offen);
ok("Termin schlägt das Fenster (Di 08:15 offen)", fensterOffen("termin", "DE", berlin("2026-10-20 08:15")).offen);
ok("Termin nie in der Nacht (Di 07:30 zu)", fensterOffen("termin", "DE", berlin("2026-10-20 07:30")).grund === "nachtruhe");
ok("Probe (eigene Nummer) Sa 22:30 offen, 23:00 zu, So 12:00 offen", fensterOffen("probe", "DE", berlin("2026-10-24 22:30")).offen && !fensterOffen("probe", "DE", berlin("2026-10-24 23:00")).offen && fensterOffen("probe", "DE", berlin("2026-10-25 12:00", "+01:00")).offen);
ok("Eigenes Fenster wirkt (Verkauf Di bis 17:00 → 17:30 zu)",
  fensterOffen("zuruf", "DE", berlin("2026-10-20 17:30"), { fenster: { verkauf: { "1-5": ["09:00", "17:00"] }, rate: FENSTER_VORGABE.rate } }).grund === "ausserhalb_fenster");

titel("4. HÖCHSTZAHLEN JE PERSON (Mensch + ARAS zusammen)");
const jetzt = berlin("2026-10-20 10:30");
ok("frisch: ok", darfVersuch({ versucheHeute: 0, versucheWoche: 0, fehlFolge: 0, letzterVersuchAm: null, jetzt }).ok);
ok("heute schon 1 Versuch → je_person_tag", darfVersuch({ versucheHeute: 1, versucheWoche: 1, fehlFolge: 1, letzterVersuchAm: berlin("2026-10-20 09:00"), jetzt }).grund === "je_person_tag");
ok("Woche voll (3) → je_person_woche", darfVersuch({ versucheHeute: 0, versucheWoche: 3, fehlFolge: 2, letzterVersuchAm: berlin("2026-10-18 09:00"), jetzt }).grund === "je_person_woche");
ok("6 Fehlversuche in Folge → versuche_ende", darfVersuch({ versucheHeute: 0, versucheWoche: 0, fehlFolge: 6, letzterVersuchAm: berlin("2026-09-01 09:00"), jetzt }).grund === "versuche_ende");
ok("3 Fehl in Folge, letzter vor 2 Tagen → pause_nach_fehl", darfVersuch({ versucheHeute: 0, versucheWoche: 1, fehlFolge: 3, letzterVersuchAm: berlin("2026-10-18 09:00"), jetzt }).grund === "pause_nach_fehl");
ok("3 Fehl in Folge, letzter vor 8 Tagen → ok", darfVersuch({ versucheHeute: 0, versucheWoche: 0, fehlFolge: 3, letzterVersuchAm: berlin("2026-10-12 09:00"), jetzt }).ok);
ok("Mitarbeiter-Anruf vor 3 Minuten → kollision", darfVersuch({ versucheHeute: 0, versucheWoche: 0, fehlFolge: 0, letzterVersuchAm: berlin("2026-10-20 10:27"), jetzt }).grund === "kollision");
ok("Termin bei Aras zählt nicht gegen die Grenze", darfVersuch({ versucheHeute: 2, versucheWoche: 5, fehlFolge: 0, letzterVersuchAm: null, jetzt, spielart: "termin" }).ok);
ok("Eigene Grenze 2/Tag wirkt", darfVersuch({ versucheHeute: 1, versucheWoche: 1, fehlFolge: 0, letzterVersuchAm: berlin("2026-10-20 08:00"), jetzt, jePersonTag: 2 }).ok);

titel("5. REIHUNG");
{
  const k = (id: number, spielart: Kandidat["spielart"], extra: Partial<Kandidat> = {}): Kandidat => ({
    id, spielart, prioritaet: PRIORITAET[spielart], fruehAb: berlin("2026-10-20 09:00"), fehlFolge: 0, ...extra,
  });
  const liste = [
    k(1, "stufe_b", { fehlFolge: 4, anlassAm: berlin("2026-09-01 09:00") }),
    k(2, "rate", { betragCents: 2999 }),
    k(3, "zuruf", { anlassAm: berlin("2026-10-20 08:00") }),
    k(4, "termin"),
    k(5, "rate", { betragCents: 9999 }),
    k(6, "stufe_b", { fehlFolge: 0, anlassAm: berlin("2026-10-19 09:00") }),
    k(7, "stufe_a", { anlassAm: berlin("2026-10-20 07:00") }),
    k(8, "stufe_b", { fehlFolge: 0, anlassAm: berlin("2026-10-20 06:00") }),
    k(9, "zusage", { betragCents: 5999 }),
  ];
  const r = reihen(liste).map((x) => x.id);
  ok("Termin zuerst, dann Zuruf, dann Raten/Zusage nach Betrag, dann Stufe A, dann Stufe B frisch vor alt, Serie > 3 zuletzt",
    JSON.stringify(r) === JSON.stringify([4, 3, 5, 9, 2, 7, 8, 6, 1]), JSON.stringify(r));
  ok("reihen ist stabil (gleiche Eingabe → gleiche Ausgabe)", JSON.stringify(reihen(liste).map((x) => x.id)) === JSON.stringify(r));
  ok("reihen verändert die Eingabe nicht", liste[0].id === 1);
}

titel("6. BESTE STUNDE");
ok("Ohne Messung: Rate 9 Uhr, Verkauf 17 Uhr", stundeFuer("rate", null) === 9 && stundeFuer("zuruf", null) === 17);
ok("Mit Messung: beste Stunde im Fenster 9–18", stundeFuer("zuruf", { 7: 0.9, 11: 0.12, 17: 0.31, 19: 0.95 }) === 17);
ok("Rotprobe: Stunde 7 oder 19 wird nie gewählt", stundeFuer("rate", { 7: 0.99, 19: 0.99, 10: 0.1 }) === 10);

titel("7. DRUCK-MUSTER (KI-VO Art. 5) UND SPERRWUNSCH");
// druckFinden: harte Telefon-Regeln (shared/fiaon-aras-regeln.ts, wortgleich mit Prüf-Mara E-409); die Hinweise sind ganze Sätze.
ok("„nur heute“ = Zeitfalle", /zeitfalle/i.test(druckFinden("Das gilt nur heute, danach ist es weg.") ?? ""));
ok("„sonst … Inkasso“ = Drohkulisse", /droh/i.test(druckFinden("Zahlen Sie bitte, sonst geht das an das Inkasso.") ?? ""));
ok("„Wenn Sie nicht zahlen … Gericht“ = bedingte Drohung", /droh/i.test(druckFinden("Wenn Sie nicht zahlen, kommt das Gericht.") ?? ""));
ok("„… Gericht, wenn Sie nicht zahlen“ (umgekehrt) = bedingte Drohung", /droh/i.test(druckFinden("Dann kommt das Gericht, wenn Sie nicht zahlen.") ?? ""));
ok("„keine andere Wahl“ = Ausnutzen der Lage", /lage|wahl/i.test(druckFinden("Sie haben keine andere Wahl.") ?? ""));
ok("„letzte Chance“ = Druck", druckFinden("Das ist Ihre letzte Chance.") !== null);
ok("Rotprobe: der ruhige Ratensatz ist frei", druckFinden("Ganz entspannt: Wenn Sie heute überweisen, ist alles wieder im grünen Bereich. Passt heute, oder nennen Sie mir einen Tag?") === null);
ok("Rotprobe: „heute noch“ ohne „nur“ ist frei", druckFinden("Schaffen Sie die Überweisung heute noch?") === null);
ok("Sperrwunsch erkannt", sperrwunsch("Bitte rufen Sie mich nicht mehr an.") && sperrwunsch("Lassen Sie mich in Ruhe!"));
ok("Rotprobe: „rufen Sie mich morgen an“ ist kein Sperrwunsch", !sperrwunsch("Rufen Sie mich bitte morgen nochmal an."));
ok("Aufnahme-Ja erkannt („Ja, gerne“, „in Ordnung“)", istAufnahmeJa("Ja, gerne.") && istAufnahmeJa("Das ist in Ordnung."));
ok("Aufnahme-Nein erkannt („Nein, lieber nicht“)", istAufnahmeNein("Nein, lieber nicht.") && !istAufnahmeJa("Nein, lieber nicht."));
ok("Rotprobe: „Ja, aber nicht aufzeichnen“ ist KEIN Ja", !istAufnahmeJa("Ja, aber bitte nicht aufzeichnen."));
// Rauchtest 20.10.: „Ja, aber um was geht's dabei?“ auf die Aufnahme-Frage — ein Vorbehalt oder eine Gegenfrage ist kein klares Ja.
ok("Rotprobe: „Ja, aber um was geht's dabei?“ und „Ja?“ sind KEIN Ja (§ 201 StGB: nur ein klares Ja)", !istAufnahmeJa("Ja, aber um was geht's dabei?") && !istAufnahmeJa("Ja?") && istAufnahmeJa("Ja klar.") && istAufnahmeJa("Mm … Ja"));

titel("7b. STUFENPLAN (hart, Koordination 20.10.): 0 nur Probe · 1 Test · 2 Leise · 3 Voll — immer das Engere aus Stufe und Schalter");
{
  const { STUFEN, stufenGrenzen, rateTagErlaubt, kundenAnrufeAn } = await import("../shared/fiaon-aras");
  const alle = { termin: true, willkommen: true, zuruf: true, stufe_a: true, rate: true, zusage: true, lead: true, stufe_b: true, rueckholung: true, auftrag: true } as any;
  const g0 = stufenGrenzen({ stufe: 0, parallel: 5, tagEuro: 300, spielarten: alle });
  ok("ROT-PROBE Stufe 0: keine Gesprächsart außer Probe, Gleichzeitig 0, Deckel 0 €, 0 je Tag — auch mit allen Schaltern an", ["termin", "willkommen", "zuruf", "stufe_a", "rate", "zusage", "lead", "auftrag"].every((x) => !g0.spielartErlaubt(x as any)) && g0.spielartErlaubt("probe") && g0.parallel === 0 && g0.tagEuro === 0 && g0.versucheJeTag === 0);
  ok("ROT-PROBE kundenAnrufeAn: Stufe 0 + an = nein; Stufe 1 + an = ja; Not-Aus = nein", !kundenAnrufeAn({ an: true, stufe: 0, notaus: false }) && kundenAnrufeAn({ an: true, stufe: 1, notaus: false }) && !kundenAnrufeAn({ an: true, stufe: 3, notaus: true }));
  const g1 = stufenGrenzen({ stufe: 1, parallel: 3, tagEuro: 60, spielarten: alle });
  ok("Stufe 1 (Go-live): 40 je Tag, Gleichzeitig 1, Deckel 20 €, nur Termin/Willkommen/Auftrag/Stufe A/Rate", g1.versucheJeTag === 40 && g1.parallel === 1 && g1.tagEuro === 20 && ["termin", "willkommen", "auftrag", "stufe_a", "rate"].every((x) => g1.spielartErlaubt(x as any)) && !g1.spielartErlaubt("zuruf") && !g1.spielartErlaubt("zusage"));
  // Go-live C (Koordination 20.10.2026): „Rate offen“ zu JEDER überfälligen Rate, Tag 1–45 — danach übernimmt das Team.
  // Justin 22.10.2026 („Stufe 2“): auch Stufe 2/3 nur überfällige Raten — „war am … fällig“ stimmt vor der Fälligkeit nicht.
  ok("Rate offen: Stufe 1–3 nur Tag 1–45 (nie heute/morgen fällig, nie Tag 46)", [1, 2, 3].every((st) => [1, 2, 3, 5, 20, 45].every((t) => rateTagErlaubt(st, t)) && !rateTagErlaubt(st, 0) && !rateTagErlaubt(st, -1) && !rateTagErlaubt(st, 46)) && !rateTagErlaubt(3, 60));
  const g2 = stufenGrenzen({ stufe: 2, parallel: 5, tagEuro: 300, spielarten: alle });
  ok("Stufe 2: 150 je Tag, Gleichzeitig 2, Deckel 60 € — nur mehr Menge (Zusage dazu), KEIN Zuruf, kein Lead (nur Vertragskunden)", g2.versucheJeTag === 150 && g2.parallel === 2 && g2.tagEuro === 60 && g2.spielartErlaubt("zusage") && !g2.spielartErlaubt("zuruf") && !g2.spielartErlaubt("lead"));
  const g3 = stufenGrenzen({ stufe: 3, parallel: 9, tagEuro: 999, spielarten: alle });
  ok("Stufe 3: 430 je Tag, Gleichzeitig höchstens 5, Deckel höchstens 150 € — nie mehr, auch wenn der Schalter mehr will", g3.versucheJeTag === 430 && g3.parallel === 5 && g3.tagEuro === 150 && STUFEN[3].zurufNurNachricht === false);
  // Justin 20.10.2026 („nur Vertragskunden“, jede Stufe): auch mit ALLEN Schaltern an bringt Stufe 2/3 nie eine Werbe-Gesprächsart
  {
    const { GESPERRTE_SPIELARTEN, GESPERRT_TEXT, einstellungPruefen, einstellungenAnwenden } = await import("../shared/fiaon-aras");
    const werbung = [2, 3].flatMap((st) => GESPERRTE_SPIELARTEN.filter((x) => stufenGrenzen({ stufe: st, parallel: 5, tagEuro: 300, spielarten: alle }).spielartErlaubt(x)).map((x) => `${st}:${x}`));
    ok("ROT-PROBE: Stufe 2 und 3 automatisch, alle Schalter an → 0 Werbe-Gesprächsarten (Zuruf, Lead, Stufe B, Rückholung)", werbung.length === 0 && [2, 3].every((st) => !STUFEN[st as 2 | 3].spielarten.some((x) => (GESPERRTE_SPIELARTEN as readonly string[]).includes(x))), werbung.join(", "));
    let wirft = false; try { einstellungPruefen("aras_spielarten", JSON.stringify({ zuruf: "an" })); } catch (err) { wirft = String((err as Error).message).includes(GESPERRT_TEXT); }
    const alt = einstellungenAnwenden({ aras_spielarten: JSON.stringify({ zuruf: "an", lead: "an", rate: "an", willkommen: "aus" }) });
    ok("ROT-PROBE: „zuruf: an“ lässt sich nicht speichern (gesperrt – nur Vertragskunden), und ein alter Wert mit „an“ bleibt beim Lesen aus — der Rest gilt", wirft && !alt.spielarten.zuruf && !alt.spielarten.lead && alt.spielarten.rate && !alt.spielarten.willkommen);
  }
  ok("Das Engere gilt: Schalter kleiner als die Stufe → der Schalter", stufenGrenzen({ stufe: 3, parallel: 2, tagEuro: 40, spielarten: alle }).parallel === 2 && stufenGrenzen({ stufe: 3, parallel: 2, tagEuro: 40, spielarten: alle }).tagEuro === 40);
  ok("Ausgeschaltete Spielart bleibt aus, auch in Stufe 3", !stufenGrenzen({ stufe: 3, parallel: 3, tagEuro: 60, spielarten: { ...alle, zuruf: false } }).spielartErlaubt("zuruf"));
  ok("Unsinnige Stufe (7, -1, „x“) → nie mehr als 3, nie weniger als 0", stufenGrenzen({ stufe: 7, parallel: 3, tagEuro: 60, spielarten: alle }).stufe === 3 && stufenGrenzen({ stufe: -1, parallel: 3, tagEuro: 60, spielarten: alle }).stufe === 0 && stufenGrenzen({ stufe: Number("x"), parallel: 3, tagEuro: 60, spielarten: alle }).stufe === 0);
}

titel("7c. STUFEN-AMPEL (Scheibe 3 Teil 2): Werte mit Rot-Probe, hoch nur nach 3/5 grünen Tagen, nie aus 0, nie über 3");
{
  const { tagesAmpel, stufenEntscheidung, tagAbgeschlossen, tagMinus, fensterTage } = await import("../shared/fiaon-aras-stufe");
  type TW = Parameters<typeof tagesAmpel>[0];
  const tag = (o: Partial<TW> = {}): TW => ({
    tag: "2026-10-10", stufe: 1, versuche: 20, gespraeche: 8,
    je: { rate: { versuche: 12, erreicht: 4, zahlungen48: 1 }, stufe_a: { versuche: 8, erreicht: 4, zahlungen48: 2 } },
    kostenEuro: 6, zahlungen48: 3, sekundenGespraeche: 8 * 180, abbrueche: 0, uebergaben: 1, pruefFehler: 0, ...o,
  });
  const gruen = tagesAmpel(tag());
  ok("Ein guter Tag ist grün (Erreicht ≥ 25 %, Zahlung ≥ 20/30 %, 2 € je Zahlung, 3 Minuten, wenig Übergaben)", gruen.farbe === "gruen", JSON.stringify(gruen.punkte.filter((x) => x.farbe !== "gruen")));
  ok("ROT-PROBE: zwei Abbrüche / „nicht mehr anrufen“ (≥ 3 %) → rot", tagesAmpel(tag({ abbrueche: 2 })).farbe === "rot");
  ok("Ein einzelner Abbruch ist noch nicht rot (erst ab zwei Fällen)", tagesAmpel(tag({ abbrueche: 1 })).farbe !== "rot");
  ok("ROT-PROBE: zwei harte Prüf-Fehler bei 8 Gesprächen (≥ 2 %) → rot", tagesAmpel(tag({ pruefFehler: 2 })).farbe === "rot");
  ok("E-409 (22.10.): ein einzelner harter Prüf-Fehler an einem kleinen Tag ist gelb, nicht rot (erst ab zwei Fällen, wie bei den Abbrüchen)", tagesAmpel(tag({ pruefFehler: 1 })).farbe === "gelb");
  ok("Gelb: Erreicht-Quote Rate unter 25 %", tagesAmpel(tag({ je: { rate: { versuche: 12, erreicht: 2, zahlungen48: 1 }, stufe_a: { versuche: 8, erreicht: 4, zahlungen48: 2 } } })).farbe === "gelb");
  ok("Gelb: Zahlung binnen 48 h bei Stufe A unter 30 %", tagesAmpel(tag({ je: { rate: { versuche: 12, erreicht: 4, zahlungen48: 1 }, stufe_a: { versuche: 8, erreicht: 4, zahlungen48: 1 } } })).farbe === "gelb");
  ok("Gelb: Übergaben ab 30 %", tagesAmpel(tag({ uebergaben: 3 })).farbe === "gelb");
  ok("Gelb: Kosten je Zahlung ab 8 €", tagesAmpel(tag({ kostenEuro: 30 })).farbe === "gelb");
  ok("Gelb: Minuten je Gespräch außerhalb 2–5", tagesAmpel(tag({ sekundenGespraeche: 8 * 30 })).farbe === "gelb");
  ok("Grau: ohne Kundenanrufe", tagesAmpel(tag({ versuche: 0, gespraeche: 0, je: {} })).farbe === "leer");
  ok("Zahlungen noch nicht messbar (jünger als 48 h) → grau, nicht gelb", tagesAmpel(tag({ zahlungen48: null, je: { rate: { versuche: 12, erreicht: 4, zahlungen48: null }, stufe_a: { versuche: 8, erreicht: 4, zahlungen48: null } } })).farbe === "gruen");
  ok("Fenster: je ein Abbruch an zwei Tagen → zusammen rot", tagesAmpel(tag({ abbrueche: 1 }), [tag({ abbrueche: 1 }), tag({ tag: "2026-10-09", abbrueche: 1 })]).farbe === "rot");
  const T = (n: number, farbe: "gruen" | "gelb" | "rot" | "leer", stufe = 1, abgeschlossen = true) => ({ tag: tagMinus("2026-10-20", n), stufe, farbe, versuche: farbe === "leer" ? 0 : 20, abgeschlossen });
  const frisch = [T(0, "gruen", 1, false), T(1, "gruen", 1, false), T(2, "gruen", 1, false)];
  ok("ROT-PROBE: Rot → eine Stufe zurück (2 → 1 und 1 → 0)", stufenEntscheidung({ stufe: 2, auto: true, rotJetzt: true, tage: [] }).neu === 1 && stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: true, tage: [] }).neu === 0);
  ok("3 grüne, abgeschlossene Tage in Stufe 1 → Stufe 2", stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: false, tage: [...frisch, T(3, "gruen"), T(4, "gruen"), T(5, "gruen")] }).neu === 2);
  ok("Zwei grüne reichen nicht; ein gelber Tag bricht die Folge", stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: false, tage: [...frisch, T(3, "gruen"), T(4, "gruen")] }).neu === null && stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: false, tage: [...frisch, T(3, "gruen"), T(4, "gelb"), T(5, "gruen"), T(6, "gruen")] }).neu === null);
  ok("Junge Tage (Zahlungen noch offen) zählen nicht mit", stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: false, tage: [T(0, "gruen", 1, false), T(1, "gruen", 1, false), T(2, "gruen", 1, false), T(3, "gruen")] }).neu === null);
  ok("Stufe 2 → 3 erst nach 5 grünen Tagen", stufenEntscheidung({ stufe: 2, auto: true, rotJetzt: false, tage: [3, 4, 5, 6].map((n) => T(n, "gruen", 2)) }).neu === null && stufenEntscheidung({ stufe: 2, auto: true, rotJetzt: false, tage: [3, 4, 5, 6, 7].map((n) => T(n, "gruen", 2)) }).neu === 3);
  ok("ROT-PROBE: nie aus Stufe 0 hoch — auch nach zehn grünen Tagen", stufenEntscheidung({ stufe: 0, auto: true, rotJetzt: false, tage: Array.from({ length: 10 }, (_, n) => T(n + 3, "gruen", 0)) }).neu === null);
  ok("ROT-PROBE: nie über 3 — auch nach zehn grünen Tagen in Stufe 3", stufenEntscheidung({ stufe: 3, auto: true, rotJetzt: false, tage: Array.from({ length: 10 }, (_, n) => T(n + 3, "gruen", 3)) }).neu === null);
  ok("Tage aus einer anderen Stufe zählen nicht", stufenEntscheidung({ stufe: 2, auto: true, rotJetzt: false, tage: [T(3, "gruen", 2), T(4, "gruen", 2), T(5, "gruen", 1), T(6, "gruen", 1), T(7, "gruen", 1)] }).neu === null);
  ok("Ein Tag ohne Anrufe (Sonntag) bricht die Folge nicht und zählt nicht", stufenEntscheidung({ stufe: 1, auto: true, rotJetzt: false, tage: [T(3, "gruen"), T(4, "leer"), T(5, "gruen"), T(6, "gruen")] }).neu === 2);
  ok("Automatik aus: weder hoch noch zurück", stufenEntscheidung({ stufe: 2, auto: false, rotJetzt: true, tage: [] }).neu === null && stufenEntscheidung({ stufe: 1, auto: false, rotJetzt: false, tage: [3, 4, 5].map((n) => T(n, "gruen")) }).neu === null);
  ok("Abgeschlossen = Tag + 3 ≤ heute; Fenster Stufe 1 drei Tage, sonst fünf", tagAbgeschlossen("2026-10-17", "2026-10-20") && !tagAbgeschlossen("2026-10-18", "2026-10-20") && fensterTage(1) === 3 && fensterTage(2) === 5 && fensterTage(3) === 5);
}

titel("8. EINSTELLUNGEN: VORGABE, GRENZE, ERLAUBNISLISTE");
ok("Jeder Schlüssel hat Vorgabe und Satz", Object.entries(ARAS_SCHLUESSEL).every(([, d]) => typeof d.vorgabe === "string" && d.satz.length > 0 && d.satz.length <= 120));
ok("Jede Vorgabe besteht ihre eigene Prüfung", Object.keys(ARAS_SCHLUESSEL).every((k) => { try { einstellungPruefen(k, ARAS_SCHLUESSEL[k].vorgabe); return true; } catch (e) { log(`        ${k}: ${(e as Error).message}`); return false; } }));
const wirft = (k: string, w: string) => { try { einstellungPruefen(k, w); return false; } catch { return true; } };
ok("aras_parallel 6 → wirft (Grenze 5)", wirft("aras_parallel", "6"));
ok("aras_tag_euro 301 → wirft (Grenze 300)", wirft("aras_tag_euro", "301"));
ok("aras_tag_euro 150 → ok", einstellungPruefen("aras_tag_euro", "150") === "150");
ok("aras_an „ja“ → „an“, „0“ → „aus“", einstellungPruefen("aras_an", "ja") === "an" && einstellungPruefen("aras_an", "0") === "aus");
ok("aras_an „vielleicht“ → wirft", wirft("aras_an", "vielleicht"));
ok("aras_adapter „retell“ → wirft", wirft("aras_adapter", "retell"));
ok("aras_stimme „eigene:warm-mann“ → ok, „alexa“ → wirft", einstellungPruefen("aras_stimme", "eigene:warm-mann") === "eigene:warm-mann" && wirft("aras_stimme", "alexa"));
ok("KI-Hinweis ohne „KI“/„digitale“ → wirft", wirft("aras_ki_hinweis_satz", "Guten Tag, hier ist Aras von FIAON."));
// Justins Test 20.10. (Anruf 6): EIN Satz, der fragt — „Ein kurzes Ja reicht.“ als Nachsatz klang wie Drängeln.
ok("Aufnahme-Frage als EIN Satz mit „?“ → ok", einstellungPruefen("aras_aufnahme_frage", "Darf ich aufzeichnen?") === "Darf ich aufzeichnen?");
ok("Aufnahme-Frage mit Nachsatz („… ? Ein kurzes Ja reicht.“) → wirft", wirft("aras_aufnahme_frage", "Darf ich aufzeichnen? Ein kurzes Ja reicht."));
ok("Aufnahme-Frage ohne Frage nach der Aufzeichnung → wirft", wirft("aras_aufnahme_frage", "Passt das für Sie?") && wirft("aras_aufnahme_frage", "Ich zeichne jetzt auf."));
ok("aras_zuhoeren: geduldig/normal/flott ok, „hektisch“ → wirft", einstellungPruefen("aras_zuhoeren", "flott") === "flott" && wirft("aras_zuhoeren", "hektisch"));
ok("Fenster mit „0“ → wirft; Sonntag nur als „7“ (Justin: änderbar), nie nach 21:00", wirft("aras_fenster", JSON.stringify({ verkauf: { "0": ["10:00", "12:00"] }, rate: {} })) && !wirft("aras_fenster", JSON.stringify({ verkauf: { "7": ["10:00", "12:00"] }, rate: {} })) && wirft("aras_fenster", JSON.stringify({ rate: { "1-6": ["09:30", "21:30"] } })));
ok("Fenster vor 08:00 → wirft", wirft("aras_fenster", JSON.stringify({ verkauf: { "1-5": ["07:00", "12:00"] }, rate: { "1-5": ["09:00", "19:00"] } })));
ok("Raten-Takte [3,10,20,25,30] (5 Werte) → wirft", wirft("aras_raten_takte", "[3,10,20,25,30]"));
ok("Probe-Nummer +1… → wirft, +49… → ok", wirft("aras_probe_nummer", "+12125551234") && einstellungPruefen("aras_probe_nummer", "+491701234567") === "+491701234567");
ok("Unbekannter Schlüssel → wirft", wirft("mara_aktion_an", "an"));
ok("Spielarten mit fremdem Namen → wirft", wirft("aras_spielarten", JSON.stringify({ kaltakquise: true })));
{
  const e = einstellungenAnwenden({});
  ok("Leere Tabelle → Vorgaben: aus, openai_live, juni, parallel 2, Deckel 60, Spielarten leise (Willkommen an, Zuruf aus)", !e.an && e.adapter === "openai_live" && e.stimme === "juni" && e.parallel === 2 && e.tagEuro === 60 && e.spielarten.willkommen
    && e.spielarten.termin && e.spielarten.rate && e.spielarten.zusage && e.spielarten.stufe_a && !e.spielarten.zuruf && e.spielarten.probe
    && !e.spielarten.lead && !e.spielarten.stufe_b && !e.spielarten.rueckholung && !e.spielarten.eingehend);
  const f = einstellungenAnwenden({ aras_parallel: "99", aras_an: "an", aras_ampel: JSON.stringify({ stufen: { zahlungslink_senden: "rot", aufnahme_starten: "rot" } }) });
  ok("Grenze beim Lesen: parallel 99 → Vorgabe 2; an → true", f.parallel === 2 && f.an);
  ok("Ampel: zahlungslink rot übernommen, feste Werkzeuge bleiben grün", f.ampel.zahlungslink_senden === "rot" && f.ampel.aufnahme_starten === "gruen");
}

titel("8b. HARTE TELEFON-REGELN (Nachbereitung ohne Aufnahme-Ja)");
{
  const sauber = [
    { t: 0, wer: "aras" as const, text: "Hallo, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette. Bin ich richtig bei Herrn Probe?" },
    { t: 4, wer: "kunde" as const, text: "Ja, am Apparat." },
    { t: 6, wer: "aras" as const, text: "Schön! Es geht um Ihre zweite Rate — schaffen Sie die Überweisung heute noch?" },
  ];
  const text = sauber.filter((z) => z.wer === "aras").map((z) => z.text).join("\n");
  const p = telefonRegeln(text, { kiHinweisSek: 2, aufnahmeJaSek: null, aufnahmeGestartetSek: null, aufnahmeNeinSek: 9, transkript: sauber });
  ok("sauberes Gespräch: kein harter Befund", !p.some((x) => x.schwere === "hart"), p.map((x) => x.regel).join(", "));
  ok("KI-Hinweis im Transkript erkannt", kiHinweisGesagt(sauber));
  const ohneKi = [{ t: 0, wer: "aras" as const, text: "Hallo, hier ist FIAON. Spreche ich mit Herrn Probe?" }, { t: 3, wer: "kunde" as const, text: "Ja." }];
  ok("Rotprobe: KI-Hinweis fehlt → hart", telefonRegeln(ohneKi[0].text, { transkript: ohneKi }).some((x) => x.regel === "ki_hinweis_fehlt"));
  ok("Rotprobe: KI-Hinweis nach 31 s → hart", telefonRegeln("", { kiHinweisSek: 31, transkript: sauber }).some((x) => x.regel === "ki_hinweis_spaet"));
  ok("Rotprobe: Aufnahme vor dem Ja → hart", telefonRegeln("", { kiHinweisSek: 2, aufnahmeGestartetSek: 5, aufnahmeJaSek: 8, transkript: sauber }).some((x) => x.regel === "aufnahme_vor_ja"));
  ok("Rotprobe: Aufnahme trotz Nein → hart", telefonRegeln("", { kiHinweisSek: 2, aufnahmeNeinSek: 5, aufnahmeGestartetSek: 9, aufnahmeJaSek: 4, transkript: sauber }).some((x) => x.regel === "aufnahme_trotz_nein"));
  const vorab = [{ t: 0, wer: "aras" as const, text: "Hallo, hier ist Aras, eine KI von FIAON. Ihre Rate über 59,99 Euro ist offen." }, { t: 5, wer: "kunde" as const, text: "Wer ist da?" }];
  ok("Rotprobe: Rate genannt vor der Identität → hart", anliegenVorIdentitaet(vorab) !== null && telefonRegeln(vorab[0].text, { kiHinweisSek: 1, transkript: vorab }).some((x) => x.regel === "anliegen_vor_identitaet"));
  ok("„Lastschrift“ erkannt, der Verbotssatz nicht", lastschriftFinden("Ich richte Ihnen eine Lastschrift ein.") !== null && lastschriftFinden("Eine Lastschrift gibt es bei uns nicht.") === null);
  ok("Rotprobe: Vertrag per Stimme → hart", vertragZusageFinden("Dann ist der Vertrag hiermit abgeschlossen.") !== null && telefonRegeln("Gut, dann sind wir uns einig.").some((x) => x.regel === "vertrag_zusage"));
  ok("Drohung über dieselbe Wortwand", telefonRegeln("Sonst geht das an das Inkasso und die SCHUFA.").some((x) => x.regel === "druck" || x.regel === "drohung"));
}

titel("8c. DER PLANER HÄLT SEINE VERSPRECHEN (Koordination 22.10.): Vorrang, Verteilung über den Tag, anderer Tagesabschnitt, Zusage-Pause");
{
  const { istVorrang, tagesFreigabe, mindestAbstandMs, tagesabschnitt, abschnittWahl, bankWerktag, zusagePause, zusageSchwelle, fensterAmWochentag, VERTEILUNG_VORLAUF } = await import("../shared/fiaon-aras");
  const F = FENSTER_VORGABE;
  ok("Vorrang: gebuchter Rückruf und Zusage-Nachfassen — Rate, Willkommen, Stufe A nicht", istVorrang("termin") && istVorrang("zusage") && !istVorrang("rate") && !istVorrang("willkommen") && !istVorrang("stufe_a"));
  ok("Fenster eines Wochentags: Mo–Sa 09:30–21:00, Sonntag keins", JSON.stringify(fensterAmWochentag(F, 4)) === JSON.stringify({ von: "09:30", bis: "21:00" }) && fensterAmWochentag(F, 7) === null);
  const fr = (s: string, deckel = 40, off = "+02:00") => tagesFreigabe({ deckel, jetzt: berlin(s, off), fenster: F });
  ok("Freigabe 40/Tag: 09:30 → 2 (Vorlauf), Mitte des Fensters (15:15) → 22, 20:59 → 40, nach 21:00 → 40, nie über den Deckel",
    fr("2026-10-22 09:30") === VERTEILUNG_VORLAUF && fr("2026-10-22 15:15") === 22 && fr("2026-10-22 20:59") === 40 && fr("2026-10-22 21:30") === 40, `${fr("2026-10-22 09:30")}/${fr("2026-10-22 15:15")}/${fr("2026-10-22 20:59")}`);
  ok("ROT-PROBE 22.10.: um 10:07 sind höchstens 4 von 40 frei (nicht alle 40 in 37 Minuten); vor dem Fenster nur der Vorlauf", fr("2026-10-22 10:07") === 4 && fr("2026-10-22 08:00") === 2, String(fr("2026-10-22 10:07")));
  ok("Sonntag (kein Fenster) → der Deckel (dann hält die Fenster-Wand); Stufe 3 (430) um 15:15 → 217", fr("2026-10-25 15:15", 40, "+01:00") === 40 && fr("2026-10-22 15:15", 430) === 217, `${fr("2026-10-25 15:15", 40, "+01:00")}/${fr("2026-10-22 15:15", 430)}`);
  const ab = mindestAbstandMs({ deckel: 40, jetzt: berlin("2026-10-22 12:00"), fenster: F });
  ok("Mindestabstand 40/Tag: 690 Minuten ÷ 40 ÷ 2 ≈ 8,6 Minuten (nach einer Pause höchstens doppelt so schnell wie gleichmäßig)", ab === 517_500, String(ab));
  ok("Tagesabschnitte: 11:59 Vormittag, 12:00 Mittag, 16:59 Mittag, 17:00 Abend", tagesabschnitt(berlin("2026-10-22 11:59")) === "vormittag" && tagesabschnitt(berlin("2026-10-22 12:00")) === "mittag" && tagesabschnitt(berlin("2026-10-22 16:59")) === "mittag" && tagesabschnitt(berlin("2026-10-22 17:00")) === "abend");
  const w = (letzter: string | null, jetzt: string, o: { fehl?: number; spielart?: Kandidat["spielart"]; fenster?: typeof F } = {}) =>
    abschnittWahl({ spielart: o.spielart ?? "rate", fehlFolge: o.fehl ?? 1, letzterVersuchAm: letzter ? berlin(letzter) : null, jetzt: berlin(jetzt), fenster: o.fenster ?? F });
  ok("ROT-PROBE (21./22.10.: dieselben Menschen zur fast gleichen Minute): gestern 09:35 nicht erreicht → heute 09:40 warten, 12:30 dran",
    w("2026-10-21 09:35", "2026-10-22 09:40") === "spaeter" && w("2026-10-21 09:35", "2026-10-22 12:30") === "jetzt");
  ok("Gestern 18:00 nicht erreicht → heute Vormittag dran; heute Abend nur notfalls (kein Abschnitt mehr übrig)", w("2026-10-21 18:00", "2026-10-22 10:00") === "jetzt" && w("2026-10-21 18:00", "2026-10-22 18:30") === "notfalls");
  ok("Endet das Fenster um 16:00, ist am Mittag kein anderer Abschnitt übrig → notfalls", w("2026-10-21 13:00", "2026-10-22 13:30", { fenster: { verkauf: { "1-6": ["09:30", "16:00"] }, rate: { "1-6": ["09:30", "16:00"] } } }) === "notfalls");
  ok("Erreicht (keine Fehlversuche), nie versucht, Rückruf mit Vorrang → sofort", w("2026-10-21 09:35", "2026-10-22 09:40", { fehl: 0 }) === "jetzt" && w(null, "2026-10-22 09:40") === "jetzt" && w("2026-10-21 09:35", "2026-10-22 09:40", { spielart: "termin" }) === "jetzt");
  ok("Bank-Werktag: Do 22.10. ja, Sa 24.10. nein, Fr 25.12. (Feiertag) nein", bankWerktag("2026-10-22") && !bankWerktag("2026-10-24") && !bankWerktag("2026-12-25"));
  const p = zusagePause("2026-10-21");
  ok("Zusage Mi 21.10. („zahle heute“): Pause bis einschließlich Fr 23.10., Rate-Anruf frühestens Sa 24.10.", p.bis === "2026-10-23" && p.wiederAb === "2026-10-24", JSON.stringify(p));
  ok("Zusage Do 24.12.: Weihnachten zählt nicht — Pause bis Di 29.12.", zusagePause("2026-12-24").bis === "2026-12-29", zusagePause("2026-12-24").bis);
  ok("ROT-PROBE 22.10.: die Zusage vom 21.10. pausiert noch (Schwelle 20.10.) — die vom Mo 19.10. nicht mehr (Pause bis 21.10.)", zusageSchwelle("2026-10-22") === "2026-10-20" && "2026-10-21" >= zusageSchwelle("2026-10-22") && "2026-10-19" < zusageSchwelle("2026-10-22") && zusagePause("2026-10-19").bis === "2026-10-21", zusageSchwelle("2026-10-22"));
  ok("Montag 26.10.: die Zusage vom Do 22.10. pausiert noch (bis 26.10.), die vom Mi 21.10. nicht; eine Zusage für nächste Woche immer", zusageSchwelle("2026-10-26") === "2026-10-22" && "2026-10-30" >= zusageSchwelle("2026-10-26"), zusageSchwelle("2026-10-26"));
}

titel("8d. SCHEIBE 3, KUNDEN MIT VERTRAG (Koordination 22.10.): Zusage nachfassen nach der Überweisungszeit, der ehrliche Satz, beste Uhrzeit");
{
  const { zusageNachfassTag, zusageNotiertSatz, rateFensterTag, abschnittWahlBeste, abschnittWahl, zusagePause } = await import("../shared/fiaon-aras");
  const F = FENSTER_VORGABE;
  ok("Nachfassen = erster Fenstertag ab wiederAb: Zusage Mi 21.10. → Sa 24.10., Do 22.10. → Di 27.10., Fr 23.10. → Mi 28.10.",
    zusageNachfassTag("2026-10-21", { fenster: F }) === "2026-10-24" && zusageNachfassTag("2026-10-22", { fenster: F }) === "2026-10-27" && zusageNachfassTag("2026-10-23", { fenster: F }) === "2026-10-28");
  ok("ROT-PROBE (alte Regel „am Tag danach“): Zusage 21.10. nie am 22.10. — während der Überweisungszeit ruft ARAS nicht", zusageNachfassTag("2026-10-21", { fenster: F }) > zusagePause("2026-10-21").bis);
  ok("Feiertag: wiederAb Fr 01.05.2026 (Tag der Arbeit) → Nachfassen Sa 02.05.; Sonntag ohne „7“ nie ein Fenstertag",
    zusageNachfassTag("2026-04-28", { fenster: F }) === "2026-05-02" && !rateFensterTag("2026-10-25", { fenster: F }));
  ok("Der Satz nach zahlungszusage_merken: „Notiert: Sie überweisen am 23.10. Falls bis 28.10. nichts angekommen ist, melde ich mich kurz.“",
    zusageNotiertSatz("2026-10-23") === "Notiert: Sie überweisen am 23.10. Falls bis 28.10. nichts angekommen ist, melde ich mich kurz.", zusageNotiertSatz("2026-10-23"));
  const b = (erreicht: string | null, jetzt: string, o: { spielart?: Kandidat["spielart"]; fenster?: typeof F; letzter?: string; fehl?: number } = {}) =>
    abschnittWahlBeste({ spielart: o.spielart ?? "rate", fehlFolge: o.fehl ?? 0, letzterVersuchAm: o.letzter ? berlin(o.letzter) : (erreicht ? berlin(erreicht) : null), erreichtAm: erreicht ? berlin(erreicht) : null, jetzt: berlin(jetzt), fenster: o.fenster ?? F });
  ok("Beste Uhrzeit: abends abgenommen → vormittags „später“, abends „jetzt“; vormittags abgenommen → mittags nur notfalls",
    b("2026-10-20 18:30", "2026-10-22 10:00").wahl === "spaeter" && b("2026-10-20 18:30", "2026-10-22 18:00").wahl === "jetzt" && b("2026-10-20 10:00", "2026-10-22 13:00").wahl === "notfalls");
  ok("ROT-PROBE Fenster/Vorrang: Samstag bis 14:00 → nie auf den Abend warten (notfalls); Zusage-Nachfassen geht immer sofort",
    b("2026-10-20 18:30", "2026-10-24 10:00", { fenster: { verkauf: { "6": ["09:30", "14:00"] }, rate: { "6": ["09:30", "14:00"] } } }).wahl === "notfalls" && b("2026-10-20 18:30", "2026-10-22 10:00", { spielart: "zusage" }).wahl === "jetzt");
  ok("Nie abgenommen → unverändert die Regel nach einem Fehlversuch (abschnittWahl)",
    b(null, "2026-10-22 09:40", { letzter: "2026-10-21 09:35", fehl: 1 }).wahl === abschnittWahl({ spielart: "rate", fehlFolge: 1, letzterVersuchAm: berlin("2026-10-21 09:35"), jetzt: berlin("2026-10-22 09:40"), fenster: F }));
}

titel("9. KATALOGE");
// E-458 (Justin 29.10.2026): dazu die Gesprächsarten „wunsch“ und „erinnerung“ und ihre zwei Werkzeuge (gespraech_buchen, gespraech_bestaetigen).
ok("16 Werkzeuge (14 + gespraech_buchen, gespraech_bestaetigen — E-458), 14 Spielarten (mit „wunsch“ und „erinnerung“)", WERKZEUGE.length === 16 && WERKZEUGE.includes("probe_feedback_merken") && WERKZEUGE.includes("aufgabe_fuer_justin") && WERKZEUGE.includes("gespraech_buchen") && WERKZEUGE.includes("gespraech_bestaetigen") && SPIELARTEN.length === 14 && SPIELARTEN.includes("willkommen") && SPIELARTEN.includes("wunsch") && SPIELARTEN.includes("erinnerung"));
ok("Ampel kennt jedes Werkzeug genau einmal", ARAS_AMPEL.length === WERKZEUGE.length && WERKZEUGE.every((w) => ARAS_AMPEL.filter((a) => a.key === w).length === 1));
ok("Geld buchen / Erstattung / Storno / Kündigung sind KEIN Werkzeug", !(WERKZEUGE as readonly string[]).some((w) => /^(geld_buchen|erstattung|raten_storno|kuendigung_buchen|vertrag_schliessen|lastschrift)/.test(w)));
ok("Werbe-Spielarten brauchen Einwilligung, Vertragssache nicht", istWerbeSpielart("zuruf") && istWerbeSpielart("lead") && !istWerbeSpielart("rate") && !istWerbeSpielart("stufe_a") && RECHTSGRUND.zusage === "vertrag");
ok("Nummer → Land", nummerLand("+4917012345") === "DE" && nummerLand("+43664123") === "AT" && nummerLand("+4179123") === "CH" && nummerLand("+1212") === null);
ok("Kosten: 10 Min GPT-Live ≈ 46 Cent, Telefon 10 Min ≈ 43,7 Cent", Math.abs(stimmKostenCents("gpt-live-1", 600) - 46) < 1 && Math.abs(telefonKostenCents(600) - 43.7) < 0.2, `${stimmKostenCents("gpt-live-1", 600)} / ${telefonKostenCents(600)}`);

// ── E-458 (Justin 29.10.2026): „ARAS telefoniert nur noch die Termine oder die Leute die einen Anruf wollen“ ──────────
titel("10. E-458: ANRUF-WUNSCH UND ERINNERUNG — Regeln, Stufen, Fenster");
{
  const S = await import("../shared/fiaon-aras");
  // Der Stand der Produktion am 29.10.2026 (nur gelesen): Willkommen und Rate aus, Termin an — die neuen Arten fehlen im Wert.
  const prod = JSON.stringify({ termin: "an", willkommen: "aus", lead: "aus", zuruf: "aus", stufe_b: "aus", stufe_a: "aus", rate: "aus", zusage: "aus", rueckholung: "aus", auftrag: "aus", eingehend: "aus", probe: "an" });
  const e0 = S.einstellungenAnwenden({ aras_spielarten: prod, aras_stufe: "0" });
  const e1 = S.einstellungenAnwenden({ aras_spielarten: prod, aras_stufe: "1" });
  ok("Produktionswert: Anruf-Wunsch und Erinnerung gelten als an (Vorgabe), Willkommen und Rate bleiben aus, Zuruf gesperrt",
    e1.spielarten.wunsch && e1.spielarten.erinnerung && e1.spielarten.termin && !e1.spielarten.willkommen && !e1.spielarten.rate && !e1.spielarten.zuruf);
  const g0 = S.stufenGrenzen(e0), g1 = S.stufenGrenzen(e1);
  ok("Stufe 0: weder Anruf-Wunsch noch Erinnerung noch Termin (nur Probe) — Rot-Probe des Stufen-Tors", !g0.spielartErlaubt("wunsch") && !g0.spielartErlaubt("erinnerung") && !g0.spielartErlaubt("termin") && g0.spielartErlaubt("probe"));
  ok("Stufe 1: Termin, Anruf-Wunsch und Erinnerung erlaubt — Willkommen und Rate nicht (Schalter aus)", g1.spielartErlaubt("wunsch") && g1.spielartErlaubt("erinnerung") && g1.spielartErlaubt("termin") && !g1.spielartErlaubt("willkommen") && !g1.spielartErlaubt("rate"));
  let wirft = false; try { S.einstellungPruefen("aras_spielarten", JSON.stringify({ zuruf: "an" })); } catch { wirft = true; }
  ok("Rot-Probe: „Verkauf nach JA“ (zuruf) bleibt im Code gesperrt — auch per Einstellung nicht an", wirft && S.istGesperrteSpielart("zuruf") && !S.istGesperrteSpielart("wunsch") && !S.istGesperrteSpielart("erinnerung"));
  ok("Rechtsgrund: beide nur mit Einwilligung (Werbe-Wand), Priorität Erinnerung 1, Anruf-Wunsch 2",
    S.RECHTSGRUND.wunsch === "einwilligung" && S.RECHTSGRUND.erinnerung === "einwilligung" && S.istWerbeSpielart("wunsch") && S.PRIORITAET.erinnerung === 1 && S.PRIORITAET.wunsch === 2);
  ok("Firmen (Global): nur Anruf-Wunsch und Erinnerung — Rot-Probe: Rate, Termin, Willkommen bleiben für Firmen zu",
    S.globalErlaubt("wunsch") && S.globalErlaubt("erinnerung") && !S.globalErlaubt("rate") && !S.globalErlaubt("termin") && !S.globalErlaubt("willkommen"));
  ok("Schriftliches Ja: Antrag-Kästchen, WhatsApp, Mail, Meta — nicht „chef“ (mündlich), nicht „rueckruf_buchung“, nicht das Buchungs-Kästchen",
    (["antrag_kaestchen", "zuruf_whatsapp", "zuruf_mail", "meta_kaestchen"] as const).every((a) => S.WUNSCH_EINWILLIGUNGEN.includes(a))
    && !S.WUNSCH_EINWILLIGUNGEN.includes("chef") && !S.WUNSCH_EINWILLIGUNGEN.includes("rueckruf_buchung") && !S.WUNSCH_EINWILLIGUNGEN.includes("termin_kaestchen")
    && S.EINWILLIGUNG_ARTEN.includes("termin_kaestchen"));
  ok("Werkzeuge: Anruf-Wunsch ohne Zahltag und Ratenpause, Firma mit Erstgespräch, Erinnerung mit Bestätigen — nie ein Zahlungslink an Firmen",
    !S.WERKZEUGE_WUNSCH.includes("zahlungszusage_merken") && !S.WERKZEUGE_WUNSCH.includes("ratenpause_setzen") && S.WERKZEUGE_WUNSCH.includes("rueckruf_buchen")
    && S.WERKZEUGE_WUNSCH_GLOBAL.includes("gespraech_buchen") && !S.WERKZEUGE_WUNSCH_GLOBAL.includes("zahlungslink_senden")
    && S.WERKZEUGE_ERINNERUNG.includes("gespraech_bestaetigen") && !S.WERKZEUGE_ERINNERUNG.includes("zahlungslink_senden"));
  ok("Fenster: Anruf-Wunsch Sa 11:00 offen, So zu, Erinnerung Di 09:29 zu (Verkaufs-Fenster Mo–Sa 09:30–21:00)",
    fensterOffen("wunsch", "DE", berlin("2026-10-24 11:00")).offen && fensterOffen("wunsch", "DE", berlin("2026-10-25 11:00", "+01:00")).grund === "sonntag" && !fensterOffen("erinnerung", "DE", berlin("2026-10-20 09:29")).offen);

  // Erinnerung: zwischen drei Stunden und 30 Minuten vor dem Gespräch, im Fenster — sonst am Vortag 17–20 Uhr — sonst keine.
  const hm = (d: Date) => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tg = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const f14 = S.erinnerungFenster(berlin("2026-11-05 14:00", "+01:00"));
  ok("Gespräch Do 05.11. 14:00 → Anruf 11:00–13:30 am selben Tag", !!f14 && !f14.vortag && hm(f14.ab) === "11:00" && hm(f14.bis) === "13:30" && tg(f14.ab) === "2026-11-05", f14 ? `${tg(f14.ab)} ${hm(f14.ab)}–${hm(f14.bis)}` : "null");
  const f10 = S.erinnerungFenster(berlin("2026-11-06 10:00", "+01:00"));
  ok("Gespräch Fr 06.11. 10:00 (vor 09:30 bleibt kein Platz) → am Vortag 17:00–20:00", !!f10 && f10.vortag && tg(f10.ab) === "2026-11-05" && hm(f10.ab) === "17:00" && hm(f10.bis) === "20:00", f10 ? `${tg(f10.ab)} ${hm(f10.ab)}–${hm(f10.bis)}` : "null");
  const fSa = S.erinnerungFenster(berlin("2026-11-07 10:30", "+01:00"));
  ok("Gespräch Sa 07.11. 10:30 → 09:30–10:00 (die halbe Stunde im Fenster genügt)", !!fSa && !fSa.vortag && hm(fSa.ab) === "09:30" && hm(fSa.bis) === "10:00", fSa ? `${hm(fSa.ab)}–${hm(fSa.bis)}` : "null");
  ok("Rot-Probe: Gespräch Mo 09.11. 09:00 → kein Anruf (Vortag ist Sonntag) — dann erinnern nur die Mails", S.erinnerungFenster(berlin("2026-11-09 09:00", "+01:00")) === null);
  const fFt = S.erinnerungFenster(berlin("2026-12-25 15:00", "+01:00"));
  ok("Feiertag (25.12.): nie am Feiertag selbst — am Vortag abends", !!fFt && fFt.vortag && tg(fFt.ab) === "2026-12-24");
  ok("Sommerzeit: Gespräch Do 22.10. 14:00 (MESZ) → 11:00–13:30", (() => { const f = S.erinnerungFenster(berlin("2026-10-22 14:00")); return !!f && hm(f.ab) === "11:00" && hm(f.bis) === "13:30"; })());

  // Die reinen Regeln des Servers (fiaon-aras-wunsch.ts) — ohne Datenbank.
  const W = await import("../server/lib/fiaon-aras-wunsch");
  const F2 = S.FENSTER_VORGABE;
  const jetztDi = berlin("2026-11-03 10:00", "+01:00");
  const r1 = W.rueckrufFensterPruefen(berlin("2026-11-03 14:00", "+01:00"), berlin("2026-11-03 16:00", "+01:00"), F2, jetztDi);
  ok("Rückruf bei ARAS: Di 14–16 Uhr geht", r1.ok && hm(r1.von) === "14:00" && hm(r1.bis) === "16:00");
  const r2 = W.rueckrufFensterPruefen(berlin("2026-11-03 20:30", "+01:00"), berlin("2026-11-03 22:00", "+01:00"), F2, jetztDi);
  ok("Rückruf bei ARAS: 20:30–22:00 wird auf 20:30–21:00 gekürzt", r2.ok && hm(r2.bis) === "21:00");
  ok("Rot-Probe: Sonntag, zu kurz (20:45–22:00), zu lang (5 Stunden), über zwei Tage → nie eingetragen",
    !W.rueckrufFensterPruefen(berlin("2026-11-08 14:00", "+01:00"), berlin("2026-11-08 16:00", "+01:00"), F2, jetztDi).ok
    && !W.rueckrufFensterPruefen(berlin("2026-11-03 20:45", "+01:00"), berlin("2026-11-03 22:00", "+01:00"), F2, jetztDi).ok
    && !W.rueckrufFensterPruefen(berlin("2026-11-03 10:00", "+01:00"), berlin("2026-11-03 15:00", "+01:00"), F2, jetztDi).ok
    && !W.rueckrufFensterPruefen(berlin("2026-11-03 20:00", "+01:00"), berlin("2026-11-04 10:00", "+01:00"), F2, jetztDi).ok);
  ok("Maras Angebot muss ARAS als KI nennen — Rot-Probe: ohne KI-Hinweis oder nur ein Mensch zählt nicht",
    W.angebotNenntKi("Sehr gern! Unsere digitale Mitarbeiterin ARAS – eine KI – kann Sie heute zwischen 14 und 16 Uhr anrufen. Passt Ihnen das?")
    && !W.angebotNenntKi("Herr Stripling ruft Sie heute um 14 Uhr an.") && !W.angebotNenntKi("ARAS ruft Sie heute an.") && !W.angebotNenntKi(null));
  ok("So liest er das Fenster: „heute zwischen 14 und 16 Uhr“ / „morgen zwischen 9:30 und 11 Uhr“",
    W.fensterText(berlin("2026-11-03 14:00", "+01:00"), berlin("2026-11-03 16:00", "+01:00"), jetztDi) === "heute zwischen 14 und 16 Uhr"
    && W.fensterText(berlin("2026-11-04 09:30", "+01:00"), berlin("2026-11-04 11:00", "+01:00"), jetztDi) === "morgen zwischen 9:30 und 11 Uhr",
    W.fensterText(berlin("2026-11-04 09:30", "+01:00"), berlin("2026-11-04 11:00", "+01:00"), jetztDi));
  ok("Woher sein Ja kam, in Kundenworten (nie ein Systemwort)", W.wunschQuelleText("antrag_kaestchen") === "im Antrag" && W.wunschQuelleText("zuruf_whatsapp") === "per WhatsApp" && W.wunschQuelleText("zuruf_whatsapp", "mara_bei_aras") === "bei unserer Kollegin Mara");
  const nf = W.naechstesFenster(F2, berlin("2026-11-07 21:30", "+01:00"));
  ok("Nach Fensterende am Samstag: nächstes Fenster erst Montag 09:30 (Sonntag zu)", tg(nf.ab) === "2026-11-09" && hm(nf.ab) === "09:30" && hm(nf.bis) === "21:00", `${tg(nf.ab)} ${hm(nf.ab)}`);
}

log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
process.exit(schlecht === 0 ? 0 : 1);
