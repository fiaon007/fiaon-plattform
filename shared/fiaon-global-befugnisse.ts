// ═══════════════════════════════════════════════════════════════════════════
// DIE BEFUGNISSE VON FIAON — EINE QUELLE FÜR JEDEN GLOBAL-VERTRAG (22.10.2026, Fassungen ab 2026-10-23)
//
// Justin („Option A“, nach der rechtlichen Prüfung vom 22.10.2026): keine eigene
// „Umfassende Vollmacht“ gegenüber US-Behörden. Was FIAON für den Kunden tun darf,
// steht als Ziffer IM Vertrag, den der Kunde ohnehin annimmt — und für Kunden mit
// einer älteren Fassung als „Ergänzung zu Ihrem Auftrag“, die sie im Portal
// digital unterschreiben (shared/fiaon-global-unterschrift.ts).
//
// Grundlage: der zurückgezogene Vollmachtsentwurf (11_Vertraege/Vorlagen_Global,
// §§ 2 bis 7) — mit zwei Entscheidungen des Gründers vom 22.10.2026 (abends):
//   1. Steuererklärungen und rechtliche Leistungen GEHÖREN dazu: FIAON beauftragt,
//      koordiniert und bezahlt zugelassene Partner (US-CPA, Steuerberater,
//      Rechtsanwälte); sie handeln im eigenen Mandat des Kunden (dieselbe Linie wie
//      GLOBAL_ROLLEN.partner in shared/fiaon-global.ts). Wo das Gesetz die
//      persönliche Unterschrift verlangt, bereiten FIAON oder der Partner alles vor,
//      und der Kunde unterschreibt nur.
//   2. Die EINZIGEN Grenzen: keine Konten und kein Geld, keine Anträge oder Verträge
//      über Kredit, Karte, Darlehen oder Finanzierung, keine Sicherheiten oder
//      Bürgschaften für den Kunden, keine Übertragung oder Belastung von Anteilen und
//      keine Auflösung ohne Weisung in Textform.
//
// Wer hier einen Satz ändert, ändert ihn in ALLEN Verträgen (Paketauftrag de/en,
// Individual-, Begleit-, Kapital-, Firmenangebot) und in der Ergänzung — und zählt
// die Fassungen hoch (scripts/pruef-global-befugnisse.ts hält das fest).
// Wortregeln: keine Frist mit Ziffer, kein „bis zu“, keine Empfehlung, kein Bankname,
// nie der Name des Registered-Agent-Anbieters.
// Diese Datei ist REIN (kein Netz, keine Datenbank).
// ═══════════════════════════════════════════════════════════════════════════
import type { AngebotAbsatz } from "./fiaon-global-angebot";

/** Fassung des Wortlauts — steht in der Ergänzung und im Nachweis jeder Unterschrift darunter. */
export const BEFUGNISSE_FASSUNG = "BEF-2026-10-23";
/** Ab diesem Tag tragen die Vertragsfassungen die Ziffer (Paketauftrag „2026-10-23“, Angebote „IA-…-2026-10-23“). */
export const BEFUGNISSE_AB = "2026-10-23";

export const BEFUGNISSE_TITEL = { de: "Befugnisse von FIAON", en: "Authority of FIAON" } as const;

/** Wie der Vertrag den Kunden nennt. Paket/Individual/Begleit: „der Auftraggeber“; Kapital/Firma: „die Auftraggeberin“. */
export type BefugnisseForm = "auftraggeber" | "auftraggeberin" | "en";

interface Woerter { der: string; Der: string; den: string; des: string; ihm: string; seinem: string; seiner: string; als: string }
const W: Record<"auftraggeber" | "auftraggeberin", Woerter> = {
  auftraggeber: { der: "der Auftraggeber", Der: "Der Auftraggeber", den: "den Auftraggeber", des: "des Auftraggebers", ihm: "ihm", seinem: "seinem", seiner: "seiner", als: "als Gesellschafter (Member) und, soweit bestellt, als Geschäftsführer (Manager)" },
  auftraggeberin: { der: "die Auftraggeberin", Der: "Die Auftraggeberin", den: "die Auftraggeberin", des: "der Auftraggeberin", ihm: "ihr", seinem: "ihrem", seiner: "ihrer", als: "als Gesellschafterin (Member) und, soweit bestellt, als Geschäftsführerin (Manager)" },
};

