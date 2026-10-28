// ═══════════════════════════════════════════════════════════════════════════
// „NEU FÜR SIE" — WAS FIAON SEIT DEM LETZTEN BESUCH FÜR DEN KUNDEN BEREITGESTELLT HAT (E-456, 29.10.2026)
//
// Justin: „Wenn wir für den Kunden was Neues haben, wie z. B. die US-Nummer, braucht er beim nächsten Login ein
//          Pop-up … was ihn dann direkt dahin weiterleitet — egal ob es die Nummer, die Gründung (Articles of
//          Organization), die Adresse, der Agent, EIN, ITIN oder was auch immer ist."
//
// Diese Datei ist REIN — keine Datenbank, kein Netz, das „jetzt" kommt als Parameter. Sie ist die EINE Stelle für:
//   · ab wann etwas als neu gilt (globalNeuigkeitenGrenze — gesehen, sonst höchstens 14 Tage zurück),
//   · welche Neuigkeiten aus welchen Daten entstehen (globalNeuigkeitenBauen),
//   · Titel, Satz und Ziel jeder Neuigkeit in Kundensprache (gesiezt, DE/EN), ohne Interna.
//
// ── DIE QUELLEN (alles, was der Kunde ohnehin sehen darf) ─────────────────
//   · der SICHTBARE Verlauf (fiaon_global_verlauf, sichtbar = true): Die Stationen schreiben beim ERSTEN Eintragen
//     eines Werts einen festen Satz (GLOBAL_STATION_VERLAUF — „Ihre US-Telefonnummer ist eingerichtet."). Der Satz
//     ist eine Konstante; über ihn wird der Wert zurückerkannt (Telefon, Adresse, Agent, Registernummer, EIN, ITIN,
//     D-U-N-S, Konto). Dazu „Erledigt: …" / „Beantragt: …" der Stationen, Etappe/Start/Abschluss, Kapital-Zusagen
//     und sichtbare Notizen des Teams.
//   · die Dokumente von FIAON (fiaon_global_dokumente): für den Kunden sichtbar, noch nicht von ihm geöffnet —
//     Gründungsurkunde (Articles), EIN-Schreiben, ITIN-Bescheid, Post, „zur Unterschrift" — und „bitte neu" (E-443).
//   · die Antworten im Faden (fiaon_global_nachrichten, von FIAON, ungelesen).
//   · die WERTE selbst kommen aus globalPlusFuerKunde (die Wand gegen Interna: nie der Anbieter, nie die ITIN).
//
// ── WAS BEWUSST NICHT GEZEIGT WIRD ────────────────────────────────────────
//   · Was der Kunde selbst getan hat (Upload, Nachricht, Unterschrift).
//   · „Nächster Schritt: …" — das steht ohnehin groß auf der Bühne.
//   · Ein freier Satz des Teams, der einen Anbieter- oder Partnernamen trägt — dann gilt der feste Satz des Hauses.
// ═══════════════════════════════════════════════════════════════════════════
import type { BereichSprache } from "./fiaon-global-bereich";
import { globalDokumentArtText } from "./fiaon-global-bereich";
import { GLOBAL_FAHRPLAN, globalSchrittTitel } from "./fiaon-global-mandat";
import { GLOBAL_STATION_STATUS_NAME, GLOBAL_STATION_VERLAUF, stationAnbieterImText, stationTelefonText, type GlobalPlusKunde } from "./fiaon-global-stationen";

type Paar = { de: string; en: string };
const t = (p: Paar, s: BereichSprache) => (s === "en" ? p.en : p.de);

/** Beim allerersten Öffnen nach Einführung: höchstens so weit zurück — nie mit alten Dingen fluten. */
export const GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE = 14;
/** Höchstens so viele Zeilen im Fenster; der Rest steht als „und n weitere" darunter. */
export const GLOBAL_NEUIGKEITEN_MAX = 6;

/** Die Seiten des Portals, auf die eine Neuigkeit führt (PortalSeite in client/src/pages/global-portal.tsx). */
export type GlobalNeuigkeitZiel = "uebersicht" | "fahrplan" | "gesellschaft" | "tresor" | "post" | "adressen" | "anfragen" | "kapital";

