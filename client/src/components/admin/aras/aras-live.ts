// ═══════════════════════════════════════════════════════════════════════════
// ARAS-COCKPIT — WELCHE GESPRÄCHE LAUFEN? (20.10.2026)
//
// Justin: „wenn ich auflege, läuft der Kasten da mit ‚Übernehmen‘ dennoch weiter“. Der Grund (lokal nachgestellt):
// Nach dem Ende-Ereignis kamen noch Ereignisse zu DIESEM Anruf (Prüf-Mara „aras_pruefung“, dein Daumen) — und die
// alte Live-Karte legte für jedes unbekannte Ereignis einen neuen Kasten an, der nie wieder verschwand. Ein Anruf,
// der gar nicht abgenommen wurde, hatte nie ein Ende-Ereignis; und der 15-s-Abgleich mit der Lage fügte nur hinzu.
//
// Jetzt gilt (rein, geprüft in scripts/pruef-aras-cockpit.ts):
//   1. Ein Ende-Ereignis (aras_ende und jede Form von „…ende/beendet/aufgelegt“, laeuft:false) nimmt den Kasten weg
//      und merkt sich den Anruf als beendet — spätere Ereignisse zu ihm (Prüf-Mara, Daumen, Werkzeug) werden ignoriert.
//   2. Einen NEUEN Kasten legen nur Ereignisse eines laufenden Gesprächs an (gewählt, angenommen, Satz, KI-Hinweis,
//      Aufnahme) — nie „aras_pruefung“ oder der Herzschlag.
//   3. Gürtel und Hosenträger: Der Abgleich mit GET /chef/aras/live/stand (alle 2 s, solange ein Kasten steht) nimmt
//      jeden Kasten weg, den der Server nicht mehr als laufend (Brücke) oder klingelnd (gewählt, kein Ende) kennt —
//      auch wenn das Ende-Ereignis verloren ging. Ein Herzschlag mit „0 laufend“ beendet alle Brücken-Gespräche.
// ═══════════════════════════════════════════════════════════════════════════

export interface LiveZeile { wer: "kunde" | "aras"; text: string }
export interface LiveSitzung {
  callId: number; personId: number | null; name: string | null; spielart: string; gespielt: string | null; probe: boolean;
  /** Ortszeit (ms), seit der das Gespräch läuft — für die Uhr im Kasten. */
  seit: number;
  zustand: string;
  zeilen: LiveZeile[];
  /** Wann zuletzt ein Satz kam (Welle bewegt sich). */
  zuletztRede: number;
  /** Wann die Seite den Anruf zuerst sah. */
  erstGesehen: number;
  /** Wann zuletzt ein Ereignis oder Abgleich ihn bestätigt hat. */
  zuletztBestaetigt: number;
  /** War er schon einmal in der Liste der Brücke (laufendes Gespräch)? Verschwindet er dort, ist er vorbei. */
  imKern: boolean;
  /** „Auflegen“ gedrückt — der Kasten sagt „legt auf …“, bis das Ende da ist. */
  endet: boolean;
}
export interface LiveStand { sitzungen: LiveSitzung[]; beendet: Record<string, number> }
export const LIVE_LEER: LiveStand = { sitzungen: [], beendet: {} };

/** Ein frisch gesehener Anruf wird nicht von einem Abgleich weggenommen, der vor ihm gestartet war. */
export const GNADE_MS = 2500;
/** Höchstens so lange gilt ein Anruf ohne Brücke als „klingelt“ (danach ist er auf dem Server ohnehin beendet). */
export const KLINGEL_HOECHSTENS_MS = 3 * 60_000;
/** Ein Kasten ohne jede Bestätigung (kein Ereignis, kein Abgleich) verschwindet spätestens nach dieser Zeit. */
export const STILL_HOECHSTENS_MS = 4 * 60_000;
/** So lange merkt sich die Seite beendete Anrufe (spätes Prüf-Mara-Urteil darf keinen Kasten wecken). */
export const BEENDET_MERKEN_MS = 30 * 60_000;
/** Mehr Kästen zeigt die Seite nicht (Stufe 3: höchstens 5 gleichzeitig). */
export const HOECHSTENS_KAESTEN = 6;

