// ═══════════════════════════════════════════════════════════════════════════
// DIE ERSTE RECHNUNG STELLEN
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// Der Vorgesetzte: „ALLE die einen Antrag bei uns gestellt haben brauchen eine
// Rechnung und müssen täglich versendet werden und den Agenten eben passend
// angezeigt werden und mit Knopfdruck versendbar sein für den Agenten!"
//
// ── WAS EIN „GESTELLTER ANTRAG" IST — UND WAS NICHT ────────────────────────
// Gemessen am 11.08.2026 über alle Bestellungen mit `payment_status = pending`:
//
//     Zustand              Anzahl   davon mit E-Mail
//     personal_data          3626          6
//     contract                447          3
//     approved                355         32
//     pending_payment         331        331
//     finances                302          0
//     completed               143        118
//
// Die ersten drei sind angefangene Formulare: Jemand hat den Namen eingetippt
// und aufgehört. Ohne E-Mail lässt sich nichts verschicken — und ein Antrag
// ohne Kontaktweg ist kein gestellter Antrag, sondern eine Spur im Trichter.
//
// `pending_payment` hat bereits eine Rechnung; das sagt der Zustand selbst.
//
// Rechnungsreif sind also die abgeschlossenen Anträge MIT Kontaktweg. Das
// sind rund 166 statt 1140 — aber es sind die richtigen. Eine Rechnung an
// jemanden zu schicken, von dem man nur einen Vornamen hat, ist keine Arbeit,
// sondern eine Zustellfehlermeldung.
//
// ── WAS EINE RECHNUNG BRAUCHT ──────────────────────────────────────────────
//   1. einen Betrag        → aus dem Paket, nicht aus `amount_due`
//                             (gemessen: nur 2 von 1140 hatten einen)
//   2. einen Verwendungszweck → haben alle 1140 bereits
//   3. eine Zahlungsfrist   → sieben Tage, ab heute
//   4. einen Empfänger      → E-Mail an Bestellung oder Person
//
// Fehlt eines davon, wird NICHTS verschickt und der Grund benannt. Eine
// Rechnung ohne Betrag ist eine Bitte um Überweisung von irgendetwas.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { katalogpreisCents } from "./fiaon-massgebliche-bestellung";

type Lauf = typeof sqlPool;

/** Wie viele Tage hat der Kunde Zeit? */
export const ZAHLUNGSFRIST_TAGE = 7;

/**
 * Zustände, in denen ein Antrag als GESTELLT gilt.
 *
 * Nicht dabei: `started`, `config`, `personal_data`, `contract`, `finances` —
 * das sind Schritte im Formular, keine Abschlüsse. Wer dort stehen bleibt,
 * braucht einen Anruf, keine Rechnung.
 */
export const RECHNUNGSREIF = [
  "completed", "approved", "submitted", "documents_submitted",
  "verifying", "processing",
  // ══════════════════════════════════════════════════════════════════════════
  // `pending_payment` FEHLTE — UND DAS WAR KEINE ENTSCHEIDUNG (19.08.2026)
  //
  // ── DIE MELDUNG (Florentine) ────────────────────────────────────────────
  // „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine Mail
  // schicken."
  //
  // ── DER BEFUND ──────────────────────────────────────────────────────────
  // Der Status heißt wörtlich „Zahlung ausstehend". Er stand in KEINER der
  // beiden Listen: nicht in dieser, und nicht in der Aufzählung der
  // Formularschritte darüber, die ausdrücklich ausgeschlossen sind. Eine Lücke,
  // keine Absicht — `submitted` und `approved` sind drin, und `pending_payment`
  // liegt hinter beiden.
  //
  // GEMESSEN: 63 von Florentines Kunden hängen genau daran. Die Bestellungen
  // tragen ein Paket und einen Verwendungszweck, aber weder Betrag noch Frist —
  // also genau das, was `rechnungStellen` setzt. Die ältesten warten seit dem
  // 02. Juli.
  //
  // Der Agent sah in der Karte „offen" (die clientseitige Ableitung zählt jede
  // unbezahlte Bestellung), drückte, und der Server antwortete „Der Antrag ist
  // noch nicht abgeschlossen (Stand: pending_payment)". Ein Satz, der einem
  // Menschen sagt, er solle anrufen — bei einem Kunden, der nur auf die
  // Rechnung wartet.
  // ══════════════════════════════════════════════════════════════════════════
  "pending_payment",
] as const;

