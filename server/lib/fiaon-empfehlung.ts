// ═══════════════════════════════════════════════════════════════════════════
// WEITEREMPFEHLEN — EIN LINK JE MENSCH (23.09.2026, E-214)
//
// Florentine am 23.09.: „Justin wurde gerade von Michaela Schneider gefragt, ob
// es Provisionen für Neukunden gibt, wenn sie FIAON weiterempfiehlt."
//
// ── WAS HIER GEBAUT IST, UND WAS AUSDRÜCKLICH NICHT ───────────────────────
// Gebaut ist die MESSUNG: Jeder Mensch bekommt einen eigenen kurzen Link. Wer
// darüber auf /start kommt, wird diesem Menschen zugeordnet — vom Klick über
// den Antrag bis zur bezahlten Bestellung. Ohne diese Zuordnung ist jede
// Prämienfrage unbeantwortbar, weil niemand weiß, wer wen gebracht hat.
//
// NICHT gebaut ist die Prämie selbst. Was ein Kunde für eine erfolgreiche
// Empfehlung bekommt — Geld, eine freie Rate, eine Gutschrift — ist eine
// kaufmännische Entscheidung des Inhabers und keine technische. Eine Zahl, die
// ich mir hier ausdenke, stünde morgen als Zusage gegenüber Kunden im Raum.
// Sobald Justin sie nennt, steht sie in EINER Zeile weiter unten (PRAEMIE).
//
// ── WARUM EIN EIGENER CODE UND NICHT DER KURZLINK ─────────────────────────
// `fiaon-kurzlink.ts` verweist auf einen LEAD und führt ihn in seinen eigenen
// Antrag. Hier ist es umgekehrt: Der Link gehört dem EMPFEHLENDEN und führt
// einen Fremden in einen neuen Antrag. Dieselbe Tabelle für beides würde die
// Auswertung „wer hat wen gebracht" mit „wer hat seinen eigenen Link geklickt"
// vermischen. Die Codeform (Zeichenvorrat, Prüfung) kommt aber von dort — eine
// zweite Zufallsquelle wäre eine zweite Gelegenheit für schwache Codes.
//
// ── DAS WORT ──────────────────────────────────────────────────────────────
// „Affiliate" ist im Haus verboten (Wortwand). Und „Empfehlung" im Sinne von
// „FIAON empfiehlt Ihnen etwas" ist es auch — deshalb heißt es überall
// „weiterempfehlen" und nie „unsere Empfehlung".
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { neuerCode, codeGueltigeForm } from "./fiaon-kurzlink";

/**
 * Die Prämie. Solange sie `null` ist, nennt kein Text im Haus eine Zahl — die
 * Seite sagt dann „wir melden uns bei Ihnen, sobald daraus etwas geworden ist".
 * Justin trägt hier einen Betrag in Cent ein, und alle Texte ziehen nach.
 */
export const PRAEMIE_CENTS: number | null = null;

let bereit: Promise<void> | null = null;
export function empfehlungTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_empfehlung (
          code TEXT PRIMARY KEY,
          person_id INTEGER NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          erstellt_von TEXT,
          klicks INTEGER NOT NULL DEFAULT 0,
          letzter_klick_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_empfehlung_person ON fiaon_empfehlung (person_id)`;
      // Wer über einen Empfehlungslink kam, steht am ANTRAG — nicht in einer
      // dritten Tabelle. So beantwortet eine einzige Abfrage „was ist daraus
      // geworden", inklusive Zahlung.
      await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS empfohlen_von_person_id INTEGER`;
      await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS empfohlen_code TEXT`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_applications_empfohlen ON fiaon_applications (empfohlen_von_person_id) WHERE empfohlen_von_person_id IS NOT NULL`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

/** Den Link eines Menschen holen — oder ihn beim ersten Mal anlegen. */
export async function empfehlungslink(personId: number, von?: string | null): Promise<{ code: string; url: string; neu: boolean }> {
  await empfehlungTabelle();
  const [da] = (await sqlPool`SELECT code FROM fiaon_empfehlung WHERE person_id = ${personId} LIMIT 1`) as any[];
  if (da?.code) return { code: String(da.code), url: url(String(da.code)), neu: false };
  // Kollisionen sind bei zehn Zeichen praktisch ausgeschlossen; ON CONFLICT
  // fängt den Rest ab, ohne dass jemand einen Fehlerbildschirm sieht.
  for (let versuch = 0; versuch < 5; versuch++) {
    const code = neuerCode();
    const zeilen = (await sqlPool`
      INSERT INTO fiaon_empfehlung (code, person_id, erstellt_von) VALUES (${code}, ${personId}, ${von ?? null})
      ON CONFLICT DO NOTHING RETURNING code`) as any[];
    if (zeilen.length) return { code, url: url(code), neu: true };
    const [jetzt] = (await sqlPool`SELECT code FROM fiaon_empfehlung WHERE person_id = ${personId} LIMIT 1`) as any[];
    if (jetzt?.code) return { code: String(jetzt.code), url: url(String(jetzt.code)), neu: false };
  }
  throw new Error("Es ließ sich kein Link erzeugen.");
}

export function url(code: string): string {
  return `https://fiaon.com/e/${code}`;
}

/** Wem gehört dieser Code? Zählt den Klick gleich mit. */
export async function empfehlerFuerCode(code: string): Promise<{ personId: number; name: string } | null> {
  if (!codeGueltigeForm(code)) return null;
  await empfehlungTabelle();
  const [r] = (await sqlPool`
    UPDATE fiaon_empfehlung SET klicks = klicks + 1, letzter_klick_am = NOW()
     WHERE code = ${code}
    RETURNING person_id`) as any[];
  if (!r) return null;
  const [p] = (await sqlPool`
    SELECT TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name
      FROM fiaon_persons WHERE id = ${Number(r.person_id)} LIMIT 1`) as any[];
  return { personId: Number(r.person_id), name: String(p?.name ?? "").trim() };
}

/** Was aus den Empfehlungen eines Menschen geworden ist. */
export async function empfehlungStand(personId: number): Promise<{
  code: string | null; url: string | null; klicks: number; antraege: number; bezahlt: number;
  gebracht: { name: string; am: string; bezahlt: boolean }[];
}> {
  await empfehlungTabelle();
  const [l] = (await sqlPool`SELECT code, klicks FROM fiaon_empfehlung WHERE person_id = ${personId} LIMIT 1`) as any[];
  const gebracht = (await sqlPool`
    SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
           a.created_at, (a.payment_status = 'paid') AS bezahlt
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.empfohlen_von_person_id = ${personId} AND a.merged_into IS NULL
     ORDER BY a.created_at DESC LIMIT 50`.catch(() => [])) as any[];
  return {
    code: l?.code ?? null,
    url: l?.code ? url(String(l.code)) : null,
    klicks: Number(l?.klicks ?? 0),
    antraege: gebracht.length,
    // Bewusst keine Umsatzsumme: Der maßgebliche Betrag ist der Katalogpreis
    // (E-181), nicht `amount_due`. Eine hier nachgerechnete Zahl wäre eine
    // zweite Geldwahrheit — die Zahlen stehen in /chef/wert.
    bezahlt: gebracht.filter((g) => g.bezahlt === true).length,
    gebracht: gebracht.map((g) => ({ name: String(g.name || "").trim() || "ohne Namen", am: g.created_at, bezahlt: g.bezahlt === true })),
  };
}
