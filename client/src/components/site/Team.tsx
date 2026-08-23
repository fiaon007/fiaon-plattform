// ═══════════════════════════════════════════════════════════════════════════
// Das Team — drei Gesellschafter, ein Investor (22.08.2026, Angaben von Justin)
//
// Fotos liegen unter client/public/portraits/<vorname>.jpg. Fehlt ein Bild, steht
// das Monogramm auf Glas — so bricht nichts, bis die Bilder da sind.
// Wird auf /team (ausführlich) und /investoren („Wer das baut", kompakt) gezeigt.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Auf, Glas } from "./DunkleBuehne";

export const PERSONEN = [
  {
    kuerzel: "justin", name: "Justin Schwarzott", rolle: "Gründer · Geschäftsführer · Director",
    kurz: "Führt FIAON seit dem ersten Tag – Produkt, Strategie, Partner. Entscheidungen stehen im Register, jeder Tag im Logbuch.",
    lang: "Justin hat FIAON gegründet, weil er gesehen hat, wie viele Menschen an einem Eintrag scheitern, den niemand erklärt und niemand anfasst. Er verantwortet Produkt, Strategie, Partnerschaften und Finanzen – und führt das Unternehmen so, als würde es morgen geprüft.",
    email: "js@fiaon.com", telefon: "+41 77 288 4902",
  },
  {
    kuerzel: "florentine", name: "Florentine Lombardi", rolle: "Gesellschafterin · Menschen & Onboarding",
    kurz: "Verantwortet Mitarbeiter, Einschulungen und Onboardings – jeder neue Kollege und jeder neue Kunde beginnt bei ihr.",
    lang: "Florentine baut das Team auf und hält es zusammen: Sie schult neue Mitarbeiter in der Academy, begleitet die Onboardings und sorgt dafür, dass jeder Kunde sein Startgespräch mit einem Menschen führt, der die Akte kennt.",
    email: "florentine@fiaon.com", telefon: "+41 77 202 84 49",
  },
  {
    kuerzel: "daniel", name: "Daniel Stripling", rolle: "Gesellschafter · Leitung Vertrieb",
    kurz: "Leitet den gesamten Vertrieb – vom ersten Anruf bis zum Abschluss, inklusive Provisionsregeln und Qualität der Gespräche.",
    lang: "Daniel führt den Vertrieb: Gesprächsqualität, Ergebnisse, Provisionen, Bestandspflege. Er entscheidet, wer welchen Kunden betreut, und hält die Linie zwischen ‚verkaufen‘ und ‚helfen‘ – bei FIAON ist das dasselbe.",
    email: "daniel@fiaon.com", telefon: "+41 77 281 18 34",
  },
] as const;

