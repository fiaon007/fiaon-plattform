// ═══════════════════════════════════════════════════════════════════════════
// FIAON — DIE LIEFERSTRECKE DES KOOPERATIONSVERTRAGS „TERMINE FÜR IHRE BERATUNG“ (Register E-386, 16.10.2026)
//
// Der Vertrag (E-384, shared/fiaon-global-angebot-koop.ts) verspricht dem Partner qualifizierte Kontakte: dokumentierte
// Einwilligung + Wunschthema + fester Termin, exklusiv sechs Monate, abgerechnet je Kontakt zum Monatsende. Diese Datei
// hält die Regeln und Texte, die Server, Akte, Kundenbereich und Partnerbereich gleichermaßen brauchen.
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   1. Interesse (freiwillig, Kundenbereich): „Ich möchte ein kostenloses Gespräch“ → Aufgabe an den Betreuer.
//   2. Telefonat: Der Mitarbeiter liest den Einwilligungstext MIT dem Namen des Partners vor; der Kunde sagt Ja.
//      Gespeichert: Datum, Uhrzeit, Wortlaut, Kanal, Mitarbeiter. OHNE dieses Ja gibt es keinen Kontakt.
//   3. Qualifizierungsmaske (Akte): Thema aus den Themen des Partners, Termin in seinen freigegebenen Zeiten, Notiz.
//   4. Übermittlung per Mail an den Partner sofort beim Speichern — spätestens am Werktag vor dem Termin (Ziffer 4).
//   5. Monatsrechnung am Ersten des Folgemonats, Reklamation im Partnerbereich (Gutschrift oder Ersatz).
//
// ── WAS NIE PASSIERT ──────────────────────────────────────────────────────
//   · Kein Kontakt ohne Ja am Telefon, kein Kontakt an Gesperrte, Werbegesperrte oder Global-Kunden.
//   · FIAON empfiehlt nichts — die Maske fragt nur das Thema. Gesundheit, Einkommen, Bonität stehen NIE in der Übermittlung.
//   · Keine Werbemail an Kunden: Gefragt wird im Gespräch oder im eigenen Kundenbereich.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partner- oder Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════

/** Fassung des Einwilligungstextes — steht an jeder gespeicherten Einwilligung. Neuer Text = neue Fassung. */
export const KOOP_EINWILLIGUNG_FASSUNG = "KOOP-EW-2026-10-16";
/** E-390: Fassung der Texte für Recht, Steuern, Energie, Telefon — die Vorsorge-Fassung bleibt. */
export function koopEinwilligungFassung(bereich: string): string {
  return bereich === "vorsorge" || !bereich ? KOOP_EINWILLIGUNG_FASSUNG : `KOOP-EW-${bereich.toUpperCase()}-2026-10-16`;
}
/**
 * Was nicht in die Notiz an den Partner gehört (Ziffer 3 Abs. 2). E-390: Bei Recht gehören Schulden und Inkasso zum Anliegen,
 * bei Steuern Einkommen — dort bleibt nur Gesundheit gesperrt.
 */
export function koopNotizGesperrt(notiz: string, bereich: string): boolean {
  const gesundheit = /\b(krank|diagnose|therapie|behinder)\w*/i;
  if (bereich === "recht" || bereich === "steuern") return gesundheit.test(notiz);
  return gesundheit.test(notiz) || /\b(schufa|bonit|insolven|schulden|pfändung|inkasso|einkommen|gehalt)\w*/i.test(notiz);
}
/** Der Katalogschlüssel der Monatsrechnung (shared/fiaon-pakete.ts). */
export const KOOP_RECHNUNG_PAKET = "koop_kontakte";

