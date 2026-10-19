// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WAS HAT DER KUNDE IM ANGEBOT WIE LANGE GELESEN?
// Register E-406 (19.10.2026), Nachtrag zu den Angebot-Aufrufen (fiaon-global-angebot-aufrufe.ts)
//
// Justin (WEiTSICHT SWISS, Angebot versendet): „Ich möchte live wissen, was er wie, wo macht — wie lange, was hat er
// sich angesehen?“
//
// ── WAS GEMESSEN WIRD ──────────────────────────────────────────────────────
// Die Angebotsseite (client/src/lib/angebot-lesen.ts) schaut jede Sekunde, welcher Abschnitt (<section aria-label>)
// gerade in der Bildschirmmitte steht — nur solange die Seite sichtbar ist UND sich in der letzten Minute etwas
// bewegt hat (scrollen, tippen, Maus). Leerlauf und Hintergrund-Tabs zählen nicht. Alle 15 Sekunden und beim
// Verlassen schickt sie die SUMMEN je Abschnitt (POST …/:token/lesen). Kein Cookie, keine Kennung über den Besuch
// hinaus: der Besuch ist eine Zufallszahl, die nur im Speicher der offenen Seite lebt.
// Gespeichert: je Besuch EINE Zeile (fiaon_global_angebot_lesen) — Summen je Abschnitt, aktive Sekunden gesamt,
// tiefster erreichter Abschnitt, Gerät, Ort (vom passenden Aufruf), intern/automatisch wie bei den Aufrufen.
// Die Summen werden je Abschnitt nur nach OBEN übernommen (GREATEST) — doppelte oder verspätete Sendungen schaden nicht.
//
// ── DIE MELDUNG ────────────────────────────────────────────────────────────
// Kommt nichts mehr (6 Minuten still, nach „Seite verlassen“ 90 Sekunden), geht EIN Lesebericht an js@fiaon.com:
// aktive Lesezeit, bis wohin er kam und jeder Abschnitt mit Dauer. Liest er danach weiter (≥ 30 Sekunden mehr),
// kommt beim nächsten Stillstand ein Nachtrag. Nur Kundenbesuche — du/Team/automatisch nie.
// Startet der Server zwischendurch neu, holt der Stundenlauf (globalAngebotLauf → leseLauf) liegengebliebene Berichte nach.
//
// ── SPEICHERDAUER ─────────────────────────────────────────────────────────
// Wie die Aufrufe: 90 Tage nach Annahme, Rückzug bzw. Ende der Gültigkeit (loeschfaelligeAngebote) — leseLauf löscht.
// Der Vertrag bleibt unberührt (kein text_hash, kein PDF). Der Hinweis auf der Seite (ANGEBOT_AUFRUF_HINWEIS) nennt
// die gelesenen Abschnitte mit.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { istRoboterUnterschrift } from "./fiaon-vertrieb-zusage";
import { angebotTokenPruefen, ensureAngebotTabellen } from "./fiaon-global-angebot";
import {
  AUFRUF_CHEF_PFAD, AUFRUF_MELDUNG_AN, aufrufIntern, aufrufAufgabeSchluessel, loeschfaelligeAngebote, meldungKunde, ortText, zeitLang,
  geraetAus, ortAus, type AufrufKontext, type MeldungLage,
} from "./fiaon-global-angebot-aufrufe";
import { angebotKundeName } from "@shared/fiaon-global-angebot";
import { absoluteUrl } from "../fiaon-base-url";

export const LESEN_STILL_MIN = 6;
export const LESEN_ENDE_SEK = 90;
export const LESEN_NACHTRAG_SEK = 30;
const LESEN_MAX_SEK = 6 * 3600;
const LESEN_TAGES_DECKEL = 300;

export interface LeseAbschnitt { k: string; t: string; o: number; s: number }
export interface LeseNutzlast { besuch: string; gesamt: number; ende: boolean; abschnitte: LeseAbschnitt[] }

