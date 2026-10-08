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
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import {
  KARTE_LINK_SATZ, KARTE_ZEIT_SATZ,
  // E-IT-B (08.10.2026): die eine Regel „wer bekommt den Link“, Drossel, Zustellung, Nachfassen.
  KARTE_AUSSCHLUSS_REIHENFOLGE, karteAusschluss, karteHandHinweis, karteKundeSatz, KARTE_ERNEUT, KARTE_ZUSTELL_TEXT,
  zustellProblem, ZUSTELL_PROBLEM_SQL, KARTE_ZUSTELL_WEICH_TEXT, BREVO_SPERRGRUND_TEXT, KARTE_ADRESSE_KUNDE,
  karteAdresseHinweis, karteSperreLeitungMoeglich, brevoAbmeldung, ruecklaeuferWeich, KARTE_SPERRE_AUFGEHOBEN_TEXT, karteHeuteSchonSatz,
  KARTE_NACHFASSEN, KARTE_NACHFASSEN_REIHENFOLGE, KARTE_NICHT_GEKLICKT_TAGE,
  type KarteFlags, type KarteZweck, type KarteAusschluss, type KarteAusschlussCode, type KarteNachfassZustand,
} from "@shared/fiaon-karten-weg";
import {
  KUENDIGUNG_WIRKSAM_SQL, KUENDIGUNG_AM_SQL, KUENDIGUNG_BESTELLUNG_SQL, kuendigungPhase,
} from "@shared/fiaon-kuendigung-regel";

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
export const KARTE_MIN_RATEN = 1;
// ── AB DER ERSTEN RATE (21.09.2026, E-206) ─────────────────────────────────
// Justin: „Ab JETZT JEDER, der eine Rate bezahlt hat, kriegt den DKB-Link, die
// Einladung dazu." Der neue Weg (Team-Chat 21.09.): Zahlung → Einladung der
// Partnerbank → in der Antragszeit lädt der Kunde Kontoauszüge, Ausweis und
// Auskunft bei uns hoch → FIAONs Bonitätsanalyse. Deshalb sind Auskunft und
// Unterlagen keine Tore mehr — sie kommen NACH dem Link, nicht davor.
// Der Schutz „zwei Monate im Paket" entfällt damit bewusst (Justins Entscheidung).

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
  /** Tore erfüllt UND kein Ausschluss für einen Menschen in der Akte (E-IT-B). */
  bereit: boolean;
  tore: Tor[];
  /** Was insgesamt noch fehlt, als ein Satz. Null, wenn bereit. */
  esFehlt: string | null;
  /**
   * E-IT-B (08.10.2026): Warum ein MENSCH in der Akte den Link nicht schicken
   * darf (shared/fiaon-karten-weg.ts, Zweck „mensch“) — null, wenn er darf.
   * Gekündigt mit laufendem Vertrag sperrt hier nicht (Justin, 08.10.).
   */
  ausschluss: KarteAusschluss | null;
  /** Dasselbe für Liste, Automatik und Mara (Zweck „automatik“) — hier sperrt jede wirksame Kündigung. */
  ausschlussAutomatik: KarteAusschluss | null;
  /** Nur von Hand (gekündigt mit laufendem Vertrag, Einstufung −1, Storno): der Satz neben dem Knopf (karteHandHinweis). */
  hinweis: string | null;
  /** E-IT-B Gegenprüfung: der Satz für den KUNDEN, wenn die Automatik nicht schickt (karteKundeSatz) — null sonst. */
  kundeSatz: string | null;
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
    /** E-178: gekauft ODER eigene, ausgewertete Auskunft. */
    auskunftVorhanden: boolean;
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
    // ── E-IT-B (08.10.2026): NUR ANLEGEN, WAS FEHLT ─────────────────────────
    // Ein ALTER TABLE nimmt die ACCESS-EXCLUSIVE-Sperre auch dann, wenn die
    // Spalte schon da ist (Ausfall 28.09., E-254) — bei jedem Serverstart auf
    // eine Tabelle, die Akte und Automatik lesen. Deshalb erst nachsehen.
    const vorhanden = new Set(((await tx`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'fiaon_konto_karte'`) as any[]).map((r) => String(r.column_name)));
    if (!vorhanden.has("gemeldet_am")) await tx`ALTER TABLE fiaon_konto_karte ADD COLUMN IF NOT EXISTS gemeldet_am TIMESTAMPTZ`;
    // Und WER gemeldet hat. `agent_name` trägt den VERSENDER des Weges — an ihm
    // hängt die Provision, er darf sich nicht ändern, nur weil ein Kollege die
    // Eröffnung einträgt. Ohne eigene Spalte behauptete die Akte „gemeldet von
    // <Versender>“ und nannte damit den Falschen.
    if (!vorhanden.has("gemeldet_von")) await tx`ALTER TABLE fiaon_konto_karte ADD COLUMN IF NOT EXISTS gemeldet_von TEXT`;
    // ── E-IT-B (08.10.2026): DER ERNEUTE VERSAND IST KEIN NEUER VORGANG ─────
    // Erneut senden (Akte, Mara, Verwaltung) schreibt DIESE Zeile fort — nie
    // eine neue (sonst wären die 10 € doppelt vorgemerkt) und nie gesendet_am
    // (das bleibt der Erstversand). Gezählt, wann und von wem zuletzt. Dieselbe
    // DDL steht in db/migrations/098_konto_karte_erneut.sql.
    if (!vorhanden.has("erneut_anzahl") || !vorhanden.has("zuletzt_erneut_am") || !vorhanden.has("zuletzt_erneut_von")) {
      await tx`
        ALTER TABLE fiaon_konto_karte
          ADD COLUMN IF NOT EXISTS erneut_anzahl INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS zuletzt_erneut_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS zuletzt_erneut_von TEXT`;
    }
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
    -- ── NUR EIN PRIVATPAKET IST EIN PAKET (02.10.2026, E-272) ──────────────
    -- Hier zaehlte JEDE bezahlte Bestellung ausser der Auskunft — auch ein
    -- bezahlter Auftrag ueber FIAON Global. Die Einladung der Partnerbank ist
    -- eine Leistung der Privatlinie (Stufenpaket, Raten, Karte); ein Firmen-
    -- kunde bekam sie bisher nur deshalb nicht, weil die Mail-Tuer zufaellig an
    -- seiner Global-Bestellung haengen blieb. Jetzt zaehlt nur die Kategorie
    -- konto (fiaon-produktkategorie.ts). Gemessen am 02.10.: 470 Personen vorher
    -- wie nachher, niemand faellt heraus.
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status = 'paid' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        AND ${produktkategorieSql("a")} = 'konto'
    ) AS paket_bezahlt,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status = 'paid' AND a.ref LIKE 'FIAON-SCHUFA-%'
    ) AS schufa_bezahlt,
    -- ── EINE EIGENE, AUSGEWERTETE AUSKUNFT ZAEHLT WIE EINE GEKAUFTE (11.09.2026, E-178) ──
    -- Justin: „Bei Dirk Ladewig koennen wir den DKB-Link nicht versenden, weil
    -- da steht, dass er keine Analyse hat — obwohl er die ja hat, die haben wir
    -- selbst gemacht! Wenn uns jemand eine hochlaedt, die passt, muss er ueber
    -- uns keine kaufen." Das Tor verlangte bis heute die BESTELLUNG der
    -- Auskunft; die Sache dahinter ist, dass wir seine Bonitaet kennen. Das tun
    -- wir, sobald seine eigene Auskunft ausgewertet ist (fiaon-schufa-analyse).
    -- Es zaehlt der JUENGSTE Lauf je Bestellung: Eine aeltere fertige Analyse
    -- ueber eine Datei, die der neueste Lauf als „keine Auskunft" einstuft
    -- (Cengiz, Camara Pinter am 11.09.), darf kein Tor oeffnen.
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND (SELECT sa.status FROM fiaon_schufa_analysen sa
              WHERE sa.ref = a.ref ORDER BY sa.created_at DESC LIMIT 1) = 'fertig'
    ) AS schufa_eigene,
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
      -- E-272: dieselbe Lesart wie paket_bezahlt oben — nur ein Privatpaket.
      CASE WHEN EXISTS (
        SELECT 1 FROM fiaon_applications a3
        WHERE a3.person_id = p.id AND a3.merged_into IS NULL
          AND a3.payment_status = 'paid' AND a3.ref NOT LIKE 'FIAON-SCHUFA-%'
          AND ${produktkategorieSql("a3")} = 'konto'
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
      WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL
        AND a.bank_statement_pdf IS NOT NULL
    ) AS hat_kontoauszug,
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL
        AND a.id_card_pdf IS NOT NULL
    ) AS hat_ausweis
  FROM fiaon_persons p
