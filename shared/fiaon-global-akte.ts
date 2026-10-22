// ═══════════════════════════════════════════════════════════════════════════
// DIE VOLLSTÄNDIGE AKTE EINES GLOBAL-KUNDEN (22.10.2026)
//
// Justin: „Denk an jedes Detail." Portal und Chefbüro zeigen die GANZE Akte:
//   1 alle Rechnungen der Person (Paket, Angebotsteile, Einzelrechnungen wie
//     Fast-Track oder LLC-Gründung, Zusatzdienste) — nie Privat-Rechnungen
//     anderer Produktlinien,
//   2 alle Verträge und Anlagen,
//   3 die Pflichtunterlagen zum Unterschreiben (Vollmachten, IRS-Formulare) mit
//     Vollständigkeit je Mandat,
//   4 „Alle Unterlagen herunterladen“ als ein ZIP mit Inhaltsverzeichnis.
//
// Diese Datei ist REIN (kein Netz, keine Datenbank): die Regeln, welche
// Rechnung dazugehört, wie ein Status heißt, welche Unterlagen Pflicht sind,
// wie die Vorlage der Vollmacht lautet und wie Dateien im ZIP heißen.
// Server: server/lib/fiaon-global-akte-komplett.ts · Prüfstand: scripts/pruef-global-akte.ts
// ═══════════════════════════════════════════════════════════════════════════
import { istGlobalEinzelrechnung, istGlobalPaket, istKoopRechnung, paket } from "./fiaon-pakete";
import { globalZusatzZuPaket } from "./fiaon-global-zusatz";
import { usBundesstaatCode } from "./fiaon-global-bereich";

type Paar = { de: string; en: string };
export type AkteSprache = "de" | "en";

// ── 1 RECHNUNGEN ─────────────────────────────────────────────────────────────
/**
 * Gehört eine Bestellzeile in die Global-Akte? Ja: Global-Pakete, Angebotsteile, Zusatzdienste (Art „global“) und die
 * vereinbarten Einzelrechnungen der Global-Welt (Zahlungsseite „global“: LLC-Gründung, Fast-Track, Unterlagen-Paket).
 * Nein: jede Privat-Linie (Abos, Bonitätsauswertung …) und die Monatsrechnung der Partner-Kooperation (E-423: Kunde und
 * Geschäftspartner sind getrennt).
 */
export function globalAkteRechnungGehoertDazu(packKey: unknown): boolean {
  if (istKoopRechnung(packKey)) return false;
  return istGlobalPaket(packKey) || istGlobalEinzelrechnung(packKey);
}
export type AkteRechnungArt = "paket" | "angebot" | "zusatz" | "einzel";
export function globalAkteRechnungArt(packKey: unknown): AkteRechnungArt {
  const k = String(packKey ?? "").trim().toLowerCase();
  if (globalZusatzZuPaket(k)) return "zusatz";
  if (k === "global_individuell") return "angebot";
  if (istGlobalPaket(k)) return "paket";
  return "einzel";
}
export type AkteRechnungStatus = "offen" | "bezahlt" | "storniert";
/** payment_status (+ storniert/erstattet) → offen · bezahlt · storniert. „gemeldet“ (claimed_paid) bleibt offen, bis gebucht ist. */
export function globalAkteRechnungStatus(paymentStatus: unknown, cancelledAt?: unknown, refundedAt?: unknown): AkteRechnungStatus {
  const s = String(paymentStatus ?? "").trim().toLowerCase();
  if (cancelledAt || refundedAt || ["cancelled", "superseded", "refunded", "storniert"].includes(s)) return "storniert";
  if (s === "paid") return "bezahlt";
  return "offen";
}
export const AKTE_STATUS_TEXT: Record<AkteRechnungStatus, Paar> = {
  offen: { de: "Offen", en: "Open" }, bezahlt: { de: "Bezahlt", en: "Paid" }, storniert: { de: "Storniert", en: "Cancelled" },
};
/** Der Name einer Rechnung für den Kunden: Zusatzdienst → sein Titel, Katalogzeile → ihr Name, sonst der Name an der Zeile. */
export function globalAkteRechnungTitel(packKey: unknown, packName: unknown, s: AkteSprache = "de"): string {
  const z = globalZusatzZuPaket(packKey);
  if (z) return z[s].titel;
  const p = paket(packKey);
  if (p && String(p.key) !== "global_individuell") return p.label;
  return String(packName ?? "").trim() || (s === "en" ? "Invoice" : "Rechnung");
}

