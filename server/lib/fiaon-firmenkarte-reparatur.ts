// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — EINMAL-REPARATUR DER FIRMEN-KARTE #34 (E-487 Nachtrag, 16.11.2026)
//
// Der Fall, die Vorprüfung und was getrennt wird: shared/fiaon-firmenkarte-reparatur.ts. Hier nur der Ablauf:
//   1. Marke in fiaon_settings lesen — steht sie, passiert nichts (einmalig). Schalter „firmen_trennen“ = aus → nichts.
//   2. Lage lesen (nur Lesen): Kopf der Karte, die drei Anfragen, der Plan des Planers (kartenPlanen) mit dem Ziel je Gruppe
//      (zielSuchen — dasselbe wie der Lauf), die erwartete Ziel-Karte, das Protokoll.
//   3. Vorprüfung (reparaturPruefen). Abweichung → nichts ändern, Marke mit Grund, Meldung in Konsole und Lauf-Historie.
//   4. Trennen: je offene Gruppe gruppeTrennen (der Schreibweg des Laufs firmen_trennen: EINE Transaktion je Gruppe, Kopf FOR
//      UPDATE frisch geprüft, Protokoll mit Rückweg, „Getrennt: …“ im Verlauf beider Karten, Aufträge mit Hinweis, nichts gelöscht).
//   5. Nachprüfung (nur Lesen): Dossier, Lead-Weg, Takt und Aufträge jeder Gruppe zeigen aufs Ziel, die eigenen bleiben auf der
//      Quelle — Abweichungen stehen in der Marke. Dann die Marke „erledigt“ und eine Zeile in der Lauf-Historie.
// Scheitert eine Gruppe (Fehler), bleibt die Marke leer: der nächste Lauf (stündlich, firmenTrennenTakt) prüft neu und setzt
// fort — eine schon getrennte Gruppe steht im Protokoll und gilt als erledigt.
//
// Angestoßen aus firmenTrennenTakt (server/lib/fiaon-firmen-trennen.ts), also nur im Betrieb (CRONS), 4 Minuten nach dem Deploy.
// Keine Mail, keine WhatsApp, keine KI. Repo öffentlich: nur Kennungen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { laufMeldung } from "./fiaon-crons";
import { FIRMEN_TRENNEN_LAUF, cockpitLink, kartenPlanen } from "@shared/fiaon-firmen-trennen";
import {
  REPARATUR_KARTE_34, reparaturPruefen, reparaturSchluessel, type ReparaturSoll, type ReparaturUrteil, type ReparaturLage,
} from "@shared/fiaon-firmenkarte-reparatur";
import { tabellenLage, trennModus, standLesen, zielSuchen, firmenTrennungSchema, gruppeTrennen } from "./fiaon-firmen-trennen";

type Lauf = typeof sqlPool;

export interface ReparaturErgebnis {
  urteil: ReparaturUrteil;
  /** Je getrennter Gruppe: Schlüssel, Ziel, neu angelegt? */
  getrennt: { schluessel: string; zielId: number | null; zielNeu: boolean; status: string }[];
  abweichungen: string[];
}

const zahl = (v: unknown): number | null => { const n = Number(v); return v != null && Number.isInteger(n) && n > 0 ? n : null; };

