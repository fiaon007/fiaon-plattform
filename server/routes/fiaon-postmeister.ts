// ═══════════════════════════════════════════════════════════════════════════
// DER POSTMEISTER — der E-Mail-Agent des Hauses (01.09.2026, Justins Auftrag)
//
// DER BEFUND: Hunderte bis tausende Mails in den fiaon.com-Postfächern,
// niemand antwortet. Beispiel: Kundenanfrage vom 27.08. (Kartenwunsch),
// unbeantwortet in js@.
//
// WAS ER TUT — alle 5 Minuten je Postfach:
//   1. LESEN: neue Posteingangs-Mails über die Gmail-API (Dienstkonto mit
//      Domain-Delegation, lib/fiaon-gmail.ts).
//   2. VERSTEHEN: KI-Einordnung (Kategorie, Dringlichkeit, Sprache) MIT dem
//      Wissen des Hauses (fiaon-wissen) und — das kann kein fremdes Tool —
//      der KUNDENAKTE: Absenderadresse → fiaon_persons → Zahlungsstand,
//      Referenz, Termin, Betreuer.
//   3. ORDNEN: Gmail-Labels (FIAON/…), Vermerk im Kundenverlauf, TODO für
//      Dringendes/Beschwerden.
//   4. HANDELN — Stufenmodell je Postfach (Justins Freigabe vom 01.09.):
//        support@  → auto      (FAQ, Status, Empfangsbestätigung)
//        welcome@  → auto      (Onboarding, Erstschritte)
//        info@     → hybrid    (Standard auto, komplexer Vertrieb = Entwurf)
//        js@       → entwurf   (alles nur als Entwurf im Postfach)
//      Kündigung, Beschwerde und Rechtliches antworten NIE automatisch —
//      Entwurf + TODO, egal welches Postfach.
//
// SICHERUNGEN GEGEN DIE KLASSISCHEN AUTO-RESPONDER-UNFÄLLE:
//   · nie an no-reply/mailer-daemon/Listen (Auto-Submitted, List-Unsubscribe)
//   · nie an fiaon.com-Absender (interne Post)
//   · höchstens EINE Auto-Antwort je Unterhaltung in 24 h
//   · Wortverbote (u. a. „Affiliate", Garantie-Versprechen) → wird eines
//     verletzt, wird aus der Auto-Antwort ein Entwurf
//   · Deckel je Lauf (15 Mails je Postfach) — kein Amoklauf bei Mail-Sturm
//   · jede Aktion protokolliert (fiaon_postmeister) und in der Akte sichtbar
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { tageslauf } from "../lib/fiaon-crons";
import {
  gmailBereit, postfachProbe, nachrichtenSuchen, nachrichtLesen,
  labelSicherstellen, nachrichtLabeln, antwortSenden, entwurfAnlegen, entwurfLoeschen,
  type GmailNachricht,
} from "../lib/fiaon-gmail";
import { rueckrufAufnehmen } from "../lib/fiaon-rueckruf";
import { wissenText } from "@shared/fiaon-wissen";
import { BANK } from "@shared/fiaon-bank";
import { getSettings, setSetting } from "./fiaon-agent";

const router = Router();

// ── DIE INHABER-WAND (Abnahme-Fund 02.09.) ─────────────────────────────────
// Die Zentrale ist im Chefbüro auf Stufe „inhaber" registriert — der Server
// muss das erzwingen, sonst öffnet die Adresszeile jede Tür. Durch kommt,
// wer den Admin-Code trägt (Justins gewohnter Weg) ODER als Chef der Stufe
// inhaber angemeldet ist.
router.use("/admin/postmeister", async (req: Request, res: Response, next) => {
  try {
    const { hasAdminCode } = await import("./fiaon-admin-zugang");
    if (hasAdminCode(req)) return next();
    const { readChef } = await import("./fiaon-chef-zugang");
    const chef = readChef(req);
    if (chef?.stufe === "inhaber") return next();
    return res.status(403).json({ ok: false, error: "Die Postmeister-Zentrale ist dem Inhaber vorbehalten." });
  } catch (e) {
    console.error("[POSTMEISTER] Inhaber-Wand:", e);
    return res.status(500).json({ ok: false, error: "Zugangsprüfung fehlgeschlagen" });
  }
});

type Modus = "auto" | "hybrid" | "entwurf";
/** Justins Freigaben vom 01.09.2026 — wörtlich. Änderungen nur mit ihm. */
const POSTFAECHER: { adresse: string; modus: Modus; gruss: string }[] = [
  { adresse: "support@fiaon.com", modus: "auto", gruss: "Freundliche Grüße\nIhr FIAON-Support\nsupport@fiaon.com · fiaon.com" },
  { adresse: "welcome@fiaon.com", modus: "auto", gruss: "Freundliche Grüße\nIhr FIAON Welcome-Team\nwelcome@fiaon.com · fiaon.com" },
  { adresse: "info@fiaon.com", modus: "hybrid", gruss: "Freundliche Grüße\nIhr FIAON-Team\ninfo@fiaon.com · fiaon.com" },
  { adresse: "js@fiaon.com", modus: "entwurf", gruss: "Freundliche Grüße\nJustin Schwarzott\nFIAON — Das Betriebssystem für Bonität" },
];

const KATEGORIEN = [
  "zahlung", "zugang_login", "termin", "unterlagen", "status_frage",
  "neuinteresse", "vertrieb_komplex", "kuendigung", "beschwerde", "rechtlich",
  "abmeldung", "werbung_newsletter", "intern", "sonstiges",
] as const;
/** Diese Kategorien dürfen — je nach Postfach-Modus — automatisch antworten. */
const AUTO_SICHER = new Set(["zahlung", "zugang_login", "termin", "unterlagen", "status_frage", "neuinteresse"]);
/** Diese antworten NIE automatisch, egal welches Postfach. */
const NIE_AUTO = new Set(["kuendigung", "beschwerde", "rechtlich", "intern", "sonstiges", "vertrieb_komplex"]);
/** Wortverbote in ausgehenden Texten — Verstoß macht aus Auto einen Entwurf. */
const WORTVERBOTE = ["affiliate", "garantiert gelöscht", "garantierte löschung", "score-garantie", "kredit vermitteln", "kreditvermittlung"];

