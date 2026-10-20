// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DER AUFTRAGS-CHAT IN DER AKTE, DER SERVER (E-408, Akte-Steuerung, 20.10.2026)
//
// Justin (20.10.2026): „… am besten öffnet sich so ein kurzer Chat wo genau abgefragt wird damit ARAS perfekt arbeiten kann“
//
// Der Leitfaden (rein, offline geprüft) steht in shared/fiaon-aras-briefing-chat.ts. Hier:
//   · briefingKontext    die Akte für ARAS: Name, Paket, Stand, offene Punkte mit Betrag und Tagen, letzte Kontakte,
//                        „Was ARAS wissen muss“ — und aus arasAkteLage, ob ARAS gerade anrufen darf (der Grund kommt
//                        unverändert aus dem Kern; dieser Chat entscheidet das nie selbst)
//   · briefingStarten / briefingAntworten / briefingKarteSetzen / briefingBeauftragen / briefingAktion / briefingVerlauf
//   · Die KI (optional): derselbe Weg wie Prüf-Mara — openaiFetch (KI-Pause, KI-Weiche), nutzungMerken, Tagesdeckel
//     (ARAS_BRIEFING_TAG_EURO, Vorgabe 5 €). Ohne Schlüssel, in der Pause, am Deckel, bei Fehlern oder einer Antwort, die
//     nicht durch die Prüfung kommt: der Leitfaden — der Chat geht immer.
//   · Der Auftrag geht über den bestehenden Weg (arasAuftragGeben: Lage, Wand, EIN Eintrag in der Warteschlange) — mit genau
//     dem Text der Karte. Dazu läuft die Wand hier ein zweites Mal (Karte Feld für Feld).
//   · „Soll Mara stattdessen schreiben?“ nutzt nur Wege des Hauses mit ihren eigenen Wänden: Upload-Link
//     (unterlagenAnfrageSenden), Zahlungsdaten bzw. Terminlink (mailSenden), WhatsApp-Rückfrage (waSenden, Mara übernimmt).
// Tabelle fiaon_aras_briefing (neu, beim ersten Gebrauch): ein Chat je Auftrag — wer, was, Karte, Verlauf, Plan-Eintrag.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasAkteLage, arasAuftragGeben, arasAuftragZuruecknehmen, arasFuerPersonSchalten } from "./fiaon-aras-akte";
import { planVerschieben } from "./fiaon-aras-plan";
import { istGlobalKunde } from "./fiaon-global-kunde";
import { nennform } from "../../shared/fiaon-mitarbeiter-name";
import { euroText } from "../../shared/fiaon-auskunft";
import { ERGEBNIS_TEXT, istErgebnis } from "../../shared/fiaon-kontakt-ergebnis-liste";
import { stufeAusAntrag } from "../../shared/fiaon-mara-ton";
import { nummerFuerWhatsApp } from "../../shared/fiaon-whatsapp-erlaubnis";
import { AUFTRAG_MAX_ZEICHEN, AUFTRAG_WANN, berlinTeile } from "../../shared/fiaon-aras";
import {
  BRIEFING_FORTSETZEN_STUNDEN, BRIEFING_MAX, BRIEFING_RUECKFRAGEN, MARA_WAS, UHRZEIT_RE,
  auftragTextAusKarte, briefingEroeffnung, briefingWeiter, frageFuer, istBriefingAktion, karteEinpassen, karteSaeubern, karteVollstaendig,
  karteWandPruefen, kundenNamen, kuerzen, modellAnweisung, modellAntwortLesen, modellVerlauf, fuerKunde, wannText,
  type BriefingAktion, type BriefingKarte, type BriefingKontext, type BriefingSicht, type BriefingStand, type BriefingZeile, type MaraWeg, type BriefingWann,
} from "../../shared/fiaon-aras-briefing-chat";

type Lauf = typeof sqlPool;
export const BRIEFING_DIENST = "aras-briefing";
export const BRIEFING_TAG_EURO_VORGABE = 5;

