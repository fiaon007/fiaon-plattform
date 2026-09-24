// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSKUNFT AUS DER MAIL BEAUFTRAGEN (24.09.2026, E-240)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Die Unterlagen-Mail („Ein Dokument fehlt noch") ging am 24.09. an 361
// Menschen. Zur Bonitätsauskunft stand darin nur „laden Sie sie hoch — sonst
// antworten Sie" — kein Preis, kein Weg, sie bei uns zu beauftragen. Die
// Kaufknöpfe des alten Dashboards (97 von 146 Auskunft-Bestellungen kamen
// darüber) sind seit dem 22.08. weg. Wer die Auskunft nicht hatte, konnte sie
// aus der Mail heraus schlicht nicht kaufen.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
//   1. Der signierte Kauflink je Person (Muster: dokumentTokenErzeugen) — er
//      reist wie Rechnungslinks als ?exp=…&sig=…, damit ihn weder das
//      Anfrage-Protokoll (index.ts schreibt nur den Pfad) noch das
//      Mail-Protokoll (payloadSchwaerzen verbirgt jeden Wert mit sig=) im
//      Klartext führt.
//   2. GET zeigt eine BESTÄTIGUNGSSEITE, erst POST bestellt. Zwei Gründe:
//      · Postfach-Schutzprogramme (Outlook Safe Links, Virenscanner) rufen
//        Links in Mails vorab auf. Bestellte schon der GET, entstünde eine
//        Bestellung samt Zahlungsmail, ohne dass der Mensch geklickt hat.
//      · Button-Lösung (§ 312j Abs. 3 BGB): Ein Verbraucher bestellt nur über
//        einen Knopf, der „zahlungspflichtig" sagt — ein Mail-Link, der beim
//        Öffnen bestellt, ist das nicht.
//      Ist schon eine Bestellung offen, führt der GET direkt zur Zahlungsseite
//      (es entsteht nichts Neues). Bezahlt: eine Seite, die das sagt.
//   3. `auskunftMailTeil` — was die Unterlagen-Mail zur Auskunft sagt: Angebot
//      mit Preis (74 € mit Paket, sonst 149 €) samt Widerspruchs-Hinweis,
//      Zahlungslink der offenen Bestellung, reine Bitte (Werbesperre — dann
//      auch ohne Zahlungslink —, Paket noch nicht bezahlt) oder gar nichts
//      (bezahlt, liegt vor, Zahlung gemeldet). Der Auslöser steht in
//      fiaon-telefonie.ts (POST /dokumente/:personId/anfordern).
//
// Bestellt wird ausschließlich über auskunftBestellen (server/lib/fiaon-auskunft.ts)
// — Preis vom Server, eine offene Bestellung wird wiederverwendet.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "../lib/db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { AUSKUNFT_WIDERRUF, AUSKUNFT_KEIN_WIDERRUF } from "@shared/fiaon-auskunft-widerruf";
import {
  AUSKUNFT_NUTZEN_SATZ, auskunftLeistung, auskunftWort, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";

type Lauf = typeof sqlPool;

const router = Router();

// ───────────────────────────────────────────────────────────────────────────
// Der signierte Kauflink
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wie lange ein Kauflink gilt. Eine Mail wird oft erst Tage später gelesen;
 * die Unterlagen-Mail geht je Unterlage höchstens alle drei Tage (Anfordern).
 * Der Link erlaubt nur eines: für DIESE Person die Auskunft zum Serverpreis zu
 * bestellen — die Zahlungsdaten gehen an ihre eigene Adresse.
 */
export const KAUF_LINK_TAGE = 14;

function geheimnis(): string {
  const g = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  // Nie mit einer Konstante aus dem (öffentlichen) Quelltext signieren, wenn es um echtes
  // Geld geht: ohne Geheimnis in Produktion könnte sonst jeder für beliebige Menschen
  // Bestellungen und Zahlungsmails auslösen. Lokal (Prüfstand) bleibt der Rückfall.
  if (!g && process.env.NODE_ENV === "production") throw new Error("[AUSKUNFT-KAUF] SESSION_SECRET fehlt — Kauflinks sind abgeschaltet.");
  return g || "fiaon-dev-auskunft-secret";
}

function signatur(personId: number, art: AuskunftArt, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`auskunft-kauf.${personId}.${art}.${exp}`).digest("hex").slice(0, 32);
}

