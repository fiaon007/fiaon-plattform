// ═══════════════════════════════════════════════════════════════════════════
// MARA ÄNDERT ANSCHRIFT, E-MAIL UND TELEFON SELBST — angaben_aendern (E-401 4/6, 19.10.2026)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Bisher wurde „Ich bin umgezogen, meine neue Adresse …“ eine Aufgabe an einen Menschen (Postfach: aufgabe_an_betreuer,
// Fall 4 „Datenänderung, für die du kein Werkzeug hast“). Jetzt erledigt der SERVER die sicheren Fälle selbst, bevor
// Mara schreibt (wie zahlung_suchen) — für die Mail (fiaon-postmeister-agent.ts) und WhatsApp (fiaon-whatsapp-mara.ts):
//
//   1. Erkennen (rein, shared/fiaon-angaben-aendern.ts): welches Feld, welcher neue Wert, plausibel?
//   2. Absender prüfen: Nur eine Mail von einer GESPEICHERTEN Adresse (Person oder lebende Bestellung, Gmail-Grundform)
//      bzw. eine WhatsApp von einer GESPEICHERTEN Nummer ändert etwas. Sonst: nichts geändert, freundlich auf den
//      Kundenbereich (fiaon.com/app/mehr/daten) oder den bekannten Absender verwiesen.
//   3. Handeln — über den EINEN Speicherweg der Akte (updateCustomerContact, fiaon-agent.ts: Bestellung + Person,
//      alter Wert als Alias, phone_key9, je Feld ein Verlaufseintrag „alt → neu“):
//        · Anschrift: sofort, nur die Felder, die sich ändern (+ Land, wenn er eins nennt).
//        · Telefon: sofort (Mail vom gespeicherten Absender bzw. WhatsApp von der gespeicherten Nummer) + Hinweis-Mail an
//          die gespeicherte Adresse. Ein Nummernwechsel per WhatsApp von einer ANDEREN Nummer: nichts geändert, Justin
//          bekommt eine Karte (die Leitung entscheidet).
//        · E-Mail: NICHT sofort. Ein signierter Einmal-Link mit Ablauf (48 Stunden) geht an die NEUE Adresse, ein Hinweis
//          an die bisherige; erst der Klick ändert sie (server/routes/fiaon-angaben.ts → emailBestaetigen).
//        · Name, Geburtsdatum, Bankverbindung, Ausweisdaten: NIE durch Mara — ein Mensch, wie bisher.
//      Dazu ein Vermerk in der Akte (einmal je Nachricht) und eine Zeile je Feld in fiaon_mara_angaben (auch für die
//      Wiederholung derselben Nachricht: dann wird nichts zweimal getan).
//   4. Sagen: der Hinweis für Maras Auftrag und der eine Satz; die Antwortprüfung (angabenAntwortFunde) hält jedes
//      „geändert“, das nicht stimmt.
//
// Nie bei Global-Kunden (E-272: raus aus Privat-Abläufen — dann bleibt alles wie bisher). Testpersonen: gerechnet,
// nichts geschrieben, nichts verschickt.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import {
  angabenErkennen, angabenWunsch, angabenHinweis, absenderEcht, angabenSatz, angabenMenschNoetig, anschriftSchluessel, anschriftText,
  bestaetigungsMail, hinweisAlteMail, hinweisTelefonMail, landNorm, mailGleich, mailMaske, mailPlausibel, nummerGleich, waNummerGleich, telefonMaske,
  telefonText, LINK_STUNDEN,
  type Anschrift, type AngabeFeld, type AngabenKanal, type AngabenLageRein, type FeldErgebnis, type FeldStand, type FeldWunsch,
} from "@shared/fiaon-angaben-aendern";

type Lauf = typeof sqlPool;

/** Was der Server Mara, der Akte und der Antwortprüfung mitgibt. */
export interface AngabenLage extends AngabenLageRein {
  hinweis: string;
  satz: string;
  /** Für die Handlungsliste der Postmeister-Zeile bzw. das WhatsApp-Protokoll. */
  handlung: string;
  /** werkzeugDaten.angaben_aendern (Belegprüfung). */
  daten: { felder: { feld: AngabeFeld; stand: FeldStand; nachher: string | null }[]; satz: string };
  /** Ein Mensch muss ran (Name/Geburtsdatum/Bank/Ausweis, Nummernwechsel per WhatsApp, vergebene Adresse, Ausland, Fehler). */
  mensch: boolean;
  menschGrund: string | null;
  absenderOk: boolean;
  test: boolean;
  /** Diese Nachricht war schon bearbeitet — nichts wurde erneut getan. */
  wiederholt: boolean;
}

