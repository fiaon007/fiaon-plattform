// ═══════════════════════════════════════════════════════════════════════════
// DIE POSTMEISTER-ZENTRALE, FASSUNG 2 — Justins Kommandoraum (02.09.2026)
//
// Fassung 1 war Justin zu brav („das ist ja ein Witz — ich sagte cinematisch,
// erinnere dich an das Video"). Fassung 2 ändert zwei Dinge grundlegend:
//
// 1. DIE ENTITÄT: Das Geheimnis der Referenz sind LEUCHTSPUREN — die Bühne
//    wird nie ganz gelöscht, jedes Bild legt sich mit 12 % Deckung über das
//    vorige. Aus Punkten werden Fäden, aus Fäden ein atmender Wirbel um eine
//    S-förmige Wirbelsäule, mit Funken, Kern-Puls und Maus-Parallaxe.
//
// 2. VOLLE HANDLUNGSFÄHIGKEIT: Die Entwurfs-Werkbank zeigt jeden wartenden
//    Antwortentwurf im Wortlaut — ÄNDERN, SENDEN, VERWERFEN, und der eine
//    große Knopf „Alle senden" (mit zweitem Klick als Rückfrage). Dazu
//    Not-Aus, Modus je Postfach, Takt von Hand, Strom aller Handgriffe.
//
// prefers-reduced-motion: Entität als stilles Bild, keine Übergänge.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/chef-postmeister.css";

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

const KATEGORIE_TEXT: Record<string, string> = {
  zahlung: "Zahlung", zugang_login: "Zugang & Login", termin: "Termin",
  unterlagen: "Unterlagen", status_frage: "Statusfrage", neuinteresse: "Neuinteresse",
  vertrieb_komplex: "Vertrieb (komplex)", kuendigung: "Kündigung", beschwerde: "Beschwerde",
  rechtlich: "Rechtliches", abmeldung: "Abmeldung (Stopp)", werbung_newsletter: "Werbung", intern: "Intern", sonstiges: "Sonstiges",
};
const AKTION_TEXT: Record<string, [string, string]> = {
  auto_beantwortet: ["automatisch beantwortet", "gut"],
  gesendet: ["von dir freigegeben", "gut"],
  sendet: ["wird gerade gesendet", "warte"],
  entwurf: ["Entwurf wartet", "warte"],
  geordnet: ["geordnet", "still"],
  vorgeordnet: ["vorgeordnet (Vorschau)", "still"],
  verworfen: ["verworfen", "still"],
  fehler: ["Fehler", "rot"],
  schon_verarbeitet: ["übersprungen — schon verarbeitet", "still"],
};

