// ═══════════════════════════════════════════════════════════════════════════
// KONTO UND KARTE — der Weg zur Kreditkarte über unseren Kooperationspartner
//
// ── DER AUFTRAG (Justin, 24.08.2026) ───────────────────────────────────────
// „Der Kunde kommt ja mit der Erwartungshaltung ‚Ich brauche eine
// Kreditkarte' — das müssen wir nun auch erfüllen. Deshalb haben wir über
// unseren Partner ein Programm und sind akzeptiert worden. In der Akte muss
// es eine Funktion geben ‚Konto und Kreditkarte', und ERST wenn der Kunde
// [drei Bedingungen] erfüllt, verschicken wir über den Knopf ‚Karte
// bestellen' den Link. Der Kunde MUSS zuerst ein Girokonto eröffnen … Binde
// ÜBERALL den Prozess ein, wo er notwendig ist und hingehört."
//
// ── WORTWAHL, BINDEND ──────────────────────────────────────────────────────
// Justin ausdrücklich: „Schreibe es NIEMALS irgendwo als Affiliate, eher
// sowas wie ‚Partner', Kooperationspartner — es muss sich hochwertig
// anhören!"
// Es heißt deshalb überall — Oberfläche, Mail, Academy UND hier im Code —
// KOOPERATIONSPARTNER oder PARTNERBANK. Nie „Affiliate", nie
// „Provisionslink", nie „Werbelink". Wer das Wort wechselt, wechselt die
// Wahrnehmung: Der Kunde hört dann eine Vermittlung statt einer Empfehlung.
// Die Bank darf beim Namen genannt werden (Justin am 24.08. bestätigt):
// es ist die DKB, und ihre Vorteile SIND das Argument.
//
// ── WARUM ERST DAS KONTO, DANN DIE KARTE ───────────────────────────────────
// Das ist nicht unsere Reihenfolge, sondern die der Bank: Die Visa
// Kreditkarte gibt es nur ALS ZUBUCHUNG zu einem Girokonto, aus dem Banking
// heraus. Wer einen Menschen ohne Konto auf die Kreditkarte schickt, schickt
// ihn in eine Ablehnung — und die schreibt er UNS zu, nicht der Bank.
//
// ── WARUM DREI BEDINGUNGEN UND NICHT EINE ──────────────────────────────────
// Jede der drei verhindert einen konkreten Schaden. Die Begründungen stehen
// unten AM TOR und werden bis in die Oberfläche durchgereicht — der
// Mitarbeiter soll sie dem Kunden sagen können, nicht nur befolgen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/**
 * Der Weg zum Girokonto bei unserem Kooperationspartner.
 *
 * Die Kennung am Ende (`clickref`) trägt Kunde und Mitarbeiter. Ohne sie
 * wüssten wir zwar, DASS ein Konto eröffnet wurde, aber nicht von wem — und
 * eine Provision, die man nur schätzen kann, ist keine Provision, sondern ein
 * Streit.
 */
const PARTNER_LINK = "https://www.awin1.com/cread.php?awinmid=11329&awinaffid=3050049";

/**
 * Unsere Partnerbanken — namentlich, weil die Frage im Gespräch kommt.
 *
 * Daniel und Florentine, 25.08.2026: „Auf der Webseite ist aktuell nirgends
 * ersichtlich, mit welchen Partnerbanken FIAON arbeitet. Auch intern ist nicht
 * ersichtlich, welcher Kunde seine Karte von welcher Bank erhält. Da diese
 * Frage von Kunden und Interessenten häufiger kommt, wäre es sinnvoll, die
 * Partnerbanken transparent darzustellen."
 *
 * Sie haben recht: Eine ungenannte Bank wirkt wie ein Trick. Justin hat am
 * 24.08. ausdrücklich freigegeben, die DKB beim Namen zu nennen — ihre
 * Leistungen SIND das Argument.
 *
 * Die Liste steht hier und nicht in der Oberfläche, damit Akte, Mail, Academy
 * und Website dieselbe Auskunft geben. Kommt eine zweite Bank dazu, ist das
 * EINE Zeile — und alle vier Stellen ziehen mit.
 */
export const PARTNERBANKEN = [
  {
    key: "dkb",
    name: "DKB — Deutsche Kreditbank AG",
    kurz: "DKB",
    land: "Deutschland",
    /** Was der Mitarbeiter dem Kunden davon erzählen kann. */
    vorteile: [
      "Girokonto kostenlos ab 700 € Geldeingang im Monat, unter 28 Jahren immer",
      "Visa Debitkarte ohne Jahresgebühr, weltweit, mit Apple Pay und Google Pay",
      "Echtzeitüberweisungen in zehn Sekunden, rund um die Uhr",
      "Kontowechsel in unter zehn Minuten, Vertragspartner werden automatisch informiert",
      "Einlagen bis 100.000 € gesetzlich geschützt",
    ],
    /** Die Kreditkarte gibt es nur als Zubuchung aus dem fertigen Banking. */
    kartePreisMonat: "2,49 €",
    aktion: "aktuell bis zu 200 € Startguthaben",
  },
] as const;

