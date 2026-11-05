// ═══════════════════════════════════════════════════════════════════════════
// FIRMENKUNDEN — die B2B-Jagdstrecke (02.09.2026, Justins Nachtauftrag)
//
// DER AUFTRAG: Nikita ist seit heute fest an Bord (2.000 € + Provision) und
// setzt täglich ~50 Anrufe auf Unternehmen an. Jedes Unternehmen braucht
// Liquidität — Liquidität hängt an der Firmen-Bonität (Creditreform, SCHUFA
// B2B, KSV). Diese Strecke macht aus einer Firmenliste einen Selbstläufer:
// Liste rein → Tagesliste → Anruf mit Leitfaden → Ergebnis in einem Klick →
// Info-Mail/Antragslink → Wiedervorlage → Abschluss (bis 17.09.2026 über
// /business-antrag, seither über /business/start — siehe unten).
//
// BEWUSSTE GRENZEN:
//  · ADDITIV: Firmen-Leads sind KEINE fiaon_persons und KEINE fiaon_leads —
//    eigener Topf (fiaon_firmen_leads), damit die Privat-Maschine (Tier,
//    Verteilung, Mahnwesen) garantiert unberührt bleibt. Erst mit dem
//    Business-Antrag betritt die Firma den normalen Kundenweg.
//  · EHRLICH: Der Leitfaden (Client) behauptet KEINE Exklusiv-Verträge mit
//    Auskunfteien — die sind in Verhandlung, nicht unterschrieben.
//  · Info-Mail: höchstens EINE je Firma je 7 Tage, Versand über das
//    Dienstkonto (welcome@), Antwortweg = der anrufende Mitarbeiter.
//
// ── SEIT DEM 17.09.2026 VERKAUFT DIESE STRECKE FIAON GLOBAL (E-188) ────────
// Die vier Business-Abos sind eingestellt (shared/fiaon-pakete.ts). Das
// Cockpit bleibt, wie es ist — Liste, Ring, Ergebnis-Knöpfe —, aber was es
// SAGT und was es VERKAUFT, ist neu:
//   · Abschluss: die Pakete kommen aus verkaufbarePakete("global"), nicht mehr
//     aus einer harten Liste. Ein eingestelltes Paket ist nicht wählbar.
//     Global-Pakete sind EINMALPREISE — keine „erste Rate".
//   · Info-Mail und KI-Vorbereitung: Texte aus shared/fiaon-global-vertrieb.ts
//     (eine Stelle, von scripts/pruef-pakete.ts durch die Wortwand geschickt).
//     Keine Zusage zu Karte, Rahmen, Zins, Frist oder Bank; Steuer und Recht
//     nur über Steuerberater und Anwälte auf eigenes Mandat.
//   · Der Antragslink zeigt auf /business/start (shared/fiaon-global-wege.ts),
//     nicht mehr auf /business-antrag.
//
// ── 17.09.2026 (E-188): DER TOPF HAT EINEN EINGANG VON DER WEBSITE ─────────
// Bis heute kam eine Firma nur über „Liste einkleben" hierher. Wer auf
// /business ein Erstgespräch zu FIAON Global bucht oder um einen Anruf bittet,
// landet jetzt als Lead mit quelle „global" in DIESEM Topf — ganz oben in der
// Tagesliste der zuständigen Person (`globalLeadAufnehmen`). Was aus dem
// Gespräch wird, schreibt `globalLeadFortschreiben` in denselben Verlauf.
// Neu dafür: die Spalten person_id (der Firmenkontakt in fiaon_persons, an dem
// der Termin hängt), paketwunsch und global_am (wann sich das Unternehmen
// zuletzt SELBST gemeldet hat — die Liste zeigt es als Zusatz „FIAON Global"
// und ordnet es vor die Kaltakquise; `quelle` bleibt, was sie war).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { gmailBereit } from "../lib/fiaon-gmail";
import { verkaufbarePakete } from "@shared/fiaon-pakete";
import { globalInfoMail, globalVorbereitungSystem } from "@shared/fiaon-global-vertrieb";
import { globalStartUrl } from "@shared/fiaon-global-wege";
import { berlinToday, berlinPlusTage } from "../lib/fiaon-time";
import { openaiFetch, istKiPause } from "../lib/fiaon-ki-pause";

const router = Router();

export const FIRMEN_TAGESZIEL = 50;

const ERGEBNISSE = new Set([
  "erreicht_interesse", "erreicht_termin", "erreicht_antrag",
  "erreicht_kein_interesse", "nicht_erreicht", "mailbox", "nummer_falsch",
]);

