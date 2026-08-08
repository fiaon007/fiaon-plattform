// ═══════════════════════════════════════════════════════════════════════════
// DUBLETTEN-KANDIDATEN — nach Sicherheit sortiert, nie automatisch entschieden
//
// Vier Stufen, absteigend nach Belastbarkeit:
//
//   a) GLEICHE RUFNUMMER (phone_key9, die letzten neun Ziffern). Die stärkste
//      Spur im Bestand: Zwei Menschen teilen selten eine Mobilnummer.
//   b) GLEICHE E-MAIL. Stark, aber ausdrücklich KEIN Autopilot. Im Bestand
//      steht der Gegenbeweis: Ein Antrag lief unter „Magdalena", gehörte aber
//      zu Konstantinos Nikoloudis — dieselbe Adresse, zwei Menschen. Wer aus
//      E-Mail-Gleichheit automatisch einen Merge macht, führt genau diese zwei
//      Menschen zusammen.
//   c) ÄHNLICHER NAME + GLEICHES GEBURTSDATUM. Zwei unabhängige Merkmale.
//   d) NUR ÄHNLICHER NAME. Eine Vermutung, nicht mehr — und in der Oberfläche
//      genau so beschriftet. „Michael Berger" und „Michaela Berger" sind hier
//      ein Vorschlag und wären als Automatik ein Schaden.
//
// DIESE DATEI ENTSCHEIDET NICHTS. Sie stellt Paare zur Prüfung zusammen. Der
// Merge passiert in fiaon-person-merge.ts und nur, wenn ein Mensch ihn auslöst.
//
// WARUM DIE ÄHNLICHKEIT IN JS UND NICHT IN SQL
// Postgres könnte das mit `fuzzystrmatch`/`pg_trgm` — aber eine Extension, die
// auf der Produktionsdatenbank nicht installiert ist, lässt eine Migration
// scheitern und blockiert das Deployment. Der Bestand hat gut 4 800 Personen;
// mit Blockbildung ist der Vergleich hier eine Sache von Millisekunden.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export type Stufe = "telefon" | "email" | "name_geburtsdatum" | "name";

export const STUFE_TEXT: Record<Stufe, string> = {
  telefon: "Gleiche Rufnummer",
  email: "Gleiche E-Mail",
  name_geburtsdatum: "Ähnlicher Name + gleiches Geburtsdatum",
  name: "Nur ähnlicher Name (Vermutung)",
};

/** Reihenfolge der Sicherheit — kleiner ist belastbarer. */
const RANG: Record<Stufe, number> = { telefon: 1, email: 2, name_geburtsdatum: 3, name: 4 };

export interface KandidatPerson {
  id: number;
  personRef: string;
  name: string;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  phoneKey9: string | null;
  geburtsdatum: string | null;
  betreuerId: number | null;
  betreuerName: string | null;
  betreuungSeit: string | null;
  bestellungen: number;
  bezahlteBestellungen: number;
  letzterKontakt: string | null;
  angelegt: string | null;
}

export interface Kandidat {
  schluessel: string;
  stufe: Stufe;
  stufeText: string;
  vermutung: boolean;
  merkmal: string;
  /** Vorschlag, welche Seite bleiben sollte — nur ein Vorschlag. */
  vorschlagGewinnerId: number;
  links: KandidatPerson;
  rechts: KandidatPerson;
  /** Beide Seiten haben einen dokumentierten, VERSCHIEDENEN Betreuer. */
  betreuerStreit: boolean;
}

// ── Namensnormalisierung ───────────────────────────────────────────────────
const UMLAUTE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", å: "a", é: "e", è: "e", ê: "e", á: "a", à: "a", í: "i", ó: "o", ò: "o", ú: "u", ñ: "n", ç: "c" };

export function nameSchluessel(...teile: (string | null | undefined)[]): string {
  const roh = teile.filter(Boolean).join(" ").toLowerCase();
  const ersetzt = roh.replace(/[äöüßåéèêáàíóòúñç]/g, (z) => UMLAUTE[z] ?? z);
  const woerter = ersetzt
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  // Sortiert, damit „Conrad Axel" und „Axel Conrad" dieselbe Person sind — im
  // Bestand stehen Vor- und Nachname nachweislich mal so und mal so
  // (Person 6748: der ganze Name im Feld `first_name`).
  return woerter.sort().join(" ");
}

