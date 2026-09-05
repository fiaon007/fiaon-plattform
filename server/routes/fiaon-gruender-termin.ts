import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import {
  rohSlots, slotsVerknappen, terminBuchen, stornoLink, verfuegbarkeitVon,
  TerminFehler, HORIZONT_TAGE, QUELLEN, berlinDatum, berlinWochentag, type Slot,
} from "../lib/fiaon-termine";
import { personFuerZeile } from "../fiaon-person-model";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { buchungMelden } from "../lib/fiaon-termin-meldung";
import { anrufHinweisSie, ABSAGE_HINWEIS_SIE } from "../../shared/fiaon-termin-text";

// ═══════════════════════════════════════════════════════════════════════════
// /justin — die Buchungsseite des Gründers (05.09.2026, E-124)
//
// Justin: „Bau für mich, den Founder und CEO, eine eigene ‚Calendly'-Seite,
// wo die Leute bei mir einen Termin buchen können — maximal drei Termine am
// Tag, die wählbar sind."
//
// KEIN LOGIN, KEIN TOKEN. Wer die Adresse hat, darf buchen — genau wie bei
// Calendly. Was die Seite anbietet, kommt aus derselben Buchungstabelle wie
// jeder andere Termin (fiaon_agent_verfuegbarkeit), belegte Zeiten aus
// fiaon_termine. Der Termin landet als quelle „gruender" in Justins Kalender,
// die Bestätigung geht über die Hausvorlage, Justin bekommt die übliche
// Meldung mit dem Anliegen.
//
// DER DECKEL: Je Tag stehen höchstens DREI Zeiten zur Wahl — gleichmäßig über
// die Sprechzeit gestreut (erste, mittlere, letzte). Jede Buchung des Tages
// zieht eine Zeit ab: Nach drei Buchungen ist der Tag zu. So ist „maximal
// drei Termine am Tag" in beiden Lesarten wahr — drei wählbar UND drei
// buchbar.
//
// WAS DIE SEITE BEWUSST NICHT TUT: Sie macht Justin nicht zum Betreuer des
// Buchenden (kein buchungAnwenden). Ein Partner, Investor oder Journalist
// gehört in keinen Vertriebsvorrat, und ein Kunde, der den Gründer sprechen
// will, bleibt bei seinem Betreuer.
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();

/** Vorgaben — jede über fiaon_settings übersteuerbar (gruender_termin_*). */
const VORGABE = {
  agentId: 928,           // Justin Schwarzott (justin@fiaon.com)
  proTag: 3,              // wählbare UND buchbare Zeiten je Tag
  vorlaufStunden: 4,      // frühestens in vier Stunden — kein Anruf aus dem Nichts
  titel: "Gründer & Geschäftsführer",
};

const DAUER = QUELLEN.gruender.minuten;

async function einstellungen(): Promise<typeof VORGABE> {
  const zeilen = (await sqlPool`
    SELECT key, value FROM fiaon_settings WHERE key LIKE 'gruender_termin_%'
  `.catch(() => [])) as { key: string; value: string }[];
  const map = new Map(zeilen.map((z) => [z.key, String(z.value ?? "")]));
  const zahl = (k: string, vorgabe: number, min: number, max: number) => {
    const n = Number(map.get(k));
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : vorgabe;
  };
  return {
    agentId: zahl("gruender_termin_agent_id", VORGABE.agentId, 1, 1_000_000),
    proTag: zahl("gruender_termin_pro_tag", VORGABE.proTag, 1, 12),
    vorlaufStunden: zahl("gruender_termin_vorlauf_stunden", VORGABE.vorlaufStunden, 0, 72),
    titel: map.get("gruender_termin_titel") || VORGABE.titel,
  };
}

interface Gruender { id: number; vorname: string; name: string; bild: string | null; email: string | null }

