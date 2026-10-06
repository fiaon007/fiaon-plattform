// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE VORLAGE FÜR ALLE UNTERSEITEN (19.09.2026, E-191)
//
// Eine Seite, viele Adressen: /business/<slug> und /business/wissen/<slug>
// lesen ihren Inhalt aus shared/fiaon-global-seiten (dieselbe Quelle, aus der
// der Server Titel, Korpus und FAQ für Suchmaschinen rendert).
// Seit 24.09.2026 (E-234) auch englisch: /en/business/<slug> und
// /en/business/knowledge/<slug> — die Sprache kommt aus der Registerseite
// (globalSprache), die festen Wörter aus client/src/i18n/global-seite.ts.
//
// ── AUFBAU SEIT 06.10.2026 (E-293, Bauplan /business Kapitel 5, Scheibe D) ──
//   Lesefortschritt
//   Kopf: Brotkrumen · Augenzeile · H1 · Lead · zwei Knöpfe · Ziffern als
//         schmale Leiste — rechts das Merkblatt als Karteikarte (drei Zeilen,
//         „Alle Angaben“ klappbar; am Handy ganz zugeklappt)
//   Körper: links das Inhaltsverzeichnis (läuft mit), rechts zuerst die
//           Antwortkarte „Kurz beantwortet“, dann die Abschnitte mit römischer
//           Ziffer — Etappen als Weg, Hinweise als Randnotiz (≥ 1280 px in
//           einer eigenen Spalte), Tabellen aus Haarlinien, Karten mit
//           Linien-Zeichen, Pakete als dieselben Tafeln wie auf /business —,
//           die Fragen, Stand und Quellen (klappbar)
//   Jahresbetreuung als Band · Erstgespräch (Kalender erst auf Wunsch) ·
//   Weiterlesen · Schlussband · Handlungsleiste am Handy
// Nur Darstellung: Kein Registertext ändert sich. Was der Korpus für
// Suchmaschinen enthält (blockAlsText), bleibt sichtbar; Zugeklapptes steht
// in <details> im DOM, nie display:none.
// Gestaltung: styles/global.css (.fg, Farben, Glanz) + styles/global-seiten.css
// (.fd-) + styles/global-grafik.css (Tafel, Jahresband, Bewegungsgrundgesetz).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dunkel, Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalJahresbetreuung from "@/components/site/GlobalJahresbetreuung";
import GlobalSchlagzeilen from "@/components/site/GlobalSchlagzeilen";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import Merkblatt from "@/components/site/global-seite/Merkblatt";
import GlobalSchlussBild from "@/components/site/global/GlobalSchlussBild";
import SeitenWeg from "@/components/site/global-seite/SeitenWeg";
import GespraechKarte from "@/components/site/global-seite/GespraechKarte";
import { SeitenTafel, SeitenTafeln, OrteKarte, RollenDreieck } from "@/components/site/global-seite/SeitenBausteine";
import { Zeichen, zeichenFuerSeite, zeichenReihe } from "@/components/site/global-seite/Zeichen";
import NotFound from "@/pages/not-found";
import { GLOBAL_WOERTER } from "@/i18n/global";
import { GLOBAL_SEITE_WOERTER } from "@/i18n/global-seite";
import {
  globalSeite, globalKrumen, globalInhalt, globalSprache, GLOBAL_SEITE_WORTE, type GlobalBlock, type GlobalSeite,
} from "@shared/fiaon-global-seiten";
import { globalMenuePunkt } from "@shared/fiaon-global-menue";
import { GLOBAL_PAKETE, globalKapital, globalPaket, globalPreisText, type GlobalSchluessel } from "@shared/fiaon-global";
import { globalStartPfad, globalPaketePfad, globalSeitePfad } from "@shared/fiaon-global-wege";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN, GLOBAL_VERBUNDEN_EN } from "@shared/fiaon-global-partner";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { werbeEreignis } from "@/lib/werbung";
import "@/styles/global.css";
import "@/styles/global-seiten.css";
import "@/styles/global-grafik.css";

const ROEMISCH = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

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

