// Prüfstand E-406 A (19.10.2026): „Heute dran“ — Reihenfolge, Fairness, Rückstau, Arbeitszeit 0. Rein, ohne Datenbank.
// Aufruf: node_modules/.bin/tsx scripts/pruef-heute-dran.ts
import {
  planen, stufeVon, zeileAus, vergleich, zusammenfassen, kapazitaet, arbeitsMinuten, zielErlaubt, kurzGrund,
  auftragGrund, rateGrund, berlinTag, HEUTE_DRAN_HOECHSTENS, leerSatz, KEIN_DRUCK_ZUSATZ,
  type HeuteEintrag, type HeuteZeile, type TeamMitglied, type TeamPlan,
} from "../shared/fiaon-heute-dran";

let gut = 0, schlecht = 0;
function ok(name: string, bed: boolean, info?: unknown) {
  if (bed) { gut++; console.log(`  ✓ ${name}`); }
  else { schlecht++; console.log(`  ✗ ${name}`, info !== undefined ? JSON.stringify(info) : ""); }
}

// Montag, 19.10.2026, 11:00 Berlin (= 09:00 UTC).
const JETZT = new Date("2026-10-19T09:00:00Z");
const vorStunden = (h: number) => new Date(JETZT.getTime() - h * 3_600_000).toISOString();
const vorTagen = (t: number) => vorStunden(t * 24);
const heuteUm = (hhmm: string) => new Date(`2026-10-19T${hhmm}:00+02:00`).toISOString();

let nr = 0;
function e(teil: Partial<HeuteEintrag> & Pick<HeuteEintrag, "quelle">): HeuteEintrag {
  nr++;
  return {
    schluessel: `${teil.quelle}:${nr}`, personId: 10_000 + nr, name: `Kunde ${nr}`, grund: "Grund", betragCents: null,
    ziel: `/agent/kunden?person=${10_000 + nr}`, zeit: null, seit: null, zustaendigId: 8, rolle: "vertrieb", erledigt: false,
    ...teil,
  };
}
const stufe = (x: HeuteEintrag) => stufeVon(x, JETZT);

console.log("1 · Stufen nach Wirkung");
ok("Termin heute → 1", stufe(e({ quelle: "termin", zeit: heuteUm("14:30") })) === 1);
ok("Termin morgen → nicht 1", stufe(e({ quelle: "termin", zeit: "2026-10-20T12:00:00Z" })) !== 1);
ok("Rückruf heute 23:30 Berlin (21:30 UTC) → 1", stufe(e({ quelle: "rueckruf", zeit: "2026-10-19T21:30:00Z" })) === 1);
ok("Rückruf 00:30 Berlin am Folgetag (22:30 UTC heute) → nicht 1 (Berliner Tag zählt)", stufe(e({ quelle: "rueckruf", zeit: "2026-10-19T22:30:00Z" })) !== 1);
ok("Rate heute fällig (0 Tage) → 2", stufe(e({ quelle: "inkasso", tageFaellig: 0 })) === 2);
ok("Rate seit 3 Tagen → 2", stufe(e({ quelle: "inkasso", tageFaellig: 3 })) === 2);
ok("Rate seit 4 Tagen → 6", stufe(e({ quelle: "inkasso", tageFaellig: 4 })) === 6);
ok("Rate seit 30 Tagen → 6", stufe(e({ quelle: "inkasso", tageFaellig: 30 })) === 6);
ok("Rate seit 31 Tagen → 7 (Altbestand unten)", stufe(e({ quelle: "inkasso", tageFaellig: 31 })) === 7);
ok("Zahlung gemeldet vor 71 h → 2", stufe(e({ quelle: "zahlung", seit: vorStunden(71) })) === 2);
ok("Zahlung gemeldet vor 73 h → 6", stufe(e({ quelle: "zahlung", seit: vorStunden(73) })) === 6);
ok("Auftrag mit Frist → 3", stufe(e({ quelle: "auftrag", frist: true })) === 3);
ok("Hitze frisch → 4", stufe(e({ quelle: "hitze", hitzeFrisch: true })) === 4);
ok("Hitze nicht frisch → 6", stufe(e({ quelle: "hitze", hitzeFrisch: false })) === 6);
ok("Bonität bezahlt → 5", stufe(e({ quelle: "bonitaet" })) === 5);
ok("KYC → 6", stufe(e({ quelle: "kyc" })) === 6);
// Nachbesserung (Prüfer-Fund 19.10.): Ein Kunde, der schon zu lange wartet, rutscht nicht nach unten — höchstens 14 Tage.
ok("Rückruf-Frist heute 10:55, jetzt 11:00 (vorbei) → bleibt 1", stufe(e({ quelle: "rueckruf", zeit: heuteUm("10:55") })) === 1);
ok("vereinbarter Rückruf gestern, nicht geführt → 1 (vorher 6)", stufe(e({ quelle: "rueckruf", zeit: "2026-10-18T13:00:00Z" })) === 1);
ok("Rückruf vor 14 Tagen (05.10.) → noch 1", stufe(e({ quelle: "rueckruf", zeit: "2026-10-05T07:00:00Z" })) === 1);
ok("Rückruf-Frist vor 15 Tagen (04.10.) → nicht 1 (keine Tagesarbeit mehr)", stufe(e({ quelle: "rueckruf", zeit: "2026-10-04T10:00:00Z" })) === 6);
ok("Anliegen → 6", stufe(e({ quelle: "anliegen" })) === 6);

