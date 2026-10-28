// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — „ALS NÄCHSTES“ FÜR DAS TEAM (E-455, 29.10.2026)
//
// Justin: „… so, dass wir immer mit 1 Klick alles lösen können — Fahrplan haben für uns intern, alles steuern
//          können — einfach, verständlich und nichts überladen.“
//
// Reine Rechnung, ohne Datenbank und ohne Netz: Aus der Chef-Sicht einer Akte (globalMandatChefSicht) folgt
// GENAU EINE nächste interne Aufgabe mit einem Knopf — und daneben, worauf wir beim Kunden warten. Der Raum
// „Global-Kunden“ (ChefGlobalKunden.tsx) zeigt sie als Karte; die Knöpfe rufen dieselben Endpunkte wie der
// Raum „Global-Mandate“. Dazu die Einordnung einer Zeile der Mandatsliste für die Filter „Braucht uns“ und
// „Wartet auf Kunde“. Prüfstand: scripts/pruef-chef-global-neu.ts.
//
// Reihenfolge (die erste, die zutrifft, gewinnt):
//   0 storniert / abgeschlossen      → Ruhe, kein Knopf
//   1 ungelesene Kundennachricht     → „Antworten“
//   2 neues Kunden-Dokument          → „Öffnen“ (Öffnen = gesehen, die Aufgabe dazu erledigt sich)
//   3 Frist überfällig oder ≤ 14 T.  → „Erledigt“
//   4 niemand zuständig              → „Ich übernehme“ (die Leitung selbst) bzw. „Person wählen“
//   5 Zahlung offen                  → Wartet auf Kunde („Link erneut senden“)
//   6 nächste Station im Fahrplan    → „Starten“ · „<Wert> eintragen“ · „Erledigt“
//   7 sonst                          → Wartet auf Kunde (wenn etwas beim Kunden liegt) oder „Nichts offen“
// Die Liste folgt derselben Reihenfolge: Neues/Frist → Braucht uns; Zahlung offen → Wartet auf Kunde; Fahrplan läuft →
// Braucht uns; Fahrplan fertig und etwas liegt beim Kunden → Wartet auf Kunde; sonst Ruhe.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_FAHRPLAN, GLOBAL_FAHRPLAN_BEDARF } from "./fiaon-global-mandat";

/** Bis zu wie vielen Tagen vor Fälligkeit eine Frist die nächste Aufgabe wird. */
export const ALS_NAECHSTES_FRIST_TAGE = 14;

/** Stationen, deren Abschluss einen Wert braucht — ohne Wert schlägt die Karte „<Wert> eintragen“ vor. */
export const ALS_NAECHSTES_WERT: Record<string, { feld: string; titel: string }> = {
  eingetragen: { feld: "aktenzeichen", titel: "Registernummer" },
  ein: { feld: "ein", titel: "EIN" },
  itin: { feld: "itinMaske", titel: "ITIN" },
  duns: { feld: "duns", titel: "D-U-N-S-Nummer" },
};

export type AlsNaechstesAktion =
  | { art: "antworten" }
  | { art: "dokument-oeffnen"; dokumentId: number }
  | { art: "frist-erledigt"; fristId: number }
  | { art: "zustaendig"; agentId: number }
  | { art: "zustaendig-waehlen" }
  | { art: "zugang-senden" }
  | { art: "station"; schluessel: string; status: "in_arbeit" | "erledigt" }
  | { art: "station-werte"; schluessel: string }
  | { art: "keine" };

export type AlsNaechstesTon = "uns" | "kunde" | "amt" | "ruhe";

export interface AlsNaechstes {
  /** uns = wir sind dran · kunde = wartet auf den Kunden · amt = wartet auf Behörde/Institut · ruhe = nichts offen */
  ton: AlsNaechstesTon;
  /** Ein Satz: was zu tun ist. */
  titel: string;
  /** Ein Satz: warum gerade das. */
  warum: string;
  /** Beschriftung des einen Knopfs (null = kein Knopf). */
  knopf: string | null;
  aktion: AlsNaechstesAktion;
  /** Was beim Kunden liegt — je Eintrag eine kurze Zeile. */
  wartet: string[];
}