/** Prüft und säubert, was die Seite schickt. Rein — null = verwerfen. */
export function leseNutzlastAus(roh: any): LeseNutzlast | null {
  if (!roh || typeof roh !== "object") return null;
  const besuch = String(roh.besuch ?? "").toLowerCase();
  if (!/^[a-z0-9-]{8,40}$/.test(besuch)) return null;
  const zahl = (v: unknown, max: number) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
  const abschnitte: LeseAbschnitt[] = [];
  for (const a of Array.isArray(roh.abschnitte) ? roh.abschnitte.slice(0, 40) : []) {
    const k = String(a?.k ?? "").toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(k) || abschnitte.some((x) => x.k === k)) continue;
    const t = String(a?.t ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || k;
    abschnitte.push({ k, t, o: zahl(a?.o, 99), s: zahl(a?.s, LESEN_MAX_SEK) });
  }
  return { besuch, gesamt: zahl(roh.gesamt, LESEN_MAX_SEK), ende: roh.ende === true, abschnitte };
}

/** Alte Summen + neue Summen → je Abschnitt das Größere. Rein. */
export function leseZusammenfuehren(alt: Record<string, { t: string; o: number; s: number }>, neu: LeseAbschnitt[]): Record<string, { t: string; o: number; s: number }> {
  const aus: Record<string, { t: string; o: number; s: number }> = { ...(alt || {}) };
  for (const a of neu) {
    const v = aus[a.k];
    aus[a.k] = { t: a.t || v?.t || a.k, o: a.o, s: Math.max(v?.s ?? 0, a.s) };
  }
  return aus;
}

// ── Text (rein) ──────────────────────────────────────────────────────────────
export function dauerText(sek: number): string {
  const s = Math.max(0, Math.round(sek));
  if (s < 60) return `${s} Sek.`;
  const m = Math.floor(s / 60); const r = s % 60;
  if (m < 60) return r ? `${m} Min. ${r} Sek.` : `${m} Min.`;
  return `${Math.floor(m / 60)} Std. ${m % 60} Min.`;
}
const mmss = (sek: number) => `${Math.floor(sek / 60)}:${String(Math.round(sek) % 60).padStart(2, "0")}`;

export interface LeseZeile {
  id: number; angebot_id: number; besuch: string; beginn: Date | string; zuletzt: Date | string; sekunden: number;
  abschnitte: Record<string, { t: string; o: number; s: number }>; tiefste: number | null; anzahl: number | null;
  geraet: string | null; land: string | null; region: string | null; stadt: string | null; gemeldet_sek: number;
}
export interface LeseLage { ref: string; kunde: MeldungLage["kunde"]; z: LeseZeile; nachtrag: boolean }

const wer = (k: MeldungLage["kunde"]) => (k.anrede === "Herr" || k.anrede === "Frau") && String(k.nachname || "").trim()
  ? `${k.anrede} ${String(k.nachname).trim()}` : angebotKundeName(k) || "Der Kunde";
const sein = (k: MeldungLage["kunde"]) => (k.anrede === "Herr" ? "seinem" : k.anrede === "Frau" ? "ihrem" : "dem");

export function leseReihen(z: Pick<LeseZeile, "abschnitte">): { k: string; t: string; o: number; s: number }[] {
  return Object.entries(z.abschnitte || {}).map(([k, v]) => ({ k, ...v })).filter((a) => a.s > 0).sort((a, b) => a.o - b.o);
}

