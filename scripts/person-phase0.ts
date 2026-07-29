/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PERSONENMODELL — PHASE 0: MESSEN (ausschliesslich lesend)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WARUM: `fiaon_applications` vermischt Kundenkonto und Bestellung. Dieselbe
 * Person hat dort beliebig viele Zeilen (Hauptpaket, FIAON-SCHUFA-Bestellung,
 * Dubletten, Merge-Gewinner/Verlierer). Daraus folgen die gemeldeten Symptome:
 * Login-Ausfall, Doppelzaehlung bezahlter Kunden, Datenverlust beim
 * Zusammenfuehren, „verschwundene" Kunden.
 *
 * Dieses Skript legt NICHTS an und aendert NICHTS. Es beantwortet nur die
 * Fragen, ohne die der Umbau geraten waere:
 *
 *   M1  Wie viele eindeutige Personen stecken im Bestand?
 *   M2  Aufschluesselung: mit E-Mail / nur Telefon / ohne beides.
 *   M3  Konfliktfaelle ZAEHLEN (nicht loesen): Namen, Telefon-Bruecken, Agenten.
 *   M4  Leads: wie viele gehoeren zu einer bestehenden Antrags-Familie?
 *   M5  Doppelzaehlung: bezahlte Zeilen vs. bezahlte PERSONEN (SCHUFA-Effekt).
 *   M6  Anrufbare Karten: heute (zeilenweise) vs. nach Zusammenfuehrung.
 *   M7  Provisions-Baseline (Soll-Wert fuer „vorher = nachher, auf den Cent").
 *   M8  GoCardless/SEPA-Vorschau: wo muesste ein Mandat haengen?
 *
 * FAMILIENAUFLOESUNG: identisch zur Login-Logik (server/fiaon-login-logic.ts):
 * `email`, `contact_email`, `billing_email` normalisiert (klein, getrimmt),
 * plus die per `merged_into`/`superseded_by` verknuepften Zeilen. Nur diese
 * Verknuepfung gilt als SICHER. Telefon-Treffer werden getrennt gezaehlt und
 * bleiben Vorschlag (Lehre aus D5: Nummern werden in Haushalten geteilt).
 *
 * AUSGABE: Markdown auf stdout (fuer SYSTEM_DIAGNOSE.md). Keine Namen, keine
 * Adressen, keine Klartext-E-Mails — nur Zahlen und interne Referenzen.
 *
 * Verwendung: npx tsx scripts/person-phase0.ts
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 3,
  connection: { statement_timeout: "45s" },
});

// ── Normalisierung — exakt die Regeln der Login-Logik ────────────────────────
function normEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || !s.includes("@") || !s.includes(".")) return null;
  return s;
}
/** Letzte 9 Ziffern — robust gegen +49/0049/0-Praefixe. Erst ab 7 Ziffern. */
function phoneKey(...parts: unknown[]): string | null {
  const d = parts.map((p) => String(p ?? "")).join("").replace(/\D/g, "");
  if (d.length < 7) return null;
  return d.slice(-9);
}
function nameKey(r: AppRow): string | null {
  const person = [r.first_name, r.last_name].filter(Boolean).join(" ").trim().toLowerCase();
  if (person) return person;
  const firma = String(r.company_name ?? r.contact_name ?? "").trim().toLowerCase();
  return firma || null;
}
/** Zusatzbestellung (Bonitaet/SCHUFA) — ein Produkt, KEIN eigenes Konto. */
function isAddonOrder(r: AppRow): boolean {
  return String(r.type ?? "").toLowerCase() === "schufa" || String(r.ref ?? "").startsWith("FIAON-SCHUFA-");
}

interface AppRow {
  id: number;
  ref: string;
  type: string | null;
  status: string | null;
  payment_status: string | null;
  email: string | null;
  contact_email: string | null;
  billing_email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  merged_into: string | null;
  superseded_by: string | null;
  assigned_agent_id: number | null;
  amount_due: string | null;
  has_iban: boolean;
  has_password: boolean;
  dismissed_at: Date | null;
  gdpr_deleted_at: Date | null;
  created_at: Date;
}