// ── 3 DOKUMENTE ZUR UNTERSCHRIFT ─────────────────────────────────────────────
// Nach der rechtlichen Prüfung (22.10.2026): KEINE eigene „Umfassende Vollmacht“ — was FIAON für den Kunden tun darf,
// steht im Vertrag (Ziffer „Befugnisse von FIAON“, shared/fiaon-global-befugnisse.ts) bzw. für ältere Fassungen in der
// Ergänzung, die der Kunde digital unterschreibt. Nach der Gründung der LLC: die vorausgefüllten amtlichen Formulare
// IRS SS-4 (FIAON als Third Party Designee) und, wo nötig, IRS 8821 (von Hand), dazu Statement of Organizer (FIAON
// unterschreibt als Organizer, das Mitglied bestätigt) und Operating Agreement (digital). Das eigene, E-SIGN-konforme
// Unterschreiben steht in shared/fiaon-global-unterschrift.ts und server/lib/fiaon-global-unterschrift.ts (seit 22.10.2026
// abends): Nachweis je Unterschrift in unterschrift_nachweis, Zertifikatsseite, Siegel.
/**
 * Wie unterschrieben wird (22.10.2026): `digital` = der Unterschrift-Dialog im Portal; `handschriftlich` = ausdrucken, von
 * Hand unterschreiben und datieren, als PDF scannen, hochladen. Unser Registered-Agent-Partner verlangt für das IRS-Formular
 * SS-4 (Kunden ohne SSN/ITIN) eine Unterschrift mit Tinte — deshalb sind die IRS-Formulare immer handschriftlich, und für sie
 * wird NIE eine gezeichnete Unterschrift angeboten.
 */
