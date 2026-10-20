// ═══════════════════════════════════════════════════════════════════════════
// „MARA HEUTE“ — WAS MARA HEUTE GETAN HAT, IM LAGEZIMMER (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Karte ‚Mara heute‘. Sie zeigt nur Auffälliges: was erledigt ist, wie viel Geld reinkam,
// welche Entscheidungen offen sind und wo jemand im Team hängt. Kein langer Bericht.“ Keine neue Seite — eine
// Kachel im Lagezimmer (client/src/components/admin/ChefMaraHeute.tsx), GET /chef/mara-heute.
//
// ── DIE EINE LISTE DER HANDLUNGEN (handlungenSql) ───────────────────────────
// Dieselbe Abfrage zählt „heute“, füllt die gelbe Liste und zieht die Wochen-Stichprobe (fiaon-mara-stichprobe.ts):
//   Mails beantwortet (fiaon_postmeister auto_beantwortet) · Kartenlink, Werbesperre, Kündigung (Handlungen der
//   Postfach-Zeile) · WhatsApp-Antworten und WhatsApp-Nachfassen (fiaon_whatsapp, von „Mara …“) · Mara-Aktion
//   (fiaon_mara_aktion) · Termine, Kartenlink, Ratenpause, Zahlungszusage, Kündigung, Angaben, Übergaben
//   (fiaon_mara_protokoll) · Angaben per Mail (fiaon_mara_angaben, E-401) · Zahlung gefunden (fiaon_mara_zahlung_funde)
//   · Nachfass-Mail (fiaon_nicht_erreicht_nachfass) · alte Entwürfe abgelegt (24-Stunden-Regel) · Karten für Justin.
//   E-406 Welle 2 (Integration): dazu Raten-Mail (B1), beantwortete Anliegen (C1), Zusammenfassung nach dem Anruf (C2)
//   und KYC-Erinnerung (B2) — je nur, was wirklich rausging.
// Tabellen, die es noch nicht gibt (sie entstehen erst beim ersten Gebrauch), fallen einfach heraus.
//
// ── GELD, KARTEN, HÄNGT, KI ─────────────────────────────────────────────────
// Geld nur aus der EINEN Quelle (UMSATZ_QUELLE_SQL über Maras Bilanz, fiaon-mara-bilanz.ts, 60 s gespeichert).
// Karten: tagesLastLesen (E-397). Hängt: vergangene Termine ohne Ergebnis und überfällige Aufträge je Mitarbeiter.
// KI-Kosten heute: Maras Dienste und alle zusammen (fiaon_ki_nutzung).
//
// ── GELB — 24 STUNDEN RÜCKGÄNGIG ────────────────────────────────────────────
// Steht ein Werkzeug auf Gelb (fiaon-mara-ampel.ts), stehen seine Handlungen der letzten 24 Stunden einzeln hier —
// mit einem Klick zurück, wo das sicher geht: Termin absagen (Kunde bekommt die Absage mit Link), Anschrift/Telefon
// zurück auf alt (derselbe Speicherweg wie die Akte), Mail-Entwurf „Nicht senden“ bzw. „Jetzt senden“. Wo es nicht
// geht (Mail ist raus, Pause zugesagt), steht es ehrlich daneben. Jeder Klick einmal (fiaon_mara_rueckgaengig).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  HANDLUNG_ARTEN, MARA_AMPEL, ampelWerkzeug, heuteErledigt, heuteZeilen, rueckgaengigOffen, editZeileLesen, AMPEL_GELB_KOPF, AUFRAEUM_ART_ZAHLUNG,
  gelbEntwurfSatz, type AmpelKey, type AmpelStand, type AmpelStufe, type HandlungArt, type HeuteZeile,
} from "@shared/fiaon-mara-ampel";
import { ABLAGE_KOPF, fristFaellig } from "@shared/fiaon-entwurf-frist";

type Lauf = typeof sqlPool;

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER HANDLUNGEN
// ═══════════════════════════════════════════════════════════════════════════
export const HANDLUNG_TABELLEN = [
  "fiaon_postmeister", "fiaon_whatsapp", "fiaon_mara_protokoll", "fiaon_mara_aktion", "fiaon_mara_angaben",
  "fiaon_mara_zahlung_funde", "fiaon_nicht_erreicht_nachfass", "fiaon_mara_entscheidungen", "fiaon_termine",
  // E-406 Welle 2 (Integration, 20.10.2026): B1 Raten-Mail, C2 Nacharbeit, B2 KYC — entstehen erst beim ersten Gebrauch.
  "fiaon_mara_rate_erinnerung", "fiaon_mara_nacharbeit", "fiaon_mara_kyc",
] as const;
export type TabellenDa = Record<(typeof HANDLUNG_TABELLEN)[number], boolean> & {
  /** C1: fiaon_tickets mit Maras Spalten (anliegenSchema) — die Tabelle selbst gibt es länger. */
  fiaon_tickets_mara: boolean;
};

/** Welche Tabellen es gibt (to_regclass sperrt nichts). */
export async function tabellenDa(lauf: Lauf = sqlPool): Promise<TabellenDa> {
  const [z] = (await lauf.unsafe(`SELECT ${HANDLUNG_TABELLEN.map((n) => `to_regclass('public.${n}') IS NOT NULL AS ${n}`).join(", ")},
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fiaon_tickets'
             AND column_name = 'beantwortet_durch') AS fiaon_tickets_mara`)) as any[];
  const aus = {} as TabellenDa;
  for (const n of HANDLUNG_TABELLEN) aus[n] = z?.[n] === true;
  aus.fiaon_tickets_mara = z?.fiaon_tickets_mara === true;
  return aus;
}

/** Die Mara-Herkünfte eines Termins, die Mara selbst eingetragen hat (nicht: der Kunde über Maras Link). */
export const MARA_TERMIN_HERKUENFTE = ["mara_whatsapp", "mara_mail", "mara_mail_genannt", "mara_whatsapp_genannt"] as const;

/** Was im Protokoll eine Handlung ist (Art → Werkzeug). */
const PROTOKOLL_ARTEN = ["termin_gebucht", "termin_verschoben", "termin_eingetragen", "karte_link", "ratenpause", "zahlungszusage", "kuendigung", "angaben", "uebergabe"];

/**
 * Die Handlungen im Zeitraum [$1, $2). Spalten: werkzeug, art, quelle, quelle_id, person_id, am, kanal, titel, kunde,
 * mara, termin_id. `mitText` holt Kundentext und Maras Text (für Stichprobe und Liste) — sonst NULL (Zählen).
 */