console.log("2 · Reihenfolge innerhalb der Stufen");
const mix: HeuteEintrag[] = [
  e({ quelle: "inkasso", tageFaellig: 60, seit: vorTagen(60), schluessel: "alt60" }),
  e({ quelle: "kyc", seit: vorTagen(20), schluessel: "kyc20" }),
  e({ quelle: "auftrag", seit: vorTagen(1), schluessel: "auftrag1" }),
  e({ quelle: "bonitaet", seit: vorTagen(2), schluessel: "boni2" }),
  e({ quelle: "bonitaet", seit: vorTagen(9), schluessel: "boni9" }),
  e({ quelle: "hitze", hitzeFrisch: true, seit: vorStunden(5), schluessel: "hitze5h" }),
  e({ quelle: "auftrag", frist: true, seit: vorTagen(1), schluessel: "frist1" }),
  e({ quelle: "auftrag", frist: true, seit: vorTagen(6), schluessel: "frist6" }),
  e({ quelle: "zahlung", seit: vorStunden(10), schluessel: "zahl10h" }),
  e({ quelle: "inkasso", tageFaellig: 2, seit: vorTagen(2), schluessel: "rate2" }),
  e({ quelle: "termin", zeit: heuteUm("16:00"), schluessel: "termin16" }),
  e({ quelle: "rueckruf", zeit: heuteUm("10:15"), schluessel: "rueckruf1015" }),
];
const reihe = mix.map((x) => zeileAus(x, JETZT)).sort(vergleich).map((z) => z.schluessel);
const erwartet = ["rueckruf1015", "termin16", "zahl10h", "rate2", "frist1", "frist6", "hitze5h", "boni9", "boni2", "auftrag1", "kyc20", "alt60"];
ok("Uhrzeit → Geld frisch (frischeste zuerst) → Frist (frische zuerst) → A/B → Bonität (wartet am längsten) → Rest (frisch vor alt) → Altbestand",
  JSON.stringify(reihe) === JSON.stringify(erwartet), reihe);
{
  const ueber = [
    e({ quelle: "rueckruf", zeit: heuteUm("15:00"), schluessel: "heute15" }),
    e({ quelle: "rueckruf", zeit: "2026-10-17T08:00:00Z", schluessel: "seitSamstag" }),
    e({ quelle: "zahlung", seit: vorStunden(1), schluessel: "geld" }),
  ].map((x) => zeileAus(x, JETZT)).sort(vergleich).map((z) => z.schluessel);
  ok("überfälliges Versprechen steht vor den Uhrzeiten von heute und vor frischem Geld", JSON.stringify(ueber) === JSON.stringify(["seitSamstag", "heute15", "geld"]), ueber);
}

