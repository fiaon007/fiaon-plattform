// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Raten-Erinnerung nach der Mailbox und am Zahltag (E-408 Scheibe 3, Koordination 22.10.2026)
//
// Aus 168 echten Anrufen: 41 % landen auf der Mailbox, fünf Kunden haben einen Zahltag zugesagt. Zwei Erinnerungen, beide über
// DENSELBEN Weg wie im Gespräch (zahlungslink_senden: WhatsApp-Vorlage fiaon_kk_rate, sonst die Raten-Mail) und mit denselben
// Bremsen:
//   1. NACH DER MAILBOX: Ein Rate-Anruf endet mit „mailbox“ oder „nicht erreicht“, die Rate ist noch offen und fällig → die
//      Nachbereitung schickt die Raten-Erinnerung (nachMailboxErinnern). Höchstens einmal je Rate in 3 Tagen.
//   2. AM ZAHLTAG: Wer ARAS einen Tag zugesagt hat (vor heute), bekommt an diesem Tag zwischen 09:00 und 10:00 (Berlin) die
//      Raten-Erinnerung (zahltagErinnern, Takt aras_zahltag) — nur, wenn die Rate noch offen ist und seit der Zusage nichts
//      bezahlt wurde. Höchstens einmal je Zusage.
// Die Bremsen (beide): nie bei Streitfall/Betrug oder offener Beschwerde (ARAS für ihn aus), Telefonsperre, Global-Kunde,
// Testperson, Not-Aus; nie gegen die Werkzeug-Ampel (zahlungslink_senden auf Rot = nichts). Wie die WhatsApp-Zentrale bei der
// Monatsrate (Koordination 22.10.2026, Nachtrag): Die Monatsrate ist Vertragspost — sperrt nur die „echte“ Werbesperre, nicht die
// aus der Zahlungspost-Freigabe (WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL), und nie bei gekündigt-aber-nicht-gebucht (E-391,
// KUENDIGUNG_UNGEBUCHT_SQL) — dieselben SQL-Bausteine wie dort.
// „Kürzlich erinnert“ zählen NUR Raten-WhatsApps (fiaon_kk_rate/fiaon_kkb_rate, jeder Absender, auch die Zentrale) und ARAS' eigene
// Erinnerung — nie die automatischen Raten-Mails (die laufen ohnehin nach Mahnstufe): nach der Mailbox 3 Tage, am Zahltag nur
// „heute schon“ (die Erinnerung am Zahltag ist der Sinn, auch wenn der Link 1–2 Tage vorher kam).
// Jeder Anlass hat GENAU EINE Zeile in fiaon_aras_erinnerung (schluessel — auch über zwei Instanzen), mit Ausgang und Grund. Der
// Versand hängt als Werkzeug-Zeile am Gespräch (fiaon_aras_werkzeug, aufruf_id „mailbox-…“ / „zahltag-…“) und steht im
// Protokoll (Kanal telefon) — sichtbar im Cockpit unter „Was ARAS erledigt hat“.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { arasEreignis } from "./fiaon-aras-ereignis";
import { arasEinstellungenLesen } from "./fiaon-aras-plan";
import { werkzeugAusfuehren, type WerkzeugKontext } from "./fiaon-aras-werkzeuge";
import { briefingBauen } from "./fiaon-aras-briefing";
import { telefonGesperrt, nummerKern } from "./fiaon-aras-sperre";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { ERINNERBARE_BESTELLUNG_SQL, RATE_NACH_ENDE_SQL_FUER } from "./fiaon-raten-storno";
import { berlinZeitpunkt } from "./fiaon-time";
import { KOPF_SQL, WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL } from "./fiaon-mail-frequenz";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "../../shared/fiaon-kuendigung-regel";
import { berlinTeile, nummerLand, kundenAnrufeAn, rateFensterTag, type ArasEinstellungen, type Spielart } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;
type Senden = typeof werkzeugAusfuehren;

