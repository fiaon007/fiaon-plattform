// /karriere · /en/careers — Arbeiten bei FIAON (Neufassung 23.08.2026, zweisprachig 02.09.2026)
// Justin: „Wir stellen nicht nur auf Provision ein, auch fest. Junges Start-up, rasant wachsend, wir brauchen IMMER
// Unterstützung. Die Bewerbung soll kein Formular sein, sondern ein Prozess; die Seite muss Freude machen, interaktiv sein,
// Leute anwerben; Abteilungen wählbar." Der Satz „Kunden werden Mitarbeiter" bleibt intern.
// Texte: client/src/i18n/karriere.ts. Auswahlwerte (Festanstellung, Vollzeit …) gehen unverändert an den Server;
// die englische Seite zeigt Etiketten dafür.
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Karten, Kennzahlen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { KARRIERE_WOERTER, KARRIERE_OPTION_EN, type Bereich } from "@/i18n/karriere";

const ARTEN = ["Festanstellung", "Freie Mitarbeit", "Werkstudent"];
const LAENDER = ["DE", "AT", "CH"];
type W = typeof KARRIERE_WOERTER.de;

export default function Karriere() {
  const t = useWoerter(KARRIERE_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/careers" : "/karriere";
  const BEREICHE = t.bereiche;
  const [gewaehlt, setGewaehlt] = useState<string>(BEREICHE[0].key);
  const bereich = useMemo(() => BEREICHE.find((b) => b.key === gewaehlt) || BEREICHE[0], [gewaehlt, BEREICHE]);
  const [vorwahl, setVorwahl] = useState<string | null>(null);
  const zurBewerbung = (key?: string) => { if (key) setVorwahl(key); document.getElementById("bewerbung")?.scrollIntoView({ behavior: "smooth" }); };
  const artL = (a: string) => t.artenLabel[a] ?? a;

  return (
    <Dunkel seite="karriere" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />
      <Hero
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf onClick={() => zurBewerbung()}>{t.bewerbungStarten}</Knopf><Knopf href="#bereiche" still>{t.bereicheEntdecken}</Knopf></>}
        szene={<NeuralSphere variant="hero" className="absolute inset-0" />}
        bild="/kino/karriere.jpg"
      />

      <Block eng>
        <Kennzahlen items={t.kennzahlen} />
      </Block>

      <Block pille={t.warumPille} titel={<>{t.warumA}<span className="dk-verlauf">{t.warumB}</span></>} lead={t.warumLead}>
        <Karten items={t.warum} zwei />
      </Block>

      <Licht>
        <Block id="bereiche" pille={t.bereichePille} titel={<>{t.bereicheA}<span className="dk-verlauf">{t.bereicheB}</span>{t.bereicheC}</>} lead={t.bereicheLead} mitte>
          <Auf>
            <div className="ka-tabs" role="tablist">
              {BEREICHE.map((b) => <button key={b.key} type="button" role="tab" data-an={gewaehlt === b.key ? "1" : undefined} onClick={() => setGewaehlt(b.key)}>{b.name}</button>)}
            </div>
          </Auf>
          <div className="ka-bereich" style={{ textAlign: "left" }}>
            <Glas ruhig>
              <span className="tag">{bereich.ort} · {bereich.arten.map(artL).join(" · ")}</span>
              <h3 className="dk-h3" style={{ fontSize: 22 }}>{bereich.name}</h3>
              <p className="dk-text" style={{ marginTop: 8, fontSize: 15 }}>{bereich.kurz}</p>
              <div className="ka-zwei">
                <div><p className="ka-titel">{t.wasTun}</p><ul className="dk-liste">{bereich.tun.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><p className="ka-titel">{t.wasMitbringen}</p><ul className="dk-liste">{bereich.mitbringen.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
              <div className="dk-knoepfe" style={{ marginTop: 28 }}><Knopf onClick={() => zurBewerbung(bereich.key)}>{t.fuerBewerben(bereich.name)}</Knopf></div>
            </Glas>
          </div>
        </Block>

        <Block pille={t.festPille} titel={<>{t.festA}<span className="dk-verlauf">{t.festB}</span></>} mitte>
          <div className="dk-raster zwei" style={{ textAlign: "left" }}>
            <Auf><Glas tag={t.festTag} titel={t.festTitel}>
              <ul className="dk-liste">{t.festListe.map((x) => <li key={x}>{x}</li>)}</ul>
            </Glas></Auf>
            <Auf verzoegerung={100}><Glas tag={t.freiTag} titel={t.freiTitel}>
              <ul className="dk-liste">{t.freiListe.map((x) => <li key={x}>{x}</li>)}</ul>
            </Glas></Auf>
          </div>
        </Block>

        <Block pille={t.arbeitPille} titel={<>{t.arbeitA}<span className="dk-verlauf">{t.arbeitB}</span></>}>
          <Karten items={t.arbeit} zwei />
        </Block>
      </Licht>

      <Block eng schmal>
        <Zitat text={t.zitat} wer={t.zitatWer} />
      </Block>

      <Zwischenruf text={t.zwischenruf} knopf={t.bewerbungStarten} href="#bewerbung" still={{ knopf: t.teamKennenlernen, href: zu("/team") }} />

      <Block id="bewerbung" pille={t.bewerbungPille} titel={<>{t.bewerbungA}<span className="dk-verlauf">{t.bewerbungB}</span></>} lead={t.bewerbungLead} schmal>
        <Bewerbung vorwahl={vorwahl} t={t} en={en} bereiche={BEREICHE} />
      </Block>

      <Block eng schmal pille={t.fragenPille}>
        <Fragen items={t.fragen} />
      </Block>

      <Abschluss
        titel={<>{t.abschlussA}<span className="dk-verlauf">{t.abschlussB}</span></>}
        text={t.abschlussText}
        knoepfe={<><Knopf onClick={() => zurBewerbung()}>{t.bewerbungStarten}</Knopf><Knopf href={zu("/was-ist-fiaon")} still>{t.wasFiaon}</Knopf></>}
      />
    </Dunkel>
  );
}

/* ── Der Bewerbungsprozess ──────────────────────────────────────────────── */
function Bewerbung({ vorwahl, t, en, bereiche }: { vorwahl: string | null; t: W; en: boolean; bereiche: Bereich[] }) {
  const opt = (v: string) => (en ? KARRIERE_OPTION_EN[v] ?? v : v);
  const artL = (a: string) => t.artenLabel[a] ?? a;
  const [schritt, setSchritt] = useState(0);
  const [w, setW] = useState<Record<string, string>>({ bereich: vorwahl || "", art: "", land: "", start: "", stunden: "", name: "", email: "", telefon: "", erfahrung: "", linkedin: "", text: "" });
  const [stand, setStand] = useState<"offen" | "sendet" | "fertig" | "fehler">("offen");
  const [meldung, setMeldung] = useState<string | null>(null);
  if (vorwahl && w.bereich !== vorwahl && schritt === 0 && !w.art) { setW({ ...w, bereich: vorwahl }); }
  const setze = (k: string, v: string) => setW((a) => ({ ...a, [k]: v }));
  const b = bereiche.find((x) => x.key === w.bereich);
  const weiter = [!!w.bereich, !!w.art && !!w.land, !!w.name && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(w.email) && !!w.telefon, true];

  const senden = async () => {
    setStand("sendet");
    const body = { art: "karriere", name: w.name, email: w.email, telefon: w.telefon, rolle: b?.name || w.bereich, land: w.land, erfahrung: w.erfahrung,
      anstellung: w.art, start: w.start, stunden: w.stunden, linkedin: w.linkedin, text: w.text, sprache: en ? "en" : "de" };
    const r = await fetch("/api/fiaon/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (r?.ok && j?.ok) { setStand("fertig"); setMeldung(en ? t.danke : (j.meldung || t.danke)); } else { setStand("fehler"); setMeldung(en ? t.fehler : (j?.error || t.fehler)); }
  };

  if (stand === "fertig") {
    return (
      <div className="dk-glas ruhig mitte" style={{ marginTop: 36 }}>
        <span className="dk-pille">{t.eingegangen}</span>
        <h3 className="dk-h3" style={{ marginTop: 16 }}>{meldung}</h3>
        <p className="dk-text" style={{ marginTop: 10 }}>{t.zusammenfassung(b?.name ?? "", artL(w.art), t.laender[w.land] || w.land)}</p>
      </div>
    );
  }

  return (
    <div className="ka-bewerbung">
      <div className="ka-fortschritt">
        {t.stufen.map((x, i) => <div key={x} className="ka-stufe" data-an={i === schritt ? "1" : undefined} data-fertig={i < schritt ? "1" : undefined}><span className="n">{i + 1}</span><span>{x}</span></div>)}
      </div>
      <div className="dk-glas ruhig" style={{ marginTop: 18 }}>
        {schritt === 0 && (
          <>
            <h3 className="dk-h3">{t.f0}</h3>
            <div className="ka-wahl">
              {bereiche.map((x) => (
                <button key={x.key} type="button" className="ka-karte" data-an={w.bereich === x.key ? "1" : undefined} onClick={() => setze("bereich", x.key)}>
                  <span className="name">{x.name}</span><span className="kurz">{x.ort} · {x.arten.map(artL).join(" · ")}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {schritt === 1 && (
          <>
            <h3 className="dk-h3">{t.f1}</h3>
            <p className="dk-leise" style={{ marginTop: 6 }}>{t.bereichLabel}: {b?.name}</p>
            <p className="ka-titel" style={{ marginTop: 18 }}>{t.artLabel}</p>
            <div className="ka-wahl klein">
              {ARTEN.filter((a) => !b || b.arten.includes(a)).map((a) => <button key={a} type="button" className="ka-karte" data-an={w.art === a ? "1" : undefined} onClick={() => setze("art", a)}><span className="name">{artL(a)}</span></button>)}
            </div>
            <p className="ka-titel" style={{ marginTop: 18 }}>{t.landLabel}</p>
            <div className="ka-wahl klein">
              {LAENDER.map((l) => <button key={l} type="button" className="ka-karte" data-an={w.land === l ? "1" : undefined} onClick={() => setze("land", l)}><span className="name">{t.laender[l]}</span></button>)}
            </div>
            <div className="dk-form" style={{ marginTop: 18 }}>
              <div className="zwei">
                <div><label className="dk-label" htmlFor="ka-start">{t.start}</label><input id="ka-start" className="dk-feld" type="month" value={w.start} onChange={(e) => setze("start", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-std">{t.stunden}</label>
                  <select id="ka-std" className="dk-feld" value={w.stunden} onChange={(e) => setze("stunden", e.target.value)}><option value="">{t.bitteWaehlen}</option>{t.stundenOptionen.map((o) => <option key={o} value={o}>{opt(o)}</option>)}</select></div>
              </div>
            </div>
          </>
        )}
        {schritt === 2 && (
          <>
            <h3 className="dk-h3">{t.f2}</h3>
            <div className="dk-form" style={{ marginTop: 18 }}>
              <div className="zwei">
                <div><label className="dk-label" htmlFor="ka-name">{t.name}</label><input id="ka-name" className="dk-feld" value={w.name} onChange={(e) => setze("name", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-email">{t.email}</label><input id="ka-email" className="dk-feld" type="email" inputMode="email" autoCapitalize="none" value={w.email} onChange={(e) => setze("email", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-tel">{t.telefon}</label><input id="ka-tel" className="dk-feld" type="tel" inputMode="tel" value={w.telefon} onChange={(e) => setze("telefon", e.target.value)} /></div>
                <div><label className="dk-label" htmlFor="ka-erf">{t.erfahrung}</label>
                  <select id="ka-erf" className="dk-feld" value={w.erfahrung} onChange={(e) => setze("erfahrung", e.target.value)}><option value="">{t.bitteWaehlen}</option>{t.erfahrungOptionen.map((o) => <option key={o} value={o}>{opt(o)}</option>)}</select></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="dk-label" htmlFor="ka-li">{t.linkedin}</label><input id="ka-li" className="dk-feld" value={w.linkedin} onChange={(e) => setze("linkedin", e.target.value)} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label className="dk-label" htmlFor="ka-text">{t.warumFeld}</label><textarea id="ka-text" className="dk-feld" rows={4} value={w.text} onChange={(e) => setze("text", e.target.value)} /></div>
              </div>
            </div>
          </>
        )}
        {schritt === 3 && (
          <>
            <h3 className="dk-h3">{t.f3}</h3>
            <div style={{ marginTop: 14 }}>
              {[b?.name, artL(w.art), t.laender[w.land] || w.land, w.start || t.offen, opt(w.stunden) || t.offen, w.name, w.email, w.telefon, opt(w.erfahrung) || "—"].map((v, i) => (
                <div key={t.pruefZeilen[i]} className="dk-zeile"><span>{t.pruefZeilen[i]}</span><b>{v}</b></div>
              ))}
            </div>
            <p className="dk-leise" style={{ marginTop: 14 }}>{t.datenschutz}</p>
            {stand === "fehler" && <p style={{ color: "#fca5a5", fontSize: 13.5, marginTop: 10 }}>{meldung}</p>}
          </>
        )}
        <div className="ka-knoepfe">
          {schritt > 0 && <Knopf onClick={() => setSchritt(schritt - 1)} still>{t.zurueck}</Knopf>}
          {schritt < 3 && <button type="button" className="dk-knopf" disabled={!weiter[schritt]} onClick={() => setSchritt(schritt + 1)}>{t.weiter}</button>}
          {schritt === 3 && <button type="button" className="dk-knopf" disabled={stand === "sendet"} onClick={() => void senden()}>{stand === "sendet" ? t.sendet : t.absenden}</button>}
        </div>
      </div>
    </div>
  );
}
