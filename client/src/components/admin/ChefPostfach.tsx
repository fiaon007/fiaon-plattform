// ═══════════════════════════════════════════════════════════════════════════
// DAS POSTFACH (02.09.2026, E-094)
//
// Justins Vorgabe: „VIEL cleaner, weg mit dem 3D-Video […] ich will auch immer
// sehen was der Kunde geschrieben hat — es muss aussehen wie ein E-Mail-
// Postfach, was eben voll automatisch von unseren Mitarbeitern betreut wird.
// […] Immer als Entwurf speichern, dass ich kurz drüber schauen kann und dann
// markieren kann, oder alle direkt versende."
//
// Drei Spalten: Ordner, Liste, Nachricht. Rechts steht IMMER zuerst, was der
// Kunde geschrieben hat — darunter der Verlauf, die Akte, die ausgeführten
// Handlungen und zuletzt die Antwort zum Prüfen. Kein Partikelfeld, keine
// Bühne, keine Animation außer einem sanften Übergang.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/chef-postfach.css";

type Ordner = "offen" | "gesendet" | "geordnet" | "kein_kunde" | "alle";

const ORDNER: { key: Ordner; name: string; zaehler: string }[] = [
  { key: "offen", name: "Zu prüfen", zaehler: "offen" },
  { key: "gesendet", name: "Gesendet", zaehler: "gesendet" },
  { key: "geordnet", name: "Eingeordnet", zaehler: "geordnet" },
  { key: "kein_kunde", name: "Kein Kunde", zaehler: "kein_kunde" },
  { key: "alle", name: "Alle", zaehler: "" },
];

const LAGE_TEXT: Record<string, string> = {
  interessent: "Interessent", unbezahlt: "nicht bezahlt", zahlung_gemeldet: "Zahlung gemeldet",
  bezahlt_ohne_startgespraech: "wartet auf Startgespräch", aktiv: "aktiv",
  rate_ueberfaellig: "Rate überfällig", gekuendigt: "gekündigt", bestreitet: "bestreitet",
  gesperrt: "gesperrt", fremd: "kein Kunde", unklar: "unklar",
};