/** Die Bank, über die dieser Weg läuft. Heute genau eine. */
export const PARTNERBANK = PARTNERBANKEN[0];

export function partnerLink(personId: number, agentId: number | null): string {
  const kunde = `FIAON-P${personId}`;
  const mitarbeiter = agentId ? `A${agentId}` : "A0";
  return `${PARTNER_LINK}&clickref=${encodeURIComponent(kunde)}&clickref2=${encodeURIComponent(mitarbeiter)}`;
}

/** Was der Mitarbeiter je bestätigter Kontoeröffnung bekommt. */
export const KARTEN_BONUS_CENTS = 1000; // 10,00 €

/**
 * Wie viele Raten gelaufen sein müssen, bevor der Weg aufgeht.
 *
 * Justin: „mindestens 2 Monate IM Paket, sonst kündigt uns danach jeder!"
 * Die Zahl steht hier EINMAL und wird überall von hier gelesen — Oberfläche,
 * Mail, Academy. Eine zweite Fassung wäre die Gelegenheit, dass sie
 * auseinanderlaufen.
 */
export const KARTE_MIN_RATEN = 2;

export type TorSchluessel = "antrag" | "bezahlt" | "unterlagen";

export interface Tor {
  schluessel: TorSchluessel;
  /** Kurz, für die Liste. */
  titel: string;
  erfuellt: boolean;
  /** Was JETZT fehlt — leer, wenn erfüllt. */
  fehlt: string | null;
  /** Der nächste Schritt, als Satz. */
  wieWeiter: string | null;
  /** WARUM es diese Bedingung gibt — für den Mitarbeiter. */
  warumIntern: string;
  /** Wie der Mitarbeiter es dem KUNDEN sagt. Sie-Form. */
  warumFuerKunden: string;
}

export interface KartenStand {
  personId: number;
  bereit: boolean;
  tore: Tor[];
  /** Was insgesamt noch fehlt, als ein Satz. Null, wenn bereit. */
  esFehlt: string | null;
  /** Schon verschickt? Dann wann, von wem und wie es steht. */
  versand: {
    am: string;
    vonName: string | null;
    status: string;
    bestaetigtAm: string | null;
    bonusCents: number;
  } | null;
  /** Welche Bank — damit die Frage „von welcher Bank kriege ich die Karte?"
   *  in der Akte beantwortet ist und nicht geraten werden muss. */
  bank: { name: string; kurz: string; vorteile: readonly string[]; kartePreisMonat: string; aktion: string };
  // 27.08.2026: `paketBezahlt` und `auskunftBezahlt` kommen mit, weil die
  // Oberfläche sonst raten muss, WARUM noch keine Rate gelaufen ist — und
  // dabei genau das Falsche geraten hat.
  zahlen: {
    ratenBezahlt: number; minRaten: number;
    paketBezahlt: boolean; auskunftBezahlt: boolean;
    /** Die nächste offene Rate — damit die Oberfläche ein Datum nennen kann. */
    naechsteRateAm: string | null;
  };
}

