// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN IN DER AKTE — Office (pipeline) und Chefbüro (admin-kunde)
// (E-IT-C, 08.10.2026, Punkt 3 + 13)
//
// Vorher kannte die Akte je Unterlage genau EINE Datei: „Ersetzen" (neu wählen,
// alles weg) und „Löschen" (Spalte leer, ohne Archiv). Ein vierter Monat ließ
// sich nicht anhängen; ein Einzelfoto lag roh in der _pdf-Spalte.
// Jetzt je Kategorie:
//   · Stand (liegt vor / fehlt / wird geprüft / bitte neu) mit dem internen Satz,
//     beim Ausweis das Urteil der festen Regel, beim Kontoauszug die Monatsleiste;
//   · Dateiliste mit Lese-Befund („Text, 12 Seiten“, „Foto (aus HEIC)“ …),
//     Öffnen, Entfernen (mit Grund — die Datei bleibt im Archiv);
//   · „Hinzufügen“ (mehrere, nacheinander, mit Balken), „Alles ersetzen“ (mit
//     Grund), „Geprüft“ (danach entfernt der Kunde dort nichts mehr selbst),
//     „Neu lesen“ (Prüfung + Analyse jetzt);
//   · entfernte Dateien eingeklappt, mit wer/wann/warum.
// Ton: dunkel in der Akte (pipeline), hell im Chefbüro.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import "@/styles/unterlagen.css";
import {
  AUSWEIS_ARTEN, WEITERE_UNTERARTEN, UNTERLAGEN_GRENZEN,
  type KategorieStand, type UnterlagenDatei, type UnterlagenKategorie, type UnterlagenStand,
} from "@shared/fiaon-unterlagen";
import { amText, dateiSenden, fuerUploadVorbereiten, tagText, zuGross } from "@/lib/unterlagen-hochladen";

type Melden = (ton: "gut" | "schlecht", titel: string, text?: string) => void;

interface Laeuft { id: string; kategorie: UnterlagenKategorie; name: string; anteil: number; zustand: "laeuft" | "fertig" | "fehler"; satz: string | null }

