// ═══════════════════════════════════════════════════════════════════════════
// EINSTELLUNGEN DES KI-RAUMS (E-409, 19.10.2026)
//
// Liest die Werte ALLER Register-Schlüssel (shared/fiaon-ki-schalter.ts) in
// einem Rutsch — aus fiaon_settings, mit ENV-Ersatz, wo ein Schlüssel heute
// noch aus der Umgebung kommt (postmeister_tag_euro ← POSTMEISTER_TAG_EURO) —
// und schreibt die Schlüssel, die keinen anderen Setzer haben (KI_SCHLUESSEL).
// Jeder andere Register-Schlüssel hat seinen Setzer; die Route sagt dann
// 409 „Setzer ist <route>“ — kein zweiter Schreibweg, keine zweite Wahrheit.
// ARAS-Schlüssel gehen über die Anbindung an einstellungSetzen (Team 1).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { REGISTER, KI_SCHLUESSEL, ARAS_SCHLUESSEL, NOTAUS_SCHALTER, ARAS_NOTAUS, zahlLesen, lexrSpielartenAn, lexrVermerkGueltig, registerEintrag, wertPruefen, wertAnzeige, wertOeffentlich, type RegisterEintrag } from "@shared/fiaon-ki-schalter";
import { aras, arasVerbunden, NICHT_VERBUNDEN } from "./fiaon-ki-aras-anbindung";

/** Schlüssel, die bis zum Eintrag in fiaon_settings aus der Umgebung kommen. */
const ENV_ERSATZ: Record<string, string> = { postmeister_tag_euro: "POSTMEISTER_TAG_EURO" };

export interface EinstellungenSicht {
  register: (Omit<RegisterEintrag, "jsonPruefen" | "muss"> & { muss?: string })[];
  werte: Record<string, string>;
  /** Welche Werte wirklich gespeichert sind (sonst gilt die Vorgabe). */
  gesetzt: Record<string, boolean>;
  arasVerbunden: boolean;
}

