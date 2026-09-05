// ═══════════════════════════════════════════════════════════════════════════
// DER WEG ZUM RAHMEN — die eine Rechnung (Bauvorlage /app, Abschnitt 4, 05.09.2026)
//
// Elf benannte Schritte, alle Gewicht 1, in fester Reihenfolge. Aus ihnen
// entstehen der Balken („x von y Schritten erledigt"), die Jetzt-Karte, die
// Ruhe-Zeile und der Primärknopf. KEINE Prozentzahl, KEINE Zeitprognose — die
// Zusage der Bank ist kein Schritt und kein Balkenende.
//
// Phase 0 (bis Migration 081): reine Funktion über das Bereich-JSON
// (GET /kunde/:ref/bereich). Client und Server rechnen mit DERSELBEN Funktion —
// heute zeichnet der Client sie aus dem geladenen JSON, später hängt der
// Server das Ergebnis als `rahmenweg` an dieselbe Antwort (fiaon-kunde-bereich.ts)
// und liest es in der Mitarbeiter-Akte. Zwei Wahrheiten gibt es so nie.
//
// Ereignisse werden nie gelöscht, der Balken sinkt nie: ein Schritt, der einmal
// erledigt war, bleibt erledigt — auch wenn ein späterer noch offen ist.
// ═══════════════════════════════════════════════════════════════════════════

/** Spiegel von server/lib/fiaon-konto-karte.ts (dort die Quelle). Nur Rate 2…MIN zählt als Schritt. */
export const KARTE_MIN_RATEN = 2;

export type SchrittStand = "erledigt" | "jetzt" | "kommt";
export type Wer = "kunde" | "fiaon" | null;

export interface Schritt {
  key: string;
  titel: string;
  /** Kurzform für „Jetzt: …" und „Wir arbeiten an: …" (Sache, nicht Ergebnis). */
  kurz: string;
  stand: SchrittStand;
  /** Datum der Erledigung (dd.mm.yyyy) — oder null, wenn die Quelle keins kennt. */
  am: string | null;
  /** Ein Satz für den Kunden, passend zum Stand. */
  text: string;
  /** Wer ist am Zug, wenn der Schritt offen ist. */
  wer: Wer;
  /** Beschriftung des Primärknopfs (nur wer=kunde). */
  aktion: string | null;
  /** Ziel des Primärknopfs: Pfad unter der Basis (/app oder /app/demo) oder der Sonderwert "startgespraech". */
  href: string | null;
  /** Rate nach Fälligkeit gezahlt (Vorschlag 7.2: gefüllt, schraffiert, zählt nicht als pünktlich). */
  verspaetet?: boolean;
}

export type ZielAnzeige = "ohne" | "wunsch" | "wunsch_gekappt" | "nebeneinander";

export interface Rahmenweg {
  ziel: { anzeige: ZielAnzeige; wunschCents: number | null; paketRahmenCents: number | null };
  schritte: Schritt[];
  erledigt: number;
  gesamt: number;
  jetzt: Schritt | null;
  raten: { gesamt: number; bezahlt: number; puenktlich: number; ueberfaellig: { nr: number; seit: string | null; betragCents: number } | null };
  lage: "kunde_dran" | "fiaon_dran" | "nichts_offen";
  arbeitAn: { titel: string; seit: string | null } | null;
}

/** Nur die Felder des Bereich-JSON, die diese Rechnung braucht. */
export interface BereichEingang {
  stufe: { bezahlt: boolean; vollAktiv: boolean };
  onboardingGelaufen?: boolean;
  termin?: { beginn: string; status: string; agent: string | null } | null;
  unterlagen: { kontoauszug: boolean; ausweis: boolean; erneutKontoauszug?: boolean; erneutAusweis?: boolean };
  kontoVerbunden?: boolean;
  bonitaet?: { hatDokument: boolean; geprueft: boolean; darfKaufen: boolean; bezahlt: boolean } | null;
  abo?: { raten: { nr: number; betragCents: number; status: string; faelligAm: string | null; faelligIso: string | null; bezahltAm: string | null }[] } | null;
  karte?: { verschickt?: boolean; tore?: { titel: string; erfuellt: boolean }[] } | null;
  paket: { wunschlimit: number | null; rahmen: number | null };
  fahrplan?: { key: string; datum: string | null; stand: string }[];
}