console.log("3 · Arbeitszeit und Tagesmenge");
ok("0 Min → 0", kapazitaet(0) === 0);
ok("negativ/NaN → 0", kapazitaet(-5) === 0 && kapazitaet(Number.NaN) === 0);
ok("8 Std → 25", kapazitaet(480) === HEUTE_DRAN_HOECHSTENS);
ok("10,5 Std → 25 (nie mehr)", kapazitaet(630) === 25);
ok("4 Std → 13", kapazitaet(240) === 13);
ok("1 Std → 4", kapazitaet(60) === 4);
ok("Fenster 10–12, 12:30–14:30, 15–20:30 → 570 Min",
  arbeitsMinuten([{ von: "10:00:00", bis: "12:00:00" }, { von: "12:30:00", bis: "14:30:00" }, { von: "15:00:00", bis: "20:30:00" }]) === 570);
ok("überlappende Fenster zählen einmal", arbeitsMinuten([{ von: "09:00", bis: "13:00" }, { von: "12:00", bis: "14:00" }]) === 300);
ok("kaputte Fenster zählen nicht", arbeitsMinuten([{ von: "14:00", bis: "13:00" }, { von: "x", bis: "12:00" }]) === 0);
ok("Abwesenheit bis 12:00: nur die Zeit danach zählt (9–17 → 300)", arbeitsMinuten([{ von: "09:00", bis: "17:00" }], 12 * 60) === 300);

console.log("4 · Eine Zeile je Kunde");
{
  const pid = 777;
  const zs = zusammenfassen([
    zeileAus(e({ quelle: "kyc", personId: pid, grund: "Ausweis prüfen", seit: vorTagen(3) }), JETZT),
    zeileAus(e({ quelle: "zahlung", personId: pid, grund: "Zahlung gemeldet", seit: vorStunden(5), betragCents: 5999 }), JETZT),
    zeileAus(e({ quelle: "auftrag", personId: pid, grund: "Kunde hat geschrieben", seit: vorTagen(1) }), JETZT),
  ]);
  ok("drei Gründe, eine Zeile", zs.length === 1, zs);
  ok("der wichtigste bleibt (Zahlung frisch)", zs[0]?.quelle === "zahlung");
  ok("die anderen stehen unter „weitere“", zs[0]?.weitere.includes("Ausweis prüfen") && zs[0]?.weitere.includes("Kunde hat geschrieben"), zs[0]?.weitere);
  const zs2 = zusammenfassen([
    zeileAus(e({ quelle: "inkasso", personId: 888, tageFaellig: 1, erledigt: true }), JETZT),
    zeileAus(e({ quelle: "inkasso", personId: 888, tageFaellig: 2 }), JETZT),
    zeileAus(e({ quelle: "auftrag", personId: 888, grund: "Kunde hat geschrieben" }), JETZT),
  ]);
  ok("heute schon bearbeitete Rate: der offene Inkasso-Eintrag zählt nicht mehr", zs2.filter((z) => z.quelle === "inkasso").length === 1 && zs2.find((z) => z.quelle === "inkasso")?.erledigt === true, zs2);
  ok("… ein anderer offener Grund desselben Kunden bleibt", zs2.some((z) => z.quelle === "auftrag" && !z.erledigt));
  const zs3 = zusammenfassen([
    zeileAus(e({ quelle: "anliegen", personId: 999, grund: "Anliegen: Adresse", erledigt: true }), JETZT),
    zeileAus(e({ quelle: "anliegen", personId: 999, grund: "Anliegen: Karte" }), JETZT),
  ]);
  const zs4 = zusammenfassen([
    zeileAus(e({ quelle: "zahlung", personId: 555, grund: "Zahlung gemeldet – Kunde anrufen", seit: vorStunden(3) }), JETZT),
    zeileAus(e({ quelle: "hitze", personId: 555, grund: "Zahlung gemeldet – anrufen", hitzeFrisch: true }), JETZT),
  ]);
  ok("derselbe Grund aus zwei Quellen steht nur einmal da", zs4.length === 1 && zs4[0].weitere.length === 0, zs4);
  ok("ein zweites offenes Anliegen bleibt, auch wenn das erste heute beantwortet ist", zs3.some((z) => !z.erledigt && z.grund === "Anliegen: Karte"), zs3);
}

