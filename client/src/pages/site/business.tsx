// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL (Neubau 17.09.2026, E-188)
//
// Justin: „FIAON positioniert sich für den B2B-Sektor komplett neu … Firmen-
// gründung in den USA, Steuerberater, Kreditkarten-System, Fundings — alles
// remote und über uns. Es muss super seriös wirken, wie eine Unternehmens-
// berater-Gruppe, aber super innovativ. HIGH END." — und: „Es soll die
// gesamte Business-Seite und den Antrag ersetzen; nur das wird Business."
//
// ── WAS HIER VORHER STAND ──────────────────────────────────────────────────
// Bis 17.09.2026 verkaufte /business vier Monatsabos der Bonitätslinie
// (Business Starter … Enterprise, 49,99–249,99 €). Sie sind im Katalog als
// `eingestellt` markiert und laufen für Bestandskunden weiter. Dazwischen lag
// zwei Tage lang ein Entwurf unter /global (Devin, 15.09.) mit Video-Hero,
// schwebenden Kartenattrappen, Gold und einem „US-Limit-Audit", das Beträge
// ausrechnete — das Gegenteil von seriös und wettbewerbsrechtlich nicht
// haltbar (Prüfung: 05_Vision/B2B_GLOBAL_PRUEFUNG_2026-09-17.md).
//
// ── AUFBAU ─────────────────────────────────────────────────────────────────
// Nachtblauer Rahmen (Hero · Gespräch · Fragen · Abschluss), dazwischen EIN
// weißes Lichtband als Körper: Aus einer Hand → Der Weg → Für wen → Pakete →
// Klare Rollen → Menschen. Navy-Glas an genau einer Stelle: der Paket-Platte.
// Zwei Handlungen auf der ganzen Seite: direkt beauftragen (/business/start)
// oder ein Gespräch vereinbaren (#gespraech). Keine Zahl im Blickfang, kein
// Bankname, kein Rechner, kein Video.
//
// Preise kommen aus dem Katalog (shared/fiaon-pakete.ts), Leistungen und
// Pflichthinweise aus shared/fiaon-global.ts — dieselben Sätze stehen im
// Vertrag, den der Kunde unterschreibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Fragen } from "@/components/site/DunkleBuehne";
import { Team } from "@/components/site/Team";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { GLOBAL_WOERTER } from "@/i18n/global";
import { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, globalPreisText, globalPlanungText } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import "@/styles/global.css";

