// ═══════════════════════════════════════════════════════════════════════════
// MARA HANDELT: RÜCKRUFE ALS ECHTE TERMINE (24.09.2026, E-236)
//
// Justin, mit zwei echten Chats vor Augen (Ferat Met „12:25 Uhr", Hitesh
// Dahiya „1-3"): „Macht Mara Nikita auch wirklich den Termin? Mara muss 100 %
// handeln, und wenn sie Nikita den Termin plant, dann schauen, ob er frei ist,
// ob es in seinen Arbeitszeiten ist … Ich muss sehen, was Mara gemacht hat und
// ob das alles stimmt." — Bis heute schrieb Mara „Nikita kümmert sich um den
// Rückruf" und legte nur eine Aufgabe an. Im Kalender stand nichts.
//
// ── DIE REGELN (aus der Kartierung vom 24.09., alle belegt) ─────────────────
//   · Wer anruft, entscheidet der Server — nie das Modell. Der Betreuer nur,
//     wenn er aktiv ist, nicht gesperrt, kein Testkonto, nicht im
//     Forderungsmanagement und Arbeitszeiten hat. Sonst der Pool wie auf der
//     Terminseite (freieSlots), und buchungAnwenden bindet den Kunden.
//   · Gebucht wird NUR ein Platz aus der Rechnung, die auch die Buchung
//     annimmt (rohSlots im 20-Minuten-Raster ab Fensterbeginn). Eine vom
//     Kunden genannte Zeit wird auf den nächsten freien Platz gelegt
//     (höchstens 20 Minuten später, 10 Minuten früher) — und Mara nennt dem
//     Kunden dann genau diese Zeit, aus der gespeicherten Zeile gelesen.
//   · Frei heißt: kein Termin des Mitarbeiters überschneidet sich (mit Dauer,
//     nicht nur gleicher Beginn), keine vom Mitarbeiter abgesagte Zeit,
//     mindestens 20 Minuten Vorlauf.
//   · Ein Kunde, ein künftiger Termin. Ein zweiter Wunsch verschiebt den
//     Termin, den Mara gebucht hat; einen fremden Termin rührt sie nicht an.
//   · Nach der Buchung buchungAnwenden — es meldet den Mitarbeiter (Mail mit
//     „von Mara"), setzt die Wiedervorlage, beendet den Wartezustand. NICHT
//     zusätzlich buchungMelden (sonst zwei Mails).
//   · Jede Handlung — auch jede, die NICHT ging, und warum — steht in
//     fiaon_mara_protokoll. Die Akte (contact_log) braucht eine Bestellung;
//     38 von 67 WhatsApp-Menschen haben keine. Das Protokoll ist deshalb die
//     maßgebliche Spur.
//   · Der Kreislauf: maraTermineNachpruefen() prüft jede Mara-Buchung erneut —
//     steht der Termin, in der Arbeitszeit, ohne Überschneidung, Mail raus,
//     Kunde hat die Uhrzeit bekommen. Was nicht stimmt, wird eine dringende
//     Aufgabe und steht rot im Protokoll.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  rohSlots, freieSlots, terminBuchen, buchungAnwenden, terminLink, versuchProtokollieren,
  verfuegbarkeitVon, berlinDatumText, berlinUhrzeit, stornoLink, terminAbsagen, TerminFehler,
  type Slot, type Buchung,
} from "./fiaon-termine";
import { berlinDatum, berlinWochentag, zeitZuMinuten, parseBerlinInput } from "./fiaon-time";
import { berlinWochentagName } from "./fiaon-termin-meldung";
import { zeitFuerKunde, uhrzeitenIn, type AbweichungsGrund } from "@shared/fiaon-mara-ton";
import {
  vertretungFuerPerson, freiePlaetzeVertreter, belegtFuerVertreter, anruferFuer, abwesenheitJetzt, istAbwesend, bisText,
} from "./fiaon-abwesenheit";

type Lauf = typeof sqlPool;

/** Frühestens so viele Minuten ab jetzt — ein Mensch muss den Termin sehen können. */
export const MARA_VORLAUF_MIN = 20;
/** So weit schaut Mara für ein Angebot voraus (Tage mit freien Zeiten). */
const ANGEBOT_TAGE = 3;
const QUELLE = "agent_manuell";
export const MARA_HERKUNFT = "mara_whatsapp";
export const MARA_HERKUNFT_LINK = "mara_whatsapp_link";
/**
 * E-248: Termine, die Mara selbst verschieben darf — ihre eigenen Buchungen und
 * die, die der Kunde über IHREN Terminlink gewählt hat. Alle anderen (vom Team,
 * über eine Mail gebucht, Startgespräch) fasst sie nicht an: Sie nennt sie und
 * gibt dem Betreuer Bescheid, wenn der Kunde eine andere Zeit will.
 */
export const MARA_EIGENE_HERKUNFT = [MARA_HERKUNFT, MARA_HERKUNFT_LINK];

/**
 * Nachbesserung E-248 (Probelauf #8, Justin 28.09.: „Einiges kann sie doch selbst
 * machen"): Hat der KUNDE den Termin selbst gebucht (irgendein Terminlink, auch aus
 * der Erinnerungsmail), darf Mara ihn auf seinen Wunsch auf einen freien Platz
 * DESSELBEN Betreuers verschieben. Vom Team eingetragene Termine und das
 * Startgespräch fasst sie weiter nicht an. Rein.
 */
export function kundeHatSelbstGebucht(herkunft: string | null | undefined, quelle?: string | null): boolean {
  const h = String(herkunft ?? "");
  if (!h || h === "unbekannt" || h === "agent" || String(quelle ?? "") === "agent_manuell") return false;
  if (/onboarding/.test(h) || String(quelle ?? "") === "onboarding_call") return false;
  return true;
}

