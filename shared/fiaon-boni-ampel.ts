// ═══════════════════════════════════════════════════════════════════════════
// DIE BONI-AMPEL — FIAONs eigene Einschätzung je Kunde (21.09.2026, E-202)
//
// Justin: „Füge bei JEDEM Kunden ein Ampel-System ein — bewertet die gesamte
// Bonität, d.h. die Adresse, Einkommen, Ausgaben, Schulden, SCHUFA selbst — so
// quasi unser eigenes BONI-Score-Verhältnis. JEDER Kunde soll eine Ampel haben
// (überwiegend positiv!)."
//
// WIE SIE RECHNET
// Fünf Teile mit je höchstens 20 Punkten, zusammen 100. Belegte Zahlen gehen
// vor Angaben aus dem Antrag: Das Einkommen aus dem ausgewerteten Kontoauszug
// schlägt die Zahl, die im Antrag getippt wurde; die offene Summe aus der
// gelesenen SCHUFA schlägt die Schulden-Angabe. Fehlt eine Angabe, zählt eine
// freundliche Annahme — ausdrücklich als „Annahme" markiert, damit niemand sie
// für einen Beleg hält.
//
// WARUM „ÜBERWIEGEND POSITIV" KEIN SCHÖNFÄRBEN IST
// Die Stufen heißen nach der ARBEIT, die ansteht (wie die SCHUFA-Ampel,
// E-174): „Gute Lage", „Machbar", „Erst aufräumen". Rot heißt nicht „kein
// Kunde", sondern „vor dem Antrag ist etwas zu tun — genau dafür ist FIAON
// da". Harte Befunde deckeln trotzdem: EIN harter Befund (dringende SCHUFA-
// Lage, mehr Ausgaben als Einnahmen, mehrere Rücklastschriften, über 15.000 €
// Schulden, unter 600 € Einkommen) lässt die Ampel nie auf Grün; ZWEI machen
// sie rot. Gemessen am 21.09.2026 an 5.628 echten Kunden: Nur mit Punkten gab
// es kein einziges Rot — eine Ampel ohne Rot sagt beim Problemfall nichts.
//
// WAS SIE NICHT IST
// Keine Kreditentscheidung und keine Auskunft über den Kunden an Dritte. Sie
// steuert die Arbeit im Haus. Wer sie je an eine Bank überträgt, klärt vorher
// Art. 22 DSGVO und § 31 BDSG (Scoring) — die Ampel ist dafür nicht gebaut.
// ═══════════════════════════════════════════════════════════════════════════

export type AmpelFarbe = "gruen" | "gelb" | "rot";
export type BoniTeilKey = "adresse" | "einkommen" | "ausgaben" | "schulden" | "schufa";
/** Woher die Zahl eines Teils stammt — vom stärksten Beleg zur Annahme. */
export type BoniQuelle = "schufa" | "kontoauszug" | "antrag" | "annahme";

export interface BoniEingang {
  /** Anschrift: je Feld, ob es gefüllt ist. */
  strasse: boolean;
  plz: boolean;
  ort: boolean;
  /** ISO-Land oder Freitext aus Antrag/Person („DE", „Deutschland" …). */
  land: string | null;
  /** „Zur Miete" | „Eigentum" | „Bei Familie" | „Sonstiges" | … (Antrag). */
  wohnform: string | null;
  /** „Angestellt" | „Beamter/in" | „Rentner/in" | „Selbstständig" | … (Antrag). */
  beschaeftigung: string | null;
  /** Beschäftigt seit — Freitext aus dem Antrag (JJJJ-MM, MM/JJJJ, JJJJ …). */
  beschaeftigtSeit: string | null;
  /** Monatliches Netto laut Antrag (Euro). */
  einkommenEuro: number | null;
  zusatzEinkommenEuro: number | null;
  /** Monatliche Miete laut Antrag (Euro). */
  mieteEuro: number | null;
  /** Summe der monatlichen Einzelausgaben laut Antrag (Euro, 0 = nicht angegeben). */
  ausgabenEuro: number | null;
  /** Schulden gesamt laut Antrag (Euro). */
  schuldenEuro: number | null;
  /** Ausgewerteter Kontoauszug (nur Status „fertig"). */
  konto: {
    gehaltCents: number | null;
    einnahmenCents: number | null;
    ausgabenCents: number | null;
    /** Länge des Zeitraums in Tagen (für die Umrechnung auf den Monat). */
    tage: number | null;
    dispoGenutzt: boolean;
    ruecklastschriften: number;
  } | null;
  /** Gelesene Bonitätsauskunft (nur Status „fertig"). */
  schufa: {
    ampel: "frei" | "aufraeumen" | "angreifbar" | "dringend" | string | null;
    summeOffenCents: number | null;
  } | null;
}

