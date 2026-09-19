// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WIDERRUFSBELEHRUNG UND MUSTERVERTRAG (19.09.2026)
//
// Zwei Seiten, die ein vorsichtiger Käufer VOR dem Auftrag lesen will — im
// Rahmen der Business-Welt (Dunkel seite="business"), nicht auf den Rechtsseiten
// der Privatkunden-Linie:
//   /business/widerrufsbelehrung — der gesetzliche Wortlaut aus derselben
//     Quelle wie die Anlage zum Vertrag (shared/fiaon-global-widerruf.ts),
//   /business/mustervertrag — der Auftrag Wort für Wort, erzeugt vom selben
//     Server-Baustein wie Vorschau und PDF (POST /global/vertrag/vorschau),
//     mit Beispieldaten; Paket und Auftraggeber wählbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Auf } from "@/components/site/DunkleBuehne";
import { globalWiderrufsbelehrung, globalWiderrufAnbieter } from "@shared/fiaon-global-widerruf";
import { GLOBAL_PAKETE, globalPreisText, type GlobalSchluessel } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import "@/styles/global.css";
import "@/styles/global-seiten.css";

function Kopf({ auge, h1, h1b, lead }: { auge: string; h1: string; h1b?: string; lead: string }) {
  return (
    <section className="fd-kopf">
      <div className="fg-rahmen">
        <Auf>
          <span className="fg-auge">{auge}</span>
          <h1 className="fg-h1 fd-h1">{h1}{h1b && <><br /><em>{h1b}</em></>}</h1>
          <p className="fd-lead">{lead}</p>
        </Auf>
      </div>
    </section>
  );
}

