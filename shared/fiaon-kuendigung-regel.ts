// ═══════════════════════════════════════════════════════════════════════════
// „WIRKSAM GEKÜNDIGT“ — EINE REGEL FÜR ALLE LISTEN UND AUTOMATIKEN
// (E-IT-B (08.10.2026), IT-Feedback Punkt 11)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Die Liste „Bereit für Konto & Karte“ bestand am 07.10.2026 zu 97 % aus
// Gekündigten (107 von 110, der Rest Testkonten). Ein Mitarbeiter klickte für
// Person 3809 — gekündigt und beendet seit dem 16.09. — auf „Karte bestellen“
// und bekam „Sperre: Vertrag beendet“. Die Liste kannte die Kündigung nicht;
// die Ausschlussliste stand privat in einer Funktion der Automatik.
//
// Dazu lasen 16 Stellen (mindestens, die Gegenprüfung fand gekuendigt_am in
// 31 Dateien) die Kündigung jede auf ihre Art: mit oder ohne Produktkategorie,
// mit oder ohne Rücknahme. Zwei Menschen mit laufendem Stufenpaket galten
// überall als gekündigt, weil nur ihre Bonitätsauskunft gekündigt war (4919,
// 11498 — gemessen 08.10., nur lesend).
//
// ── DIE ENTSCHEIDUNG (Justin, 08.10.2026) ─────────────────────────────────
// „Wirksam gekündigt“ ist EINE Regel in shared/ für alle Listen und
// Automatiken. Ein nie gebuchter Kündigungsantrag (cancellation_requests ohne
// gekuendigt_am) zählt NICHT — er wird über den E-213-Weg nachgebucht
// (Liste: Kundenzentrale, Filter „Kündigung nicht gebucht“).
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Ein MENSCH ist wirksam gekündigt, wenn
//   (a) eine lebende Bestellung (merged_into leer) der Kategorie STUFENPAKET
//       (shared/fiaon-produktkategorie.ts: weder Bonitätsauskunft noch FIAON
//       Global) ein gekuendigt_am trägt, und
//   (b) daneben KEIN bezahltes, ungekündigtes Stufenpaket läuft — ein neuer
//       Vertrag schlägt die alte Kündigung (wie laufendUngekuendigt an der
//       Mail-Tür, fiaon-mail-frequenz.ts).
//
// WARUM NUR gekuendigt_am UND NICHT „… AND kuendigung_zurueckgenommen_am IS
// NULL“: Die Rücknahme (kuendigungZuruecknehmen, server/lib/fiaon-kuendigung.ts)
// setzt gekuendigt_am auf NULL. Ein gesetztes gekuendigt_am IST also die
// geltende Kündigung. Die alte Lesart „… und zurückgenommen leer“ versagte nach
// Rücknahme und erneuter Kündigung (der Rücknahmetag blieb stehen — die
// Gegenprüfung vom 07.10. zeigte den Weg; seit E-IT-B setzt kuendigungSetzen ihn
// zurück). „zurückgenommen < gekündigt“ versagte bei einer nachgebuchten
// Kündigung mit altem Erklärungstag. Der einzige verlässliche Zeiger ist
// gekuendigt_am selbst.
//
// Was KEINE Kündigung ist und deshalb hier nicht steht: DSGVO-Löschung,
// Storno aus der Telefonkartei, Vertriebssperre — eigene Gründe mit eigenen
// Sätzen (shared/fiaon-karten-weg.ts, KARTE_AUSSCHLUSS).
//
// ── DIE AUSNAHME „NEUER ANTRAG NACH DER KÜNDIGUNG“ (Gegenprüfung 08.10.) ────
// Die Mail-Tür (sperreAusZeile, OHNE_VERTRAG_SQL in fiaon-mail-frequenz.ts),
// die Rückholung und die Mara-Aktion lesen eine Kündigung NICHT als Kündigung,
// wenn danach ein neuer Antrag kam (keine Auskunft) — „neues Interesse“ (Fall
// Trommer). Für Konto & Karte, Portalsperre, Versand und Akten-Marke zählt
// dagegen der VERTRAG: Ein unbezahlter neuer Antrag hebt die Kündigung des
// alten Vertrags nicht auf. Beide Lesarten stehen jetzt HIER — die Ausnahme als
// Schalter `neuerAntragSchlaegt` (kuendigungsStand, KUENDIGUNG_WIRKSAM_SQL),
// Paartest TS ↔ SQL in scripts/pruef-it-b.ts. Die Mail-Tür baut ihre Lesart
// noch selbst (zusätzlich zählt dort jede Produktart und die alte Rücknahme-
// Lesart). Sie auf diese Bausteine umzustellen ändert das Urteil für
// gemessen 5 Menschen (gekündigt, danach ein unbezahlter Paketantrag — 08.10.,
// nur lesend) — das entscheidet Justin, bevor umgestellt wird.
//
// ── PHASEN ─────────────────────────────────────────────────────────────────
// „läuft bis zum Ende“ oder „beendet“ entscheidet das VERTRAGSENDE aus
// vertragsendeLesen (server/lib/fiaon-kuendigung.ts, Abrechnungsmonat beim
// Altvertrag) — NIE vertrag_ende_am allein: Das steht erst, wenn die letzte
// Rate bezahlt ist, und ließe jeden nicht zahlenden Gekündigten für immer
// „laufen“ (Gegenprüfung 07.10.: 68 von 107, davon rechtlich wohl nur 3).
// Die Phase braucht die Ratenkette — sie wird deshalb je Mensch in TypeScript
// gerechnet (kuendigungPhase), nicht in Listen-SQL. Listen und Automatiken
// brauchen sie nicht: Für sie sperrt jede wirksame Kündigung.
// ═══════════════════════════════════════════════════════════════════════════
import { produktkategorie, produktkategorieSql } from "./fiaon-produktkategorie";

