// ═══════════════════════════════════════════════════════════════════════════
// DIE DUNKLE BÜHNE — Bausteine der Seiten Investoren · Presse · Datenraum ·
// Partner · Karriere. Vorbild ist der Hero von /plattform-konzept.
// Jede Seite: Hero → viele kurze Blöcke mit Mehrwert → Zwischen-CTAs →
// Abschluss, der den Zusammenhang zur Startseite und zum nächsten Schritt zieht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type ReactNode } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import "@/styles/dunkel.css";

type Seite = "startseite" | "investoren" | "karriere" | "presse" | "partner" | "datenraum" | "team";

export function Dunkel({ seite, titel, beschreibung, children }: { seite: Seite; titel: string; beschreibung: string; children: ReactNode }) {
  useEffect(() => {
    const vorher = document.title;
    document.title = `${titel} · FIAON`;
    const m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const alt = m?.getAttribute("content") || "";
    m?.setAttribute("content", beschreibung);
    window.scrollTo(0, 0);
    return () => { document.title = vorher; m?.setAttribute("content", alt); };
  }, [titel, beschreibung]);
  return (
    <div className="dk">
      <div className="dk-grund" aria-hidden="true">
        <span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" />
      </div>
      <GlassNav activePage={seite} />
      <main className="relative z-[1]">{children}</main>
      <PremiumFooter />
    </div>
  );
}

/** Erscheint beim Hereinscrollen. */
export function Auf({ children, verzoegerung = 0, className = "" }: { children: ReactNode; verzoegerung?: number; className?: string }) {
  return (
    <div className={`dk-auf ${className}`} style={{ transitionDelay: `${verzoegerung}ms` }}
         ref={(el) => {
           if (!el || el.classList.contains("da") || (el as any).__io) return;
           if (el.getBoundingClientRect().top < window.innerHeight * 0.95) { el.classList.add("da"); return; }
           const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("da"); io.disconnect(); } }, { threshold: 0.1 });
           (el as any).__io = io; io.observe(el);
         }}>
      {children}
    </div>
  );
}

export function Knopf({ href, onClick, still = false, children }: { href?: string; onClick?: () => void; still?: boolean; children: ReactNode }) {
  const cls = `dk-knopf${still ? " still" : ""}`;
  if (href) return <a href={href} className={cls}>{children}{!still && <Pfeil />}</a>;
  return <button type="button" onClick={onClick} className={cls}>{children}{!still && <Pfeil />}</button>;
}
function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>;
}

/** Hero wie auf /plattform-konzept: mittig, Pille, große Überschrift, Lead, Knöpfe — optional mit 3D-Szene daneben oder darunter. */
export function Hero({ pille, titel, lead, knoepfe, szene, bild }: { pille: string; titel: ReactNode; lead: ReactNode; knoepfe?: ReactNode; szene?: ReactNode; bild?: string }) {
  // Ein Bild hinter dem Hero (Higgsfield, 2k) — gedimmt, mit Schleier ins Nachtblau, damit der Text vorne bleibt.
  const hinter = bild ? <div className="dk-hero-bild" aria-hidden="true"><img src={bild} alt="" decoding="async" fetchPriority="high" /><div className="schleier" /></div> : null;
  if (szene) {
    return (
      <section className="dk-hero">
        {hinter}
        <div className="dk-rahmen dk-zweispaltig">
          <Auf>
            <span className="dk-pille">{pille}</span>
            <h1 className="dk-h1">{titel}</h1>
            <p className="dk-lead">{lead}</p>
            {knoepfe && <div className="dk-knoepfe">{knoepfe}</div>}
          </Auf>
          <Auf verzoegerung={150}><div className="dk-szene gross">{szene}</div></Auf>
        </div>
      </section>
    );
  }
  return (
    <section className="dk-hero">
      {hinter}
      <div className="dk-rahmen schmal mitte">
        <Auf>
          <span className="dk-pille">{pille}</span>
          <h1 className="dk-h1">{titel}</h1>
          <p className="dk-lead">{lead}</p>
          {knoepfe && <div className="dk-knoepfe">{knoepfe}</div>}
        </Auf>
      </div>
    </section>
  );
}