/** Die Felder der Chef-Sicht, die die Rechnung braucht — alles freiwillig, alte Akten bleiben rechenbar. */
export interface AlsNaechstesAkte {
  status?: string | null;
  nachrichten?: ReadonlyArray<{ von?: string; gelesen?: boolean }> | null;
  dokumente?: ReadonlyArray<{
    id: number | string; von?: string; neu?: boolean; titel?: string | null; artText?: string | null; art?: string;
    unterschrift?: { gefordert?: boolean; unterschrieben?: boolean } | null; unterschriebeneFassungVon?: number | null;
  }> | null;
  schritte?: ReadonlyArray<{ schluessel: string; titel?: string; status?: string; geaendertAm?: string | null; beantragtAm?: string | null }> | null;
  fristen?: ReadonlyArray<{ id: number | string; titel: string; faelligAm?: string | null; erledigt?: boolean }> | null;
  unterlagen?: ReadonlyArray<{ titel: string; vorhanden?: boolean; abgelehnt?: unknown }> | null;
  nachreichen?: ReadonlyArray<{ titel: string }> | null;
  gesellschaftPlus?: Record<string, unknown> | null;
  zustaendigkeit?: { agentId?: number | null; name?: string | null; auswahl?: ReadonlyArray<{ id: number; name: string }> } | null;
}