export type KoopKanal = "telefon" | "kundenbereich";
export type KoopTerminArt = "telefon" | "video" | "vor_ort";
export const KOOP_TERMIN_ARTEN: { key: KoopTerminArt; text: string }[] = [
  { key: "telefon", text: "Telefon" },
  { key: "video", text: "Video" },
  { key: "vor_ort", text: "vor Ort" },
];
export function koopTerminArtText(a: unknown): string {
  return KOOP_TERMIN_ARTEN.find((x) => x.key === a)?.text ?? "Telefon";
}

/** Wie der Partner im Einwilligungstext heißt: „Herrn Max Muster (Finanz- und Vermögensberatung)“. */
export function koopPartnerImSatz(p: { anrede?: string; vorname?: string; nachname?: string; firma?: string }): string {
  const name = `${String(p.vorname ?? "").trim()} ${String(p.nachname ?? "").trim()}`.trim();
  const vor = p.anrede === "Herr" ? "Herrn " : p.anrede === "Frau" ? "Frau " : "";
  return `${vor}${name}${p.firma ? ` (${String(p.firma).trim()})` : ""}`;
}

/**
 * DER EINWILLIGUNGSTEXT, den der Mitarbeiter vorliest (Art. 6 Abs. 1 Buchst. a, Art. 7 DSGVO; § 7 Abs. 2 Nr. 1 UWG).
 * Er nennt den Empfänger, die Daten, den Zweck, die Kontaktwege und den Widerruf — und dass das Gespräch nichts kostet.
 */
export function koopEinwilligungText(partner: { anrede?: string; vorname?: string; nachname?: string; firma?: string }, thema: string, bereich: string = "vorsorge"): string {
  // E-390: je Bereich ein eigener Text — Kanzleien nennen ihre Kosten vorab, Versorger/Anbieter machen ein Angebot.
  const wer = koopPartnerImSatz(partner);
  const widerruf = "Sie können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen — formlos, z. B. an support@fiaon.com oder telefonisch bei FIAON.";
  if (bereich === "recht" || bereich === "steuern") {
    const art = bereich === "recht" ? "rechtlich" : "steuerlich";
    return [
      `Sie möchten ein Erstgespräch zum Thema „${thema}“ mit ${wer}, ${bereich === "recht" ? "einer Kanzlei" : "einer Steuerkanzlei bzw. einem Lohnsteuerhilfeverein"} im Partner-Netzwerk von FIAON. Die Kosten des Erstgesprächs nennt Ihnen die Kanzlei, bevor es beginnt.`,
      "Dafür übermittelt FIAON Ihren Vor- und Nachnamen, Ihre Telefonnummer, Ihre E-Mail-Adresse, das Thema, den vereinbarten Termin und eine kurze Notiz zu Ihrem Anliegen an die Kanzlei.",
      "Sie willigen ein, dass die Kanzlei Sie dazu telefonisch und per E-Mail kontaktiert.",
      `FIAON berät nicht ${art} und erhält keine Vergütung für ein Mandat. Ihre FIAON-Leistungen hängen nicht davon ab.`,
      widerruf,
    ].join(" ");
  }
  if (bereich === "energie" || bereich === "telekom") {
    const was = bereich === "energie" ? `ein Angebot für ${thema === "Gas" ? "Ihren Gasvertrag" : "Ihren Stromvertrag"}` : `ein Angebot für ${thema === "Mobilfunk" ? "einen Mobilfunkvertrag" : "Internet und Festnetz"}`;
    return [
      `Sie möchten ${was} von ${wer}, einem Partner von FIAON.`,
      "Dafür übermittelt FIAON Ihren Vor- und Nachnamen, Ihre Anschrift, Ihre Telefonnummer, Ihre E-Mail-Adresse, die Sparte, den vereinbarten Rückruftermin und eine kurze Notiz zu Ihrem Bedarf.",
      "Sie willigen ein, dass der Partner Sie dazu telefonisch und per E-Mail kontaktiert. Ein Vertrag entsteht nur, wenn Sie ihn selbst mit dem Partner abschließen.",
      "FIAON erhält vom Partner eine Vergütung, wenn ein Vertrag zustande kommt — für Sie entstehen dadurch keine Kosten. Ihre FIAON-Leistungen hängen nicht davon ab.",
      widerruf,
    ].join(" ");
  }
  return [
    `Sie möchten ein kostenloses Gespräch zum Thema „${thema}“ mit ${koopPartnerImSatz(partner)}, einem selbstständigen Berater und Partner von FIAON.`,
    "Dafür übermittelt FIAON Ihren Vor- und Nachnamen, Ihre Telefonnummer, Ihre E-Mail-Adresse, Ihr Wunschthema, den vereinbarten Termin und eine kurze Notiz aus diesem Gespräch an den Berater.",
    "Sie willigen ein, dass der Berater Sie zu diesem Gespräch telefonisch und per E-Mail kontaktiert.",
    "FIAON berät nicht zu Versicherungen oder Geldanlagen und erhält keine Provision. Ihre FIAON-Leistungen hängen nicht davon ab.",
    "Sie können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen — formlos, z. B. an support@fiaon.com oder telefonisch bei FIAON.",
  ].join(" ");
}
/** Die Frage am Ende des Vorlesens — die Antwort „Ja“ ist die Einwilligung. */
export const KOOP_EINWILLIGUNG_FRAGE = "Sind Sie damit einverstanden?";

