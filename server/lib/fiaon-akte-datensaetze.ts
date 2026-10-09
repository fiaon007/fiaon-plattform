// ═══════════════════════════════════════════════════════════════════════════
// ALLE DATENSÄTZE EINES KUNDEN — FÜR DIE EINE AKTE (09.10.2026, E-328)
//
// Justin: „1 Zentrale Akte für ALLE Kunden ALLE DATENSÄTZE!!!“
//
// Bestandsaufnahme (Produktion, nur lesend, 09.10.2026): 105 Tabellen hängen über
// person_id, Antrags-Referenz, Lead, Zahlungsreferenz oder Zusammenführung an einem
// Kunden. Die Akte zeigte davon einen Teil — der Rest war nur per SQL sichtbar.
// Diese Datei sammelt ALLES zu einer Person: jede Tabelle aus REGISTER, mit Titel und
// Gruppe, gefunden über die Schlüssel, die die Tabelle tatsächlich hat (zur Laufzeit
// aus information_schema gelesen — eine neue Spalte braucht keine Code-Änderung).
//
// Geschützt bleibt, was niemand in einer Akte lesen soll:
//   · ganze Tabellen in AUSGESCHLOSSEN (Passwort-Protokolle, Anmelde-Tokens, Sicherungs-
//     kopien, Mitarbeiter-Banking) — sie erscheinen als Fußnote mit Grund, nie mit Inhalt;
//   · Spalten, deren Name nach Geheimnis klingt (GEHEIM) — sie werden gar nicht gelesen;
//   · Dateien (bytea) kommen nur als Größe, nie als Inhalt; lange Texte gekürzt;
//   · IBAN nur mit den letzten vier Stellen.
// Lesen nur — diese Datei schreibt nichts. Zugriff: Chefbüro ab Geschäftsführung
// (GET /chef/kunde/:id/datensaetze, fiaon-chef-uebersichten.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export interface DatensatzTabelle {
  tabelle: string;
  titel: string;
  gruppe: string;
  anzahl: number;
  /** Gezeigt werden höchstens ZEILEN_MAX, jüngste zuerst. */
  gekuerzt: boolean;
  spalten: string[];
  zeilen: Record<string, unknown>[];
  /** Über welche Schlüssel gefunden („Person“, „Antrag“, „Lead“ …). */
  ueber: string[];
}
export interface DatensaetzeAntwort {
  personId: number;
  personen: number[];
  antraege: string[];
  leads: number[];
  gruppen: { titel: string; tabellen: DatensatzTabelle[] }[];
  ausgeschlossen: { tabelle: string; grund: string }[];
  dauerMs: number;
}

const ZEILEN_MAX = 200;
const TEXT_MAX = 1500;

/** Gruppen in der Reihenfolge der Akte. */
const GRUPPEN = [
  "Stammdaten & Identität", "Anträge & Verträge", "Geld & Raten", "Unterlagen & Bonität",
  "Gespräche & Termine", "Mails & Nachrichten", "Mara (KI)", "Kundenbereich & App",
  "Herkunft & Werbung", "Aufgaben & Betrieb", "FIAON Global",
] as const;
type Gruppe = (typeof GRUPPEN)[number];