async function gruenderLesen(agentId: number): Promise<Gruender | null> {
  const [a] = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, avatar, email, active
    FROM fiaon_agents WHERE id = ${agentId}
  `) as any[];
  if (!a || !a.active) return null;
  const bild = typeof a.avatar === "string" && a.avatar.startsWith("data:image/") ? a.avatar : null;
  return { id: Number(a.id), vorname: String(a.vorname), name: String(a.name), bild, email: a.email ?? null };
}

interface Tag { datum: string; zeiten: number; sprechzeit: boolean }

interface Angebot {
  gruender: Gruender | null;
  slots: Slot[];
  tage: Tag[];
  proTag: number;
}

/**
 * Das Angebot: freie Zeiten aus Sprechzeit minus Belegung, je Tag auf den
 * Deckel gebracht.
 *
 * rohSlots kennt Belegung nur als „gleicher Beginn". Ein 20-Minuten-Termin
 * um 10:00 sperrt dort nur den 10:00-Platz — der 09:30-Platz eines
 * 30-Minuten-Gesprächs würde bis 10:00 laufen und den Termin überlappen.
 * Deshalb prüft diese Seite Überschneidungen selbst, gegen alle Termine
 * Justins mit ihrer echten Dauer.
 */
export async function angebot(): Promise<Angebot> {
  const e = await einstellungen();
  const g = await gruenderLesen(e.agentId);
  if (!g) return { gruender: null, slots: [], tage: [], proTag: e.proTag };

  const roh = await rohSlots([{ id: g.id, vorname: g.vorname }], DAUER, sqlPool, e.vorlaufStunden * 3600_000);

  const termine = (await sqlPool`
    SELECT beginn, COALESCE(dauer_min, 20) AS dauer_min, quelle, status,
           (beginn AT TIME ZONE 'Europe/Berlin')::date::text AS tag
    FROM fiaon_termine
    WHERE agent_id = ${g.id}
      AND (status IN ('gebucht', 'erledigt', 'verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
      AND beginn > NOW() - INTERVAL '1 day' AND beginn < NOW() + INTERVAL '16 days'
  `) as { beginn: Date; dauer_min: number; quelle: string; status: string; tag: string }[];

  const frei = roh.filter((s) => {
    const b = Date.parse(s.beginn);
    const bis = b + DAUER * 60_000;
    return !termine.some((t) => {
      const tb = new Date(t.beginn).getTime();
      const te = tb + Math.max(5, Number(t.dauer_min)) * 60_000;
      return b < te && bis > tb;
    });
  });

  // Gebuchte Gründergespräche je Tag ziehen vom Deckel ab.
  const gebucht = new Map<string, number>();
  for (const t of termine) {
    if (t.quelle !== "gruender" || t.status !== "gebucht") continue;
    gebucht.set(t.tag, (gebucht.get(t.tag) ?? 0) + 1);
  }

  const jeTag = new Map<string, Slot[]>();
  for (const s of frei) {
    if (!jeTag.has(s.datum)) jeTag.set(s.datum, []);
    jeTag.get(s.datum)!.push(s);
  }

  const slots: Slot[] = [];
  for (const datum of Array.from(jeTag.keys()).sort()) {
    const rest = e.proTag - (gebucht.get(datum) ?? 0);
    if (rest <= 0) continue;
    slots.push(...slotsVerknappen(jeTag.get(datum)!, rest));
  }

  // Die Tagesleiste: jeder Tag im Horizont, auch die ohne Zeiten — damit die
  // Seite sagen kann, WARUM ein Tag leer ist (Wochenende vs. ausgebucht).
  const fenster = (await verfuegbarkeitVon(g.id)).filter((f) => f.aktiv);
  const sprechtage = new Set(fenster.map((f) => f.wochentag));
  const tage: Tag[] = [];
  for (let i = 0; i <= HORIZONT_TAGE; i++) {
    const datum = berlinDatum(new Date(Date.now() + i * 86_400_000));
    const zeiten = slots.filter((s) => s.datum === datum).length;
    tage.push({ datum, zeiten, sprechzeit: sprechtage.has(berlinWochentag(datum)) });
  }

  return { gruender: g, slots, tage, proTag: e.proTag };
}

// ── GET /gruender-termin — das Angebot ──────────────────────────────────────
router.get("/gruender-termin", async (_req: Request, res: Response) => {
  try {
    const e = await einstellungen();
    const a = await angebot();
    if (!a.gruender) return res.status(503).json({ ok: false, error: "Die Buchung ist im Moment nicht möglich." });
    res.json({
      ok: true,
      gruender: { vorname: a.gruender.vorname, name: a.gruender.name, titel: e.titel, bild: a.gruender.bild },
      slots: a.slots,
      tage: a.tage,
      slotMinuten: DAUER,
      horizontTage: HORIZONT_TAGE,
      proTag: a.proTag,
    });
  } catch (err) {
    console.error("[GRUENDER-TERMIN] angebot:", err);
    res.status(500).json({ ok: false, error: "Die freien Zeiten konnten nicht geladen werden. Bitte laden Sie die Seite neu." });
  }
});

// ── Bremse: drei Buchungen je Adresse in 15 Minuten, eine je E-Mail je Minute ─
const jeIp = new Map<string, number[]>();
const jeMail = new Map<string, number>();

function zuViel(ip: string, email: string): boolean {
  const jetzt = Date.now();
  const liste = (jeIp.get(ip) ?? []).filter((t) => jetzt - t < 15 * 60_000);
  if (liste.length >= 3) return true;
  if (jetzt - (jeMail.get(email) ?? 0) < 60_000) return true;
  liste.push(jetzt); jeIp.set(ip, liste); jeMail.set(email, jetzt);
  return false;
}

// ── POST /gruender-termin/buchen ────────────────────────────────────────────
router.post("/gruender-termin/buchen", async (req: Request, res: Response) => {
  const b = req.body || {};
  // Honigtopf: Das Feld „website" ist für Menschen unsichtbar. Wer es füllt,
  // bekommt ein freundliches Ja und keinen Termin.
  if (String(b.website ?? "").trim()) return res.json({ ok: true, termin: null });

  const anrede = ["Herr", "Frau"].includes(String(b.anrede)) ? String(b.anrede) : null;
  const vorname = String(b.vorname ?? "").trim().slice(0, 80);
  const nachname = String(b.nachname ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 160);
  const telefon = String(b.telefon ?? "").trim().slice(0, 40);
  const thema = String(b.thema ?? "").trim().slice(0, 80);
  const nachricht = String(b.nachricht ?? "").trim().slice(0, 2000);
  const beginn = String(b.beginn ?? "");

  const fehl = (text: string, status = 400, grund = "eingabe") => res.status(status).json({ ok: false, error: text, grund });

  if (vorname.length < 2 || nachname.length < 2) return fehl("Bitte geben Sie Vor- und Nachnamen an.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fehl("Bitte geben Sie eine gültige E-Mail-Adresse an.");
  if (telefon.replace(/\D/g, "").length < 6) return fehl("Bitte geben Sie eine Telefonnummer an — Justin ruft Sie an.");
  if (!beginn || isNaN(Date.parse(beginn))) return fehl("Bitte wählen Sie zuerst eine Zeit.");

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
  if (zuViel(ip, email)) return fehl("Bitte versuchen Sie es in einer Minute noch einmal.", 429, "zu_schnell");

  try {
    const a = await angebot();
    if (!a.gruender) return fehl("Die Buchung ist im Moment nicht möglich.", 503, "kein_angebot");
    const gewuenscht = new Date(beginn).toISOString();
    const slot = a.slots.find((s) => s.beginn === gewuenscht);
    if (!slot) {
      return fehl(a.slots.length
        ? "Diese Zeit ist gerade vergeben worden — bitte wählen Sie eine andere."
        : "Diese Zeit ist gerade vergeben worden, und im Moment ist keine weitere frei. Bitte versuchen Sie es in ein paar Tagen noch einmal.",
      409, "nicht_angeboten");
    }

    // Die Person: bekannt über E-Mail oder Telefon, sonst neu — ohne Betreuer.
    const zu = await personFuerZeile({
      emails: [email],
      phones: [telefon],
      stammdaten: { first_name: vorname, last_name: nachname, primary_email: email, primary_phone: telefon, kind: "private" },
      quelle: "gruender-seite",
      firstSeenAt: new Date(),
    });
    if (!zu) return fehl("Bitte geben Sie eine E-Mail-Adresse und eine Telefonnummer an.");

    const [schon] = (await sqlPool`
      SELECT id, beginn FROM fiaon_termine
      WHERE person_id = ${zu.personId} AND agent_id = ${a.gruender.id} AND quelle = 'gruender'
        AND status = 'gebucht' AND beginn > NOW()
      ORDER BY beginn LIMIT 1
    `) as any[];
    if (schon) {
      const { berlinDatumText, berlinUhrzeit } = await import("../lib/fiaon-termine");
      return fehl(`Sie haben bereits einen Termin mit Justin am ${berlinDatumText(schon.beginn)} um ${berlinUhrzeit(schon.beginn)} Uhr. `
        + "Zum Verschieben nutzen Sie bitte den Link in Ihrer Bestätigungs-E-Mail.", 409, "schon_gebucht");
    }

    const buchung = await terminBuchen({
      personId: zu.personId,
      agentId: a.gruender.id,
      beginn: slot.beginn,
      quelle: "gruender",
      herkunft: "gruender_seite",
    });

    const notiz = [
      anrede ? `Anrede: ${anrede}` : "",
      thema ? `Anliegen: ${thema}` : "",
      nachricht,
      `Gebucht über fiaon.com/justin (${zu.angelegt ? "neuer Kontakt" : "bekannte Person"}).`,
    ].filter(Boolean).join("\n");
    await sqlPool`UPDATE fiaon_termine SET notiz = ${notiz}, updated_at = NOW() WHERE id = ${buchung.id}`.catch(() => {});

    const [akte] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${zu.personId} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `.catch(() => [])) as any[];
    if (akte?.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
        VALUES (${zu.personId}, ${akte.ref}, NULL, 'System', 'system',
                ${`Gründergespräch gebucht über fiaon.com/justin: ${buchung.datumText} um ${buchung.uhrzeit} Uhr.${thema ? ` Anliegen: ${thema}.` : ""}`})
      `.catch(() => {});
    }

    const wer = a.gruender.name;
    await versendenUndProtokollieren(
      "termin_bestaetigung",
      {
        email, vorname, nachname,
        agent_vorname: wer,
        termin_datum: buchung.datumText,
        termin_uhrzeit: buchung.uhrzeit,
        termin_art: QUELLEN.gruender.text,
        storno_link: stornoLink(buchung.stornoToken),
        hinweis_anruf: anrufHinweisSie(wer),
        hinweis_absage: ABSAGE_HINWEIS_SIE,
      },
      {
        personId: zu.personId,
        verlaufRef: akte?.ref ?? null,
        verlaufText: `Terminbestätigung (Gründergespräch) versandt: ${buchung.datumText} um ${buchung.uhrzeit} Uhr.`,
      },
    ).catch((e) => console.error("[GRUENDER-TERMIN] Bestätigung:", e));

    await buchungMelden(buchung.id, buchung.beginn, "gruender")
      .catch((e) => console.error("[GRUENDER-TERMIN] Meldung an Justin:", e));

    console.log(`[GRUENDER-TERMIN] #${buchung.id}: ${vorname} ${nachname} (${email}) am ${buchung.datumText} ${buchung.uhrzeit}${thema ? ` — ${thema}` : ""}`);
    res.json({
      ok: true,
      termin: {
        beginn: buchung.beginn, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
        stornoToken: buchung.stornoToken, agentName: wer,
      },
    });
  } catch (err) {
    if (err instanceof TerminFehler) return fehl(err.message, 409, err.code);
    console.error("[GRUENDER-TERMIN] buchen:", err);
    fehl("Da ist bei uns etwas schiefgelaufen — nicht bei Ihnen. Bitte versuchen Sie es noch einmal.", 500, "serverfehler");
  }
});

export default router;