/** Betreff + Text des Leseberichts. Rein. */
export function leseberichtMail(l: LeseLage): { betreff: string; text: string } {
  const reihen = leseReihen(l.z);
  const top = [...reihen].sort((a, b) => b.s - a.s)[0];
  const betreff = `${wer(l.kunde)} hat ${dauerText(l.z.sekunden)} gelesen${top ? ` — am längsten: ${top.t} (${mmss(top.s)})` : ""}${l.nachtrag ? " · Nachtrag" : ""}`;
  const max = Math.max(1, ...reihen.map((r) => r.s));
  const ort = ortText(l.z);
  const tief = l.z.tiefste != null && l.z.anzahl ? reihen.find((r) => r.o === l.z.tiefste)?.t : null;
  const firma = l.kunde.firma ? ` (${l.kunde.firma})` : "";
  return {
    betreff: betreff.length > 160 ? `${betreff.slice(0, 159)}…` : betreff,
    text: [
      "Hallo Justin,",
      "",
      `${angebotKundeName(l.kunde) || "Der Kunde"}${firma} hat ${l.nachtrag ? "weiter " : ""}in ${sein(l.kunde)} Angebot ${l.ref} gelesen — ${zeitLang(l.z.beginn)} bis ${zeitLang(l.z.zuletzt).split(", ")[1] ?? ""}, ${l.z.geraet || "Gerät unbekannt"}, ${ort}.`,
      "",
      `Aktive Lesezeit: ${dauerText(l.z.sekunden)}${tief ? ` · am weitesten gekommen bis „${tief}“ (Abschnitt ${(l.z.tiefste ?? 0) + 1} von ${l.z.anzahl})` : ""}.`,
      "",
      "So lange stand welcher Abschnitt auf seinem Bildschirm:",
      ...(reihen.length
        ? reihen.map((r) => `${mmss(r.s).padStart(5, " ")}  ${"▇".repeat(Math.max(1, Math.round((r.s / max) * 12)))}  ${r.t}${r.s < 5 ? " (nur überflogen)" : ""}`)
        : ["· kein Abschnitt lange genug in der Mitte"]),
      "",
      "Gezählt wird nur, solange die Seite sichtbar ist und er sich bewegt (scrollen, tippen, Maus) — Leerlauf zählt nicht. "
        + "Der Bericht kommt, wenn er die Seite verlässt oder 6 Minuten nichts mehr tut; liest er weiter, kommt ein Nachtrag.",
    ].join("\n"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie Migration 116 — additiv. */
export function ensureLeseTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_angebot_lesen (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          besuch VARCHAR(40) NOT NULL,
          beginn TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zuletzt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sekunden INTEGER NOT NULL DEFAULT 0,
          abschnitte JSONB NOT NULL DEFAULT '{}'::jsonb,
          tiefste SMALLINT,
          anzahl SMALLINT,
          geraet TEXT,
          land VARCHAR(2),
          region TEXT,
          stadt TEXT,
          intern BOOLEAN NOT NULL DEFAULT FALSE,
          roboter BOOLEAN NOT NULL DEFAULT FALSE,
          gemeldet_sek INTEGER NOT NULL DEFAULT 0,
          gemeldet_am TIMESTAMPTZ,
          meldung_ergebnis TEXT,
          UNIQUE (angebot_id, besuch)
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_angebot_lesen_offen_idx ON fiaon_global_angebot_lesen (zuletzt) WHERE NOT intern AND NOT roboter`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

const zeileAus = (x: any): LeseZeile => ({
  ...x, id: Number(x.id), angebot_id: Number(x.angebot_id), sekunden: Number(x.sekunden || 0), gemeldet_sek: Number(x.gemeldet_sek || 0),
  tiefste: x.tiefste != null ? Number(x.tiefste) : null, anzahl: x.anzahl != null ? Number(x.anzahl) : null,
  abschnitte: typeof x.abschnitte === "string" ? JSON.parse(x.abschnitte) : (x.abschnitte || {}),
});

/** Eine Sendung der Seite verbuchen. Wirft nie nach außen (die Route antwortet sofort 204). */
export async function lesenMerken(token: string, roh: unknown, k: AufrufKontext & { anzahl?: number }): Promise<void> {
  const t = angebotTokenPruefen(token);
  const n = leseNutzlastAus(roh);
  if (!t || !n) return;
  await ensureAngebotTabellen();
  await ensureLeseTabelle();
  const [a] = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE angebot_ref = ${t.ref} LIMIT 1`) as any[];
  if (!a) return;
  const angebotId = Number(a.id);
  if ((await loeschfaelligeAngebote([angebotId])).length) return;
  const roboter = istRoboterUnterschrift(k.ip || null, k.userAgent || null).roboter;
  const intern = await aufrufIntern(k);
  const tiefste = n.abschnitte.length ? Math.max(...n.abschnitte.map((x) => x.o)) : null;
  const anzahl = Math.max(0, Math.min(99, Math.trunc(Number(k.anzahl) || 0))) || null;
  const zeile = await sqlPool.begin(async (tx: any) => {
    const [alt] = (await tx`SELECT * FROM fiaon_global_angebot_lesen WHERE angebot_id = ${angebotId} AND besuch = ${n.besuch} FOR UPDATE`) as any[];
    if (!alt) {
      const [c] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_lesen WHERE angebot_id = ${angebotId} AND beginn > NOW() - interval '1 day'`) as any[];
      if (Number(c?.n ?? 0) >= LESEN_TAGES_DECKEL) return null;
      // Ort: vom jüngsten passenden Aufruf (der hat die Stadt schon nachgeschlagen) — sonst aus den Kopfzeilen.
      const [auf] = (await tx`
        SELECT land, region, stadt FROM fiaon_global_angebot_aufrufe
         WHERE angebot_id = ${angebotId} AND intern = ${!!intern} AND roboter = ${roboter} AND am > NOW() - interval '3 hours'
         ORDER BY am DESC LIMIT 1`.catch(() => [])) as any[];
      const ort = auf ?? ortAus(k.kopf || {});
      const abschnitte = leseZusammenfuehren({}, n.abschnitte);
      const [neu] = (await tx`
        INSERT INTO fiaon_global_angebot_lesen (angebot_id, besuch, sekunden, abschnitte, tiefste, anzahl, geraet, land, region, stadt, intern, roboter)
        VALUES (${angebotId}, ${n.besuch}, ${n.gesamt}, ${sqlPool.json(abschnitte)}, ${tiefste}, ${anzahl}, ${geraetAus(k.userAgent)},
                ${ort.land ?? null}, ${ort.region ?? null}, ${ort.stadt ?? null}, ${!!intern}, ${roboter})
        RETURNING *`) as any[];
      return zeileAus(neu);
    }
    const z = zeileAus(alt);
    const abschnitte = leseZusammenfuehren(z.abschnitte, n.abschnitte);
    const [neu] = (await tx`
      UPDATE fiaon_global_angebot_lesen
         SET sekunden = GREATEST(sekunden, ${n.gesamt}), abschnitte = ${sqlPool.json(abschnitte)},
             tiefste = GREATEST(COALESCE(tiefste, 0), ${tiefste ?? 0}), anzahl = COALESCE(${anzahl}, anzahl), zuletzt = NOW()
       WHERE id = ${z.id} RETURNING *`) as any[];
    return zeileAus(neu);
  });
  if (!zeile || intern || roboter) return;
  planen(zeile.id, n.ende ? LESEN_ENDE_SEK * 1000 : LESEN_STILL_MIN * 60_000);
}

// ── Der Bericht ──────────────────────────────────────────────────────────────
const uhren = new Map<number, ReturnType<typeof setTimeout>>();
function planen(id: number, ms: number): void {
  const alt = uhren.get(id);
  if (alt) clearTimeout(alt);
  const u = setTimeout(() => {
    uhren.delete(id);
    void leseberichtSenden(id).catch((e) => console.error(`[FIAON-ANGEBOT] Lesebericht ${id}:`, e instanceof Error ? e.message : e));
  }, ms);
  (u as any).unref?.();
  uhren.set(id, u);
}

async function leseLage(id: number): Promise<LeseLage | null> {
  const [r] = (await sqlPool`
    SELECT l.*, a.angebot_ref, a.kunde FROM fiaon_global_angebot_lesen l JOIN fiaon_global_angebote a ON a.id = l.angebot_id
     WHERE l.id = ${id} LIMIT 1`) as any[];
  if (!r) return null;
  let kunde: any = r.kunde;
  if (typeof kunde === "string") { try { kunde = JSON.parse(kunde); if (typeof kunde === "string") kunde = JSON.parse(kunde); } catch { kunde = {}; } }
  const z = zeileAus(r);
  // Nachtrag = es gab schon einen Bericht (meldung_ergebnis steht erst nach dem ersten Senden).
  return { ref: String(r.angebot_ref), kunde: meldungKunde(kunde), z, nachtrag: !!r.meldung_ergebnis };
}

/** Schickt den Bericht, wenn es Neues gibt (erstmals ≥ 10 Sek., als Nachtrag ≥ 30 Sek. mehr). Gibt das Ergebnis zurück. */
export async function leseberichtSenden(id: number): Promise<string | null> {
  // Erst vormerken (nur einer gewinnt), dann senden — zwei Läufe schicken nie doppelt.
  const [m] = (await sqlPool`
    UPDATE fiaon_global_angebot_lesen SET gemeldet_sek = sekunden, gemeldet_am = NOW()
     WHERE id = ${id} AND NOT intern AND NOT roboter
       AND sekunden >= CASE WHEN gemeldet_sek = 0 THEN 10 ELSE gemeldet_sek + ${LESEN_NACHTRAG_SEK} END
    RETURNING gemeldet_sek`) as any[];
  if (!m) return null;
  const l = await leseLage(id);
  if (!l) return null;
  const mail = leseberichtMail(l);
  let satz: string;
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const r = await eigeneMailSenden({ an: AUFRUF_MELDUNG_AN, name: "Justin", betreff: mail.betreff, text: mail.text, knoepfe: [{ text: "Alle Aufrufe ansehen", url: absoluteUrl(AUFRUF_CHEF_PFAD) }] });
    satz = r.ok ? `Mail an ${AUFRUF_MELDUNG_AN} gesendet` : `Mail an ${AUFRUF_MELDUNG_AN} nicht gesendet (${String(r.grund || "unbekannt").slice(0, 160)})`;
  } catch (e) {
    satz = `Mail an ${AUFRUF_MELDUNG_AN} nicht gesendet (${(e instanceof Error ? e.message : String(e)).slice(0, 160)})`;
  }
  await sqlPool`UPDATE fiaon_global_angebot_lesen SET meldung_ergebnis = ${satz} WHERE id = ${id}`;
  // Zeitleiste der EINEN Aufruf-Aufgabe (falls es sie gibt) — ohne sie wieder zu öffnen.
  const top = [...leseReihen(l.z)].sort((a, b) => b.s - a.s).slice(0, 3).map((r) => `${r.t} ${mmss(r.s)}`).join(" · ");
  await sqlPool`
    INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
    SELECT id, 'system', 'FIAON Global', 'kommentar', ${`Lesebericht${l.nachtrag ? " (Nachtrag)" : ""}: ${dauerText(l.z.sekunden)} aktiv · ${l.z.geraet || "Gerät unbekannt"} · ${ortText(l.z)}${top ? ` · ${top}` : ""}`}
      FROM fiaon_betreiber_todos WHERE schluessel = ${aufrufAufgabeSchluessel(l.ref)}`.catch(() => {});
  if (satz.includes("nicht gesendet")) console.warn(`[FIAON-ANGEBOT] ${l.ref}: Lesebericht — ${satz}`);
  return satz;
}

/** Für die Annahme-Mail: alles Gelesene über alle Kundenbesuche. Leer, wenn nichts. */
export async function leseSumme(angebotId: number): Promise<string[]> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebot_lesen') AS tab`) as any[];
  if (!t?.tab) return [];
  const zeilen = ((await sqlPool`SELECT * FROM fiaon_global_angebot_lesen WHERE angebot_id = ${angebotId} AND NOT intern AND NOT roboter`) as any[]).map(zeileAus);
  if (!zeilen.length) return [];
  const summe: Record<string, { t: string; o: number; s: number }> = {};
  for (const z of zeilen) for (const r of leseReihen(z)) summe[r.k] = { t: r.t, o: r.o, s: (summe[r.k]?.s ?? 0) + r.s };
  const gesamt = zeilen.reduce((n, z) => n + z.sekunden, 0);
  const top = Object.values(summe).sort((a, b) => b.s - a.s).slice(0, 4).map((r) => `${r.t} ${mmss(r.s)}`).join(" · ");
  return [`GELESEN INSGESAMT: ${dauerText(gesamt)} aktiv in ${zeilen.length} Besuch${zeilen.length === 1 ? "" : "en"}${top ? ` — am längsten: ${top}` : ""}.`];
}

/** Stundenlauf: liegengebliebene Berichte (Neustart) nachholen und nach der Frist löschen. Wirft nie. */
export async function leseLauf(): Promise<{ nachgeholt: number; geloescht: number }> {
  try {
    const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebot_lesen') AS tab`) as any[];
    if (!t?.tab) return { nachgeholt: 0, geloescht: 0 };
    let nachgeholt = 0;
    const offen = (await sqlPool`
      SELECT id FROM fiaon_global_angebot_lesen
       WHERE NOT intern AND NOT roboter AND zuletzt < NOW() - make_interval(mins => ${LESEN_STILL_MIN}) AND zuletzt > NOW() - interval '2 days'
         AND sekunden >= CASE WHEN gemeldet_sek = 0 THEN 10 ELSE gemeldet_sek + ${LESEN_NACHTRAG_SEK} END
       ORDER BY id LIMIT 50`) as any[];
    for (const o of offen) if (await leseberichtSenden(Number(o.id)).catch(() => null)) nachgeholt++;
    const faellig = await loeschfaelligeAngebote(null);
    const weg = await sqlPool`
      DELETE FROM fiaon_global_angebot_lesen l
       WHERE l.angebot_id = ANY(${faellig.map((f) => f.id)}::int[])
          OR NOT EXISTS (SELECT 1 FROM fiaon_global_angebote a WHERE a.id = l.angebot_id)`;
    return { nachgeholt, geloescht: Number((weg as any).count ?? 0) };
  } catch (e) {
    console.error("[FIAON-ANGEBOT] Leselauf:", e instanceof Error ? e.message : e);
    return { nachgeholt: 0, geloescht: 0 };
  }
}

/** Für den Reiter der Leitung: je Angebot die Kundenbesuche mit Lesezeit (neueste zuerst, höchstens 20). */
export async function leseFuerListe(angebotIds: number[]): Promise<Map<number, { amText: string; dauer: string; geraet: string; ort: string; abschnitte: string }[]>> {
  const aus = new Map<number, { amText: string; dauer: string; geraet: string; ort: string; abschnitte: string }[]>();
  if (!angebotIds.length) return aus;
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebot_lesen') AS tab`) as any[];
  if (!t?.tab) return aus;
  const zeilen = ((await sqlPool`
    SELECT * FROM fiaon_global_angebot_lesen WHERE angebot_id = ANY(${angebotIds}::int[]) AND NOT intern AND NOT roboter AND sekunden > 0
     ORDER BY beginn DESC LIMIT 400`) as any[]).map(zeileAus);
  for (const z of zeilen) {
    const liste = aus.get(z.angebot_id) ?? [];
    if (liste.length >= 20) continue;
    liste.push({
      amText: zeitLang(z.beginn), dauer: dauerText(z.sekunden), geraet: z.geraet || "Gerät unbekannt", ort: ortText(z),
      abschnitte: leseReihen(z).map((r) => `${r.t} ${mmss(r.s)}`).join(" · "),
    });
    aus.set(z.angebot_id, liste);
  }
  return aus;
}