/** Nach der Mailbox: so viele Tage zurück zählt eine Raten-WhatsApp oder eine Erinnerung von ARAS zu dieser Rate. */
export const ERINNERUNG_BREMSE_TAGE = 3;
/** Die Raten-WhatsApps (Text- und Bildfassung, auch die Nachfolger …_v2) — dieselbe Lesart wie Maras Kontaktzählung. */
export const RATEN_WA_MUSTER = "^fiaon_kkb?_rate(_v[0-9]+)?$";
/** Zahltag-Erinnerung: zwischen 09:00 und 10:00 Berlin. */
export const ZAHLTAG_FENSTER = { von: "09:00", bis: "10:00" } as const;
/**
 * Ende, die WIR verursacht haben (Not-Aus, Deploy, Technik, Deckel, Twilio fehlgeschlagen) — dann keine Erinnerung: Der Kunde
 * war nicht „nicht erreichbar“, wir haben nur nicht richtig angerufen.
 */
export const TECHNIK_ENDE: readonly string[] = ["notaus", "deploy", "fehler", "kein_stream", "deckel", "zeitlimit", "haengend", "fehlgeschlagen"];

/**
 * Streitfall oder Beschwerde zur Person OFFEN — EINE Definition für Erinnerungen und Aufbewahrung (fiaon-aras-aufbewahrung.ts):
 *   · ARAS ist für sie aus, weil sie Betrug, Anzeige, Polizei, Anwalt, Verbraucherzentrale oder Abzocke erwähnt hat (die Brücke
 *     setzt „Streitfall am Telefon: …“, das Nachholen „Betrug/Anzeige …“) — bis ein Mensch es zurücknimmt;
 *   · oder eine nicht erledigte Aufgabe „Streitfall am Telefon“ (aras:justin:streitfall:…) oder der Art Beschwerde.
 * `person` ist ein SQL-Ausdruck für die Personen-Kennung (darf NULL sein → false).
 */
export function streitOffenSql(person: string): string {
  return `(EXISTS (SELECT 1 FROM fiaon_aras_person so_p WHERE so_p.person_id = ${person} AND so_p.aus_am IS NOT NULL
                     AND (COALESCE(so_p.aus_von, '') ILIKE '%streitfall%'
                          OR COALESCE(so_p.aus_grund, '') ~* '(streitfall|betrug|anzeige|polizei|anwalt|verbraucherzentrale|abzocke)'))
     OR EXISTS (SELECT 1 FROM fiaon_betreiber_todos so_t WHERE so_t.person_id = ${person} AND COALESCE(so_t.status, 'offen') <> 'erledigt'
                  AND (so_t.art = 'beschwerde' OR so_t.schluessel LIKE 'aras:justin:streitfall:%'
                       OR (so_t.art IS NULL AND COALESCE(so_t.titel, '') ~* '(beschwerde|streitfall)'))))`;
}

// ── Die Regel (rein — der Prüfstand rechnet sie offline nach, mit Rot-Proben) ────────────────────────────────────────────
export interface ErinnerungFakten {
  notaus: boolean;
  /** Die Rate: offen (nicht bezahlt, nicht storniert), fällig (≤ heute Berlin), Vertrag erinnerbar (kein Abo-/Mahnstopp, nicht nach dem Ende). */
  rateOffen: boolean; rateFaellig: boolean; erinnerbar: boolean;
  test: boolean; global: boolean; telefonsperre: boolean;
  /** Die „echte“ Werbesperre (nicht die aus der Zahlungspost-Freigabe) — wie die WhatsApp-Zentrale bei der Monatsrate. */
  werbesperre: boolean;
  /** Kündigung eingegangen, aber noch nicht gebucht (E-391) — dann keine Raten-Post, wie Zentrale und Mahnmotor. */
  kuendigungUngebucht: boolean;
  /** „Aras für diesen Kunden aus“ (Streitfall/Betrug setzt das selbst, ein Mensch kann es auch). */
  arasAus: boolean;
  /** Offener Streitfall oder offene Beschwerde (streitOffenSql). */
  streitOffen: boolean;
  /** Nach der Mailbox: in den letzten 3 Tagen eine Raten-WhatsApp an ihn (jeder Absender) / eine Erinnerung von ARAS zu DIESER Rate. */
  rateWaKuerzlich: boolean; arasErinnerungKuerzlich: boolean;
  /** Am Zahltag: HEUTE (Berlin) schon eine Raten-WhatsApp an ihn / heute schon eine Erinnerung von ARAS an ihn. */
  rateWaHeute: boolean; arasErinnerungHeute: boolean;
}
export interface Urteil { senden: boolean; grund: string }

