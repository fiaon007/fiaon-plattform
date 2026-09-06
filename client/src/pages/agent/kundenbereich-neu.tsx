// ═══════════════════════════════════════════════════════════════════════════
// /agent/kundenbereich-neu — „Was ist neu: Mein FIAON“ (06.09.2026)
//
// Justin: „baue mir eine anschauliche Präsentation mit all den Änderungen für
// den Kunden aber auch technisch, dass wir genau verstehen wie wo was wann —
// eine eigene Seite für die Mitarbeiter.“
//
// Eine Seite, drei Ebenen: was der Kunde sieht, was das Team tut, wie es
// technisch gebaut ist. Alles hier ist Stand 06.09.2026 und beschreibt nur,
// was live ist. Ändert sich der Bereich, ändert sich diese Seite mit
// (Rundgang-Pflegepflicht, E-063).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { AgentShell } from "./shared";
import { useOffice } from "./OfficeShell";

export default function AgentKundenbereichNeuPage() { return <AgentShell><Innen /></AgentShell>; }

const GRUND = "#F7F9FC";
const TEXT = "#0F172A";
const LEISE = "#475569";
const LINIE = "#E2E8F0";
const BLAU = "#2563EB";
const NAVY = "#0B1B3A";

type Ebene = "kunde" | "team" | "technik" | "zeit";

const KUNDE: { reiter: string; was: string; warum: string }[] = [
  { reiter: "Heute", was: "Begrüßung, die Ruhe-Zeile („Sie müssen heute nichts tun“ oder „Eine Sache wartet auf Sie“), die dunkle Zielkarte mit „x von 11 Schritten“, die Zahl des Monats, was gerade bei FIAON in Arbeit ist, die Ansprechperson.", warum: "Der Kunde weiß in drei Sekunden, ob er etwas tun muss. Vorher rief er dafür an." },
  { reiter: "Weg", was: "Elf Schritte bis zur Karte, jeder mit Stand und Datum: Angaben, erste Zahlung, Startgespräch, Anspruchs-Check, Unterlagen, Auskunft, Analyse, erstes Schreiben, Rate 2, Girokonto, Karte. Dazu alle Raten als Zahlungsnachweis.", warum: "Kein Versprechen, nur Stand. Über Karte und Rahmen entscheidet die Bank — das steht auf jeder Karte." },
  { reiter: "Brief", was: "Brief fotografieren, prüfen, absenden. Der Kunde bekommt ein Aktenzeichen und sieht unter Vorgänge, bis wann wir uns melden.", warum: "Post macht Angst. Ein Foto und ein Aktenzeichen nehmen sie. Bei dir entsteht ein Auftrag mit Frist." },
  { reiter: "Geld", was: "Nächste Rate, „Rate zahlen“ mit Überweisung, GiroCode und Bankeinzug, alle Raten mit Haken, der Monatsbericht zum Nachrechnen.", warum: "Jeder Monat hat einen Betrag, den der Kunde nachrechnen kann. Die Bankdaten kommen aus einer Quelle (shared/fiaon-bank.ts)." },
  { reiter: "Mehr", was: "Hilfe (Nachricht an dich, Anruf-Termin, Telefon, häufige Fragen), Termine, Unterlagen, Vorgänge und Ansprüche, Meine Daten, Abo, Mitteilungen, Vollmachten, Abmelden.", warum: "Alles, was selten gebraucht wird, an einem Ort — und der Kunde erreicht dich, ohne zu suchen." },
  { reiter: "Anspruchs-Check", was: "Zehn Fragen, danach eine Liste: P-Konto-Erhöhung, Umwandlung in ein P-Konto, Rundfunkbefreiung, Wohngeld, Kfz- und Handytarif — mit Betrag, Rechtsgrundlage, Quelle und Prüfdatum.", warum: "Das ist das Produkt: Geld, das dem Kunden zusteht, sichtbar gemacht. Aus jedem Punkt wird ein fertiges Schreiben." },
  { reiter: "Anträge", was: "Der Kunde erteilt einmal eine Vollmacht zur Übermittlung, unterschreibt Schreiben mit dem Finger, du versendest und trägst das Ergebnis ein. Alles mit Datum unter Vorgänge.", warum: "FIAON ist Bote, nicht Anwalt. Jede Erklärung gibt der Kunde selbst ab — in seiner Ich-Form." },
];

