// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN IM KUNDENBEREICH — EINE KOMPONENTE FÜR /app UND /dashboard
// (E-IT-C, 08.10.2026, Punkt 3 + 13)
//
// Vorher: je Unterlage EIN Feld, das verschwand, sobald etwas vorlag — der
// Kunde konnte keinen weiteren Monat und keine Rückseite dazulegen, während die
// automatische Prüfung ihn genau darum bat (56 Sackgassen). Jetzt:
//   · je Kategorie eine Karte mit Stand (liegt vor / fehlt / wird geprüft /
//     bitte neu), dem Satz dazu und der Dateiliste (Name, Seiten, Größe, Datum,
//     von Ihnen / von FIAON, Ansehen, Entfernen solange ungeprüft);
//   · „Datei hinzufügen" ist IMMER da — Ihre bisherigen Dateien bleiben;
//   · Kontoauszug: Monatsleiste der letzten drei vollen Monate;
//   · Ausweis: der Kunde sagt, was er hochlädt (Personalausweis / Reisepass) —
//     Ausweisbilder liest keine KI, die Regel braucht diese Angabe;
//   · „Weitere Unterlagen" mit Art (Aufenthaltstitel, Einkommensnachweis,
//     Bescheid/Bescheinigung, Sonstiges) und Notiz;
//   · jede Datei eine Anfrage mit Balken und „Erneut versuchen".
// Regeln und Texte: shared/fiaon-unterlagen.ts. Server: server/routes/fiaon-unterlagen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/unterlagen.css";
import {
  AUSWEIS_ARTEN, UNTERLAGEN_GRENZEN, UNTERLAGEN_TEXTE, WEITERE_UNTERARTEN, UNTERLAGEN_KATEGORIEN, STATUS_TEXT,
  type KategorieStand, type UnterlagenDatei, type UnterlagenKategorie, type UnterlagenStand,
} from "@shared/fiaon-unterlagen";
import { lesefehlerSatz } from "@shared/fiaon-lesefehler";
import { amText, dateiSenden, fuerUploadVorbereiten, tagText, zuGross } from "@/lib/unterlagen-hochladen";

type Variante = "ap" | "mb";

interface Laeuft {
  id: string;
  kategorie: UnterlagenKategorie;
  name: string;
  anteil: number;
  zustand: "laeuft" | "fertig" | "fehler";
  satz: string | null;
  datei: File;
  felder: Record<string, string>;
}

/** Demo-Ansicht: feste Vorführwerte, nie ein echter Datensatz. */
function demoStand(): UnterlagenStand {
  const jetzt = new Date().toISOString();
  const kat = (k: UnterlagenKategorie, dateien: Partial<UnterlagenDatei>[], status: KategorieStand["status"], satz: string | null): KategorieStand => {
    const info = UNTERLAGEN_KATEGORIEN.find((x) => x.kategorie === k)!;
    return {
      kategorie: k, titel: info.titel, kurz: info.kurz, pflicht: info.pflicht, hinweis: info.hinweisKunde, status, statusText: STATUS_TEXT[status].kunde, satz,
      dateien: dateien.map((d, i) => ({ id: -(i + 1), kategorie: k, unterart: null, unterartLabel: null, name: "beispiel.pdf", kb: 240, groesse: "240 KB", seiten: 2, am: jetzt,
        von: "sie", herkunft: "portal", notiz: null, zeitraumVon: null, zeitraumBis: null, satz: null, befundText: null, geprueft: false, darfEntfernen: true, ...d } as UnterlagenDatei)),
      monate: k === "kontoauszug" ? [{ monat: "a", label: "Juli", da: true }, { monat: "b", label: "August", da: true }, { monat: "c", label: "September", da: false }] : undefined,
      darfHinzufuegen: true, sperrSatz: null, liestGerade: false, erneutAngefordert: false, geprueft: false,
    };
  };
  return {
    personId: 0, ref: null, grenzen: { mbJeDatei: UNTERLAGEN_GRENZEN.mbJeDatei, dateienJeKategorie: UNTERLAGEN_GRENZEN.dateienJeKategorie },
    kategorien: [
      kat("kontoauszug", [{ name: "umsaetze-juli-august.pdf", seiten: 4, zeitraumVon: "2026-07-01", zeitraumBis: "2026-08-31" }], "bitte_neu",
        "Ihr Kontoauszug deckt nur etwa 2 Monat(e) ab. Für die Auswertung brauchen wir die letzten drei Monate (September) — laden Sie die fehlenden einfach dazu, Ihre bisherigen Dateien bleiben."),
      kat("ausweis", [{ name: "ausweis-vorne.jpg", seiten: 1, unterart: "personalausweis", unterartLabel: "Personalausweis" }], "wird_geprueft",
        "Ihr Personalausweis ist angekommen. Sind Vorder- und Rückseite auf demselben Bild? Dann ist alles da — sonst laden Sie die Rückseite bitte dazu."),
      kat("schufa", [], "fehlt", null),
      kat("weitere", [], "fehlt", null),
    ],
  };
}

