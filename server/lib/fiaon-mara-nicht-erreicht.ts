// ═══════════════════════════════════════════════════════════════════════════
// MARA FASST NACH „NICHT ERREICHT“ SELBST NACH — DER SERVER HANDELT (19.10.2026, E-401 5/6)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Die Regel (wer, wann, wie oft) steht rein in shared/fiaon-nicht-erreicht-nachfass.ts. Hier:
//
//   1. VORMERKEN — ergebnisAnwenden (fiaon-kontakt-ergebnis.ts) ruft nachfassVormerken, sobald ein
//      Gesprächsergebnis „Nicht erreicht“/„Mailbox“ den Zähler auf GENAU 2 hebt (entprellt gezählt).
//      Dieselbe Regel urteilt sofort: Wer ausgeschlossen ist, bekommt einen Merker „ausgelassen“ mit
//      Grund (sichtbar im Chefbüro), alle anderen „vorgemerkt“ (mit nicht_vor außerhalb 08–20 Uhr).
//      Kein Versand im Klick des Mitarbeiters: Die Buchung des Ergebnisses bleibt schnell und eine
//      Transaktion des Aufrufers (Tagesbericht) wird nie von einem Mailweg aufgehalten.
//   2. SENDEN — der Takt nachfassTakt (routes.ts, tageslauf „mara_nicht_erreicht_mail“, alle 5 Min.)
//      nimmt fällige Merker atomar (FOR UPDATE SKIP LOCKED), prüft die Regel NOCH EINMAL (erreicht?
//      Termin gebucht? inzwischen gesperrt?) und verschickt über den einen Weg des Hauses
//      (versendenUndProtokollieren → Tür in make-webhook.ts: Adresse, Global-Wand, Werbesperre,
//      Frequenzbremse, Protokoll). Die Nutzlast baut sendePayloadBauen — dieselbe wie im Sende-Menü
//      (Nennform des Betreuers, Vertretung, Terminlink mit Herkunft nicht_erreicht_2_mail).
//
// NIE DOPPELT: ein Merker je Person (PRIMARY KEY). Ein neuer entsteht erst, wenn der alte älter als
// SPERRE_TAGE ist — und nur, wenn der Zähler wieder genau 2 erreicht (nach einem Gespräch fällt er auf 0).
// Ein Merker, der beim Senden hängen blieb (Absturz), wird „unklar“ und nie erneut gesendet.
//
// Wirft nie: Eine Automatik, die das Dokumentieren eines Anrufs scheitern lässt, kostet mehr als sie
// bringt — Fehler stehen im Server-Log und im Merker.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "@shared/fiaon-kuendigung-regel";
import {
  ABSTAND_STUNDEN, ABSTAND_AUCH, NACHFASS_EVENT, NACHFASS_HERKUNFT, NACHFASS_NACH_VERSUCH, NACHFASS_SCHALTER, SPERRE_TAGE,
  TERMINLINK_EREIGNISSE, VERFALL_STUNDEN, hinweisFuerMitarbeiter, imVersandfenster, naechstesFenster,
  nachfassUrteil, schalterAn, type NachfassFakten, type NachfassUrteil, type Zustaendigkeit,
} from "@shared/fiaon-nicht-erreicht-nachfass";

type Lauf = any;
export const NACHFASS_TABELLE = "fiaon_nicht_erreicht_nachfass";

/** Merker-Zustände. vorgemerkt/in_arbeit sind offen, alle anderen abgeschlossen. */
export type NachfassStatus =
  | "vorgemerkt" | "in_arbeit" | "versandt" | "fehlgeschlagen" | "ohne_mail"
  | "ausgelassen" | "erledigt" | "verfallen" | "unklar";

let tabelleBereit: Promise<boolean> | null = null;
/**
 * Die Merker-Tabelle beim ersten Gebrauch anlegen — über den GLOBALEN Pool und mit kurzer
 * Sperrfrist (AGENTS.md, Falle 1: DDL wartet sonst auf eine offene Transaktion). Eine NEUE Tabelle
 * sperrt nichts Bestehendes. Scheitert das Anlegen, fällt nur diese Automatik aus.
 */
