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
  zahlen: { ratenBezahlt: number; minRaten: number };
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
        kanal         TEXT NOT NULL DEFAULT 'mail',
        -- gesendet → eroeffnet → bestaetigt, oder verfallen.
        -- Der Bonus wird erst bei 'bestaetigt' auszahlbar: Der Partner meldet
        -- eine Eröffnung erst nach Wochen endgültig und kann sie streichen.
        -- Alles davor ist eine Vormerkung, keine Zusage.
        status        TEXT NOT NULL DEFAULT 'gesendet',
        bonus_cents   INTEGER NOT NULL DEFAULT 0,
        bestaetigt_am TIMESTAMPTZ,
        notiz         TEXT
      )
    `;
    await tx`CREATE INDEX IF NOT EXISTS fiaon_konto_karte_person ON fiaon_konto_karte (person_id)`;
    await tx`CREATE INDEX IF NOT EXISTS fiaon_konto_karte_agent ON fiaon_konto_karte (agent_id, status)`;
  });
  tabelleGeprueft = true;
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
    EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND NULLIF(TRIM(a.first_name), '') IS NOT NULL
        AND NULLIF(TRIM(a.last_name),  '') IS NOT NULL
        AND NULLIF(TRIM(a.birthdate),  '') IS NOT NULL
        AND NULLIF(TRIM(a.street),     '') IS NOT NULL
        AND NULLIF(TRIM(a.zip),        '') IS NOT NULL
        AND NULLIF(TRIM(a.city),       '') IS NOT NULL
        AND NULLIF(TRIM(a.email),      '') IS NOT NULL
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
    COALESCE((
      SELECT COUNT(*) FROM fiaon_abo_raten r
      JOIN fiaon_applications a2 ON a2.ref = r.ref
      WHERE a2.person_id = p.id AND r.status = 'bezahlt'
    ), 0)::int AS raten_bezahlt,
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
      ? `es sind erst ${raten} von ${KARTE_MIN_RATEN} Raten gelaufen`
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
      titel: `Paket und Auskunft bezahlt, ${KARTE_MIN_RATEN} Raten gelaufen`,
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
      warumFuerKunden:
        "Wir empfehlen das Konto erst, wenn Ihre Auskunft vorliegt und Ihre ersten Raten gelaufen "
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

  const [v] = (await lauf`
    SELECT gesendet_am, agent_name, status, bestaetigt_am, bonus_cents
    FROM fiaon_konto_karte WHERE person_id = ${personId}
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
    zahlen: { ratenBezahlt: Number(r.raten_bezahlt || 0), minRaten: KARTE_MIN_RATEN },
  };
}

/**
 * Wer ist bereit? Für den Bestand-Filter und die Tagesliste.
 *
 * `nurAgent` grenzt auf die eigenen Kunden ein — Justin am 24.08.: „in die
 * Tagesliste bitte bei den Mitarbeitern, die die Kunden betreuen." Ein
 * Mitarbeiter soll nicht die bereiten Kunden anderer sehen.
 * `ohneVersand` blendet aus, wo schon geschickt wurde: Ein zweiter Link an
 * denselben Menschen wirkt wie eine Mahnung.
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
     ${opt.ohneVersand ? "AND NOT EXISTS (SELECT 1 FROM fiaon_konto_karte k WHERE k.person_id = x.person_id)" : ""}
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
