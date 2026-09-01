// ═══════════════════════════════════════════════════════════════════════════
// DAS SEITENVERZEICHNIS — jede Seite des Hauses, perfekt sortiert (02.09.2026)
//
// Justin: „es zipft mich an, dass wir so viele verschiedene Seiten haben —
// mach mir ein KOMPLETTES Verzeichnis aller Seiten, perfekt sortiert!"
//
// Die Wahrheit dieser Liste ist client/src/App.tsx (alle Routen) plus die
// Chefbüro-Registry (CHEF_SEITEN, dynamisch eingebunden — neue Chef-Seiten
// erscheinen hier von selbst). Gruppen statt Wüste, Suchfeld obendrauf,
// jede Zeile ein Klick. Der Altbestand (-alt-Seiten) steht ehrlich als
// eigene Gruppe ganz unten — was weg kann, sieht man so am schnellsten.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { CHEF_SEITEN, chefPfad } from "./chef-seiten";

type Eintrag = [pfad: string, label: string];
interface Gruppe { titel: string; hinweis?: string; eintraege: Eintrag[] }

const GRUPPEN: Gruppe[] = [
  {
    titel: "Öffentliche Website",
    hinweis: "Was jeder Besucher sieht — Startseite, Themen, Rechtliches.",
    eintraege: [
      ["/", "Startseite"], ["/was-ist-fiaon", "Was ist FIAON"], ["/privatkunden", "Privatkunden"],
      ["/business", "Business"], ["/preise", "Preise & Pakete"], ["/team", "Team"],
      ["/karriere", "Karriere"], ["/partner", "Partner"], ["/presse", "Presse"],
      ["/investoren", "Investoren (zweisprachig)"], ["/datenraum", "Datenraum"],
      ["/kontakt", "Kontakt & KI-Assistent"], ["/sicherheit", "Datenschutz & Sicherheit"],
      ["/fiaon-erfahrungen", "So arbeitet FIAON"], ["/plattform-konzept", "Plattform-Konzept"],
      ["/oesterreich", "Österreich"], ["/schweiz", "Schweiz"], ["/kreditkarte", "Kreditkarte trotz Eintrag"],
      ["/bonitaet", "Bonität"], ["/banking", "Banking"], ["/start", "Start (Kampagne)"],
    ],
  },
  {
    titel: "Wissen & SEO-Themen",
    hinweis: "Die Ratgeber-Landkarte — jede Seite zieht Suchverkehr.",
    eintraege: [
      ["/ratgeber", "Ratgeber (Übersicht)"], ["/glossar-bonitaet", "Bonitäts-Glossar A–Z"],
      ["/schufa-eintrag-loeschen", "SCHUFA-Eintrag löschen"], ["/bonitaet-verbessern", "Bonität verbessern"],
      ["/kredit-ohne-schufa", "Kredit ohne SCHUFA — die Wahrheit"], ["/auskunfteien", "Auskunfteien im Vergleich"],
      ["/schufa-score-verstehen", "SCHUFA-Score verstehen"], ["/bonitaetsauskunft-beantragen", "Bonitätsauskunft beantragen"],
      ["/inkasso-brief-erhalten", "Inkasso-Brief erhalten?"], ["/eintrag-verjaehrung", "Eintrag & Verjährung"],
      ["/girokonto-trotz-negativer-bonitaet", "Girokonto trotz negativer Bonität"],
      ["/ratenzahlung-und-bonitaet", "Ratenzahlung & Bonität"], ["/selbstauskunft-checkliste", "Selbstauskunft-Checkliste"],
      ["/schufa-neutral-anfragen", "SCHUFA-neutral anfragen"], ["/bonitaet-service", "Bonitäts-Auszug (Erklärung)"],
    ],
  },
  {
    titel: "Kostenlose Werkzeuge",
    eintraege: [
      ["/werkzeuge", "Werkzeuge (Übersicht)"], ["/werkzeuge/loeschfrist", "Löschfrist-Rechner"],
      ["/werkzeuge/verjaehrung", "Verjährungs-Rechner"], ["/werkzeuge/inkassokosten", "Inkassokosten-Prüfer"],
      ["/werkzeuge/eintrag-pruefen", "Eintrag prüfen"], ["/werkzeuge/selbstauskunft", "Selbstauskunft-Helfer"],
      ["/werkzeuge/schulden-check", "Schulden-Check"], ["/werkzeuge/spielraum", "Spielraum-Rechner"],
      ["/werkzeuge/kreditrechner", "Kreditrechner"], ["/werkzeuge/umschuldung", "Umschuldungs-Rechner"],
      ["/werkzeuge/karten-check", "Karten-Check"],
    ],
  },
  {
    titel: "Antrag & Zahlung",
    hinweis: "Der Weg vom Interessenten zum zahlenden Kunden.",
    eintraege: [
      ["/antrag", "Der Antrag (Privat)"], ["/business-antrag", "Der Antrag (Business)"],
      ["/bonitaet-antrag", "Antrag Bonitätsauskunft"], ["/bonitaet-danke", "Danke-Seite Auskunft"],
      ["/zahlung/BEISPIEL", "Zahlungsseite (je Referenz)"], ["/karte-sichern", "Karte sichern (Kampagne)"],
      ["/als-kunde", "Als Kunde bewerben"],
    ],
  },
  {
    titel: "Kundenportal",
    hinweis: "Der Bereich zahlender Kunden.",
    eintraege: [
      ["/login", "Kunden-Login"], ["/mein-bereich", "Mein Bereich (aktuell)"],
      ["/dashboard", "Dashboard (Bestand)"], ["/passwort-vergessen", "Passwort vergessen"],
      ["/abo-kuendigen", "Abo kündigen"], ["/nummer-aktualisieren", "Rufnummer aktualisieren"],
      ["/vereinbarung", "Vereinbarung"], ["/agb", "AGB"], ["/privacy", "Datenschutzerklärung"],
      ["/impressum", "Impressum"], ["/widerrufsbelehrung", "Widerrufsbelehrung"],
      ["/cookie-einstellungen", "Cookie-Einstellungen"],
    ],
  },
  {
    titel: "Demo & Präsentation",
    eintraege: [
      ["/demo", "Demo-Konto (Einstieg)"], ["/demo/kundenbereich", "Präsentation Kundenbereich"],
      ["/demo/produkt", "Produkt-Demo"], ["/agent/praesentation", "Mitarbeiter-Präsentation"],
    ],
  },
  {
    titel: "Mitarbeiter-Office",
    hinweis: "Die Räume des Teams — Zugang über /agent.",
    eintraege: [
      ["/agent", "Anmeldung"], ["/agent/start", "Startseite / Heute"],
      ["/agent/pipeline", "Pipeline (Kundenakte)"], ["/agent/bestand", "Bestand & Mandate"],
      ["/agent/onboarding", "Onboarding-Raum"], ["/agent/collections", "Collections"],
      ["/agent/kalender", "Kalender"], ["/agent/inbox", "Inbox"], ["/agent/flur", "Der Flur (Präsenz)"],
      ["/agent/vertrieb", "Vertriebsleitung"], ["/agent/kartei", "Kundenpool"],
      ["/agent/academy", "Academy"], ["/agent/tools", "Tools"], ["/agent/assistent", "Copilot"],
      ["/agent/aufgaben", "Aufgaben"], ["/agent/mails", "Mail-Galerie"],
      ["/agent/verdienst", "Verdienst"], ["/agent/wallet", "Wallet"],
      ["/agent/partner-programm", "Partner-Programm"], ["/agent/arbeitszeiten", "Arbeitszeiten"],
      ["/agent/profil", "Profil"], ["/agent/space", "Space (Team-Feed)"],
      ["/agent/skripte", "Skripte"], ["/agent/updates", "Updates"], ["/agent/mehr", "Mehr"],
    ],
  },
  {
    titel: "Verwaltung (Admin)",
    hinweis: "Die alte Verwaltung — vieles davon lebt inzwischen im Chefbüro weiter.",
    eintraege: [
      ["/admin", "Admin-Start"], ["/admin/kunden", "Kunden"], ["/admin/personen", "Personen"],
      ["/admin/leads", "Leads"], ["/admin/kartei", "Kundenpool"], ["/admin/zahlungen", "Zahlungen"],
      ["/admin/verbuchung", "Verbuchung"], ["/admin/kontoabgleich", "Kontoabgleich"],
      ["/admin/rechnungen", "Rechnungen"], ["/admin/abrechnungen", "Abrechnungen"],
      ["/admin/auszahlungen", "Auszahlungen"], ["/admin/buchhaltung", "Buchhaltung"],
      ["/admin/finanzen", "Finanzen"], ["/admin/team", "Team-Zentrale"],
      ["/admin/termine", "Termine"], ["/admin/todo", "TODO-Board"],
      ["/admin/aufgaben", "Aufgaben"], ["/admin/mail-zentrale", "Mail-Zentrale"],
      ["/admin/ratgeber", "Ratgeber-Redaktion"], ["/admin/dubletten", "Dubletten"],
      ["/admin/kuendigungen", "Kündigungen"], ["/admin/diagnose", "Diagnose"],
      ["/admin/events", "Ereignisse"], ["/admin/einstellungen", "Einstellungen"],
      ["/admin/database", "Datenbank"], ["/admin/audit", "Audit"],
      ["/admin/changelog", "Änderungsprotokoll"], ["/admin/fahrplan", "Fahrplan"],
      ["/admin/funktionen", "Funktionen"], ["/admin/lead-automatik", "Lead-Automatik"],
      ["/admin/leistung", "Leistung"], ["/admin/nachbuchung", "Nachbuchung"],
      ["/admin/recht", "Recht"], ["/admin/schulung", "Schulung"], ["/admin/space", "Space"],
      ["/admin/vertraege", "Verträge"], ["/admin/investoren", "Investoren-Anfragen"],
      ["/admin/agent-portal", "Agent-Portal"], ["/admin/dashboard", "Dashboard (alt)"],
    ],
  },
  {
    titel: "Sonderwege (mit Schlüssel)",
    hinweis: "Seiten, die nur über einen signierten Link erreichbar sind.",
    eintraege: [
      ["/termin/…", "Termin buchen (Token)"], ["/termin/absagen/…", "Termin absagen (Token)"],
      ["/zustimmung/…", "Zustimmung (Token)"], ["/agent/setup/…", "Mitarbeiter-Setup (Token)"],
      ["/abmelden/…", "Mail-Abmeldung (Token)"], ["/scp-datenraum", "SCP-Datenraum"],
    ],
  },
  {
    titel: "Altbestand (-alt)",
    hinweis: "Alte Fassungen, die noch erreichbar sind — Kandidaten fürs Aufräumen.",
    eintraege: [
      ["/agent/kunden-alt", "Kundenakte (alt)"], ["/agent/inkasso-alt", "Inkasso (alt)"],
      ["/agent/kalender-alt", "Kalender (alt)"], ["/agent/academy-alt", "Academy (alt)"],
      ["/agent/start-alt", "Start (alt)"], ["/agent/meine-kunden-alt", "Meine Kunden (alt)"],
      ["/agent/aufgaben-alt", "Aufgaben (alt)"], ["/agent/mail-zentrale-alt", "Mail-Zentrale (alt)"],
      ["/agent/verdienst-alt", "Verdienst (alt)"], ["/agent/leistung-alt", "Leistung (alt)"],
      ["/agent/profil-alt", "Profil (alt)"], ["/agent/space-alt", "Space (alt)"],
      ["/agent/updates-alt", "Updates (alt)"], ["/agent/mehr-alt", "Mehr (alt)"],
      ["/agent/anliegen-alt", "Anliegen (alt)"], ["/agent/feedback-alt", "Feedback (alt)"],
      ["/agent/dokumente-alt", "Dokumente (alt)"], ["/agent/startgespraeche-alt", "Startgespräche (alt)"],
      ["/agent/partner-programm-alt", "Partner-Programm (alt)"], ["/agent/auszahlung-alt", "Auszahlung (alt)"],
      ["/dashboard-alt", "Kunden-Dashboard (alt)"], ["/admin/team-alt", "Team (alt)"],
    ],
  },
];

