import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import {
  rohSlots, slotsVerknappen, terminBuchen, stornoLink, verfuegbarkeitVon, terminTokenPruefen,
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
  agentId: 928,           // Justin Schwarzott (js@fiaon.com)
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

/** Das Konto, auf das /justin bucht (E-201: die Telefonkartei zeigt diese Termine als „deine"). */
export async function gruenderAgentId(): Promise<number> {
  return (await einstellungen()).agentId;
}

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
    SELECT beginn, COALESCE(dauer_min, 20) AS dauer_min, quelle, status, herkunft,
           (beginn AT TIME ZONE 'Europe/Berlin')::date::text AS tag
    FROM fiaon_termine
    WHERE agent_id = ${g.id}
      AND (status IN ('gebucht', 'erledigt', 'verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
      AND beginn > NOW() - INTERVAL '1 day' AND beginn < NOW() + INTERVAL '16 days'
  `) as { beginn: Date; dauer_min: number; quelle: string; status: string; herkunft: string | null; tag: string }[];

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
  // E-476 Scheibe 3 (Gutachten 0, Mangel 2): der GESAMTDECKEL — /justin-Gespräche und Lead-Gespräche (Global-Kalender,
  // persönlicher Link, Cockpit, /justin-Weiche) zusammen höchstens global_kalender_gesamt_pro_tag (Vorgabe 5) je Tag.
  // Startgespräche zahlender Kunden zählen nicht mit (sie sperren nur ihre Zeit — oben, Überschneidung).
  const { zaehltAufGesamtDeckel } = await import("@shared/fiaon-lead-weg");
  const { leadWegEinstellungen } = await import("../lib/fiaon-lead-weg");
  const gesamtProTag = (await leadWegEinstellungen().catch(() => null))?.gesamtProTag ?? null;
  const gesamt = new Map<string, number>();
  for (const t of termine) if (zaehltAufGesamtDeckel(t)) gesamt.set(t.tag, (gesamt.get(t.tag) ?? 0) + 1);

  const jeTag = new Map<string, Slot[]>();
  for (const s of frei) {
    if (!jeTag.has(s.datum)) jeTag.set(s.datum, []);
    jeTag.get(s.datum)!.push(s);
  }

  const slots: Slot[] = [];
  for (const datum of Array.from(jeTag.keys()).sort()) {
    const rest = Math.min(e.proTag - (gebucht.get(datum) ?? 0), gesamtProTag == null ? Infinity : gesamtProTag - (gesamt.get(datum) ?? 0));
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

// ── DER PERSÖNLICHE LINK (21.09.2026, E-201) ────────────────────────────────
// Justin schickt aus der Telefonkartei „nicht erreicht" per WhatsApp und Mail
// mit /justin?k=<Token>. Der Token ist derselbe signierte Personen-Token wie
// bei /termin/:token (30 Tage). Er füllt Name, E-Mail und Telefon vor — der
// Kunde soll sich „direkt mit Namen und so vorausgefüllt" eintragen — und die
// Buchung landet sicher an DIESER Person, auch wenn er eine andere Adresse
// eintippt. Ohne gültigen Token bleibt die Seite, was sie war.
async function vorlageAusLink(k: unknown): Promise<{ personId: number; anrede: string; vorname: string; nachname: string; email: string; telefon: string } | null> {
  const t = terminTokenPruefen(k);
  if (!t || t.abgelaufen) return null;
  const [p] = (await sqlPool`
    SELECT p.id, p.anrede, p.first_name, p.last_name, p.contact_name, p.primary_email, p.primary_phone,
           a.first_name AS a_vorname, a.last_name AS a_nachname, a.email AS a_email, a.phone AS a_phone,
           l.vorname AS l_vorname, l.nachname AS l_nachname, l.email AS l_email, l.telefon AS l_telefon
    FROM fiaon_persons p
    LEFT JOIN LATERAL (SELECT first_name, last_name, email, phone FROM fiaon_applications
                        WHERE person_id = p.id AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1) a ON TRUE
    LEFT JOIN LATERAL (SELECT vorname, nachname, email, telefon FROM fiaon_leads
                        WHERE person_id = p.id ORDER BY erstellt_am DESC LIMIT 1) l ON TRUE
    WHERE p.id = ${t.personId} AND p.merged_into_person_id IS NULL
  `.catch(() => [])) as any[];
  if (!p) return null;
  const s = (...w: unknown[]) => String(w.find((x) => String(x ?? "").trim()) ?? "").trim();
  return {
    personId: Number(p.id),
    anrede: ["Herr", "Frau"].includes(String(p.anrede)) ? String(p.anrede) : "",
    vorname: s(p.first_name, p.a_vorname, p.l_vorname, p.contact_name),
    nachname: s(p.last_name, p.a_nachname, p.l_nachname),
    email: s(p.primary_email, p.a_email, p.l_email),
    telefon: s(p.primary_phone, p.a_phone, p.l_telefon),
  };
}

// ── GET /gruender-termin — das Angebot ──────────────────────────────────────
router.get("/gruender-termin", async (req: Request, res: Response) => {
  try {
    const e = await einstellungen();
    const a = await angebot();
    if (!a.gruender) return res.status(503).json({ ok: false, error: "Die Buchung ist im Moment nicht möglich." });
    const v = req.query.k ? await vorlageAusLink(req.query.k) : null;
    res.json({
      ok: true,
      gruender: { vorname: a.gruender.vorname, name: a.gruender.name, titel: e.titel, bild: a.gruender.bild },
      slots: a.slots,
      tage: a.tage,
      slotMinuten: DAUER,
      horizontTage: HORIZONT_TAGE,
      proTag: a.proTag,
      vorlage: v ? { anrede: v.anrede, vorname: v.vorname, nachname: v.nachname, email: v.email, telefon: v.telefon } : null,
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

// ── E-476 Scheibe 3: die /justin-Weiche — ein Business-Lead bucht als Global-Gespräch ──────────────
type WeicheErgebnis =
  | { ok: true; termin: { beginn: string; datumText: string; uhrzeit: string; stornoToken: string; agentName: string } }
  | { ok: false; status: number; error: string; grund: string };

async function weicheBuchen(ein: {
  gruender: Gruender; slot: Slot; anfrageId: number; firmaId: number | null;
  anrede: string | null; vorname: string; nachname: string; email: string; telefon: string; thema: string; nachricht: string;
  personIdAusLink: number | null;
}): Promise<WeicheErgebnis> {
  const { firmaBrauchbar } = await import("@shared/fiaon-global-lead");
  const lw = await import("../lib/fiaon-lead-weg");
  const { LEAD_GESPRAECH_HERKUENFTE, LEAD_DECKEL_HERKUENFTE, JUSTIN_WEICHE_HERKUNFT, tagesRest } = await import("@shared/fiaon-lead-weg");
  const { ensureHerkunftSpalte, berlinDatumText, berlinUhrzeit } = await import("../lib/fiaon-termine");
  const [anfrage] = (await sqlPool`SELECT name, firma, text FROM fiaon_anfragen WHERE id = ${ein.anfrageId}`) as any[];
  const name = `${ein.vorname} ${ein.nachname}`.trim();
  const firmaRoh = String(anfrage?.firma ?? "").trim();
  const firma = firmaRoh && firmaBrauchbar(firmaRoh, name).brauchbar ? firmaRoh : "";
  const en = /^Sprache:\s*Englisch/m.test(String(anfrage?.text ?? ""));

  const zu = ein.personIdAusLink
    ? { personId: ein.personIdAusLink, angelegt: false }
    : await personFuerZeile({
      emails: [ein.email], phones: [ein.telefon],
      stammdaten: {
        kind: "business", first_name: ein.vorname, last_name: ein.nachname, company_name: firma || null,
        contact_name: name, primary_email: ein.email, primary_phone: ein.telefon,
      },
      quelle: "gruender-seite-global", firstSeenAt: new Date(),
    });
  if (!zu) return { ok: false, status: 400, error: "Bitte geben Sie eine E-Mail-Adresse und eine Telefonnummer an.", grund: "eingabe" };

  // Hat er schon ein kommendes Gespräch (über die Person ODER Mail/Nummer — Gutachten Betreiber, Mangel 1)? Datum und Uhrzeit nur
  // mit Justins persönlichem Link — sonst neutral (Gutachten Sicherheit, Mangel 11: kein Orakel über fremde Termine).
  const schonGebucht = async (q: any) => {
    const [schon] = (await q`
      SELECT id, beginn FROM fiaon_termine
       WHERE person_id = ${zu.personId} AND quelle IN ('gruender', 'global') AND status = 'gebucht' AND beginn > NOW()
       ORDER BY beginn LIMIT 1`) as any[];
    if (schon) return schon as { beginn: Date };
    return await lw.kommenderTerminFuerKontakt(ein.email, ein.telefon, q).catch(() => null);
  };
  const schonFehler = (schon: { beginn: Date }): WeicheErgebnis => ({
    ok: false, status: 409, grund: "schon_gebucht",
    error: ein.personIdAusLink
      ? `Sie haben bereits einen Termin mit Justin am ${berlinDatumText(schon.beginn)} um ${berlinUhrzeit(schon.beginn)} Uhr. Zum Verschieben nutzen Sie bitte den Link in Ihrer Bestätigungs-E-Mail.`
      : "Zu Ihren Angaben ist schon ein Termin eingetragen — den Link zum Verschieben finden Sie in Ihrer Bestätigungs-E-Mail.",
  });
  const schon = await schonGebucht(sqlPool);
  if (schon) return schonFehler(schon);

  const e = await lw.leadWegEinstellungen();
  await ensureHerkunftSpalte();
  let buchung;
  let schonInTx: { beginn: Date } | null = null;
  try {
    buchung = await sqlPool.begin(async (tx: any) => {
      // Nachbesserung (Gutachten Technik, Mangel 6): zuerst die Sperre je LEAD — zwei gleichzeitige Buchungen derselben Anfrage
      // laufen nacheinander, die zweite sieht die erste.
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-lead:${ein.anfrageId}`}))`;
      const nochmal = await schonGebucht(tx);
      if (nochmal) { schonInTx = nochmal; throw new TerminFehler("schon_gebucht", "Er hat schon ein Gespräch."); }
      // Dieselbe Sperre je Person und Tag wie der Global-Kalender und das Startgespräch (Gutachten 0, Mangel 2).
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-termin:${ein.gruender.id}:${ein.slot.datum}`}))`;
      // Nachbesserung (Gutachten Technik, Mangel 5; Entscheidung 1A „höchstens drei Global-Gespräche am Tag“): die Weiche zählt
      // auf den Lead-Deckel UND den Gesamtdeckel (tagesRest) — wie der Kalender auf fiaon.com.
      const [z] = (await tx`
        SELECT COUNT(*) FILTER (WHERE quelle = 'global' AND COALESCE(herkunft, '') = ANY(${LEAD_DECKEL_HERKUENFTE as unknown as string[]}))::int AS lead,
               COUNT(*) FILTER (WHERE quelle = 'gruender' OR (quelle = 'global' AND COALESCE(herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})))::int AS gesamt
          FROM fiaon_termine
         WHERE agent_id = ${ein.gruender.id} AND status IN ('gebucht', 'erledigt', 'verpasst')
           AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${ein.slot.datum}::date`) as any[];
      if (tagesRest({ leadProTag: e.leadProTag, gesamtProTag: e.gesamtProTag, leadGebucht: Number(z?.lead ?? 0), gesamtGebucht: Number(z?.gesamt ?? 0) }) <= 0) {
        throw new TerminFehler("tag_voll", "An diesem Tag sind alle Gespräche vergeben.");
      }
      const neu = await terminBuchen({ personId: zu.personId, agentId: ein.gruender.id, beginn: ein.slot.beginn, quelle: "global", herkunft: JUSTIN_WEICHE_HERKUNFT }, tx);
      // Die Zeile des Lead-Gesprächs gleich mit (Sicherungspunkt — fehlt die Tabelle, bleibt der Termin).
      await tx.savepoint(async (sp: any) => sp`
        INSERT INTO fiaon_lead_gespraech (termin_id, anfrage_id, firma_id, person_id, weg) VALUES (${neu.id}, ${ein.anfrageId}, ${ein.firmaId}, ${zu.personId}, 'justin')
        ON CONFLICT (termin_id) DO NOTHING`).catch(() => {});
      return neu;
    });
  } catch (err) {
    if (err instanceof TerminFehler && err.code === "schon_gebucht" && schonInTx) return schonFehler(schonInTx);
    if (err instanceof TerminFehler) {
      return { ok: false, status: 409, grund: err.code, error: err.code === "tag_voll"
        ? "An diesem Tag sind alle Gespräche vergeben — bitte wählen Sie einen anderen Tag."
        : err.code === "belegt" ? "Diese Zeit ist gerade vergeben worden — bitte wählen Sie eine andere." : err.message };
    }
    throw err;
  }

  // Ab hier steht der Termin — nichts Folgendes darf ihn kippen.
  const notiz = [
    `Firma: ${firma || `${name} (Firma offen)`}`,
    `Ansprechpartner: ${ein.anrede ? `${ein.anrede} ` : ""}${name} · ${ein.telefon} · ${ein.email}`,
    ein.thema ? `Anliegen: ${ein.thema}` : "",
    ein.nachricht,
    en ? "Sprache: Englisch" : "",
    `Business-Lead (Anfrage #${ein.anfrageId}) — über fiaon.com/justin gebucht und als Global-Gespräch geführt (${zu.angelegt ? "neuer Kontakt" : "bekannte Person"}).`,
  ].filter(Boolean).join("\n");
  await sqlPool`UPDATE fiaon_termine SET notiz = ${notiz}, updated_at = NOW() WHERE id = ${buchung.id}`.catch(() => {});

  let firmaId = ein.firmaId;
  try {
    const { globalLeadAufnehmen } = await import("./fiaon-firmen");
    const { globalZustaendig } = await import("../lib/fiaon-global-termin");
    const z = await globalZustaendig().catch(() => null);
    const f = await globalLeadAufnehmen({
      firma: firma || `${name} (Firma offen)`, ansprechpartner: name, telefon: ein.telefon, email: ein.email, personId: zu.personId,
      zustaendigAgentId: z?.id ?? null, status: "termin", ereignis: "termin_gebucht", firmaId: ein.firmaId,
      verlauf: `Gespräch mit ${ein.gruender.name} über fiaon.com/justin gebucht: ${buchung.datumText} um ${buchung.uhrzeit} Uhr (Global-Gespräch).${ein.thema ? ` Anliegen: ${ein.thema}.` : ""}`,
    });
    firmaId = f.firmaId;
  } catch (e) {
    console.error(`[GRUENDER-TERMIN] Weiche: Termin ${buchung.id} steht, aber der Firmen-Lead fehlt:`, e);
  }

  const { globalTerminPayload } = await import("../lib/fiaon-global-termin");
  // E-476 Scheibe 4: SEINE Sätze aus dem Formular (Sie-Form, ohne Betrag) — wie bei jeder Lead-Bestätigung.
  const angaben = await import("../lib/fiaon-global-lead-post")
    .then((m) => m.antwortenDerAnfrage(ein.anfrageId))
    .then(async (a) => (await import("@shared/fiaon-global-lead-texte")).angabenSatz(a, en ? "en" : "de"))
    .catch(() => "");
  await versendenUndProtokollieren(
    "global_termin",
    globalTerminPayload({
      email: ein.email, name, firma: firma || name, telefon: ein.telefon, paketText: null,
      ansprechpartner: ein.gruender.name, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
      stornoToken: buchung.stornoToken, sprache: en ? "en" : "de", beginn: buchung.beginn, paket: null, angabenSatz: angaben, lead: true,
    }) as any,
    { personId: zu.personId, verlaufText: `Terminbestätigung (FIAON Global, Gespräch mit dem Gründer) versandt: ${buchung.datumText} um ${buchung.uhrzeit} Uhr.` },
  ).catch((e) => console.error("[GRUENDER-TERMIN] Weiche: Bestätigung:", e));

  // Nachbesserung (Gutachten Technik, Mangel 7): angestoßen, nie abgewartet (Eingang), ohne Tabellen-Anweisung — die Zeile steht
  // schon (Transaktion). Danach „Termin steht“ (D2) im Faden des Leads statt der üblichen Termin-Meldung (Gutachten 0, Mangel 19).
  void lw.leadGespraechVerknuepfen({ terminId: buchung.id, anfrageId: ein.anfrageId, firmaId, personId: zu.personId, weg: "justin", beginn: buchung.beginn, schema: false })
    .then(() => lw.terminStehtAnstossen(buchung.id))
    .catch((e) => console.error(`[GRUENDER-TERMIN] Weiche: Lead-Gespräch ${buchung.id} nicht vermerkt:`, String(e).slice(0, 160)));
  console.log(`[GRUENDER-TERMIN] #${buchung.id}: Business-Lead (Anfrage #${ein.anfrageId}) über /justin → Global-Gespräch am ${buchung.datumText} ${buchung.uhrzeit}`);
  return { ok: true, termin: { beginn: buchung.beginn, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit, stornoToken: buchung.stornoToken, agentName: ein.gruender.name } };
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

  // E-476 Nachbesserung (Gutachten Sicherheit, Mangel 7): die echte Adresse (cf-connecting-ip) — X-Forwarded-For setzt der Aufrufer selbst.
  const { aufrufClientIp } = await import("../lib/fiaon-global-angebot-aufrufe");
  const ip = aufrufClientIp(req as any);
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

    // Die Person: aus Justins persönlichem Link (E-201), sonst bekannt über
    // E-Mail oder Telefon, sonst neu — ohne Betreuer.
    const ausLink = b.k ? await vorlageAusLink(b.k) : null;

    // ── E-476 Scheibe 3: DIE /justin-WEICHE ─────────────────────────────────
    // Passt Mail ODER Telefon zu einer Global-Anfrage der letzten 60 Tage, ist das ein Business-Lead — die Buchung wird
    // ein Global-Gespräch bei Justin (Person „business“, Bestätigung im FIAON-Global-Rahmen in Sie-Form, Erinnerungen am
    // Vortag und eine Stunde vorher, Ergebnis-Pflicht, Anruf-Karte an Justin) und hängt an der Anfrage; Daniels Auftrag
    // schließt sich selbst. Sonst bleibt /justin, wie es ist. Dieselbe Sperre je Person und Tag wie der Global-Kalender.
    const { offeneAnfrageFuer } = await import("../lib/fiaon-lead-weg");
    const weiche = await offeneAnfrageFuer(email, telefon).catch(() => null);
    if (weiche) {
      const w = await weicheBuchen({
        gruender: a.gruender, slot, anfrageId: weiche.anfrageId, firmaId: weiche.firmaId,
        anrede, vorname, nachname, email, telefon, thema, nachricht, personIdAusLink: ausLink?.personId ?? null,
      });
      if (!w.ok) return fehl(w.error, w.status, w.grund);
      return res.json({ ok: true, termin: w.termin });
    }
    const zu = ausLink
      ? { personId: ausLink.personId, angelegt: false }
      : await personFuerZeile({
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

    // E-476 Nachbesserung (Gutachten Technik, Mangel 5): dieselbe Sperre je Person und Tag wie der Global-Kalender und die Weiche,
    // und der Gesamtdeckel (/justin + Lead-Gespräche) neu gezählt IN der Transaktion — zwei gleichzeitige Buchungen überschreiten
    // ihn nie.
    const { ensureHerkunftSpalte } = await import("../lib/fiaon-termine");
    const { LEAD_GESPRAECH_HERKUENFTE } = await import("@shared/fiaon-lead-weg");
    const gesamtProTag = (await (await import("../lib/fiaon-lead-weg")).leadWegEinstellungen().catch(() => null))?.gesamtProTag ?? null;
    await ensureHerkunftSpalte();
    const buchung = await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-termin:${a.gruender!.id}:${slot.datum}`}))`;
      if (gesamtProTag != null) {
        const [z] = (await tx`
          SELECT COUNT(*)::int AS n FROM fiaon_termine
           WHERE agent_id = ${a.gruender!.id} AND status IN ('gebucht', 'erledigt', 'verpasst')
             AND (quelle = 'gruender' OR (quelle = 'global' AND COALESCE(herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})))
             AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${slot.datum}::date`) as any[];
        if (Number(z?.n ?? 0) >= gesamtProTag) throw new TerminFehler("tag_voll", "An diesem Tag sind alle Gespräche vergeben — bitte wählen Sie einen anderen Tag.");
      }
      return terminBuchen({
        personId: zu.personId,
        agentId: a.gruender!.id,
        beginn: slot.beginn,
        quelle: "gruender",
        herkunft: ausLink ? "gruender_link" : "gruender_seite",
      }, tx);
    });

    const notiz = [
      anrede ? `Anrede: ${anrede}` : "",
      thema ? `Anliegen: ${thema}` : "",
      nachricht,
      ausLink
        ? `Gebucht über Justins persönlichen Link (Telefonkartei)${email !== ausLink.email.toLowerCase() || telefon !== ausLink.telefon ? ` — angegeben: ${email}, ${telefon}` : ""}.`
        : `Gebucht über fiaon.com/justin (${zu.angelegt ? "neuer Kontakt" : "bekannte Person"}).`,
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
        // E-263 (29.09.2026): „In Ihren Kalender: Apple / Outlook · Google Kalender".
        ...(await import("../lib/fiaon-kalender-abo").then((k) => k.kundenKalenderFelder({ stornoToken: buchung.stornoToken, beginn: buchung.beginn, dauerMin: DAUER })).catch(() => ({}))),
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
