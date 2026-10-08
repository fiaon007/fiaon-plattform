// ═══════════════════════════════════════════════════════════════════════════
// NACHHOLEN LIEGENGEBLIEBENER BANKEINGÄNGE — EINE RECHNUNG, DREI TÜREN (01.10.2026)
//
// Die Einleser (Airwallex, Wise) rufen liveVerbuchen nur für NEUE Zeilen. Was
// schon im Bankbuch liegt — weil E-235 (Referenz ohne Strich) und Regel B
// (Rate ohne Nummer) erst jetzt greifen — bleibt sonst für immer liegen.
//
// Hier steht, was ein liegengebliebener Eingang bedeutet und was beim Buchen
// passieren würde (Trockenprobe) — und der eine Weg, ihn scharf zu buchen.
// Drei Türen rufen genau diese Funktionen:
//   · FIAON Banking, Bankbuch (/buchhaltung → Umsätze): Justin klickt — ohne
//     Admin-Code, mit seiner Banking-Sitzung als Inhaber (fiaon-buchhaltung.ts).
//   · POST /admin/zahlungen/bankeingang-nachholen (Admin-Code oder Chef-Sitzung
//     Inhaber/Geschäftsführung, fiaon-wise.ts) — für Skripte.
//   · scripts/nachholen-bankeingaenge.ts (Vorschau schreibgeschützt gegen die
//     Produktion, Ausführen über die Admin-Route).
//
// Gebucht wird NIE hier, sondern immer über liveVerbuchen → alsBezahltBuchen /
// rateBezahltBuchen: der eine Buchungsweg mit Bestätigungsmail, Ratenkette,
// Provisionsschalter und Rückwärtssperre. Die Trockenprobe rechnet nur vor,
// mit denselben Bausteinen wie die Buchung (abschlussNachZahlung, onRatePaid,
// praemieBuchen) — damit der Mensch VOR dem Klick sieht: Ziel, Regel, Betrag,
// welche Provision vorgemerkt wird, welche Mail der Kunde bekommt.
//
// ── E-277 (02.10.2026): JEDER HANDFALL MIT EINEM KLICK ──────────────────────
// Justin: „Ok buche alle Zahlungen den Kunden richtig zu die gerade nicht
// gebucht wurden, erkenne sie anhand des Namens, Verwendungszweck oder was auch
// immer, buche alle und lass kein über."
//
// Der Nachhol-Lauf vom 02.10. fand 80 unverbuchte Eingänge seit 15.08. — 10
// buchbar, 70 Handarbeit. Die meisten davon sind gar keine offene Buchung: Das
// Geld wurde am 31.08./01.09. per mark-paid gebucht (Startzahlung), nur der
// Haken im Bankbuch fehlt. Dazu Tippfehler in der Referenz, Zahlungen ohne
// Zweck, Raten gekündigter Verträge, Doppel- und Teilzahlungen. Dafür gibt es
// hier vier Bausteine — alle über den EINEN Weg, nie ein zweiter:
//   · vorschlagErmitteln: liest Referenz (auch mit Tippfehler, auch über eine
//     zusammengeführte Dublette), Absendername, Belegnotiz des Betreuers, Betrag
//     und Datum und schlägt EIN Ziel vor — mit Art, Sicherheit und Gründen.
//     Gebucht wird davon nichts; der Mensch bestätigt.
//   · bankeingangBuchen mit `ziel` (vom Menschen bestätigt) und optional `dazu`
//     (Sammelzahlung aus mehreren Eingängen): liveVerbuchen mit dieser Referenz
//     und allen Sperren. Unterzahlung wird NIE gebucht (warum: fiaon-wise.ts).
//   · bankeingangZuordnen („Nur zuordnen"): Das Geld ist schon auf anderem Weg
//     gebucht. Markiert die Bankbuch-Zeile und schreibt „Bankeingang <txn>" in
//     die bezahlte Rate — ohne zweite Buchung, mit Deckungsrechnung je Kunde
//     (Lehre vom 23.08.: nie mehr Geld zuordnen, als bezahlt gebucht ist).
//   · bankeingangAufgabe: Teilzahlung, Überzahlung, Rückzahlung — keine Buchung,
//     sondern eine Aufgabe für den Betreuer bzw. die Zahlungsstelle.
//
// ── E-278 (03.10.2026): STORNO ZURÜCKNEHMEN, MIT HEUTIGEM DATUM VERRECHNEN ──
// Justin: „Konchenko-Sperre im Code reparieren und dann buchen mach ALLE fertig“
// — vorher freigegeben: Doppelzahlungen als Vorauszahlung der nächsten Rate
// verrechnen, Robiban reaktivieren und buchen, Körner/Condescu „gutschreiben“
// (die Zahlung auf eine per Kulanz stornierte Rate behalten).
// Zwei ausdrückliche Optionen für bankeingangBuchen (und die Trockenprobe), nur
// mit einem vom Menschen bestätigten Ziel, Vorgabe AUS:
//   · stornoZuruecknehmen — Ziel ist eine Rate, die per Kündigung oder Kulanz
//     storniert wurde: Sie wird wieder offen und dann über den einen Weg gebucht.
//     Ziel ist eine stornierte BESTELLUNG: Sie wird reaktiviert (Kündigung zurück,
//     Zahlungsstatus offen, gesperrtes Konto auf „pending“, alsBezahltBuchen setzt
//     es aktiv), dann die Erstzahlung gebucht, danach die Vertriebssperre der
//     Person aufgehoben. Scheitert die Buchung, wird der Storno wiederhergestellt.
//   · verrechnungHeute — eine Doppel- oder Vorauszahlung, die an der Rückwärts-
//     sperre scheitert (die Vorgängerrate ist später bezahlt als der Eingang kam),
//     wird mit dem heutigen Datum (Berlin) als Zahlung der Zielrate gebucht, mit
//     Vermerk „Eingang vom … (Doppelzahlung) am … mit Rate … verrechnet“.
// Nach jeder Buchung schließt bankeingangBuchen die offenen Bankbuch-Aufgaben
// dieses Eingangs (Teil-, Über-, Rückzahlung) — sonst erstattet die Zahlungsstelle
// Geld, das gerade gebucht wurde.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatum, berlinToday } from "./fiaon-time";
import { RATEN_MUSTER, refVergleichsform } from "./fiaon-zahlungsauftrag";

/** E-277: Was ein liegengebliebener Eingang ist. */
export type HandfallArt = "erstzahlung" | "rate" | "nur_zuordnen" | "teilzahlung" | "ueberzahlung" | "rueckzahlung_noetig" | "unbekannt";
export type Sicherheit = "sicher" | "wahrscheinlich" | "unklar";

/** E-277: Der Vorschlag zu einem Eingang — wird NIE selbst gebucht, ein Mensch bestätigt. */
export interface NachholVorschlag {
  art: HandfallArt;
  /** Was der Knopf tut: buchen (der eine Weg), zuordnen (keine Buchung), aufgabe — oder nichts (Mensch). */
  aktion: "buchen" | "zuordnen" | "aufgabe" | null;
  /** Bestell- oder Ratenreferenz in der Schreibweise der Datenbank. */
  ziel: string | null;
  /** Muss das Ziel mitgeschickt werden? false = der Zweck trägt die Referenz selbst (buchbar wie bisher). */
  mitZiel: boolean;
  bestellung: string | null;
  rateNr: number | null;
  rateId: number | null;
  kunde: string | null;
  personId: number | null;
  /** Sammelzahlung: weitere Eingänge (fiaon_bank_txns.id), die mit diesem zusammen gebucht werden. */
  dazu: number[];
  sicherheit: Sicherheit;
  /** Kurze Belege: „Referenz im Zweck", „Name", „Betrag = Rate", „fällig 01.10." */
  gruende: string[];
  /** „Rate FIAON-…-3 von Max Muster" */
  text: string;
  hinweise: string[];
  /** Was die Trockenprobe beim Klick sagen muss (Regel, Ziel, Rate) — weicht sie ab, bucht der Server nicht. */
  erwartet: { regel?: "erstzahlung" | "rate" | "regel_b" | null; ziel: string | null; rateId: number | null } | null;
}

export interface NachholZeile {
  id: number;
  txnId: string;
  datum: string;
  betragCents: number;
  zweck: string | null;
  absender: string | null;
  zweckRef: string | null;
  regel: "rate" | "erstzahlung" | "regel_b" | null;
  ziel: string | null;
  bestellung: string | null;
  kunde: string | null;
  personId: number | null;
  rateId: number | null;
  rateNr: number | null;
  /** Der Satz aus liveVerbuchen: „würde buchen: …" oder der Grund dagegen. */
  ergebnis: string;
  /** Darf gebucht werden? Nur wenn die Trockenprobe „würde buchen" sagt. */
  buchen: boolean;
  deckung: string | null;
  /** Was an Mitarbeitergeld entstünde — bei Schalter AUS vorgemerkt, nicht gebucht. */
  provision: string[];
  /** Welche Mails der Kunde bekäme. */
  mails: string[];
  /** Was der Mensch vor dem Klick wissen muss (z. B. Kunde nennt eine andere Rate). */
  hinweise: string[];
  /** Kunde nennt im Zweck eine Ratennummer, die nicht die gebuchte ist → Aufgabe an den Betreuer beim Buchen. */
  genannteRate: number | null;
  /** Warum es Handarbeit bleibt (null, wenn buchbar). */
  unklar: string | null;
  schonVerbucht: boolean;
  /** E-277: vom Menschen bestätigtes Ziel (Bestell- oder Ratenreferenz), sonst null. */
  zielVomMenschen: string | null;
  /** E-277: weitere Eingänge einer Sammelzahlung (fiaon_bank_txns.id). */
  dazu: number[];
  /** E-277: Summe dieses Eingangs und der Sammel-Eingänge — der Betrag, der gebucht wird. */
  summeCents: number;
  /** E-277: Buchungstag (bei einer Sammelzahlung der späteste der Eingänge). */
  buchDatum: string;
  /** E-277: „Nur zuordnen" ist möglich (Prüfung bestanden) — keine Buchung. */
  zuordenbar: boolean;
  /** E-277: frühere Zuordnung im Bankbuch (matched_ref, Bestellung) — ein Hinweis, kein Beweis. */
  zugeordnet: string | null;
  /** E-277: Vorschlag aus Referenz, Name, Betrag, Datum — in Liste und Schublade, nie selbst gebucht. */
  vorschlag: NachholVorschlag | null;
  /** E-278: Was „Storno zurücknehmen“ vor der Buchung tut (null = nichts zurückzunehmen). */
  stornoZurueck: string | null;
  /** E-278: Vermerk „Eingang vom … (Doppelzahlung) am … mit Rate … verrechnet“ (null = nicht verrechnet). */
  verrechnung: string | null;
}