export function handlungenSql(da: TabellenDa, o: { mitText: boolean }): string {
  const T = (spalte: string, n: number) => (o.mitText ? `LEFT(COALESCE(${spalte}, ''), ${n})` : "NULL::text");
  const kundeWa = (nummer: string, bis: string) => (o.mitText
    ? `LEFT(COALESCE((SELECT r.text FROM fiaon_whatsapp r WHERE r.nummer = ${nummer} AND r.richtung = 'rein'
         AND COALESCE(r.empfangen_am, r.created_at) <= ${bis} ORDER BY COALESCE(r.empfangen_am, r.created_at) DESC LIMIT 1), ''), 1500)`
    : "NULL::text");
  const teile: string[] = [];
  if (da.fiaon_postmeister) {
    teile.push(`
      SELECT 'mail_antworten'::text AS werkzeug, 'mail_beantwortet'::text AS art, 'postmeister'::text AS quelle, pm.id::text AS quelle_id,
             pm.person_id::int AS person_id, pm.gesendet_am::timestamptz AS am, 'mail'::text AS kanal, ${T("pm.betreff", 200)} AS titel,
             ${T("pm.text", 1500)} AS kunde, ${T("pm.antwort", 2500)} AS mara, NULL::int AS termin_id
        FROM fiaon_postmeister pm
       WHERE pm.aktion = 'auto_beantwortet' AND pm.gesendet_am >= $1 AND pm.gesendet_am < $2`);
    teile.push(`
      SELECT DISTINCT ON (pm.id, h->>'werkzeug')
             (CASE h->>'werkzeug' WHEN 'karte_senden' THEN 'karte_link' WHEN 'werbesperre_setzen' THEN 'werbesperre' ELSE 'kuendigung' END)::text,
             (CASE h->>'werkzeug' WHEN 'karte_senden' THEN 'karte_link' WHEN 'werbesperre_setzen' THEN 'werbesperre' ELSE 'kuendigung' END)::text,
             'postmeister_handlung'::text, pm.id::text || ':' || (h->>'werkzeug'), pm.person_id::int,
             COALESCE(pm.entwurf_geprueft_am, pm.created_at)::timestamptz, 'mail'::text, ${T("pm.betreff", 200)},
             ${T("pm.text", 1500)}, ${T("h->>'ergebnis'", 1500)}, NULL::int
        FROM fiaon_postmeister pm
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pm.handlungen) = 'array' THEN pm.handlungen
             WHEN jsonb_typeof(pm.handlungen) = 'string' AND LEFT(LTRIM(pm.handlungen #>> '{}'), 1) = '[' THEN (pm.handlungen #>> '{}')::jsonb
             ELSE '[]'::jsonb END) h
       WHERE COALESCE(pm.entwurf_geprueft_am, pm.created_at) >= $1 AND COALESCE(pm.entwurf_geprueft_am, pm.created_at) < $2
         AND h->>'werkzeug' IN ('karte_senden', 'werbesperre_setzen', 'kuendigung_vormerken') AND h->>'ok' = 'true'`);
    teile.push(`
      SELECT 'mail_antworten'::text, 'entwurf_abgelegt'::text, 'postmeister_ablage'::text, pm.id::text, pm.person_id::int,
             pm.updated_at::timestamptz, 'mail'::text, ${T("pm.betreff", 200)}, ${T("pm.text", 1500)}, ${T("pm.begruendung", 600)}, NULL::int
        FROM fiaon_postmeister pm
       WHERE pm.aktion = 'geordnet' AND pm.begruendung LIKE '${ABLAGE_KOPF.replace(/'/g, "''")}%' AND pm.updated_at >= $1 AND pm.updated_at < $2`);
  }
  if (da.fiaon_whatsapp) {
    teile.push(`
      SELECT 'whatsapp_antworten'::text, 'wa_antwort'::text, 'whatsapp'::text, w.id::text, w.person_id::int,
             COALESCE(w.gesendet_am, w.created_at)::timestamptz, 'whatsapp'::text, NULL::text,
             ${kundeWa("w.nummer", "COALESCE(w.gesendet_am, w.created_at)")}, ${T("w.text", 2500)}, NULL::int
        FROM fiaon_whatsapp w
       WHERE w.richtung <> 'rein' AND w.typ = 'text' AND w.vorlage IS NULL AND w.von LIKE 'Mara%' AND w.von NOT LIKE '%(Nachfass)%'
         AND COALESCE(w.status, '') <> 'fehler'
         AND COALESCE(w.gesendet_am, w.created_at) >= $1 AND COALESCE(w.gesendet_am, w.created_at) < $2`);
    teile.push(`
      SELECT 'nachfassen'::text, 'nachfass_wa'::text, 'whatsapp'::text, w.id::text, w.person_id::int,
             COALESCE(w.gesendet_am, w.created_at)::timestamptz, 'whatsapp'::text, NULL::text,
             ${kundeWa("w.nummer", "COALESCE(w.gesendet_am, w.created_at)")}, ${T("w.text", 2500)}, NULL::int
        FROM fiaon_whatsapp w
       WHERE w.richtung <> 'rein' AND w.von LIKE '%(Nachfass)%' AND COALESCE(w.status, '') <> 'fehler'
         AND COALESCE(w.gesendet_am, w.created_at) >= $1 AND COALESCE(w.gesendet_am, w.created_at) < $2`);
  }
  if (da.fiaon_mara_aktion) {
    teile.push(`
      SELECT 'aktion_mails'::text, 'aktion_mail'::text, 'aktion'::text, m.id::text, m.person_id::int, m.gesendet_am::timestamptz,
             'mail'::text, ${T("m.betreff", 200)}, NULL::text, ${T("m.text", 2500)}, NULL::int
        FROM fiaon_mara_aktion m
       WHERE m.status = 'gesendet' AND m.gesendet_am >= $1 AND m.gesendet_am < $2`);
  }
  if (da.fiaon_mara_protokoll) {
    teile.push(`
      SELECT (CASE WHEN p.art IN ('termin_gebucht', 'termin_verschoben', 'termin_eingetragen') THEN 'termin_eintragen'
                   WHEN p.art = 'karte_link' THEN 'karte_link' WHEN p.art = 'ratenpause' THEN 'ratenpause'
                   WHEN p.art = 'zahlungszusage' THEN 'whatsapp_antworten' WHEN p.art = 'kuendigung' THEN 'kuendigung'
                   WHEN p.art = 'angaben' THEN 'angaben_aendern' ELSE NULL END)::text,
             (CASE WHEN p.art IN ('termin_gebucht', 'termin_verschoben', 'termin_eingetragen') THEN 'termin' ELSE p.art END)::text,
             'protokoll'::text, p.id::text, p.person_id::int, p.am::timestamptz, p.kanal::text, NULL::text,
             ${o.mitText ? `(CASE WHEN p.nummer IS NULL THEN NULL ELSE ${kundeWa("p.nummer", "p.am")} END)` : "NULL::text"},
             ${T("p.text", 1500)}, p.termin_id::int
        FROM fiaon_mara_protokoll p
       WHERE p.ok AND p.art IN (${PROTOKOLL_ARTEN.map((a) => `'${a}'`).join(", ")}) AND p.am >= $1 AND p.am < $2`);
  }
  if (da.fiaon_mara_angaben) {
    // Nur die Mail — auf WhatsApp schreibt dieselbe Handlung schon ihre Protokollzeile (art „angaben“).
    teile.push(`
      SELECT 'angaben_aendern'::text, 'angaben'::text, 'angaben'::text, g.id::text, g.person_id::int, g.created_at::timestamptz,
             g.kanal::text, g.feld::text, NULL::text,
             ${o.mitText ? `LEFT(g.feld || ': ' || COALESCE(g.vorher, '—') || ' → ' || COALESCE(g.nachher, '—') || ' (' || g.stand || ')', 600)` : "NULL::text"}, NULL::int
        FROM fiaon_mara_angaben g
       WHERE g.kanal = 'mail' AND g.stand IN ('geaendert', 'link_geschickt', 'bestaetigt') AND g.created_at >= $1 AND g.created_at < $2`);
  }
  if (da.fiaon_mara_zahlung_funde) {
    teile.push(`
      SELECT 'zahlung_suchen'::text, 'zahlung_fund'::text, 'funde'::text, f.id::text, f.person_id::int, f.created_at::timestamptz,
             f.kanal::text, f.stand::text, NULL::text, ${T("f.wege || COALESCE(' · ' || f.quelle, '')", 600)}, NULL::int
        FROM fiaon_mara_zahlung_funde f
       WHERE f.created_at >= $1 AND f.created_at < $2`);
  }
  if (da.fiaon_nicht_erreicht_nachfass) {
    teile.push(`
      SELECT 'nachfassen'::text, 'nachfass_mail'::text, 'nachfass'::text,
             n.person_id::text || ':' || to_char(n.vorgemerkt_am, 'YYYYMMDDHH24MISS'), n.person_id::int, n.bearbeitet_am::timestamptz,
             'mail'::text, 'Nach 2× nicht erreicht'::text, NULL::text, ${T("n.grund", 600)}, NULL::int
        FROM fiaon_nicht_erreicht_nachfass n
       WHERE n.status = 'versandt' AND n.bearbeitet_am >= $1 AND n.bearbeitet_am < $2`);
  }
  // ── E-406 Welle 2 (Integration, 20.10.2026): die Wege aus Welle 1 und 2 — was wirklich rausging ──
  if (da.fiaon_mara_rate_erinnerung) {
    // B1: Maras persönliche Mail zur frisch fälligen Rate (Merker „versandt“).
    teile.push(`
      SELECT NULL::text, 'rate_mail'::text, 'rate_erinnerung'::text, r.rate_id::text, r.person_id::int, r.versandt_am::timestamptz,
             'mail'::text, ${T("'Rate ' || COALESCE(r.rate_nr::text, '?')", 40)}, NULL::text, ${T("r.grund", 300)}, NULL::int
        FROM fiaon_mara_rate_erinnerung r
       WHERE r.status = 'versandt' AND r.versandt_am >= $1 AND r.versandt_am < $2`);
  }
  if (da.fiaon_tickets_mara) {
    // C1: ein Anliegen aus dem Kundenbereich, das Mara selbst beantwortet hat (ohne „mitbeantwortet“ — eine Antwort je Anliegen).
    teile.push(`
      SELECT NULL::text, 'anliegen_antwort'::text, 'anliegen'::text, t.id::text, t.person_id::int, t.beantwortet_am::timestamptz,
             'anliegen'::text, ${T("t.betreff", 200)}, ${T("t.text", 1500)}, ${T("t.antwort", 2500)}, NULL::int
        FROM fiaon_tickets t
       WHERE t.beantwortet_durch = 'mara' AND COALESCE(t.mara_grund, '') NOT LIKE 'mitbeantwortet%'
         AND t.beantwortet_am >= $1 AND t.beantwortet_am < $2`);
  }
  if (da.fiaon_mara_nacharbeit) {
    // C2: Maras Zusammenfassung nach dem Anruf (Merker „versandt“).
    teile.push(`
      SELECT NULL::text, 'nacharbeit_mail'::text, 'nacharbeit'::text, n.id::text, n.person_id::int, n.erledigt_am::timestamptz,
             'mail'::text, ${T("n.art", 40)}, NULL::text, ${T("n.text", 2500)}, NULL::int
        FROM fiaon_mara_nacharbeit n
       WHERE n.status = 'versandt' AND n.erledigt_am >= $1 AND n.erledigt_am < $2`);
  }
  if (da.fiaon_mara_kyc) {
    // B2: Maras Erinnerung an fehlende KYC-Unterlagen (nur sicher gesendete — „unklar“ zählt beim Deckel, nicht hier).
    teile.push(`
      SELECT NULL::text, 'kyc_mail'::text, 'kyc'::text, k.id::text, k.person_id::int, k.am::timestamptz,
             'mail'::text, NULL::text, NULL::text, ${T("array_to_string(k.arten, ', ')", 200)}, NULL::int
        FROM fiaon_mara_kyc k
       WHERE k.ergebnis = 'gesendet' AND k.am >= $1 AND k.am < $2`);
  }
  if (da.fiaon_mara_entscheidungen) {
    teile.push(`
      SELECT NULL::text, 'karte_vorgelegt'::text, 'entscheidung'::text, e.id::text, e.person_id::int, e.created_at::timestamptz,
             NULL::text, ${T("e.titel", 200)}, NULL::text, ${T("e.text", 600)}, NULL::int
        FROM fiaon_mara_entscheidungen e
       WHERE e.created_at >= $1 AND e.created_at < $2`);
  }
  if (!teile.length) {
    return `SELECT NULL::text AS werkzeug, NULL::text AS art, NULL::text AS quelle, NULL::text AS quelle_id, NULL::int AS person_id,
                   NULL::timestamptz AS am, NULL::text AS kanal, NULL::text AS titel, NULL::text AS kunde, NULL::text AS mara, NULL::int AS termin_id
             WHERE FALSE AND $1::timestamptz IS NULL AND $2::timestamptz IS NULL`;
  }
  return teile.join("\n      UNION ALL\n");
}