/** Was für BEIDE Erinnerungen gilt (Person, Vertrag, Sperren), in dieser Reihenfolge — der erste Grund, der hält; null = frei. Rein. */
export function grundBremsen(f: ErinnerungFakten): Urteil | null {
  if (f.notaus) return { senden: false, grund: "Not-Aus ist an" };
  if (!f.rateOffen) return { senden: false, grund: "Rate bezahlt oder storniert" };
  if (!f.rateFaellig) return { senden: false, grund: "Rate noch nicht fällig" };
  if (!f.erinnerbar) return { senden: false, grund: "Vertrag nicht erinnerbar (Abo-/Mahnstopp, Vertragsende)" };
  if (f.kuendigungUngebucht) return { senden: false, grund: "Kündigung eingegangen, noch nicht gebucht" };
  if (f.test) return { senden: false, grund: "Testperson" };
  if (f.global) return { senden: false, grund: "Global-Kunde" };
  if (f.telefonsperre) return { senden: false, grund: "Telefonsperre" };
  if (f.werbesperre) return { senden: false, grund: "Werbesperre" };
  if (f.streitOffen) return { senden: false, grund: "Streitfall oder Beschwerde offen" };
  if (f.arasAus) return { senden: false, grund: "ARAS für ihn aus" };
  return null;
}

/**
 * 1. Nach der Mailbox: nur ein Rate-Anruf, nur „mailbox“/„nicht erreicht“, nie nach einem Ende, das wir verursacht haben; dann
 * die Grund-Bremsen; „kürzlich“ = 3 Tage Raten-WhatsApp (jeder Absender) oder ARAS' eigene Erinnerung zu dieser Rate. Rein.
 */
export function mailboxUrteil(f: ErinnerungFakten & { spielart: string; ergebnis: string | null; endeGrund: string | null; probe?: boolean }): Urteil {
  if (f.probe || f.spielart === "probe") return { senden: false, grund: "Probeanruf" };
  if (f.spielart !== "rate") return { senden: false, grund: "kein Rate-Anruf" };
  if (f.ergebnis !== "mailbox" && f.ergebnis !== "nicht_erreicht") return { senden: false, grund: "erreicht" };
  if (f.endeGrund && TECHNIK_ENDE.includes(f.endeGrund)) return { senden: false, grund: `Ende durch uns (${f.endeGrund})` };
  const g = grundBremsen(f);
  if (g) return g;
  if (f.arasErinnerungKuerzlich) return { senden: false, grund: `ARAS hat zu dieser Rate in ${ERINNERUNG_BREMSE_TAGE} Tagen schon erinnert` };
  if (f.rateWaKuerzlich) return { senden: false, grund: `Raten-WhatsApp in den letzten ${ERINNERUNG_BREMSE_TAGE} Tagen` };
  return { senden: true, grund: "alle Bremsen frei" };
}

/**
 * 2. Am Zahltag: die Zusage gilt noch (nicht zurückgenommen, kein neuer Tag), seit ihr nichts bezahlt, heute Fenstertag; dann die
 * Grund-Bremsen; „kürzlich“ = NUR heute (eine Raten-WhatsApp oder ARAS' eigene Erinnerung heute). Rein.
 */
export function zahltagUrteil(f: ErinnerungFakten & { zusageGilt: boolean; seitherBezahlt: boolean; fensterTag: boolean }): Urteil {
  if (!f.zusageGilt) return { senden: false, grund: "Zusage zurückgenommen oder neuer Tag" };
  if (f.seitherBezahlt) return { senden: false, grund: "seit der Zusage bezahlt" };
  if (!f.fensterTag) return { senden: false, grund: "Sonntag oder Feiertag" };
  const g = grundBremsen(f);
  if (g) return g;
  if (f.arasErinnerungHeute) return { senden: false, grund: "ARAS hat ihn heute schon erinnert" };
  if (f.rateWaHeute) return { senden: false, grund: "heute schon eine Raten-WhatsApp" };
  return { senden: true, grund: "alle Bremsen frei" };
}

/** Liegt `jetzt` im Zahltag-Fenster (09:00–10:00 Berlin)? Rein. */
export function imZahltagFenster(jetzt: Date): boolean {
  const h = berlinTeile(jetzt).hhmm;
  return h >= ZAHLTAG_FENSTER.von && h < ZAHLTAG_FENSTER.bis;
}

