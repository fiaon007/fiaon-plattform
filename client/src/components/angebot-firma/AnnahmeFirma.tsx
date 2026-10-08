// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME DES FIRMENANGEBOTS (E-301)
//
// Reihenfolge: Startwahl → zwei Pflicht-Häkchen (Unternehmerin, Vertretung;
// nie vorangekreuzt) → Bestellübersicht UNMITTELBAR über dem Knopf → Knopf
// (Knopftext aus annahme.knopf = FIRMA_KNOPF, eine Quelle) → Satz darunter mit der Zahlungspflicht. Fehlt etwas, sagt die
// Seite beim Klick genau was, am Feld und unter dem Knopf, und springt hin.
// POST /api/fiaon/global/angebot/:token/annehmen mit FirmaAnnahmeEingabe
// (+ Honigtopf „falle“ wie heute). 409 / Code GEAENDERT: „bitte neu laden“ mit
// Knopf, der die Kundensicht neu holt. Texte aus annahme/uebersicht/beginn;
// die Fehlersätze unten (MELDUNG) sind Bedienmeldungen der Seite.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { FirmaAnnahmeEingabe, FirmaKundenSicht } from "@shared/fiaon-global-angebot-firma-typen";
import { Zeichen, ruhig, tagDe } from "./gemeinsam";

const MELDUNG = {
  fehltTitel: "Bitte noch ergänzen:",
  fehltStart: "Wann sollen wir beginnen? Bitte wählen Sie „sofort“ oder einen Starttag.",
  fehltDatum: (von: string, bis: string) => `Bitte wählen Sie einen Starttag zwischen ${von} und ${bis}.`,
  fehltHaken: "Bitte bestätigen Sie beide Punkte.",
  sendet: "Wird gespeichert …",
  neuLaden: "Angebot neu laden",
  geaendert: "Das Angebot wurde inzwischen aktualisiert. Bitte laden Sie es neu und prüfen Sie es noch einmal.",
  allgemein: "Die Annahme ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.",
  netz: "Keine Verbindung — Ihre Annahme ist NICHT angekommen. Bitte versuchen Sie es noch einmal.",
  vorschau: "Vorschau der Leitung — annehmen kann nur die Kundin bzw. der Kunde.",
  datumFeld: "Starttag",
};

