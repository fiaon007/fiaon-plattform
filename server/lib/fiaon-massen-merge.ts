// ═══════════════════════════════════════════════════════════════════════════
// MASSEN-ZUSAMMENFÜHRUNG — Gruppen statt Paare, Beweis statt Vermutung
//
// AUSGANGSLAGE
// Der Bestand kennt Menschen, die fünfmal als Person geführt werden — mit fünf
// lebenden Bestellungen, fünf Verläufen, fünf Mahnketten. Über Paare ist das
// nicht zu räumen: Fünf Sätze ergeben zehn Paare, und neun davon lösen sich von
// selbst, sobald der erste entschieden ist. Ein Mensch soll das nicht 1.100-mal
// durchklicken.
//
// DIE ZWEI FEHLER, DIE ES ZU VERMEIDEN GILT
//   1. Zu wenig zusammenführen — dann bleibt die Kartei doppelt.
//   2. Zu viel zusammenführen — dann verschmelzen zwei Menschen zu einem, und
//      das ist NICHT rückholbar in dem Sinne, der zählt: Der Kunde bekommt
//      die Rechnung eines Fremden zu sehen.
//
// Der Bestand hat für Fehler 2 die Belege selbst geliefert:
//   · „Franz Molk" und „Gerda Molk" teilen einen Anschluss — Eheleute.
//   · Ein Antrag lief unter „Magdalena", gehörte aber zu Konstantinos
//     Nikoloudis — dieselbe E-Mail, zwei Menschen.
// Ein einzelnes Merkmal beweist nichts. Deshalb verlangt JEDES Kriterium hier
// ZWEI übereinstimmende Merkmale, und der Name muss vereinbar sein.
//
// DIE KRITERIEN (mehr gibt es nicht; alles andere wird nicht automatisch getan)
//   A  gleiche E-Mail UND gleiche Rufnummer
//   B  gleiche Rufnummer UND gleicher Nachname UND Vornamen vereinbar
//   C  gleiche Rufnummer UND gleiches Geburtsdatum
//   D  gleiche E-Mail UND Namen vereinbar
//   E  gleicher Nachname UND gleiches Geburtsdatum UND Vornamen vereinbar
//
// Nachname allein genügt NIE — sonst verschmelzen alle Müllers.
//
// GRUPPEN STATT PAARE
// Jede Übereinstimmung ist eine Kante. Zusammenhangskomponenten sind die
// Gruppen: Sind A~B (Telefon) und B~C (E-Mail) verbunden, ist {A,B,C} EIN
// Mensch mit EINEM Merge-Ziel — auch wenn A und C kein gemeinsames Merkmal
// haben. Das ist gewollt: B beweist die Verbindung.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  abstand, istAttrappenNummer, istTestKandidat, nameSchluessel,
  type KandidatPerson,
} from "./fiaon-dubletten-kandidaten";

type Lauf = typeof sqlPool;

export type Kriterium = "A" | "B" | "C" | "D" | "E";

export const KRITERIUM_TEXT: Record<Kriterium, string> = {
  A: "Gleiche E-Mail und gleiche Rufnummer",
  B: "Gleiche Rufnummer, gleicher Nachname, Vornamen vereinbar",
  C: "Gleiche Rufnummer und gleiches Geburtsdatum",
  D: "Gleiche E-Mail und Namen vereinbar",
  E: "Gleicher Nachname, gleiches Geburtsdatum, Vornamen vereinbar",
};

export interface MassenPerson extends KandidatPerson {
  /** Alle je genutzten Adressen, normalisiert (inkl. Aliase). */
  mails: string[];
  /** Alle je genutzten Rufnummern als 9-Ziffern-Schlüssel (inkl. Aliase). */
  nummern: string[];
  /** Wohnadresse — hartes Zweitmerkmal für die Widerspruchsprüfung. */
  strasse: string | null;
  plz: string | null;
  /** Jüngste bankbestätigte Zahlung dieser Person. */
  letzteZahlung: string | null;
  /** Eine Bestellung dieser Person ist DSGVO-gelöscht — Finger weg. */
  gdprGesperrt: boolean;
  /** Konto ausdrücklich gesperrt (DSGVO-Entscheidung eines Menschen). */
  gesperrt: boolean;
}

export interface GruppenMitglied {
  person: MassenPerson;
  /** Über welches Kriterium diese Person an der Gruppe hängt. */
  kriterium: Kriterium;
  /** Woran genau — für den Report. */
  merkmal: string;
}

export interface Gruppe {
  /** Kleinste Personen-ID der Gruppe — stabile Kennung über Läufe hinweg. */
  id: number;
  gewinner: MassenPerson;
  gewinnerGrund: string;
  verlierer: GruppenMitglied[];
  /** Alle in der Gruppe vorkommenden Kriterien, absteigend nach Härte. */
  kriterien: Kriterium[];
  bestellungen: number;
  bezahlteBestellungen: number;
  /** Zuständigkeit: Agent mit dem jüngsten dokumentierten Kontakt der Gruppe. */
  betreuerId: number | null;
  betreuerName: string | null;
  betreuerGrund: string;
  /** Mehr als ein dokumentierter Betreuer in der Gruppe? */
  betreuerKonflikt: boolean;
  betreuerVerdraengt: { agentId: number; name: string | null }[];
}

export interface Ausschluss {
  a: MassenPerson;
  b: MassenPerson;
  grund: string;
}

