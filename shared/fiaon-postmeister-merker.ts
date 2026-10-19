// ═══════════════════════════════════════════════════════════════════════════
// EINE MAIL — EINE EINORDNUNG, EIN AKTENVERMERK (19.10.2026, E-401 Baustein 1)
//
// Der Befund (Produktion, lesend gemessen 19.10.): Beim Bündeln (E-369) und bei jedem neuen Anlauf lief
// die KI-Einordnung samt Aktenvermerk VOR der Wartestufe — in JEDEM Takt neu. Mail #7110 bekam so in zwei
// Minuten 21 gleiche Zeilen „E-Mail an welcome@ …“ (der Nachhol-Lauf nach der KI-Pause drehte 20 Runden,
// weil die wartende Mail als „verarbeitet“ zählte), jede mit neuem KI-Text. Eine alte Mail, die ein
// Mensch in Gmail beantwortet hatte, holte der Rückstands-Takt alle 20 Minuten wieder hervor — 36 bis 45
// Vermerke am Tag, drei Wochen lang. In 7 Tagen 354 überflüssige Akte-Zeilen, dazu je eine KI-Einordnung.
//
// Hier steht nur das REINE: wie der Merker an der Postmeister-Zeile aussieht, wann er gilt und wie der
// Kopf des Aktenvermerks lautet. Lesen, schreiben und einordnen tut der Server
// (server/lib/fiaon-postmeister-einmal.ts, fiaon-postmeister-agent.ts einordnenMitMerker), geprüft im
// Prüfstand scripts/pruef-postmeister-einmal(-db).ts.
//
// Gemerkt wird die ROHE Antwort des Modells (vor dem Riegel). Der Riegel ist Code und läuft bei jeder
// Wiederverwendung neu — so greift eine Riegel-Verbesserung auch für eine gemerkte Mail. Der Merker gilt,
// solange die Anfrage ans Modell dieselbe ist (Fingerabdruck aus Auftrag, Absender, Betreff und Text —
// das Alter der Mail zählt nicht, die Mail ändert sich nicht).
// ═══════════════════════════════════════════════════════════════════════════

/** Fassung des Merkers — eine andere Fassung gilt als „kein Merker“ (dann wird neu eingeordnet). */
export const EINORDNUNG_MERKER_FASSUNG = 1 as const;

/** Die rohe Einordnung des Modells, so wie sie an der Zeile steht (vor dem Riegel). */
export interface EinordnungRohGemerkt {
  kategorien: string[];
  dringend: boolean;
  sprache: string;
  fragen: string[];
  zusammenfassung: string;
  flags: Record<string, boolean>;
}

export interface EinordnungMerker {
  v: typeof EINORDNUNG_MERKER_FASSUNG;
  /** Fingerabdruck der Anfrage ans Modell. */
  fp: string;
  /** Wann eingeordnet (ISO). */
  am: string;
  /** Hatten wir den Absender zuletzt um seine Bonitätsauskunft gebeten (E-240)? Stand beim Einordnen. */
  auskunft: boolean;
  roh: EinordnungRohGemerkt;
}

/** JSONB kommt als Objekt, Altbestand und doppelt verpackte Werte als Text — beides lesen, nie werfen. */
function objektAus(w: unknown, tiefe = 0): Record<string, unknown> | null {
  if (w == null || tiefe > 2) return null;
  if (typeof w === "string") { try { return objektAus(JSON.parse(w), tiefe + 1); } catch { return null; } }
  if (typeof w === "object" && !Array.isArray(w)) return w as Record<string, unknown>;
  return null;
}

/**
 * Die rohe Einordnung säubern — GENAU die Grenzen, die einordnen() seit E-094 an die Modellantwort legt
 * (Kategorien als Liste, sonst „sonstiges“; Sprache 5 Zeichen; 8 Fragen; 500 Zeichen Zusammenfassung).
 * Derselbe Weg für die frische und die gemerkte Einordnung — so ergibt der Merker dasselbe wie der erste Lauf.
 */
export function einordnungRohSaeubern(w: unknown): EinordnungRohGemerkt | null {
  const r = objektAus(w);
  if (!r) return null;
  const flagsRoh = objektAus(r.flags) ?? {};
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(flagsRoh)) if (typeof v === "boolean") flags[k] = v;
  return {
    kategorien: Array.isArray(r.kategorien) ? r.kategorien.map(String) : ["sonstiges"],
    dringend: !!r.dringend,
    sprache: String(r.sprache || "de").slice(0, 5),
    fragen: Array.isArray(r.fragen) ? r.fragen.slice(0, 8).map(String) : [],
    zusammenfassung: String(r.zusammenfassung || "").slice(0, 500),
    flags,
  };
}

/**
 * Der Merker an der Zeile — nur, wenn er zu DIESER Anfrage gehört (gleiche Fassung, gleicher Fingerabdruck)
 * und eine brauchbare Einordnung trägt. Sonst null: dann ordnet der Server neu ein.
 */
export function einordnungMerkerLesen(w: unknown, fp: string): EinordnungMerker | null {
  const m = objektAus(w);
  if (!m || m.v !== EINORDNUNG_MERKER_FASSUNG || typeof m.fp !== "string" || !fp || m.fp !== fp) return null;
  const rohObjekt = objektAus(m.roh);
  if (!rohObjekt || !Array.isArray(rohObjekt.kategorien) || typeof rohObjekt.zusammenfassung !== "string" || !objektAus(rohObjekt.flags)) return null;
  const roh = einordnungRohSaeubern(rohObjekt);
  if (!roh) return null;
  return { v: EINORDNUNG_MERKER_FASSUNG, fp: m.fp, am: String(m.am ?? ""), auskunft: m.auskunft === true, roh };
}

/** Den Merker für die Zeile bauen. */
export function einordnungMerkerBauen(fp: string, roh: unknown, auskunft: boolean, jetzt: Date): EinordnungMerker {
  return {
    v: EINORDNUNG_MERKER_FASSUNG, fp, am: jetzt.toISOString(), auskunft: !!auskunft,
    roh: einordnungRohSaeubern(roh) ?? { kategorien: ["sonstiges"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "", flags: {} },
  };
}

/**
 * Der Kopf des Aktenvermerks zu einer Kundenmail — wortgleich wie seit E-094, damit die Prüfung auf
 * einen schon geschriebenen Vermerk (Altbestand vor E-401, Nachprüfung E-246) ihn wiederfindet.
 */
export function akteVermerkKopf(postfach: string, betreff: string): string {
  return `E-Mail an ${postfach}: „${String(betreff ?? "").slice(0, 90)}" — `;
}

/** Der ganze Vermerk: Kopf + Zusammenfassung der Einordnung. */
export function akteVermerkText(postfach: string, betreff: string, zusammenfassung: string): string {
  return `${akteVermerkKopf(postfach, betreff)}${String(zusammenfassung ?? "").slice(0, 400)}`;
}

/**
 * Muss der Server nach einem älteren Vermerk suchen, bevor er schreibt? Nur bei einer Zeile, die ein
 * früherer Lauf schon in der Hand hatte (nicht in diesem Lauf angelegt), die noch keinen Vermerk-Merker
 * trägt und die nie bis zur Einordnung mit Merker kam — das ist der Altbestand von vor E-401 (oder ein
 * Anlauf, den die KI-Pause vor der Einordnung traf). Alles andere entscheidet der Merker allein.
 */
export function altenVermerkSuchen(z: { neuAngelegt: boolean; vermerkMerker: unknown; einordnungMerker: unknown }): boolean {
  return !z.neuAngelegt && !z.vermerkMerker && !objektAus(z.einordnungMerker);
}