export default function AnnahmeFirma({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: FirmaKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const A = sicht.annahme, U = sicht.uebersicht, R = sicht.beginn;
  const [start, setStart] = useState<"" | "sofort" | "datum">("");
  const [startAm, setStartAm] = useState("");
  const [unternehmer, setUnternehmer] = useState(false);
  const [vertretung, setVertretung] = useState(false);
  const [falle, setFalle] = useState("");
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  const [geaendert, setGeaendert] = useState(false);

  const datumGut = /^\d{4}-\d{2}-\d{2}$/.test(startAm) && startAm >= R.morgen && startAm <= R.spaetestens;
  const fehlt: { id: string; text: string }[] = [];
  if (!start) fehlt.push({ id: "gaf-start", text: MELDUNG.fehltStart });
  else if (start === "datum" && !datumGut) fehlt.push({ id: "gaf-startdatum", text: MELDUNG.fehltDatum(tagDe(R.morgen), tagDe(R.spaetestens)) });
  if (!unternehmer || !vertretung) fehlt.push({ id: "gaf-haken", text: MELDUNG.fehltHaken });
  const zeig = (id: string) => zeigeFehlt && fehlt.some((f) => f.id === id);

  const hinspringen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: ruhig() ? "auto" : "smooth" });
    const feld = el.querySelector<HTMLInputElement>("input") ?? el;
    window.setTimeout(() => feld.focus({ preventScroll: true }), ruhig() ? 0 : 350);
  };

  const absenden = async () => {
    if (sendet || !sicht.annahmeBereit || sicht.vorschauLeitung) return;
    if (fehlt.length) { setZeigeFehlt(true); setFehler(""); hinspringen(fehlt[0].id); return; }
    setSendet(true); setFehler(""); setGeaendert(false);
    const eingabe: FirmaAnnahmeEingabe & { falle: string } = { textHash: sicht.textHash, unternehmer: true, vertretung: true, startAm: start === "datum" ? startAm : null, falle };
    try {
      const r = await fetch(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { onAngenommen(j); return; }
      if (r.status === 409 || j?.code === "GEAENDERT") { setGeaendert(true); setFehler(j?.error || MELDUNG.geaendert); return; }
      setFehler(j?.error || MELDUNG.allgemein);
      if (j?.code === "STARTDATUM") { setZeigeFehlt(true); hinspringen("gaf-startdatum"); }
    } catch {
      setFehler(MELDUNG.netz);
    } finally { setSendet(false); }
  };

  return (
    <div className="gaf-annahme" data-fiaon="firma-annahme">
      <div className={`gaf-annahme-feld${zeig("gaf-start") ? " fehlt" : ""}`} id="gaf-start" role="radiogroup" aria-labelledby="gaf-start-titel"
        aria-invalid={zeig("gaf-start") || undefined} aria-describedby={zeig("gaf-start") ? "gaf-start-hinweis" : zeig("gaf-startdatum") ? "gaf-startdatum-hinweis" : undefined}>
        <h3 className="gaf-h3" id="gaf-start-titel">{A.startTitel}</h3>
        <div className="gaf-start-wahl">
          <label className={`gaf-wahl${start === "sofort" ? " an" : ""}`}>
            <input type="radio" name="gaf-start" checked={start === "sofort"} onChange={() => setStart("sofort")} aria-invalid={zeig("gaf-start") || undefined} />
            <span className="gaf-wahl-punkt" aria-hidden="true" /><span className="gaf-wahl-text">{A.startSofort}</span>
          </label>
          <div className={`gaf-wahl gaf-wahl-datum${start === "datum" ? " an" : ""}`}>
            <label className="gaf-wahl-kopf">
              {/* Den Fokus ins Datumsfeld nur bei einem Mausklick schieben (detail > 0) — mit den Pfeiltasten bleibt er auf der Wahl (WCAG 3.2.2). */}
              <input type="radio" name="gaf-start" checked={start === "datum"} onChange={() => setStart("datum")} aria-invalid={zeig("gaf-start") || undefined}
                onClick={(e) => { if (e.detail > 0) window.setTimeout(() => document.getElementById("gaf-startdatum-feld")?.focus(), 0); }} />
              <span className="gaf-wahl-punkt" aria-hidden="true" /><span className="gaf-wahl-text">{A.startAb}</span>
            </label>
            {start === "datum" && (
              <div className={`gaf-datum${zeig("gaf-startdatum") ? " fehlt" : ""}`} id="gaf-startdatum">
                <label htmlFor="gaf-startdatum-feld">{MELDUNG.datumFeld}</label>
                <input id="gaf-startdatum-feld" type="date" value={startAm} min={R.morgen} max={R.spaetestens} onChange={(e) => setStartAm(e.target.value)}
                  aria-invalid={zeig("gaf-startdatum") || undefined} aria-describedby={zeig("gaf-startdatum") ? "gaf-startdatum-hinweis" : undefined} />
              </div>
            )}
          </div>
        </div>
        {zeig("gaf-start") && <p className="gaf-feld-hinweis" id="gaf-start-hinweis">{MELDUNG.fehltStart}</p>}
        {zeig("gaf-startdatum") && <p className="gaf-feld-hinweis" id="gaf-startdatum-hinweis">{MELDUNG.fehltDatum(tagDe(R.morgen), tagDe(R.spaetestens))}</p>}
      </div>

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

      {/* Die Bestellübersicht unmittelbar über dem Knopf. */}
      <div className="gaf-uebersicht">
        <h3 className="gaf-h3">{U.titel}</h3>
        <dl>
          {U.zeilen.map((z) => <div key={z.label}><dt>{z.label}</dt><dd>{z.wert}</dd></div>)}
          <div><dt>{A.startTitel}</dt><dd className={start ? undefined : "offen"}>{start === "sofort" ? A.startSofort : start === "datum" && datumGut ? `${A.startAb} ${tagDe(startAm)}` : "—"}</dd></div>
        </dl>
        {U.fein.map((f) => <p key={f} className="gaf-fein">{f}</p>)}
      </div>

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