/** Jede Kundentabelle mit Titel und Gruppe. Reihenfolge = Reihenfolge in der Gruppe. */
const REGISTER: [string, string, Gruppe][] = [
  ["fiaon_persons", "Person (Stammdaten)", "Stammdaten & Identität"],
  ["fiaon_person_aliases", "Weitere Namen, Mails, Nummern", "Stammdaten & Identität"],
  ["fiaon_consents", "Einwilligungen", "Stammdaten & Identität"],
  ["fiaon_vollmachten", "Vollmachten", "Stammdaten & Identität"],
  ["fiaon_sperr_protokoll", "Sperren (Protokoll)", "Stammdaten & Identität"],
  ["fiaon_doppelgaenger", "Mögliche Dubletten", "Stammdaten & Identität"],
  ["fiaon_dubletten_entschieden", "Dubletten — Entscheidungen", "Stammdaten & Identität"],
  ["fiaon_merge_log", "Zusammenführungen", "Stammdaten & Identität"],
  ["fiaon_loeschungen", "Löschungen (DSGVO)", "Stammdaten & Identität"],

  ["fiaon_applications", "Anträge & Bestellungen", "Anträge & Verträge"],
  ["fiaon_antrag_ereignisse", "Antragsweg — Schritte", "Anträge & Verträge"],
  ["fiaon_vertragsannahmen", "Vertragsannahmen (Unterschrift, Fassung)", "Anträge & Verträge"],
  ["cancellation_requests", "Kündigungen", "Anträge & Verträge"],
  ["fiaon_roadmap_steps", "Fahrplan — Schritte", "Anträge & Verträge"],
  ["fiaon_roadmap_audit", "Fahrplan — Protokoll", "Anträge & Verträge"],
  ["fiaon_statements", "Erklärungen", "Anträge & Verträge"],
  ["fiaon_analysis", "Analysen", "Anträge & Verträge"],
  ["fiaon_metrics", "Kennzahlen", "Anträge & Verträge"],

  ["fiaon_abo_raten", "Raten", "Geld & Raten"],
  ["fiaon_raten_arbeit", "Raten — Arbeitsschritte", "Geld & Raten"],
  ["fiaon_bank_txns", "Bankeingänge", "Geld & Raten"],
  ["fiaon_commissions", "Provisionen", "Geld & Raten"],
  ["fiaon_provision_vormerkung", "Provisionen — vorgemerkt", "Geld & Raten"],
  ["accounting_entries", "Buchungen", "Geld & Raten"],

  ["fiaon_dokumente", "Dokumente", "Unterlagen & Bonität"],
  ["fiaon_unterlagen_akte", "Unterlagen", "Unterlagen & Bonität"],
  ["fiaon_unterlagen_teile", "Unterlagen — Teile", "Unterlagen & Bonität"],
  ["fiaon_unterlagen_anfragen", "Unterlagen — Anforderungen", "Unterlagen & Bonität"],
  ["fiaon_unterlagen_links", "Unterlagen — Upload-Links", "Unterlagen & Bonität"],
  ["fiaon_unterlagen_sichtpruefung", "Unterlagen — Sichtprüfung", "Unterlagen & Bonität"],
  ["fiaon_dokument_pruefungen", "Dokumentprüfungen", "Unterlagen & Bonität"],
  ["fiaon_kontoauszug_analysen", "Kontoauszug-Analysen", "Unterlagen & Bonität"],
  ["fiaon_schufa_analysen", "SCHUFA-Analysen", "Unterlagen & Bonität"],
  ["fiaon_finanzauswertungen", "Finanzauswertungen", "Unterlagen & Bonität"],
  ["fiaon_auskunft_beschaffung", "Auskunft — Beschaffung", "Unterlagen & Bonität"],
  ["fiaon_auskunft_klicks", "Auskunft — Klicks", "Unterlagen & Bonität"],

  ["fiaon_contact_log", "Verlauf (Kontakte, Ergebnisse, Vermerke)", "Gespräche & Termine"],
  ["fiaon_calls", "Anrufe", "Gespräche & Termine"],
  ["fiaon_call_versuche", "Anrufversuche", "Gespräche & Termine"],
  ["fiaon_rueckrufe", "Rückrufe", "Gespräche & Termine"],
  ["fiaon_termine", "Termine", "Gespräche & Termine"],
  ["fiaon_termin_versuche", "Terminversuche", "Gespräche & Termine"],
  ["fiaon_termin_treue", "Termintreue", "Gespräche & Termine"],
  ["fiaon_gespraechsblatt_log", "Gesprächsblatt", "Gespräche & Termine"],
  ["fiaon_vermerke", "Vermerke", "Gespräche & Termine"],
  ["fiaon_fehlversuch_marke", "Fehlversuch-Marken", "Gespräche & Termine"],
  ["fiaon_telefonkartei_rueckruf", "Telefonkartei — Rückrufe", "Gespräche & Termine"],
  ["fiaon_telefonkartei_storno", "Telefonkartei — Stornos", "Gespräche & Termine"],
  ["fiaon_telefonkartei_takt", "Telefonkartei — Takt", "Gespräche & Termine"],
  ["fiaon_kontakt_archiv", "Verlauf — Archiv", "Gespräche & Termine"],
  ["fiaon_applications_kontakt_archiv", "Antragsdaten — Archiv", "Gespräche & Termine"],
  ["fiaon_leads_kontakt_archiv", "Lead-Kontakte — Archiv", "Gespräche & Termine"],

  ["fiaon_mail_log", "Mails", "Mails & Nachrichten"],
  ["fiaon_postmeister", "Postfach (Postmeister)", "Mails & Nachrichten"],
  ["fiaon_postfach_threads", "Postfach — Gespräche", "Mails & Nachrichten"],
  ["fiaon_whatsapp", "WhatsApp — Nachrichten", "Mails & Nachrichten"],
  ["fiaon_whatsapp_gespraech", "WhatsApp — Gespräche", "Mails & Nachrichten"],
  ["fiaon_wa_aktion", "WhatsApp — Aktionen", "Mails & Nachrichten"],
  ["fiaon_wa_tagesplatz", "WhatsApp — Tagesplätze", "Mails & Nachrichten"],
  ["fiaon_wa_kontofehler", "WhatsApp — Kontofehler", "Mails & Nachrichten"],
  ["fiaon_monatsberichte", "Monatsberichte", "Mails & Nachrichten"],
  ["fiaon_push_log", "Push-Nachrichten", "Mails & Nachrichten"],
  ["fiaon_push_abos", "Push-Geräte", "Mails & Nachrichten"],

  ["fiaon_mara_aktion", "Mara — Aktionen", "Mara (KI)"],
  ["fiaon_mara_protokoll", "Mara — Protokoll", "Mara (KI)"],
  ["fiaon_mara_gedaechtnis", "Mara — Gedächtnis", "Mara (KI)"],
  ["fiaon_mara_ausschluss", "Mara — ausgeschlossen", "Mara (KI)"],
  ["fiaon_assistent_sitzungen", "KI-Assistent — Sitzungen", "Mara (KI)"],

  ["fiaon_login_log", "Anmeldungen", "Kundenbereich & App"],
  ["fiaon_app_ereignisse", "App-Ereignisse", "Kundenbereich & App"],
  ["fiaon_ansprueche", "Ansprüche", "Kundenbereich & App"],
  ["fiaon_anspruch_antworten", "Ansprüche — Antworten", "Kundenbereich & App"],
  ["fiaon_konto_karte", "Konto & Karte", "Kundenbereich & App"],
  ["fiaon_empfehlung", "Empfehlungen", "Kundenbereich & App"],
  ["fiaon_kurzlinks", "Kurzlinks", "Kundenbereich & App"],
  ["fiaon_click_events", "Klicks", "Kundenbereich & App"],
  ["fiaon_tickets", "Tickets", "Kundenbereich & App"],
  ["fiaon_anfragen", "Anfragen", "Kundenbereich & App"],
  ["fiaon_vorgaenge", "Vorgänge", "Kundenbereich & App"],
  ["fiaon_vorgang_ereignisse", "Vorgänge — Ereignisse", "Kundenbereich & App"],

  ["fiaon_leads", "Leads", "Herkunft & Werbung"],
  ["fiaon_lead_log", "Lead — Protokoll", "Herkunft & Werbung"],
  ["fiaon_lead_strecke_log", "Lead — Strecke", "Herkunft & Werbung"],
  ["fiaon_meta_leads", "Meta — Leads", "Herkunft & Werbung"],
  ["fiaon_meta_ereignisse", "Meta — Ereignisse", "Herkunft & Werbung"],
  ["fiaon_meta_messung", "Meta — Messung", "Herkunft & Werbung"],
  ["fiaon_meta_capi", "Meta — Rückmeldungen (CAPI)", "Herkunft & Werbung"],
  ["fiaon_firmen_leads", "Firmen-Leads", "Herkunft & Werbung"],

  ["fiaon_betreiber_todos", "Aufgaben", "Aufgaben & Betrieb"],
  ["fiaon_posts", "Beiträge mit Aktenbezug", "Aufgaben & Betrieb"],

  ["fiaon_global_angebote", "Global — Angebote", "FIAON Global"],
  ["fiaon_global_angebot_teile", "Global — Angebotsteile", "FIAON Global"],
  ["fiaon_global_auftraege", "Global — Aufträge", "FIAON Global"],
  ["fiaon_global_dokumente", "Global — Dokumente", "FIAON Global"],
  ["fiaon_global_fristen", "Global — Fristen", "FIAON Global"],
  ["fiaon_global_verlauf", "Global — Verlauf", "FIAON Global"],
];