export type GlobalNeuigkeitArt =
  | "telefon" | "adresse" | "adresse_privat" | "agent" | "eingetragen" | "urkunde" | "ein" | "itin" | "duns" | "konto"
  | "schritt" | "beantragt" | "weg" | "kapital" | "mitteilung" | "dokument" | "post" | "unterschrift" | "bitte_neu" | "antwort";

export interface GlobalNeuigkeit {
  /** Stabil je Thema — dieselbe Neuigkeit aus zwei Quellen (Wert + Schreiben) steht einmal da. */
  id: string;
  art: GlobalNeuigkeitArt;
  titel: string;
  satz: string;
  ziel: GlobalNeuigkeitZiel;
  /** ISO-Zeitpunkt — die jüngste Quelle des Themas. */
  am: string;
  /** Der Wert groß und dünn, wenn die Neuigkeit allein im Fenster steht (US-Nummer, EIN, Registernummer …). */
  gross?: { titel: string; wert: string };
  /** Der Kunde ist am Zug (unterschreiben, neu einreichen) — steht zuerst. */
  handeln?: true;
}

export interface NeuigkeitenQuelle {
  /** ISO — nur was danach geschah, ist neu. */
  grenze: string;
  /** Nur die SICHTBAREN Zeilen des Verlaufs. */
  verlauf: { id: number; art: string; text: string; am: string }[];
  dokumente: {
    id: number; von: "kunde" | "fiaon"; art: string; titel?: string | null; am: string; sichtbar: boolean; gelesen: boolean;
    unterschriftGefordert?: boolean; unterschrieben?: boolean;
    /** E-443: abgelehnt (bitte neu) — nur zählen, solange die Ablehnung offen ist. */
    abgelehntAm?: string | null; abgelehntGrund?: string | null; ablehnungOffen?: boolean;
  }[];
  nachrichten: { id: number; von: "kunde" | "fiaon"; am: string; gelesen: boolean }[];
  /** Die Werte, wie der Kunde sie sehen darf (globalPlusFuerKunde). */
  plus: GlobalPlusKunde;
}

export interface NeuigkeitenErgebnis {
  liste: GlobalNeuigkeit[];
  /** Wie viele weitere es gibt, die nicht mehr ins Fenster passen. */
  weitere: number;
}

// ── DIE ZEITGRENZE ───────────────────────────────────────────────────────────
/**
 * Ab wann gilt etwas als neu? Hat der Kunde das Fenster schon einmal geschlossen: seit diesem Zeitpunkt. Sonst (das
 * allererste Öffnen nach Einführung): seit Einrichtung der Akte, höchstens aber {@link GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE}
 * Tage zurück — was später ist.
 */
export function globalNeuigkeitenGrenze(e: { gesehenAm?: string | null; akteSeit?: string | null; jetzt: string }): string {
  const ms = (x: string | null | undefined) => { const v = x ? Date.parse(x) : NaN; return Number.isFinite(v) ? v : null; };
  const gesehen = ms(e.gesehenAm);
  if (gesehen != null) return new Date(gesehen).toISOString();
  const jetzt = ms(e.jetzt) ?? Date.now();
  const fenster = jetzt - GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE * 86_400_000;
  const seit = ms(e.akteSeit);
  return new Date(seit != null && seit > fenster ? seit : fenster).toISOString();
}