const LAUF_DECKEL = 15;       // Mails je Postfach je 5-Minuten-Takt
const AUFHOL_DECKEL = 60;     // Mails je Aufhol-Aufruf

let tabelleBereit: Promise<void> | null = null;
function ensureTabelle(): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_postmeister (
          id SERIAL PRIMARY KEY,
          postfach TEXT NOT NULL,
          gmail_id TEXT NOT NULL UNIQUE,
          thread_id TEXT NOT NULL,
          von TEXT, betreff TEXT, empfangen_am TIMESTAMPTZ,
          kategorie TEXT, dringend BOOLEAN NOT NULL DEFAULT FALSE, sprache TEXT,
          person_id INTEGER, ref TEXT,
          aktion TEXT NOT NULL DEFAULT 'in_arbeit',
          begruendung TEXT,
          antwort TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_postmeister ADD COLUMN IF NOT EXISTS antwort_draft_id TEXT`;
      await sqlPool`ALTER TABLE fiaon_postmeister ADD COLUMN IF NOT EXISTS gesendet_am TIMESTAMPTZ`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_postmeister_lauf_idx ON fiaon_postmeister (postfach, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_postmeister_thread_idx ON fiaon_postmeister (thread_id, created_at DESC)`;
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── DAS DOSSIER — Justins Auftrag: „BEVOR der Agent arbeitet, kennt er den
// Kunden IN- und AUSWENDIG, wirklich JEDES Detail, JEDEN Verlauf, ALLES."
// Bestellungen, Ratenkette, die letzten Gespräche und Notizen, jede
// versendete Mail, Termine, Unterlagenstand — als lesbarer Text für die KI.
async function kundenDossier(kunde: any): Promise<string> {
  if (!kunde?.person_id && !kunde?.ref) return "";
  const pid = kunde.person_id ?? -1;
  try {
    const [bestellungen, raten, verlauf, mails, termine] = await Promise.all([
      sqlPool`
        SELECT payment_reference, SPLIT_PART(pack_name, E'\n', 1) AS paket, amount_due,
               payment_status, created_at::date AS am, kyc_status
        FROM fiaon_applications
        WHERE person_id = ${pid} AND merged_into IS NULL AND archived_at IS NULL
        ORDER BY created_at DESC LIMIT 6`,
      sqlPool`
        SELECT r.rate_nr, r.betrag_cents, r.status, r.faellig_am::date AS faellig, r.bezahlt_am::date AS bezahlt, r.mahnstufe
        FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${pid} AND r.storniert_am IS NULL
        ORDER BY r.faellig_am DESC LIMIT 8`,
      sqlPool`
        SELECT c.created_at::date AS am, c.type, c.outcome, c.agent_name, LEFT(COALESCE(c.note, ''), 220) AS note
        FROM fiaon_contact_log c JOIN fiaon_applications a ON a.ref = c.ref
        WHERE a.person_id = ${pid} AND c.voided_at IS NULL
        ORDER BY c.created_at DESC LIMIT 15`,
      sqlPool`
        SELECT m.created_at::date AS am, m.event, m.status
        FROM fiaon_mail_log m
        WHERE m.person_id = ${pid} OR m.empfaenger IN (
          SELECT LOWER(TRIM(primary_email)) FROM fiaon_persons WHERE id = ${pid})
        ORDER BY m.created_at DESC LIMIT 10`,
      sqlPool`
        SELECT beginn, status, quelle FROM fiaon_termine
        WHERE person_id = ${pid} ORDER BY beginn DESC LIMIT 5`,
    ]);
    const t = (d: any) => d ? new Date(d).toLocaleDateString("de-DE") : "?";
    const teile: string[] = [];
    if ((bestellungen as any[]).length) {
      teile.push("BESTELLUNGEN:\n" + (bestellungen as any[]).map((b) =>
        `- ${b.paket || "?"} (${b.amount_due ?? "?"} €, ${b.payment_status}, Referenz ${b.payment_reference}, vom ${t(b.am)}${b.kyc_status ? `, Unterlagen: ${b.kyc_status}` : ""})`).join("\n"));
    }
    if ((raten as any[]).length) {
      teile.push("RATEN (neueste zuerst):\n" + (raten as any[]).map((r) =>
        `- Rate ${r.rate_nr}: ${(Number(r.betrag_cents) / 100).toFixed(2)} €, ${r.status}${r.bezahlt ? ` (bezahlt ${t(r.bezahlt)})` : ` (fällig ${t(r.faellig)}${Number(r.mahnstufe) > 0 ? `, Mahnstufe ${r.mahnstufe}` : ""})`}`).join("\n"));
    }
    if ((verlauf as any[]).length) {
      teile.push("GESPRÄCHSVERLAUF (neueste zuerst):\n" + (verlauf as any[]).map((v) =>
        `- ${t(v.am)} ${v.agent_name || "System"}: ${v.outcome || v.type}${v.note ? ` — ${v.note}` : ""}`).join("\n"));
    }
    if ((mails as any[]).length) {
      teile.push("VERSENDETE MAILS AN DEN KUNDEN:\n" + (mails as any[]).map((m) =>
        `- ${t(m.am)} ${m.event} (${m.status})`).join("\n"));
    }
    if ((termine as any[]).length) {
      teile.push("TERMINE:\n" + (termine as any[]).map((x) =>
        `- ${new Date(x.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} (${x.quelle}, ${x.status})`).join("\n"));
    }
    return teile.join("\n\n").slice(0, 4500);
  } catch (e) {
    console.error("[POSTMEISTER] Dossier:", String(e).slice(0, 160));
    return "";
  }
}

// ── Die Kundenakte zur Absenderadresse ──────────────────────────────────────
async function kundeZurAdresse(adresse: string): Promise<any | null> {
  if (!adresse || !adresse.includes("@")) return null;
  const rows = (await sqlPool`
    SELECT p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name) AS name,
           a.ref, a.payment_reference, a.payment_status, a.amount_due,
           SPLIT_PART(a.pack_name, E'\n', 1) AS paket,
           ag.name AS betreuer,
           (SELECT MIN(t.beginn) FROM fiaon_termine t
             WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW()) AS naechster_termin,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
               AND r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS raten_ueberfaellig
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    LEFT JOIN LATERAL (
      SELECT * FROM fiaon_applications a2
      WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
      ORDER BY (a2.payment_status = 'paid') DESC, a2.created_at DESC LIMIT 1
    ) a ON TRUE
    WHERE LOWER(TRIM(COALESCE(p.primary_email, ''))) = ${adresse}
      AND p.merged_into_person_id IS NULL
    LIMIT 1
  `) as any[];
  if (rows.length) return rows[0];
  const app = (await sqlPool`
    SELECT a.person_id, a.ref, a.payment_reference, a.payment_status, a.amount_due,
           SPLIT_PART(a.pack_name, E'\n', 1) AS paket,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.contact_name) AS name
    FROM fiaon_applications a
    WHERE LOWER(TRIM(COALESCE(a.email, ''))) = ${adresse} AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  return app[0] || null;
}

// ── Die KI-Einordnung samt Antwortvorschlag ─────────────────────────────────
async function einordnen(postfach: string, mail: GmailNachricht, kunde: any | null, altTage: number):
  Promise<{ kategorie: string; dringend: boolean; sprache: string; antwort: string | null; sicher: boolean; rueckrufWunsch: boolean; rueckrufAnliegen: string | null; begruendung: string }> {
  const key = process.env.OPENAI_API_KEY;
  const fallback = { kategorie: "sonstiges", dringend: false, sprache: "de", antwort: null, sicher: false, rueckrufWunsch: false, rueckrufAnliegen: null, begruendung: "KI nicht erreichbar" };
  if (!key) return fallback;
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const kopfzeile = kunde ? [
    `BEKANNTER KUNDE: ${kunde.name || "?"}${kunde.betreuer ? `, Betreuer ${kunde.betreuer}` : ""}`,
    kunde.payment_reference ? `Verwendungszweck für Überweisungen: ${kunde.payment_reference} (Empfänger ${BANK.empfaenger}, IBAN ${BANK.ibanDisplay}, BIC ${BANK.bic}, ${BANK.bank})` : null,
    Number(kunde.raten_ueberfaellig) > 0 ? `ACHTUNG: ${kunde.raten_ueberfaellig} Rate(n) überfällig` : null,
  ].filter(Boolean).join("\n") : "KEIN Kundendatensatz zur Absenderadresse gefunden.";
  const dossier = kunde ? await kundenDossier(kunde) : "";
  const akte = dossier ? `${kopfzeile}\n\n${dossier}` : kopfzeile;
  const system = `Du bist der E-Mail-Agent von FIAON („Postmeister") und bearbeitest das Postfach ${postfach}.
Ordne die Mail ein und formuliere — wenn möglich — eine versandfertige Antwort.

KATEGORIEN (genau eine): ${KATEGORIEN.join(", ")}.
- vertrieb_komplex = individuelle Vertriebs-/Preisverhandlung, Geschäftskunden-Sonderwünsche, Presse/Partner.
- abmeldung = der Absender will KEINE weiteren E-Mails/Erinnerungen/Angebote von uns („Stopp", „keine Mails mehr", „abmelden", „hören Sie auf") — OHNE ein laufendes Abo zu kündigen (sonst kuendigung).
- werbung_newsletter = Werbung, Newsletter, Kaltakquise an uns.
- intern = Absender aus dem eigenen Haus oder Dienstleister-Systemmail.

REGELN FÜR DIE ANTWORT (Feld "antwort"):
- Deutsch (oder Sprache der Mail), Sie-Form, warm und klar, 3–8 Sätze, KEIN Markdown, keine Betreffzeile, keine Grußformel am Ende (wird angehängt).
- SCHREIBE WIE EIN MENSCH, der die Akte wirklich gelesen hat: Geh zuerst auf DAS ein, was der Kunde geschrieben hat, beziehe dich konkret auf seine Lage aus dem Dossier (sein Paket, sein letztes Gespräch, seinen Termin, seine Zahlung) statt allgemein zu bleiben. Wechsle Satzlängen ab. Beginne mit einer Anrede mit Namen, wenn er bekannt ist („Guten Tag Frau/Herr …" oder bei unklarem Geschlecht „Guten Tag Vorname Nachname").
- STRENG VERBOTENE Floskeln und KI-Muster: „gerne helfen wir Ihnen weiter", „zögern Sie nicht", „vielen Dank für Ihre Nachricht" als Einstieg, „wir hoffen, Ihnen damit geholfen zu haben", „als KI", „ich bin ein…", Aufzählungszeichen, Emojis, drei Ausrufezeichen, übertriebene Begeisterung. Keine zwei Sätze hintereinander mit demselben Satzanfang.
- Wenn im Verlauf steht, dass der Kunde etwas schon einmal gefragt oder gemeldet hat, erwähne das („wie Sie mit Herrn/Frau … besprochen hatten").
- Nur Fakten aus dem WISSEN und der KUNDENAKTE unten. Keine Preise erfinden, keine Fristen zusagen, keine Rechtsberatung, NIEMALS Löschung oder Karte GARANTIEREN (die Karte ist ein Ziel, die Bank entscheidet).
- Nützliche Wege: Kundenbereich https://fiaon.com/login · Termin buchen https://fiaon.com/termin · Kontakt https://fiaon.com/kontakt
- Bei Zahlungsfragen eines bekannten Kunden: seine Bankverbindung/Verwendungszweck aus der Akte nennen.
- ${altTage > 3 ? `Die Mail ist ${altTage} Tage alt — beginne mit einer ehrlichen, kurzen Entschuldigung für die späte Antwort.` : "Antworte ohne Entschuldigungsfloskel."}
- Wenn du die Frage NICHT sicher und vollständig beantworten kannst: "antwort" = null und "sicher" = false.

Antworte NUR als JSON:
{"kategorie":"…","dringend":true|false,"sprache":"de|en|…","antwort":"…"|null,"sicher":true|false,"rueckruf_wunsch":true|false,"rueckruf_anliegen":"das Anliegen in den Worten des Kunden"|null,"begruendung":"ein Satz, warum diese Einordnung"}
"rueckruf_wunsch" ist true, wenn der Kunde um einen ANRUF bittet, telefonisch besprochen werden will oder sein Anliegen am Telefon besser aufgehoben ist.

WISSEN ÜBER FIAON:
${wissenText().slice(0, 5000)}

KUNDENAKTE:
${akte}`;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modell, temperature: 0.2, max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `VON: ${mail.von}\nBETREFF: ${mail.betreff}\n\n${mail.text.slice(0, 6000) || mail.snippet}` },
        ],
      }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) { console.error("[POSTMEISTER] KI", r.status, j?.error?.message); return fallback; }
    const b = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}"));
    const kategorie = KATEGORIEN.includes(b?.kategorie) ? String(b.kategorie) : "sonstiges";
    return {
      kategorie,
      dringend: b?.dringend === true,
      sprache: String(b?.sprache || "de").slice(0, 8),
      antwort: typeof b?.antwort === "string" && b.antwort.trim().length > 20 ? String(b.antwort).slice(0, 4000) : null,
      sicher: b?.sicher === true,
      rueckrufWunsch: b?.rueckruf_wunsch === true,
      rueckrufAnliegen: typeof b?.rueckruf_anliegen === "string" ? String(b.rueckruf_anliegen).slice(0, 500) : null,
      begruendung: String(b?.begruendung || "").slice(0, 300),
    };
  } catch (e) {
    console.error("[POSTMEISTER] einordnen:", String(e).slice(0, 200));
    return fallback;
  }
}

// ── Verlaufs- und Aufgaben-Spur im Haus ─────────────────────────────────────
async function hausSpur(mail: GmailNachricht, kunde: any | null, kategorie: string,
  aktion: string, dringend: boolean, postfach: string): Promise<void> {
  const satz = `E-Mail an ${postfach} (${kategorie}): „${mail.betreff.slice(0, 90)}“ — Postmeister: ${
    aktion === "auto_beantwortet" ? "automatisch beantwortet"
    : aktion === "entwurf" ? "Antwortentwurf liegt im Postfach"
    : "eingeordnet"}`;
  if (kunde?.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'Postmeister', 'system', ${satz})
    `.catch(() => {});
  }
  if (dringend || NIE_AUTO.has(kategorie) && kategorie !== "intern" && kategorie !== "sonstiges") {
    await sqlPool`
      INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
      VALUES ('aufgabe', ${kunde?.ref ?? null},
              ${`Postmeister: ${kategorie === "beschwerde" ? "BESCHWERDE" : kategorie === "kuendigung" ? "KÜNDIGUNGSWUNSCH" : "Dringende Mail"} in ${postfach} von ${mail.von} — „${mail.betreff.slice(0, 120)}“. ${aktion === "entwurf" ? "Antwortentwurf liegt im Postfach, bitte prüfen und senden." : "Bitte übernehmen."}`},
              'betreiber', TRUE, ${dringend || kategorie === "beschwerde"}, 'offen', 'system', 'Postmeister',
              ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 1))
    `.catch((e) => console.error("[POSTMEISTER] Aufgabe:", e?.message));
  }
}

// ── Eine Mail durchziehen ───────────────────────────────────────────────────
async function mailVerarbeiten(postfachDef: typeof POSTFAECHER[number], gmailId: string,
  opts: { aufholen?: boolean; nurOrdnen?: boolean } = {}): Promise<string> {
  const postfach = postfachDef.adresse;
  // Anspruch sichern — läuft der Takt doppelt, verarbeitet nur einer.
  let anspruch = await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion)
    VALUES (${postfach}, ${gmailId}, '', 'in_arbeit')
    ON CONFLICT (gmail_id) DO NOTHING
    RETURNING id
  `;
  if (anspruch.length === 0) {
    // Abnahme-Fund 02.09.: Ein „Nur ordnen"-Lauf und KI-Ausfälle dürfen eine
    // Mail nicht ENDGÜLTIG verbrauchen — beide Zustände sind wieder
    // beanspruchbar, alles andere bleibt einmalig.
    anspruch = await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'in_arbeit', updated_at = NOW()
      WHERE gmail_id = ${gmailId} AND aktion IN ('vorgeordnet', 'fehler')
      RETURNING id
    `;
    if (anspruch.length === 0) return "schon_verarbeitet";
  }
  const fertig = async (felder: Record<string, unknown>) => {
    await sqlPool`
      UPDATE fiaon_postmeister SET
        thread_id = ${String(felder.thread_id ?? "")},
        von = ${felder.von as string ?? null}, betreff = ${felder.betreff as string ?? null},
        empfangen_am = ${felder.empfangen_am as Date ?? null},
        kategorie = ${felder.kategorie as string ?? null}, dringend = ${!!felder.dringend},
        sprache = ${felder.sprache as string ?? null},
        person_id = ${felder.person_id as number ?? null}, ref = ${felder.ref as string ?? null},
        aktion = ${String(felder.aktion)}, begruendung = ${felder.begruendung as string ?? null},
        antwort = ${felder.antwort as string ?? null}, updated_at = NOW()
      WHERE id = ${anspruch[0].id}
    `;
    return String(felder.aktion);
  };

  try {
    const mail = await nachrichtLesen(postfach, gmailId);
    const basis = { thread_id: mail.threadId, von: mail.von, betreff: mail.betreff, empfangen_am: mail.datum };

    // Eigene Post, Automaten, Listen: ordnen, nie beantworten.
    if (mail.vonAdresse.endsWith("@fiaon.com") || mail.autoHinweis) {
      await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/Geordnet")]);
      return fertig({ ...basis, kategorie: mail.vonAdresse.endsWith("@fiaon.com") ? "intern" : "werbung_newsletter", aktion: "geordnet", begruendung: "Automat/intern — keine Antwort" });
    }

    const kunde = await kundeZurAdresse(mail.vonAdresse);
    const altTage = Math.floor((Date.now() - mail.datum.getTime()) / 86_400_000);
    const urteil = await einordnen(postfach, mail, kunde, altTage);
    if (urteil.begruendung === "KI nicht erreichbar") {
      // Abnahme-Fund: Ohne Einordnung darf die Mail nicht still als „geordnet"
      // versickern — als Fehler ablegen, der nächste Lauf versucht es erneut.
      return fertig({ ...basis, aktion: "fehler", begruendung: "KI nicht erreichbar — nächster Takt versucht es erneut", person_id: kunde?.person_id, ref: kunde?.ref });
    }

    // Werbung: labeln, als gelesen markieren — bleibt im Eingang, stört nicht mehr.
    if (urteil.kategorie === "werbung_newsletter") {
      await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/Werbung")], ["UNREAD"]);
      return fertig({ ...basis, ...urteil, aktion: "geordnet", person_id: kunde?.person_id, ref: kunde?.ref });
    }

    // ── ABMELDUNG (Auftrag fiaon-c7, 02.09.): „Stopp" wird sofort wahr —
    // Werbesperre an der Person, kurze feste Bestätigung (kein KI-Text, damit
    // hier nichts Falsches steht), Label, Vermerk. Pflichtmails (Zahlung,
    // Termin) bleiben davon unberührt — die Frequenzbremse liest die Sperre.
    if (urteil.kategorie === "abmeldung" && !opts.nurOrdnen) {
      if (kunde?.person_id) {
        await sqlPool`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS werbung_gesperrt_am TIMESTAMPTZ`.catch(() => {});
        await sqlPool`
          UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW())
          WHERE id = ${Number(kunde.person_id)}
        `.catch((e) => console.error("[POSTMEISTER] Werbesperre:", String(e).slice(0, 120)));
      }
      const anrede = kunde?.name ? `Guten Tag ${kunde.name},` : "Guten Tag,";
      const text = `${anrede}

verstanden — wir haben Sie ab sofort aus unseren Erinnerungen und Angeboten herausgenommen. Sie bekommen von uns nur noch Nachrichten, die einen laufenden Vorgang betreffen (zum Beispiel eine Zahlungsbestätigung oder einen vereinbarten Termin).

Sollten Sie es sich später anders überlegen, genügt eine kurze Antwort auf diese E-Mail.

${postfachDef.gruss}`;
      let aktionAbmeldung = "geordnet";
      if (postfachDef.modus === "auto" || postfachDef.modus === "hybrid") {
        await antwortSenden(postfach, mail, text);
        await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/abmeldung"), await labelSicherstellen(postfach, "FIAON/Auto-beantwortet")], ["UNREAD"]);
        aktionAbmeldung = "auto_beantwortet";
      } else {
        const draftId = await entwurfAnlegen(postfach, mail, text);
        await sqlPool`UPDATE fiaon_postmeister SET antwort_draft_id = ${draftId || null} WHERE id = ${anspruch[0].id}`.catch(() => {});
        await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/abmeldung"), await labelSicherstellen(postfach, "FIAON/Entwurf-wartet")]);
        aktionAbmeldung = "entwurf";
      }
      if (kunde?.ref) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'Postmeister', 'system',
                  ${`Kunde bittet um Stopp der E-Mails (${postfach}) — Werbesperre gesetzt, ${aktionAbmeldung === "auto_beantwortet" ? "Bestätigung gesendet" : "Bestätigungsentwurf liegt vor"}.`})
        `.catch(() => {});
      }
      return fertig({ ...basis, ...urteil, aktion: aktionAbmeldung, antwort: text, person_id: kunde?.person_id, ref: kunde?.ref, begruendung: "Abmeldewunsch — Werbesperre gesetzt" });
    }

    // Kategorie-Label immer.
    await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, `FIAON/${urteil.kategorie}`)]);

    // ── DER AKTIVE AGENT (Justin, 01.09.): Bittet der Kunde um einen Anruf,
    // plant der Postmeister den Rückruf gleich beim BETREUER ein — über den
    // bestehenden Rückruf-Weg (24-h-Frist, idempotent je Mail). ──
    if (urteil.rueckrufWunsch && kunde?.person_id && !opts.nurOrdnen) {
      try {
        const r = await rueckrufAufnehmen({
          personId: Number(kunde.person_id), ref: kunde.ref ?? null,
          quelle: "mail_inbound", quelleId: `postmeister-${gmailId}`,
          anliegen: urteil.rueckrufAnliegen || `E-Mail an ${postfach}: „${mail.betreff.slice(0, 140)}“`,
          kontakt: mail.vonAdresse,
        });
        if (r.neu) console.log(`[POSTMEISTER] Rückruf eingeplant (Person ${kunde.person_id}, zuständig ${r.zustaendig ?? "Leitung"})`);
      } catch (e) {
        console.error("[POSTMEISTER] Rückruf:", String(e).slice(0, 160));
      }
    }

    // Höchstens eine Auto-Antwort je Unterhaltung in 24 h.
    const [schon] = (await sqlPool`
      SELECT id FROM fiaon_postmeister
      WHERE thread_id = ${mail.threadId} AND aktion IN ('auto_beantwortet', 'entwurf')
        AND created_at > NOW() - INTERVAL '24 hours' AND gmail_id <> ${gmailId}
      LIMIT 1
    `) as any[];

    let darfAuto = !opts.nurOrdnen && !schon
      && AUTO_SICHER.has(urteil.kategorie) && !NIE_AUTO.has(urteil.kategorie)
      && urteil.sicher && !!urteil.antwort
      && (postfachDef.modus === "auto"
          || (postfachDef.modus === "hybrid" && urteil.kategorie !== "neuinteresse"));
    // Wortverbote: Verstoß macht aus der Auto-Antwort einen Entwurf.
    const klein = (urteil.antwort || "").toLowerCase();
    if (darfAuto && WORTVERBOTE.some((w) => klein.includes(w))) darfAuto = false;
    // Kontowechsel 02.09.2026: Wer schreibt, er habe schon aufs alte (gesperrte)
    // Wise-Konto überwiesen, braucht einen Menschen — kein Automat darf hier
    // „Ihre Zahlungsdaten lauten…" antworten. Solche Mails werden Entwurf +
    // dringende Aufgabe.
    const eingang = `${mail.betreff} ${mail.text || mail.snippet || ""}`.toLowerCase();
    const kontowechselFall = /\bwise\b|be09|altes konto|alte konto|alten konto|alte iban|gesperrt|bereits überwiesen|schon überwiesen|falsche(s|n)? konto|neue bankverbindung|bankverbindung ge(ä|ae)ndert/.test(eingang);
    if (kontowechselFall) { darfAuto = false; urteil.dringend = true; }

    const antwortText = urteil.antwort ? `${urteil.antwort.trim()}\n\n${postfachDef.gruss}` : null;

    if (darfAuto && antwortText) {
      await antwortSenden(postfach, mail, antwortText);
      await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/Auto-beantwortet")], ["UNREAD"]);
      await hausSpur(mail, kunde, urteil.kategorie, "auto_beantwortet", urteil.dringend, postfach);
      console.log(`[POSTMEISTER] ${postfach}: auto beantwortet (${urteil.kategorie}) — ${mail.betreff.slice(0, 60)}`);
      return fertig({ ...basis, ...urteil, aktion: "auto_beantwortet", antwort: antwortText, person_id: kunde?.person_id, ref: kunde?.ref });
    }

    if (!opts.nurOrdnen && antwortText && !schon) {
      const draftId = await entwurfAnlegen(postfach, mail, antwortText);
      await sqlPool`UPDATE fiaon_postmeister SET antwort_draft_id = ${draftId || null} WHERE id = ${anspruch[0].id}`.catch(() => {});
      await nachrichtLabeln(postfach, gmailId, [await labelSicherstellen(postfach, "FIAON/Entwurf-wartet")]);
      await hausSpur(mail, kunde, urteil.kategorie, "entwurf", urteil.dringend, postfach);
      return fertig({ ...basis, ...urteil, aktion: "entwurf", antwort: antwortText, person_id: kunde?.person_id, ref: kunde?.ref });
    }

    const ablage = opts.nurOrdnen ? "vorgeordnet" : "geordnet";
    if (!opts.nurOrdnen) await hausSpur(mail, kunde, urteil.kategorie, "geordnet", urteil.dringend, postfach);
    return fertig({ ...basis, ...urteil, aktion: ablage, person_id: kunde?.person_id, ref: kunde?.ref, begruendung: schon ? "Unterhaltung in 24 h schon bedient" : urteil.begruendung });
  } catch (e: any) {
    console.error(`[POSTMEISTER] ${postfach}/${gmailId}:`, String(e?.message || e).slice(0, 300));
    return fertig({ thread_id: "", aktion: "fehler", begruendung: String(e?.message || e).slice(0, 300) });
  }
}

// ── Der Takt und der Aufhol-Lauf ────────────────────────────────────────────
let letzterLauf: { wann: string; verarbeitet: number; fehler: number } | null = null;

/**
 * Justins Eingriff (01.09.2026): Not-Aus und Modus je Postfach kommen aus den
 * Einstellungen und schlagen die Vorgaben oben — änderbar aus der Zentrale,
 * ohne Deploy. postmeister_an='aus' hält ALLES an (auch das Ordnen).
 */
async function wirksamerModus(pf: typeof POSTFAECHER[number]): Promise<Modus | "aus"> {
  try {
    const s = await getSettings();
    if (String(s.postmeister_an || "an") === "aus") return "aus";
    const wert = String(s[`postmeister_modus_${pf.adresse.split("@")[0]}`] || "");
    if (["auto", "hybrid", "entwurf", "aus"].includes(wert)) return wert as Modus | "aus";
  } catch { /* Vorgabe gilt */ }
  return pf.modus;
}

export async function postmeisterLauf(opts: { q?: string; deckel?: number; nurOrdnen?: boolean; postfach?: string } = {}):
  Promise<{ verarbeitet: number; aktionen: Record<string, number> }> {
  await ensureTabelle();
  const aktionen: Record<string, number> = {};
  let verarbeitet = 0;
  for (const pf of POSTFAECHER) {
    if (opts.postfach && pf.adresse !== opts.postfach) continue;
    const modus = await wirksamerModus(pf);
    if (modus === "aus") continue;
    const pfWirksam = { ...pf, modus };
    try {
      // ── SEITENWEISE LESEN (E-094): Gmail liefert höchstens 100 je Seite und
      // sortiert neueste zuerst. Ohne Blättern blieb bei mehr als 100 Treffern
      // im Fenster der Rest für immer unsichtbar — bei 1.254 Mails in support@
      // war das der ganze Altbestand.
      const alleIds: string[] = [];
      let seite: string | null | undefined = null;
      for (let s = 0; s < 12; s++) {
        const r: any = await nachrichtenSuchen(pf.adresse, opts.q || "in:inbox newer_than:2d", 100, seite);
        alleIds.push(...(r?.ids ?? []));
        seite = r?.nextPageToken ?? null;
        if (!seite || alleIds.length >= 1200) break;
      }
      if (!alleIds.length) continue;

      // Schon Abgeschlossenes aussieben — 'fehler' und 'vorgeordnet' bleiben
      // beanspruchbar, sonst verbraucht ein KI-Aussetzer die Mail für immer.
      const bekannte = new Set(((await sqlPool`
        SELECT gmail_id FROM fiaon_postmeister
         WHERE gmail_id = ANY(${alleIds}) AND aktion NOT IN ('fehler', 'vorgeordnet')
      `) as any[]).map((r) => String(r.gmail_id)));
      const neue = alleIds.filter((id) => !bekannte.has(id)).slice(0, opts.deckel ?? LAUF_DECKEL);

      // ── DER NEUE LAUF (E-094): ganze Gespräche, Werkzeuge, Belegpflicht,
      // Antwort immer erst als Entwurf. Der alte Weg bleibt als Rückfall, bis
      // der neue eine Woche ohne Beanstandung gelaufen ist.
      const { mailBearbeiten } = await import("../lib/fiaon-postmeister-lauf");
      const [v2] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'postmeister_v2' LIMIT 1`) as any[];
      const neuerWeg = String(v2?.value ?? "1") !== "0";
      for (const id of neue) {
        const a = neuerWeg
          ? (await mailBearbeiten({ postfach: pf.adresse, gmailId: id, gruss: pf.gruss, modus: modus as any, nurOrdnen: opts.nurOrdnen })).aktion
          : await mailVerarbeiten(pfWirksam, id, { nurOrdnen: opts.nurOrdnen });
        aktionen[a] = (aktionen[a] || 0) + 1;
        verarbeitet += 1;
      }
    } catch (e: any) {
      console.error(`[POSTMEISTER] Lauf ${pf.adresse}:`, String(e?.message || e).slice(0, 300));
      aktionen.fehler = (aktionen.fehler || 0) + 1;
    }
  }
  letzterLauf = { wann: new Date().toISOString(), verarbeitet, fehler: aktionen.fehler || 0 };
  if (verarbeitet > 0) console.log(`[POSTMEISTER] Lauf: ${verarbeitet} Mails — ${JSON.stringify(aktionen)}`);
  return { verarbeitet, aktionen };
}