// ── Namen: wann sind zwei Vornamen derselbe Mensch? ────────────────────────
//
// „Alex" und „Alexander" ja. „Ann" und „Anna" ja. „Franz" und „Gerda" nein.
// Zwei Feinheiten, die aus den echten Daten kommen:
//
//   · Bei KURZEN Namen ist ein Abstand von 2 kein Tippfehler mehr, sondern ein
//     anderer Name: „Lisa"/„Lena", „Jan"/„Tim". Deshalb gilt Abstand 2 erst ab
//     fünf Zeichen, darunter nur Abstand 1.
//   · Doppelnamen („Anna Maria") werden über die Bestandteile verglichen. Ist
//     eine Seite eine Teilmenge der anderen, sind sie vereinbar.
export function vornamenVereinbar(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = nameSchluessel(a);
  const nb = nameSchluessel(b);
  // Eine Seite leer: kein Widerspruch. Der Nachweis kommt dann aus dem zweiten
  // Merkmal des Kriteriums (Nummer, E-Mail oder Geburtsdatum).
  if (!na || !nb) return true;
  if (na === nb) return true;

  const teileA = na.split(" ").filter(Boolean);
  const teileB = nb.split(" ").filter(Boolean);
  const mengeA = new Set(teileA);
  const mengeB = new Set(teileB);
  if (teileA.every((t) => mengeB.has(t))) return true;
  if (teileB.every((t) => mengeA.has(t))) return true;

  // Sonst: der jeweils erste Bestandteil muss zusammenpassen.
  const ka = teileA[0] ?? "";
  const kb = teileB[0] ?? "";
  if (!ka || !kb) return false;
  if (ka === kb) return true;

  const kurz = ka.length <= kb.length ? ka : kb;
  const lang = ka.length <= kb.length ? kb : ka;
  // Kurzform: „Alex" in „Alexander". Ab drei Zeichen, sonst wäre „Jo" alles.
  if (kurz.length >= 3 && lang.startsWith(kurz)) return true;

  const grenze = lang.length >= 5 ? 2 : 1;
  return abstand(ka, kb, grenze) <= grenze;
}

/** Nachnamen gelten als gleich, wenn sie normalisiert übereinstimmen. */
export function nachnamenGleich(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = nameSchluessel(a);
  const nb = nameSchluessel(b);
  return !!na && na === nb;
}

/** Ganze Namen vereinbar (Kriterium D): Vor- UND Nachname dürfen sich nicht widersprechen. */
export function namenVereinbar(a: MassenPerson, b: MassenPerson): boolean {
  const nachA = nameSchluessel(a.nachname);
  const nachB = nameSchluessel(b.nachname);
  // Widersprechende Nachnamen schlagen alles — „Magdalena Weber" und
  // „Konstantinos Nikoloudis" an einer Adresse sind zwei Menschen.
  if (nachA && nachB && nachA !== nachB && abstand(nachA, nachB, 2) > 2) return false;
  return vornamenVereinbar(a.vorname, b.vorname);
}

const geburtstagGleich = (a: MassenPerson, b: MassenPerson): boolean => {
  const da = a.geburtsdatum ? String(a.geburtsdatum).slice(0, 10) : "";
  const db = b.geburtsdatum ? String(b.geburtsdatum).slice(0, 10) : "";
  return !!da && da === db;
};

const schnitt = (a: string[], b: string[]): string | null => {
  const s = new Set(a);
  for (const x of b) if (s.has(x)) return x;
  return null;
};

// ── DIE WIDERSPRUCHS-WAND (30.08.2026) ─────────────────────────────────────
//
// ── WAS SIE SOLL ───────────────────────────────────────────────────────────
// Bisher war jedes Kriterium für sich zuständig: B und E prüften den Nachnamen,
// A, C und D nicht. Zwei Sätze mit gleicher E-Mail und gleicher Nummer galten
// als bewiesen — auch wenn sie verschiedene Nachnamen und verschiedene
// Geburtsdaten trugen. Ein gemeinsamer Anschluss und ein gemeinsames Postfach
// sind in einem Haushalt aber der Normalfall, nicht der Beweis.
//
// Diese Funktion prüft deshalb VOR allen Kriterien, ob ein hartes Zweitmerkmal
// WIDERSPRICHT. Tut es das, entsteht keine Kante — das Paar bleibt Kandidat in
// /admin/dubletten und wartet auf einen Menschen. Es wird nicht verworfen.
//
// ── WARUM „WIDERSPRICHT" UND NICHT „STIMMT ÜBEREIN" ────────────────────────
// GEMESSEN an den 742 protokollierten Merges (`scripts/mess-merge-regel.ts`):
//   · „Nachname muß gleich sein"        hätte 27 blockiert — 4 davon nur, weil
//     ein Nachname FEHLTE.
//   · „Nachname darf nicht widersprechen" blockiert 23.
// Eine Lücke ist keine Aussage. Genau so behandelt `vornamenVereinbar` seit dem
// ersten Tag die Vornamen; zwei verschiedene Maßstäbe für Vor- und Nachname
// wären eine zweite Wahrheit im selben Modul.
//
// Insgesamt macht die Wand 52 der 742 Merges (7 %) zu Kandidaten. Das ist der
// Grund, warum sie so und nicht strenger gebaut ist: Eine Bremse, die bei jedem
// dritten Fall grundlos auslöst, schaltet nach dem zweiten Lauf jemand ab.
//
// Die Zahl kommt aus `scripts/mess-merge-regel.ts`, und der Lauf ruft DIESE
// Funktion auf — nicht eine Nachbildung. Wer die Regel ändert, bekommt die
// neue Zahl, ohne die Messung anzufassen.
const strassePlz = (v: string | null | undefined): string =>
  String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** An wie vielen Stellen unterscheiden sich zwei Datumsangaben? 1 = Tippfehler. */
