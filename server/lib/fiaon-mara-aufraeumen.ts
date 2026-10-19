// ═══════════════════════════════════════════════════════════════════════════
// MARA SCHLÄGT VOR — AUFRÄUMEN MIT EINEM KLICK, UND „TERMIN EINTRAGEN?“ BEI ROT (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Mara legt dir selbst Aufräum-Aktionen vor, zum Beispiel ‚Soll ich die 30 alten
// Zahlungsmeldungen klären?‘. Du klickst Ja und musst nichts selbst formulieren.“
//
// a) ALTE ZAHLUNGSMELDUNGEN (Art mara_aufraeumen_zahlung) — der Kunde hat im Kundenbereich „Ich habe überwiesen“
//    geklickt, und seit über 14 Tagen ist kein Eingang gebucht (E-369: dann gilt die Meldung als „unbezahlt“).
//    Gemessen 19.10. (nur lesend): 301 offene Meldungen, 277 älter als 14 Tage, 54 davon jünger als 60 Tage.
//    Je Meldung eine Karte — als E-397-Sammelkarte („30 × Alte Zahlungsmeldung“: Ja / Nein, einzeln abwählbar).
//    „Ja, im Bankbuch nachsehen“ ruft den BESTEHENDEN Weg zahlung_suchen (fiaon-mara-zahlung-suchen.ts, E-401):
//    lesen, abgleichen, einen Fund auf die Karte „Geld eingegangen“ legen. Er bucht NIE, schreibt dem Kunden NICHTS
//    und ändert keinen Status. Kein Fund: ein Vermerk in der Akte — die Zahlungserinnerung sagt ihm weiter ehrlich,
//    dass nichts ankam. Nur 14 bis 75 Tage (weiter zurück reicht das Bankbuch-Fenster nicht), höchstens 30 auf
//    einmal, nie Testpersonen, nie Kunden von FIAON Global (E-272). Entschiedene kommen nie wieder (Schlüssel mit
//    dem Zeitpunkt der Meldung — eine neue Meldung ist eine neue Karte).
//    Alte ENTWÜRFE haben ihre Sammelkarte schon (postmeister_altbestand / postmeister_altentwuerfe, E-371/E-401).
//
// b) „TERMIN EINTRAGEN?“ (Art mara_termin_rot) — steht „Termine eintragen“ auf Rot (fiaon-mara-ampel.ts), trägt
//    Mara einen vom Kunden genannten Termin (E-395/E-401, fiaon-mara-genannter-termin.ts) nicht selbst ein, sondern
//    legt ihn hier vor. „Eintragen“ prüft die Lage JETZT (Zeit noch künftig, kein Termin daneben) und bucht über
//    denselben Weg (terminBuchen, vereinbart wie beim genannten Termin). Ist die Zeit vorbei, geht die Karte von
//    selbst zu.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  entscheidungArt, detektorRegistrieren, werkzeugRegistrieren, ausfuehrErgebnis, entscheidungAnlegen, entscheidungTabellen,
  sammelArtRegistrieren, euroText,
  type EntscheidungNeu, type EntscheidungBeleg, type EntscheidungOption,
} from "./fiaon-mara-entscheidungen";
import {
  AUFRAEUM_ART_ZAHLUNG, AUFRAEUM_JE_KARTE, MELDUNG_AB_TAGE, MELDUNG_BIS_TAGE, meldungSuchTage, tageSeit,
} from "@shared/fiaon-mara-ampel";

type Lauf = typeof sqlPool;

const tag = (v: unknown) => (v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date(v as any)) : "");
const epoche = (v: unknown) => Math.floor(new Date(v as any).getTime() / 1000);
const NAME_SQL = (p: string) => `NULLIF(TRIM(CONCAT_WS(' ', NULLIF(TRIM(${p}.first_name), ''), NULLIF(TRIM(${p}.last_name), ''))), '')`;

// ═══════════════════════════════════════════════════════════════════════════
// a) ALTE ZAHLUNGSMELDUNGEN
// ═══════════════════════════════════════════════════════════════════════════
entscheidungArt(AUFRAEUM_ART_ZAHLUNG, "Alte Zahlungsmeldung", 35);
sammelArtRegistrieren(AUFRAEUM_ART_ZAHLUNG);

/** Der Schlüssel einer Meldung — Bestellung und Zeitpunkt der Meldung (eine neue Meldung ist eine neue Karte). */
export const meldungSchluessel = (ref: string, gemeldetAm: unknown) => `${AUFRAEUM_ART_ZAHLUNG}:${ref}:${epoche(gemeldetAm)}`;