/** Die Felder einer Bestellung, die die Regel liest (Zeile aus fiaon_applications). */
export interface KuendigungBestellung {
  ref?: unknown;
  type?: unknown;
  pack_key?: unknown;
  merged_into?: unknown;
  payment_status?: unknown;
  gekuendigt_am?: unknown;
  /** Nur für den Schalter `neuerAntragSchlaegt` und die Anträge (antragZiel). */
  created_at?: unknown;
}

const lebt = (b: KuendigungBestellung) => b.merged_into == null || String(b.merged_into).trim() === "";
const hatTag = (v: unknown) => v != null && String(v).trim() !== "" && !Number.isNaN(new Date(v as any).getTime());
const ms = (v: unknown) => (hatTag(v) ? new Date(v as any).getTime() : NaN);

/** Schalter der Regel. Standard: die Lesart des VERTRAGS (Konto & Karte, Portal, Versand, Marke). */
export interface KuendigungOptionen {
  /**
   * Ein neuer Antrag (keine Bonitätsauskunft) NACH dem Kündigungstag hebt die
   * Kündigung auf — „neues Interesse“, die Lesart der Mail-Tür (Kopf oben).
   */
  neuerAntragSchlaegt?: boolean;
}

/** Ist DIESE Bestellung ein wirksam gekündigtes Stufenpaket? Rein. */
export function bestellungWirksamGekuendigt(b: KuendigungBestellung): boolean {
  return lebt(b) && hatTag(b.gekuendigt_am) && produktkategorie(b) === "konto";
}

/** Läuft DIESE Bestellung als bezahltes, ungekündigtes Stufenpaket? Rein. */
export function bestellungLaeuftUngekuendigt(b: KuendigungBestellung): boolean {
  return lebt(b) && String(b.payment_status ?? "") === "paid" && !hatTag(b.gekuendigt_am) && produktkategorie(b) === "konto";
}

export interface KuendigungsStand {
  /** Der Mensch ist wirksam gekündigt (Regel oben). */
  wirksam: boolean;
  /** Tag der jüngsten wirksamen Kündigung (ISO), null ohne Kündigung. */
  am: string | null;
  /** Die Bestellung dieser Kündigung — für vertragsendeLesen. */
  ref: string | null;
}

/** Die Regel für einen Menschen aus seinen Bestellungen. Rein. */
export function kuendigungsStand(bestellungen: readonly KuendigungBestellung[], opt: KuendigungOptionen = {}): KuendigungsStand {
  const neuerNach = (k: KuendigungBestellung) => bestellungen.some((n) =>
    n !== k && lebt(n) && produktkategorie(n) !== "auskunft" && ms(n.created_at) > ms(k.gekuendigt_am));
  const gekuendigt = bestellungen.filter((b) => bestellungWirksamGekuendigt(b) && !(opt.neuerAntragSchlaegt && neuerNach(b)));
  if (!gekuendigt.length || bestellungen.some(bestellungLaeuftUngekuendigt)) return { wirksam: false, am: null, ref: null };
  const juengste = [...gekuendigt].sort((x, y) => new Date(y.gekuendigt_am as any).getTime() - new Date(x.gekuendigt_am as any).getTime())[0];
  return { wirksam: true, am: new Date(juengste.gekuendigt_am as any).toISOString(), ref: juengste.ref != null ? String(juengste.ref) : null };
}

