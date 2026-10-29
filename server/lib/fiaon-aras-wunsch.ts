// ═══════════════════════════════════════════════════════════════════════════
// ARAS — ANRUF-WUNSCH UND ERINNERUNG VOR DEM GLOBAL-GESPRÄCH (E-458, 29.10.2026)
//
// Justin (29.10.2026): „ARAS telefoniert nur noch die Termine oder die Leute die einen Anruf wollen“ — und „go Plan“ zu E-458,
// Punkt 8: „Anruf-Wunsch“ (nur mit Ja) und Erinnerungsanruf vor Global-Gesprächen.
//
// ── DIE DREI WEGE ──────────────────────────────────────────────────────────
//   1. ANRUF-WUNSCH (Spielart „wunsch“): Wer schriftlich und dokumentiert Ja zum Anruf gesagt hat (WUNSCH_EINWILLIGUNGEN —
//      Antrag-Kästchen, Ja per WhatsApp oder Mail, Meta-Formular; jeder Wortlaut nennt ARAS als KI), bekommt EINEN Anruf, in
//      dem ARAS sein Anliegen klärt und einen Termin bucht — nie Verkauf. Privat und Firma. Nur das jüngste Ja je Person,
//      höchstens WUNSCH_TAGE alt, höchstens WUNSCH_VERSUCHE Versuche an verschiedenen Tagen. Nicht, wenn seit dem Ja schon
//      jemand mit ihm gesprochen hat, ein Termin vor ihm steht, sein Antrag storniert/abgelöst/gekündigt ist, oder bei
//      Vertriebs-/Werbesperre, Telefonsperre, „ARAS aus“ und Testpersonen.
//   2. RÜCKRUF „BEI ARAS“ (Mara, WhatsApp und Mail): Will er angerufen werden, kann Mara ihm ARAS anbieten — „unsere digitale
//      Mitarbeiterin ARAS, eine KI“ — mit einem Zeitfenster. Erst nach seinem Ja trägt sie es ein (arasRueckrufEintragen):
//      ein Termin im Kalender von ARAS (Herkunft mara_bei_aras), sein Ja als Nachweis (Wortlaut = Maras Angebot) und der
//      Eintrag in der Warteschlange als „termin“ mit dem Fenster — Vorrang, und verpasst ARAS das Fenster, bekommt das Team
//      „Rückruf verpasst — bitte anrufen“ (fiaon-aras-plan.ts). Im Gespräch führt ARAS ihn wie einen Anruf-Wunsch.
//   3. ERINNERUNG (Spielart „erinnerung“): Bucht jemand ein Global-Gespräch, ruft ARAS kurz vorher an und bestätigt
//      (erinnerungFenster in shared/fiaon-aras.ts). Grundlage ist die Buchung mit dem Hinweis „… auch durch unsere
//      KI-Assistentin ARAS“ über dem Knopf (termin_buchung, quelle = genau dieser Termin) — seit Justin 29.10. nachmittags
//      („braucht kein eigenes Kreuz“) ohne Kästchen; ältere Buchungen mit Kästchen (termin_kaestchen) zählen weiter.
//      Die Mail-Erinnerungen und die Ergebnis-Pflicht des Gesprächs
//      baut eine andere Datei (fiaon-global-gespraech.ts) — hier wird der Termin nur GELESEN; „bleibt“ und „andere Zeit“
//      schreiben nur eine Notiz an den Termin bzw. eine Aufgabe für die zuständige Person (fiaon-aras-werkzeuge.ts).
//
// Gewählt wird erst ab Stufe 1 (und aus Stufe 0 schaltet nur Justin). Der Wähler prüft vor jedem Anruf noch einmal
// (wunschEntfaellt, erinnerungEntfaellt) — zwischen Planen und Wählen können Stunden liegen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema, arasAusweisId } from "./fiaon-aras-schema";
import { echtePersonSql } from "./fiaon-bestand-filter";
import { waehlbareNummer } from "./fiaon-telefon";
import { berlinZeitpunkt, berlinToday } from "./fiaon-time";
import { einwilligungMerken } from "./fiaon-telefon-einwilligung";
import { nummerKern } from "./fiaon-aras-sperre";
import {
  WUNSCH_EINWILLIGUNGEN, WUNSCH_TAGE, WUNSCH_VERSUCHE, WUNSCH_PAUSE_STUNDEN, ERINNERUNG_GRUNDLAGEN, erinnerungFenster, fensterAmWochentag, berlinTeile,
  nummerLand, stufenGrenzen, type ArasEinstellungen, type EinwilligungArt, type Land, type Fenster,
} from "../../shared/fiaon-aras";
import { JA_QUELLE_TEXT, GLOBAL_TERMIN_ARAS_HINWEIS } from "../../shared/fiaon-ja-zum-anruf";

type Lauf = typeof sqlPool;

const tagKurz = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  const x = new Date(d as any);
  // „29.10.“ — die deutsche Kurzform trägt den Punkt nach dem Monat schon selbst.
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).replace(/\.?$/, ".") : "";
};
const uhr = (d: Date): string => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

/** So erzählt ARAS, woher sein Ja kam („im Antrag“, „per WhatsApp“ …) — nie ein internes Wort. Rein. */
export function wunschQuelleText(art: string, quelleArt?: string | null): string {
  if (quelleArt === "mara_bei_aras") return "bei unserer Kollegin Mara";
  switch (art) {
    case "antrag_kaestchen": case "antrag_knopf": return "im Antrag";
    case "zuruf_whatsapp": return "per WhatsApp";
    case "zuruf_mail": return "per Mail";
    case "meta_kaestchen": return "im Formular";
    default: return "schriftlich";
  }
}