/** Der Satz im Kundenbereich (Interesse, noch ohne Partner): Er erlaubt nur, dass FIAON den Kunden dazu anruft. */
export const KOOP_INTERESSE = {
  titel: "Vorsorge und Absicherung — ein kostenloses Gespräch",
  text: "Viele unserer Kunden möchten neben ihren Finanzen auch Vorsorge und Absicherung angehen. Auf Wunsch vermitteln wir Ihnen ein kostenloses Gespräch mit einem unabhängigen Berater — Sie entscheiden danach in Ruhe. Ihre FIAON-Leistungen hängen davon nicht ab.",
  wortlaut: "Ja, ich wünsche ein kostenloses Gespräch zu Vorsorge und Absicherung. FIAON darf mich dazu anrufen, um mein Wunschthema und einen Termin abzustimmen. Meine Daten gehen erst an einen Berater, wenn ich im Telefonat ausdrücklich zustimme. Ich kann das jederzeit widerrufen.",
  knopf: "Ja, ich möchte ein Gespräch",
  nein: "Kein Interesse",
  danke: "Danke — Ihr FIAON-Team ruft Sie an, um Thema und Termin abzustimmen.",
  zurueck: "Gespräch nicht mehr gewünscht",
  abgelehnt: "In Ordnung — wir fragen nicht mehr danach.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// FREIGEGEBENE ZEITEN DES PARTNERS (Ziffer 4: „gibt FIAON die Zeiten frei“)
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopZeiten {
  /** ISO-Wochentage 1 = Montag … 7 = Sonntag */
  tage: number[];
  /** „HH:MM“ in Europe/Berlin */
  von: string;
  bis: string;
  /** Länge eines Termins in Minuten */
  dauerMin: number;
  /** Welche Terminarten der Partner anbietet */
  arten: KoopTerminArt[];
}
export const KOOP_ZEITEN_DAUER = [30, 45, 60, 90] as const;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
function minuten(hhmm: string): number { const m = hhmm.match(HHMM); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; }
/** Prüft und glättet die Zeiten aus dem Partnerbereich. null + Grund bei Unsinn. */
export function koopZeitenAus(roh: unknown): { ok: true; zeiten: KoopZeiten } | { ok: false; error: string } {
  const r = (roh ?? {}) as Record<string, unknown>;
  const tage = Array.isArray(r.tage) ? Array.from(new Set((r.tage as unknown[]).map(Number).filter((t) => Number.isInteger(t) && t >= 1 && t <= 7))).sort() : [];
  const von = String(r.von ?? ""); const bis = String(r.bis ?? "");
  const dauerMin = Number(r.dauerMin);
  const arten = Array.isArray(r.arten) ? Array.from(new Set((r.arten as unknown[]).map(String).filter((a) => KOOP_TERMIN_ARTEN.some((x) => x.key === a)))) as KoopTerminArt[] : [];
  if (!tage.length) return { ok: false, error: "Bitte mindestens einen Wochentag wählen." };
  if (!HHMM.test(von) || !HHMM.test(bis)) return { ok: false, error: "Bitte Uhrzeiten im Format HH:MM angeben." };
  if (!(KOOP_ZEITEN_DAUER as readonly number[]).includes(dauerMin)) return { ok: false, error: "Bitte eine Termindauer wählen." };
  if (minuten(bis) - minuten(von) < dauerMin) return { ok: false, error: "Zwischen Beginn und Ende muss mindestens ein Termin Platz haben." };
  if (!arten.length) return { ok: false, error: "Bitte mindestens eine Terminart wählen (Telefon, Video oder vor Ort)." };
  return { ok: true, zeiten: { tage, von, bis, dauerMin, arten } };
}
const TAG_KURZ = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export function koopZeitenText(z: KoopZeiten | null): string {
  if (!z) return "noch keine Zeiten freigegeben";
  const tage = z.tage.map((t) => TAG_KURZ[t]).join(", ");
  return `${tage} · ${z.von}–${z.bis} Uhr · ${z.dauerMin} Min. · ${z.arten.map(koopTerminArtText).join(", ")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// KALENDER: WERKTAGE, WOCHEN, MONATE (reine Datumsrechnung auf „JJJJ-MM-TT“)
// ═══════════════════════════════════════════════════════════════════════════
function tagUtc(iso: string): Date { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); }
function isoAus(d: Date): string { return d.toISOString().slice(0, 10); }
export function koopTagPlus(iso: string, n: number): string { const d = tagUtc(iso); d.setUTCDate(d.getUTCDate() + n); return isoAus(d); }
export function koopWochentag(iso: string): number { const w = tagUtc(iso).getUTCDay(); return w === 0 ? 7 : w; }
/**
 * Bundesweite gesetzliche Feiertage (fest + Ostern-abhängig). Länderfeiertage zählen nicht — „Werktag“ im Vertrag ist
 * die vorsichtige Lesart: Wer am Vortag eines Landesfeiertags liefert, liefert ohnehin früher.
 */
export function koopFeiertage(jahr: number): Set<string> {
  // Ostersonntag nach Gauß/Anonymus.
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  const ostern = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
  return new Set([
    `${jahr}-01-01`, `${jahr}-05-01`, `${jahr}-10-03`, `${jahr}-12-25`, `${jahr}-12-26`,
    koopTagPlus(ostern, -2), koopTagPlus(ostern, 1), koopTagPlus(ostern, 39), koopTagPlus(ostern, 50),
  ]);
}
export function koopIstWerktag(iso: string): boolean {
  const w = koopWochentag(iso);
  return w <= 5 && !koopFeiertage(Number(iso.slice(0, 4))).has(iso);
}
/** Der letzte Werktag VOR diesem Tag. */
export function koopLetzterWerktagVor(iso: string): string {
  let t = koopTagPlus(iso, -1);
  for (let n = 0; n < 14 && !koopIstWerktag(t); n++) t = koopTagPlus(t, -1);
  return t;
}
/**
 * Ziffer 4: „spätestens am Werktag vor dem Termin“. Übermittelt wird beim Speichern — ein Termin am Tag `terminTag`
 * ist also nur möglich, wenn heute spätestens der letzte Werktag davor ist (Samstag für Montag geht nicht mehr).
 */
export function koopTerminTagMoeglich(terminTag: string, heute: string): boolean {
  return terminTag > heute && koopLetzterWerktagVor(terminTag) >= heute;
}
/** Montag der Woche (ISO) zu einem Tag. */
export function koopWocheMontag(iso: string): string { return koopTagPlus(iso, 1 - koopWochentag(iso)); }
/** „2026-10“ → „Oktober 2026“ */
export function koopMonatText(monat: string): string {
  const [y, m] = monat.split("-").map(Number);
  const namen = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${namen[m - 1] ?? "?"} ${y}`;
}
/** Letzter Kalendertag eines Monats „2026-10“ → „2026-10-31“. */
export function koopMonatEnde(monat: string): string {
  const [y, m] = monat.split("-").map(Number);
  return isoAus(new Date(Date.UTC(y, m, 0, 12)));
}
export function koopVormonat(monat: string): string {
  const [y, m] = monat.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// REKLAMATION (Ziffer 7)
// ═══════════════════════════════════════════════════════════════════════════
export type KoopReklamationGrund = "daten_falsch" | "keine_einwilligung" | "nicht_erschienen" | "dublette" | "minderjaehrig_ausland";
export const KOOP_REKLAMATION_GRUENDE: { key: KoopReklamationGrund; text: string }[] = [
  { key: "daten_falsch", text: "Kontaktdaten falsch oder nicht erreichbar" },
  { key: "nicht_erschienen", text: "Nicht erschienen, binnen sieben Tagen kein Ersatztermin erreichbar" },
  { key: "keine_einwilligung", text: "Interessent bestreitet Einwilligung oder Gesprächswunsch" },
  { key: "dublette", text: "Schon einmal zum selben Thema übermittelt" },
  { key: "minderjaehrig_ausland", text: "Minderjährig oder wohnt nicht in Deutschland" },
];
export function koopReklamationGrundText(g: unknown): string {
  return KOOP_REKLAMATION_GRUENDE.find((x) => x.key === g)?.text ?? String(g ?? "");
}
export type KoopReklamationWahl = "gutschrift" | "ersatz";

// ═══════════════════════════════════════════════════════════════════════════
// STATUS EINES KONTAKTS
// ═══════════════════════════════════════════════════════════════════════════
//   geplant       gespeichert, Übermittlung läuft (Mail noch nicht angenommen)
//   uebermittelt  beim Partner angekommen — zählt und wird berechnet
//   reklamiert    berechtigt reklamiert — Vergütung entfällt (Gutschrift bzw. Ersatz)
//   storniert     vor der Übermittlung zurückgenommen (z. B. Widerruf) — zählt nie
export type KoopKontaktStatus = "geplant" | "uebermittelt" | "reklamiert" | "storniert";
export const KOOP_STATUS_TEXT: Record<KoopKontaktStatus, string> = {
  geplant: "wird übermittelt",
  uebermittelt: "übermittelt",
  reklamiert: "reklamiert",
  storniert: "zurückgenommen",
};

/** Kürzel eines Interessenten für die Aufstellung der Rechnung (Ziffer 6): „Max M.“ */
export function koopKuerzel(vorname: unknown, nachname: unknown): string {
  const v = String(vorname ?? "").trim(); const n = String(nachname ?? "").trim();
  return `${v}${n ? ` ${n.charAt(0)}.` : ""}`.trim() || "—";
}

/** Was die Akte, der Partnerbereich und das Chefbüro über die Lieferung eines Partners wissen. */
export interface KoopLieferStand {
  angebotId: number;
  ref: string;
  partnerName: string;
  aktiv: boolean;
  /** Warum gerade kein neuer Kontakt geht — null = es geht. */
  sperre: string | null;
  ruht: { rechnung: string; faelligAm: string } | null;
  startRahmen: { geliefert: number; deckel: number } | null;
  woche: { geliefert: number; wunsch: number; montag: string };
  monat: { monat: string; geliefert: number };
  ersatzOffen: number;
  zeiten: KoopZeiten | null;
  themen: string[];
  preisCents: number;
}