let bereit: Promise<void> | null = null;
function ensureFirmen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_firmen_leads (
          id SERIAL PRIMARY KEY,
          firma TEXT NOT NULL,
          ansprechpartner TEXT, telefon TEXT, email TEXT, website TEXT,
          ort TEXT, branche TEXT, notiz TEXT, quelle TEXT,
          status TEXT NOT NULL DEFAULT 'neu',
          zustaendig_agent_id INTEGER,
          wiedervorlage DATE,
          letzter_kontakt TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_status_idx ON fiaon_firmen_leads (status, wiedervorlage)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_firmen_log (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER NOT NULL,
          agent_id INTEGER, agent_name TEXT,
          art TEXT NOT NULL,
          ergebnis TEXT, notiz TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_log_idx ON fiaon_firmen_log (firma_id, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_log_tag_idx ON fiaon_firmen_log (agent_id, art, created_at DESC)`;
      // E-188: CREATE TABLE IF NOT EXISTS ergänzt keine Spalte — deshalb ALTER,
      // mit lock_timeout (Muster ensureAnfragenSpalten): Lieber nach 3 s
      // aufgeben und beim nächsten Aufruf neu versuchen, als sich hinter eine
      // lange Transaktion zu stellen und das Cockpit anzuhalten.
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_firmen_leads
          ADD COLUMN IF NOT EXISTS person_id INTEGER,
          ADD COLUMN IF NOT EXISTS paketwunsch TEXT,
          ADD COLUMN IF NOT EXISTS global_am TIMESTAMPTZ`;
      });
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_person_idx ON fiaon_firmen_leads (person_id) WHERE person_id IS NOT NULL`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER EINGANG VON DER WEBSITE (17.09.2026, E-188)
//
// Zwei Funktionen, beide von server/lib/fiaon-global-termin.ts gerufen:
//
//   globalLeadAufnehmen       Buchung oder Anfrage von /business: Lead finden
//                             (Person, E-Mail oder Firmenname) oder anlegen,
//                             nach oben in die Tagesliste, Zeile im Verlauf.
//   globalLeadFortschreiben   Gespräch geführt, nicht zustande gekommen,
//                             abgesagt: Status und Wiedervorlage nachziehen.
//
// „OBEN" HEISST HIER: Die Liste (GET /agent/firmen/liste) ordnet fällige
// Wiedervorlagen zuerst — und unter den fälligen die Unternehmen, die sich
// SELBST gemeldet haben (global_am), vor allem anderen. Ein Lead mit
// Wiedervorlage HEUTE steht deshalb ganz vorn — bis die zuständige Person ein
// Ergebnis klickt. Eine Wiedervorlage am Gesprächstag würde ihn bis dahin aus
// „Jetzt dran" ausblenden; genau das soll nicht passieren.
//
// Verlaufszeilen tragen art „global" und zählen NICHT auf den Anruf-Ring (der
// zählt art „anruf") — ein gebuchtes Gespräch ist kein geführter Anruf.
// ═══════════════════════════════════════════════════════════════════════════

export type GlobalLeadStatus = "termin" | "wiedervorlage" | "in_arbeit" | "kein_interesse";
export type GlobalLeadEreignis =
  | "termin_gebucht" | "anfrage" | "termin_abgesagt" | "gespraech_gefuehrt" | "gespraech_nicht_zustande"
  // E-458 Nr. 11 (29.10.2026): das verschobene Gespräch und die Mails davor/danach (fiaon-global-gespraech.ts).
  | "termin_verschoben" | "gespraech_mail";

function wiedervorlageTag(wann: "heute" | "morgen" | null): string | null {
  return wann === "heute" ? berlinToday() : wann === "morgen" ? berlinPlusTage(1) : null;
}

export async function globalLeadAufnehmen(ein: {
  firma: string; ansprechpartner: string; telefon: string; email: string;
  land?: string | null;
  /** Klartext, z. B. „Global Banking (4.999 €)". */
  paketwunsch?: string | null;
  personId?: number | null;
  zustaendigAgentId: number | null;
  status: GlobalLeadStatus;
  ereignis: GlobalLeadEreignis;
  /** Die Zeile für den Verlauf — was gebucht oder gewünscht wurde. */
  verlauf: string;
  /**
   * E-476 Scheibe 3: Die Firma ist schon bekannt (persönlicher Link, Zuordnung zur Anfrage, Cockpit-Knopf) — dann diese,
   * auch wenn der Lead beim Buchen eine andere Mail oder einen anderen Firmennamen tippt (sonst entstünde eine zweite Firma).
   */
  firmaId?: number | null;
}): Promise<{ firmaId: number; neu: boolean }> {
  await ensureFirmen();
  const firma = ein.firma.trim().slice(0, 200);
  const email = ein.email.trim().toLowerCase();
  const personId = ein.personId ?? null;
  const heute = berlinToday();
  // Eine kurze Zeile für das Notizfeld der Anruf-Karte — dort liest die
  // zuständige Person zuerst. Das Ausführliche steht im Verlauf.
  const notizZeile = `FIAON Global (${heute.split("-").reverse().join(".")}): ${ein.verlauf}`.slice(0, 600);

  // Dubletten vermeiden: erst die bekannte Firma (E-476), dann die Person, dann die E-Mail, dann der Firmenname.
  const [bekannt] = ein.firmaId ? ((await sqlPool`SELECT id FROM fiaon_firmen_leads WHERE id = ${ein.firmaId}`) as any[]) : [];
  const [da] = bekannt ? [bekannt] : (await sqlPool`
    SELECT id FROM fiaon_firmen_leads
    WHERE (${personId}::int IS NOT NULL AND person_id = ${personId}::int)
       OR (${email} <> '' AND LOWER(COALESCE(email, '')) = ${email})
       OR LOWER(TRIM(firma)) = ${firma.toLowerCase()}
    ORDER BY COALESCE(person_id = ${personId}::int, FALSE) DESC,
             (${email} <> '' AND LOWER(COALESCE(email, '')) = ${email}) DESC, id ASC
    LIMIT 1
  `) as any[];

  let firmaId: number;
  if (da) {
    firmaId = Number(da.id);
    // Nur leere Felder füllen — was die zuständige Person am Telefon
    // nachgetragen hat, überschreibt kein Formular. Den Besitz behält, wer ihn
    // hat und arbeiten kann; ein inaktives oder gesperrtes Konto gibt ihn ab.
    await sqlPool`
      UPDATE fiaon_firmen_leads SET
        ansprechpartner = COALESCE(NULLIF(ansprechpartner, ''), ${ein.ansprechpartner || null}),
        telefon = COALESCE(NULLIF(telefon, ''), ${ein.telefon || null}),
        email = COALESCE(NULLIF(email, ''), ${email || null}),
        ort = COALESCE(NULLIF(ort, ''), ${ein.land || null}),
        person_id = COALESCE(person_id, ${personId}::int),
        paketwunsch = COALESCE(${ein.paketwunsch || null}, paketwunsch),
        quelle = CASE WHEN COALESCE(quelle, '') = '' THEN 'global' ELSE quelle END,
        global_am = NOW(),
        status = ${ein.status},
        wiedervorlage = ${heute}::date,
        zustaendig_agent_id = CASE
          WHEN zustaendig_agent_id IS NULL THEN ${ein.zustaendigAgentId}::int
          WHEN EXISTS (SELECT 1 FROM fiaon_agents a
                        WHERE a.id = fiaon_firmen_leads.zustaendig_agent_id
                          AND a.active AND a.zugang_gesperrt_am IS NULL) THEN zustaendig_agent_id
          ELSE COALESCE(${ein.zustaendigAgentId}::int, zustaendig_agent_id) END,
        notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${notizZeile}::text),
        updated_at = NOW()
      WHERE id = ${firmaId}
    `;
  } else {
    const [neu] = (await sqlPool`
      INSERT INTO fiaon_firmen_leads
        (firma, ansprechpartner, telefon, email, ort, notiz, quelle, status,
         zustaendig_agent_id, wiedervorlage, person_id, paketwunsch, global_am)
      VALUES (${firma}, ${ein.ansprechpartner || null}, ${ein.telefon || null}, ${email || null},
              ${ein.land || null}, ${notizZeile}, 'global', ${ein.status},
              ${ein.zustaendigAgentId}::int, ${heute}::date, ${personId}::int, ${ein.paketwunsch || null}, NOW())
      RETURNING id
    `) as any[];
    firmaId = Number(neu.id);
  }

  await sqlPool`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    VALUES (${firmaId}, NULL, 'Website', 'global', ${ein.ereignis}, ${ein.verlauf.slice(0, 2000)})
  `;
  return { firmaId, neu: !da };
}

/**
 * Den Lead zu einem Firmenkontakt fortschreiben — nach dem Gespräch, nach
 * einer Absage. Findet nichts (der Lead wurde nie angelegt), passiert nichts:
 * Ein Termin darf nicht daran hängen bleiben, dass sein Lead fehlt.
 */
export async function globalLeadFortschreiben(ein: {
  personId: number;
  status: GlobalLeadStatus;
  wiedervorlage: "heute" | "morgen" | null;
  ereignis: GlobalLeadEreignis;
  verlauf: string;
  agent?: { id: number; name: string } | null;
  /** Hat ein Mensch mit dem Unternehmen gesprochen? Dann zählt es als Kontakt. */
  kontakt?: boolean;
}): Promise<{ firmaId: number | null }> {
  await ensureFirmen();
  const [lead] = (await sqlPool`
    SELECT id FROM fiaon_firmen_leads WHERE person_id = ${ein.personId} ORDER BY updated_at DESC LIMIT 1
  `) as any[];
  if (!lead) return { firmaId: null };
  const firmaId = Number(lead.id);
  await sqlPool`
    UPDATE fiaon_firmen_leads SET
      status = ${ein.status},
      wiedervorlage = ${wiedervorlageTag(ein.wiedervorlage)}::date,
      letzter_kontakt = CASE WHEN ${ein.kontakt === true} THEN NOW() ELSE letzter_kontakt END,
      updated_at = NOW()
    WHERE id = ${firmaId}
  `;
  await sqlPool`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    VALUES (${firmaId}, ${ein.agent?.id ?? null}, ${ein.agent?.name ?? "System"}, 'global',
            ${ein.ereignis}, ${ein.verlauf.slice(0, 2000)})
  `;
  return { firmaId };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-476 Scheibe 5 (05.11.2026): EIN STAND JE LEAD
//
// VORHER (04.11.): Anfragen auf „neu“, Aufträge auf „offen“, eine Firma auf „termin“ ohne Termin — drei Wahrheiten.
// NACHHER: Der Stand steht im Firmen-Cockpit. Nach jedem Ereignis — Anruf-Ergebnis, Buchung, Cockpit-Knopf,
// Gesprächsergebnis, Absage — zieht globalLeadStandSetzen die Anfrage nach (abgeleitet aus Cockpit, Kalender und
// Anrufen: „termin“ nur mit Termin), und der Anruf-Auftrag schließt sich (erreicht, Termin, Abschluss), bleibt offen
// (nicht erreicht: Fälligkeit = Wiedervorlage) oder geht wieder auf (abgesagt, Justin hat ihn nicht erreicht).
// Die Regeln: shared/fiaon-lead-takt.ts, die Arbeit: server/lib/fiaon-lead-takt.ts. Nur für Business-Leads (eine offene
// Global-Anfrage) — Kaltakquise-Listen bleiben, wie sie sind (Gutachten 0, Mangel 9). Wirft nie.
// ═══════════════════════════════════════════════════════════════════════════
export async function globalLeadStandSetzen(ein: {
  firmaId?: number | null; anfrageId?: number | null; ereignis: import("@shared/fiaon-lead-takt").LeadStandEreignis;
  wer?: { id: number | null; name: string } | null; wiedervorlage?: string | null;
}): Promise<{ anfrageId: number | null; anfrageStatus: string | null; auftrag: string | null }> {
  try {
    const { leadStandSetzen } = await import("../lib/fiaon-lead-takt");
    return await leadStandSetzen(ein);
  } catch (e) {
    console.error("[FIRMEN] Stand:", String(e).slice(0, 160));
    return { anfrageId: null, anfrageStatus: null, auftrag: null };
  }
}

const HEUTE_BERLIN = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;

// ── Die Tagesliste + Zähler ─────────────────────────────────────────────────
router.get("/agent/firmen/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const me = req.agent!.id;
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = String(req.query.filter || "arbeit");

    // Arbeit = was JETZT dran ist: fällige Wiedervorlagen zuerst, dann Neues.
    // „Kein Interesse"/ungültig/Antrag sind raus; fremd zugeteilte auch.
    // E-188 (17.09.2026): Unter den Fälligen steht vorn, wer sich über
    // fiaon.com/business SELBST gemeldet hat (global_am) — ein Unternehmen, das
    // um ein Gespräch zu FIAON Global bittet, wartet nicht hinter der
    // Kaltakquise von letzter Woche.
    const zeilen = await sqlPool.unsafe(`
      SELECT f.*,
             (SELECT COUNT(*)::int FROM fiaon_firmen_log l WHERE l.firma_id = f.id AND l.art = 'anruf') AS anrufe,
             (SELECT MAX(l.created_at) FROM fiaon_firmen_log l WHERE l.firma_id = f.id) AS letzte_bewegung
      FROM fiaon_firmen_leads f
      WHERE ($2 = '' OR f.firma ILIKE '%' || $2 || '%' OR COALESCE(f.ort,'') ILIKE '%' || $2 || '%'
             OR COALESCE(f.ansprechpartner,'') ILIKE '%' || $2 || '%'
             OR regexp_replace(COALESCE(f.telefon,''), '[^0-9]', '', 'g') LIKE '%' || regexp_replace($2, '[^0-9]', '', 'g') || '%')
        AND CASE
          WHEN $3 = 'alle' THEN TRUE
          WHEN $3 = 'meine' THEN f.zustaendig_agent_id = $1
          ELSE ( -- arbeit
            f.status IN ('neu', 'in_arbeit', 'wiedervorlage', 'termin')
            AND (f.zustaendig_agent_id IS NULL OR f.zustaendig_agent_id = $1)
            AND (f.wiedervorlage IS NULL OR f.wiedervorlage <= ${HEUTE_BERLIN})
          )
        END
      ORDER BY (f.wiedervorlage IS NOT NULL AND f.wiedervorlage <= ${HEUTE_BERLIN}) DESC,
               (f.global_am IS NOT NULL AND f.status IN ('termin', 'wiedervorlage')) DESC,
               f.status = 'termin' DESC, f.status = 'in_arbeit' DESC,
               f.created_at ASC
      LIMIT 80
    `, [me, q, filter]);

    const [z] = (await sqlPool`
      SELECT
        (SELECT COUNT(*)::int FROM fiaon_firmen_log
          WHERE agent_id = ${me} AND art = 'anruf'
            AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS anrufe_heute,
        (SELECT COUNT(*)::int FROM fiaon_firmen_log
          WHERE agent_id = ${me} AND ergebnis IN ('erreicht_antrag', 'erreicht_termin')
            AND created_at > date_trunc('week', NOW() AT TIME ZONE 'Europe/Berlin')) AS treffer_woche,
        (SELECT COUNT(*)::int FROM fiaon_firmen_leads WHERE status = 'neu') AS vorrat_neu,
        (SELECT COUNT(*)::int FROM fiaon_firmen_leads
          WHERE wiedervorlage IS NOT NULL AND wiedervorlage <= (NOW() AT TIME ZONE 'Europe/Berlin')::date
            AND status NOT IN ('kein_interesse', 'ungueltig', 'antrag')) AS faellig
    `) as any[];

    res.json({ ok: true, firmen: zeilen, zahlen: { ...z, ziel: FIRMEN_TAGESZIEL } });
  } catch (err) {
    console.error("[FIRMEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Import: Liste einkleben (CSV/Tab/Semikolon, kopfzeilen-tolerant) ────────
router.post("/agent/firmen/import", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const text = String(req.body?.text || "").slice(0, 400_000);
    if (!text.trim()) return res.status(400).json({ ok: false, error: "Nichts zum Einlesen." });
    const quelle = String(req.body?.quelle || "").slice(0, 120) || `Import ${req.agent!.name}`;

    let neu = 0, doppelt = 0, leer = 0;
    for (const roh of text.split(/\r?\n/)) {
      const zeile = roh.trim();
      if (!zeile) continue;
      const teile = zeile.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((t) => t.replace(/^"|"$/g, "").trim());
      const [firma, ansprechpartner, telefon, email, website, ort, branche] = teile;
      if (!firma || /^firma$/i.test(firma)) { leer += 1; continue; }
      const telNorm = (telefon || "").replace(/[^0-9+]/g, "");
      const [da] = (await sqlPool`
        SELECT id FROM fiaon_firmen_leads
        WHERE LOWER(firma) = ${firma.toLowerCase()}
          AND (regexp_replace(COALESCE(telefon, ''), '[^0-9+]', '', 'g') = ${telNorm}
               OR (COALESCE(email,'') <> '' AND LOWER(COALESCE(email,'')) = ${(email || "").toLowerCase()}))
        LIMIT 1
      `) as any[];
      if (da) { doppelt += 1; continue; }
      await sqlPool`
        INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, telefon, email, website, ort, branche, quelle)
        VALUES (${firma.slice(0, 200)}, ${ansprechpartner || null}, ${telefon || null}, ${email || null},
                ${website || null}, ${ort || null}, ${branche || null}, ${quelle})
      `;
      neu += 1;
    }
    res.json({ ok: true, neu, doppelt, uebersprungen: leer });
  } catch (err) {
    console.error("[FIRMEN] import:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Einlesen" });
  }
});

// ── Anruf-Ergebnis: EIN Klick hält alles fest ───────────────────────────────
router.post("/agent/firmen/:id/anruf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const ergebnis = String(req.body?.ergebnis || "");
    if (!ERGEBNISSE.has(ergebnis)) return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis" });
    let notiz = String(req.body?.notiz || "").slice(0, 2000) || null;
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    // ── E-476 Scheibe 5: Business-Lead? Dann Pflicht-Notiz bei „erreicht“ und „Termin“ nur mit Termin ───────────────
    // Nur für Firmen mit offener Global-Anfrage oder Quelle „global“ (Gutachten 0, Mangel 9) — Kaltakquise wie bisher.
    const takt = await import("../lib/fiaon-lead-takt");
    await takt.leadTaktBereit();
    const lead = await takt.istBusinessLead(firma).catch(() => ({ lead: false, anfrageId: null }));
    let erzaehlt: string | null = null;
    if (lead.lead) {
      const { anrufNotizPruefen, TERMIN_OHNE_KALENDER } = await import("@shared/fiaon-lead-takt");
      const p = anrufNotizPruefen({ ergebnis, istLead: true, text: req.body?.notiz, felder: req.body?.felder, einschaetzung: req.body?.einschaetzung });
      if (!p.ok) return res.status(400).json({ ok: false, error: p.error, feld: p.feld });
      if (ergebnis === "erreicht_termin" && !(await takt.terminGebuchtFuerFirma(id))) {
        return res.status(400).json({ ok: false, error: TERMIN_OHNE_KALENDER, feld: "termin", ohneTermin: true });
      }
      notiz = p.text;
      erzaehlt = p.erzaehlt;
    }

    // Wiedervorlage: Termin/Interesse → morgen; nicht erreicht → +2 Tage
    // (Staffel per Anrufzahl wäre die nächste Scheibe); Mailbox → +1.
    const wv = req.body?.wiedervorlage
      ? String(req.body.wiedervorlage).slice(0, 10)
      : ergebnis === "nicht_erreicht" ? "+2"
      : ergebnis === "mailbox" ? "+1"
      : ergebnis === "erreicht_interesse" ? "+1"
      : null;
    const status =
      ergebnis === "erreicht_antrag" ? "antrag"
      : ergebnis === "erreicht_termin" ? "termin"
      : ergebnis === "erreicht_kein_interesse" ? "kein_interesse"
      : ergebnis === "nummer_falsch" ? "ungueltig"
      : ergebnis === "erreicht_interesse" ? "in_arbeit"
      : firma.status === "neu" ? "in_arbeit" : firma.status;

    await sqlPool.unsafe(`
      UPDATE fiaon_firmen_leads SET
        status = $2,
        zustaendig_agent_id = COALESCE(zustaendig_agent_id, $3),
        letzter_kontakt = NOW(),
        wiedervorlage = CASE
          WHEN $4::text IS NULL THEN NULL
          WHEN $4 = '+1' THEN ${HEUTE_BERLIN} + 1
          WHEN $4 = '+2' THEN ${HEUTE_BERLIN} + 2
          ELSE $4::date END,
        notiz = CASE WHEN $5::text IS NULL THEN notiz ELSE CONCAT_WS(E'\n', NULLIF(notiz, ''), $5) END,
        updated_at = NOW()
      WHERE id = $1
    `, [id, status, req.agent!.id, wv, notiz]);
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'anruf', ${ergebnis}, ${notiz})
    `;
    // E-476 Scheibe 5: Was er selbst erzählt hat, steht in „Termin steht“ und in der Anruf-Karte an Justin — und der EINE
    // Stand zieht nach (Anfrage, Anruf-Auftrag, Rückruf der Vertretung).
    let stand: { anfrageStatus: string | null; auftrag: string | null } | null = null;
    if (lead.lead) {
      if (erzaehlt) {
        const { erzaehltVermerken } = await import("../lib/fiaon-lead-weg");
        await erzaehltVermerken(id, erzaehlt, { id: req.agent!.id, name: req.agent!.name });
      }
      const wvTag = wv === "+1" ? berlinPlusTage(1) : wv === "+2" ? berlinPlusTage(2) : wv && /^\d{4}-\d{2}-\d{2}$/.test(wv) ? wv : null;
      stand = await globalLeadStandSetzen({ firmaId: id, anfrageId: lead.anfrageId, ereignis: `anruf:${ergebnis}` as any, wer: { id: req.agent!.id, name: req.agent!.name }, wiedervorlage: wvTag });
    }
    res.json({ ok: true, status, lead: lead.lead, stand });
  } catch (err) {
    console.error("[FIRMEN] anruf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Die Info-Mail nach dem Gespräch — persönlich, ehrlich, mit Antragsweg ──
router.post("/agent/firmen/:id/mail", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    if (!firma.email || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(firma.email).trim())) {
      return res.status(400).json({ ok: false, error: "Keine gültige E-Mail-Adresse an der Firma." });
    }
    if (!gmailBereit()) return res.status(502).json({ ok: false, error: "Mail-Anbindung nicht bereit." });
    // Frequenzbremse (02.09.): auch B2B zählt ins Empfänger-Budget.
    const { darfAnEmpfaenger } = await import("../lib/fiaon-mail-frequenz");
    const frequenz = await darfAnEmpfaenger(String(firma.email).trim(), "firmen_info");
    if (!frequenz.ok) return res.status(429).json({ ok: false, error: `Frequenzbremse: ${frequenz.grund || "Empfänger-Budget erschöpft"}` });
    const [schon] = (await sqlPool`
      SELECT id FROM fiaon_firmen_log
      WHERE firma_id = ${id} AND art = 'mail' AND created_at > NOW() - INTERVAL '7 days' LIMIT 1
    `) as any[];
    if (schon) return res.status(409).json({ ok: false, error: "Diese Firma hat in den letzten 7 Tagen schon eine Info-Mail bekommen." });

    // ── E-476 Scheibe 4 (05.11.2026): die Regeln für Business-Leads und die Fassung nach dem letzten Anruf ──────────
    // Ein Global-Lead (offene Anfrage): nie bei einem Termin (die Bestätigung hat er), nach „nicht erreicht“ übernimmt
    // Justins Nachfass (N1), das Mail-Budget gilt; vor Justins Gespräch ohne Preisliste, mit seinem persönlichen Link.
    // Kaltakquise ohne Anfrage: wie bisher, nur ohne Institut-Satz und mit dem Einstieg passend zum Anruf.
    const [letzter] = (await sqlPool`
      SELECT ergebnis FROM fiaon_firmen_log WHERE firma_id = ${id} AND art = 'anruf' ORDER BY created_at DESC LIMIT 1`) as any[];
    const lp = await import("../lib/fiaon-global-lead-post");
    const urteil = await lp.infoMailUrteil({ email: firma.email ?? null, telefon: firma.telefon ?? null }, letzter?.ergebnis ? String(letzter.ergebnis) : null);
    if (urteil.sperre) return res.status(409).json({ ok: false, error: urteil.sperre });
    const gespraechMit = urteil.lead
      ? (await (await import("../lib/fiaon-lead-weg")).globalKalenderPerson().catch(() => null))?.person?.name || "Justin Schwarzott"
      : "";

    // E-188: Der Text steht in shared/fiaon-global-vertrieb.ts — dieselben
    // Sätze wie auf /business, Preise aus dem Katalog, durch die Wortwand geprüft.
    const istLeadFassung = urteil.lead && !!urteil.link;
    const { betreff, text } = globalInfoMail({
      ansprechpartner: firma.ansprechpartner, firma: String(firma.firma), agentName: req.agent!.name,
      art: urteil.art, lead: istLeadFassung ? { link: urteil.link!, gespraechMit } : null,
    });
    // E-476 Nachbesserung (Gutachten Sicherheit, Mangel 5): die Lead-Fassung geht nie mit einem Bank-Satz hinaus (E-468) —
    // die Wand prüft den fertigen Text; ein Fund ist ein Fehler im Code, kein Versand.
    if (istLeadFassung) {
      const { radarBankVorbehalt } = await import("@shared/fiaon-radar");
      const bank = radarBankVorbehalt(text);
      if (bank) return res.status(409).json({ ok: false, error: `Die Info-Mail enthält einen Bank-Satz („${bank.slice(0, 80)}“) — sie geht so nicht hinaus. Bitte melden.` });
    }

    // E-476 Scheibe 4 (Entscheidung 2A): im Business-Rahmen — Absendername „FIAON Global“. Nachbesserung (Gutachten Betreiber,
    // Mangel 11): Antworten an Justin (js@) nur bei einem Business-Lead (dort liest sie der Antwort-Leser); bei Kaltakquise an
    // die Firmenadresse der sendenden Person (Visitenkarte), sonst welcome@ wie bisher.
    const an = String(firma.email).trim();
    const { visitenkarteFuerAgent } = await import("@shared/fiaon-visitenkarte");
    const karte = visitenkarteFuerAgent(req.agent!.id);
    const antwortAn = urteil.lead ? { email: "js@fiaon.com", name: "Justin Schwarzott" }
      : karte?.email && /^[a-z0-9._%+-]+@fiaon\.com$/i.test(karte.email) ? { email: karte.email.toLowerCase(), name: karte.name }
        : { email: "welcome@fiaon.com", name: "FIAON Global" };
    // Nachbesserung (Gutachten Sicherheit, Mangel 4): jedes Zeichen unschädlich (auch „"“), klickbar nur fiaon.com-Adressen.
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const html = `<div dir="ltr">${text.split("\n").map((z) => `<div>${esc(z)
      .replace(/(https:\/\/(?:www\.)?fiaon\.com(?:\/[^\s<&]*)?)/g, (u) => `<a href="${u}">${u}</a>`) || "<br>"}</div>`).join("")}</div>`;
    const { neueMailSendenMitFaden } = await import("../lib/fiaon-gmail");
    await neueMailSendenMitFaden("welcome@fiaon.com", { vonName: "FIAON Global", an, betreff, text, html, antwortAn });
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'mail',
              ${`Info-Mail ${urteil.art === "erreicht" ? "nach dem Gespräch" : urteil.art === "nicht_erreicht" ? "nach „nicht erreicht“" : ""} (FIAON Global, Antworten an ${urteil.lead ? "Justin" : antwortAn.email})${urteil.lead ? " — ohne Preisliste, mit seinem Terminlink" : ""} versendet`})
    `;
    await sqlPool`UPDATE fiaon_firmen_leads SET updated_at = NOW(), zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}) WHERE id = ${id}`;
    // Im Versandprotokoll (Budget, Frequenzbremse) — und beim Global-Lead endet Justins Nachfass (eine Stimme, kein Doppel).
    if (urteil.anfrageId) await lp.infoMailVermerken(urteil.anfrageId, an, betreff).catch(() => {});
    else {
      const { mailProtokoll } = await import("../lib/fiaon-mail-log");
      await mailProtokoll({ event: "global_info", empfaenger: an, status: "versandt", ausgeloestVon: req.agent!.name, ausgeloestAgentId: req.agent!.id, payload: { versandweg: "google", postfach: "welcome@fiaon.com", firma_id: id } });
    }
    res.json({ ok: true, lead: urteil.lead });
  } catch (err: any) {
    console.error("[FIRMEN] mail:", err);
    res.status(502).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
  }
});

// ── E-188: Vom Termin zur Firma ─────────────────────────────────────────────
// Ein Erstgespräch zu FIAON Global hängt im Kalender an einer PERSON (dem
// Firmenkontakt). Die Arbeit dazu liegt aber hier, im Firmen-Cockpit. Kalender
// und Startseite springen deshalb auf /agent/firmen?person=… — und diese Route
// findet die Firma dazu. Sie MUSS vor „/agent/firmen/:id" stehen, sonst liest
// Express „zu-person" als Kennung.
router.get("/agent/firmen/zu-person/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const personId = Number(req.params.personId);
    if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });
    const [firma] = (await sqlPool`
      SELECT * FROM fiaon_firmen_leads WHERE person_id = ${personId} ORDER BY updated_at DESC LIMIT 1
    `) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Zu diesem Kontakt gibt es keine Firma im Cockpit." });
    const verlauf = (await sqlPool`
      SELECT art, ergebnis, notiz, agent_name, created_at
      FROM fiaon_firmen_log WHERE firma_id = ${firma.id}
      ORDER BY created_at DESC LIMIT 40
    `) as any[];
    res.json({ ok: true, firma, verlauf, lead: await leadStandFuerKarte(Number(firma.id), req) });
  } catch (err) {
    console.error("[FIRMEN] zu-person:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Details + Verlauf ───────────────────────────────────────────────────────
router.get("/agent/firmen/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${Number(req.params.id)}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    const verlauf = (await sqlPool`
      SELECT art, ergebnis, notiz, agent_name, created_at
      FROM fiaon_firmen_log WHERE firma_id = ${firma.id}
      ORDER BY created_at DESC LIMIT 40
    `) as any[];
    res.json({ ok: true, firma, verlauf, lead: await leadStandFuerKarte(Number(firma.id), req) });
  } catch (err) {
    console.error("[FIRMEN] detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * E-476 Scheibe 5: die Stand-Leiste eines Business-Leads (null = Kaltakquise) — und „geöffnet“ für Daniels Takt (zählt als
 * Reaktion wie ein geöffneter Auftrag; nicht Justin, nicht die Nur-Ansicht). Wirft nie.
 */
async function leadStandFuerKarte(firmaId: number, req: AgentRequest): Promise<unknown> {
  try {
    const takt = await import("../lib/fiaon-lead-takt");
    await takt.leadTaktBereit();
    void takt.geoeffnetMerken(firmaId, req.agent ? { id: req.agent.id, name: req.agent.name, ansicht: !!req.agent.ansicht } : null);
    return await takt.leadStandAnsicht(firmaId);
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-476 Scheibe 3 (05.11.2026, Entscheidung 1A): „TERMIN BEI JUSTIN EINTRAGEN“
// Daniel ruft den Lead sofort an und trägt ihn im Gespräch bei Justin ein — mit einem Klick, in Justins freien Zeiten
// (dieselben Regeln wie der Kalender auf fiaon.com: Lead-Deckel, Gesamtdeckel, Überschneidung). Pflicht ist, was der
// Lead selbst erzählt hat (zwei, drei Sätze) und die Einschätzung heiß/warm/kalt — Justin liest es in „Termin steht“
// und in der Anruf-Karte. Danach: Bestätigung an den Lead (FIAON-Global-Rahmen, Sie-Form), Daniels Auftrag zu, D2 an
// Justin. Der persönliche Terminlink des Leads (falls er angefragt hat) steht zum Kopieren dabei (z. B. für WhatsApp).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/firmen/:id/justin-zeiten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    res.setHeader("Cache-Control", "private, no-store");
    const [firma] = (await sqlPool`SELECT id, email, telefon FROM fiaon_firmen_leads WHERE id = ${Number(req.params.id)}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    const { globalAngebotLaden } = await import("../lib/fiaon-global-termin");
    const a = await globalAngebotLaden();
    // ALLE freien Zeiten (nicht die gestreute Auswahl der Website) — Daniel nimmt die, die dem Lead passt.
    const jeTag = new Map<string, string[]>();
    for (const f of a.ergebnis.frei) { if (!jeTag.has(f.tag)) jeTag.set(f.tag, []); jeTag.get(f.tag)!.push(f.zeit); }
    const lw = await import("../lib/fiaon-lead-weg");
    const anfrage = await lw.offeneAnfrageFuer(firma.email, firma.telefon).catch(() => null);
    const link = anfrage ? await lw.leadLinkFuerAnfrage(anfrage.anfrageId).catch(() => null) : null;
    res.json({
      ok: true,
      person: a.person ? { id: a.person.id, vorname: a.person.vorname, name: a.person.name } : null,
      modus: a.kalender?.modus ?? "alt",
      tage: Array.from(jeTag.entries()).sort(([x], [y]) => x.localeCompare(y)).map(([tag, zeiten]) => ({ tag, zeiten, rest: a.ergebnis.restJeTag[tag] ?? 0 })),
      grund: a.grund, anfrageId: anfrage?.anfrageId ?? null, link,
    });
  } catch (err) {
    console.error("[FIRMEN] justin-zeiten:", err);
    res.status(500).json({ ok: false, error: "Die freien Zeiten konnten nicht geladen werden." });
  }
});