export interface Handlung {
  werkzeug: AmpelKey | null; art: HandlungArt; quelle: string; quelleId: string; personId: number | null;
  am: string; kanal: string | null; titel: string | null; kunde: string | null; mara: string | null; terminId: number | null;
}

export function handlungAusZeile(z: any): Handlung {
  return {
    werkzeug: (z.werkzeug ?? null) as AmpelKey | null, art: String(z.art) as HandlungArt, quelle: String(z.quelle), quelleId: String(z.quelle_id),
    personId: z.person_id != null ? Number(z.person_id) : null, am: new Date(z.am).toISOString(), kanal: z.kanal ?? null,
    titel: z.titel || null, kunde: z.kunde || null, mara: z.mara || null, terminId: z.termin_id != null ? Number(z.termin_id) : null,
  };
}

/** Die Handlungen im Zeitraum — mit Texten (Stichprobe, Liste). Testpersonen fallen heraus. */
export async function handlungenLesen(von: Date, bis: Date, o: { lauf?: Lauf; mitText?: boolean } = {}): Promise<Handlung[]> {
  const lauf = o.lauf ?? sqlPool;
  const da = await tabellenDa(lauf);
  const zeilen = (await lauf.unsafe(`
    SELECT h.* FROM (${handlungenSql(da, { mitText: o.mitText !== false })}) h
     WHERE h.art IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_persons tp WHERE tp.id = h.person_id AND tp.ist_test_am IS NOT NULL)
     ORDER BY h.am DESC`, [von, bis])) as any[];
  return zeilen.map(handlungAusZeile);
}

