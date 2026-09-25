// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE, WIE DER POSTMEISTER SIE LIEST (02.09.2026, E-094)
//
// DER FUND, aus dem das hier entstand (Analyse 02.09.): Zwei Kundinnen mit
// vollständiger Akte — bezahltes Paket, erledigtes Startgespräch, Rate fällig,
// Betreuerin zugeordnet — bekamen die Antwort „Leider kann ich ohne weitere
// Angaben zu Ihrem Konto keine genaue Auskunft geben." Das Dossier lag dem
// Modell vor. Es hat es nicht benutzt, weil nichts es dazu zwang.
//
// DESHALB ZWEI ÄNDERUNGEN:
//   1. Der Server ruft diese Akte SELBST auf, bevor das Modell das erste Wort
//      schreibt, und legt sie ihm als Werkzeugergebnis vor. „Ohne Angaben"
//      ist damit technisch unmöglich.
//   2. Die LAGE des Kunden rechnet der Server aus — nicht das Modell. Sie
//      entscheidet, welche Werkzeuge es gibt und welcher nächste Schritt
//      erlaubt ist. Ein Modell kann eine Kategorie erfinden, eine Lage nicht.
//
// WAS HIER NIE HINEINGEHÖRT: Bankdaten. Die kommen ausschließlich über das
// Werkzeug `zahlungslink_bauen` als Adresse einer Seite. Am 02.09. stand die
// IBAN im Prompt, und ein wartender Entwurf trug am Abend noch die gesperrte.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import type { Kundenlage, AkteKurz, AuskunftDossier } from "@shared/fiaon-postmeister-typen";
import { istGlobalPaket } from "@shared/fiaon-pakete";
import { auskunftWort, auskunfteienText, euroText, AUSKUNFT_PREISE_CENTS } from "@shared/fiaon-auskunft";

/** Berliner Zeitangaben — nie Number(format()), immer formatToParts. */
function berlinJetzt(): { text: string; iso: string } {
  const jetzt = new Date();
  const t = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(jetzt);
  const w = (n: string) => t.find((p) => p.type === n)?.value ?? "";
  return {
    text: `${w("weekday")}, ${w("day")}. ${w("month")} ${w("year")}, ${w("hour")}:${w("minute")} Uhr`,
    iso: jetzt.toISOString(),
  };
}

