// ═══════════════════════════════════════════════════════════════════════════
// MARA BEANTWORTET ANLIEGEN AUS DEM KUNDENBEREICH — DER SERVER HANDELT (19.10.2026, E-406 C1)
//
// Justin (Vorschlag 3 „Mara führt den Betrieb“, Etappe C): Kunden schreiben im Kundenbereich unter „Hilfe &
// Anliegen“ (fiaon_tickets). Bis heute antwortete nur ein Mensch über /agent/anliegen — im Schnitt nach 85 Stunden
// (Messung 19.10.). Jetzt antwortet Mara selbst, mit DERSELBEN Maschine wie im Postfach:
//   Einordnung (einordnenMitMerker, Riegel) → Agent (antwortErzeugen, Kanal „anliegen“: Akte, Kundenweg, Werkzeuge,
//   genannter Termin, zahlung_suchen, angaben_aendern) → Antwortprüfung (Wortwand, Belege, Ton, Links, E-248, E-369)
//   → menschNoetig (Anwalt/Behörde, Widerruf, Rückrufwunsch) → E-393-Sperre (kuendigungSendeUrteil).
// Die Antwort erscheint dort, wo eine Menschen-Antwort erscheint: am Anliegen im Kundenbereich, im Verlauf der Akte
// (contact_log kunde_anliegen_antwort) und als Benachrichtigung (Push „Antwort auf Ihr Anliegen“). Status:
// „beantwortet“ — ein Mensch kann es weiter erledigen oder nachlegen.
//
// Die Regeln stehen rein in shared/fiaon-mara-anliegen.ts (Prüfstand scripts/pruef-mara-anliegen.ts). Hier:
//   · anliegenAntwortSpeichern — die EINE Stelle, an der eine Antwort gespeichert wird (Mensch UND Mara).
//   · anliegenBearbeiten       — ein Anliegen (mit den übrigen offenen desselben Menschen als Bündel).
//   · anliegenTakt             — der Takt alle 5 Minuten (server/routes.ts), höchstens ANLIEGEN_JE_TAKT.
//   · anliegenStand / anliegenSchalterSetzen — Schalter und Zahlen fürs Mara-Steuerpult.
// Prüfstand mit Datenbank: scripts/pruef-mara-anliegen-db.ts (Modell als Attrappe).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  ANLIEGEN_SCHALTER, ANLIEGEN_DIENST, ANLIEGEN_TAG_EURO_VORGABE, ANLIEGEN_JE_TAKT, ANLIEGEN_VERSUCHE,
  anliegenSchalterAn, anliegenHeikel, heikelAusEinordnung, anliegenUrteil, anliegenSendeUrteil, anliegenKnopfErlaubt,
  anliegenAlterTage, anliegenBuendelTeilen, anliegenHandPruefung, ANLIEGEN_MAX_TAGE,
  HEIKEL_NAME, type AnliegenHeikel, type AnliegenUrteil,
} from "@shared/fiaon-mara-anliegen";
import { imVersandfenster } from "@shared/fiaon-nicht-erreicht-nachfass";

type Lauf = typeof sqlPool;

// ── TABELLE ─────────────────────────────────────────────────────────────────
let schemaBereit: Promise<void> | null = null;
/**
 * Die Mara-Spalten an fiaon_tickets (idempotent). Die Tabelle selbst legt fiaon-tickets.ts an — hier dieselbe DDL
 * vorab, damit der Takt auch auf einer frischen Datenbank läuft.
 *   mara_stand    beantwortet | entwurf | mensch | fehler (NULL = noch nicht angefasst)
 *   mara_grund    ein kurzer Satz (warum nicht, oder was die Prüfung sagte)
 *   mara_heikel   die Art (Kündigung, Beschwerde …), wenn heikel — sperrt auch spätere Anliegen desselben Menschen
 *   mara_entwurf  Maras Vorschlag, wenn sie nicht selbst antworten durfte (auf /agent/anliegen übernehmbar)
 *   mara_einordnung  der Merker der Einordnung (E-401: einmal je Text, nicht je Takt)
 *   mara_werkzeuge   die Werkzeuge, die in Maras Lauf zum Vorschlag wirklich liefen (decken dessen Zusagen, wenn ein
 *                    Mensch ihn übernimmt — anliegenHandPruefen)
 *   antwort_knopf {text,url} — der Knopf unter der Antwort im Kundenbereich (Zahlungsseite, Terminlink, Bereich)
 *   beantwortet_durch  'mara' | 'mensch'
 */