/** Der Link für die Mail: Bestätigungsseite, dann Zahlungsseite. */
export function kaufLink(personId: number, art: AuskunftArt = "privat", ttlMs = KAUF_LINK_TAGE * 86_400_000): string {
  const exp = Date.now() + ttlMs;
  return absoluteUrl(`/api/fiaon/auskunft/bestellen?p=${personId}&art=${art}&exp=${exp}&sig=${signatur(personId, art, exp)}`);
}

export type KaufTokenUrteil = { ok: true; personId: number; art: AuskunftArt } | { ok: false; abgelaufen: boolean };

export function kaufLinkPruefen(q: { p?: unknown; art?: unknown; exp?: unknown; sig?: unknown }): KaufTokenUrteil {
  const personId = Number(q.p);
  const art: AuskunftArt | null = q.art === "firma" ? "firma" : q.art === "privat" ? "privat" : null;
  const exp = Number(q.exp);
  const sig = String(q.sig ?? "");
  if (!Number.isInteger(personId) || personId <= 0 || !art || !Number.isFinite(exp) || !/^[0-9a-f]{32}$/.test(sig)) {
    return { ok: false, abgelaufen: false };
  }
  const a = Buffer.from(signatur(personId, art, exp));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, abgelaufen: false };
  // Erst NACH der Signatur: Nur ein echter Link darf „abgelaufen" hören.
  if (exp < Date.now()) return { ok: false, abgelaufen: true };
  return { ok: true, personId, art };
}

// ───────────────────────────────────────────────────────────────────────────
// Was die Unterlagen-Mail zur Auskunft sagt
// ───────────────────────────────────────────────────────────────────────────

/** Warum eine Mail die Auskunft NICHT anbietet, obwohl sie fehlt. */
export type OhneAngebotGrund = "werbesperre" | "paket_offen";

/**
 * Dazu nur in der Mail (nicht in angebotLage, die auch die Kaufseite fragt):
 * „kuerzlich_angeboten" — die gemeinsame Bremse (zuletztAngeboten,
 * fiaon-auskunft.ts, Integration 25.09.2026). Ein Klick des Kunden auf einen
 * Kauflink bleibt davon unberührt; nur WIR bieten nicht zweimal in drei Tagen an.
 */
export type MailOhneAngebot = OhneAngebotGrund | "kuerzlich_angeboten";

export const OHNE_ANGEBOT_TEXT: Record<MailOhneAngebot, string> = {
  werbesperre: "Werbesperre — ohne Angebot und ohne Zahlungslink, nur die Bitte um die Auskunft.",
  paket_offen: "Paket noch nicht bezahlt — die Auskunft wird erst nach der ersten Zahlung angeboten, die Mail bittet nur darum.",
  kuerzlich_angeboten: "Die Auskunft wurde in den letzten drei Tagen schon angeboten — diese Mail bittet nur um die Unterlage (ein Angebot je Kunde in drei Tagen). Will er sie beauftragen: Der Kauflink aus dem Angebot gilt 14 Tage, oder die Auskunft in der Akte direkt bestellen.",
};

/**
 * Der Widerspruchs-Hinweis für die Unterlagen-Mail MIT Kaufangebot
 * (Gegenlesen 24.09.2026, E-240).
 *
 * Das Angebot ist Werbung an einen Bestandskunden (§ 7 Abs. 3 UWG) — und Nr. 4
 * verlangt den Hinweis auf das Widerspruchsrecht bei JEDER Verwendung der
 * Adresse, klar und deutlich. Die reine Bitte um Unterlagen braucht ihn nicht;
 * deshalb steht er nur beim Modus „angebot". „Stopp" als Antwort ist ein
 * echter Weg: Die Mail kommt von welcome@, der Postmeister liest das Postfach
 * und setzt bei einer Abmeldung die Werbesperre (fiaon-postmeister.ts) — und
 * die nächste Unterlagen-Mail geht dann ohne Angebot.
 */
export const WIDERSPRUCH_SATZ =
  "Hinweise auf weitere Leistungen von FIAON per E-Mail können Sie jederzeit abbestellen: Eine kurze Antwort „Stopp“ genügt, "
  + "dafür entstehen keine anderen als die Übermittlungskosten nach den Basistarifen. Die Bitte um Ihre Unterlagen bleibt davon unberührt.";

