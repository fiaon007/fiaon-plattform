// ═══════════════════════════════════════════════════════════════════════════
// MARAS WHATSAPP-FÄLLE ALS ENTSCHEIDUNGSKARTEN (E-372, 15.10.2026)
//
// Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die
// Mitarbeiter — selbst arbeiten. Wenn sie eine Entscheidung braucht, dann soll
// ich es mit 1 Klick entscheiden können … Mara soll nicht MEHR Arbeit schaffen,
// als wir schon haben, sondern immer perfekt arbeiten.“
//
// Seit E-369/E-371 gilt das für Maras Mails. Hier dasselbe für WhatsApp: Was
// Mara nicht selbst erledigen darf (waWeg in fiaon-whatsapp-mara.ts), wird keine
// Aufgabe beim Betreuer mehr, sondern EINE Karte in Mara › Entscheidungen
// (/chef/s/mara?reiter=entscheidungen). Der Kunde hat da schon eine sichere,
// nichts zusagende Antwort (WA_ENTSCHEIDUNG_SATZ) — bei FIAON Global keine (E-272).
//
// Die Knöpfe rufen nur BESTEHENDE Wege auf, nie einen neuen Buchungs- oder Geldweg:
//   · Bestellung stornieren      → kuendigungDurchfuehren (unbezahlt: Storno, routes/fiaon-kuendigung.ts)
//   · Widerruf annehmen          → kuendigungDurchfuehren mit sofort (Vertrag endet sofort, offene Raten entfallen)
//                                  — eine Erstattung überweist der Knopf NICHT (Konto/Auszahlung, E-347)
//   · Kündigung zurücknehmen     → kuendigungZuruecknehmen (lib/fiaon-kuendigung.ts)
//   · Daten löschen              → vorschau + ausfuehren (lib/fiaon-loeschen.ts), derselbe Weg wie die Zentrale
//   · Ratenpause (Härtefall)     → ratenpauseAnwenden ohne 60-Tage-Sperre (lib/fiaon-ratenpause.ts)
//   · Selbst antworten           → Link in den WhatsApp-Raum genau dieser Nummer (raumPfad)
//   · Akte öffnen                → Link in DIE EINE Akte (akteAdresse)
//   · Schon erledigt             → „nichts“ (fiaon-mara-entscheidungen.ts)
// Jedes Werkzeug prüft die Lage direkt vor dem Ausführen neu (Regel 3 aus E-370).
//
// Geladen wird dieses Modul von fiaon-mara-entscheidungen.ts (erweiterungenLaden, dynamisch) und von
// fiaon-whatsapp-mara.ts (dynamisch, beim Anlegen einer Karte). Es importiert fiaon-whatsapp-mara.ts statisch —
// fiaon-whatsapp-mara.ts importiert es nie statisch zurück (kein Kreis beim Laden).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  entscheidungAnlegen, entscheidungArt, werkzeugRegistrieren, ausfuehrErgebnis, entscheidungTabellen, euroText,
  type EntscheidungNeu, type EntscheidungBeleg, type EntscheidungOption,
} from "./fiaon-mara-entscheidungen";
import { raumPfad } from "@shared/fiaon-wa-raum";
import { akteAdresse } from "@shared/fiaon-akte-aufloesung";
import { antragAbgeschickt } from "@shared/fiaon-antrag-stand";
import { type WaFall, WA_ENTSCHEIDUNG_SATZ } from "./fiaon-whatsapp-mara";

type Lauf = typeof sqlPool;