interface LeadRow {
  id: number;
  email: string | null;
  telefon: string | null;
  status: string;
  assigned_agent_id: number | null;
  converted_order_id: string | null;
  dismissed_at: Date | null;
}

// ── Union-Find ubre Zeilen ───────────────────────────────────────────────────
class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

const OPEN_PAYMENT = new Set(["pending_payment", "claimed_paid"]);
const OPEN_LEAD_STATUS = new Set(["neu", "kontaktiert", "nicht_erreichbar"]);

function eur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

async function main(): Promise<void> {
  const t0 = Date.now();

  const apps = (await sql`
    SELECT id, ref, type, status, payment_status,
           email, contact_email, billing_email,
           phone, phone_country_code, contact_phone,
           first_name, last_name, company_name, contact_name,
           merged_into, superseded_by, assigned_agent_id, amount_due,
           (iban IS NOT NULL AND TRIM(iban) <> '')          AS has_iban,
           (password IS NOT NULL AND TRIM(password) <> ''
            OR COALESCE(utm->>'password','') <> '')          AS has_password,
           dismissed_at, gdpr_deleted_at, created_at
    FROM fiaon_applications
    ORDER BY created_at ASC NULLS FIRST, id ASC
  `) as unknown as AppRow[];

  const leads = (await sql`
    SELECT id, email, telefon, status, assigned_agent_id, converted_order_id, dismissed_at
    FROM fiaon_leads
  `) as unknown as LeadRow[];

  // ── Familien bilden: E-Mail-Gleichheit + dokumentierte Merge-Ketten ────────
  const uf = new UnionFind(apps.length);
  const byRef = new Map<string, number>();
  apps.forEach((r, i) => byRef.set(r.ref, i));

  const emailFirst = new Map<string, number>(); // normalisierte E-Mail → erste Zeile
  const rowEmails: (string[])[] = [];
  const rowPhones: (string[])[] = [];

  apps.forEach((r, i) => {
    const mails = [r.email, r.contact_email, r.billing_email]
      .map(normEmail)
      .filter((v): v is string => v !== null);
    const uniqueMails = Array.from(new Set(mails));
    rowEmails.push(uniqueMails);

    const phones = [
      phoneKey(r.phone_country_code, r.phone),
      phoneKey(r.contact_phone),
    ].filter((v): v is string => v !== null);
    rowPhones.push(Array.from(new Set(phones)));

    for (const m of uniqueMails) {
      const seen = emailFirst.get(m);
      if (seen === undefined) emailFirst.set(m, i);
      else uf.union(seen, i);
    }
  });

  // Merge-/Supersede-Ketten: nach einem Zusammenfuehren lebt das Konto beim
  // Gewinner weiter — dieselbe Person, auch wenn die E-Mail abweicht.
  let mergeLinks = 0;
  apps.forEach((r, i) => {
    for (const target of [r.merged_into, r.superseded_by]) {
      if (!target) continue;
      const j = byRef.get(target);
      if (j !== undefined) {
        uf.union(i, j);
        mergeLinks++;
      }
    }
  });

  // ── Familien auswerten ────────────────────────────────────────────────────
  interface Fam {
    root: number;
    rows: number[];
    emails: Set<string>;
    phones: Set<string>;
    names: Set<string>;
    paidNames: Set<string>;
    agents: Set<number>;
    paidAgents: Set<number>;
    paidRows: number;
    addonRows: number;
    openRows: number;
    hasPassword: boolean;
    hasIban: boolean;
  }
  const fams = new Map<number, Fam>();
  apps.forEach((r, i) => {
    const root = uf.find(i);
    let f = fams.get(root);
    if (!f) {
      f = {
        root, rows: [], emails: new Set(), phones: new Set(), names: new Set(),
        paidNames: new Set(), agents: new Set(), paidAgents: new Set(),
        paidRows: 0, addonRows: 0, openRows: 0, hasPassword: false, hasIban: false,
      };
      fams.set(root, f);
    }
    f.rows.push(i);
    rowEmails[i].forEach((m) => f!.emails.add(m));
    rowPhones[i].forEach((p) => f!.phones.add(p));
    const nk = nameKey(r);
    if (nk) f.names.add(nk);
    if (r.assigned_agent_id != null) f.agents.add(Number(r.assigned_agent_id));
    if (r.payment_status === "paid") {
      f.paidRows++;
      if (nk) f.paidNames.add(nk);
      if (r.assigned_agent_id != null) f.paidAgents.add(Number(r.assigned_agent_id));
    }
    if (isAddonOrder(r)) f.addonRows++;
    if (OPEN_PAYMENT.has(String(r.payment_status)) && !r.merged_into && !r.dismissed_at) f.openRows++;
    if (r.has_password) f.hasPassword = true;
    if (r.has_iban) f.hasIban = true;
  });

  const famList = Array.from(fams.values());
  const mitEmail = famList.filter((f) => f.emails.size > 0);
  const nurTelefon = famList.filter((f) => f.emails.size === 0 && f.phones.size > 0);
  const ohneBeides = famList.filter((f) => f.emails.size === 0 && f.phones.size === 0);
  const ohneBeidesZeilen = ohneBeides.reduce((s, f) => s + f.rows.length, 0);

  // ── M3 Konflikte ──────────────────────────────────────────────────────────
  // (a) Familien mit bezahlten Zeilen unter verschiedenen Namen
  const namensKonflikte = mitEmail.filter((f) => f.paidNames.size > 1);
  // (b) Telefon-Bruecken: eine Nummer verbindet mehrere E-Mail-Familien
  const phoneToFams = new Map<string, Set<number>>();
  for (const f of mitEmail) {
    for (const p of f.phones) {
      let s = phoneToFams.get(p);
      if (!s) { s = new Set(); phoneToFams.set(p, s); }
      s.add(f.root);
    }
  }
  const telefonBruecken = Array.from(phoneToFams.entries()).filter(([, s]) => s.size > 1);
  const telefonBrueckenPersonen = new Set<number>();
  telefonBruecken.forEach(([, s]) => s.forEach((r) => telefonBrueckenPersonen.add(r)));
  // (c) Familien mit Zeilen bei verschiedenen Agenten → Grundlage Phase 4
  const agentKonflikte = famList.filter((f) => f.agents.size > 1);
  const agentKonflikteBezahlt = agentKonflikte.filter((f) => f.paidRows > 0);

  // ── M4 Leads ──────────────────────────────────────────────────────────────
  const emailToFam = new Map<string, number>();
  const phoneToFam = new Map<string, number>();
  for (const f of famList) {
    for (const m of f.emails) if (!emailToFam.has(m)) emailToFam.set(m, f.root);
    for (const p of f.phones) if (!phoneToFam.has(p)) phoneToFam.set(p, f.root);
  }
  let leadPerEmail = 0, leadPerTelefon = 0, leadEigenstaendig = 0, leadKonvertiertOhneTreffer = 0;
  const leadOnlyKeyEmail = new Map<string, number[]>();
  const leadOnlyKeyPhone = new Map<string, number[]>();
  for (const l of leads) {
    const m = normEmail(l.email);
    const p = phoneKey(l.telefon);
    if (m && emailToFam.has(m)) { leadPerEmail++; continue; }
    if (p && phoneToFam.has(p)) { leadPerTelefon++; continue; }
    if (l.converted_order_id) leadKonvertiertOhneTreffer++;
    leadEigenstaendig++;
    if (m) {
      const arr = leadOnlyKeyEmail.get(m) ?? [];
      arr.push(l.id); leadOnlyKeyEmail.set(m, arr);
    } else if (p) {
      const arr = leadOnlyKeyPhone.get(p) ?? [];
      arr.push(l.id); leadOnlyKeyPhone.set(p, arr);
    }
  }
  // Lead-only-Personen: Leads ohne Antrag, untereinander per E-Mail/Telefon zusammengefasst
  const leadOnlyPersonen = leadOnlyKeyEmail.size + leadOnlyKeyPhone.size;

  // ── M5 Doppelzaehlung ─────────────────────────────────────────────────────
  const paidRowsTotal = apps.filter((r) => r.payment_status === "paid").length;
  const paidRowsOhneMerge = apps.filter((r) => r.payment_status === "paid" && !r.merged_into).length;
  const paidPersonen = famList.filter((f) => f.paidRows > 0);
  const addonRowsTotal = apps.filter(isAddonOrder).length;
  const addonPaid = apps.filter((r) => isAddonOrder(r) && r.payment_status === "paid").length;
  const personenMitMehrerenPaid = paidPersonen.filter((f) => f.paidRows > 1);
  const addonAlsEigenePerson = famList.filter(
    (f) => f.rows.length > 0 && f.rows.every((i) => isAddonOrder(apps[i])),
  );

  // ── M6 Anrufbare Karten: heute (zeilenweise) vs. nach Zusammenfuehrung ────
  // Heute verlangt die Kartei Telefon UND E-Mail AUF DERSELBEN ZEILE.
  const karteHeuteApps = apps.filter(
    (r, i) =>
      OPEN_PAYMENT.has(String(r.payment_status)) && !r.merged_into && !r.dismissed_at &&
      rowPhones[i].length > 0 && rowEmails[i].length > 0,
  ).length;
  // Nachher: die PERSON hat Telefon und E-Mail (aus irgendeiner ihrer Zeilen).
  const kartePersonen = famList.filter(
    (f) => f.openRows > 0 && f.phones.size > 0 && f.emails.size > 0,
  ).length;
  // Offene Personen, die heute an der Zeilen-Regel scheitern (Kontaktdaten
  // liegen verteilt) — genau die Karten, die durch P1 anrufbar werden.
  const offenePersonenGesamt = famList.filter((f) => f.openRows > 0).length;
  const karteLeadOnly = leads.filter((l) => {
    if (!OPEN_LEAD_STATUS.has(l.status) || l.dismissed_at || l.converted_order_id) return false;
    const m = normEmail(l.email);
    const p = phoneKey(l.telefon);
    if (!m || !p) return false;
    return !(emailToFam.has(m) || phoneToFam.has(p));
  }).length;

  // ── M7 Provisions-Baseline ────────────────────────────────────────────────
  const prov = await sql`
    SELECT status, kind, COUNT(*)::int AS c, COALESCE(SUM(amount_cents),0)::bigint AS s
    FROM fiaon_commissions GROUP BY status, kind ORDER BY status, kind
  `;
  const provSumme = prov.reduce((acc: number, r: any) => acc + Number(r.s), 0);
  const provAnzahl = prov.reduce((acc: number, r: any) => acc + Number(r.c), 0);

  // ── M8 SEPA-Vorschau ──────────────────────────────────────────────────────
  const paidMitIban = paidPersonen.filter((f) => f.hasIban).length;
  const paidOhnePasswort = paidPersonen.filter((f) => !f.hasPassword).length;

  // ── Ausgabe ───────────────────────────────────────────────────────────────
  const berlin = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const L = (s: string) => console.log(s);

  L("");
  L(`# PERSONENMODELL — PHASE 0: BEFUND (${berlin} Berlin)`);
  L("");
  L(`Gemessen mit \`scripts/person-phase0.ts\` (nur lesend, ${((Date.now() - t0) / 1000).toFixed(1)} s).`);
  L("Familienauflösung identisch zur Login-Logik: E-Mail normalisiert über");
  L("`email`/`contact_email`/`billing_email` + dokumentierte Merge-Ketten.");
  L("");
  L("## M1 — Wie viele Menschen stecken im Bestand?");
  L("");
  L("| | Anzahl |");
  L("|---|---|");
  L(`| Zeilen in \`fiaon_applications\` | **${apps.length}** |`);
  L(`| davon DSGVO-gelöscht | ${apps.filter((r) => r.gdpr_deleted_at).length} |`);
  L(`| davon Zusatzbestellungen (Bonität/SCHUFA) | ${addonRowsTotal} |`);
  L(`| Merge-/Supersede-Verknüpfungen | ${mergeLinks} |`);
  L(`| **Eindeutige Personen (E-Mail-sicher)** | **${mitEmail.length}** |`);
  L(`| Kandidaten nur mit Telefon (kein Auto-Merge) | ${nurTelefon.length} |`);
  L(`| Zeilen ohne E-Mail UND ohne Telefon (Funnel-Abbrecher) | ${ohneBeidesZeilen} |`);
  L(`| Lead-only-Personen (kein Antrag) | ${leadOnlyPersonen} |`);
  L(`| **Summe anzulegender Personen (Antrag + Lead-only)** | **${mitEmail.length + nurTelefon.length + leadOnlyPersonen}** |`);
  L("");
  L(`Verhältnis: ${apps.length} Zeilen → ${mitEmail.length + nurTelefon.length} Personen ` +
    `(${(apps.length / Math.max(1, mitEmail.length + nurTelefon.length)).toFixed(2)} Zeilen je Mensch).`);
  L("");
  L("## M2 — Aufschlüsselung der Personen");
  L("");
  L("| Art | Personen | Zeilen |");
  L("|---|---|---|");
  L(`| mit E-Mail | ${mitEmail.length} | ${mitEmail.reduce((s, f) => s + f.rows.length, 0)} |`);
  L(`| nur Telefon | ${nurTelefon.length} | ${nurTelefon.reduce((s, f) => s + f.rows.length, 0)} |`);
  L(`| ohne beides (keine Person anlegen) | — | ${ohneBeidesZeilen} |`);
  L("");
  L(`Personen mit mehr als einer Zeile: ${famList.filter((f) => f.rows.length > 1).length} ` +
    `· grösste Familie: ${Math.max(...famList.map((f) => f.rows.length))} Zeilen`);
  L("");
  L("## M3 — Konfliktfälle (gezählt, NICHT gelöst)");
  L("");
  L("| Konflikt | Anzahl | Bedeutung |");
  L("|---|---|---|");
  L(`| (a) bezahlte Zeilen unter verschiedenen Namen | ${namensKonflikte.length} | Haushalt oder Tippfehler — Handprüfung |`);
  L(`| (b) Telefon verbindet mehrere E-Mail-Familien | ${telefonBruecken.length} Nummern / ${telefonBrueckenPersonen.size} Personen | nur Vorschlag in /admin/dubletten |`);
  L(`| (c) Familien mit Zeilen bei verschiedenen Agenten | ${agentKonflikte.length} (davon bezahlt: ${agentKonflikteBezahlt.length}) | \`agent_conflict = TRUE\`, Auflösung in Phase 4 |`);
  L("");
  if (namensKonflikte.length > 0) {
    L("Beispiele (a) — nur interne Referenzen, keine Namen:");
    L("");
    for (const f of namensKonflikte.slice(0, 15)) {
      L(`- ${f.paidNames.size} Namen · ${f.rows.length} Zeilen · Refs: ${f.rows.map((i) => apps[i].ref).join(", ")}`);
    }
    L("");
  }
  if (agentKonflikteBezahlt.length > 0) {
    L("Beispiele (c) mit Geldbezug — Agenten-IDs, keine Namen:");
    L("");
    for (const f of agentKonflikteBezahlt.slice(0, 15)) {
      L(`- Agenten ${Array.from(f.agents).join("/")} · bezahlte Zeilen: ${f.paidRows} · Refs: ${f.rows.map((i) => apps[i].ref).join(", ")}`);
    }
    L("");
  }
  L("## M4 — Leads gegen den Antragsbestand");
  L("");
  L("| | Anzahl |");
  L("|---|---|");
  L(`| Leads gesamt | ${leads.length} |`);
  L(`| gehören per E-Mail zu einer Antrags-Familie | ${leadPerEmail} |`);
  L(`| gehören per Telefon zu einer Antrags-Familie | ${leadPerTelefon} |`);
  L(`| eigenständig (echte Lead-only-Zeilen) | ${leadEigenstaendig} |`);
  L(`| als konvertiert markiert, aber KEIN Treffer im Bestand | ${leadKonvertiertOhneTreffer} |`);
  L("");
  L("## M5 — Doppelzählung „bezahlte Kunden\"");
  L("");
  L("| | Anzahl |");
  L("|---|---|");
  L(`| bezahlte ZEILEN | ${paidRowsTotal} (ohne Merge-Verlierer: ${paidRowsOhneMerge}) |`);
  L(`| **bezahlte PERSONEN** | **${paidPersonen.length}** |`);
  L(`| Personen mit mehr als einer bezahlten Zeile | ${personenMitMehrerenPaid.length} |`);
  L(`| bezahlte Bonitäts-/SCHUFA-Bestellungen | ${addonPaid} von ${addonRowsTotal} |`);
  L(`| Familien, die AUSSCHLIESSLICH aus Zusatzbestellungen bestehen | ${addonAlsEigenePerson.length} |`);
  L("");
  L(`Differenz Zeilen ↔ Personen: **${paidRowsOhneMerge - paidPersonen.length}** — genau diese Zahl wird heute zu viel gezählt.`);
  L("");
  L("## M6 — Anrufbare Karten: heute vs. nach Zusammenführung");
  L("");
  L("| | Anzahl |");
  L("|---|---|");
  L(`| offene Antragskarten heute (Telefon+E-Mail auf DERSELBEN Zeile) | ${karteHeuteApps} |`);
  L(`| offene Personen mit Telefon+E-Mail (irgendeiner ihrer Zeilen) | ${kartePersonen} |`);
  L(`| offene Personen gesamt | ${offenePersonenGesamt} |`);
  L(`| Lead-only-Karten mit vollständigem Kontakt | ${karteLeadOnly} |`);
  L("");
  L(`Erwarteter Zugewinn durch das Personenmodell: **${kartePersonen - karteHeuteApps} zusätzlich anrufbare Karten** ` +
    `(Kontaktdaten liegen heute verteilt und fallen deshalb aus der Kartei).`);
  L("");
  L("## M7 — Provisions-Baseline (Soll: vorher = nachher, auf den Cent)");
  L("");
  L("| Status | Art | Einträge | Summe |");
  L("|---|---|---|---|");
  for (const r of prov as any[]) L(`| ${r.status} | ${r.kind} | ${r.c} | ${eur(Number(r.s))} |`);
  L(`| **gesamt** | | **${provAnzahl}** | **${eur(provSumme)}** |`);
  L("");
  L("## M8 — SEPA-/GoCardless-Vorschau");
  L("");
  L(`Ein Mandat gehört an die **Person**, nicht an die Bestellung — sonst braucht ` +
    `derselbe Mensch pro Bestellung ein neues Mandat.`);
  L("");
  L("| | Anzahl |");
  L("|---|---|");
  L(`| Personen, die ein Mandat brauchen (bezahlt, Abo läuft) | ${paidPersonen.length} |`);
  L(`| davon mit hinterlegter IBAN | ${paidMitIban} |`);
  L(`| bezahlte Personen OHNE jedes Passwort (ausgesperrt) | ${paidOhnePasswort} |`);
  L("");

  await sql.end();
  console.error(`\n[PHASE0] fertig in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch(async (err) => {
  console.error("Phase-0-Messung fehlgeschlagen:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