export type UnterschriftModus = "digital" | "handschriftlich";
export function unterschriftModus(pflichtKey: unknown, gespeichert: unknown): UnterschriftModus {
  const p = globalPflichtUnterlage(pflichtKey);
  if (p) return p.modus;
  return String(gespeichert ?? "") === "handschriftlich" ? "handschriftlich" : "digital";
}
export interface PflichtUnterlage {
  key: string;
  /** Wie der Kunde unterschreibt — die IRS-Formulare immer von Hand. */
  modus: UnterschriftModus;
  titel: Paar;
  text: Paar;
  /** Dokumentart im Tresor. */
  art: "steuer" | "vollmacht" | "gruendungsurkunde" | "operating_agreement";
  /** Erscheint erst, wenn die LLC gegründet ist (Gründungstag steht) — oder das Team das Formular schon abgelegt hat. */
  abGruendung: boolean;
  nurAngebot?: RegExp;
  /** 22.10.2026: nur, wenn der angenommene Vertrag die Ziffer „Befugnisse von FIAON“ noch nicht trägt (Ergänzung). */
  nurErgaenzung?: boolean;
  /** 22.10.2026: nur, wenn das Mandat das Formular braucht (8821 im Mandat abschaltbar). */
  abschaltbar?: boolean;
}
export const GLOBAL_PFLICHT_UNTERLAGEN: PflichtUnterlage[] = [
  { key: "irs_ss4", art: "steuer", abGruendung: true, modus: "handschriftlich",
    titel: { de: "IRS Form SS-4 (EIN)", en: "IRS Form SS-4 (EIN)" },
    text: { de: "Der Antrag auf die EIN Ihrer Gesellschaft — vorausgefüllt, mit FIAON als Third Party Designee.", en: "The application for your company's EIN — prefilled, with FIAON as third party designee." } },
  { key: "irs_8821", art: "steuer", abGruendung: true, modus: "handschriftlich", abschaltbar: true,
    titel: { de: "IRS Form 8821 (Steuerauskunft)", en: "IRS Form 8821 (tax information authorization)" },
    text: { de: "Erlaubt uns, bei der US-Steuerbehörde Auskunft zu Ihrer Gesellschaft einzuholen.", en: "Allows us to obtain information about your company from the US tax authority." } },
  // 22.10.2026 (Option A): digital im Portal unterschrieben — eigener E-SIGN-Weg (shared/fiaon-global-unterschrift.ts).
  { key: "fiaon_befugnisse", art: "vollmacht", abGruendung: false, modus: "digital", nurErgaenzung: true,
    titel: { de: "Ergänzung zu Ihrem Auftrag – Ihre Befugnisse für FIAON", en: "Addendum to your engagement – your authority for FIAON" },
    text: { de: "Was FIAON für Sie und Ihre Gesellschaft erledigen darf — einmal digital bestätigen.", en: "What FIAON may handle for you and your company — confirm it once, digitally." } },
  { key: "us_organizer", art: "gruendungsurkunde", abGruendung: true, modus: "digital",
    titel: { de: "Statement of Organizer (Bestätigung)", en: "Statement of Organizer (acknowledgement)" },
    text: { de: "FIAON übergibt Ihnen die gegründete Gesellschaft — Sie bestätigen die Übernahme digital.", en: "FIAON hands the formed company over to you — you acknowledge it digitally." } },
  { key: "us_operating_agreement", art: "operating_agreement", abGruendung: true, modus: "digital",
    titel: { de: "Operating Agreement", en: "Operating Agreement" },
    text: { de: "Der Gesellschaftsvertrag Ihrer LLC — vollständig vorbereitet, Sie unterschreiben digital.", en: "Your LLC's operating agreement — fully prepared, you sign digitally." } },
];
export function globalPflichtUnterlage(key: unknown): PflichtUnterlage | null {
  return GLOBAL_PFLICHT_UNTERLAGEN.find((p) => p.key === String(key ?? "").trim()) ?? null;
}
/**
 * Welche Formulare gelten für dieses Mandat? Erst nach der Gründung (gegruendet) — vorher nur, was das Team schon
 * abgelegt und damit bereit gemeldet hat (`bereit`: pflicht_key vorhandener Dokumente). `nurAngebot` begrenzt auf eine Fassung.
 */
export function globalPflichtFuer(angebotFassung: unknown, lage: { gegruendet: boolean; bereit: Iterable<string>; ergaenzung?: boolean; aus?: Iterable<string> } = { gegruendet: false, bereit: [] }): PflichtUnterlage[] {
  const f = String(angebotFassung ?? "").toUpperCase();
  const bereit = new Set(Array.from(lage.bereit));
  const aus = new Set(Array.from(lage.aus ?? []));
  return GLOBAL_PFLICHT_UNTERLAGEN.filter((p) => (!p.nurAngebot || p.nurAngebot.test(f))
    && (!p.abGruendung || lage.gegruendet || bereit.has(p.key))
    && (!p.nurErgaenzung || lage.ergaenzung === true || bereit.has(p.key))
    && (!p.abschaltbar || !aus.has(p.key) || bereit.has(p.key)));
}
export type PflichtStand = "fehlt" | "vorbereitet" | "wartet" | "unterschrieben";
export interface PflichtDok { id: number; pflichtKey: string | null; unterschriftGefordert: boolean; unterschrieben: boolean; sichtbar: boolean; vonId?: number | null; titel?: string | null }
/**
 * Der Stand je Formular aus den Dokumenten des Tresors: unterschrieben (das Original ist unterschrieben) · wartet (liegt
 * sichtbar zur Unterschrift beim Kunden) · vorbereitet (liegt intern, noch nicht zur Unterschrift gestellt) · fehlt.
 * Dazu jedes andere Dokument, das das Team „zur Unterschrift“ gestellt hat (Schlüssel `dok-<id>`).
 * `vollstaendig` = alles unterschrieben (und es gibt etwas).
 */
