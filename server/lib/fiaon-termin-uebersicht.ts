// ═══════════════════════════════════════════════════════════════════════════
// MARAS TERMINE FÜR DEN CHEF — DIE DATEN (29.09.2026, E-260)
//
// GET /chef/mara/termine (fiaon-mara-steuerpult.ts) → Reiter „Termine" im
// Mara-Steuerpult. Nur lesend. Form, Gruppen und Reihenfolge stehen rein in
// shared/fiaon-termin-uebersicht.ts.
//
// WELCHE TERMINE: alle Termine des Hauses (nicht nur Maras) — Justin ruft bis
// Freitag alle an. Maras Termine erkennt NUR fiaon_termine.herkunft
// (mara_whatsapp, mara_mail, mara_whatsapp_link): Das Mara-Protokoll kennt die
// Mail-Buchung und zwei frühe WhatsApp-Buchungen nicht (Analyse E-260, 1.2).
//   · gebucht, Beginn −3 Tage bis +14 Tage,
//   · verpasst und von niemandem abgearbeitet (erledigt_am leer), 14 Tage —
//     dieselbe Grenze wie /agent/termine (VERPASST_OFFEN_TAGE; Gegenprüfung
//     29.09.: hier stand „3 Tage — dieselbe Grenze", /agent/termine nimmt 14),
//   · erledigt, abgesagt, abgearbeitete verpasste der letzten 3 Tage.
// Ohne Testpersonen und zusammengeführte Personen, höchstens 300.
//
// GELD, STUFE, AKTE: aus der Telefonkartei (karteEinzeln — nur importiert,
// die Datei gehört E-259). Dieselbe Rechnung, die Justin dort sieht (E-181,
// Katalogpreis), nur für offene Zeilen, höchstens 40 Menschen, 30 s gemerkt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { HERKUENFTE } from "./fiaon-termine";
import { waehlbareNummer } from "./fiaon-telefon";
import { berlinZeitpunkt } from "./fiaon-time";
import {
  abwesenheitLesen, abwesenheitJetzt, abwesenheitProblem, istAbwesend, vertreterPruefen, vertreterKandidaten,
  teamFuerAbwesenheit, freiePlaetzeVertreter, bisText, type AktiveAbwesenheit,
} from "./fiaon-abwesenheit";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import { maraMarke, MARA_NEU_STUNDEN } from "../../shared/fiaon-mara-marke";
import { KARTEI_LAGE_TEXT, type KarteiKarte } from "../../shared/fiaon-telefonkartei";
import {
  gruppieren, ueberschneidungen, istOffen, istWartend, istMaraWeg, berlinTagIso, tagPlus, wochentagIso, stufeAusTier, zusagePasst,
  VERPASST_OFFEN_TAGE,
  type TerminZeile, type TerminUebersicht, type TeamRueckruf, type AbwesenheitSicht, type TerminStufe,
} from "../../shared/fiaon-termin-uebersicht";

type Lauf = typeof sqlPool;

const HOECHSTENS = 300;
const KARTEN_HOECHSTENS = 40;
const KARTE_MERKEN_MS = 30_000;
const UHR = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const uhr = (d: Date | string) => {
  const t: Record<string, string> = {};
  for (const p of UHR.formatToParts(new Date(d))) t[p.type] = p.value;
  return `${t.hour}:${t.minute}`;
};
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const text = (v: unknown) => String(v ?? "").trim();

// ── Karten aus der Telefonkartei (30 s gemerkt) ──────────────────────────
const karten = new Map<number, { karte: KarteiKarte | null; am: number }>();
async function karteFuer(personId: number): Promise<KarteiKarte | null> {
  const m = karten.get(personId);
  if (m && Date.now() - m.am < KARTE_MERKEN_MS) return m.karte;
  try {
    const { karteEinzeln } = await import("./fiaon-telefonkartei");
    const karte = await karteEinzeln(personId);
    karten.set(personId, { karte, am: Date.now() });
    return karte;
  } catch (e) {
    console.error(`[TERMIN-UEBERSICHT] Karte ${personId} nicht lesbar:`, String((e as Error)?.message ?? e).slice(0, 160));
    return null;
  }
}
/** Nur für Prüfstände: gemerkte Karten verwerfen. */
export function terminKartenVergessen(): void { karten.clear(); }

