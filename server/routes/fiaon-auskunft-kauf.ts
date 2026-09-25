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
//
// ── DER BESCHAFFUNGSAUFTRAG (25.09.2026, E-241) ─────────────────────────────
// Bis die API steht, kaufen wir die Auskunft selbst ein. Die Vollmacht zur
// Übermittlung deckt das nicht (nur die kostenlose Datenkopie). Deshalb:
//   4. Die Bestätigungsseite des Kauflinks trägt den Pflicht-Haken
//      AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT; ohne ihn bestellt der POST nichts
//      („Bitte bestätigen Sie den Auftrag"), mit ihm steht der Vermerk
//      AUSKUNFT_BESCHAFFUNG_VERMERK an der Bestellung.
//   5. Die Auftragsbestätigung nach der Zahlung (GET/POST /auskunft/auftrag/:token)
//      — für Bestellungen ohne Auftrag (Mara, Betreuer, Altbestand): Bestellung,
//      Leistung, derselbe Haken; das Absenden schreibt den Vermerk (idempotent).
//      Den Link verschickt die Beschaffung (auftragLinkSenden, fiaon-auskunft-lieferung.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "../lib/db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { AUSKUNFT_WIDERRUF, AUSKUNFT_KEIN_WIDERRUF } from "@shared/fiaon-auskunft-widerruf";
import { anredeMail } from "@shared/fiaon-anrede";
import {
  AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT,
  auskunftLeistung, auskunftWort, auskunfteienText, auskunftPreisCents, euroText,
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
 * Dazu nur in der Mail (nicht in angebotLage, die auch Akte und Mara fragen):
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
 * Darf dieser Mensch die Auskunft angeboten bekommen? EINE Regel für die
 * Unterlagen-Mail und die Akte — dieselbe wie die Kaufkarte im Kundenbereich
 * (fiaon-kunde-bereich.ts, Sperre „paket_offen"): Erst zählt die erste Zahlung
 * für das Paket, dann die Auskunft. Wer „Stopp" gesagt hat, bekommt kein Angebot.
 * Integration 25.09.2026 (E-241): Den KAUFLINK fragt sie nicht mehr — dort gilt
 * kaufSperre (unten): B und C beauftragen zum Einzelpreis, seit Justins
 * Entscheidung das Angebot auch an sie geht (Verkaufstakt, Kreis „alle").
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
    // 25.09.2026 (E-241): Im Einkauf (Standard) folgt auf die Zahlung keine Vollmacht zur
    // Unterschrift — wir beschaffen die Auskunft. Nur im Vollmacht-Weg bleibt der Satz vom 24.09.
    const { auskunftLiefermodus } = await import("../lib/fiaon-auskunft-lieferung");
    if ((await auskunftLiefermodus(lauf)) !== "vollmacht") {
      return {
        modus: "zahlen", land, posten, betragText: betrag, ohneAngebot: null,
        satz: `Für ${posten} ist bei uns schon ein Auftrag angelegt — es fehlt nur noch die Überweisung über ${betrag}. `
          + `Sobald sie eingegangen ist, beschaffen wir Ihre Auskunft bei ${bei} und erstellen daraus Ihren Handlungsplan.`,
        knopf: { text: `Zahlungsseite öffnen — ${betrag}`, url: absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`) },
      };
    }
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
 * Das Formular schickt denselben signierten Link zurück — die Signatur gilt der
 * Person im Link (bei einer Zusammenführung der alten Kennung).
 */
function kaufAktion(req: Request): string {
  const q = req.query as Record<string, unknown>;
  return `/api/fiaon/auskunft/bestellen?${new URLSearchParams({
    p: String(q.p), art: String(q.art), exp: String(q.exp), sig: String(q.sig),
  }).toString()}`;
}

/**
 * Der Pflicht-Haken des Beschaffungsauftrags (25.09.2026, E-241) — wortgleich an
 * jeder Kauftür (AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT). `required` hält den Browser
 * auf; der Server prüft trotzdem (ein Formular ohne Haken bestellt nichts).
 */
function auftragHaken(art: AuskunftArt): string {
  return `<label class="wahl"><input type="checkbox" name="auftrag" value="ja" required>
  <span style="color:var(--text)">${esc(AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(art))}</span></label>`;
}

/**
 * Ohne Haken: nichts geschieht — mit dem Weg zurück auf die Seite davor. `schluss`
 * sagt, was NICHT passiert ist: am Kauflink nichts bestellt, an der
 * Auftragsbestätigung (Bestellung schon bezahlt) nur der Auftrag noch nicht bestätigt.
 */
function auftragFehltSeite(res: Response, zurueck: string, schluss = "Es wurde noch nichts bestellt."): void {
  senden(res, 400, seite("Bitte bestätigen Sie den Auftrag", `<p class="marke">Bonitätsauskunft</p>
<h1>Bitte bestätigen Sie den Auftrag</h1>
<p>Damit wir Ihre Auskunft für Sie anfordern bzw. beschaffen dürfen, setzen Sie bitte den Haken beim Auftrag und klicken Sie danach erneut auf den Knopf. ${esc(schluss)}</p>
<p><a class="knopf" href="${esc(zurueck)}">Zurück zum Auftrag</a></p>`));
}

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

// ═══════════════════════════════════════════════════════════════════════════
// WER ÜBER DEN KAUFLINK BEAUFTRAGEN DARF (Integration 25.09.2026, E-241)
//
// Bis E-240 nur, wer ein Paket bezahlt hatte — „Erst die erste Zahlung für Ihr
// Paket" (paketOffenSeite, wie die Kaufkarte im Bereich). Seit Justins
// Entscheidung vom 25.09. geht das Angebot auch an fertige, unbezahlte Anträge
// (Segment B) und an Leads (Segment C) — zum Einzelpreis (auskunftPreis: ohne
// laufendes Paket 149 €, Firma 349 €). Der alte Riegel machte daraus eine
// Sackgasse: Jeder Kauflink der Takt-Mails an B und C, jeder Knopf der Vorlage
// fiaon_kk_auskunft_lead und jeder Link, den Mara einem offenen Antrag oder Lead
// auf sein „Ja, gerne" schickt, endete auf „Erst die erste Zahlung".
//
// Die Regel jetzt: Der Link ist signiert und persönlich — wer ihn hat, hat ihn
// von uns, und er klickt selbst. Der KREIS des Takts (auskunft_verkauf_kreis)
// gilt hier bewusst NICHT: Er regelt, wem WIR schreiben, nicht, wer kaufen darf
// (Mara schickt einem Antrag, der selbst nach der Auskunft fragt, den Link auch
// im Kreis „uwg"). Bleibt gesperrt:
//   · Kündigung und DSGVO-Löschung (vorpruefen, E-213),
//   · „Zahlung gemeldet" für das Paket ohne gebuchte Zahlung: Nach der Buchung
//     gilt der Kundenpreis (74 €, Firma 199 €) — heute den Einzelpreis zu
//     verlangen, wäre falsch (dieselbe Regel wie Mara, zahlung_gemeldet im Takt).
// ═══════════════════════════════════════════════════════════════════════════

/** null = darf beauftragen; sonst der Grund. */
export async function kaufSperre(personId: number, lauf: Lauf = sqlPool): Promise<"zahlung_gemeldet" | null> {
  const [z] = (await lauf`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${personId} AND a.merged_into IS NULL
                AND a.payment_status = 'claimed_paid' AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%') AS gemeldet,
      EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${personId} AND a.merged_into IS NULL
                AND a.payment_status = 'paid' AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%') AS bezahlt`) as any[];
  return z?.gemeldet && !z?.bezahlt ? "zahlung_gemeldet" : null;
}

/** „Zahlung gemeldet": nach der Buchung zum Kundenpreis — kein Einzelpreis heute. */
function zahlungGemeldetSeite(res: Response, art: AuskunftArt): void {
  const kundenpreis = euroText(auskunftPreisCents(art, true));
  hinweisSeite(res, 409, "Ihre Zahlung wird gerade geprüft",
    `Sie haben uns die erste Zahlung für Ihr Paket gemeldet — danke. Sobald sie gebucht ist, beauftragen Sie die ${art === "firma" ? "Firmen-Bonitätsauskunft" : "Bonitätsauskunft"} zu Ihrem Kundenpreis von ${kundenpreis}, über diesen Link oder in Ihrem Bereich.`);
}

/** Hat dieser Mensch einen Antrag (einen Bereich mit Unterlagen)? Ein Lead ohne Antrag nicht — dann kein Hochlade-Hinweis. */
async function hatAntrag(personId: number): Promise<boolean> {
  const [z] = (await sqlPool`
    SELECT 1 AS ja FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
       AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%' LIMIT 1`.catch(() => [])) as any[];
  return !!z;
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

// ═══════════════════════════════════════════════════════════════════════════
// DAS KLICK-PROTOKOLL (25.09.2026, E-241)
//
// Justin will den Verkauf als Trichter sehen: angeschrieben → geklickt →
// bestellt → bezahlt → geliefert (/chef/s/auskunft). „Geklickt" heißt: der
// Kauflink wurde geöffnet — die Bestätigungsseite unten wurde mit gültiger
// Signatur aufgerufen. Das ist die einzige Stelle, an der wir es sehen; ein
// Zählpixel in den Mails gibt es bewusst NICHT.
//
// Eine Zeile je Aufruf in fiaon_auskunft_klicks (Person, Art, Weg, Zeit); die
// Chefseite zählt Menschen je Tag, nicht Aufrufe. Der WEG ist unser eigenes
// Kennzeichen, kein gedeuteter Text:
//   · via=wa hängt nur der Knopf der WhatsApp-Vorlage an (GET /auskunft/k/:token
//     in fiaon-chef-auskunft.ts) — eindeutig WhatsApp;
//   · sonst das Angebot, das dem Entstehen des Links am nächsten liegt. Der Link
//     trägt exp = Entstehung + KAUF_LINK_TAGE; die Spuren (angebotSpurenSql,
//     die EINE Definition der Angebotswege in fiaon-auskunft.ts) tragen ihre
//     Uhrzeit. Mail (Angebots- und Unterlagen-Mail), WhatsApp-Vorlage, Mara
//     (Mail und WhatsApp). Findet sich keine: „unbekannt".
//
// Nicht gezählt: HEAD-Anfragen und Aufrufe, die sich als Vorschau- oder
// Prüfprogramm ausweisen (WhatsApp-Vorschau, Safe Links, Scanner). Ein Scanner,
// der sich als Browser ausgibt, zählt mit — die Chefseite sagt das dazu.
// Das Protokoll hält die Seite NIE auf: Es läuft nach der Antwort, Fehler
// landen im Log.
// ═══════════════════════════════════════════════════════════════════════════

export type KlickWeg = "mail" | "whatsapp" | "mara" | "unbekannt";

/** Die Angebotswege aus angebotSpurenSql → die Wege des Trichters. */
const SPUR_ZU_WEG: Record<string, KlickWeg> = {
  angebot_mail: "mail", unterlagen_mail: "mail", whatsapp_vorlage: "whatsapp", mara_mail: "mara", mara_whatsapp: "mara",
};

/** Vorschau-, Prüf- und Skriptprogramme — sie öffnen Links, ohne dass ein Mensch klickt. */
// Integration 25.09.2026: dazu „node" (so meldet sich fetch in Node.js, undici) — ein Skript ist kein Mensch.
const KEIN_MENSCH = /bot|crawl|spider|slurp|preview|whatsapp|telegram|facebookexternalhit|skype|safelinks|safe links|proofpoint|mimecast|barracuda|symantec|trendmicro|scanner|headless|python|curl|wget|go-http|java\/|okhttp|axios|node-fetch|^node$|undici|ms-office|microsoft office|outlook-ios|linkcheck/i;

let klicksBereit: Promise<void> | null = null;

/** Die Tabelle des Klick-Protokolls — auch die Chefseite ruft das vor dem Lesen. */
export function klicksTabelle(): Promise<void> {
  if (!klicksBereit) {
    klicksBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_auskunft_klicks (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER NOT NULL,
          art TEXT NOT NULL,
          weg TEXT NOT NULL,
          spur TEXT,
          link_vom TIMESTAMPTZ,
          zeit TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_auskunft_klicks_zeit_idx ON fiaon_auskunft_klicks (zeit DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_auskunft_klicks_person_idx ON fiaon_auskunft_klicks (person_id, zeit DESC)`;
    })().catch((e) => { klicksBereit = null; throw e; });
  }
  return klicksBereit;
}

/**
 * Einen Klick festhalten. `exp` aus dem Link (daraus die Entstehung), `via`
 * nur vom WhatsApp-Knopf. Gibt den ermittelten Weg zurück (für den Prüfstand).
 */
export async function klickMerken(ein: { personId: number; art: AuskunftArt; exp: unknown; via?: unknown; ua?: unknown; methode?: string }): Promise<KlickWeg | null> {
  if (ein.methode && ein.methode.toUpperCase() !== "GET") return null;
  const ua = String(ein.ua ?? "").trim();
  if (!ua || KEIN_MENSCH.test(ua)) return null;
  await klicksTabelle();
  const exp = Number(ein.exp);
  const vom = Number.isFinite(exp) ? exp - KAUF_LINK_TAGE * 86_400_000 : NaN;
  // Nur eine plausible Entstehung (die letzten KAUF_LINK_TAGE, nicht in der Zukunft) — sonst gilt „das jüngste Angebot".
  const linkVom = Number.isFinite(vom) && vom <= Date.now() + 60_000 && vom >= Date.now() - (KAUF_LINK_TAGE + 1) * 86_400_000 ? new Date(vom) : null;
  let weg: KlickWeg = "unbekannt";
  let spur: string | null = null;
  if (String(ein.via ?? "") === "wa") {
    weg = "whatsapp"; spur = "whatsapp_vorlage";
  } else {
    const { angebotSpurenSql } = await import("../lib/fiaon-auskunft");
    const [z] = (await sqlPool.unsafe(`
      SELECT s.weg FROM (${angebotSpurenSql("$1::int", KAUF_LINK_TAGE + 1)}) s
       WHERE s.am IS NOT NULL AND s.am <= NOW()
       ORDER BY CASE WHEN $2::timestamptz IS NULL THEN 0 ELSE ABS(EXTRACT(EPOCH FROM (s.am - $2::timestamptz))) END ASC, s.am DESC
       LIMIT 1`, [ein.personId, linkVom ? linkVom.toISOString() : null])) as any[];
    if (z?.weg) { spur = String(z.weg); weg = SPUR_ZU_WEG[spur] ?? "unbekannt"; }
  }
  await sqlPool`
    INSERT INTO fiaon_auskunft_klicks (person_id, art, weg, spur, link_vom)
    VALUES (${ein.personId}, ${ein.art}, ${weg}, ${spur}, ${linkVom ? linkVom.toISOString() : null})`;
  return weg;
}

/** GET /auskunft/bestellen?p=&art=&exp=&sig= — die Bestätigungsseite (bestellt NICHTS). */
router.get("/auskunft/bestellen", async (req: Request, res: Response) => {
  try {
    const ok = await vorpruefen(req, res);
    if (!ok) return;
    // E-241: der Klick für den Trichter der Chefseite — nach der Antwort, nie auf ihre Kosten.
    const q0 = req.query as Record<string, unknown>;
    res.once("finish", () => {
      klickMerken({ personId: ok.personId, art: ok.art, exp: q0.exp, via: q0.via, ua: req.headers["user-agent"], methode: req.method })
        .catch((e) => console.error("[AUSKUNFT-KAUF] Klick-Protokoll:", String((e as Error)?.message || e).slice(0, 200)));
    });
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
    // Werbesperre zählt hier nicht — der Mensch hat selbst geklickt. Das Paket seit E-241 auch nicht
    // (kaufSperre oben): B und C beauftragen zum Einzelpreis, nur „Zahlung gemeldet" wartet auf die Buchung.
    if (await kaufSperre(ok.personId)) return zahlungGemeldetSeite(res, ok.art);
    // Ein Lead ohne Antrag hat keinen Bereich mit Unterlagen — dann kein Hochlade-Hinweis (wie die Angebots-Mail).
    const mitBereich = await hatAntrag(ok.personId);
    // Gegenlesen 24.09.2026: Der Link kennt auch art=firma (Mara, Verkaufstakt) —
    // dann ist es nicht „Ihre SCHUFA-Auskunft", sondern die des Unternehmens.
    const wort = ok.art === "firma" ? "Firmen-Bonitätsauskunft" : auskunftWort(stand.land);
    const leistung = auskunftLeistung(ok.art, stand.land);
    const preis = stand.preis.text;
    // Das Formular schickt denselben signierten Link zurück — die Signatur gilt
    // der Person im Link (bei einer Zusammenführung der alten Kennung).
    const aktion = kaufAktion(req);
    // E-241: „Limit" nur für zahlende Kunden — Anträge und Leads lesen den Nutzen ohne (VERBOTENE_WORTE, § 34c GewO).
    const nutzen = stand.preis.mitAbo ? AUSKUNFT_NUTZEN_SATZ : AUSKUNFT_NUTZEN_SATZ_KARTE;
    return senden(res, 200, seite(`${wort} beauftragen`, `
<p class="marke">Bonitätsauskunft · ${esc(stand.land === "DE" ? "Deutschland" : stand.land === "AT" ? "Österreich" : "Schweiz")}</p>
<h1>${esc(wort)} — wir holen sie für Sie</h1>
<p>${esc(nutzen)}</p>
<ul>${leistung.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<div class="preis"><b>${esc(preis)}</b><span class="leise">einmalig${stand.preis.mitAbo ? " · Ihr Preis als Kunde mit laufendem Paket" : ""}</span></div>
<p class="leise">${esc(PREIS_STEUER)}. Kein Abo. Ihr Vertragspartner ist die FIAON LTD. Bezahlt wird per Überweisung: Auf der nächsten Seite sehen Sie Betrag, Bankdaten und Verwendungszweck; die Zahlungsdaten bekommen Sie zusätzlich per E-Mail.</p>
<form method="post" action="${esc(aktion)}" onsubmit="this.querySelector('button').disabled=true">
  ${auftragHaken(ok.art)}
  <label class="wahl"><input type="checkbox" name="sofort" value="ja">
  <span>${esc(SOFORT_BEGINN_SATZ)}</span></label>
  <p class="leise" style="margin:-6px 0 16px 35px">Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist.</p>
  <button type="submit">Zahlungspflichtig beauftragen — ${esc(preis)}</button>
</form>
<p class="leise" style="margin-top:14px">Mit dem Klick beauftragen Sie FIAON mit der ${esc(ok.art === "firma" ? "Firmen-Bonitätsauskunft" : "Bonitätsauskunft")} inklusive Handlungsplan. Es gelten unsere <a href="${absoluteUrl("/agb")}">AGB</a>; über Ihr Widerrufsrecht informiert ${ok.art === "firma" ? "der Hinweis" : "die Widerrufsbelehrung"} unten.${mitBereich ? ` Sie haben schon eine aktuelle Auskunft? Dann laden Sie sie einfach <a href="${absoluteUrl("/login")}">in Ihrem Bereich</a> hoch.` : ""}</p>
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
    const { auskunftBestellen, auskunftStand, beschaffungsauftragVermerken } = await import("../lib/fiaon-auskunft");
    const vorher = await auskunftStand(ok.personId, sqlPool, ok.art, { land: false });
    if (vorher.stufe === "bezahlt") {
      return hinweisSeite(res, 200, "Ihre Auskunft ist schon beauftragt",
        "Die Zahlung ist bei uns eingegangen — wir holen Ihre Auskunft ein. Den Stand sehen Sie in Ihrem Bereich.");
    }
    // E-241: dieselbe Regel wie die Seite (kaufSperre) — „Zahlung gemeldet" wartet auf die Buchung;
    // eine schon offene Auskunft darf weiter (auskunftBestellen gibt ihren Link zurück).
    if ((await kaufSperre(ok.personId)) && !vorher.offen) return zahlungGemeldetSeite(res, ok.art);
    // 25.09.2026 (E-241): ohne den Beschaffungsauftrag keine Bestellung — der Pflicht-Haken der Seite.
    const auftrag = String((req.body as any)?.auftrag ?? "") === "ja";
    if (!auftrag) return auftragFehltSeite(res, kaufAktion(req));
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
    // E-241: der Beschaffungsauftrag an die Bestellung — auch an eine wiederverwendete offene
    // (sie hatte ihn womöglich noch nicht); ein zweiter Vermerk entsteht nie (idempotent).
    if (best.ref) {
      await beschaffungsauftragVermerken({
        ref: best.ref, personId: ok.personId, art: ok.art, weg: "kauflink", von: "Kunde (Kauflink aus der E-Mail)",
      }).catch((e) => console.error("[AUSKUNFT-KAUF] Beschaffungsauftrag:", e));
    }
    return res.redirect(303, best.zahlungsseite);
  } catch (err) {
    console.error("[AUSKUNFT-KAUF] Bestellen:", err);
    hinweisSeite(res, 500, "Das hat gerade nicht geklappt", "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
  } finally {
    if (meineSperre != null) bestellungLaeuft.delete(meineSperre);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFTRAGSBESTÄTIGUNG NACH DER ZAHLUNG (25.09.2026, E-241)
//
// Für bezahlte Auskünfte, an denen kein Beschaffungsauftrag steht (Bestellung
// über Mara, den Betreuer, Altbestand — oder nur mit der Vollmacht zur
// Übermittlung, die den Kauf nicht deckt). Die Beschaffung schickt den Link
// (auftragLinkSenden, fiaon-auskunft-lieferung.ts; Mail schufa_requested in der
// Fassung „Einkauf"). Vorher war es der Link auf /app/unterschrift — eine
// Vollmacht, die den Kauf nicht deckt und alle sieben Antragsarten vorhakte.
//
//   GET  /auskunft/auftrag/:token — Bestellung, Leistung, Auskunfteien und der
//        Pflicht-Haken AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT. Bestellt NICHTS und
//        schreibt nichts (Postfach-Schutzprogramme öffnen Links vorab).
//   POST /auskunft/auftrag/:token — mit Haken: AUSKUNFT_BESCHAFFUNG_VERMERK an
//        der Bestellung (idempotent — ein zweiter Klick schreibt keinen zweiten),
//        Nachtrag an der Aufgabe der Beschaffung; über die API (angebunden,
//        fällig) gleich der Abruf. Ohne Haken: „Bitte bestätigen Sie den Auftrag".
//
// Das Token: <Auftrags-Nr>.<exp>.<sig> (HMAC mit SESSION_SECRET, wie der
// Kauflink). Es steht im Pfad — das Anfrage-Protokoll (index.ts) schreibt diesen
// Pfad deshalb nur als /auskunft/auftrag/…, das Mail-Protokoll verbirgt den
// Link (unterschrift_url, payloadSchwaerzen). Der Link erlaubt nur eines: den
// Auftrag DIESER bezahlten Bestellung zu bestätigen.
// ═══════════════════════════════════════════════════════════════════════════

/** Wie lange der Link zur Auftragsbestätigung gilt — die Mail wird oft erst Tage später gelesen. */
export const AUFTRAG_LINK_TAGE = 30;

function auftragSignatur(id: number, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`auskunft-auftrag.${id}.${exp}`).digest("hex").slice(0, 32);
}

/** Der Link für die Mail: /api/fiaon/auskunft/auftrag/<id>.<exp>.<sig> (id = fiaon_auskunft_beschaffung.id). */
export function auftragLink(beschaffungId: number, ttlMs = AUFTRAG_LINK_TAGE * 86_400_000): string {
  const exp = Date.now() + ttlMs;
  return absoluteUrl(`/api/fiaon/auskunft/auftrag/${beschaffungId}.${exp}.${auftragSignatur(beschaffungId, exp)}`);
}

export type AuftragTokenUrteil = { ok: true; id: number } | { ok: false; abgelaufen: boolean };

export function auftragTokenPruefen(token: unknown): AuftragTokenUrteil {
  const m = String(token ?? "").match(/^(\d{1,12})\.(\d{10,16})\.([0-9a-f]{32})$/);
  if (!m) return { ok: false, abgelaufen: false };
  const id = Number(m[1]);
  const exp = Number(m[2]);
  const a = Buffer.from(auftragSignatur(id, exp));
  const b = Buffer.from(m[3]);
  if (id <= 0 || a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, abgelaufen: false };
  // Erst NACH der Signatur: Nur ein echter Link darf „abgelaufen" hören.
  if (exp < Date.now()) return { ok: false, abgelaufen: true };
  return { ok: true, id };
}

type BeschaffungAuftragT = import("../lib/fiaon-auskunft-lieferung").BeschaffungAuftrag;

const isoDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const tagDe = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : null);

/** Prüft Token und Auftrag; schreibt bei jedem Hindernis selbst die Antwortseite. */
async function auftragVorpruefen(req: Request, res: Response): Promise<BeschaffungAuftragT | null> {
  const u = auftragTokenPruefen(req.params.token);
  if (!u.ok) {
    hinweisSeite(res, u.abgelaufen ? 410 : 400, u.abgelaufen ? "Dieser Link ist abgelaufen" : "Dieser Link ist ungültig",
      "Antworten Sie einfach auf unsere E-Mail — dann bekommen Sie einen neuen Link, oder Ihr Ansprechpartner klärt den Auftrag mit Ihnen.");
    return null;
  }
  const { beschaffungListe } = await import("../lib/fiaon-auskunft-lieferung");
  const [a] = await beschaffungListe({ id: u.id });
  if (!a) {
    hinweisSeite(res, 404, "Dieser Link ist ungültig", "Zu diesem Link gibt es bei uns keinen Auftrag mehr.", false);
    return null;
  }
  if (a.status === "fertig") {
    hinweisSeite(res, 200, "Ihre Auskunft liegt schon vor", "Wir haben Ihre Auskunft beschafft — Sie finden sie mit der Auswertung in Ihrem Bereich.");
    return null;
  }
  if (!a.bestellung.bezahlt) {
    hinweisSeite(res, 409, "Diese Bestellung ist nicht mehr aktiv",
      "Zu dieser Bestellung ist keine Zahlung mehr verbucht — es gibt nichts zu bestätigen. Fragen? Antworten Sie einfach auf unsere E-Mail.");
    return null;
  }
  return a;
}

/** Bei wem beschafft wird — die Namen, die der Auftrag „oben" meint. */
function stellenText(a: BeschaffungAuftragT): string {
  const bei = auskunfteienText(a.land);
  return a.art === "firma" ? `die Wirtschaftsauskunfteien (z. B. Creditreform, CRIF) und für Sie persönlich ${bei}` : bei;
}

/** Was nach der Bestätigung kommt — auf der Seite (`vorher`: „Nach Ihrer Bestätigung …") und auf der Dankeseite. */
function danachSatz(a: BeschaffungAuftragT, vorher = false): string {
  const wann = a.faellig
    ? (vorher ? "Nach Ihrer Bestätigung beschaffen wir Ihre Auskunft." : "Wir beschaffen Ihre Auskunft jetzt.")
    : `Wie bei Ihrer Beauftragung gewählt, beginnen wir damit erst nach Ablauf der Widerrufsfrist, ab dem ${isoDe(a.faelligAb)}.`;
  return `${wann} Sobald sie da ist, bekommen Sie Bescheid und finden sie in Ihrem Bereich — mit der Erklärung jedes Eintrags, Ihrem Handlungsplan und fertigen Schreiben zur Freigabe.`;
}

/** GET /auskunft/auftrag/:token — die Seite zur Auftragsbestätigung (schreibt NICHTS). */
router.get("/auskunft/auftrag/:token", async (req: Request, res: Response) => {
  try {
    const a = await auftragVorpruefen(req, res);
    if (!a) return;
    if (a.einwilligung.quelle === "auftrag") {
      return senden(res, 200, seite("Ihr Auftrag ist bestätigt", `<p class="marke">Bonitätsauskunft</p>
<h1>Ihr Auftrag ist bestätigt</h1><p>${esc(danachSatz(a))}</p>${ZUM_BEREICH}`));
    }
    const betrag = a.bestellung.betragCents != null ? euroText(a.bestellung.betragCents) : null;
    const bezahltAm = tagDe(a.bestellung.bezahltAm);
    const was = a.art === "firma" ? "Firmen-Bonitätsauskunft" : auskunftWort(a.land);
    return senden(res, 200, seite("Auftrag bestätigen", `
<p class="marke">Bonitätsauskunft · ${esc(a.land === "DE" ? "Deutschland" : a.land === "AT" ? "Österreich" : "Schweiz")}</p>
<h1>Bitte bestätigen Sie Ihren Auftrag</h1>
<p>${esc(anredeMail({ vorname: a.kunde.vorname, nachname: a.kunde.nachname }))} Ihre Zahlung ist eingegangen — danke. Damit wir Ihre ${esc(was)} für Sie beschaffen dürfen, fehlt nur noch Ihre Bestätigung.</p>
<ul>
  <li><b>Bestellung:</b> ${esc(a.bestellung.paket || "Bonitätsauskunft inkl. Handlungsplan")} (${esc(a.ref)})</li>
  ${betrag ? `<li><b>Bezahlt:</b> ${esc(betrag)}${bezahltAm ? ` am ${esc(bezahltAm)}` : ""}</li>` : ""}
  <li><b>Auskunfteien:</b> ${esc(stellenText(a))}</li>
  <li><b>Leistung:</b> Wir beschaffen Ihre Auskunft, erklären jeden Eintrag in klaren Worten, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.</li>
</ul>
<form method="post" action="${esc(`/api/fiaon/auskunft/auftrag/${String(req.params.token)}`)}" onsubmit="this.querySelector('button').disabled=true">
  ${auftragHaken(a.art)}
  <button type="submit">Auftrag bestätigen</button>
</form>
<p class="leise" style="margin-top:14px">${esc(danachSatz(a, true))} Mit dem Klick entstehen keine weiteren Kosten.</p>`));
  } catch (err) {
    console.error("[AUSKUNFT-AUFTRAG] Seite:", err);
    hinweisSeite(res, 500, "Das hat gerade nicht geklappt", "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
  }
});

/** POST /auskunft/auftrag/:token — der Haken wird zum Vermerk (idempotent). */
router.post("/auskunft/auftrag/:token", async (req: Request, res: Response) => {
  try {
    const a = await auftragVorpruefen(req, res);
    if (!a) return;
    if (String((req.body as any)?.auftrag ?? "") !== "ja") {
      return auftragFehltSeite(res, `/api/fiaon/auskunft/auftrag/${String(req.params.token)}`, "Ihr Auftrag ist noch nicht bestätigt.");
    }
    if (a.einwilligung.quelle !== "auftrag") {
      const { beschaffungsauftragVermerken } = await import("../lib/fiaon-auskunft");
      const neu = await beschaffungsauftragVermerken({
        ref: a.ref, personId: a.personId, art: a.art, weg: "bestaetigung", von: "Kunde (Auftragsbestätigung)",
      });
      if (neu) {
        // Die Aufgabe der Beschaffung sagte „Einwilligung FEHLT" — sie bekommt den Nachtrag.
        const jetzt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        await sqlPool`
          UPDATE fiaon_betreiber_todos SET text = CONCAT(COALESCE(text, ''), ${`\n\nNachtrag ${jetzt} Uhr: Der Kunde hat den Beschaffungsauftrag bestätigt — die Einwilligung liegt vor.`}::text), updated_at = NOW()
           WHERE schluessel = ${`auskunft-beschaffung:${a.ref}`} AND status <> 'erledigt'`.catch((e) => console.error("[AUSKUNFT-AUFTRAG] Nachtrag Aufgabe:", e));
        await sqlPool`UPDATE fiaon_auskunft_beschaffung SET updated_at = NOW() WHERE id = ${a.id}`.catch(() => {});
        // Über die API (angebunden, fällig): gleich abrufen — nie auf Kosten der Antwort.
        const L = await import("../lib/fiaon-auskunft-lieferung");
        const { auskunftApiAngebunden } = await import("../lib/fiaon-auskunft-quelle");
        if (a.faellig && (await L.auskunftLiefermodus()) === "api" && auskunftApiAngebunden()) {
          void L.apiVersuch(a.id).catch((e) => console.error(`[AUSKUNFT-AUFTRAG] ${a.ref}: API-Abruf:`, e));
        }
      }
    }
    return senden(res, 200, seite("Ihr Auftrag ist bestätigt", `<p class="marke">Bonitätsauskunft</p>
<h1>Danke — Ihr Auftrag ist bestätigt</h1><p>${esc(danachSatz(a))}</p>${ZUM_BEREICH}`));
  } catch (err) {
    console.error("[AUSKUNFT-AUFTRAG] Bestätigen:", err);
    hinweisSeite(res, 500, "Das hat gerade nicht geklappt", "Bitte versuchen Sie es in ein paar Minuten noch einmal — oder antworten Sie einfach auf unsere E-Mail.");
  }
});

export default router;