export interface RechnungsKandidat {
  ref: string;
  personId: number | null;
  name: string;
  email: string | null;
  packKey: string | null;
  bezeichnung: string;
  betragCents: number;
  verwendungszweck: string | null;
  status: string;
  /** Wie lange liegt der Antrag schon? */
  tageAlt: number;
  /** Warum kann noch nicht verschickt werden? */
  hindernis: string | null;
  /** Wurde schon eine verschickt und wann? */
  letzteRechnung: string | null;
}

/**
 * Die Kandidaten-Abfrage als Template, nicht als `unsafe`.
 *
 * ── WARUM NICHT `unsafe` MIT $1 ───────────────────────────────────────────
 * Der erste Entwurf reichte die Zustandsliste als Array über `lauf.unsafe(sql,
 * [RECHNUNGSREIF])`. Außerhalb einer Transaktion ging das; INNERHALB einer
 * warf PostgreSQL „could not choose a best candidate operator" — der Treiber
 * schickt das Array ohne Typ, und `status = ANY($1)` bleibt mehrdeutig.
 *
 * Der Prüfstand meldete daraufhin „keine Kandidaten", obwohl es 264 gab. Eine
 * Prüfung, die nichts findet, wo etwas ist, sieht wie Erfolg aus — das ist die
 * gefährlichste Sorte Fehler.
 *
 * Mit dem Template-Literal setzt postgres.js den Typ selbst.
 */
async function kandidatenLaden(
  lauf: Lauf, agentId: number | null, ref: string | null, grenze: number,
): Promise<any[]> {
  const status = RECHNUNGSREIF as unknown as string[];
  return (await lauf`
    SELECT a.ref, a.person_id, a.pack_key, a.pack_name, a.amount_due,
           -- Die Spalte type entscheidet über die Kategorie und damit über den
           -- Preis: Eine Auskunft kostet 74,00 €, auch wenn im pack_key
           -- „highend“ steht (der Dubletten-Merge trägt ihn dort ein).
           a.type,
           a.payment_reference, a.status, a.created_at,
           a.first_name, a.last_name,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.contact_name, 'Ohne Namen') AS name,
           COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''),
                    NULLIF(TRIM(a.billing_email), ''),
                    NULLIF(TRIM(p.primary_email), '')) AS email,
           p.assigned_agent_id,
           -- ══════════════════════════════════════════════════════════════════
           -- „ok“ GAB ES NIE (behoben 19.08.2026)
           --
           -- Hier stand „status = ok“. GEMESSEN über die ganze Tabelle:
           -- 14.621 „versandt“, 215 „uebersprungen“, 141 „fehlgeschlagen“ —
           -- und NULL Zeilen mit „ok“. Die Spalte trägt die vier Werte aus
           -- Migration 041, und „ok“ ist keiner davon.
           --
           -- Folge: „letzteRechnung“ war IMMER leer. Der Agent sah nie, dass
           -- einem Kunden schon eine Rechnung geschickt wurde — eine Abfrage,
           -- die nichts findet, wo etwas ist, sieht aus wie „noch nichts
           -- passiert“ (AGENTS.md nennt das die gefährlichste Sorte Fehler).
           -- ══════════════════════════════════════════════════════════════════
           (SELECT MAX(l.created_at) FROM fiaon_mail_log l
             WHERE l.person_id = a.person_id
               AND l.event IN ('payment_details', 'agent_payment_reminder')
               AND l.status = 'versandt') AS letzte_rechnung
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL
      AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL
      AND a.payment_status = 'pending'
      AND a.status = ANY(${status}::text[])
      AND (p.id IS NULL OR (p.merged_into_person_id IS NULL AND NOT p.is_blocked))
      AND (${agentId}::int IS NULL OR p.assigned_agent_id = ${agentId}::int)
      AND (${ref}::text IS NULL OR a.ref = ${ref}::text)
    ORDER BY a.created_at
    LIMIT ${Math.min(2000, grenze)}
  `) as any[];
}