const START_ARTEN = new Set(["aras_gewaehlt", "aras_angenommen", "aras_transkript", "aras_ki_hinweis", "aras_aufnahme_ja", "aras_aufnahme_nein", "aras_hallo"]);
const NIE_LIVE = new Set(["aras_pruefung", "herzschlag", "verbunden", "nicht_verbunden", "aras_notaus", "aras_sperre_aufgehoben"]);
const ENDE_ARTEN = new Set(["aras_ende", "ende", "aras_beendet", "beendet", "aras_aufgelegt", "aufgelegt", "aras_mailbox", "anruf_ende", "aras_anruf_ende"]);

/** Ist dieses Ereignis das Ende eines Anrufs? Großzügig, damit auch ein neu benanntes Ende-Ereignis des Kerns greift. */
export function istEndeEreignis(e: any): boolean {
  const art = String(e?.art ?? "");
  if (ENDE_ARTEN.has(art) || /(^|_)(ende|beendet|aufgelegt)$/.test(art)) return true;
  return e?.laeuft === false || e?.status === "beendet" || e?.ende === true;
}

const zeilenDazu = (alt: LiveZeile[], neu: LiveZeile[]) => [...alt, ...neu].filter((z) => z.text.trim()).slice(-8);
const ohne = (stand: LiveStand, id: number, jetzt: number): LiveStand => ({
  sitzungen: stand.sitzungen.filter((s) => s.callId !== id),
  beendet: { ...stand.beendet, [String(id)]: jetzt },
});

function neueSitzung(id: number, e: any, jetzt: number): LiveSitzung {
  const spielart = String(e?.spielart ?? "");
  return {
    callId: id, personId: e?.personId != null ? Number(e.personId) : null, name: e?.name ? String(e.name) : null,
    spielart, gespielt: e?.gespielt ? String(e.gespielt) : null, probe: spielart === "probe" || e?.daten?.probe === true || e?.probe === true,
    seit: jetzt - Math.max(0, Number(e?.seitSek ?? 0)) * 1000, zustand: "", zeilen: [], zuletztRede: 0,
    erstGesehen: jetzt, zuletztBestaetigt: jetzt, imKern: false, endet: false,
  };
}

/** Ein Ereignis aus dem Live-Strom anwenden. Rein. */
export function ereignisAnwenden(stand: LiveStand, e: any, jetzt: number): LiveStand {
  const id = Number(e?.callId) || 0;
  if (!id) return stand;
  if (istEndeEreignis(e)) return ohne(stand, id, jetzt);
  const art = String(e?.art ?? "");
  if (NIE_LIVE.has(art)) return stand;
  if (stand.beendet[String(id)]) return stand; // vorbei — spätes Ereignis (Prüf-Mara, Daumen, Werkzeug) weckt nichts
  const alt = stand.sitzungen.find((s) => s.callId === id);
  if (!alt && !START_ARTEN.has(art)) return stand;
  const s: LiveSitzung = alt ? { ...alt } : neueSitzung(id, e, jetzt);
  s.zuletztBestaetigt = jetzt;
  if (e?.personId != null && s.personId == null) s.personId = Number(e.personId);
  if (!s.spielart && e?.spielart) s.spielart = String(e.spielart);
  if (e?.daten?.probe === true || e?.spielart === "probe") s.probe = true;
  if (art === "aras_transkript") {
    const text = String(e?.text ?? "").trim();
    if (text) { s.zeilen = zeilenDazu(s.zeilen, [{ wer: e?.wer === "kunde" ? "kunde" : "aras", text }]); s.zuletztRede = jetzt; }
    if (!s.zustand || s.zustand === "gewaehlt" || s.zustand === "klingelt") s.zustand = "angenommen";
  } else if (!s.endet) {
    s.zustand = art.replace(/^aras_/, "");
  }
  const rest = stand.sitzungen.filter((x) => x.callId !== id);
  return { ...stand, sitzungen: [...rest, s].sort((a, b) => a.erstGesehen - b.erstGesehen).slice(0, HOECHSTENS_KAESTEN) };
}

