// ═══════════════════════════════════════════════════════════════════════════
// EINE STATUSWAHRHEIT — sieben Zustände, je genau ein Text
//
// DER SCHADEN, DEN DAS ABSTELLT
// Eine Agentin hielt einen Kunden für bezahlt, ein Kollege hatte den Gegenbeweis.
// Beide hatten recht — sie sahen verschiedene Texte für denselben Zustand. Der
// Titel lautete wörtlich „Antrag abgeschlossen, keine Zahlung": zwei Aussagen in
// einer Zeile, von denen die Oberfläche je nach Platz nur die erste zeigte.
//
// Dazu kamen NEUN eigene Übersetzungstabellen im Frontend (kunden-neu.tsx,
// vertrieb.tsx, meine-kunden.tsx, admin-kunde.tsx, admin-leads.tsx,
// admin-dubletten.tsx, Detailfenster.tsx, vertrieb-service.tsx, admin-kunden.tsx),
// jede mit eigenen Formulierungen: „Zahlung gemeldet" / „Zahlung angekündigt" /
// „Kunde sagt bezahlt" / „Angekündigt" für ein und denselben Zustand.
//
// DIE REGEL
// Das Wort „bezahlt" tragen AUSSCHLIESSLICH bankbestätigte Zahlungen. Wenn der
// Kunde selbst sagt, er habe überwiesen, heißt es „Kunde meldet Zahlung" — mit
// dem Zusatz „noch nicht bankbestätigt", der nie weggelassen werden darf.
//
// WARUM IN shared/ UND NICHT IM SERVER
// Server und Oberfläche brauchen dieselben Texte. Läge die Liste im Server,
// müsste das Frontend sie abschreiben — und genau daraus sind die neun Tabellen
// entstanden. `shared/` ist die einzige Stelle, die beide importieren können.
// ═══════════════════════════════════════════════════════════════════════════

export type KundenstatusSchluessel =
  | "lead"
  | "antrag_offen"
  | "rechnung_offen"
  | "zahlung_gemeldet"
  | "bezahlt"
  | "archiviert";

export interface KundenstatusText {
  /** Der EINE Text. Kurz genug für eine Tabellenzelle. */
  text: string;
  /**
   * Zusatz, der bei diesem Zustand NIE fehlen darf. Bei „Kunde meldet Zahlung"
   * ist das „noch nicht bankbestätigt" — ohne ihn liest jemand „Zahlung" und
   * hört auf zu prüfen.
   */
  zusatz: string | null;
  /** Was der Agent jetzt tun soll. Ein Satz, keine Anleitung. */
  hinweis: string;
  /** Farbrolle des Designsystems — kein Farbwert, damit Themen wechselbar bleiben. */
  ton: "neutral" | "offen" | "warnung" | "gut" | "still";
}

export const KUNDENSTATUS: Record<KundenstatusSchluessel, KundenstatusText> = {
  lead: {
    text: "Lead",
    zusatz: null,
    hinweis: "Erstkontakt: Interesse prüfen und zum Antrag führen.",
    ton: "neutral",
  },
  antrag_offen: {
    text: "Antrag offen",
    zusatz: null,
    hinweis: "Der Antrag ist angefangen, aber nicht fertig. Frag nach, wo es gehakt hat, und begleite bis zum Absenden.",
    ton: "offen",
  },
  rechnung_offen: {
    // Vorher „Antrag abgeschlossen, keine Zahlung" — zwei Aussagen in einer
    // Zeile. Jetzt sagt der Text, was zu tun ist: Es fehlt das Geld.
    text: "Antrag fertig — Rechnung offen",
    zusatz: null,
    hinweis: "Der Antrag ist durch, das Geld fehlt. Zahlungsdaten senden oder am Telefon durchgeben und ein Zahlungsdatum vereinbaren.",
    ton: "offen",
  },
  zahlung_gemeldet: {
    text: "Kunde meldet Zahlung",
    zusatz: "noch nicht bankbestätigt",
    hinweis: "Der Kunde sagt, er habe überwiesen — das Geld ist noch nicht auf dem Konto angekommen. Beleg erbitten und im Kontoabgleich prüfen.",
    ton: "warnung",
  },
  bezahlt: {
    text: "Bezahlt",
    zusatz: null,
    hinweis: "Das Geld ist bankbestätigt eingegangen. Der Kunde ist aus dem Vertrieb heraus und wird nicht mehr zur Zahlung aufgefordert.",
    ton: "gut",
  },
  archiviert: {
    text: "Archiviert",
    zusatz: null,
    hinweis: "Diese Bestellung gilt fachlich nicht (doppelt, Testeintrag oder widerrufen). Sie steht in keiner Arbeitsliste.",
    ton: "still",
  },
};

