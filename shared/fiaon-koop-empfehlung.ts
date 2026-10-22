// ═══════════════════════════════════════════════════════════════════════════
// EMPFEHLUNGEN DES PARTNERS AN FIAON — UND SEINE PROVISION (Register E-419, 22.10.2026)
//
// Justin (22.10.2026, Mansur Chehade): „außerdem arbeitet er mit uns zusammen, dafür erhält er 30 % — setze hierfür auch was auf,
// worüber er selbst abchecken kann, welche Kunden von ihm sind und welche Provision ihm erwartet.“ Und am selben Tag per WhatsApp:
// „verrechnen tun wir einstweilen nichts für die Zusammenarbeit“.
//
// Der Kooperationsvertrag (E-384) läuft FIAON → Partner: FIAON übermittelt Kontakte, der Partner zahlt je Kontakt. Hier kommt die
// Gegenrichtung dazu: Der Partner nennt FIAON Kunden und bekommt einen Anteil an dem, was diese Kunden FIAON zahlen.
//   · Basis: die gebuchten Zahlungen des empfohlenen Kunden aus der EINEN Umsatz-Quelle (UMSATZ_QUELLE_SQL, E-343) in den ersten
//     KOOP_PROVISION_MONATE Monaten ab der Meldung — ohne durchlaufende Fremdkosten (KOOP_DURCHLAUF_SCHLUESSEL).
//   · Prozentsatz je Partner im Schalter des Kooperationsvertrags (schalter.provision.prozent) — gesetzt im Chefbüro.
//   · „Berechnung ausgesetzt“ (schalter.berechnungAusgesetzt): übermittelte Kontakte kosten 0 €, kein Start-Rahmen, keine Monatsrechnung.
// Rein — Texte, Regeln und Rechnung; Datenbank und Wege in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Durchlaufende Fremdkosten: kein Umsatz für die Provision (Gründung zum Selbstkostenpreis, Fast-Track, Kooperationsrechnungen). */
export const KOOP_DURCHLAUF_SCHLUESSEL = ["llc_gruendung", "llc_gruendung_halb", "llc_fasttrack", "koop_kontakte"] as const;
/** So lange zählen die Zahlungen eines empfohlenen Kunden ab der Meldung. */
export const KOOP_PROVISION_MONATE = 12;

export interface KoopProvision { prozent: number; seit: string | null }
export function koopProvisionAus(schalter: unknown): KoopProvision | null {
  const s = schalter && typeof schalter === "object" ? (schalter as Record<string, any>).provision : null;
  const p = Number(s?.prozent);
  return Number.isFinite(p) && p > 0 && p <= 50 ? { prozent: Math.round(p * 100) / 100, seit: typeof s?.seit === "string" ? s.seit : null } : null;
}
export function koopBerechnungAusgesetzt(schalter: unknown): boolean {
  return !!(schalter && typeof schalter === "object" && (schalter as Record<string, any>).berechnungAusgesetzt === true);
}
/** Provision in Cent aus dem Umsatz in Cent — kaufmännisch gerundet. */
export function koopProvisionCents(umsatzCents: number, prozent: number): number {
  return Math.round((Math.max(0, umsatzCents) * prozent) / 100);
}

export type KoopEmpfehlungStand = "gemeldet" | "im_gespraech" | "kunde";
export const KOOP_EMPFEHLUNG_STAND_TEXT: Record<KoopEmpfehlungStand, string> = {
  gemeldet: "gemeldet",
  im_gespraech: "im Gespräch",
  kunde: "Kunde",
};

/** Kürzel für Listen außerhalb des Partnerbereichs („Sebastian S.“). */
export function koopEmpfehlungKurz(name: string): string {
  const t = String(name ?? "").trim().split(/\s+/);
  return t.length > 1 ? `${t[0]} ${t[t.length - 1].charAt(0)}.` : (t[0] ?? "");
}