`;

/**
 * `fiaon_schufa_analysen` entsteht beim ersten Lauf der Analyse (lazy). STAND_SQL
 * fragt sie jetzt ab — auf einer frischen Datenbank wuerde die ganze Abfrage
 * an der fehlenden Tabelle scheitern. Deshalb vor jeder Nutzung sicherstellen.
 */
async function schufaTabelleSicher(): Promise<void> {
  await import("./fiaon-schufa-analyse").then((m) => m.ensureSchufaTabelle()).catch(() => {});
}

/** Aus einer Zeile die drei Tore mit Begründungen bauen. */
function toreAus(r: any): Tor[] {
  const raten = Number(r.raten_bezahlt || 0);
  // E-206: Nur noch die erste Zahlung zählt. Auskunft und Unterlagen kommen in
  // der Antragszeit — sie stehen weiter in der Akte, sperren aber nicht mehr.
  const geldOk = r.paket_bezahlt && raten >= KARTE_MIN_RATEN;

  const geldFehlt = [
    !r.paket_bezahlt ? "das Paket ist nicht bezahlt" : null,
    r.paket_bezahlt && raten < KARTE_MIN_RATEN ? "die erste Zahlung ist noch nicht gebucht" : null,
  ].filter(Boolean).join(", ");

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
      // E-206 (21.09.2026): „ab der ersten Rate". Vorher: Paket, Auskunft UND
      // zwei Raten — und ein drittes Tor für Kontoauszug und Ausweis.
      titel: "Erste Zahlung gebucht — der Account ist aktiviert",
      erfuellt: !!geldOk,
      fehlt: geldOk ? null : geldFehlt,
      wieWeiter: geldOk ? null : "Zahlungsdaten senden und die erste Zahlung nachhalten.",
      warumIntern:
        "Justin am 21.09.2026: Ab der ersten bezahlten Rate bekommt jeder die Einladung der Partnerbank. "
        + "Kontoauszüge, Ausweis und Auskunft lädt der Kunde in der Antragszeit hoch — dann folgt unsere Bonitätsanalyse.",
      warumFuerKunden:
        "Sobald Ihre erste Zahlung gebucht ist, ist Ihr Account aktiviert und Sie bekommen direkt den Link unserer Partnerbank.",
    },
  ];
}

/** Stand für EINE Person, inklusive bisherigem Versand. */
export async function kartenStand(personId: number, lauf: Lauf = sqlPool): Promise<KartenStand | null> {
  await ensureKartenTabelle(lauf);
  await schufaTabelleSicher();
  const [r] = (await lauf.unsafe(
    `${STAND_SQL} WHERE p.id = $1 AND p.merged_into_person_id IS NULL`,
    [personId],
  )) as any[];
  if (!r) return null;

  const tore = toreAus(r);
  const offen = tore.filter((t) => !t.erfuellt);
  // ── E-IT-B (08.10.2026): DIE TORE ALLEIN SIND NICHT „BEREIT“ ──────────────
  // Bis heute hieß bereit = Antrag vollständig + erste Zahlung. Die Akte zeigte
  // deshalb bei Gekündigten „erfüllt alle Bedingungen“ und den Knopf, den die
  // Mail-Tür dann mit „Vertrag beendet“ ablehnte (Person 3809, 06.10.). Jetzt
  // gilt dieselbe Ausschlussregel wie für Automatik und Liste — für den
  // Menschen mit der Ausnahme aus Justins Entscheidung (gekündigt, Vertrag läuft).
  const pruefung = (await einladungPruefen([personId], { mitPhase: true }).catch(() => [] as EinladungPruefung[]))[0] ?? null;
  const ausschluss = pruefung ? karteAusschluss(pruefung.flags, "mensch") : null;
  const ausschlussAutomatik = pruefung ? karteAusschluss(pruefung.flags, "automatik") : null;
  const toreOk = offen.length === 0;

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
    bereit: toreOk && !ausschluss,
    tore,
    esFehlt: !toreOk ? offen.map((t) => t.fehlt).filter(Boolean).join(" · ")
      : ausschluss ? ausschluss.text : null,
    ausschluss,
    ausschlussAutomatik,
    hinweis: pruefung && !ausschluss ? karteHandHinweis(pruefung.flags) : null,
    kundeSatz: pruefung ? karteKundeSatz(pruefung.flags) : null,
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
      auskunftVorhanden: !!(r.schufa_bezahlt || r.schufa_eigene),
      // Der Treiber liefert DATE als Date-Objekt; String() davon ist „Tue Sep 29 …“ —
      // daraus wurde in der Akte „29.9.2001“. Deshalb Jahr-Monat-Tag von Hand.
      naechsteRateAm: r.naechste_rate_am instanceof Date
        ? `${r.naechste_rate_am.getFullYear()}-${String(r.naechste_rate_am.getMonth() + 1).padStart(2, "0")}-${String(r.naechste_rate_am.getDate()).padStart(2, "0")}`
        : r.naechste_rate_am ? String(r.naechste_rate_am).slice(0, 10) : null,
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
// ── E-IT-B (08.10.2026): KEIN AUSGESCHLOSSENER IN DER LISTE ─────────────────
// Diese Funktion speist die Liste in Schreibtisch und Bestand und die Automatik.
// Sie prüfte nur die Tore — die Ausschlüsse kannte nur die Automatik. Seit E-206
// lädt die Automatik alle Nicht-Ausgeschlossenen binnen Minuten ein; „noch ohne
// Einladung“ ließ deshalb fast nur Ausgeschlossene übrig (07.10.: 107 Gekündigte
// und 3 Testkonten von 110). Jetzt filtert dieselbe Regel in derselben Abfrage
// (karteAusschlussSql, Reihenfolge aus shared/fiaon-karten-weg.ts).
// `mitAusgeschlossenen: true` nur für Prüfstände und Messungen.
export async function bereiteKunden(
  opt: { agentId?: number | null; ohneVersand?: boolean; grenze?: number; mitAusgeschlossenen?: boolean } = {},
  lauf: Lauf = sqlPool,
): Promise<{ personId: number; name: string; agentId: number | null }[]> {
  await ensureKartenTabelle(lauf);
  await schufaTabelleSicher();
  await globalKundeBereit(); // die Ausschlussregel liest fiaon_global_angebote (E-272)
  const bedingungen: string[] = ["p.merged_into_person_id IS NULL"];
  const werte: any[] = [];
  if (opt.agentId) { werte.push(opt.agentId); bedingungen.push(`p.assigned_agent_id = $${werte.length}`); }

  const zeilen = (await lauf.unsafe(
    `SELECT x.*, TRIM(COALESCE(pp.first_name,'') || ' ' || COALESCE(pp.last_name,'')) AS name,
            pp.assigned_agent_id
     FROM (${STAND_SQL} WHERE ${bedingungen.join(" AND ")}) x
     JOIN fiaon_persons pp ON pp.id = x.person_id
     WHERE x.antrag_voll AND x.paket_bezahlt
       AND x.raten_bezahlt >= ${KARTE_MIN_RATEN}
     ${opt.ohneVersand ? "AND NOT EXISTS (SELECT 1 FROM fiaon_konto_karte k WHERE k.person_id = x.person_id AND k.kanal <> 'gemeldet')" : ""}
     ${opt.mitAusgeschlossenen ? "" : `AND ${karteAusschlussSql("x.person_id")} IS NULL`}
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINLADUNG IST VERTRAGSLEISTUNG, KEINE WERBUNG (02.10.2026, E-275)
//
// Justin: „Mara soll selbst verkaufen … Hi, zahl die Aktivierung, die Karte
// geht zeitnah in Produktion — also: Jetzt zahlen! … nicht immer sagen ‚Ich
// mache einen Termin mit XY‘ oder ‚Wir sind keine Bank und können nichts
// wissen‘. Mara soll positiv, verkäuferisch und selbstständig agieren.“
//
// ── DER ANLASS (Postmeister-Fall 6120, 02.10.2026) ─────────────────────────
// Satpal Jhim (Person 4816) hat am 02.08. FIAON Ultra bezahlt und fragt seit dem
// 03.09. nach seiner Karte („I have not your kaditkarte“). Den Link der
// Partnerbank hat er NIE bekommen: Am 09.09. setzte der Postmeister eine
// Werbesperre (Mail 3644: Text nur „Sent from Yahoo Mail for iPhone“ und ein
// Bild, aber im eigenen Betreff „… bitte not again send me e mail for rattan
// ok“ — ein echter Wunsch, die Sperre war richtig; E-275 Gegenprüfung) — und
// die Automatik unten schloss jede Werbesperre aus, auch für die Leistung. Maras
// Antwort konnte deshalb nur lauten „die Karte verschickt die Bank … ich habe
// Herrn Boychenko gebeten“. Ein Werkzeug, den Link selbst zu schicken, gab es
// nicht.
//
// ── DIE REGEL AB HEUTE ─────────────────────────────────────────────────────
// Der Link der Partnerbank ist das, wofür ein Stufenpaket-Kunde bezahlt hat —
// Vertragsleistung, keine Werbung. Die Werbesperre („Stopp“, „aus allen
// Verteilern“) gilt für Verkauf und Rückholung, nicht für die Leistung aus
// seinem Vertrag (dieselbe Lesart wie ZAHLUNGSPOST in fiaon-mail-frequenz.ts).
// Sie schließt deshalb NICHT mehr aus. Ausschluss bleiben: Testkonto,
// Vertriebssperre (is_blocked), Einstufung −1, Kunde von FIAON Global (E-272),
// Kündigung des Stufenpakets (nicht die einer Bonitätsauskunft — E-275 Nachtrag)
// oder DSGVO-Löschung (Kündigung ist eine Übergabe an einen Menschen —
// Regel „offene Rechnung vor Kündigung“), Storno aus der Telefonkartei, keine
// E-Mail-Adresse. EINE Liste für die Automatik UND für Mara
// (einladungPruefen) — zwei Fassungen würden beim nächsten Umbau auseinanderlaufen.
//
// ── DIE MAIL-TÜR LÄSST SIE DURCH (geprüft 02.10.2026) ──────────────────────
// mailSenden gibt immer einen Auslöser mit (akteur.name → ausgeloestVon), und
// versendenUndProtokollieren macht daraus „manuell“ (fiaon-mail-log.ts, E-168).
// An der Tür (darfAnEmpfaenger, fiaon-mail-frequenz.ts) gilt für manuell keine
// Werbesperre; es bleiben sperrUrteil (NUR_BIS_VERTRAGSENDE: Testkonto,
// Vertrag beendet), die Wand der Privatlinie für Global-Kunden (make-webhook.ts)
// und die Zustandsregel (fiaon-versand.ts: is_blocked, DSGVO, ohne Adresse,
// unbezahlt). Gemessen in der Produktion: 0 Einladungen je an der Werbesperre
// gescheitert, zwei Handversände an Menschen mit Werbesperre gingen durch. An
// der Tür war deshalb nichts zu ändern — die Sperre saß nur hier.
//
// ── WAS ES BEWIRKT (Produktion lesend, 02.10.2026) ─────────────────────────
// 115 Menschen sind bereit (Antrag vollständig, Paket bezahlt) und haben noch
// keine Einladung; 27 davon mit Werbesperre. 22 dieser 27 haben wirksam
// gekündigt (bleibt Ausschluss), fünf bekommen die Einladung jetzt beim
// nächsten Takt: 3289, 4816 (Satpal Jhim), 4820, 6944, 12320.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Mensch aus Sicht der Einladung: wer betreut, und ob etwas den Versand ausschließt. */
export interface EinladungPruefung {
  personId: number;
  betreuerId: number | null;
  betreuerName: string | null;
  /** E-IT-B: die Felder der einen Regel (shared/fiaon-karten-weg.ts, karteAusschluss). */
  flags: KarteFlags;
  /** Warum keine Einladung für Automatik und Mara — null, wenn sie gehen darf. Für Akte und Mara (intern). */
  sperre: string | null;
  /** Der Grund als Code (Zweck „automatik“) — null, wenn sie gehen darf. */
  sperreCode: KarteAusschlussCode | null;
  /** Die Bestellung der wirksamen Kündigung (für das Vertragsende) — null ohne Kündigung. */
  kuendigungRef: string | null;
  /** In den letzten 24 Stunden gescheitert — nur die Automatik wartet dann. */
  fehlschlag24h: boolean;
  /** Nur zur Auskunft: Werbesperre gesetzt (seit E-275 kein Ausschluss mehr). */
  werbesperre: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSSCHLUSSREGEL IN SQL — DIESELBE REIHENFOLGE WIE IN TYPESCRIPT (E-IT-B)
//
// Die Reihenfolge und die Sätze stehen in shared/fiaon-karten-weg.ts
// (KARTE_AUSSCHLUSS_REIHENFOLGE). Hier stehen nur die Prädikate — die
// Server-Bausteine (Global, Produktkategorie, Kündigungsregel) gibt es in
// shared/ nicht. Das CASE wird aus der Reihenfolge GEBAUT, nicht abgeschrieben:
// Ein neuer Grund in shared/ ohne Prädikat hier wirft beim ersten Aufruf.
// Für Listen und Automatik gilt jede wirksame Kündigung (Zweck „automatik“);
// die Ausnahme „gekündigt, Vertrag läuft — von Hand erlaubt“ braucht das
// Vertragsende aus der Ratenkette und steht deshalb nur in TypeScript.
// Der Prüfstand scripts/pruef-it-b.ts vergleicht beide Fassungen.
// ═══════════════════════════════════════════════════════════════════════════
const KARTE_PRAEDIKAT: Record<Exclude<KarteAusschlussCode, "vertrag_beendet">, (p: string) => string> = {
  test: (p) => `EXISTS (SELECT 1 FROM fiaon_persons ka_t WHERE ka_t.id = ${p} AND ka_t.ist_test_am IS NOT NULL)`,
  vertriebssperre: (p) => `EXISTS (SELECT 1 FROM fiaon_persons ka_v WHERE ka_v.id = ${p} AND COALESCE(ka_v.is_blocked, FALSE))`,
  stufe_minus1: (p) => `EXISTS (SELECT 1 FROM fiaon_persons ka_s WHERE ka_s.id = ${p} AND COALESCE(ka_s.priority_tier, 0) = -1)`,
  global: (p) => globalKundeSql(p),
  dsgvo: (p) => `EXISTS (SELECT 1 FROM fiaon_applications ka_d WHERE ka_d.person_id = ${p} AND ka_d.merged_into IS NULL AND ka_d.gdpr_deleted_at IS NOT NULL)`,
  gekuendigt: (p) => KUENDIGUNG_WIRKSAM_SQL(p),
  storniert: (p) => `EXISTS (SELECT 1 FROM fiaon_telefonkartei_storno ka_st WHERE ka_st.person_id = ${p} AND ka_st.zurueck_am IS NULL)`,
  ohne_email: (p) => `NOT (EXISTS (SELECT 1 FROM fiaon_persons ka_e WHERE ka_e.id = ${p} AND COALESCE(ka_e.primary_email, '') <> '')
      OR EXISTS (SELECT 1 FROM fiaon_applications ka_ea WHERE ka_ea.person_id = ${p} AND COALESCE(ka_ea.email, '') <> ''))`,
};

/** Der erste Ausschlussgrund (Zweck „automatik“) als Code oder NULL — für Listen und die Automatik. */
export function karteAusschlussSql(person: string): string {
  const zweige = KARTE_AUSSCHLUSS_REIHENFOLGE.map((code) => {
    const pr = (KARTE_PRAEDIKAT as Record<string, ((p: string) => string) | undefined>)[code];
    if (!pr) throw new Error(`[KARTE] Ausschlussgrund ohne SQL-Prädikat: ${code}`);
    return `WHEN ${pr(person)} THEN '${code}'`;
  });
  return `(CASE ${zweige.join("\n      ")} ELSE NULL END)`;
}

/**
 * Die Adresse, an die eine Mail an diesen Menschen ginge — in SQL. Dieselbe
 * Wahl wie payloadFuer (fiaon-mail-senden.ts): Hauptadresse der Person, sonst
 * die der jüngsten lebenden Bestellung. Für Listen und die Automatik; der
 * einzelne Versand fragt die echte Nutzlast (karteEmpfaenger).
 */
export const ZIEL_ADRESSE_SQL = (p: string): string => `LOWER(TRIM(COALESCE(
  (SELECT NULLIF(za_p.primary_email, '') FROM fiaon_persons za_p WHERE za_p.id = ${p}),
  (SELECT NULLIF(COALESCE(za_a.email, za_a.contact_email, za_a.billing_email), '') FROM fiaon_applications za_a
    WHERE za_a.person_id = ${p} AND za_a.merged_into IS NULL ORDER BY za_a.created_at DESC LIMIT 1), '')))`;

/**
 * Kommt an diese Adresse nichts an (gesperrt, Spam, endgültiger Rückläufer)? boolean.
 * Gegenprüfung 08.10.2026: Ein WEICHER Rückläufer (Postfach voll, Kontingent,
 * Zeitüberschreitung, Greylisting) ist kein Problem der Adresse — dieselbe Regel
 * wie zustellProblem in TypeScript (ZUSTELL_PROBLEM_SQL, shared/fiaon-karten-weg.ts).
 */
export const ADRESSE_PROBLEM_SQL = (p: string): string => `COALESCE((SELECT ${ZUSTELL_PROBLEM_SQL("za_m.zustellung", "za_m.zustellung_grund")}
  FROM fiaon_mail_log za_m
  WHERE za_m.person_id = ${p} AND LOWER(TRIM(za_m.empfaenger)) = ${ZIEL_ADRESSE_SQL(p)}
    AND za_m.status = 'versandt' AND COALESCE(za_m.art, 'echt') = 'echt'
    AND za_m.zustellung IS NOT NULL AND za_m.zustellung <> 'angenommen'
    AND za_m.created_at > NOW() - INTERVAL '90 days'
  ORDER BY za_m.created_at DESC LIMIT 1), FALSE)`;

/**
 * Die Ausschlüsse der Einladung — EINE Abfrage für die Automatik, Mara, die
 * Akte (kartenStand) und den erneuten Versand. Nur Köpfe
 * (merged_into_person_id IS NULL); wer kein Kopf ist, fehlt im Ergebnis.
 *
 * E-IT-B (08.10.2026): Die Felder gehen an die eine Regel in
 * shared/fiaon-karten-weg.ts (karteAusschluss) — vorher stand hier eine eigene
 * Kette von Sätzen, die nur Automatik und Mara kannten. „gekuendigt“ ist die
 * Regel aus shared/fiaon-kuendigung-regel.ts (nur das STUFENPAKET, nicht die
 * Bonitätsauskunft — E-275 Nachtrag; ein neuer bezahlter Vertrag schlägt die
 * alte Kündigung). `mitPhase` rechnet für Gekündigte das Vertragsende
 * (vertragsendeLesen) — nur der Mensch in der Akte braucht es.
 */
async function einladungPruefen(ids: number[], opt: { mitPhase?: boolean } = {}): Promise<EinladungPruefung[]> {
  const liste = Array.from(new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (!liste.length) return [];
  await globalKundeBereit(); // E-272: die Abfrage liest fiaon_global_angebote
  // Immer über den Pool, auch wenn der Aufrufer in einer Transaktion steht: Die Bausteine unten sind Pool-Fragmente,
  // und die Ausschlüsse hängen an keiner Zeile, die der Aufrufer gerade schreibt.
  const zeilen = (await sqlPool`
    SELECT p.id, p.assigned_agent_id, ag.name AS agent_name,
           (p.ist_test_am IS NOT NULL) AS test,
           COALESCE(p.is_blocked, FALSE) AS vertriebssperre,
           (COALESCE(p.priority_tier, 0) = -1) AS ausgeschlossen,
           -- E-272 (02.10.2026): nie an einen Kunden von FIAON Global (Angebot oder Global-Auftrag,
           -- kein bezahltes Stufenpaket). Justin: „nehme ihn bitte komplett aus den Workflows … Er soll
           -- Global bleiben, also keine unnötigen Mails“. Seit paket_bezahlt oben nur Privatpakete zählt,
           -- ist er dort praktisch nie bereit — diese Spalte hält es fest, auch wenn sich dort etwas ändert.
           ${sqlPool.unsafe(globalKundeSql("p.id"))} AS global,
           (COALESCE(p.primary_email, '') <> '' OR EXISTS (
              SELECT 1 FROM fiaon_applications ae WHERE ae.person_id = p.id AND COALESCE(ae.email, '') <> '')) AS hat_email,
           -- DSGVO-Löschung gilt an jeder lebenden Bestellung — ein eigener Grund, keine Kündigung (E-IT-B).
           EXISTS (SELECT 1 FROM fiaon_applications ad WHERE ad.person_id = p.id AND ad.merged_into IS NULL
                    AND ad.gdpr_deleted_at IS NOT NULL) AS dsgvo,
           -- E-IT-B (08.10.2026): „wirksam gekündigt“ aus der EINEN Regel (shared/fiaon-kuendigung-regel.ts). Vorher stand
           -- hier eine eigene Lesart (Kategorie konto, aber ohne „neuer Vertrag schlägt alte Kündigung“).
           ${sqlPool.unsafe(KUENDIGUNG_WIRKSAM_SQL("p.id"))} AS gekuendigt,
           ${sqlPool.unsafe(KUENDIGUNG_AM_SQL("p.id"))} AS gekuendigt_am,
           (SELECT ak.ref FROM fiaon_applications ak WHERE ak.person_id = p.id AND ${sqlPool.unsafe(KUENDIGUNG_BESTELLUNG_SQL("ak"))}
             ORDER BY ak.gekuendigt_am DESC LIMIT 1) AS kuendigung_ref,
           EXISTS (SELECT 1 FROM fiaon_telefonkartei_storno st WHERE st.person_id = p.id AND st.zurueck_am IS NULL) AS storniert,
           -- Gescheitert (kaputte Adresse, Ablehnung)? 24 Stunden Ruhe statt alle fünf Minuten ein neuer Versuch.
           EXISTS (SELECT 1 FROM fiaon_mail_log ml WHERE ml.person_id = p.id AND ml.event = 'konto_karte_einladung'
                    AND ml.status <> 'versandt' AND ml.created_at > NOW() - INTERVAL '24 hours') AS fehlschlag,
           -- E-275: nur noch zur Auskunft im Protokoll — die Werbesperre schließt die Einladung nicht mehr aus.
           (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE p.id = ANY(${liste}) AND p.merged_into_person_id IS NULL
     ORDER BY p.id`) as any[];
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const aus: EinladungPruefung[] = [];
  for (const z of zeilen) {
    const flags: KarteFlags = {
      test: !!z.test, vertriebssperre: !!z.vertriebssperre, stufeMinus1: !!z.ausgeschlossen,
      global: z.global ? true : false, dsgvo: !!z.dsgvo, gekuendigt: !!z.gekuendigt,
      gekuendigtAm: z.gekuendigt && z.gekuendigt_am ? new Date(z.gekuendigt_am).toISOString() : null,
      storniert: !!z.storniert, hatEmail: !!z.hat_email,
    };
    // Die Phase nur, wo ein Mensch fragt — sie braucht die Ratenkette (vertragsendeLesen, Abrechnungsmonat).
    if (opt.mitPhase && flags.gekuendigt && z.kuendigung_ref) {
      try {
        const { vertragsendeLesen } = await import("./fiaon-kuendigung");
        const lage = await vertragsendeLesen(String(z.kuendigung_ref));
        flags.vertragEnde = lage.ende;
        flags.phase = kuendigungPhase(true, lage.ende, heute);
      } catch (e: any) {
        // Ohne Vertragsende im Zweifel die engere Lesart: wie für die Automatik gesperrt.
        console.error("[KARTE] Vertragsende nicht lesbar:", e?.message || e);
        flags.phase = "beendet";
      }
      // Gegenprüfung 08.10.2026: Die Mail-Tür (sperrUrteil, NUR_BIS_VERTRAGSENDE) liest das Vertragsende aus
      // vertrag_ende_am, die Phase oben aus dem Abrechnungsmonat. Liegt vertrag_ende_am schon zurück, lehnt die Tür
      // jede Einladung mit „Vertrag beendet“ ab — auch von Hand. Die Akte bot trotzdem den Knopf an (11288, 8078 —
      // Fall 3809 kehrte zurück; meist eine Kulanz-Kündigung „sofort beendet“). Eine Lesart für Knopf und Tür: Hier
      // fällt DASSELBE Urteil wie an der Tür — dieselben Menschen hinter derselben Adresse (personenAnAdresse), dieselbe
      // Funktion (sperrUrteil, von Hand). Sperrt die Tür, ist der Vertrag für die Akte beendet, mit dem Tag der Tür.
      if (flags.phase !== "beendet") {
        try {
          const tuer = await import("./fiaon-mail-frequenz");
          const adresse = await karteEmpfaenger(Number(z.id)).catch(() => null);
          const staende = adresse ? await tuer.personSperren(await tuer.personenAnAdresse(adresse)) : [];
          if (staende.length && tuer.sperrUrteil("konto_karte_einladung", staende, { manuell: true })) {
            flags.phase = "beendet";
            const [e] = (await sqlPool`SELECT vertrag_ende_am FROM fiaon_applications WHERE ref = ${String(z.kuendigung_ref)}`) as any[];
            flags.vertragEnde = e?.vertrag_ende_am
              ? new Date(e.vertrag_ende_am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null;
          }
        } catch (e: any) {
          console.error("[KARTE] Mail-Tür nicht lesbar:", e?.message || e);
          flags.phase = "beendet";
        }
      }
    }
    const a = karteAusschluss(flags, "automatik");
    aus.push({
      personId: Number(z.id),
      betreuerId: z.assigned_agent_id ? Number(z.assigned_agent_id) : null,
      betreuerName: z.agent_name ?? null,
      flags,
      sperre: a ? a.text : null,
      sperreCode: a ? a.code : null,
      kuendigungRef: z.kuendigung_ref ? String(z.kuendigung_ref) : null,
      fehlschlag24h: !!z.fehlschlag,
      werbesperre: !!z.werbesperre,
    });
  }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// KOMMT DIE MAIL AN? — DIE ZUSTELLLAGE EINER ADRESSE (E-IT-B, 08.10.2026)
//
// Gemessen 07.10.: 47 von 366 Eingeladenen bekamen die Einladung NIE — 43,
// weil ihre Adresse bei Brevo schon VOR der Einladung gesperrt war. Jeder
// weitere Versand an eine solche Adresse blieb ohne Wirkung (Automatik 0 von
// 40, Mara 0 von 4, Mitarbeiter 0 von 3), und Mara schrieb dazu „schauen Sie
// im Spam-Ordner nach“. Justin, 08.10.: Eine Brevo-Sperre wird NICHT
// automatisch aufgehoben — der Grund steht in der Akte, der Mitarbeiter prüft
// die Adresse mit dem Kunden und ändert sie.
// Deshalb fragt JEDER Weg der Einladung (Automatik, Mara, Knopf, erneut)
// vorher: Was ist aus der letzten Mail an GENAU diese Adresse geworden? Ist
// es „gesperrt“, „abgewiesen“ oder „Spam“, geht nichts raus — auch nicht über
// die Mail-Tür, die bei Rückläufern sonst still entsperren würde.
// ═══════════════════════════════════════════════════════════════════════════
export interface ZustellLage {
  /** Der letzte aussagekräftige Zustand an dieser Adresse (zugestellt … gesperrt). */
  zustellung: string;
  text: string;
  am: string | null;
  /** Die Antwort des Postfachs (Rückläufer) oder Brevos Sperrgrund — null, wenn unbekannt. */
  grund: string | null;
  problem: boolean;
  /** Gegenprüfung 08.10.: weicher Rückläufer (Postfach voll …), Brevo sperrt nicht — erneut senden erlaubt. */
  weich?: boolean;
  /** Gegenprüfung 08.10.: Brevos Sperrgrund (unsubscribedViaEmail, hardBounce …) — null, wenn unbekannt. */
  sperrCode?: string | null;
  /** Was der Mitarbeiter tun kann (karteAdresseHinweis) — nur bei einem Problem. */
  hinweis?: string | null;
  /** Darf er die Leitung bitten, die Sperre von Hand zu prüfen (Abmeldung, Spam, Sperre — nicht beim Rückläufer)? */
  leitungPruefen?: boolean;
}

/** Die Adresse, an die mailSenden JETZT schicken würde — dieselbe Funktion wie der Versand. */
export async function karteEmpfaenger(personId: number): Promise<string | null> {
  const { empfaengerFuer } = await import("./fiaon-mail-senden");
  const a = String((await empfaengerFuer(personId)) ?? "").trim();
  return a || null;
}

/** Was aus der letzten Mail an diese Adresse wurde (nur dieser Mensch, 90 Tage). null = nichts Aussagekräftiges. */
export async function zustellLage(personId: number, adresse: string | null, lauf: Lauf = sqlPool): Promise<ZustellLage | null> {
  const a = String(adresse ?? "").trim().toLowerCase();
  if (!a) return null;
  const [z] = (await lauf`
    SELECT zustellung, zustellung_am, zustellung_grund, created_at FROM fiaon_mail_log
     WHERE person_id = ${personId} AND LOWER(TRIM(empfaenger)) = ${a}
       AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
       AND zustellung IS NOT NULL AND zustellung <> 'angenommen'
       AND created_at > NOW() - INTERVAL '90 days'
     ORDER BY created_at DESC LIMIT 1`.catch(() => [] as any[])) as any[];
  if (!z) return null;
  const zustellung = String(z.zustellung);
  let grund: string | null = z.zustellung_grund ? String(z.zustellung_grund).replace(/\s+/g, " ").slice(0, 200) : null;
  // Gegenprüfung 08.10.2026: Ein WEICHER Rückläufer (Postfach voll, Kontingent, Zeitüberschreitung, Greylisting)
  // sperrte die Adresse 90 Tage — obwohl sie stimmt. Er gibt den erneuten Versand frei, aber nur, wenn Brevo die
  // Adresse nachweislich NICHT sperrt (sonst höbe die Mail-Tür beim Handversand eine Sperre auf). Im Zweifel: Problem.
  let problem = zustellProblem(zustellung, z.zustellung_grund ?? "");
  let weich = false;
  if (!problem && zustellProblem(zustellung)) {
    const { brevoGesperrt } = await import("./fiaon-brevo");
    const gesperrt = await brevoGesperrt(a).catch(() => null);
    if (gesperrt === false) weich = true; else problem = true;
  }
  let sperrCode: string | null = null;
  let aufgehoben = false;
  if (problem) {
    // Gesperrt: Den Grund kennt nur Brevo (Sperrliste). Ohne Schlüssel oder bei einer Störung: kein Grund — ehrlich leer.
    // Gegenprüfung 08.10.: Der Code entscheidet, was der Mitarbeiter tun kann (abgemeldet → Leitung, nicht „andere Adresse“).
    const { brevoSperrGrund, brevoGesperrt } = await import("./fiaon-brevo");
    const g = await brevoSperrGrund(a).catch(() => null);
    if (g) { sperrCode = g.code; if (!grund) grund = BREVO_SPERRGRUND_TEXT[g.code] ?? g.text ?? g.code; }
    // Eine SPERRE (gesperrt, Spam), die nachweislich nicht mehr auf Brevos Sperrliste steht, hat die Leitung von Hand
    // aufgehoben („An die Leitung: Sperre prüfen“) — dann geht der Link wieder. Wir heben selbst nie etwas auf; ein
    // endgültiger Rückläufer (Postfach gibt es nicht) bleibt ein Problem, egal was Brevo sagt.
    else if (zustellung === "blockiert" || zustellung === "spam") {
      if ((await brevoGesperrt(a).catch(() => null)) === false) { problem = false; aufgehoben = true; }
    }
  }
  return {
    zustellung, text: weich ? KARTE_ZUSTELL_WEICH_TEXT : aufgehoben ? KARTE_SPERRE_AUFGEHOBEN_TEXT : KARTE_ZUSTELL_TEXT[zustellung] ?? zustellung,
    am: z.zustellung_am ? new Date(z.zustellung_am).toISOString() : z.created_at ? new Date(z.created_at).toISOString() : null,
    grund, problem, weich, sperrCode,
    hinweis: problem ? karteAdresseHinweis(zustellung, sperrCode) : null,
    leitungPruefen: karteSperreLeitungMoeglich(zustellung, problem),
  };
}

/**
 * Menschen, deren Einladung gerade unterwegs ist — Automatik und Mara laufen im
 * selben Prozess. Ohne diese Marke schickten ein Takt und eine Mara-Antwort im
 * selben Augenblick zwei Mails (der „zweite Blick“ in die Tabelle kommt für den
 * Parallelfall zu spät: Die Zeile entsteht erst NACH dem Versand).
 */
const imVersand = new Set<number>();

/**
 * E-IT-B (08.10.2026): Der Erstversand über den Knopf in der Akte nimmt dieselbe
 * Marke — Doppelklick oder Takt im selben Augenblick ergaben sonst zwei Mails und
 * zwei Zeilen (zweimal 10 € vorgemerkt). null = gerade unterwegs; sonst die Freigabe.
 */
export function karteVersandSperre(personId: number): (() => void) | null {
  if (imVersand.has(personId)) return null;
  imVersand.add(personId);
  return () => { imVersand.delete(personId); };
}

/**
 * Schickt die ERSTE Einladung (Mail „Ihr Link zur Karte ist da“) und hält sie
 * fest: neue Zeile in fiaon_konto_karte (10 € für den Betreuer, E-067).
 *
 * E-IT-B (08.10.2026): Der erneute Versand ist hier HERAUSGENOMMEN. Er rückte
 * gesendet_am auf jetzt — der Tag des Erstversands ging verloren, und die Akte
 * las „geschickt am“ als „zuletzt“. Jeder erneute Versand (Akte, Mara,
 * Verwaltung) geht jetzt über karteEinladungErneut (unten): dieselbe Zeile,
 * derselbe Link, eigene Spalten für „zuletzt erneut“, Drossel, Protokoll.
 */
async function einladungSchicken(ein: {
  personId: number; betreuerId: number | null; betreuerName: string | null;
  akteurName: string; notiz: string; verlauf: string;
  /** Name im Kundenverlauf (fiaon_contact_log.agent_name) — die Automatik heißt dort seit E-206 „Automatik“. */
  verlaufVon?: string;
}): Promise<{ ok: boolean; grund: string | null }> {
  if (imVersand.has(ein.personId)) return { ok: false, grund: "Die Einladung ist in diesem Augenblick schon unterwegs." };
  imVersand.add(ein.personId);
  try {
    const { mailSenden } = await import("./fiaon-mail-senden");
    // akteur.name wird zu ausgeloestVon — die Tür behandelt die Leistungsmail damit wie einen
    // Handversand (keine Werbesperre, siehe Kopf E-275). rolle „admin“: wie bisher die Automatik.
    const erg = await mailSenden({
      event: "konto_karte_einladung",
      personId: ein.personId,
      zusatz: { partner_link: partnerLink(ein.personId, ein.betreuerId) },
      akteur: { name: ein.akteurName, agentId: null, rolle: "admin" as any },
    });
    if (!erg?.ok) return { ok: false, grund: String((erg as any)?.grund || (erg as any)?.meldung || "nicht gesendet") };
    await sqlPool`
      INSERT INTO fiaon_konto_karte (person_id, agent_id, agent_name, kanal, status, bonus_cents, notiz)
      VALUES (${ein.personId}, ${ein.betreuerId}, ${ein.betreuerName ?? "Automatik"}, 'mail', 'gesendet', ${KARTEN_BONUS_CENTS},
              ${ein.notiz})`;
    const [ap] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${ein.personId} AND merged_into IS NULL
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (ap) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, ref, created_at)
        VALUES (${ein.personId}, NULL, ${ein.verlaufVon ?? ein.akteurName}, 'system', ${ein.verlauf}, ${ap.ref}, NOW())`.catch(() => {});
    }
    return { ok: true, grund: null };
  } finally {
    imVersand.delete(ein.personId);
  }
}

/**
 * DIE EINLADUNG GEHT VON SELBST RAUS (21.09.2026, E-206)
 *
 * Justin: „Ab JETZT JEDER, der eine Rate bezahlt hat, kriegt den DKB-Link —
 * sofort an alle." Wer bereit ist (Antrag vollständig, erste Zahlung gebucht)
 * und noch keine Einladung hat, bekommt sie — dieselbe Mail und derselbe
 * Eintrag wie über den Knopf „Karte bestellen". Die 10 € je bestätigter
 * Eröffnung gehören seinem Betreuer (agent_id = Betreuer), nicht der Automatik.
 *
 * Nicht angeschrieben wird, wen einladungPruefen ausschließt (Testkonto,
 * Vertriebssperre, Einstufung −1, Global, Kündigung/DSGVO, Storno, keine
 * E-Mail). E-275 (02.10.2026): Die Werbesperre gehört nicht mehr dazu — der
 * Link ist Vertragsleistung (Kopf oben). Die Verwaltung kann Ausgeschlossene
 * weiter von Hand über die Akte senden.
 *
 * Gedrosselt: höchstens `grenze` Mails je Lauf, der Takt ruft alle fünf Minuten.
 */
export async function einladungenAutomatisch(grenze = 40): Promise<{ bereit: number; gesendet: number; fehler: string[] }> {
  await ensureKartenTabelle();
  const kandidaten = await bereiteKunden({ ohneVersand: true, grenze: 500 });
  if (!kandidaten.length) return { bereit: 0, gesendet: 0, fehler: [] };
  const geprueft = await einladungPruefen(kandidaten.map((k) => k.personId)).catch(() => [] as EinladungPruefung[]);
  // ── KEIN SOFORTBEGINN VERLANGT (E-282, 05.10.2026) ─────────────────────────
  // Wer im neuen Antrag den sofortigen Beginn NICHT verlangt hat, bekommt den Link
  // der Partnerbank (Vertrag § 3 Nr. 1) erst nach Ablauf der Widerrufsfrist — so
  // steht es in § 6 seines Vertrags. Dieser Takt holt ihn danach von selbst nach.
  const ids = geprueft.map((z) => z.personId);
  const inFrist = new Set<number>(ids.length ? ((await sqlPool`
    SELECT DISTINCT COALESCE(a.person_id, v.person_id) AS person_id
      FROM fiaon_vertragsannahmen v LEFT JOIN fiaon_applications a ON a.ref = v.ref
     WHERE (a.person_id = ANY(${ids}) OR v.person_id = ANY(${ids}))
       AND v.sofort_beginn = FALSE AND v.angenommen_am > NOW() - INTERVAL '15 days'
  `.catch(() => [])) as any[]).map((r) => Number(r.person_id)) : []);
  // ── E-IT-B (08.10.2026): KEINE MAIL AN EINE GESPERRTE ADRESSE ─────────────
  // War die letzte Mail an seine Adresse gesperrt, abgewiesen oder Spam, geht
  // die Einladung NICHT raus: Sie käme nicht an, und die Mail-Tür würde bei
  // einem Rückläufer die Brevo-Sperre still aufheben — das hat Justin am 08.10.
  // ausgeschlossen. Der Mensch steht stattdessen in „Konto & Karte — nachfassen“
  // unter „Mail kam nicht an“ (karteNachfassen), dort prüft ein Mitarbeiter die
  // Adresse mit ihm. EINE Abfrage für alle, VOR dem Deckel: Sonst könnten 40
  // Gesperrte jeden Takt die ersten Plätze belegen.
  const vorAdresse = geprueft.filter((z) => !z.sperre && !z.fehlschlag24h && !inFrist.has(z.personId));
  const adresseGesperrt = new Set<number>(vorAdresse.length ? ((await sqlPool.unsafe(
    `SELECT p.id FROM fiaon_persons p WHERE p.id = ANY($1::int[]) AND ${ADRESSE_PROBLEM_SQL("p.id")}`,
    [vorAdresse.map((z) => z.personId)],
  ).catch(() => [])) as any[]).map((r) => Number(r.id)) : []);
  const erlaubt = vorAdresse.filter((z) => !adresseGesperrt.has(z.personId));

  let gesendet = 0;
  let mitWerbesperre = 0;
  const fehler: string[] = [];
  for (const z of erlaubt.slice(0, Math.max(0, grenze))) {
    // Zweiter Blick direkt vor dem Senden — ein paralleler Knopfdruck darf keine zweite Mail auslösen.
    const [schon] = (await sqlPool`SELECT 1 AS da FROM fiaon_konto_karte WHERE person_id = ${z.personId} AND kanal <> 'gemeldet' LIMIT 1`) as any[];
    if (schon) continue;
    try {
      // Gegenprüfung 08.10.2026: Die Liste oben wertet einen WEICHEN Rückläufer (Postfach voll …) als zustellbar — SQL
      // kennt Brevos Sperrliste nicht. Vor dem Versand prüft deshalb dieselbe Funktion wie Knopf und Mara (zustellLage),
      // dass Brevo die Adresse nicht sperrt: Sonst höbe die Mail-Tür die Sperre still auf.
      const an = await karteEmpfaenger(z.personId).catch(() => null);
      const lage = an ? await zustellLage(z.personId, an).catch(() => null) : null;
      if (lage?.problem) continue;
      const erg = await einladungSchicken({
        personId: z.personId, betreuerId: z.betreuerId, betreuerName: z.betreuerName,
        akteurName: "Automatik (erste Rate)", verlaufVon: "Automatik",
        notiz: "Automatisch nach der ersten Zahlung (E-206)",
        verlauf: "Konto & Karte: Einladung der Partnerbank nach der ersten Zahlung automatisch geschickt.",
      });
      if (!erg.ok) { fehler.push(`${z.personId}: ${erg.grund}`); continue; }
      gesendet++;
      if (z.werbesperre) mitWerbesperre++;
    } catch (e: any) {
      fehler.push(`${z.personId}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  if (gesendet || fehler.length) {
    console.log(`[KARTE] Einladungen automatisch: ${gesendet} gesendet (${mitWerbesperre} davon mit Werbesperre, E-275), ${fehler.length} Fehler, ${erlaubt.length} bereit, ${adresseGesperrt.size} an gesperrter Adresse zurückgehalten`);
  }
  return { bereit: erlaubt.length, gesendet, fehler };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINLADUNG ERNEUT SENDEN — EIN WEG FÜR AKTE, MARA UND VERWALTUNG
// (E-IT-B (08.10.2026), IT-Feedback Punkt 2)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Seit E-206 lädt die Automatik binnen Minuten ein — praktisch jede Akte stand
// auf „Der Weg ist geschickt“, OHNE Knopf. Der einzige Weg, den Mitarbeiter je
// für „bitte noch einmal“ genutzt hatten (das allgemeine Sende-Menü), ist seit
// dem 18.09. nur noch für Admins offen, und davon gibt es im Team keinen. Der
// alte Erneut-Zweig des Knopfs hätte bei jedem Klick eine NEUE Zeile mit 10 €
// angelegt und den Link mit der Kennung des Klickenden gebaut (nie benutzt,
// 0 Doppelzeilen — der Fehler stand nur im Code). Mara schickte erneut mit
// eigener 60-Minuten-Sperre und rückte dabei gesendet_am vor.
//
// ── DIE ENTSCHEIDUNG (Justin, 08.10.2026) ─────────────────────────────────
// Jeder berechtigte Mitarbeiter in der Kundenakte; nur die bestehende
// Einladung (gleicher Link), kein neuer Vorgang; protokolliert (wer, wann, an
// welche Adresse); höchstens 3 je Kunde und Tag, mindestens 15 Minuten
// Abstand; Adresse und letzter Zustellstand sichtbar; KEIN automatisches
// Aufheben einer Brevo-Sperre; auch bei gekündigtem Paket mit laufendem
// Vertrag erlaubt (nur von Hand).
//
// ── WAS DIESE FUNKTION GARANTIERT ──────────────────────────────────────────
//   · Es entsteht NIE eine Zeile in fiaon_konto_karte. agent_id, agent_name,
//     bonus_cents, status und gesendet_am (= Erstversand) bleiben, wie sie
//     sind — die 10 € gehören weiter dem, dem sie gehörten (E-067).
//   · Der Link ist der ursprüngliche: partnerLink(Kopf, agent_id der Zeile).
//   · Drossel aus EINER Quelle (KARTE_ERNEUT, shared/fiaon-karten-weg.ts),
//     gezählt über alle versandten Einladungen des Tages (Berlin) — Akte, Mara,
//     Verwaltung und Automatik zusammen.
//   · Gegen Doppelklick, zweites Fenster und zweite Instanz: Die Zeile wird
//     vor dem Versand „beansprucht“ (zuletzt_erneut_am, bedingtes UPDATE —
//     nur EIN Aufruf gewinnt). Scheitert der Versand, wird der alte Wert
//     zurückgeschrieben. Keine Transaktion über den HTTP-Aufruf zu Brevo.
//   · An eine Adresse, an die zuletzt nichts ankam (gesperrt, abgewiesen,
//     Spam), geht nichts — mit Grund und dem Hinweis, die Adresse zu prüfen.
// ═══════════════════════════════════════════════════════════════════════════

export type KarteErneutQuelle = "akte" | "verwaltung" | "mara_wa" | "mara_post";

export interface KarteErneutAkteur {
  /** Mitarbeiter-ID — null für Mara und Verwaltung. */
  agentId: number | null;
  /** Steht im Mail-Protokoll (ausgeloest_von), in der Zeile und im Verlauf. */
  name: string;
  /** Rolle des Mitarbeiters (fiaon_agents.rolle) — für die Rollenliste der Vorlage. */
  rolle?: string | null;
  quelle: KarteErneutQuelle;
}

export type KarteErneutCode =
  | "ERNEUT_GESENDET" | "NICHT_GEFUNDEN" | "KEINE_EINLADUNG" | "KONTO_STEHT" | "GESPERRT" | "OHNE_ADRESSE"
  | "ADRESSE_GESPERRT" | "TAGESGRENZE" | "GERADE_ERST" | "UNTERWEGS" | "NICHT_GESENDET";

export interface KarteErneutErgebnis {
  ok: boolean;
  code: KarteErneutCode;
  /** Ein Satz für den Mitarbeiter (du-Form) — steht in der Meldung der Akte. */
  meldung: string;
  /** Die Adresse, an die es ging bzw. gegangen wäre — voll (nur für Berechtigte, die Akte zeigt sie ohnehin). */
  an: string | null;
  /** Wie viele Versände heute noch gehen (nach diesem). */
  heuteNoch: number;
  /** Frühestens wieder (ISO) — null, wenn sofort. */
  naechsterMoeglichAm: string | null;
  /** Bei ADRESSE_GESPERRT: was zuletzt passierte und warum. */
  zustell: ZustellLage | null;
}

const ROLLEN_DER_VORLAGE = new Set(["admin", "vertriebsleiter", "agent", "onboarding", "inkasso"]);

/** Berliner Mitternacht heute als Zeitpunkt (ISO) — für „heute“ in der Drossel. */
function berlinMitternacht(): string {
  const tag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const mittag = new Date(`${tag}T12:00:00Z`);
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(mittag);
  const versatz = Number(teile.find((x) => x.type === "hour")?.value ?? "12") - 12;
  return new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) - 1, Number(tag.slice(8, 10)), -versatz, 0, 0)).toISOString();
}

/** Wie oft heute schon, und wann zuletzt — über ALLE Auslöser (eine Zählung für Akte, Mara, Verwaltung). */
async function drosselStand(kopf: number): Promise<{ heute: number; zuletzt: Date | null }> {
  const [d] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE created_at >= ${berlinMitternacht()}::timestamptz)::int AS heute,
           MAX(created_at) AS zuletzt
      FROM fiaon_mail_log
     WHERE person_id = ${kopf} AND event = 'konto_karte_einladung' AND status = 'versandt'
       AND COALESCE(art, 'echt') = 'echt' AND created_at > NOW() - INTERVAL '2 days'`) as any[];
  return { heute: Number(d?.heute || 0), zuletzt: d?.zuletzt ? new Date(d.zuletzt) : null };
}

/** Der Kopf einer Person (zusammengeführte laufen auf ihn). */
async function kopfVon(personId: number): Promise<number> {
  const { KOPF_SQL } = await import("./fiaon-mail-frequenz");
  const [k] = (await sqlPool.unsafe(`SELECT ${KOPF_SQL("$1::int")} AS kopf`, [Number(personId)])) as any[];
  return Number(k?.kopf || personId);
}

/** Abhängigkeiten, die ein Prüfstand ersetzen darf (im Betrieb nie gesetzt). */
export interface KarteErneutHilfen {
  senden?: (ein: { event: string; personId: number; zusatz: Record<string, unknown>; akteur: { name: string; agentId: number | null; rolle: any } }) => Promise<{ ok: boolean; grund?: string | null; meldung?: string }>;
}

export async function karteEinladungErneut(
  personId: number, akteur: KarteErneutAkteur, hilfen: KarteErneutHilfen = {},
): Promise<KarteErneutErgebnis> {
  const leer = { an: null, heuteNoch: 0, naechsterMoeglichAm: null, zustell: null };
  const nein = (code: KarteErneutCode, meldung: string, mehr: Partial<KarteErneutErgebnis> = {}): KarteErneutErgebnis =>
    ({ ok: false, code, meldung, ...leer, ...mehr });
  if (!Number.isInteger(Number(personId)) || Number(personId) <= 0) return nein("NICHT_GEFUNDEN", "Kunde nicht gefunden.");
  await ensureKartenTabelle();
  const kopf = await kopfVon(Number(personId));

  // 1. Die bestehende Einladung. Ohne sie gibt es nichts „erneut“ — und es wird NIE eine angelegt.
  // zuletzt_erneut_am als TEXT: Ein JS-Datum kennt nur Millisekunden, die Datenbank Mikrosekunden — der
  // Vergleich beim Zurückgeben des Anspruchs (unten) träfe sonst nie (gefunden im Prüfstand, E-IT-B).
  const [zeile] = (await sqlPool`
    SELECT id, agent_id, agent_name, gesendet_am, zuletzt_erneut_am::text AS zuletzt_erneut_text, erneut_anzahl
      FROM fiaon_konto_karte WHERE person_id = ${kopf} AND kanal <> 'gemeldet'
     ORDER BY gesendet_am DESC LIMIT 1`) as any[];
  if (!zeile) return nein("KEINE_EINLADUNG", "Diesem Kunden wurde noch keine Einladung geschickt — es gibt nichts erneut zu senden.");

  // 2. Das Konto steht schon: kein Link mehr nötig, die Karte bucht er im Banking dazu.
  const konto = await kontoEroeffnung(kopf);
  if (konto.eroeffnet) return nein("KONTO_STEHT", `Das Girokonto ist schon eröffnet${konto.am ? ` (${konto.am})` : ""} — kein neuer Link nötig; die Karte bucht der Kunde im Banking dazu.`);

  // 3. Die eine Regel: Mensch (Akte, Verwaltung) mit der Ausnahme „gekündigt, Vertrag läuft“; Mara wie die Automatik.
  const zweck: KarteZweck = akteur.quelle === "akte" || akteur.quelle === "verwaltung" ? "mensch" : "mara";
  const [pr] = await einladungPruefen([kopf], { mitPhase: zweck === "mensch" });
  if (!pr) return nein("NICHT_GEFUNDEN", "Kunde nicht gefunden.");
  const aus = karteAusschluss(pr.flags, zweck);
  if (aus) return nein("GESPERRT", `Kein Kartenlink: ${aus.text}.`);

  // 4. Die Adresse — genau die, an die mailSenden schicken wird.
  const an = await karteEmpfaenger(kopf);
  if (!an) return nein("OHNE_ADRESSE", "Keine E-Mail-Adresse hinterlegt — erst unter „Daten“ eintragen.");

  // 5. Kommt dort etwas an? Sonst nicht senden und nichts entsperren (Justin, 08.10.).
  const lage = await zustellLage(kopf, an);
  if (lage?.problem) {
    return nein("ADRESSE_GESPERRT",
      `Nicht geschickt: An ${an} kam zuletzt nichts an (${lage.text}${lage.grund ? ` — ${lage.grund}` : ""}). ${lage.hinweis ?? karteAdresseHinweis(lage.zustellung, lage.sperrCode)}`,
      { an, zustell: lage });
  }

  // 6. Drossel: höchstens 3 am Tag, mindestens 15 Minuten Abstand — über alle Auslöser.
  const d = await drosselStand(kopf);
  const abstandMs = KARTE_ERNEUT.mindestAbstandMin * 60_000;
  if (d.heute >= KARTE_ERNEUT.maxProTag) {
    return nein("TAGESGRENZE", `Heute ging die Einladung schon ${d.heute}-mal raus — höchstens ${KARTE_ERNEUT.maxProTag} am Tag. Morgen wieder möglich.`, { an });
  }
  if (d.zuletzt && Date.now() - d.zuletzt.getTime() < abstandMs) {
    const ab = new Date(d.zuletzt.getTime() + abstandMs);
    return nein("GERADE_ERST", `Die Einladung ging eben erst raus (${zeitpunktBerlin(d.zuletzt)}) — wieder möglich ab ${zeitpunktBerlin(ab)}.`,
      { an, naechsterMoeglichAm: ab.toISOString(), heuteNoch: Math.max(0, KARTE_ERNEUT.maxProTag - d.heute) });
  }

  // 7. Die Zeile beanspruchen — nur EIN Aufruf gewinnt (Doppelklick, zweites Fenster, zweite Instanz).
  if (imVersand.has(kopf)) return nein("UNTERWEGS", "Die Einladung ist in diesem Augenblick schon unterwegs.", { an });
  const vorher: string | null = zeile.zuletzt_erneut_text ?? null;
  const [anspruch] = (await sqlPool`
    UPDATE fiaon_konto_karte SET zuletzt_erneut_am = NOW()
     WHERE id = ${Number(zeile.id)}
       AND (zuletzt_erneut_am IS NULL OR zuletzt_erneut_am < NOW() - (${KARTE_ERNEUT.mindestAbstandMin} * INTERVAL '1 minute'))
    RETURNING zuletzt_erneut_am::text AS anspruch`) as any[];
  if (!anspruch) return nein("GERADE_ERST", "Die Einladung wurde gerade eben schon erneut geschickt.", { an });
  const anspruchText = String(anspruch.anspruch);
  imVersand.add(kopf);
  try {
    // 8. Versand über die EINE Tür — derselbe Link wie beim Erstversand (Kennung des ursprünglichen Mitarbeiters).
    const rolle = akteur.agentId && ROLLEN_DER_VORLAGE.has(String(akteur.rolle || "")) ? String(akteur.rolle)
      : akteur.agentId ? "agent" : "admin";
    const senden = hilfen.senden ?? (await import("./fiaon-mail-senden")).mailSenden;
    const erg = await senden({
      event: "konto_karte_einladung", personId: kopf,
      zusatz: { partner_link: partnerLink(kopf, zeile.agent_id != null ? Number(zeile.agent_id) : null) },
      akteur: { name: akteur.name, agentId: akteur.agentId, rolle: rolle as any },
    });
    if (!erg?.ok) {
      // Zurück auf den alten Stand — nur, wenn niemand inzwischen weitergeschrieben hat.
      // Als TEXT vergleichen und zurückschreiben: Ein Parameter vom Typ timestamptz ginge durch den Treiber
      // (JS-Datum, Millisekunden) und träfe den gespeicherten Wert (Mikrosekunden) nie.
      await sqlPool`UPDATE fiaon_konto_karte SET zuletzt_erneut_am = (${vorher}::text)::timestamptz
                     WHERE id = ${Number(zeile.id)} AND zuletzt_erneut_am::text = ${anspruchText}::text`.catch((e) => {
        console.error("[KARTE] Anspruch nicht zurückgegeben:", e?.message || e);
      });
      return nein("NICHT_GESENDET", `Nicht geschickt: ${String(erg?.grund || erg?.meldung || "die Mail ging nicht raus")}`, { an });
    }

    // 9. Dieselbe Zeile fortschreiben — nie gesendet_am, agent_id, bonus_cents, status.
    const wo = akteur.quelle === "akte" ? "Akte" : akteur.quelle === "verwaltung" ? "Verwaltung"
      : akteur.quelle === "mara_wa" ? "Mara, WhatsApp" : "Mara, Postfach";
    const kurz = adresseKurz(an) ?? an;
    const jetzt = zeitpunktBerlin(new Date()) ?? "heute";
    await sqlPool`
      UPDATE fiaon_konto_karte
         SET erneut_anzahl = COALESCE(erneut_anzahl, 0) + 1, zuletzt_erneut_von = ${akteur.name},
             notiz = TRIM(BOTH E'\n' FROM COALESCE(notiz || E'\n', '') || ${`Erneut geschickt am ${jetzt} von ${akteur.name} (${wo}) an ${kurz} — derselbe Link (E-IT-B).`})
       WHERE id = ${Number(zeile.id)}`;
    const [ap] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${kopf} AND merged_into IS NULL
       ORDER BY created_at DESC LIMIT 1`) as any[];
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, ref, created_at)
      VALUES (${kopf}, ${akteur.agentId}, ${akteur.name}, 'system',
              ${`Konto & Karte: Link der Partnerbank erneut geschickt an ${kurz} (von ${akteur.name}, ${wo}) — dieselbe Einladung, derselbe Link, kein neuer Vorgang.`},
              ${ap?.ref ?? null}, NOW())`.catch(() => {});
    const heuteNoch = Math.max(0, KARTE_ERNEUT.maxProTag - (d.heute + 1));
    const ab = new Date(Date.now() + abstandMs);
    return {
      ok: true, code: "ERNEUT_GESENDET",
      meldung: `Erneut geschickt an ${an} — derselbe Link wie am ${tagBerlin(zeile.gesendet_am) ?? "Erstversand"}. `
        + (heuteNoch > 0 ? `Heute noch ${heuteNoch} möglich, frühestens ab ${zeitpunktBerlin(ab)}.` : "Für heute war das der letzte mögliche Versand.")
        + " Bitte den Kunden auch im Spam-Ordner nachsehen lassen.",
      an, heuteNoch, naechsterMoeglichAm: heuteNoch > 0 ? ab.toISOString() : null, zustell: lage,
    };
  } finally {
    imVersand.delete(kopf);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS DIE AKTE ÜBER DIE EINLADUNG ZEIGT (E-IT-B, 08.10.2026)
//
// Vorher: „Der Weg ist geschickt — am … von <Betreuer>“. „von <Betreuer>“
// stimmte bei 326 von 400 Versänden nicht (die Automatik schickt, die Zeile
// trägt den Betreuer, weil ihm die 10 € gehören). Adresse und Zustellung
// standen nirgends im Kasten. Jetzt: zuerst wann und von wem (aus dem
// Mail-Protokoll), zuletzt erneut, an welche Adresse, was daraus wurde (mit
// Grund), ob und wann wieder möglich — und jeder Versand im Verlauf.
// ═══════════════════════════════════════════════════════════════════════════
export interface KarteEinladungAkte {
  personId: number;
  eingeladen: boolean;
  zuerstAm: string | null;
  zuerstVon: string | null;
  zuletztAm: string | null;
  zuletztVon: string | null;
  /** Versandte Einladungsmails insgesamt. */
  anzahl: number;
  /** Davon erneut (Zeile, seit E-IT-B). */
  erneutAnzahl: number;
  /** Die Adresse, an die ein Versand JETZT ginge (voll). */
  empfaenger: string | null;
  /** Was aus der letzten Einladungsmail wurde. */
  zustellung: { code: string; text: string; am: string | null; grund: string | null; problem: boolean } | null;
  /** Was zuletzt an der aktuellen Adresse passierte (auch andere Mails) — Problem = nichts senden. */
  adresseLage: ZustellLage | null;
  kontoEroeffnet: boolean;
  /** Darf ein Mitarbeiter jetzt erneut senden? Sonst steht in `sperre`, warum. */
  darfErneut: boolean;
  sperre: string | null;
  /** Nur von Hand (gekündigt mit laufendem Vertrag, Einstufung −1, Storno) — der Satz neben dem Knopf. */
  hinweis: string | null;
  /** Gegenprüfung 08.10.: Die Adresse ist gesperrt (abgemeldet, Spam, Sperre) — Knopf „An die Leitung: Sperre prüfen“. */
  sperreLeitung: boolean;
  heuteNoch: number;
  naechsterMoeglichAm: string | null;
  verlauf: { am: string; von: string; status: string; zustellung: string | null; zustellText: string | null; problem: boolean; an: string | null }[];
}

/** Der Stand der Einladung für die Akte — nur lesend. null, wenn es den Menschen nicht gibt. */
export async function karteEinladungAkte(personId: number): Promise<KarteEinladungAkte | null> {
  if (!Number.isInteger(Number(personId)) || Number(personId) <= 0) return null;
  await ensureKartenTabelle();
  const kopf = await kopfVon(Number(personId));
  const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${kopf} AND merged_into_person_id IS NULL`) as any[];
  if (!p) return null;
  const [zeile] = (await sqlPool`
    SELECT id, agent_name, gesendet_am, zuletzt_erneut_am, zuletzt_erneut_von, erneut_anzahl
      FROM fiaon_konto_karte WHERE person_id = ${kopf} AND kanal <> 'gemeldet'
     ORDER BY gesendet_am DESC LIMIT 1`) as any[];
  const mails = (await sqlPool`
    SELECT created_at, status, zustellung, zustellung_am, zustellung_grund, empfaenger,
           COALESCE(NULLIF(ausgeloest_von, ''), 'Automatik') AS von
      FROM fiaon_mail_log
     WHERE person_id = ${kopf} AND event = 'konto_karte_einladung' AND COALESCE(art, 'echt') = 'echt'
     ORDER BY created_at DESC LIMIT 40`) as any[];
  const versandt = mails.filter((m) => String(m.status) === "versandt");
  const erste = versandt[versandt.length - 1] ?? null;
  const letzte = versandt[0] ?? null;
  const konto = await kontoEroeffnung(kopf);
  const [pr] = await einladungPruefen([kopf], { mitPhase: true });
  const aus = pr ? karteAusschluss(pr.flags, "mensch") : null;
  const empfaenger = await karteEmpfaenger(kopf).catch(() => null);
  const adresseLage = empfaenger ? await zustellLage(kopf, empfaenger) : null;
  const d = await drosselStand(kopf);
  const abstandMs = KARTE_ERNEUT.mindestAbstandMin * 60_000;
  const naechster = d.zuletzt && Date.now() - d.zuletzt.getTime() < abstandMs ? new Date(d.zuletzt.getTime() + abstandMs) : null;
  // Gegenprüfung 08.10.2026: „sie geht nach der ersten Zahlung automatisch raus“ stand bei JEDEM ohne Einladung —
  // auch bei Gekündigten, Gesperrten, Global-Kunden und Testkonten, während „Sein Antrag“ derselben Akte das
  // Gegenteil sagte. Jetzt zuerst der Ausschluss, dann der wahre Stand (kartenStand: was fehlt).
  let ohneEinladung: string | null = null;
  if (!zeile && !konto.eroeffnet && !aus && !adresseLage?.problem) {
    const autoAus = pr ? karteAusschluss(pr.flags, "automatik") : null;
    if (autoAus) ohneEinladung = `${autoAus.text}.`;
    else {
      const st = await kartenStand(kopf).catch(() => null);
      ohneEinladung = st && !st.bereit && st.esFehlt
        ? `Es fehlt noch: ${st.esFehlt}. Sobald alles steht, geht sie automatisch raus.`
        : "Alle Bedingungen sind erfüllt — sie geht mit dem nächsten Takt automatisch raus.";
    }
  }
  const sperre = konto.eroeffnet ? "Das Girokonto ist schon eröffnet — kein neuer Link nötig."
    : aus ? `Kein Kartenlink: ${aus.text}.`
    : !zeile && ohneEinladung ? ohneEinladung
    : !empfaenger ? "Keine E-Mail-Adresse hinterlegt — erst unter „Daten“ eintragen."
    : adresseLage?.problem ? `An ${empfaenger} kam zuletzt nichts an (${adresseLage.text}${adresseLage.grund ? ` — ${adresseLage.grund}` : ""}). ${adresseLage.hinweis ?? karteAdresseHinweis(adresseLage.zustellung, adresseLage.sperrCode)}`
    : d.heute >= KARTE_ERNEUT.maxProTag ? `Heute schon ${d.heute}-mal geschickt — höchstens ${KARTE_ERNEUT.maxProTag} am Tag. Morgen wieder möglich.`
    : naechster ? `Eben erst geschickt — wieder möglich ab ${zeitpunktBerlin(naechster)}.`
    : !zeile ? "Sie geht automatisch raus, sobald alles steht."
    : null;
  // Gegenprüfung 08.10.: Ein weicher Rückläufer heißt „vorübergehend abgewiesen“, nicht „nicht angekommen“.
  const zText = (z: unknown, g?: unknown) => (!z ? null
    : String(z) === "gebounct" && ruecklaeuferWeich(g) ? KARTE_ZUSTELL_WEICH_TEXT : KARTE_ZUSTELL_TEXT[String(z)] ?? String(z));
  return {
    personId: kopf,
    eingeladen: !!zeile,
    zuerstAm: erste?.created_at ? new Date(erste.created_at).toISOString() : zeile?.gesendet_am ? new Date(zeile.gesendet_am).toISOString() : null,
    zuerstVon: erste ? String(erste.von) : zeile?.agent_name ?? null,
    zuletztAm: letzte && letzte !== erste ? new Date(letzte.created_at).toISOString() : null,
    zuletztVon: letzte && letzte !== erste ? String(letzte.von) : null,
    anzahl: versandt.length,
    erneutAnzahl: Number(zeile?.erneut_anzahl || 0),
    empfaenger,
    zustellung: letzte ? {
      code: String(letzte.zustellung ?? "angenommen"), text: zText(letzte.zustellung ?? "angenommen", letzte.zustellung_grund)!,
      am: letzte.zustellung_am ? new Date(letzte.zustellung_am).toISOString() : null,
      grund: letzte.zustellung_grund ? String(letzte.zustellung_grund).replace(/\s+/g, " ").slice(0, 200) : null,
      // Gegenprüfung 08.10.: mit der Antwort des Postfachs — ein weicher Rückläufer ist kein Problem der Adresse.
      problem: zustellProblem(letzte.zustellung, letzte.zustellung_grund ?? ""),
    } : null,
    adresseLage,
    kontoEroeffnet: konto.eroeffnet,
    darfErneut: !sperre,
    sperre,
    hinweis: pr && !aus ? karteHandHinweis(pr.flags) : null,
    sperreLeitung: !konto.eroeffnet && !aus && !!adresseLage?.leitungPruefen,
    heuteNoch: Math.max(0, KARTE_ERNEUT.maxProTag - d.heute),
    naechsterMoeglichAm: naechster ? naechster.toISOString() : null,
    verlauf: mails.slice(0, 20).map((m) => ({
      am: new Date(m.created_at).toISOString(), von: String(m.von), status: String(m.status),
      zustellung: m.zustellung ? String(m.zustellung) : null, zustellText: zText(m.zustellung, m.zustellung_grund),
      problem: zustellProblem(m.zustellung, m.zustellung_grund ?? ""),
      an: adresseKurz(m.empfaenger),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// „AN DIE LEITUNG: SPERRE PRÜFEN“ (E-IT-B, Nachbesserung 08.10.2026)
//
// Gegenprüfung: 43 von 46 „Mail kam nicht an“ waren Sperren bei unserem
// Mailversand, überwiegend Abmelder — die Adresse stimmt. Die Akte bot nur
// „Adresse ändern“; nannte der Kunde dieselbe Adresse, gab es keinen Weg.
// Justin hat das AUTOMATISCHE Aufheben verboten, nicht das Aufheben auf
// ausdrücklichen Wunsch. Dieser Knopf legt deshalb eine Aufgabe für die
// Leitung an (Person, Adresse, Grund, Wunsch des Kunden, wer fragt) — sie
// prüft und hebt die Sperre in Brevo von Hand auf. Danach erkennt die Akte
// die aufgehobene Sperre (zustellLage) und „E-Mail erneut senden“ geht.
// Keine neue Chefseite: die Aufgabe liegt im Aufgabenbrett (Bereich „brevo“).
// ═══════════════════════════════════════════════════════════════════════════
export async function karteSperreAnLeitung(
  personId: number, akteur: { agentId: number | null; name: string }, wunsch: string,
): Promise<{ ok: boolean; meldung: string; aufgabeId: number | null }> {
  const w = String(wunsch ?? "").replace(/\s+/g, " ").trim();
  if (w.length < 5) return { ok: false, meldung: "Bitte in einem Satz, was der Kunde möchte (z. B. „will die Post wieder an diese Adresse“).", aufgabeId: null };
  const kopf = await kopfVon(Number(personId));
  const an = await karteEmpfaenger(kopf).catch(() => null);
  if (!an) return { ok: false, meldung: "Keine E-Mail-Adresse hinterlegt — erst unter „Daten“ eintragen.", aufgabeId: null };
  const lage = await zustellLage(kopf, an);
  if (!lage?.leitungPruefen) {
    return { ok: false, meldung: `Für ${an} liegt keine Sperre unseres Mailversands vor${lage?.problem ? " (die Adresse kam zurück — bitte mit dem Kunden prüfen und unter „Daten“ ändern)" : ""}.`, aufgabeId: null };
  }
  const [p] = (await sqlPool`SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS name FROM fiaon_persons WHERE id = ${kopf}`) as any[];
  const name = String(p?.name || "").trim() || `Person ${kopf}`;
  const { leitungId } = await import("./fiaon-mara-abstreiten");
  const leitung = await leitungId().catch(() => null);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const erg: any = await auftragFuerKunden({
    ...(leitung ? { agentId: leitung } : { anBetreiber: true }),
    personId: kopf, ref: null, bereich: "brevo", quelle: "konto-karte", dringend: false,
    titel: `Mailversand-Sperre von Hand prüfen: ${name}`,
    text: [
      `Adresse: ${an}`,
      `Stand: ${lage.text}${lage.grund ? ` — ${lage.grund}` : ""}${lage.sperrCode ? ` (Brevo: ${lage.sperrCode})` : ""}`,
      `Wunsch des Kunden (erfasst von ${akteur.name}): ${w.slice(0, 600)}`,
      "Nur auf ausdrücklichen Wunsch des Kunden in Brevo freigeben (Sperrliste) — automatisch heben wir nie etwas auf (Justin, 08.10.2026).",
      "Danach in der Akte unter Konto & Karte „E-Mail erneut senden“ — die Akte erkennt die aufgehobene Sperre.",
    ].join("\n"),
    link: `/agent/kunden?person=${kopf}`,
    schluessel: `kk-sperre-${kopf}-${an}`,
    autorName: akteur.name,
  });
  await sqlPool`
    INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
    VALUES (${kopf}, ${akteur.agentId}, ${akteur.name}, 'system',
            ${`Konto & Karte: Leitung gebeten, die Sperre unseres Mailversands für ${adresseKurz(an) ?? an} von Hand zu prüfen — Wunsch des Kunden: ${w.slice(0, 200)}`}, NOW())`.catch(() => {});
  return {
    ok: !!erg?.id, aufgabeId: erg?.id ?? null,
    meldung: erg?.id
      ? `Aufgabe an ${erg.agentName ?? "die Leitung"} angelegt. Sie prüft die Sperre von Hand; danach geht „E-Mail erneut senden“.`
      : "Die Aufgabe ließ sich nicht anlegen — bitte gleich noch einmal.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTO & KARTE — NACHFASSEN (E-IT-B, 08.10.2026, Punkt 11)
//
// Die Liste hieß „Bereit für Konto & Karte“ und zeigte, wer bereit war und
// noch keine Einladung hatte. Seit der Automatik (E-206) ist das binnen
// Minuten niemand mehr — übrig blieben die Ausgeschlossenen (07.10.: 107
// Gekündigte, 3 Testkonten). Jetzt dieselbe Ausschlussregel wie überall, und
// statt eines leeren „bereit“ die Fälle, in denen ein Mensch etwas tun kann:
//   · Mail kam nicht an (gesperrt, abgewiesen, Spam — auch wenn die Automatik
//     deshalb gar nicht erst geschickt hat): Adresse prüfen, erneut senden.
//   · Eingeladen, nach 5 Tagen nicht geklickt, kein Konto gemeldet: anrufen.
//   · Bereit (noch keine Einladung, sie kommt mit dem nächsten Takt).
//   · Wartet auf das Ende der Widerrufsfrist — nur zur Information.
// Nur eigene Kunden (Justin, 24.08.: „bei den Mitarbeitern, die die Kunden
// betreuen“). EINE Abfrage für alle Zustände.
// ═══════════════════════════════════════════════════════════════════════════
export interface KarteNachfassFall {
  personId: number;
  name: string;
  agentId: number | null;
  zustand: KarteNachfassZustand;
  marke: string;
  satz: string;
  /** Seit wann (ISO): Einladung, Zahlung oder Annahme — für die Anzeige. */
  seit: string | null;
}

/**
 * Gegenprüfung 08.10.2026: liefert die Fälle (dringend zuerst, innerhalb ältester
 * zuerst, höchstens `grenze`) UND die echte Gesamtzahl — eine Kachel, die bei 200
 * abschneidet, muss sagen, dass es mehr sind.
 */
export async function karteNachfassen(
  opt: { agentId: number | null; grenze?: number }, lauf: Lauf = sqlPool,
): Promise<{ faelle: KarteNachfassFall[]; gesamt: number }> {
  await ensureKartenTabelle(lauf);
  await schufaTabelleSicher();
  await globalKundeBereit();
  // Der von Hand gepflegte Stand der Bank (fiaon_applications.karten_status) — Spalten entstehen dort beim ersten Gebrauch.
  await import("./fiaon-kartenstatus").then((m) => m.ensureKartenSpalten()).catch(() => {});
  const werte: any[] = [];
  const bed: string[] = ["p.merged_into_person_id IS NULL"];
  if (opt.agentId) { werte.push(opt.agentId); bed.push(`p.assigned_agent_id = $${werte.length}`); }
  const zeilen = (await lauf.unsafe(`
    WITH basis AS (
      SELECT x.person_id FROM (${STAND_SQL} WHERE ${bed.join(" AND ")}) x
       WHERE x.antrag_voll AND x.paket_bezahlt AND x.raten_bezahlt >= ${KARTE_MIN_RATEN}
         AND ${karteAusschlussSql("x.person_id")} IS NULL
    ), lage AS (
      SELECT b.person_id,
             (SELECT MIN(k.gesendet_am) FROM fiaon_konto_karte k WHERE k.person_id = b.person_id AND k.kanal <> 'gemeldet') AS eingeladen_am,
             EXISTS (SELECT 1 FROM fiaon_konto_karte k2 WHERE k2.person_id = b.person_id
                      AND k2.status IN (${KONTO_EROEFFNET_STAENDE.map((s) => `'${s}'`).join(", ")})) AS konto_steht,
             -- Ein gepflegter Kartenstand der Bank (beantragt, in Produktion …) heißt: Er hat den Link genutzt —
             -- auch wenn der Klick nicht gemessen wurde (anderes Gerät, Sicherheitsfilter des Postfachs).
             EXISTS (SELECT 1 FROM fiaon_applications ks WHERE ks.person_id = b.person_id AND ks.merged_into IS NULL
                      AND ks.karten_status IS NOT NULL) AS karte_gepflegt,
             -- Kam die letzte Einladung NICHT an? Gegenprüfung 08.10.2026: ein weicher Rückläufer zählt nicht (ZUSTELL_PROBLEM_SQL).
             COALESCE((SELECT ${ZUSTELL_PROBLEM_SQL("mp.zustellung", "mp.zustellung_grund")} FROM fiaon_mail_log mp
                 WHERE mp.person_id = b.person_id AND mp.event = 'konto_karte_einladung'
                   AND mp.status = 'versandt' AND COALESCE(mp.art, 'echt') = 'echt' ORDER BY mp.created_at DESC LIMIT 1), FALSE) AS einladung_problem,
             EXISTS (SELECT 1 FROM fiaon_mail_log mg WHERE mg.person_id = b.person_id AND mg.event = 'konto_karte_einladung'
                      AND mg.zustellung = 'geklickt') AS geklickt,
             ${ADRESSE_PROBLEM_SQL("b.person_id")} AS adresse_problem,
             (SELECT MAX(v.angenommen_am) FROM fiaon_vertragsannahmen v LEFT JOIN fiaon_applications va ON va.ref = v.ref
               WHERE (va.person_id = b.person_id OR v.person_id = b.person_id)
                 AND v.sofort_beginn = FALSE AND v.angenommen_am > NOW() - INTERVAL '15 days') AS frist_seit,
             (SELECT MIN(a.paid_at) FROM fiaon_applications a WHERE a.person_id = b.person_id AND a.merged_into IS NULL
                 AND a.payment_status = 'paid') AS bezahlt_am
        FROM basis b
    )
    SELECT l.*, pp.assigned_agent_id,
           TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS name
      FROM lage l JOIN fiaon_persons pp ON pp.id = l.person_id
     -- Gegenprüfung 08.10.2026: Vorher griff LIMIT auf die GANZE Grundmenge (aufsteigend nach person_id), erst danach
     -- warf JavaScript Geklickte, Gepflegte und frisch Eingeladene weg — ab 200 fielen die NEUESTEN Fälle still heraus.
     -- Jetzt filtert SQL vorab genau wie unten, die Grenze greift erst nach Filter und Sortierung (unten).
     WHERE NOT l.konto_steht AND NOT l.karte_gepflegt
       AND (l.eingeladen_am IS NULL
            OR l.einladung_problem
            OR (NOT l.geklickt AND l.eingeladen_am <= NOW() - (${KARTE_NICHT_GEKLICKT_TAGE} * INTERVAL '1 day')))
     LIMIT 5000`, werte)) as any[];
  const grenzeKlick = Date.now() - KARTE_NICHT_GEKLICKT_TAGE * 86_400_000;
  const faelle: KarteNachfassFall[] = [];
  for (const z of zeilen) {
    let zustand: KarteNachfassZustand | null = null;
    let seit: Date | null = null;
    if (z.karte_gepflegt) continue;
    if (z.eingeladen_am) {
      // Eingeladen: Zählt, was aus der EINLADUNG wurde — eine spätere gesperrte Mail anderer Art nimmt ihm den Link nicht.
      if (z.einladung_problem) { zustand = "nicht_angekommen"; seit = new Date(z.eingeladen_am); }
      else if (!z.geklickt && new Date(z.eingeladen_am).getTime() <= grenzeKlick) { zustand = "nicht_geklickt"; seit = new Date(z.eingeladen_am); }
    } else if (z.frist_seit) { zustand = "frist"; seit = new Date(z.frist_seit); }
    else if (z.adresse_problem) { zustand = "nicht_angekommen"; seit = z.bezahlt_am ? new Date(z.bezahlt_am) : null; }
    else { zustand = "bereit"; seit = z.bezahlt_am ? new Date(z.bezahlt_am) : null; }
    if (!zustand) continue;
    faelle.push({
      personId: Number(z.person_id),
      name: String(z.name || "").trim() || `Person ${z.person_id}`,
      agentId: z.assigned_agent_id ?? null,
      zustand, marke: KARTE_NACHFASSEN[zustand].marke, satz: KARTE_NACHFASSEN[zustand].satz,
      seit: seit && !Number.isNaN(seit.getTime()) ? seit.toISOString() : null,
    });
  }
  const rang = (z: KarteNachfassZustand) => KARTE_NACHFASSEN_REIHENFOLGE.indexOf(z);
  const sortiert = faelle.sort((a, b) => rang(a.zustand) - rang(b.zustand) || String(a.seit ?? "").localeCompare(String(b.seit ?? "")));
  return { faelle: sortiert.slice(0, Math.min(500, Math.max(1, opt.grenze ?? 200))), gesamt: sortiert.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARA SCHICKT DEN LINK SELBST (02.10.2026, E-275)
//
// Bisher konnte Mara auf „Wo bleibt meine Karte?“ nur übergeben („Herr
// Boychenko prüft das“) oder einen Termin anbieten — gemessen: 62 % der
// Kartenfragen auf WhatsApp endeten so. karteEinladungFuerPerson ist ihr
// Werkzeug dafür, für Mail UND WhatsApp: Sie schickt die Einladung (oder den
// Link erneut, wenn er schon draußen ist), und sie bekommt den Satz für den
// Kunden — Justins eigene, wahre Formel aus shared/fiaon-karten-weg.ts:
// „Sobald Ihr Account aktiviert ist, bekommen Sie direkt den fertigen Link
// unserer Partnerbank … Nach der Zusage der Bank ist die Karte in der Regel in
// 2–5 Werktagen bei Ihnen, und meist können Sie sie schon vorher in der App der
// Bank mit Apple Pay nutzen.“ Keine Limit-Zusage, keine Karten-Zusage (die
// Wortwand verbietet beides), kein Termin, kein „wir sind keine Bank“.
//
// Wer ausgeschlossen ist (einladungPruefen), bekommt nichts — dann ist
// `satz` null und Mara übergibt mit `intern` als Grund. Noch nicht bezahlt:
// der Verkaufssatz („Sobald Ihre erste Zahlung … aktiviert“); den Zahlungslink
// legt Mara mit ihrem eigenen Werkzeug dazu.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wer den Link auslöst — steht im Verlauf und im Mail-Protokoll („Mara (Postmeister)“, „Mara (WhatsApp)“).
 * Zwei Schreibweisen, weil zwei Bereiche parallel gebaut haben: `name` (WhatsApp) oder `akteurName`
 * mit `quelle`, `erneut`, `postmeisterId` (Postmeister-Werkzeug karte_senden). Beide gelten.
 */
export interface KarteEinladungAkteur {
  name?: string;
  akteurName?: string;
  /** Woher der Auftrag kommt („postmeister“, „whatsapp“) — nur für die Notiz. */
  quelle?: string;
  /** false: einen schon verschickten Link NICHT erneut schicken. Standard: erneut, wenn der Kunde fragt. */
  erneut?: boolean;
  /** Der Postmeister-Fall, aus dem der Auftrag kommt — steht in der Notiz. */
  postmeisterId?: number | null;
}

/**
 * gesendet — erste Einladung raus · erneut_gesendet — Link noch einmal geschickt ·
 * schon_unterwegs — vor weniger als einer Stunde geschickt, nicht noch einmal (oder Drossel E-IT-B) ·
 * adresse_gesperrt — an seine Adresse kam zuletzt nichts an; nichts geschickt, Satz fragt nach der Adresse ·
 * konto_steht — Girokonto schon eröffnet, keine Mail nötig · nicht_bereit — Zahlung oder
 * Angaben fehlen (Verkaufssatz) · gesperrt — Ausschluss, Übergabe · fehler — Versand gescheitert.
 */
export type KarteEinladungAktion =
  | "gesendet" | "erneut_gesendet" | "schon_unterwegs" | "konto_steht" | "nicht_bereit" | "gesperrt" | "fehler"
  // E-IT-B (08.10.2026): An seine Adresse kam zuletzt nichts an (gesperrt, abgewiesen, Spam) — nichts geschickt,
  // nichts entsperrt; der Satz fragt nach der richtigen Adresse (KARTE_ADRESSE_KUNDE).
  | "adresse_gesperrt";

export interface KarteEinladungStand {
  /** Der Kopf (zusammengeführte Personen laufen auf ihn). */
  personId: number;
  /** Antrag vollständig und Paket bezahlt. */
  bereit: boolean;
  esFehlt: string | null;
  /** Ist das Paket bezahlt? false = Mara verkauft die erste Zahlung. */
  paketBezahlt: boolean;
  /** Fehlende Angaben im Antrag, in Worten („Geburtsdatum“, „Straße“ …). Leer, wenn vollständig. */
  fehlendeAngaben: string[];
  /** Gibt es einen verschickten Weg (Zeile in fiaon_konto_karte, kein „gemeldet“)? Wie kartenStand().versand. */
  eingeladen: boolean;
  /** Erste echte Einladung, „dd.mm.yyyy“ (Berlin). */
  eingeladenAm: string | null;
  /** Letzte versandte Einladungsmail, „dd.mm.yyyy, HH:MM Uhr“ (Berlin). */
  zuletztGeschicktAm: string | null;
  /** Dasselbe als ISO-Zeitpunkt — für Rechnungen („keine zweite binnen …“). */
  zuletztGeschicktIso: string | null;
  /** Zustellung der letzten Einladungsmail (Brevo): zugestellt · geoeffnet · geklickt · blockiert · gebounct. */
  zustellung: string | null;
  kontoEroeffnet: boolean;
  kontoEroeffnetAm: string | null;
  naechsteRateAm: string | null;
  /** Die Adresse, an die die Einladung geht — gekürzt („gy…@yahoo.com“). */
  adresse: string | null;
  /** Werbesperre gesetzt? Nur zur Auskunft — sie hält die Einladung nicht auf (E-275). */
  werbesperre: boolean;
}

export interface KarteEinladungErgebnis {
  /** Der Kunde hat jetzt seinen Link (oder sein Konto steht schon). */
  ok: boolean;
  aktion: KarteEinladungAktion;
  /** Der Satz für den Kunden (Sie-Form, Deutsch — Mara übersetzt in seine Sprache). null = übergeben. */
  satz: string | null;
  /** Für Akte, Protokoll und Übergabe — nie an den Kunden. */
  intern: string;
  stand: KarteEinladungStand | null;
  /** Ging JETZT eine Mail raus (gesendet / erneut_gesendet)? */
  gesendet: boolean;
  /** Warum nicht — gleich `intern`, wenn ok false ist; sonst null. */
  grund: string | null;
  /** Zuletzt geschickt VOR diesem Aufruf (ISO) — null, wenn es der erste Link ist. */
  schonAm: string | null;
  /** Betreff der Einladung, wie sie rausging („Ihr Link zur Karte ist da, Satpal“) — nur wenn gesendet. */
  betreff: string | null;
}

/** „dd.mm.yyyy, HH:MM Uhr“ in Berliner Zeit. Nur formatToParts — Number(format()) ergibt NaN. */
function zeitpunktBerlin(d: any): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const teile = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(x);
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "";
  return `${w("day")}.${w("month")}.${w("year")}, ${w("hour")}:${w("minute")} Uhr`;
}

/** „gyogesh26@yahoo.com“ → „gy…@yahoo.com“. */
function adresseKurz(adresse: unknown): string | null {
  const a = String(adresse ?? "").trim();
  const at = a.lastIndexOf("@");
  if (at < 1) return null;
  const lokal = a.slice(0, at);
  return `${lokal.slice(0, lokal.length > 3 ? 2 : 1)}…${a.slice(at)}`;
}

/** Wie lange ein eben geschickter Link nicht noch einmal geht — drei Mails in einer Minute wären drei Links. */
const ERNEUT_FRUEHESTENS_MIN = 60;

/** Der Stand der Einladung eines Menschen — nur lesend. null, wenn es ihn nicht gibt. */
export async function karteEinladungStand(personId: number): Promise<KarteEinladungStand | null> {
  if (!Number.isInteger(Number(personId)) || Number(personId) <= 0) return null;
  await ensureKartenTabelle();
  const { KOPF_SQL } = await import("./fiaon-mail-frequenz");
  const [k] = (await sqlPool.unsafe(`SELECT ${KOPF_SQL("$1::int")} AS kopf`, [Number(personId)])) as any[];
  const kopf = Number(k?.kopf || personId);
  const stand = await kartenStand(kopf);
  if (!stand) return null;
  const [kontakt] = (await sqlPool`
    SELECT COALESCE(NULLIF(TRIM(p.primary_email), ''), (
             SELECT NULLIF(TRIM(COALESCE(a.email, a.contact_email, a.billing_email)), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1)) AS email,
           (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre
      FROM fiaon_persons p WHERE p.id = ${kopf}`) as any[];
  // „Eingeladen am“ = die erste versandte Einladungsmail. Die Zeile taugt dafür nur als Rückfall: Ein
  // erneuter Versand rückt ihr gesendet_am auf jetzt (einladungSchicken).
  const [erst] = (await sqlPool`
    SELECT LEAST(
             (SELECT MIN(gesendet_am) FROM fiaon_konto_karte WHERE person_id = ${kopf} AND kanal <> 'gemeldet'),
             (SELECT MIN(created_at) FROM fiaon_mail_log WHERE person_id = ${kopf} AND event = 'konto_karte_einladung'
                 AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt')) AS am,
           EXISTS (SELECT 1 FROM fiaon_konto_karte WHERE person_id = ${kopf} AND kanal <> 'gemeldet') AS weg_da`) as any[];
  const [mail] = (await sqlPool`
    SELECT created_at, zustellung FROM fiaon_mail_log
     WHERE person_id = ${kopf} AND event = 'konto_karte_einladung' AND status = 'versandt'
       AND COALESCE(art, 'echt') = 'echt'
     ORDER BY created_at DESC LIMIT 1`.catch(() => [] as any[])) as any[];
  // Welche Angaben fehlen — an der Bestellung, die am wenigsten offen hat (dieselbe Regel wie antrag_voll:
  // ein Feld gilt als da, wenn es am Antrag ODER an der Person steht).
  let fehlendeAngaben: string[] = [];
  if (!stand.tore.find((t) => t.schluessel === "antrag")?.erfuellt) {
    const [f] = (await sqlPool`
      SELECT x.fehlt FROM (
      SELECT ARRAY_REMOVE(ARRAY[
               CASE WHEN COALESCE(NULLIF(TRIM(a.first_name), ''), NULLIF(TRIM(p.first_name), '')) IS NULL THEN 'Vorname' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.last_name), ''), NULLIF(TRIM(p.last_name), '')) IS NULL THEN 'Nachname' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.birthdate), ''), NULLIF(TRIM(p.birthdate::text), '')) IS NULL THEN 'Geburtsdatum' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.street), ''), NULLIF(TRIM(p.street), '')) IS NULL THEN 'Straße und Hausnummer' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.zip), ''), NULLIF(TRIM(p.zip), '')) IS NULL THEN 'Postleitzahl' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.city), ''), NULLIF(TRIM(p.city), '')) IS NULL THEN 'Wohnort' END,
               CASE WHEN COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(p.primary_email), '')) IS NULL THEN 'E-Mail-Adresse' END
             ], NULL) AS fehlt
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.person_id = ${kopf} AND a.merged_into IS NULL AND a.archived_at IS NULL) x
       ORDER BY cardinality(x.fehlt) ASC LIMIT 1`.catch(() => [] as any[])) as any[];
    fehlendeAngaben = Array.isArray(f?.fehlt) && f.fehlt.length ? f.fehlt.map(String) : ["die Angaben im Antrag (Name, Geburtsdatum, Anschrift)"];
  }
  const konto = await kontoEroeffnung(kopf);
  return {
    personId: kopf,
    bereit: stand.bereit,
    esFehlt: stand.esFehlt,
    paketBezahlt: stand.zahlen.paketBezahlt,
    fehlendeAngaben,
    eingeladen: erst?.weg_da === true,
    eingeladenAm: tagBerlin(erst?.am),
    zuletztGeschicktAm: zeitpunktBerlin(mail?.created_at),
    zuletztGeschicktIso: mail?.created_at ? new Date(mail.created_at).toISOString() : null,
    zustellung: mail?.zustellung ? String(mail.zustellung) : null,
    kontoEroeffnet: konto.eroeffnet,
    kontoEroeffnetAm: konto.am,
    naechsteRateAm: stand.zahlen.naechsteRateAm,
    adresse: adresseKurz(kontakt?.email),
    werbesperre: !!kontakt?.werbesperre,
  };
}

/** Der Satz für den Kunden — nur aus Bausteinen, die die Wortwand kennt (shared/fiaon-karten-weg.ts). */
function einladungSatz(aktion: KarteEinladungAktion, s: KarteEinladungStand): string | null {
  const an = s.adresse ? ` an ${s.adresse}` : "";
  const weg = "Darüber beantragen Sie in wenigen Minuten online Ihr Girokonto mit Visa-Karte — Sie brauchen nur Ihren Ausweis.";
  switch (aktion) {
    case "gesendet":
      return `Ich habe Ihnen soeben den fertigen Link unserer Partnerbank, der DKB, für Ihren Kartenantrag per E-Mail${an} geschickt. ${weg} ${KARTE_ZEIT_SATZ}`;
    case "erneut_gesendet":
      return `Ihr Link unserer Partnerbank für den Kartenantrag ging${s.eingeladenAm ? ` am ${s.eingeladenAm}` : ""} an Sie raus — ich habe ihn Ihnen soeben noch einmal per E-Mail${an} geschickt; schauen Sie bitte auch im Spam-Ordner nach. ${weg} ${KARTE_ZEIT_SATZ}`;
    case "schon_unterwegs":
      return `Den Link unserer Partnerbank für Ihren Kartenantrag habe ich Ihnen gerade erst per E-Mail${an} geschickt — schauen Sie bitte auch im Spam-Ordner nach. ${weg} ${KARTE_ZEIT_SATZ}`;
    case "konto_steht":
      return `Ihr Girokonto bei unserer Partnerbank, der DKB, ist bereits eröffnet${s.kontoEroeffnetAm ? ` (seit ${s.kontoEroeffnetAm})` : ""}. Die Visa-Kreditkarte buchen Sie direkt in Ihrem DKB-Banking dazu. ${KARTE_ZEIT_SATZ}`;
    case "nicht_bereit": {
      if (!s.paketBezahlt) {
        // Justins „zahl die Aktivierung … also: Jetzt zahlen!“ in seiner eigenen, wahren Fassung (Mail vom
        // 02.10.): Zahlung → Account aktiviert → direkt der Link. KARTE_LINK_SATZ bleibt die eine Quelle; nur
        // sein Anfang wird zu „Dann …“, damit nicht zweimal „Sobald“ hintereinander steht.
        // E-275 Endkontrolle (02.10.2026, Wahrheit): Fehlen zusätzlich Angaben im Antrag, kommt der Link NICHT „direkt“
        // nach der Zahlung (die Einladung verlangt den vollständigen Antrag) — dieselbe Lücken-Fassung wie im Abschluss.
        const eine = s.fehlendeAngaben.length === 1;
        const link = s.fehlendeAngaben.length
          ? `Sobald auch Ihr Antrag vollständig ist (es fehlt noch: ${s.fehlendeAngaben.join(", ")}), geht der fertige Link unserer Partnerbank für Ihren Kartenantrag an Sie raus — schreiben Sie mir ${eine ? "diese Angabe" : "diese Angaben"} einfach zurück.`
          : KARTE_LINK_SATZ.replace(/^Sobald Ihr Account aktiviert ist, bekommen Sie/, "Dann bekommen Sie");
        return `Sobald Ihre erste Zahlung bei uns eingegangen ist, ist Ihr Account aktiviert. ${link} `
          + `Je früher Ihre Zahlung da ist, desto früher können Sie Ihren Kartenantrag stellen. ${KARTE_ZEIT_SATZ}`;
      }
      const eine = s.fehlendeAngaben.length === 1;
      return `Damit Ihre Kontoeröffnung bei der Bank in einem Zug durchläuft, ${eine ? "fehlt" : "fehlen"} in Ihrem Antrag noch: ${s.fehlendeAngaben.join(", ")}. `
        + `Schreiben Sie mir ${eine ? "diese Angabe" : "diese Angaben"} einfach zurück — sobald ${eine ? "sie in Ihrem Antrag steht" : "sie alle in Ihrem Antrag stehen"}, geht Ihr Link unserer Partnerbank automatisch an Sie raus.`;
    }
    default:
      return null;
  }
}

/**
 * Mara (Mail oder WhatsApp) schickt dem Kunden den Link der Partnerbank — oder
 * noch einmal, wenn er schon draußen ist — und bekommt den Satz für ihn.
 *
 * Wirft nie. Schickt nichts, wenn einladungPruefen ausschließt (dann
 * `aktion: "gesperrt"`, `satz: null`), wenn das Girokonto schon steht, wenn
 * Zahlung oder Angaben fehlen, wenn die letzte Einladung keine Stunde alt ist
 * oder wenn der Aufrufer `erneut: false` sagt und der Link schon draußen ist.
 * Die 10 € gehören wie immer dem Betreuer — beim erneuten Versand entsteht
 * keine zweite Vormerkung.
 */
export async function karteEinladungFuerPerson(personId: number, akteur: KarteEinladungAkteur = {}): Promise<KarteEinladungErgebnis> {
  const wer = String(akteur?.name || akteur?.akteurName || "").trim() || "Mara";
  const herkunft = [akteur?.quelle ? String(akteur.quelle).trim() : "", akteur?.postmeisterId ? `Postmeister-Fall ${akteur.postmeisterId}` : ""]
    .filter(Boolean).join(", ");
  const antwort = (e: Omit<KarteEinladungErgebnis, "gesendet" | "grund" | "schonAm" | "betreff"> & Partial<KarteEinladungErgebnis>): KarteEinladungErgebnis => ({
    gesendet: false, schonAm: null, betreff: null, ...e, grund: e.ok ? null : (e.grund ?? e.intern),
  });
  const nichts = (aktion: KarteEinladungAktion, intern: string, stand: KarteEinladungStand | null): KarteEinladungErgebnis =>
    antwort({ ok: false, aktion, satz: null, intern, stand, schonAm: stand?.zuletztGeschicktIso ?? null });
  try {
    const stand = await karteEinladungStand(personId);
    if (!stand) return nichts("fehler", `Person ${personId} nicht gefunden.`, null);
    const [pruefung] = await einladungPruefen([stand.personId]);
    if (!pruefung) return nichts("fehler", `Person ${stand.personId} nicht gefunden.`, stand);
    if (pruefung.sperre) return nichts("gesperrt", `Kein Kartenlink: ${pruefung.sperre}.`, stand);
    const schonAm = stand.zuletztGeschicktIso;

    if (stand.kontoEroeffnet) {
      return antwort({
        ok: true, aktion: "konto_steht", satz: einladungSatz("konto_steht", stand), stand, schonAm,
        intern: `Girokonto steht schon${stand.kontoEroeffnetAm ? ` (${stand.kontoEroeffnetAm})` : ""} — kein neuer Link; die Karte bucht der Kunde im Banking dazu.`,
      });
    }
    if (!stand.bereit) {
      return antwort({
        ok: false, aktion: "nicht_bereit", satz: einladungSatz("nicht_bereit", stand), stand, schonAm,
        intern: !stand.paketBezahlt
          ? "Paket noch nicht bezahlt — Zahlungslink dazugeben; nach der Buchung geht die Einladung automatisch raus (Takt karten_einladungen, ≤ 5 Min.)."
            + (stand.fehlendeAngaben.length ? ` Außerdem fehlt im Antrag: ${stand.fehlendeAngaben.join(", ")}.` : "")
          : `Antrag unvollständig (${stand.fehlendeAngaben.join(", ")}) — Angaben vom Kunden erfragen und in der Akte unter „Daten“ eintragen; danach geht die Einladung automatisch raus.`,
      });
    }

    const schonDraussen = stand.eingeladen;
    // E-IT-B Fertigstellung (08.10.2026, Befund 8b): An der Tagesgrenze nicht „gerade erst geschickt“ — der letzte
    // Versand kann Stunden zurückliegen (karteHeuteSchonSatz, shared/fiaon-karten-weg.ts).
    const unterwegs = (intern: string, heuteSchon = false) =>
      antwort({
        ok: true, aktion: "schon_unterwegs", stand, schonAm, intern,
        satz: heuteSchon ? `${karteHeuteSchonSatz(stand.adresse ? ` an ${stand.adresse}` : "")} ${KARTE_ZEIT_SATZ}` : einladungSatz("schon_unterwegs", stand),
      });
    // ── E-IT-B (08.10.2026): KOMMT AN SEINE ADRESSE ÜBERHAUPT ETWAS AN? ──────
    // Mara schickte vier Links an gesperrte Adressen und schrieb dazu „schauen Sie
    // bitte auch im Spam-Ordner nach“ — die Mail ging bei Brevo nie raus. Jetzt:
    // nichts schicken, nichts entsperren (Justin, 08.10.), nach der Adresse fragen.
    const anAdresse = await karteEmpfaenger(stand.personId).catch(() => null);
    const adressLage = anAdresse ? await zustellLage(stand.personId, anAdresse).catch(() => null) : null;
    const adresseGesperrt = () => brevoAbmeldung(adressLage?.sperrCode)
      // Gegenprüfung 08.10.2026: Hat er sich bei unserem Mailversand ABGEMELDET, stimmt die Adresse — nach einer
      // anderen zu fragen hilft nicht. Mara übergibt (wie bei jedem Ausschluss); ein Mensch klärt mit ihm, ob er die
      // Post dorthin ausdrücklich wieder will, und bittet dann die Leitung, die Sperre von Hand zu prüfen.
      ? nichts("gesperrt", `Kein Kartenlink: Er hat sich bei unserem Mailversand abgemeldet (${adresseKurz(anAdresse) ?? "seine Adresse"}) — `
        + "die Adresse stimmt vermutlich. Nicht nach einer anderen Adresse fragen: Ein Mitarbeiter klärt mit ihm, ob er die Post "
        + "ausdrücklich wieder will; dann prüft die Leitung die Sperre von Hand (Akte: „An die Leitung: Sperre prüfen“). Nichts geschickt, nichts entsperrt.", stand)
      : antwort({
        ok: false, aktion: "adresse_gesperrt", satz: KARTE_ADRESSE_KUNDE, stand, schonAm,
        intern: `An ${adresseKurz(anAdresse) ?? "seine Adresse"} kam zuletzt nichts an (${adressLage?.text ?? "gesperrt"}${adressLage?.grund ? ` — ${adressLage.grund}` : ""}) — `
          + "nichts geschickt, keine Sperre aufgehoben. Nach der richtigen Adresse fragen; ein Mitarbeiter trägt sie unter „Daten“ ein und sendet in der Akte erneut.",
      });
    if (adressLage?.problem) return adresseGesperrt();
    if (schonDraussen && akteur?.erneut === false) {
      return unterwegs(`Link ist schon draußen (zuletzt ${stand.zuletztGeschicktAm ?? stand.eingeladenAm ?? "früher"}) — erneut: false, nichts geschickt.`);
    }
    if (schonDraussen) {
      const [frisch] = (await sqlPool`
        SELECT 1 AS da FROM fiaon_mail_log
         WHERE person_id = ${stand.personId} AND event = 'konto_karte_einladung' AND status = 'versandt'
           AND created_at > NOW() - (${ERNEUT_FRUEHESTENS_MIN} * INTERVAL '1 minute')
         LIMIT 1`.catch(() => [] as any[])) as any[];
      if (frisch) {
        return unterwegs(`Link ging zuletzt ${stand.zuletztGeschicktAm ?? "eben"} raus — nicht noch einmal (frühestens nach ${ERNEUT_FRUEHESTENS_MIN} Minuten).`);
      }
    }
    if (imVersand.has(stand.personId)) {
      return unterwegs("Die Einladung ist in diesem Augenblick schon unterwegs (Takt oder zweite Antwort).");
    }

    const von = herkunft ? `${wer}, ${herkunft}` : wer;
    if (schonDraussen) {
      // E-IT-B (08.10.2026): Der erneute Versand geht über den EINEN Weg (karteEinladungErneut) — dieselbe Zeile,
      // derselbe Link, dieselbe Drossel wie in der Akte. Maras 60 Minuten (oben) gelten zusätzlich.
      const quelle: KarteErneutQuelle = /whatsapp/i.test(`${akteur?.quelle ?? ""} ${wer}`) ? "mara_wa" : "mara_post";
      const e = await karteEinladungErneut(stand.personId, { agentId: null, name: wer, rolle: "admin", quelle });
      if (!e.ok) {
        if (e.code === "TAGESGRENZE") return unterwegs(e.meldung, true);
        if (e.code === "GERADE_ERST" || e.code === "UNTERWEGS") return unterwegs(e.meldung);
        if (e.code === "ADRESSE_GESPERRT") return adresseGesperrt();
        if (e.code === "GESPERRT") return nichts("gesperrt", e.meldung, stand);
        return nichts("fehler", `Kartenlink nicht verschickt: ${e.meldung}`, stand);
      }
    } else {
      const erg = await einladungSchicken({
        personId: stand.personId, betreuerId: pruefung.betreuerId, betreuerName: pruefung.betreuerName,
        akteurName: wer,
        notiz: `Auf Nachfrage geschickt von ${von} (E-275)`,
        verlauf: `Konto & Karte: Einladung der Partnerbank auf Nachfrage geschickt (${von}).`,
      });
      if (!erg.ok) return nichts("fehler", `Kartenlink nicht verschickt: ${erg.grund}`, stand);
    }

    // Der Betreff, wie er rausging — derselbe Motor, dieselbe Vorlage, derselbe Vorname wie mailSenden.
    let betreff: string | null = null;
    try {
      const [p] = (await sqlPool`SELECT COALESCE(NULLIF(first_name, ''), contact_name) AS vorname FROM fiaon_persons WHERE id = ${stand.personId}`) as any[];
      const { mailRendern } = await import("../mail/motor");
      betreff = mailRendern("konto_karte_einladung", { vorname: p?.vorname ?? "" })?.betreff ?? null;
    } catch { /* ohne Betreff: der Satz kommt ohne ihn aus */ }

    const nachher = (await karteEinladungStand(stand.personId)) ?? stand;
    const aktion: KarteEinladungAktion = schonDraussen ? "erneut_gesendet" : "gesendet";
    return antwort({
      ok: true, aktion, satz: einladungSatz(aktion, nachher), stand: nachher, gesendet: true, schonAm, betreff,
      intern: schonDraussen
        ? `Link der Partnerbank erneut geschickt (zuerst am ${stand.eingeladenAm ?? "?"}${stand.zustellung ? `, letzte Mail: ${stand.zustellung}` : ""}).`
        : `Einladung der Partnerbank geschickt — 10 € vorgemerkt für ${pruefung.betreuerName ?? "den Betreuer"}.${stand.werbesperre ? " (Werbesperre gesetzt — die Einladung ist Vertragsleistung, E-275.)" : ""}`,
    });
  } catch (e: any) {
    console.error("[KARTE] Einladung für Person:", e?.message || e);
    return nichts("fehler", `Kartenlink nicht verschickt: ${String(e?.message || e).slice(0, 160)}`, null);
  }
}

/** Nur die Anzahl — für Kacheln und Marken, ohne die ganze Liste zu holen. */
export async function bereitZahl(agentId: number | null, lauf: Lauf = sqlPool): Promise<number> {
  const liste = await bereiteKunden({ agentId, ohneVersand: true, grenze: 500 }, lauf);
  return liste.length;
}