/** Tabellenalias prüfen — er landet wörtlich im SQL. */
function alias(a: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(a)) throw new Error(`[KUENDIGUNG-REGEL] Ungültiger Tabellenalias: ${a}`);
  return a;
}

/** Dieselbe Bestellungsregel in SQL (boolean). `a` ist der Alias einer fiaon_applications-Zeile. */
export const KUENDIGUNG_BESTELLUNG_SQL = (a: string): string =>
  `(${alias(a)}.merged_into IS NULL AND ${a}.gekuendigt_am IS NOT NULL AND ${produktkategorieSql(a)} = 'konto')`;

/** Bezahltes, ungekündigtes Stufenpaket in SQL (boolean). */
export const LAEUFT_UNGEKUENDIGT_SQL = (a: string): string =>
  `(${alias(a)}.merged_into IS NULL AND ${a}.payment_status = 'paid' AND ${a}.gekuendigt_am IS NULL AND ${produktkategorieSql(a)} = 'konto')`;

/**
 * Die Regel für einen Menschen in SQL (boolean). `person` ist ein SQL-Ausdruck
 * für die Personen-ID („p.id“, „$1::int“). Die Unterabfragen tragen eigene
 * Aliase (kr_g, kr_l) — sie stoßen mit keinem Aufrufer zusammen.
 */
export const KUENDIGUNG_WIRKSAM_SQL = (person: string, opt: KuendigungOptionen = {}): string => `(
  EXISTS (SELECT 1 FROM fiaon_applications kr_g WHERE kr_g.person_id = ${person} AND ${KUENDIGUNG_BESTELLUNG_SQL("kr_g")}${opt.neuerAntragSchlaegt ? `
            AND NOT EXISTS (SELECT 1 FROM fiaon_applications kr_n WHERE kr_n.person_id = ${person} AND kr_n.ref <> kr_g.ref
                             AND kr_n.merged_into IS NULL AND ${produktkategorieSql("kr_n")} <> 'auskunft'
                             AND kr_n.created_at > kr_g.gekuendigt_am)` : ""})
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications kr_l WHERE kr_l.person_id = ${person} AND ${LAEUFT_UNGEKUENDIGT_SQL("kr_l")}))`;

/** Der Tag der jüngsten wirksamen Kündigung (timestamptz) — nur zusammen mit KUENDIGUNG_WIRKSAM_SQL lesen. */
export const KUENDIGUNG_AM_SQL = (person: string): string =>
  `(SELECT MAX(kr_d.gekuendigt_am) FROM fiaon_applications kr_d WHERE kr_d.person_id = ${person} AND ${KUENDIGUNG_BESTELLUNG_SQL("kr_d")})`;