export function nachfassTabelle(): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          CREATE TABLE IF NOT EXISTS fiaon_nicht_erreicht_nachfass (
            person_id INTEGER PRIMARY KEY,
            vorgemerkt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            versuche INTEGER,
            status TEXT NOT NULL,
            grund TEXT,
            nicht_vor TIMESTAMPTZ,
            bearbeitet_am TIMESTAMPTZ,
            erledigt_am TIMESTAMPTZ
          )`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_nicht_erreicht_nachfass_offen ON fiaon_nicht_erreicht_nachfass (status, nicht_vor)`;
      });
      return true;
    })().catch((e) => {
      console.error("[MARA-NACHFASS] Merker-Tabelle nicht bereit — Nachfassen ruht:", e?.message || e);
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/** Der Schalter (fiaon_settings.mara_nicht_erreicht_mail). Fehlt er: AN. Lesefehler: AUS (lieber keine Mail). */
export async function schalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${NACHFASS_SCHALTER}`) as any[];
    return schalterAn(z?.value);
  } catch (e) {
    console.error("[MARA-NACHFASS] Schalter nicht lesbar — nichts vormerken:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function schalterSetzen(an: boolean): Promise<void> {
  const wert = an ? "an" : "aus";
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${NACHFASS_SCHALTER}, ${wert})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Was der Server über den Menschen weiß (NachfassFakten). Jede Teilprüfung, die scheitert, urteilt
 * VORSICHTIG: Global-Prüfung kaputt → als Global-Kunde behandeln, Sperrprüfung kaputt → gesperrt,
 * Adresse unklar → keine Adresse. Eine Mail zu wenig ist billiger als eine an den Falschen.
 */
export async function nachfassFakten(personId: number, lauf: Lauf = sqlPool): Promise<NachfassFakten> {
  const { zustaendigeRolleSql } = await import("./fiaon-zustaendigkeit");
  // Feste Namen aus dem Quelltext (nur [a-z_]) — als Literal-Liste, kein Wert von außen.
  const ereignisse = TERMINLINK_EREIGNISSE.filter((n) => /^[a-z_0-9]+$/.test(n)).map((n) => `'${n}'`).join(", ");
  const auch = ABSTAND_AUCH.filter((n) => /^[a-z_0-9]+$/.test(n)).map((n) => `'${n}'`).join(", ");
  const [p] = (await lauf.unsafe(`
    SELECT p.id, COALESCE(p.unreachable_count, 0)::int AS versuche,
           (${zustaendigeRolleSql("p")}) AS rolle,
           (EXISTS (SELECT 1 FROM fiaon_termine t
                     WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW())
            OR EXISTS (SELECT 1 FROM fiaon_contact_log c
                        WHERE (c.person_id = p.id
                               OR c.ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id))
                          AND c.outcome = 'rueckruf_termin' AND c.done_at IS NULL AND c.voided_at IS NULL
                          AND c.scheduled_at > NOW())) AS termin_offen,
           (SELECT MAX(m.created_at) FROM fiaon_mail_log m
             WHERE m.person_id = p.id AND COALESCE(m.art, 'echt') = 'echt'
               AND ((m.status = 'versandt' AND (m.event IN (${ereignisse}) OR LEFT(m.event, 9) = 'rueckhol_'))
                    -- E-401 Nachbesserung: auch Mara-Aktion („gesendet“), Lead-Nachfassen, Antrags-Erinnerung.
                    OR (m.status IN ('versandt', 'gesendet') AND m.event IN (${auch})))) AS letzte_terminmail,
           -- E-401 Nachbesserung (Prüfer-Fund): ein eingegangener, noch nicht gebuchter Kündigungsantrag (E-368).
           ${KUENDIGUNG_UNGEBUCHT_SQL("p.id")} AS kuendigung_offen
      FROM fiaon_persons p
     WHERE p.id = $1 AND p.merged_into_person_id IS NULL`, [personId])) as any[];
  if (!p) {
    return { personDa: false, versuche: 0, rolle: null, globalKunde: false, sperre: null, terminOffen: false, hatEmail: false, letzteTerminMailAm: null, kuendigungOffen: false };
  }
  const { istGlobalKunde } = await import("./fiaon-global-kunde");
  const { menschSperre, werbungVerboten } = await import("./fiaon-mail-frequenz");
  const { hatZustellbareMail } = await import("./fiaon-empfaenger");
  // E-272: über den Pool, nicht über `lauf` — ein Fehler dort darf die Transaktion des Aufrufers nicht abbrechen.
  const globalKunde = await istGlobalKunde(personId).catch(() => true);
  const sperre = await menschSperre(personId, lauf)
    .then((s) => werbungVerboten(s))
    .catch(() => "Sperrprüfung nicht möglich");
  const hatEmail = await hatZustellbareMail(personId, lauf).catch(() => false);
  const rolle = ["vertrieb", "onboarding", "inkasso"].includes(String(p.rolle)) ? (String(p.rolle) as Zustaendigkeit) : null;
  return {
    personDa: true,
    versuche: Number(p.versuche || 0),
    rolle,
    globalKunde,
    sperre,
    terminOffen: p.termin_offen === true,
    hatEmail,
    letzteTerminMailAm: p.letzte_terminmail ?? null,
    kuendigungOffen: p.kuendigung_offen === true,
  };
}

/** Postgres-Transaktion? Dann in einem Sicherungspunkt arbeiten — ein Fehler hier bricht nie die Buchung ab. */
async function sicher<T>(lauf: Lauf, arbeit: (tx: Lauf) => Promise<T>): Promise<T> {
  const sp = (lauf as any)?.savepoint;
  if (lauf !== sqlPool && typeof sp === "function") return await (lauf as any).savepoint((tx: Lauf) => arbeit(tx));
  return await arbeit(lauf);
}

export interface VormerkWirkung {
  /** Das Urteil beim Vormerken — null, wenn nichts geschah (nicht der 2. Versuch, Schalter aus, schon gemerkt). */
  urteil: NachfassUrteil | null;
  /** Der Satz für den Mitarbeiter (hängt an der Meldung des Ergebnisses). */
  hinweis: string | null;
}

/**
 * Nach einem GEZÄHLTEN Fehlversuch (ergebnisAnwenden): Ist es der zweite, merkt Mara die
 * Terminlink-Mail vor — oder hält fest, warum nicht. Sendet nie selbst (das tut der Takt).
 */
export async function nachfassVormerken(
  personId: number, versuche: number, lauf: Lauf = sqlPool, jetzt: Date = new Date(),
): Promise<VormerkWirkung> {
  const nichts: VormerkWirkung = { urteil: null, hinweis: null };
  if (!Number.isInteger(personId) || personId <= 0 || Number(versuche) !== NACHFASS_NACH_VERSUCH) return nichts;
  try {
    if (!(await nachfassTabelle())) return nichts;
    return await sicher(lauf, async (tx) => {
      if (!(await schalterLesen(tx))) return nichts;
      const f = await nachfassFakten(personId, tx);
      const u = nachfassUrteil(f, jetzt);
      const offen = u.art === "senden" || u.art === "warten";
      const status: NachfassStatus = offen ? "vorgemerkt" : "ausgelassen";
      const grund = u.art === "senden" ? null : u.grund;
      const nichtVor = u.art === "warten" ? u.nichtVor : null;
      // ── NIE DOPPELT: der Merker gewinnt nur, wenn es keinen gibt oder der alte älter als SPERRE_TAGE ist ──
      const neu = (await tx`
        INSERT INTO fiaon_nicht_erreicht_nachfass (person_id, vorgemerkt_am, versuche, status, grund, nicht_vor, bearbeitet_am, erledigt_am)
        VALUES (${personId}, NOW(), ${Number(versuche)}, ${status}, ${grund}, ${nichtVor}, NULL, ${offen ? null : new Date()})
        ON CONFLICT (person_id) DO UPDATE
           SET vorgemerkt_am = NOW(), versuche = EXCLUDED.versuche, status = EXCLUDED.status, grund = EXCLUDED.grund,
               nicht_vor = EXCLUDED.nicht_vor, bearbeitet_am = NULL, erledigt_am = EXCLUDED.erledigt_am
         WHERE fiaon_nicht_erreicht_nachfass.vorgemerkt_am < NOW() - (${SPERRE_TAGE}::int * INTERVAL '1 day')
        RETURNING person_id`) as any[];
      if (!neu.length) return nichts;
      return { urteil: u, hinweis: hinweisFuerMitarbeiter(u, jetzt) };
    });
  } catch (e) {
    console.error(`[MARA-NACHFASS] Vormerken für Person ${personId}:`, e instanceof Error ? e.message : e);
    return nichts;
  }
}

export interface TaktErgebnis {
  aus: boolean;
  versandt: number;
  fehlgeschlagen: number;
  ohneMail: number;
  ausgelassen: number;
  erledigt: number;
  wartet: number;
  verfallen: number;
  unklar: number;
}
const LEER_TAKT = (): TaktErgebnis => ({ aus: false, versandt: 0, fehlgeschlagen: 0, ohneMail: 0, ausgelassen: 0, erledigt: 0, wartet: 0, verfallen: 0, unklar: 0 });
export const istBearbeitet = (e: TaktErgebnis) =>
  e.versandt + e.fehlgeschlagen + e.ohneMail + e.ausgelassen + e.erledigt + e.wartet + e.verfallen + e.unklar > 0;

/** Den Merker abschließen (oder zurück auf „vorgemerkt“ mit neuem nicht_vor). */
async function merkerSetzen(personId: number, status: NachfassStatus, grund: string | null, nichtVor: Date | null = null): Promise<void> {
  const fertig = status !== "vorgemerkt" && status !== "in_arbeit";
  await sqlPool`
    UPDATE fiaon_nicht_erreicht_nachfass
       SET status = ${status}, grund = ${grund ? String(grund).slice(0, 500) : null}, nicht_vor = ${nichtVor},
           erledigt_am = ${fertig ? new Date() : null}
     WHERE person_id = ${personId}`;
}

/** Einen genommenen Merker abarbeiten — die Regel noch einmal, dann senden oder abschließen. */
async function nachfassEinen(personId: number, jetzt: Date, e: TaktErgebnis): Promise<void> {
  const f = await nachfassFakten(personId);
  const u = nachfassUrteil(f, jetzt);
  if (u.art === "warten") { await merkerSetzen(personId, "vorgemerkt", u.grund, u.nichtVor); e.wartet++; return; }
  if (u.art === "auslassen") { await merkerSetzen(personId, "ausgelassen", u.grund); e.ausgelassen++; return; }
  if (u.art === "erledigt") { await merkerSetzen(personId, "erledigt", u.grund); e.erledigt++; return; }

  // ── SENDEN: dieselbe Nutzlast wie im Sende-Menü (Nennform, Vertretung, persönlicher Terminlink) ──
  const { sendePayloadBauen } = await import("./fiaon-mail-senden");
  const g = await sendePayloadBauen(NACHFASS_EVENT, personId);
  if (!g || g.fehler) { await merkerSetzen(personId, "fehlgeschlagen", g?.fehler ?? "Kunde nicht gefunden"); e.fehlgeschlagen++; return; }
  const nutzlast: Record<string, unknown> = { ...g.basis, ...g.links, person_id: personId };
  const terminLinkDa = String(nutzlast.termin_link ?? "").trim() !== "";
  if (!terminLinkDa) { await merkerSetzen(personId, "fehlgeschlagen", "Kein Terminlink gebaut"); e.fehlgeschlagen++; return; }
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  const verlaufText = `Mara: kurze Mail mit dem Terminlink versandt (${f.versuche}× nicht erreicht) — der Kunde wählt seine Zeit selbst.`;
  const erg = await versendenUndProtokollieren(
    NACHFASS_EVENT as any,
    nutzlast as any,
    { personId, verlaufRef: g.ref ?? null, verlaufText },
  );
  // Ohne Bestellung (reiner Lead) gibt es keinen Verlaufseintrag (fiaon_contact_log.ref ist Pflicht) — die Mail
  // steht dann mit person_id im Zustellprotokoll (fiaon_mail_log), das die Akte unter „Mails“ zeigt.
  if (erg.status === "versandt") { await merkerSetzen(personId, "versandt", null); e.versandt++; return; }
  if (erg.status === "uebersprungen") { await merkerSetzen(personId, "ohne_mail", erg.grund ?? null); e.ohneMail++; return; }
  // Die Frequenzbremse hält nur auf — dann später noch einmal (bis VERFALL_STUNDEN), sonst ist es ein echtes Nein.
  if (/^Frequenzbremse/.test(String(erg.grund ?? ""))) {
    await merkerSetzen(personId, "vorgemerkt", erg.grund ?? null, naechstesFenster(new Date(jetzt.getTime() + ABSTAND_STUNDEN * 3_600_000)));
    e.wartet++;
    return;
  }
  await merkerSetzen(personId, "fehlgeschlagen", erg.grund ?? null);
  e.fehlgeschlagen++;
}

/**
 * Der Takt (alle 5 Minuten, routes.ts): Hängengebliebenes → „unklar“, zu lange Wartendes →
 * „verfallen“, dann im Fenster 08–20 Uhr bis zu `hoechstens` fällige Merker senden.
 */
export async function nachfassTakt(opts: { jetzt?: Date; hoechstens?: number } = {}): Promise<TaktErgebnis> {
  const e = LEER_TAKT();
  const jetzt = opts.jetzt ?? new Date();
  if (!(await nachfassTabelle())) return e;
  if (!(await schalterLesen())) { e.aus = true; return e; }
  // Ein Absturz mitten im Senden: lieber keine zweite Mail als eine doppelte.
  const haengt = (await sqlPool`
    UPDATE fiaon_nicht_erreicht_nachfass
       SET status = 'unklar', grund = 'Beim Senden unterbrochen — wird nicht wiederholt (nie doppelt)', erledigt_am = NOW()
     WHERE status = 'in_arbeit' AND bearbeitet_am < NOW() - INTERVAL '30 minutes'
    RETURNING person_id`) as any[];
  e.unklar += haengt.length;
  const alt = (await sqlPool`
    UPDATE fiaon_nicht_erreicht_nachfass
       SET status = 'verfallen', grund = COALESCE(grund || ' · ', '') || 'zu lange gewartet', erledigt_am = NOW()
     WHERE status = 'vorgemerkt' AND vorgemerkt_am < NOW() - (${VERFALL_STUNDEN}::int * INTERVAL '1 hour')
    RETURNING person_id`) as any[];
  e.verfallen += alt.length;
  if (!imVersandfenster(jetzt)) return e;
  const n = Math.max(1, Math.min(100, Math.floor(opts.hoechstens ?? 30)));
  const faellig = (await sqlPool`
    UPDATE fiaon_nicht_erreicht_nachfass SET status = 'in_arbeit', bearbeitet_am = NOW()
     WHERE person_id IN (
       SELECT person_id FROM fiaon_nicht_erreicht_nachfass
        WHERE status = 'vorgemerkt' AND (nicht_vor IS NULL OR nicht_vor <= ${jetzt})
        ORDER BY vorgemerkt_am
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED)
    RETURNING person_id`) as any[];
  for (const z of faellig) {
    const pid = Number(z.person_id);
    try {
      await nachfassEinen(pid, jetzt, e);
    } catch (err) {
      console.error(`[MARA-NACHFASS] Person ${pid}:`, err instanceof Error ? err.message : err);
      await merkerSetzen(pid, "fehlgeschlagen", `Fehler: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
      e.fehlgeschlagen++;
    }
  }
  if (istBearbeitet(e)) {
    console.log(`[MARA-NACHFASS] Takt: ${e.versandt} versandt, ${e.wartet} wartet, ${e.ausgelassen} ausgelassen, ${e.erledigt} erledigt, ${e.fehlgeschlagen} fehlgeschlagen, ${e.verfallen} verfallen.`);
  }
  return e;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STAND FÜRS CHEFBÜRO (/chef/s/mara?reiter=termine, Karte „Nach 2× nicht erreicht“)