/** „heute in 1 Std. 56 Min.", „morgen 18:00", „vor 4 Tagen" — nimmt dem Modell die Rechnerei ab. */
export function relativ(datum: Date | string | null | undefined): string {
  if (!datum) return "";
  const d = new Date(datum);
  if (Number.isNaN(d.getTime())) return "";
  const diff = d.getTime() - Date.now();
  const min = Math.round(diff / 60000);
  const tage = Math.round(diff / 86400000);
  const uhr = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  if (Math.abs(min) < 60) return min >= 0 ? `in ${min} Minuten` : `vor ${-min} Minuten`;
  if (min > 0 && min < 720) return `heute um ${uhr}, in ${Math.round(min / 60)} Stunden`;
  if (tage === 0) return `heute um ${uhr}`;
  if (tage === 1) return `morgen um ${uhr}`;
  if (tage === -1) return `gestern um ${uhr}`;
  if (tage > 1 && tage < 14) return `in ${tage} Tagen (${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(d)}, ${uhr})`;
  if (tage < -1 && tage > -60) return `vor ${-tage} Tagen`;
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

const eur = (cents: unknown) => (Number(cents || 0) / 100).toFixed(2).replace(".", ",");

/**
 * Wer schreibt da? Sechs Stufen, absteigend nach Sicherheit. Die letzten
 * beiden liefern nur KANDIDATEN — ein Namensvetter darf nie automatisch die
 * Akte eines Fremden zu sehen bekommen.
 */
export async function personSuchen(absender: string, text: string): Promise<{
  personId: number | null; ref: string | null; sicher: boolean; wie: string;
  kandidaten: { personId: number; name: string; wie: string }[];
}> {
  const adresse = String(absender || "").toLowerCase().match(/<([^>]+)>/)?.[1] ?? String(absender || "").toLowerCase().trim();
  const leer = { personId: null, ref: null, sicher: false, wie: "nicht gefunden", kandidaten: [] as any[] };
  if (!adresse.includes("@")) return leer;

  // Stufe 1+2: Adresse an der Person oder an einer Bestellung (merged auflösen).
  const [p] = (await sqlPool`
    SELECT COALESCE(p.merged_into_person_id, p.id) AS person_id
      FROM fiaon_persons p
     WHERE LOWER(TRIM(p.primary_email)) = ${adresse}
     ORDER BY (p.merged_into_person_id IS NULL) DESC LIMIT 1
  `) as any[];
  let personId: number | null = p?.person_id ? Number(p.person_id) : null;
  let wie = personId ? "E-Mail-Adresse der Person" : "";

  if (!personId) {
    const [a] = (await sqlPool`
      SELECT person_id FROM fiaon_applications
       WHERE merged_into IS NULL AND (LOWER(email) = ${adresse} OR LOWER(contact_email) = ${adresse} OR LOWER(billing_email) = ${adresse})
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
    `) as any[];
    if (a?.person_id) { personId = Number(a.person_id); wie = "E-Mail-Adresse einer Bestellung"; }
  }

  // Stufe 3: Referenz im Text (FIAON-XXXXXX oder Ratenreferenz).
  if (!personId) {
    const ref = String(text || "").toUpperCase().match(/FIAON-[A-Z0-9]{6}/)?.[0];
    if (ref) {
      const [r] = (await sqlPool`
        SELECT person_id, ref FROM fiaon_applications
         WHERE payment_reference = ${ref} AND merged_into IS NULL LIMIT 1
      `) as any[];
      if (r?.person_id) { personId = Number(r.person_id); wie = `Zahlungsreferenz ${ref} im Text`; }
    }
  }

  // Stufe 4: Telefonnummer im Text.
  if (!personId) {
    const tel = String(text || "").match(/(?:\+49|0049|0)\s?1\d{2}[\s\/-]?\d{6,9}/)?.[0]?.replace(/\D/g, "");
    if (tel && tel.length >= 9) {
      const neun = tel.slice(-9);
      const [t] = (await sqlPool`
        SELECT id FROM fiaon_persons WHERE phone_key9 = ${neun} AND merged_into_person_id IS NULL LIMIT 1
      `) as any[];
      if (t?.id) { personId = Number(t.id); wie = "Telefonnummer im Text"; }
    }
  }

  if (personId) {
    // ── DER VORGANG IST DAS PAKET, NICHT DIE AUSKUNFT (24.09.2026, E-240, Gegenlesen) ──
    // Bisher gewann bei gleichem Zahlstand die JÜNGSTE Zeile — und das ist nach
    // einem Auskunft-Kauf die FIAON-SCHUFA-Zeile. Lage, Raten und Vertrag
    // rechnet die Akte aber aus dieser Referenz: Eine bezahlte Auskunft hat
    // keine Raten, also stand der Kunde als „aktiv" da, auch mit überfälliger
    // Rate. Gemessen (Produktion, nur lesend): 74 Personen hatten die Auskunft
    // als Vorgang, 62 davon mit bezahltem Paket, 37 mit überfälliger Rate.
    // Jetzt: Bei gleichem Zahlstand geht das Paket vor. Wer nur eine Auskunft
    // hat, behält sie als Vorgang; eine offene Auskunft neben einem stornierten
    // Paket auch (dort ist sie die einzige offene Rechnung).
    const [b] = (await sqlPool`
      SELECT ref FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
       ORDER BY (payment_status = 'paid') DESC, (payment_status <> 'cancelled') DESC,
                (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC, created_at DESC LIMIT 1
    `) as any[];
    return { personId, ref: b?.ref ?? null, sicher: true, wie, kandidaten: [] };
  }

  // Stufe 5+6: Name im Absender — NUR als Kandidat.
  const name = String(absender || "").replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  if (name.length > 4 && name.includes(" ")) {
    const [vor, ...rest] = name.split(/\s+/);
    const nach = rest.join(" ");
    const treffer = (await sqlPool`
      SELECT id, first_name, last_name FROM fiaon_persons
       WHERE merged_into_person_id IS NULL AND ist_test_am IS NULL
         AND LOWER(first_name) = ${vor.toLowerCase()} AND LOWER(last_name) = ${nach.toLowerCase()}
       LIMIT 5
    `) as any[];
    if (treffer.length) {
      return {
        personId: null, ref: null, sicher: false, wie: "Name im Absender (unsicher)",
        kandidaten: treffer.map((t) => ({ personId: Number(t.id), name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(), wie: "Name stimmt überein" })),
      };
    }
  }
  return leer;
}

/**
 * Die Lage. Die Reihenfolge der Prüfungen ist die Rangfolge: Was zuerst
 * zutrifft, gilt. Sperren schlagen alles, Bestreiten schlägt Zahlung.
 */
export async function kundenlageBerechnen(personId: number | null, ref: string | null): Promise<{ lage: Kundenlage; grund: string }> {
  if (!personId && !ref) return { lage: "fremd", grund: "kein Kundendatensatz zur Absenderadresse" };

  const [p] = personId ? (await sqlPool`
    SELECT werbung_gesperrt_am, is_blocked, account_status FROM fiaon_persons WHERE id = ${personId} LIMIT 1
  `) as any[] : [null];
  const [a] = ref ? (await sqlPool`
    SELECT ref, payment_status, claimed_paid_at, gekuendigt_am, kuendigung_zurueckgenommen_am, vertrag_ende_am,
           account_status, onboarding_stufe, freigeschaltet_am, gdpr_deleted_at, agb_stand
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
  `) as any[] : [null];

  if (a?.gdpr_deleted_at) return { lage: "gesperrt", grund: "Daten auf Wunsch gelöscht" };
  if (p?.werbung_gesperrt_am) return { lage: "gesperrt", grund: "Werbesperre gesetzt" };
  if (a?.account_status === "suspended") return { lage: "gesperrt", grund: "Konto gesperrt" };

  // Bestreitet? Aus einer früheren Postmeister-Zeile derselben Person, 90 Tage —
  // die Kundin aus der Analyse bekam vier Automatenantworten über zwei Postfächer.
  if (personId) {
    const [b] = (await sqlPool`
      SELECT 1 FROM fiaon_postmeister
       WHERE person_id = ${personId} AND created_at > NOW() - INTERVAL '90 days'
         AND (flags->>'bestreitet' = 'true' OR flags->>'widerruf' = 'true' OR flags->>'droht_anwalt' = 'true')
       LIMIT 1
    `) as any[];
    if (b) return { lage: "bestreitet", grund: "hat die Bestellung oder Forderung schon einmal bestritten" };
  }

  if (!a) return { lage: personId ? "interessent" : "fremd", grund: personId ? "Person bekannt, keine Bestellung" : "unbekannt" };
  if (a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am && !a.vertrag_ende_am) {
    return { lage: "gekuendigt", grund: "hat gekündigt, letzte Rechnung noch offen" };
  }
  if (a.payment_status === "cancelled" || a.vertrag_ende_am) return { lage: "gesperrt", grund: "Vertrag beendet oder storniert" };
  if (a.payment_status === "claimed_paid") return { lage: "zahlung_gemeldet", grund: `hat am ${relativ(a.claimed_paid_at)} eine Zahlung gemeldet, Geld ist nicht angekommen` };
  if (a.payment_status !== "paid") return { lage: "unbezahlt", grund: "Bestellung liegt vor, erste Zahlung fehlt" };

  // 19.09.2026 (E-194): Hier stand die Ausnahme „Rate im Einzug ist nicht
  // überfällig" (02.09.) samt der Anweisung „NICHT zur Zahlung auffordern".
  // GoCardless ist beendet, eingezogenes Geld wird erstattet — jede offene,
  // fällige Rate ist überfällig und wird per Überweisung bezahlt.
  const [r] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'offen' AND faellig_am <= CURRENT_DATE)::int AS ueberfaellig
      FROM fiaon_abo_raten WHERE ref = ${ref} AND storniert_am IS NULL
  `) as any[];
  if (Number(r?.ueberfaellig || 0) > 0) return { lage: "rate_ueberfaellig", grund: `${r.ueberfaellig} Rate(n) überfällig` };
  if (!a.freigeschaltet_am && a.account_status !== "active") {
    return { lage: "bezahlt_ohne_startgespraech", grund: "bezahlt, Bereich wartet auf das Startgespräch" };
  }
  return { lage: "aktiv", grund: "bezahlt und aktiv, nichts überfällig" };
}

/** Die vollständige Akte — strukturiert, ohne Bankdaten, mit Zeitbezug. */
export async function akteLesen(personId: number | null, ref: string | null): Promise<AkteKurz & { heute: string; lageGrund: string }> {
  const { lage, grund } = await kundenlageBerechnen(personId, ref);
  const heute = berlinJetzt().text;

  const [person] = personId ? (await sqlPool`
    SELECT p.id, p.first_name, p.last_name, p.company_name, p.primary_email, p.primary_phone, p.anrede,
           p.sprache, p.sprache_notiz, p.city, p.country,
           p.werbung_gesperrt_am, p.is_blocked, p.account_status,
           a.first_name AS betreuer_vorname, a.name AS betreuer_name
      FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} LIMIT 1
  `) as any[] : [null];

  const bestellungen = personId ? (await sqlPool`
    SELECT ref, pack_key, pack_name, payment_status, amount_due, payment_reference, created_at, gekuendigt_am, letzte_rate_nr, vertrag_ende_am, agb_stand,
           city, country
      FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY created_at DESC LIMIT 6
  `) as any[] : [];

  const raten = ref ? (await sqlPool`
    SELECT rate_nr, betrag_cents, status, faellig_am, bezahlt_am, mahnstufe, zahlungsreferenz
      FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr ASC LIMIT 14
  `) as any[] : [];

  const termine = personId ? (await sqlPool`
    SELECT t.beginn, t.status, t.quelle, a.first_name AS betreuer
      FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.person_id = ${personId} ORDER BY t.beginn DESC LIMIT 6
  `) as any[] : [];

  const verlauf = ref || personId ? (await sqlPool`
    SELECT created_at, type, outcome, agent_name, note
      FROM fiaon_contact_log
     WHERE ${ref ? sqlPool`ref = ${ref}` : sqlPool`person_id = ${personId}`}
       AND voided_at IS NULL
     ORDER BY created_at DESC LIMIT 20
  `) as any[] : [];

  // Mailhistorie: unsere Serienmails UND die eigenen Postmeister-Antworten.
  const mailsRaus = personId ? (await sqlPool`
    SELECT created_at, event, status FROM fiaon_mail_log
     WHERE person_id = ${personId} AND art = 'echt' ORDER BY created_at DESC LIMIT 12
  `) as any[] : [];
  const eigene = personId ? (await sqlPool`
    SELECT created_at, betreff, LEFT(COALESCE(zusammenfassung, betreff), 160) AS kurz, aktion, antwort IS NOT NULL AS beantwortet
      FROM fiaon_postmeister WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 8
  `) as any[] : [];

  const [aufgaben] = personId || ref ? (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
     WHERE status = 'offen' AND (link LIKE ${'%' + (ref ?? '###') + '%'} OR text ILIKE ${'%' + (person?.last_name ?? '###') + '%'})
  `) as any[] : [{ n: 0 }];

  const aktuelle = bestellungen.find((b) => b.ref === ref) ?? bestellungen[0] ?? null;

  let karte: any = null;
  if (personId) {
    try {
      const { kartenStand } = await import("./fiaon-konto-karte");
      const { kartenLage } = await import("./fiaon-kartenstatus");
      const [st, lage] = await Promise.all([kartenStand(personId), kartenLage(personId)]);
      if (st) {
        karte = {
          reihenfolge: "erst Girokonto der Partnerbank, dann Karte als Zubuchung; Einladung erst, wenn alle drei Bedingungen erfüllt sind; die Bank entscheidet",
          bereit: st.bereit,
          esFehlt: st.esFehlt,
          bedingungen: st.tore.map((t) => ({ titel: t.titel, erfuellt: t.erfuellt, fehlt: t.fehlt, fuerKunden: String(t.warumFuerKunden || "").replace(/Wir empfehlen das Konto erst/i, "Der Konto-Schritt kommt erst") })),
          zahlen: st.zahlen,
          einladung: st.versand ? { am: relativ(st.versand.am), status: st.versand.status } : null,
          bankStand: lage.status ? { status: lage.status, text: lage.text, am: lage.am ? relativ(lage.am) : null } : null,
        };
      }
    } catch (e) {
      console.warn("[POSTMEISTER] Kartenstand nicht lesbar:", String((e as any)?.message || e).slice(0, 120));
    }
  }

  // ── BONITÄTSAUSKUNFT (24.09.2026, E-240) ────────────────────────────────
  // Doris Hösl schrieb „Ich hab keine." — und Mara wusste weder, ob eine
  // Auskunft bestellt, bezahlt oder hochgeladen war, noch was sie kostet. Sie
  // antwortete „fordern Sie sie in Ihrem Bereich an". Jetzt steht der Stand in
  // der Akte, aus derselben Quelle wie Kundenbereich und Bestellweg
  // (auskunftStand): Stufe, Preis für GENAU diesen Menschen, offene Bestellung.
  // Nicht für reine FIAON-Global-Kunden — deren Produkt ist ein anderes.
  const nurGlobal = bestellungen.length > 0 && bestellungen.every((b) => istGlobalPaket(b.pack_key));
  const auskunft = personId && !nurGlobal ? await auskunftDossier(personId, lage) : null;

  return {
    heute,
    personId: personId ?? null,
    name: person ? [person.first_name, person.last_name].filter(Boolean).join(" ") || person.company_name || null : null,
    anrede: person?.anrede ?? null,
    // Der Sprachvermerk aus der Akte (02.09.2026). Er wird von Hand gesetzt und
    // dient als Rückfall, wenn die Sprache einer Mail unklar ist — und als
    // Hinweis für den Menschen, der den Entwurf durchsieht.
    sprache: person?.sprache ?? null,
    spracheNotiz: person?.sprache_notiz ?? null,
    email: person?.primary_email ?? null,
    telefon: person?.primary_phone ?? null,
    betreuer: person?.betreuer_vorname || person?.betreuer_name || null,
    kundenlage: lage,
    lageGrund: grund,
    bestellungen: bestellungen.map((b) => ({
      ref: b.ref, paket: b.pack_name ? String(b.pack_name).split("\n")[0] : null,
      status: String(b.payment_status), betrag: b.amount_due != null ? String(b.amount_due) : null,
      referenz: b.payment_reference ?? null, angelegt: b.created_at ? relativ(b.created_at) : null,
    })),
    raten: raten.map((r) => ({
      nr: Number(r.rate_nr), betrag: eur(r.betrag_cents), status: String(r.status),
      faellig: r.faellig_am ? `${String(r.faellig_am).slice(0, 10)} (${relativ(r.faellig_am)})` : null,
      bezahlt: r.bezahlt_am ? relativ(r.bezahlt_am) : null,
      mahnstufe: r.mahnstufe != null ? Number(r.mahnstufe) : null,
      referenz: r.zahlungsreferenz ?? null,
    })),
    termine: termine.map((t) => ({
      beginn: `${relativ(t.beginn)}`, status: String(t.status),
      betreuer: t.betreuer ?? null, art: t.quelle ?? null,
    })),
    verlauf: verlauf.map((v) => ({
      am: relativ(v.created_at), art: String(v.type), wer: v.agent_name ?? null,
      text: String(v.note ?? v.outcome ?? "").slice(0, 220),
    })),
    mails: [
      ...eigene.map((m) => ({ am: relativ(m.created_at), richtung: "ein" as const, betreff: String(m.betreff ?? ""), kurz: `${m.kurz ?? ""} — von uns ${m.beantwortet ? "beantwortet" : "nur eingeordnet"}` })),
      ...mailsRaus.map((m) => ({ am: relativ(m.created_at), richtung: "aus" as const, betreff: String(m.event), kurz: String(m.status) })),
    ].slice(0, 16),
    // ── KARTE: Reihenfolge, Bedingung, Stand (05.09.2026, E-135; 21.09.2026, E-206) ──
    // Seit 21.09.: Einladung ab der ersten gebuchten Zahlung (vorher zwei Raten +
    // Auskunft + Unterlagen). Der Stand kommt aus derselben Abfrage wie im
    // Team-Portal (fiaon-konto-karte) — Mara liest dort, ob der Link raus ist.
    karte,
    // ── VERTRAG: Datum, Wohnort, Land (05.09.2026, E-135) ─────────────────
    // Die Härte-Stufe nennt das Vertragsdatum und das für den Wohnort
    // zuständige Gericht — beides aus der Akte, nichts geraten.
    vertrag: aktuelle ? {
      geschlossenAm: aktuelle.created_at
        ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(aktuelle.created_at))
        : null,
      ort: aktuelle.city || person?.city || null,
      land: aktuelle.country || person?.country || null,
      agbStand: aktuelle.agb_stand ?? null,
    } : null,
    kuendigung: aktuelle?.gekuendigt_am ? {
      am: relativ(aktuelle.gekuendigt_am), letzteRate: aktuelle.letzte_rate_nr ?? null,
      vertragEnde: aktuelle.vertrag_ende_am ? relativ(aktuelle.vertrag_ende_am) : null,
    } : null,
    sperren: {
      werbung: person?.werbung_gesperrt_am ? relativ(person.werbung_gesperrt_am) : null,
      anrufe: !!person?.is_blocked,
      konto: person?.account_status === "suspended" ? "gesperrt" : null,
    },
    offeneAufgaben: Number(aufgaben?.n || 0),
    auskunft,
  };
}