/** Levenshtein-Abstand mit Abbruch, sobald die Grenze überschritten ist. */
export function abstand(a: string, b: string, grenze: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  const kurz = a.length <= b.length ? a : b;
  const lang = a.length <= b.length ? b : a;
  let vorige = new Array<number>(kurz.length + 1);
  let aktuell = new Array<number>(kurz.length + 1);
  for (let i = 0; i <= kurz.length; i++) vorige[i] = i;
  for (let j = 1; j <= lang.length; j++) {
    aktuell[0] = j;
    let zeilenMin = aktuell[0];
    for (let i = 1; i <= kurz.length; i++) {
      const kosten = kurz[i - 1] === lang[j - 1] ? 0 : 1;
      aktuell[i] = Math.min(aktuell[i - 1] + 1, vorige[i] + 1, vorige[i - 1] + kosten);
      if (aktuell[i] < zeilenMin) zeilenMin = aktuell[i];
    }
    if (zeilenMin > grenze) return grenze + 1;
    [vorige, aktuell] = [aktuell, vorige];
  }
  return vorige[kurz.length];
}

/**
 * Sind zwei Namen ähnlich genug für einen Vorschlag?
 *
 * Die Grenze wächst mit der Länge: Bei „Bee"/„Boe" ist ein Zeichen Unterschied
 * ein anderer Name, bei „Konstantinos Nikoloudis" sind zwei Zeichen ein Tippfehler.
 */
export function nameAehnlich(a: string, b: string): { ja: boolean; abstand: number } {
  if (!a || !b) return { ja: false, abstand: 99 };
  if (a === b) return { ja: true, abstand: 0 };
  const laenge = Math.min(a.length, b.length);
  if (laenge < 5) return { ja: false, abstand: 99 };
  const grenze = laenge >= 16 ? 3 : laenge >= 10 ? 2 : 1;
  const d = abstand(a, b, grenze);
  return { ja: d <= grenze, abstand: d };
}

const paarSchluessel = (a: number, b: number): string =>
  a < b ? `${a}-${b}` : `${b}-${a}`;

// ── Testdatensätze ─────────────────────────────────────────────────────────
// Im Bestand teilen 32 Personen namens „Dev User" die Nummer …701234567 — eine
// Platzhalternummer aus der Entwicklung. Allein daraus entstünden 496
// Paar-Vorschläge, und der Arbeitsplatz wäre unbenutzbar, bevor er das erste
// echte Paar zeigt. Testdatensätze gehören ins Archiv (Grund „Testeintrag"),
// nicht in die Dubletten-Prüfung.
const TEST_MAIL = /(@fiaon-internal\.dev|\.invalid|@example\.(com|org))$/i;
const TEST_REF = /^(FIAON-P-TEST|FIA-DEV-)/i;

export function istTestKandidat(p: { email: string | null; personRef: string; name: string }): boolean {
  if (p.email && TEST_MAIL.test(p.email.trim())) return true;
  if (TEST_REF.test(p.personRef)) return true;
  return /^dev\s+user$/i.test(String(p.name ?? "").trim());
}