// ═══ DIE ENTITÄT ════════════════════════════════════════════════════════════
function Entitaet({ puls }: { puls: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pulsRef = useRef(puls);
  pulsRef.current = puls;

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let breit = 0, hoch = 0, dpr = 1, raf = 0;
    const messen = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      breit = canvas.clientWidth; hoch = canvas.clientHeight;
      canvas.width = breit * dpr; canvas.height = hoch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05091a"; ctx.fillRect(0, 0, breit, hoch);
    };
    messen();
    const beiGroesse = () => { messen(); if (ruhig) for (let i = 0; i < 90; i++) bild(); };
    window.addEventListener("resize", beiGroesse);

    // 3200 Teilchen auf Bahnen um die Wirbelsäule; ein kleiner Teil sind
    // „Funken" — heller, schneller, mit eigenem Ausreißer-Radius.
    const N = 3200;
    const P = Array.from({ length: N }, (_, i) => {
      const funke = Math.random() > 0.965;
      return {
        u: (i / N + Math.random() * 0.002) % 1,
        winkel: Math.random() * Math.PI * 2,
        tempo: (funke ? 1.6 : 0.35) + Math.random() * (funke ? 1.4 : 0.85),
        bahn: 0.55 + Math.random() * (funke ? 1.4 : 0.5),
        groesse: funke ? 1.6 + Math.random() * 1.4 : 0.5 + Math.random() * 1.1,
        hell: funke ? 1 : 0.3 + Math.random() * 0.6,
        funke,
      };
    });

    let t = ruhig ? 24.7 : 0;
    let mausX = 0.5, mausY = 0.5;
    const maus = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mausX = (e.clientX - r.left) / Math.max(1, r.width);
      mausY = (e.clientY - r.top) / Math.max(1, r.height);
    };
    window.addEventListener("mousemove", maus);

    const bild = () => {
      const kraft = 1 + Math.min(1.4, pulsRef.current * 0.08);
      t += 0.0075 * kraft;

      // DAS GEHEIMNIS: nicht löschen, sondern mit dünner Nacht übermalen —
      // so entstehen die Leuchtspuren der Referenz.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(5,9,26,0.10)";
      ctx.fillRect(0, 0, breit, hoch);

      const cx = breit * (breit > 700 ? 0.68 : 0.5) + (mausX - 0.5) * 26;
      const cyOff = (mausY - 0.5) * 14;
      const atmung = 1 + Math.sin(t * 1.5) * 0.05;

      // Kernlicht am Fußpunkt — wie die leuchtende Quelle im Video.
      ctx.globalCompositeOperation = "lighter";
      const kern = ctx.createRadialGradient(cx, hoch * 0.84 + cyOff, 2, cx, hoch * 0.84 + cyOff, 90 * atmung);
      kern.addColorStop(0, "rgba(150,200,255,0.20)");
      kern.addColorStop(0.4, "rgba(40,141,250,0.08)");
      kern.addColorStop(1, "rgba(40,141,250,0)");
      ctx.fillStyle = kern; ctx.fillRect(cx - 240, hoch * 0.62, 480, hoch * 0.4);

      for (const p of P) {
        const u = p.u;
        // Wirbelsäule: unten Sockel, Mitte Schulter, oben schmaler Kopf —
        // dazu zwei überlagerte Schwünge, die die Gestalt langsam wiegen.
        const y = hoch * (0.9 - u * 0.78) + cyOff * (1 - u);
        const schwung = Math.sin(u * 4.6 + t * 0.8) * breit * 0.05 * (1 - u * 0.35)
          + Math.sin(u * 9.5 - t * 0.5) * breit * 0.016;
        const silhouette =
          (0.13 + Math.sin(u * Math.PI) * 0.27 + Math.sin(u * Math.PI * 2.2 + 0.6) * 0.07)
          * (u > 0.9 ? Math.max(0.12, 1 - (u - 0.9) * 7) : 1);
        const radius = Math.max(3, breit * silhouette * 0.38 * p.bahn * atmung);
        const w = p.winkel + t * p.tempo * (0.65 + u * 1.1);
        const x = cx + schwung + Math.cos(w) * radius;
        const tiefe = (Math.sin(w) + 1) / 2;
        const yy = y + Math.sin(w) * radius * 0.16;
        const alpha = (p.funke ? 0.35 + tiefe * 0.6 : 0.05 + tiefe * 0.26) * p.hell;
        const farbe = p.funke ? "220,238,255" : tiefe > 0.62 ? "126,180,255" : "44,104,214";
        ctx.fillStyle = `rgba(${farbe},${alpha.toFixed(3)})`;
        const g = p.groesse * (0.7 + tiefe * 0.9);
        ctx.fillRect(x, yy, g, g);
      }

      if (!ruhig) raf = requestAnimationFrame(bild);
    };
    if (ruhig) { for (let i = 0; i < 90; i++) bild(); } else { bild(); }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", maus);
      window.removeEventListener("resize", beiGroesse);
    };
  }, []);

  return <canvas ref={ref} className="pm-entitaet" aria-hidden="true" />;
}