export interface BoniTeil {
  key: BoniTeilKey;
  label: string;
  /** 0–20 */
  punkte: number;
  quelle: BoniQuelle;
  /** Ein kurzer Satz: was dieser Teil sagt. */
  text: string;
}

export interface BoniAmpel {
  farbe: AmpelFarbe;
  /** 0–100 */
  punkte: number;
  /** „Gute Lage" | „Machbar" | „Erst aufräumen" */
  label: string;
  /** Was jetzt zu tun ist — ein Satz. */
  satz: string;
  teile: BoniTeil[];
  /** Wie viele Teile auf echten Angaben oder Belegen stehen (nicht auf Annahmen). */
  belegt: number;
  /** Warum die Farbe gedeckelt wurde — oder null. */
  deckel: string | null;
  /** Harte Befunde in Worten (leer, wenn keine). */
  befunde: string[];
  /** Höchstens ein Teil steht auf Angaben — die Ampel ist vor allem Annahme. */
  geschaetzt: boolean;
}

export const BONI_TEIL_LABEL: Record<BoniTeilKey, string> = {
  adresse: "Adresse",
  einkommen: "Einkommen",
  ausgaben: "Ausgaben",
  schulden: "Schulden",
  schufa: "SCHUFA",
};

export const BONI_QUELLE_TEXT: Record<BoniQuelle, string> = {
  schufa: "aus der SCHUFA",
  kontoauszug: "aus dem Kontoauszug",
  antrag: "aus dem Antrag",
  annahme: "Annahme",
};

export const BONI_FARBE: Record<AmpelFarbe, { label: string; satz: string }> = {
  gruen: { label: "Gute Lage", satz: "Die Angaben sprechen für den Antrag." },
  gelb: { label: "Machbar", satz: "Mit ein, zwei Schritten gut vorzubereiten." },
  rot: { label: "Erst aufräumen", satz: "Vor dem Antrag gibt es Arbeit — genau dafür ist FIAON da." },
};

/** Ab so vielen Punkten ist die Ampel grün bzw. gelb. */
export const BONI_GRENZE = { gruen: 68, gelb: 48 } as const;

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const positiv = (n: number | null | undefined): n is number => n != null && Number.isFinite(Number(n)) && Number(n) > 0;

function istDach(land: string | null): boolean {
  const l = String(land ?? "").trim().toLowerCase();
  return ["de", "at", "ch", "deutschland", "österreich", "oesterreich", "schweiz", "germany", "austria", "switzerland"].includes(l);
}

/** Monate seit „beschäftigt seit" — null, wenn nicht lesbar. */
export function monateSeit(wert: string | null, heute: Date = new Date()): number | null {
  const s = String(wert ?? "").trim();
  if (!s) return null;
  let jahr: number | null = null;
  let monat = 1;
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) { jahr = Number(m[1]); monat = Number(m[2]); }
  else if ((m = s.match(/^(\d{1,2})[./](\d{4})$/))) { monat = Number(m[1]); jahr = Number(m[2]); }
  else if ((m = s.match(/^\d{1,2}\.(\d{1,2})\.(\d{4})$/))) { monat = Number(m[1]); jahr = Number(m[2]); }
  else if ((m = s.match(/^(\d{4})$/))) { jahr = Number(m[1]); monat = 6; }
  if (jahr == null || jahr < 1950 || jahr > heute.getFullYear() + 1 || monat < 1 || monat > 12) return null;
  return Math.max(0, (heute.getFullYear() - jahr) * 12 + (heute.getMonth() + 1 - monat));
}