// ── Bestand laden ──────────────────────────────────────────────────────────
export async function ladePersonen(): Promise<KandidatPerson[]> {
  // EINE Abfrage mit vorab gruppierten Zahlen statt drei Unterabfragen je Person.
  // Die erste Fassung war korrekt und brauchte auf dem echten Bestand (4 800
  // Personen) sechs Sekunden — für eine Liste, die beim Öffnen der Seite und bei
  // jedem Zähler-Abruf geladen wird, ist das zu langsam.
  const rows = await sqlPool`
    WITH bestellzahlen AS (
      SELECT person_id,
             COUNT(*)::int AS anzahl,
             COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt
      FROM fiaon_applications
      WHERE person_id IS NOT NULL AND archived_at IS NULL
      GROUP BY person_id
    ), kontakte AS (
      SELECT a.person_id, MAX(c.created_at) AS letzter
      FROM fiaon_contact_log c
      JOIN fiaon_applications a ON a.ref = c.ref
      WHERE c.voided_at IS NULL AND a.person_id IS NOT NULL
      GROUP BY a.person_id
    )
    SELECT p.id, p.person_ref, p.first_name, p.last_name, p.company_name, p.contact_name,
           p.primary_email, p.primary_phone, p.phone_key9, p.birthdate,
           p.assigned_agent_id, p.betreuung_seit, p.created_at,
           ag.name AS agent_name,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           COALESCE(b.anzahl, 0) AS bestellungen,
           COALESCE(b.bezahlt, 0) AS bezahlte,
           k.letzter AS letzter_kontakt
    FROM fiaon_persons p
    LEFT JOIN bestellzahlen b ON b.person_id = p.id
    LEFT JOIN kontakte k ON k.person_id = p.id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL
  `;
  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    personRef: String(r.person_ref),
    name: String(r.name ?? r.person_ref),
    vorname: r.first_name ?? null,
    nachname: r.last_name ?? null,
    email: r.primary_email ?? null,
    telefon: r.primary_phone ?? null,
    phoneKey9: r.phone_key9 ?? null,
    geburtsdatum: r.birthdate ?? null,
    betreuerId: r.assigned_agent_id != null ? Number(r.assigned_agent_id) : null,
    betreuerName: r.agent_name ?? null,
    betreuungSeit: r.betreuung_seit ?? null,
    bestellungen: Number(r.bestellungen ?? 0),
    bezahlteBestellungen: Number(r.bezahlte ?? 0),
    letzterKontakt: r.letzter_kontakt ?? null,
    angelegt: r.created_at ?? null,
  }));
}

/** Bereits als „keine Dublette" abgehakte Paare. */
export async function ladeEntschieden(): Promise<Set<string>> {
  // NUR 'keine_dublette' unterdrückt einen Vorschlag. Ein zurückgenommenes Paar
  // steht als 'wieder_offen' in derselben Tabelle (kein Hard-Delete) und muss
  // wieder vorgeschlagen werden — sonst wäre ein Fehlklick unumkehrbar.
  const rows = await sqlPool`
    SELECT person_a, person_b FROM fiaon_dubletten_entschieden
    WHERE entscheidung = 'keine_dublette'
  `.catch(() => []);
  return new Set((rows as any[]).map((r) => paarSchluessel(Number(r.person_a), Number(r.person_b))));
}

/** E-Mail-Aliase — damit auch eine frühere Adresse als Treffer zählt. */
async function ladeMailAliase(): Promise<Map<number, string[]>> {
  const rows = await sqlPool`
    SELECT a.person_id, a.value_norm
    FROM fiaon_person_aliases a
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE a.kind = 'email' AND COALESCE(a.value_norm, '') <> ''
  `.catch(() => []);
  const map = new Map<number, string[]>();
  for (const r of rows as any[]) {
    const id = Number(r.person_id);
    const arr = map.get(id) ?? [];
    arr.push(String(r.value_norm));
    map.set(id, arr);
  }
  return map;
}

export interface KandidatenOptionen {
  /** Auch Paare zeigen, die schon zusammengeführt sind — als Nachweis, dass die Suche greift. */
  auchGemergte?: boolean;
  /** Nur diese Stufen. */
  stufen?: Stufe[];
  grenze?: number;
}

// ── Zwischenspeicher ───────────────────────────────────────────────────────
// Die Suche liest den ganzen Personenbestand. Sie wird an drei Stellen
// gebraucht (Liste, Zähler im Admin-Menü, Reiter der Vertriebsleitung) und der
// Zähler fragt im Minutentakt. Ohne diesen Speicher lief die Suche allein für
// die Zahl im Menü stündlich 60-mal über 4 800 Personen.
//
// Zwei Minuten sind bewusst kurz: Eine Entscheidung soll sofort aus der Liste
// verschwinden — deshalb leert jeder Merge und jedes „keine Dublette" den
// Speicher ausdrücklich (kandidatenCacheLeeren).
let speicher: { at: number; liste: Kandidat[] } | null = null;
const SPEICHER_MS = 120_000;

export function kandidatenCacheLeeren(): void {
  speicher = null;
}