/** Das Etikett „Frist abgelaufen" — es tritt ZUSÄTZLICH zum Status auf, nie statt. */
export const ETIKETT_FRIST_ABGELAUFEN = "Frist abgelaufen";

export interface KundenstatusEingabe {
  /** payment_status der maßgeblichen Bestellung. Fehlt sie: nur Lead. */
  zahlungsstatus?: string | null;
  /** status der Bestellung (started/config/personal_data/… oder completed). */
  antragsstatus?: string | null;
  /** archived_at der Bestellung. */
  archiviertAm?: string | Date | null;
  /** payment_due_date — nur für das Etikett, nie für den Status. */
  frist?: string | Date | null;
  /** Hat die Person überhaupt eine Bestellung? */
  hatBestellung?: boolean;
}

/** Antragsschritte, die „noch nicht fertig" bedeuten. */
export const ABBRECHER_SCHRITTE = ["started", "config", "personal_data"];

export interface Kundenstatus extends KundenstatusText {
  schluessel: KundenstatusSchluessel;
  /** „Frist abgelaufen" oder null. Etikett, kein Zustand. */
  etikett: string | null;
  /** Fertige Zeile für Tabellen: Text plus Zusatz plus Etikett. */
  anzeige: string;
}

/**
 * Der Status einer Bestellung — die einzige Ableitung im Haus.
 *
 * Reihenfolge ist Absicht: Archiv schlägt alles (die Bestellung gilt nicht),
 * dann Geld (bezahlt), dann Meldung, dann Rechnung, dann Antrag.
 */
export function kundenstatus(ein: KundenstatusEingabe): Kundenstatus {
  const zahlung = String(ein.zahlungsstatus ?? "").trim();
  const antrag = String(ein.antragsstatus ?? "").trim();

  let schluessel: KundenstatusSchluessel;
  if (ein.archiviertAm) schluessel = "archiviert";
  else if (!ein.hatBestellung && !zahlung) schluessel = "lead";
  else if (zahlung === "paid") schluessel = "bezahlt";
  else if (zahlung === "claimed_paid") schluessel = "zahlung_gemeldet";
  else if (zahlung === "pending_payment" || zahlung === "expired") schluessel = "rechnung_offen";
  else if (zahlung === "refunded" || zahlung === "cancelled" || zahlung === "superseded") schluessel = "archiviert";
  else if (zahlung === "pending" && antrag && !ABBRECHER_SCHRITTE.includes(antrag)) schluessel = "rechnung_offen";
  else if (zahlung === "pending") schluessel = "antrag_offen";
  else schluessel = ein.hatBestellung ? "antrag_offen" : "lead";

  // Das Etikett hängt an der Frist, nicht am Zustand. Es gilt auch für den
  // Altbestand mit payment_status='expired' (dort wurde die Frist früher in den
  // Zustand geschrieben — siehe Teil A/Teil 0).
  const fristVorbei = zahlung === "expired"
    || (!!ein.frist && new Date(ein.frist).getTime() < Date.now()
        && (zahlung === "pending_payment" || zahlung === "claimed_paid"));
  const etikett = fristVorbei && schluessel !== "bezahlt" && schluessel !== "archiviert"
    ? ETIKETT_FRIST_ABGELAUFEN
    : null;

  const basis = KUNDENSTATUS[schluessel];
  const anzeige = [
    basis.text,
    basis.zusatz ? `(${basis.zusatz})` : null,
    etikett ? `· ${etikett}` : null,
  ].filter(Boolean).join(" ");

  return { ...basis, schluessel, etikett, anzeige };
}