/** Tage von `heute` bis `tag` (beide YYYY-MM-DD); negativ = vorbei. */
export function tageBis(tag: string, heute: string): number {
  const a = Date.UTC(+heute.slice(0, 4), +heute.slice(5, 7) - 1, +heute.slice(8, 10));
  const b = Date.UTC(+tag.slice(0, 4), +tag.slice(5, 7) - 1, +tag.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

const tagDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Die Stationen, die für diese Akte zählen: ohne „entfällt“ und ohne „nur bei Bedarf“, die nie angelegt wurde. */
export function zaehlendeStationen<S extends { schluessel: string; status?: string; geaendertAm?: string | null }>(schritte: ReadonlyArray<S>): S[] {
  return schritte.filter((s) => {
    const st = s.status ?? "offen";
    if (st === "entfaellt") return false;
    // „Nur bei Bedarf“ (z. B. frühere Gesellschaft löschen): offen und nie gespeichert = gibt es für diese Akte nicht.
    if (GLOBAL_FAHRPLAN_BEDARF.includes(s.schluessel) && st === "offen" && !s.geaendertAm) return false;
    return true;
  });
}

/** Die nächste Station: die erste in Fahrplan-Reihenfolge, die zählt und nicht erledigt ist. */
export function naechsteStation<S extends { schluessel: string; status?: string; geaendertAm?: string | null }>(schritte: ReadonlyArray<S>): S | null {
  const zaehlt = zaehlendeStationen(schritte);
  const nach = new Map(zaehlt.map((s) => [s.schluessel, s]));
  for (const v of GLOBAL_FAHRPLAN) {
    const s = nach.get(v.schluessel);
    if (s && (s.status ?? "offen") !== "erledigt") return s;
  }
  return null;
}

/** Was beim Kunden liegt — dieselbe Unterlagen-Rechnung wie Portal und Raum „Global-Mandate“. */
export function wartetAufKunde(m: AlsNaechstesAkte): string[] {
  const aus: string[] = [];
  if (m.status === "offen") aus.push("Zahlung offen");
  const unterschrift = (m.dokumente ?? []).filter((d) => d.unterschrift?.gefordert && !d.unterschrift?.unterschrieben).length;
  if (unterschrift) aus.push(`${mehrzahl(unterschrift, "Unterschrift", "Unterschriften")} offen`);
  const fehlen = m.status !== "offen" ? (m.unterlagen ?? []).filter((u) => !u.vorhanden && !u.abgelehnt).map((u) => u.titel) : [];
  if (fehlen.length) aus.push(`Fehlt: ${fehlen.join(", ")}`);
  const neu = (m.nachreichen ?? []).map((u) => u.titel);
  if (neu.length) aus.push(`Bitte neu: ${neu.join(", ")}`);
  return aus;
}

/** DIE eine nächste interne Aufgabe einer Akte. `heute` = Berliner Tag (YYYY-MM-DD). */
export function alsNaechstes(m: AlsNaechstesAkte, heute: string): AlsNaechstes {
  const wartet = wartetAufKunde(m);
  const status = String(m.status ?? "offen");

  // 0 · Ruhe
  if (status === "storniert") return { ton: "ruhe", titel: "Der Auftrag ist storniert.", warum: "Hier ist nichts mehr zu tun.", knopf: null, aktion: { art: "keine" }, wartet: [] };

  // 1 · Der Kunde hat geschrieben
  const ungelesen = (m.nachrichten ?? []).filter((n) => n.von === "kunde" && !n.gelesen).length;
  if (ungelesen > 0) {
    return {
      ton: "uns", titel: ungelesen === 1 ? "Der Kunde hat geschrieben." : `Der Kunde hat ${ungelesen} Nachrichten geschrieben.`,
      warum: "Er wartet im Portal auf eine Antwort.", knopf: "Antworten", aktion: { art: "antworten" }, wartet,
    };
  }

  // 2 · Neue Dokumente vom Kunden (auch frisch unterschriebene Fassungen)
  const neu = (m.dokumente ?? []).filter((d) => d.neu);
  if (neu.length > 0) {
    const erstes = neu[0];
    const name = String(erstes.titel || erstes.artText || "Dokument");
    const unterschrieben = erstes.unterschriebeneFassungVon != null;
    return {
      ton: "uns",
      titel: neu.length === 1 ? (unterschrieben ? `Unterschrieben zurück: ${name}.` : `Neues Dokument: ${name}.`) : `${neu.length} neue Dokumente vom Kunden.`,
      warum: "Öffnen zählt als gesehen — die Aufgabe dazu erledigt sich von selbst.",
      knopf: neu.length === 1 ? "Öffnen" : "Erstes öffnen", aktion: { art: "dokument-oeffnen", dokumentId: Number(erstes.id) }, wartet,
    };
  }

  // 3 · Eine Frist drängt
  const frist = (m.fristen ?? []).filter((f) => !f.erledigt && f.faelligAm).sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)))[0];
  if (frist && tageBis(String(frist.faelligAm), heute) <= ALS_NAECHSTES_FRIST_TAGE) {
    const t = tageBis(String(frist.faelligAm), heute);
    return {
      ton: "uns", titel: `Frist: ${frist.titel}.`,
      warum: t < 0 ? `Seit ${mehrzahl(-t, "Tag", "Tagen")} überfällig (${tagDe(String(frist.faelligAm))}).` : t === 0 ? "Heute fällig." : `Fällig in ${mehrzahl(t, "Tag", "Tagen")} (${tagDe(String(frist.faelligAm))}).`,
      knopf: "Erledigt", aktion: { art: "frist-erledigt", fristId: Number(frist.id) }, wartet,
    };
  }

  // 4 · Niemand führt die Akte
  const z = m.zustaendigkeit;
  if (z && !z.agentId && status !== "abgeschlossen") {
    const ich = (z.auswahl ?? []).find((a) => / \(Leitung\)$/.test(a.name));
    return {
      ton: "uns", titel: "Niemand führt diese Akte.",
      warum: "Ohne Person gehen die Aufgaben an die Vorgabe, und das Portal nennt keinen festen Ansprechpartner.",
      knopf: ich ? "Ich übernehme" : "Person wählen",
      aktion: ich ? { art: "zustaendig", agentId: ich.id } : { art: "zustaendig-waehlen" }, wartet,
    };
  }

  // 5 · Zahlung offen
  if (status === "offen") {
    return {
      ton: "kunde", titel: "Wartet auf die Zahlung.", warum: "Die Etappen starten mit dem Zahlungseingang — den Fahrplan kannst du schon pflegen.",
      knopf: "Link erneut senden", aktion: { art: "zugang-senden" }, wartet,
    };
  }

  // 6 · Die nächste Station im Fahrplan
  if (status !== "abgeschlossen") {
    const s = naechsteStation(m.schritte ?? []);
    if (s) {
      const titel = String(s.titel || s.schluessel);
      const st = s.status ?? "offen";
      if (st === "offen") {
        return { ton: "uns", titel: `„${titel}“ starten.`, warum: "Das ist die nächste Station im Fahrplan. Der Kunde sieht danach „In Arbeit“.", knopf: "Starten", aktion: { art: "station", schluessel: s.schluessel, status: "in_arbeit" }, wartet };
      }
      const wert = ALS_NAECHSTES_WERT[s.schluessel];
      const plus = m.gesellschaftPlus ?? {};
      if (wert && !String(plus[wert.feld] ?? "").trim()) {
        return {
          ton: st === "beantragt" ? "amt" : "uns", titel: `${wert.titel} eintragen.`,
          warum: st === "beantragt" ? `„${titel}“ ist beantragt — sobald die Nummer da ist, hier eintragen. Der Kunde sieht sie sofort.` : `„${titel}“ läuft. Der Kunde sieht die Nummer, sobald sie eingetragen ist.`,
          knopf: `${wert.titel} eintragen`, aktion: { art: "station-werte", schluessel: s.schluessel }, wartet,
        };
      }
      return {
        ton: st === "beantragt" ? "amt" : "uns", titel: `„${titel}“ abschließen.`,
        warum: st === "beantragt" ? `Beantragt${s.beantragtAm ? ` am ${tagDe(String(s.beantragtAm))}` : ""} — die Entscheidung liegt bei Behörde oder Institut.` : "Die Station läuft. „Erledigt“ setzt das Datum auf heute; der Kunde sieht es sofort.",
        knopf: "Erledigt", aktion: { art: "station", schluessel: s.schluessel, status: "erledigt" }, wartet,
      };
    }
  }

  // 7 · Sonst
  if (wartet.length) return { ton: "kunde", titel: "Wartet auf den Kunden.", warum: "Bei uns ist nichts offen.", knopf: null, aktion: { art: "keine" }, wartet };
  return {
    ton: "ruhe", titel: status === "abgeschlossen" ? "Der Auftrag ist abgeschlossen." : "Nichts offen.",
    warum: status === "abgeschlossen" ? "Fristen und Post laufen weiter über diese Akte." : "Der Fahrplan ist komplett.",
    knopf: null, aktion: { art: "keine" }, wartet,
  };
}

