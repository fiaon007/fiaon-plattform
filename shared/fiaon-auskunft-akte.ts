// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT IN DER AKTE — EINE QUELLE FÜR DIE STUFENSÄTZE
// (E-IT-D, 08.10.2026 — Punkt 4a des Team-Feedbacks)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// „Bei vielen Kunden steht die Bonitätsauskunft als ‚über FIAON beantragt‘ —
// in der Akte liegt sie aber nicht vor." Gemessen (nur lesend): 58 Menschen
// haben die Auskunft BEZAHLT, keiner hat sie bekommen. Die Kachel in der
// Mitarbeiter-Akte sagte trotzdem „fehlt noch – der Kunde lädt es in seinem
// Bereich hoch" (pipeline.tsx), die Betreiber-Akte kannte die Stufen schon
// (DokumenteSektion.tsx, eigene Sätze). Der grüne Haken „Bonitätsauskunft" im
// Reiter „Sein Antrag" war die EINWILLIGUNG in die Datenübermittlung
// (consent_schufa) — keine Bestellung. 272 Kunden ohne jede Bestellung sahen
// ihn grün.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Die Sätze je Stufe stehen hier, EINMAL. Beide Akten lesen sie (Mitarbeiter
// pipeline.tsx, Betreiber DokumenteSektion.tsx). Neutral formuliert (weder
// du noch Sie) — es sind Sätze für das Team, nie für den Kunden.
// Justin, 08.10.2026: Das Produkt für 74 € IST die Beschaffung der Datenkopie
// bei der Auskunftei (Art. 15 DSGVO) samt FIAON-Auswertung. Kein Satz hier
// oder in einer Kundenmail nennt sie „kostenlos" (Prüfstand pruef-it-d.ts).
// ═══════════════════════════════════════════════════════════════════════════

/** Der Haken im Reiter „Sein Antrag" (vorher „Bonitätsauskunft"). */
export const EINWILLIGUNG_DATENUEBERMITTLUNG = "Einwilligung Datenübermittlung";
/** Der Hinweis dazu (title) — damit niemand den Haken für eine Bestellung hält. */
export const EINWILLIGUNG_DATENUEBERMITTLUNG_HINWEIS =
  "Einwilligung in die Übermittlung der Daten für die Bonitätsprüfung (Pflicht-Haken im Antrag). Das ist KEINE Bestellung einer Bonitätsauskunft.";

export type AuskunftAkteStufe = "bezahlt" | "offen" | "dokument" | "nichts";
export type BeschaffungAkteStatus = "offen" | "in_arbeit" | "hochgeladen" | "fertig" | "problem";

/** Der Stand der Beschaffung, wie ihn der Server (dokumentStand → auskunft.beschaffung) liefert. */
export interface BeschaffungAkte {
  id: number;
  status: BeschaffungAkteStatus;
  /** Angelegt am (ISO). */
  seit: string;
  /** Ab wann beschafft werden darf (YYYY-MM-DD, Berlin). */
  faelligAb: string;
  /** einkauf | vollmacht | api | datenkopie */
  modus: string;
  /** Liegt eine Einwilligung vor, die diesen Weg deckt (Auftragsbestätigung, bei Datenkopie auch die Vollmacht)? */
  einwilligung: boolean;
  /** Wann der Link zur Auftragsbestätigung zuletzt rausging (ISO) — null = nie. */
  linkAm: string | null;
  bezahltAm: string | null;
  bearbeiter: string | null;
  notiz: string | null;
}

export interface AuskunftAkte {
  stufe: AuskunftAkteStufe;
  preisText: string;
  mitAbo: boolean;
  offen: { betragText: string; gemeldet: boolean } | null;
  wort: string;
  angebot?: boolean;
  ohneAngebot?: "werbesperre" | "paket_offen" | "kuerzlich_angeboten" | null;
  beschaffung?: BeschaffungAkte | null;
}

export const OHNE_ANGEBOT_TEXT: Record<string, string> = {
  werbesperre: "Werbesperre",
  paket_offen: "Paket noch nicht bezahlt",
  // Integration 25.09.2026 (E-240): die gemeinsame Bremse — ein Angebot je Kunde in drei Tagen.
  kuerzlich_angeboten: "in den letzten drei Tagen schon angeboten",
};

/**
 * Der Kalendertag in Berlin (YYYY-MM-DD) — aus einem Zeitpunkt (ISO/Date) oder unverändert aus einem Tag.
 * Nachprüfung 08.10.: `iso.slice(0, 10)` nahm den UTC-Tag; ein Link um 01:30 Uhr Berliner Zeit zählte
 * dann als Vortag, und zwischen 0 und 2 Uhr stand in der Akte der Vortag als „heute“.
 */
export function berlinTag(wert: string | Date | null | undefined): string {
  if (!wert) return "";
  if (typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert)) return wert;
  const d = wert instanceof Date ? wert : new Date(wert);
  if (isNaN(d.getTime())) return typeof wert === "string" ? wert.slice(0, 10) : "";
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

