// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE VORLAGE FÜR ALLE UNTERSEITEN (19.09.2026, E-191)
//
// Eine Seite, viele Adressen: /business/<slug> und /business/wissen/<slug>
// lesen ihren Inhalt aus shared/fiaon-global-seiten (dieselbe Quelle, aus der
// der Server Titel, Korpus und FAQ für Suchmaschinen rendert).
//
// ── AUFBAU („Dossier") ─────────────────────────────────────────────────────
//   Lesefortschritt
//   Kopf: Brotkrumen · Oberzeile · H1 (Glanz) · Einleitung · Kennziffern ·
//         zwei Handlungen — rechts das Merkblatt mit Kennung und Stand
//   Körper: links das Inhaltsverzeichnis (läuft mit), rechts „Kurz
//           beantwortet", die Abschnitte mit römischer Ziffer, die Fragen,
//           Stand und Quellen
//   Weiterlesen · Gespräch (Kalender) · Schlussband · Handlungsleiste am Handy
// Gestaltung: styles/global.css (.fg, Farben, Glanz) + styles/global-seiten.css (.fd-).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import NotFound from "@/pages/not-found";
import { GLOBAL_WOERTER } from "@/i18n/global";
import {
  globalSeite, globalKrumen, globalInhalt, type GlobalBlock, type GlobalSeite,
} from "@shared/fiaon-global-seiten";
import { globalMenuePunkt } from "@shared/fiaon-global-menue";
import { GLOBAL_PAKETE, globalKapital, globalPaket, globalPreisText, type GlobalSchluessel } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN } from "@shared/fiaon-global-partner";
import { werbeEreignis } from "@/lib/werbung";
import "@/styles/global.css";
import "@/styles/global-seiten.css";

const ROEMISCH = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
const FOKUS: GlobalSchluessel = "global_kapital";