const TEAM: { titel: string; text: string; wo: string }[] = [
  { titel: "Aufträge aus dem Kundenbereich", text: "Brief hochgeladen, Antrag unterschrieben, dringendes Anliegen, Bescheid fotografiert — jedes davon ist ein Auftrag mit Kundennamen, Frist und Link. Ein Auftrag je Sache, kein Doppel.", wo: "Tasks → Aufträge" },
  { titel: "Vorgang bearbeiten", text: "Versand bestätigen (Empfänger und „Wir fragen nach am“), Ergebnis eintragen (bewilligt oder abgelehnt, Betrag laut Bescheid), zwei Sätze für den Kunden, Dokumente, Verlauf. Was du einträgst, sieht der Kunde sofort.", wo: "Link im Auftrag → /agent/app-vorgaenge/…" },
  { titel: "Anliegen", text: "Nachrichten aus dem Bereich sind Tickets wie bisher. Steht „DRINGEND“ vorn, kam der Brief von Gericht, Gerichtsvollzieher oder Inkasso — dann liegt zusätzlich ein Auftrag mit Frist heute bei dir.", wo: "Tickets" },
  { titel: "Fristenwächter", text: "Sieben Tage vor dem Nachfragedatum ein Auftrag, am Tag selbst die Nachfrage, sieben Tage später eine Meldung an die Leitung. Er kennt nur Fristen, die du beim Versand gesetzt hast.", wo: "läuft von selbst, alle sechs Stunden" },
  { titel: "Sperre aufheben", text: "Zahlende Kunden werden seit 06.09. nicht mehr gesperrt — ein „Nein“ ist ein Vermerk. Steht doch jemand auf „gesperrt“, hebst du es im Management neben dem roten Wort auf.", wo: "Management → Zeile des Kunden" },
  { titel: "Sätze für den Kunden", text: "Alles, was du dem Kunden schreibst, läuft durch die Wortwand: keine Garantie, kein „steht Ihnen zu“, keine Rechtsberatung, kein Ergebnisversprechen. Die Seite sagt dir, was zu ändern ist.", wo: "in jedem Textfeld für Kunden" },
];