// ── Verwaltungs-Endpunkte (hinter dem Admin-Tor) ────────────────────────────

router.get("/admin/postmeister/status", async (_req: Request, res: Response) => {
  const stand: any = { bereit: gmailBereit(), letzter_lauf: letzterLauf, postfaecher: [] };
  for (const pf of POSTFAECHER) {
    const probe = gmailBereit() ? await postfachProbe(pf.adresse) : { ok: false, fehler: "GOOGLE_SA_KEY fehlt" };
    stand.postfaecher.push({ adresse: pf.adresse, modus: pf.modus, ...probe });
  }
  try {
    await ensureTabelle();
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS gesamt,
             COUNT(*) FILTER (WHERE aktion = 'auto_beantwortet')::int AS auto,
             COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS entwuerfe,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS heute
      FROM fiaon_postmeister
    `) as any[];
    stand.zahlen = z;
  } catch { /* Tabelle entsteht beim ersten Lauf */ }
  res.json({ ok: true, ...stand });
});

/** Ein Takt von Hand — z. B. zum Testen nach dem Deploy. */
router.post("/admin/postmeister/lauf", async (req: Request, res: Response) => {
  try {
    const erg = await postmeisterLauf({
      deckel: Math.min(30, Math.max(1, Number(req.body?.deckel) || LAUF_DECKEL)),
      nurOrdnen: req.body?.nurOrdnen === true,
      postfach: typeof req.body?.postfach === "string" ? req.body.postfach : undefined,
    });
    res.json({ ok: true, ...erg });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/**
 * Der Aufhol-Lauf für den Berg: ältere Posteingangs-Mails in Häppchen.
 * `nurOrdnen: true` = klassifizieren und labeln ohne jede Antwort — für die
 * Zahlen-Vorschau, bevor die Antwort-Welle startet.
 */
router.post("/admin/postmeister/aufholen", async (req: Request, res: Response) => {
  try {
    const tage = Math.min(365, Math.max(3, Number(req.body?.tage) || 30));
    const erg = await postmeisterLauf({
      q: `in:inbox older_than:2d newer_than:${tage}d`,
      deckel: Math.min(AUFHOL_DECKEL, Math.max(1, Number(req.body?.deckel) || AUFHOL_DECKEL)),
      nurOrdnen: req.body?.nurOrdnen === true,
      postfach: typeof req.body?.postfach === "string" ? req.body.postfach : undefined,
    });
    res.json({ ok: true, ...erg });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDELN AUS DER ZENTRALE (Justin, 01.09.: „von dort einfach ALLES machen
// können — etwas wegschicken, Nachrichten ändern, mit 1 Klick alle beantworten")
// ═══════════════════════════════════════════════════════════════════════════

/** Entwurf atomar beanspruchen — genau EIN Aufrufer gewinnt (Doppelklick-Schutz). */
async function entwurfBeanspruchen(id: number): Promise<any | null> {
  const [zeile] = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'sendet', updated_at = NOW()
    WHERE id = ${id} AND aktion = 'entwurf' AND gesendet_am IS NULL
    RETURNING *
  `) as any[];
  return zeile || null;
}

/** Einen gespeicherten Entwurf wirklich versenden — mit (ggf. geändertem) Text. */
async function entwurfVersenden(zeile: any, text: string): Promise<void> {
  const mail = await nachrichtLesen(zeile.postfach, zeile.gmail_id);
  await antwortSenden(zeile.postfach, mail, text);
  if (zeile.antwort_draft_id) {
    await entwurfLoeschen(zeile.postfach, zeile.antwort_draft_id).catch(() => {});
  }
  await nachrichtLabeln(zeile.postfach, zeile.gmail_id,
    [await labelSicherstellen(zeile.postfach, "FIAON/Auto-beantwortet")],
    [await labelSicherstellen(zeile.postfach, "FIAON/Entwurf-wartet"), "UNREAD"]).catch(() => {});
  await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'gesendet', antwort = ${text},
           gesendet_am = NOW(), updated_at = NOW()
    WHERE id = ${zeile.id}
  `;
  if (zeile.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${zeile.ref}, ${zeile.person_id ?? null}, NULL, 'Postmeister', 'system',
              ${`Antwortentwurf aus der Zentrale freigegeben und gesendet (${zeile.postfach}): „${String(zeile.betreff || "").slice(0, 90)}“`})
    `.catch(() => {});
  }
}