/** Prüft die Meldung eines Partners bzw. der Leitung. Rein. */
export function koopEmpfehlungAus(roh: any): { ok: true; name: string; telefon: string | null; email: string | null; notiz: string | null; personId: number | null } | { ok: false; error: string } {
  const text = (v: unknown, max: number) => String(v ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const name = text(roh?.name, 120);
  if (name.length < 3) return { ok: false, error: "Bitte den Namen der empfohlenen Person bzw. Firma angeben." };
  const telefon = text(roh?.telefon, 40) || null;
  const email = text(roh?.email, 160) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Die E-Mail-Adresse sieht nicht richtig aus." };
  const notiz = text(roh?.notiz, 500) || null;
  const pid = Number(roh?.personId);
  return { ok: true, name, telefon, email, notiz, personId: Number.isInteger(pid) && pid > 0 ? pid : null };
}

export const KOOP_EMPFEHLUNG_TEXTE = {
  titel: "Ihre Empfehlungen an FIAON",
  sub: (prozent: number) => `Für jeden Kunden, den Sie uns nennen, erhalten Sie ${String(prozent).replace(".", ",")} % von dem, was er in den ersten ${KOOP_PROVISION_MONATE} Monaten an FIAON zahlt — ohne durchlaufende Fremdkosten wie Staatsgebühren oder Fast-Track.`,
  leer: "Noch keine Empfehlung. Nennen Sie uns einfach jemanden — unten oder per WhatsApp.",
  meldenTitel: "Jemanden empfehlen",
  meldenHinweis: "Bitte nur mit Einverständnis der Person: Wir rufen sie an bzw. schreiben ihr. Ihre Empfehlung steht sofort hier in der Liste.",
  einverstanden: "Die Person ist einverstanden, dass FIAON sie kontaktiert.",
  fein: "Provision auf gebuchte Zahlungen. Zum Monatsanfang rechnen wir die Zahlungen des Vormonats automatisch per Gutschrift ab und überweisen binnen vierzehn Tagen. Muss FIAON eine Zahlung erstatten, entfällt die Provision daran.",
  auszahlTitel: "Ihre Auszahlungen",
  auszahlSub: "Jeden Monat erstellen wir Ihre Gutschrift automatisch und schicken sie Ihnen per E-Mail. Hinterlegen Sie dafür einmal Ihre Bankverbindung.",
  bankFehlt: "Noch keine Bankverbindung hinterlegt — ohne sie können wir nicht überweisen.",
  keineGutschrift: "Die erste Gutschrift kommt zum Monatsanfang, sobald ein empfohlener Kunde gezahlt hat.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DER MONATSBERICHT AN DEN PARTNER (Register E-421, 22.10.2026)
// Justin: „ja bau die Monats-Mail mit den Empfehlungen“. Einmal im Monat (ab dem 3., für den Vormonat) bekommt jeder Partner mit
// Provision einen Überblick: neue Empfehlungen, Stand je Empfehlung, Provision des Monats und gesamt — und die Gutschrift liegt,
// wenn es eine gibt, direkt bei (dann keine zweite Mail). Rein — Versand und Daten in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════
export const KOOP_BERICHT_LISTE_MAX = 12;
export interface KoopMonatsberichtEin {
  monatText: string; anrede: string; prozent: number; link: string;
  liste: { name: string; standText: string; provision: string; neu: boolean }[];
  zahlen: { gesamt: number; kunden: number; neu: number; monatProvision: string; verdient: string; ausgezahlt: string; offen: string };
  gutschrift: { nummer: string; betrag: string } | null;
  bank: { maske: string } | null;
}
export interface KoopMonatsbericht {
  betreff: string; text: string; absaetze: string[]; daten: { label: string; wert: string }[];
  knopf: { text: string; url: string }; knopf2: { text: string; url: string }; fussnote: string; anhang: { titel: string; absaetze: string[] }[];
}
const htmlSicher = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pz = (p: number) => String(p).replace(".", ",");

/** Baut den Monatsbericht. Absätze sind fertiges, sicheres HTML (nur <b>/<br>); `text` ist die Fassung ohne Tags. */
export function koopMonatsbericht(e: KoopMonatsberichtEin): KoopMonatsbericht {
  const z = e.zahlen; const m = htmlSicher(e.monatText);
  const betreff = e.gutschrift ? `Ihr Partner-Monat ${e.monatText}: ${e.gutschrift.betrag} Provision` : `Ihr Partner-Monat ${e.monatText} bei FIAON`;
  const absaetze = [
    htmlSicher(e.anrede),
    z.neu > 0 ? `vielen Dank für ${z.neu === 1 ? "Ihre neue Empfehlung" : `Ihre ${z.neu} neuen Empfehlungen`} im ${m}! Hier ist Ihr Überblick.` : `hier ist Ihr Überblick für ${m}.`,
    e.gutschrift
      ? `<b>Ihre Gutschrift ${htmlSicher(e.gutschrift.nummer)} über ${htmlSicher(e.gutschrift.betrag)} liegt bei.</b> ${e.bank ? `Wir überweisen den Betrag binnen vierzehn Tagen auf Ihr Konto ${htmlSicher(e.bank.maske)}.` : "Damit wir überweisen können, hinterlegen Sie bitte einmal Ihre Bankverbindung in Ihrem Partnerbereich unter „Ihre Auszahlungen“."}`
      : `Im ${m} ist noch keine Zahlung eines empfohlenen Kunden eingegangen. Sobald einer zahlt, kommt Ihre Gutschrift automatisch zum Monatsanfang – eine Rechnung brauchen Sie nie.`,
    `Kennen Sie jemanden, dem wir helfen können? Nennen Sie ihn uns mit einem Klick – für jeden neuen Kunden erhalten Sie ${pz(e.prozent)} % von dem, was er in den ersten ${KOOP_PROVISION_MONATE} Monaten an FIAON zahlt.`,
  ];
  const daten = [
    { label: "Ihre Empfehlungen", wert: `${z.gesamt}${z.kunden > 0 ? ` (davon ${z.kunden} ${z.kunden === 1 ? "Kunde" : "Kunden"})` : ""}` },
    { label: `Neu im ${e.monatText}`, wert: String(z.neu) },
    { label: `Provision ${e.monatText}`, wert: e.gutschrift?.betrag ?? z.monatProvision },
    { label: "Provision gesamt", wert: z.verdient },
    { label: "Ausgezahlt", wert: z.ausgezahlt },
    { label: "Noch offen", wert: z.offen },
  ].map((d) => ({ label: htmlSicher(d.label), wert: htmlSicher(d.wert) }));
  const zeilen = e.liste.slice(0, KOOP_BERICHT_LISTE_MAX).map((x) => `${htmlSicher(x.name)} · ${htmlSicher(x.standText)} · Provision bisher ${htmlSicher(x.provision)}${x.neu ? " · <b>neu</b>" : ""}`);
  if (e.liste.length > KOOP_BERICHT_LISTE_MAX) zeilen.push(`… und ${e.liste.length - KOOP_BERICHT_LISTE_MAX} weitere – alle in Ihrem Partnerbereich.`);
  const fussnote = `Provision ${pz(e.prozent)} % auf gebuchte Zahlungen Ihrer empfohlenen Kunden in den ersten ${KOOP_PROVISION_MONATE} Monaten ab Ihrer Meldung, ohne durchlaufende Fremdkosten. Muss FIAON eine Zahlung erstatten, entfällt die Provision daran.`;
  const anhang = [{ titel: "Ihre Empfehlungen", absaetze: zeilen.length ? zeilen : ["Noch keine Empfehlung."] }];
  const ohne = (s: string) => s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = [...absaetze.slice(1).map(ohne), "", ...daten.map((d) => `${ohne(d.label)}: ${ohne(d.wert)}`), "", `Ihr Partnerbereich: ${e.link}`, "", "IHRE EMPFEHLUNGEN", ...zeilen.map(ohne)].join("\n\n").replace(/\n{3,}/g, "\n\n");
  return {
    betreff, text, absaetze, daten,
    knopf: { text: "Partnerbereich öffnen", url: e.link }, knopf2: { text: "Jemanden empfehlen", url: `${e.link}#empfehlen` },
    fussnote, anhang,
  };
}