/** Nie in einer Akte — mit Grund (erscheint als Fußnote). */
const AUSGESCHLOSSEN: Record<string, string> = {
  fiaon_passwort_klartext_protokoll: "enthält Passwörter im Klartext",
  fiaon_utm_bereinigung_protokoll: "enthielt Passwörter in Herkunftsfeldern",
  fiaon_login_links: "Anmelde-Tokens",
  fiaon_pool_start_sicherung_2026_08_25: "Sicherungskopie vom 25.08.2026",
  fiaon_zuteilung_sicherung_2026_08_25: "Sicherungskopie vom 25.08.2026",
  fiaon_person_batches: "Import-Stapel",
  call_logs: "Altbestand eines fremden Produkts (ARAS)",
};

/** Spalten, die nie gelesen werden. */
const GEHEIM = /(passw|password|hash|token|secret|geheim|klartext|cookie|api_?key|p256dh|^auth$|auth_key|signatur|session|_pin$|^pin$|pin_code|tan$|^tan_)/i;
const IBAN = /iban/i;

/** Schlüssel, über die eine Tabelle zum Kunden führt. */
const SCHLUESSEL = ["person_id", "ref", "application_ref", "lead_id", "payment_reference", "zahlungsreferenz",
  "person_a", "person_b", "akte_person", "akte_ref", "primary_ref", "loser_ref", "bestell_ref", "extracted_ref", "matched_ref"] as const;