/** Die wartenden Entwürfe — mit vollem Wortlaut zum Ändern. */
router.get("/admin/postmeister/entwuerfe", async (_req: Request, res: Response) => {
  try {
    await ensureTabelle();
    const zeilen = (await sqlPool`
      SELECT id, postfach, von, betreff, kategorie, dringend, ref, antwort, empfangen_am, created_at
      FROM fiaon_postmeister
      WHERE aktion = 'entwurf' AND gesendet_am IS NULL AND antwort IS NOT NULL
      ORDER BY dringend DESC, created_at DESC LIMIT 60
    `) as any[];
    res.json({ ok: true, entwuerfe: zeilen });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Einen Entwurf senden — der Text aus der Zentrale gewinnt (ändern erlaubt). */
router.post("/admin/postmeister/entwurf/:id/senden", async (req: Request, res: Response) => {
  try {
    const zeile = await entwurfBeanspruchen(Number(req.params.id));
    if (!zeile) return res.status(404).json({ ok: false, error: "Entwurf nicht gefunden oder schon erledigt" });
    const text = String(req.body?.text || zeile.antwort || "").trim();
    if (text.length < 20) {
      await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${zeile.id}`;
      return res.status(400).json({ ok: false, error: "Der Text ist zu kurz zum Senden." });
    }
    try {
      await entwurfVersenden(zeile, text);
    } catch (e) {
      await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${zeile.id} AND aktion = 'sendet'`.catch(() => {});
      throw e;
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** Einen Entwurf verwerfen — auch der Gmail-Entwurf verschwindet. */
router.post("/admin/postmeister/entwurf/:id/verwerfen", async (req: Request, res: Response) => {
  try {
    const [zeile] = (await sqlPool`
      SELECT * FROM fiaon_postmeister
      WHERE id = ${Number(req.params.id)} AND aktion = 'entwurf' AND gesendet_am IS NULL
    `) as any[];
    if (!zeile) return res.status(404).json({ ok: false, error: "Entwurf nicht gefunden" });
    if (zeile.antwort_draft_id) await entwurfLoeschen(zeile.postfach, zeile.antwort_draft_id).catch(() => {});
    await nachrichtLabeln(zeile.postfach, zeile.gmail_id, [],
      [await labelSicherstellen(zeile.postfach, "FIAON/Entwurf-wartet")]).catch(() => {});
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'verworfen', updated_at = NOW() WHERE id = ${zeile.id}`;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** Der 1-Klick: ALLE wartenden Entwürfe senden (mit Deckel je Aufruf). */
router.post("/admin/postmeister/entwuerfe/alle-senden", async (req: Request, res: Response) => {
  try {
    await ensureTabelle();
    const deckel = Math.min(60, Math.max(1, Number(req.body?.deckel) || 40));
    const kandidaten = (await sqlPool`
      SELECT id FROM fiaon_postmeister
      WHERE aktion = 'entwurf' AND gesendet_am IS NULL AND antwort IS NOT NULL
      ORDER BY created_at ASC LIMIT ${deckel}
    `) as any[];
    let gesendet = 0; let fehler = 0;
    for (const k of kandidaten) {
      const zeile = await entwurfBeanspruchen(Number(k.id));
      if (!zeile) continue;
      try { await entwurfVersenden(zeile, String(zeile.antwort)); gesendet += 1; }
      catch (e) {
        fehler += 1;
        await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${zeile.id} AND aktion = 'sendet'`.catch(() => {});
        console.error("[POSTMEISTER] alle-senden:", String(e).slice(0, 160));
      }
    }
    const [rest] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_postmeister
      WHERE aktion = 'entwurf' AND gesendet_am IS NULL AND antwort IS NOT NULL
    `) as any[];
    res.json({ ok: true, gesendet, fehler, uebrig: Number(rest?.n || 0) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Eingreifen aus der Zentrale: Not-Aus und Modus je Postfach. */
const ERLAUBTE_SCHLUESSEL = new Set([
  "postmeister_an",
  ...POSTFAECHER.map((p) => `postmeister_modus_${p.adresse.split("@")[0]}`),
]);
router.post("/admin/postmeister/einstellung", async (req: Request, res: Response) => {
  try {
    const schluessel = String(req.body?.schluessel || "");
    const wert = String(req.body?.wert || "");
    if (!ERLAUBTE_SCHLUESSEL.has(schluessel)) return res.status(400).json({ ok: false, error: "Unbekannter Schalter" });
    if (!["an", "aus", "auto", "hybrid", "entwurf"].includes(wert)) return res.status(400).json({ ok: false, error: "Unbekannter Wert" });
    await setSetting(schluessel, wert);
    res.json({ ok: true, schluessel, wert });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Die Lage für die Zentrale: Zahlen + die letzten Handgriffe als Strom. */
router.get("/admin/postmeister/lage", async (_req: Request, res: Response) => {
  try {
    await ensureTabelle();
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS gesamt,
             COUNT(*) FILTER (WHERE aktion = 'auto_beantwortet')::int AS auto,
             COUNT(*) FILTER (WHERE aktion = 'entwurf' AND gesendet_am IS NULL)::int AS entwuerfe,
             COUNT(*) FILTER (WHERE aktion = 'gesendet' AND created_at > NOW() - INTERVAL '24 hours')::int AS von_hand,
             COUNT(*) FILTER (WHERE aktion = 'geordnet')::int AS geordnet,
             COUNT(*) FILTER (WHERE aktion = 'fehler')::int AS fehler,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS heute,
             COUNT(*) FILTER (WHERE aktion = 'auto_beantwortet' AND created_at > NOW() - INTERVAL '24 hours')::int AS heute_auto,
             COUNT(*) FILTER (WHERE person_id IS NOT NULL)::int AS mit_akte
      FROM fiaon_postmeister
    `) as any[];
    const kategorien = (await sqlPool`
      SELECT COALESCE(kategorie, 'unbekannt') AS kategorie, COUNT(*)::int AS n
      FROM fiaon_postmeister WHERE aktion <> 'in_arbeit'
      GROUP BY 1 ORDER BY n DESC LIMIT 12
    `) as any[];
    const strom = (await sqlPool`
      SELECT id, postfach, von, betreff, kategorie, dringend, aktion, ref, antwort, begruendung, created_at
      FROM fiaon_postmeister WHERE aktion <> 'in_arbeit'
      ORDER BY created_at DESC LIMIT 30
    `) as any[];
    const s = await getSettings().catch(() => ({} as Record<string, string>));
    res.json({
      ok: true, zahlen: z, kategorien, strom, letzterLauf,
      an: String((s as any).postmeister_an || "an") !== "aus",
      postfaecher: await Promise.all(POSTFAECHER.map(async (p) => ({
        adresse: p.adresse, vorgabe: p.modus, modus: await wirksamerModus(p),
      }))),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

// Alle 5 Minuten — nur im Betrieb (fiaon-crons entscheidet), und nur wenn der
// Schlüssel gesetzt ist. Beim Start nach 2 Minuten ein erster Lauf.
tageslauf("postmeister", async () => {
  if (!gmailBereit()) return;
  return await postmeisterLauf();
}, 5 * 60 * 1000, { beimStartNach: 120_000 });

export default router;