// ═══════════════════════════════════════════════════════════════════════════
// DER NIE GEBUCHTE KÜNDIGUNGSANTRAG — EINE QUELLE FÜR LISTE, AKTE UND BUCHUNG
// (E-IT-B (08.10.2026), Nachbesserung nach der Gegenprüfung)
//
// Das Formular /kuendigung (server/routes/cancellation.ts) legt den Antrag an
// die ERSTE Bestellung, die zu Name, E-Mail und Geburtsdatum passt — ohne
// Reihenfolge. Die Referenz des Antrags ist deshalb oft nicht der Vertrag:
// eine längst zusammengeführte Doppelbestellung (#5, #48, #114), eine
// stornierte (12363), eine Bonitätsauskunft (12461) oder eine Referenz, die es
// gar nicht mehr gibt (#10, #29, #131). Gemeint ist immer der MENSCH und sein
// Stufenpaket. Deshalb:
//   · Der Antrag gehört dem Menschen seiner Bestellung (auch einer
//     zusammengeführten; Personen-Dublette → ihr Kopf). Gibt es die Referenz
//     nicht mehr, der Person mit dieser E-Mail-Adresse (Hauptadresse).
//   · Er ist nur Arbeit, solange es etwas zu kündigen gibt: ein lebendes,
//     ungekündigtes, nicht storniertes/abgelöstes Stufenpaket des Menschen
//     (bestellungKuendbar). Ein Antrag auf eine Bonitätsauskunft hat seinen
//     eigenen Weg, eine schon gekündigte LEBENDE Bestellung ist gebucht (eine
//     gekündigte, aber zusammengeführte Doppelbestellung nicht — #114).
//   · Kam NACH dem Antrag eine Rücknahme, ist er erledigt (Fall 11498 — sonst
//     forderte die Akte auf, einen zahlenden Kunden zu kündigen).
//   · Ist der Mensch ohnehin wirksam gekündigt (an irgendeiner Bestellung),
//     ist nichts mehr zu tun.
// WAS gebucht wird, entscheidet antragZiel (rein, unten): die Bestellung des
// Antrags, wenn sie kündbar ist; sonst ihre Fortsetzung (Zusammenführung) oder
// das EINE Stufenpaket, das am Eingangstag bestand. Kam nach dem Antrag ein
// neues Paket, oder ist das Ziel nicht eindeutig, bucht die Akte nicht selbst
// — die Leitung entscheidet (Knopf nur für sie, mit Ziel und Grund).
// Gebucht wird IMMER zum Eingangstag des Antrags, Quelle „formular“.
// ═══════════════════════════════════════════════════════════════════════════

/** Eine Bestellung, die man kündigen kann: lebendes, ungekündigtes Stufenpaket, nicht storniert/abgelöst/archiviert/gelöscht. SQL. */
export const KUENDIGUNG_KUENDBAR_SQL = (a: string): string =>
  `(${alias(a)}.merged_into IS NULL AND ${a}.gekuendigt_am IS NULL AND COALESCE(${a}.payment_status, '') NOT IN ('cancelled', 'superseded')
    AND ${a}.archived_at IS NULL AND ${a}.gdpr_deleted_at IS NULL AND ${produktkategorieSql(a)} = 'konto')`;

/** Dieselbe Prüfung in TypeScript. Rein. */
export function bestellungKuendbar(b: KuendigungBestellung & { archived_at?: unknown; gdpr_deleted_at?: unknown }): boolean {
  return lebt(b) && !hatTag(b.gekuendigt_am) && !["cancelled", "superseded"].includes(String(b.payment_status ?? ""))
    && !hatTag(b.archived_at) && !hatTag(b.gdpr_deleted_at) && produktkategorie(b) === "konto";
}

/**
 * Die offenen, nie gebuchten Kündigungsanträge — als Zeilenquelle (SELECT).
 * Spalten: antrag_id, antrag_am, antrag_ref, antrag_grund, antrag_wunsch,
 * person_id (der Kopf), eigene (die Referenz des Antrags gibt es).
 * Ohne Bezug auf einen Aufrufer — als `IN (…)` einmal gerechnet (schnell auch
 * für die Zähler der Kundenzentrale über alle Menschen).
 */
export const KUENDIGUNG_ANTRAEGE_SQL = `
  SELECT kr_c.id AS antrag_id, kr_c.created_at AS antrag_am, kr_c.ref AS antrag_ref, kr_c.reason AS antrag_grund,
         kr_c.cancellation_date AS antrag_wunsch, kr_m.person_id, kr_m.eigene
    FROM cancellation_requests kr_c
    CROSS JOIN LATERAL (
      SELECT COALESCE((SELECT kr_h.merged_into_person_id FROM fiaon_persons kr_h WHERE kr_h.id = kr_a.person_id), kr_a.person_id) AS person_id,
             TRUE AS eigene
        FROM fiaon_applications kr_a
       WHERE kr_a.ref = kr_c.ref AND kr_a.person_id IS NOT NULL
         -- Gebucht ist er nur an einer LEBENDEN Bestellung: Eine Kündigung an einer zusammengeführten Doppelbestellung
         -- erreicht den Vertrag nicht (#114: am Antragstag auf die unbezahlte Doppelbestellung gebucht, das bezahlte
         -- Paket lief weiter und wurde gemahnt).
         AND (kr_a.gekuendigt_am IS NULL OR kr_a.merged_into IS NOT NULL) AND ${produktkategorieSql("kr_a")} = 'konto'
      UNION ALL
      SELECT kr_p.id, FALSE
        FROM fiaon_persons kr_p
       WHERE NOT EXISTS (SELECT 1 FROM fiaon_applications kr_w WHERE kr_w.ref = kr_c.ref)
         AND kr_p.merged_into_person_id IS NULL
         AND LOWER(TRIM(COALESCE(kr_p.primary_email, ''))) = LOWER(TRIM(COALESCE(kr_c.email, '')))
         AND TRIM(COALESCE(kr_c.email, '')) <> ''
    ) kr_m
   WHERE kr_c.status = 'pending'
     AND NOT ${KUENDIGUNG_WIRKSAM_SQL("kr_m.person_id")}
     AND NOT EXISTS (SELECT 1 FROM fiaon_applications kr_r WHERE kr_r.person_id = kr_m.person_id
                      AND kr_r.kuendigung_zurueckgenommen_am IS NOT NULL
                      AND kr_r.kuendigung_zurueckgenommen_am >= kr_c.created_at)
     AND EXISTS (SELECT 1 FROM fiaon_applications kr_k WHERE kr_k.person_id = kr_m.person_id AND ${KUENDIGUNG_KUENDBAR_SQL("kr_k")})`;