/** Das Verkaufs-Fenster heute (wenn noch offen) oder am nächsten Tag mit Fenster — Berliner Wandzeit. */
export function naechstesFenster(fenster: { verkauf: Fenster; rate: Fenster }, jetzt = new Date()): { ab: Date; bis: Date } {
  const nurVerkauf = { verkauf: fenster.verkauf, rate: fenster.verkauf };
  let tag = berlinTeile(jetzt).datum;
  for (let n = 0; n < 8; n++) {
    const wt = new Date(`${tag}T12:00:00Z`).getUTCDay() || 7;
    const f = fensterAmWochentag(nurVerkauf, wt);
    if (f) {
      const ab = berlinZeitpunkt(tag, Number(f.von.slice(0, 2)) * 60 + Number(f.von.slice(3)));
      const bis = berlinZeitpunkt(tag, Number(f.bis.slice(0, 2)) * 60 + Number(f.bis.slice(3)));
      if (bis.getTime() > jetzt.getTime() + 10 * 60_000) return { ab: new Date(Math.max(ab.getTime(), jetzt.getTime())), bis };
    }
    const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); tag = d.toISOString().slice(0, 10);
  }
  return { ab: jetzt, bis: new Date(jetzt.getTime() + 4 * 3600_000) };
}

// ── 1. ANRUF-WUNSCH ────────────────────────────────────────────────────────
export interface WunschKandidat {
  einwilligungId: number; art: EinwilligungArt; quelleArt: string | null; quelleId: string | null; erteiltAm: Date;
  personId: number; name: string; firma: boolean; nummer: string | null; land: Land;
  /** ARAS-Anrufe zu diesem Ja (Versuche), der letzte und sein Ergebnis. */
  versuche: number; letzterVersuchAm: Date | null; letztesErgebnis: string | null;
  /** Wartet schon ein Eintrag (oder läuft der Anruf)? */
  offen: boolean;
  /** Warum (noch) kein Anruf — null = ARAS darf jetzt einreihen. */
  grund: string | null;
}

/**
 * Wer ARAS um einen Anruf gebeten hat — je Person das JÜNGSTE schriftliche Ja (WUNSCH_EINWILLIGUNGEN), höchstens WUNSCH_TAGE alt.
 * Die harten Ausschlüsse stehen im SQL (Sperren, Testperson, Antrag weg, schon gesprochen, Termin steht); was davon abhängt,
 * wie die letzten Versuche liefen, entscheidet `grund`. Gelesen vom Planer und vom Chefbüro (KI-Team › Aras).
 */
export async function wunschKandidaten(lauf: Lauf = sqlPool, opt: { personId?: number | null; mitAusgeschlossenen?: boolean } = {}): Promise<WunschKandidat[]> {
  await arasSchema(lauf);
  const zeilen = (await lauf.unsafe(`
    SELECT DISTINCT ON (e.person_id)
           e.id AS einwilligung_id, e.art, e.quelle_art, e.quelle_id, e.erteilt_am, e.person_id, e.nummer AS e_nummer,
           p.primary_phone, p.country, p.last_name, p.first_name, p.company_name, COALESCE(p.kind, '') AS kind,
           (p.ist_test_am IS NOT NULL) AS test, COALESCE(p.is_blocked, FALSE) AS gesperrt, (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre,
           EXISTS (SELECT 1 FROM fiaon_telefon_sperre s WHERE s.aufgehoben_am IS NULL AND (s.nummer_kern = e.nummer_kern OR s.person_id = e.person_id)) AS telefonsperre,
           EXISTS (SELECT 1 FROM fiaon_aras_person ap WHERE ap.person_id = e.person_id AND ap.aus_am IS NOT NULL) AS aras_aus,
           (e.art NOT IN ('antrag_kaestchen', 'antrag_knopf') OR EXISTS (
              SELECT 1 FROM fiaon_applications a WHERE a.ref = e.quelle_id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
                 AND a.archived_at IS NULL AND a.gekuendigt_am IS NULL AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded'))) AS antrag_lebt,
           EXISTS (SELECT 1 FROM fiaon_calls c WHERE c.person_id = e.person_id AND c.beginn > e.erteilt_am
                     AND (c.ergebnis LIKE 'erreicht%' OR c.ergebnis IN ('rueckruf_termin', 'uebergeben')
                          OR (c.status = 'beendet' AND COALESCE(c.dauer_sek, 0) >= 30))) AS gesprochen,
           EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = e.person_id AND t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '30 minutes') AS termin_steht,
           (SELECT COUNT(*)::int FROM fiaon_aras_plan x JOIN fiaon_aras_anruf aa ON aa.plan_id = x.id
             WHERE x.person_id = e.person_id AND x.spielart = 'wunsch' AND x.created_at >= e.erteilt_am) AS versuche,
           (SELECT MAX(aa.created_at) FROM fiaon_aras_plan x JOIN fiaon_aras_anruf aa ON aa.plan_id = x.id
             WHERE x.person_id = e.person_id AND x.spielart = 'wunsch' AND x.created_at >= e.erteilt_am) AS letzter_versuch,
           (SELECT aa.ergebnis FROM fiaon_aras_plan x JOIN fiaon_aras_anruf aa ON aa.plan_id = x.id
             WHERE x.person_id = e.person_id AND x.spielart = 'wunsch' AND x.created_at >= e.erteilt_am ORDER BY aa.id DESC LIMIT 1) AS letztes_ergebnis,
           EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.person_id = e.person_id AND x.spielart = 'wunsch'
                     AND x.status IN ('wartet', 'gewaehlt', 'laeuft', 'verschoben')) AS offen
      FROM fiaon_telefon_einwilligung e
      JOIN fiaon_persons p ON p.id = e.person_id
     WHERE e.widerrufen_am IS NULL AND e.person_id IS NOT NULL
       AND e.art IN (${WUNSCH_EINWILLIGUNGEN.map((a) => `'${a}'`).join(", ")})
       AND e.erteilt_am > NOW() - make_interval(days => ${WUNSCH_TAGE})
       AND p.merged_into_person_id IS NULL
       ${opt.personId ? `AND e.person_id = ${Number(opt.personId)}` : ""}
     ORDER BY e.person_id, e.erteilt_am DESC`)) as any[];
  const aus: WunschKandidat[] = [];
  for (const z of zeilen) {
    const nummer = waehlbareNummer([{ nummer: z.e_nummer }, { nummer: z.primary_phone }], z.country).waehlbar ?? null;
    const versuche = Number(z.versuche ?? 0);
    const letzter = z.letzter_versuch ? new Date(z.letzter_versuch) : null;
    const ergebnis = z.letztes_ergebnis ? String(z.letztes_ergebnis) : null;
    // Die Reihenfolge der Gründe: erst, was immer hält; dann, was die Versuche betrifft.
    const grund = z.test ? "Testperson"
      : z.telefonsperre ? "Telefonsperre (nicht mehr anrufen)"
      : z.aras_aus ? "ARAS für diesen Kunden aus"
      : z.gesperrt ? "Vertriebssperre"
      : z.werbesperre ? "Werbesperre"
      : !z.antrag_lebt ? "Antrag storniert, abgelöst oder gekündigt"
      : !nummer ? "keine wählbare Nummer"
      : z.gesprochen ? "seit dem Ja schon mit ihm gesprochen"
      : z.termin_steht ? "ein Termin steht schon"
      : z.offen ? "wartet schon auf den Anruf"
      : versuche >= WUNSCH_VERSUCHE ? `${WUNSCH_VERSUCHE} Versuche ohne Gespräch — das Team übernimmt`
      : versuche > 0 && ergebnis && !["mailbox", "nicht_erreicht", "besetzt", "fehler"].includes(ergebnis) ? `letzter Anruf: ${ergebnis.replace(/_/g, " ")}`
      : versuche > 0 && letzter && Date.now() - letzter.getTime() < WUNSCH_PAUSE_STUNDEN * 3600_000 ? "nächster Versuch an einem anderen Tag"
      : null;
    if (grund && !opt.mitAusgeschlossenen && grund !== "wartet schon auf den Anruf") continue;
    const name = z.company_name && String(z.kind) === "business" ? String(z.company_name)
      : [z.first_name, z.last_name].filter(Boolean).join(" ").trim() || "—";
    aus.push({
      einwilligungId: Number(z.einwilligung_id), art: z.art, quelleArt: z.quelle_art ?? null, quelleId: z.quelle_id ?? null, erteiltAm: new Date(z.erteilt_am),
      personId: Number(z.person_id), name, firma: String(z.kind) === "business", nummer, land: (nummerLand(nummer) ?? "DE") as Land,
      versuche, letzterVersuchAm: letzter, letztesErgebnis: ergebnis, offen: !!z.offen, grund,
    });
  }
  return aus;
}