function bauen(r: any): RechnungsKandidat {
  // ══════════════════════════════════════════════════════════════════════════
  // DER PREIS KOMMT AUS DER KATEGORIE, DANN AUS DEM PAKET (19.08.2026)
  //
  // Hier stand `PAKET_PREIS_CENTS[r.pack_key]`. Das ist für Stufenpakete
  // richtig und für die Bonitätsauskunft falsch:
  //
  // GEMESSEN: Sechs Auskunfts-Bestellungen tragen im `pack_key` das
  // STUFENPAKET ihres Kunden — der Dubletten-Merge hat es eingetragen
  // („Gefüllte Felder: pack_key, …"). Für zwei davon hat diese Zeile
  // 99,99 € statt 74,00 € berechnet und in `amount_due` geschrieben
  // (Zeile mit SET amount_due weiter unten). Beide sind unbezahlt, beide
  // Kunden wurden um 99,99 € für eine 74-€-Auskunft gebeten.
  //
  // `katalogpreisCents` entscheidet zuerst über `type`/Referenz-Präfix und
  // erst danach über `pack_key` — dieselbe Reihenfolge wie beim Anlegen in
  // `fiaon-agent-anlage.ts`.
  // ══════════════════════════════════════════════════════════════════════════
  const ausPaket = katalogpreisCents(r) ?? undefined;
  const ausBestellung = r.amount_due != null && Number(r.amount_due) > 0
    ? Math.round(Number(r.amount_due) * 100) : undefined;
  const betragCents = ausPaket ?? ausBestellung ?? 0;

  const email = r.email ? String(r.email).trim() : null;
  const zweck = r.payment_reference ? String(r.payment_reference).trim() : null;

  // ── DAS HINDERNIS IN WORTEN, NICHT ALS FEHLERCODE ─────────────────────────
  // Ein Agent, der liest „kann nicht verschickt werden", weiß nichts. Einer,
  // der liest „keine E-Mail hinterlegt", weiß, was er tun kann.
  const hindernis = !email
    ? "Keine E-Mail hinterlegt — am Telefon erfragen und in der Akte nachtragen."
    : betragCents === 0
      ? (r.pack_key
        ? `Für das Paket „${r.pack_key}" ist kein Preis hinterlegt.`
        : "Kein Paket gebucht — ohne Paket gibt es keinen Betrag.")
      : !zweck
        ? "Kein Verwendungszweck — ohne ihn lässt sich die Zahlung nicht zuordnen."
        : null;

  return {
    ref: String(r.ref),
    personId: r.person_id != null ? Number(r.person_id) : null,
    name: String(r.name),
    email,
    packKey: r.pack_key ?? null,
    bezeichnung: String(r.pack_name ?? "").split("\n")[0].trim() || "Ohne Paket",
    betragCents,
    verwendungszweck: zweck,
    status: String(r.status),
    tageAlt: Math.max(0, Math.floor(
      (Date.now() - new Date(r.created_at).getTime()) / 86_400_000)),
    hindernis,
    letzteRechnung: r.letzte_rechnung
      ? new Date(r.letzte_rechnung).toISOString().slice(0, 10) : null,
  };
}

/** Wer braucht eine erste Rechnung? Optional nur die eines Agenten. */
export async function rechnungsKandidaten(
  opts: { agentId?: number | null; nurVersendbar?: boolean; grenze?: number } = {},
  lauf: Lauf = sqlPool,
): Promise<RechnungsKandidat[]> {
  // ── DIE GRENZE GILT FÜR DAS ERGEBNIS, NICHT FÜR DIE ABFRAGE ─────────────
  // Erster Entwurf: `LIMIT grenze` in SQL, danach `filter(!hindernis)`. Bei
  // `rechnungsKandidaten({ nurVersendbar: true, grenze: 5 })` kamen NULL
  // Treffer — die fünf ältesten Anträge haben alle ein Hindernis (keine
  // E-Mail), und nach dem Filtern war die Liste leer.
  //
  // Der Prüfstand meldete daraufhin „keine Kandidaten", obwohl 264 warteten.
  // Eine Prüfung, die nichts findet, wo etwas ist, sieht aus wie Erfolg.
  //
  // Beim Filtern wird deshalb großzügig geladen und erst danach geschnitten.
  const grenze = opts.grenze ?? 500;
  const rows = await kandidatenLaden(
    lauf, opts.agentId ?? null, null, opts.nurVersendbar ? 2000 : grenze,
  );
  const alle = rows.map(bauen);
  return opts.nurVersendbar
    ? alle.filter((k) => !k.hindernis).slice(0, grenze)
    : alle;
}

export interface Versandergebnis {
  ok: boolean;
  ref: string;
  grund?: string;
  empfaenger?: string;
}