export function anliegenSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_tickets (
          id SERIAL PRIMARY KEY, ref VARCHAR NOT NULL, person_id INTEGER, agent_id INTEGER, betreff VARCHAR NOT NULL,
          text TEXT NOT NULL, status VARCHAR NOT NULL DEFAULT 'offen', antwort TEXT, beantwortet_am TIMESTAMPTZ,
          beantwortet_von INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await lauf`ALTER TABLE fiaon_tickets
        ADD COLUMN IF NOT EXISTS mara_stand TEXT,
        ADD COLUMN IF NOT EXISTS mara_grund TEXT,
        ADD COLUMN IF NOT EXISTS mara_heikel TEXT,
        ADD COLUMN IF NOT EXISTS mara_entwurf TEXT,
        ADD COLUMN IF NOT EXISTS mara_einordnung JSONB,
        ADD COLUMN IF NOT EXISTS mara_werkzeuge JSONB,
        ADD COLUMN IF NOT EXISTS mara_versuche INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS mara_am TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS mara_in_arbeit_seit TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS antwort_knopf JSONB,
        ADD COLUMN IF NOT EXISTS beantwortet_durch TEXT`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_tickets_mara_idx ON fiaon_tickets (status, mara_stand) WHERE status = 'offen'`;
    })().catch((e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

// ── DIE EINE STELLE, AN DER EINE ANTWORT GESPEICHERT WIRD ──────────────────
export interface AntwortVon {
  /** Mensch: seine Kennung und sein Name; Mara: null und ihr Name. */
  agentId: number | null;
  agentName: string;
  /** Wie der Kunde den Absender in der Benachrichtigung liest („Frau Lombardi“, „Mara“). */
  nennName: string;
  durch: "mara" | "mensch";
}

/**
 * Die Antwort speichern — Anliegen, Verlauf der Akte (kunde_anliegen_antwort), Benachrichtigung (Push
 * „antwort_anliegen“, den es seit dem Kundenbereich gibt, der bisher aber nie gesendet wurde). Für Mara nur, solange
 * das Anliegen offen und unbeantwortet ist (`nurWennOffen`) — hat ein Mensch inzwischen geantwortet, gewinnt er.
 * Liefert null, wenn nichts gespeichert wurde.
 */
export async function anliegenAntwortSpeichern(ein: {
  id: number; antwort: string; von: AntwortVon; erledigt?: boolean; nurWennOffen?: boolean;
  knopf?: { text: string; url: string } | null;
}, lauf: Lauf = sqlPool): Promise<{ ref: string; betreff: string; personId: number | null } | null> {
  await anliegenSchema(lauf);
  const knopf = ein.knopf && anliegenKnopfErlaubt(ein.knopf.url) ? { text: String(ein.knopf.text).slice(0, 80), url: String(ein.knopf.url).slice(0, 600) } : null;
  // E-406 Nachbesserung: lauf.json — JSON.stringify(…) mit „::jsonb“ legte einen TEXT ab (jsonb_typeof = string); der
  // Kundenbereich (Hilfe.tsx, knopfOk) las darin keine url und zeigte den Knopf nie.
  const status = ein.erledigt ? "erledigt" : "beantwortet";
  const [t] = (ein.nurWennOffen
    ? await lauf`
        UPDATE fiaon_tickets SET antwort = ${ein.antwort}, beantwortet_am = NOW(), beantwortet_von = ${ein.von.agentId},
               status = ${status}, antwort_knopf = ${knopf ? lauf.json(knopf as any) : null}, beantwortet_durch = ${ein.von.durch},
               updated_at = NOW()
         WHERE id = ${ein.id} AND status = 'offen' AND antwort IS NULL
         RETURNING ref, betreff, person_id`
    : await lauf`
        UPDATE fiaon_tickets SET antwort = ${ein.antwort}, beantwortet_am = NOW(), beantwortet_von = ${ein.von.agentId},
               agent_id = COALESCE(agent_id, ${ein.von.agentId}), status = ${status},
               antwort_knopf = ${knopf ? lauf.json(knopf as any) : null}, beantwortet_durch = ${ein.von.durch}, updated_at = NOW()
         WHERE id = ${ein.id}
         RETURNING ref, betreff, person_id`) as any[];
  if (!t) return null;
  await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
    VALUES (${t.ref}, ${t.person_id ?? null}, ${ein.von.agentId}, ${ein.von.agentName}, 'kunde_anliegen_antwort',
            ${`Antwort auf Anliegen #${ein.id} (${t.betreff}):\n${ein.antwort}`}, NOW())`.catch(() => {});
  if (t.person_id) {
    const { pushBeiEreignis } = await import("./fiaon-push");
    void pushBeiEreignis(Number(t.person_id), "antwort_anliegen", { name: ein.von.nennName }).catch(() => {});
  }
  return { ref: String(t.ref), betreff: String(t.betreff), personId: t.person_id != null ? Number(t.person_id) : null };
}