/** Die Tabelle liegt lazy an — die Datenbank ist Produktion, nur additiv. */
let tabelleGeprueft = false;
export async function ensureKartenTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (tabelleGeprueft) return;
  await lauf.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`
      CREATE TABLE IF NOT EXISTS fiaon_konto_karte (
        id            SERIAL PRIMARY KEY,
        person_id     INTEGER NOT NULL,
        agent_id      INTEGER,
        agent_name    TEXT,
        gesendet_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- DER VERSANDWEG. 'mail' ist der echte Weg zur Partnerbank.
        -- 'gemeldet' ist KEIN Versandweg, sondern das Gegenteil: Diese Zeile
        -- entstand ohne jeden Versand, weil ein Mitarbeiter die Kontoeröffnung
        -- von Hand gemeldet hat (kontoEroeffnetMelden, unten). Sie MUSS überall
        -- übersprungen werden, wo „ist der Weg schon draußen?“ gefragt wird —
        -- kartenStand().versand und bereiteKunden({ohneVersand}) tun das.
        -- (Keine Backticks in diesem Kommentar: Er steht in einem Tagged
        --  Template, ein Backtick würde die SQL-Zeichenkette beenden.)
        -- Ohne diese Unterscheidung sperrt eine Handmeldung den echten Versand
        -- und damit die 10-€-Provision (E-067), und der Kunde bekäme in seinem
        -- Weg einen Haken für eine Mail, die er nie erhalten hat.
        kanal         TEXT NOT NULL DEFAULT 'mail',
        -- gesendet → gemeldet → bestaetigt, oder verfallen.
        -- ('eroeffnet' ist ein Altwert derselben Bedeutung wie 'gemeldet' und
        --  wird überall mitgelesen — gesetzt wird er nicht mehr.)
        -- Der Bonus wird erst bei 'bestaetigt' auszahlbar: Der Partner meldet
        -- eine Eröffnung erst nach Wochen endgültig und kann sie streichen.
        -- Alles davor ist eine Vormerkung, keine Zusage.
        status        TEXT NOT NULL DEFAULT 'gesendet',
        bonus_cents   INTEGER NOT NULL DEFAULT 0,
        bestaetigt_am TIMESTAMPTZ,
        notiz         TEXT
      )
    `;
    // ── 06.09.2026, Scheibe 7 (E-154): der Tag der GEMELDETEN Eröffnung ─────
    // Additiv und idempotent, absichtlich HIER und nicht als Migration 083:
    // Diese Tabelle legt sich selbst an (oben), der SQL-Runner läuft aber VOR
    // dem Code — ein ALTER in einer Migrationsdatei träfe auf einer frischen
    // Datenbank auf eine Tabelle, die es dort noch nicht gibt.
    //
    // Warum eine EIGENE Spalte und nicht `bestaetigt_am`: An `bestaetigt_am`
    // hängt die 10-€-Kontoprovision (E-067). Sie wird erst mit der Bestätigung
    // des Kooperationspartners fällig. Eine Aussage des Kunden am Telefon darf
    // niemals eine Auszahlung auslösen — zwei Spalten, zwei Bedeutungen.
    await tx`ALTER TABLE fiaon_konto_karte ADD COLUMN IF NOT EXISTS gemeldet_am TIMESTAMPTZ`;
    // Und WER gemeldet hat. `agent_name` trägt den VERSENDER des Weges — an ihm
    // hängt die Provision, er darf sich nicht ändern, nur weil ein Kollege die
    // Eröffnung einträgt. Ohne eigene Spalte behauptete die Akte „gemeldet von
    // <Versender>“ und nannte damit den Falschen.
    await tx`ALTER TABLE fiaon_konto_karte ADD COLUMN IF NOT EXISTS gemeldet_von TEXT`;
    await tx`CREATE INDEX IF NOT EXISTS fiaon_konto_karte_person ON fiaon_konto_karte (person_id)`;
    await tx`CREATE INDEX IF NOT EXISTS fiaon_konto_karte_agent ON fiaon_konto_karte (agent_id, status)`;
  });
  tabelleGeprueft = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTOERÖFFNUNG — EINE QUELLE FÜR KUNDE UND AKTE (06.09.2026, E-154)
//
// Schritt 10 des Weges („Girokonto eröffnet“, shared/fiaon-rahmenweg.ts) stand
// fest auf offen — der Balken konnte nie voll werden, auch bei einem Menschen,
// der sein Konto längst hatte. Den Stand führt diese Tabelle ohnehin; es fehlte
// nur der Weg, ihn einzutragen, und eine Stelle, die ihn liest.
//
// Diese Stelle ist hier. Kundenbereich (GET /kunde/:ref/bereich) und Akte
// (GET /agent/app/kunde/:personId/uebersicht) rufen BEIDE `kontoEroeffnung()`.
// Zwei Fassungen wären zwei Wege für denselben Menschen — einer mit Datum, der
// andere ohne, und niemand wüsste, welcher stimmt.
//
// WELCHE ZEILE GILT: die jüngste, die „das Konto steht“ SAGT — nicht einfach
// die jüngste. Ein später verschickter Weg legt eine neue 'gesendet'-Zeile an;
// läse man nur die jüngste, fiele der Schritt beim Kunden wieder auf offen
// zurück. Ein Schritt, der einmal erledigt war, bleibt erledigt
// (shared/fiaon-rahmenweg.ts, Kopf).
// ═══════════════════════════════════════════════════════════════════════════

/** Stände, die „das Konto steht“ bedeuten. 'eroeffnet' ist der Altwert von 'gemeldet'. */
export const KONTO_EROEFFNET_STAENDE: readonly string[] = ["gemeldet", "eroeffnet", "bestaetigt"];

