// ═══════════════════════════════════════════════════════════════════════════
// DER WHATSAPP-RAUM (23.09.2026, E-210) — /agent/whatsapp und /chef/s/whatsapp
//
// Justin: „Wir brauchen für die Mitarbeiter, Chef und einfach jeden einen
// Bereich der WHATSAPP heißt … wo die Mitarbeiter mit den Kunden schreiben
// können (aber eben 100 % mitgedacht!), das ‚moderne' WhatsApp."
//
// EIN Raum, zwei Brillen: Der Mitarbeiter sieht die Gespräche SEINER Menschen,
// die Leitung sieht alle. Dieselben Routen, dieselbe Oberfläche — der
// Unterschied entsteht hier, nicht im Browser.
//
// Was dieser Raum anders macht als ein Chat-Fenster:
// · Das 24-Stunden-Fenster ist sichtbar und wird durchgesetzt: Ist es zu,
//   lässt der Server keinen Freitext durch, sondern nur freigegebene Vorlagen.
// · Mara und Mensch teilen sich den Tisch: Schreibt ein Mensch, pausiert Mara
//   in diesem Gespräch automatisch.
// · Wer ein Gespräch offen hat, ist für die anderen sichtbar — sonst
//   antworten zwei gleichzeitig.
// · Jede ausgehende Zeile läuft durch die Wortwand UND die WhatsApp-Richtlinie
//   (keine Mahnung, keine Forderung).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  waTabellen, waSenden, waVerlauf, waZahlen, waKonfig, sendePruefung, vorlagenStand, fensterOffen,
} from "../lib/fiaon-whatsapp";
import { WA_VORLAGEN } from "../../shared/fiaon-lead-texte";
// E-218: Gesprächsergebnisse direkt aus dem Chat buchen — dieselbe Liste
// und derselbe Weg wie in der Akte, kein zweiter Satz Ergebnisse.
import { ERGEBNISSE, ERGEBNIS_TEXT, ergebnisAnwenden, istErgebnis } from "../lib/fiaon-kontakt-ergebnis";
import { nummerFuerWhatsApp, whatsappUrteil } from "../../shared/fiaon-whatsapp-erlaubnis";

const router = Router();

/** Wer schaut — und auf wessen Gespräche darf er? */
interface Blick { agentId: number | null; name: string; alles: boolean }