function adresseTeil(e: BoniEingang): BoniTeil {
  const vollstaendig = e.strasse && e.plz && e.ort;
  const teilweise = e.plz || e.ort || e.strasse;
  const w = String(e.wohnform ?? "").toLowerCase();
  const wohn = /eigentum/.test(w) ? 4 : /miete|rent/.test(w) ? 3 : /famil/.test(w) ? 3 : w ? 2 : 2;
  const punkte = (vollstaendig ? 12 : teilweise ? 8 : 5) + (istDach(e.land) ? 4 : e.land ? 2 : 3) + wohn;
  const quelle: BoniQuelle = vollstaendig || teilweise ? "antrag" : "annahme";
  // „Vollständige Anschrift im DACH-Raum, zur Miete." — ohne Anschrift steht
  // das Land für sich („Noch keine Anschrift, Land im DACH-Raum.").
  const dach = istDach(e.land);
  const teile = [
    vollstaendig ? `Vollständige Anschrift${dach ? " im DACH-Raum" : ""}` : teilweise ? "Anschrift unvollständig" : "Noch keine Anschrift",
    !vollstaendig && dach ? "Land im DACH-Raum" : null,
    /eigentum/.test(w) ? "Wohneigentum" : /miete|rent/.test(w) ? "zur Miete" : /famil/.test(w) ? "bei der Familie" : null,
  ].filter(Boolean);
  return { key: "adresse", label: BONI_TEIL_LABEL.adresse, punkte: Math.min(20, punkte), quelle, text: teile.join(", ") + "." };
}

/** Monatliche Beträge aus dem Kontoauszug (Summen über den Zeitraum → je Monat). */
function kontoJeMonat(k: NonNullable<BoniEingang["konto"]>): { ein: number | null; aus: number | null } {
  const monate = Math.max(1, (Number(k.tage) || 30) / 30.4);
  return {
    ein: positiv(k.einnahmenCents) ? Number(k.einnahmenCents) / 100 / monate : null,
    aus: positiv(k.ausgabenCents) ? Number(k.ausgabenCents) / 100 / monate : null,
  };
}

function einkommenTeil(e: BoniEingang): BoniTeil {
  const gehalt = e.konto && positiv(e.konto.gehaltCents) ? Number(e.konto.gehaltCents) / 100 : null;
  const antrag = positiv(e.einkommenEuro) ? Number(e.einkommenEuro) + (positiv(e.zusatzEinkommenEuro) ? Number(e.zusatzEinkommenEuro) : 0) : null;
  const betrag = gehalt ?? antrag;
  const quelle: BoniQuelle = gehalt != null ? "kontoauszug" : antrag != null ? "antrag" : "annahme";
  const stufe = betrag == null ? 10 : betrag >= 3000 ? 16 : betrag >= 2200 ? 14 : betrag >= 1600 ? 12 : betrag >= 1100 ? 10 : betrag >= 600 ? 7 : 5;
  const b = String(e.beschaeftigung ?? "").toLowerCase();
  const seit = monateSeit(e.beschaeftigtSeit);
  const fest = /beamt|rentner|pension/.test(b) ? 4
    : /angestellt|employed|arbeitnehm/.test(b) ? (seit == null || seit >= 12 ? 4 : 2)
      : /selbst|freiberuf/.test(b) ? (seit != null && seit >= 24 ? 3 : 2)
        : 2;
  const art = /beamt/.test(b) ? "verbeamtet" : /rentner|pension/.test(b) ? "Rente" : /angestellt|employed/.test(b) ? "angestellt"
    : /selbst/.test(b) ? "selbstständig" : /freiberuf/.test(b) ? "freiberuflich" : /student/.test(b) ? "im Studium" : null;
  const text = [
    betrag != null ? `${euro(betrag)} im Monat${gehalt != null ? " (Gehalt laut Kontoauszug)" : ""}` : "Noch keine Angabe zum Einkommen",
    art,
    seit != null && seit >= 12 ? `seit ${Math.floor(seit / 12)} ${Math.floor(seit / 12) === 1 ? "Jahr" : "Jahren"}` : null,
  ].filter(Boolean).join(", ");
  return { key: "einkommen", label: BONI_TEIL_LABEL.einkommen, punkte: Math.min(20, stufe + fest), quelle, text: text + "." };
}