/** Der Name eines Mitarbeiters, wie der Kunde ihn liest („Frau Lombardi“) — nie der Vorname allein. */
export async function nennNameVon(agentId: number, lauf: Lauf = sqlPool): Promise<string> {
  const [a] = (await lauf`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
  if (!a) return "Ihr FIAON-Team";
  const { nennform } = await import("@shared/fiaon-mitarbeiter-name");
  return nennform(a).nom;
}

/**
 * Vor jeder Antwort eines MITARBEITERS im Anliegen (POST /agent/tickets/:id/antwort, E-406 Nachbesserung): E-393 und
 * Wortwand wie in der Zentrale — auch für Maras Vorschlag nach „Vorschlag übernehmen“. Die Regeln stehen rein in
 * anliegenHandPruefung; hier nur das Lesen (Text, Betreff, Maras Einordnung, Vorschlag und Werkzeuge, Kündigung
 * vorgemerkt?). Lesefehler: geprüft wird trotzdem, nur ohne diese Angaben.
 */
export async function anliegenHandPruefen(id: number, antwort: string, lauf: Lauf = sqlPool): Promise<{ ok: true } | { ok: false; grund: string }> {
  await anliegenSchema(lauf).catch(() => {});
  const [t] = (await lauf`
    SELECT ref, betreff, text, mara_einordnung, mara_entwurf, mara_werkzeuge FROM fiaon_tickets WHERE id = ${id}`.catch(() => [])) as any[];
  const json = (w: unknown): any => { if (typeof w !== "string") return w ?? null; try { return JSON.parse(w); } catch { return null; } };
  let merker = json(t?.mara_einordnung);
  if (typeof merker === "string") merker = json(merker);
  const roh = (merker && typeof merker === "object" ? (merker.roh ?? merker) : {}) as { flags?: Record<string, unknown>; kategorien?: string[] };
  const werkzeuge = json(t?.mara_werkzeuge);
  const [k] = t?.ref ? (await lauf`SELECT 1 AS ja FROM cancellation_requests WHERE ref = ${String(t.ref)} LIMIT 1`.catch(() => [])) as any[] : [];
  // E-396 (Integration E-406 Welle 1): Kulanz-Satz nur beim Jahresvertrag — wie Zentrale, Postfach und Nachholen.
  const kulanzErlaubt = t?.ref ? await (await import("./fiaon-kuendigung")).kulanzSatzErlaubt(String(t.ref), null).catch(() => null) : null;
  return anliegenHandPruefung({
    antwort, eingang: t?.text ?? null, betreff: t?.betreff ?? null,
    flags: roh.flags && typeof roh.flags === "object" ? roh.flags : null,
    kategorien: Array.isArray(roh.kategorien) ? roh.kategorien.map(String) : null,
    kuendigungInAkte: !!k, maraEntwurf: t?.mara_entwurf ?? null,
    maraWerkzeuge: Array.isArray(werkzeuge) ? werkzeuge.map(String) : [],
    kulanzErlaubt,
  });
}

// ── SCHALTER, DECKEL ────────────────────────────────────────────────────────
/** Der Schalter (fiaon_settings.mara_anliegen). Fehlt er: AN. Lesefehler: AUS (lieber keine Antwort). */
export async function anliegenSchalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${ANLIEGEN_SCHALTER}`) as any[];
    return anliegenSchalterAn(z?.value);
  } catch { return false; }
}
export async function anliegenSchalterSetzen(an: boolean, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`INSERT INTO fiaon_settings (key, value) VALUES (${ANLIEGEN_SCHALTER}, ${an ? "an" : "aus"})
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
export function anliegenDeckelEuro(): number {
  const n = Number(process.env.ANLIEGEN_TAG_EURO || ANLIEGEN_TAG_EURO_VORGABE);
  return Number.isFinite(n) && n >= 0 ? n : ANLIEGEN_TAG_EURO_VORGABE;
}
async function deckelErreicht(): Promise<boolean> {
  const { kostenHeute } = await import("./fiaon-postmeister-schema");
  const heute = await kostenHeute(ANLIEGEN_DIENST).catch(() => 0);
  return heute > anliegenDeckelEuro();
}

// ── EIN ANLIEGEN BEARBEITEN ─────────────────────────────────────────────────
export type AnliegenErgebnis =
  | { art: "warten"; grund: string }
  | { art: "nie"; grund: string }
  | { art: "mensch"; grund: string; heikel: AnliegenHeikel | null }
  | { art: "beantwortet"; grund: string; mitgenommen: number[] }
  | { art: "entwurf"; grund: string }
  | { art: "fehler"; grund: string }
  | { art: "weg"; grund: string };

const tageAlt = anliegenAlterTage;
const datumDe = (d: Date) => d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Ein Anliegen (das jüngste offene eines Menschen) — samt den übrigen offenen, unbeantworteten Anliegen desselben
 * Menschen als Bündel: Mara antwortet EINMAL, unter dem jüngsten; die älteren bekommen einen kurzen Verweis darauf.
 * Wirft nie (außer bei Programmfehlern im Aufrufer); die KI-Pause legt das Anliegen still zurück.
 */
export async function anliegenBearbeiten(id: number, opt: { jetzt?: Date; ohneSchalter?: boolean } = {}, lauf: Lauf = sqlPool): Promise<AnliegenErgebnis> {
  await anliegenSchema(lauf);
  const jetzt = opt.jetzt ?? new Date();
  const [t] = (await lauf`
    SELECT t.*, p.id AS p_id, COALESCE(p.merged_into_person_id, p.id) AS pid, p.ist_test_am, p.first_name, p.last_name, p.primary_email
      FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.id = ${id}`) as any[];
  if (!t) return { art: "weg", grund: "Anliegen nicht gefunden" };
  if (String(t.status) !== "offen" || t.antwort != null) return { art: "weg", grund: "schon beantwortet oder erledigt" };
  const personId: number | null = t.pid != null ? Number(t.pid) : null;

  // Alle offenen, unbeantworteten, von Mara noch nicht entschiedenen Anliegen desselben Menschen. Das Bündel daraus
  // sind nur die nicht zu alten (E-406 Nachbesserung: anliegenBuendelTeilen) — zu alte bleiben beim Menschen.
  const offenAlle = personId
    ? ((await lauf`
        SELECT t.id, t.ref, t.betreff, t.text, t.created_at, t.mara_stand
          FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
         WHERE COALESCE(p.merged_into_person_id, t.person_id) = ${personId}
           AND t.status = 'offen' AND t.antwort IS NULL
           AND (t.mara_stand IS NULL OR t.mara_stand = 'fehler' OR t.id = ${id})
         ORDER BY t.created_at ASC, t.id ASC`) as any[])
    : [t];
  const { buendel, zuAlt } = anliegenBuendelTeilen(offenAlle.length ? offenAlle : [t], jetzt);
  const leit = buendel[buendel.length - 1] ?? t;
  const leitId = Number(leit.id);
  const ids = buendel.map((b: any) => Number(b.id));
  const zuAltIds = zuAlt.map((b: any) => Number(b.id));
  const freigeben = async () => { await lauf`UPDATE fiaon_tickets SET mara_in_arbeit_seit = NULL WHERE id = ANY(${Array.from(new Set([...ids, id]))}::int[])`.catch(() => {}); };
  const setzen = async (stand: string, grund: string, felder: { heikel?: AnliegenHeikel | null; entwurf?: string | null; versuche?: boolean; nur?: number[] } = {}) => {
    const welche = felder.nur ?? ids;
    await lauf`
      UPDATE fiaon_tickets SET mara_stand = ${stand}, mara_grund = ${grund.slice(0, 400)}, mara_heikel = ${felder.heikel ?? null},
             mara_entwurf = ${felder.entwurf ?? null}, mara_am = NOW(), mara_in_arbeit_seit = NULL,
             mara_versuche = mara_versuche + ${felder.versuche ? 1 : 0}
       WHERE id = ANY(${welche}::int[]) AND status = 'offen' AND antwort IS NULL`;
  };

  // ── Die Fakten für das Urteil ──
  const schalterAn = opt.ohneSchalter ? true : await anliegenSchalterLesen(lauf);
  const { kiPausiert } = await import("./fiaon-ki-pause");
  const kiPause = await kiPausiert().catch(() => true);
  const deckel = await deckelErreicht().catch(() => true);
  const { istGlobalKunde } = await import("./fiaon-global-kunde");
  // Vorsichtig: Ist die Global-Prüfung gestört, gilt er als Global-Kunde (lieber keine Antwort als eine falsche).
  const global = personId ? await istGlobalKunde(personId).catch(() => true) : false;
  const test = !!t.ist_test_am || /^(FIAON-TEST|FIA-DEV-|FIAON-P-TEST)/i.test(String(t.ref ?? ""));
  const [heute] = personId ? (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
     WHERE COALESCE(p.merged_into_person_id, t.person_id) = ${personId} AND t.beantwortet_durch = 'mara'
       AND t.beantwortet_am > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'`) as any[] : [{ n: 0 }];
  // Heikel: jeder Text des Bündels — ein zu altes offenes Anliegen mit Heiklem (das beim Menschen bleibt) — und ein
  // früheres heikles Anliegen, das noch beim Menschen liegt.
  let heikel = null as { art: AnliegenHeikel; grund: string } | null;
  for (const b of buendel) {
    heikel = anliegenHeikel({ betreff: b.betreff, text: b.text });
    if (heikel) break;
  }
  for (const b of heikel ? [] : zuAlt) {
    const h = anliegenHeikel({ betreff: b.betreff, text: b.text });
    if (h) { heikel = { art: h.art, grund: `Ein früheres Anliegen (${HEIKEL_NAME[h.art]}) wartet auf einen Menschen — er antwortet auf beide.` }; break; }
  }
  if (!heikel && personId) {
    const [frueher] = (await lauf`
      SELECT t.mara_heikel FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
       WHERE COALESCE(p.merged_into_person_id, t.person_id) = ${personId} AND t.status = 'offen' AND t.antwort IS NULL
         AND t.mara_stand = 'mensch' AND t.mara_heikel IS NOT NULL AND NOT (t.id = ANY(${ids}::int[]))
       ORDER BY t.created_at DESC LIMIT 1`) as any[];
    if (frueher) {
      const art = String(frueher.mara_heikel) as AnliegenHeikel;
      heikel = { art, grund: `Ein früheres Anliegen (${HEIKEL_NAME[art] ?? art}) wartet auf einen Menschen — er antwortet auf beide.` };
    }
  }
  const urteil: AnliegenUrteil = anliegenUrteil({
    schalterAn, kiPause, deckelErreicht: deckel, jetzt, mitPerson: !!personId, global, test,
    alterTage: tageAlt(new Date(leit.created_at), jetzt), heuteBeantwortet: Number(heute?.n ?? 0), heikel,
  });
  if (urteil.art === "warten") { await freigeben(); return urteil; }
  // Global und Testperson: Mara schreibt NICHTS — keine Zeile, kein Vermerk.
  if (urteil.art === "nie") { await freigeben(); return urteil; }
  // Zu alte offene Anliegen desselben Menschen: beim Menschen (mit ihrer Heikel-Art, falls heikel) — nie „mit beantwortet“.
  for (const b of zuAlt) {
    const h = anliegenHeikel({ betreff: b.betreff, text: b.text });
    await setzen("mensch", h?.grund ?? `Älter als ${ANLIEGEN_MAX_TAGE} Tage — ein Mensch antwortet.`, { heikel: h?.art ?? null, nur: [Number(b.id)] });
  }
  if (urteil.art === "mensch") {
    await setzen("mensch", urteil.grund, { heikel: urteil.heikel });
    return urteil;
  }

  // ── Mara arbeitet ──
  try {
    const agent = await import("./fiaon-postmeister-agent");
    const { akteLesen } = await import("./fiaon-postmeister-dossier");
    const { menschNoetig, offeneEinwaende, UEBERGABE_GRUND } = await import("./fiaon-postmeister-lauf");
    const { anredeBestimmen, anliegenAntwortBauen, anliegenVerweisKern, grussMitAgent } = await import("./fiaon-postmeister-antworttext");
    const { kuendigungSendeUrteil } = await import("@shared/fiaon-wortverbote");

    const ref = String(leit.ref ?? t.ref);
    const von = String(t.primary_email ?? "").trim() || `Kundenbereich ${ref}`;
    const alterTage = tageAlt(new Date(leit.created_at), jetzt);
    const text = String(leit.text ?? "");
    const betreff = String(leit.betreff ?? "");

    // 1. Einordnen — einmal je Text (Merker am Anliegen, E-401). Im Bündel ALLE offenen Texte: Eine Beschwerde im
    //    älteren Anliegen hält auch die Antwort auf das jüngere an (Riegel und Lampen sehen alles).
    const einText = buendel.length > 1 ? buendel.map((b: any) => `${b.betreff}\n${b.text}`).join("\n\n— nächstes Anliegen —\n\n") : text;
    const [merkerZeile] = (await lauf`SELECT mara_einordnung FROM fiaon_tickets WHERE id = ${leitId}`) as any[];
    const eo = await agent.einordnenMitMerker({ betreff, text: einText, von, alterTage }, merkerZeile?.mara_einordnung ?? null);
    if (!eo.wiederverwendet) await lauf`UPDATE fiaon_tickets SET mara_einordnung = ${lauf.json(eo.merker as any)} WHERE id = ${leitId}`.catch(() => {});
    const einordnung = eo.einordnung;
    const heikelNachher = heikelAusEinordnung(einordnung);
    if (heikelNachher) {
      await setzen("mensch", heikelNachher.grund, { heikel: heikelNachher.art });
      return { art: "mensch", grund: heikelNachher.grund, heikel: heikelNachher.art };
    }

    // 2. Der Verlauf: die übrigen offenen des Bündels IMMER (E-406 Nachbesserung: vorher die 20 ÄLTESTEN aus 90 Tagen —
    //    ein Bündel-Anliegen konnte fehlen und bekam trotzdem „mit beantwortet“), dazu die jüngsten früheren Anliegen.
    const frueher = ((await lauf`
      SELECT t.id, t.betreff, t.text, t.antwort, t.created_at, t.beantwortet_am, t.beantwortet_durch
        FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
       WHERE COALESCE(p.merged_into_person_id, t.person_id) = ${personId} AND t.id <> ${leitId}
         AND (t.created_at > NOW() - INTERVAL '90 days' OR t.id = ANY(${ids}::int[]))
       ORDER BY (t.id = ANY(${ids}::int[])) DESC, t.created_at DESC, t.id DESC LIMIT 20`) as any[])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || Number(a.id) - Number(b.id));
    const imVerlauf = new Set(frueher.map((f: any) => Number(f.id)));
    const verlauf: { von: string; am: string; text: string }[] = [];
    for (const f of frueher) {
      const offen = ids.includes(Number(f.id));
      const beimTeam = zuAltIds.includes(Number(f.id));
      verlauf.push({ von: `Kunde (Anliegen #${f.id}${offen ? ", noch offen — deine Antwort gilt auch dafür" : beimTeam ? ", noch offen — liegt bei einem Kollegen, geh nicht darauf ein" : ""})`, am: datumDe(new Date(f.created_at)), text: `${f.betreff}\n${f.text}` });
      if (f.antwort) verlauf.push({ von: f.beantwortet_durch === "mara" ? "FIAON (Mara)" : "FIAON (Team)", am: f.beantwortet_am ? datumDe(new Date(f.beantwortet_am)) : "", text: String(f.antwort) });
    }
    const akte = await akteLesen(personId, ref);
    const sprache = agent.antwortSprache(einordnung.sprache, akte?.sprache ?? null);
    const vorgeschichte = await offeneEinwaende(personId, 0).catch(() => null);

    // 3. Der Agent — Kanal „anliegen“.
    const erg = await agent.antwortErzeugen({
      kanal: "anliegen", anliegenId: leitId, anliegenAm: new Date(leit.created_at),
      // Integration E-406 Welle 1 (B1 × C1): am = wann er schrieb — Bezug für „morgen“, „am Freitag“ beim genannten Zahltag.
      postfach: "kundenbereich", mail: { betreff, text, von, alterTage, am: new Date(leit.created_at) },
      verlauf, einordnung, personId, ref, postmeisterId: null, sprache, vorgeschichte,
    });
    if (!erg.ok || !erg.antwort) {
      const [v] = (await lauf`SELECT mara_versuche FROM fiaon_tickets WHERE id = ${leitId}`) as any[];
      const versuche = Number(v?.mara_versuche ?? 0) + 1;
      const grund = String(erg.grund || "keine Antwort erzeugt").slice(0, 300);
      // Ein Löschwunsch oder „nie beantragt“, den der Agent erkennt: sofort beim Menschen (heikel), kein zweiter Anlauf.
      if (/ein Mensch antwortet/.test(grund)) {
        const art: AnliegenHeikel = /Lösch/i.test(grund) ? "loeschen" : "bestreitet";
        await setzen("mensch", grund, { heikel: art });
        return { art: "mensch", grund, heikel: art };
      }
      if (/Tagesdeckel/.test(grund)) { await freigeben(); return { art: "warten", grund }; }
      if (versuche >= ANLIEGEN_VERSUCHE) {
        await setzen("mensch", `Mara kam nach ${versuche} Versuchen nicht durch (${grund.slice(0, 120)}) — bitte selbst antworten.`, { versuche: true });
        return { art: "mensch", grund, heikel: null };
      }
      await setzen("fehler", grund, { versuche: true });
      return { art: "fehler", grund };
    }

    // 4. Anrede, Gruß, Knopf — dieselben Bausteine wie die Mail, als Text für den Kundenbereich.
    const anrede = await anredeBestimmen(personId, t.first_name ?? null, t.last_name ?? null, sprache, { absender: von });
    const name = await agent.agentName();
    const gruss = grussMitAgent("Freundliche Grüße\nIhr FIAON-Team", name);
    const fertig = anliegenAntwortBauen({ anrede: anrede.zeile, kern: erg.antwort, gruss, schritt: erg.naechsterSchritt, sprache, agentName: name });

    // 5. Darf es raus? Dieselben Wände wie im Postfach.
    let mensch = menschNoetig(einordnung, einText, { globalKunde: global });
    if (mensch === UEBERGABE_GRUND.widerruf && erg.automatischErlaubt) mensch = null;
    if (mensch === UEBERGABE_GRUND.ansprechpartner
      && erg.handlungen.some((h) => h.ok && ["aufgabe_an_betreuer", "notiz_an_betreuer", "terminlink_bauen"].includes(h.werkzeug))) mensch = null;
    const e393 = kuendigungSendeUrteil({
      antwort: fertig.text, eingang: einText, betreff, flags: einordnung.flags as any,
      kundenlage: akte.kundenlage, kategorien: einordnung.kategorien as any, kuendigungInAkte: !!akte?.kuendigung,
      // E-396 (Integration E-406 Welle 1): Kulanz-Satz nur beim Jahresvertrag — beim Vertrag vor dem 03.09.2026 sperrt die Wand ihn.
      kulanzErlaubt: await (await import("./fiaon-kuendigung")).kulanzSatzErlaubt(ref, personId).catch(() => null),
    });
    const senden = anliegenSendeUrteil({
      text: fertig.text, automatischErlaubt: erg.automatischErlaubt, mensch, e393Gesperrt: e393.gesperrt,
      e393Grund: e393.gesperrt ? e393.grund : null, heikel: null, grund: erg.grund,
    });
    const handlungKurz = erg.handlungen.filter((h) => h.ok).map((h) => h.werkzeug);

    if (!senden.senden) {
      await setzen("entwurf", senden.grund, { entwurf: fertig.text });
      // Die Werkzeuge ihres Laufs — sie decken die Zusagen des Vorschlags, wenn ein Mensch ihn übernimmt (anliegenHandPruefen).
      await lauf`UPDATE fiaon_tickets SET mara_werkzeuge = ${lauf.json(handlungKurz as any)} WHERE id = ANY(${ids}::int[])`.catch(() => {});
      await vermerk(ref, personId, `Mara: Vorschlag zu Anliegen #${leitId} liegt auf /agent/anliegen — ${senden.grund.slice(0, 200)}${handlungKurz.length ? ` (schon getan: ${handlungKurz.join(", ")})` : ""}`, lauf);
      return { art: "entwurf", grund: senden.grund };
    }

    // 6. Speichern — nur, wenn das Anliegen noch offen und unbeantwortet ist (ein Mensch gewinnt).
    const gespeichert = await anliegenAntwortSpeichern({
      id: leitId, antwort: fertig.text, knopf: fertig.knopf, nurWennOffen: true,
      von: { agentId: null, agentName: name, nennName: String(name).split(" ")[0] || "Mara", durch: "mara" },
    }, lauf);
    if (!gespeichert) { await freigeben(); return { art: "weg", grund: "inzwischen von einem Menschen beantwortet" }; }
    await lauf`UPDATE fiaon_tickets SET mara_stand = 'beantwortet', mara_grund = ${String(erg.grund || "").slice(0, 400)}, mara_am = NOW(), mara_in_arbeit_seit = NULL WHERE id = ${leitId}`;
    // Die älteren offenen Anliegen des Bündels: ein kurzer Verweis auf die eine Antwort (ohne zweite Benachrichtigung) —
    // nur, wenn Mara sie im Verlauf sah, und in der Sprache der Antwort (E-248 #5591: keine Mischsprache).
    const mitgenommen: number[] = [];
    for (const b of buendel) {
      const bid = Number(b.id);
      if (bid === leitId || !imVerlauf.has(bid)) continue;
      const verweis = anliegenAntwortBauen({
        anrede: anrede.zeile, gruss, sprache, agentName: name,
        kern: anliegenVerweisKern({ sprache, betreff, am: new Date(leit.created_at) }),
      }).text;
      const [m] = (await lauf`
        UPDATE fiaon_tickets SET antwort = ${verweis}, beantwortet_am = NOW(), beantwortet_von = NULL, status = 'beantwortet',
               beantwortet_durch = 'mara', mara_stand = 'beantwortet', mara_grund = ${`mitbeantwortet unter Anliegen #${leitId}`},
               mara_am = NOW(), mara_in_arbeit_seit = NULL, updated_at = NOW()
         WHERE id = ${bid} AND status = 'offen' AND antwort IS NULL RETURNING id`) as any[];
      if (m) mitgenommen.push(bid);
    }
    if (handlungKurz.length) {
      await vermerk(ref, personId, `Mara hat Anliegen #${leitId} beantwortet und dazu: ${erg.handlungen.filter((h) => h.ok).map((h) => `${h.werkzeug} (${String(h.ergebnis).slice(0, 80)})`).join(" · ")}`, lauf);
    }
    return { art: "beantwortet", grund: String(erg.grund || "sauber"), mitgenommen };
  } catch (e: any) {
    const { istKiPause } = await import("./fiaon-ki-pause");
    if (istKiPause(e)) {
      // KI-Pause: kein Fehlversuch — das Anliegen bleibt offen und kommt nach dem Aktivieren wieder (nachgeholt).
      await freigeben();
      return { art: "warten", grund: "KI pausiert — wird danach nachgeholt" };
    }
    const grund = String(e?.message || e).slice(0, 300);
    console.error(`[MARA-ANLIEGEN] #${leitId}:`, grund);
    const [v] = (await lauf`SELECT mara_versuche FROM fiaon_tickets WHERE id = ${leitId}`.catch(() => [])) as any[];
    const versuche = Number(v?.mara_versuche ?? 0) + 1;
    if (versuche >= ANLIEGEN_VERSUCHE) {
      await setzen("mensch", `Mara kam nach ${versuche} Versuchen nicht durch — bitte selbst antworten.`, { versuche: true }).catch(() => {});
      return { art: "mensch", grund, heikel: null };
    }
    await setzen("fehler", grund, { versuche: true }).catch(() => {});
    return { art: "fehler", grund };
  }
}