export interface NachholAntwort {
  status: number;
  ok: boolean;
  error?: string;
  zeile?: NachholZeile;
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

/**
 * Welche Rate nennt der Kunde im Verwendungszweck? „FIAON J8UU3U 3", „VZ. FIAONMSYOCC. 2.Rate",
 * „Rate 3 FIAON-596FE4". Nur eine kleine Zahl direkt hinter der Referenz oder am Wort „Rate" —
 * Beträge (59,99) und Datumsteile zählen nicht. null = nichts genannt.
 */
export function genannteRate(zweck: string | null | undefined): number | null {
  const t = String(zweck || "");
  const muster = [
    /FIAON[\s-]*[A-Z0-9]{6}[\s.,\-/]+(\d{1,2})(?![\d.,]\d)(?!\d)/i,
    /\brate\s*(?:nr\.?\s*)?(\d{1,2})\b/i,
    /\b(\d{1,2})\s*\.?\s*rate\b/i,
  ];
  for (const m of muster) {
    const t2 = t.match(m);
    if (t2) {
      const n = Number(t2[1]);
      if (Number.isInteger(n) && n >= 1 && n <= 36) return n;
    }
  }
  return null;
}

/** Nur die Zahlungs-Daten, keine Buchung: wer, wie viel, welche Referenz. */
async function kopfLesen(id: number): Promise<{ status: number; ok: boolean; error?: string; z?: any; zeile?: NachholZeile }> {
  const { refErkennen } = await import("../routes/fiaon-wise");
  const [z] = (await sqlPool`
    SELECT id, txn_id, booked_at, amount_cents, payer_name, reference_raw, extracted_ref, matched_ref, applied, note
      FROM fiaon_bank_txns WHERE id = ${id} LIMIT 1
  `) as any[];
  if (!z) return { status: 404, ok: false, error: "Diesen Bankeingang gibt es nicht." };
  const datum = z.booked_at ? berlinDatum(new Date(z.booked_at)) : "";
  const zeile: NachholZeile = {
    id: Number(z.id), txnId: String(z.txn_id), betragCents: Number(z.amount_cents),
    // Buchungstag in Berlin: Airwallex legt Mitternacht UTC ab, ältere Einleser Mitternacht
    // Berlin — beides ergibt so denselben Kalendertag (toISOString hätte den Vortag geliefert).
    datum,
    zweck: z.reference_raw ? String(z.reference_raw) : null,
    absender: z.payer_name ? String(z.payer_name) : null,
    zweckRef: refErkennen(String(z.reference_raw || "")) || (z.extracted_ref ? String(z.extracted_ref) : null),
    regel: null, ziel: null, bestellung: null, kunde: null, personId: null, rateId: null, rateNr: null,
    ergebnis: "", buchen: false, deckung: null, provision: [], mails: [], hinweise: [], genannteRate: null,
    unklar: null, schonVerbucht: !!z.applied,
    zielVomMenschen: null, dazu: [], summeCents: Number(z.amount_cents), buchDatum: datum, zuordenbar: false,
    zugeordnet: z.matched_ref ? String(z.matched_ref) : null, vorschlag: null,
    stornoZurueck: null, verrechnung: null,
  };
  if (z.applied) return { status: 409, ok: false, error: "Dieser Eingang ist schon verbucht.", z, zeile: { ...zeile, ergebnis: "schon verbucht", unklar: "schon verbucht" } };
  if (!(zeile.betragCents > 0)) return { status: 409, ok: false, error: "Kein Geldeingang (Betrag ≤ 0).", z, zeile: { ...zeile, ergebnis: "kein Geldeingang", unklar: "kein Geldeingang" } };
  if (String(z.note || "").startsWith("Airwallex: Geld ist UNTERWEGS")) {
    return { status: 409, ok: false, error: "Das Geld ist noch unterwegs — der Einleser bucht es, sobald es da ist.", z, zeile: { ...zeile, ergebnis: "Geld noch unterwegs", unklar: "Geld noch unterwegs" } };
  }
  if (!zeile.datum) return { status: 409, ok: false, error: "Eingang ohne Datum — bitte von Hand buchen.", z, zeile: { ...zeile, ergebnis: "ohne Datum", unklar: "ohne Datum" } };
  return { status: 200, ok: true, z, zeile };
}

/**
 * DIE TROCKENPROBE. Schreibt nichts (liveVerbuchen mit trocken: true setzt keinen
 * Vermerk). Liefert die Zeile mit Ziel, Regel, Betrag, Provision, Mails und Hinweisen.
 * `ueberzahlungBisCents` (höchstens 100): eine ERSTZAHLUNG darf so viele Cent über
 * dem Soll liegen — nie darunter. Vorgabe 100 (Beispiel 01.10.: 100,00 € auf 99,99 €).
 */
export async function bankeingangTrockenprobe(id: number, opts: {
  ueberzahlungBisCents?: number;
  /** E-277: vom Menschen bestätigtes Ziel (FIAON-XXXXXX oder FIAON-XXXXXX-N) statt der Referenz aus dem Zweck. */
  ziel?: string | null;
  /** E-277: weitere Eingänge derselben Zahlung (Sammelzahlung), höchstens drei. */
  dazu?: number[] | null;
  /** E-277: Vorschlag aus Name, Betrag, Datum mitliefern (Schublade). */
  mitVorschlag?: boolean;
  /** E-278: Storno der Zielrate (Kündigung/Kulanz) bzw. der Zielbestellung vor der Buchung zurücknehmen. Nur mit Ziel. */
  stornoZuruecknehmen?: boolean;
  /** E-278: Doppel-/Vorauszahlung an der Rückwärtssperre — mit dem heutigen Datum verrechnen. Nur mit Ziel, nur Raten. */
  verrechnungHeute?: boolean;
  /** E-278: Wer freigegeben hat (steht in den Vermerken, Vorgabe „Justin“). */
  freigabe?: string | null;
} = {}): Promise<NachholAntwort> {
  const toleranz = Math.max(0, Math.min(100, Math.floor(Number(opts.ueberzahlungBisCents ?? 100) || 0)));
  const kopf = await kopfLesen(id);
  if (!kopf.ok || !kopf.zeile) return { status: kopf.status, ok: false, error: kopf.error, zeile: kopf.zeile };
  const zeile = kopf.zeile;
  let zielRef = zeile.zweckRef;
  if (opts.ziel != null && String(opts.ziel).trim()) {
    const z = zielLesen(opts.ziel);
    if (!z) return { status: 400, ok: false, error: "Das Ziel ist keine FIAON-Referenz (FIAON-XXXXXX oder FIAON-XXXXXX-N).", zeile };
    zielRef = z;
    zeile.zielVomMenschen = z;
  }
  // E-278: Beide Optionen ändern, was gebucht wird — sie gelten nur für ein Ziel, das ein Mensch bestätigt hat.
  if ((opts.stornoZuruecknehmen || opts.verrechnungHeute) && !zeile.zielVomMenschen) {
    return { status: 400, ok: false, error: "„Storno zurücknehmen“ und „mit heutigem Datum verrechnen“ gehen nur mit einem bestätigten Ziel.", zeile };
  }
  let lage: StornoLage | null = null;
  if (opts.stornoZuruecknehmen && zeile.zielVomMenschen) {
    const l = await stornoLageLesen(zeile.zielVomMenschen);
    if (!l.ok) return { status: 409, ok: false, error: l.error, zeile: { ...zeile, ergebnis: l.error, unklar: l.error } };
    lage = l.lage;
    if (lage) {
      zeile.stornoZurueck = lage.text;
      zeile.hinweise.push(`Storno zurücknehmen: ${lage.text}`);
    } else {
      zeile.hinweise.push("Storno zurücknehmen: Das Ziel ist nicht storniert — die Option ändert nichts.");
    }
  }
  let notizZusatz: string | null = null;
  if (opts.dazu && opts.dazu.length) {
    const s = await sammelPruefen(zeile, opts.dazu);
    if (!s.ok) return { status: 409, ok: false, error: s.error, zeile };
    zeile.dazu = s.ids;
    zeile.summeCents = s.summe;
    zeile.buchDatum = s.datum;
    notizZusatz = s.notiz;
    zeile.hinweise.push(s.hinweis);
  }
  // E-278: Das Datum des Eingangs (bei einer Sammelzahlung der späteste) — und, wenn verrechnet wird, der Buchungstag heute.
  const eingangsTag = zeile.buchDatum;
  const heute = berlinToday();
  if (opts.verrechnungHeute) zeile.buchDatum = heute;
  const { liveVerbuchen } = await import("../routes/fiaon-wise");
  const erg = await liveVerbuchen(zeile.txnId, zielRef, zeile.summeCents, zeile.buchDatum, {
    trocken: true, ueberzahlungBisCents: toleranz, anlass: "Nachhol-Lauf",
    zielVomMenschen: !!zeile.zielVomMenschen, notizZusatz, stornoAlsOffen: !!lage,
  });
  zeile.regel = erg.regel ?? null;
  zeile.ziel = erg.ziel ?? null;
  zeile.bestellung = erg.bestellung ?? null;
  zeile.rateId = erg.rateId ?? null;
  zeile.rateNr = erg.rateNr ?? null;
  zeile.ergebnis = erg.grund;
  zeile.deckung = erg.deckung?.text ?? null;
  zeile.buchen = erg.grund.startsWith("würde buchen");
  if (!zeile.buchen) zeile.unklar = erg.grund;
  // ── E-278: Rückwärtssperre vorrechnen ─────────────────────────────────────
  // rateBezahltBuchen lehnt ein Zahldatum ab, das vor der Zahlung der Vorgängerrate liegt
  // (Fall Schlebusch: Doppelzahlung vom 25.08., Rate 2 am 02.10. bezahlt). Die Trockenprobe
  // sagt es jetzt vorher — ohne Option als Hinweis, mit „verrechnungHeute“ als Bedingung.
  if (zeile.buchen && zeile.regel !== "erstzahlung" && zeile.bestellung && zeile.rateNr != null) {
    const vorherTag = await letzteZahlungVorher(zeile.bestellung, zeile.rateNr);
    const sperrt = !!vorherTag && eingangsTag < vorherTag;
    if (opts.verrechnungHeute) {
      if (!sperrt) {
        const grund = `Nicht nötig: Das Eingangsdatum ${tagLang(eingangsTag)} liegt nicht vor der letzten bezahlten Rate${vorherTag ? ` (${tagLang(vorherTag)})` : ""} — bitte ohne „mit heutigem Datum verrechnen“ buchen.`;
        zeile.buchen = false; zeile.unklar = grund; zeile.ergebnis = grund;
      } else {
        zeile.verrechnung = `Eingang vom ${tagLang(eingangsTag)} (Doppelzahlung) am ${tagLang(heute)} mit Rate ${zeile.rateNr} verrechnet — ${freigabeSatz(opts.freigabe)}`;
        zeile.hinweise.push(`Verrechnung: ${zeile.verrechnung}. Gebucht per ${tagLang(heute)}; die Rückwärtssperre (Vorgängerrate bezahlt am ${tagLang(vorherTag!)}) greift so nicht.`);
      }
    } else if (sperrt) {
      zeile.hinweise.push(`Rückwärtssperre: Die Vorgängerrate ist am ${tagLang(vorherTag!)} bezahlt, der Eingang ist vom ${tagLang(eingangsTag)} — so wird die Buchung abgelehnt. Doppel- oder Vorauszahlung? Dann „mit heutigem Datum verrechnen“.`);
    }
  }
  if (opts.verrechnungHeute && zeile.buchen && zeile.regel === "erstzahlung") {
    const grund = "„Mit heutigem Datum verrechnen“ gilt nur für Raten (Doppel- oder Vorauszahlung), nicht für eine Erstzahlung.";
    zeile.buchen = false; zeile.unklar = grund; zeile.ergebnis = grund;
  }
  if (zeile.bestellung) {
    const [app] = (await sqlPool`
      SELECT ref, person_id, first_name, last_name, contact_name FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`.catch(() => [])) as any[];
    if (app) {
      zeile.personId = app.person_id != null ? Number(app.person_id) : null;
      zeile.kunde = String([app.first_name, app.last_name].filter(Boolean).join(" ") || app.contact_name || "").trim() || null;
    }
  }
  if (zeile.buchen && zeile.bestellung) await vorschauErgaenzen(zeile);
  // Wird die Bestellung reaktiviert (E-278), ist der Satz „Vertrag gekündigt …“ überholt — die Kündigung wird zurückgenommen.
  if (zeile.zielVomMenschen && zeile.bestellung && lage?.art !== "bestellung") await zielHinweise(zeile);
  if (opts.mitVorschlag && !zeile.zielVomMenschen && !zeile.dazu.length) {
    try { zeile.vorschlag = await vorschlagErmitteln(zeile, await kontextLaden()); }
    catch (e: any) { console.error("[BANK-NACHHOLEN] Vorschlag:", String(e?.message || e).slice(0, 160)); }
  }
  return { status: 200, ok: true, zeile };
}

/**
 * E-277: Ein vom Menschen getipptes oder bestätigtes Ziel lesen — nur eine vollständige
 * FIAON-Referenz („FIAON-596FE4", „FIAONMSYOCC", „FIAON-596FE4-2", „fiaon 596fe4 2").
 * Liefert die Form, die liveVerbuchen erwartet (mit Strich), oder null.
 */
export function zielLesen(roh: unknown): string | null {
  const t = String(roh ?? "").trim();
  const m = t.match(/^FIAON[\s-]*([A-Z0-9]{6})(?:[\s-]+(\d{1,2}))?$/i);
  if (!m) return null;
  return `FIAON-${m[1].toUpperCase()}${m[2] ? `-${Number(m[2])}` : ""}`;
}

/** E-277: Was der Mensch zu einem selbst gewählten Ziel wissen muss (Kette, Kündigung). */
async function zielHinweise(zeile: NachholZeile): Promise<void> {
  try {
    const [app] = (await sqlPool`
      SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`) as any[];
    if (app?.gekuendigt_am) {
      zeile.hinweise.push(`Vertrag gekündigt am ${berlinDatum(new Date(app.gekuendigt_am))} — offene Raten bleiben geschuldet (Justin 01.10.).`);
    }
    if (zeile.regel === "rate" && zeile.rateNr != null && zeile.rateNr > 1) {
      const [vor] = (await sqlPool`
        SELECT MIN(rate_nr)::int AS nr FROM fiaon_abo_raten
         WHERE ref = ${zeile.bestellung} AND rate_nr < ${zeile.rateNr} AND status = 'offen' AND storniert_am IS NULL`) as any[];
      if (vor?.nr) zeile.hinweise.push(`Rate ${vor.nr} ist noch offen — gebucht wird trotzdem Rate ${zeile.rateNr}, wie gewählt.`);
    }
  } catch { /* nur Hinweise */ }
}

/**
 * E-277: Sammelzahlung — ein Kunde überweist in Teilen („Fisimatenten-MADJ3S" 99,96 € und
 * „MADJ3S" 1,00 €). Die weiteren Eingänge müssen unverbucht, gutgeschrieben, noch in keiner
 * bezahlten Rate stehen und vom selben Zahler kommen (oder dieselbe Referenz tragen).
 */
async function sammelPruefen(zeile: NachholZeile, idsRoh: number[]): Promise<
  { ok: true; ids: number[]; summe: number; datum: string; notiz: string; hinweis: string } | { ok: false; error: string }
> {
  const ids = Array.from(new Set(idsRoh.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== zeile.id)));
  if (!ids.length) return { ok: false, error: "Keine weiteren Eingänge angegeben." };
  if (ids.length > 3) return { ok: false, error: "Eine Sammelzahlung nimmt höchstens drei weitere Eingänge." };
  const zeilen = (await sqlPool`
    SELECT id, txn_id, booked_at, amount_cents, payer_name, reference_raw, applied, note
      FROM fiaon_bank_txns WHERE id = ANY(${ids}) ORDER BY booked_at, id`) as any[];
  if (zeilen.length !== ids.length) return { ok: false, error: "Einen der weiteren Eingänge gibt es nicht." };
  const zahler = zahlerForm(zeile.absender);
  const eigeneCodes = codesImText(`${zeile.zweck ?? ""} ${zeile.zielVomMenschen ?? ""}`);
  let summe = zeile.betragCents;
  let datum = zeile.buchDatum;
  for (const r of zeilen) {
    if (r.applied) return { ok: false, error: `Eingang #${r.id} ist schon verbucht.` };
    if (!(Number(r.amount_cents) > 0)) return { ok: false, error: `Eingang #${r.id} ist kein Geldeingang.` };
    if (String(r.note || "").startsWith("Airwallex: Geld ist UNTERWEGS")) return { ok: false, error: `Eingang #${r.id} ist noch unterwegs.` };
    const [verbraucht] = (await sqlPool`
      SELECT zahlungsreferenz FROM fiaon_abo_raten
       WHERE status = 'bezahlt' AND POSITION(${`Bankeingang ${r.txn_id}`} IN COALESCE(notiz, '')) > 0 LIMIT 1`) as any[];
    if (verbraucht) return { ok: false, error: `Eingang #${r.id} steht schon in der bezahlten Rate ${verbraucht.zahlungsreferenz}.` };
    const gleicherZahler = zahler.length >= 5 && zahlerForm(r.payer_name) === zahler;
    const gleicheRef = codesImText(String(r.reference_raw || "")).some((c) => eigeneCodes.includes(c));
    if (!gleicherZahler && !gleicheRef) {
      return { ok: false, error: `Eingang #${r.id} kommt von einem anderen Zahler — eine Sammelzahlung nimmt nur Eingänge desselben Zahlers oder derselben Referenz.` };
    }
    summe += Number(r.amount_cents);
    const t = r.booked_at ? berlinDatum(new Date(r.booked_at)) : datum;
    if (t > datum) datum = t;
  }
  return {
    ok: true, ids: zeilen.map((r) => Number(r.id)), summe, datum,
    notiz: zeilen.map((r) => `Bankeingang ${r.txn_id} (Sammelzahlung mit ${zeile.txnId})`).join(" · "),
    hinweis: `Sammelzahlung: ${zeilen.length + 1} Eingänge zusammen ${eur(summe)} (${[eur(zeile.betragCents), ...zeilen.map((r) => `${eur(Number(r.amount_cents))} #${r.id}`)].join(" + ")}), gebucht per ${datum}.`,
  };
}

/**
 * Provision und Mails vorrechnen — dieselben Bausteine wie abschlussNachZahlung /
 * onRatePaid / praemieBuchen (fiaon-agent.ts, fiaon-inkasso.ts). Nur lesen.
 */