console.log("5 · Fairness: Einträge ohne Zuständigen");
const TEAM: TeamMitglied[] = [
  { id: 8, name: "Leitung A", rolle: "vertriebsleiter", minuten: 600 },
  { id: 10, name: "Leitung B", rolle: "vertriebsleiter", minuten: 600 },
  { id: 13, name: "Leitung C (halber Tag)", rolle: "vertriebsleiter", minuten: 240 },
  { id: 505, name: "Mitarbeiter D", rolle: "agent", minuten: 600 },
  { id: 531, name: "Mitarbeiterin E (keine Zeit)", rolle: "agent", minuten: 0 },
];
const BETREIBER = [928, 929, 2];
{
  nr = 0;
  const eigene: HeuteEintrag[] = [
    ...Array.from({ length: 20 }, () => e({ quelle: "auftrag", zustaendigId: 8, seit: vorTagen(5) })),
    ...Array.from({ length: 2 }, () => e({ quelle: "auftrag", zustaendigId: 10, seit: vorTagen(5) })),
  ];
  const ohne = Array.from({ length: 12 }, (_, i) => e({ quelle: "kyc", zustaendigId: null, seit: vorTagen(i + 1) }));
  const beiJustin = [e({ quelle: "termin", zustaendigId: 928, zeit: heuteUm("15:00") }), e({ quelle: "auftrag", zustaendigId: 2 })];
  const gesperrt = [e({ quelle: "rueckruf", zustaendigId: 802, seit: vorTagen(40) })];
  const plan = planen([...eigene, ...ohne, ...beiJustin, ...gesperrt], TEAM, { jetzt: JETZT, betreiberIds: BETREIBER });
  const p = (id: number) => plan.personen.find((x) => x.agentId === id)!;
  const verteilt = (id: number) => [...p(id).offen, ...p(id).rueckstau].filter((z) => z.verteilt).length;
  ok("nie an einen Bonitätsmanager (Rolle agent)", verteilt(505) === 0 && verteilt(531) === 0, { d: verteilt(505), e: verteilt(531) });
  ok("nie an Justin/Testkonten: bleibt bei der Geschäftsführung (gezählt)", plan.beiGeschaeftsfuehrung === 2, plan.beiGeschaeftsfuehrung);
  ok("kein Eintrag von 928/2 auf einer Liste", plan.personen.every((x) => [...x.offen, ...x.rueckstau].every((z) => z.zustaendigId !== 928 && z.zustaendigId !== 2)));
  const a = verteilt(8), b = verteilt(10), c = verteilt(13);
  ok("alle 13 (12 ohne + 1 vom gesperrten Konto) verteilt", a + b + c === 13, { a, b, c });
  ok("die geringste Last je Platz bekommt mehr (B mit 2 eigenen > A mit 20 eigenen)", b > a, { a, b, c });
  ok("Last je Platz: C (halber Tag, 13 Plätze) bekommt weniger als B (25 Plätze)", c < b, { b, c });
  const lastJePlatz = (id: number) => (p(id).offen.length + p(id).rueckstau.length) / p(id).kapazitaet;
  ok("nach dem Verteilen liegen die Lasten je Platz eng beieinander (B ↔ C ≤ 0,1)", Math.abs(lastJePlatz(10) - lastJePlatz(13)) <= 0.1,
    { b: lastJePlatz(10), c: lastJePlatz(13) });
  ok("verteilte Einträge sind markiert", [...p(10).offen, ...p(10).rueckstau].some((z) => z.verteilt));
  ok("Inkasso ohne Zuständigen geht an die Rolle inkasso, wenn sie heute arbeitet",
    planen([e({ quelle: "inkasso", rolle: "inkasso", zustaendigId: null, tageFaellig: 1 })],
      [...TEAM, { id: 600, name: "Forderungen F", rolle: "inkasso", minuten: 300 }], { jetzt: JETZT }).personen.find((x) => x.agentId === 600)!.offen.length === 1);
  const keiner = planen([e({ quelle: "kyc", zustaendigId: null })], [{ id: 505, name: "D", rolle: "agent", minuten: 600 }], { jetzt: JETZT });
  ok("arbeitet niemand der Rolle, steht er unter „ohne Zuständigen“ (nicht verloren)", keiner.ohneZustaendigen.length === 1 && keiner.personen[0].offen.length === 0);
  const nachts = planen([e({ quelle: "kyc", zustaendigId: null })], [{ id: 8, name: "A", rolle: "vertriebsleiter", minuten: 0 }], { jetzt: JETZT });
  ok("wer heute keine Arbeitszeit hat, bekommt nichts dazu", nachts.ohneZustaendigen.length === 1 && nachts.personen[0].rueckstau.length === 0);
  const zweimal = planen([...eigene, ...ohne, ...beiJustin, ...gesperrt], TEAM, { jetzt: JETZT, betreiberIds: BETREIBER });
  ok("derselbe Stand gibt denselben Plan", JSON.stringify(zweimal) === JSON.stringify(plan));
}