/** Rein: die Karte zu EINER alten Meldung. */
export function meldungKarte(z: { ref: string; person_id: number; claimed_paid_at: unknown; soll: number; pack_name: string | null }, jetzt: Date = new Date()): EntscheidungNeu {
  const am = new Date(z.claimed_paid_at as any);
  const tage = tageSeit(am, jetzt);
  const such = meldungSuchTage(am, jetzt);
  const paket = z.pack_name ? String(z.pack_name).split("\n")[0].slice(0, 40) : null;
  const belege: EntscheidungBeleg[] = [
    { text: `gemeldet ${tag(am)}` },
    { text: `${tage} Tage ohne Eingang`, ton: "warn" },
    ...(Number(z.soll) > 0 ? [{ text: euroText(Number(z.soll)) }] : []),
    ...(paket ? [{ text: paket }] : []),
  ];
  return {
    schluessel: meldungSchluessel(z.ref, am),
    art: AUFRAEUM_ART_ZAHLUNG,
    personId: Number(z.person_id),
    ref: z.ref,
    titel: "Zahlung gemeldet — nichts angekommen?",
    text: `Gemeldet am ${tag(am)}${Number(z.soll) > 0 ? ` (${euroText(Number(z.soll))})` : ""}, seit ${tage} Tagen kein Eingang gebucht. Mara sieht im Bankbuch nach (${such} Tage zurück).`,
    empfehlung: "nachsehen",
    optionen: [
      { key: "nachsehen", label: "Ja, im Bankbuch nachsehen", werkzeug: "mara_zahlung_nachsehen", ton: "gut",
        titel: "Sucht den Eingang. Findet Mara ihn, liegt er als „Geld eingegangen“ zum Buchen bereit. Bucht nichts, schreibt dem Kunden nichts.",
        args: { ref: z.ref, personId: Number(z.person_id), gemeldetAm: am.toISOString() } },
      { key: "lassen", label: "Nein, so lassen", werkzeug: "nichts", ton: "neutral", titel: "Die Karte geht zu — für diese Meldung fragt Mara nicht wieder." },
    ],
    belege,
  };
}

/**
 * Detektor: Meldungen 14–75 Tage alt, ohne Eingang. Offene Karten kommen immer mit (sonst schlösse der Sammler sie
 * fälschlich), neue nur bis AUFRAEUM_JE_KARTE zusammen. Entschiedene nie wieder.
 */
async function findeAlteMeldungen(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const { globalKundeSql, globalKundeBereit } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  const zeilen = (await lauf.unsafe(`
    SELECT a.ref, a.person_id, a.claimed_paid_at, ROUND(COALESCE(a.amount_due, 0) * 100)::int AS soll, a.pack_name
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'claimed_paid' AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.claimed_paid_at IS NOT NULL
       AND a.claimed_paid_at < NOW() - make_interval(days => $1::int)
       AND a.claimed_paid_at >= NOW() - make_interval(days => $2::int)
       AND p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND NOT (${globalKundeSql("a.person_id")})
     ORDER BY a.claimed_paid_at DESC, a.ref ASC`, [MELDUNG_AB_TAGE, MELDUNG_BIS_TAGE])) as any[];
  const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`)) as any[];
  const status = new Map<string, string>();
  if (t?.da) {
    const z = (await lauf.unsafe(`SELECT schluessel, status FROM fiaon_mara_entscheidungen WHERE art = $1`, [AUFRAEUM_ART_ZAHLUNG])) as any[];
    for (const r of z) status.set(String(r.schluessel), String(r.status));
  }
  const jetzt = new Date();
  const karten = zeilen.map((z) => meldungKarte(z, jetzt)).filter((k) => !["entschieden", "erledigt_von_selbst"].includes(status.get(k.schluessel) ?? ""));
  const offen = karten.filter((k) => status.has(k.schluessel));
  const neu = karten.filter((k) => !status.has(k.schluessel)).slice(0, Math.max(0, AUFRAEUM_JE_KARTE - offen.length));
  return [...offen, ...neu];
}

detektorRegistrieren({
  art: AUFRAEUM_ART_ZAHLUNG, finden: findeAlteMeldungen,
  erledigtText: "Hat sich erledigt — die Zahlung ist gebucht, die Bestellung storniert oder die Meldung ist älter als 75 Tage.",
});

/** Ein Vermerk an der Person (fiaon_contact_log, system) — wirft nie. */
async function vermerk(personId: number, ref: string | null, text: string, lauf: Lauf): Promise<void> {
  try {
    const { akteRef } = await import("./fiaon-postmeister-werkzeuge");
    const r = await akteRef(personId, ref);
    if (!r) return;
    await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
               VALUES (${r}, ${personId}, NULL, ${"Mara"}, 'system', ${text.slice(0, 1000)})`;
  } catch (e) {
    console.warn("[MARA-AUFRAEUMEN] Vermerk:", String((e as Error)?.message ?? e).slice(0, 160));
  }
}