// ── TEXTE ────────────────────────────────────────────────────────────────────
// Kurz, gesiezt, ohne Partner- und Anbieternamen. Der Titel sagt WAS da ist, der Satz WO es liegt.
const TX = {
  telefon: { titel: { de: "Ihre US-Telefonnummer ist da", en: "Your US phone number is ready" }, satz: { de: "Ihre Gesellschaft ist ab sofort unter dieser Nummer erreichbar.", en: "Your company can now be reached on this number." }, gross: { de: "Ihre US-Nummer", en: "Your US number" } },
  adresse: { titel: { de: "Ihre US-Geschäftsadresse steht", en: "Your US business address is in place" }, satz: { de: "Die Anschrift Ihrer Gesellschaft in den USA — zum Kopieren bereit.", en: "Your company's address in the US — ready to copy." }, gross: { de: "US-Geschäftsadresse", en: "US business address" } },
  adresse_privat: { titel: { de: "Ihre private US-Adresse steht", en: "Your private US address is in place" }, satz: { de: "Zum Nachschlagen unter Nummer & Adressen.", en: "Find it under number & addresses." }, gross: { de: "Private US-Adresse", en: "Private US address" } },
  agent: { titel: { de: "Ihre Anschrift für Behördenpost steht", en: "Your address for official mail is in place" }, satz: { de: "Hier nimmt der Registered Agent amtliche Post für Ihre Gesellschaft entgegen.", en: "This is where the registered agent receives official mail for your company." }, gross: { de: "Anschrift des Registered Agent", en: "Registered agent address" } },
  eingetragen: { titel: { de: "Ihre Gesellschaft ist eingetragen", en: "Your company is registered" }, satz: { de: "Sie ist im Register des Bundesstaats aktiv. Die Registernummer steht in Ihren Firmendaten.", en: "It is active in the state register. The register number is in your company details." }, gross: { de: "Registernummer", en: "Register number" } },
  urkunde: { titel: { de: "Ihre Gründungsurkunde liegt bereit", en: "Your formation certificate is ready" }, satz: { de: "Die Articles of Organization Ihrer Gesellschaft — sicher in Ihrem Tresor.", en: "Your company's Articles of Organization — safely stored in your vault." } },
  ein: { titel: { de: "Ihre EIN ist da", en: "Your EIN has arrived" }, satz: { de: "Die US-Steuernummer Ihrer Gesellschaft — zum Kopieren in Ihren Firmendaten.", en: "Your company's US tax number — ready to copy in your company details." }, gross: { de: "EIN Ihrer Gesellschaft", en: "Your company's EIN" } },
  einBrief: { titel: { de: "Ihr EIN-Schreiben liegt bereit", en: "Your EIN letter is ready" }, satz: { de: "Die Bestätigung der US-Steuerbehörde — sicher in Ihrem Tresor.", en: "The confirmation from the US tax authority — safely stored in your vault." } },
  itin: { titel: { de: "Ihre ITIN ist da", en: "Your ITIN has arrived" }, satz: { de: "Ihre persönliche US-Steuernummer ist sicher hinterlegt — sichtbar nach „Anzeigen“ in Ihren Firmendaten.", en: "Your personal US tax number is stored securely — shown after “Show” in your company details." } },
  itinBescheid: { titel: { de: "Ihr ITIN-Bescheid liegt bereit", en: "Your ITIN notice is ready" }, satz: { de: "Der Bescheid der US-Steuerbehörde — sicher in Ihrem Tresor.", en: "The notice from the US tax authority — safely stored in your vault." } },
  duns: { titel: { de: "Ihre D-U-N-S-Nummer ist da", en: "Your D-U-N-S number has arrived" }, satz: { de: "Die Nummer Ihrer Gesellschaft im Firmenverzeichnis.", en: "Your company's number in the business directory." }, gross: { de: "D-U-N-S-Nummer", en: "D-U-N-S number" } },
  konto: { titel: { de: "Ihr US-Geschäftskonto ist eröffnet", en: "Your US business account is open" }, satz: { de: "Den Stand von Konto und Karten sehen Sie unter Banken & Kapital.", en: "See your account and cards under banks & capital." } },
  operating: { titel: { de: "Ihr Gesellschaftsvertrag liegt bereit", en: "Your operating agreement is ready" }, satz: { de: "Das Operating Agreement Ihrer LLC — sicher in Ihrem Tresor.", en: "Your LLC's operating agreement — safely stored in your vault." } },
  erledigt: { titel: (x: string) => ({ de: `Erledigt: ${x}`, en: `Done: ${x}` }) },
  beantragt: { titel: (x: string) => ({ de: `Beantragt: ${x}`, en: `Applied for: ${x}` }), satz: { de: "Die Stelle entscheidet in eigener Frist — Sie sehen jeden Stand auf Ihrem Weg.", en: "The authority decides on its own timeline — you will see every update on your path." } },
  weg: { titel: { de: "Ihr Weg geht weiter", en: "Your path moves forward" } },
  kapital: { titel: { de: "Neuer Stand bei Banken & Kapital", en: "New status in banks & capital" } },
  mitteilung: { titel: { de: "Eine Mitteilung für Sie", en: "A message for you" }, satz: { de: "Ihr Ansprechpartner hat etwas für Sie notiert.", en: "Your contact has left a note for you." } },
  dokument: { titel: (n: number): Paar => (n === 1 ? { de: "Ein neues Dokument im Tresor", en: "A new document in your vault" } : { de: `${n} neue Dokumente im Tresor`, en: `${n} new documents in your vault` }) },
  post: { titel: (n: number): Paar => (n === 1 ? { de: "Neue Post für Ihre Gesellschaft", en: "New mail for your company" } : { de: `${n} neue Briefe für Ihre Gesellschaft`, en: `${n} new letters for your company` }), satz: { de: "Für Sie eingescannt — in Ihrem Briefkasten.", en: "Scanned for you — in your mailbox." } },
  unterschrift: { titel: (x: string): Paar => ({ de: `Bitte unterschreiben: ${x}`, en: `Please sign: ${x}` }), allein: { de: "Ein Dokument wartet auf Ihre Unterschrift", en: "A document is waiting for your signature" }, satz: { de: "Liegt bereit — Sie unterschreiben direkt hier im Portal.", en: "Ready for you — sign directly here in the portal." } },
  bitteNeu: { titel: (x: string): Paar => ({ de: `Bitte neu einreichen: ${x}`, en: `Please submit again: ${x}` }), satz: { de: "Laden Sie die Unterlage bitte noch einmal im Tresor hoch.", en: "Please upload the document again in your vault." } },
  antwort: { titel: (n: number): Paar => (n === 1 ? { de: "Neue Antwort auf Ihre Anfrage", en: "New reply to your request" } : { de: `${n} neue Antworten auf Ihre Anfragen`, en: `${n} new replies to your requests` }), satz: { de: "Von Ihrem Ansprechpartner — im Gesprächsverlauf.", en: "From your contact — in the conversation." } },
} as const;