// ── Die Fakten aus der Datenbank ───────────────────────────────────────────
/** Alles, was die Regel über Person und Rate wissen muss. Vorsichtig: Was nicht lesbar ist, schließt aus (wirft → kein Versand). */
export async function faktenLaden(e: { personId: number; rateId: number | null; nummer: string; heute: string; notaus: boolean }, lauf: Lauf = sqlPool): Promise<ErinnerungFakten> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.heute)) throw new Error(`Berliner Datum „${e.heute}“ unlesbar.`);
  await globalKundeBereit();
  const [r] = e.rateId ? ((await lauf.unsafe(`
    SELECT (r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offen,
           (r.faellig_am::date <= $2::date) AS faellig,
           (a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL
            AND a.mahnstopp_am IS NULL AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")}) AS erinnerbar
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref WHERE r.id = $1`, [Number(e.rateId), e.heute])) as any[]) : [null];
  // Werbesperre und Kündigung: dieselben Bausteine wie die WhatsApp-Zentrale bei der Monatsrate (fiaon-wa-zentrale.ts, BASIS und
  // gruppenBedingung „rate_offen“) — die Werbesperre am Kopf der Familie, ohne die aus der Zahlungspost-Freigabe.
  const rateWa = (seit: string) => `EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.person_id = p.id AND w.richtung = 'raus'
                     AND COALESCE(w.status, '') <> 'fehler' AND w.vorlage ~ '${RATEN_WA_MUSTER}' AND ${seit})`;
  const [p] = (await lauf.unsafe(`
    SELECT (p.ist_test_am IS NOT NULL OR p.merged_into_person_id IS NOT NULL) AS test,
           ${globalKundeSql("p.id")} AS global,
           (${KOPF_SQL("p.id")} IN ${WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL}) AS werbesperre,
           ${KUENDIGUNG_UNGEBUCHT_SQL("p.id")} AS kuendigung_ungebucht,
           EXISTS (SELECT 1 FROM fiaon_aras_person ap WHERE ap.person_id = p.id AND ap.aus_am IS NOT NULL) AS aras_aus,
           ${streitOffenSql("p.id")} AS streit_offen,
           ${rateWa(`w.created_at > NOW() - make_interval(days => ${ERINNERUNG_BREMSE_TAGE})`)} AS wa_kuerzlich,
           ${rateWa(`(w.created_at AT TIME ZONE 'Europe/Berlin')::date = $3::date`)} AS wa_heute,
           EXISTS (SELECT 1 FROM fiaon_aras_erinnerung ae WHERE ae.rate_id = $2 AND ae.status = 'gesendet'
                     AND ae.created_at > NOW() - make_interval(days => ${ERINNERUNG_BREMSE_TAGE})) AS aras_kuerzlich,
           EXISTS (SELECT 1 FROM fiaon_aras_erinnerung ah WHERE ah.person_id = p.id AND ah.status = 'gesendet'
                     AND (ah.updated_at AT TIME ZONE 'Europe/Berlin')::date = $3::date) AS aras_heute
      FROM fiaon_persons p WHERE p.id = $1`, [Number(e.personId), e.rateId != null ? Number(e.rateId) : null, e.heute])) as any[];
  if (!p) throw new Error(`Person ${e.personId} fehlt.`);
  return {
    notaus: e.notaus,
    rateOffen: r?.offen === true, rateFaellig: r?.faellig === true, erinnerbar: r?.erinnerbar === true,
    test: p.test === true, global: p.global === true, werbesperre: p.werbesperre === true, kuendigungUngebucht: p.kuendigung_ungebucht === true,
    telefonsperre: await telefonGesperrt(nummerKern(e.nummer), e.personId, lauf),
    arasAus: p.aras_aus === true, streitOffen: p.streit_offen === true,
    rateWaKuerzlich: p.wa_kuerzlich === true, arasErinnerungKuerzlich: p.aras_kuerzlich === true,
    rateWaHeute: p.wa_heute === true, arasErinnerungHeute: p.aras_heute === true,
  };
}