const UEBER: Record<string, string> = {
  person_id: "Person", ref: "Antrag", application_ref: "Antrag", lead_id: "Lead", payment_reference: "Zahlungsreferenz",
  zahlungsreferenz: "Zahlungsreferenz", person_a: "Person", person_b: "Person", akte_person: "Person", akte_ref: "Antrag",
  primary_ref: "Antrag", loser_ref: "Antrag", bestell_ref: "Zahlungsreferenz", extracted_ref: "Zahlungsreferenz", matched_ref: "Zahlungsreferenz",
};

const name = (s: string) => { if (!/^[a-z0-9_]+$/.test(s)) throw new Error(`ungültiger Name ${s}`); return `"${s}"`; };
const vergleich = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

let SPALTEN: Promise<Map<string, { spalte: string; typ: string }[]>> | null = null;
/** Spalten aller Tabellen aus REGISTER — einmal je Prozess. */
function spaltenLaden(): Promise<Map<string, { spalte: string; typ: string }[]>> {
  if (!SPALTEN) {
    SPALTEN = (async () => {
      const rows = (await sqlPool`
        SELECT table_name, column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY(${REGISTER.map(([t]) => t)})
         ORDER BY table_name, ordinal_position`) as any[];
      const m = new Map<string, { spalte: string; typ: string }[]>();
      for (const r of rows) {
        const l = m.get(r.table_name) ?? [];
        l.push({ spalte: String(r.column_name), typ: String(r.data_type) });
        m.set(r.table_name, l);
      }
      return m;
    })().catch((e) => { SPALTEN = null; throw e; });
  }
  return SPALTEN;
}

