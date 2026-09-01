// ═══════════════════════════════════════════════════════════════════════════
// DIE POSTMEISTER-ZENTRALE — Justins Kommandoraum (01.09.2026)
//
// Justins Auftrag wörtlich: „setze es mir wirklich im Cinematischen um …
// das soll nur meine Zentrale sein!" — Referenz war eine lebende
// Partikel-Entität auf dunkler Bühne (blauer Schwarm vor Navy).
//
// Die Bühne: Ein Canvas mit ~2.400 Partikeln, die eine atmende, wirbelnde
// Gestalt formen — die Verkörperung des Agenten. Sie reagiert auf die Lage:
// ruhiges Atmen im Leerlauf, schnelleres Kreisen, wenn in den letzten
// 24 Stunden gearbeitet wurde. Darunter Navy-Glas-Tafeln mit den Zahlen,
// den Eingriffs-Schaltern (Not-Aus, Modus je Postfach) und dem Strom der
// letzten Handgriffe — jede Antwort aufklappbar im Wortlaut.
//
// prefers-reduced-motion: die Entität steht als stilles Standbild.
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
  rechtlich: "Rechtliches", werbung_newsletter: "Werbung", intern: "Intern", sonstiges: "Sonstiges",
};
const AKTION_TEXT: Record<string, [string, string]> = {
  auto_beantwortet: ["beantwortet", "gut"],
  entwurf: ["Entwurf wartet", "warte"],
  geordnet: ["geordnet", "still"],
  fehler: ["Fehler", "rot"],
};

// ── Die Entität — Partikelschwarm auf Canvas ────────────────────────────────
function Entitaet({ puls }: { puls: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pulsRef = useRef(puls);
  pulsRef.current = puls;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let breit = 0; let hoch = 0; let dpr = 1;
    const messen = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      breit = canvas.clientWidth; hoch = canvas.clientHeight;
      canvas.width = breit * dpr; canvas.height = hoch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    messen();

    // Jede Partikel lebt auf einer Bahn um eine geschwungene Wirbelsäule —
    // zusammen ergibt das die stehende, atmende Gestalt aus der Referenz.
    const N = 2400;
    const P = Array.from({ length: N }, (_, i) => ({
      u: i / N,                                  // Position entlang der Gestalt (0 unten, 1 oben)
      winkel: Math.random() * Math.PI * 2,
      tempo: 0.2 + Math.random() * 0.9,
      radiusJitter: 0.55 + Math.random() * 0.75,
      groesse: 0.5 + Math.random() * 1.5,
      hell: 0.25 + Math.random() * 0.75,
    }));

    let t = ruhig ? 12.4 : 0;
    let raf = 0;
    let mausX = 0.5;
    const maus = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mausX = (e.clientX - r.left) / Math.max(1, r.width);
    };
    window.addEventListener("mousemove", maus);
    const beiGroesse = () => messen();
    window.addEventListener("resize", beiGroesse);

    const malen = () => {
      const kraft = 1 + Math.min(1.6, pulsRef.current * 0.12); // mehr Arbeit → lebendiger
      t += 0.006 * kraft;
      ctx.clearRect(0, 0, breit, hoch);

      // Auf breiter Bühne steht die Gestalt RECHTS neben dem Text — wie ein
      // Hologramm neben dem Pult; auf schmaler Bühne mittig unter dem Text.
      const cx = breit * (breit > 700 ? 0.68 : 0.5) + (mausX - 0.5) * 18;
      const atmung = 1 + Math.sin(t * 1.7) * 0.045;

      // Bodenlicht — der Schein unter der Gestalt.
      const glow = ctx.createRadialGradient(cx, hoch * 0.86, 4, cx, hoch * 0.86, breit * 0.32);
      glow.addColorStop(0, "rgba(40,141,250,0.28)");
      glow.addColorStop(1, "rgba(40,141,250,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, breit, hoch);

      ctx.globalCompositeOperation = "lighter";
      for (const p of P) {
        const u = p.u;
        // Wirbelsäule: eine sanfte S-Kurve, oben schmaler Kopf, Mitte breite
        // Schulter, unten auslaufender Sockel — die Silhouette der Referenz.
        const y = hoch * (0.92 - u * 0.8);
        const schwung = Math.sin(u * 5.2 + t * 0.9) * breit * 0.045 * (1 - u * 0.4);
        const silhouette =
          (0.16 + Math.sin(u * Math.PI) * 0.30 + Math.sin(u * Math.PI * 2.3 + 0.7) * 0.075)
          * (u > 0.92 ? (1 - (u - 0.92) * 8) : 1);
        const radius = Math.max(4, breit * silhouette * 0.5 * p.radiusJitter * atmung);
        const w = p.winkel + t * p.tempo * (0.7 + u);
        const x = cx + schwung + Math.cos(w) * radius;
        const tiefe = (Math.sin(w) + 1) / 2; // vorn heller, hinten leiser
        const yy = y + Math.sin(w) * radius * 0.14;
        const alpha = (0.06 + tiefe * 0.30) * p.hell;
        // Farbwelt: tiefes Blau → Eisblau, vereinzelt fast weiße Funken.
        const kalt = p.hell > 0.88 ? "235,244,255" : tiefe > 0.6 ? "126,180,255" : "52,110,220";
        ctx.fillStyle = `rgba(${kalt},${alpha.toFixed(3)})`;
        const g = p.groesse * (0.7 + tiefe * 0.8);
        ctx.fillRect(x, yy, g, g);
      }
      ctx.globalCompositeOperation = "source-over";

      if (!ruhig) raf = requestAnimationFrame(malen);
    };
    malen();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", maus);
      window.removeEventListener("resize", beiGroesse);
    };
  }, []);

  return <canvas ref={ref} className="pm-entitaet" aria-hidden="true" />;
}