export function Haken({ groesse = 16 }: { groesse?: number }) {
  return (
    <svg className="fg-haken" width={groesse} height={groesse} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Pfeil({ groesse = 15 }: { groesse?: number }) {
  return <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

const datumDe = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

// ── Die Seite ────────────────────────────────────────────────────────────────
export default function GlobalSeitePage() {
  const pfad = typeof window !== "undefined" ? window.location.pathname : "";
  const s = globalSeite(pfad);
  if (!s) return <NotFound />;
  return <Seite s={s} />;
}

function Seite({ s }: { s: GlobalSeite }) {
  const t = GLOBAL_WOERTER.de;
  const inhalt = useMemo(() => globalInhalt(s), [s]);
  const nummer = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    for (const e of inhalt) if (e.id !== "kurz") m.set(e.id, ROEMISCH[n++] ?? String(n));
    return m;
  }, [inhalt]);
  const aktiv = useScrollspy(inhalt.map((e) => e.id));
  const fortschritt = useRef<HTMLSpanElement>(null);
  const [leiste, setLeiste] = useState(false);

  useEffect(() => {
    const neu = () => {
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - window.innerHeight);
      fortschritt.current?.style.setProperty("--fd-p", String(Math.min(1, window.scrollY / max)));
      setLeiste(window.scrollY > 560);
    };
    neu();
    window.addEventListener("scroll", neu, { passive: true });
    window.addEventListener("resize", neu);
    // Wer mit #anker ankommt, landet dort — erst nach dem ersten Bild.
    if (window.location.hash) requestAnimationFrame(() => setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 80));
    return () => { window.removeEventListener("scroll", neu); window.removeEventListener("resize", neu); };
  }, []);

  const paket = s.paket ?? null;
  const beauftragen = paket ? globalStartPfad(paket, "de", s.auftraggeber) : "/business#pakete";
  const zumGespraech = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }); };
  const klickBeauftragen = () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: s.pfad });
  const krumen = globalKrumen(s);

  return (
    <Dunkel seite="business" titel={s.seo.titel} beschreibung={s.seo.beschreibung}>
      <div className="fg fd">
        <div className="fd-fortschritt" aria-hidden="true"><i ref={fortschritt as any} /></div>

        {/* ── Kopf ───────────────────────────────────────────────────────── */}
        <header className="fd-kopf">
          <div className="fg-rahmen fd-kopf-raster">
            <Auf>
              <nav aria-label="Brotkrumen">
                <ol className="fd-krumen">
                  {/* 19.09.2026: Die Brotkrumen beginnen bei FIAON Global — nie auf der Startseite der Privatkunden. */}
                  {krumen.map((k, i) => (
                    <li key={k.pfad}>{i === krumen.length - 1 ? <span aria-current="page">{k.name}</span> : <a href={k.pfad}>{k.name}</a>}</li>
                  ))}
                </ol>
              </nav>
              <span className="fg-auge">{s.auge}</span>
              <h1 className="fg-h1 fd-h1">{s.h1}{s.h1b && <><br /><em>{s.h1b}</em></>}</h1>
              <p className="fd-lead">{s.lead}</p>
              <div className="fg-knoepfe fd-kopf-knoepfe">
                <a className="fg-knopf" href={beauftragen} onClick={paket ? klickBeauftragen : undefined}>
                  {paket ? `${globalPaket(paket)!.de.name} beauftragen` : t.knopfPakete}<Pfeil />
                </a>
                <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
              </div>
              {s.ziffern?.length ? (
                <div className="fd-ziffern">
                  {s.ziffern.map((z) => <div key={z.label}><b className="fg-glanz">{z.wert}</b><span>{z.label}</span></div>)}
                </div>
              ) : null}
            </Auf>
            <Auf verzoegerung={140}>
              <aside className="fd-merkblatt" aria-label="Auf einen Blick">
                <div className="fd-merkblatt-kopf"><b>Auf einen Blick</b><span>{s.kennung}</span></div>
                <dl>{s.blick.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                <div className="fd-merkblatt-fuss"><span>Stand {datumDe(s.stand)}</span><span>FIAON LTD · Companies House 17318250</span></div>
              </aside>
            </Auf>
          </div>
        </header>

        {/* ── Körper ─────────────────────────────────────────────────────── */}
        <div className="fd-koerper">
          <nav className="fd-inhalt" aria-label="Inhalt dieser Seite">
            <p>Inhalt</p>
            <ol>
              {inhalt.map((e) => (
                <li key={e.id}><a href={`#${e.id}`} aria-current={aktiv === e.id ? "true" : undefined}
                  onClick={(ev) => { ev.preventDefault(); document.getElementById(e.id)?.scrollIntoView({ behavior: glatt() }); history.replaceState(null, "", `#${e.id}`); }}>
                  <i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}
                </a></li>
              ))}
            </ol>
            <div className="fd-inhalt-fuss">
              <a className="fg-knopf" href={beauftragen} onClick={paket ? klickBeauftragen : undefined}>{paket ? "Jetzt beauftragen" : t.knopfPakete}</a>
              <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
            </div>
          </nav>

          <article className="fd-text">
            <details className="fd-inhalt-mobil">
              <summary>Inhalt dieser Seite</summary>
              <ol>
                {inhalt.map((e) => <li key={e.id}><a href={`#${e.id}`}><i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}</a></li>)}
              </ol>
            </details>

            <section id="kurz" className="fd-kurz" aria-label="Kurz beantwortet">
              <span className="fd-marke">Kurz beantwortet</span>
              <p>{s.kurz}</p>
            </section>

            {s.bloecke.map((b) => <Baustein key={b.id} b={b} nr={nummer.get(b.id)} seite={s} />)}

            {s.fragen.length > 0 && (
              <section id="fragen" className="fd-abschnitt">
                <span className="fd-nr">{nummer.get("fragen")}.</span>
                <h2 className="fd-h2 fg-h2">Häufige Fragen</h2>
                <div className="fd-fragen"><Fragen items={s.fragen} /></div>
              </section>
            )}

            <footer className="fd-vermerk">
              <span><b>Stand:</b> {datumDe(s.stand)} · <b>Redaktion:</b> FIAON Global · <b>Kennung:</b> {s.kennung}</span>
              {s.quellen?.length ? (
                <>
                  <span><b>Quellen</b></span>
                  <ol>{s.quellen.map((q) => <li key={q.url}><a href={q.url} target="_blank" rel="noopener noreferrer">{q.titel}</a></li>)}</ol>
                </>
              ) : null}
              <span>Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls. Die Prüfung vor der Gründung durch unseren Partner-Steuerberater ist in jedem Paket enthalten.</span>
            </footer>
          </article>
        </div>

        {/* ── Gespräch ───────────────────────────────────────────────────── */}
        <section id="gespraech" className="fg-sek stein" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
                <p className="fg-lead">{t.gespraechLead}</p>
              </div>
            </Auf>
            <GlobalGespraech paket={paket} />
          </div>
        </section>

        {/* ── Weiterlesen ────────────────────────────────────────────────── */}
        {s.weiter.length > 0 && (
          <section className="fd-weiter" aria-labelledby="fd-weiter-titel">
            <span className="fg-auge" id="fd-weiter-titel">Weiterlesen</span>
            <div className="fd-weiter-raster">
              {s.weiter.map((p) => {
                const z = p === "/business" ? null : globalSeite(p);
                return (
                  <a key={p} href={p}>
                    <span className="tag">{z ? z.auge.split(" · ").pop() : "FIAON Global"}</span>
                    <span className="titel">{z ? `${z.h1.replace(/[.]$/, "")}` : "Die Übersicht"}</span>
                    <span className="text">{z ? globalMenuePunkt(z.pfad)?.text ?? z.seo.beschreibung.slice(0, 90) + "…" : "Pakete, Leistungen, Vertragspartner"}</span>
                    <span className="pfeil"><Pfeil /></span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Schlussband ────────────────────────────────────────────────── */}
        <section className="fg-schluss">
          <div className="fg-rahmen schmal">
            <h2 className="fg-h2">{s.schluss?.a ?? t.schlussA}<em>{s.schluss?.b ?? t.schlussB}</em></h2>
            <p className="fg-lead">{s.schluss?.text ?? t.schlussText}</p>
            <div className="fg-knoepfe">
              <a className="fg-knopf" href="/business#pakete">{t.knopfPakete}<Pfeil /></a>
              <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
            </div>
          </div>
        </section>

        {/* ── Handlungsleiste am Handy ───────────────────────────────────── */}
        <div className={`fd-mobil${leiste ? " da" : ""}`} aria-hidden={!leiste}>
          <a className="hell" href="#gespraech" onClick={zumGespraech} tabIndex={leiste ? 0 : -1}>Erstgespräch</a>
          <a className="voll" href={beauftragen} onClick={paket ? klickBeauftragen : undefined} tabIndex={leiste ? 0 : -1}>{paket ? `${globalPaket(paket)!.de.name.replace(/^Global\s+/, "")} beauftragen` : `Pakete ab ${globalPreisText("global_struktur")}`}</a>
        </div>
      </div>
    </Dunkel>
  );
}

// ── Welcher Abschnitt gerade gelesen wird ────────────────────────────────────
function useScrollspy(ids: string[]): string | null {
  const [aktiv, setAktiv] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((eintraege) => {
      const sichtbar = eintraege.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (sichtbar[0]) setAktiv(sichtbar[0].target.id);
    }, { rootMargin: "-18% 0px -70% 0px", threshold: 0 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids.join("|")]);
  return aktiv;
}

// ── Die Bausteine ────────────────────────────────────────────────────────────
function Kopf({ nr, h2, lead }: { nr?: string; h2: string; lead?: string }) {
  return (
    <>
      {nr && <span className="fd-nr">{nr}.</span>}
      <h2 className="fd-h2 fg-h2">{h2}</h2>
      {lead && <p className="fd-block-lead">{lead}</p>}
    </>
  );
}

function Baustein({ b, nr, seite }: { b: GlobalBlock; nr?: string; seite: GlobalSeite }): ReactNode {
  switch (b.typ) {
    case "text":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} />
          {b.absaetze.map((a) => <p key={a.slice(0, 40)} className="fd-p">{a}</p>)}
          {b.punkte?.length ? <ul className="fd-punkte">{b.punkte.map((p) => <li key={p}><Haken />{p}</li>)}</ul> : null}
          {b.nach && <p className="fd-nach">{b.nach}</p>}
        </section>
      );
    case "etappen":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <ol className="fd-etappen">
            {b.etappen.map((e, i) => (
              <li key={e.titel} className="fd-etappe">
                <span className="nr">{ROEMISCH[i]}</span>
                <div>
                  <h3>{e.titel}</h3>
                  {e.dauer && <span className="dauer">{e.dauer}</span>}
                  <p>{e.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    case "rollen":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-rollen">
            {([["FIAON übernimmt", b.fiaon, "fiaon"], ["Partner übernehmen", b.partner, ""], ["Sie übernehmen", b.sie, ""]] as const).map(([titel, liste, k]) => (
              <div key={titel} className={`fd-rolle ${k}`}><h3>{titel}</h3><ul>{liste.map((x) => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </section>
      );
    case "tabelle":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-tabelle" role="region" aria-label={b.h2} tabIndex={0}>
            <table>
              <thead><tr>{b.kopf.map((k, i) => <th key={i} scope="col" className={b.hervor === i ? "hervor" : undefined}>{k}</th>)}</tr></thead>
              <tbody>
                {b.zeilen.map((z, zi) => (
                  <tr key={zi}>{z.map((zelle, i) => (i === 0 && b.kopf[0] === "" ? <th key={i} scope="row" style={{ textAlign: "left", fontWeight: 500, color: "var(--tinte)", textTransform: "none", letterSpacing: 0, fontSize: 14, background: "transparent", borderBottom: 0, borderTop: zi ? "1px solid var(--linie)" : 0, padding: "14px 16px", whiteSpace: "normal" }}>{zelle}</th> : <td key={i} className={b.hervor === i ? "hervor" : undefined} data-label={i > 0 && b.kopf[i] ? b.kopf[i] : undefined}>{zelle}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.fuss?.length ? <ul className="fd-fuss">{b.fuss.map((f) => <li key={f}>{f}</li>)}</ul> : null}
        </section>
      );
    case "karten":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className={`fd-karten${b.spalten === 3 ? " drei" : ""}`}>
            {b.karten.map((k) => {
              const innen = <>{k.tag && <span className="tag">{k.tag}</span>}<h3>{k.titel}</h3><p>{k.text}</p></>;
              return k.pfad ? <a key={k.titel} className="fd-karte" href={k.pfad}>{innen}</a> : <div key={k.titel} className="fd-karte">{innen}</div>;
            })}
          </div>
        </section>
      );
    case "hinweis":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-hinweis">
            <span className="fd-marke">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5v.5" /></svg>
              Vermerk
            </span>
            <ol>{b.punkte.map((p) => <li key={p.slice(0, 50)}><span>{p}</span></li>)}</ol>
          </div>
        </section>
      );
    case "zitat":
      return <blockquote id={b.id} className="fd-zitat"><p>„{b.text}“</p>{b.quelle && <footer>{b.quelle}</footer>}</blockquote>;
    case "paket":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <PaketTafel k={b.paket} seite={seite.pfad} art={seite.auftraggeber} />
        </section>
      );
    case "pakete":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <PaketeKompakt seite={seite.pfad} art={seite.auftraggeber} />
        </section>
      );
    case "standorte":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <Standorte />
        </section>
      );
    case "finder":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <PaketFinder />
        </section>
      );
    case "verzeichnis":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <ul className="fd-verzeichnis">
            {b.eintraege.map((e) => {
              const z = globalSeite(e.pfad);
              if (!z) return null;
              return (
                <li key={e.pfad}><a href={e.pfad}>
                  <span><span className="tag">{e.tag ?? z.auge}</span><span className="titel">{z.h1}{z.h1b ? ` ${z.h1b}` : ""}</span><span className="text">{z.seo.beschreibung}</span></span>
                  <span className="pfeil"><Pfeil groesse={18} /></span>
                </a></li>
              );
            })}
          </ul>
        </section>
      );
    case "fragen":
      return (
        <section id={b.id} className="fd-abschnitt">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-fragen"><Fragen items={b.fragen} /></div>
        </section>
      );
  }
}

// ── Das eine passende Paket ──────────────────────────────────────────────────
export function PaketTafel({ k, seite, art }: { k: GlobalSchluessel; seite: string; art?: "privat" }) {
  const p = globalPaket(k)!;
  const w = p.de;
  const kapital = globalKapital(k, "de");
  const t = GLOBAL_WOERTER.de;
  return (
    <div className="fd-tafel">
      <div className="fd-tafel-links">
        <span className="marke">{w.marke}</span>
        <h3>{w.name}</h3>
        <p className="fuer">{w.fuer}</p>
        <ul>{w.leistungen.slice(0, 6).map((x) => <li key={x}><Haken />{x}</li>)}</ul>
        <a className="mehr" href="/business#pakete">Alle Pakete und Leistungen im Vergleich</a>
      </div>
      <div className="fd-tafel-rechts">
        <div className="fg-kapital">
          <span>{kapital.bisZu ? `${t.planung} ${kapital.bisZu}` : t.planung}</span>
          <b className="fg-glanz">{kapital.wert}</b>
          <em>{t.planungZusatz}</em>
        </div>
        <div className="fg-preis">
          <span className="fg-preis-marke">{t.festpreis}</span>
          <b className="fg-glanz">{globalPreisText(k)}</b>
          <span className="fg-chip"><Haken groesse={13} />{t.inklusive}</span>
        </div>
        <div className="tun">
          <a className="fg-knopf voll" href={globalStartPfad(k, "de", art)} onClick={() => werbeEreignis("global_beauftragen_klick", { paket: k, seite })}>{w.name} beauftragen<Pfeil /></a>
          <a className="fg-textknopf" href="#gespraech" style={{ textAlign: "center" }} onClick={(e) => { e.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }); }}>{t.erstSprechen}</a>
        </div>
      </div>
    </div>
  );
}

// ── Alle vier Pakete kompakt ─────────────────────────────────────────────────
export function PaketeKompakt({ seite, art }: { seite: string; art?: "privat" }) {
  return (
    <div className="fd-pakete">
      {GLOBAL_PAKETE.map((p) => {
        const kapital = globalKapital(p.key, "de");
        return (
          <a key={p.key} className={`fd-paket${p.key === FOKUS ? " fokus" : ""}`} href={globalStartPfad(p.key, "de", art)} aria-label={`${p.de.name} beauftragen`}
             onClick={() => werbeEreignis("global_beauftragen_klick", { paket: p.key, seite })}>
            <span className="marke">{p.de.marke}</span>
            <span className="name">{p.de.name}</span>
            <span className="kap">Kapitalrahmen{kapital.bisZu ? ` ${kapital.bisZu}` : ""}</span>
            <span className="kapwert fg-glanz">{kapital.wert}</span>
            <span className="zeile"><span>{p.de.dauerKurz.charAt(0).toUpperCase() + p.de.dauerKurz.slice(1)}</span><b>{globalPreisText(p.key)}</b></span>
            <span className="pfeil"><Pfeil /></span>
          </a>
        );
      })}
    </div>
  );
}

// ── London · Zürich · Miami — mit Ortszeit ───────────────────────────────────
export function Standorte() {
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setJetzt(new Date()), 30_000); return () => window.clearInterval(t); }, []);
  const zeit = (tz: string) => jetzt.toLocaleTimeString("de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <div className="fd-standorte">
        {GLOBAL_STANDORTE.map((o) => (
          <div key={o.schluessel} className="fd-standort">
            <div className="stadt"><b>{o.stadt}</b><span className="zeit" aria-label={`Ortszeit ${o.stadt}`}>{zeit(o.zeitzone)}</span></div>
            <span className="land">{o.land}</span>
            <span className="ges">{o.gesellschaft}</span>
            <span className="rechtsform">{o.rechtsform}</span>
            <p className="rolle">{o.rolle}</p>
            <address>{o.adresse.map((z) => <span key={z}>{z}</span>)}</address>
            {o.register && <span className="reg">{o.register}</span>}
          </div>
        ))}
      </div>
      <p className="fd-verbunden">{GLOBAL_VERBUNDEN}</p>
    </>
  );
}

// ── Der Paket-Finder ─────────────────────────────────────────────────────────
const FRAGEN_FINDER: { frage: string; hilfe: string; kurz: string; antworten: { titel: string; text: string; stufe: 0 | 1 | 2 | 3 }[] }[] = [
  { kurz: "Ziel", frage: "Was ist Ihr Ziel in den USA?", hilfe: "Wählen Sie, was dem Vorhaben am nächsten kommt.", antworten: [
    { titel: "Eine US-Gesellschaft mit Steuernummern", text: "Gründung, EIN, ITIN, Adresse — und der erste Konto- und Kartenantrag.", stufe: 0 },
    { titel: "Gesellschaft, Konto und weitere Karten", text: "Nach der ersten Karte planvoll weitere Herausgeber gewinnen.", stufe: 1 },
    { titel: "Kapital aufbauen bis zum Bankdarlehen", text: "Über mehrere Herausgeber bis zur Kennzahlen-Mappe.", stufe: 2 },
    { titel: "Alles davon — mit Auftakt vor Ort", text: "Der Aufbau persönlich in Miami, mit Terminen vor Ort.", stufe: 3 },
  ] },
  { kurz: "Kapitalrahmen", frage: "Welchen Kapitalrahmen streben Sie an?", hilfe: "Ihr Ziel — über jeden Rahmen entscheidet das Institut.", antworten: [
    { titel: "Rund 50.000 $", text: "Der Einstieg mit der ersten Karte.", stufe: 0 },
    { titel: "Rund 100.000 $", text: "Mehrere Karten in einer klugen Reihenfolge.", stufe: 1 },
    { titel: "Rund 250.000 $", text: "Über mehrere Herausgeber hinweg.", stufe: 2 },
    { titel: "Darüber hinaus", text: "Der größte Rahmen, den ein Paket begleitet.", stufe: 3 },
  ] },
  { kurz: "Zeit", frage: "Wie viel Zeit geben Sie dem Aufbau?", hilfe: "Erfahrungswerte — Behörden und Institute bestimmen ihr Tempo.", antworten: [
    { titel: "Rund acht Wochen", text: "Gründung, Steuernummern, erste Karte.", stufe: 0 },
    { titel: "Drei bis fünf Monate", text: "Zeit für die Kartenleiter.", stufe: 1 },
    { titel: "Sechs Monate und länger", text: "Zeit bis zur Kapital-Etappe.", stufe: 2 },
    { titel: "So lange, wie es braucht", text: "Mit Auftakt vor Ort und Vorrang bei Terminen.", stufe: 3 },
  ] },
  { kurz: "Begleitung", frage: "Wie möchten Sie begleitet werden?", hilfe: "Jedes Paket hat einen festen Ansprechpartner.", antworten: [
    { titel: "Digital, aus der Ferne", text: "Dokumentenraum und Ansprechpartner genügen.", stufe: 0 },
    { titel: "Mit monatlichem Durchgang", text: "Ein fester Termin im Monat mit Ihrem Ansprechpartner.", stufe: 1 },
    { titel: "Mit Vorrang bei Terminen vor Ort", text: "Unser Team in Miami nimmt Termine für Sie vorrangig wahr.", stufe: 2 },
    { titel: "Persönlich in Miami", text: "Sie sitzen selbst am Tisch — Flug und Hotel inklusive.", stufe: 3 },
  ] },
];

export function PaketFinder() {
  const [antworten, setAntworten] = useState<(number | null)[]>([null, null, null, null]);
  const [schritt, setSchritt] = useState(0);
  const fertig = schritt >= FRAGEN_FINDER.length;
  const waehle = (i: number) => {
    const neu = [...antworten]; neu[schritt] = i; setAntworten(neu);
    window.setTimeout(() => setSchritt((x) => Math.min(x + 1, FRAGEN_FINDER.length)), 220);
  };
  // Das Paket muss jede Anforderung tragen — also die höchste Stufe aus Ziel, Kapitalrahmen und Begleitung.
  const stufen = antworten.map((a, i) => (a == null ? 0 : FRAGEN_FINDER[i].antworten[a].stufe));
  const stufe = Math.max(stufen[0], stufen[1], stufen[3]) as 0 | 1 | 2 | 3;
  const ergebnis = GLOBAL_PAKETE[stufe];
  useEffect(() => { if (fertig) werbeEreignis("global_paketfinder_ergebnis", { paket: ergebnis.key }); }, [fertig]);
  const kapital = globalKapital(ergebnis.key, "de");
  const zeitKnapp = stufen[2] < stufe;

  return (
    <div className="fd-finder">
      <ol className="fd-finder-stufen" aria-label="Fortschritt">
        {FRAGEN_FINDER.map((f, i) => (
          <li key={f.kurz} data-stand={i === schritt ? "aktiv" : i < schritt ? "fertig" : "offen"}><b>{ROEMISCH[i]}</b>{f.kurz}</li>
        ))}
      </ol>
      {!fertig ? (
        <fieldset className="fd-finder-frage" style={{ border: 0, margin: 0 }}>
          <legend>{FRAGEN_FINDER[schritt].frage}</legend>
          <p className="hilfe">{FRAGEN_FINDER[schritt].hilfe}</p>
          <div className="fd-optionen" role="group" aria-label={FRAGEN_FINDER[schritt].frage}>
            {FRAGEN_FINDER[schritt].antworten.map((a, i) => (
              <button key={a.titel} type="button" className="fd-option" aria-pressed={antworten[schritt] === i} onClick={() => waehle(i)}>
                <span className="kreis" aria-hidden="true" />
                <span><b>{a.titel}</b><span className="t">{a.text}</span></span>
              </button>
            ))}
          </div>
          <div className="fd-finder-fuss" style={{ padding: "22px 0 18px" }}>
            <button type="button" className="fg-textknopf" disabled={schritt === 0} onClick={() => setSchritt((x) => Math.max(0, x - 1))}>Zurück</button>
            <span className="fg-leise">Frage {schritt + 1} von {FRAGEN_FINDER.length}</span>
          </div>
        </fieldset>
      ) : (
        <div className="fd-ergebnis" aria-live="polite">
          <span className="fd-marke">Am ehesten passt</span>
          <h3>{ergebnis.de.name} <span style={{ fontSize: ".55em", color: "var(--leise)" }}>· {ergebnis.de.marke}</span></h3>
          <ul className="gruende">
            {FRAGEN_FINDER.map((f, i) => antworten[i] != null && (
              <li key={f.kurz}><Haken /><span><b style={{ fontWeight: 500, color: "var(--tinte)" }}>{f.kurz}:</b> {f.antworten[antworten[i]!].titel}</span></li>
            ))}
          </ul>
          {zeitKnapp && <p className="fd-p" style={{ fontSize: 14.5 }}>Ihr Zeitrahmen ist knapper, als dieses Paket in der Regel braucht ({ergebnis.de.dauerKurz}). Das besprechen wir im Gespräch ehrlich mit Ihnen.</p>}
          <div className="fd-tafel" style={{ marginTop: 22 }}>
            <div className="fd-tafel-links">
              <span className="marke">{ergebnis.de.marke}</span>
              <h3>{ergebnis.de.name}</h3>
              <p className="fuer">{ergebnis.de.fuer}</p>
              <ul>{ergebnis.de.leistungen.slice(0, 5).map((x) => <li key={x}><Haken />{x}</li>)}</ul>
            </div>
            <div className="fd-tafel-rechts">
              <div className="fg-kapital">
                <span>{kapital.bisZu ? `Kapitalrahmen ${kapital.bisZu}` : "Kapitalrahmen"}</span>
                <b className="fg-glanz">{kapital.wert}</b>
                <em>Ihr Ziel — über den Rahmen entscheidet das Institut</em>
              </div>
              <div className="fg-preis"><b className="fg-glanz">{globalPreisText(ergebnis.key)}</b><span>Festpreis · einmalig</span></div>
              <div className="tun">
                <a className="fg-knopf voll" href={globalStartPfad(ergebnis.key, "de")} onClick={() => werbeEreignis("global_beauftragen_klick", { paket: ergebnis.key, seite: "/business/paket-finder" })}>{ergebnis.de.name} beauftragen<Pfeil /></a>
                <a className="fg-textknopf" href="#gespraech" style={{ textAlign: "center" }} onClick={(e) => { e.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }); }}>Erst sprechen</a>
              </div>
            </div>
          </div>
          <div className="fd-finder-fuss" style={{ padding: "18px 0 0" }}>
            <button type="button" className="fg-textknopf" onClick={() => { setAntworten([null, null, null, null]); setSchritt(0); }}>Noch einmal beginnen</button>
            <span className="fg-leise">Eine Orientierung — keine Zusage.</span>
          </div>
        </div>
      )}
    </div>
  );
}