/** Das Team im Betrieb — vollständige Namen, Bereich. Fotos unter /portraits/<kuerzel>.jpg, sonst Monogramm. */
export const MITARBEITER = [
  { kuerzel: "nikita", name: "Nikita Boychenko", rolle: "Vertrieb", titel: "Der erste Anruf",
    text: "Nikita ist oft die erste Stimme, die ein Kunde von FIAON hört. Er erklärt in fünf Minuten, was eine Auskunft ist, was sie nicht ist – und welches Paket zu der Lage des Menschen passt, nicht zu seinem Wunsch." },
  { kuerzel: "lucas", name: "Lucas Böhnert", rolle: "Vertrieb", titel: "Klartext statt Verkaufsdruck",
    text: "Lucas führt Gespräche so, wie er sie selbst gern hätte: ehrlich, ohne Versprechen, mit einem klaren nächsten Schritt. Wer bei ihm ‚Nein‘ sagt, bekommt trotzdem einen Rat, was er selbst tun kann." },
  { kuerzel: "angelique", name: "Angelique Laukert", rolle: "Vertrieb", titel: "Die Brücke zur Akte",
    text: "Angelique sorgt dafür, dass aus einem Interessenten ein Kunde mit vollständigen Unterlagen wird – Paket, Zahlung, Termin. Nichts bleibt liegen, und niemand muss zweimal dasselbe erzählen." },
  { kuerzel: "viktoria", name: "Viktoria Reichert", rolle: "Onboarding", titel: "Das Startgespräch",
    text: "Viktoria führt die ersten fünfzehn Minuten eines jeden Kunden: Bereich gemeinsam öffnen, Fahrplan erklären, Unterlagen klären. Danach weiß der Kunde, wo er steht – und kennt seine Ansprechpartnerin mit Namen." },
  { kuerzel: "rifka", name: "Rifka Rovcanin", rolle: "Onboarding", titel: "Die ersten Wochen",
    text: "Rifka begleitet Kunden von der Zahlung bis zur ersten Auskunft: Sie erinnert an fehlende Unterlagen, erklärt Wartezeiten ehrlich und meldet sich, bevor der Kunde fragen muss." },
  { kuerzel: "diana", name: "Diana Zeller", rolle: "Forderungsmanagement", titel: "Fristen, die jemand hält",
    text: "Diana behält jede Frist und jede Antwort im Blick: Löschanträge, Widersprüche, Ratenvereinbarungen. Wenn eine Gegenseite schweigt, ist sie diejenige, die nachfasst – freundlich, bestimmt, dokumentiert." },
  { kuerzel: "hans-juergen", name: "Hans-Jürgen Gerhold", rolle: "Forderungsmanagement", titel: "Erfahrung am Telefon mit Gläubigern",
    text: "Hans-Jürgen verhandelt mit Inkassounternehmen und Gläubigern auf Augenhöhe: Vergleiche, Ratenpläne, Erledigungsvermerke. Er kennt die Abläufe auf der anderen Seite – und nutzt das für unsere Kunden." },
] as const;

export const INVESTOR = {
  name: "Schwarzott Capital Partners AG",
  adresse: ["Schifflände 26", "8001 Zürich", "Schweiz"],
  email: "office@schwarzott-global.com",
  text: "Hat in FIAON investiert und damit den Aufbau ermöglicht – Partner seit dem ersten Tag.",
};

function Portrait({ kuerzel, name, gross = false }: { kuerzel: string; name: string; gross?: boolean }) {
  const [fehlt, setFehlt] = useState(false);
  const initialen = name.split(" ").map((t) => t[0]).join("").slice(0, 2);
  const groesse = gross ? 168 : 104;
  return (
    <div style={{ width: groesse, height: groesse, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", position: "relative",
                  background: "linear-gradient(135deg,rgba(37,99,235,.35),rgba(15,23,42,.6))", border: "1px solid rgba(255,255,255,.14)",
                  boxShadow: "0 20px 50px rgba(2,6,23,.45), inset 0 1px 0 rgba(255,255,255,.12)" }}>
      {!fehlt ? (
        <img src={`/portraits/${kuerzel}.jpg`} alt={name} width={groesse} height={groesse} loading="lazy" decoding="async"
             style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 18%", display: "block" }} onError={() => setFehlt(true)} />
      ) : (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#bfdbfe", fontSize: gross ? 44 : 28, fontWeight: 300, letterSpacing: ".04em" }}>{initialen}</span>
      )}
    </div>
  );
}

