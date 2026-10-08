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

import * as abw from "./fiaon-abwesenheit";
import { sqlPool } from "./db-pool";
import type { Kundenlage, AkteKurz, AuskunftDossier } from "@shared/fiaon-postmeister-typen";
import { istGlobalPaket } from "@shared/fiaon-pakete";
import { antragAbgeschickt, istJahresvertrag, abrechnungsmonatEnde } from "@shared/fiaon-antrag-stand";
import { auskunftWort, auskunfteienText, euroText, AUSKUNFT_PREISE_CENTS } from "@shared/fiaon-auskunft";
import { nennform, nennformSql } from "@shared/fiaon-mitarbeiter-name";
import { kartenZiel, kartenzielText, kuendigungRatenAufteilen } from "@shared/fiaon-mara-ton";
// E-272 (02.10.2026): Global-Kunde als Merkmal der PERSON — die eine Regel (fiaon-global-kunde.ts).
import { istGlobalKunde } from "./fiaon-global-kunde";
import { produktkategorie, produktkategorieSql } from "./fiaon-produktkategorie";

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
 * E-272 (02.10.2026): Eine LEBENDE Global-Zeile, als SQL über die unqualifizierten
 * Spalten von fiaon_applications — dieselbe „lebend“-Regel wie in
 * fiaon-global-kunde.ts (kein Entwurf, nicht superseded, nicht DSGVO-gelöscht,
 * nicht archiviert außer bezahlt; merged_into prüft die Abfrage selbst).
 */
const LEBENDE_GLOBAL_ZEILE = `(${produktkategorieSql()} = 'global'
  AND NOT COALESCE(ist_entwurf, FALSE) AND payment_status <> 'superseded'
  AND gdpr_deleted_at IS NULL AND (archived_at IS NULL OR payment_status = 'paid'))`;

/**
 * E-272 (02.10.2026): Was der Postmeister über den Global-Teil eines Menschen
 * wissen muss — seine Individualangebote (auch die der Person, die in ihm
 * aufgegangen ist, zwei Stufen wie die Regel) und seine Global-Aufträge.
 * Nur für Global-Kunden gerufen; scheitert die Abfrage, leere Listen.
 */
async function globalTeil(personId: number): Promise<{
  angebote: { ref: string; status: string; gueltigBis: string | null }[];
  auftraege: { ref: string; paket: string | null; status: string }[];
}> {
  const tag = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }) : null);
  const angebote = (await sqlPool`
    SELECT g.angebot_ref, g.status, g.gueltig_bis
      FROM fiaon_global_angebote g
     WHERE g.person_id = ${personId}
        OR g.person_id IN (SELECT p1.id FROM fiaon_persons p1 WHERE p1.merged_into_person_id = ${personId})
        OR g.person_id IN (SELECT p2.id FROM fiaon_persons p2 JOIN fiaon_persons p1 ON p1.id = p2.merged_into_person_id
                            WHERE p1.merged_into_person_id = ${personId})
     ORDER BY g.created_at DESC LIMIT 5
  `.catch(() => [])) as any[];
  const auftraege = (await sqlPool`
    SELECT ref, pack_name, payment_status FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND ${sqlPool.unsafe(LEBENDE_GLOBAL_ZEILE)}
     ORDER BY created_at DESC LIMIT 5
  `.catch(() => [])) as any[];
  return {
    angebote: angebote.map((g) => ({ ref: String(g.angebot_ref), status: String(g.status), gueltigBis: tag(g.gueltig_bis) })),
    auftraege: auftraege.map((a) => ({ ref: String(a.ref), paket: a.pack_name ? String(a.pack_name).split("\n")[0] : null, status: String(a.payment_status) })),
  };
}

/**
 * E-272 (02.10.2026): Der Satz für Lage und Akte eines Global-Kunden, dessen
 * Vorgang KEIN Global-Auftrag ist (nur ein Individualangebot, daneben höchstens
 * ein alter Privatantrag oder eine Auskunft). Er sagt dem Modell, was gilt.
 */
