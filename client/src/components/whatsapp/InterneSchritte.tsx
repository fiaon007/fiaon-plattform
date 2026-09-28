// ═══════════════════════════════════════════════════════════════════════════
// MARAS INTERNE SCHRITTE — gebündelt, einklappbar, in Klartext (E-248)
//
// VORHER (E-236): jede Handlung ein eigener gerahmter Kasten, vier davon rot,
// mit Rohtext wie „nenne nur Zeiten aus freie_zeiten oder rueckruf_eintragen".
// Im Pflichtfall standen 16 Kästen neben 15 Blasen — das Gespräch war darunter
// kaum noch zu finden, und das blaue „Mara ·" ließ sie wie Nachrichten aussehen.
//
// NACHHER: Alles, was Mara zwischen zwei Nachrichten intern getan hat, ist EINE
// randlose Zeile in der Mitte: „Mara · 3 interne Schritte · 1 verworfen ▾".
// Aufgeklappt: Zeit, Zeichen, Klartext — der Rohtext klein darunter, die
// Nachprüfung eingetragener Termine als Marke mit ihren Punkten.
// Nie eine Blase: Es sind keine Nachrichten, der Kunde hat sie nie gesehen.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { pruefTeile, schrittKlartext, uhr, type MaraEreignis } from "./wr-format";

export function InterneSchritte({ liste, offen, onUmschalten }: {
  liste: MaraEreignis[]; offen: boolean; onUmschalten: () => void;
}) {
  const [pruefOffen, setPruefOffen] = useState<number | null>(null);
  const schritte = liste.map((e) => ({ e, k: schrittKlartext(e) }));
  const rot = schritte.filter((s) => s.k.ton === "rot" || s.e.pruefungOk === false).length;
  const warn = schritte.filter((s) => s.k.ton === "warn").length;
  const gut = schritte.find((s) => s.k.ton === "gut");
  const listenId = `wr-schritte-${liste[0]?.id ?? 0}`;

  // Ein einzelner Schritt sagt direkt, was er war; mehrere werden gezählt.
  const kopf = schritte.length === 1
    ? schritte[0].k.titel
    : `${schritte.length} interne Schritte`;
  const zusatz = [
    rot ? `${rot} verworfen oder fehlerhaft` : null,
    !rot && warn ? `${warn} Hinweis${warn > 1 ? "e" : ""}` : null,
    schritte.length > 1 && gut ? gut.k.titel : null,
  ].filter(Boolean);

  return (
    <div className={`wr-intern${rot ? " rot" : warn ? " warn" : gut ? " gut" : ""}`}>
      <button type="button" className="wr-intern-kopf" aria-expanded={offen} aria-controls={offen ? listenId : undefined} onClick={onUmschalten}>
        {rot > 0 && <i className="wr-intern-punkt" aria-hidden="true" />}
        <span className="wr-intern-wer">Mara</span>
        <span className="wr-intern-text">{kopf}{zusatz.length ? ` · ${zusatz.join(" · ")}` : ""}</span>
        <svg className="wr-intern-pfeil" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {offen && (
        <ol id={listenId} className="wr-intern-liste" aria-label="Maras interne Schritte">
          {schritte.map(({ e, k }) => {
            const teile = pruefTeile(e.pruefung);
            const fehler = teile.filter((t) => !t.gut);
            const wirdGeprueft = e.pruefungOk == null && e.ok !== false && e.terminId != null
              && (e.art === "termin_gebucht" || e.art === "termin_verschoben");
            const marke = e.pruefungOk === false
              ? { klasse: "fehler", text: `Prüfung: ${fehler[0]?.text ?? "nicht bestanden"}${fehler.length > 1 ? ` (+${fehler.length - 1})` : ""}` }
              : e.pruefungOk === true ? { klasse: "ok", text: "geprüft" } : null;
            const aufgeklappt = pruefOffen === e.id && teile.length > 0;
            const ton = e.pruefungOk === false ? "rot" : k.ton;
            return (
              <li key={e.id} className={ton ? `ton-${ton}` : undefined} data-art={e.art}>
                <time dateTime={e.am}>{uhr(e.am)}</time>
                <span className="wr-intern-zeichen" aria-hidden="true">{ton === "rot" ? "✕" : ton === "warn" ? "!" : ton === "gut" ? "✓" : "·"}</span>
                <span className="wr-intern-satz">
                  {k.titel}
                  {marke && (teile.length > 0 ? (
                    <button type="button" className={`wr-pruefmarke ${marke.klasse}`} aria-expanded={aufgeklappt}
                      onClick={() => setPruefOffen(aufgeklappt ? null : e.id)}>{marke.text}</button>
                  ) : <span className={`wr-pruefmarke ${marke.klasse}`}>{marke.text}</span>)}
                  {wirdGeprueft && <span className="wr-pruefmarke offen" title="Der Prüftakt kontrolliert diesen Termin in den nächsten Minuten.">wird geprüft</span>}
                  {k.roh && k.roh !== k.titel && <small>{k.roh}</small>}
                  {aufgeklappt && (
                    <ul className="wr-pruefliste" aria-label="Ergebnis der Nachprüfung">
                      {teile.map((t, i) => (
                        <li key={i} className={t.gut ? "gut" : "fehler"}>
                          <span aria-hidden="true">{t.gut ? "✓" : "✕"}</span>
                          <span className="wr-unsichtbar">{t.gut ? "In Ordnung: " : "Fehler: "}</span>{t.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