/** Woher ein Termin kam — in Worten für Mara (STAND DES GESPRÄCHS). */
export function terminHerkunftText(herkunft: string | null | undefined, quelle?: string | null): string {
  const h = String(herkunft ?? "");
  if (h === MARA_HERKUNFT) return "von dir gebucht";
  if (h === MARA_HERKUNFT_LINK) return "er hat ihn über deinen Terminlink selbst gewählt";
  if (String(quelle ?? "") === "agent_manuell" || h === "agent") return "vom Team eingetragen";
  if (/onboarding/.test(h) || String(quelle ?? "") === "onboarding_call") return "sein Startgespräch";
  if (h && h !== "unbekannt") return "er hat ihn selbst über einen Terminlink gebucht";
  return "im Kalender eingetragen";
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS PROTOKOLL — was Mara getan hat, für den Geschäftsführer prüfbar
// ═══════════════════════════════════════════════════════════════════════════
export type ProtokollArt =
  | "zeiten_angeboten" | "termin_gebucht" | "termin_verschoben" | "termin_nicht_moeglich"
  | "terminlink" | "uebergabe" | "rueckfall" | "zahlungszusage"
  // E-248: Mara schweigt bewusst (Autoantwort, „Ok" nach Team oder erledigter Sache, doppelt),
  // schließt mit einem kurzen Satz ab, oder schickt statt des Rückfallsatzes einen sicheren Satz aus der Lage.
  | "still" | "abschluss" | "sicherer_satz";

let tabelleBereit: Promise<void> | null = null;
export function protokollTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_mara_protokoll (
          id BIGSERIAL PRIMARY KEY,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          kanal TEXT NOT NULL DEFAULT 'whatsapp',
          nummer TEXT,
          person_id INTEGER,
          lead_id INTEGER,
          art TEXT NOT NULL,
          ok BOOLEAN NOT NULL DEFAULT TRUE,
          text TEXT NOT NULL,
          daten JSONB,
          termin_id INTEGER,
          pruefung_am TIMESTAMPTZ,
          pruefung_ok BOOLEAN,
          pruefung_text TEXT,
          gemeldet_am TIMESTAMPTZ
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_mara_protokoll_nummer ON fiaon_mara_protokoll (nummer, am DESC)`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_mara_protokoll_am ON fiaon_mara_protokoll (am DESC)`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_mara_protokoll_termin ON fiaon_mara_protokoll (termin_id) WHERE termin_id IS NOT NULL`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      tabelleBereit = null;
      throw e;
    });
  }
  return tabelleBereit;
}

export async function protokollieren(ein: {
  art: ProtokollArt; ok?: boolean; text: string; nummer?: string | null; personId?: number | null;
  leadId?: number | null; daten?: Record<string, unknown> | null; terminId?: number | null; kanal?: string;
}, lauf: Lauf = sqlPool): Promise<number | null> {
  try {
    await protokollTabelle(lauf);
    const [z] = (await lauf`
      INSERT INTO fiaon_mara_protokoll (kanal, nummer, person_id, lead_id, art, ok, text, daten, termin_id)
      VALUES (${ein.kanal ?? "whatsapp"}, ${ein.nummer ?? null}, ${ein.personId ?? null}, ${ein.leadId ?? null},
              ${ein.art}, ${ein.ok ?? true}, ${ein.text.slice(0, 1000)},
              ${ein.daten ? lauf.json(ein.daten as any) : null}, ${ein.terminId ?? null})
      RETURNING id`) as any[];
    return z ? Number(z.id) : null;
  } catch (e) {
    console.error("[MARA-TERMIN] Protokoll nicht geschrieben:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WER RUFT AN?
// ═══════════════════════════════════════════════════════════════════════════
export interface Zustaendig { id: number; vorname: string; name: string }

/**
 * Der Betreuer — aber nur, wenn er wirklich anrufen kann. Sonst null mit Grund;
 * dann nimmt Mara den Pool der Terminseite (freieSlots).
 */
export async function betreuerFuerRueckruf(personId: number, lauf: Lauf = sqlPool): Promise<{ agent: Zustaendig | null; grund: string | null }> {
  const [a] = (await lauf`
    SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname,
           COALESCE(a.active, TRUE) AS aktiv, a.zugang_gesperrt_am, COALESCE(a.is_test_account, FALSE) AS test,
           COALESCE(a.rolle, 'agent') AS rolle
      FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL`) as any[];
  if (!a) return { agent: null, grund: "kein Betreuer" };
  if (!a.aktiv) return { agent: null, grund: `${a.name} ist nicht aktiv` };
  if (a.zugang_gesperrt_am) return { agent: null, grund: `${a.name} ist gesperrt` };
  if (a.test) return { agent: null, grund: `${a.name} ist ein Testkonto` };
  if (a.rolle === "inkasso") return { agent: null, grund: `${a.name} ist im Forderungsmanagement (keine Rückruftermine)` };
  const zeiten = (await verfuegbarkeitVon(Number(a.id), lauf)).filter((z) => z.aktiv);
  if (!zeiten.length) return { agent: null, grund: `${a.name} hat keine Arbeitszeiten eingetragen` };
  return { agent: { id: Number(a.id), vorname: String(a.vorname), name: String(a.name) }, grund: null };
}

/** Die Arbeitszeit eines Mitarbeiters an einem Tag, „09:30–20:00" — oder null. */
export async function arbeitszeitAm(agentId: number, datumISO: string, lauf: Lauf = sqlPool): Promise<string | null> {
  const wt = berlinWochentag(datumISO);
  const f = (await verfuegbarkeitVon(agentId, lauf)).filter((z) => z.aktiv && z.wochentag === wt);
  return f.length ? f.map((z) => `${z.von}–${z.bis}`).join(", ") : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FREIE ZEITEN
// ═══════════════════════════════════════════════════════════════════════════
export interface Angebot {
  slots: Slot[];
  /** Wer anruft, wenn es einen festen gibt. */
  agent: Zustaendig | null;
  /**
   * „betreuer" = nur seine Zeiten; „pool" = Terminseite mit Lastverteilung;
   * „abwesenheit" (E-260) = Team abwesend: vor „bis" die Zeiten des Vertreters,
   * danach wieder die des Betreuers.
   */
  weg: "betreuer" | "pool" | "abwesenheit" | "keiner";
  grund: string | null;
  /** E-260: gesetzt, wenn die Abwesenheit für diesen Menschen gilt. */
  abwesenheit?: {
    vertreterId: number; vertreterName: string; anrufName: string; bis: string; betreuer: { id: number; vorname: string } | null;
    /**
     * Wessen Plätze ab „bis" gelten (Gegenprüfung 29.09.): der Betreuer, der
     * Vertreter (er ist selbst der Betreuer), der Pool (kein buchbarer Betreuer —
     * dann ruft, wer den Platz hat) oder niemand. `agent` = wer dann anruft.
     */
    nach: { weg: "betreuer" | "vertreter" | "pool" | "keiner"; agent: Zustaendig | null };
  } | null;
}

/** Überschneidet sich [beginn, beginn+dauer) mit einem gebuchten Termin des Mitarbeiters? */
async function belegteZeiten(agentIds: number[], lauf: Lauf): Promise<Map<number, { von: number; bis: number }[]>> {
  const karte = new Map<number, { von: number; bis: number }[]>();
  if (!agentIds.length) return karte;
  const zeilen = (await lauf`
    SELECT agent_id, beginn, COALESCE(dauer_min, 20) AS dauer FROM fiaon_termine
     WHERE agent_id = ANY(${agentIds}) AND status = 'gebucht'
       AND beginn > NOW() - INTERVAL '2 hours' AND beginn < NOW() + INTERVAL '15 days'`) as any[];
  for (const z of zeilen) {
    const von = new Date(z.beginn).getTime();
    const liste = karte.get(Number(z.agent_id)) ?? [];
    liste.push({ von, bis: von + Number(z.dauer) * 60_000 });
    karte.set(Number(z.agent_id), liste);
  }
  return karte;
}

export async function freieZeiten(personId: number, lauf: Lauf = sqlPool): Promise<Angebot> {
  // ── E-260 (29.09.2026): TEAM ABWESEND — DER VERTRETER RUFT AN ──────────
  // Justin: „Die anderen Mitarbeiter arbeiten erst wieder am Freitag. Bis dahin
  // schupfe ich das ganze." Gilt die Abwesenheit für diesen Menschen (sein
  // Betreuer ist weg, oder er hat keinen, der Rückrufe führen kann), bucht Mara
  // vor „bis" NUR im Kalender des Vertreters — sein Raster, 20 Minuten Vorlauf,
  // und belegt ist auch, was er für die Abwesenden anrufen muss (B4). Nach
  // „bis" wieder beim Betreuer: Er ist dann zurück. Regeln: fiaon-abwesenheit.ts.
  const vt = await vertretungFuerPerson(personId, lauf).catch((e) => {
    console.error("[MARA-TERMIN] Abwesenheit nicht lesbar — Mara bucht wie ohne:", String((e as Error)?.message ?? e).slice(0, 160));
    return null;
  });
  if (vt) {
    const v = vt.ab.vertreter;
    const bisMs = vt.ab.bis.getTime();
    const vor = await freiePlaetzeVertreter(vt.ab, MARA_VORLAUF_MIN, lauf);
    // Ab „bis" der normale Weg — Gegenprüfung 29.09.: vorher gab es nach „bis" nur
    // Plätze eines buchbaren Betreuers. Kunden ohne einen (40 % von Maras Buchungen
    // liefen über den Pool) bekamen nur Justins Zeiten vor „bis" — ab Do 18 Uhr gar
    // keine, und der Terminlink war gesperrt: eine Sackgasse.
    let nach: Slot[] = [];
    let nachWeg: NonNullable<Angebot["abwesenheit"]>["nach"] = { weg: "keiner", agent: null };
    if (vt.betreuer && vt.betreuer.id === v.id) {
      // Der Vertreter IST sein Betreuer: nach „bis" weiter bei ihm.
      nach = await freiePlaetzeVertreter(vt.ab, MARA_VORLAUF_MIN, lauf, { nachBis: true });
      nachWeg = { weg: "vertreter", agent: { id: v.id, vorname: v.anrufName, name: v.name } };
    } else if (vt.betreuer && vt.betreuerBuchbar) {
      const roh = (await rohSlots([{ id: vt.betreuer.id, vorname: vt.betreuer.vorname }], 20, lauf, MARA_VORLAUF_MIN * 60_000))
        .filter((s) => new Date(s.beginn).getTime() >= bisMs);
      const belegt = (await belegteZeiten([vt.betreuer.id], lauf)).get(vt.betreuer.id) ?? [];
      nach = roh.filter((s) => {
        const von = new Date(s.beginn).getTime();
        return !belegt.some((b) => b.von < von + 20 * 60_000 && b.bis > von);
      });
      nachWeg = { weg: "betreuer", agent: { id: vt.betreuer.id, vorname: vt.betreuer.vorname, name: vt.betreuer.name } };
    } else {
      // Kein buchbarer Betreuer (keiner, gesperrt, inaktiv, Testkonto, Forderungsmanagement):
      // wie ohne Abwesenheit der Pool der Terminseite — nur die Plätze ab „bis".
      const pool = (await freieSlots(personId, lauf, QUELLE)).slots.filter((s) => new Date(s.beginn).getTime() >= bisMs);
      const belegt = await belegteZeiten(Array.from(new Set(pool.map((s) => s.agentId))), lauf);
      nach = pool.filter((s) => {
        const von = new Date(s.beginn).getTime();
        return !(belegt.get(s.agentId) ?? []).some((b) => b.von < von + 20 * 60_000 && b.bis > von);
      });
      nachWeg = { weg: nach.length ? "pool" : "keiner", agent: null };
    }
    const slots = [...vor, ...nach].sort((a, b) => a.beginn.localeCompare(b.beginn));
    return {
      slots,
      agent: { id: v.id, vorname: v.anrufName, name: v.name },
      weg: slots.length ? "abwesenheit" : "keiner",
      grund: `${vt.betreuer ? `Betreuer ${vt.betreuer.vorname} (#${vt.betreuer.id})` : "kein Betreuer"} — Team bis ${bisText(vt.ab.bis)} abwesend, ${v.name} ruft an`,
      abwesenheit: {
        vertreterId: v.id, vertreterName: v.name, anrufName: v.anrufName, bis: vt.ab.bis.toISOString(),
        betreuer: vt.betreuer ? { id: vt.betreuer.id, vorname: vt.betreuer.vorname } : null,
        nach: nachWeg,
      },
    };
  }

  const { agent, grund } = await betreuerFuerRueckruf(personId, lauf);
  let slots: Slot[];
  let weg: Angebot["weg"];
  if (agent) {
    slots = await rohSlots([{ id: agent.id, vorname: agent.vorname }], 20, lauf, MARA_VORLAUF_MIN * 60_000);
    weg = "betreuer";
  } else {
    // Wie die Terminseite: Pool mit Lastverteilung, gesperrte zählen nicht (freieSlots).
    const a = await freieSlots(personId, lauf, QUELLE);
    slots = a.slots;
    // E-260 (Gegenprüfung 29.09.): Sind nur einzelne abwesend, bleibt ein Kunde ohne
    // buchbaren Betreuer im Pool — aber vor „bis" zählen dort nur die Anwesenden.
    const ab = await abwesenheitJetzt(lauf).catch(() => null);
    if (ab) slots = slots.filter((s) => !istAbwesend(ab, s.agentId, s.beginn));
    weg = slots.length ? "pool" : "keiner";
  }
  // rohSlots kennt nur „gleicher Beginn" — hier zählt jede Überschneidung mit Dauer.
  const belegt = await belegteZeiten(Array.from(new Set(slots.map((s) => s.agentId))), lauf);
  slots = slots.filter((s) => {
    const von = new Date(s.beginn).getTime();
    const bis = von + 20 * 60_000;
    return !(belegt.get(s.agentId) ?? []).some((b) => b.von < bis && b.bis > von);
  });
  return { slots, agent, weg, grund };
}

/** „heute 14:10", „morgen 09:30", „Freitag, 26.09. 10:10" — so, wie Mara es schreibt. */
export function slotText(beginn: string | Date, jetzt = new Date()): string {
  const d = typeof beginn === "string" ? new Date(beginn) : beginn;
  const tag = berlinDatum(d);
  const heute = berlinDatum(jetzt);
  const morgen = berlinDatum(new Date(jetzt.getTime() + 86_400_000));
  const uhr = berlinUhrzeit(d);
  if (tag === heute) return `heute ${uhr} Uhr`;
  if (tag === morgen) return `morgen ${uhr} Uhr`;
  return `${berlinWochentagName(d)}, ${berlinDatumText(d).slice(0, 6)} ${uhr} Uhr`;
}

/** Zwei bis vier gestreute Vorschläge, gern im Wunschfenster. */
export function vorschlaege(slots: Slot[], wunsch?: { von?: Date | null; bis?: Date | null }, hoechstens = 3): Slot[] {
  let pool = slots;
  if (wunsch?.von || wunsch?.bis) {
    const im = slots.filter((s) => {
      const t = new Date(s.beginn).getTime();
      return (!wunsch.von || t >= wunsch.von.getTime()) && (!wunsch.bis || t <= wunsch.bis.getTime());
    });
    if (im.length) pool = im;
  }
  const tage = Array.from(new Set(pool.map((s) => s.datum))).slice(0, ANGEBOT_TAGE);
  pool = pool.filter((s) => tage.includes(s.datum));
  if (pool.length <= hoechstens) return pool;
  // Über den Zeitraum streuen: der früheste, dann gleichmäßig verteilt.
  const raus: Slot[] = [];
  for (let i = 0; i < hoechstens; i++) raus.push(pool[Math.round((i * (pool.length - 1)) / (hoechstens - 1))]);
  return Array.from(new Set(raus));
}

// ═══════════════════════════════════════════════════════════════════════════
// BUCHEN
// ═══════════════════════════════════════════════════════════════════════════
export interface TerminInfo {
  id: number; agentId: number; agentName: string; vorname: string;
  beginn: string; wochentag: string; datum: string; uhrzeit: string; text: string; storno: string | null;
  /** E-248: so, wie der Kunde es liest — „morgen um 20 Uhr" (zeitFuerKunde), nie ISO. */
  kundenText: string;
}

async function terminLesen(id: number, lauf: Lauf): Promise<TerminInfo | null> {
  const [t] = (await lauf`
    SELECT t.id, t.agent_id, t.beginn, t.status, t.storno_token, a.name,
           COALESCE(NULLIF(a.first_name, ''), split_part(a.name, ' ', 1)) AS vorname
      FROM fiaon_termine t JOIN fiaon_agents a ON a.id = t.agent_id WHERE t.id = ${id}`) as any[];
  if (!t) return null;
  const b = new Date(t.beginn);
  // E-260 (B2): Liegt der Termin bei einem Abwesenden (vor „bis"), ruft der
  // Vertreter an — dann nennt jeder Satz („Genau, … ruft Sie … an") ihn. Alle
  // Sätze lesen `vorname` von hier, ein Eingriff reicht.
  const vorname = await anruferFuer(Number(t.agent_id), b, String(t.vorname), lauf);
  return {
    id: Number(t.id), agentId: Number(t.agent_id), agentName: String(t.name), vorname,
    beginn: b.toISOString(), wochentag: berlinWochentagName(b), datum: berlinDatumText(b), uhrzeit: berlinUhrzeit(b),
    text: slotText(b), storno: t.storno_token ? stornoLink(String(t.storno_token)) : null,
    kundenText: zeitFuerKunde(b),
  };
}

/** Der künftige, gebuchte Termin eines Menschen — höchstens einer zählt. */
export async function kuenftigerTermin(personId: number, lauf: Lauf = sqlPool): Promise<(TerminInfo & { herkunft: string | null; quelle: string | null; stornoToken: string | null }) | null> {
  const [t] = (await lauf`
    SELECT id, herkunft, quelle, storno_token FROM fiaon_termine
     WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW() - INTERVAL '20 minutes'
     ORDER BY beginn LIMIT 1`) as any[];
  if (!t) return null;
  const info = await terminLesen(Number(t.id), lauf);
  return info ? { ...info, herkunft: t.herkunft ?? null, quelle: t.quelle ?? null, stornoToken: t.storno_token ?? null } : null;
}

/**
 * E-248: Der zuletzt VERPASSTE Termin der letzten drei Tage, wenn Mara ihn
 * gebucht hat oder der Kunde ihn über ihren Terminlink gewählt hat — und kein
 * neuer Termin steht. Dann bietet Mara in ihrer nächsten Antwort von sich aus
 * einen neuen an (Befund: 4 von 7 Mara-Rückrufen verpasst, niemand fasste nach).
 * Bei „kein Interesse" (Person gesperrt) nie.
 */
export async function verpassterTermin(personId: number, lauf: Lauf = sqlPool): Promise<(TerminInfo & { herkunft: string | null }) | null> {
  const [t] = (await lauf`
    SELECT t.id, t.herkunft FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.person_id = ${personId} AND t.status = 'verpasst' AND t.herkunft = ANY(${MARA_EIGENE_HERKUNFT})
       AND t.beginn > NOW() - INTERVAL '3 days' AND NOT COALESCE(p.is_blocked, FALSE)
       AND COALESCE(t.verpasst_grund, '') NOT IN ('kein_interesse', 'nummer_falsch')
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine n WHERE n.person_id = t.person_id AND n.status = 'gebucht' AND n.beginn > NOW() - INTERVAL '20 minutes')
     ORDER BY t.beginn DESC LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const info = await terminLesen(Number(t.id), lauf);
  return info ? { ...info, herkunft: t.herkunft ?? null } : null;
}