router.post("/agent/firmen/:id/justin-termin", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${Number(req.params.id)}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    const b = req.body || {};
    const { erzaehltPruefen } = await import("@shared/fiaon-lead-weg");
    const pruef = erzaehltPruefen({ text: b.erzaehlt, felder: b.felder, einschaetzung: b.einschaetzung });
    if (!pruef.ok) return res.status(400).json({ ok: false, error: pruef.error, feld: pruef.feld });
    const tag = String(b.tag ?? "").trim();
    const zeit = String(b.zeit ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !/^\d{2}:\d{2}$/.test(zeit)) return res.status(400).json({ ok: false, error: "Bitte eine freie Zeit wählen.", feld: "zeit" });
    // Mail und Nummer aus dem Cockpit — im Gespräch ergänzbar (eine Firma aus einer Liste hat oft keine Mail).
    const { globalKontaktLesen, globalTerminBuchen } = await import("../lib/fiaon-global-termin");
    const kontakt = globalKontaktLesen({
      name: String(b.name ?? firma.ansprechpartner ?? "").trim() || String(firma.firma),
      firma: String(firma.firma ?? ""),
      email: String(b.email ?? firma.email ?? ""),
      telefon: String(b.telefon ?? firma.telefon ?? ""),
      land: firma.ort ?? null,
    });
    if ("error" in kontakt) {
      const satz = kontakt.feld === "email" ? "Für die Bestätigung braucht es eine E-Mail-Adresse — bitte im Gespräch erfragen und eintragen."
        : kontakt.feld === "telefon" ? "Bitte eine Telefonnummer eintragen — Justin ruft an." : "Bitte den Namen des Ansprechpartners eintragen.";
      return res.status(400).json({ ok: false, error: satz, feld: kontakt.feld });
    }
    // Hat der Lead angefragt? Dann hängt der Termin an SEINER Anfrage (über seinen Link), egal welche Mail Daniel tippt.
    const lw = await import("../lib/fiaon-lead-weg");
    const anfrage = await lw.offeneAnfrageFuer(firma.email, firma.telefon).catch(() => null)
      ?? await lw.offeneAnfrageFuer(kontakt.email, kontakt.telefon).catch(() => null);
    const link = anfrage ? await lw.leadCodeSichern(anfrage.anfrageId, { firmaId: Number(firma.id) }).catch(() => null) : null;
    const erg = await globalTerminBuchen({
      kontakt, tag, zeit, thema: null, code: link?.code ?? null,
      durch: { agentId: req.agent!.id, name: req.agent!.name, erzaehlt: pruef.text, einschaetzung: pruef.einschaetzung, firmaId: Number(firma.id) },
    });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error, grund: erg.grund, feld: erg.feld });
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${Number(firma.id)}, ${req.agent!.id}, ${req.agent!.name}, 'global', 'termin_eingetragen',
              ${`Termin bei ${erg.ansprechpartner.vorname} eingetragen: ${erg.datumText} um ${erg.uhrzeit} Uhr.`})`.catch(() => {});
    // E-476 Nachbesserung (Gutachten Betreiber, Mangel 4): Wer im Gespräch einträgt, HAT angerufen und erreicht — das zählt als
    // Anruf „erreicht — Termin vereinbart“ (Tempo-Zahl, Übersicht, Stand-Leiste), ohne zweiten Klick und ohne zweite Notiz.
    // „Was er selbst erzählt hat“ steht schon einmal (globalTerminBuchen) — hier nicht noch einmal.
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${Number(firma.id)}, ${req.agent!.id}, ${req.agent!.name}, 'anruf', 'erreicht_termin', ${pruef.text.slice(0, 2000)})`.catch(() => {});
    await sqlPool`UPDATE fiaon_firmen_leads SET status = 'termin', letzter_kontakt = NOW(), updated_at = NOW() WHERE id = ${Number(firma.id)}`.catch(() => {});
    res.json({ ok: true, terminId: erg.terminId, datumText: erg.datumText, uhrzeit: erg.uhrzeit, bei: erg.ansprechpartner.vorname, anrufEingetragen: true });
  } catch (err) {
    console.error("[FIRMEN] justin-termin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler — der Termin ist NICHT eingetragen. Bitte noch einmal versuchen." });
  }
});