export function globalPflichtStand(liste: PflichtUnterlage[], doks: PflichtDok[]): { eintraege: { key: string; stand: PflichtStand; dokumentId: number | null; titel?: string }[]; vollstaendig: boolean; offen: number } {
  const originale = doks.filter((d) => !d.vonId);
  const eintraege: { key: string; stand: PflichtStand; dokumentId: number | null; titel?: string }[] = liste.map((p) => {
    const eigene = originale.filter((d) => d.pflichtKey === p.key);
    const fertig = eigene.find((d) => d.unterschrieben);
    if (fertig) return { key: p.key, stand: "unterschrieben" as const, dokumentId: fertig.id };
    const wartet = eigene.find((d) => d.unterschriftGefordert && d.sichtbar);
    if (wartet) return { key: p.key, stand: "wartet" as const, dokumentId: wartet.id };
    const intern = eigene[0];
    if (intern) return { key: p.key, stand: "vorbereitet" as const, dokumentId: intern.id };
    return { key: p.key, stand: "fehlt" as const, dokumentId: null };
  });
  for (const d of originale) {
    if (d.pflichtKey && liste.some((p) => p.key === d.pflichtKey)) continue;
    if (!d.unterschriftGefordert) continue;
    eintraege.push({ key: `dok-${d.id}`, stand: d.unterschrieben ? "unterschrieben" : d.sichtbar ? "wartet" : "vorbereitet", dokumentId: d.id, titel: d.titel ?? undefined });
  }
  const offen = eintraege.filter((e) => e.stand !== "unterschrieben").length;
  return { eintraege, vollstaendig: eintraege.length > 0 && offen === 0, offen };
}
/** Ein Scan zur Unterschrift ist nur ein PDF — geprüft am Inhalt (Kopf %PDF-), nicht an der Endung. */
export function istPdfInhalt(kopf: Uint8Array | ArrayLike<number> | null | undefined): boolean {
  if (!kopf || (kopf as ArrayLike<number>).length < 5) return false;
  const k = kopf as ArrayLike<number>;
  return k[0] === 0x25 && k[1] === 0x50 && k[2] === 0x44 && k[3] === 0x46 && k[4] === 0x2d;
}
/** Bildformate, die als „Foto statt Scan“ erkannt werden (für die freundliche Meldung). */
export function istBildInhalt(kopf: ArrayLike<number> | null | undefined): boolean {
  if (!kopf || kopf.length < 4) return false;
  const jpg = kopf[0] === 0xff && kopf[1] === 0xd8;
  const png = kopf[0] === 0x89 && kopf[1] === 0x50 && kopf[2] === 0x4e && kopf[3] === 0x47;
  const heic = kopf.length >= 12 && kopf[4] === 0x66 && kopf[5] === 0x74 && kopf[6] === 0x79 && kopf[7] === 0x70;
  return jpg || png || heic;
}

