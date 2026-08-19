// ═══════════════════════════════════════════════════════════════════════════
// NICHT-ERREICHT-AUTOMATIK — Schluss mit dem fünften Anruf
//
// DER BEFUND AUS DEM BESTAND (08.08.2026)
// 258 Personen mit mindestens einem erfolglosen Versuch, davon 36 mit VIER
// oder mehr — einer mit acht. Acht Anrufe an dieselbe Nummer, ohne dass je
// jemand abgehoben hat. Das ist kein Fleiß, das ist eine Endlosschleife: Der
// Zähler `unreachable_count` wurde hochgezählt und danach nie wieder gelesen.
// Er wurde nicht einmal zurückgesetzt, wenn der Kunde später ans Telefon ging.
//
// DIE ZWEI SCHWELLEN
//   Nach dem 2. Versuch   Terminlink-Mail. Der Kunde sucht sich selbst eine
//                         Uhrzeit — meistens ist er nicht desinteressiert,
//                         sondern bei der Arbeit. GENAU EINMAL je 30 Tage.
//   Nach dem 4. Versuch   Ruhe-Pool: Wiedervorlage +14 Tage, raus aus der
//                         Tagesliste. NICHT gesperrt, nicht gelöscht, Stufe
//                         bleibt. Der Kunde kommt wieder — mit Vorgeschichte
//                         auf der Karte.
//
// WARUM STUFE A AUSGENOMMEN IST
// Ein Kunde, der „ich habe bezahlt" gemeldet hat, hat Geld im Spiel. Der darf
// nicht in einen Ruhe-Pool rutschen, nur weil er zufällig viermal nicht
// abgehoben hat — da muss ein Beleg her. Er bekommt die Terminlink-Mail
// (die hilft ihm auch), aber er bleibt in der Tagesliste.
//
// WAS DEN ZÄHLER ZURÜCKSETZT
// Jedes `erreicht_*`, jede Terminbuchung. Sonst schleppt ein Kunde, der vor
// drei Monaten zweimal nicht dranging, diese Vorgeschichte für immer mit sich
// herum und landet beim nächsten Fehlversuch sofort im Ruhe-Pool.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { terminLink } from "./fiaon-termine";
import { versendenUndProtokollieren, type VersandStatus } from "./fiaon-mail-log";

type Lauf = typeof sqlPool;

// ═══════════════════════════════════════════════════════════════════════════
// DIE STAFFEL — NEU GEFASST AM 19.08.2026
//
// ── DIE MELDUNG (Daniel Stripling) ─────────────────────────────────────────
// „Kunden, die bereits mehrfach erfolglos angerufen wurden, teilweise 10–12 Mal
// oder mehr, erscheinen trotzdem weiterhin weit oben. Dadurch werden immer
// wieder dieselben nicht erreichbaren Kunden bearbeitet, während andere Kunden
// noch gar nicht kontaktiert wurden."
//
// ── DER BEFUND (scripts/mess-ruhe-staffel.ts, 19.08.2026) ──────────────────
// 26 Personen mit NEUN oder mehr erfolglosen Versuchen standen an diesem Tag in
// der Arbeitsliste, Spitze 20 Versuche. Verteilung der Ruhe-Marke:
//
//     Versuche   Personen   davon mit ruhe_seit
//        4          133            125
//        5           15              9
//        9           14              0
//       10           15              1
//       12            4              1
//       20            1              1  (Wiedervorlage lief HEUTE ab)
//
// Bei vier Versuchen greift die Automatik fast immer. Ab neun praktisch nie.
// Zwei Ursachen, beide in dieser Datei:
//
//   1. DIE RUHE WAR EIN EINMALIGER SCHLUMMER. Die Bedingung lautete
//      `versuche >= SCHWELLE_RUHE && !p.ruhe_seit` — sie feuert also GENAU
//      EINMAL. Nach 14 Tagen läuft die Wiedervorlage ab, der Fall kommt zurück,
//      und weil `ruhe_seit` nun gesetzt IST, ruht er nie wieder. Jeder weitere
//      Fehlversuch zählt hoch und ändert nichts.
//   2. STUFE A WAR DAUERHAFT AUSGENOMMEN (`!istStufeA`). GEMESSEN: 77 der 221
//      Personen mit vier und mehr Versuchen sind Stufe A — und genau 77 hatten
//      keine Ruhe-Marke. Die Ausnahme war als Schutz gedacht („da hängt eine
//      gemeldete Zahlung dran"), wurde aber zum Dauerzustand.
//
// ── DIE NEUE STAFFEL (mit dem Betreiber abgestimmt) ───────────────────────
//   ab dem 3. Versuch   Wiedervorlage +3 Tage
//   ab dem 6. Versuch   Wiedervorlage +7 Tage UND Terminlink-Mail
//   ab dem 9. Versuch   „Ruhend" — raus aus der Tagesliste, sichtbar unter
//                       dem Filter „Ruhend", ohne Ablaufdatum
//
// Sie greift bei JEDEM Fehlversuch neu, nicht einmalig. Und sie kennt keine
// Ausnahme mehr: Wer neunmal nicht ans Telefon geht, wird vom zehnten Anruf
// nicht erreicht — der gehört auf den Terminlink, nicht in die Tagesliste.
//
// ── WAS SIE NICHT TUT ─────────────────────────────────────────────────────
// Sperren, löschen, die Stufe ändern. „Ruhend" ist eine Sichtbarkeitsfrage.
// Bucht der Kunde einen Termin oder wird er erreicht, ist er sofort zurück
// (`erreichtZuruecksetzen`) — das ist der Ausweg, der die Regel vertretbar
// macht.
// ═══════════════════════════════════════════════════════════════════════════