// Die Stationen in den Worten des Kunden (wie „Ihr Weg" im Portal) — Titel der „Erledigt"/„Beantragt"-Neuigkeiten.
const ALLTAG: Record<string, Paar> = {
  name: { de: "Firmenname gesichert", en: "Company name secured" },
  articles: { de: "Gründung eingereicht", en: "Formation filed" },
  eingetragen: { de: "Gesellschaft eingetragen", en: "Company registered" },
  agent: { de: "Anschrift für Behördenpost", en: "Address for official mail" },
  adresse: { de: "US-Adresse und Telefon", en: "US address and phone" },
  ein: { de: "Steuernummer der Firma", en: "Company tax number" },
  operating_agreement: { de: "Gesellschaftsvertrag", en: "Operating agreement" },
  vorgesellschaft: { de: "Alte Gesellschaft gelöscht", en: "Previous company dissolved" },
  itin: { de: "Ihre persönliche Steuernummer", en: "Your personal tax number" },
  konto: { de: "US-Bankkonto", en: "US bank account" },
  duns: { de: "Eintrag im Firmenverzeichnis", en: "Business directory listing" },
  karte_1: { de: "Erste Firmenkarte", en: "First business card" },
  kartenleiter: { de: "Weitere Firmenkarten", en: "Further business cards" },
  kreditrahmen: { de: "Kreditrahmen", en: "Credit line" },
};