// ── DIE WÖRTER DER HANDSCHRIFTLICHEN UNTERSCHRIFT (Portal, Server) ───────────
// Vier Schritte, mobil zuerst. Die Hilfe zum Scannen verlinkt die Anleitungen von Apple (iPhone, Notizen-App) und für
// Android — ein Foto ist kein Scan und wird nicht angenommen.
export const HANDSCHRIFT_SCAN_HILFE = {
  iphone: "https://support.apple.com/en-us/108963",
  android: "https://www.howtogeek.com/166610/who-needs-a-scanner-scan-a-document-to-pdf-with-your-android-phone/",
} as const;
export const HANDSCHRIFT_WOERTER = {
  de: {
    titel: "Von Hand unterschreiben",
    lead: "Dieses Formular verlangt Ihre Unterschrift mit Stift auf Papier. So geht es in vier Schritten:",
    schritte: [
      { titel: "Herunterladen und prüfen", text: "Öffnen Sie das Formular und prüfen Sie Ihre Angaben." },
      { titel: "Ausdrucken, unterschreiben, datieren", text: "Unterschreiben Sie von Hand und tragen Sie das Datum ein." },
      { titel: "Mit dem Handy als PDF scannen", text: "Bitte als Scan, nicht als Foto." },
      { titel: "Hier hochladen", text: "Wir prüfen das Formular und reichen es für Sie ein." },
    ],
    herunterladen: "Formular öffnen",
    hilfeIphone: "Anleitung iPhone",
    hilfeAndroid: "Anleitung Android",
    waehlen: "PDF auswählen",
    hochladen: "Unterschriebenes PDF hochladen",
    laeuft: "Wird hochgeladen …",
    nurPdf: "Bitte als PDF scannen – Fotos werden nicht angenommen.",
    zuGross: "Die Datei ist größer als 15 MB. Bitte mit geringerer Auflösung scannen.",
    fertigTitel: "Danke — angekommen",
    fertigText: "Ihr unterschriebenes Formular liegt in Ihrem Tresor. Wir kümmern uns um alles Weitere.",
    knopf: "Von Hand unterschreiben",
    marke: "von Hand unterschreiben",
    vorschau: "Vorschau — hochladen kann hier nur der Kunde.",
    schonUnterschrieben: "Dieses Formular liegt bereits unterschrieben vor.",
    nichtHandschrift: "Dieses Dokument wird im Portal unterschrieben, nicht als Scan.",
    nurHandschrift: "Dieses Formular wird von Hand unterschrieben — bitte drucken Sie es aus und laden Sie den Scan als PDF hoch.",
    verlauf: (titel: string) => `Unterschrieben zurückgegeben: ${titel}.`,
    verlaufTeam: (titel: string) => `Unterschriebener Scan für den Kunden hochgeladen: ${titel}.`,
  },
  en: {
    titel: "Sign by hand",
    lead: "This form needs your signature in pen on paper. Here is how, in four steps:",
    schritte: [
      { titel: "Download and check", text: "Open the form and check your details." },
      { titel: "Print, sign and date", text: "Sign by hand and add the date." },
      { titel: "Scan it as a PDF with your phone", text: "Please as a scan, not a photo." },
      { titel: "Upload it here", text: "We check the form and file it for you." },
    ],
    herunterladen: "Open the form",
    hilfeIphone: "iPhone guide",
    hilfeAndroid: "Android guide",
    waehlen: "Choose PDF",
    hochladen: "Upload signed PDF",
    laeuft: "Uploading …",
    nurPdf: "Please scan it as a PDF – photos cannot be accepted.",
    zuGross: "The file is larger than 15 MB. Please scan at a lower resolution.",
    fertigTitel: "Thank you — received",
    fertigText: "Your signed form is in your vault. We take care of everything else.",
    knopf: "Sign by hand",
    marke: "sign by hand",
    vorschau: "Preview — only the client can upload here.",
    schonUnterschrieben: "This form has already been signed.",
    nichtHandschrift: "This document is signed in the portal, not as a scan.",
    nurHandschrift: "This form is signed by hand — please print it and upload the scan as a PDF.",
    verlauf: (titel: string) => `Returned signed: ${titel}.`,
    verlaufTeam: (titel: string) => `Signed scan uploaded for the client: ${titel}.`,
  },
};

export const PFLICHT_STAND_TEXT: Record<PflichtStand, Paar> = {
  fehlt: { de: "Wird vorbereitet", en: "Being prepared" },
  vorbereitet: { de: "Wird vorbereitet", en: "Being prepared" },
  wartet: { de: "Wartet auf Ihre Unterschrift", en: "Awaiting your signature" },
  unterschrieben: { de: "Unterschrieben", en: "Signed" },
};

// ── 4 DAS ZIP ────────────────────────────────────────────────────────────────
/** Ein Dateiname, der in jedem ZIP-Programm und Betriebssystem heil bleibt (ASCII, keine Pfade, keine Steuerzeichen). */
export function akteDateiname(roh: unknown, ersatz = "Dokument"): string {
  const umlaute: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss" };
  const s = String(roh ?? "").replace(/[äöüÄÖÜß]/g, (c) => umlaute[c]).replace(/[\u2013\u2014]/g, "-").normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, 120);
  return s || ersatz;
}
/** Zwei Dateien mit gleichem Namen im selben Ordner bekommen „ (2)“, „ (3)“ … vor der Endung. */
export function akteEindeutig(namen: Set<string>, name: string): string {
  if (!namen.has(name)) { namen.add(name); return name; }
  const punkt = name.lastIndexOf(".");
  const stamm = punkt > 0 ? name.slice(0, punkt) : name; const endung = punkt > 0 ? name.slice(punkt) : "";
  for (let i = 2; ; i++) { const n = `${stamm} (${i})${endung}`; if (!namen.has(n)) { namen.add(n); return n; } }
}
export const AKTE_ORDNER = { vertraege: "01 Vertraege", rechnungen: "02 Rechnungen", vollmachten: "03 Unterschriften", tresor: "04 Tresor", nachweise: "05 Nachweise aus dem Angebot" } as const;