// ═══════════════════════════════════════════════════════════════════════════
// DIE ARTEN — Etikett und Gewicht (Recht und Geld vor Komfort)
// ═══════════════════════════════════════════════════════════════════════════
export const WA_ART: Record<WaFall, string> = {
  rechtlich: "wa_rechtlich", widerruf: "wa_widerruf", erstattung: "wa_erstattung", loeschen: "wa_loeschen",
  global: "wa_global", bestreitet: "wa_bestreitet", kuendigung_zurueck: "wa_kuendigung_zurueck", karte: "wa_karte",
  ratenpause: "wa_ratenpause", falsche_nummer: "wa_falsche_nummer", werbesperre: "wa_werbesperre",
  unsicher: "wa_unsicher", frage: "wa_frage",
};
entscheidungArt("wa_rechtlich", "WhatsApp: Recht", 92);
entscheidungArt("wa_widerruf", "WhatsApp: Widerruf", 88);
entscheidungArt("wa_erstattung", "WhatsApp: Geld zurück", 86);
entscheidungArt("wa_loeschen", "WhatsApp: Löschwunsch", 72);
entscheidungArt("wa_global", "WhatsApp: FIAON Global", 76);
entscheidungArt("wa_bestreitet", "WhatsApp: bestreitet", 70);
entscheidungArt("wa_kuendigung_zurueck", "WhatsApp: Kündigung zurück", 74);
entscheidungArt("wa_karte", "WhatsApp: Kartenlink", 55);
entscheidungArt("wa_ratenpause", "WhatsApp: Ratenpause", 66);
entscheidungArt("wa_falsche_nummer", "WhatsApp: falsche Nummer", 40);
entscheidungArt("wa_werbesperre", "WhatsApp: Werbesperre", 42);
entscheidungArt("wa_unsicher", "WhatsApp: Mara unsicher", 45);
entscheidungArt("wa_frage", "WhatsApp: Frage an dich", 48);

// ═══════════════════════════════════════════════════════════════════════════
// SEINE LAGE — nur lesend über `lauf` (lässt sich gegen die Produktion messen)
// ═══════════════════════════════════════════════════════════════════════════
export interface WaEntscheidungsLage {
  personId: number;
  /** Irgendetwas bezahlt — Bestellung (auch Auskunft) oder Rate. Nur dann gibt es etwas zu widerrufen oder zu erstatten. */
  bezahlt: boolean;
  bezahltCents: number;
  /** Die Bestellung, um die es geht — dieselbe Wahl wie lageFuer/abstreitenLage: bezahlt zuerst, sonst die jüngste lebende. */
  ref: string | null;
  paymentStatus: string | null;
  abgeschickt: boolean;
  gekuendigt: boolean;
  /** Vertragstag (bezahlt am, sonst abgeschickt am, sonst angelegt) als YYYY-MM-DD (Berlin). */
  vertragAm: string | null;
  tageSeitVertrag: number | null;
  offenCents: number;
  offeneRaten: number;
}

const tagIso = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const d = new Date(v as any);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null;
};
const tagKurz = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : "");