/** Der Zustand eines Gesprächs: gelesen, wer sitzt dran, hört Mara mit. */
let gespraechBereit: Promise<void> | null = null;
function gespraechTabelle(): Promise<void> {
  if (!gespraechBereit) {
    gespraechBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_whatsapp_gespraech (
          nummer TEXT PRIMARY KEY,
          person_id INTEGER,
          lead_id INTEGER,
          mara_an BOOLEAN NOT NULL DEFAULT TRUE,
          gelesen_bis BIGINT NOT NULL DEFAULT 0,
          gelesen_von INTEGER,
          bearbeiter_id INTEGER,
          bearbeiter_seit TIMESTAMPTZ,
          notiz TEXT,
          antwort_text TEXT,
          antwort_faellig_am TIMESTAMPTZ,
          antwort_auf_id BIGINT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      // Nachträglich für bestehende Tabellen (23.09.2026: Maras Tempo).
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_text TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_faellig_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_auf_id BIGINT`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      gespraechBereit = null;
      throw e;
    });
  }
  return gespraechBereit;
}

async function bereit(): Promise<void> {
  await waTabellen();
  await gespraechTabelle();
}

/** Die Gespräche, die dieser Mensch sehen darf. */
async function gespraecheLaden(blick: Blick, opts: { suche?: string; filter?: string } = {}): Promise<any[]> {
  const suche = String(opts.suche ?? "").trim().toLowerCase();
  const zeilen = (await sqlPool`
    WITH letzte AS (
      SELECT DISTINCT ON (w.nummer) w.nummer, w.id, w.richtung, w.text, w.vorlage, w.status,
             COALESCE(w.empfangen_am, w.gesendet_am, w.created_at) AS am, w.person_id, w.lead_id
        FROM fiaon_whatsapp w ORDER BY w.nummer, w.id DESC
    )
    SELECT l.*,
           g.mara_an, g.gelesen_bis, g.bearbeiter_id, g.bearbeiter_seit, g.notiz,
           (SELECT COUNT(*)::int FROM fiaon_whatsapp x
             WHERE x.nummer = l.nummer AND x.richtung = 'rein' AND x.id > COALESCE(g.gelesen_bis, 0)) AS ungelesen,
           (SELECT MAX(x.empfangen_am) FROM fiaon_whatsapp x WHERE x.nummer = l.nummer AND x.richtung = 'rein') AS letzte_eingehende,
           p.id AS p_id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS p_name,
           p.assigned_agent_id,
           -- Die Stufe steht nirgends als Spalte, sie ergibt sich aus dem Antrag
           -- (Hausregel: A = Zahlung gemeldet, B = Antrag fertig, C = Lead).
           (SELECT CASE
                     WHEN bool_or(a.payment_status = 'paid') THEN 'Kunde'
                     WHEN bool_or(a.claimed_paid_at IS NOT NULL) THEN 'A'
                     WHEN bool_or(COALESCE(a.current_step, 0) >= 8) THEN 'B'
                     ELSE 'C' END
              FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL) AS p_stufe,
           le.id AS l_id, TRIM(COALESCE(le.vorname,'') || ' ' || COALESCE(le.nachname,'')) AS l_name, le.assigned_agent_id AS lead_agent,
           a.name AS betreuer
      FROM letzte l
      LEFT JOIN fiaon_persons p ON p.id = l.person_id
      LEFT JOIN fiaon_leads le ON le.id = l.lead_id
      LEFT JOIN fiaon_agents a ON a.id = COALESCE(p.assigned_agent_id, le.assigned_agent_id)
      LEFT JOIN fiaon_whatsapp_gespraech g ON g.nummer = l.nummer
     ORDER BY l.am DESC NULLS LAST
     LIMIT 300`) as any[];

  return zeilen
    .filter((z) => blick.alles || Number(z.assigned_agent_id ?? z.lead_agent ?? 0) === blick.agentId)
    .filter((z) => {
      if (opts.filter === "ungelesen") return Number(z.ungelesen || 0) > 0;
      if (opts.filter === "offen") return !!z.letzte_eingehende && Date.now() - new Date(z.letzte_eingehende).getTime() < 24 * 3600_000;
      return true;
    })
    .filter((z) => {
      if (!suche) return true;
      const heu = `${z.p_name ?? ""} ${z.l_name ?? ""} ${z.nummer} ${z.text ?? ""}`.toLowerCase();
      return heu.includes(suche);
    })
    .map((z) => zeileAlsGespraech(z));
}

function zeileAlsGespraech(z: any) {
  const letzteRein = z.letzte_eingehende ? new Date(z.letzte_eingehende).getTime() : 0;
  const fensterBis = letzteRein ? letzteRein + 24 * 3600_000 : 0;
  return {
    nummer: String(z.nummer),
    name: String(z.p_name || z.l_name || "").trim() || null,
    personId: z.p_id ? Number(z.p_id) : null,
    leadId: z.l_id ? Number(z.l_id) : null,
    stufe: z.p_stufe ?? null,
    betreuer: z.betreuer ?? null,
    letzte: {
      text: z.vorlage ? `Vorlage: ${z.vorlage}` : String(z.text ?? ""),
      richtung: z.richtung, am: z.am, status: z.status,
    },
    ungelesen: Number(z.ungelesen || 0),
    maraAn: z.mara_an !== false,
    fensterBis: fensterBis > Date.now() ? new Date(fensterBis).toISOString() : null,
    bearbeiter: z.bearbeiter_id ? { id: Number(z.bearbeiter_id), seit: z.bearbeiter_seit } : null,
    notiz: z.notiz ?? null,
  };
}

/** Darf dieser Blick auf diese Nummer? */
async function darfAnNummer(blick: Blick, nummer: string): Promise<boolean> {
  if (blick.alles) return true;
  const [z] = (await sqlPool`
    SELECT COALESCE(p.assigned_agent_id, le.assigned_agent_id) AS agent
      FROM fiaon_whatsapp w
      LEFT JOIN fiaon_persons p ON p.id = w.person_id
      LEFT JOIN fiaon_leads le ON le.id = w.lead_id
     WHERE w.nummer = ${nummer} ORDER BY w.id DESC LIMIT 1`) as any[];
  return Number(z?.agent ?? 0) === blick.agentId;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ROUTEN — einmal geschrieben, von beiden Türen benutzt
// ═══════════════════════════════════════════════════════════════════════════
function routen(hole: (req: any) => Blick) {
  const r = Router();

  /** Die Liste links. */
  r.get("/gespraeche", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      // E-214: Herrenlose Gespräche bekommen ihren Lead, bevor die Liste
      // gebaut wird — sonst steht hier eine Zeile ohne Namen, die niemandem
      // gehört und die deshalb auch niemand anruft (gefunden an Sophia Handler).
      const { verwaisteNachziehen } = await import("../lib/fiaon-whatsapp");
      await verwaisteNachziehen().catch((e) => console.error("[WHATSAPP-RAUM] nachziehen:", e));
      const gespraeche = await gespraecheLaden(blick, { suche: String(req.query.suche ?? ""), filter: String(req.query.filter ?? "") });
      const k = waKonfig();
      res.json({
        ok: true, gespraeche, zahlen: await waZahlen(),
        nummer: k.nummer, bereit: k.bereit, ich: blick.agentId, alles: blick.alles,
      });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] gespraeche:", err);
      res.status(500).json({ ok: false, error: "Die Gespräche ließen sich nicht laden." });
    }
  });

  /** Ein Gespräch: Verlauf, Kundenlage, Vorlagen. */
  r.get("/gespraech/:nummer", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.params.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });

      const verlauf = (await waVerlauf({ nummer, hoechstens: 120 })).reverse();
      const [g] = (await sqlPool`SELECT * FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`) as any[];
      const letzteId = verlauf.length ? Number(verlauf[verlauf.length - 1].id) : 0;
      // Als gelesen merken — und wer gerade dransitzt.
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, gelesen_bis, gelesen_von, bearbeiter_id, bearbeiter_seit, updated_at)
        VALUES (${nummer}, ${letzteId}, ${blick.agentId}, ${blick.agentId}, NOW(), NOW())
        ON CONFLICT (nummer) DO UPDATE SET
          gelesen_bis = GREATEST(fiaon_whatsapp_gespraech.gelesen_bis, ${letzteId}),
          gelesen_von = ${blick.agentId}, bearbeiter_id = ${blick.agentId}, bearbeiter_seit = NOW(), updated_at = NOW()`;

      // ══════════════════════════════════════════════════════════════════
      // DIE LAGE — DER FALL AUF EINEN BLICK (23.09.2026, E-218)
      //
      // Justin: „Ein Mitarbeiter soll auch darüber Vertrieb machen können,
      // wenn es ihm lieber ist."
      //
      // Dafür reicht „Name und Betreuer" nicht. Wer im Chat verkauft, braucht
      // dasselbe wie am Telefon: Stufe, Paket, was bezahlt ist, was offen ist,
      // wann zuletzt gesprochen wurde, ob ein Termin steht — und die Links,
      // die er gleich schicken will. Sonst wechselt er für jede Zahl in die
      // Akte und verliert den Faden.
      //
      // Alles kommt aus den vorhandenen Quellen; keine Zahl wird hier neu
      // gerechnet. Der Zahlungslink ist der des Hauses (/zahlung/<Referenz>),
      // der Antragslink der Kurzlink des Leads.
      // ══════════════════════════════════════════════════════════════════
      const person = verlauf.find((v: any) => v.person_id)?.person_id ?? null;
      let lage: any = null;
      if (person) {
        const [p] = (await sqlPool`
          SELECT p.id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name, p.phone, p.email,
                 p.priority_tier, p.follow_up_date, p.promised_payment_date,
                 COALESCE(p.unreachable_count, 0) AS nicht_erreicht, p.mandat_seit,
                 (SELECT CASE
                           WHEN bool_or(a.payment_status = 'paid') THEN 'Kunde'
                           WHEN bool_or(a.claimed_paid_at IS NOT NULL) THEN 'A'
                           WHEN bool_or(COALESCE(a.current_step, 0) >= 8) THEN 'B'
                           ELSE 'C' END
                    FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL) AS stufe,
                 a.name AS betreuer, p.assigned_agent_id AS betreuer_id,
                 b.ref, b.pack_name AS paket, b.payment_status AS zahlstatus, b.payment_reference AS zahlungsreferenz,
                 b.gekuendigt_am,
                 r.rate_nr, r.betrag_cents, r.faellig_am,
                 (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
                   WHERE cl.person_id = p.id AND cl.type = 'result' AND cl.voided_at IS NULL) AS letzter_kontakt,
                 (SELECT cl2.outcome FROM fiaon_contact_log cl2
                   WHERE cl2.person_id = p.id AND cl2.type = 'result' AND cl2.voided_at IS NULL
                   ORDER BY cl2.created_at DESC LIMIT 1) AS letztes_ergebnis,
                 (SELECT tm.beginn FROM fiaon_termine tm
                   WHERE tm.person_id = p.id AND tm.status = 'gebucht' AND tm.abgesagt_am IS NULL AND tm.beginn > NOW()
                   ORDER BY tm.beginn LIMIT 1) AS termin,
                 (SELECT le.link_code FROM fiaon_leads le WHERE le.person_id = p.id AND le.link_code IS NOT NULL
                   ORDER BY le.erstellt_am DESC LIMIT 1) AS link_code
            FROM fiaon_persons p
            LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
            LEFT JOIN LATERAL (
              SELECT ref, pack_name, payment_status, payment_reference, gekuendigt_am
                FROM fiaon_applications x
               WHERE x.person_id = p.id AND x.merged_into IS NULL
                 AND (x.archived_at IS NULL OR x.payment_status = 'paid')
               ORDER BY (x.pack_key IS NOT NULL AND x.ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
                        (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1
            ) b ON TRUE
            LEFT JOIN LATERAL (
              SELECT rate_nr, betrag_cents, faellig_am FROM fiaon_abo_raten ra
               WHERE ra.ref = b.ref AND ra.status = 'offen' AND ra.storniert_am IS NULL
               ORDER BY ra.faellig_am LIMIT 1
            ) r ON TRUE
           WHERE p.id = ${person}`) as any[];
        lage = p ?? null;
      }
      // Noch kein Kunde, nur ein Lead? Dann steht rechts trotzdem, wer das ist —
      // eine leere Spalte hilft niemandem am Telefon.
      if (!lage) {
        const leadId = verlauf.find((v: any) => v.lead_id)?.lead_id ?? null;
        if (leadId) {
          const [l] = (await sqlPool`
            SELECT le.id, TRIM(COALESCE(le.vorname,'') || ' ' || COALESCE(le.nachname,'')) AS name, le.email, le.telefon AS phone,
                   le.anzeige, le.kampagne, le.converted_order_id AS ref, a.name AS betreuer
              FROM fiaon_leads le LEFT JOIN fiaon_agents a ON a.id = le.assigned_agent_id WHERE le.id = ${leadId}`) as any[];
          if (l) lage = { ...l, stufe: "C", paket: null, istLead: true };
        }
      }
      const vorlagen = (await vorlagenStand().catch(() => []))
        .filter((t) => t.status === "APPROVED" && t.name.startsWith("fiaon_"))
        .map((t) => ({ ...t, ...(WA_VORLAGEN.find((v) => v.name === t.name) ?? {}) }));

      // E-218: Die Links, die der Verkäufer gleich schicken will — fertig
      // gebaut, damit niemand sie von Hand zusammensetzt und sich vertippt.
      const links = lage
        ? {
          antrag: lage.link_code ? `https://fiaon.com/a/${lage.link_code}/w` : "https://fiaon.com/start",
          zahlung: lage.zahlungsreferenz ? `https://fiaon.com/zahlung/${lage.zahlungsreferenz}` : null,
          termin: "https://fiaon.com/termin",
          bereich: "https://fiaon.com/login",
          firmen: "https://fiaon.com/global",
        }
        : { antrag: "https://fiaon.com/start", zahlung: null, termin: "https://fiaon.com/termin", bereich: "https://fiaon.com/login", firmen: "https://fiaon.com/global" };

      res.json({
        ok: true, nummer, verlauf, lage, links,
        fensterOffen: await fensterOffen(nummer),
        maraAn: g?.mara_an !== false,
        notiz: g?.notiz ?? null,
        bearbeiter: g?.bearbeiter_id ?? null,
        ich: blick.agentId,
        vorlagen,
        // E-218: Die Ergebnisse, die aus einem Chat heraus Sinn ergeben.
        ergebnisse: (ERGEBNISSE as readonly string[])
          .filter((e) => e.startsWith("erreicht") || e === "rueckruf_termin")
          .map((e) => ({ wert: e, text: (ERGEBNIS_TEXT as Record<string, string>)[e] ?? e })),
      });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] gespraech:", err);
      res.status(500).json({ ok: false, error: "Das Gespräch ließ sich nicht laden." });
    }
  });

  /** Senden — Freitext nur im offenen Fenster, sonst Vorlage. */
  r.post("/senden", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.body?.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });

      const text = String(req.body?.text ?? "").trim();
      const vorlage = String(req.body?.vorlage ?? "").trim();
      if (!text && !vorlage) return res.status(400).json({ ok: false, error: "Ohne Text geht nichts raus." });
      if (text) {
        const funde = sendePruefung(text);
        if (funde.length) return res.status(422).json({ ok: false, error: funde.join(" · ") });
      }

      const [w] = (await sqlPool`SELECT person_id, lead_id FROM fiaon_whatsapp WHERE nummer = ${nummer} ORDER BY id DESC LIMIT 1`) as any[];
      const erg = await waSenden(
        nummer,
        vorlage ? { vorlage, werte: Array.isArray(req.body?.werte) ? req.body.werte.map(String) : undefined, knopfWert: req.body?.knopfWert ? String(req.body.knopfWert) : undefined } : { text },
        { personId: w?.person_id ?? null, leadId: w?.lead_id ?? null, von: blick.name },
      );
      if (!erg.ok) return res.status(422).json({ ok: false, error: erg.grund });

      // Ein Mensch hat geschrieben → Mara hält hier die Klappe.
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, mara_an, updated_at) VALUES (${nummer}, FALSE, NOW())
        ON CONFLICT (nummer) DO UPDATE SET mara_an = FALSE, updated_at = NOW()`;
      console.log(`[WHATSAPP-RAUM] ${blick.name} hat an ${nummer} geschrieben (${vorlage || "Freitext"}).`);
      res.json({ ok: true, waId: erg.waId });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] senden:", err);
      res.status(500).json({ ok: false, error: "Das Senden ist abgebrochen." });
    }
  });

  /**
   * Menschen suchen, um ein Gespräch zu BEGINNEN. Nur wer eine Handynummer hat
   * — an ein Festnetz stellt WhatsApp nichts zu.
   */
  r.get("/suche", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const q = String(req.query.q ?? "").trim();
      if (q.length < 2) return res.json({ ok: true, treffer: [] });
      const wie = `%${q.toLowerCase()}%`;
      const ziffern = q.replace(/[^\d]/g, "");
      const personen = (await sqlPool`
        SELECT p.id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name, p.phone, p.assigned_agent_id, a.name AS betreuer
          FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
         WHERE p.phone IS NOT NULL
           AND (LOWER(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,''))) LIKE ${wie}
                OR (${ziffern || null}::text IS NOT NULL AND regexp_replace(p.phone, '[^0-9]', '', 'g') LIKE ${"%" + ziffern}))
         ORDER BY p.updated_at DESC NULLS LAST LIMIT 25`.catch(() => [])) as any[];
      const leads = (await sqlPool`
        SELECT le.id, TRIM(COALESCE(le.vorname,'') || ' ' || COALESCE(le.nachname,'')) AS name, le.telefon AS phone,
               le.assigned_agent_id, le.person_id, a.name AS betreuer
          FROM fiaon_leads le LEFT JOIN fiaon_agents a ON a.id = le.assigned_agent_id
         WHERE le.telefon IS NOT NULL AND le.person_id IS NULL
           AND (LOWER(TRIM(COALESCE(le.vorname,'') || ' ' || COALESCE(le.nachname,''))) LIKE ${wie}
                OR (${ziffern || null}::text IS NOT NULL AND regexp_replace(le.telefon, '[^0-9]', '', 'g') LIKE ${"%" + ziffern}))
         ORDER BY le.erstellt_am DESC LIMIT 25`.catch(() => [])) as any[];

      const treffer = [...personen.map((p) => ({ ...p, art: "person" })), ...leads.map((l) => ({ ...l, art: "lead" }))]
        .filter((t) => blick.alles || Number(t.assigned_agent_id ?? 0) === blick.agentId)
        .map((t) => ({ ...t, urteil: whatsappUrteil({ telefon: t.phone }) }))
        .filter((t) => t.urteil.moeglich)
        .slice(0, 20)
        .map((t) => ({
          art: t.art, id: Number(t.id), name: String(t.name || "").trim() || "(ohne Namen)",
          nummer: t.urteil.nummer, betreuer: t.betreuer ?? null,
        }));
      res.json({ ok: true, treffer });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] suche:", err);
      res.status(500).json({ ok: false, error: "Die Suche ist abgebrochen." });
    }
  });

  /** Ein neues Gespräch beginnen — nur mit freigegebener Vorlage (Fenster ist zu). */
  r.post("/starten", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.body?.nummer);
      const vorlage = String(req.body?.vorlage ?? "").trim();
      if (!nummer || !vorlage) return res.status(400).json({ ok: false, error: "Nummer und Vorlage werden gebraucht." });
      const personId = Number(req.body?.personId) || null;
      const leadId = Number(req.body?.leadId) || null;

      if (!blick.alles) {
        const [z] = (await sqlPool`
          SELECT COALESCE(
            (SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${personId}),
            (SELECT assigned_agent_id FROM fiaon_leads WHERE id = ${leadId})) AS agent`) as any[];
        if (Number(z?.agent ?? 0) !== blick.agentId) return res.status(403).json({ ok: false, error: "Dieser Mensch gehört einem anderen Betreuer." });
      }
      const erg = await waSenden(
        nummer, { vorlage, werte: Array.isArray(req.body?.werte) ? req.body.werte.map(String) : undefined },
        { personId, leadId, von: blick.name },
      );
      if (!erg.ok) return res.status(422).json({ ok: false, error: erg.grund });
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, lead_id, mara_an, updated_at)
        VALUES (${nummer}, ${personId}, ${leadId}, TRUE, NOW())
        ON CONFLICT (nummer) DO UPDATE SET person_id = COALESCE(EXCLUDED.person_id, fiaon_whatsapp_gespraech.person_id), updated_at = NOW()`;
      console.log(`[WHATSAPP-RAUM] ${blick.name} beginnt ein Gespräch mit ${nummer} (${vorlage}).`);
      res.json({ ok: true, nummer });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] starten:", err);
      res.status(500).json({ ok: false, error: "Das Gespräch ließ sich nicht beginnen." });
    }
  });

  /** Die freigegebenen Vorlagen — für das neue Gespräch. */
  r.get("/vorlagen", async (_req: any, res: Response) => {
    try {
      const v = (await vorlagenStand().catch(() => []))
        .filter((t) => t.status === "APPROVED" && t.name.startsWith("fiaon_"))
        .map((t) => ({ ...t, ...(WA_VORLAGEN.find((x) => x.name === t.name) ?? {}) }));
      res.json({ ok: true, vorlagen: v, inPruefung: (await vorlagenStand().catch(() => [])).filter((t) => t.status === "PENDING").length });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Die Vorlagen ließen sich nicht laden." });
    }
  });

  /**
   * VORLAGEN AUFRÄUMEN UND NEU EINREICHEN (23.09.2026, E-214)
   *
   * Justin: „Die META-Vorlagen sind Müll, kannst alle löschen!"
   *
   * Ein Knopf, zwei Schritte in der richtigen Reihenfolge: erst löschen, was
   * nicht mehr im Quelltext steht, dann einreichen, was fehlt. Andersherum
   * würde der Löschlauf die frisch eingereichten nicht antreffen — aber der
   * Vorlagenmanager stünde zwischendurch voll mit Altlasten.
   *
   * Ohne `{ ausfuehren: true }` ist es eine PROBE: Sie sagt, was verschwinden
   * würde, und fasst nichts an. Löschen bei Meta ist endgültig.
   */
  r.post("/vorlagen/aufraeumen", async (req: any, res: Response) => {
    try {
      const ausfuehren = req.body?.ausfuehren === true;
      const { vorlagenAufraeumen, vorlagenEinreichen } = await import("../lib/fiaon-whatsapp");
      const weg = await vorlagenAufraeumen({ probe: !ausfuehren });
      const neu = ausfuehren ? await vorlagenEinreichen() : { eingereicht: [], schonDa: [], fehler: [] };
      res.json({ ok: true, probe: !ausfuehren, geloescht: weg.geloescht, behalten: weg.behalten, loeschFehler: weg.fehler, ...neu });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] vorlagen aufräumen:", err);
      res.status(500).json({ ok: false, error: "Das Aufräumen ist abgebrochen — bei Meta wurde nichts verändert." });
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // AUS DEM CHAT HERAUS VERKAUFEN (23.09.2026, E-218)
  //
  // Justin: „Ein Mitarbeiter soll auch darüber Vertrieb machen können, wenn es
  // ihm lieber ist — schau, dass da alles 100 % funktioniert."
  //
  // Verkaufen heißt nicht nur schreiben. Es heißt: das Ergebnis festhalten,
  // damit die Pipeline es weiß; eine Wiedervorlage setzen; das Gespräch
  // übernehmen, damit niemand doppelt schreibt. Ohne das ist der Raum ein
  // hübsches Chatfenster, dessen Arbeit nirgends ankommt.
  //
  // Gebucht wird über `ergebnisAnwenden` — DENSELBEN Weg wie in der Akte.
  // Ein zweiter Buchungsweg wäre ein zweiter Satz Regeln für Wiedervorlage,
  // Zusage und Nicht-erreicht-Staffel.
  // ══════════════════════════════════════════════════════════════════════
  r.post("/gespraech/:nummer/ergebnis", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.params.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });
      const ergebnis = String(req.body?.ergebnis ?? "");
      if (!istErgebnis(ergebnis)) return res.status(400).json({ ok: false, error: "Dieses Ergebnis kennen wir nicht." });

      const [g] = (await sqlPool`SELECT person_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`) as any[];
      const personId = Number(g?.person_id ?? 0) || null;
      if (!personId) return res.status(409).json({ ok: false, error: "Zu diesem Gespräch gibt es noch keinen Menschen im System." });

      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      await ergebnisAnwenden({
        ref: a?.ref ?? null, personId, ergebnis: ergebnis as any,
        zusageDatum: /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.zusageDatum ?? "")) ? String(req.body.zusageDatum) : null,
        terminDatum: String(req.body?.terminDatum ?? "") || null,
      });
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${a?.ref ?? null}, ${personId}, ${blick.agentId}, ${blick.name}, 'system',
                ${`Ergebnis „${(ERGEBNIS_TEXT as Record<string, string>)[ergebnis] ?? ergebnis}" aus dem WhatsApp-Gespräch gebucht.`}, NOW())`.catch(() => {});
      console.log(`[WHATSAPP-RAUM] ${blick.name} bucht ${ergebnis} für Person ${personId}.`);
      res.json({ ok: true });
    } catch (err) {
      console.error("[WHATSAPP-RAUM] ergebnis:", err);
      res.status(500).json({ ok: false, error: "Das Ergebnis ließ sich nicht buchen." });
    }
  });

  /** Das Gespräch übernehmen — damit nicht zwei gleichzeitig hineinschreiben. */
  r.post("/gespraech/:nummer/uebernehmen", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.params.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, bearbeiter_id, bearbeiter_seit, updated_at)
        VALUES (${nummer}, ${blick.agentId}, NOW(), NOW())
        ON CONFLICT (nummer) DO UPDATE SET bearbeiter_id = ${blick.agentId}, bearbeiter_seit = NOW(), updated_at = NOW()`;
      res.json({ ok: true, bearbeiter: blick.agentId });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Das ließ sich nicht übernehmen." });
    }
  });

  /** Mara in diesem Gespräch an- oder abschalten. */
  r.post("/mara", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.body?.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });
      const an = req.body?.an === true;
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, mara_an, updated_at) VALUES (${nummer}, ${an}, NOW())
        ON CONFLICT (nummer) DO UPDATE SET mara_an = ${an}, updated_at = NOW()`;
      res.json({ ok: true, an });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
    }
  });

  /** Eine Notiz am Gespräch (nur intern, der Kunde sieht sie nie). */
  r.post("/notiz", async (req: any, res: Response) => {
    try {
      await bereit();
      const blick = hole(req);
      const nummer = nummerFuerWhatsApp(req.body?.nummer);
      if (!nummer) return res.status(400).json({ ok: false, error: "Ungültige Nummer." });
      if (!(await darfAnNummer(blick, nummer))) return res.status(403).json({ ok: false, error: "Dieses Gespräch gehört einem anderen Betreuer." });
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, notiz, updated_at) VALUES (${nummer}, ${String(req.body?.notiz ?? "").slice(0, 500) || null}, NOW())
        ON CONFLICT (nummer) DO UPDATE SET notiz = ${String(req.body?.notiz ?? "").slice(0, 500) || null}, updated_at = NOW()`;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: "Die Notiz ließ sich nicht speichern." });
    }
  });

  return r;
}

// ── Tür 1: die Mitarbeiter (nur die eigenen Menschen) ──────────────────────
router.use("/agent/whatsapp", requireAgent, routen((req: AgentRequest) => ({
  agentId: req.agent?.id ?? null,
  name: req.agent?.first_name || req.agent?.name || "Mitarbeiter",
  alles: req.agent?.rolle === "vertriebsleiter",
})));

// ── Tür 2: die Leitung (alles) ─────────────────────────────────────────────
router.use("/chef/whatsapp", requireChef("leitung"), routen((req: ChefRequest) => ({
  agentId: req.chef?.agentId ?? null,
  name: "Leitung",
  alles: true,
})));

export default router;