export function Block({ id, pille, titel, lead, children, mitte = false, eng = false, schmal = false }: { id?: string; pille?: string; titel?: ReactNode; lead?: ReactNode; children?: ReactNode; mitte?: boolean; eng?: boolean; schmal?: boolean }) {
  return (
    <section id={id} className={`dk-block${eng ? " eng" : ""}`}>
      <div className={`dk-rahmen${schmal ? " schmal" : ""}${mitte ? " mitte" : ""}`}>
        {(pille || titel) && (
          <Auf>
            {pille && <span className="dk-pille">{pille}</span>}
            {titel && <h2 className="dk-h2">{titel}</h2>}
            {lead && <p className="dk-lead">{lead}</p>}
          </Auf>
        )}
        {children}
      </div>
    </section>
  );
}

export function Glas({ children, tag, titel, ruhig = false, style }: { children?: ReactNode; tag?: string; titel?: ReactNode; ruhig?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={`dk-glas${ruhig ? " ruhig" : ""}`} style={style}>
      {tag && <span className="tag">{tag}</span>}
      {titel && <h3 className="dk-h3">{titel}</h3>}
      {typeof children === "string" ? <p className="dk-text">{children}</p> : children}
    </div>
  );
}

export function Karten({ items, zwei = false }: { items: { tag?: string; titel: ReactNode; text: ReactNode }[]; zwei?: boolean }) {
  return (
    <div className={`dk-raster${zwei ? " zwei" : ""}`}>
      {items.map((k, i) => (
        <Auf key={i} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{typeof k.text === "string" ? <p className="dk-text">{k.text}</p> : k.text}</Glas></Auf>
      ))}
    </div>
  );
}

export function Kennzahlen({ items }: { items: { wert: string; label: string }[] }) {
  return (
    <div className="dk-raster" style={{ marginTop: 40 }}>
      {items.map((k, i) => (
        <Auf key={k.label} verzoegerung={i * 80}>
          <Glas ruhig>
            <div className="dk-kennzahl dk-verlauf zahl">{k.wert}</div>
            <p className="dk-kennzahl-label">{k.label}</p>
          </Glas>
        </Auf>
      ))}
    </div>
  );
}

export function Schritte({ items }: { items: { titel: string; text: string }[] }) {
  return (
    <div className="dk-schritte">
      {items.map((s, i) => (
        <Auf key={s.titel} verzoegerung={i * 90}>
          <Glas ruhig>
            <div className="dk-schritt"><span className="n">{String(i + 1).padStart(2, "0")}</span></div>
            <h3 className="dk-h3" style={{ marginBottom: 8 }}>{s.titel}</h3>
            <p className="dk-text">{s.text}</p>
          </Glas>
        </Auf>
      ))}
    </div>
  );
}

export function Zeilen({ items }: { items: [string, ReactNode][] }) {
  return <div>{items.map(([k, v]) => <div key={k} className="dk-zeile"><span>{k}</span><b>{v}</b></div>)}</div>;
}

export function Zitat({ text, wer }: { text: string; wer: string }) {
  return (
    <Auf>
      <p className="dk-zitat">„{text}“</p>
      <p className="wer">{wer}</p>
    </Auf>
  );
}

export function Fragen({ items }: { items: { f: string; a: string }[] }) {
  const [auf, setAuf] = useState<number | null>(0);
  return (
    <div style={{ marginTop: 36 }}>
      {items.map((q, i) => (
        <div key={q.f} className={`dk-frage${auf === i ? " auf" : ""}`}>
          <button type="button" onClick={() => setAuf(auf === i ? null : i)} aria-expanded={auf === i}>
            <span>{q.f}</span>
            <span className="plus" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
          </button>
          <div className="antwort"><div><p>{q.a}</p></div></div>
        </div>
      ))}
    </div>
  );
}