werkzeugRegistrieren("mara_zahlung_nachsehen", async (args, k) => {
  const ref = String(args?.ref ?? "");
  const personId = Number(args?.personId);
  const am = new Date(String(args?.gemeldetAm ?? ""));
  if (!ref || !Number.isInteger(personId) || personId <= 0 || Number.isNaN(am.getTime())) return ausfuehrErgebnis.fehler("Die Karte nennt keine Meldung.");
  // Die Lage JETZT: dieselbe Meldung (Zeitpunkt auf die Sekunde), noch „gemeldet“.
  const [a] = (await k.lauf`
    SELECT payment_status, claimed_paid_at, person_id FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`) as any[];
  if (!a || a.payment_status !== "claimed_paid" || !a.claimed_paid_at || Math.abs(new Date(a.claimed_paid_at).getTime() - am.getTime()) > 1000) {
    return ausfuehrErgebnis.vonSelbst("Die Meldung steht so nicht mehr — bezahlt, storniert oder neu gemeldet.");
  }
  const tage = meldungSuchTage(am);
  const { zahlungSuchenBehandeln } = await import("./fiaon-mara-zahlung-suchen");
  const lage = await zahlungSuchenBehandeln({ personId, ref, kanal: "meldung", quelle: `Zahlungsmeldung vom ${tag(am)} (Aufräumen)`, tage }, k.lauf);
  if (!lage) return ausfuehrErgebnis.fehler("Das Bankbuch ließ sich gerade nicht lesen — bitte später noch einmal.");
  if (lage.test) return ausfuehrErgebnis.vonSelbst("Testkonto — gerechnet, nichts geschrieben.");
  if (lage.vorgelegt.length) {
    // Ehrlich nach dem Stand des Funds: sicher (Referenz/Zuordnung + Betrag), Betrag weicht ab, oder nur der Name passt.
    const vorgelegt = lage.ergebnis.treffer.filter((t) => lage.vorgelegt.includes(t.eingang.id));
    const sicher = vorgelegt.some((t) => t.stand === "gefunden");
    const nurName = vorgelegt.length > 0 && vorgelegt.every((t) => t.stand === "moeglich");
    return ausfuehrErgebnis.erledigt(sicher
      ? `Eingang gefunden — liegt als „Geld eingegangen“ zum Buchen bereit${lage.vorgelegt.length > 1 ? ` (${lage.vorgelegt.length})` : ""}. Gebucht wird erst mit deinem Klick.`
      : nurName
        ? "Ein Eingang passt nur nach dem Namen — liegt zum Prüfen bereit (ohne Zubuchen-Knopf)."
        : "Eingang gefunden, aber der Betrag weicht ab — liegt zum Prüfen bereit.");
  }
  const h = lage.ergebnis.haupt;
  if (h && (h.stand === "gebucht" || h.stand === "unterwegs")) {
    await vermerk(personId, ref, `Mara hat im Bankbuch nachgesehen (Zahlungsmeldung vom ${tag(am)}, ${tage} Tage zurück): ${h.stand === "gebucht" ? "ein passender Eingang ist schon gebucht" : "eine Zahlung ist angekündigt, aber noch nicht auf dem Konto"} — bitte die Meldung in der Akte prüfen.`, k.lauf);
    return ausfuehrErgebnis.erledigt(h.stand === "gebucht" ? "Ein passender Eingang ist schon gebucht — bitte die Meldung in der Akte prüfen." : "Eine Zahlung ist unterwegs (angekündigt) — noch nicht auf dem Konto.");
  }
  await vermerk(personId, ref, `Mara hat im Bankbuch nachgesehen (Zahlungsmeldung vom ${tag(am)}, ${tage} Tage zurück): kein passender Eingang. Die Zahlungserinnerung sagt ihm weiter ehrlich, dass nichts ankam.`, k.lauf);
  return ausfuehrErgebnis.erledigt(`Kein Eingang in ${tage} Tagen — die Zahlungserinnerung bleibt ehrlich („nicht angekommen“). Vermerk in der Akte.`);
});