/** Wie viele Handlungen je Art im Zeitraum (ohne Texte, ohne Testpersonen). */
export async function handlungenZaehlen(von: Date, bis: Date, lauf: Lauf = sqlPool): Promise<Record<string, number>> {
  const da = await tabellenDa(lauf);
  const zeilen = (await lauf.unsafe(`
    SELECT h.art, COUNT(*)::int AS n FROM (${handlungenSql(da, { mitText: false })}) h
     WHERE h.art IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_persons tp WHERE tp.id = h.person_id AND tp.ist_test_am IS NOT NULL)
     GROUP BY h.art`, [von, bis])) as any[];
  return Object.fromEntries(zeilen.map((z) => [String(z.art), Number(z.n)]));
}

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKGÄNGIG — einmal je Handlung (fiaon_mara_rueckgaengig)
// ═══════════════════════════════════════════════════════════════════════════
export type RueckArt = "termin" | "angaben" | "mail_nicht_senden" | "mail_senden";

let rueckBereit: Promise<void> | null = null;
export function rueckTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!rueckBereit) {
    rueckBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_mara_rueckgaengig (
          id BIGSERIAL PRIMARY KEY,
          art TEXT NOT NULL,
          quelle_id TEXT NOT NULL,
          person_id INTEGER,
          von TEXT,
          ergebnis TEXT,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (art, quelle_id)
        )`;
    })().catch((e) => { rueckBereit = null; throw e; });
  }
  return rueckBereit;
}

export interface GelbEintrag {
  /** Schlüssel für den Knopf: art + id. */
  art: RueckArt | "info";
  id: string;
  werkzeug: AmpelKey;
  am: string;
  personId: number | null;
  name: string | null;
  text: string;
  /** Knöpfe: rückgängig (und bei Mail-Entwürfen „Jetzt senden“). Leer = nicht rückgängig, `ohne` sagt warum. */
  knoepfe: { art: RueckArt; label: string; vorsicht?: boolean }[];
  ohne: string | null;
  /** Schon erledigt (zurückgenommen / gesendet / abgelegt) — mit Ergebnis. */
  erledigt: { am: string; von: string | null; ergebnis: string | null } | null;
}

const NAME_SQL = (p: string) => `NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(${p}.first_name), ''), NULLIF(TRIM(${p}.last_name), ''))), '')`;
const kurz = (t: unknown, n: number) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()} …` : s;
};
const uhr = (d: Date | string) => new Date(d as any).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** So viele gelbe Mail-Entwürfe stehen einzeln da; was darüber hinausgeht, nennt eine Zeile „und N weitere“. */
export const GELB_MAIL_DECKEL = 200;

/**
 * Die gelbe Liste: Handlungen der Werkzeuge auf Gelb aus den letzten 24 Stunden — einzeln, mit Rückgängig, wo es sicher
 * geht. Mail-Entwürfe auf Gelb warten, bis die 24-Stunden-Regel sie sendet (oder jemand „Nicht senden“ klickt).
 */