console.log("6 · Rückstau");
{
  nr = 0;
  const viele = Array.from({ length: 40 }, (_, i) => e({ quelle: "auftrag", zustaendigId: 8, seit: vorTagen(i + 1) }));
  const plan = planen(viele, TEAM, { jetzt: JETZT });
  const a = plan.personen.find((x) => x.agentId === 8)!;
  ok("40 offen, voller Tag → 25 sichtbar", a.offen.length === 25, a.offen.length);
  ok("… 15 im Rückstau (nichts verloren)", a.rueckstau.length === 15 && a.zahlen.rueckstau === 15);
  ok("… Rückstau ist der weniger wichtige Teil (älteste)", a.rueckstau.every((r) => a.offen.every((o) => vergleich(o, r) < 0)));
  const mitErledigt = planen([...viele, ...Array.from({ length: 5 }, () => e({ quelle: "auftrag", zustaendigId: 8, erledigt: true }))], TEAM, { jetzt: JETZT });
  const a2 = mitErledigt.personen.find((x) => x.agentId === 8)!;
  ok("5 erledigt → 20 offen sichtbar, „5 von 25 erledigt“", a2.offen.length === 20 && a2.zahlen.erledigt === 5 && a2.zahlen.heuteDran === 25, a2.zahlen);
  ok("… Rückstau 20", a2.rueckstau.length === 20);
  const termine = Array.from({ length: 3 }, (_, i) => e({ quelle: "termin", zustaendigId: 8, zeit: heuteUm(`1${i + 4}:00`) }));
  const voll = planen([...viele, ...Array.from({ length: 25 }, () => e({ quelle: "auftrag", zustaendigId: 8, erledigt: true })), ...termine], TEAM, { jetzt: JETZT });
  const a3 = voll.personen.find((x) => x.agentId === 8)!;
  ok("Tagesmenge erreicht: Termine mit Uhrzeit heute stehen trotzdem drin", a3.offen.length === 3 && a3.offen.every((z) => z.quelle === "termin"), a3.offen.map((z) => z.quelle));
  const halb = planen(viele, [{ id: 13, name: "C", rolle: "vertriebsleiter", minuten: 240 }], { jetzt: JETZT });
  // Die Einträge gehören 8 (nicht im Team) → werden C zugeteilt; C hat 13 Plätze.
  ok("halber Tag → 13 sichtbar, Rest Rückstau", halb.personen[0].offen.length === 13 && halb.personen[0].rueckstau.length === 27, halb.personen[0].zahlen);
}

console.log("7 · Arbeitszeit 0 → leere Liste mit Hinweis");
{
  nr = 0;
  const plan = planen([e({ quelle: "auftrag", zustaendigId: 531 }), e({ quelle: "termin", zustaendigId: 531, zeit: heuteUm("15:00") })], TEAM, { jetzt: JETZT });
  const p = plan.personen.find((x) => x.agentId === 531)!;
  ok("Liste leer", p.offen.length === 0 && p.zahlen.heuteDran === 0);
  ok("Hinweis gesetzt", !!p.hinweis && /keine Arbeitszeit/.test(p.hinweis), p.hinweis);
  ok("der Auftrag ohne Frist steht in ihrem Rückstau (nicht verloren)", p.rueckstau.length === 1 && p.rueckstau[0].quelle === "auftrag", p.rueckstau);
  const weiter = plan.personen.flatMap((x) => x.offen).find((z) => z.quelle === "termin");
  ok("… der Termin heute geht an die Leitung (in Vertretung)", !!weiter && weiter.vertretungFuer === p.name && weiter.verteilt, weiter);
}