export async function einstellungenLesen(): Promise<EinstellungenSicht> {
  const schluessel = REGISTER.map((e) => e.schluessel);
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`.catch(() => [])) as any[];
  const roh = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const werte: Record<string, string> = {};
  const gesetzt: Record<string, boolean> = {};
  for (const e of REGISTER) {
    let w = roh.get(e.schluessel);
    if ((w == null || w === "") && ENV_ERSATZ[e.schluessel] && process.env[ENV_ERSATZ[e.schluessel]]) w = String(process.env[ENV_ERSATZ[e.schluessel]]);
    gesetzt[e.schluessel] = roh.has(e.schluessel);
    // E-409 Fund 11: Justins Probe-Nummer verlässt den Server nur verdeckt (die letzten 3 Ziffern).
    werte[e.schluessel] = e.geheim ? wertOeffentlich(e.schluessel, w ?? "") : (w == null ? e.vorgabe : wertAnzeige(e, w));
  }
  return {
    register: REGISTER.map(({ jsonPruefen: _j, muss, ...rest }) => ({ ...rest, ...(muss ? { muss: muss.source } : {}) })),
    werte, gesetzt, arasVerbunden: arasVerbunden(),
  };
}

export type SetzErgebnis = { ok: true; schluessel: string; wert: string } | { ok: false; status: 400 | 404 | 409; fehler: string };

/**
 * Einen Schlüssel setzen — nur KI_SCHLUESSEL hier, ARAS über die Anbindung; alles andere → sein Setzer.
 * Die Grenze ist `wertPruefen` aus dem Register (dieselbe wie in der Oberfläche).
 */
export async function einstellungSetzen(schluessel: string, wert: unknown, von: string): Promise<SetzErgebnis> {
  const e = registerEintrag(schluessel);
  if (!e) return { ok: false, status: 404, fehler: "Diesen Schalter gibt es nicht im Register." };
  const p = wertPruefen(e, wert);
  if (!p.ok) return { ok: false, status: 400, fehler: p.fehler };
  const lexr = await lexrPruefen(schluessel, p.wert);
  if (lexr) return lexr;
  if (ARAS_SCHLUESSEL.includes(schluessel)) {
    const a = aras();
    if (!a?.plan?.einstellungSetzen) return { ok: false, status: 404, fehler: NICHT_VERBUNDEN };
    try {
      await a.plan.einstellungSetzen(schluessel, p.wert, von);
    } catch (err) {
      return { ok: false, status: 400, fehler: String((err as Error)?.message ?? err).slice(0, 200) };
    }
    console.log(`[KI-EINSTELLUNG] ${schluessel} = ${wertOeffentlich(schluessel, p.wert).slice(0, 60)} (${von}, über Aras)`);
    return { ok: true, schluessel, wert: p.wert };
  }
  if (!KI_SCHLUESSEL.includes(schluessel)) return { ok: false, status: 409, fehler: `Setzer ist ${e.setzer.route}` };
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${p.wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  console.log(`[KI-EINSTELLUNG] ${schluessel} = ${wertOeffentlich(schluessel, p.wert).slice(0, 60)} (${von})`);
  // E-458: Die KI-Kasse liest ihre Schalter zwischengespeichert — nach dem Speichern sofort neu.
  if (/^ki_(kasse|modell)_/.test(schluessel)) await import("./fiaon-ki-kasse").then((m) => m.kasseFrisch()).catch(() => {});
  return { ok: true, schluessel, wert: p.wert };
}

/**
 * E-409 Fund 17 (20.10.2026, SCHNITTSTELLE § 15 Abnahme 7): Werbe-Anrufe (aras_spielarten lead, stufe_b, rueckholung) erst
 * mit dem Register-Vermerk ki_lexr_freigabe („LEXR-Freigabe am …“) — hier, auf dem Server, nicht nur als Hinweis im Satz.
 * Umgekehrt lässt sich der Vermerk nicht löschen, solange eine dieser Spielarten an ist. null = in Ordnung.
 */
export async function lexrPruefen(schluessel: string, wert: string): Promise<SetzErgebnis | null> {
  const lesen = async (k: string) => {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[];
    return z?.value == null ? null : String(z.value);
  };
  if (schluessel === "aras_spielarten") {
    const an = lexrSpielartenAn(wert);
    if (!an.length) return null;
    // Lesefehler = kein Vermerk (lieber nein als ein Werbe-Anruf ohne Freigabe).
    const vermerk = await lesen("ki_lexr_freigabe").catch(() => null);
    if (lexrVermerkGueltig(vermerk)) return null;
    return { ok: false, status: 400, fehler: `${an.join(", ")} erst nach der LEXR-Freigabe — trag sie unter Einstellungen › Leitplanken ein („LEXR-Freigabe am …“).` };
  }
  if (schluessel === "ki_lexr_freigabe" && !lexrVermerkGueltig(wert)) {
    const aktiv = lexrSpielartenAn(await lesen("aras_spielarten").catch(() => null));
    if (aktiv.length) return { ok: false, status: 409, fehler: `Erst ${aktiv.join(", ")} in den Aras-Spielarten ausschalten — dann lässt sich der Vermerk löschen.` };
  }
  return null;
}

/** Einen Zahlenwert lesen, mit Vorgabe und Grenze des Registers — für Leser wie den Prüf-Takt. */
export async function registerZahl(schluessel: string): Promise<number> {
  const e = registerEintrag(schluessel);
  const vorgabe = Number(e?.vorgabe ?? 0) || 0;
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel}`) as any[];
    // E-409 Fund 14: leer = Vorgabe (vorher wurde „“ zu 0), eine eingetragene 0 bleibt 0.
    return zahlLesen(z?.value, vorgabe, e?.min ?? Number.NEGATIVE_INFINITY, e?.max ?? Number.POSITIVE_INFINITY);
  } catch { return vorgabe; }
}