/**
 * Planer (planFuellen, nur ab Stufe 1 und mit eingeschalteter Gesprächsart): je fälligem Ja ein Eintrag „wunsch“ — heute im
 * Fenster, sonst am nächsten Fenstertag; der zweite und dritte Versuch frühestens WUNSCH_PAUSE_STUNDEN später.
 */
export async function wunschPlanen(einst: ArasEinstellungen, lauf: Lauf, zaehl: (r: { ok: boolean; grund?: string }) => void): Promise<void> {
  const { planEinreihen } = await import("./fiaon-aras-plan");
  for (const k of await wunschKandidaten(lauf)) {
    if (k.grund || !k.nummer) { zaehl({ ok: false, grund: k.grund ?? "keine Nummer" }); continue; }
    const f = naechstesFenster(einst.fenster);
    const quelle = JA_QUELLE_TEXT[k.art] ?? k.art;
    zaehl(await planEinreihen({
      personId: k.personId, ref: k.art === "antrag_kaestchen" || k.art === "antrag_knopf" ? k.quelleId : null, nummer: k.nummer, spielart: "wunsch",
      grund: `Ja zum Anruf (${quelle}, ${tagKurz(k.erteiltAm)})${k.versuche ? ` — ${k.versuche + 1}. Versuch` : ""}`,
      erzeugtVon: "takt", fruehAb: f.ab, spaetBis: f.bis, einwilligungId: k.einwilligungId, anlassAm: k.erteiltAm, versuchNr: k.versuche + 1,
    }, lauf));
  }
}

/** Vor dem Wählen: gilt sein Ja noch, hat inzwischen jemand mit ihm gesprochen, steht ein Termin? Null = anrufen. */
export async function wunschEntfaellt(z: { id: number; person_id?: number | null; einwilligung_id?: number | null; erzeugt_von?: string | null }, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!z.person_id) return "ohne Person";
  if (!z.einwilligung_id) return "ohne Ja zum Anruf";
  const [e] = (await lauf`SELECT widerrufen_am, erteilt_am FROM fiaon_telefon_einwilligung WHERE id = ${Number(z.einwilligung_id)}`) as any[];
  if (!e) return "Ja zum Anruf fehlt";
  if (e.widerrufen_am) return "Ja zum Anruf zurückgenommen";
  const [g] = (await lauf`
    SELECT EXISTS (SELECT 1 FROM fiaon_calls c WHERE c.person_id = ${Number(z.person_id)} AND c.beginn > ${e.erteilt_am}
                     AND (c.ergebnis LIKE 'erreicht%' OR c.ergebnis IN ('rueckruf_termin', 'uebergeben') OR (c.status = 'beendet' AND COALESCE(c.dauer_sek, 0) >= 30))) AS gesprochen,
           EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = ${Number(z.person_id)} AND t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '30 minutes') AS termin`) as any[];
  if (g?.gesprochen) return "inzwischen mit ihm gesprochen";
  if (g?.termin) return "inzwischen steht ein Termin";
  return null;
}

// ── 3. ERINNERUNG VOR DEM GLOBAL-GESPRÄCH ──────────────────────────────────
export interface ErinnerungKandidat {
  terminId: number; beginn: Date; personId: number; agentId: number | null; einwilligungId: number;
  nummer: string | null; land: Land; firma: string | null; wer: string;
  fenster: { ab: Date; bis: Date; vortag: boolean } | null;
  /** Schon ein Eintrag für genau diese Uhrzeit (wartet, läuft oder fertig)? */
  geplant: boolean;
}