/**
 * Übersetzung der alten `tier_reason`-Werte auf das neue Vokabular.
 *
 * Die Einstufung (`priority_tier`/`tier_reason`) bleibt, wie sie ist — sie steuert
 * die Reihenfolge der Anrufliste und hat sich bewährt. Nur ihre TEXTE kommen ab
 * jetzt von hier, damit es keine zweite Formulierung mehr gibt.
 */
export const TIER_GRUND_STATUS: Record<string, KundenstatusSchluessel> = {
  bezahlt: "bezahlt",
  zahlung_angekuendigt: "zahlung_gemeldet",
  rechnung_offen: "rechnung_offen",
  zahlungsfrist_abgelaufen: "rechnung_offen",
  antrag_abgeschlossen: "rechnung_offen",
  antrag_abgebrochen: "antrag_offen",
  nur_lead: "lead",
  ausgeschlossen: "archiviert",
};

/** Status aus einem `tier_reason` — für Listen, die nur die Einstufung haben. */
export function statusAusTierGrund(grund: unknown, opts: { fristAbgelaufen?: boolean } = {}): Kundenstatus {
  const schluessel = TIER_GRUND_STATUS[String(grund ?? "")] ?? "lead";
  const basis = KUNDENSTATUS[schluessel];
  // „zahlungsfrist_abgelaufen" ist im Kern eine offene Rechnung mit Etikett.
  const etikett = opts.fristAbgelaufen || String(grund) === "zahlungsfrist_abgelaufen"
    ? ETIKETT_FRIST_ABGELAUFEN
    : null;
  const anzeige = [
    basis.text,
    basis.zusatz ? `(${basis.zusatz})` : null,
    etikett ? `· ${etikett}` : null,
  ].filter(Boolean).join(" ");
  return { ...basis, schluessel, etikett, anzeige };
}

/**
 * P2/P11 (01.09.2026, Team-Feedback): `tier_reason` ist ARBEITSREIHENFOLGE,
 * keine Zahlungsaussage. Hat eine Person ein bezahltes Paket UND eine offene
 * Schwester-Bestellung (typisch die 74-€-Bonitätsauskunft), gewinnt in tier.ts
 * bewusst die offene — die Übersicht zeigte dann „nicht bezahlt", obwohl das
 * Paket längst bezahlt war. Dieser Helfer sagt BEIDES in einem Satz:
 * „Bezahlt: Paket · offen: Bonitätsauskunft — Kunde meldet Zahlung …".
 * Rein präsentational; tier.ts bleibt unangetastet (steuert Verteilung/Listen).
 */
export function statusMitZahlungswahrheit(
  grund: unknown,
  buchungen?: { bezahlt?: boolean; erledigt?: boolean; bezeichnung?: string }[] | null,
  opts: { fristAbgelaufen?: boolean } = {},
): string {
  const basis = statusAusTierGrund(grund, opts);
  const offen = (buchungen ?? []).filter((b) => !b?.erledigt);
  const bezahlte = offen.filter((b) => !!b?.bezahlt);
  if (bezahlte.length === 0 || basis.schluessel === "bezahlt") return basis.anzeige;
  const unbezahlte = offen.filter((b) => !b?.bezahlt);
  const kurz = (t: unknown) => String(t || "Bestellung").split("(")[0].trim();
  const bezahltText = bezahlte.map((b) => kurz(b.bezeichnung)).join(", ");
  if (unbezahlte.length === 0) return `Bezahlt: ${bezahltText}`;
  return `Bezahlt: ${bezahltText} · offen: ${unbezahlte.map((b) => kurz(b.bezeichnung)).join(", ")} — ${basis.anzeige}`;
}

/**
 * Klartext für einen rohen `payment_status` — für Bestellungslisten, in denen
 * einzelne Zeilen stehen (Akte, Dubletten, Verbuchung).
 */
