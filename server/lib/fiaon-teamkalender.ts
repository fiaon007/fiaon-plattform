// ═══════════════════════════════════════════════════════════════════════════
// DER TEAMKALENDER — LESEN UND STILL ÜBERNEHMEN (E-516, 16.11.2026)
//
// Florentine (16.11.): ein Kalender für das ganze Team — wer hat wann welchen
// Termin, wer ist gerade frei, Termine übernehmen, keine Doppelbuchungen.
// Justin (16.11.): Alle aktiven Mitarbeiter sehen alles mit Kundennamen;
// „Übernehmen" geht still.
//
//   GET  /agent/calendar/team?from&to     teamKalenderLesen
//   POST /agent/termine/:id/uebernehmen   terminUebernehmen
//   (Routen: server/routes/fiaon-kalender.ts, Regeln: shared/fiaon-teamkalender.ts)
//
// ── WER IM TEAMKALENDER STEHT ───────────────────────────────────────────────
// Ich selbst, die Leitung (vertriebsleiter/admin) und jeder, der im Fenster
// einen Termin hat — aktiv, nicht gesperrt, keine Testkonten, nicht das
// Forderungsmanagement. Alte Konten ohne Termine stehen so nicht als leere
// Spalten herum.
//
// ── WAS NICHT IM TEAMKALENDER STEHT (Datensparsamkeit) ──────────────────────
// Telefonnummer, Notizen, Beträge, Grund einer geblockten Zeit (nur bei den
// eigenen). Angerufen wird aus der Akte bzw. dem Firmen-Cockpit (E-216).
//
// ── STILL ÜBERNEHMEN — WAS PASSIERT, WAS NICHT ──────────────────────────────
// Es wandert NUR der Termin (agent_id), mit vertretung = TRUE — das heißt im
// Haus seit E-120: „der Kunde bleibt beim Betreuer". Bewusst NICHT
// terminUebergeben (fiaon-termin.ts): Das zieht den Kunden mit (Mandat,
// Provision), schickt dem Kunden eine Bestätigung und dem Übernehmer eine
// Aufgabe. Hier: keine Mail an den Kunden, kein Kundenwechsel, keine Aufgabe
// (wer übernimmt, ist selbst der Klickende). Der Verlauf hält fest, wer von
// wem übernommen hat. Uhrzeit, Telefon-Wortlaut und Storno-Link bleiben.
// Erinnerungen, die danach noch laufen, nennen den neuen Gesprächspartner —
// das ist richtig, denn er führt das Gespräch.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { echteMitarbeiterSql } from "./fiaon-mitarbeiter-sicht";
import { sperrzeitTabelleDa } from "./fiaon-sperrzeit";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import {
  kundeUndFirma, personenOrdnen, TEAM_STANDARD_DAUER,
  type TeamKalenderAntwort, type TeamPerson, type TeamTermin, type TeamSperre, type TeamDienst,
} from "../../shared/fiaon-teamkalender";

type Lauf = typeof sqlPool;

/** Höchstens so viele Tage auf einmal (Woche + Luft) — der Teamkalender liest nie Monate. */
export const TEAM_FENSTER_TAGE_MAX = 21;

async function tabelleDa(name: string, lauf: Lauf): Promise<boolean> {
  try {
    const [r] = (await lauf`SELECT to_regclass(${`public.${name}`}) IS NOT NULL AS da`) as any[];
    return !!r?.da;
  } catch { return false; }
}

/** Das Fenster aus der Anfrage — ungültig oder zu groß → heute −1 bis +8 Tage. */
export function teamFenster(fromRoh: unknown, toRoh: unknown, jetzt: Date = new Date()): { von: Date; bis: Date } {
  const von = new Date(String(fromRoh ?? ""));
  const bis = new Date(String(toRoh ?? ""));
  const ok = !Number.isNaN(von.getTime()) && !Number.isNaN(bis.getTime()) && bis > von
    && bis.getTime() - von.getTime() <= TEAM_FENSTER_TAGE_MAX * 864e5;
  if (ok) return { von, bis };
  return { von: new Date(jetzt.getTime() - 864e5), bis: new Date(jetzt.getTime() + 8 * 864e5) };
}