export async function gelbListe(stand: AmpelStand, o: { lauf?: Lauf; jetzt?: Date; mailDeckel?: number } = {}): Promise<GelbEintrag[]> {
  const lauf = o.lauf ?? sqlPool;
  const jetzt = o.jetzt ?? new Date();
  const gelb = MARA_AMPEL.filter((w) => stand[w.key] === "gelb").map((w) => w.key);
  const da = await tabellenDa(lauf);
  // Gelbe Mail-Entwürfe, die noch warten, stehen auch dann hier, wenn die Ampel inzwischen wieder grün ist.
  const [entwuerfe] = da.fiaon_postmeister
    ? (await lauf.unsafe(`SELECT COUNT(*)::int AS n FROM fiaon_postmeister WHERE begruendung LIKE $1 AND aktion = 'entwurf' AND gesendet_am IS NULL`, [`${AMPEL_GELB_KOPF}%`])) as any[]
    : [{ n: 0 }];
  if (!gelb.length && !Number(entwuerfe?.n)) return [];
  await rueckTabelle(lauf);
  const aus: GelbEintrag[] = [];
  const ab = new Date(jetzt.getTime() - 24 * 3_600_000);
  const erledigtLesen = async (art: RueckArt, ids: string[]) => {
    if (!ids.length) return new Map<string, any>();
    const z = (await lauf`SELECT quelle_id, am, von, ergebnis FROM fiaon_mara_rueckgaengig WHERE art = ${art} AND quelle_id = ANY(${ids})`) as any[];
    return new Map(z.map((r) => [String(r.quelle_id), r]));
  };
  const erl = (r: any) => (r ? { am: new Date(r.am).toISOString(), von: r.von ?? null, ergebnis: r.ergebnis ?? null } : null);

  // ── Termine: von Mara eingetragen, noch nicht vorbei → „Termin absagen“ ──
  if (gelb.includes("termin_eintragen") && da.fiaon_termine) {
    const t = (await lauf.unsafe(`
      SELECT t.id, t.person_id, t.beginn, t.status, t.herkunft, t.created_at, a.name AS agent, ${NAME_SQL("p")} AS name
        FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id LEFT JOIN fiaon_persons p ON p.id = t.person_id
       WHERE t.herkunft = ANY($1::text[]) AND t.created_at >= $2 ORDER BY t.created_at DESC LIMIT 40`,
      [MARA_TERMIN_HERKUENFTE as unknown as string[], ab])) as any[];
    const schon = await erledigtLesen("termin", t.map((x) => String(x.id)));
    for (const x of t) {
      const r = schon.get(String(x.id));
      const offen = !r && x.status === "gebucht" && new Date(x.beginn).getTime() > jetzt.getTime() && rueckgaengigOffen(x.created_at, jetzt);
      aus.push({
        art: "termin", id: String(x.id), werkzeug: "termin_eintragen", am: new Date(x.created_at).toISOString(),
        personId: x.person_id != null ? Number(x.person_id) : null, name: x.name ?? null,
        text: `Termin ${uhr(x.beginn)}${x.agent ? ` bei ${x.agent}` : ""}${x.status !== "gebucht" ? ` (${x.status})` : ""}`,
        knoepfe: offen ? [{ art: "termin", label: "Termin absagen", vorsicht: true }] : [],
        ohne: offen || r ? null : x.status !== "gebucht" ? "Nicht mehr gebucht." : "Liegt schon zurück.",
        erledigt: erl(r),
      });
    }
  }

  // ── Angaben: Anschrift und Telefon → „Zurück auf alt“; E-Mail bestätigt der Kunde selbst ──
  if (gelb.includes("angaben_aendern") && da.fiaon_mara_angaben) {
    const g = (await lauf.unsafe(`
      SELECT g.id, g.person_id, g.feld, g.stand, g.vorher, g.nachher, g.kanal, g.created_at, ${NAME_SQL("p")} AS name
        FROM fiaon_mara_angaben g LEFT JOIN fiaon_persons p ON p.id = g.person_id
       WHERE g.stand IN ('geaendert', 'link_geschickt', 'bestaetigt') AND g.created_at >= $1 ORDER BY g.created_at DESC LIMIT 40`, [ab])) as any[];
    const schon = await erledigtLesen("angaben", g.map((x) => String(x.id)));
    for (const x of g) {
      const r = schon.get(String(x.id));
      const geht = x.stand === "geaendert" && (x.feld === "anschrift" || x.feld === "telefon");
      const offen = !r && geht && rueckgaengigOffen(x.created_at, jetzt);
      aus.push({
        art: "angaben", id: String(x.id), werkzeug: "angaben_aendern", am: new Date(x.created_at).toISOString(),
        personId: x.person_id != null ? Number(x.person_id) : null, name: x.name ?? null,
        text: `${x.feld === "anschrift" ? "Anschrift" : x.feld === "telefon" ? "Telefon" : "E-Mail"}: ${kurz(x.vorher || "—", 60)} → ${kurz(x.nachher || "—", 60)} (${x.kanal === "whatsapp" ? "WhatsApp" : "Mail"})`,
        knoepfe: offen ? [{ art: "angaben", label: "Zurück auf alt", vorsicht: true }] : [],
        ohne: offen || r ? null : !geht ? (x.stand === "link_geschickt" ? "Wartet auf seinen Klick — geändert wird erst dann." : "Der Kunde hat die neue Adresse selbst bestätigt.") : "Älter als 24 Stunden.",
        erledigt: erl(r),
      });
    }
  }

  // ── Mail-Entwürfe auf Gelb: warten 24 h → „Jetzt senden“ oder „Nicht senden“ ──
  // E-406 B3 (Nachbesserung, Prüfer-Fund): Der Satz kommt aus DEMSELBEN Urteil wie Karte und 24-Stunden-Regel
  // (gelbLiegenLesen): „schreibt frühestens … neu und sendet“ nur, wenn die Regel das wirklich tut — sonst „geht nicht von
  // selbst raus (Grund)“, und der Entwurf liegt als Karte in Mara › Entscheidungen. Kein stilles Abschneiden: Was über den
  // Deckel geht, nennt eine Zeile „und N weitere“.
  if (Number(entwuerfe?.n) > 0) {
    const { postmeisterSchema } = await import("./fiaon-postmeister-schema");
    await postmeisterSchema().catch(() => {});
    const deckel = Math.max(1, Math.min(500, Math.round(Number(o.mailDeckel ?? GELB_MAIL_DECKEL)) || GELB_MAIL_DECKEL));
    const m = (await lauf.unsafe(`
      SELECT pm.id, pm.person_id, pm.betreff, pm.begruendung, pm.flags, pm.frist_ab, pm.frist_neu_am, pm.empfangen_am, pm.created_at,
             pm.entwurf_geprueft_am, COALESCE(pm.entwurf_geprueft_am, pm.created_at) AS am, ${NAME_SQL("p")} AS name
        FROM fiaon_postmeister pm LEFT JOIN fiaon_persons p ON p.id = pm.person_id
       WHERE pm.begruendung LIKE $1 AND pm.aktion = 'entwurf' AND pm.gesendet_am IS NULL
       ORDER BY pm.id DESC LIMIT $2`, [`${AMPEL_GELB_KOPF}%`, deckel])) as any[];
    const { gelbLiegenLesen, gelbZeileAus } = await import("./fiaon-postmeister-frist");
    const liegen = await gelbLiegenLesen(m.map(gelbZeileAus), jetzt);
    for (const x of m) {
      aus.push({
        art: "mail_nicht_senden", id: String(x.id), werkzeug: "mail_antworten", am: new Date(x.am).toISOString(),
        personId: x.person_id != null ? Number(x.person_id) : null, name: x.name ?? null,
        text: gelbEntwurfSatz(x.betreff, fristFaellig(x.am, jetzt), liegen.get(Number(x.id)) ?? null),
        knoepfe: [{ art: "mail_senden", label: "Jetzt senden" }, { art: "mail_nicht_senden", label: "Nicht senden", vorsicht: true }],
        ohne: null, erledigt: null,
      });
    }
    const weitere = Number(entwuerfe?.n) - m.length;
    if (weitere > 0 && m.length) {
      const aeltester = m.reduce((a, x) => Math.min(a, new Date(x.am).getTime()), Number.POSITIVE_INFINITY);
      aus.push({
        art: "info", id: "mail_weitere", werkzeug: "mail_antworten", am: new Date(aeltester - 1_000).toISOString(), personId: null, name: null,
        text: `${weitere === 1 ? "und 1 weiterer gelber Mail-Entwurf" : `und ${weitere} weitere gelbe Mail-Entwürfe`} — alle im Postfach unter „Zu prüfen“`,
        knoepfe: [], ohne: "einzeln im Postfach", erledigt: null,
      });
    }
  }

  // ── Alles andere auf Gelb: einzeln sichtbar, ehrlich ohne Rückgängig ──
  const rest: AmpelKey[] = gelb.filter((k) => k !== "termin_eintragen" && k !== "angaben_aendern" && k !== "mail_antworten");
  if (rest.length) {
    const h = (await handlungenLesen(ab, new Date(jetzt.getTime() + 60_000), { lauf, mitText: true })).filter((x) => x.werkzeug && rest.includes(x.werkzeug));
    const namen = await namenLesen(h.map((x) => x.personId).filter((n): n is number => n != null), lauf);
    for (const x of h.slice(0, 40)) {
      const w = ampelWerkzeug(x.werkzeug!);
      aus.push({
        art: "info", id: `${x.quelle}:${x.quelleId}`, werkzeug: x.werkzeug!, am: x.am, personId: x.personId,
        name: x.personId != null ? namen.get(x.personId) ?? null : null,
        text: `${HANDLUNG_ARTEN[x.art]?.eins ?? x.art}${x.mara ? ` — ${kurz(x.mara, 110)}` : ""}`,
        knoepfe: [], ohne: w?.ohneRueckgaengig ?? "Nicht rückgängig zu machen.", erledigt: null,
      });
    }
  }
  return aus.sort((a, b) => (a.am < b.am ? 1 : a.am > b.am ? -1 : 0));
}

async function namenLesen(ids: number[], lauf: Lauf): Promise<Map<number, string>> {
  const nur = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0)));
  if (!nur.length) return new Map();
  const z = (await lauf.unsafe(`SELECT p.id, ${NAME_SQL("p")} AS name FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [nur])) as any[];
  return new Map(z.filter((r) => r.name).map((r) => [Number(r.id), String(r.name)]));
}

/** Ein Vermerk im Verlauf der Person — wirft nie. */
async function vermerk(personId: number | null, refRoh: string | null, text: string, lauf: Lauf): Promise<void> {
  if (!personId && !refRoh) return;
  try {
    const { akteRef } = await import("./fiaon-postmeister-werkzeuge");
    const ref = await akteRef(personId, refRoh);
    if (!ref) return;
    await lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${personId}, NULL, ${"Mara heute (Lagezimmer)"}, 'system', ${text.slice(0, 1000)})`;
  } catch (e) {
    console.warn("[MARA-HEUTE] Vermerk:", String((e as Error)?.message ?? e).slice(0, 160));
  }
}

