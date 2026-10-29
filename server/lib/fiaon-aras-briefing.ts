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
import { istJahresvertrag } from "../../shared/fiaon-antrag-stand";
import { stufeAusAntrag, type KartenZiel } from "../../shared/fiaon-mara-ton";
import { paket } from "../../shared/fiaon-pakete";
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
    SELECT p.id, p.first_name, p.last_name, p.anrede, p.country, p.is_blocked, p.assigned_agent_id, p.sprache, COALESCE(p.kind, '') AS kind,
           a.id AS agent_id, a.name AS agent_name, a.first_name AS agent_vorname, a.last_name AS agent_nachname, a.anrede AS agent_anrede,
           (a.active AND a.zugang_gesperrt_am IS NULL) AS agent_aktiv
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id AND COALESCE(a.art, 'mensch') = 'mensch'
     WHERE p.id = ${e.personId}`) as any[];
  if (!p) return leer;

  const [antrag] = (await lauf`
    SELECT ref, status, payment_status, current_step, submitted_at, gekuendigt_am, abo_gestoppt_am, pack_key, pack_name, payment_reference, wanted_limit, created_at,
           vertrag_ende_am, agb_stand
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

  // ── Einsicht (D, Go-live 20.10.2026): Unterschrift, alle offenen Rechnungen, Kündigung (Vertragsart), Karte, letzte Kontakte,
  //    Notiz zum WhatsApp-Gespräch. Jede Quelle einzeln abgesichert — fehlt eine Tabelle, fehlt nur diese Zeile.
  let unterschriebenAm: string | null = null;
  let offeneRechnungen: Briefing["offeneRechnungen"] = null;
  let kuendigung: Briefing["kuendigung"] = null;
  if (antrag?.ref) {
    const [va] = (await lauf`SELECT MIN(angenommen_am) AS am FROM fiaon_vertragsannahmen WHERE ref = ${antrag.ref} AND COALESCE(weg, '') NOT LIKE '%pruefstand%'`.catch(() => [])) as any[];
    unterschriebenAm = tag(va?.am);
    const offen = (await lauf`
      SELECT rate_nr, betrag_cents, faellig_am FROM fiaon_abo_raten
       WHERE ref = ${antrag.ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL AND faellig_am <= CURRENT_DATE
       ORDER BY faellig_am, rate_nr`.catch(() => [])) as any[];
    offeneRechnungen = offen.length ? offen.slice(0, 3).map((r: any) => ({ nr: Number(r.rate_nr), betrag: euroText(Number(r.betrag_cents ?? 0)), faelligAm: tag(r.faellig_am) ?? "" })) : null;
    if (antrag.gekuendigt_am) {
      // E-396: Jahresvertrag (AGB ab 03.09.2026) läuft bis zum Laufzeitende, Kulanz nach Zahlung ALLER offenen Rechnungen;
      // Altvertrag wirkt zum Ende des Abrechnungsmonats (vertrag_ende_am), danach nie eine Rate (E-391/E-394).
      const summe = offen.reduce((x: number, r: any) => x + Number(r.betrag_cents ?? 0), 0);
      kuendigung = { am: tag(antrag.gekuendigt_am) ?? "", art: istJahresvertrag(antrag.agb_stand) ? "jahresvertrag" : "altvertrag", endeAm: tag(antrag.vertrag_ende_am), offenBetrag: summe > 0 ? euroText(summe) : null };
    }
  }
  let karte: Briefing["karte"] = { stand: "keine_info" };
  const [kk] = (await lauf`
    SELECT gesendet_am, kanal, bestaetigt_am, gemeldet_am FROM fiaon_konto_karte WHERE person_id = ${e.personId}
     ORDER BY COALESCE(bestaetigt_am, gemeldet_am, gesendet_am) DESC NULLS LAST LIMIT 1`.catch(() => [])) as any[];
  if (kk?.bestaetigt_am || kk?.gemeldet_am || kk?.kanal === "gemeldet") karte = { stand: "konto_eroeffnet", am: tag(kk.bestaetigt_am ?? kk.gemeldet_am ?? kk.gesendet_am) };
  else if (kk?.gesendet_am) karte = { stand: "link_gesendet", am: tag(kk.gesendet_am) };
  const kontaktZeilen = (await lauf`
    SELECT am, art, text FROM (
      SELECT c.beginn AS am, 'anruf' AS art,
             CONCAT(CASE WHEN c.richtung IN ('eingehend', 'rein') THEN 'Anruf von ihm' WHEN c.gefuehrt_von = 'aras' THEN 'Anruf von ARAS' ELSE 'Anruf vom Team' END,
                    CASE WHEN c.ergebnis IS NOT NULL THEN ' — ' || c.ergebnis ELSE '' END) AS text
        FROM fiaon_calls c WHERE c.person_id = ${e.personId} AND c.beginn > NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT m.created_at, 'mail', CONCAT('Mail ', m.event) FROM fiaon_mail_log m
       WHERE m.person_id = ${e.personId} AND m.created_at > NOW() - INTERVAL '30 days' AND COALESCE(m.status, '') IN ('versandt', 'gesendet')
      UNION ALL
      SELECT w.created_at, 'whatsapp', CASE WHEN w.richtung = 'rein' THEN 'WhatsApp von ihm' ELSE 'WhatsApp an ihn' END FROM fiaon_whatsapp w
       WHERE w.person_id = ${e.personId} AND w.created_at > NOW() - INTERVAL '30 days'
    ) k ORDER BY am DESC LIMIT 4`.catch(() => [])) as any[];
  const ERGEBNIS_WORT: Record<string, string> = { nicht_erreicht: "nicht erreicht", mailbox: "Mailbox", erreicht_zahlt_am: "Zahlungszusage", erreicht_zahlt_gleich: "zahlt sofort",
    erreicht_abgelehnt: "abgelehnt", erreicht_sonstiges: "erreicht", rueckruf_termin: "Rückruf vereinbart", rueckruf: "Rückruf gewünscht", abgebrochen: "abgebrochen" };
  const kontakte = kontaktZeilen.map((k: any) => {
    const t = String(k.text ?? "").replace(/ — ([a-z_]+)$/, (_m, w: string) => ` — ${ERGEBNIS_WORT[w] ?? w.replace(/_/g, " ")}`)
      .replace(/^Mail ([a-z_]+)$/, (_m, ev: string) => `Mail (${ev === "abo_payment_reminder" || ev === "mara_rate_erinnerung" ? "Raten-Erinnerung" : ev === "payment_reminder" ? "Zahlungserinnerung" : ev.replace(/_/g, " ")})`);
    return `${tag(k.am)?.slice(0, 6) ?? ""} ${t}`.trim();
  });
  const [wg] = (await lauf`SELECT notiz FROM fiaon_whatsapp_gespraech WHERE person_id = ${e.personId} AND notiz IS NOT NULL AND LENGTH(TRIM(notiz)) > 3 ORDER BY updated_at DESC NULLS LAST LIMIT 1`.catch(() => [])) as any[];
  const maraNotiz = wg?.notiz ? notizSauber(wg.notiz).slice(0, 200) || null : null;

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

  // E-458: Die Erinnerung vor dem Global-Gespräch und der Anruf-Wunsch eines Firmenkontakts (kind business) laufen immer in der
  // Business-Welt — auch wenn er (noch) kein Global-Kunde im Sinne von E-272 ist (z. B. nur ein gebuchtes Erstgespräch).
  const firmaKontakt = e.spielart === "erinnerung" || (e.spielart === "wunsch" && String(p.kind) === "business");
  const global = firmaKontakt || await istGlobalKunde(e.personId, lauf).catch(() => false);
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

  // Scheibe 2 (Akte): der Auftrag des Betreuers und das Offene aus dem Plan-Eintrag, dazu „Was Aras wissen muss“ (je Kunde).
  let auftrag: Briefing["auftrag"] = null;
  let offenes: string[] | null = null;
  let offenArten: string[] | null = null;
  let planEinwilligung: number | null = null;
  if (e.planId) {
    const [pl] = (await lauf`SELECT auftrag_von, auftrag_von_dat, auftrag_text, auftrag_offenes, einwilligung_id FROM fiaon_aras_plan WHERE id = ${e.planId}`.catch(() => [])) as any[];
    planEinwilligung = pl?.einwilligung_id != null ? Number(pl.einwilligung_id) : null;
    if (pl?.auftrag_text) auftrag = { text: String(pl.auftrag_text).slice(0, 500), von: String(pl.auftrag_von ?? "das Team"), vonDat: pl.auftrag_von_dat ? String(pl.auftrag_von_dat) : null };
    if (Array.isArray(pl?.auftrag_offenes)) {
      offenes = (pl.auftrag_offenes as unknown[]).map((o: any) => (typeof o === "string" ? o : String(o?.satz ?? ""))).map((x) => x.trim()).filter(Boolean).slice(0, 8);
      if (!offenes.length) offenes = null;
      offenArten = (pl.auftrag_offenes as unknown[]).map((o: any) => String(o?.art ?? "")).filter(Boolean).slice(0, 8);
    }
    // Ohne Freitext, aber mit Auftraggeber: der Name trägt die Begrüßung („im Auftrag von …“).
    if (!auftrag && pl?.auftrag_von && offenes) auftrag = { text: "Bitte die offenen Punkte unten klären.", von: String(pl.auftrag_von), vonDat: pl.auftrag_von_dat ? String(pl.auftrag_von_dat) : null };
  }
  const [ap] = (await lauf`SELECT notiz FROM fiaon_aras_person WHERE person_id = ${e.personId}`.catch(() => [])) as any[];
  const arasNotiz = ap?.notiz ? String(ap.notiz).replace(/\s+/g, " ").trim().slice(0, 300) || null : null;

  let terminAm: string | null = null;
  if (e.terminId) {
    const [t] = (await lauf`SELECT beginn FROM fiaon_termine WHERE id = ${e.terminId}`) as any[];
    terminAm = zeit(t?.beginn);
  }

  // E-458: der Anruf-Wunsch (sein Ja; beim Rückruf „bei ARAS“ Maras Fenster und sein Anliegen) und das Global-Gespräch der Erinnerung.
  const { wunschFuerBriefing, gespraechFuerBriefing } = await import("./fiaon-aras-wunsch");
  const wunschInfo = e.spielart === "wunsch" || e.spielart === "termin"
    ? await wunschFuerBriefing({ einwilligungId: planEinwilligung, terminId: e.terminId ?? null, spielart: e.spielart }, lauf).catch(() => null) : null;
  const gespraech = e.spielart === "erinnerung" ? await gespraechFuerBriefing(e.terminId ?? null, lauf).catch(() => null) : null;
  // Bei Firmen ist „Betreuer“ die zuständige Person von FIAON Global (Erinnerung: die Person des Gesprächs).
  let betreuerNenn = betreuer ? { nom: betreuer.nom, dat: betreuer.dat } : null;
  if (gespraech) betreuerNenn = { nom: gespraech.mitNom, dat: gespraech.mitDat };
  else if (global && !betreuerNenn && e.spielart === "wunsch") {
    try {
      const { globalZustaendig } = await import("./fiaon-global-termin");
      const z = await globalZustaendig();
      if (z) { const [a] = (await lauf`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${z.id}`) as any[]; if (a) { const n = nennform(a); betreuerNenn = { nom: n.nom, dat: n.dat }; } }
    } catch { /* ohne Ansprechpartner sagt ARAS „die zuständige Person“ */ }
  }

  return {
    anrede, nachname: p.last_name ? String(p.last_name).trim() : null, vorname: p.first_name ? String(p.first_name).trim() : null,
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
    betreuer: betreuerNenn,
    aufnahmeFrueherAbgelehnt: !!aufnahme,
    global, isBlocked: !!p.is_blocked,
    einwilligung: einw ? { art: einw.art, am: tag(einw.erteiltAm) ?? "" } : null,
    antragLink: null,
    zahlungsseite: stufe === "zahlung_offen" && antrag?.payment_reference ? absoluteUrl(`/zahlung/${encodeURIComponent(String(antrag.payment_reference))}`) : null,
    kartenZiel,
    zusageAm: e.zusageAm ?? null,
    terminAm,
    auftrag, offenes, offenArten, arasNotiz,
    unterschriebenAm, offeneRechnungen, kuendigung, karte, kontakte: kontakte.length ? kontakte : null, maraNotiz,
    probe: e.probe === true,
    wunsch: wunschInfo, gespraech,
  };
}

/** Kurzer Vorlese-Text zu einem Bereich der Akte — rein, darum in shared/fiaon-aras-prompt.ts (offline prüfbar). */
export { akteVorlesen } from "../../shared/fiaon-aras-prompt";
