// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN VORPRÜFEN — UND DIE PRÜF-AUFGABE GEHT INS TEAM, NICHT ZU JUSTIN (E-406 B2, 19.10.2026)
//
// ── DER BEFUND (Produktion, nur lesend, 19.10.2026) ─────────────────────────
// · 222 offene Aufgaben „Unterlagen eingegangen – bitte prüfen“ — ALLE bei Justin (fuer_betreiber, ohne
//   Zuständigen; fiaon-unterlagen.ts legte sie so an). Justin hat in 30 Tagen keine einzige Datei geprüft.
// · Geprüft haben Frau Lombardi (64 Dateien, 36 Kunden) und Herr Stripling (32 Dateien, 22 Kunden) — beide Leitung.
//   Nur die Leitung öffnet die Unterlagen JEDES Kunden (darfAnKunde, darfInhalt) — darum prüft nur sie.
// · 111 der 222 haben noch Ungeprüftes und einen laufenden Vertrag; die anderen schließt der Hausputz (E-397,
//   Regel „unterlagen_geprueft“) oder das Ereignis „Unterlage geprüft“.
//
// ── DIE REGELN (rein, ohne Datenbank — Prüfstand scripts/pruef-mara-kyc.ts) ─
// 1. Vorprüfung: Kommt eine Unterlage, liest der Server sie vor (Art erkannt? lesbar? vollständig? steht der
//    Name aus der Akte darin?) und schreibt EINE kurze Notiz an die Unterlage (vorpruefNotiz). Ausweisbilder
//    liest weiter keine KI (der Ausweis-KI-Abgleich vom 08.10. ist nicht fertig, Gedächtnis
//    justin-ausweis-ki-abgleich) — ein Foto heißt ehrlich „bitte selbst ansehen“. Die Notiz gibt NIE frei:
//    „Geprüft“ klickt weiter ein Mensch (Vier-Augen).
// 2. Wer prüft (prueferWaehlen): die eingestellte Person (Chefbüro › Mara › Bonitätsauskunft › Unterlagen) —
//    sonst der Vorschlag: wer in 30 Tagen die meisten Dateien geprüft hat. Nur Leitung, nie der Inhaber,
//    nie gesperrt, inaktiv oder Testkonto. Ohne Kandidaten bleibt es (wie bisher) beim Betreiber.
// 3. Umhängen (umhaengenPasst): offene „Unterlagen eingegangen“ bei Justin, mit Ungeprüftem, laufendem Vertrag,
//    kein Testkonto — nur mit dem Schalter (UMHAENGEN_SCHALTER, Standard AUS: Justin entscheidet), über den
//    E-397-Motor (Protokoll fiaon_hausputz_log, 30 Tage zurückholbar).
// ═══════════════════════════════════════════════════════════════════════════
import { kopfAbgleich } from "./fiaon-finanzauswertung";

export type VorpruefKategorie = "ausweis" | "kontoauszug" | "schufa" | "weitere";
export type VorpruefAmpel = "gruen" | "gelb" | "rot";

const LABEL: Record<VorpruefKategorie, string> = {
  ausweis: "Ausweis", kontoauszug: "Kontoauszug", schufa: "Bonitätsauskunft", weitere: "Weitere Unterlage",
};
const AUSWEIS_ART: Record<string, string> = {
  personalausweis: "Personalausweis", reisepass: "Reisepass", aufenthaltstitel_pass: "Aufenthaltstitel + Pass",
};

/** Das Prüfurteil, so weit die Vorprüfung es braucht (DokumentUrteil aus fiaon-dokument-pruefung.ts). */
export interface VorpruefUrteil {
  pruefbar?: boolean | null;
  erkannt?: boolean | null;
  vollstaendig?: boolean | null;
  fehlt?: string[] | null;
  klasse?: string | null;
  ausweisArt?: string | null;
  kiPause?: boolean | null;
}

export interface VorpruefEingabe {
  kategorie: VorpruefKategorie;
  /** null = die Prüfung kam nicht rechtzeitig zurück (oder es gibt keine, wie bei „Weitere“). */
  urteil: VorpruefUrteil | null;
  /** Der Namensabgleich (vorpruefName): true = Name steht darin, false = nicht gefunden, null = nicht prüfbar. */
  namePasst: boolean | null;
}

export interface Vorpruefung {
  notiz: string;
  ampel: VorpruefAmpel;
}

const ROT_KLASSEN = ["passwort", "beschaedigt", "unscharf", "falsche_art", "unvollstaendig"];