/**
 * Ein Kündigungsantrag liegt vor, ist aber NIE GEBUCHT (KUENDIGUNG_ANTRAEGE_SQL).
 * Er zählt nicht als wirksam (Entscheidung 08.10.) — er ist Arbeit: nachbuchen
 * über den E-213-Weg (Akte → „Jetzt buchen“, zum Eingangstag), oder die Leitung
 * entscheidet. `person` ist ein SQL-Ausdruck („p.id“, „$1::int“).
 */
export const KUENDIGUNG_UNGEBUCHT_SQL = (person: string): string =>
  `(${person} IN (SELECT kr_u.person_id FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_u))`;

export interface AntragBestellung extends KuendigungBestellung {
  archived_at?: unknown;
  gdpr_deleted_at?: unknown;
  pack_name?: unknown;
}

export interface AntragZiel {
  /** Die Bestellung, auf die gebucht würde — null, wenn es keine gibt. */
  ziel: string | null;
  /** Darf die Akte selbst buchen? Sonst nur die Leitung (mit `warum`). */
  buchbar: boolean;
  /** Das Ziel ist NICHT die Referenz des Antrags (zusammengeführt, storniert, nicht mehr da). */
  umgezogen: boolean;
  /** Für den Mitarbeiter: was gebucht wird bzw. warum die Leitung entscheidet. */
  satz: string;
}

/**
 * Worauf ein nie gebuchter Antrag gebucht wird (Kopf oben). `bestellungen` =
 * alle Bestellungen des Menschen (auch zusammengeführte). Rein.
 */