export default function Business() {
  const t = useWoerter(GLOBAL_WOERTER);
  const sprache = useSprache();
  const s = sprache === "en" ? "en" : "de";
  const zu = (p: string) => inSprache(p, sprache);
  const start = (paket: string) => globalStartPfad(paket, s);

  // Der Paketwunsch reist von der Tafel („Erst sprechen") in den Kalender.
  const [wunsch, setWunsch] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paket");
    if (p) setWunsch(p);
    // Wer mit #gespraech oder #pakete ankommt (z. B. von /termin?quelle=global), landet dort —
    // erst nach dem ersten Bild, sonst misst der Browser die Höhe des Lichtbands falsch.
    const anker = window.location.hash;
    if (anker) requestAnimationFrame(() => setTimeout(() => document.querySelector(anker)?.scrollIntoView(), 60));
  }, []);
  const zumGespraech = (paket?: string) => {
    if (paket) setWunsch(paket);
    document.getElementById("gespraech")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <div className="gl">
        {/* ── Hero: ein Satz, zwei Handlungen, keine Zahl ─────────────────── */}
        <section className="dk-hero gl-hero">
          <div className="dk-rahmen schmal mitte">
            <Auf>
              <span className="dk-pille">{t.pille}</span>
              <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
              <p className="dk-lead">{t.lead}</p>
              <div className="dk-knoepfe">
                <Knopf href="#pakete">{t.knopfPakete}</Knopf>
                <Knopf onClick={() => zumGespraech()} still>{t.knopfGespraech}</Knopf>
              </div>
            </Auf>
          </div>
          <div className="dk-rahmen">
            <Auf verzoegerung={160}>
              <ul className="gl-fakten">{t.fakten.map((x) => <li key={x}>{x}</li>)}</ul>
            </Auf>
          </div>
        </section>

        <Licht>
          {/* ── Aus einer Hand ───────────────────────────────────────────── */}
          <Block pille={t.handPille} titel={t.handH2} lead={t.handLead}>
            <div className="gl-vier">
              {t.hand.map((k, i) => (
                <Auf key={k.tag} verzoegerung={i * 70}>
                  <div className="gl-matt"><span className="tag">{k.tag}</span><h3>{k.titel}</h3><p>{k.text}</p></div>
                </Auf>
              ))}
            </div>
          </Block>

          {/* ── Der Weg: eine Linie, vier Stationen ──────────────────────── */}
          <Block pille={t.wegPille} titel={t.wegH2} lead={t.wegLead} eng>
            <div className="gl-weg" ref={(el) => {
              if (!el || (el as any).__io) return;
              const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("da"); io.disconnect(); } }, { threshold: 0.2 });
              (el as any).__io = io; io.observe(el);
            }}>
              {t.weg.map((w, i) => (
                <Auf key={w.titel} verzoegerung={i * 90}>
                  <div className="gl-station"><span className="n">{String(i + 1).padStart(2, "0")}</span><h3>{w.titel}</h3><p>{w.text}</p></div>
                </Auf>
              ))}
            </div>
            <Auf><p className="gl-erfahrung">{t.wegErfahrung}</p></Auf>
          </Block>

          {/* ── Für wen ──────────────────────────────────────────────────── */}
          <Block pille={t.fuerPille} titel={t.fuerH2} lead={t.fuerLead} eng>
            <Auf>
              <div className="gl-fuer">{t.fuer.map((x) => <div key={x.tag}><span className="tag">{x.tag}</span><p>{x.text}</p></div>)}</div>
              <p className="gl-ausstieg">{t.fuerAusstieg}</p>
            </Auf>
          </Block>

          {/* ── Pakete: der eine Glas-Ort ────────────────────────────────── */}
          <Block id="pakete" pille={t.paketePille} titel={t.paketeH2} lead={t.paketeLead} eng>
            <Auf>
              <div className="gl-platte">
                <div className="gl-tafeln">
                  {GLOBAL_PAKETE.map((p) => {
                    const w = p[s];
                    return (
                      <article key={p.key} className="gl-tafel">
                        <h3 className="name">{w.name}</h3>
                        <p className="preis">{globalPreisText(p.key, s)}<small>{t.einmalig}</small></p>
                        <p className="fuer">{w.fuer}</p>
                        <div className="masse">
                          <div><span>{t.planung}</span><b>{globalPlanungText(p.key, s)}</b><em>{t.planungZusatz}</em></div>
                          <div><b>{w.dauer}</b></div>
                        </div>
                        <ul>{w.leistungen.map((x) => <li key={x}>{x}</li>)}</ul>
                        <div className="tun">
                          <Knopf href={start(p.key)}>{t.beauftragen}</Knopf>
                          <button type="button" className="leise" onClick={() => zumGespraech(p.key)}>{t.erstSprechen}</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <p className="gl-platte-fuss">{t.kostenHinweis} {GLOBAL_ROLLEN[s].kosten}</p>
              </div>
            </Auf>
            <Auf verzoegerung={80}>
              <div className="gl-darunter">
                {GLOBAL_GELD_ZURUECK.aktiv && (
                  <div className="gl-matt">
                    <span className="tag">FIAON</span>
                    <h3>{GLOBAL_GELD_ZURUECK[s].titel}</h3>
                    <p>{GLOBAL_GELD_ZURUECK[s].text}</p>
                    <p className="klein">{GLOBAL_GELD_ZURUECK[s].bedingungen}</p>
                  </div>
                )}
                <div className="gl-matt gl-wissen">
                  <h3>{t.wissenTitel}</h3>
                  <ul>{GLOBAL_PFLICHTHINWEIS[s].map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
            </Auf>
          </Block>

          {/* ── Klare Rollen ─────────────────────────────────────────────── */}
          <Block pille={t.vertrauenPille} titel={t.vertrauenH2} eng>
            <div className="gl-drei">
              {t.vertrauen.map((v, i) => (
                <Auf key={v.key} verzoegerung={i * 70}>
                  <div className="gl-matt"><h3>{v.titel}</h3><p>{GLOBAL_ROLLEN[s][v.key]}</p></div>
                </Auf>
              ))}
            </div>
            <Auf>
              <div className="gl-ablauf">
                <h3>{t.ablaufTitel}</h3>
                <ol>{t.ablauf.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
              <p className="gl-traeger">{t.traeger}</p>
            </Auf>
          </Block>

          {/* ── Die Menschen ─────────────────────────────────────────────── */}
          <Block pille={t.teamPille} titel={t.teamH2} lead={t.teamLead} eng>
            <Team kompakt />
            <div className="dk-knoepfe" style={{ marginTop: 32 }}><Knopf href={zu("/team")} still>{t.teamKnopf}</Knopf></div>
          </Block>
        </Licht>

        {/* ── Gespräch ─────────────────────────────────────────────────────── */}
        <Block id="gespraech" pille={t.gespraechPille} titel={t.gespraechH2} lead={t.gespraechLead}>
          <GlobalGespraech paket={wunsch} />
        </Block>

        {/* ── Fragen ───────────────────────────────────────────────────────── */}
        <Block schmal pille={t.fragenPille} eng>
          <Fragen items={t.fragen} />
        </Block>

        {/* ── Abschluss: ruhig, ohne Szene ─────────────────────────────────── */}
        <section className="gl-abschluss">
          <div className="dk-rahmen schmal mitte">
            <Auf>
              <h2 className="dk-h2" style={{ marginTop: 0 }}>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></h2>
              <p className="dk-lead">{t.abschlussText}</p>
              <div className="dk-knoepfe">
                <Knopf href="#pakete">{t.knopfPakete}</Knopf>
                <Knopf onClick={() => zumGespraech()} still>{t.knopfGespraech}</Knopf>
              </div>
            </Auf>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