/**
 * Eine erste Rechnung stellen und verschicken.
 *
 * ── WAS DABEI PASSIERT ─────────────────────────────────────────────────────
 *   1. Der Betrag wird gesetzt (aus dem Paket).
 *   2. Die Zahlungsfrist wird auf heute + sieben Tage gesetzt.
 *   3. Der Zustand wechselt auf `pending_payment` — ab jetzt heißt es
 *      „Rechnung offen" und nicht mehr „Antrag fertig".
 *   4. Die Mail geht über das BESTEHENDE Event `payment_details`.
 *
 * ── WARUM `payment_details` UND KEIN NEUES EVENT ───────────────────────────
 * Es trägt bereits Bankverbindung, Betrag und Verwendungszweck und ist der
 * Vorlage nach genau das: „Bankverbindung, Betrag und Verwendungszweck. Geht
 * nach dem Antrag automatisch raus."
 *
 * Ein zweites Event für dieselbe Mail wäre ein zweiter Brevo-Text, den man
 * beim nächsten Wortwechsel an einer Stelle ändert und an der anderen vergisst.
 */
export async function rechnungStellen(
  ref: string,
  opts: { akteur: string; agentId?: number | null; nurBuchen?: boolean } ,
  lauf: Lauf = sqlPool,
): Promise<Versandergebnis> {
  const [r] = await kandidatenLaden(lauf, null, ref, 1);
  if (!r) {
    return { ok: false, ref, grund: "Diese Bestellung ist nicht (mehr) rechnungsreif." };
  }
  const k = bauen(r);
  if (k.hindernis) return { ok: false, ref, grund: k.hindernis };

  // ── ERST BUCHEN, DANN SENDEN ────────────────────────────────────────────
  // Wenn die Mail scheitert, steht die Rechnung trotzdem — mit Betrag und
  // Frist. Der Agent kann sie dann am Telefon durchgeben oder erneut senden.
  // Umgekehrt wäre schlimmer: eine verschickte Rechnung, die im System nicht
  // existiert.
  // ── DIE FRIST WIRD IN JAVASCRIPT GERECHNET ──────────────────────────────
  // Drei Anläufe in SQL scheiterten an der Typauflösung: „CURRENT_DATE + ${7}"
  // ergab „could not choose a best candidate operator", mit ::int dann „could
  // not determine data type of parameter". postgres.js schickt Zahlen ohne
  // Typangabe, und in einem UPDATE mit mehreren Ausdrücken kann PostgreSQL sie
  // nicht auflösen.
  //
  // Ein fertiges Datum ist eindeutig — und die Zeitzone gehört ohnehin nach
  // Berlin (AGENTS.md), nicht in eine Datenbank in Oregon.
  //
  // ── UND DIE ERKLÄRUNG GEHÖRT HIERHIN, NICHT INS SQL ─────────────────────
  // Der vierte Anlauf scheiterte am eigenen KOMMENTAR: Er stand innerhalb des
  // Template-Literals und enthielt zur Erläuterung die Zeichenfolge Dollar-
  // Klammer-Sieben. Die ist keine Beschreibung, sondern eine Interpolation —
  // postgres.js schickte einen zusätzlichen Parameter ohne Typ, und die
  // Fehlermeldung („could not determine data type") sah exakt so aus wie
  // vorher.
  //
  // AGENTS.md warnt vor Backticks in SQL-Kommentaren. Interpolationen sind
  // dieselbe Falle. `scripts/pruef-backticks.ts` prüft das ab sofort mit.
  const faellig = new Date(Date.now() + ZAHLUNGSFRIST_TAGE * 86_400_000)
    .toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  await lauf`
    UPDATE fiaon_applications
    SET amount_due = ${(k.betragCents / 100).toFixed(2)}::numeric,
        payment_due_date = ${faellig}::date,
        payment_status = 'pending_payment',
        status = CASE WHEN status = 'completed' THEN 'pending_payment' ELSE status END,
        updated_at = NOW()
    WHERE ref = ${ref}
  `;

  if (opts.nurBuchen) return { ok: true, ref, empfaenger: k.email ?? undefined };

  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  const versand = await sendMakeWebhookMitGrund("payment_details", {
    email: k.email!,
    vorname: String(r.first_name ?? "").trim() || null,
    nachname: String(r.last_name ?? "").trim() || null,
    antrag_id: k.ref,
    payment_reference: k.verwendungszweck,
    betrag: (k.betragCents / 100).toFixed(2),
    paket: k.bezeichnung,
  } as any);

  // Der Vorgang steht in der Akte — auch wenn die Mail scheitert.
  if (k.personId) {
    await lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${k.personId}, ${opts.agentId ?? null}, ${opts.akteur}, 'note',
              ${`Erste Rechnung gestellt: ${(k.betragCents / 100).toFixed(2)} €, `
                + `Verwendungszweck ${k.verwendungszweck}, fällig in ${ZAHLUNGSFRIST_TAGE} Tagen`
                + `${versand.ok ? ` — verschickt an ${k.email}` : ` — MAIL FEHLGESCHLAGEN: ${versand.grund}`}.`},
              NOW())
    // ── KEIN STILLES SCHLUCKEN MEHR (19.08.2026) ────────────────────────
    // Hier stand `.catch(() => {})`. Wenn dieser Eintrag scheitert, fehlt der
    // Vorgang im Verlauf der Akte — und der Agent, der „hab ich das schon
    // geschickt?" nachsieht, findet nichts. Der Fehler gehört wenigstens ins
    // Log (AGENTS.md: „Ein .catch() um eine Abfrage schreibt den Fehler mit").
    `.catch((e) => console.error(`[RECHNUNG] Verlaufseintrag ${ref} nicht geschrieben:`, e));
  }

  return versand.ok
    ? { ok: true, ref, empfaenger: k.email! }
    : { ok: false, ref, grund: `Rechnung gebucht, aber die Mail ging nicht raus: ${versand.grund}` };
}

/**
 * Der Tageslauf: alle rechnungsreifen Anträge abarbeiten.
 *
 * ── WARUM NUR EINMAL JE KUNDE ──────────────────────────────────────────────
 * Nach dem Stellen wechselt der Zustand auf `pending_payment`. Der Kunde ist
 * damit aus dieser Menge heraus und bekommt die Erinnerungen des normalen
 * Mahnlaufs — nicht jeden Tag eine neue erste Rechnung.
 *
 * ── DIE OBERGRENZE IST AUFGEHOBEN ──────────────────────────────────────────
 * Hier standen fünfzig am Tag, mit der Begründung, ein Versandschub falle in
 * jedem Spamfilter auf. Der Vorgesetzte am 11.08.2026: „Die 50 am Tag erhöhen
 * wir auf unlimitiert."
 *
 * Das ist seine Entscheidung und sie ist vertretbar: Die Anträge sind im
 * Schnitt 48 Tage alt. Wer zwei Monate auf eine Rechnung wartet, wartet nicht
 * noch eine Woche, weil ein Zustellrisiko besteht.
 *
 * Die Grenze bleibt als PARAMETER erhalten — wer sie braucht, setzt sie. Ohne
 * Angabe gibt es keine.
 */
export async function rechnungenTageslauf(
  opts: { schreiben?: boolean; grenze?: number } = {}, lauf: Lauf = sqlPool,
): Promise<{ versendet: number; gescheitert: number; offen: number; hinweis: string }> {
  const alle = await rechnungsKandidaten({ nurVersendbar: true, grenze: 5000 }, lauf);
  const dran = opts.grenze && opts.grenze > 0 ? alle.slice(0, opts.grenze) : alle;

  if (!opts.schreiben) {
    return {
      versendet: 0, gescheitert: 0, offen: alle.length,
      hinweis: `${alle.length} Anträge sind rechnungsreif, ${dran.length} kämen heute dran. `
        + "Das ist die Vorschau — es wurde nichts verschickt.",
    };
  }

  let versendet = 0;
  let gescheitert = 0;
  for (const k of dran) {
    const e = await rechnungStellen(k.ref, { akteur: "Tageslauf" }, lauf);
    if (e.ok) versendet++;
    else {
      gescheitert++;
      console.warn(`[RECHNUNG] ${k.ref}: ${e.grund}`);
    }
  }
  console.log(`[RECHNUNG] Lauf: ${versendet} verschickt, ${gescheitert} gescheitert`
    + (alle.length > dran.length ? `, ${alle.length - dran.length} bleiben` : "") + ".");
  return {
    versendet, gescheitert, offen: alle.length - dran.length,
    hinweis: `${versendet} Rechnungen verschickt.`
      + (gescheitert > 0 ? ` ${gescheitert} gescheitert.` : "")
      + (alle.length > dran.length ? ` ${alle.length - dran.length} bleiben für morgen.` : ""),
  };
}
