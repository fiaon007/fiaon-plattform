// ═══════════════════════════════════════════════════════════════════════════
// FRISTENWÄCHTER — WER AUF EINE ANTWORT WARTET, WARTET NICHT ALLEIN
// (Scheibe 5, Modul C, 05.09.2026 — Bauvorlage 3.6 / 3.8)
//
// Ein Antrag, den der Kunde unterschrieben hat und den ein Mensch versendet
// hat, trägt eine Frist (fiaon_vorgaenge.frist_am — im Regelfall 21 Tage nach
// dem Versand). Ohne Wächter verstreicht diese Frist stumm: Niemand merkt,
// dass die Bank oder der Beitragsservice nicht geantwortet hat, und der Kunde
// sieht unter „Vorgänge“ wochenlang denselben Stand.
//
// Der Wächter läuft mehrmals täglich (Registrierung in routes.ts über
// tageslauf('fristenwaechter', …, 6 h)) und tut drei Dinge — mehr nicht:
//
//   1) Sieben Tage vor Ablauf: Auftrag an den zuständigen Mitarbeiter
//      („Frist läuft in 7 Tagen“) — Schlüssel `frist7:<vorgang>`.
//   2) Frist abgelaufen, keine Antwort: Vorgang auf „nachfrage“, Ereignis für
//      den Kunden („Ihre Ansprechperson hat den Auftrag, nachzufragen.“ — NICHT
//      „wir haben nachgefragt“, denn das hat noch niemand), Auftrag „Nachfassen“
//      mit fertigem Entwurf der Boten-Nachfrage (fiaon-schreiben.ts, Art
//      `nachfrage`, Wir-Form: FIAON erkundigt sich als Übermittler) — Schlüssel
//      `nachfass:<vorgang>`. Erst wenn der Mitarbeiter die Nachfrage versendet
//      und über POST /agent/app/vorgaenge/:id/nachgefasst quittiert, steht beim
//      Kunden „Wir haben am … nachgefragt.“
//   0) Aufräumen: Vorgänge, die seit mehr als einem Tag in „entwurf“ hängen
//      (Abbruch beim Anlegen, vor der Transaktion vom 05.09.2026), werden auf
//      „zurueckgezogen“ gesetzt, der Anspruch wird wieder „offen“.
//   3) Sieben Tage nach der Nachfrage immer noch nichts: Eskalation an die
//      Leitung (todoMeldung), eskaliert_am gesetzt — Schlüssel `eskalation:<vorgang>`.
//
// GRUNDSÄTZE
//   · Kein Automatik-Versand. Der Wächter schreibt Aufträge an Menschen; das
//     Nachfass-Schreiben verschickt ein Mitarbeiter und quittiert es.
//   · Idempotent je Tag und je Vorgang: Der Zustand (stand, erinnert_am,
//     eskaliert_am) und die Auftragsschlüssel verhindern jede Wiederholung —
//     auch bei vier Läufen am Tag. Ein Auftrag, den der Mitarbeiter schon
//     erledigt hat, wird NICHT wieder geöffnet (Schlüssel wird vorher geprüft,
//     denn auftragFuerKunden würde ihn sonst auf „offen“ zurückdrehen).
//   · Nichts löschen. Nur setzen, anhängen, melden.
//   · Berliner Datum ausschließlich über formatToParts (Zeit-Falle 01.09.2026).
//   · Ein Vorgang, der klemmt, hält die anderen nicht auf: Fehler werden je
//     Vorgang protokolliert, der Lauf geht weiter.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { pushBeiEreignis } from "./fiaon-push";
import { auftragFuerKunden, todoMeldung } from "../routes/fiaon-betreiber-todo";
import { berlinHeute, tag, ensureAppTabellen } from "../routes/fiaon-app";
import { schreibenErzeugen, type SchreibenDaten } from "./fiaon-schreiben";