/** Gebuchte Global-Gespräche der nächsten 40 Stunden mit Grundlage für den Erinnerungsanruf (Buchung mit Hinweis, früher Kästchen). Nur lesen. */
export async function erinnerungKandidaten(einst: ArasEinstellungen, lauf: Lauf = sqlPool): Promise<ErinnerungKandidat[]> {
  await arasSchema(lauf);
  // Je Gespräch genau EINE Zeile (der jüngste Nachweis) — trägt eine Buchung Hinweis UND altes Kästchen, gibt es trotzdem nur
  // einen Erinnerungsanruf.
  const zeilen = (await lauf.unsafe(`
    SELECT DISTINCT ON (t.beginn, t.id) t.id AS termin_id, t.beginn, t.person_id, t.agent_id, e.id AS einwilligung_id, e.nummer AS e_nummer,
           p.primary_phone, p.country, p.company_name, p.first_name, p.last_name, ag.first_name AS ag_vorname, ag.name AS ag_name,
           EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.termin_id = t.id AND x.spielart = 'erinnerung'
                     AND (x.status IN ('wartet', 'gewaehlt', 'laeuft', 'verschoben') OR (x.status = 'fertig' AND x.anlass_am = t.beginn))) AS geplant
      FROM fiaon_termine t
      JOIN fiaon_telefon_einwilligung e ON e.art IN (${ERINNERUNG_GRUNDLAGEN.map((a) => `'${a}'`).join(", ")}) AND e.quelle_art = 'global_termin' AND e.quelle_id = t.id::text AND e.widerrufen_am IS NULL
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.quelle = 'global' AND t.status = 'gebucht'
       AND t.beginn > NOW() + INTERVAL '30 minutes' AND t.beginn < NOW() + INTERVAL '40 hours'
       AND ${echtePersonSql("p")}
     ORDER BY t.beginn, t.id, e.id DESC`)) as any[];
  return zeilen.map((z) => {
    const nummer = waehlbareNummer([{ nummer: z.e_nummer }, { nummer: z.primary_phone }], z.country).waehlbar ?? null;
    const land = (nummerLand(nummer) ?? "DE") as Land;
    const beginn = new Date(z.beginn);
    return {
      terminId: Number(z.termin_id), beginn, personId: Number(z.person_id), agentId: z.agent_id != null ? Number(z.agent_id) : null,
      einwilligungId: Number(z.einwilligung_id), nummer, land, firma: z.company_name ? String(z.company_name) : null,
      wer: String(z.ag_vorname || z.ag_name || "dem Team"),
      fenster: erinnerungFenster(beginn, { land, fenster: einst.fenster }), geplant: !!z.geplant,
    };
  });
}

/** Planer: je gebuchtem Gespräch genau ein Erinnerungsanruf im Fenster vor dem Beginn (oder am Vortag abends). */
export async function erinnerungPlanen(einst: ArasEinstellungen, lauf: Lauf, zaehl: (r: { ok: boolean; grund?: string }) => void): Promise<void> {
  const { planEinreihen } = await import("./fiaon-aras-plan");
  for (const k of await erinnerungKandidaten(einst, lauf)) {
    if (k.geplant) continue;
    if (!k.nummer) { zaehl({ ok: false, grund: "keine Nummer" }); continue; }
    if (!k.fenster || k.fenster.bis.getTime() <= Date.now()) { zaehl({ ok: false, grund: "kein Fenster vor dem Gespräch" }); continue; }
    zaehl(await planEinreihen({
      personId: k.personId, nummer: k.nummer, spielart: "erinnerung", erzeugtVon: "takt",
      grund: `Erinnerung: Gespräch ${tagKurz(k.beginn)} ${uhr(k.beginn)} Uhr mit ${k.wer}${k.fenster.vortag ? " (Anruf am Vortag)" : ""}`,
      fruehAb: new Date(Math.max(Date.now(), k.fenster.ab.getTime())), spaetBis: k.fenster.bis, terminId: k.terminId, einwilligungId: k.einwilligungId, anlassAm: k.beginn,
    }, lauf));
  }
}

/**
 * Vor dem Wählen: steht das Gespräch noch (gebucht, gleiche Zeit), gilt das Kästchen noch? Wurde es verschoben, rückt der
 * Eintrag in das neue Fenster (oder verfällt, wenn es keins gibt). Null = anrufen.
 */