// ── Tabelle ────────────────────────────────────────────────────────────────
let tabelle: Promise<boolean> | null = null;
/** Neue Tabelle beim ersten Gebrauch — über den globalen Pool, kurze Sperrfrist (AGENTS.md, Falle 1). */
export function briefingTabelle(): Promise<boolean> {
  if (!tabelle) {
    tabelle = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          CREATE TABLE IF NOT EXISTS fiaon_aras_briefing (
            id BIGSERIAL PRIMARY KEY,
            person_id INTEGER NOT NULL,
            agent_id INTEGER,
            von TEXT NOT NULL,
            von_dat TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'offen',
            stand JSONB NOT NULL,
            verlauf JSONB NOT NULL DEFAULT '[]'::jsonb,
            karte JSONB,
            auftrag_text TEXT,
            plan_id BIGINT,
            mara_weg TEXT,
            mara_meldung TEXT,
            motor TEXT NOT NULL DEFAULT 'leitfaden',
            ki_aufrufe INTEGER NOT NULL DEFAULT 0,
            kosten_cents NUMERIC(10,3) NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            beauftragt_am TIMESTAMPTZ
          )`;
        await tx`CREATE INDEX IF NOT EXISTS aras_briefing_person_idx ON fiaon_aras_briefing (person_id, created_at DESC)`;
        await tx`CREATE INDEX IF NOT EXISTS aras_briefing_plan_idx ON fiaon_aras_briefing (plan_id) WHERE plan_id IS NOT NULL`;
      });
      return true;
    })().catch((e) => { tabelle = null; throw e; });
  }
  return tabelle;
}

// ── Wer fragt ──────────────────────────────────────────────────────────────
export interface BriefingAgent { id: number; name: string; rolle: string; leitung: boolean; nom: string; dat: string }
/** Der Mitarbeiter in Nennform („Herr Krause“ / „Herrn Krause“) — so steht er im Verlauf und im Auftrag. */
export async function briefingAgent(id: number, name: string, rolle: string, lauf: Lauf = sqlPool): Promise<BriefingAgent> {
  const [a] = (await lauf`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${id}`.catch(() => [])) as any[];
  const n = nennform(a ?? { name });
  return { id, name: String(name || n.voll), rolle, leitung: rolle === "admin" || rolle === "vertriebsleiter", nom: n.nom, dat: n.dat };
}

// ── Die Akte für ARAS ──────────────────────────────────────────────────────
const STAND_TEXT: Record<string, string> = {
  lead: "Interessent, noch kein Antrag", antrag_offen: "Antrag angefangen", zahlung_offen: "Antrag abgeschickt, erste Zahlung offen",
  zahlung_gemeldet: "Zahlung gemeldet, noch nicht zugeordnet", kunde: "Kunde (bezahlt)", beendet: "Vertrag beendet",
};
const SYSTEMWORT = /\b(akte|stufe|lead|status|tier|ticket|vorgang|claimed_paid|pending_payment|system)\b/gi;
const tagKurz = (d: unknown): string => {
  const x = new Date(d as any);
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }) : "";
};
const tagLang = (d: unknown): string => {
  const x = new Date(d as any);
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : "";
};

/**
 * Alles, was ARAS im Chat über den Kunden weiß. Ob sie anrufen darf, sagt arasAkteLage (der Kern) — der Grund kommt wörtlich
 * mit. Wirft nicht für fehlende Nebensachen (Kontakte, Rate): dann fehlen sie eben.
 */
export async function briefingKontext(personId: number, agent: Pick<BriefingAgent, "id" | "leitung">, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<BriefingKontext | null> {
  const lage = await arasAkteLage(personId, agent.id, agent.leitung, lauf);
  if (!lage) return null;
  const [p] = (await lauf`SELECT anrede, first_name, last_name, primary_phone, ist_test_am IS NOT NULL AS test FROM fiaon_persons WHERE id = ${personId}`) as any[];
  const [a] = (await lauf`
    SELECT ref, pack_name, status, payment_status, current_step, submitted_at, gekuendigt_am, abo_gestoppt_am
      FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL AND archived_at IS NULL
       AND COALESCE(ist_entwurf, FALSE) = FALSE AND COALESCE(type, '') <> 'schufa' AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%'
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
  const anredeRoh = String(p?.anrede ?? "").trim().toLowerCase();
  const anrede: "Herr" | "Frau" | null = /^(herr|herrn|hr)/.test(anredeRoh) ? "Herr" : /^(frau|fr)/.test(anredeRoh) ? "Frau" : null;

  // Die offene Rate mit Tagen — dieselbe Auswahl wie der offene Punkt (älteste fällige, offen, nicht storniert).
  let rate: BriefingKontext["rate"] = null;
  if (a?.ref && lage.offen.some((x) => x.art === "rate")) {
    const [r] = (await lauf`
      SELECT rate_nr, betrag_cents, faellig_am, ((NOW() AT TIME ZONE 'Europe/Berlin')::date - faellig_am)::int AS tage
        FROM fiaon_abo_raten
       WHERE ref = ${String(a.ref)} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL AND faellig_am <= CURRENT_DATE + 1
       ORDER BY faellig_am LIMIT 1`.catch(() => [])) as any[];
    if (r) rate = { nr: Number(r.rate_nr), betrag: euroText(Number(r.betrag_cents ?? 0)), faelligAm: tagLang(r.faellig_am), tageOffen: Number(r.tage ?? 0) };
  }
  // Die letzten Kontakte (ohne Namen aus dem Team — ARAS nennt Mitarbeiter nie beim Vornamen).
  const kontakte = ((await lauf`
    SELECT cl.created_at, cl.type, cl.outcome, cl.note, COALESCE(ag.art, 'mensch') AS art
      FROM fiaon_contact_log cl LEFT JOIN fiaon_agents ag ON ag.id = cl.agent_id
     WHERE (cl.person_id = ${personId} OR cl.ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${personId}))
       AND cl.voided_at IS NULL AND cl.type IN ('note', 'result')
     ORDER BY cl.created_at DESC LIMIT 3`.catch(() => [])) as any[]).map((z) => {
    const ergebnis = z.outcome && istErgebnis(String(z.outcome)) ? ERGEBNIS_TEXT[String(z.outcome) as keyof typeof ERGEBNIS_TEXT] : null;
    const notiz = String(z.note ?? "").replace(/\s+/g, " ").replace(SYSTEMWORT, "…").trim();
    return { am: tagKurz(z.created_at), wer: z.art === "ki" ? "ARAS" : "Team", was: kuerzen([ergebnis, notiz].filter(Boolean).join(" — "), 140) };
  }).filter((x) => x.was);

  const global = await istGlobalKunde(personId, lauf).catch(() => true);
  const test = p?.test === true;
  const offen = lage.offen;
  let mara: BriefingKontext["mara"] = null;
  if (!global && !test) {
    const weg: MaraWeg = offen.some((x) => x.art === "unterlagen") ? "unterlagen"
      : offen.some((x) => x.art === "erste_rate") ? "zahlungsdaten"
        : nummerFuerWhatsApp(p?.primary_phone) ? "whatsapp" : "terminlink";
    mara = { weg };
  }
  const wartend = lage.geplant.find((g) => g.spielart === "auftrag" && (g.status === "wartet" || g.status === "verschoben"));
  const b = berlinTeile(jetzt);
  return {
    kunde: { anrede, vorname: p?.first_name ? String(p.first_name) : null, nachname: p?.last_name ? String(p.last_name) : null },
    paket: a?.pack_name ? String(a.pack_name) : null,
    stand: STAND_TEXT[stufeAusAntrag(a ?? null)] ?? null,
    offen, rate, kontakte,
    arasNotiz: lage.notiz.text ? kuerzen(lage.notiz.text, 300) : null,
    arasZuletzt: lage.verlauf.slice(0, 2).map((v) => ({ am: tagKurz(v.am), ergebnis: v.ergebnisText })),
    bleibtBeiDir: lage.bleibtBeiDir,
    geht: lage.geht, hinweis: lage.hinweis,
    sperre: { aus: lage.sperre.aus, telefonGesperrt: lage.sperre.telefonGesperrt },
    geplant: wartend ? { id: wartend.id, ab: wartend.ab, zuruecknehmbar: wartend.zuruecknehmbar } : null,
    mara,
    heute: {
      datum: b.datum.split("-").reverse().join("."),
      wochentag: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(jetzt),
      hhmm: b.hhmm,
    },
  };
}

// ── Die KI (optional) — derselbe Weg wie Prüf-Mara ─────────────────────────
export type BriefingModell = (ein: { system: string; nachrichten: { role: "user" | "assistant"; content: string }[] }) => Promise<{ text: string | null; modell: string; kostenCents: number }>;
let modellErsatz: BriefingModell | null = null;
/** Prüfstand: das Modell durch eine Attrappe ersetzen (null = echtes Modell). */
export function briefingModellSetzen(fn: BriefingModell | null): void { modellErsatz = fn; }
export function briefingDeckelEuro(): number {
  const n = Number(process.env.ARAS_BRIEFING_TAG_EURO ?? BRIEFING_TAG_EURO_VORGABE);
  return Number.isFinite(n) && n >= 0 ? n : BRIEFING_TAG_EURO_VORGABE;
}
async function modellFragen(ein: Parameters<BriefingModell>[0]): Promise<{ text: string | null; modell: string; kostenCents: number }> {
  if (modellErsatz) return modellErsatz(ein);
  const { openaiFetch, kiLesenMoeglich, kiPausiert, istKiPause, kiSchluessel } = await import("./fiaon-ki-pause");
  if (!kiLesenMoeglich()) return { text: null, modell: "ohne_schluessel", kostenCents: 0 };
  if (await kiPausiert().catch(() => true)) return { text: null, modell: "ki_pause", kostenCents: 0 };
  const { nutzungMerken, kostenHeute, kostenCentsAus } = await import("./fiaon-postmeister-schema");
  if ((await kostenHeute(BRIEFING_DIENST).catch(() => Number.POSITIVE_INFINITY)) >= briefingDeckelEuro()) return { text: null, modell: "deckel", kostenCents: 0 };
  const modell = process.env.ARAS_BRIEFING_MODELL || "gpt-4.1-mini";
  const start = Date.now();
  try {
    const res = await openaiFetch(BRIEFING_DIENST, "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${kiSchluessel()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell, temperature: 0.3, max_tokens: 700, response_format: { type: "json_object" },
        messages: [{ role: "system", content: ein.system }, ...ein.nachrichten],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      await nutzungMerken({ dienst: BRIEFING_DIENST, modell, dauerMs: Date.now() - start, ok: false, fehler: `HTTP ${res.status}` }).catch(() => {});
      return { text: null, modell, kostenCents: 0 };
    }
    const json = (await res.json()) as any;
    const kosten = kostenCentsAus(String(json?.model ?? modell), json?.usage);
    await nutzungMerken({ dienst: BRIEFING_DIENST, modell: String(json?.model ?? modell), usage: json?.usage, dauerMs: Date.now() - start, ok: true }).catch(() => {});
    return { text: String(json?.choices?.[0]?.message?.content ?? ""), modell: String(json?.model ?? modell), kostenCents: kosten };
  } catch (e) {
    if (!istKiPause(e)) await nutzungMerken({ dienst: BRIEFING_DIENST, modell, dauerMs: Date.now() - start, ok: false, fehler: String((e as Error)?.message ?? e).slice(0, 200) }).catch(() => {});
    return { text: null, modell, kostenCents: 0 };
  }
}

// ── Mara statt Anruf — nur Wege des Hauses ─────────────────────────────────
export type MaraSender = (weg: MaraWeg, ein: { personId: number; agent: BriefingAgent; lauf: Lauf }) => Promise<{ ok: boolean; meldung: string }>;
let maraErsatz: MaraSender | null = null;
/** Prüfstand: den Versand durch eine Attrappe ersetzen (null = echter Weg). */
export function briefingMaraSetzen(fn: MaraSender | null): void { maraErsatz = fn; }
async function maraSchreiben(weg: MaraWeg, personId: number, agent: BriefingAgent, lauf: Lauf): Promise<{ ok: boolean; meldung: string }> {
  if (maraErsatz) return maraErsatz(weg, { personId, agent, lauf });
  if (weg === "unterlagen") {
    const { dokumentLage } = await import("./fiaon-kundenlage");
    const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
    const { istLinkArt } = await import("../../shared/fiaon-unterlagen-anfrage");
    const arten = (await dokumentLage(personId)).fehlend.map((f) => f.art).filter(istLinkArt);
    if (!arten.length) return { ok: false, meldung: "Es fehlt gerade keine Unterlage, die Mara anfordern kann." };
    const r = await unterlagenAnfrageSenden({ personId, arten, kanaele: ["mail", "whatsapp"], quelle: "akte", akteur: { name: agent.name, agentId: agent.id, rolle: agent.rolle } });
    return { ok: r.ok, meldung: r.meldung };
  }
  if (weg === "zahlungsdaten" || weg === "terminlink") {
    const event = weg === "zahlungsdaten" ? "payment_details" : "nicht_erreicht_termin";
    const { artenFuerRolle } = await import("./fiaon-versand");
    if (!artenFuerRolle(agent.rolle).includes(event)) return { ok: false, meldung: "Diese Mail darfst du nicht senden." };
    const { mailSenden } = await import("./fiaon-mail-senden");
    const r = await mailSenden({ event, personId, akteur: { name: agent.name, agentId: agent.id, rolle: agent.rolle as any } });
    return { ok: r.ok, meldung: r.meldung };
  }
  // WhatsApp: die freigegebene Rückfrage-Vorlage („… hier ist Mara von FIAON …“); antwortet er, übernimmt Mara.
  const [p] = (await lauf`SELECT primary_phone, anrede, first_name, last_name FROM fiaon_persons WHERE id = ${personId}`) as any[];
  const nummer = nummerFuerWhatsApp(p?.primary_phone);
  if (!nummer) return { ok: false, meldung: "Zu diesem Menschen ist keine Nummer hinterlegt, über die WhatsApp läuft." };
  const anredeRoh = String(p?.anrede ?? "").trim().toLowerCase();
  const n = kundenNamen({ kunde: { anrede: /^(herr|hr)/.test(anredeRoh) ? "Herr" : /^(frau|fr)/.test(anredeRoh) ? "Frau" : null, vorname: p?.first_name ?? null, nachname: p?.last_name ?? null } });
  const { waSenden } = await import("./fiaon-whatsapp");
  const erg = await waSenden(nummer, { vorlage: "fiaon_kk_rueckfrage", werte: [n.neutral ? String(p?.first_name ?? "").trim() || "Sie" : n.nom, "Mara"] },
    { personId, von: `Mara (${agent.name})`, absender: "Mara" });
  if (!erg.ok) return { ok: false, meldung: erg.grund ?? "Die WhatsApp ging nicht raus." };
  await lauf`
    INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, mara_an, updated_at) VALUES (${nummer}, ${personId}, TRUE, NOW())
    ON CONFLICT (nummer) DO UPDATE SET person_id = COALESCE(EXCLUDED.person_id, fiaon_whatsapp_gespraech.person_id), mara_an = TRUE, updated_at = NOW()`.catch(() => {});
  await lauf`
    INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
    VALUES (${personId}, ${agent.id}, ${agent.name}, 'system', ${`WhatsApp geschickt (Mara statt ARAS-Anruf): Vorlage „fiaon_kk_rueckfrage“ an ${nummer}.`}, NOW())`.catch(() => {});
  return { ok: true, meldung: "WhatsApp ist raus." };
}

// ── Laden, Sicht, Speichern ────────────────────────────────────────────────
interface Zeile {
  id: number; person_id: number; agent_id: number | null; von: string; von_dat: string; status: BriefingSicht["status"];
  stand: BriefingStand; verlauf: BriefingZeile[]; karte: BriefingKarte | null; auftrag_text: string | null; plan_id: number | null;
  created_at: Date; updated_at: Date; beauftragt_am: Date | null; ki_aufrufe: number; kosten_cents: number;
}
export class BriefingFehler extends Error { constructor(readonly status: number, meldung: string, readonly hinweise: string[] = []) { super(meldung); } }
const zeile = (wer: "aras" | "du", text: string, von: string | null = null): BriefingZeile => ({ wer, text, am: new Date().toISOString(), ...(von ? { von } : {}) });

async function laden(id: number, personId: number, agent: BriefingAgent, lauf: Lauf): Promise<Zeile> {
  await briefingTabelle();
  const [r] = (await lauf`SELECT * FROM fiaon_aras_briefing WHERE id = ${id} AND person_id = ${personId}`) as any[];
  if (!r) throw new BriefingFehler(404, "Diesen Chat gibt es nicht.");
  if (Number(r.agent_id) !== agent.id && !agent.leitung) throw new BriefingFehler(403, `Das ist der Auftrag von ${r.von_dat}.`);
  return { ...r, id: Number(r.id), person_id: Number(r.person_id), plan_id: r.plan_id != null ? Number(r.plan_id) : null, verlauf: Array.isArray(r.verlauf) ? r.verlauf : [] } as Zeile;
}
async function speichern(z: Zeile, felder: { stand?: BriefingStand; verlauf?: BriefingZeile[]; status?: string; karte?: BriefingKarte | null; motor?: string; kiAufrufe?: number; kostenCents?: number }, lauf: Lauf): Promise<void> {
  const stand = felder.stand ?? z.stand;
  const verlauf = (felder.verlauf ?? z.verlauf).slice(-BRIEFING_MAX.zeilen * 2);
  await lauf`
    UPDATE fiaon_aras_briefing
       SET stand = ${lauf.json(stand as any)}, verlauf = ${lauf.json(verlauf as any)}, status = ${felder.status ?? z.status},
           karte = ${felder.karte === undefined ? (z.karte ? lauf.json(z.karte as any) : null) : felder.karte ? lauf.json(felder.karte as any) : null},
           motor = COALESCE(${felder.motor ?? null}, motor), ki_aufrufe = ki_aufrufe + ${felder.kiAufrufe ?? 0},
           kosten_cents = kosten_cents + ${felder.kostenCents ?? 0}, updated_at = NOW()
     WHERE id = ${z.id}`;
}

/** Der eingeplante Anruf und seine Wiederholungen (gleicher Text, gleicher Auftraggeber, danach angelegt) — und die Anrufe. */
async function planUndAnrufe(zeilen: Zeile[], lauf: Lauf): Promise<Map<number, { planIds: number[]; arasAnrufIds: number[] }>> {
  const aus = new Map<number, { planIds: number[]; arasAnrufIds: number[] }>();
  const mit = zeilen.filter((z) => z.status === "beauftragt" && z.plan_id);
  if (!mit.length) return aus;
  const personId = mit[0].person_id;
  const plaene = (await lauf`
    SELECT id, auftrag_text, auftrag_agent_id, created_at FROM fiaon_aras_plan
     WHERE person_id = ${personId} AND spielart = 'auftrag' AND auftrag_text IS NOT NULL ORDER BY id`.catch(() => [])) as any[];
  for (const pl of plaene) {
    const direkt = mit.find((z) => z.plan_id === Number(pl.id));
    // Wiederholung: der jüngste Chat mit demselben Text und Auftraggeber, beauftragt vor dem Plan-Eintrag.
    const kandidat = direkt ?? mit
      .filter((z) => z.auftrag_text === pl.auftrag_text && Number(z.agent_id) === Number(pl.auftrag_agent_id) && z.beauftragt_am && new Date(z.beauftragt_am).getTime() <= new Date(pl.created_at).getTime() + 60_000)
      .sort((a, b) => new Date(b.beauftragt_am as Date).getTime() - new Date(a.beauftragt_am as Date).getTime())[0];
    if (!kandidat) continue;
    const e = aus.get(kandidat.id) ?? { planIds: [], arasAnrufIds: [] };
    e.planIds.push(Number(pl.id));
    aus.set(kandidat.id, e);
  }
  const alle = Array.from(aus.values()).flatMap((x) => x.planIds);
  if (alle.length) {
    const anrufe = (await lauf`SELECT id, plan_id FROM fiaon_aras_anruf WHERE plan_id = ANY(${alle}::bigint[])`.catch(() => [])) as any[];
    for (const a of anrufe) for (const e of Array.from(aus.values())) if (e.planIds.includes(Number(a.plan_id))) e.arasAnrufIds.push(Number(a.id));
  }
  return aus;
}

function sicht(z: Zeile, k: BriefingKontext | null, extra: { hinweise?: string[]; plan?: { planIds: number[]; arasAnrufIds: number[] } } = {}): BriefingSicht {
  const s = z.stand;
  const zeigeKarte = (z.status === "offen" && s.schritt === "karte") || z.status === "beauftragt";
  const karte = zeigeKarte ? karteEinpassen(z.karte ?? s.karte) : null;
  const text = z.status === "beauftragt" && z.auftrag_text ? z.auftrag_text : karte ? auftragTextAusKarte(karte) : null;
  return {
    id: z.id, status: z.status, schritt: s.schritt, zeilen: z.verlauf, chips: z.status === "offen" ? s.chips : [],
    karte, auftragText: text, zeichen: text ? text.length : 0, max: AUFTRAG_MAX_ZEICHEN,
    hinweise: extra.hinweise ?? [], von: z.von, vonDat: z.von_dat, am: new Date(z.created_at).toISOString(),
    kundeDat: k ? kundenNamen(k).dat : "dem Kunden",
    planIds: extra.plan?.planIds ?? (z.plan_id ? [z.plan_id] : []), arasAnrufIds: extra.plan?.arasAnrufIds ?? [],
    beauftragtAm: z.beauftragt_am ? new Date(z.beauftragt_am).toISOString() : null,
  };
}

// ── Starten ────────────────────────────────────────────────────────────────
/**
 * „ARAS anrufen lassen“: ein offener Chat desselben Mitarbeiters (jünger als BRIEFING_FORTSETZEN_STUNDEN) läuft weiter,
 * sonst beginnt ein neuer mit EINEM Vorschlag — oder dem Grund, warum es gerade nicht geht, und Mara.
 */
export async function briefingStarten(personId: number, agent: BriefingAgent, opt: { neu?: boolean } = {}, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<BriefingSicht> {
  await briefingTabelle();
  const k = await briefingKontext(personId, agent, lauf, jetzt);
  if (!k) throw new BriefingFehler(404, "Diesen Kunden gibt es nicht.");
  if (!opt.neu) {
    const [alt] = (await lauf`
      SELECT id FROM fiaon_aras_briefing WHERE person_id = ${personId} AND agent_id = ${agent.id} AND status = 'offen'
         AND updated_at > NOW() - make_interval(hours => ${BRIEFING_FORTSETZEN_STUNDEN}::int) ORDER BY id DESC LIMIT 1`) as any[];
    if (alt) {
      const z = await laden(Number(alt.id), personId, agent, lauf);
      // Geht Anrufen inzwischen nicht mehr (oder wieder), beginnt der Chat neu — ein alter Vorschlag wäre falsch.
      const kannNicht = z.stand.schritt === "kann_nicht";
      if (kannNicht === !k.geht.ok) return sicht(z, k);
    }
  }
  await lauf`UPDATE fiaon_aras_briefing SET status = 'verworfen', updated_at = NOW() WHERE person_id = ${personId} AND agent_id = ${agent.id} AND status = 'offen'`;
  const { zeilen, stand } = briefingEroeffnung(k, jetzt);
  const verlauf = zeilen.map((t) => zeile("aras", t));
  const [neu] = (await lauf`
    INSERT INTO fiaon_aras_briefing (person_id, agent_id, von, von_dat, status, stand, verlauf)
    VALUES (${personId}, ${agent.id}, ${agent.nom}, ${agent.dat}, 'offen', ${lauf.json(stand as any)}, ${lauf.json(verlauf as any)})
    RETURNING *`) as any[];
  return sicht({ ...neu, id: Number(neu.id), person_id: personId, plan_id: null, verlauf }, k);
}

// ── Ein Zug im Chat ────────────────────────────────────────────────────────
/** Deine Nachricht (oder ein Knopf) → ARAS' Antwort. Knöpfe mit „aktion:“ gehen an briefingAktion. */
export async function briefingAntworten(id: number, personId: number, agent: BriefingAgent, ein: { text: string; wert?: string | null }, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<BriefingSicht> {
  const wert = String(ein.wert ?? "");
  if (wert.startsWith("aktion:")) {
    const a = wert.slice(7);
    if (!istBriefingAktion(a)) throw new BriefingFehler(400, "Unbekannter Knopf.");
    return (await briefingAktion(id, personId, agent, a, lauf, jetzt, String(ein.text ?? ""))).sicht;
  }
  const z = await laden(id, personId, agent, lauf);
  if (z.status !== "offen") throw new BriefingFehler(409, "Dieser Chat ist abgeschlossen — „ARAS anrufen lassen“ beginnt einen neuen.");
  const text = kuerzen(ein.text, BRIEFING_MAX.eingabe);
  if (!text && !wert) throw new BriefingFehler(400, "Schreib kurz, was ARAS wissen soll.");
  if (z.verlauf.length >= BRIEFING_MAX.zeilen) throw new BriefingFehler(409, "Der Chat ist voll — die Karte steht oben; oder fang neu an.");
  const k = await briefingKontext(personId, agent, lauf, jetzt);
  if (!k) throw new BriefingFehler(404, "Diesen Kunden gibt es nicht.");

  // Geht Anrufen inzwischen nicht mehr: das in EINER Zeile — und Mara (statt einer Karte, die nicht mehr eingeplant werden kann).
  // Geht es inzwischen wieder: ein frischer Vorschlag statt „geht grad ned“.
  if (!k.geht.ok !== (z.stand.schritt === "kann_nicht")) {
    const { zeilen, stand } = briefingEroeffnung(k, jetzt);
    const verlauf = [...z.verlauf, zeile("du", text || "…", agent.nom), ...zeilen.map((t) => zeile("aras", t))];
    await speichern(z, { stand, verlauf, karte: null }, lauf);
    return sicht({ ...z, stand, verlauf, karte: null }, k);
  }

  const r = briefingWeiter(k, z.stand, { text, wert }, jetzt);
  let stand = r.stand;
  let antworten = r.zeilen;
  let motor: string | undefined;
  let kiAufrufe = 0, kostenCents = 0;
  const duZeile = zeile("du", r.eingabe || text, agent.nom);
  const verlaufMitDir = [...z.verlauf, duZeile];

  if (r.modellErlaubt && stand.modellZuege < BRIEFING_MAX.modellZuege) {
    const eingaben = verlaufMitDir.filter((x) => x.wer === "du").map((x) => x.text);
    const a = await modellFragen({ system: modellAnweisung(k, stand), nachrichten: modellVerlauf(verlaufMitDir) });
    if (a.text != null || a.kostenCents) { kiAufrufe = 1; kostenCents = a.kostenCents; }
    const zug = a.text ? modellAntwortLesen(a.text, k, stand.karte, eingaben, jetzt) : null;
    // Eine KI-Karte, die zur Karte führen soll, aber unvollständig ist, gilt nicht — dann bleibt die Karte des Leitfadens.
    const zurKarteRoh = !!zug && (stand.schritt === "karte" || (zug.fertig && karteVollstaendig(zug.karte)) || stand.rueckfragen >= BRIEFING_RUECKFRAGEN);
    if (zug && !(zurKarteRoh && !karteVollstaendig(zug.karte))) {
      stand = { ...stand, karte: zug.karte, modellZuege: stand.modellZuege + 1 };
      motor = "ki";
      const zurKarte = zurKarteRoh;
      if (zurKarte) {
        stand = { ...stand, schritt: "karte", chips: [] };
        const letzte = zug.antwort && !zug.antwort.includes("?") ? zug.antwort : z.stand.schritt === "karte" ? "Passt, hab ich angepasst." : frageFuer("karte", stand);
        antworten = [...antworten.slice(0, -1), letzte];
      } else {
        if (zug.antwort) antworten = [...antworten.slice(0, -1), zug.antwort];
        if (zug.antwort && zug.chips.length) stand = { ...stand, chips: zug.chips.map((t) => ({ text: t, wert: "" })) };
      }
    }
  }

  // Steht die Karte: als Ganzes noch einmal durch die Wand (Felder einzeln, damit der Hinweis sagt, wo).
  let hinweise = r.hinweise;
  if (stand.schritt === "karte") {
    const w = karteWandPruefen(stand.karte, kundenNamen(k));
    stand = { ...stand, karte: karteEinpassen(w.karte) };
    if (!w.ok && w.antwort) { antworten = [...antworten, w.antwort.text]; hinweise = w.antwort.hinweise; }
    for (const f of w.fix) antworten = [...antworten, fuerKunde(f, kundenNamen(k))];
  }
  const verlauf = [...verlaufMitDir, ...antworten.map((t) => zeile("aras", t))];
  const karte = stand.schritt === "karte" ? stand.karte : null;
  await speichern(z, { stand, verlauf, karte, motor, kiAufrufe, kostenCents }, lauf);
  return sicht({ ...z, stand, verlauf, karte }, k, { hinweise });
}

// ── „Ändern“: die Karte von Hand ───────────────────────────────────────────
export async function briefingKarteSetzen(id: number, personId: number, agent: BriefingAgent, roh: Partial<BriefingKarte>, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<{ ok: boolean; sicht: BriefingSicht; hinweise: string[] }> {
  const z = await laden(id, personId, agent, lauf);
  if (z.status !== "offen" || z.stand.schritt !== "karte") throw new BriefingFehler(409, "Die Karte lässt sich gerade nicht ändern.");
  const k = await briefingKontext(personId, agent, lauf, jetzt);
  if (!k) throw new BriefingFehler(404, "Diesen Kunden gibt es nicht.");
  const n = kundenNamen(k);
  const erlaubt = Array.from(new Set([...z.stand.karte.punkte, ...k.offen.map((p) => p.art)]));
  const sauber = karteSaeubern({ ...roh, punkte: z.stand.karte.punkte }, erlaubt);
  const w = karteWandPruefen(sauber, n);
  const du = zeile("du", "Karte geändert.", agent.nom);
  if (!w.ok) {
    const verlauf = [...z.verlauf, du, ...(w.antwort ? [zeile("aras", w.antwort.text)] : [])];
    await speichern(z, { verlauf }, lauf);
    return { ok: false, sicht: sicht({ ...z, verlauf }, k, { hinweise: w.antwort?.hinweise ?? [] }), hinweise: w.antwort?.hinweise ?? [] };
  }
  const passt = karteEinpassen(w.karte);
  if (!karteVollstaendig(passt)) throw new BriefingFehler(400, "Ein Ziel und etwas zum Sagen oder Fragen braucht's.");
  const gekuerzt = auftragTextAusKarte(w.karte).length > AUFTRAG_MAX_ZEICHEN;
  const antworten = ["Passt, hab ich übernommen.", ...(gekuerzt ? [`Das war länger als ${AUFTRAG_MAX_ZEICHEN} Zeichen — ich hab gekürzt, schau kurz drüber.`] : []), ...w.fix.map((f) => fuerKunde(f, n))];
  const stand: BriefingStand = { ...z.stand, karte: passt, wand: null, chips: [] };
  const verlauf = [...z.verlauf, du, ...antworten.map((t) => zeile("aras", t))];
  await speichern(z, { stand, verlauf, karte: passt }, lauf);
  return { ok: true, sicht: sicht({ ...z, stand, verlauf, karte: passt }, k), hinweise: [] };
}

// ── „Passt – ARAS anrufen lassen“ ──────────────────────────────────────────
/** Morgen um HH:MM (Berlin) aus dem eingeplanten „morgen 09:00“. */
async function morgenUm(planId: number, ab: string, lauf: Lauf): Promise<Date | null> {
  const [pl] = (await lauf`SELECT frueh_ab FROM fiaon_aras_plan WHERE id = ${planId}`) as any[];
  if (!pl?.frueh_ab) return null;
  const [h, m] = ab.split(":").map(Number);
  return new Date(new Date(pl.frueh_ab).getTime() + ((h * 60 + m) - 9 * 60) * 60_000);
}

export async function briefingBeauftragen(id: number, personId: number, agent: BriefingAgent, ein: { wann?: unknown; ab?: unknown; benachrichtigen?: unknown }, lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<{ ok: boolean; sicht: BriefingSicht; meldung: string | null; grund: string | null; hinweise: string[] }> {
  const z = await laden(id, personId, agent, lauf);
  if (z.status !== "offen" || z.stand.schritt !== "karte" || !z.karte) throw new BriefingFehler(409, "Erst steht die Karte, dann ruft ARAS an.");
  const k = await briefingKontext(personId, agent, lauf, jetzt);
  if (!k) throw new BriefingFehler(404, "Diesen Kunden gibt es nicht.");
  const n = kundenNamen(k);
  const wann: BriefingWann = (AUFTRAG_WANN as readonly string[]).includes(String(ein.wann)) ? (ein.wann as BriefingWann) : z.karte.wann;
  const ab = typeof ein.ab === "string" && UHRZEIT_RE.test(ein.ab) ? ein.ab : z.karte.ab;
  const roh = karteEinpassen({ ...z.karte, wann, ab: wann === "bald" ? null : ab ?? (wann === "heute_ab" ? "17:00" : null) });
  const nein = async (grund: string, hinweise: string[], satz: string) => {
    const verlauf = [...z.verlauf, zeile("aras", satz)];
    await speichern(z, { verlauf }, lauf);
    return { ok: false, sicht: sicht({ ...z, verlauf }, k, { hinweise }), meldung: null, grund, hinweise };
  };
  // Die Wand ein zweites Mal — falls die Karte je an ihr vorbei in die Datenbank kam (Rot-Probe im Prüfstand).
  const w = karteWandPruefen(roh, n);
  if (!w.ok) return nein("So gibt ARAS den Auftrag nicht weiter.", w.antwort?.hinweise ?? [], w.antwort?.text ?? "Das darf ich so ned sagen — magst du die Karte ändern?");
  const kar = karteEinpassen(w.karte);
  if (!karteVollstaendig(kar)) return nein("Die Karte ist noch nicht vollständig.", [], "Mir fehlt noch, was ich sagen oder fragen soll — magst du die Karte ergänzen?");
  const text = auftragTextAusKarte(kar);
  const r = await arasAuftragGeben(personId, {
    punkte: kar.punkte, auftrag: text, wann: kar.wann, ab: kar.wann === "heute_ab" ? kar.ab : null, benachrichtigen: ein.benachrichtigen !== false,
  }, agent.id, lauf);
  if (!r.ok || !r.id) {
    const hinweise = r.hinweise ?? [];
    return nein(r.grund ?? "Ließ sich nicht einplanen.", hinweise, `Das ging grad ned: ${r.grund ?? "Ließ sich nicht einplanen."}`);
  }
  // „Morgen ab 17 Uhr“: der Kern plant morgen 9 Uhr — der eine Eintrag rückt auf die gewünschte Uhrzeit.
  if (kar.wann === "morgen" && kar.ab && kar.ab !== "09:00") {
    const bis = await morgenUm(r.id, kar.ab, lauf).catch(() => null);
    if (bis) await planVerschieben(r.id, bis, `Auftrag aus dem Chat: morgen ab ${kar.ab}`, agent.nom, lauf).catch(() => null);
  }
  const satz = `Passt, ist eingeplant: Ich ruf${n.ihnOpt} ${wannText(kar.wann, kar.ab)} an.${ein.benachrichtigen === false ? "" : " Danach bekommst du eine Nachricht im Office."}`;
  const stand: BriefingStand = { ...z.stand, schritt: "fertig", chips: [], karte: kar };
  const verlauf = [...z.verlauf, zeile("du", "Passt – ARAS anrufen lassen", agent.nom), zeile("aras", satz)];
  await lauf`
    UPDATE fiaon_aras_briefing SET status = 'beauftragt', plan_id = ${r.id}, auftrag_text = ${text}, karte = ${lauf.json(kar as any)},
           stand = ${lauf.json(stand as any)}, verlauf = ${lauf.json(verlauf as any)}, beauftragt_am = NOW(), updated_at = NOW()
     WHERE id = ${z.id}`;
  const fertig: Zeile = { ...z, status: "beauftragt", plan_id: r.id, auftrag_text: text, karte: kar, stand, verlauf, beauftragt_am: new Date() };
  return { ok: true, sicht: sicht(fertig, k), meldung: `Eingeplant: ARAS ruft ${wannText(kar.wann, kar.ab)} an.`, grund: null, hinweise: [] };
}

// ── Knöpfe: Mara, wieder an, zurücknehmen, schließen ───────────────────────
export async function briefingAktion(id: number, personId: number, agent: BriefingAgent, aktion: BriefingAktion, lauf: Lauf = sqlPool, jetzt: Date = new Date(), knopfText = ""): Promise<{ ok: boolean; sicht: BriefingSicht; meldung: string | null }> {
  const z = await laden(id, personId, agent, lauf);
  if (z.status !== "offen") throw new BriefingFehler(409, "Dieser Chat ist abgeschlossen.");
  const k = await briefingKontext(personId, agent, lauf, jetzt);
  if (!k) throw new BriefingFehler(404, "Diesen Kunden gibt es nicht.");
  const n = kundenNamen(k);
  const du = zeile("du", knopfText || ({ mara: "Ja, Mara soll schreiben", wieder_an: "ARAS wieder einschalten", zuruecknehmen: "Geplanten Anruf zurücknehmen", schliessen: "Nein, danke" } as const)[aktion], agent.nom);

  if (aktion === "schliessen") {
    const verlauf = [...z.verlauf, du];
    await speichern(z, { verlauf, status: "verworfen" }, lauf);
    return { ok: true, sicht: sicht({ ...z, verlauf, status: "verworfen" }, k), meldung: null };
  }
  // Neu anfangen nach „wieder an“ / „zurücknehmen“: dieselbe Eröffnung wie beim Öffnen, im selben Chat.
  const neuBeginnen = async (vorweg: string): Promise<{ ok: boolean; sicht: BriefingSicht; meldung: string | null }> => {
    const k2 = await briefingKontext(personId, agent, lauf, jetzt);
    const { zeilen, stand } = briefingEroeffnung(k2 ?? k, jetzt);
    const verlauf = [...z.verlauf, du, zeile("aras", vorweg), ...zeilen.map((t) => zeile("aras", t))];
    await speichern(z, { stand, verlauf, karte: null }, lauf);
    return { ok: true, sicht: sicht({ ...z, stand, verlauf, karte: null }, k2 ?? k), meldung: null };
  };
  if (aktion === "wieder_an") {
    if (!k.sperre.aus || k.sperre.telefonGesperrt) throw new BriefingFehler(409, "ARAS ist für diesen Kunden nicht ausgeschaltet.");
    await arasFuerPersonSchalten(personId, false, null, agent.id, agent.nom, lauf);
    return neuBeginnen("Bin wieder da.");
  }
  if (aktion === "zuruecknehmen") {
    if (!k.geplant) throw new BriefingFehler(409, "Es wartet gerade kein Auftrag für diesen Kunden.");
    const r = await arasAuftragZuruecknehmen(personId, k.geplant.id, agent.id, agent.leitung, lauf);
    if (!r.ok) {
      const verlauf = [...z.verlauf, du, zeile("aras", `Das ging grad ned: ${r.grund ?? "Ließ sich nicht zurücknehmen."}`)];
      await speichern(z, { verlauf }, lauf);
      return { ok: false, sicht: sicht({ ...z, verlauf }, k), meldung: null };
    }
    return neuBeginnen("Erledigt — der geplante Anruf ist zurückgenommen.");
  }
  // Mara
  if (!k.mara) {
    const verlauf = [...z.verlauf, du, zeile("aras", "Mara kann bei diesem Kunden nicht schreiben — das übernimmst am besten du selbst.")];
    await speichern(z, { verlauf }, lauf);
    return { ok: false, sicht: sicht({ ...z, verlauf }, k), meldung: null };
  }
  const weg = k.mara.weg;
  const r = await maraSchreiben(weg, personId, agent, lauf).catch((e) => ({ ok: false, meldung: String((e as Error)?.message ?? e).slice(0, 200) }));
  const satz = r.ok
    ? fuerKunde(`Erledigt — Mara hat ${n.neutral ? "dem Kunden" : n.ihm} ${MARA_WAS[weg]} geschickt.${weg === "whatsapp" ? " Antwortet er, übernimmt sie." : ""}`, n)
    : `Ging ned: ${kuerzen(r.meldung, 200).replace(/\.{2,}/g, ".")}`;
  const verlauf = [...z.verlauf, du, zeile("aras", satz)];
  const stand: BriefingStand = r.ok ? { ...z.stand, schritt: "fertig", chips: [] } : z.stand;
  await lauf`
    UPDATE fiaon_aras_briefing SET status = ${r.ok ? "mara" : "offen"}, mara_weg = ${weg}, mara_meldung = ${kuerzen(r.meldung, 300)},
           stand = ${lauf.json(stand as any)}, verlauf = ${lauf.json(verlauf as any)}, updated_at = NOW()
     WHERE id = ${z.id}`;
  return { ok: r.ok, sicht: sicht({ ...z, status: r.ok ? "mara" : "offen", stand, verlauf }, k), meldung: r.ok ? satz : null };
}

// ── Der Verlauf in der Karte: wer hat was angewiesen ───────────────────────
/** Die letzten Aufträge aus dem Chat (beauftragt oder an Mara gegeben) — mit Karte, Chat und den Anrufen daraus. */
export async function briefingVerlauf(personId: number, lauf: Lauf = sqlPool): Promise<BriefingSicht[]> {
  await briefingTabelle();
  const zeilen = ((await lauf`
    SELECT * FROM fiaon_aras_briefing WHERE person_id = ${personId} AND status IN ('beauftragt', 'mara') ORDER BY id DESC LIMIT 10`) as any[])
    .map((r) => ({ ...r, id: Number(r.id), person_id: Number(r.person_id), plan_id: r.plan_id != null ? Number(r.plan_id) : null, verlauf: Array.isArray(r.verlauf) ? r.verlauf : [] }) as Zeile);
  const plan = await planUndAnrufe(zeilen, lauf);
  return zeilen.map((z) => sicht(z, null, { plan: plan.get(z.id) }));
}