export async function teamKalenderLesen(meId: number, von: Date, bis: Date, lauf: Lauf = sqlPool): Promise<TeamKalenderAntwort> {
  const praesenzDa = await tabelleDa("fiaon_praesenz", lauf);
  const personenRoh = (await lauf.unsafe(`
    SELECT a.id, a.name, COALESCE(NULLIF(TRIM(a.first_name), ''), split_part(COALESCE(a.name, ''), ' ', 1)) AS vorname,
           COALESCE(a.rolle, 'agent') AS rolle,
           ${praesenzDa
             ? `EXISTS (SELECT 1 FROM fiaon_praesenz pr WHERE pr.agent_id = a.id AND pr.zuletzt > NOW() - INTERVAL '20 minutes' AND pr.status IN ('da', 'telefon'))`
             : "FALSE"} AS anwesend
      FROM fiaon_agents a
     WHERE a.active AND a.zugang_gesperrt_am IS NULL AND ${echteMitarbeiterSql("a")}
       AND COALESCE(a.rolle, 'agent') <> 'inkasso'
       AND (a.id = $1
            OR COALESCE(a.rolle, 'agent') IN ('vertriebsleiter', 'admin')
            OR EXISTS (SELECT 1 FROM fiaon_termine t
                        WHERE t.agent_id = a.id AND t.beginn BETWEEN $2 AND $3
                          AND (t.status = 'gebucht' OR (t.status = 'verpasst' AND t.erledigt_am IS NULL))))
  `, [meId, von, bis])) as any[];
  const personen: TeamPerson[] = personenOrdnen(personenRoh.map((r) => ({
    id: Number(r.id), name: String(r.name ?? ""), vorname: String(r.vorname ?? r.name ?? ""),
    rolle: String(r.rolle ?? "agent"), anwesend: r.anwesend === true, ich: Number(r.id) === meId,
  })));
  const ids = personen.map((p) => p.id);
  if (!ids.length) return { personen, termine: [], sperren: [], dienst: [] };

  // ── Die Termine: dieselben Zustände wie der eigene Kalender (GET /agent/calendar) ──
  const firmenDa = await tabelleDa("fiaon_firmen_leads", lauf);
  const zeilen = (await lauf.unsafe(`
    SELECT t.id, t.agent_id, t.beginn, t.dauer_min, t.status, t.quelle, (to_jsonb(t) ->> 'herkunft') AS herkunft,
           t.person_id, COALESCE((to_jsonb(t) ->> 'vertretung')::boolean, FALSE) AS vertretung, t.abgesagt_am,
           p.first_name, p.last_name, p.contact_name, p.company_name,
           ${firmenDa
             ? `(SELECT f.id FROM fiaon_firmen_leads f WHERE f.person_id = t.person_id ORDER BY f.updated_at DESC LIMIT 1) AS firma_id,
                (SELECT f.firma FROM fiaon_firmen_leads f WHERE f.person_id = t.person_id ORDER BY f.updated_at DESC LIMIT 1) AS firmen_karte`
             : "NULL::int AS firma_id, NULL::text AS firmen_karte"}
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.agent_id = ANY($1::int[])
       AND t.beginn BETWEEN $2 AND $3
       AND (t.status = 'gebucht'
            OR (t.status = 'verpasst' AND t.erledigt_am IS NULL)
            OR (t.status = 'abgesagt' AND t.abgesagt_am > NOW() - INTERVAL '7 days'))
       AND p.merged_into_person_id IS NULL
     ORDER BY t.beginn ASC
     LIMIT 600
  `, [ids, von, bis])) as any[];

  // Der echte Firmenname aus der Lead-Mappe („Firma: …" — dieselbe Quelle wie der Kalendereintrag im Handy).
  let mappe = new Map<number, string[]>();
  try {
    const { leadKalenderZusatz } = await import("./fiaon-lead-weg");
    mappe = await leadKalenderZusatz(zeilen.map((z) => ({ id: Number(z.id), quelle: String(z.quelle ?? ""), herkunft: z.herkunft ?? null, person_id: Number(z.person_id) })), lauf);
  } catch { /* ohne Mappe */ }

  const termine: TeamTermin[] = zeilen.map((z) => {
    const mappeFirma = (mappe.get(Number(z.id)) ?? []).find((x) => x.startsWith("Firma: "))?.slice(7) ?? null;
    const { kunde, firma } = kundeUndFirma({ ...z, mappe_firma: mappeFirma });
    const art = terminArtAusQuelle(z.quelle);
    return {
      id: Number(z.id), agentId: Number(z.agent_id), beginn: new Date(z.beginn).toISOString(),
      dauerMin: Number(z.dauer_min) || TEAM_STANDARD_DAUER, status: String(z.status), quelle: String(z.quelle ?? ""),
      personId: Number(z.person_id), kunde, firma, firmaId: z.firma_id != null ? Number(z.firma_id) : null,
      abgesagt: z.status === "abgesagt", vertretung: z.vertretung === true,
      selbstGebucht: String(z.quelle ?? "") !== "agent_manuell",
      artText: art.text, artTon: art.ton,
    };
  });

  // ── Geblockte Zeiten (E-498): bei Kollegen nur „belegt", der Grund nur bei mir ──
  let sperren: TeamSperre[] = [];
  if (await sperrzeitTabelleDa(lauf).catch(() => false)) {
    const s = (await lauf`
      SELECT agent_id, beginn, ende, grund FROM fiaon_sperrzeiten
       WHERE agent_id = ANY(${ids}::int[]) AND geloescht_am IS NULL AND ende > ${von} AND beginn < ${bis}
       ORDER BY beginn LIMIT 400
    `.catch(() => [])) as any[];
    sperren = s.map((r) => ({
      agentId: Number(r.agent_id), beginn: new Date(r.beginn).toISOString(), ende: new Date(r.ende).toISOString(),
      grund: Number(r.agent_id) === meId && r.grund ? String(r.grund).slice(0, 120) : null,
    }));
  }

  // ── Arbeitszeiten: dieselbe Tabelle wie die Buchung (fiaon_agent_verfuegbarkeit, E-120) ──
  let dienst: TeamDienst[] = [];
  if (await tabelleDa("fiaon_agent_verfuegbarkeit", lauf)) {
    const d = (await lauf`
      SELECT agent_id, wochentag, to_char(von, 'HH24:MI') AS von, to_char(bis, 'HH24:MI') AS bis
        FROM fiaon_agent_verfuegbarkeit
       WHERE agent_id = ANY(${ids}::int[]) AND COALESCE(aktiv, TRUE)
       ORDER BY agent_id, wochentag, von
    `.catch(() => [])) as any[];
    dienst = d.map((r) => ({ agentId: Number(r.agent_id), wochentag: Number(r.wochentag), von: String(r.von), bis: String(r.bis) }));
  }

  return { personen, termine, sperren, dienst };
}