export default function ChefSeitenverzeichnis() {
  const [suche, setSuche] = useState("");
  const [auf, setAuf] = useState<Set<string>>(() => new Set(["Öffentliche Website"]));

  // Das Chefbüro kommt dynamisch aus der Registry — neue Seiten von selbst.
  const gruppen = useMemo<Gruppe[]>(() => {
    const chef: Gruppe = {
      titel: "Chefbüro",
      hinweis: "Alle Räume unter /chef/s/ — aus der Registry, immer vollständig.",
      eintraege: CHEF_SEITEN.map((s) => [chefPfad(s), s.label] as Eintrag),
    };
    return [...GRUPPEN.slice(0, 7), chef, ...GRUPPEN.slice(7)];
  }, []);

  const q = suche.trim().toLowerCase();
  const gefiltert = useMemo(() => {
    if (!q) return gruppen;
    return gruppen
      .map((g) => ({ ...g, eintraege: g.eintraege.filter(([p, l]) => p.toLowerCase().includes(q) || l.toLowerCase().includes(q)) }))
      .filter((g) => g.eintraege.length > 0);
  }, [gruppen, q]);

  const gesamt = gruppen.reduce((s, g) => s + g.eintraege.length, 0);

  return (
    <section className="cl-block sv">
      <div className="cl-block-kopf">
        <h2>Das Haus — alle Seiten</h2>
        <small>{gesamt} Seiten in {gruppen.length} Gruppen · jede Zeile ein Klick</small>
      </div>
      <input className="sv-suche" value={suche} onChange={(e) => setSuche(e.target.value)}
             placeholder="Seite suchen — Name oder Pfad …" />
      <div className="sv-gruppen">
        {gefiltert.map((g) => {
          const offen = !!q || auf.has(g.titel);
          return (
            <div key={g.titel} className={`sv-gruppe${offen ? " auf" : ""}`}>
              <button type="button" className="sv-gruppe-kopf"
                      onClick={() => setAuf((a) => { const n = new Set(a); if (n.has(g.titel)) n.delete(g.titel); else n.add(g.titel); return n; })}>
                <b>{g.titel}</b>
                <span>{g.eintraege.length}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" className={`sv-pfeil${offen ? " auf" : ""}`} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {offen && (
                <div className="sv-liste">
                  {g.hinweis && <p className="sv-hinweis">{g.hinweis}</p>}
                  <ul>
                    {g.eintraege.map(([pfad, label]) => (
                      <li key={pfad + label}>
                        {pfad.includes("…") || pfad.includes("BEISPIEL")
                          ? <span title="nur über signierten Link erreichbar"><b>{label}</b><small>{pfad}</small></span>
                          : <a href={pfad} target={pfad.startsWith("/chef") ? undefined : "_blank"} rel="noreferrer"><b>{label}</b><small>{pfad}</small></a>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        {gefiltert.length === 0 && <p className="sv-hinweis">Nichts gefunden — anderer Begriff?</p>}
      </div>
      <style>{`
        .sv-suche { width: 100%; margin: 2px 0 14px; padding: 11px 14px; border-radius: 12px;
          font: 400 13.5px/1 'Inter', sans-serif; color: inherit; outline: none;
          background: rgba(8,14,32,.5); border: 1px solid rgba(126,180,255,.18); }
        .sv-suche:focus { border-color: rgba(126,180,255,.5); }
        .sv-gruppen { display: grid; gap: 8px; }
        .sv-gruppe { border-radius: 12px; background: rgba(8,14,32,.4); border: 1px solid rgba(126,180,255,.08); overflow: hidden; }
        .sv-gruppe.auf { border-color: rgba(126,180,255,.2); }
        .sv-gruppe-kopf { display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 12px 14px; background: none; border: 0; cursor: pointer; text-align: left; color: inherit; }
        .sv-gruppe-kopf b { flex: 1; font: 550 14px/1.2 'Inter', sans-serif; }
        .sv-gruppe-kopf > span { font: 500 11.5px/1 'Inter', sans-serif; color: #9fc4ff;
          padding: 3px 9px; border-radius: 999px; background: rgba(40,141,250,.12); }
        .sv-pfeil { transition: transform .3s ease; opacity: .7; }
        .sv-pfeil.auf { transform: rotate(180deg); }
        .sv-hinweis { margin: 0 0 8px; font: 400 12px/1.5 'Inter', sans-serif; color: rgba(159,196,255,.6); }
        .sv-liste { padding: 2px 14px 14px; }
        .sv-liste ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px;
          grid-template-columns: 1fr; }
        @media (min-width: 760px) { .sv-liste ul { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1180px) { .sv-liste ul { grid-template-columns: 1fr 1fr 1fr; } }
        .sv-liste a, .sv-liste li > span { display: flex; align-items: baseline; gap: 8px;
          padding: 7px 10px; border-radius: 9px; text-decoration: none; color: inherit; min-width: 0; }
        .sv-liste a:hover { background: rgba(40,141,250,.1); }
        .sv-liste b { font: 450 13px/1.3 'Inter', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sv-liste small { font: 400 11px/1.3 'Inter', sans-serif; color: rgba(159,196,255,.45);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (prefers-reduced-motion: reduce) { .sv-pfeil { transition: none; } }
      `}</style>
    </section>
  );
}
