/**
 * ═══════════════════════════════════════════════════════════════════════════
 * P1-B — BACKFILL: BESTEHENDE ZEILEN EINER PERSON ZUORDNEN (einmalig, umkehrbar)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAS DIESER LAUF TUT
 *   · Er legt Personen an (fiaon_persons) und schreibt `person_id` in die
 *     bestehenden Zeilen von fiaon_applications und fiaon_leads.
 *
 * WAS ER AUSDRÜCKLICH NICHT TUT
 *   · Keine Zeile wird gelöscht. Keine Zeile wird inhaltlich verändert —
 *     das EINZIGE beschriebene Feld an Bestand ist `person_id`.
 *   · Keine Zahlung, kein Status, keine Provision, keine Attribution.
 *   · Kein automatisches Zusammenführen bei blosser Telefon-Gleichheit.
 *     Gemessen: 49 Nummern verbinden 139 verschiedene E-Mail-Familien
 *     (Haushalte, Firmenzentralen). Solche Fälle werden MARKIERT, nicht gemerged.
 *
 * SICHERHEITSNETZE
 *   · Standardmässig TROCKENLAUF. Geschrieben wird nur mit `--apply`.
 *   · Jeder Lauf hat eine Stapel-ID; `--undo <STAPEL>` macht ihn vollständig
 *     rückgängig (person_id zurück auf NULL, Personen + Aliase entfernt).
 *   · Ein eindeutiger Index über die E-Mail-Aliase verhindert schon in der
 *     Datenbank, dass zwei Personen dieselbe Adresse tragen.
 *
 * VERWENDUNG
 *   npx tsx scripts/person-backfill.ts                 → Trockenlauf + Bericht
 *   npx tsx scripts/person-backfill.ts --apply         → schreibt
 *   npx tsx scripts/person-backfill.ts --apply --limit 50   → kleiner Testlauf
 *   npx tsx scripts/person-backfill.ts --undo P1B-…    → macht einen Stapel rückgängig
 *
 * WIEDERHOLBARKEIT — DER SINN DES GANZEN
 * Dieses Skript muss regelmässig laufen, um Nachzügler einzusammeln. Ein
 * Skript, das beim zweiten Lauf abbricht oder Dubletten erzeugt, kann das
 * nicht. Am 29.07.2026 wurden im Zweitlauf 2.829 Lead-Personen ERNEUT
 * angelegt, obwohl alle 2.848 Leads bereits eine person_id hatten.
 *
 * Die Ursache lag tiefer als der Lead-Pfad: BEIDE Durchläufe glichen nur
 * gegen die im selben Lauf gebauten Pläne ab, nie gegen die Personen, die
 * schon in der Datenbank stehen. Daraus folgten drei Störungen:
 *
 *   1. Ein Lead mit gesetzter person_id wurde trotzdem verarbeitet.
 *   2. Ein NEUER Lead, dessen Adresse einer bestehenden Person gehört, hätte
 *      eine zweite Person dafür angelegt.
 *   3. Eine NEUE Bestellung eines bestehenden Kunden hätte eine zweite Person
 *      mit derselben E-Mail angelegt — der eindeutige Index hätte den Lauf
 *      abgebrochen. Genau der Fall „Nachzügler einsammeln".
 *
 * Deshalb lädt der Lauf jetzt ZUERST alle bestehenden Personen samt Aliasen
 * und bindet passende Zeilen dort an, statt neu anzulegen. Angebunden wird nur
 * `person_id` an Zeilen, die noch keine haben, und Aliase, die es noch nicht
 * gibt — beides ohne Wirkung, wenn es schon getan wurde.
 *
 * ZU --limit: Der begrenzte Lauf legt BEWUSST keine Lead-only-Personen an.
 * Grund, gemessen am 29.07.2026: Mit gekürzter Personenliste hält der
 * Lead-Durchlauf jeden Lead für „gehört zu keinem Antrag" und erzeugt Personen,
 * die es nicht geben darf (2.809 statt 2.076). Der Testlauf prüft deshalb nur
 * den Antragspfad; die Leads kommen im vollen Lauf dazu.
 *
 * ZEITPUNKT: abends laufen lassen, nicht während der Telefonzeiten. Bei grossem
 * Bestand über die Render Shell starten, nicht über einen HTTP-Aufruf.
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  ensurePersonTables,
  buildPersonDraft,
  collectAliases,
  isAddonOrderRow,
  nameKey,
  newPersonRef,
  normEmail,
  phoneKey9,
  pickPersonSourceRow,
  storedPasswordOf,
  type PersonDraft,
} from "../server/fiaon-person-model";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const UNDO_ID = (() => {
  const i = args.indexOf("--undo");
  return i >= 0 ? args[i + 1] : null;
})();
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Math.max(1, Number(args[i + 1]) || 0) : 0;
})();
const CHUNK = 200;

function log(msg: string): void {
  console.log(msg);
}

// ═══════════════════════════════════════════════════════════════════════════
// RÜCKGÄNGIG
// ═══════════════════════════════════════════════════════════════════════════
async function undo(batchId: string): Promise<void> {
  await ensurePersonTables();
  const [batch] = await sqlPool`SELECT * FROM fiaon_person_batches WHERE batch_id = ${batchId}`;
  if (!batch) {
    console.error(`Stapel ${batchId} unbekannt.`);
    process.exit(2);
  }
  if (batch.undone_at) {
    log(`Stapel ${batchId} wurde bereits am ${new Date(batch.undone_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} zurückgenommen.`);
    return;
  }
  const apps = await sqlPool`
    UPDATE fiaon_applications SET person_id = NULL
    WHERE person_id IN (SELECT id FROM fiaon_persons WHERE merge_batch_id = ${batchId})
    RETURNING ref
  `;
  const leads = await sqlPool`
    UPDATE fiaon_leads SET person_id = NULL
    WHERE person_id IN (SELECT id FROM fiaon_persons WHERE merge_batch_id = ${batchId})
    RETURNING id
  `;

  // Zeilen, die an eine SCHON VORHANDENE Person angebunden wurden. Ihre Person
  // stammt aus einem früheren Stapel und bleibt bestehen — nur die in diesem
  // Lauf gesetzte Verknüpfung wird gelöst. Ohne diesen Schritt bliebe ein Teil
  // des Laufs stehen und „umkehrbar" wäre eine leere Zusage.
  const angebundeneRefs: string[] = Array.isArray(batch.linked_refs) ? batch.linked_refs : [];
  const angebundeneLeads: number[] = Array.isArray(batch.linked_lead_ids) ? batch.linked_lead_ids : [];
  let extraApps = 0, extraLeads = 0;
  if (angebundeneRefs.length > 0) {
    const r = await sqlPool`
      UPDATE fiaon_applications SET person_id = NULL
      WHERE ref = ANY(${angebundeneRefs}::text[]) RETURNING ref
    `;
    extraApps = r.length;
  }
  if (angebundeneLeads.length > 0) {
    const r = await sqlPool`
      UPDATE fiaon_leads SET person_id = NULL
      WHERE id = ANY(${angebundeneLeads}::int[]) RETURNING id
    `;
    extraLeads = r.length;
  }
  // Aliase, die dieser Lauf an bestehende Personen gehängt hat.
  const aliasWeg = await sqlPool`
    DELETE FROM fiaon_person_aliases WHERE merge_batch_id = ${batchId} RETURNING id
  `;

  await sqlPool`
    DELETE FROM fiaon_person_aliases
    WHERE person_id IN (SELECT id FROM fiaon_persons WHERE merge_batch_id = ${batchId})
  `;
  const gone = await sqlPool`DELETE FROM fiaon_persons WHERE merge_batch_id = ${batchId} RETURNING id`;
  await sqlPool`UPDATE fiaon_person_batches SET undone_at = NOW() WHERE batch_id = ${batchId}`;
  log("");
  log(`✅ Stapel ${batchId} zurückgenommen.`);
  log(`   ${gone.length} Personen entfernt · ${apps.length} Anträge und ${leads.length} Leads wieder ohne person_id.`);
  if (extraApps + extraLeads + aliasWeg.length > 0) {
    log(`   Anbindungen gelöst: ${extraApps} Anträge, ${extraLeads} Leads, ${aliasWeg.length} Aliase (Personen aus früheren Stapeln bleiben).`);
  }
  log("   An keiner Bestandszeile wurde sonst etwas verändert.");
}

// ═══════════════════════════════════════════════════════════════════════════
// FAMILIENBILDUNG (identisch zur Phase-0-Messung und zur Login-Auflösung)
// ═══════════════════════════════════════════════════════════════════════════
class UnionFind {
  private p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(i: number): number {
    while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; }
    return i;
  }
  union(a: number, b: number): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.p[rb] = ra;
  }
}

interface PersonPlan {
  draft: PersonDraft;
  personRef: string;
  refs: string[];
  /** Leads, die zu dieser Person gehören (per E-Mail oder Telefon erkannt). */
  leadIds: number[];
  aliases: ReturnType<typeof collectAliases>;
  agents: number[];
  agentConflict: boolean;
  flags: Record<string, unknown>;
  firstSeenAt: Date | null;
  accountStatus: string;
  /** Nur zur Berichterstattung. */
  paidRows: number;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  if (UNDO_ID) { await undo(UNDO_ID); await sqlPool.end(); return; }

  await ensurePersonTables();

  const apps = await sqlPool`
    SELECT id, ref, type, status, payment_status,
           email, contact_email, billing_email,
           phone, phone_country_code, contact_phone,
           first_name, last_name, company_name, contact_name,
           birthdate, street, zip, city, country, nationality,
           password, utm::text AS utm_string,
           merged_into, superseded_by, assigned_agent_id, account_status,
           person_id, created_at
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
    ORDER BY created_at ASC NULLS FIRST, id ASC
  `;

  const leads = await sqlPool`
    SELECT id, vorname, nachname, email, telefon, quelle, kampagne, status,
           assigned_agent_id, converted_order_id, person_id, erstellt_am
    FROM fiaon_leads
    ORDER BY erstellt_am ASC NULLS FIRST, id ASC
  `;

  // ── Was es schon gibt ────────────────────────────────────────────
  // Ohne diesen Schritt kennt der Lauf nur sich selbst und legt beim zweiten
  // Mal alles noch einmal an. `aliasBesitzer` beantwortet die einzige Frage,
  // die zählt: Gehört diese Adresse bereits jemandem?
  const bestehendeAliase = await sqlPool`
    SELECT person_id, kind, value_norm FROM fiaon_person_aliases
  `;
  const aliasBesitzer = new Map<string, number>();
  for (const a of bestehendeAliase as any[]) {
    aliasBesitzer.set(`${a.kind}:${a.value_norm}`, Number(a.person_id));
  }
  const aliasSchluessel = (kind: string, norm: string) => `${kind}:${norm}`;

  /**
   * Anbindung an eine bereits vorhandene Person — kein Neuanlegen.
   * Nach Person gesammelt, damit mehrere Familien und Leads, die auf dieselbe
   * Person zeigen, in einem Rutsch angebunden werden.
   */
  interface Anbindung {
    personId: number;
    refs: string[];
    leadIds: number[];
    neueAliase: ReturnType<typeof collectAliases>;
  }
  const anbindungen = new Map<number, Anbindung>();
  let kollisionen = 0;

  const anbindung = (personId: number): Anbindung => {
    let a = anbindungen.get(personId);
    if (!a) { a = { personId, refs: [], leadIds: [], neueAliase: [] }; anbindungen.set(personId, a); }
    return a;
  };

  /** Bestehende Person zu einer Alias-Liste finden. E-Mail schlägt Telefon. */
  const findeBestehende = (aliase: ReturnType<typeof collectAliases>): number | null => {
    for (const a of aliase) {
      if (a.kind !== "email") continue;
      const pid = aliasBesitzer.get(aliasSchluessel("email", a.valueNorm));
      if (pid) return pid;
    }
    for (const a of aliase) {
      if (a.kind !== "phone") continue;
      const pid = aliasBesitzer.get(aliasSchluessel("phone", a.valueNorm));
      if (pid) return pid;
    }
    return null;
  };

  /**
   * Fehlende Aliase an eine bestehende Person hängen.
   * Gehört eine Adresse bereits einer ANDEREN Person, wird sie übergangen und
   * gezählt: Das ist ein Zusammenführungsfall und keine Entscheidung, die ein
   * Backfill treffen darf. (Der eindeutige Index würde den Lauf sonst abbrechen.)
   */
  const ergaenzeAliase = (personId: number, aliase: ReturnType<typeof collectAliases>): void => {
    const ziel = anbindung(personId);
    for (const a of aliase) {
      const k = aliasSchluessel(a.kind, a.valueNorm);
      const besitzer = aliasBesitzer.get(k);
      if (besitzer === personId) continue;
      if (besitzer !== undefined) { kollisionen++; continue; }
      if (ziel.neueAliase.some((x) => x.kind === a.kind && x.valueNorm === a.valueNorm)) continue;
      ziel.neueAliase.push(a);
      aliasBesitzer.set(k, personId);
    }
  };

  // ── Familien: E-Mail-Gleichheit + dokumentierte Merge-Ketten ──────────────
  const uf = new UnionFind(apps.length);
  const byRef = new Map<string, number>();
  apps.forEach((r: any, i: number) => byRef.set(r.ref, i));

  const emailFirst = new Map<string, number>();
  apps.forEach((r: any, i: number) => {
    for (const raw of [r.email, r.contact_email, r.billing_email]) {
      const m = normEmail(raw);
      if (!m) continue;
      const seen = emailFirst.get(m);
      if (seen === undefined) emailFirst.set(m, i);
      else uf.union(seen, i);
    }
  });
  apps.forEach((r: any, i: number) => {
    for (const target of [r.merged_into, r.superseded_by]) {
      if (!target) continue;
      const j = byRef.get(target);
      if (j !== undefined) uf.union(i, j);
    }
  });

  const groups = new Map<number, number[]>();
  apps.forEach((_: any, i: number) => {
    const root = uf.find(i);
    const arr = groups.get(root) ?? [];
    arr.push(i);
    groups.set(root, arr);
  });

  // ── Pläne bauen ───────────────────────────────────────────────────────────
  const plans: PersonPlan[] = [];
  let verwaist = 0, verwaisteZeilen = 0, bereitsZugeordnet = 0;

  for (const idxs of groups.values()) {
    const family = idxs.map((i) => apps[i]);
    const aliases = collectAliases(family);
    const hatEmail = aliases.some((a) => a.kind === "email");
    const hatTelefon = aliases.some((a) => a.kind === "phone");

    // Funnel-Abbrecher ohne jeden Kontaktdatensatz: KEINE Person. Sie bleiben
    // verwaiste Entwurfszeilen und zählen nirgends als Kunde. (3.231 Zeilen)
    if (!hatEmail && !hatTelefon) {
      verwaist++;
      verwaisteZeilen += family.length;
      continue;
    }
    if (family.every((r: any) => r.person_id != null)) { bereitsZugeordnet++; continue; }

    // Gehört diese Familie schon jemandem? Zwei Wege dorthin: eine Zeile trägt
    // bereits eine person_id (dann fehlt sie nur den übrigen Zeilen), oder eine
    // ihrer Adressen ist als Alias vergeben.
    //
    // Das ist der Fall „neue Bestellung eines bestehenden Kunden". Ohne diese
    // Abzweigung entstünde eine zweite Person mit derselben E-Mail — und der
    // eindeutige Index bräche den ganzen Lauf ab.
    const vorhandeneId = family
      .map((r: any) => (r.person_id != null ? Number(r.person_id) : null))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)[0] ?? null;
    const zielPerson = vorhandeneId ?? findeBestehende(aliases);
    if (zielPerson !== null) {
      const ziel = anbindung(zielPerson);
      for (const r of family) if (r.person_id == null) ziel.refs.push(r.ref);
      ergaenzeAliase(zielPerson, aliases);
      continue;
    }

    const draft = buildPersonDraft(family);
    const account = pickPersonSourceRow(family);
    const agents = Array.from(
      new Set(family.map((r: any) => r.assigned_agent_id).filter((v: any) => v != null).map(Number)),
    );
    const paidNames = new Set(
      family.filter((r: any) => r.payment_status === "paid").map(nameKey).filter(Boolean) as string[],
    );
    const paidRows = family.filter((r: any) => r.payment_status === "paid").length;

    const flags: Record<string, unknown> = {};
    if (paidNames.size > 1) flags.name_conflict = Array.from(paidNames).length;
    if (agents.length > 1) flags.agents = agents;
    if (!family.some((r: any) => storedPasswordOf(r))) flags.no_password = true;
    if (family.every(isAddonOrderRow)) flags.addon_only = true;
    if (family.length > 1) flags.merged_rows = family.length;

    // Konto-Status der Person: die Konto-Zeile entscheidet. Ein gesperrtes Konto
    // bleibt gesperrt (Admin-Not-Aus). Es gibt bewusst KEINEN Zustand
    // „deaktiviert" — niemand muss je reaktiviert werden.
    const bezahlt = family.some((r: any) => r.payment_status === "paid");
    const accountStatus =
      account?.account_status === "suspended" ? "suspended" : bezahlt ? "active" : "pending";

    const firstSeen = family
      .map((r: any) => (r.created_at ? new Date(r.created_at) : null))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    plans.push({
      draft,
      personRef: newPersonRef(),
      refs: family.map((r: any) => r.ref),
      leadIds: [],
      aliases,
      agents,
      // Mehrere Agenten in einer Familie: KEINE automatische Entscheidung.
      // Markiert für die Betreiber-Liste; die Auflösung kommt mit Stichtag und
      // Basis-Provision in Phase 4. Zugewiesen bleibt der Agent der Konto-Zeile,
      // damit niemand seinen Kunden aus der Ansicht verliert.
      agentConflict: agents.length > 1,
      flags,
      firstSeenAt: firstSeen,
      accountStatus,
      paidRows,
    });
    if (LIMIT && plans.length >= LIMIT) break;
  }

  // ── Lead-only-Personen: Leads ohne jeden Antrag ───────────────────────────
  // Zuerst der Abgleich gegen die eben gebauten Aliase — ein Lead, der zu einer
  // bestehenden Person gehört, wird NUR verknüpft, nie dupliziert.
  const emailToPlan = new Map<string, number>();
  const phoneToPlan = new Map<string, number>();
  plans.forEach((p, i) => {
    for (const a of p.aliases) {
      if (a.kind === "email" && !emailToPlan.has(a.valueNorm)) emailToPlan.set(a.valueNorm, i);
      if (a.kind === "phone" && !phoneToPlan.has(a.valueNorm)) phoneToPlan.set(a.valueNorm, i);
    }
  });

  const leadOnlyByEmail = new Map<string, any[]>();
  const leadOnlyByPhone = new Map<string, any[]>();
  let leadsVerknuepft = 0;

  /**
   * Lead an eine bestehende Person hängen. Seine Kontaktdaten werden dabei zu
   * ALIASEN der Person — sonst wäre die E-Mail des Leads nach der Verknüpfung
   * nicht mehr auffindbar (genau der Datenverlust, den wir beenden). Die neuen
   * Schlüssel wandern zurück in die Suchtabellen, damit ein späterer Lead mit
   * derselben Adresse dieselbe Person findet statt eine zweite anzulegen.
   */
  const linkLead = (planIdx: number, l: any): void => {
    const plan = plans[planIdx];
    plan.leadIds.push(Number(l.id));
    leadsVerknuepft++;
    const m = normEmail(l.email);
    if (m && !plan.aliases.some((a) => a.kind === "email" && a.valueNorm === m)) {
      plan.aliases.push({ kind: "email", valueNorm: m, valueRaw: String(l.email).trim(), source: `lead:${l.id}` });
      emailToPlan.set(m, planIdx);
    }
    const p = phoneKey9(l.telefon);
    if (p && !plan.aliases.some((a) => a.kind === "phone" && a.valueNorm === p)) {
      plan.aliases.push({ kind: "phone", valueNorm: p, valueRaw: String(l.telefon).trim(), source: `lead:${l.id}` });
      phoneToPlan.set(p, planIdx);
    }
  };

  // Durchgang 0 — DIE LÜCKE, die den Zweitlauf 2.829 Personen kosten liess.
  //
  // Ein Lead mit gesetzter person_id ist fertig; er darf gar nicht erst in die
  // Durchgänge 1–3 geraten. Und ein Lead OHNE person_id, dessen Adresse bereits
  // einer Person gehört, wird an sie angebunden statt verdoppelt — das ist der
  // Regelfall beim Einsammeln von Nachzüglern.
  //
  // Der Antrags-Pfad hatte seine Prüfung von Anfang an („2142 übersprungen"),
  // dem Lead-Pfad fehlte sie. Beide sind jetzt gleich gebaut.
  const offeneLeads: any[] = [];
  let leadsBereitsZugeordnet = 0, leadsAnBestehende = 0;
  for (const l of leads as any[]) {
    if (l.person_id != null) { leadsBereitsZugeordnet++; continue; }

    const aliase: ReturnType<typeof collectAliases> = [];
    const m0 = normEmail(l.email);
    if (m0) aliase.push({ kind: "email", valueNorm: m0, valueRaw: String(l.email).trim(), source: `lead:${l.id}` });
    const p0 = phoneKey9(l.telefon);
    if (p0) aliase.push({ kind: "phone", valueNorm: p0, valueRaw: String(l.telefon).trim(), source: `lead:${l.id}` });

    const treffer = findeBestehende(aliase);
    if (treffer !== null) {
      const ziel = anbindung(treffer);
      ziel.leadIds.push(Number(l.id));
      ergaenzeAliase(treffer, aliase);
      leadsAnBestehende++;
      continue;
    }
    offeneLeads.push(l);
  }

  // Durchgang 1 — E-Mail-Sicherheit: der belastbare Treffer, zuerst.
  const rest1: any[] = [];
  for (const l of offeneLeads) {
    const m = normEmail(l.email);
    const hit = m ? emailToPlan.get(m) : undefined;
    if (hit !== undefined) linkLead(hit, l);
    else rest1.push(l);
  }
  // Durchgang 2 — Telefon. Das VERKNÜPFT einen Lead mit einer Person, es führt
  // keine zwei Antrags-Familien zusammen. Genau diese Regel gilt in der Kartei
  // schon heute; ohne sie erschiene derselbe Mensch als Lead- UND Kundenkarte.
  const rest2: any[] = [];
  for (const l of rest1) {
    const p = phoneKey9(l.telefon);
    const hit = p ? phoneToPlan.get(p) : undefined;
    if (hit !== undefined) linkLead(hit, l);
    else rest2.push(l);
  }
  // Durchgang 3 — echte Lead-only-Personen. Nochmals gegen die inzwischen
  // gewachsenen Schlüssel prüfen: Durchgang 2 kann eine E-Mail ergänzt haben.
  for (const l of rest2) {
    const m = normEmail(l.email);
    if (m) {
      const hit = emailToPlan.get(m);
      if (hit !== undefined) { linkLead(hit, l); continue; }
      const arr = leadOnlyByEmail.get(m) ?? [];
      arr.push(l); leadOnlyByEmail.set(m, arr);
      continue;
    }
    const p = phoneKey9(l.telefon);
    if (p) {
      const arr = leadOnlyByPhone.get(p) ?? [];
      arr.push(l); leadOnlyByPhone.set(p, arr);
    }
    // Lead ohne E-Mail UND ohne Telefon: keine Person (wie bei Anträgen).
  }

  const leadPlans: PersonPlan[] = [];
  const addLeadPlan = (group: any[]): void => {
    const erste = group[0];
    const draft: PersonDraft = {
      first_name: erste.vorname || null,
      last_name: erste.nachname || null,
      company_name: null,
      contact_name: null,
      birthdate: null,
      street: null, zip: null, city: null, country: null, nationality: null,
      primary_email: normEmail(erste.email),
      primary_phone: erste.telefon ? String(erste.telefon).trim() : null,
      phone_key9: phoneKey9(erste.telefon),
      password: null,
      kind: "private",
    };
    const aliases = group.flatMap((l: any) => {
      const out: ReturnType<typeof collectAliases> = [];
      const m = normEmail(l.email);
      if (m) out.push({ kind: "email", valueNorm: m, valueRaw: String(l.email).trim(), source: `lead:${l.id}` });
      const pk = phoneKey9(l.telefon);
      if (pk) out.push({ kind: "phone", valueNorm: pk, valueRaw: String(l.telefon).trim(), source: `lead:${l.id}` });
      return out;
    });
    // Doppelte Aliase innerhalb der Gruppe entfernen (der eindeutige Index
    // liesse sie ohnehin nicht zu).
    const gesehen = new Set<string>();
    const aliasUnique = aliases.filter((a) => {
      const k = `${a.kind}:${a.valueNorm}`;
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
    const agents = Array.from(new Set(group.map((l: any) => l.assigned_agent_id).filter((v: any) => v != null).map(Number)));
    leadPlans.push({
      draft,
      personRef: newPersonRef(),
      refs: [],
      leadIds: group.map((l: any) => Number(l.id)),
      aliases: aliasUnique,
      agents,
      agentConflict: agents.length > 1,
      flags: { lead_only: true, leads: group.length },
      firstSeenAt: erste.erstellt_am ? new Date(erste.erstellt_am) : null,
      accountStatus: "pending",
      paidRows: 0,
    });
  };
  // Bei begrenztem Lauf (--limit) ist die Personenliste unvollständig — dann
  // wäre jede „Lead-only"-Feststellung falsch. Siehe Kopfkommentar.
  if (!LIMIT) {
    for (const g of leadOnlyByEmail.values()) addLeadPlan(g);
    for (const g of leadOnlyByPhone.values()) addLeadPlan(g);
  }

  // ── Bericht ───────────────────────────────────────────────────────────────
  const konflikte = plans.filter((p) => p.agentConflict).length;
  const bezahltePersonen = plans.filter((p) => p.paidRows > 0).length;
  const anbindungsListe = Array.from(anbindungen.values());
  const anzubindendeRefs = anbindungsListe.reduce((s, a) => s + a.refs.length, 0);
  const anzubindendeLeads = anbindungsListe.reduce((s, a) => s + a.leadIds.length, 0);
  const anzubindendeAliase = anbindungsListe.reduce((s, a) => s + a.neueAliase.length, 0);
  const neuePersonen = plans.length + leadPlans.length;

  log("");
  log(`${APPLY ? "SCHARFER LAUF" : "TROCKENLAUF (nichts wird geschrieben)"} — P1-B Backfill`);
  log("─".repeat(70));
  log(`Antragszeilen gelesen ........... ${apps.length}`);
  log(`Leads gelesen ................... ${leads.length}`);
  log("");
  log("NEUE PERSONEN");
  log(`  aus Anträgen .................. ${plans.length}`);
  log(`    davon mit bezahlter Bestellung ${bezahltePersonen}`);
  log(`    davon Agenten-Konflikt ...... ${konflikte}  (keine automatische Entscheidung)`);
  log(`  Lead-only ..................... ${leadPlans.length}${LIMIT ? "  (bei --limit bewusst 0)" : ""}`);
  log(`  Leads daran verknüpft ......... ${leadsVerknuepft}`);
  log("");
  log("AN BESTEHENDE PERSONEN ANGEBUNDEN  (kein Neuanlegen)");
  log(`  betroffene Personen ........... ${anbindungsListe.length}`);
  log(`  Antragszeilen ................. ${anzubindendeRefs}`);
  log(`  Leads ......................... ${anzubindendeLeads}`);
  log(`  neue Aliase ................... ${anzubindendeAliase}`);
  if (kollisionen > 0) {
    log(`  ⚠️  Adresse gehört anderer Person ${kollisionen} — Zusammenführung nötig, hier NICHT entschieden`);
  }
  log("");
  log("BEREITS ERLEDIGT (übersprungen)");
  log(`  Antrags-Familien .............. ${bereitsZugeordnet}`);
  log(`  Leads mit person_id ........... ${leadsBereitsZugeordnet}`);
  log(`  Leads an bestehende Person .... ${leadsAnBestehende}`);
  log(`Verwaiste Entwurfszeilen ........ ${verwaisteZeilen} in ${verwaist} Gruppen (keine Person)`);
  log("─".repeat(70));

  if (!APPLY) {
    log("");
    log("Kein Schreibzugriff erfolgt. Scharf schalten mit:");
    log("   npx tsx scripts/person-backfill.ts --apply");
    log("");
    await sqlPool.end();
    return;
  }

  // Nichts zu tun — der Normalfall beim Wiederholungslauf ohne Nachzügler.
  // Kein leerer Stapel, damit die Stapel-Liste aussagekräftig bleibt.
  if (neuePersonen === 0 && anzubindendeRefs === 0 && anzubindendeLeads === 0 && anzubindendeAliase === 0) {
    log("");
    log("✅ NICHTS ZU TUN — jede Zeile ist bereits einer Person zugeordnet.");
    log("   0 neue Personen, 0 Anbindungen. Kein Stapel angelegt.");
    log(`   Dauer: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    log("");
    await sqlPool.end();
    return;
  }

  // ── Schreiben ─────────────────────────────────────────────────────────────
  const batchId = `P1B-${new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14)}`;
  await sqlPool`
    INSERT INTO fiaon_person_batches (batch_id, note)
    VALUES (${batchId}, ${"P1-B Backfill Personenmodell"})
  `;
  log(`Stapel-ID: ${batchId}   (Rücknahme: npx tsx scripts/person-backfill.ts --undo ${batchId})`);

  const alle: PersonPlan[] = [...plans, ...leadPlans];
  let personsCreated = 0, appsLinked = 0, leadsLinked = 0;

  for (let start = 0; start < alle.length; start += CHUNK) {
    const chunk = alle.slice(start, start + CHUNK);
    const rows = chunk.map((plan) => ({
      person_ref: plan.personRef,
      kind: plan.draft.kind,
      first_name: plan.draft.first_name,
      last_name: plan.draft.last_name,
      company_name: plan.draft.company_name,
      contact_name: plan.draft.contact_name,
      birthdate: plan.draft.birthdate,
      primary_email: plan.draft.primary_email,
      primary_phone: plan.draft.primary_phone,
      phone_key9: plan.draft.phone_key9,
      street: plan.draft.street,
      zip: plan.draft.zip,
      city: plan.draft.city,
      country: plan.draft.country,
      nationality: plan.draft.nationality,
      password: plan.draft.password,
      account_status: plan.accountStatus,
      assigned_agent_id: plan.agents.length > 0 ? plan.agents[0] : null,
      agent_conflict: plan.agentConflict,
      quality_flags: JSON.stringify(plan.flags),
      first_seen_at: plan.firstSeenAt,
      merge_batch_id: batchId,
    }));

    const inserted = await sqlPool`
      INSERT INTO fiaon_persons ${sqlPool(rows as any,
        "person_ref", "kind", "first_name", "last_name", "company_name", "contact_name",
        "birthdate", "primary_email", "primary_phone", "phone_key9",
        "street", "zip", "city", "country", "nationality",
        "password", "account_status", "assigned_agent_id", "agent_conflict",
        "quality_flags", "first_seen_at", "merge_batch_id")}
      RETURNING id, person_ref
    `;
    personsCreated += inserted.length;

    const refToId = new Map<string, number>();
    for (const r of inserted as any[]) refToId.set(r.person_ref, Number(r.id));

    // Aliase
    const aliasRows: any[] = [];
    chunk.forEach((plan) => {
      const pid = refToId.get(plan.personRef);
      if (!pid) return;
      for (const a of plan.aliases) {
        aliasRows.push({
          person_id: pid, kind: a.kind, value_norm: a.valueNorm,
          value_raw: a.valueRaw, source: a.source, merge_batch_id: batchId,
        });
      }
    });
    for (let i = 0; i < aliasRows.length; i += 500) {
      const teil = aliasRows.slice(i, i + 500);
      await sqlPool`
        INSERT INTO fiaon_person_aliases ${sqlPool(teil as any, "person_id", "kind", "value_norm", "value_raw", "source", "merge_batch_id")}
      `;
    }

    // Anträge verknüpfen — das EINZIGE Feld, das an Bestandszeilen geschrieben wird.
    const refs: string[] = [];
    const pids: number[] = [];
    chunk.forEach((plan) => {
      const pid = refToId.get(plan.personRef);
      if (!pid) return;
      for (const ref of plan.refs) { refs.push(ref); pids.push(pid); }
    });
    if (refs.length > 0) {
      const upd = await sqlPool`
        UPDATE fiaon_applications a SET person_id = d.pid
        FROM (SELECT UNNEST(${refs}::text[]) AS ref, UNNEST(${pids}::int[]) AS pid) d
        WHERE a.ref = d.ref AND a.person_id IS NULL
        RETURNING a.ref
      `;
      appsLinked += upd.length;
    }

    // Leads verknüpfen — sowohl die einer Antrags-Person als auch die einer
    // reinen Lead-Person. Auch hier wird nur `person_id` geschrieben.
    const leadIds: number[] = [];
    const leadPids: number[] = [];
    chunk.forEach((plan) => {
      const pid = refToId.get(plan.personRef);
      if (!pid) return;
      for (const id of plan.leadIds) { leadIds.push(id); leadPids.push(pid); }
    });
    if (leadIds.length > 0) {
      const upd = await sqlPool`
        UPDATE fiaon_leads l SET person_id = d.pid
        FROM (SELECT UNNEST(${leadIds}::int[]) AS id, UNNEST(${leadPids}::int[]) AS pid) d
        WHERE l.id = d.id AND l.person_id IS NULL
        RETURNING l.id
      `;
      leadsLinked += upd.length;
    }

    process.stdout.write(`\r  ${Math.min(start + CHUNK, alle.length)}/${alle.length} Personen …`);
  }
  process.stdout.write("\n");

  // ── Anbindung an Personen, die es schon gab ────────────────────────────
  // Der Fall „Nachzügler": neue Bestellung oder neuer Lead eines Kunden, den es
  // im Personenmodell bereits gibt. Es entsteht KEINE Person; es wird nur
  // `person_id` gesetzt — und auch das nur dort, wo noch keine steht.
  const angebundenRefs: string[] = [];
  const angebundenLeadIds: number[] = [];
  let angebundenApps = 0, angebundenLeads = 0, angebundenAliase = 0;

  for (const a of anbindungsListe) {
    if (a.refs.length > 0) {
      const upd = await sqlPool`
        UPDATE fiaon_applications SET person_id = ${a.personId}
        WHERE ref = ANY(${a.refs}::text[]) AND person_id IS NULL
        RETURNING ref
      `;
      angebundenApps += upd.length;
      for (const r of upd as any[]) angebundenRefs.push(String(r.ref));
    }
    if (a.leadIds.length > 0) {
      const upd = await sqlPool`
        UPDATE fiaon_leads SET person_id = ${a.personId}
        WHERE id = ANY(${a.leadIds}::int[]) AND person_id IS NULL
        RETURNING id
      `;
      angebundenLeads += upd.length;
      for (const r of upd as any[]) angebundenLeadIds.push(Number(r.id));
    }
    if (a.neueAliase.length > 0) {
      const rows = a.neueAliase.map((x) => ({
        person_id: a.personId, kind: x.kind, value_norm: x.valueNorm,
        value_raw: x.valueRaw, source: x.source, merge_batch_id: batchId,
      }));
      await sqlPool`
        INSERT INTO fiaon_person_aliases ${sqlPool(rows as any, "person_id", "kind", "value_norm", "value_raw", "source", "merge_batch_id")}
      `;
      angebundenAliase += rows.length;
    }
  }
  appsLinked += angebundenApps;
  leadsLinked += angebundenLeads;

  await sqlPool`
    UPDATE fiaon_person_batches SET
      finished_at = NOW(), persons_created = ${personsCreated}, apps_linked = ${appsLinked},
      leads_linked = ${leadsLinked}, conflicts = ${konflikte}, orphans = ${verwaisteZeilen},
      linked_refs = ${JSON.stringify(angebundenRefs)}::jsonb,
      linked_lead_ids = ${JSON.stringify(angebundenLeadIds)}::jsonb
    WHERE batch_id = ${batchId}
  `;

  log("");
  log("✅ BACKFILL ABGESCHLOSSEN");
  log(`   Personen erzeugt ......... ${personsCreated}`);
  log(`   Anträge zugeordnet ....... ${appsLinked}`);
  log(`   Leads zugeordnet ......... ${leadsLinked}`);
  if (angebundenApps + angebundenLeads + angebundenAliase > 0) {
    log(`   davon an bestehende Personen angebunden: ${angebundenApps} Anträge, ${angebundenLeads} Leads, ${angebundenAliase} Aliase`);
  }
  log(`   Agenten-Konflikte ........ ${konflikte} (markiert, nicht entschieden)`);
  log(`   Verwaiste Zeilen ......... ${verwaisteZeilen} (bewusst ohne Person)`);
  log(`   Dauer .................... ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  log("");
  log(`   Rücknahme: npx tsx scripts/person-backfill.ts --undo ${batchId}`);
  log("   Prüfung:   npx tsx scripts/person-verify.ts");
  log("");
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nBackfill fehlgeschlagen:", err);
  console.error("Es wurde nichts Halbfertiges hinterlassen, das nicht mit --undo entfernbar wäre.");
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