async function markeSetzen(lauf: Lauf, soll: ReparaturSoll, wert: Record<string, unknown>): Promise<void> {
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${soll.marke}, ${JSON.stringify(wert)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

async function historie(lauf: Lauf, start: number, meldung: Record<string, unknown>): Promise<void> {
  await lauf`
    INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
    VALUES (${FIRMEN_TRENNEN_LAUF}, 'erfolg', ${new Date(start)}, NOW(), ${Date.now() - start}, ${laufMeldung(FIRMEN_TRENNEN_LAUF, meldung)})`
    .catch((e: unknown) => console.error("[FIRMENKARTE-REPARATUR] Historie:", String((e as Error)?.message ?? e).slice(0, 160)));
}

/** Nur Lesen: alles, was die Vorprüfung braucht — und der Plan der Quelle für den Schreibweg. */
export async function reparaturLageLesen(lauf: Lauf = sqlPool, soll: ReparaturSoll = REPARATUR_KARTE_34) {
  const [m] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${soll.marke}`.catch(() => [])) as any[];
  const modus = await trennModus(lauf);
  const lage = await tabellenLage(lauf);
  const karte = (k: any) => k ? {
    id: Number(k.id), firma: k.firma ?? null, ansprechpartner: k.ansprechpartner ?? null, person_id: zahl(k.person_id), email: k.email ?? null, telefon: k.telefon ?? null,
  } : null;
  const zielIds = soll.gruppen.map((g) => g.ziel).filter((x): x is number => x != null);
  const anfrageIds = [soll.eigeneAnfrage, ...soll.gruppen.flatMap((g) => Array.from(g.anfrageIds))];
  const [q] = lage.karten ? ((await lauf`SELECT id, firma, ansprechpartner, person_id, email, telefon FROM fiaon_firmen_leads WHERE id = ${soll.quelleId}`) as any[]) : [];
  const ziele = lage.karten && zielIds.length ? ((await lauf`SELECT id, firma, ansprechpartner, person_id, email, telefon FROM fiaon_firmen_leads WHERE id = ANY(${zielIds})`) as any[]) : [];
  const anfragen = ((await lauf`SELECT id, art, COALESCE(ist_test, FALSE) AS ist_test, email, telefon, name, person_id FROM fiaon_anfragen WHERE id = ANY(${anfrageIds})`.catch(() => [])) as any[])
    .map((a) => ({ id: Number(a.id), art: a.art ?? null, ist_test: !!a.ist_test, email: a.email ?? null, telefon: a.telefon ?? null, name: a.name ?? null, person_id: zahl(a.person_id) }));
  const schluessel = reparaturSchluessel(soll);
  const protokoll = lage.protokoll
    ? ((await lauf`SELECT schluessel, ziel_firma_id FROM fiaon_firmen_trennung WHERE schluessel = ANY(${schluessel})`) as any[])
      .map((p) => ({ schluessel: String(p.schluessel), ziel_firma_id: zahl(p.ziel_firma_id) }))
    : [];
  let p: ReturnType<typeof kartenPlanen>["plaene"][number] | null = null;
  let da: Awaited<ReturnType<typeof standLesen>>["da"] | null = null;
  let plan: ReparaturLage["plan"] = null;
  if (lage.karten && lage.verlauf && q) {
    const gelesen = await standLesen(lauf);
    da = gelesen.da;
    p = kartenPlanen(gelesen.stand).plaene.find((x) => x.quelleId === soll.quelleId) ?? null;
    if (p) {
      const gruppen = [];
      for (const g of p.gruppen) gruppen.push({ schluessel: g.schluessel, anfrageIds: g.anfrageIds, ziel: (await zielSuchen(lauf, p.quelleId, g, false))?.id ?? null });
      plan = { eigene: p.eigene, gruppen };
    }
  }
  const reparaturLage: ReparaturLage = {
    marke: m?.value != null ? String(m.value) : null, modus, quelle: karte(q), anfragen, plan,
    zielKarten: ziele.map(karte).filter((k): k is NonNullable<ReturnType<typeof karte>> => !!k), protokoll,
  };
  return { lage: reparaturLage, p, da };
}

/** Nur Lesen: zeigt alles der Gruppe aufs Ziel, alles Eigene noch auf die Quelle? Liefert die Abweichungen (nur Kennungen). */
async function nachpruefen(lauf: Lauf, soll: ReparaturSoll, ziele: Map<number, number>): Promise<string[]> {
  const ab: string[] = [];
  const pruef = async (anfrageId: number, soll_: number) => {
    const [d] = (await lauf`SELECT firma_id FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${anfrageId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    if (d && zahl(d.firma_id) !== soll_) ab.push(`Dossier zu #${anfrageId} zeigt auf #${d.firma_id ?? "—"} statt #${soll_}`);
    const [w] = (await lauf`SELECT firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
    if (w && zahl(w.firma_id) !== soll_) ab.push(`Lead-Weg zu #${anfrageId} zeigt auf #${w.firma_id ?? "—"} statt #${soll_}`);
    const [t] = (await lauf`SELECT firma_id FROM fiaon_lead_takt WHERE anfrage_id = ${anfrageId}`.catch(() => [])) as any[];
    if (t && zahl(t.firma_id) !== soll_) ab.push(`Takt zu #${anfrageId} zeigt auf #${t.firma_id ?? "—"} statt #${soll_}`);
    const [a] = (await lauf`SELECT link FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${anfrageId}`}`.catch(() => [])) as any[];
    if (a && a.link !== cockpitLink(soll_)) ab.push(`Auftrag zu #${anfrageId} öffnet ${String(a.link ?? "—")} statt Karte #${soll_}`);
  };
  await pruef(soll.eigeneAnfrage, soll.quelleId);
  for (const [anfrageId, zielId] of Array.from(ziele.entries())) await pruef(anfrageId, zielId);
  const [q] = (await lauf`SELECT notiz FROM fiaon_firmen_leads WHERE id = ${soll.quelleId}`.catch(() => [])) as any[];
  for (const anfrageId of Array.from(ziele.keys())) {
    if (String(q?.notiz ?? "").includes(`(Anfrage #${anfrageId} über `)) ab.push(`Notiz von Karte #${soll.quelleId} nennt noch Anfrage #${anfrageId}`);
  }
  return ab;
}

/**
 * Die Einmal-Reparatur. Wirft nur, wenn das Lesen oder eine Gruppe scheitert (dann bleibt die Marke leer — der nächste Lauf
 * prüft neu). `rueckfall` (Prüfstand): die Rückfall-Zuständige vorgeben statt globalZustaendig zu fragen.
 */
export async function firmenkarteReparatur(opt: { lauf?: Lauf; soll?: ReparaturSoll; rueckfall?: number | null } = {}): Promise<ReparaturErgebnis> {
  const lauf = opt.lauf ?? sqlPool;
  const soll = opt.soll ?? REPARATUR_KARTE_34;
  const start = Date.now();
  const { lage, p, da } = await reparaturLageLesen(lauf, soll);
  const urteil = reparaturPruefen(lage, soll);
  const erg: ReparaturErgebnis = { urteil, getrennt: [], abweichungen: [] };

  if (urteil.tun === "nichts") {
    if (urteil.markeSetzen) {
      await markeSetzen(lauf, soll, { status: urteil.status, grund: urteil.grund, am: new Date().toISOString() });
      (urteil.status === "abweichung" ? console.warn : console.log)(
        `[FIRMENKARTE-REPARATUR] Karte #${soll.quelleId}: ${urteil.status === "abweichung" ? "NICHT getrennt — Zustand weicht ab" : "nichts mehr zu tun"}: ${urteil.grund}`);
      await historie(lauf, start, { reparatur: { getrennt: 0, abweichung: urteil.status === "abweichung" }, grund: `Einmal-Reparatur Karte #${soll.quelleId}: ${urteil.grund}` });
    }
    return erg;
  }

  // ── Trennen: je Gruppe EINE Transaktion (gruppeTrennen) ──
  if (!p || !da) throw new Error(`Einmal-Reparatur Karte #${soll.quelleId}: Plan fehlt trotz Vorprüfung`);
  if (!(await firmenTrennungSchema(lauf))) throw new Error(`Einmal-Reparatur Karte #${soll.quelleId}: Protokoll-Tabelle nicht anlegbar`);
  const rueckfall = opt.rueckfall !== undefined
    ? opt.rueckfall
    : await import("./fiaon-global-termin").then((m) => m.globalZustaendig()).then((z) => z?.id ?? null).catch(() => null);
  const heute = berlinToday();
  const ziele = new Map<number, number>();
  for (const s of urteil.schluessel) {
    const g = p.gruppen.find((x) => x.schluessel === s);
    if (!g) throw new Error(`Einmal-Reparatur Karte #${soll.quelleId}: Gruppe ${s} fehlt im Plan`);
    const r = await gruppeTrennen(lauf, p, g, da, heute, rueckfall);
    erg.getrennt.push({ schluessel: s, zielId: r.zielId, zielNeu: r.zielNeu, status: r.status });
    if (r.status === "uebersprungen") {
      throw new Error(`Einmal-Reparatur Karte #${soll.quelleId}: Gruppe ${s} übersprungen (der Kartenkopf hat sich zwischen Prüfung und Trennung geändert) — der nächste Lauf prüft neu`);
    }
    const sollG = soll.gruppen.find((x) => g.anfrageIds.length === x.anfrageIds.length && g.anfrageIds.every((a) => x.anfrageIds.includes(a)));
    if (r.status === "getrennt" && sollG?.ziel != null && r.zielId !== sollG.ziel) erg.abweichungen.push(`Gruppe ${s} landete auf #${r.zielId} statt #${sollG.ziel}`);
    console.log(`[FIRMENKARTE-REPARATUR] Karte #${soll.quelleId}: ${s} → ${r.status}${r.zielId ? ` auf Karte #${r.zielId}${r.zielNeu ? " (neu)" : ""}` : ""}`);
  }
  // Das Ziel je Anfrage (auch die einer früher schon getrennten Gruppe) für die Nachprüfung.
  const prot = (await lauf`SELECT anfrage_ids, ziel_firma_id FROM fiaon_firmen_trennung WHERE schluessel = ANY(${reparaturSchluessel(soll)})`) as any[];
  for (const z of prot) for (const a of (z.anfrage_ids ?? []) as number[]) if (zahl(z.ziel_firma_id)) ziele.set(Number(a), Number(z.ziel_firma_id));
  erg.abweichungen.push(...(await nachpruefen(lauf, soll, ziele)));

  const zielText = Object.fromEntries(Array.from(ziele.entries()).map(([a, z]) => [`#${a}`, `#${z}`]));
  await markeSetzen(lauf, soll, { status: "erledigt", am: new Date().toISOString(), ziele: zielText, getrennt: erg.getrennt, abweichungen: erg.abweichungen });
  await historie(lauf, start, {
    reparatur: { getrennt: erg.getrennt.filter((x) => x.status === "getrennt").length, neu: erg.getrennt.filter((x) => x.zielNeu).length, abweichungen: erg.abweichungen.length },
  });
  (erg.abweichungen.length ? console.warn : console.log)(
    `[FIRMENKARTE-REPARATUR] Karte #${soll.quelleId} getrennt: ${JSON.stringify(zielText)}${erg.abweichungen.length ? ` — Abweichungen: ${erg.abweichungen.join("; ")}` : " — Nachprüfung ohne Abweichung"}`);
  return erg;
}
