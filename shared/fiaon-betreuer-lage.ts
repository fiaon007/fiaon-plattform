// ═══════════════════════════════════════════════════════════════════════════
// WER BETREUT NACH DEM ZUSAMMENFÜHREN? — die EINE Regel
// (E-IT-E, 08.10.2026, Punkt 10 „Dubletten: Betreuer-Wahl ohne zweiten Betreuer")
//
// ── WAS GEMELDET WURDE ────────────────────────────────────────────────────
// Beim Zusammenführen verlangte der Server eine Betreuer-Wahl, obwohl nur eine
// Seite einen Betreuer hatte. Ursache: `Number(null) === 0`. Eine Person mit
// Stempel `betreuung_seit`, aber ohne zugewiesenen Mitarbeiter (der Normalfall
// nach einem Rückfall in den Pool — 3.029 von 5.781 Personen am 07.10.2026),
// galt als „von Agent 0 betreut". Gegen jeden echten Betreuer hieß das „zwei
// verschiedene Betreuer" — und der Akten-Dialog konnte gar nicht wählen. Wo
// keine Ablehnung kam, schrieb derselbe Fehler `assigned_agent_id = 0`
// (Person 13458, Merge vom 05.10.2026).
//
// Die Oberfläche rechnete den Streit mit einer EIGENEN Formel (Null-Prüfung),
// der Server ohne — beide liefen auseinander. Deshalb steht die Regel jetzt
// hier, und Server, Kandidatenliste und Oberfläche lesen dieselbe.
//
// ── DIE REGEL (Justin, 08.10.2026) ────────────────────────────────────────
// Gewählt werden muss NUR, wenn ZWEI VERSCHIEDENE, AKTIVE, ECHTE Betreuer
// hinterlegt sind. Kein Betreuer sind: leer, „Agent 0", ein gelöschtes
// Konto, ein Testkonto, ein inaktives oder ein gesperrtes Konto. Sonst
// übernimmt das System den einen automatisch.
//
// `betreuung_seit` entscheidet NICHT mehr, WER betreut — der Stempel bleibt
// (Besitzschutz der Zuteilung), sagt aber nur „war schon einmal betreut".
// ═══════════════════════════════════════════════════════════════════════════

/** Was über den Betreuer EINER Seite bekannt ist. */
export interface BetreuerSeite {
  /** fiaon_persons.assigned_agent_id, roh — auch 0 oder NULL. */
  agentId: number | null;
  agentName?: string | null;
  /** Gibt es eine Zeile in fiaon_agents? */
  agentGibtEs: boolean;
  /** fiaon_agents.active */
  aktiv: boolean;
  /** fiaon_agents.is_test_account */
  testkonto: boolean;
  /** fiaon_agents.zugang_gesperrt_am IS NOT NULL */
  gesperrt: boolean;
  /** fiaon_persons.mandat_seit — nur für den Hinweis, nicht für die Regel. */
  mandatSeit?: string | Date | null;
}

export type NichtBetreuerGrund = "kein_agent" | "agent_0" | "agent_fehlt" | "testkonto" | "inaktiv" | "gesperrt";

/** Klartext je Grund, für Listen und Gegenüberstellung. */
export const NICHT_BETREUER_TEXT: Record<NichtBetreuerGrund, string> = {
  kein_agent: "ohne Betreuer",
  agent_0: "ohne Betreuer (Altlast „Agent 0“)",
  agent_fehlt: "ohne Betreuer (Konto gibt es nicht mehr)",
  testkonto: "Testkonto",
  inaktiv: "ausgeschieden",
  gesperrt: "gesperrt",
};