export async function erinnerungEntfaellt(z: { id: number; termin_id?: number | null; einwilligung_id?: number | null; anlass_am?: Date | string | null; land?: string | null },
  einst: ArasEinstellungen, lauf: Lauf = sqlPool): Promise<{ status: "verfallen" | "verschoben"; grund: string } | null> {
  if (!z.termin_id) return { status: "verfallen", grund: "ohne Gespräch" };
  const [t] = (await lauf`SELECT status, beginn FROM fiaon_termine WHERE id = ${Number(z.termin_id)}`) as any[];
  if (!t || t.status !== "gebucht") return { status: "verfallen", grund: `Gespräch ${t?.status ?? "fehlt"}` };
  if (z.einwilligung_id) {
    const [e] = (await lauf`SELECT widerrufen_am FROM fiaon_telefon_einwilligung WHERE id = ${Number(z.einwilligung_id)}`) as any[];
    if (!e || e.widerrufen_am) return { status: "verfallen", grund: "Einwilligung zurückgenommen" };
  }
  const beginn = new Date(t.beginn);
  if (z.anlass_am && Math.abs(new Date(z.anlass_am as any).getTime() - beginn.getTime()) < 60_000) return null;
  // Verschoben: neues Fenster für die neue Zeit.
  const f = erinnerungFenster(beginn, { land: (z.land as Land) || "DE", fenster: einst.fenster });
  if (!f || f.bis.getTime() <= Date.now()) {
    await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = 'Gespräch verschoben — kein Fenster für die Erinnerung', updated_at = NOW() WHERE id = ${z.id}`;
    return { status: "verfallen", grund: "verschoben, kein Fenster" };
  }
  await lauf`UPDATE fiaon_aras_plan SET frueh_ab = ${new Date(Math.max(Date.now(), f.ab.getTime()))}, spaet_bis = ${f.bis}, anlass_am = ${beginn},
                    verschoben_grund = ${`Gespräch verschoben auf ${tagKurz(beginn)} ${uhr(beginn)} Uhr`}, updated_at = NOW()
              WHERE id = ${z.id} AND status = 'wartet'`;
  return f.ab.getTime() > Date.now() ? { status: "verschoben", grund: "Gespräch verschoben" } : null;
}

// ── 2. RÜCKRUF „BEI ARAS“ (Mara, WhatsApp und Mail) ─────────────────────────
/**
 * Nimmt ARAS gerade Rückrufe an? Nur dann bietet Mara sie an: ARAS an, kein Not-Aus/Leerlauf, Stufe ≥ 1 und „Termin bei ARAS“
 * erlaubt. In Stufe 0 (Stand 29.10.2026) also nie — dann bucht Mara wie bisher beim Betreuer.
 */
export async function arasRueckrufBereit(lauf: Lauf = sqlPool): Promise<{ bereit: boolean; grund: string | null }> {
  const { arasEinstellungenLesen } = await import("./fiaon-aras-plan");
  const einst = await arasEinstellungenLesen(false, lauf);
  const g = stufenGrenzen(einst);
  const grund = !einst.an ? "ARAS ist aus" : einst.notaus ? "Not-Aus" : einst.leerlauf ? "Leerlauf" : g.stufe === 0 ? "Stufe 0" : !g.spielartErlaubt("termin") ? "Termine bei ARAS sind aus" : null;
  return { bereit: !grund, grund };
}

/** Maras Angebot muss sagen, dass ARAS eine KI ist — sonst deckt sein Ja den Anruf nicht (KI-VO Art. 50, § 7a UWG). Rein. */
export function angebotNenntKi(text: string | null | undefined): boolean {
  const t = String(text ?? "");
  return /\bARAS\b/i.test(t) && /\bKI\b|künstliche Intelligenz|digitale Mitarbeiterin/i.test(t);
}

/** Ein Fenster „JJJJ-MM-TT HH:MM“ (Berlin) prüfen: mindestens 30 Minuten, höchstens 4 Stunden, am selben Tag, im ARAS-Fenster. Rein. */
export function rueckrufFensterPruefen(von: Date | null, bis: Date | null, fenster: { verkauf: Fenster; rate: Fenster }, jetzt = new Date()): { ok: true; von: Date; bis: Date } | { ok: false; grund: string } {
  if (!von || !bis || !Number.isFinite(von.getTime()) || !Number.isFinite(bis.getTime())) return { ok: false, grund: "Ein Zeitfenster braucht Beginn und Ende (von/bis)." };
  let a = new Date(Math.max(von.getTime(), jetzt.getTime() + 2 * 60_000));
  const tag = berlinTeile(a).datum;
  if (berlinTeile(bis).datum !== tag) return { ok: false, grund: "Das Fenster muss an einem Tag liegen." };
  const wt = new Date(`${tag}T12:00:00Z`).getUTCDay() || 7;
  const f = fensterAmWochentag({ verkauf: fenster.verkauf, rate: fenster.verkauf }, wt);
  if (!f) return { ok: false, grund: "An diesem Tag ruft ARAS nicht an (Montag bis Samstag)." };
  const fa = berlinZeitpunkt(tag, Number(f.von.slice(0, 2)) * 60 + Number(f.von.slice(3)));
  const fb = berlinZeitpunkt(tag, Number(f.bis.slice(0, 2)) * 60 + Number(f.bis.slice(3)));
  a = new Date(Math.max(a.getTime(), fa.getTime()));
  const b = new Date(Math.min(bis.getTime(), fb.getTime()));
  if (b.getTime() - a.getTime() < 30 * 60_000) return { ok: false, grund: `ARAS ruft zwischen ${f.von} und ${f.bis} Uhr an — das Fenster braucht mindestens 30 Minuten darin.` };
  if (b.getTime() - a.getTime() > 4 * 3600_000) return { ok: false, grund: "Das Fenster ist zu lang — höchstens vier Stunden." };
  return { ok: true, von: a, bis: b };
}

/** „heute zwischen 14 und 16 Uhr“ / „morgen zwischen 9:30 und 11 Uhr“ / „am Freitag, 30.10., zwischen …“ — so liest es der Kunde. Rein. */
export function fensterText(von: Date, bis: Date, jetzt = new Date()): string {
  const h = (d: Date) => uhr(d).replace(/:00$/, "").replace(/^0/, "");
  const tag = berlinTeile(von).datum, heute = berlinTeile(jetzt).datum;
  const morgen = (() => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const wann = tag === heute ? "heute" : tag === morgen ? "morgen"
    : `am ${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(von)}, ${tagKurz(von)}`;
  return `${wann} zwischen ${h(von)} und ${h(bis)} Uhr`;
}

export interface ArasRueckrufEin {
  personId: number; nummer: string; kanal: "whatsapp" | "mail";
  von: Date | null; bis: Date | null; anliegen: string;
  /** Maras Nachricht mit dem Angebot (muss ARAS als KI nennen) — der Wortlaut des Nachweises. */
  angebot: string | null;
  /** Seine Antwort darauf (Beleg). */
  antwort: string | null;
  leadId?: number | null;
}
export type ArasRueckrufErgebnis =
  | { ok: true; terminId: number; planId: number | null; von: Date; bis: Date; text: string }
  | { ok: false; grund: string; meldung: string };

/**
 * Mara trägt den Rückruf „bei ARAS“ ein — erst NACH seinem Ja auf ein Angebot, das ARAS als KI nennt. Drei Schritte in dieser
 * Reihenfolge: Termin im Kalender von ARAS (mara_bei_aras, Beginn = Fensterbeginn), sein Ja als Nachweis, der Eintrag in der
 * Warteschlange („termin“, frueh_ab/spaet_bis = das Fenster). Scheitert der Eintrag (ARAS gerade nicht bereit), steht nichts
 * davon — Mara bucht dann wie bisher beim Betreuer. Wirft nie.
 */
export async function arasRueckrufEintragen(e: ArasRueckrufEin, lauf: Lauf = sqlPool): Promise<ArasRueckrufErgebnis> {
  try {
    const bereit = await arasRueckrufBereit(lauf);
    if (!bereit.bereit) return { ok: false, grund: "aras_nicht_bereit", meldung: `ARAS nimmt gerade keine Rückrufe an (${bereit.grund}) — trag den Rückruf wie gewohnt beim Betreuer ein (ohne „bei: aras“).` };
    if (!angebotNenntKi(e.angebot)) return { ok: false, grund: "ohne_ki_hinweis", meldung: "Du hast ihm noch nicht gesagt, dass ARAS eine KI ist. Frag erst: „Unsere digitale Mitarbeiterin ARAS (eine KI) kann Sie … anrufen — passt Ihnen das?“ — und trag erst nach seinem Ja ein." };
    const { arasEinstellungenLesen, planEinreihen } = await import("./fiaon-aras-plan");
    const einst = await arasEinstellungenLesen(false, lauf);
    const f = rueckrufFensterPruefen(e.von, e.bis, einst.fenster);
    if (!f.ok) return { ok: false, grund: "fenster", meldung: f.grund };
    const nummer = waehlbareNummer([{ nummer: e.nummer }]).waehlbar;
    if (!nummer) return { ok: false, grund: "nummer", meldung: "Ohne wählbare Nummer kann ARAS nicht anrufen — trag den Rückruf beim Betreuer ein." };
    const ausweis = await arasAusweisId(lauf);
    const { terminBuchen, dauerFuer, TerminFehler } = await import("./fiaon-termine");
    // Mehrere Rückrufe im selben Fenster: Die Datenbank verbietet Überschneidungen auch im Kalender von ARAS
    // (fiaon_termine_keine_ueberschneidung) — der Platzhalter rückt darum um je eine Termin-Dauer, solange er im Fenster liegt.
    // Wann ARAS wirklich anruft, bestimmt der Eintrag in der Warteschlange (das ganze Fenster), nicht dieser Beginn.
    const schritt = dauerFuer("agent_manuell") * 60_000;
    let buchung: Awaited<ReturnType<typeof terminBuchen>> | null = null;
    let letzter: unknown = null;
    for (let beginn = f.von.getTime(); !buchung && beginn + schritt <= f.bis.getTime(); beginn += schritt) {
      try {
        buchung = await terminBuchen({ personId: e.personId, agentId: ausweis, beginn: new Date(beginn), quelle: "agent_manuell", herkunft: "mara_bei_aras", vereinbart: true }, lauf);
      } catch (err) {
        letzter = err;
        if (!(err instanceof TerminFehler) || String((err as any).code ?? "") !== "belegt") break;
      }
    }
    if (!buchung) return { ok: false, grund: "termin", meldung: `Der Rückruf bei ARAS ließ sich nicht eintragen (${String((letzter as Error)?.message ?? letzter).slice(0, 120)}) — trag ihn beim Betreuer ein.` };
    const text = fensterText(f.von, f.bis);
    const kanalText = e.kanal === "mail" ? "Mail" : "WhatsApp";
    await lauf`UPDATE fiaon_termine SET notiz = ${`Rückruf bei ARAS, von Mara per ${kanalText} vereinbart — ${text}. ${String(e.anliegen || "").trim()}`.slice(0, 800)}, updated_at = NOW() WHERE id = ${buchung.id}`;
    const ew = await einwilligungMerken({
      personId: e.personId, leadId: e.leadId ?? null, nummer, art: e.kanal === "mail" ? "zuruf_mail" : "zuruf_whatsapp",
      wortlaut: String(e.angebot ?? "").slice(0, 2000), quelleArt: "mara_bei_aras", quelleId: String(buchung.id),
      beleg: { antwort: String(e.antwort ?? "").slice(0, 600), kanal: e.kanal, fenster: { von: f.von.toISOString(), bis: f.bis.toISOString(), text }, anliegen: String(e.anliegen ?? "").slice(0, 400) },
      erteiltAm: new Date(),
    }, lauf);
    const plan = await planEinreihen({
      personId: e.personId, nummer, spielart: "termin", erzeugtVon: "mara", terminId: buchung.id, einwilligungId: ew.id,
      grund: `Rückruf bei ARAS (Mara, ${kanalText}) ${uhr(f.von)}–${uhr(f.bis)}: ${String(e.anliegen || "").trim()}`.slice(0, 200),
      fruehAb: f.von, spaetBis: f.bis, anlassAm: f.von,
    }, lauf);
    const { protokollieren } = await import("./fiaon-mara-termin");
    await protokollieren({
      art: "termin_gebucht", ok: true, kanal: e.kanal === "mail" ? "mail" : "whatsapp", nummer, personId: e.personId, leadId: e.leadId ?? null, terminId: buchung.id,
      text: `Rückruf bei ARAS eingetragen: ${text}${plan.ok ? "" : ` — Warteschlange: ${plan.grund ?? "nicht eingereiht"}`}.`,
      daten: { termin_id: buchung.id, bei: "aras", von: f.von.toISOString(), bis: f.bis.toISOString(), einwilligung_id: ew.id, plan_id: plan.id ?? null, anliegen: e.anliegen },
    }, lauf);
    if (e.kanal === "whatsapp") {
      try { const { waAktenvermerk } = await import("./fiaon-whatsapp"); await waAktenvermerk(e.personId, `Rückruf bei ARAS (KI) eingetragen: ${text}. ${String(e.anliegen || "").slice(0, 200)}`); } catch { /* ohne Bestellung keine Akte */ }
    }
    return { ok: true, terminId: buchung.id, planId: plan.id ?? null, von: f.von, bis: f.bis, text };
  } catch (err) {
    console.error("[ARAS-WUNSCH] Rückruf bei ARAS:", err);
    return { ok: false, grund: "serverfehler", meldung: "Technischer Fehler — trag den Rückruf beim Betreuer ein." };
  }
}

// ── Für das Briefing (fiaon-aras-briefing.ts) ──────────────────────────────
/** Der Anruf-Wunsch zu einem Plan-Eintrag (sein Ja) oder einem Termin bei ARAS, den Mara eingetragen hat. Null = keiner. */
export async function wunschFuerBriefing(e: { einwilligungId?: number | null; terminId?: number | null; spielart: string }, lauf: Lauf = sqlPool): Promise<{ quelle: string; am: string; anliegen: string | null; fenster: string | null; kanal: "whatsapp" | "mail" | null } | null> {
  let z: any = null;
  if (e.spielart === "termin" && e.terminId) {
    [z] = (await lauf`SELECT e.art, e.quelle_art, e.erteilt_am, e.beleg FROM fiaon_telefon_einwilligung e
                       WHERE e.quelle_art = 'mara_bei_aras' AND e.quelle_id = ${String(e.terminId)} ORDER BY e.id DESC LIMIT 1`.catch(() => [])) as any[];
    if (!z) return null;
  } else if (e.spielart === "wunsch" && e.einwilligungId) {
    [z] = (await lauf`SELECT e.art, e.quelle_art, e.erteilt_am, e.beleg FROM fiaon_telefon_einwilligung e WHERE e.id = ${Number(e.einwilligungId)}`.catch(() => [])) as any[];
    if (!z) return null;
  } else return null;
  const beleg = z.beleg && typeof z.beleg === "object" ? z.beleg : {};
  // Sein Anliegen: was Mara mit ihm vereinbart hat — beim Ja per WhatsApp/Mail, wenn es im Beleg steht.
  const anliegen = String(beleg.anliegen ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  return {
    quelle: wunschQuelleText(String(z.art), z.quelle_art), am: tagKurz(z.erteilt_am),
    anliegen, fenster: beleg.fenster?.text ? String(beleg.fenster.text) : null,
    kanal: beleg.kanal === "mail" ? "mail" : beleg.kanal === "whatsapp" ? "whatsapp" : null,
  };
}

/** Das Global-Gespräch für die Erinnerung (wann, mit wem, Firma, Thema aus der Notiz der Buchung). Null = keins. */
export async function gespraechFuerBriefing(terminId: number | null | undefined, lauf: Lauf = sqlPool): Promise<{ datum: string; uhrzeit: string; wann: string; mitNom: string; mitDat: string; firma: string | null; thema: string | null } | null> {
  if (!terminId) return null;
  const [t] = (await lauf`
    SELECT t.beginn, t.notiz, p.company_name, a.name, a.first_name, a.last_name, a.anrede
      FROM fiaon_termine t LEFT JOIN fiaon_persons p ON p.id = t.person_id LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.id = ${Number(terminId)}`.catch(() => [])) as any[];
  if (!t) return null;
  const { nennform } = await import("../../shared/fiaon-mitarbeiter-name");
  const n = nennform({ name: t.name, first_name: t.first_name, last_name: t.last_name, anrede: t.anrede });
  const beginn = new Date(t.beginn);
  const { zahlWort } = await import("../../shared/fiaon-aras-prompt");
  const hh = Number(uhr(beginn).slice(0, 2)), mm = Number(uhr(beginn).slice(3, 5));
  const uhrGesprochen = `${zahlWort(hh)} Uhr${mm ? ` ${zahlWort(mm)}` : ""}`;
  const tag = berlinTeile(beginn).datum, heute = berlinToday();
  const morgen = (() => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const wann = `${tag === heute ? "heute" : tag === morgen ? "morgen" : `am ${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(beginn)}`} um ${uhrGesprochen}`;
  const notiz = String(t.notiz ?? "");
  const firma = (/^Firma:\s*(.+)$/m.exec(notiz)?.[1] ?? t.company_name ?? "").trim() || null;
  const thema = (/^Thema:\s*(.+)$/m.exec(notiz)?.[1] ?? "").trim() || null;
  return { datum: tagKurz(beginn), uhrzeit: uhr(beginn), wann, mitNom: n.nom, mitDat: n.dat, firma: firma && !/^Privatperson ·/.test(firma) ? firma : null, thema };
}

// ── Das Kästchen im Buchungsformular (fiaon.com/ und Global-Unterseiten, E-458) ──
/**
 * Die Seite, auf der das Kästchen stand — für den Nachweis. Seit E-461 (29.10.) liegt die Buchung auf fiaon.com/ und /en, dazu auf
 * den Global-Unterseiten und Landingpages (/business leitet nur noch weiter): zuerst der Pfad, den der Browser mitschickt, sonst der
 * Pfad aus dem Referer (ein alter Stand im Browser schickt keinen), sonst „/“. Nur ein sauberer Pfad zählt — nie Domain oder Suchteil.
 */
export function belegSeite(pfad: unknown, referer?: unknown): string {
  const sauber = (p: unknown) => (typeof p === "string" && /^\/[A-Za-z0-9/_.%-]{0,150}$/.test(p) ? p : null);
  const ausReferer = () => { try { return typeof referer === "string" && referer ? sauber(new URL(referer).pathname) : null; } catch { return null; } };
  return sauber(pfad) ?? ausReferer() ?? "/";
}

/**
 * Die Buchung trägt den Hinweis „Kurz vor dem Gespräch rufen wir Sie an … – auch durch unsere KI-Assistentin ARAS“ über dem
 * Knopf: GENAU dieser Satz wird zum Nachweis (termin_buchung, quelle = der Termin) — aber nur, wenn der Browser denselben Satz
 * zurückschickt, den der Server zeigt (ein fremder Satz speichert nichts statt eines Satzes, den niemand gesehen hat). Ein
 * Browser mit dem alten Stand schickt noch den Kästchen-Satz (bis 29.10. nachmittags) → termin_kaestchen wie bisher. Im
 * Hintergrund, wirft nie: Die Buchung steht schon und hängt nie daran.
 */
export function globalTerminEinwilligungMerken(e: { terminId: number; wortlautBrowser: unknown; wortlautServer: readonly string[]; telefon: string; ip: string; ua: string; sprache: "de" | "en"; seite?: unknown; referer?: unknown }): void {
  const satz = String(e.wortlautBrowser ?? "");
  if (!e.wortlautServer.includes(satz)) {
    if (satz) console.warn(`[ARAS-WUNSCH] Termin ${e.terminId}: Der Satz im Browser ist nicht der dieses Servers — KEIN Nachweis für den Erinnerungsanruf gespeichert.`);
    return;
  }
  const hinweis = (Object.values(GLOBAL_TERMIN_ARAS_HINWEIS) as string[]).includes(satz);
  void (async () => {
    const [t] = (await sqlPool`SELECT person_id FROM fiaon_termine WHERE id = ${e.terminId}`) as any[];
    const personId = t?.person_id != null ? Number(t.person_id) : null;
    const [p] = personId ? ((await sqlPool`SELECT country FROM fiaon_persons WHERE id = ${personId}`.catch(() => [])) as any[]) : [];
    const nummer = waehlbareNummer([{ nummer: e.telefon }], p?.country ?? "DE").waehlbar ?? e.telefon;
    if (!nummerKern(nummer)) { console.warn(`[ARAS-WUNSCH] Termin ${e.terminId}: Buchung ohne brauchbare Nummer — kein Nachweis für den Erinnerungsanruf.`); return; }
    const { id } = await einwilligungMerken({
      personId, nummer, art: hinweis ? "termin_buchung" : "termin_kaestchen", wortlaut: satz, quelleArt: "global_termin", quelleId: String(e.terminId),
      beleg: {
        seite: belegSeite(e.seite, e.referer), formular: "Gespräch vereinbaren",
        kaestchen: hinweis ? "kein Kästchen — Hinweis über dem Knopf, Buchung = Grundlage (Justin 29.10.2026: „braucht kein eigenes Kreuz“)" : "eigene Zeile, nicht vorangekreuzt, freiwillig",
        sprache: e.sprache, ip: e.ip.slice(0, 80), userAgent: e.ua.slice(0, 300),
      },
    });
    console.log(`[ARAS-WUNSCH] Termin ${e.terminId}: Nachweis für den Erinnerungsanruf gespeichert (Nr. ${id}, ${hinweis ? "Buchung mit Hinweis" : "Kästchen"}).`);
  })().catch((err) => console.error(`[ARAS-WUNSCH] Termin ${e.terminId}: Einwilligung NICHT gespeichert — die Buchung gilt trotzdem:`, err));
}

// ── Für das Chefbüro (KI-Team › Aras) ──────────────────────────────────────
export interface WunschLage {
  bereit: { bereit: boolean; grund: string | null };
  stufe: number;
  an: { wunsch: boolean; erinnerung: boolean; termin: boolean; willkommen: boolean; stufe_a: boolean; rate: boolean; zusage: boolean; auftrag: boolean };
  wunsch: { personId: number; name: string; firma: boolean; quelle: string; am: string; versuche: number; grund: string | null }[];
  erinnerung: { terminId: number; personId: number; firma: string | null; wann: string; wer: string; fenster: string | null; geplant: boolean }[];
  zahlen: { wunschJetzt: number; wunschGesamt: number; erinnerungen: number; rueckrufeBeiAras: number };
}

/** Was die Karte „Wen ARAS anruft“ zeigt — die Namen nur gekürzt, wenn `maskiert` (wie Plan-Lage). */
export async function wunschLage(einst: ArasEinstellungen, lauf: Lauf = sqlPool, maskiert = false): Promise<WunschLage> {
  const g = stufenGrenzen(einst);
  const alle = await wunschKandidaten(lauf, { mitAusgeschlossenen: true });
  const er = await erinnerungKandidaten(einst, lauf).catch(() => [] as ErinnerungKandidat[]);
  const [r] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE herkunft = 'mara_bei_aras' AND status = 'gebucht' AND beginn > NOW() - INTERVAL '4 hours'`.catch(() => [{ n: 0 }])) as any[];
  const kurz = (n: string) => (maskiert && n !== "—" ? `${n.slice(0, 1)}…` : n);
  return {
    bereit: await arasRueckrufBereit(lauf), stufe: g.stufe,
    an: {
      wunsch: !!einst.spielarten.wunsch, erinnerung: !!einst.spielarten.erinnerung, termin: !!einst.spielarten.termin, willkommen: !!einst.spielarten.willkommen,
      stufe_a: !!einst.spielarten.stufe_a, rate: !!einst.spielarten.rate, zusage: !!einst.spielarten.zusage, auftrag: !!einst.spielarten.auftrag,
    },
    wunsch: alle.slice(0, 60).map((k) => ({ personId: k.personId, name: kurz(k.name), firma: k.firma, quelle: JA_QUELLE_TEXT[k.art] ?? k.art, am: tagKurz(k.erteiltAm), versuche: k.versuche, grund: k.grund })),
    erinnerung: er.map((k) => ({ terminId: k.terminId, personId: k.personId, firma: k.firma ? kurz(k.firma) : null, wann: `${tagKurz(k.beginn)} ${uhr(k.beginn)} Uhr`, wer: k.wer,
      fenster: k.fenster ? `${k.fenster.vortag ? "am Vortag " : ""}${uhr(k.fenster.ab)}–${uhr(k.fenster.bis)} Uhr` : null, geplant: k.geplant })),
    zahlen: { wunschJetzt: alle.filter((k) => !k.grund).length, wunschGesamt: alle.length, erinnerungen: er.length, rueckrufeBeiAras: Number(r?.n ?? 0) },
  };
}