/** Was GET /chef/aras/live/stand liefert (je Anruf). */
export interface StandSitzung { callId: number; personId?: number | null; name?: string | null; spielart?: string; gespielt?: string | null; probe?: boolean; seitSek?: number; zustand?: string; letzteZeilen?: LiveZeile[]; angenommen?: boolean }

/**
 * Abgleich mit dem Server-Stand. `klingelt === null` heißt: Der Server kennt die Klingel-Liste nicht (älterer Stand) —
 * dann darf ein gewählter Anruf ohne Brücke höchstens KLINGEL_HOECHSTENS_MS stehen. Rein.
 */
export function abgleichen(stand: LiveStand, laufend: readonly StandSitzung[], klingelt: readonly StandSitzung[] | null, abgefragtAm: number, jetzt: number): LiveStand {
  const kern = new Map(laufend.filter((s) => Number(s.callId) > 0).map((s) => [Number(s.callId), s]));
  const klingel = klingelt ? new Map(klingelt.filter((s) => Number(s.callId) > 0).map((s) => [Number(s.callId), s])) : null;
  const beendet = { ...stand.beendet };
  const bleiben: LiveSitzung[] = [];
  for (const s of stand.sitzungen) {
    const k = kern.get(s.callId);
    if (k) {
      const zeilen = s.zeilen.length ? s.zeilen : (k.letzteZeilen ?? []).map((z) => ({ wer: z.wer === "kunde" ? "kunde" as const : "aras" as const, text: String(z.text ?? "") }));
      bleiben.push({ ...s, imKern: true, zuletztBestaetigt: jetzt, name: s.name ?? k.name ?? null, gespielt: s.gespielt ?? k.gespielt ?? null, personId: s.personId ?? (k.personId ?? null),
        spielart: s.spielart || String(k.spielart ?? ""), probe: s.probe || k.spielart === "probe" || k.probe === true, zeilen: zeilenDazu([], zeilen),
        zustand: s.endet ? "endet" : (k.zustand && k.zustand !== "ende" ? k.zustand : s.zustand) });
      continue;
    }
    if (s.imKern) { beendet[String(s.callId)] = jetzt; continue; } // war in der Brücke, jetzt nicht mehr → vorbei
    const kl = klingel?.get(s.callId);
    if (kl) { bleiben.push({ ...s, zuletztBestaetigt: jetzt, name: s.name ?? kl.name ?? null, gespielt: s.gespielt ?? kl.gespielt ?? null, zustand: s.endet ? "endet" : s.zustand && s.zustand !== "gewaehlt" ? s.zustand : "klingelt" }); continue; }
    if (s.erstGesehen > abgefragtAm - GNADE_MS) { bleiben.push(s); continue; } // zu frisch für diesen Abgleich
    if (klingel === null && jetzt - s.erstGesehen < KLINGEL_HOECHSTENS_MS && /^(gewaehlt|klingelt|waehlt|)$/.test(s.zustand)) { bleiben.push(s); continue; }
    beendet[String(s.callId)] = jetzt;
  }
  // Neu vom Server: nur, wenn der Abgleich NACH dem gemerkten Ende gestartet ist (ein Gespräch, das nach einer
  // gescheiterten Übergabe weiterläuft, kommt zurück — ein veralteter Abgleich weckt nichts).
  const da = new Set(bleiben.map((s) => s.callId));
  const dazu = (s: StandSitzung, imKern: boolean) => {
    const id = Number(s.callId);
    if (da.has(id)) return;
    const ende = beendet[String(id)];
    if (ende && ende >= abgefragtAm) return;
    delete beendet[String(id)];
    const n = neueSitzung(id, s, jetzt);
    n.imKern = imKern; n.zustand = imKern ? String(s.zustand ?? "") : "klingelt";
    n.zeilen = zeilenDazu([], (s.letzteZeilen ?? []).map((z) => ({ wer: z.wer === "kunde" ? "kunde" as const : "aras" as const, text: String(z.text ?? "") })));
    bleiben.push(n); da.add(id);
  };
  Array.from(kern.values()).forEach((s) => dazu(s, true));
  if (klingel) Array.from(klingel.values()).forEach((s) => dazu(s, false));
  return { sitzungen: bleiben.sort((a, b) => a.erstGesehen - b.erstGesehen).slice(0, HOECHSTENS_KAESTEN), beendet };
}