export interface RueckErgebnis { ok: boolean; status: number; text: string }

/** Die Telefonnummer, wie updateCustomerContact sie vergleicht (Vorwahl + Nummer, sonst Kontaktnummer). */
const telefonJetzt = (a: any) => `${a?.phone_country_code || ""}${a?.phone || ""}` || String(a?.contact_phone || "");
const gleich = (x: unknown, y: unknown) => String(x ?? "").replace(/\s+/g, " ").trim().toLowerCase() === String(y ?? "").replace(/\s+/g, " ").trim().toLowerCase();
/** „—“ ist leer (so schreibt updateCustomerContact einen leeren Wert in den Verlauf). */
const leer = (v: string) => (v.trim() === "—" ? "" : v.trim());

/**
 * Eine gelbe Handlung zurücknehmen (oder einen gelben Entwurf jetzt senden). Prüft die Lage JETZT; was sich
 * inzwischen geändert hat, bleibt. Einmal je Handlung.
 */
export async function rueckgaengigMachen(art: RueckArt, idRoh: string, von: string, o: { lauf?: Lauf; jetzt?: Date } = {}): Promise<RueckErgebnis> {
  const lauf = o.lauf ?? sqlPool;
  const jetzt = o.jetzt ?? new Date();
  const id = Number(idRoh);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, text: "Ungültiger Eintrag." };
  await rueckTabelle(lauf);
  const { ampelStand } = await import("./fiaon-mara-ampel");
  const stand = await ampelStand({ frisch: true, lauf: o.lauf });
  // Schon einmal zurückgenommen? Dann zuerst das sagen (nicht „inzwischen geändert“).
  if (art === "termin" || art === "angaben") {
    const [schon] = (await lauf`SELECT ergebnis FROM fiaon_mara_rueckgaengig WHERE art = ${art} AND quelle_id = ${String(id)}`) as any[];
    if (schon) return { ok: false, status: 409, text: `Schon zurückgenommen${schon.ergebnis ? `: ${String(schon.ergebnis)}` : "."}` };
  }

  if (art === "termin") {
    if (stand.termin_eintragen !== "gelb") return { ok: false, status: 409, text: "„Termine eintragen“ steht nicht auf Gelb." };
    const [t] = (await lauf`
      SELECT id, person_id, beginn, status, storno_token, herkunft, created_at FROM fiaon_termine
       WHERE id = ${id} AND herkunft = ANY(${MARA_TERMIN_HERKUENFTE as unknown as string[]})`) as any[];
    if (!t) return { ok: false, status: 404, text: "Diesen Mara-Termin gibt es nicht." };
    if (t.status !== "gebucht") return { ok: false, status: 409, text: "Der Termin ist nicht mehr gebucht." };
    if (new Date(t.beginn).getTime() <= jetzt.getTime()) return { ok: false, status: 409, text: "Der Termin liegt schon zurück." };
    if (!rueckgaengigOffen(t.created_at, jetzt)) return { ok: false, status: 409, text: "Älter als 24 Stunden — bitte in der Akte absagen." };
    if (!t.storno_token) return { ok: false, status: 409, text: "Ohne Absage-Schlüssel — bitte in der Akte absagen." };
    const [anspruch] = (await lauf`
      INSERT INTO fiaon_mara_rueckgaengig (art, quelle_id, person_id, von) VALUES ('termin', ${String(id)}, ${t.person_id ?? null}, ${von.slice(0, 120)})
      ON CONFLICT (art, quelle_id) DO NOTHING RETURNING id`) as any[];
    if (!anspruch) return { ok: false, status: 409, text: "Schon zurückgenommen." };
    const { terminAbsagen } = await import("./fiaon-termine");
    const r = await terminAbsagen(String(t.storno_token), "agent", lauf);
    if (!r.ok) {
      await lauf`DELETE FROM fiaon_mara_rueckgaengig WHERE id = ${anspruch.id}`;
      return { ok: false, status: 409, text: "Die Absage ging nicht durch — der Termin hat sich inzwischen geändert." };
    }
    const text = `Termin ${uhr(t.beginn)} abgesagt — der Kunde bekommt die Absage mit Link zum Neubuchen.`;
    await lauf`UPDATE fiaon_mara_rueckgaengig SET ergebnis = ${text} WHERE id = ${anspruch.id}`;
    await vermerk(t.person_id != null ? Number(t.person_id) : null, null,
      `Von Mara eingetragener Termin (${uhr(t.beginn)}) zurückgenommen — Ampel Gelb, „Mara heute“ im Lagezimmer (${von}). Der Kunde bekommt die Absage mit Link zum Neubuchen.`, lauf);
    return { ok: true, status: 200, text };
  }

  if (art === "angaben") {
    if (stand.angaben_aendern !== "gelb") return { ok: false, status: 409, text: "„Anschrift und Telefon ändern“ steht nicht auf Gelb." };
    const [da] = (await lauf`SELECT to_regclass('public.fiaon_mara_angaben') IS NOT NULL AS da`) as any[];
    if (!da?.da) return { ok: false, status: 404, text: "Diese Änderung gibt es nicht." };
    const [g] = (await lauf`SELECT * FROM fiaon_mara_angaben WHERE id = ${id}`) as any[];
    if (!g) return { ok: false, status: 404, text: "Diese Änderung gibt es nicht." };
    if (g.stand !== "geaendert" || !["anschrift", "telefon"].includes(String(g.feld))) {
      return { ok: false, status: 409, text: "Nur eine gespeicherte Anschrift oder Telefonnummer lässt sich zurücknehmen." };
    }
    if (!rueckgaengigOffen(g.created_at, jetzt)) return { ok: false, status: 409, text: "Älter als 24 Stunden — bitte in der Akte ändern." };
    const ref = String(g.ref ?? "");
    if (!ref) return { ok: false, status: 409, text: "Ohne Bestellung — bitte in der Akte ändern." };
    const felder = g.feld === "anschrift" ? ["Straße", "PLZ", "Ort", "Land"] : ["Telefon"];
    const logs = (await lauf`
      SELECT note, created_at FROM fiaon_contact_log
       WHERE ref = ${ref} AND type = 'edit' AND agent_name IN ('Mara (Mail)', 'Mara (WhatsApp)')
         AND created_at BETWEEN ${g.created_at}::timestamptz - INTERVAL '1 minute' AND ${g.aktualisiert_am ?? g.created_at}::timestamptz + INTERVAL '2 minutes'
       ORDER BY created_at ASC, id ASC`) as any[];
    // Je Feld die LETZTE Änderung dieser Handlung (vorher = Stand davor).
    const je = new Map<string, { vorher: string; nachher: string }>();
    for (const l of logs) {
      const e = editZeileLesen(String(l.note));
      if (!e || !felder.includes(e.feld)) continue;
      const alt = je.get(e.feld);
      je.set(e.feld, { vorher: alt ? alt.vorher : e.vorher, nachher: e.nachher });
    }
    if (!je.size) return { ok: false, status: 409, text: "Der alte Stand steht nicht im Verlauf — bitte in der Akte ändern." };
    const [a] = (await lauf`SELECT street, zip, city, country, phone, phone_country_code, contact_phone FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`) as any[];
    if (!a) return { ok: false, status: 404, text: "Die Bestellung gibt es so nicht mehr." };
    const jetztWert: Record<string, string> = { "Straße": a.street ?? "", PLZ: a.zip ?? "", Ort: a.city ?? "", Land: a.country ?? "", Telefon: telefonJetzt(a) };
    const body: Record<string, string> = {};
    const bleibt: string[] = [];
    let land: { vorher: string; nachher: string } | null = null;
    for (const [feld, w] of Array.from(je.entries())) {
      if (!gleich(jetztWert[feld], leer(w.nachher))) { bleibt.push(`${feld} (inzwischen geändert)`); continue; }
      if (feld === "Telefon" && !leer(w.vorher)) { bleibt.push("Telefon (vorher leer)"); continue; }
      if (feld === "Straße") body.street = leer(w.vorher);
      if (feld === "PLZ") body.zip = leer(w.vorher);
      if (feld === "Ort") body.city = leer(w.vorher);
      if (feld === "Telefon") body.phone = leer(w.vorher);
      if (feld === "Land") land = w;
    }
    if (!Object.keys(body).length && !land) return { ok: false, status: 409, text: `Nichts zurückzunehmen: ${bleibt.join(", ") || "schon so"}.` };
    const [anspruch] = (await lauf`
      INSERT INTO fiaon_mara_rueckgaengig (art, quelle_id, person_id, von) VALUES ('angaben', ${String(id)}, ${g.person_id ?? null}, ${von.slice(0, 120)})
      ON CONFLICT (art, quelle_id) DO NOTHING RETURNING id`) as any[];
    if (!anspruch) return { ok: false, status: 409, text: "Schon zurückgenommen." };
    const wer = `Chefbüro (Mara heute: zurück, ${von})`.slice(0, 120);
    if (Object.keys(body).length) {
      const { updateCustomerContact } = await import("../routes/fiaon-agent");
      const erg = await updateCustomerContact(ref, body, { id: null, name: wer });
      if (erg.error) {
        await lauf`DELETE FROM fiaon_mara_rueckgaengig WHERE id = ${anspruch.id}`;
        return { ok: false, status: 409, text: `Zurück ging nicht: ${erg.error.msg}` };
      }
    }
    if (land) {
      await lauf`UPDATE fiaon_applications SET country = ${leer(land.vorher) || null}, updated_at = NOW() WHERE ref = ${ref}`;
      if (g.person_id) await lauf`UPDATE fiaon_persons SET country = ${leer(land.vorher) || null}, updated_at = NOW() WHERE id = ${g.person_id}`;
      await lauf`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${g.person_id ?? null}, NULL, ${wer}, 'edit', ${`Land korrigiert durch ${wer}: ${land.nachher} → ${land.vorher}`})`.catch(() => {});
    }
    const text = `${g.feld === "anschrift" ? "Anschrift" : "Telefon"} zurück auf den alten Stand.${bleibt.length ? ` Bleibt: ${bleibt.join(", ")}.` : ""}`;
    await lauf`UPDATE fiaon_mara_rueckgaengig SET ergebnis = ${text} WHERE id = ${anspruch.id}`;
    await lauf`UPDATE fiaon_mara_angaben SET grund = ${`Zurückgenommen im Lagezimmer (${von})`.slice(0, 300)}, aktualisiert_am = NOW() WHERE id = ${id}`.catch(() => {});
    await vermerk(g.person_id != null ? Number(g.person_id) : null, ref,
      `Maras Änderung (${g.feld === "anschrift" ? "Anschrift" : "Telefon"}) zurückgenommen — Ampel Gelb, „Mara heute“ im Lagezimmer (${von}).`, lauf);
    return { ok: true, status: 200, text };
  }

  if (art === "mail_nicht_senden" || art === "mail_senden") {
    const [pm] = (await lauf`SELECT id, aktion, gesendet_am, begruendung, person_id FROM fiaon_postmeister WHERE id = ${id}`) as any[];
    if (!pm) return { ok: false, status: 404, text: "Diese Mail gibt es nicht." };
    if (pm.gesendet_am || pm.aktion !== "entwurf") return { ok: false, status: 409, text: "Die Mail ist schon gesendet oder abgelegt." };
    if (!String(pm.begruendung ?? "").startsWith(AMPEL_GELB_KOPF)) return { ok: false, status: 409, text: "Das ist kein gelber Entwurf." };
    if (art === "mail_senden") {
      const { entwurfSenden } = await import("../routes/fiaon-postmeister-zentrale");
      const e = await entwurfSenden(id, null, {}, von);
      return e.ok ? { ok: true, status: 200, text: `Gesendet.${e.erledigt?.length ? ` ${e.erledigt.join(" · ")}` : ""}` } : { ok: false, status: 409, text: `Nicht gesendet: ${e.grund}` };
    }
    const { entwurfVerwerfen } = await import("./fiaon-postmeister-entscheidungen");
    const ok = await entwurfVerwerfen(id, von);
    return ok ? { ok: true, status: 200, text: "Nicht gesendet — abgelegt." } : { ok: false, status: 409, text: "Die Mail ist schon gesendet oder abgelegt." };
  }
  return { ok: false, status: 400, text: "Unbekannter Knopf." };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KARTE IM LAGEZIMMER