console.log("8 · Klickziele, Gründe");
ok("Akte erlaubt", zielErlaubt("/agent/kunden?person=12&auftrag=3"));
ok("Inkasso erlaubt", zielErlaubt("/agent/inkasso?person=12"));
ok("Chefbüro NIE", !zielErlaubt("/chef/s/team") && !zielErlaubt("/agent/../chef/s/x"));
ok("/chef/ in einem Agent-Pfad NIE", !zielErlaubt("/agent/x/chef/s/team"));
ok("fremde Seite NIE", !zielErlaubt("https://example.invalid/agent/kunden") && !zielErlaubt("//example.invalid/agent"));
ok("Grund höchstens 6 Wörter", kurzGrund("eins zwei drei vier fünf sechs sieben acht").split(" ").filter((w) => w !== "…").length === 6);
ok("Auftragsart → kurzer Grund", auftragGrund("kuendigung", "egal") === "Kündigung oder Widerruf bearbeiten");
ok("unbekannte Art → Titel ohne „Name:“-Vorspann, gekürzt", auftragGrund("xyz", "Max Probe: braucht heute jemanden wegen der Adresse und noch mehr") === "braucht heute jemanden wegen der Adresse …");
ok("rateGrund", rateGrund(0) === "Rate heute fällig" && rateGrund(1) === "Rate seit gestern offen" && rateGrund(12, 2) === "2 Raten seit 12 Tagen offen");
ok("berlinTag 22:30 UTC = nächster Berliner Tag", berlinTag("2026-10-19T22:30:00Z") === "2026-10-20");

console.log("10 · Nachbesserung: Erledigtes, das von allein kam, frisst keinen Platz");
{
  nr = 0;
  const flo: TeamMitglied[] = [{ id: 10, name: "Leitung B (halber Tag)", rolle: "vertriebsleiter", minuten: 240 }];
  const kuend = Array.from({ length: 5 }, (_, i) => e({ quelle: "auftrag", zustaendigId: 10, frist: true, art: "kuendigung", seit: vorTagen(i + 1) }));
  const bank = Array.from({ length: 13 }, () => e({ quelle: "inkasso", zustaendigId: 10, erledigt: true, vonAllein: true, grund: "Rate bezahlt" }));
  const a = planen([...kuend, ...bank], flo, { jetzt: JETZT }).personen[0];
  ok("13 Raten per Bank bezahlt + 5 Kündigungen (13 Plätze) → alle 5 Kündigungen sichtbar, Rückstau 0 (vorher 0 / 5)",
    a.kapazitaet === 13 && a.offen.length === 5 && a.rueckstau.length === 0, a.zahlen);
  ok("… die Bank-Zahlungen stehen trotzdem unter „erledigt“", a.erledigt.length === 13 && a.zahlen.erledigt === 13);
  const selbst = Array.from({ length: 13 }, () => e({ quelle: "auftrag", zustaendigId: 10, erledigt: true, grund: "Hinweis – erledigt" }));
  const b = planen([...kuend, ...selbst], flo, { jetzt: JETZT }).personen[0];
  ok("13 SELBST erledigt → Tagesmenge geschafft, die 5 warten im Rückstau", b.offen.length === 0 && b.rueckstau.length === 5, b.zahlen);
  const satz = leerSatz({ offen: b.offen.length, erledigt: b.zahlen.erledigt, rueckstau: b.zahlen.rueckstau }) ?? "";
  ok("… dann steht NICHT „Alles für heute erledigt“, sondern der Rückstau wird genannt", !/Alles für heute erledigt/.test(satz) && /Rückstau/.test(satz) && /5/.test(satz), satz);
  ok("„Alles erledigt“ nur, wenn auch der Rückstau leer ist", leerSatz({ offen: 0, erledigt: 4, rueckstau: 0 }) === "Alles für heute erledigt. Stark!");
  ok("offene Einträge → kein Leer-Satz", leerSatz({ offen: 2, erledigt: 4, rueckstau: 9 }) === null);
  const misch = zusammenfassen([
    zeileAus(e({ quelle: "inkasso", personId: 4242, erledigt: true, vonAllein: true, grund: "Rate bezahlt" }), JETZT),
    zeileAus(e({ quelle: "termin", personId: 4242, erledigt: true, grund: "Startgespräch geführt" }), JETZT),
  ]);
  ok("derselbe Kunde: Bank-Zahlung + selbst geführter Termin → eine Zeile, zählt als eigene Arbeit", misch.length === 1 && misch[0].vonAllein === false, misch);
}