/** Eine Wunschzeit lesen: „2026-09-24 12:25" (Berlin). Alles andere → null. */
export function wunschLesen(roh: unknown): Date | null {
  const s = String(roh ?? "").trim().replace("T", " ");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return null;
  return parseBerlinInput(s);
}

export interface BuchungsWunsch {
  /** Genaue Zeit, „YYYY-MM-DD HH:MM" Berliner Zeit. */
  zeit?: string | null;
  /** Oder ein Fenster. */
  von?: string | null;
  bis?: string | null;
  /** Worum es geht — steht im Termin und in der Mail an den Mitarbeiter. */
  anliegen: string;
  /** Einen von Mara gebuchten Termin auf die neue Zeit legen. */
  verschieben?: boolean;
}

export interface BuchungsErgebnis {
  ok: boolean;
  termin?: TerminInfo;
  /**
   * E-248 (Fall K.): Es steht schon ein Termin — Zeit, Name, Herkunft. Die
   * Wahrheitsprüfung kennt die Uhrzeit damit, und Mara bestätigt ihn statt neu anzubieten.
   */
  bestehend?: { id: number; beginn: string; uhrzeit: string; kundenText: string; vorname: string; vonMara: boolean; herkunftText: string };
  /**
   * E-248 (Befund #294): Wunsch „15:00", gebucht 15:10 — Mara sagt es ehrlich.
   * Nachbesserung: mit dem GRUND — „vergeben" nur, wenn der Platz wirklich belegt war
   * (Probelauf #15: „12:25 Uhr ist schon vergeben", der Grund war die Vorlaufzeit).
   */
  abweichung?: { wunsch: string; gebucht: string; grund?: AbweichungsGrund } | null;
  /** Kurzer Grund-Code bei „nicht möglich". */
  grund?: string;
  /** Klartext für Mara. */
  meldung: string;
  alternativen?: string[];
}