// ── DIE LISTE: „Braucht uns“ · „Wartet auf Kunde“ ─────────────────────────────
export interface ListenZeile {
  status: string; anfragenNeu?: number; uploadsNeu?: number; unterschriftenOffen?: number;
  naechsteFrist?: string | null; naechsterSchritt?: string | null; fortschritt?: { erledigt: number; gesamt: number } | null;
}
export type ListenGruppe = "uns" | "kunde" | "ruhe";
export interface ListenLage {
  gruppe: ListenGruppe;
  /** Neues vom Kunden (Punkt in der Liste). */
  neu: boolean;
  /** Ein Satz Stand. */
  stand: string;
  /** Der nächste Schritt, kurz. */
  naechster: string;
}

const STATUS_KURZ: Record<string, string> = { offen: "Zahlung offen", bezahlt: "Bezahlt", gestartet: "In Arbeit", abgeschlossen: "Abgeschlossen", storniert: "Storniert" };

export function listenLage(z: ListenZeile, heute: string): ListenLage {
  const f = z.fortschritt ?? { erledigt: 0, gesamt: 1 };
  const stand = z.status === "offen" || z.status === "storniert" ? (STATUS_KURZ[z.status] ?? z.status)
    : `${STATUS_KURZ[z.status] ?? z.status} · ${f.erledigt} von ${f.gesamt} Stationen`;
  const neuDok = Number(z.uploadsNeu || 0); const neuNachricht = Number(z.anfragenNeu || 0);
  const neu = neuDok + neuNachricht > 0;
  if (z.status === "storniert" || z.status === "abgeschlossen") return { gruppe: "ruhe", neu, stand, naechster: neu ? neuText(neuDok, neuNachricht) : "Nichts offen" };
  if (neu) return { gruppe: "uns", neu, stand, naechster: neuText(neuDok, neuNachricht) };
  if (z.naechsteFrist && tageBis(z.naechsteFrist, heute) <= ALS_NAECHSTES_FRIST_TAGE) {
    const t = tageBis(z.naechsteFrist, heute);
    return { gruppe: "uns", neu, stand, naechster: t < 0 ? `Frist überfällig (${tagDe(z.naechsteFrist)})` : `Frist am ${tagDe(z.naechsteFrist)}` };
  }
  if (z.status === "offen") return { gruppe: "kunde", neu, stand, naechster: "Wartet auf die Zahlung" };
  // Wie die Karte „Als Nächstes“: Solange unser Fahrplan läuft, sind WIR dran — eine Unterschrift beim Kunden steht daneben.
  const u = Number(z.unterschriftenOffen || 0);
  const beimKunden = u > 0 ? `${mehrzahl(u, "Unterschrift", "Unterschriften")} beim Kunden` : "";
  if (f.erledigt < f.gesamt) return { gruppe: "uns", neu, stand, naechster: z.naechsterSchritt ? String(z.naechsterSchritt) : beimKunden || "Fahrplan weiterführen" };
  if (u > 0) return { gruppe: "kunde", neu, stand, naechster: beimKunden };
  return { gruppe: "ruhe", neu, stand, naechster: "Fahrplan komplett" };
}

function neuText(dok: number, nachricht: number): string {
  return [dok ? mehrzahl(dok, "neues Dokument", "neue Dokumente") : "", nachricht ? mehrzahl(nachricht, "neue Nachricht", "neue Nachrichten") : ""].filter(Boolean).join(" · ");
}