/** So viele Tage vor Ablauf der Frist wird der Mitarbeiter erinnert. */
export const FRIST_VORLAUF_TAGE = 7;
/** So viele Tage nach der Nachfrage ohne Antwort geht es an die Leitung. */
export const ESKALATION_NACH_TAGEN = 7;

export interface FristenwaechterErgebnis { erinnert: number; nachgefragt: number; eskaliert: number; aufgeraeumt: number }

// ── Tabelle der Ereignisse ──────────────────────────────────────────────────
// Die Tabelle legt Modul B an (ensureAntraegeTabellen in fiaon-app-antraege.ts,
// gleiche DDL in db/migrations/081_app_vollmacht_vorgaenge.sql). Der Wächter
// ruft sie zuerst; steht der Router einmal nicht bereit, greift dieselbe DDL
// hier. CREATE … IF NOT EXISTS ist idempotent — wer zuerst kommt, legt an.
let ereignisseBereit: Promise<void> | null = null;
export function ensureEreignisTabelle(): Promise<void> {
  if (!ereignisseBereit) {
    ereignisseBereit = (async () => {
      await ensureAppTabellen();
      try {
        // Dynamisch, damit die Bibliothek nicht beim Laden am Router hängt.
        const { ensureAntraegeTabellen } = await import("../routes/fiaon-app-antraege");
        await ensureAntraegeTabellen();
      } catch (e: any) {
        console.error("[FRISTEN] ensureAntraegeTabellen:", e?.message || e);
      }
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_vorgang_ereignisse (
        id BIGSERIAL PRIMARY KEY, vorgang_id BIGINT NOT NULL, person_id BIGINT NOT NULL,
        art TEXT NOT NULL CHECK (art IN ('befund','entwurf','vollmacht','unterschrift_offen','unterschrieben','versandt','erinnert','nachfrage','antwort_da','bewilligt','abgelehnt','zurueckgezogen','eskaliert','notiz')),
        text TEXT, text_fuer_kunden TEXT, agent_id BIGINT, am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vorgang_ereignisse_vorgang_idx ON fiaon_vorgang_ereignisse (vorgang_id, am)`;
    })().catch((e) => { ereignisseBereit = null; throw e; });
  }
  return ereignisseBereit;
}

// ── Datum (Berlin) ──────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD des Berliner Tages plus n Tage (n darf negativ sein). */
function berlinIsoPlus(n: number): string {
  const h = berlinHeute();
  const d = new Date(Date.UTC(h.j, h.m - 1, h.t, 12));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Heutiges Berliner Datum als dd.mm.yyyy — für den Briefkopf des Nachfass-Entwurfs. */
function berlinHeuteText(): string {
  const h = berlinHeute();
  return `${pad2(h.t)}.${pad2(h.m)}.${h.j}`;
}

/** DATE-Spalte (String oder Date) → YYYY-MM-DD, sonst null. */
function isoVon(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const x = new Date(d as any);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
}

/** Ganze Tage von heute (Berlin) bis zu einem YYYY-MM-DD. */
function tageBis(iso: string): number {
  const heute = berlinIsoPlus(0);
  const a = Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, Number(heute.slice(8, 10)));
  const b = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((b - a) / 864e5);
}

// ── Der Mensch hinter dem Vorgang ───────────────────────────────────────────
interface Mensch {
  personId: number;
  ref: string | null;
  /** Anzeigename nach dem Muster personFuerRef(): Person, sonst Firma, sonst Antrag, sonst Referenz. */
  name: string;
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  geburtsdatum: string | null;
}

/**
 * Person plus jüngster Antrag — die Adresse kommt aus fiaon_persons, fehlt sie,
 * aus dem Antrag. Die Referenz ist der Anker für den Link in die Akte.
 */
async function menschLaden(personId: number): Promise<Mensch | null> {
  const [z] = (await sqlPool`
    SELECT p.id, p.first_name AS p_vor, p.last_name AS p_nach, p.company_name, p.street AS p_str, p.zip AS p_plz, p.city AS p_ort, p.birthdate AS p_geb,
           a.ref, a.first_name AS a_vor, a.last_name AS a_nach, a.street AS a_str, a.zip AS a_plz, a.city AS a_ort, a.birthdate AS a_geb
      FROM fiaon_persons p
      LEFT JOIN LATERAL (
        SELECT ref, first_name, last_name, street, zip, city, birthdate
          FROM fiaon_applications WHERE person_id = p.id AND merged_into IS NULL AND gdpr_deleted_at IS NULL
         ORDER BY created_at DESC NULLS LAST LIMIT 1
      ) a ON TRUE
     WHERE p.id = ${personId} LIMIT 1`) as any[];
  if (!z?.id) return null;
  const vorname = String(z.p_vor || z.a_vor || "").trim();
  const nachname = String(z.p_nach || z.a_nach || "").trim();
  const ref = z.ref ? String(z.ref) : null;
  const name = [vorname, nachname].filter(Boolean).join(" ").trim() || String(z.company_name || "").trim() || ref || `Person ${personId}`;
  return {
    personId, ref, name, vorname, nachname,
    strasse: String(z.p_str || z.a_str || "").trim(),
    plz: String(z.p_plz || z.a_plz || "").trim(),
    ort: String(z.p_ort || z.a_ort || "").trim(),
    // birthdate ist varchar: ISO wird zu dd.mm.yyyy, ein deutsches Datum bleibt, wie es steht (Modul A formt selbst um).
    geburtsdatum: tag(z.p_geb || z.a_geb) ?? (String(z.p_geb || z.a_geb || "").trim() || null),
  };
}

// ── Helfer ──────────────────────────────────────────────────────────────────
async function ereignis(vorgangId: number, personId: number, art: string, text: string | null, textFuerKunden: string | null): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_vorgang_ereignisse (vorgang_id, person_id, art, text, text_fuer_kunden, agent_id)
    VALUES (${vorgangId}, ${personId}, ${art}, ${text}, ${textFuerKunden}, NULL)`;
}

/** Steht der Auftrag schon (offen oder erledigt)? Dann nicht noch einmal — auch nicht wieder öffnen. */
async function auftragVorhanden(schluessel: string): Promise<boolean> {
  const [r] = (await sqlPool`SELECT 1 AS da FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel} LIMIT 1`.catch(() => [])) as any[];
  return !!r;
}

/** Einen Auftrag schließen, der durch den Zustandswechsel gegenstandslos wurde (kein Löschen — nur „erledigt“ mit Grund). */
async function auftragSchliessen(schluessel: string, ergebnis: string): Promise<void> {
  await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, ${ergebnis}), updated_at = NOW()
                 WHERE schluessel = ${schluessel} AND status <> 'erledigt'`.catch(() => {});
}

// 06.09.2026: Aufträge zeigen auf die Vorgangsseite des Teams — /admin ist für Mitarbeiter zu.
const vorgangLink = (id: number | string) => `/agent/app-vorgaenge/${id}`;
const azVon = (v: any) => String(v.aktenzeichen || `Vorgang #${v.id}`);

/** Aus dem HTML des Schreibens ein Klartext für die Aufgabe — der Mitarbeiter liest ihn im Portal. */
export function htmlZuText(html: string): string {
  return String(html || "")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "· ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Der Entwurf der Boten-Nachfrage aus Modul A (Art `nachfrage`, Wir-Form) als
 * Klartext — oder ein schlichter Ersatz in derselben Rolle, falls die Vorlage
 * nicht rendert. Der Auftrag darf daran nicht scheitern.
 *
 * Bewusst NICHT die Ich-Form-Erinnerung `nachfass`: Die wäre eine Erklärung des
 * Kunden und dürfte nur mit seiner Unterschrift hinausgehen (Vollmacht: „Inhalt
 * und Unterschrift jeder Erklärung stammen von mir“).
 */
async function nachfassEntwurf(m: Mensch, v: any): Promise<string> {
  const empfaenger = String(v.empfaenger_name || "die zuständige Stelle");
  const name = `${m.vorname} ${m.nachname}`.trim() || m.name;
  try {
    const daten: SchreibenDaten = {
      kunde: { vorname: m.vorname, nachname: m.nachname, strasse: m.strasse, plz: m.plz, ort: m.ort, geburtsdatum: m.geburtsdatum ?? undefined },
      aktenzeichen: azVon(v),
      datum: berlinHeuteText(),
      empfaenger: { name: empfaenger, adresse: v.empfaenger_adresse ? String(v.empfaenger_adresse) : undefined },
      bezug: { aktenzeichen: azVon(v), versandtAm: tag(v.versandt_am) ?? "", empfaenger },
    };
    const s = schreibenErzeugen("nachfrage", daten);
    return htmlZuText(s.html);
  } catch (e: any) {
    console.error("[FRISTEN] Nachfrage-Entwurf:", e?.message || e);
    const anschrift = [m.strasse, [m.plz, m.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return `Sehr geehrte Damen und Herren,\n\nam ${tag(v.versandt_am) ?? "—"} haben wir Ihnen im Auftrag von ${name}${anschrift ? `, ${anschrift}` : ""}, das Schreiben mit dem Aktenzeichen ${azVon(v)} übermittelt. Eine Antwort liegt weder ${name} noch uns vor. Wir bitten um Mitteilung des Bearbeitungsstands – an ${name} oder an uns als Übermittler.\n\nMit freundlichen Grüßen\nFIAON LTD\nim Auftrag von ${name}`.trim();
  }
}

/**
 * 0) Aufräumen: Ein Vorgang, der beim Anlegen abgebrochen ist, hängt ohne
 * Aktenzeichen in „entwurf“ — der Kunde sähe ewig „Wird vorbereitet.“ Nach einem
 * Tag wird er auf „zurueckgezogen“ gesetzt und der Anspruch wieder geöffnet, damit
 * der nächste Klick einen sauberen Vorgang anlegt. Nichts wird gelöscht.
 */
async function schrittAufraeumen(): Promise<number> {
  const grenze = berlinIsoPlus(-1);
  const zeilen = (await sqlPool`
    SELECT v.id, v.person_id, v.anspruch_id FROM fiaon_vorgaenge v
     WHERE v.stand = 'entwurf' AND v.art <> 'brief' AND v.aktenzeichen IS NULL
       AND (v.created_at AT TIME ZONE 'Europe/Berlin')::date < ${grenze}::date
     ORDER BY v.id ASC LIMIT 200`) as any[];
  let n = 0;
  for (let i = 0; i < zeilen.length; i++) {
    const v = zeilen[i];
    const id = Number(v.id);
    try {
      const geaendert = (await sqlPool`
        UPDATE fiaon_vorgaenge SET stand = 'zurueckgezogen', stand_text = 'Nicht fertig angelegt – der Punkt steht wieder offen auf Ihrer Liste.', updated_at = NOW()
         WHERE id = ${id} AND stand = 'entwurf' RETURNING id`) as any[];
      if (!geaendert.length) continue;
      if (v.anspruch_id) {
        await sqlPool`UPDATE fiaon_ansprueche SET stand = 'offen', vorgang_id = NULL, aktualisiert_am = NOW()
                       WHERE id = ${Number(v.anspruch_id)} AND stand = 'beantragt' AND (vorgang_id = ${id} OR vorgang_id IS NULL)`;
      }
      await ereignis(id, Number(v.person_id), "zurueckgezogen", "Fristenwächter: Entwurf ohne Aktenzeichen älter als ein Tag — Anlage war abgebrochen, Anspruch wieder offen.", "Dieser Entwurf wurde nicht fertig angelegt. Der Punkt steht wieder offen auf Ihrer Liste.");
      n++;
    } catch (e: any) {
      console.error(`[FRISTEN] aufräumen #${id}:`, e?.message || e);
    }
  }
  return n;
}

// ── Die drei Schritte ───────────────────────────────────────────────────────
// Fragment je Aufruf neu — ein Query-Objekt von postgres.js wird nicht geteilt.
const felder = () => sqlPool`v.id, v.person_id, v.art, v.titel, v.stand, v.aktenzeichen, v.empfaenger_name, v.empfaenger_adresse, v.versandt_am, v.frist_am, v.erinnert_am, v.eskaliert_am, v.zustaendig_agent_id`;

/** 1) Frist läuft in sieben Tagen: Auftrag an den Zuständigen. */
async function schrittErinnern(): Promise<number> {
  const heute = berlinIsoPlus(0);
  const bis = berlinIsoPlus(FRIST_VORLAUF_TAGE);
  // Fenster statt Stichtag: Fällt ein Lauf aus (Deploy, Störung), holt der nächste
  // den Vorgang nach — der Schlüssel `frist7:<id>` sorgt für höchstens einen Auftrag.
  const zeilen = (await sqlPool`
    SELECT ${felder()} FROM fiaon_vorgaenge v
     WHERE v.stand = 'versandt' AND v.frist_am IS NOT NULL
       AND v.frist_am > ${heute}::date AND v.frist_am <= ${bis}::date
     ORDER BY v.frist_am ASC, v.id ASC LIMIT 500`) as any[];
  let n = 0;
  for (let i = 0; i < zeilen.length; i++) {
    const v = zeilen[i];
    const id = Number(v.id);
    const schluessel = `frist7:${id}`;
    try {
      if (await auftragVorhanden(schluessel)) continue;
      const m = await menschLaden(Number(v.person_id));
      if (!m) { console.error(`[FRISTEN] Vorgang #${id}: Person ${v.person_id} nicht gefunden`); continue; }
      const fristIso = isoVon(v.frist_am) ?? bis;
      const restTage = Math.max(1, tageBis(fristIso));
      const frist = tag(v.frist_am) ?? fristIso;
      const az = azVon(v);
      await auftragFuerKunden({
        personId: m.personId, ref: m.ref,
        agentId: v.zustaendig_agent_id ? Number(v.zustaendig_agent_id) : null,
        titel: `${m.name}: Frist läuft in ${restTage} ${restTage === 1 ? "Tag" : "Tagen"} (${az}, Antwort bis ${frist})`,
        text: `Der Antrag „${String(v.titel || v.art)}“ (${az}, Vorgang #${id}) ging am ${tag(v.versandt_am) ?? "—"} an ${String(v.empfaenger_name || "die zuständige Stelle")}. Die Antwortfrist endet am ${frist}. Bitte prüfen, ob eine Antwort eingegangen ist (Postfach, Kundenakte) — wenn ja, unter dem Vorgang das Ergebnis eintragen. Wenn bis zur Frist nichts kommt, legt der Fristenwächter am Tag danach den Nachfass-Auftrag an.`,
        faelligAm: fristIso, dringend: false, schluessel, quelle: "kundenbereich", bereich: "pruefen",
        link: vorgangLink(id), autorName: "Fristenwächter",
      });
      await ereignis(id, m.personId, "erinnert", `Fristenwächter: Mitarbeiter erinnert, Antwortfrist endet am ${frist}.`, `Die Antwortfrist endet am ${frist}. Sie müssen nichts tun.`);
      n++;
    } catch (e: any) {
      console.error(`[FRISTEN] erinnern #${id}:`, e?.message || e);
    }
  }
  return n;
}

/** 2) Frist abgelaufen, keine Antwort: Nachfrage mit Entwurf. */
async function schrittNachfragen(): Promise<number> {
  const heute = berlinIsoPlus(0);
  const zeilen = (await sqlPool`
    SELECT ${felder()} FROM fiaon_vorgaenge v
     WHERE v.stand = 'versandt' AND v.frist_am IS NOT NULL AND v.frist_am < ${heute}::date
     ORDER BY v.frist_am ASC, v.id ASC LIMIT 500`) as any[];
  let n = 0;
  for (let i = 0; i < zeilen.length; i++) {
    const v = zeilen[i];
    const id = Number(v.id);
    const schluessel = `nachfass:${id}`;
    try {
      const m = await menschLaden(Number(v.person_id));
      if (!m) { console.error(`[FRISTEN] Vorgang #${id}: Person ${v.person_id} nicht gefunden`); continue; }
      const frist = tag(v.frist_am) ?? isoVon(v.frist_am) ?? "—";
      const az = azVon(v);
      // Keine Zusage ohne Datenbedingung: Zu diesem Zeitpunkt gibt es nur den Auftrag — nachgefragt hat noch niemand.
      // „Wir haben am … nachgefragt.“ schreibt erst POST /agent/app/vorgaenge/:id/nachgefasst.
      const kundenSatz = `Keine Antwort bis ${frist}. Ihre Ansprechperson hat den Auftrag, bei der Stelle nachzufragen. Sie müssen nichts tun.`;
      // Zustandswechsel zuerst und nur aus 'versandt' heraus — läuft ein zweiter
      // Prozess parallel, gewinnt genau einer (0 Zeilen = jemand war schneller).
      const geaendert = (await sqlPool`
        UPDATE fiaon_vorgaenge
           SET stand = 'nachfrage', erinnert_am = NOW(), stand_text = ${kundenSatz}, updated_at = NOW()
         WHERE id = ${id} AND stand = 'versandt'
         RETURNING id`) as any[];
      if (!geaendert.length) continue;
      await ereignis(id, m.personId, "nachfrage", `Fristenwächter: Frist ${frist} verstrichen, Nachfass-Auftrag an den Betreuer.`, kundenSatz);
      void pushBeiEreignis(m.personId, "frist_ueberfaellig", { vorgangId: id, titel: String(v.titel || ""), fristAm: frist }).catch(() => {});
      // Die Sieben-Tage-Erinnerung ist damit gegenstandslos.
      await auftragSchliessen(`frist7:${id}`, "Frist verstrichen – Nachfass-Auftrag angelegt.");
      if (!(await auftragVorhanden(schluessel))) {
        const entwurf = await nachfassEntwurf(m, v);
        await auftragFuerKunden({
          personId: m.personId, ref: m.ref,
          agentId: v.zustaendig_agent_id ? Number(v.zustaendig_agent_id) : null,
          titel: `${m.name}: Nachfassen (${az})`,
          text: `Der Antrag „${String(v.titel || v.art)}“ (${az}, Vorgang #${id}) ging am ${tag(v.versandt_am) ?? "—"} an ${String(v.empfaenger_name || "die zuständige Stelle")}; die Antwortfrist ${frist} ist verstrichen. Bitte den Entwurf der Nachfrage prüfen (Wir-Form – FIAON fragt als Übermittler nach, das deckt die Vollmacht), an die Stelle senden und danach im Vorgang „Nachgefragt“ quittieren – erst dann liest der Kunde „Wir haben nachgefragt“. Der Kunde sieht bis dahin: „${kundenSatz}“\n\n— Entwurf der Nachfrage —\n${entwurf}`,
          faelligAm: heute, dringend: false, schluessel, quelle: "kundenbereich", bereich: "pruefen",
          link: vorgangLink(id), autorName: "Fristenwächter",
        });
      }
      n++;
    } catch (e: any) {
      console.error(`[FRISTEN] nachfragen #${id}:`, e?.message || e);
    }
  }
  return n;
}

/** 3) Sieben Tage nach der Nachfrage immer noch nichts: an die Leitung. */
async function schrittEskalieren(): Promise<number> {
  const grenze = berlinIsoPlus(-ESKALATION_NACH_TAGEN);
  const zeilen = (await sqlPool`
    SELECT ${felder()} FROM fiaon_vorgaenge v
     WHERE v.stand = 'nachfrage' AND v.eskaliert_am IS NULL AND v.erinnert_am IS NOT NULL
       AND (v.erinnert_am AT TIME ZONE 'Europe/Berlin')::date < ${grenze}::date
     ORDER BY v.erinnert_am ASC, v.id ASC LIMIT 500`) as any[];
  let n = 0;
  for (let i = 0; i < zeilen.length; i++) {
    const v = zeilen[i];
    const id = Number(v.id);
    try {
      const m = await menschLaden(Number(v.person_id));
      if (!m) { console.error(`[FRISTEN] Vorgang #${id}: Person ${v.person_id} nicht gefunden`); continue; }
      const geaendert = (await sqlPool`
        UPDATE fiaon_vorgaenge SET eskaliert_am = NOW(), updated_at = NOW()
         WHERE id = ${id} AND stand = 'nachfrage' AND eskaliert_am IS NULL
         RETURNING id`) as any[];
      if (!geaendert.length) continue;
      const az = azVon(v);
      const [zust] = (v.zustaendig_agent_id
        ? await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${Number(v.zustaendig_agent_id)} LIMIT 1`.catch(() => [])
        : []) as any[];
      await ereignis(id, m.personId, "eskaliert", `Fristenwächter: ${ESKALATION_NACH_TAGEN} Tage nach dem Nachfass-Auftrag keine Antwort — Meldung an die Leitung.`, "Auch nach der Nachfrage-Frist liegt keine Antwort vor. Die Leitung ist eingeschaltet. Sie müssen nichts tun.");
      await todoMeldung(`eskalation:${id}`, {
        titel: `${m.name}: Keine Antwort nach Nachfrage (${az})`,
        text: `Der Antrag „${String(v.titel || v.art)}“ (${az}, Vorgang #${id}) ging am ${tag(v.versandt_am) ?? "—"} an ${String(v.empfaenger_name || "die zuständige Stelle")}. Frist ${tag(v.frist_am) ?? "—"} verstrichen, Nachfass-Auftrag am ${tag(v.erinnert_am) ?? "—"}${zust?.name ? ` an ${String(zust.name)}` : ""} — seither keine Antwort und kein Ergebnis im Vorgang. Bitte klären: Ist nachgefasst worden? Braucht der Kunde einen Anruf bei der Stelle? Ergebnis unter dem Vorgang eintragen.`,
        bereich: "pruefen", link: vorgangLink(id),
      }, { name: "Fristenwächter", agentId: null });
      n++;
    } catch (e: any) {
      console.error(`[FRISTEN] eskalieren #${id}:`, e?.message || e);
    }
  }
  return n;
}

/**
 * Der Lauf. Rückgabe: was in DIESEM Lauf neu angestoßen wurde (nicht der
 * Gesamtbestand). Ein zweiter Lauf am selben Tag liefert Nullen — das ist
 * die Idempotenz, nicht ein Fehler.
 */
export async function fristenwaechterLauf(): Promise<FristenwaechterErgebnis> {
  await ensureEreignisTabelle();
  // Reihenfolge: aufräumen (hängende Entwürfe), dann nachfragen (versandt →
  // nachfrage), dann eskalieren (alte Nachfragen), dann erinnern. Ein heute
  // nachgefragter Vorgang ist danach nicht mehr 'versandt' und kann nicht
  // zusätzlich als „läuft bald ab“ erinnert werden.
  const aufgeraeumt = await schrittAufraeumen();
  const nachgefragt = await schrittNachfragen();
  const eskaliert = await schrittEskalieren();
  const erinnert = await schrittErinnern();
  if (erinnert || nachgefragt || eskaliert || aufgeraeumt) console.log(`[FRISTEN] Lauf: ${erinnert} erinnert, ${nachgefragt} nachgefragt, ${eskaliert} eskaliert, ${aufgeraeumt} aufgeräumt`);
  return { erinnert, nachgefragt, eskaliert, aufgeraeumt };
}