/** Was jede Stufe für Maras Antwort heißt — ein Satz, damit das Modell nicht rät. */
const AUSKUNFT_BEDEUTUNG: Record<AuskunftDossier["stufe"], string> = {
  nichts: "Keine Auskunft bestellt und keine in der Akte — anbieten: auskunft_anbieten rufen, Preis und Knopf kommen von dort.",
  offen: "Auskunft bestellt, Zahlung offen — keine zweite Bestellung; auskunft_anbieten liefert dieselbe Zahlungsseite. Steht offen.gemeldet auf true, hat der Kunde die Zahlung schon gemeldet: nicht erneut zur Zahlung auffordern.",
  bezahlt: "Auskunft bezahlt — nicht noch einmal verkaufen; FIAON fordert sie an, der Betreuer geht die Auswertung mit dem Kunden durch.",
  dokument: "Eine Auskunft liegt schon in der Akte (hochgeladen oder geliefert) — nichts verkaufen.",
};

/**
 * Welche Auskunft passt — privat oder für die Firma? (24.09.2026, E-240,
 * Gegenlesen) Dieselbe Regel wie der
 * Verkaufstakt (fiaon-auskunft-verkauf.ts, waVorlagenWerte): Ein laufendes
 * FIAON-Business-Paket heißt Firmen-Auskunft (199/349 €), alles andere privat.
 * Vorher bekam ein Business-Kunde von Mara die Privat-Auskunft zu 74 € und vom
 * Verkaufstakt die Firmen-Auskunft zu 199 € (6 Personen, 24.09.).
 */