const tag = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
};

/** Der Lieferweg eines Auftrags in Worten. */
export function lieferwegWort(modus: string | null | undefined): string {
  switch (String(modus ?? "")) {
    case "datenkopie": return "Datenkopie (Art. 15 DSGVO), von FIAON angefordert";
    case "vollmacht": return "Anfrage per Vollmacht";
    case "api": return "Abruf über die Schnittstelle";
    default: return "Einkauf von Hand";
  }
}

/**
 * Die Zeile unter der Kachel „Bonitätsauskunft", wenn KEINE Datei vorliegt —
 * statt „fehlt noch – der Kunde lädt es hoch". Für jede Stufe ein ehrlicher Satz.
 * null = keine Aussage (z. B. ohne Auskunft-Stand).
 */
export function auskunftStufenSatz(a: AuskunftAkte | null | undefined, heuteIso?: string): string | null {
  if (!a) return null;
  if (a.stufe === "bezahlt") {
    const b = a.beschaffung ?? null;
    if (!b) return "Bezahlt — FIAON holt die Auskunft ein (noch kein Beschaffungsauftrag angelegt).";
    const bezahlt = b.bezahltAm ? `Bezahlt am ${tag(b.bezahltAm)}` : "Bezahlt";
    const weg = b.modus === "datenkopie" ? " — per Datenkopie (Art. 15 DSGVO)" : "";
    if (b.status === "problem") return `${bezahlt} — Beschaffungsauftrag #${b.id} mit Problem${b.notiz ? `: ${b.notiz}` : ""}.`;
    if (b.status === "hochgeladen") return `${bezahlt} — die Auskunft ist geliefert, die Mail an den Kunden fehlt noch (Auftrag #${b.id}).`;
    if (b.status === "fertig") return `${bezahlt} — geliefert (Auftrag #${b.id}).`;
    if (!b.einwilligung) {
      return `${bezahlt}${weg} — die Beschaffung wartet auf die Auftragsbestätigung des Kunden `
        + `(${b.linkAm ? `Link gesendet am ${tag(b.linkAm)}` : "Link noch nicht gesendet"}, Auftrag #${b.id}). Im Gespräch um die Bestätigung bitten.`;
    }
    const heute = heuteIso ?? berlinTag(new Date());
    if (b.faelligAb && b.faelligAb > heute) return `${bezahlt}${weg} — beschafft wird ab ${tag(b.faelligAb)} (Widerrufsfrist), Auftrag #${b.id}.`;
    return `${bezahlt}${weg} — Beschaffung offen seit ${tag(b.seit)}${b.status === "in_arbeit" && b.bearbeiter ? `, in Arbeit bei ${b.bearbeiter}` : ""} (Auftrag #${b.id}).`;
  }
  if (a.stufe === "offen" && a.offen?.gemeldet) return `Zahlung gemeldet (${a.offen.betragText}) — wird geprüft.`;
  if (a.stufe === "offen" && a.offen) {
    return `Bestellt, Zahlung offen (${a.offen.betragText})${a.ohneAngebot === "werbesperre" ? " — Werbesperre: die Mail nennt keinen Zahlungslink" : ""}.`;
  }
  // Die Auskunft liegt an einer anderen Bestellung derselben Person — deshalb kein Knopf.
  if (a.stufe === "dokument") return "Liegt an einer anderen Bestellung dieser Person vor.";
  if (a.stufe === "nichts" && a.angebot === false) {
    return `Nicht bestellt — der Kunde kann eine eigene Auskunft hochladen. Kein Angebot: ${OHNE_ANGEBOT_TEXT[String(a.ohneAngebot)] ?? "gesperrt"}.`;
  }
  if (a.stufe === "nichts") {
    return `Nicht bestellt — der Kunde kann eine eigene Auskunft hochladen, oder FIAON holt sie für ${a.preisText}${a.mitAbo ? " (mit Paket)" : " (einzeln)"}.`;
  }
  return null;
}