/** Einen Textwert lesen (Vorgabe aus dem Register). */
export async function registerWert(schluessel: string): Promise<string> {
  const e = registerEintrag(schluessel);
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel}`) as any[];
    const w = z?.value == null ? "" : String(z.value);
    return w === "" ? (e?.vorgabe ?? "") : (e ? wertAnzeige(e, w) : w);
  } catch { return e?.vorgabe ?? ""; }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOT-AUS MARA (KI-Team › Heute) — ALLE Mara-Wege in einem Zug, „Wieder an“ stellt GENAU den Stand von vorher her
//
// E-409 Funde 2 + 9 (20.10.2026): Bis heute hielt der Not-Aus nur Mail-Aktion, WhatsApp-Antworten und Postfach an —
// WhatsApp-Nachfassen, die Nachfass-Mail nach 2× nicht erreicht und die Wege aus E-406 (B1 Raten-Mail, B2 KYC +
// Umhängen, C1 Anliegen, C2 Nacharbeit) liefen weiter. Und „Wieder an“ schaltete alles AN — auch, was Justin vorher
// bewusst aus hatte. Jetzt: vor dem Anhalten wird der Stand jedes Schalters gemerkt (fiaon_settings.mara_notaus_vorher,
// „fehlt“ = Vorgabe), „Wieder an“ stellt genau diesen Stand her und löscht den Merker. Zweimal anhalten überschreibt
// den Merker nie. Solange der Merker steht, laufen auch Maras Daueraufträge nicht (fiaon-mara-auftrag.ts).
// ═══════════════════════════════════════════════════════════════════════════
export const NOTAUS_VORHER = "mara_notaus_vorher";
type LaufPool = typeof sqlPool;

/** Ist ein roher Wert „an“? (Vorgabe, wenn er fehlt.) Rein. */
export function notausWertAn(roh: string | null | undefined, vorgabeAn: boolean): boolean {
  const w = String(roh ?? "").trim().toLowerCase();
  if (!w) return vorgabeAn;
  return !["aus", "0", "nein", "false", "off"].includes(w);
}

export interface NotausStand {
  aktiv: boolean; seit: string | null; von: string | null;
  /** Je Weg: jetzt an/aus — und (wenn angehalten) wie er VOR dem Not-Aus stand. */
  wege: { schluessel: string; label: string; an: boolean; vorherAn: boolean | null }[];
  /** Aras im selben Not-Aus (sein EINER Schlüssel aras_notaus, an = angehalten). null = Aras gibt es hier nicht. */
  aras: { verbunden: boolean; angehalten: boolean; vorherAngehalten: boolean | null } | null;
}

function merkerLesen(roh: unknown): { am: string | null; von: string | null; werte: Record<string, string | null> } | null {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object" || !o.werte || typeof o.werte !== "object") return null;
  return { am: o.am ?? null, von: o.von ?? null, werte: o.werte };
}

// ── ARAS IM SELBEN NOT-AUS (E-409 × E-408, 20.10.2026) ─────────────────────────────────────────────────────────
// Der Not-Aus im KI-Team hält auch Aras an — mit SEINEM einen Schlüssel und SEINEN Funktionen (Team 1, über die
// Anbindung): waehler.notaus(von, grund) setzt aras_notaus = an und beendet laufende Gespräche mit dem Abschiedssatz
// (notausAlle in fiaon-aras-bruecke.ts); waehler.start(von) setzt aras_notaus = aus. Kein zweiter Not-Aus-Schlüssel für
// Aras, kein direktes Schreiben in aras_*, und aras_an (der Betriebsschalter) bleibt unberührt. Der Merker
// mara_notaus_vorher merkt sich aras_notaus wie jeden Mara-Weg: „Wieder an“ startet Aras nur, wenn er VOR dem Not-Aus
// nicht schon angehalten war. Ist Aras nicht verbunden, fasst der Not-Aus ihn nicht an (und sagt das).
function arasWaehler(): { notaus: (von: string, grund: string) => Promise<{ beendet: number }>; start: (von: string) => Promise<void> } | null {
  const w = aras()?.waehler;
  return w && typeof w.notaus === "function" && typeof w.start === "function" ? w : null;
}
const arasAngehalten = (roh: string | null | undefined) => String(roh ?? "").trim().toLowerCase() === "an";

export async function maraNotausStand(lauf: LaufPool = sqlPool): Promise<NotausStand> {
  const schluessel = [...NOTAUS_SCHALTER.map((n) => n.schluessel), NOTAUS_VORHER, ARAS_NOTAUS];
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`) as any[];
  const roh = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const merker = roh.has(NOTAUS_VORHER) ? merkerLesen(roh.get(NOTAUS_VORHER)) : null;
  const arasImMerker = !!merker && ARAS_NOTAUS in merker.werte;
  const verbunden = !!arasWaehler();
  return {
    aktiv: !!merker, seit: merker?.am ?? null, von: merker?.von ?? null,
    wege: NOTAUS_SCHALTER.map((n) => ({
      schluessel: n.schluessel, label: n.label, an: notausWertAn(roh.get(n.schluessel), n.vorgabeAn),
      vorherAn: merker ? notausWertAn(merker.werte[n.schluessel] ?? null, n.vorgabeAn) : null,
    })),
    aras: verbunden || roh.has(ARAS_NOTAUS) || arasImMerker
      ? { verbunden, angehalten: arasAngehalten(roh.get(ARAS_NOTAUS)), vorherAngehalten: arasImMerker ? arasAngehalten(merker!.werte[ARAS_NOTAUS]) : null }
      : null,
  };
}