export function zahlungsstatusText(zahlungsstatus: unknown, archiviertAm?: unknown): string {
  const s = kundenstatus({
    zahlungsstatus: zahlungsstatus == null ? null : String(zahlungsstatus),
    hatBestellung: true,
    archiviertAm: (archiviertAm as any) ?? null,
  });
  return s.anzeige;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE STUFEN A · B · C — die Arbeitsreihenfolge, endlich beschriftet
//
// WARUM HIER UND WARUM KEINE NEUE SPALTE
// Die Einstufung gibt es längst: `priority_tier` (server/lib/tier.ts) trennt
// seit Monaten genau die drei Fälle, um die es geht. Was fehlte, war der NAME.
// Ein Agent sah eine sortierte Liste und musste raten, warum sie so sortiert
// ist; „Tier 2" steht nirgends auf der Oberfläche und würde auch niemandem
// etwas sagen.
//
// Eine zweite Einstufung neben `priority_tier` wäre der Fehler, den dieses
// Repo schon zweimal bezahlt hat (neun Statustabellen, zwei Personenbegriffe).
// Deshalb ist die Stufe eine ÜBERSETZUNG, keine Berechnung: Tier 1 → A,
// Tier 2 → B, Tier 3 → C. Ändert sich die Einstufung, ändert sich die Stufe
// automatisch mit, weil es dieselbe Zahl ist.
//
//   A  Zahlung gemeldet        Der Kunde sagt, er habe überwiesen. Heißester
//                              Fall im Haus: verifizieren und abschließen.
//   B  Antrag fertig,          Der Antrag ist durch, das Geld fehlt. „Frist
//      Rechnung offen          abgelaufen" gehört ausdrücklich hierher — das
//                              ist ein Anruf, kein Abfall (siehe Teil 0).
//   C  Lead ohne Antrag        Kampagnen-Leads und abgebrochene Anträge. Wird
//                              NUR gearbeitet, wenn A und B leer sind.
// ═══════════════════════════════════════════════════════════════════════════

export type StufenMarke = "A" | "B" | "C";

export interface Stufe {
  marke: StufenMarke;
  /** Klartext neben der Marke — ohne ihn ist ein Buchstabe eine Geheimsprache. */
  text: string;
  /** Warum diese Stufe so weit oben (oder unten) steht. Für Erklärtexte. */
  begruendung: string;
  ton: "warnung" | "offen" | "neutral";
}

export const STUFEN: Record<StufenMarke, Stufe> = {
  A: {
    marke: "A",
    text: "Zahlung gemeldet",
    begruendung: "Der Kunde sagt, er habe überwiesen. Beleg anfordern, Eingang prüfen, abschließen.",
    ton: "warnung",
  },
  B: {
    marke: "B",
    text: "Antrag fertig, Rechnung offen",
    begruendung: "Der Antrag ist durch, das Geld fehlt — auch wenn die Frist schon abgelaufen ist.",
    ton: "offen",
  },
  C: {
    marke: "C",
    text: "Lead ohne Antrag",
    begruendung: "Erstkontakt aus einer Kampagne. Wird gearbeitet, wenn A und B leer sind.",
    ton: "neutral",
  },
};

/**
 * Stufe aus dem `priority_tier`. Tier 0 (bezahlt) und -1 (ausgeschlossen) sind
 * KEIN Arbeitsvorrat und haben deshalb keine Stufe — sie liefern `null`.
 */
export function stufeAusTier(tier: unknown): Stufe | null {
  const t = Number(tier);
  if (t === 1) return STUFEN.A;
  if (t === 2) return STUFEN.B;
  if (t === 3) return STUFEN.C;
  return null;
}

/**
 * SQL-Ausdruck für die Stufe — damit auch Abfragen und Zähler denselben
 * Buchstaben benutzen wie die Oberfläche.
 */
export const STUFE_SQL = `CASE p.priority_tier
    WHEN 1 THEN 'A' WHEN 2 THEN 'B' WHEN 3 THEN 'C' ELSE NULL END`;