/** Was FIAON tun darf — Nummer 1 bis 10 (Vertragssprache). */
function umfangDe(w: Woerter): string[] {
  return [
    "die Gründung: den Namen der Gesellschaft prüfen und reservieren, die Gründungsunterlagen (Articles of Organization) vorbereiten, als Organizer unterzeichnen und beim Bundesstaat einreichen und die Gebühren dafür entrichten;",
    `Registered Agent und Kontaktperson: einen Registered Agent bestellen, wechseln und abberufen und die gesetzlich vorgeschriebene Kontaktperson der Gesellschaft benennen — ${w.der} selbst oder eine von ${w.ihm} bestimmte Person aus dem Kreis der Gesellschafter (Member) oder der Geschäftsführung (Manager) — und ihre Angaben aktuell halten;`,
    `Post und Zustellungen: Schriftstücke, Bescheide und Zustellungen für ${w.den} und die Gesellschaft entgegennehmen und im Kundenportal bereitstellen;`,
    `Steuernummer der Gesellschaft (EIN): den Antrag (IRS Form SS-4) vorbereiten, nach der Unterschrift ${w.des} einreichen und dabei gegenüber dem Internal Revenue Service als Third Party Designee handeln, Auskünfte zum Antrag einholen und die Bestätigung entgegennehmen;`,
    "persönliche Steuernummer (ITIN): den Antrag (IRS Form W-7) vorbereiten, den Termin bei einem Certifying Acceptance Agent organisieren und ihm die Unterlagen übermitteln;",
    "laufende Pflichten der Gesellschaft: Jahresberichte (Annual Reports), Änderungsmeldungen und Verlängerungen einreichen, staatliche Gebühren entrichten und Bescheinigungen wie das Certificate of Good Standing sowie Apostillen beantragen;",
    `Auftritt der Gesellschaft: eine D-U-N-S-Nummer, Domains, E-Mail-Postfächer, Telefonnummern sowie Adress- und Postdienste auf den Namen der Gesellschaft oder ${w.des} beantragen, einrichten, verlängern und kündigen;`,
    `Steuern und Recht: FIAON beauftragt und koordiniert für ${w.den} zugelassene Partner (US-CPA, Steuerberater, Rechtsanwälte), die Steuererklärungen und -meldungen (z. B. Form 5472/1120) erstellen und einreichen sowie rechtliche Leistungen erbringen; FIAON übermittelt ihnen die Unterlagen, nimmt Ergebnisse entgegen und stellt sie im Portal bereit. Die Partner handeln im eigenen Mandat ${w.des}; ihre Honorare trägt FIAON im Rahmen des Vertrags;`,
    "Zusammenarbeit mit Partnern: mit dem Registered Agent, Acceptance Agents und den Partnern für Steuern und Recht in Verbindung treten und ihnen die erforderlichen Angaben und Unterlagen übermitteln;",
    `Anträge bei Instituten: Anträge bei Banken, Kartenherausgebern und Kapitalgebern vollständig vorbereiten und ${w.den} dabei begleiten; stellen und unterschreiben wird sie ${w.der} selbst.`,
  ];
}

/**
 * Die Ziffer als Absätze — für die Angebote (Absatz-Struktur) und, als HTML, für den Paketauftrag.
 * `nrVertrag`: wie der Text auf „diesen Vertrag“ verweist (Paketauftrag: „diesen Auftrag“).
 */
