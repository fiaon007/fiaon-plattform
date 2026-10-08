// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME DES FIRMENANGEBOTS (E-301)
//
// Reihenfolge (Runde 2): zwei Pflicht-Häkchen (Unternehmerin, Vertretung; nie
// vorangekreuzt) → „Unsere Zusammenarbeit im Überblick“ → Unterschrift (zeichnen
// oder Namen tippen, Pflicht — Justin 08.10.2026, Punkt 11) → Knopf (Knopftext aus
// annahme.knopf = FIRMA_KNOPF, eine Quelle) → Satz darunter mit der Zahlungspflicht.
// Keine Startwahl mehr: Das Wachstumsbudget beginnt am Tag „Shop live“. Fehlt
// etwas, sagt die Seite beim Klick genau was, am Feld und unter dem Knopf, und
// springt hin. POST /api/fiaon/global/angebot/:token/annehmen mit
// FirmaAnnahmeEingabe (+ Honigtopf „falle“). 409 / Code GEAENDERT: „bitte neu
// laden“ mit Knopf. Die Fehlersätze unten (MELDUNG) sind Bedienmeldungen; was
// der Server sagt (z. B. zur Unterschrift), steht unter dem Knopf.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { FirmaAnnahmeEingabe, FirmaKundenSicht } from "@shared/fiaon-global-angebot-firma-typen";
import { Zeichen, ruhig } from "./gemeinsam";
import UnterschriftFeld, { type UnterschriftStand } from "./UnterschriftFeld";

const MELDUNG = {
  fehltTitel: "Bitte noch ergänzen:",
  fehltHaken: "Bitte bestätigen Sie beide Punkte.",
  sendet: "Wird gespeichert …",
  neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Die Annahme ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihre Annahme ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschau: "Vorschau der Leitung — annehmen kann nur die Kundin bzw. der Kunde.",
};

export default function AnnahmeFirma({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: FirmaKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const A = sicht.annahme, U = sicht.uebersicht;
  const [unternehmer, setUnternehmer] = useState(false);
  const [vertretung, setVertretung] = useState(false);
  const [sig, setSig] = useState<UnterschriftStand>({ da: false, eingabe: null });
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [geaendert, setGeaendert] = useState(false);
  const gesperrt = !sicht.annahmeBereit || !!sicht.vorschauLeitung;

  const fehlt: { id: string; text: string }[] = [];
  if (!unternehmer || !vertretung) fehlt.push({ id: "gaf-haken", text: MELDUNG.fehltHaken });
  if (!sig.da || !sig.eingabe) fehlt.push({ id: "gaf-unterschrift", text: A.unterschrift.fehlt });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const hinspringen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: ruhig() ? "auto" : "smooth" });
    const feld = el.querySelector<HTMLElement>("input, canvas, button") ?? el;
    window.setTimeout(() => feld.focus({ preventScroll: true }), ruhig() ? 0 : 350);
  };

  const absenden = async () => {
    if (sendet || gesperrt) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); hinspringen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false);
    const eingabe: FirmaAnnahmeEingabe & { falle: string } = { textHash: sicht.textHash, unternehmer: true, vertretung: true, unterschrift: sig.eingabe!, falle };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || MELDUNG.geaendert); return; }
      setFehler(j?.error || MELDUNG.allgemein);
      if (j?.code === "UNTERSCHRIFT") { setZeigeFehlt(true); hinspringen("gaf-unterschrift"); }
    } catch {
      setFehler(MELDUNG.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className="gaf-annahme" data-fiaon="firma-annahme">
      <div className={`gaf-annahme-feld gaf-haken${zeig("gaf-haken") ? " fehlt" : ""}`} id="gaf-haken" role="group">
        <label className={`gaf-haken-zeile${unternehmer ? " an" : ""}`}>
          <input type="checkbox" checked={unternehmer} onChange={(e) => setUnternehmer(e.target.checked)} required
            aria-invalid={(zeig("gaf-haken") && !unternehmer) || undefined} aria-describedby={zeig("gaf-haken") && !unternehmer ? "gaf-haken-hinweis" : undefined} />
          <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
          <span>{A.unternehmer}</span>
        </label>
        <label className={`gaf-haken-zeile${vertretung ? " an" : ""}`}>
          <input type="checkbox" checked={vertretung} onChange={(e) => setVertretung(e.target.checked)} required
            aria-invalid={(zeig("gaf-haken") && !vertretung) || undefined} aria-describedby={zeig("gaf-haken") && !vertretung ? "gaf-haken-hinweis" : undefined} />
          <span className="gaf-haken-kasten" aria-hidden="true"><Zeichen art="haken" groesse={14} /></span>
          <span>{A.vertretung}</span>
        </label>
        {zeig("gaf-haken") && <p className="gaf-feld-hinweis" id="gaf-haken-hinweis">{MELDUNG.fehltHaken}</p>}
      </div>

      {/* „Unsere Zusammenarbeit im Überblick“ — über Unterschrift und Knopf. */}
      <div className="gaf-uebersicht">
        <h3 className="gaf-h3">{U.titel}</h3>
        <dl>
          {U.zeilen.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}
        </dl>
        {U.fein.map((f) => <p key={f} className="gaf-fein">{f}</p>)}
      </div>

      {/* Die Unterschrift — unmittelbar über dem Knopf, Pflicht (der Server prüft sie). */}
      <UnterschriftFeld t={A.unterschrift} fehlt={zeig("gaf-unterschrift")} gesperrt={gesperrt} onAenderung={setSig} />

      <input className="gaf-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} name="firma_webseite" />
      {fehler && (
        <div className="gaf-fehler" role="alert">
          <p>{fehler}</p>
          {geaendert && <button type="button" className="gaf-knopf-leise" onClick={onNeuLaden}>{MELDUNG.neuLaden}</button>}
        </div>
      )}
      {sicht.annahmeBereit && !sicht.vorschauLeitung ? (
        <div className="gaf-knopf-block">
          <button type="button" className="gaf-knopf-annehmen" onClick={absenden} disabled={sendet} data-fiaon="firma-annehmen">
            <span>{sendet ? MELDUNG.sendet : A.knopf}</span>{!sendet && <Zeichen art="pfeil" groesse={18} />}
          </button>
          {zeigeFehlt && fehlt.length > 0 && (
            <div className="gaf-fehlt" role="alert">
              <b>{MELDUNG.fehltTitel}</b>
              <ul>{fehlt.map((f) => <li key={f.id}><a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); hinspringen(f.id); }}>{f.text}</a></li>)}</ul>
            </div>
          )}
          <p className="gaf-unterknopf">{A.unterKnopf}</p>
        </div>
      ) : (
        <div className="gaf-knopf-block">
          <button type="button" className="gaf-knopf-annehmen" disabled aria-describedby="gaf-gesperrt">{A.knopf}</button>
          <p className="gaf-gesperrt" id="gaf-gesperrt">
            {sicht.vorschauLeitung ? MELDUNG.vorschau : (sicht.gesperrtGrund || A.gesperrt)}
            {sicht.vorschauLeitung && sicht.fehlt && sicht.fehlt.length > 0 && <> · {sicht.fehlt.join(" · ")}</>}
          </p>
        </div>
      )}
    </div>
  );
}