// ═══ DIE ZENTRALE ═══════════════════════════════════════════════════════════
export default function ChefPostmeister() {
  const [lage, setLage] = useState<any | null>(null);
  const [status, setStatus] = useState<any | null>(null);
  const [entwuerfe, setEntwuerfe] = useState<any[]>([]);
  const [offenEntwurf, setOffenEntwurf] = useState<number | null>(null);
  const [entwurfText, setEntwurfText] = useState("");
  const [offenStrom, setOffenStrom] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [alleFrage, setAlleFrage] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback((leise = false) => {
    // Bewusst OHNE Promise.all: Die Verbindungs-Sonden fragen vier Postfächer
    // bei Google an und brauchen Sekunden — Zahlen und Entwürfe sollen sofort
    // stehen, sonst zeigt die Bühne beim Betreten Nullen.
    void api("/admin/postmeister/lage").then((l) => { if (l.ok) setLage(l.json); });
    void api("/admin/postmeister/entwuerfe").then((e) => { if (e.ok) setEntwuerfe(e.json.entwuerfe || []); });
    if (!leise) void api("/admin/postmeister/status").then((s) => { if (s.ok) setStatus(s.json); });
  }, []);
  useEffect(() => {
    void laden();
    const takt = setInterval(() => void laden(true), 25_000);
    return () => clearInterval(takt);
  }, [laden]);

  const sag = (text: string) => { setMeldung(text); setTimeout(() => setMeldung(null), 6000); };

  const schalten = async (schluessel: string, wert: string) => {
    setLaeuft(schluessel);
    const r = await api("/admin/postmeister/einstellung", { method: "POST", body: JSON.stringify({ schluessel, wert }) });
    setLaeuft(null);
    sag(r.ok ? `Geschaltet: ${schluessel.replace("postmeister_", "").replace("modus_", "")} → ${wert}` : (r.json?.error || "Konnte nicht schalten."));
    void laden(true);
  };
  const takt = async (nurOrdnen: boolean) => {
    setLaeuft("takt");
    const r = await api("/admin/postmeister/lauf", { method: "POST", body: JSON.stringify({ nurOrdnen }) });
    setLaeuft(null);
    sag(r.ok ? `Takt fertig — ${r.json.verarbeitet} Mails (${Object.entries(r.json.aktionen || {}).map(([k, v]) => `${AKTION_TEXT[k]?.[0] || k}: ${v}`).join(" · ") || "nichts Neues"})` : (r.json?.error || "Takt fehlgeschlagen."));
    void laden(true);
  };
  const entwurfSenden = async (id: number) => {
    setLaeuft(`senden-${id}`);
    const r = await api(`/admin/postmeister/entwurf/${id}/senden`, { method: "POST", body: JSON.stringify({ text: entwurfText }) });
    setLaeuft(null);
    if (r.ok) { setOffenEntwurf(null); sag("Gesendet — der Kunde hat die Antwort im Postfach."); }
    else sag(r.json?.error || "Senden fehlgeschlagen.");
    void laden(true);
  };
  const entwurfWeg = async (id: number) => {
    setLaeuft(`weg-${id}`);
    const r = await api(`/admin/postmeister/entwurf/${id}/verwerfen`, { method: "POST", body: "{}" });
    setLaeuft(null);
    if (r.ok) { setOffenEntwurf(null); sag("Verworfen — auch der Gmail-Entwurf ist weg."); }
    else sag(r.json?.error || "Verwerfen fehlgeschlagen.");
    void laden(true);
  };
  const alleSenden = async () => {
    if (!alleFrage) { setAlleFrage(true); setTimeout(() => setAlleFrage(false), 5000); return; }
    setAlleFrage(false); setLaeuft("alle");
    const r = await api("/admin/postmeister/entwuerfe/alle-senden", { method: "POST", body: JSON.stringify({ deckel: Math.min(60, entwuerfe.length) }) });
    setLaeuft(null);
    sag(r.ok ? `${r.json.gesendet} Antworten gesendet${r.json.fehler ? `, ${r.json.fehler} Fehler` : ""}${Number(r.json.uebrig) > 0 ? ` — ${r.json.uebrig} warten noch` : ""}.` : (r.json?.error || "Fehlgeschlagen."));
    void laden(true);
  };

  const z = lage?.zahlen || {};
  const an = lage?.an !== false;

  return (
    <div className="pm">
      {/* ═══ DIE BÜHNE ═══ */}
      <section className="pm-buehne">
        <Entitaet puls={Number(z.heute || 0)} />
        <div className="pm-buehne-schleier" aria-hidden="true" />
        <div className="pm-buehne-text">
          <span className={`pm-pille${an ? "" : " rot"}`}>
            <i className="pm-puls" />{an ? "wacht über die Postfächer" : "angehalten — Not-Aus aktiv"}
          </span>
          <h1>Der Postmeister.</h1>
          <p>Er liest jede Mail, kennt vorher die komplette Akte des Absenders, antwortet wie ein Mensch — und plant Rückrufe und Aufgaben gleich mit. Alles, was er tut, steht hier. Alles, was wartet, entscheidest du.</p>
          <div className="pm-buehne-zahlen">
            <div className="pm-zahl"><b>{z.heute ?? "0"}</b><span>Mails · 24 h</span></div>
            <div className="pm-zahl"><b>{(Number(z.heute_auto) || 0) + (Number(z.von_hand) || 0)}</b><span>beantwortet</span></div>
            <div className="pm-zahl warte"><b>{entwuerfe.length}</b><span>warten auf dich</span></div>
            <div className="pm-zahl"><b>{z.mit_akte ?? "0"}</b><span>mit Kundenakte</span></div>
          </div>
        </div>
      </section>

      {meldung && <p className="pm-meldung" onClick={() => setMeldung(null)}>{meldung}</p>}

      {/* ═══ DIE ENTWURFS-WERKBANK — hier entscheidest du ═══ */}
      <section className="pm-tafel breit werkbank">
        <header>
          <b>Wartet auf dein Wort <em>{entwuerfe.length}</em></b>
          {entwuerfe.length > 0 && (
            <button type="button" className={`pm-knopf${alleFrage ? " frage" : ""}`} disabled={laeuft === "alle"}
                    onClick={() => void alleSenden()}>
              {laeuft === "alle" ? "Sende …" : alleFrage ? `Wirklich alle ${entwuerfe.length} senden?` : `Alle ${entwuerfe.length} mit einem Klick senden`}
            </button>
          )}
        </header>
        {entwuerfe.length === 0 && <p className="pm-leise" style={{ padding: "4px 2px 8px" }}>Kein Entwurf wartet — der Postmeister hat freie Bahn oder gerade nichts Heikles auf dem Tisch.</p>}
        <ul className="pm-entwuerfe">
          {entwuerfe.map((e) => (
            <li key={e.id} className={offenEntwurf === e.id ? "auf" : ""}>
              <button type="button" className="pm-entwurf-kopf"
                      onClick={() => {
                        // Abnahme-Fund: redigierter Text darf beim Zuklappen
                        // nicht verloren gehen — nur beim Öffnen eines ANDEREN
                        // Entwurfs wird frisch geladen.
                        if (offenEntwurf === e.id) { setOffenEntwurf(null); return; }
                        setOffenEntwurf(e.id); setEntwurfText(String(e.antwort || ""));
                      }}>
                {e.dringend && <span className="pm-marke rot">dringend</span>}
                <span className="pm-marke warte">{KATEGORIE_TEXT[e.kategorie] || e.kategorie}</span>
                <span className="pm-entwurf-wer">
                  <b>{e.betreff || "(ohne Betreff)"}</b>
                  <small>{e.von} → {e.postfach}{e.ref ? " · Akte verknüpft" : ""}</small>
                </span>
                <time>{new Date(e.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
              </button>
              {offenEntwurf === e.id && (
                <div className="pm-werk">
                  <textarea value={entwurfText} onChange={(ev) => setEntwurfText(ev.target.value)}
                            rows={Math.min(16, Math.max(6, entwurfText.split("\n").length + 1))} spellCheck={false} />
                  <div className="pm-werk-knoepfe">
                    <button type="button" className="pm-knopf" disabled={laeuft === `senden-${e.id}`}
                            onClick={() => void entwurfSenden(e.id)}>
                      {laeuft === `senden-${e.id}` ? "Sende …" : "So senden"}
                    </button>
                    <button type="button" className="pm-knopf still" disabled={laeuft === `weg-${e.id}`}
                            onClick={() => void entwurfWeg(e.id)}>
                      {laeuft === `weg-${e.id}` ? "…" : "Verwerfen"}
                    </button>
                    <span className="pm-leise">Dein Text gewinnt — was hier steht, geht raus. Grußformel ist schon drin.</span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="pm-raster">
        {/* ═══ EINGREIFEN ═══ */}
        <section className="pm-tafel">
          <header>
            <b>Eingreifen</b>
            <button type="button" disabled={laeuft === "postmeister_an"}
                    className={`pm-notaus${an ? "" : " aus"}`}
                    onClick={() => void schalten("postmeister_an", an ? "aus" : "an")}>
              {an ? "Not-Aus — alles anhalten" : "Wieder einschalten"}
            </button>
          </header>
          <div className="pm-schalter">
            {(lage?.postfaecher || []).map((p: any) => {
              const kurz = String(p.adresse).split("@")[0];
              return (
                <div key={p.adresse} className="pm-schalter-zeile">
                  <span className="pm-schalter-wer"><b>{p.adresse}</b><small>Vorgabe: {p.vorgabe}</small></span>
                  <span className="pm-schalter-wahl">
                    {["auto", "hybrid", "entwurf", "aus"].map((m) => (
                      <button key={m} type="button" className={p.modus === m ? "an" : ""}
                              disabled={laeuft === `postmeister_modus_${kurz}`}
                              onClick={() => void schalten(`postmeister_modus_${kurz}`, m)}>
                        {m === "auto" ? "Automatisch" : m === "hybrid" ? "Hybrid" : m === "entwurf" ? "Nur Entwürfe" : "Aus"}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <footer className="pm-tafel-fuss">
            <button type="button" className="pm-knopf" disabled={laeuft === "takt" || !an}
                    onClick={() => void takt(false)}>{laeuft === "takt" ? "Läuft …" : "Jetzt einen Takt laufen lassen"}</button>
            <button type="button" className="pm-knopf still" disabled={laeuft === "takt" || !an}
                    onClick={() => void takt(true)}>Nur ordnen (ohne Antworten)</button>
          </footer>
        </section>

        {/* ═══ VERBINDUNG & THEMEN ═══ */}
        <section className="pm-tafel">
          <header><b>Verbindung & Themen</b></header>
          <ul className="pm-postfaecher">
            {(status?.postfaecher || []).map((p: any) => (
              <li key={p.adresse}>
                <i className={p.ok ? "gut" : "rot"} />
                <b>{p.adresse}</b>
                <span>{p.ok ? `verbunden · ${p.labels} Labels` : (p.fehler || "keine Verbindung")}</span>
              </li>
            ))}
          </ul>
          <div className="pm-kategorien">
            {(lage?.kategorien || []).map((k: any) => (
              <span key={k.kategorie} className="pm-chip">{KATEGORIE_TEXT[k.kategorie] || k.kategorie} <b>{k.n}</b></span>
            ))}
            {!(lage?.kategorien || []).length && <span className="pm-leise">Noch keine eingeordnete Mail.</span>}
          </div>
        </section>
      </div>

      {/* ═══ DER STROM ═══ */}
      <section className="pm-tafel breit">
        <header><b>Die letzten Handgriffe</b><small>{z.gesamt ?? 0} Mails insgesamt · {z.auto ?? 0} automatisch beantwortet</small></header>
        <ul className="pm-strom">
          {(lage?.strom || []).map((m: any) => {
            const [text, ton] = AKTION_TEXT[m.aktion] || [m.aktion, "still"];
            return (
              <li key={m.id} className={offenStrom === m.id ? "auf" : ""}>
                <button type="button" className="pm-strom-kopf" onClick={() => setOffenStrom(offenStrom === m.id ? null : m.id)}>
                  <span className={`pm-marke ${ton}`}>{text}</span>
                  <span className="pm-strom-wer">
                    <b>{m.betreff || "(ohne Betreff)"}</b>
                    <small>{m.von} → {m.postfach} · {KATEGORIE_TEXT[m.kategorie] || m.kategorie || "…"}{m.dringend ? " · DRINGEND" : ""}{m.ref ? " · Akte verknüpft" : ""}</small>
                  </span>
                  <time>{new Date(m.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                </button>
                {offenStrom === m.id && (
                  <div className="pm-strom-detail">
                    {m.antwort ? <pre>{m.antwort}</pre> : <p className="pm-leise">{m.begruendung || "Keine Antwort erzeugt — nur geordnet."}</p>}
                  </div>
                )}
              </li>
            );
          })}
          {!(lage?.strom || []).length && <li className="pm-leise" style={{ padding: 14 }}>Noch keine Bewegung — der erste Takt kommt.</li>}
        </ul>
      </section>
    </div>
  );
}