// Station → Thema der „Erledigt"-Neuigkeit, wenn es eins mit eigenem Wert gibt (sonst „schritt:<key>").
// Eine Station ohne eigenes Thema wird „Erledigt: <Station>" und führt auf „Ihr Weg".
const ERLEDIGT_THEMA: Record<string, string> = { eingetragen: "eingetragen", ein: "ein", itin: "itin", duns: "duns", konto: "konto", agent: "agent", adresse: "telefon", operating_agreement: "operating" };
// Feld des Stationen-Verlaufs (GLOBAL_STATION_VERLAUF) → Thema.
const FELD_THEMA: Record<string, string> = {
  usTelefon: "telefon", usAdresse: "adresse", privatAdresse: "adresse_privat", agentAdresse: "agent", aktenzeichen: "eingetragen",
  ein: "ein", itin: "itin", duns: "duns", kontoEroeffnetAm: "konto",
};

/** Partner-, Anbieter- und Hausinterna — ein freier Satz damit geht nie ins Fenster (dann gilt der feste Satz). */
const INTERNA = /\btello\b|\bprovision|\bintern\b|\bmarge\b|bank-?tauglich/i;
export function globalNeuigkeitSatzSauber(text: unknown): boolean {
  const x = String(text ?? "");
  return !!x.trim() && !stationAnbieterImText(x) && !INTERNA.test(x);
}
const kurz = (x: string, max = 180) => { const y = x.replace(/\s+/g, " ").trim(); return y.length > max ? `${y.slice(0, max - 1).trimEnd()}…` : y; };

// Der Satz „Erledigt: <Titel>." / „Beantragt: <Titel>." / eigener Status-Name („EIN erteilt.") → Station + Stand.
function schrittErkennen(text: string): { schluessel: string; stand: "erledigt" | "beantragt" | "sonst" } | null {
  const x = text.trim();
  for (const v of GLOBAL_FAHRPLAN) {
    for (const s of ["de", "en"] as const) {
      const titel = globalSchrittTitel(v.schluessel, s);
      if (x === `Erledigt: ${titel}.` || x === `Done: ${titel}.`) return { schluessel: v.schluessel, stand: "erledigt" };
      if (x === `Beantragt: ${titel}.` || x === `Applied for: ${titel}.`) return { schluessel: v.schluessel, stand: "beantragt" };
      const namen = GLOBAL_STATION_STATUS_NAME[v.schluessel] ?? {};
      for (const [stand, paar] of Object.entries(namen)) {
        if (!paar) continue;
        const n = paar[s];
        if (x === `${n}.`) return { schluessel: v.schluessel, stand: stand === "erledigt" ? "erledigt" : stand === "beantragt" ? "beantragt" : "sonst" };
        if (x === `${titel}: ${n}.`) return { schluessel: v.schluessel, stand: stand === "beantragt" ? "beantragt" : "sonst" };
      }
    }
  }
  // Die Unterschrift des Operating Agreement schreibt ihren eigenen Satz (fiaon-global-unterschrift.ts).
  if (/^(Erledigt: Operating Agreement unterschrieben|Done: operating agreement signed)\.$/.test(x)) return { schluessel: "operating_agreement", stand: "erledigt" };
  return null;
}
function feldErkennen(text: string): string | null {
  const x = text.trim();
  for (const [feld, paar] of Object.entries(GLOBAL_STATION_VERLAUF)) if (x === paar.de || x === paar.en) return feld;
  return null;
}

// ── DER BAU ──────────────────────────────────────────────────────────────────
/**
 * Aus den Quellen die Liste fürs Fenster: je Thema eine Zeile (die stärkste Quelle gewinnt, der jüngste Zeitpunkt
 * zählt), sortiert: erst was der Kunde tun muss, dann Antworten, dann alles Übrige — jüngstes zuerst.
 */