/**
 * Bucht einen Rückruf — nur auf einen Platz, den die Rechnung als frei ausweist.
 * Wirft nie; jedes Ergebnis steht im Protokoll.
 */
export async function rueckrufBuchen(
  ctx: { personId: number; leadId?: number | null; nummer: string; kunde?: string | null },
  w: BuchungsWunsch,
  lauf: Lauf = sqlPool,
): Promise<BuchungsErgebnis> {
  const nichtMoeglich = async (grund: string, meldung: string, alternativen: Slot[] = [], daten: Record<string, unknown> = {}): Promise<BuchungsErgebnis> => {
    const alt = alternativen.map((s) => slotText(s.beginn));
    await protokollieren({
      art: "termin_nicht_moeglich", ok: false, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId ?? null,
      text: `Rückruf nicht eingetragen (${meldung})${alt.length ? ` — angeboten: ${alt.join(", ")}` : ""}.`,
      daten: { grund, wunsch: w, alternativen: alternativen.map((s) => s.beginn), ...daten },
    }, lauf);
    return { ok: false, grund, meldung, alternativen: alt };
  };

  try {
    const zeit = wunschLesen(w.zeit);
    const von = wunschLesen(w.von);
    const bis = wunschLesen(w.bis);
    if (!zeit && !von && !bis) return await nichtMoeglich("zeit_unlesbar", "keine Zeit angegeben — erst nach einer Uhrzeit fragen oder freie Zeiten anbieten");

    const bestehend = await kuenftigerTermin(ctx.personId, lauf);
    const eigener = !!bestehend && MARA_EIGENE_HERKUNFT.includes(String(bestehend.herkunft ?? ""));
    const kundeSelbst = !!bestehend && !eigener && kundeHatSelbstGebucht(bestehend.herkunft, bestehend.quelle);
    if (bestehend && !(w.verschieben && (eigener || kundeSelbst))) {
      // E-248 (Fall K.): Kein Systemsatz („nicht anfassen, ein Mensch verschiebt") — ein
      // fertiger Satz für den Kunden, und die Uhrzeit geht als bekannte Zeit an die Prüfung.
      const satz = `Genau, ${bestehend.vorname} ruft Sie ${bestehend.kundenText} an.`;
      const erg = await nichtMoeglich("schon_termin",
        `sein Termin steht schon: ${bestehend.kundenText} mit ${bestehend.vorname} (${terminHerkunftText(bestehend.herkunft, bestehend.quelle)}). Bestätige ihm genau diesen Termin, z. B. „${satz}"${eigener || kundeSelbst
          ? " Will er ausdrücklich eine andere Zeit: rueckruf_eintragen mit verschieben: true (derselbe Betreuer)."
          : ` Will er eine andere Zeit: sag ihm, dass du ${bestehend.vorname} Bescheid gibst — den Termin selbst verschiebt ${bestehend.vorname}.`}`,
        [], { termin_id: bestehend.id });
      return {
        ...erg,
        bestehend: {
          id: bestehend.id, beginn: bestehend.beginn, uhrzeit: bestehend.uhrzeit, kundenText: bestehend.kundenText,
          vorname: bestehend.vorname, vonMara: eigener, herkunftText: terminHerkunftText(bestehend.herkunft, bestehend.quelle),
        },
      };
    }

    const angebot = await freieZeiten(ctx.personId, lauf);
    if (!angebot.slots.length) {
      return await nichtMoeglich("keine_zeiten", `in den nächsten Tagen ist keine Zeit frei${angebot.grund ? ` (${angebot.grund})` : ""} — an einen Menschen übergeben`);
    }

    // Den Wunsch auf einen Platz der Rechnung legen — nie eine getippte Zeit buchen.
    let slot: Slot | null = null;
    if (zeit) {
      const t = zeit.getTime();
      const nah = angebot.slots
        .map((s) => ({ s, d: new Date(s.beginn).getTime() - t }))
        .filter((x) => x.d >= -10 * 60_000 && x.d <= 20 * 60_000)
        .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.d - a.d);
      slot = nah[0]?.s ?? null;
    } else {
      const vonT = von?.getTime() ?? 0;
      const bisT = bis?.getTime() ?? Number.MAX_SAFE_INTEGER;
      slot = angebot.slots.find((s) => {
        const t = new Date(s.beginn).getTime();
        return t >= vonT && t <= bisT;
      }) ?? null;
    }
    if (!slot) {
      const naeher = zeit ?? von;
      const alt = naeher
        ? angebot.slots.slice().sort((a, b) => Math.abs(new Date(a.beginn).getTime() - naeher.getTime()) - Math.abs(new Date(b.beginn).getTime() - naeher.getTime())).slice(0, 3)
          .sort((a, b) => a.beginn.localeCompare(b.beginn))
        : vorschlaege(angebot.slots);
      // E-260 (Gegenprüfung 29.09.): Bei Abwesenheit gelten ab „bis" die Plätze des Betreuers
      // (bzw. des Pools) — dann nennt die Meldung DESSEN Namen und Arbeitszeit, nicht den Vertreter.
      const ab = angebot.abwesenheit ?? null;
      const zustaendig: Zustaendig | null = ab && naeher && naeher.getTime() >= new Date(ab.bis).getTime() ? ab.nach.agent : angebot.agent;
      const tag = naeher ? berlinDatum(naeher) : null;
      const az = tag && zustaendig ? await arbeitszeitAm(zustaendig.id, tag, lauf) : null;
      // Bei Abwesenheit ruft je nach Zeit ein anderer an — Mara bekommt es je Alternative.
      const werJe = ab && alt.length
        ? ` (wer anruft: ${alt.map((s) => `${slotText(s.beginn)} ${s.agentVorname}`).join(", ")})`
        : "";
      return await nichtMoeglich("nicht_frei",
        (zustaendig
          ? `zu der gewünschten Zeit ist ${zustaendig.vorname} nicht frei${az ? ` (Arbeitszeit an dem Tag: ${az})` : tag ? " (an dem Tag keine Arbeitszeit)" : ""}`
          : "zu der gewünschten Zeit ist niemand aus dem Team frei") + werJe, alt);
    }

    // Nachbesserung E-248: Einen Termin, den der Kunde selbst gebucht hat, verschiebt Mara
    // nur zu DEMSELBEN Betreuer — sonst übernimmt der Betreuer.
    // E-260: Liegt sein Termin bei einem Abwesenden und der neue Platz beim Vertreter, ist das derselbe
    // Mensch am Telefon — dann darf Mara verschieben.
    const zumVertreter = !!angebot.abwesenheit && slot.agentId === angebot.abwesenheit.vertreterId
      && !!bestehend && istAbwesend(await abwesenheitJetzt(lauf).catch(() => null), bestehend.agentId, bestehend.beginn);
    if (bestehend && w.verschieben && kundeSelbst && slot.agentId !== bestehend.agentId && !zumVertreter) {
      return await nichtMoeglich("anderer_betreuer",
        `zu der Zeit hat ${bestehend.vorname} keinen freien Platz — sag ihm, dass du ${bestehend.vorname} Bescheid gibst; sein Termin ${bestehend.kundenText} bleibt bis dahin stehen`, [], { termin_id: bestehend.id });
    }

    // Nachbesserung E-248: Der GRUND einer Abweichung — VOR der Buchung ermittelt
    // (danach wäre der eigene neue Termin selbst „belegt").
    let abGrund: AbweichungsGrund | null = null;
    if (zeit && Math.abs(new Date(slot.beginn).getTime() - zeit.getTime()) >= 60_000) {
      const t = zeit.getTime();
      if (t < Date.now() + MARA_VORLAUF_MIN * 60_000) abGrund = "vorlauf";
      else {
        // E-260: Beim Vertreter ist auch belegt, was er für die Abwesenden anruft.
        const akt = angebot.abwesenheit && slot.agentId === angebot.abwesenheit.vertreterId ? await abwesenheitJetzt(lauf).catch(() => null) : null;
        const liste = akt
          ? await belegtFuerVertreter(akt, lauf).catch(() => [] as { von: number; bis: number }[])
          : ((await belegteZeiten([slot.agentId], lauf).catch(() => new Map<number, { von: number; bis: number }[]>())).get(slot.agentId) ?? []);
        abGrund = liste.some((b) => b.von < t + 20 * 60_000 && b.bis > t) ? "belegt" : "raster";
      }
    }

    // ── Buchen ──────────────────────────────────────────────────────────
    let buchung: Buchung;
    try {
      buchung = await terminBuchen({ personId: ctx.personId, agentId: slot.agentId, beginn: slot.beginn, quelle: QUELLE, herkunft: MARA_HERKUNFT }, lauf);
    } catch (e) {
      const code = e instanceof TerminFehler ? (e as any).code ?? "fehler" : "fehler";
      await versuchProtokollieren({ ergebnis: "abgelehnt", personId: ctx.personId, leadId: ctx.leadId ?? null, slotBeginn: slot.beginn, agentId: slot.agentId, grund: String(code), quelle: QUELLE, akteur: "mara" }, lauf);
      const neu = await freieZeiten(ctx.personId, lauf);
      return await nichtMoeglich(String(code), `die Zeit ist gerade weggegangen (${String((e as Error)?.message ?? e).slice(0, 100)})`, vorschlaege(neu.slots));
    }
    const jetzt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const wunschText = zeit ? `Wunsch ${berlinUhrzeit(zeit)} Uhr` : `Wunsch ${von ? berlinUhrzeit(von) : "…"}–${bis ? berlinUhrzeit(bis) : "…"} Uhr`;
    // E-260: beim Vertreter gebucht? Dann steht in der Notiz, für wen er einspringt — und der Kunde
    // wird NICHT an ihn gebunden (B10: die Zuordnung bleibt, wie sie ist).
    const ab = angebot.abwesenheit ?? null;
    const beimVertreter = !!ab && slot.agentId === ab.vertreterId;
    const inVertretung = beimVertreter ? ` — in Abwesenheit von ${ab!.betreuer?.vorname ?? "dem Team"}, bei ${ab!.vertreterName}` : "";
    const notiz = `Rückruf, von Mara per WhatsApp vereinbart (${jetzt}, ${wunschText})${inVertretung}. ${String(w.anliegen || "").trim()}`.slice(0, 800);
    await lauf`UPDATE fiaon_termine SET notiz = ${notiz}, updated_at = NOW() WHERE id = ${buchung.id}`;
    // Meldet den Mitarbeiter (eine Mail), Wiedervorlage, Wartezustand — nicht zusätzlich buchungMelden.
    await buchungAnwenden(buchung, lauf, { zuordnen: !beimVertreter });
    await versuchProtokollieren({ ergebnis: "gebucht", personId: ctx.personId, leadId: ctx.leadId ?? null, slotBeginn: slot.beginn, agentId: slot.agentId, quelle: QUELLE, akteur: "mara" }, lauf);

    // Die Wahrheit steht in der gespeicherten Zeile — von dort liest Mara Zeit und Namen.
    const termin = await terminLesen(buchung.id, lauf);
    if (!termin || termin.beginn !== new Date(slot.beginn).toISOString()) {
      await protokollieren({ art: "termin_gebucht", ok: false, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId ?? null, terminId: buchung.id,
        text: `Termin #${buchung.id} gebucht, aber die gespeicherte Zeit weicht ab — bitte prüfen.`, daten: { slot: slot.beginn, gespeichert: termin?.beginn ?? null } }, lauf);
      // Genau der Zeitfehler, den Justin beklagt hat — sofort ein Mensch, nicht erst der Prüftakt.
      try {
        const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
        await auftragFuerKunden({
          personId: ctx.personId, ref: null, anBetreiber: true, dringend: true,
          titel: `Mara-Termin #${buchung.id}: Zeit weicht ab`,
          text: `Mara hat gebucht (Platz ${slot.beginn}), gespeichert ist ${termin?.beginn ?? "nichts"}. Bitte Kalender und WhatsApp (+${ctx.nummer}) prüfen; der Kunde hat noch keine Uhrzeit bekommen.`,
          quelle: "mara-whatsapp", link: `/chef/s/mara?reiter=termine&termin=${buchung.id}`, schluessel: `mara-termin-pruefung-${buchung.id}`,
        } as any);
      } catch (e) { console.error("[MARA-TERMIN] Abweichungs-Aufgabe:", e); }
      return { ok: false, grund: "abweichung", meldung: "die Buchung ist nicht sauber gespeichert — ein Mensch prüft das" };
    }

    // Verschieben: erst der neue Termin, dann der alte weg (keine Lücke).
    let verschoben: string | null = null;
    if (bestehend && w.verschieben && bestehend.stornoToken) {
      // E-260 (B8): „verschoben" statt „agent" — keine Absagemail an den Kunden (er hat die neue Zeit
      // eben bekommen), die alte Zeit wird wieder frei, der Mitarbeiter liest „verschoben durch Mara".
      await terminAbsagen(bestehend.stornoToken, "verschoben", lauf).catch((e) => console.error("[MARA-TERMIN] Alter Termin nicht abgesagt:", e));
      verschoben = bestehend.text;
    }

    const satz = `${verschoben ? `Rückruf verschoben (vorher ${verschoben}): ` : "Rückruf eingetragen: "}${termin.wochentag}, ${termin.datum}, ${termin.uhrzeit} Uhr bei ${termin.agentName}${beimVertreter ? ` (vertritt ${ab!.betreuer?.vorname ?? "das Team"} bis ${bisText(ab!.bis)})` : ""}`;
    // E-248 (Befund #294): Weicht der gebuchte Platz von seiner genauen Wunschzeit ab, erfährt er es.
    const abweichung = zeit && berlinUhrzeit(zeit) !== termin.uhrzeit ? { wunsch: berlinUhrzeit(zeit), gebucht: termin.uhrzeit, grund: abGrund ?? "raster" } : null;
    await protokollieren({
      art: verschoben ? "termin_verschoben" : "termin_gebucht", ok: true, nummer: ctx.nummer, personId: ctx.personId,
      leadId: ctx.leadId ?? null, terminId: termin.id,
      text: `${satz} (${wunschText}).`,
      daten: {
        termin_id: termin.id, agent_id: termin.agentId, beginn: termin.beginn, wunsch: w, weg: angebot.weg, betreuer_grund: angebot.grund,
        ...(beimVertreter ? { abwesend: ab!.betreuer?.id ?? null, vertreter: ab!.vertreterId, bis: ab!.bis } : {}),
      },
    }, lauf);
    try {
      const { waAktenvermerk } = await import("./fiaon-whatsapp");
      await waAktenvermerk(ctx.personId, `${satz}. ${String(w.anliegen || "").slice(0, 200)}`);
    } catch { /* ohne Bestellung keine Akte — das Protokoll zählt */ }
    return { ok: true, termin, meldung: `${satz}.`, abweichung };
  } catch (e) {
    console.error("[MARA-TERMIN] Buchung:", e);
    return await nichtMoeglich("serverfehler", "technischer Fehler — an einen Menschen übergeben");
  }
}

