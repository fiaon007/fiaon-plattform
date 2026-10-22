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
// steht im Vertrag, den er ohnehin annimmt. Zur Unterschrift kommen nach der Gründung der LLC die vorausgefüllten
// amtlichen Formulare: IRS Form SS-4 (FIAON als Third Party Designee) und, wo nötig, IRS Form 8821. Dazu jedes Dokument,
// das das Team „zur Unterschrift“ stellt. Das Statement of Organizer unterschreibt FIAON selbst (Tresor, keine Pflicht
// für den Kunden). Das eigene, E-SIGN-konforme Unterschreiben baut eine spätere Scheibe — hier steht nur das Datenmodell:
// Art (pflicht_key), Stand vorbereitet → zur Unterschrift → unterschrieben, Zeitpunkt (unterschrieben_am) und ein
// leerer JSON-Nachweis (unterschrift_nachweis) für den Prüfbericht der Unterschrift.
export interface PflichtUnterlage {
  key: string;
  titel: Paar;
  text: Paar;
  /** Dokumentart im Tresor. */
  art: "steuer" | "vollmacht";
  /** Erscheint erst, wenn die LLC gegründet ist (Gründungstag steht) — oder das Team das Formular schon abgelegt hat. */
  abGruendung: boolean;
  nurAngebot?: RegExp;
}
export const GLOBAL_PFLICHT_UNTERLAGEN: PflichtUnterlage[] = [
  { key: "irs_ss4", art: "steuer", abGruendung: true,
    titel: { de: "IRS Form SS-4 (EIN)", en: "IRS Form SS-4 (EIN)" },
    text: { de: "Der Antrag auf die EIN Ihrer Gesellschaft — vorausgefüllt, mit FIAON als Third Party Designee.", en: "The application for your company's EIN — prefilled, with FIAON as third party designee." } },
  { key: "irs_8821", art: "steuer", abGruendung: true,
    titel: { de: "IRS Form 8821 (Steuerauskunft)", en: "IRS Form 8821 (tax information authorization)" },
    text: { de: "Erlaubt uns, bei der US-Steuerbehörde Auskunft zu Ihrer Gesellschaft einzuholen.", en: "Allows us to obtain information about your company from the US tax authority." } },
];
export function globalPflichtUnterlage(key: unknown): PflichtUnterlage | null {
  return GLOBAL_PFLICHT_UNTERLAGEN.find((p) => p.key === String(key ?? "").trim()) ?? null;
}
/**
 * Welche Formulare gelten für dieses Mandat? Erst nach der Gründung (gegruendet) — vorher nur, was das Team schon
 * abgelegt und damit bereit gemeldet hat (`bereit`: pflicht_key vorhandener Dokumente). `nurAngebot` begrenzt auf eine Fassung.
 */
export function globalPflichtFuer(angebotFassung: unknown, lage: { gegruendet: boolean; bereit: Iterable<string> } = { gegruendet: false, bereit: [] }): PflichtUnterlage[] {
  const f = String(angebotFassung ?? "").toUpperCase();
  const bereit = new Set(Array.from(lage.bereit));
  return GLOBAL_PFLICHT_UNTERLAGEN.filter((p) => (!p.nurAngebot || p.nurAngebot.test(f)) && (!p.abGruendung || lage.gegruendet || bereit.has(p.key)));
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
