// ═══════════════════════════════════════════════════════════════════════════
// /agent/global — DIE AUFTRÄGE VON FIAON GLOBAL (17.09.2026, E-188)
//
// Justin (17.09.2026): „Mach alles fix fertig, keine Platzhalter." Die Pakete
// von FIAON Global versprechen einen eigenen Dokumentenraum, einen
// Pflichtenkalender, einen festen Ansprechpartner und einen monatlichen
// Durchgang. Der Kunde hat dafür seine Seite „Mein Auftrag" — und die Person,
// die das alles LIEFERT (zuständig: Daniel Stripling, Vertriebsleitung), hat
// dieses Werkzeug: hier die Liste, unter /agent/global/:ref die Akte.
//
// ── WAS DIE LISTE BEANTWORTET ──────────────────────────────────────────────
//   · Wo liegt Geld ohne Arbeit? „Bezahlt, nicht gestartet" steht ganz oben.
//   · Welche Frist kommt als Nächstes? Danach wird sortiert, dann nach Alter.
//   · Was fehlt je Auftrag? Offene Unterlagen, nächster Schritt, Stichtag.
// Vier ruhige Zahlen im Kopf, darunter eine Zeile je Auftrag; ein Klick (oder
// Enter) öffnet die Akte. Geld wird hier nicht gebucht — der Zahlungseingang
// läuft über den einen Weg des Hauses und startet den Auftrag von selbst.
//
// ── WER DAS SIEHT ──────────────────────────────────────────────────────────
// Die zuständige Person des Auftrags, die Vertriebsleitung, Admin/Chef. Alle
// anderen bekommen vom Server 403 — dann sagt die Seite das in einem Satz, und
// die Leiste zeigt den Raum gar nicht erst (OfficeShell). Der Server zu dieser
// Seite: GET /api/fiaon/agent/global/auftraege. Reine Logik (Lesen, Sortieren,
// Zählen) liegt in global-logik.ts und wird von scripts/pruef-global-office.ts
// geprüft.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AgentShell, api, useAgentInfo } from "./shared";
import { useOffice } from "./OfficeShell";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import {
  type GlobalZeile, type GlobalFilter, FILTER_TEXT, STATUS_TEXT, STATUS_KURZ, ETAPPEN_TITEL,
  zeilenLesen, sortiere, kopfZahlen, filtere, tagText, fristLage, euroText, berlinTag,
} from "./global-logik";
import { globalZugriffMerken } from "./global-zugriff";
import "@/styles/office-pipeline.css";
import "@/styles/office-rundgang.css";
import "@/styles/office-global.css";

type Zustand = "laedt" | "ok" | "kein_zugriff" | "nicht_da" | "fehler";

export default function AgentGlobalPage() { return <AgentShell><ListeInnen /></AgentShell>; }

/** Die Vier-Punkt-Leiste: Etappe 1–4. Etappe 0 = noch nichts begonnen, 5 = alles fertig. */
export function EtappenPunkte({ etappe }: { etappe: number }) {
  const titel = ETAPPEN_TITEL[Math.min(5, Math.max(0, etappe))] ?? "";
  const lesbar = etappe <= 0 ? `Noch vor Etappe 1: ${titel}` : etappe >= 5 ? "Alle vier Etappen abgeschlossen" : `Etappe ${etappe} von 4: ${titel}`;
  return (
    <span className="gl-punkte" role="img" aria-label={lesbar} title={lesbar}>
      {[1, 2, 3, 4].map((nr) => <i key={nr} className={nr < etappe ? "fertig" : nr === etappe ? "jetzt" : ""} />)}
    </span>
  );
}