function ausgabenTeil(e: BoniEingang): { teil: BoniTeil; mehrAusAlsEin: boolean } {
  // mehrAusAlsEin gilt nur BELEGT (Kontoauszug) — eine Antragsangabe ist dafür zu grob.
  if (e.konto) {
    const { ein, aus } = kontoJeMonat(e.konto);
    if (ein != null && aus != null) {
      const q = aus / ein;
      let punkte = q <= 0.7 ? 20 : q <= 0.85 ? 16 : q <= 1.0 ? 12 : 7;
      if (e.konto.ruecklastschriften > 0) punkte -= 4;
      if (e.konto.dispoGenutzt) punkte -= 2;
      const text = [
        `Im Monat ${euro(aus)} Ausgaben bei ${euro(ein)} Einnahmen`,
        e.konto.ruecklastschriften > 0 ? `${e.konto.ruecklastschriften} Rücklastschrift${e.konto.ruecklastschriften === 1 ? "" : "en"}` : null,
        e.konto.dispoGenutzt ? "Dispo genutzt" : null,
      ].filter(Boolean).join(", ");
      return { teil: { key: "ausgaben", label: BONI_TEIL_LABEL.ausgaben, punkte: Math.max(3, punkte), quelle: "kontoauszug", text: text + "." }, mehrAusAlsEin: q > 1.0 };
    }
  }
  const einkommen = positiv(e.einkommenEuro) ? Number(e.einkommenEuro) + (positiv(e.zusatzEinkommenEuro) ? Number(e.zusatzEinkommenEuro) : 0) : null;
  const fest = (positiv(e.mieteEuro) ? Number(e.mieteEuro) : 0) + (positiv(e.ausgabenEuro) ? Number(e.ausgabenEuro) : 0);
  if (einkommen != null && fest > 0) {
    const q = fest / einkommen;
    const punkte = q <= 0.5 ? 20 : q <= 0.7 ? 16 : q <= 0.9 ? 12 : q <= 1.0 ? 9 : 5;
    return {
      teil: { key: "ausgaben", label: BONI_TEIL_LABEL.ausgaben, punkte, quelle: "antrag", text: `Feste Kosten ${euro(fest)} im Monat — ${euro(Math.max(0, einkommen - fest))} bleiben frei.` },
      mehrAusAlsEin: false,
    };
  }
  return { teil: { key: "ausgaben", label: BONI_TEIL_LABEL.ausgaben, punkte: 13, quelle: "annahme", text: "Noch keine Angaben zu den festen Kosten." }, mehrAusAlsEin: false };
}

function schuldenTeil(e: BoniEingang): BoniTeil {
  const ausSchufa = e.schufa && e.schufa.summeOffenCents != null ? Number(e.schufa.summeOffenCents) / 100 : null;
  const antrag = e.schuldenEuro != null && Number.isFinite(Number(e.schuldenEuro)) ? Math.max(0, Number(e.schuldenEuro)) : null;
  const betrag = ausSchufa ?? antrag;
  const quelle: BoniQuelle = ausSchufa != null ? "schufa" : antrag != null ? "antrag" : "annahme";
  const punkte = betrag == null ? 15 : betrag <= 0 ? 20 : betrag <= 1000 ? 17 : betrag <= 5000 ? 13 : betrag <= 15000 ? 9 : 5;
  const text = betrag == null ? "Noch keine Angabe zu Schulden."
    : betrag <= 0 ? `Keine offenen Schulden${ausSchufa != null ? " in der Auskunft" : " angegeben"}.`
      : `${euro(betrag)} offen${ausSchufa != null ? " laut Auskunft" : " laut Antrag"}.`;
  return { key: "schulden", label: BONI_TEIL_LABEL.schulden, punkte, quelle, text };
}