/** Der persönliche Terminlink — die Seite zeigt genau die Zeiten seines Betreuers, in der Sie-Form. */
export async function terminlinkFuer(
  ctx: { personId: number; leadId?: number | null; nummer: string },
  lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; link?: string; meldung: string; agent?: string | null }> {
  const bestehend = await kuenftigerTermin(ctx.personId, lauf);
  if (bestehend) {
    return { ok: false, meldung: `sein Termin steht schon: ${bestehend.kundenText} mit ${bestehend.vorname} — keinen Link schicken, sondern genau diesen Termin nennen („Genau, ${bestehend.vorname} ruft Sie ${bestehend.kundenText} an.")` };
  }
  // E-260 (29.09.2026): Team abwesend — die Terminseite weiß davon nichts: Sie
  // zeigt den Kalender des Betreuers (bzw. den Pool samt Abwesenden). Statt eines
  // Links, der ins Leere bucht, bietet Mara zwei Zeiten an und trägt ein —
  // direkter für den Kunden und wahr. Gegenprüfung 29.09.: gesperrt wird der
  // Link nur, wenn freie_zeiten auch wirklich Zeiten hat; sonst wäre es eine
  // Sackgasse (freie_zeiten sagt dann „schick den Terminlink").
  const ab = await abwesenheitJetzt(lauf).catch(() => null);
  if (ab) {
    const vt = await vertretungFuerPerson(ctx.personId, lauf).catch(() => null);
    const zumPool = !vt && !(await betreuerFuerRueckruf(ctx.personId, lauf)).agent;
    const angebot = vt || zumPool ? await freieZeiten(ctx.personId, lauf).catch(() => null) : null;
    if (angebot?.slots.length) {
      const betreuerWeg = !!vt?.betreuer && vt.betreuer.id !== ab.vertreter.id && vt.betreuerBuchbar;
      const wer = betreuerWeg ? `Sein Betreuer ${vt!.betreuer!.vorname} ist` : "Das Team ist";
      await protokollieren({
        art: "terminlink", ok: false, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId ?? null,
        text: `Kein Terminlink: ${wer} bis ${bisText(ab.bis)} nicht (ganz) im Haus — freie Zeiten statt Link.`,
        daten: { abwesend: vt?.betreuer?.id ?? null, vertreter: ab.vertreter.id, bis: ab.bis.toISOString(), weg: angebot.weg },
      }, lauf);
      return {
        ok: false,
        meldung: `${wer} bis ${bisText(ab.bis)} nicht ${betreuerWeg ? "im Haus" : "vollständig im Haus"}, die Terminseite weiß davon nichts. Schick keinen Link: `
          + `Biete ihm zwei freie Zeiten an (freie_zeiten) und trag den Rückruf ein (rueckruf_eintragen)`
          + (angebot.weg === "abwesenheit" ? " — bei jeder Zeit steht, wer anruft (ruft_an)." : "."),
      };
    }
  }
  const { agent } = await betreuerFuerRueckruf(ctx.personId, lauf);
  const basis = terminLink(ctx.personId, MARA_HERKUNFT_LINK);
  const link = `${basis}${basis.includes("?") ? "&" : "?"}anrede=sie`;
  await protokollieren({
    art: "terminlink", ok: true, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId ?? null,
    text: `Persönlichen Terminlink geschickt${agent ? ` (Zeiten von ${agent.name})` : " (Zeiten aus dem Team)"}.`,
    daten: { link, agent_id: agent?.id ?? null },
  }, lauf);
  return { ok: true, link, meldung: `Link für ihn: ${link}`, agent: agent?.vorname ?? null };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KREISLAUF — jede Mara-Buchung wird nachgeprüft
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Prüft alle Mara-Buchungen der letzten Tage (und künftige) erneut:
 *   1. Der Termin steht (gebucht/erledigt) — oder wurde von einem Menschen bewusst abgesagt.
 *   2. Er liegt in der Arbeitszeit des Mitarbeiters an diesem Wochentag.
 *   3. Keine Überschneidung mit einem anderen gebuchten Termin des Mitarbeiters.
 *   4. Der Mitarbeiter ist aktiv und nicht gesperrt.
 *   5. Die Mail an den Mitarbeiter ist raus (gemeldet_buchung_am).
 *   6. Der Kunde hat die Uhrzeit bekommen (Maras WhatsApp nach der Buchung nennt sie).
 * Ergebnis steht am Protokoll (pruefung_*). Was nicht stimmt, wird EINMAL eine
 * dringende Aufgabe an die Leitung.
 */
export async function maraTermineNachpruefen(lauf: Lauf = sqlPool): Promise<{ geprueft: number; fehler: number }> {
  await protokollTabelle(lauf);
  const zeilen = (await lauf`
    SELECT p.id, p.termin_id, p.nummer, p.person_id, p.am, p.gemeldet_am, p.pruefung_ok,
           t.beginn, t.status, t.agent_id, t.dauer_min, t.gemeldet_buchung_am, t.abgesagt_von,
           a.name AS agent_name, COALESCE(a.active, TRUE) AS aktiv, a.zugang_gesperrt_am
      FROM fiaon_mara_protokoll p
      LEFT JOIN fiaon_termine t ON t.id = p.termin_id
      LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE p.art IN ('termin_gebucht', 'termin_verschoben') AND p.ok AND p.termin_id IS NOT NULL
       AND (t.beginn > NOW() - INTERVAL '1 day' OR p.pruefung_am IS NULL)
     ORDER BY p.id DESC LIMIT 200`) as any[];
  let fehler = 0;
  const ab = await abwesenheitJetzt(lauf).catch(() => null);
  for (const z of zeilen) {
    const probleme: string[] = [];
    const gut: string[] = [];
    const beginn = z.beginn ? new Date(z.beginn) : null;
    if (!beginn) probleme.push("Termin fehlt");
    else {
      const bewusstAbgesagt = z.status === "abgesagt";
      if (bewusstAbgesagt) gut.push(`abgesagt (${z.abgesagt_von ?? "?"})`);
      else if (!["gebucht", "erledigt", "verpasst"].includes(String(z.status))) probleme.push(`Status ${z.status}`);
      else gut.push(z.status === "gebucht" ? "Termin steht" : `Termin ${z.status}`);
      if (!bewusstAbgesagt) {
        const datum = berlinDatum(beginn);
        const min = zeitZuMinuten(berlinUhrzeit(beginn)) ?? -1;
        const fenster = (await verfuegbarkeitVon(Number(z.agent_id), lauf)).filter((f) => f.aktiv && f.wochentag === berlinWochentag(datum));
        const drin = fenster.some((f) => (zeitZuMinuten(f.von) ?? 9e9) <= min && min + Number(z.dauer_min || 20) <= (zeitZuMinuten(f.bis) ?? -1));
        if (drin) gut.push("in der Arbeitszeit"); else probleme.push("außerhalb der Arbeitszeit");
        const [ueber] = (await lauf`
          SELECT COUNT(*)::int AS n FROM fiaon_termine x
           WHERE x.agent_id = ${z.agent_id} AND x.id <> ${z.termin_id} AND x.status = 'gebucht'
             AND x.beginn < ${beginn}::timestamptz + make_interval(mins => ${Number(z.dauer_min || 20)})
             AND x.beginn + make_interval(mins => COALESCE(x.dauer_min, 20)) > ${beginn}::timestamptz`) as any[];
        if (Number(ueber?.n || 0) > 0) probleme.push("überschneidet sich mit einem anderen Termin"); else gut.push("keine Überschneidung");
        if (!z.aktiv || z.zugang_gesperrt_am) probleme.push(`${z.agent_name} ist nicht aktiv/gesperrt`);
        // E-260: kein Fehler, aber ein Hinweis — der Vertreter ruft an (Reiter „Termine").
        if (z.status === "gebucht" && istAbwesend(ab, Number(z.agent_id), beginn)) {
          gut.push(`${String(z.agent_name).split(" ")[0]} bis ${bisText(ab!.bis)} abwesend — ${ab!.vertreter.anrufName} ruft an (Reiter „Termine")`);
        }
        const alt = Date.now() - new Date(z.am).getTime();
        if (z.gemeldet_buchung_am) gut.push(`Mail an ${String(z.agent_name).split(" ")[0]} raus`);
        else if (alt > 5 * 60_000) probleme.push("Mail an den Mitarbeiter nicht raus");
        if (z.nummer) {
          const uhr = berlinUhrzeit(beginn);
          // E-248: Mara schreibt Zeiten jetzt wie ein Mensch („morgen um 20 Uhr") — gesucht wird
          // die Uhrzeit in jeder Schreibweise (uhrzeitenIn), nicht mehr nur „20:00".
          const texte = (await lauf`
            SELECT text FROM fiaon_whatsapp WHERE nummer = ${z.nummer} AND richtung = 'raus' AND status <> 'fehler'
               AND created_at >= ${z.am}::timestamptz - INTERVAL '1 minute' ORDER BY id LIMIT 20`) as any[];
          const info = texte.some((x) => uhrzeitenIn(String(x.text ?? "")).includes(uhr));
          if (info) gut.push(`Kunde hat ${uhr} Uhr bekommen`);
          else if (alt > 10 * 60_000) probleme.push(`Kunde hat die Uhrzeit ${uhr} nicht per WhatsApp bekommen`);
        }
      }
    }
    const ok = probleme.length === 0;
    const text = [...probleme.map((p) => `✗ ${p}`), ...gut.map((g) => `✓ ${g}`)].join(" · ");
    await lauf`UPDATE fiaon_mara_protokoll SET pruefung_am = NOW(), pruefung_ok = ${ok}, pruefung_text = ${text} WHERE id = ${z.id}`;
    if (!ok) {
      fehler++;
      if (!z.gemeldet_am) {
        await lauf`UPDATE fiaon_mara_protokoll SET gemeldet_am = NOW() WHERE id = ${z.id}`;
        try {
          const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
          await auftragFuerKunden({
            personId: z.person_id ?? null, ref: null, anBetreiber: true, dringend: true,
            titel: `Mara-Termin #${z.termin_id} stimmt nicht`,
            text: `Nachprüfung eines von Mara gebuchten Rückrufs: ${probleme.join("; ")}. Bitte im Kalender und im WhatsApp-Verlauf (+${z.nummer ?? "?"}) ansehen.`,
            quelle: "mara-whatsapp", link: `/chef/s/mara?reiter=termine&termin=${z.termin_id}`, schluessel: `mara-termin-pruefung-${z.termin_id}`,
          } as any);
        } catch (e) { console.error("[MARA-TERMIN] Prüf-Aufgabe:", e); }
      }
    }
  }
  return { geprueft: zeilen.length, fehler };
}

/** Das Protokoll lesen — für den Raum (je Nummer) und das Steuerpult (alle). */
export async function protokollLesen(opts: { nummer?: string | null; tage?: number; hoechstens?: number } = {}, lauf: Lauf = sqlPool): Promise<any[]> {
  await protokollTabelle(lauf);
  const tage = Math.min(Math.max(Number(opts.tage) || 3, 1), 60);
  const n = Math.min(Math.max(Number(opts.hoechstens) || 200, 1), 500);
  return (await (opts.nummer
    ? lauf`
      SELECT p.*, TRIM(COALESCE(pe.first_name, '') || ' ' || COALESCE(pe.last_name, '')) AS kunde
        FROM fiaon_mara_protokoll p LEFT JOIN fiaon_persons pe ON pe.id = p.person_id
       WHERE p.nummer = ${opts.nummer} ORDER BY p.am ASC LIMIT ${n}`
    : lauf`
      SELECT p.*, TRIM(COALESCE(pe.first_name, '') || ' ' || COALESCE(pe.last_name, '')) AS kunde
        FROM fiaon_mara_protokoll p LEFT JOIN fiaon_persons pe ON pe.id = p.person_id
       WHERE p.am > NOW() - make_interval(days => ${tage}) ORDER BY p.am DESC LIMIT ${n}`)) as any[];
}