// ── Gemeinsam: die Zeile, der Kontext, der Versand ─────────────────────────
interface ZeileEin { schluessel: string; art: "mailbox" | "zahltag"; personId: number; rateId: number | null; arasAnrufId: number | null; callId: number | null; zusageTag?: string | null; status: "laeuft" | "ausgelassen"; grund?: string | null }
/** Die EINE Zeile je Anlass anlegen — null, wenn es sie schon gibt (dann hat ein anderer Lauf/eine andere Instanz entschieden). */
async function zeileAnlegen(z: ZeileEin, lauf: Lauf): Promise<number | null> {
  const [r] = (await lauf`
    INSERT INTO fiaon_aras_erinnerung (schluessel, art, person_id, rate_id, aras_anruf_id, call_id, zusage_tag, status, grund)
    VALUES (${z.schluessel}, ${z.art}, ${z.personId}, ${z.rateId}, ${z.arasAnrufId}, ${z.callId}, ${z.zusageTag ?? null}, ${z.status}, ${z.grund ? z.grund.slice(0, 300) : null})
    ON CONFLICT (schluessel) DO NOTHING RETURNING id`) as any[];
  return r?.id != null ? Number(r.id) : null;
}

/** Ein Werkzeug-Kontext wie im Gespräch — ohne Akte-Ergebnis (ergebnisGesetzt), ohne Aufnahme, ohne Übergabe. */
async function kontext(e: { callId: number; arasAnrufId: number; personId: number; ref: string | null; nummer: string; spielart: Spielart; rateId: number | null; planId: number | null; einstellungen: ArasEinstellungen }, lauf: Lauf): Promise<WerkzeugKontext> {
  const briefing = await briefingBauen({ personId: e.personId, nummer: e.nummer, spielart: "rate", rateId: e.rateId, planId: e.planId }, lauf);
  const nichts = async () => ({ ok: false, grund: "erinnerung" });
  return {
    callId: e.callId, arasAnrufId: e.arasAnrufId, personId: e.personId, ref: e.ref, nummer: e.nummer, land: nummerLand(e.nummer) ?? "DE", spielart: e.spielart,
    briefing, einstellungen: e.einstellungen, ergebnisGesetzt: true, ausgefuehrt: [],
    letzteKundenZeile: () => null, aufnahmeStarten: nichts, uebergabe: nichts, beenden: async () => {},
  };
}

export interface ErinnerungErgebnis { status: "gesendet" | "fehlgeschlagen" | "ausgelassen" | "schon"; grund: string; weg?: "whatsapp" | "mail" | null }

/**
 * Derselbe Weg wie im Gespräch: zahlungslink_senden (WhatsApp-Vorlage fiaon_kk_rate; geschlossenes Fenster oder Bremse → Mail).
 * Scheitert die WhatsApp sonst, einmal die Raten-Mail. Ampel Rot → nichts. Die Zeile wird mit dem Ausgang abgeschlossen.
 */
async function versenden(zeileId: number, ctx: WerkzeugKontext, aufruf: string, anlass: "mailbox" | "zahltag", lauf: Lauf, senden: Senden): Promise<ErinnerungErgebnis> {
  if (!ctx.briefing.offeneRate) {
    // Ohne offene Rate im Briefing ginge zahlungslink_senden auf den Antrag-Link — das wäre falsch.
    await lauf`UPDATE fiaon_aras_erinnerung SET status = 'ausgelassen', grund = 'keine offene Rate im Briefing', updated_at = NOW() WHERE id = ${zeileId}`;
    return { status: "ausgelassen", grund: "keine offene Rate im Briefing" };
  }
  let r = await senden(ctx, "zahlungslink_senden", { weg: "whatsapp", zweck: "rate", anlass }, aufruf, lauf);
  let weg: "whatsapp" | "mail" | null = r.ok ? (/whatsapp/i.test(String(r.vorlesen ?? "")) ? "whatsapp" : "mail") : null;
  if (!r.ok && r.fehler !== "ampel_rot") {
    r = await senden(ctx, "zahlungslink_senden", { weg: "mail", zweck: "rate", anlass }, `${aufruf}-mail`, lauf);
    weg = r.ok ? "mail" : null;
  }
  const status = r.ok ? "gesendet" : "fehlgeschlagen";
  const grund = r.ok ? `per ${weg === "whatsapp" ? "WhatsApp" : "Mail"}` : String(r.fehler ?? "nicht rausgegangen").slice(0, 200);
  await lauf`UPDATE fiaon_aras_erinnerung SET status = ${status}, weg = ${weg}, grund = ${grund}, updated_at = NOW() WHERE id = ${zeileId}`;
  return { status, grund, weg };
}