/**
 * Die Zahlen NUR aus dem Speicher — ohne die Datenbank zu fragen.
 *
 * Für den Zähler im Admin-Menü: Er wird im Minutentakt abgerufen und darf die
 * Suche (rund vier Sekunden gegen den echten Bestand) nicht bezahlen. Er zeigt
 * dieselbe Zahl wie die Liste, nur bis zu zwei Minuten alt — eine zweite,
 * billigere Zählregel wäre der Anfang von zwei Wahrheiten.
 */
export function kandidatenZahlenSofort(): { gesamt: number; jeStufe: Record<Stufe, number> } | null {
  if (!speicher || Date.now() - speicher.at >= SPEICHER_MS) return null;
  const jeStufe: Record<Stufe, number> = { telefon: 0, email: 0, name_geburtsdatum: 0, name: 0 };
  for (const k of speicher.liste) jeStufe[k.stufe]++;
  return { gesamt: speicher.liste.length, jeStufe };
}

let waermtGerade = false;
/** Speicher im Hintergrund füllen, ohne den Aufrufer warten zu lassen. */
export function kandidatenWaermen(): void {
  if (waermtGerade) return;
  if (speicher && Date.now() - speicher.at < SPEICHER_MS) return;
  waermtGerade = true;
  // Kurz warten, damit die Suche nicht mit der Anfrage konkurriert, die sie
  // ausgelöst hat: Ohne diese Verzögerung teilten sich beide den Verbindungs-
  // Pool und der Zähler-Abruf wurde dadurch langsamer statt schneller.
  setTimeout(() => {
    void findeKandidaten()
      .catch((e) => console.error("[FIAON-DUBLETTEN] Vorwärmen:", e))
      .finally(() => { waermtGerade = false; });
  }, 2000);
}

/**
 * Alle Kandidatenpaare, nach Sicherheit sortiert.
 *
 * Ein Paar erscheint genau EINMAL, mit seiner stärksten Stufe: Zwei Personen mit
 * gleicher Nummer UND gleicher E-Mail sind ein Telefon-Treffer, nicht zwei
 * Vorschläge. Sonst würde dieselbe Entscheidung zweimal verlangt.
 */