/** Seine Lage für die Weiche und die Karte. null ohne Person. Wirft nie. */
export async function waLageLesen(personId: number | null | undefined, lauf: Lauf = sqlPool): Promise<WaEntscheidungsLage | null> {
  const pid = Number(personId);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const [a] = (await lauf`
      SELECT ref, payment_status, gekuendigt_am, status, current_step, submitted_at, paid_at, created_at
        FROM fiaon_applications
       WHERE person_id = ${pid} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
         AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
         AND (archived_at IS NULL OR payment_status = 'paid')
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    const [s] = (await lauf`
      SELECT EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = ${pid} AND x.merged_into IS NULL AND x.payment_status = 'paid') AS bestellung_bezahlt,
             (SELECT COALESCE(SUM(r.betrag_cents), 0)::int FROM fiaon_abo_raten r JOIN fiaon_applications x ON x.ref = r.ref AND x.merged_into IS NULL
               WHERE x.person_id = ${pid} AND (r.status = 'bezahlt' OR r.bezahlt_am IS NOT NULL)) AS bezahlt_cents,
             (SELECT COALESCE(SUM(r.betrag_cents), 0)::int FROM fiaon_abo_raten r JOIN fiaon_applications x ON x.ref = r.ref AND x.merged_into IS NULL
               WHERE x.person_id = ${pid} AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offen_cents,
             (SELECT COUNT(*)::int FROM fiaon_abo_raten r JOIN fiaon_applications x ON x.ref = r.ref AND x.merged_into IS NULL
               WHERE x.person_id = ${pid} AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offene_raten`) as any[];
    const vertragAm = a ? tagIso(a.paid_at ?? a.submitted_at ?? a.created_at) : null;
    const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const tage = vertragAm ? Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${vertragAm}T12:00:00Z`)) / 86_400_000) : null;
    const bezahltCents = Number(s?.bezahlt_cents || 0);
    return {
      personId: pid,
      bezahlt: s?.bestellung_bezahlt === true || bezahltCents > 0,
      bezahltCents,
      ref: a?.ref ? String(a.ref) : null,
      paymentStatus: a?.payment_status ? String(a.payment_status) : null,
      abgeschickt: a ? antragAbgeschickt(a) : false,
      gekuendigt: !!a?.gekuendigt_am,
      vertragAm, tageSeitVertrag: tage,
      offenCents: Number(s?.offen_cents || 0),
      offeneRaten: Number(s?.offene_raten || 0),
    };
  } catch (e) {
    console.error("[MARA-WA] Entscheidungslage:", String((e as Error)?.message ?? e).slice(0, 160));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KARTE — rein
// ═══════════════════════════════════════════════════════════════════════════
export interface WaKarteEin {
  fall: WaFall;
  schluessel: string;
  nummer: string;
  personId: number | null;
  lage: WaEntscheidungsLage | null;
  /** Seine Worte (gekürzt in die Karte). */
  kunde: string;
  /** Was Mara ihm geschickt hat (fester Satz oder ihre Antwort) — null, wenn sie schweigt (FIAON Global). */
  mara: string | null;
  /** Der interne Grund (Prüfbefund, Ausschluss des Kartenwegs, Übergabesatz des Modells). */
  grund?: string | null;
  /** Löschwunsch: was die Löschung täte (lib/fiaon-loeschen.ts einteilen). */
  loesch?: { art: "endgueltig" | "anonymisiert" | "gesperrt"; text: string } | null;
  /** Ratenpause: die 60-Tage-Sperre war der Grund — dann „Pause trotzdem setzen“ als Knopf. */
  pauseOhneSperre?: boolean;
  /** Ein zusätzlicher Warnhinweis (z. B. droht dazu mit Anwalt). */
  warnung?: string | null;
}

const kurz = (t: unknown, n: number) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()} …` : s;
};

const TITEL: Record<WaFall, string> = {
  rechtlich: "Anwalt, Polizei oder Behörde",
  widerruf: "Widerruf nach Zahlung",
  erstattung: "Will Geld zurück",
  loeschen: "Löschwunsch",
  global: "FIAON Global schreibt auf WhatsApp",
  bestreitet: "Bestreitet den abgeschickten Antrag",
  kuendigung_zurueck: "Will die Kündigung zurücknehmen",
  karte: "Kartenlink: Ausschluss",
  ratenpause: "Ratenpause: Härtefall",
  falsche_nummer: "Falsche Nummer",
  werbesperre: "Will nach der Sperre doch weitermachen",
  unsicher: "Mara war unsicher",
  frage: "Mara braucht eine Antwort von dir",
};

const SATZ: Record<WaFall, string> = {
  rechtlich: "Rechtliches entscheidest du. Mara hat ihm ruhig geantwortet und nichts zugesagt.",
  widerruf: "Ob der Widerruf gilt und was mit Gezahltem geschieht, entscheidest du. Mara hat nichts zugesagt.",
  erstattung: "Über Geld zurück entscheidest du. Mara hat nichts zugesagt.",
  loeschen: "Mara hat den Wunsch bestätigt und die Werbesperre gesetzt. Löschen geht nur mit deinem Klick.",
  global: "Global-Kunden beantwortet Mara nie selbst (E-272).",
  bestreitet: "Sein Antrag ist abgeschickt, aber er sagt, er habe nichts beantragt. Mara hat sich entschuldigt und nichts gebucht.",
  kuendigung_zurueck: "Sein Vertrag ist gekündigt, er will weitermachen. Die Rücknahme bringt die stornierten Raten zurück.",
  karte: "Den Link der Partnerbank durfte Mara nicht schicken (Ausschluss). Ob er ihn bekommt, entscheidest du.",
  ratenpause: "Er bittet um eine Pause, die Mara nicht selbst geben darf.",
  falsche_nummer: "Die Nummer gehört wohl nicht zu diesem Kunden. Bitte in der Akte korrigieren.",
  werbesperre: "Nach seinem Bestreiten steht eine Werbesperre. Jetzt will er doch weitermachen.",
  unsicher: "Ihre eigene Prüfung hat jede Antwort angehalten. Er hat den Ersatzsatz bekommen und wartet.",
  frage: "Mara konnte das nicht wahr beantworten, und kein Werkzeug erledigt es.",
};

/** Rein: die Karte zu einem WhatsApp-Fall. */
export function waKarteBauen(e: WaKarteEin): EntscheidungNeu {
  const l = e.lage;
  const raum = raumPfad("chef", e.nummer);
  const akte = e.personId ? akteAdresse(e.personId, { reiter: e.fall === "erstattung" || e.fall === "widerruf" ? "geld" : null }) : null;
  const selbst: EntscheidungOption = { key: "selbst", label: "Selbst antworten", werkzeug: "link", link: raum, ton: "neutral",
    titel: "Öffnet genau dieses Gespräch im WhatsApp-Raum." };
  const akteKnopf: EntscheidungOption | null = akte
    ? { key: "akte", label: "Akte öffnen", werkzeug: "link", link: akte, ton: "neutral", titel: "Öffnet seine Akte." }
    : null;
  const erledigt: EntscheidungOption = { key: "nichts", label: e.mara ? "Schon erledigt" : "Nichts tun", werkzeug: "nichts", ton: "neutral",
    titel: e.mara ? "Du hast ihm schon geantwortet oder es braucht nichts mehr — die Karte geht zu." : "Legt die Karte ab." };
  const ref = l?.ref ?? null;
  let optionen: EntscheidungOption[] = [];
  let empfehlung = "selbst";
  switch (e.fall) {
    case "widerruf": {
      if (ref && !l?.gekuendigt) {
        optionen.push({ key: "annehmen", label: "Widerruf annehmen", werkzeug: "wa_widerruf_annehmen", args: { ref, personId: e.personId },
          ton: "vorsicht", titel: "Beendet den Vertrag sofort, offene Raten entfallen (Urkunde, Bestätigungsmail). Eine Erstattung überweist dieser Knopf nicht." });
        // Innerhalb der 14 Tage ab Vertrag gilt der Widerruf in aller Regel — dann ist das die Empfehlung.
        if (l?.tageSeitVertrag != null && l.tageSeitVertrag <= 14) empfehlung = "annehmen";
      }
      optionen.push(selbst, ...(akteKnopf ? [akteKnopf] : []), erledigt);
      break;
    }
    case "bestreitet": {
      if (ref && l && l.paymentStatus !== "paid" && !l.gekuendigt) {
        optionen.push({ key: "stornieren", label: "Bestellung stornieren", werkzeug: "wa_storno", args: { ref, personId: e.personId },
          ton: "gut", titel: "Storniert die unbezahlte Bestellung — keine Forderung, keine Bestätigungsmail an die Adresse im Antrag." });
        empfehlung = "stornieren";
      }
      optionen.push(selbst, erledigt);
      break;
    }
    case "kuendigung_zurueck": {
      if (ref && l?.gekuendigt) {
        optionen.push({ key: "zuruecknehmen", label: "Kündigung zurücknehmen", werkzeug: "wa_kuendigung_zuruecknehmen", args: { ref },
          ton: "vorsicht", titel: "Nimmt die Kündigung zurück — die wegen ihr stornierten Raten sind wieder offen." });
        empfehlung = "zuruecknehmen";
      }
      optionen.push(selbst, erledigt);
      break;
    }
    case "loeschen": {
      if (e.personId && e.loesch && e.loesch.art !== "gesperrt") {
        optionen.push({ key: "loeschen", label: e.loesch.art === "endgueltig" ? "Daten löschen" : "Person anonymisieren", werkzeug: "wa_daten_loeschen",
          args: { personId: e.personId }, ton: "vorsicht", titel: e.loesch.text });
        // Ohne Zahlung, ohne Rechnung, ohne offene Forderung: löschen. Sonst sprichst du vorher mit ihm.
        if (e.loesch.art === "endgueltig" && !(l?.offenCents)) empfehlung = "loeschen";
      }
      optionen.push(selbst, erledigt);
      break;
    }
    case "ratenpause": {
      if (ref && e.pauseOhneSperre) {
        optionen.push({ key: "pause", label: "Pause trotzdem setzen", werkzeug: "wa_ratenpause_haertefall", args: { ref },
          ton: "gut", titel: "Verschiebt seine offenen Raten (wie die Ratenpause im Forderungsmanagement), ohne die 60-Tage-Sperre." });
        empfehlung = "pause";
      }
      optionen.push(selbst, erledigt);
      break;
    }
    case "falsche_nummer":
    case "werbesperre":
    case "karte": {
      optionen.push(...(akteKnopf ? [akteKnopf] : []), selbst, erledigt);
      empfehlung = akteKnopf ? "akte" : "selbst";
      break;
    }
    default:
      // rechtlich, erstattung, global, unsicher, frage
      optionen.push(selbst, ...(akteKnopf ? [akteKnopf] : []), erledigt);
  }
  const belege: EntscheidungBeleg[] = [
    ...(l?.bezahlt ? [{ text: l.bezahltCents ? `bezahlt ${euroText(l.bezahltCents)}` : "bezahlt" }] : l ? [{ text: "nichts bezahlt" }] : []),
    ...(l?.offenCents ? [{ text: `${l.offeneRaten} ${l.offeneRaten === 1 ? "Rate" : "Raten"} offen · ${euroText(l.offenCents)}`, ton: "warn" as const }] : []),
    ...(l?.vertragAm ? [{ text: `${l.bezahlt ? "Vertrag" : l.abgeschickt ? "Antrag" : "angelegt"} ${tagKurz(l.vertragAm)}${l.tageSeitVertrag != null ? ` (vor ${l.tageSeitVertrag} ${l.tageSeitVertrag === 1 ? "Tag" : "Tagen"})` : ""}` }] : []),
    ...(l?.gekuendigt ? [{ text: "gekündigt", ton: "warn" as const }] : []),
    ...(e.warnung ? [{ text: kurz(e.warnung, 90), ton: "krit" as const }] : []),
    ...(e.grund ? [{ text: kurz(e.grund, 120), ton: "warn" as const }] : []),
    ...(e.kunde ? [{ art: "zitat" as const, name: "Kunde (WhatsApp)", text: kurz(e.kunde, 300) }] : []),
    ...(e.mara ? [{ art: "zitat" as const, name: "Maras Antwort", text: kurz(e.mara, 360) }] : []),
  ];
  if (!optionen.some((o) => o.key === empfehlung)) empfehlung = optionen[0].key;
  // Doppelte Schlüssel (akte als Empfehlung und Liste) gibt es nicht — trotzdem sicher.
  const gesehen = new Set<string>();
  optionen = optionen.filter((o) => (gesehen.has(o.key) ? false : (gesehen.add(o.key), true)));
  return {
    schluessel: e.schluessel,
    art: WA_ART[e.fall],
    personId: e.personId,
    ref,
    titel: TITEL[e.fall],
    text: `${SATZ[e.fall]}${e.loesch && e.fall === "loeschen" ? ` ${e.loesch.text}` : ""}`,
    empfehlung,
    optionen,
    belege,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN — eine offene Karte je Person (oder Nummer) und Fall; weitere Nachrichten frischen sie auf
// ═══════════════════════════════════════════════════════════════════════════
const wer = (personId: number | null, nummer: string) => (personId ? `p${personId}` : `n${String(nummer).replace(/\D/g, "")}`);

/**
 * Offene WhatsApp-Karten dieses Menschen (Fall und Schlüssel), zuletzt aufgefrischt in den letzten 14 Tagen — eine ältere
 * offene Karte steuert das heutige Gespräch nicht mehr (der sichere Satz geht dann neu raus). Leer ohne Tabelle. Wirft nie.
 */
export async function waOffeneKarten(personId: number | null, nummer: string, lauf: Lauf = sqlPool): Promise<{ fall: WaFall; schluessel: string; id: number }[]> {
  try {
    const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`)) as any[];
    if (!t?.da) return [];
    const z = (await lauf.unsafe(
      `SELECT id, art, schluessel FROM fiaon_mara_entscheidungen
        WHERE schluessel LIKE $1 AND status IN ('offen', 'spaeter') AND aktualisiert_am > NOW() - INTERVAL '14 days'
        ORDER BY id DESC LIMIT 20`, [`wa:%:${wer(personId, nummer)}:%`])) as any[];
    const zurueck = Object.fromEntries(Object.entries(WA_ART).map(([f, a]) => [a, f as WaFall]));
    return z.filter((x) => zurueck[x.art]).map((x) => ({ fall: zurueck[x.art], schluessel: String(x.schluessel), id: Number(x.id) }));
  } catch {
    return [];
  }
}

