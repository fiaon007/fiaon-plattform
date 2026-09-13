// ═══════════════════════════════════════════════════════════════════════════
// /mitarbeiter/abschluss/:token — der Abschluss der Mitarbeiterzeit
//
// ── WARUM ES DIESE SEITE GIBT (Justin, 13.09.2026) ────────────────────────
// Ein gekündigter Mitarbeiter meldet sich an und soll nicht vor einer Wand
// stehen, sondern vor einem sauberen Ende: die Kündigung lesen, den Erhalt
// digital unterschreiben, eine E-Mail-Adresse nennen, an die die
// unterschriebene Ausfertigung als PDF geht — und erfahren, dass alle offenen
// Provisionen am 1. des Folgemonats ausgezahlt werden. „Sehr professionell,
// ein Top-Prozess, alles 100 % richtig."
//
// ── WIE MAN HIERHER KOMMT ─────────────────────────────────────────────────
// Der Login (`pages/agent/Anmeldung.tsx`) bekommt bei gekündigten Konten ein
// `abschlussToken` und leitet hierher. Die Seite selbst verlangt KEINE
// Anmeldung: Der Zugang ist gesperrt, der Token ist der Ausweis. Dieselbe
// Bauweise wie /zustimmung/:token für Kunden — nur mit dem Office-CI.
//
// ── DER SERVER ENTSCHEIDET, DIE SEITE ZEIGT ───────────────────────────────
// Das Schreiben kommt fertig gerendert (`dokumentHtml`, vertrauenswürdig,
// vom Server erzeugt — keine Nutzereingabe darin), Fristen und Beträge
// rechnet der Server. Die Seite prüft nur, ob die Eingabe vollständig ist,
// bevor sie den Knopf freigibt; die eigentliche Prüfung wiederholt der Server.
//
// ── UNTERSCHRIFT ──────────────────────────────────────────────────────────
// Dieselbe Leinwand wie beim Vertrag zum Eintritt (components/agent/
// SignaturPad.tsx), Finger oder Maus. Wer nicht zeichnen kann oder will,
// tippt seinen Namen — der Server hält beides als Empfangsbestätigung fest.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import SignaturePad from "@/components/agent/SignaturPad";
import "@/styles/agent-anmeldung.css";
import "@/styles/mitarbeiter-abschluss.css";

interface Lage {
  vorname: string;
  name: string;
  unterschrieben: boolean;
  unterschriebenAm: string | null;
  unterschriftName: string | null;
  ausgesprochenAm: string;
  wirksamAm: string;
  freigestelltAb: string;
  schlussabrechnungAm: string | null;
  schlussabrechnungText: string;
  provisionenOffenCents: number;
  provisionenAnzahl: number;
  ibanMaskiert: string | null;
  emailVorschlag: string;
  empfangsEmail: string | null;
  mailVersandtAm: string | null;
  mailFehler: string | null;
  dokumentHtml: string;
  pdfUrl: string | null;
  schlussPayoutId?: number | null;
  schlussBetragCents?: number | null;
  schlussAbgeschlossenAm?: string | null;
  anforderungenOffenCents?: number;
}

interface MailErgebnis { versandt: boolean; an: string; grund?: string }

/** „2026-09-13" → „13.09.2026"; ein Zeitstempel → „13.09.2026, 14:05 Uhr" (Berlin). */
function datum(wert: string | null | undefined, mitZeit = false): string {
  if (!wert) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return wert;
  const tag = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  if (!mitZeit) return tag;
  const zeit = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  return `${tag}, ${zeit} Uhr`;
}

