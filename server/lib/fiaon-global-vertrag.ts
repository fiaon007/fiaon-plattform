// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER AUFTRAG ALS TEXT UND ALS PDF (17.09.2026, E-188)
//
// Justin: „Direktkauf: Vertrag, Rechnung, Zahlung aufs Bankkonto = Start."
//
// ── EINE QUELLE, ZWEI AUSGABEN ────────────────────────────────────────────
// Der Kunde liest den Auftrag auf /business/start, BEVOR er unterschreibt
// (POST /api/fiaon/global/vertrag/vorschau), und bekommt ihn danach als PDF.
// Beides entsteht aus `vertragsRumpf()` — derselbe Text, dieselben Ziffern.
// Ein Vertrag, der auf dem Bildschirm anders lautet als im PDF, wäre im
// Streitfall zwei Verträge.
//
// ── WOHER DIE SÄTZE KOMMEN ────────────────────────────────────────────────
//   · Leistungen, Planungsgröße, Dauer, Pflichthinweise, Rollen, Geld-zurück:
//     shared/fiaon-global.ts — wörtlich. Ändert sich dort ein Satz, ändert er
//     sich hier; GLOBAL_VERTRAG_VERSION wird dann hochgezählt.
//   · Preis: shared/fiaon-pakete.ts (Katalog) — nie eine Zahl im Text.
//   · Pflichtangaben der FIAON LTD: FIAON_ENTITY (server/fiaon-invoice.ts) —
//     dieselben wie auf jeder Rechnung und im Impressum.
//   · Rechtswahl und Gerichtsstand: § 12 der AGB des Hauses
//     (client/src/pages/agb.tsx) — deutsches Recht ohne UN-Kaufrecht,
//     Gerichtsstand München für Kaufleute. Dort steht „LEGAL REVIEW REQUIRED";
//     das gilt für diesen Text genauso (E-188: Anwalt prüft den Vertragstext).
//
// ── DIE WORTWAHL ──────────────────────────────────────────────────────────
// Jeder deutsche Satz passiert shared/fiaon-wortverbote.ts (Prüfstand:
// scripts/pruef-global-vertrag.ts). Über Konto, Karte, Rahmen und Darlehen
// entscheidet das Institut; der Dollar-Wert ist die Planungsgröße des
// AUFTRAGGEBERS. Zugesagt wird nur die eigene Leistung.
//
// Diese Datei fasst keine Datenbank an — der Prüfstand lädt sie ohne Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml, wrapFiaonDocument, htmlZuPdfMitFusszeile } from "./fiaon-html-pdf";
import { FIAON_ENTITY } from "../fiaon-invoice";
import { paketPreisCents } from "@shared/fiaon-pakete";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_VERTRAG_VERSION,
  globalPaket, globalPlanungText, type GlobalSchluessel,
} from "@shared/fiaon-global";

export type VertragSprache = "de" | "en";

export interface VertragFirma {
  name: string; rechtsform: string;
  registergericht?: string | null; registernummer?: string | null;
  strasse: string; plz: string; ort: string; land: string;
  ustId?: string | null;
}
export interface VertragPerson { anrede?: string | null; vorname: string; nachname: string; funktion: string }
export interface VertragUnterschrift { png: string; am: Date; ip: string; hash: string }

export interface GlobalVertragDaten {
  paket: GlobalSchluessel;
  sprache: VertragSprache;
  firma: VertragFirma;
  ansprechpartner: VertragPerson;
  /** Die Antragsnummer — steht in Unterzeile und Fußzeile. In der Vorschau gibt es sie noch nicht. */
  ref?: string | null;
  /** Fehlt sie, ist es die Fassung VOR der Unterschrift. */
  unterschrift?: VertragUnterschrift | null;
}