async function hole(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, { credentials: "include", ...init });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Fehler ${res.status}`);
  return j;
}

function zeit(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const heute = new Date();
  const gleich = d.toDateString() === heute.toDateString();
  return gleich
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function ChefPostfach() {
  const [ordner, setOrdner] = useState<Ordner>("offen");
  const [postfach, setPostfach] = useState("");
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<any[]>([]);
  const [zaehler, setZaehler] = useState<Record<string, number>>({});
  const [kopf, setKopf] = useState<any>(null);
  const [offenId, setOffenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [entwurf, setEntwurf] = useState("");
  const [markiert, setMarkiert] = useState<number[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "warn"; text: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const textFeld = useRef<HTMLTextAreaElement>(null);

  const laden = useCallback(async (leise = false) => {
    try {
      const p = new URLSearchParams({ ordner, ...(postfach ? { postfach } : {}), ...(suche ? { suche } : {}) });
      const [l, k] = await Promise.all([
        hole(`/admin/postmeister/postfach?${p}`),
        hole("/admin/postmeister/kopf").catch(() => null),
      ]);
      setListe(l.zeilen ?? []);
      setZaehler(l.zaehler ?? {});
      if (k) setKopf(k);
      setFehler(null);
    } catch (e: any) {
      if (!leise) setFehler(String(e?.message || e));
    }
  }, [ordner, postfach, suche]);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    const t = setInterval(() => void laden(true), 30_000);
    return () => clearInterval(t);
  }, [laden]);

  const oeffnen = useCallback(async (id: number) => {
    setOffenId(id); setDetail(null);
    try {
      const d = await hole(`/admin/postmeister/eintrag/${id}`);
      setDetail(d);
      setEntwurf(String(d.eintrag?.antwort ?? ""));
    } catch (e: any) { setFehler(String(e?.message || e)); }
  }, []);

  const senden = useCallback(async (id: number, text?: string) => {
    setLaeuft(`senden-${id}`);
    try {
      const r = await fetch(`/api/fiaon/admin/postmeister/eintrag/${id}/senden`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text ?? null }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) { setMeldung({ art: "gut", text: "Antwort ist raus." }); setOffenId(null); setDetail(null); await laden(); }
      else setMeldung({ art: "warn", text: j?.grund || "Konnte nicht gesendet werden." });
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [laden]);

  const verwerfen = useCallback(async (id: number) => {
    setLaeuft(`verwerfen-${id}`);
    try {
      await hole(`/admin/postmeister/eintrag/${id}/verwerfen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: "in der Zentrale verworfen" }),
      });
      setMeldung({ art: "gut", text: "Entwurf verworfen." });
      setOffenId(null); setDetail(null); await laden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [laden]);

  const markierteSenden = useCallback(async () => {
    if (!markiert.length) return;
    setLaeuft("mehrere");
    try {
      const j = await hole("/admin/postmeister/senden-mehrere", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: markiert }),
      });
      setMeldung({
        art: j.fehler?.length ? "warn" : "gut",
        text: `${j.gesendet} gesendet${j.fehler?.length ? `, ${j.fehler.length} zurückgehalten` : ""}.`,
      });
      setMarkiert([]); await laden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [markiert, laden]);

  // Tastatur: j/k blättern, ⌘↵ senden, Esc schließen.
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      const imFeld = (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && offenId) { e.preventDefault(); void senden(offenId, entwurf); return; }
      if (imFeld) return;
      if (e.key === "Escape") { setOffenId(null); setDetail(null); return; }
      if (e.key === "j" || e.key === "k") {
        const i = liste.findIndex((z) => z.id === offenId);
        const n = e.key === "j" ? Math.min(liste.length - 1, i + 1) : Math.max(0, i - 1);
        if (liste[n]) void oeffnen(liste[n].id);
      }
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [liste, offenId, entwurf, senden, oeffnen]);

  useEffect(() => { if (meldung) { const t = setTimeout(() => setMeldung(null), 6000); return () => clearTimeout(t); } }, [meldung]);

  const postfaecher = useMemo(() => (kopf?.jePostfach ?? []).map((p: any) => p.postfach), [kopf]);

  return (
    <div>
      <div className="pf-kopf">
        <h1>Postfach</h1>
        <div className="pf-zahl"><b>{kopf?.zahlen?.entwuerfe ?? zaehler.offen ?? 0}</b><span>warten auf dich</span></div>
        <div className="pf-zahl"><b>{kopf?.zahlen?.dringend ?? 0}</b><span>davon dringend</span></div>
        <div className="pf-zahl"><b>{kopf?.zahlen?.heute_gesendet ?? 0}</b><span>heute beantwortet</span></div>
        <div className="pf-zahl"><b>{kopf?.kostenHeuteEuro?.toFixed?.(2) ?? "0.00"} €</b><span>Modellkosten heute</span></div>
        <div className="pf-rechts">
          {markiert.length > 0 && (
            <button className="pf-knopf" onClick={markierteSenden} disabled={laeuft === "mehrere"}>
              {laeuft === "mehrere" ? "Sendet …" : `${markiert.length} markierte senden`}
            </button>
          )}
          <button className="pf-knopf leise" onClick={() => void laden()}>Aktualisieren</button>
        </div>
      </div>

      {fehler && <div className="pf-warnung" style={{ marginBottom: 10 }}>Verbindung gestört: {fehler}</div>}
      {meldung && (
        <div className="pf-warnung" style={{ marginBottom: 10, borderColor: meldung.art === "gut" ? "#4ade80" : undefined, color: meldung.art === "gut" ? "#4ade80" : undefined }}>
          {meldung.text}
        </div>
      )}

      <div className="pf">
        {/* Ordner */}
        <nav className="pf-ordner" aria-label="Ordner">
          <div className="pf-titel">Ordner</div>
          {ORDNER.map((o) => (
            <button key={o.key} aria-current={ordner === o.key} onClick={() => { setOrdner(o.key); setOffenId(null); setDetail(null); }}>
              {o.name}
              {o.zaehler ? <span className="n">{zaehler[o.zaehler] ?? 0}</span> : null}
            </button>
          ))}
          <div className="pf-trenn" />
          <div className="pf-titel">Postfach</div>
          <button aria-current={postfach === ""} onClick={() => setPostfach("")}>Alle</button>
          {postfaecher.map((p: string) => (
            <button key={p} aria-current={postfach === p} onClick={() => setPostfach(p)}>
              {p.split("@")[0]}
              <span className="n">{kopf?.jePostfach?.find((x: any) => x.postfach === p)?.offen ?? 0}</span>
            </button>
          ))}
        </nav>

        {/* Liste */}
        <div className="pf-liste">
          <div className="pf-suche">
            <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen: Name, Betreff, Referenz" aria-label="Suchen" />
          </div>
          <div className="pf-rollen">
            {liste.length === 0 && <div className="pf-leer">Nichts in diesem Ordner.</div>}
            {liste.map((z) => (
              <button key={z.id} className="pf-zeile" aria-current={offenId === z.id} onClick={() => void oeffnen(z.id)}>
                {ordner === "offen" && (
                  <input
                    className="pf-auswahl" type="checkbox" checked={markiert.includes(z.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setMarkiert((m) => (e.target.checked ? [...m, z.id] : m.filter((x) => x !== z.id)))}
                    aria-label="Für Sammelversand markieren"
                  />
                )}
                <div className="z1">
                  <span className="name">{z.kundeName || z.vonName}</span>
                  <span className="zeit">{zeit(z.empfangenAm)}</span>
                </div>
                <div className="betreff">{z.betreff || "(kein Betreff)"}</div>
                <div className="vorschau">{z.zusammenfassung || (z.text ? String(z.text).slice(0, 160) : "")}</div>
                <div className="marken">
                  {z.dringend && <span className="pf-marke warn">dringend</span>}
                  {z.kundenlage && <span className="pf-marke leise">{LAGE_TEXT[z.kundenlage] ?? z.kundenlage}</span>}
                  {Object.entries(z.flags || {}).filter(([, v]) => v).slice(0, 2).map(([k]) => (
                    <span key={k} className="pf-marke rot">{k.replace(/_/g, " ")}</span>
                  ))}
                  {z.aktion === "gesendet" || z.aktion === "auto_beantwortet" ? <span className="pf-marke gruen">beantwortet</span> : null}
                  {z.nachrichtenImThread > 1 && <span className="pf-marke leise">{z.nachrichtenImThread} Nachrichten</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Nachricht */}
        <div className="pf-brief">
          {!offenId && <div className="pf-leer">Wähle links eine Nachricht. Mit j und k blätterst du, mit ⌘ + Enter sendest du.</div>}
          {offenId && !detail && <div className="pf-leer">Lädt …</div>}
          {detail && (
            <>
              <div className="pf-brief-kopf">
                <h2>{detail.eintrag.betreff || "(kein Betreff)"}</h2>
                <div className="meta">
                  {detail.eintrag.von} · an {detail.eintrag.postfach} · {new Date(detail.eintrag.empfangenAm).toLocaleString("de-DE")}
                  {detail.akte?.kundenlage ? ` · ${LAGE_TEXT[detail.akte.kundenlage] ?? detail.akte.kundenlage}` : ""}
                  {detail.akte?.betreuer ? ` · Betreuerin: ${detail.akte.betreuer}` : ""}
                </div>
              </div>

              <div className="pf-inhalt">
                {/* Was der Kunde geschrieben hat — steht immer zuerst. */}
                <section className="pf-block">
                  <h3>Was der Kunde geschrieben hat</h3>
                  <div className="inhalt"><div className="pf-kundentext">{detail.eintrag.text || "(kein Text)"}</div></div>
                </section>

                {detail.verlauf?.length > 1 && (
                  <section className="pf-block">
                    <h3>Verlauf ({detail.verlauf.length} Nachrichten)</h3>
                    <div className="inhalt pf-verlauf">
                      {detail.verlauf.map((v: any) => (
                        <div key={v.id}>
                          <div className="n">
                            <div className="kopf">{v.von} · {new Date(v.am).toLocaleString("de-DE")}</div>
                            <div className="txt">{v.text || "(kein Text)"}</div>
                          </div>
                          {v.antwort && (
                            <div className="n uns" style={{ marginTop: 6 }}>
                              <div className="kopf">FIAON {v.antwortGesendet ? `· gesendet ${new Date(v.antwortGesendet).toLocaleString("de-DE")}` : "· Entwurf"}</div>
                              <div className="txt">{v.antwort}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="pf-block">
                  <h3>Akte</h3>
                  <div className="inhalt pf-akte">
                    <div className="reihe"><span className="k">Kunde</span><span className="v">{detail.akte?.name ?? "nicht zugeordnet"}</span></div>
                    <div className="reihe"><span className="k">Lage</span><span className="v">{LAGE_TEXT[detail.akte?.kundenlage] ?? "—"} — {detail.akte?.lageGrund}</span></div>
                    {(detail.akte?.bestellungen ?? []).slice(0, 2).map((b: any) => (
                      <div className="reihe" key={b.ref}><span className="k">Bestellung</span><span className="v">{b.paket} · {b.status} · {b.betrag ? `${b.betrag} €` : ""} · {b.referenz}</span></div>
                    ))}
                    {(detail.akte?.raten ?? []).filter((r: any) => r.status === "offen").slice(0, 3).map((r: any) => (
                      <div className="reihe" key={r.nr}><span className="k">Rate {r.nr}</span><span className="v">{r.betrag} € · fällig {r.faellig ?? "—"}{r.mahnstufe ? ` · Mahnstufe ${r.mahnstufe}` : ""}</span></div>
                    ))}
                    {(detail.akte?.termine ?? []).slice(0, 2).map((t: any, i: number) => (
                      <div className="reihe" key={i}><span className="k">Termin</span><span className="v">{t.beginn} · {t.status}{t.betreuer ? ` · ${t.betreuer}` : ""}</span></div>
                    ))}
                    {detail.akte?.kuendigung && (
                      <div className="reihe"><span className="k">Kündigung</span><span className="v">{detail.akte.kuendigung.am} · letzte Rate {detail.akte.kuendigung.letzteRate ?? "—"}</span></div>
                    )}
                    {detail.eintrag.ref && (
                      <div className="reihe"><span className="k">Akte öffnen</span>
                        <a className="v" href={`/chef/s/akte?ref=${detail.eintrag.ref}`} style={{ color: "#93c5fd" }}>{detail.eintrag.ref}</a>
                      </div>
                    )}
                  </div>
                </section>

                {detail.eintrag.handlungen?.length > 0 && (
                  <section className="pf-block">
                    <h3>Was der Agent getan hat</h3>
                    <div className="inhalt">
                      {detail.eintrag.handlungen.map((h: any, i: number) => (
                        <div className="pf-handlung" key={i}>
                          <span className="w">{h.ok ? "✓" : "✕"} {h.werkzeug.replace(/_/g, " ")}</span>
                          <span>{h.ergebnis}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Antwort zum Prüfen */}
                {(detail.eintrag.aktion === "entwurf" || detail.eintrag.aktion === "fehler" || detail.eintrag.antwort) && (
                  <section className="pf-block pf-antwort">
                    <h3>Antwort {detail.eintrag.gesendetAm ? "(gesendet)" : "(Entwurf — du entscheidest)"}</h3>
                    <div className="inhalt">
                      {detail.eintrag.pruefung?.treffer?.length > 0 && (
                        <div className="pf-warnung" style={{ marginBottom: 10 }}>
                          {detail.eintrag.pruefung.treffer.map((t: any, i: number) => (
                            <div key={i}>{t.art}: „{t.treffer}" — {t.hinweis}</div>
                          ))}
                        </div>
                      )}
                      {detail.eintrag.pruefung?.fehlend?.length > 0 && (
                        <div className="pf-warnung" style={{ marginBottom: 10 }}>{detail.eintrag.pruefung.fehlend.join(" · ")}</div>
                      )}
                      {detail.eintrag.gesendetAm ? (
                        <div className="pf-kundentext">{detail.eintrag.antwort}</div>
                      ) : (
                        <textarea ref={textFeld} value={entwurf} onChange={(e) => setEntwurf(e.target.value)} aria-label="Antwort bearbeiten" />
                      )}
                      {detail.eintrag.belege?.length > 0 && (
                        <div className="pf-hinweis" style={{ marginTop: 8 }}>
                          Belegt durch: {detail.eintrag.belege.map((b: any) => `${b.werkzeug}.${b.feld}`).join(", ")}
                        </div>
                      )}
                    </div>
                    {!detail.eintrag.gesendetAm && (
                      <div className="pf-tasten">
                        <button className="pf-knopf" disabled={laeuft === `senden-${detail.eintrag.id}`} onClick={() => void senden(detail.eintrag.id, entwurf)}>
                          {laeuft === `senden-${detail.eintrag.id}` ? "Sendet …" : "So senden (⌘↵)"}
                        </button>
                        <button className="pf-knopf leise" disabled={!!laeuft} onClick={() => void verwerfen(detail.eintrag.id)}>Verwerfen</button>
                        {detail.eintrag.ref && (
                          <a className="pf-knopf leise" href={`/chef/s/akte?ref=${detail.eintrag.ref}`} style={{ textDecoration: "none" }}>Akte öffnen</a>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {detail.eintrag.begruendung && (
                  <div className="pf-hinweis">Einordnung: {detail.eintrag.begruendung}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