const TECHNIK: { bereich: string; details: string[] }[] = [
  { bereich: "Oberfläche", details: ["React + wouter unter /app (client/src/pages/app/*), Handy zuerst (375 px), Reiter als Links, ein Navy-Glas (Zielkarte).", "Öffentlich ohne Login: /app/login, /app/demo (Vorführkonto FIAON-DEMO, keine Datenbank), /app/unterschrift/:token.", "App-Installation: /app.webmanifest + Service Worker /app-sw.js (cached nur /assets und Schriften, nie die Schale, nie /api)."] },
  { bereich: "Server", details: ["Express-Router unter /api/fiaon: fiaon-app.ts (Anspruchs-Check, Brief, Post, Dokumente, Zahlung), fiaon-app-antraege.ts (Vorgänge, Vollmacht, Unterschrift, Nachricht, Mitarbeiter-Routen), fiaon-app-bericht.ts, fiaon-app-push.ts, fiaon-app-login.ts.", "Alles hinter requireKunde (Cookie = Referenz) und an die Person gebunden (person_id); Mitarbeiter-Routen hinter requireAgent + darfAnKunde.", "Rechnung des Weges: shared/fiaon-rahmenweg.ts — eine Funktion, heute im Browser, später auch in der Akte."] },
  { bereich: "Datenbank (Postgres, Produktion)", details: ["fiaon_anspruch_antworten, fiaon_ansprueche, fiaon_vorgaenge, fiaon_dokumente (PDF als BYTEA), fiaon_vollmachten, fiaon_vorgang_ereignisse, fiaon_monatsberichte, fiaon_app_ereignisse, fiaon_push_abos, fiaon_push_log, fiaon_login_links.", "Angelegt beim Start bzw. beim ersten Aufruf, nur CREATE IF NOT EXISTS; Abschriften in db/migrations/080–082.", "Vertriebssperre: Trigger fiaon_sperr_protokoll hält jede Änderung von is_blocked mit dem auslösenden SQL fest."] },
  { bereich: "Schalter (fiaon_settings)", details: ["app_brief_an (Brief-Weg), app_antraege_an (Vollmacht, Unterschrift, Anträge), app_bericht_mail (Monatsbericht per Mail) — alle über POST /admin/app/einstellung, ohne Deploy.", "Sofortzahlung nur über sofortErlaubt()/sofortUrlFuer() (fiaon-zahlungsauftrag.ts): keine Sofortzahlung für Erstzahler, keine für Raten im Bankeinzug.", "Mitteilungen nur mit VAPID-Schlüsseln aus der Umgebung; ohne Schlüssel „nicht verfügbar“."] },
  { bereich: "Läufe (nur Produktion)", details: ["fristenwaechter (6 h), monatsbericht (täglich, wirkt am 1.–3.), app-ereignisse-aufraeumen (24 h, löscht nach 90 Tagen), push-rate-erinnerung (24 h, nur ohne Bankeinzug, Nachtruhe 21–8 Uhr, eine Mitteilung je Tag).", "Keine Kundenmails aus Läufen — Mails nur über mailSenden() mit Vorlage im Mailwerk (app_login_link, app_monatsbericht)."] },
  { bereich: "Sicherheit", details: ["Unterschrift-Links: HMAC über SESSION_SECRET, 30 Tage, einmalig (Zustand + Ereignis), 410 nach Ablauf. Anmelde-Links: 32 Zufallsbytes, nur der Hash in der Datenbank, 60 Minuten, einmalig, Bremse je IP und Adresse, immer dieselbe Antwort.", "Uploads: nur JPG/PNG/PDF, 12 MB je Seite, zehn Seiten, fünf Briefe je Tag; Bilder werden zu PDF. Download nur für die eigene Person.", "Texte: Wortwand serverseitig (shared/fiaon-wortverbote.ts), Prüfstände scripts/pruef-schreiben.ts und scripts/pruef-mail.ts."] },
];

const ZEIT: { wann: string; was: string }[] = [
  { wann: "05.09., 20:40", was: "Teil 1 live: neues Login, Start, Weg, Demo unter /app/demo. Parallel zum alten Bereich, nichts ersetzt." },
  { wann: "05.09., 21:30", was: "Teil 2: Heute, Weg, Brief, Geld, Mehr, Anspruchs-Check, Vorgänge. Vier neue Tabellen." },
  { wann: "05.09., 22:40", was: "Justin gibt den Brief-Weg frei." },
  { wann: "05.09., 22:50", was: "Teil 3: Hilfe und Termine. Teil 4: Rate zahlen mit drei Wegen (Sofortzahlung nur nach Hausregel)." },
  { wann: "05.09., 23:15", was: "Teil 5: Vollmacht, Fingerunterschrift, Anträge, Fristenwächter, Dringend-Auftrag, Mitarbeiterseite." },
  { wann: "06.09., 09:30", was: "Teil 6: Monatsbericht, App-Installation, Mitteilungen, Anmelde-Link, Meine Daten, Abo, Ereignisprotokoll." },
  { wann: "06.09., 09:40", was: "Justin gibt Anträge frei; Mitteilungs-Schlüssel gesetzt; Bericht-Mail an; 24 zahlende Kunden entsperrt; Datenschutzerklärung ergänzt." },
];