export async function auskunftArtFuer(personId: number): Promise<"privat" | "firma"> {
  // 25.09.2026: die Regel steht jetzt EINMAL in server/lib/fiaon-auskunft.ts.
  const { auskunftArtFuer: zentral } = await import("./fiaon-auskunft");
  return zentral(personId);
}

/**
 * Der Auskunft-Abschnitt der Akte. Scheitert die Abfrage, fehlt der Abschnitt —
 * die Mail wird trotzdem beantwortet (dann eben ohne Angebot).
 */
export async function auskunftDossier(personId: number, lage?: Kundenlage | null): Promise<AuskunftDossier | null> {
  try {
    const { auskunftStand } = await import("./fiaon-auskunft");
    // Gegenlesen E-240: dieselbe Art wie auskunft_anbieten — sonst stünde für einen
    // Business-Kunden hier 74 € und im Werkzeug 199 €.
    // Integration 25.09.2026 (E-241): bei offenem Antrag und Interessent wie das Werkzeug aus der
    // Grundmenge des Takts (auskunftArtLandVerkauf) — sonst stand für einen Business-Antrag hier
    // „privat, 149 €", während Werkzeug und Angebots-Mail 349 € nennen. Das Land kommt für Leads
    // seit E-241 aus auskunftStand (landOhneAntrag), also schon passend.
    const { AUSKUNFT_ANTWORT_LAGEN } = await import("@shared/fiaon-postmeister-typen");
    const art = lage && AUSKUNFT_ANTWORT_LAGEN.includes(lage)
      ? (await (await import("./fiaon-postmeister-werkzeuge")).auskunftArtLandVerkauf(personId)).art
      : await auskunftArtFuer(personId);
    const s = await auskunftStand(personId, sqlPool, art);
    return {
      stufe: s.stufe,
      art,
      bedeutung: AUSKUNFT_BEDEUTUNG[s.stufe],
      land: s.land,
      wort: auskunftWort(s.land),
      auskunfteien: auskunfteienText(s.land),
      preis: {
        fuerIhn: s.preis.text,
        // „74.00" — die Belegprüfung vergleicht Beträge in Punktschreibweise.
        betragZahl: (s.preis.cents / 100).toFixed(2),
        mitPaket: s.preis.mitAbo,
        einzeln: euroText(AUSKUNFT_PREISE_CENTS[art].einzeln),
        kundenpreis: euroText(AUSKUNFT_PREISE_CENTS[art].mitAbo),
      },
      offen: s.offen ? {
        verwendungszweck: s.offen.paymentReference,
        betrag: euroText(s.offen.betragCents),
        gemeldet: s.offen.status === "claimed_paid",
        seit: relativ(s.offen.angelegt),
      } : null,
    };
  } catch (e) {
    console.warn("[POSTMEISTER] Auskunft-Stand nicht lesbar:", String((e as any)?.message || e).slice(0, 120));
    return null;
  }
}