/** Ein Datum als Berliner Kalendertag (TT.MM.JJJJ) — leer, wenn es keins ist. */
export function tagText(v: string | Date | null | undefined): string {
  const d = v ? new Date(v as any) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Der lebende Betreuer einer Seite — oder `null` mit Grund. NIE `Number(null)`:
 * Genau diese Umwandlung machte aus „niemand" den „Agent 0".
 */
export function lebenderBetreuer(s: BetreuerSeite): { agentId: number | null; grund: NichtBetreuerGrund | null } {
  if (s.agentId == null) return { agentId: null, grund: "kein_agent" };
  const id = Number(s.agentId);
  if (!Number.isFinite(id) || id <= 0) return { agentId: null, grund: "agent_0" };
  if (!s.agentGibtEs) return { agentId: null, grund: "agent_fehlt" };
  if (s.testkonto) return { agentId: null, grund: "testkonto" };
  if (!s.aktiv) return { agentId: null, grund: "inaktiv" };
  if (s.gesperrt) return { agentId: null, grund: "gesperrt" };
  return { agentId: id, grund: null };
}

/** So steht der Betreuer in einer Liste: „Name", „Name (gesperrt)", „ohne Betreuer". */
export function betreuerAnzeige(s: BetreuerSeite): string {
  const l = lebenderBetreuer(s);
  if (l.agentId != null) return s.agentName || `Mitarbeiter ${l.agentId}`;
  if (l.grund === "kein_agent" || l.grund === "agent_0" || l.grund === "agent_fehlt") return NICHT_BETREUER_TEXT[l.grund];
  return `${s.agentName || `Mitarbeiter ${s.agentId}`} (${NICHT_BETREUER_TEXT[l.grund!]})`;
}

/** Zwei verschiedene, lebende Betreuer? Dann — und nur dann — wählt ein Mensch. */
export function betreuerStreitAus(a: BetreuerSeite, b: BetreuerSeite): boolean {
  const la = lebenderBetreuer(a).agentId;
  const lb = lebenderBetreuer(b).agentId;
  return la != null && lb != null && la !== lb;
}

export type BetreuerFall = "streit" | "gleich" | "nur_gewinner" | "nur_verlierer" | "keiner";

export interface BetreuerLage {
  fall: BetreuerFall;
  /** Muss ein Mensch wählen (und hat es noch nicht)? */
  wahlNoetig: boolean;
  /** Wer betreut danach — `null` heißt: Gewinner bleibt unangetastet. */
  agentId: number | null;
  agentName: string | null;
  quelle: "gewinner" | "verlierer" | "unstrittig" | "keiner";
  /** Ein Satz für Oberfläche, Verlauf und Protokoll. */
  text: string;
  /** Was zusätzlich nachvollziehbar bleiben muss (Mandat, ausgeschiedener Betreuer). */
  hinweise: string[];
}

/**
 * Die Entscheidung über den Betreuer nach dem Zusammenführen.
 *
 *   streit         zwei lebende, verschiedene → Wahl Pflicht (ohne Wahl: wahlNoetig)
 *   gleich         derselbe lebende auf beiden Seiten → unstrittig
 *   nur_gewinner   nur der Gewinner hat einen lebenden → der bleibt
 *   nur_verlierer  nur der Verlierer hat einen lebenden → der wird übernommen
 *   keiner         niemand lebt → nichts wird gesetzt, der Gewinner bleibt, wie er ist
 */
export function betreuerLageAus(
  gewinner: BetreuerSeite,
  verlierer: BetreuerSeite,
  wahl?: "gewinner" | "verlierer" | null,
): BetreuerLage {
  const g = lebenderBetreuer(gewinner);
  const v = lebenderBetreuer(verlierer);
  const nameG = gewinner.agentName || (g.agentId != null ? `Mitarbeiter ${g.agentId}` : null);
  const nameV = verlierer.agentName || (v.agentId != null ? `Mitarbeiter ${v.agentId}` : null);
  const hinweise: string[] = [];

  // Ein Mandat (E-066) auf einer Seite, deren Betreuer NICHT weitermacht, geht
  // NICHT mit (der Merge setzt mandat_seit nach der Quelle der Betreuung) —
  // das wird genannt; wer später fragt, findet es im Verlauf. Über die
  // Bestellungen sagt der Hinweis nichts: deren Zuordnung bleibt wie bisher
  // (Trigger 033 + stündlicher Angleich), der Merge ändert daran nichts.
  // `weiter = null`: niemand übernimmt — die bleibende Akte bleibt, wie sie ist.
  const mandatHinweis = (seite: BetreuerSeite, grund: NichtBetreuerGrund | null, weiter: string | null) => {
    if (!seite.mandatSeit || seite.agentId == null || Number(seite.agentId) <= 0) return;
    const wer = seite.agentName || `Mitarbeiter ${seite.agentId}`;
    const seit = tagText(seite.mandatSeit);
    hinweise.push(
      `Mandat bei ${wer}${grund ? ` (${NICHT_BETREUER_TEXT[grund]})` : ""}${seit ? ` seit ${seit}` : ""} geht nicht mit — ` +
      (weiter
        ? `die Betreuung geht an ${weiter}, ohne dieses Mandat.`
        : "die Zuständigkeit der bleibenden Akte bleibt, wie sie ist, ohne dieses Mandat."),
    );
  };
  const ausgeschieden = (seite: BetreuerSeite, grund: NichtBetreuerGrund | null) => {
    if (grund === "testkonto" || grund === "inaktiv" || grund === "gesperrt") {
      hinweise.push(`${seite.agentName || `Mitarbeiter ${seite.agentId}`} zählt nicht als Betreuer (${NICHT_BETREUER_TEXT[grund]}).`);
    }
  };

  if (g.agentId != null && v.agentId != null && g.agentId !== v.agentId) {
    if (wahl !== "gewinner" && wahl !== "verlierer") {
      return {
        fall: "streit", wahlNoetig: true, agentId: null, agentName: null, quelle: "keiner",
        text: `Zwei aktive Betreuer: ${nameG} und ${nameV}. Wer künftig betreut, muss gewählt werden.`,
        hinweise,
      };
    }
    const agentId = wahl === "gewinner" ? g.agentId : v.agentId;
    const agentName = wahl === "gewinner" ? nameG : nameV;
    const anderer = wahl === "gewinner" ? verlierer : gewinner;
    if (anderer.mandatSeit) mandatHinweis(anderer, null, agentName);
    return {
      fall: "streit", wahlNoetig: false, agentId, agentName, quelle: wahl,
      text: `Zwei aktive Betreuer — ausdrücklich gewählt: ${agentName}.`,
      hinweise,
    };
  }
  if (g.agentId != null && g.agentId === v.agentId) {
    return {
      fall: "gleich", wahlNoetig: false, agentId: g.agentId, agentName: nameG, quelle: "unstrittig",
      text: `Beide Seiten werden von ${nameG} betreut.`, hinweise,
    };
  }
  if (g.agentId != null) {
    ausgeschieden(verlierer, v.grund);
    mandatHinweis(verlierer, v.grund, nameG);
    return {
      fall: "nur_gewinner", wahlNoetig: false, agentId: g.agentId, agentName: nameG, quelle: "gewinner",
      text: `${nameG} betreut weiter — die andere Seite hat keinen aktiven Betreuer.`, hinweise,
    };
  }
  if (v.agentId != null) {
    ausgeschieden(gewinner, g.grund);
    mandatHinweis(gewinner, g.grund, nameV);
    return {
      fall: "nur_verlierer", wahlNoetig: false, agentId: v.agentId, agentName: nameV, quelle: "verlierer",
      text: `${nameV} wird übernommen — die bleibende Akte hatte keinen aktiven Betreuer.`, hinweise,
    };
  }
  ausgeschieden(gewinner, g.grund);
  ausgeschieden(verlierer, v.grund);
  // Nachprüfung 08.10.2026: Auch hier fällt ein Mandat des Verlierers weg
  // (mandat_seit bleibt beim Gewinner) — das wird genannt, nicht nur protokolliert.
  mandatHinweis(verlierer, v.grund, null);
  return {
    fall: "keiner", wahlNoetig: false, agentId: null, agentName: null, quelle: "keiner",
    text: "Keine Seite hat einen aktiven Betreuer — die Zuständigkeit der bleibenden Akte bleibt, wie sie ist.",
    hinweise,
  };
}
