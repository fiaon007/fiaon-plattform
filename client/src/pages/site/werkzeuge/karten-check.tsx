// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/karten-check — Karten-Check (23.08.2026, für die Startseite)
//
// Fünf Angaben → ehrliche Einschätzung, welcher Kartenweg heute realistisch
// ist (Debit, Prepaid-Kreditkarte, Kreditkarte mit Rahmen, Premium) und was
// den nächsten Schritt öffnet. Keine Zusage, keine Bank-Entscheidung —
// eine Einordnung. Nichts wird gespeichert.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

const FRAGEN = [
  { key: "einkommen", frage: "Regelmäßiges Einkommen im Monat (netto)?", optionen: [["u1200", "Unter 1.200 €"], ["1200", "1.200 – 2.000 €"], ["2000", "2.000 – 3.500 €"], ["3500", "Über 3.500 €"]] },
  { key: "art", frage: "Wie sind Sie beschäftigt?", optionen: [["fest", "Angestellt, unbefristet"], ["befristet", "Befristet oder in Probezeit"], ["selbst", "Selbstständig / freiberuflich"], ["sonst", "Studium, Rente, Leistungen"]] },
  { key: "eintraege", frage: "Negative Einträge bei SCHUFA, KSV oder CRIF?", optionen: [["keine", "Keine bekannt"], ["erledigt", "Ja, aber erledigt (bezahlt)"], ["offen", "Ja, offen"], ["weiss", "Weiß ich nicht"]] },
  { key: "konto", frage: "Wie läuft Ihr Girokonto?", optionen: [["sauber", "Ohne Rücklastschriften, meist im Plus"], ["dispo", "Oft im Dispo"], ["rueck", "Rücklastschriften in den letzten Monaten"], ["keins", "Ich habe derzeit kein eigenes Konto"]] },
  { key: "karte", frage: "Was hatten Sie bisher?", optionen: [["kredit", "Kreditkarte mit Rahmen"], ["debit", "Nur Debit- oder Girocard"], ["prepaid", "Prepaid-Kreditkarte"], ["gekuendigt", "Karte wurde mir gekündigt"]] },
];