// ═══════════════════════════════════════════════════════════════════════════
export interface HaengtZeile { agentId: number; name: string; termineOhneErgebnis: number; aeltesterTermin: string | null; auftraegeUeberfaellig: number; auftraegeOffen: number }
export interface MaraHeute {
  stand: string;
  erledigt: number;
  zeilen: HeuteZeile[];
  geld: { heuteCents: number; zahlungen: number; nachMaraCents: number; nachMaraZahlungen: number } | null;
  karten: { entscheidungen: number; minuten: number; karten: number; aelterAlsZiel: number; aeltesteTage: number } | null;
  aufraeumen: { art: string; anzahl: number; titel: string }[];
  haengt: HaengtZeile[];
  ki: { maraCents: number; alleCents: number; wocheCents: number } | null;
  gelb: GelbEintrag[];
  ampel: AmpelStand;
  gelbWerkzeuge: AmpelKey[];
}

/** Wo im Team jemand hängt: vergangene Termine ohne Ergebnis (14 Tage) und überfällige Aufträge — die fünf größten. */
export async function haengtLesen(lauf: Lauf = sqlPool): Promise<HaengtZeile[]> {
  const z = (await lauf.unsafe(`
    WITH t AS (
      SELECT agent_id, COUNT(*)::int AS n, MIN(beginn) AS aeltester FROM fiaon_termine
       WHERE status = 'gebucht' AND beginn < NOW() - INTERVAL '30 minutes' AND beginn > NOW() - INTERVAL '14 days' GROUP BY agent_id),
    a AS (
      SELECT zustaendig_agent_id AS agent_id,
             COUNT(*) FILTER (WHERE faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS ueberfaellig, COUNT(*)::int AS offen
        FROM fiaon_betreiber_todos WHERE status <> 'erledigt' AND zustaendig_art = 'agent' AND zustaendig_agent_id IS NOT NULL GROUP BY 1)
    SELECT ag.id, ag.name, COALESCE(t.n, 0) AS termine, t.aeltester, COALESCE(a.ueberfaellig, 0) AS ueberfaellig, COALESCE(a.offen, 0) AS offen
      FROM fiaon_agents ag LEFT JOIN t ON t.agent_id = ag.id LEFT JOIN a ON a.agent_id = ag.id
     WHERE COALESCE(ag.active, TRUE) AND ag.zugang_gesperrt_am IS NULL AND NOT COALESCE(ag.is_test_account, FALSE)
       AND (COALESCE(t.n, 0) > 0 OR COALESCE(a.ueberfaellig, 0) > 0)
     ORDER BY COALESCE(t.n, 0) DESC, COALESCE(a.ueberfaellig, 0) DESC LIMIT 5`).catch(() => [])) as any[];
  return z.map((r) => ({
    agentId: Number(r.id), name: String(r.name), termineOhneErgebnis: Number(r.termine), aeltesterTermin: r.aeltester ? new Date(r.aeltester).toISOString() : null,
    auftraegeUeberfaellig: Number(r.ueberfaellig), auftraegeOffen: Number(r.offen),
  }));
}

