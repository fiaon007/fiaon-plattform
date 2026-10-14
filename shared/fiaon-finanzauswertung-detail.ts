// ═══════════════════════════════════════════════════════════════════════════
// DIE TIEFE DER FIAON FINANZ- UND BONITÄTSAUSWERTUNG (E-353, 14.10.2026)
//
// Justin: „Der Bonitätsauszug, den er durch uns bekommt, muss den Kunden 100 %
// analysieren, alle seine Ausgaben im Detail — Potenziale, Einnahmen, 100 %
// korrekt — am Ende muss der Auszug sein ganzes Leben widerspiegeln: wo gibt er
// wann wie viel aus und wie könnte man das optimieren … wenn jemand bei uns die
// Bonitätsauswertung kauft, bekommt er DAS Dokument.“ Und: Sie ERSETZT die
// Auskunft — „wir wissen es nicht, laden Sie hoch“ darf darin nicht stehen.
//
// Hier steht, was über die Kennzahlen hinaus gerechnet wird — alles aus den
// bereits maskierten Buchungen (Art. 9 DSGVO, art9Maskieren) und der
// Tiefenanalyse, dieselbe Rechnung wie „Kontoauszug im Detail“ in der Akte:
//   · detailAus()       jeder Posten je Gruppe, Einkommensquellen, größte
//                       Zahlungen, Monatsablauf, Wochentage, Kontostand, Tipps
//   · kennzahlenAus()   die Quoten gegen allgemeine Richtwerte (Faustregeln)
//   · bankblickAus()    die Haushaltsrechnung und die Merkmale, auf die eine Bank
//                       bei einer Kreditprüfung schaut (§ 505a BGB) — als
//                       Einordnung, keine Kreditwürdigkeitsprüfung
//   · jahresblickAus()  12 Monate heute vs. mit Plan, Rücklage-Ziel
// Nichts hier entscheidet über den Kunden; alles ist Rechnung, keine Prognose.
// ═══════════════════════════════════════════════════════════════════════════
import type { Tiefe, TiefeBuchung } from "./fiaon-kontoauszug-tiefe";

export const ART9_NAME_DETAIL = "Nicht ausgewiesen";

export interface DetailPosten {
  name: string; art: string; zweck: string; anzahl: number; typischCents: number; jeMonatCents: number; summeCents: number;
  rhythmus: string; tag: number | null; fest: boolean; aktiv: boolean;
}
export interface DetailGruppe {
  name: string; jeMonatCents: number; summeCents: number; anteil: number; anteilEinnahmen: number | null; fest: boolean;
  monate: { monat: string; cents: number }[]; posten: DetailPosten[];
}
export interface FaktenDetail {
  einkommen: { name: string; art: string; jeMonatCents: number; typischCents: number; anzahl: number; tag: number | null; rhythmus: string; ersteAm: string; letzteAm: string }[];
  weitere: { name: string; art: string; summeCents: number; jeMonatCents: number; anzahl: number }[];
  gruppen: DetailGruppe[];
  /** Art.-9-Buchungen: nur Anzahl und Summe, nie Empfänger. */
  verborgen: { anzahl: number; jeMonatCents: number } | null;
  groesste: { datum: string; name: string; art: string; betragCents: number }[];
  /** Ausgaben je Abschnitt des Monats (Tag 1–5, 6–10 …), im Schnitt je Monat. */
  monatsTeile: { label: string; von: number; bis: number; jeMonatCents: number; anteil: number }[];
  /** Ausgaben je Wochentag (Montag zuerst), im Schnitt je Woche. */
  wochentage: { tag: string; jeWocheCents: number; anteil: number }[];
  saldo: {
    tiefsterCents: number; tiefsterAm: string; hoechsterCents: number; schnittCents: number; tageUnterNull: number; endeCents: number | null; vorZahltagCents: number | null;
    /** Kontostand je Buchungstag (höchstens 90 Punkte, gleichmäßig ausgedünnt) — für die Linie im PDF. */
    verlauf: { datum: string; cents: number }[];
  } | null;
  tipps: { art: string; titel: string; text: string; jeMonatCents: number; vermeidbar: boolean; hinweis: boolean }[];
  umbuchungen: { einCents: number; ausCents: number };
}

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const TEILE: [number, number][] = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 31]];
const tagNr = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);