// ═══════════════════════════════════════════════════════════════════════════
export interface NachfassStand {
  an: boolean;
  eingerichtet: boolean;
  heute: number;
  woche: { versandt: number; fehlgeschlagen: number; ausgelassen: number; erledigt: number };
  wartet: number;
  /** Termine, die Kunden über den Link dieser Mail gebucht haben (Herkunft nicht_erreicht_2_mail). */
  gebucht7: number;
  gebucht30: number;
  /** Die häufigsten Gründe fürs Auslassen (7 Tage). */
  gruende: { grund: string; n: number }[];
}

export async function nachfassStand(): Promise<NachfassStand> {
  const an = await schalterLesen();
  const eingerichtet = await nachfassTabelle();
  const leer: NachfassStand = { an, eingerichtet, heute: 0, woche: { versandt: 0, fehlgeschlagen: 0, ausgelassen: 0, erledigt: 0 }, wartet: 0, gebucht7: 0, gebucht30: 0, gruende: [] };
  if (!eingerichtet) return leer;
  const [z] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE status = 'versandt' AND erledigt_am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute,
      COUNT(*) FILTER (WHERE status = 'versandt' AND erledigt_am > NOW() - INTERVAL '7 days')::int AS versandt,
      COUNT(*) FILTER (WHERE status IN ('fehlgeschlagen', 'ohne_mail', 'unklar') AND erledigt_am > NOW() - INTERVAL '7 days')::int AS fehlgeschlagen,
      COUNT(*) FILTER (WHERE status = 'ausgelassen' AND erledigt_am > NOW() - INTERVAL '7 days')::int AS ausgelassen,
      COUNT(*) FILTER (WHERE status IN ('erledigt', 'verfallen') AND erledigt_am > NOW() - INTERVAL '7 days')::int AS erledigt,
      COUNT(*) FILTER (WHERE status IN ('vorgemerkt', 'in_arbeit'))::int AS wartet
    FROM fiaon_nicht_erreicht_nachfass`) as any[];
  const [b] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS g7,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS g30
      FROM fiaon_termine WHERE herkunft = ${NACHFASS_HERKUNFT}`.catch(() => [{ g7: 0, g30: 0 }])) as any[];
  const gruende = (await sqlPool`
    SELECT grund, COUNT(*)::int AS n FROM fiaon_nicht_erreicht_nachfass
     WHERE status = 'ausgelassen' AND erledigt_am > NOW() - INTERVAL '7 days' AND grund IS NOT NULL
     GROUP BY grund ORDER BY n DESC LIMIT 4`) as any[];
  return {
    an, eingerichtet,
    heute: Number(z?.heute || 0),
    woche: { versandt: Number(z?.versandt || 0), fehlgeschlagen: Number(z?.fehlgeschlagen || 0), ausgelassen: Number(z?.ausgelassen || 0), erledigt: Number(z?.erledigt || 0) },
    wartet: Number(z?.wartet || 0),
    gebucht7: Number(b?.g7 || 0),
    gebucht30: Number(b?.g30 || 0),
    gruende: gruende.map((r: any) => ({ grund: String(r.grund), n: Number(r.n) })),
  };
}