// ═══════════════════════════════════════════════════════════════════════════
// b) „TERMIN EINTRAGEN?“ — Ampel „Termine eintragen“ auf Rot
// ═══════════════════════════════════════════════════════════════════════════
export const TERMIN_ROT_ART = "mara_termin_rot";
entscheidungArt(TERMIN_ROT_ART, "Termin eintragen?", 45);

export interface TerminRotEin {
  personId: number;
  ref: string | null;
  agentId: number;
  agentName: string;
  /** „YYYY-MM-DD HH:MM“ (Berlin) — wie terminBuchen es nimmt. */
  wandzeit: string;
  /** Der Zeitpunkt (für Anzeige und „vorbei“). */
  beginn: Date;
  herkunft: string;
  vereinbart: boolean;
  kanal: "mail" | "whatsapp";
  /** Was der Kunde schrieb (gekürzt) und woher (Mail #…, WhatsApp #…). */
  kundeText: string;
  quelle: string | null;
  beleg: string;
}

/** Rein: die Karte „Termin eintragen?“. */
export function terminRotKarte(e: TerminRotEin): EntscheidungNeu {
  const wann = new Date(e.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const optionen: EntscheidungOption[] = [
    { key: "eintragen", label: "Eintragen", werkzeug: "mara_termin_eintragen", ton: "gut",
      titel: `Trägt den Termin bei ${e.agentName} ein — wie Mara es bei Grün selbst getan hätte (Mitarbeiter bekommt Bescheid).`,
      args: { personId: e.personId, ref: e.ref, agentId: e.agentId, wandzeit: e.wandzeit, beginn: new Date(e.beginn).toISOString(), herkunft: e.herkunft,
        vereinbart: e.vereinbart, kanal: e.kanal, kundeText: e.kundeText.slice(0, 300), quelle: e.quelle } },
    { key: "nicht", label: "Nicht eintragen", werkzeug: "nichts", ton: "neutral", titel: "Die Karte geht zu, nichts wird eingetragen." },
  ];
  return {
    schluessel: `${TERMIN_ROT_ART}:${e.personId}:${epoche(e.beginn)}`,
    art: TERMIN_ROT_ART,
    personId: e.personId,
    ref: e.ref,
    titel: `Termin ${wann} bei ${e.agentName} eintragen?`,
    text: `Der Kunde nennt ${e.kanal === "whatsapp" ? "per WhatsApp" : "in seiner Mail"} ein Gespräch mit uns. „Termine eintragen“ steht auf Rot — Mara hat nichts eingetragen und ihm nur ein gutes Gespräch gewünscht.`,
    empfehlung: "eintragen",
    optionen,
    belege: [
      { text: wann },
      { text: e.beleg || "laut Kunde" },
      ...(e.kundeText ? [{ art: "zitat" as const, name: e.quelle ?? (e.kanal === "whatsapp" ? "WhatsApp" : "Mail"), text: e.kundeText.replace(/\s+/g, " ").slice(0, 240) }] : []),
    ],
  };
}

/** Die Karte sofort anlegen (aus dem genannten Termin heraus). Wirft nie — null bei Fehler. */
export async function terminRotKarteAnlegen(e: TerminRotEin, lauf: Lauf = sqlPool): Promise<{ id: number } | null> {
  try {
    await entscheidungTabellen();
    const r = await entscheidungAnlegen(terminRotKarte(e), lauf);
    return r ? { id: r.id } : null;
  } catch (x) {
    console.error("[MARA-AUFRAEUMEN] Termin-Karte:", String((x as Error)?.message ?? x).slice(0, 200));
    return null;
  }
}

/** Detektor: hält die offenen Termin-Karten, deren Zeit noch kommt — vorbei = von selbst erledigt. */
async function findeTerminKarten(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`)) as any[];
  if (!t?.da) return [];
  const z = (await lauf.unsafe(`
    SELECT * FROM fiaon_mara_entscheidungen WHERE art = $1 AND status IN ('offen', 'spaeter') ORDER BY id`, [TERMIN_ROT_ART])) as any[];
  const aus: EntscheidungNeu[] = [];
  for (const r of z) {
    const optionen = (typeof r.optionen === "string" ? JSON.parse(r.optionen) : r.optionen) as EntscheidungOption[];
    const beginn = new Date(String(optionen.find((o) => o.key === "eintragen")?.args?.beginn ?? ""));
    if (Number.isNaN(beginn.getTime()) || beginn.getTime() <= Date.now()) continue;
    aus.push({
      schluessel: String(r.schluessel), art: TERMIN_ROT_ART, personId: r.person_id ?? null, ref: r.ref ?? null, titel: String(r.titel), text: String(r.text),
      empfehlung: String(r.empfehlung ?? "eintragen"), optionen, belege: (typeof r.belege === "string" ? JSON.parse(r.belege) : r.belege) ?? [],
      gewicht: Number(r.gewicht),
    });
  }
  return aus;
}
detektorRegistrieren({ art: TERMIN_ROT_ART, finden: findeTerminKarten, erledigtText: "Hat sich erledigt — die Zeit ist vorbei." });

werkzeugRegistrieren("mara_termin_eintragen", async (args, k) => {
  const personId = Number(args?.personId), agentId = Number(args?.agentId);
  const beginn = new Date(String(args?.beginn ?? ""));
  const wandzeit = String(args?.wandzeit ?? "");
  if (!Number.isInteger(personId) || !Number.isInteger(agentId) || Number.isNaN(beginn.getTime()) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(wandzeit)) {
    return ausfuehrErgebnis.fehler("Die Karte nennt keinen gültigen Termin.");
  }
  if (beginn.getTime() <= Date.now()) return ausfuehrErgebnis.vonSelbst("Die Zeit ist vorbei — nichts eingetragen.");
  // Steht inzwischen ein Termin um diese Zeit (±30 Minuten), wird keiner dazugebucht.
  const [steht] = (await k.lauf`
    SELECT id FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht'
       AND beginn BETWEEN ${beginn}::timestamptz - INTERVAL '30 minutes' AND ${beginn}::timestamptz + INTERVAL '30 minutes' LIMIT 1`) as any[];
  if (steht) return ausfuehrErgebnis.vonSelbst(`Um diese Zeit steht schon ein Termin (#${steht.id}) — keiner dazugebucht.`);
  const [p] = (await k.lauf`SELECT ist_test_am FROM fiaon_persons WHERE id = ${personId}`) as any[];
  if (!p) return ausfuehrErgebnis.vonSelbst("Diese Person gibt es nicht mehr.");
  if (p.ist_test_am) return ausfuehrErgebnis.vonSelbst("Testkonto — nichts eingetragen.");
  const herkunft = ["mara_mail_genannt", "mara_whatsapp_genannt"].includes(String(args?.herkunft)) ? String(args.herkunft) : "mara_mail_genannt";
  const { terminBuchen } = await import("./fiaon-termine");
  const b = await terminBuchen({ personId, agentId, beginn: wandzeit, quelle: "agent_manuell", herkunft, vereinbart: args?.vereinbart !== false }, k.lauf);
  const kanal = args?.kanal === "whatsapp" ? "whatsapp" : "mail";
  const notiz = `Vom Kunden ${kanal === "whatsapp" ? "per WhatsApp" : "in einer E-Mail"} genannt${args?.quelle ? ` [${String(args.quelle).slice(0, 40)}]` : ""}: „${String(args?.kundeText ?? "").replace(/\s+/g, " ").slice(0, 220)}“ — eingetragen nach Entscheidung (Ampel rot): ${k.von}`;
  await k.lauf`UPDATE fiaon_termine SET notiz = ${notiz.slice(0, 1000)}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
  const { buchungMelden } = await import("./fiaon-termin-meldung");
  await buchungMelden(b.id, b.beginn, "agent_manuell", k.lauf).catch(() => {});
  const { protokollieren } = await import("./fiaon-mara-termin");
  await protokollieren({
    art: "termin_eingetragen", kanal, personId, terminId: b.id,
    text: `Genannten Termin eingetragen nach Entscheidung (${k.von}): ${b.datumText} ${b.uhrzeit} Uhr.`,
    daten: { beginn: b.beginn, entscheidung: k.karte.id },
  }, k.lauf);
  await vermerk(personId, args?.ref ? String(args.ref) : null, `Termin ${b.datumText} ${b.uhrzeit} Uhr eingetragen — der Kunde hatte ihn genannt; Entscheidung im Mara-Steuerpult (${k.von}).`, k.lauf);
  return ausfuehrErgebnis.erledigt(`Eingetragen: ${b.datumText} ${b.uhrzeit} Uhr.`);
});

/** Für „Mara heute“ und den Prüfstand: Name einer Person (oder null). */
export async function personName(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [p] = (await lauf.unsafe(`SELECT ${NAME_SQL("p")} AS name FROM fiaon_persons p WHERE p.id = $1`, [personId]).catch(() => [])) as any[];
  return p?.name ?? null;
}