/**
 * Aus der Notiz eines Mara-Termins das Anliegen:
 *   WhatsApp — „Rückruf, von Mara per WhatsApp vereinbart (…)( — in Abwesenheit …). <Anliegen>",
 *   E-Mail   — „Rückrufwunsch aus E-Mail [Mail #n]( — in Abwesenheit …): <Anliegen>"
 *              (fiaon-postmeister-werkzeuge.ts; Gegenprüfung 29.09.: vorher erkannte
 *              diese Funktion nur WhatsApp — bei Mail-Terminen blieb das Anliegen leer).
 */
export function anliegenAusNotiz(notiz: string): string | null {
  const roh = notiz.trim();
  const n = roh
    .replace(/^Rückruf, von Mara[^)]*\)\s*(—[^.]*\.)?\s*\.?\s*/, "")
    .replace(/^Rückrufwunsch aus E-Mail\s*(\[[^\]]*\])?\s*(—[^:]*)?:\s*/, "")
    .trim();
  return n && n !== roh ? n.slice(0, 240) : null;
}

/** Die Vorschläge für „bis": die nächsten Werktage um 09:00 (Berliner Zeit, berlinZeitpunkt kennt die Zeitumstellung). */
function bisVorschlaege(jetzt: Date): { text: string; iso: string }[] {
  const heute = berlinTagIso(jetzt);
  const raus: { text: string; iso: string }[] = [];
  for (let d = 1; d <= 9 && raus.length < 5; d++) {
    const tag = tagPlus(heute, d);
    if (wochentagIso(tag) > 5) continue;
    const neun = berlinZeitpunkt(tag, 9 * 60);
    raus.push({ text: bisText(neun), iso: neun.toISOString() });
  }
  return raus;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ABWESENHEIT FÜR DEN REITER
// ═══════════════════════════════════════════════════════════════════════════
export async function abwesenheitSicht(chefAgentId: number | null, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<AbwesenheitSicht> {
  const z = await abwesenheitLesen(false, lauf);
  const ab = await abwesenheitJetzt(lauf, jetzt);
  const problem = await abwesenheitProblem(lauf);
  const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
  const gruender = await gruenderAgentId().catch(() => 0);
  const vertreterId = z.vertreterId ?? (chefAgentId || gruender || null);
  const vpr = vertreterId ? await vertreterPruefen(vertreterId, lauf) : { vertreter: null, problem: null };
  const vertreter = ab?.vertreter ?? vpr.vertreter;
  const team = (await teamFuerAbwesenheit(lauf)).filter((t) => t.id !== vertreter?.id);
  let zeitenHeute: string | null = null;
  let freieHeute: number | null = null;
  let freieBisEnde: number | null = null;
  if (vertreter) {
    const { arbeitszeitAm } = await import("./fiaon-mara-termin");
    zeitenHeute = await arbeitszeitAm(vertreter.id, berlinTagIso(jetzt), lauf).catch(() => null);
  }
  if (ab) {
    const frei = await freiePlaetzeVertreter(ab, 20, lauf).catch(() => []);
    const heute = berlinTagIso(jetzt);
    freieHeute = frei.filter((s) => s.datum === heute).length;
    freieBisEnde = frei.length;
  }
  // Abgelaufen, aber (noch) nicht vermerkt: gilt als beendet — abwesenheitJetzt schreibt es beim nächsten Lesen nach.
  const abgelaufen = z.an && !!z.bis && new Date(z.bis).getTime() <= jetzt.getTime();
  return {
    an: !!ab,
    gesetzt: z.an && !abgelaufen,
    bis: z.bis,
    endeteAm: !z.an ? z.endeteAm : abgelaufen ? z.bis : null,
    endeteWie: !z.an ? z.endeteWie : abgelaufen ? "abgelaufen" : null,
    vertreter: vertreter ? { id: vertreter.id, name: vertreter.name, vorname: vertreter.vorname, anrufName: vertreter.anrufName } : null,
    problem: problem ?? (!vertreter && vpr.problem ? vpr.problem : null),
    fuer: z.fuer,
    abwesend: ab ? team.filter((t) => istAbwesend(ab, t.id)) : [],
    team,
    kandidaten: await vertreterKandidaten([gruender, Number(chefAgentId || 0)], lauf),
    zeitenHeute, freieHeute, freieBisEnde,
    verlauf: z.verlauf.slice(0, 8),
    vorschlaege: bisVorschlaege(jetzt),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ÜBERSICHT
// ═══════════════════════════════════════════════════════════════════════════
export async function terminUebersicht(opts: { chefAgentId?: number | null; jetzt?: Date } = {}, lauf: Lauf = sqlPool): Promise<TerminUebersicht> {
  const jetzt = opts.jetzt ?? new Date();
  const ab: AktiveAbwesenheit | null = await abwesenheitJetzt(lauf, jetzt);
  const zeilen = (await lauf`
    SELECT t.id, t.person_id, t.agent_id, t.beginn, COALESCE(t.dauer_min, 20) AS dauer, t.status, t.quelle,
           (to_jsonb(t) ->> 'herkunft') AS herkunft,
           t.erledigt_am, t.abgesagt_am, t.abgesagt_von, t.created_at, t.notiz,
           ag.name AS bei_name, COALESCE(NULLIF(ag.first_name, ''), split_part(ag.name, ' ', 1)) AS bei_vorname,
           p.assigned_agent_id, COALESCE(NULLIF(be.first_name, ''), split_part(be.name, ' ', 1)) AS betreuer_vorname,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, p.primary_email, 'Ohne Namen') AS name,
           p.priority_tier, p.tier_reason, p.primary_phone, p.country,
           ap.phone AS a_phone, ap.phone_country_code AS a_vorwahl, ap.ref
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id AND p.merged_into_person_id IS NULL
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      LEFT JOIN fiaon_agents be ON be.id = p.assigned_agent_id
      LEFT JOIN LATERAL (
        SELECT a.phone, a.phone_country_code, a.ref FROM fiaon_applications a
         WHERE a.person_id = p.id AND a.merged_into IS NULL
         ORDER BY (a.archived_at IS NULL) DESC, a.created_at DESC LIMIT 1) ap ON TRUE
     WHERE p.ist_test_am IS NULL
       AND ((t.status = 'gebucht' AND t.beginn > ${jetzt}::timestamptz - INTERVAL '3 days' AND t.beginn < ${jetzt}::timestamptz + INTERVAL '14 days')
         OR (t.status = 'verpasst' AND t.erledigt_am IS NULL AND t.beginn > ${jetzt}::timestamptz - make_interval(days => ${VERPASST_OFFEN_TAGE}::int))
         OR (t.status IN ('erledigt', 'verpasst', 'abgesagt')
             AND COALESCE(t.erledigt_am, t.abgesagt_am, t.beginn) > ${jetzt}::timestamptz - INTERVAL '3 days'
             AND t.beginn < ${jetzt}::timestamptz + INTERVAL '14 days'))
     ORDER BY t.beginn ASC
     LIMIT ${HOECHSTENS}`) as any[];

  // ── Maras Spur: Protokoll (Nachprüfung, Wunsch, Nummer) und ihre Zusage ──
  const maraIds = zeilen.filter((z) => istMaraWeg(z.herkunft)).map((z) => Number(z.id));
  const protokoll = new Map<number, any>();
  if (maraIds.length) {
    try {
      const { protokollTabelle } = await import("./fiaon-mara-termin");
      await protokollTabelle(lauf);
      for (const p of (await lauf`
        SELECT DISTINCT ON (termin_id) termin_id, nummer, daten, pruefung_ok, pruefung_text, am
          FROM fiaon_mara_protokoll
         WHERE termin_id = ANY(${maraIds}) AND art IN ('termin_gebucht', 'termin_verschoben')
         ORDER BY termin_id, id DESC`) as any[]) protokoll.set(Number(p.termin_id), p);
    } catch (e) {
      console.error("[TERMIN-UEBERSICHT] Mara-Protokoll:", String((e as Error)?.message ?? e).slice(0, 160));
    }
  }

  // ── Karten (Geld, Stufe, Akte) nur für offene Zeilen ────────────────────
  const offenePersonen = Array.from(new Set(zeilen
    .filter((z) => z.status === "gebucht" || (z.status === "verpasst" && !z.erledigt_am))
    .map((z) => Number(z.person_id)))).slice(0, KARTEN_HOECHSTENS);
  const karteJe = new Map<number, KarteiKarte | null>();
  for (const pid of offenePersonen) karteJe.set(pid, await karteFuer(pid));

  const roh: TerminZeile[] = [];
  for (const z of zeilen) {
    const id = Number(z.id);
    const personId = Number(z.person_id);
    const herkunft = z.herkunft ? String(z.herkunft) : null;
    const status = String(z.status) as TerminZeile["status"];
    const abgeschlossen = status !== "gebucht" && !!z.erledigt_am;
    const offen = status === "gebucht" || (status === "verpasst" && !z.erledigt_am);
    const karte = karteJe.get(personId) ?? null;
    const tel = karte?.telefonWaehlbar
      ? { waehlbar: karte.telefonWaehlbar, anzeige: karte.telefonAnzeige }
      : waehlbareNummer([{ nummer: z.a_phone, vorwahl: z.a_vorwahl }, { nummer: z.primary_phone }], z.country);
    const art = terminArtAusQuelle(z.quelle);
    const marke = maraMarke(herkunft);
    let mara: TerminZeile["mara"] = null;
    if (marke && istMaraWeg(herkunft)) {
      const p = protokoll.get(id);
      const daten = typeof p?.daten === "string" ? (() => { try { return JSON.parse(p.daten); } catch { return null; } })() : p?.daten ?? null;
      let zusage: string | null = null;
      // Seit Maras Buchung verschoben (ein Mensch hat die Zeit geändert)? Dann gilt ihre Zusage
      // nicht mehr — die Zeile sagt es statt eines falschen Zitats (Gegenprüfung 29.09., #1682).
      const protokollBeginn = daten?.beginn ? new Date(daten.beginn) : null;
      const verschobenVon = protokollBeginn && !Number.isNaN(protokollBeginn.getTime())
        && Math.abs(protokollBeginn.getTime() - new Date(z.beginn).getTime()) >= 60_000 ? protokollBeginn.toISOString() : null;
      const nummer = text(p?.nummer) || String(tel.waehlbar ?? "").replace(/\D/g, "");
      if (!verschobenVon && herkunft !== "mara_mail" && (nummer || personId)) {
        try {
          // Erst AB der Buchung (vorher −60 s: dann war es oft Maras Angebot), und nur ein Satz,
          // der genau diese Zeit am richtigen Tag zusagt (zusagePasst).
          const texte = (await lauf`
            SELECT text, created_at FROM fiaon_whatsapp
             WHERE (nummer = ${nummer || "-"} OR person_id = ${personId}) AND richtung = 'raus' AND status <> 'fehler'
               AND created_at >= ${new Date(z.created_at)} ORDER BY id LIMIT 20`) as any[];
          const t = texte.find((x) => zusagePasst(String(x.text ?? ""), z.beginn, x.created_at));
          zusage = t ? String(t.text).replace(/\s+/g, " ").trim().slice(0, 280) : null;
        } catch { /* fiaon_whatsapp fehlt (lokal) — dann ohne Zusage */ }
      }
      mara = {
        weg: herkunft, text: marke.text, kanal: herkunft === "mara_mail" ? "E-Mail" : "WhatsApp",
        zusage,
        verschobenVon,
        anliegen: text(daten?.wunsch?.anliegen) || anliegenAusNotiz(text(z.notiz)),
        pruefungOk: p?.pruefung_ok ?? null,
        pruefung: p?.pruefung_text ? String(p.pruefung_text) : null,
      };
    }
    const lage = karte?.lage ?? null;
    // Ohne Karte (erledigte, abgesagte Zeilen): dieselbe Regel wie die Telefonkartei (stufeAusTier).
    const stufe: TerminStufe | null = (lage as TerminStufe | null) ?? stufeAusTier(z.priority_tier, z.tier_reason, !!z.ref);
    roh.push({
      id,
      beginn: iso(z.beginn)!,
      dauerMin: Number(z.dauer) || 20,
      status,
      abgeschlossen,
      abgesagtVon: z.abgesagt_von ? String(z.abgesagt_von) : null,
      angelegtAm: iso(z.created_at)!,
      art: { text: art.text, ton: art.ton, erklaerung: art.erklaerung },
      weg: { herkunft, text: herkunft ? ((HERKUENFTE as Record<string, string>)[herkunft] ?? herkunft) : "Weg nicht mitgeführt" },
      mara,
      neu: !!mara && jetzt.getTime() - new Date(z.created_at).getTime() < MARA_NEU_STUNDEN * 3_600_000,
      bei: {
        id: Number(z.agent_id), vorname: text(z.bei_vorname) || text(z.bei_name) || `#${z.agent_id}`, name: text(z.bei_name),
        istVertreter: !!ab && Number(z.agent_id) === ab.vertreter.id,
      },
      betreuer: z.assigned_agent_id ? { id: Number(z.assigned_agent_id), vorname: text(z.betreuer_vorname) || `#${z.assigned_agent_id}` } : null,
      beiAbwesendem: offen && istAbwesend(ab, Number(z.agent_id), new Date(z.beginn)),
      person: {
        id: personId, name: text(z.name) || "Ohne Namen",
        stufe, stufeText: stufe ? (KARTEI_LAGE_TEXT as Record<string, string>)[stufe] ?? null : null,
        stand: karte?.stand ?? null,
      },
      geld: offen && karte?.zahlung ? {
        art: karte.zahlung.art, betragCents: karte.zahlung.betragCents, referenz: karte.zahlung.referenz,
        rateNr: karte.zahlung.rateNr, faelligAm: karte.zahlung.faelligAm, zahlungsseite: karte.zahlung.zahlungsseite,
      } : null,
      telefonWaehlbar: tel.waehlbar ?? null,
      telefonAnzeige: tel.anzeige ?? null,
      akteLink: karte?.akteLink ?? (z.ref ? `/chef/s/akte?id=${encodeURIComponent(String(z.ref))}` : `/chef/s/akte?id=${personId}`),
      gleichzeitigMit: [],
      abschliessbar: offen && !["onboarding_call", "global"].includes(String(z.quelle)),
      notiz: z.notiz ? String(z.notiz).slice(0, 240) : null,
      gruppe: "erledigt",
    });
  }
  // Überschneidungen unter den offenen Terminen (egal bei wem) — der Vertreter ruft sie alle an.
  for (const r of roh) {
    r.gleichzeitigMit = ueberschneidungen(r, roh).map((x) => ({ id: x.id, uhrzeit: uhr(x.beginn), bei: x.bei.vorname }));
  }
  const termine = gruppieren(roh, jetzt);

  // ── Rückruf-Notizen des Teams (Kontaktlog), offen, −3 bis +4 Tage ────────
  let teamRueckrufe: TeamRueckruf[] = [];
  try {
    const rr = (await lauf`
      SELECT cl.id, cl.scheduled_at, cl.note, cl.ref, cl.agent_id,
             COALESCE(NULLIF(ag.first_name, ''), split_part(ag.name, ' ', 1)) AS agent_vorname,
             COALESCE(cl.person_id, a.person_id) AS person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name, p.primary_email, 'Ohne Namen') AS name,
             a.phone AS a_phone, a.phone_country_code AS a_vorwahl, p.primary_phone, p.country
        FROM fiaon_contact_log cl
        LEFT JOIN fiaon_applications a ON a.ref = cl.ref AND a.merged_into IS NULL
        LEFT JOIN fiaon_persons p ON p.id = COALESCE(cl.person_id, a.person_id)
        LEFT JOIN fiaon_agents ag ON ag.id = cl.agent_id
       WHERE cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL AND cl.voided_at IS NULL
         AND cl.scheduled_at > ${jetzt}::timestamptz - INTERVAL '3 days' AND cl.scheduled_at < ${jetzt}::timestamptz + INTERVAL '4 days'
         AND (p.id IS NULL OR p.ist_test_am IS NULL)
       ORDER BY cl.scheduled_at ASC LIMIT 30`) as any[];
    teamRueckrufe = rr.map((r) => {
      const tel = waehlbareNummer([{ nummer: r.a_phone, vorwahl: r.a_vorwahl }, { nummer: r.primary_phone }], r.country);
      return {
        id: Number(r.id), am: iso(r.scheduled_at)!, agentVorname: text(r.agent_vorname) || null,
        personId: r.person_id != null ? Number(r.person_id) : null, ref: r.ref ? String(r.ref) : null,
        name: text(r.name) || "Ohne Namen", notiz: r.note ? String(r.note).slice(0, 200) : null,
        telefonWaehlbar: tel.waehlbar ?? null, telefonAnzeige: tel.anzeige ?? null,
        akteLink: r.ref ? `/chef/s/akte?id=${encodeURIComponent(String(r.ref))}` : r.person_id != null ? `/chef/s/akte?id=${Number(r.person_id)}` : null,
      };
    });
  } catch (e) {
    console.error("[TERMIN-UEBERSICHT] Team-Rückrufe:", String((e as Error)?.message ?? e).slice(0, 160));
  }

  // ── Maras Übergaben an Abwesende (offen) ────────────────────────────────
  let uebergaben = { offen: 0, letzte48h: 0 };
  if (ab) {
    try {
      const [u] = (await lauf`
        SELECT COUNT(*)::int AS offen, COUNT(*) FILTER (WHERE created_at > ${jetzt}::timestamptz - INTERVAL '48 hours')::int AS neu
          FROM fiaon_betreiber_todos
         WHERE quelle = 'mara-whatsapp' AND status <> 'erledigt' AND zustaendig_agent_id IS NOT NULL
           AND zustaendig_agent_id <> ${ab.vertreter.id}
           AND (${ab.fuer.length === 0} OR zustaendig_agent_id = ANY(${ab.fuer.length ? ab.fuer : [0]}))`) as any[];
      uebergaben = { offen: Number(u?.offen || 0), letzte48h: Number(u?.neu || 0) };
    } catch (e) {
      console.error("[TERMIN-UEBERSICHT] Übergaben:", String((e as Error)?.message ?? e).slice(0, 160));
    }
  }

  // ── Zähler ──────────────────────────────────────────────────────────────
  const n = (g: string) => termine.filter((t) => t.gruppe === g).length;
  const offene = termine.filter(istOffen);
  const geldJe = new Map<number, number>();
  for (const t of offene) if (t.geld?.betragCents) geldJe.set(t.person.id, t.geld.betragCents);
  return {
    ok: true,
    stand: jetzt.toISOString(),
    abwesenheit: await abwesenheitSicht(opts.chefAgentId ?? null, lauf, jetzt),
    zaehler: {
      // Die Glasfläche kann einen wartenden Kunden zeigen (gruppe „jetzt") — er zählt trotzdem als wartend.
      wartet: termine.filter((t) => istWartend(t, jetzt)).length,
      heute: termine.filter((t) => (t.gruppe === "heute" || (t.gruppe === "jetzt" && !istWartend(t, jetzt)))
        && berlinTagIso(new Date(t.beginn)) === berlinTagIso(jetzt)).length,
      morgen: n("morgen"), woche: n("woche"), spaeter: n("spaeter"), erledigt: n("erledigt"),
      offen: offene.length,
      mara: termine.filter((t) => !!t.mara).length,
      maraOffen: offene.filter((t) => !!t.mara).length,
      beiAbwesenden: offene.filter((t) => t.beiAbwesendem).length,
      geldOffenCents: Array.from(geldJe.values()).reduce((s, c) => s + c, 0),
    },
    termine,
    teamRueckrufe,
    uebergaben,
  };
}