function globalOhneAuftragGrund(t: Awaited<ReturnType<typeof globalTeil>>): string {
  const angebot = t.angebote[0];
  const was = angebot
    ? `Individualangebot ${angebot.ref} (Status ${angebot.status}${angebot.gueltigBis ? `, gültig bis ${angebot.gueltigBis}` : ""})`
    : "Vorgang bei FIAON Global";
  return `Kunde von FIAON Global — ${was}, KEIN Privatkunde. Kein Privatantrag, keine Kreditkarte, keine Raten, keine Bonitätsauskunft, `
    + "keine Zahlungsaufforderung für eine Privatbestellung; sein Anliegen gibst du mit aufgabe_an_betreuer an seine Ansprechperson bei FIAON Global";
}

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
    //
    // ── BEIM GLOBAL-KUNDEN IST DER VORGANG SEIN GLOBAL-AUFTRAG (E-272, 02.10.2026) ──
    // Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er
    // soll Global bleiben, also keine unnötigen Mails.“ Bei gleichem Zahlstand
    // gewann hier bisher die jüngste Zeile — bei einem Global-Kunden mit
    // gekaufter Auskunft die Auskunft, sonst womöglich ein alter Privatantrag.
    // Vertrag, Lage und global_zugang_senden lesen aber genau diesen Vorgang.
    // Für den Global-Kunden (istGlobalKunde) geht deshalb eine LEBENDE
    // Global-Zeile vor (LEBENDE_GLOBAL_ZEILE, dieselbe Regel). Für alle anderen —
    // auch „gemischte“ mit bezahltem Stufenpaket — bleibt die Reihenfolge.
    const globalZuerst = (await istGlobalKunde(personId)) ? `${LEBENDE_GLOBAL_ZEILE} DESC,` : "";
    const [b] = (await sqlPool`
      SELECT ref FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
       ORDER BY ${sqlPool.unsafe(globalZuerst)} (payment_status = 'paid') DESC, (payment_status <> 'cancelled') DESC,
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
 *
 * `opt.globalKunde`: schon bekannt (akteLesen fragt einmal) — sonst fragt die
 * Funktion selbst (istGlobalKunde, E-272).
 */
export async function kundenlageBerechnen(personId: number | null, ref: string | null, opt: { globalKunde?: boolean } = {}): Promise<{ lage: Kundenlage; grund: string }> {
  const r = await kundenlageRoh(personId, ref, opt);
  // E-275 (02.10.2026): Beim zahlenden Kunden mit Werbesperre steht die Sperre im Grund — die Lage bleibt seine echte.
  return r.werbesperreZahlend
    ? { lage: r.lage, grund: `${r.grund} · ${WERBESPERRE_ZAHLEND_SATZ}` }
    : { lage: r.lage, grund: r.grund };
}

/**
 * E-275 (02.10.2026): Was die Werbesperre beim ZAHLENDEN Kunden heißt — ein Satz für Lage, Akte und Auftrag.
 * Justin: „Mara soll selbstständig arbeiten … Mara soll selbst verkaufen.“ Und die Wand des Hauses: STOPP heißt keine
 * WERBUNG mehr (§ 7 UWG) — Service für einen zahlenden Kunden ist keine Werbung.
 */
export const WERBESPERRE_ZAHLEND_SATZ = "Werbesperre gesetzt: keine Werbung, kein Angebot, kein Upsell (keine Bonitätsauskunft, kein Upgrade) — sein Service läuft wie bei jedem zahlenden Kunden (Karte, Zahlung, Unterlagen, Zugang, Fragen erledigst du selbst)";

async function kundenlageRoh(personId: number | null, ref: string | null, opt: { globalKunde?: boolean } = {}): Promise<{ lage: Kundenlage; grund: string; werbesperreZahlend?: boolean }> {
  if (!personId && !ref) return { lage: "fremd", grund: "kein Kundendatensatz zur Absenderadresse" };

  const [p] = personId ? (await sqlPool`
    SELECT werbung_gesperrt_am, is_blocked, account_status FROM fiaon_persons WHERE id = ${personId} LIMIT 1
  `) as any[] : [null];
  const [a] = ref ? (await sqlPool`
    SELECT ref, payment_status, claimed_paid_at, gekuendigt_am, kuendigung_zurueckgenommen_am, vertrag_ende_am,
           account_status, onboarding_stufe, freigeschaltet_am, gdpr_deleted_at, agb_stand,
           status, current_step, submitted_at, created_at, person_id, type, pack_key
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
  `) as any[] : [null];

  // ── E-272 (02.10.2026): DER GLOBAL-KUNDE IST KEIN PRIVAT-INTERESSENT ────────
  // Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er
  // soll Global bleiben, also keine unnötigen Mails.“ William Hildbrand hatte ein
  // offenes Individualangebot und daneben einen nie abgeschickten, archivierten
  // Privatantrag. Dieser Vorgang machte ihn hier zum „interessent“ — und der
  // Auftrag an Mara lautete: zum Privatantrag führen, Kreditkarte abschließen.
  // Jetzt entscheidet die PERSON (istGlobalKunde, die eine Regel):
  //   · Ist der Vorgang eine Global-Zeile, rechnet die Lage wie bisher daraus
  //     (E-188: unbezahlt, Zahlung gemeldet, bezahlt …).
  //   · Sonst (nur Angebot, daneben höchstens Privatantrag oder Auskunft):
  //     Lage „unklar“ — kein Privatvorgang, Schritte nur Rückruf oder „wir
  //     melden uns“, Antwort als Entwurf für einen Menschen; der Grund sagt
  //     dem Modell, was gilt (globalOhneAuftragGrund).
  //   · Die WERBESPERRE macht ihn nicht „gesperrt“. Sie schließt Werbung aus,
  //     nicht die Antwort auf seine Frage — und „gesperrt“ nahm ihm die
  //     Zahlungsseite seines Global-Auftrags (zahlungslink_bauen gibt es dort
  //     nicht, einziger Schritt „erledigt“). Verkauft wird ihm ohnehin nichts:
  //     die Global-Wand (fiaon-postmeister-werkzeuge.ts) sperrt die Privat-Werkzeuge.
  // „Gemischte“ (bezahltes Stufenpaket) sind keine Global-Kunden — für sie gilt alles wie bisher.
  const pid = personId ?? (a?.person_id != null ? Number(a.person_id) : null);
  const globalKunde = opt.globalKunde ?? (pid ? await istGlobalKunde(pid) : false);
  const globalOhneAuftrag = globalKunde && !(a && produktkategorie(a) === "global");

  if (a?.gdpr_deleted_at) return { lage: "gesperrt", grund: "Daten auf Wunsch gelöscht" };
  // ── E-275 (02.10.2026): DIE WERBESPERRE SPERRT DEN ZAHLENDEN KUNDEN NICHT AUS ──────────────
  // Justin: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber selbstständig arbeiten.“ Der Fall
  // #6120: Satpal Jhim hat FIAON Ultra bezahlt, fragt nach seiner Karte — seit einer Werbesperre vom 09.09.
  // war er hier „gesperrt“: einziger Schritt „erledigt“, keine Zahlungsseite, nie automatisch, jede Mail eine
  // Übergabe („I have asked Nikita Boychenko …“). Gemessen (nur lesend, 18.09.–02.10.): 89 Mails in Lage
  // „gesperrt“ von 33 Personen, bei 62 die Werbesperre schon vorher gesetzt, 51 davon zahlende Kunden.
  // Jetzt: Ist der Vorgang BEZAHLT, rechnet die Lage weiter wie ohne Sperre (aktiv, Rate überfällig,
  // gekündigt …); die Sperre steht im Grund (WERBESPERRE_ZAHLEND_SATZ) und hält Werbung und Upsell fern
  // (Auftrag, auskunft_anbieten, werkzeugeFuerLage). Unbezahlte bleiben „gesperrt“ wie bisher.
  const zahlend = a?.payment_status === "paid";
  if (p?.werbung_gesperrt_am && !globalKunde && !zahlend) return { lage: "gesperrt", grund: "Werbesperre gesetzt" };
  const werbesperreZahlend = !!p?.werbung_gesperrt_am && !globalKunde && zahlend;
  if (a?.account_status === "suspended" && !globalOhneAuftrag) return { lage: "gesperrt", grund: "Konto gesperrt" };
  if (werbesperreZahlend) {
    const weiter = await kundenlageOhneWerbesperre(personId, ref, a, globalOhneAuftrag, pid);
    return { ...weiter, werbesperreZahlend: weiter.lage !== "gesperrt" };
  }
  return kundenlageOhneWerbesperre(personId, ref, a, globalOhneAuftrag, pid);
}

/** Der Rest der Rangfolge (nach Löschung, Werbesperre und Kontosperre) — unverändert aus kundenlageBerechnen herausgelöst (E-275). */
async function kundenlageOhneWerbesperre(
  personId: number | null, ref: string | null, a: any, globalOhneAuftrag: boolean, pid: number | null,
): Promise<{ lage: Kundenlage; grund: string }> {

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

  // E-272: Global-Kunde ohne Global-Auftrag im Vorgang — nie „interessent“ (siehe oben).
  if (globalOhneAuftrag && pid) return { lage: "unklar", grund: globalOhneAuftragGrund(await globalTeil(pid)) };

  if (!a) return { lage: personId ? "interessent" : "fremd", grund: personId ? "Person bekannt, keine Bestellung" : "unbekannt" };
  if (a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am && !a.vertrag_ende_am) {
    return { lage: "gekuendigt", grund: "hat gekündigt, letzte Rechnung noch offen" };
  }
  if (a.payment_status === "cancelled" || a.vertrag_ende_am) return { lage: "gesperrt", grund: "Vertrag beendet oder storniert" };
  if (a.payment_status === "claimed_paid") return { lage: "zahlung_gemeldet", grund: `hat am ${relativ(a.claimed_paid_at)} eine Zahlung gemeldet, Geld ist nicht angekommen` };
  // E-264 (29.09.2026): „unbezahlt" hieß bis heute JEDE nicht bezahlte Bestellung — auch ein Antrag,
  // der bei Schritt 5 stehen blieb (approved + pending_payment setzt der Antragsweg VOR dem Vertrag).
  // Mara forderte so Geld ohne Vertrag. Nie abgeschickt (antragAbgeschickt, EINE Regel) heißt:
  // Interessent mit angefangenem Antrag — Schritt „antrag" (Wiedereinstieg), keine Zahlungsseite.
  if (a.payment_status !== "paid" && !antragAbgeschickt(a)) {
    return { lage: "interessent", grund: `Antrag am ${relativ(a.created_at)} angefangen (Schritt ${Number(a.current_step || 0)}), NIE abgeschickt — kein Vertrag, keine Rechnung, keine offene Zahlung` };
  }
  if (a.payment_status !== "paid") return { lage: "unbezahlt", grund: "Antrag abgeschickt, erste Zahlung fehlt" };

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

/**
 * E-272 (02.10.2026): Der Global-Teil der Akte — nur für Global-Kunden
 * (istGlobalKunde), sonst null. Steht im Auftrag an das Modell (akteKompakt
 * nimmt jedes Feld mit) und sagt ihm in `regel`, was für diesen Menschen gilt.
 */
export interface AkteGlobal {
  kunde: true;
  angebote: { ref: string; status: string; gueltigBis: string | null }[];
  auftraege: { ref: string; paket: string | null; status: string }[];
  regel: string;
}

/** Die vollständige Akte — strukturiert, ohne Bankdaten, mit Zeitbezug. */
export async function akteLesen(personId: number | null, ref: string | null): Promise<AkteKurz & { heute: string; lageGrund: string; global: AkteGlobal | null }> {
  // E-272 (02.10.2026): einmal fragen — Lage, Auskunft, Karte und Global-Teil lesen dieselbe Antwort.
  const globalKunde = personId ? await istGlobalKunde(personId) : false;
  const { lage, grund } = await kundenlageBerechnen(personId, ref, personId ? { globalKunde } : {});
  const heute = berlinJetzt().text;

  const [person] = personId ? (await sqlPool`
    SELECT p.id, p.first_name, p.last_name, p.company_name, p.primary_email, p.primary_phone, p.anrede,
           p.sprache, p.sprache_notiz, p.city, p.country,
           p.werbung_gesperrt_am, p.is_blocked, p.account_status,
           a.first_name AS betreuer_vorname, a.name AS betreuer_name,
           -- E-265 (29.09.2026): Anrede und Nachname — Mara nennt den Betreuer „Herr Stripling", nie „Daniel".
           a.anrede AS betreuer_anrede, a.last_name AS betreuer_nachname
      FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
     WHERE p.id = ${personId} LIMIT 1
  `) as any[] : [null];

  const bestellungen = personId ? (await sqlPool`
    SELECT ref, pack_key, pack_name, payment_status, amount_due, payment_reference, created_at, gekuendigt_am, letzte_rate_nr, vertrag_ende_am, agb_stand,
           city, country, status, current_step, submitted_at, wanted_limit, kuendigung_zurueckgenommen_am,
           -- E-265 (01.10.2026): der Anker für den Abrechnungsmonat (Rückfall ohne Ratenkette)
           COALESCE(paid_at, completed_at, created_at) AS anker
      FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY created_at DESC LIMIT 6
  `) as any[] : [];

  const raten = ref ? (await sqlPool`
    SELECT rate_nr, betrag_cents, status, faellig_am, bezahlt_am, mahnstufe, zahlungsreferenz
      FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr ASC LIMIT 14
  `) as any[] : [];

  const termine = personId ? (await sqlPool`
    SELECT t.beginn, t.status, t.quelle, t.agent_id, ${sqlPool.unsafe(nennformSql("a"))} AS betreuer
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

  // E-IT-F (08.10.2026): offene Aufgaben dieses Kunden über person_id/ref (Migration 102). VORHER nur
  // status = 'offen' (Angenommene fehlten) und ein Nachnamen-ILIKE im Text — der zählte fremde Kunden mit
  // demselben Nachnamen. Rückfall über den Link nur für Zeilen, die noch nicht zugeordnet sind.
  const [aufgaben] = personId || ref ? (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos
     WHERE status <> 'erledigt'
       AND ((${personId ?? null}::int IS NOT NULL AND person_id = ${personId ?? null}::int)
         OR (${ref ?? null}::text IS NOT NULL AND ref = ${ref ?? null}::text)
         OR (zugeordnet_am IS NULL AND link LIKE ${'%' + (ref ?? '###') + '%'}))
  `.catch(() => [{ n: 0 }])) as any[] : [{ n: 0 }];

  const aktuelle = bestellungen.find((b) => b.ref === ref) ?? bestellungen[0] ?? null;

  // ── WAS NACH DER KÜNDIGUNG WIRKLICH ZU ZAHLEN IST (E-265 Schluss-Nachbesserung, 01.10.2026, Probe 3 M3) ──────
  // Vorher stand hier `letzteRate: letzte_rate_nr` ungeprüft. M3 (#5779): Altvertrag, gekündigt am 06.09. → Vertragsende
  // 30.09.; Rate 3 war erst am 06.10. fällig und hieß trotzdem „die letzte Rate", zahlungslink_bauen baute ihre Seite, und
  // Mara band das Kündigungsschreiben an ihre Buchung. Jetzt dieselbe Rechnung wie Werkzeug, Urkunde und Bestätigungsmail
  // (kuendigungRatenAufteilen): Altvertrag — zu zahlen ist nur, was bis zum Vertragsende fällig ist; Jahresvertrag — was
  // offen steht (bis zur letzten Rate). Raten nach dem Vertragsende stehen getrennt und werden nie verlangt.
  // E-265 (01.10.2026, Recht): Das Vertragsende beim Altvertrag ist das Ende des Abrechnungsmonats (Fälligkeit zu
  // Fälligkeit, aus der ganzen Ratenkette) — dieselbe Rechnung wie kuendigungSetzen (abrechnungsmonatEnde).
  const tagBerlin = (v: unknown): string | null => (v ? new Date(v as any).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null);
  // Nachbesserung Recht (01.10.2026, Gegenprüfung M2): das Vertragsende beim Altvertrag über die EINE Lesestelle
  // (vertragsendeLesen) — ein zu früh gesetztes vertrag_ende_am (Zahltag aus Altdaten) zählt dort nicht; vorher las die
  // Akte die Spalte roh und nannte nach der Zahlung den Zahltag statt des Endes des Abrechnungsmonats.
  const endeAltLese: string | null = aktuelle?.gekuendigt_am && !aktuelle?.kuendigung_zurueckgenommen_am && !istJahresvertrag(aktuelle.agb_stand)
    ? (await (await import("./fiaon-kuendigung")).vertragsendeLesen(String(aktuelle.ref)).catch(() => ({ ende: null as string | null }))).ende
    : null;
  const kPlan = aktuelle?.gekuendigt_am && !aktuelle?.kuendigung_zurueckgenommen_am ? (() => {
    const jahresvertrag = istJahresvertrag(aktuelle.agb_stand);
    const ende = jahresvertrag ? null
      : (endeAltLese ?? abrechnungsmonatEnde(aktuelle.gekuendigt_am, raten.map((r) => r.faellig_am), { anker: aktuelle.anker ?? null }));
    const offen = raten
      .filter((r) => r.status === "offen" && (aktuelle.letzte_rate_nr == null || Number(r.rate_nr) <= Number(aktuelle.letzte_rate_nr)))
      .map((r) => ({ nr: Number(r.rate_nr), cents: Number(r.betrag_cents) || 0, faellig: tagBerlin(r.faellig_am), referenz: r.zahlungsreferenz ?? null }));
    const { zuZahlen, nachEnde } = kuendigungRatenAufteilen(offen, { jahresvertrag, vertragsEnde: ende });
    return { jahresvertrag, ende, zuZahlen, nachEnde, letzte: zuZahlen.length ? Math.max(...zuZahlen.map((r) => r.nr)) : null };
  })() : null;
  const deTag = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : null);

  let karte: any = null;
  // E-272: Konto und Karte der Partnerbank sind ein Privatprodukt — für den Global-Kunden kein Thema der Akte.
  if (personId && !globalKunde) {
    try {
      const { kartenStand } = await import("./fiaon-konto-karte");
      const { kartenLage } = await import("./fiaon-kartenstatus");
      // E-275: bankLage (vorher „lage“) — der Name verdeckte hier die Kundenlage, die der Block jetzt auch liest.
      const [st, bankLage] = await Promise.all([kartenStand(personId), kartenLage(personId)]);
      if (st) {
        // E-275 (02.10.2026): Der Weg positiv und mit dem Werkzeug — vorher endete er mit „die Bank entscheidet“, und
        // Mara schrieb daraus „The card itself is issued and sent by the bank … I have asked Nikita Boychenko“ (#6120).
        const zahlendJetzt = ["aktiv", "rate_ueberfaellig", "bezahlt_ohne_startgespraech"].includes(lage);
        // E-275 Gegenprüfung (02.10.2026, Wahrheit und Recht): „direkt nach der Zahlung der Link“ stimmt nur mit vollständigem
        // Antrag — die Einladung (einladungenAutomatisch) verlangt Name, Geburtsdatum, Anschrift, E-Mail. Gemessen (nur lesend,
        // 02.10.): 20 von 452 abgeschickten, unbezahlten Anträgen der letzten 60 Tage fehlt etwas (13× nur das Geburtsdatum).
        // Dann nennt die Akte, WAS fehlt, und der Abschluss verspricht den Link erst mit vollständigen Angaben.
        // Nicht beim Interessenten: Sein nächster Schritt ist der Antrag selbst (Abschluss „abbrecher“/„c“), dort stehen die Angaben.
        const antragLuecke = lage !== "interessent" && st.tore.find((t) => t.schluessel === "antrag")?.erfuellt === false
          ? ((await import("./fiaon-konto-karte").then((m) => m.karteEinladungStand(personId)).catch(() => null))?.fehlendeAngaben ?? ["Angaben im Antrag (Name, Geburtsdatum, Anschrift)"])
          : [];
        karte = {
          reihenfolge: "Mit dem Link unserer Partnerbank beantragt er online in wenigen Minuten Girokonto und Karte (nur Ausweis); die Visa-Kreditkarte kommt als Zubuchung dazu. Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei ihm, meist vorher schon in der App mit Apple Pay nutzbar.",
          wasTun: antragLuecke.length
            ? `Im Antrag fehlt noch: ${antragLuecke.join(", ")}. Der Link geht erst raus, wenn das eingetragen ist${st.zahlen.paketBezahlt ? "" : " UND die erste Zahlung gebucht ist"} — frag ihn danach; versprich nicht „direkt nach der Zahlung der Link“.`
            : !st.bereit
            ? "Die Einladung geht erst nach der ersten gebuchten Zahlung raus — Abschluss: Zahlung = Aktivierung, dann sofort der Link."
            : zahlendJetzt
              ? (st.versand
                ? "Der Link ist raus (Feld einladung). Fragt er nach Karte oder Link oder hat ihn nicht: karte_senden — es prüft den Stand und schickt ihn erneut."
                : "Der Link ist NOCH NICHT raus — karte_senden schickt ihn jetzt.")
              : "Bereit — den Link schickt karte_senden, sobald er zahlender Kunde in einer der Lagen aktiv, rate_ueberfaellig oder bezahlt_ohne_startgespraech ist.",
          bereit: st.bereit,
          esFehlt: st.esFehlt,
          // E-275 Gegenprüfung: in Worten, für Abschluss und Frage („Geburtsdatum“). Leer, wenn der Antrag vollständig ist.
          fehlendeAngaben: antragLuecke,
          bedingungen: st.tore.map((t) => ({ titel: t.titel, erfuellt: t.erfuellt, fehlt: t.fehlt, fuerKunden: String(t.warumFuerKunden || "").replace(/Wir empfehlen das Konto erst/i, "Der Konto-Schritt kommt erst") })),
          zahlen: st.zahlen,
          einladung: st.versand ? { am: relativ(st.versand.am), status: st.versand.status } : null,
          bankStand: bankLage.status ? { status: bankLage.status, text: bankLage.text, am: bankLage.am ? relativ(bankLage.am) : null } : null,
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
  // E-272 (02.10.2026): auch jeder Global-Kunde (an der Person, istGlobalKunde) — ein alter Privatantrag
  // daneben machte aus ihm sonst einen Menschen, dem die Akte „anbieten: auskunft_anbieten rufen“ sagt.
  const nurGlobal = globalKunde || (bestellungen.length > 0 && bestellungen.every((b) => istGlobalPaket(b.pack_key)));
  const auskunftRoh = personId && !nurGlobal ? await auskunftDossier(personId, lage) : null;
  // E-275 (02.10.2026): Werbesperre — die Auskunft wird nicht angeboten (Upsell), ihr Stand bleibt lesbar (Service).
  const auskunft = auskunftRoh && person?.werbung_gesperrt_am && (auskunftRoh.stufe === "nichts" || auskunftRoh.stufe === "offen")
    ? { ...auskunftRoh, bedeutung: "Werbesperre: Die Auskunft bietest du NICHT an (kein Upsell, kein Preis, kein Knopf). Fragt er selbst danach, beantwortest du seine Frage sachlich." }
    : auskunftRoh;

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
    // E-265 (29.09.2026, Justin „zum letzten Mal!!"): die Nennform („Herr Stripling"), vorher der Vorname.
    // E-272 (02.10.2026): Beim Global-Kunden keiner — sein Ansprechpartner sitzt bei FIAON Global, nicht im
    // Privatvertrieb; ein noch eingetragener Privat-Betreuer stünde sonst als „sein fester Betreuer“ im Auftrag.
    betreuer: !globalKunde && (person?.betreuer_name || person?.betreuer_vorname)
      ? nennform({ anrede: person.betreuer_anrede, first_name: person.betreuer_vorname, last_name: person.betreuer_nachname, name: person.betreuer_name }).nom
      : null,
    // E-265: sein Kartenziel — wanted_limit, gedeckelt auf den Rahmen seines Pakets (wie WhatsApp und Telefonkartei).
    kartenziel: await (async () => {
      // E-272: Das Wunschlimit gehört zum Privatantrag — beim Global-Kunden nennt Mara keins.
      if (globalKunde) return null;
      const b = bestellungen.find((x) => x.wanted_limit != null && Number(x.wanted_limit) > 0 && !istGlobalPaket(x.pack_key));
      if (!b) return null;
      const { PACK_LIMITS } = await import("../routes/fiaon-antrag");
      const z = kartenZiel({ wunschEuro: Number(b.wanted_limit), rahmenEuro: PACK_LIMITS[String(b.pack_key ?? "").toLowerCase()] ?? null, paketKey: b.pack_key ?? null });
      return z ? { ...z, text: kartenzielText(z) } : null;
    })(),
    // E-260 (29.09.2026): Team abwesend — der feste Betreuer bleibt stehen, daneben, wer bis wann
    // wirklich anruft (fiaon-abwesenheit.ts). Gegenprüfung 29.09.: vorher stand der Vertreter im
    // Feld „betreuer" — die Persona nannte ihn dann „sein fester Betreuer".
    vertretung: await (async () => {
      const vt = personId && !globalKunde ? await abw.vertretungFuerPerson(personId).catch(() => null) : null;
      return vt ? { name: vt.ab.vertreter.anrufName, dat: vt.ab.vertreter.anrufDat, bis: abw.bisText(vt.ab.bis) } : null;
    })(),
    kundenlage: lage,
    lageGrund: grund,
    // E-264: Ein nie abgeschickter Antrag ist keine Rechnung — ohne Verwendungszweck in der Akte,
    // damit das Modell ihn nicht als offene Zahlung liest (Fall 29.09.).
    bestellungen: bestellungen.map((b) => {
      const abgeschickt = b.payment_status === "paid" || antragAbgeschickt(b);
      const offenOhneAntrag = !abgeschickt && ["pending", "pending_payment", "expired"].includes(String(b.payment_status));
      return {
        ref: b.ref, paket: b.pack_name ? String(b.pack_name).split("\n")[0] : null,
        status: offenOhneAntrag ? "antrag_nicht_abgeschickt" : String(b.payment_status), betrag: b.amount_due != null ? String(b.amount_due) : null,
        referenz: offenOhneAntrag ? null : (b.payment_reference ?? null), angelegt: b.created_at ? relativ(b.created_at) : null,
        abgeschickt,
      };
    }),
    raten: raten.map((r) => ({
      nr: Number(r.rate_nr), betrag: eur(r.betrag_cents), status: String(r.status),
      faellig: r.faellig_am ? `${String(r.faellig_am).slice(0, 10)} (${relativ(r.faellig_am)})` : null,
      bezahlt: r.bezahlt_am ? relativ(r.bezahlt_am) : null,
      mahnstufe: r.mahnstufe != null ? Number(r.mahnstufe) : null,
      referenz: r.zahlungsreferenz ?? null,
      // E-265 Schluss-Nachbesserung: eine Rate nach dem Vertragsende (Altvertrag, gekündigt) — nie verlangen.
      ...(kPlan?.nachEnde.some((x) => x.nr === Number(r.rate_nr)) ? { nachVertragsende: true } : {}),
    })),
    termine: await Promise.all(termine.map(async (t) => ({
      beginn: `${relativ(t.beginn)}`, status: String(t.status),
      betreuer: t.betreuer && t.status === "gebucht" ? await abw.anruferFuer(Number(t.agent_id), t.beginn, String(t.betreuer), undefined, t.quelle) : t.betreuer ?? null,
      art: t.quelle ?? null,
    }))),
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
      am: relativ(aktuelle.gekuendigt_am),
      // E-265 Schluss-Nachbesserung: die letzte Rate, die WIRKLICH zu zahlen ist (kuendigungRatenAufteilen) — nie eine nach dem Vertragsende.
      letzteRate: kPlan ? kPlan.letzte : aktuelle.letzte_rate_nr ?? null,
      vertragEnde: aktuelle.vertrag_ende_am ? relativ(aktuelle.vertrag_ende_am) : null,
      ...(kPlan ? {
        giltZum: deTag(kPlan.ende),
        zuZahlen: kPlan.zuZahlen.map((r) => ({ nr: r.nr, betrag: eur(r.cents), faellig: deTag(r.faellig), referenz: r.referenz })),
        nachVertragsende: kPlan.nachEnde.map((r) => ({ nr: r.nr, betrag: eur(r.cents), faellig: deTag(r.faellig) })),
        regel: kPlan.jahresvertrag
          ? "Jahresvertrag: zu zahlen sind die Raten in zuZahlen; die vorzeitige Beendigung aus Kulanz setzt ihre Zahlung voraus (Justins Satz). Die Kündigung selbst und ihre Bestätigung hängen nie an einer Zahlung."
          : `Vertrag vor dem 03.09.2026: Die Kündigung gilt zum Ende seines laufenden Abrechnungsmonats, dem ${deTag(kPlan.ende)} (Fälligkeit zu Fälligkeit, AGB § 6 — nie „Monatsende") — unabhängig von jeder Zahlung. Zu zahlen sind nur die Raten in zuZahlen${kPlan.zuZahlen.length ? "" : " (keine — nichts mehr zu zahlen)"}. Raten in nachVertragsende verlangst du NIE (nicht nennen, keine Zahlungsseite, nie „letzte Rate"). Kündigungsschreiben und Bestätigung hängen nie an einer Buchung.`,
      } : {}),
    } : null,
    sperren: {
      werbung: person?.werbung_gesperrt_am ? relativ(person.werbung_gesperrt_am) : null,
      anrufe: !!person?.is_blocked,
      konto: person?.account_status === "suspended" ? "gesperrt" : null,
    },
    offeneAufgaben: Number(aufgaben?.n || 0),
    auskunft,
    // E-272 (02.10.2026): Was beim Global-Kunden gilt — Angebote, Aufträge, die Regel für die Antwort.
    global: globalKunde && personId ? await (async (): Promise<AkteGlobal> => {
      const t = await globalTeil(personId);
      return {
        kunde: true, angebote: t.angebote, auftraege: t.auftraege,
        regel: "Dieser Mensch ist Kunde von FIAON Global (Business-Linie für Unternehmen), KEIN Privatkunde. "
          + "Du sprichst ihn nie auf Kreditkarte, Wunschlimit, Konto der Partnerbank, Raten, Bonitätsauskunft oder einen Privatantrag an, "
          + "forderst keine Zahlung für eine Privatbestellung und schickst keinen Antragslink — eine alte Privatbestellung in der Akte ist nicht sein Thema. "
          + (t.auftraege.length
            ? "Zu seinem Firmenauftrag gelten die Regeln unter VERTRAG (Einmalpreis, Zahlungsseite und Rechnung seines Auftrags, „Mein Auftrag“ über global_zugang_senden). "
            : "Einen Firmenauftrag gibt es noch nicht — er entsteht erst mit der Annahme seines Angebots. ")
          + "Was ein Mensch entscheiden oder klären muss (Angebot, Preis, Ablauf, Termin, Storno, Erstattung), gibst du mit aufgabe_an_betreuer an seine Ansprechperson bei FIAON Global weiter und sagst ihm, dass sie sich meldet.",
      };
    })() : null,
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
    // Integration 26.09.2026 (E-243): standZumZeigen — eine offene Bestellung, die auskunftBestellen nicht wiederverwenden würde (älter als 21 Tage, teurer als heute), zeigt keinen Zahlungslink, sondern den Kauf zum heutigen Preis.
    const s = (await import("./fiaon-auskunft")).standZumZeigen(await auskunftStand(personId, sqlPool, art));
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
  const [a] = (await sqlPool`SELECT agb_stand, pack_key, type, ref, person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
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
  // ── E-272 (02.10.2026): DER VORGANG IST PRIVAT, DER MENSCH IST GLOBAL ─────
  // Ein Global-Kunde (istGlobalKunde) mit einem alten Privatantrag oder einer
  // Auskunft als Vorgang bekam hier die Zwölf-Monats-Regeln der Privatkunden als
  // „VERTRAG“ — und Mara erklärte einem Unternehmer Monatsraten. Jetzt der Satz
  // für FIAON Global. Das Wort FIRMENAUFTRAG steht darin, weil der Agent daran
  // „formlos kündbar“ (Altvertrag der Privatlinie) ausschließt.
  if (a?.person_id && produktkategorie(a) !== "global" && await istGlobalKunde(Number(a.person_id)).catch(() => false)) {
    return {
      jahresvertrag: false,
      text: "KUNDE VON FIAON GLOBAL — KEIN PRIVATVERTRAG. Für ihn gelten keine Privatkunden-Regeln: kein Abo, keine Monatsraten, keine Kündigungsfrist, "
        + "kein Kundenbereich mit Passwort, keine Kreditkarte, keine Bonitätsauskunft. Eine Privatbestellung in der Akte ist nicht sein Thema — du nennst "
        + "dafür keine Rechnung, keine Zahlung und keinen Antrag. Ein FIRMENAUFTRAG über FIAON Global (Einmalpreis, Zahlung per Überweisung auf "
        + "Rechnung) entsteht mit der Annahme seines Angebots; was dazu schon besteht, steht in der Akte unter global. Angebot, Preis, Ablauf, "
        + "Storno und Erstattung entscheidet die Leitung mit seiner Ansprechperson — sage dazu nichts zu, sondern gib das Anliegen mit "
        + "aufgabe_an_betreuer weiter. Über Konto, Karte, Rahmen und Darlehen "
        + "entscheidet allein das jeweilige Institut; Steuer- und Rechtsfragen beantworten Steuerberater und Anwälte auf eigenes Mandat, FIAON koordiniert.",
    };
  }
  // E-265 Nachbesserung: dieselbe Rechnung wie WhatsApp und Kundenbereich (shared/fiaon-antrag-stand.ts).
  const neu = istJahresvertrag(a?.agb_stand);
  return {
    jahresvertrag: neu,
    text: neu
      ? "Zwölf Monate Erstlaufzeit, in zwölf Monatsraten gestellt. Vorzeitige Beendigung ist Kulanz und wird wirksam, sobald die bereits gestellte Rate bezahlt ist."
      : "Vertrag nach der bis 02.09.2026 gültigen Fassung: kündbar mit einer Frist von 24 Stunden zum Ende des jeweiligen Abrechnungsmonats (von Fälligkeit zu Fälligkeit — nie „Monatsende“). Die bis dahin gestellte Rate bleibt zu zahlen.",
  };
}