/** Die zwölf Ziffern, die kein Auftrag verlieren darf — der Prüfstand zählt sie nach. */
export const GLOBAL_VERTRAG_ZIFFERN: Record<VertragSprache, string[]> = {
  de: [
    "Parteien", "Gegenstand und Leistungen", "Was nicht Teil des Auftrags ist", "Mitwirkung des Auftraggebers",
    "Vergütung", GLOBAL_GELD_ZURUECK.de.titel, "Pflichthinweise", "Dauer und Beendigung", "Haftung",
    "Vertraulichkeit und Datenschutz", "Unternehmer-Bestätigung", "Schlussbestimmungen",
  ],
  en: [
    "Parties", "Subject matter and services", "What is not part of this engagement", "Cooperation of the client",
    "Fee", GLOBAL_GELD_ZURUECK.en.titel, "Mandatory notices", "Term and termination", "Liability",
    "Confidentiality and data protection", "Business confirmation", "Final provisions",
  ],
};

const LAND_NAME: Record<VertragSprache, Record<string, string>> = {
  de: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" },
  en: { DE: "Germany", AT: "Austria", CH: "Switzerland" },
};

const VORGAENGER: Partial<Record<GlobalSchluessel, GlobalSchluessel>> = {
  global_banking: "global_struktur", global_kapital: "global_banking", global_vip: "global_kapital",
};

/**
 * Die Leistungen eines Pakets, vollständig ausgeschrieben.
 *
 * Auf der Seite steht „Alles aus Global Struktur" — als Tafel ist das richtig,
 * in einem Vertrag nicht: Dort muss stehen, WAS geschuldet ist, ohne dass der
 * Auftraggeber eine zweite Tafel danebenlegen muss.
 */
export function globalLeistungenVollstaendig(key: GlobalSchluessel, sprache: VertragSprache): string[] {
  const p = globalPaket(key);
  if (!p) return [];
  const eigene = p[sprache].leistungen.filter((l) => !/^(Alles aus|Everything in) /i.test(l));
  const vor = VORGAENGER[key];
  return vor ? [...globalLeistungenVollstaendig(vor, sprache), ...eigene] : eigene;
}

/** „2.499,00 €" bzw. „€2,499.00" — aus dem Katalog, mit Cent, wie auf der Rechnung. */
export function globalVertragPreis(key: GlobalSchluessel, sprache: VertragSprache): string {
  const euro = paketPreisCents(key) / 100;
  return sprache === "en"
    ? "€" + euro.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : euro.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function globalVertragTitel(key: GlobalSchluessel, sprache: VertragSprache): string {
  const p = globalPaket(key);
  const name = p ? p[sprache].name : String(key);
  return sprache === "en"
    ? `Engagement for setting up a US corporate structure — FIAON ${name}`
    : `Auftrag über den Aufbau einer US-Unternehmensstruktur — FIAON ${name}`;
}

export function globalVertragUnterzeile(d: Pick<GlobalVertragDaten, "sprache" | "ref">): string {
  const teile = d.sprache === "en"
    ? [`Contract version ${GLOBAL_VERTRAG_VERSION}`, d.ref ? `Order ${d.ref}` : null]
    : [`Vertragsversion ${GLOBAL_VERTRAG_VERSION}`, d.ref ? `Auftrag ${d.ref}` : null];
  return teile.filter(Boolean).join(" · ");
}

function tagText(am: Date, sprache: VertragSprache): string {
  return sprache === "en"
    ? am.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })
    : am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}