// ── 5 DIE GLOBAL-AKTE FÜR EIN ANGENOMMENES BEGLEIT-ANGEBOT (22.10.2026) ─────
// Der Begleitvertrag (IA-BEGLEIT-…, E-312) legt bei der Annahme bewusst nichts an — keine Bestellzeile, keine Rechnung,
// keine Akte. Die Rechnungen (Unterlagen-Paket, LLC-Gründung, Fast-Track) stellt die Leitung von Hand. Damit Portal,
// Stationen, Tresor und Rechnungen trotzdem laufen, legt die Leitung die Akte mit einem Klick an („Global-Akte anlegen“).
// Eine Akte braucht eine Bestellzeile mit derselben Nummer (lageLesen) — der ANKER ist deshalb die älteste nicht
// stornierte Einzelrechnung der Global-Welt derselben Person (llc_paket, llc_gruendung*, llc_fasttrack). Ohne eine
// solche Rechnung gibt es noch keine Akte. auftrag_ref am Angebot bleibt leer (der Begleitvertrag soll nie in den
// Stundenlauf, das Startgespräch oder die Bestätigungsmail des Individualangebots fallen) — verbunden ist über angebot_id.
export interface AnkerKandidat { ref: string; packKey: string; createdAt: string; paymentStatus: string; cancelled: boolean; merged: boolean; archived: boolean }
export function begleitAkteAnker(zeilen: AnkerKandidat[]): string | null {
  const ok = zeilen.filter((z) => !z.merged && !z.archived && !z.cancelled && !["cancelled", "superseded"].includes(String(z.paymentStatus))
    && globalAkteRechnungGehoertDazu(z.packKey) && globalAkteRechnungArt(z.packKey) === "einzel");
  ok.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.ref < b.ref ? -1 : 1));
  return ok[0]?.ref ?? null;
}
/** Die Spalten der Akte aus dem Begleit-Angebot — rein, damit der Prüfstand sie nachrechnen kann. */
export function begleitAkteDaten(a: { fassung: string; kunde: Record<string, any>; parameter: Record<string, any>; schalter: Record<string, any> }): {
  land: string; firma: Record<string, unknown>; ansprechpartner: Record<string, unknown>; gesellschaft: Record<string, unknown> | null; email: string; name: string;
} {
  const k = a.kunde ?? {};
  const name = [k.vorname, k.nachname].map((x: unknown) => String(x ?? "").trim()).filter(Boolean).join(" ");
  const land = String(k.land ?? "").trim().toUpperCase() || "DE";
  const wunsch = String(a.schalter?.llc?.wunsch ?? "").trim();
  return {
    land, name, email: String(k.email ?? "").trim().toLowerCase(),
    firma: { art: "privat", land, name, rechtsform: "", registergericht: null, registernummer: null, strasse: String(k.strasse ?? ""), plz: String(k.plz ?? ""), ort: String(k.ort ?? ""), ustId: null, website: null, quelleRegister: null },
    ansprechpartner: { anrede: k.anrede ?? "", vorname: String(k.vorname ?? ""), nachname: String(k.nachname ?? ""), funktion: "", email: String(k.email ?? "").trim().toLowerCase(), telefon: String(k.telefon ?? "") },
    gesellschaft: wunsch ? { name: wunsch, bundesstaat: usBundesstaatCode(a.parameter?.bundesstaat) ?? null, geprueft: false } : null,
  };
}
