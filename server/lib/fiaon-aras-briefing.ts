// ═══════════════════════════════════════════════════════════════════════════
// ARAS — das Briefing aus der Akte (E-408, Vertrag § 10 Baustein 3)
//
// Vor jedem Anruf: wer ist dran, in welchem Land, welches Paket, welche Stufe,
// welche Rate ist offen (mit Verwendungszweck und Zahlungsseite), welche
// Termine stehen, was hat das Team zuletzt notiert, wer ist Betreuer
// (Nennform, nie Vorname), hat er früher die Aufnahme abgelehnt, ist er
// Global- oder gesperrter Kunde. Deterministisch, keine KI, ohne Volltexte.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { nennform } from "../../shared/fiaon-mitarbeiter-name";
import { stufeAusAntrag, euroGanz, type KartenZiel } from "../../shared/fiaon-mara-ton";
import { paket, paketPreisCents } from "../../shared/fiaon-pakete";
import { euroText } from "../../shared/fiaon-auskunft";
import { nummerLand, berlinTeile, type Land, type Spielart } from "../../shared/fiaon-aras";
import type { Briefing } from "../../shared/fiaon-aras-prompt";
import { absoluteUrl } from "../fiaon-base-url";
import { istGlobalKunde } from "./fiaon-global-kunde";
import { einwilligungGueltig } from "./fiaon-telefon-einwilligung";
import { nummerKern } from "./fiaon-aras-sperre";

type Lauf = typeof sqlPool;

const SYSTEMWORT = /\b(akte|stufe|lead|status|tier|ticket|vorgang|claimed_paid|pending_payment|system)\b/gi;
function notizSauber(t: unknown): string {
  return String(t ?? "").replace(/\s+/g, " ").replace(SYSTEMWORT, "…").trim().slice(0, 160);
}
const tag = (d: unknown): string | null => {
  if (!d) return null;
  const x = new Date(d as any);
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : null;
};
const zeit = (d: unknown): string | null => {
  if (!d) return null;
  const x = new Date(d as any);
  return Number.isFinite(x.getTime()) ? x.toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
};

export interface BriefingEin {
  personId: number | null; nummer: string; spielart: Spielart; rateId?: number | null; zusageAm?: string | null; terminId?: number | null; probe?: boolean;
  /** Der Plan-Eintrag (Auftrag des Betreuers, Offenes) — Scheibe 2. */
  planId?: number | null;
}

/** Heute in Berlin — damit „Freitag“ und „morgen“ richtig in ein Datum werden (Hintergrund-Modell). */
export function heuteBerlin(jetzt = new Date()): NonNullable<Briefing["heute"]> {
  const b = berlinTeile(jetzt);
  return { datum: b.datum.split("-").reverse().join("."), wochentag: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(jetzt), uhrzeit: b.hhmm };
}