/** kompakt: drei Karten nebeneinander (Investoren-Seite). Sonst: ausführlich mit Text, Kontakt und Investor. */
export function Team({ kompakt = false }: { kompakt?: boolean }) {
  return (
    <>
      <div className="dk-raster" style={{ marginTop: 48 }}>
        {PERSONEN.map((p, i) => (
          <Auf key={p.kuerzel} verzoegerung={i * 90}>
            <Glas ruhig style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: kompakt ? "flex-start" : "center", textAlign: kompakt ? "left" : "center" }}>
              <Portrait kuerzel={p.kuerzel} name={p.name} gross={!kompakt} />
              <span className="tag" style={{ marginTop: 18 }}>{p.rolle}</span>
              <h3 className="dk-h3">{p.name}</h3>
              <p className="dk-text" style={{ marginTop: 10 }}>{kompakt ? p.kurz : p.lang}</p>
              {!kompakt && (
                <p style={{ marginTop: "auto", paddingTop: 18, fontSize: 14, display: "grid", gap: 4 }}>
                  <a href={`mailto:${p.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{p.email}</a>
                  {p.telefon && <a href={`tel:${p.telefon.replace(/\s/g, "")}`} style={{ color: "#9ca3af", textDecoration: "none" }}>{p.telefon}</a>}
                </p>
              )}
            </Glas>
          </Auf>
        ))}
      </div>
      {!kompakt && (
        <Auf verzoegerung={200}>
          <div className="dk-glas ruhig team-investor" style={{ marginTop: 24 }}>
            <div>
              <span className="tag">Investor und Partner</span>
              <h3 className="dk-h3">{INVESTOR.name}</h3>
              <p className="dk-text" style={{ marginTop: 8 }}>{INVESTOR.text}</p>
            </div>
            <div className="dk-leise adresse" style={{ lineHeight: 1.7 }}>
              {INVESTOR.adresse.map((z) => <div key={z}>{z}</div>)}
              <a href={`mailto:${INVESTOR.email}`} style={{ color: "#93c5fd", textDecoration: "none", wordBreak: "break-all" }}>{INVESTOR.email}</a>
            </div>
          </div>
        </Auf>
      )}
      {kompakt && (
        <Auf verzoegerung={280}>
          <p className="dk-leise" style={{ marginTop: 20 }}>Investor und Partner: <span style={{ color: "#e5e7eb" }}>{INVESTOR.name}</span>, Zürich – hat den Aufbau ermöglicht.</p>
        </Auf>
      )}
    </>
  );
}

/** Die Mitarbeiterinnen und Mitarbeiter — präsentiert wie die Gesellschafter: großes Porträt, Name, Bereich, ein Satz. */
const BEREICH_SATZ: Record<string, string> = {
  "Vertrieb": "Führt das erste Gespräch: erklärt die Auskunft, findet das passende Paket, legt den ersten Schritt fest.",
  "Onboarding": "Begleitet neue Kunden vom Startgespräch an – Zahlung, Auskunft, Fahrplan, fester Ansprechpartner.",
  "Forderungsmanagement": "Begleitet Raten und Fristen, findet Lösungen mit Kunden und Gläubigern, bevor etwas platzt.",
};
export function Mitarbeiter() {
  return (
    <div className="team-ma">
      {MITARBEITER.map((m, i) => (
        <Auf key={m.kuerzel} verzoegerung={i * 70}>
          <Glas ruhig className="team-ma-karte">
            <div className="team-ma-bild"><Portrait kuerzel={m.kuerzel} name={m.name} gross /></div>
            <div className="team-ma-text">
              <span className="tag">{m.rolle}</span>
              <h3 className="dk-h3">{m.name}</h3>
              <p className="team-ma-titel">{m.titel}</p>
              <p className="dk-text">{m.text}</p>
            </div>
          </Glas>
        </Auf>
      ))}
      <Auf verzoegerung={MITARBEITER.length * 70}>
        <a href="/karriere" className="dk-glas team-ma-karte team-ma-du">
          <div className="team-ma-bild"><span className="team-ma-platz" aria-hidden="true">Sie?</span></div>
          <div className="team-ma-text">
            <span className="tag">Offene Plätze</span>
            <h3 className="dk-h3">Möchten Sie auch hier stehen?</h3>
            <p className="team-ma-titel">Fest oder frei, remote in Deutschland, Österreich und der Schweiz</p>
            <p className="dk-text">Ein junges Legal- und FinTech auf dem Weg zum Unicorn sucht Menschen für Vertrieb, Onboarding, Forderungsmanagement, Kundenservice, Produkt, Marketing und Recht. Bewerbung in vier Schritten.</p>
            <span className="dk-knopf" style={{ marginTop: 18 }}>Bereiche ansehen</span>
          </div>
        </a>
      </Auf>
    </div>
  );
}