console.log("11 · Nachbesserung: offene Kündigung/Beschwerde → kein Zahlungsdruck");
{
  nr = 0;
  const T2: TeamMitglied[] = [
    { id: 8, name: "Leitung A", rolle: "vertriebsleiter", minuten: 480 },
    { id: 10, name: "Leitung B", rolle: "vertriebsleiter", minuten: 480 },
  ];
  const pid = 31_337;
  const plan = planen([
    e({ quelle: "inkasso", personId: pid, zustaendigId: 8, tageFaellig: 1, grund: "Rate seit gestern offen", ziel: `/agent/inkasso?person=${pid}`, betragCents: 5999 }),
    e({ quelle: "auftrag", personId: pid, zustaendigId: 8, frist: true, art: "kuendigung", grund: "Kündigung oder Widerruf bearbeiten", ziel: `/agent/kunden?person=${pid}&auftrag=77` }),
  ], T2, { jetzt: JETZT });
  const z = plan.personen[0].offen.find((x) => x.personId === pid);
  ok("Rate (Geld frisch) + Kündigung beim selben Kunden → die Kündigung ist die Zeile (vorher: die Rate)", z?.quelle === "auftrag" && z.ziel.endsWith("&auftrag=77"), z);
  ok("… die Rate steht klein darunter: „erst klären, kein Druck“", !!z?.weitere.some((w) => w.startsWith("Rate seit gestern offen") && w.includes(KEIN_DRUCK_ZUSATZ)), z?.weitere);
  const pid2 = 31_338;
  const getrennt = planen([
    e({ quelle: "inkasso", personId: pid2, zustaendigId: 10, tageFaellig: 0, grund: "Rate heute fällig", ziel: `/agent/inkasso?person=${pid2}` }),
    e({ quelle: "auftrag", personId: pid2, zustaendigId: 8, frist: true, art: "mara_wa_heikel", grund: "WhatsApp: Kündigung oder Beschwerde" }),
  ], T2, { jetzt: JETZT });
  const r10 = getrennt.personen.find((x) => x.agentId === 10)!.offen.find((x) => x.personId === pid2);
  ok("Kündigung liegt bei einem Kollegen: die Rate rutscht nach hinten, Ziel ist die Akte, nicht das Inkasso",
    r10?.stufe === 6 && r10.ziel === `/agent/kunden?person=${pid2}` && r10.grund.includes(KEIN_DRUCK_ZUSATZ), r10);
  const pid3 = 31_339;
  const eskal = planen([
    e({ quelle: "inkasso", personId: pid3, zustaendigId: 8, tageFaellig: 1, grund: "Rate seit gestern offen" }),
    e({ quelle: "auftrag", personId: pid3, zustaendigId: 8, frist: true, art: "mara_eskalation", grund: "Zahlung verweigert – anrufen" }),
  ], T2, { jetzt: JETZT });
  ok("„Zahlung verweigert“ (Geld-Fall) stellt die Rate NICHT zurück", eskal.personen[0].offen.find((x) => x.personId === pid3)?.quelle === "inkasso");
  const pid4 = 31_340;
  const erledigtK = planen([
    e({ quelle: "inkasso", personId: pid4, zustaendigId: 8, tageFaellig: 1, grund: "Rate seit gestern offen" }),
    e({ quelle: "auftrag", personId: pid4, zustaendigId: 8, frist: true, art: "kuendigung", erledigt: true, grund: "Kündigung – erledigt" }),
  ], T2, { jetzt: JETZT });
  ok("Kündigung heute erledigt → die Rate ist wieder normale Arbeit (Stufe 2)", erledigtK.personen[0].offen.find((x) => x.personId === pid4)?.stufe === 2);
}