export interface RahmenwegOptionen {
  /** Heutiges Datum YYYY-MM-DD (Berlin). Ohne Angabe: lokales Datum des Aufrufers. */
  heuteIso?: string;
  /** Justins Festlegung 7.1 — bis dahin „ohne". */
  anzeige?: ZielAnzeige;
  /** Anspruchs-Check-Stand, falls geladen. */
  check?: { beantwortet: number; gesamt: number } | null;
  /** Vorgänge, falls geladen: Zahl der versandten Anträge. */
  vorgaengeVersandt?: number | null;
}

const heuteLokalIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** „dd.mm.yyyy" → „yyyy-mm-dd" (für Vergleiche); alles andere unverändert. */
const isoAus = (de: string | null): string | null => {
  if (!de) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(de);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : de;
};

export function rahmenwegAus(b: BereichEingang, o: RahmenwegOptionen = {}): Rahmenweg {
  const heute = o.heuteIso ?? heuteLokalIso();
  const datum = (key: string): string | null => b.fahrplan?.find((e) => e.key === key && e.stand === "fertig")?.datum ?? null;
  const tore = b.karte?.tore ?? [];
  const raten = b.abo?.raten ?? [];

  // ── Raten: Zähler und Überfälliges ─────────────────────────────────────
  let bezahlt = 0, puenktlich = 0;
  let ueberfaellig: Rahmenweg["raten"]["ueberfaellig"] = null;
  for (let i = 0; i < raten.length; i++) {
    const r = raten[i];
    if (r.status === "bezahlt") {
      bezahlt++;
      const gezahlt = isoAus(r.bezahltAm);
      if (!gezahlt || !r.faelligIso || gezahlt <= r.faelligIso) puenktlich++;
    } else if (r.faelligIso && r.faelligIso < heute && !ueberfaellig) {
      ueberfaellig = { nr: r.nr, seit: r.faelligAm, betragCents: r.betragCents };
    }
  }

  const s: Schritt[] = [];
  const KURZ: Record<string, string> = { daten: "Ihre Angaben", erstzahlung: "Ihre erste Zahlung", startgespraech: "Ihr Startgespräch", anspruchs_check: "Ihr Anspruchs-Check", unterlagen: "Ihre Unterlagen", auskunft: "Ihre Bonitätsauskunft", analyse: "die Prüfung Ihrer Auskunft", erster_vorgang: "Ihr erstes Schreiben", konto_eroeffnet: "Ihr Girokonto", karte_beantragt: "Ihr Weg zu Konto und Karte" };
  const ok = (key: string, titel: string, erledigt: boolean, am: string | null, textOffen: string, wer: Wer, aktion: string | null, href: string | null, extra?: Partial<Schritt>) => {
    s.push({ key, titel, kurz: KURZ[key] ?? (key.startsWith("rate_") ? `Rate ${key.slice(5)}` : titel), stand: erledigt ? "erledigt" : "kommt", am: erledigt ? am : null, text: textOffen, wer: erledigt ? null : wer, aktion: erledigt ? null : aktion, href: erledigt ? null : href, ...extra });
  };

  // 1 · Angaben — Tor „Antrag vollständig" (erstes Tor). Ohne Kartenstand gilt der Antrag als vollständig.
  const datenOk = tore.length ? !!tore[0]?.erfuellt : true;
  ok("daten", "Ihre Angaben sind vollständig", datenOk, null, "Name, Anschrift und Geburtsdatum müssen zu Ihrem Ausweis passen.", "kunde", "Angaben prüfen", "/mehr");
  // 2 · Erste Zahlung
  ok("erstzahlung", "Erste Zahlung eingegangen", !!b.stufe.bezahlt, null, "Mit dem Eingang Ihrer ersten Zahlung beginnt die Arbeit an Ihrer Akte.", "kunde", "Jetzt zahlen", "/geld");
  // 3 · Startgespräch
  const startFertig = !!b.onboardingGelaufen || !!b.fahrplan?.some((e) => e.key === "start" && e.stand === "fertig");
  const terminIso = b.termin?.beginn ? String(b.termin.beginn).slice(0, 10) : null;
  const terminGebucht = !!terminIso && terminIso >= heute && b.termin!.status !== "abgesagt" && b.termin!.status !== "verpasst";
  ok("startgespraech", "Startgespräch geführt", startFertig, datum("start"),
    terminGebucht ? "Ihr Termin steht. Halten Sie Ihr Handy bereit – wir rufen zur gebuchten Zeit an." : "Am Telefon gehen wir Ihre Akte durch und prüfen Ihre Ansprüche.",
    terminGebucht ? "fiaon" : "kunde", terminGebucht ? null : "Zeit wählen", terminGebucht ? null : "startgespraech");
  // 4 · Anspruchs-Check
  const checkOk = !!o.check && o.check.gesamt > 0 && o.check.beantwortet >= o.check.gesamt;
  ok("anspruchs_check", "Ansprüche geprüft", checkOk, null, "Zehn Fragen – danach steht, was Sie beantragen können.", "kunde", "Anspruchs-Check starten", "/ansprueche/check");
  // 5 · Unterlagen
  const u = b.unterlagen;
  const unterlagenOk = !!u.ausweis && (!!u.kontoauszug || !!b.kontoVerbunden) && !u.erneutAusweis && !u.erneutKontoauszug;
  ok("unterlagen", "Ausweis und Kontoauszug geprüft", unterlagenOk, datum("unterlagen"), "Ein Handyfoto genügt, wenn alles lesbar ist.", "kunde", "Unterlagen einreichen", "/unterlagen");
  // 6 · Auskunft
  const bo = b.bonitaet ?? null;
  const auskunftDa = !!bo?.hatDokument;
  const auskunftKunde = !!bo?.darfKaufen && !bo?.bezahlt;
  ok("auskunft", "Bonitätsauskunft liegt vor", auskunftDa, datum("auskunft"),
    auskunftKunde ? "Die Auskunft ist die Grundlage für jeden Löschantrag." : "Wir beschaffen Ihre Auskunft und tragen sie hier ein.",
    auskunftKunde ? "kunde" : "fiaon", auskunftKunde ? "Auskunft beauftragen" : null, auskunftKunde ? "/unterlagen" : null);
  // 7 · Analyse
  ok("analyse", "Auskunft geprüft und erklärt", !!bo?.geprueft, datum("analyse"), "Ein Mensch prüft jeden Eintrag und erklärt ihn in Ihrer Akte.", "fiaon", null, null);
  // 8 · Erstes Schreiben
  ok("erster_vorgang", "Erstes Schreiben versandt", (o.vorgaengeVersandt ?? 0) > 0, null, "Aus Ihren Ansprüchen entsteht der erste Antrag – Sie unterschreiben, ein Mensch versendet.", "fiaon", null, null);
  // 9 · Rate 2 … KARTE_MIN_RATEN
  for (let n = 2; n <= KARTE_MIN_RATEN; n++) {
    const r = raten.find((x) => x.nr === n) ?? null;
    const gez = r?.status === "bezahlt";
    const faellig = !!r?.faelligIso && r.faelligIso <= heute;
    const verspaetet = gez && !!r?.faelligIso && !!isoAus(r.bezahltAm) && (isoAus(r.bezahltAm) as string) > r.faelligIso;
    ok(`rate_${n}`, `Rate ${n} gezahlt`, gez, r?.bezahltAm ?? null,
      r ? (faellig ? `Rate ${n} ist fällig – jede pünktliche Rate ist zugleich Ihr Zahlungsnachweis.` : `Fällig am ${r.faelligAm ?? "–"}. Jede pünktliche Rate ist zugleich Ihr Zahlungsnachweis.`) : "Ihr Zahlungsnachweis für die Bank.",
      faellig ? "kunde" : "fiaon", faellig ? "Rate zahlen" : null, faellig ? "/geld" : null, { verspaetet });
  }
  // 10 · Girokonto
  ok("konto_eroeffnet", "Girokonto eröffnet", false, null, "Sobald die drei Punkte der Bank erfüllt sind, eröffnen Sie das Konto – wir begleiten.", "fiaon", null, null);
  // 11 · Karte beantragt
  // „verschickt" heißt: der Kunde hat den Weg zu Konto und Karte bekommen (E-067,
  // Konto-und-Karte-Mail) — nicht, dass eine Karte beantragt wäre. Praxistest
  // 05.09.: Sapia stand mit „Karte beantragt ✓" da, ohne je ein Konto eröffnet
  // zu haben. Der Schritt heißt deshalb, was er ist.
  ok("karte_beantragt", "Weg zu Konto und Karte erhalten", !!b.karte?.verschickt, null, "Sobald Ihre Akte vollständig ist, schicken wir Ihnen den Weg zu Konto und Karte bei unserer Partnerbank. Über Karte und Rahmen entscheidet die Bank.", "fiaon", null, null);

  // ── Jetzt = erster nicht erledigter Schritt ────────────────────────────
  let jetzt: Schritt | null = null;
  for (let i = 0; i < s.length; i++) { if (s[i].stand !== "erledigt") { s[i].stand = "jetzt"; jetzt = s[i]; break; } }
  const erledigt = s.filter((x) => x.stand === "erledigt").length;

  // ── Lage: Kunde dran, FIAON dran, nichts offen ─────────────────────────
  let lage: Rahmenweg["lage"] = "nichts_offen";
  let arbeitAn: Rahmenweg["arbeitAn"] = null;
  if (ueberfaellig || (jetzt && jetzt.wer === "kunde")) lage = "kunde_dran";
  else if (jetzt && jetzt.wer === "fiaon") { lage = "fiaon_dran"; arbeitAn = { titel: jetzt.kurz, seit: null }; }

  const wunschCents = b.paket.wunschlimit ? Math.round(b.paket.wunschlimit * 100) : null;
  const paketRahmenCents = b.paket.rahmen ? Math.round(b.paket.rahmen * 100) : null;

  return {
    ziel: { anzeige: o.anzeige ?? "ohne", wunschCents, paketRahmenCents },
    schritte: s, erledigt, gesamt: s.length, jetzt,
    raten: { gesamt: raten.length, bezahlt, puenktlich, ueberfaellig },
    lage, arbeitAn,
  };
}