function zeitText(am: Date, sprache: VertragSprache): string {
  const zeit = am.toLocaleTimeString(sprache === "en" ? "en-GB" : "de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return sprache === "en" ? `${tagText(am, sprache)} at ${zeit} (Europe/Berlin)` : `${tagText(am, sprache)} um ${zeit} Uhr (Europe/Berlin)`;
}

const e = escapeHtml;

function parteien(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const f = d.firma; const a = d.ansprechpartner;
  const land = LAND_NAME[d.sprache][String(f.land || "").toUpperCase()] ?? String(f.land || "");
  const register = [f.registergericht, f.registernummer].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  // „vertreten durch Herrn …" — der Akkusativ; im Englischen Mr/Ms.
  const anrede = en
    ? ({ Herr: "Mr", Frau: "Ms" } as Record<string, string>)[String(a.anrede || "")] ?? ""
    : a.anrede === "Herr" ? "Herrn" : a.anrede;
  const vertreter = [anrede, a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const fiaon = en
    ? `<b>${e(FIAON_ENTITY.name)}</b>, ${e(FIAON_ENTITY.addressLine1)}, ${e(FIAON_ENTITY.addressLine2)}, ${e(FIAON_ENTITY.country)}, registered at Companies House (England and Wales) under Company No. ${e(FIAON_ENTITY.companyNo)}, represented by its Director ${e(FIAON_ENTITY.director)}, e-mail ${e(FIAON_ENTITY.email)} — hereinafter “FIAON”.`
    : `<b>${e(FIAON_ENTITY.name)}</b>, ${e(FIAON_ENTITY.addressLine1)}, ${e(FIAON_ENTITY.addressLine2)}, ${e(FIAON_ENTITY.country)}, eingetragen im Companies House (England and Wales) unter der Company No. ${e(FIAON_ENTITY.companyNo)}, vertreten durch den Director ${e(FIAON_ENTITY.director)}, E-Mail ${e(FIAON_ENTITY.email)} — nachfolgend „FIAON“.`;
  const kunde = en
    ? `<b>${e(f.name)}</b> (${e(f.rechtsform)})${register ? `, registered at ${e(register)}` : ""}, ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)}${f.ustId ? `, VAT ID ${e(f.ustId)}` : ""}, represented by ${e(vertreter)}, ${e(a.funktion)} — hereinafter the “Client”.`
    : `<b>${e(f.name)}</b> (${e(f.rechtsform)})${register ? `, eingetragen: ${e(register)}` : ""}, ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)}${f.ustId ? `, USt-IdNr. ${e(f.ustId)}` : ""}, vertreten durch ${e(vertreter)}, ${e(a.funktion)} — nachfolgend „Auftraggeber“.`;
  return `<p>${fiaon}</p><p>${kunde}</p>`;
}

function unterschriftsBlock(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const a = d.ansprechpartner; const u = d.unterschrift ?? null;
  const name = [a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const bild = u
    ? `<img class="sig-img" src="${e(u.png)}" alt="${en ? "Signature" : "Unterschrift"}" />`
    : `<span class="gv-leise">${en ? "To be signed electronically." : "Wird elektronisch unterschrieben."}</span>`;
  const ortDatum = u ? `${e(d.firma.ort)}, ${e(tagText(u.am, d.sprache))}` : "—";
  const meta = u
    ? (en
      ? `Signed electronically by ${e(name)} on ${e(zeitText(u.am, "en"))}<br/>IP address: ${e(u.ip || "—")}<br/>Document hash (SHA-256): <span class="hash">${e(u.hash)}</span>`
      : `Elektronisch unterschrieben von ${e(name)} am ${e(zeitText(u.am, "de"))}<br/>IP-Adresse: ${e(u.ip || "—")}<br/>Dokument-Hash (SHA-256): <span class="hash">${e(u.hash)}</span>`)
    : "";
  return `
  <div class="sig-grid gv-sig">
    <div class="sig-col">
      <div class="gv-sig-kopf">${en ? "For FIAON" : "Für FIAON"}</div>
      <div class="gv-sig-feld">${en ? "FIAON LTD — executed electronically" : "FIAON LTD — elektronisch ausgefertigt"}</div>
      <div class="sig-line">${e(FIAON_ENTITY.director)}, Director</div>
    </div>
    <div class="sig-col">
      <div class="gv-sig-kopf">${en ? "For the Client" : "Für den Auftraggeber"}</div>
      <div class="gv-sig-feld">${bild}</div>
      <div class="sig-line">${e(name)}, ${e(a.funktion)}<br/>${en ? "Place, date" : "Ort, Datum"}: ${ortDatum}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
    </div>
  </div>`;
}

/** Die zwölf Ziffern — der eine Text für Bildschirm und PDF. */
function vertragsRumpf(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const p = globalPaket(d.paket);
  if (!p) throw new Error(`Unbekanntes Global-Paket: ${d.paket}`);
  const t = p[d.sprache];
  const titel = GLOBAL_VERTRAG_ZIFFERN[d.sprache];
  const preis = globalVertragPreis(d.paket, d.sprache);
  const planung = globalPlanungText(d.paket, d.sprache);
  const rollen = GLOBAL_ROLLEN[d.sprache];
  const leistungen = globalLeistungenVollstaendig(d.paket, d.sprache);
  const liste = (zeilen: readonly string[]) => `<ul>${zeilen.map((z) => `<li>${e(z)}</li>`).join("")}</ul>`;

  const ziffern: (string | null)[] = [
    // 1 — Parteien
    parteien(d),

    // 2 — Gegenstand und Leistungen
    (en
      ? `<p>FIAON supports the Client in setting up a US corporate structure within the scope of the package <b>FIAON ${e(t.name)}</b>. The package comprises:</p>`
      : `<p>FIAON begleitet den Auftraggeber beim Aufbau einer US-Unternehmensstruktur im Umfang des Pakets <b>FIAON ${e(t.name)}</b>. Das Paket umfasst:</p>`)
      + liste(leistungen)
      + `<p>${e(rollen.fiaon)}</p>`
      + (en
        ? `<p class="gv-kasten">The Client is aiming for a limit of around ${e(planung)}; the duration and depth of the support are based on this. The institution concerned alone decides on the account, the card, the limit and any loan; no particular result is owed.</p>`
        : `<p class="gv-kasten">Der Auftraggeber strebt einen Rahmen von rund ${e(planung)} an; danach richten sich Dauer und Tiefe der Begleitung. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut; ein bestimmtes Ergebnis ist nicht geschuldet.</p>`),

    // 3 — Was nicht Teil des Auftrags ist
    (en
      ? `<p>Tax and legal questions are answered by tax advisers and lawyers under their own engagement with the Client. ${e(rollen.partner)}</p>`
        + `<p>FIAON is neither a bank nor a lender, does not accept client funds and has no authority over the Client’s accounts. The Client enters into contracts with institutions itself.</p>`
      : `<p>Steuerliche und rechtliche Fragen beantworten Steuerberater und Anwälte auf eigenes Mandat des Auftraggebers. ${e(rollen.partner)}</p>`
        + `<p>FIAON ist keine Bank und kein Kreditgeber, nimmt keine Kundengelder entgegen und verfügt nicht über Konten des Auftraggebers. Verträge mit Instituten schließt der Auftraggeber selbst.</p>`),

    // 4 — Mitwirkung des Auftraggebers
    (en
      ? `<p>The Client provides complete and truthful information and supplies the documents required. Applications to authorities and institutions are made by the Client in its own name; FIAON prepares them. The Client does not give false address or residence details to institutions or authorities. If the Client’s cooperation is delayed, agreed dates move accordingly.</p>`
      : `<p>Der Auftraggeber macht vollständige und wahre Angaben und stellt die benötigten Unterlagen bereit. Anträge bei Behörden und Instituten stellt der Auftraggeber im eigenen Namen; FIAON bereitet sie vor. Gegenüber Instituten und Behörden macht der Auftraggeber keine falschen Adress- oder Wohnsitzangaben. Verzögert sich die Mitwirkung, verschieben sich vereinbarte Termine entsprechend.</p>`),

    // 5 — Vergütung
    (en
      ? `<p>The package price is a one-off fee of <b>${e(preis)}</b>. It is payable in advance by bank transfer to the account stated on the invoice; the Client receives the invoice together with this engagement. FIAON starts work once payment has been received.</p>`
        + `<p>${e(rollen.kosten)}</p>`
        + `<p>The VAT treatment is shown on the invoice; where the Client owes the VAT as the recipient of the service (reverse charge), the invoice says so.</p>`
      : `<p>Der Paketpreis beträgt einmalig <b>${e(preis)}</b>. Er ist im Voraus per Überweisung auf das in der Rechnung genannte Konto zu zahlen; die Rechnung erhält der Auftraggeber zusammen mit diesem Auftrag. FIAON beginnt mit dem Zahlungseingang.</p>`
        + `<p>${e(rollen.kosten)}</p>`
        + `<p>Die umsatzsteuerliche Behandlung ergibt sich aus der Rechnung; schuldet der Auftraggeber die Umsatzsteuer als Leistungsempfänger (Reverse Charge), weist die Rechnung darauf hin.</p>`),

    // 6 — Geld zurück (nur, solange der Schalter in shared/fiaon-global.ts an ist)
    GLOBAL_GELD_ZURUECK.aktiv
      ? `<p>${e(GLOBAL_GELD_ZURUECK[d.sprache].text)}</p><p>${e(GLOBAL_GELD_ZURUECK[d.sprache].bedingungen)}</p>`
        + (en
          ? `<p>FIAON and the Client set this date together at the start; FIAON records it in the order file and communicates it to the Client in text form. The refund covers the package price; this commitment gives rise to no further claims.</p>`
          : `<p>Den Stichtag legen FIAON und der Auftraggeber beim Start gemeinsam fest; FIAON hält ihn in der Auftragsakte fest und teilt ihn dem Auftraggeber in Textform mit. Die Erstattung umfasst den Paketpreis; weitergehende Ansprüche aus dieser Zusage bestehen nicht.</p>`)
      : null,

    // 7 — Pflichthinweise (wörtlich)
    liste(GLOBAL_PFLICHTHINWEIS[d.sprache]),

    // 8 — Dauer und Beendigung
    (en
      ? `<p>${e(t.dauer)}. This is an empirical value, not a deadline. The engagement ends once the services under clause 2 have been provided.</p>`
        + `<p>Either party may end the engagement at any time in text form. Services already provided are not refunded; clause 6 remains unaffected. The right to terminate for good cause remains.</p>`
      : `<p>${e(t.dauer)}. Diese Angabe ist ein Erfahrungswert und keine Frist. Der Auftrag endet, wenn die Leistungen nach Ziffer 2 erbracht sind.</p>`
        + `<p>Jede Partei kann den Auftrag jederzeit in Textform beenden. Bereits erbrachte Leistungen werden nicht erstattet; Ziffer 6 bleibt unberührt. Das Recht zur Beendigung aus wichtigem Grund bleibt bestehen.</p>`),

    // 9 — Haftung
    (en
      ? `<p>FIAON is liable without limitation for intent and gross negligence and for injury to life, body or health. Otherwise FIAON is liable only for the breach of essential contractual duties, limited in amount to the package price. FIAON is not liable for decisions of third parties — in particular authorities, banks, card issuers, tax advisers and lawyers.</p>`
      : `<p>FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet FIAON nur bei der Verletzung wesentlicher Vertragspflichten und der Höhe nach begrenzt auf den Paketpreis. Für Entscheidungen Dritter — insbesondere von Behörden, Banken, Kartenherausgebern, Steuerberatern und Anwälten — haftet FIAON nicht.</p>`),

    // 10 — Vertraulichkeit und Datenschutz
    (en
      ? `<p>Both parties treat non-public information of the other party as confidential. FIAON processes personal data in accordance with its privacy policy at fiaon.com/datenschutz. Where the service requires it, FIAON passes documents to authorities, to the registered agent and to the tax advisers and lawyers engaged by the Client.</p>`
      : `<p>Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich. FIAON verarbeitet personenbezogene Daten nach der Datenschutzerklärung unter fiaon.com/datenschutz. Soweit es die Leistung erfordert, gibt FIAON Unterlagen an Behörden, an den Registered Agent und an die vom Auftraggeber mandatierten Steuerberater und Anwälte weiter.</p>`),

    // 11 — Unternehmer-Bestätigung
    (en
      ? `<p>The Client confirms that it is acting in the course of its trade, business or profession when placing this order (entrepreneur within the meaning of section 14 of the German Civil Code). A consumer right of withdrawal therefore does not apply. The signatory confirms that he or she is authorised to represent the Client.</p>`
      : `<p>Der Auftraggeber erklärt, bei Abschluss dieses Auftrags in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit zu handeln (Unternehmer im Sinne von § 14 BGB). Ein Widerrufsrecht für Verbraucher besteht deshalb nicht. Der Unterzeichner erklärt, zur Vertretung des Auftraggebers berechtigt zu sein.</p>`),

    // 12 — Schlussbestimmungen (Rechtswahl und Gerichtsstand wie § 12 der AGB des Hauses)
    (en
      ? `<p>Amendments and additions must be made in text form. The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods. If the Client is a merchant, a legal entity under public law or a special fund under public law, the exclusive place of jurisdiction for all disputes arising from this engagement is Munich. Should individual provisions be or become invalid, the validity of the remainder is not affected; the statutory provisions apply in place of the invalid provision.</p>`
      : `<p>Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der Auftraggeber Kaufmann, eine juristische Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Auftrag München. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>`),
  ];

  // Fällt Ziffer 6 weg (Schalter aus), rücken die folgenden auf — im Text UND in der Zählung.
  let nr = 0;
  const abschnitte = ziffern.map((inhalt, i) => {
    if (inhalt == null) return "";
    nr++;
    // Überschrift und erster Absatz bleiben im Druck beisammen (.gv-anfang) — keine Überschrift
    // allein am Seitenende. Der Rest darf umbrechen: Die Leistungsliste des VIP-Pakets ist
    // länger als der Platz, der auf Seite 1 bleibt.
    const bloecke = inhalt.match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [inhalt];
    return `<section class="gv-ziffer"><div class="gv-anfang"><h2><span class="gv-nr">${nr}</span>${e(titel[i])}</h2>${bloecke[0]}</div>${bloecke.slice(1).join("")}</section>`;
  }).filter(Boolean);
  // Die Unterschrift steht nie allein auf einer Seite: Die letzte Ziffer und der
  // Unterschriftsblock bleiben im Druck zusammen (.gv-schluss).
  const letzte = abschnitte.pop() ?? "";
  return `${abschnitte.join("\n")}\n<div class="gv-schluss">${letzte}${unterschriftsBlock(d)}</div>`;
}

/** Regeln, die nur innerhalb von .gv greifen — gefahrlos auf jeder Seite einsetzbar. */
export const GLOBAL_VERTRAG_CSS = `
  .gv { font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 300; color: #0f2044; line-height: 1.6; }
  .gv .gv-titel { font-size: 1.35em; font-weight: 300; letter-spacing: -.01em; margin: 0 0 4px; color: #0f2044; line-height: 1.25; }
  .gv .gv-unterzeile { font-size: .85em; color: #64748b; margin: 0 0 18px; }
  .gv h2 { font-size: 1em; font-weight: 500; letter-spacing: .01em; color: #0f2044; margin: 20px 0 6px; break-after: avoid; }
  /* Überschrift und erster Absatz bleiben im Druck beisammen — keine Überschrift allein am Seitenende. */
  .gv .gv-anfang, .gv .gv-kasten, .gv .gv-schluss { break-inside: avoid; page-break-inside: avoid; }
  .gv p, .gv li { orphans: 2; widows: 2; }
  .gv .gv-nr { display: inline-block; min-width: 1.6em; color: #1d4ed8; font-weight: 400; }
  .gv p { margin: 0 0 8px; text-align: left; font-weight: 300; }
  .gv b { font-weight: 500; }
  .gv ul { margin: 4px 0 10px; padding-left: 1.2em; }
  .gv li { margin: 2px 0; }
  .gv .gv-kasten { border: 1px solid #dbe4f0; border-radius: 6px; padding: 10px 12px; background: #f7f9fc; }
  .gv .gv-leise { color: #64748b; font-size: .9em; }
  .gv .gv-sig { display: flex; gap: 28px; margin-top: 28px; page-break-inside: avoid; }
  .gv .gv-sig .sig-col { flex: 1; }
  .gv .gv-sig-kopf { font-weight: 500; font-size: .9em; }
  .gv .gv-sig-feld { min-height: 74px; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .gv .gv-sig .sig-line { border-top: 1px solid #0f2044; padding-top: 4px; font-size: .82em; color: #475569; margin-top: 0; }
  .gv .gv-sig .sig-img { max-height: 70px; max-width: 240px; }
  .gv .gv-sig .meta { font-size: .75em; color: #64748b; margin-top: 4px; }
  .gv .gv-sig .hash { font-family: "Courier New", monospace; font-size: .9em; word-break: break-all; color: #94a3b8; }
`;

/** Was nur das PDF betrifft: Kopf und Titel des Hausdokuments beruhigen, feste Fußzeile weg (sie läuft über die Druckvorlage). */
const PDF_CSS = `
  body { font-weight: 300; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 16pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; }
  footer.doc { display: none; }
  ${GLOBAL_VERTRAG_CSS}
`;

/**
 * Der Auftrag als HTML-Fragment für den Bildschirm — mit Titel, ohne Rahmen.
 * Exakt der Rumpf, der auch ins PDF geht.
 */
export function globalVertragVorschauHtml(d: GlobalVertragDaten): string {
  return `<style>${GLOBAL_VERTRAG_CSS}</style>
<div class="gv" lang="${d.sprache}">
  <h1 class="gv-titel">${e(globalVertragTitel(d.paket, d.sprache))}</h1>
  <p class="gv-unterzeile">${e(globalVertragUnterzeile(d))}</p>
  ${vertragsRumpf(d)}
</div>`;
}

/** Der Rumpf allein — für das PDF und für den Dokument-Hash (ohne Unterschrift gerechnet). */
export function globalVertragRumpfHtml(d: GlobalVertragDaten): string {
  return `<div class="gv" lang="${d.sprache}">${vertragsRumpf(d)}</div>`;
}

/** Reiner Text — für den Prüfstand und die Wortwand. */
export function globalVertragText(d: GlobalVertragDaten): string {
  return `${globalVertragTitel(d.paket, d.sprache)}\n${vertragsRumpf(d)}`
    .replace(/<\/(p|li|h2|section|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** Das PDF im FIAON-CI: dünne Schrift, Navy, laufende Fußzeile mit Version, Auftragsnummer und Seitenzahl. */
export async function globalVertragPdf(d: GlobalVertragDaten): Promise<Buffer> {
  const titel = globalVertragTitel(d.paket, d.sprache);
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: globalVertragUnterzeile(d),
    bodyHtml: globalVertragRumpfHtml(d),
    markenzeile: `${FIAON_ENTITY.name} · Company No. ${FIAON_ENTITY.companyNo} · ${FIAON_ENTITY.addressLine1}, ${FIAON_ENTITY.addressLine2}, ${FIAON_ENTITY.country}`,
    zusatzCss: PDF_CSS,
  });
  const fuss = [
    `${FIAON_ENTITY.name} · Company No. ${FIAON_ENTITY.companyNo}`,
    d.sprache === "en" ? `Contract version ${GLOBAL_VERTRAG_VERSION}` : `Vertragsversion ${GLOBAL_VERTRAG_VERSION}`,
    d.ref ? (d.sprache === "en" ? `Order ${d.ref}` : `Auftrag ${d.ref}`) : null,
  ].filter(Boolean).join(" · ");
  return htmlZuPdfMitFusszeile({
    html, fusszeile: fuss, titel,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
    // Der englische Auftrag zählt seine Seiten englisch: „Page 1 of 3".
    sprache: d.sprache,
  });
}

/** Alle vier Schlüssel — für Prüfstand und Routen. */
export const GLOBAL_VERTRAG_PAKETE: GlobalSchluessel[] = GLOBAL_PAKETE.map((p) => p.key);