/**
 * Darf dieser Mensch die Auskunft angeboten bekommen? EINE Regel für Mail,
 * Kauflink und Akte — dieselbe wie die Kaufkarte im Kundenbereich
 * (fiaon-kunde-bereich.ts, Sperre „paket_offen"): Erst zählt die erste Zahlung
 * für das Paket, dann die Auskunft. Wer „Stopp" gesagt hat, bekommt kein Angebot.
 */
export async function angebotLage(personId: number, lauf: Lauf = sqlPool): Promise<{
  angebot: boolean; grund: OhneAngebotGrund | null; werbesperre: boolean; paketBezahlt: boolean;
}> {
  const [p] = (await lauf`
    SELECT (pe.werbung_gesperrt_am IS NOT NULL) AS werbesperre,
           EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = pe.id AND a.merged_into IS NULL
                     AND a.payment_status = 'paid' AND COALESCE(a.type, '') <> 'schufa'
                     AND a.ref NOT LIKE 'FIAON-SCHUFA-%') AS paket_bezahlt
      FROM fiaon_persons pe WHERE pe.id = ${personId} LIMIT 1
  `) as any[];
  const werbesperre = !!p?.werbesperre;
  const paketBezahlt = !!p?.paket_bezahlt;
  if (werbesperre) return { angebot: false, grund: "werbesperre", werbesperre, paketBezahlt };
  if (!paketBezahlt) return { angebot: false, grund: "paket_offen", werbesperre, paketBezahlt };
  return { angebot: true, grund: null, werbesperre, paketBezahlt };
}

export type AuskunftMailTeil =
  /** Nicht anmahnen — mit dem Grund für den Mitarbeiter. */
  | { modus: "weglassen"; grund: string }
  | {
      /** angebot = wir holen sie (Kauflink) · zahlen = Bestellung offen · upload = nur die Bitte (siehe ohneAngebot) */
      modus: "angebot" | "zahlen" | "upload";
      land: AuskunftLand;
      /** „Ihre SCHUFA-Auskunft" / „Ihre KSV-Auskunft" / „Ihre Bonitätsauskunft" — für die Liste der Unterlagen. */
      posten: string;
      /** Der Absatz mit Angebot oder Zahlungshinweis; null bei „upload". */
      satz: string | null;
      /** Der Hauptknopf; null bei „upload" (dann ist der Upload der Hauptweg). */
      knopf: { text: string; url: string } | null;
      /** Für den Mitarbeiter und das Mail-Protokoll: Preis bzw. offener Betrag. */
      betragText: string | null;
      /** Nur bei „upload": warum ohne Angebot. */
      ohneAngebot: MailOhneAngebot | null;
      /** Nur bei „kuerzlich_angeboten": wann und wie zuletzt angeboten (für den Mitarbeiter). */
      zuletzt?: string | null;
    };

/**
 * Die Auskunft in der Unterlagen-Mail — je Land, je Stand, je Werbesperre.
 *
 * ── WARUM DIE WAHL EHRLICH BLEIBT ─────────────────────────────────────────
 * Der Kaufknopf ist der Hauptweg, der zweite Weg („Ich habe schon eine —
 * hochladen") steht immer daneben, und der Upload-Satz der Vorlage nennt
 * „selbst anfordern" ausdrücklich. Ein „kostenlos"-Werbesatz steht nicht darin
 * (Justin, E-240) — verschwiegen wird das Recht auf die Datenkopie trotzdem
 * nicht: Wer fragt, bekommt AUSKUNFT_KOSTENLOS_ANTWORT.
 *
 * ── WARUM DIE WERBESPERRE DAS ANGEBOT STREICHT ────────────────────────────
 * Die Bitte um eine Unterlage für den laufenden Vertrag ist keine Werbung —
 * das Angebot, eine Leistung für Geld zu kaufen, ist es. Wer „Stopp" gesagt
 * hat, bekommt nur die Bitte. Dasselbe, solange das Paket nicht bezahlt ist
 * (angebotLage): Die erste Rate geht vor, wie im Kundenbereich.
 */