/** Will er etwas ändern? (rein, vor jedem Lesen) */
export function angabenAendernNoetig(text: string | null | undefined): boolean {
  return angabenWunsch(String(text ?? ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLE — je Nachricht und Feld eine Zeile; die E-Mail-Zeile trägt den Link
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function angabenTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_mara_angaben (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER NOT NULL,
          ref TEXT,
          kanal TEXT NOT NULL,
          quelle TEXT NOT NULL,
          feld TEXT NOT NULL,
          stand TEXT NOT NULL,
          vorher TEXT,
          nachher TEXT,
          grund TEXT,
          ablauf_am TIMESTAMPTZ,
          bestaetigt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (quelle, feld)
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_mara_angaben_person ON fiaon_mara_angaben (person_id, feld, created_at DESC)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN — was gespeichert ist
// ═══════════════════════════════════════════════════════════════════════════
export interface Gespeichert {
  personId: number;
  ref: string;
  name: string | null;
  test: boolean;
  land: string | null;
  anschrift: Partial<Anschrift>;
  email: string | null;
  telefon: string | null;
  /** Alle gespeicherten Adressen (Person + lebende Bestellungen) — der „bekannte Absender“. */
  mails: string[];
  /** Alle gespeicherten Nummern (Person + lebende Bestellungen). */
  nummern: string[];
}

/** Die Absenderadresse aus „Name <a@b.de>“ oder „a@b.de“. Rein. */
export function adresseAus(von: string | null | undefined): string {
  const t = String(von ?? "").toLowerCase();
  return (t.match(/<([^>]+)>/)?.[1] ?? t).trim();
}

export async function gespeichertLesen(personId: number, lauf: Lauf = sqlPool): Promise<Gespeichert | null> {
  const [p] = (await lauf`
    SELECT id, first_name, last_name, primary_email, primary_phone, street, zip, city, country, ist_test_am, merged_into_person_id
      FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [])) as any[];
  if (!p || p.merged_into_person_id) return null;
  const apps = (await lauf`
    SELECT ref, email, contact_email, billing_email, phone, phone_country_code, contact_phone, street, zip, city, country,
           payment_status, archived_at, COALESCE(ist_entwurf, FALSE) AS entwurf, COALESCE(pack_key, '') AS pack_key, created_at
      FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL`.catch(() => [])) as any[];
  // Dieselbe Bestellung wie die Akte und angaben_eintragen (lebend, nicht archiviert, kein Entwurf, keine Auskunft, kein
  // Global-Auftrag; bezahlt zuerst, dann die neueste).
  const haupt = apps
    .filter((a) => !a.archived_at && !a.entwurf && !String(a.ref).startsWith("FIAON-SCHUFA-") && !String(a.pack_key).startsWith("global"))
    .sort((a, b) => Number(b.payment_status === "paid") - Number(a.payment_status === "paid") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!haupt) return null;
  const tel = (a: any) => {
    const roh = String(a.phone ?? "").trim();
    if (!roh) return String(a.contact_phone ?? "").trim() || null;
    return roh.startsWith("+") ? roh : `${String(a.phone_country_code ?? "").trim()}${roh}`;
  };
  const leer = (x: unknown) => String(x ?? "").trim();
  const mails = Array.from(new Set([p.primary_email, ...apps.flatMap((a) => [a.email, a.contact_email, a.billing_email])]
    .map((x) => leer(x).toLowerCase()).filter((x) => x.includes("@"))));
  const nummern = Array.from(new Set([p.primary_phone, ...apps.flatMap((a) => [tel(a), a.contact_phone])]
    .map((x) => leer(x)).filter((x) => x.replace(/\D/g, "").length >= 7)));
  const anschrift: Partial<Anschrift> = haupt.street || haupt.zip || haupt.city
    ? { strasse: leer(haupt.street) || undefined, plz: leer(haupt.zip) || undefined, ort: leer(haupt.city) || undefined, land: landNorm(haupt.country) }
    : { strasse: leer(p.street) || undefined, plz: leer(p.zip) || undefined, ort: leer(p.city) || undefined, land: landNorm(p.country) };
  return {
    personId, ref: String(haupt.ref),
    name: [p.first_name, p.last_name].map((x) => leer(x)).filter(Boolean).join(" ") || null,
    test: !!p.ist_test_am,
    land: leer(haupt.country) || leer(p.country) || null,
    anschrift,
    email: leer(haupt.email).toLowerCase() || leer(p.primary_email).toLowerCase() || null,
    telefon: tel(haupt) || leer(p.primary_phone) || null,
    mails, nummern,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER EINMAL-LINK FÜR DIE NEUE E-MAIL-ADRESSE
// ═══════════════════════════════════════════════════════════════════════════
function geheimnis(): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET fehlt — der Bestätigungslink kann nicht signiert werden.");
  return s;
}
function signatur(id: number, personId: number, neu: string, ablaufSek: number): string {
  return createHmac("sha256", geheimnis()).update(`angaben-email.${id}.${personId}.${neu.toLowerCase()}.${ablaufSek}`).digest("base64url").slice(0, 32);
}
/** „<id>.<signatur>“ — die Signatur bindet Zeile, Person, neue Adresse und Ablauf. */
export function emailToken(id: number, personId: number, neu: string, ablauf: Date): string {
  return `${id}.${signatur(id, personId, neu, Math.floor(ablauf.getTime() / 1000))}`;
}
export function emailLink(token: string): string {
  return absoluteUrl(`/api/fiaon/angaben/email/${token}`);
}
/**
 * E-401 Nachbesserung (Prüfer-Fund): der Stopp-Knopf in der Hinweis-Mail an die BISHERIGE Adresse. Eigene Signatur (Zweck
 * „stopp“, gebunden an die bisherige Adresse) — mit dem Bestätigungslink lässt er sich nicht verwechseln.
 */
function stoppSignatur(id: number, personId: number, alt: string, ablaufSek: number): string {
  return createHmac("sha256", geheimnis()).update(`angaben-email-stopp.${id}.${personId}.${alt.toLowerCase()}.${ablaufSek}`).digest("base64url").slice(0, 32);
}
export function stoppToken(id: number, personId: number, alt: string, ablauf: Date): string {
  return `${id}.${stoppSignatur(id, personId, alt, Math.floor(ablauf.getTime() / 1000))}`;
}
export function stoppLink(token: string): string {
  return absoluteUrl(`/api/fiaon/angaben/email-stopp/${token}`);
}

export type LinkArt = "offen" | "bestaetigt" | "schon" | "abgelaufen" | "ungueltig" | "veraltet" | "vergeben" | "fehler" | "gestoppt";
export interface LinkPruefung { art: LinkArt; text: string; neuMaske?: string; zeile?: any }

const LINK_TEXT: Record<LinkArt, string> = {
  offen: "Bitte bestätigen Sie Ihre neue E-Mail-Adresse.",
  bestaetigt: "Danke — Ihre neue E-Mail-Adresse ist gespeichert. Ab jetzt melden Sie sich in Ihrem Kundenbereich damit an.",
  schon: "Diese E-Mail-Adresse ist schon bestätigt und gespeichert.",
  abgelaufen: "Dieser Link ist abgelaufen. Schreiben Sie uns einfach noch einmal von Ihrer bisherigen Adresse — oder ändern Sie die Adresse selbst in Ihrem Kundenbereich unter fiaon.com/app/mehr/daten.",
  ungueltig: "Dieser Link ist ungültig. Schreiben Sie uns einfach — oder ändern Sie Ihre Adresse selbst in Ihrem Kundenbereich unter fiaon.com/app/mehr/daten.",
  veraltet: "Dieser Link gilt nicht mehr, weil sich Ihre Angaben inzwischen geändert haben. Schreiben Sie uns einfach noch einmal — oder ändern Sie die Adresse selbst in Ihrem Kundenbereich unter fiaon.com/app/mehr/daten.",
  vergeben: "Diese E-Mail-Adresse können wir leider nicht übernehmen. Bitte schreiben Sie uns kurz — ein Kollege hilft Ihnen gern.",
  fehler: "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einer Minute noch einmal.",
  gestoppt: "Diese Änderung wurde gestoppt — Ihre bisherige E-Mail-Adresse bleibt hinterlegt.",
};

/** Den Link prüfen, ohne etwas zu ändern (GET: die Seite mit dem Knopf). */
export async function emailLinkPruefen(token: string, lauf: Lauf = sqlPool): Promise<LinkPruefung> {
  const r = (art: LinkArt, zeile?: any): LinkPruefung => ({ art, text: LINK_TEXT[art], neuMaske: zeile?.nachher ? mailMaske(zeile.nachher) : undefined, zeile });
  try {
    const [idRoh, sig] = String(token ?? "").split(".");
    const id = Number(idRoh);
    if (!Number.isInteger(id) || id <= 0 || !sig || sig.length !== 32) return r("ungueltig");
    await angabenTabelle(lauf);
    const [z] = (await lauf`SELECT * FROM fiaon_mara_angaben WHERE id = ${id} AND feld = 'email' LIMIT 1`) as any[];
    if (!z || !z.ablauf_am || !z.nachher) return r("ungueltig");
    const erwartet = signatur(id, Number(z.person_id), String(z.nachher), Math.floor(new Date(z.ablauf_am).getTime() / 1000));
    const a = Buffer.from(erwartet), b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return r("ungueltig");
    if (z.bestaetigt_am || z.stand === "bestaetigt") return r("schon", z);
    if (z.stand === "gestoppt") return r("gestoppt", z);
    if (z.stand !== "link_geschickt") return r("veraltet", z);
    if (new Date(z.ablauf_am).getTime() < Date.now()) return r("abgelaufen", z);
    return r("offen", z);
  } catch (e) {
    console.warn("[MARA-ANGABEN] Link prüfen:", String((e as Error)?.message ?? e).slice(0, 160));
    return r("fehler");
  }
}

/**
 * Der Klick (POST): Link gültig, nicht abgelaufen, nicht benutzt, der neueste — und die gespeicherte Adresse ist noch die
 * von damals (Erwartungs-Stempel). Dann über den EINEN Speicherweg (updateCustomerContact: Bestellung + Person + Alias
 * + Login), ein Vermerk. Einmal: die Zeile wird zuerst beansprucht.
 */
export async function emailBestaetigen(token: string, lauf: Lauf = sqlPool): Promise<LinkPruefung> {
  const p = await emailLinkPruefen(token, lauf);
  if (p.art !== "offen" || !p.zeile) return p;
  const z = p.zeile;
  const r = (art: LinkArt): LinkPruefung => ({ art, text: LINK_TEXT[art], neuMaske: mailMaske(z.nachher), zeile: z });
  try {
    const g = await gespeichertLesen(Number(z.person_id), lauf);
    if (!g) return r("veraltet");
    if (!((!z.vorher && !g.email) || mailGleich(g.email, z.vorher))) {
      await lauf`UPDATE fiaon_mara_angaben SET stand = 'veraltet', aktualisiert_am = NOW() WHERE id = ${z.id} AND stand = 'link_geschickt'`;
      return r("veraltet");
    }
    const [dup] = (await lauf`
      SELECT 1 FROM fiaon_applications WHERE LOWER(TRIM(email)) = ${String(z.nachher).toLowerCase()} AND merged_into IS NULL
         AND person_id IS DISTINCT FROM ${Number(z.person_id)} LIMIT 1`.catch(() => [])) as any[];
    if (dup) return r("vergeben");
    // Beanspruchen — zwei Klicks gleichzeitig ändern nur einmal.
    const beansprucht = (await lauf`
      UPDATE fiaon_mara_angaben SET stand = 'bestaetigt', bestaetigt_am = NOW(), aktualisiert_am = NOW()
       WHERE id = ${z.id} AND stand = 'link_geschickt' AND bestaetigt_am IS NULL RETURNING id`) as any[];
    if (!beansprucht.length) return r("schon");
    const { updateCustomerContact } = await import("../routes/fiaon-agent");
    const erg = await updateCustomerContact(g.ref, { email: String(z.nachher) }, { id: null, name: "Mara (vom Kunden bestätigt)" });
    if (erg.error) {
      await lauf`UPDATE fiaon_mara_angaben SET stand = 'link_geschickt', bestaetigt_am = NULL, grund = ${erg.error.msg}, aktualisiert_am = NOW() WHERE id = ${z.id}`;
      return r("fehler");
    }
    await vermerk(Number(z.person_id), g.ref, kanalAus(z.kanal),
      `Der Kunde hat seine neue E-Mail-Adresse über den Bestätigungslink bestätigt: ${z.vorher || "leer"} → ${z.nachher}. Gespeichert (Akte, Person, Anmeldung).`,
      `[Angaben bestätigt #${z.id}]`, lauf);
    return r("bestaetigt");
  } catch (e) {
    console.warn("[MARA-ANGABEN] Bestätigen:", String((e as Error)?.message ?? e).slice(0, 200));
    return r("fehler");
  }
}

export type StoppArt = "offen" | "gestoppt" | "schon_bestaetigt" | "schon_gestoppt" | "ungueltig" | "fehler";
export interface StoppPruefung { art: StoppArt; text: string; zeile?: any }
const STOPP_TEXT: Record<StoppArt, string> = {
  offen: "Haben Sie die Änderung Ihrer E-Mail-Adresse nicht selbst angefordert? Dann stoppen Sie sie hier — Ihre bisherige Adresse bleibt hinterlegt.",
  gestoppt: "Danke — die Änderung ist gestoppt. Ihre bisherige E-Mail-Adresse bleibt hinterlegt. Ein Kollege sieht sich den Vorgang an.",
  schon_bestaetigt: "Die neue Adresse war schon bestätigt. Wir haben Ihre Meldung sofort an unsere Geschäftsführung gegeben — sie meldet sich bei Ihnen.",
  schon_gestoppt: "Diese Änderung ist schon gestoppt. Ihre bisherige E-Mail-Adresse bleibt hinterlegt.",
  ungueltig: "Dieser Link ist ungültig. Bitte antworten Sie einfach auf unsere E-Mail — wir kümmern uns sofort darum.",
  fehler: "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einer Minute noch einmal — oder antworten Sie auf unsere E-Mail.",
};
/** Den Stopp-Link prüfen (GET — ändert nichts). Gültig 7 Tage über den Bestätigungslink hinaus. */
export async function stoppPruefen(token: string, lauf: Lauf = sqlPool): Promise<StoppPruefung> {
  const r = (art: StoppArt, zeile?: any): StoppPruefung => ({ art, text: STOPP_TEXT[art], zeile });
  try {
    const [idRoh, sig] = String(token ?? "").split(".");
    const id = Number(idRoh);
    if (!Number.isInteger(id) || id <= 0 || !sig || sig.length !== 32) return r("ungueltig");
    await angabenTabelle(lauf);
    const [z] = (await lauf`SELECT * FROM fiaon_mara_angaben WHERE id = ${id} AND feld = 'email' LIMIT 1`) as any[];
    if (!z || !z.ablauf_am || !z.vorher) return r("ungueltig");
    const erwartet = stoppSignatur(id, Number(z.person_id), String(z.vorher), Math.floor(new Date(z.ablauf_am).getTime() / 1000));
    const a = Buffer.from(erwartet), b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return r("ungueltig");
    if (new Date(z.ablauf_am).getTime() + 7 * 86_400_000 < Date.now()) return r("ungueltig");
    if (z.stand === "gestoppt") return r("schon_gestoppt", z);
    return r("offen", z);
  } catch (e) {
    console.warn("[MARA-ANGABEN] Stopp prüfen:", String((e as Error)?.message ?? e).slice(0, 160));
    return r("fehler");
  }
}
/**
 * Der Klick auf „Das war ich nicht“ (POST). Noch nicht bestätigt: die Zeile wird „gestoppt“ (der Bestätigungslink gilt
 * nicht mehr), ein Vermerk. Schon bestätigt: nichts zurückdrehen (das entscheidet ein Mensch) — ein Vermerk und eine
 * Karte für Justin („E-Mail-Adresse geändert — der Kunde sagt, er war es nicht“).
 */
export async function emailStoppen(token: string, lauf: Lauf = sqlPool): Promise<StoppPruefung> {
  const p = await stoppPruefen(token, lauf);
  if (p.art !== "offen" || !p.zeile) return p;
  const z = p.zeile;
  const r = (art: StoppArt): StoppPruefung => ({ art, text: STOPP_TEXT[art], zeile: z });
  try {
    const gestoppt = (await lauf`
      UPDATE fiaon_mara_angaben SET stand = 'gestoppt', grund = 'Kunde: „Das war ich nicht“ (Stopp-Knopf)', aktualisiert_am = NOW()
       WHERE id = ${z.id} AND stand IN ('link_geschickt', 'ersetzt', 'veraltet', 'laeuft') AND bestaetigt_am IS NULL RETURNING id`) as any[];
    if (gestoppt.length) {
      // Alle anderen offenen Links derselben Person gelten ebenso nicht mehr (ein Fremder könnte mehrere angefordert haben).
      await lauf`UPDATE fiaon_mara_angaben SET stand = 'gestoppt', grund = 'gestoppt mit #' || ${String(z.id)}, aktualisiert_am = NOW()
                  WHERE person_id = ${Number(z.person_id)} AND feld = 'email' AND stand = 'link_geschickt' AND bestaetigt_am IS NULL`.catch(() => {});
      await vermerk(Number(z.person_id), z.ref ?? null, kanalAus(z.kanal),
        `ACHTUNG: Der Kunde hat über den Knopf in der Hinweis-Mail an seine bisherige Adresse gemeldet, dass er die Änderung der E-Mail-Adresse (→ ${z.nachher}) NICHT angefordert hat. Gestoppt — nichts geändert, der Bestätigungslink gilt nicht mehr.`,
        `[Angaben gestoppt #${z.id}]`, lauf);
      return r("gestoppt");
    }
    // Schon bestätigt: Alarm für den Menschen.
    await vermerk(Number(z.person_id), z.ref ?? null, kanalAus(z.kanal),
      `ALARM: Der Kunde meldet über den Stopp-Knopf, dass er die Änderung der E-Mail-Adresse (${z.vorher} → ${z.nachher}) NICHT angefordert hat — sie war schon bestätigt. Bitte sofort prüfen und die bisherige Adresse wiederherstellen.`,
      `[Angaben Alarm #${z.id}]`, lauf);
    try {
      const { entscheidungAnlegen, entscheidungArt, entscheidungTabellen } = await import("./fiaon-mara-entscheidungen");
      const { akteAdresse } = await import("@shared/fiaon-akte-aufloesung");
      await entscheidungTabellen();
      entscheidungArt("angaben_alarm", "E-Mail-Adresse — Alarm", 95);
      await entscheidungAnlegen({
        schluessel: `angaben_alarm:${z.id}`, art: "angaben_alarm", personId: Number(z.person_id), ref: z.ref ?? null,
        titel: "E-Mail-Adresse geändert — der Kunde sagt, er war es nicht",
        text: `Die E-Mail-Adresse wurde über Maras Bestätigungslink auf ${mailMaske(z.nachher)} geändert. Jetzt meldet der Kunde über den Stopp-Knopf an seine bisherige Adresse (${mailMaske(z.vorher)}): Das war er nicht. Bitte prüfen und in der Akte die bisherige Adresse wieder eintragen.`,
        empfehlung: "akte",
        optionen: [{ key: "akte", label: "Akte öffnen", werkzeug: "link", link: akteAdresse(Number(z.person_id)), ton: "neutral", titel: "Öffnet seine Akte — dort die Adresse prüfen und zurücksetzen." }],
        belege: [{ text: "Stopp-Knopf der Hinweis-Mail", ton: "warn" }],
      }, lauf);
    } catch (e) {
      console.warn("[MARA-ANGABEN] Alarm-Karte:", String((e as Error)?.message ?? e).slice(0, 160));
    }
    return r("schon_bestaetigt");
  } catch (e) {
    console.warn("[MARA-ANGABEN] Stoppen:", String((e as Error)?.message ?? e).slice(0, 200));
    return r("fehler");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDELN
// ═══════════════════════════════════════════════════════════════════════════
/** E-406 C1: Der gespeicherte Kanal einer Zeile (alte Zeilen kennen nur mail/whatsapp). */
function kanalAus(roh: unknown): AngabenKanal {
  return roh === "whatsapp" ? "whatsapp" : roh === "anliegen" ? "anliegen" : "mail";
}
/** Wer in der Akte als Bearbeiter steht. */
function akteurName(kanal: AngabenKanal): string {
  return kanal === "whatsapp" ? "Mara (WhatsApp)" : kanal === "anliegen" ? "Mara (Anliegen)" : "Mara (Mail)";
}
async function vermerk(personId: number, ref: string | null, kanal: AngabenKanal, text: string, marke: string, lauf: Lauf): Promise<void> {
  const [schon] = (await lauf`
    SELECT 1 FROM fiaon_contact_log WHERE person_id = ${personId} AND agent_id IS NULL AND type = 'system'
       AND POSITION(${marke} IN note) > 0 LIMIT 1`.catch(() => [])) as any[];
  if (schon) return;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${personId}, NULL, ${kanal === "mail" ? "Postmeister" : "Mara"}, 'system', ${`${text.slice(0, 900)} ${marke}`})`.catch(() => {});
}

async function mailRaus(e: { personId: number; an: string; name: string | null; betreff: string; text: string; event: string;
  knoepfe?: { text: string; url: string }[]; knopfFuss?: string }, lauf: Lauf): Promise<{ ok: boolean; grund: string | null }> {
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  const r = await eigeneMailSenden({ an: e.an, name: e.name, betreff: e.betreff, text: e.text, knoepfe: e.knoepfe, knopfFuss: e.knopfFuss })
    .catch((x: any) => ({ ok: false, messageId: null, grund: String(x?.message ?? x) }));
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({
    event: e.event, personId: e.personId, empfaenger: e.an, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null,
    payload: { betreff: e.betreff }, ausgeloestVon: "Mara", brevoMessageId: r.messageId ?? null,
  }, lauf);
  return { ok: r.ok, grund: r.grund ?? null };
}

/** Eine Zeile beanspruchen — gibt es sie schon (dieselbe Nachricht noch einmal), die bestehende zurück. */
async function beanspruchen(z: { personId: number; ref: string; kanal: AngabenKanal; quelle: string; feld: AngabeFeld; stand: FeldStand | "laeuft";
  vorher: string | null; nachher: string | null; grund?: string | null; ablauf?: Date | null }, lauf: Lauf): Promise<{ id: number; neu: boolean; zeile: any }> {
  const neu = (await lauf`
    INSERT INTO fiaon_mara_angaben (person_id, ref, kanal, quelle, feld, stand, vorher, nachher, grund, ablauf_am)
    VALUES (${z.personId}, ${z.ref}, ${z.kanal}, ${z.quelle}, ${z.feld}, ${z.stand}, ${z.vorher}, ${z.nachher}, ${z.grund ?? null}, ${z.ablauf ?? null})
    ON CONFLICT (quelle, feld) DO NOTHING RETURNING *`) as any[];
  if (neu.length) return { id: Number(neu[0].id), neu: true, zeile: neu[0] };
  const [alt] = (await lauf`SELECT * FROM fiaon_mara_angaben WHERE quelle = ${z.quelle} AND feld = ${z.feld} LIMIT 1`) as any[];
  return { id: Number(alt?.id ?? 0), neu: false, zeile: alt };
}
async function standSetzen(id: number, stand: FeldStand, grund: string | null, lauf: Lauf): Promise<void> {
  await lauf`UPDATE fiaon_mara_angaben SET stand = ${stand}, grund = COALESCE(${grund}, grund), aktualisiert_am = NOW() WHERE id = ${id}`.catch(() => {});
}
function ausZeile(z: any): FeldErgebnis {
  const stand = String(z.stand) as FeldStand | "laeuft" | "bestaetigt" | "veraltet" | "ersetzt" | "gestoppt";
  return {
    feld: z.feld as AngabeFeld,
    // Eine bestätigte E-Mail-Zeile ist gespeichert; eine hängengebliebene („laeuft“) gilt als Fehler (ein Mensch).
    stand: stand === "bestaetigt" ? "geaendert" : stand === "laeuft" || stand === "veraltet" || stand === "ersetzt" || stand === "gestoppt" ? "mensch" : stand,
    vorher: z.vorher ?? null, nachher: z.nachher ?? null, grund: z.grund ?? null,
  };
}

const NAME_INTERN: Record<AngabeFeld, string> = { anschrift: "Anschrift", email: "E-Mail-Adresse", telefon: "Telefonnummer" };

/**
 * angaben_aendern — erkennen, Absender prüfen, handeln, Hinweis bauen. null: keine Person, kein Änderungswunsch,
 * Global-Kunde, keine Bestellung oder Lesefehler (dann bleibt alles wie bisher).
 */
export async function angabenAendernBehandeln(ein: {
  personId: number | null;
  kanal: AngabenKanal;
  /** Nur seine eigenen Worte (Mail: ohne Zitat; WhatsApp: ohne Knöpfe). */
  kundeText: string;
  /** Mail: der Absender („Name <a@b.de>“). */
  absender?: string | null;
  /**
   * E-401 Nachbesserung (Prüfer-Fund): Mail — Gmails Absender-Prüfung (oberster „Authentication-Results“) und Reply-To.
   * Fehlt sie, gilt die Mail als NICHT bestätigt: Der From-Kopf allein lässt sich fälschen.
   */
  absenderPruefung?: { authErgebnis: string | null; antwortAn: string | null } | null;
  /** WhatsApp: die Nummer des Gesprächs. */
  nummer?: string | null;
  /** „Mail #7110“ / „WhatsApp #123“ — je Nachricht einmal. */
  quelle: string;
  jetzt?: Date;
}, lauf: Lauf = sqlPool): Promise<AngabenLage | null> {
  if (!ein.personId || !angabenAendernNoetig(ein.kundeText)) return null;
  const personId = Number(ein.personId);
  try {
    const { istGlobalKunde } = await import("./fiaon-global-kunde");
    if (await istGlobalKunde(personId).catch(() => false)) return null;
    const g = await gespeichertLesen(personId, lauf);
    if (!g) return null;
    const absender = ein.kanal === "mail" ? adresseAus(ein.absender) : null;
    const erk = angabenErkennen(ein.kundeText, {
      absender, landBisher: g.land,
      bisher: { anschrift: g.anschrift, email: g.email, telefon: g.telefon },
    });
    if (!erk.wuensche.length && !erk.verboten.length) return null;
    // E-406 C1 (19.10.2026): Im Anliegen ist er im Kundenbereich ANGEMELDET (requireKunde) — dort darf er Anschrift, E-Mail
    // und Telefon ohnehin selbst ändern (Meine Daten, PATCH /kunde/:ref/stammdaten). Der Absender ist damit er selbst.
    const absenderBekannt = ein.kanal === "anliegen" ? true
      : ein.kanal === "mail"
      ? !!absender && g.mails.some((m) => mailGleich(m, absender))
      // WhatsApp: die GANZE Nummer mit Landesvorwahl (nicht nur die letzten neun Ziffern).
      : !!ein.nummer && g.nummern.some((n) => waNummerGleich(ein.nummer, n, landNorm(g.land)));
    // E-401 Nachbesserung (Prüfer-Fund): Auf die Mail hin ändert der Server nur, wenn Gmail den Absender bestätigt hat
    // (dmarc/dkim/spf=pass zur Absender-Domain) und kein fremdes Reply-To darin steht — sonst gilt sie als fremd.
    const echtheit = ein.kanal === "mail" && absenderBekannt
      ? absenderEcht({ authErgebnis: ein.absenderPruefung?.authErgebnis ?? null, von: absender, antwortAn: ein.absenderPruefung?.antwortAn ?? null, bekannte: g.mails })
      : null;
    const absenderUnbestaetigt = !!echtheit && !echtheit.echt;
    const absenderOk = absenderBekannt && !absenderUnbestaetigt;
    const quelle = String(ein.quelle || `${ein.kanal}:${personId}:${createHash("sha1").update(ein.kundeText).digest("hex").slice(0, 12)}`).slice(0, 120);
    const jetzt = ein.jetzt ?? new Date();

    if (!g.test) await angabenTabelle(lauf);
    const ergebnisse: FeldErgebnis[] = [];
    const vermerkTeile: string[] = [];
    let wiederholt = false;
    const quelleText = ein.kanal === "anliegen" ? "Anliegen im Kundenbereich (angemeldet)"
      : ein.kanal === "whatsapp" ? `WhatsApp von ${absenderOk ? "der hinterlegten Nummer" : `einer anderen Nummer (…${String(ein.nummer ?? "").replace(/\D/g, "").slice(-4)})`}`
      : `Mail ${absenderOk ? "vom hinterlegten Absender" : absenderUnbestaetigt ? `mit der hinterlegten Adresse als Absender, aber NICHT bestätigt (${echtheit?.grund})` : `von ${absender || "unbekannt"} (nicht hinterlegt)`}`;

    for (const w of erk.wuensche) {
      // Fehlt die E-Mail-Adresse ganz, ist es kein Ändern, sondern Eintragen — das macht angaben_eintragen (E-372) wie bisher.
      if (w.feld === "email" && !g.email) continue;
      const vorherText = w.feld === "anschrift" ? (anschriftText(g.anschrift) || null) : w.feld === "email" ? g.email : g.telefon;
      const nachherText = w.art === "voll" ? (w.feld === "anschrift" ? anschriftText((w as any).wert) : String((w as any).wert)) : null;
      // Was wäre zu tun? (ohne Absenderprüfung)
      let soll: FeldStand;
      let grund: string | null = (w as any).grund ?? null;
      if (w.art === "voll") {
        const gleich = w.feld === "anschrift" ? anschriftSchluessel((w as any).wert) === anschriftSchluessel(g.anschrift)
          : w.feld === "email" ? mailGleich((w as any).wert, g.email)
          : nummerGleich((w as any).wert, g.telefon);
        soll = gleich ? "schon_so" : w.feld === "email" ? "link_geschickt" : "geaendert";
      } else if (w.art === "unklar" && ((w as any).ausland || (w as any).spaeter)) {
        // E-401 Nachbesserung: auch eine Anschrift, die erst später gilt — ein Mensch trägt sie zum richtigen Zeitpunkt ein.
        soll = "mensch";
      } else {
        soll = w.art;
      }
      // Fremder Absender: nichts ändern, nichts erfragen, nichts bestätigen (auch kein „ist schon so hinterlegt“ — das
      // verriete die gespeicherten Daten) — ein Nummernwechsel per WhatsApp geht an die Leitung (Karte).
      if (!absenderOk) {
        const leitung = ein.kanal === "whatsapp" && w.feld === "telefon" && w.art === "voll";
        soll = leitung ? "mensch" : "fremder_absender";
        grund = leitung ? "Nummernwechsel per WhatsApp — die Nachricht kommt nicht von der hinterlegten Nummer; die Leitung prüft und trägt ein."
          : absenderUnbestaetigt ? `Absender nicht bestätigt (${echtheit?.grund}).` : "Nicht vom hinterlegten Absender.";
      }
      if (g.test) {
        ergebnisse.push({ feld: w.feld, stand: "probe", waere: soll, vorher: vorherText, nachher: nachherText, grund });
        continue;
      }
      // Dieselbe Nachricht noch einmal (Neu schreiben, Nachhol-Takt): die Zeile von damals, nichts erneut tun.
      const anspruch = await beanspruchen({ personId, ref: g.ref, kanal: ein.kanal, quelle, feld: w.feld, stand: "laeuft",
        vorher: vorherText, nachher: nachherText, grund }, lauf);
      if (!anspruch.neu) { wiederholt = true; ergebnisse.push(ausZeile(anspruch.zeile)); continue; }
      // Eine NEUE Nachricht mit demselben Wunsch kurz danach (er schrieb weiter, bevor Mara antwortete): was damals geschah, gilt.
      if (w.art === "voll" && (soll === "schon_so" || soll === "link_geschickt")) {
        const [frueher] = (await lauf`
          SELECT * FROM fiaon_mara_angaben WHERE person_id = ${personId} AND feld = ${w.feld} AND id <> ${anspruch.id}
             AND LOWER(COALESCE(nachher, '')) = ${String(nachherText ?? "").toLowerCase()} AND stand IN ('geaendert', 'link_geschickt', 'bestaetigt')
             AND created_at > ${new Date(jetzt.getTime() - 6 * 3_600_000)} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
        if (frueher) {
          const f = ausZeile(frueher);
          await standSetzen(anspruch.id, f.stand, `wie ${frueher.quelle}`, lauf);
          ergebnisse.push({ ...f, vorher: frueher.vorher ?? vorherText });
          continue;
        }
      }
      const e: FeldErgebnis = { feld: w.feld, stand: soll, vorher: vorherText, nachher: nachherText, grund, fehlt: (w as any).fehlt };

      if (soll === "geaendert" && w.feld === "anschrift") {
        const neu = (w as any).wert as Anschrift;
        const body: Record<string, string> = {};
        if ((neu.strasse ?? "") !== (g.anschrift.strasse ?? "")) body.street = neu.strasse;
        if ((neu.plz ?? "") !== (g.anschrift.plz ?? "")) body.zip = neu.plz;
        if ((neu.ort ?? "") !== (g.anschrift.ort ?? "")) body.city = neu.ort;
        const { updateCustomerContact } = await import("../routes/fiaon-agent");
        const erg = Object.keys(body).length
          ? await updateCustomerContact(g.ref, body, { id: null, name: akteurName(ein.kanal) })
          : { changes: [] as any[] };
        if ((erg as any).error) {
          e.stand = "mensch"; e.grund = `Speichern ging nicht: ${(erg as any).error.msg}`;
        } else if (neu.land && neu.land !== landNorm(g.land)) {
          // Das Land führt updateCustomerContact nicht — hier, an Bestellung und Person, mit derselben Verlaufszeile.
          await lauf`UPDATE fiaon_applications SET country = ${neu.land}, updated_at = NOW() WHERE ref = ${g.ref}`;
          await lauf`UPDATE fiaon_persons SET country = ${neu.land}, updated_at = NOW() WHERE id = ${personId}`;
          await lauf`
            INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
            VALUES (${g.ref}, ${personId}, NULL, ${akteurName(ein.kanal)}, 'edit',
                    ${`Land korrigiert durch ${akteurName(ein.kanal)}: ${g.land || "—"} → ${neu.land}`})`.catch(() => {});
        }
      } else if (soll === "geaendert" && w.feld === "telefon") {
        const { updateCustomerContact } = await import("../routes/fiaon-agent");
        const erg = await updateCustomerContact(g.ref, { phone: String((w as any).wert) }, { id: null, name: akteurName(ein.kanal) });
        if (erg.error) { e.stand = "mensch"; e.grund = `Speichern ging nicht: ${erg.error.msg}`; }
        else if (g.email && !mailPlausibel(g.email)) {
          // Der Hinweis an die gespeicherte Adresse — wer es nicht war, meldet sich.
          const m = hinweisTelefonMail({ name: g.name, alt: g.telefon, neu: String((w as any).wert) });
          const v = await mailRaus({ personId, an: g.email, name: g.name, betreff: m.betreff, text: m.text, event: "angaben_telefon_hinweis" }, lauf);
          vermerkTeile.push(`Hinweis-Mail an die hinterlegte Adresse ${v.ok ? "verschickt" : `ging nicht raus (${String(v.grund ?? "").slice(0, 80)})`}.`);
        }
      } else if (soll === "link_geschickt") {
        const neu = String((w as any).wert).toLowerCase();
        const [dup] = (await lauf`
          SELECT 1 FROM fiaon_applications WHERE LOWER(TRIM(email)) = ${neu} AND merged_into IS NULL AND person_id IS DISTINCT FROM ${personId}
          UNION ALL SELECT 1 FROM fiaon_persons WHERE LOWER(TRIM(primary_email)) = ${neu} AND id <> ${personId} AND merged_into_person_id IS NULL
          LIMIT 1`.catch(() => [])) as any[];
        const [{ n: links } = { n: 0 }] = (await lauf`
          SELECT COUNT(*)::int AS n FROM fiaon_mara_angaben WHERE person_id = ${personId} AND feld = 'email' AND id <> ${anspruch.id}
             AND ablauf_am IS NOT NULL AND created_at > ${new Date(jetzt.getTime() - 24 * 3_600_000)}`.catch(() => [{ n: 0 }])) as any[];
        if (dup) { e.stand = "mensch"; e.grund = "Die neue E-Mail-Adresse gehört bei uns schon zu einem anderen Kunden — ein Mensch klärt das."; }
        else if (Number(links) >= 3) { e.stand = "mensch"; e.grund = "Schon drei Bestätigungslinks in 24 Stunden — ein Mensch prüft den Wunsch."; }
        else {
          const ablauf = new Date(jetzt.getTime() + LINK_STUNDEN * 3_600_000);
          let token: string | null = null;
          try { token = emailToken(anspruch.id, personId, neu, ablauf); } catch (x) { e.stand = "mensch"; e.grund = String((x as Error).message).slice(0, 160); }
          if (token) {
            await lauf`UPDATE fiaon_mara_angaben SET ablauf_am = ${ablauf}, nachher = ${neu}, aktualisiert_am = NOW() WHERE id = ${anspruch.id}`;
            // Ältere, offene Links derselben Person gelten nicht mehr — es zählt nur der neueste Wunsch.
            await lauf`UPDATE fiaon_mara_angaben SET stand = 'ersetzt', aktualisiert_am = NOW()
                        WHERE person_id = ${personId} AND feld = 'email' AND stand = 'link_geschickt' AND id <> ${anspruch.id}`;
            const b = bestaetigungsMail({ name: g.name, neu });
            const v = await mailRaus({ personId, an: neu, name: g.name, betreff: b.betreff, text: b.text, event: "angaben_email_bestaetigen",
              knoepfe: [{ text: b.knopf, url: emailLink(token) }], knopfFuss: b.fuss }, lauf);
            if (!v.ok) { e.stand = "mensch"; e.grund = `Der Bestätigungslink ging nicht raus (${String(v.grund ?? "").slice(0, 100)}) — ein Mensch klärt das.`; }
            else if (g.email) {
              const h = hinweisAlteMail({ name: g.name, neu });
              // E-401 Nachbesserung: mit Stopp-Knopf („Das war ich nicht“) — er hält die Änderung selbst an.
              let stopp: { text: string; url: string }[] | undefined;
              try { stopp = [{ text: h.knopf, url: stoppLink(stoppToken(anspruch.id, personId, String(g.email), ablauf)) }]; } catch { stopp = undefined; }
              const v2 = await mailRaus({ personId, an: g.email, name: g.name, betreff: h.betreff, text: h.text, event: "angaben_email_hinweis",
                ...(stopp ? { knoepfe: stopp, knopfFuss: h.fuss } : {}) }, lauf);
              vermerkTeile.push(`Hinweis an die bisherige Adresse ${v2.ok ? "verschickt" : `ging nicht raus (${String(v2.grund ?? "").slice(0, 80)})`}.`);
            }
          }
        }
      }
      await standSetzen(anspruch.id, e.stand, e.grund ?? null, lauf);
      ergebnisse.push(e);
    }

    if (!ergebnisse.length && !erk.verboten.length) return null;
    const rein: AngabenLageRein = {
      kanal: ein.kanal, ergebnisse, verboten: erk.verboten, absenderUnbestaetigt,
      geheim: absenderOk ? [] : [g.email ?? "", ...g.mails, g.telefon ?? "", ...g.nummern, g.anschrift.strasse ?? ""].filter(Boolean),
    };
    const mensch = angabenMenschNoetig(rein);
    const menschGrund = mensch
      ? [
        ...ergebnisse.filter((e) => e.stand === "mensch").map((e) => `${NAME_INTERN[e.feld]}: ${e.grund ?? "ein Mensch trägt es ein"}${e.nachher ? ` (gewünscht: ${e.feld === "telefon" ? telefonText(e.nachher) : e.nachher})` : ""}`),
        ...(erk.verboten.length ? [`Er möchte ${erk.verboten.map((v) => ({ name: "seinen Namen", geburtsdatum: "sein Geburtsdatum", bank: "seine Bankverbindung", ausweis: "seine Ausweisdaten" })[v]).join(", ")} ändern — das ändert Mara nie selbst; bitte prüfen und in der Akte eintragen.`] : []),
      ].join(" · ") + ` Er schreibt: „${ein.kundeText.replace(/\s+/g, " ").slice(0, 260)}“`
      : null;
    const kurz = (e: FeldErgebnis) => `${NAME_INTERN[e.feld]} ${({
      geaendert: `gespeichert (${e.vorher || "leer"} → ${e.feld === "telefon" ? telefonText(e.nachher) : e.nachher})`,
      link_geschickt: `Bestätigungslink an ${e.nachher} (${LINK_STUNDEN} h), Hinweis an die bisherige — geändert erst nach dem Klick`,
      schon_so: "schon so gespeichert", unvollstaendig: `unvollständig (${(e.fehlt ?? []).join(", ")})`, unklar: `unklar (${e.grund ?? ""})`,
      fremder_absender: "NICHT geändert (nicht vom hinterlegten Absender)", mensch: `NICHT geändert — ${e.grund ?? "ein Mensch"}`,
      probe: `Testkonto, nichts gespeichert (wäre: ${e.waere})`,
    } as Record<FeldStand, string>)[e.stand]}`;
    const handlung = `angaben_aendern (${quelleText}): ${[...ergebnisse.map(kurz), ...(erk.verboten.length ? [`${erk.verboten.join(", ")}: ändert Mara nie — ein Mensch`] : [])].join(" · ")}${wiederholt ? " (diese Nachricht war schon bearbeitet — nichts erneut getan)" : ""}`;

    // Ein Vermerk in der Akte — einmal je Nachricht (Marke), nie bei Testpersonen.
    if (!g.test && !wiederholt && ergebnisse.length) {
      await vermerk(personId, g.ref, ein.kanal,
        `Mara hat einen Änderungswunsch bearbeitet (${quelleText}): ${ergebnisse.map(kurz).join(" · ")}. ${vermerkTeile.join(" ")}`.trim(),
        `[Angaben ${quelle}]`, lauf);
    }
    const satz = angabenSatz(rein);
    return {
      ...rein, hinweis: angabenHinweis(rein), satz, handlung,
      daten: { felder: ergebnisse.map((e) => ({ feld: e.feld, stand: e.stand, nachher: e.nachher ?? null })), satz },
      mensch, menschGrund, absenderOk, test: g.test, wiederholt,
    };
  } catch (e) {
    console.warn("[MARA-ANGABEN] angaben_aendern:", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  }
}

/** Für den Prüfstand: Masken (keine Daten in Logs). */
export const _masken = { mailMaske, telefonMaske };
export type { FeldWunsch };