// ── Die Zentrale ────────────────────────────────────────────────────────────
export default function ChefPostmeister() {
  const [lage, setLage] = useState<any | null>(null);
  const [status, setStatus] = useState<any | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const [l, s] = await Promise.all([api("/admin/postmeister/lage"), api("/admin/postmeister/status")]);
    if (l.ok) setLage(l.json);
    if (s.ok) setStatus(s.json);
  }, []);
  useEffect(() => {
    void laden();
    const takt = setInterval(() => void laden(), 30_000);
    return () => clearInterval(takt);
  }, [laden]);

  const schalten = async (schluessel: string, wert: string) => {
    setLaeuft(schluessel);
    const r = await api("/admin/postmeister/einstellung", { method: "POST", body: JSON.stringify({ schluessel, wert }) });
    setLaeuft(null);
    setMeldung(r.ok ? `Gesetzt: ${schluessel} → ${wert}` : (r.json?.error || "Konnte nicht schalten."));
    void laden();
  };
  const lauf = async (nurOrdnen: boolean) => {
    setLaeuft("lauf");
    const r = await api("/admin/postmeister/lauf", { method: "POST", body: JSON.stringify({ nurOrdnen }) });
    setLaeuft(null);
    setMeldung(r.ok ? `Lauf fertig: ${r.json.verarbeitet} Mails — ${Object.entries(r.json.aktionen || {}).map(([k, v]) => `${k} ${v}`).join(", ") || "nichts Neues"}` : (r.json?.error || "Lauf fehlgeschlagen."));
    void laden();
  };

  const z = lage?.zahlen || {};
  const an = lage?.an !== false;

  return (
    <div className="pm">
      {/* ── Die Bühne mit der Entität ── */}
      <section className="pm-buehne">
        <Entitaet puls={Number(z.heute || 0)} />
        <div className="pm-buehne-text">
          <span className="pm-pille">{an ? "wacht über vier Postfächer" : "angehalten"}</span>
          <h1>Der Postmeister.</h1>
          <p>
            Er liest jede Mail, kennt vorher die komplette Akte des Absenders —
            und antwortet wie ein Mensch. Alles, was er tut, steht hier.
          </p>
          <div className="pm-buehne-zahlen">
            <div><b>{z.heute ?? "–"}</b><span>Mails · 24 h</span></div>
            <div><b>{z.heute_auto ?? "–"}</b><span>davon beantwortet</span></div>
            <div><b>{z.entwuerfe ?? "–"}</b><span>Entwürfe warten</span></div>
            <div><b>{z.mit_akte ?? "–"}</b><span>mit Kundenakte</span></div>
          </div>
        </div>
      </section>

      {meldung && <p className="pm-meldung" onClick={() => setMeldung(null)}>{meldung}</p>}

      <div className="pm-raster">
        {/* ── Eingreifen: Not-Aus + Modus je Postfach ── */}
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
                      <button key={m} type="button"
                              className={p.modus === m ? "an" : ""}
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
            <button type="button" className="pm-knopf" disabled={laeuft === "lauf" || !an}
                    onClick={() => void lauf(false)}>{laeuft === "lauf" ? "Läuft …" : "Jetzt einen Takt laufen lassen"}</button>
            <button type="button" className="pm-knopf still" disabled={laeuft === "lauf"}
                    onClick={() => void lauf(true)}>Nur ordnen (ohne Antworten)</button>
          </footer>
        </section>

        {/* ── Verbindung & Kategorien ── */}
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
              <span key={k.kategorie} className="pm-chip">
                {KATEGORIE_TEXT[k.kategorie] || k.kategorie} <b>{k.n}</b>
              </span>
            ))}
            {!(lage?.kategorien || []).length && <span className="pm-leise">Noch keine eingeordnete Mail.</span>}
          </div>
        </section>
      </div>

      {/* ── Der Strom: jede Bewegung, jede Antwort im Wortlaut ── */}
      <section className="pm-tafel breit">
        <header><b>Die letzten Handgriffe</b><small>{z.gesamt ?? 0} Mails insgesamt verarbeitet</small></header>
        <ul className="pm-strom">
          {(lage?.strom || []).map((m: any) => {
            const [text, ton] = AKTION_TEXT[m.aktion] || [m.aktion, "still"];
            return (
              <li key={m.id} className={offen === m.id ? "auf" : ""}>
                <button type="button" className="pm-strom-kopf" onClick={() => setOffen(offen === m.id ? null : m.id)}>
                  <span className={`pm-marke ${ton}`}>{text}</span>
                  <span className="pm-strom-wer">
                    <b>{m.betreff || "(ohne Betreff)"}</b>
                    <small>{m.von} → {m.postfach} · {KATEGORIE_TEXT[m.kategorie] || m.kategorie || "…"}{m.dringend ? " · DRINGEND" : ""}{m.ref ? " · Akte verknüpft" : ""}</small>
                  </span>
                  <time>{new Date(m.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                </button>
                {offen === m.id && (
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
