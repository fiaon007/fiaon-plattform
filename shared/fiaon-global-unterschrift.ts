// ═══════════════════════════════════════════════════════════════════════════
// DIGITAL UNTERSCHREIBEN IM PORTAL — E-SIGN-KONFORM, OHNE FREMDANBIETER (22.10.2026)
//
// Justin: „So einfach wie möglich für den Kunden — und erst, nachdem er seinen
//          Vertrag angenommen hat.“ Kein DocuSign, kein Drittanbieter.
//
// Der Weg (mobil zuerst): Dokument ansehen → Zustimmung zu elektronischen
// Dokumenten und Unterschriften (mit Verbraucher-Hinweis nach dem US E-SIGN Act,
// 15 U.S.C. § 7001(c)) → vollständigen Namen eintippen (vorbelegt, muss passen) →
// „Unterschreiben“ → sechsstelliger Code per E-Mail → fertig.
//
// WOHIN DER CODE GEHT (entschieden 22.10.2026):
//   · Mit persönlichem Zugang (Sitzung): an die Adresse des angemeldeten Kontos.
//   · Mit dem Link aus der Mail (noch kein Zugang eingerichtet): an die Adresse des
//     Mandats — dieselbe, an die der Link und der Vertrag gingen. Der Code beweist,
//     dass der Unterzeichner dieses Postfach JETZT bedient; der Nachweis vermerkt den
//     Weg („Link + Code“). Einen Zugang zu verlangen, wäre eine Hürde mehr für den
//     Kunden, ohne die Bindung an das Postfach zu verbessern.
//   · Weitere Mitglieder (Operating Agreement mit mehreren Mitgliedern): an IHRE
//     Adresse aus der Mitgliederliste — ohne Adresse geht das Dokument nicht raus.
//
// NIE DIGITAL: IRS SS-4 und 8821 (Tinte, Registered-Agent-Partner) — die Wand
// steht hier (digitalErlaubt) und am Server.
// Der Nachweis je Unterschrift (UnterschriftNachweis) und die Zeilen des
// „Signature Certificate“ stehen hier REIN; den Code, das PDF und das Siegel
// macht server/lib/fiaon-global-unterschrift.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Fassung des Zustimmungstexts — steht in jedem Nachweis. Ändert sich ein Satz unten, zählt sie hoch. */
export const ESIGN_FASSUNG = "ESIGN-2026-10-23";

/** IRS-Formulare werden nie digital unterschrieben. */
export const NIE_DIGITAL = ["irs_ss4", "irs_8821"] as const;
export function digitalErlaubt(pflichtKey: unknown): boolean {
  return !(NIE_DIGITAL as readonly string[]).includes(String(pflichtKey ?? "").trim());
}

