// ═══════════════════════════════════════════════════════════════════════════
// DER GANZE WEG DES KUNDEN — eine Zeitleiste aus allem, was das Haus über
// einen Menschen weiß. 04.09.2026 (E-118).
//
// Justin: „Mara muss wirklich den GESAMTEN Verlauf des Kunden kennen, jeden
// Mausklick, damit die Antworten wirklich PERFEKT zugeschnitten sind."
//
// VORHER: Die Akte für Mara bestand aus sechs Abfragen — 20 Kontakt-Zeilen à
// 220 Zeichen, 16 Mail-Kurzzeilen, Termine mit vier Feldern — und wurde bei
// 9.000 Zeichen mitten im JSON abgeschnitten. Telefonate (mit Zusammenfassung),
// das Bankbuch („ich habe doch überwiesen"), der Zustellstatus der Mails („ich
// habe nichts bekommen"), die Notiz des Startgesprächs, Rückrufbitten,
// Kündigungsanträge, Zusagen aus dem Forderungsmanagement, Unterlagenprüfung,
// Portal-Anmeldungen: alles unsichtbar. Frau Krüger schrieb „ihr habt mir doch
// die Kündigung bestätigt" — Mara konnte es nicht nachsehen.
//
// NACHHER: Zwanzig Quellen, jede einzeln abgesichert (eine fehlende Spalte
// lässt nie den ganzen Weg scheitern), zu EINER chronologischen Liste
// verschmolzen, älteste zuerst, mit Kopfzeile (wer zuständig ist, was zählt)
// und Zahlen (Anrufe, Mails, Zustellung, Termine, Geld). Gekappt nach Zeichen,
// nicht nach Zeilen — und was hinten wegfällt, wird als Satz zusammengefasst,
// nicht mitten im Wort abgeschnitten.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

export interface Ereignis {
  am: Date;
  /** Kurzes Etikett: mail_raus, mail_rein, anruf, termin, zahlung, rate, notiz, aufgabe, portal, unterlagen, vertrag, system */
  art: string;
  text: string;
}

export interface Kundenweg {
  ereignisse: Ereignis[];
  /** Fertig gerendert für den Prompt. */
  text: string;
  /** Die Zahlen als eine Zeile. */
  zusammenfassung: string;
  zustaendig: { rolle: string; name: string | null; kundenName: string | null } | null;
}