export function UnterlagenAkte({ personId, adminRef, ton = "dunkel", melden, onGeaendert }: {
  personId?: number | null;
  /** Chefbüro: über die Bestellnummer, hinter dem Admin-Code. */
  adminRef?: string | null;
  ton?: "dunkel" | "hell";
  melden?: Melden;
  onGeaendert?: () => void;
}) {
  const basis = adminRef ? `/api/fiaon/admin/unterlagen/${encodeURIComponent(adminRef)}` : `/api/fiaon/agent/unterlagen/${personId}`;
  const [stand, setStand] = useState<UnterlagenStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<Laeuft[]>([]);
  const [arbeit, setArbeit] = useState<string | null>(null);
  // E-IT-C Nachbesserung: keine Vorbelegung — ein Reisepass hieß sonst „Personalausweis“ (falscher Kundensatz),
  // eine weitere Unterlage „Aufenthaltstitel“. Hochladen geht erst nach der Wahl.
  const [wahl, setWahl] = useState<Record<string, string>>({ ausweis: "", weitere: "" });
  const [notiz, setNotiz] = useState("");
  const sagen: Melden = melden ?? ((t, titel, text) => { if (t === "schlecht") window.alert([titel, text].filter(Boolean).join("\n")); });

  const laden = useCallback(async () => {
    const r = await fetch(basis, { credentials: "include" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok && j.stand) { setStand(j.stand); setFehler(null); }
    else setFehler(j?.error || "Die Unterlagen ließen sich nicht laden.");
  }, [basis]);
  useEffect(() => { if (personId || adminRef) void laden(); }, [laden, personId, adminRef]);

  const liest = !!stand?.kategorien.some((k) => k.liestGerade);
  useEffect(() => {
    if (!liest) return;
    const t = setTimeout(() => { void laden(); }, 6000);
    return () => clearTimeout(t);
  }, [liest, stand, laden]);

  const post = useCallback(async (pfad: string, body: any): Promise<any> => {
    const r = await fetch(`${basis}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }).catch(() => null);
    return r ? await r.json().catch(() => null) : null;
  }, [basis]);

  const hochladen = useCallback(async (k: UnterlagenKategorie, dateien: File[], felder: Record<string, string>, ersetzen: string | null) => {
    let ersteErsetzt = false;
    for (const roh of dateien) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (zuGross(roh)) { setLaeuft((l) => [...l, { id, kategorie: k, name: roh.name, anteil: 1, zustand: "fehler", satz: `Größer als ${UNTERLAGEN_GRENZEN.mbJeDatei} MB — bitte kleiner speichern oder seitenweise hochladen.` }]); continue; }
      const datei = await fuerUploadVorbereiten(roh);
      setLaeuft((l) => [...l, { id, kategorie: k, name: roh.name, anteil: 0, zustand: "laeuft", satz: null }]);
      const f: Record<string, string> = { ...felder };
      if (ersetzen && !ersteErsetzt) { f.ersetzen = "1"; f.grund = ersetzen; }
      const r = await dateiSenden(`${basis}/${k}`, datei, f, (anteil) => setLaeuft((l) => l.map((x) => (x.id === id ? { ...x, anteil } : x))));
      if (r.ok) {
        if (ersetzen) ersteErsetzt = true;
        setLaeuft((l) => l.map((x) => (x.id === id ? { ...x, zustand: "fertig", anteil: 1, satz: r.json?.meldung ?? "Liegt in der Akte." } : x)));
        if (r.json?.stand) setStand(r.json.stand);
        setTimeout(() => setLaeuft((l) => l.filter((x) => !(x.id === id && x.zustand === "fertig"))), 6000);
      } else {
        setLaeuft((l) => l.map((x) => (x.id === id ? { ...x, zustand: "fehler", satz: r.json?.error || (r.status === 0 ? "Keine Verbindung zum Server." : `Nicht angenommen (HTTP ${r.status}).`) } : x)));
      }
    }
    onGeaendert?.();
  }, [basis, onGeaendert]);

  const entfernen = async (d: UnterlagenDatei) => {
    if (d.id == null) return;
    const grund = window.prompt(`„${d.name}“ entfernen?\nKurz begründen (steht im Verlauf, die Datei bleibt im Archiv):`);
    if (grund === null) return;
    setArbeit(`weg-${d.id}`);
    const j = await post(`/datei/${d.id}/entfernen`, { grund });
    setArbeit(null);
    if (j?.ok) { if (j.stand) setStand(j.stand); sagen("gut", "Entfernt", j.meldung); onGeaendert?.(); }
    else sagen("schlecht", "Nicht entfernt", j?.error || "Bitte erneut versuchen.");
  };

  const aktion = async (k: KategorieStand, was: "geprueft" | "neu-lesen") => {
    setArbeit(`${was}-${k.kategorie}`);
    const j = await post(`/${k.kategorie}/${was}`, {});
    setArbeit(null);
    if (j?.ok) { if (j.stand) setStand(j.stand); else void laden(); sagen("gut", was === "geprueft" ? "Geprüft" : "Wird neu gelesen", j.meldung); onGeaendert?.(); }
    else sagen("schlecht", "Nicht ausgeführt", j?.error || "Bitte erneut versuchen.");
  };

  if (!personId && !adminRef) return null;
  if (fehler && !stand) return <p className="ua-satz">{fehler}</p>;
  if (!stand) return <p className="ua-satz">Lade die Unterlagen …</p>;

  const datei = (d: UnterlagenDatei) => d.id != null
    ? `${basis}/datei/${d.id}`
    : adminRef ? `/api/fiaon/admin/dokumente/${encodeURIComponent(adminRef)}/${d.kategorie}/datei` : `/api/fiaon/agent/dokumente/${personId}/${d.kategorie}/datei`;
  const knopf = ton === "dunkel" ? "pi-knopf still klein" : "ua-knopf";
  const ohneArt = (k: KategorieStand) => (k.kategorie === "ausweis" || k.kategorie === "weitere") && !wahl[k.kategorie];
  const hauptKnopf = ton === "dunkel" ? "pi-knopf klein" : "ua-knopf haupt";

  const dateiFeld = (k: KategorieStand, text: string, felder: Record<string, string>, ersetzen: boolean, haupt = false) => (
    <label className={haupt ? hauptKnopf : knopf}
           style={(!k.darfHinzufuegen && !ersetzen) || ohneArt(k) ? { opacity: .45, pointerEvents: "none" } : undefined}
           aria-disabled={(!k.darfHinzufuegen && !ersetzen) || ohneArt(k) || undefined}>
      {text}
      <input type="file" multiple hidden accept=".pdf,image/*,.heic,.heif"
             onChange={(e) => {
               const fs = Array.from(e.target.files ?? []); e.target.value = "";
               if (!fs.length) return;
               if (ersetzen) {
                 const grund = window.prompt(`${k.kurz}: ALLE bisherigen Dateien ersetzen?\nKurz begründen (steht im Verlauf, die alten bleiben im Archiv):`);
                 if (grund === null || grund.trim().length < 5) { if (grund !== null) sagen("schlecht", "Nicht ersetzt", "Bitte mit einem kurzen Grund (mindestens fünf Zeichen)."); return; }
                 void hochladen(k.kategorie, fs, felder, grund.trim());
               } else void hochladen(k.kategorie, fs, felder, null);
             }} />
    </label>
  );

  return (
    <div className={`ua ${ton}`} data-fiaon="unterlagen-akte">
      {stand.kategorien.map((k) => {
        const felder: Record<string, string> = k.kategorie === "ausweis" ? { unterart: wahl.ausweis }
          : k.kategorie === "weitere" ? { unterart: wahl.weitere, notiz } : {};
        const eigene = laeuft.filter((l) => l.kategorie === k.kategorie);
        return (
          <div key={k.kategorie} className="ua-kat">
            <div className="ua-kopf">
              <b>{k.kurz}{!k.pflicht ? " (optional)" : ""}</b>
              <span className={`ua-status ${k.status}`}>{k.statusText}{k.geprueft && k.dateien.length ? " · geprüft" : ""}</span>
            </div>
            {k.satz && <p className={k.status === "bitte_neu" ? "ua-warn" : "ua-satz"}>{k.satz}</p>}
            {k.ausweis && k.ausweis.hinweisIntern !== k.satz && <p className="ua-satz">Regel: {k.ausweis.hinweisIntern}</p>}
            {k.akteHinweis && <p className="ua-warn">{k.akteHinweis}</p>}
            {k.monate && (
              <div className="ua-monate">{k.monate.map((m) => <span key={m.monat} className={m.da ? "da" : "fehlt"}>{m.label} {m.da ? "✓" : "fehlt"}</span>)}</div>
            )}
            {k.dateien.length > 0 && (
              <ul className="ua-dateien">
                {k.dateien.map((d) => (
                  <li key={`${d.id ?? "b"}-${d.name}`} className="ua-datei">
                    <span className="ua-name">{d.name}{d.unterartLabel ? ` · ${d.unterartLabel}` : ""}</span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {stand.inhaltErlaubt !== false && <a className={knopf} href={datei(d)} target="_blank" rel="noreferrer">Öffnen</a>}
                      {d.id != null && <button type="button" className={knopf} disabled={arbeit === `weg-${d.id}`} onClick={() => void entfernen(d)}>Entfernen</button>}
                    </span>
                    <small>
                      {[d.seiten ? `${d.seiten} S.` : null, d.groesse, amText(d.am), d.von === "sie" ? "vom Kunden" : d.herkunft === "beschaffung" ? "von FIAON beschafft" : "vom Team",
                        d.zeitraumVon && d.zeitraumBis ? `${tagText(d.zeitraumVon)}–${tagText(d.zeitraumBis)}` : null,
                        d.befundText, d.notiz ? `„${d.notiz}“` : null, d.geprueft ? "geprüft" : null].filter(Boolean).join(" · ")}
                    </small>
                    {d.satz && <small className="ua-warn">{d.satz}</small>}
                  </li>
                ))}
              </ul>
            )}
            {eigene.length > 0 && (
              <ul className="ua-laeuft">
                {eigene.map((l) => (
                  <li key={l.id}>
                    <span>{l.name}{l.zustand === "laeuft" ? ` — ${Math.round(l.anteil * 100)} %` : ""}{l.satz ? ` — ${l.satz}` : ""}</span>
                    <div className="ua-balken"><span style={{ width: `${Math.round(l.anteil * 100)}%`, background: l.zustand === "fehler" ? "#d97706" : l.zustand === "fertig" ? "#10b981" : undefined }} /></div>
                  </li>
                ))}
              </ul>
            )}
            {k.sperrSatz && <p className="ua-warn">{k.sperrSatz}</p>}
            {(k.kategorie === "ausweis" || k.kategorie === "weitere") && (
              <div className="ua-wahl">
                <select value={wahl[k.kategorie]} onChange={(e) => setWahl({ ...wahl, [k.kategorie]: e.target.value })} aria-label={`Art der Datei (${k.kurz})`}>
                  <option value="" disabled>Art wählen …</option>
                  {(k.kategorie === "ausweis" ? AUSWEIS_ARTEN : WEITERE_UNTERARTEN).map((u) => <option key={u.wert} value={u.wert}>{u.label}</option>)}
                </select>
                {k.kategorie === "weitere" && <input type="text" maxLength={120} placeholder="Notiz (optional, intern — der Kunde sieht sie nicht)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />}
                {!wahl[k.kategorie] && <small className="ua-satz">Erst die Art wählen, dann hochladen.</small>}
              </div>
            )}
            <div className="ua-tun">
              {dateiFeld(k, k.dateien.length ? "Hinzufügen" : "Hochladen", felder, false, k.dateien.length === 0)}
              {k.kategorie !== "weitere" && k.dateien.length > 0 && dateiFeld(k, "Alles ersetzen", felder, true)}
              {k.dateien.length > 0 && !k.geprueft && (
                <button type="button" className={knopf} disabled={arbeit === `geprueft-${k.kategorie}`} onClick={() => void aktion(k, "geprueft")}>Geprüft</button>
              )}
              {k.kategorie !== "weitere" && k.dateien.length > 0 && (
                <button type="button" className={knopf} disabled={arbeit === `neu-lesen-${k.kategorie}` || k.liestGerade} onClick={() => void aktion(k, "neu-lesen")}>{k.liestGerade ? "Wird gelesen …" : "Neu lesen"}</button>
              )}
            </div>
            {k.entfernte && k.entfernte.length > 0 && (
              <details className="ua-entfernt">
                <summary>Entfernt ({k.entfernte.length})</summary>
                <ul className="ua-dateien">
                  {k.entfernte.map((d) => (
                    <li key={`e-${d.id}`} className="ua-datei">
                      <span className="ua-name">{d.name}</span>
                      {stand.inhaltErlaubt !== false && !d.inhaltGeloescht && <a className={knopf} href={datei(d)} target="_blank" rel="noreferrer">Öffnen</a>}
                      <small>{[amText(d.entferntAm), d.entferntVon, d.entferntGrund, d.inhaltGeloescht ? "Inhalt gelöscht (vom Kunden entfernt)" : null].filter(Boolean).join(" · ")}</small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
