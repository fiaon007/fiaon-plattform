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
  AUSKUNFTEIEN, AUSKUNFT_SCHLUESSEL, auskunftLand, auskunfteienFuer, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand, type Auskunftei,
} from "@shared/fiaon-auskunft";

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
        const versand = await sendMakeWebhookMitGrund("schufa_requested", {
          ...makePayloadFromRow(z),
          person_id: personId,
          vorname: kunde.vorname || z.first_name || null,
          anrede: html(anredeMail({ vorname: kunde.vorname || z.first_name, nachname: kunde.nachname || z.last_name })),
          auskunfteien: html(beiText),
          auskunft_land: land,
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
  const versand = await sendMakeWebhookMitGrund("schufa_approved", {
    ...(await nutzlastFuer(l, lauf)) as any, auskunftei: html(l.kurz), rest_satz: restSatz,
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
  return {
    ...payload, produktkategorie: "auskunft", auskunft_land: land, auskunfteien: html(auskunfteienText(land)),
    ...(vorname ? { vorname: html(vorname) } : {}),
    auskunft_art: art,
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
  const stand = await auskunftStand(personId, lauf);
  if (stand.stufe === "bezahlt") return "Diese Person hat die Auskunft schon bezahlt — kein Angebot.";
  if (stand.stufe === "dokument") return "Für diese Person liegt schon eine Auskunft in der Akte — kein Angebot.";
  if (stand.offen?.status === "claimed_paid") return "Diese Person hat die Zahlung für die Auskunft schon gemeldet — kein Angebot.";
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
  // und die nimmt die Auskunft erst nach der ersten Zahlung für ein Paket an (angebotLage).
  // Ein Angebot an jemanden ohne diese Zahlung endete auf „Erst die erste Zahlung für Ihr
  // Paket" — dieselbe Regel hier, damit keine Werbe-Mail in eine Sackgasse führt.
  const { angebotLage } = await import("../routes/fiaon-auskunft-kauf");
  if (!(await angebotLage(personId, lauf)).paketBezahlt) {
    return "Noch keine Zahlung für ein Paket — die Kaufseite nimmt die Auskunft erst danach an. Kein Angebot per Mail.";
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
  if (!personId) return "Angebot der Auskunft nur an bekannte Kunden — ohne Person nicht.";
  const tuer = await auskunftAngebotTuerSperre(personId, lauf);
  if (tuer) return tuer;
  const { personSperre, sperrUrteil } = await import("./fiaon-mail-frequenz");
  const s = await personSperre(personId);
  return sperrUrteil("auskunft_angebot", s ? [s] : [], { manuell: opts.manuell === true });
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
