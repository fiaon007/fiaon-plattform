// ═══════════════════════════════════════════════════════════════════════════
// /global — FIAON Global OS (Neubau 15.09.2026)
//
// Neue Positionierung neben /business (bleibt bestehen): weg vom
// „Bonitäts-Reparaturservice", hin zu US-Entity, US-Banking und hohen
// Credit-Limits für DACH-Unternehmen. Vier Pakete als einmalige
// Setup-Investition, US-Limit-Audit als Frontend-Rechner, CTAs nur als
// Verlinkung auf /termin und /kontakt — kein Checkout, kein Formular.
//
// Ton: Du-Form, offensiv — aber ehrlich: „Ziel-Limit", „bis zu", der
// Kartenherausgeber entscheidet. Texte in client/src/i18n/global.ts.
//
// 15.09.2026 (zweite Fassung): seriöser und räumlicher — KinoHero mit zwei
// schwebenden 3D-Karten, SchichtenSzene für die Architektur, Maus-Tiefe auf
// den Paket- und Glaskarten, Miami als Video-Band, Team aus components/site.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Fragen, Zwischenruf, Abschluss } from "@/components/site/DunkleBuehne";
import { KinoHero } from "@/components/site/KinoHero";
import { Team } from "@/components/site/Team";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import { GLOBAL_WOERTER } from "@/i18n/global";
import "@/styles/global.css";

const t = GLOBAL_WOERTER.de;

// Deutsche Zahl lesen: „30.000" und „30000,5" beides. Ungültiges → 0.
const z = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };
const euro0 = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const usd0 = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " $";

// ── Die vier Pakete ────────────────────────────────────────────────────────
// Preise sind einmalige Setup-Investitionen — bewusst NICHT aus
// shared/fiaon-pakete.ts: dort stehen die Monats-Abos der alten Welt.
const PAKETE = [
  { key: "starter",    name: "Starter Credit",       preis: 2499,  limit: 50000,  ton: "silber" },
  { key: "pro",        name: "Pro Scale",            preis: 4999,  limit: 100000, ton: "navy", empfohlen: true },
  { key: "enterprise", name: "Enterprise Limit",     preis: 6999,  limit: 250000, ton: "schwarz" },
  { key: "miami",      name: "VIP Miami Experience", preis: 35999, limit: 250000, ton: "miami" },
];

// Maus-Tiefe: Karten und Glasflächen neigen sich zum Zeiger (wie Szenenbild „tief").
const neigen = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget; const b = el.getBoundingClientRect();
  el.style.setProperty("--nx", String(((e.clientX - b.left) / b.width - 0.5) * 2));
  el.style.setProperty("--ny", String(((e.clientY - b.top) / b.height - 0.5) * 2));
};
const gerade = (e: React.MouseEvent<HTMLElement>) => {
  e.currentTarget.style.setProperty("--nx", "0");
  e.currentTarget.style.setProperty("--ny", "0");
};