export interface KontoEroeffnung {
  /** Steht das Konto? Nur bei einem der drei Stände oben. */
  eroeffnet: boolean;
  /** Der Tag als „dd.mm.yyyy“ (Berlin) — Bestätigung des Partners zuerst, sonst die Meldung. */
  am: string | null;
  /** Wer es gemeldet hat — für die Akte. Der Kunde sieht diesen Namen nicht. */
  gemeldetVon: string | null;
  /** Der rohe Stand der jüngsten Zeile; null, wenn es keine gibt. */
  status: string | null;
}

/** „dd.mm.yyyy“ in Berliner Zeit. Nur formatToParts — Number(format()) ergibt NaN. */
function tagBerlin(d: any): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(x);
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "";
  return `${w("day")}.${w("month")}.${w("year")}`;
}

/** Steht das Girokonto? Die eine Auskunft für Kundenbereich und Akte. */
export async function kontoEroeffnung(personId: number, lauf: Lauf = sqlPool): Promise<KontoEroeffnung> {
  const leer: KontoEroeffnung = { eroeffnet: false, am: null, gemeldetVon: null, status: null };
  try {
    await ensureKartenTabelle(lauf);
    // Erst die Zeile suchen, die eine Eröffnung TRÄGT — die Bestätigung des
    // Partners schlägt dabei die Meldung des Mitarbeiters.
    const [z] = (await lauf`
      SELECT status, gemeldet_von, gemeldet_am, bestaetigt_am
        FROM fiaon_konto_karte
       WHERE person_id = ${personId} AND status = ANY (${[...KONTO_EROEFFNET_STAENDE]})
       ORDER BY (status = 'bestaetigt') DESC,
                COALESCE(bestaetigt_am, gemeldet_am, gesendet_am) DESC
       LIMIT 1`) as any[];
    if (!z) {
      // Keine Eröffnung — aber der rohe Stand der jüngsten Zeile ist trotzdem
      // eine Auskunft („gesendet“: der Weg ist draußen, mehr nicht).
      const [j] = (await lauf`
        SELECT status FROM fiaon_konto_karte WHERE person_id = ${personId}
         ORDER BY gesendet_am DESC LIMIT 1`) as any[];
      return { eroeffnet: false, am: null, gemeldetVon: null, status: j ? String(j.status) : null };
    }
    return {
      eroeffnet: true,
      am: tagBerlin(z.bestaetigt_am) ?? tagBerlin(z.gemeldet_am),
      gemeldetVon: z.gemeldet_von ?? null,
      status: String(z.status),
    };
  } catch (e: any) {
    // Eine klemmende Nebenabfrage darf weder den Bereich noch die Akte
    // mitreissen (Lehre vom 26./27.08.2026) — dann eben ohne diesen Schritt.
    console.error("[KONTO] Eröffnungsstand:", e?.message || e);
    return leer;
  }
}

export interface MeldungErgebnis {
  /** Der Stand NACH der Meldung. */
  stand: KontoEroeffnung;
  /** War es schon eingetragen? Dann wurde nichts geschrieben. */
  schonGemeldet: boolean;
}

/**
 * Der Mitarbeiter meldet: Der Kunde hat sein Girokonto eröffnet.
 *
 * Idempotent — zweimal melden schreibt nur einmal. Setzt `status = 'gemeldet'`
 * und `gemeldet_am`.
 *
 * WAS DIESE FUNKTION NIEMALS ANFASST: `bestaetigt_am` und `bonus_cents`. Die
 * 10 € (E-067) werden erst mit der Bestätigung des Kooperationspartners fällig,
 * und der bestätigt Wochen später — er kann eine Eröffnung auch wieder
 * streichen. Wer eine Kundenaussage in eine Auszahlung übersetzt, zahlt
 * irgendwann für ein Konto, das es nie gab.
 *
 * @param amIso Der Eröffnungstag als „YYYY-MM-DD“. Ohne Angabe: jetzt.
 */