function eur(cents: number | null | undefined): string {
  return `${(Number(cents ?? 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Fehlertext je HTTP-Status, falls der Server keinen mitschickt. */
function fehlerText(status: number | undefined, vomServer: unknown): string {
  if (typeof vomServer === "string" && vomServer.trim()) return vomServer;
  if (status === 410) return "Dieser Link ist abgelaufen. Bitte melde dich bei Florentine oder Daniel, dann bekommst du einen neuen Link.";
  if (status === 404 || status === 400) return "Dieser Link ist ungültig. Bitte melde dich bei Florentine oder Daniel.";
  return "Wir konnten die Seite gerade nicht laden. Bitte prüfe deine Verbindung und versuche es noch einmal.";
}

export default function MitarbeiterAbschlussPage() {
  const [, params] = useRoute("/mitarbeiter/abschluss/:token");
  const token = params?.token || "";

  const [lage, setLage] = useState<Lage | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  // Formular — Haken stehen alle hier oben, vor dem ersten `return`.
  const [modus, setModus] = useState<"drawn" | "typed">("drawn");
  const [unterschriftPng, setUnterschriftPng] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bestaetigt, setBestaetigt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [mail, setMail] = useState<MailErgebnis | null>(null);

  useEffect(() => { document.title = "Abschluss · FIAON Mitarbeiterbereich"; }, []);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await fetch(`/api/fiaon/abschluss/${encodeURIComponent(token)}`, { credentials: "include" }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setLaedt(false);
    if (!res || !j?.ok || !j.lage) { setLadeFehler(fehlerText(res?.status, j?.error)); return; }
    const l = j.lage as Lage;
    setLadeFehler(null);
    setLage(l);
    // Vorbelegung nur, solange der Mensch noch nichts eingetippt hat.
    setName((v) => v || l.name || "");
    setEmail((v) => v || l.emailVorschlag || "");
  }, [token]);

  useEffect(() => { void laden(); }, [laden]);

  const nameOk = name.trim().length >= 3;
  const emailOk = EMAIL_OK.test(email.trim());
  const unterschriftOk = modus === "typed" || !!unterschriftPng;
  const bereit = !!lage && !lage.unterschrieben && nameOk && emailOk && unterschriftOk && bestaetigt && !sendet;

  const unterschreiben = async () => {
    if (!bereit) return;
    setSendet(true);
    setFehler(null);
    const res = await fetch(`/api/fiaon/abschluss/${encodeURIComponent(token)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signatureName: name.trim(),
        signatureMode: modus,
        signaturePng: modus === "drawn" ? unterschriftPng : null,
        email: email.trim(),
        confirm: true,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setSendet(false);
    // ── JEDER AUSGANG IST SICHTBAR ────────────────────────────────────────
    if (res?.status === 409) {
      // Schon unterschrieben (zweiter Reiter, doppelter Klick) — die Lage neu
      // holen, dann steht die Bestätigung da statt eines Formulars.
      await laden();
      return;
    }
    if (!res || !j?.ok || !j.lage) {
      setFehler(typeof j?.error === "string" && j.error.trim()
        ? j.error
        : "Deine Unterschrift ist nicht angekommen. Bitte prüfe deine Verbindung und versuche es noch einmal.");
      return;
    }
    setLage(j.lage as Lage);
    setMail((j.mail as MailErgebnis) ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buehne = (inhalt: React.ReactNode) => (
    <div className="aa">
      <div className="aa-bild" aria-hidden="true"><img src="/office/flur.jpg" alt="" decoding="async" /><div className="aa-schleier" /></div>
      <header className="aa-kopf"><a href="/" className="aa-wort">FIAON</a><span className="aa-marke">Mitarbeiterbereich</span></header>
      {inhalt}
    </div>
  );

  if (laedt) {
    return buehne(
      <section className="ma-mitte">
        <span className="aa-pille">Abschluss deiner Zeit bei FIAON</span>
        <h1>Einen <span className="aa-verlauf">Moment.</span></h1>
        <p>Deine Unterlagen werden geladen.</p>
      </section>,
    );
  }

  if (ladeFehler || !lage) {
    return buehne(
      <section className="ma-mitte">
        <span className="aa-pille">Link nicht gültig</span>
        <h1>Das hat <span className="aa-verlauf">nicht geklappt.</span></h1>
        <p>{ladeFehler || fehlerText(undefined, null)}</p>
      </section>,
    );
  }

  // ── Mail-Zeile nach der Unterschrift ──────────────────────────────────────
  // Frisch unterschrieben: `mail` vom POST. Später wieder geöffnet: die Felder
  // der Lage. Ein Fehlschlag wird ausgesprochen — die PDF liegt trotzdem da.
  const mailVersandt = mail ? mail.versandt : !!lage.mailVersandtAm;
  const mailAn = mail?.an || lage.empfangsEmail || "";
  const mailGrund = mail?.grund || lage.mailFehler || "";
  const provisionenSatz = lage.schlussPayoutId
    ? `Deine Schlussabrechnung über ${eur(lage.schlussBetragCents ?? 0)} ist angewiesen (Anforderung #${lage.schlussPayoutId}) — die Überweisung ${lage.ibanMaskiert ? `auf ${lage.ibanMaskiert}` : "auf dein hinterlegtes Konto"} folgt.`
    : lage.provisionenOffenCents > 0
      ? `Deine offenen Provisionen (${eur(lage.provisionenOffenCents)}, ${lage.provisionenAnzahl} ${lage.provisionenAnzahl === 1 ? "Buchung" : "Buchungen"}) werden am ${datum(lage.schlussabrechnungAm)} ${lage.ibanMaskiert ? `auf ${lage.ibanMaskiert}` : "auf das bei uns hinterlegte Konto"} ausgezahlt.${(lage.anforderungenOffenCents ?? 0) > 0 ? ` Dazu kommen bereits angeforderte, noch nicht überwiesene ${eur(lage.anforderungenOffenCents ?? 0)}.` : ""}`
      : lage.schlussAbgeschlossenAm
        ? "Es waren keine Provisionen mehr offen — die Abrechnung ist damit vollständig."
        : `Zurzeit sind keine Provisionen offen. Was bis ${datum(lage.schlussabrechnungAm)} noch bestätigt wird, zahlen wir an diesem Tag aus.`;

  return buehne(
    <main className="ma-buehne">
      <section className="ma-kopf">
        <span className="aa-pille">Abschluss deiner Zeit bei FIAON</span>
        <h1>Deine Kündigung, {lage.vorname || lage.name} — <span className="aa-verlauf">sauber abgeschlossen.</span></h1>
        <p>Lies das Schreiben, bestätige den Erhalt mit deiner Unterschrift und gib die E-Mail-Adresse an, an die die unterschriebene Ausfertigung gehen soll.</p>
      </section>

      <div className="ma-kacheln">
        <div className="ma-kachel">
          <small>Kündigung ausgesprochen</small>
          <b>{datum(lage.ausgesprochenAm)}</b>
        </div>
        <div className="ma-kachel">
          <small>Vertragsende</small>
          <b>{datum(lage.wirksamAm)}</b>
          <span>freigestellt ab {datum(lage.freigestelltAb)}</span>
        </div>
        <div className="ma-kachel">
          <small>Offene Provisionen</small>
          <b>{eur(lage.provisionenOffenCents)}</b>
          <span>{lage.provisionenAnzahl} {lage.provisionenAnzahl === 1 ? "Buchung" : "Buchungen"}</span>
        </div>
        <div className="ma-kachel breit">
          <small>Auszahlung</small>
          {lage.unterschrieben && lage.schlussabrechnungAm
            ? <b>{datum(lage.schlussabrechnungAm)}</b>
            : <b className="klein">{lage.schlussabrechnungText}</b>}
          <span>{lage.ibanMaskiert ? `auf IBAN ${lage.ibanMaskiert}` : "IBAN noch nicht hinterlegt — bitte an Florentine oder Daniel"}</span>
        </div>
      </div>

      {lage.unterschrieben && (
        <section className="ma-fertig" aria-live="polite">
          <h2>Unterschrieben am {datum(lage.unterschriebenAm, true)} von {lage.unterschriftName || lage.name}</h2>
          {mailVersandt
            ? <p>Ausfertigung an {mailAn} gesendet.</p>
            : <p className="warnung">Die Mail konnte nicht gesendet werden{mailGrund ? ` (${mailGrund})` : ""} — du kannst die PDF hier herunterladen; wir schicken sie dir zusätzlich nach.</p>}
          {lage.pdfUrl && <a className="aa-knopf" href={lage.pdfUrl} target="_blank" rel="noopener noreferrer">PDF herunterladen</a>}
          <p>{provisionenSatz}</p>
        </section>
      )}

      <article className="ma-papier">
        <div className="ma-papier-band"><b>FIAON</b><span>Kündigungsschreiben · {datum(lage.ausgesprochenAm)}</span></div>
        {/* Server-gerendert und vertrauenswürdig — enthält keine Eingaben Dritter. */}
        <div className="ma-dokument" dangerouslySetInnerHTML={{ __html: lage.dokumentHtml || "" }} />
      </article>

      {!lage.unterschrieben && (
        <section className="ma-unterschrift">
          <h2>Erhalt bestätigen</h2>
          <p>Mit deiner Unterschrift bestätigst du, dass du dieses Schreiben erhalten hast. Die unterschriebene Ausfertigung bekommst du als PDF an die Adresse unten.</p>

          <div className="ma-modi" role="group" aria-label="Art der Unterschrift">
            <button type="button" className={`ma-modus${modus === "drawn" ? " an" : ""}`} onClick={() => setModus("drawn")}>Unterschrift zeichnen</button>
            <button type="button" className={`ma-modus${modus === "typed" ? " an" : ""}`} onClick={() => setModus("typed")}>Name tippen</button>
          </div>

          {modus === "drawn"
            // Eine Leinwand ohne Maße (Seite noch nicht gezeichnet) liefert „data:," —
            // das ist keine Unterschrift und darf den Knopf nicht freigeben.
            ? <SignaturePad onChange={(d) => setUnterschriftPng(d && d.startsWith("data:image/png") ? d : null)} />
            : (
              <div className="ma-getippt">
                <span>{name.trim() || "Dein Name"}</span>
                <small>Der getippte Name gilt als Empfangsbestätigung.</small>
              </div>
            )}

          <label className="ma-feld">
            <span>Vollständiger Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Vor- und Nachname" />
            {!nameOk && name.length > 0 && <small>Mindestens drei Zeichen.</small>}
          </label>

          <label className="ma-feld">
            <span>Ausfertigung senden an</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="deine@adresse.de" />
            <small>{emailOk || email.length === 0 ? "Deine private Adresse ist hier richtig — der FIAON-Zugang endet." : "Bitte eine gültige E-Mail-Adresse."}</small>
          </label>

          <label className="ma-haken">
            <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} />
            <span>Ich bestätige den Erhalt dieser Kündigung und habe die Schlussabrechnung zur Kenntnis genommen.</span>
          </label>

          <button type="button" className="ma-senden" disabled={!bereit} onClick={() => void unterschreiben()}>
            {sendet ? "Wird gespeichert …" : "Kündigung unterschreiben und Ausfertigung senden"}
          </button>
          {fehler && <p className="ma-fehler">{fehler}</p>}
          {!bereit && !sendet && (
            <p className="ma-hinweis">
              {!unterschriftOk ? "Bitte zeichne deine Unterschrift oder wechsle auf „Name tippen“."
                : !nameOk ? "Bitte trage deinen vollständigen Namen ein."
                : !emailOk ? "Bitte trage eine gültige E-Mail-Adresse ein."
                : !bestaetigt ? "Bitte bestätige den Erhalt mit dem Kästchen."
                : ""}
            </p>
          )}
        </section>
      )}

      <p className="ma-dank">Danke für deine Zeit bei FIAON. Fragen beantworten Florentine oder Daniel.</p>
    </main>,
  );
}