/** Die Tiefe in ein festes, druckbares Objekt — ohne Art.-9-Namen. */
export function detailAus(t: Tiefe, buchungen: TiefeBuchung[], einnahmenJeMonatCents: number): FaktenDetail {
  const versteckt = (n: string) => n === ART9_NAME_DETAIL;
  const ausgabenPosten = t.ausgaben.filter((p) => !versteckt(p.name));
  const verborgenPosten = t.ausgaben.filter((p) => versteckt(p.name));
  const gesamtAus = t.kennzahlen.ausgabenJeMonatCents || 1;

  const gruppen: DetailGruppe[] = t.gruppen
    .filter((g) => g.jeMonatCents > 0)
    .map((g) => {
      const posten = ausgabenPosten.filter((p) => p.gruppe === g.name)
        .map((p) => ({
          name: p.name, art: p.kategorieLabel, zweck: p.zweck ?? "", anzahl: p.anzahl, typischCents: p.typischCents, jeMonatCents: p.jeMonatCents,
          summeCents: p.summeCents, rhythmus: p.rhythmus, tag: p.tagImMonat, fest: p.fest, aktiv: p.aktiv,
        }))
        .sort((a, b) => b.summeCents - a.summeCents);
      return {
        name: g.name, jeMonatCents: g.jeMonatCents, summeCents: g.summeCents, anteil: g.jeMonatCents / gesamtAus,
        anteilEinnahmen: einnahmenJeMonatCents > 0 ? g.jeMonatCents / einnahmenJeMonatCents : null,
        fest: posten.length > 0 && posten.every((p) => p.fest),
        monate: t.zeitraum.monate.map((m) => ({ monat: m, cents: Math.round(g.monate[m] ?? 0) })),
        posten,
      };
    })
    .sort((a, b) => b.jeMonatCents - a.jeMonatCents);

  // Monatsablauf und Wochentage aus den Terminen der Ausgaben (Umbuchungen zählen nicht).
  const teile = TEILE.map(() => 0);
  const woche = WOCHENTAGE.map(() => 0);
  for (const p of t.ausgaben) {
    for (const z of p.termine ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(z.datum)) continue;
      const c = Math.abs(Number(z.betragCents) || 0);
      const tag = Number(z.datum.slice(8, 10));
      const i = TEILE.findIndex(([v, b]) => tag >= v && tag <= b);
      if (i >= 0) teile[i] += c;
      const wt = (new Date(`${z.datum}T12:00:00Z`).getUTCDay() + 6) % 7;
      woche[wt] += c;
    }
  }
  const faktor = Math.max(1, t.zeitraum.tage / 30.4375);
  const wochen = Math.max(1, t.zeitraum.tage / 7);
  const sumTeile = teile.reduce((s, x) => s + x, 0) || 1;
  const sumWoche = woche.reduce((s, x) => s + x, 0) || 1;

  // Kontostand je Tag: der letzte gedruckte Saldo eines Tages.
  const mitSaldo = buchungen.filter((b) => b.saldoDanachCents != null && Number.isFinite(Number(b.saldoDanachCents)) && /^\d{4}-\d{2}-\d{2}$/.test(b.datum));
  let saldo: FaktenDetail["saldo"] = null;
  if (mitSaldo.length >= 3) {
    const jeTag = new Map<string, number>();
    for (const b of mitSaldo) jeTag.set(b.datum, Number(b.saldoDanachCents));
    const tage = Array.from(jeTag.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let tief = tage[0], hoch = tage[0];
    for (const x of tage) { if (x[1] < tief[1]) tief = x; if (x[1] > hoch[1]) hoch = x; }
    // Durchschnitt über die Kalendertage (der Stand gilt bis zur nächsten Buchung).
    let summe = 0, n = 0, unter = 0;
    for (let i = 0; i < tage.length; i++) {
      const bisTag = i + 1 < tage.length ? tagNr(tage[i + 1][0]) : tagNr(tage[i][0]) + 1;
      const dauer = Math.max(1, bisTag - tagNr(tage[i][0]));
      summe += tage[i][1] * dauer; n += dauer;
      if (tage[i][1] < 0) unter += dauer;
    }
    // Stand kurz vor dem Zahltag: der Saldo am Tag vor dem Eingang des Einkommens, gemittelt.
    let vorZahltag: number | null = null;
    const zahltage = t.einkommen.flatMap((p) => (p.termine ?? []).map((z) => z.datum)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const vorher: number[] = [];
    for (const d of zahltage) {
      const davor = tage.filter(([tag]) => tag < d).pop();
      if (davor && tagNr(d) - tagNr(davor[0]) <= 10) vorher.push(davor[1]);
    }
    if (vorher.length) vorZahltag = Math.round(vorher.reduce((s, x) => s + x, 0) / vorher.length);
    const schritt = Math.max(1, Math.ceil(tage.length / 90));
    const verlauf = tage.filter((_, i) => i % schritt === 0 || i === tage.length - 1).map(([datum, cents]) => ({ datum, cents }));
    saldo = {
      tiefsterCents: tief[1], tiefsterAm: tief[0], hoechsterCents: hoch[1], schnittCents: Math.round(summe / Math.max(1, n)),
      tageUnterNull: unter, endeCents: tage[tage.length - 1][1], vorZahltagCents: vorZahltag, verlauf,
    };
  }

  return {
    einkommen: t.einkommen.map((p) => ({
      name: versteckt(p.name) ? "Einkommen (Absender nicht ausgewiesen)" : p.name, art: p.kategorieLabel, jeMonatCents: p.jeMonatCents, typischCents: p.typischCents,
      anzahl: p.anzahl, tag: p.tagImMonat, rhythmus: p.rhythmus, ersteAm: p.ersteAm, letzteAm: p.letzteAm,
    })).sort((a, b) => b.jeMonatCents - a.jeMonatCents),
    weitere: t.weitereEingaenge.filter((p) => !versteckt(p.name)).slice(0, 10)
      .map((p) => ({ name: p.name, art: p.kategorieLabel, summeCents: p.summeCents, jeMonatCents: p.jeMonatCents, anzahl: p.anzahl })),
    gruppen,
    verborgen: verborgenPosten.length
      ? { anzahl: verborgenPosten.reduce((s, p) => s + p.anzahl, 0), jeMonatCents: verborgenPosten.reduce((s, p) => s + p.jeMonatCents, 0) }
      : null,
    groesste: t.groessteZahlungen.filter((z) => !versteckt(z.name)).slice(0, 12)
      .map((z) => ({ datum: z.datum, name: z.name, art: z.kategorieLabel, betragCents: Math.abs(z.betragCents) })),
    monatsTeile: TEILE.map(([v, b], i) => ({ label: `${v}.–${b}.`, von: v, bis: b, jeMonatCents: Math.round(teile[i] / faktor), anteil: teile[i] / sumTeile })),
    wochentage: WOCHENTAGE.map((tag, i) => ({ tag, jeWocheCents: Math.round(woche[i] / wochen), anteil: woche[i] / sumWoche })),
    saldo,
    tipps: t.tipps.map((x) => ({ art: x.art, titel: x.titel, text: x.text, jeMonatCents: x.jeMonatCents, vermeidbar: x.vermeidbar, hinweis: x.hinweis })),
    umbuchungen: { einCents: t.kennzahlen.umbuchungenEinCents, ausCents: t.kennzahlen.umbuchungenAusCents },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// KENNZAHLEN GEGEN RICHTWERTE
// ───────────────────────────────────────────────────────────────────────────
// Allgemeine Faustregeln der Haushaltsführung (keine Norm, keine Statistik über
// den Kunden): Wohnkosten höchstens ein Drittel, feste Kosten höchstens die
// Hälfte, Sparen mindestens ein Zehntel der Einnahmen, Raten möglichst unter
// 15 %, Reserve von drei Monatsausgaben. Im PDF steht „Richtwert“ dabei.

export type KennStatus = "gut" | "beobachten" | "handeln" | "offen";
export interface Kennzahl { key: string; titel: string; wert: string; richtwert: string; status: KennStatus; satz: string }

interface KennEingang {
  einnahmenJeMonatCents: number; ausgabenJeMonatCents: number; festJeMonatCents: number; ueberschussJeMonatCents: number;
  ueberschussQuote: number; fixkostenQuote: number; ratenJeMonatCents: number; ratenQuote: number; bargeldQuote: number;
  detail?: FaktenDetail;
}

const prozent = (q: number) => `${Math.round(q * 100)} %`;
const euro = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;

export function kennzahlenAus(f: KennEingang): Kennzahl[] {
  const ein = f.einnahmenJeMonatCents;
  const quote = (c: number) => (ein > 0 ? c / ein : null);
  const gruppe = (...namen: string[]) => (f.detail?.gruppen ?? []).filter((g) => namen.includes(g.name)).reduce((s, g) => s + g.jeMonatCents, 0);
  const aus: Kennzahl[] = [];
  const add = (k: Kennzahl) => aus.push(k);

  const sq = ein > 0 ? f.ueberschussQuote : null;
  add({ key: "sparquote", titel: "Sparquote", wert: sq == null ? "—" : prozent(sq), richtwert: "mindestens 10 %",
    status: sq == null ? "offen" : sq >= 0.1 ? "gut" : sq >= 0 ? "beobachten" : "handeln",
    satz: sq == null ? "Ohne Einnahmen nicht berechenbar." : `Von jedem verdienten Euro bleiben ${Math.max(0, Math.round(sq * 100))} Cent übrig.` });
  const fq = quote(f.festJeMonatCents);
  add({ key: "fixkosten", titel: "Fixkostenquote", wert: fq == null ? "—" : prozent(fq), richtwert: "höchstens 50 %",
    status: fq == null ? "offen" : fq <= 0.5 ? "gut" : fq <= 0.65 ? "beobachten" : "handeln",
    satz: `${euro(f.festJeMonatCents)} gehen jeden Monat fest ab, bevor Sie etwas entscheiden können.` });
  const wohnen = gruppe("Wohnen", "Energie");
  const wq = quote(wohnen);
  if (wohnen > 0) add({ key: "wohnen", titel: "Wohnkosten (Miete + Energie)", wert: wq == null ? "—" : prozent(wq), richtwert: "höchstens ein Drittel",
    status: wq == null ? "offen" : wq <= 0.34 ? "gut" : wq <= 0.45 ? "beobachten" : "handeln", satz: `${euro(wohnen)} im Monat für Wohnen und Energie.` });
  const rq = f.ratenJeMonatCents > 0 ? quote(f.ratenJeMonatCents) : 0;
  add({ key: "raten", titel: "Raten und „Später bezahlen“", wert: rq == null ? "—" : prozent(rq), richtwert: "möglichst unter 15 %",
    status: rq == null ? "offen" : rq <= 0.15 ? "gut" : rq <= 0.35 ? "beobachten" : "handeln",
    satz: f.ratenJeMonatCents > 0 ? `${euro(f.ratenJeMonatCents)} im Monat sind an Raten gebunden.` : "Keine laufenden Raten — ein starkes Merkmal." });
  const leben = gruppe("Lebensmittel");
  if (leben > 0) {
    const lq = quote(leben);
    add({ key: "lebensmittel", titel: "Lebensmittel", wert: lq == null ? "—" : prozent(lq), richtwert: "rund 10–15 %",
      status: lq == null ? "offen" : lq <= 0.15 ? "gut" : lq <= 0.22 ? "beobachten" : "handeln", satz: `${euro(leben)} im Monat im Supermarkt und beim Bäcker.` });
  }
  const abos = gruppe("Abos & Medien", "Telefon & Internet");
  if (abos > 0) {
    const aq = quote(abos);
    add({ key: "abos", titel: "Abos, Medien, Telefon", wert: aq == null ? "—" : prozent(aq), richtwert: "höchstens 5 %",
      status: aq == null ? "offen" : aq <= 0.05 ? "gut" : aq <= 0.08 ? "beobachten" : "handeln", satz: `${euro(abos)} im Monat für Verträge, die sich oft ohne Verzicht senken lassen.` });
  }
  const gebuehren = gruppe("Gebühren");
  add({ key: "gebuehren", titel: "Bankgebühren und Zinsen", wert: `${euro(gebuehren)} / Monat`, richtwert: "0 € (vermeidbar)",
    status: gebuehren <= 0 ? "gut" : gebuehren <= 1500 ? "beobachten" : "handeln",
    satz: gebuehren > 0 ? `${euro(gebuehren * 12)} im Jahr für Kontoführung, Dispo oder Automaten.` : "Keine nennenswerten Bankgebühren." });
  add({ key: "bargeld", titel: "Bargeldanteil", wert: prozent(f.bargeldQuote), richtwert: "höchstens 15 %",
    status: f.bargeldQuote <= 0.15 ? "gut" : f.bargeldQuote <= 0.3 ? "beobachten" : "handeln",
    satz: f.bargeldQuote > 0.15 ? "Bargeld macht die Ausgaben unsichtbar — hier fehlt der Überblick." : "Ihre Ausgaben sind fast vollständig nachvollziehbar." });
  const reserveZiel = f.ausgabenJeMonatCents * 3;
  const stand = f.detail?.saldo?.schnittCents ?? null;
  add({ key: "reserve", titel: "Finanzielles Polster", wert: stand == null ? "nicht im Auszug" : `Ø ${euro(Math.max(0, stand))}`,
    richtwert: `3 Monatsausgaben (${euro(reserveZiel)})`,
    status: stand == null ? "offen" : stand >= reserveZiel ? "gut" : stand >= f.ausgabenJeMonatCents ? "beobachten" : "handeln",
    satz: stand == null ? "Der Auszug nennt keine Kontostände." : stand >= reserveZiel ? "Ihr Polster trägt auch einen unerwarteten Ausfall." : "Ein unerwarteter Ausfall träfe Sie heute ohne ausreichendes Polster." });
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// BANKBLICK: DIE HAUSHALTSRECHNUNG UND DIE MERKMALE EINER KREDITPRÜFUNG
// ───────────────────────────────────────────────────────────────────────────

export type MerkmalStand = "ok" | "hinweis" | "kritisch";
export interface Merkmal { titel: string; stand: MerkmalStand; satz: string }
export interface Bankblick {
  haushalt: { einnahmenCents: number; festOhneRatenCents: number; ratenCents: number; lebenshaltungCents: number; freiCents: number };
  merkmale: Merkmal[];
  urteil: { stufe: "gut" | "eingeschraenkt" | "schwierig"; titel: string; satz: string };
}

interface BankEingang extends KennEingang {
  variabelJeMonatCents: number; einkommenJeMonatCents: number; volleMonate: number; volleMonateMitEinkommen: number;
  ruecklastschriften: number; inkassoAnzahl: number; mahnAnzahl: number; pfaendungHinweis: boolean; gluecksspielAnzahl: number;
  dispoTage: number | null; tiefsterSaldoCents: number | null;
}

export function bankblickAus(f: BankEingang): Bankblick {
  const festOhneRaten = Math.max(0, f.festJeMonatCents - f.ratenJeMonatCents);
  const frei = f.einnahmenJeMonatCents - festOhneRaten - f.ratenJeMonatCents - f.variabelJeMonatCents;
  const m: Merkmal[] = [];
  const einkommenStetig = f.einkommenJeMonatCents > 0 && (f.volleMonate === 0 || f.volleMonateMitEinkommen >= f.volleMonate);
  m.push({ titel: "Regelmäßiges Einkommen", stand: f.einkommenJeMonatCents <= 0 ? "kritisch" : einkommenStetig ? "ok" : "hinweis",
    satz: f.einkommenJeMonatCents <= 0 ? "Im Auszug ist kein regelmäßiges Einkommen zu sehen." : einkommenStetig ? `Einkommen in jedem vollen Monat (${euro(f.einkommenJeMonatCents)} im Schnitt).` : "Das Einkommen kommt nicht in jedem Monat." });
  m.push({ titel: "Ausgaben gedeckt", stand: f.ueberschussJeMonatCents >= 0 ? "ok" : "kritisch",
    satz: f.ueberschussJeMonatCents >= 0 ? `Im Schnitt bleiben ${euro(f.ueberschussJeMonatCents)} im Monat übrig.` : `Im Schnitt fehlen ${euro(-f.ueberschussJeMonatCents)} im Monat.` });
  const dispo = f.dispoTage;
  m.push({ titel: "Kontoführung ohne Minus", stand: dispo == null ? "hinweis" : dispo === 0 ? "ok" : dispo <= 5 ? "hinweis" : "kritisch",
    satz: dispo == null ? "Der Auszug nennt keine Kontostände — nicht prüfbar." : dispo === 0 ? "Das Konto war durchgehend im Plus." : `Das Konto war an ${dispo} Tagen im Minus${f.tiefsterSaldoCents != null ? ` (tiefster Stand ${euro(f.tiefsterSaldoCents)})` : ""}.` });
  m.push({ titel: "Keine Rücklastschriften", stand: f.ruecklastschriften === 0 ? "ok" : f.ruecklastschriften === 1 ? "hinweis" : "kritisch",
    satz: f.ruecklastschriften === 0 ? "Jede Lastschrift wurde eingelöst." : `${f.ruecklastschriften} Lastschrift${f.ruecklastschriften === 1 ? "" : "en"} kam${f.ruecklastschriften === 1 ? "" : "en"} zurück.` });
  m.push({ titel: "Keine Inkasso- oder Mahnkosten", stand: f.inkassoAnzahl > 0 ? "kritisch" : f.mahnAnzahl > 0 ? "hinweis" : "ok",
    satz: f.inkassoAnzahl > 0 ? `${f.inkassoAnzahl} Zahlung${f.inkassoAnzahl === 1 ? "" : "en"} an ein Inkassounternehmen.` : f.mahnAnzahl > 0 ? `${f.mahnAnzahl} Mahn- oder Verzugsgebühr${f.mahnAnzahl === 1 ? "" : "en"}.` : "Keine Zahlung an Inkasso, keine Mahngebühr." });
  m.push({ titel: "Keine Hinweise auf Pfändung", stand: f.pfaendungHinweis ? "kritisch" : "ok",
    satz: f.pfaendungHinweis ? "Im Auszug stehen Hinweise auf eine Pfändung oder ein P-Konto." : "Keine Hinweise auf Pfändung oder P-Konto." });
  const rq = f.einnahmenJeMonatCents > 0 ? f.ratenJeMonatCents / f.einnahmenJeMonatCents : 0;
  m.push({ titel: "Tragbare Raten", stand: rq <= 0.15 ? "ok" : rq <= 0.35 ? "hinweis" : "kritisch",
    satz: f.ratenJeMonatCents <= 0 ? "Keine laufenden Raten." : `Raten binden ${Math.round(rq * 100)} % der Einnahmen.` });
  m.push({ titel: "Kein Glücksspiel", stand: f.gluecksspielAnzahl === 0 ? "ok" : f.gluecksspielAnzahl < 3 ? "hinweis" : "kritisch",
    satz: f.gluecksspielAnzahl === 0 ? "Keine Buchung für Glücksspiel oder Wetten." : `${f.gluecksspielAnzahl} Buchungen für Glücksspiel oder Wetten.` });
  m.push({ titel: "Freier Betrag nach Haushaltsrechnung", stand: frei >= 30_000 ? "ok" : frei >= 0 ? "hinweis" : "kritisch",
    satz: frei >= 0 ? `Nach allen Kosten bleiben ${euro(frei)} im Monat frei.` : `Die Haushaltsrechnung geht nicht auf: ${euro(-frei)} fehlen im Monat.` });

  const kritisch = m.filter((x) => x.stand === "kritisch").length;
  const hinweis = m.filter((x) => x.stand === "hinweis").length;
  const urteil: Bankblick["urteil"] = kritisch === 0 && hinweis <= 1
    ? { stufe: "gut", titel: "Aus Sicht einer Bank: gut aufgestellt", satz: "Ihr Kontoverlauf zeigt die Merkmale, auf die Banken bei einer Kreditprüfung besonders achten — stetiges Einkommen, gedeckte Ausgaben und eine saubere Kontoführung." }
    : kritisch <= 1
      ? { stufe: "eingeschraenkt", titel: "Aus Sicht einer Bank: mit Einschränkungen", satz: "Ihr Kontoverlauf trägt, zeigt aber Punkte, die eine Bank bei einer Kreditprüfung nachfragen würde. Die Schritte in Ihrem Plan setzen genau dort an." }
      : { stufe: "schwierig", titel: "Aus Sicht einer Bank: derzeit schwierig", satz: "Mehrere Merkmale sprechen heute gegen Sie. Das lässt sich ändern — die Sofort-Schritte in Ihrem Plan sind darauf ausgerichtet, diese Merkmale in den nächsten Monaten zu drehen." };
  return {
    haushalt: { einnahmenCents: f.einnahmenJeMonatCents, festOhneRatenCents: festOhneRaten, ratenCents: f.ratenJeMonatCents, lebenshaltungCents: f.variabelJeMonatCents, freiCents: frei },
    merkmale: m, urteil,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// JAHRESBLICK: 12 MONATE HEUTE UND MIT PLAN, RÜCKLAGE
// ───────────────────────────────────────────────────────────────────────────

export interface Jahresblick {
  einnahmenCents: number; ausgabenCents: number; heuteCents: number; mitPlanCents: number; planJeMonatCents: number;
  reserveZielCents: number; standCents: number; monateBisZiel: number | null;
}

export function jahresblickAus(f: KennEingang & { detail?: FaktenDetail }, spar: { vonCents: number; bisCents: number }): Jahresblick {
  const plan = Math.round((spar.vonCents + spar.bisCents) / 2);
  const proMonatMitPlan = f.ueberschussJeMonatCents + plan;
  const ziel = f.ausgabenJeMonatCents * 3;
  const stand = Math.max(0, f.detail?.saldo?.endeCents ?? 0);
  const fehlt = Math.max(0, ziel - stand);
  return {
    einnahmenCents: f.einnahmenJeMonatCents * 12, ausgabenCents: f.ausgabenJeMonatCents * 12,
    heuteCents: f.ueberschussJeMonatCents * 12, mitPlanCents: proMonatMitPlan * 12, planJeMonatCents: plan,
    reserveZielCents: ziel, standCents: stand, monateBisZiel: fehlt === 0 ? 0 : proMonatMitPlan > 0 ? Math.ceil(fehlt / proMonatMitPlan) : null,
  };
}