/** Nach so vielen erfolglosen Versuchen geht der Terminlink raus. */
export const SCHWELLE_MAIL = 6;
/** Ab hier wird die Wiedervorlage gestreckt. */
export const SCHWELLE_STRECKEN = 3;
/** Ab hier ruht der Fall dauerhaft — raus aus der Tagesliste. */
export const SCHWELLE_RUHEND = 9;

// ═══════════════════════════════════════════════════════════════════════════
// STUFE A RUHT NIE — SIE WIRD ENTSCHIEDEN (19.08.2026, Betreiber)
//
// ── DIE ENTSCHEIDUNG ───────────────────────────────────────────────────────
// „Kunden mit GEMELDETER Zahlung (claimed_paid) ruhen NIE automatisch. Bei denen
// geht es um Geld auf dem Weg zu uns; nach dem 9. Fehlversuch statt Ruhe:
// Aufgabe an die Vertriebsleitung ‚Zahlung gemeldet, 9x nicht erreicht —
// entscheiden' + Wiedervorlage +2 Tage."
//
// ── WARUM DAS DER RICHTIGE SCHNITT IST ────────────────────────────────────
// Ein Kunde, der sagt „ich habe überwiesen", hat entweder bezahlt (dann fehlt
// uns die Zuordnung) oder nicht (dann fehlt uns die Forderung). Beides sind
// Fragen, die JEMAND entscheiden muss — sie verschwinden nicht dadurch, dass
// man sie aus einer Liste nimmt. Alle anderen Stufen ruhen: Dort ist der zehnte
// Anruf wirklich nur ein zehnter Anruf.
//
// Der Unterschied zur ALTEN Ausnahme (`!istStufeA`, bis 19.08.2026) ist
// entscheidend: Damals blieb Stufe A einfach in der Tagesliste liegen — 77
// Personen, teils mit 20 Fehlversuchen, ohne dass irgendetwas geschah. „Nicht
// ruhen" hieß „ewig weiterklingeln". Jetzt heißt es: Es landet auf einem
// Schreibtisch, mit Frist.
// ═══════════════════════════════════════════════════════════════════════════

/** Ab so vielen Fehlversuchen entscheidet die Vertriebsleitung über Stufe A. */
export const SCHWELLE_LEITUNG = 9;
/** Wiedervorlage für Stufe A nach der Meldung an die Leitung. */
export const LEITUNG_WIEDERVORLAGE_TAGE = 2;

/**
 * Stufe A als SQL: gemeldete, noch nicht bankbestätigte Zahlung.
 *
 * `priority_tier = 1` entsteht in `server/lib/tier.ts` ausschließlich aus
 * `payment_status = 'claimed_paid'` (Rang 50) — der Zustand, den der Betreiber
 * gemeint hat. Die Zahl steht hier EINMAL, damit Ruhe-Bedingung, Automatik und
 * Bestandslauf nicht auseinanderlaufen.
 */