const tagDe = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

// ═══ 1. Nach der Mailbox ═══════════════════════════════════════════════════
/**
 * Die Nachbereitung ruft das nach JEDEM Rate-Anruf ohne Gespräch (mailbox / nicht erreicht). Genau eine Entscheidung je Anruf
 * (schluessel mailbox:<ARAS-Anruf>); wirft nie nach außen.
 */
export async function nachMailboxErinnern(e: { arasAnrufId: number; ergebnis: string | null; endeGrund: string | null }, lauf: Lauf = sqlPool, senden: Senden = werkzeugAusfuehren): Promise<ErinnerungErgebnis> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    SELECT aa.id, aa.call_id, aa.spielart, aa.plan_id, c.person_id, c.nummer, COALESCE(c.ref, pl.ref) AS ref, pl.rate_id
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id LEFT JOIN fiaon_aras_plan pl ON pl.id = aa.plan_id
     WHERE aa.id = ${e.arasAnrufId}`) as any[];
  if (!z?.person_id) return { status: "ausgelassen", grund: "ohne Person" };
  const schluessel = `mailbox:${e.arasAnrufId}`;
  const [schon] = (await lauf`SELECT status, grund FROM fiaon_aras_erinnerung WHERE schluessel = ${schluessel}`) as any[];
  if (schon) return { status: "schon", grund: String(schon.grund ?? schon.status) };
  const personId = Number(z.person_id), rateId = z.rate_id != null ? Number(z.rate_id) : null, callId = Number(z.call_id);
  const einst = await arasEinstellungenLesen(true, lauf);
  const heute = berlinTeile(new Date()).datum;
  const f = await faktenLaden({ personId, rateId, nummer: String(z.nummer), heute, notaus: einst.notaus }, lauf);
  const u = mailboxUrteil({ ...f, spielart: String(z.spielart), ergebnis: e.ergebnis, endeGrund: e.endeGrund });
  const basis = { schluessel, art: "mailbox" as const, personId, rateId, arasAnrufId: e.arasAnrufId, callId };
  if (!u.senden) {
    if (await zeileAnlegen({ ...basis, status: "ausgelassen", grund: u.grund }, lauf)) {
      await arasEreignis({ art: "aras_werkzeug", callId, arasAnrufId: e.arasAnrufId, personId, spielart: "rate", ok: true,
        text: `Nach der Mailbox: keine Raten-Erinnerung — ${u.grund}`, daten: { erinnerung: "mailbox", status: "ausgelassen", grund: u.grund } });
    }
    return { status: "ausgelassen", grund: u.grund };
  }
  const id = await zeileAnlegen({ ...basis, status: "laeuft" }, lauf);
  if (!id) return { status: "schon", grund: "schon entschieden" };
  try {
    const ctx = await kontext({ callId, arasAnrufId: e.arasAnrufId, personId, ref: z.ref ?? null, nummer: String(z.nummer), spielart: "rate", rateId, planId: z.plan_id != null ? Number(z.plan_id) : null, einstellungen: einst }, lauf);
    const r = await versenden(id, ctx, `mailbox-${e.arasAnrufId}`, "mailbox", lauf, senden);
    await arasEreignis({ art: "aras_werkzeug", callId, arasAnrufId: e.arasAnrufId, personId, spielart: "rate", ok: r.status !== "fehlgeschlagen",
      text: r.status === "gesendet" ? `Nach der Mailbox: Raten-Erinnerung ${r.grund}` : `Nach der Mailbox: Raten-Erinnerung ${r.status === "ausgelassen" ? "ausgelassen" : "nicht rausgegangen"} — ${r.grund}`,
      daten: { erinnerung: "mailbox", status: r.status, weg: r.weg ?? null, grund: r.grund } });
    return r;
  } catch (err) {
    const grund = String((err as Error)?.message ?? err).slice(0, 200);
    await lauf`UPDATE fiaon_aras_erinnerung SET status = 'fehlgeschlagen', grund = ${grund}, updated_at = NOW() WHERE id = ${id}`.catch(() => null);
    return { status: "fehlgeschlagen", grund };
  }
}

// ═══ 2. Am Zahltag ═════════════════════════════════════════════════════════
export interface ZahltagKandidat { personId: number; arasAnrufId: number; callId: number; spielart: Spielart; planId: number | null; nummer: string; ref: string | null; rateId: number | null; zusageAm: Date }

/**
 * Die Zusagen an ARAS für `heute`, gegeben VOR heute (eine Zusage „zahle heute“ aus dem Gespräch von heute früh braucht keine
 * Erinnerung eine Stunde später) — je Person die jüngste. Quelle ist das Werkzeug im Gespräch (daran hängt die Erinnerung);
 * ob die Zusage in der Akte noch gilt, prüft zahltagUrteil.
 */
export async function zahltagKandidaten(heute: string, lauf: Lauf = sqlPool): Promise<ZahltagKandidat[]> {
  await arasSchema(lauf);
  const mitternacht = berlinZeitpunkt(heute, 0);
  const rows = (await lauf`
    SELECT DISTINCT ON (c.person_id) c.person_id, aa.id AS aras_anruf_id, aa.call_id, aa.spielart, aa.plan_id, c.nummer, COALESCE(c.ref, pl.ref) AS ref,
           pl.rate_id, w.created_at AS zusage_am
      FROM fiaon_aras_werkzeug w
      JOIN fiaon_aras_anruf aa ON aa.id = w.aras_anruf_id
      JOIN fiaon_calls c ON c.id = aa.call_id
      LEFT JOIN fiaon_aras_plan pl ON pl.id = aa.plan_id
     WHERE w.werkzeug = 'zahlungszusage_merken' AND w.ok IS TRUE
       AND COALESCE((w.ergebnis->>'trocken')::boolean, FALSE) = FALSE
       AND w.eingabe->>'datum' = ${heute}
       AND w.created_at < ${mitternacht} AND w.created_at > ${mitternacht} - INTERVAL '90 days'
       AND aa.spielart <> 'probe' AND c.person_id IS NOT NULL
     ORDER BY c.person_id, w.created_at DESC`) as any[];
  return rows.map((r) => ({
    personId: Number(r.person_id), arasAnrufId: Number(r.aras_anruf_id), callId: Number(r.call_id), spielart: r.spielart as Spielart,
    planId: r.plan_id != null ? Number(r.plan_id) : null, nummer: String(r.nummer ?? ""), ref: r.ref ?? null,
    rateId: r.rate_id != null ? Number(r.rate_id) : null, zusageAm: new Date(r.zusage_am),
  }));
}

/** Gilt die Zusage für `heute` in der Akte noch (jüngste, nicht zurückgenommen), und wurde seit `zusageAm` etwas bezahlt? */
async function zusageLage(personId: number, zusageAm: Date, heute: string, lauf: Lauf): Promise<{ zusageGilt: boolean; seitherBezahlt: boolean; rateId: number | null }> {
  const [z] = (await lauf`
    SELECT (SELECT (zl.promised_date AT TIME ZONE 'Europe/Berlin')::date::text
              FROM fiaon_applications za JOIN fiaon_contact_log zl ON zl.ref = za.ref
             WHERE za.person_id = ${personId} AND zl.type = 'result' AND zl.outcome = 'erreicht_zahlt_am' AND zl.voided_at IS NULL
               AND zl.promised_date IS NOT NULL
             ORDER BY zl.created_at DESC, zl.id DESC LIMIT 1) AS letzte,
           EXISTS (SELECT 1 FROM fiaon_abo_raten br JOIN fiaon_applications ba ON ba.ref = br.ref
                    WHERE ba.person_id = ${personId} AND br.bezahlt_am > ${zusageAm}) AS bezahlt,
           (SELECT r.id FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
             WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
               AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL AND r.faellig_am::date <= ${heute}::date
             ORDER BY r.faellig_am, r.id LIMIT 1) AS rate_id`) as any[];
  return { zusageGilt: String(z?.letzte ?? "") === heute, seitherBezahlt: z?.bezahlt === true, rateId: z?.rate_id != null ? Number(z.rate_id) : null };
}

/**
 * Der Takt aras_zahltag (alle 5 Minuten, wirkt nur 09:00–10:00 Berlin): je Zusage für heute GENAU EINE Entscheidung
 * (schluessel zahltag:<Person>:<Tag>, auch über zwei Instanzen). ARAS aus, Not-Aus oder Stufe 0 → nichts. Liefert true, wenn er
 * etwas entschieden hat (dann eine Zeile in der Lauf-Historie).
 */
export async function zahltagErinnern(lauf: Lauf = sqlPool, jetzt: Date = new Date(), senden: Senden = werkzeugAusfuehren): Promise<boolean> {
  if (!imZahltagFenster(jetzt)) return false;
  await arasSchema(lauf);
  const einst = await arasEinstellungenLesen(true, lauf);
  if (!kundenAnrufeAn(einst)) return false;
  const heute = berlinTeile(jetzt).datum;
  let getan = false;
  for (const k of await zahltagKandidaten(heute, lauf)) {
    const schluessel = `zahltag:${k.personId}:${heute}`;
    const [schon] = (await lauf`SELECT 1 FROM fiaon_aras_erinnerung WHERE schluessel = ${schluessel}`) as any[];
    if (schon) continue;
    try {
      const lage = await zusageLage(k.personId, k.zusageAm, heute, lauf);
      const rateId = k.rateId ?? lage.rateId;
      const f = await faktenLaden({ personId: k.personId, rateId, nummer: k.nummer, heute, notaus: einst.notaus }, lauf);
      const u = zahltagUrteil({ ...f, zusageGilt: lage.zusageGilt, seitherBezahlt: lage.seitherBezahlt,
        fensterTag: rateFensterTag(heute, { land: nummerLand(k.nummer) ?? "DE", fenster: einst.fenster }) });
      const basis = { schluessel, art: "zahltag" as const, personId: k.personId, rateId, arasAnrufId: k.arasAnrufId, callId: k.callId, zusageTag: heute };
      if (!u.senden) {
        if (await zeileAnlegen({ ...basis, status: "ausgelassen", grund: u.grund }, lauf)) {
          getan = true;
          await arasEreignis({ art: "aras_werkzeug", callId: k.callId, arasAnrufId: k.arasAnrufId, personId: k.personId, spielart: k.spielart, ok: true,
            text: `Zahltag ${tagDe(heute)}: keine Raten-Erinnerung — ${u.grund}`, daten: { erinnerung: "zahltag", status: "ausgelassen", grund: u.grund } });
        }
        continue;
      }
      const id = await zeileAnlegen({ ...basis, status: "laeuft" }, lauf);
      if (!id) continue;
      getan = true;
      let r: ErinnerungErgebnis;
      try {
        const ctx = await kontext({ callId: k.callId, arasAnrufId: k.arasAnrufId, personId: k.personId, ref: k.ref, nummer: k.nummer, spielart: k.spielart, rateId, planId: k.planId, einstellungen: einst }, lauf);
        r = await versenden(id, ctx, `zahltag-${k.personId}-${heute}`, "zahltag", lauf, senden);
      } catch (err) {
        // Die Zeile ist angelegt („höchstens einmal je Zusage“) — sie bekommt den Fehler als Ausgang.
        r = { status: "fehlgeschlagen", grund: String((err as Error)?.message ?? err).slice(0, 200) };
        await lauf`UPDATE fiaon_aras_erinnerung SET status = 'fehlgeschlagen', grund = ${r.grund}, updated_at = NOW() WHERE id = ${id}`.catch(() => null);
      }
      await arasEreignis({ art: "aras_werkzeug", callId: k.callId, arasAnrufId: k.arasAnrufId, personId: k.personId, spielart: k.spielart, ok: r.status !== "fehlgeschlagen",
        text: r.status === "gesendet" ? `Zahltag ${tagDe(heute)}: Raten-Erinnerung ${r.grund}` : `Zahltag ${tagDe(heute)}: Raten-Erinnerung ${r.status === "ausgelassen" ? "ausgelassen" : "nicht rausgegangen"} — ${r.grund}`,
        daten: { erinnerung: "zahltag", status: r.status, weg: r.weg ?? null, grund: r.grund } });
    } catch (err) {
      // Nichts angelegt → der nächste Takt (in 5 Minuten, noch im Fenster) versucht es erneut.
      console.error("[ARAS-ZAHLTAG]", k.personId, String((err as Error)?.message ?? err).slice(0, 200));
    }
  }
  return getan;
}