/**
 * Der Satz über dem Balken. Justins Festlegung 7.1 (05.09.2026): Variante „ohne" BLEIBT —
 * „Ihr Weg zur Karte", der Wunsch aus dem Antrag als kleine Zeile darunter. Die anderen
 * Varianten bleiben schaltbar, falls das Haus später anders entscheidet.
 * Festlegung 7.2 (05.09.2026): Eine nach Fälligkeit gezahlte Rate füllt ihr Segment
 * (schraffiert), zählt aber nicht als „pünktlich" — so gerechnet in rahmenwegAus().
 */
export function zielTitel(z: Rahmenweg["ziel"], eur: (cents: number) => string): { titel: string; zeilen: string[] } {
  const w = z.wunschCents, p = z.paketRahmenCents;
  switch (z.anzeige) {
    case "wunsch": return w ? { titel: `Ihr Weg zu ${eur(w)}`, zeilen: ["Ihr Wunsch aus dem Antrag"] } : { titel: "Ihr Weg zur Karte", zeilen: [] };
    case "wunsch_gekappt": { const g = w && p ? Math.min(w, p) : (w ?? p); return g ? { titel: `Ihr Weg zu ${eur(g)}`, zeilen: ["Rahmen Ihres Pakets"] } : { titel: "Ihr Weg zur Karte", zeilen: [] }; }
    case "nebeneinander": return { titel: "Ihr Weg zur Karte", zeilen: [w ? `Ihr Wunsch: ${eur(w)}` : "", p ? `Rahmen Ihres Pakets: ${eur(p)}` : ""].filter(Boolean) };
    default: return { titel: "Ihr Weg zur Karte", zeilen: w ? [`Ihr Wunsch aus dem Antrag: ${eur(w)}`] : ["Ihren Wunschrahmen tragen wir im Startgespräch mit Ihnen ein."] };
  }
}