/** Alle Datensätze zu einer Person (inklusive der in sie zusammengeführten Personen). */
export async function akteDatensaetze(personId: number): Promise<DatensaetzeAntwort> {
  const start = Date.now();
  // Die Familie der Akte: die Person, alles, was in sie aufgegangen ist (zwei Stufen), und der Kopf, falls sie selbst aufging.
  const fam = (await sqlPool`
    WITH RECURSIVE f(id, tiefe) AS (
      SELECT ${personId}::int, 0
      UNION SELECT p.id, f.tiefe + 1 FROM fiaon_persons p JOIN f ON p.merged_into_person_id = f.id WHERE f.tiefe < 3
    ) SELECT DISTINCT id FROM f`) as any[];
  const personen = fam.map((r) => Number(r.id));
  const antraege = ((await sqlPool`SELECT ref, payment_reference FROM fiaon_applications WHERE person_id = ANY(${personen})`) as any[]);
  const refs = antraege.map((a) => String(a.ref)).filter(Boolean);
  const raten = ((await sqlPool`SELECT zahlungsreferenz FROM fiaon_abo_raten WHERE ref = ANY(${refs.length ? refs : ["-"]})`) as any[]);
  const zahlrefs = Array.from(new Set([...antraege.map((a) => a.payment_reference), ...raten.map((r) => r.zahlungsreferenz)].filter(Boolean).map(String)));
  const zahlVgl = Array.from(new Set(zahlrefs.map(vergleich).filter((x) => x.length >= 8)));
  const leads = ((await sqlPool`SELECT id FROM fiaon_leads WHERE person_id = ANY(${personen})`.catch(() => [])) as any[]).map((r) => Number(r.id));

  const spalten = await spaltenLaden();
  const werte: Record<string, unknown[]> = {
    person_id: personen, person_a: personen, person_b: personen, akte_person: personen,
    ref: refs, application_ref: refs, akte_ref: refs, primary_ref: refs, loser_ref: refs,
    lead_id: leads, payment_reference: zahlrefs, zahlungsreferenz: zahlrefs, bestell_ref: zahlrefs,
  };

  const eine = async ([tabelle, titel, gruppe]: [string, string, Gruppe]): Promise<DatensatzTabelle | null> => {
    const sp = spalten.get(tabelle);
    if (!sp) return null;
    const vorhanden = new Set(sp.map((s) => s.spalte));
    const bedingungen: string[] = [];
    const params: unknown[] = [];
    const ueber = new Set<string>();
    if (tabelle === "fiaon_persons") {
      params.push(personen); bedingungen.push(`"id" = ANY($${params.length})`); ueber.add("Person");
    }
    for (const k of SCHLUESSEL) {
      if (!vorhanden.has(k)) continue;
      if (k === "extracted_ref" || k === "matched_ref") {
        if (!zahlVgl.length) continue;
        params.push(zahlVgl);
        bedingungen.push(`EXISTS (SELECT 1 FROM unnest($${params.length}::text[]) z WHERE UPPER(REGEXP_REPLACE(COALESCE(${name(k)}, ''), '[^A-Za-z0-9]', '', 'g')) LIKE z || '%')`);
        ueber.add(UEBER[k]);
        continue;
      }
      const w = werte[k];
      if (!w || !w.length) continue;
      params.push(w);
      // Zahlen- und Textschlüssel: als Text vergleichen — lead_id ist mal integer, mal varchar (E-210).
      bedingungen.push(`${name(k)}::text = ANY($${params.length}::text[])`);
      params[params.length - 1] = w.map(String);
      ueber.add(UEBER[k]);
    }
    if (!bedingungen.length) return { tabelle, titel, gruppe, anzahl: 0, gekuerzt: false, spalten: [], zeilen: [], ueber: [] };
    // Was gelesen wird: keine Geheimnisse; Dateien nur als Größe; lange Texte gekürzt.
    const gezeigt = sp.filter((s) => !GEHEIM.test(s.spalte));
    const auswahl = gezeigt.map((s) => {
      const n = name(s.spalte);
      if (s.typ === "bytea") return `CASE WHEN ${n} IS NULL THEN NULL ELSE '[Datei, ' || ROUND(octet_length(${n}) / 1024.0) || ' KB]' END AS ${n}`;
      if (s.typ === "text" || s.typ === "character varying" || s.typ === "json" || s.typ === "jsonb" || s.typ === "ARRAY" || s.typ === "USER-DEFINED") {
        return `LEFT(${n}::text, ${TEXT_MAX + 1}) AS ${n}`;
      }
      return n;
    }).join(", ");
    const ordnung = ["created_at", "am", "angelegt_am", "updated_at", "booked_at", "id"].find((c) => vorhanden.has(c));
    const wo = bedingungen.join(" OR ");
    const [z] = (await sqlPool.unsafe(`SELECT COUNT(*)::int AS n FROM ${name(tabelle)} WHERE ${wo}`, params as any[])) as any[];
    const anzahl = Number(z?.n || 0);
    const zeilen = anzahl === 0 ? [] : ((await sqlPool.unsafe(
      `SELECT ${auswahl} FROM ${name(tabelle)} WHERE ${wo} ${ordnung ? `ORDER BY ${name(ordnung)} DESC NULLS LAST` : ""} LIMIT ${ZEILEN_MAX}`,
      params as any[])) as any[]).map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v == null) { o[k] = null; continue; }
        if (IBAN.test(k) && typeof v === "string" && v.replace(/\s/g, "").length > 8) { const s = v.replace(/\s/g, ""); o[k] = `${s.slice(0, 4)} •••• ${s.slice(-4)}`; continue; }
        if (typeof v === "string" && v.length > TEXT_MAX) { o[k] = v.slice(0, TEXT_MAX) + " …"; continue; }
        o[k] = v instanceof Date ? v.toISOString() : v;
      }
      return o;
    });
    return { tabelle, titel, gruppe, anzahl, gekuerzt: anzahl > zeilen.length, spalten: gezeigt.map((s) => s.spalte), zeilen, ueber: Array.from(ueber) };
  };

  // In Paketen zu acht — die Akte wartet höchstens einige hundert Millisekunden, die Datenbank bleibt ruhig.
  const ergebnisse: DatensatzTabelle[] = [];
  for (let i = 0; i < REGISTER.length; i += 8) {
    const teil = await Promise.all(REGISTER.slice(i, i + 8).map((r) => eine(r).catch((e) => {
      console.error(`[AKTE-DATEN] ${r[0]}:`, e?.message || e);
      return { tabelle: r[0], titel: `${r[1]} (nicht lesbar)`, gruppe: r[2], anzahl: 0, gekuerzt: false, spalten: [], zeilen: [], ueber: [] } as DatensatzTabelle;
    })));
    for (const t of teil) if (t) ergebnisse.push(t);
  }
  return {
    personId, personen, antraege: refs, leads,
    gruppen: GRUPPEN.map((g) => ({ titel: g, tabellen: ergebnisse.filter((t) => t.gruppe === g) })),
    ausgeschlossen: Object.entries(AUSGESCHLOSSEN).map(([tabelle, grund]) => ({ tabelle, grund })),
    dauerMs: Date.now() - start,
  };
}