// ── /business/widerrufsbelehrung ────────────────────────────────────────────
export function GlobalWiderrufsbelehrungSeite() {
  const b = globalWiderrufsbelehrung("de");
  return (
    <Dunkel seite="business" titel="Widerrufsbelehrung — FIAON Global" beschreibung="Die Widerrufsbelehrung für Aufträge über FIAON Global, die Sie als Privatperson und Verbraucher erteilen — mit Muster-Widerrufsformular.">
      <div className="fg fd gr">
        <Kopf auge="FIAON Global · Rechtliches" h1="Widerrufsbelehrung" h1b="für Privatpersonen."
          lead="Sie gilt für Aufträge über FIAON Global, die Sie als Verbraucher erteilen. Beauftragen Sie als Unternehmen, besteht kein gesetzliches Widerrufsrecht. Derselbe Wortlaut steht als Anlage in Ihrem Vertrag." />
        <section className="fg-sek eng">
          <div className="fg-rahmen schmal">
            <div className="fd-hinweis gr-beginn">
              <p className="gr-klein">Wann wir beginnen</p>
              <p>Ohne Ihren ausdrücklichen Wunsch beginnen wir erst nach Ablauf der Widerrufsfrist. Verlangen Sie im Auftrag, dass wir sofort beginnen, zahlen Sie im Fall eines Widerrufs den Anteil der Leistungen, die bis dahin erbracht sind. Am einfachsten widerrufen Sie per E-Mail an <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a> mit Ihrer Auftragsnummer.</p>
            </div>
            <article className="gr-text">
              {b.abschnitte.map((a) => (
                <section key={a.h}>
                  <h2>{a.h}</h2>
                  {a.absaetze.map((t) => <p key={t.slice(0, 40)}>{t}</p>)}
                </section>
              ))}
              <section className="gr-formular">
                <h2>{b.formular.titel}</h2>
                <p className="gr-leise">{b.formular.hinweis}</p>
                <ul>
                  <li><span>{b.formular.an}</span></li>
                  {b.formular.zeilen.map((z) => <li key={z}><span>{z}</span><i aria-hidden="true" /></li>)}
                </ul>
                <p className="gr-leise">{b.formular.fuss}</p>
                <button type="button" className="fg-knopf hell gr-drucken" onClick={() => window.print()}>Formular drucken</button>
              </section>
            </article>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}

// ── /business/mustervertrag ─────────────────────────────────────────────────
const MUSTER = {
  unternehmen: { firma: { land: "DE", name: "Muster GmbH", rechtsform: "GmbH", strasse: "Musterstraße 1", plz: "10115", ort: "Berlin" }, ansprechpartner: { anrede: "Herr", vorname: "Max", nachname: "Mustermann", funktion: "Geschäftsführer" } },
  privat: { firma: { land: "DE", strasse: "Musterweg 2", plz: "10115", ort: "Berlin" }, ansprechpartner: { anrede: "Frau", vorname: "Erika", nachname: "Mustermann" } },
} as const;

export function GlobalMustervertragSeite() {
  const [paket, setPaket] = useState<GlobalSchluessel>("global_kapital");
  const [art, setArt] = useState<"unternehmen" | "privat">("unternehmen");
  const [html, setHtml] = useState("");
  const [stand, setStand] = useState<"laedt" | "da" | "fehler">("laedt");
  useEffect(() => {
    let weg = false;
    setStand((s) => (s === "da" ? "da" : "laedt"));
    fetch("/api/fiaon/global/vertrag/vorschau", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paket, auftraggeber: art, ...MUSTER[art], sprache: "de" }) })
      .then((r) => r.json()).then((j) => { if (weg) return; if (j?.ok && j.html) { setHtml(String(j.html)); setStand("da"); } else setStand("fehler"); })
      .catch(() => { if (!weg) setStand("fehler"); });
    return () => { weg = true; };
  }, [paket, art]);

  return (
    <Dunkel seite="business" titel="Mustervertrag — FIAON Global" beschreibung="Der Auftrag über FIAON Global Wort für Wort, wie er zur Unterschrift vorgelegt wird — für alle vier Pakete, als Unternehmen oder als Privatperson.">
      <div className="fg fd gr">
        <Kopf auge="FIAON Global · Vertrag" h1="Der Vertrag," h1b="bevor Sie beauftragen."
          lead="So lautet Ihr Auftrag — Wort für Wort, wie er Ihnen zur Unterschrift vorgelegt wird. Wählen Sie Paket und Auftraggeber; die Angaben zum Kunden sind Beispiele. Vertragspartner ist in jedem Fall die FIAON LTD, London." />
        <section className="fg-sek eng">
          <div className="fg-rahmen">
            <div className="gr-wahl">
              <div role="radiogroup" aria-label="Paket" className="gr-seg">
                {GLOBAL_PAKETE.map((p) => (
                  <button key={p.key} type="button" role="radio" aria-checked={paket === p.key} onClick={() => setPaket(p.key)}>
                    <b>{p.de.name}</b><span>{globalPreisText(p.key)}</span>
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Auftraggeber" className="gr-seg klein">
                {(["unternehmen", "privat"] as const).map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={art === a} onClick={() => setArt(a)}>{a === "privat" ? "Als Privatperson" : "Als Unternehmen"}</button>
                ))}
              </div>
            </div>
            <div className="gr-papier" aria-busy={stand === "laedt"}>
              {stand === "fehler" && <p className="gr-leise">Der Vertrag konnte gerade nicht geladen werden. Bitte laden Sie die Seite neu.</p>}
              {stand !== "fehler" && html && <div data-veraltet={stand === "laedt" ? "1" : undefined} dangerouslySetInnerHTML={{ __html: html }} />}
              {stand === "laedt" && !html && <p className="gr-leise">Vertrag wird erstellt …</p>}
            </div>
            <div className="gr-weiter">
              <p>Passt alles? Im Auftrag tragen Sie Ihre Angaben ein und unterschreiben am Bildschirm. Vertrag und Rechnung kommen per E-Mail.</p>
              <div className="fg-knoepfe" style={{ marginTop: 0 }}>
                <a className="fg-knopf" href={globalStartPfad(paket, "de", art === "privat" ? "privat" : undefined)}>Diesen Auftrag erteilen</a>
                <a className="fg-knopf hell" href="/business#gespraech">Erst sprechen</a>
              </div>
            </div>
            <p className="gr-leise gr-quelle">Erzeugt vom selben Baustein wie die Vorschau im Auftrag und das PDF. Verbraucher finden die <a href="/business/widerrufsbelehrung">Widerrufsbelehrung</a> auch als eigene Seite. Anbieter: {globalWiderrufAnbieter("de")}.</p>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