/**
 * Legt die Karte an oder frischt die offene desselben Falls auf (dieselbe Person bzw. Nummer). Eine entschiedene Karte
 * bleibt, wie sie ist — eine neue Nachricht danach macht eine neue Karte (Schlüssel mit ihrer Nachrichten-ID).
 */
export async function waKarteAnlegen(
  e: Omit<WaKarteEin, "schluessel"> & { aufId: number }, lauf: Lauf = sqlPool,
): Promise<{ id: number; schluessel: string; neu: boolean } | null> {
  await entscheidungTabellen();
  const praefix = `wa:${e.fall}:${wer(e.personId, e.nummer)}:`;
  const [offen] = (await lauf.unsafe(
    `SELECT schluessel FROM fiaon_mara_entscheidungen WHERE art = $1 AND schluessel LIKE $2 AND status IN ('offen', 'spaeter') ORDER BY id DESC LIMIT 1`,
    [WA_ART[e.fall], `${praefix}%`])) as any[];
  const schluessel = offen?.schluessel ? String(offen.schluessel) : `${praefix}${Number(e.aufId) || 0}`;
  // Löschwunsch: was die Löschung täte — dieselbe Einteilung wie die Zentrale (vorschau/ausfuehren).
  let loesch = e.loesch ?? null;
  if (e.fall === "loeschen" && e.personId && !loesch) {
    const { einteilen } = await import("./fiaon-loeschen");
    const [k] = await einteilen([Number(e.personId)], lauf).catch(() => [] as any[]);
    if (k) loesch = { art: k.art, text: k.begruendung };
  }
  const r = await entscheidungAnlegen(waKarteBauen({ ...e, schluessel, loesch }), lauf);
  return r ? { id: r.id, schluessel, neu: r.neu } : null;
}