/** Zwischen-Aufruf: ein Satz, ein Knopf. Hält die Seite in Bewegung. */
export function Zwischenruf({ text, knopf, href, still }: { text: ReactNode; knopf: string; href: string; still?: { knopf: string; href: string } }) {
  return (
    <section className="dk-block eng">
      <div className="dk-rahmen">
        <Auf>
          <div className="dk-glas ruhig" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "28px 32px" }}>
            <p style={{ fontSize: 18, color: "#fff", maxWidth: "48ch", lineHeight: 1.45 }}>{text}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {still && <Knopf href={still.href} still>{still.knopf}</Knopf>}
              <Knopf href={href}>{knopf}</Knopf>
            </div>
          </div>
        </Auf>
      </div>
    </section>
  );
}

/** Abschluss: der Zusammenhang. Jede Seite endet mit dem Kunden — und mit dem nächsten Schritt. */
export function Abschluss({ titel, text, knoepfe }: { titel: ReactNode; text: ReactNode; knoepfe: ReactNode }) {
  return (
    <section className="dk-abschluss">
      <div className="szene"><NeuralSphere variant="calm" className="absolute inset-0" /></div>
      <div className="schleier" />
      <div className="dk-rahmen schmal mitte" style={{ position: "relative" }}>
        <Auf>
          <h2 className="dk-h2" style={{ marginTop: 0 }}>{titel}</h2>
          <p className="dk-lead">{text}</p>
          <div className="dk-knoepfe">{knoepfe}</div>
        </Auf>
      </div>
    </section>
  );
}

/** Anfrage-Formular — ein Endpunkt für Investoren, Presse, Datenraum, Partner, Karriere. */
export function Anfrage({ art, felder, knopf, hinweis, vorbelegt }: {
  art: "investor" | "presse" | "datenraum" | "partner" | "karriere";
  felder: { name: string; label: string; typ?: string; pflicht?: boolean; optionen?: string[]; breit?: boolean }[];
  knopf: string; hinweis?: string; vorbelegt?: Record<string, string>;
}) {
  const [werte, setWerte] = useState<Record<string, string>>(vorbelegt || {});
  const [stand, setStand] = useState<"offen" | "sendet" | "fertig" | "fehler">("offen");
  const [meldung, setMeldung] = useState<string | null>(null);
  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    setStand("sendet");
    const r = await fetch("/api/fiaon/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ art, ...werte }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) { setStand("fertig"); setMeldung(j.meldung || "Danke — wir melden uns."); }
    else { setStand("fehler"); setMeldung(j?.error || "Das hat nicht geklappt. Bitte schreiben Sie an kontakt@fiaon.com."); }
  };
  if (stand === "fertig") {
    return (
      <div className="dk-glas ruhig mitte" style={{ marginTop: 36 }}>
        <h3 className="dk-h3">{meldung}</h3>
        <p className="dk-leise" style={{ marginTop: 8 }}>Sie erhalten eine Antwort von einem Menschen, nicht von einem Automaten.</p>
      </div>
    );
  }
  return (
    <form className="dk-form" onSubmit={senden}>
      <div className="zwei">
        {felder.map((f) => (
          <div key={f.name} style={f.breit ? { gridColumn: "1 / -1" } : undefined}>
            <label className="dk-label" htmlFor={`f-${f.name}`}>{f.label}{f.pflicht ? " *" : ""}</label>
            {f.optionen ? (
              <select id={`f-${f.name}`} className="dk-feld" required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })}>
                <option value="">Bitte wählen</option>{f.optionen.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.typ === "textarea" ? (
              <textarea id={`f-${f.name}`} className="dk-feld" rows={4} required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })} />
            ) : (
              <input id={`f-${f.name}`} className="dk-feld" type={f.typ || "text"} required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })}
                     inputMode={f.typ === "email" ? "email" : f.typ === "tel" ? "tel" : undefined} autoCapitalize={f.typ === "email" ? "none" : undefined} />
            )}
          </div>
        ))}
      </div>
      {meldung && stand === "fehler" && <p style={{ color: "#fca5a5", fontSize: 13.5 }}>{meldung}</p>}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="dk-knopf" disabled={stand === "sendet"}>{stand === "sendet" ? "Wird gesendet …" : knopf}</button>
        {hinweis && <span className="dk-leise">{hinweis}</span>}
      </div>
    </form>
  );
}