export async function kontoEroeffnetMelden(
  personId: number,
  agentId: number | null,
  agentName: string | null,
  amIso?: string | null,
  lauf: Lauf = sqlPool,
): Promise<MeldungErgebnis> {
  await ensureKartenTabelle(lauf);

  const notiz = `Kontoeröffnung${agentName ? ` von ${agentName}` : ""} gemeldet.`;

  // ── WARUM EINE TRANSAKTION MIT SPERRE UND KEIN „LESEN, DANN SCHREIBEN“ ────
  // Vorher stand hier: Stand lesen · Zeile suchen · schreiben. Zwei Klicks im
  // selben Augenblick (Doppelklick, zwei Fenster) lasen beide „noch nichts da“
  // und legten zwei Zeilen an; gelesen wurde danach nur eine, die andere blieb
  // als Karteileiche stehen. Die Tabelle hat kein UNIQUE auf person_id, und ein
  // nachträgliches wäre gefährlich: Der echte Versand legt bewusst je Weg eine
  // Zeile an. Also sperren wir für die Dauer der Transaktion auf DIESEN
  // Menschen — der zweite Klick wartet und sieht dann „schon gemeldet“.
  const ergebnis = await lauf.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(815401, ${personId})`;

    const schon = await kontoEroeffnung(personId, tx as unknown as Lauf);
    if (schon.eroeffnet) return { stand: schon, schonGemeldet: true };

    // 12:00 Uhr des gemeldeten Tages: So steht beim Zurücklesen in Berlin
    // DERSELBE Tag da, in jeder Zeitzone, in der dieser Dienst je läuft.
    // Mitternacht täte das nicht — sie kippt um einen Tag.
    const [vorhanden] = (await tx`
      SELECT id FROM fiaon_konto_karte WHERE person_id = ${personId}
       ORDER BY gesendet_am DESC LIMIT 1`) as any[];

    if (vorhanden) {
      // Die vorhandene Zeile wird FORTGESCHRIEBEN. Eine zweite daneben wäre ein
      // zweiter Vorgang für dieselbe Sache, und gelesen würde nur eine davon.
      // `agent_id`/`agent_name` bleiben unberührt: Das ist der VERSENDER des
      // Weges, an ihm hängt die Provision. Der Melder steht in `gemeldet_von`.
      // Die Notiz wird ANGEHÄNGT, nicht ersetzt — was dort stand, stand dort
      // aus einem Grund.
      if (amIso) {
        await tx`
          UPDATE fiaon_konto_karte
             SET status = 'gemeldet', gemeldet_am = (${amIso}::date + TIME '12:00')::timestamptz,
                 gemeldet_von = ${agentName},
                 notiz = TRIM(BOTH E'\n' FROM COALESCE(notiz || E'\n', '') || ${notiz})
           WHERE id = ${Number(vorhanden.id)}`;
      } else {
        await tx`
          UPDATE fiaon_konto_karte
             SET status = 'gemeldet', gemeldet_am = NOW(),
                 gemeldet_von = ${agentName},
                 notiz = TRIM(BOTH E'\n' FROM COALESCE(notiz || E'\n', '') || ${notiz})
           WHERE id = ${Number(vorhanden.id)}`;
      }
    } else {
      // Ohne verschickten Weg kein Bonus: Die Provision hängt an UNSEREM Link,
      // nicht an der Eröffnung. `bonus_cents` bleibt deshalb 0.
      // `kanal = 'gemeldet'` sagt: HIER WURDE NICHTS VERSCHICKT. Nur deshalb
      // sperrt diese Zeile weder den echten Versand (kartenStand().versand)
      // noch die Tagesliste (bereiteKunden) — siehe Spaltenkommentar oben.
      if (amIso) {
        await tx`
          INSERT INTO fiaon_konto_karte (person_id, agent_id, agent_name, kanal, status, bonus_cents, gemeldet_am, gemeldet_von, notiz)
          VALUES (${personId}, ${agentId}, ${agentName}, 'gemeldet', 'gemeldet', 0,
                  (${amIso}::date + TIME '12:00')::timestamptz, ${agentName}, ${notiz})`;
      } else {
        await tx`
          INSERT INTO fiaon_konto_karte (person_id, agent_id, agent_name, kanal, status, bonus_cents, gemeldet_am, gemeldet_von, notiz)
          VALUES (${personId}, ${agentId}, ${agentName}, 'gemeldet', 'gemeldet', 0, NOW(), ${agentName}, ${notiz})`;
      }
    }
    return { stand: await kontoEroeffnung(personId, tx as unknown as Lauf), schonGemeldet: false };
  });

  return ergebnis as MeldungErgebnis;
}

/**
 * Der Kern: eine SQL-Abfrage, die für eine Menge Personen alle drei Tore
 * beantwortet.
 *
 * Bewusst EINE Abfrage für eine ganze Liste statt einer je Person: Der
 * Bestand-Raum fragt das für bis zu 500 Menschen gleichzeitig ab, und 500
 * einzelne Abfragen wären dort eine halbe Sekunde Wartezeit für eine
 * Marke auf einer Karte.
 */
const STAND_SQL = `
  SELECT p.id AS person_id,
    -- ── DIE PERSON ZAEHLT MIT (27.08.2026, Team-Punkt 2) ──────────────────
    -- Gemeldet: „Angaben im Antrag fehlen — Daten ergaenzen", waehrend unter
    -- „Daten" alles stand. Diese Pruefung las NUR die Antragskopien; seit
    -- Migration 059 ist die PERSON die Wahrheit und die Kopie darf leer sein.
    -- Jedes Feld gilt als da, wenn es am Antrag ODER an der Person steht —
    -- dieselbe Regel wie in der Lueckenliste (fehlendeFelderSql).
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND COALESCE(NULLIF(TRIM(a.first_name), ''), NULLIF(TRIM(p.first_name), '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.last_name),  ''), NULLIF(TRIM(p.last_name),  '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.birthdate),  ''), NULLIF(TRIM(p.birthdate::text), '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.street),     ''), NULLIF(TRIM(p.street),     '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.zip),        ''), NULLIF(TRIM(p.zip),        '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.city),       ''), NULLIF(TRIM(p.city),       '')) IS NOT NULL
        AND COALESCE(NULLIF(TRIM(a.email),      ''), NULLIF(TRIM(p.primary_email), '')) IS NOT NULL
    ) AS antrag_voll,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status = 'paid' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
    ) AS paket_bezahlt,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status = 'paid' AND a.ref LIKE 'FIAON-SCHUFA-%'
    ) AS schufa_bezahlt,
    -- ── DIE STARTZAHLUNG ZAEHLT AUCH OHNE KETTENEINTRAG (27.08.2026) ──
    -- Team-Punkt 16 (Beispiel Dirk Ladewig): Der Antrag ist bankbestaetigt
    -- bezahlt, aber die rueckwirkend angelegte Kette trug Rate 1 als offen —
    -- die Akte sagte „0 von 2 Raten". Ein bezahlter Antrag HAT per Definition
    -- eine bezahlte Erstzahlung (payment_status='paid' entsteht nur ueber den
    -- einen Buchungsweg). GREATEST nimmt deshalb mindestens 1, sobald das
    -- Paket bezahlt ist — die Kette kann der Wahrheit nicht mehr widersprechen.
    GREATEST(
      COALESCE((
        SELECT COUNT(*) FROM fiaon_abo_raten r
        JOIN fiaon_applications a2 ON a2.ref = r.ref
        WHERE a2.person_id = p.id AND r.status = 'bezahlt'
      ), 0),
      CASE WHEN EXISTS (
        SELECT 1 FROM fiaon_applications a3
        WHERE a3.person_id = p.id AND a3.merged_into IS NULL
          AND a3.payment_status = 'paid' AND a3.ref NOT LIKE 'FIAON-SCHUFA-%'
      ) THEN 1 ELSE 0 END
    )::int AS raten_bezahlt,
    -- Wann die nächste offene Rate fällig ist. Ohne dieses Datum kann die
    -- Oberfläche nur sagen „es fehlt etwas", nicht „am 30.08. ist die nächste".
    (
      SELECT MIN(r.faellig_am) FROM fiaon_abo_raten r
      JOIN fiaon_applications a2 ON a2.ref = r.ref
      WHERE a2.person_id = p.id AND r.status = 'offen' AND r.storniert_am IS NULL
    ) AS naechste_rate_am,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.bank_statement_pdf IS NOT NULL
    ) AS hat_kontoauszug,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.id_card_pdf IS NOT NULL
    ) AS hat_ausweis
  FROM fiaon_persons p