const D = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v); if (isNaN(d.getTime())) return null;
  // Ein reines Datum (DATE-Spalte: Mitternacht UTC) soll NACH den Ereignissen
  // desselben Tages stehen, nicht um „02:00" davor.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && (typeof v === "string" ? v.length <= 10 : true)) d.setUTCHours(21, 59, 0, 0);
  return d;
};
/** DD.MM.YY aus DATE/Timestamp/String — nie „Sat Jul 04". */
const tag = (v: any): string => { const d = D(v); if (!d) return String(v ?? ""); const p = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit" }).formatToParts(d); const g = (t: string) => p.find((x) => x.type === t)?.value ?? ""; return `${g("day")}.${g("month")}.${g("year")}`; };
const eur = (c: any) => `${(Number(c || 0) / 100).toFixed(2).replace(".", ",")} €`;
const kurz = (t: any, n: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const berlin = (d: Date) => {
  const p = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")} ${g("hour")}:${g("minute")}`;
};

/** Eine Quelle lesen — ein Fehler (fehlende Tabelle, fehlende Spalte) kostet nur diese Quelle. */
async function quelle<T>(name: string, f: () => Promise<T[]>): Promise<T[]> {
  try { return await f(); } catch (e: any) {
    console.warn(`[KUNDENWEG] ${name}:`, String(e?.message || e).slice(0, 120));
    return [];
  }
}

export async function kundenwegLesen(personId: number | null, ref: string | null, opts: { maxZeichen?: number } = {}): Promise<Kundenweg> {
  const maxZeichen = opts.maxZeichen ?? 14_000;
  const E: Ereignis[] = [];
  const add = (am: any, art: string, text: string) => { const d = D(am); if (d && text) E.push({ am: d, art, text }); };

  // ── Bestellungen der Person (alle, auch ältere) ────────────────────────
  const bestellungen = personId
    ? await quelle("bestellungen", () => sqlPool`
        SELECT ref, pack_name, amount_due, payment_reference, payment_status, created_at, paid_at, claimed_paid_at,
               cancelled_at, freigeschaltet_am, onboarding_stufe, documents_uploaded_at, kyc_status, admin_note, admin_reviewed_at,
               welcome_sent_at, payment_email_sent_at, claim_email_sent_at, confirmed_email_sent_at, last_reminder_at, reminder_count,
               mahnstopp_am, abo_gestoppt_am, abo_stopp_grund, gekuendigt_am, kuendigung_quelle, kuendigung_grund, letzte_rate_nr,
               vertrag_ende_am, kuendigung_zurueckgenommen_am, payment_proof_at, gc_subscription_start, gc_subscription_status
          FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY created_at ASC LIMIT 12` as unknown as Promise<any[]>)
    : ref
      ? await quelle("bestellung", () => sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${ref} LIMIT 1` as unknown as Promise<any[]>)
      : [];
  const refs: string[] = Array.from(new Set([...(bestellungen.map((b) => String(b.ref))), ...(ref ? [ref] : [])]));

  for (const b of bestellungen) {
    const paket = b.pack_name ? String(b.pack_name).split("\n")[0] : "Paket";
    add(b.created_at, "vertrag", `Bestellung ${b.ref}: ${paket}${b.amount_due != null ? `, ${String(b.amount_due).replace(".", ",")} €` : ""} (Zahlungsreferenz ${b.payment_reference || "—"})`);
    add(b.welcome_sent_at, "mail_raus", `Willkommensmail zu ${b.ref} gesendet`);
    add(b.payment_email_sent_at, "mail_raus", `Zahlungsdaten zu ${b.ref} gesendet`);
    add(b.claimed_paid_at, "zahlung", `Kunde meldet im Portal: „Ich habe überwiesen" (${b.ref})`);
    add(b.claim_email_sent_at, "mail_raus", `Bestätigung der Zahlungsmeldung gesendet (${b.ref})`);
    add(b.paid_at, "zahlung", `ERSTZAHLUNG EINGEGANGEN für ${b.ref}${b.amount_due != null ? ` (${String(b.amount_due).replace(".", ",")} €)` : ""}`);
    add(b.confirmed_email_sent_at, "mail_raus", `Zahlungsbestätigung gesendet (${b.ref})`);
    add(b.payment_proof_at, "unterlagen", `Kunde hat einen Zahlungsbeleg eingereicht (${b.ref})`);
    add(b.freigeschaltet_am, "portal", `Kundenbereich freigeschaltet (${b.ref})${b.onboarding_stufe ? `, Onboarding-Stufe ${b.onboarding_stufe}` : ""}`);
    add(b.documents_uploaded_at, "unterlagen", `Unterlagen hochgeladen (${b.ref})`);
    add(b.admin_reviewed_at, "unterlagen", `Unterlagen geprüft: ${b.kyc_status || "—"}${b.admin_note ? ` — Hinweis an den Kunden: „${kurz(b.admin_note, 160)}"` : ""}`);
    if (b.last_reminder_at) add(b.last_reminder_at, "mail_raus", `${Number(b.reminder_count || 0) || "Weitere"}. Zahlungserinnerung zur Bestellung ${b.ref} (letzte)`);
    add(b.mahnstopp_am, "system", `Mahnstopp gesetzt für ${b.ref}`);
    add(b.abo_gestoppt_am, "vertrag", `Abo gestoppt (${b.ref})${b.abo_stopp_grund ? `: ${kurz(b.abo_stopp_grund, 80)}` : ""}`);
    add(b.gc_subscription_start, "zahlung", `Lastschrift-Abo bei GoCardless gestartet (${b.ref}, Status ${b.gc_subscription_status || "—"})`);
    add(b.gekuendigt_am, "vertrag", `KÜNDIGUNG EINGEGANGEN (${b.kuendigung_quelle || "—"}) für ${b.ref}${b.kuendigung_grund ? ` — Grund: „${kurz(b.kuendigung_grund, 120)}"` : ""}${b.letzte_rate_nr ? ` — Rate ${b.letzte_rate_nr} bleibt die letzte` : ""}`);
    add(b.kuendigung_zurueckgenommen_am, "vertrag", `Kündigung zurückgenommen (${b.ref})`);
    add(b.vertrag_ende_am, "vertrag", `VERTRAG BEENDET (${b.ref})`);
    add(b.cancelled_at, "vertrag", `Bestellung ${b.ref} storniert`);
  }

  // ── Raten aller Bestellungen ───────────────────────────────────────────
  const raten = refs.length ? await quelle("raten", () => sqlPool`
    SELECT id, ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, mahnstufe, erinnerungen, letzte_erinnerung_at,
           rechnung_am, vorab_am, ueberfaellig_seit, storniert_am, storno_grund, eskaliert_am, inkasso_zusage_am, inkasso_wiedervorlage,
           lastschrift_status, lastschrift_am, gc_payment_id, notiz, created_at
      FROM fiaon_abo_raten WHERE ref = ANY(${refs}) ORDER BY ref, rate_nr LIMIT 60` as unknown as Promise<any[]>) : [];
  const ratenRefs: string[] = raten.map((r) => String(r.zahlungsreferenz)).filter(Boolean);
  for (const r of raten) {
    add(r.rechnung_am || r.created_at, "rate", `Rate ${r.rate_nr} (${r.zahlungsreferenz}) über ${eur(r.betrag_cents)} gestellt, fällig ${tag(r.faellig_am)}`);
    add(r.vorab_am, "mail_raus", `Vorab-Info zu Rate ${r.rate_nr} gesendet`);
    add(r.ueberfaellig_seit, "rate", `Rate ${r.rate_nr} überfällig`);
    if (r.letzte_erinnerung_at) add(r.letzte_erinnerung_at, "mail_raus", `${Number(r.erinnerungen || 0) || "Weitere"}. Erinnerung zu Rate ${r.rate_nr} (Mahnstufe ${r.mahnstufe ?? 0}, letzte)`);
    add(r.lastschrift_am, "zahlung", `Rate ${r.rate_nr}: Lastschrift ${r.lastschrift_status || "angestoßen"}${r.gc_payment_id ? " (GoCardless)" : ""}`);
    add(r.inkasso_zusage_am, "notiz", `Zusage des Kunden: zahlt Rate ${r.rate_nr} am ${tag(r.inkasso_zusage_am)}`);
    add(r.eskaliert_am, "system", `Rate ${r.rate_nr} an das Forderungsmanagement eskaliert`);
    add(r.bezahlt_am, "zahlung", `RATE ${r.rate_nr} BEZAHLT (${eur(r.betrag_cents)})`);
    add(r.storniert_am, "rate", `Rate ${r.rate_nr} storniert${r.storno_grund ? ` (${r.storno_grund})` : ""}`);
  }
  const ratenArbeit = refs.length ? await quelle("raten_arbeit", () => sqlPool`
    SELECT created_at, ergebnis, zusage_am, wiedervorlage, notiz, agent_name FROM fiaon_raten_arbeit WHERE ref = ANY(${refs}) ORDER BY created_at DESC LIMIT 30` as unknown as Promise<any[]>) : [];
  for (const a of ratenArbeit) add(a.created_at, "anruf", `Forderungsmanagement${a.agent_name ? ` (${a.agent_name})` : ""}: ${a.ergebnis || "—"}${a.zusage_am ? `, Zusage ${tag(a.zusage_am)}` : ""}${a.wiedervorlage ? `, Wiedervorlage ${tag(a.wiedervorlage)}` : ""}${a.notiz ? ` — ${kurz(a.notiz, 160)}` : ""}`);

  // ── Kontakt-Log (Person ODER eine ihrer Bestellungen) ──────────────────
  const kontakte = (personId || refs.length) ? await quelle("contact_log", () => sqlPool`
    SELECT created_at, type, outcome, note, agent_name, promised_date, scheduled_at FROM fiaon_contact_log
     WHERE voided_at IS NULL AND (${personId ? sqlPool`person_id = ${personId}` : sqlPool`FALSE`} OR ref = ANY(${refs}))
     ORDER BY created_at DESC LIMIT 120` as unknown as Promise<any[]>) : [];
  for (const k of kontakte) {
    // Der Postmeister schreibt Ein- und Ausgang auch ins Kontakt-Log — die Zeilen
    // stehen schon aus fiaon_postmeister in der Liste, mit mehr Inhalt.
    if (k.agent_name === "Postmeister" && /^(E-Mail an |Antwort gesendet|Antwort freigegeben)/.test(String(k.note || ""))) continue;
    const wer = k.agent_name && k.agent_name !== "System" ? `${k.agent_name}: ` : "";
    const art = k.type === "result" ? "anruf" : k.type === "email_sent" ? "mail_raus" : k.type === "note" ? "notiz" : k.type === "kunde_anliegen" ? "portal" : "system";
    add(k.created_at, art, `${wer}${k.outcome ? `[${k.outcome}] ` : ""}${kurz(k.note, 320)}${k.promised_date ? ` (Zusage: ${tag(k.promised_date)})` : ""}`);
  }

  // ── Telefonate mit Zusammenfassung ─────────────────────────────────────
  const anrufe = (personId || refs.length) ? await quelle("calls", () => sqlPool`
    SELECT beginn, ende, dauer_sek, richtung, status, ergebnis, zusammenfassung, transkript
      FROM fiaon_calls WHERE (${personId ? sqlPool`person_id = ${personId}` : sqlPool`FALSE`} OR ref = ANY(${refs}))
      ORDER BY beginn DESC LIMIT 25` as unknown as Promise<any[]>) : [];
  for (const c of anrufe) {
    const dauer = Number(c.dauer_sek || 0);
    const inhalt = c.zusammenfassung ? kurz(c.zusammenfassung, 420) : c.transkript ? `Transkript-Anfang: ${kurz(c.transkript, 260)}` : "";
    add(c.beginn, "anruf", `TELEFONAT ${c.richtung === "rein" ? "eingehend" : "ausgehend"}: ${c.status || "—"}${c.ergebnis ? `, ${c.ergebnis}` : ""}${dauer ? `, ${Math.floor(dauer / 60)}:${String(dauer % 60).padStart(2, "0")} Min` : ""}${inhalt ? ` — ${inhalt}` : ""}`);
  }

  // ── Termine ────────────────────────────────────────────────────────────
  const termine = personId ? await quelle("termine", () => sqlPool`
    SELECT t.beginn, t.dauer_min, t.status, t.quelle, t.notiz, t.erledigt_am, t.abgesagt_am, t.verpasst_grund, t.verpasst_mail_am,
           t.onboarding_abgeschlossen_am, a.name AS agent_name
      FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.person_id = ${personId} ORDER BY t.beginn DESC LIMIT 15` as unknown as Promise<any[]>) : [];
  for (const t of termine) {
    add(t.beginn, "termin", `TERMIN ${t.quelle === "onboarding" || t.quelle === "onboarding_call" ? "Startgespräch" : "Gespräch"}${t.agent_name ? ` mit ${t.agent_name}` : ""} am ${berlin(new Date(t.beginn))}: ${t.status}${t.verpasst_grund ? ` (${kurz(t.verpasst_grund, 80)})` : ""}${t.notiz ? ` — Notiz: ${kurz(t.notiz, 300)}` : ""}`);
    add(t.verpasst_mail_am, "mail_raus", "Nachfassmail nach verpasstem Termin gesendet");
    add(t.onboarding_abgeschlossen_am, "termin", "Onboarding abgeschlossen");
  }

  // ── Mails raus (Mailwerk/Brevo) mit Zustellung ─────────────────────────
  const person = personId ? (await quelle("person", () => sqlPool`
    SELECT primary_email, primary_phone, created_at, sprache, sprache_notiz, sprache_gesetzt_am, werbung_gesperrt_am, gc_mandate_status,
           ruhe_seit, wiedereinstieg_am, terminlink_mail_am, startgespraech_mail_am, is_blocked, account_status, assigned_agent_id, betreuung_seit,
           inkasso_ab, inkasso_grund, promised_payment_date, follow_up_date, unreachable_count
      FROM fiaon_persons WHERE id = ${personId} LIMIT 1` as unknown as Promise<any[]>))[0] : null;
  if (person) {
    add(person.created_at, "system", "Kunde im System angelegt");
    add(person.sprache_gesetzt_am, "notiz", `Sprachvermerk: ${person.sprache}${person.sprache_notiz ? ` — ${kurz(person.sprache_notiz, 100)}` : ""}`);
    add(person.werbung_gesperrt_am, "system", "WERBESPERRE gesetzt (keine Werbe- und Erinnerungsmails mehr; Vertragspost bleibt)");
    add(person.ruhe_seit, "system", "In den Ruhe-Pool gelegt (nicht erreicht)");
    add(person.wiedereinstieg_am, "system", "Wiedereinstieg aus dem Ruhe-Pool");
    add(person.terminlink_mail_am, "mail_raus", "Terminlink-Mail gesendet");
    add(person.startgespraech_mail_am, "mail_raus", "Einladung zum Startgespräch gesendet");
    add(person.betreuung_seit, "system", "Betreuer zugewiesen");
    add(person.inkasso_ab, "system", `An das Forderungsmanagement übergeben${person.inkasso_grund ? ` (${kurz(person.inkasso_grund, 80)})` : ""}`);
    add(person.promised_payment_date, "notiz", `Zahlungszusage des Kunden für den ${tag(person.promised_payment_date)}`);
  }
  const mails = personId ? await quelle("mail_log", () => sqlPool`
    SELECT created_at, event, betreff, status, zustellung, zustellung_am, zustellung_grund FROM fiaon_mail_log
     WHERE art = 'echt' AND (person_id = ${personId} OR (${person?.primary_email ?? null}::text IS NOT NULL AND LOWER(empfaenger) = LOWER(${person?.primary_email ?? ""})))
     ORDER BY created_at DESC LIMIT 40` as unknown as Promise<any[]>) : [];
  for (const m of mails) {
    const z = m.zustellung ? ` → ${m.zustellung}${m.zustellung === "gebounct" || m.zustellung === "blockiert" || m.zustellung === "spam" ? ` (${kurz(m.zustellung_grund, 60) || "Zustellproblem"})` : ""}` : m.status && m.status !== "ok" && m.status !== "gesendet" ? ` (${m.status})` : "";
    add(m.created_at, "mail_raus", `Mail „${kurz(m.betreff || m.event, 70)}"${z}`);
  }

  // ── Mails rein (Postmeister) und unsere Antworten ──────────────────────
  const post = (personId || refs.length) ? await quelle("postmeister", () => sqlPool`
    SELECT empfangen_am, postfach, betreff, zusammenfassung, kategorie, aktion, gesendet_am, antwort, flags
      FROM fiaon_postmeister WHERE (${personId ? sqlPool`person_id = ${personId}` : sqlPool`FALSE`} OR ref = ANY(${refs}))
        AND aktion NOT IN ('ignoriert') ORDER BY empfangen_am DESC LIMIT 30` as unknown as Promise<any[]>) : [];
  for (const p of post) {
    add(p.empfangen_am, "mail_rein", `KUNDE SCHREIBT an ${String(p.postfach || "").split("@")[0]}: „${kurz(p.betreff, 70)}" — ${kurz(p.zusammenfassung, 240)}${p.kategorie ? ` [${p.kategorie}]` : ""}`);
    if (p.gesendet_am) add(p.gesendet_am, "mail_raus", `Wir antworten (${p.aktion === "auto_beantwortet" ? "Mara automatisch" : "freigegeben"}): ${kurz(String(p.antwort || "").replace(/^Guten Tag[^\n]*\n/, ""), 260)}`);
  }

  // ── Anliegen, Rückrufe, Vermerke, Aufgaben, Kündigungsanträge ──────────
  const tickets = (personId || refs.length) ? await quelle("tickets", () => sqlPool`
    SELECT created_at, betreff, text, status, antwort, beantwortet_am FROM fiaon_tickets
     WHERE (${personId ? sqlPool`person_id = ${personId}` : sqlPool`FALSE`} OR ref = ANY(${refs})) ORDER BY created_at DESC LIMIT 15` as unknown as Promise<any[]>) : [];
  for (const t of tickets) {
    add(t.created_at, "portal", `Anliegen im Kundenbereich: „${kurz(t.betreff, 60)}" — ${kurz(t.text, 200)} (${t.status})`);
    add(t.beantwortet_am, "portal", `Anliegen beantwortet: ${kurz(t.antwort, 200)}`);
  }
  const rueckrufe = personId ? await quelle("rueckrufe", () => sqlPool`
    SELECT created_at, quelle, anliegen, frist_bis, status, ergebnis_notiz, erledigt_am FROM fiaon_rueckrufe WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 10` as unknown as Promise<any[]>) : [];
  for (const r of rueckrufe) {
    add(r.created_at, "anruf", `Rückruf erbeten (${r.quelle}): „${kurz(r.anliegen, 160)}" — Status ${r.status}${r.frist_bis ? `, Frist ${berlin(new Date(r.frist_bis))}` : ""}`);
    add(r.erledigt_am, "anruf", `Rückruf erledigt${r.ergebnis_notiz ? `: ${kurz(r.ergebnis_notiz, 200)}` : ""}`);
  }
  const vermerke = refs.length ? await quelle("vermerke", () => sqlPool`
    SELECT created_at, art, text, status, faellig_am, dringend, autor_name, erledigt_am FROM fiaon_vermerke
     WHERE ref = ANY(${refs}) AND entfernt_am IS NULL ORDER BY created_at DESC LIMIT 20` as unknown as Promise<any[]>) : [];
  for (const v of vermerke) add(v.created_at, v.art === "aufgabe" ? "aufgabe" : "notiz", `${v.art === "aufgabe" ? "Aufgabe" : "Notiz"} von ${v.autor_name || "—"}: ${kurz(v.text, 240)}${v.art === "aufgabe" ? ` (${v.status}${v.faellig_am ? `, fällig ${tag(v.faellig_am)}` : ""}${v.dringend ? ", dringend" : ""})` : ""}`);
  const todos = (personId || refs.length) ? await quelle("todos", () => sqlPool`
    SELECT created_at, titel, status, faellig_am, zustaendig_name, quelle, ergebnis FROM fiaon_betreiber_todos
     WHERE ${refs.length ? sqlPool`link LIKE ANY(${refs.map((r) => `%${r}%`)})` : sqlPool`FALSE`} OR schluessel LIKE ${`postmeister:${personId ?? "x"}:%`}
     ORDER BY created_at DESC LIMIT 15` as unknown as Promise<any[]>) : [];
  for (const t of todos) add(t.created_at, "aufgabe", `Auftrag${t.zustaendig_name ? ` für ${t.zustaendig_name}` : ""}: „${kurz(t.titel, 90)}" — ${t.status}${t.faellig_am ? `, fällig ${tag(t.faellig_am)}` : ""}${t.ergebnis ? ` — Ergebnis: ${kurz(t.ergebnis, 160)}` : ""}`);
  const kuendAntraege = refs.length ? await quelle("cancellation_requests", () => sqlPool`
    SELECT created_at, reason, cancellation_date, status, admin_note, processed_at FROM cancellation_requests WHERE ref = ANY(${refs}) ORDER BY created_at DESC LIMIT 5` as unknown as Promise<any[]>) : [];
  for (const k of kuendAntraege) {
    add(k.created_at, "vertrag", `KÜNDIGUNGSANTRAG über das Portal: „${kurz(k.reason, 160)}"${k.cancellation_date ? `, gewünscht zum ${tag(k.cancellation_date)}` : ""} — Status ${k.status}`);
    add(k.processed_at, "vertrag", `Kündigungsantrag bearbeitet: ${k.status}${k.admin_note ? ` — ${kurz(k.admin_note, 160)}` : ""}`);
  }

  // ── Geld: Bankbuch ─────────────────────────────────────────────────────
  const alleRefs = Array.from(new Set([...refs, ...ratenRefs]));
  const bank = alleRefs.length ? await quelle("bank_txns", () => sqlPool`
    SELECT booked_at, amount_cents, payer_name, reference_raw, matched_ref, match_status, applied FROM fiaon_bank_txns
     WHERE matched_ref = ANY(${alleRefs}) OR extracted_ref = ANY(${alleRefs}) ORDER BY booked_at DESC LIMIT 20` as unknown as Promise<any[]>) : [];
  for (const b of bank) add(b.booked_at, "zahlung", `BANKEINGANG ${eur(b.amount_cents)} von „${kurz(b.payer_name, 40)}", Verwendungszweck „${kurz(b.reference_raw, 50)}" → ${b.matched_ref || "nicht zugeordnet"} (${b.match_status || "—"}${b.applied ? ", verbucht" : ", NICHT verbucht"})`);

  // ── Portal: Anmeldungen, Fahrplan, Auszüge, Unterlagenprüfung ──────────
  const logins = refs.length ? await quelle("login_log", () => sqlPool`
    SELECT at, code, reason FROM fiaon_login_log WHERE ref = ANY(${refs}) ORDER BY at DESC LIMIT 12` as unknown as Promise<any[]>) : [];
  for (const l of logins) add(l.at, "portal", l.code === "ok" || !l.reason ? "Im Kundenbereich angemeldet" : `Anmeldung im Kundenbereich fehlgeschlagen (${kurz(l.reason || l.code, 60)})`);
  const schritte = refs.length ? await quelle("roadmap", () => sqlPool`
    SELECT completed_at, title FROM fiaon_roadmap_steps WHERE ref = ANY(${refs}) AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 12` as unknown as Promise<any[]>) : [];
  for (const s of schritte) add(s.completed_at, "portal", `Fahrplan-Schritt erledigt: „${kurz(s.title, 80)}"`);
  const auszuege = refs.length ? await quelle("statements", () => sqlPool`
    SELECT uploaded_at, month_label, filename FROM fiaon_statements WHERE ref = ANY(${refs}) AND deleted_at IS NULL ORDER BY uploaded_at DESC LIMIT 8` as unknown as Promise<any[]>) : [];
  for (const a of auszuege) add(a.uploaded_at, "unterlagen", `Kontoauszug hochgeladen${a.month_label ? ` (${a.month_label})` : ""}`);
  const pruefungen = refs.length ? await quelle("dokument_pruefungen", () => sqlPool`
    SELECT created_at, art, urteil FROM fiaon_dokument_pruefungen WHERE ref = ANY(${refs}) ORDER BY created_at DESC LIMIT 6` as unknown as Promise<any[]>) : [];
  for (const p of pruefungen) {
    const u = typeof p.urteil === "string" ? (() => { try { return JSON.parse(p.urteil); } catch { return {}; } })() : (p.urteil || {});
    add(p.created_at, "unterlagen", `Dokument geprüft (${p.art}): ${u.auffaellig ? "AUFFÄLLIG — " : ""}${kurz(u.zusammenfassung || u.hinweis || u.grund || JSON.stringify(u), 160)}`);
  }
  const analysen = refs.length ? await quelle("kontoauszug_analysen", () => sqlPool`
    SELECT created_at, status, ruecklastschriften, dispo_genutzt, warnungen FROM fiaon_kontoauszug_analysen WHERE ref = ANY(${refs}) ORDER BY created_at DESC LIMIT 3` as unknown as Promise<any[]>) : [];
  for (const a of analysen) add(a.created_at, "unterlagen", `Kontoauszug ausgewertet (${a.status})${a.ruecklastschriften ? `, ${a.ruecklastschriften} Rücklastschrift(en)` : ""}${a.dispo_genutzt ? ", Dispo genutzt" : ""}${a.warnungen ? ` — ${kurz(Array.isArray(a.warnungen) ? a.warnungen.join("; ") : a.warnungen, 160)}` : ""}`);
  const karte = personId ? await quelle("konto_karte", () => sqlPool`
    SELECT gesendet_am, status FROM fiaon_konto_karte WHERE person_id = ${personId} ORDER BY gesendet_am DESC LIMIT 3` as unknown as Promise<any[]>) : [];
  for (const k of karte) add(k.gesendet_am, "mail_raus", `Angebot Konto & Karte gesendet (Status ${k.status})`);
  const anfragen = personId ? await quelle("anfragen", () => sqlPool`
    SELECT a.created_at, to_jsonb(a)->>'status' AS status, COALESCE(to_jsonb(a)->>'betreff', to_jsonb(a)->>'anliegen', to_jsonb(a)->>'nachricht', to_jsonb(a)->>'text') AS text FROM fiaon_anfragen a WHERE a.person_id = ${personId} ORDER BY a.created_at DESC LIMIT 5` as unknown as Promise<any[]>) : [];
  for (const a of anfragen) add(a.created_at, "portal", `Anfrage über die Website: „${kurz(a.text, 160)}" (${a.status || "—"})`);
  const kartei = refs.length ? await quelle("kartei_events", () => sqlPool`
    SELECT created_at, event, actor FROM fiaon_kartei_events WHERE card_id = ANY(${refs}) ORDER BY created_at DESC LIMIT 8` as unknown as Promise<any[]>) : [];
  for (const k of kartei) add(k.created_at, "system", `Kartei: ${k.event}${k.actor ? ` durch ${kurz(k.actor, 40)}` : ""}`);

  // ── Zuständigkeit ──────────────────────────────────────────────────────
  let zustaendig: Kundenweg["zustaendig"] = null;
  if (personId) {
    try {
      const { zustaendigeRolle } = await import("./fiaon-zustaendigkeit");
      const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
      const z = await zustaendigeRolle(personId);
      const e = await auftragEmpfaenger(personId);
      zustaendig = { rolle: z?.rolle ?? "vertrieb", name: e.name, kundenName: e.kundenName };
    } catch { /* ohne Zuständigkeit weiter */ }
  }

  // ── Sortieren, zählen, rendern ─────────────────────────────────────────
  E.sort((a, b) => a.am.getTime() - b.am.getTime());
  const n = (art: string, f?: (e: Ereignis) => boolean) => E.filter((e) => e.art === art && (!f || f(e))).length;
  const zahlen = [
    `${E.length} Ereignisse${E.length ? ` seit ${berlin(E[0].am).slice(0, 8)}` : ""}`,
    `${n("mail_raus")} Mails von uns${mails.length ? ` (${mails.filter((m) => m.zustellung === "geoeffnet" || m.zustellung === "geklickt").length} geöffnet, ${mails.filter((m) => ["gebounct", "blockiert", "spam"].includes(String(m.zustellung))).length} nicht zugestellt)` : ""}`,
    `${n("mail_rein")} Mails vom Kunden`,
    `${n("anruf")} Anruf-/Rückruf-Einträge`,
    `${termine.length} Termine (${termine.filter((t) => t.status === "verpasst").length} verpasst)`,
    `${raten.filter((r) => r.status === "bezahlt").length} Raten bezahlt, ${raten.filter((r) => r.status === "offen").length} offen`,
    `${bank.length} Bankeingänge`,
  ].join(" · ");
  const kopf = [
    zustaendig ? `ZUSTÄNDIG: ${zustaendig.kundenName || zustaendig.name || "niemand eingetragen"} (${zustaendig.rolle === "inkasso" ? "Forderungsmanagement" : zustaendig.rolle === "onboarding" ? "Onboarding" : "Betreuung"}) — so nennst du ihn dem Kunden.` : null,
    person?.gc_mandate_status ? `SEPA-Mandat: ${person.gc_mandate_status}.` : null,
    person?.is_blocked ? "Anrufe gesperrt." : null,
    person?.werbung_gesperrt_am ? "WERBESPERRE aktiv." : null,
    `ZAHLEN: ${zahlen}.`,
  ].filter(Boolean).join("\n");

  // Kappen nach Zeichen, neueste bleiben; was vorne wegfällt, wird ein Satz.
  const zeilen = E.map((e) => `${berlin(e.am)} · ${e.text}`);
  let text = zeilen.join("\n");
  let weggelassen = 0;
  while (text.length > maxZeichen && zeilen.length > 10) { zeilen.shift(); weggelassen++; text = zeilen.join("\n"); }
  const hinweis = weggelassen ? `(${weggelassen} ältere Ereignisse ausgelassen — der Weg beginnt ${E.length ? berlin(E[0].am).slice(0, 8) : ""}; die ersten: ${E.slice(0, 3).map((e) => kurz(e.text, 60)).join(" / ")})\n` : "";
  return { ereignisse: E, text: `${kopf}\n${hinweis}${text}`, zusammenfassung: zahlen, zustaendig };
}