router.post("/agent/firmen/:id/notiz", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Notiz zu kurz" });
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'notiz', ${text})
    `;
    await sqlPool`UPDATE fiaon_firmen_leads SET updated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIRMEN] notiz:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE KI-VORBEREITUNG — ein Klick, und Nikita weiß alles (02.09.2026 früh)
//
// Liest, wenn vorhanden, die WEBSITE der Firma (öffentlich, 6 s Deckel) und
// baut daraus mit dem Firmenwissen des Hauses eine Gesprächsvorbereitung:
// Kurzlage, drei Anknüpfungspunkte, Einstiegssatz, Fragen, Einwand-Tipp,
// passendes Paket. Ergebnis wird 7 Tage im Verlauf gecacht (art='analyse').
// Seit E-188 für FIAON Global — eine Vorbereitung aus der Bonitäts-Zeit wird
// nicht mehr aus dem Cache gereicht (siehe unten).
// EHRLICH: Ohne Website sagt die Vorbereitung, dass sie nur aus Branche/Ort
// schätzt — sie erfindet keine Fakten über die Firma.
// ═══════════════════════════════════════════════════════════════════════════

// E-476 (05.11.2026, Gutachten 0, Mangel 14): Die Website kommt aus Listen und Formularen — der Abruf läuft deshalb über
// den Netzschutz der Firmensuche (nur http/https auf 80/443, keine private oder interne Adresse, jede Weiterleitung neu
// geprüft, 6 s, 600 KB, nur Textformate) statt über ein rohes fetch mit „redirect: follow“ (das wäre ein Fernrohr ins
// eigene Netz, SSRF). Ergebnis und Kürzung bleiben wie vorher.
async function websiteText(roh: string | null): Promise<string | null> {
  if (!roh) return null;
  const url = /^https?:\/\//.test(roh) ? roh : `https://${roh}`;
  try {
    const { sicherAbrufen } = await import("../lib/firmensuche/netzschutz");
    const seite = await sicherAbrufen(url, { fristMs: 6000, maxBytes: 300_000 });
    if (seite.status < 200 || seite.status >= 300) return null;
    return seite.text
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 7000) || null;
  } catch { return null; }
}