export function stufeASql(p = "p"): string {
  return `(COALESCE(${p}.priority_tier, 3) = 1)`;
}
/** Wiedervorlage ab dem 3. Versuch. */
export const STRECKUNG_TAGE = 3;
/** Wiedervorlage ab dem 6. Versuch. */
export const STRECKUNG_TAGE_LANG = 7;
/** Frühestens so viele Tage nach der letzten Terminlink-Mail wieder eine. */
export const MAIL_SPERRE_TAGE = 30;

// ── DIE ALTEN NAMEN BLEIBEN, MIT DEM ALTEN WORTLAUT IM KOMMENTAR ──────────
// AGENTS.md: „Die Regel wird ERSETZT, nicht gelöscht — sonst hält der nächste
// Leser das Fehlen für ein Versehen." Vorher: `SCHWELLE_MAIL = 2`,
// `SCHWELLE_RUHE = 4`, `RUHE_TAGE = 14` („Ruhe-Pool: Wiedervorlage +14 Tage").
/** @deprecated Ersetzt durch `SCHWELLE_RUHEND` (9) — siehe Staffel oben. */
export const SCHWELLE_RUHE = SCHWELLE_RUHEND;
/** @deprecated Die Ruhe hat kein Ablaufdatum mehr; der Kunde beendet sie. */
export const RUHE_TAGE = 14;

export interface AutomatikWirkung {
  /** Wurde eine Terminlink-Mail versendet (oder versucht)? */
  mail: VersandStatus | null;
  /** Ist die Person jetzt im Ruhe-Pool? */
  ruht: boolean;
  /** Neue Wiedervorlage, falls die Automatik sie verschoben hat. */
  wiedervorlage: string | null;
  /** Klartext für die Rückmeldung an den Agenten. Leer, wenn nichts geschah. */
  hinweis: string | null;
}

const LEER: AutomatikWirkung = { mail: null, ruht: false, wiedervorlage: null, hinweis: null };

