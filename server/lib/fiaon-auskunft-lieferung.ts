// ═══════════════════════════════════════════════════════════════════════════
// NACH DEM KAUF WIRD GELIEFERT — UND JEDE AUSKUNFT-MAIL STIMMT (24.09.2026, E-240)
//
// ── DER BEFUND (Produktion, gemessen 24.09.2026) ──────────────────────────
// 66 Menschen haben eine Bonitätsauskunft bezahlt, 59 von ihnen haben bis heute
// kein Dokument. fiaon_vorgaenge hatte 0 Zeilen, schufa_requested/approved/
// rejected waren „Empfehlung, noch kein Auto-Versand" und gingen nie an einen
// echten Kunden. Die Zahlungsmails versprachen „schalten wir Ihren Bereich
// frei". Wer die Auskunft kaufte, kaufte ein Versprechen ohne Ablauf dahinter.
//
// ── DER ABLAUF, DER JETZT DAHINTER STEHT ──────────────────────────────────
//   1. Zahlung gebucht → onCustomerPaid (fiaon-agent.ts) → lieferungStarten(ref)
//   2. Je Auskunftei des Landes (shared/fiaon-auskunft.ts, AUSKUNFTEIEN) ein
//      Vorgang „selbstauskunft" mit dem Schreiben in Ich-Form des Kunden
//      (fiaon-schreiben.ts) — derselbe Weg wie jeder Antrag im Kundenbereich
//      (fiaon-app-antraege.ts): Vollmacht → Unterschrift → Versand quittieren →
//      Antwort fotografieren → Ergebnis eintragen.
//   3. Aufgabe an den Betreuer (sonst Onboarding): Vollmacht einholen,
//      Anfragen übermitteln, Eingang hochladen — mit Frist.
//   4. Mail schufa_requested: „Wir fordern jetzt Ihre Datenkopien bei … an.
//      Damit wir das dürfen, unterschreiben Sie …" mit dem signierten Link.
//   5. Ergebnis im Vorgang → schufa_approved („Ihre Datenkopie ist da") bzw.
//      schufa_rejected (Rückfrage der Auskunftei) — aus dem Router.
//
// ── IDEMPOTENZ ────────────────────────────────────────────────────────────
// Mehrere Buchungswege rufen onCustomerPaid (mark-paid, Kontoabgleich,
// Nachbuchung). Eine Transaktionssperre je Bestellung (pg_advisory_xact_lock)
// und der Abgleich „gibt es zu dieser Auskunftei schon einen Vorgang aus
// dieser Bestellung oder einen offenen?" machen den zweiten Aufruf wirkungslos:
// keine zweite Anfrage, keine zweite Mail, keine zweite Aufgabe.
//
// ── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
// Kein automatisches Anschreiben des Rückstands (die 59): rueckstandListe()
// liefert sie für das Chefbüro; gestartet wird dort von Hand, je Bestellung.
//
// Dazu, was die Auskunft-Mails an der Tür (make-webhook.ts) brauchen: die
// Anreicherung der Zahlungsmails (auskunftMailAnreichern), den Kaufstand für das
// Angebot (auskunftAngebotKaufstand) und die Nutzlast des Angebots.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { produktkategorie } from "./fiaon-produktkategorie";
import { anredeMail, nameFuerAnrede } from "@shared/fiaon-anrede";
import { schreibenErzeugen, hashVon } from "./fiaon-schreiben";
import {
  AUSKUNFTEIEN, AUSKUNFT_SCHLUESSEL, AUSKUNFT_BESCHAFFUNG_VERMERK, auskunftLand, auskunfteienFuer, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand, type Auskunftei,
} from "@shared/fiaon-auskunft";

// Die Marke des Beschaffungsauftrags steht in der gemeinsamen Quelle (25.09.2026, E-241) — hier
// weitergereicht, damit Prüfstände und Chefbüro sie neben AUSKUNFT_VOLLMACHT_VERMERK finden.
export { AUSKUNFT_BESCHAFFUNG_VERMERK };

type Lauf = typeof sqlPool;

/** Stände, in denen eine Anfrage noch „läuft" — eine zweite an dieselbe Auskunftei wäre doppelt. */
const LAUFEND = ["entwurf", "unterschrift_offen", "versandbereit", "versandt", "nachfrage"];

const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf"];
const zahlwort = (n: number) => (n >= 0 && n < ZAHLWORT.length ? ZAHLWORT[n] : String(n));