router.post("/agent/firmen/:id/vorbereitung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    // Cache: die letzte Analyse binnen 7 Tagen genügt (erzwingen überstimmt).
    if (req.body?.erzwingen !== true) {
      const [cache] = (await sqlPool`
        SELECT notiz FROM fiaon_firmen_log
        WHERE firma_id = ${id} AND art = 'analyse' AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      // E-188: Eine Vorbereitung aus der Zeit der Business-Abos nennt ein
      // eingestelltes Paket und spricht von Firmen-Bonität — sie wird nicht mehr
      // ausgeliefert, sondern neu gerechnet. Erkannt am Paketschlüssel, nicht
      // am Datum: So stimmt es unabhängig vom Tag des Deploys.
      if (cache?.notiz && !/business_(starter|pro|ultra|enterprise)/.test(String(cache.notiz))) {
        try { return res.json({ ok: true, vorbereitung: JSON.parse(cache.notiz), quelle: "gespeichert" }); } catch { /* neu rechnen */ }
      }
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(502).json({ ok: false, error: "KI nicht eingerichtet." });
    const seite = await websiteText(firma.website);
    // E-188: Die Anweisung kommt aus shared/fiaon-global-vertrieb.ts (FIAON
    // Global statt Firmen-Bonität; Paketschlüssel und Preise aus dem Katalog).
    const system = globalVorbereitungSystem();
    const nutzer = `FIRMA: ${firma.firma}${firma.branche ? ` · Branche: ${firma.branche}` : ""}${firma.ort ? ` · Ort: ${firma.ort}` : ""}${firma.ansprechpartner ? ` · Ansprechpartner: ${firma.ansprechpartner}` : ""}${firma.notiz ? `\nNOTIZEN: ${String(firma.notiz).slice(0, 800)}` : ""}
${seite ? `WEBSITE-INHALT (${firma.website}):\n${seite}` : "KEINE Website erreichbar — arbeite mit Branche/Ort und sage das ehrlich."}`;
    const r = await openaiFetch("firmen", "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini", temperature: 0.4, max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: nutzer }],
      }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) return res.status(502).json({ ok: false, error: "KI-Vorbereitung gerade nicht möglich." });
    let v: any = null;
    try { v = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { v = null; }
    if (!v?.kurzlage) return res.status(502).json({ ok: false, error: "KI-Antwort unbrauchbar — nochmal versuchen." });
    v.mit_website = !!seite;
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'analyse', ${JSON.stringify(v).slice(0, 8000)})
    `;
    res.json({ ok: true, vorbereitung: v, quelle: seite ? "website" : "branche" });
  } catch (err: any) {
    if (istKiPause(err)) return res.status(503).json({ ok: false, error: String(err.message) }); // E-246
    console.error("[FIRMEN] vorbereitung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER ABSCHLUSS AM TELEFON — Interesse wird SOFORT ein echter Antrag
//
// Nikita füllt die Pflichtfelder gemeinsam mit dem Unternehmer aus; der
// Antrag läuft über DENSELBEN Weg wie das öffentliche Formular (Loopback auf
// POST /api/fiaon/application — Stufe-C-Muster „Vertrag am Telefon", das im
// Haus seit den Leitfäden gilt). Zurück kommen Zahlungsreferenz und
// Zahlungslink — den schickt/nennt er dem Kunden noch im Gespräch.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/firmen/:id/abschluss", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    const b = req.body || {};
    const paket = String(b.paket || "").trim().toLowerCase();
    // ── DIE PAKETE KOMMEN AUS DEM KATALOG (17.09.2026, E-188) ──────────────
    // Hier stand eine harte Liste der vier Business-Abos. Sie sind eingestellt;
    // verkauft wird FIAON Global. `verkaufbarePakete("global")` kennt genau die
    // Pakete, die heute angeboten werden — kommt ein fünftes dazu oder fällt
    // eines weg, stimmt diese Route ohne Änderung.
    const paketDef = verkaufbarePakete("global").find((x) => x.key === paket);
    if (!paketDef) return res.status(400).json({ ok: false, error: "Bitte ein FIAON-Global-Paket wählen. Die früheren Business-Abos werden nicht mehr verkauft." });
    const email = String(b.email || firma.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "Gültige E-Mail-Adresse nötig — dorthin gehen Zugang und Zahlungsdaten." });
    const vorname = String(b.vorname || "").trim();
    const nachname = String(b.nachname || "").trim();
    if (!vorname || !nachname) return res.status(400).json({ ok: false, error: "Vor- und Nachname des Ansprechpartners nötig." });

    const ref = `FIAON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const port = process.env.PORT || 5000;
    const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref, type: "business", status: "submitted", currentStep: 6,
        packKey: paket, packName: paketDef.label,
        companyName: firma.firma, legalForm: String(b.rechtsform || "").trim() || null,
        contactFirstName: vorname, contactLastName: nachname,
        contactEmail: email, email,
        contactPhone: String(b.telefon || firma.telefon || "").trim() || null,
        industry: firma.branche || null,
        street: String(b.strasse || "").trim() || null,
        zip: String(b.plz || "").trim() || null,
        city: String(b.ort || firma.ort || "").trim() || null,
        country: String(b.land || "DE").trim(),
        billingEmail: email,
        // ── KEINE ZUSTIMMUNG, DIE NIEMAND GEGEBEN HAT (17.09.2026, E-188) ──
        // Bei den Business-Abos standen hier drei „true": AGB, SCHUFA-
        // Einwilligung, Vertrag — das Muster „Vertrag am Telefon". Für FIAON
        // Global trägt es nicht: Eine SCHUFA-Einwilligung gibt es dort nicht,
        // und den Global-Vertrag (shared/fiaon-global.ts, GLOBAL_VERTRAG_VERSION)
        // hat der Kunde am Telefon nicht gesehen. Diese drei Felder stehen
        // später als BELEG in der Akte und im Forderungsdossier — ein Haken,
        // den niemand gesetzt hat, wäre ein falscher Beleg über einen Auftrag
        // von 2.499 bis 35.999 €. Der Kunde unterschreibt über den
        // Auftragslink (/business/start); die Antwort unten liefert ihn mit.
        ag1: false, ag2: false, ag3: false,
      }),
    });
    if (!antwort.ok) {
      const fehler = await antwort.text().catch(() => "");
      console.error("[FIRMEN] abschluss application:", antwort.status, fehler.slice(0, 200));
      return res.status(502).json({ ok: false, error: "Antrag konnte nicht angelegt werden." });
    }

    const [app] = (await sqlPool`
      SELECT ref, payment_reference, amount_due FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    if (!app) return res.status(502).json({ ok: false, error: "Antrag angelegt, aber nicht auffindbar — bitte in der Pipeline suchen." });

    await sqlPool`
      UPDATE fiaon_firmen_leads SET status = 'antrag', zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}),
             letzter_kontakt = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'anruf', 'erreicht_antrag',
              ${`Abschluss am Telefon: ${paketDef.label} (${(paketDef.preisCents / 100).toFixed(2)} € einmalig) — Antrag ${app.payment_reference || app.ref} angelegt`})
    `;
    res.json({
      ok: true, ref: app.ref, zahlungsreferenz: app.payment_reference,
      // Der Betrag kommt aus dem Katalog, nicht aus dem Bestellfeld (E-181) —
      // und er ist ein EINMALPREIS, keine erste Rate.
      betrag: paketDef.preisCents / 100, einmalig: !paketDef.abo, paket: paketDef.label,
      zahlungslink: app.payment_reference ? `https://fiaon.com/zahlung/${app.payment_reference}` : null,
      // Der Weg, auf dem der Kunde den Vertrag selbst unterschreibt.
      auftragslink: globalStartUrl(paket),
    });
  } catch (err: any) {
    console.error("[FIRMEN] abschluss:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