type Sp = "de" | "en";
const datumIn = (iso: string, sp: Sp) => new Date(`${iso}T12:00:00`).toLocaleDateString(sp === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric" });
const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;

// ── Die Seite ────────────────────────────────────────────────────────────────
export default function GlobalSeitePage() {
  const pfad = typeof window !== "undefined" ? window.location.pathname : "";
  const s = globalSeite(pfad);
  if (!s) return <NotFound />;
  return <Seite s={s} />;
}

function Seite({ s }: { s: GlobalSeite }) {
  const sp = globalSprache(s);
  const t = GLOBAL_WOERTER[sp];
  const u = GLOBAL_SEITE_WOERTER[sp];
  const w = GLOBAL_SEITE_WORTE[sp];
  const inhalt = useMemo(() => globalInhalt(s), [s]);
  const nummer = useMemo(() => {
    const m = new Map<string, string>();
    let n = 0;
    for (const e of inhalt) if (e.id !== "kurz") m.set(e.id, ROEMISCH[n++] ?? String(n));
    return m;
  }, [inhalt]);
  const aktiv = useScrollspy(inhalt.map((e) => e.id));
  const fortschritt = useRef<HTMLSpanElement>(null);
  const kopf = useRef<HTMLElement>(null);
  useEinmalSichtbar(kopf, 0.1);
  const [leiste, setLeiste] = useState(false);
  // 06.10.2026 (E-293): Der Kalender lädt erst auf Wunsch — oder sofort, wenn jemand mit #gespraech ankommt.
  const [gespraechOffen, setGespraechOffen] = useState(() => typeof window !== "undefined" && window.location.hash === "#gespraech");
  const [gespraechPaket, setGespraechPaket] = useState<string | null>(s.paket ?? null);

  useEffect(() => {
    const neu = () => {
      const h = document.documentElement;
      const max = Math.max(1, h.scrollHeight - window.innerHeight);
      fortschritt.current?.style.setProperty("--fd-p", String(Math.min(1, window.scrollY / max)));
      setLeiste(window.scrollY > 560);
    };
    const hash = () => { if (window.location.hash === "#gespraech") setGespraechOffen(true); };
    neu();
    window.addEventListener("scroll", neu, { passive: true });
    window.addEventListener("resize", neu);
    window.addEventListener("hashchange", hash);
    // Wer mit #anker ankommt, landet dort — erst nach dem ersten Bild.
    if (window.location.hash) requestAnimationFrame(() => setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 80));
    return () => { window.removeEventListener("scroll", neu); window.removeEventListener("resize", neu); window.removeEventListener("hashchange", hash); };
  }, []);

  const paket = s.paket ?? null;
  const beauftragen = paket ? globalStartPfad(paket, sp, s.auftraggeber) : globalPaketePfad(sp);
  const paketName = paket ? globalPaket(paket)![sp].name : "";
  // Jeder Weg zum Gespräch öffnet die Karte an ihrer Stelle; eine Tafel füllt dabei ihr Paket vor.
  const oeffneGespraech = (wahl?: GlobalSchluessel) => {
    if (wahl) setGespraechPaket(wahl);
    setGespraechOffen(true);
    requestAnimationFrame(() => document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }));
  };
  const zumGespraech = (e: React.MouseEvent) => { e.preventDefault(); oeffneGespraech(); };
  const klickBeauftragen = () => werbeEreignis("global_beauftragen_klick", { paket: paket ?? "", seite: s.pfad });
  const krumen = globalKrumen(s);
  const stand = u.stand(datumIn(s.stand, sp));

  return (
    <Dunkel seite="business" titel={s.seo.titel} beschreibung={s.seo.beschreibung} sprache={sp}>
      <div className="fg fd">
        <div className="fd-fortschritt" aria-hidden="true"><i ref={fortschritt as any} /></div>

        {/* ── Kopf ───────────────────────────────────────────────────────── */}
        <header ref={kopf} className="fd-kopf neu">
          <div className="fg-rahmen fd-kopf-raster">
            <Auf>
              <nav aria-label={u.krumen}>
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
                  {paket ? t.beauftragen(paketName) : t.knopfPakete}<Pfeil />
                </a>
                <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
              </div>
              {/* Kennziffern als schmale Leiste: höchstens drei Werte, jede Zahl mit ihrem Satz (Blickfang-Regel). */}
              {s.ziffern?.length ? (
                <div className="fd-leiste">
                  {s.ziffern.slice(0, 3).map((z) => <div key={z.label}><b>{z.wert}</b><span>{z.label}</span></div>)}
                </div>
              ) : null}
              <p className="fd-kopf-stand">{stand}</p>
            </Auf>
            <Auf verzoegerung={140}>
              <Merkblatt titel={u.blick} kennung={s.kennung} zeilen={s.blick} alle={u.alleAngaben} punkte={u.blickPunkte(s.blick.length)}
                stand={stand} firma={`${FIAON_FIRMA.name} · Companies House ${FIAON_FIRMA.companyNo}`} />
            </Auf>
          </div>
        </header>

        {/* 06.10.2026 (E-293): Die Nachrichtenlage stand bis heute auf /business direkt nach dem Hero — noch bevor das
            Angebot erklärt war. Sie steht jetzt auf der Wissen-Übersicht (/business/wissen), mit denselben Daten
            (shared/fiaon-global-schlagzeilen.ts) und derselben Prüfung (pruef-global-seiten.ts §9). */}
        {s.art === "hub" && (
          <GlobalSchlagzeilen sprache={sp} auge={t.presseAuge} h2={t.presseH2} stand={t.presseStand} zurQuelle={t.presseZurQuelle}
            hinweis={t.presseHinweis} laufband={t.presseLaufband} pause={t.pressePause} weiter={t.presseWeiter} />
        )}

        {/* ── Körper ─────────────────────────────────────────────────────── */}
        <div className="fd-koerper neu">
          <nav className="fd-inhalt" aria-label={u.inhaltLabel}>
            <p>{u.inhalt}</p>
            <ol>
              {inhalt.map((e) => (
                <li key={e.id}><a href={`#${e.id}`} aria-current={aktiv === e.id ? "true" : undefined}
                  onClick={(ev) => { ev.preventDefault(); document.getElementById(e.id)?.scrollIntoView({ behavior: glatt() }); history.replaceState(null, "", `#${e.id}`); }}>
                  <i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}
                </a></li>
              ))}
            </ol>
            <div className="fd-inhalt-fuss">
              <a className="fg-knopf" href={beauftragen} onClick={paket ? klickBeauftragen : undefined}>{paket ? u.jetzt : t.knopfPakete}</a>
              <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
            </div>
          </nav>

          <article className="fd-text neu">
            {/* Die Antwortkarte ist das erste Element im Körper (Bauplan Kapitel 5, Punkt 3). */}
            <section id="kurz" className="fd-antwort" aria-label={w.kurz}>
              <span className="fd-marke">{w.kurz}</span>
              <p>{s.kurz}</p>
            </section>

            <details className="fd-inhalt-mobil">
              <summary>{u.inhaltLabel}</summary>
              <ol>
                {inhalt.map((e) => <li key={e.id}><a href={`#${e.id}`}><i>{e.id === "kurz" ? "—" : nummer.get(e.id)}</i>{e.titel}</a></li>)}
              </ol>
            </details>

            {s.bloecke.map((b, i) => <Baustein key={b.id} b={b} nr={nummer.get(b.id)} seite={s} sp={sp} onGespraech={oeffneGespraech}
              randUnten={b.typ === "hinweis" && !randDaneben(s.bloecke[i + 1])} />)}

            {s.fragen.length > 0 && (
              <Abschnitt id="fragen">
                <span className="fd-nr">{nummer.get("fragen")}.</span>
                <h2 className="fd-h2 fg-h2">{w.fragen}</h2>
                <div className="fd-fragen"><Fragen items={s.fragen} /></div>
              </Abschnitt>
            )}

            <footer className="fd-vermerk">
              <span><b>{u.vermerkStand}</b> {datumIn(s.stand, sp)} · <b>{u.vermerkRedaktion}</b> FIAON Global · <b>{u.vermerkKennung}</b> {s.kennung}</span>
              {s.quellen?.length ? (
                <details className="fd-quellen">
                  <summary>{u.quellenZahl(s.quellen.length)}</summary>
                  <ol>{s.quellen.map((q) => <li key={q.url}><a href={q.url} target="_blank" rel="noopener noreferrer">{q.titel}</a></li>)}</ol>
                </details>
              ) : null}
              <span>{u.vermerkHinweis}</span>
            </footer>
          </article>
        </div>

        {/* 19.09.2026 (E-196): die Jahresbetreuung ab dem zweiten Jahr — auf jeder Seite, dieselben Sätze wie im Vertrag.
            06.10.2026 (E-293): als Band wie auf /business (Jahresring, ein Satz, Zeitleiste; die vollen Sätze unter
            „So funktioniert es“). Das Band trägt id="jahresbetreuung" selbst. */}
        <GlobalJahresbetreuung sprache={sp} groesse="band" startPfad={beauftragen} knopf={t.jbKnopf} so={t.jbSo} />

        {/* ── Gespräch ───────────────────────────────────────────────────── */}
        <section id="gespraech" className="fg-sek stein fd-gespraech" style={{ scrollMarginTop: 72 }}>
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-kopf">
                <div><span className="fg-auge">{t.gespraechAuge}</span><h2 className="fg-h2">{t.gespraechH2}</h2></div>
                <p className="fg-lead">{t.gespraechLead}</p>
              </div>
            </Auf>
            <GespraechKarte sp={sp} offen={gespraechOffen} onOeffnen={() => setGespraechOffen(true)} paket={gespraechPaket} />
          </div>
        </section>

        {/* ── Weiterlesen ────────────────────────────────────────────────── */}
        {s.weiter.length > 0 && (
          <section className="fd-weiter" aria-labelledby="fd-weiter-titel">
            <span className="fg-auge" id="fd-weiter-titel">{u.weiterlesen}</span>
            <div className="fd-weiter-raster">
              {s.weiter.map((p) => {
                const z = p === globalSeitePfad(sp) ? null : globalSeite(p);
                const titel = z ? `${z.h1.replace(/[.]$/, "")}` : u.uebersichtTitel;
                return (
                  <a key={p} href={p}>
                    <span className="fd-weiter-kopf">
                      <Zeichen art={zeichenFuerSeite(p, `${z?.auge ?? ""} ${titel}`, z?.art)} />
                      <span className="tag">{z ? z.auge.split(" · ").pop() : "FIAON Global"}</span>
                    </span>
                    <span className="titel">{titel}</span>
                    <span className="text">{z ? globalMenuePunkt(z.pfad)?.text ?? z.seo.beschreibung.slice(0, 90) + "…" : u.uebersichtText}</span>
                    <span className="pfeil"><Pfeil /></span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Schlussband — auf den Unterseiten die eine dunkle Fläche ──────── */}
        <section className="fg-schluss mit-bild">
          <GlobalSchlussBild nachweis={t.szeneKi} />
          <div className="fg-rahmen">
            <div className="fg-schluss-text">
              <h2 className="fg-h2">{s.schluss?.a ?? t.schlussA}<em>{s.schluss?.b ?? t.schlussB}</em></h2>
              <p className="fg-lead">{s.schluss?.text ?? t.schlussText}</p>
              <div className="fg-knoepfe">
                <a className="fg-knopf" href={globalPaketePfad(sp)}>{t.knopfPakete}<Pfeil /></a>
                <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{t.knopfGespraech}</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Handlungsleiste am Handy ───────────────────────────────────── */}
        <div className={`fd-mobil${leiste ? " da" : ""}`} aria-hidden={!leiste}>
          <a className="hell" href="#gespraech" onClick={zumGespraech} tabIndex={leiste ? 0 : -1}>{t.leisteGespraech}</a>
          <a className="voll" href={beauftragen} onClick={paket ? klickBeauftragen : undefined} tabIndex={leiste ? 0 : -1}>{paket ? (sp === "en" ? u.jetzt : t.beauftragen(paketName.replace(/^Global\s+/, ""))) : t.leistePakete(globalPreisText("global_struktur", sp))}</a>
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
/**
 * Ein Abschnitt, der einmal „ankommt“: data-an="1" beim Hineinscrollen (useEinmalSichtbar). Daran hängen der
 * einmalige Glanz der H2 (styles/global.css) und die Grafik-Bewegung der Bausteine. Schwelle 0 mit eigenem Rand,
 * weil ein Abschnitt höher als der Bildschirm sein kann (bewegung.ts).
 */
function Abschnitt({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -20% 0px");
  return <section ref={ref} id={id} className={`fd-abschnitt${className ? ` ${className}` : ""}`}>{children}</section>;
}

function Kopf({ nr, h2, lead }: { nr?: string; h2: string; lead?: string }) {
  return (
    <>
      {nr && <span className="fd-nr">{nr}.</span>}
      <h2 className="fd-h2 fg-h2">{h2}</h2>
      {lead && <p className="fd-block-lead">{lead}</p>}
    </>
  );
}

/** Randnotiz-Zeichen: § bei Recht, Steuer und Pflichten, sonst i. Linien, kein Text im Bild. */
function RandZeichen({ recht }: { recht: boolean }) {
  return (
    <span className="fd-rand-zeichen" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {recht
          ? <path d="M15 6.4c-.6-1.4-1.8-2.1-3.2-2.1-1.8 0-3.1 1.1-3.1 2.6 0 3.4 6.8 2.7 6.8 6.4 0 1.4-1 2.4-2.6 2.6 M9 17.6c.6 1.4 1.8 2.1 3.2 2.1 1.8 0 3.1-1.1 3.1-2.6 0-3.4-6.8-2.7-6.8-6.4 0-1.4 1-2.4 2.6-2.6" />
          : <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4 M12 7.6v.2" /></>}
      </svg>
    </span>
  );
}
const RECHT = /§|recht|steuer|pflicht|haft|gesetz|finanzamt|meldung|behörde|vertrag|\blaw|legal|\btax|liab|oblig|filing|authorit|contract/i;

/**
 * Die Randnotiz reicht ab 1280 px über zwei Zeilen: den Abschnitt davor und den danach (06.10.2026, E-293). Ist der
 * nächste Baustein breit (Pakettafeln über beide Spalten) oder fehlt er, kann er nicht neben ihr stehen — dann blieb
 * links eine Lücke (auf /business/ablauf ≈ 225 px vor „Die vier Pakete“). Solche Notizen stehen deshalb unter ihrem
 * Abschnitt, eingerückt mit Haarlinie, wie unter 1280 px.
 */
const randDaneben = (naechster?: GlobalBlock) => !!naechster && naechster.typ !== "pakete" && naechster.typ !== "hinweis";

function Baustein({ b, nr, seite, sp, onGespraech, randUnten = false }: { b: GlobalBlock; nr?: string; seite: GlobalSeite; sp: Sp; onGespraech: (paket?: GlobalSchluessel) => void; randUnten?: boolean }): ReactNode {
  const u = GLOBAL_SEITE_WOERTER[sp];
  const wege = { sp, seite: seite.pfad, art: seite.auftraggeber, onGespraech };
  switch (b.typ) {
    case "text":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} />
          {b.absaetze.map((a) => <p key={a.slice(0, 40)} className="fd-p">{a}</p>)}
          {b.punkte?.length ? <ul className="fd-punkte">{b.punkte.map((p) => <li key={p}><Haken />{p}</li>)}</ul> : null}
          {b.nach && <p className="fd-nach">{b.nach}</p>}
        </Abschnitt>
      );
    case "etappen":
      // Der Weg: dieselbe Haarlinien-Sprache wie die Wegleiste auf /business — Titel, Dauer und Text sichtbar.
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <SeitenWeg etappen={b.etappen} />
        </Abschnitt>
      );
    case "rollen":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <RollenDreieck sp={sp} />
          <div className="fd-rollen">
            {([[u.rollen.fiaon, b.fiaon, "fiaon"], [u.rollen.partner, b.partner, ""], [u.rollen.sie, b.sie, ""]] as const).map(([titel, liste, k]) => (
              <div key={titel} className={`fd-rolle ${k}`}><h3>{titel}</h3><ul>{liste.map((x) => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </Abschnitt>
      );
    case "tabelle":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-tabelle neu" role="region" aria-label={b.h2} tabIndex={0}>
            <table>
              <thead><tr>{b.kopf.map((k, i) => <th key={i} scope="col" className={b.hervor === i ? "hervor" : undefined}>{k}</th>)}</tr></thead>
              <tbody>
                {b.zeilen.map((z, zi) => (
                  <tr key={zi}>{z.map((zelle, i) => (i === 0 && b.kopf[0] === "" ? <th key={i} scope="row" className="zeilenkopf">{zelle}</th> : <td key={i} className={b.hervor === i ? "hervor" : undefined} data-label={i > 0 && b.kopf[i] ? b.kopf[i] : undefined}>{zelle}</td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.fuss?.length ? <ul className="fd-fuss">{b.fuss.map((f) => <li key={f}>{f}</li>)}</ul> : null}
        </Abschnitt>
      );
    case "karten": {
      const ersatz = seite.art === "wissen" ? "wissen" : "gesellschaft";
      // Je Karte ein anderes Zeichen — oder im ganzen Baustein keins (Zeichen.tsx, zeichenReihe; 06.10.2026, E-293).
      // Gewählt nach der Marke (tag = die Art der Karte), nur ohne Marke nach dem Titel: So sagen DE und EN dasselbe.
      const zeichen = zeichenReihe(b.karten.map((k) => k.tag || k.titel), ersatz);
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className={`fd-karten neu${b.spalten === 3 ? " drei" : ""}`}>
            {b.karten.map((k, i) => {
              const art = zeichen[i];
              const innen = (
                <>
                  {(art || k.tag) && <span className="fd-karte-kopf">{art && <Zeichen art={art} />}{k.tag && <span className="tag">{k.tag}</span>}</span>}
                  <h3>{k.titel}</h3><p>{k.text}</p>
                </>
              );
              return k.pfad ? <a key={k.titel} className="fd-karte" href={k.pfad}>{innen}</a> : <div key={k.titel} className="fd-karte">{innen}</div>;
            })}
          </div>
        </Abschnitt>
      );
    }
    case "hinweis": {
      // Randnotiz (Bauplan Kapitel 5, Punkt 5): ab 1280 px in der rechten Spalte neben dem Abschnitt davor, darunter
      // eingerückt mit Haarlinie — immer offen, jeder Punkt sichtbar (Pflichthinweise werden nie geklappt).
      const recht = RECHT.test([b.h2, b.lead ?? "", ...b.punkte].join(" "));
      return (
        <Abschnitt id={b.id} className={`fd-rand${randUnten ? " unten" : ""}`}>
          <RandZeichen recht={recht} />
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <ol className="fd-rand-punkte">{b.punkte.map((p) => <li key={p.slice(0, 50)}><span>{p}</span></li>)}</ol>
        </Abschnitt>
      );
    }
    case "zitat":
      return <blockquote id={b.id} className="fd-zitat"><p>{u.zitat(b.text)}</p>{b.quelle && <footer>{b.quelle}</footer>}</blockquote>;
    case "paket":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <SeitenTafel k={b.paket} {...wege} />
        </Abschnitt>
      );
    case "pakete":
      return (
        <Abschnitt id={b.id} className="breit">
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <SeitenTafeln {...wege} />
        </Abschnitt>
      );
    case "standorte":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <OrteKarte sp={sp} />
        </Abschnitt>
      );
    case "finder":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <PaketFinder sp={sp} seite={seite.pfad} />
        </Abschnitt>
      );
    case "verzeichnis":
      return (
        <Abschnitt id={b.id}>
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
        </Abschnitt>
      );
    case "fragen":
      return (
        <Abschnitt id={b.id}>
          <Kopf nr={nr} h2={b.h2} lead={b.lead} />
          <div className="fd-fragen"><Fragen items={b.fragen} /></div>
        </Abschnitt>
      );
  }
}

// ── London · Zürich · Miami — mit Ortszeit ───────────────────────────────────
export function Standorte({ sp = "de" }: { sp?: Sp }) {
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setJetzt(new Date()), 30_000); return () => window.clearInterval(t); }, []);
  const zeit = (tz: string) => jetzt.toLocaleTimeString(sp === "en" ? "en-GB" : "de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const u = GLOBAL_SEITE_WOERTER[sp];
  return (
    <>
      <div className="fd-standorte">
        {GLOBAL_STANDORTE.map((o) => {
          const x = sp === "en" ? o.en : o;
          return (
          <div key={o.schluessel} className="fd-standort">
            <div className="stadt"><b>{x.stadt}</b><span className="zeit" aria-label={u.ortszeit(x.stadt)}>{zeit(o.zeitzone)}</span></div>
            <span className="land">{x.land}</span>
            <span className="ges">{o.gesellschaft}</span>
            <span className="rechtsform">{x.rechtsform}</span>
            <p className="rolle">{x.rolle}</p>
            <address>{o.adresse.map((z) => <span key={z}>{z}</span>)}</address>
            {o.register && <span className="reg">{o.register}</span>}
          </div>
          );
        })}
      </div>
      <p className="fd-verbunden">{sp === "en" ? GLOBAL_VERBUNDEN_EN : GLOBAL_VERBUNDEN}</p>
    </>
  );
}

// ── Der Paket-Finder ─────────────────────────────────────────────────────────
// Die Fragen stehen seit 24.09.2026 (E-234) in client/src/i18n/global-seite.ts — deutsch und englisch,
// die vierte Antwort jeder Frage ist Stufe 3 (Global VIP), die erste Stufe 0 (Global Struktur).
export function PaketFinder({ sp = "de", seite = "/business/paket-finder" }: { sp?: Sp; seite?: string }) {
  const u = GLOBAL_SEITE_WOERTER[sp];
  const t = GLOBAL_WOERTER[sp];
  const FRAGEN_FINDER = u.finder.fragen;
  const [antworten, setAntworten] = useState<(number | null)[]>([null, null, null, null]);
  const [schritt, setSchritt] = useState(0);
  const fertig = schritt >= FRAGEN_FINDER.length;
  const waehle = (i: number) => {
    const neu = [...antworten]; neu[schritt] = i; setAntworten(neu);
    window.setTimeout(() => setSchritt((x) => Math.min(x + 1, FRAGEN_FINDER.length)), 220);
  };
  // Das Paket muss jede Anforderung tragen — also die höchste Stufe aus Ziel, Kapitalrahmen und Begleitung.
  const stufen = antworten.map((a) => (a == null ? 0 : Math.min(3, a)));
  const stufe = Math.max(stufen[0], stufen[1], stufen[3]) as 0 | 1 | 2 | 3;
  const ergebnis = GLOBAL_PAKETE[stufe];
  const e = ergebnis[sp];
  useEffect(() => { if (fertig) werbeEreignis("global_paketfinder_ergebnis", { paket: ergebnis.key }); }, [fertig]);
  const kapital = globalKapital(ergebnis.key, sp);
  const zeitKnapp = stufen[2] < stufe;

  return (
    <div className="fd-finder">
      <ol className="fd-finder-stufen" aria-label={u.finder.fortschritt}>
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
            <button type="button" className="fg-textknopf" disabled={schritt === 0} onClick={() => setSchritt((x) => Math.max(0, x - 1))}>{u.finder.zurueck}</button>
            <span className="fg-leise">{u.finder.frageVon(schritt + 1, FRAGEN_FINDER.length)}</span>
          </div>
        </fieldset>
      ) : (
        <div className="fd-ergebnis" aria-live="polite">
          <span className="fd-marke">{u.finder.ergebnis}</span>
          <h3>{e.name} <span style={{ fontSize: ".55em", color: "var(--leise)" }}>· {e.marke}</span></h3>
          <ul className="gruende">
            {FRAGEN_FINDER.map((f, i) => antworten[i] != null && (
              <li key={f.kurz}><Haken /><span><b style={{ fontWeight: 500, color: "var(--tinte)" }}>{f.kurz}:</b> {f.antworten[antworten[i]!].titel}</span></li>
            ))}
          </ul>
          {zeitKnapp && <p className="fd-p" style={{ fontSize: 14.5 }}>{u.finder.zeitKnapp(e.dauerKurz)}</p>}
          <div className="fd-tafel" style={{ marginTop: 22 }}>
            <div className="fd-tafel-links">
              <span className="marke">{e.marke}</span>
              <h3>{e.name}</h3>
              <p className="fuer">{e.fuer}</p>
              <ul>{e.leistungen.slice(0, 5).map((x) => <li key={x}><Haken />{x}</li>)}</ul>
            </div>
            <div className="fd-tafel-rechts">
              <div className="fg-kapital">
                <span>{kapital.bisZu ? `${u.kapitalrahmen} ${kapital.bisZu}` : u.kapitalrahmen}</span>
                <b className="fg-glanz">{kapital.wert}</b>
                <em>{t.planungZusatz}</em>
              </div>
              <div className="fg-preis"><b className="fg-glanz">{globalPreisText(ergebnis.key, sp)}</b><span>{u.festpreisEinmalig}</span></div>
              <div className="tun">
                <a className="fg-knopf voll" href={globalStartPfad(ergebnis.key, sp)} onClick={() => werbeEreignis("global_beauftragen_klick", { paket: ergebnis.key, seite })}>{t.beauftragen(e.name)}<Pfeil /></a>
                <a className="fg-textknopf" href="#gespraech" style={{ textAlign: "center" }} onClick={(ev) => { ev.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }); }}>{u.finder.erstSprechen}</a>
              </div>
            </div>
          </div>
          <div className="fd-finder-fuss" style={{ padding: "18px 0 0" }}>
            <button type="button" className="fg-textknopf" onClick={() => { setAntworten([null, null, null, null]); setSchritt(0); }}>{u.finder.neu}</button>
            <span className="fg-leise">{u.finder.orientierung}</span>
          </div>
        </div>
      )}
    </div>
  );
}