/** Die Aufräum-Vorschläge, die offen liegen (Maras neue Sammelkarte und die bestehenden Entwurfs-Karten). */
export async function aufraeumenLesen(lauf: Lauf = sqlPool): Promise<{ art: string; anzahl: number; titel: string }[]> {
  const [da] = (await lauf`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`) as any[];
  if (!da?.da) return [];
  const z = (await lauf.unsafe(`
    SELECT art, COUNT(*)::int AS n, MIN(titel) AS titel FROM fiaon_mara_entscheidungen
     WHERE art = ANY($1::text[]) AND (status = 'offen' OR (status = 'spaeter' AND spaeter_bis <= NOW())) GROUP BY art`,
    [[AUFRAEUM_ART_ZAHLUNG, "postmeister_altbestand", "postmeister_altentwuerfe"]])) as any[];
  return z.map((r) => ({
    art: String(r.art), anzahl: Number(r.n),
    titel: r.art === AUFRAEUM_ART_ZAHLUNG ? `${Number(r.n)} alte ${Number(r.n) === 1 ? "Zahlungsmeldung" : "Zahlungsmeldungen"}: im Bankbuch nachsehen?` : String(r.titel ?? r.art),
  }));
}

/** KI-Kosten heute (Berlin) — Maras Dienste und alle; dazu 7 Tage. */
export async function kiKostenLesen(lauf: Lauf = sqlPool): Promise<{ maraCents: number; alleCents: number; wocheCents: number } | null> {
  const [da] = (await lauf`SELECT to_regclass('public.fiaon_ki_nutzung') IS NOT NULL AS da`) as any[];
  if (!da?.da) return null;
  const { MARA_DIENSTE } = await import("./fiaon-mara-bilanz");
  const [z] = (await lauf.unsafe(`
    SELECT COALESCE(SUM(kosten_cents) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'), 0)::float AS alle,
           COALESCE(SUM(kosten_cents) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
                                               AND dienst = ANY($1::text[])), 0)::float AS mara,
           COALESCE(SUM(kosten_cents), 0)::float AS woche
      FROM fiaon_ki_nutzung WHERE created_at > NOW() - INTERVAL '7 days'`, [MARA_DIENSTE as unknown as string[]])) as any[];
  return { maraCents: Math.round(Number(z?.mara || 0)), alleCents: Math.round(Number(z?.alle || 0)), wocheCents: Math.round(Number(z?.woche || 0)) };
}

/** Alles für die Karte „Mara heute“. Jeder Teil darf scheitern, ohne die Karte umzuwerfen (dann fehlt er nur). */
export async function maraHeuteLesen(o: { lauf?: Lauf; ohneGeld?: boolean } = {}): Promise<MaraHeute> {
  const lauf = o.lauf ?? sqlPool;
  const [t] = (await lauf.unsafe(`SELECT date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' AS ab, NOW() AS jetzt`)) as any[];
  const ab = new Date(t.ab), jetzt = new Date(t.jetzt);
  const { ampelStand } = await import("./fiaon-mara-ampel");
  const ampel = await ampelStand(o.lauf ? { lauf } : {});
  const fehlerLog = (was: string) => (e: unknown) => { console.warn(`[MARA-HEUTE] ${was}:`, String((e as Error)?.message ?? e).slice(0, 200)); return null; };
  const [zahlen, geld, karten, aufraeumen, haengt, ki, gelb] = await Promise.all([
    handlungenZaehlen(ab, new Date(jetzt.getTime() + 60_000), lauf).catch(fehlerLog("Handlungen")),
    o.ohneGeld ? Promise.resolve(null) : (async () => {
      const { maraBilanz } = await import("./fiaon-mara-bilanz");
      const r = (await maraBilanz()).zeitraeume.heute?.rahmen;
      return r ? { heuteCents: r.geldCents, zahlungen: r.zahlungen, nachMaraCents: r.nachMaraCents, nachMaraZahlungen: r.nachMaraZahlungen } : null;
    })().catch(fehlerLog("Geld")),
    (async () => {
      const { tagesLastLesen } = await import("./fiaon-mara-entscheidungen");
      const l = await tagesLastLesen(lauf);
      return { entscheidungen: l.entscheidungen, minuten: l.minuten, karten: l.karten, aelterAlsZiel: l.aelterAlsZiel, aeltesteTage: l.aeltesteTage };
    })().catch(fehlerLog("Karten")),
    aufraeumenLesen(lauf).catch(fehlerLog("Aufräumen")),
    haengtLesen(lauf).catch(fehlerLog("Hängt")),
    kiKostenLesen(lauf).catch(fehlerLog("KI")),
    gelbListe(ampel, { lauf, jetzt }).catch(fehlerLog("Gelb")),
  ]);
  const z = zahlen ?? {};
  return {
    stand: jetzt.toISOString(),
    erledigt: heuteErledigt(z),
    zeilen: heuteZeilen(z),
    geld, karten, aufraeumen: aufraeumen ?? [], haengt: haengt ?? [], ki, gelb: gelb ?? [],
    ampel, gelbWerkzeuge: MARA_AMPEL.filter((w) => ampel[w.key] === "gelb").map((w) => w.key),
  };
}

/** Für die Anzeige: die Stufe eines Werkzeugs (oder null bei Karten und Übergaben). */
export function stufeFuer(stand: AmpelStand, werkzeug: AmpelKey | null): AmpelStufe | null {
  return werkzeug ? stand[werkzeug] : null;
}