/** Herzschlag des Stroms: `laufend` als Zahl (heute) oder als Liste der Anrufe (falls der Kern sie mitschickt). Rein. */
export function herzschlagAnwenden(stand: LiveStand, e: any, jetzt: number): LiveStand {
  const l = e?.laufend;
  let ids: Set<number> | null = null;
  if (Array.isArray(l)) ids = new Set(l.map((x: any) => Number(typeof x === "object" ? x?.callId : x)).filter((n: number) => n > 0));
  else if (Array.isArray(e?.laufendeIds)) ids = new Set(e.laufendeIds.map(Number).filter((n: number) => n > 0));
  else if (Number(l) === 0) ids = new Set();
  if (!ids) return stand;
  const beendet = { ...stand.beendet };
  const sitzungen = stand.sitzungen.filter((s) => {
    if (!s.imKern || ids!.has(s.callId)) return true;
    beendet[String(s.callId)] = jetzt;
    return false;
  });
  return sitzungen.length === stand.sitzungen.length ? stand : { sitzungen, beendet };
}

/** „Auflegen“ gedrückt: der Kasten zeigt „legt auf …“. Rein. */
export function endetMarkieren(stand: LiveStand, id: number): LiveStand {
  return { ...stand, sitzungen: stand.sitzungen.map((s) => (s.callId === id ? { ...s, endet: true, zustand: "endet" } : s)) };
}

/** Alte Merker weg; ein Kasten ohne jede Bestätigung verschwindet nach STILL_HOECHSTENS_MS (Rettungsnetz). Rein. */
export function aufraeumen(stand: LiveStand, jetzt: number): LiveStand {
  const beendet: Record<string, number> = {};
  let geaendert = false;
  for (const [k, t] of Object.entries(stand.beendet)) { if (jetzt - t < BEENDET_MERKEN_MS) beendet[k] = t; else geaendert = true; }
  const sitzungen = stand.sitzungen.filter((s) => {
    const alt = jetzt - s.zuletztBestaetigt > STILL_HOECHSTENS_MS;
    if (alt) { beendet[String(s.callId)] = jetzt; geaendert = true; }
    return !alt;
  });
  return geaendert ? { sitzungen, beendet } : stand;
}

export type LiveAktion =
  | { typ: "ereignis"; e: any; jetzt: number }
  | { typ: "abgleich"; laufend: StandSitzung[]; klingelt: StandSitzung[] | null; abgefragtAm: number; jetzt: number }
  | { typ: "herz"; e: any; jetzt: number }
  | { typ: "endet"; callId: number }
  | { typ: "weg"; callId: number; jetzt: number }
  | { typ: "uhr"; jetzt: number }
  | { typ: "leeren" };

export function liveReduzieren(stand: LiveStand, a: LiveAktion): LiveStand {
  switch (a.typ) {
    case "ereignis": return ereignisAnwenden(stand, a.e, a.jetzt);
    case "abgleich": return abgleichen(stand, a.laufend, a.klingelt, a.abgefragtAm, a.jetzt);
    case "herz": return herzschlagAnwenden(stand, a.e, a.jetzt);
    case "endet": return endetMarkieren(stand, a.callId);
    case "weg": return !stand.sitzungen.some((s) => s.callId === a.callId) && stand.beendet[String(a.callId)] ? stand : ohne(stand, a.callId, a.jetzt);
    case "uhr": return aufraeumen(stand, a.jetzt);
    case "leeren": return LIVE_LEER;
    default: return stand;
  }
}