export async function findeKandidaten(opts: KandidatenOptionen = {}): Promise<Kandidat[]> {
  if (speicher && Date.now() - speicher.at < SPEICHER_MS) {
    return zuschneiden(speicher.liste, opts);
  }
  const alle = await ladePersonen();
  const personen = alle.filter((p) => !istTestKandidat(p));
  const entschieden = await ladeEntschieden();
  const mailAliase = await ladeMailAliase();
  const nach = new Map(personen.map((p) => [p.id, p]));

  /** stärkste Stufe je Paar */
  const gefunden = new Map<string, { stufe: Stufe; merkmal: string; a: number; b: number }>();
  /** Alle Paare innerhalb einer Gruppe — auch die, die die Kette auslässt. */
  const imVerbund = new Set<string>();
  /** Die Paare, die die Kette tatsächlich vorschlägt. */
  const inKette = new Set<string>();

  const merke = (a: number, b: number, stufe: Stufe, merkmal: string) => {
    if (a === b) return;
    const k = paarSchluessel(a, b);
    if (entschieden.has(k)) return;
    // Ausgelassene Paare einer Gruppe bleiben ausgelassen — auf JEDER Stufe.
    // Sonst kämen die 28 übersprungenen Fricker-Paare über „ähnlicher Name +
    // gleiches Geburtsdatum" wieder herein, und die Kette hätte die Arbeit nur
    // in eine schwächere Stufe verschoben statt sie zu sparen.
    if (imVerbund.has(k) && !inKette.has(k)) return;
    const alt = gefunden.get(k);
    if (alt && RANG[alt.stufe] <= RANG[stufe]) return;
    gefunden.set(k, { stufe, merkmal, a: Math.min(a, b), b: Math.max(a, b) });
  };

  /** Wie tragfähig ist eine Person als bleibende Seite? */
  const punkte = (p: KandidatPerson) =>
    p.bezahlteBestellungen * 1000 + (p.betreuungSeit ? 100 : 0) + p.bestellungen * 10;

  /**
   * Eine Gruppe (gleiche Nummer, gleiche E-Mail) als KETTE, nicht als Kreuz.
   *
   * „Mario Fricker" liegt neunmal mit derselben Rufnummer. Alle Paare daraus
   * wären 36 Entscheidungen für einen Sachverhalt — und 35 davon lösen sich von
   * selbst, sobald die erste getroffen ist (der Verlierer verschwindet). Deshalb
   * bekommt die Gruppe einen Anker (die tragfähigste Seite) und je einen
   * Vorschlag gegen die anderen: acht statt 36.
   *
   * Wer ein Paar als „keine Dublette" abgehakt hat, bekommt keinen neuen Anker
   * aufgezwungen: Dann wird die betroffene Person selbst zum Anker, damit ihre
   * übrigen Verwandtschaften weiterhin prüfbar bleiben.
   */
  const merkeGruppe = (ids: number[], stufe: Stufe, merkmal: string) => {
    const sortiert = ids
      .map((id) => nach.get(id))
      .filter((p): p is KandidatPerson => !!p)
      .sort((a, b) => punkte(b) - punkte(a) || a.id - b.id);
    if (sortiert.length < 2) return;
    for (let i = 0; i < sortiert.length; i++) {
      for (let j = i + 1; j < sortiert.length; j++) {
        imVerbund.add(paarSchluessel(sortiert[i].id, sortiert[j].id));
      }
    }
    const anker: number[] = [sortiert[0].id];
    const kette: [number, number][] = [];
    for (const p of sortiert.slice(1)) {
      const passend = anker.find((a) => !entschieden.has(paarSchluessel(a, p.id)));
      if (passend != null) {
        inKette.add(paarSchluessel(passend, p.id));
        kette.push([passend, p.id]);
      } else anker.push(p.id);
    }
    for (const [a, b] of kette) merke(a, b, stufe, merkmal);
  };

  // ── Stufe a: gleiche Rufnummer ────────────────────────────────────────
  const nachTelefon = new Map<string, number[]>();
  for (const p of personen) {
    if (!p.phoneKey9 || p.phoneKey9.length < 7) continue;
    const arr = nachTelefon.get(p.phoneKey9) ?? [];
    arr.push(p.id);
    nachTelefon.set(p.phoneKey9, arr);
  }
  for (const [key, ids] of Array.from(nachTelefon.entries())) {
    if (ids.length < 2) continue;
    merkeGruppe(ids, "telefon", `Rufnummer …${key}${ids.length > 2 ? ` (${ids.length} Datensätze)` : ""}`);
  }

  // ── Stufe b: gleiche E-Mail (auch über frühere Adressen) ──────────────
  const nachMail = new Map<string, Set<number>>();
  for (const p of personen) {
    const mails = new Set<string>();
    if (p.email) mails.add(p.email.trim().toLowerCase());
    for (const m of mailAliase.get(p.id) ?? []) mails.add(m);
    for (const m of Array.from(mails)) {
      if (!m || !m.includes("@")) continue;
      const s = nachMail.get(m) ?? new Set<number>();
      s.add(p.id);
      nachMail.set(m, s);
    }
  }
  for (const [mail, set] of Array.from(nachMail.entries())) {
    const ids: number[] = Array.from(set);
    if (ids.length < 2) continue;
    merkeGruppe(ids, "email", `E-Mail ${mail}${ids.length > 2 ? ` (${ids.length} Datensätze)` : ""}`);
  }

  // ── Stufe c/d: Namensähnlichkeit ──────────────────────────────────────
  // Blockbildung: Nur Personen, die sich einen Anfang, ein Ende oder das
  // Geburtsdatum teilen, werden verglichen. Ohne diese Bündelung wären es
  // 11 Millionen Vergleiche für ein Ergebnis, das dieselben Paare findet.
  const schluessel = new Map<number, string>();
  for (const p of personen) schluessel.set(p.id, nameSchluessel(p.vorname, p.nachname, p.name));

  const bloecke = new Map<string, number[]>();
  const inBlock = (k: string, id: number) => {
    const arr = bloecke.get(k) ?? [];
    arr.push(id);
    bloecke.set(k, arr);
  };
  for (const p of personen) {
    const k = schluessel.get(p.id) ?? "";
    if (k.length < 5) continue;
    inBlock(`A:${k.slice(0, 3)}`, p.id);
    inBlock(`E:${k.slice(-3)}`, p.id);
    if (p.geburtsdatum) inBlock(`G:${p.geburtsdatum}`, p.id);
  }

  for (const ids of Array.from(bloecke.values())) {
    if (ids.length < 2 || ids.length > 400) continue; // riesige Blöcke sind kein Merkmal
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p = nach.get(ids[i])!;
        const q = nach.get(ids[j])!;
        const kp = schluessel.get(p.id) ?? "";
        const kq = schluessel.get(q.id) ?? "";
        const ae = nameAehnlich(kp, kq);
        if (!ae.ja) continue;
        const gleichesDatum = !!p.geburtsdatum && p.geburtsdatum === q.geburtsdatum;
        if (gleichesDatum) {
          merke(p.id, q.id, "name_geburtsdatum",
            `Name ähnlich (Abstand ${ae.abstand}) und Geburtsdatum ${p.geburtsdatum}`);
        } else {
          merke(p.id, q.id, "name", `Name ähnlich (Abstand ${ae.abstand})`);
        }
      }
    }
  }

  // ── Zusammenstellen ──────────────────────────────────────────────────
  const zeit = (v: string | null) => (v ? new Date(v).getTime() : 0);

  let liste: Kandidat[] = [];
  const treffer_liste: [string, { stufe: Stufe; merkmal: string; a: number; b: number }][] =
    Array.from(gefunden.entries());
  for (const [k, treffer] of treffer_liste) {
    const links = nach.get(treffer.a);
    const rechts = nach.get(treffer.b);
    if (!links || !rechts) continue;

    // Vorschlag für den Gewinner: die Seite mit bezahlten Bestellungen, sonst
    // mit dokumentiertem Betreuer, sonst die ältere Akte. Ein Vorschlag, kein
    // Beschluss — der Mensch kann in der Gegenüberstellung tauschen.
    const pl = punkte(links);
    const pr = punkte(rechts);
    const vorschlagGewinnerId = pl === pr
      ? (zeit(links.angelegt) <= zeit(rechts.angelegt) ? links.id : rechts.id)
      : (pl > pr ? links.id : rechts.id);

    liste.push({
      schluessel: k,
      stufe: treffer.stufe,
      stufeText: STUFE_TEXT[treffer.stufe],
      vermutung: treffer.stufe === "name",
      merkmal: treffer.merkmal,
      vorschlagGewinnerId,
      links, rechts,
      betreuerStreit: !!links.betreuungSeit && !!rechts.betreuungSeit
        && links.betreuerId != null && rechts.betreuerId != null
        && links.betreuerId !== rechts.betreuerId,
    });
  }

  liste.sort((a, b) =>
    RANG[a.stufe] - RANG[b.stufe]
    || (b.links.bezahlteBestellungen + b.rechts.bezahlteBestellungen)
       - (a.links.bezahlteBestellungen + a.rechts.bezahlteBestellungen)
    || a.links.id - b.links.id);

  speicher = { at: Date.now(), liste };
  return zuschneiden(liste, opts);
}

