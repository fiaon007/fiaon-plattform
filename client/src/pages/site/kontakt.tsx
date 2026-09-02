// ═══════════════════════════════════════════════════════════════════════════
// /kontakt — Kontakt & Support (23.08.2026, Justin: „eine gesamte Seite,
// Support-Telefon, E-Mail, ein KI-Chat-Agent, der alles kennt, und eine
// Funktion, mit der der Kunde Dringendes direkt ins Admin-Dashboard oder an
// einen Mitarbeiter senden kann — hochmodern, CI, 3D.")
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — /kontakt (Deutsch) und /en/contact (Englisch);
// Texte im Wörterbuch client/src/i18n/kontakt.ts; der Assistent antwortet
// auf der englischen Seite auf Englisch (KiChat sendet sprache).
import { useEffect, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Auf, Glas, Fragen } from "@/components/site/DunkleBuehne";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import KiChat from "@/components/site/KiChat";
import { SUPPORT } from "@shared/fiaon-wissen";
import { useWoerter } from "@/i18n/sprache";
import { KONTAKT_WOERTER } from "@/i18n/kontakt";
import "@/styles/kontakt.css";

export default function Kontakt() {
  const t = useWoerter(KONTAKT_WOERTER);
  const [f, setF] = useState({ name: "", email: "", telefon: "", text: "", an: "geschaeftsfuehrung" as "geschaeftsfuehrung" | "ansprechpartner" });
  const [stand, setStand] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [eingeloggt, setEingeloggt] = useState<{ ref: string; vorname: string | null } | null>(null);
  useEffect(() => { fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.eingeloggt) setEingeloggt({ ref: j.ref, vorname: j.vorname || null }); }).catch(() => {}); }, []);

  const senden = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setStand(null);
    try {
      const r = await fetch("/api/fiaon/kontakt/dringend", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setStand({ ok: true, text: t.angekommen(String(j.nummer), String(j.an)) }); setF({ ...f, text: "" }); }
      else setStand({ ok: false, text: j?.error || t.nichtGeklappt });
    } catch { setStand({ ok: false, text: t.keineVerbindung }); }
    finally { setLaeuft(false); }
  };

  return (
    <Dunkel seite="kontakt" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <section className="dk-hero kt-hero">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen dk-zweispaltig">
          <Auf>
            <span className="dk-pille">{t.pille}</span>
            <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
            <p className="dk-lead">{t.lead}</p>
            <div className="kt-wege">
              <a href={`tel:${SUPPORT.telefonTel}`} className="kt-weg"><small>{t.telefon}</small><b>{SUPPORT.telefon}</b><span>{t.telefonSatz}</span></a>
              <a href={`mailto:${SUPPORT.email}`} className="kt-weg"><small>{t.email}</small><b>{SUPPORT.email}</b><span>{t.emailSatz}</span></a>
              <a href="#dringend" className="kt-weg hervor"><small>{t.dringend}</small><b>{t.dringendTitel}</b><span>{t.dringendSatz}</span></a>
            </div>
          </Auf>
          <Auf verzoegerung={150}><div className="dk-szene gross kt-szene"><NeuralSphere className="absolute inset-0" /></div></Auf>
        </div>
      </section>

      <Block id="assistent" pille={t.assistentPille} titel={<>{t.assistentH2a}<span className="dk-verlauf">{t.assistentH2b}</span></>} lead={t.assistentLead}>
        <div style={{ marginTop: 40 }}><Auf><KiChat /></Auf></div>
      </Block>

      <Licht>
        <Block id="dringend" pille={t.dringendPille} titel={<>{t.dringendH2a}<span className="dk-verlauf">{t.dringendH2b}</span></>} lead={t.dringendLead} mitte>
          <form className="kt-form" onSubmit={senden}>
            <div className="kt-form-raster">
              <label><span>{t.name}</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={eingeloggt?.vorname ? `${eingeloggt.vorname} …` : t.namePlatz} autoComplete="name" /></label>
              <label><span>{t.emailFeld}</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder={t.emailPlatz} autoComplete="email" /></label>
              <label><span>{t.telefonFeld}</span><input type="tel" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} placeholder={t.telefonPlatz} autoComplete="tel" /></label>
              <label><span>{t.anWen}</span>
                <select value={f.an} onChange={(e) => setF({ ...f, an: e.target.value as typeof f.an })}>
                  <option value="geschaeftsfuehrung">{t.anGf}</option>
                  <option value="ansprechpartner" disabled={!eingeloggt}>{eingeloggt ? t.anAnsprech : t.anAnsprechAnmelden}</option>
                </select>
              </label>
            </div>
            <label><span>{t.wasPassiert}</span><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={5} placeholder={t.wasPlatz} required /></label>
            {stand && <p className={`kt-stand ${stand.ok ? "ok" : "fehler"}`}>{stand.text}</p>}
            <div className="kt-form-fuss">
              <button type="submit" className="dk-knopf" disabled={laeuft}>{laeuft ? t.wirdGesendet : t.dringendMelden}</button>
              <span className="dk-leise">{eingeloggt ? t.angemeldetAls(eingeloggt.ref) : t.kundeHinweis}</span>
            </div>
          </form>
        </Block>

        <Block pille={t.erwartenPille} mitte>
          <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
            {t.erwarten.map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
          </div>
        </Block>

        <Block schmal pille={t.fragenPille}>
          <Fragen items={t.fragen} />
        </Block>
      </Licht>

      <section className="dk-block" style={{ paddingTop: 30 }}>
        <div className="dk-rahmen mitte"><p className="dk-leise">{SUPPORT.firma} · {SUPPORT.adresse} · {SUPPORT.register}</p></div>
      </section>
    </Dunkel>
  );
}
