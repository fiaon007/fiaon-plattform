// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WIDERRUFSBELEHRUNG UND „IHR VERTRAG IM ÜBERBLICK“ (19.09.2026; Überblick seit 12.11.2026)
//
// Zwei Seiten, die ein vorsichtiger Käufer VOR dem Auftrag lesen will — im
// Rahmen der Business-Welt (Dunkel seite="business"), nicht auf den Rechtsseiten
// der Privatkunden-Linie:
//   /business/widerrufsbelehrung — der gesetzliche Wortlaut aus derselben
//     Quelle wie die Anlage zum Vertrag (shared/fiaon-global-widerruf.ts),
//   /business/mustervertrag — „Ihr Vertrag im Überblick“: der Aufbau des Vertrags
//     in Stichpunkten (VERKAUF_TEXTE.vertrag). Der Wortlaut steht im persönlichen
//     Angebot, vor der Unterschrift — nicht hier (siehe unten).
// Beide auch englisch unter /en/business/… (19.09.2026, E-192).
// Bis E-509 zeigte /business/mustervertrag die vier Paketverträge im Wortlaut
// (mit Paket-, Auftraggeber- und Jahresbetreuungs-Wahl, E-196).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { Dunkel, Auf } from "@/components/site/DunkleBuehne";
import { ohneBindestrichBruch } from "@/components/site/global/Wortbruch";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { useSprache } from "@/i18n/sprache";
import { globalWiderrufsbelehrung, globalWiderrufAnbieter } from "@shared/fiaon-global-widerruf";
import { VERKAUF_TEXTE, verkaufPfad } from "@shared/fiaon-global-verkauf";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import "@/styles/global.css";
import "@/styles/global-seiten.css";
import "@/styles/global-apple.css";

function Kopf({ auge, h1, h1b, lead }: { auge: string; h1: string; h1b?: string; lead: string }) {
  return (
    <section className="fd-kopf">
      <div className="fg-rahmen">
        <Auf>
          <span className="fg-auge">{auge}</span>
          <h1 className="fg-h1 fd-h1">{ohneBindestrichBruch(h1)}{h1b && <><br /><em>{ohneBindestrichBruch(h1b)}</em></>}</h1>
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
// ═══════════════════════════════════════════════════════════════════════════
// IHR VERTRAG IM ÜBERBLICK (E-509, Leitplanke 12.11.2026) — der AUFBAU des Vertrags, nicht sein Wortlaut
// Bis E-509: die vier Paketverträge im Wortlaut (POST /global/vertrag/vorschau). Mit dem einen Produkt ist der Vertrag das
// Kapital-Angebot der Fassung C — und dessen Wortlaut steht NUR im persönlichen Angebot hinter dem privaten Link (Regel seit
// 30.10.2026: die Bürgschaft wird öffentlich nicht ausgebreitet). Deshalb zeigt diese Seite keinen Vertragstext mehr, auch
// keinen gekürzten: Sie sagt in Stichpunkten, was der Vertrag regelt (VERKAUF_TEXTE.vertrag — die Wortwand liest jeden Satz,
// scripts/pruef-verkaufsmotor.ts vergleicht Ziffern und Titel mit dem Vertrag), und sie sagt klar, wo der vollständige Vertrag
// steht: im Angebot, vor der Unterschrift. Die Adresse bleibt (/business/mustervertrag), damit jeder alte Link ankommt.
// ═══════════════════════════════════════════════════════════════════════════
export function GlobalMustervertragSeite() {
  const s = useSprache() === "en" ? "en" : "de";
  const en = s === "en";
  const T = VERKAUF_TEXTE[s].vertrag;
  const liste = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(liste, 0, "0px 0px -12% 0px");

  return (
    <Dunkel seite="business" titel={T.seo.titel} beschreibung={T.seo.beschreibung} sprache={s}>
      <div className="fg fd gr">
        <Kopf auge={T.auge} h1={T.h1a} h1b={T.h1b} lead={T.lead} />
        <section className="fg-sek eng">
          <div className="fg-rahmen">
            <div className="gr-papier gr-aufbau">
              <h2 className="gr-aufbau-titel">{T.aufbauTitel}</h2>
              <ol className="gr-aufbau-liste" ref={liste}>
                {T.punkte.map((p, i) => {
                  const anlage = p.nr === "A";
                  return (
                    <li key={p.nr} style={{ ["--i" as string]: String(i) }}>
                      <span className="gr-aufbau-nr"><small>{anlage ? T.anlageWort : T.zifferWort}</small>{!anlage && <b>{p.nr}</b>}</span>
                      <div><h3>{p.titel}</h3><p>{p.text}</p></div>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="fd-hinweis gr-voll">
              <p className="gr-klein">{T.vollTitel}</p>
              <p>{T.vollText}</p>
            </div>
            <div className="gr-weiter">
              <p>{T.weiter}</p>
              <div className="fg-knoepfe" style={{ marginTop: 0 }}>
                <a className="fg-knopf" href={verkaufPfad(s)}>{VERKAUF_TEXTE[s].buehne.knopf}</a>
                <a className="fg-knopf hell" href={en ? "/en#gespraech" : "/#gespraech"}>{VERKAUF_TEXTE[s].buehne.knopfGespraech}</a>
              </div>
            </div>
            <p className="gr-leise gr-quelle">{T.widerruf} <a href={en ? "/en/business/widerrufsbelehrung" : "/business/widerrufsbelehrung"}>{T.widerrufLink}</a></p>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