async function vorschauErgaenzen(zeile: NachholZeile): Promise<void> {
  try {
    const agent = await import("../routes/fiaon-agent");
    const { istGlobalPaket } = await import("@shared/fiaon-pakete");
    const { BUENDEL_WUNSCH_VERMERK } = await import("@shared/fiaon-auskunft-buendel");
    const [sch] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'provision_automatik'`) as any[];
    const automatikAn = String(sch?.value ?? "aus") === "an";
    const wort = automatikAn ? "GEBUCHT" : "vorgemerkt";
    const [vw] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_versandweg'`) as any[];
    const versandweg = String(vw?.value ?? "make");
    const settings = await agent.getSettings();
    const [app] = (await sqlPool`
      SELECT ref, person_id, email, contact_email, billing_email, created_at, assigned_agent_id, pack_key, pack_name,
             payment_reference, amount_due, confirmed_email_sent_at
        FROM fiaon_applications WHERE ref = ${zeile.bestellung} LIMIT 1`) as any[];
    if (!app) return;

    const provisionFuer = async (agentId: number, baseCents: number, art: "Abschluss" | "Rate", zahlRef: string) => {
      const [ag] = (await sqlPool`SELECT id, name, commission_rate_bp, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${agentId}`) as any[];
      if (!ag) return [`keine (Mitarbeiter ${agentId} fehlt)`];
      const [schon] = (await sqlPool`
        SELECT id FROM fiaon_commissions WHERE kind IN ('own','override') AND amount_cents > 0 AND status <> 'storniert'
           AND ${art === "Rate" ? sqlPool`payment_reference = ${zahlRef}` : sqlPool`ref = ${app.ref} AND (payment_reference IS NULL OR payment_reference = ${app.payment_reference})`}`) as any[];
      if (schon) return ["keine (schon gebucht)"];
      const global = art === "Abschluss" && istGlobalPaket(app.pack_key);
      const status = agent.partnerStatusFor(await agent.ownRevenueCents(Number(ag.id)), agent.partnerThresholds(settings));
      const bp = global ? Math.round((Number(settings.global_provision_prozent ?? 25) || 25) * 100) : agent.agentRateBp(ag, settings) + status.bonusBp;
      const own = agent.commissionCents(baseCents, bp);
      const zeilenP = [`${ag.name} (#${ag.id}): ${eur(own)} (${bp / 100} % von ${eur(baseCents)}, own) — ${wort}`];
      const ov = await agent.werberOverride(ag, settings, baseCents);
      if (ov) zeilenP.push(`Werber #${ov.werberId}: ${eur(ov.cents)} (${ov.bp / 100} %, override) — ${wort}`);
      return zeilenP;
    };

    if (zeile.regel === "erstzahlung") {
      const anspruch = await agent.ermittleProvisionsAnspruch(app);
      zeile.provision = anspruch.agentId
        ? await provisionFuer(Number(anspruch.agentId), agent.eurToCents(app.amount_due), "Abschluss", String(app.payment_reference))
        : ["keine (Direktzahler — kein dokumentierter Kontakt vor der Zahlung)"];
      const mailAnBestellung = !!(app.email || app.contact_email || app.billing_email);
      if (istGlobalPaket(app.pack_key)) zeile.mails.push("global_start (Firmenauftrag, nach der Start-Aufgabe)");
      else if (app.confirmed_email_sent_at) zeile.mails.push("keine Zugangsmail (schon verschickt)");
      else if (mailAnBestellung) zeile.mails.push(`payment_confirmed „Willkommen & Zugang“ mit Login-Link (Versandweg ${versandweg})`);
      else {
        // Seit 01.10.: sendPaymentConfirmedOnce fällt auf die Adresse der PERSON zurück, wenn die
        // Bestellung keine trägt. Fehlt sie auch dort, geht nichts raus — dann steht es hier.
        const [pm] = (await sqlPool`SELECT NULLIF(TRIM(primary_email), '') AS mail FROM fiaon_persons WHERE id = ${app.person_id}`.catch(() => [])) as any[];
        if (pm?.mail) zeile.mails.push(`payment_confirmed „Willkommen & Zugang“ an die Adresse der Person (Bestellung ohne Adresse; Versandweg ${versandweg})`);
        else {
          zeile.mails.push("KEINE Zugangsmail — weder Bestellung noch Person haben eine Adresse; nach dem Buchen Adresse nachtragen und in der Akte „Zahlung bestätigt“ senden");
          zeile.hinweise.push("Keine E-Mail-Adresse am Kunden: Zugangsmail geht nicht automatisch raus.");
        }
      }
      const [karte] = (await sqlPool`SELECT 1 AS da FROM fiaon_konto_karte WHERE person_id = ${app.person_id} AND kanal <> 'gemeldet' LIMIT 1`.catch(() => [])) as any[];
      if (!istGlobalPaket(app.pack_key)) {
        zeile.mails.push(karte ? "keine Karten-Einladung (schon eingeladen)"
          : "konto_karte_einladung „Ihr Link zur Karte ist da“ — Takt karten_einladungen (≤ 5 Min.), falls Antrag vollständig und keine Sperre");
      }
      const [bund] = (await sqlPool`SELECT 1 AS da FROM fiaon_contact_log WHERE ref = ${app.ref} AND voided_at IS NULL AND note LIKE ${`${BUENDEL_WUNSCH_VERMERK}%`} LIMIT 1`.catch(() => [])) as any[];
      if (bund) zeile.mails.push("Bündel: Auskunft-Bestellung zum Kundenpreis + deren Zahlungsdaten-Mail");
    } else if (zeile.rateId) {
      const [r] = (await sqlPool`SELECT id, rate_nr, zahlungsreferenz, betrag_cents FROM fiaon_abo_raten WHERE id = ${zeile.rateId}`) as any[];
      if (r) {
        zeile.provision = Number(r.rate_nr) >= 2 && app.assigned_agent_id
          ? await provisionFuer(Number(app.assigned_agent_id), Number(r.betrag_cents), "Rate", String(r.zahlungsreferenz))
          : [Number(r.rate_nr) >= 2 ? "keine (kein zuständiger Betreuer)" : "keine (Rate 1 = Abschluss)"];
        // Inkasso-Prämie — dieselben Tore wie praemieBuchen (fiaon-inkasso.ts)
        const [arb] = (await sqlPool`
          SELECT w.agent_id, a.name, a.inkasso_praemie_art, a.inkasso_praemie_wert, a.verguetung_bestaetigt_am, a.active
            FROM fiaon_raten_arbeit w LEFT JOIN fiaon_agents a ON a.id = w.agent_id
           WHERE w.rate_id = ${r.id} AND w.ergebnis IN ('zahlt_am', 'ueberwiesen_beleg', 'nicht_erreicht')
           ORDER BY w.created_at DESC LIMIT 1`.catch(() => [])) as any[];
        if (arb && arb.active && arb.verguetung_bestaetigt_am) {
          const { VERGUETUNG_VORGABE } = await import("./fiaon-inkasso");
          const art = String(arb.inkasso_praemie_art || VERGUETUNG_VORGABE.praemieArt);
          const wert = Number(arb.inkasso_praemie_wert ?? VERGUETUNG_VORGABE.praemieWert);
          const c = art === "prozent" ? Math.round((Number(r.betrag_cents) * wert) / 10_000) : wert;
          if (c > 0) zeile.provision.push(`Inkasso-Prämie ${arb.name ?? `#${arb.agent_id}`}: ${eur(c)} — ${wort}`);
        }
        zeile.mails.push(Number(r.rate_nr) % 12 === 0 ? "abo_verlaengerung_frage (Rate 12)" : "keine (Ratenbuchung schickt keine Mail; Mahnungen zu dieser Rate enden)");
        // ── Der Kunde nennt eine andere Rate (Fall J8UU3U, 01.10.2026) ────────
        // „FIAON J8UU3U 3", Regel B bucht aber die ÄLTESTE offene Rate 2. Das ist
        // richtig (die Kette läuft vorwärts), aber der Betreuer muss es dem Kunden
        // sagen können — beim Buchen entsteht eine Aufgabe für ihn.
        const genannt = genannteRate(zeile.zweck);
        if (zeile.regel === "regel_b" && genannt != null && genannt !== Number(r.rate_nr)) {
          zeile.genannteRate = genannt;
          zeile.hinweise.push(`Kunde nennt Rate ${genannt}, gebucht wird die älteste offene Rate ${r.rate_nr}; Rate ${genannt} bleibt offen. Beim Buchen bekommt der Betreuer eine Aufgabe dazu.`);
        }
      }
    }
  } catch (e: any) {
    zeile.provision.push(`nicht berechenbar: ${String(e?.message || e).slice(0, 120)}`);
  }
}

// Ein Eingang wird nie von zwei Klicks gleichzeitig gebucht (Doppelklick, zwei Fenster).
const inArbeit = new Set<string>();

/**
 * SCHARF BUCHEN — erst die Trockenprobe, dann liveVerbuchen über den einen Weg.
 * `wer`: steht im Bankbuch-Vermerk und in der Ratennotiz („Nachhol-Lauf (Bankbuch js@…)").
 * `erwartet`: Regel, Ziel und Rate aus der Vorschau, die der Mensch gesehen hat — weicht
 * der Server heute davon ab, wird NICHT gebucht (409).
 */
export async function bankeingangBuchen(
  id: number,
  opts: {
    ueberzahlungBisCents?: number; wer: string; erwartet?: { regel?: string | null; ziel?: string | null; rateId?: number | null } | null;
    /** E-277: vom Menschen bestätigtes Ziel — derselbe Weg, alle Sperren. */
    ziel?: string | null;
    /** E-277: Sammelzahlung — weitere Eingänge, die mit diesem zusammen gebucht werden. */
    dazu?: number[] | null;
    /** E-278: Storno der Zielrate bzw. -bestellung zurücknehmen, dann buchen (scheitert die Buchung: Storno zurück). */
    stornoZuruecknehmen?: boolean;
    /** E-278: Doppel-/Vorauszahlung an der Rückwärtssperre mit dem heutigen Datum verrechnen. */
    verrechnungHeute?: boolean;
    /** E-278: Wer freigegeben hat (Vermerke), Vorgabe „Justin“. */
    freigabe?: string | null;
  },
): Promise<NachholAntwort & { ergebnis?: any; bankbuch?: any; aufgabe?: string | null; aufgabenErledigt?: number }> {
  const probe = await bankeingangTrockenprobe(id, {
    ueberzahlungBisCents: opts.ueberzahlungBisCents, ziel: opts.ziel ?? null, dazu: opts.dazu ?? null,
    stornoZuruecknehmen: !!opts.stornoZuruecknehmen, verrechnungHeute: !!opts.verrechnungHeute, freigabe: opts.freigabe ?? null,
  });
  if (!probe.ok || !probe.zeile) return probe;
  const zeile = probe.zeile;
  if (!zeile.buchen) return { status: 409, ok: false, error: `Nicht buchbar: ${zeile.ergebnis}`, zeile };
  const e = opts.erwartet;
  if (e && ((e.regel ?? null) !== (zeile.regel ?? null) || (e.ziel ?? null) !== (zeile.ziel ?? null) || (e.rateId ?? null) !== (zeile.rateId ?? null))) {
    return { status: 409, ok: false, error: `Der Stand hat sich seit der Vorschau geändert (jetzt: ${zeile.regel ?? "—"} ${zeile.ziel ?? ""}) — bitte neu prüfen.`, zeile };
  }
  // Doppelklick, zwei Fenster: Kein Eingang — auch kein Teil einer Sammelzahlung — läuft zweimal.
  const dazuTxn = zeile.dazu.length
    ? ((await sqlPool`SELECT txn_id FROM fiaon_bank_txns WHERE id = ANY(${zeile.dazu})`) as any[]).map((r) => String(r.txn_id))
    : [];
  const alle = [zeile.txnId, ...dazuTxn];
  if (alle.some((t) => inArbeit.has(t))) return { status: 409, ok: false, error: "Dieser Eingang wird gerade schon gebucht.", zeile };
  for (const t of alle) inArbeit.add(t);
  try {
    const toleranz = Math.max(0, Math.min(100, Math.floor(Number(opts.ueberzahlungBisCents ?? 100) || 0)));
    const { liveVerbuchen } = await import("../routes/fiaon-wise");
    const anlass = `Nachhol-Lauf (${String(opts.wer || "Bankbuch").slice(0, 80)})`;
    const notizTeile = [
      ...dazuTxn.map((t) => `Bankeingang ${t} (Sammelzahlung mit ${zeile.txnId})`),
      ...(zeile.verrechnung ? [zeile.verrechnung] : []),
    ];
    const notizZusatz = notizTeile.length ? notizTeile.join(" · ") : null;

    // ── E-278: Storno zurücknehmen — erst NACH der Trockenprobe, im Schutz der Sperre ──
    // Die Lage wird hier frisch gelesen (nicht aus der Vorschau übernommen). Scheitert die
    // Buchung danach, stellt `zurueck` den Storno wieder her — kein halber Zustand.
    let storno: StornoSchritt | null = null;
    if (opts.stornoZuruecknehmen && zeile.zielVomMenschen) {
      const l = await stornoLageLesen(zeile.zielVomMenschen);
      if (!l.ok) return { status: 409, ok: false, error: l.error, zeile };
      if (l.lage) {
        const sch = await stornoVorBuchungZuruecknehmen(l.lage, zeile, anlass, freigabeSatz(opts.freigabe));
        if (!sch.ok) return { status: 409, ok: false, error: sch.error, zeile };
        storno = sch;
      }
    }
    let erg: Awaited<ReturnType<typeof liveVerbuchen>> | null = null;
    try {
      erg = await liveVerbuchen(zeile.txnId, zeile.zielVomMenschen ?? zeile.zweckRef, zeile.summeCents, zeile.buchDatum, {
        trocken: false, ueberzahlungBisCents: toleranz, anlass, zielVomMenschen: !!zeile.zielVomMenschen, notizZusatz,
      });
    } finally {
      if (storno && !erg?.gebucht) {
        await storno.zurueck(erg?.grund ?? "Fehler beim Buchen").catch((e: any) => console.error("[BANK-NACHHOLEN] Storno wiederherstellen:", String(e?.message || e).slice(0, 200)));
      }
    }
    if (!erg) throw new Error("Buchung ohne Ergebnis");
    if (erg.gebucht && storno) {
      await storno.danach().catch((e: any) => console.error("[BANK-NACHHOLEN] Nach der Reaktivierung:", String(e?.message || e).slice(0, 200)));
    }
    if (erg.gebucht && zeile.verrechnung) {
      await sqlPool`
        UPDATE fiaon_bank_txns SET note = CONCAT_WS(' · ', NULLIF(note, ''), ${zeile.verrechnung}::text), updated_at = NOW()
         WHERE id = ${id}
      `.catch(() => {});
    }
    if (erg.gebucht && zeile.dazu.length) {
      // Die übrigen Eingänge der Sammelzahlung: verbucht, derselben Bestellung zugeordnet, kein zweites Geld.
      await sqlPool`
        UPDATE fiaon_bank_txns
           SET applied = TRUE, applied_at = NOW(), matched_ref = ${erg.bestellung ?? zeile.bestellung}, match_status = 'matched',
               note = CONCAT_WS(' · ', NULLIF(note, ''), ${`${anlass}: Teil der Sammelzahlung mit Eingang ${zeile.txnId} → ${erg.ziel ?? zeile.ziel} (zusammen ${eur(zeile.summeCents)}, gebucht per ${zeile.buchDatum}).`}::text),
               updated_at = NOW()
         WHERE id = ANY(${zeile.dazu}) AND NOT applied
      `;
    }
    const [nach] = (await sqlPool`SELECT applied, matched_ref, match_status, note FROM fiaon_bank_txns WHERE id = ${id} LIMIT 1`) as any[];
    console.log(`[BANK-NACHHOLEN] ${zeile.txnId}${zeile.dazu.length ? ` + ${zeile.dazu.length} Sammel-Eingang/Eingänge` : ""}${zeile.zielVomMenschen ? ` → Ziel ${zeile.zielVomMenschen}` : ""} (${anlass}): ${erg.gebucht ? "GEBUCHT" : "nicht gebucht"} — ${erg.grund}`);
    let aufgabe: string | null = null;
    if (erg.gebucht && zeile.genannteRate != null && zeile.rateNr != null && zeile.bestellung) {
      aufgabe = await aufgabeAndereRate(zeile, anlass);
    }
    const aufgabenErledigt = erg.gebucht ? await bankAufgabenSchliessen(alle, anlass, `Gebucht: ${eur(zeile.summeCents)} auf ${erg.ziel ?? zeile.ziel ?? "—"} (${erg.grund}). Nichts erstatten — das Geld ist verbucht.`) : 0;
    return { status: 200, ok: true, zeile: { ...zeile, schonVerbucht: !!nach?.applied }, ergebnis: erg, bankbuch: nach ?? null, aufgabe, aufgabenErledigt };
  } finally {
    for (const t of alle) inArbeit.delete(t);
  }
}