/**
 * Der Name aus der Akte im Text der Unterlage — dieselbe Regel wie der Kontoinhaber im Kopf des Kontoauszugs
 * (kopfAbgleich, E-IT-D): Nachname (Doppelnamen, Umlaute, Reihenfolge egal). Ohne Textschicht (Foto) oder
 * ohne Nachnamen in der Akte: null — nie „passt nicht“, was niemand gelesen hat.
 */
export function vorpruefName(text: string | null | undefined, person: { vorname?: string | null; nachname?: string | null }): boolean | null {
  const t = String(text ?? "");
  if (t.replace(/\s+/g, "").length < 40) return null;
  if (!String(person.nachname ?? "").trim()) return null;
  return kopfAbgleich(t, { vorname: person.vorname ?? null, nachname: person.nachname ?? null }).inhaber;
}

/** Die eine Notiz an der Unterlage: „Ausweis · erkannt (Reisepass) · lesbar · vollständig · Name passt“. */
export function vorpruefNotiz(e: VorpruefEingabe): Vorpruefung {
  const label = LABEL[e.kategorie] ?? "Unterlage";
  if (e.kategorie === "weitere") {
    return { notiz: `${label} — keine automatische Prüfung, bitte selbst ansehen`, ampel: "gelb" };
  }
  const u = e.urteil;
  if (!u) return { notiz: `${label} — noch nicht gelesen, bitte selbst ansehen`, ampel: "gelb" };
  if (u.kiPause) return { notiz: `${label} — wartet auf das Ende der KI-Pause, wird dann gelesen`, ampel: "gelb" };
  const teile: string[] = [label];
  const klasse = String(u.klasse ?? "");
  const art = u.ausweisArt && AUSWEIS_ART[u.ausweisArt] ? ` (${AUSWEIS_ART[u.ausweisArt]})` : "";
  if (u.erkannt === true) teile.push(`erkannt${art}`);
  else if (u.erkannt === false) teile.push(`NICHT als ${label} erkannt`);
  else teile.push("Art nicht prüfbar");
  if (klasse === "passwort") teile.push("mit Passwort geschützt");
  else if (klasse === "beschaedigt") teile.push("Datei beschädigt");
  else if (klasse === "unscharf") teile.push("nicht lesbar");
  else if (klasse === "technisch") teile.push("Lesefehler der Technik");
  else if (klasse === "von_hand") teile.push("Foto — bitte selbst ansehen");
  else if (u.pruefbar === true) teile.push("lesbar");
  else teile.push("nicht prüfbar");
  if (u.vollstaendig === true) teile.push("vollständig");
  else if (u.vollstaendig === false) {
    const fehlt = (u.fehlt ?? []).map((x) => String(x || "").trim()).filter(Boolean)[0];
    teile.push(fehlt ? `unvollständig: ${fehlt.slice(0, 90)}` : "unvollständig");
  }
  if (e.namePasst === true) teile.push("Name passt");
  else if (e.namePasst === false) teile.push("Name aus der Akte NICHT gefunden");
  else teile.push("Name nicht prüfbar");
  const rot = u.erkannt === false || u.vollstaendig === false || ROT_KLASSEN.includes(klasse);
  const gruen = !rot && u.erkannt === true && u.vollstaendig === true && e.namePasst === true;
  return { notiz: teile.join(" · ").slice(0, 240), ampel: rot ? "rot" : gruen ? "gruen" : "gelb" };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFGABE „UNTERLAGEN EINGEGANGEN“ — der Text beginnt IMMER so (E-397 sucht nach diesem Anfang:
// unterlagenVermerkeSchliessen, Hausputz-Typ „unterlagen“, anstossAusfuehren)
// ═══════════════════════════════════════════════════════════════════════════
export const UNTERLAGEN_AUFGABE_ANFANG = "Unterlagen eingegangen";

export function unterlagenAufgabeText(was: string, vorpruefungen: readonly string[], befund: string | null | undefined): string {
  const vp = vorpruefungen.map((x) => String(x || "").trim()).filter(Boolean);
  return `${UNTERLAGEN_AUFGABE_ANFANG} (${was}) — bitte prüfen und in der Akte unter Dokumente „Geprüft“ setzen. Der Kunde sieht „Wird geprüft“.`
    + (vp.length ? ` Vorprüfung: ${vp.join(" | ")}.` : "")
    + (befund ? ` ⚠ Automatische Prüfung meldet: ${befund}` : "");
}

// ═══════════════════════════════════════════════════════════════════════════
// WER PRÜFT
// ═══════════════════════════════════════════════════════════════════════════
/** fiaon_settings: die gewählte Person (Mitarbeiter-ID). Leer = der Vorschlag gilt. */
export const PRUEFER_EINSTELLUNG = "unterlagen_pruefer_agent_id";

export interface PrueferKandidat {
  id: number;
  name: string;
  rolle: string;
  /** admin_stufe („inhaber“, „geschaeftsfuehrung“ …). */
  stufe: string | null;
  aktiv: boolean;
  gesperrt: boolean;
  test: boolean;
  /** Geprüfte Unterlagen-Dateien in 30 Tagen (fiaon_dokumente.geprueft_von_agent_id). */
  geprueft30: number;
}

export interface PrueferWahl {
  id: number;
  name: string;
  /** „einstellung“ = im Chefbüro gewählt, „vorschlag“ = wer am meisten geprüft hat. */
  quelle: "einstellung" | "vorschlag";
}

/** Darf diese Person die Prüf-Aufgaben bekommen? Leitung (öffnet jede Akte), nie der Inhaber, nur aktiv. */
export function darfPruefen(k: PrueferKandidat): boolean {
  return !!k && k.aktiv && !k.gesperrt && !k.test
    && (k.rolle === "vertriebsleiter" || k.rolle === "admin")
    && String(k.stufe ?? "").toLowerCase() !== "inhaber";
}

/** Die eine Wahl: eingestellt (wenn erlaubt), sonst wer in 30 Tagen am meisten geprüft hat, sonst niemand. */
export function prueferWaehlen(kandidaten: readonly PrueferKandidat[], eingestellt: number | null | undefined): PrueferWahl | null {
  const erlaubt = kandidaten.filter(darfPruefen);
  const e = Number(eingestellt);
  if (Number.isInteger(e) && e > 0) {
    const k = erlaubt.find((x) => x.id === e);
    if (k) return { id: k.id, name: k.name, quelle: "einstellung" };
  }
  const v = erlaubt.filter((x) => Number(x.geprueft30) > 0)
    .sort((a, b) => Number(b.geprueft30) - Number(a.geprueft30) || a.id - b.id)[0];
  return v ? { id: v.id, name: v.name, quelle: "vorschlag" } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// UMHÄNGEN DER ALTEN PRÜF-AUFGABEN (nur mit dem Schalter)
// ═══════════════════════════════════════════════════════════════════════════
/** fiaon_settings: „an“ = die alten Prüf-Aufgaben bei Justin gehen an die prüfende Person. Fehlt er: AUS. */
export const UMHAENGEN_SCHALTER = "unterlagen_umhaengen";
/** Die Regel im Protokoll des Hausputz-Motors (fiaon_hausputz_log.regel) und die Art des Laufs. */
export const UMHAENGEN_REGEL = "unterlagen_pruefer";
export const UMHAENGEN_LAUF_ART = "unterlagen_pruefer";

/** Nur ein ausdrückliches „an“ schaltet ein — fehlt der Wert oder ist er unklar, bleibt es AUS (Justin entscheidet). */
export function umhaengenAn(wert: unknown): boolean {
  return ["an", "1", "ja", "true", "on"].includes(String(wert ?? "").trim().toLowerCase());
}

export interface UmhaengZeile {
  text: string;
  status: string;
  /** Liegt bei Justin: fuer_betreiber oder ohne Zuständigen. */
  beiJustin: boolean;
  /** Ungeprüfte Kunden-Unterlagen dieses Menschen. */
  ungeprueft: number;
  vertragLaeuft: boolean;
  test: boolean;
}

/**
 * Hängt diese Aufgabe um? Nur offene „Unterlagen eingegangen“ bei Justin mit noch Ungeprüftem, laufendem Vertrag
 * und ohne Testkonto. Alles andere schließt der Hausputz (E-397) oder das Ereignis „Unterlage geprüft“ — eine
 * Prüf-Aufgabe, bei der nichts mehr zu prüfen ist, wäre bei der Prüferin nur Arbeit ohne Wirkung.
 */
export function umhaengenPasst(z: UmhaengZeile): boolean {
  return z.status === "offen" && String(z.text || "").startsWith(UNTERLAGEN_AUFGABE_ANFANG)
    && z.beiJustin && Number(z.ungeprueft) > 0 && z.vertragLaeuft && !z.test;
}