/** Stufenfilter und Obergrenze — auf der vollen Liste aus dem Speicher. */
function zuschneiden(liste: Kandidat[], opts: KandidatenOptionen): Kandidat[] {
  let raus = liste;
  if (opts.stufen && opts.stufen.length > 0) {
    const nur = new Set(opts.stufen);
    raus = raus.filter((k) => nur.has(k.stufe));
  }
  if (opts.grenze && opts.grenze > 0) raus = raus.slice(0, opts.grenze);
  return raus;
}

/** Wie viele Paare warten je Stufe? Grundlage für den Zähler im Menü. */
export async function kandidatenZahlen(): Promise<{ gesamt: number; jeStufe: Record<Stufe, number> }> {
  const alle = await findeKandidaten();
  const jeStufe: Record<Stufe, number> = { telefon: 0, email: 0, name_geburtsdatum: 0, name: 0 };
  for (const k of alle) jeStufe[k.stufe]++;
  return { gesamt: alle.length, jeStufe };
}

/**
 * Gegenüberstellung eines Paares: alle Felder, beide Bestellungslisten und die
 * letzten fünf Verlaufseinträge je Seite.
 */
export async function gegenueberstellung(idA: number, idB: number): Promise<any> {
  const seite = async (id: number) => {
    const [p] = await sqlPool`
      SELECT p.*, ag.name AS agent_name,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE p.id = ${id}
    `;
    if (!p) return null;
    const bestellungen = await sqlPool`
      SELECT ref, pack_name, payment_status, amount_due, payment_due_date, created_at,
             archived_at, archived_reason, invoice_number
      FROM fiaon_applications WHERE person_id = ${id}
      ORDER BY created_at DESC
    `;
    const verlauf = await sqlPool`
      SELECT c.created_at, c.type, c.outcome, c.note, c.agent_name, c.ref
      FROM fiaon_contact_log c
      JOIN fiaon_applications a ON a.ref = c.ref
      WHERE a.person_id = ${id} AND c.voided_at IS NULL
      ORDER BY c.created_at DESC LIMIT 5
    `;
    const aliase = await sqlPool`
      SELECT kind, COALESCE(feld_wert, value_raw, value_norm) AS wert, quelle_person_id
      FROM fiaon_person_aliases WHERE person_id = ${id} ORDER BY created_at DESC LIMIT 20
    `;
    return {
      id: Number(p.id),
      personRef: p.person_ref,
      name: p.name,
      felder: {
        first_name: p.first_name, last_name: p.last_name, company_name: p.company_name,
        contact_name: p.contact_name, primary_email: p.primary_email,
        primary_phone: p.primary_phone, birthdate: p.birthdate,
        street: p.street, zip: p.zip, city: p.city, country: p.country,
        nationality: p.nationality,
      },
      kontoStatus: p.account_status,
      gesperrt: !!p.is_blocked,
      betreuerId: p.assigned_agent_id != null ? Number(p.assigned_agent_id) : null,
      betreuerName: p.agent_name ?? null,
      betreuungSeit: p.betreuung_seit ?? null,
      zusage: p.promised_payment_date ?? null,
      wiedervorlage: p.follow_up_date ?? null,
      angelegt: p.created_at,
      bestellungen: (bestellungen as any[]).map((b) => ({
        ref: b.ref, paket: b.pack_name, status: b.payment_status,
        betrag: b.amount_due, frist: b.payment_due_date, angelegt: b.created_at,
        archiviertAm: b.archived_at, archivGrund: b.archived_reason,
        rechnung: b.invoice_number,
      })),
      verlauf: (verlauf as any[]).map((v) => ({
        am: v.created_at, art: v.type, ergebnis: v.outcome,
        notiz: v.note, agent: v.agent_name, ref: v.ref,
      })),
      aliase: (aliase as any[]).map((a) => ({ art: a.kind, wert: a.wert, quelle: a.quelle_person_id })),
      letzterKontakt: (verlauf as any[])[0]?.created_at ?? null,
    };
  };

  const [links, rechts] = await Promise.all([seite(idA), seite(idB)]);
  if (!links || !rechts) return null;

  // Abweichungen benennen — und pro Feld die Vorgabe setzen: die Seite mit dem
  // jüngeren dokumentierten Kontakt. Wer zuletzt mit dem Kunden gesprochen hat,
  // hat mit höherer Wahrscheinlichkeit den aktuellen Stand.
  const jüngerLinks = new Date(links.letzterKontakt ?? 0).getTime() >= new Date(rechts.letzterKontakt ?? 0).getTime();
  const abweichungen = Object.keys(links.felder)
    .filter((f) => {
      const a = (links.felder as any)[f];
      const b = (rechts.felder as any)[f];
      const norm = (v: any) => (v == null ? "" : String(v).trim().toLowerCase());
      return norm(a) !== norm(b) && (norm(a) !== "" || norm(b) !== "");
    })
    .map((f) => ({
      feld: f,
      vorgabe: jüngerLinks ? "links" : "rechts",
      linksLeer: (links.felder as any)[f] == null || String((links.felder as any)[f]).trim() === "",
      rechtsLeer: (rechts.felder as any)[f] == null || String((rechts.felder as any)[f]).trim() === "",
    }));

  return {
    links, rechts, abweichungen,
    vorgabeSeite: jüngerLinks ? "links" : "rechts",
    betreuerStreit: !!links.betreuungSeit && !!rechts.betreuungSeit
      && links.betreuerId != null && rechts.betreuerId != null
      && links.betreuerId !== rechts.betreuerId,
  };
}