function einschaetzung(a: Record<string, string>) {
  if (Object.keys(a).length < FRAGEN.length) return null;
  let punkte = 0;
  punkte += { u1200: 0, "1200": 1, "2000": 2, "3500": 3 }[a.einkommen] ?? 0;
  punkte += { fest: 2, befristet: 1, selbst: 1, sonst: 0 }[a.art] ?? 0;
  punkte += { keine: 3, erledigt: 1, offen: -2, weiss: 0 }[a.eintraege] ?? 0;
  punkte += { sauber: 2, dispo: 0, rueck: -2, keins: -1 }[a.konto] ?? 0;
  punkte += { kredit: 1, debit: 0, prepaid: 0, gekuendigt: -1 }[a.karte] ?? 0;
  if (a.konto === "keins") return { stufe: "Zuerst das Konto", farbe: "#b45309", titel: "Der erste Schritt ist ein Girokonto – und das steht Ihnen zu.", text: "Ohne Konto keine Karte. Auf ein Basiskonto haben Sie in Deutschland einen Rechtsanspruch (Zahlungskontengesetz), unabhängig von Einträgen. Danach: drei Monate sauber führen, dann ist eine Debit- oder Prepaid-Karte der nächste Schritt.", schritt: "Basiskonto beantragen; FIAON bereitet die Eröffnung bei einer Partnerbank vor.", link: "/ratgeber/girokonto-trotz-schufa", linkText: "Basiskonto: So geht es" };
  if (a.eintraege === "offen" || punkte <= 2) return { stufe: "Prepaid oder Debit", farbe: "#b45309", titel: "Heute realistisch: eine Karte ohne Rahmen – und der Weg zum Rahmen ist klar.", text: "Mit offenen Einträgen oder Rücklastschriften prüft kaum ein Herausgeber einen Kreditrahmen. Eine Prepaid-Kreditkarte oder Debit-Mastercard funktioniert überall, wo eine Karte verlangt wird. Parallel gehört der Eintrag geprüft: Ist er überhaupt berechtigt? Wann läuft seine Frist ab?", schritt: "Eintrag prüfen lassen – viele sind angreifbar. Konto sauber führen. In 6–12 Monaten neu bewerten.", link: "/werkzeuge/eintrag-pruefen", linkText: "Ist mein Eintrag angreifbar?" };
  if (punkte <= 6) return { stufe: "Kreditkarte mit kleinem Rahmen", farbe: "#1d4ed8", titel: "Realistisch: eine echte Kreditkarte mit überschaubarem Rahmen – der wächst.", text: "Erledigte Einträge oder ein befristeter Vertrag sind keine Sperre, aber Herausgeber starten vorsichtig: Rahmen von 500 bis 2.000 Euro sind üblich. Entscheidend ist, was die Auskunft heute zeigt – und ob die Löschfristen bereits laufen. Nach sechs Monaten pünktlicher Nutzung lässt sich der Rahmen anpassen.", schritt: "Auskunft beschaffen und prüfen, ob erledigte Einträge noch gespeichert sein dürfen (drei Jahre, seit 2024 oft nur 18 Monate).", link: "/werkzeuge/loeschfrist", linkText: "Löschfrist berechnen" };
  return { stufe: "Kreditkarte mit Rahmen", farbe: "#047857", titel: "Gute Ausgangslage: Eine Kreditkarte mit Rahmen ist realistisch – bis 25.000 € bei guter Bonität.", text: "Stabiles Einkommen, sauberes Konto, keine offenen Einträge – das ist das Profil, das Kartenpartner sehen wollen. Über Karte und Rahmen entscheidet die Bank; FIAON sorgt dafür, dass die Auskunft stimmt und die Unterlagen vollständig sind.", schritt: "Auskunft prüfen lassen – auch unauffällige Profile haben oft alte Anfragen oder Adressfehler, die den Rahmen drücken.", link: "/privatkunden", linkText: "Karte über FIAON" };
}

export default function KartenCheck() {
  const [a, setA] = useState<Record<string, string>>({});
  const e = useMemo(() => einschaetzung(a), [a]);
  return (
    <Dunkel seite="ratgeber" titel="Karten-Check · Welche Kreditkarte ist für mich realistisch?" beschreibung="Kostenlos, ohne Anmeldung: Fünf Angaben – eine ehrliche Einschätzung, welcher Kartenweg heute realistisch ist (Debit, Prepaid, Rahmen) und was den nächsten Schritt öffnet.">
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/karte.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Welche Karte ist <span className="dk-verlauf">realistisch?</span></h1>
          <p className="dk-lead">Fünf Angaben, keine Anfrage bei einer Auskunftei, keine Spur im Score – nur eine ehrliche Einordnung und der nächste Schritt.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            {FRAGEN.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">Frage {i + 1} von {FRAGEN.length}</p><h3>{f.frage}</h3>
                <div className="wz-optionen zwei">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`wz-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}><b>{l}</b></button>)}</div>
              </div>
            ))}
          </div>
          {e && (
            <div className="wz-ergebnis" style={{ borderColor: e.farbe }}>
              <span className="wz-stufe" style={{ background: e.farbe }}>{e.stufe}</span>
              <h3>{e.titel}</h3><p>{e.text}</p>
              <div className="wz-schritt"><small>Ihr nächster Schritt</small><p>{e.schritt}</p></div>
              <div className="wz-knoepfe"><Knopf href={e.link}>{e.linkText}</Knopf><Knopf href="/antrag" still>FIAON übernimmt das</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Einordnung, keine Zusage: Über Karte und Rahmen entscheidet immer die Bank. Es wird keine Auskunft abgefragt, nichts gespeichert.</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Die Karte kommt über die Auskunft.</b> FIAON beschafft sie, bereinigt, was angreifbar ist, und bereitet den Kartenantrag vor.</>} knopf="Auskunft beschaffen" href="/antrag" />
    </Dunkel>
  );
}