function datumStellen(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * Widerspricht ein hartes Zweitmerkmal? Dann ist es kein Beweis mehr, sondern
 * ein Fall für einen Menschen. Rückgabe ist der Klartext-Grund oder `null`.
 */
export function harterWiderspruch(p: MassenPerson, q: MassenPerson): string | null {
  // ── Nachname ──────────────────────────────────────────────────────────────
  //
  // EIN UNBRAUCHBARER NAME WIDERSPRICHT NICHT. Der Prüfstand hat diese Lücke
  // sofort gefunden: „Ortsfall Ortsfall" (nachgebaut nach dem echten Satz
  // „Wien Wien" — eine Stadt in beiden Namensfeldern) gegen „Milan Acimovic"
  // ist derselbe Mensch, und der Lauf übernimmt danach ausdrücklich den
  // saubereren Namen (`besserenNamenFinden`). Ein strenger Nachnamen-Vergleich
  // hätte genau diese Reparatur verhindert — und zwei Prüfungen, die es seit
  // Wochen gibt, wurden rot.
  //
  // `namensGuete` beurteilt schon die FORM eines Namens (Ziffern drin, Vor- und
  // Nachname identisch, einbuchstabige Teile). Ist sie negativ, ist der Name
  // Datenmüll und trägt keine Aussage — dieselbe Behandlung wie eine Lücke.
  const na = nameSchluessel(p.nachname);
  const nb = nameSchluessel(q.nachname);
  const brauchbar = namensGuete(p.vorname, p.nachname) >= 0 && namensGuete(q.vorname, q.nachname) >= 0;
  if (brauchbar && na && nb && na !== nb && abstand(na, nb, 2) > 2) {
    return `Nachname „${p.nachname}" widerspricht „${q.nachname}"`;
  }

  // ── Geburtsdatum ──────────────────────────────────────────────────────────
  // Eine Abweichung an EINER Stelle ist ein Tippfehler (GEMESSEN: 11 Fälle,
  // alle mit gleicher Adresse und gleicher Nummer). Ab zwei Stellen ist es
  // eine andere Angabe — und bei Vater und Sohn genau das entscheidende Merkmal.
  const da = p.geburtsdatum ? String(p.geburtsdatum).slice(0, 10) : "";
  const db = q.geburtsdatum ? String(q.geburtsdatum).slice(0, 10) : "";
  if (da && db && da !== db && datumStellen(da, db) > 1) {
    return `Geburtsdatum ${da} widerspricht ${db}`;
  }

  // ── Adresse ───────────────────────────────────────────────────────────────
  // Nur wenn BEIDE Teile auf BEIDEN Seiten stehen und BEIDE abweichen. Eine
  // andere Straße bei gleicher PLZ ist ein Umzug im Ort oder ein Tippfehler;
  // eine andere Straße in einer anderen PLZ sind zwei Haushalte.
  const sa = strassePlz(p.strasse); const sb = strassePlz(q.strasse);
  const za = strassePlz(p.plz); const zb = strassePlz(q.plz);
  if (sa && sb && za && zb && sa !== sb && za !== zb) {
    return `Adresse ${p.strasse}, ${p.plz} widerspricht ${q.strasse}, ${q.plz}`;
  }

  return null;
}

/**
 * Welches Kriterium beweist, dass diese zwei Sätze derselbe Mensch sind?
 *
 * Reihenfolge ist Absicht: A ist der härteste Beweis. Der erste Treffer gilt.
 *
 * VOR jedem Kriterium steht die Widerspruchs-Wand: Ein hartes Zweitmerkmal, das
 * widerspricht, schlägt jedes gemeinsame Merkmal. Ein Anschluss und ein
 * Postfach werden geteilt; ein Geburtsdatum nicht.
 */
export function kriteriumFuer(p: MassenPerson, q: MassenPerson): { kriterium: Kriterium; merkmal: string } | null {
  if (harterWiderspruch(p, q)) return null;

  const mail = schnitt(p.mails, q.mails);
  const nummer = schnitt(p.nummern, q.nummern);

  if (mail && nummer) return { kriterium: "A", merkmal: `E-Mail ${mail} und Rufnummer …${nummer}` };
  if (nummer && nachnamenGleich(p.nachname, q.nachname) && vornamenVereinbar(p.vorname, q.vorname)) {
    return { kriterium: "B", merkmal: `Rufnummer …${nummer} und Nachname ${p.nachname}` };
  }
  if (nummer && geburtstagGleich(p, q)) {
    return { kriterium: "C", merkmal: `Rufnummer …${nummer} und Geburtsdatum ${String(p.geburtsdatum).slice(0, 10)}` };
  }
  if (mail && namenVereinbar(p, q)) return { kriterium: "D", merkmal: `E-Mail ${mail} und vereinbare Namen` };
  if (nachnamenGleich(p.nachname, q.nachname) && geburtstagGleich(p, q) && vornamenVereinbar(p.vorname, q.vorname)) {
    return { kriterium: "E", merkmal: `Nachname ${p.nachname} und Geburtsdatum ${String(p.geburtsdatum).slice(0, 10)}` };
  }
  return null;
}

/**
 * Wer darf überhaupt automatisch angefasst werden?
 *
 * Testkonten, DSGVO-Fälle und gesperrte Konten bleiben draußen. Ein Testeintrag
 * in einer echten Akte ist nicht mehr sauber zu trennen, und eine DSGVO-Löschung
 * ist eine dokumentierte Entscheidung, die kein Lauf überfahren darf.
 */
export function darfAutomatisch(p: MassenPerson): { ja: boolean; grund?: string } {
  if (istTestKandidat({ email: p.email, personRef: p.personRef, name: p.name })) {
    return { ja: false, grund: "Testdatensatz" };
  }
  if (p.gdprGesperrt) return { ja: false, grund: "DSGVO-gelöschte Bestellung" };
  if (p.gesperrt) return { ja: false, grund: "Konto gesperrt (dokumentierte Entscheidung)" };
  return { ja: true };
}

// ── Bestand laden ──────────────────────────────────────────────────────────
/**
 * Alle lebenden Personen mit allem, was für die Entscheidung nötig ist.
 *
 * Aliase zählen als eigene Werte der Person: Wer früher eine andere Adresse
 * hatte, ist über sie genauso auffindbar — sonst würde ausgerechnet ein
 * früherer Merge die nächste Dublette verstecken.
 */
export async function ladeMassenPersonen(lauf: Lauf = sqlPool): Promise<MassenPerson[]> {
  const rows = await lauf`
    WITH bestellzahlen AS (
      SELECT person_id,
             COUNT(*)::int AS anzahl,
             COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
             MAX(COALESCE(completed_at, updated_at)) FILTER (WHERE payment_status = 'paid') AS letzte_zahlung,
             BOOL_OR(gdpr_deleted_at IS NOT NULL) AS gdpr
      FROM fiaon_applications
      WHERE person_id IS NOT NULL
      GROUP BY person_id
    ), kontakte AS (
      SELECT a.person_id, MAX(c.created_at) AS letzter
      FROM fiaon_contact_log c
      JOIN fiaon_applications a ON a.ref = c.ref
      WHERE c.voided_at IS NULL AND a.person_id IS NOT NULL
      GROUP BY a.person_id
    )
    SELECT p.id, p.person_ref, p.first_name, p.last_name, p.company_name, p.contact_name,
           p.primary_email, p.primary_phone, p.phone_key9, p.birthdate, p.account_status,
           p.street, p.zip,
           p.assigned_agent_id, p.betreuung_seit, p.created_at,
           ag.name AS agent_name,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           COALESCE(b.anzahl, 0) AS bestellungen,
           COALESCE(b.bezahlt, 0) AS bezahlte,
           b.letzte_zahlung,
           COALESCE(b.gdpr, FALSE) AS gdpr,
           k.letzter AS letzter_kontakt
    FROM fiaon_persons p
    LEFT JOIN bestellzahlen b ON b.person_id = p.id
    LEFT JOIN kontakte k ON k.person_id = p.id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL
  `;

  const aliase = await lauf`
    SELECT a.person_id, a.kind, a.value_norm
    FROM fiaon_person_aliases a
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE a.kind IN ('email', 'phone') AND COALESCE(a.value_norm, '') <> ''
  `.catch(() => []);
  const jePerson = new Map<number, { mails: Set<string>; nummern: Set<string> }>();
  for (const a of aliase as any[]) {
    const id = Number(a.person_id);
    const eintrag = jePerson.get(id) ?? { mails: new Set<string>(), nummern: new Set<string>() };
    if (a.kind === "email") eintrag.mails.add(String(a.value_norm).trim().toLowerCase());
    else eintrag.nummern.add(String(a.value_norm).replace(/\D/g, "").slice(-9));
    jePerson.set(id, eintrag);
  }

  // ── Kontaktdaten aus den BESTELLUNGEN ───────────────────────────────────
  //
  // Nachgetragen am 08.08.2026 nach dem ersten Massenlauf: 29 Bestellungen
  // trugen eine Adresse, die ihr eigener Personensatz nicht kannte — weder im
  // Feld noch als Alias. Dadurch blieben mindestens 20 offensichtliche Dubletten
  // unsichtbar („Peter Dziuba" zweimal, „Nina Feiler" zweimal, „Marco Franz"
  // zweimal). Die Kundenakte fasst einen Menschen ohnehin über die Kontaktdaten
  // seiner Bestellungen zusammen (Kopf von `server/routes/fiaon-kunden.ts`) —
  // hier galt bis dahin ein engerer Begriff, und zwei Begriffe für „dieselbe
  // Person" sind schlimmer als ein fehlender.
  const ausBestellungen = await lauf`
    SELECT a.person_id,
           NULLIF(lower(trim(a.email)), '') AS mail,
           NULLIF(right(regexp_replace(
             COALESCE(a.phone_country_code, '') || COALESCE(a.phone, ''), '\\D', '', 'g'), 9), '') AS tel,
           NULLIF(right(regexp_replace(COALESCE(a.contact_phone, ''), '\\D', '', 'g'), 9), '') AS tel2
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE a.merged_into IS NULL
  `.catch(() => []);
  for (const b of ausBestellungen as any[]) {
    const id = Number(b.person_id);
    const eintrag = jePerson.get(id) ?? { mails: new Set<string>(), nummern: new Set<string>() };
    if (b.mail) eintrag.mails.add(String(b.mail));
    if (b.tel) eintrag.nummern.add(String(b.tel));
    if (b.tel2) eintrag.nummern.add(String(b.tel2));
    jePerson.set(id, eintrag);
  }

  return (rows as any[]).map((r) => {
    const id = Number(r.id);
    const zusatz = jePerson.get(id);
    const mails = new Set<string>(zusatz ? Array.from(zusatz.mails) : []);
    if (r.primary_email) mails.add(String(r.primary_email).trim().toLowerCase());
    const nummern = new Set<string>(zusatz ? Array.from(zusatz.nummern) : []);
    if (r.phone_key9) nummern.add(String(r.phone_key9).replace(/\D/g, "").slice(-9));
    if (r.primary_phone) nummern.add(String(r.primary_phone).replace(/\D/g, "").slice(-9));

    return {
      id,
      personRef: String(r.person_ref),
      name: String(r.name ?? r.person_ref),
      vorname: r.first_name ?? null,
      nachname: r.last_name ?? null,
      email: r.primary_email ?? null,
      telefon: r.primary_phone ?? null,
      phoneKey9: r.phone_key9 ?? null,
      geburtsdatum: r.birthdate ?? null,
      strasse: r.street ?? null,
      plz: r.zip ?? null,
      betreuerId: r.assigned_agent_id != null ? Number(r.assigned_agent_id) : null,
      betreuerName: r.agent_name ?? null,
      betreuungSeit: r.betreuung_seit ?? null,
      bestellungen: Number(r.bestellungen ?? 0),
      bezahlteBestellungen: Number(r.bezahlte ?? 0),
      letzterKontakt: r.letzter_kontakt ?? null,
      angelegt: r.created_at ?? null,
      // Nur brauchbare Merkmale: Eine Attrappen-Nummer verbindet keine Menschen,
      // eine dreistellige „Nummer" auch nicht. Adressen ohne @ ebenso wenig.
      mails: Array.from(mails).filter((m) => m.includes("@") && m.length > 4),
      nummern: Array.from(nummern).filter((n) => n.length >= 7 && !istAttrappenNummer(n)),
      letzteZahlung: r.letzte_zahlung ?? null,
      gdprGesperrt: !!r.gdpr,
      gesperrt: String(r.account_status ?? "") === "suspended",
    };
  });
}

// ── Invarianten ────────────────────────────────────────────────────────────
/** Der zählbare Zustand eines Ausschnitts — einer Gruppe oder des Bestands. */
export interface Stand {
  bestellungen: number;
  verwendungszwecke: number;
  verlauf: number;
  provisionen: number;
  leads: number;
  ohnePerson: number;
}

/**
 * Was sich beim Zusammenführen EINER Gruppe nicht ändern darf.
 *
 * Der Verlauf ist die Ausnahme: Jeder Merge schreibt eine Klartext-Notiz in die
 * Akte („Zusammengeführt mit …"), jede Stilllegung ebenfalls. Er darf wachsen,
 * aber nichts verlieren. Alles andere muss auf die Zahl genau stimmen — eine
 * Bestellung, die beim Umhängen verschwindet, ist genau der Schaden, der dieses
 * Werkzeug in Verruf gebracht hat.
 */
export function invariantenBrueche(vorher: Stand, nachher: Stand): string[] {
  const brueche: string[] = [];
  if (nachher.bestellungen !== vorher.bestellungen) {
    brueche.push(`Bestellungen: vorher ${vorher.bestellungen}, nachher ${nachher.bestellungen}`);
  }
  if (nachher.verwendungszwecke !== vorher.verwendungszwecke) {
    brueche.push(`Verwendungszwecke: vorher ${vorher.verwendungszwecke}, nachher ${nachher.verwendungszwecke}`);
  }
  if (nachher.verlauf < vorher.verlauf) {
    brueche.push(`Verlauf verloren: vorher ${vorher.verlauf}, nachher ${nachher.verlauf}`);
  }
  if (nachher.provisionen !== vorher.provisionen) {
    brueche.push(`Provisionen: vorher ${vorher.provisionen}, nachher ${nachher.provisionen}`);
  }
  if (nachher.leads !== vorher.leads) {
    brueche.push(`Leads: vorher ${vorher.leads}, nachher ${nachher.leads}`);
  }
  if (nachher.ohnePerson > vorher.ohnePerson) {
    brueche.push(`Bestellungen ohne Person: ${vorher.ohnePerson} → ${nachher.ohnePerson}`);
  }
  return brueche;
}

/**
 * Dasselbe für den GESAMTBESTAND nach einer Welle.
 *
 * Hier gilt „darf nicht schrumpfen" statt „muss gleich bleiben": Die Datenbank
 * ist die Produktion, während des Laufs bestellen echte Kunden weiter. Ein
 * Wachstum ist der Betrieb, ein Schwund wäre dieser Lauf.
 *
 * BESTELLUNGEN OHNE PERSON WERDEN HIER NICHT GEPRÜFT — und das ist kein
 * Versehen. Am 08.08.2026 stoppte der Lauf nach der ersten Welle, weil ihre Zahl
 * von 3.550 auf 3.551 gestiegen war. Nachgesehen: fünf neue Formular-Entwürfe
 * von echten Besuchern innerhalb von zwei Stunden, kein einziger aus einem
 * Merge. Ein Entwurf hat noch keine Person, das ist der Normalzustand des
 * Trichters.
 *
 * Eine Invariante, die den laufenden Betrieb mitmisst, schlägt irgendwann
 * grundlos Alarm — und wer zweimal grundlos gestoppt wurde, schaltet sie ab.
 * Verwaiste Bestellungen prüft deshalb `invariantenBrueche` je Gruppe, genau
 * dort, wo dieser Lauf etwas anfasst.
 */
export function invariantenBruecheGesamt(start: Stand, jetzt: Stand): string[] {
  const brueche: string[] = [];
  if (jetzt.bestellungen < start.bestellungen) brueche.push(`Bestellungen geschrumpft: ${start.bestellungen} → ${jetzt.bestellungen}`);
  if (jetzt.verwendungszwecke < start.verwendungszwecke) brueche.push(`Verwendungszwecke verloren: ${start.verwendungszwecke} → ${jetzt.verwendungszwecke}`);
  if (jetzt.verlauf < start.verlauf) brueche.push(`Verlaufseinträge verloren: ${start.verlauf} → ${jetzt.verlauf}`);
  if (jetzt.provisionen < start.provisionen) brueche.push(`Provisionen verloren: ${start.provisionen} → ${jetzt.provisionen}`);
  if (jetzt.leads < start.leads) brueche.push(`Leads verloren: ${start.leads} → ${jetzt.leads}`);
  return brueche;
}

// ── Gruppen bilden ─────────────────────────────────────────────────────────
const zeit = (v: unknown): number => (v ? new Date(String(v)).getTime() : 0);

/**
 * Der Gewinner einer Gruppe — deterministisch, in dieser Reihenfolge:
 *   1. Person mit bezahlter Bestellung (bei mehreren: jüngste Zahlung),
 *   2. sonst Person mit jüngstem dokumentierten Kontakt,
 *   3. sonst die älteste Personen-ID.
 *
 * Warum bezahlt zuerst: An der bezahlten Bestellung hängen Provision,
 * Freischaltung und Rechnung. Sie zum Verlierer zu machen, hieße, die
 * belastbarste Akte in eine schwächere zu schieben.
 */
export function waehleGewinner(mitglieder: MassenPerson[]): { gewinner: MassenPerson; grund: string } {
  const bezahlt = mitglieder.filter((m) => m.bezahlteBestellungen > 0);
  if (bezahlt.length > 0) {
    const sortiert = bezahlt.slice().sort((a, b) =>
      zeit(b.letzteZahlung) - zeit(a.letzteZahlung) || a.id - b.id);
    return {
      gewinner: sortiert[0],
      grund: bezahlt.length > 1
        ? `bezahlte Bestellung, jüngste Zahlung (${bezahlt.length} Sätze mit Zahlung)`
        : "einzige Person mit bezahlter Bestellung",
    };
  }
  const mitKontakt = mitglieder.filter((m) => m.letzterKontakt);
  if (mitKontakt.length > 0) {
    const sortiert = mitKontakt.slice().sort((a, b) =>
      zeit(b.letzterKontakt) - zeit(a.letzterKontakt) || a.id - b.id);
    return { gewinner: sortiert[0], grund: "jüngster dokumentierter Kontakt" };
  }
  const sortiert = mitglieder.slice().sort((a, b) => a.id - b.id);
  return { gewinner: sortiert[0], grund: "älteste Personen-ID (kein anderes Merkmal)" };
}

/**
 * Zuständigkeit der Gruppe: der Agent mit dem JÜNGSTEN dokumentierten Kontakt.
 *
 * Das ist die Antwort auf die 14 Paare, die die Merge-Maschine bisher blockiert
 * hat, weil zwei Betreuer dokumentiert waren. Sie ist nicht willkürlich: Wer
 * zuletzt mit dem Menschen gesprochen hat, führt das Gespräch weiter. Bereits
 * gebuchte Provisionen bleiben davon unberührt — sie hängen an der Bestellung,
 * nicht an der Person.
 */
export function waehleBetreuer(mitglieder: MassenPerson[]): {
  betreuerId: number | null; betreuerName: string | null; grund: string;
  konflikt: boolean; verdraengt: { agentId: number; name: string | null }[];
} {
  const mitBetreuung = mitglieder.filter((m) => m.betreuerId != null && m.betreuungSeit != null);
  const alleAgenten = Array.from(new Set(mitBetreuung.map((m) => m.betreuerId as number)));
  const konflikt = alleAgenten.length > 1;

  const kandidaten = mitBetreuung.length > 0
    ? mitBetreuung
    : mitglieder.filter((m) => m.betreuerId != null);
  if (kandidaten.length === 0) {
    return { betreuerId: null, betreuerName: null, grund: "niemand zuständig", konflikt: false, verdraengt: [] };
  }
  const sortiert = kandidaten.slice().sort((a, b) =>
    zeit(b.letzterKontakt) - zeit(a.letzterKontakt) || zeit(b.betreuungSeit) - zeit(a.betreuungSeit) || a.id - b.id);
  const gewaehlt = sortiert[0];
  const verdraengt = kandidaten
    .filter((m) => m.betreuerId !== gewaehlt.betreuerId)
    .map((m) => ({ agentId: m.betreuerId as number, name: m.betreuerName }));

  return {
    betreuerId: gewaehlt.betreuerId,
    betreuerName: gewaehlt.betreuerName,
    grund: konflikt
      ? `jüngster dokumentierter Kontakt (${gewaehlt.letzterKontakt ? new Date(String(gewaehlt.letzterKontakt)).toISOString().slice(0, 10) : "ohne Datum"})`
      : "einziger dokumentierter Betreuer",
    konflikt,
    verdraengt: Array.from(new Map(verdraengt.map((v) => [v.agentId, v])).values()),
  };
}

const KRITERIUM_RANG: Record<Kriterium, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

/**
 * Wie brauchbar ist ein Name als Aufschrift einer Kundenakte?
 *
 * Der Bestand liefert die Beispiele: „Wien Wien" (Stadt im Namensfeld),
 * „Gerda M" (abgeschnitten), „Maria Henriette Tietz4" (Ziffer verrutscht),
 * „Frano Seman l" (Buchstabe übrig). Steht so etwas am Gewinner, heißt die Akte
 * danach so — obwohl in derselben Gruppe der richtige Name liegt.
 *
 * Bewertet wird nur die FORM, nie der Inhalt: Es gibt keine Namensliste, gegen
 * die geprüft wird. Ein Tippfehler wie „Klaua" ist von außen nicht erkennbar und
 * bleibt deshalb stehen — er ist über den Alias weiter auffindbar.
 */
export function namensGuete(vorname: string | null | undefined, nachname: string | null | undefined): number {
  const v = String(vorname ?? "").trim();
  const n = String(nachname ?? "").trim();
  if (!v && !n) return -10;
  let punkte = 0;
  if (v) punkte += 1;
  if (n) punkte += 1;
  if (!v || !n) punkte -= 2;
  if (/\d/.test(v) || /\d/.test(n)) punkte -= 3;
  if (v && n && nameSchluessel(v) === nameSchluessel(n)) punkte -= 3;
  const teile = `${v} ${n}`.trim().split(/\s+/).filter(Boolean);
  if (teile.some((t) => t.length === 1)) punkte -= 2;
  if (teile.length > 4) punkte -= 1;
  return punkte;
}

/**
 * Welches Gruppenmitglied trägt den saubersten Namen?
 *
 * Nur bei einem ECHTEN Vorsprung; bei Gleichstand bleibt der Gewinner, wie er
 * ist. Der bisherige Name des Gewinners geht dabei nicht verloren — die
 * Merge-Maschine sichert jeden überschriebenen Wert als Alias.
 */
export function besserenNamenFinden(gruppe: Gruppe): MassenPerson | null {
  const gut = namensGuete(gruppe.gewinner.vorname, gruppe.gewinner.nachname);
  let bester: MassenPerson | null = null;
  let bestePunkte = gut;
  for (const v of gruppe.verlierer) {
    const p = v.person;
    if (!p.vorname || !p.nachname) continue;
    const punkte = namensGuete(p.vorname, p.nachname);
    if (punkte > bestePunkte) { bester = p; bestePunkte = punkte; }
  }
  return bester;
}

/**
 * Aus dem Bestand die Gruppen bilden — und benennen, was NICHT zusammengehört.
 *
 * Die Blöcke (Rufnummer, E-Mail, Nachname+Geburtsdatum) sind nur ein Filter,
 * damit nicht 11 Millionen Paare geprüft werden. Entschieden wird jedes Paar
 * einzeln über `kriteriumFuer`.
 */
export function bildeGruppen(alle: MassenPerson[]): { gruppen: Gruppe[]; ausschluesse: Ausschluss[] } {
  const erlaubt = alle.filter((p) => darfAutomatisch(p).ja);
  const nach = new Map<number, MassenPerson>(erlaubt.map((p) => [p.id, p]));

  // ── Blöcke ───────────────────────────────────────────────────────────────
  const bloecke = new Map<string, number[]>();
  const inBlock = (k: string, id: number) => {
    const arr = bloecke.get(k) ?? [];
    arr.push(id);
    bloecke.set(k, arr);
  };
  for (const p of erlaubt) {
    for (const n of p.nummern) inBlock(`T:${n}`, p.id);
    for (const m of p.mails) inBlock(`M:${m}`, p.id);
    const nach9 = nameSchluessel(p.nachname);
    if (nach9 && p.geburtsdatum) inBlock(`N:${nach9}|${String(p.geburtsdatum).slice(0, 10)}`, p.id);
  }

  // ── Kanten ───────────────────────────────────────────────────────────────
  const kanten = new Map<string, { a: number; b: number; kriterium: Kriterium; merkmal: string }>();
  const geprueft = new Set<string>();
  /** Paare, die einen Block teilen, aber KEIN Kriterium erfüllen. */
  const kandidatenOhneBeweis = new Map<string, { a: number; b: number }>();

  for (const ids of Array.from(bloecke.values())) {
    if (ids.length < 2) continue;
    // Ein Block mit sehr vielen Mitgliedern ist kein Merkmal, sondern ein
    // Sammelbecken (Sammelnummer einer Firma, Platzhalteradresse). Er wird
    // trotzdem geprüft — die Kriterien verlangen ohnehin ein zweites Merkmal.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p = nach.get(ids[i]);
        const q = nach.get(ids[j]);
        if (!p || !q) continue;
        const k = p.id < q.id ? `${p.id}-${q.id}` : `${q.id}-${p.id}`;
        if (geprueft.has(k)) continue;
        geprueft.add(k);
        const treffer = kriteriumFuer(p, q);
        if (treffer) kanten.set(k, { a: p.id, b: q.id, ...treffer });
        else kandidatenOhneBeweis.set(k, { a: p.id, b: q.id });
      }
    }
  }

  // ── Zusammenhangskomponenten (Union-Find) ───────────────────────────────
  const eltern = new Map<number, number>();
  for (const p of erlaubt) eltern.set(p.id, p.id);
  const wurzel = (x: number): number => {
    let r = x;
    while (eltern.get(r) !== r) r = eltern.get(r) as number;
    let n = x;
    while (eltern.get(n) !== r) { const w = eltern.get(n) as number; eltern.set(n, r); n = w; }
    return r;
  };
  const vereine = (x: number, y: number) => {
    const wx = wurzel(x);
    const wy = wurzel(y);
    if (wx !== wy) eltern.set(wx, wy);
  };
  for (const kante of Array.from(kanten.values())) vereine(kante.a, kante.b);

  const komponenten = new Map<number, number[]>();
  for (const p of erlaubt) {
    const w = wurzel(p.id);
    const arr = komponenten.get(w) ?? [];
    arr.push(p.id);
    komponenten.set(w, arr);
  }

  // ── Gruppen zusammenstellen ─────────────────────────────────────────────
  const gruppen: Gruppe[] = [];
  for (const ids of Array.from(komponenten.values())) {
    if (ids.length < 2) continue;
    const mitglieder = ids.map((id) => nach.get(id) as MassenPerson).filter(Boolean);
    const { gewinner, grund } = waehleGewinner(mitglieder);
    const betreuer = waehleBetreuer(mitglieder);

    // Je Verlierer das stärkste Kriterium nennen, über das er an der Gruppe
    // hängt — der Report soll für jede Zeile den Beweis mitliefern.
    const verlierer: GruppenMitglied[] = [];
    for (const m of mitglieder) {
      if (m.id === gewinner.id) continue;
      let bestes: { kriterium: Kriterium; merkmal: string } | null = null;
      for (const kante of Array.from(kanten.values())) {
        if (kante.a !== m.id && kante.b !== m.id) continue;
        if (!bestes || KRITERIUM_RANG[kante.kriterium] < KRITERIUM_RANG[bestes.kriterium]) {
          bestes = { kriterium: kante.kriterium, merkmal: kante.merkmal };
        }
      }
      verlierer.push({
        person: m,
        kriterium: bestes?.kriterium ?? "E",
        merkmal: bestes?.merkmal ?? "über die Gruppe verbunden",
      });
    }
    verlierer.sort((x, y) => KRITERIUM_RANG[x.kriterium] - KRITERIUM_RANG[y.kriterium] || x.person.id - y.person.id);

    gruppen.push({
      id: Math.min(...ids),
      gewinner,
      gewinnerGrund: grund,
      verlierer,
      kriterien: Array.from(new Set(verlierer.map((v) => v.kriterium)))
        .sort((x, y) => KRITERIUM_RANG[x] - KRITERIUM_RANG[y]),
      bestellungen: mitglieder.reduce((s, m) => s + m.bestellungen, 0),
      bezahlteBestellungen: mitglieder.reduce((s, m) => s + m.bezahlteBestellungen, 0),
      betreuerId: betreuer.betreuerId,
      betreuerName: betreuer.betreuerName,
      betreuerGrund: betreuer.grund,
      betreuerKonflikt: betreuer.konflikt,
      betreuerVerdraengt: betreuer.verdraengt,
    });
  }
  gruppen.sort((a, b) => b.verlierer.length - a.verlierer.length || a.id - b.id);

  // ── Ausschlüsse: gemeinsames Merkmal, aber zwei Menschen ────────────────
  // Nur Paare, die auch NACH der Gruppenbildung getrennt bleiben. Ein Paar, das
  // über einen Dritten verbunden ist, wird ohnehin zusammengeführt — es hier als
  // „keine Dublette" zu schließen, wäre ein Widerspruch in derselben Ausgabe.
  const ausschluesse: Ausschluss[] = [];
  for (const paar of Array.from(kandidatenOhneBeweis.values())) {
    if (wurzel(paar.a) === wurzel(paar.b)) continue;
    const a = nach.get(paar.a);
    const b = nach.get(paar.b);
    if (!a || !b) continue;
    const nummer = schnitt(a.nummern, b.nummern);
    const mail = schnitt(a.mails, b.mails);
    // Hat die Widerspruchs-Wand gegriffen, steht IHR Grund da — nicht der
    // allgemeine. Sonst liest ein Mensch „Haushalt oder Firmennummer", während
    // der Ausschlag aus einem abweichenden Geburtsdatum kam, und sucht falsch.
    const widerspruch = harterWiderspruch(a, b);
    const grund = widerspruch
      ? `${widerspruch} — gemeinsames Merkmal ${nummer ? `Anschluss …${nummer}` : mail ? `E-Mail ${mail}` : "Name und Geburtsdatum"}, `
        + `aber ein hartes Zweitmerkmal spricht dagegen. Entscheidung gehört einem Menschen.`
      : nummer
        ? `Gemeinsamer Anschluss …${nummer}, aber verschiedene Menschen (${a.vorname ?? "—"} / ${b.vorname ?? "—"}) — Haushalt oder Firmennummer`
        : mail
          ? `Gemeinsame E-Mail ${mail}, aber verschiedene Menschen (${a.name} / ${b.name})`
          : `Gleicher Nachname und Geburtsdatum, aber verschiedene Vornamen (${a.vorname ?? "—"} / ${b.vorname ?? "—"})`;
    ausschluesse.push({ a, b, grund });
  }

  return { gruppen, ausschluesse };
}