/** Welche Vertragsfassung gilt für diesen Kunden? Entscheidet den Wortlaut. */
export async function vertragsfassung(ref: string | null): Promise<{ jahresvertrag: boolean; text: string }> {
  if (!ref) return { jahresvertrag: false, text: "keine Bestellung" };
  const [a] = (await sqlPool`SELECT agb_stand, pack_key FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  // E-188: Ein Auftrag über FIAON Global ist kein Abo — Mara bekäme sonst die Zwölf-Monats-Regeln der
  // Privatkunden als „VERTRAG" in den Prompt und würde einem Unternehmen Monatsraten und Kündigungsfristen erklären.
  if (istGlobalPaket(a?.pack_key)) {
    return {
      jahresvertrag: false,
      text: "FIRMENAUFTRAG ÜBER FIAON GLOBAL — KEIN ABO. Einmalpreis, bezahlt einmal per Überweisung auf Rechnung; es gibt keine Monatsraten, "
        + "keine Lastschrift, keine Mindestlaufzeit, keine Mahnkette und keinen Kundenbereich mit Passwort. Der Kunde hat die Seite „Mein Auftrag“ "
        + "(Stand, Vertrag, Rechnung, Unterlagen, Fristen); den Link dorthin schickst du mit global_zugang_senden. Mit dem Zahlungseingang beginnt der "
        + "Auftrag, die zuständige Person führt das Startgespräch. Storno, Beendigung, Erstattung und die Geld-zurück-Zusage entscheidet die Leitung — "
        + "sage dazu nichts zu, sondern gib das Anliegen mit aufgabe_an_betreuer an die zuständige Person. Über Konto, Karte, Rahmen und Darlehen "
        + "entscheidet allein das jeweilige Institut; Steuer- und Rechtsfragen beantworten Steuerberater und Anwälte auf eigenes Mandat, FIAON koordiniert.",
    };
  }
  const neu = !!a?.agb_stand && new Date(a.agb_stand) >= new Date("2026-09-03");
  return {
    jahresvertrag: neu,
    text: neu
      ? "Zwölf Monate Erstlaufzeit, in zwölf Monatsraten gestellt. Vorzeitige Beendigung ist Kulanz und wird wirksam, sobald die bereits gestellte Rate bezahlt ist."
      : "Vertrag nach der bis 02.09.2026 gültigen Fassung: monatlich kündbar zum Monatsende. Die bereits gestellte Rate bleibt zu zahlen.",
  };
}
