// Hülle aller öffentlichen Seiten: Kopfzeile, Lichter, Fußzeile, Seitentitel.
import { useEffect, useState, type ReactNode } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import "@/styles/website.css";

type Seite = "startseite" | "privatkunden" | "business" | "was-ist-fiaon" | "plattform-konzept" | "login" | "investoren" | "karriere" | "presse" | "partner" | "datenraum";

export function SiteShell({ seite, titel, beschreibung, children }: { seite: Seite; titel: string; beschreibung: string; children: ReactNode }) {
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
    <div className="ws">
      <div className="ws-lichter" aria-hidden="true"><span className="ws-licht a" /><span className="ws-licht b" /></div>
      <GlassNav activePage={seite as any} />
      <main className="relative z-[1] pt-[96px]">{children}</main>
      <PremiumFooter />
    </div>
  );
}

/** Erscheint beim Hereinscrollen — ohne Bibliothek. */
export function Auf({ children, verzoegerung = 0, className = "" }: { children: ReactNode; verzoegerung?: number; className?: string }) {
  return (
    <div className={`ws-auf ${className}`} style={{ transitionDelay: `${verzoegerung}ms` }}
         ref={(el) => {
           if (!el || el.classList.contains("da") || (el as any).__io) return;
           if (el.getBoundingClientRect().top < window.innerHeight * 0.95) { el.classList.add("da"); return; }
           const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("da"); io.disconnect(); } }, { threshold: 0.12 });
           (el as any).__io = io; io.observe(el);
         }}>
      {children}
    </div>
  );
}

export function Abschnitt({ id, ueber, titel, lead, children, mitte = false }: { id?: string; ueber?: string; titel: ReactNode; lead?: ReactNode; children?: ReactNode; mitte?: boolean }) {
  return (
    <section id={id} className="ws-abschnitt">
      <div className="ws-rahmen">
        <Auf className={mitte ? "text-center" : ""}>
          {ueber && <p className="ws-ueber">{ueber}</p>}
          <h2 className="ws-h2">{titel}</h2>
          {lead && <p className="ws-lead" style={mitte ? { margin: "18px auto 0" } : undefined}>{lead}</p>}
        </Auf>
        {children && <div style={{ marginTop: 40 }}>{children}</div>}
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
  return <AnfrageForm art={art} felder={felder} knopf={knopf} hinweis={hinweis} vorbelegt={vorbelegt} />;
}

function AnfrageForm({ art, felder, knopf, hinweis, vorbelegt }: Parameters<typeof Anfrage>[0]) {
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
  if (stand === "fertig") return <div className="ws-karte hoch" style={{ textAlign: "center" }}><h3 className="ws-h3">{meldung}</h3><p className="ws-hinweis" style={{ marginTop: 8 }}>Sie erhalten eine Antwort von einem Menschen, nicht von einem Automaten.</p></div>;
  return (
    <form className="ws-form" onSubmit={senden}>
      <div className="zwei">
        {felder.map((f) => (
          <div key={f.name} style={f.breit ? { gridColumn: "1 / -1" } : undefined}>
            <label className="ws-label" htmlFor={`f-${f.name}`}>{f.label}{f.pflicht ? " *" : ""}</label>
            {f.optionen ? (
              <select id={`f-${f.name}`} className="ws-feld" required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })}>
                <option value="">Bitte wählen</option>{f.optionen.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.typ === "textarea" ? (
              <textarea id={`f-${f.name}`} className="ws-feld" rows={4} required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })} />
            ) : (
              <input id={`f-${f.name}`} className="ws-feld" type={f.typ || "text"} required={f.pflicht} value={werte[f.name] || ""} onChange={(e) => setWerte({ ...werte, [f.name]: e.target.value })}
                     inputMode={f.typ === "email" ? "email" : f.typ === "tel" ? "tel" : undefined} autoCapitalize={f.typ === "email" ? "none" : undefined} />
            )}
          </div>
        ))}
      </div>
      {meldung && stand === "fehler" && <p style={{ color: "#b91c1c", fontSize: 13.5, fontWeight: 600 }}>{meldung}</p>}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="ws-knopf" disabled={stand === "sendet"}>{stand === "sendet" ? "Wird gesendet …" : knopf}</button>
        {hinweis && <span className="ws-hinweis">{hinweis}</span>}
      </div>
    </form>
  );
}