/** Fall J8UU3U: Der Betreuer erfährt, dass die genannte Rate NICHT die gebuchte ist. */
async function aufgabeAndereRate(zeile: NachholZeile, anlass: string): Promise<string | null> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: zeile.personId, ref: zeile.bestellung,
      titel: `Kunde nennt Rate ${zeile.genannteRate}, gebucht ist Rate ${zeile.rateNr} (${zeile.bestellung})`.slice(0, 160),
      text: `Bankeingang ${zeile.txnId} vom ${zeile.datum} über ${eur(zeile.betragCents)} mit dem Zweck „${(zeile.zweck || "").slice(0, 120)}“ `
        + `wurde auf die älteste offene Rate ${zeile.rateNr} (${zeile.ziel}) gebucht — die Kette läuft vorwärts, eine Lücke wird nie übersprungen. `
        + `Der Kunde nennt Rate ${zeile.genannteRate}; sie bleibt offen und wird mit der nächsten Zahlung fällig. `
        + `Bitte dem Kunden kurz erklären, welche Rate als bezahlt gilt und welche noch offen ist (Zahlungsseite in der Akte).`,
      schluessel: `bank-nachholen:andere-rate:${zeile.txnId}`,
      quelle: "bankbuch", bereich: "konten", autorName: anlass,
      link: zeile.bestellung ? `/akte/${zeile.bestellung}` : null,
    });
    return erg.agentName ? `Aufgabe an ${erg.agentName}` : (erg.id ? "Aufgabe beim Betreiber (kein Betreuer)" : null);
  } catch (e: any) {
    console.error("[BANK-NACHHOLEN] Aufgabe andere Rate:", String(e?.message || e).slice(0, 160));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-278 (03.10.2026) — STORNO ZURÜCKNEHMEN UND MIT HEUTIGEM DATUM VERRECHNEN
//
// Justin: „Konchenko-Sperre im Code reparieren und dann buchen mach ALLE fertig“
//
// Die Fälle vom 03.10.: Körner und Condescu haben die Rate bezahlt, die bei ihrer
// Kündigung per Kulanz storniert wurde — das Geld wird behalten, der Storno also
// zurückgenommen und die Rate gebucht. Robiban hat bezahlt, ihre Bestellung war
// am 17.09. als „unbezahlt“ storniert — sie wird reaktiviert und gebucht.
// Schlebusch hat die Startzahlung doppelt überwiesen — verrechnet mit Rate 3,
// gebucht mit dem heutigen Datum (die Rückwärtssperre lehnt den 25.08. ab, weil
// Rate 2 am 02.10. bezahlt wurde).
//
// Zurückgenommen werden NUR Stornos, die eine Kündigung gesetzt hat (Raten:
// storno_grund 'kuendigung' oder 'kuendigung_kulanz', die Gründe der beiden
// bestehenden Rücknahmewege) und stornierte Bestellungen ohne bezahlte Rate. Ein
// Storno wegen Erstattung, Dublette oder Abo-Stopp bleibt, wie er ist.
// ═══════════════════════════════════════════════════════════════════════════
const STORNO_ZURUECK_GRUENDE = ["kuendigung", "kuendigung_kulanz"] as const;

/** E-278: „03.10.2026“ aus „2026-10-03“. */
const tagLang = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** E-278: Wer freigegeben hat, mit Datum (Berlin) — „Justin 03.10.2026“. */
function freigabeSatz(freigabe?: string | null): string {
  const wer = String(freigabe ?? "").trim().slice(0, 60) || "Justin";
  return `${wer} ${tagLang(berlinToday())}`;
}

/**
 * E-278: Wann wurde die letzte Vorgängerrate bezahlt? Dieselbe Abfrage wie die Rückwärtssperre
 * in rateBezahltBuchen (server/routes/fiaon-abo.ts) — damit die Vorschau genau das sagt, was die
 * Buchung tun wird. „YYYY-MM-DD“ oder null.
 */
async function letzteZahlungVorher(bestellung: string, rateNr: number): Promise<string | null> {
  const [v] = (await sqlPool`
    SELECT MAX(bezahlt_am) AS letzte FROM fiaon_abo_raten
     WHERE ref = ${bestellung} AND rate_nr < ${rateNr} AND status = 'bezahlt' AND bezahlt_am IS NOT NULL
  `) as any[];
  return v?.letzte ? new Date(v.letzte).toISOString().slice(0, 10) : null;
}

/** E-278: Was „Storno zurücknehmen“ an diesem Ziel tun würde. */
export interface StornoLage {
  art: "rate" | "bestellung";
  /** fiaon_applications.ref */
  bestellung: string;
  rateId: number | null;
  rateNr: number | null;
  /** Raten- bzw. Bestellreferenz in der Schreibweise der Datenbank. */
  zahlungsreferenz: string;
  /** storno_grund der Rate; bei der Bestellung „cancelled“. */
  grund: string;
  personId: number | null;
  /** Ein Satz für die Vorschau. */
  text: string;
}

/**
 * E-278: Ist das Ziel storniert, und darf der Storno zurückgenommen werden? Schreibt nichts.
 * lage = null: nichts zurückzunehmen (die Rate lebt, die Bestellung ist nicht storniert).
 */
export async function stornoLageLesen(ziel: string): Promise<{ ok: true; lage: StornoLage | null } | { ok: false; error: string }> {
  const vgl = refVergleichsform(ziel);
  if (RATEN_MUSTER.test(ziel)) {
    const [lebt] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
       WHERE UPPER(REGEXP_REPLACE(zahlungsreferenz, '[^A-Za-z0-9]', '', 'g')) = ${vgl} AND storniert_am IS NULL
    `) as any[];
    if (Number(lebt?.n) > 0) return { ok: true, lage: null };
    const st = (await sqlPool`
      SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.storno_grund, r.bezahlt_am, a.person_id
        FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
       WHERE UPPER(REGEXP_REPLACE(r.zahlungsreferenz, '[^A-Za-z0-9]', '', 'g')) = ${vgl} AND r.status = 'storniert'
    `) as any[];
    if (!st.length) return { ok: true, lage: null };
    if (st.length > 1) return { ok: false, error: `Rate ${ziel} ist mehrfach storniert — bitte von Hand klären.` };
    const r = st[0];
    const grund = String(r.storno_grund ?? "");
    if (!(STORNO_ZURUECK_GRUENDE as readonly string[]).includes(grund)) {
      return { ok: false, error: `Rate ${r.zahlungsreferenz} ist storniert (Grund „${grund || "—"}“) — zurückgenommen werden nur Stornos aus einer Kündigung („kuendigung“, „kuendigung_kulanz“).` };
    }
    if (r.bezahlt_am) return { ok: false, error: `Rate ${r.zahlungsreferenz} trägt schon ein Zahldatum — bitte von Hand klären.` };
    return {
      ok: true,
      lage: {
        art: "rate", bestellung: String(r.ref), rateId: Number(r.id), rateNr: Number(r.rate_nr), zahlungsreferenz: String(r.zahlungsreferenz),
        grund, personId: r.person_id != null ? Number(r.person_id) : null,
        text: `Rate ${r.rate_nr} (${r.zahlungsreferenz}) ist storniert (${grund}) — der Storno wird zurückgenommen, die Rate wieder offen und dann mit diesem Eingang gebucht. Scheitert die Buchung, bleibt der Storno.`,
      },
    };
  }
  const apps = (await sqlPool`
    SELECT a.ref, a.payment_reference, a.payment_status, a.account_status, a.gekuendigt_am, a.person_id, p.is_blocked
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE UPPER(REGEXP_REPLACE(COALESCE(a.payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${vgl} AND a.merged_into IS NULL
  `) as any[];
  if (apps.length !== 1 || String(apps[0].payment_status) !== "cancelled") return { ok: true, lage: null };
  const a = apps[0];
  const [bez] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten WHERE ref = ${a.ref} AND status = 'bezahlt'`) as any[];
  if (Number(bez?.n) > 0) {
    return { ok: false, error: `Die stornierte Bestellung ${a.payment_reference} hat schon bezahlte Raten — sie wird nicht über eine Erstzahlung reaktiviert. Bitte von Hand klären.` };
  }
  const schritte = [
    "Zahlungsstatus storniert → offen",
    a.gekuendigt_am ? `Kündigung vom ${tagLang(berlinDatum(new Date(a.gekuendigt_am)))} zurückgenommen` : null,
    String(a.account_status) === "suspended" ? "gesperrtes Konto wird mit der Buchung aktiv" : null,
    a.is_blocked ? "Vertriebssperre der Person aufgehoben" : null,
  ].filter(Boolean);
  return {
    ok: true,
    lage: {
      art: "bestellung", bestellung: String(a.ref), rateId: null, rateNr: null, zahlungsreferenz: String(a.payment_reference),
      grund: "cancelled", personId: a.person_id != null ? Number(a.person_id) : null,
      text: `Die Bestellung ${a.payment_reference} ist storniert — sie wird reaktiviert (${schritte.join(", ")}) und dann die Erstzahlung gebucht. Scheitert die Buchung, bleibt sie storniert.`,
    },
  };
}

/** E-278: Ein zurückgenommener Storno — `zurueck` stellt ihn wieder her, `danach` läuft nach der Buchung. */
interface StornoSchritt {
  ok: true;
  zurueck: (grund: string) => Promise<void>;
  danach: () => Promise<void>;
}

/**
 * E-278: Den Storno VOR der Buchung zurücknehmen. Rate: wieder offen, mit Vermerk. Bestellung:
 * kuendigungZuruecknehmen, Zahlungsstatus offen, gesperrtes Konto auf „pending“ (alsBezahltBuchen
 * setzt danach „active“ — ein gesperrtes Konto ließe es stehen). Die Vertriebssperre fällt erst in
 * `danach`, wenn das Geld gebucht ist — so muss bei einem Fehlschlag niemand wieder gesperrt werden.
 */
async function stornoVorBuchungZuruecknehmen(
  lage: StornoLage, zeile: NachholZeile, anlass: string, freigabe: string,
): Promise<StornoSchritt | { ok: false; error: string }> {
  const zahlung = `Zahlung ${eur(zeile.summeCents)} am ${tagLang(zeile.datum)} eingegangen`;

  if (lage.art === "rate" && lage.rateId) {
    const [vorher] = (await sqlPool`
      SELECT id, ref, rate_nr, zahlungsreferenz, status, storniert_am, storno_grund, notiz FROM fiaon_abo_raten WHERE id = ${lage.rateId}
    `) as any[];
    if (!vorher || vorher.status !== "storniert" || !(STORNO_ZURUECK_GRUENDE as readonly string[]).includes(String(vorher.storno_grund))) {
      return { ok: false, error: "Die Rate ist nicht mehr per Kündigung storniert — bitte neu prüfen." };
    }
    const vermerk = `Storno (${vorher.storno_grund}) zurückgenommen: ${zahlung} — ${freigabe}`;
    try {
      const w = (await sqlPool`
        UPDATE fiaon_abo_raten
           SET status = 'offen', storniert_am = NULL, storno_grund = NULL,
               notiz = CONCAT_WS(' · ', NULLIF(notiz, ''), ${vermerk}::text), updated_at = NOW()
         WHERE id = ${vorher.id} AND status = 'storniert' AND storno_grund = ${vorher.storno_grund}
         RETURNING id
      `) as any[];
      if (!w.length) return { ok: false, error: "Die Rate hat sich gerade geändert — bitte neu prüfen." };
    } catch (e: any) {
      const m = String(e?.message || e);
      if (/duplicate key|unique/i.test(m)) return { ok: false, error: `Rate ${vorher.zahlungsreferenz}: Eine andere Rate dieses Vertrags ist auf denselben Tag fällig — der Storno lässt sich nicht zurücknehmen.` };
      throw e;
    }
    console.log(`[BANK-NACHHOLEN] ${zeile.txnId}: Storno (${vorher.storno_grund}) von Rate ${vorher.zahlungsreferenz} zurückgenommen (${anlass}) — jetzt wird gebucht.`);
    return {
      ok: true,
      zurueck: async (grund: string) => {
        await sqlPool`
          UPDATE fiaon_abo_raten
             SET status = 'storniert', storniert_am = ${vorher.storniert_am}, storno_grund = ${vorher.storno_grund},
                 notiz = ${vorher.notiz}, updated_at = NOW()
           WHERE id = ${vorher.id} AND status = 'offen' AND bezahlt_am IS NULL
        `;
        console.log(`[BANK-NACHHOLEN] ${zeile.txnId}: Buchung gescheitert (${grund}) — Storno von Rate ${vorher.zahlungsreferenz} wiederhergestellt.`);
      },
      danach: async () => {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${vorher.ref}, ${lage.personId}, NULL, 'System', 'system',
                  ${`Rate ${vorher.rate_nr} (${vorher.zahlungsreferenz}): Storno (${vorher.storno_grund}) zurückgenommen — ${zahlung} (Bankeingang ${zeile.txnId}), die Zahlung wird behalten und ist gebucht. Freigabe: ${freigabe} (${anlass}).`})
        `.catch(() => {});
      },
    };
  }

  // ── Bestellung reaktivieren (Fall Robiban) ────────────────────────────────
  const [a] = (await sqlPool`
    SELECT ref, payment_reference, payment_status, cancelled_at, account_status, gekuendigt_am, kuendigung_zurueckgenommen_am,
           letzte_rate_nr, vertrag_ende_am, abo_gestoppt_am, abo_stopp_grund, person_id
      FROM fiaon_applications WHERE ref = ${lage.bestellung} LIMIT 1
  `) as any[];
  if (!a || String(a.payment_status) !== "cancelled") return { ok: false, error: "Die Bestellung ist nicht mehr storniert — bitte neu prüfen." };
  const kuendigungsRaten = (await sqlPool`
    SELECT id, storniert_am FROM fiaon_abo_raten WHERE ref = ${a.ref} AND status = 'storniert' AND storno_grund = 'kuendigung'
  `) as any[];
  const grundText = `${zahlung} (Bankeingang ${zeile.txnId}) — Bestellung reaktiviert, Freigabe: ${freigabe}`;
  const zurueckSetzen = async () => {
    await sqlPool`
      UPDATE fiaon_applications
         SET payment_status = ${a.payment_status}, cancelled_at = ${a.cancelled_at}, account_status = ${a.account_status},
             gekuendigt_am = ${a.gekuendigt_am}, kuendigung_zurueckgenommen_am = ${a.kuendigung_zurueckgenommen_am},
             letzte_rate_nr = ${a.letzte_rate_nr}, vertrag_ende_am = ${a.vertrag_ende_am},
             abo_gestoppt_am = ${a.abo_gestoppt_am}, abo_stopp_grund = ${a.abo_stopp_grund}, updated_at = NOW()
       WHERE ref = ${a.ref} AND payment_status <> 'paid'
    `;
    for (const r of kuendigungsRaten) {
      await sqlPool`
        UPDATE fiaon_abo_raten SET status = 'storniert', storniert_am = ${r.storniert_am}, storno_grund = 'kuendigung', updated_at = NOW()
         WHERE id = ${r.id} AND status = 'offen' AND bezahlt_am IS NULL
      `;
    }
  };
  try {
    if (a.gekuendigt_am) {
      const { kuendigungZuruecknehmen } = await import("./fiaon-kuendigung");
      await kuendigungZuruecknehmen(String(a.ref), grundText);
    }
    const w = (await sqlPool`
      UPDATE fiaon_applications
         SET payment_status = 'pending_payment', cancelled_at = NULL,
             account_status = CASE WHEN account_status = 'suspended' THEN 'pending' ELSE account_status END,
             updated_at = NOW()
       WHERE ref = ${a.ref} AND payment_status = 'cancelled'
       RETURNING ref
    `) as any[];
    if (!w.length) throw new Error("Die Bestellung hat sich gerade geändert — bitte neu prüfen.");
  } catch (e: any) {
    await zurueckSetzen().catch(() => {});
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${a.ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
            ${`Storno der Bestellung zurückgenommen: ${grundText}. Zahlungsstatus storniert → offen${String(a.account_status) === "suspended" ? ", gesperrtes Konto → wird mit der Buchung aktiv" : ""} (${anlass}).`})
  `.catch(() => {});
  console.log(`[BANK-NACHHOLEN] ${zeile.txnId}: Bestellung ${a.payment_reference} reaktiviert (${anlass}) — jetzt wird gebucht.`);
  return {
    ok: true,
    zurueck: async (grund: string) => {
      await zurueckSetzen();
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${a.ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Reaktivierung zurückgedreht: Die Buchung von Bankeingang ${zeile.txnId} ist gescheitert (${String(grund).slice(0, 160)}) — die Bestellung ist wieder storniert wie vorher.`})
      `.catch(() => {});
      console.log(`[BANK-NACHHOLEN] ${zeile.txnId}: Buchung gescheitert (${grund}) — Bestellung ${a.payment_reference} wieder storniert.`);
    },
    danach: async () => {
      // Die Vertriebssperre fällt wie über POST /admin/kunden/:personId/vertriebssperre — derselbe Baustein.
      if (a.person_id == null) return;
      const { vertriebssperreAendern } = await import("../routes/fiaon-kunden");
      const s = await vertriebssperreAendern(Number(a.person_id), false, grundText);
      if (s.ok && !s.unveraendert) console.log(`[BANK-NACHHOLEN] ${zeile.txnId}: Vertriebssperre der Person ${a.person_id} aufgehoben.`);
    },
  };
}

/**
 * E-278: Offene Bankbuch-Aufgaben dieses Eingangs schließen (Teil-, Über-, Rückzahlung aus
 * bankeingangAufgabe). Das Geld ist gebucht — eine stehengebliebene „Rückzahlung nötig“ hieße,
 * die Zahlungsstelle erstattet, was gerade verbucht wurde. Liefert, wie viele geschlossen wurden.
 */
async function bankAufgabenSchliessen(txnIds: string[], anlass: string, text: string): Promise<number> {
  try {
    const schluessel = txnIds.flatMap((t) => ["teilzahlung", "ueberzahlung", "rueckzahlung_noetig"].map((art) => `bank-nachholen:${art}:${t}`));
    if (!schluessel.length) return 0;
    const zu = (await sqlPool`
      UPDATE fiaon_betreiber_todos
         SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${anlass.slice(0, 120)},
             ergebnis = COALESCE(ergebnis, ${text}::text), frage_offen = FALSE, updated_at = NOW()
       WHERE schluessel = ANY(${schluessel}) AND status <> 'erledigt'
       RETURNING id
    `) as any[];
    for (const t of zu) {
      await sqlPool`
        INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
        VALUES (${t.id}, 'system', ${anlass.slice(0, 120)}, 'ergebnis', ${text})
      `.catch(() => {});
    }
    if (zu.length) console.log(`[BANK-NACHHOLEN] ${txnIds[0]}: ${zu.length} Bankbuch-Aufgabe(n) erledigt — Geld gebucht.`);
    return zu.length;
  } catch (e: any) {
    console.error("[BANK-NACHHOLEN] Aufgaben schließen:", String(e?.message || e).slice(0, 160));
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-277 — „NUR ZUORDNEN": das Geld ist schon auf anderem Weg gebucht
//
// Typischer Fall (Buchungsläufe 31.08./01.09.): Der Kunde wurde per mark-paid
// freigeschaltet, Rate 1 steht als „Startzahlung" bezahlt — aber die Zeile im
// Bankbuch hat nie ihren Haken bekommen. Ein zweites Buchen wäre eine Doppel-
// buchung (23.08.). Hier wird NUR vermerkt, wem das Geld gehört:
//   · Bankbuch-Zeile applied + matched_ref + Vermerk,
//   · „Bankeingang <txn> — nur zugeordnet" in der bezahlten Rate (damit die
//     Sperre „schon verbraucht" und die Deckungsrechnung von Regel B den
//     Eingang kennen),
//   · ein Satz in der Akte.
// Keine Statusänderung, keine Mail, keine Provision, keine neue Rate.
//
// Sperren: Ziel muss bezahlt sein; der Eingang darf in keiner anderen
// bezahlten Rate stehen; DECKUNG JE KUNDE — alle Eingänge der Bestellung plus
// dieser dürfen die bezahlten Raten nicht übersteigen (1 € Toleranz je Rate),
// und die Rate selbst nicht doppelt belegen. Sonst ist es eine Doppelzahlung,
// keine Zuordnung — dann bleibt es Handarbeit (Erstattung oder Verrechnung).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bankeingänge, die eine Ratennotiz als Beleg nennt („Bankeingang AWX-…", „Bankeingang
 * TRANSFER-…"). Ein Verweis zählt NICHT, wenn das nächste Notizstück eine Rückbuchung
 * ist (Korrektur 27.08.: „Bankeingang TRANSFER-… · Rueckbuchung 27.08.2026: Der
 * Bankeingang war bereits für die Paketzahlung verbraucht …").
 */
export function belegeAusNotiz(notiz: unknown): string[] {
  const stuecke = String(notiz ?? "").split(/\s·\s/);
  const aus: string[] = [];
  stuecke.forEach((s, i) => {
    const naechstes = String(stuecke[i + 1] ?? "").trim();
    if (/^R(ue|ü)ckbuchung/i.test(naechstes)) return;
    for (const m of Array.from(s.matchAll(/Bankeingang\s+((?:TRANSFER|AWX)-[A-Za-z0-9-]+)/g))) aus.push(m[1]);
  });
  return Array.from(new Set(aus));
}

interface ZielAufgeloest {
  art: "rate" | "bestellung";
  ziel: string;
  bestellung: string;
  rateId: number | null;
  rateNr: number | null;
  betragCents: number;
  bezahlt: boolean;
  bezahltAm: string | null;
  notiz: string;
  kunde: string | null;
  personId: number | null;
  bestellStatus: string;
}

/** Ziel einer Zuordnung finden — Rate (mit -N oder Rate 1 der Bestellung) oder Bestellung ohne Raten. */
async function zielAufloesen(ziel: string): Promise<{ ok: true; z: ZielAufgeloest } | { ok: false; status: number; error: string }> {
  const vgl = refVergleichsform(ziel);
  const kunde = (a: any) => String([a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || "").trim() || null;
  const ausRate = (r: any): ZielAufgeloest => ({
    art: "rate", ziel: String(r.zahlungsreferenz), bestellung: String(r.ref), rateId: Number(r.id), rateNr: Number(r.rate_nr),
    betragCents: Number(r.betrag_cents), bezahlt: r.status === "bezahlt", bezahltAm: r.bezahlt_am ? berlinDatum(new Date(r.bezahlt_am)) : null,
    notiz: String(r.notiz || ""), kunde: kunde(r), personId: r.person_id != null ? Number(r.person_id) : null, bestellStatus: String(r.payment_status || ""),
  });
  if (RATEN_MUSTER.test(ziel)) {
    const raten = (await sqlPool`
      SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.status, r.bezahlt_am, r.notiz,
             a.person_id, a.first_name, a.last_name, a.contact_name, a.payment_status
        FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
       WHERE UPPER(REGEXP_REPLACE(r.zahlungsreferenz, '[^A-Za-z0-9]', '', 'g')) = ${vgl} AND r.storniert_am IS NULL`) as any[];
    if (raten.length !== 1) return { ok: false, status: 404, error: raten.length ? `Rate ${ziel} ist nicht eindeutig.` : `Rate ${ziel} gibt es nicht (oder sie ist storniert).` };
    return { ok: true, z: ausRate(raten[0]) };
  }
  const apps = (await sqlPool`
    SELECT ref, payment_reference, payment_status, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll, person_id, first_name, last_name, contact_name, completed_at
      FROM fiaon_applications
     WHERE UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${vgl} AND merged_into IS NULL`) as any[];
  if (apps.length !== 1) return { ok: false, status: 404, error: apps.length ? `Referenz ${ziel} ist mehrdeutig.` : `Zu ${ziel} gibt es keine Bestellung.` };
  const a = apps[0];
  const [r1] = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.status, r.bezahlt_am, r.notiz
      FROM fiaon_abo_raten r WHERE r.ref = ${a.ref} AND r.rate_nr = 1 AND r.storniert_am IS NULL LIMIT 1`) as any[];
  if (r1) return { ok: true, z: ausRate({ ...r1, person_id: a.person_id, first_name: a.first_name, last_name: a.last_name, contact_name: a.contact_name, payment_status: a.payment_status }) };
  return {
    ok: true,
    z: {
      art: "bestellung", ziel: String(a.payment_reference), bestellung: String(a.ref), rateId: null, rateNr: null,
      betragCents: Number(a.soll), bezahlt: String(a.payment_status) === "paid",
      bezahltAm: a.completed_at ? berlinDatum(new Date(a.completed_at)) : null, notiz: "",
      kunde: kunde(a), personId: a.person_id != null ? Number(a.person_id) : null, bestellStatus: String(a.payment_status || ""),
    },
  };
}

interface Deckung {
  eingaengeCents: number;
  eingaenge: Array<{ id: number; txnId: string; cents: number }>;
  bezahltCents: number;
  bezahltAnzahl: number;
  /** Belege je bezahlter Rate (aus der Notiz). */
  ratenBelege: Map<number, string[]>;
}

/**
 * Deckung je Bestellung: Wie viel Geld ist ihr im Bankbuch schon zugeordnet (verbuchte
 * Eingänge mit matched_ref = Bestellung, dazu jeder Eingang, den eine bezahlte Rate als
 * Beleg nennt) — und wie viel ist als bezahlt gebucht? `ausser`: dieser Eingang zählt nicht.
 */
async function deckungLesen(bestellung: string, ausser: string): Promise<Deckung> {
  const raten = (await sqlPool`
    SELECT id, rate_nr, betrag_cents, status, notiz FROM fiaon_abo_raten
     WHERE ref = ${bestellung} AND storniert_am IS NULL ORDER BY rate_nr`) as any[];
  const [app] = (await sqlPool`SELECT payment_status, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll FROM fiaon_applications WHERE ref = ${bestellung}`) as any[];
  const bezahlt = raten.filter((r) => r.status === "bezahlt");
  const ratenBelege = new Map<number, string[]>();
  for (const r of bezahlt) ratenBelege.set(Number(r.id), belegeAusNotiz(r.notiz));
  const genannt = Array.from(new Set(Array.from(ratenBelege.values()).flat())).filter((t) => t !== ausser);
  const eingaenge = (await sqlPool`
    SELECT id, txn_id, amount_cents FROM fiaon_bank_txns
     WHERE txn_id <> ${ausser} AND amount_cents > 0 AND COALESCE(match_status, '') <> 'ignored'
       AND ((applied AND matched_ref = ${bestellung}) OR txn_id = ANY(${genannt}))`) as any[];
  const ohneRaten = raten.length === 0;
  return {
    eingaenge: eingaenge.map((e) => ({ id: Number(e.id), txnId: String(e.txn_id), cents: Number(e.amount_cents) })),
    eingaengeCents: eingaenge.reduce((s, e) => s + Number(e.amount_cents), 0),
    bezahltCents: ohneRaten ? (String(app?.payment_status) === "paid" ? Number(app?.soll || 0) : 0) : bezahlt.reduce((s, r) => s + Number(r.betrag_cents || 0), 0),
    bezahltAnzahl: ohneRaten ? (String(app?.payment_status) === "paid" ? 1 : 0) : bezahlt.length,
    ratenBelege,
  };
}

/**
 * Prüfung „Nur zuordnen" — schreibt nichts. Liefert die Zeile mit Ziel, Kunde, Deckung
 * und Hinweisen, `zuordenbar` = true, wenn der Klick erlaubt ist.
 */
export async function zuordnenPruefen(id: number, zielRoh: unknown): Promise<NachholAntwort & { z?: ZielAufgeloest }> {
  const kopf = await kopfLesen(id);
  if (!kopf.ok || !kopf.zeile) return { status: kopf.status, ok: false, error: kopf.error, zeile: kopf.zeile };
  const zeile = kopf.zeile;
  const ziel = zielLesen(zielRoh);
  if (!ziel) return { status: 400, ok: false, error: "Das Ziel ist keine FIAON-Referenz (FIAON-XXXXXX oder FIAON-XXXXXX-N).", zeile };
  zeile.zielVomMenschen = ziel;
  const a = await zielAufloesen(ziel);
  if (!a.ok) return { status: a.status, ok: false, error: a.error, zeile: { ...zeile, ergebnis: a.error, unklar: a.error } };
  const z = a.z;
  Object.assign(zeile, { ziel: z.ziel, bestellung: z.bestellung, rateId: z.rateId, rateNr: z.rateNr, kunde: z.kunde, personId: z.personId });
  const nein = (grund: string, status = 409): NachholAntwort & { z?: ZielAufgeloest } =>
    ({ status, ok: false, error: grund, zeile: { ...zeile, ergebnis: grund, unklar: grund }, z });
  const was = z.art === "rate" ? `Rate ${z.rateNr} (${z.ziel})` : `Die Bestellung ${z.ziel}`;
  if (!z.bezahlt) return nein(`${was} ist nicht als bezahlt gebucht — dann ist das Geld eine Buchung, kein „Nur zuordnen“. Bitte „So buchen“.`);

  // Steht der Eingang schon in einer ANDEREN bezahlten Rate?
  const [anders] = (await sqlPool`
    SELECT zahlungsreferenz FROM fiaon_abo_raten
     WHERE status = 'bezahlt' AND id <> ${z.rateId ?? 0} AND POSITION(${`Bankeingang ${zeile.txnId}`} IN COALESCE(notiz, '')) > 0 LIMIT 1`) as any[];
  if (anders) return nein(`Dieser Eingang steht schon in der bezahlten Rate ${anders.zahlungsreferenz}.`);

  // Deckung je Kunde (Lehre vom 23.08.)
  const d = await deckungLesen(z.bestellung, zeile.txnId);
  const grenze = d.bezahltCents + 100 * Math.max(1, d.bezahltAnzahl);
  const mit = d.eingaengeCents + zeile.betragCents;
  zeile.deckung = `Deckung: ${d.eingaenge.length} andere(r) Eingang/Eingänge ${eur(d.eingaengeCents)} + dieser ${eur(zeile.betragCents)} = ${eur(mit)} gegen ${d.bezahltAnzahl} bezahlte Rate(n) ${eur(d.bezahltCents)}.`;
  if (mit > grenze) {
    return nein(`Das Geld ist schon gedeckt: ${eur(d.eingaengeCents)} aus ${d.eingaenge.length} Eingang/Eingängen gegen ${eur(d.bezahltCents)} bezahlt — mit diesem Eingang wären es ${eur(mit)}. Das ist eine Doppel- oder Überzahlung, keine Zuordnung (Erstattung oder Verrechnung — „Aufgabe anlegen“).`);
  }
  if (z.rateId) {
    const belege = (d.ratenBelege.get(z.rateId) || []).filter((t) => t !== zeile.txnId);
    const belegCents = d.eingaenge.filter((e) => belege.includes(e.txnId)).reduce((s, e) => s + e.cents, 0);
    if (belegCents + zeile.betragCents > z.betragCents + 100) {
      return nein(`Rate ${z.rateNr} ist schon mit ${belege.join(", ")} (${eur(belegCents)}) belegt — dieser Eingang wäre doppelt. Passt er zu einer anderen bezahlten Rate?`);
    }
  }
  const abstand = z.bezahltAm ? tageZwischen(zeile.datum, z.bezahltAm) : 0;
  if (Math.abs(abstand) > 35) zeile.hinweise.push(`Als bezahlt gebucht am ${tagText(z.bezahltAm!)} — ${Math.abs(abstand)} Tage ${abstand > 0 ? "nach" : "vor"} dem Eingang. Passt das?`);
  if (zeile.betragCents < z.betragCents - 100) zeile.hinweise.push(`Teilbetrag: ${eur(zeile.betragCents)} von ${eur(z.betragCents)} — der Rest muss aus anderen Eingängen kommen.`);
  if (zeile.betragCents > z.betragCents + 100) zeile.hinweise.push(`Mehr als die Rate: ${eur(zeile.betragCents)} auf ${eur(z.betragCents)}.`);
  if (["cancelled", "refunded"].includes(z.bestellStatus)) zeile.hinweise.push(`Die Bestellung steht auf „${z.bestellStatus}“ — Erstattung prüfen.`);
  if (z.notiz.includes(`Bankeingang ${zeile.txnId}`)) zeile.hinweise.push("Die Rate nennt diesen Eingang schon — es fehlt nur der Haken im Bankbuch.");
  zeile.zuordenbar = true;
  zeile.ergebnis = `würde zuordnen: ${was} (bezahlt${z.bezahltAm ? ` am ${tagText(z.bezahltAm)}` : ""}) — keine zweite Buchung`;
  zeile.unklar = null;
  return { status: 200, ok: true, zeile, z };
}

/**
 * „NUR ZUORDNEN" — in EINER Transaktion: Bankbuch-Zeile verbucht + zugeordnet, Beleg in der
 * Rate, Satz in der Akte. Keine Buchung, keine Mail, keine Provision.
 */
export async function bankeingangZuordnen(
  id: number,
  opts: { ziel: unknown; wer: string; erwartet?: { ziel?: string | null; rateId?: number | null } | null },
): Promise<NachholAntwort & { zugeordnet?: boolean }> {
  const p = await zuordnenPruefen(id, opts.ziel);
  if (!p.ok || !p.zeile || !p.z) return p;
  const zeile = p.zeile;
  const z = p.z;
  const e = opts.erwartet;
  if (e && ((e.ziel ?? null) !== (zeile.ziel ?? null) || (e.rateId ?? null) !== (zeile.rateId ?? null))) {
    return { status: 409, ok: false, error: `Der Stand hat sich seit der Prüfung geändert (jetzt: ${zeile.ziel ?? "—"}) — bitte neu prüfen.`, zeile };
  }
  if (inArbeit.has(zeile.txnId)) return { status: 409, ok: false, error: "Dieser Eingang wird gerade schon bearbeitet.", zeile };
  inArbeit.add(zeile.txnId);
  const anlass = `Nur zugeordnet (${String(opts.wer || "Bankbuch").slice(0, 80)})`;
  const was = z.art === "rate" ? `Rate ${z.rateNr} (${z.ziel})` : `Bestellung ${z.ziel}`;
  try {
    await sqlPool.begin(async (tx: any) => {
      const zeilen = await tx`
        UPDATE fiaon_bank_txns
           SET applied = TRUE, applied_at = NOW(), matched_ref = ${z.bestellung}, match_status = 'matched',
               note = CONCAT_WS(' · ', NULLIF(note, ''), ${`${anlass}: Geld gehört zu ${was}, die schon als bezahlt gebucht ist — keine zweite Buchung.`}::text),
               updated_at = NOW()
         WHERE id = ${id} AND NOT applied
         RETURNING id`;
      if (!zeilen.length) throw new Error("SCHON_VERBUCHT");
      if (z.rateId && !z.notiz.includes(`Bankeingang ${zeile.txnId}`)) {
        const r = await tx`
          UPDATE fiaon_abo_raten
             SET notiz = CONCAT_WS(' · ', NULLIF(notiz, ''), ${`Bankeingang ${zeile.txnId} — nur zugeordnet (${String(opts.wer || "Bankbuch").slice(0, 80)}), keine zweite Buchung`}::text),
                 updated_at = NOW()
           WHERE id = ${z.rateId} AND status = 'bezahlt'
           RETURNING id`;
        if (!r.length) throw new Error("NICHT_MEHR_BEZAHLT");
      }
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${z.bestellung}, NULL, 'System', 'system',
                ${`Bankeingang ${zeile.txnId} vom ${tagText(zeile.datum)} über ${eur(zeile.betragCents)} (${(zeile.absender || "ohne Namen").slice(0, 60)}) ${was} zugeordnet — sie war schon als bezahlt gebucht, keine zweite Buchung (${anlass}).`})
      `;
    });
  } catch (err: any) {
    const m = String(err?.message || err);
    if (m === "SCHON_VERBUCHT") return { status: 409, ok: false, error: "Dieser Eingang ist schon verbucht.", zeile };
    if (m === "NICHT_MEHR_BEZAHLT") return { status: 409, ok: false, error: `${was} ist nicht mehr als bezahlt gebucht — nichts geändert.`, zeile };
    // UNIQUE fiaon_raten_ein_eingang_eine_rate: die Datenbank selbst verweigert einen Eingang in zwei Raten.
    if (/duplicate key|unique/i.test(m)) return { status: 409, ok: false, error: "Die Datenbank verweigert es: Dieser Eingang steht schon in einer anderen Rate.", zeile };
    throw err;
  } finally {
    inArbeit.delete(zeile.txnId);
  }
  console.log(`[BANK-NACHHOLEN] ${zeile.txnId} → ${was}: nur zugeordnet (${anlass})`);
  return { status: 200, ok: true, zeile: { ...zeile, schonVerbucht: true }, zugeordnet: true };
}

/**
 * E-277: Teilzahlung, Überzahlung, Rückzahlung — keine Buchung, sondern eine Aufgabe.
 * Teilzahlung → an den Betreuer (er klärt den Rest mit dem Kunden). Überzahlung und
 * Rückzahlung → an die Zahlungsstelle (Erstattung oder Verrechnung, Geld bewegt nur sie).
 * Der Eingang bleibt unverbucht im Bankbuch stehen, mit Vermerk.
 */
export async function bankeingangAufgabe(id: number, opts: { wer: string }): Promise<NachholAntwort & { aufgabe?: string | null }> {
  const probe = await bankeingangTrockenprobe(id, { mitVorschlag: true });
  if (!probe.ok || !probe.zeile) return probe;
  const zeile = probe.zeile;
  const v = zeile.vorschlag;
  if (!v || v.aktion !== "aufgabe" || !v.bestellung) {
    return { status: 409, ok: false, error: "Für diesen Eingang ist keine Aufgabe vorgesehen (kein Vorschlag „Teilzahlung“, „Überzahlung“ oder „Rückzahlung“).", zeile };
  }
  const anlass = `Bankbuch (${String(opts.wer || "Bankbuch").slice(0, 80)})`;
  const artText = v.art === "teilzahlung" ? "Teilzahlung" : v.art === "rueckzahlung_noetig" ? "Rückzahlung nötig" : "Überzahlung";
  const titel = `${artText}: ${eur(zeile.betragCents)} von ${v.kunde ?? "Kunde"} (${v.ziel ?? v.bestellung})`.slice(0, 160);
  const text = `Bankeingang ${zeile.txnId} vom ${tagText(zeile.datum)} über ${eur(zeile.betragCents)}, Absender „${(zeile.absender || "—").slice(0, 80)}“, Zweck „${(zeile.zweck || "—").slice(0, 120)}“. `
    + `${v.text}. ${v.hinweise.join(" ")} `
    + (v.art === "teilzahlung"
      ? "Er wird NICHT gebucht: Eine Teilzahlung als bezahlt zu buchen hieße, die Rate stünde voll bezahlt da und der Rest würde nie gemahnt. Bitte mit dem Kunden klären: Rest überweisen (dann bucht das Bankbuch beide Eingänge zusammen als Sammelzahlung) oder Kulanz durch die Leitung."
      : "Er wird NICHT gebucht. Bitte entscheiden: erstatten (Überweisung im Banking) oder mit einer offenen Forderung verrechnen (Bankbuch → „Anderes Ziel“).");
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: v.personId, ref: v.bestellung, titel, text,
      schluessel: `bank-nachholen:${v.art}:${zeile.txnId}`,
      quelle: "bankbuch", bereich: "konten", autorName: anlass,
      link: `/akte/${v.bestellung}`,
      anBetreiber: v.art !== "teilzahlung",
    });
    await sqlPool`
      UPDATE fiaon_bank_txns
         SET note = CONCAT_WS(' · ', NULLIF(note, ''), ${`${anlass}: Aufgabe „${artText}“ angelegt${erg.agentName ? ` (an ${erg.agentName})` : ""} — nicht gebucht.`}::text), updated_at = NOW()
       WHERE id = ${id} AND NOT applied`;
    return { status: 200, ok: true, zeile, aufgabe: erg.agentName ? `Aufgabe an ${erg.agentName}` : (erg.id ? "Aufgabe bei der Zahlungsstelle" : null) };
  } catch (e: any) {
    console.error("[BANK-NACHHOLEN] Aufgabe:", String(e?.message || e).slice(0, 160));
    return { status: 500, ok: false, error: "Die Aufgabe ließ sich nicht anlegen.", zeile };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-277 — DER VORSCHLAG: wem gehört das Geld?
//
// Nur lesen. Quellen, in dieser Stärke:
//   · Die Ratennotiz nennt den Eingang schon („verbraucht")      — eindeutig
//   · Referenz im Zweck (Vergleichsform), auch einer Dublette, die in die
//     überlebende Bestellung zusammengeführt wurde                — stark
//   · Belegnotiz des Betreuers nennt den Absender („Hat von einem anderen
//     Konto überwiesen. (Paul Furter)")                            — stark
//   · Referenz mit EINEM Tippfehler („U2C85C" für U2C8SC)          — mittel
//   · frühere Zuordnung im Bankbuch (matched_ref, Auszug 31.08.)   — mittel
//   · Vor- UND Nachname des Absenders                              — mittel
//   · nur der Nachname                                             — schwach
// Dann je Bestellung, was der Betrag bedeutet: Erstzahlung, älteste offene
// Rate, schon bezahlte Rate ohne Bankbeleg (→ nur zuordnen), Teil einer
// Sammelzahlung, Teil-, Über-, Doppelzahlung, Rückzahlung. „sicher" heißt:
// starke Quelle, Betrag passt, keine Auffälligkeit, kein zweiter Kandidat.
// ═══════════════════════════════════════════════════════════════════════════

const STOPPWOERTER = new Set([
  "UND", "GMBH", "VON", "VAN", "DER", "DEN", "DIE", "DAS", "MIT", "FUR", "THE", "AND", "LTD", "BANK", "SENT", "FROM",
  "GESENDET", "EINZAHLUNG", "REFERENZ", "RECEIVED", "MONEY", "WITH", "REFERENCE", "FIAON", "HERR", "FRAU", "FAMILIE",
  "RATE", "MONATSRATE", "ZAHLUNG", "EUR", "EURO", "TRIMIS", "PRIN", "REVOLUT", "VIVID", "HERO", "NOT", "PROVIDED",
]);

/** Namensform: Großbuchstaben, ohne Akzente, ä/ae, ö/oe, ü/ue und ß/ss gleich. */
function namensform(s: unknown): string {
  return String(s ?? "").toUpperCase().replace(/ß/g, "SS").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/AE/g, "A").replace(/OE/g, "O").replace(/UE/g, "U");
}
function namenWoerter(s: unknown): string[] {
  return namensform(s).split(/[^A-Z]+/).filter((w) => w.length >= 3 && !STOPPWOERTER.has(w));
}
/** Der Zahler als Vergleichsform (Sammelzahlung: „gleicher Zahler"). */
function zahlerForm(s: unknown): string {
  return namenWoerter(s).sort().join(" ");
}
/** Referenz-Vergleichsform eines Textes: nur A–Z und 0–9, ohne Akzente. */
function codeForm(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
/** Die sechs Zeichen einer Zahlungsreferenz („FIAON-596FE4" → „596FE4", „FIAONMSYOCC" → „MSYOCC"). */
function codeVon(zahlungsreferenz: unknown): string | null {
  const v = codeForm(zahlungsreferenz);
  return v.startsWith("FIAON") && v.length >= 11 ? v.slice(5, 11) : null;
}
/** Alle FIAON-Codes, die ein Text nennt (für die Sammelzahlung „gleiche Referenz"). */
function codesImText(s: string): string[] {
  return Array.from(String(s).toUpperCase().matchAll(/FIAON[\s-]*([A-Z0-9]{6})/g)).map((m) => m[1]);
}
/** Tippfehler-Abstand mit Buchstabendreher (Damerau, eingeschränkt). */
function abstand(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const k = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + k);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const tag = (x: unknown): string | null => (x ? new Date(x as any).toISOString().slice(0, 10) : null);
/** Tage von a bis b (b − a), beide JJJJ-MM-TT. */
function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
const tagText = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

interface KApp {
  ref: string; pr: string; code: string | null; personId: number | null; zusammen: string | null;
  status: string; soll: number; kunde: string; vornamen: string[]; nachnamen: string[];
  belegNotiz: string; belegTag: string | null; gekuendigt: string | null; storniertAm: string | null;
}
interface KZeile { id: number; txnId: string; cents: number; datum: string; zahler: string; zweckCode: string; unterwegs: boolean }

/** Was ein Vorschlag über alle Eingänge hinweg wissen muss — einmal je Liste geladen. */
export interface NachholKontext {
  apps: KApp[];
  nachRef: Map<string, KApp>;
  nachCode: Map<string, KApp[]>;
  nachNachname: Map<string, KApp[]>;
  mitBelegNotiz: KApp[];
  zeilen: KZeile[];
  /** Eingänge, die die Trockenprobe allein schon bucht (Referenz im Zweck). */
  buchbar: Set<number>;
  /** schluessel → „Aufgabe offen seit …" */
  aufgaben: Map<string, string>;
}

export async function kontextLaden(): Promise<NachholKontext> {
  const roh = (await sqlPool`
    SELECT a.ref, a.payment_reference, a.person_id, COALESCE(a.merged_into, a.superseded_by) AS zusammen, a.payment_status,
           ROUND(COALESCE(a.amount_due, 0) * 100)::int AS soll, a.first_name, a.last_name, a.contact_name,
           a.payment_proof_note, a.payment_proof_date, a.gekuendigt_am, a.cancelled_at,
           p.first_name AS p_vorname, p.last_name AS p_nachname
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_reference IS NOT NULL AND a.gdpr_deleted_at IS NULL`) as any[];
  const apps: KApp[] = roh.map((a) => ({
    ref: String(a.ref), pr: String(a.payment_reference), code: codeVon(a.payment_reference),
    personId: a.person_id != null ? Number(a.person_id) : null, zusammen: a.zusammen ? String(a.zusammen) : null,
    status: String(a.payment_status || ""), soll: Number(a.soll || 0),
    kunde: String([a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || [a.p_vorname, a.p_nachname].filter(Boolean).join(" ") || "").trim(),
    vornamen: Array.from(new Set([...namenWoerter(a.first_name), ...namenWoerter(a.p_vorname)])),
    nachnamen: Array.from(new Set([...namenWoerter(a.last_name), ...namenWoerter(a.p_nachname)])),
    belegNotiz: String(a.payment_proof_note || ""), belegTag: a.payment_proof_date ? berlinDatum(new Date(a.payment_proof_date)) : null,
    gekuendigt: a.gekuendigt_am ? berlinDatum(new Date(a.gekuendigt_am)) : null, storniertAm: a.cancelled_at ? berlinDatum(new Date(a.cancelled_at)) : null,
  }));
  const nachRef = new Map(apps.map((a) => [a.ref, a] as const));
  const nachCode = new Map<string, KApp[]>();
  const nachNachname = new Map<string, KApp[]>();
  for (const a of apps) {
    if (a.code) nachCode.set(a.code, [...(nachCode.get(a.code) || []), a]);
    for (const w of a.nachnamen) nachNachname.set(w, [...(nachNachname.get(w) || []), a]);
  }
  const offen = (await sqlPool`
    SELECT id, txn_id, booked_at, amount_cents, payer_name, reference_raw, note FROM fiaon_bank_txns
     WHERE NOT applied AND amount_cents > 0 AND booked_at >= NOW() - INTERVAL '180 days'`) as any[];
  const aufgabenRoh = (await sqlPool`
    SELECT schluessel, status, created_at FROM fiaon_betreiber_todos WHERE schluessel LIKE 'bank-nachholen:%'`.catch(() => [])) as any[];
  return {
    apps, nachRef, nachCode, nachNachname,
    mitBelegNotiz: apps.filter((a) => a.belegNotiz.trim().length > 0),
    zeilen: offen.map((r) => ({
      id: Number(r.id), txnId: String(r.txn_id), cents: Number(r.amount_cents),
      datum: r.booked_at ? berlinDatum(new Date(r.booked_at)) : "", zahler: zahlerForm(r.payer_name),
      zweckCode: codeForm(r.reference_raw), unterwegs: String(r.note || "").startsWith("Airwallex: Geld ist UNTERWEGS"),
    })),
    buchbar: new Set<number>(),
    aufgaben: new Map(aufgabenRoh.map((t) => [String(t.schluessel), `${t.status === "erledigt" ? "erledigt" : "offen"} seit ${t.created_at ? tagText(berlinDatum(new Date(t.created_at))) : "?"}`] as const)),
  };
}

interface Treffer {
  app: KApp;
  ident: number;
  stark: boolean;
  identGruende: string[];
  art: HandfallArt;
  aktion: NachholVorschlag["aktion"];
  ziel: string | null;
  rateNr: number | null;
  rateId: number | null;
  dazu: number[];
  /** 3 genau, 2 in der Toleranz, 1 Teil/Rest, 0 nichts passt */
  fit: number;
  gruende: string[];
  hinweise: string[];
  flags: Set<string>;
  punkte: number;
  text: string;
  /** Abweichende Erwartung (Regel B über die Bestellreferenz). */
  erwartet?: NachholVorschlag["erwartet"];
}

/**
 * DER VORSCHLAG zu einem Eingang. Schreibt nichts. `k` aus kontextLaden() (in der Liste
 * einmal geladen, in der Schublade je Aufruf).
 */
export async function vorschlagErmitteln(zeile: NachholZeile, k: NachholKontext): Promise<NachholVorschlag | null> {
  if (zeile.schonVerbucht) return null;
  // ── 1. Buchbar wie bisher: die Referenz im Zweck trägt die Buchung ─────────
  if (zeile.buchen) {
    return {
      art: zeile.regel === "erstzahlung" ? "erstzahlung" : "rate", aktion: "buchen", ziel: zeile.ziel, mitZiel: false,
      bestellung: zeile.bestellung, rateNr: zeile.rateNr, rateId: zeile.rateId, kunde: zeile.kunde, personId: zeile.personId, dazu: [],
      sicherheit: "sicher",
      gruende: ["Referenz im Zweck", "Betrag passt", zeile.regel === "regel_b" ? "älteste offene Rate (Regel B)" : zeile.regel === "rate" ? "Ratennummer im Zweck" : "offene Bestellung"],
      text: zeile.regel === "erstzahlung" ? `Erstzahlung ${zeile.ziel} von ${zeile.kunde ?? "—"}` : `Rate ${zeile.ziel} (Rate ${zeile.rateNr}) von ${zeile.kunde ?? "—"}`,
      hinweise: [...zeile.hinweise],
      erwartet: { regel: zeile.regel, ziel: zeile.ziel, rateId: zeile.rateId },
    };
  }

  // ── 2. Kandidaten sammeln ────────────────────────────────────────────────
  const C = zeile.betragCents;
  const D = zeile.datum;
  const zweckCode = codeForm(zeile.zweck);
  const zahlerWoerter = namenWoerter(zeile.absender);
  const eigenerZahler = zahlerForm(zeile.absender);
  const kand = new Map<string, { app: KApp; ident: number; stark: boolean; gruende: string[] }>();
  const ueberleben = (a: KApp): { app: KApp; ueber: string | null } => {
    let x = a;
    let ueber: string | null = null;
    for (let i = 0; i < 3 && x.zusammen; i++) {
      const n = k.nachRef.get(x.zusammen);
      if (!n) break;
      ueber = ueber ?? x.pr;
      x = n;
    }
    return { app: x, ueber };
  };
  const dazuNehmen = (a0: KApp, punkte: number, stark: boolean, grund: string) => {
    const { app, ueber } = ueberleben(a0);
    const e = kand.get(app.ref) || { app, ident: 0, stark: false, gruende: [] };
    const g = ueber ? `${grund} (Dublette ${ueber} → ${app.pr})` : grund;
    // Derselbe Beleg über mehrere Dubletten zählt einmal („Name" × 4 wäre kein vierfacher Beweis).
    const art = grund.split(" ")[0];
    if (e.gruende.some((x) => x.split(" ")[0] === art)) { kand.set(app.ref, e); return; }
    e.ident += ueber ? Math.max(1, punkte - 1) : punkte;
    e.stark = e.stark || stark;
    e.gruende.push(g);
    kand.set(app.ref, e);
  };
  // Referenz exakt (Vergleichsform, irgendwo im Zweck)
  for (let i = 0; i + 6 <= zweckCode.length; i++) {
    for (const a of k.nachCode.get(zweckCode.slice(i, i + 6)) || []) {
      if (!kand.get(a.ref)?.gruende.some((g) => g.startsWith("Referenz"))) dazuNehmen(a, 4, true, `Referenz ${a.pr} im Zweck`);
    }
  }
  // Referenz mit einem Tippfehler: Stücke mit Ziffer und Buchstabe, oder was direkt hinter „FIAON" steht
  const zweckGross = String(zeile.zweck || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const stuecke = [
    ...zweckGross.split(/[^A-Z0-9]+/).map((t) => t.replace(/^FIAON/, "")).filter((t) => /\d/.test(t) && /[A-Z]/.test(t)),
    ...Array.from(zweckGross.matchAll(/FIAON[\s-]*([A-Z0-9]{5,7})(?![A-Z0-9])/g)).map((m) => m[1]),
  ].filter((t) => t.length >= 5 && t.length <= 7 && !k.nachCode.has(t));
  for (const t of Array.from(new Set(stuecke))) {
    for (const [code, liste] of Array.from(k.nachCode.entries())) {
      if (Math.abs(code.length - t.length) <= 1 && abstand(t, code) === 1) for (const a of liste) dazuNehmen(a, 2, true, `Referenz mit Tippfehler (${t} ≈ ${code})`);
    }
  }
  // frühere Zuordnung im Bankbuch
  if (zeile.zugeordnet && k.nachRef.has(zeile.zugeordnet)) dazuNehmen(k.nachRef.get(zeile.zugeordnet)!, 2, true, "früher im Bankbuch zugeordnet");
  // Belegnotiz des Betreuers nennt den Absender
  const lange = zahlerWoerter.filter((w) => w.length >= 4);
  if (lange.length) {
    for (const a of k.mitBelegNotiz) {
      const nw = namenWoerter(a.belegNotiz);
      if (lange.some((w) => nw.includes(w))) dazuNehmen(a, 3, true, "Zahlungsbeleg nennt den Absender");
    }
  }
  // Name
  for (const w of zahlerWoerter) {
    const liste = k.nachNachname.get(w) || [];
    for (const a of liste) {
      const voll = a.vornamen.some((v) => zahlerWoerter.includes(v));
      if (!voll && (liste.length > 40 || !["pending_payment", "claimed_paid", "expired", "paid"].includes(a.status))) continue;
      dazuNehmen(a, voll ? 2 : 1, false, voll ? "Name (Vor- und Nachname)" : "Nachname");
      if (voll && a.belegTag && Math.abs(tageZwischen(D, a.belegTag)) <= 2) dazuNehmen(a, 1, false, `Zahlungsbeleg vom ${tagText(a.belegTag)}`);
    }
  }
  if (!kand.size) {
    return leer(zeile, k, zeile.absender ? "Weder Referenz noch Name passen zu einem Kunden." : "Kein Absender, keine Referenz — kein Kundengeld erkennbar.");
  }

  // ── 3. Raten und Belege der Kandidaten ───────────────────────────────────
  const refs = Array.from(kand.keys()).slice(0, 25);
  const raten = (await sqlPool`
    SELECT id, ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, notiz, storniert_am, storno_grund
      FROM fiaon_abo_raten WHERE ref = ANY(${refs}) ORDER BY ref, rate_nr`) as any[];
  const genannt = Array.from(new Set(raten.filter((r) => r.status === "bezahlt").flatMap((r) => belegeAusNotiz(r.notiz))));
  const belege = (await sqlPool`
    SELECT id, txn_id, booked_at, amount_cents, matched_ref, applied FROM fiaon_bank_txns
     WHERE id <> ${zeile.id} AND amount_cents > 0 AND COALESCE(match_status, '') <> 'ignored'
       AND ((applied AND matched_ref = ANY(${refs})) OR txn_id = ANY(${genannt}))`) as any[];
  const genannteNr = genannteRate(zeile.zweck);

  const treffer: Treffer[] = [];
  for (const ref of refs) {
    const c = kand.get(ref)!;
    const t = await bewerten(c, raten.filter((r) => r.ref === ref), belege);
    if (t) treffer.push(t);
  }
  if (!treffer.length) return leer(zeile, k, "Kandidaten gefunden, aber keine Forderung passt.");

  // Treffer bewerten
  function bewerten(c: { app: KApp; ident: number; stark: boolean; gruende: string[] }, rs: any[], bl: any[]): Treffer | null {
    const app = c.app;
    const t: Treffer = {
      app, ident: Math.min(6, c.ident), stark: c.stark, identGruende: c.gruende, art: "unbekannt", aktion: null, ziel: null,
      rateNr: null, rateId: null, dazu: [], fit: 0, gruende: [], hinweise: [], flags: new Set(), punkte: 0, text: "", erwartet: null,
    };
    const aktiv = rs.filter((r) => !r.storniert_am && r.status !== "storniert");
    const bez = aktiv.filter((r) => r.status === "bezahlt");
    const off = aktiv.filter((r) => r.status === "offen");
    const storn = rs.filter((r) => r.storniert_am || r.status === "storniert");
    const name = app.kunde || "—";
    const setze = (x: Partial<Treffer>) => Object.assign(t, x);

    // a) Eine bezahlte Rate nennt diesen Eingang schon — es fehlt nur der Haken im Bankbuch.
    const verbr = bez.find((r) => belegeAusNotiz(r.notiz).includes(zeile.txnId));
    if (verbr) {
      setze({ art: "nur_zuordnen", aktion: "zuordnen", ziel: String(verbr.zahlungsreferenz), rateNr: Number(verbr.rate_nr), rateId: Number(verbr.id), fit: 3,
        gruende: [`Rate ${verbr.rate_nr} nennt diesen Eingang schon`], text: `Nur zuordnen: Rate ${verbr.zahlungsreferenz} von ${name} (schon bezahlt)` });
      t.ident = 6; t.stark = true;
      return t;
    }
    const eigeneBelege = bl.filter((b) => (b.applied && b.matched_ref === app.ref) || bez.some((r) => belegeAusNotiz(r.notiz).includes(String(b.txn_id))));
    const E = eigeneBelege.reduce((s, b) => s + Number(b.amount_cents), 0);
    const bezahltCents = aktiv.length ? bez.reduce((s, r) => s + Number(r.betrag_cents), 0) : (app.status === "paid" ? app.soll : 0);
    const fehlt = bezahltCents - E;
    const unbezahlt = ["pending_payment", "claimed_paid", "expired"].includes(app.status) && !bez.length;
    const partner = (ziel: number, mitUnterwegs = false) => sammelPartner(ziel, mitUnterwegs, app);

    // b) Erstzahlung einer offenen (auch abgelaufenen) Bestellung
    if (unbezahlt && app.soll > 0) {
      const diff = C - app.soll;
      const basis = { ziel: app.pr, gruende: [] as string[] };
      if (app.status === "expired") t.hinweise.push("Bestellung war abgelaufen (nur das Zahlungsfenster) — wird mit dem Geld bezahlt.");
      if (diff >= 0 && diff <= 100) {
        return setze({ ...basis, art: "erstzahlung", aktion: "buchen", fit: diff === 0 ? 3 : 2,
          gruende: [diff === 0 ? `Betrag = Bestellung (${eur(app.soll)})` : `Betrag ${eur(C)} auf ${eur(app.soll)} (+${eur(diff)})`],
          text: `Erstzahlung ${app.pr} von ${name}` }), t;
      }
      if (diff < 0) {
        const p = partner(app.soll);
        if (p) return sammelTreffer(t, p, app.pr, null, null, `Erstzahlung ${app.pr} von ${name}`, "erstzahlung");
        if (!c.stark) return null;
        return setze({ ...basis, art: "teilzahlung", aktion: "aufgabe", fit: 1,
          gruende: [`Teilzahlung ${eur(C)} von ${eur(app.soll)}`],
          text: `Teilzahlung zu ${app.pr} von ${name}: ${eur(C)} von ${eur(app.soll)} — es fehlen ${eur(-diff)}` }), t;
      }
      if (!c.stark) return null;
      return setze({ ...basis, art: "ueberzahlung", aktion: "aufgabe", fit: 1, gruende: [`${eur(C)} auf ${eur(app.soll)}`],
        text: `Überzahlung bei ${name} (${app.pr}): ${eur(C)} auf ${eur(app.soll)}` }), t;
    }

    // c) Bezahlt gebucht, aber ohne (vollständiges) Geld im Bankbuch → dieser Eingang ist das Geld: nur zuordnen
    if (bezahltCents > 0 && fehlt > 0 && fehlt >= C - 100) {
      // Zuerst: eine Rate, die schon einen Beleg trägt, dem genau dieser Betrag fehlt (79,90 € + 0,09 €).
      const belegCents = (r: any) => belegeAusNotiz(r.notiz).reduce((s, tx) => s + Number(bl.find((b) => String(b.txn_id) === tx)?.amount_cents || 0), 0);
      const angebrochen = bez.find((r) => belegeAusNotiz(r.notiz).length > 0 && Number(r.betrag_cents) - belegCents(r) > 0
        && Math.abs(Number(r.betrag_cents) - belegCents(r) - C) <= 100);
      if (angebrochen) {
        return setze({ art: "nur_zuordnen", aktion: "zuordnen", ziel: String(angebrochen.zahlungsreferenz), rateNr: Number(angebrochen.rate_nr), rateId: Number(angebrochen.id), fit: 2,
          gruende: [`Rate ${angebrochen.rate_nr} ist mit ${eur(belegCents(angebrochen))} von ${eur(Number(angebrochen.betrag_cents))} belegt`, `Rest ${eur(C)}`],
          text: `Nur zuordnen: Rest zu Rate ${angebrochen.zahlungsreferenz} von ${name} (schon bezahlt)` }), t;
      }
      const ohneBeleg = aktiv.length
        ? bez.filter((r) => belegeAusNotiz(r.notiz).length === 0)
        : [{ id: null, rate_nr: null, zahlungsreferenz: app.pr, betrag_cents: app.soll, bezahlt_am: null }];
      const kandR = ohneBeleg.map((r: any) => {
        const am = r.bezahlt_am ? berlinDatum(new Date(r.bezahlt_am)) : null;
        const dt = am ? tageZwischen(D, am) : 0;
        const dieserPasst = Math.abs(Number(r.betrag_cents) - C) <= 100;
        // Ein anderer unverbuchter Eingang desselben Kunden passt zum Betrag und liegt zeitlich näher
        // an dieser Rate (bei Gleichstand: wenn dieser nicht passt)? Dann gehört sie ihm (Pettauer 28.08./02.10.).
        const konkurrent = am ? k.zeilen.find((o) => {
          if (o.id === zeile.id || o.unterwegs || !gehoertZu(o, app) || Math.abs(o.cents - Number(r.betrag_cents)) > 100) return false;
          const od = Math.abs(tageZwischen(o.datum, am));
          return od < Math.abs(dt) || (od === Math.abs(dt) && !dieserPasst);
        }) : undefined;
        return { r, am, dt, konkurrent };
      }).filter((x: any) => !x.konkurrent && x.dt >= -35 && x.dt <= 45)
        .sort((x: any, y: any) => (Math.abs(Number(x.r.betrag_cents) - C) <= 100 ? 0 : 1) - (Math.abs(Number(y.r.betrag_cents) - C) <= 100 ? 0 : 1)
          || Math.abs(x.dt) - Math.abs(y.dt));
      const w: any = kandR[0];
      if (w) {
        const betrag = Number(w.r.betrag_cents);
        const genau = Math.abs(betrag - C) <= 100;
        const rest = !genau && C < betrag && Math.abs(fehlt - C) <= 100;
        const teile = !genau && !rest && C < betrag ? partner(Math.min(fehlt, betrag), true) : null;
        if (genau || rest || teile) {
          const rNr = w.r.rate_nr != null ? Number(w.r.rate_nr) : null;
          setze({
            art: "nur_zuordnen", aktion: "zuordnen", ziel: String(w.r.zahlungsreferenz), rateNr: rNr, rateId: w.r.id != null ? Number(w.r.id) : null,
            fit: genau ? (C === betrag ? 3 : 2) : 1,
            gruende: [
              w.am ? `${rNr ? `Rate ${rNr}` : "Bestellung"} am ${tagText(w.am)} ohne Bankbeleg als bezahlt gebucht` : "Bestellung ohne Bankbeleg bezahlt",
              genau ? `Betrag ${eur(C)}${C !== betrag ? ` auf ${eur(betrag)}` : ""}` : rest ? `Rest ${eur(C)} (mit früheren Eingängen)` : `Teilbetrag (zusammen mit ${teile!.map((p) => `#${p.id}`).join(", ")})`,
            ],
            text: `Nur zuordnen: ${rNr ? `Rate ${w.r.zahlungsreferenz}` : `Bestellung ${app.pr}`} von ${name} (schon bezahlt)`,
          });
          if (Math.abs(w.dt) > 3) t.flags.add("weit");
          if (!genau) t.flags.add("teil");
          if (["cancelled", "refunded"].includes(app.status)) t.hinweise.push(`Bestellung steht auf „${app.status}“${app.storniertAm ? ` (seit ${tagText(app.storniertAm)})` : ""} — Erstattung prüfen.`);
          return t;
        }
      }
    }

    // d) Stornierte Bestellung ohne bezahlte Rate → Rückzahlung
    if (["cancelled", "refunded"].includes(app.status) && !bez.length) {
      if (!c.stark && Math.abs(C - app.soll) > 100) return null;
      return setze({ art: "rueckzahlung_noetig", aktion: "aufgabe", ziel: app.pr, fit: Math.abs(C - app.soll) <= 100 ? 2 : 1,
        gruende: [`Bestellung storniert${app.storniertAm ? ` am ${tagText(app.storniertAm)}` : ""}`, `Geld kam am ${tagText(D)}`],
        text: `Rückzahlung nötig: ${name}, Bestellung ${app.pr} ist storniert — keine Forderung für ${eur(C)}` }), t;
    }
    if (!(bezahltCents > 0 || app.status === "paid")) return null;

    // e) Doppelzahlung? Ein Beleg derselben Bestellung über denselben Betrag binnen 3 Tagen.
    const doppel = eigeneBelege.find((b) => Math.abs(Number(b.amount_cents) - C) <= 100 && b.booked_at && Math.abs(tageZwischen(D, berlinDatum(new Date(b.booked_at)))) <= 3);
    const kand0 = off[0];
    if (doppel) {
      return setze({ art: "ueberzahlung", aktion: "aufgabe", ziel: kand0 ? String(kand0.zahlungsreferenz) : app.pr, rateNr: kand0 ? Number(kand0.rate_nr) : null, fit: 2,
        gruende: [`schon Eingang über ${eur(Number(doppel.amount_cents))} am ${tagText(berlinDatum(new Date(doppel.booked_at)))}`],
        hinweise: [`Doppelzahlung? ${kand0 ? `Als Vorauszahlung auf Rate ${kand0.rate_nr} (${kand0.zahlungsreferenz}, fällig ${tagText(tag(kand0.faellig_am)!)}) buchbar über „Anderes Ziel“ — oder erstatten.` : "Keine offene Rate — erstatten."}`],
        text: `Überzahlung bei ${name} (${app.pr}): zweite Zahlung über ${eur(C)}` }), t;
    }

    // f) Älteste offene Rate
    if (!kand0) {
      if (!c.stark && !c.gruende.some((g) => g.startsWith("Name"))) return null;
      const st = storn.map((r) => `Rate ${r.rate_nr} storniert${r.storno_grund ? ` (${String(r.storno_grund).split(" ")[0]})` : ""}`);
      return setze({ art: "ueberzahlung", aktion: "aufgabe", ziel: storn[0] ? String(storn[0].zahlungsreferenz) : app.pr, fit: 1,
        gruende: ["keine offene Rate", ...st].slice(0, 3),
        hinweise: storn.length ? ["Die Rate wurde storniert (Kulanz/Kündigung). Storno zurücknehmen und buchen — oder erstatten. Mensch entscheidet."] : [],
        text: `Überzahlung bei ${name} (${app.pr}): keine offene Forderung für ${eur(C)}` }), t;
    }
    const betrag = Number(kand0.betrag_cents);
    const faellig = tag(kand0.faellig_am)!;
    const diff = C - betrag;
    const rateText = `Rate ${kand0.zahlungsreferenz} von ${name}`;
    if (fehlt > 100) t.hinweise.push(`Achtung: ${eur(fehlt)} bezahlter Raten ohne Bankbeleg — deren Geld ist wohl ein anderer Eingang (dort „Nur zuordnen“).`);
    if (app.gekuendigt) t.hinweise.push(`Vertrag gekündigt am ${tagText(app.gekuendigt)} — offene Raten bleiben geschuldet (Justin 01.10.).`);
    if (faellig > plusTage(D, 7)) { t.flags.add("vorauszahlung"); t.hinweise.push(`Vorauszahlung: Rate ${kand0.rate_nr} ist erst am ${tagText(faellig)} fällig.`); }
    if (bez.some((r) => Number(r.rate_nr) > Number(kand0.rate_nr))) { t.flags.add("luecke"); t.hinweise.push(`Lücke: eine spätere Rate ist schon bezahlt.`); }
    if (diff >= 0 && diff <= 100) {
      setze({ art: "rate", aktion: "buchen", ziel: String(kand0.zahlungsreferenz), rateNr: Number(kand0.rate_nr), rateId: Number(kand0.id),
        fit: diff === 0 ? 3 : 2, gruende: [diff === 0 ? `Betrag = Rate (${eur(betrag)})` : `Betrag ${eur(C)} auf ${eur(betrag)}`, `fällig ${tagText(faellig)}`],
        text: rateText });
      if (genannteNr != null && genannteNr === Number(kand0.rate_nr)) t.gruende.push(`Zweck nennt Rate ${genannteNr}`);
      return t;
    }
    if (diff < 0) {
      const p = partner(betrag);
      if (p) return sammelTreffer(t, p, String(kand0.zahlungsreferenz), Number(kand0.rate_nr), Number(kand0.id), rateText, "rate");
      // Bis 1 € zu wenig auf eine Rate: Das ist die Toleranz von Regel B (Justins Go 01.10.) —
      // gebucht über die BESTELLreferenz, damit Regel B mit allen Prüfungen (Kündigung, Deckung,
      // Fälligkeit, Lücke) entscheidet. Kein neuer Ermessensspielraum.
      if (diff >= -100 && !app.gekuendigt) {
        setze({ art: "rate", aktion: "buchen", ziel: app.pr, rateNr: Number(kand0.rate_nr), rateId: Number(kand0.id), fit: 2,
          gruende: [`Betrag ${eur(C)} auf ${eur(betrag)} — Regel B nimmt ±1 €`, `fällig ${tagText(faellig)}`],
          text: `${rateText} (über Regel B, Bestellreferenz ${app.pr})` });
        t.erwartet = { regel: "regel_b", ziel: String(kand0.zahlungsreferenz), rateId: Number(kand0.id) };
        return t;
      }
      if (!c.stark) return null;
      return setze({ art: "teilzahlung", aktion: "aufgabe", ziel: String(kand0.zahlungsreferenz), rateNr: Number(kand0.rate_nr), rateId: Number(kand0.id), fit: 1,
        gruende: [`Teilzahlung ${eur(C)} von ${eur(betrag)}`, `fällig ${tagText(faellig)}`],
        text: `Teilzahlung zu Rate ${kand0.zahlungsreferenz} von ${name}: ${eur(C)} von ${eur(betrag)} — es fehlen ${eur(-diff)}` }), t;
    }
    if (!c.stark) return null;
    return setze({ art: "ueberzahlung", aktion: "aufgabe", ziel: String(kand0.zahlungsreferenz), rateNr: Number(kand0.rate_nr), fit: 1,
      gruende: [`${eur(C)} auf eine Rate über ${eur(betrag)}`], text: `Überzahlung bei ${name}: ${eur(C)} auf Rate ${kand0.zahlungsreferenz} (${eur(betrag)})` }), t;
  }

  /** Gehört ein anderer unverbuchter Eingang zu dieser Bestellung (Referenz) oder diesem Zahler? */
  function gehoertZu(o: KZeile, app: KApp): boolean {
    return (!!app.code && o.zweckCode.includes(app.code)) || (eigenerZahler.length >= 5 && o.zahler === eigenerZahler);
  }
  /** Ein oder zwei weitere Eingänge, die mit diesem zusammen `soll` ergeben (bis 1 € darüber). */
  function sammelPartner(soll: number, mitUnterwegs: boolean, app: KApp): KZeile[] | null {
    const p = k.zeilen.filter((o) => o.id !== zeile.id && (mitUnterwegs || !o.unterwegs) && gehoertZu(o, app) && o.datum && Math.abs(tageZwischen(D, o.datum)) <= 45);
    const passt = (s: number) => s >= soll && s - soll <= 100;
    for (const a of p) if (passt(C + a.cents)) return [a];
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (passt(C + p[i].cents + p[j].cents)) return [p[i], p[j]];
    return null;
  }
  /** Sammelzahlung: Der größte Eingang (bei Gleichstand der älteste) trägt die Buchung, die anderen hängen an. */
  function sammelTreffer(t: Treffer, p: KZeile[], ziel: string, rateNr: number | null, rateId: number | null, text: string, art: HandfallArt): Treffer {
    const alle = [{ id: zeile.id, cents: C }, ...p.map((x) => ({ id: x.id, cents: x.cents }))];
    const haupt = alle.slice().sort((a, b) => b.cents - a.cents || a.id - b.id)[0];
    const allein = p.find((x) => k.buchbar.has(x.id));
    const summe = alle.reduce((s, x) => s + x.cents, 0);
    Object.assign(t, { art, ziel, rateNr, rateId, fit: 2, gruende: [`Sammelzahlung ${alle.map((x) => eur(x.cents)).join(" + ")} = ${eur(summe)}`] });
    if (p.some((x) => x.unterwegs)) {
      t.aktion = null; t.text = `${text} — Teil einer Sammelzahlung, ein Teil ist noch unterwegs`; t.flags.add("teil");
    } else if (allein) {
      // Der andere Eingang bucht die Rate schon allein (Regel B ±1 €) — dieser ist der Rest.
      t.art = "nur_zuordnen"; t.aktion = null; t.flags.add("teil");
      t.text = `Rest zu Eingang #${allein.id}: erst #${allein.id} buchen, dann hier „Nur zuordnen“ auf ${ziel}`;
    } else if (haupt.id === zeile.id) {
      t.aktion = "buchen"; t.dazu = p.map((x) => x.id); t.text = `${text} — Sammelzahlung mit ${p.map((x) => `#${x.id}`).join(", ")}`;
    } else {
      t.aktion = null; t.flags.add("teil"); t.text = `Teil der Sammelzahlung — wird mit Eingang #${haupt.id} gebucht (${ziel})`;
    }
    return t;
  }

  // ── 4. Den besten Treffer wählen ─────────────────────────────────────────
  for (const t of treffer) {
    let bonus = 0;
    if (t.gruende.some((g) => g.startsWith("Zweck nennt Rate"))) bonus += 1;
    if (t.fit >= 2 && !t.flags.has("weit") && !t.flags.has("vorauszahlung")) bonus += 1;
    if (t.flags.has("vorauszahlung")) bonus -= 1;
    t.punkte = t.ident + t.fit + bonus;
  }
  treffer.sort((a, b) => b.punkte - a.punkte || b.fit - a.fit || b.ident - a.ident);
  // Passt der Betrag beim Spitzenreiter nicht (Über-/Teilzahlung), aber genau bei einer anderen
  // Bestellung DERSELBEN Person, hat der Kunde die falsche Referenz benutzt (Fall Topirceanu
  // 08.09.: Zweck nennt die bezahlte Auskunft, das Geld ist die am selben Tag gebuchte Rate).
  if (treffer[0].fit <= 1) {
    const passend = treffer.find((t) => t.fit >= 2 && t.app.personId != null && t.app.personId === treffer[0].app.personId);
    if (passend) { treffer.splice(treffer.indexOf(passend), 1); treffer.unshift(passend); }
  }
  const best = treffer[0];
  const zweiter = treffer.find((t) => t !== best && t.fit >= 2 && t.ziel !== best.ziel);
  const knapp = !!zweiter && best.punkte - zweiter.punkte < 2;
  const staerkerAnderswo = treffer.some((t) => t !== best && t.stark && t.ident > best.ident);
  if (best.fit === 0) return leer(zeile, k, "Kunde erkannt, aber kein Betrag passt.");

  // Kündigung beantragt? (Regel B fragt das auch — hier nur als Hinweis und gegen „sicher")
  if (best.art === "rate" && best.app.ref) {
    const { kuendigungOffen } = await import("../routes/fiaon-wise");
    const ko = await kuendigungOffen(best.app.ref, best.app.personId);
    if (ko) { best.flags.add("kuendigung"); best.hinweise.push(`Kündigung beantragt (${ko}) — trotzdem geschuldet, aber ein Mensch sollte es wissen.`); }
  }
  const auffaellig = ["vorauszahlung", "luecke", "kuendigung", "weit", "teil"].some((f) => best.flags.has(f));
  const nameEindeutig = best.identGruende.some((g) => g.startsWith("Name")) && !treffer.some((t) => t !== best && t.fit >= 2);
  let sicherheit: Sicherheit;
  if (best.fit >= 2 && !auffaellig && !knapp && !staerkerAnderswo && ((best.stark && best.ident >= 3) || nameEindeutig)) sicherheit = "sicher";
  else if (best.fit >= 1 && best.ident >= 2 && !knapp) sicherheit = "wahrscheinlich";
  else sicherheit = "unklar";
  const hinweise = [...best.hinweise];
  if (knapp && zweiter) hinweise.push(`Auch möglich: ${zweiter.text} (${[...zweiter.identGruende, ...zweiter.gruende].join(" + ")}).`);
  if (staerkerAnderswo) {
    const s = treffer.find((t) => t !== best && t.stark && t.ident > best.ident)!;
    hinweise.push(`Der Zweck nennt ${s.app.pr} (${s.app.kunde}) — dort passt der Betrag nicht.`);
  }
  if ([7400, 14900, 19900, 34900].includes(C) && best.art !== "nur_zuordnen" && best.art !== "erstzahlung") hinweise.push(`${eur(C)} ist ein Preis der Bonitätsauskunft — fehlt eine Auskunft-Bestellung?`);
  const offenAufgabe = k.aufgaben.get(`bank-nachholen:${best.art}:${zeile.txnId}`);
  if (offenAufgabe) hinweise.push(`Aufgabe angelegt (${offenAufgabe}).`);
  const aktion = sicherheit === "unklar" && best.aktion !== "aufgabe" ? null : best.aktion;
  return {
    art: best.art, aktion, ziel: best.ziel,
    mitZiel: best.aktion === "buchen" || best.aktion === "zuordnen",
    bestellung: best.app.ref, rateNr: best.rateNr, rateId: best.rateId, kunde: best.app.kunde || null, personId: best.app.personId, dazu: best.dazu,
    sicherheit, gruende: [...best.identGruende, ...best.gruende].slice(0, 6), text: best.text, hinweise,
    erwartet: aktion === "buchen"
      ? best.erwartet ?? { regel: best.art === "erstzahlung" ? "erstzahlung" : "rate", ziel: best.ziel, rateId: best.rateId }
      : aktion === "zuordnen" ? { ziel: best.ziel, rateId: best.rateId } : null,
  };
}

function plusTage(t: string, n: number): string {
  const d = new Date(`${t}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Kein Ziel: „unbekannt" mit Grund — bleibt sichtbar stehen, der Mensch entscheidet. */
function leer(zeile: NachholZeile, k: NachholKontext, grund: string): NachholVorschlag {
  const hinweise: string[] = [];
  if ([7400, 14900, 19900, 34900].includes(zeile.betragCents)) hinweise.push(`${eur(zeile.betragCents)} ist ein Preis der Bonitätsauskunft — fehlt eine Auskunft-Bestellung?`);
  void k;
  return {
    art: "unbekannt", aktion: null, ziel: null, mitZiel: false, bestellung: null, rateNr: null, rateId: null, kunde: null, personId: null, dazu: [],
    sicherheit: "unklar", gruende: [], text: grund, hinweise, erwartet: null,
  };
}

/**
 * Ab wann liegengebliebene Eingänge im Bankbuch angeboten werden, wenn niemand ein Datum
 * nennt: der 24.09.2026 — der Zeitraum, den die Vorschau und die Gegenprüfung vom 01.10.
 * durchgesehen haben (12 Eingänge, 5 freigegeben). Ältere zeigt das Bankbuch nur auf
 * ausdrücklichen Wunsch („Ältere einbeziehen"), damit „Alle buchen" nie stillschweigend
 * Zeilen mitnimmt, die kein Mensch angesehen hat.
 * E-277 (02.10.2026): „Ältere" reicht jetzt bis zum 15.08. — so weit hat die Zuordnung vom
 * 02.10. alle 80 Eingänge durchgesehen (vorher 01.09.; 24 ältere blieben unsichtbar).
 */
export const NACHHOLEN_SEIT_VORGABE = "2026-09-24";
export const NACHHOLEN_SEIT_AELTESTE = "2026-08-15";

/**
 * Alle liegengebliebenen Eingänge (nicht verbucht, Geld da, nicht unterwegs) seit `seit`
 * — jeder mit seiner Trockenprobe und (E-277) seinem Vorschlag. Für „Alle prüfen" im
 * Bankbuch und die Skript-Vorschau.
 */
export async function nachholListe(opts: { seit?: string | null; ids?: number[]; ueberzahlungBisCents?: number; mitVorschlag?: boolean } = {}): Promise<NachholZeile[]> {
  const ids = (opts.ids || []).filter((n) => Number.isInteger(n) && n > 0);
  const seit = opts.seit && /^\d{4}-\d{2}-\d{2}$/.test(opts.seit) ? opts.seit : NACHHOLEN_SEIT_VORGABE;
  const zeilen = (ids.length
    ? await sqlPool`SELECT id FROM fiaon_bank_txns WHERE id = ANY(${ids}) ORDER BY booked_at, id`
    : await sqlPool`SELECT id FROM fiaon_bank_txns
                     WHERE NOT applied AND amount_cents > 0 AND booked_at >= ${seit}::date
                       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'
                     ORDER BY booked_at, id`) as any[];
  const aus: NachholZeile[] = [];
  for (const z of zeilen) {
    const p = await bankeingangTrockenprobe(Number(z.id), { ueberzahlungBisCents: opts.ueberzahlungBisCents });
    if (p.zeile) aus.push(p.zeile);
  }
  if (opts.mitVorschlag !== false && aus.length) {
    const k = await kontextLaden();
    for (const z of aus) if (z.buchen) k.buchbar.add(z.id);
    for (const z of aus) {
      try { z.vorschlag = await vorschlagErmitteln(z, k); }
      catch (e: any) { console.error(`[BANK-NACHHOLEN] Vorschlag #${z.id}:`, String(e?.message || e).slice(0, 160)); }
    }
  }
  return aus;
}

/** Zähler für die Übersicht: wie viele Eingänge warten überhaupt (ohne Trockenprobe, billig). */
export async function nachholZahl(seit = NACHHOLEN_SEIT_VORGABE): Promise<{ anzahl: number; cents: number }> {
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents), 0)::bigint AS c
      FROM fiaon_bank_txns
     WHERE NOT applied AND amount_cents > 0 AND booked_at >= ${seit}::date
       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'`.catch(() => [])) as any[];
  return { anzahl: Number(r?.n || 0), cents: Number(r?.c || 0) };
}