// ═══════════════════════════════════════════════════════════════════════════
// STILL ÜBERNEHMEN
// ═══════════════════════════════════════════════════════════════════════════
export interface UebernehmenErgebnis { status: number; body: { ok: boolean; error?: string; code?: string; hinweis?: string; vorher?: string } }

const berlinText = (d: Date | string): string => new Date(d).toLocaleString("de-DE", {
  timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

export async function terminUebernehmen(terminId: number, wer: { id: number; name: string }, lauf: Lauf = sqlPool): Promise<UebernehmenErgebnis> {
  if (!Number.isInteger(terminId) || terminId <= 0) return { status: 400, body: { ok: false, error: "Ungültiger Termin." } };
  const [t] = (await lauf`
    SELECT t.id, t.agent_id, t.person_id, t.beginn, t.dauer_min, t.status, t.quelle, t.abgesagt_am,
           a.name AS bei_name, COALESCE(NULLIF(TRIM(a.first_name), ''), a.name) AS bei_vorname
      FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.id = ${terminId}
  `) as any[];
  if (!t) return { status: 404, body: { ok: false, error: "Termin nicht gefunden." } };
  if (t.abgesagt_am || t.status !== "gebucht") {
    return { status: 409, body: { ok: false, code: "NICHT_OFFEN", error: "Dieser Termin ist nicht mehr offen (abgesagt, verpasst oder erledigt)." } };
  }
  if (Number(t.agent_id) === wer.id) return { status: 409, body: { ok: false, code: "SCHON_MEINS", error: "Der Termin liegt schon bei dir." } };
  const dauer = Number(t.dauer_min) || TEAM_STANDARD_DAUER;
  const beginn = new Date(t.beginn);
  if (beginn.getTime() + dauer * 60_000 < Date.now()) {
    return { status: 409, body: { ok: false, code: "VORBEI", error: "Dieser Termin ist schon vorbei — übernehmen geht nur vor oder während des Gesprächs." } };
  }
  const [ich] = (await lauf.unsafe(`
    SELECT id FROM fiaon_agents a
     WHERE a.id = $1 AND a.active AND a.zugang_gesperrt_am IS NULL AND ${echteMitarbeiterSql("a")}
       AND COALESCE(a.rolle, 'agent') <> 'inkasso'
  `, [wer.id])) as any[];
  if (!ich) return { status: 403, body: { ok: false, error: "Mit diesem Zugang können keine Termine übernommen werden." } };
  // Keine Doppelbuchung: Hat der Übernehmer zur selben Zeit schon einen Termin?
  const [stoss] = (await lauf`
    SELECT x.id, x.beginn FROM fiaon_termine x
     WHERE x.agent_id = ${wer.id} AND x.id <> ${terminId} AND x.abgesagt_am IS NULL AND x.status = 'gebucht'
       AND x.beginn < ${new Date(beginn.getTime() + dauer * 60_000)}
       AND x.beginn + make_interval(mins => COALESCE(x.dauer_min, ${TEAM_STANDARD_DAUER})) > ${beginn}
     LIMIT 1
  `) as any[];
  if (stoss) {
    return { status: 409, body: { ok: false, code: "BELEGT", error: `Du hast um ${berlinText(stoss.beginn)} Uhr selbst schon einen Termin — so entstünde eine Doppelbuchung.` } };
  }
  const grund = `Im Teamkalender übernommen von ${wer.name} (vorher ${String(t.bei_name ?? "—")}) — still, ohne Mail an den Kunden.`;
  const neu = (await lauf`
    UPDATE fiaon_termine
       SET agent_id = ${wer.id}, vertretung = TRUE, uebergeben_am = NOW(),
           uebergeben_von = ${Number(t.agent_id)}, uebergeben_grund = ${grund.slice(0, 500)}, updated_at = NOW()
     WHERE id = ${terminId} AND agent_id = ${Number(t.agent_id)} AND abgesagt_am IS NULL AND status = 'gebucht'
     RETURNING id
  `) as any[];
  if (!neu.length) return { status: 409, body: { ok: false, code: "GERADE_GEAENDERT", error: "Der Termin wurde gerade geändert — bitte den Kalender neu laden." } };

  // ── Der Verlauf: Akte (Privat) und Firmen-Cockpit (Global) — beides wirft nie ──
  const satz = `Termin ${berlinText(beginn)} Uhr (${terminArtAusQuelle(t.quelle).text}) übernommen von ${wer.name}, vorher ${String(t.bei_name ?? "—")}. Der Kunde bleibt beim Betreuer, keine Mail an den Kunden.`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
    SELECT a.ref, ${Number(t.person_id)}, ${wer.id}, ${wer.name}, 'system', ${satz}, NOW()
      FROM fiaon_applications a
     WHERE a.person_id = ${Number(t.person_id)} AND a.merged_into IS NULL
     ORDER BY a.created_at DESC LIMIT 1
  `.catch(() => {});
  if (await tabelleDa("fiaon_firmen_log", lauf)) {
    await lauf`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      SELECT f.id, ${wer.id}, ${wer.name}, 'notiz', NULL, ${satz}
        FROM fiaon_firmen_leads f WHERE f.person_id = ${Number(t.person_id)}
       ORDER BY f.updated_at DESC LIMIT 1
    `.catch(() => {});
  }
  console.log(`[TEAMKALENDER] Termin #${terminId} still übernommen: #${t.agent_id} → #${wer.id}`);
  return {
    status: 200,
    body: {
      ok: true, vorher: String(t.bei_vorname ?? t.bei_name ?? ""),
      hinweis: `Übernommen — der Termin um ${berlinText(beginn)} Uhr liegt jetzt bei dir. Der Kunde bekommt keine Mail, die Uhrzeit bleibt.`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FÜR KOLLEGEN EINTRAGEN (E-517, 16.11.2026)
//
//   GET  /agent/termine/kollegen/kunden?agentId&q   kundenFuerKollegen
//   GET  /agent/termine/kollegen/frei?agentId&art   kollegenFreieZeiten
//   POST /agent/termine/kollegen                    terminFuerKollegen (+ Bestätigung in der Route)
//
// ── WER WEN EINTRAGEN DARF ──────────────────────────────────────────────────
// Jeder aktive Mitarbeiter (Justin: der Teamkalender gehört allen) — für einen
// Kunden, der ihm selbst oder der Kollegin gehört, der noch keinen Betreuer
// hat oder der ein Global-Kontakt aus dem Firmen-Cockpit ist. Die Leitung
// (vertriebsleiter/admin) darf jeden Kunden eintragen. Fremde Kunden eines
// DRITTEN Kollegen nicht — das wäre eine Zuständigkeitsübernahme durch die
// Hintertür (derselbe Gedanke wie POST /agent/termine).
//
// ── WAS PASSIERT ────────────────────────────────────────────────────────────
// Gebucht wird über terminBuchen (die EINE Schreibstelle) mit der Kollegin als
// agent_id — dieselben Wände wie überall (Arbeitszeit, Raster, Überschneidung,
// geblockte Zeit, Doppelbuchungs-Index). buchungAnwenden mit zuordnen:false:
// Der Kunde bleibt, wo er ist; die Kollegin bekommt die übliche Buchungsmeldung.
// Die Kundenbestätigung schickt die Route (Privat: termin_bestaetigung,
// Global: global_termin im Global-Rahmen mit dem Namen der Kollegin).
// ═══════════════════════════════════════════════════════════════════════════
export interface Kollege { id: number; name: string; vorname: string }

/** Die Kollegin, bei der eingetragen wird — aktiv, nicht gesperrt, kein Testkonto, nicht das Forderungsmanagement. */
export async function kollegeLesen(agentId: number, lauf: Lauf = sqlPool): Promise<Kollege | null> {
  if (!Number.isInteger(agentId) || agentId <= 0) return null;
  const [k] = (await lauf.unsafe(`
    SELECT a.id, a.name, COALESCE(NULLIF(TRIM(a.first_name), ''), split_part(COALESCE(a.name, ''), ' ', 1)) AS vorname
      FROM fiaon_agents a
     WHERE a.id = $1 AND a.active AND a.zugang_gesperrt_am IS NULL AND ${echteMitarbeiterSql("a")}
       AND COALESCE(a.rolle, 'agent') <> 'inkasso'
  `, [agentId])) as any[];
  return k ? { id: Number(k.id), name: String(k.name ?? ""), vorname: String(k.vorname ?? "") } : null;
}

const istLeitung = (rolle: string | null | undefined) => ["vertriebsleiter", "admin"].includes(String(rolle ?? ""));

/** Die Bedingung „darf diesen Kunden für die Kollegin eintragen" als SQL — p = fiaon_persons, $1 = ich, $2 = Kollegin. */
function zugriffSql(leitung: boolean, firmenDa: boolean): string {
  // $1/$2 immer mit Typ — bei der Leitung steht die Bedingung nur der Form halber da (sonst kennt Postgres den Typ nicht).
  if (leitung) return "(TRUE OR p.assigned_agent_id IN ($1::int, $2::int))";
  return `(p.assigned_agent_id IS NULL OR p.assigned_agent_id IN ($1::int, $2::int)${firmenDa ? " OR EXISTS (SELECT 1 FROM fiaon_firmen_leads f WHERE f.person_id = p.id)" : ""})`;
}

export interface KollegenKunde { personId: number; name: string; firma: string | null; global: boolean; firmaId: number | null; betreuer: string | null }

export async function kundenFuerKollegen(wer: { id: number; rolle: string | null }, agentId: number, qRoh: unknown, lauf: Lauf = sqlPool): Promise<KollegenKunde[]> {
  const q = String(qRoh ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return [];
  const text = q.replace(/[\\%_]/g, (z) => `\\${z}`);
  const ziffern = q.replace(/[^0-9]/g, "").replace(/^0+/, "");
  const firmenDa = await tabelleDa("fiaon_firmen_leads", lauf);
  const zeilen = (await lauf.unsafe(`
    SELECT p.id, p.first_name, p.last_name, p.contact_name, p.company_name,
           ag.first_name AS betreuer_vorname, ag.name AS betreuer_name,
           ${firmenDa ? `(SELECT f.id FROM fiaon_firmen_leads f WHERE f.person_id = p.id ORDER BY f.updated_at DESC LIMIT 1)` : "NULL::int"} AS firma_id,
           ${firmenDa ? `(SELECT f.firma FROM fiaon_firmen_leads f WHERE f.person_id = p.id ORDER BY f.updated_at DESC LIMIT 1)` : "NULL::text"} AS firmen_karte
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE p.merged_into_person_id IS NULL
       AND ${zugriffSql(istLeitung(wer.rolle), firmenDa)}
       AND (TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE '%' || $3 || '%'
            OR COALESCE(p.company_name, '') ILIKE '%' || $3 || '%'
            OR COALESCE(p.contact_name, '') ILIKE '%' || $3 || '%'
            OR COALESCE(p.primary_email, '') ILIKE '%' || $3 || '%'
            OR ($4 <> '' AND length($4) >= 3 AND regexp_replace(COALESCE(p.primary_phone, ''), '[^0-9]', '', 'g') LIKE '%' || $4 || '%'))
     ORDER BY p.id DESC
     LIMIT 12
  `, [wer.id, agentId, text, ziffern])) as any[];
  return zeilen.map((z) => {
    const { kunde, firma } = kundeUndFirma({ ...z, firmen_karte: z.firmen_karte });
    return {
      personId: Number(z.id), name: kunde, firma, global: z.firma_id != null, firmaId: z.firma_id != null ? Number(z.firma_id) : null,
      betreuer: z.betreuer_vorname || z.betreuer_name ? String(z.betreuer_vorname || z.betreuer_name) : null,
    };
  });
}

/** Freie Zeiten der Kollegin für die nächsten 7 Tage — DIESELBE Rechnung wie jede Buchung (rohSlots), Vorlauf wie die Annahme. */
export async function kollegenFreieZeiten(kollege: Kollege, quelle: string, lauf: Lauf = sqlPool): Promise<{ dauerMin: number; tage: { tag: string; zeiten: { beginn: string; uhrzeit: string }[] }[] }> {
  const { rohSlots, dauerFuer, VORLAUF_STUNDEN } = await import("./fiaon-termine");
  const dauerMin = dauerFuer(quelle);
  // Derselbe Vorlauf wie die Annahme (terminBuchen): Nur der selbst notierte Rückruf/Vertrieb (agent_manuell) darf
  // „gleich in 15 Minuten“ — alle anderen Arten frühestens in VORLAUF_STUNDEN (sonst böte der Dialog Zeiten an, die abgelehnt werden).
  const vorlaufMs = quelle === "agent_manuell" ? 15 * 60_000 : VORLAUF_STUNDEN * 3600_000;
  const alle = await rohSlots([{ id: kollege.id, vorname: kollege.vorname }], dauerMin, lauf, vorlaufMs);
  const grenze = Date.now() + 7 * 864e5;
  const jeTag = new Map<string, { beginn: string; uhrzeit: string }[]>();
  for (const s of alle) {
    if (new Date(s.beginn).getTime() > grenze) continue;
    if (!jeTag.has(s.datum)) jeTag.set(s.datum, []);
    const liste = jeTag.get(s.datum)!;
    if (liste.length < 40) liste.push({ beginn: s.beginn, uhrzeit: s.uhrzeit });
  }
  return { dauerMin, tage: Array.from(jeTag.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([tag, zeiten]) => ({ tag, zeiten })) };
}

export interface KollegenEintragErgebnis {
  status: number;
  body: { ok: boolean; error?: string; feld?: string; code?: string };
  buchung?: any;
  global?: boolean;
  kollege?: Kollege;
  kunde?: string;
}

export async function terminFuerKollegen(ein: {
  wer: { id: number; name: string; rolle: string | null };
  agentId: number; personId: number; beginn: unknown; art: unknown; notiz: unknown;
}, lauf: Lauf = sqlPool): Promise<KollegenEintragErgebnis> {
  const { kollegenEintragPruefen } = await import("../../shared/fiaon-teamkalender");
  const kollege = await kollegeLesen(Number(ein.agentId), lauf);
  if (!kollege) return { status: 404, body: { ok: false, error: "Diese Kollegin bzw. diesen Kollegen gibt es nicht (mehr) — oder der Zugang ist gesperrt." } };
  const firmenDa = await tabelleDa("fiaon_firmen_leads", lauf);
  const [p] = (await lauf.unsafe(`
    SELECT p.id, p.first_name, p.last_name, p.contact_name, p.company_name, p.assigned_agent_id,
           ${firmenDa ? `(SELECT f.id FROM fiaon_firmen_leads f WHERE f.person_id = p.id ORDER BY f.updated_at DESC LIMIT 1)` : "NULL::int"} AS firma_id,
           ${zugriffSql(istLeitung(ein.wer.rolle), firmenDa)} AS darf
      FROM fiaon_persons p
     WHERE p.id = $3 AND p.merged_into_person_id IS NULL
  `, [ein.wer.id, kollege.id, Number(ein.personId)])) as any[];
  if (!p) return { status: 404, body: { ok: false, feld: "kunde", error: "Kunde nicht gefunden." } };
  if (p.darf !== true) return { status: 403, body: { ok: false, feld: "kunde", error: "Dieser Kunde wird von einem anderen Kollegen betreut — eintragen darf ihn nur sein Betreuer oder die Leitung." } };
  const globalKontakt = p.firma_id != null;
  const pruef = kollegenEintragPruefen({ art: ein.art, notiz: ein.notiz, beginn: ein.beginn, globalKontakt });
  if (!pruef.ok) return { status: 400, body: { ok: false, error: pruef.error, feld: pruef.feld } };

  const { terminBuchen, buchungAnwenden, versuchProtokollieren, TerminFehler } = await import("./fiaon-termine");
  let buchung;
  try {
    buchung = await terminBuchen({
      personId: Number(p.id), agentId: kollege.id, beginn: String(ein.beginn), quelle: pruef.quelle,
      herkunft: pruef.art === "global" ? "agent_global" : "agent", artVomMitarbeiter: true,
    }, lauf);
  } catch (e) {
    await versuchProtokollieren({ ergebnis: "abgelehnt", personId: Number(p.id), slotBeginn: String(ein.beginn), agentId: kollege.id, grund: e instanceof TerminFehler ? e.code : "serverfehler", quelle: pruef.quelle, akteur: "agent" }).catch(() => {});
    if (e instanceof TerminFehler) return { status: 409, body: { ok: false, feld: "zeit", code: e.code, error: e.message } };
    throw e;
  }
  const notizText = `Eingetragen von ${ein.wer.name} für ${kollege.name}${pruef.notiz ? ` — ${pruef.notiz}` : ""}`;
  await lauf`UPDATE fiaon_termine SET notiz = TRIM(BOTH ' ' FROM COALESCE(notiz, '') || CASE WHEN COALESCE(notiz, '') = '' THEN '' ELSE E'\n' END || ${notizText.slice(0, 600)}) WHERE id = ${buchung.id}`.catch(() => {});
  // Der Kunde bleibt, wo er ist (kein Betreuerwechsel); die Kollegin bekommt die übliche Buchungsmeldung.
  await buchungAnwenden(buchung, lauf, { zuordnen: false });
  await versuchProtokollieren({ ergebnis: "gebucht", personId: Number(p.id), slotBeginn: String(ein.beginn), agentId: kollege.id, quelle: pruef.quelle, akteur: "agent" }).catch(() => {});

  // ── Verlauf: Akte (Privat) und Firmen-Cockpit (Global) — beides wirft nie ──
  const satz = `Termin ${berlinText(buchung.beginn)} Uhr (${terminArtAusQuelle(pruef.quelle).text}) bei ${kollege.name} eingetragen von ${ein.wer.name}.`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
    SELECT a.ref, ${Number(p.id)}, ${ein.wer.id}, ${ein.wer.name}, 'system', ${satz}, NOW()
      FROM fiaon_applications a WHERE a.person_id = ${Number(p.id)} AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1
  `.catch(() => {});
  if (globalKontakt && await tabelleDa("fiaon_firmen_log", lauf)) {
    await lauf`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${Number(p.firma_id)}, ${ein.wer.id}, ${ein.wer.name}, 'global', 'termin_eingetragen', ${satz})
    `.catch(() => {});
    await lauf`UPDATE fiaon_firmen_leads SET status = 'termin', letzter_kontakt = NOW(), updated_at = NOW() WHERE id = ${Number(p.firma_id)} AND status NOT IN ('antrag')`.catch(() => {});
  }
  const { kunde } = kundeUndFirma(p);
  console.log(`[TEAMKALENDER] Termin #${buchung.id} für Kollegen eingetragen: #${ein.wer.id} → bei #${kollege.id} (${pruef.quelle})`);
  return { status: 200, body: { ok: true }, buchung, global: globalKontakt, kollege, kunde };
}