/** Der sichere Satz an den Kunden für einen Fall, der vor dem Modell entschieden wird (null: Mara schweigt). */
export function waKundenSatz(fall: WaFall): string | null {
  return (WA_ENTSCHEIDUNG_SATZ as Partial<Record<WaFall, string>>)[fall] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE — prüfen die Lage neu, dann der bestehende Weg
// ═══════════════════════════════════════════════════════════════════════════
const unterzeichner = (k: { von: string; agentId: number | null }) => ({ name: k.von, rolle: "Geschäftsführung", agentId: k.agentId });

async function bestellung(lauf: Lauf, ref: string): Promise<any | null> {
  const [a] = (await lauf`
    SELECT ref, person_id, payment_status, gekuendigt_am FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
  return a ?? null;
}

werkzeugRegistrieren("wa_storno", async (args, k) => {
  const ref = String(args?.ref ?? "");
  if (!ref) return ausfuehrErgebnis.fehler("Die Karte nennt keine Bestellung.");
  const a = await bestellung(k.lauf, ref);
  if (!a) return ausfuehrErgebnis.vonSelbst("Die Bestellung gibt es so nicht mehr (zusammengeführt oder gelöscht).");
  if (a.gekuendigt_am) return ausfuehrErgebnis.vonSelbst("Die Bestellung ist schon storniert oder gekündigt.");
  if (String(a.payment_status) === "paid") return ausfuehrErgebnis.fehler("Inzwischen bezahlt — ein Storno ist das nicht mehr. Bitte selbst mit ihm sprechen.");
  const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
  const erg: any = await kuendigungDurchfuehren(ref, {
    quelle: "whatsapp", personId: Number(args?.personId) || (a.person_id ?? null),
    grund: `Bestreitet den Antrag (WhatsApp) — storniert im Mara-Steuerpult: ${k.von}`.slice(0, 300),
    unterzeichner: unterzeichner(k),
    // Er sagt, er habe nichts beantragt — die Adresse im Antrag ist womöglich nicht seine.
    mail: false,
  });
  if (!erg?.ok) return ausfuehrErgebnis.fehler(String(erg?.grund ?? "Storno ging nicht durch.").slice(0, 300));
  return ausfuehrErgebnis.erledigt(`Bestellung storniert${erg.stornierteRaten ? `, ${erg.stornierteRaten} offene ${erg.stornierteRaten === 1 ? "Rate entfällt" : "Raten entfallen"}` : ""} — keine Forderung.`);
});

werkzeugRegistrieren("wa_widerruf_annehmen", async (args, k) => {
  const ref = String(args?.ref ?? "");
  if (!ref) return ausfuehrErgebnis.fehler("Die Karte nennt keine Bestellung.");
  const a = await bestellung(k.lauf, ref);
  if (!a) return ausfuehrErgebnis.vonSelbst("Die Bestellung gibt es so nicht mehr (zusammengeführt oder gelöscht).");
  // E-396: Ein zum Laufzeitende gekündigter Jahresvertrag läuft noch — der Widerruf beendet ihn trotzdem sofort.
  const [art] = (await k.lauf`SELECT kuendigung_art, vertrag_ende_am FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  const laeuftNoch = art?.kuendigung_art === "laufzeit" && !(art?.vertrag_ende_am && new Date(art.vertrag_ende_am).getTime() <= Date.now());
  if (a.gekuendigt_am && !laeuftNoch) return ausfuehrErgebnis.vonSelbst("Der Vertrag ist schon gekündigt oder beendet.");
  const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
  const erg: any = await kuendigungDurchfuehren(ref, {
    quelle: "whatsapp", sofort: true, sofortGrund: "widerruf", personId: Number(args?.personId) || (a.person_id ?? null),
    grund: `Widerruf (WhatsApp) — angenommen im Mara-Steuerpult: ${k.von}`.slice(0, 300),
    unterzeichner: unterzeichner(k),
  });
  if (!erg?.ok) return ausfuehrErgebnis.fehler(String(erg?.grund ?? "Die Beendigung ging nicht durch.").slice(0, 300));
  return ausfuehrErgebnis.erledigt(`Vertrag sofort beendet${erg.stornierteRaten ? `, ${erg.stornierteRaten} offene ${erg.stornierteRaten === 1 ? "Rate entfällt" : "Raten entfallen"}` : ""}. `
    + `Urkunde ${erg.urkunde ? "ausgefertigt" : "fehlt"}, Bestätigung ${erg.mailGesendet ? "per Mail raus" : "nicht gesendet"}. Erstattung: über das Konto (Auszahlung) — dieser Knopf überweist nichts.`);
});

werkzeugRegistrieren("wa_kuendigung_zuruecknehmen", async (args, k) => {
  const ref = String(args?.ref ?? "");
  if (!ref) return ausfuehrErgebnis.fehler("Die Karte nennt keine Bestellung.");
  const a = await bestellung(k.lauf, ref);
  if (!a) return ausfuehrErgebnis.vonSelbst("Die Bestellung gibt es so nicht mehr.");
  if (!a.gekuendigt_am) return ausfuehrErgebnis.vonSelbst("Der Vertrag ist nicht (mehr) gekündigt.");
  const { kuendigungZuruecknehmen } = await import("./fiaon-kuendigung");
  const erg = await kuendigungZuruecknehmen(ref, `Auf seinen Wunsch per WhatsApp — entschieden im Mara-Steuerpult: ${k.von}`);
  return erg.ok
    ? ausfuehrErgebnis.erledigt(`Kündigung zurückgenommen — ${erg.ratenZurueck} ${erg.ratenZurueck === 1 ? "Rate ist" : "Raten sind"} wieder offen.`)
    : ausfuehrErgebnis.fehler("Die Rücknahme ging nicht durch.");
});

werkzeugRegistrieren("wa_daten_loeschen", async (args, k) => {
  const personId = Number(args?.personId);
  if (!Number.isInteger(personId) || personId <= 0) return ausfuehrErgebnis.fehler("Die Karte nennt keine Person.");
  const { vorschau, ausfuehren } = await import("./fiaon-loeschen");
  // Dieselbe Einteilung wie die Zentrale: Ohne Zahlung endgültig, mit Rechnung anonymisiert (§ 147 AO).
  const v = await vorschau([personId], k.lauf);
  if (v.endgueltig + v.anonymisiert === 0) return ausfuehrErgebnis.vonSelbst("Seine Daten sind schon gelöscht.");
  const erg = await ausfuehren([personId], `Inhaber (${k.von}, Mara-Steuerpult)`, v.bestaetigung, "Löschwunsch per WhatsApp (E-372)", k.lauf);
  return erg.ok ? ausfuehrErgebnis.erledigt(String(erg.meldung ?? "Gelöscht.")) : ausfuehrErgebnis.fehler(String(erg.fehler ?? "Löschen ging nicht.").slice(0, 300));
});

werkzeugRegistrieren("wa_ratenpause_haertefall", async (args, k) => {
  const ref = String(args?.ref ?? "");
  if (!ref) return ausfuehrErgebnis.fehler("Die Karte nennt keine Bestellung.");
  const { ratenpauseAnwenden } = await import("./fiaon-ratenpause");
  const p = await ratenpauseAnwenden({ ref, grund: `Härtefall per WhatsApp — freigegeben im Mara-Steuerpult: ${k.von}`, agentId: k.agentId, agentName: k.von, ohneSperre: true }, k.lauf);
  if (!p.ok) return /keine offene Rate|geändert/i.test(p.fehler) ? ausfuehrErgebnis.vonSelbst(p.fehler) : ausfuehrErgebnis.fehler(p.fehler);
  return ausfuehrErgebnis.erledigt(p.meldung);
});