function tagPlus(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Wird nach jedem erfolglosen Kontaktversuch aufgerufen — NACHDEM der Zähler
 * erhöht wurde. Liest den Stand und wendet die beiden Schwellen an.
 *
 * Wirft nie: Eine Automatik, die das Dokumentieren eines Anrufs scheitern
 * lässt, kostet mehr als sie bringt.
 */
export async function automatikNachFehlversuch(
  personId: number, lauf: Lauf = sqlPool,
): Promise<AutomatikWirkung> {
  try {
    const [p] = (await lauf`
      SELECT p.id, p.unreachable_count, p.priority_tier, p.is_blocked, p.ruhe_seit,
             p.terminlink_mail_am, p.assigned_agent_id,
             COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.last_name AS nachname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1
             )) AS email,
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return LEER;

    const versuche = Number(p.unreachable_count || 0);
    const wirkung: AutomatikWirkung = { ...LEER };

    // ── Schwelle 1: der Terminlink ──────────────────────────────────────────
    // „Genau einmal je 30 Tage" gilt ab dem 2. Versuch — auch beim 3., 5. und
    // 8. wird nicht erneut gesendet, solange die Sperre läuft. Ein Kunde, der
    // bei jedem Fehlversuch eine Mail bekommt, meldet uns als Spam.
    const sperreLaeuft = p.terminlink_mail_am
      && Date.now() - new Date(p.terminlink_mail_am).getTime() < MAIL_SPERRE_TAGE * 86_400_000;
    if (versuche >= SCHWELLE_MAIL && !sperreLaeuft && !p.is_blocked) {
      const agentVorname = String(p.agent_vorname || "Ihr Ansprechpartner");
      const ergebnis = await versendenUndProtokollieren(
        "nicht_erreicht_termin",
        {
          email: String(p.email || ""),
          vorname: p.vorname || null,
          nachname: p.nachname || null,
          agent_vorname: agentVorname,
          termin_link: terminLink(personId),
        },
        {
          personId,
          verlaufRef: p.ref || null,
          verlaufText: `Terminlink-Mail versandt (${versuche}× nicht erreicht). Der Kunde kann selbst eine Uhrzeit wählen.`,
          lauf,
        },
      );
      wirkung.mail = ergebnis.status;
      // Der Zeitstempel wird auch bei Fehlschlag gesetzt — sonst versucht es
      // jeder weitere Fehlversuch erneut und das Protokoll füllt sich mit
      // derselben Fehlermeldung. Der Fehlschlag steht sichtbar in der Akte.
      if (ergebnis.status !== "uebersprungen") {
        await lauf`UPDATE fiaon_persons SET terminlink_mail_am = NOW() WHERE id = ${personId}`;
      }
      wirkung.hinweis = ergebnis.status === "versandt"
        ? `Terminlink an den Kunden versandt — er wählt jetzt selbst eine Uhrzeit.`
        : ergebnis.status === "uebersprungen"
          ? `Keine E-Mail hinterlegt — schick ihm den Terminlink über den Knopf auf der Karte.`
          : `Terminlink konnte NICHT versendet werden (${ergebnis.grund}). Bitte den Link von Hand schicken.`;
    }

    const istStufeA = Number(p.priority_tier) === 1;

    // ── Schwelle 2a: STUFE A GEHT AN DIE VERTRIEBSLEITUNG ──────────────────
    // Gemeldete Zahlung: Hier ruht nichts. Es wird entschieden.
    if (versuche >= SCHWELLE_LEITUNG && istStufeA) {
      const erg = await stufeAAnLeitung(personId, lauf);
      wirkung.ruht = false;
      wirkung.wiedervorlage = erg.wiedervorlage;
      wirkung.hinweis = [wirkung.hinweis, erg.hinweis].filter(Boolean).join(" ");
      return wirkung;
    }

    // ── Schwelle 2b: RUHEND (ab dem 9. Versuch, ohne Ablaufdatum) ───────────
    // Kein `!p.ruhe_seit` mehr: Die alte Bedingung feuerte genau einmal und
    // ließ danach jeden weiteren Fehlversuch wirkungslos.
    if (versuche >= SCHWELLE_RUHEND) {
      await lauf`
        UPDATE fiaon_persons
           SET ruhe_seit = COALESCE(ruhe_seit, NOW()),
               -- Ohne Wiedervorlage: Der Kunde beendet die Ruhe, nicht der
               -- Kalender. Ein Datum hier wäre wieder ein Schlummer, der
               -- abläuft und den Fall zurückschiebt.
               follow_up_date = NULL,
               updated_at = NOW()
         WHERE id = ${personId}
      `;
      wirkung.ruht = true;
      wirkung.wiedervorlage = null;
      wirkung.hinweis = [wirkung.hinweis,
        `${versuche}× nicht erreicht — der Fall ist jetzt RUHEND und verschwindet `
        + "aus der Tagesliste. Er steht im Filter „Ruhend“ und kommt sofort zurück, "
        + "wenn der Kunde einen Termin bucht oder sich meldet."]
        .filter(Boolean).join(" ");
      if (p.ref) {
        await lauf`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
          VALUES (${p.ref}, NULL, 'System', 'system',
                  ${`Ruhend: ${versuche}× nicht erreicht. Aus der Tagesliste genommen — `
                    + `kein weiterer Anrufversuch, bis der Kunde sich meldet oder einen Termin bucht.`},
                  NOW())
        `.catch((e) => console.error("[NICHT-ERREICHT] Verlaufseintrag Ruhend:", e));
      }
    } else if (versuche >= SCHWELLE_STRECKEN && !istStufeA) {
      // ── Die Wiedervorlage strecken (3.–8. Versuch, nicht Stufe A) ─────────
      //
      // Stufe A wird auch NICHT gestreckt. „Ruhen nie automatisch" heißt nicht
      // nur „verschwinden nicht", sondern auch „werden nicht nach hinten
      // geschoben": Bei einer gemeldeten Zahlung ist die offene Frage das Geld,
      // nicht der Kontakt — und die Frage wird nicht dadurch kleiner, dass man
      // sie um sieben Tage verlegt. Sie bleiben fällig, bis der 9. Versuch die
      // Leitung einschaltet.
      //
      // Damit sagen Automatik und Bestandslauf dasselbe. Eine Regel, die im
      // Lauf anders wirkt als im Betrieb, ist zwei Regeln.
      // Nicht sperren, nur Abstand: Wer dreimal nicht dranging, ist nicht
      // unerreichbar — aber morgen wieder anzurufen bringt nichts. Die
      // Streckung wird NUR nach hinten verschoben, nie nach vorn, sonst zieht
      // ein Lauf bestehende Zusagen zurück.
      const tage = versuche >= SCHWELLE_MAIL ? STRECKUNG_TAGE_LANG : STRECKUNG_TAGE;
      const bis = tagPlus(tage);
      await lauf`
        UPDATE fiaon_persons
           SET follow_up_date = ${bis}::date, updated_at = NOW()
         WHERE id = ${personId}
           AND (follow_up_date IS NULL OR follow_up_date < ${bis}::date)
      `;
      wirkung.wiedervorlage = bis;
      wirkung.hinweis = [wirkung.hinweis,
        `${versuche}× nicht erreicht — Wiedervorlage auf ${bis} (+${tage} Tage).`]
        .filter(Boolean).join(" ");
    }

    return wirkung;
  } catch (err) {
    console.error("[NICHT-ERREICHT] Automatik:", err instanceof Error ? err.message : err);
    return LEER;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STUFE A AN DIE LEITUNG — ALS EIGENE FUNKTION, UND ZWAR AUS EINEM GRUND
//
// Der Bestandslauf muss dieselbe Wirkung erzeugen wie die Automatik: Marke weg,
// Wiedervorlage +2 Tage, Aufgabe an die Leitung. Der naheliegende Weg wäre,
// `automatikNachFehlversuch` je Person aufzurufen.
//
// DAS WÄRE EIN FEHLER GEWESEN. Die Automatik verschickt ab dem 6. Fehlversuch
// eine Terminlink-Mail. Ein Bestandslauf über 38 Personen hätte also bis zu 38
// ECHTE Mails an Kunden ausgelöst — als Nebenwirkung einer Aufräumarbeit, die
// niemand bestellt hat. AGENTS.md warnt genau davor („Ein Screenshot-Lauf darf
// keine 50 echten Mails auslösen"), und beim Schreiben der Vorschau ist es
// beinahe passiert.
//
// Also: die Stufe-A-Wirkung in EINER Funktion, die kein Wort nach außen sendet.
// Automatik und Bestandslauf rufen dieselbe — keine zweite Fassung der Regel.
// ═══════════════════════════════════════════════════════════════════════════
export async function stufeAAnLeitung(
  personId: number, lauf: Lauf = sqlPool,
): Promise<{ wiedervorlage: string; hinweis: string; aufgabe: boolean }> {
  const bis = tagPlus(LEITUNG_WIEDERVORLAGE_TAGE);
  const [p] = (await lauf`
    SELECT p.unreachable_count,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p WHERE p.id = ${personId}
  `) as any[];
  const versuche = Number(p?.unreachable_count || 0);

  // Die Ruhe wird ausdrücklich WEGGENOMMEN, falls eine alte Marke steht: Sonst
  // hielte ein Rest aus der Zeit vor dieser Regel den Fall unsichtbar.
  await lauf`
    UPDATE fiaon_persons
       SET ruhe_seit = NULL, follow_up_date = ${bis}::date, updated_at = NOW()
     WHERE id = ${personId}
  `;
  const aufgabe = await leitungAufgabeAnlegen(personId, versuche, p?.ref ?? null, bis, lauf);
  return {
    wiedervorlage: bis,
    aufgabe,
    hinweis: `${versuche}× nicht erreicht bei GEMELDETER Zahlung — der Fall ruht NICHT. `
      + (aufgabe ? "Die Vertriebsleitung hat eine Aufgabe „entscheiden“ bekommen. " : "")
      + `Wiedervorlage in ${LEITUNG_WIEDERVORLAGE_TAGE} Tagen (${bis}).`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFGABE AN DIE VERTRIEBSLEITUNG
//
// Sie geht in `fiaon_vermerke` — dieselbe Tabelle, die `/agent/aufgaben` und die
// Verwaltung lesen. Kein zweites Aufgabensystem: „Zwei Notizsysteme im Portal
// wären ein Notizsystem zu viel" (der Kommentar in fiaon-vermerke.ts, und er hat
// recht).
//
// ── DREI ENTSCHEIDUNGEN, DIE ERKLÄRT GEHÖREN ──────────────────────────────
//
// 1. GENAU EINE OFFENE AUFGABE JE PERSON. Die Automatik läuft bei JEDEM
//    weiteren Fehlversuch — beim 10., 11., 12. Ohne diese Sperre hätte die
//    Leitung nach zwei Wochen zwanzig identische Zettel zu demselben Menschen,
//    und dann liest sie keinen mehr.
//
// 2. EIN ZUSTÄNDIGER, NICHT „DIE LEITUNG". Eine Aufgabe ohne Namen erledigt
//    niemand. Es bekommt die Vertriebsleitung mit den WENIGSTEN offenen
//    Aufgaben — messbar fair und ohne Absprache. Alle anderen Leitungen sehen
//    sie über `sicht_agenten` mit, können also übernehmen.
//
// 3. RÜCKFALL AUF DEN BETREIBER. Gibt es keine aktive Vertriebsleitung, geht die
//    Aufgabe an ihn (`fuer_betreiber`). AGENTS.md: „Fehlende
//    Personalentscheidungen dürfen das System nicht kaputt machen … ein
//    begründeter Rückfall, protokolliert, damit er nicht unbemerkt zum
//    Dauerzustand wird."
// ═══════════════════════════════════════════════════════════════════════════
async function leitungAufgabeAnlegen(
  personId: number, versuche: number, ref: string | null,
  faelligAm: string, lauf: Lauf = sqlPool,
): Promise<boolean> {
  try {
    // Die Tabelle wird von `fiaon-vermerke.ts` angelegt. Läuft dieser Aufruf
    // vor dem ersten Zugriff dort, gibt es sie noch nicht — dann wird die
    // Aufgabe übersprungen und das GEMELDET, statt den Anruf scheitern zu
    // lassen. Eine Automatik darf das Dokumentieren nie verhindern.
    const [tabelleDa] = (await lauf`
      SELECT to_regclass('public.fiaon_vermerke') IS NOT NULL AS da
    `) as any[];
    if (!tabelleDa?.da) {
      console.warn("[NICHT-ERREICHT] fiaon_vermerke fehlt — Leitungs-Aufgabe übersprungen.");
      return false;
    }

    // 1. Gibt es schon eine offene Aufgabe zu diesem Menschen?
    const [offen] = (await lauf`
      SELECT id FROM fiaon_vermerke
       WHERE art = 'aufgabe' AND status = 'offen' AND entfernt_am IS NULL
         AND text LIKE ${`%${LEITUNG_MARKE}%`}
         AND ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = ${personId})
       LIMIT 1
    `) as any[];
    if (offen) {
      // Die Zahl der Versuche wächst weiter — der Zettel soll den neuesten
      // Stand tragen, ohne ein zweiter Zettel zu werden.
      await lauf`
        UPDATE fiaon_vermerke
           SET text = ${leitungText(versuche)}, faellig_am = ${faelligAm}::date,
               updated_at = NOW()
         WHERE id = ${offen.id}
      `;
      return true;
    }

    // 2. Wer ist zuständig? Die Leitung mit den wenigsten offenen Aufgaben.
    const leitungen = (await lauf`
      SELECT ag.id,
             (SELECT COUNT(*)::int FROM fiaon_vermerke v
               WHERE v.zustaendig_agent_id = ag.id AND v.art = 'aufgabe'
                 AND v.status = 'offen' AND v.entfernt_am IS NULL) AS offene
        FROM fiaon_agents ag
       WHERE ag.active AND ag.rolle = 'vertriebsleiter'
         AND COALESCE(ag.is_test_account, FALSE) = FALSE
       ORDER BY offene ASC, ag.id ASC
    `) as any[];

    const zustaendig = leitungen[0]?.id ? Number(leitungen[0].id) : null;
    const alle = leitungen.map((l: any) => Number(l.id));
    if (!zustaendig) {
      console.warn("[NICHT-ERREICHT] Keine aktive Vertriebsleitung — die Aufgabe "
        + `für Person ${personId} geht an den Betreiber.`);
    }

    await lauf`
      INSERT INTO fiaon_vermerke
        (art, ref, text, sicht, sicht_agenten, zustaendig_agent_id, fuer_betreiber,
         faellig_am, dringend, autor_art, autor_name)
      VALUES ('aufgabe', ${ref}, ${leitungText(versuche)},
              ${alle.length > 0 ? "auswahl" : "privat"}, ${alle},
              ${zustaendig}, ${zustaendig == null},
              ${faelligAm}::date, TRUE, 'system', 'Automatik: nicht erreicht')
    `;
    return true;
  } catch (err) {
    // Eine Automatik, die das Dokumentieren eines Anrufs scheitern lässt, kostet
    // mehr als sie bringt — aber der Fehler wird MITGESCHRIEBEN (AGENTS.md).
    console.error("[NICHT-ERREICHT] Leitungs-Aufgabe konnte nicht angelegt werden:",
      err instanceof Error ? err.message : err);
    return false;
  }
}

/** Die Marke, an der die Automatik ihre eigene Aufgabe wiedererkennt. */
const LEITUNG_MARKE = "Zahlung gemeldet, ";

function leitungText(versuche: number): string {
  return `${LEITUNG_MARKE}${versuche}× nicht erreicht — entscheiden. `
    + "Der Kunde hat eine Überweisung gemeldet, wir erreichen ihn nicht. "
    + "Bitte Kontoabgleich prüfen: Ist das Geld da, gehört es zugeordnet; "
    + "ist es nicht da, gehört die Forderung entschieden. Dieser Fall ruht NICHT "
    + "und bleibt in der Arbeitsliste.";
}

/**
 * Der Kunde hat sich gemeldet — Zähler und Ruhe zurücksetzen.
 *
 * Wird bei jedem `erreicht_*` aufgerufen. Ohne das schleppt jemand, der vor
 * Monaten zweimal nicht dranging, diese Vorgeschichte ewig mit sich.
 */
export async function erreichtZuruecksetzen(personId: number, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    UPDATE fiaon_persons SET unreachable_count = 0, ruhe_seit = NULL, updated_at = NOW()
    WHERE id = ${personId} AND (unreachable_count > 0 OR ruhe_seit IS NOT NULL)
  `.catch(() => {});
}

/**
 * SQL-Bedingung „liegt im Ruhe-Pool".
 *
 * Ein Fall ruht, solange `ruhe_seit` gesetzt ist UND die Wiedervorlage in der
 * Zukunft liegt. Beim Erreichen der Wiedervorlage taucht er von selbst wieder
 * auf — ohne Aufräumlauf, der vergessen werden kann.
 */
export function ruhtSql(p = "p"): string {
  // ── ZWEI ARTEN VON RUHE, EINE BEDINGUNG ─────────────────────────────────
  //
  // 1. DAUERHAFT RUHEND (ab dem 9. Fehlversuch). Hier steht ABSICHTLICH die
  //    Zahl der Versuche und nicht nur die Marke `ruhe_seit`: Der Beweis, den
  //    der Auftrag verlangt, lautet „die Tagesliste enthält keinen Kunden mit
  //    neun oder mehr Versuchen". Hinge die Bedingung an der Marke, würde eine
  //    einzige nicht geschriebene Zeile den Kunden zurück in die Liste holen —
  //    und genau das ist vorher passiert.
  //
  //    `unreachable_count` wird von `erreichtZuruecksetzen` auf 0 gesetzt,
  //    sobald der Kunde erreicht wird oder einen Termin bucht. Der Ausweg
  //    hängt also am Zähler, nicht an einem Aufräumlauf.
  //
  // 2. ZEITLICH RUHEND. Die bestehende Bedingung, WÖRTLICH unverändert: Marke
  //    gesetzt und Wiedervorlage in der Zukunft.
  //
  //    Ein erster Entwurf hat sie mitgeändert (`follow_up_date IS NULL` sollte
  //    auch als Ruhe gelten). Das hätte 8 Personen aus der Liste genommen, die
  //    heute drinstehen — eine Nebenwirkung, die niemand bestellt hat. Fassung 1
  //    deckt den einen gemessenen Fall (10 Versuche, Marke gesetzt, keine
  //    Wiedervorlage) über den Zähler ohnehin ab.
  //
  // ── UND STUFE A RUHT ÜBERHAUPT NICHT (19.08.2026, Betreiber) ────────────
  // Gemeldete Zahlung heißt: Geld ist auf dem Weg zu uns oder eine Forderung
  // ist offen. Solche Fälle verschwinden nicht aus der Liste, sie gehen an die
  // Vertriebsleitung (siehe `SCHWELLE_LEITUNG`).
  //
  // Die Ausnahme steht bei BEIDEN Fassungen, nicht nur bei der ersten: Eine
  // alte Ruhe-Marke aus der Zeit vor dieser Regel würde sonst weiter verdecken.
  // Die Richtung ist Absicht — bei Geld lieber sichtbar als versteckt.
  //
  // Das ist NICHT die alte Ausnahme zurück: Damals blieb Stufe A liegen und
  // nichts geschah. Jetzt bleibt sie sichtbar UND bekommt eine Aufgabe.
  return `(NOT ${stufeASql(p)} AND (
      (${p}.unreachable_count >= ${SCHWELLE_RUHEND})
      OR (${p}.ruhe_seit IS NOT NULL AND ${p}.follow_up_date IS NOT NULL
          AND ${p}.follow_up_date > CURRENT_DATE)))`;
}
