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
          <div className="dk-glas ruhig" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
            <div>
              <span className="tag">Investor und Partner</span>
              <h3 className="dk-h3">{INVESTOR.name}</h3>
              <p className="dk-text" style={{ marginTop: 8 }}>{INVESTOR.text}</p>
            </div>
            <div className="dk-leise" style={{ textAlign: "right", lineHeight: 1.6 }}>
              {INVESTOR.adresse.map((z) => <div key={z}>{z}</div>)}
              <a href={`mailto:${INVESTOR.email}`} style={{ color: "#93c5fd", textDecoration: "none" }}>{INVESTOR.email}</a>
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