export function UnterlagenListe({ kundeRef, demo, variante, nurKategorien }: {
  kundeRef: string; demo: boolean; variante: Variante;
  /** Optional: nur diese Karten zeigen (z. B. der Bonitäts-Abschnitt nur „schufa"). */
  nurKategorien?: UnterlagenKategorie[];
}) {
  const [stand, setStand] = useState<UnterlagenStand | null>(demo ? demoStand() : null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<Laeuft[]>([]);
  const [meldung, setMeldung] = useState<Record<string, { ton: "gut" | "fehler"; text: string }>>({});
  // E-IT-C Nachbesserung: keine Vorbelegung — ein Gehaltsnachweis hieß sonst „Aufenthaltstitel“ und löste Ausweis-Sätze aus.
  const [weitereArt, setWeitereArt] = useState<string>("");
  const [notiz, setNotiz] = useState("");
  const [arbeit, setArbeit] = useState<string | null>(null);
  const letzterUpload = useRef<number>(0);
  const k = variante === "ap"
    ? { karte: "ap-karte ap-auf v1", knopf: "ap-knopf", still: "ap-knopf still klein", link: "ap-link" }
    : { karte: "mb-karte", knopf: "mb-knopf klein", still: "mb-knopf still", link: "mb-link" };
  const basis = `/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/unterlagen`;

  const laden = useCallback(async () => {
    if (demo) return;
    const r = await fetch(basis, { credentials: "include" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok && j.stand) { setStand(j.stand); setFehler(null); }
    else if (j?.grund === "keine_person") setFehler(j.text);
    else if (!stand) setFehler(j?.error || "Ihre Unterlagen lassen sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal.");
  }, [basis, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void laden(); }, [laden]);

  // Nach einem Upload: den Befund abwarten (höchstens drei Minuten), dann bleibt er stehen.
  const liest = !!stand?.kategorien.some((x) => x.liestGerade);
  useEffect(() => {
    if (demo || !liest) return;
    if (Date.now() - letzterUpload.current > UNTERLAGEN_GRENZEN.befundWartenSekunden * 1000 && letzterUpload.current > 0) return;
    const t = setTimeout(() => { void laden(); }, 5000);
    return () => clearTimeout(t);
  }, [demo, liest, stand, laden]);

  const senden = useCallback(async (eintrag: Laeuft) => {
    setLaeuft((l) => l.map((x) => (x.id === eintrag.id ? { ...x, zustand: "laeuft", anteil: 0, satz: null } : x)));
    const r = await dateiSenden(`${basis}/${eintrag.kategorie}`, eintrag.datei, eintrag.felder,
      (anteil) => setLaeuft((l) => l.map((x) => (x.id === eintrag.id ? { ...x, anteil } : x))));
    letzterUpload.current = Date.now();
    if (r.ok) {
      setLaeuft((l) => l.map((x) => (x.id === eintrag.id ? { ...x, zustand: "fertig", anteil: 1, satz: r.json?.satz ?? UNTERLAGEN_TEXTE.gelesen } : x)));
      if (r.json?.stand) setStand(r.json.stand);
      // Erfolgreiche Zeilen räumen sich nach kurzer Zeit selbst weg — die Datei steht dann in der Liste.
      setTimeout(() => setLaeuft((l) => l.filter((x) => !(x.id === eintrag.id && x.zustand === "fertig"))), 8000);
    } else {
      const satz = r.status === 0 ? UNTERLAGEN_TEXTE.verbindung
        : r.status === 413 && !r.json ? lesefehlerSatz("zu_gross", "sie", { name: eintrag.name, mb: UNTERLAGEN_GRENZEN.mbJeDatei })
        : r.json?.error || UNTERLAGEN_TEXTE.fehlerAllgemein;
      setLaeuft((l) => l.map((x) => (x.id === eintrag.id ? { ...x, zustand: "fehler", satz } : x)));
    }
  }, [basis]);

  const hinzufuegen = useCallback(async (kategorie: UnterlagenKategorie, dateien: File[], felder: Record<string, string>) => {
    if (!dateien.length) return;
    if (demo) { setMeldung((m) => ({ ...m, [kategorie]: { ton: "gut", text: UNTERLAGEN_TEXTE.demo } })); return; }
    setMeldung((m) => { const n = { ...m }; delete n[kategorie]; return n; });
    // Nacheinander: eine Datei je Anfrage — so kommt jede mit ihrem eigenen Balken an.
    for (const roh of dateien) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (zuGross(roh)) {
        setLaeuft((l) => [...l, { id, kategorie, name: roh.name, anteil: 0, zustand: "fehler", satz: lesefehlerSatz("zu_gross", "sie", { name: roh.name, mb: UNTERLAGEN_GRENZEN.mbJeDatei }), datei: roh, felder }]);
        continue;
      }
      const datei = await fuerUploadVorbereiten(roh);
      const eintrag: Laeuft = { id, kategorie, name: roh.name, anteil: 0, zustand: "laeuft", satz: null, datei, felder };
      setLaeuft((l) => [...l, eintrag]);
      await senden(eintrag);
    }
  }, [demo, senden]);

  const entfernen = async (d: UnterlagenDatei) => {
    if (demo || d.id == null) return;
    if (!window.confirm(UNTERLAGEN_TEXTE.entfernenFrage)) return;
    setArbeit(`weg-${d.id}`);
    const r = await fetch(`${basis}/datei/${d.id}/entfernen`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setArbeit(null);
    if (j?.ok) { if (j.stand) setStand(j.stand); setMeldung((m) => ({ ...m, [d.kategorie]: { ton: "gut", text: j.satz } })); }
    else setMeldung((m) => ({ ...m, [d.kategorie]: { ton: "fehler", text: j?.error || UNTERLAGEN_TEXTE.fehlerAllgemein } }));
  };

  if (fehler && !stand) return <div className={k.karte}><p className="ul-hinweis" role="status">{fehler}</p></div>;
  if (!stand) return <div className={k.karte}><p className="ul-hinweis">Wird geladen …</p></div>;

  const ansehenUrl = (d: UnterlagenDatei) => d.id != null && d.id > 0
    ? `${basis}/datei/${d.id}`
    : `/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/dokument/${d.kategorie}`;

  const wahlFeld = (kat: KategorieStand, text: string, felder: Record<string, string>, haupt: boolean, schluessel: string, gesperrt = false) => (
    <label className={haupt ? (variante === "ap" ? "ap-knopf klein" : "mb-knopf klein") : k.still} key={schluessel}
           aria-disabled={!kat.darfHinzufuegen || gesperrt || undefined} style={!kat.darfHinzufuegen || gesperrt ? { opacity: .5, pointerEvents: "none" } : undefined}>
      {text}
      <input type="file" multiple hidden accept=".pdf,image/*,.heic,.heif"
             onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; void hinzufuegen(kat.kategorie, fs, felder); }} />
    </label>
  );

  const kategorien = stand.kategorien.filter((x) => !nurKategorien || nurKategorien.includes(x.kategorie));
  return (
    <div className="ul" data-fiaon="unterlagen-liste">
      {kategorien.map((kat) => {
        const eigeneLaeufe = laeuft.filter((l) => l.kategorie === kat.kategorie);
        const satzTon = kat.status === "bitte_neu" ? "warn" : kat.status === "liegt_vor" ? "gut" : "";
        const m = meldung[kat.kategorie];
        return (
          <section key={kat.kategorie} className={`${k.karte} ul-karte`} id={kat.kategorie === "schufa" ? "auskunft-hochladen" : `unterlagen-${kat.kategorie}`}>
            <div className="ul-kopf">
              {variante === "ap" ? <h3>{kat.titel}{!kat.pflicht && <span className="ul-optional"> (optional)</span>}</h3>
                : <h4>{kat.titel}{!kat.pflicht && <span className="ul-optional"> (optional)</span>}</h4>}
              {(kat.dateien.length > 0 || kat.pflicht) && <span className={`ul-stempel ${kat.status}`}>{kat.statusText}</span>}
            </div>
            {(kat.dateien.length === 0 || kat.kategorie === "weitere") && <p className="ul-hinweis">{kat.hinweis}</p>}
            {kat.satz && kat.dateien.length > 0 && <p className={`ul-satz ${satzTon}`} role="status">{kat.satz}</p>}
            {kat.monate && kat.monate.length > 0 && (
              <>
                <div className="ul-monate" aria-label={UNTERLAGEN_TEXTE.monateTitel}>
                  {kat.monate.map((mo) => <span key={mo.monat} className={`ul-monat ${mo.da ? "da" : "fehlt"}`}>{mo.label} {mo.da ? "✓" : "– fehlt"}</span>)}
                </div>
                {kat.monate.some((mo) => !mo.da) && <p className="ul-hinweis">{UNTERLAGEN_TEXTE.monateFehlt}</p>}
              </>
            )}
            {kat.dateien.length > 0 && (
              <ul className="ul-dateien">
                {kat.dateien.map((d) => (
                  <li key={`${d.id ?? "b"}-${d.name}`} className="ul-datei">
                    <span className="ul-datei-name">{d.id == null ? UNTERLAGEN_TEXTE.bisherige : d.name}</span>
                    <span className="ul-datei-tun">
                      {!demo && <a className="ul-mini" href={ansehenUrl(d)} target="_blank" rel="noopener noreferrer">{UNTERLAGEN_TEXTE.ansehen}</a>}
                      {d.darfEntfernen && d.id != null && (
                        <button type="button" className="ul-mini weg" disabled={arbeit === `weg-${d.id}`} onClick={() => void entfernen(d)}>{UNTERLAGEN_TEXTE.entfernen}</button>
                      )}
                    </span>
                    <span className="ul-datei-meta">
                      {[d.unterartLabel, d.seiten ? `${d.seiten} Seite${d.seiten === 1 ? "" : "n"}` : null, d.groesse, amText(d.am),
                        d.von === "sie" ? UNTERLAGEN_TEXTE.vonIhnen : UNTERLAGEN_TEXTE.vonFiaon,
                        d.zeitraumVon && d.zeitraumBis ? `${tagText(d.zeitraumVon)}–${tagText(d.zeitraumBis)}` : null,
                        d.notiz ? `„${d.notiz}“` : null].filter(Boolean).join(" · ")}
                    </span>
                    {d.satz && <span className="ul-datei-satz">{d.satz}</span>}
                  </li>
                ))}
              </ul>
            )}
            {eigeneLaeufe.length > 0 && (
              <ul className="ul-laeuft" aria-live="polite">
                {eigeneLaeufe.map((l) => (
                  <li key={l.id} className={l.zustand}>
                    <div className="ul-laeuft-zeile">
                      <span>{l.name}{l.zustand === "laeuft" ? ` — ${Math.round(l.anteil * 100)} %` : ""}</span>
                      {l.zustand === "fehler" && (
                        <span style={{ display: "flex", gap: 6 }}>
                          {!zuGross(l.datei) && <button type="button" className="ul-mini" onClick={() => void senden(l)}>{UNTERLAGEN_TEXTE.wiederholen}</button>}
                          <button type="button" className="ul-mini" aria-label={`${l.name} aus der Liste nehmen`} onClick={() => setLaeuft((x) => x.filter((y) => y.id !== l.id))}>×</button>
                        </span>
                      )}
                    </div>
                    <div className="ul-balken"><span style={{ width: `${Math.round((l.zustand === "fehler" ? 1 : l.anteil) * 100)}%` }} /></div>
                    {l.satz && <span role="status">{l.satz}</span>}
                  </li>
                ))}
              </ul>
            )}
            {kat.sperrSatz && <p className="ul-satz warn">{kat.sperrSatz}</p>}
            {kat.kategorie === "ausweis" && (
              <>
                <div className="ul-tun">
                  {AUSWEIS_ARTEN.map((a, i) => wahlFeld(kat, `${a.label} hinzufügen`, { unterart: a.wert }, i === 0 && kat.dateien.length === 0, a.wert))}
                </div>
                <p className="ul-fuss">{AUSWEIS_ARTEN.map((a) => `${a.label}: ${a.hinweis}`).join(" · ")}. {UNTERLAGEN_TEXTE.aufenthaltstitelHinweis}</p>
              </>
            )}
            {kat.kategorie === "weitere" && (
              <div className="ul-wahl">
                <label>
                  <small>{UNTERLAGEN_TEXTE.weitereArt}</small>
                  <select value={weitereArt} onChange={(e) => setWeitereArt(e.target.value)}>
                    <option value="" disabled>{UNTERLAGEN_TEXTE.artWaehlen}</option>
                    {WEITERE_UNTERARTEN.map((u) => <option key={u.wert} value={u.wert}>{u.label}</option>)}
                  </select>
                </label>
                <label>
                  <small>{UNTERLAGEN_TEXTE.notiz}</small>
                  <input type="text" maxLength={120} value={notiz} placeholder={UNTERLAGEN_TEXTE.notizPlatzhalter} onChange={(e) => setNotiz(e.target.value)} />
                </label>
                <div className="ul-tun" style={{ marginTop: 0 }}>{wahlFeld(kat, UNTERLAGEN_TEXTE.hinzufuegen, { unterart: weitereArt, notiz }, true, "weitere", !weitereArt)}</div>
                {!weitereArt && <p className="ul-fuss">{UNTERLAGEN_TEXTE.artZuerst}</p>}
              </div>
            )}
            {(kat.kategorie === "kontoauszug" || kat.kategorie === "schufa") && (
              <div className="ul-tun">{wahlFeld(kat, kat.dateien.length ? UNTERLAGEN_TEXTE.hinzufuegenWeitere : UNTERLAGEN_TEXTE.hinzufuegen, {}, kat.pflicht && kat.dateien.length === 0, kat.kategorie)}</div>
            )}
            {m && <p className={`ul-meldung ${variante === "ap" ? `ap-meldung ${m.ton}` : `mb-meldung ${m.ton}`}`} role="status">{m.text}</p>}
          </section>
        );
      })}
      <p className="ul-fuss">{UNTERLAGEN_TEXTE.formate}</p>
    </div>
  );
}