/** Steht Maras Not-Aus gerade? (Daueraufträge warten dann.) Lesefehler = ja (lieber nichts tun). */
export async function maraNotausAktiv(lauf: LaufPool = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT 1 AS da FROM fiaon_settings WHERE key = ${NOTAUS_VORHER}`) as any[];
    return !!z;
  } catch { return true; }
}

export interface NotausAras { verbunden: boolean; angehalten: boolean; beendet?: number; text: string; fehler?: string }
export type NotausErgebnis =
  | { ok: true; aktiv: boolean; geaendert: { schluessel: string; label: string; vorher: string | null; nachher: string | null }[]; aras: NotausAras | null }
  | { ok: false; status: 409; fehler: string };

const ARAS_LABEL = "Aras (Telefon)";

/**
 * an = true: anhalten (Stand merken, alle Wege aus, Aras über seinen Not-Aus). an = false: „Wieder an“ — genau den
 * gemerkten Stand zurück. In EINER Transaktion mit Sperre auf dem Merker: zwei Klicks gleichzeitig verlieren nichts.
 * Aras läuft NACH der Transaktion (Team 1 schreibt über seinen eigenen Setzer; ein Gespräch zu beenden dauert Sekunden).
 */
export async function maraNotaus(an: boolean, von: string, lauf: LaufPool = sqlPool): Promise<NotausErgebnis> {
  const schluessel = NOTAUS_SCHALTER.map((n) => n.schluessel);
  const w = arasWaehler();
  const erg = await lauf.begin(async (tx: any) => {
    // Eine Sperre nur für diesen Not-Aus (bis zum Ende der Transaktion) — zwei Klicks gleichzeitig laufen nacheinander.
    await tx`SELECT pg_advisory_xact_lock(409406001)`;
    const [m] = (await tx`SELECT value FROM fiaon_settings WHERE key = ${NOTAUS_VORHER}`) as any[];
    const merker = m ? merkerLesen(m.value) : null;
    const jetzt = new Map<string, string | null>(((await tx`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[...schluessel, ARAS_NOTAUS]})`) as any[]).map((z) => [String(z.key), z.value == null ? null : String(z.value)]));
    const arasJetzt = jetzt.get(ARAS_NOTAUS) ?? null;
    const geaendert: { schluessel: string; label: string; vorher: string | null; nachher: string | null }[] = [];
    if (an) {
      if (!merker) {
        const werte: Record<string, string | null> = {};
        for (const k of schluessel) werte[k] = jetzt.get(k) ?? null;
        if (w) werte[ARAS_NOTAUS] = arasJetzt;
        await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${NOTAUS_VORHER}, ${JSON.stringify({ am: new Date().toISOString(), von: String(von).slice(0, 120), werte })}, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      } else if (w && !(ARAS_NOTAUS in merker.werte)) {
        // Aras kam erst nach dem ersten Klick dazu: nur SEINEN Stand nachtragen — der Rest des Merkers bleibt, wie er war.
        await tx`UPDATE fiaon_settings SET value = ${JSON.stringify({ am: merker.am, von: merker.von, werte: { ...merker.werte, [ARAS_NOTAUS]: arasJetzt } })}, updated_at = NOW()
                  WHERE key = ${NOTAUS_VORHER}`;
      }
      for (const n of NOTAUS_SCHALTER) {
        if ((jetzt.get(n.schluessel) ?? null) === "aus") continue;
        await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${n.schluessel}, 'aus', NOW())
                 ON CONFLICT (key) DO UPDATE SET value = 'aus', updated_at = NOW()`;
        geaendert.push({ schluessel: n.schluessel, label: n.label, vorher: jetzt.get(n.schluessel) ?? null, nachher: "aus" });
      }
      return { ok: true as const, aktiv: true, geaendert, arasJetzt, arasZiel: undefined as string | null | undefined };
    }
    if (!merker) return { ok: false as const, status: 409 as const, fehler: "Mara ist nicht angehalten — es gibt keinen Stand zum Zurückstellen." };
    for (const n of NOTAUS_SCHALTER) {
      if (!(n.schluessel in merker.werte)) continue;
      const alt = merker.werte[n.schluessel];
      if (alt == null) await tx`DELETE FROM fiaon_settings WHERE key = ${n.schluessel}`;
      else await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${n.schluessel}, ${String(alt)}, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      if ((jetzt.get(n.schluessel) ?? null) !== alt) geaendert.push({ schluessel: n.schluessel, label: n.label, vorher: jetzt.get(n.schluessel) ?? null, nachher: alt });
    }
    await tx`DELETE FROM fiaon_settings WHERE key = ${NOTAUS_VORHER}`;
    return { ok: true as const, aktiv: false, geaendert, arasJetzt, arasZiel: ARAS_NOTAUS in merker.werte ? merker.werte[ARAS_NOTAUS] ?? null : undefined };
  });
  if (!erg.ok) return erg;

  // ── Aras — über SEINE Funktionen, nach dem Commit ────────────────────────────────────────────────────────────
  let arasTeil: NotausAras | null = null;
  if (an) {
    if (w) {
      try {
        const r = await w.notaus(von, "Not-Aus im KI-Team");
        if (!arasAngehalten(erg.arasJetzt)) erg.geaendert.push({ schluessel: ARAS_NOTAUS, label: ARAS_LABEL, vorher: erg.arasJetzt, nachher: "an" });
        const n = Number(r?.beendet ?? 0);
        arasTeil = { verbunden: true, angehalten: true, beendet: n, text: n ? `Aras angehalten — ${n === 1 ? "ein Gespräch endet" : `${n} Gespräche enden`} mit dem Abschiedssatz.` : "Aras angehalten — er wählt nicht mehr." };
      } catch (e) {
        const f = String((e as Error)?.message ?? e).slice(0, 160);
        console.error("[KI-EINSTELLUNG] Not-Aus Aras:", f);
        arasTeil = { verbunden: true, angehalten: false, text: "Aras ließ sich NICHT anhalten — bitte in KI-Team › Aras den Not-Aus drücken.", fehler: f };
      }
    } else if (erg.arasJetzt != null) {
      arasTeil = { verbunden: false, angehalten: arasAngehalten(erg.arasJetzt), text: "Aras ist nicht verbunden — der Not-Aus fasst ihn nicht an." };
    }
  } else if (erg.arasZiel !== undefined) {
    if (arasAngehalten(erg.arasZiel)) {
      arasTeil = { verbunden: !!w, angehalten: true, text: "Aras war schon vor dem Not-Aus angehalten — er bleibt es." };
    } else if (w) {
      try {
        await w.start(von);
        if (arasAngehalten(erg.arasJetzt)) erg.geaendert.push({ schluessel: ARAS_NOTAUS, label: ARAS_LABEL, vorher: erg.arasJetzt, nachher: "aus" });
        arasTeil = { verbunden: true, angehalten: false, text: "Aras ist wieder frei (sein Schalter „Aras wählt“ gilt wie vorher)." };
      } catch (e) {
        const f = String((e as Error)?.message ?? e).slice(0, 160);
        console.error("[KI-EINSTELLUNG] Wieder an Aras:", f);
        arasTeil = { verbunden: true, angehalten: true, text: "Aras ließ sich NICHT wieder starten — bitte in KI-Team › Aras „Wieder an“ drücken.", fehler: f };
      }
    } else {
      arasTeil = { verbunden: false, angehalten: arasAngehalten(erg.arasJetzt), text: "Aras ist nicht verbunden — sein Not-Aus bleibt, bis du ihn in KI-Team › Aras löst." };
    }
  }
  const ergebnis: NotausErgebnis = { ok: true, aktiv: erg.aktiv, geaendert: erg.geaendert, aras: arasTeil };
  console.log(`[KI-EINSTELLUNG] Mara ${an ? "NOT-AUS" : "wieder an (Stand von vorher)"} (${von}): ${ergebnis.geaendert.map((g) => `${g.schluessel} ${g.vorher ?? "Vorgabe"} → ${g.nachher ?? "Vorgabe"}`).join(", ") || "nichts zu ändern"}${arasTeil ? ` · ${arasTeil.text}` : ""}`);
  return ergebnis;
}