function ListeInnen() {
  const { dunkel, titel } = useOffice();
  const { agent } = useAgentInfo();
  useEffect(() => { dunkel(true); titel("FIAON Global"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [zustand, setZustand] = useState<Zustand>("laedt");
  const [fehlerText, setFehlerText] = useState("");
  const [zeilen, setZeilen] = useState<GlobalZeile[]>([]);
  const [filter, setFilter] = useState<GlobalFilter>("laufend");
  const [suche, setSuche] = useState("");
  const [laedtNeu, setLaedtNeu] = useState(false);

  const laden = useCallback(async () => {
    setLaedtNeu(true);
    try {
      const r = await api("/agent/global/auftraege");
      if (r.ok) { setZeilen(zeilenLesen(r.json)); setZustand("ok"); globalZugriffMerken(agent?.email, true); }
      else if (r.status === 403) { setZustand("kein_zugriff"); globalZugriffMerken(agent?.email, false); }
      else if (r.status === 404) setZustand("nicht_da");
      else { setFehlerText(String(r.json?.error || "")); setZustand("fehler"); }
    } catch { setFehlerText("Keine Verbindung zum Server."); setZustand("fehler"); }
    setLaedtNeu(false);
  }, [agent?.email]);
  useEffect(() => { void laden(); }, [laden]);

  const heute = useMemo(() => berlinTag(), []);
  const zahlen = useMemo(() => kopfZahlen(zeilen, heute), [zeilen, heute]);
  const sichtbar = useMemo(() => sortiere(filtere(zeilen, filter, suche)), [zeilen, filter, suche]);
  const jeFilter = useMemo(() => {
    const aus = {} as Record<GlobalFilter, number>;
    for (const [k] of FILTER_TEXT) aus[k] = filtere(zeilen, k, "").length;
    return aus;
  }, [zeilen]);

  return (
    <div className="gl" data-fiaon="global-liste">
      <header className="gl-kopf">
        <span className="pi-pille">FIAON Global · Aufträge</span>
        <h1>Die US-Struktur. <span className="pi-verlauf">Auftrag für Auftrag.</span></h1>
        <p>Jeder unterschriebene Auftrag mit Stand, nächstem Schritt, fehlenden Unterlagen und der nächsten Frist. Oben steht, was heute Arbeit braucht — ein Klick öffnet die Akte.</p>
      </header>

      {zustand === "laedt" && (
        <div className="gl-glas gl-tafel" aria-busy="true" aria-label="Aufträge werden geladen">
          <div className="gl-liste">{[0, 1, 2, 3].map((i) => <div key={i} className="gl-skelett" />)}</div>
        </div>
      )}

      {zustand === "kein_zugriff" && (
        <div className="gl-glas gl-still" role="status">
          <b>Dieser Raum gehört der Person, die für FIAON Global zuständig ist.</b>
          <p>Du siehst ihn, sobald dir ein Global-Auftrag zugeteilt ist. Fragt ein Unternehmen bei dir nach der US-Struktur: Im Raum Firmen liegt der Leitfaden und der Auftragslink.</p>
          <Link href="/agent/firmen" className="pi-knopf still">Zum Raum Firmen</Link>
        </div>
      )}

      {zustand === "nicht_da" && (
        <div className="gl-glas gl-still" role="status">
          <b>FIAON Global ist auf diesem Server noch nicht freigeschaltet.</b>
          <p>Der Raum kommt mit dem Start von FIAON Global. Bis dahin liegen neue Aufträge als Aufgabe bei der zuständigen Person.</p>
          <Link href="/agent/aufgaben" className="pi-knopf still">Zu den Aufgaben</Link>
        </div>
      )}

      {zustand === "fehler" && (
        <div className="gl-glas gl-still" role="alert">
          <b>Die Aufträge lassen sich gerade nicht laden.</b>
          <p>{fehlerText || "Der Server hat nicht geantwortet."} Es ist nichts verloren — versuch es gleich noch einmal.</p>
          <button type="button" className="pi-knopf" disabled={laedtNeu} onClick={() => void laden()}>{laedtNeu ? "Lädt …" : "Noch einmal laden"}</button>
        </div>
      )}

      {zustand === "ok" && (
        <>
          <section className="gl-zahlen" aria-label="Überblick">
            <div className="gl-zahl"><small>Offen, unbezahlt</small><b>{zahlen.offen}</b><span>{zahlen.offen ? `${euroText(zahlen.offenCents)} warten auf die Überweisung` : "keiner wartet auf Zahlung"}</span></div>
            <div className={`gl-zahl${zahlen.bezahlt ? " achtung" : ""}`}><small>Bezahlt, nicht gestartet</small><b>{zahlen.bezahlt}</b><span>{zahlen.bezahlt ? "Geld ist da — Startgespräch führen" : "nichts liegt ohne Arbeit"}</span></div>
            <div className="gl-zahl"><small>In Arbeit</small><b>{zahlen.inArbeit}</b><span>gestartete Aufträge</span></div>
            <div className={`gl-zahl${zahlen.fristen30 ? " achtung" : ""}`}><small>Fristen in 30 Tagen</small><b>{zahlen.fristen30}</b><span>Aufträge mit fälliger oder überfälliger Frist</span></div>
          </section>

          <div className="gl-leiste">
            <div className="gl-filter" role="group" aria-label="Nach Stand filtern">
              {FILTER_TEXT.map(([k, t]) => (
                <button key={k} type="button" className="gl-chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}<em>{jeFilter[k] ?? 0}</em></button>
              ))}
            </div>
            <div className="gl-suchgruppe">
              <label className="pi-suche">
                <span className="gl-nur-leser">Aufträge durchsuchen</span>
                <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Firma, Ort, Referenz, Paket …" />
              </label>
              <button type="button" className="pi-knopf still klein" disabled={laedtNeu} onClick={() => void laden()}>{laedtNeu ? "Lädt …" : "Aktualisieren"}</button>
            </div>
          </div>

          <section className="gl-glas gl-tafel" aria-label="Aufträge">
            {sichtbar.length === 0 ? (
              <div className="gl-still" role="status">
                <b>{zeilen.length === 0 ? "Noch kein Global-Auftrag bei dir." : "In dieser Ansicht liegt gerade nichts."}</b>
                <p>{zeilen.length === 0
                  ? "Der erste erscheint hier, sobald ein Unternehmen auf fiaon.com/business/start unterschrieben hat. Du bekommst dazu eine Aufgabe mit Mail."
                  : "Wechsle den Filter oder leere das Suchfeld."}</p>
                {zeilen.length > 0 && <button type="button" className="pi-knopf still klein" onClick={() => { setFilter("alle"); setSuche(""); }}>Alle zeigen</button>}
              </div>
            ) : (
              <>
                <div className="gl-spalten-kopf" aria-hidden="true">
                  <span>Firma</span><span>Paket</span><span>Stand · Etappe</span><span>Stichtag</span><span>Nächster Schritt</span><span>Unterlagen</span><span>Nächste Frist</span><span>Alter</span>
                </div>
                <ul className="gl-liste">
                  {sichtbar.map((z) => {
                    const [standText, ton] = STATUS_TEXT[z.status];
                    const lage = fristLage(z.naechsteFrist?.faelligAm ?? null, heute);
                    const stichtagLage = z.status === "gestartet" || z.status === "bezahlt" ? fristLage(z.stichtag, heute) : { text: "", ton: "still" as const };
                    return (
                      <li key={z.ref}>
                        <Link href={`/agent/global/${encodeURIComponent(z.ref)}`} className={`gl-zeile${z.status === "bezahlt" ? " vorn" : ""}`}>
                          <span className="gl-zelle">
                            <b>{z.firma}</b>
                            <small>{[z.ort, z.land].filter(Boolean).join(" · ") || "—"}{z.zustaendig ? ` · ${z.zustaendig.name}` : ""}</small>
                          </span>
                          <span className="gl-zelle" data-titel="Paket">
                            <span className="gl-nur-leser">Paket: </span>
                            {/* „FIAON " steht schon über der Seite — in der schmalen Spalte zählt der Paketname. */}
                            <span className="hell" title={z.paketName}>{z.paketName.replace(/^FIAON\s+/i, "")}</span>
                            <small>{euroText(z.betragCents)} einmalig</small>
                          </span>
                          <span className="gl-zelle" data-titel="Stand · Etappe">
                            <span className="gl-nur-leser">Stand: </span>
                            <span className={`pi-marke ${ton}`} title={standText}>{STATUS_KURZ[z.status]}</span>
                            <EtappenPunkte etappe={z.etappe} />
                          </span>
                          <span className="gl-zelle" data-titel="Stichtag">
                            <span className="gl-nur-leser">Stichtag: </span>
                            <span className="hell">{z.stichtag ? tagText(z.stichtag) : z.status === "gestartet" ? "fehlt" : "—"}</span>
                            {stichtagLage.text && <small className={stichtagLage.ton === "still" ? "" : stichtagLage.ton}>{stichtagLage.text}</small>}
                          </span>
                          <span className="gl-zelle" data-titel="Nächster Schritt">
                            <span className="gl-nur-leser">Nächster Schritt: </span>
                            <span className="zwei">{z.naechsterSchritt?.text || "— keiner eingetragen"}</span>
                            {z.naechsterSchritt?.bis && <small>bis {tagText(z.naechsterSchritt.bis)}</small>}
                          </span>
                          <span className="gl-zelle" data-titel="Unterlagen">
                            <span className="gl-nur-leser">Offene Unterlagen: </span>
                            <span className={z.offeneUnterlagen ? "warn" : "gut"}>{z.offeneUnterlagen ? `${z.offeneUnterlagen} fehlen` : "vollständig"}</span>
                          </span>
                          <span className="gl-zelle" data-titel="Nächste Frist">
                            <span className="gl-nur-leser">Nächste Frist: </span>
                            {z.naechsteFrist
                              ? <><span className="hell">{z.naechsteFrist.titel}</span><small className={`umbruch${lage.ton === "still" ? "" : ` ${lage.ton}`}`}>{tagText(z.naechsteFrist.faelligAm)}{lage.text ? ` · ${lage.text}` : ""}</small></>
                              : <span>—</span>}
                          </span>
                          <span className="gl-zelle" data-titel="Alter">
                            <span className="gl-nur-leser">Alter: </span>
                            <span>{z.alterTage === 0 ? "heute" : z.alterTage === 1 ? "1 Tag" : `${z.alterTage} Tage`}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </>
      )}

      {/* Das Tutorial — erklärt den Raum beim ersten Besuch, danach über das ?-Symbol. */}
      <Rundgang raum="global" titel={RUNDGAENGE.global.titel} schritte={RUNDGAENGE.global.schritte} />
    </div>
  );
}