export default function GlobalPage() {
  // ── US-Limit-Audit ─────────────────────────────────────────────────────
  const [werbung, setWerbung] = useState("");
  const [einkauf, setEinkauf] = useState("");
  const [limitJetzt, setLimitJetzt] = useState("");
  const [miami, setMiami] = useState(false);

  // Video-Band nur am Rechner und nur ohne reduzierte Bewegung (KinoHero-Muster).
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [gross, setGross] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const fn = () => setGross(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const audit = useMemo(() => {
    const ausgaben = z(werbung) + z(einkauf);
    if (!ausgaben) return null;
    // Faustregel wie auf /business: zwei Monatsumsätze als sinnvoller Rahmen.
    const bedarf = Math.ceil(ausgaben * 2 / 5000) * 5000;
    const usLimit = Math.min(250000, bedarf);
    const puffer = Math.max(0, bedarf - z(limitJetzt));
    const paket = miami
      ? PAKETE[3]
      : usLimit <= 50000 ? PAKETE[0] : usLimit <= 100000 ? PAKETE[1] : PAKETE[2];
    return { ausgaben, usLimit, puffer, paket };
  }, [werbung, einkauf, limitJetzt, miami]);

  return (
    <Dunkel seite="business" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      {/* ── Hero: Video-Bühne + zwei schwebende FIAON-Karten (KartenSzene) ── */}
      <KinoHero
        video="/kino/kugel.mp4"
        bild="/kino/kugel.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        punkte={t.heroPunkte}
        knoepfe={<><Knopf href="#audit">{t.auditStart}</Knopf><Knopf href="/termin" still>{t.gespraech}</Knopf></>}
        karten={2}
      />

      <section className="dk-block" style={{ paddingTop: 20 }}>
        <div className="dk-rahmen"><Kennzahlen items={t.zahlen} /></div>
      </section>

      {/* ── Warum die USA ────────────────────────────────────────────── */}
      <Block pille={t.warumPille} titel={<>{t.warumH2a}<span className="dk-verlauf">{t.warumH2b}</span></>} lead={t.warumLead}>
        <div className="dk-raster gb-raum" style={{ marginTop: 36 }}>
          {t.warum.map((w, i) => (
            <Auf key={w.tag} verzoegerung={i * 80}>
              <div className="gb-neige" onMouseMove={neigen} onMouseLeave={gerade}>
                <Glas tag={w.tag} titel={w.titel}>{w.text}</Glas>
              </div>
            </Auf>
          ))}
        </div>
      </Block>

      {/* ── Die Struktur: drei Schichten als 3D-Glasplatten ──────────── */}
      <section className="dk-block">
        <div className="dk-rahmen dk-zweispaltig">
          <Auf><div className="dk-szene gross gb-szene"><SchichtenSzene namen={t.strukturSchichten} className="absolute inset-0" /></div></Auf>
          <Auf verzoegerung={140}>
            <span className="dk-pille">{t.strukturPille}</span>
            <h2 className="dk-h2">{t.strukturH2a}<span className="dk-verlauf">{t.strukturH2b}</span></h2>
            <p className="dk-lead">{t.strukturLead}</p>
            <div className="gb-schichten">
              {t.schichten.map((s) => (
                <div key={s.n} className="gb-schicht">
                  <span className="n">{s.n}</span>
                  <div><b>{s.titel}</b><p>{s.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </div>
      </section>

      {/* ── US-Limit-Audit ───────────────────────────────────────────── */}
      <Licht>
        <Block id="audit" pille={t.auditPille} titel={<>{t.auditH2a}<span className="dk-verlauf">{t.auditH2b}</span></>} lead={t.auditLead} mitte>
          <div className="gb-werkzeug">
            <div className="gb-felder zwei">
              <label><span>{t.auditWerbung}</span><input inputMode="decimal" placeholder={t.auditPlatz} value={werbung} onChange={(e) => setWerbung(e.target.value)} /></label>
              <label><span>{t.auditEinkauf}</span><input inputMode="decimal" placeholder={t.auditPlatz} value={einkauf} onChange={(e) => setEinkauf(e.target.value)} /></label>
              <label><span>{t.auditLimit}</span><input inputMode="decimal" placeholder="z. B. 15.000" value={limitJetzt} onChange={(e) => setLimitJetzt(e.target.value)} /></label>
              <label className={`gb-miami${miami ? " an" : ""}`}>
                <input type="checkbox" checked={miami} onChange={(e) => setMiami(e.target.checked)} />
                <span className="haken" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
                <span className="txt">{t.auditMiami}</span>
              </label>
            </div>
            {audit && (
              <div className="gb-ergebnis" role="status">
                <small>{t.auditErgebnis}</small>
                <h3>{t.auditTitelA}<b>{usd0(audit.usLimit)}</b>{t.auditTitelB}</h3>
                <p>{t.auditText(euro0(audit.puffer), audit.paket.name)}</p>
                <div className="gb-zeile"><span>{t.auditPufferZeile}</span><b>{euro0(audit.puffer)}</b></div>
                <div className="gb-zeile"><span>{t.auditPaketZeile}</span><b className="paket-name">{audit.paket.name} · {euro0(audit.paket.preis)}</b></div>
                <div className="dk-knoepfe" style={{ marginTop: 20 }}><Knopf href="/termin">{t.auditGespraech}</Knopf><Knopf href="/kontakt" still>{t.auditPaketAnfragen}</Knopf></div>
                <p className="gb-fussnote">{t.auditFussnote}</p>
              </div>
            )}
          </div>
        </Block>

        {/* ── Der Weg ────────────────────────────────────────────────── */}
        <Block pille={t.wegPille} titel={<>{t.wegH2a}<span className="dk-verlauf">{t.wegH2b}</span></>}>
          <Schritte items={t.weg} />
        </Block>
      </Licht>

      {/* ── Pakete (dunkle Bühne — die Karten sind für Dunkel gebaut) ── */}
      <Block id="pakete" pille={t.paketePille} titel={<>{t.paketeH2a}<span className="dk-verlauf">{t.paketeH2b}</span></>} lead={t.paketeLead}>
        <div className="gb-pakete">
          {PAKETE.map((p, i) => {
            const w = t.pakete[p.key];
            return (
              <Auf key={p.key} verzoegerung={i * 70}>
                <a href="/kontakt" className={`gb-paket ${p.ton}${p.empfohlen ? " empfohlen" : ""}`} onMouseMove={neigen} onMouseLeave={gerade}>
                  {p.empfohlen && <span className="empfohlen-band">Empfohlen</span>}
                  <div className="gb-karte"><span>FIAON</span><i className="chip" /><b>{p.name}</b><small>{t.zielLimit}{usd0(p.limit)}</small></div>
                  <div className="gb-paket-text">
                    <p className="gb-preis">{euro0(p.preis)} <span>{t.einmalig}</span></p>
                    <p className="gb-fuer">{w.fuer}</p>
                    <ul>{w.punkte.map((x) => <li key={x}>{x}</li>)}</ul>
                    <span className="gb-paket-knopf">{p.empfohlen ? t.empfohlenStarten : t.paketWaehlen}</span>
                  </div>
                </a>
              </Auf>
            );
          })}
        </div>
      </Block>

      {/* ── VIP Miami: Video-Band mit 3D-Relief ──────────────────────── */}
      <section className="dk-szenenbild tief gb-miami-band" onMouseMove={neigen} onMouseLeave={gerade}>
        {gross && !ruhe
          ? <video className="gb-miami-film" src="/kino/flug.mp4" poster="/kino/flug-start.jpg" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          : <img src="/kino/flug-start.jpg" alt="" loading="lazy" decoding="async" />}
        <div className="schleier" />
        <div className="dk-szenenbild-kegel" aria-hidden="true" />
        <div className="dk-rahmen schmal mitte inhalt">
          <Auf>
            <span className="dk-pille">{t.miamiPille}</span>
            <h2 className="dk-h2 dk-relief" style={{ marginTop: 0 }}>{t.miamiH2}</h2>
            <p className="dk-lead">{t.miamiText}</p>
            <div className="dk-knoepfe" style={{ justifyContent: "center" }}><Knopf href="/kontakt">{t.miamiKnopf}</Knopf></div>
          </Auf>
        </div>
      </section>

      {/* ── Für wen ──────────────────────────────────────────────────── */}
      <Block pille={t.fuerPille} titel={<>{t.fuerH2a}<span className="dk-verlauf">{t.fuerH2b}</span></>}>
        <div className="dk-raster gb-raum" style={{ marginTop: 36 }}>
          {t.fuer.map((w, i) => (
            <Auf key={w.tag} verzoegerung={i * 80}>
              <div className="gb-neige" onMouseMove={neigen} onMouseLeave={gerade}>
                <Glas tag={w.tag} titel={w.titel}>{w.text}</Glas>
              </div>
            </Auf>
          ))}
        </div>
      </Block>

      {/* ── Team: die drei Gesellschafter (Komponente von /team) ─────── */}
      <Block pille={t.teamPille} titel={<>{t.teamH2a}<span className="dk-verlauf">{t.teamH2b}</span></>} lead={t.teamLead} mitte>
        <div style={{ textAlign: "left" }}><Team kompakt /></div>
        <Auf verzoegerung={220}>
          <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 30 }}><Knopf href="/team" still>{t.teamLink}</Knopf></div>
        </Auf>
      </Block>

      {/* ── Fragen ───────────────────────────────────────────────────── */}
      <Licht>
        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>{t.zwischenrufA}</b>{t.zwischenrufB}</>} knopf={t.termin} href="/termin" still={{ knopf: t.kontakt, href: "/kontakt" }} />
      <Abschluss titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>} text={t.abschlussText} knoepfe={<><Knopf href="#audit">{t.auditStart}</Knopf><Knopf href="#pakete" still>{t.paketeAnsehen}</Knopf></>} />
    </Dunkel>
  );
}