console.log("12 · Nachbesserung: Arbeitszeit 0 → Dringendes geht weiter");
{
  nr = 0;
  const T3: TeamMitglied[] = [
    { id: 8, name: "Leitung A", rolle: "vertriebsleiter", minuten: 480 },
    { id: 10, name: "Leitung B", rolle: "vertriebsleiter", minuten: 480 },
    { id: 13, name: "Kollege C (abwesend)", rolle: "agent", minuten: 0, vertreterId: 8 },
    { id: 531, name: "Kollegin E (keine Zeit)", rolle: "agent", minuten: 0 },
  ];
  const termin13 = e({ quelle: "termin", zustaendigId: 13, zeit: heuteUm("14:00"), grund: "Rückruf um 14:00 Uhr" });
  const global13 = e({ quelle: "termin", zustaendigId: 13, zeit: heuteUm("15:00"), grund: "FIAON Global", nieUmleiten: true });
  const kuend531 = e({ quelle: "auftrag", zustaendigId: 531, frist: true, art: "kuendigung", seit: vorTagen(20) });
  const normal531 = e({ quelle: "auftrag", zustaendigId: 531, seit: vorTagen(3) });
  const plan = planen([termin13, global13, kuend531, normal531], T3, { jetzt: JETZT });
  const p = (id: number) => plan.personen.find((x) => x.agentId === id)!;
  const t = p(8).offen.find((z) => z.schluessel === termin13.schluessel);
  ok("Abwesenheit: der Termin heute 14:00 des Abwesenden steht beim Vertreter (vorher: nur in seinem Rückstau)",
    !!t && t.vertretungFuer === "Kollege C (abwesend)" && t.verteilt, p(8).offen);
  ok("… Gründer-/Global-Termine nie in Vertretung (bleiben im Rückstau)", p(13).rueckstau.some((z) => z.schluessel === global13.schluessel));
  ok("… der Abwesende sieht: 1 abgegeben", p(13).weitergegeben === 1 && /jemand anderes/.test(p(13).hinweis ?? ""), p(13));
  const k = [...p(8).offen, ...p(10).offen].find((z) => z.schluessel === kuend531.schluessel);
  ok("keine Arbeitszeit, kein Vertreter: der Fristfall geht an die Leitung", !!k && k.vertretungFuer === "Kollegin E (keine Zeit)", k);
  ok("… der Auftrag ohne Frist bleibt in ihrem Rückstau", p(531).rueckstau.length === 1 && p(531).rueckstau[0].schluessel === normal531.schluessel && p(531).zahlen.dringend === 0);
  const gf = planen([termin13], [T3[0], { ...T3[2], vertreterId: 928 }], { jetzt: JETZT, betreiberIds: [928] });
  ok("Vertreter ist die Geschäftsführung: der Termin bleibt dort (gezählt), auf keiner Mitarbeiterliste",
    gf.beiGeschaeftsfuehrung === 1 && gf.personen.every((x) => x.offen.length === 0 && x.rueckstau.length === 0), gf);
  const niemand = planen([kuend531], [{ id: 531, name: "E", rolle: "agent", minuten: 0 }, { id: 8, name: "A", rolle: "vertriebsleiter", minuten: 0 }], { jetzt: JETZT });
  ok("arbeitet heute niemand der Rolle: bleibt im Rückstau, die Leitung sieht „1 dringend“",
    niemand.personen[0].rueckstau.length === 1 && niemand.personen[0].zahlen.dringend === 1, niemand.personen[0].zahlen);
}

console.log("9 · Rot-Probe (der Prüfstand erkennt einen Fehler)");
{
  // Eine umgedrehte Reihenfolge muss die Prüfung aus Abschnitt 2 brechen.
  const falsch = mix.map((x) => zeileAus(x, JETZT)).sort((a: HeuteZeile, b: HeuteZeile) => -vergleich(a, b)).map((z) => z.schluessel);
  ok("umgedrehte Reihenfolge wird erkannt", JSON.stringify(falsch) !== JSON.stringify(erwartet));
  // Ein Plan, der Justin bedient, muss auffallen.
  const schlechtPlan: TeamPlan = planen([e({ quelle: "kyc", zustaendigId: 928 })], [{ id: 928, name: "J", rolle: "vertriebsleiter", minuten: 480 }], { jetzt: JETZT });
  ok("ohne betreiberIds sähe 928 wie ein Mitglied aus — darum gibt der Server sie immer mit", schlechtPlan.personen[0].offen.length === 1);
}

console.log(`\n${gut} gut, ${schlecht} schlecht`);
process.exit(schlecht ? 1 : 0);