export function befugnisseAbsaetze(form: BefugnisseForm, opts: { vertragWort?: "Vertrag" | "Auftrag" } = {}): AngebotAbsatz[] {
  if (form === "en") return befugnisseAbsaetzeEn();
  const w = W[form];
  const vw = opts.vertragWort ?? "Vertrag";
  const dieses = vw === "Auftrag" ? "dieses Auftrags" : "dieses Vertrags";
  const desVertrags = vw === "Auftrag" ? "des Auftrags" : "des Vertrags";
  return [
    { art: "liste", einleitung: `${w.Der} beauftragt und bevollmächtigt FIAON, in ${w.seinem} Namen und — sobald sie besteht — im Namen ${w.seiner} US-Gesellschaft („Gesellschaft“) alle Erklärungen abzugeben und entgegenzunehmen und alle Handlungen vorzunehmen, die zur Durchführung ${dieses} erforderlich oder zweckmäßig sind, insbesondere:`, zeilen: umfangDe(w) },
    { art: "p", text: `Ausgenommen sind allein: die Eröffnung von Konten und jede Verfügung über Konten, Guthaben und sonstige Vermögenswerte ${w.des} oder der Gesellschaft; Anträge auf Kredite, Kreditkarten, Darlehen oder andere Finanzierungen und der Abschluss solcher Verträge sowie das Eingehen von Bürgschaften, Verpfändungen oder anderen Einstandspflichten für ${w.den} oder die Gesellschaft; die Übertragung oder Belastung von Gesellschaftsanteilen und die Auflösung der Gesellschaft ohne Weisung ${w.des} in Textform.` },
    { art: "p", text: `Verlangen das Gesetz oder die empfangende Stelle die persönliche Unterschrift ${w.des} — etwa unter einer Steuererklärung, die unter Strafandrohung abgegeben wird —, bereiten FIAON oder der Partner alles vollständig vor; ${w.der} unterschreibt nur.` },
    { art: "p", text: `FIAON darf Untervollmacht an eigene Mitarbeiter und an die Partner aus ihrem Partnernetz erteilen, soweit es die Durchführung ${desVertrags} erfordert, und wählt sie sorgfältig aus.` },
    { art: "p", text: `FIAON macht wesentliche Erklärungen, Eingänge und Bestätigungen im Kundenportal sichtbar. Verlangt eine Stelle einen besonderen Nachweis der Befugnis — etwa eine Vollmacht auf ihrem eigenen Formular —, wirkt ${w.der} unverzüglich mit.` },
    { art: "p", text: `Die Befugnisse gelten für die Dauer ${desVertrags}. ${w.Der} kann sie jederzeit in Textform widerrufen; bereits vorgenommene Handlungen bleiben wirksam. Nach dem Ende ${desVertrags} bleibt FIAON drei Monate lang berechtigt, die für eine geordnete Übergabe nötigen Erklärungen abzugeben, insbesondere Registered Agent und Kontaktperson zu übergeben und Dienste zu kündigen.` },
    { art: "p", text: `${w.Der} erteilt diese Befugnisse zugleich ${w.als} für die Gesellschaft.` },
  ];
}

function befugnisseAbsaetzeEn(): AngebotAbsatz[] {
  return [
    { art: "liste", einleitung: "The Client instructs and authorises FIAON, in the Client’s name and — once it exists — in the name of the Client’s US company (the “Company”), to make and receive all declarations and to take all actions that are necessary or useful to perform this engagement, in particular:", zeilen: [
      "formation: to check and reserve the Company’s name, to prepare the formation documents (Articles of Organization), to sign them as organizer, to file them with the state and to pay the related fees;",
      "registered agent and contact person: to appoint, change and remove a registered agent and to designate the Company’s statutory contact person — the Client or another member or manager designated by the Client — and to keep their details up to date;",
      "mail and service: to receive documents, notices and service for the Client and the Company and to make them available in the client portal;",
      "Employer Identification Number (EIN): to prepare the application (IRS Form SS-4), to file it after the Client has signed it, to act as Third Party Designee towards the Internal Revenue Service, to obtain information on the application and to receive the confirmation;",
      "Individual Taxpayer Identification Number (ITIN): to prepare the application (IRS Form W-7), to arrange the appointment with a Certifying Acceptance Agent and to transmit the documents to it;",
      "ongoing obligations of the Company: to file annual reports, amendments and renewals, to pay state fees and to request certificates such as the Certificate of Good Standing and apostilles;",
      "the Company’s presence: to apply for, set up, renew and cancel a D-U-N-S Number, domains, email accounts, phone numbers and address and mail services in the name of the Company or the Client;",
      "tax and legal matters: FIAON engages and coordinates licensed partners (US CPAs, tax advisers, attorneys) for the Client, who prepare and file tax returns and information returns (for example Form 5472/1120) and provide legal services; FIAON passes the documents to them, receives the results and makes them available in the portal. The partners act under the Client’s own engagement; FIAON pays their fees within the scope of this engagement;",
      "cooperation with partners: to liaise with the registered agent, acceptance agents and the tax and legal partners and to provide them with the information and documents required;",
      "applications to institutions: to prepare applications to banks, card issuers and capital providers in full and to accompany the Client; the Client files and signs them personally.",
    ] },
    { art: "p", text: "The only exceptions are: opening accounts and any disposal of accounts, balances or other assets of the Client or the Company; applying for credit, credit cards, loans or other financing and entering into such agreements, as well as entering into sureties, pledges or other credit support for the Client or the Company; transferring or encumbering membership interests and dissolving the Company without the Client’s instruction in text form." },
    { art: "p", text: "Where the law or the receiving body requires the Client’s personal signature — for example on a tax return made under penalty of perjury — FIAON or the partner prepares everything in full and the Client only signs." },
    { art: "p", text: "FIAON may grant sub-authority to its staff and to the partners from its partner network to the extent required to perform this engagement, selecting them with due care." },
    { art: "p", text: "FIAON makes material declarations, receipts and confirmations visible in the client portal. If a body requires special evidence of authority — such as a power of attorney on its own form — the Client cooperates without delay." },
    { art: "p", text: "This authority applies for the term of this engagement. The Client may revoke it at any time in text form; actions already taken remain valid. After the engagement has ended, FIAON remains authorised for three months to make the declarations required for an orderly handover, in particular to hand over the registered agent and the contact person and to cancel services." },
    { art: "p", text: "The Client also grants this authority as member and, where appointed, as manager on behalf of the Company." },
  ];
}