async function vermerk(ref: string | null, personId: number | null, note: string, lauf: Lauf): Promise<void> {
  if (!ref) return;
  await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
             VALUES (${ref}, ${personId}, NULL, 'Mara', 'system', ${note.slice(0, 900)})`.catch(() => {});
}

// ── DER TAKT ────────────────────────────────────────────────────────────────
export interface TaktErgebnis {
  geprueft: number; beantwortet: number; entwuerfe: number; mensch: number; fehler: number; warten: number;
  grund?: string;
}

/**
 * Alle 5 Minuten (server/routes.ts, tageslauf „mara_anliegen“). Erst die Bremsen für alle (Schalter, KI-Pause,
 * Deckel, 08–20 Uhr) — dann je Mensch das jüngste offene Anliegen, höchstens ANLIEGEN_JE_TAKT, ältestes zuerst.
 * Global-Kunden und Testpersonen holt die Abfrage gar nicht erst. Beansprucht wird atomar (mara_in_arbeit_seit);
 * ein hängender Anspruch (Neustart) verfällt nach 15 Minuten.
 */
export async function anliegenTakt(opt: { jetzt?: Date; deckel?: number } = {}, lauf: Lauf = sqlPool): Promise<TaktErgebnis> {
  const erg: TaktErgebnis = { geprueft: 0, beantwortet: 0, entwuerfe: 0, mensch: 0, fehler: 0, warten: 0 };
  const jetzt = opt.jetzt ?? new Date();
  if (!(await anliegenSchalterLesen(lauf))) return { ...erg, grund: "Schalter aus" };
  const { kiPausiert } = await import("./fiaon-ki-pause");
  if (await kiPausiert().catch(() => true)) return { ...erg, grund: "KI pausiert" };
  if (!imVersandfenster(jetzt)) return { ...erg, grund: "außerhalb 08:00–20:00" };
  if (await deckelErreicht().catch(() => true)) return { ...erg, grund: "Kostendeckel erreicht" };
  await anliegenSchema(lauf);
  const { globalKundeBereit, globalKundeSql } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  // Ohne Akte: einmal ein Hinweis, dann nie wieder angefasst (ein Mensch ordnet zu).
  await lauf`UPDATE fiaon_tickets SET mara_stand = 'mensch', mara_grund = 'Ohne Akte — ein Mensch ordnet zu und antwortet.', mara_am = NOW()
              WHERE status = 'offen' AND antwort IS NULL AND person_id IS NULL AND mara_stand IS NULL`.catch(() => {});
  const kandidaten = (await lauf.unsafe(`
    SELECT DISTINCT ON (pid) id, pid, created_at FROM (
      SELECT t.id, COALESCE(p.merged_into_person_id, t.person_id) AS pid, t.created_at
        FROM fiaon_tickets t JOIN fiaon_persons p ON p.id = t.person_id
       WHERE t.status = 'offen' AND t.antwort IS NULL
         AND (t.mara_stand IS NULL OR (t.mara_stand = 'fehler' AND t.mara_versuche < $1 AND t.mara_am < NOW() - INTERVAL '15 minutes'))
         AND (t.mara_in_arbeit_seit IS NULL OR t.mara_in_arbeit_seit < NOW() - INTERVAL '15 minutes')
         AND t.created_at > NOW() - INTERVAL '60 days'
         AND p.ist_test_am IS NULL
         AND t.ref NOT LIKE 'FIAON-TEST%' AND t.ref NOT LIKE 'FIA-DEV-%' AND t.ref NOT LIKE 'FIAON-P-TEST%'
         AND NOT ${globalKundeSql("COALESCE(p.merged_into_person_id, t.person_id)")}
    ) x
    ORDER BY pid, created_at DESC, id DESC`, [ANLIEGEN_VERSUCHE]) as any[])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, Math.max(0, opt.deckel ?? ANLIEGEN_JE_TAKT));
  for (const k of kandidaten) {
    // Atomar beanspruchen — läuft der Takt doppelt, arbeitet nur einer.
    const [an] = (await lauf`
      UPDATE fiaon_tickets SET mara_in_arbeit_seit = NOW()
       WHERE id = ${Number(k.id)} AND status = 'offen' AND antwort IS NULL
         AND (mara_in_arbeit_seit IS NULL OR mara_in_arbeit_seit < NOW() - INTERVAL '15 minutes')
       RETURNING id`) as any[];
    if (!an) continue;
    erg.geprueft++;
    const r = await anliegenBearbeiten(Number(k.id), { jetzt }, lauf);
    if (r.art === "beantwortet") erg.beantwortet++;
    else if (r.art === "entwurf") erg.entwuerfe++;
    else if (r.art === "mensch") erg.mensch++;
    else if (r.art === "fehler") erg.fehler++;
    else if (r.art === "warten") { erg.warten++; if (/KI pausiert|Kostendeckel|Tagesdeckel/.test(r.grund)) break; }
  }
  return erg;
}

/** Hat der Takt etwas getan? (nurMitErgebnis — sonst keine Historienzeile je 5 Minuten.) */
export function taktHatGearbeitet(e: TaktErgebnis): boolean {
  return e.geprueft > 0;
}

// ── STAND FÜRS STEUERPULT ──────────────────────────────────────────────────
export interface AnliegenStand {
  an: boolean;
  offen: number;
  heute: number;
  woche: { beantwortet: number; entwuerfe: number; mensch: number };
  wartet: number;
  deckelEuro: number;
  kostenHeuteEuro: number;
  gruende: { grund: string; n: number }[];
}
export async function anliegenStand(lauf: Lauf = sqlPool): Promise<AnliegenStand> {
  await anliegenSchema(lauf);
  const an = await anliegenSchalterLesen(lauf);
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen,
           COUNT(*) FILTER (WHERE beantwortet_durch = 'mara' AND beantwortet_am > NOW() - INTERVAL '24 hours' AND mara_grund NOT LIKE 'mitbeantwortet%')::int AS heute,
           COUNT(*) FILTER (WHERE beantwortet_durch = 'mara' AND beantwortet_am > NOW() - INTERVAL '7 days' AND mara_grund NOT LIKE 'mitbeantwortet%')::int AS beantwortet,
           COUNT(*) FILTER (WHERE mara_stand = 'entwurf' AND status = 'offen')::int AS entwuerfe,
           COUNT(*) FILTER (WHERE mara_stand = 'mensch' AND status = 'offen')::int AS mensch,
           COUNT(*) FILTER (WHERE status = 'offen' AND antwort IS NULL AND (mara_stand IS NULL OR mara_stand = 'fehler'))::int AS wartet
      FROM fiaon_tickets`) as any[];
  const gruende = (await lauf`
    SELECT COALESCE(mara_heikel, 'sonstiges') AS grund, COUNT(*)::int AS n FROM fiaon_tickets
     WHERE status = 'offen' AND mara_stand = 'mensch' GROUP BY 1 ORDER BY n DESC LIMIT 6`) as any[];
  const { kostenHeute } = await import("./fiaon-postmeister-schema");
  return {
    an, offen: Number(z?.offen ?? 0), heute: Number(z?.heute ?? 0),
    woche: { beantwortet: Number(z?.beantwortet ?? 0), entwuerfe: Number(z?.entwuerfe ?? 0), mensch: Number(z?.mensch ?? 0) },
    wartet: Number(z?.wartet ?? 0), deckelEuro: anliegenDeckelEuro(),
    kostenHeuteEuro: Number((await kostenHeute(ANLIEGEN_DIENST).catch(() => 0)).toFixed(2)),
    gruende: gruende.map((g) => ({ grund: HEIKEL_NAME[g.grund as AnliegenHeikel] ?? "anderes (zu alt, ohne Akte, kein Durchkommen)", n: Number(g.n) })),
  };
}