/** Für HTML entschärfen — Werte aus der Datenbank landen roh in der Mail (der Motor füllt, er escaped nicht). */
function html(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\{\{/g, "{ {");
}

/** Namen der Auskunfteien als Satzteil: „SCHUFA, CRIF und Creditreform Boniversum". */
function namenText(namen: string[]): string {
  return namen.length <= 1 ? (namen[0] ?? "") : `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

function auskunfteiNachName(name: unknown): Auskunftei | null {
  const n = String(name ?? "").trim();
  return n ? AUSKUNFTEIEN.find((a) => a.name === n) ?? null : null;
}

/** „24.09.2026" (Berlin) — nur über formatToParts (Zeit-Falle Berlin-Stunde). */
function heuteText(): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const w = (a: string) => t.find((p) => p.type === a)?.value ?? "00";
  return `${w("day")}.${w("month")}.${w("year")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 0. DIE WIDERRUFSFRIST (Gegenlesen 24.09.2026, E-240)
//
// Beide Kauftüren (Kauflink aus der Mail, fiaon-auskunft-kauf.ts; Kaufkarte im
// Bereich, fiaon-kunde-bereich.ts) fragen, ob FIAON vor Ablauf der
// Widerrufsfrist beginnen soll, und sagen: „Ohne diesen Haken beginnen wir nach
// Ablauf der Widerrufsfrist." Die Wahl steht wortgleich im Verlauf der Bestellung
// („… NICHT verlangt — mit der Anforderung erst nach Ablauf der 14-tägigen
// Widerrufsfrist beginnen"). Die Lieferung las sie nicht: Nach der Zahlung ging
// sofort die Bitte zur Unterschrift hinaus, und der Betreuer sollte die Anfragen
// gleich übermitteln. Folge wäre nicht nur ein gebrochenes Wort — ohne das
// ausdrückliche Verlangen schuldet der Kunde bei einem Widerruf keinen
// Wertersatz (§ 357a Abs. 2 BGB), und sein Widerrufsrecht erlischt auch bei
// vollständiger Erfüllung nicht (§ 356 Abs. 4 BGB).
//
// Die Regel jetzt: Vorbereiten (Vorgänge, Unterschrift) darf sofort — die
// ANFORDERUNG bei den Auskunfteien, also die Übermittlung, erst ab dem Tag nach
// dem Fristende. Die Mail sagt dem Kunden das Datum, die Aufgabe dem Betreuer,
// und der Vorgang lässt das Quittieren des Versands vorher nicht zu
// (auskunftVersandSperre, Router fiaon-app-antraege.ts).
// Ohne Eintrag (Mara, Betreuer am Telefon, Altbestellungen) gibt es keine
// dokumentierte Wahl — dann gilt der bisherige Weg (sofort).
// ═══════════════════════════════════════════════════════════════════════════

export interface WiderrufStand {
  /** true = die Anforderung darf heute noch nicht hinaus. */
  warten: boolean;
  /** Die dokumentierte Wahl: true verlangt, false nicht verlangt, null = kein Eintrag. */
  verlangt: boolean | null;
  /** Erster Tag, an dem angefordert werden darf (YYYY-MM-DD, Berlin) — nur bei „nicht verlangt". */
  ab: string | null;
  /** Dasselbe als „09.10.2026". */
  abText: string | null;
}

/** Kalendertag in Berlin als UTC-Mittag (Rechnen ohne Sommerzeit-Falle). */
function berlinTag(d: Date): Date {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const w = (a: string) => Number(t.find((p) => p.type === a)?.value ?? "0");
  return new Date(Date.UTC(w("year"), w("month") - 1, w("day"), 12));
}

/**
 * Erster Tag nach der Widerrufsfrist: Vertragsschluss (Anlage der Bestellung)
 * + 14 Tage; fällt das Ende auf Samstag oder Sonntag, endet sie am nächsten
 * Werktag (§ 193 BGB — Feiertage bleiben außen vor, der Betreuer sieht das Datum).
 */
export function anforderungAb(vertragsschluss: Date): string {
  const ende = berlinTag(vertragsschluss);
  ende.setUTCDate(ende.getUTCDate() + 14);
  while (ende.getUTCDay() === 0 || ende.getUTCDay() === 6) ende.setUTCDate(ende.getUTCDate() + 1);
  ende.setUTCDate(ende.getUTCDate() + 1);
  return ende.toISOString().slice(0, 10);
}

const isoDeutsch = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Die dokumentierte Wahl zur Widerrufsfrist einer Auskunft-Bestellung und was daraus für heute folgt. */
export async function auskunftWiderrufStand(ref: string, lauf: Lauf = sqlPool): Promise<WiderrufStand> {
  const [n] = (await lauf`
    SELECT note FROM fiaon_contact_log
     WHERE ref = ${ref} AND note LIKE ${"%Beginn vor Ablauf der Widerrufsfrist%"}
     ORDER BY created_at DESC LIMIT 1`) as any[];
  if (!n) return { warten: false, verlangt: null, ab: null, abText: null };
  if (/AUSDRÜCKLICH VERLANGT/.test(String(n.note))) return { warten: false, verlangt: true, ab: null, abText: null };
  const [a] = (await lauf`SELECT created_at FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  const ab = anforderungAb(a?.created_at ? new Date(a.created_at) : new Date());
  const heute = berlinTag(new Date()).toISOString().slice(0, 10);
  return { warten: heute < ab, verlangt: false, ab, abText: isoDeutsch(ab) };
}

/** Die Widerrufs-Lage der Bestellung, aus der diese Anfrage auf Selbstauskunft stammt — null bei anderen Vorgängen. */
export async function auskunftVersandFrist(vorgangId: number, lauf: Lauf = sqlPool): Promise<(WiderrufStand & { ref: string }) | null> {
  const [d] = (await lauf`
    SELECT d.ref FROM fiaon_dokumente d JOIN fiaon_vorgaenge v ON v.id = d.vorgang_id
     WHERE d.vorgang_id = ${vorgangId} AND v.art = 'selbstauskunft' AND d.art = 'schreiben_html' AND d.ref IS NOT NULL
     ORDER BY d.hochgeladen_am ASC LIMIT 1`) as any[];
  if (!d?.ref) return null;
  return { ...(await auskunftWiderrufStand(String(d.ref), lauf)), ref: String(d.ref) };
}

/**
 * Darf der Versand dieser Anfrage auf Selbstauskunft heute quittiert werden?
 * null = ja, sonst der Satz für den Mitarbeiter. Für andere Vorgangsarten immer null.
 */
export async function auskunftVersandSperre(vorgangId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const w = await auskunftVersandFrist(vorgangId, lauf);
  return w?.warten
    ? `Der Kunde hat den Beginn vor Ablauf der Widerrufsfrist nicht verlangt (siehe Verlauf der Bestellung ${w.ref}). Die Anfrage darf erst ab dem ${w.abText} an die Auskunftei — bitte bis dahin nicht versenden.`
    : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DIE LIEFERUNG STARTEN
// ═══════════════════════════════════════════════════════════════════════════

export interface LieferVorgang { id: number; auskunftei: string; neu: boolean; stand: string }

export interface LieferungErgebnis {
  ok: boolean;
  /** Warum nichts angelegt wurde — nur bei ok:false oder „nichts zu tun". */
  grund: "keine_auskunft" | "nicht_bezahlt" | "ohne_person" | "anschrift_fehlt" | "unbekannt" | null;
  text: string;
  ref: string;
  personId: number | null;
  land: AuskunftLand | null;
  vorgaenge: LieferVorgang[];
  neuAngelegt: number;
  mail: "gesendet" | "fehlgeschlagen" | "nicht_noetig" | "aus" | "unterschrift_aus";
  auftragId: number | null;
  /**
   * E-241: Im Einkauf und über die API entsteht statt der Anfragen ein
   * Beschaffungsauftrag (fiaon_auskunft_beschaffung) — `vorgaenge` bleibt dann
   * leer, `mail` meint den Link zur Auftragsbestätigung (nur wenn keine
   * Einwilligung dokumentiert ist).
   */
  beschaffung?: { id: number; neu: boolean; status: string; faelligAb: string; einwilligung: boolean; modus: AuskunftLiefermodus } | null;
}

/** Der Mensch, der die Aufgabe bekommt: Betreuer, sonst das Onboarding mit der kleinsten Last, sonst die Ableitung. */
async function lieferAgent(personId: number, lauf: Lauf): Promise<number | null> {
  const [b] = (await lauf`
    SELECT a.id FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} AND COALESCE(a.active, TRUE) = TRUE AND COALESCE(a.is_test_account, FALSE) = FALSE
       AND a.zugang_gesperrt_am IS NULL LIMIT 1`) as any[];
  if (b?.id) return Number(b.id);
  const [o] = (await lauf`
    SELECT ag.id FROM fiaon_agents ag
     WHERE COALESCE(ag.active, TRUE) = TRUE AND ag.rolle = 'onboarding'
       AND COALESCE(ag.is_test_account, FALSE) = FALSE AND ag.zugang_gesperrt_am IS NULL
     ORDER BY (SELECT COUNT(*) FROM fiaon_betreiber_todos t WHERE t.zustaendig_agent_id = ag.id AND t.status <> 'erledigt') ASC, ag.id ASC
     LIMIT 1`) as any[];
  return o?.id ? Number(o.id) : null;
}

/**
 * Nach der Zahlung einer Bonitätsauskunft: Anfragen anlegen, Aufgabe stellen,
 * Kunde informieren. Idempotent — ein zweiter Aufruf legt nichts doppelt an und
 * schickt keine zweite Mail.
 *
 * @param opts.mail false = keine Mail an den Kunden (z. B. Nachholen aus dem
 *   Chefbüro, wenn der Betreuer den Kunden anruft).
 */
export async function lieferungStarten(ref: string, opts: { mail?: boolean; von?: string } = {}, lauf: Lauf = sqlPool): Promise<LieferungErgebnis> {
  const leer = (grund: LieferungErgebnis["grund"], text: string, extra: Partial<LieferungErgebnis> = {}): LieferungErgebnis => ({
    ok: false, grund, text, ref, personId: null, land: null, vorgaenge: [], neuAngelegt: 0, mail: "nicht_noetig", auftragId: null, ...extra,
  });
  const [z] = (await lauf`
    SELECT ref, type, pack_key, pack_name, payment_status, payment_reference, amount_due, person_id, country,
           email, contact_email, billing_email, first_name, last_name, contact_name, company_name
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
  if (!z) return leer("unbekannt", `Bestellung ${ref} nicht gefunden.`);
  if (produktkategorie(z) !== "auskunft") return leer("keine_auskunft", `${ref} ist keine Bonitätsauskunft.`);
  if (String(z.payment_status) !== "paid") return leer("nicht_bezahlt", `${ref} ist noch nicht bezahlt.`);
  const personId = z.person_id != null ? Number(z.person_id) : null;
  const art: AuskunftArt = [AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo].includes(String(z.pack_key ?? "").trim().toLowerCase()) ? "firma" : "privat";
  const { auftragFuerKunden, todoMeldung } = await import("../routes/fiaon-betreiber-todo");
  const { werktageSpaeter, antraegeFreigeschaltet } = await import("../routes/fiaon-app");

  if (!personId) {
    // Ohne Person kein Vorgang (fiaon_vorgaenge.person_id ist Pflicht) — die Leitung muss zuordnen.
    await todoMeldung(`auskunft-ohne-person:${ref}`, {
      titel: `Bezahlte Auskunft ohne Person (${ref})`,
      text: `Die Bonitätsauskunft ${ref} ist bezahlt, hängt aber an keiner Person. Ohne Person kann keine Anfrage angelegt werden. Bitte die Bestellung der richtigen Akte zuordnen und die Lieferung im Chefbüro neu starten.`,
      bereich: "pruefen", link: `/admin/kunde/${encodeURIComponent(ref)}`,
    }, { name: "Auskunft-Lieferung", agentId: null }).catch((e: unknown) => console.error("[AUSKUNFT-LIEFERUNG] Meldung ohne Person:", e));
    return leer("ohne_person", `${ref} hängt an keiner Person.`);
  }

  // ── DER LIEFERWEG (25.09.2026, E-241) ──────────────────────────────────────
  // Justin: „Bis zur API kaufen wir sie selbst." Im Einkauf (Standard) und über
  // die API entsteht statt der Anfragen ein Beschaffungsauftrag (Abschnitt 5);
  // der Weg unten (Vorgänge, Unterschrift, Post) gilt nur noch bei „vollmacht".
  const modus = await auskunftLiefermodus(lauf);
  if (modus !== "vollmacht") return beschaffungStarten({ z, personId, art, modus, opts }, lauf);

  // Das Land: an der Bestellung, sonst an der jüngsten Zeile der Person (Paket vor allem anderen).
  let landRoh = z.country;
  if (!String(landRoh ?? "").trim()) {
    const [l] = (await lauf`SELECT country FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND country IS NOT NULL
                             ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    landRoh = l?.country ?? null;
  }
  const land = auskunftLand(landRoh);
  const auskunfteien = auskunfteienFuer(land);

  const antraege = await import("../routes/fiaon-app-antraege");
  await antraege.ensureAntraegeTabellen();
  const kunde = await antraege.kundeLaden(personId);
  const agentId = await lieferAgent(personId, lauf).catch(() => null);
  const kundeName = kunde?.name || [z.first_name, z.last_name].filter(Boolean).join(" ") || ref;

  if (!kunde || !kunde.daten.strasse || !kunde.daten.plz || !kunde.daten.ort) {
    // Die Anfrage an eine Auskunftei braucht Name und Anschrift — sonst kann sie
    // niemanden zuordnen. Erst die Anschrift, dann die Lieferung (Chefbüro).
    const erg = await auftragFuerKunden({
      personId, ref, agentId, dringend: false, faelligAm: werktageSpaeter(1),
      titel: `${kundeName}: Auskunft bezahlt — Anschrift fehlt`,
      text: `Die Bonitätsauskunft ${ref} ist bezahlt. Für die Anfragen an ${auskunfteienText(land)} fehlt die Anschrift des Kunden (Straße, PLZ, Ort). Bitte beim Kunden erfragen, in der Akte eintragen und danach die Lieferung im Chefbüro unter „Auskunft-Rückstand“ neu starten.`,
      schluessel: `auskunft-anschrift:${ref}`, quelle: "bestellung", bereich: "pruefen", autorName: "Auskunft-Lieferung",
      anlageText: "Angelegt von der Auskunft-Lieferung nach der Zahlung.",
    }).catch((e: unknown) => { console.error("[AUSKUNFT-LIEFERUNG] Aufgabe Anschrift:", e); return null; });
    return leer("anschrift_fehlt", `Für ${ref} fehlt die Anschrift — Aufgabe an den Betreuer.`, { personId, land, auftragId: erg?.id ?? null });
  }

  // ── Die Anfragen: in EINER Transaktion, gesperrt je Bestellung ────────────
  const datum = heuteText();
  const vorgaenge = await (lauf.begin(async (tx) => {
    const t = tx as unknown as Lauf;
    await t`SELECT pg_advisory_xact_lock(hashtext(${`auskunft-lieferung:${ref}`}))`;
    const vorhanden = (await t`
      SELECT v.id, v.empfaenger_name, v.stand FROM fiaon_vorgaenge v
       WHERE v.person_id = ${personId} AND v.art = 'selbstauskunft'
         AND (EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.vorgang_id = v.id AND d.ref = ${ref})
              OR v.stand = ANY(${LAUFEND}))
       ORDER BY v.id ASC`) as any[];
    const liste: LieferVorgang[] = [];
    for (const a of auskunfteien) {
      const da = vorhanden.find((v) => String(v.empfaenger_name ?? "") === a.name);
      if (da) { liste.push({ id: Number(da.id), auskunftei: a.kurz, neu: false, stand: String(da.stand) }); continue; }
      const [v] = (await t`
        INSERT INTO fiaon_vorgaenge (person_id, art, titel, stand, stand_text, zustaendig_agent_id)
        VALUES (${personId}, 'selbstauskunft', ${`Datenkopie bei ${a.kurz}`}, 'entwurf', 'Wird vorbereitet.', ${agentId})
        RETURNING id`) as any[];
      const id = Number(v.id);
      const az = antraege.aktenzeichenFuer(id);
      const s = schreibenErzeugen("selbstauskunft", { kunde: kunde.daten, aktenzeichen: az, datum, auskunftei: a.key });
      await t`
        INSERT INTO fiaon_dokumente (person_id, ref, vorgang_id, art, dateiname, mime, bytes, inhalt, quelle, aktenzeichen, doc_hash)
        VALUES (${personId}, ${ref}, ${id}, 'schreiben_html', ${`Schreiben_${az.replace(/[^0-9A-Za-z-]/g, "_")}.html`}, 'text/html',
                ${Buffer.byteLength(s.html, "utf8")}, ${Buffer.from(s.html, "utf8")}, 'erzeugt', ${az}, ${hashVon(s.html)})`;
      await t`
        UPDATE fiaon_vorgaenge SET aktenzeichen = ${az}, empfaenger_name = ${s.empfaengerName}, empfaenger_adresse = ${s.empfaengerAdresse},
               stand = 'unterschrift_offen', stand_text = 'Wartet auf Ihre Unterschrift.', updated_at = NOW()
         WHERE id = ${id}`;
      await antraege.ereignis(id, personId, "entwurf", `Anfrage an ${a.name} (${a.recht}) aus der bezahlten Auskunft ${ref} erzeugt.`, `Ihre Anfrage an ${a.kurz} ist vorbereitet.`, null, t);
      await antraege.ereignis(id, personId, "unterschrift_offen", "Unterschriftslink ausgestellt.", null, null, t);
      liste.push({ id, auskunftei: a.kurz, neu: true, stand: "unterschrift_offen" });
    }
    return liste;
  }) as Promise<LieferVorgang[]>);

  const neu = vorgaenge.filter((v) => v.neu);
  const basis: LieferungErgebnis = {
    ok: true, grund: null, text: "", ref, personId, land, vorgaenge, neuAngelegt: neu.length, mail: "nicht_noetig", auftragId: null,
  };
  if (!neu.length) return { ...basis, text: `Lieferung zu ${ref} läuft bereits (${vorgaenge.length} Anfragen) — nichts doppelt angelegt.` };

  const offen = vorgaenge.filter((v) => v.stand === "unterschrift_offen");
  const beiText = namenText(vorgaenge.map((v) => v.auskunftei));
  const unterschriftFrei = await antraegeFreigeschaltet();
  // Gegenlesen 24.09.2026: die Wahl zur Widerrufsfrist (Abschnitt 0). Bei einer Störung
  // gilt der bisherige Weg — die Sperre am Versand (auskunftVersandSperre) fragt selbst noch einmal.
  const widerruf = await auskunftWiderrufStand(ref, lauf)
    .catch((): WiderrufStand => ({ warten: false, verlangt: null, ab: null, abText: null }));
  const wartenSatz = widerruf.warten
    ? ` Wie bei der Beauftragung gewählt, schicken wir Ihre Anfragen erst nach Ablauf der Widerrufsfrist ab dem ${widerruf.abText} an die Auskunfteien — unterschreiben können Sie schon jetzt.`
    : "";

  // ── Die Mail an den Kunden ────────────────────────────────────────────────
  let mail: LieferungErgebnis["mail"] = "aus";
  if (opts.mail !== false && offen.length) {
    if (!unterschriftFrei) {
      mail = "unterschrift_aus";
    } else {
      try {
        const weg = await antraege.unterschriftWeg(personId, offen[0].id, "selbstauskunft");
        const anfragen = `${zahlwort(offen.length)} ${offen.length === 1 ? "Anfrage" : "Anfragen"}`;
        // Ohne <b>: Der Satz kommt als Wert in die Vorlage — im Text-Teil der Mail
        // (mailText entfernt nur die Tags der Vorlage selbst) stand das Tag wörtlich.
        const satz = weg.vollmachtNoetig
          ? `Damit wir das dürfen, unterschreiben Sie bitte einmal die Vollmacht zur Übermittlung und gleich danach Ihre ${anfragen} — nacheinander auf einer Seite, mit dem Finger am Bildschirm.`
          : `Ihre Vollmacht zur Übermittlung liegt uns schon vor. Unterschreiben Sie bitte nur noch Ihre ${anfragen} — nacheinander auf einer Seite, mit dem Finger am Bildschirm.`;
        const satzMitFrist = `${satz}${wartenSatz}`;
        const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
        // E-241: Die Vorlage ist für beide Lieferwege gebaut — die Sätze des Vollmacht-Wegs kommen aus derselben Quelle.
        const { schufaRequestedSaetze } = await import("../mail/vorlagen/auskunft-lead");
        const versand = await sendMakeWebhookMitGrund("schufa_requested", {
          ...makePayloadFromRow(z),
          person_id: personId,
          vorname: kunde.vorname || z.first_name || null,
          anrede: html(anredeMail({ vorname: kunde.vorname || z.first_name, nachname: kunde.nachname || z.last_name })),
          auskunfteien: html(beiText),
          auskunft_land: land,
          auskunft_liefermodus: "vollmacht",
          ...schufaRequestedSaetze("vollmacht"),
          unterschrift_satz: satzMitFrist,
          unterschrift_url: absoluteUrl(weg.url),
          login_url: absoluteUrl("/app/vorgaenge"),
        });
        mail = versand.ok ? "gesendet" : "fehlgeschlagen";
        if (!versand.ok) console.warn(`[AUSKUNFT-LIEFERUNG] ${ref}: schufa_requested nicht gesendet — ${versand.grund ?? "?"}`);
      } catch (e) {
        mail = "fehlgeschlagen";
        console.error(`[AUSKUNFT-LIEFERUNG] ${ref}: Mail schufa_requested:`, e);
      }
    }
  }

  // ── Die Aufgabe an den Menschen ──────────────────────────────────────────
  const ids = vorgaenge.map((v) => `#${v.id}`).join(", ");
  const mailSatz = mail === "gesendet"
    ? "Der Kunde hat per Mail den Link zur Unterschrift (Vollmacht und Anfragen) bekommen."
    : mail === "unterschrift_aus"
      ? "ACHTUNG: Die Unterschrift in der App ist abgeschaltet (fiaon_settings.app_antraege_an) — der Kunde hat KEINE Mail bekommen. Vollmacht und Anfragen bitte im Gespräch einholen."
      : mail === "fehlgeschlagen"
        ? "ACHTUNG: Die Mail mit dem Unterschriftslink ging NICHT raus (siehe Mail-Protokoll der Akte). Bitte den Kunden anrufen — den Link findet er im Kundenbereich unter Vorgänge."
        : "Der Kunde hat keine Mail bekommen (Lieferung von Hand gestartet) — bitte anrufen; den Link findet er im Kundenbereich unter Vorgänge.";
  const widerrufSatz = widerruf.warten
    ? `\n\nWIDERRUFSFRIST: Der Kunde hat den Beginn vor Ablauf der Widerrufsfrist NICHT verlangt (siehe Verlauf der Bestellung). Vollmacht und Unterschriften darfst du schon einholen — die Anfragen gehen aber erst ab dem ${widerruf.abText} an die Auskunfteien. Vorher lässt der Vorgang das Quittieren des Versands nicht zu.`
    : widerruf.verlangt === true
      ? "\n\nWIDERRUFSFRIST: Der Kunde hat ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen — die Anfragen dürfen sofort hinaus."
      : "";
  const firmaSatz = art === "firma"
    ? "\n\nFIRMENAUSKUNFT: Angelegt sind die persönlichen Anfragen der Inhaberin bzw. des Inhabers. Die Wirtschaftsauskunft des Unternehmens (Creditreform-Geschäftsstelle; CRIF über archivauskunft.de@crif.com) bitte zusätzlich von Hand anfordern — dafür gibt es noch keine Vorlage."
    : "";
  const frist = werktageSpaeter(2);
  let auftragId: number | null = null;
  try {
    const erg = await auftragFuerKunden({
      personId, ref, agentId, faelligAm: frist,
      titel: `${kundeName}: Auskunft beschaffen (${beiText})`,
      text: `Der Kunde hat die Bonitätsauskunft bezahlt (${ref}${z.amount_due != null ? `, ${euroText(Math.round(Number(z.amount_due) * 100))}` : ""}). Die Anfragen an ${beiText} sind als Vorgänge angelegt (${ids}) und warten auf seine Unterschrift. ${mailSatz}\n\n`
        + "1. Vollmacht einholen: Hat der Kunde bis zur Frist nicht unterschrieben, anrufen und gemeinsam unterschreiben (Link im Kundenbereich unter Vorgänge).\n"
        + "2. Anfragen übermitteln: Nach jeder Unterschrift entsteht der Auftrag „Antrag versenden und quittieren“ — Schreiben an die Auskunftei schicken und den Versand im Vorgang bestätigen.\n"
        + "3. Eingang hochladen: Die Datenkopie kommt per Post zum Kunden. Er fotografiert sie im Vorgang, oder sie wird in der Akte unter Unterlagen als Bonitätsauskunft hochgeladen (startet die Analyse). Danach im Vorgang das Ergebnis eintragen — „bewilligt“ heißt Datenkopie eingegangen, „abgelehnt“ heißt Rückfrage der Auskunftei; der Kunde bekommt jeweils automatisch Bescheid.\n"
        + `4. Auswertung: jeden Eintrag erklären, Speicherfristen prüfen, Handlungsplan und Schreiben zur Freigabe vorbereiten und mit dem Kunden besprechen.${widerrufSatz}${firmaSatz}`,
      schluessel: `auskunft-lieferung:${ref}`, quelle: "bestellung", bereich: "pruefen",
      link: `/agent/app-vorgaenge/${vorgaenge[0].id}`, autorName: "Auskunft-Lieferung",
      anlageText: `Angelegt von der Auskunft-Lieferung nach der Zahlung (${ref}).`,
    });
    auftragId = erg.id;
    for (const v of neu) if (erg.agentId && !agentId) await lauf`UPDATE fiaon_vorgaenge SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${v.id} AND zustaendig_agent_id IS NULL`;
  } catch (e) {
    console.error(`[AUSKUNFT-LIEFERUNG] ${ref}: Aufgabe nicht angelegt:`, e);
    await todoMeldung(`auskunft-lieferung-ohne-auftrag:${ref}`, {
      titel: `Auskunft ${ref}: Anfragen angelegt, aber keine Aufgabe`,
      text: `Die Anfragen (${ids}) sind angelegt, die Aufgabe an den Betreuer konnte nicht angelegt werden. Bitte zuweisen.`,
      bereich: "pruefen", link: `/agent/app-vorgaenge/${vorgaenge[0].id}`,
    }, { name: "Auskunft-Lieferung", agentId: null }).catch(() => {});
  }

  // ── Der Verlauf der Akte ─────────────────────────────────────────────────
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, ${opts.von ?? "System"}, 'system',
            ${`Bonitätsauskunft: Lieferung gestartet — ${neu.length} ${neu.length === 1 ? "Anfrage" : "Anfragen"} an ${namenText(neu.map((v) => v.auskunftei))} angelegt (Vorgänge ${neu.map((v) => `#${v.id}`).join(", ")}). Mail „Bitte unterschreiben“: ${mail}. Aufgabe ${auftragId ? `#${auftragId}` : "fehlt"}.${widerruf.warten ? ` Übermittlung an die Auskunfteien erst ab ${widerruf.abText} (Beginn vor Ablauf der Widerrufsfrist nicht verlangt).` : ""}`})`
    .catch((e: unknown) => console.error("[AUSKUNFT-LIEFERUNG] Verlaufseintrag:", e));

  return { ...basis, mail, auftragId, text: `${neu.length} Anfragen angelegt (${ids}), Mail: ${mail}.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. EINGANG UND RÜCKFRAGE — die Mails aus dem Ergebnis eines Vorgangs
// ═══════════════════════════════════════════════════════════════════════════

interface VorgangLage {
  v: any;
  auskunftei: Auskunftei | null;
  kurz: string;
  ref: string | null;
  bestellung: any | null;
}

async function vorgangLage(vorgangId: number, lauf: Lauf): Promise<VorgangLage | null> {
  const [v] = (await lauf`SELECT id, person_id, art, stand, empfaenger_name FROM fiaon_vorgaenge WHERE id = ${vorgangId} LIMIT 1`) as any[];
  if (!v || String(v.art) !== "selbstauskunft") return null;
  const [d] = (await lauf`SELECT ref FROM fiaon_dokumente WHERE vorgang_id = ${vorgangId} AND art = 'schreiben_html' AND ref IS NOT NULL
                           ORDER BY hochgeladen_am DESC LIMIT 1`) as any[];
  // Die Bestellung der Auskunft: die, aus der der Vorgang entstand — sonst die jüngste bezahlte der Person.
  const [b] = (await lauf`
    SELECT ref, payment_reference, amount_due, pack_name, first_name, last_name, contact_name, email, contact_email, billing_email, person_id
      FROM fiaon_applications
     WHERE merged_into IS NULL AND (ref = ${d?.ref ?? ""} OR (person_id = ${Number(v.person_id)} AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')))
     ORDER BY (ref = ${d?.ref ?? ""}) DESC, (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
  const a = auskunfteiNachName(v.empfaenger_name);
  return { v, auskunftei: a, kurz: a?.kurz ?? (String(v.empfaenger_name ?? "").trim() || "der Auskunftei"), ref: b?.ref ?? d?.ref ?? null, bestellung: b ?? null };
}

/**
 * Schon einmal gemeldet? Die Marke steht im Verlauf der Akte (fiaon_contact_log) — dort, wo der Mensch sie auch sieht.
 * Gegenlesen 24.09.2026: nur in der Akte dieser Person suchen (Index person_id statt 59.000 Zeilen
 * LIKE), und die Marke steht nur an einem GESENDETEN Bescheid — ging die Mail nicht raus, schickt
 * das nächste Eintragen des Ergebnisses sie noch einmal, statt still „schon gemeldet" zu sagen.
 */
async function schonGemeldet(marke: string, personId: number, lauf: Lauf): Promise<boolean> {
  const [m] = (await lauf`SELECT 1 AS m FROM fiaon_contact_log WHERE person_id = ${personId} AND note LIKE ${`%${marke}%`} LIMIT 1`) as any[];
  return !!m;
}

async function nutzlastFuer(l: VorgangLage, lauf: Lauf): Promise<Record<string, unknown>> {
  const { makePayloadFromRow } = await import("../make-webhook");
  const personId = Number(l.v.person_id);
  const basis = l.bestellung ? makePayloadFromRow(l.bestellung) : { email: "", antrag_id: l.ref ?? undefined };
  const [p] = (await lauf`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  const vorname = p?.first_name || (basis as any).vorname || null;
  const nachname = p?.last_name || (basis as any).nachname || null;
  return { ...basis, person_id: personId, vorname, anrede: html(anredeMail({ vorname, nachname })), login_url: absoluteUrl("/app/vorgaenge") };
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER LIEFERUNG: DER SCHRITT ZUM PAKET (26.09.2026, E-243)
//
// Justin: „Ziel ist, die Bonitätsauskunft zu verkaufen UND ein Abo zu verkaufen
// — wenn nicht, auch gut, dann nur die Bonität." Wer die Auskunft OHNE
// laufendes Paket bekommen hat, liest in der ersten „Ihre Auskunft ist da" je
// Bestellung den Abschnitt „Ihr nächster Schritt zur Karte"
// (auskunftPaketSchrittSaetze, server/mail/vorlagen/auskunft-lead.ts), und sein
// Betreuer — sonst die Zuteilungsregel (auftragEmpfaenger) — bekommt EINE
// Aufgabe je Bestellung: „Auskunft geliefert — Auswertung besprechen und Paket
// anbieten". Wer das Angebot nicht bekommen darf (Sperre, Kündigung, Storno,
// Zahlung gemeldet), entscheidet auskunftPaketSchritt (fiaon-auskunft.ts).
// Beides hält die Lieferung nie auf.
// ═══════════════════════════════════════════════════════════════════════════

/** Die zwei Mail-Sätze — leer, wenn kein Angebot (laufendes Paket, Sperre) oder schon in einer früheren Mail dieser Bestellung. */
async function paketSchrittNutzlast(personId: number, ref: string, marke: string, lauf: Lauf): Promise<Record<string, string>> {
  try {
    const [frueher] = (await lauf`
      SELECT 1 AS da FROM fiaon_contact_log
       WHERE ref = ${ref} AND note LIKE ${`%${marke}%`} AND note NOT LIKE ${"%nicht gesendet%"} LIMIT 1`) as any[];
    if (frueher) return {};
    const { auskunftPaketSchritt } = await import("./fiaon-auskunft");
    const schritt = await auskunftPaketSchritt(personId, lauf);
    if (!schritt) return {};
    const { auskunftPaketSchrittSaetze } = await import("../mail/vorlagen/auskunft-lead");
    return auskunftPaketSchrittSaetze(schritt.variante, schritt.url);
  } catch (e) {
    console.error(`[AUSKUNFT-LIEFERUNG] ${ref}: Paket-Schritt für die Mail nicht bestimmbar — Mail ohne ihn:`, String((e as Error)?.message || e).slice(0, 200));
    return {};
  }
}

/** Die Aufgabe „Auswertung besprechen und Paket anbieten" — einmal je Auskunft-Bestellung. Rückgabe: ihre Nummer oder null. */
async function paketAngebotAufgabe(personId: number, ref: string, lauf: Lauf): Promise<number | null> {
  try {
    const schluessel = `auskunft-paket-angebot:${ref}`;
    const [da] = (await lauf`SELECT id FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel} LIMIT 1`.catch(() => [])) as any[];
    if (da?.id) return null;
    const { auskunftPaketSchritt } = await import("./fiaon-auskunft");
    const schritt = await auskunftPaketSchritt(personId, lauf);
    if (!schritt) return null;
    const [p] = (await lauf`SELECT TRIM(CONCAT_WS(' ', first_name, last_name)) AS name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [])) as any[];
    const wer = String(p?.name || "").trim() || "Der Kunde";
    const weg = schritt.variante === "antrag"
      ? `Ein fertiger Paket-Antrag wartet auf die erste Zahlung — Zahlungsseite: ${schritt.url}`
      : `Einen Paket-Antrag gibt es noch nicht — Antrag (ohne den Auskunft-Zusatz): ${schritt.url}`;
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const { werktageSpaeter } = await import("../routes/fiaon-app");
    const erg = await auftragFuerKunden({
      personId, ref, agentId: null, faelligAm: werktageSpaeter(1),
      titel: "Auskunft geliefert — Auswertung besprechen und Paket anbieten",
      text: `${wer} hat die Bonitätsauskunft (Bestellung ${ref}) bekommen, ein FIAON-Paket läuft nicht. Bitte: `
        + "1. anrufen und die Auswertung durchgehen — jeden Eintrag, die Fristen, Handlungsplan und Schreiben (das gehört zur gekauften Auskunft); "
        + "2. danach das Paket anbieten: feste Ansprechperson, Schreiben an die Auskunfteien, Antrag auf die passende Karte — "
        + "ohne Zusage, über die Karte entscheidet die Bank; kein Wunschlimit nennen; "
        + `3. Ergebnis im Verlauf eintragen. ${weg}`,
      schluessel, quelle: "bestellung", bereich: "pruefen",
      link: `/agent/kunden?person=${personId}`, autorName: "Auskunft-Lieferung",
      anlageText: "Angelegt von der Auskunft-Lieferung: Die Auskunft ist beim Kunden, ein Paket läuft nicht.",
    });
    if (erg?.id) {
      await lauf`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${personId}, NULL, 'Auskunft-Lieferung', 'system',
                ${`Bonitätsauskunft geliefert, kein laufendes Paket — Aufgabe #${erg.id} „Auswertung besprechen und Paket anbieten“${erg.agentName ? ` an ${erg.agentName}` : ""}.`})`
        .catch(() => {});
    }
    return erg?.id ?? null;
  } catch (e) {
    console.error(`[AUSKUNFT-LIEFERUNG] ${ref}: Aufgabe „Paket anbieten“ nicht angelegt:`, String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}

/**
 * Datenkopie eingegangen (Ergebnis „bewilligt" einer Anfrage auf Selbstauskunft):
 * Mail schufa_approved einmal je Vorgang und die Aufgabe „auswerten" an den Betreuer.
 */
export async function auskunftEingangMelden(vorgangId: number, wer: { von?: string; agentId?: number | null } = {}, lauf: Lauf = sqlPool): Promise<{ ok: boolean; mail: string }> {
  const l = await vorgangLage(vorgangId, lauf);
  if (!l || !l.ref) return { ok: false, mail: "kein_vorgang" };
  const marke = `[auskunft-eingang:${vorgangId}]`;
  const personId = Number(l.v.person_id);
  if (await schonGemeldet(marke, personId, lauf)) return { ok: true, mail: "schon_gemeldet" };
  // Wer steht noch aus? Die anderen Anfragen derselben Bestellung ohne Ergebnis.
  const rest = (await lauf`
    SELECT v.empfaenger_name FROM fiaon_vorgaenge v
     WHERE v.person_id = ${personId} AND v.art = 'selbstauskunft' AND v.id <> ${vorgangId}
       AND v.stand = ANY(${LAUFEND})
       AND EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.vorgang_id = v.id AND d.ref = ${l.ref})
     ORDER BY v.id ASC`) as any[];
  const restNamen = rest.map((r) => auskunfteiNachName(r.empfaenger_name)?.kurz ?? String(r.empfaenger_name ?? "")).filter(Boolean);
  const restSatz = restNamen.length
    ? `Von ${html(namenText(restNamen))} steht die Antwort noch aus — sobald sie da ist, sagen wir Ihnen Bescheid.`
    : "";
  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  // 26.09.2026 (E-243): ohne laufendes Paket „Ihr nächster Schritt zur Karte" — nur in der ersten Mail der Bestellung.
  const paketSchritt = await paketSchrittNutzlast(personId, l.ref, "[auskunft-eingang:", lauf);
  const versand = await sendMakeWebhookMitGrund("schufa_approved", {
    ...(await nutzlastFuer(l, lauf)) as any, auskunftei: html(l.kurz), rest_satz: restSatz, ...paketSchritt,
  }).catch((e) => ({ ok: false, grund: String(e) }));
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const { werktageSpaeter } = await import("../routes/fiaon-app");
  await auftragFuerKunden({
    personId, ref: l.ref, agentId: wer.agentId ?? null, faelligAm: werktageSpaeter(2),
    titel: `Auskunft auswerten: Datenkopie von ${l.kurz} ist da`,
    text: `Die Datenkopie von ${l.kurz} ist eingegangen (Vorgang #${vorgangId}, eingetragen von ${wer.von ?? "System"}). Bitte: 1. als Bonitätsauskunft in die Unterlagen der Akte übernehmen, falls noch nicht geschehen (startet die Analyse); 2. jeden Eintrag erklären, Speicherfristen prüfen, Handlungsplan und Schreiben zur Freigabe vorbereiten; 3. mit dem Kunden besprechen.`,
    schluessel: `auskunft-auswertung:${l.ref}`, quelle: "bestellung", bereich: "pruefen",
    link: `/agent/app-vorgaenge/${vorgangId}`, autorName: "Auskunft-Lieferung",
    anlageText: "Angelegt von der Auskunft-Lieferung: Eine Datenkopie ist eingegangen.",
  }).catch((e: unknown) => console.error("[AUSKUNFT-LIEFERUNG] Aufgabe Auswertung:", e));
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${l.ref}, ${personId}, ${wer.agentId ?? null}, ${wer.von ?? "System"}, 'system',
            ${`Bonitätsauskunft: Datenkopie von ${l.kurz} eingegangen (Vorgang #${vorgangId}). Mail „Ihre Datenkopie ist da“: ${versand.ok ? `gesendet. ${marke}` : `nicht gesendet (${(versand as any).grund ?? "?"}) — beim nächsten Eintragen des Ergebnisses wird sie erneut versucht.`}`})`;
  // 26.09.2026 (E-243): ohne laufendes Paket die Aufgabe „Auswertung besprechen und Paket anbieten" (einmal je Bestellung).
  await paketAngebotAufgabe(personId, l.ref, lauf);
  return { ok: versand.ok, mail: versand.ok ? "gesendet" : "fehlgeschlagen" };
}

/**
 * Rückfrage der Auskunftei (Ergebnis „abgelehnt"): Mail schufa_rejected mit dem
 * Satz des Mitarbeiters. Einmal je Vorgang UND Satz — ein neuer Satz ist eine
 * neue Nachricht, derselbe Satz zweimal nicht.
 */
export async function auskunftRueckfrageMelden(vorgangId: number, grund: string, wer: { von?: string; agentId?: number | null } = {}, lauf: Lauf = sqlPool): Promise<{ ok: boolean; mail: string }> {
  const l = await vorgangLage(vorgangId, lauf);
  if (!l || !l.ref) return { ok: false, mail: "kein_vorgang" };
  const satz = String(grund || "").trim();
  if (satz.length < 3) return { ok: false, mail: "ohne_grund" };
  const marke = `[auskunft-rueckfrage:${vorgangId}:${createHash("sha256").update(satz).digest("hex").slice(0, 10)}]`;
  if (await schonGemeldet(marke, Number(l.v.person_id), lauf)) return { ok: true, mail: "schon_gemeldet" };
  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  const versand = await sendMakeWebhookMitGrund("schufa_rejected", {
    ...(await nutzlastFuer(l, lauf)) as any, auskunftei: html(l.kurz), grund: html(satz),
  }).catch((e) => ({ ok: false, grund: String(e) }));
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${l.ref}, ${Number(l.v.person_id)}, ${wer.agentId ?? null}, ${wer.von ?? "System"}, 'system',
            ${`Bonitätsauskunft: Rückfrage von ${l.kurz} (Vorgang #${vorgangId}): „${satz.slice(0, 300)}“. Mail an den Kunden: ${versand.ok ? `gesendet. ${marke}` : `nicht gesendet (${(versand as any).grund ?? "?"}) — beim nächsten Eintragen des Ergebnisses wird sie erneut versucht.`}`})`;
  return { ok: versand.ok, mail: versand.ok ? "gesendet" : "fehlgeschlagen" };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DER RÜCKSTAND — bezahlt, aber kein Dokument (Stand 24.09.2026: 59)
//
// Dieselbe Zählung wie die Messung vom 24.09. (scratchpad bw8/lf3): je Person
// die jüngste bezahlte Auskunft; „Dokument da" heißt schufa_pdf an irgendeiner
// Zeile der Person (so liest es auch auskunftStand und die Analyse). Die Liste
// ist für die Chefbüro-Seite — angeschrieben wird hier niemand.
// ═══════════════════════════════════════════════════════════════════════════

export interface RueckstandZeile {
  personId: number;
  ref: string;
  name: string;
  land: AuskunftLand;
  /** „SCHUFA, CRIF und Creditreform Boniversum" */
  auskunfteien: string;
  art: AuskunftArt;
  betragCents: number | null;
  /** ISO — bezahlt am (sonst angelegt am). */
  gekauftAm: string;
  tageSeitKauf: number;
  betreuer: { id: number; name: string } | null;
  /** Stand der Lieferung: Anfragen aus dieser Bestellung bzw. offene der Person. */
  lieferung: { vorgaenge: number; staende: Record<string, number> };
  email: string | null;
  telefon: string | null;
}

export async function rueckstandListe(lauf: Lauf = sqlPool): Promise<RueckstandZeile[]> {
  const { produktkategorieSql } = await import("./fiaon-produktkategorie");
  const kat = produktkategorieSql("a");
  const zeilen = (await lauf.unsafe(`
    WITH kauf AS (
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, a.pack_key, a.amount_due, a.paid_at, a.created_at,
             a.assigned_agent_id, a.first_name, a.last_name, a.email, a.phone
        FROM fiaon_applications a
       WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.payment_status = 'paid' AND ${kat} = 'auskunft'
       ORDER BY a.person_id, a.paid_at DESC NULLS LAST, a.created_at DESC
    )
    SELECT k.person_id, k.ref, k.pack_key, k.amount_due, COALESCE(k.paid_at, k.created_at) AS gekauft_am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', k.first_name, k.last_name)), ''), k.ref) AS name,
           (SELECT x.country FROM fiaon_applications x WHERE x.person_id = k.person_id AND x.merged_into IS NULL AND x.country IS NOT NULL
             ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) AS land,
           ag.id AS agent_id, COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS agent_name,
           COALESCE(NULLIF(p.primary_email, ''), k.email) AS email, k.phone AS telefon,
           (SELECT COALESCE(json_object_agg(s.stand, s.n), '{}'::json) FROM (
              SELECT v.stand, COUNT(*)::int AS n FROM fiaon_vorgaenge v
               WHERE v.person_id = k.person_id AND v.art = 'selbstauskunft'
                 AND (EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.vorgang_id = v.id AND d.ref = k.ref)
                      OR v.stand IN ('entwurf', 'unterschrift_offen', 'versandbereit', 'versandt', 'nachfrage'))
               GROUP BY v.stand) s) AS staende
      FROM kauf k
      JOIN fiaon_persons p ON p.id = k.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, k.assigned_agent_id)
     WHERE p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = k.person_id AND d.schufa_pdf IS NOT NULL)
     ORDER BY COALESCE(k.paid_at, k.created_at) ASC`)) as any[];
  const jetzt = Date.now();
  return zeilen.map((z) => {
    const land = auskunftLand(z.land);
    const staende: Record<string, number> = typeof z.staende === "string" ? JSON.parse(z.staende) : (z.staende ?? {});
    const gekauft = new Date(z.gekauft_am);
    const art: AuskunftArt = [AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo].includes(String(z.pack_key ?? "").trim().toLowerCase()) ? "firma" : "privat";
    return {
      personId: Number(z.person_id), ref: String(z.ref), name: String(z.name), land,
      auskunfteien: auskunfteienText(land), art,
      betragCents: z.amount_due != null ? Math.round(Number(z.amount_due) * 100) : null,
      gekauftAm: gekauft.toISOString(), tageSeitKauf: Math.max(0, Math.floor((jetzt - gekauft.getTime()) / 86_400_000)),
      betreuer: z.agent_id ? { id: Number(z.agent_id), name: String(z.agent_name || "") } : null,
      lieferung: { vorgaenge: Object.values(staende).reduce((s, n) => s + Number(n || 0), 0), staende },
      email: z.email ? String(z.email) : null, telefon: z.telefon ? String(z.telefon) : null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. AN DER TÜR (make-webhook.ts): Zahlungsmails einer Auskunft, Sperren und
//    Nutzlast des Angebots
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zahlungsdaten und Zahlungsbestätigung: WAS wurde bestellt? Setzt
 * `produktkategorie` (auskunft | global | konto) aus der Bestellzeile und für
 * eine Auskunft das Land und seine Auskunfteien. Findet sie nichts, bleibt die
 * Nutzlast, wie sie ist.
 */
export async function auskunftMailAnreichern<T extends Record<string, unknown>>(payload: T, lauf: Lauf = sqlPool): Promise<T> {
  if (String(payload.produktkategorie ?? "").trim()) return payload;
  const ref = String(payload.antrag_id ?? "").trim();
  const zahlRef = String(payload.payment_reference ?? "").trim();
  if (!ref && !zahlRef) return payload;
  const [z] = (await lauf`
    SELECT ref, type, pack_key, country, person_id, created_at FROM fiaon_applications
     WHERE (${ref} <> '' AND ref = ${ref}) OR (${zahlRef} <> '' AND payment_reference = ${zahlRef})
     ORDER BY (ref = ${ref}) DESC LIMIT 1`) as any[];
  if (!z) return payload;
  const kat = produktkategorie(z);
  if (kat !== "auskunft") return { ...payload, produktkategorie: kat };
  let landRoh = z.country;
  if (!String(landRoh ?? "").trim() && z.person_id != null) {
    const [l] = (await lauf`SELECT country FROM fiaon_applications WHERE person_id = ${Number(z.person_id)} AND merged_into IS NULL AND country IS NOT NULL
                             ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    landRoh = l?.country ?? null;
  }
  const land = auskunftLand(landRoh);
  // Die Anrede-Regel des Hauses auch hier (shared/fiaon-anrede.ts): „Guten Tag maria," wird „Guten Tag Maria,".
  const vorname = nameFuerAnrede({ vorname: payload.vorname as string | null, nachname: payload.nachname as string | null }).vorname;
  // ── VERTRAGSBESTÄTIGUNG UND WIDERRUF (25.09.2026, E-240) ──────────────────
  // Die Zahlungsdaten-Mail trägt jetzt Vertragsbestätigung und Widerrufsbelehrung
  // (auskunftZahlungsdatenBaustein, server/mail/vorlagen/auskunft-lead.ts). Dafür
  // braucht sie: Art (Verbraucher bekommen die Belehrung, Unternehmen den Satz
  // „kein Widerrufsrecht"), das Bestelldatum und die dokumentierte Wahl zum Beginn
  // vor Fristablauf — dieselbe, die die Lieferung liest (auskunftWiderrufStand).
  const art: AuskunftArt = [AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo]
    .includes(String(z.pack_key ?? "").trim().toLowerCase()) ? "firma" : "privat";
  const angelegt = z.created_at ? new Date(z.created_at) : null;
  const wahl = art === "privat"
    ? await widerrufWahlFuerMail(String(z.ref), angelegt, lauf)
        .catch((): WiderrufStand => ({ warten: false, verlangt: null, ab: null, abText: null }))
    : null;
  // ── DER LIEFERWEG IN DER NUTZLAST (25.09.2026, E-241) ─────────────────────
  // Im Einkauf sagt die Zahlungsbestätigung „Wir beschaffen jetzt Ihre
  // Auskunft" (auskunftZahlungEingangBaustein) — und, wenn für die Bestellung
  // noch keine Vollmacht dokumentiert ist, dass der Link dazu in einer eigenen
  // Mail kommt. Dieselbe Prüfung wie die Beschaffung (auskunftEinwilligung).
  const modus = await auskunftLiefermodus(lauf);
  const einwilligung = modus !== "vollmacht" && z.person_id != null
    ? await auskunftEinwilligung(String(z.ref), Number(z.person_id), lauf).catch(() => null)
    : null;
  return {
    ...payload, produktkategorie: "auskunft", auskunft_land: land, auskunfteien: html(auskunfteienText(land)),
    ...(vorname ? { vorname: html(vorname) } : {}),
    auskunft_art: art,
    auskunft_liefermodus: modus,
    ...(einwilligung ? { auskunft_einwilligung: einwilligung.ja ? "ja" : "nein" } : {}),
    ...(angelegt && !Number.isNaN(angelegt.getTime()) ? { auskunft_bestellt_am: datumBerlin(angelegt) } : {}),
    ...(wahl ? {
      widerruf_wahl: wahl.verlangt === true ? "verlangt" : wahl.verlangt === false ? "nicht_verlangt" : "offen",
      ...(wahl.verlangt === false && wahl.abText ? { widerruf_ab: wahl.abText } : {}),
    } : {}),
  };
}

/** „25.09.2026" (Berlin) für ein Datum — nur über formatToParts (Zeit-Falle Berlin-Stunde). */
function datumBerlin(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const w = (a: string) => t.find((p) => p.type === a)?.value ?? "00";
  return `${w("day")}.${w("month")}.${w("year")}`;
}

/**
 * Die Wahl zum Beginn für die Zahlungsdaten-Mail (25.09.2026, E-240).
 *
 * Die Mail geht in bestellungFuerAntrag los, ohne await — die Wahl schreiben die
 * Türen erst DANACH in den Verlauf (Bestellseite: auskunftBestellungBelegen;
 * Kaufkarte und Kauflink: eigener Vermerk). Bei einer frischen Bestellung (unter
 * 60 Sekunden) wartet die Anreicherung deshalb kurz auf den Eintrag — höchstens
 * rund drei Sekunden. Niemand wartet mit: Der Versand läuft im Hintergrund, die
 * Antwort an den Browser ist längst raus. Kommt nichts (Bestellung durch den
 * Betreuer, Altbestand), bleibt die Wahl offen, und die Mail behauptet keine.
 */
async function widerrufWahlFuerMail(ref: string, angelegt: Date | null, lauf: Lauf): Promise<WiderrufStand> {
  const frisch = !!angelegt && Date.now() - angelegt.getTime() < 60_000;
  for (let versuch = 0; ; versuch++) {
    const stand = await auskunftWiderrufStand(ref, lauf);
    if (stand.verlangt !== null || !frisch || versuch >= 10) return stand;
    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * Was nur der Stand der Auskunft weiß (Tür in make-webhook.ts): bezahlt, Zahlung
 * gemeldet oder ein Dokument in der Akte — dann kein Angebot, auch nicht von
 * Hand. null = kein Hindernis aus dem Kauf. Ohne Person entscheidet die Bremse.
 */
export async function auskunftAngebotKaufstand(personId: number | null, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!personId) return null;
  const { auskunftStand } = await import("./fiaon-auskunft");
  const stand = await auskunftStand(personId, lauf, "privat", { land: false });
  if (stand.stufe === "bezahlt") return "Diese Person hat die Auskunft schon bezahlt — kein Angebot.";
  if (stand.stufe === "dokument") return "Für diese Person liegt schon eine Auskunft in der Akte — kein Angebot.";
  if (stand.offen?.status === "claimed_paid") return "Diese Person hat die Zahlung für die Auskunft schon gemeldet — kein Angebot.";
  // 26.09.2026 (E-243): Im Antrag zum Kundenpreis dazubestellt, das Bündel wartet auf die erste
  // Paketzahlung — ein Angebot zum Einzelpreis wäre ein Widerspruch (buendelWartet, fiaon-auskunft.ts).
  const { buendelWartet } = await import("./fiaon-auskunft");
  if (await buendelWartet(personId, lauf)) return "Diese Person hat die Auskunft im Antrag zum Kundenpreis dazubestellt (fällig nach der ersten Paketzahlung) — kein Angebot.";
  return null;
}

/**
 * Die Tür für das Angebot (make-webhook.ts): der Kaufstand und die Vertriebssperre.
 * Gegenlesen 24.09.2026: sperrUrteil (fiaon-mail-frequenz.ts) kennt Werbesperre,
 * Test, Kündigung und § 7 Abs. 3 UWG, aber nicht is_blocked — werbungVerboten
 * (dieselbe Datei) und damit Mara und die WhatsApp-Zentrale verkaufen an „kein
 * Interesse" nichts. Dieselbe Regel für die Werbe-Mail, auch von Hand: Will so
 * ein Mensch die Auskunft doch, bestellt der Betreuer sie direkt (auskunftBestellen).
 * Gemessen 24.09.2026: 1 Person mit ungekündigtem Paket, Vertriebssperre und ohne Werbesperre.
 */
export async function auskunftAngebotTuerSperre(personId: number | null, lauf: Lauf = sqlPool): Promise<string | null> {
  const kauf = await auskunftAngebotKaufstand(personId, lauf);
  if (kauf || !personId) return kauf;
  const { personSperre } = await import("./fiaon-mail-frequenz");
  const s = await personSperre(personId);
  if (s?.vertriebssperre) return "Vertriebssperre (kein Interesse) — kein Auskunft-Angebot, auch nicht von Hand.";
  // Gegenlesen 24.09.2026: Der Knopf der Mail führt auf die Kaufseite (fiaon-auskunft-kauf.ts),
  // und die nahm die Auskunft erst nach der ersten Zahlung für ein Paket an (angebotLage).
  // Integration 25.09.2026 (E-241): Die Kaufseite nimmt seitdem auch B und C an (kaufSperre) —
  // diese Tür gilt nur noch im Kreis „uwg" (angebotTuerSperre, fiaon-auskunft-verkauf.ts), und dort
  // geht die Werbe-Mail nur an zahlende Kunden. Der Satz sagt deshalb den Kreis, nicht die Kaufseite.
  const { angebotLage } = await import("../routes/fiaon-auskunft-kauf");
  if (!(await angebotLage(personId, lauf)).paketBezahlt) {
    return "Noch keine Zahlung für ein Paket — im Kreis „uwg“ geht das Angebot per Mail nur an zahlende Kunden. Kein Angebot per Mail.";
  }
  return null;
}

/**
 * Darf das Angebot der Auskunft an diesen Menschen? null = ja, sonst der Grund
 * im Klartext — für den Verkaufstakt und den Knopf in der Akte, BEVOR sie eine
 * Nutzlast bauen. Eine Regel, zwei Quellen, keine dritte Fassung:
 *   · der Kauf, die Vertriebssperre und die bezahlte erste Paketzahlung
 *     (auskunftAngebotTuerSperre, hier — dieselbe Funktion, die an der Tür in
 *     make-webhook.ts entscheidet),
 *   · Werbesperre, Testkonto, Kündigung/Vertragsende und § 7 Abs. 3 UWG
 *     (automatisch nur an Kunden, deren Antrag den Widerspruchs-Hinweis trug —
 *     ab 02.09.2026 12:35): sperrUrteil in fiaon-mail-frequenz.ts, dieselbe
 *     Funktion, die an der Tür entscheidet.
 */
export async function auskunftAngebotSperre(
  personId: number | null, opts: { manuell?: boolean } = {}, lauf: Lauf = sqlPool,
): Promise<string | null> {
  // Integration 25.09.2026 (E-241): EINE Regel — die des Verkaufstakts (angebotSperre in
  // fiaon-auskunft-verkauf.ts: diese Tür bzw. die Grundmenge je nach Kreis, immerSperre und
  // sperrUrteil mit dem Kreis der Einstellung). Vorher fragte diese Funktion den Kreis nicht und
  // hätte im Kreis „alle" einem Antrag oder Lead von Hand abgesagt, den die Tür im Mail-Motor durchlässt.
  if (!personId) return "Angebot der Auskunft nur an bekannte Kunden — ohne Person nicht.";
  const { angebotSperre } = await import("./fiaon-auskunft-verkauf");
  return angebotSperre(personId, { manuell: opts.manuell === true }, lauf);
}

/**
 * Die Nutzlast des Angebots für einen Menschen — Preis vom Server
 * (auskunftPreis: 74 € mit laufendem Paket, sonst 149 €; Firma 199/349 €),
 * Land und Auskunfteien aus der Akte, Fassung im Wechsel nach dem Protokoll.
 * Aufrufer: der Verkaufstakt und der Knopf in der Akte (als `zusatz` an mailSenden).
 * null = keine Adresse.
 */
export async function auskunftAngebotNutzlast(personId: number, opts: { art?: AuskunftArt } = {}, lauf: Lauf = sqlPool): Promise<Record<string, unknown> | null> {
  const { auskunftStand, auskunftPreis } = await import("./fiaon-auskunft");
  const { angebotNutzlastBauen } = await import("../mail/vorlagen/auskunft-verkauf");
  const art = opts.art ?? "privat";
  const [p] = (await lauf`
    SELECT p.first_name, p.last_name,
           COALESCE(NULLIF(TRIM(p.primary_email), ''), (SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1)) AS email,
           (SELECT COUNT(*)::int FROM fiaon_mail_log m WHERE m.person_id = p.id AND m.event = 'auskunft_angebot' AND m.status = 'versandt') AS bisher
      FROM fiaon_persons p WHERE p.id = ${personId} LIMIT 1`) as any[];
  if (!p?.email) return null;
  const stand = await auskunftStand(personId, lauf, art);
  const preis = await auskunftPreis(personId, art, lauf);
  let kaufUrl = absoluteUrl("/app");
  try {
    const kauf = await import("../routes/fiaon-auskunft-kauf");
    kaufUrl = kauf.kaufLink(personId, art);
  } catch (e) {
    console.error("[AUSKUNFT-ANGEBOT] Kauflink nicht baubar — Rückfall auf den Kundenbereich:", e);
  }
  const { abmeldeLinkPerson } = await import("../routes/fiaon-abmelden");
  return {
    ...angebotNutzlastBauen({
      email: String(p.email), personId, vorname: p.first_name ?? null, nachname: p.last_name ?? null,
      land: stand.land, mitAbo: preis.mitAbo, preisCents: preis.cents, art,
      kaufUrl, uploadUrl: absoluteUrl("/app/unterlagen"), abmeldeUrl: abmeldeLinkPerson(personId),
      bisherGesendet: Number(p.bisher || 0),
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. BIS ZUR API KAUFEN WIR SIE SELBST — DIE BESCHAFFUNG (25.09.2026, E-241)
//
// Justin (25.09.2026): „Ich kümmere mich heute um die API, bis dahin kaufen
// wir sie selbst."
//
// ── DER LIEFERWEG (fiaon_settings.auskunft_liefermodus) ───────────────────
//   einkauf   (Standard) — nach der Zahlung entsteht ein Beschaffungsauftrag
//             statt der Anfragen. Ein Mensch beschafft die Auskunft und lädt
//             sie im Chefbüro hoch (/chef/s/auskunft-beschaffung): Ablage als
//             Auskunft-Dokument der Person, Analyse, Mail „Ihre Auskunft ist da".
//   vollmacht — der Weg vom 24.09. (Abschnitte 1 und 2), unverändert.
//   api       — wie einkauf, dazu der Abruf über fiaon-auskunft-quelle.ts.
//             Ist die Schnittstelle nicht angebunden oder scheitert sie,
//             bleibt der Auftrag im Einkauf — mit dem Grund am Auftrag.
//
// ── DIE EINWILLIGUNG ──────────────────────────────────────────────────────
// Beschafft (und über die API abgerufen) wird nur, wenn für die Bestellung
// eine Einwilligung DOKUMENTIERT ist — in dieser Reihenfolge gelesen:
//   · der BESCHAFFUNGSAUFTRAG (25.09.2026, E-241): der Vermerk
//     AUSKUNFT_BESCHAFFUNG_VERMERK im Verlauf der Bestellung (Quelle
//     „auftrag"). Ihn schreibt jede Kauftür mit dem Pflicht-Haken
//     AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT — Bestellseite, Kauflink, Kaufkarte —
//     und die Bestätigungsseite nach der Zahlung (/api/fiaon/auskunft/auftrag/
//     :token, fiaon-auskunft-kauf.ts). NUR er deckt den KAUF einer
//     (kostenpflichtigen) Auskunft im Namen des Kunden.
//   · eine unterschriebene, gültige Vollmacht mit der Zeile „Selbstauskunft"
//     (fiaon_vollmachten — der Unterschriftsweg aus fiaon-app-antraege.ts),
//   · der Haken „Vollmacht zur Übermittlung" der Bestellseite bis Fassung
//     2026-09-25 (auskunftBestellungBelegen: Verlaufseintrag „[angekreuzt …]
//     vollmacht_uebermittlung:" und consent_schufa an der Bestellung),
//   · der Vermerk AUSKUNFT_VOLLMACHT_VERMERK im Verlauf der Bestellung.
// Die drei letzten decken nur die Übermittlung der KOSTENLOSEN Datenkopie
// (Art. 15 DSGVO) — sie schließen aus, im Namen des Kunden Verträge zu
// schließen (Befund der Beschaffungs-Prüfer, 25.09.2026). Sie gelten weiter als
// Einwilligung (Auftrag E-241: „auch"), der Arbeitsplatz sagt aber dazu, dass
// damit keine kostenpflichtige Auskunft gekauft werden darf.
// „AUSDRÜCKLICH VERLANGT" ist KEINE Einwilligung, sondern die Wahl zum Beginn
// vor Fristablauf; sie bestimmt nur `faellig_ab`. Bestellungen von Mara, vom
// Betreuer und alle Altbestellungen stehen auf „Einwilligung fehlt". Dann geht
// nach der Zahlung einmal der Link zur AUFTRAGSBESTÄTIGUNG hinaus
// (schufa_requested im Einkauf; bis 25.09.2026 war es der Link zur Vollmacht
// auf /app/unterschrift, der alle sieben Antragsarten vorhakte), und der Knopf
// „Auftragsbestätigung senden" schickt ihn erneut. Der Vollmacht-Weg
// (Liefermodus „vollmacht") bleibt unverändert.
//
// ── FÄLLIG AB ─────────────────────────────────────────────────────────────
// Dieselbe Regel wie die Anforderung im Vollmacht-Weg (Abschnitt 0): Hat der
// Kunde den Beginn vor Ablauf der Widerrufsfrist nicht verlangt, erst ab dem
// Tag nach dem Fristende. Ohne dokumentierte Wahl gilt der bisherige Weg
// (sofort); Unternehmen haben kein Widerrufsrecht.
//
// ── IDEMPOTENZ ────────────────────────────────────────────────────────────
// Ein Auftrag je Bestellung (eindeutiger Index auf ref, ON CONFLICT DO
// NOTHING): Ein zweiter Buchungsweg legt nichts doppelt an und schickt keine
// zweite Mail. Die Mail „Ihre Auskunft ist da" trägt eine Marke je Auftrag und
// gelieferter Auskunftei im Verlauf der Akte — nur an einer GESENDETEN Mail.
// ═══════════════════════════════════════════════════════════════════════════

export type AuskunftLiefermodus = "einkauf" | "vollmacht" | "api";
export const LIEFERMODUS_SCHLUESSEL = "auskunft_liefermodus";
export const LIEFERMODI: readonly AuskunftLiefermodus[] = ["einkauf", "vollmacht", "api"];

export function istLiefermodus(v: unknown): v is AuskunftLiefermodus {
  return (LIEFERMODI as readonly string[]).includes(String(v));
}

/** Der Lieferweg. Ohne Eintrag oder bei einer Störung: Einkauf (nichts geht dabei von selbst an Auskunfteien). */
export async function auskunftLiefermodus(lauf: Lauf = sqlPool): Promise<AuskunftLiefermodus> {
  try {
    const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${LIEFERMODUS_SCHLUESSEL} LIMIT 1`) as any[];
    // Integration 25.09.2026 (E-241): klein geschrieben wie verkaufEinstellungen (fiaon-auskunft-verkauf.ts) —
    // sonst zeigte die Chefseite „API", während die Lieferung bei „Api" still im Einkauf bliebe.
    const v = String(r?.value ?? "").trim().toLowerCase();
    return istLiefermodus(v) ? v : "einkauf";
  } catch (e) {
    console.error("[AUSKUNFT-BESCHAFFUNG] Liefermodus nicht lesbar — es gilt der Einkauf:", String((e as Error)?.message || e).slice(0, 160));
    return "einkauf";
  }
}

/**
 * Der Satz, an dem die Beschaffung eine anderswo eingeholte Vollmacht erkennt
 * (Verlauf der Bestellung). Wer eine Tür baut, die die Vollmacht zur
 * Übermittlung selbst abfragt, schreibt ihn wortgleich in fiaon_contact_log
 * (ref = die Bestellung der Auskunft).
 */
export const AUSKUNFT_VOLLMACHT_VERMERK = "Vollmacht zur Übermittlung ERTEILT";

export type BeschaffungStatus = "offen" | "in_arbeit" | "hochgeladen" | "fertig" | "problem";
export const BESCHAFFUNG_STATUS: readonly BeschaffungStatus[] = ["offen", "in_arbeit", "hochgeladen", "fertig", "problem"];

let beschaffungBereit: Promise<void> | null = null;
/** Die Tabelle der Beschaffungsaufträge — idempotent, wie die übrigen ensure…-Funktionen des Hauses. */
export function ensureBeschaffungTabelle(): Promise<void> {
  if (!beschaffungBereit) {
    beschaffungBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_auskunft_beschaffung (
          id BIGSERIAL PRIMARY KEY,
          ref TEXT NOT NULL,
          person_id BIGINT NOT NULL,
          land TEXT NOT NULL,
          art TEXT NOT NULL DEFAULT 'privat',
          status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','in_arbeit','hochgeladen','fertig','problem')),
          faellig_ab DATE NOT NULL,
          quelle TEXT NOT NULL DEFAULT 'zahlung',
          modus TEXT NOT NULL DEFAULT 'einkauf',
          bearbeiter TEXT,
          bearbeiter_id BIGINT,
          uebernommen_am TIMESTAMPTZ,
          notiz TEXT,
          geliefert TEXT NOT NULL DEFAULT '',
          letzte_lieferung TEXT NOT NULL DEFAULT '',
          dokument_ref TEXT,
          hochgeladen_am TIMESTAMPTZ,
          hochgeladen_von TEXT,
          mail_status TEXT,
          mail_am TIMESTAMPTZ,
          vollmacht_link_am TIMESTAMPTZ,
          vollmacht_link_anzahl INTEGER NOT NULL DEFAULT 0,
          api_versuch_am TIMESTAMPTZ,
          api_fehler TEXT,
          aufgabe_id BIGINT,
          fertig_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_auskunft_beschaffung_ref_idx ON fiaon_auskunft_beschaffung (ref)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_auskunft_beschaffung_status_idx ON fiaon_auskunft_beschaffung (status, faellig_ab)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_auskunft_beschaffung_person_idx ON fiaon_auskunft_beschaffung (person_id)`;
    })().catch((e) => { beschaffungBereit = null; throw e; });
  }
  return beschaffungBereit;
}

// ── Was beschafft wird ──────────────────────────────────────────────────────

export interface BeschaffungStelle {
  /** Schlüssel aus shared/fiaon-auskunft.ts (AUSKUNFTEIEN), dazu „firma". */
  key: string;
  kurz: string;
  name: string;
  anschrift: string | null;
  /** So steht sie in der Mail an den Kunden. */
  mailName: string;
}

const FIRMA_STELLE: BeschaffungStelle = {
  key: "firma", kurz: "Firmenauskunft", name: "Wirtschaftsauskunft des Unternehmens (Wirtschaftsauskunfteien, z. B. Creditreform, CRIF)",
  anschrift: null, mailName: "die Firmenauskunft Ihres Unternehmens",
};

/** Die Auskunfteien des Landes — bei der Firmen-Auskunft dazu die Wirtschaftsauskunft des Unternehmens. */
export function beschaffungStellen(land: AuskunftLand, art: AuskunftArt): BeschaffungStelle[] {
  const liste = auskunfteienFuer(land).map((a) => ({ key: a.key, kurz: a.kurz, name: a.name, anschrift: a.anschrift.join(", "), mailName: a.kurz }));
  return art === "firma" ? [...liste, FIRMA_STELLE] : liste;
}

const keyListe = (s: unknown): string[] => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const keyText = (l: string[]): string => Array.from(new Set(l)).sort().join(",");
const heuteBerlin = (): string => berlinTag(new Date()).toISOString().slice(0, 10);

/** Ab wann beschafft werden darf — Abschnitt 0, dieselbe Regel wie im Vollmacht-Weg. */
async function faelligFuer(ref: string, art: AuskunftArt, lauf: Lauf): Promise<{ iso: string; widerruf: WiderrufStand }> {
  const heute = heuteBerlin();
  const leer: WiderrufStand = { warten: false, verlangt: null, ab: null, abText: null };
  if (art === "firma") return { iso: heute, widerruf: leer };
  const w = await auskunftWiderrufStand(ref, lauf).catch(() => leer);
  return { iso: w.verlangt === false && w.ab && w.ab > heute ? w.ab : heute, widerruf: w };
}

// ── Die Einwilligung ────────────────────────────────────────────────────────

export interface AuskunftEinwilligung {
  ja: boolean;
  /** E-241: „auftrag" = Beschaffungsauftrag (deckt auch den Kauf); die übrigen nur die kostenlose Datenkopie. */
  quelle: "auftrag" | "vollmacht" | "bestellseite" | "vermerk" | null;
  /** Für den Arbeitsplatz: woher sie kommt. */
  text: string;
  vollmachtId: number | null;
}

const OHNE_EINWILLIGUNG: AuskunftEinwilligung = {
  ja: false, quelle: null, vollmachtId: null,
  text: "Kein Beschaffungsauftrag dokumentiert (Betreuer, Mara, Altbestellung oder Auftrag noch nicht bestätigt).",
};

/**
 * Der Zusatz an einer Einwilligung, die nur die kostenlose Datenkopie deckt
 * (25.09.2026, E-241) — damit am Arbeitsplatz niemand mit einer Vollmacht zur
 * Übermittlung eine kostenpflichtige Auskunft im Namen des Kunden kauft.
 */
const NUR_DATENKOPIE = " Deckt nur die kostenlose Datenkopie (Art. 15), keinen Kauf in seinem Namen — dafür „Auftragsbestätigung senden“.";
/** Die Zeile, die auskunftBestellungBelegen (fiaon-auskunft.ts) für den angekreuzten Haken schreibt. */
const BESTELLSEITE_HAKEN = /\[angekreuzt[^\]]*\]\s*vollmacht_uebermittlung:/;

/** Die Einwilligungen vieler Bestellungen in drei Abfragen (für die Liste des Arbeitsplatzes). */
export async function auskunftEinwilligungen(liste: { ref: string; personId: number }[], lauf: Lauf = sqlPool): Promise<Map<string, AuskunftEinwilligung>> {
  const erg = new Map<string, AuskunftEinwilligung>();
  if (!liste.length) return erg;
  const refs = Array.from(new Set(liste.map((l) => String(l.ref))));
  const personen = Array.from(new Set(liste.map((l) => Number(l.personId)).filter((n) => Number.isInteger(n) && n > 0)));

  // 1. Die unterschriebene Vollmacht mit der Zeile „Selbstauskunft" — umfang ist jsonb,
  //    gelesen als Text (die Hausfalle „jsonb als Text"), nie per Cast.
  const vollmacht = new Map<number, AuskunftEinwilligung>();
  try {
    const [t] = (await lauf`SELECT to_regclass('fiaon_vollmachten') IS NOT NULL AS da`) as any[];
    if (t?.da && personen.length) {
      const zeilen = (await lauf`
        SELECT DISTINCT ON (person_id) person_id, id, to_char(signed_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY') AS am,
               to_char(gueltig_bis, 'DD.MM.YYYY') AS bis
          FROM fiaon_vollmachten
         WHERE person_id = ANY(${personen}::bigint[]) AND status = 'unterschrieben' AND widerrufen_am IS NULL
           AND gueltig_bis >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
           AND (CASE WHEN jsonb_typeof(umfang) = 'string' THEN umfang #>> '{}' ELSE umfang::text END) LIKE ${'%"selbstauskunft"%'}
         ORDER BY person_id, signed_at DESC`) as any[];
      for (const v of zeilen) {
        vollmacht.set(Number(v.person_id), {
          ja: true, quelle: "vollmacht", vollmachtId: Number(v.id),
          text: `Vollmacht Nr. ${v.id} unterschrieben am ${v.am ?? "?"}, gilt bis ${v.bis ?? "?"}.${NUR_DATENKOPIE}`,
        });
      }
    }
  } catch (e) {
    console.error("[AUSKUNFT-BESCHAFFUNG] Vollmachten nicht lesbar:", String((e as Error)?.message || e).slice(0, 160));
  }

  // 2. Bestellseite (Haken + consent_schufa an der Auskunft-Bestellung), 3. der Vermerk
  //    und — seit 25.09.2026 (E-241) zuerst — der Beschaffungsauftrag.
  const haken = new Map<string, string>();
  const vermerk = new Set<string>();
  const consent = new Set<string>();
  const auftrag = new Map<string, { am: string; weg: string }>();
  const bestellungen = (await lauf`
    SELECT ref, consent_schufa FROM fiaon_applications
     WHERE ref = ANY(${refs}) AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')`) as any[];
  for (const b of bestellungen) if (b.consent_schufa === true) consent.add(String(b.ref));
  const notizen = (await lauf`
    SELECT ref, note, to_char(created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY') AS am FROM fiaon_contact_log
     WHERE ref = ANY(${refs}) AND voided_at IS NULL
       AND (note LIKE ${"%vollmacht_uebermittlung:%"} OR note LIKE ${`%${AUSKUNFT_VOLLMACHT_VERMERK}%`}
            OR note LIKE ${`${AUSKUNFT_BESCHAFFUNG_VERMERK}%`})
     ORDER BY created_at DESC`) as any[];
  for (const n of notizen) {
    const r = String(n.ref);
    const note = String(n.note);
    if (BESTELLSEITE_HAKEN.test(note) && !haken.has(r)) haken.set(r, String(n.am ?? ""));
    if (note.includes(AUSKUNFT_VOLLMACHT_VERMERK)) vermerk.add(r);
    // Der Vermerk beginnt mit der Marke (beschaffungsauftragVermerken) — „… über den Kauflink der E-Mail am …".
    if (note.startsWith(AUSKUNFT_BESCHAFFUNG_VERMERK)) {
      const weg = note.slice(AUSKUNFT_BESCHAFFUNG_VERMERK.length).match(/^\s*(.+?) am \d{2}\.\d{2}\.\d{4}/)?.[1] ?? "";
      auftrag.set(r, { am: String(n.am ?? ""), weg });
    }
  }

  for (const l of liste) {
    const a = auftrag.get(l.ref);
    if (a) {
      erg.set(l.ref, {
        ja: true, quelle: "auftrag", vollmachtId: null,
        text: `Beschaffungsauftrag erteilt${a.weg ? ` ${a.weg}` : ""}${a.am ? ` am ${a.am}` : ""} — deckt auch den Kauf einer kostenpflichtigen Auskunft.`,
      });
      continue;
    }
    const v = vollmacht.get(Number(l.personId));
    if (v) { erg.set(l.ref, v); continue; }
    if (haken.has(l.ref) || consent.has(l.ref)) {
      erg.set(l.ref, {
        ja: true, quelle: "bestellseite", vollmachtId: null,
        text: `Vollmacht zur Übermittlung auf der Bestellseite angekreuzt${haken.get(l.ref) ? ` (${haken.get(l.ref)})` : ""}.${NUR_DATENKOPIE}`,
      });
      continue;
    }
    if (vermerk.has(l.ref)) {
      erg.set(l.ref, { ja: true, quelle: "vermerk", vollmachtId: null, text: `Vollmacht zur Übermittlung im Verlauf der Bestellung vermerkt.${NUR_DATENKOPIE}` });
      continue;
    }
    erg.set(l.ref, OHNE_EINWILLIGUNG);
  }
  return erg;
}

/** Die Einwilligung einer Bestellung. Bei einer Störung: „fehlt" (lieber ein Link zu viel als ein Kauf ohne Vollmacht). */
export async function auskunftEinwilligung(ref: string, personId: number, lauf: Lauf = sqlPool): Promise<AuskunftEinwilligung> {
  try {
    return (await auskunftEinwilligungen([{ ref, personId }], lauf)).get(ref) ?? OHNE_EINWILLIGUNG;
  } catch (e) {
    console.error(`[AUSKUNFT-BESCHAFFUNG] ${ref}: Einwilligung nicht prüfbar — gilt als fehlend:`, String((e as Error)?.message || e).slice(0, 160));
    return OHNE_EINWILLIGUNG;
  }
}

// ── Einen Auftrag anlegen ───────────────────────────────────────────────────

const MODUS_TEXT: Record<AuskunftLiefermodus, string> = {
  einkauf: "Einkauf von Hand", vollmacht: "Anfragen per Vollmacht", api: "Abruf über die API",
};
const LAND_TEXT: Record<AuskunftLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

/** Die Aufgabe für die Beschaffung schließen — nichts löschen, nur „erledigt" mit Grund (Muster fiaon-app-antraege.ts). */
async function beschaffungsAufgabeSchliessen(ref: string, ergebnis: string, lauf: Lauf): Promise<void> {
  await lauf`
    UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, ${ergebnis}), updated_at = NOW()
     WHERE schluessel = ${`auskunft-beschaffung:${ref}`} AND status <> 'erledigt'`.catch(() => {});
}

/**
 * Nach der Zahlung (lieferungStarten, Liefermodus einkauf/api): den Auftrag
 * anlegen, fehlt die Vollmacht den Link dazu schicken, die Aufgabe an die
 * Beschaffung stellen und — über die API — gleich abrufen. Idempotent.
 */
async function beschaffungStarten(
  ein: { z: any; personId: number; art: AuskunftArt; modus: AuskunftLiefermodus; opts: { mail?: boolean; von?: string } },
  lauf: Lauf,
): Promise<LieferungErgebnis> {
  const { z, personId, art, modus, opts } = ein;
  const ref = String(z.ref);
  await ensureBeschaffungTabelle();
  let landRoh = z.country;
  if (!String(landRoh ?? "").trim()) {
    const [l] = (await lauf`SELECT country FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND country IS NOT NULL
                             ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    landRoh = l?.country ?? null;
  }
  const land = auskunftLand(landRoh);
  const faellig = await faelligFuer(ref, art, lauf);
  const quelle = opts.von ? "hand" : "zahlung";
  const [neu] = (await lauf`
    INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus)
    VALUES (${ref}, ${personId}, ${land}, ${art}, ${faellig.iso}, ${quelle}, ${modus})
    ON CONFLICT (ref) DO NOTHING
    RETURNING id`) as any[];
  const basis: LieferungErgebnis = {
    ok: true, grund: null, text: "", ref, personId, land, vorgaenge: [], neuAngelegt: 0, mail: "nicht_noetig", auftragId: null, beschaffung: null,
  };
  if (!neu) {
    const [da] = (await lauf`SELECT id, status, to_char(faellig_ab, 'YYYY-MM-DD') AS faellig_ab, aufgabe_id FROM fiaon_auskunft_beschaffung WHERE ref = ${ref}`) as any[];
    const e = await auskunftEinwilligung(ref, personId, lauf);
    return {
      ...basis, auftragId: da?.aufgabe_id != null ? Number(da.aufgabe_id) : null,
      beschaffung: { id: Number(da?.id), neu: false, status: String(da?.status), faelligAb: String(da?.faellig_ab), einwilligung: e.ja, modus },
      text: `Beschaffungsauftrag #${da?.id} zu ${ref} besteht schon (${da?.status}) — nichts doppelt angelegt.`,
    };
  }
  const id = Number(neu.id);
  const einw = await auskunftEinwilligung(ref, personId, lauf);
  const bei = auskunfteienText(land);
  const faelligText = isoDeutsch(faellig.iso);
  const warten = faellig.iso > heuteBerlin();

  // ── Der Auftrag, wenn er fehlt (25.09.2026, E-241) ──────────────────────
  // Vorher ging hier der Link zur Vollmacht (/app/unterschrift) hinaus — die deckt
  // nur die kostenlose Datenkopie, nicht den Kauf, und hakte alle sieben
  // Antragsarten vor. Jetzt: der Link zur Auftragsbestätigung (auftragLinkSenden).
  let mail: LieferungErgebnis["mail"] = "nicht_noetig";
  // Gegenlesen 25.09.2026 (E-241): der Grund eines nicht gesendeten Links in die Aufgabe —
  // „ging NICHT raus“ allein sagte der Beschaffung nicht, ob ein zweiter Klick hilft.
  let linkGrund = "";
  if (!einw.ja) {
    if (opts.mail === false) mail = "aus";
    else {
      const v = await auftragLinkSenden(id, { name: opts.von ?? "Auskunft-Lieferung", agentId: null }, {}, lauf)
        .catch((e): AuftragLinkErgebnis => { console.error(`[AUSKUNFT-BESCHAFFUNG] ${ref}: Link zur Auftragsbestätigung:`, e); return { ok: false, mail: "fehlgeschlagen", text: String((e as Error)?.message || e) }; });
      mail = v.mail;
      if (!v.ok) linkGrund = v.text;
    }
  }

  // ── Die Stammdaten für die Aufgabe (Anschrift fehlt?) ────────────────────
  const antraege = await import("../routes/fiaon-app-antraege");
  const kunde = await antraege.kundeLaden(personId).catch(() => null);
  const name = kunde?.name || [z.first_name, z.last_name].filter(Boolean).join(" ") || ref;
  const anschriftFehlt = !kunde || !kunde.daten.strasse || !kunde.daten.plz || !kunde.daten.ort;

  // ── Über die API: gleich abrufen, sonst zurück in den Einkauf ────────────
  let apiSatz = "";
  let apiJetzt = false;
  if (modus === "api") {
    const { auskunftApiAngebunden } = await import("./fiaon-auskunft-quelle");
    // 25.09.2026 (E-241): Ein Abruf über die API ist ein Kauf im Namen des Kunden — dafür reicht nur der
    // Beschaffungsauftrag, nicht die Vollmacht zur Übermittlung (die deckt nur die kostenlose Datenkopie).
    if (einw.quelle !== "auftrag") apiSatz = " Abruf über die API erst mit bestätigtem Beschaffungsauftrag.";
    else if (warten) apiSatz = ` Abruf über die API ab dem ${faelligText} (Widerrufsfrist) — im Chefbüro „Fällige über die API abrufen".`;
    else if (!auskunftApiAngebunden()) {
      await lauf`UPDATE fiaon_auskunft_beschaffung SET api_versuch_am = NOW(), api_fehler = ${"API noch nicht angebunden — bitte von Hand beschaffen."}, updated_at = NOW() WHERE id = ${id}`;
      apiSatz = " Die API ist noch nicht angebunden — der Auftrag bleibt im Einkauf von Hand.";
    } else {
      // Der Abruf startet erst unten, NACH Aufgabe und Verlauf (Gegenlesen 25.09.2026): Eine
      // schnelle Antwort schlösse sonst eine Aufgabe, die es noch nicht gibt — sie bliebe danach offen.
      apiJetzt = true;
      apiSatz = " Abruf über die API läuft.";
    }
  }

  // ── Die Aufgabe an die Beschaffung (Betreiber-Brett) ─────────────────────
  const mailSatz = einw.ja
    ? `Einwilligung: ${einw.text}`
    : mail === "gesendet" ? "Einwilligung FEHLT — der Kunde hat per Mail den Link zur Auftragsbestätigung bekommen. Erst nach seiner Bestätigung beschaffen."
      : mail === "aus" ? "Einwilligung FEHLT — ohne Mail angelegt. Im Chefbüro „Auftragsbestätigung senden“ — im Gespräch den Kunden bitten, den Link zu bestätigen."
        : `Einwilligung FEHLT — die Mail mit dem Link zur Auftragsbestätigung ging NICHT raus${linkGrund ? ` (${linkGrund})` : ""}. Im Chefbüro „Auftragsbestätigung senden“ — im Gespräch den Kunden bitten, den Link zu bestätigen.`;
  let aufgabeId: number | null = null;
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId, ref, anBetreiber: true, faelligAm: faellig.iso,
      titel: `Auskunft beschaffen: ${name} (${LAND_TEXT[land]}${art === "firma" ? ", Firma" : ""})`,
      text: `Bezahlt: Bonitätsauskunft ${ref}${z.amount_due != null ? ` (${euroText(Math.round(Number(z.amount_due) * 100))})` : ""}. Beschaffen bei ${bei}${art === "firma" ? " und die Wirtschaftsauskunft des Unternehmens" : ""}. `
        + `Fällig ab ${faelligText}${warten ? " — der Kunde hat den Beginn vor Ablauf der Widerrufsfrist nicht verlangt, vorher NICHT anfordern" : ""}.\n\n${mailSatz}`
        + `${anschriftFehlt ? "\n\nACHTUNG: In der Akte fehlt die Anschrift — erst erfragen, ohne sie ordnet keine Auskunftei zu." : ""}${apiSatz ? `\n\n${apiSatz.trim()}` : ""}\n\n`
        + "Arbeitsplatz: Chefbüro › Auskunft-Beschaffung — dort stehen alle Daten zum Bestellen. Der Upload legt die Auskunft in die Akte, startet die Analyse und schreibt dem Kunden „Ihre Auskunft ist da“.",
      schluessel: `auskunft-beschaffung:${ref}`, quelle: "bestellung", bereich: "pruefen",
      link: "/chef/s/auskunft-beschaffung", autorName: "Auskunft-Beschaffung",
      anlageText: `Angelegt von der Auskunft-Lieferung nach der Zahlung (${ref}, ${MODUS_TEXT[modus]}).`,
    });
    aufgabeId = erg.id;
    if (aufgabeId) await lauf`UPDATE fiaon_auskunft_beschaffung SET aufgabe_id = ${aufgabeId}, updated_at = NOW() WHERE id = ${id}`;
  } catch (e) {
    console.error(`[AUSKUNFT-BESCHAFFUNG] ${ref}: Aufgabe nicht angelegt:`, e);
  }

  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, ${opts.von ?? "System"}, 'system',
            ${`Bonitätsauskunft: Beschaffungsauftrag #${id} angelegt (${MODUS_TEXT[modus]}) — beschaffen bei ${bei}, fällig ab ${faelligText}. `
              + `Einwilligung: ${einw.ja ? einw.text : `fehlt, Link zur Auftragsbestätigung: ${mail}`}. Aufgabe ${aufgabeId ? `#${aufgabeId}` : "fehlt"}.${apiSatz}`})`
    .catch((e: unknown) => console.error("[AUSKUNFT-BESCHAFFUNG] Verlaufseintrag:", e));

  // Nicht warten: Ein Abruf darf die Buchung der Zahlung nicht aufhalten.
  if (apiJetzt) void apiVersuch(id).catch((e) => console.error(`[AUSKUNFT-BESCHAFFUNG] ${ref}: API-Abruf:`, e));

  return {
    ...basis, mail, auftragId: aufgabeId,
    beschaffung: { id, neu: true, status: "offen", faelligAb: faellig.iso, einwilligung: einw.ja, modus },
    text: `Beschaffungsauftrag #${id} angelegt (${MODUS_TEXT[modus]}), fällig ab ${faelligText}, Einwilligung ${einw.ja ? "liegt vor" : `fehlt — Link zur Auftragsbestätigung: ${mail}`}.${apiSatz}`,
  };
}

// ── Der Link zur Auftragsbestätigung (25.09.2026, E-241) ─────────────────────
//
// Bis 25.09.2026 ging hier der Link zur Vollmacht auf /app/unterschrift hinaus.
// Zwei Gründe, warum das im Einkauf falsch war (Befund der Beschaffungs-Prüfer):
//   · Die Vollmacht zur Übermittlung deckt nur die kostenlose Datenkopie — sie
//     schließt aus, im Namen des Kunden Verträge zu schließen. Den Kauf einer
//     kostenpflichtigen Auskunft deckt sie nicht.
//   · /app/unterschrift hakte alle sieben Antragsarten vor — für jemanden, der
//     nur eine Auskunft gekauft hat.
// Jetzt: ein signierter Link auf die Bestätigungsseite (GET/POST
// /api/fiaon/auskunft/auftrag/:token, fiaon-auskunft-kauf.ts). Sie zeigt
// Bestellung, Leistung und den Pflicht-Haken AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT;
// das Absenden schreibt AUSKUNFT_BESCHAFFUNG_VERMERK — der Auftrag springt dann
// von selbst auf „Jetzt beschaffen". Die Seite hängt NICHT an der Unterschrift
// in der App (app_antraege_an) und nicht an einer vorhandenen Vollmacht.
// Die Spalten vollmacht_link_am/-anzahl zählen weiter (Name bleibt, keine Migration).

export interface AuftragLinkErgebnis {
  ok: boolean;
  mail: "gesendet" | "fehlgeschlagen" | "nicht_noetig";
  text: string;
}

/** Wie lange ein zweiter Link ohne ausdrückliches „nochmal" gesperrt ist (Doppelklick, zwei Leute im Chefbüro). */
const LINK_RUHE_MS = 12 * 3_600_000;

/**
 * Den Link zur Auftragsbestätigung schicken — Mail schufa_requested in der
 * Fassung „Einkauf" (auskunft-lead.ts: „Bitte bestätigen Sie kurz Ihren
 * Auftrag …"). Nicht nötig, wenn der Beschaffungsauftrag schon vermerkt ist.
 * Eine Einwilligung, die nur die Datenkopie deckt (Vollmacht zur Übermittlung),
 * hält den Link nicht auf — der Arbeitsplatz darf den Auftrag dafür einholen.
 */
export async function auftragLinkSenden(
  id: number, wer: { name: string; agentId: number | null }, opts: { nochmal?: boolean } = {}, lauf: Lauf = sqlPool,
): Promise<AuftragLinkErgebnis> {
  await ensureBeschaffungTabelle();
  const [a] = (await lauf`SELECT id, ref, person_id, land, art, status, to_char(faellig_ab, 'YYYY-MM-DD') AS faellig_ab, vollmacht_link_am FROM fiaon_auskunft_beschaffung WHERE id = ${id}`) as any[];
  if (!a) return { ok: false, mail: "nicht_noetig", text: "Diesen Beschaffungsauftrag gibt es nicht." };
  if (a.status === "fertig") return { ok: false, mail: "nicht_noetig", text: "Der Auftrag ist fertig — kein Link mehr nötig." };
  const personId = Number(a.person_id);
  const einw = await auskunftEinwilligung(String(a.ref), personId, lauf);
  if (einw.quelle === "auftrag") return { ok: false, mail: "nicht_noetig", text: `Der Auftrag liegt schon vor: ${einw.text}` };
  if (a.vollmacht_link_am && !opts.nochmal && Date.now() - new Date(a.vollmacht_link_am).getTime() < LINK_RUHE_MS) {
    const wann = new Date(a.vollmacht_link_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return { ok: false, mail: "nicht_noetig", text: `Der Link ging schon am ${wann} Uhr raus. Noch einmal nur mit „nochmal“.` };
  }
  const [z] = (await lauf`
    SELECT ref, payment_reference, amount_due, pack_name, first_name, last_name, contact_name, email, contact_email, billing_email, person_id
      FROM fiaon_applications WHERE ref = ${a.ref} LIMIT 1`) as any[];
  if (!z) return { ok: false, mail: "fehlgeschlagen", text: `Die Bestellung ${a.ref} ist nicht mehr da.` };
  const [p] = (await lauf`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  const land = auskunftLand(a.land);
  const art: AuskunftArt = a.art === "firma" ? "firma" : "privat";
  const bei = html(auskunfteienText(land));
  const wartenAb = String(a.faellig_ab) > heuteBerlin() ? isoDeutsch(String(a.faellig_ab)) : null;
  const { auftragLink } = await import("../routes/fiaon-auskunft-kauf");
  const { schufaRequestedSaetze } = await import("../mail/vorlagen/auskunft-lead");
  const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
  const vorname = String(p?.first_name ?? "").trim() || z.first_name || null;
  const nachname = String(p?.last_name ?? "").trim() || z.last_name || null;
  const versand = await sendMakeWebhookMitGrund("schufa_requested", {
    ...makePayloadFromRow(z),
    person_id: personId,
    vorname,
    anrede: html(anredeMail({ vorname, nachname })),
    auskunfteien: bei,
    auskunft_land: land,
    auskunft_liefermodus: "einkauf",
    ...schufaRequestedSaetze("einkauf", { art, wartenAb }),
    // Der Schlüssel heißt weiter unterschrift_url: Das Mail-Protokoll verbirgt ihn
    // (payloadSchwaerzen), und das Ereignis führt ihn als Pflichtfeld. Er trägt im
    // Einkauf den signierten Link zur Auftragsbestätigung.
    unterschrift_url: auftragLink(id),
    login_url: absoluteUrl("/login"),
  } as any).catch((e) => ({ ok: false, grund: String((e as Error)?.message || e) }));
  if (versand.ok) {
    await lauf`UPDATE fiaon_auskunft_beschaffung SET vollmacht_link_am = NOW(), vollmacht_link_anzahl = vollmacht_link_anzahl + 1, updated_at = NOW() WHERE id = ${id}`;
  }
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${a.ref}, ${personId}, ${wer.agentId}, ${wer.name}, 'system',
            ${`Bonitätsauskunft: Link zur Auftragsbestätigung (Beschaffungsauftrag #${id}) ${versand.ok ? "per Mail gesendet" : `NICHT gesendet (${(versand as any).grund ?? "?"})`}.`})`
    .catch(() => {});
  return versand.ok
    ? { ok: true, mail: "gesendet", text: "Der Link zur Auftragsbestätigung ist per Mail unterwegs." }
    : { ok: false, mail: "fehlgeschlagen", text: `Die Mail ging nicht raus: ${(versand as any).grund ?? "unbekannt"}.` };
}

// ── Die Liste des Arbeitsplatzes ────────────────────────────────────────────

export interface BeschaffungAuftrag {
  id: number;
  ref: string;
  personId: number;
  land: AuskunftLand;
  art: AuskunftArt;
  status: BeschaffungStatus;
  /** YYYY-MM-DD (Berlin) */
  faelligAb: string;
  /** Darf heute beschafft werden? */
  faellig: boolean;
  quelle: string;
  modus: string;
  bearbeiter: string | null;
  uebernommenAm: string | null;
  notiz: string | null;
  geliefert: string[];
  letzteLieferung: string[];
  hochgeladenAm: string | null;
  hochgeladenVon: string | null;
  mailStatus: string | null;
  mailAm: string | null;
  vollmachtLinkAm: string | null;
  vollmachtLinkAnzahl: number;
  apiVersuchAm: string | null;
  apiFehler: string | null;
  fertigAm: string | null;
  angelegtAm: string;
  bestellung: {
    betragCents: number | null; bezahltAm: string | null; bestelltAm: string | null; verwendungszweck: string | null; paket: string | null;
    /**
     * Gegenlesen 25.09.2026 (E-241): der Zahlstand der Bestellung JETZT. Steht er nicht mehr auf
     * „paid" (erstattet, storniert — z. B. nach einem Widerruf), wird nicht beschafft: nicht unter
     * „Jetzt beschaffen", kein Abruf über die API, eine Warnung auf der Karte.
     */
    zahlStatus: string | null; bezahlt: boolean;
  };
  kunde: {
    name: string; vorname: string; nachname: string; geburtsdatum: string | null;
    strasse: string | null; plz: string | null; ort: string | null;
    voranschrift: { strasse: string | null; plz: string | null; ort: string | null; land: string | null } | null;
    email: string | null; telefon: string | null;
    firma: { name: string | null; rechtsform: string | null } | null;
  };
  stellen: (BeschaffungStelle & { geliefert: boolean })[];
  einwilligung: AuskunftEinwilligung;
  /** Liegt schon ein Auskunft-Dokument in der Akte (auch auf anderem Weg)? */
  dokumentDa: boolean;
  /** Laufende Anfragen aus dem Vollmacht-Weg (Stand vor dem Umschalten). */
  vorgaengeLaufend: number;
  anschriftFehlt: boolean;
  betreuer: string | null;
}

const iso = (d: unknown): string | null => (d ? new Date(d as any).toISOString() : null);
const s = (v: unknown): string | null => { const t = String(v ?? "").trim(); return t ? t : null; };

/** Die Aufträge: alles Offene und das Fertige der letzten 30 Tage (oder genau einer). */
export async function beschaffungListe(opts: { id?: number } = {}, lauf: Lauf = sqlPool): Promise<BeschaffungAuftrag[]> {
  await ensureBeschaffungTabelle();
  const antraege = await import("../routes/fiaon-app-antraege");
  await antraege.ensureAntraegeTabellen().catch(() => {});
  const nurId = opts.id != null && Number.isInteger(opts.id) ? Number(opts.id) : null;
  const zeilen = (await lauf.unsafe(`
    SELECT b.id, b.ref, b.person_id, b.land, b.art, b.status, to_char(b.faellig_ab, 'YYYY-MM-DD') AS faellig_ab, b.quelle, b.modus,
           b.bearbeiter, b.uebernommen_am, b.notiz, b.geliefert, b.letzte_lieferung, b.hochgeladen_am, b.hochgeladen_von,
           b.mail_status, b.mail_am, b.vollmacht_link_am, b.vollmacht_link_anzahl, b.api_versuch_am, b.api_fehler, b.fertig_am, b.created_at,
           a.amount_due, a.paid_at, a.created_at AS bestellt_am, a.payment_reference, a.pack_name, a.company_name AS firma, a.legal_form, a.payment_status,
           COALESCE(NULLIF(TRIM(p.first_name), ''), k.first_name) AS vorname,
           COALESCE(NULLIF(TRIM(p.last_name), ''), k.last_name) AS nachname,
           COALESCE(NULLIF(TRIM(p.birthdate), ''), k.birthdate) AS geburtsdatum,
           COALESCE(NULLIF(TRIM(p.street), ''), k.street) AS strasse,
           COALESCE(NULLIF(TRIM(p.zip), ''), k.zip) AS plz,
           COALESCE(NULLIF(TRIM(p.city), ''), k.city) AS ort,
           COALESCE(NULLIF(TRIM(p.primary_email), ''), k.email) AS email,
           COALESCE(NULLIF(TRIM(p.primary_phone), ''), k.phone) AS telefon,
           v.previous_street, v.previous_zip, v.previous_city, v.previous_country,
           COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS betreuer,
           EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = b.person_id AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL) AS dokument_da,
           (SELECT COUNT(*)::int FROM fiaon_vorgaenge vg WHERE vg.person_id = b.person_id AND vg.art = 'selbstauskunft'
               AND vg.stand IN ('entwurf', 'unterschrift_offen', 'versandbereit', 'versandt', 'nachfrage')) AS vorgaenge_laufend
      FROM fiaon_auskunft_beschaffung b
      LEFT JOIN fiaon_applications a ON a.ref = b.ref
      LEFT JOIN fiaon_persons p ON p.id = b.person_id
      LEFT JOIN LATERAL (SELECT x.first_name, x.last_name, x.birthdate, x.street, x.zip, x.city, x.email, x.phone FROM fiaon_applications x
                          WHERE x.person_id = b.person_id AND x.merged_into IS NULL AND x.gdpr_deleted_at IS NULL
                          ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) k ON TRUE
      LEFT JOIN LATERAL (SELECT y.previous_street, y.previous_zip, y.previous_city, y.previous_country FROM fiaon_applications y
                          WHERE y.person_id = b.person_id AND COALESCE(TRIM(y.previous_street), '') <> ''
                          ORDER BY y.created_at DESC LIMIT 1) v ON TRUE
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
     WHERE ${nurId != null ? "b.id = $1" : "(b.status <> 'fertig' OR b.fertig_am > NOW() - INTERVAL '30 days')"}
     ORDER BY CASE b.status WHEN 'hochgeladen' THEN 0 WHEN 'in_arbeit' THEN 1 WHEN 'offen' THEN 2 WHEN 'problem' THEN 3 ELSE 4 END,
              b.faellig_ab ASC, COALESCE(a.paid_at, b.created_at) ASC`, nurId != null ? [nurId] : [])) as any[];
  const einw = await auskunftEinwilligungen(zeilen.map((z) => ({ ref: String(z.ref), personId: Number(z.person_id) })), lauf);
  const heute = heuteBerlin();
  return zeilen.map((z): BeschaffungAuftrag => {
    const land = auskunftLand(z.land);
    const art: AuskunftArt = z.art === "firma" ? "firma" : "privat";
    const geliefert = keyListe(z.geliefert);
    const vorname = String(z.vorname ?? "").trim();
    const nachname = String(z.nachname ?? "").trim();
    const strasse = s(z.strasse); const plz = s(z.plz); const ort = s(z.ort);
    return {
      id: Number(z.id), ref: String(z.ref), personId: Number(z.person_id), land, art,
      status: (BESCHAFFUNG_STATUS as readonly string[]).includes(String(z.status)) ? z.status : "offen",
      faelligAb: String(z.faellig_ab), faellig: String(z.faellig_ab) <= heute,
      quelle: String(z.quelle || "zahlung"), modus: String(z.modus || "einkauf"),
      bearbeiter: s(z.bearbeiter), uebernommenAm: iso(z.uebernommen_am), notiz: s(z.notiz),
      geliefert, letzteLieferung: keyListe(z.letzte_lieferung),
      hochgeladenAm: iso(z.hochgeladen_am), hochgeladenVon: s(z.hochgeladen_von),
      mailStatus: s(z.mail_status), mailAm: iso(z.mail_am),
      vollmachtLinkAm: iso(z.vollmacht_link_am), vollmachtLinkAnzahl: Number(z.vollmacht_link_anzahl || 0),
      apiVersuchAm: iso(z.api_versuch_am), apiFehler: s(z.api_fehler), fertigAm: iso(z.fertig_am), angelegtAm: iso(z.created_at)!,
      bestellung: {
        betragCents: z.amount_due != null ? Math.round(Number(z.amount_due) * 100) : null,
        bezahltAm: iso(z.paid_at), bestelltAm: iso(z.bestellt_am), verwendungszweck: s(z.payment_reference), paket: s(z.pack_name),
        zahlStatus: s(z.payment_status), bezahlt: String(z.payment_status ?? "") === "paid",
      },
      kunde: {
        name: [vorname, nachname].filter(Boolean).join(" ") || String(z.ref), vorname, nachname,
        geburtsdatum: s(z.geburtsdatum), strasse, plz, ort,
        voranschrift: s(z.previous_street) ? { strasse: s(z.previous_street), plz: s(z.previous_zip), ort: s(z.previous_city), land: s(z.previous_country) } : null,
        email: s(z.email), telefon: s(z.telefon),
        firma: art === "firma" ? { name: s(z.firma), rechtsform: s(z.legal_form) } : null,
      },
      stellen: beschaffungStellen(land, art).map((st) => ({ ...st, geliefert: geliefert.includes(st.key) })),
      einwilligung: einw.get(String(z.ref)) ?? OHNE_EINWILLIGUNG,
      dokumentDa: !!z.dokument_da, vorgaengeLaufend: Number(z.vorgaenge_laufend || 0),
      anschriftFehlt: !strasse || !plz || !ort,
      betreuer: s(z.betreuer),
    };
  });
}

/** Die Stammdaten eines Auftrags für die API (dieselben, die der Arbeitsplatz zeigt). */
function stammdatenAus(a: BeschaffungAuftrag): import("./fiaon-auskunft-quelle").AuskunftStammdaten {
  return {
    vorname: a.kunde.vorname, nachname: a.kunde.nachname, geburtsdatum: a.kunde.geburtsdatum,
    strasse: a.kunde.strasse, plz: a.kunde.plz, ort: a.kunde.ort, land: a.land,
    voranschrift: a.kunde.voranschrift, email: a.kunde.email, firma: a.kunde.firma,
  };
}

// ── Der Rückstand ───────────────────────────────────────────────────────────

/**
 * Den Rückstand in die Beschaffung holen: je bezahlter Auskunft ohne Dokument
 * (rueckstandListe) ein Auftrag — OHNE Mail an den Kunden und ohne Aufgabe je
 * Zeile. Nur im Einkauf und über die API; im Vollmacht-Weg startet man den
 * Rückstand wie bisher im Auskunft-Verkauf. Rückgabe: wie viele neu.
 */
export async function rueckstandEinlesen(lauf: Lauf = sqlPool): Promise<number> {
  const modus = await auskunftLiefermodus(lauf);
  if (modus === "vollmacht") return 0;
  await ensureBeschaffungTabelle();
  const rueck = await rueckstandListe(lauf);
  if (!rueck.length) return 0;
  const da = new Set(((await lauf`SELECT ref FROM fiaon_auskunft_beschaffung WHERE ref = ANY(${rueck.map((r) => r.ref)})`) as any[]).map((r) => String(r.ref)));
  let neu = 0;
  for (const r of rueck) {
    if (da.has(r.ref)) continue;
    const faellig = await faelligFuer(r.ref, r.art, lauf);
    const [z] = (await lauf`
      INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus)
      VALUES (${r.ref}, ${r.personId}, ${r.land}, ${r.art}, ${faellig.iso}, 'rueckstand', ${modus})
      ON CONFLICT (ref) DO NOTHING RETURNING id`) as any[];
    if (!z) continue;
    neu++;
    await lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${r.ref}, ${r.personId}, NULL, 'Auskunft-Beschaffung', 'system',
              ${`Bonitätsauskunft: bezahlt seit ${r.tageSeitKauf} Tagen, kein Dokument — als Beschaffungsauftrag #${z.id} in den Arbeitsplatz übernommen (${MODUS_TEXT[modus]}, ohne Mail an den Kunden).`})`
      .catch(() => {});
  }
  if (neu > 0) {
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: null, ref: null, anBetreiber: true,
        titel: "Auskunft-Rückstand beschaffen",
        text: "Bezahlte Bonitätsauskünfte ohne Dokument stehen jetzt als Beschaffungsaufträge im Chefbüro unter „Auskunft-Beschaffung“ — "
          + "die Kunden haben dafür keine Mail bekommen. Fehlt der Auftrag, dort „Auftragsbestätigung senden“; liegt er vor, beschaffen und hochladen.",
        schluessel: "auskunft-beschaffung-rueckstand", quelle: "bestellung", bereich: "pruefen",
        link: "/chef/s/auskunft-beschaffung", autorName: "Auskunft-Beschaffung",
        anlageText: "Angelegt, als der Rückstand in die Beschaffung übernommen wurde.",
      });
    } catch (e) {
      console.error("[AUSKUNFT-BESCHAFFUNG] Sammelaufgabe Rückstand:", e);
    }
  }
  return neu;
}

// ── Die Ablage: Upload (von Hand oder aus der API) ──────────────────────────

export interface BeschaffungAbhaengigkeiten {
  /** Die Analyse (Standard: schufaAnalysieren mit erzwingen) — im Prüfstand ersetzt, damit kein Modell läuft. */
  analyse?: (ref: string) => Promise<unknown>;
  /** Die Prüfung des Dokuments (Standard: pruefungAnstossen aus fiaon-dokument-pruefung.ts). */
  pruefung?: (ref: string, pdf: Buffer) => Promise<unknown>;
}

export interface BeschaffungHochladenErgebnis {
  ok: boolean;
  text: string;
  status?: BeschaffungStatus;
  mail?: "gesendet" | "schon_gemeldet" | "fehlgeschlagen" | "aus";
  dokumentRef?: string;
  analyse?: "angestossen" | "fehler";
  hinweis?: string | null;
}

/** Größer ist keine Auskunft — dieselbe Grenze wie der Upload im Kundenbereich (fiaon-antrag.ts). */
export const BESCHAFFUNG_PDF_MAX = 25 * 1024 * 1024;

/**
 * Die beschaffte Auskunft ablegen — derselbe Weg wie „Unterlage hochladen" in
 * der Akte (POST /agent/dokumente/:personId/schufa/hochladen, fiaon-telefonie.ts):
 * Trägerzeile nach derselben Reihenfolge (bezahltes Paket zuerst), die
 * bisherige Fassung ins Archiv (unterlageSichern), schufa_pdf setzen, Verlauf,
 * Dokumentprüfung. Dazu — was der Mitarbeiter-Upload nicht tut — die Analyse
 * und die Mail „Ihre Auskunft ist da". Nur PDF; mehrere Dateien (je Auskunftei
 * eine) werden zu EINER gebunden, eine Nachlieferung hängt sich an die eigene
 * frühere Lieferung an.
 */
export async function beschaffungHochladen(
  id: number,
  ein: { dateien: { buffer: Buffer; name: string }[]; auskunfteien?: string[]; wer: { name: string; agentId: number | null }; mail?: boolean },
  deps: BeschaffungAbhaengigkeiten = {},
  lauf: Lauf = sqlPool,
): Promise<BeschaffungHochladenErgebnis> {
  const [a] = await beschaffungListe({ id }, lauf);
  if (!a) return { ok: false, text: "Diesen Beschaffungsauftrag gibt es nicht." };
  if (a.status === "fertig") return { ok: false, text: "Der Auftrag ist schon fertig. Eine neue Fassung bitte in der Akte unter Unterlagen hochladen." };
  const dateien = (ein.dateien ?? []).filter((d) => d?.buffer?.length);
  if (!dateien.length) return { ok: false, text: "Es wurde keine Datei mitgeschickt." };
  if (dateien.length > 6) return { ok: false, text: "Höchstens sechs Dateien auf einmal." };
  const { dateiArt, zuEinerPdf, BindeFehler, bindeSatz } = await import("./fiaon-pdf-binden");
  for (const d of dateien) {
    if (dateiArt(d.buffer) !== "pdf") return { ok: false, text: `„${d.name}“ ist kein PDF. Die Auskunft bitte als PDF hochladen, so wie die Auskunftei sie liefert.` };
    if (d.buffer.length > BESCHAFFUNG_PDF_MAX) return { ok: false, text: `„${d.name}“ ist größer als 25 MB.` };
  }
  const erlaubt = a.stellen.map((st) => st.key);
  const gewaehlt = (ein.auskunfteien?.length ? ein.auskunfteien : erlaubt).map(String).filter((k) => erlaubt.includes(k));
  if (!gewaehlt.length) return { ok: false, text: "Bitte angeben, von welcher Auskunftei die Datei stammt." };

  // Die Trägerzeile — dieselbe Reihenfolge wie der Mitarbeiter-Upload (fiaon-telefonie.ts, 18.09.2026).
  const [t] = (await lauf`
    SELECT ref, schufa_pdf IS NOT NULL AS hat FROM fiaon_applications
     WHERE person_id = ${a.personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
     ORDER BY (payment_status = 'paid') DESC,
              (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
              created_at DESC LIMIT 1`) as any[];
  const traeger = t?.ref ? String(t.ref) : a.ref;

  // Eine Nachlieferung (z. B. CRIF nach SCHUFA) hängt sich an die EIGENE frühere Lieferung an —
  // sonst ersetzte sie sie, denn die Akte hat eine Spalte je Unterlage.
  // Gegenlesen 25.09.2026 (E-241): Umfasst die neue Lieferung ALLES schon Gelieferte (alle früheren
  // Auskunfteien angehakt), ersetzt sie die frühere statt sie zu doppeln (die alte Fassung geht über
  // unterlageSichern ins Archiv). Das ist auch der Ausweg, wenn die frühere Datei geschützt ist —
  // eine verschlüsselte PDF wird nie gebunden (fiaon-pdf-binden.ts), ein Anhängen ginge dann nie.
  const teile = [...dateien];
  let angehaengt = false;
  if (a.geliefert.length && !a.geliefert.every((k) => gewaehlt.includes(k))) {
    const [alt] = (await lauf`SELECT b.dokument_ref, x.schufa_pdf FROM fiaon_auskunft_beschaffung b
                               LEFT JOIN fiaon_applications x ON x.ref = b.dokument_ref
                              WHERE b.id = ${id}`) as any[];
    if (alt?.schufa_pdf && String(alt.dokument_ref) === traeger) {
      teile.unshift({ buffer: Buffer.isBuffer(alt.schufa_pdf) ? alt.schufa_pdf : Buffer.from(alt.schufa_pdf), name: "bisherige-lieferung.pdf" });
      angehaengt = true;
    }
  }
  let pdf: Buffer;
  try {
    pdf = await zuEinerPdf(teile);
  } catch (e) {
    if (e instanceof BindeFehler && angehaengt && e.datei === "bisherige-lieferung.pdf") {
      const frueher = a.stellen.filter((st) => a.geliefert.includes(st.key)).map((st) => st.kurz).join(", ");
      return {
        ok: false,
        text: `Die frühere Lieferung (${frueher}) liegt geschützt in der Akte und lässt sich nicht anhängen. `
          + "Lade sie zusammen mit der neuen hoch — jede Datei über „Drucken → Als PDF sichern“ neu gespeichert — und hake alle Auskunfteien an; dann ersetzt die neue Datei die alte.",
      };
    }
    if (e instanceof BindeFehler) return { ok: false, text: bindeSatz(e, "du") };
    throw e;
  }
  const verschluesselt = pdf.subarray(0, Math.min(pdf.length, 4_000_000)).includes("/Encrypt", 0, "latin1");

  const { unterlageSichern } = await import("./fiaon-dokumente");
  await unterlageSichern(traeger, "schufa", lauf);
  await lauf`UPDATE fiaon_applications SET schufa_pdf = ${pdf}, documents_uploaded_at = NOW() WHERE ref = ${traeger}`;
  await lauf`
    UPDATE fiaon_applications SET status = 'documents_submitted'
     WHERE ref = ${traeger} AND bank_statement_pdf IS NOT NULL AND id_card_pdf IS NOT NULL AND status IN ('pending', 'documents_requested')`
    .catch(() => {});

  const stellen = a.stellen.filter((st) => gewaehlt.includes(st.key));
  const geliefert = keyListe(keyText([...a.geliefert, ...gewaehlt]));
  const rest = a.stellen.filter((st) => !geliefert.includes(st.key));
  // Gegenlesen 25.09.2026 (E-241): Die Mail nennt, was NEU da ist — und, steht der Auftrag auf
  // „Mail fehlt“, auch die Lieferung, zu der die Mail noch aussteht. Eine ersetzte Fassung schon
  // gemeldeter Auskunfteien schreibt dem Kunden nicht noch einmal. `letzte_lieferung` hält genau
  // diese Menge fest — „Mail erneut senden“ versucht dieselbe.
  const mailStellen = keyListe(keyText([
    ...gewaehlt.filter((k) => !a.geliefert.includes(k)),
    ...(a.status === "hochgeladen" ? a.letzteLieferung : []),
  ]));
  const kb = Math.max(1, Math.round(pdf.length / 1024));
  await lauf`
    UPDATE fiaon_auskunft_beschaffung
       SET geliefert = ${keyText(geliefert)}, letzte_lieferung = ${keyText(mailStellen.length ? mailStellen : gewaehlt)}, dokument_ref = ${traeger},
           hochgeladen_am = NOW(), hochgeladen_von = ${ein.wer.name},
           bearbeiter = COALESCE(bearbeiter, ${ein.wer.name}), bearbeiter_id = COALESCE(bearbeiter_id, ${ein.wer.agentId}),
           uebernommen_am = COALESCE(uebernommen_am, NOW()), status = 'hochgeladen', mail_status = NULL, updated_at = NOW()
     WHERE id = ${id}`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${a.ref}, ${a.personId}, ${ein.wer.agentId}, ${ein.wer.name}, 'system',
            ${`Bonitätsauskunft beschafft und als Auskunft-Dokument abgelegt (${stellen.map((st) => st.kurz).join(", ")}; ${kb} KB${dateien.length > 1 ? `, ${dateien.length} Dateien zu einer PDF gebunden` : ""}${angehaengt ? ", an die frühere Lieferung angehängt" : a.geliefert.length ? ", ersetzt die frühere Lieferung (alte Fassung im Archiv der Akte)" : ""}) — Beschaffungsauftrag #${id}, Ablage an ${traeger}.`})`
    .catch(() => {});

  // Die Prüfung und die Analyse — beide halten den Upload nicht auf.
  const pruefung = deps.pruefung ?? (async (ref: string, buf: Buffer) => {
    const { pruefungAnstossen } = await import("./fiaon-dokument-pruefung");
    return pruefungAnstossen(ref, "schufa", buf);
  });
  await Promise.resolve(pruefung(traeger, pdf)).catch((e) => console.error("[AUSKUNFT-BESCHAFFUNG] Prüfung:", String(e).slice(0, 160)));
  const analyse = deps.analyse ?? (async (ref: string) => {
    const { schufaAnalysieren } = await import("./fiaon-schufa-analyse");
    return schufaAnalysieren(ref, { erzwingen: true });
  });
  let analyseStand: "angestossen" | "fehler" = "angestossen";
  try {
    void Promise.resolve(analyse(traeger)).catch((e) => console.error(`[AUSKUNFT-BESCHAFFUNG] ${a.ref}: Analyse:`, String(e).slice(0, 200)));
  } catch (e) {
    analyseStand = "fehler";
    console.error(`[AUSKUNFT-BESCHAFFUNG] ${a.ref}: Analyse nicht anstoßbar:`, e);
  }

  // Die Mail „Ihre Auskunft ist da" — und danach der Stand.
  const mail = ein.mail === false ? "aus" : mailStellen.length ? await beschaffungMailSenden(a, mailStellen, rest, lauf) : "schon_gemeldet";
  const status = await nachLieferungStand(id, a.ref, mail, rest.length === 0, lauf);
  // 26.09.2026 (E-243): ohne laufendes Paket die Aufgabe „Auswertung besprechen und Paket anbieten" (einmal je Bestellung).
  await paketAngebotAufgabe(a.personId, a.ref, lauf);
  const hinweis = verschluesselt ? "Die PDF ist verschlüsselt — die Analyse kann sie vielleicht nicht lesen. Dann bitte über „Drucken → Als PDF sichern“ neu speichern und noch einmal hochladen." : null;
  return {
    ok: true, status, mail, dokumentRef: traeger, analyse: analyseStand, hinweis,
    text: `${stellen.map((st) => st.kurz).join(", ")} liegt in der Akte, die Analyse läuft. `
      + (mail === "gesendet" ? "Der Kunde hat „Ihre Auskunft ist da“ bekommen."
        : mail === "schon_gemeldet" ? "Die Mail zu dieser Lieferung ging schon früher raus."
          : mail === "aus" ? "Ohne Mail an den Kunden."
            : "ACHTUNG: Die Mail an den Kunden ging NICHT raus — „Mail erneut senden“.")
      + (rest.length ? ` Es fehlt noch: ${rest.map((st) => st.kurz).join(", ")}.` : " Auftrag fertig."),
  };
}

/** Nach einer Lieferung: fertig (alles da, Mail raus), in Arbeit (Teil da) oder hochgeladen (Mail fehlt). */
async function nachLieferungStand(id: number, ref: string, mail: string, komplett: boolean, lauf: Lauf): Promise<BeschaffungStatus> {
  const mailOk = mail === "gesendet" || mail === "schon_gemeldet" || mail === "aus";
  const status: BeschaffungStatus = !mailOk ? "hochgeladen" : komplett ? "fertig" : "in_arbeit";
  await lauf`
    UPDATE fiaon_auskunft_beschaffung
       SET status = ${status}, mail_status = ${mail}, mail_am = CASE WHEN ${mail} = 'gesendet' THEN NOW() ELSE mail_am END,
           fertig_am = CASE WHEN ${status} = 'fertig' THEN NOW() ELSE fertig_am END, updated_at = NOW()
     WHERE id = ${id}`;
  if (status === "fertig") await beschaffungsAufgabeSchliessen(ref, "Auskunft beschafft, in der Akte, Kunde benachrichtigt.", lauf);
  return status;
}

/** „Ihre Auskunft ist da" (schufa_approved) — einmal je Auftrag und gelieferter Auskunftei. */
async function beschaffungMailSenden(a: BeschaffungAuftrag, gewaehlt: string[], rest: BeschaffungStelle[], lauf: Lauf): Promise<"gesendet" | "schon_gemeldet" | "fehlgeschlagen"> {
  const marke = `[auskunft-beschaffung:${a.id}:${keyText(gewaehlt)}]`;
  if (await schonGemeldet(marke, a.personId, lauf)) return "schon_gemeldet";
  const [z] = (await lauf`
    SELECT ref, payment_reference, amount_due, pack_name, first_name, last_name, contact_name, email, contact_email, billing_email, person_id
      FROM fiaon_applications WHERE ref = ${a.ref} LIMIT 1`) as any[];
  const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
  const { AUSKUNFT_DA_BEREICH_SATZ } = await import("../mail/vorlagen/auskunft-lead");
  const basis = z ? makePayloadFromRow(z) : { email: a.kunde.email ?? "", antrag_id: a.ref };
  const vorname = a.kunde.vorname || (basis as any).vorname || null;
  const nachname = a.kunde.nachname || (basis as any).nachname || null;
  const namen = a.stellen.filter((st) => gewaehlt.includes(st.key)).map((st) => st.mailName);
  // 26.09.2026 (E-243): ohne laufendes Paket „Ihr nächster Schritt zur Karte" — nur in der ersten Mail dieses Auftrags.
  const paketSchritt = await paketSchrittNutzlast(a.personId, a.ref, `[auskunft-beschaffung:${a.id}:`, lauf);
  const versand = await sendMakeWebhookMitGrund("schufa_approved", {
    ...(basis as any),
    person_id: a.personId,
    vorname,
    anrede: html(anredeMail({ vorname, nachname })),
    auskunftei: html(namenText(namen)),
    bereich_satz: AUSKUNFT_DA_BEREICH_SATZ,
    rest_satz: rest.length ? `Von ${html(namenText(rest.map((st) => st.mailName)))} steht die Auskunft noch aus — sobald sie da ist, sagen wir Ihnen Bescheid.` : "",
    login_url: absoluteUrl("/login"),
    auskunft_liefermodus: "einkauf",
    ...paketSchritt,
  }).catch((e) => ({ ok: false, grund: String((e as Error)?.message || e) }));
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${a.ref}, ${a.personId}, NULL, 'Auskunft-Beschaffung', 'system',
            ${`Bonitätsauskunft: Mail „Ihre Auskunft ist da“ (${namenText(namen)}): ${versand.ok ? `gesendet. ${marke}` : `nicht gesendet (${(versand as any).grund ?? "?"}) — im Chefbüro „Mail erneut senden“.`}`})`
    .catch(() => {});
  return versand.ok ? "gesendet" : "fehlgeschlagen";
}

/** Die Mail der letzten Lieferung noch einmal versuchen (Stand „hochgeladen"). */
export async function beschaffungMailNachholen(id: number, lauf: Lauf = sqlPool): Promise<{ ok: boolean; text: string; status?: BeschaffungStatus }> {
  const [a] = await beschaffungListe({ id }, lauf);
  if (!a) return { ok: false, text: "Diesen Beschaffungsauftrag gibt es nicht." };
  if (!a.letzteLieferung.length) return { ok: false, text: "Es gibt noch keine Lieferung, zu der eine Mail fehlt." };
  if (a.status !== "hochgeladen") return { ok: false, text: "Zu diesem Auftrag fehlt keine Mail." };
  const rest = a.stellen.filter((st) => !a.geliefert.includes(st.key));
  const mail = await beschaffungMailSenden(a, a.letzteLieferung, rest, lauf);
  const status = await nachLieferungStand(id, a.ref, mail, rest.length === 0, lauf);
  return { ok: mail !== "fehlgeschlagen", status, text: mail === "fehlgeschlagen" ? "Die Mail ging wieder nicht raus — bitte Adresse in der Akte prüfen." : "Die Mail ist raus." };
}

// ── Handgriffe am Auftrag ───────────────────────────────────────────────────

export type BeschaffungAktion = "uebernehmen" | "problem" | "notiz" | "wieder_offen" | "abschliessen";

/** Übernehmen, Problem, Notiz, wieder öffnen, von Hand abschließen (ohne Mail). */
export async function beschaffungAktion(
  id: number, aktion: BeschaffungAktion, wer: { name: string; agentId: number | null }, notizRoh: string = "", lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; text: string }> {
  await ensureBeschaffungTabelle();
  const [a] = (await lauf`SELECT id, ref, person_id, status, bearbeiter FROM fiaon_auskunft_beschaffung WHERE id = ${id}`) as any[];
  if (!a) return { ok: false, text: "Diesen Beschaffungsauftrag gibt es nicht." };
  const notiz = String(notizRoh ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  const stempel = `[${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ${wer.name}] ${notiz}`;
  const vermerk = (text: string) => lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${a.ref}, ${Number(a.person_id)}, ${wer.agentId}, ${wer.name}, 'system', ${text})`.catch(() => {});
  if (aktion === "uebernehmen") {
    if (a.status === "fertig") return { ok: false, text: "Der Auftrag ist fertig." };
    await lauf`
      UPDATE fiaon_auskunft_beschaffung
         SET bearbeiter = ${wer.name}, bearbeiter_id = ${wer.agentId}, uebernommen_am = NOW(),
             status = CASE WHEN status IN ('offen', 'problem') THEN 'in_arbeit' ELSE status END, updated_at = NOW()
       WHERE id = ${id}`;
    return { ok: true, text: `${wer.name} beschafft diese Auskunft.` };
  }
  if (aktion === "notiz" || aktion === "problem" || aktion === "abschliessen") {
    if (notiz.length < 3) return { ok: false, text: aktion === "problem" ? "Bitte kurz sagen, was das Problem ist." : aktion === "abschliessen" ? "Bitte kurz sagen, warum ohne Upload abgeschlossen wird." : "Die Notiz ist leer." };
  }
  if (aktion === "notiz") {
    await lauf`UPDATE fiaon_auskunft_beschaffung SET notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${stempel}::text), updated_at = NOW() WHERE id = ${id}`;
    return { ok: true, text: "Notiz gespeichert." };
  }
  if (aktion === "problem") {
    if (a.status === "fertig") return { ok: false, text: "Der Auftrag ist fertig." };
    await lauf`UPDATE fiaon_auskunft_beschaffung SET status = 'problem', notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${stempel}::text), updated_at = NOW() WHERE id = ${id}`;
    await vermerk(`Bonitätsauskunft: Beschaffung #${id} — Problem: ${notiz}`);
    return { ok: true, text: "Als Problem markiert." };
  }
  if (aktion === "wieder_offen") {
    if (a.status !== "problem" && a.status !== "fertig") return { ok: false, text: "Nur ein Problem oder ein fertiger Auftrag lässt sich wieder öffnen." };
    await lauf`
      UPDATE fiaon_auskunft_beschaffung
         SET status = CASE WHEN bearbeiter IS NULL THEN 'offen' ELSE 'in_arbeit' END, fertig_am = NULL, updated_at = NOW()
       WHERE id = ${id}`;
    await lauf`UPDATE fiaon_betreiber_todos SET status = 'offen', updated_at = NOW() WHERE schluessel = ${`auskunft-beschaffung:${a.ref}`} AND status = 'erledigt'`.catch(() => {});
    return { ok: true, text: "Wieder offen." };
  }
  if (aktion === "abschliessen") {
    await lauf`
      UPDATE fiaon_auskunft_beschaffung
         SET status = 'fertig', fertig_am = NOW(), notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${`${stempel} (ohne Upload abgeschlossen)`}::text), updated_at = NOW()
       WHERE id = ${id}`;
    await beschaffungsAufgabeSchliessen(String(a.ref), `Ohne Upload abgeschlossen: ${notiz}`, lauf);
    await vermerk(`Bonitätsauskunft: Beschaffung #${id} ohne Upload abgeschlossen (keine Mail an den Kunden): ${notiz}`);
    return { ok: true, text: "Abgeschlossen — ohne Mail an den Kunden." };
  }
  return { ok: false, text: "Unbekannte Aktion." };
}

// ── Über die API ────────────────────────────────────────────────────────────

/**
 * Einen Auftrag über die API abrufen. Nur mit Einwilligung und ab `faellig_ab`.
 * Ohne Anbindung oder bei einem Fehler bleibt er im Einkauf — mit dem Grund am
 * Auftrag, sichtbar im Arbeitsplatz.
 */
export async function apiVersuch(id: number, deps: BeschaffungAbhaengigkeiten = {}, lauf: Lauf = sqlPool): Promise<{ ok: boolean; text: string }> {
  const [a] = await beschaffungListe({ id }, lauf);
  if (!a) return { ok: false, text: "Diesen Beschaffungsauftrag gibt es nicht." };
  if (a.status === "fertig") return { ok: false, text: "Der Auftrag ist fertig." };
  if (!a.bestellung.bezahlt) return { ok: false, text: `Die Bestellung steht nicht mehr auf bezahlt (${a.bestellung.zahlStatus ?? "unbekannt"}) — nicht abrufen.` };
  // 25.09.2026 (E-241): Der Abruf kauft im Namen des Kunden — dafür nur mit Beschaffungsauftrag. Eine Vollmacht zur
  // Übermittlung (deckt nur die kostenlose Datenkopie) beschafft ein Mensch am Arbeitsplatz, nie die Schnittstelle.
  if (a.einwilligung.quelle !== "auftrag") return { ok: false, text: "Ohne bestätigten Beschaffungsauftrag wird nicht abgerufen." };
  if (!a.faellig) return { ok: false, text: `Erst ab dem ${isoDeutsch(a.faelligAb)} (Widerrufsfrist).` };
  const q = await import("./fiaon-auskunft-quelle");
  const fehler = async (text: string) => {
    await lauf`UPDATE fiaon_auskunft_beschaffung SET api_versuch_am = NOW(), api_fehler = ${text.slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`;
    return { ok: false, text };
  };
  let erg: import("./fiaon-auskunft-quelle").AuskunftAbrufErgebnis;
  try {
    erg = await q.auskunftAbrufen({ ref: a.ref, personId: a.personId, land: a.land, art: a.art, stammdaten: stammdatenAus(a), auskunfteien: a.stellen.filter((st) => !st.geliefert).map((st) => st.key) });
  } catch (e) {
    if (e instanceof q.AuskunftApiNichtAngebunden) return fehler("API noch nicht angebunden — bitte von Hand beschaffen.");
    return fehler(`API-Fehler: ${String((e as Error)?.message || e).slice(0, 300)} — bitte von Hand beschaffen.`);
  }
  if (!erg.ok || !erg.pdf) return fehler(`API: ${erg.fehler || "keine Auskunft geliefert"} — bitte von Hand beschaffen.`);
  await lauf`UPDATE fiaon_auskunft_beschaffung SET api_versuch_am = NOW(), api_fehler = NULL, updated_at = NOW() WHERE id = ${id}`;
  const h = await beschaffungHochladen(id, {
    dateien: [{ buffer: erg.pdf, name: erg.dateiname || `Auskunft_${a.ref}.pdf` }],
    auskunfteien: erg.auskunfteien, wer: { name: "Auskunft-API", agentId: null },
  }, deps, lauf);
  return { ok: h.ok, text: h.text };
}

/** Alle heute fälligen Aufträge mit Beschaffungsauftrag über die API abrufen (Knopf im Arbeitsplatz; höchstens 20 je Lauf). */
export async function apiFaelligeAbrufen(lauf: Lauf = sqlPool): Promise<{ versucht: number; geliefert: number; texte: string[] }> {
  const liste = (await beschaffungListe({}, lauf))
    .filter((a) => (a.status === "offen" || a.status === "in_arbeit") && a.faellig && a.einwilligung.quelle === "auftrag" && a.bestellung.bezahlt)
    .slice(0, 20);
  const texte: string[] = [];
  let geliefert = 0;
  for (const a of liste) {
    const r = await apiVersuch(a.id, {}, lauf).catch((e) => ({ ok: false, text: String((e as Error)?.message || e) }));
    if (r.ok) geliefert++;
    texte.push(`${a.kunde.name}: ${r.text}`);
    // Ist die Schnittstelle nicht angebunden, sagt das der erste Versuch — der Rest wäre dasselbe.
    if (!r.ok && /nicht angebunden/.test(r.text)) break;
  }
  return { versucht: texte.length, geliefert, texte };
}