/** Kurzform für die kleine Zeile in der Betreiber-Akte (DokumenteSektion) — derselbe Inhalt. */
export function auskunftZeileKurz(a: AuskunftAkte | null | undefined, heuteIso?: string): string | null {
  return auskunftStufenSatz(a, heuteIso);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LIEGEZEIT-WACHE (E-IT-D, 08.10.2026)
//
// Befund der Gegenprüfung: Aufgaben mit Fälligkeit gab es — sie lagen
// ungelesen auf dem Betreiber-Brett, ohne Namen. Jetzt hat die Beschaffung
// eine BENANNTE Verantwortung (Einstellung im Mara-Steuerpult, Reiter
// Bonitätsauskunft → Beschaffung). Die Wache stellt ihr Aufgaben, wenn ein
// beschaffbarer Auftrag liegt, und dem Betreuer eine Anruf-Aufgabe, wenn der
// Kunde den Link zur Auftragsbestätigung nicht bestätigt.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein beschaffbarer Auftrag (Einwilligung da, fällig) darf so viele Werktage liegen, dann Aufgabe. */
export const LIEGEZEIT_WERKTAGE = 3;
/** … und nach so vielen Werktagen die zweite, dringende Stufe. */
export const LIEGEZEIT_WERKTAGE_ZWEITE = 10;
/** Link zur Auftragsbestätigung gesendet, nicht bestätigt — nach so vielen Werktagen ruft der Betreuer an. */
export const BESTAETIGUNG_ANRUF_WERKTAGE = 3;
/** Der Einstellungsschlüssel der verantwortlichen Person (Agent-Id). */
export const BESCHAFFUNG_VERANTWORTLICH_SCHLUESSEL = "auskunft_beschaffung_verantwortlich";

/** Werktage (Mo–Fr) zwischen zwei Tagen (YYYY-MM-DD), ohne den Starttag, mit dem Endtag. Feiertage zählen mit. */
export function werktageZwischen(vonIso: string, bisIso: string): number {
  const v = Date.UTC(Number(vonIso.slice(0, 4)), Number(vonIso.slice(5, 7)) - 1, Number(vonIso.slice(8, 10)));
  const b = Date.UTC(Number(bisIso.slice(0, 4)), Number(bisIso.slice(5, 7)) - 1, Number(bisIso.slice(8, 10)));
  if (!Number.isFinite(v) || !Number.isFinite(b) || b <= v) return 0;
  let n = 0;
  for (let t = v + 86_400_000; t <= b; t += 86_400_000) {
    const w = new Date(t).getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export type WacheStufe = "keine" | "aufgabe" | "dringend" | "anruf" | "link_fehlt";

/**
 * Was die Wache bei einem Auftrag tut — reine Regel, für Takt und Prüfstand.
 *   aufgabe   beschaffbar und seit ≥ 3 Werktagen fällig → Aufgabe an die Verantwortung
 *   dringend  dasselbe seit ≥ 10 Werktagen → zweite, dringende Aufgabe
 *   anruf     Link zur Auftragsbestätigung seit ≥ 3 Werktagen ohne Bestätigung → Betreuer ruft an
 *   link_fehlt  bezahlt, keine Einwilligung und der Link ging NIE raus (nie gesendet oder die Mail scheiterte),
 *             seit ≥ 3 Werktagen nach Anlage → Aufgabe an die Verantwortung (Nachprüfung 08.10.: genau so
 *             lag der Rückstand vom 29.09. — 56 von 61 Aufträgen — und die Wache sah ihn nicht)
 */
export function wacheStufe(a: {
  status: string; einwilligung: boolean; faelligAb: string; linkAm: string | null; bezahlt: boolean; dokumentDa: boolean;
  /** Angelegt am (ISO) — Bezug für „Link nie zugestellt“. Fehlt er, gilt die Fälligkeit. */
  angelegtAm?: string | null;
}, heuteIso: string): WacheStufe {
  if (!a.bezahlt || a.dokumentDa) return "keine";
  if (a.status !== "offen" && a.status !== "in_arbeit") return "keine";
  if (!a.einwilligung) {
    if (!a.linkAm) {
      const seit = berlinTag(a.angelegtAm || a.faelligAb);
      return seit && werktageZwischen(seit, heuteIso) >= LIEGEZEIT_WERKTAGE ? "link_fehlt" : "keine";
    }
    return werktageZwischen(berlinTag(a.linkAm), heuteIso) >= BESTAETIGUNG_ANRUF_WERKTAGE ? "anruf" : "keine";
  }
  if (a.faelligAb > heuteIso) return "keine";
  const wt = werktageZwischen(a.faelligAb, heuteIso);
  if (wt >= LIEGEZEIT_WERKTAGE_ZWEITE) return "dringend";
  if (wt >= LIEGEZEIT_WERKTAGE) return "aufgabe";
  return "keine";
}

/**
 * Der Rückstand-Satz in der Mail zur Auftragsbestätigung (Datenkopie-Weg).
 * Ohne „kostenlos" und ohne „kostenpflichtig": Die Leistung ist die Anforderung
 * der Datenkopie samt Auswertung — so steht es in der Bestätigung.
 */
export const RUECKSTAND_MAIL_SATZ =
  "Ihre Zahlung für die Bonitätsauskunft ist bei uns eingegangen — vielen Dank. Damit wir Ihre Auskunft (Ihre Datenkopie nach Art. 15 DSGVO) "
  + "in Ihrem Namen bei der Auskunftei anfordern dürfen, fehlt uns nur noch Ihre kurze Bestätigung. Bitte entschuldigen Sie, dass wir Sie erst jetzt darum bitten.";