function schufaTeil(e: BoniEingang): { teil: BoniTeil; dringend: boolean } {
  const a = String(e.schufa?.ampel ?? "");
  if (!e.schufa || !a) {
    return { teil: { key: "schufa", label: BONI_TEIL_LABEL.schufa, punkte: 14, quelle: "annahme", text: "Noch keine Auskunft gelesen." }, dringend: false };
  }
  const tab: Record<string, [number, string]> = {
    frei: [20, "Nichts Belastendes in der Auskunft."],
    aufraeumen: [16, "Kleinigkeiten zum Aufräumen."],
    angreifbar: [12, "Einträge, gegen die sich etwas tun lässt."],
    dringend: [6, "Harte Einträge — zuerst aufräumen."],
  };
  const [punkte, text] = tab[a] ?? [12, "Auskunft gelesen."];
  return { teil: { key: "schufa", label: BONI_TEIL_LABEL.schufa, punkte, quelle: "schufa", text }, dringend: a === "dringend" };
}

/** Die harten Befunde — jeder für sich ein Grund, nicht auf Grün zu stehen. */
function harteBefunde(e: BoniEingang, mehrAusAlsEin: boolean, dringend: boolean): string[] {
  const befunde: string[] = [];
  if (dringend) befunde.push("harte Einträge in der SCHUFA");
  if (mehrAusAlsEin) befunde.push("mehr Ausgaben als Einnahmen im Kontoauszug");
  if (e.konto && e.konto.ruecklastschriften >= 2) befunde.push(`${e.konto.ruecklastschriften} Rücklastschriften`);
  const schulden = e.schufa && e.schufa.summeOffenCents != null ? Number(e.schufa.summeOffenCents) / 100 : e.schuldenEuro;
  if (schulden != null && Number(schulden) > 15000) befunde.push(`über 15.000 € Schulden`);
  const gehalt = e.konto && positiv(e.konto.gehaltCents) ? Number(e.konto.gehaltCents) / 100 : null;
  const einkommen = gehalt ?? (positiv(e.einkommenEuro) ? Number(e.einkommenEuro) + (positiv(e.zusatzEinkommenEuro) ? Number(e.zusatzEinkommenEuro) : 0) : null);
  if (einkommen != null && einkommen < 600) befunde.push("unter 600 € Einkommen im Monat");
  return befunde;
}

/** Die eine Rechnung. Gleiche Lage → gleiche Ampel. */
export function boniAmpel(e: BoniEingang): BoniAmpel {
  const adresse = adresseTeil(e);
  const einkommen = einkommenTeil(e);
  const { teil: ausgaben, mehrAusAlsEin } = ausgabenTeil(e);
  const schulden = schuldenTeil(e);
  const { teil: schufa, dringend } = schufaTeil(e);
  const teile = [adresse, einkommen, ausgaben, schulden, schufa];
  const punkte = teile.reduce((s, t) => s + t.punkte, 0);
  const befunde = harteBefunde(e, mehrAusAlsEin, dringend);
  let farbe: AmpelFarbe = punkte >= BONI_GRENZE.gruen ? "gruen" : punkte >= BONI_GRENZE.gelb ? "gelb" : "rot";
  let deckel: string | null = null;
  if (befunde.length >= 2 && farbe !== "rot") {
    farbe = "rot";
    deckel = `Zwei harte Befunde: ${befunde.join(", ")}.`;
  } else if (befunde.length === 1 && farbe === "gruen") {
    farbe = "gelb";
    deckel = `Ein harter Befund: ${befunde[0]} — deshalb nicht Grün.`;
  }
  const belegt = teile.filter((t) => t.quelle !== "annahme").length;
  return {
    farbe, punkte, label: BONI_FARBE[farbe].label, satz: BONI_FARBE[farbe].satz,
    teile, belegt, deckel, befunde, geschaetzt: belegt <= 1,
  };
}
