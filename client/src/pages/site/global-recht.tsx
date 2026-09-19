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
// Beide auch englisch unter /en/business/… (19.09.2026, E-192): Der Vertrag und
// die Belehrung gibt es in Vertragssprache Englisch — wer englisch beauftragt,
// liest sie vorher englisch.
// 19.09.2026 (E-196): Der Mustervertrag zeigt die Jahresbetreuung als Variante —
// „Mit Jahresbetreuung (nur wenn gebucht)" rendert Ziffer 2, 3 und 5 so, wie sie
// im Auftrag stehen, wenn der Kunde den Haken setzt. Vorgabe: ohne.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Auf } from "@/components/site/DunkleBuehne";
import { useSprache } from "@/i18n/sprache";
import { globalWiderrufsbelehrung, globalWiderrufAnbieter } from "@shared/fiaon-global-widerruf";
import { GLOBAL_PAKETE, GLOBAL_JAHRESBETREUUNG, globalPreisText, type GlobalSchluessel } from "@shared/fiaon-global";
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
  const en = useSprache() === "en";
  const b = globalWiderrufsbelehrung(en ? "en" : "de");
  return (
    <Dunkel seite="business" titel={en ? "Withdrawal instructions — FIAON Global" : "Widerrufsbelehrung — FIAON Global"} beschreibung={en ? "The withdrawal instructions for FIAON Global orders placed by private individuals as consumers — with the model withdrawal form." : "Die Widerrufsbelehrung für Aufträge über FIAON Global, die Sie als Privatperson und Verbraucher erteilen — mit Muster-Widerrufsformular."}>
      <div className="fg fd gr">
        {en
          ? <Kopf auge="FIAON Global · Legal" h1="Withdrawal instructions" h1b="for private individuals."
              lead="They apply to FIAON Global orders you place as a consumer. If you order as a company, there is no statutory right of withdrawal. The same wording is attached to your contract as an annex." />
          : <Kopf auge="FIAON Global · Rechtliches" h1="Widerrufsbelehrung" h1b="für Privatpersonen."
              lead="Sie gilt für Aufträge über FIAON Global, die Sie als Verbraucher erteilen. Beauftragen Sie als Unternehmen, besteht kein gesetzliches Widerrufsrecht. Derselbe Wortlaut steht als Anlage in Ihrem Vertrag." />}
        <section className="fg-sek eng">
          <div className="fg-rahmen schmal">
            <div className="fd-hinweis gr-beginn">
              <p className="gr-klein">{en ? "When we start" : "Wann wir beginnen"}</p>
              {en
                ? <p>Without your express request, we start only after the withdrawal period has expired. If you request in the order that we start immediately and then withdraw, you pay the share of the services provided up to that point. The easiest way to withdraw is by email to <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a>, quoting your order number.</p>
                : <p>Ohne Ihren ausdrücklichen Wunsch beginnen wir erst nach Ablauf der Widerrufsfrist. Verlangen Sie im Auftrag, dass wir sofort beginnen, zahlen Sie im Fall eines Widerrufs den Anteil der Leistungen, die bis dahin erbracht sind. Am einfachsten widerrufen Sie per E-Mail an <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a> mit Ihrer Auftragsnummer.</p>}
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
                <button type="button" className="fg-knopf hell gr-drucken" onClick={() => window.print()}>{en ? "Print the form" : "Formular drucken"}</button>
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
  const s = useSprache() === "en" ? "en" : "de";
  const en = s === "en";
  const [paket, setPaket] = useState<GlobalSchluessel>("global_kapital");
  const [art, setArt] = useState<"unternehmen" | "privat">("unternehmen");
  // E-196: die Variante mit Jahresbetreuung — nur, wenn der Kunde sie im Auftrag ankreuzt.
  const [mitJahr, setMitJahr] = useState(false);
  const [html, setHtml] = useState("");
  const [stand, setStand] = useState<"laedt" | "da" | "fehler">("laedt");
  useEffect(() => {
    let weg = false;
    setStand((s) => (s === "da" ? "da" : "laedt"));
    fetch("/api/fiaon/global/vertrag/vorschau", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paket, auftraggeber: art, ...MUSTER[art], jahresbetreuung: mitJahr, sprache: s }) })
      .then((r) => r.json()).then((j) => { if (weg) return; if (j?.ok && j.html) { setHtml(String(j.html)); setStand("da"); } else setStand("fehler"); })
      .catch(() => { if (!weg) setStand("fehler"); });
    return () => { weg = true; };
  }, [paket, art, mitJahr, s]);
  const J = GLOBAL_JAHRESBETREUUNG[s];

  return (
    <Dunkel seite="business" titel={en ? "Model contract — FIAON Global" : "Mustervertrag — FIAON Global"} beschreibung={en ? "The FIAON Global engagement word for word, as presented for signature — for all four packages, as a company or as a private individual." : "Der Auftrag über FIAON Global Wort für Wort, wie er zur Unterschrift vorgelegt wird — für alle vier Pakete, als Unternehmen oder als Privatperson."}>
      <div className="fg fd gr">
        {en
          ? <Kopf auge="FIAON Global · Contract" h1="The contract," h1b="before you order."
              lead="This is your engagement — word for word, as it is presented to you for signature. Choose the package and whether you order as a company or privately; the client details are examples. The annual care plan is only part of the contract if you tick it in the order. Your contracting party is always FIAON LTD, London. The contract is governed by German law." />
          : <Kopf auge="FIAON Global · Vertrag" h1="Der Vertrag," h1b="bevor Sie beauftragen."
              lead="So lautet Ihr Auftrag — Wort für Wort, wie er Ihnen zur Unterschrift vorgelegt wird. Wählen Sie Paket und Auftraggeber; die Angaben zum Kunden sind Beispiele. Die Jahresbetreuung steht nur im Vertrag, wenn Sie sie im Auftrag ankreuzen. Vertragspartner ist in jedem Fall die FIAON LTD, London." />}
        <section className="fg-sek eng">
          <div className="fg-rahmen">
            <div className="gr-wahl">
              <div role="radiogroup" aria-label={en ? "Package" : "Paket"} className="gr-seg">
                {GLOBAL_PAKETE.map((p) => (
                  <button key={p.key} type="button" role="radio" aria-checked={paket === p.key} onClick={() => setPaket(p.key)}>
                    <b>{p[s].name}</b><span>{globalPreisText(p.key, s)}</span>
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label={en ? "Client" : "Auftraggeber"} className="gr-seg klein">
                {(["unternehmen", "privat"] as const).map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={art === a} onClick={() => setArt(a)}>{a === "privat" ? (en ? "As a private individual" : "Als Privatperson") : (en ? "As a company" : "Als Unternehmen")}</button>
                ))}
              </div>
              {/* E-196: Mit Jahresbetreuung stehen Ziffer 2, 3 und 5 so da, wie sie im Auftrag stehen, wenn der Haken gesetzt ist. */}
              <div role="radiogroup" aria-label={J.titel} className="gr-seg">
                {([false, true] as const).map((mit) => (
                  <button key={String(mit)} type="button" role="radio" aria-checked={mitJahr === mit} onClick={() => setMitJahr(mit)}>
                    <b>{mit ? (en ? `With ${J.titel.toLowerCase()}` : `Mit ${J.titel}`) : (en ? `Without ${J.titel.toLowerCase()}` : `Ohne ${J.titel}`)}</b>
                    <span>{mit ? (en ? `only if added · ${J.preisZeile}` : `nur wenn gebucht · ${J.preisZeile}`) : (en ? "package price only" : "nur der Paketpreis")}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="gr-papier" aria-busy={stand === "laedt"}>
              {stand === "fehler" && <p className="gr-leise">{en ? "The contract could not be loaded just now. Please reload the page." : "Der Vertrag konnte gerade nicht geladen werden. Bitte laden Sie die Seite neu."}</p>}
              {stand !== "fehler" && html && <div data-veraltet={stand === "laedt" ? "1" : undefined} dangerouslySetInnerHTML={{ __html: html }} />}
              {stand === "laedt" && !html && <p className="gr-leise">{en ? "Preparing the contract …" : "Vertrag wird erstellt …"}</p>}
            </div>
            <div className="gr-weiter">
              <p>{en ? "All clear? In the order you enter your details and sign on screen. Contract and invoice arrive by email." : "Passt alles? Im Auftrag tragen Sie Ihre Angaben ein und unterschreiben am Bildschirm. Vertrag und Rechnung kommen per E-Mail."}</p>
              <div className="fg-knoepfe" style={{ marginTop: 0 }}>
                <a className="fg-knopf" href={globalStartPfad(paket, s, art === "privat" ? "privat" : undefined)}>{en ? "Place this order" : "Diesen Auftrag erteilen"}</a>
                <a className="fg-knopf hell" href={en ? "/en/business#gespraech" : "/business#gespraech"}>{en ? "Talk first" : "Erst sprechen"}</a>
              </div>
            </div>
            {en
              ? <p className="gr-leise gr-quelle">Generated by the same component as the preview in the order and the PDF. Consumers also find the <a href="/en/business/widerrufsbelehrung">withdrawal instructions</a> as a separate page. Provider: {globalWiderrufAnbieter("en")}.</p>
              : <p className="gr-leise gr-quelle">Erzeugt vom selben Baustein wie die Vorschau im Auftrag und das PDF. Verbraucher finden die <a href="/business/widerrufsbelehrung">Widerrufsbelehrung</a> auch als eigene Seite. Anbieter: {globalWiderrufAnbieter("de")}.</p>}
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