/** Die Ziffer als HTML (Paketauftrag) — dieselben Sätze, escaped vom Aufrufer gelieferten `e`. */
export function befugnisseHtml(form: BefugnisseForm, e: (s: string) => string, opts: { vertragWort?: "Vertrag" | "Auftrag" } = {}): string {
  return befugnisseAbsaetze(form, opts).map((a) => (a.art === "p"
    ? `<p>${e(a.text)}</p>`
    : `${a.einleitung ? `<p>${e(a.einleitung)}</p>` : ""}<ul>${a.zeilen.map((z) => `<li>${e(z)}</li>`).join("")}</ul>`)).join("");
}

/** Alle Sätze flach — für Prüfstände und Hashes. */
export function befugnisseSaetze(form: BefugnisseForm, opts: { vertragWort?: "Vertrag" | "Auftrag" } = {}): string[] {
  return befugnisseAbsaetze(form, opts).flatMap((a) => (a.art === "p" ? [a.text] : [a.einleitung ?? "", ...a.zeilen]));
}

// ── WELCHE VERTRÄGE TRAGEN DIE ZIFFER SCHON? ─────────────────────────────────
/** Der Tag aus einer Fassung: „2026-10-23“, „IA-KAPITAL-2026-10-23“, „IA-FIRMA-2026-10-08-D“ → YYYY-MM-DD (oder null). */
export function fassungTag(fassung: unknown): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(fassung ?? ""));
  return m ? m[1] : null;
}
/** Trägt ein angenommener Vertrag dieser Fassung die Ziffer „Befugnisse von FIAON“? Kooperationsverträge sind keine Kundenaufträge. */
export function vertragHatBefugnisse(fassung: unknown): boolean {
  const f = String(fassung ?? "").toUpperCase();
  if (!f || f.startsWith("IA-KOOP")) return false;
  const tag = fassungTag(f);
  return !!tag && tag >= BEFUGNISSE_AB;
}
/**
 * Braucht dieses Mandat die Ergänzung? Ja, wenn es einen angenommenen Vertrag hat und KEINER seiner angenommenen Verträge
 * (Auftrag `vertrag_version` und die angenommenen Angebote der Person) die Ziffer trägt.
 */
export function ergaenzungNoetig(lage: { vertragVersion: unknown; angenommen: boolean; weitereFassungen?: unknown[] }): boolean {
  if (!lage.angenommen) return false;
  const alle = [lage.vertragVersion, ...(lage.weitereFassungen ?? [])];
  return !alle.some(vertragHatBefugnisse);
}