/** Namen vergleichen: Groß/klein, Leerzeichen, Akzente und Bindestriche zählen nicht („Müller“ = „Mueller“). */
export function nameNormal(roh: unknown): string {
  return String(roh ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
export function namePasst(eingabe: unknown, erwartet: unknown): boolean {
  const a = nameNormal(eingabe); const b = nameNormal(erwartet);
  return a.length >= 3 && a.includes(" ") && a === b;
}

// ── DIE SÄTZE (DE + britisches Englisch) ─────────────────────────────────────
export const UNTERSCHRIFT_WOERTER = {
  de: {
    knopf: "Digital unterschreiben",
    titel: "Digital unterschreiben",
    schritte: ["Lesen", "Zustimmen", "Name", "Code"],
    lesen: "Bitte lesen Sie das Dokument vollständig.",
    oeffnen: "In neuem Fenster öffnen",
    zustimmung: "Ich stimme der Verwendung elektronischer Dokumente und Unterschriften zu.",
    hinweisTitel: "Hinweis zur elektronischen Unterschrift",
    hinweis: [
      "Sie erhalten und unterschreiben dieses Dokument elektronisch. Ihre elektronische Unterschrift ist ebenso verbindlich wie eine Unterschrift von Hand.",
      "Eine Papierfassung bekommen Sie jederzeit kostenlos: kurze Nachricht an support@fiaon.com genügt.",
      "Sie können Ihre Zustimmung vor dem Unterschreiben jederzeit zurücknehmen, indem Sie dieses Fenster schließen; danach in Textform an support@fiaon.com. Bereits geleistete Unterschriften bleiben wirksam.",
      "Sie brauchen einen aktuellen Browser, ein Programm zum Anzeigen von PDF-Dateien und Zugriff auf Ihr E-Mail-Postfach für den Bestätigungscode.",
      "Ändert sich Ihre E-Mail-Adresse, teilen Sie uns das bitte über Ihre Anfragen im Portal mit. Die Zustimmung gilt für dieses Dokument.",
    ],
    name: "Ihr vollständiger Name",
    nameHilfe: "So, wie er im Dokument steht.",
    nameFalsch: (erwartet: string) => `Bitte tippen Sie den Namen so, wie er im Dokument steht: ${erwartet}.`,
    unterschreiben: "Unterschreiben",
    codeTitel: "Bestätigungscode",
    codeText: (maske: string) => `Wir haben Ihnen einen sechsstelligen Code an ${maske} geschickt. Er gilt zehn Minuten.`,
    codeEingabe: "Code aus der E-Mail",
    bestaetigen: "Code bestätigen und unterschreiben",
    neuSenden: "Code neu senden",
    laeuft: "Einen Moment …",
    fertigTitel: "Unterschrieben",
    fertigText: "Danke — das unterschriebene Dokument mit Nachweis liegt in Ihrem Tresor.",
    vorschau: "Vorschau — hier unterschreibt nur der Kunde.",
    nieDigital: "Dieses Formular wird von Hand unterschrieben — bitte drucken Sie es aus und laden Sie den Scan als PDF hoch.",
    schonUnterschrieben: "Dieses Dokument haben Sie bereits unterschrieben.",
    wartetNicht: "Dieses Dokument wartet nicht auf Ihre Unterschrift.",
    zustimmungFehlt: "Bitte stimmen Sie der Verwendung elektronischer Dokumente und Unterschriften zu.",
    keineAdresse: "Für diese Unterschrift ist keine E-Mail-Adresse hinterlegt. Bitte schreiben Sie Ihrem Ansprechpartner eine Nachricht.",
    mailFehler: "Der Code konnte gerade nicht verschickt werden. Bitte versuchen Sie es gleich noch einmal.",
    codeFalsch: (rest: number) => rest > 0 ? `Der Code stimmt nicht. Noch ${rest === 1 ? "ein Versuch" : `${["", "ein", "zwei", "drei", "vier"][rest] ?? rest} Versuche`}.` : "Der Code stimmt nicht. Bitte fordern Sie einen neuen an.",
    codeAbgelaufen: "Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.",
    codeVerbraucht: "Dieser Code gilt nicht mehr. Bitte fordern Sie einen neuen an.",
    codeNeuOk: "Ein neuer Code ist unterwegs. Er kann zweimal ankommen — es ist derselbe Code. Bitte sehen Sie auch im Ordner „Werbung“ oder „Junk“ nach.",
    codeNeuWarten: (s: number) => `Bitte warten Sie noch ${s} Sekunden, bevor Sie einen neuen Code anfordern.`,
    codeNeuGenug: "Mehr neue Codes gehen für diesen Vorgang nicht. Bitte starten Sie das Unterschreiben neu.",
    zuViele: "Das waren gerade viele Versuche. Bitte warten Sie einige Minuten.",
    verlauf: (titel: string) => `Sie haben digital unterschrieben: ${titel}.`,
    teilweise: (titel: string, name: string) => `${name} hat digital unterschrieben: ${titel}. Es fehlen noch weitere Unterschriften.`,
  },
  en: {
    knopf: "Sign digitally",
    titel: "Sign digitally",
    schritte: ["Read", "Consent", "Name", "Code"],
    lesen: "Please read the document in full.",
    oeffnen: "Open in a new window",
    zustimmung: "I consent to the use of electronic documents and signatures.",
    hinweisTitel: "Notice on electronic signatures",
    hinweis: [
      "You receive and sign this document electronically. Your electronic signature is as binding as a handwritten signature.",
      "You can obtain a paper copy at any time free of charge: a short message to support@fiaon.com is enough.",
      "You may withdraw your consent at any time before signing by closing this window; afterwards in text form to support@fiaon.com. Signatures already given remain valid.",
      "You need a current browser, a program to view PDF files and access to your email inbox for the confirmation code.",
      "If your email address changes, please let us know through your requests in the portal. This consent applies to this document.",
    ],
    name: "Your full name",
    nameHilfe: "Exactly as it appears in the document.",
    nameFalsch: (erwartet: string) => `Please type the name exactly as it appears in the document: ${erwartet}.`,
    unterschreiben: "Sign",
    codeTitel: "Confirmation code",
    codeText: (maske: string) => `We have sent a six-digit code to ${maske}. It is valid for ten minutes.`,
    codeEingabe: "Code from the email",
    bestaetigen: "Confirm code and sign",
    neuSenden: "Send a new code",
    laeuft: "One moment …",
    fertigTitel: "Signed",
    fertigText: "Thank you — the signed document with its certificate is in your vault.",
    vorschau: "Preview — only the client signs here.",
    nieDigital: "This form is signed by hand — please print it and upload the scan as a PDF.",
    schonUnterschrieben: "You have already signed this document.",
    wartetNicht: "This document is not waiting for your signature.",
    zustimmungFehlt: "Please consent to the use of electronic documents and signatures.",
    keineAdresse: "No email address is on file for this signature. Please send your contact a message.",
    mailFehler: "The code could not be sent just now. Please try again in a moment.",
    codeFalsch: (rest: number) => rest > 0 ? `The code is not correct. ${rest === 1 ? "One attempt" : `${["", "One", "Two", "Three", "Four"][rest] ?? rest} attempts`} left.` : "The code is not correct. Please request a new one.",
    codeAbgelaufen: "The code has expired. Please request a new one.",
    codeVerbraucht: "This code is no longer valid. Please request a new one.",
    codeNeuOk: "A new code is on its way. It may arrive twice — it is the same code. Please also check your junk folder.",
    codeNeuWarten: (s: number) => `Please wait another ${s} seconds before requesting a new code.`,
    codeNeuGenug: "No further codes can be sent for this attempt. Please start signing again.",
    zuViele: "That was a lot of attempts. Please wait a few minutes.",
    verlauf: (titel: string) => `You signed digitally: ${titel}.`,
    teilweise: (titel: string, name: string) => `${name} signed digitally: ${titel}. Further signatures are still outstanding.`,
  },
} as const;

/** Der Zustimmungstext, wie er im Nachweis steht (Häkchen + Hinweis) — sein SHA-256 wandert mit. */
export function zustimmungText(s: "de" | "en"): string {
  const w = UNTERSCHRIFT_WOERTER[s];
  return [w.zustimmung, w.hinweisTitel, ...w.hinweis].join("\n");
}

// ── DER NACHWEIS ─────────────────────────────────────────────────────────────
export interface UnterschriftNachweis {
  nr: number;
  art: "kunde" | "fiaon";
  rolle: string;
  /** Wie getippt. */
  name: string;
  /** Wie im Dokument erwartet. */
  erwartet: string;
  methode: "email_code" | "team_sitzung";
  /** sitzung = persönlicher Zugang, link = Link aus der Mail, team = Chefbüro/Office. */
  zugang: "sitzung" | "link" | "team";
  /** Konto, mit dem angemeldet war (nur bei Sitzung). */
  kontoEmail: string | null;
  /** Wohin der Code ging. */
  codeEmail: string | null;
  codeGesendetAm: string | null;
  codeBestaetigtAm: string | null;
  unterschriebenAm: string;
  ip: string | null;
  userAgent: string | null;
  /** Prüfsumme der Fassung, die der Unterzeichner gesehen hat. */
  dokumentSha256: string;
  dokumentId: number;
  zustimmung: { fassung: string; textSha256: string; sprache: "de" | "en" } | null;
  /** Bei FIAON: wer im Team ausgelöst hat. */
  mitarbeiter?: string | null;
}
export interface SignaturAkte {
  art: "digital";
  docId: string;
  formular: string | null;
  fassung: string | null;
  titel: string;
  signaturen: UnterschriftNachweis[];
  /** Prüfsumme des unterschriebenen Dokuments OHNE Zertifikatsseite und der fertigen Datei. */
  sha256Inhalt?: string | null;
  sha256Datei?: string | null;
  endfassungId?: number | null;
  vollstaendig?: boolean;
  siegel?: { status: "versiegelt" | "ausstehend"; am?: string | null; zertifikat?: string | null; grund?: string | null } | null;
}

const zeit = (iso: string | null | undefined) => (iso ? `${iso.slice(0, 19).replace("T", " ")} UTC` : "—");
/** E-Mail für das Zertifikat: vollständig (es ist das Dokument des Kunden selbst). */
const mail = (e: string | null | undefined) => e || "—";

/** Die Zeilen der Seite „Signature Certificate“ (englisch — sie hängt an US-Dokumenten wie an der Ergänzung). */
export function zertifikatZeilen(a: SignaturAkte, ref: string): { kopf: [string, string][]; je: [string, string][][]; fuss: string[] } {
  const kopf: [string, string][] = [
    ["Document", a.titel],
    ["Doc-ID", a.docId],
    ["Engagement", ref],
    ...(a.formular ? [["Form / version", `${a.formular}${a.fassung ? ` · ${a.fassung}` : ""}`] as [string, string]] : []),
    ["Signatures", `${a.signaturen.length}`],
  ];
  const je = a.signaturen.map((s) => [
    ["Signer", `${s.name} — ${s.rolle}`],
    ["Signed by", s.art === "fiaon" ? `FIAON team action${s.mitarbeiter ? ` (${s.mitarbeiter})` : ""}` : "Client in the FIAON portal"],
    ["Authentication", s.methode === "email_code" ? `Six-digit code by email to ${mail(s.codeEmail)} (${s.zugang === "sitzung" ? `signed-in account ${mail(s.kontoEmail)}` : "personal portal link"})` : "Authenticated FIAON staff session"],
    ...(s.methode === "email_code" ? [["Code sent / verified", `${zeit(s.codeGesendetAm)} / ${zeit(s.codeBestaetigtAm)}`] as [string, string]] : []),
    ["Signed at", zeit(s.unterschriebenAm)],
    ["IP address", s.ip || "—"],
    ["Device", (s.userAgent || "—").slice(0, 120)],
    ["Hash before signing", `SHA-256 ${s.dokumentSha256}`],
    ...(s.zustimmung ? [["Consent", `${s.zustimmung.fassung} (${s.zustimmung.sprache.toUpperCase()}), text SHA-256 ${s.zustimmung.textSha256.slice(0, 16)}…`] as [string, string]] : []),
  ] as [string, string][]);
  const fuss = [
    a.sha256Inhalt ? `SHA-256 of the signed document (pages before this certificate): ${a.sha256Inhalt}` : "",
    "Each signer consented to electronic records and signatures (U.S. E-SIGN Act, 15 U.S.C. § 7001; eIDAS Regulation (EU) No 910/2014, Art. 25) and confirmed control of the email address by a one-time code.",
    "This certificate is part of the document. FIAON keeps the audit record in the client file; the checksum of the complete file can be verified by FIAON at any time.",
  ].filter(Boolean);
  return { kopf, je, fuss };
}

/** „m•••••@beispiel.example“ — die Adresse im Dialog, nicht vollständig. */
export function emailMaske(e: string): string {
  const [n, d] = String(e || "").split("@");
  if (!d) return "—";
  return `${n.slice(0, 1)}${"•".repeat(Math.max(3, Math.min(8, n.length - 1)))}@${d}`;
}