export function antragZiel(antrag: { ref: unknown; am: unknown }, bestellungen: readonly AntragBestellung[]): AntragZiel {
  const ref = String(antrag.ref ?? "");
  const antragMs = ms(antrag.am);
  const eigene = bestellungen.find((b) => String(b.ref ?? "") === ref) ?? null;
  const kuendbar = bestellungen.filter(bestellungKuendbar);
  // Die Fortsetzung einer zusammengeführten Bestellung (Kette merged_into, höchstens fünf Schritte) — nur, wenn sie
  // am Eingangstag schon bestand: Ein Paket, das erst danach kam, ist ein neuer Vertrag, keine Fortsetzung.
  let fortsetzung: AntragBestellung | null = null;
  for (let b = eigene, i = 0; b && !lebt(b) && i < 5; i++) {
    b = bestellungen.find((x) => String(x.ref ?? "") === String(b!.merged_into)) ?? null;
    if (b && bestellungKuendbar(b) && !(ms(b.created_at) > antragMs)) { fortsetzung = b; break; }
  }
  const eigeneKuendbar = !!eigene && bestellungKuendbar(eigene);
  const damals = kuendbar.filter((k) => !(ms(k.created_at) > antragMs));
  const gewaehlt = eigeneKuendbar ? eigene : fortsetzung ?? (damals.length === 1 ? damals[0] : null);
  const spaeter = kuendbar.filter((k) => k !== gewaehlt && ms(k.created_at) > antragMs);
  const name = (b: AntragBestellung) => `${String(b.pack_name ?? "").split("\n")[0] || "Paket"} (${String(b.ref)})`;
  const warumAlt = !eigene ? `Die Referenz ${ref} des Antrags gibt es nicht mehr`
    : !lebt(eigene) ? `Die Bestellung ${ref} des Antrags ist zusammengeführt`
    : String(eigene.payment_status) === "cancelled" ? `Die Bestellung ${ref} des Antrags ist storniert`
    : String(eigene.payment_status) === "superseded" ? `Die Bestellung ${ref} des Antrags ist abgelöst`
    : `Die Bestellung ${ref} des Antrags ist nicht kündbar`;
  if (gewaehlt && !spaeter.length) {
    return {
      ziel: String(gewaehlt.ref), buchbar: true, umgezogen: gewaehlt !== eigene,
      satz: gewaehlt === eigene ? `Gebucht wird ${name(gewaehlt)}.` : `${warumAlt} — gebucht wird ${name(gewaehlt)}, das Paket, das am Eingangstag bestand.`,
    };
  }
  // Die Leitung entscheidet — mit einem Vorschlag, wenn am Eingangstag ein Paket bestand. Ein Paket, das erst
  // NACH dem Antrag kam, wird nie vorgeschlagen (Fall 12363: „Jetzt buchen“ hätte die neue Bestellung storniert).
  const vorschlag = gewaehlt
    ?? [...damals].sort((x, y) => Number(String(y.payment_status) === "paid") - Number(String(x.payment_status) === "paid") || ms(y.created_at) - ms(x.created_at))[0]
    ?? null;
  const grund = spaeter.length
    ? `Nach dem Antrag kam ein neues Paket (${spaeter.map(name).join(", ")}) — ob die Kündigung auch dafür gilt, entscheidet die Leitung`
    : damals.length > 1 ? `Am Eingangstag bestanden mehrere Pakete (${damals.map(name).join(", ")}) — welches gemeint ist, entscheidet die Leitung`
    : `${warumAlt}, und kein anderes Paket bestand am Eingangstag — das entscheidet die Leitung`;
  // Ohne Vorschlag bleibt der Leitung: den Antrag als erledigt schließen (der Kunde ist mit dem neuen Paket wieder da)
  // oder das neue Paket ausdrücklich über „Kündigung durchsetzen“ kündigen.
  return {
    ziel: vorschlag ? String(vorschlag.ref) : null, buchbar: false, umgezogen: !!vorschlag && vorschlag !== eigene,
    satz: `${grund}.${vorschlag ? ` Vorschlag: ${name(vorschlag)}.` : ""}`,
  };
}

export type KuendigungPhase = "keine" | "laeuft_bis_ende" | "beendet";

/**
 * Die Phase eines wirksam Gekündigten. `ende` = Vertragsende als „JJJJ-MM-TT“
 * (Berlin) aus vertragsendeLesen; null heißt: Ende noch offen (Jahresvertrag,
 * dessen fällige Raten noch nicht alle bezahlt sind). `heute` = „JJJJ-MM-TT“
 * (Berlin). Rein.
 */
export function kuendigungPhase(wirksam: boolean, ende: string | null, heute: string): KuendigungPhase {
  if (!wirksam) return "keine";
  if (!ende) return "laeuft_bis_ende";
  return ende < heute ? "beendet" : "laeuft_bis_ende";
}

/** „JJJJ-MM-TT“ → „TT.MM.JJJJ“. Rein. */
export function tagDe(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/**
 * Eine gekündigte BONITÄTSAUSKUNFT (Zusatzprodukt). Sie beendet keinen Vertrag
 * und macht niemanden zum „Gekündigten“ (Regel oben) — sie ist aber ein Nein zu
 * DIESEM Produkt. Wer Auskünfte verkauft oder anbietet, nimmt sie zusätzlich
 * zur Regel dazu (E-IT-B: fiaon-auskunft-verkauf.ts, fiaon-auskunft-kauf.ts,
 * Maras Werkzeug) — so bekommt niemand ein Auskunft-Angebot, der die Auskunft
 * gerade gekündigt hat.
 */
export const AUSKUNFT_GEKUENDIGT_SQL = (person: string): string => `EXISTS (
  SELECT 1 FROM fiaon_applications kr_x WHERE kr_x.person_id = ${person} AND kr_x.merged_into IS NULL
     AND kr_x.gekuendigt_am IS NOT NULL AND ${produktkategorieSql("kr_x")} = 'auskunft')`;