export async function briefingBauen(e: BriefingEin, lauf: Lauf = sqlPool): Promise<Briefing> {
  const land: Land = nummerLand(e.nummer) ?? "DE";
  const leer: Briefing = {
    anrede: null, nachname: null, land, sprache: "de", paketName: null, paketKey: null, stufe: "lead",
    offeneRate: null, raten: { gezahlt: 0, offen: 0, naechsteAm: null }, termine: [], notizen: [], betreuer: null,
    aufnahmeFrueherAbgelehnt: false, global: false, isBlocked: false, probe: e.probe === true, heute: heuteBerlin(),
  };
  if (!e.personId) return leer;

  const [p] = (await lauf`
    SELECT p.id, p.first_name, p.last_name, p.anrede, p.country, p.is_blocked, p.assigned_agent_id, p.sprache,
           a.id AS agent_id, a.name AS agent_name, a.first_name AS agent_vorname, a.last_name AS agent_nachname, a.anrede AS agent_anrede,
           (a.active AND a.zugang_gesperrt_am IS NULL) AS agent_aktiv
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id AND COALESCE(a.art, 'mensch') = 'mensch'
     WHERE p.id = ${e.personId}`) as any[];
  if (!p) return leer;

  const [antrag] = (await lauf`
    SELECT ref, status, payment_status, current_step, submitted_at, gekuendigt_am, abo_gestoppt_am, pack_key, pack_name, payment_reference, wanted_limit, created_at
      FROM fiaon_applications
     WHERE person_id = ${e.personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL AND archived_at IS NULL
       AND COALESCE(ist_entwurf, FALSE) = FALSE AND COALESCE(type, '') <> 'schufa' AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%'
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];

  const stufe = stufeAusAntrag(antrag ?? null);
  const paketKey = antrag?.pack_key ? String(antrag.pack_key).toLowerCase() : null;
  const pk = paketKey && paket(paketKey) ? paketKey : null;

  // Raten: gezahlt / offen / nächste — und die offene, fällige Rate mit Verwendungszweck
  let offeneRate: Briefing["offeneRate"] = null;
  let raten = { gezahlt: 0, offen: 0, naechsteAm: null as string | null };
  if (antrag?.ref) {
    const [z] = (await lauf`
      SELECT COUNT(*) FILTER (WHERE status = 'bezahlt')::int AS gezahlt,
             COUNT(*) FILTER (WHERE status = 'offen' AND storniert_am IS NULL)::int AS offen,
             MIN(faellig_am) FILTER (WHERE status = 'offen' AND storniert_am IS NULL AND faellig_am >= CURRENT_DATE) AS naechste
        FROM fiaon_abo_raten WHERE ref = ${antrag.ref}`) as any[];
    raten = { gezahlt: Number(z?.gezahlt ?? 0), offen: Number(z?.offen ?? 0), naechsteAm: tag(z?.naechste) };
    const [r] = (await (e.rateId
      ? lauf`SELECT id, rate_nr, betrag_cents, faellig_am, zahlungsreferenz FROM fiaon_abo_raten WHERE id = ${e.rateId}`
      : lauf`SELECT id, rate_nr, betrag_cents, faellig_am, zahlungsreferenz FROM fiaon_abo_raten
              WHERE ref = ${antrag.ref} AND status = 'offen' AND storniert_am IS NULL AND faellig_am <= CURRENT_DATE + 1
              ORDER BY faellig_am LIMIT 1`)) as any[];
    if (r) {
      offeneRate = {
        nr: Number(r.rate_nr), betrag: euroText(Number(r.betrag_cents ?? 0)), faelligAm: tag(r.faellig_am) ?? "",
        verwendungszweck: String(r.zahlungsreferenz ?? antrag.payment_reference ?? antrag.ref),
        zahlungsseite: absoluteUrl(`/zahlung/${encodeURIComponent(String(r.zahlungsreferenz ?? antrag.payment_reference ?? antrag.ref))}`),
      };
    }
  }

  const termine = (await lauf`
    SELECT t.beginn, ag.name, ag.first_name, ag.last_name, ag.anrede, COALESCE(ag.art, 'mensch') AS art
      FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.person_id = ${e.personId} AND t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '30 minutes'
     ORDER BY t.beginn LIMIT 3`) as any[];

  const notizen = (await lauf`
    SELECT note FROM fiaon_contact_log
     WHERE (person_id = ${e.personId} OR ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${e.personId}))
       AND voided_at IS NULL AND note IS NOT NULL AND LENGTH(TRIM(note)) > 8
       AND type IN ('note', 'result')
     ORDER BY created_at DESC LIMIT 3`) as any[];

  const [aufnahme] = (await lauf`
    SELECT 1 FROM fiaon_calls WHERE person_id = ${e.personId} AND ohne_aufzeichnung_am IS NOT NULL
     UNION ALL
    SELECT 1 FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id WHERE c.person_id = ${e.personId} AND aa.aufnahme_nein_am IS NOT NULL
     LIMIT 1`) as any[];

  const global = await istGlobalKunde(e.personId, lauf).catch(() => false);
  const einw = await einwilligungGueltig(nummerKern(e.nummer), e.personId, lauf).catch(() => null);

  let kartenZiel: KartenZiel | null = null;
  const wunsch = antrag?.wanted_limit != null ? Number(antrag.wanted_limit) : null;
  if (wunsch && wunsch > 0) {
    let rahmen: number | null = null;
    try { const { PACK_LIMITS } = await import("../routes/fiaon-antrag"); rahmen = pk && (PACK_LIMITS as any)[pk] != null ? Number((PACK_LIMITS as any)[pk]) : null; } catch { rahmen = null; }
    const euro = rahmen != null && rahmen > 0 ? Math.min(wunsch, rahmen) : wunsch;
    kartenZiel = { euro, art: rahmen != null && wunsch > rahmen ? "paket" : "wunsch", paketName: antrag?.pack_name ? String(antrag.pack_name) : null };
  }

  const anredeRoh = String(p.anrede ?? "").trim().toLowerCase();
  const anrede: Briefing["anrede"] = /^(herr|herrn|hr)/.test(anredeRoh) ? "Herr" : /^(frau|fr)/.test(anredeRoh) ? "Frau" : null;
  const betreuer = p.agent_id && p.agent_aktiv ? nennform({ name: p.agent_name, first_name: p.agent_vorname, last_name: p.agent_nachname, anrede: p.agent_anrede }) : null;

  let terminAm: string | null = null;
  if (e.terminId) {
    const [t] = (await lauf`SELECT beginn FROM fiaon_termine WHERE id = ${e.terminId}`) as any[];
    terminAm = zeit(t?.beginn);
  }

  return {
    anrede, nachname: p.last_name ? String(p.last_name).trim() : null,
    land: (String(p.country ?? "").toUpperCase() === "AT" || String(p.country ?? "").toUpperCase() === "CH") ? (String(p.country).toUpperCase() as Land) : land,
    sprache: String(p.sprache ?? "").toLowerCase().startsWith("en") ? "en" : "de",
    heute: heuteBerlin(),
    paketName: antrag?.pack_name ? String(antrag.pack_name) : (pk ? paket(pk)?.label ?? null : null),
    paketKey: pk, stufe,
    offeneRate, raten,
    termine: termine.map((t: any) => ({
      am: zeit(t.beginn) ?? "", bei: t.art === "ki" ? "Aras" : nennform({ name: t.name, first_name: t.first_name, last_name: t.last_name, anrede: t.anrede }).dat,
    })),
    notizen: notizen.map((n: any) => notizSauber(n.note)).filter(Boolean),
    betreuer: betreuer ? { nom: betreuer.nom, dat: betreuer.dat } : null,
    aufnahmeFrueherAbgelehnt: !!aufnahme,
    global, isBlocked: !!p.is_blocked,
    einwilligung: einw ? { art: einw.art, am: tag(einw.erteiltAm) ?? "" } : null,
    antragLink: null,
    zahlungsseite: stufe === "zahlung_offen" && antrag?.payment_reference ? absoluteUrl(`/zahlung/${encodeURIComponent(String(antrag.payment_reference))}`) : null,
    kartenZiel,
    zusageAm: e.zusageAm ?? null,
    terminAm,
    probe: e.probe === true,
  };
}

/** Kurzer Vorlese-Text zu einem Bereich der Akte — für das Werkzeug akte_nachsehen (≤ 400 Zeichen, keine Systemwörter). */
export function akteVorlesen(b: Briefing, bereich: "zahlungen" | "termine" | "notizen" | "vertrag"): string {
  switch (bereich) {
    case "zahlungen":
      return b.offeneRate
        ? `Offen ist die Rate ${b.offeneRate.nr} über ${b.offeneRate.betrag}, fällig am ${b.offeneRate.faelligAm}. ${b.raten.gezahlt} Raten sind bezahlt.`
        : `${b.raten.gezahlt} Raten bezahlt, ${b.raten.offen} offen${b.raten.naechsteAm ? `, die nächste am ${b.raten.naechsteAm}` : ""}.`;
    case "termine":
      return b.termine.length ? `Termine: ${b.termine.map((t) => `${t.am} bei ${t.bei}`).join("; ")}.` : "Es steht kein Termin.";
    case "notizen":
      return b.notizen.length ? `Zuletzt notiert: ${b.notizen.join(" · ")}` : "Es gibt keine Notizen.";
    case "vertrag":
      return `${b.paketName ? `Paket ${b.paketName}` : "Kein Paket"}${b.paketKey ? `, ${euroText(paketPreisCents(b.paketKey))} im Monat, zwölf Monatsraten` : ""}. ${b.kartenZiel ? `Wunschlimit ${euroGanz(b.kartenZiel.euro)}.` : ""}`.trim().slice(0, 400);
  }
}