`;

/** Aus einer Zeile die drei Tore mit Begründungen bauen. */
function toreAus(r: any): Tor[] {
  const raten = Number(r.raten_bezahlt || 0);
  const geldOk = r.paket_bezahlt && r.schufa_bezahlt && raten >= KARTE_MIN_RATEN;

  const geldFehlt = [
    !r.paket_bezahlt ? "das Paket ist nicht bezahlt" : null,
    !r.schufa_bezahlt ? "die Bonitätsauskunft ist nicht bezahlt" : null,
    raten < KARTE_MIN_RATEN
      ? `für die Karte sind erst ${raten} von ${KARTE_MIN_RATEN} nötigen Monatsraten gelaufen (das Abo selbst läuft 12 Raten)`
      : null,
  ].filter(Boolean).join(", ");

  const unterlagenFehlt = [
    !r.hat_kontoauszug ? "der Kontoauszug" : null,
    !r.hat_ausweis ? "der Ausweis" : null,
  ].filter(Boolean).join(" und ");

  return [
    {
      schluessel: "antrag",
      titel: "Antrag vollständig",
      erfuellt: !!r.antrag_voll,
      fehlt: r.antrag_voll ? null : "Angaben im Antrag fehlen",
      wieWeiter: r.antrag_voll ? null : "Unter „Daten“ ergänzen: Name, Geburtsdatum, Anschrift und E-Mail.",
      warumIntern:
        "Ohne diese Angaben bricht die Kontoeröffnung bei der Bank ab — und der Kunde schreibt den "
        + "Abbruch uns zu, nicht ihr.",
      warumFuerKunden:
        "Damit die Eröffnung in einem Zug durchläuft, müssen Ihre Angaben mit Ihrem Ausweis "
        + "übereinstimmen.",
    },
    {
      schluessel: "bezahlt",
      // P11 (01.09.2026): VORHER stand hier die Behauptung „Paket und Auskunft
      // bezahlt, 2 von 12 Monatsraten gelaufen" — direkt über dem gelben
      // „das Paket ist nicht bezahlt". Der Titel ist eine ANFORDERUNG; er
      // muss als Bedingung lesbar sein und den echten Stand zeigen.
      titel: `Bezahlt: Paket, Auskunft und mindestens ${KARTE_MIN_RATEN} der 12 Monatsraten (aktuell ${raten} ${raten === 1 ? "Rate" : "Raten"} gelaufen)`,
      erfuellt: !!geldOk,
      fehlt: geldOk ? null : geldFehlt,
      wieWeiter: geldOk ? null
        : !r.schufa_bezahlt ? "Die Bonitätsauskunft (74 €) verkaufen — sie ist die Grundlage für alles Weitere."
        : raten < KARTE_MIN_RATEN ? `Noch ${KARTE_MIN_RATEN - raten} Rate abwarten oder nachfassen.`
        : "Zahlungsdaten senden und die Zahlung nachhalten.",
      warumIntern:
        "Die zwei Raten sind der eigentliche Schutz. Wer die Karte am Tag der ersten Zahlung bekommt, "
        + "hat keinen Grund mehr, im Paket zu bleiben — dann zahlt er einmal und kündigt. Wer zwei "
        + "Monate dabei war, hat seinen Nutzen erlebt und bleibt. Und ohne bezahlte Auskunft wissen "
        + "wir gar nicht, ob seine Bonität die Eröffnung trägt.",
      // 06.09.2026: Hier stand „Wir empfehlen das Konto erst …“. Das Wort
      // „empfehlen“ steht auf der Wortwand (shared/fiaon-wortverbote.ts) und
      // der Satz geht wörtlich an den Kunden — über das Bereich-JSON
      // (fiaon-kunde-bereich.ts, karte.tore[].warum) und über „So sagst du es
      // dem Kunden“ in der Akte. Der Postmeister ersetzte ihn bereits per
      // Regex; jetzt stimmt die QUELLE, und die zweite Wahrheit dort kann weg.
      warumFuerKunden:
        "Der Konto-Schritt kommt erst, wenn Ihre Auskunft vorliegt und Ihre ersten Raten gelaufen "
        + "sind. Vorher wüssten wir nicht, ob die Bank Sie annimmt — und eine Ablehnung würde erneut "
        + "in Ihrer Auskunft stehen.",
    },
    {
      schluessel: "unterlagen",
      titel: "Kontoauszug und Ausweis liegen vor",
      erfuellt: !!(r.hat_kontoauszug && r.hat_ausweis),
      fehlt: r.hat_kontoauszug && r.hat_ausweis ? null : `${unterlagenFehlt} fehlt noch`,
      wieWeiter: r.hat_kontoauszug && r.hat_ausweis ? null
        : "Unter „Dokumente“ anfordern — oder für den Kunden hochladen, wenn er es dir geschickt hat.",
      warumIntern:
        "Die Bank verlangt für das Video-Ident denselben Ausweis. Wer ihn bei uns schon hochgeladen "
        + "hat, kommt dort in einem Zug durch — und du weißt vorher, dass er ihn zur Hand hat.",
      warumFuerKunden:
        "Für die Eröffnung brauchen Sie Ihren Ausweis vor der Kamera. Da Sie ihn bei uns schon "
        + "hinterlegt haben, dauert das nur wenige Minuten.",
    },
  ];
}

/** Stand für EINE Person, inklusive bisherigem Versand. */
export async function kartenStand(personId: number, lauf: Lauf = sqlPool): Promise<KartenStand | null> {
  await ensureKartenTabelle(lauf);
  const [r] = (await lauf.unsafe(
    `${STAND_SQL} WHERE p.id = $1 AND p.merged_into_person_id IS NULL`,
    [personId],
  )) as any[];
  if (!r) return null;

  const tore = toreAus(r);
  const offen = tore.filter((t) => !t.erfuellt);

  // `kanal <> 'gemeldet'` ist tragend, kein Schönheitsfilter: Eine von Hand
  // gemeldete Kontoeröffnung ist KEIN Versand. Ohne diese Zeile hielte
  // `versand` eine Handmeldung für eine verschickte Partnerbank-Mail — der
  // Sendeknopf ginge mit „bereits geschickt“ zu, im Weg des Kunden erschiene
  // ein Haken bei „Weg zu Konto und Karte erhalten“, den er nie bekommen hat,
  // und die 10 € (E-067) könnten nie entstehen.
  const [v] = (await lauf`
    SELECT gesendet_am, agent_name, status, bestaetigt_am, bonus_cents
    FROM fiaon_konto_karte WHERE person_id = ${personId} AND kanal <> 'gemeldet'
    ORDER BY gesendet_am DESC LIMIT 1
  `) as any[];

  return {
    personId,
    bereit: offen.length === 0,
    tore,
    esFehlt: offen.length === 0 ? null
      : offen.map((t) => t.fehlt).filter(Boolean).join(" · "),
    versand: v ? {
      am: v.gesendet_am,
      vonName: v.agent_name ?? null,
      status: v.status,
      bestaetigtAm: v.bestaetigt_am ?? null,
      bonusCents: Number(v.bonus_cents || 0),
    } : null,
    bank: {
      name: PARTNERBANK.name, kurz: PARTNERBANK.kurz,
      vorteile: PARTNERBANK.vorteile,
      kartePreisMonat: PARTNERBANK.kartePreisMonat,
      aktion: PARTNERBANK.aktion,
    },
    zahlen: {
      ratenBezahlt: Number(r.raten_bezahlt || 0),
      minRaten: KARTE_MIN_RATEN,
      paketBezahlt: !!r.paket_bezahlt,
      auskunftBezahlt: !!r.schufa_bezahlt,
      naechsteRateAm: r.naechste_rate_am ? String(r.naechste_rate_am).slice(0, 10) : null,
    },
  };
}

/**
 * Wer ist bereit? Für den Bestand-Filter und die Tagesliste.
 *
 * `nurAgent` grenzt auf die eigenen Kunden ein — Justin am 24.08.: „in die
 * Tagesliste bitte bei den Mitarbeitern, die die Kunden betreuen." Ein
 * Mitarbeiter soll nicht die bereiten Kunden anderer sehen.
 * `ohneVersand` blendet aus, wo schon geschickt wurde: Ein zweiter Link an
 * denselben Menschen wirkt wie eine Mahnung. „Geschickt“ heißt dabei WIRKLICH
 * geschickt — eine von Hand gemeldete Kontoeröffnung (kanal = 'gemeldet') ist
 * kein Versand und darf niemanden aus dieser Liste nehmen.
 */
export async function bereiteKunden(
  opt: { agentId?: number | null; ohneVersand?: boolean; grenze?: number } = {},
  lauf: Lauf = sqlPool,
): Promise<{ personId: number; name: string; agentId: number | null }[]> {
  await ensureKartenTabelle(lauf);
  const bedingungen: string[] = ["p.merged_into_person_id IS NULL"];
  const werte: any[] = [];
  if (opt.agentId) { werte.push(opt.agentId); bedingungen.push(`p.assigned_agent_id = $${werte.length}`); }

  const zeilen = (await lauf.unsafe(
    `SELECT x.*, TRIM(COALESCE(pp.first_name,'') || ' ' || COALESCE(pp.last_name,'')) AS name,
            pp.assigned_agent_id
     FROM (${STAND_SQL} WHERE ${bedingungen.join(" AND ")}) x
     JOIN fiaon_persons pp ON pp.id = x.person_id
     WHERE x.antrag_voll AND x.paket_bezahlt AND x.schufa_bezahlt
       AND x.raten_bezahlt >= ${KARTE_MIN_RATEN}
       AND x.hat_kontoauszug AND x.hat_ausweis
     ${opt.ohneVersand ? "AND NOT EXISTS (SELECT 1 FROM fiaon_konto_karte k WHERE k.person_id = x.person_id AND k.kanal <> 'gemeldet')" : ""}
     ORDER BY x.person_id
     LIMIT ${Math.min(500, Math.max(1, opt.grenze ?? 200))}`,
    werte,
  )) as any[];

  return zeilen.map((z) => ({
    personId: Number(z.person_id),
    name: String(z.name || "").trim() || `Person ${z.person_id}`,
    agentId: z.assigned_agent_id ?? null,
  }));
}

/** Nur die Anzahl — für Kacheln und Marken, ohne die ganze Liste zu holen. */
export async function bereitZahl(agentId: number | null, lauf: Lauf = sqlPool): Promise<number> {
  const liste = await bereiteKunden({ agentId, ohneVersand: true, grenze: 500 }, lauf);
  return liste.length;
}