export async function auskunftMailTeil(personId: number, lauf: Lauf = sqlPool): Promise<AuskunftMailTeil> {
  const { auskunftStand } = await import("../lib/fiaon-auskunft");
  // 25.09.2026: dieselbe Art-Regel wie alle Türen (Business-Paket → Firmen-Auskunft).
  const { auskunftArtFuer } = await import("../lib/fiaon-auskunft");
  const art = await auskunftArtFuer(personId, lauf);
  const stand = await auskunftStand(personId, lauf, art);
  if (stand.stufe === "bezahlt") return { modus: "weglassen", grund: "Die Auskunft ist bezahlt — wir holen sie ein, der Kunde muss nichts liefern." };
  // dokumentDa statt stufe === "dokument": Die Stufe stellt eine offene Bestellung
  // VOR das Dokument — wer selbst eine hochgeladen hat, bekommt trotzdem keine Zahlungsbitte.
  if (stand.dokumentDa) return { modus: "weglassen", grund: "Eine Auskunft liegt schon in der Akte." };
  if (stand.offen?.status === "claimed_paid") {
    return { modus: "weglassen", grund: "Der Kunde hat die Zahlung für die Auskunft gemeldet — sie wird geprüft, nicht erneut anmahnen." };
  }

  const land = stand.land;
  const wort = auskunftWort(land);
  const bei = auskunfteienText(land);
  const posten = `Ihre ${wort}`;
  const lage = await angebotLage(personId, lauf);

  // Gegenlesen 24.09.2026 (E-240): Die Werbesperre schlägt auch den Zahlungslink
  // einer OFFENEN Bestellung. 18 der 29 offenen Auskunft-Bestellungen unter den
  // Empfängern vom 24.09. waren älter als drei Wochen — „es fehlt nur noch die
  // Überweisung" an jemanden, der „Stopp" gesagt hat, drängt zum Abschluss. Und
  // die Tür (sperrUrteil, fiaon-mail-frequenz.ts) wertet bei Werbesperre jeden
  // nicht leeren angebot_text als Kaufangebot: Sie hielte sonst die GANZE Mail
  // an, samt der Bitte um den Ausweis.
  if (lage.werbesperre) {
    return { modus: "upload", land, posten, satz: null, knopf: null, betragText: null, ohneAngebot: "werbesperre" };
  }

  // Bestellt, aber noch nicht bezahlt: der Weg zur Zahlung, keine zweite Bestellung.
  if (stand.offen?.paymentReference) {
    const betrag = euroText(stand.offen.betragCents || stand.preis.cents);
    return {
      modus: "zahlen", land, posten, betragText: betrag, ohneAngebot: null,
      // Gegenlesen 24.09.2026: Nach der Zahlung kommt zuerst die Vollmacht zur
      // Unterschrift (schufa_requested, fiaon-auskunft-lieferung.ts) — erst dann
      // dürfen wir anfordern. Vorher stand hier, wir forderten gleich an. Und
      // „angelegt" statt „haben Sie beauftragt": Offene Bestellungen stammen auch
      // aus der Akte oder von Mara — der Satz stimmt für jede Tür.
      satz: `Für ${posten} ist bei uns schon ein Auftrag angelegt — es fehlt nur noch die Überweisung über ${betrag}. `
        + `Sobald sie eingegangen ist, schicken wir Ihnen die Vollmacht zur Unterschrift, fordern danach Ihre Datenkopien bei ${bei} an und erstellen daraus Ihren Handlungsplan.`,
      knopf: { text: `Zahlungsseite öffnen — ${betrag}`, url: absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`) },
    };
  }

  if (!lage.angebot) return { modus: "upload", land, posten, satz: null, knopf: null, betragText: null, ohneAngebot: lage.grund };

  // Integration 25.09.2026 (E-240): die gemeinsame Bremse. Kam das Angebot in den
  // letzten drei Tagen schon über einen anderen Weg (Angebots-Mail des Takts,
  // WhatsApp-Vorlage, Mara), bittet diese Mail nur um die Unterlage — sonst läse
  // der Kunde dasselbe Angebot zweimal in derselben Woche.
  const { zuletztAngeboten } = await import("../lib/fiaon-auskunft");
  const zuletzt = await zuletztAngeboten(personId, {}, lauf);
  if (zuletzt) {
    return { modus: "upload", land, posten, satz: null, knopf: null, betragText: null, ohneAngebot: "kuerzlich_angeboten", zuletzt: zuletzt.text };
  }

  const preis = stand.preis.text;
  return {
    modus: "angebot", land, posten, betragText: preis, ohneAngebot: null,
    satz: `${AUSKUNFT_NUTZEN_SATZ} Die Auskunft holen wir gern für Sie: Wir fordern Ihre Datenkopien bei ${bei} an, `
      + "erklären jeden Eintrag, prüfen die Speicherfristen und geben Ihnen Ihren persönlichen Handlungsplan "
      + `mit fertigen Schreiben zur Freigabe — für ${preis} einmalig${stand.preis.mitAbo ? ", Ihr Preis als Kunde mit laufendem Paket" : ""}.`,
    knopf: { text: `Auskunft für ${preis} beauftragen`, url: kaufLink(personId, art) },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Seiten
// ───────────────────────────────────────────────────────────────────────────

/**
 * 25.09.2026 (E-240): Die Belehrung DIESES Vertrags (Dienstleistung, einmalig) steht auf
 * der Seite selbst — /widerrufsbelehrung ist die Fassung für Abo und digitale Inhalte.
 */
function widerrufHtml(): string {
  const w = AUSKUNFT_WIDERRUF;
  const p = (t: string) => `<p class="leise" style="margin:0 0 6px">${esc(t)}</p>`;
  return `<details class="leise" style="margin-top:12px"><summary style="cursor:pointer">${esc(w.titel)} anzeigen</summary>`
    + p(w.gilt)
    + w.abschnitte.map((a) => `<p style="margin:10px 0 2px"><b>${esc(a.h)}</b></p>${a.absaetze.map(p).join("")}`).join("")
    + `<p style="margin:10px 0 2px"><b>${esc(w.erloeschen.h)}</b></p>${p(w.erloeschen.text)}`
    + `<p style="margin:10px 0 2px"><b>${esc(w.formular.titel)}</b></p>${p(w.formular.hinweis)}${p(w.formular.an)}`
    + w.formular.zeilen.map((z) => p(`— ${z}`)).join("") + p(w.formular.fuss)
    + `</details>`;
}

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Eine schlichte Seite im Stil der Abmeldeseite — hell, eine Spalte, ohne fremde Schriften. */
function seite(titel: string, inhalt: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(titel)} · FIAON</title>
<style>
:root{--grund:#f5f7fb;--karte:#fff;--text:#0f1b33;--leise:#5b6478;--linie:#dfe5ee;--blau:#1d4ed8;--blau-tief:#16318f}
body{margin:0;background:var(--grund);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--text)}
main{max-width:600px;margin:6vh auto;padding:0 16px}
.karte{background:var(--karte);border:1px solid var(--linie);border-radius:16px;padding:28px}
.marke{font:600 12px/1 -apple-system,Segoe UI,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--blau);margin:0 0 10px}
h1{font-size:23px;line-height:1.3;margin:0 0 12px;font-weight:650}
p{margin:0 0 12px}ul{margin:0 0 18px;padding-left:20px}li{margin:0 0 6px}
.preis{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:18px 0 6px}.preis b{font-size:30px;font-weight:650;white-space:nowrap}
.leise{color:var(--leise);font-size:14px}
.wahl{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--leise);margin:16px 0}
.wahl input{margin-top:4px;flex:none;width:18px;height:18px}
button,.knopf{display:block;width:100%;box-sizing:border-box;text-align:center;border:0;border-radius:12px;padding:16px;font:600 16px/1.2 -apple-system,Segoe UI,Arial,sans-serif;color:#fff;background:var(--blau);cursor:pointer;text-decoration:none}
button:hover,.knopf:hover{background:var(--blau-tief)}button:disabled{opacity:.6;cursor:default}
a{color:var(--blau)}.fuss{margin-top:14px;text-align:center;font-size:13px;color:var(--leise)}
.logo{margin:0 0 14px 4px;font:700 17px/1 -apple-system,Segoe UI,Arial,sans-serif;letter-spacing:.22em;color:var(--text)}
</style></head><body><main><p class="logo">FIAON</p><div class="karte">${inhalt}</div>
<p class="fuss">FIAON · <a href="${absoluteUrl("/")}">fiaon.com</a> · <a href="${absoluteUrl("/impressum")}">Impressum</a> · <a href="${absoluteUrl("/datenschutz")}">Datenschutz</a></p></main></body></html>`;
}

function senden(res: Response, status: number, html: string): void {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Die Seite trägt einen persönlichen Link — nicht zwischenspeichern, nicht weiterreichen.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.send(html);
}

const ZUM_BEREICH = `<p><a class="knopf" href="${absoluteUrl("/login")}">In meinen Bereich</a></p>`;

// ── WORTGLEICH MIT DER KAUFKARTE IM BEREICH (Gegenlesen 24.09.2026, E-240) ──
// client/src/components/kunde/AuskunftKauf.tsx (PREIS_STEUER, SOFORT_BEGINN_SATZ;
// dort wortgleich mit AGB § 5 und dem Global-Auftrag). Zwei Türen zu derselben
// Bestellung dürfen dem Kunden nicht zwei Fassungen zeigen — vorher fehlten hier
// Endpreis, „Kein Abo", der Vertragspartner und „Ohne diesen Haken …". Eine
// Client-Datei kann der Server nicht laden; wer hier ändert, ändert dort mit.
const PREIS_STEUER = "Endpreis einschließlich einer etwaig anfallenden Umsatzsteuer";
const SOFORT_BEGINN_SATZ =
  "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, "
  + "dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht "
  + "erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";

/**
 * Zwei Absendungen in einer Sekunde (Doppelklick trotz gesperrtem Knopf, ein
 * Browser, der das Formular wiederholt) dürfen keine zwei Bestellungen werden —
 * auskunftBestellen sieht die erste erst, wenn sie angelegt ist. Dasselbe
 * Muster wie POST /kunde/auskunft/bestellen (fiaon-kunde-bereich.ts).
 */
const bestellungLaeuft = new Set<number>();

function hinweisSeite(res: Response, status: number, titel: string, text: string, mitBereich = true): void {
  senden(res, status, seite(titel, `<p class="marke">Bonitätsauskunft</p><h1>${esc(titel)}</h1><p>${esc(text)}</p>${mitBereich ? ZUM_BEREICH : ""}`));
}

/**
 * Wem gehört der Link heute? Eine zusammengeführte Person zeigt auf ihre
 * Überlebende (ein Sprung) — der Link aus einer älteren Mail soll nicht ins
 * Leere laufen, nur weil zwei Datensätze inzwischen einer sind.
 */
async function personAufloesen(personId: number): Promise<{ id: number; geloescht: boolean; gekuendigt: boolean } | null> {
  const [p] = (await sqlPool`
    SELECT COALESCE(p.merged_into_person_id, p.id) AS id FROM fiaon_persons p WHERE p.id = ${personId} LIMIT 1
  `) as any[];
  if (!p) return null;
  const id = Number(p.id);
  const [z] = (await sqlPool`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${id} AND a.gdpr_deleted_at IS NOT NULL) AS geloescht,
      EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${id} AND a.merged_into IS NULL
                AND a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL) AS gekuendigt
  `) as any[];
  return { id, geloescht: !!z?.geloescht, gekuendigt: !!z?.gekuendigt };
}

/** Dieselbe Antwort wie die Kaufkarte im Bereich, solange das Paket nicht bezahlt ist. */
function paketOffenSeite(res: Response): void {
  hinweisSeite(res, 409, "Erst die erste Zahlung für Ihr Paket",
    "Die Bonitätsauskunft beauftragen Sie bei uns, sobald die erste Zahlung für Ihr Paket eingegangen ist. Die Zahlungsdaten finden Sie in Ihrem Bereich.");
}

/** Prüft Link und Person; schreibt bei jedem Hindernis selbst die Antwortseite. */
async function vorpruefen(req: Request, res: Response): Promise<{ personId: number; art: AuskunftArt } | null> {
  const urteil = kaufLinkPruefen(req.query as any);
  if (!urteil.ok) {
    hinweisSeite(res, urteil.abgelaufen ? 410 : 400,
      urteil.abgelaufen ? "Dieser Link ist abgelaufen" : "Dieser Link ist ungültig",
      "Sie können die Auskunft jederzeit in Ihrem Bereich beauftragen — oder Sie antworten einfach auf unsere E-Mail, dann kümmert sich Ihr Ansprechpartner darum.");
    return null;
  }
  const person = await personAufloesen(urteil.personId);
  if (!person || person.geloescht) {
    hinweisSeite(res, 404, "Dieser Link ist ungültig", "Zu diesem Link gibt es bei uns keine Akte mehr.", false);
    return null;
  }
  if (person.gekuendigt) {
    // E-213: Die Portalsperre gilt neuen Leistungen — derselbe Satz wie im Bereich.
    const { PORTAL_GESPERRT_SATZ } = await import("../lib/fiaon-kuendigung");
    hinweisSeite(res, 409, "Keine neue Beauftragung möglich", PORTAL_GESPERRT_SATZ);
    return null;
  }
  return { personId: person.id, art: urteil.art };
}

/** GET /auskunft/bestellen?p=&art=&exp=&sig= — die Bestätigungsseite (bestellt NICHTS). */
router.get("/auskunft/bestellen", async (req: Request, res: Response) => {
  try {
    const ok = await vorpruefen(req, res);
    if (!ok) return;
    const { auskunftStand } = await import("../lib/fiaon-auskunft");
    const stand = await auskunftStand(ok.personId, sqlPool, ok.art);
    if (stand.stufe === "bezahlt") {
      return hinweisSeite(res, 200, "Ihre Auskunft ist schon beauftragt",
        "Die Zahlung ist bei uns eingegangen — wir holen Ihre Auskunft ein. Den Stand sehen Sie in Ihrem Bereich.");
    }
    // Eine offene Bestellung: direkt zu ihrer Zahlungsseite, es entsteht nichts Neues.
    if (stand.offen?.paymentReference) {
      return res.redirect(303, absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`));
    }
    // Werbesperre zählt hier nicht — der Mensch hat selbst geklickt. Das Paket schon.
    if (!(await angebotLage(ok.personId)).paketBezahlt) return paketOffenSeite(res);
    // Gegenlesen 24.09.2026: Der Link kennt auch art=firma (Mara, Verkaufstakt) —
    // dann ist es nicht „Ihre SCHUFA-Auskunft", sondern die des Unternehmens.
    const wort = ok.art === "firma" ? "Firmen-Bonitätsauskunft" : auskunftWort(stand.land);
    const leistung = auskunftLeistung(ok.art, stand.land);
    const preis = stand.preis.text;
    // Das Formular schickt denselben signierten Link zurück — die Signatur gilt
    // der Person im Link (bei einer Zusammenführung der alten Kennung).
    const q = req.query as Record<string, unknown>;
    const aktion = `/api/fiaon/auskunft/bestellen?${new URLSearchParams({
      p: String(q.p), art: String(q.art), exp: String(q.exp), sig: String(q.sig),
    }).toString()}`;
    return senden(res, 200, seite(`${wort} beauftragen`, `
<p class="marke">Bonitätsauskunft · ${esc(stand.land === "DE" ? "Deutschland" : stand.land === "AT" ? "Österreich" : "Schweiz")}</p>
<h1>${esc(wort)} — wir holen sie für Sie</h1>
<p>${esc(AUSKUNFT_NUTZEN_SATZ)}</p>
<ul>${leistung.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<div class="preis"><b>${esc(preis)}</b><span class="leise">einmalig${stand.preis.mitAbo ? " · Ihr Preis als Kunde mit laufendem Paket" : ""}</span></div>
<p class="leise">${esc(PREIS_STEUER)}. Kein Abo. Ihr Vertragspartner ist die FIAON LTD. Bezahlt wird per Überweisung: Auf der nächsten Seite sehen Sie Betrag, Bankdaten und Verwendungszweck; die Zahlungsdaten bekommen Sie zusätzlich per E-Mail.</p>
<form method="post" action="${esc(aktion)}" onsubmit="this.querySelector('button').disabled=true">
  <label class="wahl"><input type="checkbox" name="sofort" value="ja">
  <span>${esc(SOFORT_BEGINN_SATZ)}</span></label>
  <p class="leise" style="margin:-6px 0 16px 35px">Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist.</p>
  <button type="submit">Zahlungspflichtig beauftragen — ${esc(preis)}</button>
</form>
<p class="leise" style="margin-top:14px">Mit dem Klick beauftragen Sie FIAON mit der ${esc(ok.art === "firma" ? "Firmen-Bonitätsauskunft" : "Bonitätsauskunft")} inklusive Handlungsplan. Es gelten unsere <a href="${absoluteUrl("/agb")}">AGB</a>; über Ihr Widerrufsrecht informiert die Widerrufsbelehrung unten. Sie haben schon eine aktuelle Auskunft? Dann laden Sie sie einfach <a href="${absoluteUrl("/login")}">in Ihrem Bereich</a> hoch.</p>
${ok.art === "firma" ? `<p class="leise">${esc(AUSKUNFT_KEIN_WIDERRUF)}</p>` : widerrufHtml()}`));
  } catch (err) {
    console.error("[AUSKUNFT-KAUF] Seite:", err);
    hinweisSeite(res, 500, "Das hat gerade nicht geklappt", "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
  }
});

/** POST /auskunft/bestellen?p=&art=&exp=&sig= — der zahlungspflichtige Klick. */
router.post("/auskunft/bestellen", async (req: Request, res: Response) => {
  // Nur wer die Sperre GESETZT hat, gibt sie wieder frei.
  let meineSperre: number | null = null;
  try {
    const ok = await vorpruefen(req, res);
    if (!ok) return;
    const { auskunftBestellen, auskunftStand } = await import("../lib/fiaon-auskunft");
    // Paket unbezahlt: nur eine schon offene Auskunft darf weiter (auskunftBestellen gibt ihren Link zurück).
    if (!(await angebotLage(ok.personId)).paketBezahlt && !(await auskunftStand(ok.personId, sqlPool, ok.art)).offen) {
      return paketOffenSeite(res);
    }
    if (bestellungLaeuft.has(ok.personId)) {
      return hinweisSeite(res, 409, "Ihre Beauftragung wird gerade angelegt",
        "Einen Moment bitte — die Zahlungsdaten bekommen Sie gleich per E-Mail. Den Stand sehen Sie auch in Ihrem Bereich.");
    }
    bestellungLaeuft.add(ok.personId);
    meineSperre = ok.personId;
    const best = await auskunftBestellen({ personId: ok.personId, art: ok.art, quelle: "kunde", von: "Kunde (Kauflink aus der E-Mail)" });
    if (best.art === "bezahlt") {
      return hinweisSeite(res, 200, "Ihre Auskunft ist schon beauftragt",
        "Die Zahlung ist bei uns eingegangen — wir holen Ihre Auskunft ein. Den Stand sehen Sie in Ihrem Bereich.");
    }
    if (!best.ok || !best.zahlungsseite) {
      console.error("[AUSKUNFT-KAUF] Bestellung:", best.fehler);
      return hinweisSeite(res, 500, "Das hat gerade nicht geklappt",
        "Ihre Beauftragung ist nicht durchgegangen. Bitte versuchen Sie es noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
    }
    // Die Wahl zum Beginn vor Ablauf der Widerrufsfrist gehört in die Akte —
    // ohne sie darf die Arbeit erst nach der Frist anfangen. Nie vorangekreuzt.
    // Gegenlesen 24.09.2026: nur bei einer NEUEN Bestellung (eine wiederverwendete
    // offene hat ihre Wahl schon — sonst stünden zwei, womöglich widersprüchliche,
    // im Verlauf) und im Wortlaut der Kaufkarte im Bereich (fiaon-kunde-bereich.ts),
    // damit die Beschaffung EINEN Satz sucht, egal durch welche Tür bestellt wurde.
    const sofort = String((req.body as any)?.sofort ?? "") === "ja";
    if (best.art === "neu" && best.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${best.ref}, ${ok.personId}, NULL, 'Kunde (Kauflink aus der E-Mail)', 'system',
                ${`Bonitätsauskunft über den Kauflink der E-Mail zahlungspflichtig beauftragt (${best.betragText || "Preis laut Bestellung"}${best.mitAbo ? ", Kundenpreis mit Paket" : ", Einzelpreis"}). `
                  + (sofort
                    ? "Beginn vor Ablauf der Widerrufsfrist AUSDRÜCKLICH VERLANGT — Hinweis auf anteiligen Wertersatz und Erlöschen des Widerrufsrechts bei vollständiger Erfüllung bestätigt."
                    : "Beginn vor Ablauf der Widerrufsfrist NICHT verlangt — mit der Anforderung erst nach Ablauf der 14-tägigen Widerrufsfrist beginnen.")})
      `.catch((e) => console.error("[AUSKUNFT-KAUF] Verlauf:", e));
    }
    return res.redirect(303, best.zahlungsseite);
  } catch (err) {
    console.error("[AUSKUNFT-KAUF] Bestellen:", err);
    hinweisSeite(res, 500, "Das hat gerade nicht geklappt", "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
  } finally {
    if (meineSperre != null) bestellungLaeuft.delete(meineSperre);
  }
});

export default router;