// ── DIE ERGÄNZUNG FÜR BESTANDSKUNDEN (FIAON-CI, intern) ──────────────────────
export interface ErgaenzungDaten {
  sprache: "de" | "en";
  ref: string;
  /** Name des Auftraggebers (Person) bzw. der Firma. */
  kunde: string;
  /** Unterzeichner (natürliche Person) — der Name, der getippt werden muss. */
  unterzeichner: string;
  anschrift: string;
  /** Fassung des bisherigen Vertrags und der Tag seiner Annahme (YYYY-MM-DD). */
  vertragFassung: string;
  vertragAm: string | null;
  weiblich: boolean;
}
export const ERGAENZUNG_TITEL = {
  de: "Ergänzung zu Ihrem Auftrag – Ihre Befugnisse für FIAON",
  en: "Addendum to your engagement – your authority for FIAON",
} as const;
export const ERGAENZUNG_TEXT = {
  de: "Was FIAON für Sie und Ihre Gesellschaft erledigen darf — und was nicht. Sie bestätigen es hier einmal digital.",
  en: "What FIAON may handle for you and your company — and what not. You confirm it here once, digitally.",
} as const;
const tagText = (iso: string | null, s: "de" | "en") => {
  if (!iso) return "";
  const [j, m, t] = iso.slice(0, 10).split("-");
  return s === "en" ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : `${t}.${m}.${j}`;
};
/** Der Inhalt der Ergänzung: Kopf, Präambel, § 1 (die Ziffer, wörtlich), § 2 Geltung. */
export function ergaenzungInhalt(d: ErgaenzungDaten): { titel: string; unterzeile: string; parteien: string[]; praeambel: string; abschnitte: { titel: string; absaetze: AngebotAbsatz[] }[]; unterschriftRolle: string } {
  const en = d.sprache === "en";
  const form: BefugnisseForm = en ? "en" : d.weiblich ? "auftraggeberin" : "auftraggeber";
  const w = W[d.weiblich ? "auftraggeberin" : "auftraggeber"];
  const am = tagText(d.vertragAm, d.sprache);
  return en ? {
    titel: `Addendum to engagement ${d.ref} — Authority of FIAON`,
    unterzeile: `FIAON Global · Wording ${BEFUGNISSE_FASSUNG} · Engagement ${d.ref}`,
    parteien: [`FIAON LTD, 128 City Road, London EC1V 2NX, United Kingdom, Company No. 17318250 (“FIAON”)`, `${d.kunde}${d.anschrift ? `, ${d.anschrift}` : ""} (the “Client”)`],
    praeambel: `The Client and FIAON are parties to engagement ${d.ref}${am ? ` of ${am}` : ""} (version ${d.vertragFassung}, the “Engagement”). This addendum adds the following clause to the Engagement; in all other respects the Engagement remains unchanged.`,
    abschnitte: [
      { titel: `1 ${BEFUGNISSE_TITEL.en}`, absaetze: befugnisseAbsaetze(form) },
      { titel: "2 Effect", absaetze: [
        { art: "p", text: "This addendum takes effect when the Client signs it. It changes neither the fee nor the services of the Engagement. Amendments must be made in text form. The choice of law and jurisdiction of the Engagement apply to this addendum." },
      ] },
    ],
    unterschriftRolle: "Client",
  } : {
    titel: `Ergänzung zum Auftrag ${d.ref} — Befugnisse von FIAON`,
    unterzeile: `FIAON Global · Fassung ${BEFUGNISSE_FASSUNG} · Auftrag ${d.ref}`,
    parteien: [`FIAON LTD, 128 City Road, London EC1V 2NX, Vereinigtes Königreich, Company No. 17318250 („FIAON“)`, `${d.kunde}${d.anschrift ? `, ${d.anschrift}` : ""} („${d.weiblich ? "Auftraggeberin" : "Auftraggeber"}“)`],
    praeambel: `${w.Der} und FIAON verbindet der Auftrag ${d.ref}${am ? ` vom ${am}` : ""} (Fassung ${d.vertragFassung}, „Vertrag“). Diese Ergänzung fügt dem Vertrag die folgende Regelung hinzu; im Übrigen gilt der Vertrag unverändert.`,
    abschnitte: [
      { titel: `§ 1 ${BEFUGNISSE_TITEL.de}`, absaetze: befugnisseAbsaetze(form) },
      { titel: "§ 2 Geltung", absaetze: [
        { art: "p", text: `Die Ergänzung gilt, sobald ${w.der} sie unterschreibt. Sie ändert weder Vergütung noch Leistungen des Vertrags. Änderungen bedürfen der Textform. Für die Ergänzung gelten Rechtswahl und Gerichtsstand des Vertrags.` },
      ] },
    ],
    unterschriftRolle: d.weiblich ? "Auftraggeberin" : "Auftraggeber",
  };
}