function Innen() {
  const { titel } = useOffice();
  const [ebene, setEbene] = useState<Ebene>("kunde");
  useEffect(() => { titel("What's new"); return () => titel(null); }, [titel]);

  const knopf = (k: Ebene, text: string) => (
    <button type="button" onClick={() => setEbene(k)} aria-pressed={ebene === k}
      style={{ padding: "10px 16px", borderRadius: 999, border: `1px solid ${ebene === k ? BLAU : LINIE}`, background: ebene === k ? BLAU : "#fff", color: ebene === k ? "#fff" : TEXT, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
      {text}
    </button>
  );

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "8px 16px 48px", color: TEXT }}>
      <section style={{ background: `linear-gradient(135deg, ${NAVY}, #16305f)`, color: "#fff", borderRadius: 22, padding: "28px 26px", marginBottom: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", opacity: .75 }}>Was ist neu · Stand 06.09.2026</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "8px 0 10px", fontWeight: 700 }}>Mein FIAON — der neue Kundenbereich</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, opacity: .9, maxWidth: 720 }}>
          Der Kunde sieht auf dem Handy, wo er steht, was als Nächstes dran ist und wer sich kümmert. Jeder Klick von ihm wird bei dir ein Auftrag mit Namen, Frist und Link. Nichts davon verspricht eine Karte — und alles hat einen Not-Aus.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <a href="/app/demo" target="_blank" rel="noreferrer" style={{ background: "#fff", color: NAVY, padding: "10px 16px", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Demo auf dem Handy öffnen → fiaon.com/app/demo</a>
          <a href="/app/login" target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,.12)", color: "#fff", padding: "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: "none", border: "1px solid rgba(255,255,255,.25)" }}>Das neue Login</a>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {knopf("kunde", "Für den Kunden")}{knopf("team", "Für dich im Team")}{knopf("technik", "Technik")}{knopf("zeit", "Wann was")}
      </div>

      {ebene === "kunde" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Fluss />
          {KUNDE.map((k) => (
            <article key={k.reiter} style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, padding: "16px 18px" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{k.reiter}</h2>
              <p style={{ margin: "6px 0 8px", fontSize: 14.5, lineHeight: 1.55 }}>{k.was}</p>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: LEISE }}><b style={{ color: TEXT }}>Warum:</b> {k.warum}</p>
            </article>
          ))}
        </div>
      )}

      {ebene === "team" && (
        <div style={{ display: "grid", gap: 12 }}>
          {TEAM.map((t) => (
            <article key={t.titel} style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.titel}</h2>
                <span style={{ fontSize: 12.5, color: BLAU, fontWeight: 600 }}>{t.wo}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.55 }}>{t.text}</p>
            </article>
          ))}
          <article style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 16, padding: "16px 18px" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Drei Sätze, die immer gelten</h2>
            <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14.5, lineHeight: 1.6 }}>
              <li>Der Kunde sieht sofort, was du einträgst — schreib es so, wie du es ihm am Telefon sagen würdest.</li>
              <li>Sag, was wir tun und bis wann du dich meldest. Nie, was ein Brief „bedeutet“, nie, was ein Amt entscheiden wird.</li>
              <li>Fristen entstehen nur durch dich beim Versand. Der Fristenwächter erfindet keine.</li>
            </ol>
          </article>
        </div>
      )}

      {ebene === "technik" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Architektur />
          {TECHNIK.map((t) => (
            <article key={t.bereich} style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, padding: "16px 18px" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.bereich}</h2>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6, color: LEISE }}>
                {t.details.map((d, i) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}
              </ul>
            </article>
          ))}
        </div>
      )}

      {ebene === "zeit" && (
        <div style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, overflow: "hidden" }}>
          {ZEIT.map((z, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "12px 18px", borderTop: i ? `1px solid ${LINIE}` : "none", fontSize: 14.5, lineHeight: 1.5 }}>
              <span style={{ color: BLAU, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{z.wann}</span>
              <span>{z.was}</span>
            </div>
          ))}
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${LINIE}`, fontSize: 13, color: LEISE, background: GRUND }}>
            Alle Teile wurden von der Berater-Sitzung gebaut, von TFO geprüft und live gestellt. Entscheidungen stehen im Register ab E-150.
          </div>
        </div>
      )}
    </div>
  );
}

/** Der Weg eines Klicks — vom Kunden bis zurück zum Kunden. */
function Fluss() {
  const schritte = ["Kunde tippt", "Bereich", "Auftrag bei dir", "Du handelst", "Kunde sieht es"];
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, padding: "14px 18px", overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 620 }}>
        {schritte.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: i === 2 ? BLAU : GRUND, color: i === 2 ? "#fff" : TEXT, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", border: `1px solid ${i === 2 ? BLAU : LINIE}` }}>{s}</div>
            {i < schritte.length - 1 && <span aria-hidden="true" style={{ color: LEISE }}>→</span>}
          </div>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: LEISE }}>Brief, Antrag, Anliegen, Bescheid: immer derselbe Weg. Der Kunde sieht unter Vorgänge, wo seine Sache liegt und bis wann.</p>
    </div>
  );
}

/** Die Schichten — was mit wem spricht. */
function Architektur() {
  const box = (x: number, y: number, w: number, h: number, t: string, sub: string, dunkel = false) => (
    <g key={t}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={dunkel ? NAVY : "#fff"} stroke={dunkel ? NAVY : LINIE} />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" fontSize={13} fontWeight={700} fill={dunkel ? "#fff" : TEXT}>{t}</text>
      <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={11} fill={dunkel ? "rgba(255,255,255,.75)" : LEISE}>{sub}</text>
    </g>
  );
  const pfeil = (x1: number, y1: number, x2: number, y2: number) => <line key={`${x1}-${y1}-${x2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={LEISE} strokeWidth={1.5} markerEnd="url(#p)" />;
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINIE}`, borderRadius: 16, padding: "12px 12px 6px", overflowX: "auto" }}>
      <svg viewBox="0 0 900 230" width="100%" style={{ minWidth: 640, display: "block" }} role="img" aria-label="Architektur des Kundenbereichs">
        <defs><marker id="p" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={LEISE} /></marker></defs>
        {box(20, 30, 180, 56, "Handy des Kunden", "/app · React · Service Worker")}
        {box(20, 130, 180, 56, "Öffentlich", "/app/login · /app/demo · Unterschrift-Link")}
        {box(300, 30, 200, 56, "Server /api/fiaon", "Express · requireKunde · Wortwand", true)}
        {box(300, 130, 200, 56, "Läufe", "Fristenwächter · Monatsbericht · Push")}
        {box(600, 30, 140, 56, "Postgres", "11 neue Tabellen")}
        {box(600, 130, 140, 56, "Mailwerk", "mailSenden · Brevo")}
        {box(770, 80, 110, 56, "Team", "Aufträge · Vorgang-Seite")}
        {pfeil(200, 58, 298, 58)}
        {pfeil(200, 158, 298, 70)}
        {pfeil(500, 58, 598, 58)}
        {pfeil(400, 86, 400, 128)}
        {pfeil(500, 158, 598, 158)}
        {pfeil(500, 70, 768, 100)}
        {pfeil(500, 150, 768, 118)}
      </svg>
      <p style={{ margin: "6px 6px 4px", fontSize: 13, color: LEISE }}>Der Server ist die einzige Wahrheit. Der Browser rechnet nichts selbst — außer dem Weg (shared/fiaon-rahmenweg.ts), und den rechnet er mit derselben Funktion, die später auch die Akte nutzt.</p>
    </div>
  );
}