export function globalNeuigkeitenBauen(q: NeuigkeitenQuelle, s: BereichSprache, max: number = GLOBAL_NEUIGKEITEN_MAX): NeuigkeitenErgebnis {
  const grenze = Date.parse(q.grenze);
  const neu = (am: string | null | undefined) => { const v = am ? Date.parse(am) : NaN; return Number.isFinite(v) && (!Number.isFinite(grenze) || v > grenze); };
  const p = q.plus ?? {};
  // Thema → beste Fassung (rang: höher gewinnt) + jüngster Zeitpunkt.
  const themen = new Map<string, { n: GlobalNeuigkeit; rang: number }>();
  const dazu = (thema: string, rang: number, n: Omit<GlobalNeuigkeit, "id">) => {
    const alt = themen.get(thema);
    const am = alt && Date.parse(alt.n.am) > Date.parse(n.am) ? alt.n.am : n.am;
    if (!alt || rang > alt.rang) themen.set(thema, { n: { ...n, id: thema, am }, rang });
    else alt.n.am = am;
  };

  // Werte-Neuigkeiten: Titel, Satz, Ziel und (wenn vorhanden) der Wert groß.
  const wertNeuigkeit = (thema: string, am: string): Omit<GlobalNeuigkeit, "id"> | null => {
    switch (thema) {
      case "telefon": return { art: "telefon", titel: t(TX.telefon.titel, s), satz: t(TX.telefon.satz, s), ziel: "adressen", am, ...(p.usTelefon ? { gross: { titel: t(TX.telefon.gross, s), wert: stationTelefonText(p.usTelefon) } } : {}) };
      case "adresse": return { art: "adresse", titel: t(TX.adresse.titel, s), satz: t(TX.adresse.satz, s), ziel: "adressen", am, ...(p.usAdresse ? { gross: { titel: t(TX.adresse.gross, s), wert: p.usAdresse } } : {}) };
      case "adresse_privat": return { art: "adresse_privat", titel: t(TX.adresse_privat.titel, s), satz: t(TX.adresse_privat.satz, s), ziel: "adressen", am, ...(p.privatAdresse ? { gross: { titel: t(TX.adresse_privat.gross, s), wert: p.privatAdresse } } : {}) };
      case "agent": return { art: "agent", titel: t(TX.agent.titel, s), satz: t(TX.agent.satz, s), ziel: "adressen", am, ...(p.agentAdresse ? { gross: { titel: t(TX.agent.gross, s), wert: p.agentAdresse } } : {}) };
      case "eingetragen": return { art: "eingetragen", titel: t(TX.eingetragen.titel, s), satz: t(TX.eingetragen.satz, s), ziel: "gesellschaft", am, ...(p.aktenzeichen ? { gross: { titel: t(TX.eingetragen.gross, s), wert: p.aktenzeichen } } : {}) };
      case "ein": return { art: "ein", titel: t(TX.ein.titel, s), satz: t(TX.ein.satz, s), ziel: "gesellschaft", am, ...(p.ein ? { gross: { titel: t(TX.ein.gross, s), wert: p.ein } } : {}) };
      // Die ITIN nie als Wert — sie steht nur maskiert im Portal und im Klartext nach „Anzeigen".
      case "itin": return { art: "itin", titel: t(TX.itin.titel, s), satz: t(TX.itin.satz, s), ziel: "gesellschaft", am };
      case "duns": return { art: "duns", titel: t(TX.duns.titel, s), satz: t(TX.duns.satz, s), ziel: "gesellschaft", am, ...(p.duns ? { gross: { titel: t(TX.duns.gross, s), wert: p.duns } } : {}) };
      case "konto": return { art: "konto", titel: t(TX.konto.titel, s), satz: t(TX.konto.satz, s), ziel: "kapital", am };
      case "operating": return { art: "dokument", titel: t(TX.operating.titel, s), satz: t(TX.operating.satz, s), ziel: "tresor", am };
      default: return null;
    }
  };

  // 1 · VERLAUF (nur sichtbare Zeilen)
  for (const v of q.verlauf) {
    if (!neu(v.am)) continue;
    if (v.art === "station") {
      const feld = feldErkennen(v.text);
      const thema = feld ? FELD_THEMA[feld] : null;
      const n = thema ? wertNeuigkeit(thema, v.am) : null;
      if (thema && n) dazu(thema, 30, n);
      continue;
    }
    if (v.art === "schritt") {
      const e = schrittErkennen(v.text);
      if (!e) continue; // „Nächster Schritt: …" steht auf der Bühne
      const name = t(ALLTAG[e.schluessel] ?? { de: globalSchrittTitel(e.schluessel, "de"), en: globalSchrittTitel(e.schluessel, "en") }, s);
      if (e.stand === "erledigt") {
        // „US-Adresse und Telefonnummer" erledigt: die Nummer, wenn es eine gibt — sonst die Adresse.
        const thema = e.schluessel === "adresse" && !p.usTelefon ? "adresse" : ERLEDIGT_THEMA[e.schluessel];
        const n = thema ? wertNeuigkeit(thema, v.am) : null;
        if (thema && n) dazu(thema, 20, n);
        else dazu(`schritt:${e.schluessel}`, 10, { art: "schritt", titel: t(TX.erledigt.titel(name), s), satz: kurz(t(GLOBAL_FAHRPLAN.find((x) => x.schluessel === e.schluessel)!.text, s)), ziel: "fahrplan", am: v.am });
      } else if (e.stand === "beantragt") {
        dazu(`beantragt:${e.schluessel}`, 10, { art: "beantragt", titel: t(TX.beantragt.titel(name), s), satz: t(TX.beantragt.satz, s), ziel: "fahrplan", am: v.am });
      }
      continue;
    }
    if (v.art === "etappe" || v.art === "start" || v.art === "abschluss") {
      if (!globalNeuigkeitSatzSauber(v.text)) continue;
      dazu("weg", 10, { art: "weg", titel: t(TX.weg.titel, s), satz: kurz(v.text), ziel: "fahrplan", am: v.am });
      continue;
    }
    if (v.art === "kapital") {
      if (!globalNeuigkeitSatzSauber(v.text)) continue;
      dazu("kapital", 10, { art: "kapital", titel: t(TX.kapital.titel, s), satz: kurz(v.text), ziel: "kapital", am: v.am });
      continue;
    }
    if (v.art === "notiz") {
      dazu("mitteilung", 10, { art: "mitteilung", titel: t(TX.mitteilung.titel, s), satz: globalNeuigkeitSatzSauber(v.text) ? kurz(v.text) : t(TX.mitteilung.satz, s), ziel: "uebersicht", am: v.am });
    }
  }

  // 2 · DOKUMENTE VON FIAON — sichtbar, noch nicht geöffnet. Bekannte Arten haben ihr eigenes Thema.
  const sonstige: { titel: string; am: string }[] = [];
  const post: string[] = [];
  for (const d of q.dokumente) {
    // E-443: „bitte neu" — ein Dokument des Kunden, das wir neu brauchen (solange die Ablehnung offen ist).
    if (d.von === "kunde") {
      if (d.abgelehntAm && d.ablehnungOffen !== false && neu(d.abgelehntAm)) {
        const art = globalDokumentArtText(d.art, s);
        dazu(`neu:${d.art}`, 50, { art: "bitte_neu", titel: t(TX.bitteNeu.titel(art), s), satz: d.abgelehntGrund && globalNeuigkeitSatzSauber(d.abgelehntGrund) ? kurz(d.abgelehntGrund) : t(TX.bitteNeu.satz, s), ziel: "tresor", am: d.abgelehntAm, handeln: true });
      }
      continue;
    }
    if (!d.sichtbar || !neu(d.am)) continue;
    if (d.unterschriftGefordert) {
      if (d.unterschrieben) continue;
      // Der Titel des Dokuments (den der Kunde im Tresor liest), wenn er sauber ist — sonst die Art. Ein langer Titel
      // („Ergänzung zu Ihrem Auftrag – …") wandert in den Satz, damit die Zeile kurz bleibt.
      const name = d.titel && globalNeuigkeitSatzSauber(d.titel) ? kurz(d.titel, 120) : globalDokumentArtText(d.art, s);
      const lang = name.length > 38;
      dazu(`unterschrift:${d.id}`, 50, {
        art: "unterschrift", titel: lang ? t(TX.unterschrift.allein, s) : t(TX.unterschrift.titel(name), s),
        satz: lang ? `${name}. ${t(TX.unterschrift.satz, s)}` : t(TX.unterschrift.satz, s), ziel: "tresor", am: d.am, handeln: true,
      });
      continue;
    }
    if (d.gelesen) continue;
    if (d.art === "post") { post.push(d.am); continue; }
    if (d.art === "gruendungsurkunde") { dazu("urkunde", 25, { art: "urkunde", titel: t(TX.urkunde.titel, s), satz: t(TX.urkunde.satz, s), ziel: "tresor", am: d.am }); continue; }
    if (d.art === "ein_brief") { dazu("ein", 15, { art: "ein", titel: t(TX.einBrief.titel, s), satz: t(TX.einBrief.satz, s), ziel: "tresor", am: d.am }); continue; }
    if (d.art === "itin_bescheid") { dazu("itin", 15, { art: "itin", titel: t(TX.itinBescheid.titel, s), satz: t(TX.itinBescheid.satz, s), ziel: "tresor", am: d.am }); continue; }
    if (d.art === "operating_agreement") { dazu("operating", 25, { art: "dokument", titel: t(TX.operating.titel, s), satz: t(TX.operating.satz, s), ziel: "tresor", am: d.am }); continue; }
    // Sonst: der Titel aus dem Tresor (den sieht der Kunde dort ohnehin), wenn er sauber ist — sonst die Art.
    sonstige.push({ titel: d.titel && globalNeuigkeitSatzSauber(d.titel) ? kurz(d.titel, 80) : globalDokumentArtText(d.art, s), am: d.am });
  }
  if (sonstige.length) {
    const am = sonstige.map((x) => x.am).sort().slice(-1)[0];
    const namen = Array.from(new Set(sonstige.map((x) => x.titel)));
    dazu("dokument", 5, { art: "dokument", titel: t(TX.dokument.titel(sonstige.length), s), satz: kurz(namen.slice(0, 3).join(" · ") + (namen.length > 3 ? " …" : "")), ziel: "tresor", am });
  }
  if (post.length) dazu("post", 5, { art: "post", titel: t(TX.post.titel(post.length), s), satz: t(TX.post.satz, s), ziel: "post", am: post.sort().slice(-1)[0] });

  // 3 · ANTWORTEN IM FADEN
  const antworten = q.nachrichten.filter((n) => n.von === "fiaon" && !n.gelesen && neu(n.am));
  if (antworten.length) dazu("antwort", 40, { art: "antwort", titel: t(TX.antwort.titel(antworten.length), s), satz: t(TX.antwort.satz, s), ziel: "anfragen", am: antworten.map((x) => x.am).sort().slice(-1)[0] });

  // Reihenfolge: handeln → Antwort → Rest; je Gruppe das Jüngste zuerst.
  const gruppe = (n: GlobalNeuigkeit) => (n.handeln ? 0 : n.art === "antwort" ? 1 : 2);
  const alle = Array.from(themen.values()).map((x) => x.n)
    .sort((a, b) => (gruppe(a) - gruppe(b)) || b.am.localeCompare(a.am) || a.id.localeCompare(b.id));
  const grenzeMax = Math.max(1, Math.floor(max));
  return { liste: alle.slice(0, grenzeMax), weitere: Math.max(0, alle.length - grenzeMax) };
}

// ── DIE WÖRTER DES FENSTERS ──────────────────────────────────────────────────
export const GLOBAL_NEUIGKEITEN_WOERTER = {
  de: {
    titel: "Neu für Sie", lead: "Seit Ihrem letzten Besuch ist das hier für Sie bereit.", leadEins: "Seit Ihrem letzten Besuch.",
    ansehen: "Ansehen", verstanden: "Verstanden", schliessen: "Schließen",
    weitere: (n: number) => (n === 1 ? "Eine weitere Neuigkeit finden Sie im Portal." : `${n} weitere Neuigkeiten finden Sie im Portal.`),
    zuTun: "Für Sie zu tun", vorschau: "Vorschau — so sieht der Kunde das Fenster. Schließen vermerkt nichts.",
  },
  en: {
    titel: "New for you", lead: "Since your last visit, this is ready for you.", leadEins: "Since your last visit.",
    ansehen: "View", verstanden: "Got it", schliessen: "Close",
    weitere: (n: number) => (n === 1 ? "One more update is waiting in your portal." : `${n} more updates are waiting in your portal.`),
    zuTun: "For you to do", vorschau: "Preview — this is how the client sees the window. Closing records nothing.",
  },
} as const;
